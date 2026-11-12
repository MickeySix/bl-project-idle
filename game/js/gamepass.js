// BL PROJECT IDLE · v628 (Mickey, refs "Game Pass") · passe de temporada com trilha Gratuita e Premium (200 níveis), missões diárias e auras exclusivas.
// Dados por conta em G.state.gp (temporada atual) e G.state.gpAuras (auras ganhas, ficam para sempre: id → uid do jogador que usa, "" = guardada).
// Números em C.GAMEPASS. Temporada = mês do calendário no horário de Brasília. Tela própria (#gpOv), estilo em css/gamepass.css.
window.BL = window.BL || {};
(function () {
  const C = BL.CONFIG, G = BL.Game, P = () => C.GAMEPASS, HOUR = 36e5, BRT = 3 * HOUR;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => Math.round(n || 0).toLocaleString("pt-BR");
  const toast = (t, c) => BL.UI && BL.UI.toast(t, c);
  const ui = { page: -1 };

  // ---------- temporada ----------
  function season(t) { const d = new Date((t || Date.now()) - BRT), y = d.getUTCFullYear(), mo = d.getUTCMonth(), S = P().start;
    const n = Math.max(1, (y - S[0]) * 12 + (mo - S[1]) + 1), a = Date.UTC(y, mo, 1) + BRT, b = Date.UTC(y, mo + 1, 1) + BRT;
    return { n, name: P().names[(n - 1) % P().names.length], start: a, end: b - 60000 }; }
  const cum = (l) => P().need[0] * l + P().need[1] * l * (l - 1) / 2; // XP total para chegar ao nível l
  function lvlOf(xp) { let l = 0; while (l < P().levels && cum(l + 1) <= xp) l++; return l; }
  function st() { const s = G.state; if (!s) return null; const se = season();
    if (!s.gp || s.gp.season !== se.n) s.gp = { season: se.n, xp: 0, prem: false, got: { f: {}, p: {} }, daily: null };
    const d = G.dayKey(); if (!s.gp.daily || s.gp.daily.day !== d) s.gp.daily = { day: d, win: 0, goal: 0, steal: 0, done: {} };
    s.gpAuras = s.gpAuras || {}; return s.gp; }

  // ---------- prêmios ----------
  function rewards(l, t) { const S = P().special[t === "f" ? "free" : "prem"]; if (S[l]) return S[l];
    const r = (t === "f" ? P().free : P().prem)[l % 10], k = P().grow ? 1 + (l - 1) / P().grow : 1 + 0.5 * Math.floor((l - 1) / 50); // v706: cresce aos poucos
    if (r.k === "chest") { const up = ["padrao", "azul", "epico", "lendario"], i = up.indexOf(r.id); return [P().chestUp && l >= P().chestUp && i >= 0 && i < 3 ? { ...r, id: up[i + 1] } : r]; } // v706: baú sobe um degrau na 2ª metade
    return [{ ...r, n: Math.round(r.n * k) }]; }
  const itemDef = (k) => (C.SUPPLIES && C.SUPPLIES[k]) || (C.CONSUMABLES && C.CONSUMABLES[k]) || null;
  const IMG = ["agua", "isotonico", "gatorade", "suco", "coco", "vitamina", "pr-basica", "pr-forte", "pr-elite", "pr-bluelock"];
  const CH_C = { padrao: "#9fb2d8", azul: "#3f9bff", epico: "#b06bff", lendario: "#ffd23f" };
  function rwName(r) { if (r.k === "gold") return `${fmt(r.n)} Gold`; if (r.k === "dia") return `${fmt(r.n)} Diamantes`;
    if (r.k === "chest") return `${r.n}× ${(C.CHEST_KINDS[r.id] || {}).name || "Baú"}`; if (r.k === "aura") return `${P().auras[r.id].name} (exclusiva)`;
    const d = itemDef(r.k); return `${r.n}× ${d ? d.name : r.k}`; }
  function rwIcon(r) { if (r.k === "gold") return `<i class="ic-coin"></i>`; if (r.k === "dia") return `<b class="gp-gem">◆</b>`;
    if (r.k === "chest") return `<span class="gp-chest" style="--c:${CH_C[r.id] || "#9fb2d8"}">🎁</span>`;
    if (r.k === "aura") return `<span class="gp-aura" style="--c:${P().auras[r.id].color}"></span>`;
    if (IMG.includes(r.k)) return `<img src="img/loja/${r.k}.png?v=${BL.BUILD}" alt="">`; const d = itemDef(r.k); return `<span>${d ? d.icon : "🎁"}</span>`; }
  function give(L) { const s = G.state, cons = G.cons();
    L.forEach((r) => { if (r.k === "gold") s.gold += r.n; else if (r.k === "dia") s.diamonds = (s.diamonds || 0) + r.n;
      else if (r.k === "chest") for (let i = 0; i < r.n; i++) G.addChest(r.id);
      else if (r.k === "aura") { if (!(r.id in s.gpAuras)) s.gpAuras[r.id] = ""; }
      else cons[r.k] = (cons[r.k] || 0) + r.n; }); }
  const can = (g, l, t) => l <= lvlOf(g.xp) && !g.got[t][l] && (t === "f" || g.prem);
  function avail(g) { const L = lvlOf(g.xp); let n = 0; for (let l = 1; l <= L; l++) { if (!g.got.f[l]) n++; if (g.prem && !g.got.p[l]) n++; } return n; }
  function claim(l, t) { const g = st(); if (!g || !can(g, l, t)) return false; g.got[t][l] = 1; give(rewards(l, t)); return true; }
  function claimOne(l, t) { if (!claim(l, t)) return; done(`Nível ${l}: ${rewards(l, t).map(rwName).join(" + ")}`); }
  function claimAll() { const g = st(); if (!g) return; const L = lvlOf(g.xp); let n = 0;
    for (let l = 1; l <= L; l++) ["f", "p"].forEach((t) => { if (claim(l, t)) n++; }); if (n) done(`${n} recompensa(s) resgatada(s).`); }
  function done(msg) { G.save(); G.emit("resources"); toast(msg, "good"); badge(); render(); }

  // ---------- XP ----------
  function addXp(n) { const g = st(); if (!g || !n) return; const a = lvlOf(g.xp); g.xp += n; const b = lvlOf(g.xp);
    if (b > a) toast(`Game Pass: nível ${b} liberado!`, "good"); badge(); }
  function dailyProg(g, k, v) { const d = g.daily; d[k] += v; P().daily.forEach((m) => { if (m.id === k && !d.done[k] && d[k] >= m.n) { d.done[k] = 1; addXp(m.xp); toast(`Missão do Game Pass concluída: ${m.name} (+${fmt(m.xp)} XP)`, "good"); } }); }
  G.on("matchEnd", (res) => { if (!res || !G.state || G.state.training) return; const g = st(), X = P().xp, gl = (res.score && res.score[0]) || 0;
    let xp = X.match + (res.win ? X.win : 0) + Math.min(X.goalMax, gl) * X.goal + (res.stolen ? X.steal : 0) + (res.boss && res.win ? X.boss : 0) + (res.gym && res.win ? X.gym : 0) + (res.clan && res.win ? X.clan : 0);
    addXp(xp); if (res.win) dailyProg(g, "win", 1); if (gl) dailyProg(g, "goal", gl); if (res.stolen) dailyProg(g, "steal", 1); G.save();
    const ov = $("gpOv"); if (ov && !ov.hidden) render(); });

  // ---------- ações ----------
  function buyPrem() { const g = st(), s = G.state; if (g.prem) return; if ((s.diamonds || 0) < P().price) return toast(`Faltam ${fmt(P().price - (s.diamonds || 0))} Diamantes.`, "bad");
    s.diamonds -= P().price; g.prem = true; done("Trilha Premium ativada nesta temporada!"); }
  function skip(n) { const g = st(), s = G.state, l = lvlOf(g.xp); n = Math.min(n, P().levels - l); if (n <= 0) return; const v = n * P().skip;
    if ((s.diamonds || 0) < v) return toast(`Faltam ${fmt(v - (s.diamonds || 0))} Diamantes.`, "bad");
    s.diamonds -= v; g.xp += cum(l + n) - cum(l); ui.page = -1; done(`Game Pass: +${n} nível(is), agora no nível ${lvlOf(g.xp)}.`); }
  function syncAuras() { const s = G.state; if (!s) return; const A = P().auras, own = s.gpAuras || {}; // jogador vendido ou comprado não leva a aura junto
    s.roster.forEach((p) => { const k = Object.keys(own).find((q) => own[q] && own[q] === p.uid); if (k) p.gpAura = A[k].color; else delete p.gpAura; }); }
  function setAura(id, uid) { const s = G.state; if (!(id in (s.gpAuras || {}))) return;
    Object.keys(s.gpAuras).forEach((k) => { if (uid && s.gpAuras[k] === uid) s.gpAuras[k] = ""; }); s.gpAuras[id] = uid || ""; syncAuras();
    const p = uid && s.roster.find((x) => x.uid === uid); G.save(); toast(p ? `${P().auras[id].name} agora no ${p.name}.` : `${P().auras[id].name} guardada.`, "good"); render(); }
  G.on("matchStart", () => syncAuras());

  // ---------- tela ----------
  function left(ms) { const h = Math.max(0, Math.floor(ms / HOUR)); return `${Math.floor(h / 24)}d ${h % 24}h`; }
  const date = (t) => new Date(t).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const card = (id) => (C.SPRITES[id] ? `<img class="spr" src="${C.SPRITES[id].card}" alt="">` : "");
  function cell(g, l, t, L) { const R = rewards(l, t), sp = R.length > 1 || R.some((r) => r.k === "aura"), got = g.got[t][l];
    const btn = got ? `<button type="button" class="gp-b ok" disabled>✓ Resgatado</button>` : l > L ? `<button type="button" class="gp-b" disabled>Nível bloqueado</button>`
      : t === "p" && !g.prem ? `<button type="button" class="gp-b" data-gp-prem>Ativar Premium</button>` : `<button type="button" class="gp-b go" data-gp-claim="${l}" data-t="${t}">Resgatar</button>`;
    return `<div class="gp-rw ${t === "p" ? "pr" : ""} ${sp ? "sp" : ""} ${l > L || (t === "p" && !g.prem) ? "off" : ""} ${got ? "got" : ""}"><span class="gp-ri">${rwIcon(R[0])}</span><span class="gp-rt"><small>Recompensa ${t === "f" ? "gratuita" : "premium"}</small><b>${R.map((r) => esc(rwName(r))).join(" + ")}</b></span>${btn}</div>`; }
  function render() { const ov = $("gpOv"); if (!ov || ov.hidden) return; const g = st(); if (!g) return; const s = G.state, se = season(), L = lvlOf(g.xp), N = P().levels;
    const pages = Math.ceil(N / 10); if (ui.page < 0) ui.page = Math.min(pages - 1, Math.floor(Math.max(0, L - 1) / 10)); const pg = ui.page, a = pg * 10 + 1, b = Math.min(N, a + 9);
    const next = L < N ? cum(L + 1) : cum(N), prev = cum(L), pct = L >= N ? 100 : Math.round((g.xp - prev) / (next - prev) * 100), av = avail(g), d = g.daily, A = P().auras;
    const sc = ov.querySelector(".gp-body") ? ov.querySelector(".gp-body").scrollTop : 0;
    const pager = `<div class="gp-pager"><button type="button" class="gp-b" data-gp-pg="-1" ${pg ? "" : "disabled"}>← Anteriores</button><span>Níveis ${a}–${b} de ${N}</span><button type="button" class="gp-b" data-gp-pg="1" ${pg < pages - 1 ? "" : "disabled"}>Próximos →</button></div>`;
    let rows = ""; for (let l = a; l <= b; l++) rows += `<div class="gp-row ${l <= L ? "on" : ""} ${l === 100 || l === 200 ? "big" : ""}"><div class="gp-lv"><b>${l}</b><small>${fmt(cum(l))} XP</small></div>${cell(g, l, "f", L)}${cell(g, l, "p", L)}</div>`;
    ov.innerHTML = `<div class="gp-box" role="dialog" aria-label="Game Pass">
      <header class="gp-top"><img class="gp-logo" src="img/loja/gamepass.jpg?v=${BL.BUILD}" alt=""><div class="gp-tt"><small>Temporada de recompensas</small><h2>Game Pass</h2></div>
        <span class="gp-badge ${g.prem ? "on" : ""}"><i></i>Trilha Premium <b>${g.prem ? "Ativa" : "Inativa"}</b></span><button type="button" class="gp-x" data-gp-close aria-label="Fechar">✕</button></header>
      <div class="gp-body">
        <section class="gp-hero"><div class="gp-hi"><small class="gp-k">Temporada ${se.n} · Blue Lock</small><h1>${esc(se.name)}</h1>
          <p>${date(se.start)} até ${date(se.end)} (Brasília)</p><p class="gp-end">Termina em ${left(se.end - Date.now())}</p>
          <div class="gp-chips"><span><b>${N}</b> níveis</span><span><b>2</b> trilhas</span></div></div>
          <div class="gp-art">${card("rin-itoshi")}${card("yoichi-isagi")}${card("seishiro-nagi")}</div><span class="gp-live">Temporada ativa</span></section>
        <section class="gp-xp"><div class="gp-xh"><b>${fmt(g.xp)} XP de temporada</b><b>Nível ${L} de ${N}</b></div><div class="gp-bar"><i style="width:${pct}%"></i></div>
          <div class="gp-xh"><small class="gp-cy">${L >= N ? "Nível máximo!" : `Próximo nível: ${fmt(next)} XP`}</small><small>Jogue partidas e complete as missões diárias para ganhar XP.</small></div></section>
        ${g.prem ? "" : `<section class="gp-card gp-up"><img class="gp-tk" src="img/loja/gamepass.jpg?v=${BL.BUILD}" alt=""><div class="gp-ut"><b>Duplique sua jornada com a trilha Premium</b><small>Ative o Game Pass com Diamantes para resgatar também os prêmios premium dos níveis já liberados.</small></div>
          <button type="button" class="gp-b go big" data-gp-prem>Ativar Premium · ◆ ${fmt(P().price)}</button></section>`}
        <section class="gp-card"><small class="gp-k gold">Exclusivos da trilha Premium · não vendidos na loja</small><div class="gp-ex">${Object.entries(A).map(([id, x]) => `<div class="gp-exi"><span class="gp-aura" style="--c:${x.color}"></span><span><b>${esc(x.name)}</b><small>Aura · nível ${x.lv} Premium</small></span>${id in (s.gpAuras || {}) ? `<select data-gp-aura="${id}" aria-label="Quem usa a ${esc(x.name)}"><option value="">Guardada</option>${s.roster.map((p) => `<option value="${p.uid}" ${s.gpAuras[id] === p.uid ? "selected" : ""}>${esc(p.name)} · Nv ${p.level}</option>`).join("")}</select>` : `<em>🔒 Bloqueada</em>`}</div>`).join("")}</div>
          <small class="gp-note">Aura é só visual: o jogador escolhido entra em campo com o brilho, nada muda na partida.</small></section>
        <section class="gp-card"><b>Avançar níveis com Diamantes</b><small>${P().skip} ◆ por nível · faltam ${N - L} até o nível ${N}. O progresso dentro do nível atual é mantido. Você tem ◆ ${fmt(s.diamonds || 0)}.</small>
          <div class="gp-skip">${[1, 5, 10].map((n) => `<button type="button" class="gp-b" data-gp-skip="${n}" ${L >= N ? "disabled" : ""}>+${n} nível${n > 1 ? "s" : ""} · ◆ ${n * P().skip}</button>`).join("")}</div></section>
        <section class="gp-card"><div class="gp-mh"><div><h3>Missões diárias</h3><small>Completou, o XP entra sozinho. Reiniciam todo dia à meia-noite.</small></div><span class="gp-badge">Hoje</span></div>
          <div class="gp-mis">${P().daily.map((m) => { const v = Math.min(m.n, d[m.id] || 0), ok = d.done[m.id]; return `<div class="gp-m ${ok ? "ok" : ""}"><span class="gp-mi">${m.icon}</span><div><b>${esc(m.name)}</b><small>${esc(m.text)}</small><div class="gp-bar gp-sm"><i style="width:${Math.round(v / m.n * 100)}%"></i></div><small class="gp-mx">${ok ? "✓ Concluída" : `${v}/${m.n}`} · +${fmt(m.xp)} XP</small></div></div>`; }).join("")}</div></section>
        <section class="gp-card gp-tab"><div class="gp-th"><div><b>Recompensas dos níveis 1–${N}</b><small>${av} disponível(is) nas trilhas liberadas.</small></div><button type="button" class="gp-b go big" data-gp-all ${av ? "" : "disabled"}>Resgatar tudo (${av})</button></div>
          <div class="gp-row gp-hd"><div class="gp-lv"><small>Progresso</small><b>Nível</b></div><div><small>Para todos</small><b>Trilha Gratuita</b></div><div class="pr"><small>Game Pass ativo</small><b>Trilha Premium</b></div></div>
          ${pager}${rows}${pager}<small class="gp-note c">Mostrando 10 dos ${N} níveis por vez. Cada recompensa é entregue uma única vez por temporada.</small></section>
      </div></div>`;
    const bd = ov.querySelector(".gp-body"); if (bd) bd.scrollTop = sc; }
  function badge() { const g = st(); const n = g ? avail(g) : 0; document.querySelectorAll("[data-gp-open] .mi").forEach((el) => { let b = el.querySelector(".gp-dot"); if (!n) { if (b) b.remove(); return; } if (!b) { b = document.createElement("i"); b.className = "gp-dot"; el.appendChild(b); } b.textContent = n > 99 ? "99+" : n; }); }
  function open() { if (!G.state) return; let ov = $("gpOv"); if (!ov) { ov = document.createElement("div"); ov.id = "gpOv"; ov.className = "gp-ov"; document.body.appendChild(ov); bind(ov); } ui.page = -1; ov.hidden = false; render(); }
  function close() { const ov = $("gpOv"); if (ov) ov.hidden = true; }
  function bind(ov) {
    ov.addEventListener("click", (e) => { if (e.target === ov) return close(); const t = e.target.closest("button"); if (!t || t.disabled) return; const d = t.dataset;
      if ("gpClose" in d) close(); else if ("gpPrem" in d) buyPrem(); else if ("gpAll" in d) claimAll(); else if (d.gpClaim) claimOne(+d.gpClaim, d.t);
      else if (d.gpSkip) skip(+d.gpSkip); else if (d.gpPg) { ui.page += +d.gpPg; render(); ov.querySelector(".gp-tab").scrollIntoView({ block: "start" }); } });
    ov.addEventListener("change", (e) => { const el = e.target; if (el.dataset.gpAura) setAura(el.dataset.gpAura, el.value); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !ov.hidden) close(); }); }
  document.addEventListener("click", (e) => { const t = e.target.closest("[data-gp-open]"); if (!t) return; e.preventDefault(); e.stopPropagation(); open(); }, true);
  G.on("resources", () => badge()); setInterval(badge, 30000); setTimeout(badge, 1500);
  BL.GamePass = { open, close, addXp, claim, season, lvlOf, cum, rewards, avail, state: st };
})();
