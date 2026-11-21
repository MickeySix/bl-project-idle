// BL PROJECT IDLE · painel de dev (Mickey, 2026-11-21). Só contas da tabela admins, com login da conta + PIN em todo pedido.
// O PIN é conferido no banco (admin_pin_check: hash bcrypt, 5 erros travam 15 min). Toda ação que muda algo vai para admin_log.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const PIN_MSG: Record<string, string> = { errado: "PIN errado.", travado: "PIN errado demais. Tente de novo em 15 minutos.", nao_admin: "Esta conta não é admin.", sem_pin: "Crie o seu PIN primeiro." };
type J = Record<string, any>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, msg: "Método inválido." }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: au } = await sb.auth.getUser(token);
  const me = au?.user?.id; if (!me) return json({ ok: false, msg: "Sessão expirada. Entre de novo." }, 401);
  let b: J = {}; try { b = await req.json(); } catch { return json({ ok: false, msg: "Pedido inválido." }, 400); }
  const pin = String(b.pin || ""), act = String(b.acao || "");
  const { data: meP } = await sb.from("profiles").select("username").eq("user_id", me).maybeSingle();
  const meName = meP?.username || "?";

  if (act === "status") { // antes do PIN: só diz se a conta é admin e se já tem PIN (não conta erro)
    const { data: a } = await sb.from("admins").select("pin_hash").eq("user_id", me).maybeSingle();
    return json({ ok: true, pin: !a ? "nao_admin" : a.pin_hash ? "tem_pin" : "sem_pin" });
  }
  if (act === "criar_pin") { // primeiro acesso: só funciona se a conta é admin e ainda não tem PIN
    const { data: ok } = await sb.rpc("admin_pin_set", { p_uid: me, p_pin: pin });
    if (!ok) return json({ ok: false, msg: "Não deu: o PIN precisa ter 6 a 8 números, a conta precisa ser admin e não pode já ter PIN." }, 403);
    await sb.from("admin_log").insert({ admin: me, admin_nome: meName, acao: "criar_pin" });
    return json({ ok: true });
  }
  const { data: chk } = await sb.rpc("admin_pin_check", { p_uid: me, p_pin: pin });
  if (chk !== "ok") return json({ ok: false, pin: chk, msg: PIN_MSG[String(chk)] || "Acesso negado." }, 403);

  const log = (acao: string, alvo: string | null, detalhe: J = {}) => sb.from("admin_log").insert({ admin: me, admin_nome: meName, acao, alvo, detalhe });
  const findUser = async (u: string) => { const { data } = await sb.from("profiles").select("user_id, username, banido, created_at").eq("username", String(u || "").trim().toLowerCase()).maybeSingle(); return data; };

  switch (act) {
    case "entrar": return json({ ok: true, nome: meName });
    case "resumo": {
      const n = async (t: string, f?: (q: any) => any) => { let q = sb.from(t).select("*", { count: "exact", head: true }); if (f) q = f(q); const { count } = await q; return count || 0; };
      const dia = new Date(Date.now() - 864e5).toISOString();
      return json({ ok: true, contas: await n("profiles"), banidos: await n("profiles", (q) => q.eq("banido", true)), ativos24h: await n("saves", (q) => q.gte("updated_at", dia)), alertas24h: await n("alertas", (q) => q.gte("em", dia)) });
    }
    case "alertas": {
      const { data } = await sb.from("alertas").select("id, usuario, tipo, detalhe, bloqueado, em").order("em", { ascending: false }).limit(Math.min(200, Number(b.n) || 60));
      return json({ ok: true, lista: data || [] });
    }
    case "jogador": {
      const p = await findUser(b.usuario); if (!p) return json({ ok: false, msg: "Jogador não encontrado." });
      const { data: s } = await sb.from("saves").select("state, diamonds, rev, updated_at").eq("user_id", p.user_id).maybeSingle();
      const st: J = (s && s.state) || {};
      const roster = (Array.isArray(st.roster) ? st.roster : []).concat(Array.isArray(st.offRoster) ? st.offRoster : []);
      const { data: al } = await sb.from("alertas").select("tipo, em").eq("user_id", p.user_id).order("em", { ascending: false }).limit(10);
      return json({ ok: true, usuario: p.username, banido: !!p.banido, criado: p.created_at, visto: s?.updated_at || null, diamantes: s?.diamonds || 0,
        nome: st.name || null, nivel: st.account?.level || 0, gold: st.gold || 0, vip: !!st.vip, jogadores: roster.length,
        melhores: roster.map((x: J) => ({ nome: x.name, raridade: x.rarity, shiny: !!x.shiny, nivel: x.level })).sort((a: J, c: J) => (c.nivel || 0) - (a.nivel || 0)).slice(0, 8),
        alertas: al || [] });
    }
    case "banir": case "desbanir": {
      const p = await findUser(b.usuario); if (!p) return json({ ok: false, msg: "Jogador não encontrado." });
      await sb.from("profiles").update({ banido: act === "banir" }).eq("user_id", p.user_id);
      await log(act, p.username, { motivo: String(b.motivo || "").slice(0, 200) });
      return json({ ok: true, banido: act === "banir" });
    }
    case "diamantes": {
      const p = await findUser(b.usuario), d = Math.trunc(Number(b.delta) || 0);
      if (!p) return json({ ok: false, msg: "Jogador não encontrado." });
      if (!d || Math.abs(d) > 100000) return json({ ok: false, msg: "Quantidade inválida (de -100000 a 100000, sem zero)." });
      const { data: v } = await sb.rpc("admin_diamonds", { p_uid: p.user_id, p_delta: d, p_reason: `painel:${meName}:${String(b.motivo || "").slice(0, 80)}` });
      if (v === null || v === undefined) return json({ ok: false, msg: "Esse jogador ainda não tem save." });
      await log("diamantes", p.username, { delta: d, saldo: v, motivo: String(b.motivo || "").slice(0, 200) });
      return json({ ok: true, saldo: v });
    }
    case "gold": {
      const p = await findUser(b.usuario), v = Math.trunc(Number(b.valor));
      if (!p) return json({ ok: false, msg: "Jogador não encontrado." });
      if (!isFinite(v) || v < 0 || v > 1e9) return json({ ok: false, msg: "Gold inválido (0 a 1.000.000.000)." });
      const { data: s } = await sb.from("saves").select("state").eq("user_id", p.user_id).maybeSingle();
      const { data: ok } = await sb.rpc("admin_set_num", { p_uid: p.user_id, p_path: ["gold"], p_val: v });
      if (!ok) return json({ ok: false, msg: "Esse jogador ainda não tem save." });
      await log("gold", p.username, { antes: s?.state?.gold ?? null, agora: v, motivo: String(b.motivo || "").slice(0, 200) });
      return json({ ok: true, gold: v });
    }
    case "limites": {
      const { data } = await sb.from("limites").select("chave, valor, nota").order("chave");
      return json({ ok: true, lista: data || [] });
    }
    case "limite": {
      const k = String(b.chave || ""), v = Number(b.valor);
      if (!/^[a-z0-9_]{2,40}$/.test(k) || !isFinite(v) || v < 0) return json({ ok: false, msg: "Valor inválido." });
      const { data: old } = await sb.from("limites").select("valor").eq("chave", k).maybeSingle();
      if (!old) return json({ ok: false, msg: "Esse limite não existe." });
      await sb.from("limites").update({ valor: v }).eq("chave", k);
      await log("limite", k, { antes: old.valor, agora: v });
      return json({ ok: true });
    }
    case "log": {
      const { data } = await sb.from("admin_log").select("admin_nome, acao, alvo, detalhe, em").order("em", { ascending: false }).limit(100);
      return json({ ok: true, lista: data || [] });
    }
  }
  return json({ ok: false, msg: "Ação desconhecida." }, 400);
});
