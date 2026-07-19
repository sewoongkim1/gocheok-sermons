// .env 키 검증 — 값은 출력하지 않고, 각 키가 실제로 인증되는지 ✓/✗ 만 보여준다.
// 사용법: node scripts/check-env.mjs
import { readFileSync, existsSync } from "node:fs";

if (!existsSync(".env")) { console.error("❌ .env 파일이 없습니다. (.env.example 참고)"); process.exit(1); }
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (!m || line.trim().startsWith("#")) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const PLACEHOLDER = "여기에_붙여넣기";
const has = (k) => process.env[k] && process.env[k] !== PLACEHOLDER;
const mask = (k) => (has(k) ? `설정됨(${process.env[k].length}자)` : "비어있음/미입력");

console.log("== .env 값 채워짐 여부(값은 표시 안 함) ==");
for (const k of ["ANTHROPIC_API_KEY", "AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION", "SERMON_ADMIN"]) {
  console.log(`  ${has(k) ? "•" : "✗"} ${k}: ${mask(k)}`);
}

console.log("\n== 실제 인증 테스트 ==");
// ① Anthropic
if (has("ANTHROPIC_API_KEY")) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    });
    console.log(`  ${r.ok ? "✓" : "✗"} ANTHROPIC_API_KEY  (HTTP ${r.status}${r.ok ? "" : " — 키 확인 필요"})`);
  } catch (e) { console.log(`  ✗ ANTHROPIC_API_KEY  (네트워크 오류: ${e.message})`); }
} else console.log("  ✗ ANTHROPIC_API_KEY  미입력");

// ② Azure Speech
if (has("AZURE_SPEECH_KEY")) {
  const region = process.env.AZURE_SPEECH_REGION || "koreacentral";
  try {
    const r = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY, "Content-Length": "0" },
    });
    console.log(`  ${r.ok ? "✓" : "✗"} AZURE_SPEECH_KEY   (HTTP ${r.status}${r.ok ? "" : " — 키/리전 확인 필요"})`);
  } catch (e) { console.log(`  ✗ AZURE_SPEECH_KEY   (네트워크 오류: ${e.message})`); }
} else console.log("  ✗ AZURE_SPEECH_KEY   미입력");

// ③ SERMON_ADMIN (sermon 함수 authCheck)
if (has("SERMON_ADMIN")) {
  const FN = "https://xnomlgydifiqiybervtf.supabase.co/functions/v1/sermon";
  const KEY = "sb_publishable_oLtieT_jw7Gjb8etEsy0jw_thBaDjl-";
  try {
    const r = await fetch(FN, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ action: "authCheck", secret: process.env.SERMON_ADMIN }),
    });
    const j = await r.json().catch(() => ({}));
    console.log(`  ${j.ok ? "✓" : "✗"} SERMON_ADMIN       (${j.ok ? "인증 성공" : "비번 불일치"})`);
  } catch (e) { console.log(`  ✗ SERMON_ADMIN       (네트워크 오류: ${e.message})`); }
} else console.log("  ✗ SERMON_ADMIN       미입력");

console.log("\n모두 ✓ 이면 준비 완료 — node scripts/add-local.mjs <유튜브링크> 로 새 설교를 추가할 수 있습니다.");
