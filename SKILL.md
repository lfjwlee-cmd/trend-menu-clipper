---
name: trend-menu-clipper
description: >
  Use when the user wants to collect trending food/menu clips from YouTube
  and/or Instagram for a specific day and turn them into a ranked visual
  report — e.g. "트렌드 메뉴 클리핑", "요즘 뜨는 메뉴 모아줘", "어제 인스타
  유튜브 인기 메뉴", "신메뉴 트렌드 리포트 만들어줘", or "매일 자동으로
  업데이트되는 트렌드 메뉴 사이트 만들어줘". Filters by exact upload date and
  a minimum engagement count, ranks the top N, and renders an HTML bento-grid
  report. Bundles a ready-to-run collect/verify/render pipeline that produces
  the HTML in three commands with no API key, login, or account. Also covers a
  browser-driven mode that can include Instagram, and a GitHub Actions deploy
  that publishes to GitHub Pages every morning.
---

# Trend Menu Clipper

Collects Korean food/menu content uploaded on one exact calendar date, keeps
only items above an engagement threshold, ranks the top N, and renders them
as a single HTML bento-grid report.

## 이 스킬을 받은 사람이 설치하는 법

저장소 하나가 전부다. API 키도 계정도 필요 없고, 받는 사람 고유 설정만 바꾸면 된다.

```bash
git clone https://github.com/lfjwlee-cmd/trend-menu-clipper.git \
  ~/.claude/skills/trend-menu-clipper
```

Claude Code를 다시 시작하면 스킬 목록에 잡힌다. 클론이 어려우면 ZIP으로 받아
`.claude/skills/trend-menu-clipper/` 에 풀어도 똑같다. 그 뒤는 아래 3줄이면 끝이다.

## Start here: run the pipeline. It needs nothing from the user.

`assets/pipeline/` is a working collect → verify → render pipeline. Copy the
folder, work **inside it**, and run three commands; an HTML report comes out the
other end. **No API key, no login, no GitHub account** — yt-dlp reads YouTube's
public pages, which works fine from an ordinary home or office network.

```bash
# 1. copy the whole assets/pipeline folder somewhere the user can find it,
#    then change into that copy. The scripts resolve paths from their own
#    location, so running them from anywhere else fails on the first line.
cd <the copied pipeline folder>

# 2. Python 3.7+ must be on PATH. On Windows `python` is often `py`:
python --version || py --version

# 3. collect -> verify -> render
pip install -r requirements.txt   # yt-dlp; only the keyless path needs it
python scripts/build.py     # yesterday's qualifying videos -> data/<date>.json
python scripts/verify.py    # quality gate; stops here if the data is bad
python scripts/render.py    # write docs/index.html

# 4. optional: prove this copy's rules match the reference, offline
python scripts/selftest.py  # 17 checks, no network, no API key
```

Open `docs/index.html` in a browser to see it (double-clicking the file works).
If `python` is not recognised, substitute `py` in all three commands. If `pip
install yt-dlp` fails, Python is either missing or not on PATH — install it from
python.org with "Add Python to PATH" ticked, rather than debugging pip.

Publish the result with the `Artifact` tool if the user wants a link rather than
a local file.

### Will someone else running this get the same result?

Two different answers, and conflating them is the trap. Say both.

**The rules: yes, identically.** Filtering, the quality gate, tier/brand
classification and rendering are pure functions of the data file and
`config.json`. Same input, same verdict, on any machine, in any timezone, with
any console codepage. `python scripts/selftest.py` proves it on the spot: 17
checks run offline against fixed fixtures in `tests/fixture.json`, including
the four false positives that reached a live page (SpongeBob recaps, a cat-food
clip, a US news item, a Tokyo travel guide). If someone's copy drifted, this
fails and names the rule.

**The published top-10: no, and it cannot be.** Three reasons, all in the data
rather than the code:

| 원인 | 결과 |
|---|---|
| 조회수는 계속 오른다 | 07시 실행과 20시 실행의 순위가 다르다. 어제 올라온 영상은 아직 빠르게 조회수가 붙는 구간이다 |
| 엔진이 두 개다 | API 키가 있으면 Data API, 없으면 yt-dlp. 후보 풀 자체가 다르다 |
| 유튜브 검색이 개인화·지역화된다 | 키워드 검색 결과가 IP와 시점에 따라 달라진다 |

