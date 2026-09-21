// 관리자 화면 설교 올리기(sermon-job.yml)가 쓰는 순수 함수 — job-lib.test.mjs 가 시험한다.
export const PROD_API = "https://xnomlgydifiqiybervtf.supabase.co/functions/v1/api";
export const DEV_API = "https://ktpwthwqzgcqcrmsafdo.supabase.co/functions/v1/api";
const KEYS = {
  [PROD_API]: "sb_publishable_oLtieT_jw7Gjb8etEsy0jw_thBaDjl-",
  [DEV_API]: "sb_publishable_eJKP6u95IU9_DBXTvnvYBA_-yGCf-0Y",
};
// ⚠️ 이 둘 말고는 모른다고 답한다 — 모르는 주소에 관리자 암호를 보내지 않게
export const modeOf = (base) => (base === PROD_API ? "prod" : base === DEV_API ? "dev" : null);
export const anonKeyOf = (base) => KEYS[base] || KEYS[PROD_API];

// 영상 번호 — ⚠️ 같은 규칙이 세 곳: 여기 · 성경암송 admin-stats.html stVideoId · api 함수 ytIdOf
export function vidOf(u) {
  const s = String(u ?? "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:[?&]v=|youtu\.be\/|\/live\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/);
  return m ? m[1] : "";
}

// 작업 한 건을 data/meta.json 한 줄로 — 제목·날짜·구분·설교자는 담당자가 확인한 값(유튜브에 가지 않는다)
export function mergeMeta(meta, job) {
  const rest = (meta || []).filter((m) => m.id !== job.video_id);
  rest.push({ id: job.video_id, title: job.title, date: job.svc_date, category: job.category, preacher: job.preacher });
  return rest.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// 다시 시도: DB 에 이미 들어간 설교는 그 내용이 맞다(AI 노트를 다시 만들면 음성과 글이 어긋난다)
export function adoptSermon(sermons, row) {
  return [row, ...(sermons || []).filter((s) => s.id !== row.id)];
}

export const noteOf = (sermons, id) => (sermons || []).find((s) => s.id === id && s.summary) || null;
