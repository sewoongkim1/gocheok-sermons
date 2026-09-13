# 설교 URL 하나를 받았을 때 — 반영 절차

카톡으로 "이 설교 반영해줘" 하고 유튜브 링크 하나가 오면, 이 문서 순서대로 한다.
**두 저장소**(`gocheok-sermons`·`bible-memorize-church-app-v2`)에 걸쳐 있으니
어느 컴퓨터에서 하든 이 파일 하나만 있으면 이어 할 수 있다.

> 이 문서는 **「어떻게 반영하는가」**만 담았다. 말씀 연상 그림을 함께 만드는 법은
> `bible-memorize-church-app-v2/img/verse/암송말씀_그림_만들기.md`.

---

## 0. 사전 확인 (실행 전에 꼭)

1. **이 링크가 이번 주 암송구절 것이 맞는지** 확인한다 — 성경암송 앱의 `getVerses`로
   최신 주(`no` 최댓값)의 `url`이 이 링크와 같은지 본다.
   ```
   POST {SUPABASE_URL}/functions/v1/api   body: {"action":"getVerses"}
   ```
   ⚠️ **`verses.sermon_url`이 먼저 채워져 있어야** 사역 파이프라인의 ④ 단계가
   이 구절로 자동 연결한다(암송구절 매칭은 "그 URL을 가진 구절을 찾는" 방식이라
   반대로는 안 된다). 아직 안 채워져 있으면 어드민에서 `saveVerse`로 먼저
   채운 다음 여기로 온다.
2. **이미 반영돼 있는지** 먼저 확인한다 — 설교 아카이브 `getSermons`에서 영상 ID로
   찾아본다(중복 실행은 크레딧·시간 낭비다).
   ```
   POST https://xnomlgydifiqiybervtf.supabase.co/functions/v1/sermon
   body: {"action":"getSermons"}
   ```
   결과의 `sermons[].id`가 유튜브 영상 ID(URL의 `v=` 뒤 11자)와 같은 게 있으면 끝난 것.

## 1. 로컬 환경 준비 (컴퓨터마다 최초 1회만)

이 컴퓨터에 `gocheok-sermons` 저장소가 없으면:
```
gh repo clone sewoongkim1/gocheok-sermons
cd gocheok-sermons
npm install
```

저장소 루트에 `.env` 파일이 없으면 만든다(`bible-memorize-church-app-v2/.env`에
있는 값과 **동일**하다 — 세 앱이 관리자 비번·AI 키를 공유한다):
```
ANTHROPIC_API_KEY=...
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=koreacentral
SERMON_ADMIN=...
```
⚠️ 시크릿을 새 파일에 쓰는 동작이라 자동 승인 필터가 막을 수 있다 — 막히면
사용자에게 직접 만들어 달라고 하거나, 승인을 받고 다시 시도한다.

**`yt-dlp`가 설치돼 있는지 확인한다.** 이게 없으면 무슨 일이 벌어지는지가
이 문서에서 가장 중요한 함정이다(2번 참고):
```
python -m pip show yt-dlp
```
없으면 설치한다:
```
python -m pip install --user yt-dlp
```
⚠️ **pip로 깔면 PATH에 안 잡히는 경우가 있다.** 설치 로그에 나오는 경로
(`...\Python\Python3xx\Scripts`)를 매번 세션 PATH 앞에 붙여서 실행한다:
```
export PATH="/c/Users/<user>/AppData/Roaming/Python/Python313/Scripts:$PATH"
```

## 2. 파이프라인 실행

```
cd gocheok-sermons
node scripts/add-local.mjs <유튜브 링크 또는 영상 ID>
```

내부적으로 자막수집 → AI노트 → 3분요약음성 → 암송구절매칭 → DB적재 →
**git 커밋·푸시까지** 자동으로 한다(사람이 더 할 것 없음, 시간이 좀 걸린다 —
백그라운드로 돌리고 기다린다).

### ⚠️⚠️ 가장 중요한 함정 — "완료"가 떴다고 진짜 된 게 아니다

`yt-dlp`가 없거나 실패하면 스크립트는 **exit code 0으로 "✅ 완료!"를 그대로 찍는다.**
로그를 자세히 안 보면 성공한 줄 안다. 실제로는:
- ① 단계에 `메타 실패: <id> — spawnSync yt-dlp ENOENT` / `✗ 자막 실패`가 찍히고
- ② 단계는 이 영상을 `건너뜀(자막 없음)`으로 넘기고
- ⑤ DB 적재 편수가 **이전과 똑같다**(새 항목이 안 들어간 것)

