// node --test scripts/job-lib.test.mjs — 준비물 없이(node 만)
import { test } from "node:test";
import assert from "node:assert/strict";
import { modeOf, anonKeyOf, vidOf, mergeMeta, adoptSermon, noteOf, PROD_API, DEV_API } from "./job-lib.mjs";

test("주소는 두 개만 안다", () => {
  assert.equal(modeOf(PROD_API), "prod");
  assert.equal(modeOf(DEV_API), "dev");
  assert.equal(modeOf("https://evil.example/functions/v1/api"), null);
  assert.equal(modeOf(undefined), null);
  assert.notEqual(anonKeyOf(PROD_API), anonKeyOf(DEV_API));
});

test("영상 번호 — 여러 꼴", () => {
  for (const u of ["https://www.youtube.com/watch?v=9YgDMXP77NE", "https://youtu.be/9YgDMXP77NE?si=abc",
    "https://www.youtube.com/live/9YgDMXP77NE", "https://youtube.com/shorts/9YgDMXP77NE",
    "https://www.youtube.com/watch?feature=share&v=9YgDMXP77NE", "9YgDMXP77NE"]) assert.equal(vidOf(u), "9YgDMXP77NE", u);
  assert.equal(vidOf(""), "");
  assert.equal(vidOf("https://example.com/watch?v=short"), "");
  assert.equal(vidOf("https://www.youtube.com/watch?v=9YgDMXP77NEX"), "");   // 12자로 잘못 쓴 것은 거른다
});

test("meta — 같은 영상은 한 줄, 날짜 최신순", () => {
  const meta = [{ id: "OLDOLDOLD01", title: "옛", date: "2026-09-13" }, { id: "9YgDMXP77NE", title: "틀린", date: "" }];
  const job = { video_id: "9YgDMXP77NE", title: "새 제목", svc_date: "2026-09-20", category: "주일설교", preacher: "초청 목사" };
  const out = mergeMeta(meta, job);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { id: "9YgDMXP77NE", title: "새 제목", date: "2026-09-20", category: "주일설교", preacher: "초청 목사" });
});

test("다시 시도 — DB 에 있던 설교가 sermons.json 을 이긴다", () => {
  const out = adoptSermon([{ id: "A", summary: "로컬" }, { id: "B" }], { id: "A", summary: "DB" });
  assert.equal(out.length, 2);
  assert.equal(out.find((s) => s.id === "A").summary, "DB");
  assert.equal(noteOf(out, "A").summary, "DB");
  assert.equal(noteOf(out, "B"), null);   // 요약 없는 것은 노트가 아니다
});
