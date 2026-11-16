// BL PROJECT IDLE · conta online (Supabase), v712
// Login de verdade e save na nuvem. O servidor guarda os Diamantes: o navegador só informa quanto GASTOU
// desde o último save (spent) e nunca consegue aumentar o saldo. A chance de Diamante na vitória é sorteada no servidor.
// Sem servidor (arquivo local, página do claude.ai, internet fora) o jogo cai no modo local de antes (accounts.js).
// Servidor: /mnt/project-files/server/supabase (tabelas saves/profiles/diamond_log, funções conta, save, diamante).
window.BL = window.BL || {};
(function () {
  const CFG = (BL.CONFIG && BL.CONFIG.ONLINE) || {};
  const URL = CFG.url, KEY = CFG.key, SKEY = "blpi_online";
  const readS = () => { try { return JSON.parse(localStorage.getItem(SKEY)) || null; } catch (e) { return null; } };
  const writeS = (s) => { try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch (e) {} };
  const emailOf = (u) => `${u}@jogador.blprojectidle.com`;
  const norm = (u) => String(u || "").trim().toLowerCase();
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

  const O = BL.Online = {
    on: !!(CFG.on && URL && KEY),
    up: null, // null = ainda não testou; true/false depois do ping
    sess: readS(),
    async ping() {
      if (!O.on) return (O.up = false);
      try { const r = await withTimeout(fetch(`${URL}/auth/v1/health`, { headers: { apikey: KEY } }), 5000); O.up = r.ok; }
      catch (e) { O.up = false; }
      return O.up;
    },
    user() { return O.sess && O.sess.user; },
    async authCall(body, grant) {
      const r = await fetch(`${URL}/auth/v1/token?grant_type=${grant}`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      return { ok: r.ok, d };
    },
    keep(user, d) { O.sess = { user, access: d.access_token, refresh: d.refresh_token, exp: Date.now() + (d.expires_in || 3600) * 1000 }; writeS(O.sess); },
    async login(u, p) {
      const user = norm(u);
      if (!/^[a-z0-9_.]{3,16}$/.test(user)) return { ok: false, msg: "Usuário inválido." };
      const r = await O.authCall({ email: emailOf(user), password: String(p || "") }, "password");
      if (!r.ok) return { ok: false, msg: "Usuário ou senha incorretos." };
      O.keep(user, r.d); return { ok: true, user };
    },
    async create(u, p) {
      const r = await fetch(`${URL}/functions/v1/conta`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ user: norm(u), pass: String(p || "") }) });
      const d = await r.json().catch(() => ({ ok: false, msg: "Não deu para criar a conta agora." }));
      if (!d.ok) return d;
      return O.login(u, p);
    },
    logout() { O.sess = null; writeS(null); },
    async token() {
      const s = O.sess; if (!s) return null;
      if (Date.now() < s.exp - 60000) return s.access;
      const r = await O.authCall({ refresh_token: s.refresh }, "refresh_token").catch(() => ({ ok: false }));
      if (!r.ok) { O.logout(); return null; }
      O.keep(s.user, r.d); return O.sess.access;
    },
    async call(fn, body, keepalive) {
      const t = await O.token(); if (!t) return { ok: false, status: 401, msg: "Sessão expirada. Entre de novo." };
      try {
        const r = await fetch(`${URL}/functions/v1/${fn}`, { method: "POST", keepalive: !!keepalive, headers: { apikey: KEY, Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
        const d = await r.json().catch(() => ({}));
        return { ...d, status: r.status, ok: r.ok && d.ok !== false };
      } catch (e) { return { ok: false, status: 0, msg: "Sem conexão com o servidor." }; }
    },
    // lê o save da conta (só o próprio, pela regra do banco)
    async load() {
      const t = await O.token(); if (!t) return null;
      const r = await fetch(`${URL}/rest/v1/saves?select=state,rev,diamonds`, { headers: { apikey: KEY, Authorization: `Bearer ${t}` } });
      if (!r.ok) return null;
      const rows = await r.json().catch(() => []);
      return rows[0] || { state: null, rev: 0, diamonds: 0 };
    },
    save(state, rev, spent, keepalive) { return O.call("save", { state, rev, spent }, keepalive); },
    drop() { return O.call("diamante", {}); },
  };
})();
