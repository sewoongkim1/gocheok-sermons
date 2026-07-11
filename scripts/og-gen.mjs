// 카카오톡/OG 썸네일 생성 (1200×630) — 연한 파랑 배경 + 로고 + 제목
// 사용법: node scripts/og-gen.mjs  → public/og-cover.png
import sharp from "sharp";
import { readFileSync, existsSync, writeFileSync } from "node:fs";

const LOGO = "data/logo3.png";
if (!existsSync(LOGO)) {
  const r = await fetch("https://summer.onlybible.kr/logo3.png");
  writeFileSync(LOGO, Buffer.from(await r.arrayBuffer()));
}
const logoB64 = readFileSync(LOGO).toString("base64");

const W = 1200, H = 630;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#dcebff"/>
      <stop offset="1" stop-color="#b7d3f5"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#1a3a6b" flood-opacity="0.20"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <!-- 로고 액자(흰 카드) -->
  <g filter="url(#sh)">
    <rect x="${W/2 - 96}" y="118" width="192" height="192" rx="40" fill="#ffffff"/>
  </g>
  <image x="${W/2 - 68}" y="146" width="136" height="136" href="data:image/png;base64,${logoB64}"/>
  <text x="${W/2}" y="400" text-anchor="middle" font-family="'Malgun Gothic','Apple SD Gothic Neo',sans-serif"
        font-size="60" font-weight="800" fill="#1a3a6b" letter-spacing="1">고척교회 말씀 아카이브</text>
  <text x="${W/2}" y="452" text-anchor="middle" font-family="'Malgun Gothic',sans-serif"
        font-size="28" font-weight="500" fill="#2b5288">설교를 AI가 핵심 3점 · 3분 요약으로</text>
  <text x="${W/2}" y="540" text-anchor="middle" font-family="'Malgun Gothic',sans-serif"
        font-size="24" fill="#4a6a9c">오직 성경, 말씀이 답이다!</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("public/og-cover.png");
console.log("✅ public/og-cover.png 생성 (1200×630, 연한 파랑)");
