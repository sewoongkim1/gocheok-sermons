// 6단계: 설교를 벡터 인덱스(sermon_chunks)에 색인 — '내게 주시는 말씀' 챗봇 검색용
//   5-migrate(테이블 적재) 이후에 실행해야 한다(sermons 테이블에서 읽어와 청킹·임베딩하므로).
//   embedSermons는 bible-memorize-church-app-v2 저장소의 api Edge Function(관리자 액션).
// 사용법: SERMON_ADMIN=<관리자비번> node scripts/6-embed.mjs [sermonId]
//   sermonId 생략 시 숨김 아닌 전체 재색인(무거움 — 지난 설교 백필/재색인 때만 수동 실행)
import { readFileSync, existsSync } from "node:fs";

// .env 로드(단독 실행 시에도 키를 읽도록. add-sermon.mjs 경유면 이미 들어와 있음)
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const FN = "https://xnomlgydifiqiybervtf.supabase.co/functions/v1/api";
const KEY = "sb_publishable_oLtieT_jw7Gjb8etEsy0jw_thBaDjl-";
const ADMIN = process.env.SERMON_ADMIN || "";
if (!ADMIN) { console.error("SERMON_ADMIN 환경변수 필요"); process.exit(1); }

const sermonId = process.argv[2] || undefined;

const res = await fetch(FN, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({ action: "embedSermons", pw: ADMIN, ...(sermonId ? { sermonId } : {}) }),
});
const j = await res.json();
if (!j.ok) { console.log(`❌ 색인 실패: ${j.error}`); process.exit(1); }
console.log(`✅ 색인 완료: 설교 ${j.sermons}편, 청크 ${j.chunks}개`);
