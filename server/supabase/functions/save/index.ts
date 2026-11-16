// BL PROJECT IDLE · grava o save do jogador logado. Diamantes: o servidor manda. v713/v714: valores e saltos impossíveis são barrados (check.ts + save_game_v3, tabelas limites e alertas).
// O navegador manda quanto GASTOU desde o último save (spent); o valor de diamantes do save é ignorado.
// Ganhar diamante só pela função "diamante" ou por compra (Pix, a fazer).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { check, goldExtra, PADRAO } from "./check.ts";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const MAX_BYTES = 3_000_000;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: au } = await sb.auth.getUser(token);
  const uid = au?.user?.id; if (!uid) return json({ ok: false, msg: "Sessão expirada. Entre de novo." }, 401);
  const raw = await req.text(); if (raw.length > MAX_BYTES) return json({ ok: false, msg: "Save grande demais." }, 413);
  let body: { state?: Record<string, unknown>; rev?: number; spent?: number } = {};
  try { body = JSON.parse(raw); } catch { return json({ ok: false, msg: "Pedido inválido." }, 400); }
  const st = body.state; if (!st || typeof st !== "object" || Array.isArray(st)) return json({ ok: false, msg: "Save inválido." }, 400);
  const spent = Math.max(0, Math.floor(Number((body as { spent?: number }).spent) || 0));
  // v714: confere jogadores, itens, baús, consumíveis, habilidades e Game Pass contra o último save aceito
  const [{ data: row }, { data: lim }, { data: prof }] = await Promise.all([
    sb.from("saves").select("state, rev, updated_at").eq("user_id", uid).maybeSingle(),
    sb.from("limites").select("chave, valor"),
    sb.from("profiles").select("username").eq("user_id", uid).maybeSingle(),
  ]);
  const L: Record<string, number> = { ...PADRAO }; (lim || []).forEach((x: { chave: string; valor: number }) => { L[x.chave] = Number(x.valor); });
  const prev = row && row.state ? row.state : null;
  if (prev && Number(body.rev) !== row!.rev) return json({ ok: false, conflict: true, rev: row!.rev, msg: "Este save foi alterado em outra aba ou aparelho." }, 409);
  const secs = row ? Math.min(86400, Math.max(0, (Date.now() - Date.parse(row.updated_at)) / 1000)) : 0;
  let bad = null; try { bad = check(prev, st, secs, spent, L); } catch (e) { bad = { tipo: "save_quebrado", detalhe: { erro: String(e) } }; }
  if (bad) {
    await sb.from("alertas").insert({ user_id: uid, usuario: prof?.username || null, tipo: bad.tipo, detalhe: { ...bad.detalhe, segundos: Math.round(secs), gasto: spent }, bloqueado: true });
    return json({ ok: false, blocked: bad.tipo, msg: "Movimento estranho bloqueado: o save voltou para o último válido." }, 422);
  }
  const { data, error } = await sb.rpc("save_game_v3", { p_uid: uid, p_state: st, p_rev: Number(body.rev) || 0, p_spent: spent, p_gold_extra: goldExtra(prev, st, L) });
  const r = Array.isArray(data) ? data[0] : data;
  if (error || !r) return json({ ok: false, msg: "Não deu para salvar agora." }, 500);
  if (!r.ok && r.bloqueio === "banido") return json({ ok: false, banned: true, msg: "Conta bloqueada." }, 403);
  if (!r.ok && r.bloqueio) return json({ ok: false, blocked: r.bloqueio, msg: "Movimento estranho bloqueado: o save voltou para o último válido." }, 422); // v713: anti-trapaça (tabela alertas)
  if (!r.ok) return json({ ok: false, conflict: true, rev: r.rev, msg: "Este save foi alterado em outra aba ou aparelho." }, 409);
  return json({ ok: true, rev: r.rev, diamonds: r.diamonds });
});