**실측.** 이 저장소를 새로 클론해서 제3자와 똑같은 조건(키 없음, yt-dlp)으로
2026-09-14를 수집하고, 같은 날 API로 발행된 리포트와 대조했다.

| | 클론 (키 없음) | 발행본 (API 키) |
|---|---|---|
| 수집 건수 | **4건** | **10건** |
| 겹치는 영상 | 2건 (20%) | 2건 (20%) |
| 겹친 영상의 조회수 차이 | +149 / +269 (하루 사이 증가분) | 기준 |
| 검증 게이트 판정 | 통과(경고 2) | 통과(경고 0) |

두 가지를 동시에 말해준다. 첫째, 겹친 2건은 **같은 규칙이 같은 영상을
골라냈다**는 뜻이고 조회수 차이는 순수하게 시점 차이다. 둘째 — 그리고 이쪽이
실무적으로 더 중요하다 — **키 없이 돌리면 결과가 눈에 띄게 빈약하다.** 원인은
yt-dlp가 쓸 수 있는 유튜브 검색 필터가 "이번 주"까지뿐이라 후보 112건 중 35건이
날짜 불일치로 탈락하는 반면, Data API는 서버에서 해당 날짜만 잘라 오기 때문이다.

그래서 남에게 권할 때의 정직한 순서는 이렇다: **키 없이 한 번 돌려 동작을
확인하고, 계속 쓸 거면 무료 API 키를 발급받아라**(5분, 무료 한도의 6% 사용).
키 없는 경로는 "체험용"이지 "매일 쓰는 용"이 아니다.

So the honest claim is: **the same rules, applied to a moving source.** Two
people on the same date get overlapping lists where the strongest items
recur, not byte-identical files. A report that claimed otherwise would be
lying about what it reads. What *is* auditable is that every published number
came from that video's own metadata (nothing estimated), and that every
published item passes the same gate — which is exactly what `selftest.py` and
`verify.py` let a third party check without trusting the operator.

### Tune `config.json` to the person asking, before running
The defaults target Korean franchise food. A generic keyword set is the single
biggest reason a report comes back full of unrelated content.

| 설정 | 뜻 | 기본값 |
|---|---|---|
| `keywords` | 유튜브에 검색할 말. 업종에 맞게 바꾸는 게 결과를 가장 크게 바꾼다 | 신메뉴·이색메뉴·신상 디저트 등 6개 |
| `viewThreshold` | 이 조회수 미만은 버린다 | 1000 |
| `topN` | 최종 게재 건수. 모자라면 빈자리를 채우지 않는다 | 10 |
| `perChannel` | 한 채널에서 최대 몇 건까지 실을지. 한 채널 독식을 막는다 | 2 |
| `perKeyword` / `maxCandidates` | 키워드당·전체 후보 상한. 늘리면 느려지고 결과가 늘 수 있다 | 30 / 120 |
| `includeWords` | 이 중 하나는 있어야 음식 콘텐츠로 본다 | 메뉴·디저트·편의점 등 |
| `excludeWords` | 하나라도 있으면 버린다. 오탐을 보고 늘려간다 | 여행·만화·반려동물 등 |
| `excludeChannels` | 채널명에 있으면 통째로 버린다 | 오탐을 낸 채널 |
| `coreWords` | 이 중 하나가 있으면 "신메뉴·신상"으로 분류, 없으면 "푸드 콘텐츠" | 신메뉴·출시·한정 등 |
| `brandTags` | 제목에 있으면 카드에 브랜드 칩을 단다 | 주요 프랜차이즈 12곳 |
| `requireHangul` | 한글이 없는 콘텐츠를 버린다(해외 기사 차단) | true |

### Read the published titles before calling it done
The filter passes things a person would reject on sight. Two SpongeBob episode
recaps once ranked 4th and 10th on a menu-trend report, because "집게리아
신메뉴" (the Krusty Krab's new menu) satisfies a food-word filter perfectly.
Fiction is the hard class: it uses the vocabulary correctly and only the subject
matter gives it away.

