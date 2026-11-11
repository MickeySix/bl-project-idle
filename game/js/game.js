// BL PROJECT IDLE · loop idle, progressão, recompensas e salvamento
window.BL = window.BL || {};

(function () {
  const C = BL.CONFIG;
  const U = BL.util;
  const SAVE_KEY = "blpi_save_v1";
  const DEV_KEY = "blpi_dev";
  const POS_ORDER = { atacante: 0, alaof: 1, aladef: 2, zagueiro: 3 };
  const listeners = {};

  const G = {
    state: null,
    match: null,
    enemy: null,
    enemies: [],
    devFill: [],
    log: [],
    dev: (() => { try { return localStorage.getItem(DEV_KEY) === "1"; } catch (e) { return false; } })(),
    on(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    emit(type, data) { (listeners[type] || []).forEach((fn) => fn(data)); },

    // ---------- salvar ----------
    load() {
      this.state = null; this.match = null; this.enemy = null; this.log = [];
      try { const raw = localStorage.getItem(this.saveKey()); if (raw) this.state = JSON.parse(raw); } catch (e) { this.state = null; }
      // v142: formações personalizadas (antigo quadro tático) foram apagadas
      const s = this.state;
      // v349 (Mickey): jogador sem sprite fica fora do jogo; vai para s.offRoster e volta sozinho quando o personagem ganhar sprite
      if (s && s.roster) {
        const on = (p) => (C.ACTIVE_CHARS || []).includes(p.charId), off = (s.offRoster || []).concat(s.roster.filter((p) => !on(p)));
        s.roster = s.roster.filter(on).concat(off.filter(on)); s.offRoster = off.filter((p) => !on(p));
        s.roster.forEach((p) => { const pos = (BL.MICKEY_POS || {})[p.charId]; if (pos) p.position = pos; }); // v426: posições oficiais do Mickey valem também para quem já está no elenco
        if (!s.roster.length) s.roster.push(BL.makePlayer(U.pick(BL.CHARACTERS.map((c) => c.id)), { level: 1 }));
        const has = (u) => s.roster.some((p) => p.uid === u);
        s.active = (s.active || []).filter(has); if (!s.active.length) s.active = [s.roster[0].uid];
        if (s.bench) s.bench = s.bench.filter(has);
        if (Array.isArray(s.teamSets)) s.teamSets = s.teamSets.map((t) => (t || []).filter(has));
      }
      if (s) { // v473: o Acessório virou Camisa e os itens antigos viraram os novos (BL.ITEM_ALIAS)
        const A = BL.ITEM_ALIAS || {}, fix = (id) => (id && (BL.anyItem(id) ? id : A[id])) || null;
        s.inventory = (s.inventory || []).map(fix).filter(Boolean);
        (s.roster || []).concat(s.offRoster || []).forEach((p) => { const it = p.items || (p.items = {}); if ("acessorio" in it) { it.camisa = it.camisa || it.acessorio; delete it.acessorio; } Object.keys(BL.ITEM_SLOTS).forEach((k) => { it[k] = fix(it[k]); if (it[k] && (!BL.ITEM_BY_ID[it[k]] || BL.ITEM_BY_ID[it[k]].slot !== k)) { s.inventory.push(it[k]); it[k] = null; } }); });
        if (!Array.isArray(s.mgrEq)) s.mgrEq = [];
        while (s.mgrEq.length < C.MGR_SLOTS) s.mgrEq.push(null);
        s.mgrEq = s.mgrEq.slice(0, C.MGR_SLOTS).map((id) => (BL.MGR_BY_ID[id] ? id : null));
      }
      if (s) this.stealGift();
      if (s && s.customTactics) { const ids = s.customTactics.map((c) => c.id); delete s.customTactics; if (s.tactics && ids.includes(s.tactics[4])) s.tactics[4] = C.TACTICS[4][0].id; this.save(); }
      return this.state;
    },
    // Cada conta tem o próprio save (contas locais do navegador, ver accounts.js)
    account: null,
    saveKey() { return this.account ? BL.Accounts.saveKey(this.account) : SAVE_KEY; },
    save() { if (!this.state) return; try { localStorage.setItem(this.saveKey(), JSON.stringify(this.state)); } catch (e) { /* sem armazenamento: segue sem salvar */ } },
    reset() {
      try { localStorage.removeItem(this.saveKey()); } catch (e) {}
      this.state = null; this.match = null; this.enemy = null; this.log = [];
      this.emit("reset");
    },

    newGame(name, starter, tag) {
      this.state = {
        version: 1, name: name || "Jogador", teamTag: tag || "", created: Date.now(),
        training: !(C.PROLOGUE && C.PROLOGUE.noTraining), // v558: com o Prólogo o jogo já começa na 1-1; antes todo jogo novo começa no modo treino; o farm só começa quando o jogador vai para a 1-1
        account: { level: 1, xp: 0 }, gold: 0,
        roster: [starter], active: [starter.uid],
        inventory: [], chests: [],
        progress: { map: 0, stage: 1, runSteals: 0, runs: 0, bossWins: 0, repeat: false, unlocked2x2: false },
        analyzer: this.freshAnalyzer(),
        settings: { speed: 1, autoGatorade: true },
      };
      this.stealGift();
      this.save();
    },
    freshAnalyzer() { return { since: Date.now(), matches: 0, wins: 0, losses: 0, xp: 0, goldGained: 0, goldSpent: 0, goalsFor: 0, goalsAgainst: 0, steals: 0, chests: 0 }; },

    // ---------- consultas ----------
    teamName() { return this.state.teamName || this.state.name; }, // v288: sem " FC" automático
    // Tag do time (até 4 letras). Saves antigos sem Tag usam as 3 primeiras letras do nome.
    teamTag() { return this.state.teamTag || BL.cleanTag(this.state.name).slice(0, 3) || "BL"; },
    renameCost() { return (this.state.teamRenames || 0) < C.TEAM_RENAME_FREE ? 0 : C.TEAM_RENAME_DIAMONDS; },
    // Troca o nome e/ou a Tag do time: a primeira troca é grátis, as outras custam Diamantes
    setTeamName(v, t) {
      const s = this.state, name = v.trim().slice(0, 22), tag = BL.cleanTag(t ?? this.teamTag());
      if (name.length < C.NAME_MIN) return { ok: false, msg: `O nome do time precisa de pelo menos ${C.NAME_MIN} caracteres.` };
      if (!tag) return { ok: false, msg: `A Tag precisa de 1 a ${C.TEAM_TAG_MAX} letras.` };
      if (name === this.teamName() && tag === this.teamTag()) return { ok: false, msg: "Nada mudou: esse já é o nome e a Tag do seu time." };
      const cost = this.renameCost();
      if ((s.diamonds || 0) < cost) return { ok: false, msg: `Faltam Diamantes: precisa de ${cost}.` };
      s.diamonds = (s.diamonds || 0) - cost;
      s.teamName = name; s.teamTag = tag; s.teamRenames = (s.teamRenames || 0) + 1;
      this.save(); this.emit("teamName");
      return { ok: true, msg: cost ? `Time atualizado por ${cost} Diamantes.` : "Nome e Tag do time salvos." };
    },
    get map() { return C.MAPS[this.state.progress.map]; },
    // Time em campo: os escalados, completando com o elenco. No modo dev, completa com jogadores de teste.
    activePlayers() {
      const s = this.state, size = this.map.size, ros = s.roster.filter((p) => !this.isAway(p.uid)); // v158: quem está em expedição fica fora (v181: e quem está no Boss)
      if (s.training) { // treino: quem você escalou, de 1 a 4, sem completar
        const t = s.active.map((u) => ros.find((p) => p.uid === u)).filter(Boolean).slice(0, C.TRAINING_MAX);
        return t.length ? t : [ros[0] || s.roster[0]];
      }
      const list = s.active.map((u) => ros.find((p) => p.uid === u)).filter(Boolean).slice(0, size);
      for (const p of ros) if (list.length < size && !list.includes(p)) list.push(p);
      if (this.dev) {
        const lv = list[0]?.level || 1;
        for (let i = 0; list.length < size; i++) {
          if (!this.devFill[i]) { const ids = BL.CHARACTERS.map((c) => c.id); const p = BL.makePlayer(U.pick(ids), { level: lv }); p.temp = true; this.devFill[i] = p; }
          list.push(this.devFill[i]);
        }
      }
      return list;
    },
    mapUnlocked(i) { return this.dev || (this.state.roster.filter((p) => !this.isAway(p.uid)).length >= C.MAPS[i].size && (i < 4 || this.mapEverCleared(i - 1))); }, // v536: mapas 5 a 10 abrem vencendo o Boss do anterior
    mapEverCleared(i) { const c = this.state.progress.cleared || {}; return C.DIFFICULTIES.some((d, k) => c[this.clearKey(i, k)]); },
    tactics(size = this.map.size) {
      const base = C.TACTICS[size] || C.TACTICS[1];
      return base;
    },
    tactic() {
      const list = this.tactics(), id = (this.state.tactics || {})[this.map.size];
      return list.find((t) => t.id === id) || list[0];
    },
    setTactic(id) {
      const s = this.state; s.tactics = s.tactics || {};
      s.tactics[this.map.size] = id; this.save(); this.emit("resources");
    },
    // v137 · tendência do adversário: cada nome de time tem uma formação preferida (fixa), que ele joga na maioria das vezes
    stockTactics() { return this.tactics(); },
    prefTactic(team) {
      const list = this.stockTactics(); let h = 0;
      for (const ch of String(team)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      return list[h % list.length];
    },
    pickEnemyTactic(team) {
      const pref = this.prefTactic(team), rest = this.stockTactics().filter((t) => t !== pref);
      return Math.random() < C.ENEMY_PREF_CHANCE || !rest.length ? pref : U.pick(rest);
    },
    tacticHint(t) {
      if (t.style && C.STYLE_HINT[t.style]) return U.pick(C.STYLE_HINT[t.style]);
      const n = this.map.size;
      return t.atk >= n ? "vai todo mundo para o ataque" : t.atk === 0 ? "se fecha atrás e espera" : "joga equilibrado, com gente atacando e defendendo";
    },
    // a precisão vem do nível do técnico (nível da conta): abaixo do Nv 10, metade das vezes a leitura sai vaga
    hintFor(team) {
      const lv = this.state.account.level, pref = this.prefTactic(team);
      const cl = this.coachLv((this.coach() || {}).id); // v598 (Mickey): a dica melhora com a raridade do técnico (0 Comum ... 5 Despertado)
      if (!this.coachReadsClear() && cl === 0 && Math.random() < 0.5) return U.pick(["ainda é imprevisível para o seu técnico", "muda muito de estilo de um jogo para outro", "tem um estilo que seu técnico ainda não leu"]);
      if (this.map.size !== 4 || cl === 0 || !C.ATK_PRESETS) return this.tacticHint(pref);
      const sure = cl >= 4, tac = sure ? this.enemyTactic || pref : pref, A = C.ATK_PRESETS.find((p) => p.id === (sure ? this.enemyAtk : this.prefAtk(team))) || C.ATK_PRESETS[2];
      const base = `${this.tacticHint(tac)} e ${A.hint}`; if (cl <= 2) return base;
      const ctr = C.TACTICS[4].find((t) => t.type === A.beatenBy), bad = C.ATK_PRESETS.find((p) => p.beatenBy === tac.type);
      const good = C.ATK_PRESETS.find((p) => p.beats === tac.type); // v635: ataque que vence a formação deles
      return `${base}${sure ? " (certeza)" : ""}. Dica: marque de ${ctr ? ctr.name : "?"}${good ? `, ataque no ${good.label}` : ""}${bad ? ` e não ataque no ${bad.label}` : ""}`;
    },
    // aplica uma formação/tática no time da casa com a partida já criada (pré-jogo ou pausa tática)
    applyLive(tac) {
      const m = this.match, four = this.map.size === 4, en = this.enemyTactic;
      m.setTactic(0, { roles: this.rolesFor(m.field(0).map((e) => e.p), tac, true), shape: tac.shape || null, kickShape: four ? tac.kickShape || null : null, gkShape: four ? tac.gkShape || null : null, oppGkShape: four ? tac.oppGkShape || null : null, style: four ? tac.style || null : null });
      if (four && en) { m.mods = this.matchMods(this.formationMods(tac, en), tac); m.edge = this.atkEdge(tac, en); }
      if (four && m.myShapes && m.myShapes[0]) Object.assign(m.myShapes[0], this.markShape(tac)); // v458
      this.myTactic = tac; this.setTactic(tac.id);
    },
    markShape(tac) { const pr = C.MARK_PRESETS.find((p) => p.id === (tac && tac.mark)) || C.MARK_PRESETS[0]; return { sem: pr.shape.map((q) => q.slice()), mark: pr }; }, // v458
    prematchPick(id) {
      const m = this.match, pm = this.prematch; if (!m || !pm) return;
      if (id && id !== "go") { pm.sel = id; this.emit("prematch"); return; } // v151: clicar na formação só seleciona; começa no Jogar ou no fim da contagem
      id = pm.sel; this.prematch = null; clearTimeout(this.pmT);
      const tac = id && this.tactics().find((t) => t.id === id);
      if (tac && tac.id !== this.myTactic.id) { this.applyLive(tac); m.kickoff(0); this.pushLog(`Formação escolhida: ${tac.name}`, "sys"); }
      m.paused = false; this.emit("prematch");
    },
    // v136 · pausa tática: 1 por partida (não no treino nem no golden gol), troca a formação na hora
    pauseState() {
      const m = this.match;
      if (!m || m.training || m.state === "ended" || this.tactics().length < 2) return "off";
      if (m.pauseUsed) return "used";
      if (m.golden) return "golden";
      if (this.prematch || (m.half === 1 && m.clock === 0)) return "wait";
      return "ok";
    },
    tacticalPause() { if (this.pauseState() !== "ok") return false; this.match.paused = true; return true; },
    resumePause() { if (this.match) this.match.paused = false; },
    applyPause(id) {
      const m = this.match, tac = this.tactics().find((t) => t.id === id);
      if (!m || !tac || !m.paused) return;
      this.applyLive(tac); m.pauseUsed = true; m.paused = false;
      this.pushLog(`Pausa tática: ${tac.name}`, "sys");
    },
    // Quem ataca: os mais ofensivos pela posição (Atacante > Ala Of > Ala Def > Zagueiro)
    rolesFor(list, tac, mine) { // v434: no meu time a posição vem da vaga (C.LINEUP_POS), não do personagem
      const pos = (i) => (mine && C.LINEUP_POS[i]) || list[i].position;
      const order = list.map((_, i) => i).sort((a, b) => POS_ORDER[pos(a)] - POS_ORDER[pos(b)]);
      const roles = list.map(() => "def");
      order.slice(0, tac.atk).forEach((i) => (roles[i] = "atk"));
      return roles;
    },
    // Pedra, papel e tesoura das formações (só 4×4)
    formationMods(mine, theirs) {
      const a = { ...(mine.mods || {}) }, b = { ...(theirs.mods || {}) };
      if (mine.type && theirs.type) {
        const n = this.atkEdgeN(mine, theirs), k = n[0] - n[1], ek = 1 + C.FORMATION_EDGE * (Math.abs(k) > 1 ? C.FORMATION_EDGE2 || 1 : 1); if (k > 0) a.all = ek; if (k < 0) b.all = ek; // v597 · v635: saldo de vantagens (defesa × ataque deles + ataque × defesa deles)
      }
      return [a, b];
    },
    // v597 (Mickey) · pedra-papel-tesoura: a formação que countera o preset de ataque do adversário leva a vantagem (Bola no pé ← 3-1 defensivo, Plays setadas ← 2-2, Equilíbrio ← 3-1 ofensivo)
    prefAtk(team) { let h = 7; for (const ch of String(team)) h = (h * 37 + ch.charCodeAt(0)) >>> 0; return C.ATK_PRESETS[h % C.ATK_PRESETS.length].id; }, // v598
    atkShape(id) { const p = C.ATK_PRESETS.find((q) => q.id === id) || C.ATK_PRESETS[2]; return p.shape.map((q) => q.slice()); }, // v598: Com a bola vem do ataque escolhido
    applyAtk(id) { this.setAtkPreset(id); const m = this.match; if (!m || this.map.size !== 4) return; m.atk[0] = this.myAtk(); if (m.myShapes && m.myShapes[0]) m.myShapes[0].com = this.atkShape(m.atk[0]); if (this.enemyTactic) { m.mods = this.matchMods(this.formationMods(this.myTactic, this.enemyTactic), this.myTactic); m.edge = this.atkEdge(this.myTactic, this.enemyTactic); } }, // v598: escolher o ataque no pré-jogo
    myAtk() { const id = this.state && this.state.atkPreset; return C.ATK_PRESETS.some((p) => p.id === id) ? id : "rot"; },
    setAtkPreset(id) { if (!C.ATK_PRESETS.some((p) => p.id === id)) return; this.state.atkPreset = id; this.save(); this.emit("resources"); },
    atkEdgeN(mine, theirs) { const A = (id) => C.ATK_PRESETS.find((p) => p.id === id) || {}, ea = A(this.enemyAtk || "rot"), ma = A(this.myAtk()), mt = mine && mine.type, tt = theirs && theirs.type; return [(mt && mt === ea.beatenBy ? 1 : 0) + (tt && tt === ma.beats ? 1 : 0), (tt && tt === ma.beatenBy ? 1 : 0) + (mt && mt === ea.beats ? 1 : 0)]; }, // v635 (Mickey): forte/fraco/neutro: [vantagens minhas, vantagens deles]
    atkEdge(mine, theirs) { const n = this.atkEdgeN(mine, theirs); return [n[0] > n[1], n[1] > n[0]]; }, // v597 · v635: quem tem mais vantagens
    // v679 (Mickey: o amigo dele ficou preso no 1×1 sem saber que o 2×2 já estava aberto) · modos novos liberados
    // modeTop = maior modo (2×2 a 4×4, índices 1 a 3) já liberado pelo elenco; modeSeen = último avisado em pop-up; modeMax = maior já jogado
    modeTop() { let t = 0; for (let i = 1; i <= 3 && i < C.MAPS.length; i++) if (this.mapUnlocked(i)) t = i; return t; },
    modePlayed() { const s = this.state; return Math.max(s.modeMax || 0, s.progress.map); },
    modeNew() { const s = this.state, t = this.modeTop(); return !this.dev && t > Math.max(s.modeSeen || 0, this.modePlayed()) ? t : -1; },
    modeAck(i) { const s = this.state; if ((s.modeSeen || 0) < i) { s.modeSeen = i; this.save(); } },
    modeNeed(i) { return Math.max(0, C.MAPS[i].size - this.state.roster.filter((p) => !this.isAway(p.uid)).length); },
    switchMap(i, stage = 1) {
      if (!this.mapUnlocked(i)) return false;
      const pr = this.state.progress;
      if ((this.state.modeMax || 0) < i) this.state.modeMax = i;
      pr.map = i; pr.stage = stage; pr.reach = stage; pr.runSteals = 0;
      this.save();
      clearTimeout(this.nextT);
      this.startMatch();
      return true;
    },
    setDev(on) {
      this.dev = !!on;
      try { localStorage.setItem(DEV_KEY, on ? "1" : "0"); } catch (e) {}
      if (!on && !this.mapUnlocked(this.state.progress.map)) { this.switchMap(0); }
      this.emit("dev");
    },
    // v167 · conta dev: todos os personagens, Gold/Diamantes à vontade, conta e jogadores no nível máximo, VIP e itens
    // v291: Modo Soneca. turbo = segundos de turbo guardados (só o VIP acumula, jogando partidas fora do treino)
    sleepBank() { const s = this.state; if (!s.sleepBank) s.sleepBank = { turbo: 0 }; return s.sleepBank; },
    // v292: turbo ganho tem limite por dia (C.SLEEP_TURBO_MAX_H); o banco também guarda no máximo isso
    sleepTick(sec) {
      const s = this.state, m = this.match; if (!s || !s.vip || !m || m.training || m.paused) return;
      const b = this.sleepBank(), max = C.SLEEP_TURBO_MAX_H * 3600, day = new Date().toDateString();
      if (b.day !== day) { b.day = day; b.today = 0; }
      const add = Math.min(sec * C.SLEEP_TURBO_PER_PLAYED, max - b.today, max - b.turbo); // 2 h jogadas = 1 h de turbo
      if (add > 0) { b.turbo += add; b.today += add; }
    },
    // v292 (Mickey): ritmo sempre estimado pela fase atual e dificuldade
    sleepRate() {
      const st = this.state.progress.stage, dm = C.DIFFICULTIES[this.diff()].reward;
      const mp = C.MAPS[this.state.progress.map], pc = C.XP_RULE && C.XP_RULE.pace[this.state.progress.map], lv = mp.levelMin + (st - 0.5) * (mp.levelMax - mp.levelMin + 1) / C.STAGES_PER_MAP; // v585: mesma conta da partida
      return { xph: (pc ? pc * lv * 1.15 : C.XP_BASE + C.XP_PER_STAGE * (st - 1)) * dm * 3600 / C.SLEEP_MATCH_SEC_EST };
    },
    sleepStart() { const r = this.sleepRate(); this.state.sleep = { since: Date.now(), xph: Math.round(r.xph) }; this.save(); return this.state.sleep; },
    // ao voltar: paga as horas dormidas em XP (turbo VIP primeiro, depois 50% do XP)
    sleepWake() {
      const s = this.state, z = s.sleep; if (!z) return null;
      const h = Math.max(0, Date.now() - z.since) / 3.6e6, b = this.sleepBank(); // v292: sem teto, rende até abrir a conta
      const th = s.vip ? Math.min(h, b.turbo / 3600) : 0;
      const xp = Math.round(z.xph * (th + (h - th) * C.SLEEP_XP_MULT)); // v292: só XP, sem Gold
      b.turbo = Math.max(0, b.turbo - Math.round(th * 3600)); s.sleep = null;
      const ups = xp > 0 ? this.giveXp(xp) : [];
      this.save(); this.emit("resources"); this.emit("roster");
      return { h, th, xp, ups };
    },
    // v290: Correio. Junta as mensagens do sistema que a conta ainda não tem; at = quando chegou
    mail() {
      const s = this.state; if (!s.mail) s.mail = [];
      C.MAIL_SYSTEM.forEach((m) => { if (!s.mail.some((x) => x.id === m.id)) s.mail.unshift({ id: m.id, at: Date.now(), claimed: false }); });
      return s.mail.map((x) => ({ ...C.MAIL_SYSTEM.find((m) => m.id === x.id), ...x })).filter((x) => x.title);
    },
    mailPending() { return this.mail().filter((m) => m.gift && !m.claimed).length; },
    mailClaim(id) {
      const s = this.state, m = this.mail().find((x) => x.id === id); if (!m || !m.gift || m.claimed) return false;
      s.gold += m.gift.gold || 0; s.diamonds = (s.diamonds || 0) + (m.gift.diamonds || 0);
      s.mail.find((x) => x.id === id).claimed = true; this.save(); this.emit("resources"); return true;
    },
    devGrantAll() {
      const s = this.state; if (!this.dev || !s) return;
      const have = new Set(s.roster.map((p) => p.charId));
      BL.CHARACTERS.forEach((c) => { if (!have.has(c.id)) s.roster.push(BL.makePlayer(c.id, { rarity: "lendario" })); });
      s.roster.forEach((p) => { p.level = C.PLAYER_MAX_LEVEL; p.xp = 0; });
      s.account.level = C.ACCOUNT_MAX_LEVEL; s.account.xp = 0;
      s.gold = 999999999; s.diamonds = 999999999; s.vip = true;
      const c = this.cons(); c.agua = 9999; c.isotonico = 9999; c.gatorade = 9999;
      s.progress.unlocked2x2 = true;
      this.save(); this.emit("roster"); this.emit("resources"); this.emit("cons"); this.emit("dev");
    },
    // v170 · habilidades: 4 slots ({ id, level } ou null); CD estilo LoL guardado só em memória (início/fim em ms)
    skillSlots() { const s = this.state; if (!s.skills || s.skills.length !== C.SKILL_SLOTS) s.skills = Array.from({ length: C.SKILL_SLOTS }, (_, i) => (s.skills && s.skills[i]) || null); return s.skills; },
    skillCd: [],
    startSkillCd(i, sec) { const now = Date.now(); this.skillCd[i] = { start: now, end: now + sec * 1000 }; this.emit("skills"); },
    // v623 (Mickey) · habilidades: livros na biblioteca (state.skillLib { id: { lv } }); cada habilidade fica em 1 jogador por vez; livro repetido sobe o nível
    skNeed(id) { const n = (C.SKILL_UNLOCK_LV || {})[id]; return n && !this.dev && this.state.account.level < n ? n : 0; }, // v652 (Mickey): nível da conta que libera a habilidade (0 = já liberada)
    skNeedClear(id) { const c = (C.SKILL_UNLOCK_CLEAR || {})[id]; return c && !this.dev && !(this.state.progress.cleared || {})[this.clearKey(c[0], c[1])] ? c : null; }, // v653 (Mickey): [mapa, dificuldade] do Boss que ainda falta vencer (null = liberada)
    skLock(id) { const n = this.skNeed(id), c = this.skNeedClear(id), m = c && C.MAPS[c[0]]; return n ? `libera no Nv ${n} da conta` : c ? `libera vencendo o Boss do Ato ${c[0] + 1} (${m.size}v${m.size}) no ${C.DIFFICULTIES[c[1]].name}` : ""; }, // v653: texto da carta travada
    skLib() { const s = this.state; if (!s.skillLib) s.skillLib = {}; const U0 = C.SKILL_UNLOCK_LV || {}, U1 = C.SKILL_UNLOCK_CLEAR || {}; Object.keys(C.SKILL_DEF || {}).forEach((id) => { if (!s.skillLib[id] && !this.skNeed(id) && !this.skNeedClear(id) && (this.dev || C.SKILL_FREE || U0[id] || U1[id])) s.skillLib[id] = { lv: 1 }; });
      Object.keys(C.SKILL_DEF || {}).forEach((id) => { if ((this.skNeed(id) || this.skNeedClear(id)) && s.skillLib[id] && s.skillLib[id].lv <= 1) { delete s.skillLib[id]; if (s.skills) s.skills = s.skills.map((x) => (x && x.id === id ? null : x)); } }); return s.skillLib; }, // v652: save antigo com a rara liberada de graça antes do nível volta a ficar travado
    skRoll(w) { const r = U.weighted(Object.entries(w).map(([v, x]) => ({ v, w: x }))), ids = Object.keys(C.SKILL_DEF).filter((id) => C.SKILL_DEF[id].rar === r); return U.pick(ids.length ? ids : Object.keys(C.SKILL_DEF)); },
    skBook(id) {
      const L = this.skLib(), d = C.SKILL_DEF[id]; if (!d) return null; let msg;
      if (!L[id]) { L[id] = { lv: 1 }; msg = `Livro de habilidade! ${d.name} liberada: equipe na janela EV e status de um jogador`; }
      else if (L[id].lv < C.SKILL_LV.max) { L[id].lv++; msg = `Livro repetido: ${d.name} subiu para o nível ${L[id].lv}`; }
      else { const g = 2000; this.state.gold += g; msg = `${d.name} já está no nível máximo: virou ${g} Gold`; }
      this.state.roster.forEach((p) => (p.skills || []).forEach((x) => { if (x && x.id === id) x.lv = L[id].lv; }));
      this.pushLog(msg, "steal"); this.emit("skills"); return { id, name: d.name, lv: L[id].lv };
    },
    skillEquip(uid, slot, id) {
      const p = this.player(uid); if (!p) return false; const n = (C.RARITIES.find((r) => r.id === p.rarity) || {}).skills || 1; if (slot < 0 || slot >= n) return false;
      const L = this.skLib(); if (id && !L[id]) return false;
      if (id) this.state.roster.forEach((q) => { if (q.skills) q.skills = q.skills.map((x) => (x && x.id === id ? null : x)); });
      p.skills = Array.from({ length: n }, (_, i) => (p.skills && p.skills[i]) || null); p.skills[slot] = id ? { id, lv: L[id].lv } : null;
      if (this.match) this.match.ents.forEach((e) => { if (e.p === p) e.skP = null; });
      this.save(); this.emit("skills"); return true;
    },
    // v638 (Mickey): as habilidades são do time (4 slots em state.skills), não de cada jogador
    teamSkills() { const L = this.skLib(); return this.skillSlots().filter((x) => x && C.SKILL_DEF[x.id] && L[x.id]).map((x) => ({ id: x.id, lv: L[x.id].lv })); },
    skillToggle(id, slot) {
      const S = this.skillSlots(), L = this.skLib(); if (id && !L[id]) return false;
      const at = S.findIndex((x) => x && x.id === id);
      if (at >= 0 && (slot == null || slot === at)) S[at] = null; // clicou de novo: tira
      else { if (at >= 0) S[at] = null; const i = slot != null ? slot : S.findIndex((x) => !x); if (i < 0) return "full"; S[i] = id ? { id } : null; }
      if (this.match && this.match.skTL) this.match.skTL[0] = null, this.match.opts.skills = [this.teamSkills(), (this.match.opts.skills || [])[1] || null];
      this.save(); this.emit("skills"); return true;
    },
    skOwner(id) { return this.state.roster.find((q) => (q.skills || []).some((x) => x && x.id === id)); },
    skillCdLeft(i) { const c = this.skillCd[i]; return c && c.end > Date.now() ? c : null; },
    // v118 · técnico da conta: sorteado uma vez e salvo no save (nome, sobrenome, nacionalidade, raridade)
    coach() {
      const s = this.state; if (!s) return null;
      if (!s.coach) {
        const pick = (a) => a[Math.floor(Math.random() * a.length)];
        const n = pick(C.COACH_NATIONS);
        s.coach = { first: pick(n.first), last: pick(n.last), nation: n.id, rarity: "comum" };
        this.save();
      }
      if (!s.coach.owned) { s.coach.owned = [C.COACH_DEFAULT]; s.coach.id = C.COACH_DEFAULT; this.save(); } // v417 (Mickey): todos começam com Kyouya Kurogane; os outros vêm da Loja
      if (!C.COACHES.some((c) => c.id === s.coach.id) || !s.coach.owned.includes(s.coach.id)) s.coach.id = C.COACH_DEFAULT;
      s.coach.nation = (C.COACHES.find((c) => c.id === s.coach.id) || {}).nation || s.coach.nation;
      return s.coach;
    },
    coachDef() { const co = this.coach(); return co && C.COACHES.find((c) => c.id === co.id); },
    coachLv(id) { return ((this.coach().lv || {})[id]) || 0; }, // v418: 0 Comum ... 5 Despertado
    coachFx(id) { // passiva já com o bônus da raridade (+2% por nível na especialidade)
      const d = id ? C.COACHES.find((c) => c.id === id) : this.coachDef(); if (!d || !d.fx) return {};
      const k = C.COACH_UP_STEP * this.coachLv(d.id), up = (v) => (v > 1 ? v + k : v < 1 ? v - k : v), mm = (o) => o && Object.fromEntries(Object.entries(o).map(([a, v]) => [a, up(v)]));
      const fx = { ...d.fx, mods: mm(d.fx.mods), foeMods: mm(d.fx.foeMods) };
      ["slow", "gold"].forEach((a) => { if (fx[a]) fx[a] += k; }); if (fx.offense) fx.offense = up(fx.offense);
      return fx;
    },
    coachUpCost(id) { return C.COACH_UPGRADE[this.coachLv(id)] || 0; },
    upgradeCoach(id) {
      const d = C.COACHES.find((c) => c.id === id), s = this.state, co = this.coach(), lv = this.coachLv(id), cost = this.coachUpCost(id);
      if (!d || !this.coachOwned(id) || id === C.COACH_DEFAULT) return { ok: false, msg: "Esse técnico não evolui." };
      if (!cost) return { ok: false, msg: "Já está no máximo (Despertado)." };
      if ((s.diamonds || 0) < cost) return { ok: false, msg: `Faltam ${cost - (s.diamonds || 0)} Diamantes.` };
      s.diamonds -= cost; (co.lv || (co.lv = {}))[id] = lv + 1; this.save(); this.emit("roster");
      return { ok: true, msg: `${d.name} agora é ${C.RARITIES[lv + 1].name}!` };
    },
    coachOwned(id) { return this.coach().owned.includes(id); },
    buyCoach(id) {
      const d = C.COACHES.find((c) => c.id === id), s = this.state; if (!d) return { ok: false, msg: "Técnico não encontrado." };
      if (this.coachOwned(id)) return { ok: false, msg: "Você já tem esse técnico." };
      if ((s.diamonds || 0) < C.COACH_PRICE) return { ok: false, msg: `Faltam ${C.COACH_PRICE - (s.diamonds || 0)} Diamantes.` };
      s.diamonds -= C.COACH_PRICE; this.coach().owned.push(id); this.save(); this.emit("roster");
      return { ok: true, msg: `${d.name} contratado!` };
    },
    setCoach(id) { const d = C.COACHES.find((c) => c.id === id); if (!d || !this.coachOwned(id)) return false; Object.assign(this.coach(), { id: d.id, nation: d.nation }); this.save(); this.emit("roster"); return true; },
    coachGold(n) { return Math.round(n * (1 + (this.coachFx().gold || 0))); }, // v417: Kōrai Goryeo, +10% de ouro em tudo
    // v417: passiva do técnico em campo: status do seu time (mods), do inimigo (foeMods) e o extra na formação ofensiva
    matchMods(base, tac) {
      const fx = this.coachFx(), m = [{ ...(base[0] || {}) }, { ...(base[1] || {}) }];
      const add = (o, mods, k = 1) => Object.entries(mods || {}).forEach(([s, v]) => { o[s] = (o[s] || 1) * (1 + (v - 1) * k); });
      add(m[0], fx.mods); add(m[1], fx.foeMods);
      if (fx.offense && tac && tac.style === "blitz") add(m[0], { chute: fx.offense, passe: fx.offense });
      return m;
    },
    coachReadsClear() { return !!this.coachFx().read || this.state.account.level >= C.HINT_LV_CLEAR; },
    // ---------- EV e editor do modo dev ----------
    // v112 · também acha os jogadores de teste do modo dev (editáveis) e os adversários da partida (só leitura na janela)
    player(uid) { return this.state.roster.find((p) => p.uid === uid) || (this.devFill || []).find((p) => p && p.uid === uid); },
    enemyPlayer(uid) { return (this.enemies || []).concat(this.enemyBench || []).find((p) => p.uid === uid); },
    evPool() { return this.dev ? Infinity : this.state.evPoints || 0; },
    addEv(uid, k, amount) {
      const p = this.player(uid); if (!p || !C.STATS.includes(k)) return 0;
      p.ev = p.ev || {};
      const room = Math.min(C.EV_MAX_STAT - BL.ev(p, k), C.EV_MAX_TOTAL - BL.evTotal(p), this.evPool());
      const n = Math.max(0, Math.min(amount === "max" ? Infinity : amount, room));
      if (!n) return 0;
      p.ev[k] = BL.ev(p, k) + n;
      if (!this.dev) this.state.evPoints -= n;
      this.save(); this.emit("roster");
      return n;
    },
    // resetar EV custa Gold (no modo dev é grátis); os pontos voltam para o banco
    resetEv(uid) {
      const p = this.player(uid); if (!p || !BL.evTotal(p)) return { ok: false, msg: "Este jogador não tem EV para resetar." };
      if (!this.dev && this.state.gold < C.EV_RESET_COST) return { ok: false, msg: `Precisa de ${C.EV_RESET_COST} Gold.` };
      if (!this.dev) { this.state.gold -= C.EV_RESET_COST; this.state.evPoints = (this.state.evPoints || 0) + BL.evTotal(p); }
      p.ev = {};
      this.save(); this.emit("roster"); this.emit("resources");
      return { ok: true, msg: "EVs resetados" };
    },
    devSetLevel(uid, lv) {
      const p = this.player(uid); if (!this.dev || !p) return;
      p.level = Math.max(1, Math.min(C.PLAYER_MAX_LEVEL, Math.round(lv) || 1)); p.xp = 0;
      this.save(); this.emit("roster");
    },
    devSetIv(uid, k, v) {
      const p = this.player(uid); if (!this.dev || !p || !C.STATS.includes(k)) return;
      p.stats[k] = Math.max(1, Math.min(C.STAT_MAX, Math.round(v)));
      this.save(); this.emit("roster");
    },
    keeper() { return BL.goalkeeperFor(this.state.account.level); },
    isBoss() { return this.state.progress.stage === C.STAGES_PER_MAP && !!this.map.boss; },
    prologue() { const P = C.PROLOGUE; return !!(P && this.state && this.state.progress.map === P.map && !this.mapEverCleared(P.map)); }, // v558: Prólogo até zerar o mapa 1
    arenaNow() { const a = this.map.boss.arena, mi = this.prologue() && C.PROLOGUE.mini; return mi ? { ...a, bossBuff: mi.bossBuff, userDebuff: mi.userDebuff } : a; },
    stageLabel(stage = this.state.progress.stage) { return `${this.map.id}-${stage}`; },

    // ---------- partida ----------
    startMatch() {
      this.x1Drib = 0; // v561
      this.legendXp = false; this.goldTeam = false; // v582
      clearTimeout(this.vestT); this.vest = null;
      const s = this.state;
      let mine = this.activePlayers();
      const size = this.map.size;
      if (s.training) return this.startTraining(mine);
      this.enemies = [];
      for (let i = 0; i < size; i++) this.enemies.push(BL.makeEnemy(s.progress.map, s.progress.stage, this.enemies.map((e) => e.charId), i > 0));
      // v155: o adversário também tem 2 reservas (por enquanto só aparecem no card; no PvP o outro jogador vai usar as dele)
      this.enemyBench = [];
      for (let i = 0; i < C.BENCH_SIZE; i++) this.enemyBench.push(BL.makeEnemy(s.progress.map, s.progress.stage, this.enemies.concat(this.enemyBench).map((e) => e.charId), true));
      { const GT = C.GOLDEN_TEAM; if (GT && size === 4 && !this.isBoss() && !this.prologue() && (this.devGold || Math.random() < GT.chance)) { // v582 (Mickey): Time Dourado, todos Lendário para cima pelo mapa
        this.devGold = false; this.goldTeam = true; const m4 = C.MAPS.map((mp, i) => (mp.size === 4 ? i : -1)).filter((i) => i >= 0), f = m4.length > 1 ? (s.progress.map - m4[0]) / (m4[m4.length - 1] - m4[0]) : 1, pa = GT.awake[0] + (GT.awake[1] - GT.awake[0]) * U.clamp(f, 0, 1);
        const up = (e) => { const q = BL.makePlayer(e.charId, { level: e.level, shiny: e.shiny, position: e.position, rarity: Math.random() < pa ? "despertado" : "lendario" }); q.goldTeam = true; return q; };
        this.enemies = this.enemies.map(up); this.enemyBench = this.enemyBench.map(up); } }
      const addLv = C.DIFFICULTIES[this.diff()].levels; // v264: dificuldade soma níveis a todos os inimigos (Boss incluso)
      if (addLv) this.enemies.concat(this.enemyBench).forEach((e) => (e.level = Math.min(C.PLAYER_MAX_LEVEL, e.level + addLv)));
      if (this.dev && s.devEqualLevel) { const lv = Math.max(1, Math.round(mine.reduce((a, p) => a + p.level, 0) / mine.length)); this.enemies.concat(this.enemyBench).forEach((e) => (e.level = lv)); }
      // v441 (Mickey): o time inimigo também joga pelas 4 posições (Fixo, Ala Def, Ala Of, Pivô), na mesma ordem das vagas
      if (size === 4) { const left = this.enemies.slice(), slots = C.LINEUP_POS.map((pos) => { const k = left.findIndex((p) => p.position === pos); return k >= 0 ? left.splice(k, 1)[0] : null; }); this.enemies = slots.map((p) => p || left.shift()); }
      if (this.gymFight && size === 4) { const gm = this.gyRead().g[this.gymFight.id], gd = C.GYMS.list.find((x) => x.id === this.gymFight.id); this.goldTeam = false; this.enemies = (gm.team || []).slice(0, 4).map((p) => { const q = JSON.parse(JSON.stringify(p)); q.uid = "gy" + q.uid; q.temp = true; return q; }); this.gymFight.name = `${gd.name} · ${gm.leaderName}`; } // v622: desafio de ginásio contra o time do líder
      if (this.clanFight && size === 4 && BL.Clan) { this.goldTeam = false; this.enemies = BL.Clan.fightTeam(); } // v624: Guilda (Raide e Guerra), ver js/clan.js
      if (this.pvpFight && size === 4 && BL.PvP) { this.goldTeam = false; this.enemies = BL.PvP.fightTeam(); if (this.pvpFight.mine) mine = BL.PvP.myTeam(); } // v630: Arena PvP, ver js/pvp.js
      this.enemy = this.enemies[0];
      this.enemyTeam = this.isBoss() ? this.map.boss.team || C.BOSS_TEAM_NAME : `${U.pick(C.TEAM_NAME_A)} ${U.pick(C.TEAM_NAME_B)}`;
      if (this.gymFight && this.gymFight.name) this.enemyTeam = this.gymFight.name;
      if (this.clanFight && this.clanFight.name) this.enemyTeam = this.clanFight.name; // v624
      if (this.pvpFight && this.pvpFight.name) this.enemyTeam = this.pvpFight.name; // v630
      if (this.goldTeam) { this.enemyTeam = C.GOLDEN_TEAM.name; this.pushLog(`TIME DOURADO apareceu! Vença para ganhar XP e Gold ×${C.GOLDEN_TEAM.xp} e chance de roubo ×${C.GOLDEN_TEAM.steal}`, "steal"); }
      this.myTactic = this.tactic();
      this.enemyTactic = (this.dev && this.tactics().find((t) => t.id === this.devEnemyTactic)) || this.pickEnemyTactic(this.enemyTeam);
      { const pa = this.prefAtk(this.enemyTeam); this.enemyAtk = Math.random() < C.ENEMY_PREF_CHANCE ? pa : C.ATK_PRESETS[Math.floor(Math.random() * C.ATK_PRESETS.length)].id; } // v598: ataque preferido do time 70% (v597: sorteado)
      this.enemyHint = this.hintFor(this.enemyTeam, this.enemyTactic);
      const gk = this.keeper();
      const boss = this.isBoss();
      this.match = new BL.Match({
        teams: [mine, this.enemies], skills: [this.teamSkills(), null], // v638: habilidades do time
        roles: [this.rolesFor(mine, this.myTactic, true), this.rolesFor(this.enemies, this.enemyTactic, size === 4)],
        halfSec: boss ? C.HALF_SECONDS : C.HALF_SECONDS_NORMAL, pace: boss ? 1 : C.PACE_NORMAL || 1, /* v614: ritmo · v613 (Mickey): só o Boss tem o tempo longo */
        pos4: size === 4, legendNow: size === 4 && this.devLegend ? (this.devLegend = false, true) : false, /* v582 */ myShapes: size === 4 ? [{ com: this.atkShape(this.myAtk()), ...this.markShape(this.myTactic) }, { com: this.atkShape(this.enemyAtk), ...this.markShape(this.enemyTactic) }] : null, /* v598: Com a bola = forma do ataque escolhido, nos dois times */ // v493 (Mickey): o inimigo também usa o Com a bola padrão (ataca pelas alas como o meu time) · v458: a marcação (Sem a bola) vem da formação, nos dois times // v455: posições do Meu time // v441: nos dois times a vaga decide a posição (0 Fixo, 1 Ala Def, 2 Ala Of, 3 Pivô) · v437/v438 eram só o meu time
        mods: this.matchMods(size === 4 ? this.formationMods(this.myTactic, this.enemyTactic) : [{}, {}], this.myTactic), coachFx: [this.coachFx(), {}], mgrFx: [this.mgrFx(), {}], // v417: passiva do técnico; v527: itens do treinador
        shapes: [this.myTactic.shape || null, this.enemyTactic.shape || null], // v195: 3×3 também pode ter desenho (Ataque total e Retranca em "V")
        kickShapes: size === 4 ? [this.myTactic.kickShape || null, this.enemyTactic.kickShape || null] : [null, null],
        gkShapes: size === 4 ? [this.myTactic.gkShape || null, this.enemyTactic.gkShape || null] : [null, null],
        oppGkShapes: size === 4 ? [this.myTactic.oppGkShape || null, this.enemyTactic.oppGkShape || null] : [null, null],
        styles: size === 4 ? [this.myTactic.style || null, this.enemyTactic.style || null] : [null, null],
        edge: size === 4 ? this.atkEdge(this.myTactic, this.enemyTactic) : [false, false], atk: size === 4 ? [this.myAtk(), this.enemyAtk] : null, // v597
        gk: [gk, gk],
        arena: boss ? this.arenaNow() : null, // v558: Mini Boss do Prólogo com buff menor
        pitch: boss ? "estadio" : this.pitchId(), // v312: o Boss joga na arena dele (Estádio)
        speed: boss ? C.BOSS_SPEED : C.GAME_SPEED,
        onEvent: (type, data) => this.onMatchEvent(type, data),
      });
      this.pushLog(boss ? `BOSS: ${this.enemy.name} na ${this.map.boss.arena.name}${size > 1 ? ` com ${this.enemies.slice(1).map((e) => e.short).join(", ")}` : ""}` : `Fase ${this.stageLabel()}: ${mine.map((p) => p.short).join(", ")} contra ${this.enemies.map((e) => e.short).join(", ")}`, "sys");
      if (size === 4) {
        this.pushLog(`Sua formação: ${this.myTactic.name} · Técnico: ${this.enemyTeam} ${this.enemyHint}`, "sys"); // v137: a formação deles só aparece no fim
      }
      clearTimeout(this.pmT);
      if (size > 1 && this.tactics().length > 1) {
        this.match.paused = true; this.prematch = { until: Date.now() + C.PREMATCH_SECONDS * 1000 };
        this.pmT = setTimeout(() => this.prematchPick(null), C.PREMATCH_SECONDS * 1000); // ninguém mexeu: começa com a última formação
      } else this.prematch = null;
      this.recStart(mine, size, boss);
      this.emit("matchStart", this.match);
    },

    // v134 · registro da partida: número por conta, eventos e posições (1 por segundo de jogo).
    // Fica no navegador (últimas 30) e, aberto no claude.ai, no banco do artifact para o Claude ler.
    recStart(mine, size, boss) {
      const s = this.state, m = this.match;
      s.matchNo = (s.matchNo || 0) + 1;
      const pl = (p) => ({ n: p.name, r: p.rarity, lv: p.level, pos: p.position, nat: p.nature, iv: p.stats, ev: p.ev || {}, pw: BL.power(p) });
      this.rec = {
        no: s.matchNo, user: this.account || "local", build: BL.BUILD, at: new Date().toISOString(),
        mode: `${size}x${size}`, stage: this.stageLabel(), boss: !!boss,
        tactics: size === 4 ? [this.myTactic.name, this.enemyTactic.name] : null, edge: m.edge,
        teams: [this.teamName(), this.enemyTeam], mine: mine.map(pl), them: this.enemies.map(pl),
        ents: m.ents.map((e) => (e.gk ? `GK${e.team}` : `${e.team}:${e.p.short}:${e.role}`)),
        ev: [], pos: [],
      };
      m.onSample = (mm) => {
        this.autoHeal();
        if (!this.rec || this.rec.pos.length > 400) return;
        const b = mm.ball, o = b.owner;
        this.rec.pos.push([mm.minute(), Math.round(b.x), Math.round(b.y), o ? mm.ents.indexOf(o) : -1, ...mm.ents.flatMap((e) => [Math.round(e.x), Math.round(e.y)])]);
      };
      this.save();
    },
    // v135 · Água e Gatorade: inventário de consumíveis, compra na Loja e uso na partida (espera por jogador)
    cons() { const s = this.state; return (s.cons = s.cons || { agua: 0, gatorade: 0 }); },
    buyCons(id, n = 1) {
      const it = C.CONSUMABLES[id] || C.SUPPLIES[id], s = this.state; if (!it || !(n >= 1) || it.chest) return { ok: false }; // v522: bebida de baú não se compra // v475: também os suprimentos de roubo e XP
      const c = this.cons();
      if (it.dia) { const d = it.dia * n; if ((s.diamonds || 0) < d) return { ok: false, msg: `Diamantes insuficientes: ${it.name} ×${n} custa ${d} ◆.` }; s.diamonds -= d; } // v480: Contrato Blue Lock só por Diamantes
      else { const cost = it.cost * n; if (s.gold < cost) return { ok: false, msg: `Gold insuficiente: ${it.name} ×${n} custa ${cost}.` };
        s.gold -= cost; s.analyzer.goldSpent = (s.analyzer.goldSpent || 0) + cost; }
      c[id] = (c[id] || 0) + n;
      this.save(); this.emit("resources");
      return { ok: true, msg: `+${n} ${it.name}` };
    },
    healEnt(uid) { const m = this.match; return m && !m.training && m.state !== "ended" ? (m.scrimmage ? m.field(0).concat(m.field(1)) : m.field(0)).find((e) => e.p.uid === uid) : null; }, // v162: no treino em dois times os dois lados são seus
    healWait(e) { return e ? Math.max(0, Math.ceil((e.healT ?? -999) + C.HEAL_COOLDOWN - this.match.time)) : 0; },
    useCons(uid, id, auto = false) {
      const e = this.healEnt(uid), it = C.CONSUMABLES[id], c = this.cons();
      if (!e || !it || !c[id] || (this.healWait(e) > 0 && !this.vest) || e.energy >= 100) return false; // no vestiário não tem espera
      c[id]--; e.healT = this.match.time;
      e.energy = Math.min(100, e.energy + it.restore);
      if (it.drainK) e.drainK = it.drainK; // v522: Vitamina de Banana, até o fim do tempo (zera no intervalo)
      this.match.fx.push({ kind: "text", x: e.x, y: e.y - 30, text: `${it.icon} +${it.restore}`, t: 1, color: id === "agua" ? "#26D9FF" : id === "isotonico" ? "#7ff0c4" : "#ffd23f" });
      this.pushLog(`${auto ? "Cura automática: " : ""}${it.name} para ${e.p.short} (+${it.restore} energia)`, "me");
      this.save(); this.emit("cons");
      return true;
    },
    healPick() { const c = this.cons(); return C.HEAL_ORDER.find((id) => c[id] > 0) || null; }, // v522 (Mickey): o jogo usa primeiro as bebidas de baú
    // Cura automática (VIP; v509: o nome Módulo de cura passou para o item permanente): gasta os itens sozinho quando a energia cai; sem item, não cura
    autoHeal() {
      const s = this.state, m = this.match;
      if (!s.vip || !s.settings.autoGatorade || !m || m.training || m.state !== "play") return;
      for (const e of m.field(0)) {
        if (e.energy >= C.HEAL_AUTO_BELOW) continue;
        const id = this.healPick(); // v475: Isotônico · v522: bebidas de baú primeiro
        if (id) this.useCons(e.p.uid, id, true);
      }
    },
    recEnd(res) {
      const r = this.rec; if (!r) return;
      this.rec = null;
      const m = this.match;
      Object.assign(r, { score: res.score, win: res.win, reason: res.reason, passes: res.passes, poss: res.poss, shots: res.shots, xp: res.xp, gold: res.gold, stolen: res.stolen ? res.stolen.name : null, stealChance: res.chance });
      if (m) r.endMinute = m.minute();
      try { const k = "blpi_matches:" + r.user, list = JSON.parse(localStorage.getItem(k) || "[]"); list.unshift(r); localStorage.setItem(k, JSON.stringify(list.slice(0, 30))); } catch (e) { /* sem espaço: segue */ }
      if (window.claude && window.claude.use) window.claude.use("db").then((db) => { if (db) db.collection("matches").doc(`${r.user}-${r.no}`.replace(/[^\w-]/g, "_").slice(0, 120)).set(r).catch(() => {}); }).catch(() => {});
    },

    // Treino: sem adversário, o time passa a bola e chuta no goleiro. Todos atacam.
    // v161 · treino em dois times: quem não está no Wildcard nem na Expedição (titulares incluídos) se divide em 2 times, até 4×4 + goleiros
    // v295: quem pode treinar (fora da Expedição/Boss e do Wildcard)
    trainFree(p) { return !!p && !this.isAway(p.uid) && !this.wcPlayers().some((w) => w.uid === p.uid); },
    // v295: lados escolhidos na janela "Escolher quem treina" (null = automático)
    trainSides() { const t = this.state.trainSides; if (!t) return null; const f = (l) => (l || []).map((u) => this.player(u)).filter((p) => this.trainFree(p)); return { a: f(t.a), b: f(t.b) }; },
    setTrainSides(a, b) { this.state.trainSides = a ? { a: a.slice(0, C.TRAINING_MAX), b: (b || []).slice(0, C.TRAINING_MAX) } : null; this.save(); if (this.state.training) { clearTimeout(this.nextT); this.startMatch(); } },
    trainPool() {
      const s = this.state, away = this.expAway(), wc = new Set(this.wcPlayers().map((p) => p.uid));
      const free = (p) => p && !this.isAway(p.uid) && !wc.has(p.uid);
      const first = s.active.map((u) => s.roster.find((p) => p.uid === u)).filter(free);
      return first.concat(s.roster.filter((p) => free(p) && !first.includes(p))).slice(0, C.TRAINING_MAX * 2);
    },
    startTraining(mine) {
      this.enemies = []; this.enemyBench = []; this.enemy = null; this.enemyTeam = "Treino";
      this.myTactic = this.tactic(); this.enemyTactic = null;
      const gk = this.keeper(), pool = this.trainPool(), ts = this.trainSides();
      if (ts && ts.a.length) { if (!ts.b.length) mine = ts.a; } // v295: lados escolhidos pelo jogador; sem time B treina sozinho
      if ((ts && ts.a.length && ts.b.length) || (!(ts && ts.a.length) && pool.length >= 2)) {
        // v280: seu lado (A) é a sua escalação, completada com o elenco livre até 4; o resto vira o time B (antes alternava e o Meu time não batia com a escalação)
        const half = Math.ceil(pool.length / 2);
        const A = ts && ts.a.length ? ts.a : pool.slice(0, Math.min(C.TRAINING_MAX, half)), B = ts && ts.a.length ? ts.b : pool.slice(A.length);
        const roles = (l) => l.map((_, i) => (i < Math.ceil(l.length / 2) ? "atk" : "def"));
        this.trainTeams = [A, B];
        this.match = new BL.Match({
          teams: [A, B], roles: [roles(A), roles(B)], mods: [{}, {}], shapes: [null, null], kickShapes: [null, null], gkShapes: [null, null], oppGkShapes: [null, null], styles: [null, null], edge: [false, false],
          gk: [gk, gk], scrimmage: true, speed: C.GAME_SPEED, pitch: this.pitchId(),
          onEvent: (type, data) => this.onMatchEvent(type, data),
        });
        this.pushLog(`Treino livre: ${A.map((p) => p.short).join(", ")} × ${B.map((p) => p.short).join(", ")}`, "sys");
        this.emit("matchStart", this.match);
        return;
      }
      this.trainTeams = null;
      this.match = new BL.Match({
        teams: [mine, []], roles: [mine.map(() => "atk"), []], gk: [gk, gk], training: true, pitch: this.pitchId(),
        speed: C.GAME_SPEED,
        onEvent: (type, data) => this.onMatchEvent(type, data),
      });
      this.pushLog(`Treino: ${mine.map((p) => p.short).join(", ")} treinando passe e chute`, "sys");
      this.emit("matchStart", this.match);
    },
    // v312 · Seus mapas (C.PITCHES): campo escolhido em state.pitch; fora do dev só o Estádio (desbloqueio a definir)
    pitchUnlocked(id) { return this.dev || id === "estadio"; },
    pitchId() { const id = this.state.pitch; return id && this.pitchUnlocked(id) && C.PITCHES.some((p) => p.id === id) ? id : "estadio"; },
    setPitch(id) {
      if (!this.pitchUnlocked(id) || !C.PITCHES.some((p) => p.id === id)) return false;
      this.state.pitch = id; this.save();
      clearTimeout(this.nextT); this.startMatch(); this.emit("pitch");
      return true;
    },
    setTraining(on) {
      this.state.training = !!on; this.save();
      clearTimeout(this.nextT);
      this.startMatch();
    },
    // Fases livres: depois de vencer o Boss do mapa (zerar o modo), dá para ir para qualquer fase dele
    mapCleared(i = this.state.progress.map) { return !!(this.state.progress.cleared || {})[this.clearKey(i)]; },
    // v264 · dificuldades (C.DIFFICULTIES): a Normal usa a chave antiga do "cleared" (só o número do mapa)
    diff() { return this.state.progress.diff || 0; },
    clearKey(i, d = this.diff()) { return d ? `${d}:${i}` : i; },
    diffUnlocked(d) { return d === 0 || this.dev || (this.state.progress.diffMax || 0) >= d; },
    setDiff(d) {
      if (!C.DIFFICULTIES[d] || !this.diffUnlocked(d) || d === this.diff()) return false;
      const pr = this.state.progress;
      pr.diff = d; pr.stage = 1; pr.reach = 1; pr.runSteals = 0; this.save();
      if (this.state.training) { this.emit("resources"); this.emit("stage"); return true; }
      clearTimeout(this.nextT); this.startMatch();
      return true;
    },
    canPickStage(n) { if (this.dev || this.mapCleared()) return true; if (n == null) return false; const pr = this.state.progress; return n >= 1 && n <= Math.max(pr.reach || 1, pr.stage); }, // v615 (Mickey): fase já passada nesta volta do mapa pode ser escolhida
    pickStage(n) {
      if (!this.canPickStage(n)) return false;
      const pr = this.state.progress;
      pr.reach = Math.max(pr.reach || 1, pr.stage); pr.stage = n; this.save();
      if (this.state.training) { this.emit("resources"); this.emit("stage"); return true; } // vale quando sair do treino
      clearTimeout(this.nextT); this.startMatch();
      return true;
    },

    // Sai do treino e joga a fase n (a atual, ou qualquer uma se o modo já foi zerado)
    playStage(n) {
      const pr = this.state.progress;
      if (n !== pr.stage && !this.canPickStage(n)) return false;
      pr.reach = Math.max(pr.reach || 1, pr.stage); pr.stage = n; this.state.training = false; this.save();
      clearTimeout(this.nextT); this.startMatch();
      return true;
    },

    pushLog(text, kind = "") {
      const m = this.match ? this.match.minute() : "";
      this.log.unshift({ text, kind, minute: m });
      if (this.rec && this.rec.ev.length < 600) this.rec.ev.push([m, text]);
      if (this.log.length > 60) this.log.pop();
      this.emit("log");
    },

    onMatchEvent(type, d) {
      switch (type) {
        case "goal": {
          this.pushLog(`GOL de ${d.name}! (${d.chance}% de chance) ${d.score[0]} × ${d.score[1]}`, d.team === 0 ? "goal" : "goal-against");
          if (d.team === 0 && !this.state.training && Math.random() < C.CHEST_ON_GOAL) this.addChest("azul");
          if (BL.sfx) BL.sfx(d.team === 0 ? "goal" : "goalAgainst");
          this.emit("score");
          break;
        }
        case "shot": this.pushLog(`${d.name} chutou (${d.chance}% de gol)`, d.team === 0 ? "me" : "them"); if (BL.sfx) BL.sfx("shot"); break; // v576: som do chute
        case "mast": { const p = this.player(d.uid), v = p && ((C.MASTERY.pts[p.position] || {})[d.k] || 0); if (!v) break; // v583 (Mickey): Maestria pela posição
          const l0 = this.mastLv(p); p.mast = (p.mast || 0) + v; const l1 = this.mastLv(p); if (l1 > l0) this.pushLog(`Maestria ${l1}! ${p.short} subiu na aba Marcos do PC`, "steal"); break; }
        case "legend": this.pushLog(`LANCE LENDÁRIO! ${d.who}: ${d.name}`, d.team === 0 ? "goal" : "them"); // v582
          if (d.team === 0 && !this.state.training) { this.legendXp = true; const L = this.state.lances || (this.state.lances = {}), k = d.charId + ":" + d.kind, nw = !L[k]; L[k] = (L[k] || 0) + 1; if (nw) this.pushLog(`Novo lance na coleção: ${d.name}`, "steal"); } break;
        case "trickGo": if (BL.sfx) BL.sfx(d.team === 0 ? "dribble" : "dribbleEnemy"); break; // v576: caneta, vaca e puxada tocam o som do drible quando a bola sai do pé
        case "pass": if (BL.sfx) BL.sfx("pass"); break;
        case "save": if (BL.sfx) BL.sfx(d.parry ? "parry" : "save"); if (!d.parry) this.pushLog(`Goleiro ${d.team === 0 ? "do seu time" : "adversário"} segurou`, d.team === 0 ? "me" : "them"); break;
        case "dribble": if (d.team === 0) this.x1Drib = (this.x1Drib || 0) + 1; /* v561: XP por drible no X1 */ this.pushLog(`${d.name} driblou ${d.vs}`, d.team === 0 ? "me" : "them"); if (BL.sfx && !d.noSnd) BL.sfx(d.team === 0 ? "dribble" : "dribbleEnemy"); break;
        case "tackle": this.pushLog(`${d.name} roubou a bola de ${d.vs}`, d.team === 0 ? "me" : "them"); if (BL.sfx) BL.sfx("stolen"); break;
        case "log": this.pushLog(d.text, d.team === 0 ? "me" : "them"); break;
        case "skill": this.emit("skills"); break; // v623
        case "halftime": return this.halftime(d.match);
        case "golden": this.pushLog("GOLDEN GOL! Quem marcar primeiro vence", "sys"); break;
        case "end": setTimeout(() => this.endMatch(d), 10); break;
      }
      return undefined;
    },

    // v139 · Vestiário: descanso natural (+15 nos dois times), Módulo de cura gasta itens (VIP), resumo,
    // reservas, troca de formação grátis e leitura do técnico. A partida fica congelada até voltar.
    halftime(match) {
      const s = this.state;
      if (!match.training && (s.subQueue || []).length) this.flushSubs(true); // v361: trocas marcadas entram no 2º tempo
      match.ents.forEach((e) => { e.drainK = 1; if (!e.gk) e.energy = Math.min(100, e.energy + C.HALFTIME_REST + (match.ifx(e).rest || 0)); }); // v524: Camisa Reserva +20 // v522: efeito da Vitamina acaba no fim do tempo
      const notes = [`descanso +${C.HALFTIME_REST} de energia`];
      if (s.healModule) { match.field(0).forEach((e) => { e.energy = 100; }); notes.push("Módulo de Descanso: energia cheia"); } // v509 (v512: Módulo de cura → Módulo de Descanso): item permanente da Loja de Diamantes
      if (s.vip && s.settings.autoGatorade) match.field(0).forEach((e) => { // Cura automática (VIP): mesmo limite da partida, sem espera no vestiário
        if (e.energy >= C.HEAL_AUTO_BELOW) return;
        const id = this.healPick(); // v475: Isotônico · v522: bebidas de baú primeiro
        if (id) { e.healT = -999; this.useCons(e.p.uid, id, true); }
      });
      this.pushLog(`Intervalo: ${notes.join(" · ")}`, "sys");
      if (!match.training) {
        match.paused = true; match.stateT = 0.6; // o vestiário substitui a placa longa de INTERVALO
        this.vest = { until: Date.now() + C.VESTIARIO_SECONDS * 1000 };
        clearTimeout(this.vestT); this.vestT = setTimeout(() => this.vestEnd(), C.VESTIARIO_SECONDS * 1000);
        this.emit("vestiario");
      }
      this.emit("resources");
      return { text: "Vestiário" };
    },
    // qualquer mexida no vestiário reinicia a contagem (quem está olhando decide; quem saiu, o jogo volta sozinho)
    vestTouch() {
      if (!this.vest) return;
      this.vest.until = Date.now() + C.VESTIARIO_SECONDS * 1000;
      clearTimeout(this.vestT); this.vestT = setTimeout(() => this.vestEnd(), C.VESTIARIO_SECONDS * 1000);
    },
    vestEnd() {
      clearTimeout(this.vestT);
      if (!this.vest) return;
      this.vest = null;
      if (this.match) this.match.paused = false;
      this.emit("vestiario"); this.emit("resources");
    },
    vestStats() {
      const m = this.match, pct = (a, b) => (a + b ? Math.round((100 * a) / (a + b)) : 50), acc = (t) => (m.passTry[t] ? Math.round((100 * m.passes[t]) / m.passTry[t]) : 0);
      const poss = m.possessionPct();
      return { poss: [poss, 100 - poss], shots: [pct(m.shots[0], m.shots[1]), pct(m.shots[1], m.shots[0])], passAcc: [acc(0), acc(1)], steals: [pct(m.steals[0], m.steals[1]), pct(m.steals[1], m.steals[0])] };
    },
    // leitura do técnico no vestiário: já viu um tempo inteiro, então revela a formação; técnico fraco dá uma dica forte
    vestReading() {
      const t = this.enemyTactic; if (!t) return null;
      if (this.coachReadsClear()) return `${this.enemyTeam} está jogando na formação ${t.name}${t.type ? ` (${C.FORMATION_TYPE[t.type]})` : ""}`;
      const sum = { toque: "muito toque de bola e passes curtos", blitz: "pressão alta e muita gente no ataque", muralha: "bloco fechado atrás e contra-ataque" }[t.style];
      return sum ? `${this.enemyTeam} jogou o 1º tempo com ${sum}` : `${this.enemyTeam} ${this.tacticHint(t)}`;
    },
    // reservas: até 2, escolhidas fora da partida entre quem não é titular
    bench() {
      const s = this.state, act = this.activePlayers();
      s.bench = (s.bench || []).filter((u) => !this.isAway(u) && s.roster.some((p) => p.uid === u) && !act.some((p) => p.uid === u)).slice(0, C.BENCH_SIZE);
      return s.bench.map((u) => s.roster.find((p) => p.uid === u));
    },
    setBench(i, uid) {
      const s = this.state; this.bench();
      const b = s.bench.slice(); if (uid) { const j = b.indexOf(uid); if (j >= 0) b.splice(j, 1); b[i] = uid; } else b.splice(i, 1);
      s.bench = b.filter(Boolean).slice(0, C.BENCH_SIZE); this.save(); this.emit("roster");
    },
    // v361 (Mickey): arrastar reserva para um titular. Na partida a troca fica marcada e vale no intervalo
    // (entra em campo no 2º tempo) ou no fim da partida; depois disso segue valendo para as próximas
    queueSub(inUid, outUid) {
      const s = this.state, m = this.match;
      if (!this.bench().some((p) => p.uid === inUid) || inUid === outUid) return false;
      if (!m || m.training || m.state === "ended") { this.commitSub(inUid, outUid); return "now"; }
      s.subQueue = (s.subQueue || []).filter((q) => q.in !== inUid && q.out !== outUid); s.subQueue.push({ in: inUid, out: outUid });
      const r = s.roster, a = r.find((p) => p.uid === inUid), b = r.find((p) => p.uid === outUid);
      this.pushLog(`Troca marcada: ${a?.short} entra no lugar de ${b?.short} no intervalo`, "sys");
      this.save(); this.emit("roster"); return "queued";
    },
    cancelSub(inUid) { const s = this.state; s.subQueue = (s.subQueue || []).filter((q) => q.in !== inUid); this.save(); this.emit("roster"); },
    // troca definitiva: o reserva vira titular e quem saiu ocupa a vaga dele no banco
    commitSub(inUid, outUid) {
      const s = this.state, cur = this.lineup(), i = cur.indexOf(outUid);
      if (i < 0 || this.isAway(inUid) || !s.roster.some((p) => p.uid === inUid)) return false;
      const nb = (s.bench || []).map((u) => (u === inUid ? outUid : u)); // quem saiu fica na vaga do reserva
      this.swapLineup(inUid, outUid);
      s.bench = nb; this.save();
      this.emit("roster"); return true;
    },
    flushSubs(live) {
      const s = this.state, q = s.subQueue || []; s.subQueue = [];
      const m = this.match;
      q.forEach((x) => {
        if (!this.bench().some((p) => p.uid === x.in)) return; // tirou o reserva do banco depois de marcar
        if (live && m) { // no intervalo: entra em campo já no 2º tempo
          const p = s.roster.find((y) => y.uid === x.in), e = m.field(0).find((y) => y.p.uid === x.out);
          if (p && e && !m.field(0).some((y) => y.p === p)) { const out = e.p; m.substitute(e, p); m.played = m.played || []; if (!m.played.includes(p)) m.played.push(p); this.pushLog(`Substituição: sai ${out.short}, entra ${p.short}`, "sys"); }
        }
        this.commitSub(x.in, x.out);
      });
      if (q.length) this.save();
    },
    benchFree() { const m = this.match; return this.bench().filter((p) => !(m && m.field(0).some((e) => e.p === p))); },
    subIn(benchUid, outUid) {
      const m = this.match; if (!m || !this.vest) return false;
      const p = this.benchFree().find((x) => x.uid === benchUid), e = m.field(0).find((x) => x.p.uid === outUid);
      if (!p || !e) return false;
      const out = e.p; m.substitute(e, p); m.played = m.played || []; if (!m.played.includes(p)) m.played.push(p);
      this.pushLog(`Substituição: sai ${out.short}, entra ${p.short}`, "sys");
      this.vestTouch(); this.emit("roster");
      return true;
    },
    vestTactic(id) {
      const tac = this.tactics().find((t) => t.id === id); if (!tac || !this.vest) return;
      this.applyLive(tac); this.pushLog(`Vestiário: formação ${tac.name}`, "sys"); this.vestTouch();
    },

    endMatch(r) {
      if (this.match && this.match.training) return this.endTraining(r);
      if (this.gymFight) return this.gyEnd(r); // v622
      if (this.clanFight && BL.Clan) return BL.Clan.fightEnd(r); // v624: Guilda
      if (this.pvpFight && BL.PvP) return BL.PvP.fightEnd(r); // v630: Arena PvP
      if ((this.state.subQueue || []).length) this.flushSubs(false); // v361: trocas marcadas no 2º tempo valem para a próxima
      const s = this.state, pr = s.progress, an = s.analyzer;
      const boss = this.isBoss();
      const stage = pr.stage;
      let xp = this.matchXpBase(stage) * this.rarXp() * ((C.XP_RULE && C.XP_RULE.early || [])[pr.map] || 1); // v585 (Mickey): pelo nível, raridade e mapa · v664: começo acelerado (1×1, 2×2, 3×3)
      const accK = (C.XP_BASE + C.XP_PER_STAGE * (stage - 1)) / xp; // v585: a conta (técnico) segue no ritmo antigo, para os goleiros não subirem cedo demais
      let gold = C.GOLD_BASE + C.GOLD_PER_STAGE * (stage - 1);
      if (C.X1 && this.map.size === 1) { const g = xp * C.X1.xp.goalK; xp += g * (r.score[0] + C.X1.xp.drib * (this.x1Drib || 0)); } // v561 (Mickey): no X1 cada gol e cada drible (0,8 de um gol) dão XP
      if (boss) { xp *= C.BOSS_REWARD_MULT; gold *= C.BOSS_REWARD_MULT; }
      if (!r.win) { xp *= C.LOSS_REWARD_MULT; gold *= C.LOSS_REWARD_MULT; }
      const dm = C.DIFFICULTIES[this.diff()].reward; xp *= dm; gold *= dm; // v264
      if (this.goldTeam && r.win) { xp *= C.GOLDEN_TEAM.xp; gold *= C.GOLDEN_TEAM.gold; } // v582: Time Dourado
      if (this.legendXp) xp *= 1 + C.LEGEND_PLAY.xp; // v582: jogada lendária do seu time
      gold *= 1 + (this.coachFx().gold || 0); // v417: Kōrai Goryeo
      const mf = this.mgrFx(); xp *= 1 + (mf.xp || 0); gold *= (1 + (mf.gold || 0)) * (1 + (mf.goldX || 0)); // v473: itens do treinador (v527: Cofre do Presidente)
      if (this.boostLeft("xp")) xp *= 1 + C.DIA_BOOST.xp; if (this.boostLeft("gold")) gold *= 1 + C.DIA_BOOST.gold; xp *= 1 + this.gyBuff("xp") / 100; gold *= 1 + this.gyBuff("gold") / 100; /* v622: buff do ginásio */ // v502: boosts da Loja de Diamantes
      xp = Math.round(xp); gold = Math.round(gold);

      an.matches++; r.win ? an.wins++ : an.losses++;
      const ca = s.career || (s.career = { wins: 0, goals: 0, steals: 0 }); if (r.win) ca.wins++; ca.goals += r.score[0]; if (r.win) { this.misEv("win"); if (!r.score[1]) this.misEv("clean"); } this.misEv("goals", r.score[0]); /* v534: missões */ { const mc = { map: pr.map, st: stage, sz: this.map.size, t: this.myTactic && this.myTactic.id, d: this.diff(), gd: r.score[0] - r.score[1], g: r.score[0] }; if (r.win) ["stage", "tac", "mode", "margin", "dif"].forEach((k) => this.misEv(k, 1, mc)); this.misEv("hat", 1, mc); } /* v538 */ // v287: números da Jornada (perfil)
      an.xp += xp; an.goldGained += gold; an.goalsFor += r.score[0]; an.goalsAgainst += r.score[1];
      s.gold += gold;
      const ups = this.giveXp(xp, this.match && this.match.played ? this.activePlayers().concat(this.match.played) : null, false, { acc: Math.round(xp * accK) }); // v585: teto de níveis // v139: reserva que entrou também ganha
      // pontos de EV vão para o banco da conta (distribui na janela do jogador)
      const ev = (r.win ? C.EV_WIN : C.EV_LOSS) * (boss ? C.BOSS_REWARD_MULT : 1);
      const evx = ev * (1 + (this.mgrFx().ev || 0)) + (s.evCarry || 0), evn = Math.floor(evx + 1e-9); s.evCarry = evx - evn; // v473: itens do treinador (fração guardada para a próxima)
      s.evPoints = (s.evPoints || 0) + evn;

      // v128 (Mickey): ao vencer, uma roleta escolhe UM adversário e só ele tem a chance de roubo
      let stolen = null, chance = 0, roll = 0, target = -1, prologue = null;
      if (r.win && boss && this.prologue()) { // v558 (Mickey): vitória no Mini Boss do Prólogo = roleta de um Comum garantido, sem Proposta
        const bossIds = C.MAPS.map((mp) => mp.boss && !mp.boss.keepPool && mp.boss.charId).filter(Boolean), have = s.roster.map((p) => p.charId);
        let pool = BL.CHARACTERS.filter((c) => !bossIds.includes(c.id) && !have.includes(c.id)); if (!pool.length) pool = BL.CHARACTERS.filter((c) => !bossIds.includes(c.id));
        const ch = U.pick(pool); stolen = BL.makePlayer(ch.id, { rarity: C.PROLOGUE.stealRarity, level: 1 }); chance = 100; roll = 0;
        s.roster.push(stolen); pr.runSteals++; an.steals++; s.career.steals++; this.misEv("steal");
        if (s.roster.length >= 2 && !pr.unlocked2x2) pr.unlocked2x2 = true;
        prologue = { pool: pool.map((c) => c.id) };
      } else if (r.win && this.enemies.length) {
        target = Math.floor(Math.random() * this.enemies.length);
        const en = this.enemies[target];
        chance = BL.stealChance(en, stage, r.score[0]);
        if (this.boostLeft("steal")) chance = Math.min(100, chance + C.DIA_BOOST.steal); // v502
        if (this.gyBuff("steal")) chance = Math.min(100, chance + this.gyBuff("steal")); // v622: buff do ginásio
        const ca = this.stealArmed(); // v526 (Mickey): igual Pokébola: sem Proposta ou contrato equipado não tem roubo; gasta 1 por tentativa
        if (!ca) { chance = 0; this.pushLog("Sem Proposta ou contrato equipado: nada de roubo. Equipe um na Mochila.", "sys"); }
        else if (C.SUPPLIES[ca].wc) { const q = C.SUPPLIES[ca], b = this.contractBonus(ca, { en, r, m: this.match, boss }); chance = Math.min(100, (chance + b.add + (this.mgrFx().scout || 0)) * b.mult); /* v527: Olheiro */ this.cons()[ca]--;  this.pushLog(`${q.name} usado: ${b.mult !== 1 ? `×${String(b.mult).replace(".", ",")}` : `+${b.add} pontos`} · chance de roubo ${Math.round(chance * 10) / 10}%`, "sys"); if (ca === "ct-luxo") s.luxoNext = true; }
        else { const arm = ca, q = C.SUPPLIES[arm]; chance = q.sure ? 100 : Math.min(100, chance + q.steal + (this.mgrFx().scout || 0)); /* v527: Contrato Blue Lock = 100%; Olheiro (treinador) */ this.cons()[arm]--;  this.pushLog(`${q.name} usada: chance de roubo ${Math.round(chance * 10) / 10}%`, "sys"); }
        roll = Math.random() * 100;
        if (chance > 0 && roll < chance) {
          stolen = BL.makePlayer(en.charId, { rarity: en.rarity, shiny: en.shiny, level: 1 });
          if (s.luxoNext) stolen.luxo = 10; // v525: Contrato de Luxo: +20% de XP nas 10 primeiras partidas
          s.roster.push(stolen);
          pr.runSteals++; an.steals++; s.career.steals++; this.misEv("steal");
          if (s.roster.length >= 2 && !pr.unlocked2x2) pr.unlocked2x2 = true;
        }
      }
      s.luxoNext = false;
      if (!r.win && this.enemies.length) { const b = s.beatenBy || (s.beatenBy = []); this.enemies.forEach((e) => { if (!b.includes(e.charId)) b.push(e.charId); }); if (b.length > 60) b.splice(0, b.length - 60); } // v525: Contrato de Revanche
      if (r.win && boss) this.dropSub("boss"); // v525
      if (r.win && boss && C.SKILL_BOOK && Math.random() < C.SKILL_BOOK.boss) this.skBook(this.skRoll(C.SKILL_BOOK.wBoss)); // v623: Boss sempre dá um livro de habilidade: sub-item raro na vitória contra o Boss
      if (r.win && boss && Math.random() < C.CHAR_ITEM_BOSS) { const ci = U.pick(BL.CHAR_ITEM_LIST); s.inventory.push(ci.id); this.pushLog(`Item de personagem! ${ci.name} foi para a Mochila`, "steal"); } // v527
      if (r.win && boss && Math.random() < C.COFRE_BOSS) { s.inventory.push("tr-cofre-pres"); this.pushLog("Cofre do Presidente! Foi para a Mochila", "steal"); } // v527
      if (r.win && C.DIAMOND_DROP && Math.random() < C.DIAMOND_DROP.win) { s.diamonds = (s.diamonds || 0) + C.DIAMOND_DROP.n; this.pushLog(`DIAMANTE! Caiu ${C.DIAMOND_DROP.n} Diamante na vitória`, "steal"); this.emit("toast", `◆ Caiu ${C.DIAMOND_DROP.n} Diamante na vitória!`); } // v680
      if (r.win && Math.random() < C.CHEST_ON_WIN) this.addChest("azul"); // v265: baú azul só na vitória
      if (r.win && Math.random() < C.CHEST_EPIC_ON_WIN) this.addChest("epico"); // v380
      if (r.win && Math.random() < C.CHEST_LEG_ON_WIN) this.addChest("lendario");

      // progressão
      let note = "", firstClear = false, unlockDiff = "";
      const m = this.map.id;
      if (boss || stage === C.STAGES_PER_MAP) {
        if (r.win && boss) {
          pr.bossWins++; this.misEv("boss");
          firstClear = !this.mapCleared();
          if (firstClear) pr.cleared = { ...(pr.cleared || {}), [this.clearKey(pr.map)]: true };
          if (firstClear) Object.entries(C.SKILL_UNLOCK_CLEAR || {}).forEach(([id, c]) => { if (c[0] === pr.map && c[1] === this.diff() && C.SKILL_DEF[id]) { this.skLib(); this.pushLog(`Habilidade liberada: ${C.SKILL_DEF[id].name}`, "steal"); if (BL.UI && BL.UI.toast) BL.UI.toast(`Habilidade liberada: ${C.SKILL_DEF[id].name}!`, "good"); this.emit("skills"); } }); // v653 (Mickey): Épica/Lendária pelo Boss no Inferno/Tormento
          const nd = this.diff() + 1; // v264: vencer o Boss do último ato libera a próxima dificuldade
          if (pr.map === C.MAPS.length - 1 && C.DIFFICULTIES[nd] && (pr.diffMax || 0) < nd) { pr.diffMax = nd; unlockDiff = C.DIFFICULTIES[nd].name; }
        }
        note = boss
          ? (r.win ? `Boss derrotado! O mapa recomeça em ${m}-1 com novos adversários.` : `Derrota para o Boss. De volta ao ${m}-1 com novos adversários.`)
          : `Fim do mapa. De volta ao ${m}-1 com novos adversários.`;
        if (pr.runSteals === 0) note += " Nenhum jogador roubado nesta rodada.";
        if (firstClear) note += ` Modo ${this.map.mode} zerado: agora você escolhe qualquer fase do mapa.`;
        if (unlockDiff) note += ` Dificuldade ${unlockDiff} liberada na janela Mapa!`;
        pr.stage = 1; pr.reach = 1; pr.runSteals = 0; pr.runs++;
      } else if (r.win && !pr.repeat) {
        pr.stage++; pr.reach = Math.max(pr.reach || 1, pr.stage);
      }

      const res = { ...r, prologue, xp, gold, ev, stolen, chance: Math.round(chance * 10) / 10, roll: Math.round(roll * 10) / 10, target, ups, note, boss, enemy: this.enemy, stage };
      if (this.enemyTactic && this.map.size > 1) this.pushLog(`Formação deles: ${this.enemyTactic.name}${this.enemyTactic.id === this.prefTactic(this.enemyTeam).id ? " (a de sempre)" : " (fora do estilo de sempre)"}`, "sys");
      this.pushLog(`${r.win ? "Vitória" : "Derrota"} ${r.score[0]} × ${r.score[1]} · +${xp} XP · +${gold} Gold · +${ev} EV`, r.win ? "goal" : "goal-against");
      if (stolen) this.pushLog(`ROUBADO! ${stolen.name} (${BL.rarity(stolen.rarity).name}) entrou no seu time`, "steal");
      else if (r.win && chance > 0) this.pushLog(`Tentativa de roubo falhou (${res.chance}%)`, "sys");
      if (r.win && this.enemies.length && s.stealArm && !(this.cons()[s.stealArm] > 0)) this.stealOut(s.stealArm); // v526: acabou o equipado
      if (note) this.pushLog(note, "sys");
      this.save();
      this.recEnd(res);
      this.emit("matchEnd", res);
      const delay = (r.win ? 3400 : 2600) / Math.max(1, C.GAME_SPEED * 0.6); // vitória: tempo para a roleta de roubo
      clearTimeout(this.nextT);
      this.nextT = setTimeout(() => this.startMatch(), delay);
    },

    // Treino não dá XP nem Gold: só recomeça a troca de passes
    endTraining(r) {
      clearTimeout(this.nextT);
      this.nextT = setTimeout(() => this.startMatch(), 1200);
    },

    mastLv(p) { const n = C.MASTERY.need; let l = 1; for (let i = 1; i < n.length; i++) if ((p.mast || 0) >= n[i]) l = i + 1; return l; }, // v583
    // v585 (Mickey): XP base da partida. Mapa com pace: pace × nível médio dos inimigos (sem os níveis da dificuldade). Sem pace (mapa 1): conta antiga por fase.
    enemyLv() { const en = this.enemies || [], dl = C.DIFFICULTIES[this.diff()].levels; return en.length ? en.reduce((a, e) => a + Math.max(1, e.level - dl), 0) / en.length : 0; },
    matchXpBase(stage) { const R = C.XP_RULE, pc = R && R.pace[this.state.progress.map], lv = this.enemyLv(); return pc && lv ? pc * lv : C.XP_BASE + C.XP_PER_STAGE * (stage - 1); },
    rarXp() { const R = C.XP_RULE, en = this.enemies || []; if (!R || this.goldTeam || !en.length) return 1; return en.reduce((a, e) => a + (R.rar[e.rarity] || 1) + (e.shiny ? R.shiny : 0), 0) / en.length; }, // Time Dourado já paga ×3
    giveXp(xp, list, noAcc, ref) { // v475: noAcc = só o jogador ganha (itens de XP) · v585: ref = { acc } da partida (teto de níveis, XP da conta)
      const s = this.state, ups = [], R = C.XP_RULE;
      (list || this.activePlayers()).filter((p) => !p.temp).forEach((p) => {
        const g = xp, top = ref && R ? p.level + ((R.maxByMap || [])[s.progress.map] || R.maxLevels) : Infinity; // v664: teto por mapa // v586: reforço ×3 removido (Mickey)
        p.xp += p.luxo > 0 && !noAcc ? Math.round(g * 1.2) : g; if (p.luxo > 0 && !noAcc) p.luxo--; // v525: Contrato de Luxo
        while (p.level < C.PLAYER_MAX_LEVEL && p.level < top && p.xp >= C.playerXpToNext(p.level)) { p.xp -= C.playerXpToNext(p.level); p.level++; ups.push(`${p.short} subiu para o Nv ${p.level}`); }
        if (p.level >= top) p.xp = Math.min(p.xp, C.playerXpToNext(p.level) - 1); // v585: no máximo maxLevels níveis por partida
      });
      const a = s.account; if (noAcc) return ups;
      a.xp += ref && ref.acc != null ? ref.acc : xp;
      while (a.level < C.ACCOUNT_MAX_LEVEL && a.xp >= C.accountXpToNext(a.level)) { a.xp -= C.accountXpToNext(a.level); a.level++; ups.push(`Conta subiu para o Nv ${a.level}`); Object.entries(C.SKILL_UNLOCK_LV || {}).forEach(([id, n]) => { if (n === a.level && C.SKILL_DEF[id]) ups.push(`Habilidade liberada: ${C.SKILL_DEF[id].name}`); }); } // v652: rara nova pelo nível da conta
      return ups;
    },

    // ---------- Wildcard (v119): treino idle dos jogadores fora da escalação ----------
    wc() {
      const s = this.state;
      if (!s.wildcard) s.wildcard = { slots: Array(C.WILDCARD_SLOTS).fill(null), unlocked: C.WILDCARD_SLOTS_START, last: Date.now(), acc: {}, dropAcc: 0 };
      return s.wildcard;
    },
    // modo dev: os 4 slots liberados e qualquer jogador (até escalado ou de teste) pode treinar, só para ver as animações
    wcUnlocked() { return this.dev ? C.WILDCARD_SLOTS : this.wc().unlocked; },
    wcLineup() { return this.dev ? new Set() : new Set(this.activePlayers().map((p) => p.uid)); },
    wcEligible() { const on = this.wcLineup(), w = this.wc(), pool = this.dev ? this.state.roster.concat((this.devFill || []).filter(Boolean)) : this.state.roster; return pool.filter((p) => !on.has(p.uid) && !w.slots.includes(p.uid) && !this.isAway(p.uid)); },
    // v124 (Mickey): o XP do Wildcard é dividido entre quem treina (1 = 100%, 2 = 50% cada, 3 = 33,3%, 4 = 25%)
    wcRate(n) { return C.WILDCARD_XP_PER_MIN / Math.max(1, n); },
    wcPlayers() { const w = this.wc(); return w.slots.map((u) => u && this.player(u)).filter(Boolean); },
    wcAdd(uid) {
      const w = this.wc(); this.wcTick();
      const i = w.slots.findIndex((u, k) => k < this.wcUnlocked() && !u);
      if (i < 0 || !this.player(uid) || this.wcLineup().has(uid) || w.slots.includes(uid)) return false;
      w.slots[i] = uid; this.save(); this.emit("wildcard"); return true;
    },
    wcRemove(i) { const w = this.wc(); this.wcTick(); w.slots[i] = null; this.save(); this.emit("wildcard"); },
    // v513 (Mickey): Fazenda do Wildcard: planta insumos (Gold da semente), colhe depois de min minutos (tempo real, também com o jogo fechado)
    farm() { const w = this.wc(), F = C.WC_FARM; if (!w.farm) w.farm = { plots: Array(F.plots).fill(null), unlocked: F.plotsStart, bag: {} }; w.farm.plots = w.farm.plots.map((p) => (p && F.crops[p.crop] ? p : null)); return w.farm; }, // v525: canteiro com insumo antigo (Papel, Tinta...) fica livre
    farmUnlocked() { return this.dev ? C.WC_FARM.plots : this.farm().unlocked; },
    farmUnlock() { const f = this.farm(), F = C.WC_FARM, i = f.unlocked; if (i >= F.plots) return { ok: false, msg: "Todos os canteiros já estão liberados." };
      const cost = F.plotGold[i] || 0; if (!this.dev && this.state.gold < cost) return { ok: false, msg: `Precisa de ${cost} Gold.` };
      if (!this.dev) this.state.gold -= cost; f.unlocked++; this.save(); this.emit("wildcard"); return { ok: true }; },
    farmPlant(i, crop) { const f = this.farm(), cr = C.WC_FARM.crops[crop];
      if (!cr || i < 0 || i >= this.farmUnlocked() || f.plots[i]) return { ok: false, msg: "Canteiro indisponível." };
      if (!this.dev && this.state.gold < cr.seed) return { ok: false, msg: `Precisa de ${cr.seed} Gold para a semente.` };
      if (!this.dev) this.state.gold -= cr.seed; const now = Date.now(); f.plots[i] = { crop, at: now, ready: now + cr.min * 60000 * (this.dev ? 0.01 : 1) };
      this.save(); this.emit("wildcard"); return { ok: true }; },
    farmLeft(i) { const p = this.farm().plots[i]; return p ? Math.max(0, p.ready - Date.now()) : 0; }, // ms até colher
    farmHarvest(i) { const f = this.farm(), p = f.plots[i]; if (!p || Date.now() < p.ready) return { ok: false, msg: "Ainda não está pronto." };
      const cr = C.WC_FARM.crops[p.crop], n = U.randInt(cr.yield[0], cr.yield[1]) + (Math.random() < (this.mgrFx().farm || 0) ? 1 : 0); /* v527: Wildcard (itens do treinador) */ f.bag[p.crop] = (f.bag[p.crop] || 0) + n; f.plots[i] = null; this.misEv("harvest"); /* v534: corrige a colheita (comentário engolia o código) */
      this.save(); this.emit("wildcard"); return { ok: true, crop: p.crop, n, msg: `Colheu ${n}× ${cr.name}` }; },
    // v525 (Mickey): sub-item raro fora da Fazenda (baú épico/lendário, vitória no Boss): sorteia Raro ou Muito raro e um sub-item dela
    dropSub(src) { const D = C.WC_SUB_DROP[src]; if (!D || Math.random() >= D.p) return null;
      const rr = U.weighted(Object.entries(D.w).map(([v, w]) => ({ v, w }))), pool = Object.keys(C.WC_FARM.crops).filter((k) => C.WC_FARM.crops[k].rarity === rr); if (!pool.length) return null;
      const id = U.pick(pool), bag = this.farm().bag; bag[id] = (bag[id] || 0) + 1; this.pushLog(`Sub-item do Wildcard: ${C.WC_FARM.crops[id].name}`, "steal"); return id; },
    // Bancada: insumos → Proposta na Mochila (state.cons, o mesmo estoque da Loja)
    canCraft(id) { const r = C.WC_RECIPES[id], bag = this.farm().bag; return !!r && Object.entries(r).every(([k, n]) => (bag[k] || 0) >= n); },
    craft(id) { const r = C.WC_RECIPES[id], q = C.SUPPLIES[id] || C.CONSUMABLES[id]; /* v530: bebidas de energia também */ if (!r || !q) return { ok: false, msg: "Receita inexistente." };
      if (!this.dev && !this.canCraft(id)) return { ok: false, msg: "Faltam insumos." };
      const bag = this.farm().bag; if (!this.dev) Object.entries(r).forEach(([k, n]) => { bag[k] -= n; });
      const c = this.cons(); c[id] = (c[id] || 0) + 1; this.misEv("craft"); this.save(); this.emit("wildcard"); return { ok: true, msg: `Criou 1× ${q.name}` }; },
    // Soma o XP do tempo passado (inclusive offline) e sorteia drops. Devolve o resumo para avisar o jogador.
    wcTick() {
      const s = this.state; if (!s) return null;
      const w = this.wc(), now = Date.now();
      const min = Math.min(Math.max(0, now - (w.last || now)) / 60000, C.WILDCARD_OFFLINE_MAX_MIN);
      w.last = now;
      const on = this.wcLineup();
      const un = this.wcUnlocked();
      w.slots = w.slots.map((u, k) => (u && k < un && this.player(u) && !on.has(u) && !this.isAway(u) ? u : null)); // escalado, vendido ou em expedição sai do treino
      const ps = this.wcPlayers(); if (!ps.length || min <= 0) return null;
      let xp = 0; const ups = [], items = [];
      ps.forEach((p) => {
        w.acc[p.uid] = (w.acc[p.uid] || 0) + min * this.wcRate(ps.length);
        const n = Math.floor(w.acc[p.uid]); if (!n) return;
        w.acc[p.uid] -= n; p.xp += n; xp += n;
        while (p.level < C.PLAYER_MAX_LEVEL && p.xp >= C.playerXpToNext(p.level)) { p.xp -= C.playerXpToNext(p.level); p.level++; ups.push(`${p.short} subiu para o Nv ${p.level} no Wildcard`); }
      });
      w.dropAcc = (w.dropAcc || 0) + min * ps.length;
      while (w.dropAcc >= 1) {
        w.dropAcc -= 1;
        if (Math.random() < C.WILDCARD_DROP_PER_MIN) {
          const rar = U.weighted(Object.entries(BL.ITEM_RARITY_WEIGHT).map(([v, wt]) => ({ v, w: wt })));
          const pool = BL.ITEMS.filter((it) => !it.shop && it.rarity === rar), item = U.pick(pool.length ? pool : BL.ITEMS); // v479: camisa básica só na Loja
          s.inventory.push(item.id); items.push(item.name);
        }
      }
      ups.forEach((t) => this.pushLog(t, "sys"));
      items.forEach((n) => this.pushLog(`Wildcard: caiu ${n}`, "steal"));
      if (xp || items.length) { this.save(); this.emit("roster"); }
      return { min, xp, ups, items };
    },

    // ---------- Expedição (v158; trilha de 100 níveis na v159): 1 jogador sai para farmar em tempo real ----------
    exp() {
      const s = this.state;
      if (!s.exped) s.exped = { level: 1, xp: 0, count: 0, cur: null, last: null };
      const x = s.exped;
      if (x.cur && !x.cur.lvl) x.cur.lvl = 1; // save da v158 (era por região)
      if (x.prog == null) { x.prog = 0; delete x.xp; } // v164: XP de Expedição virou barra de progresso por nível
      return x;
    },
    // v181 · Boss (simulação): a equipe de 3 enviada fica fora de partidas, reservas, treino, Wildcard e Expedição até resgatar o baú
    bossRun() { return (this.state && this.state.bossRun) || null; },
    bossAway() { const r = this.bossRun(); return r ? r.team : []; },
    isAway(uid) { return !!uid && (uid === this.expAway() || this.bossAway().includes(uid)); },
    bossBlank() { return { gols: 0, assist: 0, roubos: 0, passes: 0, bloqueios: 0 }; },
    bossForce(power) { return Math.max(0.5, Math.min(2.5, 1 + Math.log10(Math.max(1, power) / 900) * 0.6)); },
    bossRoll(st, pos, f) { const R = C.BOSS_RUN.rates[pos] || C.BOSS_RUN.rates.atacante; for (const k in R) if (Math.random() < Math.min(0.95, R[k] * f)) st[k]++; },
    bossPoints(st, pos) { const W = C.BOSS_RUN.points[pos] || {}; let n = 0; for (const k in W) n += (st[k] || 0) * W[k]; return n; },
    bossTicks() { const B = C.BOSS_RUN; return Math.round(B.minutes * 60 / B.tickSec); },
    bossFake() {
      const B = C.BOSS_RUN, pool = BL.CHARACTERS.filter((c) => !c.extra), used = new Set();
      const A = ["Ego", "Blue", "Striker", "Rei", "Gênio", "Fera", "Lock", "Neo", "Monstro", "Visão", "Raio", "Muralha", "Ás", "Lobo", "Dragão"], Z = ["FC", "Lock", "Kings", "United", "11", "Elite", "Squad", "Crew", "Team", "BR"];
      return Array.from({ length: B.fakeCount }, () => {
        let name; do { name = `${BL.util.pick(A)}${BL.util.pick(Z)}${BL.util.randInt(1, 99)}`; } while (used.has(name)); used.add(name);
        const tier = Math.pow(Math.random(), 1.8); // poucos times muito fortes
        const team = Array.from({ length: C.BOSS_TEAM_SIZE }, () => {
          const ch = BL.util.pick(pool), power = Math.round(900 * Math.pow(10, tier * 1.45 * BL.util.rand(0.9, 1.1))), st = this.bossBlank(), f = this.bossForce(power);
          for (let t = 0; t < this.bossTicks(); t++) this.bossRoll(st, ch.position, f);
          return { name: ch.name, id: ch.id, ini: ch.initials, pos: ch.position, power, st };
        });
        return { name, team };
      });
    },
    // v183 · boss do dia e janela 18h–0h (modo dev ignora o horário para testes)
    bossOf(d) { return C.BOSS_ROTATION[(d || new Date()).getDay()]; },
    bossOpen(d) { const h = (d || new Date()).getHours(); return h >= C.BOSS_WINDOW.open && h < C.BOSS_WINDOW.close; },
    bossSend(ids) {
      const s = this.state, B = C.BOSS_RUN;
      if (this.bossRun()) return { ok: false, msg: "Sua equipe já está no Boss." };
      if (!this.dev && s.bossDay === new Date().toDateString()) return { ok: false, msg: "Você já enviou a equipe hoje. Amanhã chega outro boss." };
      const team = (ids || []).filter((u) => this.player(u) && u !== this.expAway());
      if (team.length !== C.BOSS_TEAM_SIZE) return { ok: false, msg: `Escolha ${C.BOSS_TEAM_SIZE} jogadores para enviar.` };
      const now = Date.now(), st = {}, h18 = new Date(); h18.setHours(C.BOSS_RUN.startHour || 0, 0, 0, 0); const start = Math.max(now, h18.getTime()); // v390: a partida só começa às 18h
      team.forEach((u) => { st[u] = this.bossBlank(); });
      s.bossDay = new Date().toDateString(); s.bossSent = team.slice(); // v389: 1 envio por dia
      s.bossRun = { boss: this.bossOf().id, team, start, end: start + B.minutes * 60000, ticks: 0, st, fake: this.bossFake() };
      s.active = s.active.filter((u) => !team.includes(u));
      this.wcTick(); this.bench();
      this.pushLog(`Equipe enviada contra o Boss (${B.minutes} min)`, "sys");
      this.save(); this.emit("roster"); this.emit("resources");
      return { ok: true };
    },
    // simula os lances que já passaram (também depois de o jogo ficar fechado)
    bossTick() {
      const r = this.bossRun(); if (!r) return null;
      const due = Math.min(this.bossTicks(), Math.floor((Math.min(Date.now(), r.end) - r.start) / (C.BOSS_RUN.tickSec * 1000)));
      if (due > r.ticks) {
        const ps = r.team.map((u) => this.player(u)).filter(Boolean);
        for (let t = r.ticks; t < due; t++) ps.forEach((p) => this.bossRoll(r.st[p.uid], p.position, this.bossForce(BL.power(p))));
        r.ticks = due; this.save();
      }
      return r;
    },
    bossDone() { const r = this.bossRun(); return !!r && Date.now() >= r.end; },
    bossFinishNow() { const r = this.bossRun(); if (!r) return; const now = Date.now(); r.start = now - C.BOSS_RUN.minutes * 60000; r.end = now; this.bossTick(); },
    // ranking: nós + treinadores simulados (os simulados avançam junto com o tempo da partida). Sem partida: prévia só com simulados
    bossTable() {
      const r = this.bossTick(), fake = r ? r.fake : (this.bossPreview = this.bossPreview || this.bossFake());
      const frac = r ? Math.min(1, r.ticks / this.bossTicks()) : 1;
      const sc = (st) => Object.fromEntries(Object.entries(st).map(([k, v]) => [k, Math.round(v * frac)]));
      const rows = fake.map((f) => ({ name: f.name, me: false, team: f.team.map((p) => ({ ...p, st: sc(p.st) })) }));
      if (r) rows.push({ name: this.state.name || "Você", me: true, team: r.team.map((u) => { const p = this.player(u); return p ? { uid: u, name: p.name, id: p.charId, ini: p.initials, pos: p.position, power: BL.power(p), st: r.st[u] } : null; }).filter(Boolean) });
      rows.forEach((row) => { row.tot = this.bossBlank(); row.pts = 0; row.power = 0; row.team.forEach((p) => { p.pts = this.bossPoints(p.st, p.pos); row.pts += p.pts; row.power += p.power; for (const k in row.tot) row.tot[k] += p.st[k] || 0; }); });
      return rows;
    },
    bossRank(key) { const v = (x) => (key === "pts" ? x.pts : x.tot[key]); return this.bossTable().sort((a, b) => v(b) - v(a) || (a.me ? -1 : b.me ? 1 : 0)); },
    bossMyChest() {
      if (!this.bossDone()) return null;
      const rows = this.bossRank("pts"), i = rows.findIndex((x) => x.me), me = rows[i];
      if (!me || me.pts < C.BOSS_MIN_POINTS) return { tier: null, pos: i + 1 };
      return { tier: C.BOSS_CHESTS.slice().reverse().find((c) => i + 1 <= c.maxRank).id, pos: i + 1 };
    },
    // resgata: credita o que saiu no baú (Gold, Diamantes, XP dividido pela equipe, jogadores no Nv 1) e libera a equipe
    bossClaim(drops) {
      const s = this.state, r = this.bossRun(); if (!r || !this.bossDone()) return false;
      const team = r.team.map((u) => this.player(u)).filter(Boolean);
      (drops || []).forEach((d) => {
        if (d.k === "gold") s.gold += this.coachGold(d.n);
        else if (d.k === "diamantes") s.diamonds = (s.diamonds || 0) + d.n;
        else if (d.k === "xp" && team.length) this.giveXp(Math.round(d.n / team.length), team);
        else if (d.k === "boneco" && BL.CHAR_BY_ID[d.id]) s.roster.push(BL.makePlayer(d.id, { rarity: d.rarity, level: 1 }));
      });
      s.bossRun = null; this.pushLog("Partida do Boss encerrada: equipe liberada", "sys");
      this.save(); this.emit("roster"); this.emit("resources");
      return true;
    },
    // ---------- v186 · Recompensa diária (ciclo de 30 dias) ----------
    dayKey(t) { const d = new Date(t || Date.now()); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; },
    daily() { const s = this.state; return (s.daily = s.daily || { day: 0, last: null, streak: 0 }); },
    dailyCan() { return this.daily().last !== this.dayKey(); },
    // perdeu um dia (último resgate antes de ontem): a sequência zera, o ciclo continua de onde parou
    dailyStreak() { const d = this.daily(), y = this.dayKey(Date.now() - 864e5); return d.last === this.dayKey() || d.last === y ? d.streak : 0; },
    dailyShown() { const d = this.daily(); return this.dailyCan() && d.day >= C.DAILY_REWARDS.length ? 0 : d.day; }, // dias já resgatados no ciclo exibido
    dailyNextReset() { const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); },
    dailyClaim() {
      if (!this.dailyCan()) return null;
      const s = this.state, d = this.daily(), L = C.DAILY_REWARDS.length;
      const day = (d.day >= L ? 0 : d.day) + 1, rw = C.DAILY_REWARDS[day - 1], out = { day, k: rw.k, n: rw.n };
      if (rw.k === "gold") s.gold += this.coachGold(rw.n);
      else if (rw.k === "diamantes") s.diamonds = (s.diamonds || 0) + rw.n;
      else if (rw.k === "agua" || rw.k === "gatorade") this.cons()[rw.k] += rw.n;
      else if (rw.k === "xp") this.giveXp(rw.n);
      else if (rw.k === "boneco") { const p = BL.makePlayer(U.pick(BL.CHARACTERS.map((c) => c.id)), { rarity: rw.rarity, level: 1 }); s.roster.push(p); out.name = p.name; }
      d.streak = this.dailyStreak() + 1; d.day = day; d.last = this.dayKey();
      this.pushLog(`Recompensa diária: dia ${day} resgatado`, "sys"); this.misEv("daily");
      this.save(); this.emit("roster"); this.emit("resources");
      return out;
    },
    dailyDevSkip() { const d = this.daily(); if (d.last) d.last = this.dayKey(Date.now() - 864e5); this.save(); }, // modo dev: libera o próximo dia sem perder a sequência
    expAway() { const c = this.state && this.state.exped && this.state.exped.cur; return c ? c.uid : null; },
    // nível L da trilha → região, requisitos e recompensas da Rápida
    expLevel(L) {
      const E = C.EXPEDITION, ri = Math.floor((L - 1) / E.perRegion), r = E.regions[ri];
      return { L, r, ri, k: (L - 1) % E.perRegion, req: E.lvReq(L), rw: E.lvReward(L) };
    },
    expLevelOpen(L) { return this.dev || L <= this.exp().level; },
    expLevelDone(L) { const x = this.exp(); return L < x.level || (L === x.level && !!x.cleared); },
    // motivo para o jogador não poder ir no nível L ("" = pode)
    expWhy(p, L) {
      const s = this.state, m = this.match, size = this.map.size, q = this.expLevel(L).req;
      if (m && !m.training && m.field && m.field(0).some((e) => e.p === p)) return "Está jogando agora";
      if (this.dev) return "";
      if (s.roster.length - 1 < size) return `O ${size}×${size} precisa de ${size} em casa`;
      if (p.level < q.lv) return `Precisa de Nv ${q.lv}+`;
      if (BL.power(p) < q.power) return `Poder ${BL.power(p).toLocaleString("pt-BR")} de ${q.power.toLocaleString("pt-BR")}`;
      return "";
    },
    expSend(uid, L, durId) {
      const E = C.EXPEDITION, x = this.exp();
      const d = E.durations.find((v) => v.id === durId), p = this.state.roster.find((v) => v.uid === uid);
      if (x.cur) return { ok: false, msg: "Já tem uma expedição em andamento." };
      if (this.bossAway().includes(uid)) return { ok: false, msg: "Esse jogador está jogando contra o Boss." };
      if (!d || !p || !(L >= 1 && L <= E.maxLevel)) return { ok: false, msg: "Escolha nível, duração e jogador." };
      if (!this.expLevelOpen(L)) return { ok: false, msg: `Conclua o nível ${L - 1} para liberar o ${L}.` };
      const why = this.expWhy(p, L); if (why) return { ok: false, msg: `${p.short}: ${why}.` };
      const now = Date.now(), lv = this.expLevel(L);
      x.cur = { uid, lvl: L, dur: d.id, start: now, end: now + d.min * 60000 };
      const s = this.state;
      s.active = s.active.filter((u) => u !== uid);
      this.wcTick(); this.bench();
      this.pushLog(`${p.name} saiu em expedição: Nv ${L} · ${lv.r.name} (${d.name})`, "sys");
      this.save(); this.emit("roster"); this.emit("resources");
      return { ok: true };
    },
    expCancel() {
      const x = this.exp(); if (!x.cur) return;
      const p = this.player(x.cur.uid); x.cur = null;
      if (p) this.pushLog(`${p.name} voltou da expedição sem recompensas (cancelada)`, "sys");
      this.save(); this.emit("roster"); this.emit("resources");
    },
    // Afinidade (v182): cada região favorece 2 status; média deles (com nature, itens e EV) / 31 → % de afinidade.
    // Multiplica a chance de item e de Água/Gatorade: 15 nos dois status ≈ ×1,0; 31 ≈ ×1,4; teto ×1,6.
    expAff(p, L) {
      const r = this.expLevel(L).r, k = (r && r.aff) || [];
      if (!p || !k.length) return { pct: 0, mult: 1, keys: k };
      const a = Math.min(1.25, k.reduce((s, x) => s + BL.baseStat(p, x), 0) / k.length / 31);
      return { pct: Math.round(a * 100), mult: Math.round((0.6 + 0.8 * a) * 100) / 100, keys: k };
    },
    expDone() { const c = this.exp().cur; return !!c && Date.now() >= c.end; },
    expFinishNow() { const c = this.exp().cur; if (c && this.dev) { c.end = Date.now(); this.save(); } }, // só no modo dev, para testar
    // Resgate: o resultado só é sorteado na volta. Gold e XP garantidos, item e Água/Gatorade por chance.
    expClaim() {
      const s = this.state, E = C.EXPEDITION, x = this.exp(), c = x.cur;
      if (!c || Date.now() < c.end) return null;
      const lv = this.expLevel(c.lvl), d = E.durations.find((v) => v.id === c.dur), p = this.player(c.uid);
      x.cur = null; if (!lv.r || !d) { this.save(); return null; }
      const gold = this.coachGold(lv.rw.gold * d.mult), xp = Math.round(lv.rw.xp * d.mult);
      s.gold += gold;
      if (p) {
        p.xp += xp;
        while (p.level < C.PLAYER_MAX_LEVEL && p.xp >= C.playerXpToNext(p.level)) { p.xp -= C.playerXpToNext(p.level); p.level++; }
      }
      let item = null, cons = null;
      const am = p ? this.expAff(p, c.lvl).mult : 1;
      if (Math.random() < Math.min(0.98, d.item * am)) {
        const rare = { raro: 1, epico: 1, lendario: 1 };
        const rr = U.weighted(Object.entries(BL.ITEM_RARITY_WEIGHT).map(([v, wt]) => ({ v, w: wt * (rare[v] ? lv.r.rare : 1) })));
        const pool = BL.ITEMS.filter((it) => !it.shop && it.rarity === rr); item = U.pick(pool.length ? pool : BL.ITEMS); // v479: camisa básica só na Loja
        s.inventory.push(item.id);
      }
      if (Math.random() < Math.min(0.98, d.cons * am)) { cons = Math.random() < 0.3 ? "gatorade" : "agua"; this.cons()[cons]++; }
      const fichas = {}; { const rg = C.FICHA_DUR[d.id], w = C.FICHA_REGION[Math.min(C.FICHA_REGION.length - 1, Math.floor(lv.ri / 2))], ids = Object.keys(C.FICHAS); // v527: fichas da Expedição
        const raw = (rg ? U.randInt(rg[0], rg[1]) : 0) * (1 + (this.mgrFx().ficha || 0)), n = Math.floor(raw) + (Math.random() < raw % 1 ? 1 : 0); // Expedição (treinador)
        for (let i = 0; i < n; i++) { const f = U.weighted(ids.map((v, j) => ({ v, w: w[j] }))); fichas[f] = (fichas[f] || 0) + 1; this.cons()[f] = (this.cons()[f] || 0) + 1; } }
      x.count++;
      // progresso só no nível atual; barra cheia conclui e libera o próximo (sobra descartada: nunca pula nível)
      let prog = 0, cleared = 0;
      if (c.lvl === x.level && !x.cleared) {
        const need = E.progNeed(x.level); prog = Math.min(d.prog, need - x.prog); x.prog += prog;
        if (x.prog >= need) { cleared = x.level; x.prog = 0; if (x.level < E.maxLevel) x.level++; else x.cleared = true; }
      }
      const res = { uid: c.uid, name: p ? p.name : "Jogador", lvl: c.lvl, region: lv.r.name, dur: d.name, gold, xp, lv: p ? p.level : 0, item: item && item.id, cons, fichas, prog, cleared, expLv: cleared && !x.cleared ? x.level : 0, at: Date.now() };
      x.last = res;
      this.pushLog(`${res.name} voltou da expedição: +${gold} Gold, +${xp} XP${item ? `, ${item.name}` : ""}${cons ? `, ${C.CONSUMABLES[cons].name}` : ""}${Object.entries(fichas).map(([f, n]) => `, ${n}× ${C.SUPPLIES[f].name}`).join("")}`, "steal");
      this.misEv("exp");
      if (cleared) this.pushLog(`Expedição: nível ${cleared} concluído!${res.expLv ? ` Nível ${res.expLv} liberado.` : ""}`, "sys");
      this.save(); this.emit("roster"); this.emit("resources");
      return res;
    },
    // Chamado a cada 5 s pela tela. VIP resgata sozinho e manda o mesmo jogador de novo para o mesmo nível (se ainda puder).
    expTick() {
      const s = this.state; if (!s || !this.expDone()) return null;
      if (!s.vip) return { done: true };
      const c = this.exp().cur, res = this.expClaim();
      if (res && c) this.expSend(c.uid, res.cleared && !this.exp().cleared ? this.exp().level : c.lvl, c.dur); // concluiu o nível: segue para o próximo
      if (res && c && !this.exp().cur) this.expSend(c.uid, c.lvl, c.dur); // sem Nv/Poder para o próximo: repete o mesmo
      return { done: false, auto: res };
    },

    // ---------- baús e itens ----------
    // v267 · todos os baús vão para state.chests (janela Espólios): "padrao" = comum, "azul" = raro; limite por tipo
    blueChests: [],
    addChest(kind) {
      const s = this.state, ch = { id: Math.random().toString(36).slice(2, 9), kind };
      s.chests.push(ch); this.save();
      this.emit("chest", ch);
    },
    dropBlue(id) { this.blueChests = this.blueChests.filter((c) => c.id !== id); },
    stdChestTick() { // a cada 10 s (ui.js): partida de verdade rolando
      const m = this.match;
      if (this.state && m && !this.state.training && !m.paused && m.state !== "ended" && Math.random() < C.CHEST_STD_PER_10S * (1 + (this.mgrFx().chest || 0))) this.addChest("padrao"); // v473: itens do treinador
    },
    openChest(id) {
      const s = this.state;
      let ch = this.blueChests.find((c) => c.id === id);
      if (ch) this.dropBlue(id);
      else { const i = s.chests.findIndex((c) => c.id === id); if (i < 0) return null; ch = s.chests.splice(i, 1)[0]; }
      const kind = C.CHEST_KINDS[ch.kind] ? ch.kind : "azul", K = C.CHEST_KINDS[kind]; // baús de saves antigos abrem como azul
      const gold = this.coachGold(U.randInt(K.gold[0], K.gold[1]));
      const rar = U.weighted(Object.entries(K.weights).map(([v, w]) => ({ v, w })));
      const mg = Math.random() < C.CHEST_MGR_SHARE, drop = mg ? BL.MGR_ITEMS.filter((it) => !it.fx.goldX) : BL.ITEMS.filter((it) => !it.shop), pool = drop.filter((it) => it.rarity === rar); // v527: fatia fixa do treinador; Cofre só do Boss // v479 (Mickey): itens do treinador também caem nos baús; camisa básica não
      const item = U.pick(pool.length ? pool : drop);
      s.gold += gold; s.analyzer.goldGained += gold; s.analyzer.chests++;
      s.inventory.push(item.id); this.misEv("chest");
      const master = kind === "lendario" && Math.random() < C.MASTER_CHEST; if (master) { this.cons()["pr-bluelock"] = (this.cons()["pr-bluelock"] || 0) + 1; this.pushLog(`MASTER CONTRACT! Veio no baú lendário e foi para a Mochila.`, "steal"); } /* v533 (Mickey) */
      const cd = C.CANDY_CHEST[kind], candy = cd && Math.random() < cd.p ? cd.n : 0; if (candy) { this.cons()["tp-nivel"] = (this.cons()["tp-nivel"] || 0) + candy; this.pushLog(`Treino Particular ×${candy} no baú!`, "steal"); } /* v540 */
      const book = C.SKILL_BOOK && Math.random() < (C.SKILL_BOOK.chest[kind] || 0) ? this.skBook(this.skRoll(C.SKILL_BOOK.w)) : null; // v623: livro de habilidade nos baús épico e lendário
      const sub = this.dropSub(kind); // v525: baú épico e lendário podem trazer sub-item raro do Wildcard
      const D = C.CHEST_DRINK[kind], drinks = []; // v522 (Mickey): bebida de baú, sorteada à parte
      if (D && Math.random() < D.p) for (let i = 0; i < D.n; i++) { const d = U.weighted(Object.entries(D.w).map(([v, w]) => ({ v, w }))); this.cons()[d] = (this.cons()[d] || 0) + 1; drinks.push(d); }
      this.pushLog(`Baú aberto: ${item.name}${drinks.map((d) => `, ${C.CONSUMABLES[d].name}`).join("")} e ${gold} Gold`, "steal");
      this.save();
      this.emit("resources");
      return { gold, item, kind, drinks, sub, master, candy, book };
    },
    // v362 (Mickey): abrir todos (kind = só aquela raridade de baú)
    openAllChests(kind) {
      const ids = this.state.chests.filter((c) => !kind || (c.kind || "azul") === kind).map((c) => c.id);
      return ids.map((id) => this.openChest(id)).filter(Boolean);
    },
    equip(invIndex, uid) {
      const s = this.state;
      const p = s.roster.find((x) => x.uid === uid);
      const id = s.inventory[invIndex];
      if (!p || !id) return;
      const it = BL.ITEM_BY_ID[id]; if (!it) return; // item do treinador não vai em jogador
      if (it.ci && !BL.charItemOk(p, it)) return; // v527: item de personagem só no próprio personagem, Épico ou acima
      const old = p.items[it.slot];
      p.items[it.slot] = id;
      s.inventory.splice(invIndex, 1);
      if (old) s.inventory.push(old);
      this.save(); this.emit("resources");
    },
    unequip(uid, slot) {
      const s = this.state, p = s.roster.find((x) => x.uid === uid);
      if (!p || !p.items[slot]) return;
      s.inventory.push(p.items[slot]); p.items[slot] = null;
      this.save(); this.emit("resources");
    },

    // v473 (Mickey) · itens do treinador: C.MGR_SLOTS espaços; os efeitos (fx) somam enquanto equipados
    mgrEq() { const s = this.state; if (!Array.isArray(s.mgrEq)) s.mgrEq = []; while (s.mgrEq.length < C.MGR_SLOTS) s.mgrEq.push(null); return s.mgrEq; },
    mgrFx() {
      const out = {}; if (!this.state) return out;
      this.mgrEq().forEach((id) => { const it = BL.MGR_BY_ID[id]; if (it) Object.entries(it.fx).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; }); });
      return out;
    },
    mgrEquip(id, slot) {
      const s = this.state, eq = this.mgrEq(), i = s.inventory.indexOf(id); if (i < 0 || !BL.MGR_BY_ID[id]) return false;
      if (slot == null || slot < 0 || slot >= eq.length) { slot = eq.indexOf(null); if (slot < 0) slot = 0; }
      s.inventory.splice(i, 1); if (eq[slot]) s.inventory.push(eq[slot]); eq[slot] = id;
      this.save(); this.emit("resources"); return true;
    },
    mgrUnequip(slot) { const s = this.state, eq = this.mgrEq(); if (!eq[slot]) return; s.inventory.push(eq[slot]); eq[slot] = null; this.save(); this.emit("resources"); },
    itemPrice(it) { return it.shop ? C.SHOP_SHIRT_PRICE : (C.ITEM_PRICE || {})[it.rarity] || 0; }, // v479: camisa básica tem preço próprio
    buyItem(id, n = 1) { // v473: equipamentos e itens do treinador na Loja, por Gold (v475: com quantidade)
      const it = BL.anyItem(id), s = this.state; if (!it || !(n >= 1)) return { ok: false };
      const cost = this.itemPrice(it) * n;
      if (s.gold < cost) return { ok: false, msg: `Gold insuficiente: ${it.name} ×${n} custa ${cost}.` };
      s.gold -= cost; s.analyzer.goldSpent = (s.analyzer.goldSpent || 0) + cost; for (let i = 0; i < n; i++) s.inventory.push(id);
      this.save(); this.emit("resources");
      return { ok: true, msg: `${n > 1 ? n + "× " : ""}${it.name} foi para a Mochila` };
    },
    // v475 · Loja: vender (C.SELL_RATE do preço), propostas de roubo e itens de XP
    sellPrice(id) { const it = BL.anyItem(id), q = C.CONSUMABLES[id] || C.SUPPLIES[id]; return q && q.sell ? q.sell : Math.max(1, Math.floor((it ? this.itemPrice(it) : q ? q.cost : 0) * C.SELL_RATE)); }, // v522: bebida de baú vende a preço fixo
    sell(id, n = 1) {
      const s = this.state, it = BL.anyItem(id), c = this.cons(), have = it ? s.inventory.filter((x) => x === id).length : c[id] || 0;
      if (!(n >= 1) || n > have || (!it && !C.CONSUMABLES[id] && !C.SUPPLIES[id])) return { ok: false, msg: "Você não tem essa quantidade." };
      if (C.SUPPLIES[id] && C.SUPPLIES[id].dia) return { ok: false, msg: "Esse item não pode ser vendido." }; // v480
      if (it) for (let i = 0; i < n; i++) s.inventory.splice(s.inventory.indexOf(id), 1); else { c[id] -= n; if (s.stealArm === id && !c[id]) s.stealArm = null; }
      const gold = this.sellPrice(id) * n; s.gold += gold;
      this.save(); this.emit("resources"); this.emit("cons");
      return { ok: true, msg: `Vendido: ${n}× ${(it || C.CONSUMABLES[id] || C.SUPPLIES[id]).name} · +${gold} Gold` };
    },
    // v622 (Mickey, refs "Liga") · LÍDERES: 8 ginásios. Quem domina um ginásio ganha o buff dele até outro treinador vencer o time defensor (IA) numa partida 4×4.
    // Sem servidor: os ginásios ficam em localStorage[C.GYMS.key], iguais para todas as contas do navegador (online depois: só gyRead/gyWrite mudam). No começo cada ginásio tem um líder NPC.
    gyRead() { let m = null; try { m = JSON.parse(localStorage.getItem(C.GYMS.key) || "null"); } catch (e) {} m = m && typeof m === "object" ? m : {}; m.g = m.g || {}; m.hist = m.hist || [];
      C.GYMS.list.forEach((d, i) => { if (!m.g[d.id]) m.g[d.id] = { leader: null, leaderName: d.npc, team: this.gyNpcTeam(i), since: Date.now(), prot: 0, wins: 0 }; m.g[d.id].prot = 0; /* v623: sem proteção */ }); m.cd = m.cd || {}; return m; },
    gyWrite(m) { m.hist = m.hist.slice(0, 300); try { localStorage.setItem(C.GYMS.key, JSON.stringify(m)); } catch (e) {} },
    gyNpcTeam(i) { const d = C.GYMS.list[i], ids = BL.CHARACTERS.filter((c) => C.SPRITES[c.id]).map((c) => c.id).sort(() => Math.random() - 0.5); return C.LINEUP_POS.map((pos, k) => BL.makePlayer(ids[k], { rarity: d.npcRar, level: d.npcLv, position: pos })); },
    gyMine(m) { m = m || this.gyRead(); const me = this.mkMe(); return C.GYMS.list.find((d) => m.g[d.id].leader === me) || null; },
    gyBuff(k) { const d = this.gyMine(); return d && d.buff === k ? d.val : 0; }, // k = "xp" | "gold" | "steal"
    gyCan(id) { const m = this.gyRead(), g = m.g[id], s = this.state, me = this.mkMe(), mine = this.gyMine(m);
      if (!g) return "Ginásio não encontrado.";
      if (g.leader === me) return "Você já é o líder deste ginásio.";
      if (mine) return `Você já lidera ${mine.name}. Abdique primeiro para desafiar outro ginásio.`;
      { const cd = (m.cd || {})[me] || 0; if (cd > Date.now()) return `Você perdeu o último desafio. Pode tentar de novo em ${Math.ceil((cd - Date.now()) / 60000)} min.`; } // v623 (Mickey): espera só para quem perde
      if (s.training) return "Saia do treino e vá para um mapa 4×4 para desafiar.";
      if (this.map.size !== 4) return "Os desafios de ginásio são 4×4: vá para um mapa 4×4.";
      if (this.activePlayers().length < 4) return "Escale 4 jogadores para desafiar.";
      if (this.gymFight) return "Você já está num desafio.";
      return ""; },
    gyStart(id) { const why = this.gyCan(id); if (why) return { ok: false, msg: why }; this.gymFight = { id, at: Date.now() }; clearTimeout(this.nextT); clearTimeout(this.pmT); this.startMatch(); return { ok: true, msg: `Desafio ao ${C.GYMS.list.find((d) => d.id === id).name} começou!` }; },
    gyEnd(r) { // fim da partida de desafio: venceu = vira líder (o time escalado fica defendendo, cópia), com C.GYMS.prot min de proteção
      const f = this.gymFight; this.gymFight = null; const d = C.GYMS.list.find((x) => x.id === f.id), m = this.gyRead(), g = m.g[f.id], me = this.mkMe(), now = Date.now();
      let note;
      if (r.win && g.leader !== me && !this.gyMine(m)) { const old = g.leaderName;
        if (g.leader) m.hist.unshift({ user: g.leader, t: now, text: `${this.mkName()} venceu sua equipe e tomou o ${d.name}` });
        m.g[f.id] = { leader: me, leaderName: this.mkName(), team: this.activePlayers().map((p) => JSON.parse(JSON.stringify(p))), since: now, prot: 0, wins: 0 };
        m.hist.unshift({ user: me, t: now, text: `Você venceu ${old} ${r.score[0]} × ${r.score[1]} e virou líder do ${d.name}` });
        note = `NOVO LÍDER! Você conquistou o ${d.name}: ${this.gyBuffTxt(d)} enquanto for o líder.`;
      } else { if (g.leader && g.leader !== me) { g.wins = (g.wins || 0) + 1; m.hist.unshift({ user: g.leader, t: now, text: `Sua equipe defendeu o ${d.name} contra ${this.mkName()} (${r.score[1]} × ${r.score[0]})` }); }
        m.hist.unshift({ user: me, t: now, text: `${r.win ? "Vitória" : "Derrota"} ${r.score[0]} × ${r.score[1]} contra ${g.leaderName} no ${d.name}${r.win ? " (o ginásio já tinha mudado de dono)" : ""}` });
        if (!r.win) { m.cd = m.cd || {}; m.cd[me] = now + C.GYMS.wait * 60000; } note = r.win ? "Vitória, mas o ginásio mudou de dono durante a partida." : `Derrota no ${d.name}. Você pode desafiar de novo em ${C.GYMS.wait} min.`; }
      this.gyWrite(m);
      const res = { ...r, xp: 0, gold: 0, ev: 0, stolen: null, chance: 0, roll: 0, target: -1, ups: [], note, boss: false, enemy: this.enemy, stage: this.state.progress.stage, gym: d.id };
      this.pushLog(`Desafio ${d.name}: ${r.win ? "Vitória" : "Derrota"} ${r.score[0]} × ${r.score[1]}`, r.win ? "goal" : "goal-against"); this.pushLog(note, r.win ? "steal" : "sys");
      this.save(); this.recEnd(res); this.emit("matchEnd", res); this.emit("gym", res);
      clearTimeout(this.nextT); this.nextT = setTimeout(() => this.startMatch(), 3000);
    },
    gyAbdicate() { const m = this.gyRead(), d = this.gyMine(m); if (!d) return { ok: false, msg: "Você não lidera nenhum ginásio." };
      m.g[d.id] = { leader: null, leaderName: d.npc, team: this.gyNpcTeam(C.GYMS.list.indexOf(d)), since: Date.now(), prot: 0, wins: 0 }; m.hist.unshift({ user: this.mkMe(), t: Date.now(), text: `Você abdicou do ${d.name}` }); this.gyWrite(m); this.emit("resources");
      return { ok: true, msg: `Você deixou o ${d.name}. ${d.npc} voltou a ser o líder.` }; },
    gyBuffTxt(d) { return d.buff === "steal" ? `+${d.val} pt de chance de roubo` : `+${d.val}% de ${d.buff === "xp" ? "XP" : "Gold"} nas partidas`; },
    // v621 (Mickey, refs "Casa de Leilões") · MERCADO entre jogadores: venda com preço fixo e leilão com lances.
    // Sem servidor: o mercado fica em localStorage[C.MARKET.key] e é o mesmo para todas as contas deste navegador (quando o jogo for online, troca só mkRead/mkWrite).
    // Tudo que vai para o mercado sai do save na hora (fica "no balcão"); o que chega (compra, venda, lance coberto, devolução) entra em "A receber" de cada conta.
    mkRead() { let m = null; try { m = JSON.parse(localStorage.getItem(C.MARKET.key) || "null"); } catch (e) {} m = m && typeof m === "object" ? m : {}; m.seq = m.seq || 0; m.list = m.list || []; m.inbox = m.inbox || {}; m.hist = m.hist || []; m.sales = m.sales || []; return m; },
    mkWrite(m) { const cut = Date.now() - C.MARKET.keepDays * 864e5; m.list = m.list.filter((l) => l.status === "open" || (l.closed || 0) > cut); m.hist = m.hist.slice(0, 400); m.sales = m.sales.filter((x) => x.t > Date.now() - 30 * 864e5).slice(-2000); try { localStorage.setItem(C.MARKET.key, JSON.stringify(m)); } catch (e) {} },
    mkMe() { return this.account || "local"; },
    mkName() { return (this.state && this.state.name) || this.mkMe(); },
    mkFee(v, cur) { const f = v * C.MARKET.fee; return cur === "dia" ? Math.max(1, Math.ceil(f)) : Math.floor(f); },
    mkSend(m, user, it) { (m.inbox[user] = m.inbox[user] || []).push({ id: "r" + ++m.seq, t: Date.now(), ...it }); },
    mkLog(m, user, text) { m.hist.unshift({ user, t: Date.now(), text }); },
    mkSettle(m) { // fecha anúncios vencidos: leilão com lance vai para quem deu o maior; sem lance (ou preço fixo vencido) volta para o vendedor
      const now = Date.now(); let n = 0;
      m.list.forEach((l) => { if (l.status !== "open" || now < l.end) return; n++; l.closed = now;
        const top = l.bids && l.bids[l.bids.length - 1];
        if (l.mode === "leilao" && top) { l.status = "sold"; l.buyer = top.user; l.paid = top.amt; l.paidCur = l.cur;
          this.mkSend(m, top.user, { kind: l.kind, data: l.data, item: l.item, qty: l.qty, name: l.name, why: `Você venceu o leilão de ${l.name}` });
          const net = top.amt - this.mkFee(top.amt, l.cur); this.mkSend(m, l.seller, { kind: "cash", cur: l.cur, amt: net, name: l.name, why: `Leilão de ${l.name} vendido para ${top.name}` });
          m.sales.push({ key: l.key, cur: l.cur, amt: Math.round(top.amt / (l.qty || 1)), t: now });
          this.mkLog(m, top.user, `Venceu o leilão de ${l.name} por ${top.amt} ${l.cur === "dia" ? "◆" : "Gold"}`); this.mkLog(m, l.seller, `Leilão de ${l.name} vendido por ${top.amt} ${l.cur === "dia" ? "◆" : "Gold"} (recebe ${net})`);
        } else { l.status = "ended"; this.mkSend(m, l.seller, { kind: l.kind, data: l.data, item: l.item, qty: l.qty, name: l.name, why: `${l.name} voltou: o anúncio terminou sem venda` }); this.mkLog(m, l.seller, `Anúncio de ${l.name} terminou sem venda`); } });
      return n;
    },
    mkSync() { const m = this.mkRead(); if (this.mkSettle(m)) this.mkWrite(m); return m; },
    mkBusy(uid) { const s = this.state; return [s.active, s.bench, s.wildcard && s.wildcard.slots, s.exped && s.exped.cur, s.bossRun].some((x) => x && JSON.stringify(x).includes(`"${uid}"`)); },
    mkGoods() { // o que dá para anunciar: jogadores fora de uso e itens da Mochila (os que a Loja deixa vender)
      const s = this.state, c = this.cons(), inv = {}; s.inventory.forEach((id) => { inv[id] = (inv[id] || 0) + 1; });
      const items = [];
      Object.entries(inv).forEach(([id, n]) => { const it = BL.anyItem(id); if (it) items.push({ key: "q:" + id, id, n, name: it.name, rarity: it.rarity }); });
      Object.entries(C.CONSUMABLES).forEach(([id, q]) => { if (c[id] > 0) items.push({ key: "c:" + id, id, n: c[id], name: q.name, rarity: "comum" }); });
      Object.entries(C.SUPPLIES).forEach(([id, q]) => { if (c[id] > 0 && !q.dia && !q.wc) items.push({ key: "s:" + id, id, n: c[id], name: q.name, rarity: q.rarity || "comum" }); });
      return { players: s.roster.map((p) => ({ p, busy: this.mkBusy(p.uid) })), items };
    },
    mkPost(o) { // o = { kind: "player"|"item", ref (uid ou key), qty, mode: "fixo"|"leilao", price, cur: "gold"|"dia", hours }
      const s = this.state, M = C.MARKET, m = this.mkSync(), me = this.mkMe();
      if (m.list.filter((l) => l.seller === me && l.status === "open").length >= M.maxListings) return { ok: false, msg: `Você já tem ${M.maxListings} anúncios ativos.` };
      const price = Math.floor(+o.price || 0), cur = o.cur === "dia" ? "dia" : "gold", hours = M.hours.includes(+o.hours) ? +o.hours : 24;
      if (!(price >= (cur === "dia" ? M.minDia : M.minGold))) return { ok: false, msg: `Preço mínimo: ${cur === "dia" ? M.minDia + " ◆" : M.minGold + " Gold"}.` };
      let data = null, item = null, qty = 1, name, key;
      if (o.kind === "player") { const p = s.roster.find((x) => x.uid === o.ref); if (!p) return { ok: false, msg: "Jogador não encontrado." };
        if (this.mkBusy(p.uid)) return { ok: false, msg: `${p.name} está em uso (time, reservas, Wildcard, Expedição ou Boss).` };
        if (s.roster.length <= 4) return { ok: false, msg: "Você precisa ficar com pelo menos 4 jogadores." };
        s.roster = s.roster.filter((x) => x !== p); (s.teamSets || []).forEach((t, i) => { if (Array.isArray(t)) s.teamSets[i] = t.filter((u) => u !== p.uid); });
        if (Array.isArray(s.bossTeam)) s.bossTeam = s.bossTeam.filter((u) => u !== p.uid); if (s.trainSides) ["a", "b"].forEach((k) => { if (Array.isArray(s.trainSides[k])) s.trainSides[k] = s.trainSides[k].filter((u) => u !== p.uid); });
        data = JSON.parse(JSON.stringify(p)); name = p.name; key = "p:" + p.charId;
      } else { const g = this.mkGoods().items.find((x) => x.key === o.ref); qty = Math.floor(+o.qty || 1); if (!g || !(qty >= 1) || qty > g.n) return { ok: false, msg: "Você não tem essa quantidade." };
        const [k, id] = o.ref.split(":"); if (k === "q") for (let i = 0; i < qty; i++) s.inventory.splice(s.inventory.indexOf(id), 1); else { const c = this.cons(); c[id] -= qty; if (s.stealArm === id && !c[id]) s.stealArm = null; }
        item = o.ref; name = g.name; key = o.ref; }
      const now = Date.now(), l = { id: "L" + ++m.seq, seller: me, sellerName: this.mkName(), kind: o.kind, key, item, data, qty, name, mode: o.mode === "leilao" ? "leilao" : "fixo", price, cur, start: now, end: now + hours * 36e5, end0: now + hours * 36e5, bids: [], status: "open" };
      m.list.push(l); this.mkLog(m, me, `Anunciou ${qty > 1 ? qty + "× " : ""}${name} (${l.mode === "leilao" ? "leilão" : "preço fixo"}, ${price} ${cur === "dia" ? "◆" : "Gold"})`); this.mkWrite(m);
      this.save(); this.emit("resources"); this.emit("cons");
      return { ok: true, msg: `${name} anunciado ${l.mode === "leilao" ? "em leilão" : "à venda"} por ${hours} h.` };
    },
    mkBal(cur) { return cur === "dia" ? this.state.diamonds || 0 : this.state.gold; },
    mkPay(cur, v) { if (cur === "dia") this.state.diamonds = (this.state.diamonds || 0) - v; else this.state.gold -= v; },
    mkBuy(id) {
      const m = this.mkSync(), l = m.list.find((x) => x.id === id), me = this.mkMe();
      if (!l || l.status !== "open" || l.mode !== "fixo") return { ok: false, msg: "Esse anúncio não está mais disponível." };
      if (l.seller === me) return { ok: false, msg: "Esse anúncio é seu." };
      if (this.mkBal(l.cur) < l.price) return { ok: false, msg: "Saldo insuficiente." };
      this.mkPay(l.cur, l.price); l.status = "sold"; l.buyer = me; l.paid = l.price; l.closed = Date.now();
      this.mkSend(m, me, { kind: l.kind, data: l.data, item: l.item, qty: l.qty, name: l.name, why: `Você comprou ${l.name}` });
      const net = l.price - this.mkFee(l.price, l.cur); this.mkSend(m, l.seller, { kind: "cash", cur: l.cur, amt: net, name: l.name, why: `${l.name} vendido para ${this.mkName()}` });
      m.sales.push({ key: l.key, cur: l.cur, amt: Math.round(l.price / (l.qty || 1)), t: Date.now() });
      this.mkLog(m, me, `Comprou ${l.name} por ${l.price} ${l.cur === "dia" ? "◆" : "Gold"}`); this.mkLog(m, l.seller, `Vendeu ${l.name} por ${l.price} ${l.cur === "dia" ? "◆" : "Gold"} (recebe ${net})`);
      this.mkWrite(m); this.mkClaim(); this.save(); this.emit("resources");
      return { ok: true, msg: `Você comprou ${l.name}! Já está com você.` };
    },
    mkMinBid(l) { const top = l.bids && l.bids[l.bids.length - 1]; return top ? top.amt + Math.max(1, Math.ceil(top.amt * C.MARKET.bidStep)) : l.price; },
    mkLocked(l, user) { let v = 0; (l.bids || []).forEach((b) => { if (b.user === user) v = b.amt; }); const top = l.bids[l.bids.length - 1]; return top && top.user === user ? v : 0; },
    mkBid(id, amt) {
      const m = this.mkSync(), l = m.list.find((x) => x.id === id), me = this.mkMe(), M = C.MARKET; amt = Math.floor(+amt || 0);
      if (!l || l.status !== "open" || l.mode !== "leilao") return { ok: false, msg: "Esse leilão já terminou." };
      if (l.seller === me) return { ok: false, msg: "Esse leilão é seu." };
      const min = this.mkMinBid(l), top = l.bids[l.bids.length - 1];
      if (amt < min) return { ok: false, msg: `Lance mínimo agora: ${min}.` };
      const mine = top && top.user === me ? top.amt : 0, pay = amt - mine;
      if (this.mkBal(l.cur) < pay) return { ok: false, msg: "Saldo insuficiente para esse lance." };
      this.mkPay(l.cur, pay);
      if (top && top.user !== me) { this.mkSend(m, top.user, { kind: "cash", cur: l.cur, amt: top.amt, name: l.name, why: `Seu lance em ${l.name} foi coberto: o valor voltou` }); this.mkLog(m, top.user, `Lance coberto em ${l.name}`); }
      l.bids.push({ user: me, name: this.mkName(), amt, t: Date.now() });
      if (l.end - Date.now() < M.snipe * 1000) l.end = Math.min(l.end0 + M.snipeMax * 60000, Date.now() + M.snipe * 1000); // lance no fim prorroga
      this.mkLog(m, me, `Deu lance de ${amt} ${l.cur === "dia" ? "◆" : "Gold"} em ${l.name}`); this.mkWrite(m); this.save(); this.emit("resources");
      return { ok: true, msg: `Lance de ${amt} ${l.cur === "dia" ? "◆" : "Gold"} em ${l.name}. ${mine ? `Você pagou só a diferença (${pay}).` : "O valor fica travado até o fim."}` };
    },
    mkCancel(id) {
      const m = this.mkSync(), l = m.list.find((x) => x.id === id), me = this.mkMe();
      if (!l || l.status !== "open" || l.seller !== me) return { ok: false, msg: "Não dá para cancelar esse anúncio." };
      if (l.bids && l.bids.length) return { ok: false, msg: "O leilão já tem lances: não dá para cancelar." };
      l.status = "cancelled"; l.closed = Date.now(); this.mkSend(m, me, { kind: l.kind, data: l.data, item: l.item, qty: l.qty, name: l.name, why: `Anúncio de ${l.name} cancelado` }); this.mkLog(m, me, `Cancelou o anúncio de ${l.name}`);
      this.mkWrite(m); this.mkClaim(); return { ok: true, msg: `${l.name} voltou para você.` };
    },
    mkInbox() { const m = this.mkSync(); return m.inbox[this.mkMe()] || []; },
    mkClaim(only) { // entrega o que está em "A receber" (tudo, ou só o id pedido)
      const m = this.mkRead(), me = this.mkMe(), box = m.inbox[me] || [], s = this.state, c = this.cons(); let n = 0;
      m.inbox[me] = box.filter((r) => { if (only && r.id !== only) return true; n++;
        if (r.kind === "cash") { if (r.cur === "dia") s.diamonds = (s.diamonds || 0) + r.amt; else s.gold += r.amt; }
        else if (r.kind === "player" && r.data) { const p = JSON.parse(JSON.stringify(r.data)); if (s.roster.some((x) => x.uid === p.uid)) p.uid = "mk" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); s.roster.push(p); }
        else if (r.item) { const [k, id] = r.item.split(":"); if (k === "q") for (let i = 0; i < (r.qty || 1); i++) s.inventory.push(id); else c[id] = (c[id] || 0) + (r.qty || 1); }
        return false; });
      if (n) { this.mkWrite(m); this.save(); this.emit("resources"); this.emit("cons"); }
      return n;
    },
    mkPriceRef(key, cur) { const m = this.mkRead(), now = Date.now(), xs = m.sales.filter((x) => x.key === key && x.cur === cur), w = xs.filter((x) => x.t > now - 7 * 864e5).map((x) => x.amt).sort((a, b) => a - b);
      const low = m.list.filter((l) => l.status === "open" && l.key === key && l.cur === cur && l.mode === "fixo").map((l) => Math.round(l.price / (l.qty || 1))).sort((a, b) => a - b)[0];
      return { med: w.length ? w[Math.floor(w.length / 2)] : null, last: xs.length ? xs[xs.length - 1].amt : null, low: low ?? null }; },
    // v502 · Loja de Diamantes: boosts por tempo real, oferta do dia, VIP por dias, histórico
    boostLeft(k) { const b = (this.state.boosts || {})[k] || 0; return Math.max(0, b - Date.now()); },
    diaProd(id) { const p = C.DIA_PRODUCTS.find((x) => x.id === id); if (!p) return null; const q = p.sup ? C.SUPPLIES[p.sup] : p.item ? BL.anyItem(p.item) : null;
      return { ...p, name: p.name || (q && q.name), desc: p.desc || (q && (q.fx ? `Item do treinador: ${Object.entries(q.fx).map(([k, v]) => BL.mgrFxTxt(k, v)).join(", ")}.` : q.desc)), lore: q && q.fx ? q.desc : q && q.lore, dia: p.dia || (q && q.dia) || 0, rarity: q && q.rarity }; },
    diaOffer() { const L = C.DIA_PRODUCTS.filter((p) => p.boost && p.h === 3), k = this.dayKey(); let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return L[h % L.length].id; },
    diaOfferOpen() { return this.state.diaOfferDay !== this.dayKey(); },
    diaPrice(id) { const p = this.diaProd(id); if (!p) return 0; return id === this.diaOffer() && this.diaOfferOpen() ? Math.max(1, Math.round(p.dia * (1 - C.DIA_OFFER_OFF))) : p.dia; },
    buyDia(id) {
      const s = this.state, p = this.diaProd(id); if (!p) return { ok: false };
      if (p.soon) return { ok: false, msg: `${p.name} chega em breve.` }; // v513
      const cost = this.diaPrice(id);
      if (p.perm && s[p.perm]) return { ok: false, msg: `Você já tem ${p.name}.` };
      if ((s.diamonds || 0) < cost) return { ok: false, msg: `Diamantes insuficientes: ${p.name} custa ${cost} ◆.` };
      if (cost < p.dia) s.diaOfferDay = this.dayKey();
      s.diamonds -= cost;
      if (p.boost) { s.boosts = s.boosts || {}; s.boosts[p.boost] = Math.max(Date.now(), s.boosts[p.boost] || 0) + p.h * 3600e3; }
      else if (p.sup) { const c = this.cons(); c[p.sup] = (c[p.sup] || 0) + 1; }
      else if (p.item) s.inventory.push(p.item);
      else if (p.perm) s[p.perm] = true; // v509
      else if (p.vip) { s.vipUntil = Math.max(Date.now(), s.vipUntil || 0) + p.vip * 864e5; s.vip = true; }
      s.diaLog = [{ id, name: p.name, n: cost, t: Date.now() }].concat(s.diaLog || []).slice(0, 20);
      this.save(); this.emit("resources"); this.emit("cons");
      return { ok: true, msg: `${p.name} comprado${p.boost || p.perm ? ": já está ativo" : p.vip ? ": VIP ativo" : ", foi para a Mochila"}` };
    },
    vipTick() { const s = this.state; if (s && s.vipUntil && Date.now() > s.vipUntil) { s.vip = false; s.vipUntil = 0; this.save(); this.emit("resources"); } },
    // v526 (Mickey): 1 só espaço de roubo (Proposta ou contrato), igual Pokébola; fica equipado até acabar
    stealArmed() { const s = this.state, id = s.stealArm; return id && C.SUPPLIES[id] && C.SUPPLIES[id].cat === "roubo" && this.cons()[id] > 0 ? id : null; },
    armSteal(id) { const s = this.state; s.stealArm = s.stealArm === id ? null : id; s.ctArm = null; this.save(); this.emit("resources"); return s.stealArm; },
    stealOut(id) { const s = this.state; s.stealArm = null; this.pushLog(`${C.SUPPLIES[id].name} acabou. Equipe outra Proposta ou contrato na Mochila para continuar roubando.`, "sys"); },
    stealGift() { // v526: presente único + junta o antigo espaço de contrato (v525) no espaço único
      const s = this.state, c = this.cons(), g = C.STEAL_GIFT;
      if (s.ctArm) { if (!this.stealArmed()) s.stealArm = s.ctArm; s.ctArm = null; }
      if (!s.stealGift && g) { s.stealGift = 1; c[g.id] = (c[g.id] || 0) + g.n; if (!this.stealArmed()) s.stealArm = g.id; }
    },
    // v525 (Mickey): bônus do contrato da Bancada no roubo. x = contexto da vitória ({ en, r, m, boss })
    contractBonus(id, x) {
      const q = C.SUPPLIES[id], en = x.en, r = x.r, m = x.m || {}, s = this.state; let add = q.steal || 0, mult = 1;
      const pos = en.position, lv = en.level || 1, ct = q.ct || "";
      if (ct === "base") add += lv < 20 ? 12 : lv <= 40 ? 8 : lv <= 60 ? 4 : 0;
      else if (ct === "atk") add += pos === "atacante" || pos === "alaof" ? 8 : 0;
      else if (ct === "def") add += pos === "zagueiro" || pos === "aladef" ? 8 : 0;
      else if (ct === "rev") add += s.roster.some((p) => p.charId === en.charId) || (s.beatenBy || []).includes(en.charId) ? 10 : 0;
      else if (ct === "night") { const h = new Date().getHours(); add += h >= 18 || h < 6 ? 8 : 0; }
      else if (ct.startsWith("top:")) { const k = ct.slice(4), v = BL.baseStat(en, k); add += C.STATS.every((o) => BL.baseStat(en, o) <= v) ? 10 : 0; }
      else if (ct === "scout") add += (m.goalLog || []).some((g) => g.team === 1 && g.p && (g.p === en || g.p.uid === en.uid)) ? 10 : 0;
      else if (ct === "partner") { const n = {}; (m.goalLog || []).forEach((g) => { if (g.team === 0 && g.p) n[g.p.position] = (n[g.p.position] || 0) + 1; }); const top = Object.keys(n).sort((a, b) => n[b] - n[a])[0]; add += top && top === pos ? 10 : 0; }
      else if (ct === "time") add += Math.min(12, 2 * Math.floor((m.time || 0) / (C.GAME_PACE || 1) / 60));
      else if (ct === "flash") add += m.half === 1 ? 15 : 0;
      else if (ct === "level") { const my = this.activePlayers(), avg = my.length ? my.reduce((a, p) => a + p.level, 0) / my.length : 0; add += Math.min(16, 4 * Math.max(0, Math.floor((avg - lv) / 25))); }
      else if (ct === "boss") add += x.boss ? 10 : 0;
      else if (ct === "clean") add += r.score[1] === 0 ? 10 : 0;
      else if (ct === "comeback") add += m.behind0 ? 12 : 0;
      else if (ct === "star") add += en.rarity === "epico" || en.rarity === "lendario" ? 12 : 0;
      else if (ct === "rout") add += r.score[0] - r.score[1] >= 3 ? 15 : 0;
      else if (ct === "ego") mult = en.boss ? 1.5 : 0.5;
      else if (ct === "shiny") mult = en.shiny ? 2 : 1;
      return { add, mult };
    },
    useXpItem(id, uid) {
      const q = C.SUPPLIES[id], p = this.player(uid), c = this.cons();
      if (!q || !q.xp || !p || !(c[id] > 0)) return { ok: false, msg: "Sem esse item." };
      c[id]--; const ups = this.giveXp(q.xp, [p], true);
      this.save(); this.emit("roster"); this.emit("resources");
      return { ok: true, msg: `${q.name}: +${q.xp.toLocaleString("pt-BR")} XP para ${p.short || p.name}${ups.length ? ` · ${ups[ups.length - 1]}` : ""}` };
    },
    // v527 (Mickey): Treino Particular = +1 nível na hora, sem gastar XP
    useLevelItem(id, uid) {
      const q = C.SUPPLIES[id], p = this.player(uid), c = this.cons();
      if (!q || q.cat !== "nivel" || !p || !(c[id] > 0)) return { ok: false, msg: "Sem esse item." };
      if (p.level >= C.PLAYER_MAX_LEVEL) return { ok: false, msg: `${p.short || p.name} já está no nível máximo.` };
      c[id]--; p.level++; p.xp = Math.min(p.xp, C.playerXpToNext(p.level) - 1);
      this.save(); this.emit("roster"); this.emit("resources");
      return { ok: true, msg: `${q.name}: ${p.short || p.name} subiu para o Nv ${p.level}` };
    },
    // v527 (Mickey): fichas da Expedição → 1 equipamento aleatório da raridade (às vezes item de personagem)
    fichaTrade(id) {
      const F = C.FICHAS[id], c = this.cons(); if (!F) return { ok: false, msg: "Ficha inválida." };
      if ((c[id] || 0) < F.n) return { ok: false, msg: `Precisa de ${F.n} fichas.` };
      c[id] -= F.n;
      const ci = F.ci && Math.random() < F.ci, pool = BL.ITEMS.filter((it) => !it.shop && it.rarity === F.rarity), it = ci ? U.pick(BL.CHAR_ITEM_LIST) : U.pick(pool);
      this.state.inventory.push(it.id); this.misEv("forja"); this.pushLog(`Troca de fichas: ${it.name}${ci ? " (item de personagem!)" : ""}`, ci ? "steal" : "sys");
      this.save(); this.emit("resources");
      return { ok: true, item: it, msg: `${it.name} foi para a Mochila${ci ? " · item de personagem!" : ""}` };
    },

    // ---------- v534 (Mickey): missões com historinha (C.MISSIONS, uma de cada vez) ----------
    mis() { const s = this.state; if (s.mis && s.mis.v === 2) { s.mis.i = Math.floor(s.mis.i / 5) * 10 + (s.mis.i % 5) * 2; s.mis.v = 3; } /* v538: 10 por capítulo, as antigas ficam nas posições pares */ if (!s.mis || s.mis.v !== 3) s.mis = { i: 0, c: {}, note: 0, v: 3 }; return s.mis; }, // v537: 20 capítulos (saves da v534 recomeçam do capítulo 1)
    misLast(i = this.mis().i) { const a = C.MISSIONS[i], b = C.MISSIONS[i + 1]; return !!a && (!b || b.ch !== a.ch); }, // última missão do capítulo
    misCur() { return C.MISSIONS[this.mis().i] || null; },
    misProg() { const q = this.misCur(), s = this.state; if (!q) return 0;
      if (q.k === "roster") return s.roster.length;
      if (q.k === "lvl") return Math.max(0, ...s.roster.map((p) => p.level));
      if (q.k === "mapas") return C.MAPS.filter((m, i) => this.mapEverCleared(i)).length; /* v537: mapas diferentes */
      return this.mis().c[q.k] || 0; },
    misReady() { const q = this.misCur(); return !!q && this.misProg() >= q.n; },
    misOk(q, c) { if (!c) return true; return q.k === "stage" ? c.map === q.m && c.st === q.st : q.k === "tac" ? c.sz === q.sz && c.t === q.t : q.k === "mode" ? c.sz === q.sz : q.k === "margin" ? c.gd >= q.d : q.k === "hat" ? c.g >= q.d : q.k === "dif" ? c.d >= q.d : true; }, // v538: missões de partida
    misEv(k, n = 1, ctx) { if (!this.state || !n) return; const m = this.mis(), q = this.misCur(); if (!q) return;
      if (q.k === k && this.misOk(q, ctx)) m.c[k] = (m.c[k] || 0) + n;
      if (!m.note && this.misReady()) { m.note = 1; this.pushLog(`Missão concluída: ${q.goal}. Resgate o prêmio em Missões.`, "steal"); } },
    misClaim() { const q = this.misCur(); if (!q || !this.misReady()) return { ok: false, msg: "Missão ainda não concluída." };
      const s = this.state, m = this.mis(), last = this.misLast(), CH = C.CHAPTERS[q.ch];
      q.rw.concat(last ? CH.rw : []).forEach((r) => { /* v537: prêmio do capítulo junto com a última missão */ if (r.k === "gold") s.gold += r.n; else if (r.k === "dia") s.diamonds = (s.diamonds || 0) + r.n; else if (r.k === "xp") this.giveXp(r.n);
        else if (r.k === "chest") { for (let i = 0; i < r.n; i++) this.addChest(r.id); } else if (r.k === "chestR") this.addChest(Math.random() < (r.p || 0) ? "lendario" : "epico"); /* v539 */ else if (r.k === "sub") { const b = this.farm().bag; b[r.id] = (b[r.id] || 0) + r.n; }
        else { const c = this.cons(); c[r.id] = (c[r.id] || 0) + r.n; } });
      m.i++; m.c = {}; m.note = 0;
      this.pushLog(`Missão resgatada: ${q.goal}`, "steal"); if (last) this.pushLog(`Capítulo ${q.ch + 1} concluído: ${CH.title}!`, "steal"); if (!this.misCur()) this.pushLog("Todos os capítulos concluídos! O Master Contract foi para a Mochila.", "steal");
      this.misEv("_"); this.save(); this.emit("roster"); this.emit("resources"); return { ok: true, q, last, ch: CH }; },

    // ---------- escalação ----------
    // Vagas: no treino até 4; nas partidas, o tamanho do modo (1×1 = 1 vaga, 2×2 = 2...)
    lineupLimit() { return this.state.training ? C.TRAINING_MAX : this.map.size; },
    lineup() { return this.activePlayers().filter((p) => !p.temp).map((p) => p.uid); },
    // v455 (Mickey) · posições com a bola e sem a bola do meu time (frações do campo, atacando para a direita; vaga 0 Fixo, 1 Ala Def, 2 Ala Of, 3 Pivô)
    posShape(k) { const s = this.state.posShapes && this.state.posShapes[k]; return s && s.length === 4 ? s : C.POS_SHAPES[k].map((q) => q.slice()); },
    setPosShape(k, i, x, y) { const s = this.state; s.posShapes = s.posShapes || {}; const sh = this.posShape(k); sh[i] = [+x.toFixed(3), +y.toFixed(3)]; s.posShapes[k] = sh; if (k === "sem") s.markPreset = null; this.save(); if (this.match && this.match.myShapes && this.match.myShapes[0]) this.match.myShapes[0][k] = sh; },
    tactic4() { const id = (this.state.tactics || {})[4]; return C.TACTICS[4].find((t) => t.id === id) || C.TACTICS[4][0]; }, // v458: formação do 4×4 (vale fora do mapa 4×4 também)
    setMarkPreset(id) { const tac = C.TACTICS[4].find((t) => t.mark === id); if (!tac) return; const s = this.state; s.tactics = s.tactics || {}; s.tactics[4] = tac.id; this.save(); this.emit("resources"); }, // v458: escolher a marcação é escolher a formação
    resetPosShape(k) { const s = this.state; if (s.posShapes) delete s.posShapes[k]; this.save(); if (this.match && this.match.myShapes && this.match.myShapes[0]) this.match.myShapes[0][k] = this.posShape(k); },
    moveSlot(i, j) { // v434: troca dois jogadores de vaga (posição) no Meu time
      const l = this.lineup(); if (i === j || !l[i] || !l[j]) return;
      [l[i], l[j]] = [l[j], l[i]]; this.applyLineup(l);
    },
    applyLineup(list, msg) {
      const s = this.state;
      // guarda a escalação e mantém depois dela quem já estava escalado (para o treino de até 4)
      s.active = [...list, ...s.active.filter((u) => !list.includes(u))].slice(0, C.TRAINING_MAX);
      this.syncTeamSet(); this.save(); this.emit("resources");
      if (msg) this.pushLog(msg, "sys");
      if (s.training) { clearTimeout(this.nextT); this.startMatch(); } // no treino a troca aparece na hora
    },
    // Escalar: entra se houver vaga; se estiver cheio, devolve needSwap para a tela perguntar quem sai
    addToLineup(uid) {
      const cur = this.lineup(), name = this.state.roster.find((p) => p.uid === uid).name;
      if (uid === this.expAway()) return { ok: false, msg: `${name} está em expedição.` };
      if (this.isAway(uid)) return { ok: false, msg: `${name} está jogando contra o Boss.` };
      if (cur.includes(uid)) return { ok: true };
      if (cur.length >= this.lineupLimit()) return { needSwap: true };
      this.applyLineup([...cur, uid], `${name} entrou no time`);
      return { ok: true };
    },
    swapLineup(inUid, outUid) {
      const cur = this.lineup(), i = cur.indexOf(outUid);
      if (i < 0 || this.isAway(inUid)) return;
      const r = this.state.roster, a = r.find((p) => p.uid === inUid).name, b = r.find((p) => p.uid === outUid).name;
      cur[i] = inUid;
      this.applyLineup(cur, `${a} entrou no lugar de ${b}`);
    },
    removeFromLineup(uid) {
      const cur = this.lineup().filter((u) => u !== uid);
      if (!cur.length) return;
      const s = this.state;
      s.active = cur; this.syncTeamSet(); this.save(); this.emit("resources");
      if (s.training) { clearTimeout(this.nextT); this.startMatch(); }
    },
    // v276 · Meu time: até 3 times salvos (escalações). O time escolhido é a escalação atual e salva sozinho a cada troca
    teamSets() {
      const s = this.state;
      if (!Array.isArray(s.teamSets) || s.teamSets.length !== C.TEAM_SETS) s.teamSets = Array.from({ length: C.TEAM_SETS }, (_, i) => (s.teamSets && s.teamSets[i]) || (i === 0 ? s.active.slice() : []));
      if (!(s.teamSel >= 0 && s.teamSel < C.TEAM_SETS)) s.teamSel = 0;
      return s.teamSets;
    },
    syncTeamSet() { const sets = this.teamSets(); sets[this.state.teamSel] = this.state.active.slice(); },
    useTeamSet(i) {
      const s = this.state, sets = this.teamSets();
      if (!(i >= 0 && i < C.TEAM_SETS) || i === s.teamSel) return false;
      this.syncTeamSet(); s.teamSel = i;
      const list = sets[i].filter((u) => s.roster.some((p) => p.uid === u) && !this.isAway(u)).slice(0, C.TRAINING_MAX);
      if (list.length) s.active = list; else sets[i] = s.active.slice(); // time vazio começa como cópia do atual
      this.save(); this.emit("resources");
      this.pushLog(`Time ${i + 1} escolhido`, "sys");
      if (s.training) { clearTimeout(this.nextT); this.startMatch(); }
      return true;
    },
    resetAnalyzer() { this.state.analyzer = this.freshAnalyzer(); this.save(); },
  };

  BL.Game = G;
})();
