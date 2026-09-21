// 관리자 화면(설교·찬양 관리 → ② 설교 내용 등록)에서 올린 작업 한 건 — sermon-job.yml 이 부른다.
//   유튜브에는 가지 않는다: 자막은 담당자가 붙인 것(sermon_jobs.transcript), 제목·날짜·구분·설교자도 그 값.
//   설계: bible-memorize-church-app-v2/docs/superpowers/specs/2026-09-21-sermon-staff-upload-design.md 4장
// 환경: API_BASE · SERMON_ADMIN · JOB_ID · RUN_URL · ANTHROPIC_API_KEY · AZURE_SPEECH_KEY · AZURE_SPEECH_REGION
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { jobApi, prodSermons } from "./job-api.mjs";
import { modeOf, mergeMeta, adoptSermon, noteOf } from "./job-lib.mjs";

const OUT = "src/data/sermons.json";
const MODE = modeOf(process.env.API_BASE);
const api = jobApi(process.env);
// 멈춘 단계 → 담당자 화면에 보일 한 줄
const FAIL = {
  prep: "자막을 준비하지 못했어요", notes: "AI 노트를 만들지 못했어요", tts: "3분 음성을 만들지 못했어요",
  link: "암송구절에 잇지 못했어요", versehelp: "암송 도우미를 만들지 못했어요",
  save: "설교를 저장하지 못했어요", embed: "챗봇 색인을 만들지 못했어요",
};
const readSermons = () => (existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : []);
let step = "prep";
async function run(name, args) {
  step = name;
  await api.update({ step: name });
  console.log(`\n▶ ${name}`);
  execFileSync("node", args, { stdio: "inherit", env: process.env });
}

try {
  const job = await api.get();
  const id = job.video_id;
  await api.update({ status: "running", step: "prep", error: null, run_url: process.env.RUN_URL || null });
  console.log(`설교 올리기 #${job.id}: ${id} · ${job.title} · ${job.svc_date} (${MODE})`);

  mkdirSync("data/transcripts", { recursive: true });
  writeFileSync(`data/transcripts/${id}.txt`, job.transcript, "utf8");
  const meta = existsSync("data/meta.json") ? JSON.parse(readFileSync("data/meta.json", "utf8")) : [];
  writeFileSync("data/meta.json", JSON.stringify(mergeMeta(meta, job), null, 2), "utf8");

  // 다시 시도: 첫 시도가 저장까지 갔으면 DB 내용으로 이어 간다(설계 10장)
  if (MODE === "prod") {
    const row = (await prodSermons()).find((s) => s.id === id);
    if (row) {
      writeFileSync(OUT, JSON.stringify(adoptSermon(readSermons(), row), null, 2), "utf8");
      console.log("  이미 DB 에 있는 설교 — 그 내용으로 이어 간다");
    }
  }

  await run("notes", ["scripts/2-notes.mjs"]);
  // 2-notes 는 한 편이 실패해도 0 으로 끝난다 — 결과로 본다
  if (!noteOf(readSermons(), id)) throw new Error("AI 노트가 비어 있어요");
  await run("tts", ["scripts/3-tts.mjs"]);
  // 칸 값이 아니라 파일로 본다 — 다시 시도 때 DB 에서 가져온 줄은 audio 칸이 이미 차 있다
  if (!existsSync(`public/audio/${id}.mp3`)) throw new Error("음성 파일이 만들어지지 않았어요");
  await run("link", ["scripts/4-link.mjs"]);
  await run("versehelp", ["scripts/4b-versehelp.mjs"]);

  if (MODE === "dev") {
    await api.update({ status: "done", step: "verify", error: null });
    console.log("\n🧪 시험 모드(개발 DB) — 저장·챗봇·커밋·배포는 건너뛴다");
    process.exit(0);
  }
  await run("save", ["scripts/5-migrate.mjs"]);
  await run("embed", ["scripts/6-embed.mjs", id]);
  await api.update({ step: "publish" });
  console.log("\n✅ 만들기 끝 — 커밋·배포·확인은 워크플로가 이어서 한다");
} catch (e) {
  const msg = `${FAIL[step] || "멈췄어요"} — ${String(e.message || e).split("\n")[0].slice(0, 160)}`;
  console.error("❌", msg);
  await api.update({ status: "failed", error: msg }).catch((x) => console.error("상태 기록도 실패:", x.message));
  process.exit(1);
}