So scan the ten titles before handing the report over, and when something
obviously wrong is there, **add its channel to `excludeChannels`** rather than
guessing at words. A channel that recaps cartoons will do it again tomorrow
under a different title; blocking the channel ends it permanently, and the
freed slots refill with real items. Tell the user about this list too — they
will spot bad entries faster than any keyword rule will.

This is the path to use for almost every request, including a first-time user
who just wants to see what the thing produces. Reach past it only when the user
asks for something it cannot do:

| The user wants | Go to |
|---|---|
| A report, now | the three commands above |
| Instagram included | **Manual mode** (steps 0–7 below) — needs a human-driven browser |
| It to update itself every morning | **Daily deploy** (`references/autodeploy-setup.md`) |

### Expect fewer items without a key, and say so
Measured on the same day, same config: the no-key path published **4** items,
the API path **10**. The reason is the date filter. yt-dlp can only narrow
YouTube's search to "this week", so roughly six of every seven candidates are
thrown away by the exact-date check (32 date rejections in that run), while the
API filters by publish time server-side and almost nothing is wasted. Both
runs are honest — the gate simply has less to work with. If the user wants a
consistently full board, that is the reason to spend five minutes on a free
API key, and `build.py` will pick it up with no other change.

### Why the pipeline needs no key but the daily deploy does
The same yt-dlp code was run from a GitHub Actions runner and **every one of 40
per-video requests came back `Sign in to confirm you're not a bot`** — YouTube
blocks datacenter IPs, not the technique. Searching still worked; only the
per-video metadata calls were refused. So a scheduled cloud run needs the
official Data API (free key), while a person running it from their own machine
does not. `build.py` switches automatically: `YOUTUBE_API_KEY` set → official
API, unset → yt-dlp. Do not try to defeat the bot check.

## What the pipeline produces

- `docs/index.html` — bento-grid report for the target date
- `docs/archive/<date>.html` + `docs/archive/index.html` — one page per run, browsable by date
- `data/<date>.json` — the run's raw data, so history accumulates across runs
- `data/<date>.verify.json` — what the quality gate checked and found

The report carries its own audit trail: candidates considered, how many were
dropped and why, and a pass/warn badge from `verify.py`. That block is the
difference between a list of links and something someone can act on.

## The quality gate (`verify.py`) — do not bypass it

It encodes four review perspectives that were applied to this report by hand.
**Hard failures block publishing** so a bad run leaves the previous report up;
soft warnings publish but show on the page.

| Blocks publishing | Publishes with a warning |
|---|---|
| An item's upload date ≠ the target date | Fewer than 5 items |
| An item below the view threshold | Under 30% are actual product launches |
| Duplicate videos | No tracked brand mentioned |
| >20% of fetches unverifiable | |
| One channel over the per-channel cap | |
| Instagram item carrying a `views` field, or a fallback post with no real date | |

If a run fails the gate, report what it caught — do not loosen the thresholds
to force a result.

The rest of this file (Hard constraints, Workflow, steps 0–7) describes
**manual mode**: the browser-driven path that can also cover Instagram.

## Hard constraints — verified by testing, do not deviate

**YouTube gives exact view counts. Instagram does not — do not pretend otherwise.**

- YouTube's public watch page exposes an exact view count and exact upload
  date with no login. Confirmed working method (2026-09-10 test): open the
  watch page in the Browser pane and call `find` with query `"조회수"` — this
  reads the **accessibility tree**, not the rendered text. One of the matches
  is a clean string like `조회수 3,779회 • 2026. 9. 9. • #태그`. **Never use
  `get_page_text` for the view count** — YouTube renders it as an animated
  "odometer" of stacked digit spans, and plain text extraction returns a
  garbled digit soup (verified firsthand). `find`/`read_page` sidestep this
  because they read the accessibility label, not the visual layout.
