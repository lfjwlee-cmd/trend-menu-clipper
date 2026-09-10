# Auto-deploy setup (매일 06:00 KST 자동 갱신)

이 문서는 `assets/autodeploy/` 번들을 실제로 돌아가는 사이트로 배포하는 절차다. 사용자에게 그대로
안내하면 된다 — 전부 무료이고, 유튜브 Data API 키 하나만 발급받으면 된다(신용카드 불필요).

## 왜 브라우저 방식이 아니라 API 방식인가

이 스킬의 기본(수동) 워크플로우는 브라우저를 직접 열어 화면의 조회수를 읽는 방식이라, 사람이 대화
세션에서 실행할 때만 동작한다. GitHub Actions 같은 무인 스케줄러는 로컬 브라우저 창도, 로컬
`.claude/skills/` 파일도 접근할 수 없으므로 그 방식이 그대로는 돌아가지 않는다. `autodeploy/`는
같은 목적을 **공식 YouTube Data API**로 재구현한 것이다 — 결과가 코드로 고정되어 있어 실행할 때마다
똑같은 기준으로 동작하고(재현성), 매일 자동으로 돌 수 있다. 대신 이 경로는 인스타그램을 다루지
않는다(공식 API로 해시태그 전역 검색이 불가능하기 때문 — 이유는 SKILL.md 본문 참고).

## 1. 유튜브 API 키 발급 (무료, 5분)

1. https://console.cloud.google.com 접속, 구글 계정으로 로그인
2. 새 프로젝트 생성 (아무 이름이나, 예: `trend-menu-clipper`)
3. 좌측 메뉴 → "API 및 서비스" → "라이브러리" → "YouTube Data API v3" 검색 → **사용 설정**
4. "API 및 서비스" → "사용자 인증정보" → **+사용자 인증정보 만들기** → **API 키**
5. 생성된 키를 복사해둔다 (나중에 GitHub Secret으로 등록)
6. (권장) 방금 만든 키를 클릭 → "API 제한사항"에서 "YouTube Data API v3"만 허용하도록 제한

무료 할당량은 하루 10,000 유닛이고, 이 스크립트는 하루 한 번 실행에 키워드당 100유닛 정도만 쓴다
(기본 키워드 6개 = 약 600유닛/일) — 무료 한도에 여유가 크다.

## 2. GitHub 저장소 만들기

1. github.com에서 새 저장소 생성 (예: `trend-menu-clipper`), Public으로
2. `assets/autodeploy/` 안의 파일 전체를 그 저장소 루트에 복사해 커밋 & 푸시한다
   (`config.json`, `package.json`, `scripts/`, `.github/workflows/`, 빈 `docs/`, `data/` 포함)
3. 회사/브랜드에 맞게 `config.json`을 수정한다 (키워드, 임계값, 브랜드 태그 — 자세한 필드 설명은
   `config.json`의 각 키 참고, JSON 문법만 지키면 됨)

## 3. API 키를 GitHub Secret으로 등록

1. 저장소 → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** → Name: `YOUTUBE_API_KEY`, Value: 1단계에서 복사한 키 → 저장

## 4. GitHub Pages 활성화

1. 저장소 → **Settings** → **Pages**
2. Source: **Deploy from a branch**, Branch: `main` (또는 기본 브랜치), 폴더: **/docs**
3. 저장 후 몇 분 뒤 `https://<사용자명>.github.io/<저장소명>/` 에서 접속 가능해진다
   (처음엔 `docs/index.html`이 아직 없으므로 5단계를 먼저 한 번 실행해야 페이지가 뜬다)

## 5. 첫 실행 (수동으로 1회 확인)

1. 저장소 → **Actions** 탭 → 좌측 "Daily Trend Menu Report" 워크플로우 선택
2. **Run workflow** 버튼으로 수동 1회 실행
3. 실행 로그에서 `Candidates found`, `Qualified` 숫자와 에러 여부 확인
4. 성공하면 `docs/index.html`과 `data/<날짜>.json`이 자동 커밋된다 → Pages 링크에서 확인

이후로는 매일 06:00 KST(21:00 UTC)에 자동으로 실행된다. 실행 여부/실패는 Actions 탭에서 항상
확인할 수 있다.

## 다른 사람이 이 스킬을 그대로 적용하는 경우

이 저장소 하나가 통째로 이식 가능한 단위다. 다른 회사/개인이 써도 되는 부분:
- 1~5단계를 그대로 따라 자기 GitHub 계정에 자기 API 키로 만들면 동일하게 동작한다
- 바꿔야 하는 건 `config.json` 하나뿐 (키워드·임계값·브랜드 태그를 자기 업종에 맞게)
- 코드(`scripts/build-report.mjs`, workflow, HTML/CSS)는 그대로 재사용 가능

## 나중에 확장하고 싶을 때

- **주간 트렌드 추이**: `data/*.json`이 매일 쌓이므로, 이 파일들을 읽어 "이번 주 반복 등장 키워드"
  같은 집계 페이지를 추가로 만들 수 있다. 지금은 하루치 랭킹만 렌더링한다.
- **채널 규모 대비 성과**: 지금은 조회수 절대값으로만 정렬한다. `videos.list`에 `channelId`를 함께
  가져와 `channels.list`로 구독자 수를 추가하면 "구독자 대비 이상 급등" 같은 지표를 만들 수 있다.
- **카테고리 필터**: `config.json`의 `keywords`를 업종에 맞게 좁히면 자연스럽게 관련성이 올라간다.
