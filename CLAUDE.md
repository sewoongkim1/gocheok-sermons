# 고척교회 말씀 아카이브 (sermon.onlybible.kr)

고척교회 **설교**를 AI가 정리한 아카이브 웹앱. 설교 영상마다 **핵심 3점·본문·적용 질문·주제 태그 + 3분 요약 음성 + 성경암송 앱 딥링크**를 제공. (찬양 아카이브 worship / 성경암송 gocheok 과 형제 앱)

## 스택 · 도메인
- **Vite + Svelte 5 + TypeScript + Tailwind v4** (첫 모던 스택 앱)
- **GitHub Pages** 배포: repo `sewoongkim1/gocheok-sermons`, 커스텀 도메인 **sermon.onlybible.kr** (public/CNAME, base='/')
- 푸시 → GitHub Actions(`.github/workflows/deploy.yml`)가 `vite build` → Pages 배포
- **백엔드: Supabase 통합 프로젝트 `xnomlgydifiqiybervtf`** (성경암송·찬양과 공유)
  - Edge Function **`sermon`**: getSermons(공개) / adminList·saveSermon·deleteSermon·importSermons(관리자, secret=ADMIN_SECRET) / authCheck
  - 테이블 **`sermons`** (schema.sql): id·title·svc_date·category·preacher·scripture·summary·points·key_verse·questions·tags·audio_script·audio·mem_verse_no·mem_ref·mem_text·hidden
  - 앱은 **getSermons로 fetch**(localStorage 캐시→즉시표시, 백그라운드 갱신), 실패 시 `src/data/sermons.json` 번들 폴백

## 데이터 파이프라인 (scripts/)
설교 영상 → 자막 → AI노트 → 음성 → 암송매칭 → 테이블. 키 3개 필요: `ANTHROPIC_API_KEY`, `AZURE_SPEECH_KEY`(+`AZURE_SPEECH_REGION=koreacentral`), `SERMON_ADMIN`(관리자 비번).
- `1-fetch.mjs [n]` — 주일설교 재생목록에서 자막 수집(`SERMON_YEAR=2026`로 연도 필터). 영어판 제외
- `add-video.mjs <id...>` — 재생목록에 없는 개별 영상 추가(신년예배 등)
- `2-notes.mjs` — 자막 → Claude(`claude-opus-4-8`, structured outputs)로 노트 JSON
- `3-tts.mjs` — audioScript → Azure 뉴럴 음성(ko-KR-SunHiNeural) MP3 → public/audio/
- `4-link.mjs` — 성경암송 `verses` 테이블 url의 영상ID로 매칭 → memVerseNo·memRef·memText
- `5-migrate.mjs` — 제목에서 날짜·구분(category) 분리 후 `importSermons`로 테이블 적재
- **`add-sermon.mjs <url>`** — 위 전체를 한 방에(새 설교 1편 추가용)
- `og-gen.mjs` / `icon-gen.mjs` — OG 썸네일·PWA 아이콘 생성(연한 파랑 배경, sharp)

## 새 설교 추가 방법
1. **가장 쉬움**: 유튜브 링크를 Claude에게 주면 전체 처리(자막→노트→음성→매칭→테이블→오디오 커밋·배포)
2. 직접: `ANTHROPIC_API_KEY=.. AZURE_SPEECH_KEY=.. AZURE_SPEECH_REGION=koreacentral SERMON_ADMIN=.. node scripts/add-sermon.mjs <url>` 후 `git add public/audio src/data/sermons.json && git commit && git push`
3. 관리 화면: **편집·숨김·삭제 전용**(AI 생성은 파이프라인). gocheok.onlybible.kr/admin.html → 📜 말씀 아카이브 관리
- 노트 데이터는 테이블로 즉시 반영(재배포 X). **오디오 MP3만 커밋·푸시(재배포) 필요**

## 앱 기능
- 목록(검색: 제목·설교자·본문·주제) · 상세(유튜브 플레이어 + AI 노트)
- 🎧 3분 요약 듣기(미리 생성한 MP3, 잠금화면·백그라운드 재생)
- ⭐ 즐겨찾기(localStorage) · 즐겨찾기만 보기 토글
- 📖 암송하기 — 암송구절 매칭 시에만 버튼 표시, `gocheok.onlybible.kr/?v=구절번호`로 딥링크(성경암송 앱이 로그인 없이 해당 구절 바로 진입)
- 핵심구절≠암송구절이면 **암송구절 우선 표시**
- 스플래시(찬양앱과 동일 로고, 1초), 라이트/다크, 카카오톡 OG 썸네일·PWA 아이콘(연한 파랑)

## 현황 (2026-07-11)
- **2026년 설교 34편** 적재(주일설교 26·새벽기도 6·금요집회 1·송구영신 1). 담임목사 협의 후 2025년·이전 확장 예정
- 비공개 영상 2편(-7OqMxRHOdM, -OtnDbZ5Bj0)은 자막 불가로 제외
- 향후: 오디오를 Supabase Storage로 옮기면 오디오도 재배포 불필요
