// BL PROJECT IDLE · v630 (Mickey, refs "Arena PvP") · Arena PvP: Ranqueada (ELO), Copas do dia (grupos + mata-mata, apostas), Multi 2x2, Histórico e Formatos.
// Sem servidor ainda: os outros treinadores são da IA (C.PVP.npcs), com ELO próprio; as suas partidas são 4×4 de verdade (G.pvpFight: game.js troca
// os inimigos por BL.PvP.fightTeam(), no Multi também o seu time por BL.PvP.myTeam(), e chama BL.PvP.fightEnd no fim). Dados por conta em G.state.pvp.
window.BL = window.BL || {};
(function () {
  const C = BL.CONFIG, G = BL.Game, K = () => C.PVP, DAY = 864e5;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => Math.round(n || 0).toLocaleString("pt-BR");
  const toast = (t, c) => BL.UI && BL.UI.toast(t, c);
  const ui = { tab: "vivo", q: "", cup: "", pick: [] };
  function rng(seed) { let x = 7; for (const ch of String(seed)) x = (Math.imul(x, 31) + ch.charCodeAt(0)) >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }
  const sprIds = () => BL.CHARACTERS.filter((c) => C.SPRITES[c.id]).map((c) => c.id);
  const RAR = () => C.RARITIES.map((r) => r.id), rIdx = (id) => RAR().indexOf(id), rName = (id) => (C.RARITIES.find((r) => r.id === id) || {}).name || id;
  const posShort = (id) => (C.POSITIONS.find((p) => p.id === id) || {}).short || "";
  const dayN = (t) => Math.floor(((t || Date.now()) - 3 * 36e5) / DAY); // dia no horário de Brasília
  const myName = () => (G.mkName ? G.mkName() : "Você");
  const spr = (id) => (C.SPRITES[id] ? `<img class="spr" src="${C.SPRITES[id].card}" alt="">` : "");
  const when = (t) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  // ---------- dados ----------
  function st() { const s = G.state; if (!s) return null; s.pvp = s.pvp || {}; const p = s.pvp;
    if (p.elo == null) { p.elo = K().elo; p.w = 0; p.l = 0; } p.hist = p.hist || []; p.cups = p.cups || {}; p.cup = p.cup || null; p.multi = p.multi || []; return p; }
  function npcElo(name) { const r = rng(name), base = 960 + Math.round(r() * 320), d = dayN(), w = rng(name + d); return base + Math.round((w() - 0.5) * 30) + Math.min(60, Math.floor((d % 365) / 6)); }
  const npcs = () => K().npcs.map((n) => ({ name: n, elo: npcElo(n), av: sprIds()[Math.floor(rng(n + "a")() * sprIds().length)] }));
  const avgLv = (L) => Math.max(1, Math.round(L.reduce((a, p) => a + p.level, 0) / Math.max(1, L.length)));
  function teamFor(name, pw, rules, n, seed, posL) { const r = rng(seed || name + Date.now()), mine = G.activePlayers(), myE = st().elo, cap = rules && rules.max ? rIdx(rules.max) : RAR().length - 1;
    let lv = Math.round(avgLv(mine) * (1 + (pw - myE) * K().lvK)); if (rules && rules.maxLv) lv = Math.min(lv, rules.maxLv); lv = Math.max(1, Math.min(C.PLAYER_MAX_LEVEL, lv));
    const top = Math.max(0, Math.min(cap, rIdx(mine.reduce((a, p) => (rIdx(p.rarity) > rIdx(a) ? p.rarity : a), "comum")) + (pw > myE + 80 ? 1 : 0)));
    const ids = sprIds().sort(() => r() - 0.5), pos = posL || C.LINEUP_POS;
    return pos.slice(0, n).map((ps, k) => { const ri = Math.max(0, top - (r() < 0.45 ? 1 : 0)); return BL.makePlayer(ids[k], { rarity: RAR()[ri], level: Math.max(1, lv + Math.round((r() - 0.5) * lv * 0.06)), position: ps, shiny: !!(rules && rules.shiny && k === 0) }); }); }
  function checkRules(L, rules) { rules = rules || {};
    if (rules.max) { const bad = L.find((p) => rIdx(p.rarity) > rIdx(rules.max)); if (bad) return `${bad.name} é ${rName(bad.rarity)}: esta copa vai só até ${rName(rules.max)}.`; }
    if (rules.maxLv) { const bad = L.find((p) => p.level > rules.maxLv); if (bad) return `${bad.name} está no Nv ${bad.level}: esta copa vai até o Nv ${rules.maxLv}.`; }
    if (rules.shiny && !L.some((p) => p.shiny)) return "Esta copa pede pelo menos 1 jogador Shiny no time."; return ""; }
  const ruleChips = (f) => { const r = f.rules || {}, L = ["4×4"]; if (r.max) L.push(`Até ${rName(r.max)}`); if (r.maxLv) L.push(`Até o Nv ${r.maxLv}`); if (r.shiny) L.push("1 Shiny ou mais"); if (!r.max && !r.maxLv && !r.shiny) L.push("Sem limite"); L.push("Grupos + mata-mata", "16 treinadores"); return L; };
  const prizeTxt = (z) => !z ? "sem prêmio" : [z.dia ? `${z.dia} ◆` : "", z.gold ? `${fmt(z.gold)} Gold` : ""].filter(Boolean).join(" + ");

  // ---------- partidas ----------
  function canFight() { const s = G.state; if (!s) return "Carregando..."; if (s.training) return "Saia do treino e vá para um mapa 4×4.";
    if (!G.map || G.map.size !== 4) return "A Arena é 4×4: vá para um mapa 4×4."; if (G.activePlayers().length < 4) return "Escale 4 jogadores.";
    if (G.gymFight || G.clanFight || G.pvpFight) return "Você já está num desafio."; return ""; }
  function go(f) { G.pvpFight = f; clearTimeout(G.nextT); clearTimeout(G.pmT); close(); G.startMatch(); toast(`${f.name}: a partida começou!`, "good"); }
  function fightTeam() { return G.pvpFight.team.map((p) => { const q = JSON.parse(JSON.stringify(p)); q.uid = "pv" + q.uid; q.temp = true; return q; }); }
  function myTeam() { const f = G.pvpFight, s = G.state, mine = f.mine.map((u) => s.roster.find((p) => p.uid === u)).filter(Boolean), part = f.partner.map((p) => { const q = JSON.parse(JSON.stringify(p)); q.uid = "pm" + q.uid; q.temp = true; return q; });
    const slots = C.LINEUP_POS.map(() => null); mine.forEach((p) => { let k = C.LINEUP_POS.indexOf(p.position); if (k < 0 || slots[k]) k = slots.indexOf(null); slots[k] = p; });
    const left = part.slice(); slots.forEach((x, k) => { if (x) return; let j = left.findIndex((q) => q.position === C.LINEUP_POS[k]); if (j < 0) j = 0; slots[k] = left.splice(j, 1)[0]; });
    return slots.filter(Boolean); }
  function addHist(h) { const p = st(); p.hist.unshift({ t: Date.now(), ...h }); p.hist.length = Math.min(p.hist.length, 40); }
  function fightEnd(r) { const f = G.pvpFight; G.pvpFight = null; const p = st(), s = G.state; let note = "", gold = 0, sc = `${r.score[0]} × ${r.score[1]}`;
    if (f.kind === "rank") { const e = 1 / (1 + Math.pow(10, (f.elo - p.elo) / 400)), d = Math.round(K().k * ((r.win ? 1 : 0) - e)); p.elo = Math.max(100, p.elo + d); r.win ? p.w++ : p.l++;
      gold = r.win ? K().rank.gold : K().rank.goldLose; note = `Ranqueada: ${r.win ? "vitória" : "derrota"} ${sc} contra ${f.foe}. ELO ${d >= 0 ? "+" : ""}${d} (agora ${fmt(p.elo)}).`;
      addHist({ kind: "Ranqueada", foe: f.foe, win: r.win, sc, extra: `${d >= 0 ? "+" : ""}${d} ELO` }); }
    else if (f.kind === "multi") { gold = r.win ? K().multi.gold : K().multi.goldLose; const txt = `${myName()} & ${f.mate} × ${f.foe}`;
      p.multi.unshift({ t: Date.now(), txt, win: r.win ? `${myName()} & ${f.mate}` : f.foe, sc }); p.multi.length = Math.min(p.multi.length, 10);
      note = `Multi 2x2: ${r.win ? "vitória" : "derrota"} ${sc} ao lado de ${f.mate}.`; addHist({ kind: "Multi 2x2", foe: f.foe, win: r.win, sc, extra: `com ${f.mate}` }); }
    else if (f.kind === "cup") { const c = p.cup; if (c && c.id === f.cup) { const m = c.matches.find((x) => x.id === f.mid); if (m && m.win == null) { const mi = m.a === myIdx(c); m.win = r.win === mi ? m.a : m.b; m.sc = mi ? [r.score[0], r.score[1]] : [r.score[1], r.score[0]]; }
        note = `${c.name}: ${r.win ? "vitória" : "derrota"} ${sc} contra ${f.foe}.`; addHist({ kind: c.name, foe: f.foe, win: r.win, sc, extra: stageName(m && m.st) }); finishRound(c); } }
    if (gold) { s.gold += gold; note += ` +${fmt(gold)} Gold.`; }
    const res = { ...r, xp: 0, gold, ev: 0, stolen: null, chance: 0, roll: 0, target: -1, ups: [], note, boss: false, enemy: G.enemy, stage: s.progress.stage, pvp: f.kind };
    G.pushLog(`${f.name}: ${r.win ? "Vitória" : "Derrota"} ${sc}`, r.win ? "goal" : "goal-against"); if (note) G.pushLog(note, r.win ? "steal" : "sys");
    G.save(); G.recEnd(res); G.emit("matchEnd", res); G.emit("resources"); clearTimeout(G.nextT); G.nextT = setTimeout(() => G.startMatch(), 3000); }

  // ---------- Ranqueada ----------
  function ranked() { const why = canFight(); if (why) return toast(why, "bad"); const p = st(), L = npcs().sort((a, b) => Math.abs(a.elo - p.elo) - Math.abs(b.elo - p.elo)), o = L[Math.floor(Math.random() * Math.min(6, L.length))];
    go({ kind: "rank", name: `Ranqueada · ${o.name}`, foe: o.name, elo: o.elo, team: teamFor(o.name, o.elo, null, 4) }); }
  function ranking() { const p = st(), me = { name: myName(), elo: p.elo, w: p.w, l: p.l, me: true, av: (G.activePlayers()[3] || G.activePlayers()[0] || {}).charId };
    return npcs().map((n) => { const r = rng(n.name + "wl"); return { ...n, w: 4 + Math.floor(r() * 80 * (n.elo - 900) / 400), l: Math.floor(r() * 14) }; }).concat([me]).sort((a, b) => b.elo - a.elo); }

  // ---------- Multi 2x2 ----------
  function multi() { const why = canFight(); if (why) return toast(why, "bad"); const s = G.state, mine = ui.pick.map((u) => s.roster.find((p) => p.uid === u)).filter(Boolean);
    if (mine.length !== 2) return toast("Escolha 2 jogadores seus.", "bad"); const p = st(), L = npcs().sort(() => Math.random() - 0.5), mate = L[0], f1 = L[1], f2 = L[2];
    const sl = C.LINEUP_POS.map(() => 0); mine.forEach((q) => { let k = C.LINEUP_POS.indexOf(q.position); if (k < 0 || sl[k]) k = sl.indexOf(0); sl[k] = 1; });
    const partner = teamFor(mate.name, p.elo, null, 2, null, C.LINEUP_POS.filter((_, k) => !sl[k])), foe = teamFor(f1.name, (f1.elo + f2.elo) / 2, null, 4);
    go({ kind: "multi", name: `Multi · ${f1.name} & ${f2.name}`, foe: `${f1.name} & ${f2.name}`, mate: mate.name, mine: mine.map((x) => x.uid), partner, team: foe }); }

  // ---------- Copas ----------
  const todayFmts = () => { const F = K().formats, d = dayN(); return Array.from({ length: K().cupsPerDay }, (_, k) => F[(d * K().cupsPerDay + k) % F.length]); };
  const stageName = (st0) => ({ g0: "Grupos · rodada 1", g1: "Grupos · rodada 2", g2: "Grupos · rodada 3", qf: "Quartas de final", sf: "Semifinal", f: "Final" }[st0] || "");
  const PH = ["g0", "g1", "g2", "qf", "sf", "f"], RR = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
  function join(fid) { const p = st(), f = K().formats.find((x) => x.id === fid), key = dayN() + ":" + fid;
    if (p.cup && p.cup.phase !== "end") return toast("Termine a copa em que você já está.", "bad"); if (p.cups[key]) return toast("Você já jogou esta copa hoje.", "bad");
    const why = checkRules(G.activePlayers(), f.rules); if (why) return toast(why, "bad"); if (G.activePlayers().length < 4) return toast("Escale 4 jogadores.", "bad");
    const L = npcs().sort(() => Math.random() - 0.5).slice(0, 15), pl = [{ name: myName(), elo: p.elo, me: true }].concat(L.map((n) => ({ name: n.name, elo: n.elo, av: n.av }))), ord = pl.map((_, i) => i).sort(() => Math.random() - 0.5);
    const groups = [0, 1, 2, 3].map((g) => ord.slice(g * 4, g * 4 + 4)), matches = []; let id = 0;
    groups.forEach((g, gi) => RR.forEach((pairs, r) => pairs.forEach(([x, y]) => matches.push({ id: id++, st: "g" + r, grp: gi, a: g[x], b: g[y], win: null, sc: null }))));
    p.cup = { id: key + ":" + Date.now(), key, fmt: fid, name: f.name, players: pl, groups, matches, phase: "g0", bets: [], log: [], t: Date.now() }; p.cups[key] = { joined: 1 };
    G.save(); toast(`Inscrito na ${f.name}! A fase de grupos começou.`, "good"); ui.tab = "vivo"; render(); }
  function stand(c, gi) { const T = c.groups[gi].map((i) => ({ i, j: 0, v: 0, d: 0, pts: 0, sd: 0 }));
    c.matches.filter((m) => m.grp === gi && m.win != null).forEach((m) => { const A = T.find((x) => x.i === m.a), B = T.find((x) => x.i === m.b), w = m.win === m.a ? A : B, l = w === A ? B : A; A.j++; B.j++; w.v++; w.pts += 3; l.d++; const g = Math.abs(m.sc[0] - m.sc[1]); w.sd += g; l.sd -= g; });
    return T.sort((x, y) => y.pts - x.pts || y.sd - x.sd || x.i - y.i); }
  function sim(c, m) { const A = c.players[m.a], B = c.players[m.b], pa = 1 / (1 + Math.pow(10, (B.elo - A.elo) / 400)), aw = Math.random() < pa, w = 1 + Math.floor(Math.random() * 4), l = Math.floor(Math.random() * w);
    m.win = aw ? m.a : m.b; m.sc = aw ? [w, l] : [l, w]; }
  const odds = (c, m, side) => { const A = c.players[m.a], B = c.players[m.b], pa = 1 / (1 + Math.pow(10, (B.elo - A.elo) / 400)); return Math.max(1.05, Math.round((1 - K().betCut) / (side === "a" ? pa : 1 - pa) * 100) / 100); };
  const myIdx = (c) => c.players.findIndex((x) => x.me);
  const myMatch = (c) => c.matches.find((m) => m.st === c.phase && m.win == null && (m.a === myIdx(c) || m.b === myIdx(c)));
  function finishRound(c) { const p = st(), s = G.state; if (myMatch(c)) return; c.matches.filter((m) => m.st === c.phase && m.win == null).forEach((m) => sim(c, m));
    c.bets.filter((b) => !b.done).forEach((b) => { const m = c.matches.find((x) => x.id === b.mid); if (!m || m.win == null) return; b.done = 1; const ok = (b.side === "a" ? m.a : m.b) === m.win; if (ok) { b.won = Math.round(b.stake * b.odd); s.gold += b.won; toast(`Aposta certa! +${fmt(b.won)} Gold`, "good"); } else b.won = 0; });
    const i = PH.indexOf(c.phase), nx = PH[i + 1]; let id = c.matches.length;
    if (nx === "qf") { const S = [0, 1, 2, 3].map((g) => stand(c, g)), pr = [[0, 1], [1, 0], [2, 3], [3, 2]]; pr.forEach(([g1, g2]) => c.matches.push({ id: id++, st: "qf", a: S[g1][0].i, b: S[g2][1].i, win: null, sc: null })); }
    else if (nx === "sf" || nx === "f") { const W = c.matches.filter((m) => m.st === c.phase).map((m) => m.win); for (let k = 0; k < W.length; k += 2) c.matches.push({ id: id++, st: nx, a: W[k], b: W[k + 1], win: null, sc: null }); }
    if (!nx) return endCup(c); const me = myIdx(c), alive = c.matches.some((m) => m.st === nx && (m.a === me || m.b === me));
    c.phase = nx; if (nx.startsWith("q") || nx === "sf" || nx === "f") { if (!alive && !c.out) { c.out = PH[i].startsWith("g") ? "Fase de grupos" : stageName(PH[i]); toast(`${c.name}: você caiu. Siga assistindo como espectador.`, "bad"); } } G.save(); }
  function advance() { const c = st().cup; if (!c || c.phase === "end") return; if (myMatch(c)) return toast("Jogue a sua partida primeiro.", "bad"); finishRound(c); render(); }
  function playCup() { const c = st().cup, m = c && myMatch(c); if (!m) return; const why = canFight(); if (why) return toast(why, "bad"); const why2 = checkRules(G.activePlayers(), K().formats.find((f) => f.id === c.fmt).rules); if (why2) return toast(why2, "bad");
    const foe = c.players[m.a === myIdx(c) ? m.b : m.a]; go({ kind: "cup", cup: c.id, mid: m.id, foe: foe.name, name: `${c.name} · ${foe.name}`, team: teamFor(foe.name, foe.elo, K().formats.find((f) => f.id === c.fmt).rules, 4, c.id + foe.name + m.id) }); }
  function endCup(c) { const s = G.state, F = K().formats.find((f) => f.id === c.fmt), fin = c.matches.find((m) => m.st === "f"), me = myIdx(c), champ = fin.win, vice = fin.win === fin.a ? fin.b : fin.a;
    const semis = c.matches.filter((m) => m.st === "sf").map((m) => (m.win === m.a ? m.b : m.a)); let place = me === champ ? 0 : me === vice ? 1 : semis.includes(me) ? 2 : -1;
    const z = place >= 0 ? F.prize[place] : null; if (z) { s.gold += z.gold || 0; s.diamonds = (s.diamonds || 0) + (z.dia || 0); }
    c.phase = "end"; c.champ = c.players[champ].name; c.vice = c.players[vice].name; c.place = place; c.end = Date.now(); st().cups[c.key] = { champ: c.champ, vice: c.vice, place, n: c.players.length };
    G.save(); G.emit("resources"); toast(place === 0 ? `CAMPEÃO da ${c.name}! ${prizeTxt(z)}` : `${c.name} acabou: ${c.champ} é o campeão.${z ? ` Seu prêmio: ${prizeTxt(z)}.` : ""}`, place === 0 ? "good" : ""); }
  function bet(mid, side, stake) { const c = st().cup, s = G.state, m = c && c.matches.find((x) => x.id === +mid); if (!m || m.win != null) return; if (c.bets.some((b) => b.mid === m.id)) return toast("Você já apostou nessa luta.", "bad");
    if (s.gold < stake) return toast("Gold insuficiente.", "bad"); s.gold -= stake; c.bets.push({ mid: m.id, side, stake, odd: odds(c, m, side) }); G.save(); G.emit("resources"); toast(`Aposta de ${fmt(stake)} Gold em ${c.players[side === "a" ? m.a : m.b].name}.`, "good"); render(); }

  // ---------- tela ----------
  const NAV = [["vivo", "📡", "Ao vivo"], ["torneios", "🏆", "Torneios"], ["chave", "🗂️", "Chave"], ["rank", "🎖️", "Ranqueada"], ["multi", "⚔️", "Multi 2x2"], ["hist", "📜", "Histórico"], ["fmt", "🃏", "Formatos"]];
  const pname = (c, i) => (c.players[i] ? `${esc(c.players[i].name)}${c.players[i].me ? " <em>(você)</em>" : ""}` : "?");
  function vivo(p) { const c = p.cup, F = c && K().formats.find((f) => f.id === c.fmt);
    if (!c) return `<section class="pv-card pv-hero"><div><small class="pv-k">Arena PvP</small><h2>Nenhuma copa em andamento</h2><p>Escolha uma das copas do dia na aba Torneios ou jogue a Ranqueada.</p><div class="pv-row"><button type="button" class="pv-b go" data-pv-tab="torneios">Ver copas do dia</button><button type="button" class="pv-b" data-pv-tab="rank">Ranqueada</button></div></div><span class="pv-cup">🏆</span></section>`;
    const m = myMatch(c), me = myIdx(c), done = c.matches.filter((x) => x.win != null).slice(-10).reverse(), open = c.phase !== "end" ? c.matches.filter((x) => x.st === c.phase && x.win == null && x.a !== me && x.b !== me) : [];
    const sit = c.phase === "end" ? (c.place === 0 ? `<b>Você é o campeão!</b><small>Prêmio: ${prizeTxt(F.prize[0])}</small>` : c.place > 0 ? `<b>${c.place === 1 ? "Vice-campeão" : "Semifinalista"}</b><small>Prêmio: ${prizeTxt(F.prize[c.place])}</small>` : `<b>Copa encerrada</b><small>Você caiu: ${esc(c.out || "fase de grupos")}.</small>`)
      : m ? `<b>É a sua vez: ${stageName(c.phase)}</b><small>Contra ${pname(c, m.a === me ? m.b : m.a)}</small><button type="button" class="pv-b gold big" data-pv-play>Entrar na partida</button>`
      : c.out ? `<b>Você está na plateia</b><small>Caiu em: ${esc(c.out)}. Assista e aposte nas próximas lutas.</small><button type="button" class="pv-b" data-pv-adv>Ver próxima rodada</button>`
      : `<b>Aguardando a rodada</b><small>Sua partida desta rodada já foi. Avance para ver os outros resultados.</small><button type="button" class="pv-b" data-pv-adv>Ver resultados da rodada</button>`;
    return `<section class="pv-card pv-hero"><div><span class="pv-tag ${c.phase === "end" ? "end" : "live"}">${c.phase === "end" ? "Encerrada" : "Ao vivo · " + stageName(c.phase)}</span><h2>${esc(c.name)}</h2>
        ${c.phase === "end" ? `<p class="pv-champ">🏆 <b>${esc(c.champ)}</b> é o campeão! <small>Vice: ${esc(c.vice)}</small></p>` : `<p>${esc(F.desc)}</p>`}<div class="pv-row"><button type="button" class="pv-b" data-pv-tab="chave">Ver a chave completa</button></div></div>
        <span class="pv-prize">Prêmio: ${prizeTxt(F.prize[0])}</span><span class="pv-cup">🏆</span></section>
      <div class="pv-two"><section class="pv-card"><h3>🎫 Sua situação</h3><div class="pv-sit">${sit}</div>
        ${open.length ? `<h3 class="pv-mt">🎲 Apostas da rodada</h3><small class="pv-mute">Aposte Gold em quem vence. Paga conforme a chance (5% fica com a casa).</small>${open.map((x) => { const b = c.bets.find((y) => y.mid === x.id); return `<div class="pv-bet"><div><b>${pname(c, x.a)}</b> <small>×${odds(c, x, "a")}</small> <span>vs</span> <b>${pname(c, x.b)}</b> <small>×${odds(c, x, "b")}</small></div>${b ? `<em>Apostou ${fmt(b.stake)} em ${esc(c.players[b.side === "a" ? x.a : x.b].name)}</em>` : `<div class="pv-row">${["a", "b"].map((sd) => K().betStakes.map((v) => `<button type="button" class="pv-b sm" data-pv-bet="${x.id}|${sd}|${v}">${fmt(v)} em ${esc(c.players[sd === "a" ? x.a : x.b].name)}</button>`).join("")).join("")}</div>`}</div>`; }).join("")}` : ""}</section>
      <section class="pv-card"><h3>🏅 Últimos resultados</h3>${done.length ? done.map((x) => `<div class="pv-li"><span class="pv-ic">${x.a === me || x.b === me ? "⭐" : "⚽"}</span><div><b>${pname(c, x.win)} venceu ${pname(c, x.win === x.a ? x.b : x.a)}</b><small>${stageName(x.st)}${x.grp != null ? ` · Grupo ${"ABCD"[x.grp]}` : ""}</small></div><span class="pv-sc">${x.sc[0]} × ${x.sc[1]}</span></div>`).join("") : `<p class="pv-mute">Nenhuma luta terminou ainda.</p>`}</section></div>`; }
  function torneios(p) { const T = todayFmts(), last = Object.entries(p.cups).filter(([k, v]) => v.champ).slice(-6).reverse();
    return `<section class="pv-card pv-hero"><div><small class="pv-k">Circuito Blue Lock</small><h2>Da fase de grupos à glória</h2><div class="pv-row"><span class="pv-chip">📡 <b>${p.cup && p.cup.phase !== "end" ? 1 : 0}</b> em disputa</span><span class="pv-chip">🎫 <b>${T.filter((f) => !p.cups[dayN() + ":" + f.id]).length}</b> com inscrição aberta</span><span class="pv-chip">🏅 <b>${last.length}</b> encerradas</span></div></div><span class="pv-cup">🏆</span></section>
      <h4 class="pv-sec">Copas de hoje <small>· trocam todo dia à meia-noite</small></h4><div class="pv-grid">${T.map((f) => { const k = dayN() + ":" + f.id, d = p.cups[k], cur = p.cup && p.cup.key === k && p.cup.phase !== "end";
        return `<div class="pv-tc" style="--c:${f.color}"><span class="pv-tag ${d && d.champ ? "end" : cur ? "live" : "open"}">${d && d.champ ? "Encerrada" : cur ? "Em disputa" : "Inscrição aberta"}</span><h3>${esc(f.name)}</h3><p>${esc(f.desc)}</p>
          <div class="pv-st"><span><small>Inscritos</small><b>16</b></span><span><small>Campeão</small><b>${d && d.champ ? esc(d.champ) : "—"}</b></span><span><small>Prêmio</small><b>${f.prize[0].dia ? f.prize[0].dia + " ◆" : fmt(f.prize[0].gold)}</b></span></div>
          <div class="pv-chips">${ruleChips(f).map((x) => `<span>${esc(x)}</span>`).join("")}</div><div class="pv-chips gold">${["1º", "2º", "Semi"].map((t, i) => `<span>${t}: ${prizeTxt(f.prize[i])}</span>`).join("")}</div>
          ${d ? `<button type="button" class="pv-b" data-pv-tab="${cur ? "vivo" : "chave"}">${cur ? "Ir para a copa" : "Ver chave"}</button>` : `<button type="button" class="pv-b go" data-pv-join="${f.id}">Inscrever meu time</button>`}</div>`; }).join("")}</div>`; }
  function chave(p) { const c = p.cup; if (!c) return `<section class="pv-card"><p class="pv-mute">A chave aparece quando você entra numa copa.</p></section>`; const me = myIdx(c);
    const box = (m) => !m ? `<div class="pv-km empty"><span>—</span><span>—</span></div>` : `<div class="pv-km">${[m.a, m.b].map((i, k) => `<span class="${m.win === i ? "w" : m.win != null ? "l" : ""} ${i === me ? "me" : ""}">${pname(c, i)}<b>${m.sc ? m.sc[k] : ""}</b></span>`).join("")}</div>`;
    const col = (s, n, t) => { const L = c.matches.filter((m) => m.st === s); return `<div class="pv-kc"><small>${t}</small>${Array.from({ length: n }, (_, i) => box(L[i])).join("")}</div>`; };
    return `${c.phase === "end" ? `<section class="pv-card pv-win"><span class="pv-cup sm">🏆</span><div><span class="pv-tag end">Campeão</span><h3>${esc(c.champ)}</h3><small>Vice: ${esc(c.vice)}</small></div></section>` : ""}
      <section class="pv-card"><div class="pv-hh"><h3>🏆 Fase de grupos</h3><small>4 grupos · 2 avançam</small></div><div class="pv-grps">${c.groups.map((g, gi) => `<div><b>Grupo ${"ABCD"[gi]}</b><table class="pv-tb"><tr><th>#</th><th>Treinador</th><th>J</th><th>V</th><th>D</th><th>SG</th><th>PTS</th></tr>${stand(c, gi).map((x, k) => `<tr class="${k < 2 ? "up" : ""} ${x.i === me ? "me" : ""}"><td>${k + 1}</td><td>${pname(c, x.i)}</td><td>${x.j}</td><td>${x.v}</td><td>${x.d}</td><td>${x.sd}</td><td><b>${x.pts}</b></td></tr>`).join("")}</table></div>`).join("")}</div></section>
      <section class="pv-card"><h3>🗂️ Mata-mata</h3><div class="pv-ko">${col("qf", 4, "Quartas de final")}${col("sf", 2, "Semifinal")}${col("f", 1, "Final")}</div></section>`; }
  function rank(p) { const R = ranking(), pos = R.findIndex((x) => x.me) + 1, pct = Math.max(4, Math.min(100, Math.round((p.elo - 800) / 6)));
    return `<section class="pv-card pv-elo"><div class="pv-ring" style="--p:${pct}"><b>${fmt(p.elo)}</b><small>ELO</small></div><div><h3>Pronto para batalhar</h3><small>${p.w}V ${p.l}D · ${pos}º no ranking. Vitória +${fmt(K().rank.gold)} Gold, derrota +${fmt(K().rank.goldLose)}.</small></div><button type="button" class="pv-b go big" data-pv-rank>⚔️ Buscar adversário</button></section>
      <section class="pv-card"><h3>🎖️ Ranking</h3>${R.slice(0, 10).concat(pos > 10 ? [R[pos - 1]] : []).map((x) => `<div class="pv-li ${x.me ? "me" : ""}"><span class="pv-pos">${R.indexOf(x) + 1}</span><span class="pv-av">${spr(x.av)}</span><div><b>${esc(x.name)}${x.me ? " <em>(você)</em>" : ""}</b><small>${x.w}V ${x.l}D</small></div><span class="pv-sc">${fmt(x.elo)} ELO</span></div>`).join("")}</section>`; }
  function multiTab(p) { const s = G.state, L = s.roster.slice().sort((a, b) => b.level - a.level).slice(0, 24);
    return `<section class="pv-card"><h3>⚔️ Multi 2x2</h3><small class="pv-mute">Você leva 2 jogadores e um treinador da fila completa a dupla com mais 2. Do outro lado, outra dupla. A luta é 4×4 na tela de partida do jogo.</small>
      <div class="pv-pick"><small class="pv-k">Seus 2 jogadores (${ui.pick.length}/2)</small><div class="pv-pl">${L.map((q) => `<button type="button" class="pv-pp ${ui.pick.includes(q.uid) ? "on" : ""}" data-pv-pick="${q.uid}"><span class="pv-av">${spr(q.charId)}</span><span><b>${esc(q.name)}</b><small>${posShort(q.position)} · Nv ${q.level} · ${rName(q.rarity)}</small></span></button>`).join("")}</div></div>
      <button type="button" class="pv-b go big" data-pv-multi ${ui.pick.length === 2 ? "" : "disabled"}>⚔️ Procurar dupla e luta</button></section>
      <section class="pv-card"><h3>📜 Últimas batalhas Multi</h3>${p.multi.length ? p.multi.map((x) => `<div class="pv-li"><span class="pv-ic">⚔️</span><div><b>${esc(x.txt)}</b><small>Venceu: ${esc(x.win)} · ${x.sc}</small></div><span class="pv-sc">${when(x.t)}</span></div>`).join("") : `<p class="pv-mute">Nenhuma ainda.</p>`}</section>`; }
  function hist(p) { return `<section class="pv-card"><h3>📜 Seu histórico</h3>${p.hist.length ? p.hist.map((x) => `<div class="pv-li"><span class="pv-res ${x.win ? "w" : "l"}">${x.win ? "V" : "D"}</span><div><b>${esc(x.kind)} · contra ${esc(x.foe)}</b><small>${esc(x.extra || "")}</small></div><span class="pv-sc">${x.sc}<small>${when(x.t)}</small></span></div>`).join("") : `<p class="pv-mute">Suas partidas de Arena aparecem aqui.</p>`}</section>`; }
  function fmts() { const q = ui.q.toLowerCase(), L = K().formats.filter((f) => !q || (f.name + " " + f.desc + " " + ruleChips(f).join(" ")).toLowerCase().includes(q));
    return `<section class="pv-card"><div class="pv-hh"><h3>🃏 Formatos de copa</h3><small>${K().formats.length} formatos · 3 por dia</small></div><input type="search" id="pvQ" placeholder="Buscar formato ou regra" value="${esc(ui.q)}"></section>
      <div class="pv-grid">${L.map((f) => `<div class="pv-tc sm" style="--c:${f.color}"><h3>${esc(f.name)}</h3><p>${esc(f.desc)}</p><div class="pv-chips">${ruleChips(f).map((x) => `<span>${esc(x)}</span>`).join("")}</div><div class="pv-chips gold"><span>1º: ${prizeTxt(f.prize[0])}</span></div></div>`).join("")}</div>`; }
  const HOW = [["📡", "Grupos e mata-mata", "16 treinadores em 4 grupos de 4. Vitória vale 3 pontos; os 2 primeiros de cada grupo vão para as quartas, depois semifinal e final."],
    ["🎫", "A sua vez", "Quando chega a sua luta, aparece \"Entrar na partida\" em Ao vivo. A partida é 4×4 de verdade, com o seu time escalado, num mapa 4×4."],
    ["🛡️", "Sua equipe", "Cada copa tem regras (raridade máxima, nível máximo, Shiny). O time precisa seguir a regra na inscrição e em cada luta."],
    ["🎲", "Apostas", "Aposte Gold em quem vence as outras lutas da rodada. Paga conforme a chance de cada lado, e 5% fica com a casa."],
    ["🎖️", "Ranqueada", "Fila separada das copas: vale ELO e aparece no ranking."], ["⚔️", "Multi 2x2", "Você leva 2 jogadores e a dupla completa com mais 2."],
    ["🌐", "Por enquanto", "Sem servidor ainda, os outros treinadores são da IA. Quando o jogo ficar online, as mesmas telas passam a ser contra pessoas."]];
  function render() { const ov = $("pvOv"); if (!ov || ov.hidden) return; const p = st(); if (!p) return; const s = G.state, sc = ov.querySelector(".pv-main") ? ov.querySelector(".pv-main").scrollTop : 0, live = p.cup && p.cup.phase !== "end" && myMatch(p.cup);
    const body = { vivo, torneios, chave, rank, multi: multiTab, hist, fmt: fmts }[ui.tab](p);
    ov.innerHTML = `<div class="pv-box" role="dialog" aria-label="Arena PvP"><header class="pv-top"><span class="pv-logo">🏆</span><div class="pv-tt"><small>Competição</small><h2>Arena PvP<i class="beta-tag">Beta · em teste</i></h2><p>Copas do dia, fila ranqueada e o seu histórico de batalhas.</p></div>
      <span class="pv-dia">◆ ${fmt(s.diamonds || 0)}</span><button type="button" class="pv-b" data-pv-how>Como funciona</button><button type="button" class="pv-x" data-pv-close aria-label="Fechar">✕</button></header>
      <div class="pv-wrap"><nav class="pv-nav">${NAV.map(([id, ic, t]) => `<button type="button" class="${ui.tab === id ? "on" : ""}" data-pv-tab="${id}"><span>${ic}</span><b>${t}</b>${id === "vivo" && live ? "<i></i>" : ""}</button>`).join("")}</nav><main class="pv-main">${body}</main></div>
      ${ui.how ? `<div class="pv-how"><div class="pv-hb"><div class="pv-hh"><h3>Como funciona a Arena</h3><button type="button" class="pv-x" data-pv-how aria-label="Fechar">✕</button></div>${HOW.map(([i, t, d]) => `<div class="pv-hi"><span>${i}</span><div><b>${t}</b><small>${d}</small></div></div>`).join("")}<button type="button" class="pv-b go" data-pv-how>Entendi</button></div></div>` : ""}</div>`;
    const m = ov.querySelector(".pv-main"); if (m) m.scrollTop = sc; const q = $("pvQ"); if (q && ui.qf) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  function open(tab) { if (!G.state) return; let ov = $("pvOv"); if (!ov) { ov = document.createElement("div"); ov.id = "pvOv"; ov.className = "pv-ov"; document.body.appendChild(ov); bind(ov); }
    const p = st(); if (tab) ui.tab = tab; else if (!p.cup || p.cup.phase === "end") ui.tab = ui.tab || "vivo"; ov.hidden = false; render(); }
  function close() { const ov = $("pvOv"); if (ov) ov.hidden = true; }
  function bind(ov) {
    ov.addEventListener("click", (e) => { if (e.target === ov) return close(); const t = e.target.closest("button"); if (!t || t.disabled) return; const d = t.dataset;
      if ("pvClose" in d) close(); else if ("pvHow" in d) { ui.how = !ui.how; render(); } else if (d.pvTab) { ui.tab = d.pvTab; render(); ov.querySelector(".pv-main").scrollTop = 0; }
      else if (d.pvJoin) join(d.pvJoin); else if ("pvPlay" in d) playCup(); else if ("pvAdv" in d) advance(); else if ("pvRank" in d) ranked(); else if ("pvMulti" in d) multi();
      else if (d.pvBet) { const [mid, sd, v] = d.pvBet.split("|"); bet(mid, sd, +v); }
      else if (d.pvPick) { const u = d.pvPick; ui.pick = ui.pick.includes(u) ? ui.pick.filter((x) => x !== u) : ui.pick.concat(u).slice(-2); render(); } });
    ov.addEventListener("input", (e) => { if (e.target.id === "pvQ") { ui.q = e.target.value; ui.qf = 1; render(); ui.qf = 0; } });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !ov.hidden) { if (ui.how) { ui.how = false; render(); } else close(); } }); }
  document.addEventListener("click", (e) => { const t = e.target.closest("[data-pvp-open]"); if (!t) return; e.preventDefault(); e.stopPropagation(); open(t.dataset.pvpOpen || undefined); }, true);
  BL.PvP = { open, close, fightTeam, fightEnd, myTeam, join, ranked, multi, advance, ranking, state: st, todayFmts, stand };
})();
