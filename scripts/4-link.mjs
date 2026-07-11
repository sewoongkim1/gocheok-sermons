// 4단계: 설교 ↔ 성경암송 구절 매칭 (유튜브 영상ID 기준)
// 성경암송 verses 테이블의 url에 담긴 영상ID로 매칭 → sermons.json에 memVerseNo 새김
// 사용법: node scripts/4-link.mjs
import { readFileSync, writeFileSync } from "node:fs";

const API = "https://xnomlgydifiqiybervtf.supabase.co/functions/v1/api";
const KEY = "sb_publishable_oLtieT_jw7Gjb8etEsy0jw_thBaDjl-";
const OUT = "src/data/sermons.json";
const vidOf = (u) => (/[?&]v=([^&]+)/.exec(u || "") || [])[1] || "";

const res = await fetch(API, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({ action: "getVerses" }),
});
const { verses = [] } = await res.json();
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
