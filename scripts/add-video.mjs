// 재생목록에 없는 개별 설교 영상을 배치에 추가 (신년예배 등)
// 사용법: node scripts/add-video.mjs <videoId> [videoId2 ...]
// 자막·제목·날짜를 가져와 data/meta.json + data/transcripts/에 추가
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ENV = { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" };
const TDIR = "data/transcripts";
// 클라우드(Actions)에서 유튜브 봇차단 우회용 쿠키 파일(있으면 사용)
const COOKIES = existsSync("data/yt-cookies.txt") ? ["--cookies", "data/yt-cookies.txt"] : [];
const ids = process.argv.slice(2);
if (!ids.length) { console.error("영상 ID를 인자로 주세요."); process.exit(1); }

const cleanTitle = (t) => t.replace(/^\[고척교회\]\s*/, "").replace(/[ㅣ|].*$/, "").trim();
const meta = existsSync("data/meta.json") ? JSON.parse(readFileSync("data/meta.json", "utf8")) : [];
const byId = new Map(meta.map((m) => [m.id, m]));

for (const id of ids) {
  let title = id, date = "";
  try {
    const out = execFileSync("yt-dlp", ["--no-warnings", ...COOKIES, "--print", "%(title)s\t%(upload_date)s",
      `https://www.youtube.com/watch?v=${id}`], { encoding: "utf8", env: ENV }).trim().split("\t");
    title = cleanTitle(out[0] || id);
    const d = (out[1] || "").trim();
    date = d.length === 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : "";
  } catch (e) { console.log(`  메타 실패: ${id}`); }

  // 자막
  const txtPath = `${TDIR}/${id}.txt`;
  if (!existsSync(txtPath)) {
    try {
      execFileSync("yt-dlp", ["--no-warnings", ...COOKIES, "--skip-download", "--write-auto-sub",
        "--sub-lang", "ko-orig", "--sub-format", "json3",
        "-o", `${TDIR}/sub_%(id)s.%(ext)s`, `https://www.youtube.com/watch?v=${id}`],
        { env: ENV, stdio: "ignore" });
      const j = JSON.parse(readFileSync(`${TDIR}/sub_${id}.ko-orig.json3`, "utf8"));
      const text = (j.events || []).filter((ev) => ev.segs)
        .map((ev) => ev.segs.map((s) => s.utf8 || "").join("")).join(" ").replace(/\s+/g, " ").trim();
      writeFileSync(txtPath, text, "utf8");
      console.log(`  ✓ 자막 ${id} (${text.length}자)`);
    } catch (e) { console.log(`  ✗ 자막 실패: ${id}`); }
  }
  byId.set(id, { id, title, date });
  console.log(`  추가: ${id} | ${title} | ${date}`);
}

// 날짜 최신순 정렬해 저장
const merged = [...byId.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
writeFileSync("data/meta.json", JSON.stringify(merged, null, 2), "utf8");
console.log(`\ndata/meta.json 갱신 (총 ${merged.length}편)`);
