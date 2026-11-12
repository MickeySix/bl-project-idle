// BL PROJECT IDLE · interface (painéis, modais, tela inicial) e loop de desenho
(function () {
  const C = BL.CONFIG, G = BL.Game, S = C.STATS;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => Math.round(n).toLocaleString("pt-BR");
  const rar = (id) => BL.rarity(id);
  const posName = (id) => C.POSITIONS.find((p) => p.id === id)?.name || id;

  // v265 · baús em pixel art dentro de um card (padrão = madeira em card branco; azul = card azul). Tampa em <g class="ch-lid"> para abrir.
  const CH_PAL = { padrao: { O: "#2a1608", M: "#8a4b1c", L: "#c27a34", D: "#5e3210", B: "#b9bccb" }, azul: { O: "#071538", M: "#1f5fd6", L: "#5aa6ff", D: "#123c94", B: "#e8eeff" }, epico: { O: "#1e0638", M: "#7a2fd6", L: "#c48bff", D: "#4d1694", B: "#f2e6ff" }, lendario: { O: "#3a2000", M: "#e09a1a", L: "#ffe27a", D: "#9a5a00", B: "#fff6d6" } };
  // v692 (Mickey): baú 3D da arte dele (img/baus/bau-KIND.png, uma cor por tipo). Continua num <svg viewBox 16x15> para os tamanhos antigos valerem; a tampa (.ch-lid) e o corpo (.ch-body) são a mesma imagem com recortes, para a tampa voar na animação
  const CH_KC = { padrao: "#d49a5c", azul: "#4d94ff", epico: "#b872ff", lendario: "#ffc83f" };
  function chestArt(kind = "padrao", cls = "") {
    if (!CH_PAL[kind]) kind = "padrao";
    if (!document.getElementById("chClips") && document.body) document.body.insertAdjacentHTML("beforeend", `<svg id="chClips" width="0" height="0" style="position:absolute" aria-hidden="true"><defs><clipPath id="chClipL"><polygon points="0,0 16,0 16,6.6 12.7,7.2 12.7,8.5 8.6,8.9 8.6,7.9 3.3,7.9 0,6.3"/></clipPath><clipPath id="chClipB"><polygon points="0,6.3 3.3,7.9 8.6,7.9 8.6,8.9 12.7,8.5 12.7,7.2 16,6.6 16,15 0,15"/></clipPath></defs></svg>`);
    const im = `<image href="img/baus/bau-${kind}.png?v=${BL.BUILD}" x="0" y="0" width="16" height="15" preserveAspectRatio="xMidYMid meet"/>`;
    return `<span class="ch-card ch-${kind} ${cls}"><svg viewBox="0 0 16 15" aria-hidden="true"><g class="ch-body" clip-path="url(#chClipB)">${im}</g><g class="ch-lid" clip-path="url(#chClipL)">${im}</g></svg></span>`;
  }
  const CH_SLOT_IC = { chuteira: "👟", caneleira: "🛡️", camisa: "👕", treinador: "🧢" };
  const itLore = (it) => it.desc + (it.ef ? ` Efeito: ${it.ef}` : "") + (it.ci ? ` Só ${it.who}, Épico ou acima, no espaço extra de personagem.` : ""); // v522 (v527: item de personagem)
  const itFx = (it) => (it.mgr ? Object.entries(it.fx).map(([k, v]) => BL.mgrFxTxt(k, v)).join(", ") : it.ci ? "espaço extra" : Object.entries(it.bonus).map(([k, v]) => `+${v} ${C.STAT_SHORT[k]}`).join(" ")); // v473
  // Animação de abrir: card treme, tampa abre, luz da raridade sobe e o item sai de dentro
  function chestOpenFx(res, x = window.innerWidth / 2, y = window.innerHeight / 2, host = null) { // v266: abre pequeno, no ponto do clique; v267: dentro da janela (host) para acompanhar quando arrasta
    if (!res) return;
    const rc = rar(res.item.rarity).color, el = document.createElement("div");
    el.className = "cfx"; el.style.setProperty("--rc", rc); if (host) { const hb = host.getBoundingClientRect(); el.classList.add("in"); el.style.left = x - hb.left + "px"; el.style.top = y - hb.top + "px"; } else { el.style.left = Math.max(90, Math.min(window.innerWidth - 90, x)) + "px"; el.style.top = Math.max(170, y) + "px"; } el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Baú aberto");
    el.innerHTML = `<div class="cfx-stage"><div class="cfx-rays"></div><div class="cfx-beam"></div><div class="cfx-chest">${chestArt(res.kind, "big")}</div>
      <div class="cfx-item"><i class="cfx-ic">${CH_SLOT_IC[res.item.slot] || "🎁"}</i><b>${esc(res.item.name)}</b><span>${rar(res.item.rarity).name} · +${fmt(res.gold)} Gold</span></div></div>`;
    const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 250); };
    el.addEventListener("click", () => { if (Date.now() - t0 > 900) close(); });
    const t0 = Date.now(); (host || document.body).appendChild(el); setTimeout(close, 3600);
  }

  // v690 (Mickey): abrir baú com suspense. v692: segue o storyboard dele em 4 tempos: pulsa e treme, carrega energia (anéis fechando), explode e abre (a tampa voa), prêmio (item, raridade, Gold, "Toque para continuar"). list = resultados de G.openChest (1 ou vários: mostra o melhor item e o total)
  function chestBoom(list) {
    list = (list || []).filter(Boolean); if (!list.length) return;
    const ord = C.RARITIES.map((x) => x.id), best = list.slice().sort((a, b) => ord.indexOf(b.item.rarity) - ord.indexOf(a.item.rarity))[0], kb = ["padrao", "azul", "epico", "lendario"], kind = list.map((x) => x.kind || "azul").sort((a, b) => kb.indexOf(b) - kb.indexOf(a))[0];
    const gold = list.reduce((n, x) => n + (x.gold || 0), 0), rc = rar(best.item.rarity).color, old = document.querySelector(".cbx"); if (old) old.remove();
    const el = document.createElement("div"); el.className = "cbx"; el.style.setProperty("--rc", rc); el.style.setProperty("--kc", CH_KC[kind] || CH_KC.azul);
    el.innerHTML = `<div class="cbx-title"><small>Abrindo</small><b>${esc((C.CHEST_KINDS[kind] || {}).name || "Baú")}${list.length > 1 ? ` ×${list.length}` : ""}</b></div>
      <div class="cbx-stage"><div class="cbx-rays"></div><div class="cbx-glow"></div><div class="cbx-floor"></div><i class="cbx-ring"></i><i class="cbx-ring r2"></i><i class="cbx-ring r3"></i><div class="cbx-beam"></div><div class="cbx-chest">${chestArt(kind, "big")}</div><div class="cbx-flash"></div>${Array.from({ length: 16 }, (_, i) => `<i class="cbx-p" style="--a:${Math.round(i * 22.5 + Math.random() * 14)}deg;--d:${110 + Math.round(Math.random() * 110)}px"></i>`).join("")}
      <div class="cbx-item"><small class="cbx-pz">Prêmio!</small><i class="cbx-ic">${BL.itemSvg(best.item) || CH_SLOT_IC[best.item.slot] || "🎁"}</i><b>${esc(best.item.name)}</b><span class="cbx-rar">${rar(best.item.rarity).name}</span><em><u></u>+${fmt(gold)} Gold</em></div></div>
      <small class="cbx-tap">Toque para continuar</small>`;
    const t0 = Date.now(), close = () => { if (!el.isConnected) return; el.classList.add("out"); setTimeout(() => el.remove(), 250); };
    el.addEventListener("click", () => { if (Date.now() - t0 > 2400) close(); });
    document.body.appendChild(el); setTimeout(() => el.classList.add("boom"), 1900); setTimeout(close, 6500);
    setTimeout(() => { if (el.isConnected) fxSnd("bau-abre"); }, 750); // v693: o estouro do áudio (1,15 s) cai junto com a explosão
  }

  // ---------- componentes ----------
  // v204 · sprite em pixel art no lugar do círculo com iniciais (C.SPRITES; por enquanto só o Isagi)
  const spr = (id) => (C.SPRITES[id] ? `<img class="spr" src="${C.SPRITES[id].card}" alt="">` : "");
  // v374 (Mickey): sprites parados respirando (folha "parado" + escala) por JS, roda com "reduzir animações". idleAnimate(root) troca cada img.spr por um canvas.
  const IDLE_BY_CARD = {}; Object.values(C.SPRITES).forEach((x) => { const a = x.anim && x.anim.idle; if (x.card && a && !IDLE_BY_CARD[x.card]) IDLE_BY_CARD[x.card] = a; });
  const idleImgs = {}; let idleT = null;
  function idleDraw(cv, t) {
    const im = cv._im, a = cv._a; if (!im.complete || !im.naturalWidth) return;
    const fw = Math.floor(im.naturalWidth / a.n), h = im.naturalHeight, k = Math.floor(t * (a.fps || 4) + cv._j) % a.n;
    if (cv.width !== fw || cv.height !== h) { cv.width = fw; cv.height = h; cv._k = -1; }
    if (cv._k !== k) { const g = cv.getContext("2d"); g.imageSmoothingEnabled = false; g.clearRect(0, 0, fw, h); g.drawImage(im, k * fw, 0, fw, h, 0, 0, fw, h); cv._k = k; }
    const br = Math.sin(t * 3.4 + cv._j * 1.3); cv.style.transform = `scale(${1 - 0.015 * br},${1 + 0.03 * br})`;
  }
  const IDLE_SEL = Object.keys(IDLE_BY_CARD).map((k) => `img[src="${k}"]`).join(",") || "img.spr-none"; // qualquer img com a arte de card de um personagem
  function idleAnimate(root) {
    if (!root) return; const t = performance.now() / 1000;
    root.querySelectorAll(IDLE_SEL).forEach((img, i) => { const a = IDLE_BY_CARD[img.getAttribute("src")]; if (!a) return;
      let im = idleImgs[a.src]; if (!im) { im = idleImgs[a.src] = BL.atlasImg(a.src) || new Image(); if (!im.getContext) im.src = a.src; } /* v603: atlas */
      const cv = document.createElement("canvas"); cv.className = img.className + " spr-idle"; cv._a = a; cv._im = im; cv._j = i % a.n; cv._k = -1;
      img.replaceWith(cv); idleDraw(cv, t); });
    if (!idleT) idleT = setInterval(() => { const els = document.querySelectorAll("canvas.spr-idle"); if (!els.length) { clearInterval(idleT); idleT = null; return; } const t = performance.now() / 1000; els.forEach((cv) => idleDraw(cv, t)); }, 1000 / 12);
  }
  // v386 (Mickey): todo sprite de jogador que aparecer na tela respira parado; observa o DOM e troca os img.spr novos
  let idleQ = 0;
  new MutationObserver(() => { if (!idleQ) idleQ = requestAnimationFrame(() => { idleQ = 0; if (document.querySelector(IDLE_SEL)) idleAnimate(document.body); }); }).observe(document.documentElement, { childList: true, subtree: true });
  // token redondo de um jogador (p.charId) ou personagem (id), com a cor da raridade quando não tem sprite
  const tok = (id, ini, color, cls = "") => (C.SPRITES[id] ? `<span class="token has-spr ${cls}">${spr(id)}</span>` : `<span class="token ${cls}"${color ? ` style="background:${color}"` : ""}>${esc(ini)}</span>`);
  function badge(p) {
    const r = rar(p.rarity);
    if (C.SPRITES[p.charId]) return `<div class="pc-badge has-spr ${p.shiny ? "shiny" : ""}">${spr(p.charId)}</div>`;
    return `<div class="pc-badge" style="background:${r.color}${p.shiny ? ";box-shadow:0 0 0 2px #ffd23f inset" : ""}">${esc(p.initials)}</div>`;
  }
  function statBars(p, opts = {}) {
    const n = BL.NATURE_BY_NAME[p.nature];
    return `<div class="stats">${S.map((k) => {
      const v = opts.raw ? p.stats[k] : Math.round(BL.baseStat(p, k) * 10) / 10;
      const cls = n?.up === k ? "up" : n?.down === k ? "down" : "";
      return `<div class="stat ${cls}" title="${C.STAT_LABEL[k]}"><span>${C.STAT_SHORT[k]}</span><div class="sbar"><i style="width:${Math.min(100, (v / 31) * 100)}%"></i></div><b>${opts.raw ? v : Math.round(v)}</b></div>`;
    }).join("")}</div>`;
  }
  function natureText(name) {
    const n = BL.NATURE_BY_NAME[name];
    if (!n || !n.up) return `${esc(name)} <span class="note">neutra</span>`;
    return `${esc(name)} <span class="nat-up">+${C.STAT_SHORT[n.up]}</span> <span class="nat-down">−${C.STAT_SHORT[n.down]}</span>`;
  }
  // v110 · cards do campo (Meu time e Adversário): sprite, nome, raridade, nível, posição e XP (meu) ou chance de roubo (inimigo).
  // O sprite ainda é o quadrado com as iniciais; vira a pixel art quando ela existir. IVs e status ficam na janela EV e status.
  function miniCard(p, opts = {}) {
    const r = rar(p.rarity), xpNeed = C.playerXpToNext(p.level);
    const pos = C.POSITIONS.find((x) => x.id === p.position);
    return `<div class="pcard mini-card clickable${opts.subOut ? " sub-out" : ""}" data-ev="${p.uid}" title="${opts.noXp ? "Ver status" : "Abrir EV e status"}">
      <div class="pc-top"><div class="pc-sprite">${badge(p)}</div><div style="min-width:0"><div class="pc-name">${esc(p.name)}</div>
        <div class="pc-meta">${opts.hideRar ? `<span class="chip" style="color:#7f8db3" title="A raridade só aparece quando você rouba o jogador">???</span>` : `<span class="chip" style="color:${r.color}">${p.shiny ? "Shiny ✦ " : ""}${r.name}</span>`}</div>
        <div class="pc-pos">${pos ? `<b title="${esc(pos.name)}">${pos.short}</b>` : ""}<span class="lv">Nv ${p.level}</span></div></div>${opts.heal ? healRow(p) : ""}</div>
      ${opts.footer || ""}${opts.noXp ? "" : `<div class="pc-xp" title="${fmt(p.xp)}/${fmt(xpNeed)} XP"><span>XP</span><span class="bar"><i style="width:${(p.xp / xpNeed) * 100}%"></i></span></div>`}
    </div>`;
  }
  // v135 · recarga de energia no card: Água e Gatorade, 1 uso a cada 30 s de jogo por jogador
  // v178 · quantidade curta (9,9k / 12k / 1,2M) para o botão não empurrar o Nv; o número cheio fica no title
  function shortCount(n) {
    if (n < 1000) return String(n);
    const [d, u] = n < 1e6 ? [1e3, "k"] : [1e6, "M"], v = n / d;
    return (v < 10 ? (Math.floor(v * 10) / 10).toString().replace(".", ",") : Math.floor(v)) + u;
  }
  function healRow(p) {
    if (C.HEAL_ONLY_HALFTIME) return `<div class="pc-heal" data-heal-row="${p.uid}" hidden></div>`; // v690 (Mickey): bebida só no Vestiário
    const e = G.healEnt(p.uid), c = G.cons(), wait = G.healWait(e);
    return `<div class="pc-heal" data-heal-row="${p.uid}">${Object.entries(C.CONSUMABLES).filter(([id, it]) => !it.chest || c[id] > 0).map(([id, it]) => { // v522: bebida de baú só aparece se tiver
      const off = !e || !c[id] || wait > 0 || e.energy >= 100;
      const why = !e ? "Só durante a partida" : !c[id] ? "Sem itens: compre na Loja" : wait > 0 ? `Espera ${wait}s` : e.energy >= 100 ? "Energia cheia" : `Usar ${it.name} (${it.desc.toLowerCase()})`;
      return `<button type="button" class="heal-btn" data-heal="${p.uid}|${id}" ${off ? "disabled" : ""} title="${why} · ${fmt(c[id] || 0)} ${it.name}">${it.icon}<b>${shortCount(c[id] || 0)}</b></button>`;
    }).join("")}${e && wait > 0 ? `<span class="heal-wait">${wait}s</span>` : ""}</div>`;
  }
  // v139 · reservas: 2 vagas no Meu time, escolhidas fora da partida; entram só no Vestiário
  // v155 · reservas em destaque, iguais nos dois cards (o adversário também tem 2; no PvP o outro jogador escolhe as dele)
  // v174 · Mickey: reservas num card separado, embaixo do Meu time e do Adversário (#myBench / #enemyBench)
  function benchBox(slots) { return `<div class="bench-slots">${slots.join("")}</div>`; }
  function setBench(side, html) { $(side + "Bench").innerHTML = html; $(side + "BenchPanel").hidden = !html; }
  function benchInner(p) { return `${badge(p)}<span class="bench-txt"><b>${esc(p.short)}</b><small>${posShort(p)} · Nv ${p.level}</small></span>`; }
  function posShort(p) { const pos = C.POSITIONS.find((x) => x.id === p.position); return pos ? pos.short : ""; }
  function benchRow() {
    const s = G.state; if (s.training) return "";
    const b = G.bench(), act = G.activePlayers(), spare = s.roster.filter((p) => !act.includes(p) && !G.isAway(p.uid)).length;
    const slot = (i) => {
      const p = b[i];
      if (!p && !spare) return `<div class="bench-slot empty" title="Sem jogadores sobrando no elenco"><span class="bench-plus">–</span><span class="bench-txt"><b>Vazio</b><small>Sem elenco</small></span></div>`;
      const q = p && (s.subQueue || []).find((x) => x.in === p.uid), qo = q && s.roster.find((x) => x.uid === q.out);
      return `<button type="button" class="bench-slot${p ? " on" : ""}${q ? " queued" : ""}" data-bench-slot="${i}"${p ? ` draggable="true" data-bench-uid="${p.uid}"` : ""} title="${q ? `Entra no lugar de ${esc(qo?.short || "")} no intervalo (clique para trocar ou tirar)` : p ? "Arraste para um titular para trocar · clique para trocar ou tirar reserva" : "Escolher reserva"}">${q ? `<i class="bench-q">⇅ ${esc(qo?.short || "")}</i>` : ""}${p ? benchInner(p) : `<span class="bench-plus">+</span><span class="bench-txt"><b>Reserva</b><small>Escolher</small></span>`}</button>`;
    };
    return benchBox([0, 1].slice(0, C.BENCH_SIZE).map(slot));
  }
  function enemyBenchRow() {
    const list = G.enemyBench || []; if (!list.length) return "";
    return benchBox(list.map((p) => `<div class="bench-slot on enemy clickable" data-ev="${p.uid}" title="Ver status">${benchInner(p)}</div>`));
  }
  function refreshHeal() {
    document.querySelectorAll("[data-heal-row]").forEach((row) => { const p = G.player(row.dataset.healRow); if (p) row.outerHTML = healRow(p); });
  }
  setInterval(() => { if (!G.state) return; refreshHeal(); refreshPause(); }, 1000);
  // v181 · tela do Boss ao vivo: relógio a cada 1 s e redesenho a cada lance simulado (não redesenha com baú aberto)
  let bossSeen = -1;
  setInterval(() => {
    const r = G.state && G.bossRun(); if (!r) { bossSeen = -1; return; }
    const tk = G.bossTick() && r.ticks, el = $("bossClock"), left = Math.max(0, r.end - Date.now());
    if (el && Date.now() < r.start) el.textContent = `${C.BOSS_RUN.startHour}h`; else if (el && left > 0) el.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
    if (bossPtr && currentModal === "Chefes e Raids") return;
    if (currentModal === "Chefes e Raids" && !bossChest && (tk !== bossSeen || (left === 0 && el && !el.classList.contains("end")))) { const sc = $("modalBody").scrollTop, ls = ($(".bo-rk-list") || {}).scrollTop; MODALS.boss(true); $("modalBody").scrollTop = sc; if (ls && document.querySelector(".bo-rk-list")) document.querySelector(".bo-rk-list").scrollTop = ls; }
    bossSeen = tk;
  }, 1000);
  // v137 · pré-jogo: escolha de formação com contagem; se ninguém mexer, começa com a última usada
  let pmTab = "com"; // v599: aba do pré-jogo (4×4)
  function renderPrematch() {
    let box = $("prematch");
    if (!box) { box = document.createElement("div"); box.id = "prematch"; box.className = "prematch"; $("pitchWrap").appendChild(box); }
    const pm = G.prematch;
    if (!pm || !G.match) { box.hidden = true; return; }
    const left = Math.max(0, Math.ceil((pm.until - Date.now()) / 1000)), cur = (pm.sel && G.tactics().find((t) => t.id === pm.sel)) || G.myTactic, size = G.map.size;
    const tag = (t) => (t.type ? ` · ${C.FORMATION_TYPE[t.type]}` : "");
    box.hidden = false;
    // v152: só redesenha quando muda a partida; a cada 250 ms troca apenas o número e a seleção (redesenhar no meio do clique perdia o clique)
    const key = [G.state.matchNo || 0, G.enemyTeam, G.enemyHint, size, G.tactics().map((t) => t.id).join(), pmTab].join("|");
    if (box.dataset.key === key && box.firstChild) {
      const c = box.querySelector(".pm-count"); if (c.textContent !== String(left)) c.textContent = left;
      box.querySelectorAll(".pm-pick").forEach((b) => b.classList.toggle("on", !!cur && b.dataset.pmPick === cur.id));
      box.querySelectorAll("[data-pm-atk]").forEach((b) => b.classList.toggle("on", b.dataset.pmAtk === G.myAtk()));
      return;
    }
    box.dataset.key = key;
    box.innerHTML = `<div class="pm-box"><div class="pm-head"><b>${size === 4 ? "Formação" : "Tática"} da partida</b><span class="pm-count">${left}</span></div>
      <p class="pm-hint"><span>Técnico</span> ${esc(G.enemyTeam)} ${esc(G.enemyHint || "")}</p>
      <div class="pm-list"><button type="button" class="btn btn-hot" data-pm-pick="go">Jogar</button>
        ${size === 4 && C.ATK_PRESETS ? `<div class="pm-tabs"><button type="button" class="${pmTab === "com" ? "on" : ""}" data-pm-tab="com">Com a bola</button><button type="button" class="${pmTab === "sem" ? "on" : ""}" data-pm-tab="sem">Sem a bola</button></div>` : ""}${size === 4 && C.ATK_PRESETS && pmTab === "com" ? `<div class="pm-forms" style="--pm-cols:3">${C.ATK_PRESETS.map((p) => `<button type="button" class="btn pm-form${G.myAtk() === p.id ? " on" : ""}" data-pm-atk="${p.id}">${atkSvg(p)}<b>${p.label}</b></button>`).join("")}</div>` : `<div class="pm-forms" style="--pm-cols:${G.tactics().length === 4 ? 2 : Math.min(3, G.tactics().length)}">${G.tactics().map((t) => `<button type="button" class="btn pm-pick pm-form${cur && t.id === cur.id ? " on" : ""}" data-pm-pick="${t.id}" title="${esc(t.name)}${tag(t)}">${formSvg(t, size)}<b>${esc(t.name)}</b></button>`).join("")}</div>`}</div></div>`; // v599 (Mickey): abas Com a bola (ataque) e Sem a bola (formação), cada uma com os campinhos // v598 (Mickey): no pré-jogo escolhe a formação (sem a bola) e o ataque (com a bola)
  }
  // v455 (Mickey) · posições do meu time com a bola e sem a bola (4×4): arrasta cada posição no campo; vale quando o jogo acalma
  function eqBoard(k, ps) {
    const t4 = G.tactic4(), sh = k === "sem" ? G.markShape(t4).sem : k === "com" ? G.atkShape(G.myAtk()) : G.posShape(k), fixedK = k === "sem" || k === "com", /* v598: Com a bola vem do ataque, sem arrastar */ lab = ["FIX", "ALD", "ALO", "PIV"]; // v458: Sem a bola = marcação da formação, sem arrastar
    const pins = sh.map((q, i) => { const p = ps[i]; const spr = p && C.SPRITES[p.charId] ? `<img class="eqb-spr" src="${C.SPRITES[p.charId].card}" alt="" draggable="false">` : `<i>${lab[i]}</i>`; // v456: sprite respirando (idleAnimate troca a img por canvas)
      return `<button type="button" class="eqb-pin${fixedK ? " fixed" : ""}"${fixedK ? "" : ` data-eqb-pin="${k}|${i}"`} style="left:${(q[0] * 100).toFixed(1)}%;top:${(q[1] * 100).toFixed(1)}%">${spr}<span class="eqb-plat"></span><b><em>${lab[i]}</em> ${p ? esc(p.short) : "—"}</b></button>`; }).join("");
    const ak = k === "com" && C.ATK_PRESETS ? `<div class="eqb-marks eqb-atk"><small>Ataque</small>${C.ATK_PRESETS.map((p) => { const f = C.TACTICS[4].find((t) => t.type === p.beatenBy); return `<button type="button" class="${G.myAtk() === p.id ? "on" : ""}" data-eqb-atk="${p.id}">${p.label}</button>`; /* v599: só os números */ }).join("")}</div>` : ""; // v598: sem "perde para" // v597 (Mickey): 3 presets de ataque
    const mk = k === "sem" ? `<div class="eqb-marks"><small>Marcação</small>${C.MARK_PRESETS.map((p) => { const f = C.TACTICS[4].find((t) => t.mark === p.id); return `<button type="button" class="${t4.mark === p.id ? "on" : ""}" data-eqb-mark="${p.id}">${p.name}</button>`; /* v598: sem o nome cinza repetido */ }).join("")}</div>` : "";
    return `<div class="eqb">${ak}${mk}<div class="eqb-pitch" data-eqb-pitch="${k}"><svg viewBox="0 0 100 52" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="rgba(255,255,255,.4)" stroke-width=".35"><rect x=".8" y=".8" width="98.4" height="50.4"/><line x1="50" y1=".8" x2="50" y2="51.2"/><circle cx="50" cy="26" r="7"/><rect x=".8" y="13" width="14" height="26"/><rect x="85.2" y="13" width="14" height="26"/></g></svg>
        <span class="eqb-dir">Atacando →</span>${pins}</div>
      </div>`;
  }
  // v192 · 1×1 a 3×3 não têm desenho de formação: monta um só para o mini campo (defensores atrás, atacantes no meio-campo)
  function autoShape(t, size) {
    const col = (n, x, atk) => Array.from({ length: n }, (_, i) => [x, n === 1 ? 0.5 : 0.25 + (0.5 * i) / (n - 1), atk ? "atk" : undefined]);
    return [...col(size - t.atk, 0.22, false), ...col(t.atk, 0.47, true)];
  }
  // v150: mini campo com os bonequinhos da formação (goleiro à esquerda, atacando para a direita)
  function formSvg(t, size) {
    const shape = t.shape || autoShape(t, size);
    const W = 100, H = 64, man = (x, y, c) => `<g transform="translate(${(x * W).toFixed(1)} ${(y * H).toFixed(1)}) scale(1.3)"><circle cy="-4.2" r="2.6" fill="${c}"/><path d="M-3.6 3.6 Q-3.6 -1.2 0 -1.2 Q3.6 -1.2 3.6 3.6 Z" fill="${c}"/></g>`;
    return `<svg class="pm-mini" viewBox="0 0 ${W} ${H}" aria-hidden="true"><rect width="${W}" height="${H}" rx="3" fill="#1f7a3a"/>
      <g fill="none" stroke="rgba(255,255,255,.45)" stroke-width=".8"><rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="2"/><line x1="${W / 2}" y1="1.5" x2="${W / 2}" y2="${H - 1.5}"/><circle cx="${W / 2}" cy="${H / 2}" r="8"/><rect x="1.5" y="${H / 2 - 13}" width="12" height="26"/><rect x="${W - 13.5}" y="${H / 2 - 13}" width="12" height="26"/></g>
      ${man(0.07, 0.52, "#ffd23f")}${shape.map((q) => man(q[0], q[1] + 0.02, q[2] === "atk" ? "#ff5a73" : "#4f9bff")).join("")}</svg>`;
  }
  // v603 (Mickey): o campinho do Com a bola mostra como o time joga, sem texto: bola no pé = muitos toques curtos, dribles e trocas de posição;
  // plays setadas = jogada ensaiada em linhas retas (parede, cruzamento, chute) e time parado nos lugares; equilíbrio = metade de cada
  function atkSvg(p) {
    const W = 100, H = 64, sh = p.shape, P = (i) => [sh[i][0] * W, sh[i][1] * H + 1.3], f = (v) => v.toFixed(1);
    const man = (x, y, c, mv) => `<g transform="translate(${f(x)} ${f(y)})">${mv ? `<animateTransform attributeName="transform" type="translate" values="${mv}" dur="${p.id === "pe" ? 6 : 8}s" repeatCount="indefinite" calcMode="spline" keySplines="${mv.split(";").slice(1).map(() => ".45 0 .55 1").join(";")}"/>` : ""}<g transform="scale(1.3)"><circle cy="-4.2" r="2.6" fill="${c}"/><path d="M-3.6 3.6 Q-3.6 -1.2 0 -1.2 Q3.6 -1.2 3.6 3.6 Z" fill="${c}"/></g></g>`;
    const pt = (q) => `${f(q[0])} ${f(q[1] - 2)}`, A = P(0), B = P(1), Cc = P(2), D = P(3), G0 = [W - 2, H / 2];
    const wig = (a, b, k) => { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return `Q ${f(mx - (dy / L) * k)} ${f(my + (dx / L) * k - 2)} ${pt(b)}`; };
    let path, dur, moves = [];
    if (p.id === "pe") { // toques curtos, drible em zigue-zague, todo mundo trocando de lugar
      const m1 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + 6], m2 = [(Cc[0] + D[0]) / 2, (Cc[1] + D[1]) / 2 - 5];
      path = `M ${pt(A)} ${wig(A, m1, 5)} ${wig(m1, B, -5)} ${wig(B, Cc, 6)} ${wig(Cc, m2, -6)} ${wig(m2, D, 5)} ${wig(D, B, -8)} ${wig(B, G0, 4)}`; dur = 3.2;
      const sw = (a, b) => `${f(a[0])} ${f(a[1])};${f(b[0])} ${f(b[1])};${f(a[0])} ${f(a[1])}`;
      moves = [sw(A, D), sw(B, Cc), sw(Cc, B), sw(D, A)];
    } else if (p.id === "set") { // jogada ensaiada: parede, cruzamento, levantada, chute
      const wall = [(A[0] + B[0]) / 2, 2.5];
      path = `M ${pt(A)} L ${pt(wall)} L ${pt(B)} L ${pt(D)} L ${pt(Cc)} L ${pt(G0)}`; dur = 5;
    } else { // equilíbrio: um pouco de cada
      const m = [(B[0] + D[0]) / 2, (B[1] + D[1]) / 2 + 5];
      path = `M ${pt(A)} L ${pt(B)} ${wig(B, m, 5)} ${wig(m, D, -5)} L ${pt(Cc)} L ${pt(G0)}`; dur = 4;
      const sw = (a, b) => `${f(a[0])} ${f(a[1])};${f(a[0])} ${f(a[1])};${f(b[0])} ${f(b[1])};${f(a[0])} ${f(a[1])}`;
      moves = [null, sw(B, Cc), sw(Cc, B), null];
    }
    const dash = p.id === "set" ? "" : ` stroke-dasharray="1.6 1.6"`;
    return `<svg class="pm-mini" viewBox="0 0 ${W} ${H}" aria-hidden="true"><rect width="${W}" height="${H}" rx="3" fill="#1f7a3a"/>
      <g fill="none" stroke="rgba(255,255,255,.45)" stroke-width=".8"><rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="2"/><line x1="${W / 2}" y1="1.5" x2="${W / 2}" y2="${H - 1.5}"/><circle cx="${W / 2}" cy="${H / 2}" r="8"/><rect x="1.5" y="${H / 2 - 13}" width="12" height="26"/><rect x="${W - 13.5}" y="${H / 2 - 13}" width="12" height="26"/></g>
      <path d="${path}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".7"${dash}/>
      ${man(0.07 * W, 0.54 * H, "#ffd23f")}${sh.map((q, i) => man(q[0] * W, q[1] * H + 1.3, q[0] > 0.6 ? "#ff5a73" : "#4f9bff", moves[i])).join("")}
      <circle r="1.7" fill="#fff" stroke="#0A1124" stroke-width=".4"><animateMotion dur="${dur}s" repeatCount="indefinite" path="${path}"/></circle></svg>`;
  }
  setInterval(() => { if (G.prematch || !($("prematch") || {}).hidden) renderPrematch(); }, 250);
  G.on("prematch", renderPrematch);
  G.on("vestiario", () => { if (G.vest) { MODALS.vestiario(); renderMyTeam(); } else if (currentModal === "Vestiário") closeModal(); });
  setInterval(() => { const el = $("vestCount"); if (el && G.vest) el.textContent = Math.max(0, Math.ceil((G.vest.until - Date.now()) / 1000)); }, 250);
  function refreshPause() {
    const b = $("pauseBtn"); if (!b) return;
    const st = G.pauseState();
    b.disabled = st !== "ok";
    b.title = { ok: "Congela a partida para trocar a formação (1 por partida)", used: "Já usada nesta partida", golden: "Não dá no golden gol", wait: "Libera depois do apito inicial", off: "Só em partidas normais" }[st];
    b.textContent = st === "used" ? "Pausa tática usada" : "Pausa tática";
  }
  // v623 · habilidades equipadas (nome · nível) ou os slots livres
  // v629 · ícone da habilidade (atlas img/skills.jpg: 7 por linha, carta 132×172 recortada no quadrado de S px)
  function skIco(id, S) { const d = BL.SKILLS[id]; if (!d) return ""; const c = d.ix % 7, r = Math.floor(d.ix / 7), k = 172 / 132; return `<span class="sk-ico" style="width:${S}px;height:${S}px;background-size:${7 * S}px auto;background-position:${-c * S}px ${-(r * S * k + (S * (k - 1)) / 2).toFixed(1)}px"></span>`; }
  function skNames(p) { const n = rar(p.rarity).skills, L = (p.skills || []).filter((x) => x && BL.SKILLS[x.id]); return L.length ? L.map((x) => `${esc(BL.SKILLS[x.id].name)} Nv ${x.lv || 1}`).join(" · ") + (L.length < n ? ` · ${n - L.length} livre${n - L.length > 1 ? "s" : ""}` : "") : `${n} slot${n > 1 ? "s" : ""} livre${n > 1 ? "s" : ""}`; }
  function skBox(p, ro) {
    const n = rar(p.rarity).skills, Lb = G.skLib(), own = Object.keys(C.SKILL_DEF).filter((id) => Lb[id]), rn = { raro: "Rara", epico: "Épica", lendario: "Lendária" };
    const slot = (i) => { const x = (p.skills || [])[i], d = x && BL.SKILLS[x.id];
      if (ro) return `<div class="sk-eq"><div class="sk-eq-row">${d ? skIco(x.id, 44) : ""}<b style="color:${d ? C.SKILL_RAR_COL[d.rar] : "var(--muted)"}">${d ? esc(d.name) : "Sem habilidade"}</b></div>${d ? `<span>${esc(d.desc)}</span>` : ""}</div>`;
      const opt = own.map((id) => { const o = G.skOwner(id), dd = BL.SKILLS[id]; return `<option value="${id}" ${x && x.id === id ? "selected" : ""}>${esc(dd.name)} · ${rn[dd.rar]} · Nv ${Lb[id].lv}${o && o !== p ? ` (com ${esc(o.short)})` : ""}</option>`; }).join("");
      return `<div class="sk-eq"><div class="sk-eq-row">${d ? skIco(x.id, 44) : `<span class="sk-ico sk-ico-empty"></span>`}<select data-sk-eq="${i}" aria-label="Habilidade ${i + 1}"><option value="">Slot ${i + 1}: vazio</option>${opt}</select></div>${d ? `<span style="color:${C.SKILL_RAR_COL[d.rar]}">${esc(d.desc)} · recarga ${Math.max(5, d.cd - ((x.lv || 1) - 1) * C.SKILL_LV.cd)} s</span>` : ""}</div>`; };
    return `<div class="ev-skills"><div class="ev-sk-h"><span>Habilidades</span><b>${n} slot${n > 1 ? "s" : ""}${ro ? "" : ` · ${own.length} livro${own.length === 1 ? "" : "s"} de ${Object.keys(C.SKILL_DEF).length}`}</b></div>
      ${Array.from({ length: n }, (_, i) => slot(i)).join("")}${ro ? "" : `<p class="note">Cada habilidade fica em um jogador por vez. Por enquanto todas estão liberadas.</p>`}</div>`;
  }
  function playerCard(p, opts = {}) {
    const r = rar(p.rarity);
    const xpNeed = C.playerXpToNext(p.level);
    return `<div class="pcard">
      <div class="pc-top">${badge(p)}<div style="min-width:0">
        <div class="pc-name">${esc(p.name)}</div>
        <div class="pc-meta"><span class="chip" style="color:${r.color}">${p.shiny ? "Shiny ✦ " : ""}${r.name}</span><span class="lv">Nv ${p.level}</span><span class="lv">${C.POSITIONS.find((x) => x.id === p.position)?.short || ""}</span>${p.boss ? `<span class="chip" style="color:var(--warn)">Boss · ${esc(p.title)}</span>` : ""}</div>
      </div></div>
      ${opts.noXp ? "" : `<div class="pc-xp"><span>XP</span><span class="bar"><i style="width:${(p.xp / xpNeed) * 100}%"></i></span><span>${fmt(p.xp)}/${fmt(xpNeed)}</span></div>`}
      <div class="pc-row"><span>Nature</span><b>${natureText(p.nature)}</b></div>
      ${statBars(p)}
      <div class="pc-row"><span class="total">Status base ${BL.statTotal(p)}/186 (${Math.round((BL.statTotal(p) / 186) * 100)}%)</span></div>
      ${opts.extra || ""}
    </div>`;
  }

  // v640 (Mickey): rosto do treinador desenhado em SVG, preto e branco no estilo dos cards de técnico. Peças em C.FACE_PARTS.
  let faceN = 0;
  function faceSVG(av, crop) {
    av = av || {}; const u = "f" + (++faceN), K = "#000", Wt = "#fff";
    const pick = (k) => Math.max(0, av[k] | 0);
    const ro = pick("rosto"), ca = pick("cabelo"), ol = pick("olhos"), bo = pick("boca"), ba = pick("barba"), ex = pick("extra");
    const FACES = [
      "M98,100 C98,50 222,50 222,100 L220,158 C216,196 188,222 160,226 C132,222 104,196 100,158 Z",
      "M98,98 C98,50 222,50 222,98 L220,162 L178,222 L142,222 L100,162 Z",
      "M102,100 C102,52 218,52 218,100 L214,164 L160,232 L106,164 Z",
      "M93,100 C93,46 227,46 227,100 L225,170 C221,206 190,224 160,226 C130,224 99,206 95,170 Z",
    ];
    const face = FACES[ro % FACES.length];
    const P = (d, f, s, w, x) => `<path d="${d}" fill="${f || "none"}"${s ? ` stroke="${s}" stroke-width="${w || 4}" stroke-linejoin="round" stroke-linecap="round"` : ""}${x || ""}/>`;
    const C0 = (x, y, r, f, s, w) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f || "none"}"${s ? ` stroke="${s}" stroke-width="${w || 2}"` : ""}/>`;
    const mir = (g) => `<g transform="translate(320,0) scale(-1,1)">${g}</g>`;
    const both = (g) => g + mir(g);
    const clip = `<clipPath id="${u}c"><path d="${face}"/></clipPath>`;
    // ---- cabelo: [atrás da cabeça, na frente] ----
    const bumps = (cx, cy, rx, ry, a0, a1, n, r) => { let s = ""; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; s += C0((cx + rx * Math.cos(a)).toFixed(1), (cy + ry * Math.sin(a)).toFixed(1), r, K); } return s; };
    const curlHi = (pts) => pts.map(([x, y]) => P(`M${x - 5},${y + 2} q5,-7 10,0`, null, Wt, 2)).join("");
    const strand = (x0, y0, x1, y1, w) => P(`M${x0},${y0} Q${(x0 + x1) / 2 + 6},${(y0 + y1) / 2} ${x1},${y1}`, null, K, w || 11);
    // v641: mechas pontudas no estilo do anime. lock(raiz x,y, ponta x,y, largura, curva) = mecha em ponta
    const lock = (rx, ry, tx, ty, w, bend) => { const dx = tx - rx, dy = ty - ry, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, b = bend || 0, h = w / 2;
      const ax = rx + nx * h, ay = ry + ny * h, bx = rx - nx * h, by = ry - ny * h, f = (v) => v.toFixed(1);
      return `M${f(ax)},${f(ay)} Q${f((ax + tx) / 2 + nx * b)},${f((ay + ty) / 2 + ny * b)} ${tx},${ty} Q${f((bx + tx) / 2 + nx * b)},${f((by + ty) / 2 + ny * b)} ${f(bx)},${f(by)} Z`; };
    const locks = (arr) => P(arr.map((a) => lock(...a)).join(" "), K);
    const shine = (d) => P(d, null, Wt, 2.5);
    const CAP = (top, side) => `M${92 - side},112 C${84 - side},48 126,${top} 160,${top} C194,${top} ${236 + side},48 ${228 + side},112 C214,92 190,84 160,84 C130,84 106,92 ${92 - side},112 Z`;
    const temples = [[98, 100, 96, 156, 16, 3], [222, 100, 224, 156, 16, -3]];
    const HAIR = [
      () => ["", P("M126,72 Q142,62 160,64", null, "#aaa", 3)], // careca
      () => ["", P(CAP(26, 0), K) + locks([[112, 92, 102, 130, 22, 4], [132, 86, 124, 136, 22, 3], [152, 84, 150, 142, 22, 0], [172, 85, 180, 136, 22, -3], [192, 88, 202, 130, 22, -4], [210, 94, 222, 124, 18, -4], ...temples, [118, 40, 104, 20, 18, 4], [196, 36, 214, 20, 18, -4]]) + shine("M126,46 Q146,38 166,40 M180,42 Q196,46 206,56")], // curto
      () => ["", P(CAP(24, 0), K) + locks([[110, 92, 118, 128, 22, -6], [130, 86, 144, 136, 24, -8], [150, 84, 170, 146, 26, -10], [170, 84, 196, 160, 30, -12], [192, 88, 214, 140, 22, -8], [212, 94, 228, 128, 16, -4], [98, 100, 100, 150, 14, 2], [222, 100, 230, 170, 18, -4]]) + shine("M120,44 Q150,32 182,38 M168,98 Q178,120 188,140")], // franja lateral
      () => [P("M86,104 L80,184 L92,174 L98,188 L108,176 L108,104 Z M234,104 L240,184 L228,174 L222,188 L212,176 L212,104 Z", K), P(CAP(28, 4), K) + locks([[100, 98, 96, 124, 16, 2], [114, 92, 112, 124, 16, 0], [128, 88, 128, 124, 16, 0], [142, 86, 142, 124, 16, 0], [156, 85, 158, 124, 16, 0], [170, 86, 172, 124, 16, 0], [184, 88, 186, 124, 16, 0], [198, 91, 202, 124, 16, 0], [212, 96, 220, 124, 16, -2], [94, 104, 94, 178, 16, 4], [226, 104, 226, 178, 16, -4]]) + shine("M118,44 Q160,30 202,44 M124,56 Q160,46 196,56")], // tigela
      () => ["", P(CAP(30, 4), K) + locks([[100, 70, 74, 52, 26, 6], [114, 50, 98, 22, 26, 6], [140, 38, 132, 6, 26, 4], [170, 36, 182, 6, 26, -4], [200, 46, 222, 22, 26, -6], [218, 66, 248, 54, 26, -6], [224, 92, 246, 104, 22, -4], [96, 92, 74, 106, 22, 4], [112, 92, 98, 128, 20, 8], [134, 86, 140, 132, 20, -6], [158, 84, 150, 138, 22, 6], [180, 86, 192, 132, 22, -8], [204, 92, 214, 128, 20, -4], ...temples]) + shine("M124,50 Q150,40 176,44 M186,48 Q204,56 210,68")], // bagunçado
      () => ["", P(CAP(26, 2), K) + locks([[96, 96, 76, 124, 22, -4], [224, 96, 244, 124, 22, 4], [100, 70, 80, 84, 22, -2], [220, 70, 240, 84, 22, 2], [146, 86, 132, 130, 18, 6], [162, 86, 156, 124, 16, 4]]) + shine("M112,64 Q136,44 170,40 M120,78 Q146,58 184,52 M190,40 Q208,48 218,64 M196,58 Q210,66 216,80")], // para trás
      () => ["", P(CAP(34, 0), K) + locks([[110, 60, 96, 14, 28, 6], [132, 46, 124, 0, 28, 4], [158, 42, 160, -6, 30, 0], [184, 46, 196, 0, 28, -4], [206, 60, 226, 16, 28, -6], [94, 96, 72, 72, 22, -2], [226, 96, 248, 72, 22, 2], [128, 88, 122, 116, 18, 2], [150, 86, 148, 112, 16, 0], [176, 86, 184, 114, 18, -2], ...temples]) + shine("M132,26 L140,52 M162,20 L162,48 M188,26 L182,52")], // pra cima
      () => [P("M88,104 C78,170 80,240 90,276 L104,262 L110,280 L124,262 L132,276 L134,200 Z M232,104 C242,170 240,240 230,276 L216,262 L210,280 L196,262 L188,276 L186,200 Z", K), P(CAP(24, 4), K) + locks([[110, 92, 104, 132, 22, 4], [132, 86, 128, 140, 24, 3], [154, 84, 160, 146, 24, -2], [178, 86, 190, 140, 24, -4], [202, 92, 214, 132, 22, -4], [96, 100, 92, 214, 18, 6], [224, 100, 228, 214, 18, -6]]) + shine("M118,44 Q150,30 186,36 M192,42 Q208,52 214,66")], // longo
      () => ["", `<path d="M96,104 C92,56 128,40 160,40 C192,40 228,56 224,104 Z" fill="${K}"/>` + bumps(160, 100, 66, 58, 180, 360, 14, 15) + bumps(160, 104, 60, 6, 180, 360, 9, 9) + curlHi([[120, 56], [150, 44], [182, 48], [206, 66], [104, 80]])], // cacheado
      () => [bumps(160, 96, 104, 86, 150, 390, 22, 24) + `<ellipse cx="160" cy="96" rx="100" ry="80" fill="${K}"/>`, `<path d="M98,108 C96,60 128,48 160,48 C192,48 224,60 222,108 Z" fill="${K}"/>` + bumps(160, 106, 62, 8, 180, 360, 10, 9) + curlHi([[110, 40], [150, 22], [196, 30], [230, 56], [86, 70], [240, 96]])], // black power
      () => { let b = "", f = ""; [[96, 100, 70, 236], [108, 96, 92, 250], [224, 100, 250, 236], [212, 96, 228, 250], [120, 92, 112, 246], [200, 92, 208, 246]].forEach(([a, c, d, e]) => (b += strand(a, c, d, e, 13))); [[126, 74, 116, 116], [160, 68, 162, 112], [194, 72, 206, 118], [100, 96, 94, 200], [220, 96, 228, 200]].forEach(([a, c, d, e]) => (f += strand(a, c, d, e, 12))); f = `<path d="M94,108 C88,52 128,30 160,30 C192,30 232,52 226,108 Z" fill="${K}"/>` + f; return [b, f]; }, // dreads
      () => ["", `<path d="M98,102 C96,56 128,40 160,40 C192,40 224,56 222,102 L208,96 L200,84 L120,84 L112,96 Z" fill="#3a3a3a" stroke="${K}" stroke-width="3"/>` + Array.from({ length: 40 }, (_, i) => C0(110 + (i * 37) % 100, 50 + ((i * 53) % 40), 1.2, "#9a9a9a")).join("")], // raspado
      () => ["", `<path d="M100,100 C98,60 120,46 140,44 L180,44 C200,46 222,60 220,100 L204,86 L116,86 Z" fill="#3a3a3a"/>` + locks([[146, 80, 134, 14, 18, 4], [160, 76, 160, 2, 20, 0], [174, 80, 186, 14, 18, -4], [150, 92, 140, 40, 18, 2], [170, 92, 180, 40, 18, -2]]) + shine("M158,24 L159,62")], // moicano
      () => ["", C0(160, 26, 24, K) + P("M96,108 C92,54 128,40 160,40 C192,40 228,54 224,108 L210,80 C190,64 130,64 110,80 Z", K, K, 3) + locks([[104, 96, 98, 132, 14, 2], [216, 96, 222, 132, 14, -2]]) + shine("M118,60 Q160,44 202,60 M146,18 Q160,10 172,16")], // coque
      () => ["", P("M90,104 C88,40 128,14 160,14 C192,14 232,40 230,104 Z", K, K, 3) + locks([[120, 110, 112, 136, 16, 2], [140, 110, 138, 140, 16, 0], [184, 110, 190, 136, 16, -2]]) + `<rect x="86" y="88" width="148" height="24" rx="6" fill="${K}" stroke="${Wt}" stroke-width="2"/>` + Array.from({ length: 9 }, (_, i) => P(`M${100 + i * 15},92 v16`, null, Wt, 2)).join("") + shine("M120,36 Q160,22 200,36")], // gorro
    ];
    // ---- olhos (desenhados no olho esquerdo e espelhados) ----
    const spiral = (cx, cy, r) => C0(cx, cy, r, Wt, K, 1.8) + C0(cx, cy, r * 0.66, null, K, 1.6) + C0(cx, cy, r * 0.33, null, K, 1.5) + C0(cx + r * 0.1, cy, 1.4, K);
    const eye = (shape, cx, cy, r, brow, extra) => `<clipPath id="${u}e${cx | 0}"><path d="${shape}"/></clipPath>` + P(shape, Wt) + `<g clip-path="url(#${u}e${cx | 0})">${spiral(cx, cy, r)}${extra || ""}</g>` + P(shape, null, K, 2) + brow;
    const EYES = [
      () => eye("M108,148 L116,136 L146,138 L152,148 L144,156 L114,156 Z", 131, 147, 11, P("M106,126 L150,123 L148,129 L108,132 Z", K, K, 2)) + P("M108,148 L116,136 L146,138 L152,148", null, K, 4), // focado
      () => eye("M108,142 L148,146 L152,151 L144,157 L114,156 Z", 131, 151, 10, P("M104,120 L150,132 L148,137 L106,127 Z", K, K, 2)) + P("M108,142 L148,146 L152,151", null, K, 4.5), // bravo
      () => eye("M108,147 L150,144 L153,149 L144,156 L114,156 Z", 131, 153, 10, P("M106,126 Q128,120 150,126", null, K, 5)) + P("M106,147 L151,143", null, K, 5), // calmo
      () => eye("M109,146 C109,128 153,128 153,146 C153,162 109,162 109,146 Z", 131, 146, 9, P("M106,118 Q128,108 152,118", null, K, 4.5)) + P("M109,146 C109,128 153,128 153,146", null, K, 3.5), // arregalado
      () => P("M110,152 Q131,132 152,152", null, K, 5) + P("M106,122 Q128,114 150,122", null, K, 4.5), // sorriso
      () => eye("M106,148 L150,140 L154,146 L112,154 Z", 132, 147, 9, P("M104,128 L152,122 L150,126 L106,132 Z", K)) + P("M106,148 L150,140 L158,136", null, K, 3.5), // afiado
    ];
    const NOSE = P("M161,164 L155,178 L163,180", null, K, 2.5);
    const MOUTH = [
      () => P("M148,200 L172,200", null, K, 3.5),
      () => P("M142,195 Q160,210 178,195", null, K, 3.5),
      () => P("M140,193 L180,193 Q177,214 160,217 Q143,214 140,193 Z", Wt, K, 3) + P("M142,199 L178,199", null, K, 1.6) + P("M150,212 Q160,206 170,212", null, K, 1.5),
      () => { let t = "M136,198"; for (let i = 1; i <= 9; i++) t += ` L${136 + i * 5.3},${i % 2 ? 210 : 198}`; return P("M132,190 Q160,200 188,190 Q184,218 160,220 Q136,218 132,190 Z", Wt, K, 3.5) + P(t, null, K, 2.2) + P("M138,196 Q160,203 182,196", null, K, 1.5); },
      () => P("M146,202 Q164,202 178,192", null, K, 3.5),
      () => P("M145,199 L175,199", null, K, 4) + P("M153,207 L167,207", null, K, 2),
    ];
    const MB = [[159, 197, 18, 6], [159, 194, 27, 7], [160, 193, 29, 9], [159, 195, 32, 15], [158, 195, 27, 13], [159, 197, 23, 18], [158, 197, 12, 11], [159, 197, 22, 7], [160, 197, 27, 14], [159, 198, 26, 19], [160, 195, 30, 15], [161, 191, 31, 12], [161, 195, 30, 16], [159, 197, 15, 13], [159, 196, 26, 14], [167, 193, 34, 13], [162, 191, 28, 17], [159, 205, 26, 16], [159, 196, 21, 7], [160, 208, 25, 19]][bo % 20]; // v642: buraco da barba do tamanho de cada boca (bocas do Mickey)
    const BEARD = [
      () => "",
      () => P("M146,210 Q160,204 174,210 L172,224 Q160,236 148,224 Z", K) + P("M144,190 Q160,184 176,190", null, K, 3),
      () => `<path fill-rule="evenodd" fill="${K}" d="M92,148 L112,160 Q124,186 138,188 L182,188 Q196,186 208,160 L228,148 L232,250 L88,250 Z M${MB[0] - MB[2]},${MB[1]} a${MB[2]},${MB[3]} 0 1,0 ${MB[2] * 2},0 a${MB[2]},${MB[3]} 0 1,0 ${-MB[2] * 2},0 Z"/>` + P("M128,214 l6,-4 M184,216 l6,4 M156,228 l8,0", null, "#888", 2),
      () => P("M138,191 Q150,182 160,188 Q170,182 182,191 Q170,196 160,192 Q150,196 138,191 Z", K),
      () => Array.from({ length: 70 }, (_, i) => { const x = 104 + ((i * 47) % 112), y = 168 + ((i * 29) % 60); return Math.abs(x - 160) < 22 && Math.abs(y - 200) < 12 ? "" : C0(x, y, 1.5, "#555"); }).join(""),
      () => P("M138,191 Q150,182 160,188 Q170,182 182,191 Q170,196 160,192 Q150,196 138,191 Z", K) + P("M146,212 Q160,206 174,212 L170,226 Q160,234 150,226 Z", K),
    ];
    // v644 (Mickey): 23 acessórios da folha dele, redesenhados em SVG (sem o logo do Blue Lock). NV = azul-marinho das peças, BL = azul do cachecol/fone
    const NV = "#141a33", BLU = "#1f55e0", LENS = "rgba(205,220,240,.6)", HATS = [7, 8], NACC = 20 + 5;
    const band = (y0, h) => P(`M86,${y0 + 6} Q160,${y0 - 12} 234,${y0 + 6} L234,${y0 + 6 + h} Q160,${y0 - 12 + h} 86,${y0 + 6 + h} Z`, NV, K, 2.5) + P(`M100,${y0 + 6} Q160,${y0 - 8} 220,${y0 + 6}`, null, "#3c4a80", 1.5);
    // v645 (Mickey): acessórios 1-19 vêm da folha 2 dele (atlas img/aparencia/acessorios.png, sem o logo do Blue Lock); 20-24 são os SVG da v644 que não estão na folha
    // v649 (Mickey: acessórios bugados): óculos esportivo, óculos escuro e cicatriz em SVG, porque o recorte trazia os olhos e o queixo do desenho dele
    const RSVG = {
      2: () => P("M98,136 Q160,124 222,136 L220,156 Q192,166 168,155 L152,155 Q128,166 100,156 Z", LENS, K, 3) + P("M108,140 Q130,134 150,138 M170,138 Q192,134 212,140", null, Wt, 2) + both(P("M98,138 L86,142", null, K, 3.5)),
      3: () => both(P("M106,136 L154,136 L152,152 Q146,164 130,164 Q112,164 108,152 Z", K, K, 3) + P("M114,141 L126,141", null, "#777", 2.5)) + P("M154,140 Q160,136 166,140", null, K, 3.5) + both(P("M106,140 L90,136", null, K, 3.5)),
      16: () => both(P("M114,176 L126,198", null, K, 2.6) + P("M112,184 l7,-3 M116,191 l7,-3", null, K, 1.6)),
    };
    const EXTRA_SVG = [
      () => band(84, 11), // tiara esportiva
      () => P("M142,194 Q160,188 178,194 Q175,208 160,209 Q145,208 142,194 Z", "#a9c8ff", K, 2.2) + P("M146,198 Q160,202 174,198", null, "#4a6fb0", 1.5), // protetor bucal
      () => both(C0(91, 138, 2.6, K) + C0(89, 147, 2.6, K) + C0(96, 172, 3.5, null, K, 1.8)), // piercing
      () => both(`<rect x="90" y="146" width="12" height="14" rx="5" fill="${Wt}" stroke="${K}" stroke-width="2"/>` + C0(99, 153, 3, BLU)), // fone de ouvido
      () => P("M96,128 Q160,116 224,128 L224,162 Q192,170 166,160 L154,160 Q128,170 96,162 Z", K) + both(P("M106,134 L150,132 L150,152 Q130,160 108,154 Z", LENS, "#333", 1.5)) + both(P("M96,140 L84,138", null, K, 6)), // óculos de proteção
    ];
    // v642 (Mickey): cabelos, olhos e bocas desenhados pelo Mickey, recortados em atlas (img/aparencia, células de 400 px = 320 unidades)
    const atl = (src, i, cols, rows) => `<g transform="translate(160 150) scale(${1 / 1.1}) translate(-160 -150)"><svg x="0" y="0" width="320" height="320" viewBox="${(i % cols) * 400} ${Math.floor(i / cols) * 400} 400 400"><image href="img/aparencia/${src}.png?v=${BL.BUILD}" width="${cols * 400}" height="${rows * 400}"/></svg></g>`;
    const H = ca === 0 ? HAIR[0]() : ["", atl("cabelos", (ca - 1) % 21, 5, 5)];
    if (HATS.includes(ex % NACC)) H[1] = `<clipPath id="${u}h"><rect x="0" y="100" width="320" height="220"/></clipPath><g clip-path="url(#${u}h)">${H[1]}</g>`; // v644: chapéu esconde o topo do cabelo
    const EYE = ol < 8 ? atl("olhos", ol, 4, 2) : both(EYES[0]());
    const MOU = atl("bocas", bo % 20, 5, 4);
    const body = P("M24,322 L42,272 L118,250 L140,236 L180,236 L202,250 L278,272 L296,322 Z", K) + P("M128,226 L192,226 L196,262 L124,262 Z", K) + P("M128,226 L192,226", null, "#333", 2) + P("M206,280 h20 v15 l-10,9 l-10,-9 Z", Wt);
    const neck = P("M138,198 L138,236 L182,236 L182,198 Z", Wt, K, 4) + P("M140,226 Q160,234 180,226", null, K, 2);
    const ears = both(P("M104,132 C86,124 82,150 90,166 C96,176 104,174 106,170 Z", Wt, K, 4) + P("M96,144 Q92,152 98,160", null, K, 2));
    const vb = crop ? "40 -8 240 240" : "-10 -20 340 340";
    return `<svg class="av-svg" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg"><defs>${clip}</defs><g transform="translate(160 150) scale(1.1) translate(-160 -150)">${H[0]}</g>${neck}${body}<g transform="translate(160 150) scale(1.1) translate(-160 -150)">${ears}${P(face, Wt, K, 5)}<g clip-path="url(#${u}c)">${BEARD[ba % BEARD.length]()}</g>${NOSE}${MOU}${EYE}${H[1]}${ex % NACC === 0 ? "" : RSVG[ex % NACC] ? RSVG[ex % NACC]() : ex % NACC < 20 ? atl("acessorios", ex % NACC - 1, 5, 4) : EXTRA_SVG[ex % NACC - 20]()}</g></svg>`;
  }
  const faceOk = (s) => !!(s.avatar && s.avatar.saved && s.avatar.v === 2); // aparência antiga (v392) volta para as iniciais até salvar uma nova
  function avatarInto(el, s) {
    if (!el) return;
    if (!faceOk(s)) { el.classList.remove("has-av"); el.textContent = s.name.slice(0, 2).toUpperCase(); return; }
    el.classList.add("has-av"); el.innerHTML = faceSVG(s.avatar, true);
  }
  let avState = null, avCat = "cabelo";
  const avPart = (id) => C.FACE_PARTS.find((p) => p.id === id);
  function avPaint() {
    const box = $("avEdit"); if (!box || !avState) return;
    box.querySelector(".ave-fig").innerHTML = faceSVG(avState);
    box.querySelector(".ave-cats").innerHTML = C.FACE_PARTS.map((c) => `<button type="button" class="ave-cat ${c.id === avCat ? "on" : ""}" data-ave-cat="${c.id}"><b>${esc(c.name)}</b><small>${esc(c.items[avState[c.id] || 0])}</small></button>`).join("") + `<button type="button" class="ave-cat ave-rnd" data-ave-rnd><b>Aleatório</b><small>sortear tudo</small></button>`;
    const p = avPart(avCat), cur = avState[avCat] || 0;
    box.querySelector(".ave-name").innerHTML = `<small>${esc(p.name)} · ${cur + 1}/${p.items.length}</small><b>${esc(p.items[cur])}</b>`;
    box.querySelector(".ave-opts").innerHTML = p.items.map((nm, i) => `<button type="button" class="ave-opt ${i === cur ? "on" : ""}" data-ave-opt="${i}" title="${esc(nm)}">${faceSVG(Object.assign({}, avState, { [avCat]: i }), true)}<span>${esc(nm)}</span></button>`).join("");
  }
  function avStep(d) { const n = avPart(avCat).items.length; avState[avCat] = ((avState[avCat] || 0) + d + n) % n; avPaint(); }
  function avEditor() {
    const s = G.state, old = s.avatar && s.avatar.v === 2 ? s.avatar : null; avState = { v: 2 }; avCat = "cabelo";
    C.FACE_PARTS.forEach((p) => { const v = old ? old[p.id] | 0 : p.id === "cabelo" ? 1 : 0; avState[p.id] = v < p.items.length ? v : 0; });
    let box = $("avEdit"); if (box) box.remove();
    box = document.createElement("div"); box.id = "avEdit"; box.className = "ave";
    box.innerHTML = `<div class="ave-top"><div><small>Treinador</small><h2>Editar aparência</h2></div><button type="button" class="eq-x" data-ave-close aria-label="Fechar">✕</button></div>
      <div class="ave-body"><nav class="ave-cats"></nav>
        <div class="ave-stage"><button type="button" class="ave-arr" data-ave-step="-1" aria-label="Anterior">‹</button><div class="ave-fig"></div><button type="button" class="ave-arr" data-ave-step="1" aria-label="Próximo">›</button></div>
        <div class="ave-name"></div><div class="ave-opts"></div></div>
      <button type="button" class="ave-save" data-ave-save>Salvar aparência</button>`;
    document.body.appendChild(box);
    box.addEventListener("click", (e) => {
      const t = e.target.closest("button"); if (!t) return;
      if (t.dataset.aveClose !== undefined) { box.remove(); avState = null; return; }
      if (t.dataset.aveCat) { avCat = t.dataset.aveCat; return avPaint(); }
      if (t.dataset.aveStep) return avStep(+t.dataset.aveStep);
      if (t.dataset.aveOpt) { avState[avCat] = +t.dataset.aveOpt; return avPaint(); }
      if (t.dataset.aveRnd !== undefined) { C.FACE_PARTS.forEach((p) => (avState[p.id] = Math.floor(Math.random() * p.items.length))); return avPaint(); }
      if (t.dataset.aveSave !== undefined) { G.state.avatar = Object.assign({}, avState, { saved: true }); G.save(); box.remove(); avState = null; renderTop(); avatarInto($("pfAv"), G.state); toast("Aparência salva!", "gold"); }
    });
    avPaint();
  }
  window.addEventListener("keydown", (e) => { if (!$("avEdit")) return; if (e.key === "ArrowLeft") avStep(-1); else if (e.key === "ArrowRight") avStep(1); else if (e.key === "Escape") { $("avEdit").remove(); avState = null; } });

  // ---------- painéis ----------
  function renderTop() {
    { const d = document.querySelector("#btnMail .mail-dot"); if (d && G.state) d.style.display = G.mailPending() ? "" : "none"; } // v290: bolinha só com anexo para resgatar
    const s = G.state; if (!s) return;
    $("accName").textContent = s.name;
    avatarInto($("accAvatar"), s); // v392: aparência salva ou as iniciais
    $("accLevel").textContent = `Lv ${s.account.level}`;
    $("accXpBar").style.width = `${(s.account.xp / C.accountXpToNext(s.account.level)) * 100}%`;
    $("resGold").textContent = fmt(s.gold);
    $("resDiamonds").textContent = fmt(s.diamonds || 0);
    $("repeatToggle").checked = s.progress.repeat;
    $("gatoradeToggle").checked = !!s.vip && s.settings.autoGatorade;
    $("gatoradeToggle").disabled = !s.vip;
  }
  function renderObjective() {
    const s = G.state; if (!s) return;
    const pr = s.progress, map = G.map;
    $("objMap").textContent = `${map.name} · ${map.mode}${s.training ? " · TREINO" : ""}`;
    $("trainBtn").textContent = s.training ? "Sair do treino" : "Modo treino";
    $("trainBtn").classList.toggle("btn-hot", !!s.training);
    $("trainBtn").setAttribute("aria-pressed", s.training ? "true" : "false");
    const pick = G.canPickStage();
    $("objHint").hidden = !(pick || s.training);
    $("objHint").textContent = s.training
      ? (pick ? "Treinando. Escolha a fase em que vai jogar quando sair do treino." : "Treinando. Ao sair, você volta para a fase marcada.")
      : `Modo ${map.mode} zerado: clique numa fase para jogar nela.`;
    $("objStage").textContent = G.stageLabel();
    const span = (map.levelMax - map.levelMin + 1) / C.STAGES_PER_MAP;
    $("objLevels").textContent = G.isBoss() ? `BOSS · Nv ${map.boss.level}` : `Nv ${Math.round(map.levelMin + (pr.stage - 1) * span)}–${Math.round(map.levelMin + pr.stage * span - 1)}`;
    $("stages").innerHTML = Array.from({ length: C.STAGES_PER_MAP }, (_, i) => {
      const n = i + 1, boss = n === C.STAGES_PER_MAP && !!map.boss, pick = G.canPickStage(n); // v615
      const tag = pick ? "button" : "i";
      return `<${tag} ${pick ? `type="button" data-stage="${n}"` : ""} class="st ${pick ? "pick" : ""} ${n < pr.stage ? "done" : ""} ${n === pr.stage ? "now" : ""} ${boss ? "boss" : ""}" title="${boss ? `Boss: ${esc(BL.CHAR_BY_ID[map.boss.charId].name)}` : `Fase ${map.id}-${n}`}">${boss ? `<svg viewBox="0 0 24 18" aria-hidden="true"><path d="M2 16h20l1-11-6 5-5-8-5 8-6-5z" fill="currentColor"/></svg>` : n}</${tag}>`;
    }).join("");
    renderStageMap();
  }
  // ---------- mapa de fases (estilo trilha, deitado, com tema Blue Lock) ----------
  // 10 pontos ligados por uma trilha: fases 1 a 9 passam pelas alas de treino e a 10 é a arena do Boss.
  const SM_PTS = Array.from({ length: 10 }, (_, i) => ({ x: 13 + i * 8.6 + (i === 9 ? 1.3 : 0), y: 62 + Math.sin(i * 1.05 + 0.4) * 17 }));
  function stageMapArt() {
    const path = SM_PTS.map((p, i) => `${i ? "L" : "M"}${(p.x * 10).toFixed(1)} ${(p.y * 1.6).toFixed(1)}`).join(" ");
    const win = (x, y, cols, rows, w = 7, h = 5, gx = 4, gy = 4, c = "#26D9FF") => { let s = ""; for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) s += `<rect x="${x + k * (w + gx)}" y="${y + r * (h + gy)}" width="${w}" height="${h}" fill="${c}" opacity="${(0.25 + ((r * 7 + k * 3) % 5) * 0.15).toFixed(2)}"/>`; return s; };
    const pitch = (x, y, w, h) => `<g opacity=".55"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#0e3a24" stroke="#4fd68a" stroke-width="1"/><path d="M${x + w / 2} ${y}v${h}" stroke="#4fd68a" stroke-width="1"/><circle cx="${x + w / 2}" cy="${y + h / 2}" r="${h / 4}" fill="none" stroke="#4fd68a" stroke-width="1"/></g>`;
    const wing = (x, label) => `<g><rect x="${x}" y="22" width="78" height="30" rx="5" fill="#0f1d3d" stroke="#1a5fd6" stroke-width="1"/>${win(x + 7, 29, 6, 2, 6, 4, 5, 6)}<text x="${x + 39}" y="17" text-anchor="middle" class="sm-lbl">${label}</text></g>`;
    return `<svg class="sm-art" viewBox="0 0 1000 160" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="smSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1838"/><stop offset="1" stop-color="#050914"/></linearGradient>
        <radialGradient id="smBoss" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff3f5e" stop-opacity=".55"/><stop offset="1" stop-color="#ff3f5e" stop-opacity="0"/></radialGradient>
        <radialGradient id="smHub" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#146CFF" stop-opacity=".45"/><stop offset="1" stop-color="#146CFF" stop-opacity="0"/></radialGradient>
      </defs>
      <path d="${path}" fill="none" stroke="#000" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".45"/>
      <path d="${path}" fill="none" stroke="#e8eeff" stroke-width="2.4" stroke-dasharray="2 9" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>
    </svg>`;
  }
  function renderStageMap() {
    const el = $("stageMap"), s = G.state; if (!el || !s) return;
    if (!el.querySelector(".sm-inner")) { el.innerHTML = `<div class="sm-inner">${stageMapArt()}<div class="sm-nodes" id="smNodes"></div></div><div class="sm-head"><b id="smName"></b><span id="smZone"></span></div><div class="sm-boss" id="smBoss"></div>`; }
    const map = G.map, pr = s.progress, pick = G.canPickStage();
    $("smName").textContent = `Mapa - ${C.MAP_TITLES[s.progress.map] || map.name}`; // v185: só "Mapa - nome" (nomes provisórios em config)
    $("smZone").textContent = `Zona Nv ${map.levelMin}–${map.levelMax}`; // v115: só mapa, zona e fases (sem textos extras)
    $("smNodes").innerHTML = SM_PTS.map((p, i) => {
      const n = i + 1, boss = n === C.STAGES_PER_MAP && !!map.boss;
      const pick = G.canPickStage(n), st = n === pr.stage ? "now" : n < Math.max(pr.stage, pr.reach || 1) || (boss && G.mapCleared()) ? "done" : "lock"; // v615
      const play = s.training && (pick || n === pr.stage); // no treino, clicar na fase sai do treino e começa o farm
      const tag = pick || play ? "button" : "span";
      const inner = boss ? `<svg viewBox="0 0 24 18" aria-hidden="true"><path d="M2 16h20l1-11-6 5-5-8-5 8-6-5z" fill="currentColor"/></svg>` : st === "done" ? "✓" : n;
      const attr = play ? `type="button" data-play="${n}"` : pick ? `type="button" data-stage="${n}"` : "";
      return `<${tag} ${attr} class="sm-node ${st} ${boss ? "boss" : ""} ${play && n === pr.stage ? "go" : ""}" style="left:${p.x}%;top:${p.y}%" title="${boss ? "Boss" : "Fase"} ${map.id}-${n}">${inner}${n === pr.stage ? `<i class="sm-you">${s.training ? "JOGAR" : "VOCÊ"}</i>` : ""}</${tag}>`;
    }).join("");
  }

  // v361 (Mickey): arrastar um reserva até um titular marca a troca (vale no intervalo ou no fim da partida)
  let dragBench = null;
  // v377 (Mickey): arrastar um card do PC para a equipe ativa ou os reservas; quem estava lá volta para o PC
  let dragPc = null;
  // v434/v435: Meu time, arrastar (mouse ou dedo) um jogador para outra vaga troca os dois de posição
  let dragEq = null, eqNoClick = false;
  document.addEventListener("pointerdown", (ev) => { const b = ev.target.closest?.("[data-eq-drag],[data-eq-bdrag]"); if (!b || ev.button) return; dragEq = { i: b.dataset.eqDrag != null ? +b.dataset.eqDrag : -1, bench: b.dataset.eqBdrag || null, x: ev.clientX, y: ev.clientY, el: b, ghost: null }; }); // v462: reserva arrastado do Meu time
  document.addEventListener("pointermove", (ev) => {
    if (!dragEq) return;
    if (!dragEq.ghost) {
      if (Math.hypot(ev.clientX - dragEq.x, ev.clientY - dragEq.y) < 8) return;
      const f = dragEq.el.querySelector(".eq-fig"), g = document.createElement("div"); g.className = "eq-ghost";
      const src = f.querySelector("canvas"); if (src) { const c = document.createElement("canvas"); c.width = src.width; c.height = src.height; c.getContext("2d").drawImage(src, 0, 0); g.appendChild(c); } else g.innerHTML = f.innerHTML;
      document.body.appendChild(g); dragEq.ghost = g; dragEq.el.classList.add("dragging");
    }
    ev.preventDefault();
    dragEq.ghost.style.left = ev.clientX + "px"; dragEq.ghost.style.top = ev.clientY + "px";
    document.querySelectorAll(".eq-col.drop").forEach((c) => c.classList.remove("drop"));
    const c = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".eq-col"); if (c) c.classList.add("drop");
  });
  document.addEventListener("pointerup", (ev) => {
    if (!dragEq) return; const d = dragEq; dragEq = null;
    if (!d.ghost) return;
    d.ghost.remove(); eqNoClick = true; setTimeout(() => (eqNoClick = false), 0);
    const c = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".eq-col");
    if (c && d.bench) { const out = c.querySelector("[data-eq-pick]")?.dataset.eqPick; const r = out && G.queueSub(d.bench, out); if (r === "queued") toast("Troca marcada: vale no intervalo"); } // v462 (Mickey): reserva no lugar do titular
    else if (c) G.moveSlot(d.i, [...c.parentNode.children].indexOf(c));
    MODALS.equipe();
  });
  document.addEventListener("click", (ev) => { if (eqNoClick) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  let dragPin = null; // v455: arrastar posição no campo do Meu time
  document.addEventListener("pointerdown", (ev) => { const b = ev.target.closest?.("[data-eqb-pin]"); if (!b || ev.button) return; const [k, i] = b.dataset.eqbPin.split("|"); dragPin = { k, i: +i, el: b, pitch: b.closest("[data-eqb-pitch]") }; b.classList.add("dragging"); ev.preventDefault(); });
  const pinAt = (ev) => { const r = dragPin.pitch.getBoundingClientRect(); return [Math.min(0.95, Math.max(0.05, (ev.clientX - r.left) / r.width)), Math.min(0.92, Math.max(0.08, (ev.clientY - r.top) / r.height))]; };
  document.addEventListener("pointermove", (ev) => { if (!dragPin) return; const [x, y] = pinAt(ev); dragPin.el.style.left = x * 100 + "%"; dragPin.el.style.top = y * 100 + "%"; });
  document.addEventListener("pointerup", (ev) => { if (!dragPin) return; const [x, y] = pinAt(ev), d = dragPin; dragPin = null; d.el.classList.remove("dragging"); G.setPosShape(d.k, d.i, x, y); });
  document.addEventListener("dragstart", (ev) => { const b = ev.target.closest?.("[data-pc-drag]"); if (!b) return; dragPc = b.dataset.pcDrag; ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", dragPc); document.body.classList.add("pc-dragging"); });
  document.addEventListener("dragend", () => { if (!dragPc) return; dragPc = null; document.body.classList.remove("pc-dragging"); document.querySelectorAll(".pc-tm.drop-on, .pc-grid.drop-on").forEach((c) => c.classList.remove("drop-on")); });
  document.addEventListener("dragover", (ev) => { if (!dragPc) return; const c = ev.target.closest?.("[data-pc-drop]"); if (!c) return; ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; document.querySelectorAll(".pc-tm.drop-on, .pc-grid.drop-on").forEach((x) => x !== c && x.classList.remove("drop-on")); c.classList.add("drop-on"); });
  document.addEventListener("dragleave", (ev) => { if (!dragPc) return; const c = ev.target.closest?.("[data-pc-drop]"); if (c && !c.contains(ev.relatedTarget)) c.classList.remove("drop-on"); });
  document.addEventListener("drop", (ev) => {
    if (!dragPc) return; const c = ev.target.closest?.("[data-pc-drop]"); if (!c) return; ev.preventDefault();
    const uid = dragPc, p = G.player(uid), [k, v] = c.dataset.pcDrop.split("|"); dragPc = null; document.body.classList.remove("pc-dragging");
    if (!p) return;
    if (G.isAway(uid) || uid === G.expAway()) { toast(`${p.short || p.name} está fora (Expedição ou Boss).`); return; }
    // v436 (Mickey): ativos e reservas também arrastam: para o PC (saem), entre equipe e reservas e entre vagas
    const nm = p.short || p.name, team = G.lineup(), inTeam = team.includes(uid), bl = G.bench().map((x) => x.uid), bi = bl.indexOf(uid);
    // tirar um ativo com o time cheio: o jogo completaria a vaga sozinho, então entra o primeiro livre do PC no lugar dele
    const takeOut = (then) => {
      if (team.length < G.lineupLimit()) { if (team.length < 2) return toast("A equipe precisa de pelo menos 1 jogador."); G.removeFromLineup(uid); then && then(); return toast(`${nm} saiu da equipe`); }
      const rep = G.state.roster.find((x) => !team.includes(x.uid) && !bl.includes(x.uid) && !G.isAway(x.uid));
      if (!rep) return toast("Não há outro jogador livre no PC para entrar no lugar.");
      G.swapLineup(rep.uid, uid); then && then(); toast(`${nm} saiu; ${rep.short || rep.name} entrou no lugar`);
    };
    if (k === "g") {
      if (inTeam) takeOut();
      else if (bi >= 0) { G.setBench(bi, null); toast(`${nm} saiu dos reservas`); }
    } else if (k === "t") {
      if (v === uid) return;
      if (inTeam && v) G.moveSlot(team.indexOf(uid), team.indexOf(v));
      else if (bi >= 0 && v) { const r = G.queueSub(uid, v); toast(r === "queued" ? `${nm} entra no intervalo` : `${nm} entrou na equipe`); }
      else if (v) { G.swapLineup(uid, v); toast(`${nm} entrou na equipe`); }
      else if (!inTeam) { if (bi >= 0) G.setBench(bi, null); const r = G.addToLineup(uid); if (r.msg) toast(r.msg); else if (r.needSwap) toast("Equipe cheia: solte em cima de quem vai sair"); }
    } else {
      const tgt = bl[+v];
      if (tgt === uid) return;
      if (inTeam) {
        if (tgt) { const r = G.queueSub(tgt, uid); toast(r === "queued" ? "Troca marcada para o intervalo" : `${nm} foi para os reservas`); }
        else takeOut(() => G.setBench(+v, uid));
      } else if (bi >= 0) { const s = G.state; if (tgt) [s.bench[bi], s.bench[+v]] = [s.bench[+v], s.bench[bi]]; G.save(); G.emit("roster"); }
      else { G.setBench(+v, uid); toast(`${nm} foi para os reservas`); }
    }
    pcUi.sel = uid; MODALS.players();
  });
  document.addEventListener("dragstart", (ev) => { const b = ev.target.closest?.("[data-bench-uid]"); if (!b) return; dragBench = b.dataset.benchUid; ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", dragBench); document.body.classList.add("bench-dragging"); });
  document.addEventListener("dragend", () => { dragBench = null; document.body.classList.remove("bench-dragging"); document.querySelectorAll(".mini-card.drop-on").forEach((c) => c.classList.remove("drop-on")); });
  document.addEventListener("dragover", (ev) => { if (!dragBench) return; const c = ev.target.closest?.("#myTeam .mini-card"); if (!c) return; ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; document.querySelectorAll(".mini-card.drop-on").forEach((x) => x !== c && x.classList.remove("drop-on")); c.classList.add("drop-on"); });
  document.addEventListener("dragleave", (ev) => { const c = ev.target.closest?.("#myTeam .mini-card"); if (c && !c.contains(ev.relatedTarget)) c.classList.remove("drop-on"); });
  document.addEventListener("drop", (ev) => {
    if (!dragBench) return; const c = ev.target.closest?.("#myTeam .mini-card"); if (!c) return; ev.preventDefault();
    const res = G.queueSub(dragBench, c.dataset.ev);
    if (res === "queued") toast("Troca marcada: entra no intervalo ou na próxima partida");
    dragBench = null; document.body.classList.remove("bench-dragging"); renderMyTeam();
  });

  function renderMyTeam() {
    const s = G.state; if (!s) return;
    const m = G.match, onField = m && !m.training && m.state !== "ended" ? m.field(0).map((e) => e.p) : G.activePlayers();
    const outQ = (s.subQueue || []).map((x) => x.out);
    $("myTeam").innerHTML = onField.map((p) => miniCard(p, { heal: true, subOut: outQ.includes(p.uid) })).join(""); setBench("my", benchRow());
    renderTactic(); syncSides();
  }
  // v144: só alinha a dica do técnico com a Pausa tática (v143 esticava cada card e ficou ruim)
  let syncRaf = 0;
  function syncSides() {
    cancelAnimationFrame(syncRaf);
    syncRaf = requestAnimationFrame(() => {
      const myP = $("myTeam").closest(".panel"), enP = $("enemyCard").closest(".panel");
      const mine = [...$("myTeam").querySelectorAll(".mini-card")], theirs = [...$("enemyCard").querySelectorAll(".mini-card")];
      const tac = $("enemyCard").querySelector(".enemy-tac"), box = $("tacticBox");
      [enP, tac, box, ...theirs].forEach((el) => el && (el.style.minHeight = ""));
      if (window.matchMedia("(max-width: 1180px)").matches || !mine.length || !theirs.length) return;
      if (tac && box && !box.hidden) { const h = Math.max(tac.offsetHeight, box.offsetHeight) + "px"; tac.style.minHeight = h; box.style.minHeight = h; } // v156: o mais alto manda (a caixa da leitura pode ter 2 linhas)
    });
  }
  window.addEventListener("resize", syncSides);
  // Tática (1×1 a 3×3) ou formação (4×4): vale a partir da próxima partida
  function renderTactic() { // v140: a formação se escolhe no pré-jogo, na Pausa tática e no Vestiário; aqui fica só a Pausa tática
    const box = $("tacticBox"); if (!box) return;
    if (G.tactics().length < 2 || (G.state && G.state.training)) { box.hidden = true; return; } // v160: treino é jogo livre, sem formação
    box.hidden = false;
    box.innerHTML = `<button type="button" class="btn pause-btn" id="pauseBtn" data-pause="1">Pausa tática</button>`;
    refreshPause();
  }
  function tacticLabel(t) { return t ? `${t.name}${t.type ? " · " + C.FORMATION_TYPE[t.type] : ""}` : ""; }
  function renderEnemy() {
    if (G.state && G.state.training) {
      $("enemyTag").textContent = "Treino";
      setBench("enemy", "");
      if (G.match && G.match.scrimmage) { // v162: treino em dois times; o time B aparece aqui
        $("enemyCard").innerHTML = G.match.field(1).map((e) => miniCard(e.p, { heal: true })).join("") + `<div class="dev-row"><button type="button" class="btn btn-hot" data-open="trainPick">Escolher quem treina</button><button type="button" class="btn" data-train="0">Sair do treino</button></div>`; // v294: troca também com o time B cheio
        syncSides(); return;
      }
      $("enemyCard").innerHTML = `<div class="dev-row"><button type="button" class="btn btn-hot" data-open="trainPick">Escolher quem treina</button><button type="button" class="btn" data-train="0">Sair do treino</button></div>`;
      return;
    }
    const list = G.enemies.length ? G.enemies : G.enemy ? [G.enemy] : []; if (!list.length) return;
    const goals = G.match ? G.match.score[0] : 0;
    $("enemyTag").textContent = ""; // v153: Mickey tirou a fase do card do adversário
    const tac = G.map.size > 1 && G.enemyHint ? `<div class="enemy-tac"><span class="et-label">📋 Leitura do técnico</span><span class="et-text">${esc(G.enemyHint.charAt(0).toUpperCase() + G.enemyHint.slice(1))}</span></div>` : ""; // v137: formação deles escondida, só a leitura do técnico
    $("enemyCard").innerHTML = tac + list.map((e) => {
      const chance = BL.stealChance(e, G.state.progress.stage, goals);
      return miniCard(e, { noXp: true, hideRar: true /* v595 (Mickey): raridade do adversário escondida até roubar */, footer: `<div class="pc-xp steal-row"><span>Chance de roubo</span><b>${G.stealArmed() ? chance.toFixed(1).replace(".", ",") + "%" : "Sem Proposta"}</b></div>` });
    }).join(""); setBench("enemy", enemyBenchRow());
    syncSides();
  }
  function chestsHtml() { // v267: só os baús, divididos em comuns e raros
    const s = G.state, sec = (kind, title) => { const l = s.chests.filter((c) => (c.kind || "azul") === kind);
      return `<div class="esp-sec esp-${kind}"><h4>${title}<span>${l.length}</span>${l.length ? `<button type="button" class="esp-all" data-chest-all="${kind}">Abrir todos</button>` : ""}</h4><div class="chests">${l.length ? l.map((c) => `<button type="button" class="chest-btn" data-chest="${c.id}" aria-label="Abrir ${C.CHEST_KINDS[kind].name}">${chestArt(kind)}</button>`).join("") : `<span class="esp-empty">—</span>`}</div></div>`; };
    return sec("padrao", "Baús comuns") + sec("azul", "Baús raros") + sec("epico", "Baús épicos") + sec("lendario", "Baús lendários");
  }
  // v380 (Mickey): ao abrir baús, só itens raros para cima avisam, no canto da tela, por 2 s com fade (Web Animations: roda com "reduzir animações")
  function lootNotes(res) {
    const ord = C.RARITIES.map((r) => r.id), min = ord.indexOf(C.LOOT_NOTE_MIN);
    const good = (res || []).filter((r) => r && ord.indexOf(r.item.rarity) >= min).sort((a, b) => ord.indexOf(b.item.rarity) - ord.indexOf(a.item.rarity));
    const dr = {}; (res || []).forEach((r) => (r && r.drinks || []).forEach((d) => { dr[d] = (dr[d] || 0) + 1; })); // v522: bebidas de baú também avisam
    (res || []).forEach((r) => { if (r && r.sub) good.push({ sub: r.sub, item: { name: C.WC_FARM.crops[r.sub].name, rarity: C.WC_FARM.crops[r.sub].rarity } }); }); // v525: sub-item raro do baú
    (res || []).forEach((r) => { if (r && r.candy) good.unshift({ item: { id: "tp-nivel", name: `${r.candy > 1 ? r.candy + "× " : ""}Treino Particular`, rarity: "lendario" } }); }); /* v540 */
    (res || []).forEach((r) => { if (r && r.book) good.unshift({ item: { name: `Livro: ${r.book.name}${r.book.lv > 1 ? ` (Nv ${r.book.lv})` : ""}`, rarity: C.SKILL_DEF[r.book.id].rar } }); }); /* v623: livro de habilidade */
    (res || []).forEach((r) => { if (r && r.master) good.unshift({ item: { id: "pr-bluelock", name: C.SUPPLIES["pr-bluelock"].name, rarity: "lendario" } }); }); /* v533: Master Contract */
    Object.entries(dr).forEach(([d, n]) => good.push({ drink: d, n, item: { name: `${n > 1 ? n + "× " : ""}${C.CONSUMABLES[d].name}`, rarity: CONS_RAR[d] || "comum" } }));
    if (!good.length) return;
    let box = $("lootNotes"); if (!box) { box = document.createElement("div"); box.id = "lootNotes"; box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
    const show = good.slice(0, 5), extra = good.length - show.length;
    show.forEach((r, i) => {
      const rr = rar(r.item.rarity), el = document.createElement("div"); el.className = "loot-note"; el.style.setProperty("--rc", rr.color);
      el.innerHTML = `<i>${r.sub ? BL.wcArt(r.sub) : r.drink ? shopArt(r.drink, C.CONSUMABLES[r.drink].icon) : BL.itemSvg(r.item) || CH_SLOT_IC[r.item.slot] || "🎁"}</i><span><b>${esc(r.item.name)}</b><small>${rr.name}${i === show.length - 1 && extra > 0 ? ` · +${extra} itens raros` : ""}</small></span>`;
      box.appendChild(el);
      const a = el.animate([{ opacity: 0, transform: "translateX(24px)" }, { opacity: 1, transform: "none", offset: 0.15 }, { opacity: 1, transform: "none", offset: 0.82 }, { opacity: 0, transform: "translateX(24px)" }], { duration: 2400, delay: i * 120, easing: "ease-out", fill: "both" });
      a.onfinish = () => el.remove();
    });
  }
  // v381 (Mickey): Mochila no layout da ref (abas por categoria, grade, item escolhido em destaque à esquerda)
  const shopUi = { mode: "comprar", cat: "todos", sel: null, owned: false, q: "", qty: 1 }; const coachUi = { all: false }; // v424: caixinhas "Exibir habilitados" / "Exibir não habilitados" // v419: Loja (v420 sem aba Todos)
  const bagUi = { cat: "todos", q: "", rar: "", ord: "raridade", sel: null, who: null };
  // v475 (Mickey): Loja nova. Entradas de compra (energia, roubo, XP, equipamentos, treinador, técnicos) ou de venda (o que está na Mochila)
  const CONS_RAR = { agua: "comum", isotonico: "incomum", gatorade: "raro", suco: "comum", coco: "incomum", vitamina: "raro" };
  const SHOP_ART = ["agua", "isotonico", "gatorade", "suco", "coco", "vitamina", "pr-basica", "pr-forte", "pr-elite", "pr-bluelock", "cb-passe", "cb-chute", "cb-fisico", "cb-velocidade", "cb-defesa", "cb-drible"]; // v481 (Mickey): desenhos pixel art em img/loja
  // v489 (Mickey: emojis das abas pareciam de grupo de WhatsApp): abas com os desenhos do jogo
  const shopTabIc = (id, fb) => { const img = (src, c = "") => `<img class="${c}" src="${src}" alt="">`, it = { chuteira: "ch-bluelock", caneleira: "ca-aco", treinador: "tr-apito" }[id];
    if (id === "todos") return img("img/loja/menu/todos.png"); // v650: arte do Mickey (a mesma da Loja de Diamantes)
    if (id === "energia") return shopArt("gatorade"); if (id === "roubo") return shopArt("pr-elite"); if (id === "camisa") return shopArt("cb-passe"); if (id === "xp") return shopArt("pr-basica");
    if (id === "tecnicos") { const d = C.COACHES.find((x) => x.id === C.COACH_DEFAULT) || C.COACHES[0]; return d ? img(d.src, "shx-tav") : fb; }
    return it && BL.anyItem(it) ? BL.itemSvg(BL.anyItem(it)) : fb; };
  const shopArt = (id, fb) => BL.IT2[id] != null ? BL.it2Art(id) : SHOP_ART.includes(id) ? `<img class="shx-px" src="img/loja/${id}.png?v=${BL.BUILD}" alt="">` : BL.WC_SPR[id] != null ? BL.wcArt(id) : fb; // v525: contratos da Bancada
  const SUP_HOW = { energia: () => (C.HEAL_ONLY_HALFTIME ? `Use no intervalo da partida, no Vestiário. A Cura automática (VIP) usa sozinha durante a partida quando a energia cai abaixo de ${C.HEAL_AUTO_BELOW}.` : `Use no card do jogador durante a partida (${C.HEAL_COOLDOWN} s entre usos). A Cura automática (VIP) usa sozinha quando a energia cai abaixo de ${C.HEAL_AUTO_BELOW}.`), roubo: () => "Sem uma Proposta ou contrato equipado não dá para roubar. Equipe 1 aqui: fica equipado e gasta 1 a cada vitória em que você tenta o roubo, até acabar.", nivel: () => "Use na Mochila: o jogador escolhido sobe 1 nível na hora.", ficha: () => "Junte fichas da mesma cor e troque na Mochila por 1 equipamento daquela raridade.", xp: () => "Use na Mochila: escolha o jogador que recebe o XP." };
  function shopEntries() {
    const s = G.state, c = G.cons(), co = G.coach(), sell = shopUi.mode === "vender", out = [], inv = {};
    s.inventory.forEach((id) => { inv[id] = (inv[id] || 0) + 1; });
    const sup = (id, q, cat, rarity) => { const r = rar(rarity), have = c[id] || 0; if (sell && (!have || q.dia)) return;
      out.push({ key: (cat === "energia" ? "c:" : "s:") + id, kind: cat === "energia" ? "cons" : "sup", cat, id, name: q.name, icon: `<i>${shopArt(id, q.icon)}</i>`, rc: r.color, rname: r.name, tag: `${(C.BAG_CATS.find((b) => b.id === cat) || {}).name} · ${r.name}`, unit: sell ? G.sellPrice(id) : q.dia || q.cost, cur: q.dia && !sell ? "dia" : "gold", have, desc: q.desc, how: SUP_HOW[cat](), lore: q.lore, where: q.where, ri: C.RARITIES.findIndex((x) => x.id === rarity) }); };
    Object.entries(C.CONSUMABLES).forEach(([id, q]) => { if (sell || !q.chest) sup(id, q, "energia", CONS_RAR[id] || "comum"); }); // v522: bebida de baú só se vende
    Object.entries(C.SUPPLIES).forEach(([id, q]) => { if (q.wc || q.noShop) return; if (sell || (q.cat !== "xp" && !q.dia)) sup(id, q, q.cat, q.rarity); }); // v525: contrato da Bancada não se compra nem se vende // v478 (Mickey): bônus de XP sai da Loja de Gold (vai para a de Diamantes); v502: Contrato só na Loja de Diamantes
    BL.ITEMS.concat(BL.MGR_ITEMS).forEach((it) => { const r = rar(it.rarity), have = inv[it.id] || 0; if (sell ? !have : it.mgr || (it.slot === "camisa" ? !it.shop : it.slot === "chuteira" || it.slot === "caneleira")) return; // v479 (Mickey): na compra só camisas básicas; itens do treinador só caem nos baús // v478: item do treinador com XP também sai // v476/v477 (Mickey): chuteira e caneleira não se compram, só caem na partida (baús)
      out.push({ key: "q:" + it.id, kind: "item", cat: it.slot, id: it.id, name: it.name, icon: `<i>${shopArt(it.id, BL.itemSvg(it))}</i>`, rc: r.color, rname: r.name, tag: `${it.mgr ? "Treinador" : BL.ITEM_SLOTS[it.slot]} · ${r.name}`, unit: sell ? G.sellPrice(it.id) : G.itemPrice(it), cur: "gold", have, desc: itFx(it), lore: itLore(it), item: it, ri: C.RARITIES.findIndex((x) => x.id === it.rarity) }); });
    if (!sell) C.COACHES.filter((d) => d.id !== C.COACH_DEFAULT).forEach((d) => { const o = co.owned.includes(d.id), r = C.RARITIES[G.coachLv(d.id)];
      out.push({ key: "t:" + d.id, kind: "coach", cat: "tecnicos", id: d.id, name: d.name, icon: `<img src="${d.src}" alt="">`, rc: o ? r.color : "#7f8db3", rname: o ? r.name : "Na loja", tag: "Técnico", unit: C.COACH_PRICE, cur: "dia", have: o ? 1 : 0, desc: d.passive, d, o }); });
    return out;
  }
  function shopList(all) {
    const q = shopUi.q.trim().toLowerCase();
    return all.filter((x) => (shopUi.cat === "todos" ? x.kind !== "coach" : x.cat === shopUi.cat) && (shopUi.owned || !x.o) && (!q || x.name.toLowerCase().includes(q)));
  }
  const shopCur = (cur) => cur === "dia" ? `<i class="ic-dia"></i>` : `<i class="ic-coin"></i>`; // v650: diamante com a arte do jogo (img/menu/diamantes.png)
  const shopAb = (t) => { const AB = { PAS: "Passe", CHU: "Chute", FIS: "Físico", VEL: "Velocidade", DEF: "Defesa", DRI: "Drible" }; return String(t || "").replace(/\b(PAS|CHU|FIS|VEL|DEF|DRI)\b/g, (m) => AB[m]); }; // v650: nome do atributo por extenso
  const shopShort = (x) => { const t = shopAb(String(x.desc || "").replace(/\s+/g, " ").trim()); return t.length > 64 ? t.slice(0, 62).replace(/[\s,.;:]+\S*$/, "") + "…" : t; };
  function shopGridHtml(list) {
    if (!list.length) return `<p class="bg-empty">${shopUi.mode === "vender" ? "Nada desta categoria na Mochila." : "Nenhum item encontrado."}</p>`;
    const bal = (cur) => cur === "dia" ? G.state.diamonds || 0 : G.state.gold, sell = shopUi.mode === "vender";
    // v650 (Mickey: loja mais bonita e intuitiva): card com efeito curto, preço sem rótulo (vermelho se não dá para pagar), quantidade na mochila em selo; clicar no card abre os detalhes à esquerda
    return list.map((x) => { const poor = !sell && !(x.kind === "coach" && x.o) && bal(x.cur) < x.unit;
      return `<button type="button" class="bg-card shx-card v650 ${x.key === shopUi.sel ? "on" : ""} ${x.kind === "coach" ? "sh-coach" : ""} ${x.kind === "coach" && !x.o ? "lock" : ""} ${poor ? "poor" : ""}" data-shop-pick="${x.key}" style="--rc:${x.rc}"><span class="shx-tag">${esc(x.rname)}</span>${x.kind === "coach" ? (x.o ? `<span class="shx-n ok">✓</span>` : "") : x.have ? `<span class="shx-n" title="Na mochila">×${fmt(x.have)}</span>` : ""}<span class="bg-art">${x.icon}</span><b>${esc(x.name)}</b><span class="shx-fx">${esc(shopShort(x))}</span><span class="shx-pr">${x.kind === "coach" && x.o ? `<em class="shx-ok">Contratado</em>` : `${shopCur(x.cur)}<b class="${x.cur === "dia" ? "sh-dia" : "sh-gold"}">${fmt(x.unit)}</b>`}${poor ? `<small class="shx-poor">${x.cur === "dia" ? "Diamantes" : "Gold"} insuficiente</small>` : ""}</span></button>`; }).join("");
  }
  function shopMax(e) { return shopUi.mode === "vender" ? e.have : Math.min(C.SHOP_MAX_QTY, Math.floor((e.cur === "dia" ? G.state.diamonds || 0 : G.state.gold) / Math.max(1, e.unit))); }
  function shopQty(n, abs) {
    const e = shopEntries().find((x) => x.key === shopUi.sel); if (!e) return;
    const max = Math.max(1, shopMax(e)); shopUi.qty = Math.max(1, Math.min(max, abs ? n : (shopUi.qty || 1) + n));
    const i = $("shQty"), t = $("shTot"), bt = $("shBuyTot"); if (i) i.value = shopUi.qty; if (t) t.textContent = fmt(e.unit * shopUi.qty); if (bt) bt.textContent = fmt(e.unit * shopUi.qty);
  }
  function bagEntries() {
    const ord = C.RARITIES.map((r) => r.id), cnt = {}, out = [];
    G.state.inventory.forEach((id) => { cnt[id] = (cnt[id] || 0) + 1; });
    G.mgrEq().forEach((id) => { if (id && !(id in cnt)) cnt[id] = 0; }); // v473: item do treinador equipado aparece mesmo sem nenhum na mochila
    Object.keys(cnt).forEach((id) => { const it = BL.anyItem(id); if (!it) return;
      const bonus = itFx(it);
      out.push({ key: "i:" + id, id, kind: it.mgr ? "mgr" : "item", cat: it.slot, name: it.name, icon: shopArt(it.id, BL.itemSvg(it) || CH_SLOT_IC[it.slot] || "🎁"), rarity: it.rarity, n: cnt[id], eqN: it.mgr ? G.mgrEq().filter((x) => x === id).length : 0, eff: it.mgr ? bonus : `${BL.ITEM_SLOTS[it.slot] || "Personagem"} · ${bonus}`, short: bonus, desc: itLore(it) }); });
    const cons = G.cons();
    Object.entries(C.CONSUMABLES).forEach(([id, c]) => { if (cons[id] > 0) out.push({ key: "c:" + id, id, kind: "cons", cat: "energia", name: c.name, icon: shopArt(id, c.icon), rarity: CONS_RAR[id] || "comum", n: cons[id], eff: c.desc, short: c.desc }); });
    Object.entries(C.SUPPLIES).forEach(([id, q]) => { if (cons[id] > 0) out.push({ key: "s:" + id, id, kind: "sup", cat: q.cat, name: q.name, icon: shopArt(id, q.icon), rarity: q.rarity, n: cons[id], eff: q.desc, desc: q.lore, short: G.stealArmed() === id ? "Equipado para roubar" : q.desc }); }); // v475 (v480: lore)
    out.forEach((e) => { e.ri = ord.indexOf(e.rarity); });
    return out;
  }
  function bagList(all) {
    const q = bagUi.q.trim().toLowerCase(), key = { raridade: (e) => -e.ri, nome: (e) => e.name.toLowerCase(), qtd: (e) => -e.n }[bagUi.ord];
    return all.filter((e) => (bagUi.cat === "todos" || e.cat === bagUi.cat) && (!q || e.name.toLowerCase().includes(q)) && (!bagUi.rar || e.rarity === bagUi.rar))
      .sort((a, b) => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name); });
  }
  // v531 (Mickey): Forja = aba de criação da Mochila. Qualquer um troca fichas da Expedição por 1 equipamento aleatório da raridade
  function forgeHtml() {
    const c = G.cons();
    return `<p class="bg-forge-tip">Junte fichas na Expedição e forje 1 equipamento aleatório da raridade (chuteira, caneleira ou camisa).</p>` + Object.entries(C.FICHAS).map(([id, F]) => { const q = C.SUPPLIES[id], n = c[id] || 0, ok = n >= F.n, r = rar(F.rarity);
      return `<div class="bg-forge ${ok ? "ok" : ""}" style="--rc:${r.color}"><i>${shopArt(id, q.icon)}</i><b>${esc(q.name)}</b><small>${fmt(n)} / ${F.n}</small><span class="bg-forge-bar"><em style="width:${Math.min(100, n / F.n * 100)}%"></em></span>
        <p>1 equipamento <b style="color:${r.color}">${r.name}</b> aleatório${F.ci ? `<br>${String(F.ci * 100).replace(".", ",")}% de vir item de personagem` : ""}</p>
        <button type="button" class="bg-go" data-bag-ficha="${id}" ${ok ? "" : "disabled"}>${ok ? "Forjar" : `Faltam ${fmt(F.n - n)}`}</button></div>`; }).join("");
  }
  function bagGridHtml(all) {
    if (bagUi.cat === "forja") return forgeHtml();
    const l = bagList(all);
    if (!l.length) return `<p class="bg-empty">${bagUi.cat === "roubo" || bagUi.cat === "xp" ? "Nenhum item desta categoria. Compre na Loja." : "Nenhum item aqui. Os itens dos baús do Espólios e da Loja aparecem na Mochila."}</p>`;
    return l.map((e) => `<button type="button" class="bg-card ${e.key === bagUi.sel ? "on" : ""}" data-bag-pick="${e.key}" style="--rc:${rar(e.rarity).color}"><b>${esc(e.name)}</b><small>${esc((C.BAG_CATS.find((c) => c.id === e.cat) || {}).name || "")} · ${rar(e.rarity).name}</small><span class="bg-art"><i>${e.icon}</i></span><span class="bg-qty">${e.eqN ? `Equipado <em>× ${e.eqN}</em>${e.n ? ` · Mochila <em>× ${fmt(e.n)}</em>` : ""}` : `Na mochila <em>× ${fmt(e.n)}</em>`}</span><span class="bg-desc">${esc(e.short)}</span></button>`).join("");
  }
  function bagLeftHtml(e) {
    if (!e) return `<div class="bg-left-empty"><i>🎒</i><p>Escolha um item para ver os detalhes.</p></div>`;
    const r = rar(e.rarity), cat = C.BAG_CATS.find((c) => c.id === e.cat) || {};
    let act;
    if (e.kind === "item") {
      const ci = BL.ITEM_BY_ID[e.id].ci, ros = G.state.roster.filter((p) => !ci || BL.charItemOk(p, BL.ITEM_BY_ID[e.id])).sort((a, b) => BL.power(b) - BL.power(a)); if (!bagUi.who || !ros.some((p) => p.uid === bagUi.who)) bagUi.who = (ros.find((p) => G.activePlayers().includes(p)) || ros[0] || {}).uid; // v527: item de personagem só no dono Épico+
      const who = G.player(bagUi.who), cur = who && who.items[BL.ITEM_BY_ID[e.id].slot];
      // v694 (Mickey): escolher o jogador em quadradinhos; bolinha verde = já tem item equipado; embaixo, os itens dele com Retirar
      const hasIt = (p) => Object.values(p.items || {}).some(Boolean), eqs = who ? Object.entries(who.items || {}).filter(([, id]) => id && BL.ITEM_BY_ID[id]) : [];
      act = `<div class="bg-box"><small class="bg-k">Equipar em quem?</small><div class="bg-pls">${ros.map((p) => `<button type="button" class="bg-pl${p.uid === bagUi.who ? " on" : ""}" data-bag-whob="${p.uid}" title="${esc(p.name)} · Nv ${p.level}${hasIt(p) ? " · tem item equipado" : ""}">${tok(p.charId, p.initials, rar(p.rarity).color)}${hasIt(p) ? `<i class="eq-dot" aria-label="Tem item equipado"></i>` : ""}<small>${esc(p.short || p.name)}</small></button>`).join("")}</div>
        <p class="bg-leg"><i class="eq-dot"></i> bolinha verde = já tem item equipado</p>
        <p>${cur ? `${esc(who.short)} hoje usa: <b>${esc(BL.ITEM_BY_ID[cur].name)}</b> (volta para a mochila)` : `${BL.ITEM_SLOTS[BL.ITEM_BY_ID[e.id].slot] || "Espaço de personagem"} de ${esc(who ? who.short : "")} livre`}</p></div>
        <button type="button" class="bg-go" data-bag-equip="${e.id}">Equipar em ${esc(who ? who.short : "jogador")}</button>
        ${eqs.length ? `<div class="bg-box"><small class="bg-k">Itens em ${esc(who.short)}</small>${eqs.map(([k, id]) => `<div class="bg-unq"><span><b>${esc(BL.ITEM_BY_ID[id].name)}</b><small>${BL.ITEM_SLOTS[k] || "Personagem"}</small></span><button type="button" class="btn" data-bag-unq="${who.uid}|${k}">Retirar</button></div>`).join("")}</div>` : ""}`;
      if (ci && !ros.length) act = `<div class="bg-box"><small class="bg-k">Status</small><p>Só ${esc(BL.ITEM_BY_ID[e.id].who)} de raridade Épica ou acima pode usar. Você ainda não tem esse jogador.</p></div>`;
    } else if (e.kind === "mgr") { // v473: espaços do treinador
      const eq = G.mgrEq(), fx = G.mgrFx(), tot = Object.entries(fx).map(([k, v]) => BL.mgrFxTxt(k, v)).join(" · ") || "nenhum bônus";
      act = `<div class="bg-box"><small class="bg-k">Treinador · ${esc(tot)}</small>${C.MGR_CONSUME ? `<p>Cada item equipado vale por 1 partida: jogou, gastou. Se houver outro igual na Mochila, ele entra sozinho no lugar.</p>` : ""}<div class="bg-mgr">${eq.map((id, i) => { const q = BL.MGR_BY_ID[id];
        return `<div class="bg-mslot" style="--rc:${q ? rar(q.rarity).color : "#3a4570"}"><span class="bg-mart">${q ? BL.itemSvg(q) : ""}</span><b>${q ? esc(q.name) : `Espaço ${i + 1} livre`}</b>${q ? `<button type="button" class="pc-x" data-mgr-un="${i}" aria-label="Tirar">✕</button>` : ""}${e.n ? `<button type="button" class="bg-mput" data-mgr-eq="${e.id}|${i}">${q ? "Trocar" : "Equipar"}</button>` : ""}</div>`; }).join("")}</div></div>`;
    } else if (e.kind === "sup" && e.cat === "roubo") { const on = G.stealArmed() === e.id; // v526: 1 espaço só (Proposta ou contrato) // v475
      act = `<div class="bg-box"><small class="bg-k">Status</small><p>${on ? `Equipado: gasta 1 a cada vitória em que você tenta o roubo. Restam ${e.n}.` : SUP_HOW.roubo()}</p></div><button type="button" class="bg-go ${on ? "alt" : ""}" data-bag-arm="${e.id}">${on ? "Tirar" : "Equipar para roubar"}</button>`;
    } else if (e.kind === "sup" && e.cat === "ficha") { const F = C.FICHAS[e.id], ok = e.n >= F.n; // v527
      act = `<div class="bg-box"><small class="bg-k">Troca</small><p>${e.n} de ${F.n} fichas. ${ok ? `Troque por 1 equipamento ${rar(F.rarity).name} aleatório.` : `Faltam ${F.n - e.n}.`}${F.ci ? ` ${String(F.ci * 100).replace(".", ",")}% de chance de vir um item de personagem.` : ""}</p></div><button type="button" class="bg-go" data-bag-ficha="${e.id}" ${ok ? "" : "disabled"}>Trocar ${F.n} fichas</button>`;
    } else if (e.kind === "sup") { const lvIt = e.cat === "nivel"; // v527: Treino Particular usa o mesmo seletor de jogador do XP
      const ros = G.state.roster.slice().sort((a, b) => BL.power(b) - BL.power(a)); if (!bagUi.who || !ros.some((p) => p.uid === bagUi.who)) bagUi.who = (G.activePlayers()[0] || ros[0] || {}).uid;
      const who = G.player(bagUi.who);
      act = `<div class="bg-box"><small class="bg-k">Jogador</small><label class="pc-sel bg-who"><select data-bag-who aria-label="Jogador">${ros.map((p) => `<option value="${p.uid}" ${p.uid === bagUi.who ? "selected" : ""}>${esc(p.short || p.name)} · Nv ${p.level}</option>`).join("")}</select></label>${who ? `<p>${lvIt ? `Nv ${who.level} → ${Math.min(C.PLAYER_MAX_LEVEL, who.level + 1)}` : `XP: ${fmt(who.xp)} / ${fmt(C.playerXpToNext(who.level))}`}</p>` : ""}</div><button type="button" class="bg-go" ${lvIt ? "data-bag-lvl" : "data-bag-xp"}="${e.id}">Usar no jogador</button>`;
    } else act = `<div class="bg-box"><small class="bg-k">Status</small><p>Use no card do jogador durante a partida (${C.HEAL_COOLDOWN} s entre usos).</p></div>${C.CONSUMABLES[e.id] && C.CONSUMABLES[e.id].chest ? `<p class="bg-go-note">Só cai dos baús. Na Cura automática é usada antes das bebidas da Loja.</p>` : `<button type="button" class="bg-go" data-open="loja">Comprar na Loja</button>`}`; // v522: bebida de baú não se compra
    return `<small class="bg-k c">${esc(cat.name || "")}</small><h4 class="bg-name">${esc(e.name)}</h4><div class="bg-have"><small>Na mochila</small><b>× ${fmt(e.n)}</b></div>
      <div class="bg-stage" style="--rc:${r.color}"><i>${e.icon}</i><span class="bg-rar">${r.name}</span></div>
      <div class="bg-box"><small class="bg-k">Efeito</small><p>${esc(e.eff)}</p>${e.desc ? `<p class="bg-lore">${esc(e.desc)}</p>` : ""}</div>${act}`;
  }
  // v382 (Mickey): Espólios no mesmo estilo da Mochila (abas por tipo de baú, grade, baú em destaque à esquerda)
  const CH_ORDER = ["lendario", "epico", "azul", "padrao"], CH_TAB = { padrao: "Comuns", azul: "Raros", epico: "Épicos", lendario: "Lendários" };
  const CH_COLOR = { padrao: "#e8eeff", azul: "#3f9bff", epico: "#b06bff", lendario: "#ffb02e" };
  const espUi = { cat: "todos", sel: null };
  const ESB = { lendario: 0, epico: 1, azul: 2, padrao: 3 }, esChest = (k) => `<i class="esb" style="background:url('img/baus/bau-${CH_PAL[k] ? k : "padrao"}.png?v=${BL.BUILD}') center / contain no-repeat" aria-hidden="true"></i>`; // v692: baú 3D (img/baus/), o mesmo da animação de abrir; // v666 (Mickey): baús da arte dele (img/baus.png)
  const espCount = (k) => G.state.chests.filter((c) => (c.kind || "azul") === k).length;
  function espLeftHtml(k) {
    const K = C.CHEST_KINDS[k], n = espCount(k), tot = Object.values(K.weights).reduce((a, b) => a + b, 0);
    const odds = Object.entries(K.weights).filter(([, w]) => w > 0).map(([r, w]) => { const rr = rar(r), pct = (w / tot) * 100;
      return `<div class="es-odd" style="--rc:${rr.color}"><span>${rr.name}</span><i><b style="width:${pct}%"></b></i><em>${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%</em></div>`; }).join("");
    return `<small class="bg-k c">Espólios</small><h4 class="bg-name">${K.name}</h4><div class="bg-have"><small>Guardados</small><b>× ${fmt(n)}</b></div>
      <div class="bg-stage es-stage" style="--rc:${CH_COLOR[k]}"><i class="es-ring"></i>${esChest(k, true)}<span class="bg-rar">${CH_TAB[k].replace(/s$/, "")}</span></div>
      <div class="bg-box"><small class="bg-k">Recompensa</small><p>1 item + ${K.gold[0]} a ${K.gold[1]} Gold</p><div class="es-odds">${odds}</div></div>
      ${C.CHEST_PITY ? (() => { const N = C.CHEST_PITY.lendario, v = Math.min(N, G.state.chestPity || 0); return `<div class="bg-box"><small class="bg-k">Sorte do Baú Lendário</small><div class="es-odd" style="--rc:#ffd23f" title="Ao completar, o próximo baú que você ganhar vira Lendário"><span>${v}/${N} baús</span><i><b style="width:${(v / N) * 100}%"></b></i><em>${Math.round((v / N) * 100)}%</em></div></div>`; })() : ""}
      <div class="es-acts"><button type="button" class="bg-go es-one" data-esp-open="${k}" ${n ? "" : "disabled"}>Abrir 1</button><button type="button" class="bg-go" data-chest-all="${k}" ${n ? "" : "disabled"}>Abrir todos</button></div>`;
  }
  function bagRegrid() { const all = bagEntries(), g = $("bagGrid"); if (g) g.innerHTML = bagGridHtml(all); }
  function renderChests() {
    const s = G.state; if (!s) return;
    if ($("railChests")) $("railChests").textContent = s.chests.length;
    if ($("railBag")) $("railBag").textContent = s.inventory.length;
    misBadge();
    if (floats.chests) refreshFloats();
  }
  // v534 (Mickey): selo da Missões no trilho: "!" dourado quando dá para resgatar, senão N/total
  function misBadge() { const el = $("railMis"); if (!el || !G.state) return; const q = G.misCur(), ok = G.misReady(); el.textContent = !q ? "✓" : ok ? "!" : `${q.ch + 1}/${C.CHAPTERS.length}`; /* v537: capítulo atual */ el.classList.toggle("gold", ok || !q); }
  function renderLog() {
    if (!$("log")) return; // painel Lance a lance removido a pedido
    $("log").innerHTML = G.log.slice(0, 40).map((l) => `<li class="${l.kind}"><em>${l.minute === "" ? "" : esc(l.minute) + (l.minute === "GG" ? "" : "'")}</em><span>${esc(l.text)}</span></li>`).join("");
  }
  // v563 (Mickey) · X1: stack de estilo de cada time ao lado do placar, subindo a cada ganho
  const stkLast = [0, 0];
  function renderStack() {
    const m = G.match, on = !!(m && m.x1 && m.x1());
    ["stkA", "stkB"].forEach((id, t) => {
      const el = $(id); if (!el) return;
      const k = on && m.stack ? m.stack[t] || 0 : 0;
      el.hidden = !on;
      if (!on) { stkLast[t] = 0; return; }
      if (k === stkLast[t] && el.dataset.k === k + (m.golden ? "g" : "")) return; // v565: no gol de ouro o texto muda
      const v = m.goalValue(t), need = m.golden ? 0 : C.X1.style.shotMin;
      el.dataset.k = k + (m.golden ? "g" : ""); el.classList.toggle("hot", v > 1); el.classList.toggle("ok", k >= need);
      el.innerHTML = `<b>★ ${k}</b><small>${v > 1 ? `GOL x${v}` : k >= need ? "CHUTE LIBERADO" : `${need - k} P/ CHUTAR`}</small>`;
      if (k > stkLast[t]) { el.classList.remove("up"); void el.offsetWidth; el.classList.add("up"); }
      stkLast[t] = k;
    });
  }
  setInterval(renderStack, 120);
  function renderScore() {
    const m = G.match; if (!m) return;
    $("sbScore").textContent = `${m.score[0]} × ${m.score[1]}`;
    const clock = m.training || m.scrimmage ? "TREINO LIVRE" : m.golden ? "GOLDEN GOL" : m.state === "halftime" ? "INTERVALO" : m.state === "ended" ? "FIM DE JOGO" : `${m.half}º TEMPO · ${m.minute()}'`;
    $("sbClock").textContent = !m.training && G.state.matchNo ? `#${G.state.matchNo} · ${clock}` : clock; // v134: número da partida
    const pct = m.possessionPct();
    $("possA").style.width = Math.max(14, Math.min(86, pct)) + "%";
    $("possApct").textContent = pct + "%"; $("possBpct").textContent = 100 - pct + "%";
    $("possA").classList.toggle("lead", pct > 50); $("possB").classList.toggle("lead", pct < 50);
  }
  function token(p, cls = "") {
    return tok(p.charId, p.initials, "", `${cls} ${p.shiny ? "shiny" : ""}`);
  }
  // v170 · 4 slots de habilidade (no lugar da Equipe). Em CD o ícone fica cinza e um "relógio" gira até voltar à cor
  // v623 · barra de baixo: as habilidades dos seus jogadores em campo; na partida mostra a recarga real (relógio cinza girando)
  function skBar() { // v638: os 4 slots do time (state.skills); na partida, a recarga real do time
    const m = G.match, live = m && !m.training && !m.scrimmage && m.skTeamL && m.state !== "ended" ? m.skTeamL(0) : null, Lb = G.skLib();
    return G.skillSlots().map((x) => { if (!x || !BL.SKILLS[x.id] || !Lb[x.id]) return null; const s = live && live.find((q) => q.id === x.id); return { id: x.id, lv: Lb[x.id].lv, cd: s ? s.cd : 0, max: s ? s.cdMax : 1 }; });
  }
  function renderSkills() {
    const L = skBar(), n = C.SKILL_SLOTS, nOn = L.filter(Boolean).length;
    const key = L.map((x) => `${x ? `${x.id}:${Math.ceil(x.cd)}` : "-"}:${x ? Math.round((x.cd / x.max) * 36) : 0}`).join(",");
    if (key === renderSkills.key) return;
    renderSkills.key = key;
    $("dockSkillCount").textContent = `${nOn}/${n}`;
    $("dockSkills").innerHTML = Array.from({ length: n }, (_, i) => {
      const x = L[i], sk = x && BL.SKILLS[x.id], cd = x && x.cd > 0.05;
      const clock = cd ? `<span class="sk-clock" style="--sk-a:${((1 - x.cd / x.max) * 360).toFixed(1)}deg"></span><b class="sk-sec">${Math.ceil(x.cd)}</b>` : "";
      const title = sk ? `${sk.name} · ${sk.desc}` : "Slot vazio: escolha as habilidades do time no botão Habilidades";
      return `<div class="sk"><button type="button" class="sk-slot ${sk ? "" : "empty"} ${cd ? "cd" : ""}" data-sk="${i}" title="${esc(title)}" ${sk ? `style="--sk-c:${C.SKILL_RAR_COL[sk.rar]}"` : ""}><span class="sk-icon">${sk ? skIco(x.id, 48) : "+"}</span>${clock}</button><span class="sk-lv">${sk ? `Nv ${x.lv}` : "Vazio"}</span></div>`;
    }).join("");
  }
  function tickSkills() { renderSkills(); }
  setInterval(() => { if (G.state) tickSkills(); }, 200);
  function renderDock() {
    const s = G.state; if (!s) return;
    // v118 · card do técnico (sprite placeholder com iniciais, nome, raridade, nacionalidade e XP da conta)
    const co = G.coach(), cr = C.RARITIES[G.coachLv(co.id)] || rar(co.rarity), nat = C.COACH_NATIONS.find((n) => n.id === co.nation) || { id: co.nation, name: co.nation };
    const axNeed = C.accountXpToNext(s.account.level);
    const cd = G.coachDef(); // v416 (Mickey): técnico pronto com retrato em fundo branco; o card inteiro abre a escolha
    $("dockLead").innerHTML = `<button type="button" class="coach-card" data-open="coach" title="Trocar de técnico">${cd ? `<span class="coach-face"><img src="${cd.src}" alt=""></span>` : `<span class="token big coach-sprite" style="background:${cr.color}">${esc((co.first[0] + co.last[0]).toUpperCase())}</span>`}<div class="lead-info coach-info"><small class="coach-k">Técnico</small><b>${esc(cd ? cd.name : co.first + " " + co.last)}</b>
      <div class="coach-meta"><span class="chip" style="color:${cr.color}">${cr.name}</span><span class="coach-nat"><i>${esc(nat.id)}</i>${esc(nat.name)}</span></div>
      <div class="mini" title="${fmt(s.account.xp)}/${fmt(axNeed)} XP"><span>Nv ${s.account.level}</span><span class="bar"><i style="width:${(s.account.xp / axNeed) * 100}%"></i></span></div></div></button>`; // v182: só a barra de XP (números no title)
    renderSkills();
    const map = G.map, pr = s.progress, span = (map.levelMax - map.levelMin + 1) / C.STAGES_PER_MAP;
    $("dockMapName").textContent = C.MAP_TITLES[s.progress.map] || map.name; // v187: só o nome do mapa (sem "Mapa N") e sem o modo
    $("dockMapStage").textContent = `Fase ${G.stageLabel()}`;
    const dl = C.DIFFICULTIES[G.diff()].levels; // v271: a zona soma os níveis da dificuldade
    $("dockMapZone").textContent = G.isBoss() ? `Boss · Nv ${map.boss.level + dl}` : `Zona Nv ${Math.round(map.levelMin + (pr.stage - 1) * span) + dl}–${Math.round(map.levelMin + pr.stage * span - 1) + dl}`;
    // v271: fundo = o campo atual (estádio; na fase do Boss com a cor da arena) e relógio do usuário
    const dm = document.querySelector(".dock-map"), ar = G.isBoss() && map.boss && map.boss.arena;
    dm.style.setProperty("--dm-tint", ar ? ar.tint : "transparent");
    const pimg = ar ? "img/campo.jpg" : (C.PITCHES.find((x) => x.id === G.pitchId()) || {}).img || "img/campo.jpg"; dm.style.setProperty("--dm-img", `url("${new URL(pimg, document.baseURI).href}")`); // url absoluta: relativa ela seria lida a partir de css/ // v312: fundo = campo escolhido
    if (s.training) { $("dockMapName").textContent = "Modo treino"; } // v273: no treino o card mostra só "Modo treino"
    $("dockMapStage").hidden = $("dockMapZone").hidden = !!s.training;
    document.querySelector(".dock-map").classList.toggle("dm-train", !!s.training); // v275: faixa preta embaixo no treino
    $("dockMapClock").textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    $("chatBadge").textContent = chatUnread ? String(chatUnread) : "";
  }

  // ---------- chat (visual por enquanto: as mensagens ficam só neste navegador) ----------
  const CHAT_SAMPLE = [
    { who: "Nagi_fan", text: "alguém já roubou um Despertado?" },
    { who: "egoista99", text: "Barou na 1-10 tá impossível kkkk" },
    { who: "BachiraMain", text: "farmando 1-3 no 4× pra subir nível" },
  ];
  let chatMsgs = CHAT_SAMPLE.slice(), chatUnread = CHAT_SAMPLE.length;
  // v314 · chat em painel preso acima do botão Chat (ref do Mickey): abas, hora, campo de envio. Só neste navegador até existir servidor
  const CHAT_TABS = [["global", "Global"], ["local", "Local"], ["trocas", "Trocas"], ["sussurro", "Sussurro"]];
  let chatTab = "global";
  const hhmm = (t) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  chatMsgs.forEach((m, i) => { m.t = m.t || Date.now() - (chatMsgs.length - i) * 60000; m.tab = m.tab || "global"; });
  function placeChat() {
    const pop = $("chatPop"), btn = document.querySelector(".dock-chat"); if (!pop || !btn) return;
    const r = btn.getBoundingClientRect(), w = Math.min(440, innerWidth - 16);
    pop.style.width = w + "px";
    pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + "px";
    pop.style.bottom = Math.max(8, innerHeight - r.top + 8) + "px";
  }
  function renderChat() {
    const pop = $("chatPop"); if (!pop) return;
    const list = chatMsgs.filter((m) => m.tab === chatTab);
    pop.querySelector(".cp-tabs").innerHTML = CHAT_TABS.map(([k, n]) => `<button type="button" class="${k === chatTab ? "on" : ""}" data-chat-tab="${k}">${n}</button>`).join("");
    const log = pop.querySelector(".cp-log");
    log.innerHTML = list.length ? list.map((m) => `<li class="${m.me ? "me" : ""}"><time>[${hhmm(m.t)}]</time> ${m.me && G.state.vip ? `<span class="cp-vip">VIP</span> ` : ""}<b>${esc(m.who)}:</b> ${esc(m.text)}</li>`).join("") : `<li class="cp-empty">Nenhuma mensagem nesta aba ainda.</li>`;
    log.scrollTop = 1e6;
  }
  function toggleChat(force) {
    let pop = $("chatPop");
    const open = force ?? !pop;
    if (!open) { pop?.remove(); document.querySelector(".dock-chat")?.classList.remove("on"); return; }
    if (!pop) {
      pop = document.createElement("section"); pop.id = "chatPop"; pop.className = "chat-pop"; pop.setAttribute("aria-label", "Chat");
      pop.innerHTML = `<header class="cp-h"><h3>Chat <small>Treinadores</small></h3><span class="cp-on">● Online</span><button type="button" class="cp-x" data-chat-close aria-label="Fechar chat">✕</button></header>
        <nav class="cp-tabs"></nav><ol class="cp-log"></ol>
        <form class="cp-form"><input type="text" maxlength="140" placeholder="Pressione Enter para falar..." autocomplete="off"><button type="submit">Enviar</button></form>
        <p class="cp-note">Prévia: por enquanto as mensagens ficam só neste navegador.</p>`;
      document.body.appendChild(pop);
      const inp = pop.querySelector("input");
      pop.querySelector("form").onsubmit = (e) => { e.preventDefault(); const v = inp.value.trim(); if (!v) return; chatMsgs.push({ who: G.state.name, text: v, me: true, t: Date.now(), tab: chatTab }); inp.value = ""; renderChat(); };
      pop.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.chatTab) { chatTab = b.dataset.chatTab; renderChat(); } if (b.dataset.chatClose !== undefined) toggleChat(false); e.stopPropagation(); });
    }
    chatUnread = 0; renderDock(); document.querySelector(".dock-chat")?.classList.add("on");
    renderChat(); placeChat(); pop.querySelector("input").focus();
  }
  window.addEventListener("resize", placeChat);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("chatPop")) toggleChat(false); });


  function renderAll() { renderDock(); renderTop(); renderObjective(); renderMyTeam(); renderEnemy(); renderChests(); renderLog(); renderScore(); renderWildcard(); }

  function toast(text, cls = "") {
    const el = document.createElement("div");
    el.className = "toast " + cls; el.textContent = text;
    $("toasts").appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  // ---------- modais ----------
  // O painel Fase mora escondido em #faseHome e é emprestado pelo pop-up Mapas
  const faseHome = () => { const w = $("wcPanel"); if (w && w.parentElement.id !== "wcHome") $("wcHome").appendChild(w); // v146: a telinha do Wildcard mora em #wcHome e aparece dentro do pop-up Wildcard
    const p = document.querySelector(".panel-fase"); if (p && p.parentElement.id !== "faseHome") $("faseHome").appendChild(p); };
  // Durante a roleta do jogador inicial nada fecha nem abre por cima: só o "Bora jogar!" continua
  let rouletteLock = false;
  // v158 · Expedição: seleção da tela e textos de tempo
  const expSel = { lvl: null, dur: null, uid: null, page: null };
  const durTxt = (min) => (min < 60 ? `${min} min` : `${min / 60} hora${min > 60 ? "s" : ""}`);
  // v168: chance de cada recompensa por sprite (equipamento, Água, Gatorade); o nome fica no tooltip
  const expLoot = (d, m = 1) => [["👟", "Equipamento (chuteira, caneleira ou acessório)", Math.min(0.98, d.item * m)], [C.CONSUMABLES.agua.icon, C.CONSUMABLES.agua.name, Math.min(0.98, d.cons * m) * 0.7], [C.CONSUMABLES.gatorade.icon, C.CONSUMABLES.gatorade.name, Math.min(0.98, d.cons * m) * 0.3]]
    .map(([ico, name, ch]) => `<span class="ex-lt" title="${name}: ${Math.round(ch * 100)}%"><span>${ico}</span><small>${Math.round(ch * 100)}%</small></span>`).join("");
  function expLeft(end) { const t = Math.max(0, Math.ceil((end - Date.now()) / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60; return `${h ? `${h}h ` : ""}${m}min ${String(sec).padStart(2, "0")}s`; }
  const BETA_TAG = { "Líderes": "Beta · em teste", "Casa de Leilões": "Beta · em teste", "Comprar Diamantes": "Beta · Pix em breve" }; // v680: selo nas telas que ainda não são entre pessoas reais
  function openModal(title, html) { if (rouletteLock) return; faseHome(); $("modalTitle").textContent = title; $("modalBody").innerHTML = html; if (BETA_TAG[title]) { const h = $("modalBody").querySelector("h2, h3") || $("modalTitle"); h.insertAdjacentHTML("beforeend", `<i class="beta-tag">${BETA_TAG[title]}</i>`); } /* v680 */ $("modal").hidden = false; currentModal = title; $("modal").classList.toggle("modal-eq", title === "Meu time" || title === "PC do treinador" || title === "Técnicos" || title === "Central do treinador" || title === "Vestiário" || title === "Perfil" || title === "Comprar Diamantes" || title === "Correio" || title === "Modo Soneca" || title === "Escolher quem treina" || title === "Reservas" || title === "Seus mapas" || title === "Mochila" || title === "Espólios" || title === "Loja" || title === "Recompensa diária" || title === "Loja de Diamantes" || title === "Casa de Leilões" || title === "Líderes"); $("modal").classList.toggle("modal-bag", title === "Mochila" || title === "Espólios" || title === "Loja" || title === "Recompensa diária" || title === "Casa de Leilões" || title === "Líderes"); $("modal").classList.toggle("modal-dx", title === "Loja de Diamantes"); $("modal").classList.toggle("modal-bn", title === "Reservas"); $("modal").classList.toggle("modal-sm", title === "Seus mapas"); $("modal").classList.toggle("modal-tp", title === "Escolher quem treina"); $("modal").classList.toggle("modal-evw", / · (EV e status|Status)$/.test(title)); $("modal").classList.toggle("modal-sleep", title === "Modo Soneca"); $("modal").classList.toggle("modal-mail", title === "Correio"); $("modal").classList.toggle("modal-dm", title === "Comprar Diamantes"); $("modal").classList.toggle("modal-prof", title === "Perfil"); $("modal").classList.toggle("modal-vest", title === "Vestiário"); $("modal").classList.toggle("modal-hub", title === "Central do treinador"); $("modal").classList.toggle("modal-pc", title === "PC do treinador" || title === "Técnicos"); $("modal").classList.toggle("modal-wide", title === "Expedição" || title === "Chefes e Raids" || title === "Recompensa diária" || title === "Missões"); }
  function closeModal() { if (rouletteLock) return; if (currentModal === "Escolher quem treina") trUi.a = null; if (currentModal === "Pausa tática") G.resumePause(); if (currentModal === "Vestiário" && G.vest) { currentModal = null; G.vestEnd(); } faseHome(); $("modal").hidden = true; currentModal = null; swapIn = null; }
  let currentModal = null;
  let bossTab = "world", bossChest = null, bossRk = null;
  const bossShake = () => { document.body.classList.remove("bo-shake"); void document.body.offsetWidth; document.body.classList.add("bo-shake"); setTimeout(() => document.body.classList.remove("bo-shake"), 900); };
  const BOSS_HOLD = { name: "Yoichi Isagi", initials: "YI", title: "Visão de jogo", color: "#26D9FF", hp: 2100000000, minDmg: 210000 };
  let swapIn = null; // jogador esperando escolher quem sai
  let eqUnq = null; // v694: uid com a lista "Retirar itens" aberta
  let eqUid = null; // v276: jogador escolhido na tela Meu time
  let eqView = "team"; // v455: Meu time → Escalação, Com a bola, Sem a bola
  const trUi = { a: null, b: [], slot: "a0", pos: "all" }; // v295: rascunho da janela Escolher quem treina
  // v296: contagem 3, 2, 1 no centro da tela e apito (C.WHISTLE_FILE, vazio até o Mickey aprovar o som)
  let kickCd = false;
  function playWhistle() { if (!C.WHISTLE_FILE) return; try { const a = new Audio(C.WHISTLE_FILE + "?v=" + BL.BUILD); a.volume = vol("ui"); const p = a.play(); if (p) p.catch(() => {}); } catch (e) {} }
  // v296b: sair do treino congela o treino com todos na posição inicial e abre o Mapa; fechar o Mapa sem escolher volta o treino
  function exitTrainingMap() {
    const m = G.match; if (m && G.state.training) { m.kickoff(0); m.paused = true; }
    if (!floats.mapa) openFloat("mapa"); else refreshFloats(true);
    toast("Escolha a fase no Mapa para começar.");
  }
  function kickoffCountdown(done) {
    kickCd = true; const el = document.createElement("div"); el.className = "kick-cd"; el.setAttribute("aria-live", "assertive"); document.body.appendChild(el);
    const seq = ["3", "2", "1", "Valendo!"];
    seq.forEach((txt, i) => setTimeout(() => {
      el.innerHTML = `<b class="${i === 3 ? "go" : ""}">${txt}</b>`;
      if (i === 3) { playWhistle(); done(); setTimeout(() => { el.remove(); kickCd = false; }, 900); }
    }, i * 850));
  }
  let slMeas = null; // v291: medição da Soneca em andamento ({ t0 })
  const hmin = (sec) => `${Math.floor(sec / 3600)}h ${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}min`;
  // v502/v503 · Loja de Diamantes: estado, contagem até a meia-noite, desenhos e cards dos produtos
  const dxUi = { cat: "inicio", q: "", fit: false, sort: "padrao" };
  const dxCd = () => { const n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1) - n, p = (v) => String(v).padStart(2, "0"); return `${p(Math.floor(m / 3600e3))}:${p(Math.floor(m / 60e3) % 60)}:${p(Math.floor(m / 1e3) % 60)}`; };
  setInterval(() => { document.querySelectorAll("[data-dx-cd]").forEach((el) => { el.textContent = dxCd(); }); if (G.state && G.vipTick) G.vipTick(); }, 1000);
  const DX_SVG = {
    xp: `<svg viewBox="0 0 64 64"><path d="M14 46V30H8l12-14 12 14h-6v16z" fill="#2fd17a" stroke="#0b3a22" stroke-width="2.5" stroke-linejoin="round"/><path d="M34 52V36h-6l12-14 12 14h-6v16z" fill="#7dffb0" stroke="#0b3a22" stroke-width="2.5" stroke-linejoin="round"/><path d="M44 4l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2L44 20.5l-6.5 3.4 1.3-7.2-5.3-5.1 7.3-1z" fill="#ffd23f" stroke="#7a4a00" stroke-width="2" stroke-linejoin="round"/></svg>`,
    gold: `<svg viewBox="0 0 64 64"><g stroke="#7a4a00" stroke-width="2.5"><ellipse cx="26" cy="48" rx="17" ry="6" fill="#f0a800"/><path d="M9 40v8c0 3.3 7.6 6 17 6s17-2.7 17-6v-8" fill="#f0a800"/><ellipse cx="26" cy="40" rx="17" ry="6" fill="#ffd84a"/><path d="M9 32v8c0 3.3 7.6 6 17 6s17-2.7 17-6v-8" fill="#f0a800"/><ellipse cx="26" cy="32" rx="17" ry="6" fill="#ffd84a"/><circle cx="44" cy="20" r="14" fill="#ffd84a"/></g><circle cx="44" cy="20" r="9" fill="none" stroke="#b87400" stroke-width="2.5"/><path d="M44 14v12M40.5 17.5h7M40.5 22.5h7" stroke="#b87400" stroke-width="2.5"/></svg>`,
    steal: `<svg viewBox="0 0 64 64"><circle cx="32" cy="34" r="22" fill="#fff" stroke="#0a1030" stroke-width="3"/><circle cx="32" cy="34" r="15" fill="#ff3f5e"/><circle cx="32" cy="34" r="8" fill="#fff"/><circle cx="32" cy="34" r="3.5" fill="#ff3f5e"/><path d="M50 8 34 32" stroke="#0a1030" stroke-width="5" stroke-linecap="round"/><path d="M50 8 34 32" stroke="#ffd23f" stroke-width="2.5" stroke-linecap="round"/><path d="M47 4l9 1-2 9z" fill="#26d9ff" stroke="#0a1030" stroke-width="2" stroke-linejoin="round"/></svg>`,
    shiny: `<svg viewBox="0 0 64 64"><path d="M32 6 46 22 40 56H24L18 22z" fill="#c9f6ff" stroke="#1a1a5a" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 6 18 22h28z" fill="#fff"/><path d="M18 22 24 56l8-34z" fill="#ff7ad9" opacity=".75"/><path d="M46 22 40 56l-8-34z" fill="#4fd1ff" opacity=".75"/><path d="M32 22 24 56h16z" fill="#ffe07a" opacity=".7"/><path d="M18 22h28" stroke="#1a1a5a" stroke-width="2"/><g fill="#fff"><path d="M10 8l1.8 4.2L16 14l-4.2 1.8L10 20l-1.8-4.2L4 14l4.2-1.8z"/><path d="M54 30l1.4 3.1 3.1 1.4-3.1 1.4L54 39l-1.4-3.1-3.1-1.4 3.1-1.4z"/><path d="M52 4l1 2.3 2.3 1-2.3 1-1 2.3-1-2.3-2.3-1 2.3-1z"/></g></svg>`,
    cura: `<svg viewBox="0 0 64 64"><rect x="6" y="16" width="52" height="40" rx="8" fill="#e8eeff" stroke="#0a1030" stroke-width="3"/><path d="M22 16v-5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v5" fill="none" stroke="#0a1030" stroke-width="3"/><rect x="6" y="16" width="52" height="9" rx="4" fill="#4fd68a" stroke="#0a1030" stroke-width="3"/><path d="M28 30h8v8h8v8h-8v8h-8v-8h-8v-8h8z" fill="#ff3f5e" stroke="#7a0a20" stroke-width="2" stroke-linejoin="round" transform="translate(0 -4)"/></svg>`,
    vip: `<svg viewBox="0 0 64 64"><path d="M8 22l12 10 12-18 12 18 12-10-5 28H13z" fill="#ffd23f" stroke="#7a4a00" stroke-width="3" stroke-linejoin="round"/><rect x="13" y="48" width="38" height="7" rx="2" fill="#f0a800" stroke="#7a4a00" stroke-width="3"/><circle cx="32" cy="38" r="5" fill="#26d9ff" stroke="#0a3a6a" stroke-width="2"/><circle cx="8" cy="22" r="3.5" fill="#fff2c4" stroke="#7a4a00" stroke-width="2"/><circle cx="32" cy="12" r="3.5" fill="#fff2c4" stroke="#7a4a00" stroke-width="2"/><circle cx="56" cy="22" r="3.5" fill="#fff2c4" stroke="#7a4a00" stroke-width="2"/></svg>`,
  };
  const DX_GEM = `<svg class="dx-gem" viewBox="0 0 24 18" aria-hidden="true"><path d="M0 7 6 1h12l6 6-12 10.5z" fill="#7fe0ff"/><path d="M6 1h12l-2 3.5H8z" fill="#fff"/><path d="M0 7h24L12 17.5z" fill="#3fb4ff"/><path d="M8 4.5h8L12 17.5z" fill="#c9f6ff"/></svg>`;
  const DX_CATS = [["boosts", "Boosts"], ["permanentes", "Permanentes"], ["vip", "VIP"]]; /* v533: Contratos saiu (Master Contract não se compra) */
  const DX_BCOL = { xp: "#4fd68a", gold: "#ffd23f", steal: "#ff3f5e", shiny: "#c27bff" };
  const DX_BAN = { xp: 1, gold: 2, steal: 3, shiny: 2 }; // v506-v508 (XP usa só a arte b: a "a" veio com a faixa de oferta por cima): artes pixel do Mickey nos boosts; a partir dessa duração usa a 2ª arte (b)
  const dxArt = (p) => p.icon ? `<img class="dx-ic" src="${p.icon}?v=${BL.BUILD}" alt="">` : p.ban ? `<img class="dx-ban" src="${p.ban}?v=${BL.BUILD}" alt="">` : p.boost && DX_BAN[p.boost] ? `<img class="dx-ban" src="img/loja/boost-${p.boost}-${p.h >= DX_BAN[p.boost] ? "b" : "a"}.jpg?v=${BL.BUILD}" alt="">` : p.boost ? DX_SVG[p.boost] : p.perm ? DX_SVG.cura : p.vip || p.cat === "vip" ? DX_SVG.vip : p.sup ? shopArt(p.sup, `<i>${C.SUPPLIES[p.sup].icon}</i>`) : p.item ? BL.itemSvg(BL.anyItem(p.item)) : "";
  const DX_NI = {
    inicio: `<svg viewBox="0 0 32 32"><defs><linearGradient id="dxg-in" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fb4ff"/><stop offset="1" stop-color="#1446c8"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#dxg-in)" stroke="rgba(255,255,255,.35)"/><rect x="3" y="2.5" width="26" height="10" rx="6" fill="rgba(255,255,255,.18)"/><path d="M7 15.5 16 8l9 7.5V25h-6v-5.5h-6V25H7z" fill="#fff" stroke="#0a1030" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    dia: `<svg viewBox="0 0 32 32"><defs><linearGradient id="dxg-dm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fe3ff"/><stop offset="1" stop-color="#1a6be0"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#dxg-dm)" stroke="rgba(255,255,255,.35)"/><rect x="3" y="2.5" width="26" height="10" rx="6" fill="rgba(255,255,255,.18)"/><path d="M7 13l4-5h10l4 5-9 11z" fill="#c9f6ff" stroke="#0a1030" stroke-width="1.6" stroke-linejoin="round"/><path d="M7 13h18M11 8l2 5 3 11 3-11 2-5" fill="none" stroke="#3fb4ff" stroke-width="1.3"/></svg>`,
    todos: `<svg viewBox="0 0 32 32"><defs><linearGradient id="dxg-td" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c8cff"/><stop offset="1" stop-color="#3a2fb8"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#dxg-td)" stroke="rgba(255,255,255,.35)"/><rect x="3" y="2.5" width="26" height="10" rx="6" fill="rgba(255,255,255,.18)"/><g fill="#fff" stroke="#0a1030" stroke-width="1.6" stroke-linejoin="round"><rect x="7.5" y="7.5" width="7" height="7" rx="2"/><rect x="17.5" y="7.5" width="7" height="7" rx="2"/><rect x="7.5" y="17.5" width="7" height="7" rx="2"/><rect x="17.5" y="17.5" width="7" height="7" rx="2" fill="#ffd23f"/></g></svg>`,
    boosts: `<svg viewBox="0 0 32 32"><defs><linearGradient id="dxg-bo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fe39a"/><stop offset="1" stop-color="#0f8a4a"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#dxg-bo)" stroke="rgba(255,255,255,.35)"/><rect x="3" y="2.5" width="26" height="10" rx="6" fill="rgba(255,255,255,.18)"/><path d="M18 5 9 18h6l-2 9 10-14h-6z" fill="#ffe14a" stroke="#0a1030" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    contratos: `<svg viewBox="0 0 32 32"><defs><linearGradient id="dxg-ct" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5aa8ff"/><stop offset="1" stop-color="#2140b8"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#dxg-ct)" stroke="rgba(255,255,255,.35)"/><rect x="3" y="2.5" width="26" height="10" rx="6" fill="rgba(255,255,255,.18)"/><path d="M9 6h11l4 4v16H9z" fill="#fff" stroke="#0a1030" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 12h8M12 15.5h8M12 19h5" stroke="#5a6fb0" stroke-width="1.5" stroke-linecap="round"/><circle cx="21" cy="22" r="3.2" fill="#ff3f5e" stroke="#0a1030" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    permanentes: `<svg viewBox="0 0 32 32"><defs><linearGradient id="dxg-pm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fd9c9"/><stop offset="1" stop-color="#0f6b8a"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#dxg-pm)" stroke="rgba(255,255,255,.35)"/><rect x="3" y="2.5" width="26" height="10" rx="6" fill="rgba(255,255,255,.18)"/><path d="M6 21v-6a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v6" fill="none" stroke="#0a1030" stroke-width="3.2"/><path d="M6 21v-6a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v6" fill="none" stroke="#fff" stroke-width="1.6"/><rect x="7.5" y="16" width="17" height="5" rx="1.5" fill="#fff" stroke="#0a1030" stroke-width="1.6" stroke-linejoin="round"/><path d="M21.5 5.5a3.6 3.6 0 1 0 3.8 4.6 2.8 2.8 0 1 1-3.8-4.6z" fill="#ffe14a" stroke="#0a1030" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    vip: `<svg viewBox="0 0 32 32"><defs><linearGradient id="dxg-vp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd84a"/><stop offset="1" stop-color="#c98400"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#dxg-vp)" stroke="rgba(255,255,255,.35)"/><rect x="3" y="2.5" width="26" height="10" rx="6" fill="rgba(255,255,255,.18)"/><path d="M6 12l5 4 5-7 5 7 5-4-2.5 12h-15z" fill="#fff6c9" stroke="#0a1030" stroke-width="1.6" stroke-linejoin="round"/><circle cx="16" cy="18.5" r="2" fill="#26d9ff" stroke="#0a3a6a" stroke-width="1"/></svg>`,
  }; // v515 (Mickey): ícones do menu da Loja de Diamantes em placas coloridas, no estilo do jogo
  const DX_NIMG = ["inicio", "dia", "todos", "boosts", "contratos", "permanentes", "vip"]; // v517: ícones desenhados pelo Mickey (img/loja/menu)
  const dxIc = (c) => DX_NIMG.includes(c) ? `<img class="dx-ni" src="img/loja/menu/${c}.png?v=${BL.BUILD}" alt="">` : DX_NI[c] || ({ boosts: DX_SVG.xp, contratos: shopArt("pr-bluelock"), xp: shopArt("pr-basica"), treinador: BL.itemSvg(BL.anyItem("tr-apito")), vip: DX_SVG.vip, permanentes: DX_SVG.cura, dia: DX_GEM,
    tecnicos: (() => { const d = C.COACHES.find((x) => x.id === C.COACH_DEFAULT) || C.COACHES[0]; return d ? `<img class="dx-av" src="${d.src}" alt="">` : ""; })() })[c] || "";
  const dxLeft = (ms) => { const h = Math.floor(ms / 3600e3), m = Math.floor(ms / 60e3) % 60, d = Math.floor(h / 24); return d ? `${d}d ${h % 24}h` : `${h}h ${m}min`; };
  function dxCard(p, top) {
    const s = G.state, off = p.id === G.diaOffer() && G.diaOfferOpen(), v = G.diaPrice(p.id), c = G.cons();
    const r = p.tier ? rar(p.tier).color : p.rarity ? rar(p.rarity).color : DX_BCOL[p.boost] || (p.vip ? "#ffb02e" : p.perm ? "#4fd68a" : "#3f9bff");
    const has = p.sup ? c[p.sup] || 0 : p.item ? s.inventory.filter((x) => x === p.item).length + G.mgrEq().filter((x) => x === p.item).length : 0;
    const own1 = p.perm && s[p.perm], pill = p.soon ? `🕒 Em breve` : own1 ? `✓ Comprado · ativo em toda partida` : off ? `⏱ Acaba em <b data-dx-cd>${dxCd()}</b>` : p.boost && G.boostLeft(p.boost) ? `⚡ Ativo · ${dxLeft(G.boostLeft(p.boost))} restantes` : p.vip && s.vip ? `👑 VIP ativo${s.vipUntil ? " · " + dxLeft(s.vipUntil - Date.now()) : ""}` : has ? `🎒 Você tem ${fmt(has)}` : "";
    return `<div class="dx-card ${off ? "hot" : ""}" style="--rc:${off ? "#ffd23f" : r}">${off ? `<span class="dx-rib">Oferta do dia −${Math.round(C.DIA_OFFER_OFF * 100)}%</span>` : top ? `<span class="dx-rib top">Top ${top}</span>` : ""}
      <div class="dx-art">${dxArt(p)}${p.tier ? `<span class="dx-tier">★ ${rar(p.tier).name}</span><span class="dx-stars">${"★".repeat(p.stars || 0)}</span>` : ""}${top && top <= 3 && !off ? `<span class="dx-medal">${["🥇", "🥈", "🥉"][top - 1]}</span>` : ""}${p.h ? `<span class="dx-hh">${p.h}h</span>` : ""}</div>
      <div class="dx-info"><small>${esc((DX_CATS.find(([k]) => k === p.cat) || [, ""])[1])}</small><h4>${esc(p.name)}</h4><p${p.perm ? ` class="dx-perm"` : ""}>${p.perm ? "<i>∞</i>" : ""}${esc(p.desc || "")}</p>${pill ? `<span class="dx-pill">${pill}</span>` : ""}</div>
      <div class="dx-buy">${p.gp ? `<span class="dx-pr">${DX_GEM}<b>${fmt(p.dia)}</b></span><button type="button" class="dx-go" data-gp-open>Ver Game Pass</button>` : p.soon ? `<span class="dx-pr"><b>—</b></span>` : `<span class="dx-pr">${DX_GEM}<b>${fmt(v)}</b>${v < p.dia ? `<s>${p.dia}</s>` : ""}</span>`}${p.soon ? `<button type="button" class="dx-go" disabled>Em breve</button>` : own1 ? `<button type="button" class="dx-go" disabled>Comprado</button>` : `<button type="button" class="dx-go" data-dx-buy="${p.id}" ${(s.diamonds || 0) < v ? "disabled" : ""}>Comprar</button>`}</div></div>`;
  }
  function dxListHtml() {
    const s = G.state, q = dxUi.q.trim().toLowerCase(), cat = dxUi.cat;
    const sec = (t, L, top) => `<div class="dx-sec"><h3>${t}</h3><small>${L.length} produto${L.length === 1 ? "" : "s"}</small></div>` + (L.length ? `<div class="dx-grid">${L.map((p, i) => dxCard(p, top ? i + 1 : 0)).join("")}</div>` : `<p class="dx-empty">Nada encontrado com esse filtro.</p>`);
    if (cat === "tecnicos") {
      const co = G.coach(), L = C.COACHES.filter((d) => d.id !== C.COACH_DEFAULT && (!q || d.name.toLowerCase().includes(q)) && (!dxUi.fit || co.owned.includes(d.id) || (s.diamonds || 0) >= C.COACH_PRICE));
      return `<div class="dx-sec"><h3>Técnicos</h3><small>${fmt(C.COACH_PRICE)} ◆ cada · chegam Comuns</small></div><div class="dx-grid">${L.map((d) => { const o = co.owned.includes(d.id);
        return `<div class="dx-card" style="--rc:${o ? "#4fd68a" : "#7f8db3"}"><div class="dx-art dx-face ${o ? "" : "lock"}"><img src="${d.src}" alt=""></div><div class="dx-info"><small>Técnico</small><h4>${esc(d.name)}</h4><p>${esc(d.passive)}</p>${o ? `<span class="dx-pill ok">✓ Contratado</span>` : ""}</div>
          <div class="dx-buy">${o ? `<span></span><button type="button" class="dx-go alt" data-open="coach">Ver</button>` : `<span class="dx-pr">${DX_GEM}<b>${fmt(C.COACH_PRICE)}</b></span><button type="button" class="dx-go" data-shop-hire="${d.id}" ${(s.diamonds || 0) < C.COACH_PRICE ? "disabled" : ""}>Contratar</button>`}</div></div>`; }).join("")}</div>`;
    }
    let P = C.DIA_PRODUCTS.map((p) => G.diaProd(p.id)).filter((p) => (!q || (p.name + " " + (p.desc || "")).toLowerCase().includes(q)) && (!dxUi.fit || (s.diamonds || 0) >= G.diaPrice(p.id)));
    const ord = { menor: (a, b) => G.diaPrice(a.id) - G.diaPrice(b.id), maior: (a, b) => G.diaPrice(b.id) - G.diaPrice(a.id), nome: (a, b) => a.name.localeCompare(b.name, "pt-BR") }[dxUi.sort];
    if (ord) P = P.slice().sort(ord);
    if (cat === "inicio") {
      const offId = G.diaOffer(), best = ["bx-3h", "bsh-3h", "mod-cura", "pr-bluelock", "bs-3h", "bg-3h"].map((id) => P.find((p) => p.id === id)).filter(Boolean);
      const of = P.find((p) => p.id === offId), L = best.filter((p) => p.id !== offId);
      return `<div class="dx-sec"><h3>Destaques</h3><small>Oferta do dia e os mais procurados</small></div><div class="dx-grid">${(of ? dxCard(of) : "") + L.map((p, i) => dxCard(p, i + 1)).join("")}</div>`;
    }
    if (cat === "todos") return DX_CATS.map(([k, n]) => [n, P.filter((p) => p.cat === k)]).filter(([, L]) => L.length).map(([n, L]) => sec(n, L)).join("") || `<p class="dx-empty">Nada encontrado com esse filtro.</p>`;
    return sec((DX_CATS.find(([k]) => k === cat) || [, ""])[1], P.filter((p) => p.cat === cat));
  }
  const dmUi = { tab: "packs", pack: 0, qty: 10 }; // v289: estado da loja de Diamantes

  // Baús do Boss: desenho, sorteio (só demonstração, nada é creditado) e a janela de abrir estilo Clash Royale
  const chestSvg = () => `<svg class="bo-chsvg" viewBox="0 0 64 56" aria-hidden="true"><rect x="6" y="24" width="52" height="28" rx="4" fill="#5a3412" stroke="var(--a)" stroke-width="3"/><path d="M6 26 Q32 2 58 26 Z" fill="#7a4818" stroke="var(--a)" stroke-width="3"/><rect x="27" y="20" width="10" height="14" rx="2" fill="var(--a)"/><path d="M6 36h52" stroke="var(--a)" stroke-width="2" opacity=".6"/></svg>`;
  const bossPct = (o) => { const t = Object.values(o).reduce((a, b) => a + b, 0); return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, (v / t) * 100])); };
  const pctTxt = (v) => `${String(Math.round(v * 10) / 10).replace(".", ",")}%`;
  const BOSS_DROP = { xp: ["XP", "✦"], gold: ["Gold", '<i class="ic-coin"></i>'], diamantes: ["Diamantes", "💎"], boneco: ["Jogador", "👤"] };
  function bossRoll(c) {
    const B = C.BOSS_CHEST_BASE, wp = (o) => BL.util.weighted(Object.entries(o).map(([v, w]) => ({ v, w })));
    const pool = BL.CHARACTERS.filter((x) => !x.extra);
    return Array.from({ length: c.drops }, () => {
      const k = wp(c.w);
      if (k === "boneco") { const r = wp(c.boneco), ch = BL.util.pick(pool); return { k, id: ch.id, name: ch.name, ini: ch.initials, rarity: r }; }
      return { k, n: Math.max(1, Math.round(B[k] * c.mult * BL.util.rand(0.8, 1.2))) };
    }).sort((a, b) => (a.k === "boneco") - (b.k === "boneco"));
  }
  // v181 · ranking do Boss (simulado): Geral (pontos) e 5 categorias. Clicar num treinador mostra os 3 jogadores dele
  const BOSS_CAT = [["pts", "Geral", "pts"], ["gols", "Gols", "G"], ["assist", "Assistências", "A"], ["roubos", "Roubos de bola", "R"], ["passes", "Passes", "P"], ["bloqueios", "Bloqueios", "B"]];
  const POS_TAG = { atacante: "PIV", alaof: "ALO", aladef: "ALD", zagueiro: "FIX" }; // v433: nomes do Mickey (Pivô, Ala Of, Ala Def, Fixo)
  const bossStatLine = (st) => BOSS_CAT.slice(1).map(([k, , ab]) => `<span title="${BOSS_CAT.find((c) => c[0] === k)[1]}">${ab} <b>${fmt(st[k] || 0)}</b></span>`).join("");
  // v387: detalhe de um treinador do ranking (equipe); usado no ranking completo e no Top 5
  const bossRkDet = (x) => `<div class="bo-rk-det">${x.team.map((p) => `<${x.me ? `button type="button" data-ev-open="${p.uid}"` : "div"} class="bo-rk-pl">${tok(p.id, p.ini)}<div><b>${esc(p.name)}</b><small>${POS_TAG[p.pos] || ""} · Poder ${fmt(p.power)} · ${fmt(p.pts)} pts</small><div class="bo-sl">${bossStatLine(p.st)}</div></div></${x.me ? "button" : "div"}>`).join("")}</div>`;
  let bossTopOpen = null, bossPtr = false, bossHelp = false; // v387: Top 5 abre a equipe ali mesmo; não redesenha com o botão do mouse apertado
  document.addEventListener("pointerdown", () => { bossPtr = true; }, true);
  document.addEventListener("pointerup", () => { setTimeout(() => { bossPtr = false; }, 0); }, true);
  function rankView() {
    const key = bossRk.tab, rows = G.bossRank(key), v = (x) => (key === "pts" ? x.pts : x.tot[key]), run = G.bossRun();
    const mi = rows.findIndex((x) => x.me), show = rows.map((x, i) => [x, i]).filter(([x, i]) => i < 50 || x.me);
    const row = ([x, i]) => `<button type="button" class="bo-rk-row ${x.me ? "me" : ""} ${bossRk.open === x.name ? "open" : ""}" data-boss-rk-open="${esc(x.name)}"><span class="bo-rk-pos">${i + 1}º</span><b>${esc(x.name)}${x.me ? " (você)" : ""}</b><small>Poder ${fmt(x.power)}</small><span class="bo-rk-v">${fmt(v(x))}</span></button>
      ${bossRk.open === x.name ? bossRkDet(x) : ""}`;
    return `<div class="bo-ov"><div class="bo-ov-box bo-rk" style="--a:#26D9FF"><button type="button" class="btn btn-ghost bo-ov-x" data-boss-rk-close="1" aria-label="Fechar">✕</button>
      <small class="ex-k">Ranking do Boss${run ? (G.bossDone() ? " · final" : " · ao vivo") : " · prévia simulada"}</small><h3>${BOSS_CAT.find((c) => c[0] === key)[1]}</h3>
      <div class="bo-rk-tabs">${BOSS_CAT.map(([k, n]) => `<button type="button" class="btn ${k === key ? "on" : ""}" data-boss-rk-tab="${k}">${n}</button>`).join("")}</div>
      ${mi >= 0 ? `<p class="note">Sua posição: <b>${mi + 1}º</b> de ${rows.length}</p>` : `<p class="note">Envie a equipe para entrar no ranking.</p>`}
      <div class="bo-rk-list">${show.map(row).join("")}</div><p class="note bo-demo">Os outros treinadores são simulados até o jogo ter servidor. Toque num treinador para ver a equipe.</p></div></div>`;
  }
  function chestView() {
    const c = C.BOSS_CHESTS.find((x) => x.id === bossChest.tier), d = bossChest.drops, n = bossChest.shown;
    const card = (r, i) => r.k === "boneco"
      ? `<div class="bo-drop boneco ${i === n - 1 ? "new" : ""}" style="--r:${rar(r.rarity).color}">${tok(r.id, r.ini, rar(r.rarity).color)}<b>${esc(r.name)}</b><small>${rar(r.rarity).name}</small></div>`
      : `<div class="bo-drop ${i === n - 1 ? "new" : ""}"><span class="bo-dico">${BOSS_DROP[r.k][1]}</span><b>${fmt(r.n)}</b><small>${BOSS_DROP[r.k][0]}</small></div>`;
    let inner;
    if (!d) {
      const w = bossPct(c.w), bn = bossPct(c.boneco), B = C.BOSS_CHEST_BASE, amt = (k) => `${fmt(Math.round(B[k] * c.mult * 0.8))}–${fmt(Math.round(B[k] * c.mult * 1.2))}`;
      inner = `<p class="note">${c.rank} · ${c.drops} recompensas</p>
        <div class="bo-odds">${Object.keys(BOSS_DROP).map((k) => `<div><span>${BOSS_DROP[k][1]} ${BOSS_DROP[k][0]}</span><small>${k === "boneco" ? Object.entries(bn).map(([r, v]) => `<i style="color:${rar(r).color}">${rar(r).name} ${pctTxt(v)}</i>`).join(" · ") : amt(k)}</small><b>${pctTxt(w[k])}</b></div>`).join("")}</div>
        <button type="button" class="btn btn-hot" data-boss-open="1">Abrir baú</button>`;
    } else if (n < d.length) {
      inner = `<p class="bo-tap">Toque no baú · faltam ${d.length - n}</p><div class="bo-drops">${d.slice(0, n).map(card).join("")}</div>`;
    } else {
      inner = `<p class="bo-tap">Você ganhou:</p><div class="bo-drops">${d.map(card).join("")}</div><div class="bo-ov-btns">${bossChest.real ? "" : `<button type="button" class="btn" data-boss-open="1">Abrir de novo</button>`}<button type="button" class="btn btn-hot" data-boss-close="1">Fechar</button></div>`;
    }
    const open = d && n >= d.length;
    return `<div class="bo-ov"><div class="bo-ov-box" style="--a:${c.color}"><button type="button" class="btn btn-ghost bo-ov-x" data-boss-close="1" aria-label="Fechar">✕</button>
      <small class="ex-k">Baú do Boss</small><h3 style="color:${c.color}">Baú ${c.name}</h3>
      <button type="button" class="bo-big ${d && !open ? "tap" : ""} ${open ? "opened" : ""}" ${d && !open ? `data-boss-reveal="1"` : "disabled"} aria-label="Baú ${c.name}"><span class="bo-aura"></span>${chestSvg()}</button>
      ${inner}<p class="note bo-demo">${bossChest.real ? (d ? "Recompensas já creditadas na conta." : `Seu baú pelo ${bossChest.pos}º lugar.`) : "Teste (modo dev): nada é creditado."}</p></div></div>`;
  }
  // v281 · PC do treinador: estado da tela, figura do jogador, lista filtrada, grade e painel do escolhido
  const pcUi = { tab: "elenco", sel: null, q: "", rar: "", pos: "", st: "", ord: "nivel", dir: "desc" };
  const pcFig = (p, big) => (C.SPRITES[p.charId] ? `<span class="pc-fig${big ? " big" : ""}"><img src="${C.SPRITES[p.charId].card}" alt=""></span>` : `<span class="pc-fig ini${big ? " big" : ""}" style="--rc:${rar(p.rarity).color}">${esc(p.initials)}</span>`);
  const pcState = (p) => (p.uid === G.expAway() ? "exp" : G.bossAway().includes(p.uid) ? "boss" : G.lineup().includes(p.uid) ? "time" : "livre");
  function pcList() {
    const q = pcUi.q.trim().toLowerCase(), rk = (p) => C.RARITIES.findIndex((r) => r.id === p.rarity);
    const key = { nivel: (p) => p.level, poder: (p) => BL.power(p), raridade: rk, nome: (p) => p.name.toLowerCase() }[pcUi.ord] || ((p) => p.level);
    const used = new Set([...G.lineup(), ...G.bench().map((p) => p.uid)]); // v377 (Mickey): quem está na equipe ativa ou nos reservas não aparece na grade
    const l = G.state.roster.filter((p) => !used.has(p.uid) && (!q || p.name.toLowerCase().includes(q)) && (!pcUi.rar || p.rarity === pcUi.rar) && (!pcUi.pos || p.position === pcUi.pos)
      && (!pcUi.st || (pcUi.st === "fora" ? ["exp", "boss"].includes(pcState(p)) : pcState(p) === pcUi.st)));
    return l.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * (pcUi.dir === "asc" ? 1 : -1); });
  }
  function pcGridHtml() {
    const l = pcList();
    if (!l.length) return `<p class="pc-empty">Nenhum jogador com esses filtros.</p>`;
    return l.map((p) => { const st = pcState(p);
      return `<button type="button" class="pc-tile ${p.uid === pcUi.sel ? "on" : ""} ${p.uid === swapIn ? "wait" : ""}" data-pc-pick="${p.uid}" draggable="true" data-pc-drag="${p.uid}" style="--rc:${rar(p.rarity).color}" title="${esc(p.name)} · Nv ${p.level} · ${rar(p.rarity).name}">
        ${pcFig(p)}<span class="pc-lv">${p.level}</span>${st === "time" ? `<span class="pc-tag t" title="Na equipe">★</span>` : st === "exp" ? `<span class="pc-tag" title="Em expedição">🧭</span>` : st === "boss" ? `<span class="pc-tag" title="No Boss">♛</span>` : ""}${Object.values(p.items || {}).some(Boolean) ? `<span class="pc-it" title="Com item">🎒</span>` : ""}<span class="pc-nm">${esc(p.short)}</span></button>`; }).join("");
  }
  // v583 (Mickey) · aba Marcos: Maestria 1 a 10 por jogador (igual LoL), só cosmético; objetivos pela posição
  const pcTabs = () => `<div class="pc-tabs">${[["elenco", "Elenco"], ["marcos", "Marcos"], ["dex", "Coleção"]].map(([k, n]) => `<button type="button" class="pc-tab ${pcUi.tab === k ? "on" : ""}" data-pc-tab="${k}">${n}</button>`).join("")}</div>`;
  const mstCol = (l) => (l >= 10 ? "#ffd23f" : l >= 7 ? "#7d8bff" : l >= 4 ? "#26D9FF" : "#8ea2cf");
  function mstInfo(p) { const M = C.MASTERY, l = G.mastLv(p), pts = p.mast || 0, lo = M.need[l - 1], hi = M.need[l]; return { l, pts, lo, hi, pct: hi ? Math.min(100, ((pts - lo) / (hi - lo)) * 100) : 100, col: mstCol(l) }; }
  const mstBadge = (l, big) => `<span class="mst-b${big ? " big" : ""}" style="--mc:${mstCol(l)}"><i>${l}</i></span>`;
  function pcMarcos() {
    const s = G.state, M = C.MASTERY; if (!s.roster.some((p) => p.uid === pcUi.sel)) pcUi.sel = (G.lineup()[0]) || (s.roster[0] && s.roster[0].uid);
    const sp = G.player(pcUi.sel), list = s.roster.slice().sort((a, b) => (b.mast || 0) - (a.mast || 0));
    const obj = (p) => Object.entries(M.pts[p.position] || {}).map(([k, v]) => `<li><span>${esc(M.label[k] || k)}</span><b>+${String(v).replace(".", ",")}</b></li>`).join("");
    let left = "";
    if (sp) { const m = mstInfo(sp);
      left = `<div class="pc-hero mst-hero" style="--rc:${m.col}"><div class="pc-chips"><span>${esc(posName(sp.position))}</span></div>${pcFig(sp, true)}
        <b class="pct-name">${esc(sp.name)}</b>${mstBadge(m.l, true)}<div class="mst-lv">Maestria ${m.l}${m.l >= 10 ? " · máxima" : ""}</div>
        <div class="mst-bar"><i style="width:${m.pct}%;background:${m.col}"></i></div><small class="mst-pts">${m.hi ? `${fmt(Math.floor(m.pts))} / ${fmt(m.hi)} pontos para a Maestria ${m.l + 1}` : `${fmt(Math.floor(m.pts))} pontos`}</small></div>
        <div class="pc-box mst-obj"><small>Objetivos de ${esc(posName(sp.position))}</small><ul>${obj(sp)}</ul><p>Só cosmético: não muda nada em campo.</p></div>`; }
    const grid = list.map((p) => { const m = mstInfo(p);
      return `<button type="button" class="mst-card ${p.uid === pcUi.sel ? "on" : ""}" data-mst-pick="${p.uid}" style="--mc:${m.col}">${pcFig(p)}<span class="mst-t"><b>${esc(p.short)}</b><small>${esc(posName(p.position))}</small><span class="mst-bar sm"><i style="width:${m.pct}%;background:${m.col}"></i></span></span>${mstBadge(m.l)}</button>`; }).join("");
    openModal("PC do treinador", `<div class="pc mst">
      <div class="pct-h"><h3>PC do treinador</h3>${pcTabs()}<button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button></div>
      <div class="pc-main"><div class="pct-left">${left}</div><div class="pc-right"><div class="mst-head"><b>Marcos</b><span>Cada posição sobe com o próprio objetivo. Quanto maior a maestria, mais difícil chegar na próxima.</span></div><div class="mst-grid">${grid}</div></div></div>
    </div>`);
  }
  // v708 (Mickey) · aba Coleção (estilo Pokédex): cada personagem clicável mostra as raridades que você já teve dele
  function pcKeepScroll() { // v709: redesenha o PC sem perder a rolagem da grade e da janela
    const g = document.querySelector("#modalBody .mst-grid"), gy = g ? g.scrollTop : 0, ups = [];
    for (let e = $("modalBody"); e && e !== document.body; e = e.parentElement) ups.push([e, e.scrollTop]);
    MODALS.players(); const g2 = document.querySelector("#modalBody .mst-grid"); if (g2) g2.scrollTop = gy; ups.forEach(([e, y]) => { e.scrollTop = y; });
  }
  function pcDex() {
    const d = G.dex(), R = C.RARITIES, list = BL.CHARACTERS.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const got = (id) => R.filter((r) => d[id] && d[id][r.id]); if (!list.some((c) => c.id === pcUi.dex)) pcUi.dex = (list.find((c) => d[c.id]) || list[0] || {}).id;
    const seen = list.filter((c) => d[c.id]).length, tot = list.length * R.length, have = list.reduce((a, c) => a + got(c.id).length, 0);
    const fig = (c, big) => (C.SPRITES[c.id] ? `<span class="pc-fig${big ? " big" : ""}${d[c.id] ? "" : " dex-off"}"><img src="${C.SPRITES[c.id].card}" alt=""></span>` : `<span class="pc-fig ini${big ? " big" : ""}${d[c.id] ? "" : " dex-off"}">${esc((c.name || "?").slice(0, 2))}</span>`);
    const c = list.find((x) => x.id === pcUi.dex); let left = "";
    if (c) { const g = got(c.id), best = g[g.length - 1];
      left = `<div class="pc-hero mst-hero" style="--rc:${best ? best.color : "#4a5675"}"><div class="pc-chips"><span>${esc(posName(c.position))}</span></div>${fig(c, true)}
        <b class="pct-name">${d[c.id] ? esc(c.name) : "???"}</b><div class="mst-lv">${g.length} de ${R.length} raridades</div></div>
        <div class="pc-box dex-rars">${R.map((r) => `<span class="dex-r ${d[c.id] && d[c.id][r.id] ? "on" : ""}" style="--rc:${r.color}"><i></i>${esc(r.name)}<b>${d[c.id] && d[c.id][r.id] ? "✓" : "—"}</b></span>`).join("")}<p>${d[c.id] ? "Roube ou ganhe este personagem em outras raridades para completar a linha." : "Você ainda não teve este personagem. Roube ele de um adversário."}</p></div>`; }
    const grid = list.map((x) => { const g = got(x.id);
      return `<button type="button" class="mst-card dex-card ${x.id === pcUi.dex ? "on" : ""} ${d[x.id] ? "" : "off"}" data-dex-pick="${x.id}">${fig(x)}<span class="mst-t"><b>${d[x.id] ? esc(x.name) : "???"}</b><span class="dex-dots">${R.map((r) => `<i style="--rc:${r.color}" class="${d[x.id] && d[x.id][r.id] ? "on" : ""}"></i>`).join("")}</span></span></button>`; }).join("");
    openModal("PC do treinador", `<div class="pc mst">
      <div class="pct-h"><h3>PC do treinador</h3>${pcTabs()}<button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button></div>
      <div class="pc-main"><div class="pct-left">${left}</div><div class="pc-right"><div class="mst-head"><b>Coleção</b><span>${seen} de ${list.length} personagens encontrados · ${have} de ${tot} raridades. Clique em um personagem para ver o que falta.</span></div><div class="mst-grid">${grid}</div></div></div>
    </div>`);
  }
  function pcLeftHtml() {
    const p = G.player(pcUi.sel); if (!p) return `<p class="pc-empty">Escolha um jogador.</p>`;
    const r = rar(p.rarity), need = C.playerXpToNext(p.level), pos = C.POSITIONS.find((x) => x.id === p.position), st = pcState(p), lineup = G.lineup();
    const items = Object.entries(BL.ITEM_SLOTS).concat(BL.CONFIG.RARITIES.findIndex((x) => x.id === p.rarity) >= BL.CONFIG.RARITIES.findIndex((x) => x.id === C.CHAR_ITEM_MIN) ? [["personagem", "Personagem"]] : []).map(([k, label]) => /* v527: Épico+ tem o espaço extra */ `<div class="pc-slot"><small>${label}</small>${p.items[k] ? `<b>${BL.itemSvg(BL.ITEM_BY_ID[p.items[k]])} ${esc(BL.ITEM_BY_ID[p.items[k]].name)}</b><button type="button" class="pc-x" data-unequip="${p.uid}|${k}" aria-label="Remover ${label}">✕</button>` : `<b class="none">—</b>`}</div>`).join("");
    const act = st === "exp" ? `<span class="pc-note">🧭 Em expedição</span>` : st === "boss" ? `<span class="pc-note">♛ Jogando contra o Boss</span>`
      : st === "time" ? (lineup.length > 1 ? `<button type="button" class="pc-btn wide" data-remove="${p.uid}">Tirar da equipe</button>` : `<span class="pc-note">Único da equipe</span>`)
      : `<button type="button" class="pc-btn wide hot" data-activate="${p.uid}">Mover para a equipe</button>`;
    return `<div class="pc-hero" style="--rc:${r.color}">
        <div class="pc-chips"><span>${pos ? esc(pos.name) : "—"}</span>${p.shiny ? `<span class="shiny">Shiny ✦</span>` : ""}</div>
        ${pcFig(p, true)}
        <b class="pct-name">${esc(p.name)}</b>
        <div class="pc-sub"><span>Nv.${p.level}</span><span class="pc-rar" style="color:${r.color};border-color:${r.color}">${r.name}</span></div>
        <div class="pc-xpl"><span class="pc-xpb"><i style="width:${Math.min(100, (p.xp / need) * 100)}%"></i></span><small>${fmt(p.xp)} / ${fmt(need)} XP</small></div>
      </div>
      <div class="pc-g2"><div class="pc-box pc-nat"><small>Natureza</small><b>${natureText(p.nature)}</b></div><div class="pc-box"><small>Poder</small><b>${fmt(BL.power(p))}</b></div></div>
      <div class="pc-box pc-ivs"><small>IVs<b>${S.reduce((a, k) => a + p.stats[k], 0)}/${31 * S.length}</b></small><div>${S.map((k) => `<span class="${p.stats[k] >= 25 ? "hi" : p.stats[k] <= 10 ? "lo" : ""}"><i>${C.STAT_SHORT[k]}</i><b>${p.stats[k]}</b></span>`).join("")}</div></div>
      <div class="pc-box pc-items"><small>Itens</small><div>${items}</div></div>
      <div class="pc-acts">${act}<button type="button" class="pc-btn wide pc-ev" data-ev-open="${p.uid}">EV e status${BL.evTotal(p) ? ` · ${BL.evTotal(p)}` : ""}</button></div>`;
  }
  function pcMoveBtn() {
    const p = G.player(pcUi.sel), ok = p && pcState(p) === "livre" && !swapIn;
    return `<button type="button" class="pc-move" ${ok ? `data-activate="${p.uid}"` : "disabled"}><span aria-hidden="true">←</span> Mover para equipe</button>`;
  }
  // v283 · Central do treinador (botão ≡ do topo, ref. do Mickey): todos os recursos do jogo por categoria, com busca
  const HUB_CATS = [
    { id: "jornada", name: "Jornada", ico: "🗺️", col: "#3f9bff" },
    { id: "atividades", name: "Atividades", ico: "⛏️", col: "#3fe0a8" },
    { id: "colecao", name: "Coleção", ico: "🎒", col: "#b06bff" },
    { id: "comercio", name: "Comércio", ico: "🏪", col: "#ffb02e" },
    { id: "comunidade", name: "Comunidade", ico: "👥", col: "#ff6fb5" },
    { id: "competicao", name: "Competição", ico: "⚔️", col: "#ff3f5e" },
    { id: "sistema", name: "Sistema", ico: "⚙️", col: "#9aa7c7" },
  ];
  const hubItems = () => [
    ["jornada", "Mapa", "Atos, fases e as 4 dificuldades.", "🗺️", 'data-float="mapa"'],
    ["jornada", "Meu time", "3 times salvos, jogadores e poder do time.", "👥", 'data-open="equipe"'],
    ["jornada", "PC do treinador", "Todo o elenco com filtros e a equipe ativa.", "img/menu/pc.png", 'data-open="players"'],
    ["jornada", "Recompensa diária", "Resgate o prêmio do dia.", "img/menu/diaria.png", 'data-open="diaria"'],
    ["jornada", "Fases do mapa", "Trilha de fases e o Boss do mapa atual.", "📍", 'data-open="maps"'],
    ["jornada", G.state.training ? "Sair do treino" : "Modo treino", G.state.training ? "Volta para as partidas do mapa." : "Treine o elenco livre em dois times.", "⚽", "data-hub-train"],
    ["jornada", "Missões", "20 capítulos de história com missões e prêmios. O último dá o Master Contract.", "img/menu/rail-missoes.png", 'data-float="missoes"'],
    ["jornada", "Espólios", "Baús comuns, raros, épicos e lendários para abrir.", "🧰", 'data-float="chests"'],
    ["jornada", "Mochila", "Todos os itens que saíram dos baús.", "🎒", 'data-float="mochila"'],
    ["atividades", "Expedição", "Envie um jogador e traga recompensas na volta.", "img/menu/expedicao.png", 'data-open="expedicao"'],
    ["atividades", "Wildcard", "Treino passivo de quem está fora do time.", "img/menu/wildcard.png", 'data-open="wildcard"'],
    ["atividades", "Boss", "Chefe do dia: envie 3 jogadores e dispute o ranking.", "img/menu/boss.png", 'data-open="boss"'],
    ["colecao", "Itens", "Inventário e equipamentos dos jogadores.", "🎒", 'data-open="items"'],
    ["colecao", "Habilidades", "Habilidades passivas dos jogadores.", "img/menu/habilidades.png", 'data-open="locked" data-what="Habilidades"', true],
    ["comercio", "Loja", "Água, Gatorade, itens e mais.", "img/menu/loja.png", 'data-open="loja"'],
    ["comercio", "Diamantes", "Compre diamantes.", "img/menu/diamantes.png", 'data-open="buyDiamonds"'],
    ["comercio", "Leilão", "Compre, dê lances e venda jogadores e itens.", "img/menu/leilao.png", 'data-open="leilao"'],
    ["comercio", "RMT", "Venda e compre jogadores e itens por Pix.", "R$", 'data-rmt-open'], /* v626: RMT no lugar do Social (js/rmt.js) */
    ["comunidade", "Correio", "Avisos e presentes.", "✉️", 'data-open="mail"'],
    ["comunidade", "Guilda", "Jogue junto com outros treinadores.", "img/menu/guilda.png", 'data-clan-open'], /* v624: Guilda em js/clan.js */
    ["competicao", "PvP", "Enfrente o time de outros jogadores.", "img/menu/pvp.png", 'data-pvp-open'], /* v630: Arena PvP em js/pvp.js */
    ["competicao", "Líderes", "Domine um ginásio e ganhe um benefício.", "img/menu/lideres.png", 'data-open="lideres"'],
    ["competicao", "Game Pass", "Metas da temporada e recompensas.", "img/menu/gamepass.png", 'data-gp-open'], /* v628: Game Pass em js/gamepass.js */
    ["sistema", "Modo Soneca", "XP com o jogo fechado.", "☾", 'data-open="sleep"'],
    ["sistema", "Configurações", "Áudio e conta.", "img/engrenagem.png", 'data-open="settings"'],
    ...(G.dev ? [["sistema", "Modo Dev", "Ferramentas de teste.", "🛠️", 'data-float="dev"']] : []),
  ];
  // v621 (Mickey, refs) · CASA DE LEILÕES: Comprar (preço fixo), Leilões (lances), Vender, Meus anúncios, Meus lances, Histórico
  const mkUi = { tab: "comprar", q: "", cat: "todos", cur: "todas", sort: "novos", page: 0, sCat: "player", sel: null, sq: "", mode: "fixo", price: "", scur: "gold", hours: 24, qty: 1, sheet: null, bid: "" };
  const mkCur = (cur, n, big) => cur === "dia" ? `<b class="mk-dia${big ? " big" : ""}">◆ ${fmt(n)}</b>` : `<b class="mk-gold${big ? " big" : ""}"><i class="ic-coin"></i> ${fmt(n)}</b>`;
  const mkCurN = (cur) => (cur === "dia" ? "Diamantes" : "Gold");
  function mkLeft(ms) { ms = Math.max(0, ms); const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, "0")}min` : m ? `${m}min ${String(s % 60).padStart(2, "0")}s` : `${s % 60}s`; }
  const mkIv = (p) => Math.round((S.reduce((a, k) => a + (p.stats[k] || 0), 0) / (31 * S.length)) * 100);
  function mkArt(l) { if (l.kind === "player" && l.data) return badge(l.data); const [k, id] = (l.item || l.key || "").split(":"), it = k === "q" ? BL.anyItem(id) : C.CONSUMABLES[id] || C.SUPPLIES[id];
    return `<span class="mk-ic">${k === "q" ? shopArt(id, BL.itemSvg(it) || "🎁") : shopArt(id, (it && it.icon) || "📦")}</span>`; }
  function mkTags(l) { if (l.kind === "player" && l.data) { const p = l.data, r = rar(p.rarity), n = BL.NATURE_BY_NAME[p.nature], pos = C.POSITIONS.find((x) => x.id === p.position);
      return `<span class="mk-chip lv">Nv ${p.level}</span><span class="mk-chip" style="--c:${r.color}">IV ${mkIv(p)}% · ${p.shiny ? "Shiny ✦ " : ""}${esc(r.name)}</span><span class="mk-chip"><small>NAT</small> ${esc(p.nature)}${n && n.up ? ` <em class="nat-up">+${C.STAT_SHORT[n.up]}</em> <em class="nat-down">−${C.STAT_SHORT[n.down]}</em>` : ""}</span>${pos ? `<span class="mk-chip"><small>POS</small> ${esc(pos.name)}</span>` : ""}`; }
    const [k, id] = (l.item || l.key || "").split(":"), it = k === "q" ? BL.anyItem(id) : C.SUPPLIES[id]; const r = rar((it && it.rarity) || "comum");
    return `<span class="mk-chip lv">${fmt(l.qty || 1)} ${(l.qty || 1) > 1 ? "unidades" : "unidade"}</span><span class="mk-chip" style="--c:${r.color}">${esc(r.name)}</span><span class="mk-chip"><small>ITEM</small> ${k === "q" ? esc(it.mgr ? "Treinador" : BL.ITEM_SLOTS[it.slot] || "Item") : k === "c" ? "Energia" : "Suprimento"}</span>`; }
  function mkRow(l, me, how) { const top = l.bids && l.bids[l.bids.length - 1], open = l.status === "open", left = l.end - Date.now(), mine = l.seller === me;
    const st = !open ? `<span class="mk-st ${l.status}">${l.status === "sold" ? (l.buyer === me ? (l.mode === "leilao" ? "Você venceu" : "Comprado por você") : "Vendido") : l.status === "cancelled" ? "Cancelado" : "Sem venda"}</span>` : `<span class="mk-time" data-mk-end="${l.end}">⏱ ${mkLeft(left)}</span>`;
    const pr = l.mode === "leilao" ? `<div class="mk-pr"><small>${top ? "Lance atual" : "Lance inicial"}</small>${mkCur(l.cur, top ? top.amt : l.price, 1)}<em>${top ? `${l.bids.length} lance${l.bids.length > 1 ? "s" : ""} · ${top.user === me ? "<b class='mk-win'>você está ganhando</b>" : "maior: " + esc(top.name)}` : "Sem lances ainda"}</em></div>`
      : `<div class="mk-pr"><small>Preço${(l.qty || 1) > 1 ? ` · ${fmt(Math.round(l.price / l.qty))}/un.` : ""}</small>${mkCur(l.cur, l.price, 1)}</div>`;
    const act = !open ? "" : mine ? (l.bids && l.bids.length ? `<button type="button" class="mk-btn" disabled title="Leilão com lances não pode ser cancelado">Com lances</button>` : `<button type="button" class="mk-btn" data-mk-cancel="${l.id}">Cancelar</button>`)
      : l.mode === "leilao" ? `<button type="button" class="mk-btn go gold" data-mk-sheet="bid|${l.id}">Dar lance</button>` : `<button type="button" class="mk-btn go" data-mk-sheet="buy|${l.id}">Comprar</button>`;
    return `<div class="mk-row ${l.mode === "leilao" ? "auc" : ""} ${l.data && l.data.shiny ? "shiny" : ""}" style="--rc:${rar((l.data && l.data.rarity) || "comum").color}">
      <div class="mk-art">${mkArt(l)}</div>
      <div class="mk-info"><b class="mk-name">${(l.qty || 1) > 1 ? fmt(l.qty) + "× " : ""}${esc(l.name)}</b><div class="mk-tags">${mkTags(l)}</div><small class="mk-sel">${mine ? "Seu anúncio" : `Vendedor: <b>${esc(l.sellerName)}</b>`} · ${l.mode === "leilao" ? "<span class='mk-k auc'>Leilão</span>" : "<span class='mk-k'>Preço fixo</span>"}</small></div>
      <div class="mk-mid">${st}</div>${pr}<div class="mk-act">${act}</div></div>`; }
  function mkFilter(list) { const q = mkUi.q.trim().toLowerCase();
    list = list.filter((l) => (mkUi.cat === "todos" || l.kind === mkUi.cat) && (mkUi.cur === "todas" || l.cur === mkUi.cur) && (!q || l.name.toLowerCase().includes(q)));
    const top = (l) => (l.bids && l.bids.length ? l.bids[l.bids.length - 1].amt : l.price);
    const k = { novos: (a, b) => b.start - a.start, fim: (a, b) => a.end - b.end, menor: (a, b) => top(a) - top(b), maior: (a, b) => top(b) - top(a) }[mkUi.sort] || ((a, b) => b.start - a.start);
    return list.sort(k); }
  function mkBar(n, what) { return `<div class="mk-bar"><label class="mk-q"><span>🔍</span><input type="search" data-mk-q placeholder="Buscar jogador ou item" value="${esc(mkUi.q)}" aria-label="Buscar"></label>
      <select data-mk-sort aria-label="Ordenar">${[["novos", "Mais novos"], ["fim", "Termina primeiro"], ["menor", "Menor preço"], ["maior", "Maior preço"]].map(([v, t]) => `<option value="${v}" ${mkUi.sort === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>
    <div class="mk-bar"><div class="mk-pills">${[["todos", "Todos"], ["player", "Jogadores"], ["item", "Itens"]].map(([v, t]) => `<button type="button" class="${mkUi.cat === v ? "on" : ""}" data-mk-cat="${v}">${t}</button>`).join("")}</div>
      <div class="mk-pills">${[["todas", "Todas"], ["gold", `<i class="ic-coin"></i> Gold`], ["dia", `<b class="mk-dia">◆</b> Diamantes`]].map(([v, t]) => `<button type="button" class="${mkUi.cur === v ? "on" : ""}" data-mk-curf="${v}">${t}</button>`).join("")}</div></div>
    <p class="mk-count">${fmt(n)} ${what}</p>`; }
  function mkPager(n) { const P = C.MARKET.page, pages = Math.max(1, Math.ceil(n / P)); mkUi.page = Math.min(mkUi.page, pages - 1); return pages < 2 ? "" : `<div class="mk-pager"><button type="button" class="mk-btn" data-mk-page="-1" ${mkUi.page ? "" : "disabled"}>‹ Anterior</button><span>Página ${mkUi.page + 1} de ${pages}</span><button type="button" class="mk-btn" data-mk-page="1" ${mkUi.page < pages - 1 ? "" : "disabled"}>Próxima ›</button></div>`; }
  function mkSellHtml(m, me) { const g = G.mkGoods(), M = C.MARKET, act = m.list.filter((l) => l.seller === me && l.status === "open").length, q = mkUi.sq.trim().toLowerCase();
    const opts = mkUi.sCat === "player" ? g.players.filter((x) => !q || x.p.name.toLowerCase().includes(q)).sort((a, b) => a.busy - b.busy || rar(b.p.rarity).mult - rar(a.p.rarity).mult).map(({ p, busy }) => ({ key: p.uid, busy, html: `${badge(p)}<span><b>${esc(p.name)}</b><small>Nv ${p.level} · IV ${mkIv(p)}% · ${esc(rar(p.rarity).name)}${busy ? " · em uso" : ""}</small></span>` }))
      : g.items.filter((x) => !q || x.name.toLowerCase().includes(q)).map((x) => ({ key: x.key, html: `${mkArt({ kind: "item", item: x.key })}<span><b>${esc(x.name)}</b><small>Você tem ${fmt(x.n)} · ${esc(rar(x.rarity).name)}</small></span>` }));
    if (!opts.some((o) => o.key === mkUi.sel && !o.busy)) mkUi.sel = (opts.find((o) => !o.busy) || {}).key || null;
    let form = `<div class="mk-empty">Escolha o que vender.</div>`;
    if (mkUi.sel) { const pl = mkUi.sCat === "player" ? g.players.find((x) => x.p.uid === mkUi.sel).p : null, it = pl ? null : g.items.find((x) => x.key === mkUi.sel);
      const fake = pl ? { kind: "player", data: pl, name: pl.name } : { kind: "item", item: it.key, name: it.name, qty: mkUi.qty };
      if (it) mkUi.qty = Math.max(1, Math.min(it.n, mkUi.qty || 1));
      const key = pl ? "p:" + pl.charId : it.key, ref = G.mkPriceRef(key, mkUi.scur), price = Math.floor(+mkUi.price || 0), fee = price ? G.mkFee(price, mkUi.scur) : 0;
      const ivs = pl ? `<div class="mk-ivs">${S.map((k) => `<span><small>${C.STAT_SHORT[k]}</small><b>${pl.stats[k]}</b></span>`).join("")}</div>` : "";
      form = `<div class="mk-prev"><div class="mk-art">${mkArt(fake)}</div><div><small class="mk-kick">${pl ? "Jogador" : "Item"}</small><b class="mk-name">${esc(fake.name)}</b><div class="mk-tags">${mkTags({ ...fake, qty: it ? mkUi.qty : 1 })}</div></div></div>${ivs}
        <h5 class="mk-h5">Tipo de venda</h5><div class="mk-seg"><button type="button" class="${mkUi.mode === "fixo" ? "on" : ""}" data-mk-mode="fixo">Preço fixo</button><button type="button" class="${mkUi.mode === "leilao" ? "on gold" : ""}" data-mk-mode="leilao">Leilão com lances</button></div>
        <p class="mk-note">${mkUi.mode === "fixo" ? "Quem pagar o preço anunciado leva na hora." : "Quem der o maior lance leva quando o tempo acabar. O preço vira o lance inicial."}</p>
        ${it ? `<h5 class="mk-h5">Quantidade <em>máx. ${fmt(it.n)}</em></h5><input class="mk-in" id="mkQty" type="number" min="1" max="${it.n}" value="${mkUi.qty}">` : ""}
        <h5 class="mk-h5">${mkUi.mode === "fixo" ? "Preço" : "Lance inicial"}${it && mkUi.qty > 1 ? " (lote inteiro)" : ""}</h5>
        <div class="mk-seg sm"><button type="button" class="${mkUi.scur === "gold" ? "on" : ""}" data-mk-scur="gold"><i class="ic-coin"></i> Gold</button><button type="button" class="${mkUi.scur === "dia" ? "on" : ""}" data-mk-scur="dia"><b class="mk-dia">◆</b> Diamantes</button></div>
        <input class="mk-in" id="mkPrice" type="number" min="1" placeholder="Valor em ${mkCurN(mkUi.scur)}" value="${esc(mkUi.price)}">
        <div class="mk-ref"><small>Preço de referência (mesmo jogador ou item)</small><div><span>Mediana 7 dias</span>${ref.med != null ? mkCur(mkUi.scur, ref.med) : "<em>—</em>"}</div><div><span>Última venda</span>${ref.last != null ? mkCur(mkUi.scur, ref.last) : "<em>—</em>"}</div><div><span>Menor anúncio agora</span>${ref.low != null ? mkCur(mkUi.scur, ref.low) : "<em>—</em>"}</div></div>
        <h5 class="mk-h5">Duração</h5><div class="mk-seg sm">${M.hours.map((h) => `<button type="button" class="${+mkUi.hours === h ? "on" : ""}" data-mk-hours="${h}">${h} h</button>`).join("")}</div>
        <div class="mk-get" id="mkGet">${price ? `Se vender, você recebe ${mkCur(mkUi.scur, price - fee)} <small>(taxa de ${Math.round(M.fee * 100)}%: ${fmt(fee)})</small>` : "Informe o preço para ver quanto você recebe."}</div>
        <button type="button" class="mk-btn go wide ${mkUi.mode === "leilao" ? "gold" : ""}" data-mk-post ${price ? "" : "disabled"} id="mkPost">${mkUi.mode === "leilao" ? "Abrir leilão" : "Publicar anúncio"}</button>`; }
    return `<p class="mk-count">Anúncios ativos: ${act} de ${M.maxListings}</p>
      <div class="mk-sell"><div class="mk-pick"><h5 class="mk-h5"><i>1</i> O que você quer vender?</h5><div class="mk-seg">${[["player", "⚽ Jogadores"], ["item", "🎒 Itens"]].map(([v, t]) => `<button type="button" class="${mkUi.sCat === v ? "on" : ""}" data-mk-scat="${v}">${t}</button>`).join("")}</div>
        <h5 class="mk-h5"><i>2</i> Escolha</h5><label class="mk-q"><span>🔍</span><input type="search" data-mk-sq placeholder="Filtrar pelo nome" value="${esc(mkUi.sq)}"></label>
        <div class="mk-opts">${opts.length ? opts.map((o) => `<button type="button" class="mk-opt ${o.key === mkUi.sel ? "on" : ""}" data-mk-sel="${esc(o.key)}" ${o.busy ? "disabled title='Tire do time, das reservas, do Wildcard, da Expedição ou do Boss para vender'" : ""}>${o.html}</button>`).join("") : `<div class="mk-empty">${mkUi.sCat === "player" ? "Nenhum jogador." : "Nada na Mochila para vender."}</div>`}</div></div>
        <div class="mk-form"><h5 class="mk-h5"><i>3</i> Preço e prazo</h5>${form}</div></div>
      <p class="mk-foot">A taxa de ${Math.round(M.fee * 100)}% só é cobrada se vender (em diamantes arredonda para cima, mínimo 1 ◆). Jogadores em uso (time, reservas, Wildcard, Expedição, Boss) não podem ser vendidos.</p>`; }
  function mkSheetHtml(m, me) { const [k, id] = mkUi.sheet.split("|"), l = m.list.find((x) => x.id === id); if (!l || l.status !== "open") { mkUi.sheet = null; return ""; }
    const bal = G.mkBal(l.cur), top = l.bids[l.bids.length - 1], minB = G.mkMinBid(l), mine = top && top.user === me ? top.amt : 0;
    const head = `<div class="mk-prev"><div class="mk-art">${mkArt(l)}</div><div><small class="mk-kick">${l.kind === "player" ? "Jogador" : "Item"}</small><b class="mk-name">${(l.qty || 1) > 1 ? fmt(l.qty) + "× " : ""}${esc(l.name)}</b><small class="mk-sel">Vendedor: <b>${esc(l.sellerName)}</b></small></div></div>`;
    const rows = (rs) => `<div class="mk-lines">${rs.map(([a, b]) => `<div><span>${a}</span>${b}</div>`).join("")}</div>`;
    if (k === "buy") return `<div class="mk-sheet"><div class="mk-sbox"><div class="mk-sh"><h4>Confirmar compra</h4><button type="button" class="eq-x" data-mk-sheet="" aria-label="Fechar">✕</button></div>${head}
      ${rows([["Total", mkCur(l.cur, l.price, 1)], ...((l.qty || 1) > 1 ? [["Preço por unidade", mkCur(l.cur, Math.round(l.price / l.qty))]] : []), ["Seu saldo", mkCur(l.cur, bal)], ["Termina em", `<span class="mk-time" data-mk-end="${l.end}">⏱ ${mkLeft(l.end - Date.now())}</span>`]])}
      <p class="mk-note box">O valor sai da sua conta agora e ${l.kind === "player" ? "o jogador vai para o seu PC" : "os itens vão para a sua Mochila"} na hora.</p>
      <div class="mk-sf"><button type="button" class="mk-btn" data-mk-sheet="">Cancelar</button><button type="button" class="mk-btn go" data-mk-buy="${l.id}" ${bal < l.price ? "disabled" : ""}>${bal < l.price ? "Saldo insuficiente" : `Comprar por ${l.cur === "dia" ? "◆" : ""} ${fmt(l.price)}`}</button></div></div></div>`;
    const v = Math.floor(+mkUi.bid || 0), pay = v ? v - mine : 0;
    return `<div class="mk-sheet"><div class="mk-sbox"><div class="mk-sh"><h4>Dar lance</h4><button type="button" class="eq-x" data-mk-sheet="" aria-label="Fechar">✕</button></div>${head}
      ${rows([[top ? "Lance atual" : "Lance inicial", mkCur(l.cur, top ? top.amt : l.price, 1)], ["Lances", top ? `<b>${l.bids.length}</b>` : "<b>Nenhum ainda</b>"], ["Você já travou", mine ? mkCur(l.cur, mine) : "<b>Nada ainda</b>"], ["Termina em", `<span class="mk-time" data-mk-end="${l.end}">⏱ ${mkLeft(l.end - Date.now())}</span>`], ["Lance mínimo agora", mkCur(l.cur, minB)], ["Seu saldo", mkCur(l.cur, bal)]])}
      <h5 class="mk-h5">Seu lance total em ${mkCurN(l.cur)}</h5><input class="mk-in" id="mkBid" type="number" min="${minB}" placeholder="Valor" value="${esc(mkUi.bid)}">
      <div class="mk-seg sm">${[["Mínimo", minB], ["+10%", Math.ceil(minB * 1.1)], ["+25%", Math.ceil(minB * 1.25)]].map(([t, n]) => `<button type="button" data-mk-bidset="${n}">${t} · ${fmt(n)}</button>`).join("")}</div>
      <p class="mk-note box">O lance <b>sai do seu saldo agora e fica travado</b> neste leilão. Se alguém cobrir, o valor volta para você e, se der outro lance, paga só a diferença. Lance nos últimos ${C.MARKET.snipe} s prorroga o fim (até ${C.MARKET.snipeMax} min a mais).</p>
      <div class="mk-sf"><button type="button" class="mk-btn" data-mk-sheet="">Cancelar</button><button type="button" class="mk-btn go gold" data-mk-bid="${l.id}" id="mkBidGo" ${v >= minB && pay <= bal ? "" : "disabled"}>Dar lance${v ? ` · paga ${fmt(Math.max(0, pay))}` : ""}</button></div></div></div>`; }
  function mkOpen() {
    G.mkSync(); const got = G.mkClaim(); if (got) toast(`Casa de Leilões: você recebeu ${got} ${got > 1 ? "entregas" : "entrega"} (compras, vendas ou lances devolvidos).`, "gold");
    const s = G.state, m = G.mkSync(), me = G.mkMe(), P = C.MARKET.page;
    const tabs = [["comprar", "🏷️ Comprar"], ["leiloes", "🔨 Leilões"], ["vender", "💰 Vender"], ["sep"], ["meus", "📋 Meus anúncios"], ["lances", "✋ Meus lances"], ["hist", "🕘 Histórico"]];
    const open = m.list.filter((l) => l.status === "open");
    let body = "";
    if (mkUi.tab === "comprar" || mkUi.tab === "leiloes") { const auc = mkUi.tab === "leiloes", list = mkFilter(open.filter((l) => (l.mode === "leilao") === auc && l.seller !== me));
      body = `<div class="mk-tip ${auc ? "gold" : ""}">${auc ? "Lances: quem der o maior lance leva quando o tempo acabar. Se cobrirem o seu, o valor volta para você." : "Preço fixo: pague o valor anunciado e leve na hora."}</div>${mkBar(list.length, auc ? "leilões abertos" : "anúncios à venda")}
        <div class="mk-list">${list.length ? list.slice(mkUi.page * P, mkUi.page * P + P).map((l) => mkRow(l, me)).join("") : `<div class="mk-empty big">${auc ? "🔨" : "🏷️"}<p>Nenhum ${auc ? "leilão aberto" : "anúncio"} agora. Quando outro treinador anunciar, aparece aqui.</p></div>`}</div>${mkPager(list.length)}`; }
    else if (mkUi.tab === "vender") body = mkSellHtml(m, me);
    else if (mkUi.tab === "meus") { const mine = m.list.filter((l) => l.seller === me).sort((a, b) => (b.status === "open") - (a.status === "open") || b.start - a.start);
      body = `<p class="mk-count">${mine.filter((l) => l.status === "open").length} ativos de ${C.MARKET.maxListings}</p><div class="mk-list">${mine.length ? mine.map((l) => mkRow(l, me)).join("") : `<div class="mk-empty big">📋<p>Você ainda não anunciou nada. Use a aba Vender.</p></div>`}</div>`; }
    else if (mkUi.tab === "lances") { const bl = m.list.filter((l) => l.mode === "leilao" && (l.bids || []).some((b) => b.user === me)).sort((a, b) => (b.status === "open") - (a.status === "open") || a.end - b.end);
      body = `<div class="mk-list">${bl.length ? bl.map((l) => mkRow(l, me)).join("") : `<div class="mk-empty big">✋<p>Você não deu lances ainda.</p></div>`}</div>`; }
    else { const h = m.hist.filter((x) => x.user === me).slice(0, 80);
      body = h.length ? `<div class="mk-hist">${h.map((x) => `<div><small>${new Date(x.t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small><span>${esc(x.text)}</span></div>`).join("")}</div>` : `<div class="mk-empty big">🕘<p>Nada por aqui ainda.</p></div>`; }
    openModal("Casa de Leilões", `<div class="pc mk">
      <div class="pct-h bg-h shx-h mk-hd"><span class="bg-ico"><img src="img/menu/leilao.png" alt=""></span><div><small class="shx-kick">Mercado entre treinadores</small><h3>Casa de Leilões</h3><p>Compre, dê lances e venda jogadores e itens para outros treinadores.</p></div>
        <div class="shx-bal"><span><i class="ic-coin"></i> ${fmt(s.gold)}</span><span><i class="ic-dia"></i> ${fmt(s.diamonds || 0)}</span></div>
        <button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button></div>
      <div class="mk-tabs">${tabs.map(([v, t]) => v === "sep" ? `<i class="mk-sep"></i>` : `<button type="button" class="${mkUi.tab === v ? "on" : ""} ${v === "leiloes" ? "auc" : ""}" data-mk-tab="${v}">${t}</button>`).join("")}<button type="button" class="mk-ref-btn" data-mk-tab="${mkUi.tab}" title="Atualizar">↻ Atualizar</button></div>
      <div class="mk-body">${body}</div>${mkUi.sheet ? mkSheetHtml(m, me) : ""}</div>`);
    const pi = $("mkPrice"); if (pi) pi.oninput = () => { mkUi.price = pi.value; const v = Math.floor(+pi.value || 0), f = v ? G.mkFee(v, mkUi.scur) : 0, g = $("mkGet"), b = $("mkPost");
      if (g) g.innerHTML = v ? `Se vender, você recebe ${mkCur(mkUi.scur, v - f)} <small>(taxa de ${Math.round(C.MARKET.fee * 100)}%: ${fmt(f)})</small>` : "Informe o preço para ver quanto você recebe."; if (b) b.disabled = !v; };
    const qi = $("mkQty"); if (qi) qi.onchange = () => { mkUi.qty = Math.floor(+qi.value || 1); mkOpen(); };
    const bi = $("mkBid"); if (bi) { bi.oninput = () => { mkUi.bid = bi.value; const l = G.mkRead().list.find((x) => x.id === mkUi.sheet.split("|")[1]); if (!l) return; const top = l.bids[l.bids.length - 1], mine = top && top.user === me ? top.amt : 0, v = Math.floor(+bi.value || 0), go = $("mkBidGo");
      if (go) { go.disabled = !(v >= G.mkMinBid(l) && v - mine <= G.mkBal(l.cur)); go.textContent = `Dar lance${v ? ` · paga ${fmt(Math.max(0, v - mine))}` : ""}`; } }; bi.focus(); }
  }
  setInterval(() => { if (currentModal !== "Casa de Leilões" || $("modal").hidden) return; let done = false; document.querySelectorAll("#modalBody [data-mk-end]").forEach((el) => { const left = +el.dataset.mkEnd - Date.now(); el.textContent = "⏱ " + mkLeft(left); if (left <= 0) done = true; });
    if (done && !document.activeElement.matches("#modalBody input")) mkOpen(); }, 1000);
  // v622 (Mickey, refs "Liga") · LÍDERES: Explorar ginásios, Meu ginásio, Histórico
  const gyUi = { tab: "explorar", sel: null };
  function gyStatus(g, me) { const now = Date.now(); return g.leader === me ? `<span class="gy-st me">Você é o líder</span>` : g.prot > now ? `<span class="gy-st prot" data-mk-end="${g.prot}" data-gy-prot>🛡 Protegido · ${mkLeft(g.prot - now)}</span>` : `<span class="gy-st open">Aberto a desafios</span>`; }
  function gyDetail(d, m, me, back) { const g = m.g[d.id], why = G.gyCan(d.id), mine = g.leader === me;
    return `${back ? `<button type="button" class="gy-back" data-gy-sel="">‹ Voltar aos ginásios</button>` : ""}
      <div class="gy-det" style="--gc:${d.color}"><div class="gy-dban"><div><small>Disputa de liderança · Ginásio ${String(d.n).padStart(2, "0")}</small><h3>${esc(d.name)}</h3>${gyStatus(g, me)}</div><span class="gy-big">${d.icon}</span></div>
        <div class="gy-dbody"><div class="gy-dl"><div class="gy-lead"><small>Líder atual</small><b>${esc(g.leaderName)}${g.leader ? "" : " <em>NPC</em>"}</b><span>Equipe defendida por IA, mesmo offline${g.wins ? ` · ${g.wins} defesa${g.wins > 1 ? "s" : ""}` : ""}</span></div>
          <h5 class="mk-h5">Equipe defensora <em>${(g.team || []).length} jogadores</em></h5>
          <div class="gy-team">${(g.team || []).map((p) => { const r = rar(p.rarity), pos = C.POSITIONS.find((x) => x.id === p.position); return `<div class="gy-pl" style="--rc:${r.color}">${badge(p)}<b>${esc(p.name)}</b><small>Nv ${p.level} · ${esc(r.name)}${pos ? ` · ${esc(pos.short)}` : ""}</small></div>`; }).join("")}</div></div>
          <div class="gy-buff"><span>${d.icon}</span><small>Benefício da liderança</small><b>+${d.val}${d.buff === "steal" ? " pt" : "%"}</b><p>${d.buff === "steal" ? "de chance de roubo" : d.buff === "xp" ? "de XP nas partidas" : "de Gold nas partidas"}</p><em>Ativo enquanto você for o líder.</em></div></div>
        <div class="gy-go">${mine ? `<div><b>Você é o líder deste ginásio.</b><small>Seu time escalado na conquista defende por IA. Para mudar de ginásio, abdique primeiro.</small></div><button type="button" class="mk-btn" data-gy-abd>Abdicar</button>`
          : `<div><b>Pronto para disputar este lugar?</b><small>${why ? esc(why) : "Partida 4×4 com o seu time escalado contra a equipe do líder. Vença para tomar o ginásio."}</small></div><button type="button" class="mk-btn go gold" data-gy-go="${d.id}" ${why ? "disabled" : ""}>Desafiar</button>`}</div></div>`; }
  function gyOpen() {
    const m = G.gyRead(), me = G.mkMe(), mine = G.gyMine(m), L = C.GYMS.list, free = L.filter((d) => !m.g[d.id].leader).length;
    let body;
    if (gyUi.tab === "explorar" && gyUi.sel) body = gyDetail(L.find((d) => d.id === gyUi.sel), m, me, true);
    else if (gyUi.tab === "explorar") body = `<div class="gy-hero"><div><small>Liga · Lideranças</small><h3>Conquiste um ginásio</h3><p>Vença a equipe do líder, defenda com o seu time e ganhe um benefício para a sua jornada.</p><div class="gy-pills"><span>1 ginásio por conta</span><span>4 jogadores na defesa</span><span>${C.GYMS.wait} min de espera se perder</span></div></div><span class="gy-hico"><img src="img/menu/lideres.png" alt=""></span></div>
      <div class="gy-hh"><div><h4>Ginásios</h4><small>Cada ginásio traz um benefício diferente.</small></div><span class="gy-free">${free} com líder NPC</span></div>
      <div class="gy-grid">${L.map((d) => { const g = m.g[d.id]; return `<button type="button" class="gy-card ${g.leader === me ? "me" : ""}" data-gy-sel="${d.id}" style="--gc:${d.color}"><span class="gy-ban"><i>Ginásio ${String(d.n).padStart(2, "0")}</i><span class="gy-ic">${d.icon}</span></span>
        <span class="gy-cb"><span class="gy-nm"><b>${esc(d.name)}</b><em>+${d.val}${d.buff === "steal" ? " pt" : "%"}</em></span><small class="gy-bf">${d.buff === "steal" ? "chance de roubo" : d.buff === "xp" ? "XP nas partidas" : "Gold nas partidas"}</small>
        <span class="gy-ld"><b>${esc(g.leaderName)}${g.leader ? "" : " <em>NPC</em>"}</b>${gyStatus(g, me)}</span></span></button>`; }).join("")}</div>
      <details class="gy-how"><summary>Como funciona a liderança?</summary><p>Escolha um ginásio e desafie a equipe do líder numa partida 4×4 com o seu time escalado (precisa estar num mapa 4×4). Ao vencer, você vira o líder: uma cópia do seu time fica defendendo por IA, mesmo com você offline, e você ganha o benefício do ginásio.</p><p>Você pode liderar um ginásio por vez. Se perder um desafio, você espera ${C.GYMS.wait} minutos para desafiar de novo. Se outro treinador vencer a sua equipe, ele toma o ginásio e o benefício. Para mudar de ginásio, abdique primeiro.</p></details>`;
    else if (gyUi.tab === "meu") body = mine ? gyDetail(mine, m, me, false) : `<div class="mk-empty big">🏟️<p>Você ainda não lidera nenhum ginásio. Escolha um em Explorar ginásios e desafie o líder.</p></div>`;
    else { const h = m.hist.filter((x) => x.user === me).slice(0, 80); body = h.length ? `<div class="mk-hist">${h.map((x) => `<div><small>${new Date(x.t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small><span>${esc(x.text)}</span></div>`).join("")}</div>` : `<div class="mk-empty big">🕘<p>Nenhum desafio ainda.</p></div>`; }
    const cd = (m.cd || {})[me] || 0; if (cd > Date.now() && gyUi.tab === "explorar") body = `<div class="mk-tip gold">⏳ Você perdeu o último desafio. Pode desafiar de novo em <b data-mk-end="${cd}" data-gy-cd>${mkLeft(cd - Date.now())}</b>.</div>` + body;
    openModal("Líderes", `<div class="pc mk gy">
      <div class="pct-h bg-h shx-h mk-hd"><span class="bg-ico"><img src="img/menu/lideres.png" alt=""></span><div><small class="shx-kick">Liderança de treinadores</small><h3>Líderes</h3><p>${mine ? `Você lidera o ${esc(mine.name)}: ${esc(G.gyBuffTxt(mine))}.` : "Domine um ginásio e ganhe um benefício até alguém tomar o seu lugar."}</p></div>
        <button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button></div>
      <div class="mk-tabs">${[["explorar", "🏟️ Explorar ginásios"], ["meu", "👑 Meu ginásio"], ["hist", "🕘 Histórico"]].map(([v, t]) => `<button type="button" class="${gyUi.tab === v ? "on" : ""}" data-gy-tab="${v}">${t}</button>`).join("")}<span class="gy-cnt">${L.length} ginásios</span></div>
      <div class="mk-body">${body}</div></div>`);
  }
  setInterval(() => { if (currentModal !== "Líderes" || $("modal").hidden) return; let done = false; document.querySelectorAll("#modalBody [data-gy-cd]").forEach((el) => { const left = +el.dataset.mkEnd - Date.now(); el.textContent = mkLeft(left); if (left <= 0) done = true; }); document.querySelectorAll("#modalBody [data-gy-prot]").forEach((el) => { const left = +el.dataset.mkEnd - Date.now(); el.textContent = "🛡 Protegido · " + mkLeft(left); if (left <= 0) done = true; }); if (done) gyOpen(); }, 1000);
  // v654 (Mickey: Expedição igual à arte dele): faixas e ícones recortados da arte (img/expedicao/trilha.jpg); EXA = posição de cada faixa no atlas, medalhas (cx, cy, r) por nível e caixa do texto "Região N"
  const EXA = {"W":1200,"H":1994,"iy":1874,"is":120,"b":[{"w":1010,"h":188,"n":[[71,85,27],[162,120,29],[255,85,28],[348,120,29],[441,87,29],[534,120,29],[628,87,28],[719,120,29],[811,87,28],[905,120,29]],"t":[260,20,427,40],"y":0},{"w":1010,"h":188,"n":[[899,91,33],[796,124,31],[703,93,32],[609,126,34],[516,91,31],[429,126,31],[334,91,30],[247,124,31],[160,91,33],[67,124,32]],"t":[573,16,733,37],"y":188},{"w":1010,"h":188,"n":[[70,89,32],[161,124,30],[254,89,30],[347,124,30],[439,89,30],[534,124,30],[626,91,30],[719,124,33],[812,89,30],[906,124,30]],"t":[266,20,431,40],"y":376},{"w":1010,"h":188,"n":[[902,87,31],[800,121,32],[706,87,31],[612,123,32],[522,89,30],[435,121,32],[339,89,31],[249,121,30],[160,87,30],[67,123,31]],"t":[595,20,755,40],"y":564},{"w":1010,"h":188,"n":[[71,84,34],[162,116,34],[255,86,34],[345,115,35],[435,84,34],[532,116,34],[624,86,34],[716,116,34],[806,86,34],[905,115,32]],"t":[252,18,420,40],"y":752},{"w":1010,"h":191,"n":[[938,108,29],[842,132,29],[748,106,29],[650,134,28],[556,108,29],[458,132,29],[362,108,27],[266,132,29],[168,104,29],[70,132,29]],"t":[282,14,432,34],"y":940},{"w":1010,"h":185,"n":[[74,126,30],[168,102,27],[266,126,27],[362,102,30],[460,128,28],[556,102,29],[652,126,29],[748,102,30],[844,126,29],[940,104,29]],"t":[235,16,385,36],"y":1131},{"w":1010,"h":185,"n":[[940,100,29],[844,124,30],[746,100,30],[650,122,29],[554,102,29],[458,122,29],[362,98,28],[266,122,28],[168,100,30],[72,124,29]],"t":[224,15,375,35],"y":1316},{"w":1010,"h":181,"n":[[72,118,29],[168,98,26],[266,120,30],[362,98,30],[460,120,30],[554,100,27],[652,120,30],[748,98,28],[844,122,29],[942,100,28]],"t":[260,16,410,36],"y":1501},{"w":1010,"h":192,"n":[[944,102,30],[846,128,29],[748,102,29],[652,128,31],[558,102,29],[460,128,29],[362,104,26],[266,128,31],[170,104,29],[72,126,30]],"t":[252,16,412,36],"y":1682}]};
  const exaUrl = () => `img/expedicao/trilha.jpg?v=${BL.BUILD}`;
  const exaBand = (A) => `background-image:url(${exaUrl()});background-size:${EXA.W / A.w * 100}% ${EXA.H / A.h * 100}%;background-position:0 ${A.y / (EXA.H - A.h) * 100}%`;
  const exaMedal = (ri, k) => { const A = EXA.b[ri], [cx, cy, r] = A.n[k], d = 2 * r + 6; return `<span class="exa-medal" style="background-image:url(${exaUrl()});background-size:${EXA.W / d * 100}% ${EXA.H / d * 100}%;background-position:${(cx - d / 2) / (EXA.W - d) * 100}% ${(A.y + cy - d / 2) / (EXA.H - d) * 100}%"></span>`; };
  const exaRegIco = (ri) => `<span class="exa-rico" style="background-image:url(${exaUrl()});background-size:${EXA.W / EXA.is * 100}% ${EXA.H / EXA.is * 100}%;background-position:${ri * EXA.is / (EXA.W - EXA.is) * 100}% 100%"></span>`;
  const MODALS = {
    leilao() { mkOpen(); }, // v621
    // v638 (Mickey): pop-up Habilidades: 4 slots do time em cima e as 14 embaixo; clicar equipa no 1º slot livre (ou tira). Quem usa em campo é quem tiver a melhor chance
    habilidades() {
      const S = G.skillSlots(), Lb = G.skLib(), rn = { raro: "Rara", epico: "Épica", lendario: "Lendária" }, on = (id) => S.some((x) => x && x.id === id);
      const slots = S.map((x, i) => { const d = x && BL.SKILLS[x.id]; return `<button type="button" class="hb-slot${d ? "" : " empty"}" data-hb-slot="${i}" ${d ? `style="--rc:${C.SKILL_RAR_COL[d.rar]}" title="Tirar ${esc(d.name)}"` : `title="Slot vazio"`}>${d ? `${skIco(x.id, 64)}<b>${esc(d.name)}</b><em>Nv ${Lb[x.id] ? Lb[x.id].lv : 1}</em>` : `<span class="hb-plus">+</span><b>Slot ${i + 1}</b><em>vazio</em>`}</button>`; }).join("");
      const cards = Object.keys(C.SKILL_DEF).map((id) => { const d = BL.SKILLS[id], own = !!Lb[id], lv = own ? Lb[id].lv : 1, cd = Math.max(5, d.cd - (lv - 1) * C.SKILL_LV.cd);
        return `<button type="button" class="hb-card${on(id) ? " on" : ""}${own ? "" : " locked"}" ${own ? `data-hb-id="${id}"` : G.skNeedClear(id) && !G.skNeed(id) ? `data-sk-buy="${id}"` : "disabled"} style="--rc:${C.SKILL_RAR_COL[d.rar]}">${skIco(id, 76)}<div class="hb-tx"><div class="hb-top"><b>${esc(d.name)}</b>${on(id) ? `<span class="hb-tag">No time</span>` : ""}</div><span class="hb-rar">${rn[d.rar]} · ${!own && G.skLock(id) ? `🔒 ${G.skLock(id)}` : `Nv ${lv} · recarga ${cd} s`}</span><p>${esc(d.desc)}</p></div></button>`; }).join("");
      openModal("Habilidades", `<div class="hb"><p class="hb-note">As habilidades são do time: escolha até ${S.length}. Na partida, quem estiver na melhor posição usa, sozinho, quando a recarga acaba.</p><div class="hb-slots">${slots}</div><div class="hb-grid">${cards}</div></div>`);
    },
    lideres() { gyOpen(); }, // v622
    analyser() {
      // v262: visual de "hunt analyzer" (referência do Mickey): ritmo por hora em destaque, números que sobem animados (tweenNums), tempo de sessão
      const a = G.state.analyzer, pr = G.state.progress;
      const lucro = a.goldGained - a.goldSpent, ms = Math.max(60000, Date.now() - a.since), h = ms / 3600000;
      const N = (k, v, suf = "", pre = "") => `<b class="an-n" data-n="${k}" data-v="${Math.round(v)}" data-pre="${pre}" data-suf="${suf}">${pre}${fmt(k in anPrev ? anPrev[k] : v)}${suf}</b>`;
      const T = (ico, label, val, cls = "") => `<div class="an-t ${cls}"><span class="an-ico" aria-hidden="true">${ico}</span><div class="an-tv">${val}<span class="an-l">${label}</span></div></div>`;
      const sg = (v) => (v >= 0 ? "+" : "−");
      return `<div class="an">
        <div class="an-g2"><div class="an-box"><span class="an-cap">Mapa atual</span><b>${esc(G.map.name)}</b></div><div class="an-box"><span class="an-cap">Fase atual</span><b>${G.stageLabel()} · ${G.map.mode}</b></div></div>
        <div class="an-pace"><div class="an-pace-h">Ritmo da sessão</div>
          <div class="an-hero"><span class="an-ico" aria-hidden="true">⚡</span><div><span class="an-cap">XP/h</span>${N("xph", a.xp / h, "/h")}</div></div>
          <div class="an-g3">${T('<i class="ic-coin"></i>', "Gold/h", N("goldh", a.goldGained / h, "/h"), "gold")}${T("⚽", "Partidas/h", N("mh", a.matches / h, "/h"))}${T("🏆", "Vitórias/h", N("wh", a.wins / h, "/h"))}
            ${T("🎯", "% vitórias", N("wr", a.matches ? (a.wins / a.matches) * 100 : 0, "%"))}${T("📈", "Média XP", N("mxp", a.matches ? a.xp / a.matches : 0))}${T("🧲", "Roubados", N("st", a.steals))}</div></div>
        <div class="an-h">Painéis da sessão</div>
        <div class="an-g4">${T("🎮", "Partidas", N("m", a.matches))}${T("🏆", "Vitórias", N("w", a.wins), "pos")}${T("💔", "Derrotas", N("l", a.losses), "neg")}${T("🥅", "Gols", `<b class="an-n">${fmt(a.goalsFor)}:${fmt(a.goalsAgainst)}</b>`, "goals")}</div>
        <div class="an-g3">${T("⭐", "XP ganho", N("xp", a.xp))}${T('<i class="ic-coin"></i>', "Gold ganho", N("gg", a.goldGained), "gold")}${T("⏳", "Tempo", `<b class="an-n an-time">${anClock(ms)}</b>`)}</div>
        <div class="an-g3">${T("📦", "Baús abertos", N("ch", a.chests))}${T("🗺️", "Rodadas", N("runs", pr.runs))}${T("🛒", "Gold gasto", N("gs", a.goldSpent), "neg")}</div>
        <div class="an-g2">${T("💹", "Lucro estimado", N("lu", Math.abs(lucro), "", sg(lucro)), lucro >= 0 ? "profit" : "loss")}${T("⏱️", "Lucro por hora", N("luh", Math.abs(lucro / h), "/h", sg(lucro)), lucro >= 0 ? "profit" : "loss")}</div>
        <div class="an-foot"><span>Desde ${new Date(a.since).toLocaleString("pt-BR")}</span><button type="button" class="btn" data-action="reset-analyzer">🗑 Zerar análise</button></div>
      </div>`;
    },
    steal() {
      // Só quem você está enfrentando agora, com a % de roubo de cada um
      const st = G.state.progress.stage, goals = G.match ? G.match.score[0] : 0;
      const opps = G.match ? G.match.field(1).map((e) => e.p) : G.enemy ? [G.enemy] : [];
      const n = opps.length || 1;
      const cards = opps.map((e) => {
        const r = rar(e.rarity), ch = BL.stealChance(e, st, goals);
        return `<div class="sc"><span class="pct" style="background:${r.color}">${ch.toFixed(1).replace(".", ",")}%</span>${badge(e)}<b>${esc(e.short)}</b><small>Nv ${e.level} · ${r.name}${e.shiny ? " · Shiny" : ""}${e.boss ? " · Boss" : ""}</small></div>`;
      }).join("");
      return `<div class="steal-mode"><b>${n}v${n}</b><span>Fase ${G.stageLabel()}</span>${G.stealArmed() ? `<span>${esc(C.SUPPLIES[G.stealArmed()].name)} · ${G.cons()[G.stealArmed()]}</span>` : "<span>Sem Proposta equipada: sem roubo</span>"}</div><div class="steal-cards">${cards}</div>`;
    },
    hub() {
      const s = G.state, items = hubItems();
      const icon = (ic) => (ic.includes("/") ? `<img src="${ic}" alt="">` : `<span>${ic}</span>`);
      const card = (it) => `<button type="button" class="hub-card ${it[5] ? "soon" : ""}" data-hub-go ${it[4]} data-hub-txt="${esc((it[1] + " " + it[2]).toLowerCase())}"><span class="hub-ic">${icon(it[3])}</span><span class="hub-tx"><b>${esc(it[1])}${it[5] ? `<em>Em breve</em>` : ""}</b><small>${esc(it[2])}</small></span></button>`;
      const secs = HUB_CATS.map((c) => { const l = items.filter((it) => it[0] === c.id); return l.length ? `<section class="hub-sec" id="hub-${c.id}" style="--hc:${c.col}"><h4><i></i>${c.name}<span></span></h4><div class="hub-grid">${l.map(card).join("")}</div></section>` : ""; }).join("");
      const nav = HUB_CATS.map((c, i) => { const n = items.filter((it) => it[0] === c.id).length; return n ? `<button type="button" class="hub-nav ${i === 0 ? "on" : ""}" data-hub-cat="${c.id}" style="--hc:${c.col}"><span class="hub-nav-ic">${c.ico}</span><b>${c.name}</b><em>${n}</em></button>` : ""; }).join("");
      openModal("Central do treinador", `<div class="hub">
        <div class="hub-h"><div><small>Central do treinador</small><h3>Todos os recursos</h3></div>
          <div class="hub-chips"><span class="hub-chip"><i>${esc(s.name.slice(0, 2).toUpperCase())}</i><span><small>Treinador</small><b>${esc(s.name)}</b></span><em>Nv. ${s.account.level}</em></span>
            <span class="hub-chip"><span><small>Local</small><b>${s.training ? "Treino" : `${esc(C.MAP_TITLES[s.progress.map] || G.map.name)} · ${G.stageLabel()}`}</b></span></span>
            <span class="hub-chip"><span><small>Dificuldade</small><b>${esc(C.DIFFICULTIES[G.diff()].name || "Normal")}</b></span></span></div>
          <button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button></div>
        <div class="hub-main"><nav class="hub-side">${nav}</nav>
          <div class="hub-body" id="hubBody"><label class="hub-q"><span aria-hidden="true">⌕</span><input type="search" data-hub-q placeholder="Buscar recurso" aria-label="Buscar recurso"></label>${secs}<p class="hub-none" hidden>Nenhum recurso encontrado.</p></div></div>
      </div>`);
    },
    // v276 · Meu time (ref. do Mickey): até 3 times salvos, jogadores no palco, poder do time e o escolhido embaixo
    equipe() {
      const s = G.state, sets = G.teamSets(), sel = s.teamSel, limit = G.lineupLimit();
      const ps = G.lineup().map((u) => G.player(u)).filter(Boolean);
      if (!ps.some((p) => p.uid === eqUid)) eqUid = ps[0] ? ps[0].uid : null;
      const cur = ps.find((p) => p.uid === eqUid);
      const pow = ps.reduce((a, p) => a + BL.power(p), 0);
      const fig = (p) => (C.SPRITES[p.charId] ? `<img class="eq-spr" src="${C.SPRITES[p.charId].card}" alt="">` : `<span class="eq-ini" style="--rc:${rar(p.rarity).color}">${esc(p.initials)}</span>`);
      const slots = [];
      for (let i = 0; i < Math.max(limit, ps.length); i++) {
        const p = ps[i];
        const sp = C.POSITIONS.find((x) => x.id === C.LINEUP_POS[i]), cu = ps.findIndex((x) => x.uid === eqUid);
        // v435: piso verde = posição certa, amarelo = mesmo setor (Fixo/Ala Def ou Ala Of/Pivô), vermelho = setor trocado
        const fitC = p && sp ? (() => { const k = C.LINEUP_POS.indexOf(p.position), j = C.LINEUP_POS.indexOf(sp.id); return k === j ? "#3ddc84" : (k < 2) === (j < 2) ? "#ffc83d" : "#ff4d5e"; })() : ""; // v434: vaga = posição; clicar na posição leva o escolhido para ela
        const lab = sp ? `<button type="button" class="eq-pos ${p && cu >= 0 && cu !== i ? "go" : ""}" ${p && cu >= 0 && cu !== i ? `data-eq-swap="${cu}|${i}" title="Levar ${esc(ps[cu].short)} para ${esc(sp.name)}"` : "disabled"}>${esc(sp.name)}</button>` : "";
        slots.push(`<div class="eq-col">` + (p ? `<button type="button" class="eq-slot ${p.uid === eqUid ? "on" : ""}" data-eq-pick="${p.uid}" draggable="false" data-eq-drag="${i}" style="--rc:${rar(p.rarity).color};--fit:${fitC}"><span class="eq-fig">${fig(p)}</span><span class="eq-plat"></span><b class="eq-name">${esc(p.short)}</b>${Object.values(p.items || {}).some(Boolean) ? `<i class="eq-dot" title="Tem item equipado" aria-label="Tem item equipado"></i>` : ""}</button>`
          : `<button type="button" class="eq-slot empty" data-open="players"><span class="eq-fig"><span class="eq-plus">+</span></span><span class="eq-plat"></span><b class="eq-name">Escalar</b></button>`) + lab + `</div>`);
      }
      let info = `<div class="eq-info eq-none">Escale um jogador para ver os detalhes.</div>`;
      if (cur) {
        const r = rar(cur.rarity), need = C.playerXpToNext(cur.level), pct = Math.min(100, Math.round((cur.xp / need) * 100)), pos = C.POSITIONS.find((x) => x.id === cur.position);
        info = `<div class="eq-info">
          <div class="eq-who">${badge(cur)}<div><small class="eq-k">Na equipe</small><b class="eq-big">${esc(cur.name)}</b>
            <div class="eq-rar"><span style="color:${r.color}">${cur.shiny ? "Shiny ✦ " : ""}${r.name}</span><span>${pct}%</span></div><span class="bar eq-xp" title="${fmt(cur.xp)}/${fmt(need)} XP"><i style="width:${pct}%"></i></span></div></div>
          <div class="eq-f"><small>Nível</small><b>Nv.${cur.level}</b></div>
          <div class="eq-f"><small>Poder</small><b>${fmt(BL.power(cur))}</b></div>
          <div class="eq-f"><small>Posição</small><b>${pos ? esc(pos.name) : "—"}</b></div>
          <div class="eq-f"><small>Natureza</small><b>${natureText(cur.nature)}</b></div>
          <div class="eq-f eq-ivs"><small>IVs</small><div>${S.map((k) => `<span><i>${C.STAT_SHORT[k]}</i><b>${cur.stats[k]}</b></span>`).join("")}</div></div>
        </div>`;
      }
      openModal("Meu time", `<div class="eq">
        <header class="eq-h">
          <span class="eq-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg></span>
          <div class="eq-tt"><small>Gestão do time</small><h3>Meu time</h3><em>Equipe salva automaticamente.</em></div>
          <div class="eq-tabs"><small>Times</small><div>${sets.map((_, i) => `<button type="button" class="${i === sel ? "on" : ""} ${sets[i].length || i === sel ? "" : "vazio"}" data-eq-team="${i}" aria-pressed="${i === sel}">${i + 1}</button>`).join("")}</div></div>
          <div class="eq-pow"><small>Poder do time</small><b>${fmt(pow)}</b></div>
          <button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button>
        </header>
        <div class="eq-views">${[["team", "Escalação"], ["com", "Com a bola"], ["sem", "Sem a bola"]].map(([k, n]) => `<button type="button" class="${eqView === k ? "on" : ""}" data-eq-view="${k}">${n}</button>`).join("")}</div>
        ${eqView === "team" ? `<div class="eq-stage"><div class="eq-row">${slots.join("")}</div></div>
        ${info}` : eqBoard(eqView, ps)}
        ${cur && eqUnq === cur.uid && Object.values(cur.items || {}).some(Boolean) ? `<div class="eq-unq"><small>Itens equipados em ${esc(cur.short)}</small>${Object.entries(cur.items).filter(([, id]) => id && BL.ITEM_BY_ID[id]).map(([k, id]) => `<div class="bg-unq"><span><b>${esc(BL.ITEM_BY_ID[id].name)}</b><small>${BL.ITEM_SLOTS[k] || "Personagem"}</small></span><button type="button" class="btn" data-eq-unq1="${cur.uid}|${k}">Retirar</button></div>`).join("")}<button type="button" class="btn" data-eq-unequip="${cur.uid}">Retirar todos</button></div>` : ""}
        <div class="eq-act${eqView === "team" ? " has-bench" : ""}">
          <button type="button" class="eq-b" ${cur && ps.length > 1 ? `data-eq-out="${cur.uid}"` : "disabled"}>Tirar do time</button>
          <button type="button" class="eq-b" ${cur && Object.values(cur.items || {}).some(Boolean) ? `data-eq-unq-open="${cur.uid}"` : `disabled title="Sem itens equipados"`}>Retirar itens</button>
          <button type="button" class="eq-b eq-pc" data-open="players"><img src="img/menu/pc.png" alt=""> Abrir PC</button>
          ${eqView !== "team" ? "" : `<div class="eq-bench"><small>Reservas</small><div>${Array.from({ length: C.BENCH_SIZE }, (_, i) => G.bench()[i]).map((p) => p ? `<button type="button" class="eq-bp" data-eq-bdrag="${p.uid}" title="Arraste ${esc(p.short)} para uma posição" style="--rc:${rar(p.rarity).color}"><span class="eq-fig">${fig(p)}</span><b>${esc(p.short)}</b></button>` : `<button type="button" class="eq-bp empty" data-open="players"><span class="eq-fig"><span class="eq-plus">+</span></span><b>Reserva</b></button>`).join("")}</div></div>`}
        </div>
      </div>`);
    },
    // v416 (Mickey) · escolha do técnico, no estilo do PC: retrato escolhido à esquerda com os pontos fortes, todos os técnicos em grade
    coach(id) { // v417: cada técnico tem passiva própria; Kurogane é o padrão e os outros são comprados aqui (Loja)
      const cur = G.coachDef(), sel = C.COACHES.find((c) => c.id === id) || cur || C.COACHES[0], nat = (n) => C.COACH_NATIONS.find((x) => x.id === n) || { id: n, name: n };
      const own = G.coachOwned(sel.id), isCur = cur && cur.id === sel.id, dm = G.state.diamonds || 0, lv = G.coachLv(sel.id), rr = C.RARITIES[lv], up = G.coachUpCost(sel.id), def = sel.id === C.COACH_DEFAULT;
      const pas = (c) => c.passive.replace(/(\d+)%/g, (_, n) => `${+n + Math.round(G.coachLv(c.id) * C.COACH_UP_STEP * 100)}%`); // v418: % da passiva já com a raridade
      const upBtn = own && !def ? (up ? `<button type="button" class="pc-btn wide co-up" data-coach-up="${sel.id}" ${dm < up ? "disabled" : ""}>Evoluir para ${C.RARITIES[lv + 1].name} · ${fmt(up)} ◆<small>+${Math.round(C.COACH_UP_STEP * 100)}% na especialidade</small></button>` : `<span class="pc-note">Raridade máxima</span>`) : "";
      const act = upBtn + (isCur ? `<span class="pc-note">Já é o seu técnico</span>` : own ? `<button type="button" class="pc-btn wide hot" data-coach-set="${sel.id}">Escolher ${esc(sel.name.split(" ")[0])}</button>`
        : `<button type="button" class="pc-btn wide hot co-buy" data-coach-buy="${sel.id}" ${dm < C.COACH_PRICE ? "disabled" : ""}>Contratar · ${fmt(C.COACH_PRICE)} ◆</button>${dm < C.COACH_PRICE ? `<span class="pc-note">Você tem ${fmt(dm)} Diamantes</span>` : ""}`);
      openModal("Técnicos", `<div class="pc co-pick">
        <div class="pct-h"><h3>Técnicos</h3><button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button></div>
        <div class="pc-main">
          <div class="pct-left"><div class="pc-hero co-hero">
            <div class="pc-chips"><span>${esc(nat(sel.nation).name)}</span>${own ? `<span style="color:${rr.color};border-color:${rr.color}">${rr.name}</span>` : ""}${isCur ? `<span class="co-now">Seu técnico</span>` : own ? `<span class="co-now">Contratado</span>` : `<span>🔒 Loja</span>`}</div>
            <div class="sh-flip co-flip" style="--rc:${own ? rr.color : "#26D9FF"}" title="Clique para virar"><div class="sh-in">
              <span class="co-big sh-face ${own ? "" : "lock"}"><img src="${sel.src}" alt=""></span>
              <div class="sh-back"><div class="sh-sec"><h5>Passiva${own && !def ? ` · ${rr.name}` : ""}</h5><p>${esc(pas(sel))}</p></div><div class="sh-sec"><h5>Lore</h5><p>${esc(sel.lore)}</p></div></div>
            </div></div>
            <b class="pct-name">${esc(sel.name)}</b></div>
            <div class="pc-acts">${act}</div>
          </div>
          <div class="pc-right"><label class="sh-chk co-chk"><input type="checkbox" id="coAll" ${coachUi.all ? "checked" : ""}> Exibir não habilitados</label><div class="co-grid">${C.COACHES.filter((c) => coachUi.all || G.coachOwned(c.id)).map((c) => { const o = G.coachOwned(c.id);
            return `<button type="button" class="co-tile ${c.id === sel.id ? "on" : ""} ${o ? "" : "lock"}" data-coach-pick="${c.id}" title="${esc(c.name)}" style="--rc:${o ? C.RARITIES[G.coachLv(c.id)].color : "#5b6a90"}">
            <span class="co-face"><img src="${c.src}" alt=""></span><b>${esc(c.name)}</b><small>${o ? `<i style="color:${C.RARITIES[G.coachLv(c.id)].color}">${C.RARITIES[G.coachLv(c.id)].name}</i>` : `🔒 ${fmt(C.COACH_PRICE)} ◆`}</small>${cur && c.id === cur.id ? `<span class="co-tag">Atual</span>` : ""}</button>`; }).join("")}</div></div>
        </div></div>`);
      const ck = document.getElementById("coAll"); if (ck) ck.onchange = () => { coachUi.all = ck.checked; MODALS.coach(sel.id); };
      const fl = document.querySelector("#modalBody .co-flip"); // v423: igual à Loja, clique vira (passiva/lore atrás), sair com o mouse desvira
      if (fl) { fl.onclick = () => fl.classList.toggle("flip"); fl.onmouseleave = () => fl.classList.remove("flip"); }
    },
    // v281 · PC do treinador (ref. do Mickey): jogador escolhido à esquerda, elenco em grade com filtros e a equipe ativa embaixo.
    // Escalar com o time cheio pergunta quem sai (swapIn): os cards da equipe viram "Sai este".
    players() {
      if (pcUi.tab === "marcos") return pcMarcos(); // v583
      if (pcUi.tab === "dex") return pcDex(); // v708
      const s = G.state, limit = G.lineupLimit(), lineup = G.lineup();
      if (!s.roster.some((p) => p.uid === pcUi.sel)) pcUi.sel = lineup[0] || (s.roster[0] && s.roster[0].uid);
      const inP = swapIn && G.player(swapIn);
      const sel = (k, label, opts) => `<label class="pc-sel"><select data-pc-f="${k}" aria-label="${label}">${opts.map(([v, t]) => `<option value="${v}" ${pcUi[k] === v ? "selected" : ""}>${label}: ${t}</option>`).join("")}</select></label>`;
      const team = lineup.map((u) => G.player(u)).filter(Boolean), bench = G.bench();
      const tcard = (p) => { const need = C.playerXpToNext(p.level);
        return `<button type="button" class="pc-tm ${p.uid === pcUi.sel ? "on" : ""} ${inP ? "out" : ""}" ${inP ? `data-swap-out="${p.uid}"` : `data-pc-pick="${p.uid}"`} data-pc-drop="t|${p.uid}" draggable="true" data-pc-drag="${p.uid}" style="--rc:${rar(p.rarity).color}">${pcFig(p)}<span class="pc-tm-t"><b>${esc(p.short)}</b><small>Nv.${p.level}</small><span class="pc-tm-xp"><i style="width:${Math.min(100, (p.xp / need) * 100)}%"></i></span></span>${inP ? `<em>Sai este</em>` : ""}</button>`; };
      const html = `<div class="pc">
        <div class="pct-h"><h3>PC do treinador</h3>${pcTabs()}
          <button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button></div>
        <div class="pc-main">
          <div class="pct-left" id="pcLeft">${pcLeftHtml()}</div>
          <div class="pc-right">
            <div class="pc-filters">
              <div class="pc-count"><b id="pcCount">0</b><span>/${s.roster.length} jogadores</span></div>
              <label class="pc-q"><span aria-hidden="true">⌕</span><input type="search" data-pc-q placeholder="Buscar jogador" value="${esc(pcUi.q)}" aria-label="Buscar jogador"></label>
              ${sel("rar", "Raridade", [["", "todas"], ...C.RARITIES.map((r) => [r.id, r.name])])}
              ${sel("pos", "Posição", [["", "todas"], ...C.POSITIONS.map((p) => [p.id, p.name])])}
              ${sel("st", "Estado", [["", "todos"], ["time", "na equipe"], ["livre", "livres"], ["fora", "fora (Expedição/Boss)"]])}
              ${sel("ord", "Ordem", [["nivel", "nível"], ["poder", "poder"], ["raridade", "raridade"], ["nome", "nome"]])}
              <button type="button" class="pc-btn" data-pc-clear>Limpar</button>
            </div>
            <div class="pc-grid" id="pcGrid" data-pc-drop="g|">${pcGridHtml()}</div>
          </div>
        </div>
        <div class="pc-team ${inP ? "swapping" : ""}">
          <div class="pc-team-h with-bench" style="--tn:${Math.max(limit, team.length)}"><div class="pc-team-hl"><b>Equipe ativa ${team.length}/${limit}</b><span>${inP ? `Quem sai para <b>${esc(inP.short)}</b> entrar? <button type="button" class="pc-btn" data-swap-cancel="1">Cancelar</button>` : s.training ? `Treino: de 1 a ${C.TRAINING_MAX} jogadores, a troca aparece na hora` : ""}</span></div><b class="pc-bench-h">Reservas ${bench.length}/${C.BENCH_SIZE}</b></div>
          <div class="pc-team-row with-bench" style="--tn:${Math.max(limit, team.length)}">${team.map(tcard).join("")}${Array.from({ length: Math.max(0, limit - team.length) }, () => `<div class="pc-tm empty" data-pc-drop="t|"><span>+</span><small>Vaga livre</small></div>`).join("")}<i class="pc-bench-sep"></i>${Array.from({ length: C.BENCH_SIZE }, (_, i) => { const p = bench[i]; // v376 (Mickey): reservas embaixo da equipe ativa; clicar abre a janela Reservas
            return p ? `<button type="button" class="pc-tm" data-bench-slot="${i}" data-pc-drop="b|${i}" draggable="true" data-pc-drag="${p.uid}" style="--rc:${rar(p.rarity).color}" title="Trocar ou tirar reserva">${pcFig(p)}<span class="pc-tm-t"><b>${esc(p.short)}</b><small>Nv.${p.level} · Reserva</small><span class="pc-tm-xp"><i style="width:${Math.min(100, (p.xp / C.playerXpToNext(p.level)) * 100)}%"></i></span></span></button>`
              : `<button type="button" class="pc-tm empty pc-bench-add" data-bench-slot="${i}" data-pc-drop="b|${i}"><span>+</span><small>Escolher reserva</small></button>`; }).join("")}
            ${pcMoveBtn()}</div>
        </div>
      </div>`;
      openModal("PC do treinador", html);
      const c = $("pcCount"); if (c) c.textContent = pcList().length;
    },
    espolios() { // v382 (Mickey): mesmo estilo da Mochila
      const s = G.state, kinds = CH_ORDER.filter((k) => espUi.cat === "todos" || espUi.cat === k);
      if (!espUi.sel || !kinds.includes(espUi.sel)) espUi.sel = kinds.find((k) => espCount(k)) || kinds[0];
      const tabs = [["todos", "Todos", "🧰"], ...CH_ORDER.slice().reverse().map((k) => [k, CH_TAB[k], ""])].map(([id, nm, ic]) => { const n = id === "todos" ? s.chests.length : espCount(id);
        return `<button type="button" class="bg-tab ${espUi.cat === id ? "on" : ""}" data-esp-cat="${id}">${ic ? `<i>${ic}</i>` : `<i class="es-dot" style="--rc:${CH_COLOR[id]}"></i>`}${nm}<span>${fmt(n)}</span></button>`; }).join("");
      const cards = kinds.map((k) => { const n = espCount(k), K = C.CHEST_KINDS[k];
        return `<button type="button" class="bg-card es-card ${k === espUi.sel ? "on" : ""} ${n ? "" : "zero"}" data-esp-pick="${k}" style="--rc:${CH_COLOR[k]}"><b>${K.name}</b><small>Espólios · ${CH_TAB[k]}</small><span class="bg-art">${esChest(k)}</span><span class="bg-qty">Guardados <em>× ${fmt(n)}</em></span><span class="bg-desc">${K.gold[0]}–${K.gold[1]} Gold + 1 item</span></button>`; }).join("");
      openModal("Espólios", `<div class="pc bg esx">
        <div class="pct-h bg-h"><span class="bg-ico">${esChest("azul")}</span><div><small class="bg-k">Recompensas</small><h3>Espólios</h3></div><p class="esx-sub">Baús das partidas. Itens raros para cima avisam no canto.</p>
          <button type="button" class="bg-go es-all" data-chest-all="*" ${s.chests.length ? "" : "disabled"}>Abrir todos (${fmt(s.chests.length)})</button>
          <button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button></div>
        <div class="bg-main"><div class="bg-left" id="espLeft">${espLeftHtml(espUi.sel)}</div>
          <div class="bg-right"><div class="bg-tabs">${tabs}</div><div class="bg-grid es-grid">${cards}</div></div></div>
      </div>`);
    },
    mochila() { // v381 (Mickey): ref de inventário (abas, grade e item em destaque)
      const s = G.state, all = bagEntries();
      if (!all.some((e) => e.key === bagUi.sel)) bagUi.sel = (bagList(all)[0] || all[0] || {}).key || null;
      const sel = all.find((e) => e.key === bagUi.sel);
      const opt = (k, label, opts) => `<label class="pc-sel"><small>${label}</small><select data-bag-f="${k}" aria-label="${label}">${opts.map(([v, t]) => `<option value="${v}" ${bagUi[k] === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
      const tabs = C.BAG_CATS.map((c) => { const n = all.filter((e) => c.id === "todos" || e.cat === c.id || (c.id === "forja" && e.cat === "ficha")).reduce((a, e) => a + e.n, 0);
        return `<button type="button" class="bg-tab ${bagUi.cat === c.id ? "on" : ""}" data-bag-cat="${c.id}"><i>${c.icon}</i>${c.name}<span>${fmt(n)}</span></button>`; }).join("");
      openModal("Mochila", `<div class="pc bg">
        <div class="pct-h bg-h"><span class="bg-ico">🎒</span><div><small class="bg-k">Inventário</small><h3>Mochila</h3><p>Equipamentos, energia e itens do treinador.</p></div>
          <button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button></div>
        <div class="bg-bar"><label class="pc-q bg-q"><span aria-hidden="true">⌕</span><input type="search" data-bag-q placeholder="Buscar na mochila" value="${esc(bagUi.q)}" aria-label="Buscar na mochila"></label>
          ${opt("rar", "Exibir", [["", "Todas as raridades"], ...C.RARITIES.filter((r) => r.id !== "despertado").map((r) => [r.id, r.name])])}
          ${opt("ord", "Ordenar", [["raridade", "Raridade"], ["nome", "Nome"], ["qtd", "Quantidade"]])}</div>
        <div class="bg-main"><div class="bg-left" id="bagLeft">${bagLeftHtml(sel)}</div>
          <div class="bg-right"><div class="bg-tabs">${tabs}</div><div class="bg-grid" id="bagGrid">${bagGridHtml(all)}</div></div></div>
      </div>`);
    },
    pitches() { // v312: Seus mapas (campos com efeito na partida). Fora do dev só o Estádio está liberado
      const cur = G.pitchId();
      openModal("Seus mapas", `<div class="sm">
        <div class="sm-h"><div><span class="sm-k">Campos</span><h2>Seus mapas</h2><p>Cada campo muda a partida para os dois times. Cada Boss joga no campo da casa dele. Libere um campo por ${fmt(C.PITCH_COST.gold)} Gold ou ${C.PITCH_COST.dia} Diamantes.</p></div>
          <button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button></div>
        <div class="sm-grid">${C.PITCHES.map((pt) => { const on = pt.id === cur, ok = G.pitchUnlocked(pt.id);
          const home = Object.keys(C.BOSS_HOME || {}).filter((id) => C.BOSS_HOME[id] === pt.id).map((id) => (BL.CHAR_BY_ID[id] || {}).short || id).join(" e "), hm = home ? `<small class="sm-home">Casa de ${esc(home)}</small>` : "", K = C.PITCH_COST;
          if (!ok) return `<div class="sm-card lock"><span class="sm-img" style="background-image:url('${pt.img}')"></span><span class="sm-tag">🔒 Bloqueado</span><b>${pt.name}</b><small>${pt.desc}</small>${hm}
            <span class="sm-buy"><button type="button" class="btn" data-pitch-buy="${pt.id}:gold"><i class="ic-coin"></i> ${fmt(K.gold)}</button><button type="button" class="btn" data-pitch-buy="${pt.id}:dia"><i class="ic-dia"></i> ${K.dia}</button></span></div>`; // v693: compra por Gold ou Diamantes
          return `<button type="button" class="sm-card${on ? " on" : ""}" ${!on ? `data-pitch="${pt.id}"` : ""}>
            <span class="sm-img" style="background-image:url('${pt.img}')"></span>
            <span class="sm-tag">${on ? "Jogando agora" : "Jogar aqui"}</span>
            <b>${pt.name}</b><small>${pt.desc}</small>${hm}</button>`; }).join("")}</div>
        <div class="sm-ft"><button type="button" class="btn${G.state.training ? " btn-hot" : ""}" data-hub-go data-hub-train>${G.state.training ? "Sair do treino" : "Modo treino"}</button><button type="button" class="btn" data-open="maps">Ver fases do mapa</button></div></div>`);
    },
    bench(i) { // v310: janela Reservas no layout da ref do Mickey (busca, filtros, ordenação e lista em linhas)
      const s = G.state, act = G.activePlayers(), b = G.bench();
      const list = s.roster.filter((p) => !act.includes(p) && !b.includes(p) && !G.isAway(p.uid));
      const cur = b[i], MX = C.PLAYER_MAX_LEVEL, q4 = Math.round(MX / 4);
      const lvBands = [[1, q4], [q4 + 1, q4 * 2], [q4 * 2 + 1, q4 * 3], [q4 * 3 + 1, MX]];
      const rarIdx = (id) => C.RARITIES.findIndex((r) => r.id === id);
      const row = (p, isCur) => { const r = rar(p.rarity);
        return `<div class="bn-row${isCur ? " cur" : ""}" data-n="${esc(p.name.toLowerCase())}" data-r="${p.rarity}" data-ri="${rarIdx(p.rarity)}" data-p="${p.position}" data-l="${p.level}" data-w="${BL.power(p)}" data-nt="${esc(p.nature || "")}">
          <span class="bn-fig" style="--rc:${r.color}">${pcFig(p)}</span>
          <div class="bn-id"><b>${esc(p.name)}</b><div class="bn-tags"><span class="bn-rar" style="--rc:${r.color}">♛ ${r.name}</span><i>/</i><span class="bn-lv">Nv ${fmt(p.level)}</span><span class="bn-pos">${POS_TAG[p.position] || ""}</span></div></div>
          ${isCur ? `<button type="button" class="bn-add out" data-bench-set="${i}|">Tirar</button>` : `<button type="button" class="bn-add" data-bench-set="${i}|${p.uid}">Adicionar</button>`}</div>`; };
      const sel = (id, label, opts) => `<label class="bn-f"><small>${label}</small><select id="${id}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>`;
      const nats = [...new Set(list.map((p) => p.nature).filter(Boolean))].sort();
      openModal("Reservas", `<div class="bn">
        <div class="bn-h"><span class="bn-hex" aria-hidden="true"><svg viewBox="0 0 32 32"><circle cx="12" cy="10" r="5" fill="currentColor"/><path d="M3 27c0-6 4-10 9-10s9 4 9 10z" fill="currentColor"/><circle cx="23" cy="21" r="6" fill="#0a2a66" stroke="currentColor" stroke-width="2"/><path d="M23 18v6M20 21h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></span>
          <div><h2>Reservas</h2><p>O reserva vai para a partida e pode entrar no lugar de um titular no Vestiário (intervalo), com energia cheia.</p></div>
          <button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button></div>
        <div class="bn-bar"><label class="bn-q"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="bnQ" type="search" placeholder="Buscar jogador..." autocomplete="off"></label>
          ${sel("bnR", "Raridade", [["", "Todas"], ...C.RARITIES.map((r) => [r.id, r.name])])}
          ${sel("bnP", "Posição", [["", "Todas"], ...Object.entries(POS_TAG)])}
          ${sel("bnL", "Nível", [["", "Todos"], ...lvBands.map(([a, z], k) => [k, `${a}–${z}`])])}
          ${sel("bnN", "Nature", [["", "Todas"], ...nats.map((n) => [n, n])])}
          <label class="bn-f bn-sort"><small>&nbsp;</small><select id="bnS"><option value="n">⇅ Nome (A-Z)</option><option value="l">⇅ Nível</option><option value="w">⇅ Poder</option><option value="r">⇅ Raridade</option></select></label></div>
        <div class="bn-list" id="bnList">${cur ? row(cur, true) : ""}${list.map((p) => row(p)).join("")}<p class="bn-empty" id="bnEmpty" ${list.length ? "hidden" : ""}>${list.length ? "Nenhum jogador com esses filtros." : "Todos os outros jogadores já estão escalados ou no banco."}</p></div></div>`);
      const box = $("bnList"), rows = [...box.querySelectorAll(".bn-row:not(.cur)")];
      const apply = () => {
        const q = $("bnQ").value.trim().toLowerCase(), r = $("bnR").value, ps = $("bnP").value, lv = $("bnL").value, nt = $("bnN").value, so = $("bnS").value;
        let n = 0;
        rows.forEach((el) => { const d = el.dataset, L = +d.l, band = lv === "" ? null : lvBands[+lv];
          const ok = (!q || d.n.includes(q)) && (!r || d.r === r) && (!ps || d.p === ps) && (!band || (L >= band[0] && L <= band[1])) && (!nt || d.nt === nt);
          el.hidden = !ok; if (ok) n++; });
        rows.sort((x, y) => so === "l" ? y.dataset.l - x.dataset.l : so === "w" ? y.dataset.w - x.dataset.w : so === "r" ? y.dataset.ri - x.dataset.ri || y.dataset.l - x.dataset.l : x.dataset.n.localeCompare(y.dataset.n)).forEach((el) => box.insertBefore(el, $("bnEmpty")));
        if (list.length) $("bnEmpty").hidden = n > 0;
      };
      ["bnQ", "bnR", "bnP", "bnL", "bnN", "bnS"].forEach((id) => $(id).addEventListener(id === "bnQ" ? "input" : "change", apply));
      apply();
    },
    vestiario() {
      if (!G.vest || !G.match) return;
      const m = G.match, st = G.vestStats(), c = G.cons(), size = G.map.size;
      const left = Math.max(0, Math.ceil((G.vest.until - Date.now()) / 1000));
      // v284 · visual novo (ref. do Mickey): painéis chanfrados, barras azul (seu time) e rosa (adversário)
      const row = (label, k) => `<div class="vx-row"><span class="vx-lbl">${label}</span><b>${st[k][0]}%</b><span class="vx-bar me"><i style="width:${Math.min(100, st[k][0])}%"></i></span><b>${st[k][1]}%</b><span class="vx-bar them"><i style="width:${Math.min(100, st[k][1])}%"></i></span></div>`;
      const en = (e) => Math.round(e.energy);
      const bar = (v, them) => `<span class="vx-en"><i style="width:${v}%;background:${v > 50 ? "linear-gradient(90deg,#1fd17a,#4ff0a0)" : v > 25 ? "linear-gradient(90deg,#e0b020,#ffd23f)" : "linear-gradient(90deg,#ff2f6e,#ff6f9b)"}"></i></span><b class="vx-pct">${v}%</b>`;
      const mine = m.field(0).map((e) => `<div class="vx-pl"><span class="vx-name">${esc(e.p.short)}</span>${bar(en(e))}<span class="vx-heals">${Object.entries(C.CONSUMABLES).filter(([id, it]) => !it.chest || c[id] > 0).map(([id, it]) => `<button type="button" class="vx-heal" data-vest-heal="${e.p.uid}|${id}" ${!c[id] || e.energy >= 100 ? "disabled" : ""} title="${it.name} (${it.desc.toLowerCase()}) · ${fmt(c[id] || 0)}">${it.icon}<b>${shortCount(c[id] || 0)}</b></button>`).join("")}</span></div>`).join("");
      const theirs = m.field(1).map((e) => `<div class="vx-pl"><span class="vx-name">${esc(e.p.short)}</span>${bar(en(e), true)}</div>`).join("");
      const bench = G.benchFree();
      const subs = bench.length ? bench.map((p) => `<div class="vx-pl vx-sub"><span class="vx-name">${esc(p.short)} <small>Nv ${p.level}</small></span>${bar(100)}<select data-vest-sub="${p.uid}"><option value="">Fica no banco</option>${m.field(0).map((e) => `<option value="${e.p.uid}">Entra no lugar de ${esc(e.p.short)} (${en(e)}%)</option>`).join("")}</select></div>`).join("") : `<p class="vx-note">Sem reservas nesta partida. Escolha até ${C.BENCH_SIZE} no Meu time.</p>`;
      const tacs = G.tactics();
      const tacSel = tacs.length > 1 ? `<div class="vx-tac"><label for="vestTac">${size === 4 ? "Formação" : "Tática"} do 2º tempo</label><select id="vestTac">${tacs.map((t) => `<option value="${t.id}" ${G.myTactic && t.id === G.myTactic.id ? "selected" : ""}>${esc(t.name)}${t.type ? " · " + C.FORMATION_TYPE[t.type] : ""}</option>`).join("")}</select><small>Grátis, não gasta a Pausa tática</small></div>` : "";
      const read = G.vestReading();
      openModal("Vestiário", `<div class="vx">
        <div class="vx-h"><h3>Vestiário</h3><button type="button" class="vx-x" data-vest-back="1" aria-label="Fechar e voltar ao jogo">✕</button></div>
        <div class="vx-top"><span class="vx-score">${m.score[0]} × ${m.score[1]} <small>no 1º tempo</small></span><span class="vx-count">Volta em <b id="vestCount">${left}</b><b class="vx-s">s</b></span><button type="button" class="vx-back" data-vest-back="1">Voltar ao jogo</button></div>
        ${read ? `<p class="vx-read"><span>Técnico</span><i>/</i>${esc(read)}</p>` : ""}
        <div class="vx-panel vx-stats"><div class="vx-row vx-head"><span></span><b class="me">${esc(G.teamTag() || G.teamName())}</b><b class="them">${esc(G.enemyTeam)}</b></div>${row("Posse", "poss")}${row("Chutes", "shots")}${row("Passes certos", "passAcc")}${row("Roubadas", "steals")}</div>
        <div class="vx-cols"><div class="vx-panel"><h4>Energia · seu time</h4>${mine}</div><div class="vx-panel"><h4>Energia · ${esc(G.enemyTeam)}</h4>${theirs}</div></div>
        <div class="vx-panel"><h4>Reservas</h4>${subs}</div>
        ${tacSel}
      </div>`);
      const body = $("modalBody");
      body.querySelectorAll("[data-vest-sub]").forEach((sel) => (sel.onchange = () => { if (sel.value && G.subIn(sel.dataset.vestSub, sel.value)) { renderMyTeam(); MODALS.vestiario(); } }));
      const ts = $("vestTac"); if (ts) ts.onchange = () => { G.vestTactic(ts.value); renderTactic(); MODALS.vestiario(); };
      // v147: clicar à toa não zera mais o relógio; só trocar jogador, formação ou usar item reinicia a contagem (VESTIARIO_SECONDS)
    },
    pausa() {
      const cur = G.myTactic, tag = (t) => (t.type ? ` · ${C.FORMATION_TYPE[t.type]}` : "");
      const btns = G.tactics().map((t) => `<button type="button" class="btn pause-pick${cur && t.id === cur.id ? " on" : ""}" data-pause-pick="${t.id}">${esc(t.name)}${tag(t)}</button>`).join("");
      openModal("Pausa tática", `<p class="note">Partida congelada. Escolha a ${G.map.size === 4 ? "formação" : "tática"} e o jogo volta na hora. Só 1 pausa por partida; fechar sem escolher não gasta a pausa.</p><div class="pause-list">${btns}</div>`);
    },
    loja() { // v475 (Mickey, ref "Poké Mart"): cabeçalho com saldos, Comprar/Vender, item à esquerda com quantidade e total, grade por categoria com busca
      const s = G.state, all = shopEntries(), sell = shopUi.mode === "vender";
      const tabs = (sell ? [["todos", "🎒", "Todos"]] : [["todos", "🎒", "Todos"], ["energia", "⚡", "Energia"], ["roubo", "🎯", "Roubo"]]).concat(sell ? [["chuteira", "👟", "Chuteiras"], ["caneleira", "🛡️", "Caneleiras"]] : []).concat([["camisa", "👕", "Camisas"]]).concat(sell ? [["treinador", "🧢", "Treinador"]] : []).concat(sell ? [["energia", "⚡", "Energia"], ["roubo", "🎯", "Roubo"], ["xp", "✦", "XP"]] : [["tecnicos", "🧑‍💼", "Técnicos"]]);
      if (!tabs.some(([id]) => id === shopUi.cat)) shopUi.cat = "todos";
      const inCat = (x, c) => (c === "todos" ? x.kind !== "coach" : x.cat === c), list = shopList(all);
      if (!list.some((e) => e.key === shopUi.sel)) { shopUi.sel = (list[0] || {}).key; shopUi.qty = 1; }
      const e = all.find((x) => x.key === shopUi.sel), price = (n, cur) => `<b class="${cur === "dia" ? "sh-dia" : "sh-gold"}">${shopCur(cur)} ${fmt(n)}</b>`;
      let left = `<div class="bg-left-empty"><i>${sell ? "🎒" : "🛒"}</i><p>${sell ? "Nada para vender. Itens equipados não aparecem aqui." : "Nenhum item encontrado."}</p></div>`;
      if (e) {
        const max = shopMax(e); shopUi.qty = Math.max(1, Math.min(shopUi.qty || 1, max || 1));
        const have = e.cur === "dia" ? s.diamonds || 0 : s.gold, need = e.unit * shopUi.qty, cn = e.cur === "dia" ? "Diamantes" : "Gold";
        const qty = e.kind === "coach" ? "" : `<div class="shx-qh"><small>Quantidade</small><em>Máx. ${fmt(max)}</em></div>
          <div class="shx-qty" data-max="${max}"><button type="button" data-shop-qty="-1" aria-label="Menos">−</button><input id="shQty" type="number" min="1" max="${max}" value="${shopUi.qty}" aria-label="Quantidade"><button type="button" data-shop-qty="1" aria-label="Mais">+</button><button type="button" class="shx-max" data-shop-qty="max" ${max < 2 ? "disabled" : ""}>Máx.</button></div>`;
        // v650 (Mickey: intuitivo sem faltar informação): o botão já mostra o total; sem saldo, diz quanto falta
        const act = e.kind === "coach" ? (e.o ? `<button type="button" class="bg-go" data-open="coach">Ver nos Técnicos</button>` : (s.diamonds || 0) < C.COACH_PRICE ? `<button type="button" class="bg-go" disabled>Faltam ${shopCur("dia")} ${fmt(C.COACH_PRICE - (s.diamonds || 0))}</button>` : `<button type="button" class="bg-go" data-shop-hire="${e.id}">Contratar · ${shopCur("dia")} ${fmt(C.COACH_PRICE)}</button>`)
          : sell ? `<button type="button" class="bg-go shx-sell" data-shop-sell>Vender · ${shopCur("gold")} <span id="shBuyTot">${fmt(need)}</span></button>` : max < 1 ? `<button type="button" class="bg-go" disabled>${cn} insuficiente · faltam ${shopCur(e.cur)} ${fmt(e.unit - have)}</button>` : `<button type="button" class="bg-go" data-shop-buy>Comprar · ${shopCur(e.cur)} <span id="shBuyTot">${fmt(need)}</span></button>`;
        const info = e.item ? [[e.item.mgr ? "Efeito no treinador" : "Bônus na partida", shopAb(e.desc)], ["Descrição", e.lore]] : e.kind === "coach" ? [["Passiva", e.desc], ["História", e.d.lore]] : e.lore ? [["Efeito", e.desc], ["Para que serve", e.lore], ["Onde conseguir", e.where]] : [["Efeito", e.desc], ["Como usar", e.how]];
        left = `<div class="shx-lhead"><h4 class="bg-name">${esc(e.name)}</h4><small class="bg-k c">${e.tag}</small></div>
          <div class="bg-stage shx-stage ${e.kind === "coach" ? "sh-coach" : ""} ${e.kind === "coach" && !e.o ? "lock" : ""}" style="--rc:${e.rc}">${e.icon}<span class="bg-rar">${esc(e.rname)}</span>${e.kind === "coach" ? "" : `<span class="shx-have">Na mochila <b>${fmt(e.have)}</b></span>`}</div>
          <div class="shx-info">${info.filter(([, t]) => t).map(([k, t]) => `<div class="shx-sec"><h5>${k}</h5><p>${esc(t)}</p></div>`).join("")}</div>
          <div class="shx-buy"><div class="shx-row"><small>${sell ? "Valor de venda" : "Preço unitário"}</small>${price(e.unit, e.cur)}</div>${qty}${act}</div>`;
      }
      openModal("Loja", `<div class="pc bg sh shx">
        <div class="pct-h bg-h shx-h"><span class="bg-ico shx-hic"><img src="img/menu/loja.png" alt=""></span><div><small class="shx-kick">Suprimentos</small><h3>Loja</h3><p>Compre e venda itens para o seu time.</p></div>
          <div class="shx-bal"><span><i class="ic-coin"></i> ${fmt(s.gold)}</span><span><i class="ic-dia"></i> ${fmt(s.diamonds || 0)}</span></div>
          <button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button></div>
        <div class="shx-modes"><button type="button" class="${sell ? "" : "on"}" data-shop-mode="comprar"><img src="img/menu/loja.png" alt="">Comprar</button><button type="button" class="${sell ? "on" : ""}" data-shop-mode="vender"><img src="img/gold.png" alt="">Vender itens</button><button type="button" disabled title="Em breve"><img src="img/menu/boss.png" alt="">Loja do Boss<em>Em breve</em></button><button type="button" data-clan-open="loja"><img src="img/menu/guilda.png" alt="">Loja da Guilda</button><label class="shx-q"><span>🔍</span><input type="search" data-shop-q placeholder="Buscar itens..." value="${esc(shopUi.q)}" aria-label="Buscar itens"></label></div>
        <div class="bg-main"><div class="bg-left">${left}</div>
          <div class="bg-right"><div class="shx-bar"><div class="bg-tabs">${tabs.filter(([id]) => !sell || id === "todos" || id === shopUi.cat || all.some((x) => inCat(x, id))).map(([id, ic, n]) => `<button type="button" class="bg-tab ${shopUi.cat === id ? "on" : ""}" data-shop-cat="${id}"><i class="shx-ti">${shopTabIc(id, ic)}</i>${n}<span>${all.filter((x) => inCat(x, id) && (shopUi.owned || !x.o)).length}</span></button>`).join("")}</div></div>
            ${shopUi.cat === "tecnicos" ? `<label class="sh-chk"><input type="checkbox" id="shOwned" ${shopUi.owned ? "checked" : ""}> Exibir habilitados</label>` : ""}
            <div class="bg-grid" id="shGrid">${shopGridHtml(list)}</div></div></div>
        <p class="shx-foot">${sell ? `A venda devolve ${Math.round(C.SELL_RATE * 100)}% do preço da Loja em Gold. Itens equipados não aparecem aqui.` : "Os itens comprados vão direto para a Mochila."}</p>
      </div>`);
      const ck = document.getElementById("shOwned"); if (ck) ck.onchange = () => { shopUi.owned = ck.checked; MODALS.loja(); };
      const qi = document.getElementById("shQty"); if (qi) qi.onchange = () => shopQty(+qi.value || 1, true);
      const fl = document.querySelector("#modalBody .sh-flip"); // v422: clique vira o card (passiva/lore atrás), sair com o mouse desvira
      if (fl) { fl.onclick = () => fl.classList.toggle("flip"); fl.onmouseleave = () => fl.classList.remove("flip"); }
    },
    items() {
      const s = G.state;
      const act = G.activePlayers()[0];
      const inv = s.inventory.map((id, i) => {
        const it = BL.ITEM_BY_ID[id]; if (!it) return ""; const r = rar(it.rarity);
        const bonus = Object.entries(it.bonus).map(([k, v]) => `+${v} ${C.STAT_SHORT[k]}`).join(" ");
        return `<div class="card"><div class="inv-item"><div><b>${esc(it.name)}</b><div class="pc-meta"><span class="chip" style="color:${r.color}">${r.name}</span><span class="lv">${BL.ITEM_SLOTS[it.slot]}</span></div></div></div><span class="nat-up">${bonus}</span><button type="button" class="btn" data-equip="${i}">Equipar em ${esc(act.short)}</button></div>`;
      }).join("");
      openModal("Itens", `${inv ? `<div class="grid-cards">${inv}</div>` : `<p class="note">Nenhum item ainda. Abra baús em Espólios: eles aparecem quando você faz gol.</p>`}
        <h3 class="panel-h" style="margin-top:18px">Banco de itens</h3><div class="table-wrap"><table class="t"><thead><tr><th>Item</th><th>Slot</th><th>Raridade</th><th>Bônus</th></tr></thead><tbody>${BL.ITEMS.map((it) => `<tr><td>${esc(it.name)}</td><td>${BL.ITEM_SLOTS[it.slot]}</td><td style="color:${rar(it.rarity).color}">${rar(it.rarity).name}</td><td>${Object.entries(it.bonus).map(([k, v]) => `+${v} ${C.STAT_LABEL[k]}`).join(", ")}</td></tr>`).join("")}</tbody></table></div>`);
    },
    natures() { // v158: saiu da dock (agora fica na Wiki da landing); mantido só por compatibilidade
      const html = `<p class="note">Cada nature aumenta um status em ${C.NATURE_MOD * 100}% e diminui outro em ${C.NATURE_MOD * 100}%. As 6 da diagonal são neutras.</p><div class="nat-grid">${BL.NATURES.map((n) => `<div class="nat"><b>${esc(n.name)}</b>${n.up ? `<small class="nat-up">▲ ${C.STAT_LABEL[n.up]}</small><small class="nat-down">▼ ${C.STAT_LABEL[n.down]}</small>` : `<small class="note">Nature neutra</small>`}</div>`).join("")}</div>`;
      openModal("Natures", html);
    },
    maps() {
      const pr = G.state.progress;
      // v224: o mapa de fases saiu de baixo do campo (o campo cresceu) e mora aqui, na janela do "Mapa atual"
      const html = `<section class="stage-map sm-modal" id="stageMap" aria-label="Mapa de fases"></section><div id="mapsFase"></div><div class="grid-cards">${C.MAPS.map((m, i) => {
        const cur = i === pr.map;
        const open = G.mapUnlocked(i);
        const status = cur ? "Jogando agora" : open ? "Liberado" : i >= 4 ? `Bloqueado · vença o Boss do mapa ${i}` : `Bloqueado · precisa de ${m.size} jogadores no elenco`; /* v536 */
        return `<div class="card ${cur ? "active" : ""}"><div class="pc-name">${esc(m.name)}</div><div class="pc-meta"><span class="chip" style="color:var(--neon)">${m.mode}</span><span class="lv">Nv ${m.levelMin}–${m.levelMax}</span></div>
          ${m.boss ? `<div class="pc-row"><span>Boss</span><b>${esc(BL.CHAR_BY_ID[m.boss.charId].name)} · ${esc(m.boss.arena.name)}</b></div><div class="pc-row"><span>Arena</span><b>Boss +${Math.round(m.boss.arena.bossBuff * 100)}% · você −${Math.round(m.boss.arena.userDebuff * 100)}%</b></div>` : ""}
          ${m.boss ? "" : `<div class="pc-row"><span>Boss</span><b>Ainda não definido</b></div>`}
          <div class="pc-row"><span>Status</span><b>${status}</b></div>
          ${!cur && open ? `<button type="button" class="btn btn-hot" data-map="${i}">Jogar ${m.mode}</button>` : ""}</div>`;
      }).join("")}</div>
      <p class="note">Cada modo libera quando o elenco tem jogadores suficientes: 2 para o 2×2, 3 para o 3×3 e 4 para o 4×4. Trocar de mapa começa na fase 1 dele.</p>
      <p class="note">Rodadas completas do Mapa 1: ${pr.runs} · Boss vencido ${pr.bossWins}×</p>`;
      openModal("Mapas", html);
      $("mapsFase").appendChild(document.querySelector(".panel-fase")); renderObjective(); renderStageMap();
    },
    formations() {
      const row = (t) => `<tr><td>${esc(t.name)}</td><td>${t.type ? C.FORMATION_TYPE[t.type] : "—"}</td><td>${t.atk}</td><td>${G.map.size === 4 ? "" : ""}${t.mods ? Object.entries(t.mods).map(([k, v]) => `${C.STAT_LABEL[k]} −${Math.round((1 - v) * 100)}%`).join(", ") : "—"}</td></tr>`;
      openModal("Táticas e formações", `<p class="note">Escolha a do seu time no painel Meu time. Sem ninguém atacando, o time não rouba a bola: só sai no contra-ataque depois que o próprio goleiro defende.</p>
        ${[2, 3].map((n) => `<h3 class="panel-h" style="margin-top:14px">${n}×${n}</h3><div class="table-wrap"><table class="t"><thead><tr><th>Tática</th><th>Tipo</th><th>Atacam</th><th>Efeito</th></tr></thead><tbody>${C.TACTICS[n].map(row).join("")}</tbody></table></div>`).join("")}
        <h3 class="panel-h" style="margin-top:14px">4×4 · formações</h3>
        <div class="grid-cards">${C.TACTICS[4].map((t) => { const st = C.STYLES[t.style]; const ctr = (C.ATK_PRESETS || []).find((p) => p.beatenBy === t.type), weak = (C.ATK_PRESETS || []).find((p) => p.beats === t.type); // v597 · v635
          return `<div class="card"><div class="pc-name">${esc(t.name)} · ${esc(st.name)}</div><div class="pc-meta"><span class="chip" style="color:var(--neon)">${C.FORMATION_TYPE[t.type]}</span><span class="lv">${4 - t.atk} def · ${t.atk} ata</span></div>
            <p class="note">${esc(st.desc)}</p><div class="pc-row"><span>Countera o ataque</span><b style="color:var(--good)">${ctr ? esc(ctr.name) : "—"}</b></div><div class="pc-row"><span>Sofre contra o ataque</span><b style="color:var(--warn)">${weak ? esc(weak.name) : "—"}</b></div></div>`; }).join("")}</div>
        <p class="note">Pedra, papel e tesoura: cada ataque (aba Com a bola: Bola no pé, Plays setadas ou Equilíbrio) é forte contra uma formação, fraco contra outra e neutro contra a terceira. Somam-se as vantagens dos dois lados (a sua defesa contra o ataque deles e o seu ataque contra a defesa deles): quem fica com mais ganha +${Math.round(C.FORMATION_EDGE * 100)}% em todos os status (+${Math.round(C.FORMATION_EDGE * (C.FORMATION_EDGE2 || 1) * 100)}% com duas) e a marca do seu estilo fica mais forte (passes que atravessam, pressão alta ou desarme no próprio campo).</p>`);
    },
    dev() {
      const s = G.state, pr = s.progress;
      return `<p class="note">Só aparece para quem ativou o modo dev. Troca o modo na hora, sem precisar de elenco: faltando jogador, entra um de teste (não ganha XP e não fica no elenco).</p>
        <div class="dev-row">${C.MAPS.map((m, i) => `<button type="button" class="btn ${i === pr.map ? "btn-hot" : ""}" data-dev-map="${i}">${m.size}v${m.size}</button>`).join("")}</div>
        <div class="dev-k">Fase</div>
        <div class="dev-row">${Array.from({ length: C.STAGES_PER_MAP }, (_, i) => `<button type="button" class="btn dev-st ${i + 1 === pr.stage ? "btn-hot" : ""}" data-dev-stage="${i + 1}">${i + 1}</button>`).join("")}</div>
        <label class="toggle"><input type="checkbox" id="devEqual" ${s.devEqualLevel ? "checked" : ""}><span>Inimigos no nível do meu time</span></label>
        <div class="dev-row"><button type="button" class="btn btn-hot" data-dev-all="1">Liberar tudo</button><button type="button" class="btn" data-dev-restart="1">Reiniciar partida</button><button type="button" class="btn" data-dev-chem="react">Testar Reação Química</button><button type="button" class="btn" data-dev-chem="ego">Testar Ego em Colisão</button><button type="button" class="btn" data-dev-late="gold">Próxima: Time Dourado</button><button type="button" class="btn" data-dev-late="legend">Próxima: jogada lendária</button><button type="button" class="btn" data-dev-off="1">Desligar modo dev</button></div>`;
    },
    profile() {
      const s = G.state, ca = s.career || { wins: 0, goals: 0, steals: 0 }, act = G.activePlayers().length;
      const atos = C.MAPS.filter((_, i) => (s.progress.cleared || {})[i]).length;
      const tile = (ic, n, t) => `<div class="pf-tile"><i class="pf-ic" aria-hidden="true">${ic}</i><div><b>${n}</b><span>${t}</span></div></div>`;
      openModal("Perfil", `<div class="pf">
        <div class="pf-h"><h2><i aria-hidden="true"></i>Perfil</h2><button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button></div>
        <div class="pf-card">
          <div class="pf-id"><div class="pf-av-w"><div class="pf-av" id="pfAv"></div><button type="button" class="pf-btn pf-avbtn" id="avOpen">Editar aparência</button></div><div><div class="pf-name">${esc(s.name)}</div><div class="pf-meta"><span>Conta Nv. ${s.account.level}</span>${s.vip ? `<span class="pf-vip">♛ VIP</span>` : `<span class="pf-novip">Sem VIP</span>`}</div></div></div>
          <div class="pf-team"><div><span class="pf-lbl">Nome do time</span><div class="pf-tn"><span class="pf-tag">${esc(G.teamTag())}</span><b>${esc(G.teamName())}</b></div></div><button type="button" class="pf-btn" id="teamEdit">${G.renameCost() ? `Alterar nome/Tag · ${G.renameCost()} ◆` : "Alterar nome/Tag (grátis)"}</button></div>
          <form class="team-form" id="teamForm" hidden><label class="name-field"><span>Nome do time (mín. ${C.NAME_MIN})</span><input id="teamInput" type="text" maxlength="22" value="${esc(G.teamName())}" autocomplete="off"></label><label class="name-field tag-field"><span>Tag (até ${C.TEAM_TAG_MAX} letras)</span><input id="tagInput" type="text" maxlength="${C.TEAM_TAG_MAX}" value="${esc(G.teamTag())}" autocomplete="off" autocapitalize="characters"></label><button type="submit" class="btn btn-hot">Confirmar</button></form>
          <p class="pf-note" id="teamNote">${G.renameCost() ? `Você já usou a troca grátis. Cada nova troca custa ${G.renameCost()} Diamantes.` : "A primeira troca é grátis. Depois disso, cada troca custa " + C.TEAM_RENAME_DIAMONDS + " Diamantes."}</p>
        </div>
        ${C.TITLES ? `<div class="pf-card pf-tit"><div class="pf-jh"><div><span class="pf-lbl">Títulos</span><h3>Conquiste e use como nome do time</h3></div></div><div class="pf-tits">${C.TITLES.map((x) => { const v = Math.min(x.n, G.titleVal(x)), ok = v >= x.n, on = G.teamName() === x.name;
          return `<div class="pf-ti ${ok ? "ok" : ""} ${on ? "on" : ""}"><b>${ok ? "" : "🔒 "}${esc(x.name)}</b><small>${esc(x.desc)} · ${fmt(v)}/${fmt(x.n)}</small>${ok ? (on ? `<em>Em uso</em>` : `<button type="button" class="pf-btn" data-title-use="${x.id}">Usar como nome</button>`) : `<i style="--w:${(v / x.n) * 100}%"></i>`}</div>`; }).join("")}</div></div>` : ""}
        <div class="pf-card pf-jr">
          <div class="pf-jh"><div><span class="pf-lbl">Jornada</span><h3>Seus números no BL PROJECT</h3></div><span class="pf-act">${act} / ${C.TRAINING_MAX} no time</span></div>
          <div class="pf-grid">${tile("⚽", fmt(s.matchNo || 0), "Partidas jogadas")}${tile("🏆", fmt(ca.wins), "Vitórias")}${tile("🥅", fmt(ca.goals), "Gols marcados")}${tile("🎯", fmt(ca.steals), "Jogadores roubados")}${tile("👥", s.roster.length, "Jogadores no elenco")}${tile("✨", s.roster.filter((p) => p.shiny).length, "Shinies obtidos")}${tile("👑", fmt(s.progress.bossWins || 0), "Bosses vencidos")}${tile("🗺️", `${atos} / ${C.MAPS.length}`, "Atos zerados")}</div>
        </div><p class="pf-note">Os status do goleiro (Save e SB) vêm do nível da conta e sobem nos níveis 25, 50 e 75.</p></div>`);
      $("tagInput").oninput = (e) => { const c = BL.cleanTag(e.target.value); if (e.target.value !== c) e.target.value = c; };
      avatarInto($("pfAv"), s); $("avOpen").onclick = () => avEditor();
      $("teamEdit").onclick = () => { $("teamForm").hidden = false; $("teamInput").focus(); $("teamInput").select(); };
      $("teamForm").onsubmit = (ev) => { ev.preventDefault(); const r = G.setTeamName($("teamInput").value, $("tagInput").value); if (r.ok) { toast(r.msg); MODALS.profile(); } else $("teamNote").textContent = r.msg; };
    },
    trainPick() { // v295: Escolher quem treina (4 slots por lado, lista com filtro de posição)
      if (!trUi.a) { const m = G.match, f = (t) => (m && (m.scrimmage || m.training) ? m.field(t).map((e) => e.p.uid) : []); trUi.a = f(0); trUi.b = m && m.scrimmage ? f(1) : []; trUi.slot = "a0"; }
      const pad = (l) => Array.from({ length: C.TRAINING_MAX }, (_, i) => l[i] || null);
      const A = pad(trUi.a), B = pad(trUi.b), used = new Set(A.concat(B).filter(Boolean));
      const [side, idx] = [trUi.slot[0], +trUi.slot.slice(1)], cur = (side === "a" ? A : B)[idx];
      const slot = (sd, l) => l.map((u, i) => { const p = u && G.player(u), on = trUi.slot === sd + i;
        return `<button type="button" class="tp-slot ${on ? "on" : ""} ${p ? "" : "empty"}" data-tp-slot="${sd}${i}">${p ? `${pcFig(p)}<div><b>${esc(p.short)}</b><small>${POS_TAG[p.position] || ""} · Nv ${p.level}</small></div>` : `<span class="tp-plus">+</span><div><b>Vazio</b><small>Clique para escolher</small></div>`}</button>`; }).join("");
      const list = G.state.roster.filter((p) => G.trainFree(p) && (!used.has(p.uid) || p.uid === cur) && (trUi.pos === "all" || p.position === trUi.pos))
        .sort((x, y) => y.level - x.level);
      openModal("Escolher quem treina", `<div class="tp">
        <div class="tp-h"><div><span class="tp-k">Modo treino</span><h2>Escolher quem treina</h2></div><button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button></div>
        <div class="tp-sides"><div class="tp-side me"><h3>Meu time</h3>${slot("a", A)}</div><div class="tp-vs">VS</div><div class="tp-side them"><h3>Adversário</h3>${slot("b", B)}</div></div>
        <div class="tp-pick"><div class="tp-ph"><b>Jogadores disponíveis · ${side === "a" ? "Meu time" : "Adversário"} slot ${idx + 1}</b><div class="tp-f">${[["all", "Todos"], ...Object.entries(POS_TAG)].map(([k, v]) => `<button type="button" class="${trUi.pos === k ? "on" : ""}" data-tp-pos="${k}">${v}</button>`).join("")}</div></div>
          <div class="tp-grid">${cur ? `<button type="button" class="tp-pl out" data-tp-put=""><span class="tp-plus">−</span><b>Tirar do slot</b></button>` : ""}${list.map((p) => `<button type="button" class="tp-pl ${p.uid === cur ? "on" : ""}" data-tp-put="${p.uid}" style="--rc:${rar(p.rarity).color}">${pcFig(p)}<b>${esc(p.short)}</b><small>${POS_TAG[p.position] || ""} · Nv ${p.level}</small></button>`).join("") || `<p class="note">Nenhum jogador livre nessa posição.</p>`}</div></div>
        <div class="tp-ft"><button type="button" class="btn" data-tp-auto>Automático</button><button type="button" class="btn btn-hot" data-tp-go>Começar treino</button></div></div>`);
    },
    sleep() { // v291: Modo Soneca (ref do Mickey)
      const b = G.sleepBank(), vip = G.state.vip, max = C.SLEEP_TURBO_MAX_H * 3600, mins = C.SLEEP_MEASURE_SEC / 60;
      const left = slMeas ? Math.max(0, C.SLEEP_MEASURE_SEC - (Date.now() - slMeas.t0) / 1000) : 0, mmss = (x) => `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(Math.floor(x % 60)).padStart(2, "0")}`;
      const turbo = `<div class="sl-turbo ${vip ? "" : "off"}"><div class="sl-th"><b>⚡ Soneca turbo</b><span>${hmin(b.turbo)} / ${hmin(max)}</span></div><div class="sl-bar"><i style="width:${(b.turbo / max) * 100}%"></i></div>
        <p>${vip ? `As primeiras ${hmin(b.turbo)} da soneca rendem o XP cheio. Depois, ${Math.round(C.SLEEP_XP_MULT * 100)}% do XP.` : `Só VIP: a cada ${1 / C.SLEEP_TURBO_PER_PLAYED} h jogadas você ganha 1 h de turbo com XP cheio (até ${C.SLEEP_TURBO_MAX_H} h por dia). Sem VIP a soneca rende ${Math.round(C.SLEEP_XP_MULT * 100)}% do XP.`}</p></div>`;
      openModal("Modo Soneca", `<div class="sl"><button type="button" class="sl-x" data-eq-close aria-label="Fechar">✕</button><i class="sl-blob" aria-hidden="true"></i>
        <div class="sl-ic" aria-hidden="true">☾</div><span class="sl-k">Descanso automático</span><h2>Modo Soneca</h2>
        <p class="sl-d">${slMeas ? "Continue no jogo enquanto analisamos o seu ritmo de partidas." : `O jogo continua rodando mesmo com o computador desligado. Ele mede seu ritmo por ${mins} minutos e depois leva você à página inicial.`}</p>
        ${turbo}
        ${slMeas ? `<div class="sl-meas"><b id="slClock">${mmss(left)}</b><span>Medindo seu ritmo real</span><div class="sl-bar g"><i id="slBar" style="width:${(1 - left / C.SLEEP_MEASURE_SEC) * 100}%"></i></div></div>
          <button type="button" class="sl-go" disabled id="slGo">Medindo ${mmss(left)}</button><p class="sl-f">Não feche esta tela. A contagem usa o relógio real mesmo se a aba perder o foco.</p>`
        : `<button type="button" class="sl-go" data-sleep-go>Entrar em modo soneca</button><p class="sl-f">Ao voltar, o XP será mostrado somente depois que você entrar no jogo.</p>`}</div>`);
    },
    sleepBack(r) { // v291: resumo ao voltar da soneca
      if (!r) return;
      openModal("Modo Soneca", `<div class="sl"><button type="button" class="sl-x" data-eq-close aria-label="Fechar">✕</button><i class="sl-blob" aria-hidden="true"></i>
        <div class="sl-ic" aria-hidden="true">☀</div><span class="sl-k">Bem-vindo de volta</span><h2>Fim da soneca</h2>
        <p class="sl-d">Você ficou ${hmin(r.h * 3600)} em soneca${r.th > 0 ? `, ${hmin(r.th * 3600)} delas no turbo` : ""}.</p>
        <div class="sl-meas"><b>+${fmt(r.xp)}</b><span>XP para cada jogador do time</span></div>
        ${r.ups.length ? `<p class="sl-f">${[...new Map(r.ups.map((u) => [u.split(" subiu")[0], u])).values()].map(esc).join(" · ")}</p>` : ""}<button type="button" class="sl-go" data-eq-close>Continuar</button></div>`);
    },
    mail() { // v290: Correio (ref do Mickey)
      const L = G.mail(), pend = G.mailPending(), st = G.state;
      const env = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="8" width="24" height="17" rx="2.5" fill="#dff2ff" stroke="#8fc8ff" stroke-width="1.5"/><path d="M5 10l11 8 11-8" fill="none" stroke="#3f8fe0" stroke-width="2" stroke-linejoin="round"/></svg>`;
      const gem = `<svg class="dm-gem" viewBox="0 0 24 18" aria-hidden="true"><path d="M0 7 6 1h12l6 6-12 10.5z" fill="#7fe0ff"/><path d="M6 1h12l-2 3.5H8z" fill="#fff"/><path d="M0 7h24L12 17.5z" fill="#3fb4ff"/><path d="M8 4.5h8L12 17.5z" fill="#c9f6ff"/></svg>`;
      const when = (t) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const gift = (g) => [g.gold ? `${fmt(g.gold)} Gold` : "", g.diamonds ? `${fmt(g.diamonds)} ${gem}` : ""].concat(Object.entries(g.items || {}).map(([k, n]) => `${fmt(n)}× ${esc((C.SUPPLIES[k] || C.CONSUMABLES[k] || { name: k }).name)}`)).filter(Boolean).join(" + "); // v690: itens
      openModal("Correio", `<div class="ml">
        <div class="ml-h"><span class="ml-hi">${env}</span><div class="ml-ht"><span class="dm-k">Mensagens e presentes</span><h2>Correio</h2><p>Avisos do sistema e recompensas para resgatar.</p></div>
          <div class="ml-bal"><span class="ml-coin" aria-hidden="true"></span><b>${fmt(st.gold)}</b></div><div class="ml-bal">${gem}<b>${fmt(st.diamonds || 0)}</b><button type="button" data-open="buyDiamonds" aria-label="Comprar Diamantes">+</button></div><button type="button" class="dm-x" data-eq-close aria-label="Fechar">✕</button></div>
        <div class="ml-body"><button type="button" class="ml-ref" data-mail-ref>⟳ Atualizar</button>
          <div class="ml-box"><div class="ml-sec"><h3>Mensagens</h3><i aria-hidden="true"></i></div><p class="ml-cnt">${pend} anexo(s) aguardando resgate</p>
          ${L.map((m) => `<div class="ml-it ${m.gift && !m.claimed ? "new" : ""}"><span class="ml-ic">${env}</span><div class="ml-tx"><b>${esc(m.title)}</b><p>${esc(m.text)}${m.gift ? ` Anexo: ${gift(m.gift)}.` : ""}</p>
            <div class="ml-meta"><span class="ml-date">◷ ${when(m.at)}</span>${m.gift ? (m.claimed ? `<span class="ml-st">Resgatado</span>` : `<button type="button" class="ml-claim" data-mail-claim="${m.id}">Resgatar</button>`) : ""}</div></div></div>`).join("") || `<p class="ml-cnt">Nenhuma mensagem.</p>`}
          </div></div></div>`);
    },
    diamantes() { // v502/v503 (Mickey, ref "Loja de Diamantes"): menu lateral, busca e filtros, vitrine em cards e painel de benefícios
      const s = G.state, gem = DX_GEM, keep = currentModal === "Loja de Diamantes" ? (document.querySelector(".dx-main") || {}).scrollTop || 0 : 0;
      const cnt = (c) => c === "tecnicos" ? C.COACHES.filter((d) => d.id !== C.COACH_DEFAULT).length : c === "todos" ? C.DIA_PRODUCTS.length : C.DIA_PRODUCTS.filter((p) => p.cat === c).length;
      const nb = (id, n) => `<button type="button" class="${dxUi.cat === id ? "on" : ""}" data-dx-cat="${id}"><i>${dxIc(id)}</i><span>${n}</span>${id !== "inicio" ? `<em>${cnt(id)}</em>` : ""}</button>`;
      const nav = nb("inicio", "Início") + `<button type="button" data-open="buyDiamonds"><i>${dxIc("dia")}</i><span>Comprar Diamantes</span></button><hr>`
        + [["todos", "Todos os produtos"]].concat(DX_CATS, [["tecnicos", "Técnicos"]]).map(([id, n]) => nb(id, n)).join("");
      const tools = `<div class="dx-tools"><label class="dx-q"><span>🔍</span><input type="search" data-dx-q placeholder="Buscar boost, contrato, item ou técnico" value="${esc(dxUi.q)}" aria-label="Buscar"></label>
        <button type="button" class="dx-fit ${dxUi.fit ? "on" : ""}" data-dx-fit="1">Cabe no meu saldo</button>
        <label class="dx-ord"><small>Ordenar</small><select data-dx-sort>${[["padrao", "Padrão da loja"], ["menor", "Menor preço"], ["maior", "Maior preço"], ["nome", "Nome"]].map(([v, n]) => `<option value="${v}" ${dxUi.sort === v ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>`;
      const ben = [["xp", "Boost de Experiência"], ["gold", "Boost de Gold"], ["steal", "Boost de Roubo"], ["shiny", "Boost de Caçada Shiny"]].filter(([k]) => G.boostLeft(k)).map(([k, n]) => [n, dxLeft(G.boostLeft(k)) + " restantes"])
        .concat(s.healModule ? [["Módulo de Descanso", "Permanente"]] : []).concat(s.vip ? [["VIP · Cura automática", s.vipUntil ? dxLeft(s.vipUntil - Date.now()) + " restantes" : "Permanente"]] : []).concat(G.stealArmed() ? [[C.SUPPLIES[G.stealArmed()].name, "Próxima vitória"]] : []);
      const own = (id) => s.inventory.filter((x) => x === id).length + G.mgrEq().filter((x) => x === id).length, c = G.cons();
      const side = `<section class="dx-box"><h4>Benefícios ativos <i>⚡</i></h4><div class="dx-ben"><b>${ben.length}</b><div><span>benefício${ben.length === 1 ? "" : "s"} em uso</span><small>Contam só nas partidas</small></div></div>${ben.map(([n, t]) => `<div class="dx-row"><span>${esc(n)}</span><em>${t}</em></div>`).join("") || `<p class="dx-none">Nenhum boost ativo agora.</p>`}</section>
        <section class="dx-box"><h4>Sua coleção <i>🎒</i></h4><div class="dx-col"><div><small>Técnicos</small><b>${G.coach().owned.filter((x) => x !== C.COACH_DEFAULT).length} / ${C.COACHES.length - 1}</b></div><div><small>Contratos</small><b>${fmt(c["pr-bluelock"] || 0)}</b></div>
          <div><small>Itens de XP</small><b>${fmt(["xp-video", "xp-treino", "xp-camp"].reduce((a, k) => a + (c[k] || 0), 0))}</b></div><div><small>Treinador</small><b>${["tr-caderno", "tr-apito", "tr-prancheta", "tr-cronometro", "tr-livro-ego"].filter((k) => own(k)).length} / 5</b></div></div></section>
        <section class="dx-box"><h4>Histórico recente <b>${(s.diaLog || []).length}</b></h4>${(s.diaLog || []).slice(0, 6).map((l) => `<div class="dx-hist"><div><span>${esc(l.name)}</span><small>${new Date(l.t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</small></div><em>−${l.n} ${gem}</em></div>`).join("") || `<p class="dx-none">Suas compras com Diamantes aparecem aqui.</p>`}</section>`;
      openModal("Loja de Diamantes", `<div class="dx">
        <header class="dx-h"><span class="dx-logo">${gem}</span><div><small>BL Project Idle</small><h2>Loja de Diamantes</h2><p>Benefícios para sua jornada, pagos com a moeda premium do jogo.</p></div>
          <div class="dx-bal">${gem}<div><small>Seu saldo</small><b>${fmt(s.diamonds || 0)}</b></div></div><button type="button" class="dx-add" data-open="buyDiamonds">${gem} Comprar diamantes</button><button type="button" class="dx-x" data-eq-close aria-label="Fechar">✕</button></header>
        <div class="dx-body"><nav class="dx-nav">${nav}</nav><main class="dx-main">${tools}<div id="dxList">${dxListHtml()}</div></main><aside class="dx-side">${side}</aside></div></div>`);
      const m = document.querySelector(".dx-main"); if (m && keep) m.scrollTop = keep;
    },
    buyDiamonds() { // v289: loja de Diamantes nas 2 abas da ref do Mickey (vitrine, sem compra real)
      const P = C.DIAMOND_PACKS, brl = (v) => "R$ " + v.toFixed(2).replace(".", ",");
      const gem = (c = "") => `<svg class="dm-gem ${c}" viewBox="0 0 24 18" aria-hidden="true"><path d="M0 7 6 1h12l6 6-12 10.5z" fill="#7fe0ff"/><path d="M6 1h12l-2 3.5H8z" fill="#fff"/><path d="M0 7h24L12 17.5z" fill="#3fb4ff"/><path d="M8 4.5h8L12 17.5z" fill="#c9f6ff"/></svg>`;
      const card = (p, i) => p.club
        ? `<button type="button" class="dm-pk dm-club ${dmUi.pack === i ? "on" : ""}" data-dm-pack="${i}"><span class="dm-rib">Clube Diamante</span><div class="dm-top"><span class="dm-crown">♛${gem()}</span><div><b>${p.n}</b><small>${p.now} na hora + ${p.daily} por dia · ${p.days} dias</small></div></div><div class="dm-bot"><div><b>${brl(p.price)}</b><small>por ${p.days} dias</small></div></div></button>`
        : `<button type="button" class="dm-pk ${p.best ? "dm-best" : ""} ${dmUi.pack === i ? "on" : ""}" data-dm-pack="${i}">${p.best ? `<span class="dm-rib">Melhor valor</span>` : ""}<i class="dm-ok" aria-hidden="true">✓</i><div class="dm-top">${gem()}<div><b>${p.n}</b><small>Diamantes</small></div></div><div class="dm-bot"><div><b>${brl(p.price)}</b><small>${brl(p.price / p.n)} cada</small></div><span class="dm-off">-${p.off}%</span></div></button>`;
      const q = dmUi.qty;
      const body = dmUi.tab === "packs"
        ? `<div class="dm-grid">${P.map(card).join("")}</div>`
        : `<div class="dm-ex"><div class="dm-exl">${gem("big")}<span class="dm-k">Compra avulsa</span><h3>Você escolhe a quantidade</h3><p>Digite qualquer número inteiro entre 1 e ${fmt(C.DIAMOND_EXACT_MAX)}. O preço oficial é ${brl(C.DIAMOND_UNIT_PRICE)} por diamante.</p></div>
            <div class="dm-exr"><span class="dm-q">Quantos diamantes?</span><div class="dm-step"><button type="button" data-dm-step="-1">−</button><input id="dmQty" type="number" min="1" max="${C.DIAMOND_EXACT_MAX}" value="${q}" inputmode="numeric"><button type="button" data-dm-step="1">+</button></div>
            <div class="dm-quick">${[1, 5, 10, 25, 50, 100].map((n) => `<button type="button" data-dm-q="${n}">${n}</button>`).join("")}</div>
            <div class="dm-sum"><div><span>Você recebe</span><b id="dmGet">${fmt(q)} diamantes</b></div><div class="r"><span>Total</span><b id="dmTot">${brl(q * C.DIAMOND_UNIT_PRICE)}</b></div></div></div></div>`;
      openModal("Comprar Diamantes", `<div class="dm">
        <div class="dm-h"><span class="dm-hi">${gem()}</span><div class="dm-ht"><span class="dm-k">Loja segura</span><h2>Comprar Diamantes</h2><p>Escolha um pacote ou informe exatamente quanto quer.</p></div><div class="dm-bal">${gem()}<div><span>Seu saldo</span><b>${fmt(G.state.diamonds || 0)}</b></div></div><button type="button" class="dm-x" data-eq-close aria-label="Fechar">✕</button></div>
        <div class="dm-tabs"><button type="button" class="${dmUi.tab === "packs" ? "on" : ""}" data-dm-tab="packs">Pacotes com desconto</button><button type="button" class="${dmUi.tab === "exact" ? "on" : ""}" data-dm-tab="exact">Quantidade exata</button></div>
        <div class="dm-body">${body}</div>
        <div class="dm-f"><button type="button" class="dm-cancel" data-eq-close>Cancelar</button><button type="button" class="dm-go" data-dm-review>Revisar compra</button></div></div>`);
      const qi = $("dmQty");
      if (qi) qi.oninput = () => { const v = Math.max(1, Math.min(C.DIAMOND_EXACT_MAX, Math.floor(+qi.value) || 1)); dmUi.qty = v; $("dmGet").textContent = `${fmt(v)} diamantes`; $("dmTot").textContent = brl(v * C.DIAMOND_UNIT_PRICE); };
      if (qi) qi.onchange = () => { qi.value = dmUi.qty; };
    },
    chests() {
      const n = G.state.chests.length;
      openModal(`Baús (${n})`, n ? `<div class="chests">${G.state.chests.map((c) => `<button type="button" class="chest-btn" data-chest="${c.id}">${chestArt(c.kind || "azul")}Abrir</button>`).join("")}</div>` : `<p class="note">Nenhum baú padrão guardado. Eles caem a qualquer momento da partida.</p>`);
    },
    chat() { toggleChat(); }, // v314: o chat abre como painel em cima do botão Chat (ref do Mickey), não no meio da tela
    // Chefes e Raids (estilo "World Bosses" da referência). Por enquanto só a vitrine: 1 boss de exemplo (Isagi), sem batalha.
    boss(keep) {
      if (!keep) { bossChest = null; bossRk = null; bossTopOpen = null; bossHelp = false; }
      const s = G.state, raid = bossTab === "raid", R = C.BOSS_ROTATION, live = G.bossOpen(), b0 = G.bossRun();
      const b = (b0 && R.find((x) => x.id === b0.boss)) || G.bossOf(), DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"], today = new Date().getDay();
      const rot = `<div class="bo-rot">${Array.from({ length: 7 }, (_, i) => { const d = (today + i) % 7, x = R[d], st = i ? "Agendado" : live ? "Ao vivo" : new Date().getHours() < C.BOSS_WINDOW.open ? "Abre às 18h" : "Encerrado";
        return `<button type="button" class="bo-rd ${i ? "" : "now"} ${!i && live ? "live" : ""}" style="--c:${x.color}" data-boss-day="${d}"><span class="bo-rd-sp ${C.SPRITES[x.id] ? "has-spr" : ""}">${spr(x.id) || x.initials}</span><span><small>${i ? DAYS[d] : "Hoje"}</small><b>${esc(x.name)}</b><em>${st}</em></span></button>`; }).join("")}</div>`;
      const tab = (id, txt) => `<button type="button" class="btn ${bossTab === id ? "on" : ""}" data-boss-tab="${id}">${txt}</button>`;
      const bPitch = C.PITCHES.find((x) => x.id === (C.BOSS_PITCH || {})[b.id]); // v374: campo de fundo de cada boss
      const run = G.bossTick(), done = G.bossDone(), my = G.bossMyChest();
      const N = C.BOSS_TEAM_SIZE, away = G.expAway(), pool = s.roster.filter((p) => p.uid !== away).sort((x, y) => BL.power(y) - BL.power(x));
      const ids = run ? run.team.filter((u) => G.player(u)) : (s.bossTeam || []).filter((u) => pool.some((p) => p.uid === u)).slice(0, N), list = ids.map((u) => G.player(u));
      const tot = G.bossBlank(); let pts = 0; if (run) list.forEach((p) => { const st = run.st[p.uid]; pts += G.bossPoints(st, p.position); for (const k in tot) tot[k] += st[k]; });
      const left = run ? Math.max(0, run.end - Date.now()) : 0, clock = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
      const sentDay = !run && !G.dev && s.bossDay === new Date().toDateString(), sentL = sentDay ? (s.bossSent || []).map((u) => G.player(u)).filter(Boolean) : []; // v389: já enviou hoje
      const wait = !!run && Date.now() < run.start; // v390: enviada, esperando as 18h
      const myC = my && my.tier ? C.BOSS_CHESTS.find((c) => c.id === my.tier) : null;
      const team = { ids, list, pool, power: list.reduce((a, p) => a + BL.power(p), 0) };
      const box = (k, v, hot) => `<div class="bo-box ${hot ? "hot" : ""}"><small class="ex-k">${k}</small><b>${v}</b></div>`;
      const step = (n, k, t) => `<div class="bo-step"><small class="ex-k">${n} · ${k}</small><p>${t}</p></div>`;
      const body = raid ? `<div class="bo-empty"><b>Raid diária</b><p class="note">Em breve: um desafio por dia, para jogar sozinho, com tentativas limitadas.</p></div>`
        : `<div class="bo-main"><div class="bo-art ${bPitch ? "has-pitch" : ""}" style="--c:${b.color}">${bPitch ? `<span class="bo-bg" style="background-image:url('${bPitch.img}');--cy:${(C.BOSS_SPOT || {})[bPitch.id] || 470}px"></span>` : ""}<span class="bo-ring"></span><span class="bo-sprite ${C.SPRITES[b.id] ? "has-spr" : ""}">${spr(b.id) || b.initials}</span><span class="bo-tag">Ao vivo</span></div>
          <div class="bo-info"><div class="bo-head"><div><small class="ex-k">${b.title}</small><h3>${b.name}</h3><small class="bo-when">${run ? (done ? "Partida encerrada" : wait ? `Começa às ${C.BOSS_RUN.startHour}h` : "Partida em andamento") : `Partida simulada de ${C.BOSS_RUN.minutes / 60} h · começa às ${C.BOSS_RUN.startHour}h`}</small></div>
              ${run || sentDay ? `<div class="bo-minis">${(run ? team.list : sentL).map((p) => `<button type="button" class="bo-mini" data-ev-open="${p.uid}" style="--rc:${rar(p.rarity).color}" title="${esc(p.name)}">${token(p)}<b>${esc(p.short || p.name)}</b><small>${run && !wait ? `${fmt(G.bossPoints(run.st[p.uid], p.position))} pts` : "Enviado"}</small></button>`).join("")}</div>` : ""}
              <div class="bo-send">${run ? `<span class="bo-clock ${done ? "end" : ""}" id="bossClock">${done ? "Encerrada" : wait ? `${C.BOSS_RUN.startHour}h` : clock}</span>${G.dev && !done ? `<button type="button" class="btn" data-boss-now="1">Terminar agora (dev)</button>` : ""}` : sentDay ? `<small class="bo-when">Novo boss amanhã</small>` : `<button type="button" class="btn btn-hot" data-boss-send="1" ${list.length === N ? "" : "disabled"}>Enviar equipe</button>`}</div></div>
            <div class="bo-boxes">${box("Gols no Boss", fmt(tot.gols))}${box("Força coletiva", fmt(team.power), true)}${box("Inscritos", run ? fmt(run.fake.length + 1) : "0")}${box("Seus pontos", fmt(pts))}</div>
            ${run || sentDay ? "" : `<div class="bo-card bo-team"><h4>Sua equipe <span>${team.list.length}/${N}</span></h4>
              <div class="bo-slots">${Array.from({ length: N }, (_, i) => { const p = team.list[i]; return p ? `<button type="button" class="bo-slot on" ${run ? `data-ev-open="${p.uid}"` : `data-boss-pick="${p.uid}" title="Tirar da equipe"`}>${token(p)}<b>${esc(p.name)}</b><small style="color:${rar(p.rarity).color}">${POS_TAG[p.position] || ""} · Nv ${p.level} · ${fmt(BL.power(p))}</small>${run ? `<small class="bo-pts">${fmt(G.bossPoints(run.st[p.uid], p.position))} pts</small><div class="bo-sl">${bossStatLine(run.st[p.uid])}</div>` : ""}</button>` : `<div class="bo-slot"><span class="bo-empty-slot">+</span><small>Vazio</small></div>`; }).join("")}</div>
              ${run ? `<p class="note">A equipe está no Boss e não joga, não treina nem vai para a Expedição até você resgatar o baú.</p>` : ""}<div class="bo-pick" ${run ? "hidden" : ""}>${team.pool.map((p) => `<button type="button" class="bo-pk ${team.ids.includes(p.uid) ? "on" : ""}" data-boss-pick="${p.uid}">${token(p)}<span><b>${esc(p.short || p.name)}</b><small>${fmt(BL.power(p))}</small></span></button>`).join("")}</div></div>`}
            <div class="bo-actions"><button type="button" class="btn" data-boss-rk="pts">Ranking</button><button type="button" class="btn" disabled>Loja do Boss</button></div></div></div>`;
      const hpStep = (n, t, d) => `<div class="hp-step"><span class="hp-num">${n}</span><div><b>${t}</b><small>${d}</small></div></div>`;
      const hpRole = (ic, t, d, c) => `<div class="hp-role" style="--a:${c}"><span class="hp-ic">${ic}</span><b>${t}</b><small>${d}</small></div>`;
      const helpView = () => `<div class="bo-ov"><div class="bo-ov-box bo-rk bo-help-box" style="--a:#26D9FF"><button type="button" class="btn btn-ghost bo-ov-x" data-boss-help-close="1" aria-label="Fechar">✕</button><small class="ex-k">Chefes e Raids</small><h3>Como funciona</h3>
        <section class="hp-sec"><h5>Desafios cooperativos</h5><div class="hp-steps">${hpStep(1, "Monte o trio", "Escolha 3 jogadores.")}${hpStep(2, "Envie quando quiser", "1 vez por dia, a qualquer hora.")}${hpStep(3, `Jogo às ${C.BOSS_RUN.startHour}h`, `${C.BOSS_RUN.minutes / 60} h de partida simulada contra o boss.`)}${hpStep(4, "Resgate o baú", "Ele aparece ao lado do ? na cor que você ganhou.")}</div><p class="hp-note">Depois de enviada, a equipe não muda e fica fora das partidas normais até o fim do boss.</p></section>
        <section class="hp-sec"><h5>Quem pontua</h5><div class="hp-roles">${hpRole("🛡️", "Fixo", "Roubos e bloqueios", "#4a95ff")}${hpRole("⚡", "Alas", "Gols, assistências, roubos e bloqueios", "#26D9FF")}${hpRole("⚽", "Pivô", "Gols e assistências", "#ff5a6e")}</div></section>
        <section class="hp-sec"><h5>Baús por posição <span>1 baú por partida · mais pontos, baú melhor</span></h5><div class="hp-chests">${C.BOSS_CHESTS.slice().reverse().map((c) => `<div class="hp-ch" style="--a:${c.color}"><span class="hp-dot"></span><b>${c.name}</b><small>${c.rank}</small></div>`).join("")}</div></section>
        ${G.dev ? `<div class="bo-dev"><small class="ex-k">Modo dev · testar baús</small><div>${C.BOSS_CHESTS.map((c) => `<button type="button" class="btn" data-boss-chest="${c.id}" style="--a:${c.color};border-color:${c.color};color:${c.color}">${c.name}</button>`).join("")}</div></div>` : ""}</div></div>`;
      openModal("Chefes e Raids", `
        <div class="bo-tabs">${tab("raid", "Raid diária")}${tab("world", "World Bosses")}<button type="button" class="btn bo-help" data-boss-help="1" title="Como funciona" aria-label="Como funciona">?</button>${!raid && myC ? `<button type="button" class="bo-tchest" data-boss-mine="1" style="--a:${myC.color}" title="Baú ${myC.name} · ${my.pos}º lugar">${chestSvg()}<b>Baú ${myC.name}</b></button>` : !raid && done ? `<button type="button" class="bo-tchest none" data-boss-free="1" style="--a:#5b6785" title="Faltou pontuar · toque para liberar a equipe">${chestSvg()}<b>Sem baú</b></button>` : ""}<div class="bo-res"><span><i class="ic-coin"></i> ${fmt(s.gold)}</span><span>💎 ${fmt(s.diamonds || 0)}</span></div></div>${raid ? "" : rot}${body}${bossChest ? chestView() : bossHelp ? helpView() : bossRk && !raid ? rankView() : ""}`);
      idleAnimate($("modalBody"));
    },
    // v186 · Recompensa diária: ciclo de 30 dias no estilo da referência (calendário, prêmio do dia, marcos ★)
    diaria() {
      const R = C.DAILY_REWARDS, L = R.length, M = C.DAILY_MILESTONES, can = G.dailyCan(), got = G.dailyShown();
      const next = Math.min(L, got + 1), rw = R[next - 1], streak = G.dailyStreak(), done = !can && got >= L;
      // v651 (Mickey: Diária combinando com a Loja): mesma moldura da Loja (cabeçalho com saldos, painel do prêmio à esquerda, calendário em cards à direita) e arte do jogo no lugar dos emojis
      const art = (r) => r.k === "gold" ? `<img class="dyx-img" src="img/gold.png" alt="">` : r.k === "diamantes" ? `<img class="dyx-img" src="img/menu/diamantes.png" alt="">` : r.k === "xp" ? `<span class="dyx-svg">${DX_SVG.xp}</span>` : r.k === "boneco" ? `<img class="dyx-img" src="img/menu/pc.png" alt="">` : r.k === "chest" ? chestArt(r.id) : r.k === "sup" ? `<span class="dyx-svg" style="font-size:46px;line-height:1">${C.SUPPLIES[r.id].icon}</span>` : shopArt(r.k, C.CONSUMABLES[r.k].icon);
      const KC = { gold: "#f5c542", diamantes: "#26D9FF", xp: "#3fd29b", agua: "#4aa8ff", gatorade: "#ff9a3c" };
      const info = (r) => r.k === "gold" ? { n: fmt(r.n), t: "Gold", d: "Moedas para a Loja." } : r.k === "diamantes" ? { n: fmt(r.n), t: "Diamantes", d: "Para técnicos, boosts e a Loja de Diamantes." } : r.k === "xp" ? { n: fmt(r.n), t: "XP do time", d: "Dividido entre os jogadores do time." } : r.k === "boneco" ? { n: "1", t: `Jogador ${rar(r.rarity).name}`, c: rar(r.rarity).color, d: `Um jogador ${rar(r.rarity).name.toLowerCase()} aleatório entra no seu elenco.` } : r.k === "chest" ? { n: fmt(r.n), t: C.CHEST_KINDS[r.id].name, d: "Vai para os Espólios. Abra para ganhar Gold e um item." } : r.k === "sup" ? { n: fmt(r.n), t: C.SUPPLIES[r.id].name, d: C.SUPPLIES[r.id].desc || "Vai para a Mochila." } : { n: fmt(r.n), t: C.CONSUMABLES[r.k].name, d: C.CONSUMABLES[r.k].desc + " de um jogador na partida." };
      const col = (r) => info(r).c || KC[r.k] || "#7fd8ff";
      const hi = info(rw), mk = M.find((d) => d > got) || null;
      const nodes = M.map((d) => `<i style="left:${(d / L) * 100}%" class="${d <= got ? "on" : ""}"><em>${d}</em></i>`).join("");
      const card = (r, i) => {
        const d = i + 1, f = info(r), st = d <= got ? "got" : can && d === next ? "today" : d === next ? "next" : "lock", ms = M.includes(d);
        return `<button type="button" class="bg-card shx-card v650 dyx-day ${st}${ms ? " ms" : ""}" style="--rc:${col(r)}"${st === "today" ? ` data-daily-claim="1"` : ""}><span class="shx-tag">Dia ${d}</span>${ms ? `<span class="shx-n dyx-star" title="Marco">★</span>` : ""}<span class="bg-art">${art(r)}</span><b>${f.n}</b><span class="shx-fx">${esc(f.t)}</span><span class="dyx-st">${st === "got" ? "✓ Resgatado" : st === "today" ? "Resgatar" : st === "next" ? "Amanhã" : "Bloqueado"}</span></button>`;
      };
      const left = `<div class="shx-lhead"><h4 class="bg-name">${hi.n} ${esc(hi.t)}</h4><small class="bg-k c">${done ? "Ciclo completo" : can ? "Prêmio de hoje" : "Prêmio de amanhã"} · Dia ${next} de ${L}</small></div>
          <div class="bg-stage shx-stage dyx-stage" style="--rc:${col(rw)}">${art(rw)}<span class="bg-rar">${can ? "Disponível" : "Amanhã"}</span></div>
          <div class="shx-info"><div class="shx-sec"><h5>O que é</h5><p>${esc(hi.d)}</p></div>
            <div class="dyx-stats"><div><small>Sequência</small><b>${streak}</b><span>dia(s) seguidos</span></div>${C.DAILY_STREAK ? `<div><small>Moedas da sequência</small><b>+${fmt(G.dailyBonus(can ? streak + 1 : streak))}</b><span>${can ? "no resgate de hoje" : `amanhã +${fmt(G.dailyBonus(streak + 1))}`}</span></div>` : ""}<div><small>Ciclo</small><b>${got}/${L}</b><span>${L - got} restante(s)</span></div></div>
            <div class="shx-sec"><h5>Próximo marco ★</h5><p>${mk ? `Dia ${mk}, faltam ${mk - got} resgate(s): ${info(R[mk - 1]).n} ${esc(info(R[mk - 1]).t)}` : "Ciclo completo. Um novo começa amanhã."}</p></div>
            <div class="shx-sec"><h5>Regra</h5><p>1 resgate por dia. Se passar um dia sem resgatar, a sequência volta a zero, mas o ciclo continua de onde parou.</p></div></div>
          <div class="shx-buy"><div class="shx-row"><small>Próximo prêmio em</small><b class="dyx-left" id="dyLeft">${dyLeft()}</b></div>${can ? `<button type="button" class="bg-go dyx-go" data-daily-claim="1">Resgatar · ${hi.n} ${esc(hi.t)}</button>` : `<button type="button" class="bg-go" disabled>Resgatado hoje</button>`}</div>`;
      openModal("Recompensa diária", `<div class="pc bg shx dyx">
        <div class="pct-h bg-h shx-h"><span class="bg-ico shx-hic"><img src="img/menu/diaria.png" alt=""></span><div><small class="shx-kick">Login diário</small><h3>Diária</h3><p>Entre todo dia e resgate um prêmio. ${L} dias por ciclo.</p></div>
          <div class="shx-bal"><span><i class="ic-coin"></i> ${fmt(G.state.gold)}</span><span><i class="ic-dia"></i> ${fmt(G.state.diamonds || 0)}</span></div>
          ${G.dev ? `<button type="button" class="btn dyx-dev" data-daily-skip="1">Dev: próximo dia</button>` : ""}<button type="button" class="eq-x" data-eq-close aria-label="Fechar">✕</button></div>
        <div class="bg-main"><div class="bg-left">${left}</div>
          <div class="bg-right"><div class="dyx-prog"><div class="dyx-ph"><small>Progresso do ciclo</small><b>${got} de ${L} dias</b></div><div class="dyx-bar"><span style="width:${(got / L) * 100}%"></span>${nodes}</div></div>
            <div class="bg-grid dyx-grid">${R.map(card).join("")}</div></div></div>
        <p class="shx-foot">Os prêmios vão direto para o seu saldo, a Mochila ou o elenco. ★ = marco do ciclo.</p>
      </div>`);
    },
    // v534/v537 (Mickey): Missões em 20 capítulos (C.CHAPTERS, C.MISSIONS, G.mis*). Uma por vez; o capítulo 20 dá o Master Contract
    missoes() {
      const L = C.MISSIONS, CHS = C.CHAPTERS, m = G.mis(), q = G.misCur(), ok = G.misReady(), pg = G.misProg(), cc = q ? q.ch : CHS.length;
      const face = (w) => `<span class="ms-face ${/Ego/.test(w) ? "ego" : "anri"}">${esc(w.split(" ").map((x) => x[0]).join(""))}</span>`;
      const rw = (r) => { const sp = C.SUPPLIES[r.id] || C.CONSUMABLES[r.id];
        const [ic, t] = r.k === "gold" ? ['<i class="ic-coin"></i>', `${fmt(r.n)} Gold`] : r.k === "dia" ? ["💎", `${fmt(r.n)} Diamantes`] : r.k === "xp" ? ["✦", `${fmt(r.n)} XP do time`]
          : r.k === "chestR" ? ["🧰", r.p ? `Baú épico ou lendário (${Math.round(r.p * 100)}%)` : "Baú épico"]: r.k === "chest" ? ["🧰", `${r.n > 1 ? r.n + "× " : ""}${C.CHEST_KINDS[r.id].name}`] : r.k === "sub" ? [BL.wcArt(r.id), `${r.n}× ${C.WC_FARM.crops[r.id].name}`] : [shopArt(r.id, sp.icon), `${r.n}× ${sp.name}`];
        return `<span class="ms-rw${r.id === "pr-bluelock" ? " master" : ""}"><i>${ic}</i>${esc(t)}</span>`; };
      const inCh = (c) => L.map((x, i) => [x, i]).filter(([x]) => x.ch === c), pos = q ? inCh(q.ch).findIndex(([, i]) => i === m.i) + 1 : 0, CH = q && CHS[q.ch], last = q && G.misLast();
      const hero = q ? `<div class="ms-hero ${ok ? "ok" : ""}">${face(CH.who)}<div class="ms-hb">
          <small>Capítulo ${q.ch + 1} de ${CHS.length} · Missão ${pos} de ${inCh(q.ch).length} · ${esc(CH.who)}</small><h3>${esc(CH.title)}</h3><p class="ms-story">“${esc(CH.story)}”</p>
          <div class="ms-task"><p>${esc(q.line)}</p><div class="ms-goal"><b>${esc(q.goal)}</b><span>${fmt(Math.min(pg, q.n))} / ${fmt(q.n)}</span></div><div class="ms-bar"><em style="width:${Math.min(100, pg / q.n * 100)}%"></em></div></div>
          <div class="ms-rws"><small>Prêmio</small>${q.rw.map(rw).join("")}</div>
          ${last ? `<div class="ms-rws ms-chrw"><small>Fim do capítulo</small>${CH.rw.map(rw).join("")}</div>` : ""}
          ${ok ? `<button type="button" class="dy-claim ms-claim" data-mis-claim="1">Resgatar prêmio</button>` : `<p class="ms-tip">Jogue normalmente: o progresso conta sozinho. Não quer fazer agora? Pode ignorar, só o prêmio fica esperando.</p>`}</div></div>`
        : `<div class="ms-hero ok">${face("Jinpachi Ego")}<div class="ms-hb"><small>Os ${CHS.length} capítulos foram concluídos</small><h3>O maior egoísta</h3><p class="ms-story">“Você fez tudo o que eu pedi. Agora o Blue Lock é seu.”</p></div></div>`;
      const sub = (c) => inCh(c).map(([x, i], j) => { const st = i < m.i ? "done" : i === m.i ? "cur" : "lock";
        return `<div class="ms-row ms-sub ${st}"><span class="ms-n">${st === "done" ? "✓" : j + 1}</span><div><b>${esc(x.goal)}</b><small>${esc(x.line)}</small></div><div class="ms-rws">${x.rw.map(rw).join("")}</div></div>`; }).join("");
      const row = (c, k) => { const st = k < cc ? "done" : k === cc ? "cur" : "lock", n = inCh(k).filter(([, i]) => i < m.i).length;
        return `<div class="ms-row ${st}"><span class="ms-n">${st === "done" ? "✓" : k + 1}</span><div><b>${esc(c.title)}</b><small>${st === "lock" ? "Bloqueado" : `${n} de ${inCh(k).length} missões`} · ${esc(c.who)}</small></div><div class="ms-rws">${c.rw.map(rw).join("")}</div></div>${st === "cur" ? `<div class="ms-subs">${sub(k)}</div>` : ""}`; };
      const W = C.WEEKLY ? G.weekly() : null, wk = W ? `<div class="ms-lh"><h4>Semanais</h4><small>Zeram na segunda à meia-noite · faltam ${Math.max(1, Math.ceil((G.wkEnds() - Date.now()) / 864e5))} dia(s). O progresso conta sozinho.</small></div><div class="ms-list">${C.WEEKLY.map((x) => { const v = Math.min(x.n, W.c[x.id] || 0), got = W.got[x.id], ok = !got && v >= x.n;
        return `<div class="ms-row ms-wk ${got ? "done" : ok ? "cur" : ""}"><span class="ms-n">${got ? "✓" : "★"}</span><div><b>${esc(x.text)}</b><small>${fmt(v)} / ${fmt(x.n)}</small><div class="ms-bar"><em style="width:${(v / x.n) * 100}%"></em></div></div><div class="ms-rws">${x.rw.map(rw).join("")}${ok ? `<button type="button" class="dy-claim ms-claim" data-wk-claim="${x.id}">Resgatar</button>` : ""}</div></div>`; }).join("")}</div>` : ""; // v708 (Mickey): missões semanais
      openModal("Missões", `<div class="ms">${hero}${wk}<div class="ms-lh"><h4>Capítulos</h4><small>Em ordem. O capítulo ${CHS.length} dá o Master Contract, o único contrato com roubo garantido.</small></div><div class="ms-list">${CHS.map(row).join("")}</div></div>`);
    },
    locked(what) {
      const map = { "Reações Químicas": "Âncoras e condições de batalha, como Bachira driblando 10 vezes para dar +20% de Drible ao Isagi.", "Formações": "Pedra, papel e tesoura a partir do 4×4 (fase 4-1).", "Habilidades": "Banco de habilidades com slots por raridade: 1, 2 ou 3.", "Loja": "Onde o Gold vai ser gasto: Gatorade, upgrades e itens.", "Boss": "Lista dos Bosses de cada mapa, com arena, buffs e recompensas.", "PvP": "Partidas contra times de outros jogadores, com troca de formação no intervalo." };
      openModal(what, `<p>${esc(map[what] || "")}</p><p class="note">Esta parte ainda não foi construída. Ela está no roadmap depois do loop 1×1.</p>`);
    },
    // Janela de EV e status de um jogador (clique no jogador). No modo dev também edita nível e IV.
    ev(uid) {
      const enemy = !G.player(uid) && G.enemyPlayer(uid);
      const p = G.player(uid) || enemy; if (!p) return;
      evUid = uid;
      const ro = !!enemy; // adversário: mesma janela, só para ver (sem EV, reset nem dev)
      const tot = BL.statTotal(p), evT = BL.evTotal(p), pool = G.evPool(), lm = BL.levelMult(p.level), nat = BL.NATURE_BY_NAME[p.nature];
      const ivRar = rar(BL.rarityFromTotal(tot));
      const card = (k) => {
        const iv = p.stats[k], e = BL.ev(p, k), fin = BL.baseStat(p, k) * lm;
        const full = e >= C.EV_MAX_STAT || evT >= C.EV_MAX_TOTAL || pool <= 0;
        const natTag = nat?.up === k ? `<span class="nat-up">+</span>` : nat?.down === k ? `<span class="nat-down">−</span>` : "";
        return `<div class="ev-card">
          <div class="ev-top"><span class="ev-name">${C.STAT_LABEL[k]} ${natTag}</span><b class="ev-final" title="Status em campo: (IV + itens) × nature × EV × nível">${Math.round(fin)}</b></div>
          <div class="ev-bars">
            <div><div class="ev-lbl"><span class="iv-k">IV</span><span>${iv}/${C.STAT_MAX}</span></div><div class="ev-bar iv"><i style="width:${(iv / C.STAT_MAX) * 100}%"></i></div></div>
            <div><div class="ev-lbl"><span class="ev-k">EV</span><span>${e}/${C.EV_MAX_STAT}</span></div><div class="ev-bar ev"><i style="width:${(e / C.EV_MAX_STAT) * 100}%"></i></div></div>
          </div>
          ${ro ? "" : `<div class="ev-btns"><button type="button" class="btn" data-ev-add="${k}|1" ${full ? "disabled" : ""}>+1</button><button type="button" class="btn" data-ev-add="${k}|10" ${full ? "disabled" : ""}>+10</button><button type="button" class="btn" data-ev-add="${k}|max" ${full ? "disabled" : ""}>Máx.</button></div>`}
        </div>`;
      };
      const dev = G.dev && !ro ? `<div class="ev-devbox"><b>Modo dev</b>
          <div class="dev-row"><span class="ev-lvl">Nível <b>${p.level}</b></span>${[-100, -10, -1, 1, 10, 100].map((d) => `<button type="button" class="btn" data-lv-set="${p.level + d}">${d > 0 ? "+" : "−"}${Math.abs(d)}</button>`).join("")}<button type="button" class="btn" data-lv-set="1">Nv 1</button><button type="button" class="btn" data-lv-set="100">Nv 100</button>
          <input type="number" id="evLvIn" min="1" max="${C.PLAYER_MAX_LEVEL}" value="${p.level}" aria-label="Nível"><button type="button" class="btn btn-hot" data-lv-in="1">Aplicar</button></div>
          <div class="dev-row"><button type="button" class="btn" data-iv-all="31">Todos os IV em 31</button><button type="button" class="btn" data-iv-all="15">Todos em 15</button><button type="button" class="btn" data-iv-all="1">Todos em 1</button></div></div>` : "";
      const body = $("modalBody"), keep = currentModal && currentModal.startsWith(p.name) ? body.scrollTop : 0;
      openModal(`${p.name} · ${ro ? "Status" : "EV e status"}`, `<div class="ev-sum">
          <div class="kpi"><span>Qualidade IV</span><b>${ro ? "???" /* v595: adversário sem raridade */ : `${tot}/186 · ${Math.round((tot / 186) * 100)}% · <span style="color:${ivRar.color}">${ivRar.name}</span>`}</b></div>
          <div class="kpi"><span>EV distribuído</span><b>${evT}/${C.EV_MAX_TOTAL}</b></div>
          ${ro ? "" : (() => { const L = C.LEGEND_PLAY, ls = (G.state.lances) || {}, _ = 0; // v582: coleção de lances (v583: marcos foram para a aba Marcos do PC)
            const got = ["chute", "drible", "passe"].filter((k) => ls[p.charId + ":" + k]).map((k) => `${esc(L.def[k])} ×${ls[p.charId + ":" + k]}`);
            return `<div class="kpi"><span>Lances lendários</span><b>${got.length ? got.join(" · ") : "nenhum ainda"}</b></div>`; })()}
          ${ro ? `<div class="kpi"><span>Adversário</span><b>Nv ${p.level} · ${esc(posName(p.position))}</b></div><div class="kpi"><span>Chance de roubo</span><b style="color:var(--gold)">${BL.stealChance(p, G.state.progress.stage, G.match ? G.match.score[0] : 0).toFixed(1).replace(".", ",")}%</b></div>` : `<div class="kpi"><span>Pontos disponíveis</span><b>${pool === Infinity ? "∞ (dev)" : fmt(pool)}</b></div>
          <button type="button" class="btn ev-reset" data-ev-reset="1" ${evT ? "" : "disabled"}>Resetar EVs · ${G.dev ? "grátis (dev)" : `<span class="coin" aria-hidden="true"></span> ${fmt(C.EV_RESET_COST)}`}</button>`}
        </div>
        <div class="ev-nature"><span>Nature</span><b>${esc(p.nature)}</b>${nat && nat.up ? `<span class="nat-up">+${C.STAT_LABEL[nat.up]}</span><span class="nat-down">−${C.STAT_LABEL[nat.down]}</span>` : `<span class="note">neutra</span>`}</div>
        ${dev}
        <div class="ev-grid">${S.map(card).join("")}</div>`);
      body.scrollTop = keep;
    },
    // v119 · Wildcard: 4 slots de treino (começa com 1 liberado); só entra quem não está escalado
    wildcard() { return openHub(); }, // v513 (Mickey): o Wildcard virou um HUB (outra instância): Cápsulas, Fazenda e Bancada
    wildcardOld() {
      const w = G.wc(); G.wcTick();
      const slot = (u, i) => {
        if (i >= G.wcUnlocked()) return `<div class="wc-slot locked"><span class="wc-lock">💎</span><b>Em breve</b><small>Libera com Diamantes</small></div>`;
        const p = u && G.player(u);
        if (!p) return `<div class="wc-slot empty"><span class="token">+</span><b>Vazio</b><small>Escolha um jogador abaixo</small></div>`;
        const r = rar(p.rarity), need = C.playerXpToNext(p.level);
        return `<div class="wc-slot">${tok(p.charId, p.initials, r.color)}<b>${esc(p.name)}</b><small>Nv ${p.level} · ${posName(p.position)}</small>
          <div class="pc-xp"><span>XP</span><span class="bar"><i style="width:${(p.xp / need) * 100}%"></i></span><span>${fmt(p.xp)}/${fmt(need)}</span></div>
          <button type="button" class="btn" data-wc-del="${i}">Tirar do treino</button></div>`;
      };
      const free = w.slots.some((u, i) => i < G.wcUnlocked() && !u), el = G.wcEligible();
      const list = el.length ? el.map((p) => { const r = rar(p.rarity); return `<div class="wc-row">${tok(p.charId, p.initials, r.color)}<span><b>${esc(p.name)}</b><small>${r.name} · Nv ${p.level} · ${posName(p.position)}</small></span><button type="button" class="btn ${free ? "btn-hot" : ""}" data-wc-add="${p.uid}" ${free ? "" : "disabled"}>Treinar</button></div>`; }).join("")
        : `<p class="note">Ninguém disponível. Só treina no Wildcard quem não está escalado no time da partida.</p>`;
      openModal("Wildcard", `<div class="wc-slots-grid">${w.slots.map(slot).join("")}</div>
        ${(() => { const n = G.wcPlayers().length, pct = n ? Math.round(1000 / n) / 10 : 100; return `<p class="note">O Wildcard rende ${C.WILDCARD_XP_PER_MIN} XP por minuto, dividido entre quem treina. ${n ? `Agora: ${n} jogador${n > 1 ? "es" : ""}, <b>${String(pct).replace(".", ",")}% cada (${String(Math.round(G.wcRate(n) * 10) / 10).replace(".", ",")} XP/min)</b>.` : "Com 1 jogador ele leva 100%."} Conta mesmo com o jogo fechado (até ${C.WILDCARD_OFFLINE_MAX_MIN / 60} h), e cada um tem chance de achar itens.</p>`; })()}
        <h3 class="panel-h" style="margin-top:14px">${G.dev ? "Todos os jogadores (modo dev)" : "Jogadores fora da escalação"}</h3><div class="wc-list">${list}</div>`);
      $("modalBody").prepend($("wcPanel")); renderWildcard();
    },
    // v158 · Expedição (estilo "Ofícios" da referência). v159: trilha de 10 regiões × 10 níveis, cada nível com requisitos de Nv e Poder
    expedicao(scrollTo) {
      const E = C.EXPEDITION, x = G.exp(), c = x.cur, s = G.state;
      const dur = (id) => E.durations.find((d) => d.id === id);
      if (!expSel.lvl || !G.expLevelOpen(expSel.lvl)) expSel.lvl = Math.min(x.level, E.maxLevel);
      if (!expSel.dur) expSel.dur = E.durations[0].id;
      const need = E.progNeed(x.level), top = !!x.cleared, progTxt = E.durations.map((d) => `${durTxt(d.min)} +${d.prog}`).join(" · ");
      const head = `<div class="ex-stats"><div><small>Nível de Expedição</small><b>${x.level}</b></div>
        <div class="ex-prog"><small>Progresso do nível ${x.level} <span>${top ? "Concluído" : `${fmt(x.prog)} / ${fmt(need)}`}</span></small><span class="ex-bar"><i style="width:${top ? 100 : (x.prog / need) * 100}%"></i></span><small class="ex-sub">${top ? "Todos os 100 níveis concluídos" : `Faltam ${fmt(need - x.prog)} para concluir o nível ${x.level} e liberar o ${x.level + 1} · ${progTxt}`}</small></div>
        <div class="ex-count"><small>Expedições</small><b>${fmt(x.count)}</b></div></div>`;
      let cur;
      if (c) {
        const q = G.expLevel(c.lvl), d = dur(c.dur), p = G.player(c.uid), done = G.expDone();
        cur = `<div class="ex-cur ${done ? "done" : ""}"><div class="ex-cur-main"><span class="ex-ico exa" style="--c:${q.r.color}">${exaMedal(q.ri, q.k)}</span><div>
            <small class="ex-k">${done ? "Expedição concluída" : "Expedição em andamento"}</small><h4>Nível ${c.lvl} · ${esc(q.r.name)}</h4>
            ${done ? `<p class="note">O jogador voltou. Resgate para ver o que ele trouxe.</p>` : ""}
            <div class="ex-chips"><span class="ex-chip hot" id="expLeft">${done ? "Pronto" : expLeft(c.end)}</span><span class="ex-chip">${esc(d.name)} · ${durTxt(d.min)}</span><span class="ex-chip good">+${fmt(q.rw.xp * d.mult)} XP</span><span class="ex-chip gold"><i class="ic-coin"></i> ${fmt(q.rw.gold * d.mult)}</span></div></div>
          ${p ? `<div class="ex-pl">${tok(p.charId, p.initials, rar(p.rarity).color)}<div><small class="ex-k">Jogador em campo</small><b>${esc(p.name)}</b><small style="color:${rar(p.rarity).color}">${rar(p.rarity).name} · Nv ${p.level} · Poder ${fmt(BL.power(p))}</small></div></div>` : ""}</div>
          <div class="ex-cur-foot"><div><small class="ex-k">Resultado selado</small><b>Será revelado no retorno</b></div>
            ${G.dev && !done ? `<button type="button" class="btn" data-exp-now="1">Concluir agora (dev)</button>` : ""}
            <button type="button" class="btn ${expSel.arm ? "btn-warn" : ""}" data-exp-cancel="1">${expSel.arm ? "Confirmar? Volta sem nada" : "Cancelar expedição"}</button><button type="button" class="btn ${done ? "btn-hot" : ""}" data-exp-claim="1" ${done ? "" : "disabled"}>Resgatar expedição</button></div></div>`;
      } else {
        const l = x.last;
        cur = `<div class="ex-cur idle"><div class="ex-cur-main"><span class="ex-ico">🧭</span><div><small class="ex-k">Nenhuma expedição em andamento</small><h4>Escolha o nível, a duração e o jogador</h4>
          ${l ? `<p class="note">Último retorno: <b>${esc(l.name)}</b> (${l.lvl ? `Nv ${l.lvl} · ` : ""}${esc(l.region)}, ${esc(l.dur)}) trouxe:</p><div class="ex-chips"><span class="ex-chip gold"><i class="ic-coin"></i> ${fmt(l.gold)}</span><span class="ex-chip good">+${fmt(l.xp)} XP</span>${l.item ? `<span class="ex-chip" style="color:${rar(BL.anyItem(BL.ITEM_ALIAS[l.item] || l.item).rarity).color}">${esc(BL.anyItem(BL.ITEM_ALIAS[l.item] || l.item).name)}</span>` : ""}${l.cons ? `<span class="ex-chip">${C.CONSUMABLES[l.cons].icon} ${C.CONSUMABLES[l.cons].name}</span>` : ""}${Object.entries(l.fichas || {}).map(([f, n]) => `<span class="ex-chip" style="color:${rar(C.SUPPLIES[f].rarity).color}">${C.SUPPLIES[f].icon} ${n}× ${C.SUPPLIES[f].name}</span>`).join("")}${l.prog ? `<span class="ex-chip hot">+${l.prog} progresso</span>` : ""}${l.cleared ? `<span class="ex-chip hot">Nível ${l.cleared} concluído!</span>` : ""}</div>` : ""}</div></div></div>`;
      }
      const per = E.perRegion, opened = (ri) => Math.max(0, Math.min(per, (G.dev ? E.maxLevel : x.level - (x.cleared ? 0 : 1)) - ri * per)); // níveis concluídos na região
      const regions = E.regions.map((r, ri) => { const n = opened(ri), sel = Math.ceil(expSel.lvl / per) - 1 === ri;
        return `<button type="button" class="ex-reg ${sel ? "on" : ""} ${n ? "" : "locked"}" data-exp-reg="${ri}"><span class="ex-ico sm exa ${n ? "" : "lk"}" style="--c:${r.color}">${exaRegIco(ri)}${n ? "" : "<i>🔒</i>"}</span><span class="ex-reg-txt"><b>${esc(r.name)}</b><small>Níveis ${ri * per + 1}–${ri * per + per}</small><span class="ex-reg-bar"><i style="width:${n * 100 / per}%"></i></span></span><em>${n}/${per}</em></button>`; }).join("");
      // v172: trilha em páginas com botões à direita, sem scroll (v176: 5 regiões compactas por página)
      const PP = 5, pages = Math.ceil(E.regions.length / PP);
      if (scrollTo != null) expSel.page = Math.floor(scrollTo / PP);
      if (expSel.page == null) expSel.page = Math.floor((Math.ceil(expSel.lvl / per) - 1) / PP);
      expSel.page = Math.max(0, Math.min(pages - 1, expSel.page));
      const pg = expSel.page;
      const trail = E.regions.map((r, ri) => { if (Math.floor(ri / PP) !== pg) return "";
        const A = EXA.b[ri], n = opened(ri), pc = (v, t) => (v / t * 100).toFixed(2) + "%";
        // v654: medalhas da arte; o botão fica por cima de cada uma (estado: travado, concluído, atual, selecionado, em andamento)
        const nodes = Array.from({ length: per }, (_, k) => { const L = ri * per + k + 1, open = G.expLevelOpen(L), on = expSel.lvl === L, run = c && c.lvl === L;
          const done = G.expLevelDone(L), front = L === x.level && !x.cleared, [cx, cy, rr] = A.n[k];
          return `<button type="button" class="exa-node ${open ? "" : "locked"} ${done ? "done" : ""} ${front ? "front" : ""} ${on ? "on" : ""} ${run ? "run" : ""}" style="left:${pc(cx, A.w)};top:${pc(cy, A.h)};width:${pc(2 * rr + 8, A.w)}" data-exp-lvl="${L}" title="Nível ${L} · Jogador Nv ${E.lvReq(L).lv}+ · Poder ${fmt(E.lvReq(L).power)}+" aria-label="Nível ${L}">${open ? (done ? "<i>✓</i>" : "") : "<i>🔒</i>"}${front ? `<b class="exa-nbar"><em style="width:${(x.prog / E.progNeed(L)) * 100}%"></em></b>` : ""}</button>`; }).join("");
        // v657 (Mickey): todas as faixas no formato da página 2 (arte da página 1 refeita em 1010×188), a arte preenche o retângulo todo
        return `<div class="exa-band ${n ? "" : "dim"}" id="exBand${ri}" style="--c:${r.color};--ar:${(A.w / A.h).toFixed(4)};${exaBand(A)}"><div class="exa-art" style="${exaBand(A)}"><span class="exa-reg" style="left:${pc(A.t[0], A.w)};top:${pc(A.t[1], A.h)}">Região ${ri + 1} · ${n}/${per}</span>${nodes}</div></div>`;
      }).join("");
      const Q = G.expLevel(expSel.lvl), D = dur(expSel.dur);
      const durs = E.durations.map((d) => `<button type="button" class="ex-dur ${expSel.dur === d.id ? "on" : ""}" data-exp-dur="${d.id}"><small>${esc(d.name)}</small><b>${durTxt(d.min)}</b><span class="ex-chips">${G.expLevelDone(expSel.lvl) ? "" : `<span class="ex-chip hot">+${Math.min(d.prog, E.progNeed(expSel.lvl) - (expSel.lvl === x.level ? x.prog : 0))} progresso</span>`}<span class="ex-chip gold"><i class="ic-coin"></i> ${fmt(Q.rw.gold * d.mult)}</span><span class="ex-chip good">+${fmt(Q.rw.xp * d.mult)} XP</span></span><span class="ex-loot">${expLoot(d, expSel.uid && G.player(expSel.uid) ? G.expAff(G.player(expSel.uid), expSel.lvl).mult : 1)}</span></button>`).join("");
      const pool = s.roster.filter((p) => !c || p.uid !== c.uid);
      if (expSel.uid && (!pool.some((p) => p.uid === expSel.uid) || G.expWhy(G.player(expSel.uid), expSel.lvl))) expSel.uid = null;
      const selP = expSel.uid && G.player(expSel.uid), lvOpen = G.expLevelOpen(expSel.lvl);
      const reqChip = (ok, txt) => `<span class="ex-chip ${selP ? (ok ? "good" : "bad") : ""}">${txt}</span>`;
      // v168: requisitos em destaque (✓/✕ para o jogador escolhido)
      const reqTile = (ok, k, v) => `<div class="ex-req ${selP || k === "Expedição" ? (ok ? "ok" : "no") : ""}"><small>${k}</small><b>${v}</b>${selP || k === "Expedição" ? `<i>${ok ? "✓" : "✕"}</i>` : ""}</div>`;
      // v182: afinidade do jogador com a região (aumenta a chance de itens)
      const affTag = (A) => `<small class="ex-aff ${A.mult >= 1.2 ? "hi" : A.mult < 0.95 ? "lo" : ""}" title="Afinidade com ${esc(Q.r.name)}: média de ${A.keys.map((k) => C.STAT_LABEL[k]).join(" e ")}">Afinidade ${A.pct}% · itens ×${String(A.mult).replace(".", ",")}</small>`;
      const pls = pool.map((p) => { const why = G.expWhy(p, expSel.lvl), rr = rar(p.rarity);
        return `<button type="button" class="ex-p ${expSel.uid === p.uid ? "on" : ""} ${why ? "no" : ""}" ${why || c || !lvOpen ? "disabled" : `data-exp-pl="${p.uid}"`}>${tok(p.charId, p.initials, rr.color)}<span><b>${esc(p.name)}</b><small>${rr.name} · Nv ${p.level} · Poder ${fmt(BL.power(p))}</small>${why ? `<small class="ex-why">✕ ${esc(why)}</small>` : G.expFailP(p, expSel.lvl) ? `<small class="ex-why" style="color:#ffb02e">⚠ Pode ir · ${Math.round(G.expFailP(p, expSel.lvl) * 100)}% de risco de falhar</small>` : `<small class="ex-okp">✓ Pode ir</small>`}${affTag(G.expAff(p, expSel.lvl))}</span></button>`; }).join("");
      const canSend = !c && lvOpen && selP;
      openModal("Expedição", `${head}${cur}
        <div class="ex-trail-h"><small class="ex-k">Trilha de expedição</small><h3>Escolha o nível, a duração e o jogador</h3></div>
        <div class="ex-cols"><div class="ex-col"><h5>Regiões <small>${E.regions.length} × ${E.perRegion}</small></h5><div class="ex-regs">${regions}</div></div>
          <div class="ex-col ex-col-trail"><h5>Progresso da expedição <small>${fmt(x.level - (x.cleared ? 0 : 1))} / ${E.maxLevel} concluídos</small></h5><div class="ex-trail" id="exTrail"><div class="ex-page">${trail}</div><div class="ex-pager"><button type="button" class="ex-pg" data-exp-page="${pg - 1}" ${pg ? "" : "disabled"} title="Página anterior">▲</button><span class="ex-pg-dots">${Array.from({ length: pages }, (_, i) => `<button type="button" class="ex-dot ${i === pg ? "on" : ""}" data-exp-page="${i}" title="Regiões ${i * PP + 1}–${Math.min(E.regions.length, i * PP + PP)}"></button>`).join("")}</span><small>${pg + 1}/${pages}</small><button type="button" class="ex-pg" data-exp-page="${pg + 1}" ${pg < pages - 1 ? "" : "disabled"} title="Próxima página">▼</button></div></div></div>
          <div class="ex-col"><div class="ex-sel"><span class="ex-ico exa" style="--c:${Q.r.color}">${exaMedal(Q.ri, Q.k)}</span><div><small class="ex-k">LVL${expSel.lvl} selecionado</small><b>${esc(Q.r.name)}</b></div></div>
            ${!lvOpen ? `<p class="ex-lock">🔒 Conclua o nível ${expSel.lvl - 1} para liberar</p>` : G.expLevelDone(expSel.lvl) ? `<p class="ex-done">✓ Nível concluído · repetir só farma, sem progresso</p>` : ""}
            <div class="ex-reqbox ${selP ? (G.expWhy(selP, expSel.lvl) ? "bad" : "ok") : ""}"><h5>Requisitos</h5><div class="ex-reqgrid">${reqTile(lvOpen, "Expedição", `Nv ${expSel.lvl}`)}${reqTile(selP && selP.level >= Q.req.lv, "Jogador", `Nv ${fmt(Q.req.lv)}+`)}${reqTile(selP && BL.power(selP) >= Q.req.power, "Poder", `${fmt(Q.req.power)}+`)}</div><small class="ex-affk">Afinidade: <b>${(Q.r.aff || []).map((k) => C.STAT_LABEL[k]).join(" + ")}</b> · mais chance de itens</small>${Q.r.rare > 1 ? `<small class="ex-rare">Itens raros ×${String(Q.r.rare).replace(".", ",")} nesta região</small>` : ""}</div>
            <h5>Duração</h5><div class="ex-durs">${durs}</div>
            <h5>Jogador</h5><div class="ex-pls">${pls}</div>
            <button type="button" class="btn ${canSend ? "btn-hot" : ""} ex-go" data-exp-send="1" ${canSend ? "" : "disabled"}>${c ? "Já tem uma expedição em andamento" : !lvOpen ? "Nível bloqueado" : selP ? `Enviar · LVL${expSel.lvl} · ${durTxt(D.min)}` : "Escolha um jogador"}</button></div></div>`);
    },
    // Painel de configurações (botão da engrenagem). Cada seção é uma aba; novas seções técnicas entram em SETTINGS_TABS.
    settings(tab) {
      if (tab) settingsTab = tab;
      const tabs = SETTINGS_TABS.map((t) => `<button type="button" class="set-tab" data-set-tab="${t.id}" aria-pressed="${t.id === settingsTab}">${t.name}</button>`).join("");
      openModal("Configurações", `<div class="set-wrap"><nav class="set-nav">${tabs}</nav><div class="set-pane" id="setPane"></div></div>`);
      document.querySelectorAll("[data-set-tab]").forEach((b) => { b.onclick = () => MODALS.settings(b.dataset.setTab); });
      (SETTINGS_TABS.find((t) => t.id === settingsTab) || SETTINGS_TABS[0]).render($("setPane"));
    },
  };

  // ---------- janelas flutuantes (Striker Analyser e Stealing Chance) ----------
  // Não bloqueiam o jogo: dá para arrastar pelo título, minimizar e fechar.
  const FLOATS = { analyser: { title: "Striker Analyser", x: 24, y: 110 }, mapa: { title: "Mapa", x: -24, y: 110 }, chests: { title: "Espólios", x: -24, y: 420 }, mochila: { title: "Mochila", x: -24, y: 300 }, dev: { title: "Modo Dev", x: 24, y: 420 } };
  const floats = {};
  // v262: números do Analyser sobem animados até o valor novo (lembra o último valor de cada um)
  const anPrev = {};
  const anClock = (ms) => { const t = Math.floor(ms / 1000); return `${String(Math.floor(t / 3600)).padStart(2, "0")}:${String(Math.floor(t / 60) % 60).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
  function tweenNums(root) {
    root.querySelectorAll(".an-n[data-n]").forEach((el) => {
      const k = el.dataset.n, to = +el.dataset.v, from = k in anPrev ? anPrev[k] : to, pre = el.dataset.pre, suf = el.dataset.suf;
      anPrev[k] = to;
      if (from === to) return;
      const t0 = performance.now(), dur = 900;
      const step = (now) => {
        if (!el.isConnected) return;
        const q = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - q, 3);
        el.textContent = pre + fmt(from + (to - from) * e) + suf;
        if (q < 1) requestAnimationFrame(step); else el.classList.remove("up");
      };
      if (to > from) el.classList.add("up");
      requestAnimationFrame(step);
    });
  }
  function anSub() { const a = G.state.analyzer; return `${fmt(a.wins)} vitórias · ${fmt(a.steals)} roubos · +${fmt(a.xp)} XP`; }
  const POS_KEY = "blpi_float_pos";
  let savedPos = {};
  try { savedPos = JSON.parse(localStorage.getItem(POS_KEY) || "{}"); } catch (e) { savedPos = {}; }
  function savePos() { try { localStorage.setItem(POS_KEY, JSON.stringify(savedPos)); } catch (e) {} }
  function placeFloat(w, key) {
    const def = FLOATS[key], r = w.getBoundingClientRect();
    let x = savedPos[key]?.x ?? (def.x < 0 ? window.innerWidth - r.width + def.x - 70 : def.x);
    let y = savedPos[key]?.y ?? def.y;
    x = Math.max(0, Math.min(window.innerWidth - Math.min(r.width, window.innerWidth), x));
    y = Math.max(0, Math.min(window.innerHeight - Math.max(44, Math.min(r.height + 8, window.innerHeight)), y)); // v380: janela alta sobe para caber na tela
    w.style.left = x + "px"; w.style.top = y + "px";
  }
  function sizeFloat(w, key) { const sz = savedPos[key]; if (sz && sz.w) { w.style.width = Math.min(sz.w, window.innerWidth - 8) + "px"; w.style.height = Math.min(sz.h, window.innerHeight - 8) + "px"; w.style.maxHeight = "none"; } }
  function floatBody(key) { return key === "chests" ? chestsHtml() :  key === "mapa" ? mapaHtml() : MODALS[key](); }
  // ---------- v263: janela Mapa (atos = mapas, trilha de 10 fases, 4 dificuldades; só a Normal existe por enquanto) ----------
  const MP_COLORS = ["#2b7bff", "#19c6c0", "#ff7a1a", "#ff2e4d"]; // v264: regras em C.DIFFICULTIES
  const MP_DIFFS = C.DIFFICULTIES.map((d, i) => ({ ...d, i, c: MP_COLORS[i] }));
  const MP_PTS = [[41, 87], [49, 79.7], [59, 72.4], [48, 65.1], [60, 57.8], [49, 50.5], [38, 43.2], [49, 35.9], [60, 28.6], [52, 14]]; // v661 (Mickey): trilha em zigue-zague da arte dele; o último ponto é o Boss
  const mpUi = { diff: null, act: null, dd: false }; // diff: só para espiar uma dificuldade bloqueada
  const mpSkull = (c) => `<svg viewBox="0 0 20 20" class="mp-skull" aria-hidden="true"><path d="M10 2C5.6 2 3 4.9 3 8.6c0 2.2 1 3.6 2.3 4.5V16h2v-1.6h1.3V16h2.8v-1.6h1.3V16h2v-2.9C16 12.2 17 10.8 17 8.6 17 4.9 14.4 2 10 2z" fill="${c}"/><circle cx="7.3" cy="9" r="1.9" fill="#0a0f24"/><circle cx="12.7" cy="9" r="1.9" fill="#0a0f24"/><path d="M9.2 11.6h1.6l-.8 1.4z" fill="#0a0f24"/></svg>`;
  // v358 (Mickey): passar o mouse no Boss do mapa dá uma tremidinha suave na tela (uma vez por entrada)
  document.addEventListener("mouseover", (ev) => {
    const n = ev.target.closest?.(".mp-node.boss"); if (!n || n.contains(ev.relatedTarget)) return;
    document.body.classList.remove("mp-shake"); void document.body.offsetWidth; document.body.classList.add("mp-shake");
    clearTimeout(mapaKey.t); mapaKey.t = setTimeout(() => document.body.classList.remove("mp-shake"), 400);
  });
  function mapaKey() { const s = G.state, pr = s.progress; return [mpUi.diff, G.diff(), s.progress.diffMax, mpUi.act, mpUi.dd, pr.map, pr.stage, pr.reach, s.training, JSON.stringify(pr.cleared || {}), G.dev, C.MAPS.map((m, i) => G.mapUnlocked(i)).join()].join("|"); }
  // v659 (Mickey): arte do Boss de cada Ato no fundo do tabuleiro (img/mapas/bosses.jpg, 5×2 na ordem dos mapas)
  // v670 (Mickey): botões do Mapa da arte dele: img/mapas/botoes.webp (6×2: 10 bosses na ordem de C.MAPS, bolinha, bolinha com bandeira) e rotulos.webp (2×10: nome do boss | "N - 10")
  const mpBtn = (k) => `background-position:${(k % 6) * 20}% ${k < 6 ? 0 : 100}%`;
  const MP_BC = ["#ff2a3a", "#3fa9ff", "#ffc630", "#ff4fb8", "#ff3d7a", "#ff8a1f", "#b05cff", "#2fb8ff", "#e8233a", "#3d7bff"]; // v672: cor do anel pulsante de cada Boss (ordem de C.MAPS)
  const mpLab = (i, c) => `background-position:${c * 100}% ${(i / 9 * 100).toFixed(2)}%`;
  // v679 (Mickey): no Ato atual, o rodapé do Mapa diz qual é o próximo modo e o que falta (ou dá o botão, se já abriu)
  function mpNext(act) {
    const nx = act + 1; if (nx >= C.MAPS.length) return "";
    const m = C.MAPS[nx];
    if (G.mapUnlocked(nx)) return nx <= 3 && nx > G.modePlayed() ? `<button type="button" class="btn btn-hot mp-go" data-map="${nx}">${m.mode} liberado · Jogar</button>` : "";
    if (nx >= 4) return `<small class="mp-nx">Próximo: Ato ${nx + 1} · vença o Boss deste Ato</small>`;
    const f = G.modeNeed(nx);
    return `<small class="mp-nx">Próximo modo: ${m.mode} · ${f ? `falta${f > 1 ? "m" : ""} ${f} jogador${f > 1 ? "es" : ""} no elenco${G.prologue() ? " (vença o Boss da 1-10)" : " (roube vencendo com uma Proposta)"}` : "vença o Boss deste Ato"}</small>`;
  }
  // Pop-up único quando um modo maior abre: explica a regra e oferece ir agora
  // v682 (Mickey): explicação única no começo da conta. Só explica, não conduz o jogador.
  function introNotice() {
    const s = G.state; if (!s || s.firstTip || currentModal || rouletteLock || !$("landing").hidden) return;
    s.firstTip = 1; G.save();
    const gift = C.STEAL_GIFT ? C.STEAL_GIFT.n : 0, sk = Object.keys(C.SKILL_UNLOCK_LV || {}).find((id) => C.SKILL_UNLOCK_LV[id] <= 1), sd = sk && C.SKILL_DEF[sk];
    const rows = [
      ["Partida", "A partida roda sozinha. Ganhando ou perdendo, seu jogador ganha XP e sobe de nível."],
      ["Roubo", `Ao vencer, você tem uma chance de roubar o adversário (ela aparece no card dele). Você começa com ${gift} Propostas Básicas, que aumentam essa chance. Cada tentativa gasta 1.`],
      ["Modos", "Com 2 jogadores no elenco abre o 2×2, com 3 o 3×3 e com 4 o 4×4. O jogo avisa quando abrir, e você troca no botão Mapa."],
      sd ? ["Habilidade", `Seu time já tem 1 habilidade no nível 1: ${sd.name}. Ela fica em Habilidades, no menu de baixo. Coloque em um dos 4 espaços para o time usar na partida. As outras abrem com o nível da conta e vencendo Bosses.`] : null,
      ["Missões", "O botão Missões, à direita, mostra o próximo objetivo e dá prêmios."],
      ["Energia", "Jogador cansado joga pior. Água e Gatorade recuperam a energia e ficam na Mochila."],
      ["Beta", "O progresso fica salvo só neste navegador. Em Configurações, aba Conta, dá para exportar o save."],
    ].filter(Boolean).map(([k, t]) => `<li><b>${k}</b><span>${t}</span></li>`).join("");
    openModal("Como funciona", `<div class="mdn itr"><p class="mdn-big">Bem-vindo ao <b>BL Project</b></p><p class="mdn-p">Sua primeira partida já começou. O que vale saber antes de explorar:</p><ul class="mdn-list">${rows}</ul><div class="mdn-btns"><button type="button" class="btn btn-hot" data-mdn-stay>Entendi</button></div></div>`);
  }
  // v688 (Mickey): tutorial guiado. A cabecinha em pixel do Mickey congela a partida, aponta onde clicar e só solta quando o jogador faz.
  // Sequências em TUT_SEQ (uma por vez, na ordem); progresso em state.tut { n: partidas começadas, done: { id: 1 } }. Conta antiga (já jogou) nasce com done.all.
  const tutSt = () => { const s = G.state; if (!s.tut) s.tut = { n: 0, done: (s.analyzer && s.analyzer.matches > 3) || (s.career && s.career.wins > 2) ? { all: 1 } : {} }; return s.tut; };
  const tutMine = () => $("myTeam").querySelector(".mini-card[data-ev]");
  const tutSkName = () => { const id = Object.keys(G.skLib() || {}).find((k) => C.SKILL_DEF[k]); return id ? C.SKILL_DEF[id].name : "uma habilidade"; };
  const tutEvBox = () => { const b = [...document.querySelectorAll("#modalBody [data-ev-add]")]; if (!b.length) return null; let a = b[0].parentNode; while (a && !a.contains(b[b.length - 1])) a = a.parentNode; return a; };
  const tutConsN = () => { const c = G.cons(); return Object.keys(C.CONSUMABLES).reduce((n, id) => n + (c[id] || 0), 0); };
  const tutLow = () => (G.match ? G.activePlayers().find((q) => { const e = G.healEnt(q.uid); return e && e.energy < 50; }) : null);
  const tutVestHeal = () => (G.vest && currentModal === "Vestiário" ? document.querySelector("#modalBody [data-vest-heal]:not([disabled])") : null);
  const tutLowCard = () => { const p = tutLow(); return p ? $("myTeam").querySelector(`.mini-card[data-ev="${p.uid}"]`) : null; };
  const TUT_SEQ = [
    { id: "inicio", when: (t) => t.n >= 1, steps: [
      { t: "Fala! Eu sou o <b>Mickey</b> e vou te guiar nas primeiras partidas. Pausei o jogo rapidinho para te mostrar o básico.", ok: "Vamos lá" },
      { at: tutMine, t: "Este é o <b>seu jogador</b>. A partida roda sozinha: ele joga e você cuida do time. Ganhando ou perdendo, ele ganha XP e sobe de nível.", ok: "Entendi" },
      { at: () => $("enemyCard"), t: () => `Este é o <b>adversário</b>. Se você vencer, tem uma chance de <b>roubar</b> ele para o seu elenco. É a <b>Proposta</b> que tenta o roubo: cada tentativa gasta 1.`, ok: "Entendi" },
      { skip: () => !G.mailPending(), at: () => $("btnMail"), t: "Chegou um presente para você começar: <b>200 Propostas Básicas</b> e <b>10 Águas</b>. Clique no <b>Correio</b>.", until: () => currentModal === "Correio" },
      { skip: () => !G.mailPending(), at: () => document.querySelector("#modalBody [data-mail-claim]"), t: "Clique em <b>Resgatar</b> para pegar o seu kit.", until: () => !G.mailPending() },
      { skip: () => currentModal !== "Correio", at: () => document.querySelector("#modalBody [data-eq-close]"), t: "Pronto, foi tudo para a Mochila. Feche o Correio e assista à sua primeira partida.", until: () => !currentModal }] }, // v689 (Mickey): o balão dos 10 níveis saiu
    { id: "fases", when: (t) => t.n >= 2 && G.state.progress.map === 0 && G.state.progress.stage >= 2 && !G.state.training, steps: [ // v692 (Mickey): como as fases mudam
      { at: () => $("railMap").closest(".rail-btn"), t: () => `Você venceu e já está na fase <b>${G.stageLabel()}</b>. Funciona assim: cada <b>vitória</b> passa para a próxima fase sozinha e o seu jogador sobe para o nível dela. Se perder, você fica na mesma fase e tenta de novo. Clique no <b>Mapa</b>.`, until: () => !!floats.mapa },
      { at: () => document.querySelector(".mp-node.now"), allow: () => document.querySelector(".mp"), t: "Este é o caminho do Ato: <b>10 fases</b>, e a última é o <b>Boss</b>. A bola marca onde você está. As fases que você já venceu ficam abertas: clicando nelas dá para voltar e jogar de novo.", ok: "Entendi" },
      { at: () => document.querySelector(".mp-node.boss"), allow: () => document.querySelector(".mp"), t: () => `Vencendo o <b>Boss</b> na fase ${C.STAGES_PER_MAP}, você libera o próximo Ato, o <b>2×2</b>, onde joga com o parceiro que roubou. Feche o Mapa quando quiser e siga em frente!`, ok: "Bora" }] },
    { id: "misericordia", when: (t) => !!t.mercy, steps: [ // v693 (Mickey): primeira partida encerrada por 4 gols de vantagem
      { at: () => $("scoreNow") || document.querySelector(".sb-score") || null, t: (x) => `Viu que a última partida acabou antes do tempo? Foi a <b>regra de misericórdia</b>: quando um time abre <b>${C.MERCY_DIFF} gols de vantagem</b>, o jogo termina na hora. ${tutSt().mercy === 2 ? "Dessa vez foi contra você, acontece." : "Você atropelou!"} Assim ninguém perde tempo em partida já decidida e você joga a próxima mais rápido.`, ok: "Entendi" }] },
    { id: "expedicao", when: (t) => t.n >= 3 && tutSpare() && !G.exp().cur, steps: [ // v693 (Mickey): sobrou jogador no elenco
      { at: () => document.querySelector('.dock [data-open="expedicao"]') || document.querySelector('[data-open="expedicao"]'), t: () => `Você tem jogador <b>sobrando</b> no elenco: neste modo só ${G.map.size === 1 ? "entra 1" : "entram " + G.map.size} em campo. Quem está parado pode trabalhar para você na <b>Expedição</b>. Clique nela.`, until: () => currentModal === "Expedição" },
      { allow: () => $("modal"), t: "Na Expedição o jogador sai sozinho e volta com <b>XP, Gold</b> e chance de <b>itens e bebidas</b>. Enquanto isso ele fica fora das partidas, por isso mande quem não é titular.", ok: "Entendi" },
      { allow: () => $("modal"), t: () => `Você escolhe quanto tempo ele fica fora: <b>${C.EXPEDITION.durations.map((d) => (d.min < 60 ? d.min + " min" : d.min / 60 + " h")).join(", ")}</b>. Quanto mais tempo, maior o prêmio, e o relógio corre mesmo com o <b>jogo fechado</b>. A de 8 horas é boa para deixar antes de dormir.`, ok: "Entendi" },
      { allow: () => $("modal"), t: "Cada viagem enche a barra do nível. Barra cheia libera o próximo nível da trilha, com prêmios melhores. Jogador com o atributo certo da região rende mais. Escolha um jogador, um tempo e envie quando quiser!", ok: "Bora" }] },
    { id: "habilidade", when: (t) => t.n >= 2 && Object.keys(G.skLib() || {}).length > 0, skip: () => G.teamSkills().length > 0, steps: [
      { at: () => $("dockSkills").querySelector(".sk-slot"), t: () => `Seu time já tem uma habilidade guardada: <b>${esc(tutSkName())}</b>. Ela não vem equipada. Clique neste espaço vazio.`, until: () => currentModal === "Habilidades" },
      { at: () => document.querySelector("#modalBody .hb-card:not(.locked)"), t: "Agora clique na habilidade para colocar no time.", until: () => G.teamSkills().length > 0 },
      { at: () => $("modalClose"), t: "Boa! Na partida, quem estiver na melhor posição usa a habilidade sozinho, sempre que a recarga acabar. As outras abrem com o nível da conta e vencendo Bosses. Agora feche a janela.", until: () => !currentModal }] },
    { id: "ev", when: (t) => t.n >= 3 && G.evPool() > 0 && !!tutMine(), steps: [
      { at: tutMine, t: () => `Toda partida dá <b>pontos de EV</b>: ${C.EV_WIN} na vitória e ${C.EV_LOSS} na derrota. Com eles você aumenta o atributo que quiser. Você já tem ${G.evPool()}. Clique no seu jogador.`, until: () => !!tutEvBox() },
      { at: tutEvBox, enter: (x) => { x.ev = G.evPool(); }, t: "<b>IV</b> nasce com o jogador e não muda. <b>EV</b> é você quem distribui. Escolha um atributo e clique em +1 ou +10.", until: (x) => G.evPool() < x.ev },
      { at: () => $("modalClose"), allow: () => $("modal"), t: "Boa! Dá para gastar o resto agora ou guardar, e resetar depois por Gold. Feche a janela quando terminar.", until: () => !currentModal }] },
    { id: "energia", when: () => !!tutLowCard(), steps: [
      { at: tutLowCard, t: () => `Seu jogador está <b>cansado</b>, e cansado ele joga pior. Água e Gatorade recuperam a energia, mas só podem ser usadas no <b>intervalo</b>, no Vestiário. Você tem ${tutConsN()} na Mochila; tem mais na <b>Loja</b>.`, ok: "Entendi" }] },
    { id: "vestiario", vest: true, when: () => !!tutVestHeal(), steps: [
      { at: tutVestHeal, allow: () => $("modal"), enter: (x) => { x.n = tutConsN(); }, t: "Este é o <b>Vestiário</b>, o intervalo da partida. É aqui que você usa a bebida: clique nela para recuperar a energia do jogador. Também dá para trocar com os reservas.", until: (x) => tutConsN() < x.n }] },
    { id: "bau", when: (t) => t.n >= 2 && (G.state.chests || []).length > 0, steps: [
      { at: () => $("railChests").closest(".rail-btn"), t: "Caiu um <b>baú</b>! Baús aparecem em gols e vitórias, e tudo vai para os Espólios. Clique para ver.", until: () => !!floats.chests || currentModal === "Espólios" },
      { t: "É só clicar no baú para abrir. Eles guardam Gold e itens para o seu time.", ok: "Entendi" }] },
    { id: "missoes", when: (t) => t.n >= 4, steps: [
      { at: () => $("railMis").closest(".rail-btn"), t: "Aqui ficam as <b>Missões</b>: objetivos em ordem, cada um com prêmio. Clique para ver a sua missão atual.", until: () => currentModal === "Missões" },
      { at: () => $("modalClose"), allow: () => $("modal"), t: "Cumpra a missão e pegue o prêmio aqui. Daqui para frente é com você. Feche a janela e bom jogo!", until: () => !currentModal }] },
    { id: "tecnico", when: (t) => t.n >= 5, steps: [ // v691 (Mickey): técnicos e itens de treinador
      { at: () => $("dockLead").querySelector(".coach-card") || $("dockLead"), t: "Este é o seu <b>técnico</b>. Cada técnico tem uma passiva que vale a partida inteira, como deixar os adversários mais lentos ou render mais Gold. O nível dele é o da sua conta: quanto maior, melhor ele lê a formação do adversário. Clique nele.", until: () => currentModal === "Técnicos" },
      { at: () => document.querySelector("#modalBody [data-eq-close]"), allow: () => $("modal"), t: "Aqui ficam todos os técnicos e a passiva de cada um. Você começa com o Kyouya Kurogane e pode contratar os outros. Só um trabalha por vez. Olhe à vontade e feche a janela.", until: () => !currentModal },
      { at: () => $("railBag").closest(".rail-btn"), t: "O técnico também usa <b>itens de treinador</b>: são 3 espaços que dão mais XP, Gold, baús e outros bônus. Atenção: cada item vale por <b>1 partida</b>. Jogou, gastou, e para usar de novo precisa ter outro. Eles vêm da Loja e dos baús, e você equipa pela <b>Mochila</b>.", ok: "Entendi" }] },
    { id: "fichas", when: (t) => t.n >= 2 && tutFichas() > 0, steps: [ // v695 (Mickey): primeira ficha de cor da Expedição
      { at: () => $("railBag").closest(".rail-btn"), t: () => `A Expedição trouxe <b>fichas</b>! Cada cor de ficha é uma <b>raridade</b> de item. Juntando o bastante da mesma cor, você <b>forja</b> um equipamento dessa raridade. Clique na <b>Mochila</b>.`, until: () => currentModal === "Mochila" },
      { at: () => document.querySelector('#modalBody [data-bag-cat="forja"]'), allow: () => $("modal"), t: "As fichas ficam na aba <b>Forja</b>. Clique nela.", until: () => bagUi.cat === "forja" },
      { allow: () => $("modal"), t: () => `Cada barra é uma cor: ${Object.values(C.FICHAS).map((F) => `<b style="color:${rar(F.rarity).color}">${rar(F.rarity).name}</b> pede ${F.n}`).join(", ")}. Encheu a barra, o botão vira <b>Forjar</b> e você ganha 1 chuteira, caneleira ou camisa aleatória daquela raridade.`, ok: "Entendi" },
      { allow: () => $("modal"), t: "Para juntar mais rápido: expedições <b>mais longas</b> trazem mais fichas, e as regiões mais avançadas trazem fichas de cores melhores. Depois é só equipar o item no seu jogador aqui mesmo na Mochila.", ok: "Bora" }] },
    { id: "soneca", when: (t) => t.n >= 5 && !G.state.training && (G.state.progress.map > 0 || G.state.progress.stage >= 7), steps: [ // v693 (Mickey): depois de passar 6 fases do 1×1
      { at: () => document.querySelector('.tb-ico[data-open="sleep"]'), t: "Vai sair do jogo? Antes, conheça o <b>Modo Soneca</b>: com ele o seu time continua ganhando XP com o jogo <b>fechado</b>. Clique na lua.", until: () => currentModal === "Modo Soneca" },
      { allow: () => $("modal"), t: () => `Funciona assim: você entra em soneca, o jogo mede o seu ritmo por ${Math.round(C.SLEEP_MEASURE_SEC / 60)} minutos e te leva para a tela inicial. Quando voltar, cada jogador do time recebe o <b>XP</b> das horas que passaram, pela fase em que você parou. Não tem limite de horas.`, ok: "Entendi" },
      { allow: () => $("modal"), t: () => `Dois detalhes: a soneca dá <b>só XP</b> (Gold, baús e roubos só jogando) e rende ${Math.round(C.SLEEP_XP_MULT * 100)}% do XP de uma partida normal. Por isso vale parar na fase mais alta que você vence. Use sempre que for fechar o jogo!`, ok: "Bora" }] },
  ];
  const tutFichas = () => { const c = G.cons(); return Object.keys(C.FICHAS || {}).reduce((n, id) => n + (c[id] || 0), 0); }; // v695
  const tutSpare = () => G.state.roster.filter((p) => !G.isAway(p.uid)).length > G.map.size; // v693
  const TUT = { cur: null };
  function tutEl() {
    let w = $("tut"); if (w) return w;
    w = document.createElement("div"); w.id = "tut"; w.hidden = true;
    w.innerHTML = `<div class="tut-ring"></div><div class="tut-bub"><div class="tut-face"><i></i><u></u></div><div class="tut-tx"><b class="tut-nm">Mickey</b><p></p><div class="tut-ft"><button type="button" class="btn btn-hot tut-ok"></button><button type="button" class="tut-skip">Pular tutorial</button></div></div></div>`;
    document.body.appendChild(w);
    w.querySelector(".tut-ok").addEventListener("click", () => { if (TUT.cur) tutNext(); });
    w.querySelector(".tut-skip").addEventListener("click", () => { if (!TUT.cur) return; tutSt().done.all = 1; tutEnd(false); toast("Tutorial desligado"); });
    return w;
  }
  function tutStep() { const c = TUT.cur; return c.q.steps[c.i]; }
  function tutEnter() { const c = TUT.cur, st = tutStep(); c.x = c.x || {}; c.miss = 0; c.key = null; if (st.enter) st.enter(c.x); }
  function tutNext() { const c = TUT.cur; do { if (++c.i >= c.q.steps.length) return tutEnd(true); } while (tutStep().skip && tutStep().skip()); tutEnter(); tutDraw(); } // v690: passo com skip() verdadeiro é pulado
  function tutEnd(done) { const c = TUT.cur; TUT.cur = null; if (!c) return; if (done) tutSt().done[c.q.id] = 1; TUT.wait = Date.now() + 8000; G.save(); tutEl().hidden = true; if (G.match === c.m && c.m.paused && !G.vest && !G.prematch && currentModal !== "Pausa tática") c.m.paused = false; }
  function tutDraw() {
    const c = TUT.cur, st = tutStep(), w = tutEl();
    if (!G.match || G.match !== c.m || !$("landing").hidden) return tutEnd(false);
    c.m.paused = true;
    if (st.until && st.until(c.x)) return tutNext();
    const el = st.at ? st.at(c.x) : null;
    if (st.at && !el) { if (++c.miss > 12) { if (c.i) { c.i = 0; tutEnter(); } else return tutEnd(false); } return; } // alvo sumiu (janela fechada): volta ao 1º passo
    c.miss = 0; c.el = el; w.hidden = false;
    const key = c.q.id + c.i;
    if (c.key !== key) { c.key = key; w.querySelector("p").innerHTML = typeof st.t === "function" ? st.t(c.x) : st.t; const ok = w.querySelector(".tut-ok"); ok.hidden = !st.ok; ok.textContent = st.ok || ""; const fc = w.querySelector(".tut-face"); fc.classList.remove("pop"); void w.offsetWidth; fc.classList.add("pop", "talk"); clearTimeout(TUT.talkT); TUT.talkT = setTimeout(() => fc.classList.remove("talk"), 2600); } // v689: fala (boca mexe) por 2,6 s a cada balão, depois só pisca e balança
    const ring = w.querySelector(".tut-ring"), bub = w.querySelector(".tut-bub"), W = innerWidth, H = innerHeight, bw = bub.offsetWidth, bh = bub.offsetHeight;
    if (!el) { ring.style.cssText = `left:${W / 2}px;top:${H / 2}px;width:0;height:0;border:0`; bub.className = "tut-bub"; bub.style.left = `${(W - bw) / 2}px`; bub.style.top = `${(H - bh) / 2}px`; return; }
    const r = el.getBoundingClientRect(), pad = 6;
    ring.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
    const below = r.bottom + bh + 26 < H, above = r.top - bh - 26 > 0, cx = r.left + r.width / 2;
    let x, y, cls = "tut-bub";
    if (below || above) { x = Math.max(10, Math.min(W - bw - 10, cx - bw / 2)); y = below ? r.bottom + 20 : r.top - bh - 20; cls += below ? " up" : " down"; bub.style.setProperty("--ax", `${Math.max(24, Math.min(bw - 24, cx - x))}px`); }
    else { const right = r.right + bw + 26 < W; x = right ? r.right + 20 : Math.max(10, r.left - bw - 20); y = Math.max(10, Math.min(H - bh - 10, r.top + r.height / 2 - bh / 2)); cls += right ? " lft" : " rgt"; }
    bub.className = cls; bub.style.left = `${x}px`; bub.style.top = `${y}px`;
  }
  function tutTick() {
    const s = G.state; if (!s || !$("landing").hidden) return;
    if (TUT.cur) return tutDraw();
    const m = G.match, t = tutSt();
    if (G.dev || t.done.all || !m || m.training || G.pvpFight || rouletteLock) return;
    const inVest = !!(G.vest && currentModal === "Vestiário"); // v690: sequência com vest: true roda dentro do Vestiário (partida já pausada)
    if (!inVest && (m.paused || m.state === "ended" || currentModal || G.vest || G.prematch || (m.clock || 0) < 1.2 || Date.now() < (TUT.wait || 0))) return; // 8 s de respiro entre uma sequência e outra
    const q = TUT_SEQ.find((x) => !t.done[x.id] && !!x.vest === inVest && x.when(t)); if (!q) return;
    if (q.skip && q.skip()) { t.done[q.id] = 1; G.save(); return; }
    TUT.cur = { q, i: 0, m, x: {} }; m.paused = true; tutEnter(); tutDraw();
  }
  setInterval(tutTick, 150);
  // v693 (Mickey): janela "Novo Ato": escolher quem sobe de nível para jogar o 2×2 (ou o 3×3). Reaparece depois de 90 s se for fechada sem escolher
  let apWait = 0, apSel = null, skBuyArm = null;
  // v694 (Mickey): aviso de habilidade nova. Fica na tela até clicar (abre Habilidades) ou fechar
  let skKnown = null;
  function skNewCheck() {
    if (!G.state || !$("landing").hidden || G.dev) { skKnown = null; return; }
    const ids = Object.keys(G.skLib() || {}), acc = G.account || "";
    if (!skKnown || skKnown.acc !== acc) { skKnown = { acc, set: new Set(ids) }; return; }
    const nw = ids.filter((id) => !skKnown.set.has(id) && C.SKILL_DEF[id]); if (!nw.length) return; nw.forEach((id) => skKnown.set.add(id));
    let el = $("skNew"); if (el) el.remove(); el = document.createElement("div"); el.id = "skNew"; el.className = "sk-new"; const d = C.SKILL_DEF[nw[0]]; el.style.setProperty("--rc", C.SKILL_RAR_COL[d.rar] || "#26D9FF");
    el.innerHTML = `<button type="button" class="sk-new-go">${skIco(nw[0], 56)}<span><small>Habilidade nova!</small><b>${esc(d.name)}${nw.length > 1 ? ` +${nw.length - 1}` : ""}</b><em>Clique para ver e equipar</em></span></button><button type="button" class="sk-new-x" aria-label="Fechar">✕</button>`;
    el.querySelector(".sk-new-go").addEventListener("click", () => { el.remove(); MODALS.habilidades(); });
    el.querySelector(".sk-new-x").addEventListener("click", () => el.remove());
    document.body.appendChild(el); fanfare();
  }
  setInterval(skNewCheck, 1000);
  function actPickOpen() {
    const n = G.actNeed(); if (!n) return; const mp = C.MAPS[n.map]; apSel = n.list.some((p) => p.uid === apSel) ? apSel : null;
    openModal("Novo Ato", `<div class="st-pick ap-pick"><p class="st-lead">Você liberou o <b>${mp.mode}</b>! Agora ${mp.size === 2 ? "entram 2 jogadores" : "entram " + mp.size + " jogadores"} em campo. <b>Escolha quem vai jogar com você</b>: o escolhido sobe direto para o <b>Nv ${n.lv}</b>.${n.left > 1 ? ` Faltam ${n.left} escolhas.` : ""}</p>
      <div class="st-row ap-row">${n.list.map((p) => `<button type="button" class="st-card${p.uid === apSel ? " on" : ""}" data-ap="${p.uid}"><span class="st-face">${spr(p.charId) || `<span class="rl-badge">${esc(p.initials)}</span>`}<b>${esc(p.name)}</b><small>${esc(posName(p.position))} · <i style="color:${rar(p.rarity).color};font-style:normal">${rar(p.rarity).name}</i></small><small class="ap-lv">Nv ${p.level} <u>➜</u> <b>Nv ${n.lv}</b></small></span></button>`).join("")}</div>
      <div class="reveal-actions"><button type="button" class="btn btn-hot" data-ap-ok ${apSel ? "" : "disabled"}>${apSel ? `Subir ${esc(n.list.find((p) => p.uid === apSel).short)} para o Nv ${n.lv}` : "Escolha um jogador"}</button></div></div>`);
    idleAnimate($("modalBody"));
  }
  setInterval(() => { if (!G.state || !$("landing").hidden || currentModal || TUT.cur || rouletteLock || G.vest || G.prematch || G.pvpFight || Date.now() < apWait || !G.actNeed()) return; apWait = Date.now() + 90000; actPickOpen(); }, 1000);
  // enquanto o Mickey fala, só o alvo (ou a área liberada do passo) e o balão recebem clique
  ["click", "pointerdown", "mousedown", "touchstart"].forEach((ev) => document.addEventListener(ev, (e) => {
    const c = TUT.cur; if (!c || $("tut").hidden) return; const st = tutStep(), a = st.allow ? st.allow() : null, el = st.at ? st.at(c.x) : null; // alvo lido na hora: janelas se redesenham
    if (e.target.closest(".tut-bub") || (el && el.contains(e.target)) || (a && a.contains(e.target))) return;
    e.stopPropagation(); e.preventDefault();
  }, true));
  document.addEventListener("keydown", (e) => { if (TUT.cur && e.key === "Escape") { e.stopPropagation(); e.preventDefault(); } }, true);
  function modeNotice() {
    const i = G.state ? G.modeNew() : -1; if (i < 0 || TUT.cur || currentModal || rouletteLock || !$("landing").hidden || G.vest) return;
    const m = C.MAPS[i], cur = G.map, n = G.state.roster.length;
    const rows = [1, 2, 3].map((k) => { const mm = C.MAPS[k], ok = G.mapUnlocked(k); return `<li class="${ok ? "ok" : ""}${k === i ? " new" : ""}"><b>${mm.mode}</b><span>${mm.size} jogadores no elenco</span><em>${ok ? "Liberado" : G.modeNeed(k) ? `Faltam ${G.modeNeed(k)}` : "Vença o Boss"}</em></li>`; }).join("");
    G.modeAck(i);
    openModal("Novo modo liberado", `<div class="mdn"><p class="mdn-big"><b>${m.mode}</b> liberado!</p>
      <p class="mdn-p">Você venceu o Boss e já tem ${n} jogadores no elenco, então pode sair do ${cur.mode} e jogar o <b>${esc(m.name)}</b>. Lá os adversários vão do Nv ${m.levelMin} ao ${m.levelMax} e o XP é bem maior, então o seu time sobe rápido.</p>
      <ul class="mdn-list">${rows}</ul>
      <p class="mdn-p">Cada modo abre quando você vence o Boss do Ato anterior e o elenco tem jogadores suficientes. Para ter mais jogadores, vença partidas com uma Proposta equipada e roube o adversário. Você troca de Ato quando quiser no botão <b>Mapa</b>, à direita, e nos Atos já vencidos pode escolher qualquer fase.</p>
      <div class="mdn-btns"><button type="button" class="btn btn-hot" data-map="${i}">Jogar ${m.mode} agora</button><button type="button" class="btn" data-mdn-stay>Continuar no ${cur.mode}</button></div></div>`);
  }
  setInterval(modeNotice, 2500);
  document.addEventListener("click", (e) => { if (e.target.closest("[data-mdn-stay]")) closeModal(); });
  function mapaHtml() {
    const s = G.state, pr = s.progress, act = mpUi.act ?? pr.map, m = C.MAPS[act], diff = MP_DIFFS[mpUi.diff ?? G.diff()], cur = act === pr.map, open = G.mapUnlocked(act);
    const pick = cur && G.canPickStage(), dLock = diff.i !== G.diff();
    const pts = MP_PTS.map(([x, y]) => `${x},${y}`).join(" "), donePts = MP_PTS.slice(0, cur ? pr.stage : (pr.cleared || {})[act] ? 10 : 1).map(([x, y]) => `${x},${y}`).join(" ");
    const nodes = MP_PTS.map(([x, y], i) => {
      const n = i + 1, boss = n === C.STAGES_PER_MAP;
      const st = dLock || !open ? "lock" : cur ? (n !== pr.stage && n < Math.max(pr.stage, pr.reach || 1) || (boss && G.mapCleared(act)) ? "done" : n === pr.stage ? "now" : G.mapCleared(act) ? "free" : "lock") : G.mapCleared(act) ? "free" : "lock";
      const pick = cur && G.canPickStage(n), play = !dLock && cur && s.training && (pick || n === pr.stage), can = !dLock && cur && (play || pick); // v615
      const attr = can ? `type="button" ${play ? `data-play="${n}"` : `data-stage="${n}"`}` : "";
      const tag = can ? "button" : "span";
      return `<${tag} ${attr} class="mp-node ${st} ${boss ? "boss" : ""}" style="left:${x}%;top:${y}%${boss ? `;${mpBtn(act)};--bc:${MP_BC[act] || "#c8afff"}` : ""}" title="${boss ? "Boss" : "Fase"} ${m.id}-${n}">${boss ? `<i class="mp-lb n${act ? "" : " b1"}" aria-hidden="true" style="${mpLab(act, 0)}"></i>${act ? `<i class="mp-lb m" aria-hidden="true" style="${mpLab(act, 1)}"></i>` : ""}` : st === "now" ? `<i class="mp-fo" aria-hidden="true"></i>` : ""}${boss ? "" : `<em>[${m.id}-${n}]</em>`}</${tag}>`;
    }).join("");
    return `<div class="mp" style="--mp:${diff.c}">
      <div class="mp-top"><button type="button" class="mp-dd" data-mp-dd="1" aria-expanded="${mpUi.dd}">${mpSkull(diff.c)}<span>${diff.name}</span><b>${mpUi.dd ? "▴" : "▾"}</b></button>
        ${mpUi.dd ? `<div class="mp-ddl">${MP_DIFFS.map((d) => `<button type="button" data-mp-diff="${d.id}" class="${d.i === diff.i ? "on" : ""}">${mpSkull(d.c)}<span>${d.name}</span><i>${G.diffUnlocked(d.i) ? (d.levels ? `+${d.levels} Nv · ×${String(d.reward).replace(".", ",")}` : "") : "🔒"}</i></button>`).join("")}</div>` : ""}</div>
      <div class="mp-tabs">${C.MAPS.map((mm, i) => `<button type="button" data-mp-act="${i}" class="${i === act ? "on" : ""} ${G.mapUnlocked(i) ? "" : "locked"}">Ato ${i + 1}<small>${G.mapUnlocked(i) ? mm.mode : "🔒"}</small></button>`).join("")}</div>
      <div class="mp-board mp-art-on">
        <i class="mp-bart" aria-hidden="true" style="background-position:${(act % 5) * 25}% ${act < 5 ? 0 : 100}%"></i>
        <svg class="mp-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" class="mp-path"/>${!dLock && open ? `<polyline points="${donePts}" class="mp-path done"/>` : ""}</svg>
        ${nodes}
        ${dLock ? `<div class="mp-lockbox"><b>🔒 ${diff.name}</b><span>Vença o Boss do Ato ${C.MAPS.length} no ${MP_DIFFS[diff.i - 1].name}</span><small>Inimigos +${diff.levels} níveis · XP e Gold ×${String(diff.reward).replace(".", ",")}</small></div>` : !open ? `<div class="mp-lockbox"><b>🔒 Ato ${act + 1}</b><span>Precisa de ${m.size} jogadores no elenco${act < 4 ? ` · faltam ${G.modeNeed(act)}` : ""}</span><small>${act >= 4 ? `Vença o Boss do Ato ${act}` : G.prologue() ? "Vença o Boss da fase 1-10: você ganha um jogador" : "Roube jogadores vencendo com uma Proposta equipada"}</small></div>` : ""}
      </div>
      <div class="mp-foot">${dLock ? `<span>Dificuldade ${diff.name} bloqueada.</span>` : cur ? `<span>${s.training ? "Treino · clique na fase para jogar" : `Jogando a fase <b>${G.stageLabel()}</b>`}${G.mapCleared(act) ? " · fases livres" : ""}</span>${mpNext(act)}` : open ? `<span>Ato liberado · Nv ${m.levelMin + diff.levels}–${m.levelMax + diff.levels}</span><button type="button" class="btn btn-hot" data-map="${act}">Jogar Ato ${act + 1}</button>` : `<span>Ato bloqueado</span>`}</div>
    </div>`;
  }
  function toggleFloat(key) { floats[key] ? closeFloat(key) : openFloat(key); }
  function openFloat(key) {
    if (key === "analyser") return; // v667 (Mickey): Striker Analyser saiu do jogo
    if (!G.state) return;
    if (key === "missoes") return MODALS.missoes(); // v534: Missões é janela grande
    if (key === "mochila") return MODALS.mochila(); // v381: a Mochila é uma janela grande (modal), não flutuante
    if (key === "chests") return MODALS.espolios(); // v382: o Espólios também
    const w = document.createElement("section");
    w.className = "float f-" + key; w.setAttribute("role", "dialog"); w.setAttribute("aria-label", FLOATS[key].title);
    w.innerHTML = key === "chests" ? `<header class="float-h"><h3>${FLOATS[key].title}</h3><button type="button" class="esp-all" data-chest-all="*">Abrir todos</button></header><div class="float-b">${floatBody(key)}</div><span class="float-rs" title="Redimensionar" aria-label="Redimensionar"></span>` : `<header class="float-h">${key === "analyser" ? `<span class="float-ico" aria-hidden="true">${document.querySelector('.rail-btn[data-float="analyser"] .rail-ico')?.outerHTML || ""}</span>` : ""}<span class="float-k">${key === "dev" ? "Ferramenta de dev" : key === "mapa" ? "Progressão" : key === "mochila" ? "Seus itens" : "Análise idle"}</span><h3>${FLOATS[key].title}</h3>${key === "analyser" ? `<span class="float-sub">${anSub()}</span>` : ""}<button type="button" data-float-min="${key}" aria-label="Minimizar">—</button><button type="button" data-float-close="${key}" aria-label="Fechar">✕</button></header><div class="float-b">${floatBody(key)}</div><span class="float-rs" title="Redimensionar" aria-label="Redimensionar"></span>`;
    $("floats").appendChild(w); floats[key] = w;
    sizeFloat(w, key); placeFloat(w, key); bringFront(w); tweenNums(w);
    // v262: alça de redimensionar no canto inferior direito
    const rs = w.querySelector(".float-rs");
    rs.addEventListener("pointerdown", (e) => {
      e.preventDefault(); e.stopPropagation(); bringFront(w);
      const sx = e.clientX, sy = e.clientY, sw = w.offsetWidth, sh = w.offsetHeight;
      rs.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const nw = Math.max(280, Math.min(window.innerWidth - w.offsetLeft - 4, sw + ev.clientX - sx));
        const nh = Math.max(180, Math.min(window.innerHeight - w.offsetTop - 4, sh + ev.clientY - sy));
        w.style.width = nw + "px"; w.style.height = nh + "px"; w.style.maxHeight = "none";
        savedPos[key] = { ...(savedPos[key] || { x: w.offsetLeft, y: w.offsetTop }), w: nw, h: nh };
      };
      const up = () => { rs.removeEventListener("pointermove", move); rs.removeEventListener("pointerup", up); savePos(); };
      rs.addEventListener("pointermove", move); rs.addEventListener("pointerup", up);
    });
    document.querySelector(`.rail-btn[data-float="${key}"]`)?.classList.add("on");
    const h = w.querySelector(".float-h");
    h.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      bringFront(w);
      const sx = e.clientX - w.offsetLeft, sy = e.clientY - w.offsetTop;
      h.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const x = Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - sx));
        const y = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - sy));
        w.style.left = x + "px"; w.style.top = y + "px"; savedPos[key] = { ...(savedPos[key] || {}), x, y };
      };
      const up = () => { h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); savePos(); };
      h.addEventListener("pointermove", move); h.addEventListener("pointerup", up);
    });
    w.addEventListener("pointerdown", () => bringFront(w));
  }
  window.addEventListener("resize", () => {
    for (const key in floats) {
      const w = floats[key], r = w.getBoundingClientRect();
      w.style.left = Math.max(0, Math.min(window.innerWidth - r.width, w.offsetLeft)) + "px";
      w.style.top = Math.max(0, Math.min(window.innerHeight - 44, w.offsetTop)) + "px";
    }
  });
  let zTop = 40;
  function bringFront(w) { w.style.zIndex = ++zTop; }
  function closeFloat(key) { if (key === "mapa" && !kickCd && G.match && G.state && G.state.training && G.match.paused) G.match.paused = false; floats[key]?.remove(); delete floats[key]; document.querySelector(`.rail-btn[data-float="${key}"]`)?.classList.remove("on"); }
  function refreshFloats(force) {
    for (const key in floats) { if (key === "dev" && !force) continue; if (key === "mapa") { const k = mapaKey(); if (!force && floats[key].dataset.k === k) continue; floats[key].dataset.k = k; } const b = floats[key].querySelector(".float-b"); if (!floats[key].classList.contains("min")) { const st = b.scrollTop; b.innerHTML = floatBody(key); b.scrollTop = st; if (key === "analyser") { tweenNums(b); const sub = floats[key].querySelector(".float-sub"); if (sub) sub.textContent = anSub(); } } }
  }
  function renderRail() {
    const s = G.state; if (!s) return;
    if ($("railAnalyser")) $("railAnalyser").textContent = `${s.analyzer.wins}V`; // v667 (Mickey): Striker Analyser saiu do jogo
    { const nw = G.modeTop() > G.modePlayed(); $("railMap").textContent = nw ? `${C.MAPS[G.modeTop()].mode}!` : G.stageLabel(); $("railMap").closest(".rail-btn").classList.toggle("rail-new", nw); } // v263: o botão Roubo virou Mapa (a chance de roubo segue nos cards do Adversário)
    $("railDev").hidden = !G.dev;
  }

  // ---------- tela inicial ----------
  // Nome com pelo menos NAME_MIN caracteres e Tag de 1 a 4 letras liberam a escolha da função
  const startValid = () => $("startName").value.trim().length >= C.NAME_MIN && BL.cleanTag($("startTag").value).length > 0;
  function checkStart(showAll) {
    const n = $("startName").value.trim(), t = BL.cleanTag($("startTag").value), ok = startValid();
    const msgs = [];
    if (n.length < C.NAME_MIN && (showAll || n)) msgs.push(`Seu nome precisa de pelo menos ${C.NAME_MIN} caracteres.`);
    if (!t && (showAll || n.length >= C.NAME_MIN)) msgs.push(`Coloque a Tag do seu time (1 a ${C.TEAM_TAG_MAX} letras).`);
    $("startHint").textContent = ok ? (selRole ? "Tudo certo! Confirme a função escolhida." : "Tudo certo! Agora escolha sua função.") : msgs.join(" ") || `Preencha seu nome (mínimo ${C.NAME_MIN} caracteres) e a Tag do time para escolher a função.`;
    $("startHint").classList.toggle("ok", ok);
    // O clique na função só seleciona; quem começa a roleta é o botão Confirmar (liberado com nome e Tag válidos)
    document.querySelectorAll("#roles .role").forEach((b) => { const on = b.dataset.role === selRole; b.classList.toggle("selected", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    const pos = C.POSITIONS.find((p) => p.id === selRole);
    $("roleConfirmBox").hidden = !pos;
    if (pos) { $("roleConfirm").textContent = `Confirmar ${pos.name}`; $("roleConfirm").disabled = !ok; }
  }
  let selRole = null;
  function selectRole(role) { selRole = role; checkStart(true); }
  $("startName").addEventListener("input", () => checkStart(false));
  $("startTag").addEventListener("input", (e) => { const c = BL.cleanTag(e.target.value); if (e.target.value !== c) e.target.value = c; checkStart(false); });
  function showStart() {
    revealing = false; selRole = null; // depois de apagar o progresso dá para escolher a função de novo
    $("start").hidden = false; $("reveal").hidden = true;
    $("roles").innerHTML = C.POSITIONS.map((p, i) => `<button type="button" class="role role-art" data-role="${p.id}" aria-pressed="false" title="${esc(p.name + ": " + p.desc)}" style="--ri:${i}"><span class="short">${p.short}</span><h3>${p.name}</h3><p class="note">${p.desc}</p><div class="focus">${p.focus.map((k) => `<span class="chip" style="color:var(--neon)">${C.STAT_LABEL[k]}</span>`).join("")}</div></button>`).join("");
    checkStart(false);
    const lk = stLock(); // v555: função já confirmada antes (F5 ou saiu): volta direto para os 3 sorteados, sem rerolar
    if (lk && lk.role && lk.opts && lk.opts.length) { $("startName").value = lk.name || ""; $("startTag").value = lk.tag || ""; revealStarter(lk.role, lk); }
  }
  // v555 (Mickey): a escolha da função e os 3 sorteados ficam salvos por conta até escolher o inicial
  const stKey = () => "blpi_starter:" + (G.account || "local");
  const stLock = () => { try { return JSON.parse(localStorage.getItem(stKey()) || "null"); } catch (e) { return null; } };
  const stSave = (v) => { try { v ? localStorage.setItem(stKey(), JSON.stringify(v)) : localStorage.removeItem(stKey()); } catch (e) {} };
    // ---------- roleta do jogador inicial (estilo abertura de caixa) ----------
  // Sons gerados na hora com Web Audio: "tic" a cada boneco que passa pelo marcador e uma fanfarra no final.
  let audio = null;
  function sfx() {
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch (e) { audio = null; }
    return audio;
  }
  // som da torcida (quando alguém rouba a bola): ruído filtrado em "formantes" de vozes, subindo e caindo.
  // Volume baixo, no máximo um a cada 1,5 s, e dá para desligar em Configurações.
  let lastCrowd = 0, noiseBuf = null;
  // ---------- áudio configurável (Configurações > Áudio), salvo por conta ----------
  // Volume final de um som = Geral × grupo (Música ou Efeitos) × o próprio canal. Cada linha tem mudo.
  const AUDIO_CH = [
    { id: "master", name: "Volume geral", def: 100 },
    { id: "music", name: "Música de fundo", def: 40, test: "music" },
    { id: "sfx", name: "Efeitos sonoros", def: 100 },
    { id: "goal", name: "Gol", def: 45, group: "sfx", test: "goal" },
    { id: "goalAgainst", name: "Gol sofrido", def: 45, group: "sfx", test: "goalAgainst" },
    { id: "dribble", name: "Drible", def: 38, group: "sfx", test: "dribble" },
    { id: "dribbleEnemy", name: "Drible do adversário", def: 38, group: "sfx", test: "dribbleEnemy" },
    { id: "pass", name: "Passe", def: 45, group: "sfx", test: "pass" },
    { id: "stolen", name: "Roubo de bola", def: 45, group: "sfx", test: "stolen" },
    { id: "shot", name: "Chute", def: 45, group: "sfx", test: "shot" },
    { id: "parry", name: "Espalmada do goleiro", def: 45, group: "sfx", test: "parry" },
    { id: "save", name: "Defesa do goleiro", def: 45, group: "sfx", test: "save" },
    { id: "ui", name: "Roleta e menus", def: 100, group: "sfx", test: "ui" },
  ];
  const audioKey = () => "blpi_audio" + (G.account ? ":" + G.account : "");
  function audioDefaults() {
    const a = {}; AUDIO_CH.forEach((c) => { a[c.id] = { v: c.def, mute: false }; });
    try { if (localStorage.getItem("blpi_sound") === "off") a.sfx.mute = true; if (localStorage.getItem("blpi_music") === "off") a.music.mute = true; } catch (e) {} // botões antigos (v93)
    return a;
  }
  function audioCfg() {
    const a = audioDefaults();
    try { const s = JSON.parse(localStorage.getItem(audioKey()) || "null"); if (s) AUDIO_CH.forEach((c) => { if (s[c.id]) a[c.id] = { v: Math.max(0, Math.min(100, +s[c.id].v || 0)), mute: !!s[c.id].mute }; }); } catch (e) {}
    return a;
  }
  function saveAudio(a) { try { localStorage.setItem(audioKey(), JSON.stringify(a)); } catch (e) {} }
  // volume final (0 a 1) de um canal, já com Geral e grupo
  function vol(id) {
    const a = audioCfg(), ch = AUDIO_CH.find((c) => c.id === id); if (!ch) return 0;
    const part = (k) => (a[k].mute ? 0 : a[k].v / 100);
    return part("master") * (id === "music" || id === "master" || id === "sfx" ? 1 : part(ch.group || "sfx")) * (id === "master" ? 1 : part(id));
  }
  const soundOn = () => vol("sfx") > 0;
  // saída dos sons gerados na hora (roleta, torcida), com o volume do canal "Roleta e menus"
  function uiOut(ac) { const g = ac.createGain(); g.gain.value = vol("ui"); g.connect(ac.destination); return g; }
  function crowd() {
    const ac = audio; if (!ac || ac.state !== "running" || !soundOn() || document.hidden) return;
    const now = ac.currentTime; if (now - lastCrowd < 1.5) return; lastCrowd = now;
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); let last = 0;
      for (let i = 0; i < d.length; i++) { last = 0.97 * last + 0.03 * (Math.random() * 2 - 1); d[i] = last * 6 + (Math.random() * 2 - 1) * 0.15; }
    }
    const dur = 1.6, out = ac.createGain();
    out.gain.setValueAtTime(0.0001, now); out.gain.exponentialRampToValueAtTime(0.12, now + 0.18);
    out.gain.setValueAtTime(0.12, now + 0.55); out.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    out.connect(uiOut(ac));
    [[520, 4], [900, 5], [1500, 6], [2600, 7]].forEach(([f, q], i) => {
      const src = ac.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = q;
      bp.frequency.setValueAtTime(f * 0.8, now); bp.frequency.linearRampToValueAtTime(f * 1.15, now + 0.35); bp.frequency.linearRampToValueAtTime(f, now + dur);
      const g = ac.createGain(); g.gain.value = [1, 0.8, 0.5, 0.25][i];
      src.connect(bp).connect(g).connect(out); src.start(now, Math.random()); src.stop(now + dur + 0.05);
    });
  }
  // som de gol do nosso time (aprovado pelo Mickey: snd/gol.mp3, opção "arcade")
  let goalSnd = null;
  function goalSound() {
    if (!vol("goal") || document.hidden) return;
    try { goalSnd = goalSnd || new Audio("snd/gol.mp3?v=" + BL.BUILD); goalSnd.volume = vol("goal"); goalSnd.currentTime = 0; const p = goalSnd.play(); if (p) p.catch(() => {}); } catch (e) {}
  }
  // som de gol do time inimigo (arquivo enviado pelo Mickey: snd/golsofrido.mp3)
  let goalAgSnd = null;
  function goalAgainstSound() {
    if (!vol("goalAgainst") || document.hidden) return;
    try { goalAgSnd = goalAgSnd || new Audio("snd/golsofrido.mp3?v=" + BL.BUILD); goalAgSnd.volume = vol("goalAgainst"); goalAgSnd.currentTime = 0; const p = goalAgSnd.play(); if (p) p.catch(() => {}); } catch (e) {}
  }
  // som do drible do nosso time (aprovado pelo Mickey: snd/drible.mp3, opção "swoosh"); no máximo um a cada 0,3 s
  let dribSnd = null, lastDrib = 0;
  function dribbleSound() {
    if (!vol("dribble") || document.hidden) return;
    const now = performance.now(); if (now - lastDrib < 300) return; lastDrib = now;
    try { dribSnd = dribSnd || new Audio("snd/drible.mp3?v=" + BL.BUILD); const a = dribSnd.paused ? dribSnd : dribSnd.cloneNode(); a.volume = vol("dribble"); a.currentTime = 0; const p = a.play(); if (p) p.catch(() => {}); } catch (e) {}
  }
  // som do drible do time inimigo (arquivo enviado pelo Mickey: snd/drible-inimigo.mp3); no máximo um a cada 0,3 s
  let dribEnSnd = null, lastDribEn = 0;
  function dribbleEnemySound() {
    if (!vol("dribbleEnemy") || document.hidden) return;
    const now = performance.now(); if (now - lastDribEn < 300) return; lastDribEn = now;
    try { dribEnSnd = dribEnSnd || new Audio("snd/drible-inimigo.mp3?v=" + BL.BUILD); const a = dribEnSnd.paused ? dribEnSnd : dribEnSnd.cloneNode(); a.volume = vol("dribbleEnemy"); a.currentTime = 0; const p = a.play(); if (p) p.catch(() => {}); } catch (e) {}
  }
  // som de passe, dos dois times (opção "bolha" aprovada pelo Mickey para teste: snd/passe.mp3); no máximo um a cada 0,15 s
  let passSnd = null, lastPass = 0;
  function passSound() {
    if (!vol("pass") || document.hidden) return;
    const now = performance.now(); if (now - lastPass < 150) return; lastPass = now;
    try { passSnd = passSnd || new Audio("snd/passe.mp3?v=" + BL.BUILD); const a = passSnd.paused ? passSnd : passSnd.cloneNode(); a.volume = vol("pass"); a.currentTime = 0; const p = a.play(); if (p) p.catch(() => {}); } catch (e) {}
  }
  // som de roubo de bola, para os dois times (arquivo enviado pelo Mickey: snd/roubo.mp3); no máximo um a cada 0,5 s
  let stealSnd = null, lastSteal = 0;
  function stolenSound() {
    if (!vol("stolen") || document.hidden) return;
    const now = performance.now(); if (now - lastSteal < 500) return; lastSteal = now;
    try { stealSnd = stealSnd || new Audio("snd/roubo.mp3?v=" + BL.BUILD); const a = stealSnd.paused ? stealSnd : stealSnd.cloneNode(); a.volume = vol("stolen"); a.currentTime = 0; const p = a.play(); if (p) p.catch(() => {}); } catch (e) {}
  }
  // som de quando qualquer goleiro espalma a bola (arquivo enviado pelo Mickey: snd/espalma.mp3); no máximo um a cada 0,5 s
  let parrySnd = null, lastParry = 0;
  function parrySound() {
    if (!vol("parry") || document.hidden) return;
    const now = performance.now(); if (now - lastParry < 500) return; lastParry = now;
    try { parrySnd = parrySnd || new Audio("snd/espalma.mp3?v=" + BL.BUILD); const a = parrySnd.paused ? parrySnd : parrySnd.cloneNode(); a.volume = vol("parry"); a.currentTime = 0; const p = a.play(); if (p) p.catch(() => {}); } catch (e) {}
  }
  // som de quando qualquer goleiro defende e fica com a bola (arquivo enviado pelo Mickey: snd/defesa.mp3); no máximo um a cada 0,5 s
  let saveSnd = null, lastSave = 0;
  function saveSound() {
    if (!vol("save") || document.hidden) return;
    const now = performance.now(); if (now - lastSave < 500) return; lastSave = now;
    try { saveSnd = saveSnd || new Audio("snd/defesa.mp3?v=" + BL.BUILD); const a = saveSnd.paused ? saveSnd : saveSnd.cloneNode(); a.volume = vol("save"); a.currentTime = 0; const p = a.play(); if (p) p.catch(() => {}); } catch (e) {}
  }
  // v576 (Mickey): som do chute, dos dois times (por enquanto o arquivo do Mickey snd/espalma.mp3, mais agudo); no máximo um a cada 0,3 s
  let shotSnd = null, lastShot = 0;
  function shotSound() {
    if (!vol("shot") || document.hidden) return;
    const now = performance.now(); if (now - lastShot < 300) return; lastShot = now;
    try { shotSnd = shotSnd || new Audio("snd/espalma.mp3?v=" + BL.BUILD); const a = shotSnd.paused ? shotSnd : shotSnd.cloneNode(); a.volume = vol("shot"); a.playbackRate = 1.25; a.currentTime = 0; const p = a.play(); if (p) p.catch(() => {}); } catch (e) {}
  }
  BL.sfx = (kind) => { if (kind === "shot") return shotSound(); if (kind === "crowd") crowd(); else if (kind === "goal") goalSound(); else if (kind === "goalAgainst") goalAgainstSound(); else if (kind === "dribble") dribbleSound(); else if (kind === "dribbleEnemy") dribbleEnemySound(); else if (kind === "stolen") stolenSound(); else if (kind === "pass") passSound(); else if (kind === "parry") parrySound(); else if (kind === "save") saveSound(); };
  // o navegador só libera som depois de um clique: o primeiro clique em qualquer lugar já deixa o áudio pronto
  // música de fundo (arquivo enviado pelo Mickey: snd/musica.mp3), em loop no jogo todo.
  // Começa no primeiro clique (exigência do navegador), pausa com a aba escondida; volume em Configurações > Áudio.
  let bgm = null, bgmReady = false;
  function music() {
    if (!bgmReady) return;
    try {
      const v = vol("music");
      if (v > 0 && !document.hidden) { bgm = bgm || Object.assign(new Audio("snd/musica.mp3?v=" + BL.BUILD), { loop: true }); bgm.volume = v; if (bgm.paused) { const p = bgm.play(); if (p) p.catch(() => {}); } }
      else if (bgm && !bgm.paused) bgm.pause();
    } catch (e) {}
  }
  document.addEventListener("visibilitychange", music);
  // teste de um canal ao soltar o controle
  function testSound(id) {
    if (id === "music") return music();
    if (id === "ui") { sfx(); return fanfare(); }
    ({ goal: () => goalSound(), goalAgainst: () => goalAgainstSound(), dribble: () => { lastDrib = 0; dribbleSound(); }, dribbleEnemy: () => { lastDribEn = 0; dribbleEnemySound(); }, stolen: () => { lastSteal = 0; stolenSound(); }, pass: () => { lastPass = 0; passSound(); }, parry: () => { lastParry = 0; parrySound(); }, save: () => { lastSave = 0; saveSound(); } })[id]();
  }
  let settingsTab = "audio";
  let evUid = null;
  const SETTINGS_TABS = [
    { id: "audio", name: "Áudio", render(el) {
      const a = audioCfg();
      const row = (c) => `<div class="set-row${c.group ? " sub" : ""}"><span class="set-lbl">${c.name}</span><input type="range" min="0" max="100" step="1" value="${a[c.id].v}" data-vol="${c.id}" aria-label="${c.name}"><b class="set-val" id="val_${c.id}">${a[c.id].v}%</b><button type="button" class="btn set-mute" data-mute="${c.id}" aria-pressed="${a[c.id].mute}" title="${a[c.id].mute ? "Ativar" : "Silenciar"}">${a[c.id].mute ? "🔇" : "🔊"}</button></div>`;
      el.innerHTML = `<h3 class="set-h">Áudio</h3><p class="note">Ajuste do seu jeito. Fica salvo na sua conta. Ao soltar o controle, o som toca para você ouvir.</p>
        <div class="set-list">${AUDIO_CH.map(row).join("")}</div>
        <div class="reveal-actions"><button type="button" class="btn" id="audioReset">Restaurar padrão</button></div>`;
      el.querySelectorAll("[data-vol]").forEach((r) => {
        r.oninput = () => { const c = audioCfg(); c[r.dataset.vol].v = +r.value; saveAudio(c); $("val_" + r.dataset.vol).textContent = r.value + "%"; music(); };
        r.onchange = () => { const id = r.dataset.vol, ch = AUDIO_CH.find((c) => c.id === id); if (ch.test) testSound(ch.test); else testSound("goal"); };
      });
      el.querySelectorAll("[data-mute]").forEach((b) => { b.onclick = () => { const c = audioCfg(); c[b.dataset.mute].mute = !c[b.dataset.mute].mute; saveAudio(c); music(); SETTINGS_TABS[0].render(el); }; });
      $("audioReset").onclick = () => { try { localStorage.removeItem("blpi_sound"); localStorage.removeItem("blpi_music"); } catch (e) {} saveAudio(audioDefaults()); music(); SETTINGS_TABS[0].render(el); };
    } },
    { id: "conta", name: "Conta", render(el) {
      el.innerHTML = `<h3 class="set-h">Conta</h3><p class="note">Conta: <b>${esc(G.account || "—")}</b>. O progresso fica salvo só neste navegador: exporte o save para guardar uma cópia ou levar para outro aparelho.</p><div class="reveal-actions"><button type="button" class="btn" id="svExport">Exportar save</button><button type="button" class="btn" id="svImport">Importar save</button><input type="file" id="svFile" accept=".json,.txt,application/json" hidden></div><div class="reveal-actions"><button type="button" class="btn" id="logoutBtn">Sair da conta</button><button type="button" class="btn del-open" id="delOpen">Excluir conta e histórico</button></div><div class="del-box" id="delBox" hidden><h4>Excluir conta e histórico</h4><p class="note">Isso apaga para sempre a conta <b>${esc(G.account || "—")}</b>, o elenco, Gold, itens e o histórico de partidas deste navegador. Para liberar o botão, digite o nome do seu manager: <b>${esc((G.state && G.state.name) || G.account || "")}</b></p><input type="text" id="delName" autocomplete="off" spellcheck="false" placeholder="Nome do manager"><div class="reveal-actions"><button type="button" class="btn" id="delCancel">Cancelar</button><button type="button" class="btn del-go" id="confirmReset" disabled>Confirmar exclusão</button></div></div>`;
      $("logoutBtn").onclick = logout;
      $("svExport").onclick = () => { // v680: cópia do save em arquivo
        G.save(); const txt = JSON.stringify({ blpi: 1, build: BL.BUILD, account: G.account || "", state: G.state });
        try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "application/json" })); a.download = `bl-save-${(G.account || "jogador").replace(/[^a-z0-9_-]/gi, "")}-v${BL.BUILD}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast("Save exportado. Guarde o arquivo."); }
        catch (e) { toast("Não deu para baixar o arquivo neste navegador."); }
      };
      $("svImport").onclick = () => $("svFile").click();
      $("svFile").onchange = (ev) => {
        const f = ev.target.files && ev.target.files[0]; if (!f) return; const rd = new FileReader();
        rd.onload = () => { let d = null; try { d = JSON.parse(rd.result); } catch (e) {} const st = d && d.blpi && d.state;
          if (!st || !Array.isArray(st.roster) || !st.roster.length || !st.progress || !st.account) return toast("Arquivo inválido: não é um save do BL Project Idle.");
          const b = $("svImport"); b.textContent = "Trocar o save atual? Clique de novo"; b.classList.add("del-go");
          b.onclick = () => { G.state = st; G.save(); location.reload(); }; };
        rd.readAsText(f); ev.target.value = "";
      };
      // v553 (Mickey): exclusão só libera digitando o nome do manager certinho
      const want = ((G.state && G.state.name) || G.account || "").trim(), box = $("delBox"), inp = $("delName"), go = $("confirmReset");
      $("delOpen").onclick = () => { box.hidden = false; $("delOpen").hidden = true; inp.value = ""; go.disabled = true; inp.focus(); };
      $("delCancel").onclick = () => { box.hidden = true; $("delOpen").hidden = false; };
      inp.oninput = () => { go.disabled = !want || inp.value.trim() !== want; };
      go.onclick = () => {
        if (go.disabled || inp.value.trim() !== want) return;
        const u = G.account; G.reset(); if (u) A.remove(u); logout();
      };
    } },
  ];
  document.addEventListener("pointerdown", () => { sfx(); bgmReady = true; music(); }, { once: true });
  // v693: áudios enviados pelo Mickey (snd/contrato-roubou.mp3, contrato-rasgado.mp3, bau-abre.mp3), no canal "Roleta e menus"
  const fxSnds = {};
  function fxSnd(name) { if (!soundOn()) return; try { const a = fxSnds[name] || (fxSnds[name] = new Audio("snd/" + name + ".mp3?v=" + BL.BUILD)); a.volume = Math.min(1, vol("ui") * 0.7); a.currentTime = 0; const p = a.play(); if (p) p.catch(() => {}); } catch (e) {} }
  function tick(speed) {
    const ac = audio; if (!ac || !soundOn()) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(1500 + speed * 500, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.04);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(uiOut(ac)); o.start(t); o.stop(t + 0.07);
  }
  function fanfare() {
    const ac = audio; if (!ac || !soundOn()) return;
    const t0 = ac.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      const t = t0 + i * 0.08;
      ["triangle", "sine"].forEach((type, j) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.value = f * (j ? 2 : 1);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(j ? 0.06 : 0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + (i === 4 ? 1.1 : 0.35));
        o.connect(g).connect(uiOut(ac)); o.start(t); o.stop(t + 1.2);
      });
    });
    // brilho final: ruído curto filtrado
    const n = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = n; hp.type = "highpass"; hp.frequency.value = 5000; g.gain.value = 0.08;
    src.connect(hp).connect(g).connect(uiOut(ac)); src.start(t0 + 0.32);
  }

  // v350: escolheu a função → até STARTER_OPTIONS personagens dela, com o sprite parado balançando; o jogador escolhe um (a roleta saiu)
  let revealing = false;
  function revealStarter(role, lk, reroll) {
    if (revealing && !reroll && !lk) return; // clique duplo não abre duas telas
    if (!lk && !startValid()) { checkStart(true); return; }
    revealing = true;
    sfx(); // o clique libera o áudio do navegador
    // v555: sorteia uma vez e salva; F5 ou sair do jogo mostram os mesmos 3 (só o DEV rerola)
    const pool = BL.starterPool(role);
    let opts = lk && !reroll ? lk.opts.map((id) => BL.CHAR_BY_ID[id]).filter(Boolean) : [];
    if (!opts.length) opts = pool.slice().sort(() => Math.random() - 0.5).slice(0, C.STARTER_OPTIONS);
    const name = lk ? lk.name : $("startName").value.trim(), tag = lk ? lk.tag : BL.cleanTag($("startTag").value);
    const spin = !(lk && lk.spun && !reroll);
    stSave({ role, opts: opts.map((c) => c.id), name, tag, spun: !spin });
    const idle = (id) => { const a = C.SPRITES[id]?.anim?.idle; if (a && a.src.includes("#")) return `<img class="spr st-atl" src="${C.SPRITES[id].card}" alt="">`; /* v603: atlas: mostra o card */ return a ? `<i class="st-spr" data-src="${a.src}" data-n="${a.n}" style="background-image:url('${a.src}');--n:${a.n};--d:${(a.n / (a.fps || 4)).toFixed(2)}s"></i>` : `<span class="rl-badge">${esc(BL.CHAR_BY_ID[id].initials)}</span>`; };
    const frame0 = (id) => { const a = C.SPRITES[id]?.anim?.idle; if (a && a.src.includes("#")) return `<img class="spr st-atl st-sil" src="${C.SPRITES[id].card}" alt="">`; return a ? `<i class="st-spr st-sil" style="background-image:url('${a.src}');--n:${a.n}"></i>` : `<span class="rl-badge st-sil">?</span>`; };
    const cards = opts.map((ch, i) => `<button type="button" class="st-card${spin ? " st-spin" : ""}" data-st-pick="${ch.id}" data-i="${i}"><span class="st-face">${idle(ch.id)}<b>${esc(ch.name)}</b><small>${esc(posName(role))}</small></span>${spin ? `<span class="st-reel"><span class="st-strip"></span></span>` : ""}</button>`).join("");
    $("start").hidden = true;
    rouletteLock = false; openModal("Escolha seu jogador inicial", `<div class="st-pick"><p class="st-lead">${spin ? "Sorteando os jogadores da sua função..." : "Escolha quem começa com você. Todo jogador inicial é Comum."}</p><div class="st-row">${cards}</div><div class="reveal-actions">${G.dev ? `<button type="button" class="btn" id="stReroll">🎰 Rerolar (DEV)</button>` : ""}<button type="button" class="btn btn-hot" id="stOk" disabled>Escolha um jogador</button></div></div>`);
    $("modal").classList.add("solid");
    rouletteLock = true; $("modalClose").hidden = true;
    // largura de cada quadro vem do tamanho real da folha (n quadros lado a lado)
    $("modalBody").querySelectorAll(".st-spr").forEach((el) => { const im = new Image(); im.onload = () => { el.style.aspectRatio = `${(im.naturalWidth / +el.dataset.n).toFixed(1)} / ${im.naturalHeight}`; }; im.src = el.dataset.src; });
    // quadros trocados por JS (o CSS de animação some com "reduzir animações", que o Mickey usa)
    const sprs = [...$("modalBody").querySelectorAll(".st-spr")]; let fr = 0;
    const stTimer = setInterval(() => { if (!sprs[0]?.isConnected) return clearInterval(stTimer); fr++; sprs.forEach((el) => { const n = +el.dataset.n; el.style.backgroundPosition = `${((fr % n) / (n - 1)) * 100}% 0`; }); }, 250);
    // v555: jackpot rápido: cada coluna gira silhuetas de todos da função e para em sequência revelando o sorteado
    let spinning = spin;
    if (spin) {
      const cs = [...$("modalBody").querySelectorAll(".st-card.st-spin")], T0 = performance.now(), REP = 14;
      const strips = cs.map((c, i) => { const st = c.querySelector(".st-strip"), seq = []; for (let k = 0; k < REP; k++) seq.push(pool[Math.floor(Math.random() * pool.length)].id); seq.push(c.dataset.stPick); st.innerHTML = seq.map((id) => `<span class="st-cell">${frame0(id)}</span>`).join(""); const h = c.querySelector(".st-reel").clientHeight || 150; st.querySelectorAll(".st-cell").forEach((x) => (x.style.height = h + "px")); return { c, st, h, n: seq.length, dur: 900 + i * 380, done: false, last: -1 }; });
      const ease = (t) => 1 - Math.pow(1 - t, 3);
      const step = (now) => {
        if (!cs[0].isConnected) return;
        let all = true;
        strips.forEach((r) => {
          if (r.done) return;
          const h = r.h, t = Math.min(1, (now - T0) / r.dur), y = ease(t) * (r.n - 1) * h, cell = Math.floor(y / h);
          r.st.style.transform = `translateY(${-y}px)`;
          if (cell !== r.last) { r.last = cell; tick(1 - t); }
          if (t >= 1) { r.done = true; r.c.classList.remove("st-spin"); r.c.classList.add("st-hit"); fanfare(); } else all = false;
        });
        if (all) { spinning = false; const ld = $("modalBody").querySelector(".st-lead"); if (ld) ld.textContent = "Escolha quem começa com você. Todo jogador inicial é Comum."; stSave({ role, opts: opts.map((c) => c.id), name, tag, spun: true }); }
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    if ($("stReroll")) $("stReroll").onclick = () => { rouletteLock = false; revealStarter(role, stLock(), true); };
    let pickId = null;
    $("modalBody").querySelectorAll(".st-card").forEach((b) => b.onclick = () => {
      if (spinning) return;
      pickId = b.dataset.stPick; tick(1);
      $("modalBody").querySelectorAll(".st-card").forEach((x) => x.classList.toggle("on", x === b));
      $("stOk").disabled = false; $("stOk").textContent = `Escolher ${BL.CHAR_BY_ID[pickId].name}`;
    });
    $("stOk").onclick = () => {
      if (!pickId) return;
      const starter = BL.makeStarter(role, pickId);
      G.newGame(name, starter, tag); stSave(null);
      fanfare();
      rouletteLock = false; $("modal").classList.remove("solid"); $("modalClose").hidden = false; closeModal();
      x1Intro(boot); // v594 (Mickey): explica o stack do 1×1 antes da primeira partida
    };
  }
  // v594 (Mickey): pop-up logo depois de escolher o inicial explicando o stack (só no 1×1). Os números vêm do config.
  function x1Intro(done) {
    const S = C.X1.style, cb = (C.X1.combo && C.X1.combo.stack) || 1;
    openModal("Como funciona o 1×1", `<div class="x1i"><p class="st-lead">No 1×1 cada jogada bonita vale <b>stack</b> (★ ao lado do placar). <b>Isso só existe no modo 1×1.</b></p>
      <ul class="x1i-list"><li><b>Drible</b> +${S.drib}</li><li><b>Push</b> (toca na frente e corre) +${S.push}</li><li><b>Drible humilhante</b> (caneta, chapéu, roleta, lambreta) +${S.humilN}</li><li><b>Blade</b> (bola por cima do marcador) +${S.blade}</li><li><b>Combo</b> de truques +${cb}</li></ul>
      <p class="st-lead">Só dá para chutar com <b>${S.shotMin} stacks</b> e perto do gol.${S.maxGoal > 1 ? ` Com ${S.shotMin} a ${Math.max(S.shotMin, S.per * (S.maxGoal - 1) - 1)} stacks o gol vale 1; com <b>${S.per * (S.maxGoal - 1)} ou mais</b> vale <b>${S.maxGoal}</b>.` : " Todo gol vale 1."} Perdeu a bola, o stack do time zera.</p>
      <div class="reveal-actions"><button type="button" class="btn btn-hot" id="x1Go">Entendi, bora jogar!</button></div></div>`);
    $("modal").classList.add("solid"); $("modalClose").hidden = true;
    $("x1Go").onclick = () => { $("modal").classList.remove("solid"); $("modalClose").hidden = false; closeModal(); done(); };
  }

  // ---------- canvas ----------
  const canvas = $("pitch"), ctx = canvas.getContext("2d");
  function fit() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
  }
  window.addEventListener("resize", fit);

  // ---------- tela de jogo ----------
  // Em telas largas o jogo é desenhado num tamanho fixo (DESIGN_W de largura) e ampliado/reduzido por inteiro
  // para caber na janela, centralizado. Assim fica igual com e sem F11, sem vão em cima nem embaixo.
  const DESIGN_W = 1760, FIT_MIN_W = 1281; // v224: 1600 → 1760; sem o mapa de fases embaixo, a largura extra vai toda para o campo
  const app = $("app"), rail = document.querySelector(".rail");
  function fitScreen() {
    const on = innerWidth >= FIT_MIN_W;
    document.documentElement.classList.toggle("fit-screen", on);
    document.documentElement.style.setProperty("--design-w", DESIGN_W + "px");
    if (!on) { app.style.transform = ""; rail.style.transform = ""; rail.style.right = ""; document.documentElement.style.setProperty("--rail-s", 1); railPlace(); return; }
    const h = app.offsetHeight; // altura natural (o transform não muda o layout)
    const s = Math.min(innerWidth / DESIGN_W, innerHeight / h);
    const x = (innerWidth - DESIGN_W * s) / 2, y = Math.max(0, (innerHeight - h * s) / 2);
    app.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    rail.style.right = `${x + 18 * s}px`; // v654: a lateral fica numa coluna própria (padding-right 120 do .app), sem encostar nos painéis
    rail.style.transform = `translateY(-50%) scale(${s})`;
    document.documentElement.style.setProperty("--rail-s", s);
    fit();
  }
  // v307: cadeado nos 3 ícones da lateral (Analyser, Mapa, Espólios). Aberto, o ícone pode ser arrastado para qualquer
  // lugar da tela; a posição fica salva neste navegador (fração da janela) e vale também depois de fechar o cadeado.
  const RAIL_KEY = "blpi_railpos2"; /* v681 (Mickey): chave nova = todos voltam juntos para a lateral */ const RAIL_ORDER = ["mochila", "mapa", "chests", "missoes"];
  let railSt = {};
  try { railSt = JSON.parse(localStorage.getItem(RAIL_KEY) || "{}") || {}; } catch (e) { railSt = {}; }
  const railSave = () => { try { localStorage.setItem(RAIL_KEY, JSON.stringify(railSt)); } catch (e) {} };
  const LOCK_SVG = (open) => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${open ? "M5 7V5a3 3 0 0 1 5.8-1" : "M5 7V5a3 3 0 0 1 6 0v2"}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="3" y="7" width="10" height="7" rx="1.6" fill="currentColor"/></svg>`;
  function railPlace() {
    document.querySelectorAll(".rail-btn[data-float]:not(.rail-dev)").forEach((b) => {
      const k = b.dataset.float, st = railSt[k] || {}, lk = b.querySelector(".rail-lock");
      b.classList.toggle("unlocked", !!st.open);
      if (lk) { lk.innerHTML = LOCK_SVG(!!st.open); lk.title = st.open ? "Travar posição" : "Destravar para mover"; lk.setAttribute("aria-label", lk.title); }
      if (st.x == null) { if (b.parentNode !== rail) { const nx = RAIL_ORDER.slice(RAIL_ORDER.indexOf(k) + 1).map((id) => rail.querySelector(`.rail-btn[data-float="${id}"]`)).find(Boolean) || rail.querySelector(".rail-dev"); rail.insertBefore(b, nx); } /* v681: volta para a vaga certa, Dev sempre por último */ b.classList.remove("rail-free"); b.style.left = b.style.top = ""; return; }
      if (b.parentNode !== document.body) document.body.appendChild(b);
      b.classList.add("rail-free");
      const sc = +getComputedStyle(document.documentElement).getPropertyValue("--rail-s") || 1, w = b.offsetWidth * sc, h = b.offsetHeight * sc;
      b.style.left = Math.max(8, Math.min(innerWidth - w - 8, st.x * innerWidth)) + "px";
      b.style.top = Math.max(10, Math.min(innerHeight - h - 8, st.y * innerHeight)) + "px";
    });
  }
  document.querySelectorAll(".rail-btn[data-float]:not(.rail-dev)").forEach((b) => {
    const lk = document.createElement("span"); lk.className = "rail-lock"; lk.setAttribute("role", "button"); lk.tabIndex = 0; b.appendChild(lk);
    let drag = null, moved = false, dragEnd = 0;
    const toggle = (e) => { e.preventDefault(); e.stopPropagation(); const k = b.dataset.float; railSt[k] = { ...(railSt[k] || {}), open: !(railSt[k] || {}).open }; railSave(); railPlace(); };
    lk.addEventListener("click", toggle, true);
    lk.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") toggle(e); });
    lk.addEventListener("pointerdown", (e) => e.stopPropagation());
    b.addEventListener("pointerdown", (e) => {
      if (!(railSt[b.dataset.float] || {}).open || e.button) return;
      const r = b.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY }; moved = false;
      e.preventDefault();
    });
    window.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (!moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
      moved = true; b.classList.add("dragging");
      const k = b.dataset.float; railSt[k] = { ...(railSt[k] || {}), x: (e.clientX - drag.dx) / innerWidth, y: (e.clientY - drag.dy) / innerHeight };
      railPlace();
    });
    const end = () => { if (!drag) return; drag = null; b.classList.remove("dragging"); if (moved) { railSave(); dragEnd = Date.now(); } moved = false; };
    window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end); // na janela: o ícone muda de pai ao soltar da barra
    b.addEventListener("click", (e) => { if (Date.now() - dragEnd < 300) { dragEnd = 0; e.preventDefault(); e.stopPropagation(); } }, true);
  });
  railPlace();
  window.addEventListener("resize", railPlace);
  window.addEventListener("resize", fitScreen);
  if (window.ResizeObserver) new ResizeObserver(() => fitScreen()).observe(app);
  fitScreen();
  let raf = null, last = 0, uiT = 0, dockT = 0;
  function frame(t) {
    const dt = last ? (t - last) / 1000 : 0; last = t;
    const m = G.match;
    if (m) {
      BL.CAM = (G.state && G.state.settings && G.state.settings.camera) || "inteiro"; // v220: câmera; v222: com o estádio inclinado a câmera é sempre parada e a aba Tela saiu
      m.update(dt);
      m.draw(ctx, canvas.width, canvas.height);
      uiT -= dt;
      if (uiT <= 0) { uiT = 0.25; renderScore(); }
      dockT -= dt;
      if (dockT <= 0) { dockT = 1; renderDock(); renderRail(); refreshFloats(); }
    }
    raf = requestAnimationFrame(frame);
  }
  function startLoop() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = null; clearTimeout(G.nextT); }

  // ---------- eventos do jogo ----------
  G.on("matchStart", (m) => {
    renderHomeName(); renderPrematch();
    $("sbAway").textContent = G.enemy ? G.enemyTeam + (G.enemy.boss ? " · BOSS" : "") : "TREINO";
    $("sbAway").parentElement.classList.toggle("boss", !!G.enemy?.boss);
    $("stealPop").hidden = true; { const x = $("stealCtx"); if (x) x.remove(); }
    renderAll();
    refreshFloats(true);
  });
  // ---------- Wildcard: mini cena animada (5 cenas que se alternam) ----------
  const WC_SCENES = [
    { id: "gym", name: "Academia", act: "Físico" }, { id: "shot", name: "Chutes", act: "Chute" }, { id: "cones", name: "Cones", act: "Velocidade" }, { id: "pass", name: "Passe", act: "Passe" }, { id: "def", name: "Defesa", act: "Defesa" },
  ];
  let wcRaf = 0, wcLast = 0;
  const wcFx = [], wcReps = {}, wcFace = {};
  // v121 · efeitos: estouro de partículas + "+XP" subindo a cada repetição completada
  function wcBurst(x, y, color, label) {
    for (let k = 0; k < 7; k++) { const a = Math.random() * 6.3, v = 30 + Math.random() * 45; wcFx.push({ kind: "p", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 0.55, max: 0.55, c: k % 3 ? color : "#fff" }); }
    wcFx.push({ kind: "ring", x, y, life: 0.35, max: 0.35, c: color });
    if (label) wcFx.push({ kind: "t", x, y: y - 10, vy: -38, life: 0.9, max: 0.9, txt: label, c: color });
  }
  function wcDraw(now) {
    wcRaf = requestAnimationFrame(wcDraw);
    const dt = Math.min(0.05, wcLast ? (now - wcLast) / 1000 : 0); wcLast = now;
    const cv = $("wcCanvas"); if (!cv || !G.state || !cv.offsetParent) return;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = now / 1000, per = C.WILDCARD_SCENE_SECONDS, si = Math.floor(t / per) % WC_SCENES.length, sc = WC_SCENES[si];
    if ($("wcScene").textContent !== sc.name) $("wcScene").textContent = sc.name;
    const ps = G.wcPlayers();
    if (sc.id === "gym") { g.fillStyle = "#1a1f2e"; g.fillRect(0, 0, W, H); g.fillStyle = "#232a3d"; for (let x = 0; x < W; x += 24) g.fillRect(x, 0, 12, H); }
    else { for (let x = 0, k = 0; x < W; x += 22, k++) { g.fillStyle = k % 2 ? "#1f7a3a" : "#238843"; g.fillRect(x, 0, 22, H); } g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.5; g.strokeRect(4, 4, W - 8, H - 8); }
    const bottle = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 5, 10); g.fillStyle = "#fff"; g.fillRect(x + 1, y - 3, 3, 3); };
    const cone = (x, y, hit) => { g.fillStyle = hit ? "#ffd23f" : "#ff7a1a"; g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 5, y + 3); g.lineTo(x - 5, y + 3); g.fill(); g.fillStyle = "#fff"; g.fillRect(x - 3, y - 3, 6, 2); };
    const goal = (x, y, bulge) => { g.strokeStyle = "#fff"; g.lineWidth = 2; g.strokeRect(x, y, 10, 34); g.strokeStyle = `rgba(255,255,255,${0.35 + bulge * 0.5})`; g.lineWidth = 1; for (let k = 4; k < 34; k += 6) { g.beginPath(); g.moveTo(x, y + k); g.quadraticCurveTo(x + 5 + bulge * 8, y + 17, x + 10, y + k); g.stroke(); } };
    const ball = (x, y, trail) => { if (trail) { g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x - trail, y); g.lineTo(x, y); g.stroke(); } g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, 3.5, 0, 6.3); g.fill(); g.fillStyle = "#111"; g.fillRect(x - 1, y - 1, 2, 2); };
    bottle(10, H - 20, "#2fa8ff"); bottle(18, H - 20, "#ff9d1a"); bottle(26, H - 20, "#7dff4a");
    const lerp = (a, b, k) => a + (b - a) * k, tri = (k) => (k < 0.5 ? k * 2 : 2 - k * 2), ease = (k) => k * k * (3 - 2 * k);
    // duração de cada repetição por cena (s): curta para dar ritmo
    const REP = { gym: 0.6, shot: 1.0, cones: 1.3, pass: 0.6, def: 0.8 };
    ps.forEach((p, i) => {
      const lane = ps.length > 1 ? 22 + i * ((H - 44) / (ps.length - 1)) : H / 2;
      const slow = 1 + 0.15 * (ps.length - 1); // v122: mais jogadores = ritmo um pouco mais calmo (só visual)
      const rep = t / (REP[sc.id] * slow) + i * 0.31, k = rep % 1, n = Math.floor(rep), key = p.uid + sc.id;
      const done = wcReps[key] !== undefined && wcReps[key] !== n; wcReps[key] = n;
      let x = W / 2, y = lane;
      if (sc.id === "gym") {
        x = 50 + i * ((W - 80) / Math.max(1, ps.length)); y = H / 2 + Math.sin(k * 6.3) * 7;
        g.fillStyle = "#9aa7c7"; g.fillRect(x - 16, y + 14, 32, 3); g.fillRect(x - 19, y + 10, 4, 11); g.fillRect(x + 15, y + 10, 4, 11);
        g.strokeStyle = "#ffd23f"; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, H / 2, 15, 13 + Math.abs(Math.sin(k * 6.3)) * 6, 0, 0, 6.3); g.stroke();
        if (done) wcBurst(x, y - 12, "#B8FF3D", "+XP");
      } else if (sc.id === "shot") {
        const gy = lane - 17, net = k > 0.85 ? (1 - k) / 0.15 : 0; goal(W - 18, gy, net);
        if (k < 0.5) { x = lerp(36, W - 90, ease(k / 0.5)); ball(x + 8, lane + 2); }
        else { x = W - 90; const f = Math.min(1, (k - 0.5) / 0.3); ball(lerp(W - 82, W - 12, f), lane - Math.sin(f * 3.14) * 10, f < 1 ? 14 : 0); }
        if (done) { wcBurst(W - 14, lane, "#ffd23f", "+XP"); }
      } else if (sc.id === "cones") {
        const dir = n % 2 ? -1 : 1, kk = dir > 0 ? k : 1 - k;
        x = lerp(34, W - 34, kk); y = lane + Math.sin(kk * Math.PI * 8) * 10;
        for (let c = 0; c < 5; c++) { const cx = 50 + c * ((W - 90) / 4); cone(cx, lane, Math.abs(cx - x) < 10); }
        if (done) wcBurst(dir > 0 ? W - 34 : 34, lane, "#26D9FF", "+XP");
      } else if (sc.id === "pass") {
        g.fillStyle = "#c7d3ea"; g.fillRect(W - 22, lane - 14, 6, 28);
        x = 46; const kk = tri(k); ball(lerp(54, W - 26, kk), lane, 10);
        if (k > 0.47 && k < 0.53) { g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(W - 24, lane - 16, 10, 32); }
        if (done) wcBurst(x + 10, lane, "#26D9FF", n % 3 ? "" : "+XP");
      } else {
        const dx = W / 2 + 40; g.fillStyle = "#3b4766"; g.beginPath(); g.arc(dx, lane, 8, 0, 6.3); g.fill(); g.fillRect(dx - 3, lane + 6, 6, 10);
        x = lerp(W / 2 - 30, dx - 14, Math.pow(tri(k), 0.6)); y = lane;
        if (done) wcBurst(dx - 6, lane, "#ff8aa0", "+XP");
      }
      const r = rar(p.rarity);
      g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(x, y + 10, 9, 3, 0, 0, 6.3); g.fill();
      const rad = ps.length > 2 ? 7.5 : 9, im = BL.fieldSprite(p.charId);
      if (im) { // v204 · sprite em pixel art, virado para onde anda; v208: correndo usa a folha de corrida quadro a quadro
        const f = wcFace[p.uid] || (wcFace[p.uid] = { x, d: 1 }), mv = Math.abs(x - f.x) > 0.2; if (mv) f.d = x > f.x ? 1 : -1; f.x = x;
        const sp = C.SPRITES[p.charId], idl = !mv && sp.anim && BL.spriteImg(p.charId, "a:idle"), sh = idl || BL.spriteImg(p.charId, "run"); // v211: parado usa a folha "parado"
        const n = idl ? sp.anim.idle.n : sh ? sp.runFrames : 1, src = sh || im, fw = src.width / n;
        const fi = idl ? Math.floor(t * sp.anim.idle.fps + i) % n : sh ? (mv ? Math.floor(t * C.SPRITE_RUN_FPS + i * 3) % n : sp.idle || 0) : 0;
        const px = ((rad * 3.4) / 52) * (idl ? sp.anim.px : sh ? sp.runPx ?? C.SPRITE_PX : C.SPRITE_PX) / C.SPRITE_PX; // 52 px = altura do desenho do chute; folhas em alta reduzidas na mesma proporção do campo
        const hh = src.height * px, ww = fw * px, bob = sh ? 0 : Math.abs(Math.sin(t * 10 + i)) * 1.5;
        const fxv = (idl ? sp.anim.idle.fx : sh ? sp.runFx : 0) || 0; // v214: pés no lugar do jogador
        g.save(); g.translate(x + f.d * fxv * px, y + rad + 1 - bob); g.scale(f.d, 1); g.imageSmoothingEnabled = !!(idl || (sh && sp.runPx)); g.drawImage(src, fi * fw, 0, fw, src.height, -ww / 2, -hh, ww, hh); g.restore();
      } else {
        g.fillStyle = r.color; g.beginPath(); g.arc(x, y, rad, 0, 6.3); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = "#fff"; g.font = "bold 7px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(p.initials, x, y + 0.5);
      }
    });
    // partículas, anéis e textos
    for (let k = wcFx.length - 1; k >= 0; k--) {
      const f = wcFx[k]; f.life -= dt; if (f.life <= 0) { wcFx.splice(k, 1); continue; }
      const a = f.life / f.max; g.globalAlpha = a * 0.85;
      if (f.kind === "p") { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 140 * dt; g.fillStyle = f.c; g.fillRect(f.x - 1.5, f.y - 1.5, 3, 3); }
      else if (f.kind === "ring") { g.strokeStyle = f.c; g.lineWidth = 2; g.beginPath(); g.arc(f.x, f.y, 3 + (1 - a) * 11, 0, 6.3); g.stroke(); }
      else { f.y += f.vy * dt; g.fillStyle = f.c; g.font = "italic 900 9px sans-serif"; g.textAlign = "center"; g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 3; g.strokeText(f.txt, f.x, f.y); g.fillText(f.txt, f.x, f.y); }
      g.globalAlpha = 1;
    }
    if (wcFx.length > 300) wcFx.splice(0, wcFx.length - 300);
    if (!ps.length) { g.fillStyle = "rgba(5,9,20,.55)"; g.fillRect(0, 0, W, H); g.fillStyle = "#c7d3ea"; g.font = "bold 11px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Ninguém treinando · escolha um jogador abaixo", W / 2, H / 2); }
  }
  function renderWildcard() {
    if (!G.state || !$("wcSlots")) return;
    const w = G.wc(); $("wcSlots").textContent = `${G.wcPlayers().length}/${G.wcUnlocked()} · ${w.slots.length} slots`;
    if (!wcRaf) wcRaf = requestAnimationFrame(wcDraw);
  }
  // v291: Soneca. Turbo do VIP acumula a cada 5 s jogados; a medição de 2 min usa o relógio real e termina indo à página inicial
  setInterval(() => { if (G.state) G.sleepTick(5); }, 5000);
  setInterval(() => {
    if (!slMeas) return;
    if (currentModal !== "Modo Soneca" || !G.state) { slMeas = null; return; }
    const left = Math.max(0, C.SLEEP_MEASURE_SEC - (Date.now() - slMeas.t0) / 1000), mm = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
    if ($("slClock")) { $("slClock").textContent = mm; $("slGo").textContent = `Medindo ${mm}`; $("slBar").style.width = `${(1 - left / C.SLEEP_MEASURE_SEC) * 100}%`; }
    if (left > 0) return;
    slMeas = null; G.sleepStart(); sleepExit();
  }, 250);
  // XP do Wildcard entra a cada 5 s; no primeiro tick depois de abrir o jogo avisa o que rendeu offline
  let wcFirst = true;
  setInterval(() => {
    if (!G.state) { wcFirst = true; return; }
    const r = G.wcTick(); renderWildcard();
    if (wcFirst && r && r.min > 1 && (r.xp || r.items.length)) toast(`Wildcard: +${fmt(r.xp)} XP${r.items.length ? ` e ${r.items.length} item(ns)` : ""} enquanto você estava fora`, "gold");
    wcFirst = false;
    if (currentModal === "Wildcard" && r && r.xp) MODALS.wildcardOld(); if (hub.open && r && r.xp) hubRender();
  }, 5000);
  G.on("wildcard", () => { renderWildcard(); hubRender(); });
  // ---------- v513 (Mickey): HUB do Wildcard, uma instância própria com a arte gerada (img/wildcard/) ----------
  // v519 (Mickey): tudo animado e espaçado: cada área abre numa cena própria; o jogador vai de esteira até a cápsula, respira lá dentro e o XP sobe ao vivo
  const hub = { open: false, area: null, plot: null, timer: null, busy: false, sig: "", lv: {}, stages: [], flash: null, fresh: null, bump: null, tick: 0 };
  const WI = (n) => `img/wildcard/${n}.png`;
  const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  const WS = (n) => BL.WC_SPR[n] != null ? `src="${BLANK}" style="${BL.wcSprite(n)}"` : C.CONSUMABLES[n] ? `src="img/loja/${n}.png?v=${BL.BUILD}" style="object-fit:contain"` : `src="${WI(n)}"`; // v530: bebidas // v525: sub-itens e contratos vêm da folha img/wildcard/atlas.png
  const HUB_ARTCAP = [[15, 33], [23.5, 31], [31.5, 30], [38.5, 27]]; // v662: arte nova // vidro das 4 cápsulas na arte do HUB (% da imagem), para o +XP
  const HUB_TITLE = { caps: "CÁPSULAS", farm: "FAZENDA", bench: "BANCADA" };
  function hubLeft(ms) { if (ms < 60000) return `${Math.ceil(ms / 1000)} s`; const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}min` : `${m} min`; }
  function hubStage(i) { const p = G.farm().plots[i]; if (!p) return 0; const tot = p.ready - p.at, k = tot > 0 ? 1 - Math.max(0, p.ready - Date.now()) / tot : 1; return k >= 1 ? 3 : k >= 0.5 ? 2 : 1; }
  const hubWait = (ms) => new Promise((r) => setTimeout(r, ms));
  const hubFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  function hubRect(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom }; }
  const hubFig = (p) => spr(p.charId) || tok(p.charId, p.initials, rar(p.rarity).color);
  // ícone que voa de a até b (colheita, insumos indo para a bancada)
  function hubFly(src, a, b, delay = 0, size = 44) {
    const el = document.createElement("img"); el.className = "wch-fly"; if (BL.WC_SPR[src] != null) { el.src = BLANK; el.style.cssText = BL.wcSprite(src); } else el.src = src; // v525: chave da folha do Wildcard el.style.width = el.style.height = size + "px"; $("wchFx").appendChild(el);
    const h = size / 2, mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - 90;
    return el.animate([{ transform: `translate(${a.x - h}px,${a.y - h}px) scale(.5)`, opacity: 0 }, { transform: `translate(${mx - h}px,${my - h}px) scale(1.15)`, opacity: 1, offset: 0.45 }, { transform: `translate(${b.x - h}px,${b.y - h}px) scale(.45)`, opacity: 0.9 }],
      { duration: 760, delay, easing: "ease-in-out", fill: "both" }).finished.then(() => el.remove());
  }
  // texto que sobe e some (+XP, +3, NÍVEL UP!)
  function hubPop(at, text, cls = "") {
    const fx = $("wchFx"); if (!fx || !at) return; const r = at.getBoundingClientRect ? hubRect(at) : { x: at.x, t: at.y };
    const el = document.createElement("b"); el.className = `wch-pop ${cls}`; el.textContent = text; el.style.left = r.x + "px"; el.style.top = r.t + "px"; fx.appendChild(el); setTimeout(() => el.remove(), 1700);
  }
  const HUB_POD = [[16.2, 45], [25.2, 42.8], [33, 41.7], [40.6, 38.7]]; // v662: centro do vidro de cada cápsula na arte (% da imagem)
  const HUB_SIL = `<svg class="wch-sil" viewBox="0 0 60 100" aria-hidden="true"><ellipse cx="30" cy="15" rx="9.5" ry="11"/><path d="M26 25 h8 v4 C44 30 50 33 51 40 L53 62 C53.5 66 49 67 48 63 L46 46 L45 58 C45 62 44 64 43 66 L42 95 C42 98 35 98 35 95 L32 68 h-4 L25 95 C25 98 18 98 18 95 L17 66 C16 64 15 62 15 58 L14 46 L12 63 C11 67 6.5 66 7 62 L9 40 C10 33 16 30 26 29 Z"/></svg>`;
  const HUB_LOCK = `<svg class="wch-lk" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="4.5" y="10" width="15" height="11" rx="2.5" fill="currentColor"/><circle cx="12" cy="15" r="1.7" fill="#0a1830"/></svg>`;
  function openHub() {
    if (rouletteLock) return; if (!$("modal").hidden) closeModal();
    let el = $("wcHub");
    if (!el) {
      el = document.createElement("div"); el.id = "wcHub"; el.className = "wch"; el.hidden = true;
      const steam = [[12.9, 26], [21.2, 23.8], [29.3, 22.1], [37.4, 20.4]] /* v662: arte nova */.map(([x, y], i) => `<i class="wch-steam" style="left:${x}%;top:${y}%;animation-delay:${-i * 0.9}s"></i><i class="wch-steam" style="left:${x + 0.8}%;top:${y}%;animation-delay:${-i * 0.9 - 1.6}s"></i>`).join("");
      const spark = [[72, 22], [80, 20], [88, 24], [71, 31], [87, 31], [78, 35], [93, 28]] /* v662 */.map(([x, y], i) => `<i class="wch-spark" style="left:${x}%;top:${y}%;animation-delay:${-i * 0.55}s"></i>`).join("");
      el.innerHTML = `<div class="wch-top"><button type="button" class="wch-back" id="wchBack" data-hub="back">← Voltar ao jogo</button><h2 id="wchTitle">WILDCARD</h2><span class="wch-gold" id="wchGold"></span></div>
        <div class="wch-stage"><div class="wch-art" id="wchArt"><img class="wch-bg" src="img/wildcard/hub.jpg?v=${BL.BUILD}" alt="Wildcard" draggable="false"><div class="wch-pods">${HUB_POD.map(([x, y], i) => `<i class="wch-pod" id="wchPod${i}" style="left:${x}%;top:${y}%">${HUB_SIL}${HUB_LOCK}</i>`).join("")}</div>
          <div class="wch-amb">${steam}<i class="wch-holo"></i><i class="wch-lamp"></i>${spark}</div>
          <button type="button" class="wch-hot h-caps" data-hub="caps"><span>CÁPSULAS</span></button><button type="button" class="wch-hot h-farm" data-hub="farm"><span>FAZENDA</span></button><button type="button" class="wch-hot h-bench" data-hub="bench"><span>BANCADA</span></button></div>
          <div class="wch-nav"><button type="button" data-hub="caps"><img src="${WI("cap-vazia")}" alt=""><b>Cápsulas</b></button><button type="button" data-hub="farm"><img src="${WI("canteiro-3")}" alt=""><b>Fazenda</b></button><button type="button" data-hub="bench"><img src="${WI("pr-elite")}" alt=""><b>Bancada</b></button></div>
          <div class="wcs" id="wchScene" hidden></div></div><div class="wch-fx" id="wchFx"></div>`;
      document.body.appendChild(el);
      el.addEventListener("click", hubClick);
    }
    if (!hub.pre) hub.pre = ["cap-vazia", "cap-bloq", "canteiro-0", "canteiro-1", "canteiro-2", "canteiro-3"].map((n) => Object.assign(new Image(), { src: WI(n) })); // pré-carrega, sem piscar ao redesenhar
    hub.open = true; hub.area = null; hub.plot = null; hub.busy = false; el.hidden = false; G.wcTick(); hubRender(true);
    if (!hub.timer) hub.timer = setInterval(hubTick, 250);
  }
  function closeHub() { hub.open = false; hub.area = null; hub.plot = null; hub.busy = false; clearInterval(hub.timer); hub.timer = null; const el = $("wcHub"); if (el) el.hidden = true; if ($("wchFx")) $("wchFx").innerHTML = ""; renderTop(); }
  function hubTick() { if (!hub.open) return; hub.tick++; hubUpdate(); if (hub.tick % 4 === 0) hubRender(); if (hub.tick % 5 === 0) hubAmbient(); }
  function hubGo(area) { hub.area = area; hub.plot = null; hub.enter = true; hubRender(true); hub.enter = false; if (area) $("wchScene").scrollTop = 0; }
  // assinatura do que a cena mostra: muda → redesenha; igual → só atualiza tempos e barras (hubUpdate)
  function hubSig() {
    if (hub.area === "caps") { const w = G.wc(); return "c" + JSON.stringify([w.slots, G.wcUnlocked(), G.wcEligible().map((p) => p.uid)]); }
    if (hub.area === "farm") { const f = G.farm(); return "f" + JSON.stringify([f.plots.map((p, i) => (p ? p.crop + hubStage(i) : 0)), G.farmUnlocked(), f.bag, hub.plot, hub.plot != null ? Math.floor(G.state.gold) : 0]); }
    return "b" + JSON.stringify([G.farm().bag, G.cons()]);
  }
  function hubPods() { const w = G.wc(), un = G.wcUnlocked(); HUB_POD.forEach((_, i) => { const p = $("wchPod" + i); if (p) { p.classList.toggle("on", i < un && !!w.slots[i]); p.classList.toggle("lock", i >= un); } }); } // v662 (Mickey): cápsula vazia; ocupada = só a sombra de alguém dentro
  function hubRender(force) {
    const el = $("wcHub"); if (!el || !hub.open || !G.state) return;
    hubPods();
    if (hub.busy && force !== true) return; // animação em curso: redesenha no fim dela
    $("wchGold").innerHTML = `<i class="ic-coin"></i> ${fmt(G.state.gold)}`;
    $("wchTitle").textContent = hub.area ? HUB_TITLE[hub.area] : "WILDCARD";
    $("wchBack").textContent = hub.area ? "← Voltar ao HUB" : "← Voltar ao jogo";
    const art = $("wchArt"); art.classList.toggle("in-area", !!hub.area); art.dataset.area = hub.area || "";
    const S = $("wchScene"); S.hidden = !hub.area;
    if (!hub.area) { hub.sig = ""; S.innerHTML = ""; return; }
    const sig = hubSig(); if (force !== true && sig === hub.sig) return hubUpdate();
    hub.sig = sig; S.className = `wcs is-${hub.area}${hub.enter ? " enter" : ""}`; // is-*: .bench já existe no CSS do time
    S.innerHTML = hub.area === "caps" ? hubCapsHtml() : hub.area === "farm" ? hubFarmHtml() : hubBenchHtml();
    hub.flash = hub.fresh = hub.bump = null;
    hubUpdate();
  }
  function hubCapsHtml() {
    const w = G.wc(), un = G.wcUnlocked(), n = G.wcPlayers().length, free = w.slots.some((u, i) => i < un && !u), per = G.wcRate(n);
    const bay = (u, i) => {
      const p = u && G.player(u), lock = i >= un;
      const inside = p ? `<div class="wcs-gbox${hub.flash === i ? " arrive" : ""}"><i class="wcs-aura"></i><div class="wcs-body">${hubFig(p)}</div><i class="wcs-bub b1"></i><i class="wcs-bub b2"></i><i class="wcs-bub b3"></i><i class="wcs-bub b4"></i><i class="wcs-sym s1">⚡</i><i class="wcs-sym s2">⚽</i><i class="wcs-sheen"></i></div>` : lock ? "" : `<div class="wcs-gbox"></div>`;
      return `<div class="wcs-bay ${lock ? "locked" : p ? "on" : "empty"}" data-bay="${i}"><div class="wcs-capw"><img class="wcs-cap" src="${WI(lock ? "cap-bloq" : "cap-vazia")}" alt="" draggable="false">${inside}<i class="wcs-door"></i>${p ? `<i class="wcs-scr"></i>` : ""}</div></div>`;
    };
    const info = (u, i) => {
      const p = u && G.player(u);
      if (i >= un) return `<div class="wcs-info locked" data-info="${i}"><b>Bloqueada</b><small>💎 Libera com Diamantes</small></div>`;
      if (!p) return `<div class="wcs-info" data-info="${i}"><b>Livre</b><small>Escolha alguém abaixo</small></div>`;
      const r = rar(p.rarity), max = p.level >= C.PLAYER_MAX_LEVEL;
      return `<div class="wcs-info on" data-info="${i}"><b style="color:${r.color}">${esc(p.short || p.name)}</b><small><span data-hub-lv>Nv ${p.level}</span> · ${posName(p.position)}</small>
        <span class="wcs-xp${max ? " max" : ""}" data-hub-xp="${p.uid}"><i></i></span><small class="wcs-xpt" data-hub-xpt>${max ? "Nível máximo" : ""}</small><em>+${String(Math.round(per * 10) / 10).replace(".", ",")} XP/min</em><button type="button" class="btn" data-hub-del="${i}">Tirar</button></div>`;
    };
    const elig = G.wcEligible();
    const cards = elig.length ? elig.map((p) => { const r = rar(p.rarity); return `<div class="wcs-card" style="--rc:${r.color}"><div class="wcs-cfig">${hubFig(p)}</div><b style="color:${r.color}">${esc(p.short || p.name)}</b><small>${r.name} · Nv ${p.level}</small><small>${posName(p.position)}</small><button type="button" class="btn ${free ? "btn-hot" : ""}" data-hub-add="${p.uid}" ${free ? "" : "disabled"}>Entrar</button></div>`; }).join("")
      : `<p class="note">Ninguém disponível. Só entra na cápsula quem não está escalado.</p>`;
    return `<div class="wcs-wrap"><div class="wcs-head"><div><h3>Cápsulas de treino mental</h3><p>Quem está fora da escalação treina aqui e sobe de nível, também com o jogo fechado.</p></div>
      <div class="wcs-rate"><b>${C.WILDCARD_XP_PER_MIN} XP/min</b><small>divididos entre quem treina${n ? ` (${String(Math.round(1000 / n) / 10).replace(".", ",")}% cada)` : ""}</small></div></div>
      <div class="wcs-lab">${w.slots.map(bay).join("")}<div class="wcs-belt" id="wcsBelt"><i class="wcs-gate l"></i><div class="wcs-track"></div><i class="wcs-gate r"></i></div>${w.slots.map(info).join("")}</div>
      <div class="wcs-sub"><h4>Fora da escalação</h4><small>${free ? "Toque em Entrar: a esteira leva o jogador até a cápsula livre." : "Todas as cápsulas liberadas estão ocupadas."}</small></div><div class="wcs-roster">${cards}</div></div>`;
  }
  function hubFarmHtml() {
    const F = C.WC_FARM, f = G.farm(), un = G.farmUnlocked(), bag = f.bag, prev = hub.stages;
    const bagH = Object.entries(F.crops).filter(([k]) => bag[k] > 0 || hub.bump === k).map(([k, c]) => `<div class="wcs-bagi${hub.bump === k ? " bump" : ""}" data-bag="${k}"><img ${WS(k)} alt=""><span><b>${fmt(bag[k] || 0)}</b><small>${esc(c.name)}</small></span></div>`).join("");
    hub.stages = f.plots.map((_, i) => hubStage(i));
    const plot = (p, i) => {
      const fr = hub.fresh && hub.fresh.i === i ? ` ${hub.fresh.k}` : "";
      if (i >= un) return `<div class="wcs-plot locked${fr}" data-plot="${i}"><div class="wcs-soil"><img class="wcs-ct" src="${WI("canteiro-0")}" alt=""><span class="wcs-lock">🔒</span></div>${i === un ? `<b>Liberar canteiro</b><button type="button" class="btn" data-hub-unlock="${i}"><i class="ic-coin"></i> ${fmt(F.plotGold[i])}</button>` : "<b>Bloqueado</b><small>Libere o anterior</small>"}</div>`;
      if (!p) return `<button type="button" class="wcs-plot empty${fr}" data-hub-plot="${i}" data-plot="${i}"><div class="wcs-soil"><img class="wcs-ct" src="${WI("canteiro-0")}" alt=""><span class="wcs-plus">+</span></div><b>Plantar</b><small>Canteiro ${i + 1}</small></button>`;
      const c = F.crops[p.crop], st = hub.stages[i], ready = st === 3, grow = prev[i] && st > prev[i] ? " grow" : "", tag = ready ? "button" : "div", fruit = ready && p.crop !== "ego"; // pronto: o insumo nasce na planta (o cristal do canteiro 3 só no Fragmento de Ego)
      return `<${tag}${ready ? ` type="button" data-hub-harvest="${i}"` : ""} class="wcs-plot st${st}${ready ? " ready" : ""}${grow}${fr}" data-plot="${i}"><div class="wcs-soil">${fr === " plant" ? `<img class="wcs-seedfall" ${WS(p.crop)} alt="">` : ""}<img class="wcs-ct wcs-grow" src="${WI("canteiro-" + (fruit ? 2 : st))}" alt="">${fruit ? `<img class="wcs-fruit" ${WS(p.crop)} alt="">` : ready ? "" : `<img class="wcs-badge" ${WS(p.crop)} alt="">`}${ready ? `<i class="wcs-spk a"></i><i class="wcs-spk b"></i><i class="wcs-spk c"></i>` : ""}</div>
        <b>${esc(c.name)}</b>${ready ? `<span class="wcs-harv">Colher!</span>` : `<span class="wcs-prog"><i data-hub-p="${i}"></i></span><small data-hub-t="${i}">${hubLeft(G.farmLeft(i))}</small>`}</${tag}>`;
    };
    const pick = hub.plot != null && !f.plots[hub.plot] && hub.plot < un ? `<div class="wcs-pick"><div class="wcs-pbox"><h4>O que plantar no canteiro ${hub.plot + 1}?</h4><div class="wcs-seeds">${Object.entries(F.crops).map(([k, c]) => { const can = G.dev || G.state.gold >= c.seed;
      return `<button type="button" class="wcs-seed" data-hub-plant="${k}" ${can ? "" : "disabled"}><img ${WS(k)} alt=""><b>${esc(c.name)}</b><small>${C.WC_TIER[c.rarity].name} · ${hubLeft(c.min * 60000)} · rende ${c.yield[0] === c.yield[1] ? c.yield[0] : `${c.yield[0]}–${c.yield[1]}`}</small><span><i class="ic-coin"></i> ${fmt(c.seed)}</span></button>`; }).join("")}</div><button type="button" class="btn" data-hub-pickx="1">Cancelar</button></div></div>` : "";
    return `<div class="wcs-wrap"><div class="wcs-head"><div><h3>Fazenda de sub-itens</h3><p>Plante, espere crescer e colha os sub-itens dos contratos. Quanto mais raro, mais demora. O tempo conta com o jogo fechado.</p></div></div>
      <div class="wcs-bag">${bagH || `<p class="wcs-none">Nenhum sub-item colhido ainda.</p>`}</div><div class="wcs-plots">${f.plots.map(plot).join("")}</div></div>${pick}`;
  }
  function hubBenchHtml() {
    const bag = G.farm().bag, cons = G.cons(), bagH = Object.entries(C.WC_FARM.crops).filter(([k]) => bag[k] > 0).map(([k, c]) => `<div class="wcs-bagi"><img ${WS(k)} alt=""><span><b>${fmt(bag[k] || 0)}</b><small>${esc(c.name)}</small></span></div>`).join("");
    const sts = Object.entries(C.WC_RECIPES).map(([id, r]) => { const q = C.SUPPLIES[id] || C.CONSUMABLES[id], ok = G.dev || G.canCraft(id);
      return `<div class="wcs-st${ok ? " can" : ""}${hub.fresh && hub.fresh.k === id ? " made" : ""}" data-st="${id}"><div class="wcs-stimg"><i class="wcs-ring"></i><img ${WS(id)} alt=""></div><b>${esc(q.name)}</b><small>${esc(q.desc)}</small>
        <div class="wcs-ing">${Object.entries(r).map(([k, n]) => `<span class="wcs-chip ${(bag[k] || 0) >= n ? "ok" : "no"}" data-ing="${k}" title="${esc(C.WC_FARM.crops[k].name)}"><img ${WS(k)} alt="">${fmt(bag[k] || 0)}/${n}</span>`).join("")}</div>
        <em class="${hub.bump === id ? "bump" : ""}">Na Mochila: <b>${fmt(cons[id] || 0)}</b></em><button type="button" class="btn ${ok ? "btn-hot" : ""}" data-hub-craft="${id}" ${ok ? "" : "disabled"}>Criar</button></div>`; }).join("");
    return `<div class="wcs-wrap"><div class="wcs-head"><div><h3>Bancada de contratos</h3><p>Monte contratos e bebidas de energia com os sub-itens da Fazenda. Tudo vai para a Mochila; equipe o contrato lá para roubar.</p></div></div><div class="wcs-bag">${bagH || `<p class="wcs-none">Nenhum sub-item ainda: plante na Fazenda.</p>`}</div><div class="wcs-sts">${sts}</div></div>`;
  }
  // a cada 250 ms: tempos, barras de crescimento e o XP de quem está na cápsula subindo ao vivo
  function hubUpdate() {
    const S = $("wchScene"); if (!S || S.hidden || !G.state) return;
    S.querySelectorAll("[data-hub-t]").forEach((x) => { x.textContent = hubLeft(G.farmLeft(+x.dataset.hubT)); });
    S.querySelectorAll("[data-hub-p]").forEach((x) => { const p = G.farm().plots[+x.dataset.hubP]; if (p) x.style.width = `${Math.min(100, (1 - G.farmLeft(+x.dataset.hubP) / Math.max(1, p.ready - p.at)) * 100)}%`; });
    if (hub.area !== "caps") return;
    const w = G.wc(), rate = G.wcRate(G.wcPlayers().length) / 60000, dt = Math.max(0, Date.now() - (w.last || Date.now()));
    S.querySelectorAll("[data-hub-xp]").forEach((x) => {
      const p = G.player(x.dataset.hubXp); if (!p) return; const box = x.parentNode;
      if (hub.lv[p.uid] != null && p.level > hub.lv[p.uid]) { hubPop(box, "NÍVEL UP!", "lv"); box.classList.remove("up"); void box.offsetWidth; box.classList.add("up"); }
      hub.lv[p.uid] = p.level; box.querySelector("[data-hub-lv]").textContent = `Nv ${p.level}`;
      if (p.level >= C.PLAYER_MAX_LEVEL) return;
      const need = C.playerXpToNext(p.level), v = Math.min(need, p.xp + (w.acc[p.uid] || 0) + dt * rate);
      x.firstChild.style.width = `${(v / need) * 100}%`;
      box.querySelector("[data-hub-xpt]").textContent = `${fmt(Math.floor(v))},${Math.floor((v % 1) * 10)} / ${fmt(need)} XP`;
    });
  }
  // +XP saindo das cápsulas ocupadas (na arte do HUB e na cena das Cápsulas)
  function hubAmbient() {
    if (hub.busy || (hub.area && hub.area !== "caps")) return;
    const w = G.wc(), un = G.wcUnlocked(), occ = w.slots.map((u, i) => (u && i < un ? i : -1)).filter((i) => i >= 0); if (!occ.length) return;
    const i = occ[Math.floor(Math.random() * occ.length)], j = (Math.random() - 0.5) * 30;
    if (!hub.area) { const a = $("wchArt").getBoundingClientRect(), [X, Y] = HUB_ARTCAP[i]; return hubPop({ x: a.left + (a.width * X) / 100 + j, y: a.top + (a.height * Y) / 100 }, "+XP", "xp"); }
    const g = $("wchScene").querySelector(`[data-bay="${i}"] .wcs-gbox`); if (g) { const r = hubRect(g); hubPop({ x: r.x + j, y: r.t + 6 }, "+XP", "xp"); }
  }
  // figura do jogador para as animações (fica na camada #wchFx, por cima de tudo)
  function hubRider(p, fh) { const el = document.createElement("div"); el.className = "wch-rider"; el.style.setProperty("--fh", fh + "px"); el.style.transform = "translate(-999px,-999px)"; el.innerHTML = `<b class="wch-tag">${esc(p.short || p.name)}</b><div class="wch-rfig">${hubFig(p)}</div><i class="wch-rsh"></i>`; $("wchFx").appendChild(el); return el; }
  const hubMove = (el, a, b, ms, easing = "ease-in-out") => el.animate([{ transform: a }, { transform: b }], { duration: ms, easing, fill: "forwards" }).finished;
  const hubT = (x, y, r = 0, s = 1) => `translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`;
  // esteira → para na frente da cápsula livre → sobe e deita lá dentro
  async function hubEnter(uid, card) {
    const w = G.wc(), un = G.wcUnlocked(), i = w.slots.findIndex((u, k) => k < un && !u), p = G.player(uid), S = $("wchScene");
    if (i < 0 || !p) return toast("Todas as cápsulas liberadas estão ocupadas.");
    const bay = S.querySelector(`[data-bay="${i}"]`), belt = $("wcsBelt"), gb = bay && bay.querySelector(".wcs-gbox");
    if (!bay || !belt || !gb) { G.wcAdd(uid); return; }
    hub.busy = true; if (card) card.classList.add("picked");
    const info = S.querySelector(`[data-info="${i}"]`); if (info) info.innerHTML = `<b class="wcs-arr">Chegando…</b><small>${esc(p.short || p.name)}</small>`;
    const B = hubRect(belt), X = hubRect(bay.querySelector(".wcs-capw")), Gb = hubRect(gb), fh = Math.round(Math.max(44, X.h * 0.45)), sc = (gb.offsetHeight * 0.66) / fh;
    const y0 = B.t + B.h * 0.42 - (fh + 20) / 2, x0 = B.l + B.h * 0.8, x1 = X.x;
    const rd = hubRider(p, fh), cf = card && card.querySelector(".wcs-cfig"); await hubFrame();
    if (cf) { const F = hubRect(cf), s0 = F.h / fh, ys = F.b - ((fh + 20) * s0) / 2; // pula da ficha para o começo da esteira
      await rd.animate([{ transform: hubT(F.x, ys, 0, s0), opacity: 0.4 }, { transform: hubT((F.x + x0) / 2, Math.min(ys, y0) - 110, -8, (s0 + 1) / 2), opacity: 1, offset: 0.5 }, { transform: hubT(x0, y0 + 4), offset: 0.88 }, { transform: hubT(x0, y0) }], { duration: 800, easing: "ease-in-out", fill: "forwards" }).finished;
    } else await rd.animate([{ transform: hubT(x0 - 46, y0), opacity: 0 }, { transform: hubT(x0, y0), opacity: 1 }], { duration: 380, easing: "ease-out", fill: "forwards" }).finished;
    belt.classList.add("run");
    await hubMove(rd, hubT(x0, y0), hubT(x1, y0), Math.max(1000, (x1 - x0) / 0.26), "linear");
    belt.classList.remove("run");
    await rd.animate([{ transform: hubT(x1, y0) }, { transform: hubT(x1 + 5, y0, 5) }, { transform: hubT(x1, y0) }], { duration: 280, fill: "forwards" }).finished; // tranco da esteira parando
    bay.classList.add("open"); await hubWait(320);
    rd.classList.add("rise");
    await rd.animate([{ transform: hubT(x1, y0) }, { transform: hubT((x1 + Gb.x) / 2, Math.min(y0, Gb.y) - 34, -12, (1 + sc) / 2), offset: 0.5 }, { transform: hubT(Gb.x, Gb.y + 4, -34, sc) }], { duration: 950, easing: "ease-in-out", fill: "forwards" }).finished;
    const ok = G.wcAdd(uid); hub.flash = i; hub.busy = false; hubRender(true); await hubFrame();
    rd.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: "forwards" }).finished.then(() => rd.remove());
    if (!ok) toast("Não deu para entrar na cápsula."); else hubPop(S.querySelector(`[data-bay="${i}"] .wcs-capw`), "Treinando!", "lv");
  }
  // sai da cápsula, desce para a esteira e vai embora pela porta da direita
  async function hubLeave(i) {
    const S = $("wchScene"), bay = S.querySelector(`[data-bay="${i}"]`), belt = $("wcsBelt"), gb = bay && bay.querySelector(".wcs-gbox"), p = G.player(G.wc().slots[i]);
    if (!bay || !belt || !gb || !p) return G.wcRemove(i);
    hub.busy = true;
    const B = hubRect(belt), X = hubRect(bay.querySelector(".wcs-capw")), Gb = hubRect(gb), fh = Math.round(Math.max(44, X.h * 0.45)), sc = (gb.offsetHeight * 0.66) / fh;
    const y0 = B.t + B.h * 0.42 - (fh + 20) / 2, x1 = X.x, toL = x1 - B.l < B.r - x1, x2 = toL ? B.l + B.h * 0.8 : B.r - B.h * 0.8, sp = 0.4; // sai pela porta mais perto
    const info = S.querySelector(`[data-info="${i}"]`); if (info) info.innerHTML = `<b class="wcs-arr">Saindo…</b><small>${esc(p.short || p.name)}</small>`;
    bay.classList.add("open"); const rd = hubRider(p, fh); rd.classList.add("rise"); rd.style.transform = hubT(Gb.x, Gb.y + 4, -34, sc); await hubFrame();
    gb.classList.add("out"); await hubWait(250);
    await rd.animate([{ transform: hubT(Gb.x, Gb.y + 4, -34, sc) }, { transform: hubT((x1 + Gb.x) / 2, Math.min(y0, Gb.y) - 34, -12, (1 + sc) / 2), offset: 0.5 }, { transform: hubT(x1, y0) }], { duration: 850, easing: "ease-in-out", fill: "forwards" }).finished;
    rd.classList.remove("rise"); bay.classList.remove("open"); belt.classList.toggle("rev", toL); belt.style.setProperty("--bs", `${26 / sp}ms`); belt.classList.add("run");
    await hubMove(rd, hubT(x1, y0), hubT(x2, y0), Math.max(700, Math.abs(x2 - x1) / sp), "linear");
    await rd.animate([{ transform: hubT(x2, y0), opacity: 1 }, { transform: hubT(x2 + (toL ? -46 : 46), y0), opacity: 0 }], { duration: 380, fill: "forwards" }).finished;
    belt.classList.remove("run", "rev"); belt.style.removeProperty("--bs"); rd.remove();
    hub.busy = false; G.wcRemove(i);
  }
  async function hubPlant(i, crop) {
    hub.busy = true; const r = G.farmPlant(i, crop); hub.plot = null; hub.busy = false;
    if (!r.ok) { toast(r.msg); return hubRender(true); }
    renderTop(); hub.fresh = { i, k: "plant" }; hubRender(true);
  }
  async function hubHarvest(i) {
    const S = $("wchScene"), el = S.querySelector(`[data-plot="${i}"]`); if (!el) return;
    hub.busy = true; const r = G.farmHarvest(i);
    if (!r.ok) { hub.busy = false; toast(r.msg); return hubRender(true); }
    el.classList.add("picked");
    const a = hubRect(el.querySelector(".wcs-soil")), chip = S.querySelector(`[data-bag="${r.crop}"]`), b = chip ? hubRect(chip.querySelector("img")) : a;
    await Promise.all(Array.from({ length: Math.min(r.n, 6) }, (_, k) => hubFly(r.crop, { x: a.x + (k - 2) * 14, y: a.y - 10 }, b, k * 120, 48)));
    hub.bump = r.crop; hub.fresh = { i, k: "dug" }; hub.busy = false; hubRender(true);
    hubPop(S.querySelector(`[data-bag="${r.crop}"]`), `+${r.n}`, "gold");
  }
  async function hubUnlock(i) {
    hub.busy = true; const r = G.farmUnlock();
    if (!r.ok) { hub.busy = false; toast(r.msg); return hubRender(true); }
    renderTop(); const el = $("wchScene").querySelector(`[data-plot="${i}"]`); if (el) { el.classList.add("unlocking"); await hubWait(700); }
    hub.fresh = { i, k: "opened" }; hub.busy = false; hubRender(true);
  }
  async function hubCraft(id) {
    const S = $("wchScene"), st = S.querySelector(`[data-st="${id}"]`); if (!st) return;
    hub.busy = true; const r = G.craft(id);
    if (!r.ok) { hub.busy = false; toast(r.msg); return hubRender(true); }
    st.classList.add("crafting"); const b = hubRect(st.querySelector(".wcs-stimg img")), fl = [];
    st.querySelectorAll("[data-ing]").forEach((c, k) => { const a = hubRect(c.querySelector("img")), n = Math.min(C.WC_RECIPES[id][c.dataset.ing], 3); for (let j = 0; j < n; j++) fl.push(hubFly(c.dataset.ing, a, b, (k * 3 + j) * 100, 34)); });
    await Promise.all(fl);
    hub.fresh = { k: id }; hub.bump = id; hub.busy = false; hubRender(true);
    const ns = S.querySelector(`[data-st="${id}"] .wcs-stimg`); if (ns) hubPop(ns, "+1 Contrato!", "gold");
  }
  function hubClick(ev) {
    if (ev.target.classList && ev.target.classList.contains("wcs-pick")) { ev.stopPropagation(); if (!hub.busy) { hub.plot = null; hubRender(true); } return; } // toque fora da caixa fecha a escolha de semente
    const t = ev.target.closest("button"); if (!t) return; ev.stopPropagation();
    const d = t.dataset; if (hub.busy) return;
    if (d.hub === "back") return hub.area ? hubGo(null) : closeHub();
    if (d.hub) return hubGo(d.hub);
    if (d.hubAdd) return hubEnter(d.hubAdd, t.closest(".wcs-card"));
    if (d.hubDel) return hubLeave(+d.hubDel);
    if (d.hubPlot) { hub.plot = +d.hubPlot; return hubRender(true); }
    if (d.hubPickx) { hub.plot = null; return hubRender(true); }
    if (d.hubPlant) return hubPlant(hub.plot, d.hubPlant);
    if (d.hubHarvest) return hubHarvest(+d.hubHarvest);
    if (d.hubUnlock) return hubUnlock(+d.hubUnlock);
    if (d.hubCraft) return hubCraft(d.hubCraft);
  }
  // v158 · Expedição: contagem ao vivo no pop-up, aviso quando volta e resgate automático do VIP
  function expToast(r) { return `${r.name} ${r.fail ? "falhou na expedição, trouxe só" : "voltou da expedição:"} ${fmt(r.gold)} gold, +${fmt(r.xp)} XP${r.item && BL.anyItem(r.item) ? `, ${BL.anyItem(r.item).name}` : ""}${r.cons ? `, ${C.CONSUMABLES[r.cons].name}` : ""}`; }
  let expWasDone = false;
  // v186 · Recompensa diária: contagem até a meia-noite e bolinha no botão da dock quando há prêmio
  function dyLeft() { const s = Math.max(0, Math.floor((G.dailyNextReset() - Date.now()) / 1000)); return `${String(Math.floor(s / 3600)).padStart(2, "0")}h ${String(Math.floor(s / 60) % 60).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s`; }
  let dyCan = null;
  setInterval(() => {
    if (!G.state) { dyCan = null; return; }
    const can = G.dailyCan(), b = document.querySelector('[data-open="diaria"]');
    if (b) { b.classList.toggle("dy-ready", can); b.dataset.badge = can ? "1" : ""; } // v255: número no lugar da bolinha
    misBadge(); // v534
    if (currentModal === "Recompensa diária") { if (dyCan === false && can) MODALS.diaria(); else { const el = $("dyLeft"); if (el) el.textContent = dyLeft(); } }
    dyCan = can;
  }, 1000);
  setInterval(() => {
    if (!G.state) { expWasDone = false; return; }
    const c = G.exp().cur, el = $("expLeft");
    if (el && c && currentModal === "Expedição") el.textContent = G.expDone() ? "Pronto" : expLeft(c.end);
  }, 1000);
  setInterval(() => {
    if (!G.state) return;
    const r = G.expTick();
    if (r && r.auto) { toast(`VIP · ${expToast(r.auto)}`, "gold"); if (currentModal === "Expedição") MODALS.expedicao(); }
    const done = !!(r && r.done);
    if (done && !expWasDone) { toast("Expedição concluída! Abra Expedição para resgatar.", "gold"); if (currentModal === "Expedição") MODALS.expedicao(); }
    expWasDone = done;
  }, 5000);
  G.on("skills", () => renderSkills());
  G.on("roster", () => { renderMyTeam(); renderDock(); refreshFloats(); renderWildcard(); });
  G.on("dev", () => { G.wcTick(); renderWildcard(); hubRender(); renderRail(); renderMyTeam(); renderObjective(); if (!G.dev) closeFloat("dev"); else refreshFloats(true); });
  G.on("toast", (t) => toast(t)); G.on("matchStart", () => { const s = G.state; if (s && !G.dev && !G.pvpFight && !(G.match && G.match.training)) tutSt().n++; }); /* v688: o tutorial do Mickey (TUT_SEQ) substitui o pop-up "Como funciona" (introNotice, v682) */ G.on("log", renderLog);
  function renderHomeName() { $("sbHome").innerHTML = `<span class="sb-tag">${esc(G.teamTag())}</span>`; $("sbHome").title = G.teamName(); }
  G.on("teamName", renderHomeName);
  G.on("score", () => { renderScore(); renderEnemy(); renderRail(); refreshFloats(); });
  G.on("resources", () => { renderDock(); renderTop(); renderMyTeam(); renderChests(); if (currentModal === "Itens") MODALS.items(); });
  G.on("chest", () => { if (currentModal === "Espólios") MODALS.espolios(); }); // v382
  G.on("resources", () => { if (currentModal === "Mochila") { const sc = $("bagGrid") && $("bagGrid").scrollTop; MODALS.mochila(); if ($("bagGrid")) $("bagGrid").scrollTop = sc || 0; } }); // v381
  G.on("chest", (ch) => { renderChests(); toast(`${C.CHEST_KINDS[ch.kind].name} no Espólios`); });
  setInterval(() => G.stdChestTick(), 10000);
  G.on("matchEnd", (r) => {
    if (r.reason === "mercy" && !tutSt().done.misericordia) { tutSt().mercy = r.win ? 1 : 2; } // v693: o Mickey explica na partida seguinte
    renderAll();
    r.ups.forEach((u) => toast(u));
    if (r.prologue && r.stolen) prologueRoulette(r); // v558: Prólogo
    else if (r.target >= 0) stealRoulette(r);
    else stealReveal(r);
    if (r.note) toast(r.note);
  });
  // v128 · roleta de roubo: destaca os cards do adversário um por um (~1,5 s), para no alvo e pisca verde (roubou) ou vermelho
  function stealRoulette(r) {
    const cards = [...document.querySelectorAll("#enemyCard .mini-card")];
    if (!cards.length || cards.length <= r.target) return stealReveal(r);
    const n = cards.length, hops = n * 3 + r.target + 1, total = 1500;
    let i = 0;
    const times = Array.from({ length: hops }, (_, k) => { const x = (k + 1) / hops; return total * (x * x * 0.55 + x * 0.45); });
    const step = () => {
      cards.forEach((c) => c.classList.remove("rl-on"));
      cards[i % n].classList.add("rl-on");
      i++;
      if (i < hops) return setTimeout(step, times[i] - times[i - 1]);
      const c = cards[r.target]; c.classList.remove("rl-on"); c.classList.add("rl-pick"); if (!r.arm) c.classList.add(r.stolen ? "rl-ok" : "rl-fail");
      setTimeout(() => (r.arm ? stealSuspense(r, c) : stealReveal(r)), 450);
    };
    setTimeout(step, times[0]);
  }
  // v690 (Mickey): suspense do roubo. v692: segue o storyboard dele: 1 surge e pulsa (papel creme com moldura dourada, brilho verde e anel no chão), 2 mira no alvo (mira fechando e riscos de velocidade), 3 ROUBADO! (carimbo verde) ou 4 contrato rasgado (vermelho). O nome no papel é o do contrato usado (r.arm)
  function stealSuspense(r, card) {
    const q = C.SUPPLIES[r.arm] || { name: "Proposta" }, en = (G.enemies || [])[r.target], host = $("pitchWrap"), old = $("stealCtx"); if (old) old.remove();
    const lau = (c) => `<svg class="ctx-lau ${c}" viewBox="0 0 12 16" aria-hidden="true"><path d="M10 15C5 13 2 9 3 2" fill="none" stroke="#b8893a" stroke-width="1"/><g fill="#c9a04a"><ellipse cx="3.2" cy="3.2" rx="1.3" ry="2.4" transform="rotate(-14 3.2 3.2)"/><ellipse cx="2.2" cy="7" rx="1.3" ry="2.4" transform="rotate(-42 2.2 7)"/><ellipse cx="3.6" cy="10.4" rx="1.3" ry="2.4" transform="rotate(-62 3.6 10.4)"/><ellipse cx="6.4" cy="13" rx="1.3" ry="2.4" transform="rotate(-80 6.4 13)"/><ellipse cx="5.6" cy="5.6" rx="1.1" ry="2.1" transform="rotate(28 5.6 5.6)"/><ellipse cx="6.4" cy="9.4" rx="1.1" ry="2.1" transform="rotate(8 6.4 9.4)"/></g></svg>`;
    const paper = `<div class="ctx-in"><small>${lau("a")}<span>BL PROJECT</span>${lau("b")}</small><b>${esc(q.name)}</b><span class="ctx-div"><i></i></span><em>${esc(en ? en.short || en.name : "Adversário")}</em><u></u>${lau("c")}<span class="ctx-seal"><span>BL</span></span></div>`;
    const el = document.createElement("div"); el.id = "stealCtx"; el.className = "ctx"; el.style.setProperty("--ctx-t", C.STEAL_SUSPENSE_MS + "ms");
    el.innerHTML = `<div class="ctx-speed"></div><div class="ctx-glow"></div><div class="ctx-floor"></div><div class="ctx-beam"></div>${Array.from({ length: 12 }, (_, i) => `<i class="ctx-p" style="--a:${i * 30 + Math.round(Math.random() * 16)}deg;--d:${120 + Math.round(Math.random() * 90)}px"></i>`).join("")}
      <div class="ctx-paper"><div class="ctx-half l">${paper}</div><div class="ctx-half r">${paper}</div><svg class="ctx-crack" viewBox="0 0 40 240" preserveAspectRatio="none" aria-hidden="true"><polyline points="24,0 15,34 26,62 13,98 25,130 14,164 24,198 16,240"/></svg><span class="ctx-stamp">ROUBADO!</span></div>
      <div class="ctx-aim"><i class="c"></i><i class="b tl"></i><i class="b tr"></i><i class="b bl"></i><i class="b br"></i><i class="ar t"></i><i class="ar r"></i><i class="ar d"></i><i class="ar l"></i></div>
      <b class="ctx-res">Contrato rasgado</b><small class="ctx-ch">Chance de roubo ${String(r.chance).replace(".", ",")}%${C.STEAL_PITY && r.chance < 100 ? ` · Sorte ${Math.min(r.pity0 || 0, C.STEAL_PITY.sure)}/${C.STEAL_PITY.sure}` : ""}</small>`; // v708: sorte do contrato
    host.appendChild(el);
    const T = C.STEAL_SUSPENSE_MS, t0 = Date.now(), tk = setInterval(() => { const u = (Date.now() - t0) / T; if (u >= 1 || !el.isConnected) return clearInterval(tk); tick(1 - u * 0.8); }, 150);
    setTimeout(() => { if (el.isConnected) el.classList.add("aim"); }, T * 0.45);
    setTimeout(() => { if (el.isConnected) fxSnd(r.stolen ? "contrato-roubou" : "contrato-rasgado"); }, Math.max(0, T - 800)); // v693: áudios do Mickey, o pico (0,8 s) cai no resultado
    setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove("aim"); el.classList.add(r.stolen ? "ok" : "fail");
      { const SP = C.STEAL_PITY, miss = (r.roll || 0) - (r.chance || 0), rs = el.querySelector(".ctx-res"); if (!r.stolen && SP && rs && miss >= 0 && miss < SP.near) rs.textContent = `Quase! Faltou ${String(Math.max(0.1, Math.round(miss * 10) / 10)).replace(".", ",")}%`; } // v708 (Mickey): quase vitória
      if (card) card.classList.add(r.stolen ? "rl-ok" : "rl-fail");
      setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); stealReveal(r); }, r.stolen ? 1300 : 1500);
    }, T);
  }
  // v558 (Mickey): venceu o Mini Boss do Prólogo → jackpot de silhuetas de personagens; para no Comum roubado (garantido)
  function prologueRoulette(r) {
    const p = r.stolen, ids = r.prologue.pool.length ? r.prologue.pool : [p.charId];
    const sil = (id) => { const a = C.SPRITES[id]?.anim?.idle; if (a && a.src.includes("#")) return `<img class="spr st-atl st-sil" src="${C.SPRITES[id].card}" alt="">`; /* v604: atlas */ return a ? `<i class="st-spr st-sil" style="background-image:url('${a.src}');--n:${a.n}"></i>` : `<span class="rl-badge st-sil">?</span>`; };
    const a = C.SPRITES[p.charId]?.anim?.idle, face = a && a.src.includes("#") ? `<img class="spr st-atl" src="${C.SPRITES[p.charId].card}" alt="">` : a ? `<i class="st-spr" style="background-image:url('${a.src}');--n:${a.n}"></i>` : `<span class="rl-badge">${esc(p.initials)}</span>`;
    openModal("Prólogo concluído", `<div class="st-pick pr-pick"><p class="st-lead">Você venceu o Mini Boss! Sorteando um jogador Comum para o seu time...</p><div class="st-row"><button type="button" class="st-card st-spin" disabled><span class="st-face">${face}<b>${esc(p.name)}</b><small>${esc(posName(p.position))} · Comum</small></span><span class="st-reel"><span class="st-strip"></span></span></button></div><div class="reveal-actions"><button type="button" class="btn btn-hot" id="prOk" disabled>Sorteando...</button></div></div>`);
    const c = $("modalBody").querySelector(".st-card"), st = c.querySelector(".st-strip"), seq = [];
    for (let k = 0; k < 18; k++) seq.push(ids[Math.floor(Math.random() * ids.length)]);
    seq.push(p.charId); st.innerHTML = seq.map((id) => `<span class="st-cell">${sil(id)}</span>`).join("");
    const h = c.querySelector(".st-reel").clientHeight || 150; st.querySelectorAll(".st-cell").forEach((x) => (x.style.height = h + "px"));
    const T0 = performance.now(), dur = 2200, n = seq.length; let last = -1;
    const step = (now) => {
      if (!c.isConnected) return;
      const t = Math.min(1, (now - T0) / dur), y = (1 - Math.pow(1 - t, 3)) * (n - 1) * h, cell = Math.floor(y / h);
      st.style.transform = `translateY(${-y}px)`; if (cell !== last) { last = cell; tick(1 - t); }
      if (t < 1) return requestAnimationFrame(step);
      c.classList.remove("st-spin"); c.classList.add("st-hit"); fanfare();
      $("modalBody").querySelector(".st-lead").innerHTML = `<b>ROUBADO!</b> ${esc(p.name)} entrou no seu time. O 2×2 foi liberado em Mapas.`;
      const ok = $("prOk"); ok.disabled = false; ok.textContent = "Continuar"; ok.onclick = () => closeModal();
      toast(`${p.name} entrou no seu elenco. 2×2 liberado!`, "gold");
    };
    requestAnimationFrame(step);
  }
  function stealReveal(r) {
    if (r.stolen) {
      const p = r.stolen, rr = rar(p.rarity);
      $("stealPop").innerHTML = `<h3>ROUBADO!</h3><p><b style="color:${rr.color}">${esc(p.name)}</b> · ${rr.name}${p.shiny ? " · Shiny ✦" : ""}</p><p class="note">Chance ${String(r.chance).replace(".", ",")}% · chega no Nv 1 · status ${BL.statTotal(p)}/186</p>`;
      $("stealPop").hidden = false;
      toast(`${p.name} entrou no seu elenco. Veja em Jogadores.`, "gold");
      const n = G.state.roster.length;
      if (n >= 2 && n <= 4) toast(`Você tem ${n} jogadores: o ${n}×${n} foi liberado em Mapas.`, "gold");
    }
  }

  // ---------- cliques ----------
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("button");
    if (!t) { const c = ev.target.closest("[data-ev]"); if (c) MODALS.ev(c.dataset.ev); return; }
    if ("hubGo" in t.dataset) { closeModal(); if ("hubTrain" in t.dataset) return $("trainBtn").click(); if (t.dataset.float) { if (!floats[t.dataset.float]) openFloat(t.dataset.float); return; } } // v283: Central do treinador fecha e segue para o recurso
    if (t.dataset.hubCat) { const el = $("hub-" + t.dataset.hubCat); if (el) el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); document.querySelectorAll(".hub-nav").forEach((x) => x.classList.toggle("on", x === t)); return; }
    if (t.dataset.pcTab) { pcUi.tab = t.dataset.pcTab; return MODALS.players(); } // v583
    if (t.dataset.mstPick) { pcUi.sel = t.dataset.mstPick; return pcKeepScroll(); }
    if (t.dataset.dexPick) { pcUi.dex = t.dataset.dexPick; return pcKeepScroll(); } // v708; v709 (Mickey): clicar não volta a lista para cima
    if (t.dataset.pcPick) { pcUi.sel = t.dataset.pcPick; return MODALS.players(); } // v281
    if (t.dataset.espCat) { espUi.cat = t.dataset.espCat; espUi.sel = null; return MODALS.espolios(); } // v382
    if (t.dataset.espPick) { espUi.sel = t.dataset.espPick; return MODALS.espolios(); }
    if (t.dataset.espOpen) { const c = G.state.chests.find((x) => (x.kind || "azul") === t.dataset.espOpen); if (c) { const o = G.openChest(c.id); chestBoom([o]); lootNotes([o]); renderChests(); } return MODALS.espolios(); }
    if (t.dataset.bagCat) { bagUi.cat = t.dataset.bagCat; bagUi.sel = null; return MODALS.mochila(); } // v381
    if (t.dataset.bagPick) { bagUi.sel = t.dataset.bagPick; document.querySelectorAll(".bg-card.on").forEach((c) => c.classList.remove("on")); t.classList.add("on"); const l = $("bagLeft"); if (l) l.innerHTML = bagLeftHtml(bagEntries().find((e) => e.key === bagUi.sel)); return; }
    if (t.dataset.bagWhob) { bagUi.who = t.dataset.bagWhob; return MODALS.mochila(); } // v694
    if (t.dataset.bagUnq) { const [u, k] = t.dataset.bagUnq.split("|"), p = G.player(u), id = p && p.items[k]; if (id) { G.unequip(u, k); toast(`${BL.ITEM_BY_ID[id].name} voltou para a Mochila`); } return MODALS.mochila(); }
    if (t.dataset.eqUnq1) { const [u, k] = t.dataset.eqUnq1.split("|"), p = G.player(u), id = p && p.items[k]; if (id) { G.unequip(u, k); toast(`${BL.ITEM_BY_ID[id].name} voltou para a Mochila`); } return MODALS.equipe(); }
    if (t.dataset.bagEquip) { const i = G.state.inventory.indexOf(t.dataset.bagEquip), p = G.player(bagUi.who); if (i < 0 || !p) return; const it0 = BL.ITEM_BY_ID[t.dataset.bagEquip]; if (it0 && it0.ci && !BL.charItemOk(p, it0)) { toast("Esse item é só do próprio personagem, Épico ou acima"); return; } G.equip(i, p.uid); toast(`${BL.ITEM_BY_ID[t.dataset.bagEquip].name} equipado em ${p.short || p.name}`); return MODALS.mochila(); }
    if ("pcClear" in t.dataset) { Object.assign(pcUi, { q: "", rar: "", pos: "", st: "", ord: "nivel", dir: "desc" }); return MODALS.players(); }
    if (t.dataset.eqPick) { eqUid = t.dataset.eqPick; return MODALS.equipe(); } // v276
    if (t.dataset.eqSwap) { const [a, b] = t.dataset.eqSwap.split("|").map(Number); G.moveSlot(a, b); return MODALS.equipe(); } // v434
    if (t.dataset.eqView) { eqView = t.dataset.eqView; return MODALS.equipe(); } // v455
    if (t.dataset.eqbAtk) { G.setAtkPreset(t.dataset.eqbAtk); return MODALS.equipe(); } // v597
    if (t.dataset.eqbMark) { G.setMarkPreset(t.dataset.eqbMark); return MODALS.equipe(); } // v457
    if (t.dataset.eqbReset) { G.resetPosShape(t.dataset.eqbReset); return MODALS.equipe(); }
    if (t.dataset.eqTeam) { if (G.useTeamSet(+t.dataset.eqTeam)) { eqUid = null; toast(G.state.training ? `Time ${+t.dataset.eqTeam + 1} em campo` : `Time ${+t.dataset.eqTeam + 1} escolhido: vale na próxima partida`, "gold"); } return MODALS.equipe(); }
    if (t.dataset.eqOut) { G.removeFromLineup(t.dataset.eqOut); eqUid = null; return MODALS.equipe(); }
    if (t.dataset.eqEv) return MODALS.ev(t.dataset.eqEv);
    if (t.dataset.eqUnqOpen) { eqUnq = eqUnq === t.dataset.eqUnqOpen ? null : t.dataset.eqUnqOpen; return MODALS.equipe(); } // v694: lista de itens para retirar
    if (t.dataset.eqUnequip) { eqUnq = null; const p = G.player(t.dataset.eqUnequip); const ks = p ? Object.keys(p.items || {}).filter((k) => p.items[k]) : []; ks.forEach((k) => G.unequip(p.uid, k)); if (ks.length) toast(`${ks.length} ${ks.length > 1 ? "itens voltaram" : "item voltou"} para o inventário`); return MODALS.equipe(); } // v279
    if ("eqClose" in t.dataset) return closeModal();
    if (t.dataset.tpSlot) { trUi.slot = t.dataset.tpSlot; return MODALS.trainPick(); }
    if (t.dataset.tpPos) { trUi.pos = t.dataset.tpPos; return MODALS.trainPick(); }
    if ("tpPut" in t.dataset) { // coloca no slot escolhido e pula para o próximo vazio
      const sd = trUi.slot[0], i = +trUi.slot.slice(1), l = Array.from({ length: C.TRAINING_MAX }, (_, k) => trUi[sd][k] || null); l[i] = t.dataset.tpPut || null; trUi[sd] = l.filter(Boolean);
      const nx = ["a", "b"].flatMap((x) => Array.from({ length: C.TRAINING_MAX }, (_, k) => x + k)).find((k) => !trUi[k[0]][+k.slice(1)]); if (t.dataset.tpPut && nx) trUi.slot = nx;
      return MODALS.trainPick();
    }
    if ("tpAuto" in t.dataset) { G.setTrainSides(null); trUi.a = null; closeModal(); return toast("Treino automático: o jogo divide os jogadores livres."); }
    if ("tpGo" in t.dataset) { if (!trUi.a.length) return toast("Coloque pelo menos 1 jogador no Meu time."); G.setTrainSides(trUi.a, trUi.b); trUi.a = null; closeModal(); return toast("Treino montado!"); }
    if ("sleepGo" in t.dataset) { // v291: precisa de partida valendo (fora do treino)
      if (!G.match || G.match.training || G.state.training) return toast("A soneca mede uma partida valendo: saia do modo treino primeiro.");
      slMeas = { t0: Date.now() }; return MODALS.sleep();
    }
    if (t.dataset.mailClaim) { if (G.mailClaim(t.dataset.mailClaim)) toast("Anexo resgatado!"); return MODALS.mail(); }
    if ("mailRef" in t.dataset) return MODALS.mail();
    if (t.dataset.dxCat) { dxUi.cat = t.dataset.dxCat; return MODALS.diamantes(); } // v502
    if (t.dataset.dxFit) { dxUi.fit = !dxUi.fit; t.classList.toggle("on", dxUi.fit); const l = $("dxList"); if (l) l.innerHTML = dxListHtml(); return; } // v503
    if (t.dataset.dxBuy) { const r = G.buyDia(t.dataset.dxBuy); toast(r.msg, r.ok ? "gold" : undefined); if (r.ok) { renderTop(); renderChests(); } return MODALS.diamantes(); }
    if (t.dataset.dmTab) { dmUi.tab = t.dataset.dmTab; return MODALS.buyDiamonds(); }
    if (t.dataset.dmPack) { dmUi.pack = +t.dataset.dmPack; document.querySelectorAll(".dm-pk").forEach((b) => b.classList.toggle("on", b === t)); return; }
    if (t.dataset.dmStep || t.dataset.dmQ) { const qi = $("dmQty"); qi.value = t.dataset.dmQ ? +t.dataset.dmQ : (dmUi.qty + +t.dataset.dmStep); qi.oninput(); qi.value = dmUi.qty; return; }
    if ("dmReview" in t.dataset) return toast("A compra de Diamantes ainda não está ativa nesta versão.");
    if ("openEq" in t.dataset) return MODALS.equipe();
    if (t.dataset.benchSlot) return MODALS.bench(+t.dataset.benchSlot);
    if (t.dataset.benchSet) { const [i, u] = t.dataset.benchSet.split("|"); G.setBench(+i, u || null); return closeModal(); }
    if (t.dataset.vestBack) { G.vestEnd(); return; }
    if (t.dataset.vestHeal) { const [u, id] = t.dataset.vestHeal.split("|"); G.useCons(u, id); G.vestTouch(); return MODALS.vestiario(); }
    if (t.dataset.pmTab) { pmTab = t.dataset.pmTab; renderPrematch(); return; } // v599
    if (t.dataset.pmAtk) { G.applyAtk(t.dataset.pmAtk); if (G.prematch) G.prematch.until = Math.max(G.prematch.until, Date.now() + 3000); renderPrematch(); return; } // v598
    if (t.dataset.pmPick) { G.prematchPick(t.dataset.pmPick); renderPrematch(); renderTactic(); return; }
    if (t.dataset.pause) { if (G.tacticalPause()) MODALS.pausa(); return; }
    if (t.dataset.pausePick) { G.applyPause(t.dataset.pausePick); closeModal(); renderTactic(); return; }
    if (t.dataset.heal) { const [u, id] = t.dataset.heal.split("|"); G.useCons(u, id); return refreshHeal(); }
    if (t.dataset.shopCat) { shopUi.cat = t.dataset.shopCat; return MODALS.loja(); } // v419
    if (t.dataset.shopMode) { shopUi.mode = t.dataset.shopMode; shopUi.sel = null; shopUi.cat = "todos"; shopUi.q = ""; return MODALS.loja(); } // v475
    if (t.dataset.shopQty) return t.dataset.shopQty === "max" ? shopQty(1e9, true) : shopQty(+t.dataset.shopQty); // v650: botão Máx.
    if (t.dataset.gyTab) { gyUi.tab = t.dataset.gyTab; gyUi.sel = null; return gyOpen(); } // v622 · Líderes
    if ("gySel" in t.dataset) { gyUi.sel = t.dataset.gySel || null; return gyOpen(); }
    if (t.dataset.gyGo) { const r = G.gyStart(t.dataset.gyGo); toast(r.msg, r.ok ? "gold" : undefined); if (r.ok) return closeModal(); return gyOpen(); }
    if ("gyAbd" in t.dataset) { const r = G.gyAbdicate(); toast(r.msg, r.ok ? "gold" : undefined); return gyOpen(); }
    if (t.dataset.mkTab) { if (mkUi.tab !== t.dataset.mkTab) { mkUi.page = 0; mkUi.sheet = null; } mkUi.tab = t.dataset.mkTab; return mkOpen(); } // v621 · Casa de Leilões
    if (t.dataset.mkCat) { mkUi.cat = t.dataset.mkCat; mkUi.page = 0; return mkOpen(); }
    if (t.dataset.mkCurf) { mkUi.cur = t.dataset.mkCurf; mkUi.page = 0; return mkOpen(); }
    if (t.dataset.mkPage) { mkUi.page = Math.max(0, mkUi.page + +t.dataset.mkPage); return mkOpen(); }
    if ("mkSheet" in t.dataset) { mkUi.sheet = t.dataset.mkSheet || null; mkUi.bid = ""; return mkOpen(); }
    if (t.dataset.mkBidset) { mkUi.bid = t.dataset.mkBidset; return mkOpen(); }
    if (t.dataset.mkBuy) { const r = G.mkBuy(t.dataset.mkBuy); toast(r.msg, r.ok ? "gold" : undefined); if (r.ok) { mkUi.sheet = null; renderTop(); } return mkOpen(); }
    if (t.dataset.mkBid) { const r = G.mkBid(t.dataset.mkBid, mkUi.bid); toast(r.msg, r.ok ? "gold" : undefined); if (r.ok) { mkUi.sheet = null; mkUi.bid = ""; renderTop(); } return mkOpen(); }
    if (t.dataset.mkCancel) { const r = G.mkCancel(t.dataset.mkCancel); toast(r.msg, r.ok ? "gold" : undefined); if (r.ok) renderTop(); return mkOpen(); }
    if (t.dataset.mkScat) { mkUi.sCat = t.dataset.mkScat; mkUi.sel = null; mkUi.sq = ""; mkUi.qty = 1; return mkOpen(); }
    if (t.dataset.mkSel) { mkUi.sel = t.dataset.mkSel; mkUi.qty = 1; return mkOpen(); }
    if (t.dataset.mkMode) { mkUi.mode = t.dataset.mkMode; return mkOpen(); }
    if (t.dataset.mkScur) { mkUi.scur = t.dataset.mkScur; return mkOpen(); }
    if (t.dataset.mkHours) { mkUi.hours = +t.dataset.mkHours; return mkOpen(); }
    if ("mkPost" in t.dataset) { const r = G.mkPost({ kind: mkUi.sCat, ref: mkUi.sel, qty: mkUi.qty, mode: mkUi.mode, price: mkUi.price, cur: mkUi.scur, hours: mkUi.hours }); toast(r.msg, r.ok ? "gold" : undefined); if (r.ok) { mkUi.sel = null; mkUi.price = ""; mkUi.qty = 1; mkUi.tab = "meus"; renderTop(); renderMyTeam(); } return mkOpen(); }
    if ("shopBuy" in t.dataset || "shopSell" in t.dataset) { const [k, id] = (shopUi.sel || "").split(":"), n = shopUi.qty || 1;
      const r = "shopSell" in t.dataset ? G.sell(id, n) : k === "q" ? G.buyItem(id, n) : G.buyCons(id, n); toast(r.msg, r.ok ? "gold" : undefined); if (r.ok) { shopUi.qty = 1; renderTop(); renderChests(); } return MODALS.loja(); }
    if (t.dataset.bagArm) { const on = G.armSteal(t.dataset.bagArm); toast(on ? `${C.SUPPLIES[on].name} equipado para roubar` : "Nada equipado: sem roubo nas vitórias"); return MODALS.mochila(); }
    if (t.dataset.bagLvl) { const r = G.useLevelItem(t.dataset.bagLvl, bagUi.who); toast(r.msg, r.ok ? "gold" : undefined); return MODALS.mochila(); } // v527
    if (t.dataset.bagFicha) { const r = G.fichaTrade(t.dataset.bagFicha); toast(r.msg, r.ok ? "gold" : undefined); return MODALS.mochila(); } // v527
    if (t.dataset.bagXp) { const r = G.useXpItem(t.dataset.bagXp, bagUi.who); toast(r.msg, r.ok ? "gold" : undefined); return MODALS.mochila(); }
    if (t.dataset.shopPick) { shopUi.sel = t.dataset.shopPick; return MODALS.loja(); }
    if (t.dataset.shopHire) { const r = G.buyCoach(t.dataset.shopHire); toast(r.msg, r.ok ? "gold" : undefined); if (r.ok) { renderDock(); renderTop(); } return currentModal === "Loja de Diamantes" ? MODALS.diamantes() : MODALS.loja(); }
    if (t.dataset.buyItem) { const r = G.buyItem(t.dataset.buyItem); toast(r.msg, r.ok ? "gold" : undefined); return MODALS.loja(); } // v473
    if (t.dataset.mgrEq) { const [id, i] = t.dataset.mgrEq.split("|"); if (G.mgrEquip(id, +i)) toast(`${BL.MGR_BY_ID[id].name} equipado no treinador`); return MODALS.mochila(); }
    if (t.dataset.mgrUn) { G.mgrUnequip(+t.dataset.mgrUn); return MODALS.mochila(); }
    if (t.dataset.buy) { const [id, n] = t.dataset.buy.split("|"); const r = G.buyCons(id, +n); toast(r.msg, r.ok ? "gold" : undefined); return MODALS.loja(); }
    if (t.dataset.evOpen) return MODALS.ev(t.dataset.evOpen);
    if (t.dataset.wcOpen) return MODALS.wildcard();
    if (t.closest("#modal") && !t.dataset.expCancel) expSel.arm = false;
    if (t.dataset.expReg) { const ri = +t.dataset.expReg, per = C.EXPEDITION.perRegion; for (let L = ri * per + per; L > ri * per; L--) if (G.expLevelOpen(L)) { expSel.lvl = L; break; } return MODALS.expedicao(ri); }
    if (t.dataset.bossTab) { bossTab = t.dataset.bossTab; return MODALS.boss(); }
    if (t.dataset.bossPick) { const s = G.state, u = t.dataset.bossPick, ids = (s.bossTeam || []).filter((x) => G.player(x)); if (ids.includes(u)) ids.splice(ids.indexOf(u), 1); else if (ids.length >= C.BOSS_TEAM_SIZE) toast(`A equipe do Boss tem ${C.BOSS_TEAM_SIZE} jogadores. Tire um antes.`); else ids.push(u); s.bossTeam = ids; G.save(); return MODALS.boss(true); }
    if (t.dataset.bossChest) { bossChest = { tier: t.dataset.bossChest, drops: null, shown: 0 }; bossShake(); return MODALS.boss(true); }
    if (t.dataset.bossOpen) { bossChest.drops = bossRoll(C.BOSS_CHESTS.find((x) => x.id === bossChest.tier)); bossChest.shown = 0; if (bossChest.real) G.bossClaim(bossChest.drops); bossShake(); return MODALS.boss(true); }
    if (t.dataset.bossSend) { const r = G.bossSend(G.state.bossTeam); toast(r.ok ? (Date.now() < G.bossRun().start ? `Equipe enviada! A partida contra o Boss começa às ${C.BOSS_RUN.startHour}h.` : "Equipe enviada! A partida contra o Boss começou.") : r.msg, r.ok ? "gold" : ""); return MODALS.boss(true); }
    if (t.dataset.bossNow) { G.bossFinishNow(); return MODALS.boss(true); }
    if (t.dataset.bossMine) { const m = G.bossMyChest(); if (m && m.tier) { bossChest = { tier: m.tier, drops: null, shown: 0, real: true, pos: m.pos }; bossShake(); } return MODALS.boss(true); }
    if (t.dataset.bossFree) { G.bossClaim([]); toast("Equipe liberada"); return MODALS.boss(true); }
    if (t.dataset.bossRk) { bossRk = { tab: t.dataset.bossRk, open: t.dataset.bossRkPick || null }; return MODALS.boss(true); }
    if (t.dataset.bossDay) { const x = C.BOSS_ROTATION[+t.dataset.bossDay], d = (+t.dataset.bossDay - new Date().getDay() + 7) % 7; toast(`${x.name} · ${d ? ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][+t.dataset.bossDay] : "hoje"}`); return; }
    if (t.dataset.bossHelp) { bossHelp = true; return MODALS.boss(true); }
    if (t.dataset.bossHelpClose) { bossHelp = false; return MODALS.boss(true); }
    if (t.dataset.bossTop) { bossTopOpen = bossTopOpen === t.dataset.bossTop ? null : t.dataset.bossTop; const sc = $("modalBody").scrollTop; MODALS.boss(true); $("modalBody").scrollTop = sc; return; }
    if (t.dataset.bossRkTab) { bossRk.tab = t.dataset.bossRkTab; return MODALS.boss(true); }
    if (t.dataset.bossRkOpen) { bossRk.open = bossRk.open === t.dataset.bossRkOpen ? null : t.dataset.bossRkOpen; return MODALS.boss(true); }
    if (t.dataset.bossRkClose) { bossRk = null; return MODALS.boss(true); }
    if (t.dataset.misClaim) { const r = G.misClaim(); toast(r.ok ? (r.last ? `Capítulo concluído: ${r.ch.title}! Prêmios entregues.` : `Missão concluída: ${r.q.goal}. Prêmio entregue!`) : r.msg, r.ok ? "gold" : undefined); misBadge(); renderChests(); return MODALS.missoes(); } // v534
    if (t.dataset.dailyClaim) { const r = G.dailyClaim(); if (r) { const R = C.DAILY_REWARDS[r.day - 1]; toast(`Dia ${r.day} resgatado: ${R.k === "boneco" ? `${r.name} (${rar(R.rarity).name})` : `${fmt(R.n)} ${R.k === "gold" ? "Gold" : R.k === "diamantes" ? "Diamantes" : R.k === "xp" ? "XP" : R.k === "chest" ? C.CHEST_KINDS[R.id].name : R.k === "sup" ? C.SUPPLIES[R.id].name : C.CONSUMABLES[R.k].name}`}${r.bonus ? ` + ${fmt(r.bonus)} Gold da sequência` : ""}`, "gold"); } return MODALS.diaria(); }
    if (t.dataset.titleUse) { if (G.useTitle(t.dataset.titleUse)) toast("Título agora é o nome do seu time!", "gold"); return MODALS.profile(); } // v708
    if (t.dataset.wkClaim) { if (G.wkClaim(t.dataset.wkClaim)) toast("Missão semanal resgatada!", "gold"); return MODALS.missoes(); } // v708
    if (t.dataset.dailySkip) { G.dailyDevSkip(); return MODALS.diaria(); }
    if (t.dataset.bossReveal) { bossChest.shown++; return MODALS.boss(true); }
    if (t.dataset.bossClose) { bossChest = null; return MODALS.boss(true); }
    if (t.dataset.expPage) { expSel.page = +t.dataset.expPage; return MODALS.expedicao(); }
    if (t.dataset.expLvl) { expSel.lvl = +t.dataset.expLvl; return MODALS.expedicao(); }
    if (t.dataset.expDur) { expSel.dur = t.dataset.expDur; return MODALS.expedicao(); }
    if (t.dataset.expPl) { expSel.uid = expSel.uid === t.dataset.expPl ? null : t.dataset.expPl; return MODALS.expedicao(); }
    if (t.dataset.expSend) { const r = G.expSend(expSel.uid, expSel.lvl, expSel.dur); if (!r.ok) toast(r.msg); else expSel.uid = null; return MODALS.expedicao(); }
    if (t.dataset.expCancel) { if (expSel.arm) { G.expCancel(); expSel.arm = false; } else expSel.arm = true; return MODALS.expedicao(); }
    if (t.dataset.expNow) { G.expFinishNow(); return MODALS.expedicao(); }
    if (t.dataset.expClaim) { const r = G.expClaim(); if (r) toast(expToast(r), "gold"); return MODALS.expedicao(); }
    if (t.dataset.wcAdd) { G.wcAdd(t.dataset.wcAdd); return MODALS.wildcard(); }
    if (t.dataset.wcDel) { G.wcRemove(+t.dataset.wcDel); return MODALS.wildcard(); }
    if (t.dataset.evAdd) { const [k, n] = t.dataset.evAdd.split("|"); G.addEv(evUid, k, n === "max" ? "max" : +n); return MODALS.ev(evUid); }
    if (t.dataset.evReset) { const r = G.resetEv(evUid); toast(r.msg, r.ok ? "gold" : undefined); return MODALS.ev(evUid); }
    if (t.dataset.lvSet) { G.devSetLevel(evUid, +t.dataset.lvSet); return MODALS.ev(evUid); }
    if (t.dataset.lvIn) { G.devSetLevel(evUid, +$("evLvIn").value); return MODALS.ev(evUid); }
    if (t.dataset.ivSet) { const [k, v] = t.dataset.ivSet.split("|"); G.devSetIv(evUid, k, +v); return MODALS.ev(evUid); }
    if (t.dataset.ivAll) { S.forEach((k) => G.devSetIv(evUid, k, +t.dataset.ivAll)); return MODALS.ev(evUid); }
    if (t.dataset.coachPick) return MODALS.coach(t.dataset.coachPick); // v416
    if (t.dataset.coachUp) { const r = G.upgradeCoach(t.dataset.coachUp); toast(r.msg, r.ok ? "gold" : undefined); if (r.ok) { renderDock(); renderTop(); } return MODALS.coach(t.dataset.coachUp); } // v418
    if (t.dataset.coachBuy) { const r = G.buyCoach(t.dataset.coachBuy); toast(r.msg, r.ok ? "gold" : undefined); if (r.ok) { G.setCoach(t.dataset.coachBuy); renderDock(); renderTop(); } return MODALS.coach(t.dataset.coachBuy); }
    if (t.dataset.coachSet) { G.setCoach(t.dataset.coachSet); renderDock(); toast("Novo técnico: " + G.coachDef().name, "gold"); return MODALS.coach(t.dataset.coachSet); }
    if (t.dataset.role) return selectRole(t.dataset.role);
    if (t.dataset.confirmRole) return selRole && revealStarter(selRole);
    if (t.dataset.float) return toggleFloat(t.dataset.float);
    if (t.dataset.floatClose) return closeFloat(t.dataset.floatClose);
    if (t.dataset.mpDd) { mpUi.dd = !mpUi.dd; refreshFloats(true); return; }
    if (t.dataset.mpDiff) { // v264: dificuldade liberada troca na hora (fase 1 do ato atual); bloqueada só mostra o que falta
      const d = MP_DIFFS.find((x) => x.id === t.dataset.mpDiff); mpUi.dd = false;
      if (G.diffUnlocked(d.i)) { mpUi.diff = null; if (G.setDiff(d.i)) toast(`Dificuldade ${d.name}!`, "gold"); renderObjective(); renderDock(); } else mpUi.diff = d.i;
      refreshFloats(true); return;
    }
    if (t.dataset.mpAct) { mpUi.act = +t.dataset.mpAct; refreshFloats(true); return; }
    if (t.dataset.floatMin) { const w = floats[t.dataset.floatMin]; w.classList.toggle("min"); t.textContent = w.classList.contains("min") ? "▢" : "—"; return; }
    if (t.dataset.action === "reset-analyzer") { G.resetAnalyzer(); refreshFloats(); return; }
    if (t.dataset.skBuy) { const id = t.dataset.skBuy, d = C.SKILL_DEF[id]; // v694: épica por Diamantes, confirma no segundo clique
      if (skBuyArm !== id) { skBuyArm = id; toast(`${d.name}: toque de novo para comprar por ${C.SKILL_DIA_PRICE} Diamantes`); return; }
      skBuyArm = null; const r = G.skBuy(id); toast(r.msg, r.ok ? "gold" : "bad"); if (r.ok) MODALS.habilidades(); return; }
    if (t.dataset.hbId || t.dataset.hbSlot !== undefined) { const r = t.dataset.hbId ? G.skillToggle(t.dataset.hbId) : (() => { const x = G.skillSlots()[+t.dataset.hbSlot]; return x ? G.skillToggle(x.id) : false; })(); if (r === "full") toast("Os 4 slots estão cheios: tire uma habilidade antes"); if (r) { MODALS.habilidades(); renderSkills.key = null; renderSkills(); } return; } // v638
    if (t.dataset.open) return t.dataset.open === "locked" ? MODALS.locked(t.dataset.what) : MODALS[t.dataset.open]();
    if (t.dataset.chestAll) { // v362: abre de uma vez; mostra a animação do melhor item e um resumo
      const res = G.openAllChests(t.dataset.chestAll === "*" ? null : t.dataset.chestAll); renderChests(); if (currentModal === "Espólios") MODALS.espolios();
      if (!res.length) return toast("Nenhum baú para abrir");
      chestBoom(res); return lootNotes(res); // v380: só avisos de raro para cima, no canto · v690: animação do baú
    }
    if (t.dataset.chest) { const o = G.openChest(t.dataset.chest); chestBoom([o]); lootNotes([o]); renderChests(); if (currentModal && currentModal.startsWith("Baús")) MODALS.chests(); return; }
    if (t.dataset.play) { // v296: contagem 3, 2, 1 + apito antes de começar a fase
      const n = +t.dataset.play; if (kickCd) return;
      if (n !== G.state.progress.stage && !G.canPickStage(n)) return;
      kickCd = true; if (currentModal === "Mapas") closeModal(); closeFloat("mapa");
      return kickoffCountdown(() => { if (G.playStage(n)) { renderObjective(); renderDock(); toast(`Partiu fase ${G.stageLabel()}!`, "gold"); } });
    }
    if (t.dataset.stage) { G.pickStage(+t.dataset.stage); renderObjective(); renderDock(); return; }
    if (t.dataset.train === "0" && G.state.training) { return exitTrainingMap(); } // v296: sair do treino abre o Mapa
    if (t.dataset.train) { G.setTraining(t.dataset.train === "1"); toast(G.state.training ? "Modo treino ligado" : "De volta às partidas"); return; }
    if (t.dataset.map) { if (G.switchMap(+t.dataset.map)) { closeModal(); toast(`Agora jogando o ${G.map.mode}`, "gold"); } return; }
    // v309: no treino o tamanho vem de quem treina, então trocar o modo pelo dev sai do treino e começa a partida do modo
    if (t.dataset.ap) { apSel = t.dataset.ap; return actPickOpen(); } // v693: Novo Ato
    if ("apOk" in t.dataset) { const p = G.state.roster.find((x) => x.uid === apSel); if (p && G.actPick(apSel)) { toast(`${p.name} subiu para o Nv ${p.level} e entrou no time!`, "gold"); fanfare(); apSel = null; closeModal(); apWait = 0; renderAll(); } return; }
    if (t.dataset.pitchBuy) { // v693: primeiro clique pede confirmação no próprio botão
      if (t.dataset.sure !== "1") { t.dataset.sure = "1"; t.classList.add("btn-hot"); t.innerHTML = "Confirmar compra"; return; }
      const [id, cur] = t.dataset.pitchBuy.split(":"), r = G.buyPitch(id, cur); toast(r.msg, r.ok ? "gold" : "bad"); return MODALS.pitches();
    }
    if (t.dataset.pitch) { if (G.setPitch(t.dataset.pitch)) { closeModal(); toast(`Agora jogando em: ${C.PITCHES.find((x) => x.id === t.dataset.pitch).name}`, "gold"); } return; }
    if (t.dataset.devMap || t.dataset.devStage) { if (G.state.training) { G.state.training = false; closeFloat("mapa"); } G.switchMap(t.dataset.devMap ? +t.dataset.devMap : G.state.progress.map, t.dataset.devStage ? +t.dataset.devStage : 1); renderObjective(); renderDock(); return; }
    if (t.dataset.sk !== undefined) { MODALS.habilidades(); return; } // v638: abre o pop-up de habilidades do time
    if (t.dataset.devAll) { G.devGrantAll(); toast("Conta dev: todos os personagens, Gold, Diamantes, nível máximo, VIP e itens liberados"); return; }
    if (t.dataset.devRestart) { clearTimeout(G.nextT); G.startMatch(); return; }
    if (t.dataset.devLate) { if (t.dataset.devLate === "gold") G.devGold = true; else G.devLegend = true; toast(t.dataset.devLate === "gold" ? "A próxima partida 4×4 (fora do Boss) vem com o Time Dourado." : "A próxima partida 4×4 tem jogada lendária logo no começo."); return; } // v582
    if (t.dataset.devChem) { const m = G.match; if (!m || !m.chemDev || !m.chemDev(t.dataset.devChem)) toast("Precisa de uma partida com 2 ou mais jogadores no seu time."); return; } // v580
    if (t.dataset.devOff) { G.setDev(false); toast("Modo dev desligado"); return; }
    if (t.dataset.activate) { const r = G.addToLineup(t.dataset.activate); swapIn = r.needSwap ? t.dataset.activate : null; MODALS.players(); return; }
    if (t.dataset.swapOut) { G.swapLineup(swapIn, t.dataset.swapOut); swapIn = null; MODALS.players(); toast(G.state.training ? "Time do treino atualizado" : "Troca feita: vale na próxima partida"); return; }
    if (t.dataset.swapCancel) { swapIn = null; MODALS.players(); return; }
    if (t.dataset.remove) { G.removeFromLineup(t.dataset.remove); MODALS.players(); return; }
    if (t.dataset.equip) { G.equip(+t.dataset.equip, G.activePlayers()[0].uid); return; }
    if (t.dataset.unequip) { const [u, k] = t.dataset.unequip.split("|"); G.unequip(u, k); MODALS.players(); return; }
  });
  $("account").onclick = () => MODALS.profile();
  $("trainBtn").onclick = () => { if (G.state.training) { return exitTrainingMap(); } G.setTraining(!G.state.training); toast(G.state.training ? "Modo treino ligado" : "De volta às partidas"); };
  $("btnMenu").onclick = () => MODALS.hub(); // v283: ≡ abre a Central do treinador (Configurações fica dentro, em Sistema)
  // v269: Picture-in-Picture do campo (o canvas vira um vídeo numa janelinha que fica por cima das outras janelas)
  let pipVideo = null;
  $("btnPip").onclick = async () => {
    try {
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return; }
      if (!pipVideo) { pipVideo = Object.assign(document.createElement("video"), { muted: true, playsInline: true }); pipVideo.className = "pip-src"; document.body.appendChild(pipVideo); }
      pipVideo.srcObject = canvas.captureStream(30);
      await pipVideo.play(); await pipVideo.requestPictureInPicture();
    } catch (e) { console.warn("PiP", e); toast(`Seu navegador não abriu o Picture-in-Picture (${!document.pictureInPictureEnabled ? "bloqueado nesta página" : e && e.name === "NotAllowedError" ? "sem permissão" : (e && e.name) || "erro"})`); } // v677: mostra o motivo
  };
  $("modalClose").onclick = closeModal;
  // v281 · filtros do PC: busca e selects redesenham só a grade (o campo de busca não perde o foco)
  const pcRegrid = () => { const g = $("pcGrid"); if (g) g.innerHTML = pcGridHtml(); const c = $("pcCount"); if (c) c.textContent = pcList().length; };
  document.addEventListener("input", (ev) => { if (ev.target.matches("[data-mk-q]")) { mkUi.q = ev.target.value; mkUi.page = 0; const c = ev.target.selectionStart; mkOpen(); const i = document.querySelector("[data-mk-q]"); if (i) { i.focus(); i.setSelectionRange(c, c); } } else if (ev.target.matches("[data-mk-sq]")) { mkUi.sq = ev.target.value; const c = ev.target.selectionStart; mkOpen(); const i = document.querySelector("[data-mk-sq]"); if (i) { i.focus(); i.setSelectionRange(c, c); } } }); // v621
  document.addEventListener("change", (ev) => { if (ev.target.matches("[data-sk-eq]") && evUid) { if (G.skillEquip(evUid, +ev.target.dataset.skEq, ev.target.value || null)) { MODALS.ev(evUid); renderSkills.key = null; renderSkills(); } } }); // v623: equipar habilidade
  document.addEventListener("change", (ev) => { if (ev.target.matches("[data-mk-sort]")) { mkUi.sort = ev.target.value; mkOpen(); } });
  document.addEventListener("input", (ev) => { if (ev.target.matches("[data-pc-q]")) { pcUi.q = ev.target.value; pcRegrid(); } });
  document.addEventListener("input", (ev) => { if (ev.target.matches("[data-bag-q]")) { bagUi.q = ev.target.value; bagRegrid(); } }); // v381
  document.addEventListener("input", (ev) => { if (ev.target.matches("[data-dx-q]")) { dxUi.q = ev.target.value; const l = $("dxList"); if (l) l.innerHTML = dxListHtml(); } }); // v503
  document.addEventListener("change", (ev) => { if (ev.target.matches("[data-dx-sort]")) { dxUi.sort = ev.target.value; const l = $("dxList"); if (l) l.innerHTML = dxListHtml(); } }); // v503
  document.addEventListener("input", (ev) => { if (ev.target.matches("[data-shop-q]")) { shopUi.q = ev.target.value; const g = $("shGrid"); if (g) g.innerHTML = shopGridHtml(shopList(shopEntries())); } }); // v475
  document.addEventListener("change", (ev) => { const d = ev.target.dataset || {}; if (d.bagF) { bagUi[d.bagF] = ev.target.value; bagRegrid(); } else if ("bagWho" in d) { bagUi.who = ev.target.value; const l = $("bagLeft"); if (l) l.innerHTML = bagLeftHtml(bagEntries().find((e) => e.key === bagUi.sel)); } });
  document.addEventListener("input", (ev) => { if (!ev.target.matches("[data-hub-q]")) return; const q = ev.target.value.trim().toLowerCase(); let any = false;
    document.querySelectorAll(".hub-sec").forEach((sec) => { let n = 0; sec.querySelectorAll(".hub-card").forEach((c) => { const ok = !q || c.dataset.hubTxt.includes(q); c.hidden = !ok; if (ok) n++; }); sec.hidden = !n; if (n) any = true; });
    const no = document.querySelector(".hub-none"); if (no) no.hidden = any; });
  document.addEventListener("change", (ev) => { const k = ev.target.dataset && ev.target.dataset.pcF; if (k) { pcUi[k] = ev.target.value; pcRegrid(); } });
  $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("modal").hidden) closeModal(); });
  $("repeatToggle").onchange = (e) => { G.state.progress.repeat = e.target.checked; G.save(); };
  document.addEventListener("change", (e) => { if (e.target.id === "devEqual") { G.state.devEqualLevel = e.target.checked; G.save(); } });
  // Modo dev escondido: Ctrl+Shift+D ou 5 toques rápidos no logo "BL"
  function toggleDev() {
    if (!G.state || rouletteLock) return;
    G.setDev(!G.dev);
    toast(G.dev ? "Modo dev ligado. Abra pelo botão DEV na lateral." : "Modo dev desligado");
    if (G.dev) openFloat("dev");
  }
  document.addEventListener("keydown", (e) => { if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) { e.preventDefault(); toggleDev(); } });
  let brandTaps = [];
  document.querySelector("header.topbar").addEventListener("click", (e) => {
    if (e.target !== e.currentTarget && !e.target.classList.contains("top-actions")) return; // só parte vazia da barra (v230 sem logo)
    const now = Date.now(); brandTaps = brandTaps.filter((t) => now - t < 2500); brandTaps.push(now);
    if (brandTaps.length >= 5) { brandTaps = []; toggleDev(); }
  });
  $("gatoradeToggle").onchange = (e) => { G.state.settings.autoGatorade = e.target.checked; G.save(); };

  // ---------- início ----------
  function boot() {
    fit();
    G.startMatch();
    startLoop();
  }
  if ($("buildStart")) $("buildStart").textContent = "v" + BL.BUILD;
  // ---------- página inicial e contas ----------
  // Ao abrir o link aparece a página do jogo. "Criar conta" ou "Entrar e jogar" levam à escolha de função
  // (ou direto ao jogo, se a conta já tem progresso). As contas são locais ao navegador (ver accounts.js).
  const A = BL.Accounts;
  let ldMode = "login";
  // v338 · tela de carregamento (ref do Mickey): barra com 5 etapas que de fato pré-carregam save, sprites e campo
  let ljBusy = false;
  const ljWait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ljImgs = (list) => Promise.all(list.map((src) => new Promise((r) => { const im = new Image(); im.onload = im.onerror = r; im.src = src; setTimeout(r, 6000); })));
  async function enterAccount(user) {
    if (ljBusy) return; ljBusy = true;
    let has = false; try { has = !!localStorage.getItem(A.saveKey(user)); } catch (e) {}
    $("ljTitle").textContent = has ? "Sua jornada continua" : "Sua jornada começa";
    const steps = [...$("ljSteps").children], fill = $("ljFill");
    steps.forEach((li) => (li.className = "")); fill.style.width = "0%";
    $("ldAuth").hidden = true; $("ldLoad").hidden = false; $("ldLoad").classList.remove("out");
    const cfg = JSON.stringify(BL.CONFIG || {}), sprites = [...new Set(cfg.match(/img\/sprites\/[\w.-]+\.png/g) || [])];
    const world = ["img/campo.jpg", ...[...new Set(cfg.match(/img\/(?:campos|menu)\/[\w.-]+\.(?:png|jpg)/g) || [])]];
    const plan = [
      ["Verificando conta", () => ljWait(350)],
      ["Conectando ao servidor", () => ljWait(450 + Math.random() * 450)],
      ["Carregando treinador", () => ljWait(300)],
      ["Preparando sua equipe", () => Promise.all([ljImgs(sprites), ljWait(400)])],
      ["Montando o campo", () => Promise.all([ljImgs(world), ljWait(400)])],
    ];
    for (let i = 0; i < plan.length; i++) {
      steps.forEach((li, j) => (li.className = j < i ? "done" : j === i ? "now" : ""));
      $("ljMsg").textContent = plan[i][0];
      fill.style.width = `${(i / plan.length) * 100 + 6}%`;
      await plan[i][1]();
    }
    steps.forEach((li) => (li.className = "done")); fill.style.width = "100%"; $("ljMsg").textContent = "Tudo pronto!";
    await ljWait(350);
    enterNow(user);
    $("ldLoad").classList.add("out"); await ljWait(400); $("ldLoad").hidden = true; ljBusy = false;
  }
  function enterNow(user) {
    stopLoop(); clearTimeout(G.nextT);
    G.account = user; A.setSession(user); music();
    $("ldAuth").hidden = true; $("landing").hidden = true;
    if (G.load()) { renderAll(); boot(); if (G.state.sleep) { const r = G.sleepWake(); setTimeout(() => MODALS.sleepBack(r), 400); } } // v291: paga a soneca
    else { showStart(); $("startName").value = user.length >= 3 ? user : ""; checkStart(false); }
  }
  function openAuth(mode) {
    ldMode = mode;
    document.querySelectorAll("[data-ld-tab]").forEach((b) => b.classList.toggle("on", b.dataset.ldTab === mode));
    $("ldPass2Wrap").hidden = mode !== "create";
    $("ldSubmit").textContent = mode === "create" ? "Criar conta" : "Entrar e jogar";
    $("ldErr").textContent = ""; $("ldAuth").hidden = false; $("ldUser").focus();
  }
  function showLanding() {
    const user = A.session();
    $("landing").hidden = false; $("ldAuth").hidden = true;
    if (!$("ldWelcome").dataset.fixed) $("ldWelcome").textContent = user ? `Entrar como ${user}` : "";
    if (!$("ldAbout").hidden) buildAbout();
  }
  $("landing").addEventListener("click", (e) => {
    const t = e.target.closest("[data-ld-auth],[data-ld-tab],[data-ld-soon],[data-ld-page],.ab-index a"); if (!t) return;
    e.preventDefault();
    if (t.matches(".ab-index a")) { const sec = document.querySelector(t.getAttribute("href")); if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (t.dataset.ldPage) return ldPage(t.dataset.ldPage, t.dataset.wk);
    if (t.dataset.ldSoon) { if (t.dataset.ldSoon !== "0") toast(`${t.dataset.ldSoon}: em breve`); return; }
    if (t.dataset.ldTab) return openAuth(t.dataset.ldTab);
    const user = A.session();
    if (t.dataset.ldAuth === "account") return openAuth(user ? "login" : "create"); // v190 · Minha conta
    if (t.dataset.ldAuth === "login" && user) return enterAccount(user); // já entrou neste navegador: vai direto
    openAuth(t.dataset.ldAuth);
  });
  // v109 · aba Sobre: troca o conteúdo da página inicial e monta as tabelas a partir do config
  // v328 · aba RMT: abas internas só trocam o destaque (mercado ainda fechado); botões do topo rolam até as abas
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rmt-tab]"); if (!b) return;
    document.querySelectorAll(".rmt-tabs [data-rmt-tab]").forEach((x) => x.classList.toggle("on", x.dataset.rmtTab === b.dataset.rmtTab));
    if (!b.closest(".rmt-tabs")) $("rmtMain").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  // v315 · Termos: tópicos da esquerda rolam até a seção
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-tm]"); if (!a) return;
    e.preventDefault();
    document.querySelectorAll("[data-tm]").forEach((x) => x.classList.toggle("on", x === a));
    const sec = $(a.dataset.tm); if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  function ldPage(page, wk) {
    if (page === "sistemas") { page = "wiki"; wk = wk || "partida"; } // v203 · Sistemas virou a Wiki com abas
    if (page === "sobre") page = "home"; // v333 · a antiga Sobre agora é a Início
    document.querySelectorAll("[data-ld-page]").forEach((a) => a.classList.toggle("on", a.dataset.ldPage === page));
    $("ldAbout").hidden = page !== "home"; $("ldRanking").hidden = page !== "ranking"; $("ldWiki").hidden = page !== "wiki"; $("ldTerms").hidden = page !== "termos"; $("ldRmt").hidden = page !== "rmt"; $("ldComm").hidden = page !== "comunidade"; if (page === "comunidade") buildComm(); if (page === "ranking") buildRanking();
    if (page === "wiki") { buildWiki(); buildAbout(); wkTab(wk || "partida"); }
    if (page === "home") buildAbout();
    $("landing").scrollTop = 0;
  }
  // v129 · Ranking (exemplo): 10 nomes fictícios + a sua conta, ordenados pelo poder do time titular
  // v331 · só nomes de usuário (nada de personagens) e visual de placar "BL RANKING"
  const RK_FAKE = [["RaioAzul", 98450], ["CamisaDez_", 87320], ["Tatico99", 74900], ["PedroGol", 61280], ["ZagueiroNoturno", 49730], ["VoltaPorCima", 38610], ["ChuteColocado", 27450], ["LuanaFC", 16820], ["Mestre_do_Passe", 8940], ["NovatoBL", 2310]];
  // v675 (Mickey): o Ranking mostra o rosto do treinador (o que ele criou na Aparência); os nomes de exemplo ganham um rosto fixo sorteado pelo nome
  const rkFace = (n) => { let h = 7; for (const ch of String(n)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const o = {}; C.FACE_PARTS.forEach((f, i) => { const k = (h >>> (i * 5)) % f.items.length; o[f.id] = f.id === "extra" && k % 3 ? 0 : k; }); return o; };
  function buildRanking() {
    const user = A.session(); let mine = null;
    if (user) { try { const st = JSON.parse(localStorage.getItem(A.saveKey(user)) || "null"); if (st) mine = [st.name || user, BL.teamPower(st), true, faceOk(st) ? st.avatar : null]; } catch (e) {} }
    const rows = RK_FAKE.map((r) => [r[0], r[1], false]).concat(mine ? [mine] : []).sort((a, b) => b[1] - a[1]);
    const ini = (n) => (String(n).replace(/[^A-Za-zÀ-ú0-9]/g, "").slice(0, 2) || "?").toUpperCase();
    const row = (r, i) => `<div class="rk-row${i < 3 ? " rk-p" + (i + 1) : ""}${r[2] ? " rk-me" : ""}"><b class="rk-n">${i + 1}</b><span class="rk-av has-av">${faceSVG(r[3] || rkFace(r[0]), true)}</span><span class="rk-name">${esc(r[0])}${r[2] ? "<em>você</em>" : ""}</span><span class="rk-pw">${fmt(r[1])}</span></div>`;
    const tail = ["GT", "MV", "LS", "RB", "AF", "JP", "KZ", "DN", "TH", "CM", "BR", "SV", "OL", "FE"].map((t) => `<i>${t}</i>`).join("");
    $("rkTable").innerHTML = `<div class="rk-cols"><span>#</span><span>Treinador</span><span>Poder</span></div><div class="rk-list">${rows.map(row).join("")}</div><div class="rk-tail"><p>Sem posição</p><div class="rk-heads">${tail}</div></div>`;
  }
  // v334 · Comunidade (ref do Mickey). v337: Mickey tirou chat, amigos, sequência de dias, recompensa diária e perfil público; ficaram números, clãs e Discord
  const CM_CLANS = [["Tropa do Ego", 18], ["Fortaleza Azul FC", 12], ["Os Predadores", 9], ["Linha de Impedimento", 7], ["Camisa 10 Club", 4]];
  function buildComm() {
    $("cmClans").innerHTML = CM_CLANS.map(([c, m]) => `<li data-clan><span class="cm-av cm-sh">${esc(c.replace(/[^A-Z0-9]/g, "").slice(0, 2) || c.slice(0, 2))}</span><b>${esc(c)}</b><em>${m} membros</em></li>`).join("");
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cm]"); if (!b || !b.closest("#ldComm")) return;
    const el = $("cm-" + b.dataset.cm); if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.remove("cm-flash"); void el.offsetWidth; el.classList.add("cm-flash");
  });
  $("cmClans").addEventListener("click", (e) => { if (e.target.closest("[data-clan]")) toast("Entrar em clãs chega com o servidor"); });
  $("cmDiscord").addEventListener("click", () => { if (BL.DISCORD_URL) window.open(BL.DISCORD_URL, "_blank", "noopener"); else toast("Link do Discord em breve"); }); // v336
  function buildAbout() {
    $("abAccounts").textContent = fmt(12430 + A.count());
    sbReveal();
    if ($("abRarity").dataset.done) return;
    const tot = C.RARITIES.reduce((a, r) => a + r.weight, 0);
    let from = 0;
    // v205 · raridades em barras (sem tabela): largura = chance de aparecer (raiz, para as raras aparecerem)
    const maxW = Math.max(...C.RARITIES.map((r) => r.weight));
    $("abRarity").innerHTML = C.RARITIES.map((r) => {
        const lo = from ? Math.floor(from * 186 / 100) + 1 : 6, hi = Math.floor(r.to * 186 / 100); from = r.to;
        const pct = (r.weight / tot * 100).toLocaleString("pt-BR", { maximumFractionDigits: r.weight < 1 ? 2 : 1 });
        return `<div class="rr" style="--c:${r.color}"><b>${r.name}</b><span class="rr-bar"><i style="width:${Math.max(4, Math.sqrt(r.weight / maxW) * 100)}%"></i><em>${pct}%</em></span><span class="rr-c" data-k="Pontos">${lo}–${hi}</span><span class="rr-c" data-k="Hab.">${r.skills}</span><span class="rr-c" data-k="Roubo">×${String(r.stealMult).replace(".", ",")}</span></div>`;
      }).join("");
    // v207 · as barras viram a tabela: cabeçalho + uma linha separada por raridade
    $("abRarity").insertAdjacentHTML("afterbegin", `<div class="rr rr-h"><b>Raridade</b><span>Chance</span><span class="rr-c">Pontos</span><span class="rr-c">Hab.</span><span class="rr-c">Roubo</span></div>`);
    $("abRarity").dataset.done = "1";
  }
  // v202 · Sobre: blocos aparecem ao rolar (sem IntersectionObserver, mostra tudo)
  let sbObs = null;
  function sbReveal() {
    const els = document.querySelectorAll("#ldAbout .sb-row, #ldAbout .sb-rar, #ldAbout .sb-all");
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("sb-in")); return; }
    if (!sbObs) sbObs = new IntersectionObserver((list) => list.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("sb-in"); sbObs.unobserve(en.target); } }), { root: $("landing"), threshold: 0.15 });
    els.forEach((e) => { if (!e.classList.contains("sb-in")) sbObs.observe(e); });
  }
  // v158 · Wiki: as natures saíram da dock e da aba Sobre e ficam só aqui
  function buildWiki() {
    if ($("wkNatures").dataset.done) return;
    const st = C.STATS;
    $("wkNatures").innerHTML = BL.NATURES.map((n) => `<div class="nat"><b>${esc(n.name)}</b>${n.up ? `<small class="nat-up">▲ ${C.STAT_LABEL[n.up]}</small><small class="nat-down">▼ ${C.STAT_LABEL[n.down]}</small>` : `<small class="note">Nature neutra</small>`}</div>`).join("");
    $("abNatures").innerHTML = `<thead><tr><th>Sobe / Desce</th>${st.map((k) => `<th>${C.STAT_SHORT[k]}</th>`).join("")}</tr></thead><tbody>` +
      C.NATURE_GRID.map((row, i) => `<tr><th>${C.STAT_SHORT[st[i]]}</th>${row.map((n, j) => `<td class="${i === j ? "neu" : ""}">${n}</td>`).join("")}</tr>`).join("") + "</tbody>";
    $("wkNatures").dataset.done = "1";
    wkItems("chuteira");
    wkChem();
    wkGame();
  }
  // v675 (Mickey: "atualize tudo no site") · Wiki: Partida, Modos, Formações, Bosses e Habilidades lidos do config, para não ficarem velhos
  function wkGame() {
    const R = (id) => C.RARITIES.find((r) => r.id === id) || C.RARITIES[0], n = (v) => String(v).replace(".", ",");
    $("wkHalf").textContent = C.HALF_SECONDS; $("wkMercy").textContent = C.MERCY_DIFF;
    let lo = 1; $("wkGk").textContent = "Melhora com o nível da conta. " + C.GOALKEEPER_TABLE.map((g) => { const t = `Nv ${lo}–${g.upTo + (g.upTo === 100 ? 0 : 1)}: Save ${g.save} / SB ${g.sb}`; lo = g.upTo + 2; return t; }).join(". ") + ". O SB define quanto tempo ele segura a bola.";
    const tac = (sz) => (C.TACTICS[sz] || []).map((t) => t.name).join(", ");
    $("wkModes").innerHTML = C.MAPS.map((m, i) => `<li><span>${m.mode}</span><b>${esc(m.name)}</b><p>Nv ${m.levelMin}–${m.levelMax}. Boss: ${esc(BL.CHAR_BY_ID[m.boss.charId].name)}, ${esc(m.boss.title)}.${i < 3 ? ` Táticas: ${esc(tac(m.size))}.` : i === 3 ? " Formações com estilo próprio, em pedra, papel e tesoura." : ""}</p></li>`).join("");
    $("wkDiffs").innerHTML = C.DIFFICULTIES.map((d) => `<li><span>💀</span><b>${d.name}</b><p>${d.levels ? `Adversários +${d.levels} níveis. XP e Gold ×${n(d.reward)}.` : "A dificuldade de começo."}</p></li>`).join("");
    const F = C.TACTICS[4] || [], ty = (t) => (C.FORMATION_TYPE || {})[t] || t, beats = (t) => F.find((f) => f.type === (C.FORMATION_BEATS || {})[t.type]);
    $("wkFormLead").textContent = `No 4×4 cada formação tem um estilo e funciona em pedra, papel e tesoura: quem escolhe a formação que vence o confronto ganha cerca de ${Math.round((C.FORMATION_EDGE || 0) * 100)}% de vantagem nas disputas daquela partida. A formação do adversário fica escondida até a bola rolar, e no intervalo dá para trocar.`;
    $("wkForms").innerHTML = F.map((f) => { const st = (C.STYLES || {})[f.style] || {}, b = beats(f); return `<li><span>⬡</span><b>${f.name} · ${esc(st.name || "")} <em>${ty(f.type)}${b ? ` · vence a ${b.name}` : ""}</em></b><p>${esc(st.desc || "")}</p></li>`; }).join("");
    $("wkTacts").innerHTML = [1, 2, 3].map((sz) => `<li><span>${sz}×${sz}</span><b>${(C.TACTICS[sz] || []).map((t) => esc(t.name)).join(" · ")}</b><p>${sz === 1 ? "No 1×1 o seu jogador ataca com a bola, defende sem ela e tabela com a parede." : `O número de atacantes muda com a tática: ${(C.TACTICS[sz] || []).map((t) => `${esc(t.name)} (${t.atk} no ataque)`).join(", ")}.`}</p></li>`).join("");
    $("wkBosses").innerHTML = C.MAPS.map((m, i) => { const b = m.boss, r = R(b.rarity);
      return `<li style="--rc:${r.color}"><span class="wk-bb" style="background-position:${(i % 6) * 20}% ${i < 6 ? 0 : 100}%"></span><b>${esc(BL.CHAR_BY_ID[b.charId].name)} <em style="color:${r.color}">${r.name} · Nv ${b.level}</em></b><p>${esc(b.title)}. Arena ${esc(b.arena.name)}, no ${esc(m.name.replace(/ · .*/, ""))} (${m.mode}). Na arena: Boss +${Math.round(b.arena.bossBuff * 100)}%, seu time −${Math.round(b.arena.userDebuff * 100)}%.</p></li>`; }).join("");
    const unl = (id) => { const lv = (C.SKILL_UNLOCK_LV || {})[id], cl = (C.SKILL_UNLOCK_CLEAR || {})[id]; if (lv === 1) return "Liberada desde o começo."; if (lv) return `Abre no Nv ${lv} da conta.`; if (cl) return `Abre vencendo o Boss do Mapa ${cl[0] + 1} no ${(C.DIFFICULTIES[cl[1]] || {}).name}.`; return ""; };
    $("wkSkills").innerHTML = Object.entries(C.SKILL_DEF).map(([id, k]) => ({ id, k, r: R(k.rar) })).sort((a, b) => C.RARITIES.indexOf(a.r) - C.RARITIES.indexOf(b.r)).map(({ id, k, r }) => `<li style="--rc:${r.color}"><span class="wk-sk">${skIco(id, 52).replace("<span", "<i").replace("</span>", "</i>")}</span><b>${esc(k.name)} <em style="color:${r.color}">${r.name} · recarga ${k.cd} s</em></b><p>${esc(k.desc)}. <small class="wk-w">${unl(id)}</small></p></li>`).join("");
  }
  // v674 (Mickey) · Wiki: aba Química, montada de C.CHEM e C.EGO_CLASH (mesma regra de nomes do motor: palavra do id ou do nome)
  function wkChem() {
    const norm = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/);
    const all = Object.values(BL.CHAR_BY_ID), find = (l, k) => l.find((c) => norm(`${c.id} ${c.name}`).includes(k));
    const who = (k) => { const c = find(BL.CHARACTERS, k) || find(all, k); return { n: c ? c.name : k.charAt(0).toUpperCase() + k.slice(1), on: !!c && BL.CHARACTERS.includes(c), id: c && c.id }; };
    const many = (ks) => (Array.isArray(ks) ? ks : [ks]).map(who);
    const nm = (l) => l.map((w) => `${esc(w.n)}${w.on ? "" : " <small class=\"wk-soon\">em breve</small>"}`).join(" ou ");
    const plain = (l) => l.map((w) => w.n).join(" ou ");
    const S = (k) => C.STAT_LABEL[k], P = (p) => `${Math.round(p * 100)}%`, pl = (n, a, b) => `${n} ${n === 1 ? a : b}`;
    const act = (r, to) => ({ drib: `fizer ${pl(r.n, "drible", "dribles")}`, steal: `roubar ${pl(r.n, "bola", "bolas")}`, shot: `chutar ${pl(r.n, "vez", "vezes")} ao gol`, ast: `der ${pl(r.n, "assistência", "assistências")}`, pass: `acertar ${pl(r.n, "passe", "passes")} para ${to}` })[r.act] || r.act;
    const cond = (g, a, b) => ({ goal: "fizer o 1º gol do time", goalSolo: `fizer o 1º gol sem passe do outro`, dribGoal: `fizer ${g.n} dribles e 1 gol`, dribAst: `fizer ${g.n} dribles e der 1 assistência`, steal: `chegar a ${g.n} roubos`, ast: `der ${pl(g.n, "assistência", "assistências")}`, stealVsGoal: `${a} chegar a ${g.n} roubos antes de ${b} marcar um gol` })[g.cond] || g.cond;
    // v678 (Mickey): ícone = os dois personagens se encarando (sprite do card; sem sprite, as iniciais)
    const WK_FACE_L = new Set(["mickey", "riq", "ratoworld", "btter", "seishiro-nagi", "nagi", "teddy-knight", "shoei-barou", "barou", "hyoma-chigiri", "chigiri"]); // sprites de card que olham para a esquerda
    const face = (w, side) => { const sp = w.id && C.SPRITES[w.id]; return sp ? `<b class="${side}${WK_FACE_L.has(w.id) ? " wk-fl" : ""}"><img src="${sp.card}" alt=""></b>` : `<i class="${side}">${esc(w.n.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase())}</i>`; };
    const vs = (a, b) => face(a, "wk-vl") + face(b, "wk-vr");
    document.querySelectorAll("[data-wk-vs]").forEach((el) => { const [a, b] = el.dataset.wkVs.split(","); el.innerHTML = vs(who(a), who(b)); });
    const sortOn = (l) => l.map((x, i) => ({ ...x, i })).sort((x, y) => (y.on - x.on) || (x.i - y.i));
    const R = sortOn((C.CHEM || []).map((r) => { const f = many(r.from), t = many(r.to); return { f, t, r, on: f.every((w) => w.on) && t.every((w) => w.on) }; }));
    $("wkChemList").innerHTML = R.map(({ f, t, r }) => `<li><span class="wk-vs">${vs(f[0], t[0])}</span><b>${nm(f)} → ${nm(t)}</b><p>Se ${esc(plain(f))} ${esc(act(r, plain(t)))}, ${r.act === "pass" ? "ele" : esc(plain(t))} ganha <strong>+${P(r.p)} de ${S(r.k)}</strong>.</p></li>`).join("");
    const E = sortOn((C.EGO_CLASH || []).map((g) => { const a = who(g.a), b = who(g.b); return { a, b, g, on: a.on && b.on }; }));
    $("wkEgoList").innerHTML = E.map(({ a, b, g }) => { const c = cond(g, a.n, b.n), lead = g.cond === "stealVsGoal" ? `Se ${c}` : g.only === "a" ? `Se ${a.n} ${c}` : `Quem ${c} primeiro`;
      return `<li><span class="wk-vs ego">${vs(a, b)}</span><b>${nm([a])} × ${nm([b])}</b><p>${esc(lead)}, rouba <strong>${P(g.p)} de ${S(g.k)}</strong> do outro.${g.only === "a" ? ` Só ${esc(a.n)} pode roubar.` : ""}</p></li>`; }).join("");
  }
  // v546 · Wiki: categoria Itens, montada dos dados do jogo (o que cada item faz)
  const WK_ICATS = [["chuteira", "👟 Chuteiras"], ["caneleira", "🦵 Caneleiras"], ["camisa", "👕 Camisas"], ["personagem", "⭐ Personagem"], ["treinador", "📋 Treinador"], ["energia", "💧 Energia"], ["roubo", "📄 Propostas e contratos"], ["ficha", "🎟️ Fichas e especiais"], ["wildcard", "🌱 Materiais do Wildcard"]];
  function wkItemList(cat) {
    const bon = (b) => Object.entries(b || {}).map(([k, v]) => `+${v} ${C.STAT_LABEL[k]}`).join(", ");
    const sup = (f) => Object.entries(C.SUPPLIES).filter(([, v]) => f(v)).map(([id, v]) => ({ art: shopArt(id, v.icon), name: v.name, r: v.rarity, fx: v.desc, d: v.lore, w: v.where }));
    if (["chuteira", "caneleira", "camisa"].includes(cat)) return BL.ITEMS.filter((i) => i.slot === cat).map((i) => ({ art: BL.itemSvg(i), name: i.name, r: i.rarity, fx: [bon(i.bonus), i.ef].filter(Boolean).join(" · "), d: i.desc }));
    if (cat === "personagem") return BL.CHAR_ITEM_LIST.map((i) => ({ art: BL.itemSvg(i), name: i.name, r: i.rarity || "lendario", fx: i.ef, d: i.desc, w: `Só para ${i.who}, Épico ou acima. Chance mínima nas fichas da Forja e no Boss.` }));
    if (cat === "treinador") return BL.MGR_ITEMS.map((i) => ({ art: BL.itemSvg(i), name: i.name, r: i.rarity, fx: Object.entries(i.fx).map(([k, v]) => BL.mgrFxTxt(k, v)).join(", "), d: i.desc, w: "Cai em baús. Vale para o time inteiro." }));
    if (cat === "energia") return Object.entries(C.CONSUMABLES).map(([id, v]) => ({ art: shopArt(id, v.icon), name: v.name, r: "comum", fx: v.desc, w: v.chest ? "Só cai em baús." : `Loja de Gold (${v.cost} Gold).` }));
    if (cat === "roubo") return sup((v) => v.cat === "roubo");
    if (cat === "ficha") return sup((v) => v.cat === "ficha" || v.cat === "nivel");
    return Object.entries(C.WC_FARM.crops).map(([id, v]) => ({ art: BL.wcArt(id), name: v.name, r: v.rarity, fx: v.desc, w: "Fazenda do Wildcard. Usado na Bancada para fabricar contratos." }));
  }
  function wkItems(cat) {
    $("wkItemCats").innerHTML = WK_ICATS.map(([k, t]) => `<button type="button" data-wk-icat="${k}" class="${k === cat ? "on" : ""}">${t}</button>`).join("");
    const R = (r) => C.RARITIES.find((x) => x.id === r) || C.RARITIES[0];
    $("wkItems").innerHTML = wkItemList(cat).map((it, i) => { const r = R(it.r); return `<div class="wk-it" style="--rc:${r.color};--i:${Math.min(i, 14)}"><i>${it.art || "🎁"}</i><div><b>${esc(it.name)} <small>${r.name}</small></b>${it.fx ? `<p class="wk-fx">${esc(it.fx)}</p>` : ""}${it.d ? `<p>${esc(it.d)}</p>` : ""}${it.w ? `<p class="wk-w">Onde: ${esc(it.w)}</p>` : ""}</div></div>`; }).join("");
  }
  // v203 · abas da Wiki
  function wkTab(tab) {
    document.querySelectorAll("[data-wk-tab]").forEach((b) => b.classList.toggle("on", b.dataset.wkTab === tab));
    document.querySelectorAll("[data-wk-panel]").forEach((p) => { p.hidden = p.dataset.wkPanel !== tab; });
    document.querySelectorAll(`[data-wk-panel="${tab}"] .wk-list li, [data-wk-panel="${tab}"] .rr, [data-wk-panel="${tab}"] .nat`).forEach((el, i) => { el.style.setProperty("--i", Math.min(i, 14)); el.classList.remove("wk-pop"); void el.offsetWidth; el.classList.add("wk-pop"); });
  }
  $("wkItemCats").addEventListener("click", (e) => { const b = e.target.closest("[data-wk-icat]"); if (b) wkItems(b.dataset.wkIcat); });
  document.querySelector(".wk-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-wk-tab]"); if (b) wkTab(b.dataset.wkTab); });
  $("ldAuthClose").onclick = () => { $("ldAuth").hidden = true; };
  $("ldForm").onsubmit = (e) => {
    e.preventDefault();
    const u = $("ldUser").value, p = $("ldPass").value;
    if (ldMode === "create" && p !== $("ldPass2").value) { $("ldErr").textContent = "As senhas não são iguais."; return; }
    const r = ldMode === "create" ? A.create(u, p) : A.login(u, p);
    if (!r.ok) { $("ldErr").textContent = r.msg; return; }
    $("ldPass").value = $("ldPass2").value = "";
    enterAccount(r.user);
  };
  function sleepExit() { // v291: sai para a página inicial sem deslogar; a soneca é paga ao entrar de novo
    if (G.state) G.save();
    stopLoop(); clearTimeout(G.nextT); closeModal();
    G.state = null; G.match = null; music();
    $("ldWelcome").dataset.fixed = "1"; $("ldWelcome").textContent = `Modo Soneca ativo para ${G.account}. Entre de novo quando quiser receber o XP.`; showLanding();
  }
  function logout() {
    if (G.state) G.save();
    stopLoop(); clearTimeout(G.nextT); closeModal();
    G.account = null; G.state = null; G.match = null; A.logout(); music();
    $("ldWelcome").dataset.fixed = ""; showLanding();
  }
  // contadores de mentira (sem servidor ainda)
  let online = 1284;
  setInterval(() => { online = Math.max(900, online + Math.round((Math.random() - 0.5) * 24)); $("ldOnline").textContent = fmt(online); document.querySelectorAll(".js-online").forEach((e) => (e.textContent = fmt(online))); }, 4000);
  // saves de antes das contas viram uma conta sem senha, e o jogador já entra nela
  const migrated = A.migrateLegacy();
  if (migrated) { A.setSession(migrated); $("ldWelcome").dataset.fixed = "1"; $("ldWelcome").textContent = `Seu jogo salvo agora está na conta "${migrated}". Clique em Continuar para jogar.`; }
  showLanding();
  BL.UI = { renderAll, toast };
})();
