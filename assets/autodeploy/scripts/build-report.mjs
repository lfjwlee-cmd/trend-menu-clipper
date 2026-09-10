// Daily trend-menu report builder.
// Runs in GitHub Actions (or locally) with YOUTUBE_API_KEY set.
// Pulls yesterday's (KST) qualifying videos via the official YouTube Data API v3
// — no browser automation, no scraping, so results are exact and reproducible.
//
// Usage: YOUTUBE_API_KEY=xxx node scripts/build-report.mjs

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error("YOUTUBE_API_KEY is not set. Add it as a repo secret (Settings > Secrets and variables > Actions).");
  process.exit(1);
}

const config = JSON.parse(await readFile(path.join(ROOT, "config.json"), "utf8"));
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstFields(utcMs) {
  const d = new Date(utcMs + KST_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, day: d.getUTCDate() };
}
function pad(n) { return String(n).padStart(2, "0"); }

// "Yesterday" is computed relative to the KST wall-clock date, not the runner's UTC date —
// this is what makes the date filter exact instead of an approximation.
const nowUtcMs = Date.now();
const today = kstFields(nowUtcMs);
const todayKstMidnightUtcMs = Date.UTC(today.y, today.m - 1, today.day, 0, 0, 0) - KST_OFFSET_MS;
const yStartUtcMs = todayKstMidnightUtcMs - 24 * 60 * 60 * 1000;
const yEndUtcMs = todayKstMidnightUtcMs;
const yesterday = kstFields(yStartUtcMs + 1000);
const targetDateStr = `${yesterday.y}-${pad(yesterday.m)}-${pad(yesterday.day)}`;
const publishedAfter = new Date(yStartUtcMs).toISOString();
const publishedBefore = new Date(yEndUtcMs).toISOString();

console.log(`Target date (KST): ${targetDateStr}  (${publishedAfter} .. ${publishedBefore})`);

async function searchKeyword(keyword) {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("key", API_KEY);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", keyword);
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "viewCount");
  url.searchParams.set("regionCode", config.regionCode || "KR");
  url.searchParams.set("relevanceLanguage", config.relevanceLanguage || "ko");
  url.searchParams.set("publishedAfter", publishedAfter);
  url.searchParams.set("publishedBefore", publishedBefore);
  url.searchParams.set("maxResults", String(config.maxResultsPerKeyword || 25));

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`search.list failed for "${keyword}": ${res.status} ${body}`);
  }
  const data = await res.json();
  return (data.items || []).map((it) => ({ id: it.id.videoId, keyword }));
}

async function fetchStats(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("key", API_KEY);
    url.searchParams.set("part", "snippet,statistics");
    url.searchParams.set("id", batch.join(","));
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`videos.list failed: ${res.status} ${body}`);
    }
    const data = await res.json();
    for (const it of data.items || []) {
      out.set(it.id, {
        id: it.id,
        title: it.snippet.title,
        channelTitle: it.snippet.channelTitle,
        publishedAt: it.snippet.publishedAt,
        thumbnail: it.snippet.thumbnails?.high?.url || it.snippet.thumbnails?.medium?.url || it.snippet.thumbnails?.default?.url,
        viewCount: Number(it.statistics.viewCount || 0),
      });
    }
  }
  return out;
}

function tagBrand(title) {
  const hit = (config.brandTags || []).find((b) => title.toLowerCase().includes(b.toLowerCase()));
  return hit || null;
}

// 1. Search every keyword, dedupe candidate video IDs.
const candidateRefs = new Map(); // id -> Set(keywords)
for (const kw of config.keywords) {
  let results = [];
  try {
    results = await searchKeyword(kw);
  } catch (err) {
    console.error(`Keyword "${kw}" search failed, skipping:`, err.message);
    continue;
  }
  for (const r of results) {
    if (!candidateRefs.has(r.id)) candidateRefs.set(r.id, new Set());
    candidateRefs.get(r.id).add(r.keyword);
  }
}
const candidateIds = [...candidateRefs.keys()];
console.log(`Candidates found: ${candidateIds.length}`);

// 2. Fetch exact stats for every candidate (search.list's snippet omits view counts).
const stats = candidateIds.length ? await fetchStats(candidateIds) : new Map();

// 3. Filter to the exact target date + threshold, then rank.
// publishedAfter/publishedBefore already constrain the search, but we re-check the
// exact publishedAt here too, since search.list's date filtering has a small tolerance
// in practice — this keeps the "exact date" guarantee independent of API quirks.
const qualified = [];
for (const id of candidateIds) {
  const v = stats.get(id);
  if (!v) continue;
  const publishedMs = Date.parse(v.publishedAt);
  if (publishedMs < yStartUtcMs || publishedMs >= yEndUtcMs) continue;
  if (v.viewCount < (config.viewThreshold || 1000)) continue;
  qualified.push({
    ...v,
    keywords: [...candidateRefs.get(id)],
    brand: tagBrand(v.title),
    url: `https://www.youtube.com/watch?v=${id}`,
  });
}
qualified.sort((a, b) => b.viewCount - a.viewCount);
const top = qualified.slice(0, config.topN || 10);

