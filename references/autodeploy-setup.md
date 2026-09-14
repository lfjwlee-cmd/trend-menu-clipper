# 매일 자동 갱신 배포 (GitHub Actions + Pages)

`assets/pipeline/`을 사용자 저장소에 올려 매일 자동으로 도는 사이트로 만드는 절차다.
전부 무료이고, 유튜브 Data API 키 하나만 발급받으면 된다(신용카드 불필요).

**먼저 확인할 것:** 사용자가 정말 "매일 자동"을 원하는가? 그냥 리포트를 한 번 보고 싶은
거라면 SKILL.md 맨 위의 3줄 명령으로 끝난다. 키도, 저장소도, 이 문서도 필요 없다.

## 왜 여기서는 API 키가 필요한가

같은 `build.py`를 GitHub Actions에서 돌려 실측한 결과다.

- 검색(flat)은 **정상 동작**했다. 키워드 6개 전부 결과를 반환했다.
- 그런데 개별 영상 메타 조회는 **40건 중 40건이 차단**됐다:
  `Sign in to confirm you're not a bot`

유튜브가 데이터센터 IP를 막는 것이지 기법의 문제가 아니다. 그래서 **집·사무실에서 사람이
돌릴 때는 키가 필요 없고, 무인 클라우드 실행에는 공식 API 키가 필요하다.**
`build.py`가 알아서 분기한다 — `YOUTUBE_API_KEY`가 있으면 공식 API, 없으면 yt-dlp.

봇 차단을 쿠키·프록시로 우회하지 않는다.

## 1. 유튜브 API 키 발급 (무료, 5분)

1. https://console.cloud.google.com 접속, 구글 계정으로 로그인
2. 새 프로젝트 생성
3. "API 및 서비스" → "라이브러리" → **YouTube Data API v3** → **사용 설정**
4. "사용자 인증정보" → **+사용자 인증정보 만들기** → **API 키**
5. (권장) 만든 키를 클릭 → "API 제한사항" → **YouTube Data API v3만** 허용

하루 무료 할당량 10,000 유닛 중 약 610 유닛만 쓴다(키워드 6개 기준).

> **키는 사용자가 직접 다뤄야 한다.** 대화창에 붙여넣게 하지 말고, 발급 화면에서 바로
> GitHub Secret 입력란으로 복사하게 안내한다. 대화 기록에 남은 키는 유출된 키다.

## 2. 저장소 만들고 번들 올리기

1. 새 저장소 생성 (Public이면 Pages가 무료)
2. `assets/pipeline/` 안의 파일 전체를 저장소 루트에 복사해 커밋 & 푸시
   - `config.json`, `scripts/`(build·verify·render), `.github/workflows/daily.yml`,
     빈 `docs/`, `data/`
3. `config.json`을 사용자 업종에 맞게 수정 — 특히 `keywords`와 `brandTags`.
   기본값은 한국 프랜차이즈 외식이다.

## 3. 시크릿 등록

저장소 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| 이름 | 용도 |
|---|---|
| `YOUTUBE_API_KEY` | 유튜브 수집 (필수) |

**등록 후 반드시 확인한다.** "저장했다"는 말만 믿지 말 것 — 실제로 Add secret 버튼이
안 눌린 경우가 있었다. API로 이름만 조회하면 값 노출 없이 확인된다:

```bash
curl -s -H "Authorization: token $TOKEN" \
  https://api.github.com/repos/<owner>/<repo>/actions/secrets | grep '"name"'
```

## 4. GitHub Pages 켜기

저장소 → **Settings** → **Pages** → Source: **Deploy from a branch**,
Branch `main`, 폴더 **/docs** → 저장.

첫 실행 전에는 `docs/index.html`이 없으니, 안내 페이지를 하나 넣어두면 사용자가
빈 화면을 보지 않는다.

## 5. 첫 실행

Actions 탭 → "Daily Trend Menu Report" → **Run workflow**.

로그에서 확인할 것:
- `qualified N -> published M` — 실제로 몇 건이 실렸는지
- `rejected={...}` — `unverifiable`이 크면 차단당하는 중이다
- Verify 단계가 **통과**했는지. 실패하면 발행되지 않고 이전 리포트가 유지된다(의도된 동작)

## 스케줄 시각: 요청받은 시각보다 2시간 일찍 걸어라

GitHub 스케줄러는 정시에 돌지 않는다. 실측값이다.

| 설정 | 실제 실행(KST) |
|---|---|
| `30 21 * * *` (06:30 KST 의도) | 08:29 / 08:10 / 08:21 |

1.5~2시간씩 밀렸다. 그래서 기본 워크플로는 `20 19 * * *`(04:20 KST)로 걸어 06:30
전에 올라오도록 여유를 뒀다. 일찍 도는 건 무해하다 — 수집 대상일은 실행 시점의 KST
시계로 계산하므로, 04:20에 돌든 07:00으로 밀리든 똑같이 "어제"가 된다.
`:00`이나 `:30`보다 어중간한 분이 덜 붐빈다.

## 다른 사람이 그대로 쓰는 경우

이 번들 하나가 통째로 이식 단위다. 바꿀 것은 `config.json`뿐이고, 코드는 그대로 쓴다.
자기 GitHub 계정 + 자기 API 키로 1~5단계를 따라 하면 동일하게 동작한다.

## 나중에 확장한다면

- **주간 추이**: `data/*.json`이 매일 쌓인다. 이 파일들을 읽어 "이번 주 반복 등장 키워드"
  집계 페이지를 붙일 수 있다. 지금은 하루치만 렌더링한다.
- **채널 규모 대비 성과**: 지금은 조회수 절대값 정렬이라 대형 채널이 유리하다.
  `channels.list`로 구독자 수를 가져와 "구독자 대비 배수"를 쓰면 급등을 더 잘 잡는다.
- **인스타그램**: 자동화 경로가 없다. 사람이 실행하는 수동 모드에서만 수집되며,
  수집한 결과는 `data/<날짜>.json`의 `instagram` 블록에 넣으면 같은 리포트에 합류한다.
