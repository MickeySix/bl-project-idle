// BL PROJECT IDLE · criar conta online (usuário + senha). Público: não exige login.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const USER_RE = /^[a-z0-9_.]{3,16}$/;
const emailOf = (u: string) => `${u}@jogador.blprojectidle.com`;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, msg: "Método inválido." }, 405);
  let body: { user?: string; pass?: string } = {};
  try { body = await req.json(); } catch { return json({ ok: false, msg: "Pedido inválido." }, 400); }
  const user = String(body.user || "").trim().toLowerCase(), pass = String(body.pass || "");
  if (!USER_RE.test(user)) return json({ ok: false, msg: "O usuário precisa de 3 a 16 caracteres: letras, números, ponto ou _." });
  if (pass.length < 6 || pass.length > 72) return json({ ok: false, msg: "A senha precisa de 6 a 72 caracteres." });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: taken } = await sb.from("profiles").select("user_id").eq("username", user).maybeSingle();
  if (taken) return json({ ok: false, msg: "Esse usuário já existe. Use Entrar." });
  const { data, error } = await sb.auth.admin.createUser({ email: emailOf(user), password: pass, email_confirm: true, user_metadata: { username: user } });
  if (error || !data.user) return json({ ok: false, msg: /already/i.test(error?.message || "") ? "Esse usuário já existe. Use Entrar." : "Não deu para criar a conta agora. Tente de novo." });
  const id = data.user.id;
  const p = await sb.from("profiles").insert({ user_id: id, username: user });
  if (p.error) { await sb.auth.admin.deleteUser(id); return json({ ok: false, msg: "Esse usuário já existe. Use Entrar." }); }
  await sb.from("saves").insert({ user_id: id });
  return json({ ok: true, user });
});
