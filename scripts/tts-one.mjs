// 단건 설교 오디오 생성: data/audioscripts/<id>.txt (나레이션 대본) → public/audio/<id>.mp3
// Actions에서 Azure로 MP3를 만들 때 쓴다(유튜브 봇차단과 무관 — 자막 취득이 필요 없음).
// 사용법: AZURE_SPEECH_KEY=... [AZURE_SPEECH_REGION=koreacentral] node scripts/tts-one.mjs <id>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION || "koreacentral";
const VOICE = process.env.AZURE_VOICE || "ko-KR-SunHiNeural";
const id = process.argv[2];
if (!KEY) { console.error("AZURE_SPEECH_KEY 환경변수가 필요합니다."); process.exit(1); }
if (!id) { console.error("영상 ID를 인자로 주세요."); process.exit(1); }

const scriptPath = `data/audioscripts/${id}.txt`;
if (!existsSync(scriptPath)) { console.error(`대본 없음: ${scriptPath}`); process.exit(1); }
const text = readFileSync(scriptPath, "utf8").trim();
mkdirSync("public/audio", { recursive: true });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// 성경 장·절 등은 한자어로 읽어야 함(3장→삼장). 숫자→한자어 한글 변환(3-tts.mjs와 동일 규칙)
const SD = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
function sino(n) {
  n = +n; if (n === 0) return "영";
  let o = ""; const th = Math.floor(n / 1000) % 10, h = Math.floor(n / 100) % 10, t = Math.floor(n / 10) % 10, u = n % 10;
  if (th) o += (th === 1 ? "" : SD[th]) + "천";
  if (h) o += (h === 1 ? "" : SD[h]) + "백";
  if (t) o += (t === 1 ? "" : SD[t]) + "십";
  if (u) o += SD[u];
  return o;
}
const numFix = (t) => t.replace(/(\d+)\s*(장|절|편|년|월|일|분|초|주|차|호|번지)/g, (_, n, u) => sino(n) + u);
const ssml = (t) =>
  `<speak version="1.0" xml:lang="ko-KR"><voice name="${VOICE}"><prosody rate="+5%">${esc(numFix(t))}</prosody></voice></speak>`;

const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
  method: "POST",
  headers: {
    "Ocp-Apim-Subscription-Key": KEY,
    "Content-Type": "application/ssml+xml",
    "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
    "User-Agent": "gocheok-sermons",
  },
  body: ssml(text),
});
if (!res.ok) { console.error(`Azure ${res.status}: ${(await res.text()).slice(0, 200)}`); process.exit(1); }
writeFileSync(`public/audio/${id}.mp3`, Buffer.from(await res.arrayBuffer()));
console.log(`✅ public/audio/${id}.mp3 생성 (대본 ${text.length}자)`);
