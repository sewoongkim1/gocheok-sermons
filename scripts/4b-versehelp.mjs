// 4-b단계: 암송구절 도우미 생성 — '쉬운 풀이' + '암송 기억법'
//   4-link 이후에 실행해야 한다(그때 memText/memRef가 채워짐).
//   구절 본문 + 그 주 설교 요약을 근거로 Claude가 생성 → sermons.json에 새김.
//   · easyExplain: 그 구절이 무슨 뜻인지 아이·어르신 눈높이로 쉽게 (설교 맥락 안에서)
//   · memoryTip  : 그 구절을 외우는 요령 (첫 글자·구조·연상 — 해석이 아니라 암기법)
// 사용법: ANTHROPIC_API_KEY=... node scripts/4b-versehelp.mjs [최대편수]
//
// 산출물 2개:
//   1) src/data/sermons.json          (다음 설교 추가 때 5-migrate 로 함께 올라감)
//   2) data/verse_help_update.sql     ← 지난 설교 백필용. 두 컬럼만 UPDATE 한다.
// ⚠️ 지난 설교 백필에는 5-migrate 를 쓰지 마세요. 그건 sermons.json 전체를 덮어쓰므로
//    DB에만 있는 conclusion·dailyMeditations 가 null 로 지워집니다. 위 SQL만 실행하세요.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

// .env 로드(단독 실행 시에도 키를 읽도록. add-local.mjs 경유면 이미 들어와 있음)
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const MODEL = process.env.SERMON_MODEL || "claude-opus-4-8";
const LIMIT = Number(process.argv[2] || 999);
const OUT = "src/data/sermons.json";
const SQL_OUT = "data/verse_help_update.sql";

// 달러 인용($태그$) — 본문에 같은 태그가 들어있으면 겹치지 않는 태그를 고른다.
const dq = (text) => {
  let tag = "H";
  while (String(text).includes(`$${tag}$`)) tag += "H";
  return `$${tag}$${text}$${tag}$`;
};

const client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 사용

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["easyExplain", "memoryTip"],
  properties: {
    easyExplain: { type: "string" },
    memoryTip: { type: "string" },
  },
};

const SYSTEM = `당신은 고척교회 성경암송 앱의 도우미 글을 쓰는 편집자입니다.
교인(초등학생부터 어르신까지)이 이번 주 암송구절을 **이해하고 외우도록** 돕는 짧은 글 두 개를 한국어 존댓말로 씁니다.

- easyExplain (쉬운 풀이): 이 구절이 무슨 뜻인지 **아주 쉬운 말**로 3~4문장(150~220자).
  어려운 신학용어·한자어를 쓰지 말고 일상의 말로 풀어 주세요. 구절 안의 핵심 단어 한둘을
  "여기서 '○○'은 …라는 뜻이에요" 식으로 짚어 주면 좋습니다. 반드시 **아래 설교의 맥락 안에서**
  풀이하고, 설교에 없는 해석이나 교리 주장을 새로 만들어내지 마세요.

- memoryTip (암송 기억법): 이 구절을 **외우는 요령** 2~3문장(100~160자).
  해석이 아니라 암기법입니다. 구절을 의미 덩어리로 끊어 읽는 법, 반복되는 구조·대구,
  첫 글자 따기, 장면을 그려보는 연상 중 이 구절에 **실제로 맞는 것**만 쓰세요.
  구절에 없는 단어를 지어내지 말고, 실제 본문 표현을 그대로 인용해 설명하세요.`;

const sermons = JSON.parse(readFileSync(OUT, "utf8"));
let count = 0;
// 백필 SQL 은 "도우미를 가진 모든 편"으로 매번 통째로 다시 쓴다.
// (이번 실행에서 새로 만든 것만 담으면, 이미 생성된 편이 SQL에서 빠져 버린다.)
const withHelp = () => sermons.filter((x) => x.easyExplain && x.memoryTip);

for (const s of sermons) {
  if (count >= LIMIT) break;
  if (!s.memText) continue;                 // 암송구절이 연결된 설교만
  if (s.easyExplain && s.memoryTip) continue; // 이미 있으면 건너뜀

  const ctx = [
    `[암송구절] ${s.memRef || ""}\n${s.memText}`,
    `[그 주 설교] ${s.title || ""}`,
    s.scripture ? `본문: ${s.scripture}` : "",
    s.summary ? `요약: ${s.summary}` : "",
    Array.isArray(s.points) && s.points.length
      ? `핵심:\n${s.points.map((p) => `- ${p.heading}: ${p.body}`).join("\n")}`
      : "",
    s.conclusion ? `맺음말: ${s.conclusion}` : "",
  ].filter(Boolean).join("\n\n");

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: ctx }],
    });
    const help = JSON.parse(res.content.find((b) => b.type === "text").text);
    s.easyExplain = help.easyExplain;
    s.memoryTip = help.memoryTip;
    count++;
    console.log(`  ✓ ${s.id} ${(s.memRef || "").padEnd(12)} ${s.title || ""}`);
    // 중단 대비 즉시 저장(두 산출물 모두)
    writeFileSync(OUT, JSON.stringify(sermons, null, 2), "utf8");
    writeFileSync(SQL_OUT, buildSql(withHelp()), "utf8");
  } catch (e) {
    console.log(`  ✗ ${s.id} 실패: ${e.message}`);
  }
}

// 새로 만든 게 없어도(전부 이미 있어도) SQL은 항상 최신 전체본으로 다시 쓴다.
writeFileSync(SQL_OUT, buildSql(withHelp()), "utf8");

// 두 컬럼만 UPDATE — 다른 필드는 절대 건드리지 않는다.
function buildSql(list) {
  return [
    "-- 지난 설교 암송 도우미 백필 (scripts/4b-versehelp.mjs 자동 생성)",
    "-- Supabase SQL Editor 에 붙여넣어 실행하세요. easy_explain·memory_tip 두 컬럼만 바꿉니다.",
    "alter table public.sermons add column if not exists easy_explain text;",
    "alter table public.sermons add column if not exists memory_tip   text;",
    "",
    ...list.map((s) =>
      `update public.sermons set\n` +
      `  easy_explain = ${dq(s.easyExplain)},\n` +
      `  memory_tip   = ${dq(s.memoryTip)}\n` +
      `where id = '${s.id}';   -- ${s.memRef || ""} ${s.title || ""}`),
    "",
    "select count(*) as 도우미_보유_편수 from public.sermons where easy_explain is not null;",
    "",
  ].join("\n");
}

console.log(`\n완료: ${count}편에 쉬운 풀이·기억법 생성`);
console.log(`  · ${OUT}      (다음 설교 추가 시 함께 반영)`);
console.log(`  · ${SQL_OUT}  ← 지난 설교 백필: 이 SQL을 Supabase에서 실행하세요`);
