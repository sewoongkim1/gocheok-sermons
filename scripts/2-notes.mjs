// 2단계: 자막 → AI 설교노트(요약·3점·구절·질문·태그·오디오대본)
// 사용법: ANTHROPIC_API_KEY=... node scripts/2-notes.mjs [최대편수]
// 산출물: src/data/sermons.json (기존 항목 보존, id 기준 병합)
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MODEL = process.env.SERMON_MODEL || "claude-opus-4-8"; // 비용 줄이려면 claude-sonnet-5 / claude-haiku-4-5
const LIMIT = Number(process.argv[2] || 999);
const PREACHER = "차동혁 위임목사";
const SERIES = "차동혁목사 주일설교";
const OUT = "src/data/sermons.json";

const client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 사용

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["scripture", "summary", "points", "keyVerse", "questions", "tags", "audioScript", "dailyMeditations"],
  properties: {
    scripture: { type: "string" },
    summary: { type: "string" },
    points: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["heading", "body"],
        properties: { heading: { type: "string" }, body: { type: "string" } },
      },
    },
    keyVerse: {
      type: "object", additionalProperties: false,
      required: ["ref", "text"],
      properties: { ref: { type: "string" }, text: { type: "string" } },
    },
    questions: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    audioScript: { type: "string" },
    // 한 주(7일) 매일 다른 묵상 — 암송앱 '오늘의 묵상'이 요일별로 하나씩 보여준다.
    dailyMeditations: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["heading", "message", "question"],
        properties: {
          heading: { type: "string" },
          message: { type: "string" },
          question: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM = `당신은 고척교회 설교를 정리하는 편집자입니다. 입력은 유튜브 자동자막이라 고유명사가 일부 깨져 있을 수 있으니 문맥으로 교정하세요.
다음을 한국어로 작성합니다:
- scripture: 본문 성경구절 (예: "누가복음 5:1-11")
- summary: 설교 전체를 관통하는 한 줄 요약
- points: 핵심 3~4점. 각 heading(소제목)과 body(2~3문장 설명)
- keyVerse: 설교의 핵심 성구 하나 (ref=장절, text=본문)
- questions: 삶에 적용할 질문 3개
- tags: 주제 태그 5~6개
- audioScript: 귀로 듣기 좋은 3분 나레이션 대본(약 850~1000자, 서술형 존댓말). "고척교회 말씀 아카이브" 같은 앱/채널 소개 문구로 시작하지 말고, 바로 오늘의 설교 제목·본문 소개로 자연스럽게 시작(예: "오늘의 설교는 …입니다. 본문은 …"). 화면 텍스트를 그대로 읽지 말고 음성 원고로.
- dailyMeditations: 이 설교로 한 주 동안 **매일 다르게** 묵상할 **정확히 7개**. 각 항목은
  heading(짧은 제목 6~14자), message(존댓말 묵상글 2~3문장·100~150자), question(삶에 적용할 질문 1개).
  순서는 주일→토요일의 흐름으로: 1번은 설교를 여는 도입, 2~6번은 핵심을 날마다 다른 각도로,
  7번은 한 주를 마무리하는 격려. 설교에 실제로 나온 내용·예화만 쓰고 매일 내용이 겹치지 않게 하세요.
강조: summary, 각 point의 body, 각 dailyMeditation의 message에서 가장 핵심이 되는 문구를 **굵게**(양쪽에 별표 두 개, 예: **핵심 문구**) 표시하세요. 한 항목에 한두 군데만, 남용하지 마세요. audioScript(음성 대본)에는 별표를 넣지 마세요.
설교 내용에 충실하고, 없는 내용을 지어내지 마세요.`;

const meta = JSON.parse(readFileSync("data/meta.json", "utf8"));
const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const byId = new Map(existing.map((s) => [s.id, s]));

let count = 0;
for (const m of meta) {
  if (count >= LIMIT) break;
  if (byId.get(m.id)?.summary) { console.log(`  건너뜀(이미 있음): ${m.id}`); continue; }
  const tPath = `data/transcripts/${m.id}.txt`;
  if (!existsSync(tPath)) { console.log(`  건너뜀(자막 없음): ${m.id}`); continue; }
  const transcript = readFileSync(tPath, "utf8");
  if (transcript.length < 300) { console.log(`  건너뜀(자막 짧음): ${m.id}`); continue; }

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2500,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: `제목: ${m.title}\n\n[설교 자막]\n${transcript}` }],
    });
    const note = JSON.parse(res.content.find((b) => b.type === "text").text);
    byId.set(m.id, {
      id: m.id, title: m.title, preacher: PREACHER, series: SERIES, date: m.date || "",
      ...note,
    });
    count++;
    console.log(`  ✓ ${m.id} (${count}) ${m.title}`);
    // 진행 중에도 저장(중단 대비)
    writeFileSync(OUT, JSON.stringify([...byId.values()], null, 2), "utf8");
  } catch (e) {
    console.log(`  ✗ ${m.id} 실패: ${e.message}`);
  }
}
console.log(`\n완료: ${count}편 생성 → ${OUT} (총 ${byId.size}편)`);
