// BL PROJECT IDLE · v626 (Mickey, refs "Mercado entre treinadores") · RMT: venda de jogadores e itens por Pix (reais) entre treinadores
// Sem servidor ainda: tudo em localStorage[C.RMT.key], igual para as contas do navegador, e o Pix é de TESTE (botão "Confirmar pagamento de teste").
// Online depois: só read/write e o passo do pagamento mudam. Fluxo: anunciar (jogador/itens saem da conta, em custódia) → Comprar com Pix reserva
// por C.RMT.reserve min → pagamento confirmado → vai para o Cofre RMT do comprador; o vendedor recebe o valor menos a taxa, liberado após C.RMT.hold dias.
window.BL = window.BL || {};
(function () {
  const C = BL.CONFIG, G = BL.Game, R = () => C.RMT, DAY = 864e5, S = C.STATS;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const brl = (v) => "R$ " + (Math.round((v || 0) * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const brlK = (v) => (v >= 1000 ? "R$ " + (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : brl(v));
  const toast = (t, c) => BL.UI && BL.UI.toast(t, c);
  const me = () => G.mkMe(), myName = () => G.mkName();
  const spr = (id) => (C.SPRITES[id] ? `<img class="spr" src="${C.SPRITES[id].card}" alt="">` : "");
  const when = (t) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  function left(ms) { ms = Math.max(0, ms); const s = Math.floor(ms / 1000), m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; }
  const ivTot = (p) => S.reduce((a, k) => a + (p.stats[k] || 0), 0);
  const ivMax = () => C.STAT_MAX * S.length;

  // ---------- dados ----------
  function read() { let m = null; try { m = JSON.parse(localStorage.getItem(R().key) || "null"); } catch (e) {} m = m && typeof m === "object" ? m : {};
    m.seq = m.seq || 0; m.list = m.list || []; m.orders = m.orders || {}; m.vault = m.vault || {}; m.wallet = m.wallet || {}; return m; }
  function write(m) { try { localStorage.setItem(R().key, JSON.stringify(m)); } catch (e) {} }
  const wal = (m, acc) => (m.wallet[acc] = m.wallet[acc] || { moves: [], saques: [], pix: "" });
  function settle(m) { const now = Date.now(); let n = 0; // reservas vencidas voltam para a vitrine
    m.list.forEach((l) => { if (l.status === "reserved" && l.until <= now) { const o = (m.orders[l.buyer] || []).find((x) => x.lid === l.id && x.status === "reserved"); if (o) o.status = "expired"; l.status = "open"; l.buyer = null; l.until = 0; n++; } });
    return n; }
  function sync() { const m = read(); if (settle(m)) write(m); return m; }
  function money(m, acc) { const w = wal(m, acc), now = Date.now(); let pend = 0, rel = 0, adj = 0;
    w.moves.forEach((x) => { if (x.type === "venda") { if (x.rel > now) pend += x.net; else rel += x.net; } else if (x.type === "ajuste") adj += x.amt; });
    const out = w.saques.reduce((a, x) => a + x.amt, 0), wait = w.saques.filter((x) => x.status !== "pago").reduce((a, x) => a + x.amt, 0), paid = out - wait;
    return { pend, avail: Math.max(0, rel + adj - out), wait, paid, adj }; }

  // ---------- anunciar ----------
  function take(o) { const s = G.state; // tira da conta (custódia), igual à Casa de Leilões
    if (o.kind === "player") { const p = s.roster.find((x) => x.uid === o.ref); if (!p) return { err: "Jogador não encontrado." };
      if (G.mkBusy(p.uid)) return { err: `${p.name} está em uso (time, reservas, Wildcard, Expedição ou Boss).` };
      if (s.roster.length <= 4) return { err: "Você precisa ficar com pelo menos 4 jogadores." };
      s.roster = s.roster.filter((x) => x !== p); (s.teamSets || []).forEach((t, i) => { if (Array.isArray(t)) s.teamSets[i] = t.filter((u) => u !== p.uid); });
      if (Array.isArray(s.bossTeam)) s.bossTeam = s.bossTeam.filter((u) => u !== p.uid); if (s.trainSides) ["a", "b"].forEach((k) => { if (Array.isArray(s.trainSides[k])) s.trainSides[k] = s.trainSides[k].filter((u) => u !== p.uid); });
      return { data: JSON.parse(JSON.stringify(p)), name: p.name, key: "p:" + p.charId, qty: 1 }; }
    const g = G.mkGoods().items.find((x) => x.key === o.ref), qty = Math.floor(+o.qty || 1); if (!g || !(qty >= 1) || qty > g.n) return { err: "Você não tem essa quantidade." };
    const [k, id] = o.ref.split(":"); if (k === "q") for (let i = 0; i < qty; i++) s.inventory.splice(s.inventory.indexOf(id), 1); else { const c = G.cons(); c[id] -= qty; if (s.stealArm === id && !c[id]) s.stealArm = null; }
    return { item: o.ref, name: g.name, key: o.ref, qty, rarity: g.rarity }; }
  function give(r) { const s = G.state, c = G.cons();
    if (r.kind === "player" && r.data) { const p = JSON.parse(JSON.stringify(r.data)); if (s.roster.some((x) => x.uid === p.uid)) p.uid = "rm" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); s.roster.push(p); }
    else if (r.item) { const [k, id] = r.item.split(":"); if (k === "q") for (let i = 0; i < (r.qty || 1); i++) s.inventory.push(id); else c[id] = (c[id] || 0) + (r.qty || 1); } }
  function post(o) { const m = sync(), k = me(), price = Math.round((+String(o.price || "").replace(",", ".") || 0) * 100) / 100;
    if (m.list.filter((l) => l.seller === k && (l.status === "open" || l.status === "reserved")).length >= R().maxListings) return { ok: false, msg: `Você já tem ${R().maxListings} anúncios ativos.` };
    if (!(price >= R().min && price <= R().max)) return { ok: false, msg: `O preço precisa ficar entre ${brl(R().min)} e ${brl(R().max)}.` };
    const t = take(o); if (t.err) return { ok: false, msg: t.err };
    m.list.push({ id: "R" + ++m.seq, seller: k, sellerName: myName(), kind: o.kind, price, start: Date.now(), status: "open", ...t }); write(m); G.save(); G.emit("resources"); G.emit("cons"); G.emit("roster");
    return { ok: true, msg: `${t.qty > 1 ? t.qty + "× " : ""}${t.name} anunciado por ${brl(price)}. Fica guardado em custódia até vender.` }; }
  function cancel(id) { const m = sync(), l = m.list.find((x) => x.id === id); if (!l || l.seller !== me() || l.status !== "open") return { ok: false, msg: l && l.status === "reserved" ? "Alguém reservou esse anúncio. Espere o fim da reserva." : "Não dá para cancelar esse anúncio." };
    l.status = "cancelled"; l.closed = Date.now(); give(l); write(m); G.save(); G.emit("resources"); G.emit("cons"); G.emit("roster"); return { ok: true, msg: `${l.name} voltou para você.` }; }

  // ---------- comprar ----------
  function reserve(id) { const m = sync(), l = m.list.find((x) => x.id === id), k = me();
    if (!l || l.status !== "open") return { ok: false, msg: l && l.status === "reserved" && l.buyer === k ? "Você já reservou esse anúncio." : "Esse anúncio não está mais disponível." };
    if (l.seller === k) return { ok: false, msg: "Esse anúncio é seu." };
    if ((m.orders[k] || []).some((o) => o.status === "reserved")) return { ok: false, msg: "Termine ou cancele a sua reserva atual primeiro." };
    l.status = "reserved"; l.buyer = k; l.buyerName = myName(); l.until = Date.now() + R().reserve * 60000;
    (m.orders[k] = m.orders[k] || []).unshift({ lid: l.id, name: l.name, qty: l.qty, kind: l.kind, price: l.price, seller: l.sellerName, t: Date.now(), until: l.until, status: "reserved" }); write(m);
    return { ok: true, msg: `Reservado só para você por ${R().reserve} min. Pague para receber.` }; }
  function pay(id) { const m = sync(), l = m.list.find((x) => x.id === id), k = me(), o = (m.orders[k] || []).find((x) => x.lid === id && x.status === "reserved");
    if (!l || !o || l.status !== "reserved" || l.buyer !== k) return { ok: false, msg: "A reserva acabou. Reserve de novo." };
    const now = Date.now(), fee = Math.round(l.price * R().fee * 100) / 100;
    l.status = "sold"; l.closed = now; o.status = "paid"; o.paidAt = now;
    (m.vault[k] = m.vault[k] || []).push({ lid: l.id, kind: l.kind, data: l.data, item: l.item, qty: l.qty, name: l.name, t: now });
    wal(m, l.seller).moves.unshift({ t: now, type: "venda", name: l.name, qty: l.qty, amt: l.price, fee, net: Math.round((l.price - fee) * 100) / 100, rel: now + R().hold * DAY, buyer: myName() });
    write(m); return { ok: true, msg: `Pagamento confirmado! ${l.name} está no seu Cofre RMT.` }; }
  function unreserve(id) { const m = sync(), l = m.list.find((x) => x.id === id), k = me(), o = (m.orders[k] || []).find((x) => x.lid === id && x.status === "reserved");
    if (o) o.status = "cancelled"; if (l && l.status === "reserved" && l.buyer === k) { l.status = "open"; l.buyer = null; l.until = 0; } write(m); return { ok: true, msg: "Reserva cancelada." }; }
  function claim(lid) { const m = sync(), box = m.vault[me()] || []; let n = 0;
    m.vault[me()] = box.filter((r) => { if (lid && r.lid !== lid) return true; give(r); n++; return false; });
    if (n) { write(m); G.save(); G.emit("resources"); G.emit("cons"); G.emit("roster"); } return { ok: !!n, msg: n ? `${n} entrega(s) recebida(s).` : "Nada para receber." }; }

  // ---------- carteira ----------
  function setPix(v) { const m = sync(); wal(m, me()).pix = String(v || "").trim().slice(0, 80); write(m); return { ok: true, msg: "Chave Pix salva." }; }
  function saque(v) { const m = sync(), w = wal(m, me()), amt = Math.round((+String(v || "").replace(",", ".") || 0) * 100) / 100, mo = money(m, me());
    if (!w.pix) return { ok: false, msg: "Cadastre a sua chave Pix primeiro." };
    if (amt < R().saqueMin) return { ok: false, msg: `Saque mínimo: ${brl(R().saqueMin)}.` };
    if (amt > mo.avail + 1e-9) return { ok: false, msg: "Valor maior que o saldo disponível." };
    w.saques.unshift({ t: Date.now(), amt, pix: w.pix, status: "aguardando" }); write(m); return { ok: true, msg: `Saque de ${brl(amt)} pedido. A equipe processa em até ${R().saqueDays} dias úteis.` }; }

  // ---------- tela ----------
  const ui = { tab: "mercado", cat: "player", q: "", pmin: "", pmax: "", lmin: "", lmax: "", rar: "", shiny: "", pos: "", sort: "novos", scat: "player", sq: "", sheet: "", price: {}, qty: {}, pix: "", saq: "" };
  const TABS = [["mercado", "Mercado"], ["vender", "Vender"], ["meus", "Meus anúncios"], ["compras", "Compras e entregas"], ["carteira", "Carteira"]];
  function itemArt(ref) { const [k, id] = String(ref || "").split(":"), it = k === "q" ? BL.anyItem(id) : C.CONSUMABLES[id] || C.SUPPLIES[id];
    if (BL.IT2 && BL.IT2[id] != null) return BL.it2Art(id); if (BL.WC_SPR && BL.WC_SPR[id] != null && BL.wcArt) return BL.wcArt(id);
    if (k !== "q") return `<img class="rm-px" src="img/loja/${id}.png?v=${BL.BUILD}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'rm-emo',textContent:'${(it && it.icon) || "📦"}'}))">`;
    return BL.itemSvg(it) || `<span class="rm-emo">🎁</span>`; }
  const art = (l) => (l.kind === "player" && l.data ? `<span class="rm-spr">${spr(l.data.charId)}</span>` : `<span class="rm-it">${itemArt(l.item || l.key)}</span>`);
  const posOf = (p) => C.POSITIONS.find((x) => x.id === p.position) || { short: "", name: "" };
  function stats3(l) { if (l.kind === "player" && l.data) { const p = l.data, r = BL.rarity(p.rarity); return `<div class="rm-st"><span><small>IV total</small><b>${ivTot(p)}<em>/${ivMax()}</em></b></span><span><small>Nature</small><b>${esc(p.nature)}</b></span><span><small>Raridade</small><b style="color:${r.color}">${esc(r.name)}</b></span></div>`; }
    const [k, id] = String(l.item || l.key).split(":"), it = (k === "q" ? BL.anyItem(id) : C.CONSUMABLES[id] || C.SUPPLIES[id]) || {}, r = BL.rarity(it.rarity || l.rarity || "comum");
    return `<div class="rm-st"><span><small>Quantidade</small><b>${l.qty || 1}</b></span><span><small>Tipo</small><b>${k === "q" ? "Equipamento" : "Consumível"}</b></span><span><small>Raridade</small><b style="color:${r.color}">${esc(r.name)}</b></span></div>`; }
  function card(l, foot) { const p = l.kind === "player" && l.data; return `<div class="rm-card ${p && p.shiny ? "shiny" : ""}">${p && p.shiny ? `<em class="rm-shy">✦ Shiny</em>` : ""}<div class="rm-art">${art(l)}</div>
      <div class="rm-nm"><b>${l.qty > 1 ? l.qty + "× " : ""}${esc(l.name)}</b>${p ? `<small>NV. ${p.level}</small>` : ""}</div>${p ? `<div class="rm-tags"><span>${esc(posOf(p).name)}</span>${p.shiny ? "<span class='gold'>Shiny</span>" : ""}</div>` : ""}${stats3(l)}${foot}</div>`; }
  function marketHtml(m) { const k = me(), open = m.list.filter((l) => l.status === "open" || (l.status === "reserved")), sold = m.list.filter((l) => l.status === "sold");
    let L = open.filter((l) => (ui.cat === "player") === (l.kind === "player")); const q = ui.q.toLowerCase();
    if (q) L = L.filter((l) => l.name.toLowerCase().includes(q) || (l.data && String(l.data.nature).toLowerCase().includes(q)));
    if (ui.pmin) L = L.filter((l) => l.price >= +ui.pmin); if (ui.pmax) L = L.filter((l) => l.price <= +ui.pmax);
    if (ui.cat === "player") { if (ui.lmin) L = L.filter((l) => l.data.level >= +ui.lmin); if (ui.lmax) L = L.filter((l) => l.data.level <= +ui.lmax); if (ui.rar) L = L.filter((l) => l.data.rarity === ui.rar); if (ui.shiny) L = L.filter((l) => !!l.data.shiny === (ui.shiny === "sim")); if (ui.pos) L = L.filter((l) => l.data.position === ui.pos); }
    L.sort((a, b) => ui.sort === "barato" ? a.price - b.price : ui.sort === "caro" ? b.price - a.price : ui.sort === "nivel" ? ((b.data || {}).level || 0) - ((a.data || {}).level || 0) : b.start - a.start);
    const sel = (id, opts, v) => `<select id="${id}">${opts.map(([a, t]) => `<option value="${a}" ${v === a ? "selected" : ""}>${t}</option>`).join("")}</select>`;
    return `<section class="rm-hero"><div><small>Vitrine entre treinadores</small><h3>Escolha seu próximo reforço</h3><p>Compare status, confira a ficha completa e reserve com Pix protegido.</p></div>
        <div class="rm-kpis"><span><b>${open.length}</b>anúncios</span><span><b>${open.filter((l) => l.data && l.data.shiny).length}</b>shiny</span><span><b>${brlK(sold.reduce((a, l) => a + l.price, 0))}</b>transacionado</span></div></section>
      <div class="rm-cats">${[["player", "Jogadores", open.filter((l) => l.kind === "player").length], ["item", "Itens", open.filter((l) => l.kind !== "player").length]].map(([v, t, n]) => `<button type="button" class="${ui.cat === v ? "on" : ""}" data-rm-cat="${v}">${t} <i>${n}</i></button>`).join("")}</div>
      <section class="rm-filt"><label class="w2"><small>Nome ou nature</small><input id="rmQ" placeholder="Buscar" value="${esc(ui.q)}"></label><label><small>Preço mín.</small><input id="rmPmin" inputmode="decimal" placeholder="R$" value="${esc(ui.pmin)}"></label><label><small>Preço máx.</small><input id="rmPmax" inputmode="decimal" placeholder="R$" value="${esc(ui.pmax)}"></label>
        ${ui.cat === "player" ? `<label><small>Nível mín.</small><input id="rmLmin" inputmode="numeric" placeholder="1" value="${esc(ui.lmin)}"></label><label><small>Nível máx.</small><input id="rmLmax" inputmode="numeric" placeholder="${C.PLAYER_MAX_LEVEL}" value="${esc(ui.lmax)}"></label>
        <label><small>Raridade</small>${sel("rmRar", [["", "Todas"], ...C.RARITIES.map((r) => [r.id, r.name])], ui.rar)}</label><label><small>Shiny</small>${sel("rmShiny", [["", "Todos"], ["sim", "Só shiny"], ["nao", "Sem shiny"]], ui.shiny)}</label><label><small>Posição</small>${sel("rmPos", [["", "Todas"], ...C.POSITIONS.map((p) => [p.id, p.name])], ui.pos)}</label>` : ""}
        <label><small>Ordenar</small>${sel("rmSort", [["novos", "Mais recentes"], ["barato", "Menor preço"], ["caro", "Maior preço"], ["nivel", "Maior nível"]], ui.sort)}</label><button type="button" class="rm-btn" data-rm-clear>Limpar</button></section>
      <div class="rm-grid">${L.map((l) => { const mine = l.seller === k, res = l.status === "reserved";
        return card(l, `<div class="rm-sell"><div><small>Vendedor</small><b>${esc(l.sellerName)}${mine ? " <em>você</em>" : ""}</b></div><strong>${brl(l.price)}</strong></div>
          <div class="rm-act"><button type="button" class="rm-btn" data-rm-sheet="ficha|${l.id}">Ver ficha</button>${mine ? `<button type="button" class="rm-btn" data-rm-tab="meus">Seu anúncio</button>` : res ? `<button type="button" class="rm-btn go" ${l.buyer === k ? `data-rm-sheet="pay|${l.id}"` : "disabled"}>${l.buyer === k ? "Pagar reserva" : "Reservado"}</button>` : `<button type="button" class="rm-btn go" data-rm-res="${l.id}">Comprar com Pix</button>`}</div>`); }).join("") || `<div class="rm-empty">🏷️<p>${open.length ? "Nada com esses filtros." : "Nenhum anúncio ainda. Quando um treinador anunciar, aparece aqui."}</p></div>`}</div>`; }
  function sellHtml() { const g = G.mkGoods(), q = ui.sq.toLowerCase();
    const ps = g.players.filter((x) => !q || x.p.name.toLowerCase().includes(q)).sort((a, b) => a.busy - b.busy || b.p.level - a.p.level), its = g.items.filter((x) => !q || x.name.toLowerCase().includes(q));
    const n = g.players.filter((x) => !x.busy).length + g.items.length, foot = (ref, kind, max) => `<label class="rm-pin"><small>Preço em reais</small><input data-rm-price="${esc(ref)}" inputmode="decimal" placeholder="${brl(R().min).replace("R$ ", "")}" value="${esc(ui.price[ref] || "")}"></label>
        ${max > 1 ? `<label class="rm-pin"><small>Quantidade (de ${max})</small><input data-rm-qty="${esc(ref)}" inputmode="numeric" value="${esc(ui.qty[ref] || 1)}"></label>` : ""}
        <p class="rm-get" data-rm-get="${esc(ref)}">${getTxt(ref)}</p><div class="rm-act"><button type="button" class="rm-btn go" data-rm-post="${kind}|${esc(ref)}">Anunciar</button></div>`;
    return `<section class="rm-head"><div><h3>Escolha o que vender</h3><p>Preço entre ${brl(R().min)} e ${brl(R().max)}. A taxa de ${Math.round(R().fee * 100)}% sai do valor da venda. O anúncio fica em custódia até vender ou você cancelar.</p></div><span class="rm-pill">${n} negociáveis</span></section>
      <div class="rm-cats">${[["player", "Jogadores"], ["item", "Itens"]].map(([v, t]) => `<button type="button" class="${ui.scat === v ? "on" : ""}" data-rm-scat="${v}">${t}</button>`).join("")}<label class="rm-q"><span>🔍</span><input id="rmSq" placeholder="Buscar" value="${esc(ui.sq)}"></label></div>
      <div class="rm-grid">${ui.scat === "player" ? ps.map(({ p, busy }) => card({ kind: "player", data: p, name: p.name, qty: 1 }, busy ? `<p class="rm-lock">Este jogador está em uso (time, reservas, Wildcard, Expedição ou Boss). Tire ele de lá para anunciar.</p>` : foot(p.uid, "player", 1))).join("")
        : its.map((x) => card({ kind: "item", item: x.key, key: x.key, name: x.name, qty: x.n, rarity: x.rarity }, foot(x.key, "item", x.n))).join("") || `<div class="rm-empty">🎒<p>Nenhum item na Mochila para vender.</p></div>`}</div>`; }
  function getTxt(ref) { const v = +String(ui.price[ref] || "").replace(",", ".") || 0; return v ? `Você recebe ${brl(v - Math.round(v * R().fee * 100) / 100)} <small>(taxa ${brl(Math.round(v * R().fee * 100) / 100)})</small>` : "Informe o preço para ver quanto você recebe."; }
  function mineHtml(m) { const L = m.list.filter((l) => l.seller === me()).sort((a, b) => (a.status === "open" || a.status === "reserved" ? 0 : 1) - (b.status === "open" || b.status === "reserved" ? 0 : 1) || b.start - a.start), act = L.filter((l) => l.status === "open" || l.status === "reserved").length;
    const st = { open: ["À venda", "on"], reserved: ["Reservado", "res"], sold: ["Vendido", "ok"], cancelled: ["Cancelado", ""] };
    return `<section class="rm-head"><div><h3>Meus anúncios</h3><p>Os anúncios ficam em custódia. Cancelar devolve o jogador ou os itens na hora.</p></div><span class="rm-pill">${act} de ${R().maxListings} ativos</span></section>
      <div class="rm-rows">${L.map((l) => `<div class="rm-row"><div class="rm-rart">${art(l)}</div><div class="rm-ri"><b>${l.qty > 1 ? l.qty + "× " : ""}${esc(l.name)}</b><small>Anunciado em ${when(l.start)}${l.status === "reserved" ? ` · reservado por ${esc(l.buyerName)}` : ""}</small></div>
        <span class="rm-badge ${st[l.status][1]}">${st[l.status][0]}</span><strong>${brl(l.price)}</strong>${l.status === "open" ? `<button type="button" class="rm-btn" data-rm-cancel="${l.id}">Cancelar</button>` : "<i></i>"}</div>`).join("") || `<div class="rm-empty">📋<p>Você ainda não anunciou nada. Use a aba Vender.</p></div>`}</div>`; }
  function buysHtml(m) { const V = m.vault[me()] || [], O = m.orders[me()] || [], st = { reserved: ["Aguardando pagamento", "res"], paid: ["Concluída", "ok"], expired: ["Reserva expirou", ""], cancelled: ["Cancelada", ""] };
    return `<section class="rm-head"><div><small class="rm-k">Suas compras</small><h3>Pedidos e Cofre RMT</h3><p>Acompanhe o pagamento e receba o que já está pronto.</p></div><span class="rm-pill">${V.length} para receber</span></section>
      <section class="rm-panel"><header><span class="rm-pi">◈</span><div><small>Suas entregas</small><h4>Cofre RMT</h4><p>Compras concluídas ficam guardadas aqui até você receber.</p></div><b class="rm-n">${V.length}</b></header>
        ${V.length ? `<div class="rm-rows">${V.map((r) => `<div class="rm-row"><div class="rm-rart">${art(r)}</div><div class="rm-ri"><b>${r.qty > 1 ? r.qty + "× " : ""}${esc(r.name)}</b><small>Pago em ${when(r.t)}</small></div><span class="rm-badge ok">Pronto</span><i></i><button type="button" class="rm-btn go" data-rm-claim="${r.lid}">Receber</button></div>`).join("")}</div>${V.length > 1 ? `<div class="rm-act end"><button type="button" class="rm-btn go" data-rm-claim="">Receber tudo</button></div>` : ""}`
          : `<div class="rm-empty">◇<p><b>Seu Cofre RMT está vazio</b><br>Quando uma compra for confirmada, ela aparece aqui.</p><button type="button" class="rm-btn go" data-rm-tab="mercado">Explorar o mercado</button></div>`}</section>
      <section class="rm-panel"><header><span class="rm-pi">◷</span><div><small>Acompanhamento</small><h4>Meus pedidos</h4><p>Reservas em andamento, pagamentos confirmados e compras concluídas.</p></div><b class="rm-n">${O.length}</b></header>
        ${O.length ? `<div class="rm-rows">${O.slice(0, 40).map((o) => `<div class="rm-row"><div class="rm-ri"><b>${o.qty > 1 ? o.qty + "× " : ""}${esc(o.name)}</b><small>${when(o.t)} · vendedor ${esc(o.seller)}</small></div><span class="rm-badge ${st[o.status][1]}">${st[o.status][0]}${o.status === "reserved" ? ` · <span data-rm-end="${o.until}">${left(o.until - Date.now())}</span>` : ""}</span><strong>${brl(o.price)}</strong>${o.status === "reserved" ? `<button type="button" class="rm-btn go" data-rm-sheet="pay|${o.lid}">Pagar</button>` : "<i></i>"}</div>`).join("")}</div>`
          : `<div class="rm-empty">◷<p><b>Você ainda não fez uma compra</b><br>Reserve um anúncio no Mercado para começar.</p></div>`}</section>`; }
  function walletHtml(m) { const mo = money(m, me()), w = wal(m, me());
    return `<section class="rm-head"><div><small class="rm-k">Suas vendas</small><h3>Carteira RMT</h3><p>Quanto você tem a receber, o que já está disponível e os saques.</p></div></section>
      <div class="rm-wk">${[["Pendente", brl(mo.pend), `Vendas nos ${R().hold} dias de segurança`, ""], ["Disponível", brl(mo.avail), "Pode ser pedido para saque", "good"], ["Em saque", brl(mo.wait), "Aguardando processamento", ""], ["Já recebido", brl(mo.paid), "Enviado para a sua chave Pix", ""], ["Ajustes", brl(mo.adj), "Valores em revisão", "warn"]].map(([t, v, s, c]) => `<div><small>${t}</small><b class="${c}">${v}</b><em>${s}</em></div>`).join("")}</div>
      <div class="rm-cols"><section class="rm-panel"><header><span class="rm-pi">↕</span><div><small>Entradas e saídas</small><h4>Histórico da carteira</h4><p>Cada venda, liberação e saque fica registrado aqui.</p></div></header>
          ${w.moves.length || w.saques.length ? `<div class="rm-rows">${[...w.moves.map((x) => ({ t: x.t, h: `<div class="rm-ri"><b>Venda · ${x.qty > 1 ? x.qty + "× " : ""}${esc(x.name)}</b><small>${when(x.t)} · comprador ${esc(x.buyer)} · taxa ${brl(x.fee)}</small></div><span class="rm-badge ${x.rel > Date.now() ? "res" : "ok"}">${x.rel > Date.now() ? "Libera " + new Date(x.rel).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "Disponível"}</span><strong class="good">+ ${brl(x.net)}</strong>` })), ...w.saques.map((x) => ({ t: x.t, h: `<div class="rm-ri"><b>Saque para ${esc(x.pix)}</b><small>${when(x.t)}</small></div><span class="rm-badge res">${x.status === "pago" ? "Pago" : "Aguardando"}</span><strong>− ${brl(x.amt)}</strong>` }))].sort((a, b) => b.t - a.t).map((x) => `<div class="rm-row">${x.h}</div>`).join("")}</div>`
            : `<div class="rm-empty">↕<p><b>Nenhuma movimentação ainda</b><br>Depois da sua primeira venda, o valor e a data de liberação aparecem aqui.</p></div>`}</section>
        <section class="rm-panel rm-saq"><small class="rm-k">Receba na sua chave Pix</small><h4>Solicitar saque</h4><p>Use só o saldo disponível. A equipe processa o pedido em até ${R().saqueDays} dias úteis.</p>
          <label class="rm-pin"><small>Sua chave Pix</small><input id="rmPix" placeholder="CPF, e-mail, telefone ou aleatória" value="${esc(ui.pix || w.pix)}"></label><button type="button" class="rm-btn" data-rm-pix>Salvar chave</button>
          <div class="rm-two"><span><small>Saque mínimo</small><b>${brl(R().saqueMin)}</b></span><span><small>Taxa por saque</small><b>Sem taxa</b></span></div>
          <label class="rm-pin"><small>Quanto deseja sacar?</small><input id="rmSaq" inputmode="decimal" placeholder="R$ 0,00" value="${esc(ui.saq)}"></label><button type="button" class="rm-btn go wide" data-rm-saq>Solicitar saque</button>
          <p class="rm-mute">A taxa de ${Math.round(R().fee * 100)}% já sai na venda. O saque não tem taxa.</p></section></div>`; }
  function sheetHtml(m) { const [k, id] = ui.sheet.split("|"), l = m.list.find((x) => x.id === id); if (!l) { ui.sheet = ""; return ""; }
    const x = (body) => `<div class="rm-sheet"><div class="rm-sbox"><button type="button" class="rm-x" data-rm-sheet="" aria-label="Fechar">✕</button>${body}</div></div>`;
    if (k === "ficha") { const p = l.data;
      return x(`<div class="rm-fh">${art(l)}<div><small class="rm-k">${p ? "Ficha do jogador" : "Item"}</small><h4>${l.qty > 1 ? l.qty + "× " : ""}${esc(l.name)}</h4><p>Vendedor: <b>${esc(l.sellerName)}</b> · anunciado em ${when(l.start)}</p><strong>${brl(l.price)}</strong></div></div>
        ${p ? `<div class="rm-two four"><span><small>Nível</small><b>${p.level}</b></span><span><small>Raridade</small><b style="color:${BL.rarity(p.rarity).color}">${esc(BL.rarity(p.rarity).name)}${p.shiny ? " ✦" : ""}</b></span><span><small>Posição</small><b>${esc(posOf(p).name)}</b></span><span><small>Poder</small><b>⚡ ${BL.power(p).toLocaleString("pt-BR")}</b></span></div>
          <div class="rm-bars">${S.map((s) => `<div><span>${C.STAT_LABEL[s]}</span><i><u style="width:${(p.stats[s] / C.STAT_MAX) * 100}%"></u></i><b>${p.stats[s]}</b><em>${BL.ev(p, s) ? "+" + BL.ev(p, s) + " EV" : ""}</em></div>`).join("")}</div>
          <p class="rm-mute">Nature <b>${esc(p.nature)}</b>${(() => { const n = BL.NATURE_BY_NAME[p.nature]; return n && n.up ? ` (+${C.STAT_LABEL[n.up]}, −${C.STAT_LABEL[n.down]})` : " (neutra)"; })()} · IV total ${ivTot(p)}/${ivMax()}</p>` : stats3(l)}
        ${l.seller !== me() && l.status === "open" ? `<div class="rm-act end"><button type="button" class="rm-btn go" data-rm-res="${l.id}">Comprar com Pix · ${brl(l.price)}</button></div>` : ""}`); }
    const o = (m.orders[me()] || []).find((y) => y.lid === id && y.status === "reserved"); if (!o) { ui.sheet = ""; return ""; }
    return x(`<small class="rm-k">Pagamento por Pix</small><h4>${l.qty > 1 ? l.qty + "× " : ""}${esc(l.name)}</h4>
      <div class="rm-two"><span><small>Total</small><b class="good">${brl(l.price)}</b></span><span><small>Reserva termina em</small><b data-rm-end="${o.until}">${left(o.until - Date.now())}</b></span></div>
      <div class="rm-test"><b>Modo de teste</b><p>O Pix de verdade (QR Code e copia e cola, confirmado pelo servidor) chega junto com o servidor do jogo. Por enquanto nenhum dinheiro é cobrado: confirme o pagamento de teste para ver a entrega.</p></div>
      <ol class="rm-steps"><li>Pague o Pix dentro do tempo da reserva.</li><li>O pagamento é confirmado e ${l.kind === "player" ? "o jogador vai" : "os itens vão"} para o seu Cofre RMT.</li><li>Clique em Receber no Cofre.</li></ol>
      <div class="rm-act end"><button type="button" class="rm-btn" data-rm-unres="${l.id}">Cancelar reserva</button><button type="button" class="rm-btn go" data-rm-pay="${l.id}">Confirmar pagamento de teste</button></div>`); }
  function render() { const ov = $("rmOv"); if (!ov) return; const m = sync(), fo = document.activeElement && document.activeElement.id, sel = fo && document.activeElement.selectionStart, b0 = ov.querySelector(".rm-body"), sc = b0 ? b0.scrollTop : 0;
    const body = ui.tab === "mercado" ? marketHtml(m) : ui.tab === "vender" ? sellHtml() : ui.tab === "meus" ? mineHtml(m) : ui.tab === "compras" ? buysHtml(m) : walletHtml(m), nv = (m.vault[me()] || []).length;
    ov.innerHTML = `<div class="rm-box" role="dialog" aria-modal="true" aria-label="RMT"><header class="rm-top"><span class="rm-logo">RMT</span><div class="rm-tt"><small>Mercado RMT</small><h2>Mercado entre treinadores<i class="beta-tag">Beta · Pix em breve</i></h2></div>
        <div class="rm-badges"><span class="on">Pix protegido</span><span>Custódia automática</span><span>Entrega no Cofre</span></div><button type="button" class="rm-x" data-rm-close aria-label="Fechar">✕</button></header>
      <nav class="rm-tabs">${TABS.map(([v, t]) => `<button type="button" class="${ui.tab === v ? "on" : ""}" data-rm-tab="${v}">${t}${v === "compras" && nv ? ` <i>${nv}</i>` : ""}</button>`).join("")}<span class="rm-testtag">Modo de teste · sem cobrança real até o servidor</span></nav>
      <div class="rm-body">${body}</div>${ui.sheet ? sheetHtml(m) : ""}</div>`;
    const b = ov.querySelector(".rm-body"); if (b) b.scrollTop = sc;
    if (fo && $(fo) && $(fo).matches("input")) { $(fo).focus(); try { $(fo).setSelectionRange(sel, sel); } catch (e) {} } }
  function open(tab) { let ov = $("rmOv"); if (!ov) { ov = document.createElement("div"); ov.id = "rmOv"; ov.className = "rm-ov"; document.body.appendChild(ov); bind(ov); } if (tab) ui.tab = tab; ui.sheet = ""; ov.hidden = false; render(); }
  function close() { const ov = $("rmOv"); if (ov) ov.hidden = true; }
  function act(r) { if (r) toast(r.msg, r.ok ? "gold" : ""); render(); }
  function bind(ov) {
    ov.addEventListener("click", (e) => { if (e.target === ov) return close(); const t = e.target.closest("button"); if (!t || t.disabled) return; const d = t.dataset;
      if ("rmClose" in d) return close();
      if (d.rmTab) { ui.tab = d.rmTab; ui.sheet = ""; return render(); }
      if ("rmSheet" in d) { ui.sheet = d.rmSheet; return render(); }
      if (d.rmCat) { ui.cat = d.rmCat; return render(); }
      if (d.rmScat) { ui.scat = d.rmScat; return render(); }
      if ("rmClear" in d) { Object.assign(ui, { q: "", pmin: "", pmax: "", lmin: "", lmax: "", rar: "", shiny: "", pos: "", sort: "novos" }); return render(); }
      if (d.rmRes) { const r = reserve(d.rmRes); if (r.ok) ui.sheet = "pay|" + d.rmRes; return act(r); }
      if (d.rmPay) { const r = pay(d.rmPay); if (r.ok) { ui.sheet = ""; ui.tab = "compras"; } return act(r); }
      if (d.rmUnres) { ui.sheet = ""; return act(unreserve(d.rmUnres)); }
      if ("rmClaim" in d) return act(claim(d.rmClaim || null));
      if (d.rmPost) { const [kind, ref] = d.rmPost.split("|"); const r = post({ kind, ref, price: ui.price[ref], qty: ui.qty[ref] }); if (r.ok) { delete ui.price[ref]; delete ui.qty[ref]; } return act(r); }
      if (d.rmCancel) return act(cancel(d.rmCancel));
      if ("rmPix" in d) { const r = setPix($("rmPix").value); ui.pix = ""; return act(r); }
      if ("rmSaq" in d) { const r = saque($("rmSaq").value); if (r.ok) ui.saq = ""; return act(r); } });
    const map = { rmQ: "q", rmPmin: "pmin", rmPmax: "pmax", rmLmin: "lmin", rmLmax: "lmax", rmSq: "sq" };
    ov.addEventListener("input", (e) => { const el = e.target, id = el.id;
      if (map[id]) { ui[map[id]] = el.value; return render(); }
      if (id === "rmPix") ui.pix = el.value; if (id === "rmSaq") ui.saq = el.value;
      if (el.dataset.rmPrice != null) { ui.price[el.dataset.rmPrice] = el.value; const g = ov.querySelector(`[data-rm-get="${CSS.escape(el.dataset.rmPrice)}"]`); if (g) g.innerHTML = getTxt(el.dataset.rmPrice); }
      if (el.dataset.rmQty != null) ui.qty[el.dataset.rmQty] = el.value; });
    ov.addEventListener("change", (e) => { const m2 = { rmRar: "rar", rmShiny: "shiny", rmPos: "pos", rmSort: "sort" }; if (m2[e.target.id]) { ui[m2[e.target.id]] = e.target.value; render(); } });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !ov.hidden) { if (ui.sheet) { ui.sheet = ""; render(); } else close(); } });
  }
  setInterval(() => { const ov = $("rmOv"); if (!ov || ov.hidden) return; let done = false; ov.querySelectorAll("[data-rm-end]").forEach((el) => { const l = +el.dataset.rmEnd - Date.now(); el.textContent = left(l); if (l <= 0) done = true; }); if (done && !document.activeElement.matches("#rmOv input")) render(); }, 1000);
  document.addEventListener("click", (e) => { const t = e.target.closest("[data-rmt-open]"); if (!t) return; e.preventDefault(); e.stopPropagation(); open(t.dataset.rmtOpen || undefined); }, true);

  BL.RMT = { open, close, read, write, post, cancel, reserve, pay, unreserve, claim, setPix, saque, money: (acc) => money(sync(), acc || me()) };
})();