- Instagram blocks anonymous hashtag/keyword search entirely (the explore/tags
  page redirects straight to a login wall — confirmed by direct test). There
  is no free, ToS-compliant way to get Instagram view counts without logging
  in, so Instagram's engagement number is always **like count** (좋아요),
  never 조회수 — say so explicitly in the report, don't fabricate a view
  number or blur the two metrics together.
- A **specific account's own profile page** (`instagram.com/<handle>/`) IS
  viewable without login (past a dismissable signup modal) and its 3–5 most
  recent posts are visible — but this is the *only* Instagram discovery path
  that works; there's no way to search Instagram broadly without login. See
  step 5 for the full method (brand watchlist, not open discovery) and the
  `<time datetime="...">` trick for getting an exact timestamp instead of
  relying on ambiguous relative/no-year display text.
- Google's index of very recent videos/reels lags by days, so `WebSearch`
  alone will under-find yesterday's content. Use it for keyword breadth, but
  treat YouTube's own live search/filter results as the authoritative source
  for recency.
- This manual mode reads public pages through browser automation rather than
  each platform's official API, and doesn't log in as any account. That's
  what keeps it free and key-free, but it means it's for internal/personal
  reference use, not for republishing at scale or as a commercial product —
  say so if the user asks about reselling or mass-automating this specific
  (browser-based) method. The auto-deploy mode sidesteps this for YouTube by
  using YouTube's own official Data API instead.

## Workflow

### 0. Confirm the tools exist
This mode requires the Browser pane tools (`mcp__Claude_Browser__navigate`,
`find`, `read_page`, `get_page_text`, `browser_batch`). If they're deferred,
load them with one `ToolSearch select:mcp__Claude_Browser__navigate,mcp__Claude_Browser__find,mcp__Claude_Browser__read_page,mcp__Claude_Browser__get_page_text,mcp__Claude_Browser__browser_batch,mcp__Claude_Browser__preview_start`
call. If no Browser pane is available in this environment at all, stop and
tell the user this mode can't run here — don't fall back to `WebFetch` (it
returns YouTube's un-rendered shell, not the search results — verified: it
returns only the page footer) or to guessing.

### 1. Resolve the target date
Default target = "yesterday" in KST (Asia/Seoul), computed from today's date.
If the user names a different date, use that instead. Keep a display form
(e.g. "9월 9일") for the report, plus the KST calendar date as the actual
comparison value — YouTube's match string looks like "2026. 9. 9." (step 4);
Instagram is matched via the ISO `datetime` attribute (step 5), so convert
that to its KST calendar date before comparing rather than string-matching it.

### 2. Build a keyword set
Use exactly 6 Korean food-trend search terms so the search budget stays
predictable — going wider makes step 4 (which opens each candidate one by
one) slow without much upside. Default set: `신메뉴`, `이색메뉴`, `신상 디저트`,
`편의점 신상`, `핫플 디저트`, `인생맛집`. If the user names their own business
or category, swap 2–3 of these for keywords/brand names specific to it (and
their direct competitors) — a generic keyword set is the main reason a report
ends up full of unrelated convenience-store content instead of the user's
actual category.

### 3. Discover YouTube candidates
Two discovery paths, both feeding the same verification step (4). Cap the
total candidate pool at roughly 25 videos (across all keywords, after
dedup) — enough headroom to reliably fill 10 slots without step 4 ballooning:
- **Live YouTube search (primary, for recency)**: with the Browser pane, open
  `https://www.youtube.com/results?search_query=<urlencoded keyword>&sp=EgIIAw%253D%253D`
  (this exact double-encoded `sp` value is what was verified working — it's
  the upload filter "이번 주/this week", broad enough to contain yesterday,
  but there is no official "yesterday-only" filter, hence step 4's exact-date
  check is mandatory regardless). Read results with `find`/`read_page`, not
  `get_page_text`, and collect candidate `watch?v=` / `/shorts/` links. Use
  the visible-but-unverified view count only to triage which candidates are
  worth opening (skip anything obviously under threshold), never as the
  number you report.
- **WebSearch (secondary, for breadth)**: `site:youtube.com/shorts <keyword>`
  or `site:youtube.com/watch <keyword>` to surface more candidates the live
  search page didn't show on the first screen.

