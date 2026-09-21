// 워크플로가 도중에 죽었을 때 — 작업을 「멈춤」으로 적고(스크립트가 이미 적었으면 그대로) 운영이면 친구에게 텔레그램.
import { jobApi } from "./job-api.mjs";
import { modeOf } from "./job-lib.mjs";

// ⚠️ jobApi 자체가 던질 수 있다(예: 운영 비밀값이 비어 SERMON_ADMIN 이 없을 때) — 그래도 알림은 가야 한다
let api = null;
try { api = jobApi(process.env); } catch (e) { console.error("작업 연결을 못 만들었다:", e.message); }
// 실행 주소 비교용 — api 가 없으면(연결 실패) env 의 RUN_URL 로 대신한다
const runUrl = api ? api.runUrl : (process.env.RUN_URL || null);

let job = null;
if (api) {
  try { job = await api.get(); } catch (e) { console.error("작업을 못 읽었다:", e.message); }
  // 다른 실행이 이 작업을 맡았으면(다시 시도) 이 실행은 밀려난 것 — 적지도 알리지도 않는다(헛경보)
  if (job && job.run_url && job.run_url !== runUrl) { console.log("다른 실행이 맡은 작업 — 알리지 않는다"); process.exit(0); }
  if (job && job.status !== "failed") {
    await api.update({ status: "failed", error: "GitHub 작업이 도중에 멈췄어요" }).catch(() => {});
    try { job = await api.get(); } catch { /* 위 값으로 */ }
    // 다시 읽은 뒤에도 같은 검사 — 그사이 다른 실행이 끼어들었으면 여기서도 밀려난 것
    if (job && job.run_url && job.run_url !== runUrl) { console.log("다른 실행이 맡은 작업 — 알리지 않는다"); process.exit(0); }
  }
}
const tg = process.env.TG_TOKEN, chat = process.env.TG_CHAT;
const mode = modeOf(process.env.API_BASE);
// 운영인데 텔레그램 비밀값이 없으면 조용히 넘어가지 않는다 — 실행 목록이 빨갛게라도 남아야 한다
if (mode === "prod" && (!tg || !chat)) {
  console.error("텔레그램 비밀값이 없다 — 알림을 못 보냈다");
  process.exitCode = 1;
} else if (mode === "prod") {
  const text = ["⚠️ 설교 올리기 실패",
    job ? `${job.title} (${job.svc_date}) · ${job.created_by || ""}` : `작업 #${process.env.JOB_ID}`,
    job ? `${job.step || ""} — ${job.error || ""}` : (!api ? "작업 연결을 못 만들었다 — 비밀값(SERMON_ADMIN/DEV_SERMON_ADMIN)을 확인" : ""),
    process.env.RUN_URL || ""].filter(Boolean).join("\n");
  const r = await fetch(`https://api.telegram.org/bot${tg}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text }),
  }).catch((e) => { console.error("텔레그램 보내기 실패:", e.message); return null; });
  if (r && !r.ok) console.error("텔레그램 보내기 실패:", r.status);
  if (!r || !r.ok) process.exitCode = 1;
}
