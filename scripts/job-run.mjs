// 관리자 화면(설교·찬양 관리 → ② 설교 내용 등록)에서 올린 작업 한 건 — sermon-job.yml 이 부른다.
//   유튜브에는 가지 않는다: 자막은 담당자가 붙인 것(sermon_jobs.transcript), 제목·날짜·구분·설교자도 그 값.
//   설계: bible-memorize-church-app-v2/docs/superpowers/specs/2026-09-21-sermon-staff-upload-design.md 4장
// 환경: API_BASE · SERMON_ADMIN · JOB_ID · ATTEMPT · RUN_URL · ANTHROPIC_API_KEY · AZURE_SPEECH_KEY · AZURE_SPEECH_REGION
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { jobApi, prodSermons } from "./job-api.mjs";
import { modeOf, anonKeyOf, vidOf, mergeMeta, adoptSermon, noteOf } from "./job-lib.mjs";

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
// 이 설교(영상)를 가리키는 암송구절 — 4-link 와 같은 목록·같은 규칙(같은 영상이 둘이면 뒤의 것, Map 처럼)
async function verseOf(id) {
  const base = process.env.API_BASE, key = anonKeyOf(base);
  const r = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ action: "getVerses" }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok || !Array.isArray(j.verses)) throw new Error("암송구절 목록을 받지 못했어요");
  return j.verses.filter((v) => vidOf(v.url) === id).pop() || null;
}
// 암송 도우미가 다 찼나 — 암송구절이 이어진 설교만 본다(없이 올린 설교는 도우미가 없는 게 맞다)
const helpDone = (id) => { const s = noteOf(readSermons(), id); return !s?.memText || !!(s.easyExplain && s.memoryTip); };

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
  // 4-link 는 목록만 받으면 0 으로 끝난다 — 이 설교를 가리키는 구절이 있는데 안 이어졌으면 여기서 멈춘다(2026-09-21 최종 리뷰)
  const linked = await verseOf(id);
  if (linked && noteOf(readSermons(), id)?.memVerseNo !== linked.no) throw new Error("이 설교를 가리키는 구절이 있는데 잇지 못했어요");
  console.log(linked ? `  암송구절 ${linked.no}번(${linked.refShort || ""})에 이었다` : "  이 설교를 가리키는 암송구절이 없다 — 잇지 않고 간다");
  await run("versehelp", ["scripts/4b-versehelp.mjs"]);
  // 4b 도 한 편이 실패해도 0 으로 끝난다 — 비었으면 한 번만 더, 그래도 비면 멈춘다(도우미 없이 올라가지 않게)
  if (!helpDone(id)) {
    console.log("  쉬운 풀이·기억법이 비었다 — 한 번 더 만든다");
    await run("versehelp", ["scripts/4b-versehelp.mjs"]);
  }
  if (!helpDone(id)) throw new Error("쉬운 풀이·기억법이 비었어요");

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
