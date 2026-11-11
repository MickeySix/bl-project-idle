// BL PROJECT IDLE · v624 (Mickey, refs "Central de Clãs") · GUILDA
// Clãs entre as contas do navegador (localStorage[C.CLANS.key]; online depois, só read/write mudam), missões diárias, bônus por nível,
// mural, Raide semanal (boss em partida 4×4, dano em barras), Guerra semanal contra um clã rival NPC, Loja do clã (Fragmentos) e Descobrir.
// Partidas: G.clanFight (game.js troca os inimigos por BL.Clan.fightTeam() e chama BL.Clan.fightEnd no fim). Bônus: somados em G.gyBuff.
window.BL = window.BL || {};
(function () {
  const C = BL.CONFIG, G = BL.Game, K = () => C.CLANS, DAY = 864e5;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => Math.round(n || 0).toLocaleString("pt-BR");
  const f1 = (n) => (Math.round((n || 0) * 10) / 10).toLocaleString("pt-BR");
  const spr = (id) => (C.SPRITES[id] ? `<img class="spr" src="${C.SPRITES[id].card}" alt="">` : "");
  const toast = (t, c) => BL.UI && BL.UI.toast(t, c);
  const me = () => G.mkMe(), myName = () => G.mkName();
  const charName = (id) => (BL.CHAR_BY_ID[id] || {}).name || id;
  const itemOf = (id) => (id === "dia" ? { name: "Diamantes", icon: "◆" } : C.SUPPLIES[id] || C.CONSUMABLES[id] || { name: id, icon: "📦" });

  // ---------- tempo ----------
  function weekStart(t) { const d = new Date(t || Date.now()); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
  function weekEnd(t) { const d = new Date(weekStart(t)); d.setDate(d.getDate() + 7); return d.getTime(); }
  function battleAt(t) { const d = new Date(weekStart(t)); d.setDate(d.getDate() + K().war.battleDay); return d.getTime(); }
  function dayEnd() { const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); }
  const wk = (t) => String(weekStart(t));
  function left(ms) { ms = Math.max(0, ms); const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${String(m).padStart(2, "0")}min` : m ? `${m}min ${String(s % 60).padStart(2, "0")}s` : `${s % 60}s`; }
  function rng(seed) { let x = 7; for (const ch of String(seed)) x = (Math.imul(x, 31) + ch.charCodeAt(0)) >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }
  const sprIds = () => BL.CHARACTERS.filter((c) => C.SPRITES[c.id]).map((c) => c.id);

  // ---------- dados ----------
  function read() { let m = null; try { m = JSON.parse(localStorage.getItem(K().key) || "null"); } catch (e) {} m = m && typeof m === "object" ? m : {}; m.c = m.c || {}; m.mem = m.mem || {}; m.mail = m.mail || {}; return m; }
  function write(m) { try { localStorage.setItem(K().key, JSON.stringify(m)); } catch (e) {} }
  const mine = (m) => { const id = m.mem[me()]; return (id && m.c[id] && m.c[id].members[me()]) ? m.c[id] : null; };
  const need = (l) => K().lv.base + K().lv.step * l;
  function lvl(c) { let l = 1, r = c.xp || 0; while (l < K().lv.max && r >= need(l)) { r -= need(l); l++; } return { l, cur: r, need: l >= K().lv.max ? 0 : need(l) }; }
  const power = (c) => Object.values(c.members).reduce((a, x) => a + (x.power || 0), 0);
  const role = (c, acc) => (c.members[acc] || {}).role || "";
  const boss = (c) => role(c, me()) === "lider" || role(c, me()) === "sub";
  function snap() { const s = G.state; const list = (s.active || []).map((u) => s.roster.find((p) => p.uid === u)).filter(Boolean); for (const p of s.roster) if (list.length < 4 && !list.includes(p)) list.push(p);
    return { power: BL.teamPower(s), team: list.slice(0, 4).map((p) => ({ r: p.rarity, lv: p.level })) }; }
  function touch(c) { const x = c.members[me()]; if (!x) return; const sn = snap(); x.name = myName(); x.power = sn.power; x.team = sn.team; x.last = Date.now(); }
  function newMember(name, r) { const sn = snap(); return { name, role: r, joined: Date.now(), power: sn.power, team: sn.team, wins: 0, steals: 0, xp: 0, last: Date.now() }; }
  function mail(m, acc, it) { (m.mail[acc] = m.mail[acc] || []).push({ t: Date.now(), ...it }); }
  function log(c, text) { (c.log = c.log || []).unshift({ t: Date.now(), text }); c.log.length = Math.min(c.log.length, 60); }

  function newRaid(c, tier) { const L = K().raid.bosses.filter((id) => C.SPRITES[id] && BL.CHAR_BY_ID[id]), w = Math.floor(weekStart() / (7 * DAY)), n = Object.keys(c.members).length;
    return { week: wk(), boss: L[w % L.length], tier, hp: Math.round(Math.max(K().raid.hpMin, K().raid.hpPer * n) * (1 + (tier - 1) * K().raid.tierHp)), down: 0, dmg: {}, tries: {}, killed: 0 }; }
  function defOf(x, r) { const ids = sprIds().sort(() => r() - 0.5), team = (x.team && x.team.length ? x.team : [{ r: "comum", lv: 1 }]).slice();
    while (team.length < 4) team.push(team[team.length - 1]);
    return C.LINEUP_POS.map((pos, k) => ({ id: ids[k], r: team[k].r, lv: Math.max(1, Math.min(C.PLAYER_MAX_LEVEL, team[k].lv + Math.floor(r() * 4) - 1)), pos })); }
  const defPlayers = (d) => d.map((q) => BL.makePlayer(q.id, { rarity: q.r, level: q.lv, position: q.pos }));
  function warRow(x, acc, r) { const def = defOf(x, r), dpw = defPlayers(def).reduce((a, p) => a + BL.power(p), 0), pw = x.power || 1;
    const p = Math.max(0.2, Math.min(0.75, 0.45 + ((dpw - pw) / pw) * 1.5)); // chance do rival vencer a sua defesa (calculada na hora do pareamento)
    return { acc, name: x.name, pw: x.power || 0, rival: K().rivalNames[Math.floor(r() * K().rivalNames.length)], def, dpw, tries: 0, won: 0, score: "", lost: r() < p ? 1 : 0 }; }
  function newWar(c) { const r = rng(c.id + wk()), rv = K().rivals[Math.floor(r() * K().rivals.length)];
    const rows = Object.entries(c.members).sort((a, b) => (b[1].power || 0) - (a[1].power || 0)).slice(0, K().war.max).map(([acc, x]) => warRow(x, acc, r));
    return { week: wk(), rival: { name: rv[0], icon: rv[1] }, rows }; }
  function settleWar(m, c) { const w = c.war; if (!w || !w.rows.length) return;
    const us = w.rows.reduce((a, x) => a + x.won, 0), them = w.rows.reduce((a, x) => a + x.lost, 0), res = us > them ? "win" : us < them ? "lose" : "draw", W = K().war;
    (c.wars = c.wars || []).unshift({ week: w.week, rival: w.rival.name, icon: w.rival.icon, us, them, res }); c.wars.length = Math.min(c.wars.length, 12);
    if (res === "win") c.buff = { until: weekEnd(+w.week + 3 * DAY) + 7 * DAY, xp: W.buff.xp, gold: W.buff.gold };
    c.xp = (c.xp || 0) + (res === "win" ? W.xp : res === "draw" ? Math.round((W.xp + W.xpLose) / 2) : W.xpLose);
    const rw = res === "win" ? W.win : W.lose; w.rows.filter((x) => x.tries && c.members[x.acc]).forEach((x) => mail(m, x.acc, { frag: rw.frag, gold: rw.gold, text: `Guerra contra ${w.rival.name}: ${res === "win" ? "vitória" : res === "draw" ? "empate" : "derrota"} ${us} × ${them}` }));
    log(c, `Guerra contra ${w.rival.name}: ${res === "win" ? "Vitória" : res === "draw" ? "Empate" : "Derrota"} ${us} × ${them}`); }
  function settle(m, c) { const day = G.dayKey();
    if (!c.daily || c.daily.day !== day) c.daily = { day, wins: {}, steals: {}, matches: 0, raid: 0, got: {} };
    if (!c.raid || c.raid.week !== wk()) { const old = c.raid; let tier = 1; if (old) { (c.raidHist = c.raidHist || []).unshift({ week: old.week, boss: old.boss, tier: old.tier, down: old.down, hp: old.hp, killed: old.killed }); c.raidHist.length = Math.min(c.raidHist.length, 10); tier = old.killed ? Math.min(K().raid.tierMax, old.tier + 1) : old.tier; } c.raid = newRaid(c, tier); }
    if (!c.war || c.war.week !== wk()) { if (c.war) settleWar(m, c); c.war = newWar(c); }
    else if (Date.now() < battleAt()) Object.entries(c.members).forEach(([acc, x]) => { if (!c.war.rows.some((y) => y.acc === acc) && c.war.rows.length < K().war.max) c.war.rows.push(warRow(x, acc, rng(acc + c.war.week))); });
    return c; }
  function sync() { const m = read(), c = mine(m); if (c) { settle(m, c); touch(c); } if (!c && m.mem[me()]) delete m.mem[me()]; const got = claimMail(m); write(m); return { m, c, got }; }
  function claimMail(m) { const L = m.mail[me()]; if (!L || !L.length) return []; const s = G.state, cons = G.cons();
    L.forEach((x) => { if (x.gold) s.gold += x.gold; if (x.frag) s.clanFrag = (s.clanFrag || 0) + x.frag; if (x.dia) s.diamonds = (s.diamonds || 0) + x.dia; Object.entries(x.items || {}).forEach(([id, n]) => (cons[id] = (cons[id] || 0) + n)); });
    delete m.mail[me()]; G.save(); G.emit("resources"); return L; }
  function buff(k) { let m; try { m = read(); } catch (e) { return 0; } const c = mine(m); if (!c) return 0; const l = lvl(c).l, P = K().perLv;
    let v = k === "xp" ? l * P.xp : k === "gold" ? l * P.gold : k === "steal" ? l * P.steal : 0;
    if (c.buff && c.buff.until > Date.now() && (k === "xp" || k === "gold")) v += c.buff[k] || 0; return v; }
  function bonusParts(c) { const l = lvl(c).l, P = K().perLv, b = c.buff && c.buff.until > Date.now() ? c.buff : null;
    return { xp: [l * P.xp, b ? b.xp : 0], gold: [l * P.gold, b ? b.gold : 0], steal: [Math.round(l * P.steal * 10) / 10, 0], until: b ? b.until : 0 }; }

  // ---------- partidas de membro (missões, XP do clã) ----------
  G.on("matchEnd", (res) => { if (!res || res.clan || res.gym) return; const m = read(), c = mine(m); if (!c) return; settle(m, c); touch(c);
    const d = c.daily, x = c.members[me()], k = me(); d.matches++;
    if (res.win) { d.wins[k] = (d.wins[k] || 0) + 1; x.wins++; c.xp += K().xpWin; x.xp += K().xpWin; }
    if (res.stolen) { d.steals[k] = (d.steals[k] || 0) + 1; x.steals++; c.xp += K().xpSteal; x.xp += K().xpSteal; }
    write(m); });
  const gyB = G.gyBuff; G.gyBuff = function (k) { return gyB.call(this, k) + buff(k); }; // bônus do clã somados aos do ginásio (XP, Gold, roubo)

  function misProg(c, q) { const d = c.daily; return q.id === "win" ? d.wins[me()] || 0 : q.id === "steal" ? d.steals[me()] || 0 : q.id === "match" ? d.matches : q.id === "raid" ? d.raid : 0; }
  const misGot = (c, id) => !!((c.daily.got[me()] || {})[id]);
  function claimMis(id) { const m = read(), c = mine(m); if (!c) return { ok: false, msg: "Você não está num clã." }; settle(m, c); const q = K().missions.find((x) => x.id === id);
    if (!q || misGot(c, id)) return { ok: false, msg: "Missão já resgatada." }; if (misProg(c, q) < q.n) return { ok: false, msg: "A missão ainda não terminou." };
    (c.daily.got[me()] = c.daily.got[me()] || {})[id] = 1; c.xp += q.xp; c.members[me()].xp += q.xp; G.state.gold += q.gold; write(m); G.save(); G.emit("resources");
    return { ok: true, msg: `${q.name}: +${q.xp} XP para o clã e +${fmt(q.gold)} Gold para você.` }; }

  // ---------- Raide e Guerra ----------
  function canFight(kind) { const m = read(), c = mine(m), s = G.state; if (!c) return "Entre num clã primeiro."; settle(m, c);
    if (kind === "raid") { const r = c.raid, t = r.tries[me()] || { day: "", n: 0 };
      if (r.killed) return "O boss desta semana já caiu. Um novo chega na segunda.";
      if (t.day === G.dayKey()) return "Você já atacou hoje. Nova tentativa amanhã.";
      if (t.n >= K().raid.tries) return `Você já usou as ${K().raid.tries} tentativas da semana.`; }
    else { const row = c.war.rows.find((x) => x.acc === me());
      if (Date.now() < battleAt()) return "Os ataques abrem no dia de batalha (quinta-feira).";
      if (!row) return "Você não está na escalação desta guerra.";
      if (row.won) return "Você já venceu a sua batalha nesta guerra.";
      if (row.tries >= K().war.tries) return `Suas ${K().war.tries} tentativas desta guerra acabaram.`; }
    if (s.training) return "Saia do treino e vá para um mapa 4×4.";
    if (!G.map || G.map.size !== 4) return "Raide e Guerra são 4×4: vá para um mapa 4×4.";
    if (G.activePlayers().length < 4) return "Escale 4 jogadores.";
    if (G.gymFight || G.clanFight) return "Você já está num desafio.";
    return ""; }
  function raidTeam(c) { const r = c.raid, mine4 = G.activePlayers(), base = mine4.reduce((a, p) => a + p.level, 0) / Math.max(1, mine4.length);
    const lv = Math.min(C.PLAYER_MAX_LEVEL, Math.round(base * (K().raid.lvK + (r.tier - 1) * K().raid.tierLv) + K().raid.lvAdd)), rr = rng(r.week + r.boss), others = sprIds().filter((id) => id !== r.boss).sort(() => rr() - 0.5);
    return C.LINEUP_POS.map((pos, k) => BL.makePlayer(k === 3 ? r.boss : others[k], { rarity: k === 3 ? "despertado" : "lendario", level: lv, position: pos })); }
  function start(kind) { const why = canFight(kind); if (why) return { ok: false, msg: why }; const m = read(), c = mine(m); settle(m, c);
    const team = kind === "raid" ? raidTeam(c) : defPlayers(c.war.rows.find((x) => x.acc === me()).def);
    const name = kind === "raid" ? `Raide · ${charName(c.raid.boss)}` : `Guerra · ${c.war.rival.name}`;
    G.clanFight = { kind, cid: c.id, name, team }; clearTimeout(G.nextT); clearTimeout(G.pmT); BL.Clan.close(); G.startMatch();
    return { ok: true, msg: kind === "raid" ? `Raide contra ${charName(c.raid.boss)} começou!` : `Batalha da guerra contra ${c.war.rival.name} começou!` }; }
  function fightTeam() { return G.clanFight.team.map((p) => { const q = JSON.parse(JSON.stringify(p)); q.uid = "cl" + q.uid; q.temp = true; return q; }); }
  function fightEnd(r) { const f = G.clanFight; G.clanFight = null; const m = read(), c = m.c[f.cid]; let note = "";
    if (c && c.members[me()]) { settle(m, c); touch(c);
      if (f.kind === "raid") { const R = K().raid, rd = c.raid, sh = (r.shots || [0])[0] || 0;
        const bars = Math.max(0.5, Math.round((r.score[0] * R.goal + sh * R.shot) * (r.win ? R.winK : 1) * 10) / 10);
        const t = rd.tries[me()] || { day: "", n: 0 }; t.day = G.dayKey(); t.n++; rd.tries[me()] = t;
        if (!rd.killed) { rd.dmg[me()] = Math.round(((rd.dmg[me()] || 0) + bars) * 10) / 10; rd.down = Math.round((rd.down + bars) * 10) / 10; c.daily.raid = Math.round((c.daily.raid + bars) * 10) / 10; }
        note = `Raide: ${r.score[0]} gol(s) e ${sh} finalização(ões) = ${f1(bars)} barras de dano no ${charName(rd.boss)}.`;
        if (!rd.killed && rd.down >= rd.hp) { rd.killed = Date.now(); c.xp += R.xp; log(c, `${charName(rd.boss)} derrotado no Raide (tier ${rd.tier})`);
          const el = Object.entries(rd.dmg).filter(([acc, v]) => v > 0 && c.members[acc]), tot = el.reduce((a, x) => a + x[1], 0) || 1, n = el.length;
          el.forEach(([acc, v]) => { const k = R.share + (1 - R.share) * n * (v / tot); mail(m, acc, { frag: Math.round(R.reward.frag * k), gold: Math.round(R.reward.gold * k), items: R.reward.items, text: `Raide: ${charName(rd.boss)} derrotado` }); });
          note += ` O BOSS CAIU! A recompensa foi para quem atacou.`; } }
      else { const row = c.war.rows.find((x) => x.acc === me()); if (row) { row.tries++; if (r.win && !row.won) { row.won = 1; row.score = `${r.score[0]} × ${r.score[1]}`; } }
        note = r.win ? `Guerra: vitória ${r.score[0]} × ${r.score[1]} contra ${row ? row.rival : "o rival"}. +1 ponto para o clã!` : `Guerra: derrota ${r.score[0]} × ${r.score[1]}. ${row ? Math.max(0, K().war.tries - row.tries) : 0} tentativa(s) restante(s).`; }
      write(m); }
    const res = { ...r, xp: 0, gold: 0, ev: 0, stolen: null, chance: 0, roll: 0, target: -1, ups: [], note, boss: false, enemy: G.enemy, stage: G.state.progress.stage, clan: f.kind };
    G.pushLog(`${f.name}: ${r.win ? "Vitória" : "Derrota"} ${r.score[0]} × ${r.score[1]}`, r.win ? "goal" : "goal-against"); if (note) G.pushLog(note, r.win ? "steal" : "sys");
    G.save(); G.recEnd(res); G.emit("matchEnd", res); clearTimeout(G.nextT); G.nextT = setTimeout(() => G.startMatch(), 3000); }

  // ---------- gestão ----------
  function create(name, icon, entry) { const m = read(), s = G.state; name = String(name || "").trim().replace(/\s+/g, " ");
    if (mine(m)) return { ok: false, msg: "Você já está num clã. Saia dele primeiro." };
    if (name.length < K().nameMin || name.length > K().nameMax) return { ok: false, msg: `O nome precisa ter de ${K().nameMin} a ${K().nameMax} letras.` };
    if (Object.values(m.c).some((c) => c.name.toLowerCase() === name.toLowerCase()) || K().rivals.some((r) => r[0].toLowerCase() === name.toLowerCase())) return { ok: false, msg: "Já existe um clã com esse nome." };
    if (s.gold < K().cost) return { ok: false, msg: `Criar um clã custa ${fmt(K().cost)} Gold.` };
    s.gold -= K().cost; const id = "c" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const c = { id, name, icon: C.SPRITES[icon] ? icon : sprIds()[0], entry: entry === "pedido" ? "pedido" : "livre", created: Date.now(), leader: me(), members: { [me()]: newMember(myName(), "lider") }, req: {}, xp: 0,
      mural: { text: "Bem-vindos ao clã! Joguem as missões do dia, ataquem o boss do Raide e lutem na Guerra de quinta a domingo.", by: myName(), t: Date.now() }, wars: [], raidHist: [], log: [] };
    m.c[id] = c; m.mem[me()] = id; Object.values(m.c).forEach((x) => { if (x.req) delete x.req[me()]; }); settle(m, c); log(c, `${myName()} fundou o clã`); write(m); G.save(); G.emit("resources");
    return { ok: true, msg: `Clã ${name} criado! Você é o líder.` }; }
  function join(id) { const m = read(), c = m.c[id]; if (!c) return { ok: false, msg: "Clã não encontrado." }; if (mine(m)) return { ok: false, msg: "Você já está num clã. Saia dele primeiro." };
    if (Object.keys(c.members).length >= K().max) return { ok: false, msg: "Este clã está cheio." };
    if (c.entry === "pedido") { c.req = c.req || {}; c.req[me()] = { name: myName(), power: snap().power, t: Date.now() }; write(m); return { ok: true, msg: `Pedido enviado para ${c.name}. A liderança precisa aceitar.` }; }
    c.members[me()] = newMember(myName(), "membro"); m.mem[me()] = id; Object.values(m.c).forEach((x) => { if (x.req) delete x.req[me()]; }); settle(m, c); log(c, `${myName()} entrou no clã`); write(m);
    return { ok: true, msg: `Você entrou no clã ${c.name}!` }; }
  function cancelReq(id) { const m = read(), c = m.c[id]; if (c && c.req) delete c.req[me()]; write(m); return { ok: true, msg: "Pedido cancelado." }; }
  function answer(acc, yes) { const m = read(), c = mine(m); if (!c || !boss(c)) return { ok: false, msg: "Só a liderança responde pedidos." }; const q = (c.req || {})[acc]; if (!q) return { ok: false, msg: "Pedido não encontrado." };
    delete c.req[acc];
    if (yes) { if (m.mem[acc] && m.c[m.mem[acc]] && m.c[m.mem[acc]].members[acc]) { write(m); return { ok: false, msg: `${q.name} já entrou em outro clã.` }; }
      if (Object.keys(c.members).length >= K().max) { write(m); return { ok: false, msg: "O clã está cheio." }; }
      c.members[acc] = { name: q.name, role: "membro", joined: Date.now(), power: q.power || 0, team: [], wins: 0, steals: 0, xp: 0, last: q.t }; m.mem[acc] = c.id; Object.values(m.c).forEach((x) => { if (x.req) delete x.req[acc]; });
      mail(m, acc, { text: `Você foi aceito no clã ${c.name}!` }); log(c, `${q.name} entrou no clã`); }
    write(m); return { ok: true, msg: yes ? `${q.name} agora é do clã.` : `Pedido de ${q.name} recusado.` }; }
  function leave() { const m = read(), c = mine(m); if (!c) return { ok: false, msg: "Você não está num clã." }; const k = me(), was = c.members[k].role;
    delete c.members[k]; delete m.mem[k]; const rest = Object.entries(c.members);
    if (!rest.length) { delete m.c[c.id]; write(m); return { ok: true, msg: `Você saiu e o clã ${c.name} foi desfeito.` }; }
    if (was === "lider") { const nx = rest.sort((a, b) => (b[1].role === "sub") - (a[1].role === "sub") || a[1].joined - b[1].joined)[0]; nx[1].role = "lider"; c.leader = nx[0]; log(c, `${nx[1].name} virou o líder`); }
    log(c, `${myName()} saiu do clã`); write(m); return { ok: true, msg: `Você saiu do clã ${c.name}.` }; }
  function manage(acc, act) { const m = read(), c = mine(m); if (!c) return { ok: false, msg: "Você não está num clã." }; const x = c.members[acc], my = role(c, me());
    if (!x || acc === me()) return { ok: false, msg: "Membro não encontrado." };
    if (my !== "lider" && !(my === "sub" && x.role === "membro" && act === "kick")) return { ok: false, msg: "Só o líder faz isso." };
    if (act === "kick") { delete c.members[acc]; delete m.mem[acc]; mail(m, acc, { text: `Você foi removido do clã ${c.name}.` }); log(c, `${x.name} foi removido do clã`); }
    else if (act === "up") { x.role = "sub"; log(c, `${x.name} virou sublíder`); }
    else if (act === "down") { x.role = "membro"; }
    else if (act === "lead") { x.role = "lider"; c.members[me()].role = "sub"; c.leader = acc; log(c, `${x.name} virou o líder`); }
    write(m); return { ok: true, msg: act === "kick" ? `${x.name} saiu do clã.` : act === "up" ? `${x.name} agora é sublíder.` : act === "down" ? `${x.name} voltou a ser membro.` : `${x.name} agora é o líder.` }; }
  function setMural(text) { const m = read(), c = mine(m); if (!c || !boss(c)) return { ok: false, msg: "Só a liderança edita o mural." }; c.mural = { text: String(text || "").slice(0, K().muralMax), by: myName(), t: Date.now() }; write(m); return { ok: true, msg: "Mural atualizado." }; }
  function setEntry(e) { const m = read(), c = mine(m); if (!c || role(c, me()) !== "lider") return { ok: false, msg: "Só o líder muda a entrada." }; c.entry = e === "pedido" ? "pedido" : "livre"; write(m); return { ok: true, msg: c.entry === "livre" ? "Entrada livre: qualquer treinador entra." : "Entrada com pedido: a liderança aceita quem entra." }; }
  function buy(i) { const q = K().shop[i], s = G.state; if (!q) return { ok: false, msg: "Item não encontrado." }; if ((s.clanFrag || 0) < q.frag) return { ok: false, msg: "Fragmentos insuficientes." };
    s.clanFrag -= q.frag; if (q.id === "dia") s.diamonds = (s.diamonds || 0) + q.n; else { const cs = G.cons(); cs[q.id] = (cs[q.id] || 0) + q.n; } G.save(); G.emit("resources");
    return { ok: true, msg: `Comprado: ${q.n}× ${itemOf(q.id).name}.` }; }

  // ---------- tela ----------
  const ui = { tab: "meu", q: "", filt: "todos", sort: "cargo", dq: "", dfilt: "", dsort: "forca", icon: "", entry: "livre", name: "", how: false, edit: false, menu: false, confirm: "" };
  const NAV = [["meu", "🏰", "Meu clã"], ["membros", "👥", "Membros"], ["guerra", "⚔️", "Guerra"], ["raide", "🐉", "Raide"], ["loja", "💠", "Loja"], ["descobrir", "🔭", "Descobrir"]];
  const SUB = { meu: "Seu clã, as missões do dia e o que fazer agora.", membros: "Membros, cargos, pedidos de entrada e vagas.", guerra: "Guerra semanal contra um clã rival de força parecida.", raide: "Um boss por semana, derrotado em equipe.", loja: "Troque Fragmentos de Raide e de Guerra por itens.", descobrir: "Clãs do servidor, ordenados por força." };
  const ago = (t) => { const d = Math.floor((Date.now() - (t || 0)) / DAY); return d <= 0 ? "ativo hoje" : d === 1 ? "ontem" : `há ${d} dias`; };
  const ini = (n) => esc(String(n || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?");
  const hue = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const cIco = (id, cls = "") => `<span class="cl-ico ${cls}">${spr(id)}</span>`;
  const head = (ic, t, r = "") => `<header class="cl-ph"><h4><i>${ic}</i>${t}</h4>${r ? `<small>${r}</small>` : ""}</header>`;
  const btn = (attr, label, cls = "", why = "") => `<button type="button" class="mk-btn ${cls}" ${attr} ${why ? `disabled title="${esc(why)}"` : ""}>${label}</button>`;

  function heroHtml(c) { const L = lvl(c), n = Object.keys(c.members).length, r = role(c, me());
    return `<section class="cl-hero"><div class="cl-hav">${cIco(c.icon, "big")}</div>
      <div class="cl-hmid"><div class="cl-hk"><span class="cl-role ${r}">${r === "lider" ? "👑 Líder" : r === "sub" ? "🛡 Sublíder" : "Membro"}</span><small>Seu clã</small></div><h3>${esc(c.name)}</h3>
        <div class="cl-chips"><span>👥 <b>${n}</b>/${K().max} <em>membros</em></span><span>⚡ <b>${fmt(power(c))}</b> <em>força</em></span><span>${c.entry === "livre" ? "🚪 <b>Entrada livre</b>" : "✉️ <b>Com pedido</b>"} <em>entrada</em></span></div></div>
      <div class="cl-lv"><div class="cl-ring" style="--p:${L.need ? Math.round((L.cur / L.need) * 100) : 100}"><small>Nível</small><b>${L.l}</b></div><em>${L.need ? `${fmt(L.cur)} / ${fmt(L.need)} XP` : "Nível máximo"}</em></div>
      <div class="cl-hact"><button type="button" class="mk-btn" data-cl-menu>⋯</button>${ui.menu ? `<div class="cl-menu">${r === "lider" ? `<button type="button" data-cl-entry="${c.entry === "livre" ? "pedido" : "livre"}">${c.entry === "livre" ? "✉️ Entrada com pedido" : "🚪 Entrada livre"}</button>` : ""}<button type="button" class="warn" data-cl-confirm="leave">🚪 Sair do clã</button></div>` : ""}</div></section>`; }
  function nowRows(c) { const rows = [], d = c.daily;
    const done = K().missions.filter((q) => !misGot(c, q.id) && misProg(c, q) >= q.n).length; if (done) rows.push(["🎁", `${done} missão(ões) pronta(s) para resgatar`, "Resgate abaixo e ganhe Gold e XP para o clã.", ""]);
    const rq = Object.keys(c.req || {}).length; if (rq && boss(c)) rows.push(["✉️", `${rq} pedido(s) de entrada`, "Aceite ou recuse na aba Membros.", "membros"]);
    if (!canFight("raid")) rows.push(["🐉", "Sua tentativa do Raide está liberada", `Ataque o ${charName(c.raid.boss)} e cause dano para o clã.`, "raide"]);
    if (!canFight("war")) rows.push(["⚔️", "Sua batalha da Guerra está liberada", `Vença o seu adversário de ${esc(c.war.rival.name)}.`, "guerra"]);
    return rows; }
  function meuHtml(c) { const rows = nowRows(c), B = bonusParts(c), mis = K().missions;
    return `${heroHtml(c)}<div class="cl-cols"><div class="cl-col">
      <section class="cl-panel">${head("📅", "Agora no clã", rows.length ? `${rows.length} pendente(s)` : "nada pendente")}
        ${rows.length ? `<div class="cl-now">${rows.map(([i, t, p, go]) => `<${go ? `button type="button" data-cl-tab="${go}"` : "div"} class="cl-nowr"><span>${i}</span><div><b>${t}</b><small>${p}</small></div>${go ? "<em>›</em>" : ""}</${go ? "button" : "div"}>`).join("")}</div>`
          : `<div class="cl-idle"><span>🏕️</span><div><b>Tudo em dia por aqui!</b><small>Novas missões chegam todo dia. Enquanto isso, vença e roube jogadores: tudo conta para o clã.</small></div></div>`}</section>
      <section class="cl-panel">${head("📜", "Missões diárias", `renovam em <b data-cl-end="${dayEnd()}">${left(dayEnd() - Date.now())}</b>`)}
        <div class="cl-mis">${mis.map((q) => { const p = Math.min(q.n, misProg(c, q)), got = misGot(c, q.id), ok = p >= q.n;
          return `<div class="cl-misr ${got ? "got" : ""}"><span class="cl-mi">${q.icon}</span><div class="cl-mm"><b>${q.name}</b><small>${q.desc}</small><div class="cl-bar"><i style="width:${(p / q.n) * 100}%"></i></div></div>
            <div class="cl-mr"><span class="cl-rw">+${q.xp} XP <em>+${fmt(q.gold)} 🪙</em></span><span class="cl-cnt">${f1(p)}/${q.n}</span>${got ? `<em class="cl-ok">✓ Resgatada</em>` : btn(`data-cl-mis="${q.id}"`, "Resgatar", ok ? "go gold" : "", ok ? "" : "A missão ainda não terminou")}</div></div>`; }).join("")}</div></section></div>
      <div class="cl-col"><section class="cl-panel">${head("✨", "Bônus do clã", "valem para todos os membros")}
        <div class="cl-bon">${[["xp", "⭐", "Experiência", "%"], ["gold", "🪙", "Gold", "%"], ["steal", "📄", "Chance de roubo", " pt"]].map(([k, i, t, u]) => { const [a, b] = B[k];
          return `<div class="cl-bonc"><span>${i}</span><small>${t}</small><b>+${f1(a + b)}${u}</b><em>Pelo nível +${f1(a)}${u}</em>${b ? `<em class="war">Guerra +${f1(b)}${u}</em>` : ""}</div>`; }).join("")}</div>
        ${B.until ? `<p class="cl-bnote">🏆 Bônus de vitória na Guerra termina em <b data-cl-end="${B.until}">${left(B.until - Date.now())}</b>.</p>` : ""}</section>
      <section class="cl-panel">${head("📌", "Mural do clã", boss(c) && !ui.edit ? `<button type="button" class="cl-lnk" data-cl-edit>Editar</button>` : "")}
        ${ui.edit ? `<textarea id="clMural" class="cl-ta" maxlength="${K().muralMax}">${esc(c.mural.text)}</textarea><div class="cl-row-r">${btn("data-cl-edit", "Cancelar")}${btn("data-cl-mural", "Salvar", "go")}</div>`
          : `<div class="cl-mural"><p>${esc(c.mural.text).replace(/\n/g, "<br>")}</p><small>— ${esc(c.mural.by)} · ${new Date(c.mural.t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small></div>`}</section>
      <section class="cl-panel">${head("🕘", "Atividade")}<div class="cl-log">${(c.log || []).slice(0, 8).map((x) => `<div><small>${new Date(x.t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small><span>${esc(x.text)}</span></div>`).join("") || "<p class='cl-mute'>Nada ainda.</p>"}</div></section></div></div>`; }
  function createHtml() { const ids = sprIds().slice(0, 16); if (!ui.icon || !ids.includes(ui.icon)) ui.icon = ids[0]; const s = G.state, ok = s.gold >= K().cost;
    return `<section class="cl-ban plaza"><div><small>Comunidade de treinadores</small><h3>Você ainda não tem clã</h3><p>Junte-se a outros treinadores: missões do dia, bônus de XP, Gold e roubo, Raide do boss e Guerra toda semana.</p></div>${btn('data-cl-tab="descobrir"', "🔭 Procurar clãs", "go")}</section>
      <section class="cl-panel cl-create">${head("🏰", "Criar um clã", `custa <b>${fmt(K().cost)}</b> 🪙`)}
        <label class="cl-lab">Nome do clã<input id="clName" class="mk-in" maxlength="${K().nameMax}" placeholder="Ex.: Egoístas do Norte" value="${esc(ui.name)}"></label>
        <div class="cl-lab">Símbolo<div class="cl-icons">${ids.map((id) => `<button type="button" class="${ui.icon === id ? "on" : ""}" data-cl-icon="${id}" title="${esc(charName(id))}">${spr(id)}</button>`).join("")}</div></div>
        <div class="cl-lab">Entrada<div class="cl-seg"><button type="button" class="${ui.entry === "livre" ? "on" : ""}" data-cl-ent="livre"><b>🚪 Livre</b><small>Qualquer treinador entra</small></button><button type="button" class="${ui.entry === "pedido" ? "on" : ""}" data-cl-ent="pedido"><b>✉️ Com pedido</b><small>A liderança aceita</small></button></div></div>
        <div class="cl-row-r"><small class="cl-mute">Seu Gold: ${fmt(s.gold)}</small>${btn("data-cl-create", `Criar clã · ${fmt(K().cost)} 🪙`, "go gold", ok ? "" : "Gold insuficiente")}</div></section>`; }
  function membrosHtml(c) { const mm = Object.entries(c.members), maxP = Math.max(1, ...mm.map(([, x]) => x.power || 0)), R = { lider: 0, sub: 1, membro: 2 }, q = ui.q.toLowerCase();
    let L = mm.filter(([, x]) => !q || x.name.toLowerCase().includes(q));
    if (ui.filt === "lid") L = L.filter(([, x]) => x.role !== "membro"); if (ui.filt === "ina") L = L.filter(([, x]) => Date.now() - x.last >= 7 * DAY);
    L.sort((a, b) => ui.sort === "forca" ? b[1].power - a[1].power : ui.sort === "vit" ? b[1].wins - a[1].wins : ui.sort === "xp" ? b[1].xp - a[1].xp : R[a[1].role] - R[b[1].role] || b[1].power - a[1].power);
    const my = role(c, me()), req = Object.entries(c.req || {});
    return `${req.length && boss(c) ? `<section class="cl-panel">${head("✉️", "Pedidos de entrada", `${req.length}`)}<div class="cl-mem">${req.map(([acc, x]) => `<div class="cl-memr req"><span class="cl-av" style="--h:${hue(x.name)}">${ini(x.name)}</span><div class="cl-mn"><b>${esc(x.name)}</b><small>pediu ${ago(x.t).replace("ativo ", "")}</small></div><span class="cl-mp">⚡ ${fmt(x.power)}</span><div class="cl-ma">${btn(`data-cl-ans="${esc(acc)}|1"`, "Aceitar", "go")}${btn(`data-cl-ans="${esc(acc)}|0"`, "Recusar")}</div></div>`).join("")}</div></section>` : ""}
      <section class="cl-panel">${head("👥", "Membros", `${mm.length}/${K().max}`)}
      <div class="cl-tools"><label class="cl-q"><span>🔍</span><input id="clQ" type="search" placeholder="Buscar membro" value="${esc(ui.q)}"></label>
        ${[["todos", `Todos ${mm.length}`], ["lid", `Líder e sublíderes ${mm.filter(([, x]) => x.role !== "membro").length}`], ["ina", `Inativos 7+ dias ${mm.filter(([, x]) => Date.now() - x.last >= 7 * DAY).length}`]].map(([v, t]) => `<button type="button" class="cl-chip ${ui.filt === v ? "on" : ""}" data-cl-filt="${v}">${t}</button>`).join("")}
        <label class="cl-sort">Ordenar<select id="clSort">${[["cargo", "Cargo"], ["forca", "Força"], ["vit", "Vitórias"], ["xp", "Contribuição"]].map(([v, t]) => `<option value="${v}" ${ui.sort === v ? "selected" : ""}>${t}</option>`).join("")}</select></label></div>
      <div class="cl-mem">${L.map(([acc, x]) => { const act = Date.now() - x.last < 7 * DAY, isMe = acc === me();
        const acts = !isMe && (my === "lider" || (my === "sub" && x.role === "membro")) ? `<div class="cl-ma">${my === "lider" ? (x.role === "membro" ? btn(`data-cl-man="${esc(acc)}|up"`, "Promover") : btn(`data-cl-man="${esc(acc)}|down"`, "Rebaixar")) + btn(`data-cl-confirm="lead|${esc(acc)}"`, "👑") : ""}${btn(`data-cl-confirm="kick|${esc(acc)}"`, "Expulsar", "warn")}</div>` : "";
        return `<div class="cl-memr ${x.role} ${isMe ? "me" : ""}"><span class="cl-av" style="--h:${hue(x.name)}">${ini(x.name)}<i>${x.role === "lider" ? "👑" : x.role === "sub" ? "🛡" : ""}</i></span>
          <div class="cl-mn"><b>${esc(x.name)}${isMe ? " <em>você</em>" : ""}</b><small class="${x.role}">${x.role === "lider" ? "Líder" : x.role === "sub" ? "Sublíder" : "Membro"}</small></div>
          <div class="cl-mpw"><span>⚡ ${fmt(x.power)}</span><div class="cl-bar"><i style="width:${((x.power || 0) / maxP) * 100}%"></i></div></div>
          <div class="cl-mst"><span title="Vitórias">🏆 ${fmt(x.wins)}</span><span title="Roubos">📄 ${fmt(x.steals)}</span><span title="XP dado ao clã">⭐ ${fmt(x.xp)}</span></div>
          <span class="cl-act ${act ? "on" : ""}">${ago(x.last)}</span>${acts}</div>`; }).join("") || "<p class='cl-mute'>Ninguém encontrado.</p>"}</div></section>`; }
  function teamCards(ps, cls = "") { return `<div class="cl-team ${cls}">${ps.map((p) => { const r = BL.rarity(p.rarity), pos = C.POSITIONS.find((x) => x.id === p.position); return `<div class="cl-pl" style="--rc:${r.color}"><span class="cl-plsp">${spr(p.charId)}</span><b>${esc(p.name)}</b><small>Nv ${fmt(p.level)}${pos ? ` · ${esc(pos.short)}` : ""}</small></div>`; }).join("")}</div>`; }
  function guerraHtml(c) { const w = c.war, now = Date.now(), bAt = battleAt(), end = weekEnd(), battle = now >= bAt, us = w.rows.reduce((a, x) => a + x.won, 0);
    const frac = battle ? Math.min(1, (now - bAt) / (end - bAt)) : 0, them = Math.floor(w.rows.reduce((a, x) => a + x.lost, 0) * frac); // o rival ataca ao longo do dia de batalha
    const shown = Math.ceil(w.rows.length * frac), rpw = w.rows.reduce((a, x) => a + x.dpw, 0), mpw = w.rows.reduce((a, x) => a + x.pw, 0), diff = Math.round((Math.abs(rpw - mpw) / Math.max(1, Math.max(rpw, mpw))) * 100);
    const row = w.rows.find((x) => x.acc === me()), why = canFight("war"), wd = new Date(+w.week).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const steps = [["Pareamento", 1], ["Preparação", !battle], ["Dia de batalha", battle], ["Resultado", 0]];
    return `<section class="cl-ban war"><div><small>${battle ? "Dia de batalha" : "Preparação"} · semana de ${wd}</small><h3>Contra ${esc(w.rival.name)}</h3><p>Batalha de quinta a domingo. Cada escalado enfrenta o adversário da mesma posição (#1 contra #1) em partidas 4×4, com até ${K().war.tries} tentativas. Vitória = 1 ponto para o clã.</p>
        <div class="cl-steps">${steps.map(([t, on], i) => `<span class="${i === 0 || (i === 1 && battle) ? "done" : on ? "on" : ""}"><i>${i === 0 || (i === 1 && battle) ? "✓" : i + 1}</i>${t}</span>`).join("")}</div></div>
      <div class="cl-timer"><small>${battle ? "A guerra termina em" : "O dia de batalha começa em"}</small><b data-cl-end="${battle ? end : bAt}">${left((battle ? end : bAt) - now)}</b></div></section>
      <section class="cl-panel cl-vs"><div class="cl-side us">${cIco(c.icon, "mid")}<small>Seu clã</small><b>${esc(c.name)}</b><div><span><b>${fmt(mpw)}</b>força</span><span><b>${w.rows.length}</b>escalados</span><span class="pts"><b>${us}</b>pontos</span></div></div>
        <div class="cl-vsm"><span>VS</span><em>${diff}% de diferença</em></div>
        <div class="cl-side them">${cIco(w.rival.icon, "mid")}<small>Adversário · NPC</small><b>${esc(w.rival.name)}</b><div><span><b>${fmt(rpw)}</b>força</span><span><b>${w.rows.length}</b>escalados</span><span class="pts"><b>${them}</b>pontos</span></div></div></section>
      <div class="cl-cols"><div class="cl-col"><section class="cl-panel">${head("⚔️", "Sua batalha", row ? (row.won ? "vencida" : `${Math.max(0, K().war.tries - row.tries)} de ${K().war.tries} tentativas`) : "fora da escalação")}
          ${row ? `<p class="cl-txt">Seu adversário é <b>${esc(row.rival)}</b> (#${w.rows.indexOf(row) + 1}), força ⚡ ${fmt(row.dpw)}.</p>${teamCards(defPlayers(row.def))}
            ${row.won ? `<p class="cl-okline">✓ Você venceu ${esc(row.score)} e garantiu 1 ponto.</p>` : ""}<div class="cl-row-r"><small class="cl-mute">${why ? esc(why) : "Partida 4×4 com o seu time escalado."}</small>${btn('data-cl-go="war"', "⚔️ Atacar", "go gold", why)}</div>`
            : `<p class="cl-txt">Você entrou depois do pareamento. Na próxima semana você entra na escalação.</p>`}</section>
        ${c.buff && c.buff.until > now ? `<section class="cl-panel cl-win"><span>🏆</span><div><b>Bônus de vitória ativo: +${c.buff.xp}% de XP e +${c.buff.gold}% de Gold</b><small>Somado ao bônus de nível do clã.</small></div><div class="cl-timer sm"><small>Termina em</small><b data-cl-end="${c.buff.until}">${left(c.buff.until - now)}</b></div></section>` : ""}
        <section class="cl-panel">${head("🏆", "Últimas guerras", (c.wars || []).length ? `${(c.wars || []).filter((x) => x.res === "win").length} vitória(s) em ${(c.wars || []).length}` : "")}
          <div class="cl-wars">${(c.wars || []).map((x) => `<div class="${x.res}"><span>${x.res === "win" ? "🟢" : x.res === "draw" ? "⚪" : "🔴"}</span><div><b>${esc(x.rival)}</b><small>${new Date(+x.week).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · ${x.res === "win" ? "Vitória" : x.res === "draw" ? "Empate" : "Derrota"}</small></div><em>${x.us} × ${x.them}</em></div>`).join("") || "<p class='cl-mute'>A primeira guerra termina no domingo.</p>"}</div>
          <p class="cl-mute">Vitória: +${K().war.buff.xp}% de XP e +${K().war.buff.gold}% de Gold por uma semana, ${K().war.win.frag} 💠 e ${fmt(K().war.win.gold)} 🪙 para quem atacou.</p></section></div>
      <div class="cl-col"><section class="cl-panel">${head("📋", "Escalações", "#1 contra #1, pela força do time")}
        <div class="cl-lines">${w.rows.map((x, i) => `<div class="${x.acc === me() ? "me" : ""}"><i>#${i + 1}</i><span class="l"><b>${esc(x.name)}</b><small>⚡ ${fmt(x.pw)}</small></span>
          <span class="cl-dl"><em class="a ${x.won ? "w" : x.tries ? "t" : ""}" title="Seu ataque">${x.won ? "✓" : x.tries ? "✗".repeat(Math.min(3, x.tries)) : ""}</em><u></u><em class="d ${i < shown ? (x.lost ? "l" : "w") : ""}" title="Ataque do rival">${i < shown ? (x.lost ? "✗" : "✓") : ""}</em></span>
          <span class="r"><b>${esc(x.rival)}</b><small>⚡ ${fmt(x.dpw)}</small></span></div>`).join("")}</div>
        <p class="cl-mute">Verde à esquerda: você venceu o seu ataque. À direita: a sua defesa contra o ataque do rival (aparece ao longo do dia de batalha).</p></section></div></div>`; }
  function raideHtml(c) { const r = c.raid, R = K().raid, now = Date.now(), end = weekEnd(), why = canFight("raid"), t = r.tries[me()] || { day: "", n: 0 }, team = raidTeam(c);
    const ranks = Object.entries(r.dmg).sort((a, b) => b[1] - a[1]), mx = Math.max(1, ...ranks.map((x) => x[1])), bt = (C.BOSS_ROTATION || []).find((b) => charName(r.boss).includes(b.name.split(" ")[1] || "§"));
    const pct = Math.min(100, (r.down / r.hp) * 100);
    return `<section class="cl-ban raid"><div class="cl-boss">${spr(r.boss)}</div><div><small>Raide da semana · tier ${r.tier}</small><h3>${esc(charName(r.boss))}</h3><p>${bt ? esc(bt.title) : "Boss do clã"}</p>
        <div class="cl-hp"><span>${r.killed ? "Derrotado!" : "Vida do boss"}</span><b>${f1(Math.max(0, r.hp - r.down))} / ${f1(r.hp)} barras</b></div><div class="cl-hpbar"><i style="width:${100 - pct}%"></i></div></div>
      <div class="cl-timer"><small>A semana termina em</small><b data-cl-end="${end}">${left(end - now)}</b></div></section>
      <div class="cl-cols"><div class="cl-col"><section class="cl-panel">${head("🗡️", "Sua tentativa de hoje", `${t.n}/${R.tries} na semana`)}
          <p class="cl-txt">${r.killed ? "O boss desta semana já caiu. A sua parte da recompensa chega sozinha." : t.day === G.dayKey() ? "Você já atacou hoje. Nova tentativa amanhã." : "Partida 4×4 com o seu time escalado contra a equipe do boss. Cada gol e cada finalização viram dano."}</p>
          <p class="cl-mute">Você já causou <b>${f1(r.dmg[me()] || 0)} barras</b> nesta semana. 1 tentativa por dia, até ${R.tries} por semana.</p>
          ${btn('data-cl-go="raid"', why ? "🐉 Sem tentativa agora" : "🐉 Atacar o boss", "go gold wide", why)}${why && !r.killed && t.day !== G.dayKey() ? `<small class="cl-mute">${esc(why)}</small>` : ""}</section>
        <section class="cl-panel">${head("🐉", "Equipe do boss", `nível ${fmt(team[0].level)}`)}${teamCards(team, "boss")}<p class="cl-mute">O nível acompanha o seu time escalado e sobe a cada tier.</p></section>
        <section class="cl-panel">${head("📘", "Como causar dano")}<div class="cl-how"><span><b>Gol</b>${f1(R.goal)} barras</span><span><b>Finalização</b>${f1(R.shot)} barra</span><span><b>Vitória</b>dano ×${f1(R.winK)}</span></div></section></div>
      <div class="cl-col"><section class="cl-panel">${head("🎁", "Recompensas", "ao derrotar o boss")}
          <div class="cl-rew"><span>💠 ~${R.reward.frag} Fragmentos</span><span>🪙 ~${fmt(R.reward.gold)}</span>${Object.entries(R.reward.items).map(([id, n]) => `<span>${itemOf(id).icon} ${n}× ${esc(itemOf(id).name)}</span>`).join("")}</div>
          <p class="cl-mute">Por membro que atacou: ${Math.round(R.share * 100)}% igual para todos e ${Math.round((1 - R.share) * 100)}% pelo dano. Boss derrotado sobe o tier da semana seguinte.</p>
          <div class="cl-fragb">💠 <b>${fmt(G.state.clanFrag || 0)}</b> Fragmentos ${btn('data-cl-tab="loja"', "Abrir a Loja do clã ›", "")}</div></section>
        <section class="cl-panel">${head("📊", "Dano do clã nesta semana", `${ranks.length} atacante(s)`)}
          <div class="cl-rank">${ranks.map(([acc, v], i) => `<div class="${acc === me() ? "me" : ""}"><i>${i < 3 ? ["🥇", "🥈", "🥉"][i] : "#" + (i + 1)}</i><span><b>${esc((c.members[acc] || {}).name || acc)}</b><div class="cl-bar raid"><i style="width:${(v / mx) * 100}%"></i></div></span><em>${f1(v)} barras</em><small>${(r.tries[acc] || {}).n || 0} tent.</small></div>`).join("") || "<p class='cl-mute'>Ninguém atacou ainda nesta semana.</p>"}</div></section>
        <section class="cl-panel">${head("🏆", "Histórico")}<div class="cl-wars">${(c.raidHist || []).map((x) => `<div class="${x.killed ? "win" : "lose"}"><span>${cIco(x.boss, "sm")}</span><div><b>${esc(charName(x.boss))} · tier ${x.tier}</b><small>${new Date(+x.week).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · ${x.killed ? "Boss derrotado" : "Escapou"}</small></div><em>${Math.min(100, Math.round((x.down / x.hp) * 100))}%</em></div>`).join("") || "<p class='cl-mute'>O primeiro Raide termina no domingo.</p>"}</div></section></div></div>`; }
  function lojaHtml() { const s = G.state;
    return `<section class="cl-ban shop"><div><small>Tesouro do clã</small><h3>Loja do clã</h3><p>Fragmentos chegam do Raide (boss derrotado) e da Guerra (vitória ou derrota, para quem atacou).</p></div><div class="cl-timer"><small>Seus Fragmentos</small><b>💠 ${fmt(s.clanFrag || 0)}</b></div></section>
      <div class="cl-shop">${K().shop.map((q, i) => { const it = itemOf(q.id), ok = (s.clanFrag || 0) >= q.frag; return `<div class="cl-item"><span class="cl-iic">${it.icon}</span><b>${q.n > 1 ? q.n + "× " : ""}${esc(it.name)}</b><small>${esc(it.desc || (q.id === "dia" ? "Moeda premium do jogo" : ""))}</small>${btn(`data-cl-buy="${i}"`, `💠 ${q.frag}`, "go", ok ? "" : "Fragmentos insuficientes")}</div>`; }).join("")}</div>`; }
  function descHtml(m, c) { const q = ui.dq.toLowerCase(); let L = Object.values(m.c).map((x) => ({ x, p: power(x), n: Object.keys(x.members).length, l: lvl(x).l }));
    L.sort((a, b) => b.p - a.p); L.forEach((e, i) => (e.rank = i + 1));
    if (q) L = L.filter((e) => e.x.name.toLowerCase().includes(q)); if (ui.dfilt === "vaga") L = L.filter((e) => e.n < K().max); if (ui.dfilt === "livre") L = L.filter((e) => e.x.entry === "livre");
    if (ui.dsort === "nivel") L.sort((a, b) => b.l - a.l || b.p - a.p); if (ui.dsort === "membros") L.sort((a, b) => b.n - a.n);
    return `<section class="cl-ban plaza"><div><small>Praça dos clãs</small><h3>Descobrir clãs</h3><p>${c ? "Veja como os outros clãs estão. Para trocar de clã, saia do seu primeiro." : "Entre num clã ou crie o seu."}</p></div><div class="cl-timer"><small>Clãs no servidor</small><b>${Object.keys(m.c).length}</b></div></section>
      <div class="cl-tools"><label class="cl-q"><span>🔍</span><input id="clDq" type="search" placeholder="Buscar clã pelo nome" value="${esc(ui.dq)}"></label>
        ${[["vaga", "Com vagas"], ["livre", "Entrada livre"]].map(([v, t]) => `<button type="button" class="cl-chip ${ui.dfilt === v ? "on" : ""}" data-cl-dfilt="${v}">${t}</button>`).join("")}
        <label class="cl-sort">Ordenar<select id="clDsort">${[["forca", "Força"], ["nivel", "Nível"], ["membros", "Membros"]].map(([v, t]) => `<option value="${v}" ${ui.dsort === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        ${c ? "" : btn('data-cl-tab="meu"', "🏰 Criar clã", "go gold")}</div>
      <div class="cl-grid">${L.map(({ x, p, n, l, rank }) => { const isMine = c && c.id === x.id, rq = (x.req || {})[me()], b = l * K().perLv.xp;
        return `<div class="cl-card ${isMine ? "mine" : ""}"><i class="cl-rk">#${rank}</i>${isMine ? `<em class="cl-tag">Seu clã</em>` : ""}<div class="cl-ch">${cIco(x.icon, "mid")}<div><b>${esc(x.name)}</b><small>Nível ${l} · ${x.entry === "livre" ? "entrada livre" : "com pedido"}</small></div></div>
          <div class="cl-cst"><span>👥 ${n}/${K().max}</span><span>⚡ ${fmt(p)}</span><span>⭐ +${f1(b)}%</span></div><div class="cl-bar ${n >= K().max ? "full" : ""}"><i style="width:${(n / K().max) * 100}%"></i></div>
          ${isMine ? "" : c ? "" : rq ? btn(`data-cl-cancel="${x.id}"`, "Pedido enviado · cancelar", "wide") : btn(`data-cl-join="${x.id}"`, n >= K().max ? "Cheio" : x.entry === "livre" ? "Entrar" : "Pedir para entrar", "go wide", n >= K().max ? "Clã cheio" : "")}</div>`; }).join("") || `<div class="mk-empty big">🏰<p>${Object.keys(m.c).length ? "Nenhum clã encontrado." : "Nenhum clã ainda. Crie o primeiro!"}</p></div>`}</div>
      <section class="cl-panel">${head("⚔️", "Clãs rivais de guerra", "NPC · enfrentam os clãs na Guerra semanal")}<div class="cl-rivals">${K().rivals.map(([n, ic]) => `<span>${cIco(ic, "sm")}<b>${esc(n)}</b></span>`).join("")}</div></section>`; }
  function howHtml() { return `<div class="mk-sheet"><div class="mk-sbox cl-howbox"><div class="mk-sh"><h4>Como funciona a Guilda</h4><button type="button" class="eq-x" data-cl-how aria-label="Fechar">✕</button></div>
      <p><b>Clã.</b> Crie um (${fmt(K().cost)} Gold) ou entre num clã da Praça. Até ${K().max} membros. Entrada livre ou com pedido aceito pela liderança (líder e sublíderes).</p>
      <p><b>Nível e bônus.</b> Vitórias, roubos e missões dos membros dão XP ao clã. Cada nível dá a todos +${K().perLv.xp}% de XP, +${K().perLv.gold}% de Gold e +${K().perLv.steal} pt de chance de roubo (nível máximo ${K().lv.max}).</p>
      <p><b>Missões diárias.</b> Algumas contam só o que você fez, outras somam o clã inteiro. Resgate para ganhar Gold e XP para o clã.</p>
      <p><b>Raide.</b> Um boss por semana. 1 tentativa por dia (até ${K().raid.tries}) em partida 4×4: gols e finalizações viram barras de dano. Derrotado, todos que atacaram ganham Fragmentos, Gold e itens.</p>
      <p><b>Guerra.</b> Toda semana o clã enfrenta um clã rival NPC de força parecida. De quinta a domingo cada escalado ataca o seu adversário (#1 contra #1), até ${K().war.tries} tentativas. Vitória vale 1 ponto; o rival também ataca as defesas. Quem fizer mais pontos vence: +${K().war.buff.xp}% de XP e +${K().war.buff.gold}% de Gold por uma semana.</p>
      <p><b>Online depois.</b> Por enquanto os clãs valem para as contas deste navegador.</p></div></div>`; }
  function confirmHtml(c) { const [k, acc] = ui.confirm.split("|"), x = acc && c && c.members[acc];
    const txt = k === "leave" ? (role(c, me()) === "lider" && Object.keys(c.members).length > 1 ? "Você é o líder: a liderança passa para um sublíder (ou o membro mais antigo)." : Object.keys(c.members).length === 1 ? "Você é o único membro: o clã será desfeito." : "Você pode entrar em outro clã depois.") : k === "kick" ? `${esc(x ? x.name : "")} sai do clã.` : `${esc(x ? x.name : "")} vira o líder e você vira sublíder.`;
    return `<div class="mk-sheet"><div class="mk-sbox"><div class="mk-sh"><h4>${k === "leave" ? "Sair do clã?" : k === "kick" ? "Expulsar membro?" : "Passar a liderança?"}</h4><button type="button" class="eq-x" data-cl-confirm="" aria-label="Fechar">✕</button></div><p class="cl-txt">${txt}</p>
      <div class="mk-sf">${btn('data-cl-confirm=""', "Cancelar")}${btn(`data-cl-do="${esc(ui.confirm)}"`, k === "leave" ? "Sair" : k === "kick" ? "Expulsar" : "Passar", "go")}</div></div></div>`; }

  function render(sy) { const ov = $("clOv"); if (!ov) return; const { m, c, got } = sy || sync(); if (got && got.length) toast(`Guilda: ${got.map((x) => x.text).filter(Boolean).join(" · ") || "entregas recebidas"}.`, "gold");
    if (!c && ["membros", "guerra", "raide"].includes(ui.tab)) ui.tab = "meu";
    const s = G.state, body = ui.tab === "meu" ? (c ? meuHtml(c) : createHtml()) : ui.tab === "membros" ? membrosHtml(c) : ui.tab === "guerra" ? guerraHtml(c) : ui.tab === "raide" ? raideHtml(c) : ui.tab === "loja" ? lojaHtml() : descHtml(m, c);
    const fo = document.activeElement && document.activeElement.id, sel = fo && document.activeElement.selectionStart, sc = ov.querySelector(".cl-body") ? ov.querySelector(".cl-body").scrollTop : 0;
    ov.innerHTML = `<div class="cl-box" role="dialog" aria-modal="true" aria-label="Guilda"><header class="cl-top"><span class="cl-logo"><img src="img/menu/guilda.png" alt=""></span><div class="cl-tt"><small>Comunidade de treinadores</small><h2>Central de Clãs<i class="beta-tag">Beta · em teste</i></h2><p>${SUB[ui.tab]}</p></div>
        <div class="cl-topr"><span class="cl-pill">💠 <b>${fmt(s.clanFrag || 0)}</b></span><span class="cl-pill">🪙 <b>${fmt(s.gold)}</b></span><button type="button" class="mk-btn" data-cl-ref title="Atualizar">↻</button><button type="button" class="mk-btn cl-hw" data-cl-how>Como funciona</button><button type="button" class="eq-x" data-cl-close aria-label="Fechar">✕</button></div></header>
      <div class="cl-main"><nav class="cl-nav">${NAV.map(([v, i, t]) => `<button type="button" class="${ui.tab === v ? "on" : ""}" data-cl-tab="${v}" ${!c && ["membros", "guerra", "raide"].includes(v) ? "disabled" : ""}><span>${i}</span>${t}</button>`).join("")}</nav>
        <div class="cl-body">${body}</div></div>${ui.how ? howHtml() : ""}${ui.confirm ? confirmHtml(c) : ""}</div>`;
    const b = ov.querySelector(".cl-body"); if (b) b.scrollTop = sc;
    if (fo && $(fo) && $(fo).matches("input,textarea")) { $(fo).focus(); try { $(fo).setSelectionRange(sel, sel); } catch (e) {} } }
  function open(tab) { let ov = $("clOv"); if (!ov) { ov = document.createElement("div"); ov.id = "clOv"; ov.className = "cl-ov"; document.body.appendChild(ov); bind(ov); }
    if (tab) ui.tab = tab; ui.how = false; ui.confirm = ""; ui.menu = false; ui.edit = false; ov.hidden = false; render(); }
  function close() { const ov = $("clOv"); if (ov) ov.hidden = true; }
  function act(r) { if (r) toast(r.msg, r.ok ? "gold" : ""); render(); }
  function bind(ov) {
    ov.addEventListener("click", (e) => { if (e.target === ov) return close(); const t = e.target.closest("button"); if (!t || t.disabled) { if (ui.menu && !e.target.closest(".cl-menu")) { ui.menu = false; render(); } return; } const d = t.dataset;
      if ("clClose" in d) return close();
      if (d.clTab) { ui.tab = d.clTab; ui.menu = false; ui.edit = false; return render(); }
      if ("clRef" in d) return render();
      if ("clHow" in d) { ui.how = !ui.how; return render(); }
      if ("clMenu" in d) { ui.menu = !ui.menu; return render(); }
      if ("clConfirm" in d) { ui.confirm = d.clConfirm; ui.menu = false; return render(); }
      if (d.clDo) { const [k, acc] = d.clDo.split("|"); ui.confirm = ""; return act(k === "leave" ? leave() : manage(acc, k === "kick" ? "kick" : "lead")); }
      if (d.clEntry) { ui.menu = false; return act(setEntry(d.clEntry)); }
      if ("clEdit" in d) { ui.edit = !ui.edit; return render(); }
      if ("clMural" in d) { ui.edit = false; return act(setMural($("clMural").value)); }
      if (d.clMis) return act(claimMis(d.clMis));
      if (d.clIcon) { ui.icon = d.clIcon; return render(); }
      if (d.clEnt) { ui.entry = d.clEnt; return render(); }
      if ("clCreate" in d) { const r = create($("clName").value, ui.icon, ui.entry); if (r.ok) ui.name = ""; return act(r); }
      if (d.clJoin) { const r = join(d.clJoin); if (r.ok && mine(read())) ui.tab = "meu"; return act(r); }
      if (d.clCancel) return act(cancelReq(d.clCancel));
      if (d.clAns) { const [acc, y] = d.clAns.split("|"); return act(answer(acc, y === "1")); }
      if (d.clMan) { const [acc, k] = d.clMan.split("|"); return act(manage(acc, k)); }
      if (d.clFilt) { ui.filt = d.clFilt; return render(); }
      if (d.clDfilt) { ui.dfilt = ui.dfilt === d.clDfilt ? "" : d.clDfilt; return render(); }
      if (d.clBuy) return act(buy(+d.clBuy));
      if (d.clGo) { const r = start(d.clGo); toast(r.msg, r.ok ? "gold" : ""); if (!r.ok) render(); } });
    ov.addEventListener("input", (e) => { const id = e.target.id; if (id === "clQ") { ui.q = e.target.value; render(); } else if (id === "clDq") { ui.dq = e.target.value; render(); } else if (id === "clName") ui.name = e.target.value; });
    ov.addEventListener("change", (e) => { if (e.target.id === "clSort") { ui.sort = e.target.value; render(); } if (e.target.id === "clDsort") { ui.dsort = e.target.value; render(); } });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !ov.hidden) { if (ui.how || ui.confirm) { ui.how = false; ui.confirm = ""; render(); } else close(); } });
  }
  setInterval(() => { const ov = $("clOv"); if (!ov || ov.hidden) return; let done = false; ov.querySelectorAll("[data-cl-end]").forEach((el) => { const l = +el.dataset.clEnd - Date.now(); el.textContent = left(l); if (l <= 0) done = true; }); if (done && !document.activeElement.matches("#clOv input,#clOv textarea")) render(); }, 1000);
  // abre pelo ícone Guilda do dock e pelo menu (capture: antes do aviso "em breve" da ui.js)
  document.addEventListener("click", (e) => { const t = e.target.closest('[data-clan-open],[data-what="Guilda"]'); if (!t) return; e.preventDefault(); e.stopPropagation(); open(t.dataset.clanOpen || undefined); }, true);
  G.on("matchEnd", () => { const ov = $("clOv"); if (ov && !ov.hidden) render(); });

  BL.Clan = { open, close, read, write, sync, buff, fightTeam, fightEnd, start, canFight, create, join, leave, answer, manage, claimMis, buy, settle, lvl, weekStart, battleAt };
})();
