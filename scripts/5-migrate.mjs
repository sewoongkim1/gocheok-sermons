// 5단계: sermons.json → sermons 테이블 (제목에서 날짜·구분 분리)
// 사용법: SERMON_ADMIN=<관리자비번> node scripts/5-migrate.mjs
//   (SERMON_ADMIN 없으면 변환 결과만 data/sermons_rows.json 으로 저장)
import { readFileSync, writeFileSync } from "node:fs";

const FN = "https://xnomlgydifiqiybervtf.supabase.co/functions/v1/sermon";
const KEY = "sb_publishable_oLtieT_jw7Gjb8etEsy0jw_thBaDjl-";
const ADMIN = process.env.SERMON_ADMIN || "";

// 제목에서 "YYYY.MM.DD " 날짜 분리 + 구분(category) 판별
function separate(s) {
  let title = (s.title || "").normalize("NFC").trim();
  let date = s.date || "";
  const m = title.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+/);
  if (m) {
    date = `${m[1]}-${m[2]}-${m[3]}`; // 제목의 날짜가 실제 예배일 → 우선
    title = title.slice(m[0].length).trim();
  }
  title = title.replace(/\s*[lIㅣ|]+\s*[차치]동혁\s*(위임|담임)?\s*목사(님)?\s*$/, "").trim(); // 목사님 꼬리표 제거(모든 구분자·오타 변형)
  let category = "주일설교";
  if (/송구영신/.test(title)) category = "송구영신예배";
  else if (/새벽기도/.test(title)) category = "새벽기도회";
  else if (/성령집회|금요/.test(title)) category = "금요성령집회";
  else if (/특별집회/.test(title)) category = "특별집회";
  return { ...s, title, date, category };
}

const sermons = JSON.parse(readFileSync("src/data/sermons.json", "utf8")).map(separate);
writeFileSync("data/sermons_rows.json", JSON.stringify(sermons, null, 2), "utf8");
console.log(`변환 완료: ${sermons.length}편 (data/sermons_rows.json)`);
console.log("구분별:", sermons.reduce((a, s) => ((a[s.category] = (a[s.category] || 0) + 1), a), {}));

if (!ADMIN) {
  console.log("\n※ 테이블 적재하려면: SERMON_ADMIN=<관리자비번> node scripts/5-migrate.mjs");
  process.exit(0);
}
const res = await fetch(FN, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({ action: "importSermons", secret: ADMIN, sermons }),
});
const j = await res.json();
console.log(j.ok ? `✅ 테이블 적재 완료: ${j.count}편` : `❌ 실패: ${j.error}`);
