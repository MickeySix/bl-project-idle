// BL PROJECT IDLE · contas (protótipo)
// As contas ficam só neste navegador (localStorage), até o jogo ter um servidor de verdade.
// Cada conta tem o próprio save: blpi_save_v1:<usuário>. A senha é guardada como hash simples,
// o que NÃO é seguro: serve só para separar os saves de quem divide o mesmo computador.
window.BL = window.BL || {};
(function () {
  const KEY = "blpi_accounts", SESSION = "blpi_session", LEGACY_SAVE = "blpi_save_v1";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { users: {} }; } catch (e) { return { users: {} }; } };
  const write = (db) => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
  const norm = (u) => String(u || "").trim().toLowerCase();
  // hash simples (FNV-1a com sal e várias voltas): só para não guardar a senha em texto puro
  function hash(user, pass) {
    let h = 2166136261 >>> 0; const s = `blpi:${user}:${pass}`;
    for (let r = 0; r < 64; r++) for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i) + r; h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(16);
  }
  const USER_RE = /^[a-z0-9_.]{3,16}$/;

  BL.Accounts = {
    saveKey: (user) => `${LEGACY_SAVE}:${norm(user)}`,
    // O save antigo (de antes das contas) vira uma conta sem senha com o nome do jogador
    migrateLegacy() {
      let raw = null; try { raw = localStorage.getItem(LEGACY_SAVE); } catch (e) {}
      if (!raw) return null;
      const db = read();
      let base = "jogador";
      try { base = norm(JSON.parse(raw).name).replace(/[^a-z0-9_.]/g, "").slice(0, 16) || "jogador"; } catch (e) {}
      if (base.length < 3) base = (base + "jogador").slice(0, 16);
      let user = base, n = 2;
      while (db.users[user]) user = (base.slice(0, 14) + n++).slice(0, 16);
      db.users[user] = { pass: null, created: Date.now(), migrated: true };
      write(db);
      try { localStorage.setItem(this.saveKey(user), raw); localStorage.removeItem(LEGACY_SAVE); } catch (e) {}
      return user;
    },
    create(u, p) {
      const user = norm(u), db = read();
      if (!USER_RE.test(user)) return { ok: false, msg: "O usuário precisa de 3 a 16 caracteres: letras, números, ponto ou _." };
      if (String(p || "").length < 4) return { ok: false, msg: "A senha precisa de pelo menos 4 caracteres." };
      if (db.users[user]) return { ok: false, msg: "Esse usuário já existe neste navegador. Use Entrar." };
      db.users[user] = { pass: hash(user, p), created: Date.now() };
      write(db); this.setSession(user);
      return { ok: true, user };
    },
    login(u, p) {
      const user = norm(u), db = read(), acc = db.users[user];
      if (!acc) return { ok: false, msg: "Usuário não encontrado neste navegador. Crie uma conta." };
      if (acc.pass === null) { // conta migrada sem senha: a senha digitada agora passa a valer
        if (String(p || "").length >= 4) { acc.pass = hash(user, p); write(db); }
      } else if (acc.pass !== hash(user, p)) return { ok: false, msg: "Senha incorreta." };
      this.setSession(user);
      return { ok: true, user };
    },
    needsPassword(u) { const acc = read().users[norm(u)]; return !!acc && acc.pass === null; },
    count() { return Object.keys(read().users).length; },
    session() { try { const u = localStorage.getItem(SESSION); return u && read().users[u] ? u : null; } catch (e) { return null; } },
    setSession(user) { try { localStorage.setItem(SESSION, user); } catch (e) {} },
    logout() { try { localStorage.removeItem(SESSION); } catch (e) {} },
    // v553 (Mickey): excluir a conta, o save e o histórico de partidas deste navegador
    remove(u) { const user = norm(u), db = read(); delete db.users[user]; write(db); try { localStorage.removeItem(this.saveKey(user)); localStorage.removeItem("blpi_matches:" + user); localStorage.removeItem("blpi_starter:" + user); if (localStorage.getItem(SESSION) === user) localStorage.removeItem(SESSION); } catch (e) {} },
  };
})();
