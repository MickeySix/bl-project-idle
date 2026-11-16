// BL PROJECT IDLE · chance de Diamante numa vitória, sorteada no servidor (no máximo 1 sorteio a cada DROP_GAP_S segundos).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const DROP_CHANCE = 0.002, DROP_N = 1, DROP_GAP_S = 40; // igual a C.DIAMOND_DROP do config.js (v687)
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: au } = await sb.auth.getUser(token);
  const uid = au?.user?.id; if (!uid) return json({ ok: false }, 401);
  const { data, error } = await sb.rpc("diamond_drop", { p_uid: uid, p_chance: DROP_CHANCE, p_n: DROP_N, p_gap_s: DROP_GAP_S });
  const r = Array.isArray(data) ? data[0] : data;
  if (error || !r) return json({ ok: false }, 500);
  return json({ ok: true, got: r.got, diamonds: r.diamonds });
});
