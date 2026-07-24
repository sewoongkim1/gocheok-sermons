#!/bin/bash
# 나머지 설교 일괄 추가: 자막수집 → AI노트 → 음성 → 매칭 → 도우미 → DB적재 → 푸시
# 각 단계는 이미 처리된 편을 건너뛰므로(캐시) 중단돼도 재실행하면 이어서 진행된다.
set -uo pipefail
cd /c/Projects/gocheok-sermons
set -a; . ./.env; set +a
export PYTHONUTF8=1 PYTHONIOENCODING=utf-8
# 과거 설교 대량 백필은 Sonnet(비용 ~1/5) — 매주 추가(add-local)는 Opus 유지
export SERMON_MODEL=claude-sonnet-5

echo "===== [$(date +%H:%M:%S)] ① 자막·메타 수집 (전체 재생목록) ====="
node scripts/1-fetch.mjs || echo "⚠️ 1-fetch 종료코드 $? (계속 진행)"

echo "===== [$(date +%H:%M:%S)] ② AI 노트 생성 ====="
node scripts/2-notes.mjs || echo "⚠️ 2-notes 종료코드 $? (계속 진행)"

echo "===== [$(date +%H:%M:%S)] ③ 음성(3분 MP3) 생성 ====="
node scripts/3-tts.mjs || echo "⚠️ 3-tts 종료코드 $? (계속 진행)"

echo "===== [$(date +%H:%M:%S)] ④ 암송 구절 매칭 ====="
node scripts/4-link.mjs || echo "⚠️ 4-link 종료코드 $?"

echo "===== [$(date +%H:%M:%S)] ④-b 암송 도우미(쉬운 풀이·기억법) ====="
node scripts/4b-versehelp.mjs || echo "⚠️ 4b 종료코드 $?"

echo "===== [$(date +%H:%M:%S)] ⑤ DB 적재 ====="
node scripts/5-migrate.mjs || echo "⚠️ 5-migrate 종료코드 $?"

echo "===== [$(date +%H:%M:%S)] ⑥ 커밋·푸시 ====="
git add public/audio src/data/sermons.json data/meta.json data/sermons_rows.json data/transcripts data/verse_help_update.sql 2>/dev/null
if git diff --cached --quiet; then
  echo "변경 없음"
else
  git commit -m "설교 일괄 추가(로컬): 재생목록 잔여분 반영

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  git push
fi
echo "===== [$(date +%H:%M:%S)] 완료 ====="