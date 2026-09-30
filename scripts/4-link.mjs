// 4단계: 설교 ↔ 성경암송 구절 매칭 (유튜브 영상ID 기준)
// 성경암송 verses 테이블의 url에 담긴 영상ID로 매칭 → sermons.json에 memVerseNo 새김
// 사용법: node scripts/4-link.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { PROD_API, anonKeyOf, vidOf } from "./job-lib.mjs";

// 관리자 화면 시험(개발 DB)은 API_BASE 로 개발 주소를 준다. 없으면 운영(친구 PC·예전 그대로).
// ⚠️ 영상 번호는 youtu.be/… 꼴도 알아본다(예전엔 ?v= 만 알아 조용히 안 이어났다)
const API = process.env.API_BASE || PROD_API;
const KEY = anonKeyOf(API);
const OUT = "src/data/sermons.json";

const res = await fetch(API, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({ action: "getVerses" }),
});
// ⚠️ 목록을 못 받았으면 멈춘다(2026-09-21 최종 리뷰) — 예전엔 오류 응답도 「구절 0개」로 읽어,
//    아래 반복이 **모든 설교의 memVerseNo·memRef·memText 를 지웠고** 그대로 저장·배포될 수 있었다.
const j = await res.json().catch(() => ({}));
if (!j.ok || !Array.isArray(j.verses) || !j.verses.length) {
  console.error("❌ 암송구절 목록을 받지 못했다 — 연결을 지우지 않고 멈춘다");
  process.exit(1);
}
const verses = j.verses;
const byVid = new Map(verses.filter((v) => vidOf(v.url)).map((v) => [vidOf(v.url), v]));

const sermons = JSON.parse(readFileSync(OUT, "utf8"));
let hit = 0;
for (const s of sermons) {
  const v = byVid.get(s.id);
  if (v) { s.memVerseNo = v.no; s.memRef = v.refShort; s.memText = v.text; hit++; }
  else { delete s.memVerseNo; delete s.memRef; delete s.memText; }
}
writeFileSync(OUT, JSON.stringify(sermons, null, 2), "utf8");
console.log(`매칭 완료: ${hit}/${sermons.length}편에 암송구절 연결 (memVerseNo)`);
