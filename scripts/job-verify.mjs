// 배포 뒤 — 설교가 사이트에 정말 들어갔는지 보고서야 「완료」라고 적는다.
//   「스크립트가 끝났다」를 완료로 치지 않는다(옛 add-sermon.yml 은 자막이 없어도 초록불이었다).
import { jobApi, prodSermons } from "./job-api.mjs";

const SITE = "https://sermon.onlybible.kr/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = jobApi(process.env);
const job = await api.get();
const id = job.video_id;
await api.update({ step: "verify" });

let row = null, audioOk = false;
for (let i = 0; i < 9 && !(row && audioOk); i++) {        // 20초 × 9 = 3분까지 — Pages 배포가 늦을 때
  if (i) await sleep(20000);
  try { row = (await prodSermons()).find((s) => s.id === id && s.summary) || null; } catch { /* 다음 번에 */ }
  if (row?.audio) {
    try { audioOk = (await fetch(SITE + row.audio, { method: "HEAD" })).ok; } catch { /* 다음 번에 */ }
  }
  console.log(`  확인 ${i + 1}: 설교 ${row ? "있음" : "없음"} · 음성 ${audioOk ? "열림" : "아직"}`);
}
if (!(row && audioOk)) {
  await api.update({ status: "failed", error: row ? "음성 파일이 사이트에 아직 안 보여요(배포 확인 필요)" : "설교가 사이트 목록에 안 보여요" });
  process.exit(1);
}
await api.update({ status: "done", error: null });
console.log("✅ 확인 끝 — 사이트에 들어갔다");