### 4. Verify each YouTube candidate (mandatory — do not skip)
For every candidate URL (batch navigate+find pairs with `browser_batch` where
possible to cut round trips):
1. Navigate to it in the Browser pane.
2. Call `find` with query `"조회수"`. If that returns nothing (e.g. an
   English-locale session renders "views" instead), retry with `find("views")`,
   then `read_page(filter:"all")` as a last resort. If all three fail, drop
   the candidate and note it as "확인 불가" — never substitute the search
   page's unverified number.
3. Read the match shaped like `조회수 N,NNN회 • YYYY. M. D. • #tags` (or
   similar — the exact-date field is what matters, not the surrounding text).
4. Keep it only if the date matches the target date exactly AND the view
   count ≥ the threshold (default 1,000). Discard everything else — a video
   that merely says "새 동영상" or a relative time on the search results page
   is not verified until you've read its exact date this way. **Track why
   each discarded candidate was dropped** (date mismatch vs. below threshold
   vs. unverifiable) — step 7's footer reports these counts, and that count
   is what makes the report auditable instead of a black box.

### 5. Discover + verify Instagram candidates (brand watchlist — not open discovery)
Hashtag/keyword search is a hard login wall (step-0-level constraint, not
worth retrying). The only viable path found by testing (2026-09-10) is
checking specific known accounts directly, which is a fundamentally narrower
capability than YouTube's open discovery: it can only tell you whether
**named brands/competitors** posted something yesterday, not surface
trending content from an arbitrary account. Set that expectation with the
user up front if they ask for open-ended Instagram trend discovery.

1. Build a short brand/competitor list (5–10) — from the user's business if
   they named one, otherwise major Korean QSR/카페 chains. For each brand you
   don't already have a handle for, `WebSearch: "<브랜드명> 공식 인스타그램
   계정"` and sanity-check the follower count looks right (an inactive
   lookalike account with a few hundred followers is not the real one — this
   happened in testing with a wrong `composecoffee` vs. the real
   `compose_coffee`).
2. Navigate to `instagram.com/<handle>/`. A signup modal almost always covers
   the page — screenshot, click its ✕ close button (top-right of the modal),
   then `find` for `/<handle>/p/` to get the 3–5 most recent post URLs. This
   works without login; `explore/tags/...` does not (step 0's constraint).
3. For each post URL, navigate to it and read it with one `javascript_tool` call:
   ```js
   const time = document.querySelector('time');
   const meta = document.querySelector('meta[property="og:description"]');
   ({datetime: time?.getAttribute('datetime'), desc: meta?.getAttribute('content')})
   ```
   `datetime` is the exact upload instant in ISO 8601 UTC — convert it to KST
   yourself and compare calendar dates. **Do not date-match on anything
   else**: the visible text is relative ("3시간 전") or a no-year date
   ("8월 14일"), and `og:description`'s own human-readable date (e.g.
   "September 8, 2026") runs on a different, unverified timezone — it was
   observed off by a full day from the `datetime` attribute's true KST date
   in testing. Only `datetime` is authoritative. `desc` gives the full
   caption and an exact-as-shown like/comment count in one string
   (`"N likes, M comments - handle - <date>: "<full caption>"`) — use it for
   the caption text and the like count, never for the date.
4. Keep it (as an exact-date match) only if the KST date from `datetime`
   equals the target date. **Expect zero exact matches on most days for most
   brands** — accounts don't post daily (verified in testing: 2 of 5 brands
   checked had zero posts on the target date; the other 3 matched exactly).
   That's a correct result, not a broken check.
5. **Fallback, per brand with zero exact matches**: include that brand's
   single most-recent visible post anyway (pick by like count if more than
   one is visible), clearly labeled with its real date — never implied to be
   from the target date. This keeps the Instagram section from going empty
   on ordinary days while staying honest: step 7 renders these in a visually
   separate "최근 인기 게시물" group from the exact-date matches, each card
   showing its own real date instead of the target date.
6. Large/verified accounts often show a rounded like count ("1만개" / "10K"
   instead of an exact number) — report it exactly as shown, don't convert
   it to a fake-precise number.