**로그에서 반드시 이 세 줄을 방금 넣은 영상 ID로 확인한다:**
```
✓ 자막 <id> (n자)              ← ① 자막 수집 성공
✓ <id> (1/1) <제목>            ← ② AI 노트 생성 성공 (건너뜀이면 실패)
✅ 테이블 적재 완료: N편         ← ⑤ N이 실행 전보다 1 늘었는지 확인
```
하나라도 안 맞으면 **1번의 yt-dlp/PATH부터 다시 본다.**

## 3. 결과 검증 (로그 말고 실제 값으로)

```
POST https://xnomlgydifiqiybervtf.supabase.co/functions/v1/sermon
body: {"action":"getSermons"}
```
방금 넣은 영상 ID를 찾아 이 필드들이 채워졌는지 확인한다:

| 필드 | 확인할 것 |
|---|---|
| `title` | 영상 ID가 아니라 실제 설교 제목인지 |
| `preacher` / `scripture` | 채워졌는지 |
| `keyVerse` | 본문 구절이 들어갔는지 |
| `memVerseNo` / `memRef` | **성경암송 앱의 몇 번 구절에 연결됐는지** — 0단계에서 확인한 그 번호와 같아야 한다. `null`이면 0단계의 url이 안 맞았거나 순서가 바뀐 것 |
| `audio` | `audio/<id>.mp3` 경로가 있는지(3분 요약 음성) |
| `summary`/`points`/`conclusion` | 비어있지 않은지 |

### ⚠️ 새 컴퓨터라면: Higgsfield MCP도 이 컴퓨터에만 있다

이미지 생성(4번)에 쓰는 Higgsfield MCP 서버는 `claude mcp add --scope user`로
**이 컴퓨터의 `~/.claude.json`에만** 등록된다 — git으로 옮겨가지 않는다.
새 컴퓨터에서 그림까지 만들려면 먼저:
```
npm install -g @anthropic-ai/claude-code   (claude CLI가 없으면)
claude mcp add --transport http higgsfield https://mcp.higgsfield.ai/mcp --scope user
```
등록한 뒤 **대화형 세션에서 `/mcp`로 로그인(OAuth)**까지 해야 도구가 실제로 잡힌다.
(설교 아카이브 반영 자체(1~3번)에는 필요 없다 — 그림까지 만들 때만 해당.)

## 4. (이번 주 구절이면) 말씀 연상 그림도 함께

3번까지 끝나면, 그 구절에 아직 그림이 없다면 이어서 만든다 — 별도 문서:
`bible-memorize-church-app-v2/img/verse/암송말씀_그림_만들기.md`.
요약하면: 심상 한 문장 짓기 → Higgsfield로 대표 1장 + 짝 2장 생성 →
**사람 눈으로 검수**(글자·사람·액자화·그림도구 흔적) → `tools/verse-img.py`로
변환 → `app.js`의 `VERSE_IMG`/`VERSE_IMG_MORE`에 등록 → `prompts.md`에 기록 →
`tools/bump.py` → 커밋·푸시.

## 5. 배포 확인

- `gocheok-sermons`는 파이프라인이 이미 push까지 했으므로 GitHub Actions가
  자동으로 sermon.onlybible.kr에 배포한다(Pages 배포 몇 분 대기).
- `bible-memorize-church-app-v2` 쪽(그림 추가 등)을 건드렸으면 CLAUDE.md
  「배포 확인」 방식대로 `APP_BUILD`와 `?v=`가 같은지 본다.

---

## 겪은 것 (2026-09-06)

- **yt-dlp가 없어도 조용히 성공한 것처럼 끝난다.** 이 문서 2번의 3줄 체크가
  이래서 생겼다 — 로그를 끝까지 안 읽으면 "완료"만 보고 다음 일로 넘어가게 된다.
- **`.env` 쓰기가 자동 승인 필터에 막힐 수 있다.** 시크릿을 새 파일에 담는
  동작이라 그런 듯 — 막히면 사용자에게 직접 만들어 달라고 요청한다.
- **암송구절 매칭은 순서가 있다.** `verses.sermon_url`을 먼저 채워야
  `4-link.mjs`가 그 구절 번호로 연결한다. 설교부터 넣고 나중에 구절 URL을
  채우면 매칭이 안 된 채로 남는다 — 그럴 땐 `node scripts/4-link.mjs`만
  다시 실행하면 된다(전체 파이프라인을 다시 돌릴 필요 없음).
