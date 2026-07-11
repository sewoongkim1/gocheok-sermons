// 고척교회 말씀 아카이브 백엔드 (통합 프로젝트 xnomlgydifiqiybervtf)
// 배포: supabase functions deploy sermon --no-verify-jwt --project-ref xnomlgydifiqiybervtf
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const ADMIN = Deno.env.get("ADMIN_SECRET") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// DB row → 앱 형태(camelCase)
const toApp = (r: any) => ({
  id: r.id, title: r.title, date: r.svc_date || "", category: r.category,
  preacher: r.preacher, scripture: r.scripture || "", summary: r.summary || "",
  points: r.points || [], keyVerse: r.key_verse || null,
  questions: r.questions || [], tags: r.tags || [],
  audioScript: r.audio_script || "", audio: r.audio || undefined,
  memVerseNo: r.mem_verse_no ?? undefined, memRef: r.mem_ref ?? undefined, memText: r.mem_text ?? undefined,
});
// 앱 형태 → DB row(snake_case)
const toRow = (s: any) => ({
  id: s.id, title: s.title, svc_date: s.date || s.svc_date || null,
  category: s.category || "주일설교", preacher: s.preacher || "차동혁 위임목사",
  scripture: s.scripture || null, summary: s.summary || null,
  points: s.points || [], key_verse: s.keyVerse || s.key_verse || null,
  questions: s.questions || [], tags: s.tags || [],
  audio_script: s.audioScript || s.audio_script || null, audio: s.audio || null,
  mem_verse_no: s.memVerseNo ?? s.mem_verse_no ?? null,
  mem_ref: s.memRef ?? s.mem_ref ?? null, mem_text: s.memText ?? s.mem_text ?? null,
  hidden: !!s.hidden, updated_at: new Date().toISOString(),
});
const adminErr = (b: any) => (b?.secret === ADMIN && ADMIN ? "" : "인증 실패");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let b: any = {};
  try { b = await req.json(); } catch {}
  try {
    switch (b.action) {
      case "getSermons": {
        const { data, error } = await db.from("sermons")
          .select("*").eq("hidden", false).order("svc_date", { ascending: false });
        if (error) throw error;
        return json({ ok: true, sermons: (data || []).map(toApp) });
      }
      case "authCheck": {
        const e = adminErr(b); return json(e ? { ok: false, error: e } : { ok: true }, e ? 403 : 200);
      }
      case "adminList": {
        if (adminErr(b)) return json({ ok: false, error: "인증 실패" }, 403);
        const { data, error } = await db.from("sermons").select("*").order("svc_date", { ascending: false });
        if (error) throw error;
        return json({ ok: true, sermons: (data || []).map((r: any) => ({ ...toApp(r), hidden: r.hidden })) });
      }
      case "saveSermon": {
        if (adminErr(b)) return json({ ok: false, error: "인증 실패" }, 403);
        const { error } = await db.from("sermons").upsert(toRow(b.sermon), { onConflict: "id" });
        if (error) throw error;
        return json({ ok: true });
      }
      case "deleteSermon": {
        if (adminErr(b)) return json({ ok: false, error: "인증 실패" }, 403);
        const { error } = await db.from("sermons").delete().eq("id", b.id);
        if (error) throw error;
        return json({ ok: true });
      }
      case "importSermons": {
        if (adminErr(b)) return json({ ok: false, error: "인증 실패" }, 403);
        const rows = (b.sermons || []).map(toRow);
        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await db.from("sermons").upsert(rows.slice(i, i + 200), { onConflict: "id" });
          if (error) throw error;
        }
        return json({ ok: true, count: rows.length });
      }
      default:
        return json({ ok: false, error: "알 수 없는 action" }, 400);
    }
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
