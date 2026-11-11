// BL PROJECT IDLE · geração de jogadores, raridade, nature e status efetivos
window.BL = window.BL || {};

(function () {
  const C = BL.CONFIG;
  const S = C.STATS;

  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const weighted = (entries) => {
    const total = entries.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total;
    for (const e of entries) { if ((r -= e.w) <= 0) return e.v; }
    return entries[entries.length - 1].v;
  };
  BL.util = { rand, randInt, pick, weighted, clamp: (v, a, b) => Math.max(a, Math.min(b, v)) };

  const RAR = C.RARITIES;
  BL.rarity = (id) => RAR.find((r) => r.id === id) || RAR[0];

  // Faixa de pontos de cada raridade (fecha as lacunas: começa logo após o teto da anterior)
  BL.rarityPointRange = (id) => {
    const i = RAR.findIndex((r) => r.id === id);
    const hi = Math.floor((RAR[i].to / 100) * C.STAT_TOTAL_MAX);
    const lo = i === 0 ? C.COMMON_MIN_POINTS : Math.floor((RAR[i - 1].to / 100) * C.STAT_TOTAL_MAX) + 1;
    return [lo, hi];
  };
  BL.rarityFromTotal = (total) => {
    const pct = (total / C.STAT_TOTAL_MAX) * 100;
    return (RAR.find((r) => pct <= r.to) || RAR[RAR.length - 1]).id;
  };
  BL.rollRarity = (lv) => { const t = lv ? Math.min(1, Math.max(0, (lv - 1) / (C.PLAYER_MAX_LEVEL - 1))) : 0, T = C.RARITY_W_TOP || {}; return weighted(RAR.map((r) => ({ v: r.id, w: r.weight + ((T[r.id] != null ? T[r.id] : r.weight) - r.weight) * t }))); }; // v535: nível alto puxa raridade melhor

  // Distribui "total" pontos em 6 status (1..31) de forma aleatória
  BL.rollStats = (total) => {
    const st = Object.fromEntries(S.map((k) => [k, 1]));
    let left = total - S.length;
    let guard = 0;
    while (left > 0 && guard++ < 5000) {
      const k = pick(S);
      if (st[k] >= C.STAT_MAX) continue;
      const add = Math.min(left, randInt(1, 4), C.STAT_MAX - st[k]);
      st[k] += add; left -= add;
    }
    return st;
  };

  // ---------- Natures ----------
  BL.NATURES = [];
  C.NATURE_GRID.forEach((row, i) => row.forEach((name, j) => BL.NATURES.push({ name, up: i === j ? null : S[i], down: i === j ? null : S[j] })));
  BL.NATURE_BY_NAME = Object.fromEntries(BL.NATURES.map((n) => [n.name, n]));
  BL.rollNature = () => pick(BL.NATURES).name;

  let uid = 0;
  const newId = () => Date.now().toString(36) + (uid++).toString(36) + Math.random().toString(36).slice(2, 6);

  // ---------- Criação ----------
  BL.makePlayer = (charId, opts = {}) => {
    const ch = BL.CHAR_BY_ID[charId];
    let rarity = opts.rarity || BL.rollRarity();
    let shiny = !!opts.shiny;
    let stats;
    if (opts.stats) stats = { ...opts.stats };
    else if (shiny) {
      rarity = "lendario";
      stats = Object.fromEntries(S.map((k) => [k, C.SHINY_BASE + randInt(0, C.SHINY_EXTRA_MAX)]));
    } else {
      const [lo, hi] = BL.rarityPointRange(rarity);
      // puxa para a parte de cima da faixa (raiz quadrada), para evitar jogadores com quase tudo em 1
      stats = BL.rollStats(Math.round(lo + (hi - lo) * Math.sqrt(Math.random())));
    }
    return {
      uid: newId(), charId, name: ch.name, short: ch.short, initials: ch.initials, position: opts.position || ch.position,
      rarity, shiny, stats, nature: opts.nature || BL.rollNature(),
      level: opts.level || 1, xp: 0, items: { chuteira: null, caneleira: null, camisa: null },
      skills: [], // banco de habilidades vem numa próxima etapa
    };
  };

  // v350: opções do jogador inicial = personagens da função (sem os Boss); vazio → qualquer um
  BL.starterPool = (position) => {
    const bossIds = C.MAPS.map((m) => m.boss && !m.boss.keepPool && m.boss.charId).filter(Boolean); /* v536 */
    const pool = BL.CHARACTERS.filter((c) => c.position === position && !bossIds.includes(c.id));
    return pool.length ? pool : BL.CHARACTERS.slice(); // v339: com poucos personagens liberados, qualquer um joga na posição escolhida
  };
  BL.makeStarter = (position, charId) => {
    const pool = BL.starterPool(position);
    const ch = pool.find((c) => c.id === charId) || pick(pool);
    const stats = Object.fromEntries(S.map((k) => [k, 15]));
    return BL.makePlayer(ch.id, { rarity: "comum", stats, level: 1, position }); // inicial é Comum por regra
  };

  // escort = companheiro do Boss: jogador normal no nível da fase
  BL.makeEnemy = (mapIdx, stage, excludeIds = [], escort = false) => {
    const map = C.MAPS[mapIdx];
    if (stage === C.STAGES_PER_MAP && map.boss && !escort) {
      const b = map.boss;
      const G = BL.Game, mi = G && G.state && G.prologue && G.prologue() && C.PROLOGUE.mini; // v558: Mini Boss do Prólogo (mais fraco)
      const st = mi ? Object.fromEntries(Object.entries(b.stats).map(([k, v]) => [k, Math.max(1, Math.round(v * mi.statMul))])) : b.stats;
      const p = BL.makePlayer(b.charId, { rarity: C.BOSS_AWAKE ? "despertado" : b.rarity, stats: st, nature: b.nature, level: mi ? mi.level : b.level }); // v552 (Mickey): Boss sempre Despertado
      p.boss = true; p.title = mi ? mi.title : b.title; if (mi) p.mini = true;
      BL.enemySkills(p, map.size, true); return p;
    }
    const span = (map.levelMax - map.levelMin + 1) / C.STAGES_PER_MAP;
    const lvLo = Math.round(map.levelMin + (stage - 1) * span);
    const lvHi = Math.round(map.levelMin + stage * span - 1);
    const bossIds = C.MAPS.map((m) => m.boss && !m.boss.keepPool && m.boss.charId).filter(Boolean); /* v536 */
    let pool = BL.CHARACTERS.filter((c) => !bossIds.includes(c.id) && !excludeIds.includes(c.id));
    const rep = !pool.length; if (rep) pool = BL.CHARACTERS; // v339: poucos personagens liberados: o mesmo pode repetir no time
    const ch = pick(pool);
    const shiny = Math.random() < C.SHINY_CHANCE * (BL.Game && BL.Game.state && BL.Game.boostLeft("shiny") ? C.DIA_BOOST.shiny : 1); // v503: Boost de Caçada Shiny
    const lv = randInt(lvLo, lvHi), G = BL.Game, dl = G && G.state && G.diff ? C.DIFFICULTIES[G.diff()].levels : 0; /* v535: raridade pelo nível final (com a dificuldade) */
    let rar = BL.rollRarity(Math.min(C.PLAYER_MAX_LEVEL, lv + dl)); const EZ = C.EASY_MODES && C.EASY_MODES[map.size], ord = C.RARITIES.map((r) => r.id); // v585 (Mickey): 1×1 tranquilo
    if (EZ && !shiny && ord.indexOf(rar) > ord.indexOf(EZ.maxRarity)) rar = EZ.maxRarity;
    const q = BL.makePlayer(ch.id, { shiny, level: lv, rarity: rar, position: rep ? pick(C.POSITIONS).id : undefined });
    if (EZ && !shiny) for (const k in q.stats) q.stats[k] = Math.max(1, Math.round(q.stats[k] * EZ.statMul));
    if (C.FIRST_WIN && map.size === 1 && !shiny && G && G.state && G.state.analyzer && !G.state.analyzer.wins && !G.dev) for (const k in q.stats) q.stats[k] = Math.max(1, Math.round(q.stats[k] * C.FIRST_WIN.statMul)); // v680
    BL.enemySkills(q, map.size, false); return q;
  };
  // v623 · inimigo com habilidade: chance pelo tamanho do mapa (C.SKILL_ENEMY); o Boss sempre tem uma
  BL.enemySkills = (p, size, boss) => {
    const E = C.SKILL_ENEMY; if (!E || !C.SKILL_DEF || Math.random() >= (boss ? E.boss : E.p[size] || 0)) return;
    const r = weighted(Object.entries(E.w).map(([v, w]) => ({ v, w }))), ids = Object.keys(C.SKILL_DEF).filter((id) => C.SKILL_DEF[id].rar === r);
    p.skills = [{ id: pick(ids.length ? ids : Object.keys(C.SKILL_DEF)), lv: 1 }];
  };

  // ---------- Status efetivos ----------
  BL.statTotal = (p) => S.reduce((s, k) => s + p.stats[k], 0);
  BL.itemBonus = (p, k) => Object.values(p.items || {}).reduce((s, id) => { const it = id && BL.ITEM_BY_ID[id]; return s + ((it && it.bonus[k]) || 0) + (it && it.pos && it.posK === k && it.pos === p.position ? C.ITEM_POS_BONUS : 0); }, 0); // v524: Camisa de Posição
  // Status "IV" com nature e itens (é o que entra no duelo Chute × Save)
  BL.baseStat = (p, k) => {
    const n = BL.NATURE_BY_NAME[p.nature];
    let m = 1;
    if (n?.up === k) m += C.NATURE_MOD;
    if (n?.down === k) m -= C.NATURE_MOD;
    const bf = (k === "defesa" || k === "fisico") && C.ITEM_FX && p.items && p.items.caneleira && C.ITEM_FX[p.items.caneleira], bk = bf && bf.base && p.level < bf.baseLv ? 1 + bf.base : 1; // v524: Caneleira da Base
    return (p.stats[k] + BL.itemBonus(p, k)) * m * bk * (1 + C.EV_POWER * BL.ev(p, k) / C.EV_MAX_STAT);
  };
  BL.ev = (p, k) => (p.ev && p.ev[k]) || 0;
  BL.evTotal = (p) => S.reduce((s, k) => s + BL.ev(p, k), 0);
  BL.levelMult = (lv) => 1 + (lv - 1) * C.LEVEL_POWER;
  // v129 · Poder: a mesma conta para todos = soma dos 6 status em campo (IV + itens, nature, EV, nível) × 10
  BL.power = (p) => Math.round(S.reduce((s, k) => s + BL.baseStat(p, k), 0) * BL.levelMult(p.level) * 10);
  // poder do time titular (até 4 escalados) de um save
  BL.teamPower = (state) => {
    if (!state || !state.roster) return 0;
    const list = (state.active || []).map((u) => state.roster.find((p) => p.uid === u)).filter(Boolean);
    for (const p of state.roster) if (list.length < 4 && !list.includes(p)) list.push(p);
    return list.slice(0, 4).reduce((s, p) => s + BL.power(p), 0);
  };

  BL.goalkeeperFor = (accountLevel) => C.GOALKEEPER_TABLE.find((g) => accountLevel <= g.upTo) || C.GOALKEEPER_TABLE[C.GOALKEEPER_TABLE.length - 1];
  BL.goalChance = (chute, save) => BL.util.clamp(50 + 2 * (chute - save), C.GOAL_MIN, C.GOAL_MAX);

  BL.stealChance = (enemy, stage, goals = 0) => {
    const base = enemy.boss ? C.STEAL_BOSS : C.STEAL_BASE[Math.min(stage, C.STEAL_BASE.length) - 1];
    return Math.max(0, (base + goals * C.STEAL_PER_GOAL) * BL.rarity(enemy.rarity).stealMult * (enemy.goldTeam && C.GOLDEN_TEAM ? C.GOLDEN_TEAM.steal : 1)); // v582: Time Dourado
  };
})();