7. Report the brand check itself regardless of outcome: "확인한 N개 브랜드
   중 어제 정확히 게시한 곳 M곳(나머지는 최근 게시물로 대체)".

### 6. Rank and select — per platform, never merged into one sort
Rank YouTube items by view count and Instagram items by like count as **two
separate rankings**, each capped at the top N (default 10). Do not merge them
into a single sorted list — view count and like count are different scales
(a 2,000-view YouTube video and a 2,000-like Instagram post are not
equivalent popularity), and sorting them together produces a ranking that
looks authoritative but isn't measuring one thing. If the user wants a single
combined "top N regardless of platform," say so explicitly in the report
instead of silently blending the metrics. If fewer than N survive the filters
on either platform, show fewer — never pad with items that failed the date or
threshold check.

### 7. Render the HTML bento grid report
Load the `artifact-design` skill before writing the page for layout/typography
guidance. Single self-contained HTML file, one card per item:
- Grid: `display:grid; grid-template-columns:repeat(4, 1fr); grid-auto-rows:180px;`
  (adjust column count to viewport). Rank #1 spans `grid-column:span 2;
  grid-row:span 2;`, ranks #2–#3 span 2×1, the rest are 1×1 — biggest cell to
  the highest engagement, matching a bento layout.
- Each card: thumbnail/cover image, a platform badge (▶ YouTube / 📷
  Instagram), title, channel/account name, the engagement number formatted
  with commas and correctly labeled (조회수 vs 좋아요, never merged), and the
  original link. **Thumbnails**: the Artifact tool's CSP blocks hotlinked
  images from `i.ytimg.com`, so download each thumbnail
  (`https://i.ytimg.com/vi/<id>/hqdefault.jpg`) with `Bash`/`curl` to the
  scratchpad, base64-encode it, and inline it as a `data:image/jpeg;base64,...`
  background — a bare `<img src="https://i.ytimg.com/...">` will silently fail
  to render. Instagram has no equivalent public image URL without login, so
  use a platform-colored placeholder for Instagram cards instead.
- Header shows the exact target date and the filter values used (view/like
  threshold, top N).
- If step 5 produced fallback Instagram cards, render them as a visibly
  separate group (e.g. a second sub-header "최근 인기 게시물 (날짜 다름)")
  below the exact-date matches, each card showing its own real date — never
  let a fallback card look like it's from the target date.