console.log(`Qualified (>= ${config.viewThreshold} views, exact date match): ${qualified.length}`);
console.log(`Publishing top ${top.length}`);

// 4. Persist the day's data (this is what makes week-over-week trend tracking possible later —
//    every run appends one file, nothing is overwritten).
const dataDir = path.join(ROOT, "data");
if (!existsSync(dataDir)) await mkdir(dataDir, { recursive: true });
const dayRecord = {
  date: targetDateStr,
  generatedAt: new Date().toISOString(),
  keywords: config.keywords,
  viewThreshold: config.viewThreshold,
  candidateCount: candidateIds.length,
  qualifiedCount: qualified.length,
  items: top,
};
await writeFile(path.join(dataDir, `${targetDateStr}.json`), JSON.stringify(dayRecord, null, 2));

// 5. Render the bento-grid HTML (this platform has no image CSP, so thumbnails hotlink directly).
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmt(n) { return n.toLocaleString("ko-KR"); }

function card(item, rank) {
  const sizeClass = rank === 1 ? "card--r1" : rank <= 3 ? "card--r23" : "";
  const brandChip = item.brand ? `<span class="brand">${esc(item.brand)}</span>` : "";
  return `
    <a class="card ${sizeClass}" href="${item.url}" target="_blank" rel="noopener">
      <div class="cover" style="background-image:url('${item.thumbnail}')"></div>
      <div class="scrim"></div>
      <span class="rank">${rank}</span>
      <span class="badge">▶ YouTube</span>
      <div class="body">
        ${brandChip}
        <p class="title">${esc(item.title)}</p>
        <div class="meta"><span class="views">조회수 ${fmt(item.viewCount)}회</span><span>· ${esc(item.channelTitle)}</span></div>
      </div>
    </a>`;
}

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(config.siteTitle)} · ${targetDateStr}</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍽️</text></svg>">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Gothic+A1:wght@400;500;700;900&display=swap">
<style>
:root{
  --bg:#faf5ee; --surface:#ffffff; --surface-2:#f2e9dc; --line:#e6dac8;
  --ink:#241b12; --ink-dim:#7a6c58; --accent:#e0451f; --accent-ink:#fff7f0; --gold:#c8860a;
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#171210; --surface:#211a15; --surface-2:#2a2119; --line:#3a2d22;
    --ink:#f4ebdd; --ink-dim:#a99884; --accent:#ff6a3d; --accent-ink:#1a0f08; --gold:#f3b632;
  }
}
*{box-sizing:border-box;}
body{margin:0;background:var(--bg);color:var(--ink);font-family:'Gothic A1',system-ui,sans-serif;padding:32px clamp(16px,4vw,48px) 56px;}
.wrap{max-width:1180px;margin:0 auto;}
header{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:20px;padding-bottom:22px;margin-bottom:26px;border-bottom:3px solid var(--ink);}
.eyebrow{font-size:13px;font-weight:700;letter-spacing:.14em;color:var(--accent);text-transform:uppercase;margin:0 0 6px;}
h1{font-family:'Black Han Sans',sans-serif;font-weight:400;font-size:clamp(28px,4.4vw,44px);line-height:1.1;margin:0;}
.head-meta{text-align:right;font-size:13px;color:var(--ink-dim);line-height:1.6;}
.head-meta b{color:var(--ink);}
.archive-link{font-size:13px;color:var(--accent);text-decoration:none;font-weight:700;}
.filter-bar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:28px;}
.chip{font-size:12.5px;font-weight:700;padding:7px 14px;border-radius:999px;background:var(--surface-2);border:1px solid var(--line);color:var(--ink-dim);}
.chip b{color:var(--ink);}
.grid{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:150px;gap:14px;margin-bottom:34px;}
.card{position:relative;border-radius:14px;overflow:hidden;background:var(--surface);border:1px solid var(--line);color:#fff;display:flex;flex-direction:column;justify-content:flex-end;text-decoration:none;}
.card .cover{position:absolute;inset:0;background-size:cover;background-position:center;}
.card .scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,12,6,0) 30%,rgba(15,9,5,.55) 62%,rgba(10,6,3,.92) 100%);}
.card .rank{position:absolute;top:10px;left:10px;font-family:'Black Han Sans',sans-serif;font-size:22px;background:var(--accent);color:var(--accent-ink);min-width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;z-index:2;}
.card .badge{position:absolute;top:10px;right:10px;font-size:11px;font-weight:700;background:rgba(0,0,0,.55);color:#fff;padding:4px 9px;border-radius:999px;z-index:2;}
.card .body{position:relative;z-index:2;padding:12px 14px 13px;}
.card .brand{display:inline-block;font-size:10.5px;font-weight:700;background:var(--gold);color:#1a0f08;padding:2px 7px;border-radius:999px;margin-bottom:5px;}
.card .title{font-size:14px;font-weight:700;line-height:1.32;margin:0 0 5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.card .meta{display:flex;gap:7px;font-size:11.5px;color:rgba(255,255,255,.78);}
.card .views{font-variant-numeric:tabular-nums;font-weight:900;color:var(--gold);font-size:13px;}
.card--r1{grid-column:span 2;grid-row:span 2;}
.card--r1 .title{font-size:19px;-webkit-line-clamp:3;}
.card--r1 .views{font-size:18px;}
.card--r23{grid-column:span 2;grid-row:span 1;}
@media (max-width:760px){.grid{grid-template-columns:repeat(2,1fr);}.card--r1,.card--r23{grid-column:span 2;}}
.empty{padding:40px;text-align:center;color:var(--ink-dim);border:1px dashed var(--line);border-radius:14px;}
.note{border-top:1px solid var(--line);padding-top:18px;font-size:12.5px;color:var(--ink-dim);line-height:1.7;}
.note b{color:var(--ink);}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <p class="eyebrow">Trend Menu Clipping · YouTube · Auto-updated daily</p>
      <h1>${esc(targetDateStr)} 트렌드 메뉴 랭킹</h1>
    </div>
    <div class="head-meta">
      매일 오전 6시(KST) 자동 갱신<br>
      생성 시각 ${new Date().toISOString()}<br>
      <a class="archive-link" href="./archive/">지난 리포트 보기 →</a>
    </div>
  </header>
  <div class="filter-bar">
    <span class="chip">업로드일 = <b>${esc(targetDateStr)} 정확히 일치</b> (YouTube Data API publishedAfter/Before)</span>
    <span class="chip">조회수 <b>≥ ${fmt(config.viewThreshold)}회</b></span>
    <span class="chip">검토 후보 <b>${fmt(candidateIds.length)}건</b> → 조건 충족 <b>${fmt(qualified.length)}건</b></span>
  </div>
  ${top.length ? `<div class="grid">${top.map((it, i) => card(it, i + 1)).join("")}</div>`
              : `<div class="empty">오늘은 조건을 충족하는 영상이 없습니다.</div>`}
  <div class="note">
    <p><b>왜 유튜브뿐인가:</b> 인스타그램은 해시태그 검색이 로그인 없이 막혀 있고, 공식 API로도 공개 계정 전역 키워드 검색을 지원하지 않아 이 자동화에서는 다루지 않습니다. 지어낸 숫자를 넣지 않기 위한 의도적인 제외입니다.</p>
    <p><b>정확도:</b> 모든 조회수·업로드일은 YouTube Data API가 반환한 값 그대로이며(화면을 읽어 추정한 값 아님), 이 리포트는 사람의 판단 없이 코드로 매일 동일한 기준으로 생성됩니다.</p>
  </div>
</div>
</body>
</html>`;

// 6. Write the site: docs/index.html always mirrors today, docs/archive/<date>.html is permanent.
const docsDir = path.join(ROOT, "docs");
const archiveDir = path.join(docsDir, "archive");
if (!existsSync(archiveDir)) await mkdir(archiveDir, { recursive: true });
await writeFile(path.join(docsDir, "index.html"), html);
await writeFile(path.join(archiveDir, `${targetDateStr}.html`), html.replace('href="./archive/"', 'href="./"'));

// 7. Rebuild the archive index from every data/*.json file on disk.
const { readdir } = await import("node:fs/promises");
const dataFiles = (await readdir(dataDir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
const archiveRows = dataFiles.map((f) => {
  const date = f.replace(".json", "");
  return `<li><a href="./${date}.html">${date}</a></li>`;
}).join("\n");
const archiveIndexHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${esc(config.siteTitle)} · 지난 리포트</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;}
a{color:#e0451f;text-decoration:none;font-weight:700;} li{margin:8px 0;font-size:15px;}</style>
</head><body><h1>지난 리포트</h1><ul>${archiveRows || "<li>아직 기록이 없습니다.</li>"}</ul>
<p><a href="../">← 오늘 리포트로</a></p></body></html>`;
await writeFile(path.join(archiveDir, "index.html"), archiveIndexHtml);

console.log("Done.");
