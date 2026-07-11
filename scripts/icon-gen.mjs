// PWA/바로가기 아이콘 생성 — 연한 파랑 배경 + 로고
// 사용법: node scripts/icon-gen.mjs → public/icon-192.png, icon-512.png, apple-touch-icon.png, favicon-32.png
import sharp from "sharp";
import { readFileSync, existsSync, writeFileSync } from "node:fs";

const LOGO = "data/logo3.png";
if (!existsSync(LOGO)) {
  const r = await fetch("https://summer.onlybible.kr/logo3.png");
  writeFileSync(LOGO, Buffer.from(await r.arrayBuffer()));
}
const logoB64 = readFileSync(LOGO).toString("base64");

async function make(size, out, logoRatio = 0.64, radius = 0) {
  const s = size;
  const lw = Math.round(s * logoRatio);
  const off = Math.round((s - lw) / 2);
  const rx = radius ? `<rect width="${s}" height="${s}" rx="${radius}" fill="url(#bg)"/>` :
    `<rect width="${s}" height="${s}" fill="url(#bg)"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#dcebff"/><stop offset="1" stop-color="#b7d3f5"/>
    </linearGradient></defs>
    ${rx}
    <image x="${off}" y="${off}" width="${lw}" height="${lw}" href="data:image/png;base64,${logoB64}"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("  ✓", out, `(${s}×${s})`);
}

await make(192, "public/icon-192.png");
await make(512, "public/icon-512.png");
await make(180, "public/apple-touch-icon.png", 0.66, 40); // iOS는 자체 라운딩하지만 살짝
await make(32, "public/favicon-32.png", 0.72);
console.log("✅ 아이콘 생성 완료 (연한 파랑 배경)");
