// 3단계: audioScript → Azure TTS 공식 음성 MP3
// 사용법: AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=koreacentral node scripts/3-tts.mjs [최대편수]
// 산출물: public/audio/{id}.mp3, sermons.json의 audio 필드 갱신
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION || "koreacentral";
const VOICE = process.env.AZURE_VOICE || "ko-KR-SunHiNeural"; // 여성. 남성=ko-KR-InJoonNeural
const LIMIT = Number(process.argv[2] || 999);
const OUT = "src/data/sermons.json";
const ADIR = "public/audio";

if (!KEY) { console.error("AZURE_SPEECH_KEY 환경변수가 필요합니다."); process.exit(1); }
mkdirSync(ADIR, { recursive: true });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ssml = (text) =>
  `<speak version="1.0" xml:lang="ko-KR"><voice name="${VOICE}">` +
  `<prosody rate="+5%">${esc(text)}</prosody></voice></speak>`;

async function synth(text, outPath) {
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
  if (!res.ok) throw new Error(`Azure ${res.status}: ${(await res.text()).slice(0, 200)}`);
  writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
}

const sermons = JSON.parse(readFileSync(OUT, "utf8"));
let count = 0;
for (const s of sermons) {
  if (count >= LIMIT) break;
  if (!s.audioScript) continue;
  const rel = `audio/${s.id}.mp3`;
  const abs = `${ADIR}/${s.id}.mp3`;
  if (existsSync(abs) && s.audio === rel) { console.log(`  건너뜀(있음): ${s.id}`); continue; }
  try {
    await synth(s.audioScript, abs);
    s.audio = rel;
    count++;
    console.log(`  ✓ ${s.id} (${count}) ${s.title}`);
    writeFileSync(OUT, JSON.stringify(sermons, null, 2), "utf8");
  } catch (e) {
    console.log(`  ✗ ${s.id} 실패: ${e.message}`);
  }
}
console.log(`\n완료: ${count}편 음성 생성 → ${ADIR}/`);
