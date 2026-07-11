// 새 설교 1편을 한 번에 추가: 자막→AI노트→Azure음성→암송매칭→테이블 적재
// 사용법:
//   ANTHROPIC_API_KEY=... AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=koreacentral SERMON_ADMIN=... \
//     node scripts/add-sermon.mjs <유튜브링크 또는 영상ID>
import { execFileSync } from "node:child_process";

const arg = process.argv[2];
if (!arg) { console.error("유튜브 링크나 영상 ID를 주세요."); process.exit(1); }
const id = (/[?&]v=([^&]+)/.exec(arg) || [])[1] || arg.trim();

const need = (k) => { if (!process.env[k]) { console.error(`환경변수 ${k} 필요`); process.exit(1); } };
need("ANTHROPIC_API_KEY"); need("AZURE_SPEECH_KEY"); need("SERMON_ADMIN");

const run = (label, script, env = {}) => {
  console.log(`\n▶ ${label}`);
  execFileSync("node", [script, ...(script === "scripts/add-sermon.mjs" ? [] : [])],
    { stdio: "inherit", env: { ...process.env, ...env } });
};

console.log(`설교 추가: ${id}`);
// 1) 자막·메타
execFileSync("node", ["scripts/add-video.mjs", id], { stdio: "inherit", env: process.env });
// 2) AI 노트(신규만) 3) 음성(신규만) 4) 암송 매칭
execFileSync("node", ["scripts/2-notes.mjs"], { stdio: "inherit", env: process.env });
execFileSync("node", ["scripts/3-tts.mjs"], { stdio: "inherit", env: process.env });
execFileSync("node", ["scripts/4-link.mjs"], { stdio: "inherit", env: process.env });
// 5) 테이블 적재(전체 upsert — 새 편 포함)
execFileSync("node", ["scripts/5-migrate.mjs"], { stdio: "inherit", env: process.env });

console.log(`\n✅ 완료! 테이블에 반영됨. 오디오 파일은 커밋·푸시하면 sermon.onlybible.kr에 배포됩니다:`);
console.log(`   git add public/audio src/data/sermons.json && git commit -m "설교 추가: ${id}" && git push`);