- **Footer must include a methodology block** (this is what makes the report
  auditable rather than a bare list): the verification method used (exact
  view/date read from each item's own page, not from search-result estimates),
  the full keyword list searched, candidate count considered, and a breakdown
  of why candidates were dropped (date mismatch / below threshold /
  unverifiable) from step 4. For Instagram, list the brands checked and say
  how many matched the exact date vs. fell back — "확인한 8개 브랜드 중
  3곳 어제 게시, 2곳 최근 게시물로 대체" is a complete, honest result.

### 7b. Make it browsable by date (persistent history)
A single run only has one day's data, but the report should accumulate into
something browsable over multiple runs. Load the `artifact-capabilities`
skill, then:
1. Declare `capabilities: {db: {}}` when publishing.
2. Build the page to render from a `report` JS object embedded inline (today's
   real data — this is the first-paint state, not placeholder content) via a
   render function, so it looks correct even before any async call resolves.
3. In the page's own script, try `const db = await claude.use("db")`. If it
   resolves (non-null), query `db.collection("reports").orderBy("date","desc").limit(60).get()`
   and render a small date-chip row from the results; clicking a chip
   re-renders the same layout from that document's data. If `db` resolves
   `null`, just leave the single-date view — that's a correct degraded state,
   not an error.
4. After publishing, write this run's data into the store yourself via the
   `Artifact` tool's `action: "write_db"` (`db_op: "set"`, `collection:
   "reports"`, `doc_id: "<target date>"`, `data: <the same report object>`)
   — don't hardcode this or any other day's data into the page's own script;
   the page only ever reads from `db`, never ships seed rows.
5. Every future run of this skill against the same published artifact (pass
   its `url`) adds one more document — the date picker grows on its own,
   with no schema change needed.
- Publish with the `Artifact` tool (title reflects the date, e.g. "9월 9일
  트렌드 메뉴 Top 10", favicon 🍽️) so it's a shareable link, unless the user
  asked for a local file instead.

## Quick reference

| Platform | Discovery | Verify | Exact metric available | Field to trust |
|---|---|---|---|---|
| YouTube | live search page + WebSearch | `find("조회수")` on watch page | view count + upload date | `find`/`read_page`, never `get_page_text` |
| Instagram | brand handle's own profile page (WebSearch to find the handle if unknown) | `javascript_tool`: `document.querySelector('time').getAttribute('datetime')` on each post page | like count + upload date (no views) | the `<time datetime>` attribute, never the displayed relative/no-year text |

## Common mistakes
- Reading YouTube's view count with `get_page_text` → garbled digits, wrong
  numbers. Always use `find`/`read_page`.
- Treating YouTube's "새 동영상" / "N시간 전" labels on the search results
  list as date-verified. Those are approximate; only the watch page's exact
  date line is authoritative.
- Reporting an Instagram like count as "조회수". Label it "좋아요" — it is a
  different, smaller metric and conflating them misleads whoever reads the
  report.
- Sorting YouTube (views) and Instagram (likes) items into one merged ranking.
  Rank each platform separately (step 6).
- Trying to browse `instagram.com/explore/tags/...` — it redirects to a login
  wall with no exception. Only a specific account's own profile page works.
- Reading an Instagram post's displayed date/time text instead of its
  `<time datetime="...">` attribute — the displayed text is relative ("3시간
  전") for recent posts and a no-year absolute date for older ones, both
  ambiguous. Read the attribute via `javascript_tool`.
- Treating a day with zero qualifying Instagram brand posts as a bug and
  either skipping the platform silently or lowering the bar to force a
  result. Most brands don't post daily — report the count checked and the
  count qualifying, honestly, even when that's 0.
- Padding the top-10 list with items that don't match the exact date just to
  reach N. Show fewer items instead.
- Hotlinking `i.ytimg.com` thumbnails directly in the Artifact HTML — its CSP
  blocks that host, so the image silently never loads. Download + base64
  the thumbnail instead (step 7).
- Skipping the footer methodology block. Without candidate/rejection counts,
  the report reads as authoritative but can't actually be audited.

## Changing the defaults
Threshold (1,000), count (10), and the keyword set (6 terms) are just the
values used the first time this skill was set up — if the user asks for
different numbers, or names their own business/category/competitors, change
those in steps 2–6; nothing else in the workflow changes.

## Need unattended daily updates instead?
Don't try to schedule manual mode — a cloud run reaches neither this session's
browser nor local `.claude/skills/` files. Copy `assets/pipeline/` into the
user's own repo and follow `references/autodeploy-setup.md`: it needs a free
YouTube Data API key (because of the datacenter-IP block described at the top),
a repo secret, and GitHub Pages.

Two things that cost real time if missed:
- **GitHub's scheduler runs late.** Measured on a live repo: a `06:30 KST` cron
  actually fired at 08:29 / 08:10 / 08:21. Set the cron ~2h earlier than the
  time the user asked for. Running early is safe — the target date is computed
  from the KST clock at run time either way.


## A third option, if the Hound plugin is installed
If the `hound` plugin's `scripts/yt_collect.py` is available, it's often
better than this file's own manual browser method for the YouTube half:
it uses `yt-dlp` (no API key, no Browser pane), filters by upload period at
the search level, re-checks each candidate's exact timestamp itself, and can
cap results per channel (`--per-channel`) — which directly avoids the
"top 10 is 5 convenience-store channels" problem this skill has hit before.
Point it at a topic pack built from this skill's `assets/pipeline/config.json`
keywords, run with a ~2-day window, then post-filter the output's exact
`timestamp` field to the target KST date yourself (the tool's window is
rolling, not calendar-exact). Still render with this skill's bento-grid
design (steps 6–7) for consistency. Instagram is still out of scope either way.
