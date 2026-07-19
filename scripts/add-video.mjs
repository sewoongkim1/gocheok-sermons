// 재생목록에 없는 개별 설교 영상을 배치에 추가 (신년예배 등)
// 사용법: node scripts/add-video.mjs <videoId> [videoId2 ...]
// 자막·제목·날짜를 가져와 data/meta.json + data/transcripts/에 추가
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ENV = { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" };
const TDIR = "data/transcripts";
// 클라우드(Actions)에서 유튜브 봇차단 우회용 쿠키 파일(있으면 사용)
const COOKIES = existsSync("data/yt-cookies.txt") ? ["--cookies", "data/yt-cookies.txt"] : [];
// 봇차단(데이터센터 IP) 우회: 여러 player_client를 순차 시도. 쿠키 만료 시에도 일부 클라이언트로 통과 가능.
// YT_CLIENTS 환경변수로 조합 조정 가능(예: "default,tv,web_safari,mweb").
const CLIENTS = ["--extractor-args",
  `youtube:player_client=${process.env.YT_CLIENTS || "default,tv,web_safari,mweb"}`];
const ids = process.argv.slice(2);
if (!ids.length) { console.error("영상 ID를 인자로 주세요."); process.exit(1); }

const cleanTitle = (t) => t.replace(/^\[고척교회\]\s*/, "").replace(/[ㅣ|].*$/, "").trim();
const meta = existsSync("data/meta.json") ? JSON.parse(readFileSync("data/meta.json", "utf8")) : [];
const byId = new Map(meta.map((m) => [m.id, m]));

for (const id of ids) {
  let title = id, date = "";
  try {
    const out = execFileSync("yt-dlp", ["--no-warnings", ...COOKIES, ...CLIENTS, "--print", "%(title)s\t%(upload_date)s",
      `https://www.youtube.com/watch?v=${id}`], { encoding: "utf8", env: ENV }).trim().split("\t");
    title = cleanTitle(out[0] || id);
    const d = (out[1] || "").trim();
    date = d.length === 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : "";
  } catch (e) {
    const err = (e.stderr || e.message || "").toString().replace(/\s+/g, " ").slice(0, 300);
    console.log(`  메타 실패: ${id} — ${err}`);
  }

  // 자막
  const txtPath = `${TDIR}/${id}.txt`;
  if (!existsSync(txtPath)) {
    try {
      execFileSync("yt-dlp", ["--no-warnings", ...COOKIES, ...CLIENTS, "--skip-download", "--ignore-no-formats-error",
        "--write-auto-sub", "--sub-langs", "ko-orig,ko", "--sub-format", "json3",
        "-o", `${TDIR}/sub_%(id)s.%(ext)s`, `https://www.youtube.com/watch?v=${id}`],
        { env: ENV });
      // ko-orig 없으면 ko 파일로 폴백
      const subPath = existsSync(`${TDIR}/sub_${id}.ko-orig.json3`)
        ? `${TDIR}/sub_${id}.ko-orig.json3` : `${TDIR}/sub_${id}.ko.json3`;
      const j = JSON.parse(readFileSync(subPath, "utf8"));
      const text = (j.events || []).filter((ev) => ev.segs)
        .map((ev) => ev.segs.map((s) => s.utf8 || "").join("")).join(" ").replace(/\s+/g, " ").trim();
      writeFileSync(txtPath, text, "utf8");
      console.log(`  ✓ 자막 ${id} (${text.length}자)`);
    } catch (e) {
      const err = (e.stderr || e.message || "").toString().slice(0, 400);
      console.log(`  ✗ 자막 실패: ${id} — ${err}`);
    }
  }
  byId.set(id, { id, title, date });
  console.log(`  추가: ${id} | ${title} | ${date}`);
}

// 날짜 최신순 정렬해 저장
const merged = [...byId.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
writeFileSync("data/meta.json", JSON.stringify(merged, null, 2), "utf8");
console.log(`\ndata/meta.json 갱신 (총 ${merged.length}편)`);
