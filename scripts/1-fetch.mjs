// 1단계: 담임목사 설교 목록 + 한글 자막 수집
// 사용법: node scripts/1-fetch.mjs [최대편수]
// 산출물: data/meta.json (설교 메타), data/transcripts/{id}.txt (자막 원문)
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";

// Windows에서 yt-dlp stdout 한글이 cp949로 깨지는 것 방지
const ENV = { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" };

const PLAYLIST = "PLmW-GwY4IF3yRWzP8gEPtAUvKqNeVstCf"; // 차동혁목사 주일설교
const LIMIT = Number(process.argv[2] || 999);
const YEAR = process.env.SERMON_YEAR || ""; // 예: "2026" → 해당 연도만 (재생목록은 최신순이라 지나가면 중단)
const TDIR = "data/transcripts";
mkdirSync(TDIR, { recursive: true });

// 영어판(같은 설교의 번역본)은 제외
const isEnglish = (t) => /Gocheok Church|Senior Pastor|Pastor Cha/i.test(t);
const cleanTitle = (t) => t.replace(/^\[고척교회\]\s*/, "").replace(/[ㅣ|].*$/, "").trim();

console.log("설교 목록 가져오는 중…");
const raw = execFileSync("yt-dlp", [
  "--flat-playlist", "--no-warnings",
  "--print", "%(id)s\t%(title)s",
  `https://www.youtube.com/playlist?list=${PLAYLIST}`,
], { encoding: "utf8", maxBuffer: 1 << 24, env: ENV });

const all = raw.trim().split("\n").map((l) => {
  const [id, ...t] = l.split("\t");
  return { id, title: t.join("\t") };
}).filter((e) => e.id && !isEnglish(e.title));

console.log(`한글 설교 ${all.length}편 (최대 ${LIMIT}편 처리)`);
const meta = [];
let done = 0;

for (const e of all.slice(0, LIMIT)) {
  const txtPath = `${TDIR}/${e.id}.txt`;
  // 업로드 날짜
  let date = "";
  try {
    date = execFileSync("yt-dlp", ["--no-warnings", "--print", "%(upload_date)s",
      `https://www.youtube.com/watch?v=${e.id}`], { encoding: "utf8" }).trim();
    date = date.length === 8 ? `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}` : "";
  } catch {}

  // 연도 필터(최신순이므로 해당 연도를 지나 이전 연도가 나오면 중단)
  if (YEAR && date && !date.startsWith(YEAR)) {
    if (meta.length) { console.log(`  ${YEAR}년 이전 도달 — 중단`); break; }
    continue;
  }
  meta.push({ id: e.id, title: cleanTitle(e.title), date });

  if (existsSync(txtPath)) { console.log(`  캐시됨: ${e.id}`); done++; continue; }

  // 자막(ko-orig) → json3 → 텍스트
  try {
    execFileSync("yt-dlp", ["--no-warnings", "--skip-download",
      "--write-auto-sub", "--sub-lang", "ko-orig", "--sub-format", "json3",
      "-o", `${TDIR}/sub_%(id)s.%(ext)s`,
      `https://www.youtube.com/watch?v=${e.id}`], { stdio: "ignore" });
    const j = JSON.parse(readFileSync(`${TDIR}/sub_${e.id}.ko-orig.json3`, "utf8"));
    const text = (j.events || [])
      .filter((ev) => ev.segs)
      .map((ev) => ev.segs.map((s) => s.utf8 || "").join(""))
      .join(" ").replace(/\s+/g, " ").trim();
    writeFileSync(txtPath, text, "utf8");
    console.log(`  ✓ ${e.id} (${text.length}자) ${cleanTitle(e.title)}`);
    done++;
  } catch (err) {
    console.log(`  ✗ ${e.id} 자막 실패: ${cleanTitle(e.title)}`);
  }
}

writeFileSync("data/meta.json", JSON.stringify(meta, null, 2), "utf8");
console.log(`\n완료: 자막 ${done}편, 메타 ${meta.length}편 → data/meta.json`);
