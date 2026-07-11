// 카카오톡/OG 썸네일 (1200×630) — 찬양앱과 같은 형태: 연한 파랑 배경 + 큰 로고 카드(텍스트 없음)
// 제목·설명은 OG 메타(카톡이 이미지 아래에 렌더). 사용법: node scripts/og-gen.mjs → public/og-cover.png
import sharp from "sharp";
import { readFileSync, existsSync, writeFileSync } from "node:fs";

const LOGO = "data/logo3.png";
if (!existsSync(LOGO)) {
  const r = await fetch("https://summer.onlybible.kr/logo3.png");
  writeFileSync(LOGO, Buffer.from(await r.arrayBuffer()));
}
const logoB64 = readFileSync(LOGO).toString("base64");

const W = 1200, H = 630;
const cw = 820, ch = 400, cx = (W - cw) / 2, cy = (H - ch) / 2, pad = 70;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#dcebff"/>
      <stop offset="1" stop-color="#b7d3f5"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="22" flood-color="#1a3a6b" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g filter="url(#sh)">
    <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="48" fill="#f6f3ec"/>
  </g>
  <image x="${cx + pad}" y="${cy + pad}" width="${cw - pad * 2}" height="${ch - pad * 2}"
         preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${logoB64}"/>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("public/og-cover.png");
console.log("✅ public/og-cover.png (1200×630) — 찬양앱 형태(로고 카드), 연한 파랑 배경");
