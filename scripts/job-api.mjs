// sermon_jobs 한 건을 읽고 적는다 — api 함수의 sermonJobGet·sermonJobUpdate(관리자 암호).
import { modeOf, anonKeyOf } from "./job-lib.mjs";

const SERMON_FN = "https://xnomlgydifiqiybervtf.supabase.co/functions/v1/sermon";
const SERMON_KEY = "sb_publishable_oLtieT_jw7Gjb8etEsy0jw_thBaDjl-";
// 운영 말씀 아카이브의 공개 목록(getSermons) — 다시 시도(job-run)와 배포 뒤 확인(job-verify)이 함께 쓴다
// ⚠️ 못 받았으면 빈 목록이 아니라 던진다(2026-09-21 최종 리뷰) — 빈 목록이면 다시 시도가 「DB 에 아직 없다」로 알고
//    AI 노트를 조용히 새로 만든다(이미 올라간 음성과 글이 어긋난다). job-verify 는 받아서 다음 번에 다시 본다.
export async function prodSermons() {
  const r = await fetch(SERMON_FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SERMON_KEY, Authorization: `Bearer ${SERMON_KEY}` },
    body: JSON.stringify({ action: "getSermons" }),
  });
  const j = r.ok ? await r.json().catch(() => null) : null;
  if (!j || !Array.isArray(j.sermons)) throw new Error("getSermons 실패");
  return j.sermons;
}

export function jobApi(env) {
  const base = env.API_BASE, pw = env.SERMON_ADMIN, id = Number(env.JOB_ID);
  // ⚠️ 모르는 주소면 여기서 멈춘다 — 관리자 암호를 그리로 보내지 않는다
  if (!modeOf(base)) throw new Error(`모르는 API_BASE: ${base}`);
  if (!pw || !Number.isInteger(id)) throw new Error("SERMON_ADMIN · JOB_ID 가 필요하다");
  // ⚠️ GitHub 에서 돌 때는 실행 주소가 꼭 있어야 한다 — 없으면 서버의 「다른 실행이 맡은 작업」 검사가 꺼진다(Task 3 리뷰)
  if (env.GITHUB_ACTIONS === "true" && !env.RUN_URL) throw new Error("RUN_URL 이 비었다");
  // 다시 시도 번호 — 서버는 지금 번호와 다른 기록을 「stale」로 거절한다(다시 시도는 run_url 을 비우므로 그것만으로는
  //    옛 실행을 못 가린다 · 2026-09-21 최종 리뷰). GitHub 에서는 꼭 있어야 한다(워크플로 입력, 기본 1).
  const attempt = env.ATTEMPT ? Number(env.ATTEMPT) : null;
  if ((attempt != null || env.GITHUB_ACTIONS === "true") && !Number.isInteger(attempt)) {
    throw new Error(`ATTEMPT(다시 시도 번호)가 이상하다: ${env.ATTEMPT ?? ""}`);
  }
  const key = anonKeyOf(base);
  async function call(action, extra = {}) {
    const r = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ action, pw, id, ...extra }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(`${action}: ${j.error || "HTTP " + r.status}`);
    return j;
  }
  // ⚠️ 모든 기록에 이 실행의 주소(run_url)를 싣는다 — 서버는 끝난 작업이나 다른 실행이 맡은 작업의 기록을
  //    「stale」로 거절한다(30분 스윕 뒤 되살아난 옛 실행이 다시 시도한 새 실행과 번갈아 적지 않게 · Task 3 리뷰).
  const runUrl = env.RUN_URL || null;
  return {
    id, runUrl, attempt,
    get: async () => (await call("sermonJobGet")).job,
    update: (fields) => call("sermonJobUpdate", { run_url: runUrl, ...(attempt != null ? { attempt } : {}), ...fields }),
  };
}
