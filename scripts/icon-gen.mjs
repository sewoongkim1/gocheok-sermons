// PWA/바로가기 아이콘 — 연한 파랑 배경 + '마크만'(고척교회 글자 없는 십자가). 찬양앱 아이콘과 동형
// 사용법: node scripts/icon-gen.mjs → public/icon-192.png, icon-512.png, apple-touch-icon.png, favicon-32.png
import sharp from "sharp";
import { existsSync, writeFileSync } from "node:fs";

const LOGO = "data/logo3.png";
if (!existsSync(LOGO)) {
  const r = await fetch("https://summer.onlybible.kr/logo3.png");
  writeFileSync(LOGO, Buffer.from(await r.arrayBuffer()));
}

// 1) 마크만 추출: 로고 상단 74% 크롭(아래 '고척교회' 글자 제거) + 여백 트림 (2단계)
const meta = await sharp(LOGO).metadata();
const cropped = await sharp(LOGO)
  .extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.74) })
  .png()
  .toBuffer();
const markBuf = await sharp(cropped).trim({ threshold: 10 }).png().toBuffer();
writeFileSync("data/mark.png", markBuf);

async function make(size, out, ratio = 0.6, radius = 0) {
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#dcebff"/><stop offset="1" stop-color="#b7d3f5"/></linearGradient></defs>
    ${radius
      ? `<rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>`
      : `<rect width="${size}" height="${size}" fill="url(#g)"/>`}
  </svg>`;
  const lw = Math.round(size * ratio);
  const mark = await sharp(markBuf).resize({ width: lw, height: lw, fit: "inside" }).png().toBuffer();
  await sharp(Buffer.from(bgSvg)).composite([{ input: mark, gravity: "center" }]).png().toFile(out);
  console.log("  ✓", out, `(${size}×${size})`);
}

await make(192, "public/icon-192.png");
await make(512, "public/icon-512.png");
await make(180, "public/apple-touch-icon.png", 0.6, 40);
await make(32, "public/favicon-32.png", 0.72);
console.log("✅ 아이콘 생성 완료 — 마크만, 연한 파랑 배경");
