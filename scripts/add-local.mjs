// 로컬(집 인터넷 IP) 원커맨드 설교 추가 — 유튜브 봇차단(Actions 서버 IP) 우회용.
// Actions에서는 유튜브가 데이터센터 IP를 봇으로 막아 자막 취득이 실패하지만,
// 집 IP에서는 쿠키 없이도 잘 된다. 그래서 자막·AI노트·Azure음성·매칭·DB적재·푸시까지
// 이 컴퓨터에서 한 번에 수행한다.
//
// 준비(한 번만): 저장소 루트에 .env 파일을 만들고 키를 넣는다 (.env.example 참고)
//   ANTHROPIC_API_KEY=...
//   AZURE_SPEECH_KEY=...
//   AZURE_SPEECH_REGION=koreacentral
//   SERMON_ADMIN=<관리자 비번>
//
// 사용법:  node scripts/add-local.mjs <유튜브링크 또는 영상ID>
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

// --- .env 로드(외부 의존성 없이 간단 파서) ---
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const arg = process.argv[2];
if (!arg) { console.error("유튜브 링크나 영상 ID를 주세요.\n예: node scripts/add-local.mjs https://youtu.be/XXXX"); process.exit(1); }
const id = (/[?&]v=([^&]+)/.exec(arg) || [])[1] || arg.trim();

const need = (k) => { if (!process.env[k]) { console.error(`.env 에 ${k} 가 필요합니다. (.env.example 참고)`); process.exit(1); } };
need("ANTHROPIC_API_KEY"); need("AZURE_SPEECH_KEY"); need("SERMON_ADMIN");

const step = (label, args) => {
  console.log(`\n▶ ${label}`);
  execFileSync("node", args, { stdio: "inherit", env: process.env });
};

console.log(`설교 추가(로컬): ${id}`);
step("① 자막·메타(로컬 IP, 쿠키 불필요)", ["scripts/add-video.mjs", id]);
step("② AI 노트(요약·핵심·맺음말·대본)", ["scripts/2-notes.mjs"]);
step("③ Azure 음성(3분 요약 MP3)", ["scripts/3-tts.mjs"]);
step("④ 암송 구절 매칭", ["scripts/4-link.mjs"]);
step("⑤ DB 적재(sermons 테이블)", ["scripts/5-migrate.mjs"]);

// 오디오·데이터 커밋·푸시 → Pages가 sermon.onlybible.kr 에 MP3 배포
console.log("\n▶ ⑥ 오디오·데이터 커밋·푸시");
try {
  execFileSync("git", ["add", "public/audio", "src/data/sermons.json", "data/meta.json", "data/sermons_rows.json"], { stdio: "inherit" });
  const staged = execFileSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf8" }).trim();
  if (!staged) {
    console.log("  변경 없음(이미 있는 설교) — 커밋 생략");
  } else {
    execFileSync("git", ["commit", "-m", `설교 추가(로컬): ${id}`], { stdio: "inherit" });
    execFileSync("git", ["push"], { stdio: "inherit" });
  }
  console.log("\n✅ 완료! 테이블 적재 + 오디오/데이터 푸시까지 끝났습니다.");
  console.log("   (읽어주기 MP3는 sermon.onlybible.kr Pages 배포가 끝나면 재생됩니다)");
} catch (e) {
  console.log("\n⚠️ 커밋/푸시 단계 확인 필요:", e.message);
  console.log("   DB 적재(⑤)는 성공했을 수 있습니다. `git status` 확인 후 수동 push 하세요.");
}
