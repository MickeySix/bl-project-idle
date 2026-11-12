// BL PROJECT IDLE · motor da partida (IA + física estilo Haxball + desenho no canvas)
// Time 0 = usuário (ataca para a direita). Time 1 = adversário (ataca para a esquerda).
window.BL = window.BL || {};

(function () {
  const C = BL.CONFIG;
  const U = BL.util;
  // Campo do jogo = linhas da imagem img/campo.jpg (estádio do Mickey, v219; original em dev/sprites/src/estadio-original.png).
  // O original tem o campo mais achatado (1358×628) que o motor (W/H pede 705 px), então foi esticado 12,2% na vertical
  // (1672×1056) e cortado nas linhas 30..971: linhas de x 157 a 1515 e y 149,5 a 854,5
  // v222 · estádio inclinado (vista 3/4 do Mickey; original em dev/sprites/src/estadio-inclinado-original.png; o reto de cima está em
  // dev/old-img/campo-v221.jpg). fx/fy/fw seguem só para o layout da tela (HUD e letreiros, iguais à v219). persp = como o chão do motor
  // vira pixel da imagem: linha de fundo y 332,5 (x 140,3 a 1531,7), linha da frente y 772,5 (x -11 a 1683, as laterais são retas que
  // convergem); a profundidade v = y/H vira yf + b·v + a·v² (bate com o meio-campo em y 538). led = placas entre as luzes da mureta do fundo.
  // v223 (Mickey: campo maior, jogadores menores): img/campo.jpg corta 150 px da arquibancada e estica só as linhas do gramado ×1,34
  // (y 332..773 do original → 182,5..772,5); a mureta de baixo fica igual. spr 1,3 → 1
  const IMG = { src: "img/campo.jpg", w: 1672, h: 941, fx: 157, fy: 149.5, fw: 1358,
    persp: { yf: 182.5, yn: 772.5, b: 512.3, a: 77.7, lf: 140.3, rf: 1531.7, ln: -11, rn: 1683, spr: 1,
      led: { y: 133, h: 23, B: [[192, 190], [446, 215], [725, 221], [1010, 215], [1289, 190]] } } };
  const W = 1079, H = 560, GH = 129, PAD = 36;
  // v355 · silhueta da folha inteira pintada numa cor (base do contorno do time), feita uma vez por folha e cor
  const SIL = new WeakMap();
  function silhouette(im, col) {
    let m = SIL.get(im); if (!m) SIL.set(im, (m = {}));
    if (m[col]) return m[col];
    const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
    const g = c.getContext("2d"); g.drawImage(im, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
    return (m[col] = c);
  }
  const K = W / IMG.fw; // px da imagem → unidade do campo
  const VIEW = { x: -IMG.fx * K, y: -IMG.fy * K, w: IMG.w * K, h: IMG.h * K }; // área visível = imagem inteira
  // v222 · chão do motor (x, y) → pixel da imagem inclinada; k = pixels por unidade na largura ali, g = quanto o chão achata na altura
  const proj = (x, y) => {
    const P = IMG.persp, v = y / H, Y = P.yf + P.b * v + P.a * v * v, t = (Y - P.yf) / (P.yn - P.yf);
    const l = P.lf + (P.ln - P.lf) * t, r = P.rf + (P.rn - P.rf) * t, k = (r - l) / W;
    return { x: l + (x / W) * (r - l), y: Y, k, g: (P.b + 2 * P.a * v) / H / k };
  };
  const fieldImg = typeof Image !== "undefined" ? Object.assign(new Image(), { src: IMG.src }) : null;
  // v312 · Seus mapas: troca a imagem e a perspectiva do campo (C.PITCHES); o Estádio usa a calibragem original de IMG
  const IMG_STADIUM = { src: IMG.src, persp: IMG.persp };
  BL.setPitchImg = (pt) => {
    const src = pt && pt.persp ? pt.img : IMG_STADIUM.src;
    IMG.persp = pt && pt.persp ? pt.persp : IMG_STADIUM.persp;
    if (fieldImg && IMG.src !== src) { IMG.src = src; fieldImg.src = src; }
  };
  // v204 · sprites de campo (C.SPRITES[id].field), carregados sob demanda; null até a imagem chegar (aí desenha o círculo)
  const SPR = {};
  BL.spriteImg = (id, key = "field") => {
    const s = C.SPRITES[id], src = s && (key.startsWith("a:") ? s.anim?.[key.slice(2)]?.src : s[key]); // v210: "a:nome" = folha de animação
    if (!src || typeof Image === "undefined") return null;
    const k = id + "|" + key, im = SPR[k] || (SPR[k] = BL.atlasImg(src) || Object.assign(new Image(), { src }));
    return im.complete && im.naturalWidth ? im : null;
  };
  BL.fieldSprite = (id) => BL.spriteImg(id, "field");
  // v603 · atlas: "img/x.png#x,y,w,h" = recorte de uma folha única por personagem (limite de arquivos do artefato). Devolve um canvas com complete/naturalWidth como uma Image.
  const ATL = {}, ATB = {};
  BL.atlasImg = (src) => {
    const i = typeof src === "string" ? src.indexOf("#") : -1; if (i < 0 || typeof document === "undefined") return null;
    if (ATL[src]) return ATL[src];
    const [x, y, w, h] = src.slice(i + 1).split(",").map(Number), path = src.slice(0, i), cv = document.createElement("canvas");
    cv.width = w; cv.height = h; cv.complete = false; cv.naturalWidth = 0; cv.naturalHeight = 0; ATL[src] = cv;
    const base = ATB[path] || (ATB[path] = Object.assign(new Image(), { src: path + (BL.BUILD ? "?v=" + BL.BUILD : "") })); // v634: folha nova não fica presa no cache
    const cut = () => { cv.getContext("2d").drawImage(base, x, y, w, h, 0, 0, w, h); cv.complete = true; cv.naturalWidth = w; cv.naturalHeight = h; };
    if (base.complete && base.naturalWidth) cut(); else base.addEventListener("load", cut);
    return cv;
  };
  const MOUTH_T = H / 2 - GH / 2, MOUTH_B = H / 2 + GH / 2;
  // v217 · cores das partículas: poeira clara do gramado e lascas de grama/terra
  const DUST = "226,220,198", GRASS = ["70,150,55", "48,120,40", "120,190,80", "110,80,45"];
  const BALL_R = 8, PR = 17;
  const STEP = 1 / 60;
  const hyp = Math.hypot;
  const NOFX = Object.freeze({}); // v524: jogador sem efeito de equipamento

  class Match {
    constructor(opts) {
      this.opts = opts;
      this.pace = opts.pace || 1; // v614 (Mickey): partida normal roda um pouco mais rápido (o relógio segue em segundos reais)
      this.halfSec = opts.halfSec || C.HALF_SECONDS_NORMAL || C.HALF_SECONDS; // v614 (Mickey): partida normal 1 min (30 s por tempo); Boss mantém HALF_SECONDS
      this.arena = opts.arena || null; // { name, bossBuff, userDebuff }
      this.pitch = (C.PITCHES || []).find((x) => x.id === opts.pitch) || (C.PITCHES || [])[0] || { fx: {} }; // v312: campo e efeito
      this.pfx = this.pitch.fx || {};
      BL.setPitchImg(this.pitch);
      // treino: só o time 0 em campo, passando entre si e chutando no goleiro do outro gol
      this.training = !!opts.training;
      this.scrimmage = !!opts.scrimmage;
      { const L = C.LEGEND_PLAY; this.legend = L && opts.pos4 && !opts.training && !opts.scrimmage && (opts.legendNow || Math.random() < L.chance) ? { team: Math.random() < 0.5 ? 0 : 1, at: opts.legendNow ? 3 : U.rand(L.from, L.to) } : null; } // v582: jogada lendária // v161: treino em dois times (jogadores parados contra si mesmos): partida normal, mas sem relógio e sem fim
      this.speed = opts.speed || 1;
      this.myShapes = opts.myShapes || null; this.hotT = 0;
      // v466 (Mickey, Rematch): jogada ensaiada rara, no máximo 1 vez por partida (lançamento cruzado + tabela na área)
      this.atk = opts.atk || [null, null]; // v597: preset do Com a bola de cada time
      this.combo = [null, null]; // v600: combo das plays setadas
      this.gkLock = [false, false]; // v603 (Mickey): goleiro que soltou a bola só pega de novo depois que o adversário tocar nela
      this.pplays = [0, 1].map(() => (!this.training && opts.pos4 && C.PLAYS && C.PLAYS.pivo ? { st: null, used: {} } : null)); // v470 (Mickey, vídeos na visão do Pivô): lances do Pivô
      this.rplays = [0, 1].map(() => (!this.training && opts.pos4 && C.REPERT ? { used: {}, rollT: -9, rollE: null } : null)); this.chain = [{ n: 0, T: -9 }, { n: 0, T: -9 }]; // v474: repertório (levantada, lançamento, tabela em cadeia)
      this.plays = [0, 1].map(() => (!this.training && opts.pos4 && C.PLAYS && Math.random() < C.PLAYS.tabela.chance ? { st: null, used: false } : null)); // v467: sem sorteio de horário, só sai com as condições boas // v455: posições do Meu time e último lance disputado
      this.onEvent = opts.onEvent || (() => {});
      this.score = [0, 0];
      this.passes = [0, 0];
      this.poss = [0, 0];
      this.shots = [0, 0];
      this.passTry = [0, 0]; this.steals = [0, 0]; // v139: passes tentados e roubadas (desarme + corte) para o Vestiário
      this.half = 1;
      this.clock = 0; // segundos simulados no tempo atual
      this.golden = false;
      this.state = "kickoff";
      this.stateT = 1.0;
      this.fx = [];
      this.parts = []; // v217: partículas
      this.trail = [];
      this.ents = [];
      this.time = 0;
      const mk = (team, p, gk) => ({
        team, gk: !!gk, p, x: 0, y: 0, vx: 0, vy: 0, r: gk ? PR + 2 : PR,
        stun: 0, burst: 0, duelCd: 0, think: 0, mode: "idle", tx: 0, ty: 0, hold: 0, energy: 100,
      });
      // roles[t][i] = "atk" | "def" para cada jogador; mods[t] = multiplicadores de status (formação)
      const roles = opts.roles || [[], []];
      this.mods = opts.mods || [{}, {}];
      this.cfx = opts.coachFx || [{}, {}]; // v417: passiva do técnico (slow nos inimigos, jitter no próprio time)
      this.tfx = opts.mgrFx || [{}, {}]; // v527: itens do treinador que mexem na partida (pass, drain, tackle, shot)
      // shapes[t] = posições-base da formação (frações do campo, atacando para a direita), uma por jogador de linha
      this.shapes = opts.shapes || [null, null];
      this.kickShapes = opts.kickShapes || [null, null]; // posições só para a saída de bola (opcional)
      this.gkShapes = opts.gkShapes || [null, null]; // posições quando o nosso goleiro está com a bola (opcional)
      this.oppGkShapes = opts.oppGkShapes || [null, null]; // posições quando o goleiro adversário está com a bola (opcional)
      // estilo de jogo da formação (4×4): toque / blitz / muralha; edge[t] = venceu o pedra, papel e tesoura (a marca do estilo fica mais forte)
      this.styleKey = opts.styles || [null, null];
      this.styles = this.styleKey.map((k) => (k && C.STYLES[k]) || null);
      this.edge = opts.edge || [false, false];
      opts.teams.forEach((list, t) => list.forEach((p, i) => { const e = mk(t, p, false); e.role = roles[t][i] || "atk"; const P4 = !!opts.pos4 && list.length === 4; e.fixo = (P4 && i === 0) || (!!opts.fixo && opts.fixo[t] === i); e.alaDef = (P4 && i === 1) || (!!opts.alaDef && opts.alaDef[t] === i); e.alaOf = P4 && i === 2; e.pivo = P4 && i === 3; e.slot = i; this.ents.push(e); })); // v437: e.fixo = o Fixo do time (só 4×4)
      // time sem atacantes: não rouba a bola, só sai no contra-ataque depois de uma defesa do goleiro
      this.noAtk = [0, 1].map((t) => this.ents.filter((e) => !e.gk && e.team === t).every((e) => e.role === "def"));
      // v188 · ginga, carrinho, chute de longe, trave, dribles com nome e efeitos (pedido do Mickey: mais emoção).
      // v189: sem câmera lenta e sem "drible da vaca". v190: em todos os modos (antes só no 1×1)
      this.duelMode = !this.training;
      this.plan = [0, 1].map((t) => this.planFor(t));
      this.gks = [mk(0, null, true), mk(1, null, true)];
      this.gks[0].gkStats = opts.gk[0];
      this.gks[1].gkStats = opts.gk[1];
      // nível relativo (calculado uma vez): nível do jogador contra a média de nível do time adversário
      [0, 1].forEach((t) => {
        const o = this.field(1 - t), avg = o.length ? o.reduce((a, x) => a + BL.levelMult(x.p.level), 0) / o.length : 0;
        const xp = (C.LEVEL_REL_EXP && C.LEVEL_REL_EXP[o.length]) || 1.5; // v587 (Mickey): no 1×1 ao 3×3 o nível pesa menos (dá para ganhar um pouco abaixo)
        this.field(t).forEach((e) => (e.rel = avg ? (BL.levelMult(e.p.level) / avg) ** xp : 1));
      });
      this.cm = [null, null]; this.cmT = [-1, -1];
      // Muralha: com a bola, os defensores abertos (todos menos o mais recuado) podem subir no contra-ataque (um de cada vez, ver counterMate)
      [0, 1].forEach((t) => {
        if (this.styleKey[t] !== "muralha") return;
        const defs = this.ents.filter((x) => !x.gk && x.team === t && x.role === "def").map((x) => ({ x, a: this.anchor(x) })).filter((q) => q.a);
        defs.sort((p, q) => Math.abs(p.a.x - this.ownGoalX(t)) - Math.abs(q.a.x - this.ownGoalX(t))).slice(1).forEach((q) => (q.x.wing = true));
      });
      // treino: só o nosso goleiro, no gol para onde o time chuta; o outro gol fica vazio
      if (this.training) { this.gks[1].own = true; this.ents.push(this.gks[1]); }
      else this.ents.push(...this.gks);
      this.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, owner: null, shot: null, pass: null, ignore: null, ignoreT: 0 };
      this.kickoff(0);
    }

    // v139 · substituição no Vestiário: o reserva assume a vaga (mesmo papel e posição) com energia cheia
    substitute(e, p) {
      e.p = p; e.energy = 100; e.healT = undefined; e.stun = 0;
      [0, 1].forEach((t) => {
        const o = this.field(1 - t), avg = o.length ? o.reduce((a, x) => a + BL.levelMult(x.p.level), 0) / o.length : 0;
        const xp = (C.LEVEL_REL_EXP && C.LEVEL_REL_EXP[o.length]) || 1.5; // v587
        this.field(t).forEach((x) => (x.rel = avg ? (BL.levelMult(x.p.level) / avg) ** xp : 1));
      });
    }
    // v136 · pausa tática: troca a formação/tática de um time com a partida rolando
    setTactic(t, o) {
      this.field(t).forEach((e, i) => { e.role = o.roles[i] || "atk"; e.wing = false; });
      this.shapes[t] = o.shape; this.kickShapes[t] = o.kickShape; this.gkShapes[t] = o.gkShape; this.oppGkShapes[t] = o.oppGkShape;
      this.styleKey[t] = o.style; this.styles[t] = (o.style && C.STYLES[o.style]) || null;
      this.noAtk[t] = this.field(t).every((e) => e.role === "def");
      this.plan[t] = this.planFor(t);
      this.cm[t] = null;
      if (o.style === "muralha") {
        const defs = this.field(t).filter((x) => x.role === "def").map((x) => ({ x, a: this.anchor(x) })).filter((q) => q.a);
        defs.sort((p, q) => Math.abs(p.a.x - this.ownGoalX(t)) - Math.abs(q.a.x - this.ownGoalX(t))).slice(1).forEach((q) => (q.x.wing = true));
      }
    }

    // v524 · efeitos especiais dos equipamentos de quem está em campo (C.ITEM_FX), somados e guardados por jogador
    ifx(e) {
      if (!e || e.gk || !e.p) return NOFX;
      if (e.fxP === e.p) return e.fx;
      const o = {}; Object.values(e.p.items || {}).forEach((id) => { const f = id && C.ITEM_FX && C.ITEM_FX[id]; if (f) for (const k in f) o[k] = (o[k] || 0) + f[k]; });
      e.fxP = e.p; return (e.fx = o);
    }
    // v527 · item de personagem (C.CHAR_ITEMS): multiplica o status k; Rin + Sae no mesmo time: os dois ×duoK em tudo
    cItem(e) {
      if (!e || e.gk || !e.p || !e.p.items) return null;
      if (e.ciP !== e.p) { const id = e.p.items.personagem, Q = id && C.CHAR_ITEMS && C.CHAR_ITEMS[id]; e.ciP = e.p; e.ci = Q && BL.charItemOk(e.p, BL.ITEM_BY_ID[id]) && (!Q.pos || e.p.position === Q.pos) ? Q : null; }
      return e.ci;
    }
    cmul(e, k) {
      const Q = this.cItem(e); let m = Q && Q.mul ? Q.mul[k] || 1 : 1;
      if (e && e.chem && e.chem[k]) m *= 1 + e.chem[k]; // v577: Reações Químicas e Egos em Colisão
      if (C.CHAR_ITEMS && e && !e.gk && e.p) {
        if (e.duoT == null || this.time - e.duoT > 1) { e.duoT = this.time; e.duoM = 1;
          this.field(e.team).forEach((o) => { if (o === e) return; const A = this.cItem(e), B = this.cItem(o);
            if ((A && A.duo && o.p && o.p.charId === A.duo) || (B && B.duo && e.p.charId === B.duo)) e.duoM = (A && A.duoK) || (B && B.duoK) || 1; }); }
        m *= e.duoM;
      }
      return m * this.skStatK(e); // v623: Ego
    }
    // v577 (Mickey) · Reações Químicas e Egos em Colisão: contadores por jogador na partida (C.CHEM, C.EGO_CLASH)
    chemKey(e, key) {
      if (!e || e.gk || !e.p) return false; const ks = Array.isArray(key) ? key : [key];
      if (!e.chemW) { const ch = BL.CHAR_BY_ID[e.p.charId] || {}; e.chemW = `${e.p.charId || ""} ${ch.name || e.p.name || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/); }
      return ks.some((k) => e.chemW.includes(k));
    }
    chemOn() { return !this.training && !this.scrimmage && (C.CHEM || C.EGO_CLASH) && this.ents.filter((e) => !e.gk && e.team === 0).length >= 2; }
    chemCs(e) { return e.cs || (e.cs = { drib: 0, steal: 0, shot: 0, goal: 0, ast: 0, pass: new Map() }); }
    chemAdd(e, k, v) { // ganho limitado por C.CHEM_CAP; o que passar do teto vai para outro status do próprio jogador (sorteado)
      e.chem = e.chem || {}; const cap = C.CHEM_CAP || 0.2, cur = e.chem[k] || 0;
      if (v <= 0 || cur + v <= cap) { e.chem[k] = cur + v; return; }
      e.chem[k] = Math.max(cur, cap); const left = cur + v - e.chem[k], o = C.STATS.filter((s) => s !== k && (e.chem[s] || 0) < cap);
      if (left > 0 && o.length) { const s = o[Math.floor(Math.random() * o.length)]; e.chem[s] = Math.min(cap, (e.chem[s] || 0) + left); }
    }
    chemMsg(e, text, ban) { this.onEvent("log", { team: e.team, text }); (this.chemQ || (this.chemQ = [])).push({ ...ban, team: e.team }); if (this.chemQ.length > 3) this.chemQ.shift(); } // v578: faixa arcade (drawChemBanner) no lugar do texto flutuante
    mastEv(e, k) { if (!e || e.gk || !e.p || e.team !== 0 || this.training || this.scrimmage || e.p.temp) return; this.onEvent("mast", { uid: e.p.uid, k }); } // v583
    chemKick(e, pass) { this.chemPass = pass && pass.kind === "pass" && pass.to && !e.gk && pass.to.team === e.team ? { from: e, to: pass.to } : null; }
    chemOwner() { // passe certo = a bola chega num companheiro depois de um passe; guarda quem passou para contar assistência
      const o = this.ball.owner; if (o === this.chemOwn) return; this.chemOwn = o; if (!o) return;
      const P = this.chemPass; this.chemPass = null;
      if (P && o !== P.from && o.team === P.from.team && !o.gk) { o.recvFrom = P.from; const m = this.chemCs(P.from).pass; m.set(o, (m.get(o) || 0) + 1); this.chemEv(P.from, "pass"); }
      else o.recvFrom = null;
    }
    chemEv(e, kind) {
      this.mastEv(e, kind); if (kind === "goal" && e && e.recvFrom) this.mastEv(e.recvFrom, "ast"); // v583: Maestria (só cosmético)
      if (!e || e.gk || !e.p || !this.chemOn()) return;
      const c = this.chemCs(e); if (kind !== "pass") c[kind]++;
      if (kind === "goal" && e.recvFrom) { this.chemCs(e.recvFrom).ast++; this.chemCheck(e.recvFrom); }
      this.chemCheck(e, kind);
    }
    chemCheck(e, kind) {
      const mates = this.field(e.team), done = this.chemDone || (this.chemDone = new Set());
      (C.CHEM || []).forEach((r, i) => {
        if (!this.chemKey(e, r.from)) return;
        mates.forEach((t) => {
          const id = `r${i}:${e.team}:${t.p.uid}`; if (t === e || done.has(id) || !this.chemKey(t, r.to)) return;
          const c = this.chemCs(e), v = r.act === "pass" ? c.pass.get(t) || 0 : c[r.act] || 0; if (v < r.n) return;
          done.add(id); this.chemAdd(t, r.k, r.p);
          this.chemMsg(t, `REAÇÃO! ${e.p.short} → ${t.p.short} +${Math.round(r.p * 100)}% ${C.STAT_LABEL[r.k]}`, { kind: "react", a: e.p.short, b: t.p.short, sub: `+${Math.round(r.p * 100)}% ${C.STAT_LABEL[r.k]}` });
        });
      });
      (C.EGO_CLASH || []).forEach((g, i) => {
        mates.forEach((o) => {
          if (o === e) return; let A = null, B = null;
          if (this.chemKey(e, g.a) && this.chemKey(o, g.b)) { A = e; B = o; } else if (this.chemKey(e, g.b) && this.chemKey(o, g.a)) { A = o; B = e; } else return;
          const id = `e${i}:${e.team}:${A.p.uid}:${B.p.uid}`; if (done.has(id)) return;
          const ok = (x, y) => { const c = this.chemCs(x), d = this.chemCs(y);
            switch (g.cond) {
              case "goal": return kind === "goal" && x === e && c.goal >= 1;
              case "goalSolo": return kind === "goal" && x === e && e.recvFrom !== y;
              case "dribGoal": return c.drib >= g.n && c.goal >= 1;
              case "dribAst": return c.drib >= g.n && c.ast >= 1;
              case "steal": return c.steal >= g.n;
              case "ast": return c.ast >= (g.n || 1);
              case "stealVsGoal": return c.steal >= g.n && d.goal < 1;
            } return false; };
          if (g.cond === "stealVsGoal" && kind === "goal" && e === (g.only === "a" ? B : A)) { done.add(id); return; } // o outro marcou antes: não dispara mais
          let w = null; if ((g.only !== "b") && ok(A, B)) w = A; else if (g.only !== "a" && ok(B, A)) w = B; if (!w) return;
          const l = w === A ? B : A; done.add(id);
          const lv = BL.baseStat(l.p, g.k) * this.cmul(l, g.k), wv = Math.max(1, BL.baseStat(w.p, g.k) * this.cmul(w, g.k)), take = g.p * lv;
          this.chemAdd(l, g.k, -g.p); this.chemAdd(w, g.k, take / wv);
          this.chemMsg(w, `EGO! ${w.p.short} rouba ${Math.round(g.p * 100)}% de ${C.STAT_LABEL[g.k]} do ${l.p.short}`, { kind: "ego", a: w.p.short, b: l.p.short, sub: `rouba ${Math.round(g.p * 100)}% de ${C.STAT_LABEL[g.k]}` });
        });
      });
    }
    // v580 (Mickey) · modo dev: dispara na hora uma Reação ou Ego do time 0 (usa uma dupla real da tabela se estiver em campo; se não, os 2 primeiros jogadores)
    chemDev(kind) {
      const f = this.field(0); if (f.length < 2) return false; const ego = kind === "ego", L = (ego ? C.EGO_CLASH : C.CHEM) || []; let hit = null;
      for (const r of L) { for (const a of f) for (const b of f) if (a !== b && this.chemKey(a, ego ? r.a : r.from) && this.chemKey(b, ego ? r.b : r.to)) { hit = { r, a, b }; break; } if (hit) break; }
      if (!hit) hit = { r: L[Math.floor(Math.random() * L.length)], a: f[0], b: f[1] };
      const { r, a, b } = hit, pc = Math.round(r.p * 100), lab = C.STAT_LABEL[r.k];
      if (ego) { this.chemAdd(b, r.k, -r.p); this.chemAdd(a, r.k, r.p); this.chemMsg(a, `EGO! ${a.p.short} rouba ${pc}% de ${lab} do ${b.p.short}`, { kind: "ego", a: a.p.short, b: b.p.short, sub: `rouba ${pc}% de ${lab}` }); }
      else { this.chemAdd(b, r.k, r.p); this.chemMsg(b, `REAÇÃO! ${a.p.short} → ${b.p.short} +${pc}% ${lab}`, { kind: "react", a: a.p.short, b: b.p.short, sub: `+${pc}% ${lab}` }); }
      return true;
    }
    // v579 (Mickey) · faixa das Reações Químicas e Egos em Colisão com a arte dele (img/fx-chem.png: ego em cima, reação embaixo).
    // Entra com tranco e clarão, pulsa brilhando, faixa de luz correndo, raios piscando nas pontas, faíscas subindo e nomes piscando. Uma por vez (fila chemQ).
    drawChemBanner(ctx) {
      const Q = this.chemQ; if (!Q || !Q.length) return;
      const img = BL.chemArt || (BL.chemArt = Object.assign(new Image(), { src: `img/fx-chem.png?v=${BL.BUILD}` })); if (!img.complete || !img.naturalWidth) return;
      const B = Q[0], D = 2.8; if (B.t0 == null) B.t0 = performance.now();
      const age = (performance.now() - B.t0) / 1000; if (age > D) { Q.shift(); return; }
      const ego = B.kind === "ego", A = ego ? { y: 0, w: 1044, h: 196, nx: 540, ny: 150, nw: 500 } : { y: 200, w: 1087, h: 211, nx: 538, ny: 148, nw: 520 };
      const c1 = ego ? "255,46,140" : "0,229,255", c2 = ego ? "255,196,60" : "184,255,61";
      const bw = W * 0.64, k = bw / A.w, bh = A.h * k, cy = H * 0.06; // v581 (Mickey): mais para cima, fora do meio do campo
      const inK = Math.min(1, age / 0.25), pop = inK < 1 ? 1.5 - 0.5 * (1 - Math.pow(1 - inK, 3)) + 0.12 * Math.sin(inK * Math.PI) : 1, out = Math.max(0, (age - (D - 0.3)) / 0.3);
      const t = this.time, blink = Math.floor(age * 8) % 2 === 0, pulse = 0.5 + 0.5 * Math.sin(age * 9);
      ctx.save(); ctx.translate(W / 2 + out * out * W * 0.8 * (B.team === 0 ? 1 : -1), cy); ctx.scale(pop * (1 + 0.012 * pulse), pop * (1 + 0.012 * pulse)); ctx.globalAlpha = Math.min(1, inK * 1.6) * (1 - out);
      if (age < 0.15) { ctx.save(); ctx.globalAlpha = 0.55 * (1 - age / 0.15); ctx.fillStyle = "#fff"; ctx.fillRect(-W, -H, W * 2, H * 2); ctx.restore(); } // clarão de entrada
      // brilho pulsando atrás da faixa
      ctx.save(); ctx.globalCompositeOperation = "lighter"; const gl = ctx.createRadialGradient(0, 0, bh * 0.2, 0, 0, bw * 0.55); gl.addColorStop(0, `rgba(${c1},${0.22 + 0.18 * pulse})`); gl.addColorStop(1, `rgba(${c1},0)`); ctx.fillStyle = gl; ctx.fillRect(-bw * 0.6, -bh * 1.2, bw * 1.2, bh * 2.4); ctx.restore();
      // a arte + uma faixa de luz correndo só por cima dela (canvas auxiliar)
      const cv = this._chemCv || (this._chemCv = document.createElement("canvas")); cv.width = A.w; cv.height = A.h; const x2 = cv.getContext("2d");
      x2.drawImage(img, 0, A.y, A.w, A.h, 0, 0, A.w, A.h); x2.globalCompositeOperation = "source-atop";
      const sx = ((age * 1.1) % 1.4) * (A.w + 400) - 300, sg = x2.createLinearGradient(sx, 0, sx + 220, 0); sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,.55)"); sg.addColorStop(1, "rgba(255,255,255,0)");
      x2.save(); x2.transform(1, 0, -0.5, 1, 0, 0); x2.fillStyle = sg; x2.fillRect(sx - 200, 0, 520, A.h * 2); x2.restore();
      ctx.drawImage(cv, -bw / 2, -bh / 2, bw, bh);
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha *= 0.18 + 0.22 * pulse; ctx.drawImage(cv, -bw / 2, -bh / 2, bw, bh); ctx.restore(); // a faixa inteira brilha pulsando
      // raios piscando nas duas pontas
      if (!this._chemBolt || t - this._chemBolt.t > 0.07) { const mk = (sx) => { const p = [[sx * bw * 0.47, -bh * 0.35]]; for (let i = 1; i < 6; i++) p.push([sx * (bw * 0.47 + (Math.random() * 30 - 8)), -bh * 0.35 + i * bh * 0.15 + (Math.random() * 8 - 4)]); return p; }; this._chemBolt = { t, l: mk(-1), r: mk(1), on: Math.random() < 0.75 }; }
      if (this._chemBolt.on) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineJoin = "round";
        for (const pts of [this._chemBolt.l, this._chemBolt.r]) for (const [lw, col] of [[6, `rgba(${c1},.45)`], [2, "rgba(255,255,255,.95)"]]) { ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
        ctx.restore(); }
      // faíscas e estrelinhas se mexendo em volta
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 26; i++) { const ph = (i * 0.618) % 1, life = (age * (0.6 + ph) + ph) % 1, px = (ph * 2 - 1) * bw * 0.5 + Math.sin(t * 3 + i) * 10, py = bh * 0.45 - life * bh * 1.3, r = (1 - life) * (2 + (i % 3));
        ctx.fillStyle = i % 2 ? `rgba(${c2},${1 - life})` : `rgba(${c1},${1 - life})`; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); }
      for (let i = 0; i < 5; i++) { const px = [-0.44, 0.42, -0.12, 0.18, 0.47][i] * bw, py = [-0.42, -0.45, 0.48, -0.5, 0.3][i] * bh, tw = 0.5 + 0.5 * Math.sin(t * 7 + i * 1.7), r = 5 + 7 * tw;
        ctx.save(); ctx.translate(px, py); ctx.rotate(t * 1.5 + i); ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.6 * tw})`; ctx.beginPath(); for (let n = 0; n < 8; n++) { const rr = n % 2 ? r * 0.25 : r; ctx.lineTo(Math.cos((n * Math.PI) / 4) * rr, Math.sin((n * Math.PI) / 4) * rr); } ctx.fill(); ctx.restore(); }
      ctx.restore();
      // nomes piscando na linha de baixo da arte
      const nx = (A.nx - A.w / 2) * k, ny = (A.ny - A.h / 2) * k, fs = Math.round(26 * k * 1.55);
      ctx.textBaseline = "middle"; ctx.lineJoin = "round"; ctx.font = `italic 900 ${fs}px 'Barlow Condensed', Impact, sans-serif`;
      const parts = [[B.a, blink ? "#ffffff" : `rgb(${c2})`], [ego ? " vs " : " → ", `rgb(${c2})`], [B.b, blink ? "#ffffff" : `rgb(${c2})`], ["    " + B.sub, `rgb(${c2})`]];
      const tw = parts.reduce((s, [x]) => s + ctx.measureText(x).width, 0), sc = Math.min(1, (A.nw * k) / tw); let x = nx - (tw * sc) / 2;
      ctx.save(); ctx.translate(x, ny); ctx.scale(sc, 1); x = 0; ctx.textAlign = "left";
      for (const [txt, col] of parts) { ctx.lineWidth = 5; ctx.strokeStyle = "#050914"; ctx.strokeText(txt, x, 0); ctx.shadowColor = col; ctx.shadowBlur = blink ? 10 : 4; ctx.fillStyle = col; ctx.fillText(txt, x, 0); ctx.shadowBlur = 0; x += ctx.measureText(txt).width; }
      ctx.restore(); ctx.restore();
    }
    // ---------- v623 (Mickey) · habilidades (C.SKILL_DEF): automáticas, nos dois times; o jogador equipa em p.skills [{ id, lv }] ----------
    skOn() { return !this.training && !this.scrimmage && !!C.SKILL_DEF; }
    // v638 (Mickey): habilidades são do TIME (até 4, opts.skills[t]); a recarga é do time e quem tiver a melhor chance usa. Sem opts.skills, junta as dos jogadores (inimigos de BL.enemySkills)
    skTeamL(t) {
      const TL = this.skTL || (this.skTL = [null, null]); if (TL[t]) return TL[t]; const L = C.SKILL_LV, seen = new Set();
      let src = this.opts.skills && this.opts.skills[t]; if (!src) { src = []; this.field(t).forEach((e) => (e.p && e.p.skills || []).forEach((x) => src.push(x))); }
      return (TL[t] = src.map((x) => (typeof x === "string" ? { id: x, lv: 1 } : x)).filter((x) => x && C.SKILL_DEF[x.id] && !seen.has(x.id) && seen.add(x.id)).slice(0, C.SKILL_SLOTS || 4).map((x) => { const d = C.SKILL_DEF[x.id], lv = U.clamp(x.lv || 1, 1, L.max), cd = Math.max(5, d.cd - (lv - 1) * L.cd); return { id: x.id, d, lv, k: 1 + (lv - 1) * L.eff, cdMax: cd, cd: cd * (C.SKILL_START ?? 0.5) }; }));
    }
    skList(e) { return !e || e.gk || !e.p ? [] : this.skTeamL(e.team); }
    skReady(e, id) { if (!this.skOn()) return null; const s = this.skList(e).find((x) => x.id === id); return s && s.cd <= 0 ? s : null; }
    skUse(e, s, fx) {
      s.cd = s.cdMax; this.skN = this.skN || [0, 0]; this.skN[e.team]++;
      (this.skQ || (this.skQ = [])).push({ name: s.d.name, who: e.p.short, rar: s.d.rar, team: e.team, id: s.id }); if (this.skQ.length > 3) this.skQ.shift();
      if (fx) (this.skFx || (this.skFx = [])).push({ t0: this.time, ...fx });
      this.onEvent("log", { team: e.team, text: `${e.p.short} usou ${s.d.name}!` }); this.onEvent("skill", { team: e.team, id: s.id, name: s.d.name, who: e.p.short });
    }
    skT(t) { return (this.skTm || (this.skTm = [{}, {}]))[t]; }
    skCut(t, sec) { this.skTeamL(t).forEach((s) => (s.cd = Math.max(0, s.cd - sec))); }
    skGood(e, m) { // v639: passe de habilidade só para quem fica perto do gol, livre e bem à frente de quem passa
      if (!m) return null; const SU = C.SKILL_USE || {}, gx = this.goalX(e.team), dm = hyp(gx - m.x, H / 2 - m.y), de = hyp(gx - e.x, H / 2 - e.y);
      return dm < SU.passTo && de - dm > SU.passGain && this.openness(m) > SU.passOpen ? m : null;
    }
    skAhead(e, r) { const d = this.dir(e.team); return this.field(1 - e.team).some((x) => (x.x - e.x) * d > -10 && hyp(x.x - e.x, x.y - e.y) < r); }
    skStep(dt) {
      if (!this.skOn()) return;
      const b = this.ball, ow = b.owner;
      if (ow !== this.skOwn) { this.skOwn = ow; if (ow && !ow.gk) ow.skRecvT = this.time; }
      if (b.skCol && !ow) { if (this.skBTc !== b.skCol || this.skBTid !== b.skId || this.skBTfade != null) { if (this.skBTfade != null || this.skBTid !== b.skId) this.skBT = []; this.skBTfade = null; } this.skBTc = b.skCol; this.skBTid = b.skId; (this.skBT || (this.skBT = [])).push({ x: b.x, y: b.y }); if (this.skBT.length > 26) this.skBT.shift(); } // v637: rastro de luz da bola
      else if (this.skBT && this.skBT.length) { this.skBTfade = Math.max(0, (this.skBTfade ?? 1) - dt * 2.5); if (this.skBTfade <= 0) this.skBT = []; }
      for (const e of this.ents) if (e.skDrib > 0 && (ow !== e || this.time > (e.skDribU || 0))) e.skDrib = 0; // v639: Monstro acaba ao soltar a bola ou no tempo (dur)
      for (const t of [0, 1]) for (const s of this.skTeamL(t)) s.cd = Math.max(0, s.cd - dt); // v638: recarga do time, uma vez por passo
      for (const e of this.ents) {
        if (e.gk) continue; const L = this.skList(e); if (!L.length && !e.skSpd) continue;
        if (e.skSpd && e.skSpd.until > this.time && (e.skTrT = (e.skTrT || 0) - dt) <= 0) { e.skTrT = 0.03; (e.skTr = e.skTr || []).push({ x: e.x, y: e.y }); if (e.skTr.length > 9) e.skTr.shift(); } else if (!(e.skSpd && e.skSpd.until > this.time)) e.skTr = null;
        if (e.skNinja > this.time && (e.skNjT = (e.skNjT || 0) - dt) <= 0) { e.skNjT = 0.07; (e.skNjTr = e.skNjTr || []).push({ x: e.x, y: e.y }); if (e.skNjTr.length > 5) e.skNjTr.shift(); } // v637: imagens residuais do Ninja
        if (e.skNjTr && !(e.skNinja > this.time)) { e.skNjTr = null; this.emit(14, e.x, e.y - 20, { col: ["200,120,255", "240,210,255"], spread: Math.PI, v0: 80, v1: 220, l0: 0.2, l1: 0.4, r0: 1.6, r1: 2.6, shape: "streak", drag: 6, air: true }); (this.skFx || (this.skFx = [])).push({ id: "ninjaOut", e, t0: this.time, life: 0.5 }); }
        if (e.skRetaEnd && this.time >= e.skRetaEnd) { e.skRetaEnd = 0; // Arrancada Reta: no fim pode perder a bola
          if (ow === e && Math.random() < C.SKILL_DEF.reta.lose) { b.owner = null; b.pass = null; b.shot = null; b.vx = this.dir(e.team) * 170; b.vy = U.rand(-60, 60); b.ignore = e; b.ignoreT = 0.3; e.stun = Math.max(e.stun, 0.3); } }
        if (!L.length || (e.skThink = (e.skThink || 0) - dt) > 0) continue; e.skThink = 0.25;
        const t = e.team, T = this.skT(t), mine = ow && !ow.gk && ow.team === t, theirs = ow && !ow.gk && ow.team !== t;
        const atkHalf = mine && Math.abs(this.goalX(t) - ow.x) < W * 0.55, SU = C.SKILL_USE || {}, owG = mine ? hyp(this.goalX(t) - ow.x, H / 2 - ow.y) : 1e9; // v639: só quando dá vantagem
        let s;
        if ((s = this.skReady(e, "energia")) && atkHalf && (owG < SU.energiaGoal || this.field(t).reduce((a, m) => a + m.energy, 0) / this.field(t).length < SU.energiaLow)) { T.energia = this.time + s.d.t; T.spd = 1 + (s.d.spd - 1) * s.k; this.field(t).forEach((m) => (m.energy = Math.min(100, m.energy + s.d.en * s.k))); this.skUse(e, s, { id: "energia", team: t, life: s.d.t }); }
        if ((s = this.skReady(e, "visao")) && atkHalf && owG < SU.visaoGoal && this.skBest(ow, 90)) { T.visao = this.time + s.d.t; T.vAdd = s.d.add * s.k; this.skUse(e, s, { id: "visao", team: t, life: s.d.t }); }
        if ((s = this.skReady(e, "ego")) && atkHalf && owG < SU.egoGoal) { T.ego = this.time + s.d.t; T.egoK = 1 + s.d.all * s.k; this.field(t).forEach((m) => (m.duoT = null)); this.skUse(e, s, { id: "ego", team: t, e, life: 1.8 }); /* v685: 1,4 → 1,8 s para a animação do Ego */ }
        if ((s = this.skReady(e, "muralha")) && theirs && Math.abs(this.ownGoalX(t) - ow.x) < s.d.zone && !(T.wall && T.wall.until > this.time)) { T.wall = { until: this.time + s.d.t, by: e, s }; this.skUse(e, s, { id: "muralha", team: t, life: s.d.t }); }
        if ((s = this.skReady(e, "ninja")) && mine && ow !== e && (e.x - ow.x) * this.dir(t) > 20 && hyp(this.goalX(t) - e.x, H / 2 - e.y) < 460) { e.skNinja = this.time + s.d.t; e.skNinjaKeep = this.time + s.d.keep; e.skNinjaAdd = s.d.add * s.k; this.emit(10, e.x, e.y, { col: ["200,200,210", "150,150,165"], spread: Math.PI, v0: 20, v1: 70, l0: 0.4, l1: 0.7, r0: 4, r1: 7, grow: 1.8, alpha: 0.6, air: true }); this.skUse(e, s, { id: "ninja", e, life: s.d.t }); }
      }
      if (this.skFx) this.skFx = this.skFx.filter((f) => this.time - f.t0 < f.life || f.hold > this.time); // v685: sprite ainda tocando segura o efeito
    }
    skBest(e, need) { // melhor aliado para receber: mais perto do gol (pelo menos need px à frente), aberto; prefere quem tem habilidade de chute pronta
      const t = e.team, gx = this.goalX(t), dE = hyp(gx - e.x, H / 2 - e.y); let best = null, bs = -1e9;
      for (const m of this.field(t)) { if (m === e || m.stun > 0) continue; const dm = hyp(gx - m.x, H / 2 - m.y); if (dm > dE - need || hyp(m.x - e.x, m.y - e.y) > 560) continue;
        const sc = -dm + this.openness(m) * 0.6 + (m.skNinja > this.time ? 200 : 0) + (this.skList(m).some((s) => s.cd <= 0 && ["direct", "curvado", "voleio"].includes(s.id)) ? 60 : 0); if (sc > bs) { bs = sc; best = m; } }
      return best;
    }
    skPass(e, m, col) { this.kickTo(e, m.x + this.dir(e.team) * 22, m.y, 640, 0, { kind: "pass", to: m }); const b = this.ball; if (b.pass) { b.pass.genius = true; b.pass.bad = false; } b.skCol = col || null; b.skId = { "157,255,106": "tabela", "255,210,63": "magico", "255,255,255": "calibrado", "120,220,255": "visao" }[col] || null; }
    skDecide(e, distGoal, o, distO) {
      if (!this.skOn() || e.gk) return false;
      const t = e.team, T = this.skT(t), d = this.dir(t), fresh = this.time - (e.skRecvT ?? -9) < 0.6, x1No = this.x1() && !this.x1ShotOk(e, distGoal);
      if (e.skTab && e.skTab.until > this.time && e.skTab.to.stun <= 0) { const to = e.skTab.to; e.skTab = null; this.skPass(e, to, "157,255,106"); to.skAdd = { v: e.skTabAdd, until: this.time + 4, src: "tabela" }; (this.skFx || (this.skFx = [])).push({ id: "tabela", a: e, b: to, t0: this.time, life: 0.9, ret: 1 }); return true; }
      e.skTab = null;
      let s;
      if (!x1No && fresh && distGoal < C.SKILL_DEF.direct.box && (s = this.skReady(e, "direct"))) { e.skShotNow = { id: "direct", add: (s.d.add + (e.recvFrom ? s.d.passAdd : 0)) * s.k, pow: s.d.pow, col: "38,217,255" }; this.skUse(e, s, { id: "direct", e, life: 1.1 }); this.shoot(e, distGoal, distO); return true; }
      if (!x1No && fresh && (s = this.skReady(e, "voleio")) && distGoal > s.d.from && distGoal < s.d.to) { e.skShotNow = { id: "voleio", fixed: s.d.chance * s.k, pow: s.d.pow, reb: true, col: "255,140,40" }; this.skUse(e, s, { id: "voleio", e, life: 0.6 }); this.fx.push({ kind: "wave", x: e.x, y: e.y + 4, t: 0.45, r: 46, col: "255,170,60" }); this.emit(16, e.x, e.y - 20, { col: ["255,210,63", "255,120,40", "255,255,255"], spread: Math.PI, v0: 120, v1: 320, l0: 0.2, l1: 0.4, r0: 1.6, r1: 3, shape: "streak", drag: 5, air: true }); this.shake(6, 0.25); this.shoot(e, distGoal, distO); return true; }
      if (!x1No && (s = this.skReady(e, "curvado")) && distGoal > s.d.from && distGoal < s.d.to) { e.skShotNow = { id: "curvado", add: s.d.add * s.k, curve: true, col: "40,80,210" }; this.skUse(e, s, { id: "curvado", e, life: 1.2 }); this.shoot(e, distGoal, distO); return true; }
      if ((s = this.skReady(e, "magico")) && distGoal > s.d.from && distGoal < s.d.to) { const m = this.skGood(e, this.skBest(e, 120)); if (m) { this.skUse(e, s, { id: "magico", a: e, b: m, life: 1 }); this.skPass(e, m, "255,210,63"); m.skAdd = { v: s.d.add * s.k, until: this.time + 5, src: "magico" }; this.skCut(t, s.d.cdCut); return true; } }
      if ((s = this.skReady(e, "calibrado")) && distGoal > 280) { const m = this.skGood(e, this.skBest(e, 100)); if (m) { this.skUse(e, s, { id: "calibrado", a: e, b: m, life: 0.8 }); this.skPass(e, m, "255,255,255"); this.skCut(t, s.d.cdCut); return true; } }
      if ((s = this.skReady(e, "tabela")) && o && distO < s.d.press) { const m = this.field(t).filter((x) => x !== e && x.stun <= 0 && hyp(x.x - e.x, x.y - e.y) < s.d.near && !this.laneBlocked(e, x)).sort((p, q) => hyp(p.x - e.x, p.y - e.y) - hyp(q.x - e.x, q.y - e.y))[0];
        if (m) { this.skUse(e, s, { id: "tabela", a: e, b: m, life: 0.9 }); this.skPass(e, m, "157,255,106"); m.skTab = { to: e, until: this.time + 2.5 }; m.skTabAdd = s.d.add * s.k; e.mode = "runTo"; e.tx = U.clamp(e.x + d * 150, 30, W - 30); e.ty = e.y + (H / 2 - e.y) * 0.4; return true; } }
      if ((T.visao > this.time || this.field(t).some((m) => m.skNinja > this.time)) && !e.skVis) { const m = this.skBest(e, 90); if (m && (T.visao > this.time || m.skNinja > this.time)) { e.skVis = true; this.skPass(e, m, T.visao > this.time ? "120,220,255" : null); return true; } }
      e.skVis = false;
      if ((s = this.skReady(e, "monstro")) && o && distO < s.d.near && distGoal < (C.SKILL_USE || {}).monstroGoal && this.skAhead(e, s.d.near)) { e.skDrib = s.d.n; e.skDribK = s.k; e.skDribU = this.time + (s.d.dur || 6); this.skUse(e, s, { id: "monstro", e, life: 4 }); }
      if ((s = this.skReady(e, "pantera")) && distGoal > s.d.minGoal && distGoal < (C.SKILL_USE || {}).panteraMax && !this.skAhead(e, s.d.open)) { e.skSpd = { k: 1 + (s.d.spd - 1) * s.k, until: this.time + s.d.t, col: "255,60,150" }; e.skDodge = s.d.dodge; e.skAdd = { v: (s.d.add + s.d.addFar * Math.min(1, (distGoal - s.d.minGoal) / 400)) * s.k, until: this.time + s.d.t + 2, src: "pantera" }; this.skUse(e, s); }
      if ((s = this.skReady(e, "reta")) && distGoal > 300 && distGoal < (C.SKILL_USE || {}).retaMax && !this.skAhead(e, s.d.open)) { e.skSpd = { k: 1 + (s.d.spd - 1) * s.k, until: this.time + s.d.t, col: "80,170,255", reta: true }; e.skRetaEnd = this.time + s.d.t; this.skUse(e, s); }
      return false;
    }
    skWallHit(e) { // Muralha do Capitão: o próximo chute do adversário bate na muralha
      const t = e.team, Wl = this.skOn() && this.skT(1 - t).wall; if (!Wl || Wl.until < this.time || e.gk) return false;
      this.skT(1 - t).wall = null; (this.skFx || (this.skFx = [])).push({ id: "wallHit", team: 1 - t, t0: this.time, life: (C.SKILL_SPR.muralha || {}).hitT || 0.5 }); const by = Wl.by, b = this.ball, sp = U.rand(240, 340); // v685: bote da cobra
      b.owner = null; b.shot = null; b.pass = null; b.vx = -this.dir(t) * sp; b.vy = U.rand(-1, 1) * 200; b.ignore = e; b.ignoreT = 0.3; b.skCol = null;
      this.shots[t]++; this.drain(e, C.ENERGY_DRAIN_ACTION);
      by.skWallB = { v: Wl.s.d.add * Wl.s.k, pow: Wl.s.d.pow, until: this.time + 20 };
      this.fx.push({ kind: "text", x: e.x, y: e.y - 30, text: "BLOQUEIO!", t: 0.8, color: "#ffd23f" }); this.fx.push({ kind: "wave", x: e.x + this.dir(t) * 30, y: e.y, t: 0.4, r: 40, col: "120,200,255" }); this.shake(6, 0.25);
      this.onEvent("log", { team: 1 - t, text: `A muralha de ${by.p.short} parou o chute de ${e.p.short}` });
      return true;
    }
    skShot(e, chance) { // bônus das habilidades no chute (somados até SKILL_CAP; o teto GOAL_MAX continua)
      if (!this.skOn() || e.gk) return chance;
      const S = e.skShotNow, now = this.time; let add = 0;
      if (S && S.add) add += S.add;
      if (e.skAdd && e.skAdd.until > now) add += e.skAdd.v; e.skAdd = null;
      if (e.skNinjaKeep > now) { add += e.skNinjaAdd || 0; e.skNinjaKeep = 0; }
      const T = this.skT(e.team); if (T.visao > now) add += T.vAdd || 0;
      if (e.skWallB && e.skWallB.until > now) { add += e.skWallB.v; e.skPowW = e.skWallB.pow; e.skWallB = null; }
      if (S && S.fixed != null) return Math.min(C.GOAL_MAX, S.fixed + Math.min(C.SKILL_CAP, add) * 0.5);
      return add > 0 ? Math.min(C.GOAL_MAX, chance + Math.min(C.SKILL_CAP || 40, add)) : chance;
    }
    skPow(e) { const S = e.skShotNow; return Math.max(S && S.pow ? S.pow : 1, e.skPowW || 1); }
    skAfterShot(e) { const S = e.skShotNow, b = this.ball; e.skShotNow = null; const pw = e.skPowW; e.skPowW = 0; if (!S && !pw) return;
      if (S && S.reb && b.shot) b.shot.reb = true; b.skCol = S ? S.col : "120,200,255"; b.skId = S ? S.id : "muralha";
      if (S && S.curve && !b.curl) { const D = hyp(b.vx, b.vy) ? hyp(this.goalX(e.team) - b.x, (b.shot ? b.shot.ty : H / 2) - b.y) || 1 : 1, c = 0.45 * (Math.random() < 0.5 ? -1 : 1), ca = Math.cos(c), sa = Math.sin(c); [b.vx, b.vy] = [b.vx * ca - b.vy * sa, b.vx * sa + b.vy * ca]; b.curl = { k: (-2 * c) / D, left: D }; }
    }
    skDodge(c) { if (c.skDodge > 0 && c.skSpd && c.skSpd.until > this.time) { c.skDodge--; this.fx.push({ kind: "swoosh", x: c.x, y: c.y, t: 0.4, col: "255,50,60", d: this.dir(c.team) }); return true; } return false; }
    skDribP(c, p) { return c.skDrib > 0 ? Math.min(0.95, p * (1 + C.SKILL_DEF.monstro.drib * (c.skDribK || 1))) : p; }
    skDribWon(c, won) {
      if (!(c.skDrib > 0)) return; if (!won) { c.skDrib = 0; return; }
      c.skDrib--; const M = C.SKILL_DEF.monstro, k = c.skDribK || 1, cur = c.skAdd && c.skAdd.src === "monstro" && c.skAdd.until > this.time ? c.skAdd.v : 0;
      c.skAdd = { v: Math.min(M.max * k, cur + M.add * k), until: this.time + 6, src: "monstro" };
    }
    skGenius(e, pass) { // passe certo das habilidades: Ninja e Visão não são cortados; o bônus do Monstro vai junto no passe
      if (!this.skOn() || !pass || pass.kind !== "pass" || !pass.to || pass.to.team !== e.team || pass.to.gk) return false;
      if (e.skAdd && e.skAdd.src === "monstro" && e.skAdd.until > this.time) { pass.to.skAdd = e.skAdd; e.skAdd = null; }
      return pass.to.skNinja > this.time || this.skT(e.team).visao > this.time;
    }
    skSpdK(e) { if (!this.skOn() || e.gk) return 1; const T = this.skT(e.team); return (e.skSpd && e.skSpd.until > this.time ? e.skSpd.k : 1) * (T.energia > this.time ? T.spd : 1); }
    skStatK(e) { if (!this.skTm || !e || e.gk) return 1; const T = this.skTm[e.team]; return T && T.ego > this.time ? T.egoK : 1; }
    skAlpha(e) { return e.skNinja > this.time ? 0.3 : 1; }
    // visual de cada habilidade (layer 0 = no chão, por baixo dos jogadores; 1 = por cima)
    // v637 (Mickey, refs docs/habilidades/ref-animacao-*.png) · visual neon das habilidades: rastros com brilho, silhuetas de energia, Visão de Jogo com linhas de visão espacial
    skP(x, y) { return IMG.persp ? proj(x, y) : { x, y }; } // ponto do campo → pixel da imagem (desenho sem o at())
    // v685: folhas de sprite das habilidades (C.SKILL_SPR); devolve a imagem só depois de carregada (antes disso fica o desenho antigo)
    skImg(id) { const S = C.SKILL_SPR && C.SKILL_SPR[id]; if (!S || !S.src || id === "pantera") return null; const c = BL.skImgs || (BL.skImgs = {}), im = c[id] || (c[id] = Object.assign(new Image(), { src: `${S.src}?v=${BL.BUILD}` })); return im.complete && im.naturalWidth ? im : null; }
    skHH(x, y) { return 70 * (IMG.persp ? (this.skP(x, y).k || 1) * IMG.persp.spr : 1); } // altura de um jogador naquele ponto do campo
    skSeq(A, t, dur) { return A[Math.max(0, Math.min(A.length - 1, Math.floor((t / dur) * A.length)))]; }
    skSprD(ctx, id, fr, x, y, hh, o = {}) { const S = C.SKILL_SPR[id], im = this.skImg(id); if (!im) return; const sw = im.naturalWidth / S.n, sh = im.naturalHeight, dh = hh * (S.h || 1), dw = (dh * sw) / sh;
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, (o.a ?? 1) * (S.alpha ?? 1))); if (S.add) ctx.globalCompositeOperation = "lighter"; ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale(o.fx || 1, (o.fy || 1) * (S.fy || 1)); ctx.drawImage(im, fr * sw, 0, sw, sh, -dw / 2, o.bot ? -dh : -dh / 2, dw, dh); ctx.restore(); }
    // chute/passe de habilidade: impacto no ponto do chute, rastro preso na bola (cabeça na bola, girado na direção dela) e quadros finais onde a bola parou
    skKick(ctx, f, age) { const S = C.SKILL_SPR[f.id], b = this.ball, now = this.time, BT = this.skBT, e = f.e || f.a, R = f.ret ? { imp: S.rImp, trail: S.rTrail, end: S.rEnd } : S;
      if (!f.k0) f.k0 = { x: b.x, y: b.y };
      const act = !f.done && age > 0.02 && this.skBTid === f.id && b.skId === f.id && !b.owner && this.skBTfade == null && BT && BT.length > 1;
      if (act) { f.on = 1; f.last = { x: b.x, y: b.y }; const n = BT.length, p1 = this.skP(BT[n - 1].x, BT[n - 1].y), p0 = this.skP(BT[Math.max(0, n - 4)].x, BT[Math.max(0, n - 4)].y); if (Math.hypot(p1.x - p0.x, p1.y - p0.y) > 3) f.ang = Math.atan2(p1.y - p0.y, p1.x - p0.x); }
      else if (f.on && !f.done) { f.done = 1; f.endT0 = now; }
      if (f.ang == null) { const tg = f.b ? f.b : e ? { x: this.goalX(e.team), y: (b.shot && b.shot.ty) || H / 2 } : null, a = this.skP(f.k0.x, f.k0.y), q = tg ? this.skP(tg.x, tg.y) : { x: a.x + 1, y: a.y }; f.ang = Math.atan2(q.y - a.y, q.x - a.x); }
      const fy = Math.cos(f.ang) < 0 ? -1 : 1;
      if (age < S.impT && R.imp && R.imp.length) { const P = S.impBall ? b : f.k0, q = this.skP(P.x, P.y); this.skSprD(ctx, f.id, this.skSeq(R.imp, age, S.impT), q.x, q.y, this.skHH(P.x, P.y), { rot: f.ang, fy }); }
      if (act) { const tt = now - (f.tOn ?? (f.tOn = now)), A = R.trail, i = Math.floor(tt * S.fps), L = Math.min(2, A.length), fr = i < A.length ? A[i] : A[A.length - L + ((i - A.length) % L)], q = this.skP(b.x, b.y); this.skSprD(ctx, f.id, fr, q.x, q.y, this.skHH(b.x, b.y), { rot: f.ang, fy, a: Math.min(1, tt * 12) }); }
      if (f.done && R.end && now - f.endT0 < S.endT) { const P = f.last, q = this.skP(P.x, P.y); this.skSprD(ctx, f.id, this.skSeq(R.end, now - f.endT0, S.endT), q.x, q.y, this.skHH(P.x, P.y), { rot: f.ang, fy, a: 1 - 0.5 * ((now - f.endT0) / S.endT) }); }
      f.hold = f.done ? f.endT0 + S.endT : age < 3 ? now + 0.15 : 0; }
    skGlow(ctx, pts, col, w, a) { // linha neon (3 passadas: brilho largo, cor, miolo branco) em pontos já projetados
      if (pts.length < 2) return; ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (const [lw, c, al] of [[w * 2.2, col, 0.38], [w, col, 1], [w * 0.35, "255,255,255", 0.95]]) { ctx.lineWidth = lw; ctx.strokeStyle = `rgba(${c},${al * a})`; ctx.shadowColor = `rgba(${col},${a})`; ctx.shadowBlur = lw === w ? 14 : 0; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); }
      ctx.restore();
    }
    skStar(ctx, x, y, r, col, a) { ctx.save(); ctx.shadowColor = `rgb(${col})`; ctx.shadowBlur = 8; ctx.fillStyle = `rgba(${col},${a})`; ctx.beginPath(); for (let n = 0; n < 8; n++) { const rr = n % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos((n * Math.PI) / 4) * rr, y + Math.sin((n * Math.PI) / 4) * rr); } ctx.fill(); ctx.restore(); }
    skChev(ctx, x, y, ang, s, col, a) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.shadowColor = `rgb(${col})`; ctx.shadowBlur = 8; ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = s * 0.32; ctx.lineCap = "round"; ctx.lineJoin = "round"; for (const o of [-s * 0.45, s * 0.25]) { ctx.beginPath(); ctx.moveTo(o - s * 0.35, -s * 0.5); ctx.lineTo(o + s * 0.15, 0); ctx.lineTo(o - s * 0.35, s * 0.5); ctx.stroke(); } ctx.restore(); }
    skRing(ctx, x, y, r, col, a, lw = 3) { const p = this.skP(x, y), k = p.k || 1, g = p.g || 1; ctx.save(); ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = lw; ctx.shadowColor = `rgb(${col})`; ctx.shadowBlur = 10; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * k, r * k * g, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    drawSkills(ctx, layer) {
      if (!this.skOn()) return; const now = this.time, F = this.skFx || [], b = this.ball, TAU = Math.PI * 2;
      const COL = { direct: "38,217,255", voleio: "255,70,190", curvado: "60,240,170", magico: "255,70,180", calibrado: "150,225,255", tabela: "255,215,60", /* v685: cores das artes do Mickey */ visao: "120,220,255", muralha: "120,255,140" };
      if (!layer) {
        // Visão de Jogo: o campo escurece por baixo dos jogadores e as linhas acendem por cima do gramado
        for (const t of [0, 1]) { const T = this.skT(t); if (!(T.visao > now)) continue; const left = T.visao - now, aIn = Math.min(1, (C.SKILL_DEF.visao.t - left) * 4, left * 3);
          const cv = ctx.canvas; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(2,8,24,${0.38 * aIn})`; ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore();
          const c = COL.visao; ctx.save(); ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(${c},${0.16 * aIn})`; ctx.beginPath(); // grade da visão espacial
          for (let x = 0; x <= W; x += 64) { const p0 = this.skP(x, 0), p1 = this.skP(x, H); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); }
          for (let y = 0; y <= H; y += 56) { const p0 = this.skP(0, y), p1 = this.skP(W, y); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); } ctx.stroke(); ctx.restore();
          const o = b.owner && !b.owner.gk && b.owner.team === t ? b.owner : this.field(t)[0]; if (!o) continue; const d = this.dir(t), gx = this.goalX(t), po = this.skP(o.x, o.y + 6);
          for (let i = -5; i <= 5; i++) { const a0 = (d > 0 ? 0 : Math.PI) + i * 0.13, L = 380 + 60 * Math.sin(now * 3 + i), q = this.skP(o.x + Math.cos(a0) * L, o.y + Math.sin(a0) * L); // cone de visão
            const g = ctx.createLinearGradient(po.x, po.y, q.x, q.y); g.addColorStop(0, `rgba(${c},${0.55 * aIn})`); g.addColorStop(1, `rgba(${c},0)`); ctx.save(); ctx.strokeStyle = g; ctx.lineWidth = i % 2 ? 1.6 : 3; ctx.beginPath(); ctx.moveTo(po.x, po.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.restore(); }
          const best = this.skBest(o, 40); const targets = this.field(t).filter((m) => m !== o && (m.x - o.x) * d > -40);
          for (const m of targets) { const pm = this.skP(m.x, m.y + 6); ctx.save(); ctx.setLineDash([10, 8]); ctx.lineDashOffset = -now * 70; ctx.strokeStyle = `rgba(${c},${(m === best ? 0.95 : 0.5) * aIn})`; ctx.lineWidth = m === best ? 4 : 2.2; ctx.shadowColor = `rgb(${c})`; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(po.x, po.y); ctx.lineTo(pm.x, pm.y); ctx.stroke(); ctx.restore();
            this.skRing(ctx, m.x, m.y + 8, 22 + 3 * Math.sin(now * 6), c, 0.7 * aIn, 2);
            if (m === best) { const s = 22 + 2 * Math.sin(now * 8); ctx.save(); ctx.strokeStyle = `rgba(${c},${aIn})`; ctx.lineWidth = 3; ctx.shadowColor = `rgb(${c})`; ctx.shadowBlur = 12; const cx = pm.x, cy = pm.y - 26; // mira quadrada no melhor alvo
              for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.beginPath(); ctx.moveTo(cx + sx * s, cy + sy * s * 0.4); ctx.lineTo(cx + sx * s, cy + sy * s); ctx.lineTo(cx + sx * s * 0.4, cy + sy * s); ctx.stroke(); } ctx.restore();
              const ang = Math.atan2(pm.y - po.y, pm.x - po.x); for (let j = 1; j <= 2; j++) { const f = (((now * 0.8 + j * 0.33) % 1) * 0.6) + 0.2; this.skChev(ctx, po.x + (pm.x - po.x) * f, po.y + (pm.y - po.y) * f, ang, 14, c, aIn); } } }
          const pg = this.skP(gx - d * 40, H / 2); ctx.save(); ctx.setLineDash([4, 10]); ctx.lineDashOffset = -now * 50; ctx.strokeStyle = `rgba(${c},${0.45 * aIn})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(po.x, po.y); ctx.lineTo(pg.x, pg.y); ctx.stroke(); ctx.restore();
          this.skRing(ctx, gx - d * 40, H / 2, 18, c, 0.8 * aIn, 2.5); this.skRing(ctx, gx - d * 40, H / 2, 30 + 6 * Math.sin(now * 5), c, 0.4 * aIn, 1.5);
          if (this.skImg("visao")) { const VS = C.SKILL_SPR.visao, el = C.SKILL_DEF.visao.t - left, fr = el < VS.inT ? this.skSeq([0, 1, 2, 3, 4], el, VS.inT) : left < VS.outT ? this.skSeq([7, 8, 9], VS.outT - left, VS.outT) : [5, 6][Math.floor(now * VS.fps) % 2], pf = this.skP(o.x, o.y + C.SPRITE_FEET); this.skSprD(ctx, "visao", fr, pf.x, pf.y, this.skHH(o.x, o.y)); } // v685: anel de peças do Mickey
          else { this.skRing(ctx, o.x, o.y + 10, 26, c, 0.9 * aIn, 3); this.skRing(ctx, o.x, o.y + 10, 40 + 8 * ((now * 1.5) % 1), c, 0.6 * aIn * (1 - ((now * 1.5) % 1)), 2); } }
        // Energia Infinita: aura azul no pé de cada um do time
        for (const e of this.ents) { if (e.gk || !(this.skT(e.team).energia > now)) continue; const p = (now * 2 + e.x * 0.01) % 1; if (this.skImg("energia")) { const pf = this.skP(e.x, e.y + C.SPRITE_FEET - 4); this.skSprD(ctx, "energia", Math.floor(now * C.SKILL_SPR.energia.fps + e.x * 0.05) % 6, pf.x, pf.y, this.skHH(e.x, e.y)); continue; } this.skRing(ctx, e.x, e.y + C.SPRITE_FEET - 4, 30, "60,170,255", 0.95, 5); this.skRing(ctx, e.x, e.y + C.SPRITE_FEET - 4, 30 + p * 34, "120,210,255", 0.7 * (1 - p), 2); }
        // Muralha do Capitão: favo hexagonal verde neon na frente do gol
        for (const t of [0, 1]) { const Wl = this.skT(t).wall; if (!Wl || Wl.until < now) continue; // v686 (Mickey): favo e cobra juntos
          const x0 = this.ownGoalX(t) + this.dir(t) * 72, pu = 0.7 + 0.3 * Math.sin(now * 6), R = 18; ctx.save(); ctx.lineWidth = 3.5; ctx.strokeStyle = `rgba(150,255,160,${pu})`; ctx.fillStyle = `rgba(40,230,90,${0.24 + 0.1 * pu})`; ctx.shadowColor = "#3dff6e"; ctx.shadowBlur = 16;
          for (let cx = -1; cx <= 1; cx++) for (let y = MOUTH_T - 40 + (cx & 1) * R * 0.87; y <= MOUTH_B + 40; y += R * 1.73) { ctx.beginPath(); for (let n = 0; n < 6; n++) { const q = this.skP(x0 + cx * R * 1.5 + Math.cos((n * Math.PI) / 3) * R, y + Math.sin((n * Math.PI) / 3) * R); n ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); } ctx.closePath(); ctx.fill(); ctx.stroke(); } ctx.restore(); if (this.skImg("muralha")) { const MS = C.SKILL_SPR.muralha, el = now - (Wl.until - Wl.s.d.t), fr = el < MS.inT ? this.skSeq([0, 1], el, MS.inT) : [3, 4, 5, 4][Math.floor((el - MS.inT) * MS.fps) % 4], xs = this.ownGoalX(t) + this.dir(t) * MS.ahead, pf = this.skP(xs, H / 2 + C.SPRITE_FEET); this.skSprD(ctx, "muralha", fr, pf.x, pf.y, this.skHH(xs, H / 2), { bot: 1, fx: this.dir(t), a: Math.min(1, el * 6) }); } }
        // rastros das arrancadas (Pantera rosa, Reta azul) e caminho do Monstro
        for (const e of this.ents) { if (e.gk) continue;
          if (e.skTr && e.skSpd && e.skTr.length > 1) { const pts = e.skTr.map((q) => this.skP(q.x, q.y + 8)); pts.push(this.skP(e.x, e.y + 8)); this.skGlow(ctx, pts, e.skSpd.col, 18, Math.min(1, (e.skSpd.until - now) * 2)); }
          if (e.skDrib > 0 && b.owner === e) { const d = this.dir(e.team), c = "200,90,255", pts = []; for (let i = 0; i <= 6; i++) pts.push(this.skP(e.x + d * (30 + i * 34), e.y + 10 + (i % 2 ? 26 : -26) * (i ? 1 : 0)));
            ctx.save(); ctx.setLineDash([10, 9]); ctx.lineDashOffset = -now * 80; ctx.strokeStyle = `rgba(${c},.9)`; ctx.lineWidth = 3; ctx.shadowColor = `rgb(${c})`; ctx.shadowBlur = 10; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.restore();
            for (let i = 2; i <= 5; i += 3) this.skChev(ctx, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2, Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x), 14, "120,200,255", 0.9); } }
        // rastro de luz da bola (chute ou passe de habilidade)
        const BT = this.skBT; if (BT && BT.length > 1) { const c = COL[this.skBTid] || this.skBTc || "38,217,255", pts = BT.map((q) => this.skP(q.x, q.y)), fade = this.skBTfade == null ? 1 : this.skBTfade;
          for (let i = 1; i < pts.length; i++) this.skGlow(ctx, [pts[i - 1], pts[i]], c, 5 + 15 * (i / pts.length), fade * (i / pts.length));
          if (["magico", "curvado", "voleio", "direct"].includes(this.skBTid) && !this.skImg(this.skBTid)) for (let i = 0; i < pts.length; i += 2) { const q = pts[i], tw = 0.5 + 0.5 * Math.sin(now * 20 + i * 1.7); this.skStar(ctx, q.x + Math.sin(i * 7.1) * 16, q.y + Math.cos(i * 5.3) * 12, 5 + 7 * tw, i % 4 ? c : "255,255,255", fade * tw); } }
        // v685: cobra dando o bote quando a Muralha bloqueia; asas do Voleio nas costas; Monstro atrás de quem dribla
        for (const f of F) { const age = now - f.t0;
          if (f.id === "wallHit" && this.skImg("muralha")) { const xs = this.ownGoalX(f.team) + this.dir(f.team) * C.SKILL_SPR.muralha.ahead, pf = this.skP(xs, H / 2 + C.SPRITE_FEET); this.skSprD(ctx, "muralha", 2, pf.x, pf.y, this.skHH(xs, H / 2), { bot: 1, fx: this.dir(f.team), a: Math.min(1, (f.life - age) * 5) }); }
          if (f.id === "voleio" && f.e && this.skImg("voleio")) { const VS = C.SKILL_SPR.voleio; if (age > VS.dur) continue; f.hold = f.t0 + VS.dur; const e = f.e, pf = this.skP(e.x, e.y + C.SPRITE_FEET), hh = this.skHH(e.x, e.y); this.skSprD(ctx, "voleio", this.skSeq([0, 1, 2, 3, 4, 5], age, VS.dur), pf.x, pf.y - hh * VS.up, hh, { a: Math.min(1, (VS.dur - age) * 6) }); } }
        if (this.skImg("monstro")) { const MS = C.SKILL_SPR.monstro; for (const e of this.ents) { if (e.gk) continue; const on = e.skDrib > 0 || F.some((f) => f.id === "monstro" && f.e === e && now - f.t0 < 1.6);
          if (on && !e.skMonOn) e.skMonT0 = now; if (!on && e.skMonOn) e.skMonOff = now; e.skMonOn = on; const off = !on && e.skMonOff != null && now - e.skMonOff < 0.35; if (!on && !off) continue;
          const el = now - (e.skMonT0 || now), fr = off ? 5 : el < MS.inT ? this.skSeq([0, 1, 2], el, MS.inT) : [2, 3, 4, 3][Math.floor((el - MS.inT) * MS.fps) % 4], pf = this.skP(e.x, e.y + C.SPRITE_FEET), hh = this.skHH(e.x, e.y), face = this.dir(e.team);
          this.skSprD(ctx, "monstro", fr, pf.x - face * MS.back * hh, pf.y + 4, hh, { bot: 1, fx: face, a: off ? 1 - (now - e.skMonOff) / 0.35 : 1 }); } }
        { const PS = C.SKILL_SPR && C.SKILL_SPR.pantera, im = PS && (BL.pantImg || (BL.pantImg = Object.assign(new Image(), { src: `${PS.src}?v=${BL.BUILD}` }))); // v683 (Mickey): pantera animada da arte dele + campo tingido
          const on = PS ? this.ents.filter((e) => !e.gk && e.skSpd && !e.skSpd.reta && e.skSpd.until > now) : [];
          if (on.length) { const dT = C.SKILL_DEF.pantera.t, aIn = Math.max(...on.map((e) => Math.min(1, (e.skSpd.until - now) * 2, (dT - (e.skSpd.until - now)) * 4)));
            const cv = ctx.canvas; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(${PS.tint},${PS.tintA * aIn})`; ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore();
            if (im.complete && im.naturalWidth) for (const e of on) { const left = e.skSpd.until - now, el = Math.max(0, dT - left), fr = Math.min(PS.n * PS.loops - 1, Math.floor((el / dT) * PS.n * PS.loops)) % PS.n, a = Math.min(1, left * 2, el * 5);
              const pf = this.skP(e.x, e.y + C.SPRITE_FEET), hh = (e.sprHH || 70) * (IMG.persp ? (pf.k || 1) * IMG.persp.spr : 1), face = Math.sign(e.vx || this.dir(e.team)) || 1, sw = im.naturalWidth / PS.n, sz = hh * PS.w;
              ctx.save(); ctx.globalAlpha = PS.alpha * a; ctx.translate(pf.x - face * PS.back * (hh / 70), pf.y - hh * PS.up); ctx.scale(face, 1); ctx.drawImage(im, fr * sw, 0, sw, im.naturalHeight, -sz / 2, -sz / 2, sz, sz); ctx.restore(); } } }
        return;
      }
      for (const f of F) { const age = now - f.t0, k = Math.max(0, 1 - age / f.life);
        if (f.id === "ego") { /* v686: saiu da faixa para o campo, junto de quem ativou */ const k = Math.min(1, age * 5, (f.life - age) * 3), cv = ctx.canvas, pe = f.e ? this.skP(f.e.x, f.e.y) : this.skP(W / 2, H / 2), mc = ctx.getTransform().transformPoint(new DOMPoint(pe.x, pe.y)); /* v686: raios saem de quem ativou */ ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(0,0,0,${0.5 * k})`; ctx.fillRect(0, 0, cv.width, cv.height); ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.translate(mc.x, mc.y); ctx.rotate(now * 0.6); for (let i = 0; i < 16; i++) { ctx.rotate(Math.PI / 8); const L = cv.height * (0.45 + 0.15 * Math.sin(now * 9 + i * 2)); const g = ctx.createLinearGradient(0, 0, L, 0); g.addColorStop(0, `rgba(255,200,60,${0.5 * k})`); g.addColorStop(1, "rgba(255,120,30,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, -cv.height * 0.018); ctx.lineTo(L, cv.height * 0.018); ctx.fill(); } ctx.restore(); /* v637: raios dourados */
        ctx.restore(); /* v686 (Mickey): sem a palavra EGO; o Ego aparece do lado de quem ativou */
          if (f.e && this.skImg("ego")) { const e = f.e, ES = C.SKILL_SPR.ego, hh = this.skHH(e.x, e.y), pf = this.skP(e.x - this.dir(e.team) * ES.side, e.y + C.SPRITE_FEET); this.skSprD(ctx, "ego", Math.min(ES.n - 1, Math.floor((age / f.life) * ES.n)), pf.x, pf.y + 4, hh, { bot: 1 }); } }
        if (C.SKILL_SPR[f.id] && C.SKILL_SPR[f.id].kick && this.skImg(f.id)) { this.skKick(ctx, f, age); continue; } // v685: impacto no chute + rastro preso na bola
        if ((f.id === "ninja" || f.id === "ninjaOut") && f.e && this.skImg("ninja")) { const NS = C.SKILL_SPR.ninja; if (!f.p0) f.p0 = { x: f.e.x, y: f.e.y }; if (age < NS.dur) { f.hold = f.t0 + NS.dur; const pf = this.skP(f.p0.x, f.p0.y + C.SPRITE_FEET); this.skSprD(ctx, "ninja", this.skSeq([0, 1, 2, 3, 4, 5], age, NS.dur), pf.x, pf.y + 6, this.skHH(f.p0.x, f.p0.y), { bot: 1, a: Math.min(1, (NS.dur - age) * 5) }); } continue; } // v685: fumaça ao sumir e ao reaparecer
        if (f.id === "direct" && f.e) { const e = f.e, gx = this.goalX(e.team), ty = (b.shot && b.shot.ty) || H / 2, pg = this.skP(gx - this.dir(e.team) * 6, ty), r = 30 + 22 * (1 - k), rot = now * 4; // mira e clarão no gol
          ctx.save(); ctx.translate(pg.x, pg.y - 18); const gr = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2.2); gr.addColorStop(0, `rgba(255,255,255,${0.9 * k})`); gr.addColorStop(0.35, `rgba(38,217,255,${0.6 * k})`); gr.addColorStop(1, "rgba(38,217,255,0)"); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, TAU); ctx.fill();
          ctx.strokeStyle = `rgba(150,240,255,${k})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.rotate(rot); for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(r * 0.5, 0); ctx.lineTo(r * 1.6, 0); ctx.stroke(); } ctx.restore(); }
        if (f.id === "voleio" && f.e && !this.skImg("voleio")) { const e = f.e, p = this.skP(e.x, e.y + C.SPRITE_FEET - 40), d = this.dir(e.team), sp = 1 - k; // arco azul do movimento + estouro laranja
          ctx.save(); ctx.lineCap = "round"; for (const [lw, c, a] of [[26, "40,140,255", 0.35], [9, "80,190,255", 1], [3, "255,255,255", 1]]) { ctx.lineWidth = lw; ctx.strokeStyle = `rgba(${c},${a * k})`; ctx.beginPath(); ctx.arc(p.x, p.y, 72, d > 0 ? Math.PI * 0.55 : Math.PI * 1.45, d > 0 ? Math.PI * 1.75 : Math.PI * 0.25, d < 0); ctx.stroke(); }
          for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, r0 = 16 + sp * 46, r1 = r0 + 28 + (i % 3) * 16; ctx.strokeStyle = `rgba(255,${170 + (i % 2) * 60},40,${k})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(p.x + d * 30 + Math.cos(a) * r0, p.y - 20 + Math.sin(a) * r0); ctx.lineTo(p.x + d * 30 + Math.cos(a) * r1, p.y - 20 + Math.sin(a) * r1); ctx.stroke(); }
          const gr = ctx.createRadialGradient(p.x + d * 30, p.y - 20, 2, p.x + d * 30, p.y - 20, 64); gr.addColorStop(0, `rgba(255,255,220,${k})`); gr.addColorStop(1, "rgba(255,150,30,0)"); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x + d * 30, p.y - 20, 64, 0, TAU); ctx.fill(); ctx.restore(); }
        if ((f.id === "magico" || f.id === "calibrado" || f.id === "tabela") && f.a && f.b) { const A = this.skP(f.a.x, f.a.y + 4), B2 = this.skP(f.b.x, f.b.y + 4), c = COL[f.id];
          if (f.id === "calibrado") { this.skGlow(ctx, [A, B2], c, 9, k); for (const q of [A, B2]) this.skStar(ctx, q.x, q.y - 4, 26 * k + 10, "200,240,255", k); }
          else if (f.id === "magico") { this.skGlow(ctx, [A, B2], c, 10, k); for (let i = 0; i < 8; i++) { const t = (i + 0.5) / 8; this.skStar(ctx, A.x + (B2.x - A.x) * t + Math.sin(i * 3.1 + now * 6) * 8, A.y + (B2.y - A.y) * t + Math.cos(i * 2.3 + now * 5) * 12, 7 + 5 * Math.sin(now * 12 + i), "255,230,120", k); } }
          else { const L = Math.hypot(B2.x - A.x, B2.y - A.y) || 1, ux = (B2.x - A.x) / L, uy = (B2.y - A.y) / L, pts = [A]; for (let s = 18, i = 0; s < L - 10; s += 18, i++) { const n = i % 2 ? 10 : -10; pts.push({ x: A.x + ux * s - uy * n, y: A.y + uy * s + ux * n }); } pts.push(B2); this.skGlow(ctx, pts, c, 7, k); this.skChev(ctx, (A.x + B2.x) / 2, (A.y + B2.y) / 2 - 20, Math.atan2(uy, ux), 26, c, k); } }
        if (f.id === "ninjaOut" && f.e && !this.skImg("ninja")) { const p = this.skP(f.e.x, f.e.y + C.SPRITE_FEET - 34); ctx.save(); const gr = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 50 * (1.3 - k)); gr.addColorStop(0, `rgba(240,200,255,${k})`); gr.addColorStop(1, "rgba(160,60,255,0)"); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, 50 * (1.3 - k), 0, TAU); ctx.fill();
          ctx.strokeStyle = `rgba(200,120,255,${k})`; ctx.lineWidth = 3; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.3, r0 = 20 + (1 - k) * 20; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0); ctx.lineTo(p.x + Math.cos(a) * (r0 + 16), p.y + Math.sin(a) * (r0 + 16)); ctx.stroke(); } ctx.restore(); }
      }
      for (const e of this.ents) { if (e.gk) continue; const pf = this.skP(e.x, e.y + C.SPRITE_FEET), sc = pf.k || 1, hh = (e.sprHH || 70) * (IMG.persp ? sc * IMG.persp.spr : 1), top = pf.y - hh, face = Math.sign(e.vx || this.dir(e.team)) || 1;
        if (e.skSpd && !e.skSpd.reta && e.skSpd.until > now && !(C.SKILL_SPR && C.SKILL_SPR.pantera && BL.pantImg && BL.pantImg.naturalWidth)) { const a = Math.min(1, (e.skSpd.until - now) * 2), cx = pf.x - face * 64, cy = top + hh * 0.4, s = (hh / 70) * 1.7; // Pantera: silhueta de pantera de energia rosa atrás
          ctx.save(); ctx.translate(cx, cy); ctx.scale(face * s, s); ctx.lineJoin = "round"; ctx.lineCap = "round"; const jaw = 4 * Math.sin(now * 14);
          const head = () => { ctx.beginPath(); ctx.moveTo(-60, 10); ctx.quadraticCurveTo(-40, -22, -8, -26); ctx.lineTo(0, -40); ctx.lineTo(8, -26); ctx.lineTo(20, -36); ctx.lineTo(24, -20); ctx.quadraticCurveTo(44, -14, 52, -2); ctx.lineTo(36, 2); ctx.lineTo(48, 8 + jaw); ctx.lineTo(30, 14 + jaw); ctx.quadraticCurveTo(10, 22, -20, 24); ctx.quadraticCurveTo(-48, 26, -60, 10); };
          head(); ctx.fillStyle = `rgba(200,0,90,${0.42 * a})`; ctx.fill();
          for (const [lw, c, al] of [[10, "255,20,120", 0.45], [4, "255,60,160", 1], [1.5, "255,220,240", 1]]) { head(); ctx.lineWidth = lw; ctx.strokeStyle = `rgba(${c},${al * a})`; ctx.shadowColor = "#ff1e8c"; ctx.shadowBlur = lw === 4 ? 16 : 0; ctx.stroke(); } ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(26, -12, 2.6, 0, TAU); ctx.fill();
          for (let i = 0; i < 5; i++) { const y = -18 + i * 9, l = 30 + ((now * 260 + i * 41) % 50); ctx.strokeStyle = `rgba(255,90,170,${0.6 * a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-64 - l, y); ctx.lineTo(-62, y); ctx.stroke(); } ctx.restore(); }
        if (!this.skImg("monstro") && (e.skDrib > 0 || F.some((f) => f.id === "monstro" && f.e === e && now - f.t0 < 1.6))) { const p = 0.5 + 0.5 * Math.sin(now * 5), cx = pf.x - face * 30, cy = top + hh * 0.05, s = (hh / 70) * 1.7; // Monstro: sombra roxa com olhos e sorriso
          ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); const gr = ctx.createRadialGradient(0, 4, 6, 0, 4, 58); gr.addColorStop(0, "rgba(40,6,70,.85)"); gr.addColorStop(0.7, "rgba(100,20,180,.6)"); gr.addColorStop(1, "rgba(120,40,220,0)"); ctx.fillStyle = gr;
          ctx.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, r = 44 + 10 * Math.sin(a * 5 + now * 7) + (a > Math.PI ? 8 : 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 1.05); } ctx.fill();
          ctx.fillStyle = `rgba(230,170,255,${0.8 + 0.2 * p})`; ctx.shadowColor = "#d07bff"; ctx.shadowBlur = 14;
          for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 6, -10); ctx.quadraticCurveTo(sx * 20, -22, sx * 26, -8); ctx.quadraticCurveTo(sx * 16, -6, sx * 6, -10); ctx.fill(); }
          ctx.beginPath(); ctx.moveTo(-20, 6); for (let i = 0; i <= 8; i++) ctx.lineTo(-20 + i * 5, 6 + (i % 2 ? 7 : 0) + Math.sin((i / 8) * Math.PI) * 6); ctx.quadraticCurveTo(0, 26, -20, 6); ctx.fill(); ctx.restore(); }
        if (e.skNinja > now && e.skNjTr) { const g = e.p && BL.fieldSprite(e.p.charId) && e.spr; e.skNjTr.forEach((q, i) => { const a = 0.12 + (i / e.skNjTr.length) * 0.22; // Ninja: imagens residuais roxas
          if (g) { this.at(ctx, q.x, q.y, false, q.y + C.SPRITE_FEET); ctx.globalAlpha = Math.min(0.75, a * 1.8); ctx.filter = "sepia(1) hue-rotate(220deg) saturate(4) brightness(1.2)"; this.spriteAt(ctx, g.im, q.x, q.y, e.face || 1, g.rot, 0, 0, 1, 1, g.fi, g.n, g.px); ctx.filter = "none"; ctx.restore(); }
          else this.skRing(ctx, q.x, q.y, 12, "170,90,255", a * 2); this.skRing(ctx, q.x, q.y + C.SPRITE_FEET - 4, 18, "180,90,255", a * 2.2, 3); }); ctx.globalAlpha = 1; }
        if (e.skSpd && e.skSpd.reta && e.skSpd.until > now) { ctx.save(); ctx.lineCap = "round"; for (let i = 0; i < 9; i++) { const yy = top + hh * 0.1 + i * hh * 0.1, off = (now * 900 + i * 37) % 70, l = 30 + (i % 3) * 18; ctx.strokeStyle = i % 3 ? "rgba(80,170,255,.9)" : "rgba(230,245,255,.95)"; ctx.lineWidth = i % 3 ? 3 : 4.5; ctx.shadowColor = "#50aaff"; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(pf.x - face * (22 + off), yy); ctx.lineTo(pf.x - face * (22 + off + l), yy); ctx.stroke(); } ctx.restore(); }
        if (this.skT(e.team).energia > now && !this.skImg("energia")) { const y0 = top - 16 + Math.sin(now * 9 + e.x) * 3, x0 = pf.x - 10; ctx.save(); ctx.fillStyle = "#ffe14a"; ctx.shadowColor = "#ffd000"; ctx.shadowBlur = 14; // raio + setas para cima
          ctx.beginPath(); ctx.moveTo(x0 + 6, y0 - 21); ctx.lineTo(x0 - 8, y0 + 2); ctx.lineTo(x0 + 2, y0 + 2); ctx.lineTo(x0 - 4, y0 + 20); ctx.lineTo(x0 + 11, y0 - 4); ctx.lineTo(x0 + 2, y0 - 4); ctx.lineTo(x0 + 9, y0 - 21); ctx.closePath(); ctx.fill(); ctx.restore();
          for (let j = 0; j < 2; j++) this.skChev(ctx, pf.x + 16, y0 + 6 - j * 12 - ((now * 24) % 12), -Math.PI / 2, 18, "90,190,255", 0.9); }
      }
    }
    // faixa pequena com o nome da habilidade (cor da raridade), no lado do time; Visão de Jogo e Ego escurecem a tela
    drawSkillBanner(ctx) {
      if (!this.skOn()) return; const now = this.time;
      for (const f of this.skFx || []) { const age = now - f.t0;
      }
      const Q = this.skQ; if (!Q || !Q.length) return; const B = Q[0], D = 1.8, rt = performance.now(); if (B.t0 == null) B.t0 = rt;
      const age = (rt - B.t0) / 1000; if (age > D) { Q.shift(); return; }
      const col = (C.SKILL_RAR_COL || {})[B.rar] || "#3f9bff", inK = Math.min(1, age / 0.18), out = Math.max(0, (age - (D - 0.25)) / 0.25), left = B.team === 0;
      const bw = Math.min(W * 0.42, 420), bh = 46, x = left ? 18 - (1 - inK) * bw - out * bw : W - 18 - bw + (1 - inK) * bw + out * bw, y = H * 0.2;
      ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(x, y);
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(bw, 0); ctx.lineTo(bw - 12, bh); ctx.lineTo(0, bh); ctx.closePath(); ctx.fillStyle = "rgba(5,9,20,.88)"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = col; ctx.fillRect(left ? 6 : bw - 14, 6, 8, bh - 12);
      const ai = BL.skArt || (BL.skArt = Object.assign(new Image(), { src: `img/skills.jpg?v=${BL.BUILD}` })), sd = BL.SKILLS && BL.SKILLS[B.id], ic = ai.complete && ai.naturalWidth && sd; // v629: ícone do Mickey na faixa
      if (ic) { const iw = 46, ih = 60, ixp = left ? 18 : bw - 18 - iw; ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.drawImage(ai, (sd.ix % 7) * 132, Math.floor(sd.ix / 7) * 172, 132, 172, ixp, bh / 2 - ih / 2, iw, ih); ctx.restore(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.strokeRect(ixp, bh / 2 - ih / 2, iw, ih); }
      ctx.textBaseline = "middle"; ctx.textAlign = left ? "left" : "right"; const tx = left ? (ic ? 74 : 24) : bw - (ic ? 74 : 24);
      ctx.font = "italic 900 22px 'Barlow Condensed', Impact, sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText(B.name.toUpperCase(), tx, 17);
      ctx.font = "700 13px 'Barlow Condensed', sans-serif"; ctx.fillStyle = col; ctx.fillText(B.who, tx, 36);
      ctx.restore();
    }
    captK(t) { return this.field(t).some((m) => this.ifx(m).capt) ? 1 + C.ITEM_FX["cm-capitao"].capt : 1; } // Camisa do Capitão: só 1 por time
    // ---------- status ----------
    field(t) { return this.ents.filter((e) => !e.gk && e.team === t); }
    arenaMult(e) {
      if (!this.arena) return 1;
      return e.team === 1 ? 1 + this.arena.bossBuff : 1 - this.arena.userDebuff;
    }
    fatigue(e) {
      if (e.energy >= C.ENERGY_LOW) return 1;
      return C.ENERGY_MIN_MULT + (1 - C.ENERGY_MIN_MULT) * (e.energy / C.ENERGY_LOW);
    }
    statMod(e, k) { const m = this.mods[e.team] || {}; return (m.all || 1) * (m[k] || 1); }
    // e.rel = nível relativo ao time adversário (1 = mesmo nível): quem tem nível mais alto chuta, passa, corre e decide melhor
    posIv(e, k) { const P = C.POS_IV; if (!P) return 1; const r = e.fixo ? P.fixo : e.alaDef ? P.alaDef : e.alaOf ? P.alaOf : e.pivo ? P.pivo : null; return (r && r[k]) || 1; } // v500 (Mickey): IVs que mais contam por posição (Ala Def 1× em tudo)
    iv(e, k) { return BL.baseStat(e.p, k) * this.cmul(e, k) * this.posIv(e, k) * this.fatigue(e) * this.arenaMult(e) * this.statMod(e, k) * (e.rel || 1) * (this.pfx.stats || 1) * this.fitK(e); }
    // ataca agora? Time sem atacantes vira todo ataque quando está com a bola (contra-ataque)
    // v197 · ideia de jogo (visão do Mickey): "build" = formação defensiva (mais defensores que atacantes, fora do 4×4)
    // constrói com passes curtos e sobe o bloco junto; "attack" = ofensiva (mais atacantes, e a Blitz do 4×4) troca
    // passes agressivos: tabela de primeira, infiltração e inversão. Muralha e Toque de bola mantêm o estilo deles
    planFor(t) {
      if (this.training) return null;
      const sk = this.styleKey[t];
      if (sk === "blitz") return "attack";
      if (sk) return null;
      const f = this.field(t), atk = f.filter((e) => e.role !== "def").length, def = f.length - atk;
      if (f.length < 2 || atk === def) return null;
      return atk > def ? "attack" : "build";
    }
    // construção: os companheiros acompanham quem está com a bola, perto, e se oferecem no espaço livre
    // (à frente ou ao lado, com a linha de passe aberta); a cobertura curta atrás é a última opção. Todo mundo sobe junto
    buildSpot(e, own) {
      if (e.bsT > this.time && e.bsOwn === own) return { x: e.bsX, y: e.bsY }; // não fica trocando de lugar a cada quadro
      const t = e.team, d = this.dir(t), og = this.ownGoalX(t), gx = this.goalX(t);
      // com dois ou mais apoios, o mais recuado fica de sobra atrás da bola (segura o contra-ataque); os outros se oferecem
      const sup = this.field(t).filter((m) => m !== own && m.role === "def");
      if (sup.length >= 2 && sup.reduce((r, m) => ((m.x - og) * d < (r.x - og) * d ? m : r)) === e) {
        const x = U.clamp(own.x - d * C.BUILD_COVER, Math.min(og + d * 60, W / 2), Math.max(og + d * 60, W / 2));
        e.bsT = this.time + 0.35; e.bsOwn = own; e.bsX = x; e.bsY = U.clamp(H / 2 + (own.y - H / 2) * 0.3, 60, H - 60);
        return { x: e.bsX, y: e.bsY };
      }
      const opps = this.field(1 - t), taken = this.field(t).filter((m) => m !== e && m !== own && m.bsOwn === own && m.bsT > this.time);
      const lo = Math.min(og + d * 60, gx - d * 130), hi = Math.max(og + d * 60, gx - d * 130);
      let best = null;
      for (let a = -C.BUILD_ARC; a <= C.BUILD_ARC; a += 15) {
        for (const r of [C.BUILD_AHEAD, C.BUILD_AHEAD + 50]) {
          const ang = (a * Math.PI) / 180, x = U.clamp(own.x + d * Math.cos(ang) * r, lo, hi), y = U.clamp(own.y + Math.sin(ang) * r, 60, H - 60);
          const free = Math.min(130, opps.reduce((m, o) => Math.min(m, hyp(o.x - x, o.y - y)), 999));
          const lane = this.laneBlocked(own, { x, y }) ? 110 : 0;
          const near = taken.some((m) => hyp(m.bsX - x, m.bsY - y) < 110) ? 150 : 0; // não ocupa o mesmo espaço de outro apoio
          const score = free + Math.cos(ang) * C.BUILD_FWD - lane - near - hyp(e.x - x, e.y - y) * 0.12;
          if (!best || score > best.s) best = { s: score, x, y };
        }
      }
      e.bsT = this.time + 0.35; e.bsOwn = own; e.bsX = best.x; e.bsY = best.y;
      return best;
    }
    isAtk(e) { return e.role !== "def" || ((this.noAtk[e.team] || (e.wing && this.counterMate(e.team) === e)) && this.hasBall(e.team)); }
    // Muralha (1-3-1): o atacante sozinho é o finalizador; ele resolve a jogada sem tocar, a não ser que esteja travado
    // dupla da frente (formação com 2 atacantes, ex. 1-2-2): com a bola lá na frente e no máximo 1 deles entre a bola e o gol,
    // os dois atacantes tabelam e progridem juntos; recuar para os zagueiros só em último caso
    duoMate(e) {
      if (this.training || e.gk || e.role === "def") return null;
      const t = e.team, d = this.dir(t), fr = this.field(t).filter((m) => m.role !== "def");
      if (fr.length !== 2 || (e.x - W / 2) * d < -60) return null;
      if (this.field(1 - t).filter((x) => (x.x - e.x) * d > 0).length > 1) return null;
      if (this.time - Math.max(...fr.map((m) => m.recoverT ?? -99)) > 4) return null; // só logo depois de recuperar a bola lá na frente
      return fr.find((m) => m !== e && m.stun <= 0) || null;
    }
    soloAtk(e) { return this.styleKey[e.team] === "muralha" && e.role !== "def" && !this.training && this.field(e.team).filter((m) => m.role !== "def").length === 1; }
    // Muralha: quando o time recupera a bola e há espaço (no máximo 2 deles entre a bola e o gol),
    // UM ala lê o espaço e sobe para apoiar o contra-ataque; os outros seguram atrás. Perdeu a bola, volta.
    counterMate(t) {
      if (this.styleKey[t] !== "muralha" || !this.hasBall(t)) return (this.cm[t] = null);
      if (this.cmT[t] === this.time) return this.cm[t];
      this.cmT[t] = this.time;
      const own = this.ball.owner, d = this.dir(t);
      if (own.gk) return (this.cm[t] = null);
      const opps = this.field(1 - t), ahead = opps.filter((o) => (o.x - own.x) * d > -20).length;
      if (ahead > 2) return (this.cm[t] = null);
      const wings = this.field(t).filter((m) => m.wing && m !== own && m.stun <= 0);
      if (!wings.length) return (this.cm[t] = null);
      if (wings.includes(this.cm[t])) return this.cm[t]; // mantém quem já está subindo
      // escolhe o ala com o corredor mais livre à frente; empate: o mais perto da bola
      const lane = (w) => opps.filter((o) => (o.x - w.x) * d > 0 && Math.abs(o.y - w.y) < 120).length;
      wings.sort((a, b) => lane(a) - lane(b) || hyp(a.x - own.x, a.y - own.y) - hyp(b.x - own.x, b.y - own.y));
      return (this.cm[t] = wings[0]);
    }
    // reposição do goleiro em andamento para o time t (o adversário fica a pelo menos 150 px de quem pode receber)
    restartFor(t) { const r = this.restart, o = this.ball.owner; return !!r && r.team === t && this.time < r.until && !this.training && !(o && o.team !== t); }
    hasBall(t) { const o = this.ball.owner; return !!o && o.team === t; }
    lane(list, e) {
      const n = list.length, i = list.indexOf(e);
      if (n <= 1 || i < 0) return H / 2;
      const gap = Math.min(170, (H - 140) / (n - 1));
      return H / 2 + (i - (n - 1) / 2) * gap;
    }
    // quem dá a saída: o primeiro atacante; com formação de posições fixas, o jogador mais avançado do desenho
    kickTaker(t) {
      const f = this.field(t), sh = this.shapes[t];
      if (sh) { const fx = (e) => { const a = this.anchor(e); return a ? (a.x - this.ownGoalX(t)) * this.dir(t) : 0; }; return f.reduce((best, e) => (!best || fx(e) > fx(best) ? e : best), null); }
      return f.find((e) => e.role !== "def") || f[0];
    }
    // defesa da área: o defensor mais perto do portador dobra a marcação; os outros marcam,
    // colados e pelo lado do gol, os atacantes deles perto da área; quem sobra protege a frente do gol
    boxSpot(e, c, presser) {
      const t = e.team, gx = this.ownGoalX(t), d = this.dir(t);
      const defs = this.field(t).filter((m) => m.role === "def" && m !== presser && m.stun <= 0)
        .sort((a, b) => hyp(a.x - c.x, a.y - c.y) - hyp(b.x - c.x, b.y - c.y));
      const threats = this.field(1 - t).filter((o) => o !== c && Math.abs(o.x - gx) < 260)
        .sort((a, b) => Math.abs(a.x - gx) - Math.abs(b.x - gx));
      const i = defs.indexOf(e);
      // sempre dentro da área (no máximo 150 de profundidade), pelo lado do gol
      const toGoal = (x, y, off) => { const a = Math.atan2(H / 2 - y, gx - x); return { x: gx + d * Math.min(150, Math.abs(x + Math.cos(a) * off - gx)), y: y + Math.sin(a) * off }; };
      if (i <= 0) return toGoal(c.x, c.y, 42);
      const th = threats[i - 1];
      if (th) return toGoal(th.x, th.y, 26);
      return { x: gx + d * 55, y: H / 2 + (c.y - H / 2) * 0.45 };
    }
    // v437 (Mickey) · Fixo: sempre o mais recuado. Com a bola com a gente, vigia o atacante mais avançado deles pelo lado do gol,
    // sem passar do meio. Sem a bola, guarda a meia-lua: fica na linha entre a bola e o gol, sem se afastar. Perto da área faz o bote.
    // v459 (Mickey): passe limpo do adversário no ar: a referência da defesa é a bola (o mais perto dela continua indo cortar)
    // v469: quem do time chega primeiro na bola solta (segue a bola freando no tempo; atordoado não conta)
    looseMine(mates, px, py) {
      const b = this.ball, L = C.LOOSE, fk = b.shot ? 0.2 : 1.05;
      if (!L || b.shot) return mates.reduce((best, m) => (hyp(m.x - px, m.y - py) < hyp(best.x - px, best.y - py) ? m : best), mates[0]);
      let best = mates[0], bt = 1e9;
      for (const m of mates) {
        const sp = this.runSpeed(m);
        let tt = L.t + hyp(m.x - b.x, m.y - b.y) / sp; // não alcança no tempo: ordem pela distância
        for (let t = 0; t <= L.t; t += L.step) {
          const k = (1 - Math.exp(-fk * t)) / fk, bx = b.x + b.vx * k, by = b.y + b.vy * k;
          if (hyp(bx - m.x, by - m.y) <= sp * t + L.pad) { tt = t; break; }
        }
        if (m.stun > 0) tt += m.stun + 1;
        tt *= 1 - (this.ifx(m).loose || 0); // v524: Chuteira Arranque
        if (tt < bt) { bt = tt; best = m; }
      }
      return best;
    }
    oppPassAt(e) {
      const b = this.ball, t = e.team;
      if (b.owner || b.shot || !b.pass || !b.pass.to || b.pass.bad || b.pass.team === t || this.training || (hyp(b.vx, b.vy) < 200 && !b.pass.air)) return null; // v469: passe lento = bola solta
      const near = this.field(t).reduce((m, o) => (!m || hyp(o.x - b.x, o.y - b.y) < hyp(m.x - b.x, m.y - b.y) ? o : m), null);
      return near === e ? null : { x: b.pass.to.x, y: b.pass.to.y, team: 1 - t, gk: false, virt: true }; // v464 (Mickey vídeo): a referência é quem vai receber (todos já se mexem para onde a bola vai; antes paravam esperando a bola)
    }
    // v475 (Mickey: "não deixar o 1×1 do goleiro contra o Pivô ou o Ala"): com a bola deles, um jogador (de preferência quem já está atrás, nunca quem
    // está no bote) é o último homem: fica cushion px pelo lado do gol do atacante deles mais adiantado. Escolhido 1 vez por quadro para o time
    fixoDuel(e) {
      const b = this.ball, c = b.owner, t = e.team, FD = C.FIXO.duel; if (!c || c.team === t || c.gk || e.stun > 0) return null;
      const og = this.ownGoalX(t), d = this.dir(t), dep = (x) => (x - og) * d;
      if (dep(c.x) > W * FD.zone || dep(e.x) > dep(c.x) + FD.behind) return null; // longe do nosso gol ou o Fixo já ficou para trás do lance
      const first = !this.field(1 - t).some((o) => o !== c && !o.gk && dep(o.x) < dep(c.x) - 20);
      if (!first && hyp(c.x - e.x, c.y - e.y) > FD.r) return null;
      const D = hyp(og - c.x, H / 2 - c.y) || 1, g = D > FD.commit ? FD.hold : Math.max(4, FD.gap - FD.gapIv * Math.min(1, this.q(e, "defesa"))); // longe: acompanha na frente (hold px); perto da área: encosta para o desarme
      return { x: c.x + ((og - c.x) / D) * g, y: c.y + ((H / 2 - c.y) / D) * g };
    }
    alaFixo(e) {
      const AF = C.ALA_FIXO, FD = C.FIXO.duel, b = this.ball, c = b.owner, t = e.team; if (!c || c.team === t || c.gk || e.stun > 0) return null;
      const og = this.ownGoalX(t), d = this.dir(t), dep = (x) => (x - og) * d; if (dep(c.x) > W * AF.zone) return null;
      const opp = this.field(1 - t).filter((o) => !o.gk && o.stun <= 0).sort((p, q) => dep(p.x) - dep(q.x)); if (!opp.length) return null;
      const fx = this.field(t).find((m) => m.fixo && m.stun <= 0 && m !== e);
      const fixoOk = fx && dep(fx.x) < dep(opp[0].x) + AF.fixoBehind; // o Fixo ainda está pelo lado do gol do mais avançado
      const fixoMan = fixoOk ? (fx.mode === "fixoDuel" ? c : opp[0]) : null;
      const th = opp.find((o) => o !== fixoMan); if (!th) return null;
      if (dep(e.x) > dep(th.x) + AF.behind) return null; // ficou para trás do lance: segue o comportamento normal
      const D = hyp(og - th.x, H / 2 - th.y) || 1;
      if (th === c) { // é o portador: mesma marcação do Fixo (na linha do gol; encosta perto da área)
        const g = D > FD.commit ? FD.hold : Math.max(4, FD.gap - FD.gapIv * Math.min(1, this.q(e, "defesa")));
        return { x: c.x + ((og - c.x) / D) * g, y: c.y + ((H / 2 - c.y) / D) * g };
      }
      let x = og + d * Math.max(C.FIXO.min, dep(th.x) - AF.gap), y = th.y + (H / 2 - th.y) * AF.k;
      if (fixoOk && Math.abs(fx.y - y) < AF.sep) y = fx.y + (y >= fx.y ? 1 : -1) * AF.sep; // não fica tão no meio quanto o Fixo
      return { x, y: U.clamp(y, 50, H - 50) };
    }
    lastMan(e) {
      const CV = C.COVER, b = this.ball, t = e.team; if (!CV) return null;
      const L = (this.lastMen ||= [{}, {}])[t];
      if (L.T !== this.time) {
        L.T = this.time; L.e = null;
        const d = this.dir(t), og = this.ownGoalX(t), dep = (x) => (x - og) * d;
        const opp = b.owner && b.owner.team !== t && !b.owner.gk ? b.owner : b.pass && !b.pass.bad && b.pass.team !== t && !b.shot ? b : !b.owner && !b.shot && this.lastOwnTeam !== t ? b : null;
        const th = opp && dep(opp.x) < W * CV.far && this.field(1 - t).filter((o) => !o.gk && o.stun <= 0).sort((p, q) => dep(p.x) - dep(q.x))[0];
        if (th) {
          const pin = b.pass && !b.pass.bad && b.pass.team !== t && !b.shot; // passe limpo deles no ar: o último homem não corre atrás da bola, vai no recebedor
          const own = b.owner && b.owner.team !== t ? b.owner : null, prev = L.prev;
          const pool = this.field(t).filter((m) => m.stun <= 0 && m.slide <= 0 && m !== b.owner && !["press", "close", "double", "slide", "fixoDuel"].includes(m.mode) && !(m.mode === "chase" && !pin && m !== prev) && !(own && hyp(m.x - own.x, m.y - own.y) < 45));
          let sx = og + d * Math.max(C.FIXO.min, dep(th.x) - CV.cushion), sy = U.clamp(th.y + (H / 2 - th.y) * CV.k, 60, H - 60);
          if (own && th === own) { // v484 (Mickey): no 1×1 o último homem fica na linha do chute, entre ele e o gol, sem precisar dar o bote
            const D = hyp(og - own.x, H / 2 - own.y) || 1, g = Math.min(this.field(t).some((m) => m.mode === "fixoDuel") ? CV.deep : CV.lane, D * 0.6); /* v485: com o Fixo no portador, a sobra fica mais atrás */ sx = own.x + (og - own.x) / D * g; sy = own.y + (H / 2 - own.y) / D * g; }
          const cost = (m) => hyp(m.x - sx, m.y - sy) * (m.pivo ? 3 : m.alaOf ? CV.alaOf || 1 : 1) - (m === prev ? CV.keep : 0) - (m.fixo ? CV.fixo : 0) - (m.alaDef ? CV.alaDef || 0 : 0); // v501: o Ala Def volta de último homem antes do Ala Of
          const c = pool.sort((p, q) => cost(p) - cost(q))[0];
          if (c) { L.e = c; L.x = sx; L.y = sy; }
        }
        L.prev = L.e;
      }
      return L.e === e ? { x: L.x, y: L.y } : null;
    }
    markOf(t) { const ms = this.myShapes && this.myShapes[t]; return (ms && ms.mark) || null; } // v458: marcação da formação
    fixoSpot(e, tx, ty) {
      const b = this.ball, t = e.team, d = this.dir(t), og = this.ownGoalX(t), F = C.FIXO;
      const own = b.owner || (b.pass && b.pass.team === t && b.pass.to && !b.shot && !b.pass.bad && hyp(b.vx, b.vy) >= 200 ? { x: b.pass.to.x, y: b.pass.to.y, team: t, gk: false } : null) || this.oppPassAt(e); // v440: passe nosso a caminho conta como posse · v459 (Mickey): a referência é onde a bola está, não quem vai receber
      const depth = (x) => (x - og) * d; // distância do próprio gol (maior = mais à frente)
      if (own === e || (b.pass && b.pass.to === e) || ["press", "box", "runTo"].includes(e.mode) || (e.mode === "chase" && !b.owner) || (own && own.team !== t && ["watch", "close"].includes(e.mode))) return null; // v444: watch/close só valem com a bola deles (antes o modo velho prendia o Fixo atrás com a nossa bola) // close: fechando depois do drible (v443); watch: Toque já vigia o atacante isolado deles
      const mates = this.field(t).filter((m) => m !== e);
      const back = mates.length ? Math.min(...mates.map((m) => depth(m === own ? m.x : m.goalTx ?? m.x)), b.owner ? W : depth(b.x)) - F.gap : W; // fica atrás de todo mundo (e da bola em passe)
      const at = (dist, y0, mode) => { const x = og + d * U.clamp(Math.min(dist, back), F.min, W / 2 - 20); return { x, y: U.clamp(y0, 60, H - 60), mode }; };
      // v451 (Mickey): bola solta ou chute nosso lá no campo deles não é motivo para voltar à meia-lua: segue no homem mais avançado
      const ours = !own || b.shot ? (b.shot ? b.shot.team === t : this.lastOwnTeam === t) && depth(b.x) > W * F.far : false;
      if ((!own || b.shot) && !ours) {
        if (e.mode === "chase" || (hyp(b.x - e.x, b.y - e.y) < 160 && depth(b.x) < W * 0.4)) return null; // bola solta perto, no nosso campo: vai nela
        const a = Math.atan2(b.y - H / 2, (b.x - og) * d); return at(F.arc * Math.cos(a), H / 2 + F.arc * Math.sin(a), "fixo");
      }
      // v449 (Mickey): padrão ideal, o Pivô deles na zona de chute (perto da nossa meia-lua) é marcado pelo Fixo, pelo lado do gol
      const pv = !ours && own.team !== t && this.field(1 - t).find((o) => o.pivo && o !== own), z = this.zoneOf(1 - t);
      if (pv && hyp(pv.x - z.x, pv.y - z.y) < F.zoneR) return at(depth(pv.x) - F.zoneGap, pv.y + (H / 2 - pv.y) * 0.25, "fixoZone");
      // v450 (Mickey): a prioridade do Fixo é sempre o homem mais avançado deles, também na defesa; só fica na meia-lua com a bola perto do nosso gol
      if (ours || own.team === t || depth(b.x) > W * F.far || hyp(b.x - og, b.y - H / 2) > F.arc + F.near) { // v444 (Mickey): com a bola deles ainda no campo deles, também cobre o mais adiantado deles
        // nosso ataque: o atacante deles mais adiantado (mais perto do nosso gol), marcado pelo lado do gol, no nosso campo
        let th = this.field(1 - t).filter((o) => !o.gk).sort((p, q) => depth(p.x) - depth(q.x))[0];
        const mk = this.markOf(t), pv2 = mk && mk.fixoPivo && this.field(1 - t).find((o) => o.pivo && o !== own); if (pv2) th = pv2; // v458: 3-1 defensivo, o Fixo marca o Pivô deles
        // v440 (Mickey): ninguém deles adiantado (todos no campo deles) → sobe até perto do meio e fica de opção de passe
        // v447 (Mickey): prioridade é o homem mais avançado deles (sem ficar preso atrás dos companheiros) e pelo lado oposto ao Ala Def
        const ad = mates.find((m) => m.alaDef), opY = ad && Math.abs(ad.y - H / 2) > 30 ? H / 2 - Math.sign(ad.y - H / 2) * F.sideY : H / 2;
        const up = (dist, y0, mode) => ({ x: og + d * U.clamp(dist, F.min, W / 2 - 20), y: U.clamp(y0, 60, H - 60), mode });
        if (!th || depth(th.x) > W / 2 + F.free) return up(W / 2 - 20, opY + (b.y - H / 2) * 0.2, "fixoUp");
        // 2×1: outro atacante deles perto do mais avançado → recua um pouco e fecha mais o meio, priorizando a meia-lua
        const two = this.field(1 - t).filter((o) => !o.gk && o !== th && depth(o.x) < depth(th.x) + F.pair && hyp(o.x - th.x, o.y - th.y) < F.pair * 1.6).length > 0;
        if (two) return up(depth(th.x) - F.mark2, th.y + (H / 2 - th.y) * 0.55, "fixo2x1");
        return up(depth(th.x) - F.mark, th.y + (opY - th.y) * F.sideK, "fixoMark");
      }
      // defesa: na meia-lua, entre a bola e o centro do gol
      const a = Math.atan2(b.y - H / 2, Math.max(1, (b.x - og) * d)), r = U.clamp(hyp(b.x - og, b.y - H / 2) - 40, F.min, F.arc);
      return at(r * Math.cos(a), H / 2 + r * Math.sin(a), "fixo");
    }
    // v438 (Mickey) · Ala Def, a "cola" do time: com a nossa bola sobe junto e se oferece pelo lado (mesmo sendo defensor);
    // sem a bola e com a jogada no nosso campo, volta para ajudar entre a bola e o gol (mesmo sendo atacante, ex. 1-1-3)
    alaDefSpot(e) {
      const b = this.ball, t = e.team, d = this.dir(t), og = this.ownGoalX(t), A = C.ALA_DEF;
      // v439: passe nosso a caminho conta como posse (a referência é quem vai receber)
      let own = b.owner || (b.pass && b.pass.team === t && b.pass.to && !b.shot && !b.pass.bad && hyp(b.vx, b.vy) >= 200 ? { x: b.pass.to.x, y: b.pass.to.y, team: t, gk: false } : null) || this.oppPassAt(e); // v459 (Mickey): no passe, a referência é a bola
      // v451 (Mickey): bola solta ou chute nosso no campo deles conta como nossa (não volta para trás à toa)
      if ((!own || b.shot) && (b.shot ? b.shot.team === t : this.lastOwnTeam === t) && (b.x - og) * d > W * 0.5 && e.mode !== "chase" && !(b.pass && b.pass.to === e)) own = { x: b.x, y: b.y, team: t, gk: false };
      if (!own || own === e || (b.shot && own !== null && own.team !== t) || (b.pass && b.pass.to === e) || ["press", "box", "runTo", "go", "double", "track", "sweep", "counter"].includes(e.mode) || (e.mode === "chase" && !b.owner) || (own.team !== t && ["watch", "close"].includes(e.mode))) return null; // v450: cover saiu (o Ala Def decide sozinho abaixo) · v444: cover/watch/close só com a bola deles (o modo velho travava o Ala Def lá atrás)
      const depth = (x) => (x - og) * d;
      // v450 (Mickey): o Fixo vai no mais avançado deles; o Ala Def se antecipa: com 2+ deles adiantados marca o 2º (pelo lado do gol),
      // com só 1 adiantado não espera o Fixo e já busca espaço livre na ala oposta ao Ala Of, pronto para sair jogando
      if (own.team !== t && !own.gk && depth(own.x) > W * A.antFrom && this.field(t).some((m) => m.fixo && m !== e && m.stun <= 0)) {
        const adv = this.field(1 - t).filter((o) => !o.gk && depth(o.x) < W / 2 + C.FIXO.free).sort((p, q) => depth(p.x) - depth(q.x));
        if (adv.length >= 2) {
          const rest = adv.slice(1), o = rest.find((x) => x !== own) || rest[0];
          return { x: U.clamp(og + d * Math.min(depth(o.x) - A.markGap, W * A.max), 60, W - 60), y: U.clamp(o.y + (H / 2 - o.y) * 0.2, 60, H - 60), mode: "alaMark2", sp: A.sprint };
        }
        const of = this.field(t).find((m) => m.alaOf), fy = of ? (of.y > H / 2 ? H / 2 - A.wide : H / 2 + A.wide) : own.y > H / 2 ? H / 2 - A.wide : H / 2 + A.wide;
        return { x: og + d * W * A.wait, y: U.clamp(fy, 60, H - 60), mode: "alaFree", sp: A.sprint };
      }
      if (own.team === t && !own.gk) {
        // v440 (Mickey): só sobe para o ataque se eles têm 3+ jogadores atrás da bola (bloco fechado, sem contra-ataque).
        // Senão fica um pouco atrás do atacante deles que é "dele" (o 2º mais adiantado; o 1º é do Fixo), pelo lado do gol
        const opp = this.field(1 - t).filter((o) => !o.gk), behind = opp.filter((o) => (o.x - own.x) * d > 0).length;
        // v493 (Mickey): o Ala Def também ataca se alguém fica na cobertura: o Fixo atrás da bola (coverGap px) e no máximo 1 deles mais fundo que o Fixo
        const fxC = this.field(t).find((m) => m.fixo && m !== e && m.stun <= 0), coverOk = A.coverGap && fxC && depth(fxC.x) < depth(own.x) - A.coverGap && opp.filter((o) => depth(o.x) < depth(fxC.x) + 40).length <= 1;
        if (behind >= A.atkIfBack || coverOk) {
          if (e.role !== "def" && !coverOk) return null;
          // v441 (Mickey): sempre no lado oposto ao Ala Of; na jogada trocada (Pivô aberto) pega o meio, um pouco atrás da bola
          const sc = this.scheme && this.scheme[t] && this.field(t).some((m) => m.alaOf) ? this.scheme[t] : null;
          if (sc && sc.swap) return { x: U.clamp(og + d * Math.min(depth(own.x) - 40, W * A.max), 60, W - 60), y: H / 2 + (own.y - H / 2) * 0.2, mode: "ala", sp: A.sprint };
          // v446 (Mickey): saindo com a bola lá de trás, não fica colado em quem tem a bola: abre na linha do meio, pela ala oposta ao Ala Of
          const x = og + d * Math.min(Math.max(depth(own.x) + A.ahead, W * A.buildX), W * A.max), y = sc ? H / 2 - sc.side * A.wide : own.y > H / 2 ? own.y - A.wide : own.y + A.wide;
          return { x: U.clamp(x, 60, W - 60), y: U.clamp(y, 60, H - 60), mode: "ala", sp: A.sprint };
        }
        // v451 (Mickey): corredor livre na frente dele (na ala oposta ao Ala Of) → ataca o espaço (varia por posse: POS_AI scheme.adRun)
        const scR = this.scheme && this.scheme[t], ofR = this.field(t).find((m) => m.alaOf && m !== e);
        const yW = ofR ? (ofR.y > H / 2 ? H / 2 - A.wide : H / 2 + A.wide) : e.y > H / 2 ? H / 2 + A.wide : H / 2 - A.wide;
        if (scR && scR.adRun && !scR.swap && !opp.some((o) => Math.abs(o.y - yW) < A.laneW && depth(o.x) > depth(e.x) - 20 && depth(o.x) < depth(e.x) + A.laneL))
          return { x: U.clamp(og + d * Math.min(Math.max(depth(e.x), depth(own.x) - 60) + A.runStep, W * A.runMax), 60, W - 60), y: U.clamp(yW, 60, H - 60), mode: "alaRun", sp: A.sprint };
        const adv = opp.sort((p, q) => depth(p.x) - depth(q.x)), hasFixo = this.field(t).some((m) => m.fixo);
        const th = adv[hasFixo ? 1 : 0] || adv[0];
        // v444 (Mickey): fica no lado oposto ao Ala Of como opção de passe, sem ficar longe demais da bola, mas atrás do atacante "dele"
        const of = this.field(t).find((m) => m.alaOf && m !== e), oy = of ? (of.y > H / 2 ? H / 2 - A.wide : H / 2 + A.wide) : null;
        if (th) return { x: U.clamp(og + d * Math.min(Math.max(depth(th.x) - A.markGap, depth(own.x) - A.opt), W * A.max), 60, W - 60), y: U.clamp(oy ?? th.y + (H / 2 - th.y) * 0.15, 60, H - 60), mode: "alaMark" };
      }
      // v439 (Mickey: na 1-2-2 ficava atrás demais): com a bola deles no campo deles, espera mais alto, perto do meio, para já sair dando opção
      if (own.team !== t && !own.gk && e.role === "def" && depth(own.x) > W * A.high && this.styleKey[t] !== "muralha") { // Muralha segue no bloco baixo
        const of = this.field(t).find((m) => m.alaOf && m !== e); // v447: sempre do lado oposto ao Ala Of
        return { x: og + d * W * A.wait, y: U.clamp(of ? (of.y > H / 2 ? H / 2 - A.wide : H / 2 + A.wide) : e.y + (own.y - e.y) * 0.2, 60, H - 60), mode: "alaWait" };
      }
      if (own.team !== t && !own.gk && e.role !== "def" && depth(own.x) < W * A.back) {
        const k = A.cover; return { x: own.x + (og - own.x) * k, y: own.y + (H / 2 - own.y) * k, mode: "alaBack" };
      }
      return null;
    }
    // v442 (Mickey) · marcação: cada defensor (fora o Fixo, que guarda a meia-lua e o mais adiantado) cobre um dos atacantes
    // deles que estão à frente da bola, do mais perigoso para o menos, sempre entre ele e o nosso gol, sem passar do meio
    closeHelper(t, c, presser) { // v443: quem ajuda a fechar depois do drible: o mais perto do portador, sem ser quem pressiona nem quem está no chão
      return this.field(t).filter((m) => m !== presser && m.stun <= 0 && !(m.pivo && !m.backOk)).reduce((bm, m) => (!bm || hyp(m.x - c.x, m.y - c.y) < hyp(bm.x - c.x, bm.y - c.y) ? m : bm), null);
    }
    coverSpot(e, c, presser) {
      const t = e.team, d = this.dir(t), og = this.ownGoalX(t), M = C.MARK, depth = (x) => (x - og) * d;
      const cvs = this.field(t).filter((m) => m.role === "def" && !m.fixo && m !== presser && m.stun <= 0);
      const th = this.field(1 - t).filter((o) => !o.gk && o !== c && depth(o.x) < depth(c.x) + M.ahead).sort((p, q) => depth(p.x) - depth(q.x));
      if (this.field(t).some((m) => m.fixo && m !== presser)) th.shift(); // o mais adiantado é do Fixo
      const free = cvs.slice();
      for (const o of th) {
        if (!free.length) break;
        const k = free.reduce((bi, m, i) => (hyp(m.x - o.x, m.y - o.y) < hyp(free[bi].x - o.x, free[bi].y - o.y) ? i : bi), 0), m = free.splice(k, 1)[0];
        if (m === e) return { x: og + d * U.clamp(depth(o.x) - M.gap, 90, W * M.max), y: U.clamp(o.y + (H / 2 - o.y) * M.center, 60, H - 60) };
      }
      return null;
    }
    // v441 (Mickey) · ataque: o Pivô fica centralizado para o chute; o Ala Of abre por uma ala (sorteada a cada posse) e serve o Pivô.
    // 2 em 10 posses a jogada é trocada: o Pivô abre para receber e o Ala Of centraliza (o Ala Def pega o meio)
    attackSpot(e) {
      const b = this.ball, t = e.team, d = this.dir(t), og = this.ownGoalX(t), P = C.POS_AI;
      const own = b.owner || (b.pass && b.pass.team === t && b.pass.to && !b.shot ? b.pass.to : null);
      if (!own || own.team !== t || own === e || b.shot || (b.pass && b.pass.to === e) || ["press", "box", "runTo", "go", "carry", "watch"].includes(e.mode) || (e.mode === "chase" && !b.owner)) return null;
      const sc = (this.scheme && this.scheme[t]) || { side: 1, swap: false }, bd = (b.x - og) * d;
      // v446 (Mickey): na saída de bola o Pivô já espera lá na frente, perto da área deles (pivoBuild), como referência
      if (e.pivo && (!sc.swap || bd < W * P.from)) return { x: og + d * Math.min(Math.max(bd + P.pivoAhead, W * P.pivoBuild), W - C.SHOT_ZONE.x), y: H / 2 + (b.y - H / 2) * 0.08, mode: "pivo" }; // v449: o alvo é a zona ideal de chute
      if (bd < W * P.from) return null; // saída de bola: deixa a formação montar
      const wing = H / 2 + sc.side * P.wide;
      if (e.pivo) {
        const x = og + d * Math.min(bd + P.pivoAhead, W - C.SHOT_ZONE.x);
        return { x, y: sc.swap ? H / 2 - sc.side * P.wide : H / 2 + (b.y - H / 2) * 0.08, mode: sc.swap ? "pivoOpen" : "pivo" }; // v445: entre a marca do pênalti e a meia-lua
      }
      // v445 (Mickey): 9 em 10 posses o Ala Of vai para a ala, colado na lateral perto da área, para receber e cruzar para o Pivô
      if (!sc.swap && sc.wingGo) return { x: og + d * Math.min(bd + P.alaAhead, W * P.wingX), y: H / 2 + sc.side * P.wingY, mode: "alaOfWing" };
      const x = og + d * Math.min(bd + P.alaAhead, W * P.alaMax);
      return { x, y: sc.swap ? H / 2 + (b.y - H / 2) * 0.1 : wing, mode: sc.swap ? "alaOfIn" : "alaOf" };
    }
    anchor(e, kick) {
      const sh = (kick === "gk" ? this.gkShapes[e.team] : kick === "oppGk" ? this.oppGkShapes[e.team] : kick && this.kickShapes[e.team]) || this.shapes[e.team]; if (!sh) return null;
      // cada posição do desenho é de um defensor ou de um atacante ([x, y] ou [x, y, "atk"]); o k-ésimo defensor fica na k-ésima vaga de defensor
      const kind = (r) => (r === "atk" ? "atk" : "def");
      const slots = sh.filter((s) => kind(s[2]) === kind(e.role));
      const pt = slots[this.field(e.team).filter((m) => kind(m.role) === kind(e.role)).indexOf(e)]; if (!pt) return null;
      return { x: this.ownGoalX(e.team) + this.dir(e.team) * pt[0] * W, y: pt[1] * H };
    }
    pow(e, k) { return this.iv(e, k) * BL.levelMult(e.p.level); }
    // v225 · o que cada IV faz na partida (C.IVX): q = status/31 (nature, item e EV inclusos) × cansaço; 31 descansado = 1
    q(e, k) { return U.clamp((BL.baseStat(e.p, k) * this.cmul(e, k) * this.posIv(e, k) / 31) * this.fatigue(e) * (this.pfx.stats || 1), 0, 1.25); }
    lerpQ(ab, q) { return ab[0] + (ab[1] - ab[0]) * Math.min(1, q); }
    tired(e) { return e.gk ? 0 : Math.max(0, 1 - e.energy / C.ENERGY_LOW); } // 0 até 50 de energia, 1 sem energia
    // tempo de ação (decidir, levantar): velocidade alta faz tudo mais rápido; cansado fica lento
    actF(e) { return this.lerpQ(C.IVX.velAct, this.q(e, "velocidade")) * (1 + C.ENERGY_SLOW * this.tired(e)); }

    runSpeed(e) {
      // velocidade de corrida legível para os sprites em qualquer nível (pedido do Mickey): o nível NÃO aumenta a corrida
      // direto; velocidade (IV, nature, itens, nível relativo) muda pouco e tem teto. O nível pesa em disputas, passe e chute
      if (e.gk) return 250 * 0.85 * C.RUN_SCALE;
      const n0 = this.field(0).length, RB = C.RUN_BOOST && !this.training && !this.scrimmage && n0 === this.field(1).length && (!C.RUN_BOOST.modes || C.RUN_BOOST.modes.includes(n0)) ? C.RUN_BOOST : null; // v700: só nos modos de RUN_BOOST.modes
      const vIv = this.iv(e, "velocidade"), rb = RB ? 1 + Math.max(0, RB.at1 - RB.step * ((e.p && e.p.stats ? e.p.stats.velocidade : 16) - 1)) : 1; // v699 (Mickey): bônus de corrida pelo IV puro
      const s = Math.min(C.RUN_MAX * (RB ? RB.capK || 1 : 1), (180 + (C.RUN_IV ? this.interp(C.RUN_IV, vIv) : 2 * vIv)) * 0.85 * rb * (this.pfx.run || 1)) * (1 - ((this.cfx[1 - e.team] || {}).slow || 0)); // v312: Espaço corre mais, sem passar do teto; v417: Sato Ren deixa o inimigo mais lento
      if (e.dribSlow && this.ball.owner !== e) e.dribSlow = false; const ds = e.dribSlow && !this.ifx(e).noDribSlow ? C.DRIB_SLOW : 1; /* v524: Chuteira Raio */ // v494 (Mickey): driblou = um pouco mais lento até soltar a bola (sem arrancada)
      const BQ = e.spdB > this.time && (this.ps(e.team) || {}).boost; const SDs = (e.sdB > this.time || e.recov > this.time) && this.sdyn(); /* v704: corre mais buscando o haxball ou voltando para a cobertura */ return this.skSpdK(e) /* v623 */ * s * C.RUN_SCALE * (SDs ? (e.recov > this.time ? SDs.recov.k : SDs.haxB.k) : 1) * (BQ ? 1 + BQ.k : 1) * (e.burst > 0 && !e.dribSlow ? 1.25 : 1) * ds * (1 - (1 - C.ENERGY_RUN_MIN) * this.tired(e)); // v442: todos correm 15% menos (C.RUN_SCALE) · v225: sem stamina corre menos
    }
    dir(t) { return t === 0 ? 1 : -1; }
    goalX(t) { return t === 0 ? W : 0; } // gol que o time t ataca
    ownGoalX(t) { return t === 0 ? 0 : W; }
    // v225: o Físico (IV, sem o nível) decide o gasto: 31 gasta 55%, 0 gasta 135% (antes usava o nível e, em nível muito alto, a conta ficava negativa)
    drain(e, v) { if (this.training || this.scrimmage) return; /* v295: treino com stamina infinita */ if (!e.gk) e.energy = Math.max(0, e.energy - v * (this.pfx.drain || 1) * (e.drainK || 1) * (1 - ((this.tfx[e.team] || {}).drain || 0)) * (1 + (this.ifx(e).drain || 0)) * (this.half === 2 ? 1 - (this.ifx(e).vet || 0) : 1) * this.lerpQ(C.IVX.fisDrain, BL.baseStat(e.p, "fisico") / 31)); }

    // ---------- fluxo ----------
    kickoff(team) {
      this.shakeT = 0; // v298
      this.ball.shot = null; this.ball.pass = null; this.ball.vx = this.ball.vy = 0;
      this.trail = [];
      this.restart = null;
      if (this.pplays) this.pplays.forEach((P, i) => { if (P) P.ko = i === team; }); // v591: saída ensaiada
      this.combo = [null, null]; // v600
      this.gkLock = [false, false]; this.gkPrev = null; // v603
      [0, 1].forEach((t) => {
        const f = this.field(t), d = this.dir(t);
        const atks = f.filter((e) => e.role !== "def"), defs = f.filter((e) => e.role === "def");
        const taker = t === team ? this.kickTaker(t) : null;
        // desenho próprio de saída (ex.: Rakuzan): vaga 0 é de quem bate; as outras, na ordem, para os demais.
        // Quando a saída é do adversário, ninguém entra no círculo central nem passa do meio.
        const ks = this.kickShapes[t];
        if (ks) {
          const order = taker ? [taker, ...f.filter((e) => e !== taker)] : f;
          order.forEach((e, i) => {
            const q = ks[i] || ks[ks.length - 1], og = this.ownGoalX(t);
            let rx = Math.min(q[0] * W, W / 2 - 20), y = U.clamp(q[1] * H, PR + 2, H - PR - 2);
            if (!taker && hyp(W / 2 - rx, y - H / 2) < 95) rx = W / 2 - Math.sqrt(Math.max(0, 95 * 95 - (y - H / 2) ** 2)) - 4;
            if (e === taker) { rx = W / 2 - 22; y = H / 2; }
            e.x = og + d * rx; e.y = y;
            e.vx = e.vy = 0; e.stun = 0; e.burst = 0; e.mode = "idle"; e.think = 0.3;
          });
          const g = this.gks[t];
          g.x = this.ownGoalX(t) + this.dir(t) * 22; g.y = H / 2; g.hold = 0;
          return;
        }
        f.forEach((e) => {
          if (e === taker) { e.x = W / 2 - d * 22; e.y = H / 2; }
          else if (this.anchor(e, true)) { const a = this.anchor(e, true), og = this.ownGoalX(t);
            // na saída: ninguém no campo deles nem dentro do círculo central (formação pode ter um desenho próprio de saída)
            let rx = Math.min((a.x - og) * d, W / 2 - 24); // um passo atrás da linha, para não encostar no adversário
            if (hyp(W / 2 - rx, a.y - H / 2) < 95) rx = W / 2 - Math.sqrt(Math.max(0, 95 * 95 - (a.y - H / 2) ** 2));
            e.x = og + d * rx; e.y = a.y; }
          else if (e.role !== "def") { e.x = W / 2 - d * (110 + 30 * (atks.indexOf(e) % 2)); e.y = this.lane(atks, e); }
          else { e.x = W / 2 - d * 250; e.y = this.lane(defs, e); }
          e.vx = e.vy = 0; e.stun = 0; e.burst = 0; e.mode = "idle"; e.think = 0.3;
        });
        const g = this.gks[t];
        g.x = this.ownGoalX(t) + this.dir(t) * 22; g.y = H / 2; g.hold = 0;
      });
      const taker = this.kickTaker(team);
      this.ents.forEach((q) => (q.koFirst = 0)); taker.koFirst = this.time || 0.001; // v632: até o primeiro chute dele (no máximo 3 s)
      this.ball.owner = taker; taker.heldT = 0;
      this.ball.x = taker.x + this.dir(team) * (taker.r + BALL_R); this.ball.y = taker.y;
    }

    setSpeed(s) { this.speed = s; }

    // ---------- v217 · VFX: partículas ----------
    // emit(n, x, y, o): o.a/spread = direção e abertura; v0..v1 velocidade; l0..l1 vida (s); r0..r1 tamanho; grow = quanto cresce até sumir;
    // z0..z1 + g = sobe e cai (lascas, confete); shape dot | chip | streak; air = desenhada por cima dos jogadores; col = "r,g,b" ou lista
    teamRGB(t) { return t === 0 ? "38,217,255" : this.arena ? "255,176,46" : "255,79,139"; }
    emit(n, x, y, o) {
      for (let i = 0; i < n && this.parts.length < 420; i++) {
        const sp = o.spread ?? Math.PI, a = (o.a ?? 0) + U.rand(-sp, sp), v = U.rand(o.v0 ?? 30, o.v1 ?? 90), life = U.rand(o.l0 ?? 0.3, o.l1 ?? 0.6);
        this.parts.push({ x: x + U.rand(-(o.jx || 0), o.jx || 0), y: y + U.rand(-(o.jy || 0), o.jy || 0), vx: Math.cos(a) * v, vy: Math.sin(a) * v * (o.flat ?? 1),
          z: 0, vz: U.rand(o.z0 ?? 0, o.z1 ?? 0), g: o.g || 0, drag: o.drag ?? 3, t: life, life, r: U.rand(o.r0 ?? 2, o.r1 ?? 4), grow: o.grow || 0, alpha: o.alpha ?? 1,
          col: Array.isArray(o.col) ? o.col[Math.floor(Math.random() * o.col.length)] : o.col || DUST, shape: o.shape || "dot", air: !!o.air, rot: Math.random() * 6.3, vr: U.rand(-12, 12) });
      }
    }
    stepParts(dt) {
      if (!this.parts.length) return;
      this.parts = this.parts.filter((p) => (p.t -= dt) > 0);
      for (const p of this.parts) {
        const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.g) { p.vz -= p.g * dt; p.z += p.vz * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.25; p.vx *= 0.5; p.vy *= 0.5; p.vr *= 0.5; } }
      }
    }
    drawParts(ctx, air) {
      for (const p of this.parts) {
        if (p.air !== air) continue;
        this.at(ctx, p.x, p.y); // v222
        const k = p.t / p.life, r = p.r * (1 + p.grow * (1 - k));
        ctx.globalAlpha = Math.min(1, k * 1.8) * p.alpha; ctx.fillStyle = ctx.strokeStyle = `rgb(${p.col})`;
        if (p.shape === "chip") { ctx.save(); ctx.translate(p.x, p.y - p.z); ctx.rotate(p.rot); ctx.fillRect(-r, -r * 0.45, r * 2, r * 0.9); ctx.restore(); }
        else if (p.shape === "streak") { const v = hyp(p.vx, p.vy) || 1, L = Math.min(20, v * 0.045) + r; ctx.lineWidth = r; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(p.x, p.y - p.z); ctx.lineTo(p.x - (p.vx / v) * L, p.y - p.z - (p.vy / v) * L); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(p.x, p.y - p.z, r, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // poeira dos passos na arrancada e nas viradas bruscas (compara a direção de 0,12 s atrás)
    footFx(e, dt) {
      const v = hyp(e.vx || 0, e.vy || 0); if (v < 40) return;
      const a = Math.atan2(e.vy, e.vx), fy = e.y + C.SPRITE_FEET - 2;
      if ((e.aT = (e.aT || 0) - dt) <= 0) {
        e.aT = 0.12;
        if (v > 120 && e.lastA !== undefined && Math.abs(Math.atan2(Math.sin(a - e.lastA), Math.cos(a - e.lastA))) > 1.0 && !(this.time - (e.turnFxT ?? -9) < 0.35)) {
          e.turnFxT = this.time;
          this.emit(5, e.x, fy, { a: a + Math.PI, spread: 1.2, v0: 30, v1: 95, l0: 0.3, l1: 0.55, r0: 2.5, r1: 4.5, grow: 1.6, drag: 4, flat: 0.5, alpha: 0.7 });
          this.emit(3, e.x, fy, { col: GRASS, a: a + Math.PI, spread: 0.9, v0: 40, v1: 100, z0: 60, z1: 130, g: 600, drag: 2, r0: 1.4, r1: 2.2, shape: "chip", air: true, l0: 0.35, l1: 0.6 });
        }
        e.lastA = a;
      }
      if (this.ball.owner === e && (e.burst > 0 || v > 185) && (e.wispT = (e.wispT || 0) - dt) <= 0) { // v218: rastro de velocidade na arrancada com a bola
        e.wispT = 0.045;
        this.emit(1, e.x - Math.cos(a) * 10, e.y + C.SPRITE_FEET - U.rand(6, 34), { col: [this.teamRGB(e.team), "255,255,255"], a: a + Math.PI, spread: 0.12, v0: 120, v1: 200, l0: 0.22, l1: 0.34, r0: 1.2, r1: 2, shape: "streak", drag: 5, alpha: 0.75 });
      }
      if (v > 150 && (e.stepFx = (e.stepFx || 0) - dt) <= 0) { e.stepFx = 0.17; this.emit(1, e.x - Math.cos(a) * 8, fy, { a: a + Math.PI, spread: 0.6, v0: 10, v1: 40, l0: 0.25, l1: 0.4, r0: 2, r1: 3, grow: 1.4, alpha: 0.45 }); }
    }

    update(realDt) {
      if (this.paused) { this.shakeT = 0; return; } // v136: pausa tática congela a partida; v298: e a tela não fica tremendo parada
      const xs = this.modeSpd(); this.acc = Math.min((this.acc || 0) + Math.min(realDt, 0.1) * this.speed * xs * C.GAME_PACE * this.pace, 0.1 * this.speed * xs * this.pace); // v614: ritmo da partida (opts.pace) // v563 (Mickey): X1 15% mais rápido // v448 (Mickey): jogo 15% mais lento
      while (this.acc >= STEP && this.state !== "ended") { this.step(STEP); this.acc -= STEP; }
      this.fx = this.fx.filter((f) => (f.t -= realDt) > 0);
      this.stepParts(realDt);
      if (this.ball.lift > 0) this.ball.lift -= realDt;
      this.shakeT = Math.max(0, (this.shakeT || 0) - realDt);
    }
    // tremida de tela curta (drible, roubo, espalmada); a mais forte ganha se vierem juntas
    shake(mag, t) { if (!(this.shakeT > 0) || mag >= (this.shakeMag || 0)) { this.shakeMag = mag; this.shakeDur = t; } this.shakeT = Math.max(this.shakeT || 0, t); }

    step(dt) {
      this.time += dt;
      if (this.ball && C.GK_POSS && this.state === "play") this.gkTrack(); // v603
      if (this.ball && C.CHEM) this.chemOwner(); // v577: passes certos e assistências das Reações Químicas
      if (this.state !== "play") {
        this.stateT -= dt;
        if (this.stateT <= 0) this.advanceState();
        if (this.state === "kickoff" || this.state === "goal") this.moveKeepers(dt);
        return;
      }
      this.skStep(dt); // v623: habilidades
      if (!this.golden && !this.training && !this.scrimmage) { // treino é infinito: sem relógio, sem fim
        this.clock += dt / C.GAME_PACE / this.pace / this.modeSpd(); // v563: no X1 o relógio não acelera junto (mesma duração) // v448: o relógio segue em segundos reais (o tempo continua com 60 s)
        if (this.clock >= this.halfSec && this.waitPlay()) return this.endHalf();
      }
      { const k4 = this.trick4; if (k4 && (this.ball.owner || this.time - k4.T > 2.5)) { this.trick4 = null; const by = k4.by; // v588: chapéu/vaca só contam se ele pegar a bola
        if (this.ball.owner === by) { by.dribT = this.time; this.chemEv(by, "drib"); this.onEvent("dribble", { team: by.team, name: by.p.short, vs: k4.vs.p.short, trick4: k4.name, noSnd: true }); this.fx.push({ kind: "text", x: by.x, y: by.y - 30, text: k4.name, t: 0.9, color: "#9dff6a" }); } } }
      if (this.legend && !this.legend.done) this.legendStep(); // v582
      { const X = this.x1(); if (X) { const ot = this.ball.owner ? this.ball.owner.team : null; // v562 (Mickey) · X1: perdeu a bola = stack de estilo zera
        const tk = this.trick; if (tk && this.ball.owner) { this.trick = null; // v564: drible com a bola solta só conta se ele pegar de volta
          if (this.ball.owner === tk.by) { const by = tk.by, CB = X.combo; by.comboN = CB && this.time - (by.comboT ?? -99) < CB.chain ? (by.comboN || 1) + 1 : 1; by.comboT = this.time; this.x1Flair(by); // v565 (Mickey): combos (BLADE → HAXBALL, PUXADA → CANETA...)
            if (CB && by.comboN >= 2) { this.addStack(by.team, CB.stack); this.fx.push({ kind: "text", x: by.x, y: by.y - 52, text: "COMBO x" + by.comboN + "!", t: 1, color: "#ffd23f" }); }
            const hx = tk.name === "HAXBALL!", past = !tk.vs || (by.x - tk.vs.x) * this.dir(by.team) > 0; // v570 (Mickey): haxball só pontua se passou do marcador, e uma vez por sequência
            if (!hx) by.haxN = 0; else by.haxN = (by.haxN || 0) + 1;
            if (!hx || (past && !by.haxPaid)) { this.addStack(tk.by.team, tk.name === "BLADE!" ? X.style.blade : hx ? X.style.drib : X.style.humilN); if (hx) by.haxPaid = true; }
            if (!hx) by.haxPaid = false;
            if (X.boost) { by.burst = Math.max(by.burst || 0, X.boost); by.dribSlow = false; } // v570 (Mickey): drible dá um boost de velocidade
            if (hx && X.hax.chain && Math.min(by.y, H - by.y) < X.hax.wall && Math.random() < X.hax.chain * this.iv(by, "passe") / 31) { by.wallCd = 0; by.think = 0; by.haxAgain = this.time; } // v570: perto da parede, Passe bom emenda outro haxball
            if (tk.name === "BLADE!" && X.combo.blade2 && Math.random() < X.combo.blade2 * this.iv(by, "drible") / 31) { by.bladeCd = 0; by.think = 0; } // v570: dois blades seguidos
            if (tk.name === "HAXBALL!" && X.hax && Math.random() < X.hax.drib * this.iv(by, "passe") / 31) { by.trickCd = 0; by.think = 0; by.haxGo = this.time; } /* v567 (Mickey): Passe bom = emenda um drible logo depois do haxball */ this.onEvent("dribble", { team: tk.by.team, name: tk.by.p.short, vs: tk.vs ? tk.vs.p.short : "", noSnd: !tk.quiet }); if (!tk.quiet) this.fx.push({ kind: "text", x: tk.by.x, y: tk.by.y - 30, text: tk.name, t: 0.9, color: "#9dff6a" }); this.shake(5, 0.2); } }
        if (ot != null && this.possT !== ot) { if (this.possT != null && this.stack) this.stack[this.possT] = 0; this.possT = ot; } } }
      if (!this.training && !this.scrimmage) for (const x of this.ents) { const rg = !x.gk && this.ifx(x).regen; if (rg) x.energy = Math.min(100, x.energy + rg * dt); } // v524: Caneleira Raiz Eterna
      const b = this.ball;
      if (!b.owner && !(b.pass && !b.pass.bad && !b.shot)) this.hotT = this.time; // v455: bola solta/chute = jogo disputado
      if (b.owner && !b.owner.gk && b.owner.team !== this.lastOwnTeam) this.hotT = this.time;
      if (b.owner && !b.owner.gk && b.owner.team !== this.schemeTeam) {
        // v441 (Mickey): a cada posse nova, sorteia o lado do Ala Of e se é a jogada trocada (2 em 10: Pivô abre, Ala Of centraliza);
        // quem perdeu a bola sorteia se o Pivô volta para marcar (1 em 10)
        const pt = (this.schemeTeam = b.owner.team), P = C.POS_AI; this.scheme = this.scheme || [{}, {}];
        const of = this.field(pt).find((m) => m.alaOf); // v445: o Ala Of fica na ala do lado em que já está (não atravessa o campo a cada posse)
        this.scheme[pt] = { side: of && Math.abs(of.y - H / 2) > 40 ? Math.sign(of.y - H / 2) : Math.random() < 0.5 ? -1 : 1, swap: Math.random() < P.swap, wingGo: Math.random() < P.wingGo, adRun: Math.random() < C.ALA_DEF.runP }; // v445: 9 em 10 o Ala Of busca a ala perto da área
        for (const m of this.field(1 - pt)) if (m.pivo) m.backOk = Math.random() < P.pivoBack;
      }
      if (b.owner) this.lastOwnTeam = b.owner.team;
      if (this.onSample && this.time >= (this.nextSample || 0)) { this.nextSample = this.time + 1; this.onSample(this); } // v134: registro da partida
      if (this.training) { if (b.owner) this.poss[0] += dt; } // treino: a bola é sempre do seu time
      else if (b.owner && !b.owner.gk) this.poss[b.owner.team] += dt;
      else if (b.owner && b.owner.gk) this.poss[b.owner.team] += dt * 0.5;

      for (const e of this.ents) {
        e.stun = Math.max(0, e.stun - (e.gk || !(e.stun > 0) ? dt : dt / this.actF(e))); e.slideCd = Math.max(0, (e.slideCd || 0) - dt); e.wallCd = Math.max(0, (e.wallCd || 0) - dt); e.pushCd = Math.max(0, (e.pushCd || 0) - dt); e.trickCd = Math.max(0, (e.trickCd || 0) - dt); if (e.vaca > 0 && (e.vaca -= dt) <= 0 && e.mode === "runTo" && this.ball.pass && this.ball.pass.to === e) { e.ty = this.ball.y; } e.bladeCd = Math.max(0, (e.bladeCd || 0) - dt); /* v561 */ e.burst = Math.max(0, e.burst - dt); e.duelCd = Math.max(0, e.duelCd - dt);
        if (e.gk) this.thinkKeeper(e, dt);
        else this.thinkField(e, dt);
        if (!e.gk && e.stun <= 0) this.footFx(e, dt);
        if (this.duelMode && !e.gk && (e.ghostT = (e.ghostT || 0) - dt) <= 0) { e.ghostT = 0.035; (e.ghost = e.ghost || []).push({ x: e.x, y: e.y }); if (e.ghost.length > 5) e.ghost.shift(); }
      }
      this.moveBall(dt);
      this.checkContacts();
    }

    advanceState() {
      if (this.state === "kickoff") { this.state = "play"; return; }
      if (this.state === "goal") {
        if (this.checkEnd()) return;
        if (this.stoppage) return this.endHalf(); // gol nos acréscimos: vai direto pro intervalo
        this.state = "kickoff"; this.stateT = 0.7; this.kickoff(this.lastConceded);
        return;
      }
      if (this.state === "halftime") {
        this.half = 2; this.clock = 0; this.state = "kickoff"; this.stateT = 0.9; this.kickoff(1);
        return;
      }
      if (this.state === "goldenIntro") { this.state = "kickoff"; this.stateT = 0.5; this.kickoff(Math.random() < 0.5 ? 0 : 1); }
    }

    // v130 · fim do 1º tempo: espera o lance de quem ataca acabar (roubo, defesa/espalmada, gol ou bola com o goleiro)
    waitPlay() {
      if (this.half !== 1) return true;
      const b = this.ball, o = b.owner;
      if (!this.stoppage) {
        const team = o ? (o.gk ? -1 : o.team) : b.shot ? b.shot.team : this.lastOwnTeam ?? -1;
        if (team < 0) return true;
        this.stoppage = { team, until: this.clock + C.HALF_STOPPAGE_MAX };
        return false;
      }
      const s = this.stoppage;
      return s.done || this.clock >= s.until || (o && (o.gk || o.team !== s.team));
    }

    endHalf() {
      this.stoppage = null;
      if (this.training) return this.finish("treino");
      if (this.half === 1) {
        this.state = "halftime"; this.stateT = 2.6;
        const used = this.onEvent("halftime", { match: this }) || {};
        this.halftimeInfo = used;
        return;
      }
      if (this.score[0] === this.score[1]) {
        this.golden = true; this.goldenT = this.time; // v133: o jogo segue sem voltar pro meio; só um aviso sutil
        if (this.state !== "play") { this.state = "kickoff"; this.stateT = 0.5; this.kickoff(Math.random() < 0.5 ? 0 : 1); }
        this.onEvent("golden", {});
        return;
      }
      this.finish();
    }

    checkEnd() {
      if (this.training || this.scrimmage) return false;
      const diff = Math.abs(this.score[0] - this.score[1]), mercy = !this.x1() || !!(C.X1 && C.X1.mercy); // v562 (Mickey): no X1 não tem misericórdia · v693 (Mickey): agora tem (C.X1.mercy)
      if (this.golden || (mercy && diff >= C.MERCY_DIFF)) { this.finish(mercy && diff >= C.MERCY_DIFF && !this.golden ? "mercy" : this.golden ? "golden" : "time"); return true; }
      return false;
    }

    finish(reason = "time") {
      this.state = "ended";
      this.result = { score: [...this.score], win: this.score[0] > this.score[1], reason, passes: [...this.passes], poss: [...this.poss], shots: [...this.shots] };
      this.onEvent("end", this.result);
    }

    // ---------- IA: goleiro ----------
    thinkKeeper(g, dt) {
      const b = this.ball, t = g.team;
      if (b.owner === g) {
        g.hold -= dt; const gpOver = C.GK_POSS && this.time - (g.possT ?? this.time) >= C.GK_POSS.t - 0.1; if (gpOver) g.hold = Math.min(g.hold, 0); // v603: acabou o tempo, solta
        { const K = this.combo && this.combo[t]; if (K && K.st === "setup") { // v600: espera todos chegarem nas posições do combo
          if (g.hold <= 0 && this.time - (g.possT ?? -9) >= (C.GK_POSS ? C.GK_POSS.minHold : 0) && (gpOver || this.time - K.T > C.COMBO.wait || this.field(t).every((e) => { if (!e.fixo) return true; const q = this.comboSpotFor(e, K); return !q || hyp(q.x - e.x, q.y - e.y) < C.COMBO.near; }) /* v602 (Mickey): o goleiro sai quando o Fixo chega na posição */)) { K.st = "run"; if (this.comboStep(g)) { this.restart = { team: t, until: this.time + 1.6 }; this.onEvent("gkpass", { team: t }); } else this.combo[t] = null; }
          if (!this.combo[t] || K.st === "setup" || b.owner !== g) return; } }
        if (g.hold <= 0 && this.gkPlay(g)) return; // v635 (Mickey, vídeo da saída de bola do 3x1)
        if (g.hold <= 0) {
          const mates = this.field(this.training ? 0 : t).filter((e) => e.stun <= 0);
          if (mates.length) {
            // escolhe quem tem espaço de verdade: longe dos adversários e com a linha de passe aberta
            const space = (e) => Math.min(this.openness(e), 220) * (this.laneBlocked(g, e) ? 0.4 : 1);
            const m = mates.reduce((best, e) => (space(e) > space(best) ? e : best), mates[0]);
            this.kickTo(g, m.x + this.dir(t) * 40, m.y, 560, 4, { kind: "pass", to: m });
            this.restart = { team: t, until: this.time + 1.6 }; // reposição: o adversário respeita a distância até quem recebe dominar
            this.onEvent("gkpass", { team: t });
          }
        }
        return;
      }
      this.moveKeepers(dt, g);
    }
    // v635 (Mickey, vídeo da saída de bola do 3x1): de vez em quando o goleiro lança no espaço da ala oposta para o ala mais adiantado, que cruza o campo em diagonal,
    // leva até perto da linha e cruza no segundo pau para o Pivô (estado "cruz" do pivoStep)
    gkPlay(g) {
      const t = g.team, P = this.pplays && this.pplays[t], PV = C.PLAYS && C.PLAYS.pivo, GL = PV && PV.goleiro; if (!P || !GL || P.st || this.training) return false;
      const Q = this.ps(t), d = this.dir(t), og = this.ownGoalX(t);
      if ((P.used.goleiro || 0) >= PV.max * (Q ? Q.setMax : 1) || Math.random() >= PV.pick.goleiro * (Q ? Q.set : 1)) return false;
      const piv = this.field(t).find((x) => x.pivo && x.stun <= 0), sx = og + d * W * GL.dep, wy = (x) => (x.y > H / 2 ? GL.wing : H - GL.wing); if (!piv) return false;
      const a = this.field(t).filter((x) => (x.alaOf || x.alaDef) && x.stun <= 0 && !this.field(t).some((m) => m !== x && hyp(m.x - sx, m.y - wy(x)) < GL.mate) && !this.field(1 - t).some((o) => hyp(o.x - sx, o.y - wy(x)) < GL.open)).sort((p, q) => (q.x - og) * d - (p.x - og) * d)[0]; // ala que cruza para uma ala vazia (sem companheiro nem adversário perto do ponto)
      if (!a) return false; const sy = wy(a);
      this.kickTo(g, sx, sy, GL.sp, 10, { kind: "pass", to: a, lob: true }); if (this.ball.pass) { this.ball.pass.spot = { x: sx, y: sy }; this.ball.pass.ens = PV.ens || 0; } a.mode = "runTo"; a.tx = sx; a.ty = sy;
      this.restart = { team: t, until: this.time + 1.6 }; this.onEvent("gkpass", { team: t });
      P.used.goleiro = (P.used.goleiro || 0) + 1; P.nw = true; P.st = "cruz"; P.m = a; P.p = piv; P.until = this.time + PV.cruz.t + 2;
      this.fx.push({ kind: "text", x: g.x + d * 30, y: g.y - 34, text: "SAÍDA 3x1!", t: 1, color: "#ffd23f" });
      this.onEvent("log", { team: t, text: `Saída de bola: o goleiro lança ${a.p.short} na diagonal` });
      return true;
    }
    moveKeepers(dt, only) {
      for (const g of only ? [only] : this.gks.filter((k) => this.ents.includes(k))) {
        const b = this.ball;
        let ty = U.clamp(b.y, MOUTH_T + 14, MOUTH_B - 14);
        let sp = 230;
        if (b.shot && b.shot.team !== g.team) {
          if (b.shot.goal || b.shot.post) { ty = b.shot.ty > H / 2 ? MOUTH_T + 30 : MOUTH_B - 30; sp = 120; } // pulou para o lado errado
          else { ty = b.shot.ty; sp = 700; }
        }
        else if (g.foolT > this.time) { ty = g.foolY; sp = 320; } // v591: caiu na finta do back, foi no primeiro pau
        const tx = this.ownGoalX(g.team) + this.dir(g.team) * 22;
        g.x += U.clamp(tx - g.x, -sp * dt, sp * dt);
        g.y = U.clamp(g.y + U.clamp(ty - g.y, -sp * dt, sp * dt), MOUTH_T + 10, MOUTH_B - 10);
      }
    }
    openness(e) {
      const opp = this.field(1 - e.team);
      return opp.reduce((m, o) => Math.min(m, hyp(o.x - e.x, o.y - e.y)), 999);
    }
    // marca do estilo na defesa: Muralha desarma e bloqueia mais no próprio campo, Blitz rouba mais no campo deles
    defSig(e) {
      const own = Math.abs(e.x - this.ownGoalX(e.team)) < W / 2, sk = this.styleKey[e.team];
      return (sk === "muralha" && own) || (sk === "blitz" && !own) ? (this.edge[e.team] ? this.styles[e.team].sigWin || C.STYLE_SIG.win : this.styles[e.team].sigBase || C.STYLE_SIG.base) : 1; // v635: sigBase = marca do estilo sem vencer o confronto (equilíbrio por formação)
    }
    // linha de passe fechada: algum adversário perto da reta entre quem passa e quem recebe
    laneBlocked(a, m) {
      const dx = m.x - a.x, dy = m.y - a.y, L2 = dx * dx + dy * dy || 1;
      return this.field(1 - a.team).some((o) => { const k = ((o.x - a.x) * dx + (o.y - a.y) * dy) / L2; if (k < 0.08 || k > 1) return false; return hyp(a.x + dx * k - o.x, a.y + dy * k - o.y) < 30; });
    }

    // ---------- IA: jogador de linha ----------
    thinkField(e, dt) {
      const b = this.ball, t = e.team, d = this.dir(t);
      let tx = e.x, ty = e.y, sp = this.runSpeed(e);
      if (e.stun > 0) { e.vx *= 0.9; e.vy *= 0.9; e.x += e.vx * dt; e.y += e.vy * dt; this.clampEnt(e); return; }
      if (e.slide > 0) return this.slideStep(e, dt); // v188: carrinho (1×1)

      { const K = this.combo && this.combo[t]; if (K && (this.time > K.until || (b.owner && b.owner.team !== t) || (!b.owner && !b.pass && !b.shot && this.time - (K.kickT ?? -9) > 1.2))) this.combo[t] = null; } /* v602: bola viva logo depois do toque do combo não cancela */ // v600: perdeu a bola, acabou o combo
      if (b.owner === e) {
        e.think -= dt; e.heldT = (e.heldT || 0) + dt;
        { const K = this.combo && this.combo[t]; if (K && K.st === "run" && e.think > C.COMBO.touch) e.think = C.COMBO.touch; } // v600: combo de primeira
        { const X1q = this.x1(), TRq = X1q && X1q.trick; if (TRq && TRq.react && !(e.trickCd > 0) && (e.fol ?? 100) > TRq.minFol) { const oq = this.field(1 - t).find((q) => !q.gk && (q.x - e.x) * this.dir(t) > 10 && hyp(q.x - e.x, q.y - e.y) < TRq.near); if (oq && e.think > TRq.react) e.think = TRq.react; } } // v564: marcador chegou, ele já reage com o truque
        if (hyp(this.goalX(t) - e.x, H / 2 - e.y) < C.SHOT_CLOSE) e.think = 0; // v213: na cara do gol, decide (e finaliza) já
        if (e.think <= 0) { e.think = U.rand(0.22, 0.42) * this.actF(e) * ((this.ps(t) || {}).think || 1) * ((this.sdyn() || {}).think || 1); /* v703 */ /* v597: plays setadas = mais devagar */ this.decide(e); if (b.owner !== e) return; } // v225: velocidade decide mais rápido
        tx = e.tx; ty = e.ty;
        sp *= 0.7 + 0.01 * Math.min(31, this.iv(e, "drible")); // v575: teto 31 (o nível relativo fazia Nv 1000 conduzir 4× mais rápido)
        if (this.folLow(e)) sp *= C.X1.fol.lowRun; // v561: sem fôlego conduz mais devagar
        { const XS = this.x1(); if (XS && XS.cook) { // v568 (Mickey) · X1: cozinhar (sem fôlego anda e chama o bote) e firula (quem dribla bem volta para cima do marcador batido)
          const oq = this.field(1 - t).find((q) => !q.gk), f = e.fol ?? 100, CK = XS.cook, FL1 = XS.flair;
          if (!e.cooking && f < CK.fol && oq && !this.x1ShotOk(e, hyp(this.goalX(t) - e.x, H / 2 - e.y))) { e.cooking = true; this.fx.push({ kind: "text", x: e.x, y: e.y - 30, text: "VEM!", t: 0.9, color: "#5fd4ff" }); }
          const stOk = ((this.stack || [])[t] || 0) >= XS.style.shotMin; // v658 (Mickey): com stack para chutar não cozinha nem faz firula: vai para o gol
          if (e.cooking && (f > CK.fol + CK.hyst || !oq || stOk)) e.cooking = false;
          e.flairOn = !!oq && !stOk && this.time < (e.flairT || 0) && !e.cooking;
          if (e.cooking) { sp *= CK.walk; tx = U.clamp(e.x - d * 20, 30, W - 30); ty = U.clamp(e.y + Math.sin(this.time * 2.5 + e.x) * 40, 40, H - 40); }
          else if (e.flairOn) { sp *= FL1.walk; tx = U.clamp(oq.x, 30, W - 30); ty = U.clamp(oq.y + (e.y > oq.y ? 20 : -20), 40, H - 40); }
        } }
        if (e.ginga) sp *= 0.82; // v188: gingando na frente do marcador, segura o passo
        // v197 · construção: sem marcador colado, segura o passo até o apoio passar da linha da bola (o bloco sobe junto)
        if (this.plan[t] === "build" && this.field(t).some((m) => m !== e && m.role === "def" && (m.x - e.x) * d < 20) && this.openness(e) > 70) sp *= C.BUILD_WAIT;
      } else if ((b.owner && b.owner.team !== t && !b.owner.gk) || this.oppPassAt(e)) {
        const c = b.owner || this.oppPassAt(e), gx = this.ownGoalX(t); // v459 (Mickey): passe deles no ar = defende com base em onde a bola está
        const mk = this.markOf(t), fp = (mk && mk.fixoPress) || C.FIXO.press; // v458: marcação da formação
        const mates = this.field(t).filter((m) => m.stun <= 0 && !(m.fixo && hyp(c.x - gx, c.y - H / 2) > fp) && !(m.pivo && !m.backOk && Math.abs(c.x - gx) < W * C.POS_AI.pivoMin && !(mk && mk.pivoR && hyp(c.x - m.x, c.y - m.y) < mk.pivoR))); // v441: Pivô quase nunca volta // v437: Fixo só sai no bote perto da área
        let presser = mates.reduce((best, m) => (!best || hyp(m.x - c.x, m.y - c.y) < hyp(best.x - c.x, best.y - c.y) ? m : best), null);
        // v475 (Mickey): o Fixo é o último homem; se outro (não o Pivô) chega quase junto no portador, esse vai no bote e o Fixo fica atrás
        const CVY = !this.training && C.COVER && C.COVER.fixoYield;
        if (CVY && presser && presser.fixo) { const fd = hyp(presser.x - c.x, presser.y - c.y), alt = mates.filter((m) => m !== presser && !m.pivo && hyp(m.x - c.x, m.y - c.y) < fd + CVY).sort((p, q) => hyp(p.x - c.x, p.y - c.y) - hyp(q.x - c.x, q.y - c.y))[0]; if (alt) presser = alt; }
        // Muralha (bloco baixo): ninguém sai para pressionar enquanto a bola está no campo deles
        if (this.styles[t] && this.styles[t].press === 0 && Math.abs(c.x - gx) > W * 0.55 && !(presser && presser.pivo && mk && mk.pivoR && hyp(c.x - presser.x, c.y - presser.y) < mk.pivoR)) presser = null; // v458: o Pivô do 3-1 defensivo incomoda perto do meio
        if (presser === e) {
          // marcar: ficar entre o portador e o próprio gol, colar e dar o bote
          let ang = Math.atan2(H / 2 - c.y, gx - c.x);
          const close = hyp(c.x - e.x, c.y - e.y) < 90, R = !this.training && C.REPERT;
          let off = close ? 0 : 34 - this.iv(e, "defesa") * 0.4;
          // v474 (Mickey, clipes do Rematch): o bote vem em ângulo, fechando a linha do passe mais provável (sem abrir o gol)
          if (R && !close) { const mt = this.field(1 - t).filter((o) => o !== c && !o.gk && hyp(o.x - c.x, o.y - c.y) < R.shadowR).sort((p, q) => hyp(p.x - c.x, p.y - c.y) - hyp(q.x - c.x, q.y - c.y))[0];
            if (mt) { const df = Math.atan2(Math.sin(Math.atan2(mt.y - c.y, mt.x - c.x) - ang), Math.cos(Math.atan2(mt.y - c.y, mt.x - c.x) - ang)); if (Math.abs(df) < Math.PI / 2) ang += df * R.shadow; } }
          // v474 · 2×1: último homem com outro atacante perto e sem ajuda: não se joga, segura na frente e espera o companheiro chegar
          let hold = false; const HD = R && R.hold;
          if (HD && !c.virt) {
            const dg = (x) => Math.abs(x - gx), sec = this.field(1 - t).find((o) => o !== c && !o.gk && hyp(o.x - c.x, o.y - c.y) < HD.mate && dg(o.x) < dg(c.x) + 60);
            const last = dg(e.x) < dg(c.x) && !this.field(t).some((m) => m !== e && m.stun <= 0 && dg(m.x) < dg(c.x) - 10);
            if (sec && last && !this.field(t).some((m) => m !== e && m.stun <= 0 && hyp(m.x - c.x, m.y - c.y) < HD.help)) {
              e.holdT = e.holdOf === c ? e.holdT + dt : 0; e.holdOf = c;
              if (e.holdT < HD.t) { hold = true; off = HD.gap; tx = c.x + Math.cos(ang) * off; ty = c.y + Math.sin(ang) * off; ty += (sec.y - ty) * HD.lean; }
            } else e.holdOf = null;
          }
          if (!hold) { tx = c.x + Math.cos(ang) * off; ty = c.y + Math.sin(ang) * off; }
          if ((e.x - c.x) * d > 40) sp *= 1.12; // ficou para trás na jogada: volta correndo de verdade
          e.mode = "press";
          // v188 · 1×1: correndo atrás de quem roubou, chega perto e se joga no carrinho (arriscado: se errar, fica no chão)
          const cd = hyp(c.x - e.x, c.y - e.y);
          if (this.duelMode && !hold && !c.virt && !(e.slideCd > 0) && !(e.duelCd > 0) && !(c.duelCd > 0) && cd > 26 && cd < 72 && (e.x - c.x) * d > -10 && Math.random() < dt * C.DUEL_SLIDE_RATE) return this.startSlide(e, c);
        } else if (this.time - (c.dribT ?? -9) < C.DRIB_CLOSE.t && hyp(c.x - gx, c.y - H / 2) < W * C.DRIB_CLOSE.zone && this.closeHelper(t, c, presser) === e) {
          // v443 (Mickey): passou o drible, o mais perto (fora quem levou o drible) fecha na hora entre ele e o gol e segue tentando o bote
          const a = Math.atan2(H / 2 - c.y, gx - c.x); tx = c.x + Math.cos(a) * C.DRIB_CLOSE.gap; ty = c.y + Math.sin(a) * C.DRIB_CLOSE.gap;
          if (hyp(tx - e.x, ty - e.y) > 40) sp *= C.DRIB_CLOSE.sprint; e.mode = "close";
        } else if (e.role === "def" && Math.abs(c.x - gx) < 210 && Math.abs(c.y - H / 2) < 190) {
          // jogada perto/dentro da grande área: os defensores fecham a área (dobra no portador e marcação colada)
          const p = this.boxSpot(e, c, presser); tx = p.x; ty = p.y;
          e.mode = "box";
        } else if (e.role === "def") {
          // defensor: linha entre a bola e o gol, fechando a faixa dele
          const defs = this.field(t).filter((m) => m.role === "def");
          const depth = U.clamp(Math.abs(c.x - gx) - 90, 130, 380);
          tx = gx + d * depth; ty = this.lane(defs, e) * 0.55 + c.y * 0.45;
          const a = this.anchor(e); if (a) { tx = a.x; ty = a.y * 0.75 + c.y * 0.25; } // formação com posições fixas
          e.mode = "hold";
          // v442 (Mickey): perdeu a bola, cobre na hora os atacantes mais avançados deles pelo lado do gol (não precisa roubar, só não dar espaço)
          const cv = this.coverSpot(e, c, presser); if (cv) { tx = cv.x; ty = cv.y; e.mode = "cover"; if ((e.x - cv.x) * d > 30) sp *= C.MARK.sprint; }
        } else {
          // atacante sem a bola: um marca a saída dos zagueiros deles, o outro fica livre para o contra-ataque
          const atks = this.field(t).filter((m) => m.role !== "def" && m !== presser);
          // time com poucos defensores (Rakuzan, 1-1-3): quando o ataque deles chega no nosso campo, atacantes voltam para ajudar;
          // fora da área um fica de saída para o contra-ataque, perto da área todo mundo volta
          const defsLeft = mates.filter((m) => m.role === "def" && m !== presser).length;
          const ourHalf = Math.abs(c.x - gx) < W * 0.55, nearBox = Math.abs(c.x - gx) < 300;
          const lack = Math.max(0, 2 - defsLeft); // quantos defensores faltam
          // no campo deles: um ajuda a pressionar logo após perder a bola e outro fica de cobertura atrás da bola
          const blitz = this.styles[t] && this.styles[t].press === 2 && !ourHalf ? 1 : 0; // Blitz: pressão alta com mais gente no campo deles
          const need = Math.min(atks.length, ourHalf ? lack + (nearBox ? 1 : 0) : lack + blitz + (mk && mk.press ? mk.press : 0)); // v458: 3-1 ofensivo, mais gente no bote
          const helpers = atks.filter((m) => !m.pivo || m.backOk).sort((a2, b2) => hyp(a2.x - c.x, a2.y - c.y) - hyp(b2.x - c.x, b2.y - c.y)).slice(0, need);
          const hi = helpers.indexOf(e);
          if (hi >= 0) {
            const toGoal = (x, y, off) => { const a = Math.atan2(H / 2 - y, gx - x); return { x: x + Math.cos(a) * off, y: y + Math.sin(a) * off }; };
            let p;
            if (hi === 0) { p = toGoal(c.x, c.y, 60); e.mode = "double"; } // dobra a marcação no portador, pelo lado do gol
            else if (!ourHalf) {
              // cobertura: entre a bola e o nosso gol, para não tomar contra-ataque de cara
              const back = Math.max(180, Math.abs(c.x - gx) * 0.35);
              p = { x: c.x + Math.sign(gx - c.x) * back, y: c.y * 0.5 + (H / 2) * 0.5 }; e.mode = "sweep";
            } else {
              // marca colado, pelo lado do gol, quem pode receber o passe (o mais perto do nosso gol primeiro)
              const th = this.field(1 - t).filter((o) => o !== c && !o.gk).sort((a2, b2) => Math.abs(a2.x - gx) - Math.abs(b2.x - gx))[hi - 1];
              p = th ? toGoal(th.x, th.y, 28) : { x: gx + d * 70, y: H / 2 + (c.y - H / 2) * 0.4 };
              e.mode = "track";
            }
            tx = p.x; ty = p.y;
            if ((e.x - c.x) * d > 0) sp *= 1.12; // ainda à frente da bola: volta correndo de verdade
          } else {
          const rest = atks.filter((m) => !helpers.includes(m));
          const i = rest.indexOf(e), deep = Math.abs(c.x - gx) < W * 0.4;
          // sozinho: marca se a bola está longe do nosso gol, senão fica de saída. Muralha: o atacante sempre espera o contra-ataque
          const marks = this.styleKey[t] === "muralha" ? false : rest.length > 1 ? i === 0 : !deep && !need;
          const opps = this.field(1 - t).filter((o) => o !== c);
          const back = opps.sort((a2, b2) => (a2.x - b2.x) * d * -1 - (b2.x - a2.x) * d * -1)[i % Math.max(1, opps.length)];
          if (marks && back) {
            // fica entre o zagueiro deles e a bola, cortando o passe de saída
            tx = back.x + (c.x - back.x) * 0.35; ty = back.y + (c.y - back.y) * 0.35;
            e.mode = "markBack";
          } else {
            // contra-ataque: no campo deles, do lado oposto da bola, esperando o lançamento
            const side = c.y < H / 2 ? 1 : -1;
            tx = W / 2 + d * (120 + 40 * (i % 2)); ty = U.clamp(H / 2 + side * (90 + 50 * (i % 2)), 60, H - 60);
            e.mode = "outlet";
          }
          }
        }
      } else if (b.owner && b.owner.gk && b.owner.team !== t) {
        // goleiro adversário com a bola: recompor
        const grp = this.field(t).filter((m) => (m.role === "def") === (e.role === "def"));
        tx = e.role === "def" ? W / 2 - d * 230 : W / 2 - d * 70; ty = this.lane(grp, e);
        const a = e.role === "def" && this.anchor(e); if (a) { tx = a.x; ty = a.y; }
        if (this.oppGkShapes[t]) { const o = this.anchor(e, "oppGk"); if (o) { tx = o.x; ty = o.y; } } // desenho próprio de pressão na saída do goleiro deles
        e.mode = "recover";
      } else if (!b.owner || b.shot) {
        // bola solta: o mais perto do time vai nela
        const mates = this.field(t);
        const lead = 0.25;
        const px = b.x + b.vx * lead, py = b.y + b.vy * lead;
        const mine = this.looseMine(mates, px, py); // v469 (Mickey vídeo): vai quem chega primeiro na bola, não quem está mais perto de um ponto fixo
        const fill = b.pass && b.pass.fill && b.pass.team === t && b.pass.to !== e && b.pass.from !== e && e.role !== "def" ? b.pass.fill : null;
        if (b.pass && b.pass.spot && b.pass.to === e) {
          // infiltração: corre para o ponto futuro; perto da bola, vai nela
          if (hyp(b.x - e.x, b.y - e.y) > 110 && hyp(b.vx, b.vy) > 60 && hyp(b.pass.spot.x - e.x, b.pass.spot.y - e.y) > 14) { tx = b.pass.spot.x; ty = b.pass.spot.y; } else { tx = px; ty = py; } // v565: bola parou longe do ponto (ou ele já chegou): vai buscar (travava o jogo no gol de ouro)
          e.mode = "runTo";
        } else if (fill) {
          tx = fill.x; ty = fill.y; e.mode = "support"; // ocupa o espaço que o companheiro deixou
        } else if (mine === e || (e.mode === "runTo" && b.pass && b.pass.from && b.pass.from.team === t)) {
          if (e.mode === "runTo" && b.pass && b.pass.wall) {
            // tabela: corre para onde a bola volta; se a bola morreu ou ele já chegou e ela não veio, vai buscar
            if (hyp(b.vx, b.vy) > 90 && hyp(e.tx - e.x, e.ty - e.y) > 8) { tx = e.tx; ty = e.ty; }
            else { e.mode = "chase"; b.pass = null; }
          }
          if (hyp(b.x - e.x, b.y - e.y) < 160 || e.mode !== "runTo") { tx = px; ty = py; }
          // v469 (Mickey vídeo): bola solta de verdade (sem passe limpo nosso): o mais perto vai nela e nenhuma posição (Fixo, Ala Def, Pivô) passa por cima
          if (e.mode !== "runTo" && (!b.pass || b.pass.bad || b.pass.team !== t || (hyp(b.vx, b.vy) < 200 && !b.pass.air))) e.mode = "chase";
        } else if (b.pass && b.pass.to === e) {
          tx = px; ty = py; // vai receber o passe
        } else {
          if (["chase", "press", "close", "double", "track", "sweep", "box"].includes(e.mode)) e.mode = "hold"; // v469: não é mais o mais perto da bola · v475: modo de bote velho não fica preso (travava o Fixo e a cobertura)
          const grp = mates.filter((m) => (m.role === "def") === (e.role === "def"));
          tx = e.role === "def" ? U.clamp(b.x - d * 200, 80, W - 80) : U.clamp(b.x + d * 90, 80, W - 80);
          if (e.role === "def") tx = d > 0 ? Math.min(tx, W / 2) : Math.max(tx, W / 2);
          ty = this.lane(grp, e);
          const a = e.role === "def" && this.anchor(e); if (a) { tx = a.x; ty = a.y * 0.8 + b.y * 0.2; }
          // v469 (Mickey vídeo): com a bola solta ali do lado, quem está perto também disputa (não passa reto ignorando a bola)
          const L = C.LOOSE, ownPass = b.pass && !b.pass.bad && b.pass.team === t;
          if (L && !b.shot && !(ownPass && b.pass.from === e) && hyp(b.x - e.x, b.y - e.y) < L.near && hyp(mine.x - b.x, mine.y - b.y) > L.mateNear) { tx = px; ty = py; e.mode = "chase"; }
        }
        if (b.shot && b.shot.team !== t) { tx = e.x; ty = e.y; sp *= 0.3; }
      } else {
        // time com a bola (goleiro ou companheiro): abrir espaço para receber
        const own = b.owner;
        if (this.isAtk(e)) {
          const atks = this.field(t).filter((m) => this.isAtk(m) && m !== own);
          const ahead = own.gk ? this.ownGoalX(t) + d * 300 : own.x + d * 170;
          tx = U.clamp(ahead + d * 40 * (atks.indexOf(e) % 2), 60, W - 60);
          ty = atks.length > 1 ? this.lane(atks, e) : own.gk ? H / 2 + (this.field(t).indexOf(e) % 2 ? 110 : -110) : own.y > H / 2 ? H / 2 - 120 : H / 2 + 120;
          const a = e.role === "def" && this.anchor(e);
          if (a) {
            // formação fixa: o desenho sobe junto com a bola; os dois da frente se oferecem mais à frente para o passe
            const rel = (b.x - this.ownGoalX(t)) * d / W, front = (a.x - this.ownGoalX(t)) * d / W > 0.3;
            tx = a.x + d * (U.clamp((rel - 0.2) * W * 0.85, 40, W * 0.42) + (front ? W * (rel > 0.45 ? 0.2 : 0.12) : 0)); ty = a.y;
            if (front) tx = this.ownGoalX(t) + d * Math.max((tx - this.ownGoalX(t)) * d, W * 0.58); // os dois da frente esperam o lançamento no campo deles
            tx = U.clamp(tx, 60, W - 60);
          } else if (e.role !== "def" && this.anchor(e)) {
            // atacante de formação desenhada: abre na faixa do desenho e nunca fica atrás da posição dele
            // sobe junto com a jogada: no máximo ~260 à frente de quem está com a bola, até chegar na posição do desenho
            const an = this.anchor(e), lim = own.x + d * 260; ty = an.y;
            const target = (an.x - lim) * d > 0 ? lim : an.x;
            if ((target - tx) * d > 0) tx = target;
            if (own.gk) tx = an.x; // nosso goleiro com a bola: atacante fica na posição dele no desenho, lá na frente
          }
          // saída de bola da Blitz (1-1-3) no próprio campo: um atacante volta curto para dar o apoio do lado da bola,
          // outro abre do lado oposto um pouco mais à frente e o terceiro fica lá na frente; sobem juntos com a bola
          const og = this.ownGoalX(t), bx0 = own.gk ? og + d * 200 : own.x;
          if (this.styleKey[t] === "blitz" && !this.training && (bx0 - og) * d < W * 0.45 && e.role !== "def") {
            const fr = atks.filter((m) => m.role !== "def"), ay = (m) => (this.anchor(m) || m).y;
            fr.sort((p, q) => Math.abs(ay(p) - own.y) - Math.abs(ay(q) - own.y) || this.field(t).indexOf(p) - this.field(t).indexOf(q));
            const k = fr.indexOf(e), side = fr.length && ay(fr[0]) > own.y ? 1 : -1;
            if (k === 0) { tx = bx0 + d * 100; ty = own.y + side * 120; } // apoio curto
            else if (k === 1) { tx = bx0 + d * 220; ty = own.y - side * 150; } // abre do outro lado, escalonado
            else if (k >= 2) { tx = bx0 + d * 340; ty = H / 2 + (ay(e) - H / 2) * 0.3; } // referência lá na frente
            if (k >= 0) { tx = U.clamp(tx, 60, W - 60); ty = U.clamp(ty, 60, H - 60); }
          }
          // dupla da frente: o parceiro de quem está com a bola se oferece na diagonal, à frente, para a tabela
          if (!own.gk && this.duoMate(own) === e) {
            tx = U.clamp(own.x + d * 120, 60, W - 60);
            ty = U.clamp(own.y + (own.y > H / 2 ? -150 : 150), 60, H - 60);
          }
          // ala que sobe no contra-ataque: acompanha o portador pelo outro lado, um pouco à frente, para dar opção
          if (e.wing && this.counterMate(t) === e) {
            tx = U.clamp(own.x + d * 60, 60, W - 60);
            ty = U.clamp(own.y > H / 2 ? own.y - 150 : own.y + 150, 60, H - 60);
            e.mode = "counter";
          }
          // goleiro do time com a bola: formação pode ter um desenho próprio para essa saída
          if (own.gk && this.gkShapes[t]) { const g = this.anchor(e, "gk"); if (g) { tx = g.x; ty = U.clamp(g.y, PR + 2, H - PR - 2); } }
          if (this.plan[t] === "build" && !own.gk && e.role === "def") { const q = this.buildSpot(e, own); tx = q.x; ty = q.y; } // v197: sobe junto apoiando
          e.mode = "support";
        } else {
          // defensor do time com a bola: segura a sobra no próprio campo
          const defs = this.field(t).filter((m) => m.role === "def" && m !== own);
          tx = U.clamp(own.x - d * 170, 70, W - 70);
          tx = d > 0 ? Math.min(tx, W / 2 + 40) : Math.max(tx, W / 2 - 40);
          ty = this.lane(defs, e);
          const a = this.anchor(e);
          if (a) { const rel = (own.x - this.ownGoalX(t)) * d / W; tx = U.clamp(a.x + d * U.clamp((rel - 0.2) * W * 0.85, 40, W * 0.42), 60, W - 60); ty = a.y; } // sobe com a bola, sem sair da forma
          e.mode = "cover";
          if (this.plan[t] === "build" && !own.gk) { const q = this.buildSpot(e, own); tx = q.x; ty = q.y; e.mode = "support"; } // v197: sobe junto apoiando
          // Toque de bola contra a 1-3-1: o zagueiro mais recuado vigia o atacante isolado deles (do lado do gol),
          // para o contra-ataque morrer no primeiro bote. É o que faz a 1-2-2 vencer a 1-3-1
          if (this.styleKey[t] === "toque") {
            const s = this.field(1 - t).find((x) => this.soloAtk(x));
            const last = defs.find((x) => x.fixo) || defs.filter((x) => !x.alaDef).reduce((m, x) => (!m || Math.abs(x.x - this.ownGoalX(t)) < Math.abs(m.x - this.ownGoalX(t)) ? x : m), null); // v439: quem vigia é o Fixo, nunca o Ala Def
            if (s && last === e) { tx = s.x - d * 45; ty = s.y + (H / 2 - s.y) * 0.2; e.mode = "watch"; }
          }
        }
      }
      // Toque de bola contra a 1-3-1: com a bola com eles, o zagueiro mais recuado marca colado o atacante isolado,
      // do lado do gol. O passe para ele fica fechado e, se chegar, o bote vem na hora
      if (this.styleKey[t] === "toque" && e.role === "def" && b.owner && b.owner.team !== t && !b.owner.gk) {
        const s = this.field(1 - t).find((x) => this.soloAtk(x));
        if (s && s !== b.owner) {
          const g = this.ownGoalX(t), dl = this.field(t).filter((m) => m.role === "def"), last = dl.find((x) => x.fixo) || dl.filter((x) => !x.alaDef).reduce((m, x) => (!m || Math.abs(x.x - g) < Math.abs(m.x - g) ? x : m), null);
          if (last === e) { tx = s.x + (g - s.x) * 0.06 - d * 22; ty = s.y + (H / 2 - s.y) * 0.1; e.mode = "watch"; }
        }
      }
      if (e.fixo && !this.training) { const f = this.fixoSpot(e, tx, ty); if (f) { tx = f.x; ty = f.y; e.mode = f.mode; } }
      if ((e.alaOf || e.pivo) && !this.training) { const f = this.attackSpot(e); if (f) { tx = f.x; ty = f.y; e.mode = f.mode; if (f.mode === "alaOfWing" && hyp(tx - e.x, ty - e.y) > 80) sp *= C.POS_AI.wingSprint; } } // v445: corre para a ala
      if (e.pivo && !this.training && this.pivoDiag(e)) { tx = e.diag.x; ty = e.diag.y; e.mode = "diag"; sp *= C.PLAYS.pivo.diag.sprint; } // v471: diagonal do Pivô
      // v441 (Mickey): sem a bola, o Pivô volta no máximo até ~1/3 do campo (o círculo do print), nunca para dentro da nossa área
      if (e.pivo && !this.training && b.owner && b.owner.team !== t && ((tx - this.ownGoalX(t)) * d) < W * C.POS_AI.pivoMin) tx = this.ownGoalX(t) + d * W * C.POS_AI.pivoMin;
      if (e.alaDef && !this.training) { const f = this.alaDefSpot(e);
        // v453 (Mickey): se só o Fixo ficou atrás da bola, o Ala Def não ataca por completo (evita o contra-ataque)
        if (f && (f.mode === "ala" || f.mode === "alaRun") && b.owner && b.owner.team === t && this.field(t).filter((m) => m !== e && (b.owner.x - m.x) * d > 0).length <= 1)
          f.x = this.ownGoalX(t) + d * Math.min((f.x - this.ownGoalX(t)) * d, W * C.ALA_DEF.safeMax);
        if (f) { tx = f.x; ty = f.y; e.mode = f.mode; if (f.sp && (tx - e.x) * d > 60) sp *= f.sp; } }
      // v442 (Mickey: alas grudados): o Ala Def não chega a menos de POS_AI.sep do Ala Of; afasta pelo lado do campo, se faltar espaço vai para o outro
      if (e.alaDef && !this.training && b.owner !== e) {
        const of = this.field(t).find((m) => m.alaOf), S = C.POS_AI.sep;
        if (of && hyp(tx - of.x, ty - of.y) < S) {
          const dy = Math.sqrt(Math.max(0, S * S - (tx - of.x) ** 2)), up = of.y - dy, dn = of.y + dy;
          ty = (ty < of.y ? up >= 60 : dn > H - 60) ? up : dn;
        }
      }
      // v475 (Mickey): ninguém sai sozinho na cara do goleiro: sem companheiro pelo lado do gol do atacante deles mais adiantado, o mais perto volta e fica lá
      if (!this.training) { const cv = this.lastMan(e); if (cv) { tx = cv.x; ty = cv.y; e.mode = "last"; sp *= C.COVER.sprint; } }
      // v485 (Mickey: "o Fixo é o cara da marcação"): portador deles vindo no nosso campo, perto do Fixo ou o mais adiantado: o Fixo vai nele pela linha do gol
      // (gap px à frente, menos com Defesa alta) e encosta para o desarme; não desvia para a ala
      if (e.fixo && !this.training && C.FIXO.duel) { const fd = this.fixoDuel(e); if (fd) { tx = fd.x; ty = fd.y; e.mode = "fixoDuel"; sp *= C.FIXO.duel.sprint; } }
      // v487 (Mickey): o Ala Def é um segundo Fixo: marca o segundo mais avançado deles (ou o primeiro, se o Fixo ficou fora do lance), mais aberto que o Fixo
      if (e.alaDef && !this.training && C.ALA_FIXO && !["press", "close", "chase", "slide", "last"].includes(e.mode)) { const af = this.alaFixo(e); if (af) { tx = af.x; ty = af.y; e.mode = "alaFixo"; sp *= C.ALA_FIXO.sprint; } }
      // v501 (Mickey): na defesa o Ala Def sempre volta (é a função dele); o Ala Of cobre e pode marcar, mas fica mais alto que o Ala Def, em posição de receber o passe
      const OD = C.OF_DEF;
      if (OD && !this.training && b.owner && b.owner.team !== t && !b.owner.gk) { const og = this.ownGoalX(t), dp = (x) => (x - og) * d;
        if (e.alaOf && !["press", "close", "chase", "slide", "last", "double", "runTo"].includes(e.mode)) { const ad = this.field(t).find((m) => m.alaDef && m.stun <= 0), minD = Math.min(W * OD.maxDep, Math.max(W * OD.minDep, ad ? dp(ad.x) + OD.gap : 0)); if (dp(tx) < minD) tx = og + d * minD; }
        if (e.alaDef && dp(e.x) > dp(b.owner.x) - OD.ahead) sp *= OD.sprint; }
      // v455 (Mickey): com o jogo calmo, meu time tende para as posições do Meu time (com a bola / sem a bola)
      const msh = this.myShapes && this.myShapes[t];
      if (msh && !this.training && e.slot != null && this.time - this.hotT > C.CALM_T && b.owner && !b.owner.gk && b.owner !== e && !(b.pass && b.pass.to === e) && !["press", "box", "close", "chase", "runTo", "slide", "double", "go", "watch", "diag", "last", "fixoDuel", "alaFixo"].includes(e.mode)) {
        const RQ = b.owner.team === t && this.ps(t), ph = RQ && RQ.rot ? Math.floor(this.time / RQ.rot) % 3 : 0, sl = RQ && RQ.triRot ? (this.triPerm && this.triPerm[t] ? this.triPerm[t][e.slot] : e.slot) : RQ && RQ.shuffle && RQ.rot ? this.shufSlot(t, e.slot, Math.floor(this.time / RQ.rot)) : ph === 1 ? [0, 1, 3, 2][e.slot] : ph === 2 ? [0, 2, 1, 3][e.slot] : e.slot; // v597 (Mickey): Equilíbrio = rotação entre as posições
        const sh = b.owner.team === t ? msh.com : msh.sem, q = sh && sh[b.owner.team === t ? sl : e.slot]; // v493: o inimigo também tem o Com a bola (padrão) · v458
        if (q) { const k = C.SHAPE_PULL * (b.owner.team === t ? ((this.ps(t) || {}).free ?? 1) : 1), /* v599: ataque livre */ ax = this.ownGoalX(t) + d * q[0] * W, ay = q[1] * H; tx += (ax - tx) * k; ty += (ay - ty) * k; }
      }
      // v632 (Mickey, livro de futsal): bola no pé = losango do 3x1 que anda com a bola; quem ocupa cada vaga muda a cada passe pelo rodízio da posse (fsTurn)
      const FS = (this.ps(t) || {}).futsal;
      if (FS && !this.training && this.rplays && this.rplays[t] && e.slot != null && b.owner && b.owner.team === t && !b.owner.gk && b.owner !== e && !(b.pass && b.pass.to === e) && !["press", "box", "close", "chase", "runTo", "slide", "double", "go", "watch", "diag", "last", "fixoDuel", "alaFixo"].includes(e.mode)) {
        const sp4 = this.fsSpot(t, this.triPerm && this.triPerm[t] ? this.triPerm[t][e.slot] : e.slot); if (sp4) { tx += (sp4.x - tx) * FS.pull; ty += (sp4.y - ty) * FS.pull; }
      }
      // v591 (Mickey, clipe do Rematch): marcação em quadrado (4×4, os dois times): 2 na frente (Pivô, Ala Of) e 2 atrás (Fixo, Ala Def) num quadrado entre a bola e o nosso gol, que anda junto com a bola
      const SQ = C.SQUARE;
      if (SQ && !this.training && this.rplays && this.rplays[t] && e.slot != null && b.owner && b.owner.team !== t && !b.owner.gk && !["press", "close", "chase", "slide", "double", "last", "fixoDuel", "alaFixo", "runTo", "go", "diag"].includes(e.mode)) {
        const og = this.ownGoalX(t), front = e.pivo || e.alaOf, fx = U.clamp((b.owner.x - og) * d - SQ.gap, W * SQ.minF, W * SQ.maxF), bx = Math.max(W * SQ.minB, fx - SQ.side);
        const cy = U.clamp(H / 2 + (b.owner.y - H / 2) * SQ.follow, SQ.side / 2 + 40, H - SQ.side / 2 - 40);
        const mate = this.field(t).find((m) => m !== e && m.slot != null && (front ? m.pivo || m.alaOf : m.fixo || m.alaDef)), top = mate ? e.y < mate.y || (e.y === mate.y && e.slot < mate.slot) : e.y < cy;
        const ZN = this.fsZ(t), zs = ZN && this.fsZone(e, fx); /* v635: zone pode vir de outro estilo (Equilíbrio usa a da Bola no pé) */ // v632 (Mickey, livro de futsal): bola no pé marca por zona em losango (bola no meio) e triângulo (bola na ala), ala oposto e Pivô fechando o meio
        if (zs) { tx += (zs.x - tx) * ZN.k; ty += (zs.y - ty) * ZN.k; }
        else { const ax = og + d * (front ? fx : bx), ay = cy + (top ? -1 : 1) * SQ.side / 2; tx += (ax - tx) * SQ.k; ty += (ay - ty) * SQ.k; }
      }
      // v458 (Mickey): na marcação 3-1 o Pivô espera a bola deles numa altura fixa (perto do meio no defensivo, lá na frente no ofensivo)
      const mk = this.markOf(t);
      if (mk && mk.pivoX && e.pivo && !this.training && b.owner && b.owner.team !== t && !b.owner.gk && !["press", "close", "chase", "runTo", "slide", "diag", "last"].includes(e.mode)) {
        const ax = this.ownGoalX(t) + d * mk.pivoX * W, ay = H / 2 + (b.owner.y - H / 2) * 0.5; tx += (ax - tx) * 0.7; ty += (ay - ty) * 0.7;
      }
      // reposição do goleiro adversário: fica a pelo menos 150 px de cada jogador de linha deles (não corre em cima de quem recebe)
      if (this.restartFor(1 - t)) {
        for (const m of this.field(1 - t)) {
          const dx2 = tx - m.x, dy2 = ty - m.y, dd = hyp(dx2, dy2);
          if (dd < 180) { const k = 180 / (dd || 1); tx = m.x + dx2 * k; ty = m.y + dy2 * k; if (dd < 1) tx = m.x - d * 180; }
        }
        tx = U.clamp(tx, 30, W - 30); ty = U.clamp(ty, 30, H - 30);
      }
      // v197 · tabela de primeira (ofensivas): quem tocou dispara para frente para receber de volta
      if (e.ggT && !e.fixo && (this.time - e.ggT < C.GIVE_GO_T || this.time < (e.ggUntil || 0)) && b.owner !== e && !b.shot && ((b.owner && b.owner.team === t && !b.owner.gk) || (!b.owner && b.pass && b.pass.team === t && b.pass.to !== e))) { tx = e.ggx; ty = e.ggy; e.mode = "go"; }
      // sem amontoar: quem está só se posicionando não para em cima de um companheiro; abre para o lado
      if (b.owner && b.owner !== e && !["press", "double", "chase", "runTo", "carry", "go", "diag", "fixoDuel", "last", "alaFixo"].includes(e.mode) && !(b.pass && b.pass.to === e)) {
        for (const m of this.field(t)) {
          if (m === e || m === b.owner) continue;
          const mx = m.goalTx ?? m.x, my = m.goalTy ?? m.y;
          const SP = C.REMATCH ? C.REMATCH.space : 46; // v465 (Mickey, Rematch): time mais espaçado
          if (hyp(tx - mx, ty - my) < SP || hyp(tx - m.x, ty - m.y) < SP) ty = U.clamp(ty + ((e.y >= m.y ? 1 : -1) * (C.REMATCH ? C.REMATCH.push : 56)), 50, H - 50);
        }
      }
      { const TR = C.TRI, o = b.owner; // v608 (Mickey): triangulação do bola no pé: quem tocou corre em diagonal e o terceiro abre o triângulo
        if (TR && o && o.team === t && o !== e && !o.gk && o.triOn && !this.combo[t] && !(b.pass && b.pass.to === e) && !["press", "close", "chase", "runTo", "slide"].includes(e.mode) && Math.abs(o.x - this.ownGoalX(t)) > W * TR.from && this.time - (o.recvT ?? -9) < TR.t) {
          const pf = o.lastFrom, sd = (v) => (v >= H / 2 ? 1 : -1);
          if (e === pf) { tx = U.clamp(o.x + d * TR.go, 40, W - 40); ty = U.clamp(o.y + sd(e.y) * TR.w, 40, H - 40); e.mode = "tri"; sp *= TR.sprint; }
          else { const th = this.field(t).filter((m) => m !== o && m !== pf).sort((a1, a2) => hyp(a1.x - o.x, a1.y - o.y) - hyp(a2.x - o.x, a2.y - o.y))[0];
            if (th === e) { const sy = pf ? -sd(pf.y - o.y + (pf.y === o.y ? 1 : 0)) : (o.y < H / 2 ? 1 : -1); tx = U.clamp(o.x + d * TR.ahead, 40, W - 40); ty = U.clamp(o.y + sy * TR.side, 40, H - 40); e.mode = "tri"; sp *= TR.sprint; } } } }
      { const S3 = this.tri3Live(t); // v636 (Mickey): triangulação Ala Def / Ala Of / Pivô: quem está sem a bola corre para a sua ponta do triângulo
        if (S3 && S3.mem.includes(e) && b.owner !== e && !(b.pass && b.pass.to === e) && e.mode !== "slide") { const v = this.tri3V(t, S3.mem.indexOf(e)); tx = v.x; ty = v.y; e.mode = "tri3"; sp *= C.TRI3.sprint; } }
      { const BC = C.BOX_COVER, og = this.ownGoalX(t); // v608 (Mickey): a marcação não deixa a área livre
        if (BC && !this.training && !this.x1() && this.state === "play" && !(b.owner && b.owner.team === t) && Math.abs(b.x - og) < W * BC.from && b.owner !== e && !["press", "close", "chase", "slide"].includes(e.mode)) {
          const sx = og + d * BC.x, sy = H / 2 + (b.y - H / 2) * BC.yk, fl = this.field(t);
          if (!fl.some((m) => hyp(m.x - og, m.y - H / 2) < BC.r)) { const g = fl.filter((m) => !["press", "close", "chase", "slide"].includes(m.mode)).sort((a1, a2) => hyp(a1.x - sx, a1.y - sy) - hyp(a2.x - sx, a2.y - sy))[0];
            if (g === e) { tx = sx; ty = sy; e.mode = "boxCover"; sp *= BC.sprint; } } } }
      const jit = (this.cfx[t] || {}).jitter; // v417: Nishida/Haruki, quem está sem a bola se mexe de forma imprevisível
      if (jit && b.owner !== e && !(b.pass && b.pass.to === e) && e.mode !== "press") {
        e.jT = (e.jT || 0) - dt;
        if (e.jT <= 0) { e.jT = U.rand(0.8, 1.6); const a = U.rand(0, Math.PI * 2), r = U.rand(0, jit); e.jx = Math.cos(a) * r; e.jy = Math.sin(a) * r; }
        tx = U.clamp(tx + e.jx, 30, W - 30); ty = U.clamp(ty + e.jy, 30, H - 30);
      }
      // v464 (Mickey vídeo): sem a bola ninguém fica estátua: balança um pouco em volta do alvo enquanto espera a jogada
      const SW = C.SWAY;
      if (SW && !this.training && b.owner !== e && !(b.pass && b.pass.to === e) && !["press", "close", "chase", "runTo", "slide", "diag"].includes(e.mode) && this.state === "play") { const mk = ["fixoDuel", "last", "alaFixo"].includes(e.mode) ? SW.mark : 1; // v606 (Mickey): marcando também balança um pouco (ninguém parado)
        e.swT = (e.swT || 0) - dt;
        if (e.swT <= 0) { e.swT = U.rand(SW.t[0], SW.t[1]); const a = U.rand(0, Math.PI * 2), r = U.rand(SW.r * 0.4, SW.r); e.swx = Math.cos(a) * r; e.swy = Math.sin(a) * r; }
        tx = U.clamp(tx + (e.swx || 0) * mk, 30, W - 30); ty = U.clamp(ty + (e.swy || 0) * mk, 30, H - 30);
        if (SW.near && hyp(tx - e.x, ty - e.y) < SW.near) e.swT = Math.min(e.swT, 0.12); // v606 (Mickey): chegou no ponto do balanço, já escolhe outro (não fica parado)
      }
      { const K = this.combo && this.combo[t]; if (K && b.owner !== e && !(b.pass && b.pass.to === e)) { const q = this.comboSpotFor(e, K); if (q) { tx = q.x; ty = q.y; e.mode = "combo"; sp *= C.COMBO.sprint; if (SW && hyp(tx - e.x, ty - e.y) < SW.r * 3) { tx = U.clamp(tx + (e.swx || 0) * SW.combo, 30, W - 30); ty = U.clamp(ty + (e.swy || 0) * SW.combo, 30, H - 30); if (SW.near && hyp(tx - e.x, ty - e.y) < SW.near * 2) e.swT = Math.min(e.swT, 0.12); /* v618: chegou, já escolhe outro ponto */ } } } } // v606: já no lugar do combo, balança esperando a bola // v600: cada um já vai para onde o combo precisa dele
      const X1 = this.x1();
      if (X1 && !e.gk) { // v561 · X1: fôlego e água na ala
        const run = hyp(e.vx || 0, e.vy || 0) > X1.fol.runR * this.runSpeed(e); // v562 (Mickey): só gasta correndo ou fazendo ação; andando recupera devagar, mesmo com a bola
        e.fol = U.clamp((e.fol ?? 100) + (run ? -X1.fol.run : X1.fol.rec) * dt, 0, 100);
      }
      { const WG = (this.sdyn() || {}).wing; if (WG && WG.mates && b.owner && b.owner.team === t && b.owner !== e && !b.owner.gk && !(b.pass && b.pass.to === e) && e.mode !== "runTo" && e.mode !== "combo") { const sd = b.owner.wingRun ? b.owner.wingSd || 1 : (e.slot % 2 ? -1 : 1); if (Math.random() < 1) ty = U.clamp(ty + (H / 2 + sd * (H / 2 - WG.edge - 20) - ty) * WG.mates, 30, H - 30); } } // v704b (Mickey): com a bola, os companheiros abrem para a ala
      if (e.recov) { const RC = (this.sdyn() || {}).recov; if (!RC || this.time > e.recov || b.owner === e || (b.owner && b.owner.team === t) || (b.pass && b.pass.to === e)) e.recov = 0; else { // v704 (Mickey): levou o tackle, levanta e corre para ficar entre a bola e o próprio gol; só depois volta a dar bote
          const og = this.ownGoalX(t), ux = og - b.x, uy = H / 2 - b.y, L = hyp(ux, uy) || 1, g = Math.min(RC.gap, L * 0.5), qx = b.x + (ux / L) * g, qy = b.y + (uy / L) * g;
          if (hyp(qx - e.x, qy - e.y) < RC.near) e.recov = 0; else { tx = U.clamp(qx, 30, W - 30); ty = U.clamp(qy, 30, H - 30); e.mode = "recov"; } } }
      e.goalTx = tx; e.goalTy = ty;
      const dx = tx - e.x, dy = ty - e.y, dist = hyp(dx, dy);
      if (dist > 2) {
        sp = Math.min(sp, C.RUN_MAX * (C.RUN_HARD_K || 1.4)); // v575: teto absoluto de velocidade (nenhum bônus passa disso)
        const v = Math.min(sp, dist * (SW && b.owner !== e ? SW.arrive : 6)); // v464: chega freando em vez de parar seco
        const k = SW && b.owner !== e ? 1 - Math.exp(-dt * SW.acc) : 1; // v464: aceleração suave (sem tranco ao mudar de alvo)
        e.vx += ((dx / dist) * v - (e.vx || 0)) * k; e.vy += ((dy / dist) * v - (e.vy || 0)) * k;
        if (v > 40) this.drain(e, (C.ENERGY_DRAIN_WALK + (v > 180 ? C.ENERGY_DRAIN_RUN : 0)) * dt); // v225: andar também cansa
      } else { e.vx = e.vy = 0; }
      e.x += e.vx * dt; e.y += e.vy * dt;
      this.clampEnt(e);
      if (b.owner === e) { // bola colada no pé, na direção do movimento
        const a = Math.atan2(e.vy || 0, e.vx || d);
        b.x = e.x + Math.cos(a) * (e.r + BALL_R - 2); b.y = e.y + Math.sin(a) * (e.r + BALL_R - 2);
        b.x = U.clamp(b.x, BALL_R, W - BALL_R); b.y = U.clamp(b.y, BALL_R, H - BALL_R);
      }
    }

    decide(e) {
      const t = e.team, d = this.dir(t), gx = this.goalX(t), gy = H / 2;
      const distGoal = hyp(gx - e.x, gy - e.y);
      const opps = this.field(1 - t);
      const o = opps.reduce((best, x) => (!best || hyp(x.x - e.x, x.y - e.y) < hyp(best.x - e.x, best.y - e.y) ? x : best), null);
      const distO = o ? hyp(o.x - e.x, o.y - e.y) : 999;
      const blocked = o && (o.x - e.x) * d > -12 && distO < 130;
      if (this.skDecide(e, distGoal, o, distO)) return; // v623: habilidades
      if (this.comboStep(e)) return; // v600: combo das plays setadas
      { const Q = this.ps(t), RS = C.GK_POSS && C.GK_POSS.reset, own = Math.abs(e.x - this.ownGoalX(t)); // v604 (Mickey): recuo para o goleiro: longe do gol, volta conduzindo antes de tocar (a bola não chegava)
        if (Q && !e.gk && !this.combo[t] && !(C.GK_POSS && this.gkLock[t]) && !(this.restart && this.restart.team === t && this.time < this.restart.until)) {
          let go = this.time - (e.resetRun ?? -9) < (RS ? RS.t : 4);
          if (!go && Q.reset && this.time - (e.recoverT ?? -9) < 0.6 && e.resetT !== e.recoverT && own < W * (RS ? RS.from : 0.5)) { e.resetT = e.recoverT; go = Math.random() < Q.reset; } // v600: roubou no próprio campo
          if (!go && Q.gkSpend && e.fixo && own < W * 0.55 && Math.random() < Q.gkSpend) go = true; // v603: o Fixo com a bola gasta a posse do goleiro
          if (go) { const g = this.gks[t];
            if (RS && own > RS.passR) { if (!(this.time - (e.resetRun ?? -9) < RS.t)) e.resetRun = this.time;
              if ((e.alaOf || e.pivo) && RS.back) { /* v606 (Mickey): Ala Of e Pivô não voltam conduzindo até o goleiro: tocam para o Ala Def ou o Fixo, que continua o recuo */
                const bm = this.field(t).filter((m) => m !== e && (m.fixo || m.alaDef) && (e.x - m.x) * d > RS.back.behind && !this.laneBlocked(e, m) && this.openness(m) > RS.back.open).sort((p1, p2) => this.openness(p2) - this.openness(p1))[0];
                if (bm) { e.resetRun = -9; bm.resetRun = this.time; this.kickTo(e, bm.x - d * 20, bm.y, 560, 6, { kind: "pass", to: bm }); return; } }
              e.mode = "carry"; e.tx = this.ownGoalX(t) + d * (RS.passR - 40); e.ty = e.y + (H / 2 - e.y) * 0.3; return; } else { /* v605: longe do gol conduz para trás (mesmo pressionado: protege a bola de costas) e só toca perto do goleiro */
            e.resetRun = -9; this.kickTo(e, g.x + d * 10, g.y, RS ? Math.max(520, 300 + own * 0.9) : 520, 5, { kind: "pass", to: g }); this.onEvent("log", { team: t, text: `${e.p.short} recua para o goleiro armar a jogada` }); this.fx.push({ kind: "text", x: e.x, y: e.y - 30, text: "RESET!", t: 0.9, color: "#5fd8ff" }); /* v608 (Mickey): RESET na tela */ return; } } } }
      { const BX = C.BOX_PLAY; if (BX && this.rplays && this.rplays[t] && !e.gk) { const dB = hyp(gx - e.x, H / 2 - e.y); if (this.boxOwn !== t || dB > BX.reset) { this.boxOwn = t; this.boxN = 0; } // v597 (Mickey, clipe): sem ficar trocando passe/blade na cara do gol
        if (dB < BX.r && this.boxN >= BX.maxPass && !e.fog && !e.hax && !e.blade && !e.bRecv) { if (Math.random() < BX.back && this.selfBack(e, true)) return; return this.shoot(e, distGoal, distO); } } }
      if (this.tri3Step(e, distGoal, distO)) return; // v636 (Mickey): triangulação da Bola no pé
      { const P = this.pplays && this.pplays[t]; if (P && P.st && ((P.m === e && (P.st === "cruz" || P.st === "cort" || P.st === "ce1" || (P.nw && P.st === "parede"))) || (P.nw && P.st === "fin" && P.p === e)) && this.pivoStep(e)) return; } // v635: jogada ensaiada nova em andamento vem antes do repertório
      if (this.repRecv(e)) return; // v495: dominou fogueteiro ou lançamento haxball: chuta na hora (antes das outras jogadas)
      if (e.alaOf && this.repStep(e, true)) return; // v498: Ala Of na ala puxa o blade antes das jogadas ensaiadas
      if (this.playStep(e)) return; // v466: jogada ensaiada
      if (this.pivoStep(e)) return; // v470: lances do Pivô (primeiro pau, parede, nas costas)
      if (this.repStep(e)) return; // v474: repertório (levantada, lançamento nas costas)
      const chainGo = e.chainGo; e.chainGo = false; // v474: tabela em cadeia (decidido ao receber)
      const x1Shot = !this.x1() || this.x1ShotOk(e, distGoal); // v563 (Mickey): no X1 só chuta com 3 stacks e perto do gol
      if (distGoal < C.SHOT_CLOSE && x1Shot) return this.shoot(e, distGoal, distO); // v213: na cara do gol não conduz mais: chuta
      { const X1g = this.x1(); if (X1g && X1g.shotGo && x1Shot && Math.random() < X1g.shotGo) return this.shoot(e, distGoal, distO); } // v564: no X1, com 3 stacks e perto do gol, quase sempre já chuta
      { const WG = (this.sdyn() || {}).wing; if (WG && !this.training && (e.heldT || 0) < 0.3 && e.wingAt !== e.recoverT + "|" + e.recvT) { e.wingAt = e.recoverT + "|" + e.recvT; e.wingRun = Math.random() < WG.p; e.wingSd = Math.abs(e.y - H / 2) > 30 ? Math.sign(e.y - H / 2) : Math.random() < 0.5 ? -1 : 1; } } // v704b: sorteia ala ou meio a cada posse
      const opts = [];
      const chute = this.iv(e, "chute"), passe = this.iv(e, "passe"), drible = this.iv(e, "drible");
      e.ginga = false;

      // caminho livre: nenhum jogador de linha deles entre o portador e o gol (num corredor de ~110 px).
      // Aí não tem por que tocar para trás ou para o lado: conduz reto e finaliza
      const ux = (gx - e.x) / distGoal, uy = (gy - e.y) / distGoal;
      const clear = !this.training && !opps.some((x) => { const along = (x.x - e.x) * ux + (x.y - e.y) * uy; return along > -15 && along < distGoal && Math.abs((x.x - e.x) * uy - (x.y - e.y) * ux) < 110; });
      const st = this.styles[t];
      const SD = this.sdyn(), range = (this.noAtk[t] || this.training ? 420 : st ? st.range : 330) + C.IVX.shotRange * Math.min(1, this.q(e, "chute")) + (SD ? SD.range : 0); /* v703: 2×2/3×3 chuta de mais longe */ // v225: chute bom arrisca de mais longe. Oblivion arrisca de mais longe: é a chance que ela tem; no treino, chute de todas as distâncias
      if (distGoal < range) {
        let w = ((range - distGoal) / range) * (0.5 + chute / 31);
        if (distGoal < 180) w *= 2.2;
        if (blocked && distO < 55) w *= 0.4;
        if (clear) w *= distGoal < 250 ? 3 : 0.4; // livre: chega mais perto e chuta
        if (SD) w *= SD.shot; // v703
        if (st && st.shot) w *= st.shot; // estilo que finaliza mais (Toque de bola chega tocando e chuta)
        opts.push({ v: "shoot", w });
      }
      if (this.duelMode) {
        // v188 · 1×1: livre e de longe, às vezes arrisca o chutaço (mais ainda com o marcador chegando por trás);
        // logo depois de driblar, finaliza de primeira
        const chased = o && (o.x - e.x) * d < 10 && distO < 120;
        if (clear && distGoal >= 250 && distGoal < 430) opts.push({ v: "shoot", w: C.DUEL_LONG_SHOT * (0.5 + chute / 31) * (chased ? 2.5 : 1) });
        if (e.burst > 0 && distGoal < 380) opts.forEach((op) => { if (op.v === "shoot") op.w *= this.field(t).length === 1 ? C.DUEL_BURST_SHOT : C.DUEL_BURST_SHOT_TEAM; }); // em time, menos (equilíbrio das formações)
      }
      const X1 = this.x1(), fol = e.fol ?? 100;
      if (X1) { // v561 (Mickey) · X1: push ball, blade por cima do marcador e água na ala
        const front = o && (o.x - e.x) * d > 0 && (o.x - e.x) * d < X1.push.front && Math.abs(o.y - e.y) < 60;
        if (fol > X1.push.minFol && !(e.pushCd > 0) && distGoal > X1.push.minGoal && !front) opts.push({ v: "push", w: X1.push.w * (0.6 + this.iv(e, "velocidade") / 31) });
        if (o && fol > X1.blade.minFol && !(e.bladeCd > 0) && (o.x - e.x) * d > 15 && distO < X1.blade.near && distGoal > 220) opts.push({ v: "blade", w: X1.blade.w * (0.5 + drible / 31) });
        const TR = X1.trick; // v564 (Mickey): caneta e drible da vaca (a bola sai do pé e ele pega do outro lado)
        if (TR && o && fol > TR.minFol && !(e.trickCd > 0) && (o.x - e.x) * d > 10 && distO < TR.near) { opts.push({ v: "caneta", w: TR.caneta * (0.5 + drible / 31) }); if (Math.abs(o.y - H / 2) < H / 2 - 90) opts.push({ v: "vaca", w: TR.vaca * (0.5 + this.iv(e, "velocidade") / 31) }); }
        if (TR && o && fol > TR.minFol && !(e.trickCd > 0) && (o.x - e.x) * d > -25 && distO < TR.near) opts.push({ v: "puxada", w: TR.puxada * (0.5 + drible / 31) }); // v565 (Mickey): puxa a bola para trás, finge um lado e sai pelo outro
        const CB = X1.combo, inCombo = CB && this.time - (e.comboT ?? -99) < CB.win;
        const HX1 = X1.hax; if (fol > CB.minFol && !(e.wallCd > 0) && (inCombo || this.time - (e.haxAgain ?? -9) < 0.6 || (HX1 && o && (o.x - e.x) * d > 0 && distO < HX1.near))) opts.push({ v: "hax", w: (this.time - (e.haxAgain ?? -9) < 0.6 ? HX1.again : inCombo ? CB.hax : HX1.w) * (Math.abs(gx - e.x) < HX1.backX && Math.abs(e.y - H / 2) > GH / 2 ? HX1.backW : 1) }); // v570: emenda haxball · v567: haxball também fora do combo, com o marcador na frente // v565: combo com haxball na parede
        const mood = e.mood || (e.mood = Object.fromEntries(["caneta", "vaca", "puxada", "blade", "push", "hax"].map((k) => [k, U.rand(X1.mood[0], X1.mood[1])]))); // v565 (Mickey): cada partida cada jogador tem os truques preferidos dele (X1 mais aleatório)
        opts.forEach((op) => { if (typeof op.v === "string" && mood[op.v]) op.w *= mood[op.v] * (inCombo && op.v !== "push" ? CB.k : 1) * (e.cooking && X1.cook ? X1.cook.trickK : 1); }); // v568: cozinhando quase não arrisca truque
      }
      const deep = !this.isAtk(e) && (e.x - W / 2) * d > 40; // defensor que já passou do meio
      const pressed = this.noAtk[t] && distO < 110; // Oblivion pressionada: solta a bola em vez de conduzir
      const attackHalf = this.noAtk[t] && (e.x - W / 2) * d > 0; // Oblivion já no campo deles: busca o gol, não recua
      opts.push({ v: "carry", w: (0.9 + drible / 25) * (deep ? 0.25 : 1) * (pressed ? 0.45 : 1) * (clear ? 4 : 1) * (st ? st.drib : 1) * (SD ? SD.drib : 1) * (SD && SD.wing && e.wingRun && distGoal > SD.wing.cut && Math.abs(e.y - H / 2) < H / 2 - SD.wing.edge - 40 ? SD.wing.go : 1) }); // v704b: indo para a ala, conduz até lá
      const wingGoing = SD && SD.wing && e.wingRun && distGoal > SD.wing.cut && Math.abs(e.y - H / 2) < H / 2 - SD.wing.edge - 40 && distO > 60; // v704b: a caminho da ala só toca se apertado
      // tabela na parede: jogada de efeito, não a primeira reação. Só depois de conduzir um pouco,
      // perto da lateral, com intervalo entre uma e outra, e bem mais provável quando está marcado
      const nearWall = Math.min(e.y, H - e.y) < 170;
      if ((e.heldT || 0) > (this.training ? 0.3 : (this.sdyn() || {}).wallHeld || 0.6) && !(e.wallCd > 0) && !clear) {
        const HBk = !this.training && C.HAXBALL, endZ = HBk && Math.abs(gx - e.x) < HBk.back.x && Math.abs(e.y - H / 2) > GH / 2 + HBk.back.y; // v492 (Mickey): haxball perto da parede, backboard mais vezes
        const w = (blocked ? 0.5 + passe / 35 : this.training ? 0.45 : 0.1) * (HBk ? (endZ ? HBk.back.w : this.interp(HBk.wallK, Math.min(e.y, H - e.y))) : nearWall ? 1 : 0.5); // treino: treina a tabela também
        opts.push({ v: "wall", w: w * ((this.sdyn() || {}).wall || 1) }); // v704: 2×2/3×3 bem mais haxball
      }
      const pz = this.training ? 0.8 / Math.max(1, this.field(t).length - 1) : (this.noAtk[t] ? (pressed ? 2.4 : 1.5) : st ? st.pass : 1) * ((this.sdyn() || {}).pass || 1); /* v704 */ // treino: treinar troca de passes // time sem atacantes (Oblivion): sai jogando no toque
      const vis = this.ifx(e).freePass ? this.field(t).filter((m) => m !== e && m.stun <= 0).reduce((a, m) => (!a || this.openness(m) > this.openness(a) ? m : a), null) : null; // v524: Camisa Visão de Jogo
      this.field(t).forEach((m) => { if (m !== e && m.stun <= 0) opts.push({ v: { pass: m }, w: (m === vis ? 1 + this.ifx(e).freePass : 1) * pz * (0.7 + passe / 25) * ((m.x - e.x) * d > 0 ? 1.5 : attackHalf ? 0.2 : 0.6) * (this.openness(m) > 70 ? 1.2 : 0.5) * (!this.isAtk(e) && this.isAtk(m) ? 1.6 : 1) * (this.laneBlocked(e, m) ? 0.2 : 1) }); });
      if (clear) opts.forEach((op) => { if (op.v.pass) op.w *= (op.v.pass.x - e.x) * d > 80 ? 0.15 : 0.02; });
      if (wingGoing) opts.forEach((op) => { if (op.v && op.v.pass) op.w *= SD.wing.passK; }); // livre: só toca se for para alguém bem à frente
      if (!this.training && blocked && !clear && distGoal > 420 && distO < 90 && !this.gkLock[t]) opts.push({ v: "back", w: 0.45 + passe / 40 }); // v603: goleiro que já soltou a bola não recebe de novo
      // Oblivion: lançamento longo para quem está esperando lá na frente (o jeito de um time todo defensivo chegar ao gol)
      // Muralha: do próprio campo, lançamento longo para quem está lá na frente (contra-ataque)
      if (this.noAtk[t] || (st && st.long && Math.abs(e.x - this.ownGoalX(t)) < W * 0.5)) this.field(t).forEach((m) => { if (m !== e && m.stun <= 0 && (m.x - e.x) * d > 220 && this.openness(m) > 60) opts.push({ v: { pass: m, long: true }, w: (0.55 + passe / 30) * (st && st.long && distO < 130 ? 2.2 : 1) }); });

      // atacante solitário da 1-3-1: é o finalizador. Logo depois de roubar ou interceptar (até 3 s) ele conduz,
      // dribla e finaliza sozinho; só toca se estiver travado (marcador colado na frente).
      // Recebendo passe contra defesa armada, ainda prefere conduzir, mas aceita tocar
      if (this.soloAtk(e)) {
        const stuck = blocked && distO < 60;
        const fresh = this.time - (e.recoverT ?? -99) < 3; // acabou de roubar ou interceptar
        // v132: no campo deles contra até 2 defensores entre ele e o gol, também parte pro gol (drible, tabela, chute de longe)
        const goalSide = opps.filter((x) => (x.x - e.x) * d > -12).length;
        const solo = fresh || ((e.x - W / 2) * d > 0 && goalSide <= 2);
        if (solo && !stuck && distGoal >= range && distGoal < 440) opts.push({ v: "shoot", w: C.SOLO_SHOT * (0.5 + chute / 31) });
        opts.forEach((op) => {
          if (op.v === "carry") op.w *= stuck ? 1 : solo ? 2.5 : 1.15;
          else if (op.v === "shoot") op.w *= solo ? 1.5 : 1;
          else if (op.v === "back") op.w *= stuck ? 0.5 : solo ? 0.05 : 0.6;
          else if (op.v === "wall") op.w *= stuck ? 0.5 : solo ? 1.3 : 0.6; // tabela na parede (haxball) vale como jogada individual
          else if (op.v.pass) op.w *= stuck && (op.v.pass.x - e.x) * d > 0 ? 0.7 : solo ? 0.06 : 0.6;
        });
      }
      // Blitz (1-1-3): infiltração. Atacante com a bola do meio para frente passa no ponto futuro, em diagonal,
      // para o companheiro correr nas costas do defensor; e evita o toque de lado/para trás que não progride
      if ((this.styleKey[t] === "blitz" || this.plan[t] === "attack") && !this.training && e.role !== "def" && (e.x - this.ownGoalX(t)) * d > W * 0.35 && distGoal > 200) {
        for (const m of this.field(t)) {
          if (m === e || m.role === "def" || m.stun > 0 || (m.x - e.x) * d < -40) continue;
          const sx = U.clamp(m.x + d * 115, 60, W - 60), sy = U.clamp(m.y + (e.y - m.y) * 0.4, 50, H - 50);
          if ((sx - e.x) * d < 60 || (gx - sx) * d < 120) continue;
          const rd = hyp(m.x - sx, m.y - sy); // ele tem que chegar no ponto bem antes de qualquer um deles
          if ([...opps, this.gks[1 - t]].some((x) => hyp(x.x - sx, x.y - sy) < rd + 30) || this.laneBlocked(e, { x: sx, y: sy })) continue;
          const behind = opps.some((x) => (x.x - m.x) * d > -20 && (sx - x.x) * d > 0); // pega as costas de alguém
          opts.push({ v: { pass: m, thru: { x: sx, y: sy } }, w: (0.5 + passe / 30) * (behind ? 1.6 : 0.8) });
        }
        opts.forEach((op) => { if (op.v.pass && !op.v.thru && (op.v.pass.x - e.x) * d < 30) op.w *= 0.6; });
      }
      // passe para trás: com companheiro livre ao lado ou à frente (linha limpa, sem marcador perto), quase não sai;
      // só se estiver pressionado. E nunca para quem está marcado ou com a linha fechada
      if (!this.training) {
        const isBack = (m) => m.gk || (m.x - e.x) * d < -40;
        const free = this.field(t).some((m) => m !== e && m.stun <= 0 && !isBack(m) && this.openness(m) > 90 && !this.laneBlocked(e, m));
        const pressed2 = blocked && distO < 55;
        opts.forEach((op) => {
          const m = op.v === "back" ? this.gks[t] : op.v.pass && !op.v.long && !op.v.thru ? op.v.pass : null;
          if (!m || !isBack(m)) return;
          if (op.v !== "back" && (this.laneBlocked(e, m) || this.openness(m) < 70)) op.w *= 0.05;
          if (free) op.w *= pressed2 ? 0.5 : 0.12;
        });
      }
      // v131 · visão de jogo: atacando no campo deles com companheiro ao lado/à frente e atacantes deles no nosso campo,
      // o passe para trás é arriscado. Quanto melhor passe/drible/físico/velocidade, mais ele evita esse passe e
      // prefere tocar com quem está do lado ou partir no drible. IV baixo continua errando às vezes
      if (!this.training && (e.x - W / 2) * d > 0) {
        const mates = this.field(t).filter((m) => m !== e && m.stun <= 0 && (m.x - e.x) * d > -40);
        const lurk = opps.filter((x) => (x.x - W / 2) * d < 0);
        if (mates.length && lurk.length >= 2) {
          const vis = U.clamp(((passe + drible + this.iv(e, "fisico") + this.iv(e, "velocidade")) / 4 - 8) / 20, 0, 1);
          const isBack = (m) => m.gk || (m.x - e.x) * d < -40;
          const risky = (m) => lurk.some((x) => hyp(x.x - m.x, x.y - m.y) < 170) || this.laneBlocked(e, m);
          opts.forEach((op) => {
            const m = op.v === "back" ? this.gks[t] : op.v.pass && !op.v.long ? op.v.pass : null;
            if (m && isBack(m)) op.w *= risky(m) ? 1 - 0.95 * vis : 1 - 0.6 * vis;
            else if (m && mates.includes(m) && !this.laneBlocked(e, m)) op.w *= 1 + 0.8 * vis; // toca com quem está do lado
            else if (op.v === "carry" || op.v === "wall") op.w *= 1 + 0.6 * vis; // ou parte pra cima
          });
        }
      }
      // v197 · ideia de jogo do time (ver planFor)
      const plan = this.training ? null : this.plan[t];
      if (plan) {
        const pressedP = blocked && distO < 70, isBk = (m) => m.gk || (m.x - e.x) * d < -40;
        const freeLane = (m) => this.openness(m) > 70 && !this.laneBlocked(e, m);
        const recent = (m) => m === e.lastFrom && this.time - (e.lastFromT ?? -9) < 1.8;
        let fwdOpen = false;
        opts.forEach((op) => {
          const m = op.v === "back" ? this.gks[t] : op.v.pass && !op.v.long && !op.v.thru ? op.v.pass : null;
          if (plan === "build") {
            // constrói: recua só se estiver pressionado; toca curto para quem está livre ao lado ou à frente; sem pingue-pongue
            if (m && isBk(m)) op.w *= (pressedP ? C.BUILD_BACK_PRESSED : C.BUILD_BACK) * (m.gk && distO > 45 ? 0.5 : 1); // goleiro só no aperto de verdade
            else if (m && freeLane(m)) op.w *= C.BUILD_PASS;
            if (m && recent(m) && (m.x - e.x) * d < 40) op.w *= 0.3;
            else if (m && recent(m) && freeLane(m)) op.w *= 1.5; // quem tocou subiu: devolve na frente (triangulação)
            if (op.v === "carry" && distO > 150) op.w *= C.BUILD_CARRY; // ninguém perto: sobe conduzindo e o bloco vem junto
          } else {
            if (!m || isBk(m)) return;
            const open = freeLane(m);
            if (recent(m) && (m.x - e.x) * d > 30 && open) { op.w *= C.ATTACK_ONE_TWO; op.v.ot = true; } // devolve a tabela de primeira
            else if (open && Math.abs(m.y - e.y) > 200) op.w *= 1.4; // inversão para o lado livre
            else if (open && (m.x - e.x) * d > 40) op.w *= 1.3;
            if (open && (m.x - e.x) * d > 40) fwdOpen = true;
          }
        });
        if (plan === "attack" && fwdOpen) opts.forEach((op) => { if (op.v === "carry") op.w *= C.ATTACK_CARRY; }); // com passe agressivo livre, conduz menos
      }
      const duo = this.duoMate(e);
      if (duo) {
        const stuck = blocked && distO < 55 && this.laneBlocked(e, duo);
        opts.forEach((op) => {
          if (op.v === "back") op.w *= stuck ? 0.4 : 0.1;
          else if (op.v.pass === duo) op.w *= 1.6;
          else if (op.v.pass && op.v.pass.role === "def") op.w *= stuck ? 0.5 : 0.15;
        });
      }
      opts.forEach((op) => { if (op.v === "shoot") op.w *= this.interp(C.SHOT_TRY, this.shotEff(e)); }); // v449: pela distância da zona ideal // v443 (Mickey): quanto mais perto do gol (área, pequena área), mais tenta chutar; de longe quase nunca · v442
      if (e.alaOf || e.pivo) opts.forEach((op) => { if (e.alaOf && op.v.pass && op.v.pass.pivo) op.w *= C.POS_AI.assist * (this.crossSpot(e) ? C.POS_AI.cross * (this.laneBlocked(e, op.v.pass) ? 2 : 1) : 1); if (e.pivo && op.v === "shoot") op.w *= C.POS_AI.pivoShot; if (e.pivo && op.v.pass && op.v.pass.alaOf && !op.v.long) op.w *= C.POS_AI.pivoToOf; /* v454 (Mickey): das 5 opções do Pivô (drible, chute, passe ao Ala Of, ao Ala Def, ao Fixo), a mais comum é tocar no Ala Of, que leva à ala e cruza de volta */ if (this.wingRun(e)) { if (op.v === "carry") op.w *= C.POS_AI.wingCarry * (this.bladeSeek(e) ? C.REPERT.blade.seek.carry : 1); else if (op.v === "shoot" || (op.v.pass && !op.v.pass.pivo)) op.w *= C.POS_AI.wingOther; } }); // v453: na ala, vai ao fundo antes de soltar // v441: Ala Of serve o Pivô; Pivô finaliza
      // v493 (Mickey): o jogo passa pelas alas: quem não é ala toca menos direto no Pivô e mais no Ala Of; o Ala Of é quem mais dá assistência; o Ala Def também acha o Pivô
      const WP = C.WING_PLAY;
      if (WP && !this.training && this.myShapes) opts.forEach((op) => { const m = op.v && op.v.pass; if (!m || m.gk || op.v.long) return;
        if (m.pivo && !e.alaOf && !e.alaDef) op.w *= WP.toPivo; else if (m.pivo && e.alaDef) op.w *= WP.adToPivo; else if (m.pivo && e.alaOf) op.w *= WP.ofToPivo;
        if (m.alaOf && !e.alaOf) op.w *= WP.toOf; if (m.alaDef && e.fixo) op.w *= WP.fixoToAd; });
      // v463 (Mickey): sem medo de conduzir: sem marcador colado, segura a bola alguns segundos procurando o passe ou a tabela
      // (o Ala Of segura mais e recebe mais); dentro da zona de chute o chute não muda
      // v465 (Mickey, Rematch): recebeu na zona de chute = finaliza de primeira
      const RM = C.REMATCH;
      if (RM && !this.training && this.time - (e.recvT ?? -9) < RM.oneT && this.shotEff(e) <= RM.oneEff) opts.forEach((op) => { if (op.v === "shoot") op.w *= RM.oneTouch; });
      const DS = C.PLAYS && C.PLAYS.pivo && C.PLAYS.pivo.dribShot; // v471 (Mickey, vídeos): passou o marcador perto da área, finaliza na hora
      if (DS && !this.training && this.time - (e.dribT ?? -9) < DS.t && this.shotEff(e) <= DS.eff) opts.forEach((op) => { if (op.v === "shoot") op.w *= DS.w; });
      // v472 (Mickey, partida inteira do Rematch): roubou a bola = passe vertical na hora para quem está lá na frente;
      // alas também finalizam (do lado da área); Ala Def com o corredor livre sobe conduzindo
      const FL = C.FEEL;
      if (FL && !this.training && !e.gk) {
        if (this.time - (e.recoverT ?? -9) < FL.counterT) opts.forEach((op) => { if (op.v && op.v.pass && !op.v.pass.gk && (op.v.pass.x - e.x) * d > FL.counterAhead) op.w *= FL.counter; });
        if ((e.alaOf || e.alaDef) && this.shotEff(e) <= FL.wingEff) opts.forEach((op) => { if (op.v === "shoot") op.w *= FL.wingShot; });
        if (e.alaDef && (e.x - this.ownGoalX(t)) * d > W * 0.5 && distO > FL.adFree) opts.forEach((op) => { if (op.v === "carry") op.w *= FL.adCarry; });
      }
      const K = C.CARRY_FREE;
      if (K && !this.training) {
        const hold = (e.alaOf ? K.ofMin : K.min) * (0.7 + 0.6 * ((e.seed ?? 1) % 1)) * ((this.sdyn() || {}).holdK || 1); // v704b: 2×2/3×3 segura menos e toca mais
        if (!chainGo && (e.heldT || 0) < hold && distO > K.press && !(RM && this.time - (e.recvT ?? -9) < RM.oneT && this.shotEff(e) <= RM.oneEff)) opts.forEach((op) => { if (op.v === "carry") op.w *= K.carry; else if (op.v === "wall") op.w *= K.wall; else if (op.v === "back" || (op.v && op.v.pass)) op.w *= K.pass; });
        opts.forEach((op) => { if (op.v && op.v.pass && op.v.pass.alaOf && !e.alaOf) op.w *= K.toOf; });
      }
      // v474 (Mickey, clipes do Rematch: "jogada usando todos"): recebeu no ataque e toca de primeira para quem está livre ao lado ou à frente
      const CH = C.REPERT && C.REPERT.chain;
      if (chainGo && CH) opts.forEach((op) => { if (op.v && op.v.pass && !op.v.pass.gk && !op.v.pass.fixo && (op.v.pass.x - e.x) * d > -30 && this.openness(op.v.pass) > CH.free && !this.laneBlocked(e, op.v.pass)) { op.w *= CH.w; op.v.chain = true; } else if (op.v === "carry") op.w *= 0.5; });
      // v491 (Mickey): passe haxball: linha direta fechada, tabela na parede (lado, ou fundo perto da linha deles) livre
      const HB = C.HAXBALL;
      if (HB && !this.training) for (const m of this.field(t)) {
        if (m === e || m.gk || m.stun > 0) continue; const dm = hyp(m.x - e.x, m.y - e.y);
        const endZ = Math.abs(gx - e.x) < HB.back.x && Math.abs(gx - m.x) < HB.back.x; // v496 (Mickey): backboard = quase um chute na parede do fundo para o aliado pegar, só de perto
        const hq = this.ps(t), SDh = this.sdyn(), hFree = (hq && hq.haxShort && dm < hq.haxShort.L) || (SDh && dm < SDh.haxFree), hLong = SDh && SDh.haxLong && dm > SDh.haxLong[0] ? SDh.haxLong[1] : 1; // v704b: haxball longo mais vezes // v704: 2×2/3×3 faz haxball mesmo com a linha aberta // v603: bola no pé faz haxball curto mesmo com a linha aberta
        if (dm < HB.pass.min || dm > HB.pass.max || (!endZ && !hFree && !this.laneBlocked(e, m))) continue;
        const tx = U.clamp(m.x + (endZ ? 0 : d * 40), 40, W - 40), ty = U.clamp(m.y, 40, H - 40);
        const walls = endZ ? ["end"] : SDh ? ["top", "bot"] : [(e.y + ty) / 2 < H / 2 ? "top" : "bot"]; // v704b: 2×2/3×3 tenta as duas paredes
        for (const wl of walls) { const a = this.haxAim(e, tx, ty, wl); if (!a) continue;
          if (this.laneBlocked(e, { x: a.bx, y: a.by }) || this.laneBlocked({ x: a.bx, y: a.by, team: t }, { x: tx, y: ty })) continue;
          opts.push({ v: { pass: m, hax: { tx, ty, wall: wl } }, w: (SDh ? SDh.hax * hLong : 1) * HB.pass.w * (0.4 + passe / 31) * (wl === "end" ? HB.back.w * ((hq && hq.back) || 1) : this.interp(HB.wallK, wl === "top" ? e.y : H - e.y)) }); } // v492: perto da parede mais, no meio raro
      }
      // v500 (Mickey): o Pivô que acabou de driblar (mais lento) olha o Ala Of: bem posicionado (livre, sem linha fechada, não atrás) = toca; senão pesa se vale o próximo drible, que já é mais difícil
      const PD = C.PIVO_DRIB;
      if (PD && e.pivo && e.dribSlow && !this.training) { const of = this.field(t).find((x) => x.alaOf && x.stun <= 0);
        const good = !!of && (of.x - e.x) * d > -PD.behind && this.openness(of) > PD.open && !this.laneBlocked(e, of), ck = this.dribChainK(e);
        opts.forEach((op) => { if (op.v === "carry") op.w *= good ? PD.dribGood : PD.dribMin + (1 - PD.dribMin) * ck; else if (good && op.v && op.v.pass === of && !op.v.hax) op.w *= PD.pass; }); }
      // v491 (Mickey, clipe): Ala Of com o caminho livre tocou para trás; livre na frente = conduz mais e chuta, passe só se for bem para frente
      const FR = C.FREE_RUN, freeRun = FR && !this.training && (e.x - this.ownGoalX(t)) * d > W * FR.from && distGoal < FR.dist
        && !opps.some((x) => { const al = (x.x - e.x) * ux + (x.y - e.y) * uy; return (al > 0 && al < distGoal && Math.abs((x.x - e.x) * uy - (x.y - e.y) * ux) < FR.lane) || (al > 0 && hyp(x.x - e.x, x.y - e.y) < FR.near); });
      if (freeRun) opts.forEach((op) => { if (op.v === "back" || op.v === "wall" || (op.v && op.v.pass && (op.v.pass.x - e.x) * d < FR.ahead)) op.w *= FR.pass; else if (op.v === "carry") op.w *= FR.carry; });
      // v485 (Mickey: "recuo para trás onde não tem ninguém quebra o ritmo"): passes para trás (goleiro ou 40 px atrás) somam no máximo BACK_MAX das escolhas
      if (C.BACK_MAX != null && !this.training) { const bk = (op) => op.v === "back" || (op.v && op.v.pass && !op.v.long && !op.v.thru && (op.v.pass.gk || (op.v.pass.x - e.x) * d < -40));
        let sb = 0, so = 0; opts.forEach((op) => { if (bk(op)) sb += op.w; else so += op.w; });
        if (sb > 0 && so > 0 && sb / (sb + so) > C.BACK_MAX) { const k = (C.BACK_MAX * so) / ((1 - C.BACK_MAX) * sb); opts.forEach((op) => { if (bk(op)) op.w *= k; }); } }
      if (!x1Shot) { for (let k = opts.length - 1; k >= 0; k--) if (opts[k].v === "shoot") opts.splice(k, 1); // v563: sem chute até poder
        if (o && this.x1()) opts.forEach((op) => { if (op.v === "carry") op.w *= C.X1.style.faceK; }); }
      { const T4 = C.TRICK4; if (T4 && !X1 && this.rplays && this.rplays[t] && o && !e.gk && !((e.trick4Cd || 0) > this.time) && (o.x - e.x) * d > 5 && o.stun <= 0) { // v588 (Mickey): chapéu e drible da vaca no 4×4
        if (distO < T4.chapeu.near) opts.push({ v: "chapeu4", w: T4.chapeu.w * (0.4 + drible / 31) });
        if (distO < T4.vaca.near && Math.abs(o.y - H / 2) < H / 2 - 90) opts.push({ v: "vaca4", w: T4.vaca.w * (0.4 + this.iv(e, "velocidade") / 31) }); } }
      { const Q = this.ps(t); if (Q && (Q.drib || Q.wall || Q.trick || Q.shot)) opts.forEach((op) => { op.w *= op.v === "shoot" ? Q.shot || 1 : op.v === "carry" ? Q.drib || 1 : op.v === "wall" ? Q.wall || 1 : op.v === "chapeu4" || op.v === "vaca4" ? Q.trick || 1 : op.v === "back" ? Q.gkBack ?? 1 : op.v && op.v.hax ? Q.hax || 1 : op.v && op.v.pass && !op.v.long ? Q.pass || 1 : 1; if (Q.fixoPivo && e.fixo && op.v && op.v.pass && op.v.pass.pivo) op.w *= Q.fixoPivo; if (Q.streak && op.v === "shoot" && this.pStreak && this.pStreak[t] >= Q.streak.min) op.w *= Q.streak.shotW; /* v619 (Mickey): plays setadas quase não ligam direto do Fixo para o Pivô */ }); }
      { const Q = this.ps(t), HS = Q && Q.haxSelf, wy = Math.min(e.y, H - e.y); if (HS && !X1 && this.rplays && this.rplays[t] && !e.gk && o && wy < HS.wall && distO < HS.near && (o.x - e.x) * d > -20 && Math.abs(this.goalX(t) - e.x) > HS.goal) opts.push({ v: "haxSelf", w: HS.w }); } { const BQ = this.ps(t), BS = BQ && BQ.backSelf, SB = C.HAXBALL && C.HAXBALL.selfBack, dgB = Math.abs(this.goalX(t) - e.x); if (BS && SB && !X1 && this.rplays && this.rplays[t] && (e.pivo || e.alaOf) && dgB < SB.maxX && dgB > SB.spot[0] + 20) opts.push({ v: "backSelf", w: BS }); } /* v632 (Mickey): bola no pé faz mais backboard para ele mesmo */ /* v619 (Mickey): bola no pé joga pelas alas com haxball para ele mesmo */ /* v603: bola no pé troca mais passes, mais haxball, quase não recua */ // v596 (Mickey): 3-1 ofensivo = jogo no chão, dribles, jogadas rápidas
      if (e.koFirst && this.time - e.koFirst < 3) { opts.forEach((op) => { if (op.v === "chapeu4" || op.v === "vaca4" || op.v === "wall" || op.v === "haxSelf") op.w = 0; }); if (!opts.some((op) => op.w > 0)) opts.length = 0; } // v632 (Mickey): o primeiro toque da saída de bola não é drible nem bola no espaço
      if (!opts.length) opts.push({ v: "carry", w: 1 });
      const act = U.weighted(opts);
      if (act === "shoot") { if ((e.pivo || (e.alaOf && C.BOX_PLAY && Math.random() < C.BOX_PLAY.ofBack)) && this.selfBack(e)) return; /* v597: Ala Of também faz back de perto */ return this.shoot(e, distGoal, distO); } // v499: Pivô às vezes faz a backboard para ele mesmo
      if (act === "backSelf" && this.selfBack(e, true)) return; // v632
      if (act === "haxSelf") { const HS = this.ps(t).haxSelf, wl = e.y < H / 2 ? "top" : "bot", tx = U.clamp(e.x + d * HS.go, 40, W - 40), ty = U.clamp(wl === "top" ? Math.max(e.y, 50) : Math.min(e.y, H - 50), 40, H - 40); if (this.haxKick(e, e, tx, ty, wl, false)) { e.mode = "runTo"; e.tx = tx; e.ty = ty; e.think = Math.max(e.think || 0, 0.35); return; } }
      if (act === "wall") return this.wallPass(e, o);
      if (act === "chapeu4" || act === "vaca4") return this.trick4Go(e, o, act === "chapeu4");
      if (act === "caneta" || act === "vaca" || act === "puxada") { // v564 · X1: a bola passa pelo marcador (entre as pernas ou por um lado) e ele corre pelo outro · v565: puxada = para trás e sai pelo outro lado
        const TR = C.X1.trick, can = act === "caneta", pux = act === "puxada", sd = e.y > o.y ? -1 : 1, name = can ? "CANETA!" : pux ? "PUXADA!" : "DRIBLE DA VACA!";
        this.fol(e, C.X1.fol.drib); e.trickCd = TR.cd;
        const ok = Math.random() < U.clamp(this.duelOdds(e, o) * TR.edge * (pux ? TR.puxEdge : 1), 0.05, 0.92);
        if (!ok) { // v565 (Mickey): errou o truque = o marcador desarma na hora (a bola não vai de presente para ele)
          e.stun = (C.STEAL_LOST ? C.STEAL_LOST.stun : 0.5) + this.st4(); if (C.STEAL_LOST) e.duelCd = Math.max(e.duelCd, C.STEAL_LOST.noTackle); o.tackT = this.time; e.momN = 0; o.momN = (o.momN || 0) + 1;
          const b = this.ball; if (!this.x1Knock(e, o)) { b.owner = o; b.pass = null; b.vx = b.vy = 0; } o.heldT = 0; o.recoverT = this.time; o.think = 0.15 * this.actF(o); if (b.owner === o) { o.mode = "carry"; o.tx = o.x + this.dir(o.team) * 100; o.ty = o.y; }
          this.fx.push({ kind: "text", x: o.x, y: o.y - 30, text: "ROUBOU!", t: 0.9, color: "#c0081c" }); this.fx.push({ kind: "impact", x: (e.x + o.x) / 2, y: (e.y + o.y) / 2, t: 0.35 }); this.shake(6, 0.25);
          this.steals[o.team]++; this.chemEv(o, "steal"); this.onEvent("tackle", { team: o.team, name: o.p.short, vs: e.p.short }); return;
        }
        let tx, ty, ry;
        if (pux) { const s2 = Math.random() < 0.5 ? -1 : 1; tx = U.clamp(e.x - d * TR.back, 40, W - 40); ty = U.clamp(e.y + s2 * TR.backSide, 40, H - 40); ry = ty; o.vy = -s2 * 140; } // o marcador vai no lado errado
        else { tx = U.clamp(o.x + d * TR.behind, 40, W - 40); ty = U.clamp(can ? o.y : o.y + sd * TR.side, 40, H - 40); ry = can ? ty : U.clamp(o.y - sd * TR.side, 40, H - 40); }
        this.kickTo(e, tx, ty, pux ? TR.backSpeed : TR.speed, 2, { kind: "pass", to: e, trick: true });
        this.ball.ignore2 = o; this.ball.ignore2T = TR.ignore; o.stun = Math.max(o.stun, TR.stun);
        this.trick = { by: e, vs: o, name, ok: true };
        e.mode = "runTo"; e.tx = tx; e.ty = ry; e.vaca = act === "vaca" ? 0.3 : 0; // vaca: dá a volta pelo outro lado
        return;
      }
      if (act === "hax") { this.fol(e, C.X1.fol.drib); this.wallPass(e, o); if (this.ball.pass && this.ball.pass.to === e) this.trick = { by: e, vs: o, name: "HAXBALL!", ok: true, quiet: true }; e.wallCd = Math.max(e.wallCd || 0, 1.2); return; } // v565: combo com haxball
      if (act === "push" || act === "blade") { // v561 · X1: toca a bola à frente (push) ou por cima do marcador (blade) e corre atrás
        const bl = act === "blade", P = bl ? C.X1.blade : C.X1.push, dist = bl ? distO + P.over : U.rand(P.dist[0], P.dist[1]);
        const tx = U.clamp(e.x + d * dist, 40, W - 40), ty = U.clamp(e.y + (gy - e.y) * 0.15 + (bl ? 0 : U.rand(-30, 30)), 40, H - 40);
        this.kickTo(e, tx, ty, P.speed, bl ? 6 : 4, { kind: "pass", to: e, lob: bl });
        if (bl) { this.ball.lift = 0.4; this.fx.push({ kind: "text", x: e.x, y: e.y - 30, text: "BLADE!", t: 0.9, color: "#9dff6a" }); }
        this.fol(e, bl ? C.X1.fol.blade : C.X1.fol.push); e[bl ? "bladeCd" : "pushCd"] = P.cd; if (bl) this.trick = { by: e, vs: o, name: "BLADE!", ok: true, quiet: true }; else this.addStack(t, C.X1.style.push); // v562: passe para ele mesmo soma estilo
        e.mode = "runTo"; e.tx = tx; e.ty = ty; return;
      }
      if (act === "back") {
        const g = this.gks[t];
        this.kickTo(e, g.x, g.y, 480, 21 - passe * 0.5, { kind: "pass", to: g });
        this.onEvent("log", { team: t, text: `${e.p.short} recuou para o goleiro` });
        return;
      }
      if (act && act.hax) { const m = act.pass, h = act.hax; // v491: passe haxball
        if (this.haxKick(e, m, h.tx, h.ty, h.wall, false)) { m.mode = "runTo"; m.tx = h.tx; m.ty = h.ty; return; } }
      if (act && act.thru) {
        const m = act.pass, sp = act.thru;
        this.kickTo(e, sp.x, sp.y, 640, (17 - passe * 0.5) * ((this.ps(t) || {}).passErr || 1), { kind: "pass", to: m });
        if (this.ball.pass) { this.ball.pass.spot = sp; this.ball.pass.fill = { x: m.x, y: m.y }; }
        m.mode = "runTo"; m.tx = sp.x; m.ty = sp.y;
        return;
      }
      if (act && act.pass) {
        const m = act.pass;
        let ld = act.long ? 70 : 50; { const PL = C.PASS_LEAD, sx = m.x + this.dir(t) * ld; if (PL && this.field(1 - t).some((o) => o.stun <= 0 && hyp(o.x - sx, o.y - m.y) < ld + PL.opp)) ld = 0; } // v632 (Mickey): passe na frente do companheiro só se o espaço for dele; com adversário perto do ponto, vai no pé (antes a saída de bola entregava a posse)
        this.kickTo(e, m.x + this.dir(t) * ld, m.y, (act.long ? 680 : 600) * ((this.ps(t) || {}).passSp || 1), /* v632: passSp = passe mais rápido (bola no pé) */ (22 - passe * 0.55) * ((this.ps(t) || {}).passErr || 1), { kind: "pass", to: m, lob: !!act.long || (this.laneBlocked(e, m) && Math.random() < C.IVX.passLob * this.q(e, "passe") ** 2), ot: !!act.ot }); // v225: passe bom toca por cima da marcação
        // v197 · tocou para frente ou para o lado e sai para receber de novo: ofensivas disparam para a tabela,
        // defensivas sobem um passo (o bloco avança junto com a bola)
        if (plan && !act.long && !act.ot && (m.x - e.x) * this.dir(t) > -20) {
          e.ggT = this.time;
          if (plan === "attack") { e.ggx = U.clamp(e.x + this.dir(t) * 160, 60, W - 60); e.ggy = U.clamp(e.y + (H / 2 - e.y) * 0.3, 60, H - 60); }
          else { e.ggx = U.clamp(m.x + this.dir(t) * C.BUILD_STEP, 60, W - 60); e.ggy = U.clamp(e.y + (m.y - e.y) * 0.3, 60, H - 60); } // passa à frente de quem recebeu, pelo lado dele
        }
        if (act.chain) { e.ggT = this.time; e.ggUntil = this.time + CH.t; e.ggx = U.clamp(e.x + d * CH.run, 60, W - 60); e.ggy = U.clamp(e.y + (H / 2 - e.y) * 0.4, 60, H - 60); } // tocou e sai para receber de novo
        if (act.long) this.onEvent("log", { team: t, text: `${e.p.short} lançou para ${m.p.short}` });
        return;
      }
      // conduzir: em direção ao gol, desviando do marcador
      e.mode = "carry";
      let ty = this.training ? U.rand(70, H - 70) : gy + U.rand(-80, 80); // treino: conduz para lugares variados antes de passar/chutar
      if (blocked && !clear) ty = e.y + (e.y > o.y ? 1 : -1) * U.rand(70, 140);
      if (clear || freeRun) ty = e.y + (gy - e.y) * 0.5 + U.rand(-30, 30); // livre: vai reto em direção ao gol (v491: também livre só na frente)
      { const WG = (this.sdyn() || {}).wing; if (WG && !this.training) { // v704b (Mickey): com a bola, metade das posses vai pela ala (decidido no decide)
        if (e.wingRun && distGoal > WG.cut) ty = H / 2 + e.wingSd * (H / 2 - WG.edge); } }
      if (this.duelMode && blocked && !clear && distO < 150) {
        // v188 · 1×1: ginga na frente do marcador (corta para um lado, depois para o outro) antes do bote
        e.ginga = true; e.zig = -(e.zig || 1);
        ty = e.y + e.zig * U.rand(55, 95);
        e.think = U.rand(0.16, 0.26) * this.actF(e);
      }
      const cut = FL && !this.training && (e.alaOf || e.alaDef) && (e.x - this.ownGoalX(t)) * d > W * FL.cutFrom && Math.abs(e.y - gy) > FL.cutY;
      if (cut && (e.heldT || 0) < 0.2) e.cutIn = Math.random() < FL.cutIn * (this.bladeSeek(e) ? C.REPERT.blade.seek.cut : 1); // v472 (Mickey, Rematch): às vezes a ala corta para dentro e chuta do lado da área
      if (cut && e.cutIn) ty = gy + Math.sign(e.y - gy) * FL.cutY * 0.8;
      else if (C.LATERAL && e.alaOf && !this.training && !clear && (e.x - this.ownGoalX(t)) * d > W * C.LATERAL.from && Math.abs(this.goalX(t) - e.x) > C.LATERAL.minX && Math.random() < C.LATERAL.of) { const sd = Math.abs(e.y - H / 2) > 20 ? Math.sign(e.y - H / 2) : ((this.scheme && this.scheme[t]) || { side: 1 }).side; ty = H / 2 + sd * C.POS_AI.wingY; } // v499 (Mickey): jogo mais lateralizado: o Ala Of com a bola volta para a ala dele
      else if (this.wingRun(e)) ty = H / 2 + Math.sign(e.y - H / 2) * C.POS_AI.wingY; // v452: Ala Of na ala conduz pela lateral até a linha de fundo para cruzar
      e.tx = U.clamp(e.x + d * 140, 30, W - 30); e.ty = U.clamp(ty, 30, H - 30);
      if (this.x1() && o && !this.golden && ((this.stack || [])[t] || 0) < C.X1.style.shotMin) { // v693 (Mickey): já driblou, segue para o gol e chuta; não volta para driblar de novo só por estar longe · v563 (Mickey): sem stack para chutar, vai para cima do marcador (quer driblar)
        const near = Math.abs(gx - e.x) < C.X1.style.turnX; e.tx = U.clamp(near ? o.x - d * 40 : o.x, 30, W - 30); e.ty = U.clamp(o.y + (e.y > o.y ? 25 : -25), 30, H - 30); }
    }
    bladeSeek(e) { const BD = C.REPERT && C.REPERT.blade, P = this.rplays && this.rplays[e.team]; return !!(BD && BD.seek && P && e.alaOf && (P.used.blade || 0) < BD.max && Math.abs(e.y - H / 2) > 60 && Math.abs(this.goalX(e.team) - e.x) < W * 0.55); } // v498 (Mickey): com blade sobrando, o Ala Of procura a linha de fundo pela ala para puxar o blade
    wingRun(e) { return e.alaOf && !this.training && Math.abs(e.y - H / 2) > 80 && Math.abs(this.goalX(e.team) - e.x) < W * 0.45 && !this.crossSpot(e); }

    // v582 (Mickey) · jogada lendária: o portador do time sorteado, no campo de ataque, faz o lance do maior status dele
    legendStep() {
      const L = C.LEGEND_PLAY, lg = this.legend; if (this.time < lg.at) return;
      const e = this.ball.owner; if (!e || e.gk || e.team !== lg.team || e.stun > 0) return;
      const t = e.team, d = this.dir(t), dg = hyp(this.goalX(t) - e.x, H / 2 - e.y); if ((e.x - W / 2) * d < 0) return;
      const k = ["chute", "drible", "passe"].reduce((a, b) => (BL.baseStat(e.p, b) > BL.baseStat(e.p, a) ? b : a));
      if (k === "chute" && dg > L.shotDist) return;
      lg.done = true; const nm = L.def[k]; // v583 (Mickey): sem jogadas específicas por personagem
      e.legendK = k; e.legendT = this.time + L.t;
      // v584 (Mickey): a jogada acontece sem nada aparecer na tela (sem texto, anel nem tremida)
      this.onEvent("legend", { team: t, charId: e.p.charId, uid: e.p.uid, kind: k, name: nm, who: e.p.short });
      if (k === "chute") { let dO = 1e9; for (const o of this.field(1 - t)) dO = Math.min(dO, hyp(o.x - e.x, o.y - e.y)); this.shoot(e, dg, dO); }
    }

    shoot(e, distGoal, distO) {
      if (this.x1() && !e.gk && !this.x1ShotOk(e, distGoal)) { e.mode = "carry"; e.skShotNow = null; return; } // v623 · v563: no X1 só chuta com 3 stacks e perto do gol
      if (this.skWallHit(e)) { e.skShotNow = null; return; } // v623: Muralha do Capitão
      const t = e.team, opp = this.gks[1 - t];
      this.fol(e, C.X1 ? C.X1.fol.shot : 0); // v561: chutar gasta fôlego (X1)
      // marcador colado na frente do chutador: pode travar o chute na hora
      const o = this.field(1 - t).filter((x) => x.stun <= 0).reduce((best, x) => (!best || hyp(x.x - e.x, x.y - e.y) < hyp(best.x - e.x, best.y - e.y) ? x : best), null);
      // (na frente: até 75 px; chegando por trás/de lado: carrinho, até 55 px e com menos chance)
      const oD = o ? hyp(o.x - e.x, o.y - e.y) : 999, front = o && (o.x - e.x) * this.dir(t) > 0;
      const qc = Math.min(1, this.q(e, "chute"));
      // v225: Defesa bloqueia mais; chute com curva (Chute alto) foge do bloqueio
      const pBlock = o ? U.clamp(0.12 + this.pow(o, "defesa") / 110, 0.15, 0.45) * (front ? 1 : 0.6) * (this.styleKey[o.team] === "muralha" ? this.defSig(o) : 1) * this.lerpQ(C.IVX.defBlock, this.q(o, "defesa")) * (1 - C.IVX.shotDodge * qc) * (1 + (this.ifx(o).block || 0)) : 0; // v524: Caneleira Protetora
      if (o && this.blockOk() && oD < (front ? 75 : 55) * (C.BLOCK ? C.BLOCK.reach : 1) && Math.random() < pBlock * (C.BLOCK ? C.BLOCK.near : 1) * (e.fogShot === this.time && C.REPERT.fog.block != null ? C.REPERT.fog.block : 1)) { // v494: bloqueio mais presente
        const b = this.ball, a = Math.atan2(e.y - o.y, e.x - o.x) + U.rand(-1, 1), sp = U.rand(260, 380);
        b.owner = null; b.shot = null; b.pass = null; b.x = (e.x + o.x) / 2; b.y = (e.y + o.y) / 2;
        b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.ignore = o; b.ignoreT = 0.25;
        this.shots[t]++; this.drain(e, C.ENERGY_DRAIN_ACTION); this.drain(o, C.ENERGY_DRAIN_ACTION);
        this.lastBlockT = this.time; this.blockKeep(o); this.fx.push({ kind: "text", x: o.x, y: o.y - 30, text: "BLOQUEIO!", t: 0.8, color: "#ffd23f" });
        this.onEvent("log", { team: o.team, text: `${o.p.short} bloqueou o chute de ${e.p.short}` });
        e.skShotNow = null; return;
      }
      const chute = this.iv(e, "chute"), save = opp.gkStats.save;
      let chance = BL.goalChance(chute, save);
      // v484 (Mickey): marcação conta mesmo sem bote: adversário entre o chutador e o gol, perto, tira pontos (mais quanto mais perto); colado de lado/atrás tira pouco
      const SM = C.SHOT_MARK;
      if (SM) { const gx0 = this.goalX(t), D0 = hyp(gx0 - e.x, H / 2 - e.y) || 1, ux = (gx0 - e.x) / D0, uy = (H / 2 - e.y) / D0; let pen = 0;
        for (const x of this.field(1 - t)) { if (x.stun > 0) continue; const dd = hyp(x.x - e.x, x.y - e.y), al = (x.x - e.x) * ux + (x.y - e.y) * uy, side = Math.abs((x.x - e.x) * uy - (x.y - e.y) * ux);
          const dq = SM.iv ? SM.iv[0] + SM.iv[1] * Math.min(1, this.q(x, "defesa")) : 1; // v485: Defesa alta intimida mais
          if (al > 0 && al < D0 && side < SM.lane && dd < SM.r) pen = Math.max(pen, (SM.front * (1 - dd / SM.r) + SM.base) * dq); else if (dd < SM.near) pen = Math.max(pen, SM.side * dq); }
        chance -= pen; }
      else if (distO < 60) chance -= C.GOAL_PRESSURE_PENALTY;
      if (this.time - (e.dribT ?? -9) < C.IVX.dribAfterT) chance += C.IVX.dribAfterShot * Math.min(1, this.q(e, "drible")) ** 2; // v225: driblou e chutou
      chance = U.clamp(chance, C.GOAL_MIN, C.GOAL_MAX) * this.shotDist(e);
      if (C.SHOT_NEAR) chance = Math.min(C.GOAL_MAX, chance * this.interp(C.SHOT_NEAR, hyp(this.goalX(t) - e.x, H / 2 - e.y))); // v484 (Mickey): quanto mais perto do gol, maior a chance // v449: distância da zona ideal de chute · v442 (Mickey): quanto mais longe, mais difícil; do meio ~1%
      chance *= C.GOAL_K ?? 1; // v490 (Mickey): fazer gol é mais difícil que impedir
      if (e.fogShot === this.time && C.REPERT && C.REPERT.fog) chance = Math.min(C.GOAL_MAX, chance + C.REPERT.fog.add); // v495: voleio do fogueteiro
      if (e.comboShot === this.time && C.COMBO) chance = Math.min(C.GOAL_MAX, chance + C.COMBO.add); // v600: fim do combo
      { const SA = (this.ps(e.team) || {}).shotAdd; if (SA && e.comboShot !== this.time) chance = Math.min(C.GOAL_MAX, chance + SA); }
      { const ST = (this.ps(e.team) || {}).streak, n = this.pStreak ? this.pStreak[t] : 0; if (ST && e.comboShot !== this.time && n >= ST.min) chance = Math.min(C.GOAL_MAX, chance + Math.min(ST.max, (n - ST.min + 1) * ST.add)); if (this.pStreak) this.pStreak[t] = 0; } // v620 (Mickey): bola no pé faz mais gol construindo depois de vários passes // v610 (Mickey): bola no pé finaliza melhor
      { const FT = C.PLAYS && C.PLAYS.pivo && C.PLAYS.pivo.finta; if (FT && this.time - (e.fakeT ?? -9) < FT.win) { chance = Math.min(C.GOAL_MAX, chance + FT.add); e.fakeT = -9; } } // v591: back que enganou o goleiro, gol mais aberto
      if (e.tri3Shot === this.time && C.TRI3) chance = Math.min(C.GOAL_MAX, chance + C.TRI3.shotAdd); // v636: chute que fecha a triangulação
      if (e.ensShot === this.time && C.PLAYS && C.PLAYS.pivo && C.PLAYS.pivo.ensAdd) chance = Math.min(C.GOAL_MAX, chance + C.PLAYS.pivo.ensAdd); // v635: jogada ensaiada bem feita, gol mais aberto
      if (e.haxShot === this.time && C.REPERT && C.REPERT.hax) chance = Math.min(C.GOAL_MAX, chance + C.REPERT.hax.add); // v490: dominou o lançamento haxball
      if (e.volley === this.time && C.PLAYS && C.PLAYS.pivo && !this.ifx(e).volley) chance *= C.PLAYS.pivo.volleyMul; // v524: Chuteira Voleio não perde precisão
      { const F = this.ifx(e); if (F.aim || F.shotPow || F.shotK) chance = Math.min(C.GOAL_MAX, chance * (1 + (F.aim || 0)) * (1 + (F.shotPow || 0) * 0.4) * (1 + (F.shotK || 0))); }
      { const Q = this.cItem(e), ts = (this.tfx[e.team] || {}).shot || 0; if (ts || (Q && Q.box && this.shotEff(e) <= 160)) chance = Math.min(C.GOAL_MAX, chance * (1 + ts) * (Q && Q.box && this.shotEff(e) <= 160 ? 1 + Q.box : 1)); } // v527: Finalização (treinador), Coroa do Barou // v524: Precisão, Canhão, Sangue Frio // v470: de voleio, no ar, é mais difícil acertar
      if (e.legendK === "chute" && e.legendT > this.time) { chance = Math.max(chance, Math.min(C.LEGEND_PLAY.shotMax, chance * C.LEGEND_PLAY.shotK)); e.legendT = 0; } // v582: chute lendário
      chance = this.skShot(e, chance); // v623: habilidades
      const goal = Math.random() * 100 < chance;
      const post = !goal && this.duelMode && Math.random() < C.DUEL_POST; // v188 · 1×1: parte dos chutes que não entram explode na trave
      let ty;
      if (goal) ty = opp.y > H / 2 ? U.rand(MOUTH_T + 10, H / 2 - 10) : U.rand(H / 2 + 10, MOUTH_B - 10);
      else if (post) ty = opp.y > H / 2 ? MOUTH_T : MOUTH_B;
      else ty = U.clamp(opp.y + U.rand(-40, 40), MOUTH_T + 16, MOUTH_B - 16);
      const gx = this.goalX(t);
      this.kickTo(e, gx, ty, (820 + chute * 9) * (1 + C.IVX.shotPower * qc) * (1 + (this.ifx(e).shotPow || 0)) * this.skPow(e), 0, { kind: "shot" }); // v524: Chuteira Canhão // v225: chute bom é mais forte
      if (qc > 0.45) { // v225: chute com curva: sai aberto e fecha no alvo (gira pela distância percorrida, chega no mesmo ponto)
        const b = this.ball, c = C.IVX.shotCurve * qc * (Math.random() < 0.5 ? -1 : 1), D = hyp(gx - b.x, ty - b.y) || 1, ca = Math.cos(c), sa = Math.sin(c);
        [b.vx, b.vy] = [b.vx * ca - b.vy * sa, b.vx * sa + b.vy * ca];
        b.curl = { k: (-2 * c) / D, left: D };
      }
      this.ball.shot = { team: t, goal, post, ty, chance: Math.round(chance), shooter: e }; this.skAfterShot(e);
      if (this.duelMode) {
        this.fx.push({ kind: "ring", x: e.x, y: e.y, t: 0.5, team: t });
        if (distGoal > 300) { this.fx.push({ kind: "text", x: e.x, y: e.y - 30, text: "CHUTAÇO!", t: 0.9, color: "#ff9f1c" }); this.shake(4, 0.2); }
      }
      if (!(this.duelMode && distGoal > 300)) this.fx.push({ kind: "text", x: e.x, y: e.y - 30, text: "CHUTE!", t: 0.7, color: "#ff9f1c" }); // v576 (Mickey): texto do chute de volta
      this.shots[t]++;
      this.drain(e, C.ENERGY_DRAIN_ACTION);
      this.chemEv(e, "shot"); this.onEvent("shot", { team: t, chance: Math.round(chance), name: e.p.short });
    }

    // v442 (Mickey) · fator do chute pela distância: cheio até a marca do pênalti, cai rápido e do meio de campo fica perto de 1%.
    // Chute bom (IV) ganha alguns px de alcance (C.SHOT_DIST_IV)
    // v449 (Mickey) · zona ideal de chute: da marca do pênalti até a meia-lua, no centro (C.SHOT_ZONE). Dentro dela vale 160 px
    // (fator cheio); fora, soma a distância até a zona. Chute bom (IV) desconta até SHOT_DIST_IV px
    shotEff(e) {
      const Z = C.SHOT_ZONE, dg = Math.abs(this.goalX(e.team) - e.x), dy = Math.abs(e.y - H / 2);
      const dx = Math.max(0, dg - Z.x - Z.rx) + Math.max(0, Z.x - Z.rx - dg) * (Z.inK ?? 0.4); // v484: inK 0 = perto do gol não piora // v463: mais perto que a zona quase não piora
      return 160 + Math.max(0, hyp(dx, Math.max(0, dy - Z.ry)) - C.SHOT_DIST_IV * Math.min(1, this.q(e, "chute")));
    }
    // v452 (Mickey): Ala Of aberto na ala, perto da linha de fundo deles = posição de cruzamento para o Pivô no centro da área
    crossSpot(e) { const dg = Math.abs(this.goalX(e.team) - e.x); return dg < C.POS_AI.crossX && Math.abs(e.y - H / 2) > C.POS_AI.crossY; }
    zoneOf(t) { return { x: this.goalX(t) - this.dir(t) * C.SHOT_ZONE.x, y: H / 2 }; } // centro da zona ideal no ataque do time t
    shotDist(e) {
      return this.interp(C.SHOT_DIST, this.shotEff(e));
    }
    interp(P, x) { // tabela [[x, y], ...] com interpolação linear e pontas fixas
      if (x <= P[0][0]) return P[0][1];
      for (let i = 1; i < P.length; i++) if (x <= P[i][0]) { const [x0, y0] = P[i - 1], [x1, y1] = P[i]; return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0); }
      return P[P.length - 1][1];
    }
    // v466 (Mickey, clipe do Rematch) · jogada ensaiada "cruzado + tabela": do meio, lança cruzado para o Ala Of/Pivô
    // lá na frente do outro lado; ele toca curto num companheiro, dispara para a zona de chute e recebe de volta para finalizar
    playStep(e) {
      const t = e.team, P = this.plays && this.plays[t], PL = C.PLAYS && C.PLAYS.tabela; if (!P || P.used || !PL) return false;
      const d = this.dir(t), og = this.ownGoalX(t), dep = (x) => (x - og) * d, passe = this.iv(e, "passe");
      if (P.st && (this.time > P.until || this.lastOwnTeam !== t)) { P.st = null; P.used = true; return false; }
      if (!P.st) {
        if (dep(e.x) < W * PL.from || dep(e.x) > W * PL.to) return false;
        // v467 (Mickey): acontece naturalmente, só com tudo no lugar: quem lança sem marcador colado, quem recebe livre do outro lado
        // e um companheiro perto dele para a tabela
        const opp = this.field(1 - t).filter((o) => !o.gk), free = (x, r) => opp.every((o) => hyp(o.x - x.x, o.y - x.y) > r);
        if (!free(e, PL.carrierFree)) return false;
        const m = this.field(t).find((x) => x !== e && (x.alaOf || x.pivo) && dep(x.x) > W * PL.ahead && Math.abs(x.y - e.y) > PL.cross && x.stun <= 0 && free(x, PL.targetFree)
          && this.field(t).some((p) => p !== e && p !== x && dep(p.x) > W * 0.5 && hyp(p.x - x.x, p.y - x.y) < PL.mate));
        if (!m) return false;
        // v468 (Mickey): mesmo com o lance montado, nem sempre escolhem a jogada (decide 1 vez por oportunidade)
        if (P.rollE === e && this.time - P.rollT < PL.rollGap) return false;
        P.rollE = e; P.rollT = this.time; if (Math.random() > PL.pick) return false;
        this.kickTo(e, m.x + d * 60, m.y, 700, 20 - passe * 0.55, { kind: "pass", to: m, lob: true });
        P.st = "lanc"; P.a = m; P.until = this.time + 3.5;
        this.onEvent("log", { team: t, text: `${e.p.short} lança cruzado para ${m.p.short}` });
        return true;
      }
      if (P.st === "lanc" && e === P.a) {
        const p = this.field(t).filter((x) => x !== e && x.stun <= 0 && dep(x.x) > W * 0.5).sort((x, y) => hyp(x.x - e.x, x.y - e.y) - hyp(y.x - e.x, y.y - e.y))[0];
        if (!p) { P.st = null; P.used = true; return false; }
        this.kickTo(e, p.x, p.y, 620, 16 - passe * 0.5, { kind: "pass", to: p });
        const z = this.zoneOf(t); e.ggT = this.time; e.ggUntil = this.time + 2.5; e.ggx = z.x; e.ggy = U.clamp(z.y + (e.y - H / 2) * 0.3, 60, H - 60);
        P.st = "tabela"; P.b = p; P.until = this.time + 3;
        return true;
      }
      if (P.st === "tabela" && e === P.b) {
        const a = P.a, tx = a.ggx ?? a.x, ty = a.ggy ?? a.y;
        this.kickTo(e, tx, ty, 640, 14 - passe * 0.5, { kind: "pass", to: a });
        P.st = null; P.used = true; P.done = this.time;
        this.onEvent("log", { team: t, text: `${e.p.short} devolve de primeira para ${a.p.short}` });
        return true;
      }
      return false;
    }
    // v470 (Mickey, vídeos na visão do Pivô): lances que saem sozinhos, de vez em quando, quando o lance está montado
    // (cada um no máximo PV.max vezes por partida e só pick das oportunidades):
    // · primeiroPau: bola aberta perto da área, o Pivô ataca o primeiro pau e o cruzamento vem alto para ele finalizar de primeira (voleio)
    // · parede: Pivô de costas com o marcador colado toca de primeira para quem chega, gira e entra na área para receber de volta
    // · costas: bola livre no meio, o Pivô na linha do último defensor arranca e o passe vai por cima, nas costas da defesa
    // v471 (Mickey, vídeos na visão do Pivô): com a nossa bola no ataque, de vez em quando o Pivô corta em diagonal
    // por trás do marcador, de um lado da área para o outro (não fica parado esperando a bola)
    pivoDiag(e) {
      const b = this.ball, t = e.team, PV = C.PLAYS && C.PLAYS.pivo, DG = PV && PV.diag; if (!DG) return false;
      const own = b.owner && b.owner.team === t && !b.owner.gk && b.owner !== e ? b.owner : (!b.owner && b.pass && b.pass.team === t && b.pass.to === e && e.mode === "diag" ? b.pass.from : null);
      const d = this.dir(t), dep = (x) => (x - this.ownGoalX(t)) * d;
      if (!own || dep(own.x) < W * DG.from) { e.diag = null; return false; }
      if (e.diag && this.time < e.diag.until && hyp(e.diag.x - e.x, e.diag.y - e.y) > 18) return true;
      if (e.diag) { e.diag = null; e.diagCd = this.time + DG.cd; return false; }
      if (this.time < (e.diagCd || 0) || this.time - (e.diagRoll ?? -9) < DG.rollGap) return false;
      e.diagRoll = this.time; if (Math.random() > DG.p) return false;
      const side = Math.sign(e.y - H / 2) || (Math.random() < 0.5 ? -1 : 1), gx = this.goalX(t);
      e.diag = { x: gx - d * U.rand(DG.x[0], DG.x[1]), y: U.clamp(H / 2 - side * U.rand(DG.y[0], DG.y[1]), 70, H - 70), until: this.time + DG.t };
      return true;
    }
    pivoStep(e) {
      const t = e.team, P = this.pplays && this.pplays[t], PV = C.PLAYS && C.PLAYS.pivo; if (!P || !PV) return false;
      const d = this.dir(t), og = this.ownGoalX(t), dep = (x) => (x - og) * d, passe = this.iv(e, "passe"), gx = this.goalX(t);
      const opp = this.field(1 - t).filter((o) => !o.gk), near = (x, y, r) => opp.some((o) => hyp(o.x - x, o.y - y) < r);
      if (P.st && (this.time > P.until || this.lastOwnTeam !== t)) { P.st = null; P.ens = false; }
      const ens = () => { if (this.ball.pass) this.ball.pass.ens = PV.ens || 0; }; // v635: passe da jogada ensaiada
      if (P.st === "fin" && e === P.p) { // recebeu o cruzamento / a devolução: finaliza de primeira
        P.st = null; if (this.shotEff(e) > PV.finEff) return false;
        if (P.vol !== false) e.volley = this.time; // v471: na diagonal finaliza no chão
        if (P.nw) e.ensShot = this.time; // v635: final de jogada ensaiada nova
        this.shoot(e, Math.abs(gx - e.x), opp.reduce((m, o) => Math.min(m, hyp(o.x - e.x, o.y - e.y)), 999));
        if (P.vol !== false) { this.shake(3, 0.15); this.fx.push({ kind: "ring", x: e.x, y: e.y, t: 0.45, team: t }); }
        return true;
      }
      if (P.st === "ko" && e === P.m) { // v591 (Mickey, clipe 1): saída ensaiada: recebeu o recuo, lança na ala para o Ala Of que já disparou
        const SA = PV.saida, ao = P.p; P.st = null; if (!ao || ao.stun > 0) return false;
        const sx = this.ownGoalX(t) + d * W * SA.dep, sy = ao.y > H / 2 ? H - SA.wing : SA.wing;
        this.kickTo(e, sx, sy, 760, 16 - passe * 0.5, { kind: "pass", to: ao, lob: true });
        if (this.ball.pass) this.ball.pass.spot = { x: sx, y: sy }; ao.mode = "runTo"; ao.tx = sx; ao.ty = sy;
        this.onEvent("log", { team: t, text: `Saída ensaiada: ${e.p.short} lança ${ao.p.short} na ala` });
        return true;
      }
      if (P.st === "parede" && e === P.m) { // recebeu do Pivô: devolve na corrida dele para dentro da área
        const p = P.p, sx = p.ggx ?? p.x, sy = p.ggy ?? p.y;
        this.kickTo(e, sx, sy, 640, 14 - passe * 0.5, { kind: "pass", to: p, lob: !!P.ens || this.laneBlocked(e, p) }); // v635: na cortina devolve por cima
        if (this.ball.pass) this.ball.pass.spot = { x: sx, y: sy }; if (P.ens) { ens(); P.ens = false; } // v635: devolução da cortina
        P.st = "fin"; P.vol = Math.random() < 0.5; P.until = this.time + 2.5;
        this.onEvent("log", { team: t, text: `${e.p.short} devolve para ${p.p.short} na área` });
        return true;
      }
      if (P.st === "cort" && e === P.m) { // v635 (Mickey, vídeo da Ucrânia): recebeu o passe atravessado: de primeira no Pivô e corta para receber a parede
        const CT = PV.cortina, pv = P.q; P.st = null;
        if (!pv || pv.stun > 0 || pv === e || hyp(pv.x - e.x, pv.y - e.y) > CT.pivo) return false;
        this.kickTo(e, pv.x - d * 12, pv.y, CT.sp, 12 - passe * 0.45, { kind: "pass", to: pv, lob: this.laneBlocked(e, pv) }); ens(); P.ens = true;
        e.ggT = this.time; e.ggUntil = this.time + 2.8; e.ggx = gx - d * CT.runX; e.ggy = U.clamp(H / 2 + (Math.sign(e.y - H / 2) || 1) * CT.runY, 60, H - 60); // corta pelo lado dele para a área
        P.st = "parede"; P.p = e; P.m = pv; P.until = this.time + 3;
        this.onEvent("log", { team: t, text: `${e.p.short} toca de primeira em ${pv.p.short} e corta` });
        return true;
      }
      if (P.st === "ce1" && e === P.m) { // v635 (Mickey, ebook, jogada 01): recebeu de lado na saída: atravessa de primeira para o Ala Of aberto no fundo da ala
        const CE = PV.centro, ao = P.p; P.st = null; if (!ao || ao.stun > 0) return false;
        const og2 = this.ownGoalX(t), sx = og2 + d * Math.min(W * CE.dep, (ao.x - og2) * d + CE.lead), sy = ao.ty ?? (ao.y > H / 2 ? H - CE.wing : CE.wing);
        if (near(sx, sy, CE.free)) return false; // a ala fechou: segue o jogo
        this.kickTo(e, sx, sy, CE.sp, 16 - passe * 0.5, { kind: "pass", to: ao, lob: true }); ens();
        if (this.ball.pass) this.ball.pass.spot = { x: sx, y: sy }; ao.mode = "runTo"; ao.tx = sx; ao.ty = sy;
        P.st = "cruz"; P.m = ao; P.p = P.q; P.until = this.time + PV.cruz.t + 1.5;
        this.onEvent("log", { team: t, text: `${e.p.short} atravessa de primeira para ${ao.p.short} no fundo da ala` });
        return true;
      }
      if (P.st === "cruz" && e === P.m) { // v635 (Mickey, vídeos de saída): leva pela ala até perto da linha e cruza no segundo pau para o Pivô
        const CR = PV.cruz, pv = P.p, sd = Math.sign(e.y - H / 2) || 1; if (!pv || pv.stun > 0 || pv === e) { P.st = null; return false; }
        const px = gx - d * CR.postX, py = H / 2 - sd * CR.postY; pv.ggT = this.time; pv.ggUntil = this.time + 1.2; pv.ggx = px; pv.ggy = py;
        if (Math.abs(gx - e.x) < CR.x || near(e.x, e.y, 50)) {
          this.kickTo(e, px, py, 640, 15 - passe * 0.5, { kind: "pass", to: pv, lob: true }); ens();
          if (this.ball.pass) this.ball.pass.spot = { x: px, y: py };
          P.st = "fin"; P.vol = true; P.p = pv; P.until = this.time + 2.5;
          this.onEvent("log", { team: t, text: `${e.p.short} cruza no segundo pau para ${pv.p.short}` });
          return true;
        }
        e.mode = "carry"; e.tx = gx - d * (CR.x - CR.carry); e.ty = U.clamp(e.y, 60, H - 60); return true; // conduz pela ala até a linha
      }
      if (!P.st) P.nw = false; // v635
      if (P.st) return false;
      const piv = this.field(t).find((x) => x.pivo && x.stun <= 0); if (!piv) return false;
      const roll = (k) => { if (P.rollE === e && this.time - P.rollT < PV.rollGap) return false; P.rollE = e; P.rollT = this.time; const Q = this.ps(t); const bk = k === "backFinta" && Q && Q.back ? Q.back : 1; return Math.random() < PV.pick[k] * (Q ? Q.set : 1) * bk && (P.used[k] || 0) < PV.max * (Q ? Q.setMax : 1) * bk; }; /* v632: Q.back = mais backboard */ // v596
      const dg = Math.abs(gx - e.x), side = Math.sign(e.y - H / 2) || 1;
      { const CT = PV.cortina, pr = CT && e !== piv && !e.gk && dep(e.x) < W * CT.own ? opp.find((o) => o.stun <= 0 && hyp(o.x - e.x, o.y - e.y) < CT.press) : null; // v635 (Mickey, vídeo da Ucrânia): saída de pressão: cortina + passe atravessado de primeira + de primeira no Pivô com corte de quem passou
        const far = pr && this.field(t).filter((x) => x !== e && x !== piv && !x.gk && x.stun <= 0 && Math.abs(x.y - e.y) > CT.far && this.openness(x) > CT.open && hyp(piv.x - x.x, piv.y - x.y) < CT.pivo).sort((a, b) => this.openness(b) - this.openness(a))[0];
        if (far && roll("cortina")) {
          const scr = this.field(t).find((x) => x !== e && x !== far && x !== piv && !x.gk && x.stun <= 0);
          if (scr) { scr.ggT = this.time; scr.ggUntil = this.time + 0.9; scr.ggx = (pr.x + e.x) / 2; scr.ggy = (pr.y + e.y) / 2; }
          pr.stun = Math.max(pr.stun, CT.stun); this.fx.push({ kind: "text", x: pr.x, y: pr.y - 30, text: "CORTINA!", t: 0.9, color: "#5fd4ff" });
          this.kickTo(e, far.x + d * 20, far.y, CT.sp, 12 - passe * 0.45, { kind: "pass", to: far, lob: this.laneBlocked(e, far) }); ens();
          P.used.cortina = (P.used.cortina || 0) + 1; P.nw = true; P.st = "cort"; P.m = far; P.q = piv; P.until = this.time + CT.t;
          this.onEvent("log", { team: t, text: `${scr ? scr.p.short + " faz a cortina e " : ""}${e.p.short} atravessa para ${far.p.short}` });
          return true;
        } }
      if (e !== piv && piv.mode === "diag" && piv.diag && !near(e.x, e.y, PV.diag.free)) { // v471: a bola vai na frente da diagonal do Pivô
        const q = piv.diag, k = Math.min(1, PV.diag.lead / Math.max(1, hyp(q.x - piv.x, q.y - piv.y))), sx = piv.x + (q.x - piv.x) * k, sy = piv.y + (q.y - piv.y) * k;
        if (hyp(sx - e.x, sy - e.y) > PV.diag.maxPass || near(sx, sy, PV.diag.space) || !roll("diagonal")) return false;
        this.kickTo(e, sx, sy, 640, 15 - passe * 0.5, { kind: "pass", to: piv, lob: this.laneBlocked(e, piv) });
        if (this.ball.pass) this.ball.pass.spot = { x: sx, y: sy };
        P.used.diagonal = (P.used.diagonal || 0) + 1; P.st = "fin"; P.vol = false; P.p = piv; P.until = this.time + 2.5;
        this.onEvent("log", { team: t, text: `${e.p.short} acha ${piv.p.short} na diagonal` });
        return true;
      }
      if (P.ko) { P.ko = false; // v591 (Mickey, clipe 1): saída ensaiada: quem dá a saída recua, o Ala Of dispara pela ala e recebe o lançamento
        const SA = PV.saida, ao = this.field(t).find((x) => x.alaOf && x !== e && x.stun <= 0), bk = this.field(t).filter((x) => x !== e && x !== ao && x.stun <= 0).sort((a, b) => dep(a.x) - dep(b.x))[0];
        const CE = PV.centro, ad = CE && this.field(t).find((x) => x.alaDef && x !== e && x !== ao && x !== piv && x.stun <= 0);
        if (CE && ao && ad && Math.random() < 0.5 && hyp(e.x - W / 2, e.y - H / 2) < CE.mid && !this.laneBlocked(e, ad) && roll("centro")) { // v635 (Mickey, ebook, jogada 01 de saída de centro): toca de lado, o Ala Of abre no fundo da ala oposta e o Pivô vai para o segundo pau
          this.kickTo(e, ad.x - d * CE.back, ad.y, 500, 8 - passe * 0.3, { kind: "pass", to: ad }); ens();
          const wy = ad.y > H / 2 ? CE.wing : H - CE.wing; ao.mode = "runTo"; ao.tx = this.ownGoalX(t) + d * W * CE.dep; ao.ty = wy;
          P.used.centro = (P.used.centro || 0) + 1; P.nw = true; P.st = "ce1"; P.m = ad; P.p = ao; P.q = piv; P.until = this.time + 3.5;
          this.fx.push({ kind: "text", x: e.x, y: e.y - 30, text: "JOGADA 01!", t: 1, color: "#ffd23f" });
          this.onEvent("log", { team: t, text: `Jogada de saída de centro: ${e.p.short} toca de lado para ${ad.p.short}` });
          return true;
        }
        if (ao && bk && hyp(e.x - W / 2, e.y - H / 2) < SA.mid && roll("saida")) {
          this.kickTo(e, bk.x, bk.y, 520, 10 - passe * 0.3, { kind: "pass", to: bk });
          const wy = ao.y > H / 2 ? H - SA.wing : SA.wing; ao.mode = "runTo"; ao.tx = this.ownGoalX(t) + d * W * SA.dep; ao.ty = wy;
          P.used.saida = (P.used.saida || 0) + 1; P.st = "ko"; P.m = bk; P.p = ao; P.until = this.time + 3;
          this.onEvent("log", { team: t, text: `${e.p.short} recua para ${bk.p.short} na saída` });
          return true;
        }
      }
      { const PA = PV.pa; // v591 (Mickey, clipe 3): Ala Of na ala perto da linha de fundo cruza na pequena área, Pivô finaliza de primeira
        if (PA && e.alaOf && dg < PA.x && Math.abs(e.y - H / 2) > PA.y && !near(e.x, e.y, PA.free) && Math.abs(gx - piv.x) < PA.pivo && hyp(piv.x - e.x, piv.y - e.y) < PA.reach && roll("pequenaArea")) {
          const sx = gx - d * PA.spotX, sy = H / 2 + side * PA.spotY, lob = this.laneBlocked(e, piv) || Math.random() < 0.5;
          this.kickTo(e, sx, sy, 660, 14 - passe * 0.5, { kind: "pass", to: piv, lob });
          if (this.ball.pass) this.ball.pass.spot = { x: sx, y: sy }; piv.mode = "runTo"; piv.tx = sx; piv.ty = sy;
          P.used.pequenaArea = (P.used.pequenaArea || 0) + 1; P.st = "fin"; P.vol = lob; P.p = piv; P.until = this.time + 2.5;
          this.onEvent("log", { team: t, text: `${e.p.short} cruza na pequena área para ${piv.p.short}` });
          return true;
        } }
      { const FT = PV.finta; // v591 (Mickey, clipe 4): perto da linha de fundo com o zagueiro na frente: back na parede do fundo para ele mesmo, passa do zagueiro e o goleiro cai no primeiro pau
        const mk = FT && (e.alaOf || e.pivo) && dg < FT.x && Math.abs(e.y - H / 2) > GH / 2 - 10 && opp.find((o) => hyp(o.x - e.x, o.y - e.y) < FT.mark && (o.x - e.x) * d > -10);
        if (mk && roll("backFinta")) {
          const tx = gx - d * U.rand(FT.spot[0], Math.min(FT.spot[1], Math.max(FT.spot[0] + 1, dg))), ty = H / 2 + side * (GH / 2 - 12);
          if (this.haxKick(e, e, tx, ty, "end", false)) {
            if (this.ball.pass) { this.ball.pass.sbb = true; this.ball.pass.fake = true; }
            const g = this.gks[1 - t]; if (g) { g.foolT = this.time + FT.fool; g.foolY = U.clamp(H / 2 + side * GH / 2, MOUTH_T + 10, MOUTH_B - 10); }
            e.mode = "runTo"; e.tx = tx; e.ty = ty; mk.stun = Math.max(mk.stun, 0.15);
            P.used.backFinta = (P.used.backFinta || 0) + 1;
            this.onEvent("log", { team: t, text: `${e.p.short} faz o back, engana o zagueiro e o goleiro` });
            return true;
          }
        } }
      if (e !== piv && dg < PV.cross.x && Math.abs(e.y - H / 2) > PV.cross.y && !near(e.x, e.y, PV.cross.free) && Math.abs(gx - piv.x) < PV.cross.pivo && hyp(piv.x - e.x, piv.y - e.y) < PV.cross.reach) {
        if (!roll("primeiroPau")) return false;
        const sx = gx - d * PV.cross.postX, sy = H / 2 + side * PV.cross.postY;
        this.kickTo(e, sx, sy, 620, 16 - passe * 0.5, { kind: "pass", to: piv, lob: true });
        if (this.ball.pass) this.ball.pass.spot = { x: sx, y: sy };
        P.used.primeiroPau = (P.used.primeiroPau || 0) + 1; P.st = "fin"; P.vol = true; P.p = piv; P.until = this.time + 2.5;
        this.onEvent("log", { team: t, text: `${e.p.short} cruza no primeiro pau para ${piv.p.short}` });
        return true;
      }
      if (e === piv && dep(e.x) > W * PV.wall.from && dep(e.x) < W * PV.wall.to) {
        const mk = opp.find((o) => hyp(o.x - e.x, o.y - e.y) < PV.wall.mark && (o.x - e.x) * d > 0); if (!mk) return false; // de costas, marcador entre ele e o gol
        const m = this.field(t).filter((x) => x !== e && x.stun <= 0 && (e.x - x.x) * d > 30 && hyp(x.x - e.x, x.y - e.y) < PV.wall.mate && !near(x.x, x.y, PV.wall.free))
          .sort((a, b) => hyp(a.x - e.x, a.y - e.y) - hyp(b.x - e.x, b.y - e.y))[0];
        if (!m || !roll("parede")) return false;
        this.kickTo(e, m.x, m.y, 560, 12 - passe * 0.45, { kind: "pass", to: m });
        const z = this.zoneOf(t); e.ggT = this.time; e.ggUntil = this.time + 2.5; e.ggx = z.x; e.ggy = U.clamp(z.y + (e.y - H / 2) * 0.4, 60, H - 60); // gira e ataca a área
        P.used.parede = (P.used.parede || 0) + 1; P.st = "parede"; P.p = e; P.m = m; P.until = this.time + 3;
        this.onEvent("log", { team: t, text: `${e.p.short} faz a parede para ${m.p.short} e gira` });
        return true;
      }
      if (e !== piv && dep(e.x) > W * PV.back.from && dep(e.x) < W * PV.back.to && !near(e.x, e.y, PV.back.free)) {
        const last = opp.reduce((a, o) => (!a || dep(o.x) > dep(a.x) ? o : a), null); if (!last) return false;
        if (Math.abs(dep(piv.x) - dep(last.x)) > PV.back.line || dep(piv.x) < W * 0.5) return false; // na linha do último defensor
        const sx = U.clamp(last.x + d * PV.back.ahead, 60, W - 60), sy = U.clamp(piv.y + (H / 2 - piv.y) * 0.3, 70, H - 70);
        if (Math.abs(gx - sx) < 70 || near(sx, sy, PV.back.space) || !roll("costas")) return false; // espaço nas costas
        this.kickTo(e, sx, sy, 680, 18 - passe * 0.55, { kind: "pass", to: piv, lob: true });
        if (this.ball.pass) this.ball.pass.spot = { x: sx, y: sy };
        P.used.costas = (P.used.costas || 0) + 1; P.st = null;
        this.onEvent("log", { team: t, text: `${e.p.short} lança ${piv.p.short} nas costas da defesa` });
        return true;
      }
      return false;
    }
    // v474 (Mickey, clipes do Rematch: "essência do que os jogadores preferem fazer"): lances que saem de vez em quando, sem texto na tela
    // · levantada: marcador colado na frente perto da área, levanta a bola por cima dele, corre e finaliza de voleio
    // · lançamento: defensor livre no próprio campo acha o Ala Of/Pivô que está na linha da defesa alta deles, nas costas
    // v495 · finalização na hora de quem dominou a levantada do fogueteiro ou o lançamento haxball
    repRecv(e) {
      const R = C.REPERT; if (!R || !(e.fog || e.hax || e.blade || e.bRecv)) return false;
      const t = e.team, gx = this.goalX(t), d = this.dir(t), opp = this.field(1 - t).filter((o) => !o.gk && o.stun <= 0), dO = () => opp.reduce((m, o) => Math.min(m, hyp(o.x - e.x, o.y - e.y)), 999);
      if (e.blade) { const B = e.blade, BD = R.blade; e.blade = null; // v497 (Mickey): BLADE: levantou para ele mesmo e agora bate de voleio: passe aéreo para o Pivô (Ala Of) ou chute (Pivô)
        this.fx.push({ kind: "text", x: e.x, y: e.y - 34, text: "BLADE!", t: 1, color: "#5fd4ff" }); this.shake(3, 0.15);
        if (B.kind === "pass" && B.to && B.to.stun <= 0 && this.ball.owner === e) { const m = B.to, sx = U.clamp(m.x + d * BD.lead, 40, W - 40), sy = m.y;
          this.kickTo(e, sx, sy, BD.passSp / C.BALL_SCALE, BD.err - this.iv(e, "passe") * BD.errIv, { kind: "pass", to: m, lob: true });
          if (this.ball.pass) { this.ball.pass.spot = { x: sx, y: sy }; this.ball.pass.bladeTo = true; }
          m.mode = "runTo"; m.tx = sx; m.ty = sy; this.onEvent("log", { team: t, text: `${e.p.short} faz o blade de voleio para ${m.p.short}` }); return true; }
        if (this.ball.owner === e) { e.volley = this.time; this.onEvent("log", { team: t, text: `${e.p.short} faz o blade e bate de voleio` }); this.shoot(e, hyp(gx - e.x, H / 2 - e.y), dO()); if (this.ball.shot) this.ball.shot.blade = true; return true; } }
      if (e.bRecv) { const L = this.time - e.bRecv < R.blade.win; e.bRecv = 0; if (L && e.pivo && Math.random() < (R.blade.pivoBack || 0) && this.selfBack(e, true)) return true; /* v588 */ if (L) { this.shoot(e, hyp(gx - e.x, H / 2 - e.y), dO()); return true; } } // recebeu o blade: finaliza de primeira
      if (e.fog) { const L = this.time - e.fog < R.fog.win; e.fog = 0; // v495 (Mickey): fogueteiro: dominou a levantada do companheiro, bate de voleio na hora
        if (L) { e.fogShot = this.time; this.fx.push({ kind: "text", x: e.x, y: e.y - 34, text: "FOGUETEIRO!", t: 1, color: "#ffd23f" }); this.shoot(e, hyp(gx - e.x, H / 2 - e.y), opp.reduce((m, o) => Math.min(m, hyp(o.x - e.x, o.y - e.y)), 999)); this.shake(4, 0.2); return true; } }
      if (e.hax) { const L = this.time - e.hax < R.hax.win; e.hax = 0; // v490: dominou o lançamento haxball: chuta na hora
        if (L) { e.haxShot = this.time; this.shoot(e, hyp(gx - e.x, H / 2 - e.y), opp.reduce((m, o) => Math.min(m, hyp(o.x - e.x, o.y - e.y)), 999)); return true; } }
      return false;
    }
    repStep(e, bladeOnly) {
      const R = C.REPERT, P = this.rplays && this.rplays[e.team]; if (!R || !P) return false;
      const t = e.team, d = this.dir(t), gx = this.goalX(t), dep = (x) => (x - this.ownGoalX(t)) * d, passe = this.iv(e, "passe");
      const opp = this.field(1 - t).filter((o) => !o.gk && o.stun <= 0), near = (x, y, r, sk) => opp.some((o) => o !== sk && hyp(o.x - x, o.y - y) < r);
      // v497 (Mickey): BLADE: levanta a bola para ele mesmo e bate de voleio; Ala Of (pOf): passe aéreo para o Pivô; Pivô (pPivo): chute
      const BD = R.blade;
      if (BD && (e.alaOf || e.pivo) && dep(e.x) > W * BD.from && (P.used.blade || 0) < BD.max * ((this.ps(e.team) || {}).rep || 1) && this.time - (P.bladeT ?? -9) > BD.rollGap) {
        let kind = null, tgt = null;
        const wingOk = !BD.wing || (Math.abs(gx - e.x) < BD.wing.x && Math.abs(e.y - H / 2) > BD.wing.y); // v498 (Mickey): o Ala Of puxa o blade da ala, perto da linha de fundo (onde cruza)
        if (e.alaOf && wingOk) { const pv = this.field(t).find((x) => x.pivo && x.stun <= 0), dd = pv ? hyp(pv.x - e.x, pv.y - e.y) : 0; if (pv && dd >= BD.pass[0] && dd <= BD.pass[1] && this.shotEff(pv) <= BD.pivoEff) { kind = "pass"; tgt = pv; } }
        else if (e.pivo && this.shotEff(e) <= BD.shotEff) kind = "shot";
        if (kind) { P.bladeT = this.time;
          if (Math.random() < (e.alaOf ? BD.pOf : BD.pPivo)) {
            const sx = U.clamp(e.x + d * BD.up, 40, W - 40), sy = e.y;
            this.kickTo(e, sx, sy, BD.upSp / C.BALL_SCALE, 2, { kind: "pass", to: e, lob: true });
            if (this.ball.pass) { this.ball.pass.spot = { x: sx, y: sy }; this.ball.pass.blade = { kind, to: tgt }; }
            e.mode = "runTo"; e.tx = sx; e.ty = sy; P.used.blade = (P.used.blade || 0) + 1;
            return true;
          } } }
      if (bladeOnly) return false;
      // v495 (Mickey, clipe do Rematch): FOGUETEIRO: perto da área e com um companheiro perto (near px) em posição de chute, levanta a bola para ele bater de voleio;
      // de primeira (recebendo passe ou lançamento) é mais provável (pFirst) que com a bola no pé (p)
      const FG = R.fog;
      if (FG && dep(e.x) > W * FG.from && (P.used.fog || 0) < FG.max * ((this.ps(e.team) || {}).rep || 1) && this.time - (P.fogT ?? -9) > FG.rollGap) {
        const fBack = Math.random() < (FG.back ?? 1); // v499 (Mickey): fogueteiro para frente ou para os lados; para trás só 1 em 20
        const mt = this.field(t).filter((x) => x !== e && !x.gk && x.stun <= 0 && (fBack || (x.x - e.x) * d > -FG.backTol) && dep(x.x) > W * FG.mateDep && this.shotEff(x) <= FG.mateEff && hyp(x.x - e.x, x.y - e.y) >= FG.near[0] && hyp(x.x - e.x, x.y - e.y) <= FG.near[1])
          .sort((a, b) => this.shotEff(a) - this.shotEff(b))[0];
        if (mt) { P.fogT = this.time; const first = this.time - (e.recvT ?? -9) < FG.firstT;
          if (Math.random() < (first ? FG.pFirst : FG.p)) {
            const sx = U.clamp(mt.x + d * FG.lead, 40, W - 40), sy = mt.y;
            const fA = C.COMBO && C.COMBO.fogAir, fL = hyp(sx - e.x, sy - e.y); this.kickTo(e, sx, sy, fA ? (fL * 1.05) / (1 - Math.exp(-1.05 * fA)) / C.BALL_SCALE : FG.speed / C.BALL_SCALE, FG.err - passe * FG.errIv, { kind: "pass", to: mt, lob: true }); // v607: sobe e demora fogAir s para cair
            if (this.ball.pass) { this.ball.pass.spot = { x: sx, y: sy }; this.ball.pass.fog = true; this.ball.pass.air = !!fA; this.ball.pass.airT = this.time + (fA || 0) + 0.15; }
            mt.mode = "runTo"; mt.tx = sx; mt.ty = sy; P.used.fog = (P.used.fog || 0) + 1;
            this.onEvent("log", { team: t, text: `${e.p.short} levanta para ${mt.p.short}: fogueteiro` });
            return true;
          } } }
      if (e.lift) { const L = this.time - e.lift < 1.6; e.lift = 0; // dominou a própria levantada: voleio
        if (L && this.shotEff(e) <= R.lift.fin) { e.volley = this.time; this.shoot(e, hyp(gx - e.x, H / 2 - e.y), opp.reduce((m, o) => Math.min(m, hyp(o.x - e.x, o.y - e.y)), 999)); this.shake(3, 0.15); this.fx.push({ kind: "ring", x: e.x, y: e.y, t: 0.45, team: t }); return true; } }
      const roll = (k) => { if (P.rollE === e && this.time - P.rollT < R[k].rollGap) return false; P.rollE = e; P.rollT = this.time; return (P.used[k] || 0) < R[k].max * ((this.ps(t) || {}).rep || 1) && Math.random() < R[k].p; }; // v596
      const LF = R.lift, mk = opp.find((o) => (o.x - e.x) * d > 0 && hyp(o.x - e.x, o.y - e.y) < LF.mark);
      if (mk && dep(e.x) > W * 0.5 && this.shotEff(e) <= LF.eff) {
        const a = Math.atan2(H / 2 - e.y, gx - e.x), sx = U.clamp(e.x + Math.cos(a) * LF.dist, 40, W - 40), sy = U.clamp(e.y + Math.sin(a) * LF.dist, 50, H - 50);
        if (Math.abs(gx - sx) < 30 || near(sx, sy, 40, mk) || !roll("lift")) return false;
        this.kickTo(e, sx, sy, 1.05 * LF.dist * 1.35 / C.BALL_SCALE, 4, { kind: "pass", to: e, lob: true });
        if (this.ball.pass) this.ball.pass.spot = { x: sx, y: sy };
        e.mode = "runTo"; e.tx = sx; e.ty = sy; e.lift = this.time; P.used.lift = (P.used.lift || 0) + 1;
        this.onEvent("log", { team: t, text: `${e.p.short} levanta a bola por cima de ${mk.p.short}` });
        return true;
      }
      const HX = R.hax; // v490 (Mickey): lançamento haxball, raro, erra muito, mas quando acerta é quase gol
      if (HX && dep(e.x) < W * HX.from && (P.used.hax || 0) < HX.max * ((this.ps(e.team) || {}).rep || 1) && this.time - (P.haxT ?? -9) > HX.rollGap && !near(e.x, e.y, HX.free)) {
        P.haxT = this.time;
        const m = this.field(t).filter((x) => x !== e && !x.gk && x.stun <= 0 && dep(x.x) > W * HX.mate).sort((a, b) => dep(b.x) - dep(a.x))[0];
        if (m && Math.random() < HX.p) {
          const sx = gx - d * HX.spotX, sy = H / 2 + (m.y - H / 2) * HX.spotY;
          // v491 (Mickey): o lançamento haxball vai por cima e tabela na parede do lado para cair na área
          const ok = C.HAXBALL ? this.haxKick(e, m, sx, sy, sy < H / 2 ? "top" : "bot", true, HX.err - passe * HX.errIv) : (this.kickTo(e, sx, sy, HX.speed, HX.err - passe * HX.errIv, { kind: "pass", to: m, lob: true }), true);
          if (ok) {
            if (this.ball.pass) { this.ball.pass.spot = { x: sx, y: sy }; this.ball.pass.launch = true; }
            m.mode = "runTo"; m.tx = sx; m.ty = sy; P.used.hax = (P.used.hax || 0) + 1;
            return true;
          }
        }
      }
      const LB = R.longBall;
      if (e.role === "def" && dep(e.x) < W * LB.to && !near(e.x, e.y, LB.free)) {
        const last = opp.reduce((a, o) => (!a || dep(o.x) > dep(a.x) ? o : a), null); if (!last || dep(last.x) > W * LB.high) return false; // linha alta: tem espaço atrás
        const m = this.field(t).filter((x) => (x.alaOf || x.pivo) && x.stun <= 0 && dep(x.x) > dep(last.x) - LB.line).sort((a, b) => dep(b.x) - dep(a.x))[0]; if (!m) return false;
        const sx = U.clamp(last.x + d * LB.ahead, 60, W - 60), sy = U.clamp(m.y + (H / 2 - m.y) * 0.3, 70, H - 70);
        if (Math.abs(gx - sx) < 90 || hyp(sx - e.x, sy - e.y) > LB.reach || near(sx, sy, LB.space) || !roll("longBall")) return false;
        this.kickTo(e, sx, sy, 720, 18 - passe * 0.55, { kind: "pass", to: m, lob: true });
        if (this.ball.pass) this.ball.pass.spot = { x: sx, y: sy };
        m.mode = "runTo"; m.tx = sx; m.ty = sy; P.used.longBall = (P.used.longBall || 0) + 1;
        this.onEvent("log", { team: t, text: `${e.p.short} lança ${m.p.short} nas costas da defesa` });
        return true;
      }
      return false;
    }
    // v491 (Mickey): haxball. Calcula a tabela na parede ("top"/"bot" = lado, "end" = fundo deles) para a bola cair em (tx, ty), já com o quanto a parede devolve
    haxAim(e, tx, ty, wall) {
      const HB = C.HAXBALL; let mx, my, bx, by, k;
      if (wall === "end") { const Xw = this.goalX(e.team) === W ? W : 0; mx = Xw + (Xw - tx) / HB.kEnd; my = ty; k = (Xw - e.x) / (mx - e.x); if (!(k > 0 && k < 1)) return null; bx = Xw; by = e.y + (my - e.y) * k; /* v496 (Mickey): pode bater acima do gol também (a bola passa por cima do travessão e quica) */ }
      else { const Yw = wall === "top" ? 0 : H; mx = tx; my = Yw + (Yw - ty) / HB.kSide; k = (Yw - e.y) / (my - e.y); if (!(k > 0 && k < 1)) return null; bx = e.x + (mx - e.x) * k; by = Yw; if (bx < 30 || bx > W - 30) return null; }
      const L1 = hyp(bx - e.x, by - e.y), L2 = hyp(tx - bx, ty - by); return { mx, my, bx, by, L1, L2, L: L1 + L2 };
    }
    haxKick(e, to, tx, ty, wall, lob, err) {
      const HB = C.HAXBALL, a = HB && this.haxAim(e, tx, ty, wall); if (!a) return false;
      // v496: velocidade para chegar na parede com o bastante para, depois do quique (k), chegar no ponto; longe demais (maxL) ou forte demais (maxSp): não faz (evita a bola ricocheteando rápido pelo campo)
      const end = wall === "end", v = ((end ? HB.back.arrive : HB.arrive) + 1.05 * a.L2) / (end ? HB.kEnd : HB.kSide) + 1.05 * a.L1;
      if (a.L > (lob ? HB.launchL : HB.maxL) || v > (end ? HB.back.maxSp : lob ? HB.launchSp : HB.maxSp)) return false;
      const PQ = this.ps(e.team), sh = PQ && PQ.haxShort && a.L < PQ.haxShort.L ? PQ.haxShort : null; // v603: o núcleo de quem joga com a bola no pé: haxball curto sai mais rápido e certeiro
      const sp = (v * (sh ? sh.sp : 1)) / C.BALL_SCALE; if (sh && err != null) err *= sh.err;
      this.kickTo(e, a.mx, a.my, sp, err ?? (HB.err * (sh ? sh.err : 1) - this.iv(e, "passe") * HB.errIv) * (this.x1() && C.X1.hax ? C.X1.hax.errK : 1) /* v567: no X1 o haxball sai mais fácil */, { kind: "pass", to, lob: !!lob, hax: true });
      if (this.ball.pass) { this.ball.pass.spot = { x: tx, y: ty }; this.ball.pass.hax = wall === "end" ? "end" : "side"; }
      { const SH = this.sdyn(); if (SH && SH.haxB && to) to.sdB = this.time + SH.haxB.t; } // v704 (Mickey): fez o haxball, ganha velocidade para completar
      this.onEvent("log", { team: e.team, text: to === e ? `${e.p.short} fez o ${wall === "end" ? "backboard" : "haxball"} e passou do marcador` : `${e.p.short} achou ${to.p.short} de ${wall === "end" ? "backboard" : "haxball"}` });
      return true;
    }
    // v588 (Mickey) · 4×4: CHAPÉU (bem colado, bola por cima do marcador; errou = roubo) e DRIBLE DA VACA (bola de um lado, corrida pelo outro; bola em disputa)
    trick4Go(e, o, ch) {
      const P = ch ? C.TRICK4.chapeu : C.TRICK4.vaca, d = this.dir(e.team), b = this.ball; e.trick4Cd = this.time + P.cd; this.drain(e, C.ENERGY_DRAIN_ACTION);
      if (ch && Math.random() >= U.clamp(P.base + P.k * (this.iv(e, "drible") - this.iv(o, "defesa")) / 31, P.min, P.max)) {
        e.stun = (C.STEAL_LOST ? C.STEAL_LOST.stun : 0.5) + this.st4(); if (C.STEAL_LOST) e.duelCd = Math.max(e.duelCd, C.STEAL_LOST.noTackle); o.tackT = this.time;
        b.owner = o; b.pass = null; b.vx = b.vy = 0; o.heldT = 0; o.recoverT = this.time; o.think = 0.15 * this.actF(o); o.mode = "carry"; o.tx = o.x + this.dir(o.team) * 100; o.ty = o.y;
        this.fx.push({ kind: "text", x: o.x, y: o.y - 30, text: "ROUBOU!", t: 0.9, color: "#c0081c" }); this.fx.push({ kind: "impact", x: (e.x + o.x) / 2, y: (e.y + o.y) / 2, t: 0.35 });
        this.steals[o.team]++; this.chemEv(o, "steal"); this.onEvent("tackle", { team: o.team, name: o.p.short, vs: e.p.short }); return;
      }
      const sd = e.y > o.y ? -1 : 1, tx = U.clamp(o.x + d * P.behind, 40, W - 40), ty = U.clamp(ch ? o.y : o.y + sd * P.side, 40, H - 40);
      this.kickTo(e, tx, ty, P.speed, 3, { kind: "pass", to: e, trick: true, lob: ch });
      if (ch) { b.lift = 0.4; b.ignore2 = o; b.ignore2T = P.ignore; } else o.stun = Math.max(o.stun, P.stun + this.st4());
      this.trick4 = { by: e, vs: o, name: ch ? "CHAPÉU!" : "DRIBLE DA VACA!", T: this.time };
      e.mode = "runTo"; e.tx = tx; e.ty = ch ? ty : U.clamp(o.y - sd * P.side, 40, H - 40); e.vaca = ch ? 0 : 0.3; e.think = Math.max(e.think || 0, P.hold); // segura a decisão: vai atrás da bola
    }
    selfBack(e, force) { // v499 (Mickey): em 2 de cada 10 chutes o Pivô bate na backboard para ele mesmo e chuta de novo, de primeira
      const SB = C.HAXBALL && C.HAXBALL.selfBack; if (!SB || this.training || !this.rplays || !this.rplays[e.team] || (!force && Math.random() >= SB.p * ((this.ps(e.team) || {}).back || 1))) return false; // v632: Q.back
      const d = this.dir(e.team), gx = this.goalX(e.team), dg = Math.abs(gx - e.x); if (dg > SB.maxX || dg < SB.spot[0] + 20) return false;
      const tx = gx - d * U.rand(SB.spot[0], Math.min(SB.spot[1], dg)), ty = U.clamp(e.y + (H / 2 - e.y) * SB.toMid, 60, H - 60);
      if (!this.haxKick(e, e, tx, ty, "end", false)) return false;
      if (this.ball.pass) this.ball.pass.sbb = true; e.mode = "runTo"; e.tx = tx; e.ty = ty; return true;
    }
    haxFx(x, y, end) { const p = this.ball.pass; if (!p || !p.hax || p.hb) return; p.hb = 1; this.fx.push({ kind: "text", x: U.clamp(x, 70, W - 70), y: U.clamp(y, 40, H - 40), text: end ? "BACKBOARD!" : "HAXBALL!", t: 0.9, color: "#5fd4ff" }); }
    wallPass(e, o) {
      const t = e.team, d = this.dir(t);
      const HB = C.HAXBALL; // v491 (Mickey): a tabela na parede é o haxball: calculada para cair onde ele quer, ele mesmo pega (drible); perto da linha de fundo deles, backboard
      if (HB) { const gx = this.goalX(t), XB = this.x1() && C.X1.hax, end = Math.abs(gx - e.x) < (XB ? XB.backX : HB.back.x) && Math.abs(e.y - H / 2) > GH / 2 + (XB ? XB.backY : HB.back.y); // v570 (Mickey): no X1 mais backboards
        const tx = end ? gx - d * HB.back.spot : U.clamp(e.x + d * U.rand(HB.self.reach[0], HB.self.reach[1]), 40, W - 40), ty = end ? H / 2 + Math.sign(e.y - H / 2) * (GH / 2 + 10) : U.clamp(e.y + (H / 2 - e.y) * 0.2, 40, H - 40);
        const wl = end ? "end" : (o ? o.y > e.y : e.y > H / 2) ? "top" : "bot";
        if (this.haxKick(e, e, tx, ty, wl, false)) { e.wallCd = U.rand(2.5, 4.5); e.mode = "runTo"; e.tx = tx; e.ty = ty; return; } }
      const top = o ? o.y > e.y : e.y > H / 2;
      const wy = top ? 0 : H;
      const reach = U.rand(110, 190);
      const bx = U.clamp(e.x + d * reach, 40, W - 40);
      const passe = this.iv(e, "passe");
      this.kickTo(e, bx, wy, 640, 16 - passe * 0.45, { kind: "pass", to: e, wall: true });
      e.wallCd = U.rand(2.5, 4.5);
      // corre para onde a bola volta
      e.mode = "runTo";
      e.tx = U.clamp(e.x + d * reach * 2, 40, W - 40); e.ty = e.y;
      this.onEvent("log", { team: t, text: `${e.p.short} tabelou com a parede` });
      this.fx.push({ kind: "ring", x: bx, y: wy === 0 ? 4 : H - 4, t: 0.6, team: t });
    }

    // v636 (Mickey): triangulação = Ala Def, Ala Of e Pivô trocam passes em triângulo (N passes seguidos, ~3 por partida, C.TRI3)
    tri3Live(t) { const T3 = this.tri3 && this.tri3[t], S = T3 && T3.st; if (!S) return null; const b = this.ball, o = b.owner;
      if (this.time > S.until || this.state !== "play" || b.shot || (o && !S.mem.includes(o)) || (!o && !b.pass) || (b.pass && b.pass.team !== t) || S.mem.some((m) => m.stun > 0)) { T3.st = null; return null; } return S; }
    tri3V(t, j) { const S = this.tri3[t].st, R = C.TRI3.side / Math.sqrt(3), a = S.ang + S.slot[j] * 2 * Math.PI / 3;
      return { x: U.clamp(S.cx + Math.cos(a) * R, 40, W - 40), y: U.clamp(S.cy + Math.sin(a) * R, 50, H - 50) }; }
    tri3C(S, t) { const TC = C.TRI3, og = this.ownGoalX(t), d = this.dir(t); S.cx = og + d * U.clamp(Math.abs(S.cx - og), W * TC.minX, W * TC.maxX); S.cy = U.clamp(S.cy, H * TC.yMin, H * (1 - TC.yMin)); }
    tri3Step(e, distGoal, distO) {
      const TC = C.TRI3, Q = this.ps(e.team); if (!TC || !Q || !Q.tri3 || this.training || e.gk || !(e.alaDef || e.alaOf || e.pivo)) return false;
      const t = e.team, d = this.dir(t), og = this.ownGoalX(t);
      this.tri3 ??= [0, 1].map(() => ({ n: 0, ok: 0, p: 0, next: U.rand(TC.first[0], TC.first[1]), st: null }));
      const T3 = this.tri3[t]; let S = this.tri3Live(t);
      if (!S) {
        if (this.state !== "play" || T3.n >= TC.max || this.time < T3.next || (this.combo && this.combo[t]) || (this.pplays && this.pplays[t] && this.pplays[t].st) || (this.restart && this.restart.team === t && this.time < this.restart.until)) return false;
        const dep = Math.abs(e.x - og) / W; if (dep < TC.from || dep > TC.to) return false;
        const F = this.field(t), mem = [F.find((m) => m.alaDef), F.find((m) => m.alaOf), F.find((m) => m.pivo)];
        if (mem.some((m) => !m || m.stun > 0) || !mem.includes(e)) return false;
        if (this.field(1 - t).filter((q) => !q.gk && hyp(q.x - e.x, q.y - e.y) < TC.pressR).length > 1) return false; // muito apertado: joga normal
        const ot = mem.filter((m) => m !== e), mx = (ot[0].x + ot[1].x) / 2, my = (ot[0].y + ot[1].y) / 2, L = Math.max(1, hyp(mx - e.x, my - e.y)), R = TC.side / Math.sqrt(3);
        S = { mem, slot: [0, 0, 0], cx: e.x + (mx - e.x) / L * R, cy: e.y + (my - e.y) / L * R, ang: 0, dir: Math.random() < 0.5 ? 1 : -1, k: 0, N: U.randInt ? U.randInt(TC.passes[0], TC.passes[1]) : TC.passes[0] + Math.floor(Math.random() * (TC.passes[1] - TC.passes[0] + 1)), until: this.time + TC.t };
        this.tri3C(S, t); S.ang = Math.atan2(e.y - S.cy, e.x - S.cx); const ie = mem.indexOf(e), [o1, o2] = [0, 1, 2].filter((j) => j !== ie);
        const vt = (k) => ({ x: S.cx + Math.cos(S.ang + k * 2 * Math.PI / 3) * R, y: S.cy + Math.sin(S.ang + k * 2 * Math.PI / 3) * R }), dd = (m, v) => hyp(m.x - v.x, m.y - v.y);
        S.slot[ie] = 0; if (dd(mem[o1], vt(1)) + dd(mem[o2], vt(2)) <= dd(mem[o1], vt(2)) + dd(mem[o2], vt(1))) { S.slot[o1] = 1; S.slot[o2] = 2; } else { S.slot[o1] = 2; S.slot[o2] = 1; }
        T3.st = S; T3.n++; T3.next = this.time + U.rand(TC.gap[0], TC.gap[1]);
        this.fx.push({ kind: "text", x: e.x, y: e.y - 30, text: "TRIANGULAÇÃO!", t: 1.1, color: TC.color });
        this.onEvent("log", { team: t, text: `${mem[0].p.short}, ${mem[1].p.short} e ${mem[2].p.short} fazem a triangulação` });
      }
      const i = S.mem.indexOf(e); if (i < 0) return false;
      if (S.k >= S.N) { T3.st = null; T3.ok++; e.tri3Shot = this.time; if (distGoal < TC.shotR) { this.shoot(e, distGoal, distO); return true; } return false; } // fechou: chuta com bônus ou segue o jogo
      const si = S.slot[i], nx = S.slot.indexOf((si + S.dir + 3) % 3), pv = S.slot.indexOf((si - S.dir + 3) % 3);
      let r = S.mem[nx], flip = false; const bl = (m) => this.laneBlocked(e, m);
      if (bl(r) && !bl(S.mem[pv])) { r = S.mem[pv]; flip = true; }
      const own = this.tri3V(t, i), pressed = distO < TC.pressed;
      const wait = (e.heldT || 0) < TC.hold || (!pressed && (e.heldT || 0) < TC.holdMax && hyp(r.x - this.tri3V(t, S.mem.indexOf(r)).x, r.y - this.tri3V(t, S.mem.indexOf(r)).y) > TC.ready);
      if (wait) { e.mode = "carry"; e.tx = own.x; e.ty = own.y; e.think = 0.08; return true; }
      if (flip) S.dir = -S.dir; S.cx += d * TC.adv; S.ang += S.dir * TC.spin; this.tri3C(S, t);
      const v0 = this.tri3V(t, S.mem.indexOf(r)), v = { x: r.x + (v0.x - r.x) * TC.lead, y: r.y + (v0.y - r.y) * TC.lead }, lob = bl(r); S.k++; T3.p++; // passe no caminho de quem recebe até a ponta nova; linha fechada: toque por cima do marcador
      this.kickTo(e, v.x, v.y, TC.sp, TC.err, { kind: "pass", to: r, lob });
      if (this.ball.pass) { this.ball.pass.spot = { x: v.x, y: v.y }; this.ball.pass.ens = TC.safe; this.ball.pass.tri3 = true; }
      r.mode = "runTo"; r.tx = v.x; r.ty = v.y;
      this.fx.push({ kind: "text", x: r.x, y: r.y - 26, text: String(S.k), t: 0.6, color: TC.color });
      return true;
    }
    kickTo(e, x, y, speed, errDeg, pass) {
      e.koFirst = 0; // v632
      if (pass && pass.kind === "pass" && pass.to && pass.to !== e && this.rplays && C.BOX_PLAY && this.boxOwn === e.team && hyp(this.goalX(e.team) - e.x, H / 2 - e.y) < C.BOX_PLAY.r) this.boxN = (this.boxN || 0) + 1; // v597
      const b = this.ball; b.skCol = null;
      this.chemKick(e, pass); // v577
      if (pass && pass.kind === "pass") { if (pass.trick) this.onEvent("trickGo", { team: e.team }); else { this.onEvent("pass", { team: e.team }); if (pass.to !== e) this.fx.push({ kind: "text", x: e.x, y: e.y - 30, text: "PASSE!", t: 0.6, color: "#5fd8ff" }); } this.passTry[e.team]++; } // som de passe + passes tentados · v576: drible com a bola solta toca o som do drible na hora; passe para companheiro mostra PASSE!
      e.kickT = this.time; e.kickKind = pass && pass.kind; // v204: pose de chute/passe do sprite (v210: folha de chute ou de passe)
      let a = Math.atan2(y - b.y, x - b.x);
      if (pass.kind === "pass" && !e.gk) { const qp = this.q(e, "passe"); errDeg *= this.lerpQ(C.IVX.passErrK, qp) * (!pass.sameErr && (pass.lob || hyp(x - b.x, y - b.y) > C.IVX.passLongD) ? this.lerpQ(C.IVX.passLongErr, qp) * (1 - (this.ifx(e).longPass || 0)) : 1); const F = this.ifx(e), Q = this.cItem(e); errDeg *= (1 + (F.passErr || 0)) * (1 - ((this.tfx[e.team] || {}).pass || 0)) * (Q && Q.toPivo && pass.to && pass.to.pivo ? 1 - Q.toPivo : 1) * (F.duo && pass.to && this.ifx(pass.to).duo ? 1 - F.duo : 1); this.drain(e, C.ENERGY_DRAIN_PASS); } // v524: Maestro (lançamento), Canhão, Dupla // v225: passe bom erra menos; passar cansa · v488: Passe baixo erra bem mais, lançamento mais ainda
      b.curl = null;
      a += ((Math.max(0, errDeg) * Math.PI) / 180) * U.rand(-1, 1);
      if (pass.kind === "pass" && !pass.wall && !pass.hax) speed = Math.min(speed, 220 + hyp(x - b.x, y - b.y) * 1.25);
      speed *= C.BALL_SCALE; // v448 (Mickey): bola 5% mais lenta
      b.vx = Math.cos(a) * speed; b.vy = Math.sin(a) * speed;
      if (pass.kind === "shot") { // v217: estalo no pé, onda no chão, faíscas na direção do chute e grama levantando
        const tc = this.teamRGB(e.team);
        this.fx.push({ kind: "pop", x: b.x, y: b.y, t: 0.14 }, { kind: "wave", x: b.x, y: b.y + 4, t: 0.35, r: 34, col: tc });
        this.emit(10, b.x, b.y, { col: [tc, tc, "255,255,255"], a, spread: 0.5, v0: 200, v1: 440, l0: 0.14, l1: 0.3, r0: 1.6, r1: 2.6, shape: "streak", drag: 6, air: true });
        this.emit(6, b.x, b.y + 3, { col: GRASS, a: a + Math.PI, spread: 0.9, v0: 40, v1: 120, z0: 90, z1: 180, g: 650, drag: 2, r0: 1.5, r1: 2.5, shape: "chip", air: true, l0: 0.4, l1: 0.7 });
      } else {
        this.fx.push({ kind: "wave", x: b.x, y: b.y + 4, t: 0.22, r: 16, col: "255,255,255" });
        this.emit(2, b.x, b.y + 3, { a: a + Math.PI, spread: 0.8, v0: 15, v1: 45, l0: 0.25, l1: 0.4, r0: 2, r1: 3, grow: 1.3, alpha: 0.55 });
      }
      b.owner = null; b.ignore = e; b.ignoreT = 0.18;
      // passe errado: a direção real erra o alvo por mais de 35 px (o erro vem da mira acima)
      const aim = Math.atan2(y - b.y, x - b.x), bad = Math.abs(Math.sin(a - aim)) * hyp(x - b.x, y - b.y) > 35;
      b.pass = pass.kind === "pass" ? { from: e, to: pass.to, wall: !!pass.wall, ot: !!pass.ot, team: e.team, bad, held: e.heldT || 0, lob: pass.lob ? { x: b.x, y: b.y, len: hyp(x - b.x, y - b.y) } : null,
        // v225 · passe de gênio (Passe alto; mais logo depois de um drible): atravessa a marcação sem ser cortado
        genius: (!e.gk && !pass.wall && e.legendK === "passe" && e.legendT > this.time) /* v582: passe lendário */ || !e.gk && !pass.wall && Math.random() < C.IVX.passGenius * this.q(e, "passe") ** 2 + (this.time - (e.dribT ?? -9) < C.IVX.dribAfterT ? C.IVX.dribAfterPass * Math.min(1, this.q(e, "drible")) ** 2 : 0) } : null;
      if (b.pass && this.skGenius(e, pass)) b.pass.genius = true; // v623
      if (pass.kind !== "shot") b.shot = null;
    }

    moveBall(dt) {
      const b = this.ball;
      if (b.owner) {
        if (b.owner.gk) { b.x = b.owner.x + this.dir(b.owner.team) * (b.owner.r + BALL_R); b.y = b.owner.y; }
        return;
      }
      if (b.pass && b.pass.air && this.time > (b.pass.airT ?? 0)) b.pass.air = false; // v608: depois de cair, volta a ser bola normal
      b.ignoreT -= dt; b.ignore2T = (b.ignore2T || 0) - dt; // v564: marcador driblado (caneta/vaca) não pega a bola logo
      const fr = Math.exp(-(b.shot ? 0.2 : 1.05) * dt);
      b.vx *= fr; b.vy *= fr;
      if (b.curl) { // v225: curva do chute
        if (!b.shot) b.curl = null;
        else { const st = hyp(b.vx, b.vy) * dt, r = b.curl.k * Math.min(st, b.curl.left), ca = Math.cos(r), sa = Math.sin(r); [b.vx, b.vy] = [b.vx * ca - b.vy * sa, b.vx * sa + b.vy * ca]; if ((b.curl.left -= st) <= 0) b.curl = null; }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      this.trail.push({ x: b.x, y: b.y }); if (this.trail.length > 14) this.trail.shift();
      // paredes laterais
      if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy) * 0.88; this.fx.push({ kind: "spark", x: b.x, y: 2, t: 0.25 }); this.haxFx(b.x, 34, false); }
      if (b.y > H - BALL_R) { b.y = H - BALL_R; b.vy = -Math.abs(b.vy) * 0.88; this.fx.push({ kind: "spark", x: b.x, y: H - 2, t: 0.25 }); this.haxFx(b.x, H - 34, false); } // v491: haxball
      if (b.shot && (b.y <= BALL_R || b.y >= H - BALL_R)) { b.shot = null; b.curl = null; } // v273: chute que bate na parede vira bola solta (antes ficava "chute" quicando e a defesa parada)
      // linhas de fundo
      for (const side of [0, 1]) {
        const out = side === 0 ? b.x < BALL_R : b.x > W - BALL_R;
        if (!out) continue;
        const inMouth = b.y > MOUTH_T && b.y < MOUTH_B;
        const defTeam = side === 0 ? 0 : 1;
        if (inMouth && b.shot && b.shot.goal && b.shot.team !== defTeam) return this.scoreGoal(b.shot.team);
        const over = inMouth && b.pass && b.pass.hax === "end"; // v496: backboard por cima do gol: quica na parede do fundo
        if (inMouth && !over && !(this.training && defTeam === 0)) { this.keeperCatch(this.gks[defTeam]); return; }
        if (b.shot && b.shot.team !== defTeam && !(this.training && defTeam === 0)) { b.shot = null; b.curl = null; this.onEvent("log", { team: defTeam, text: "Chute para fora · tiro de meta" }); this.keeperCatch(this.gks[defTeam]); return; } // v273: chute que sai pela linha de fundo = tiro de meta
        b.x = side === 0 ? BALL_R : W - BALL_R; b.vx = -b.vx * (C.HAXBALL ? C.HAXBALL.kEnd : 0.85); /* v496 (Mickey): a parede do fundo devolve só 25% */ this.haxFx(side === 0 ? 80 : W - 80, b.y, true); // v491: backboard
        this.fx.push({ kind: "spark", x: side === 0 ? 2 : W - 2, y: b.y, t: 0.25 });
      }
      if (this.duelMode && b.shot) {
        const sx = this.goalX(b.shot.team), left = Math.abs(sx - b.x);
        if (b.shot.post && left < BALL_R + 3) {
          // v188 · bateu na trave: volta para o campo, bola viva
          const name = b.shot.shooter?.p?.short, tm = b.shot.team, py = b.shot.ty;
          b.x = sx - this.dir(tm) * (BALL_R + 4); b.y = py + (py < H / 2 ? -1 : 1) * 2;
          b.vx = -b.vx * 0.45; b.vy = (py < H / 2 ? -1 : 1) * U.rand(60, 240);
          b.shot = null; b.pass = null; b.ignore = null;
          this.fx.push({ kind: "spark", x: sx, y: py, t: 0.25 }, { kind: "impact", x: sx, y: py, t: 0.45 });
          this.emit(14, sx, py, { col: ["255,255,255", "255,210,63"], a: this.dir(tm) > 0 ? Math.PI : 0, spread: 1.4, v0: 160, v1: 380, l0: 0.18, l1: 0.35, r0: 1.4, r1: 2.4, shape: "streak", drag: 6, air: true }); // v217
          this.fx.push({ kind: "text", x: sx - this.dir(tm) * 70, y: py + (py < H / 2 ? -14 : 30), text: "NA TRAVE!", t: 1.1, color: "#ffd23f" });
          this.shake(10, 0.4);
          this.onEvent("log", { team: tm, text: `${name} acertou a trave!` });
          return;
        }
      }
      if (b.shot && hyp(b.vx, b.vy) < 160) b.shot = null; // chute morreu: vira bola solta
      if (hyp(b.vx, b.vy) < 25) { b.vx = b.vy = 0; }
    }

    keeperCatch(g) {
      const b = this.ball;
      const wasShot = b.shot && b.shot.team !== g.team;
      if (wasShot && (b.shot.reb || Math.random() < 0.4)) { // v623: Voleio Acrobático sempre espirra
        // espalmou: bola viva de novo
        b.vx = -b.vx * 0.45; b.vy = U.rand(-1, 1) * 380;
        b.x = g.x + this.dir(g.team) * (g.r + BALL_R + 2);
        b.shot = null; b.pass = null; b.ignore = g; b.ignoreT = 0.3;
        g.saveT = this.time; g.saveKind = "parry"; // v216: animação de espalmada
        this.emit(14, b.x, b.y, { col: ["255,255,255", "255,210,63", "38,217,255"], a: Math.atan2(b.vy, b.vx), spread: 1.1, v0: 140, v1: 360, l0: 0.16, l1: 0.32, r0: 1.4, r1: 2.4, shape: "streak", drag: 6, air: true }); // v217
        this.fx.push({ kind: "wave", x: g.x, y: g.y + C.SPRITE_FEET, t: 0.4, r: 40, col: "255,255,255" });
        this.onEvent("save", { team: g.team, parry: true });
        if (this.stoppage) this.stoppage.done = true;
        this.fx.push({ kind: "text", x: g.x, y: g.y - 30, text: "ESPALMOU!", t: 1, color: "#1f5bff" });
        this.shake(7, 0.28);
        return;
      }
      b.owner = g; b.shot = null; b.pass = null; b.vx = b.vy = 0; g.possT = this.time; // v603: 3 s de posse
      g.hold = 1.8 - (g.gkStats.sb - 15) * 0.08 + (C.GK_POSS ? C.GK_POSS.hold : 0); g.hold *= (this.sdyn() || {}).gkHold || 1; // v703: 2×2/3×3 repõe mais rápido · v604: segura um pouco mais
      this.comboStart(g.team); // v600
      this.restart = { team: g.team, until: Infinity }; // tiro de meta: vale enquanto o goleiro segura e logo depois da reposição
      if (wasShot) {
        g.saveT = this.time; g.saveKind = "catch"; // v216: animação de defesa segurando
        this.fx.push({ kind: "wave", x: g.x, y: g.y + C.SPRITE_FEET, t: 0.4, r: 36, col: "38,217,255" }); // v217: mergulho levanta poeira
        this.emit(8, g.x, g.y + C.SPRITE_FEET, { spread: Math.PI, v0: 30, v1: 90, l0: 0.35, l1: 0.6, r0: 3, r1: 5, grow: 1.5, flat: 0.45, alpha: 0.7 });
        this.onEvent("save", { team: g.team, parry: false });
        this.fx.push({ kind: "text", x: g.x, y: g.y - 30, text: "DEFESA!", t: 1, color: "#26D9FF" });
      }
    }

    scoreGoal(team) {
      const gv = this.goalValue(team); this.score[team] += gv; if (this.stack) this.stack[team] = 0; // v562 (Mickey): no X1 o gol vale mais com stacks de estilo (zera ao marcar)
      if (gv > 1) this.fx.push({ kind: "text", x: this.goalX(team) - this.dir(team) * 120, y: H / 2 - 60, text: `GOL x${gv}!`, t: 1.6, color: "#ffd23f" });
      (this.goalLog || (this.goalLog = [])).push({ team, p: this.ball.shot && this.ball.shot.shooter ? this.ball.shot.shooter.p : null }); // v525: quem marcou (contratos do Olheiro e de Parceria)
      if (this.score[0] < this.score[1]) this.behind0 = true; // v525: o time 0 já esteve perdendo (Contrato de Virada)
      if (this.gks[1 - team]) this.gks[1 - team].missT = this.time; // v216: goleiro que levou o gol vai ao chão
      this.lastConceded = this.training ? 0 : 1 - team;
      const sh = this.ball.shot;
      if (sh && sh.shooter) sh.shooter.celebT = Math.max(this.time, (sh.shooter.kickT ?? -9) + (C.SPRITES[sh.shooter.p?.charId]?.anim?.shot?.d || 0)); // v204: sprite comemora (v213: depois de terminar o chute)
      this.ball.shot = null; this.ball.vx *= 0.2; this.ball.vy *= 0.2;
      this.state = "goal"; this.stateT = 1.8;
      this.flash = { team, t: 1.8, name: sh?.shooter?.p?.short || "" }; // v270: nome de quem marcou vai na faixa
      { // v217: rede balança e confete na cor do time
        const gx = this.goalX(team), d = this.dir(team), by = U.clamp(this.ball.y, MOUTH_T + 8, MOUTH_B - 8), tc = this.teamRGB(team);
        this.fx.push({ kind: "net", x: gx, d, y: by, t: 1.0 });
        this.emit(56, gx - d * 18, by, { col: [tc, tc, "255,255,255", "255,210,63"], a: d > 0 ? Math.PI : 0, spread: 1.35, v0: 60, v1: 280, z0: 160, z1: 340, g: 260, drag: 1.3, l0: 1.2, l1: 2.0, r0: 2, r1: 3.6, shape: "chip", air: true, jy: 30 });
      }
      if (this.duelMode) { // v188 · 1×1: explosão de cor no gol
        const gx = this.goalX(team), d = this.dir(team), by = U.clamp(this.ball.y, MOUTH_T, MOUTH_B);
        const parts = Array.from({ length: 34 }, () => { const a = Math.PI + (d > 0 ? 0 : Math.PI) + U.rand(-1.2, 1.2), v = U.rand(140, 420); return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: U.rand(2.5, 5) }; });
        this.fx.push({ kind: "burst", x: gx, y: by, t: 1.3, life: 1.3, team, parts }, { kind: "impact", x: gx, y: by, t: 0.5 });
        this.shake(12, 0.5);
      }
      if (sh && sh.shooter && sh.shooter.team === team) this.chemEv(sh.shooter, "goal");
      this.onEvent("goal", { team, uid: sh?.shooter?.p?.uid, name: sh?.shooter?.p?.short, chance: sh?.chance, score: [...this.score], minute: this.minute() });
    }

    checkContacts() {
      const b = this.ball;
      if (b.owner && b.owner.gk) return;
      if (!b.owner) {
        for (const e of this.ents) {
          if (e.stun > 0) continue;
          if (b.ignore === e && b.ignoreT > 0) continue;
          if (b.ignore2 === e && b.ignore2T > 0) continue; // v564
          if (b.shot && !e.gk && e.team !== b.shot.team && !(b.shot.tried || (b.shot.tried = new Set())).has(e) && hyp(b.x - e.x, b.y - e.y) <= e.r + BALL_R + 24 * (C.BLOCK ? C.BLOCK.reach : 1) + C.IVX.defReach * Math.min(1, this.q(e, "defesa"))) { // estica a perna: alcance maior que o corpo (v225: mais com Defesa alta)
            // defensor no caminho do chute: chance de bloquear (cada um tenta uma vez por chute)
            b.shot.tried.add(e);
            const sh = b.shot.shooter && !b.shot.shooter.gk ? Math.min(1, this.q(b.shot.shooter, "chute")) : 0;
            if (this.blockOk() && Math.random() < (C.BLOCK ? C.BLOCK.path : 1) * U.clamp(0.18 + this.pow(e, "defesa") / 90, 0.2, 0.6) * (this.styleKey[e.team] === "muralha" ? this.defSig(e) : 1) * this.lerpQ(C.IVX.defBlock, this.q(e, "defesa")) * (1 - C.IVX.shotDodge * sh) * (1 + (this.ifx(e).block || 0))) { // v524: Caneleira Protetora
              this.drain(e, C.ENERGY_DRAIN_ACTION);
              const sp = hyp(b.vx, b.vy) * 0.4, a = Math.atan2(-b.vy, -b.vx) + U.rand(-0.9, 0.9);
              b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.shot = null; b.pass = null; b.ignore = e; b.ignoreT = 0.25;
              this.lastBlockT = this.time; this.blockKeep(e); this.fx.push({ kind: "text", x: e.x, y: e.y - 30, text: "BLOQUEIO!", t: 0.8, color: "#ffd23f" });
              this.onEvent("log", { team: e.team, text: `${e.p.short} bloqueou o chute` });
              return;
            }
          }
          if (b.shot && !(e.gk && e.team !== b.shot.team)) continue;
          if (hyp(b.x - e.x, b.y - e.y) > (e.r + BALL_R + 3) * (!e.gk && (!b.pass || b.pass.bad) ? 1 + (this.ifx(e).loose || 0) : 1)) continue; // v524: Chuteira Arranque
          if (e.gk) {
            { const p = b.pass; if (p && p.combo && p.team !== e.team && !b.shot && (p.cSafe ??= Math.random() < ((this.ps(p.team) || {}).comboSafe || 0))) continue; } // v620: o goleiro não sai catando todo cruzamento/fogueteiro da play
            if (C.GK_POSS && this.gkLock[e.team] && !(b.shot && b.shot.team !== e.team)) continue; // v603: já gastou a posse
            if (b.shot && (b.shot.goal || b.shot.post)) continue; // vai entrar (ou vai na trave)
            return this.keeperCatch(e);
          }
          const p = b.pass;
          // bola solta: passe errado ou bola já lenta (abaixo de 200) é dominada por quem encosta, sem sorteio
          const loose = p && (p.bad || (hyp(b.vx, b.vy) < (p.tri3 ? 60 : 200) && !p.air)); // v607: fogueteiro no alto não é bola solta · v636: passe da triangulação só vira bola solta quase parado
          if (p && (p.combo || p.tri3) && p.team === e.team && p.to && p.to !== e && !loose) continue; // v600: no combo o companheiro deixa a bola passar para quem ela é · v636: idem na triangulação
          if (p && !loose && p.team !== e.team && this.noAtk[e.team] && (p.noCut ??= Math.random() < 0.55)) continue; // sem atacantes: corta poucos passes
          if (p && !loose && p.team !== e.team && p.combo && (p.cSafe ??= Math.random() < ((this.ps(p.team) || {}).comboSafe || 0))) continue; // v620 (Mickey): as plays se completam mais (parte dos passes do combo passa pela marcação)
          // reposição do goleiro: o adversário não corta no caminho (está recuado, como num tiro de meta)
          if (p && p.team !== e.team && p.from && p.from.gk && this.restartFor(p.team)) continue;
          // lançamento longo vai pelo alto: passa por cima de quem está no caminho até perto de onde cai
          if (p && p.team !== e.team && p.lob && hyp(b.x - p.lob.x, b.y - p.lob.y) < p.lob.len * (p.air ? 1.05 : 0.7)) continue; // v607: fogueteiro no alto só quem recebe pega
          // v225 · passe de gênio passa por todo mundo (o aviso aparece no primeiro marcador que ele deixa para trás)
          if (p && !loose && p.team !== e.team && p.genius) { if (!p.gShown && p.from) { p.gShown = true; this.fx.push({ kind: "text", x: p.from.x, y: p.from.y - 30, text: "PASSE DE GÊNIO!", t: 0.9, color: "#26D9FF" }); } continue; }
          // corte de passe depende de quem é melhor: defesa de quem corta contra o passe de quem tocou (tenta uma vez por defensor)
          if (p && !loose && p.team !== e.team && p.from && !p.from.gk) {
            p.tried = p.tried || new Set();
            if (p.tried.has(e)) continue;
            p.tried.add(e);
            if (Math.random() > U.clamp(0.72 * (this.pow(e, "defesa") / this.pow(p.from, "passe")) ** 2 * this.lerpQ(C.IVX.defCut, this.q(e, "defesa")), 0.25, 0.97)) continue; // v225: Defesa alta corta mais
          }
          // Toque de bola: parte dos passes atravessa a marcação (mais ainda quando vence o confronto)
          if (p && !loose && p.team !== e.team && this.styleKey[p.team] === "toque" && !p.combo /* v635: passe da play já tem o comboSafe; o atravessar do Toque não soma (Plays setadas + 1-2-2 ficava forte demais) */ && (p.thru ??= Math.random() < (this.edge[p.team] ? 0.45 : 0.2))) continue;
          if (p && !loose && p.team !== e.team && p.ens && (p.ensT ??= Math.random() < p.ens)) continue; // v635: jogada ensaiada: parte dos passes passa pela marcação (o time sabe a jogada)
          if (p && p.team === e.team && p.from) { this.passes[e.team]++; { const BQ = (this.ps(e.team) || {}).boost; if (BQ && p.from !== e && !p.from.gk) p.from.spdB = this.time + BQ.t; } if (p.from !== e && !p.from.gk) { this.pStreak ??= [0, 0]; this.pStreak[e.team]++; } /* v620: passes seguidos da posse */ { const RQ = this.ps(e.team); if (RQ && RQ.triRot && p.from !== e && !p.from.gk && !this.training) { if (RQ.futsal) this.fsTurn(e.team, RQ, p.from, e); else this.triTurn(e.team, RQ, p.from.fixo || e.fixo); } } /* v619 (Mickey): bola no pé gira o triângulo a cada passe */ /* v608 (Mickey): bola no pé completou a ação = boostzinho de corrida */ if (p.from !== e && !p.from.gk) { const TQ = (this.ps(e.team) || {}).tri; e.triOn = !!TQ && Math.random() < TQ; } if (p.wall || p.ot) this.fx.push({ kind: "text", x: e.x, y: e.y - 28, text: "TABELA!", t: 0.8, color: "#ffffff" }); e.lastFrom = p.from; e.lastFromT = this.time; e.ggT = 0; }
          else if (p && p.team !== e.team && !this.training) { this.steals[e.team]++; this.onEvent("log", { team: e.team, text: `${e.p.short} interceptou o passe` }); }
          if (p && p.combo && p.team === e.team) { const cs = (this.ps(e.team) || {}).comboSafe; if (cs) e.duelCd = Math.max(e.duelCd || 0, cs * C.COMBO.recvSafe); } if (p && p.ens && p.team === e.team) e.duelCd = Math.max(e.duelCd || 0, (C.PLAYS.pivo.ensSafe || 0)); if (p && p.tri3 && p.team === e.team && C.TRI3) e.duelCd = Math.max(e.duelCd || 0, C.TRI3.recv); /* v636: respiro na triangulação */ /* v635: quem recebe a jogada ensaiada tem um respiro */ /* v620 (Mickey): quem recebe a play tem um respiro antes do bote */ if (!(p && p.team === e.team)) { e.recoverT = this.time; if (this.pStreak) this.pStreak[0] = this.pStreak[1] = 0; } // recuperou: corte, bola solta ou rebote
          if (p && p.team === e.team && p.from && p.from.gk && !this.training) { e.duelCd = 1.2; if (this.restart) this.restart.until = this.time + 1.2; } // domínio da reposição: ninguém dá bote por 0,8 s
          b.owner = e; b.pass = null; b.shot = null; e.think = 0.12 * this.actF(e); e.mode = "carry"; e.heldT = 0; e.recvT = p && p.team === e.team ? this.time : -9; e.hax = p && (p.launch || (p.sbb && p.from === e)) && p.team === e.team ? this.time : 0; e.fog = p && p.fog && p.team === e.team ? this.time : 0; e.fakeT = p && p.fake && p.from === e ? this.time : (e.fakeT || -9); /* v591 */ e.blade = p && p.blade && p.from === e ? p.blade : null; e.bRecv = p && p.bladeTo && p.team === e.team && p.from !== e ? this.time : 0; if (e.blade || e.bRecv) { e.think = 0; e.duelCd = Math.max(e.duelCd, 0.25); } if (e.fog || e.hax) { e.think = 0; e.duelCd = Math.max(e.duelCd, 0.25); } if (p && p.combo && p.team === e.team) { e.think = 0; e.duelCd = Math.max(e.duelCd, 0.3); } /* v602: no combo recebe e já faz o próximo passo de primeira */ // v495: voleio de primeira, sem tempo de domínio // v490: dominou o lançamento haxball · v225: recvT = drible de primeira (só recebendo passe do próprio time)
          e.tx = e.x + this.dir(e.team) * 100; e.ty = e.y;
          const CH = C.REPERT && C.REPERT.chain; e.chainGo = false; // v474: tabela em cadeia: quem recebe no ataque às vezes toca de primeira
          if (CH && this.rplays && this.rplays[e.team] && p && p.team === e.team && p.from && !p.from.gk && p.from !== e) {
            const ch = this.chain[e.team], one = p.held < CH.held; ch.n = one && this.time - ch.T < CH.gap ? ch.n + 1 : one ? 1 : 0; ch.T = this.time;
            const CQ = this.ps(e.team) || {}; e.chainGo = (this.goalX(e.team) === W ? e.x : W - e.x) > W * (CQ.chainFrom ?? CH.from) && ch.n < (CQ.chainMax || CH.max) && Math.random() < Math.min(0.9, (ch.n ? CH.keep : CH.p) * (CQ.chain || 1)); // v596 · v632: bola no pé toca de primeira desde mais atrás e em cadeias maiores (chainFrom, chainMax)
          }
          return;
        }
        return;
      }
      // disputa de bola: marcador encosta no portador
      const c = b.owner;
      for (const e of this.field(1 - c.team)) {
        if (e.stun > 0 || e.duelCd > 0 || c.duelCd > 0 || e.slide > 0 || e.recov > this.time) continue; // v704: voltando para a cobertura não dá bote
        if (hyp(c.x - e.x, c.y - e.y) > c.r + e.r + 6) continue;
        this.duel(c, e);
        return;
      }
    }

    // chance de o portador c ganhar a disputa contra o marcador e (sem limites; quem chama aplica o clamp)
    duelOdds(c, e) {
      // time sem atacantes (Oblivion) é mais fácil de driblar e perde mais a bola quando conduz
      const a = (this.pow(c, "drible") * 0.65 + this.pow(c, "velocidade") * 0.35) * this.lerpQ(C.IVX.dribPow, this.q(c, "drible")) /* v488: IV de Drible pesa mais */ * (this.noAtk[c.team] && this.plan[c.team] !== "build" ? 0.9 : 1) // v197: quem constrói não tem a penalidade de condução
        * (this.time - (c.recvT ?? -9) < C.IVX.dribFirstT ? 1 + C.IVX.dribFirst * Math.min(1, this.q(c, "drible")) ** 2 : 1); // v225: drible de primeira, logo depois de receber (q²: forte só com Drible alto)
      // Toque contra o atacante isolado da 1-3-1: o bote já vem preparado (vigia), mais forte quando a 1-2-2 vence o confronto
      const ts = this.styleKey[e.team] === "toque" ? this.styles[e.team] : null;
      const sig = this.defSig(e) * (ts && this.soloAtk(c) ? (this.edge[e.team] ? ts.markWin : ts.mark) : ts && this.styleKey[c.team] === "muralha" ? ts.markTeam || 1 : 1) * ((ts && ts.duel) || 1);
      const d = (this.pow(e, "defesa") * 0.65 + this.pow(e, "fisico") * 0.35) * (this.noAtk[e.team] ? 0.85 : 1) * sig * (C.DUEL_DEF ?? 1); // v490 (Mickey): desarme vale mais que drible
      const DC = C.DICE;
      if (DC) { // v494 (Mickey): "dado" escondido tipo Baldur's Gate: d20 + pontos de Drible contra d20 + pontos de Defesa (Defesa pesa mais); o resto (estilo, drible de primeira, nível) mexe nas chances
        const lv = Math.log2(BL.levelMult(c.p.level) / BL.levelMult(e.p.level));
        const fst = this.time - (c.recvT ?? -9) < C.IVX.dribFirstT ? Math.min(1, this.q(c, "drible")) ** 2 : 0; // drible de primeira vira pontos no dado
        const atk = this.interp(DC.drib, this.iv(c, "drible")) + DC.vel * this.iv(c, "velocidade") / 31 + DC.lvl * lv + DC.first * fst;
        const def = this.interp(DC.def, this.iv(e, "defesa")) + DC.fis * this.iv(e, "fisico") / 31;
        const mom = (x) => DC.mom ? U.clamp((x.momN || 0) - DC.mom.from + 1, 0, DC.mom.max) : 0; // v559: embalo
        const sA = (this.ps(c.team) || {}).duelA || 0, sD = (this.ps(e.team) || {}).duelD || 0; /* v610 (Mickey): bola no pé mais forte no 1×1 */ const p = this.d20Win((DC.base ?? 0) + (atk - def - (DC.base ?? 0)) * (DC.statK ?? 1) + mom(c) - mom(e) + sA - sD - (this.folLow(c) ? C.X1.fol.lowPen : 0)), ma = a / (this.pow(c, "drible") * 0.65 + this.pow(c, "velocidade") * 0.35 || 1), md = d / ((this.pow(e, "defesa") * 0.65 + this.pow(e, "fisico") * 0.35) * (C.DUEL_DEF ?? 1) || 1); /* v561: sem fôlego dribla pior */
        const odds = (p / Math.max(1e-6, 1 - p)) * (ma / (this.lerpQ(C.IVX.dribPow, this.q(c, "drible")) * (1 + C.IVX.dribFirst * fst) || 1) / md) ** 4; // só os modificadores (estilo, drible de primeira, sem atacantes)
        return odds / (1 + odds);
      }
      return a ** 4 / (a ** 4 + d ** 4); // expoente 4: quem é mais forte (nível, IV) ganha bem mais disputas
    }
    // v494 · chance de d20 + m vencer d20 (empate fica com quem defende), com m fracionário interpolado
    blockKeep(o) { if (!C.BLOCK || !(Math.random() < (C.BLOCK.keep || 0))) return; const b = this.ball; b.owner = o; b.vx = b.vy = 0; b.ignore = null; b.shot = null; b.pass = null; o.heldT = 0; o.recoverT = this.time; o.think = 0.2 * this.actF(o); o.mode = "carry"; } // v550: o bloqueio às vezes já fica com a bola (sem rebote para outro chute)
    sdyn() { if (this._sd === undefined) { const n = this.field(0).length; this._sd = (!C.SMALL_DYN || this.training || this.scrimmage || this.x1() || n !== this.field(1).length) ? null : C.SMALL_DYN[n] || null; } return this._sd; } // v703: ritmo do 2×2 e 3×3 (C.SMALL_DYN)
    fitK(e) { const F = C.SMALL_FIT; if (!F || e.gk || !this.sdyn() || !e.p) return 1; const nat = e.p.position === "atacante" || e.p.position === "alaof"; return (e.role === "atk") === nat ? 1 : F.miss; } // v703 (Mickey): fora do setor natural do personagem rende menos (2×2 e 3×3)
    modeSpd() { if (this.x1()) return C.X1.speed || 1; if (this.training || this.scrimmage) return 1; const n = this.field(0).length; return (C.MODE_SPEED && n === this.field(1).length && C.MODE_SPEED[n]) || 1; } // v698 (Mickey): 2×2 e 3×3 mais rápidos (o relógio compensa, a duração não muda)
    x1() { return C.X1 && !this.training && !this.scrimmage && this.field(0).length === 1 && this.field(1).length === 1 ? C.X1 : null; } // v561: só no 1×1
    fol(e, v) { if (e.gk || !this.x1()) return; e.fol = U.clamp((e.fol ?? 100) - v, 0, 100); } // v561: gasta fôlego temporário
    addStack(t, n) { const X = this.x1(); if (!X) return; this.stack = this.stack || [0, 0]; this.stack[t] = Math.min(X.style.max, (this.stack[t] || 0) + n); } // v562 (Mickey, FIFA Street): estilo soma stacks
    goalValue(t) { const X = this.x1(), k = this.stack ? this.stack[t] || 0 : 0; return X && !this.golden ? Math.min(X.style.maxGoal, 1 + Math.floor(k / X.style.per)) : 1; } // v565 (Mickey): no gol de ouro o gol é normal (vale 1)
    x1Flair(e) { const X = this.x1(), F = X && X.flair; if (!F) return; if (Math.random() < F.k * (this.iv(e, "drible") / 31) ** F.pow) { e.flairT = this.time + U.rand(F.t[0], F.t[1]); this.fx.push({ kind: "text", x: e.x, y: e.y - 52, text: "VEM!", t: 0.8, color: "#5fd4ff" }); } } // v568 (Mickey): quem tem muito drible joga folgado: depois do drible volta para cima do marcador
    x1Knock(c, e) { // v567 (Mickey) · X1: o desarme espirra a bola para o lado oposto de onde veio o bote; quem tomou fica no chão
      const SDk = this.sdyn(), K = this.x1() ? C.X1.tackle : (this.rplays && this.rplays[c.team] && C.TACKLE4) || (SDk && SDk.tackle); if (!K) return false; /* v704: 2×2/3×3 também espirra */ /* v596 (Mickey): no 4×4 também */ const b = this.ball;
      let ax = b.x - e.x, ay = b.y - e.y; const L = hyp(ax, ay) || 1; ax /= L; ay /= L;
      const a = Math.atan2(ay, ax) + U.rand(-K.spread, K.spread), sp = U.rand(K.speed[0], K.speed[1]);
      b.owner = null; b.shot = null; b.pass = null; b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.ignore = c; b.ignoreT = K.stun; if (this.gkLock) this.gkLock[c.team] = false; /* v603: o adversário tocou */
      c.stun = K.stun ?? (C.STEAL_LOST ? C.STEAL_LOST.stun : 0.5) + this.st4(); c.mode = "idle"; e.stun = Math.max(e.stun, K.self); if (SDk && SDk.recov && !this.x1()) c.recov = this.time + c.stun + SDk.recov.t; /* v704: levanta e volta para a cobertura antes do bote */ return true;
    }
    x1ShotOk(e, distGoal) { const X = this.x1(); return !X || ((this.stack ? this.stack[e.team] || 0 : 0) >= (this.golden ? 0 : X.style.shotMin) && distGoal < X.style.shotDist); } // v565 (Mickey): no gol de ouro do X1 qualquer chute vale, sem stack
    folLow(e) { const X = this.x1(); return !!X && !e.gk && (e.fol ?? 100) < X.fol.low; }
    comboRole(e) { return e.fixo ? "fixo" : e.alaDef ? "alaDef" : e.alaOf ? "alaOf" : e.pivo ? "pivo" : e.gk ? "gk" : null; } // v600
    comboWho(t, r) { return r === "gk" ? this.gks[t] : this.field(t).find((x) => this.comboRole(x) === r && x.stun <= 0) || null; }
    comboPt(t, q, K) { if (typeof q === "string") q = (C.ZONES && C.ZONES[q]) || [0.8, 0.5]; return { x: U.clamp(this.ownGoalX(t) + this.dir(t) * q[0] * W, 30, W - 30), y: U.clamp((K.flip ? 1 - q[1] : q[1]) * H, 30, H - 30) }; }
    comboKind(K, j) { return (K.kd && K.kd[j]) || K.c.steps[j][1]; } // v607: ação sorteada do passo
    comboFrac(K, j) { const v = (K.sp && K.sp[j]) || K.c.steps[j][3]; if (typeof v !== "string") return v; const z = (C.ZONES && C.ZONES[v]) || [0.8, 0.5]; const pv = j > 0 ? this.comboFrac(K, j - 1) : null; return pv && pv[1] > 0.5 ? [z[0], 1 - z[1]] : z; } // v608 (Mickey): 1 = lado de quem está com a bola, 3 = mais longe
    comboRaw(t, K, j) { return this.comboPt(t, this.comboFrac(K, j), K); } // v607: ponto sorteado do passo
    comboTo(K, j) { return (K.to && K.to[j]) || K.c.steps[j][2]; } // v608: quem recebe pode ser sorteado
    comboFrom(K, j) { const f = K.c.steps[j][0]; return f === "*" && j > 0 ? this.comboTo(K, j - 1) : f; } // v608: "*" = quem recebeu o passo anterior
    comboFree(t, q, e) { const F = C.COMBO.free; if (!F) return q; let o = null, dm = F.r; for (const x of this.field(1 - t)) { const dd = hyp(x.x - q.x, x.y - q.y); if (dd < dm) { dm = dd; o = x; } } // v607 (Mickey): sabem a play, ficam longe do marcador
      if (!o) return q; const dd = Math.max(1, dm), sh = Math.min(F.max, (F.r - dm) * F.k * 2); return { x: U.clamp(q.x + ((q.x - o.x) / dd) * sh, 30, W - 30), y: U.clamp(q.y + ((q.y - o.y) / dd) * sh, 30, H - 30) }; }
    comboAt(t, K, j, from) { let q = this.comboRaw(t, K, j); if (this.comboTo(K, j) !== "self") q = this.comboFree(t, q);
      if (this.comboKind(K, j) === "fog") { const f = from || (j > 0 ? this.comboRaw(t, K, j - 1) : null), R = C.COMBO.fogR || 55; if (f) { const L = hyp(q.x - f.x, q.y - f.y); if (L > R) q = { x: f.x + ((q.x - f.x) * R) / L, y: f.y + ((q.y - f.y) * R) / L }; } } // v607: quem recebe o fogueteiro já fica colado em quem levanta
      return q; }
    comboSpotFor(e, K) { const r = this.comboRole(e); if (!r || r === "gk") return null;
      if (K.st === "setup") { const i = ["fixo", "alaDef", "alaOf", "pivo"].indexOf(r); return K.c.setup[i] ? this.comboPt(e.team, K.c.setup[i], K) : null; }
      for (let j = K.i; j < K.c.steps.length; j++) { const fr = this.comboFrom(K, j), to = this.comboTo(K, j); if (this.comboKind(K, j) === "shot") { if (fr === r) return null; break; } if (to === r || (to === "self" && fr === r)) return this.comboAt(e.team, K, j); } return null; }
    comboStart(t) { const Q = this.ps(t), CB = C.COMBO; if (!Q || !Q.combo || !CB || this.training || this.x1() || Math.random() >= CB.p * (Q.comboK ?? 1) * (this.edge && this.edge[1 - t] ? CB.counter : 1)) return; /* v608: Equilíbrio faz metade das plays (comboK) */ /* v601 (Mickey): o 1-2-2 incomoda o sweet spot das plays: menos combos quando o adversário countera */ const c = U.weighted(CB.list.map((x) => ({ v: x, w: x.w || 1 }))); /* v601: peso */ const pick = (v) => (Array.isArray(v) && typeof v[0] === "string" ? v[Math.floor(Math.random() * v.length)] : v); this.combo[t] = { c, i: 0, st: "setup", flip: Math.random() < 0.5, T: this.time, until: this.time + CB.wait + CB.stepT + 6, sp: c.steps.map((S) => pick(S[3])), kd: c.steps.map((S) => pick(S[1])), to: c.steps.map((S) => pick(S[2])) }; /* v607 (Mickey): sorteia ação e marcação de cada passo */ this.onEvent("log", { team: t, text: "O goleiro segura e o time arma a jogada" }); }
    comboStep(e) { // v600 (Mickey): executa o próximo passo do combo (quem está com a bola tem que ser o dono do passo; senão acaba)
      const t = e.team, K = this.combo && this.combo[t]; if (!K || K.st !== "run") return false;
      const S = K.c.steps[K.i]; if (!S || this.comboWho(t, this.comboFrom(K, K.i)) !== e) { this.combo[t] = null; return false; }
      const gx = this.goalX(t), prev = K.c.steps[K.i - 1];
      const kind = this.comboKind(K, K.i), pk = K.i > 0 ? this.comboKind(K, K.i - 1) : null;
      if (prev && pk === "fog" && K.i > 0) { e.fog = 0; this.fx.push({ kind: "text", x: e.x, y: e.y - 34, text: "FOGUETEIRO!", t: 1, color: "#ffd23f" }); this.shake(3, 0.15); if (S[1] === "shot") e.fogShot = this.time; } // v602: dominou o fogueteiro do combo
      if (kind === "shot") { this.combo[t] = null; e.comboShot = this.time; if (prev && (pk === "fog" || pk === "cross" || pk === "long")) e.volley = this.time; /* v608 (Mickey): lançamento do Fixo = voleio */
        const dO = this.field(1 - t).reduce((m, o) => Math.min(m, hyp(o.x - e.x, o.y - e.y)), 999); this.shoot(e, hyp(gx - e.x, H / 2 - e.y), dO); return true; }
      const toR = this.comboTo(K, K.i), m = toR === "self" ? e : this.comboWho(t, toR); if (!m) { this.combo[t] = null; return false; }
      let q = this.comboAt(t, K, K.i, { x: e.x, y: e.y }); const passe = e.gk ? 16 : this.iv(e, "passe"); let ok = false; const CB = C.COMBO;
      if (CB.ready && (kind === "long" || kind === "cross") && m !== e && hyp(m.x - q.x, m.y - q.y) > CB.ready[0] && this.time - (K.stepT0 ??= this.time) < CB.ready[1] && !this.field(1 - t).some((o) => hyp(o.x - e.x, o.y - e.y) < CB.backPress)) { const ux = q.x - e.x, uy = q.y - e.y, ul = hyp(ux, uy) || 1; if (K.hx == null) { K.hx = e.x; K.hy = e.y; } const sd = Math.floor((this.time - K.stepT0) / CB.holdT) % 2 ? -1 : 1; e.mode = "carry"; e.tx = U.clamp(K.hx - (uy / ul) * CB.holdR * sd + (ux / ul) * 12, 30, W - 30); e.ty = U.clamp(K.hy + (ux / ul) * CB.holdR * sd + (uy / ul) * 12, 30, H - 30); e.think = 0.1; return true; } /* v618 (Mickey vídeo): esperando quem recebe, conduz de um lado para o outro em vez de parar */ // v608 (Mickey): espera quem recebe chegar no ponto antes de lançar (se não está pressionado)
      if (kind === "back") { const ax = Math.abs(this.goalX(t) - e.x);
        const wl = S[4] === "end" ? "end" : S[4] === "top" || S[4] === "bot" ? ((S[4] === "top") !== !!K.flip ? "top" : "bot") : Math.abs(this.goalX(t) - (e.x + q.x) / 2) < 150 ? "end" : (e.y + q.y) / 2 < H / 2 ? "top" : "bot"; // v607: sem parede marcada, usa a mais perto
        const wd = wl === "end" ? ax : wl === "top" ? e.y : H - e.y;
        if ((wd > CB.backWall || hyp(q.x - e.x, q.y - e.y) > CB.backL) && this.time - (K.stepT0 ?? this.time) < CB.backT && !this.field(1 - t).some((o) => hyp(o.x - e.x, o.y - e.y) < CB.backPress)) { // v607 (Mickey): backboard de longe não: conduz para perto da parede antes
          K.stepT0 ??= this.time; const tx = wl === "end" ? this.goalX(t) - this.dir(t) * CB.backWall * 0.7 : e.x + (q.x - e.x) * 0.5, ty = wl === "end" ? e.y + (q.y - e.y) * 0.4 : wl === "top" ? CB.backWall * 0.6 : H - CB.backWall * 0.6;
          e.mode = "carry"; e.tx = U.clamp(tx, 30, W - 30); e.ty = U.clamp(ty, 30, H - 30); e.think = 0.12; return true; }
        ok = this.haxKick(e, m, q.x, q.y, wl, false, 4); }
      if (!ok) { const L = hyp(q.x - e.x, q.y - e.y), fz = CB.fogAir ? (L * 1.05) / (1 - Math.exp(-1.05 * CB.fogAir)) / C.BALL_SCALE : 300; const lz = CB.longAir ? (L * 1.05) / (1 - Math.exp(-1.05 * (CB.longAir[0] + L * CB.longAir[1]))) / C.BALL_SCALE : 780; const P = { pass: [600, 8], long: [lz, 8], fog: [fz, 3], cross: [660, 8], back: [620, 8] }[kind] || [600, 8]; /* v608 (Mickey): lançamento erra igual ao passe */ // v607: fogueteiro cai em fogAir s
        this.kickTo(e, q.x, q.y, P[0], (P[1] - passe * 0.25) * (kind === "long" ? Math.min(1, 350 / Math.max(1, L)) : 1) * (1 - ((this.ps(t) || {}).comboSafe || 0)) /* v620: play mais certeira */, { kind: "pass", to: m, lob: kind === "long" || kind === "fog" || kind === "cross", sameErr: kind === "long" }); /* v608 (Mickey): lançamento acerta como um passe normal */ if (this.ball.pass) this.ball.pass.spot = q; }
      if (m !== e) { m.mode = "runTo"; m.tx = q.x; m.ty = q.y; } else { e.mode = "runTo"; e.tx = q.x; e.ty = q.y; }
      if (this.ball.pass) { this.ball.pass.combo = true; if (kind === "fog") { this.ball.pass.fog = true; this.ball.pass.air = true; this.ball.pass.airT = this.time + CB.fogAir + 0.15; } if (kind === "long" && this.ball.pass.lob) { this.ball.pass.lob.h = C.COMBO.longH; if (CB.longAir) { this.ball.pass.air = true; this.ball.pass.airT = this.time + CB.longAir[0] + this.ball.pass.lob.len * CB.longAir[1] + 0.15; } } } K.i++; K.stepT0 = null; K.hx = K.hy = null; K.until = this.time + C.COMBO.stepT; K.kickT = this.time;
      this.onEvent("log", { team: t, text: `Combo: ${e.p ? e.p.short : "Goleiro"} ${({ pass: "toca", long: "lança", fog: "levanta (fogueteiro)", cross: "cruza", back: "faz o back" })[kind] || "toca"} para ${m === e ? "ele mesmo" : m.p.short}` });
      return true;
    }
    gkTrack() { // v603 (Mickey): uma posse por goleiro; soltou = só volta a pegar quando o adversário tocar na bola
      const b = this.ball, o = b.owner, pv = this.gkPrev, L = this.gkLock;
      if (pv && pv.gk && o !== pv) L[pv.team] = true;
      if (o) L[1 - o.team] = false; else if (b.ignore && b.ignoreT > 0 && b.ignore.team != null) L[1 - b.ignore.team] = false;
      this.gkPrev = o;
    }
    triTurn(t, RQ, fx) { // v619 (Mickey, desenho): Ala Def, Ala Of e Pivô giram de posição a cada passe (Def → Pivô → Ala Of → Def); às vezes o Fixo entra na roda e ataca
      this.triPerm ??= [[0, 1, 2, 3], [0, 1, 2, 3]]; const P = this.triPerm[t], four = Math.random() < (RQ.fixoAtk || 0) * (fx ? 1.5 : 1), nx = four ? { 0: 1, 1: 3, 3: 2, 2: 0 } : { 0: 0, 1: 3, 3: 2, 2: 1 };
      if (!four && P[0] !== 0) { this.triPerm[t] = [0, 1, 2, 3]; return; } /* Fixo que subiu volta para trás no passe seguinte */ this.triPerm[t] = P.map((v) => nx[v]); }
    shufSlot(t, s, k) { const P = [[0, 1, 2, 3], [3, 1, 2, 0], [1, 0, 3, 2], [2, 3, 0, 1], [0, 2, 1, 3], [3, 2, 1, 0], [1, 3, 0, 2], [2, 0, 3, 1]], i = ((k * 7 + t * 3 + (this.seedRot || 0)) % P.length + P.length) % P.length; return P[i][s] ?? s; } // v603 (Mickey): bola no pé troca de posição (Fixo atacando, Pivô defendendo)
    // v632 (Mickey, livro "Fundamentos técnicos e táticos do futsal"): rodízios da bola no pé. Vagas do losango: 0 Fixo, 1 ala de cima, 2 ala de baixo, 3 Pivô.
    // oito = Fixo e alas trocam (quem passa vai para a vaga de quem recebe); oitoInv = alas e Pivô trocam; xPass = diagonal do passe (troca com quem recebe, os 4);
    // xOpp = diagonal oposta ao passe (quem passa vai para a vaga oposta à de quem recebeu); roda = os 4 giram uma vaga no mesmo sentido; tri = giro antigo do triângulo (v619)
    fsTurn(t, RQ, from, to) {
      const FS = RQ.futsal; this.triPerm ??= [[0, 1, 2, 3], [0, 1, 2, 3]]; this.fsPat ??= [null, null]; this.fsLast ??= [-9, -9];
      if (!this.fsPat[t] || this.time - this.fsLast[t] > FS.newT) { const ks = Object.keys(FS.pats); this.fsPat[t] = U.weighted(ks.map((k) => ({ v: k, w: FS.pats[k] }))); this.fsDir = Math.random() < 0.5 ? 1 : -1; }
      this.fsLast[t] = this.time; const pat = this.fsPat[t]; if (pat === "tri") return this.triTurn(t, RQ, from.fixo || to.fixo);
      const P = this.triPerm[t], a = P[from.slot], bb = P[to.slot]; if (a == null || bb == null) return;
      const swap = (x, y) => { const i = P.indexOf(x), j = P.indexOf(y); if (i >= 0 && j >= 0) { P[i] = y; P[j] = x; } };
      if (FS.shape === "q") { // v635 (Mickey, vídeo do 2x2 e livro-1): vert = troca vertical no lado de quem recebeu; diag = quem passou corta na diagonal do quadrado; redondo = os 4 giram uma vaga
        const lane = { 0: 3, 3: 0, 1: 2, 2: 1 }, dia = { 0: 2, 2: 0, 1: 3, 3: 1 };
        if (pat === "vert") swap(bb, lane[bb]);
        else if (pat === "diag") swap(a, dia[a] === bb ? bb : dia[a]);
        else if (pat === "redondo") { const cyc = this.fsDir > 0 ? { 0: 3, 3: 2, 2: 1, 1: 0 } : { 0: 1, 1: 2, 2: 3, 3: 0 }; this.triPerm[t] = P.map((v) => cyc[v]); }
        this.fsSwap = this.time; return; }
      const back3 = (v) => v !== 3, front3 = (v) => v !== 0;
      if (pat === "oito") { if (back3(a) && back3(bb)) swap(a, bb); }
      else if (pat === "oitoInv") { if (front3(a) && front3(bb)) swap(a, bb); }
      else if (pat === "xPass") swap(a, bb);
      else if (pat === "xOpp") { const op = { 0: 3, 3: 0, 1: 2, 2: 1 }[bb]; if (op !== a) swap(a, op); }
      else if (pat === "roda") { const cyc = this.fsDir > 0 ? { 0: 1, 1: 3, 3: 2, 2: 0 } : { 0: 2, 2: 3, 3: 1, 1: 0 }; this.triPerm[t] = P.map((v) => cyc[v]); }
      this.fsSwap = this.time;
    }
    // ponto de cada vaga do losango, junto com a bola (o portador fica onde está; as outras vagas dão apoio atrás, amplitude nas alas e profundidade no Pivô)
    fsSpot(t, v) {
      const FS = (this.ps(t) || {}).futsal, b = this.ball; if (!FS) return null;
      if (FS.shape === "q") { const Q = FS.q, d = this.dir(t), og = this.ownGoalX(t), bd = (b.x - og) * d, cy = H / 2 + (b.y - H / 2) * Q.follow, back = v === 0 || v === 1, top = v === 0 || v === 3; // v635 (Mickey, vídeo do 2x2): quadrado = 0 atrás em cima, 1 atrás embaixo, 2 na frente embaixo, 3 na frente em cima, andando com a bola
        const dep = back ? U.clamp(bd - Q.back, W * Q.backMin, W * Q.backMax) : U.clamp(Math.max(bd + Q.front, W * Q.frontMin), W * 0.1, W - Q.goal);
        return { x: og + d * dep, y: U.clamp(cy + (top ? -1 : 1) * H * Q.wide, 50, H - 50) }; }
      const d = this.dir(t), og = this.ownGoalX(t), X = (dep) => og + d * U.clamp(dep, W * 0.1, W - FS.pivoGoal), bd = (b.x - og) * d, side = b.y < H * FS.wingY ? -1 : b.y > H * (1 - FS.wingY) ? 1 : 0;
      if (v === 0) return { x: X(Math.min(bd - FS.fixoBack, W * FS.fixoMax)), y: H / 2 + (b.y - H / 2) * FS.fixoFollow };
      if (v === 3) return { x: X(Math.max(bd + FS.pivoAhead, W * FS.pivoMin)), y: H / 2 + (b.y - H / 2) * FS.pivoFollow };
      const top = v === 1, mySide = top ? -1 : 1;
      if (side === mySide) return { x: X(bd + FS.wingDeep), y: top ? H * FS.wingLane : H * (1 - FS.wingLane) }; // ala do lado da bola: profundidade pela lateral
      if (side === -mySide) return { x: X(bd + FS.closeAhead), y: H / 2 + mySide * H * FS.closeY }; // ala oposto fecha para o meio
      return { x: X(bd + FS.alaAhead), y: top ? H * FS.alaLane : H * (1 - FS.alaLane) };
    }
    // marcação por zona do futsal: bola no meio = losango (Pivô na ponta, alas nos lados, Fixo atrás); bola na ala = triângulo (ala do lado sobe na bola, Pivô e ala oposto fecham o meio, Fixo cobre)
    fsZone(e, fx) {
      const t = e.team, Z = this.fsZ(t), b = this.ball, d = this.dir(t), og = this.ownGoalX(t), X = (dep) => og + d * U.clamp(dep, W * 0.08, W * 0.7); if (!Z) return null;
      const side = b.y < H * Z.wingY ? -1 : b.y > H * (1 - Z.wingY) ? 1 : 0, cy = H / 2 + (b.y - H / 2) * Z.follow;
      const alas = this.field(t).filter((m) => (m.alaOf || m.alaDef) && m.slot != null), near = side && alas.length === 2 ? alas.slice().sort((p, q) => Math.abs(p.y - b.y) - Math.abs(q.y - b.y))[0] : null;
      const mk = this.markOf(t), mid = mk && mk.id; if (mid === "22") return null; // v634 (Mickey): a defesa continua com a cara da formação: 1-2-2 = quadrado 2-2 (o quadrado de sempre, que bascula com a bola)
      if (mid === "31d" && Z.d31) { const D = Z.d31; // v634 (Mickey): 1-3-1 = 3-1 defensivo do futsal: Fixo e alas numa linha de 3 que bascula para o lado da bola, ala do lado sobe na bola na ala, Pivô sozinho na frente cortando o passe para o meio
        if (e.pivo) return { x: X(fx + D.pivoUp), y: H / 2 + (b.y - H / 2) * D.pivoFollow };
        const lx = fx - D.back, ly = H / 2 + (b.y - H / 2) * D.follow;
        if (e.fixo) return { x: X(lx - (side ? D.fixoDrop : 0)), y: U.clamp(ly + side * D.fixoSide, 60, H - 60) };
        const top = alas.length === 2 ? e === alas.slice().sort((p, q) => p.y - q.y)[0] : e.y < ly;
        if (side && e === near) return { x: X(lx + D.nearUp), y: U.clamp(b.y - side * D.nearIn, 40, H - 40) };
        if (side) return { x: X(lx - D.farDrop), y: H / 2 + side * D.farY };
        return { x: X(lx), y: U.clamp(ly + (top ? -1 : 1) * D.alaY, 40, H - 40) }; }
      if (e.pivo) return side ? { x: X(fx - Z.pivoDrop), y: H / 2 + side * Z.midY } : { x: X(fx), y: cy };
      if (e.fixo) return { x: X(fx - Z.back), y: side ? H / 2 + side * Z.fixoSide : cy };
      if (!side) { const top = alas.length === 2 ? e === alas.slice().sort((p, q) => p.y - q.y)[0] : e.y < cy; return { x: X(fx - Z.alaBack), y: cy + (top ? -1 : 1) * Z.alaY }; }
      if (e === near) return { x: X(fx - Z.nearBack), y: U.clamp(b.y - side * Z.nearIn, 40, H - 40) };
      return { x: X(fx - Z.farBack), y: H / 2 + side * Z.farY }; // ala oposto fecha o meio (leque)
    }
    fsZ(t) { const F = (this.ps(t) || {}).futsal, z = F && F.zone; return typeof z === "string" ? (((C.PLAY_STYLE || {})[z] || {}).futsal || {}).zone || null : z || null; } // v635
    ps(t) { return (this.rplays && this.rplays[t] && C.PLAY_STYLE && C.PLAY_STYLE[this.atk[t] || "rot"]) || null; } // v597: preset do Com a bola // v596: plays por estilo da formação (4×4)
    st4() { return this.rplays && this.rplays[0] ? C.STUN4_ADD || 0 : 0; } // v596: +stun no 4×4
    blockOk() { return !C.BLOCK || !C.BLOCK.gap || this.time - (this.lastBlockT ?? -99) >= C.BLOCK.gap; } // v550 (Mickey): um bloqueio por lance
    d20Win(m) { const f = (k) => { let n = 0; for (let x = -19; x <= 19; x++) if (x + k > 0) n += 20 - Math.abs(x); return n / 400; }; const k0 = Math.floor(m); return f(k0) + (f(k0 + 1) - f(k0)) * (m - k0); }

    // v488 · quantos dribles seguidos c já fez sem perder a bola (nem passar e receber de volta)
    dribChainN(c) { const t = c.dribT ?? -9; return this.time - t < C.IVX.dribChainT && (c.recvT ?? -9) < t && (c.recoverT ?? -9) < t ? c.dribN || 0 : 0; }
    dribChainK(c) { const X = this.x1(), k = (X && X.chain) || C.IVX.dribChain; /* v564: no X1 dribles seguidos cansam menos */ return k[Math.min(k.length - 1, this.dribChainN(c))]; }

    duel(c, e) {
      this.hotT = this.time; // v455: drible/desarme = jogo disputado
      { const X = this.x1(), CK = X && X.cook; // v568 (Mickey): cozinhando ou de firula, chama o bote e tira a bola no último segundo
        if (CK && (c.cooking || c.flairOn) && Math.random() < CK.dodge * (0.4 + this.iv(c, "drible") / 31) * (c.cooking ? 1 : CK.flairK)) {
          e.stun = Math.max(e.stun, CK.stun); c.duelCd = e.duelCd = 0.7; this.fol(c, CK.cost); this.addStack(c.team, X.style.humilN);
          const a = Math.atan2(e.y - c.y, e.x - c.x); e.vx = Math.cos(a) * 140; e.vy = Math.sin(a) * 140;
          this.fx.push({ kind: "text", x: c.x, y: c.y - 30, text: "NO ÚLTIMO SEGUNDO!", t: 0.9, color: "#9dff6a" }); this.fx.push({ kind: "swoosh", x: c.x, y: c.y, t: 0.4, col: this.teamRGB(c.team), d: this.dir(c.team) }); this.shake(5, 0.2);
          this.chemEv(c, "drib"); this.onEvent("dribble", { team: c.team, name: c.p.short, vs: e.p.short }); this.x1Flair(c); if (X.boost) { c.burst = Math.max(c.burst, X.boost); c.dribSlow = false; } return; } }
      let p = (1 - (1 - U.clamp(this.duelOdds(c, e), C.DICE ? C.DICE.min : 0.08, C.DICE ? C.DICE.max : 0.92)) * (this.pfx.tackle || 1)) * this.dribChainK(c) * ((this.x1() || {}).atk || 1); // v564: X1 mais drible
      { const A = this.ifx(c), D = this.ifx(e); // v524: efeitos dos equipamentos no duelo
        p *= (1 + (A.dribK || 0)) * (1 + (A.chain || 0) * Math.min(A.chainMax || 0, this.dribChainN(c))) * (1 - (D.shadow || 0)) * this.captK(c.team); // Sangue Frio, Ritmo, Sombra, Capitão
        p = U.clamp(1 - (1 - p) * (1 + (D.tackle || 0) + ((this.tfx[e.team] || {}).tackle || 0)) * this.captK(e.team), 0.02, 0.98); } // Teimosa, Capitão // v312: na Street o bote erra mais · v488: dribles seguidos ficam mais difíceis
      p = this.skDribP(c, p); // v623: Drible do Monstro
      c.duelCd = e.duelCd = 0.9 * ((this.sdyn() || {}).duelCd || 1); this.fol(c, C.X1 ? C.X1.fol.drib : 0); /* v703 */ // v561: driblar gasta fôlego (X1)
      this.drain(c, C.ENERGY_DRAIN_ACTION); this.drain(e, C.ENERGY_DRAIN_ACTION + C.ENERGY_DRAIN_TACKLE); // v225: bote com custo
      if (this.noAtk[e.team] && (C.BLOCK.duelGap === false || this.blockOk()) && Math.random() >= p && Math.random() < 0.6) {
        // time sem atacantes: na maioria das vezes o bote só segura o portador (às vezes ainda rouba)
        // time sem atacantes: o bote só segura o portador, a posse continua com quem ataca
        c.stun = 0.35; this.lastBlockT = this.time;
        this.fx.push({ kind: "text", x: e.x, y: e.y - 30, text: "BLOQUEIO!", t: 0.8, color: "#ffd23f" });
        return;
      }
      const cr = C.DICE && C.DICE.crit ? Math.random() : 1, crit = cr < C.DICE.crit ? 1 : cr < 2 * C.DICE.crit ? -1 : 0; // v559 (Mickey): crítico escondido para os dois lados
      const won = this.skDodge(c) /* v623: Arrancada da Pantera */ || (c.legendK === "drible" && c.legendT > this.time) /* v582: drible lendário */ || (crit ? crit > 0 : Math.random() < p), D = this.ifx(e);
      { const DM = C.DICE && C.DICE.mom, w = won ? c : e, l = won ? e : c; w.momN = (w.momN || 0) + 1; l.momN = 0; // v559: embalo
 } // v560 (Mickey): sem texto de embalo
      this.skDribWon(c, won);
      if (won && D.lastLine && e.energy > D.lastLine && e.llHalf !== this.half) { // v524: Caneleira Última Linha: o 1º duelo perdido no tempo vira empate
        e.llHalf = this.half; c.stun = 0.35;
        this.fx.push({ kind: "text", x: e.x, y: e.y - 30, text: "ÚLTIMA LINHA!", t: 0.8, color: "#ffd23f" });
        return;
      }
      if (won) {
        if (D.thorn && !this.training && !this.scrimmage) c.energy = Math.max(0, c.energy - D.thorn); // v524: Caneleira Espinho
        c.dribN = this.dribChainN(c) + 1; c.burst = 0.7; if (C.DRIB_SLOW) c.dribSlow = true; e.stun = (C.TACKLE_MISS_STUN + this.st4()) * ((this.sdyn() || {}).stun || 1); c.dribT = this.time; c.duelCd = C.DRIB_GRACE; // v443 (Mickey): os outros marcadores já podem dar o bote logo depois do drible // v204: giro do sprite no drible
        e.stun *= (1 + (this.ifx(c).dribStun || 0)) * (1 - (D.glue || 0)); // v524: Chuteira Afiada / Caneleira Gruda
        this.drain(e, C.TACKLE_MISS_DRAIN); c.think = Math.min(c.think, 0.3 - 0.25 * Math.min(1, this.q(c, "drible")) ** 2); // v225: bote errado cansa e deixa no chão; Drible alto já decide o próximo lance
        const ang = Math.atan2(e.y - c.y, e.x - c.x);
        e.vx = Math.cos(ang) * 120; e.vy = Math.sin(ang) * 120;
        c.tx = U.clamp(c.x + this.dir(c.team) * 160, 30, W - 30);
        let name = "DRIBLE!";
        if (crit > 0) e.stun *= C.DICE.critStun || 1; // v559: crítico deixa o marcador mais tempo no chão
        if (this.duelMode) { // v188 · 1×1: o drible ganha nome
          name = C.DUEL_MOVES[Math.floor(Math.random() * C.DUEL_MOVES.length)];
          if (name === "CHAPÉU!") this.ball.lift = 0.4; // bola sobe por cima do marcador
          this.fx.push({ kind: "impact", x: (c.x + e.x) / 2, y: (c.y + e.y) / 2, t: 0.35 });
        }
        if (crit > 0) name = "CRÍTICO!";
        if (C.X1) this.addStack(c.team, crit > 0 || C.X1.style.humil.includes(name) ? C.X1.style.humilN : C.X1.style.drib); // v562: drible soma estilo, humilhação soma mais
        this.fx.push({ kind: "text", x: c.x, y: c.y - 30, text: name, t: 0.9, color: crit > 0 ? "#ffd23f" : "#9dff6a" });
        this.fx.push({ kind: "swoosh", x: c.x, y: c.y, t: 0.4, col: this.teamRGB(c.team), d: this.dir(c.team) }); // v217: rastro curvo do drible
        this.emit(7, c.x, c.y, { col: ["157,255,106", "255,255,255"], spread: Math.PI, v0: 80, v1: 220, l0: 0.18, l1: 0.35, r0: 1.4, r1: 2.2, shape: "streak", drag: 6, air: true });
        this.shake(5, 0.22);
        this.chemEv(c, "drib"); this.onEvent("dribble", { team: c.team, name: c.p.short, vs: e.p.short }); this.x1Flair(c); if (this.x1() && C.X1.boost) { c.burst = Math.max(c.burst, C.X1.boost); c.dribSlow = false; } // v570: boost depois do drible
      } else {
        c.stun = ((C.STEAL_LOST ? C.STEAL_LOST.stun : 0.5) + this.st4()) * ((this.sdyn() || {}).stun || 1); if (C.STEAL_LOST) c.duelCd = Math.max(c.duelCd, C.STEAL_LOST.noTackle); e.tackT = this.time; // v204: bote do sprite · v550 (Mickey): quem perdeu a bola fica 1 s sem tentar roubo
        if (!this.x1Knock(c, e)) { this.ball.owner = e; e.heldT = 0; e.recoverT = this.time; e.think = 0.15 * this.actF(e); e.mode = "carry"; e.tx = e.x + this.dir(e.team) * 100; e.ty = e.y; }
        if (crit < 0) c.stun *= C.DICE.critStun || 1; // v559: roubo limpo
        this.fx.push({ kind: "text", x: e.x, y: e.y - 30, text: crit < 0 ? "ROUBO LIMPO!" : "ROUBOU!", t: 0.9, color: crit < 0 ? "#ffd23f" : "#c0081c" });
        { const mx = (c.x + e.x) / 2, my = (c.y + e.y) / 2; // v217: faíscas e grama no choque
          this.emit(9, mx, my, { col: ["255,90,110", "255,255,255"], spread: Math.PI, v0: 120, v1: 300, l0: 0.16, l1: 0.32, r0: 1.4, r1: 2.4, shape: "streak", drag: 6, air: true });
          this.emit(6, mx, my + C.SPRITE_FEET, { col: GRASS, spread: Math.PI, v0: 40, v1: 110, z0: 80, z1: 160, g: 650, drag: 2, r0: 1.4, r1: 2.4, shape: "chip", air: true, l0: 0.4, l1: 0.7 }); }
        if (this.duelMode) this.fx.push({ kind: "impact", x: (c.x + e.x) / 2, y: (c.y + e.y) / 2, t: 0.35 });
        this.shake(7, 0.3);
        this.steals[e.team]++;
        this.chemEv(e, "steal"); this.onEvent("tackle", { team: e.team, name: e.p.short, vs: c.p.short });
      }
    }

    // v188 · 1×1: carrinho. Arranque curto na direção de onde o portador vai estar; se acertar, a bola espirra;
    // se errar, quem deu o carrinho fica no chão
    startSlide(e, c) {
      const ax = c.x + (c.vx || 0) * 0.18, ay = c.y + (c.vy || 0) * 0.18, a = Math.atan2(ay - e.y, ax - e.x);
      e.slide = 0.3; e.slideA = a; e.slideT = this.time; e.slideCd = U.rand(2.2, 3.2); e.mode = "slide";
      e.vx = Math.cos(a) * C.DUEL_SLIDE_SPEED; e.vy = Math.sin(a) * C.DUEL_SLIDE_SPEED;
    }
    slideStep(e, dt) {
      e.slide -= dt; e.x += e.vx * dt; e.y += e.vy * dt; this.clampEnt(e);
      if (Math.random() < 0.6) { // v217: o carrinho levanta poeira e grama atrás
        const bx = e.x - Math.cos(e.slideA) * 10, by = e.y + C.SPRITE_FEET - 4;
        this.emit(1, bx, by, { a: e.slideA + Math.PI, spread: 0.7, v0: 20, v1: 60, l0: 0.35, l1: 0.55, r0: 3, r1: 5, grow: 1.5, alpha: 0.7, jx: 4, jy: 3 });
        this.emit(1, bx, by, { col: GRASS, a: e.slideA + Math.PI, spread: 0.8, v0: 40, v1: 110, z0: 60, z1: 140, g: 650, drag: 2, r0: 1.4, r1: 2.4, shape: "chip", air: true, l0: 0.35, l1: 0.6 });
      }
      const c = this.ball.owner;
      if (c && !c.gk && c.team !== e.team && hyp(c.x - e.x, c.y - e.y) < c.r + e.r + 8) return this.slideHit(e, c);
      if (e.slide <= 0) { e.slide = 0; e.stun = 0.55; e.vx *= 0.3; e.vy *= 0.3; } // passou batido: fica no chão
    }
    slideHit(e, c) {
      e.slide = 0; c.duelCd = e.duelCd = 0.9;
      this.drain(c, C.ENERGY_DRAIN_ACTION); this.drain(e, C.ENERGY_DRAIN_ACTION + C.ENERGY_DRAIN_TACKLE);
      // mesma conta do bote (com a marca de cada formação), mas por trás é mais difícil acertar a bola
      const p = U.clamp((1 - this.duelOdds(c, e)) * C.DUEL_SLIDE_WIN, 0.06, 0.85) * (this.pfx.tackle || 1); // v312: Street
      const mx = (c.x + e.x) / 2, my = (c.y + e.y) / 2;
      this.fx.push({ kind: "impact", x: mx, y: my, t: 0.4 });
      this.emit(10, mx, my + C.SPRITE_FEET, { col: GRASS, a: e.slideA, spread: 1.0, v0: 60, v1: 160, z0: 90, z1: 190, g: 650, drag: 2, r0: 1.5, r1: 2.6, shape: "chip", air: true, l0: 0.45, l1: 0.8 }); // v217
      if (Math.random() < p) {
        // acertou: a bola espirra para a frente do carrinho e vira bola solta (quem levanta primeiro fica com ela)
        const b = this.ball, ba = e.slideA + U.rand(-0.5, 0.5), sp = U.rand(170, 240);
        b.owner = null; b.shot = null; b.pass = null; b.x = mx; b.y = my; b.vx = Math.cos(ba) * sp; b.vy = Math.sin(ba) * sp; b.ignore = c; b.ignoreT = 0.35;
        c.stun = 0.5; e.stun = 0.25; e.vx *= 0.2; e.vy *= 0.2;
        this.steals[e.team]++;
        this.fx.push({ kind: "text", x: e.x, y: e.y - 30, text: "CARRINHO!", t: 0.9, color: "#c0081c" });
        this.shake(9, 0.35);
        this.chemEv(e, "steal"); this.onEvent("tackle", { team: e.team, name: e.p.short, vs: c.p.short });
      } else {
        // pulou o carrinho: segue em velocidade e quem tentou fica no chão
        e.stun = 0.9 + this.st4(); e.vx *= 0.3; e.vy *= 0.3; c.burst = 0.6; if (C.DRIB_SLOW) c.dribSlow = true; c.dribN = this.dribChainN(c) + 1; c.dribT = this.time; c.duelCd = C.DRIB_GRACE; // v443
        this.fx.push({ kind: "text", x: c.x, y: c.y - 30, text: "PULOU O CARRINHO!", t: 0.9, color: "#9dff6a" });
        this.shake(5, 0.22);
        this.chemEv(c, "drib"); this.onEvent("dribble", { team: c.team, name: c.p.short, vs: e.p.short });
      }
    }

    clampEnt(e) { e.x = U.clamp(e.x, e.r, W - e.r); e.y = U.clamp(e.y, e.r, H - e.r); }

    minute() {
      if (this.golden) return "GG";
      return Math.min(45, Math.floor((this.clock / this.halfSec) * 45)) + (this.half - 1) * 45;
    }
    possessionPct() {
      const tot = this.poss[0] + this.poss[1];
      return tot ? Math.round((this.poss[0] / tot) * 100) : 50;
    }

    // ---------- desenho ----------
    // v204 · sprite em pixel art (Mickey: "como no Pokémon"), sempre no referencial "olhando para a direita"
    // (o espelho vira para a esquerda): pés no chão em (x, y + SPRITE_FEET). fi/n = quadro fi de uma folha com n quadros (v208)
    spriteAt(ctx, im, x, y, face, rot = 0, ox = 0, oy = 0, sx = 1, sy = 1, fi = 0, n = 1, px = C.SPRITE_PX, ol = null) {
      const fw = im.width / n, hh = im.height * px, ww = fw * px;
      ctx.save(); ctx.translate(x, y + C.SPRITE_FEET); ctx.scale(face, 1); ctx.translate(ox, oy); ctx.rotate(rot); ctx.scale(sx, sy);
      ctx.imageSmoothingEnabled = px < 1;
      if (ol) { // v355 (Mickey): contorno na cor do time = silhueta pintada desenhada em 8 direções por baixo do quadro
        const sil = silhouette(im, ol), d = C.SPRITE_OUTLINE;
        for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; ctx.drawImage(sil, fi * fw, 0, fw, im.height, -ww / 2 + Math.cos(a) * d, -hh + Math.sin(a) * d, ww, hh); }
      }
      ctx.drawImage(im, fi * fw, 0, fw, im.height, -ww / 2, -hh, ww, hh); ctx.restore();
    }
    // anel com a cor do time nos pés (identifica o lado), vira para onde corre, corrida quadro a quadro (v208, folha "run"),
    // respira parado, e poses para chute/passe, drible (giro), roubo (bote), carrinho (deitado), atordoado (balança) e gol (pulos).
    // Chute, passe, bote e carrinho usam o desenho do chute ("field"); o resto usa a folha de corrida quando o personagem tem uma.
    drawSprite(ctx, e, im, col, hasBall, boss) {
      const now = this.time, A = (t, d) => (t !== undefined && now - t < d ? (now - t) / d : -1);
      // v211: vira de lado no máximo a cada 0,2 s (antes piscava esquerda/direita quando corria quase na vertical)
      const sid = e.gk ? C.GK_SPRITE : e.p.charId; // v216: goleiro usa o sprite genérico
      const gv = e.gk ? Math.abs(e.y - (e.prevY ?? e.y)) / Math.max(1e-3, now - (e.drawT ?? now)) : 0; if (e.gk) e.prevY = e.y; // o goleiro anda sem vx/vy
      if (e.gk) e.face = this.dir(e.team); // sempre de frente para o campo
      else if (Math.abs(e.vx || 0) > 25 && !(e.stun > 0) && (e.vx > 0 ? 1 : -1) !== e.face && !(now - (e.faceT ?? -9) < 0.2)) { e.face = e.vx > 0 ? 1 : -1; e.faceT = now; } else if (!e.face) e.face = this.dir(e.team);
      const seed = e.seed ?? (e.seed = Math.random() * 6.3), ph = now * 13 + seed;
      // v211: parado/correndo com histerese e tempo mínimo (antes trocava de folha a cada oscilação da velocidade)
      const sp0 = Math.min(1, (e.gk ? gv : hyp(e.vx || 0, e.vy || 0)) / 160);
      if ((e.mv ? sp0 < 0.08 : sp0 > 0.2) && !(now - (e.mvT ?? -9) < 0.15)) { e.mv = !e.mv; e.mvT = now; }
      const run = e.mv ? Math.max(sp0, 0.16) : Math.min(sp0, 0.15);
      const sp = C.SPRITES[sid], sheet = BL.spriteImg(sid, "run"), N = sp.runFrames || 1;
      const dt = U.clamp(now - (e.drawT ?? now), 0, 0.1); e.drawT = now;
      let rot = 0, ox = 0, oy = 0, sx = 1, sy = 1, k, pose = false, moving = false;
      // v210 · folhas de animação (C.SPRITES[id].anim): carrinho > gol > drible > bote > chute/passe > atordoado > (corrida) > parado.
      // Cada estado toca a sua folha quadro a quadro; sem a folha carregada, cai nas poses procedurais abaixo.
      const an = sp.anim; let strip = null, aname = null, afi = 0;
      if (an && !e.sprPre) { e.sprPre = 1; for (const nm in an) if (an[nm].src) BL.spriteImg(sid, "a:" + nm); } // v211: carrega todas as folhas já na entrada (antes o 1º chute mostrava o desenho antigo)
      if ((e.stun || 0) > (e.stunLast || 0) + 0.01) { e.stunMax = e.stun; e.hitT = now; } e.stunLast = e.stun || 0; // duração do atordoamento atual
      const seq = (nm, kk) => { const a = an[nm], f = a.from || 0; aname = nm; afi = f + Math.min(a.n - f - 1, Math.floor(kk * (a.n - f))); };
      const loop = (nm, sp2 = 1) => { aname = nm; afi = Math.floor(now * an[nm].fps * sp2 + seed) % an[nm].n; };
      if (an && e.gk) {
        // v216 · goleiro: a defesa/espalmada começa no mergulho (a bola já chegou); segurando, nos últimos 0,3 s solta a bola para a reposição
        if ((k = A(e.missT, an.miss.d)) >= 0) seq("miss", k);
        else if ((k = A(e.kickT, an.kick.d)) >= 0) seq("kick", k);
        else if ((k = A(e.saveT, an[e.saveKind || "catch"].d)) >= 0) seq(e.saveKind || "catch", k);
        else if (hasBall && e.hold > 0 && e.hold < 0.3) { aname = "kick"; afi = 1 + Math.min(1, Math.floor(((0.3 - e.hold) / 0.3) * 2)); }
        else if (hasBall) loop("hold");
        else if (run > 0.15) loop("side", 0.6 + run * 0.6);
        else loop("idle");
        strip = BL.spriteImg(sid, "a:" + aname) || im; if (strip === im) { aname = "idle"; afi = 0; }
        // bola nas mãos (desenhada por cima, em draw): posição relativa aos pés por estado/quadro
        e.gkBall = !hasBall ? null : aname === "catch" ? [[30, -40], [30, -40], [28, -16], [28, -16], [10, -34], [10, -42]][afi] : aname === "kick" ? (afi === 1 ? [14, -30] : [18, -14]) : [10, -42];
      } else if (an) {
        if (e.slide > 0 || (e.stun > 0 && A(e.slideT, 1.1) >= 0)) { aname = "slide"; afi = e.slide > 0 ? 1 + Math.min(2, Math.floor(((now - e.slideT) / 0.3) * 3)) : e.stun > 0.22 ? 3 : 4; } // deita, desliza, levanta
        else if ((k = A(e.celebT, an.celeb.d)) >= 0) seq("celeb", k);
        else if ((k = A(e.dribT, an.drib.d)) >= 0) seq("drib", k);
        else if ((k = A(e.tackT, an.tack.d)) >= 0) seq("tack", k);
        else if ((k = A(e.kickT, an[e.kickKind === "shot" ? "shot" : "pass"].d)) >= 0) seq(e.kickKind === "shot" ? "shot" : "pass", k);
        else if (e.stun > 0) { const kk = 1 - e.stun / Math.max(e.stun, e.stunMax || 0.5), fr = (e.stunMax || 0) >= 0.55 ? [0, 1, 2, 3, 3, 4, 5] : [0, 1, 1, 0]; aname = "stun"; afi = fr[Math.min(fr.length - 1, Math.floor(kk * fr.length))]; } // curto: cambaleia; longo: vai ao chão e levanta
        else if (run <= 0.15) { aname = "idle"; afi = Math.floor(now * an.idle.fps + seed) % an.idle.n; }
        strip = aname && BL.spriteImg(sid, "a:" + aname);
      }
      if (strip) { if (aname === "slide" || aname === "tack") pose = true; }
      else if (e.slide > 0 || (e.stun > 0 && A(e.slideT, 1.1) >= 0)) { rot = -1.3; oy = -4; pose = true; } // carrinho: deitado, pés para a frente (e no chão se errou)
      else if ((k = A(e.celebT, 1.8)) >= 0) { oy = -Math.abs(Math.sin(k * Math.PI * 4)) * 14; sy = 1 + Math.abs(Math.sin(k * Math.PI * 4)) * 0.08; }
      else if ((k = A(e.dribT, 0.45)) >= 0) { if (!sheet) sx = Math.cos(k * Math.PI * 2); oy = -Math.sin(k * Math.PI) * 7; ox = Math.sin(k * Math.PI) * 5; moving = true; } // v209: com folha, drible = pulinho correndo (sem o giro que achatava o desenho)
      else if ((k = A(e.tackT, 0.35)) >= 0) { ox = Math.sin(k * Math.PI) * 10; rot = Math.sin(k * Math.PI) * 0.35; pose = true; }
      else if ((k = A(e.kickT, 0.32)) >= 0) { rot = k < 0.3 ? -0.28 * (k / 0.3) : -0.28 + 0.5 * Math.sin(((k - 0.3) / 0.7) * Math.PI); ox = Math.sin(k * Math.PI) * 6; sx = sy = 1 + Math.sin(k * Math.PI) * 0.1; pose = true; }
      else if (e.stun > 0) rot = Math.sin(now * 30) * 0.14;
      else if (run > 0.15) { moving = true; if (!sheet) { oy = -Math.abs(Math.sin(ph)) * 4 * run; rot = 0.1 * run; sy = 1 - 0.05 * run * Math.abs(Math.cos(ph)); } }
      else { const br = Math.sin(now * 3.4 + seed); sy = 1 + 0.03 * br; sx = 1 - 0.015 * br; }
      if ((k = A(e.volley, 0.5)) >= 0) { const j = Math.sin(k * Math.PI); oy -= j * 18; rot += -(e.face || 1) * j * 1.15; } // v470: finalização de primeira no ar (voleio)
      // quadro: a passada avança com a velocidade (parado fica no quadro "idle")
      let use = im, fi = 0, n = 1, px = C.SPRITE_PX;
      const szk = ((C.SPRITE_SIZE || {})[sid] || 1) * (C.SPRITE_SCALE || 1); // v442: todos 15% menores (Mickey) // v356: ajuste de tamanho visual por personagem (só desenho; hitbox igual para todos)
      if (!strip && an && im.height > 100) px = an.px * szk; // v357: desenho único dos personagens novos é grande (~145 px): sem isso aparecia gigante enquanto a folha carrega
      if (strip) { use = strip; n = an[aname].n; fi = afi; px = an.px * szk; ox += (an[aname].fx || 0) * px; } // v214: pés no anel
      else if (sheet && !pose) {
        use = sheet; n = N; px = (sp.runPx ?? C.SPRITE_PX) * szk; ox += (sp.runFx || 0) * px;
        // v209: a passada avança pela distância percorrida (pé não "patina"), com um mínimo para o drible no lugar
        if (moving) { e.runPh = ((e.runPh ?? seed * 1.3) + (Math.max(hyp(e.vx || 0, e.vy || 0), 90) * dt * N) / C.SPRITE_CYCLE) % N; fi = Math.floor(e.runPh); }
        else fi = sp.idle ?? 0;
      }
      e.spr = { im: use, fi, n, rot, px }; e.sprHH = an ? an.hh * szk : use.height * px;
      // anel do time e, v209, sombra de contato nos pés (sem ela o desenho parecia flutuar); a sombra sobe junto quando ele pula
      const fy = e.y + C.SPRITE_FEET, air = Math.max(0, -oy);
      const aura = e.p && (e.p.rarity === "despertado" && C.AWAKE_AURA ? C.AWAKE_AURA : e.p.boss && C.BOSS_AURA && C.BOSS_AURA[e.p.charId]) || (e.p && e.p.goldTeam && C.GOLDEN_TEAM && C.GOLDEN_TEAM.aura) || (e.p && e.p.gpAura); // v628: aura exclusiva do Game Pass (só visual) // v582: Time Dourado // v552: Despertado = aura dourada // v460 (Mickey): o Boss joga com uma aura na cor dele
      if (aura) {
        const hh = e.sprHH || 60, pu = 0.5 + 0.5 * Math.sin(now * 4 + seed), cy = fy - hh * 0.5, rgb = aura.match(/\w\w/g).map((h) => parseInt(h, 16)).join(",");
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(e.x, cy, 2, e.x, cy, hh * (0.62 + 0.08 * pu));
        g.addColorStop(0, `rgba(${rgb},${0.34 + 0.14 * pu})`); g.addColorStop(0.55, `rgba(${rgb},${0.16 + 0.08 * pu})`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(e.x, cy, hh * (0.5 + 0.06 * pu), hh * (0.66 + 0.08 * pu), 0, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 6; i++) { const k = (now * 0.9 + i / 6 + seed) % 1, ax = e.x + Math.sin(seed * 3 + i * 2.1 + now * 2) * hh * 0.32; ctx.fillStyle = `rgba(${rgb},${0.7 * (1 - k)})`; ctx.beginPath(); ctx.arc(ax, fy - 6 - k * hh * 1.1, 2.2 * (1 - k) + 0.8, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
      ctx.save(); ctx.beginPath(); ctx.ellipse(e.x, fy - 4, e.r + 1, 6, 0, 0, Math.PI * 2); // pés um pouco à frente do centro do anel: pisando dentro dele
      ctx.fillStyle = e.team === 0 ? "rgba(20,108,255,.45)" : boss ? "rgba(255,176,46,.35)" : "rgba(242,245,255,.35)"; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = e.p?.shiny ? "#ffd23f" : col.ring === "#0A1124" ? "#f2f5ff" : col.ring; ctx.stroke();
      if (hasBall) { const pu = 0.5 + 0.5 * Math.sin(now * 7); ctx.beginPath(); ctx.ellipse(e.x, fy - 4, e.r + 5 + pu * 3, 8 + pu * 1.5, 0, 0, Math.PI * 2); ctx.strokeStyle = `rgba(${this.teamRGB(e.team)},${0.35 + 0.35 * pu})`; ctx.lineWidth = 2; ctx.stroke(); } // v217: aura de quem tem a bola
      const lying = strip ? ["slide", "stun", "catch", "parry", "miss"].includes(aname) && fi >= 2 && fi <= 3 : pose && rot < -1;
      const sw = (lying ? 30 : 17) * (1 - Math.min(0.4, air / 30));
      ctx.beginPath(); ctx.ellipse(e.x - (lying && !strip ? e.face * 10 : 0), fy - 2, sw, 4.5, 0, 0, Math.PI * 2); ctx.fillStyle = `rgba(0,0,0,${0.42 - Math.min(0.2, air / 60)})`; ctx.fill(); ctx.restore();
      // v211: ao trocar de folha (parado > corrida > chute...), o último quadro da anterior some em 0,1 s por baixo do novo,
      // em vez de cortar seco de um desenho para o outro
      const cur = { im: use, fi, n, px, face: e.face, rot, ox, oy, sx, sy };
      if (e.sprLast && e.sprLast.im !== use) { e.xf = e.sprLast; e.xfT = performance.now() / 1000; } // v357: relógio real (com a partida parada o fade ficava preso e o quadro velho aparecia gigante)
      const ol = e.team === 0 || (e.gk && e.own) ? C.OUTLINE_MINE : C.OUTLINE_ENEMY; // v355: contorno do time em toda folha
      e.sprLast = cur;
      if (e.xf && (k = (performance.now() / 1000 - e.xfT) / 0.1) >= 0 && k < 1) { const q = e.xf; ctx.save(); ctx.globalAlpha = (1 - k) * 0.85; this.spriteAt(ctx, q.im, e.x, e.y, q.face, q.rot, q.ox, q.oy, q.sx, q.sy, q.fi, q.n, q.px, ol); ctx.restore(); }
      ctx.save();
      if (hasBall) { ctx.shadowColor = e.team === 0 ? "#26D9FF" : boss ? "#ffb02e" : "#ffffff"; ctx.shadowBlur = 10; }
      if (aura) { ctx.shadowColor = aura; ctx.shadowBlur = 14 + 6 * Math.sin(now * 4 + seed); }
      // v584 (Mickey): sem lampejo branco quando leva tackle ou drible (era v217)
      this.spriteAt(ctx, use, e.x, e.y, e.face, rot, ox, oy, sx, sy, fi, n, px, ol);
      ctx.restore();
    }
    // v215 · barra de energia (Mickey: a antiga, fina e verde, sumia no gramado novo): cápsula escura com borda,
    // azul Blue Lock / amarelo / rosa, 4 gomos, brilho em cima, rastro branco do que acabou de gastar e pisca quando está no fim
    energyBar(ctx, e, x, y) {
      const w = 34, h = 6, x0 = x - w / 2, en = U.clamp(e.energy, 0, 100);
      e.enTrail = Math.max(en, Math.min(100, (e.enTrail ?? en) - 40 * U.clamp(this.time - (e.enT ?? this.time), 0, 0.1))); e.enT = this.time;
      // v352 (Mickey): barra na cor do time para separar bem os lados: azul = meu time, vermelho = inimigo; abaixo de ENERGY_LOW fica mais escura
      const low = en <= 25, mine = e.team === 0, tc = mine ? "43,123,255" : "255,59,59", col = en > C.ENERGY_LOW ? `rgb(${tc})` : mine ? "#1a4fb0" : "#a8202a";
      const rr = (px, py, pw, ph, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, r); else ctx.rect(px, py, pw, ph); };
      ctx.save();
      rr(x0 - 2, y - 2, w + 4, h + 4, 4); ctx.fillStyle = "rgba(6,10,28,.9)"; ctx.shadowColor = `rgba(${tc},.9)`; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
      ctx.lineWidth = 1.5; ctx.strokeStyle = low && Math.sin(this.time * 12) > 0 ? "#ffffff" : `rgb(${tc})`; ctx.stroke();
      rr(x0, y, w, h, 3); ctx.save(); ctx.clip();
      if (e.enTrail > en) { ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fillRect(x0, y, (w * e.enTrail) / 100, h); }
      ctx.fillStyle = col; ctx.fillRect(x0, y, (w * en) / 100, h);
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x0, y, (w * en) / 100, 2); // brilho
      ctx.fillStyle = "rgba(6,10,28,.75)"; for (let i = 1; i < 4; i++) ctx.fillRect(x0 + (w * i) / 4 - 0.5, y, 1, h); // gomos de 25%
      ctx.restore(); ctx.restore();
    }
    // v222 · desenha algo preso a um ponto do chão: com o estádio inclinado, leva o ponto para a perspectiva e escala pelo fundo/frente
    // (chão = achata na altura; de pé = jogadores, bola, textos). Sempre fechar com ctx.restore()
    at(ctx, x, y, ground, ay = y) {
      ctx.save(); const P = IMG.persp; if (!P) return;
      const p = proj(x, ay), sx = ground ? p.k : p.k * P.spr, sy = ground ? p.k * p.g : sx;
      ctx.translate(p.x, p.y); ctx.scale(sx, sy); ctx.translate(-x, -ay);
    }
    // v220 · câmera: segue a bola com um pouco de antecipação, suavizada; não sai da imagem do estádio.
    // Só com BL.CAM = "perto" (opção do jogador; v221: padrão é a câmera parada no campo inteiro). Abre no intervalo e no fim
    camStep() {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const dt = this._camT ? Math.min(0.1, (now - this._camT) / 1000) : 1; this._camT = now;
      const on = !IMG.persp && BL.CAM === "perto" && !["halftime", "ended", "goldenIntro"].includes(this.state);
      const c = this.cam || (this.cam = { x: W / 2, y: H / 2, z: 1 }), b = this.ball;
      const tx = b.x + U.clamp(b.vx * 0.35, -160, 160), ty = b.y + U.clamp(b.vy * 0.2, -80, 80);
      const kp = 1 - Math.exp(-dt * 3.5), kz = 1 - Math.exp(-dt * 2.5);
      c.z += ((on ? C.CAM_ZOOM : 1) - c.z) * kz; c.x += (tx - c.x) * kp; c.y += (ty - c.y) * kp;
      const hw = VIEW.w / 2 / c.z, hh = VIEW.h / 2 / c.z;
      c.x = U.clamp(c.x, VIEW.x + hw, VIEW.x + VIEW.w - hw); c.y = U.clamp(c.y, VIEW.y + hh, VIEW.y + VIEW.h - hh);
      return c;
    }
    // ---------- v218 · HUD da transmissão ----------
    rrect(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
    // v219 · placas de LED do estádio: o texto vai nas 7 placas em branco da imagem (x e largura em unidades do campo)
    // BL | BLUE LOCK | letreiro | ● AO VIVO | letreiro | PROJECT IDLE | BL; no gol, todas piscam "GOL!" na cor de quem marcou
    drawLed(ctx, boss) {
      const L = IMG.persp?.led, acc = boss ? "255,176,46" : "38,217,255", pink = "255,79,139", y = L ? L.y : -45.5, h = L ? L.h : 19.6, t = this.time;
      const goal = this.state === "goal", gc = this.flash?.team === 0 ? "38,217,255" : boss ? "255,176,46" : pink;
      const font = `italic 900 ${Math.round(h * 0.87)}px 'Barlow Condensed', Impact, sans-serif`;
      const glow = (text, x, col) => { ctx.fillStyle = `rgb(${col})`; ctx.shadowColor = `rgb(${col})`; ctx.shadowBlur = 10; ctx.fillText(text, x, y + h / 2 + 1); ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillText(text, x, y + h / 2 + 1); };
      const panel = (x, w, text, col, mode) => {
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        ctx.fillStyle = `rgba(${col},.1)`; ctx.fillRect(x, y, w, h);
        ctx.font = font; ctx.textBaseline = "middle";
        ctx.globalAlpha = mode === "blink" ? 0.55 + 0.45 * Math.abs(Math.sin(t * 6)) : 1;
        if (mode === "ticker") { // letreiro correndo para a esquerda, em loop
          ctx.textAlign = "left"; const tw = ctx.measureText(text).width, off = (t * 28) % tw;
          for (let tx = x - off; tx < x + w; tx += tw) glow(text, tx, col);
        } else { ctx.textAlign = "center"; glow(text, x + w / 2, col); }
        ctx.globalAlpha = 1; ctx.fillStyle = "rgba(4,8,22,.22)"; // grade de LED
        for (let gx = x; gx < x + w; gx += 2.5) ctx.fillRect(gx, y, 0.8, h);
        for (let gy = y; gy < y + h; gy += 2.5) ctx.fillRect(x, gy, w, 0.8);
        const sx = x - 40 + (((t * 0.25) % 1) * (w + 80)); // brilho passando
        const gr = ctx.createLinearGradient(sx - 20, 0, sx + 20, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,.14)"); gr.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gr; ctx.fillRect(x, y, w, h); ctx.restore();
      };
      const B = L ? L.B : [[51.6, 73.9], [162.1, 136.7], [330.5, 122.4], [476.7, 125.5], [624.5, 124.7], [779.5, 137.5], [951.9, 74.7]];
      if (goal) { B.forEach(([x, w], i) => panel(x, w, "GOL!", i % 2 ? "255,255,255" : gc, "blink")); return; }
      const tick = "BLUE LOCK ★ PROJECT IDLE ★ ";
      (L ? [["BLUE LOCK"], [tick, acc, "ticker"], ["● AO VIVO", pink, "blink"], [tick, acc, "ticker"], ["PROJECT IDLE"]] : [["BL"], ["BLUE LOCK"], [tick, acc, "ticker"], ["● AO VIVO", pink, "blink"], [tick, acc, "ticker"], ["PROJECT IDLE"], ["BL"]])
        .forEach(([text, col = acc, mode], i) => panel(B[i][0], B[i][1], text, col, mode));
    }
    // minimapa (meio) e card de quem está com a bola (esquerda), sobre a mureta de baixo do campo
    drawHud(ctx, boss) {
      const b = this.ball, y0 = H + 7;
      // v220: com a câmera perto, minimapa e card crescem (até ~1,36×) presos no pé da tela
      const hs = 1 + Math.max(0, (this.cam?.z || 1) - 1) * 0.6, VB = VIEW.y + VIEW.h;
      const grow = (ax) => { ctx.translate(ax, VB); ctx.scale(hs, hs); ctx.translate(-ax, -VB); };
      ctx.save(); grow(W / 2);
      // minimapa
      const mw = 176, mh = mw * (H / W), mx = W / 2 - mw / 2, my = y0 + 3 + 104 * (H / W) - mh, s = mw / W; // v302/v303: maior, até o topo da mureta (ref do Mickey)
      ctx.save(); this.rrect(ctx, mx - 6, my - 4, mw + 12, mh + 8, 6); ctx.fillStyle = "rgba(4,8,22,.78)"; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(38,217,255,.45)"; ctx.stroke();
      ctx.fillStyle = "rgba(40,140,60,.35)"; ctx.fillRect(mx, my, mw, mh);
      ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 0.8; ctx.strokeRect(mx, my, mw, mh);
      ctx.beginPath(); ctx.moveTo(mx + mw / 2, my); ctx.lineTo(mx + mw / 2, my + mh); ctx.stroke();
      ctx.beginPath(); ctx.arc(mx + mw / 2, my + mh / 2, 70 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeRect(mx, my + (H / 2 - 120) * s, 130 * s, 240 * s); ctx.strokeRect(mx + mw - 130 * s, my + (H / 2 - 120) * s, 130 * s, 240 * s);
      for (const e of this.ents) {
        ctx.fillStyle = e.gk ? (e.team === 0 || e.own ? "#ffd23f" : "#ff4f8b") : `rgb(${this.teamRGB(e.team)})`;
        ctx.beginPath(); ctx.arc(mx + e.x * s, my + e.y * s, e === b.owner ? 3.6 : 2.8, 0, Math.PI * 2); ctx.fill();
        if (e === b.owner) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke(); }
      }
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(mx + b.x * s, my + b.y * s, 1.8, 0, Math.PI * 2); ctx.fill();
      const c = this.cam; // v220: área que a câmera está mostrando
      if (c && c.z > 1.05) {
        const hw = VIEW.w / 2 / c.z, hh = VIEW.h / 2 / c.z, x0 = Math.max(0, c.x - hw), x1 = Math.min(W, c.x + hw), y0c = Math.max(0, c.y - hh), y1 = Math.min(H, c.y + hh);
        ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1; ctx.strokeRect(mx + x0 * s, my + y0c * s, (x1 - x0) * s, (y1 - y0c) * s);
      }
      ctx.restore(); ctx.restore();
      // v304: um card por time (meu à esquerda, inimigo à direita): quem está com a bola ou o último que teve; goleiro não entra
      if (!this.hudFoc) this.hudFoc = [null, null];
      if (b.owner && !b.owner.gk && b.owner.p) this.hudFoc[b.owner.team] = b.owner;
      const cw = 230, cxL = Math.round((VIEW.x + (W / 2 - mw / 2 - 6)) / 2 - cw / 2) - 90; // v305: mais para o canto
      for (const t of [0, 1]) {
        const f = this.hudFoc[t], e = f && this.ents.includes(f) ? f : this.ents.find((q) => !q.gk && q.team === t && q.p);
        if (e) this.hudCard(ctx, e, t ? W - cxL - cw : cxL, my + 10, cw, grow); // v305: mais para cima (alinhado ao topo do minimapa)
      }
    }
    hudCard(ctx, e, cx, cy, cw, grow) {
      const p = e.p, tc = this.teamRGB(e.team), chh = 56;
      ctx.save(); grow(cx + cw / 2);
      // v306: cores reforçadas no visual do jogo (fundo azul-marinho/vinho cheio, borda viva com brilho, retrato em gradiente)
      const mine = e.team === 0, gr = ctx.createLinearGradient(0, cy, 0, cy + chh);
      gr.addColorStop(0, mine ? "#0f3170" : this.arena ? "#5a3608" : "#5a1238"); gr.addColorStop(1, mine ? "#050b26" : this.arena ? "#1a0e02" : "#1a0412");
      ctx.save(); ctx.shadowColor = `rgba(${tc},.75)`; ctx.shadowBlur = 14;
      this.rrect(ctx, cx, cy, cw, chh, 9); ctx.fillStyle = gr; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = `rgb(${tc})`; ctx.stroke(); ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx + 10, cy + 2.5); ctx.lineTo(cx + cw - 10, cy + 2.5); ctx.stroke();
      // retrato
      const pg = ctx.createLinearGradient(0, cy + 5, 0, cy + 51); pg.addColorStop(0, `rgba(${tc},.55)`); pg.addColorStop(1, `rgba(${tc},.15)`);
      this.rrect(ctx, cx + 5, cy + 5, 46, 46, 7); ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = `rgb(${tc})`; ctx.lineWidth = 2; ctx.stroke();
      const pic = BL.spriteImg(p.charId, "card");
      if (pic) { ctx.save(); this.rrect(ctx, cx + 5, cy + 5, 46, 46, 6); ctx.clip(); ctx.imageSmoothingEnabled = false; const sc = 43 / Math.max(pic.width, pic.height); ctx.drawImage(pic, cx + 28 - (pic.width * sc) / 2, cy + 50 - pic.height * sc, pic.width * sc, pic.height * sc); ctx.restore(); }
      else { ctx.fillStyle = "#fff"; ctx.font = "800 22px 'Barlow Condensed', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.initials, cx + 28, cy + 29); }
      // nome, nível e barras (energia; XP no nosso time)
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowOffsetY = 2;
      ctx.font = "italic 900 19px 'Barlow Condensed', Impact, sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText((p.short || p.name).toUpperCase(), cx + 59, cy + 19); ctx.restore();
      ctx.font = "800 11px 'JetBrains Mono', ui-monospace, monospace"; ctx.fillStyle = mine ? "#7fe8ff" : `rgb(${tc})`; ctx.fillText(`Nv ${p.level}`, cx + 59, cy + 31);
      const bar = (by, k, col) => { this.rrect(ctx, cx + 59, by, 158, 6, 3); ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 1; ctx.stroke(); if (k > 0) { this.rrect(ctx, cx + 59, by, 158 * Math.min(1, k), 6, 3); ctx.fillStyle = col; ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 6; ctx.fill(); ctx.restore(); } };
      const en = U.clamp(e.energy, 0, 100) / 100;
      bar(cy + 38, en, en > C.ENERGY_LOW / 100 ? "#3ee08a" : en > 0.25 ? "#ffd23f" : "#ff4f8b");
      const need = C.playerXpToNext ? C.playerXpToNext(p.level) : 0;
      if (e.team === 0 && need) bar(cy + 46.5, (p.xp || 0) / need, "#26D9FF"); // XP só do nosso time
      ctx.restore();
    }
    draw(ctx, cw, ch) {
      const s = Math.min(cw / VIEW.w, ch / VIEW.h);
      const ox = (cw - VIEW.w * s) / 2 - VIEW.x * s, oy = (ch - VIEW.h * s) / 2 - VIEW.y * s;
      ctx.save();
      ctx.clearRect(0, 0, cw, ch);
      ctx.translate(ox, oy); ctx.scale(s, s);
      if (this.shakeT > 0) { const k = this.shakeMag * (this.shakeT / (this.shakeDur || this.shakeT)); ctx.translate(U.rand(-k, k), U.rand(-k, k)); }
      // v220 · câmera: zoom que segue a bola (Configurações > Tela); HUD e letreiros grandes continuam fixos na tela
      const cam = this.camStep();
      if (cam.z > 1.001) { ctx.translate(VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y); }
      const boss = !!this.arena;
      const line = boss ? "rgba(255,90,110,.75)" : "rgba(0,168,255,.75)";
      const arenaTint = boss ? this.arena.tint || "rgba(255,40,70,.22)" : null;
      if (fieldImg && fieldImg.complete && fieldImg.naturalWidth) {
        ctx.imageSmoothingEnabled = K * s * cam.z < 1; // ampliado: pixel nítido
        ctx.drawImage(fieldImg, VIEW.x, VIEW.y, VIEW.w, VIEW.h);
        ctx.imageSmoothingEnabled = true;
        if (boss) {
          // v125 · arena do Boss: campo tingido com a paleta do Boss (tint + degradê + vinheta que "respira"), sem texto no meio
          const A = this.arena;
          ctx.fillStyle = arenaTint; ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
          if (A.grad) { const lg = ctx.createLinearGradient(VIEW.x, 0, VIEW.x + VIEW.w, 0); A.grad.forEach((c, i) => lg.addColorStop(i / (A.grad.length - 1), c)); ctx.fillStyle = lg; ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h); }
          if (A.vignette) {
            const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 900), cx = VIEW.x + VIEW.w / 2, cy = VIEW.y + VIEW.h / 2;
            const rg = ctx.createRadialGradient(cx, cy, VIEW.h * 0.25, cx, cy, VIEW.w * 0.62);
            rg.addColorStop(0, "rgba(0,0,0,0)"); rg.addColorStop(1, A.vignette);
            ctx.save(); ctx.globalAlpha = pulse; ctx.fillStyle = rg; ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h); ctx.restore();
          }
        }
      } else {
      // gramado
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, boss ? "#2a0712" : "#0D1730"); g.addColorStop(1, boss ? "#14030a" : "#0A1124");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 10; i++) { if (i % 2) { ctx.fillStyle = boss ? "rgba(255,60,90,.04)" : "rgba(20,108,255,.07)"; ctx.fillRect(i * (W / 10), 0, W / 10, H); } }
      // linhas
      ctx.strokeStyle = line; ctx.lineWidth = 2.5; ctx.shadowColor = line; ctx.shadowBlur = 8;
      ctx.strokeRect(0, 0, W, H);
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeRect(0, H / 2 - 120, 130, 240); ctx.strokeRect(W - 130, H / 2 - 120, 130, 240);
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2); ctx.fillStyle = line; ctx.fill();
      ctx.shadowBlur = 0;
      // gols
      [0, 1].forEach((side) => {
        const x = side === 0 ? -PAD + 8 : W;
        ctx.fillStyle = "rgba(255,255,255,.06)"; ctx.fillRect(x, MOUTH_T, PAD - 8, GH);
        ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1;
        for (let yy = MOUTH_T; yy <= MOUTH_B; yy += 12) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + PAD - 8, yy); ctx.stroke(); }
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(side === 0 ? 0 : W, MOUTH_T); ctx.lineTo(x + (side === 0 ? 0 : PAD - 8), MOUTH_T); ctx.lineTo(x + (side === 0 ? 0 : PAD - 8), MOUTH_B); ctx.lineTo(side === 0 ? 0 : W, MOUTH_B); ctx.stroke();
      });
      }
      if (IMG.persp) { ctx.translate(VIEW.x, VIEW.y); ctx.scale(K, K); } // v222: daqui até o HUD, coordenadas em pixel da imagem
      if (IMG.persp.led) this.drawLed(ctx, boss); // v219: texto nas placas de LED do estádio (v312: só o Estádio tem placas)
      // rastro da bola
      const b = this.ball;
      // v188 · 1×1: chute deixa rastro na cor do time, mais grosso
      const shotCol = b.skCol && !b.owner ? b.skCol : this.duelMode && b.shot ? (b.shot.team === 0 ? "38,217,255" : boss ? "255,176,46" : "255,79,139") : null;
      // v217: rastro em fita que afina (chute na cor do time, com miolo branco); bola parada no pé não deixa rastro
      if (!b.owner && this.trail.length > 2) {
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        for (let pass = 0; pass < (shotCol ? 2 : 1); pass++) for (let i = 1; i < this.trail.length; i++) {
          const k = i / this.trail.length, p0 = this.trail[i - 1], p1 = this.trail[i];
          ctx.strokeStyle = shotCol && !pass ? `rgba(${shotCol},${k * 0.75})` : `rgba(255,255,255,${k * (shotCol ? 0.7 : 0.3)})`;
          this.at(ctx, p1.x, p1.y, true); // v222
          ctx.lineWidth = BALL_R * 2 * k * (shotCol ? (pass ? 0.45 : 1.3) : 0.7); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
          ctx.restore();
        }
      }
      // efeitos de parede
      this.fx.forEach((f) => {
        if (IMG.persp && f.kind === "net") return; // v222: a rede da imagem inclinada já tem volume; a onda reta ficaria fora dela
        this.at(ctx, f.x, f.y, ["spark", "ring", "dust", "impact", "pop"].includes(f.kind)); // v222
        if (f.kind === "spark") { ctx.fillStyle = `rgba(63,227,255,${f.t * 3})`; ctx.beginPath(); ctx.arc(f.x, f.y, 14 * (1 - f.t * 2) + 4, 0, Math.PI * 2); ctx.fill(); }
        if (f.kind === "ring") { ctx.strokeStyle = `rgba(255,255,255,${f.t})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 26 * (1 - f.t) + 6, 0, Math.PI * 2); ctx.stroke(); }
        if (f.kind === "dust") { ctx.fillStyle = `rgba(210,220,240,${f.t * 1.2})`; ctx.beginPath(); ctx.arc(f.x, f.y, 3 + (0.35 - f.t) * 18, 0, Math.PI * 2); ctx.fill(); }
        if (f.kind === "impact") { // v188: estouro no choque (drible, roubo, carrinho, trave, gol)
          const k = U.clamp(1 - f.t / 0.45, 0, 1), r = 8 + k * 34;
          ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 1 - k)})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.stroke();
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.3; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * r * 0.9, f.y + Math.sin(a) * r * 0.9); ctx.lineTo(f.x + Math.cos(a) * (r + 10), f.y + Math.sin(a) * (r + 10)); ctx.stroke(); }
        }
        if (f.kind === "wave") { // v217: onda no chão (chute, passe, defesa)
          const k = 1 - f.t / (f.life || (f.life = f.t)), r = 6 + k * f.r;
          ctx.strokeStyle = `rgba(${f.col},${(1 - k) * 0.8})`; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.ellipse(f.x, f.y, r, r * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
        }
        if (f.kind === "pop") { const k = 1 - f.t / 0.14; ctx.fillStyle = `rgba(255,255,255,${1 - k})`; ctx.beginPath(); ctx.arc(f.x, f.y, 5 + k * 16, 0, Math.PI * 2); ctx.fill(); }
        if (f.kind === "swoosh") { // v217: dois arcos girando em volta de quem driblou
          const k = 1 - f.t / 0.4, cy = f.y + C.SPRITE_FEET - 26;
          ctx.lineCap = "round";
          for (let i = 0; i < 2; i++) { const a0 = -Math.PI / 2 + k * Math.PI * 2.2 + i * Math.PI, rr = 30 + i * 6; ctx.strokeStyle = `rgba(${i ? "255,255,255" : f.col},${(1 - k) * 0.9})`; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.ellipse(f.x, cy, rr, rr * 0.55, 0, a0, a0 + 1.6); ctx.stroke(); }
        }
        if (f.kind === "net") { // v217: rede estufa e balança onde a bola entrou
          const k = 1 - f.t, amp = 7 * Math.exp(-3 * k);
          ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - k)})`; ctx.lineWidth = 1.5;
          for (let i = 0; i < 6; i++) {
            const bx = f.x + f.d * (4 + i * 4.6); ctx.beginPath();
            for (let yy = MOUTH_T; yy <= MOUTH_B; yy += 4) { const w = Math.exp(-Math.abs(yy - f.y) / 38), xx = bx + f.d * amp * w * (1 + Math.sin((yy - f.y) / 9 - k * 22)) * (1 - i / 8); yy === MOUTH_T ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); }
            ctx.stroke();
          }
        }
        if (f.kind === "burst") { // v188: explosão de cor no gol
          const el = f.life - f.t, col = f.team === 0 ? "38,217,255" : boss ? "255,176,46" : "255,79,139", fade = Math.min(1, f.t / 0.5);
          f.parts.forEach((q, i) => { const m = (1 - Math.exp(-2.2 * el)) / 2.2; ctx.fillStyle = `rgba(${i % 3 ? col : "255,255,255"},${fade})`; ctx.beginPath(); ctx.arc(f.x + q.vx * m, f.y + q.vy * m + 30 * el * el, q.r, 0, Math.PI * 2); ctx.fill(); });
        }
        ctx.restore();
      });
      this.drawParts(ctx, false); // v217: poeira no chão, por baixo dos jogadores
      this.drawSkills(ctx, 0); // v623
      // v188 · 1×1: imagem residual de quem está em velocidade (arrancada depois do drible/roubo, carrinho)
      if (this.duelMode) for (const e of this.ents) {
        if (e.gk || !e.ghost || (e.p && BL.spriteImg(e.p.charId, "run"))) continue; // v209: quem tem folha de corrida não deixa rastro (parecia um desenho voando)
        const fast = e.slide > 0 || (b.owner === e && (e.burst > 0 || this.time - (e.recoverT ?? -9) < 0.7));
        if (!fast) continue;
        const col = e.team === 0 ? "38,217,255" : boss ? "255,176,46" : "242,245,255";
        const g = e.p && BL.fieldSprite(e.p.charId) && e.spr; // rastro com o mesmo quadro desenhado no jogador
        if (g) { e.ghost.forEach((q, i) => { this.at(ctx, q.x, q.y, false, q.y + C.SPRITE_FEET); ctx.globalAlpha = 0.08 + (i / e.ghost.length) * 0.3; this.spriteAt(ctx, g.im, q.x, q.y, e.face || 1, g.rot, 0, 0, 1, 1, g.fi, g.n, g.px); ctx.restore(); }); ctx.globalAlpha = 1; continue; }
        e.ghost.forEach((q, i) => { this.at(ctx, q.x, q.y, true); ctx.fillStyle = `rgba(${col},${0.05 + (i / e.ghost.length) * 0.22})`; ctx.beginPath(); ctx.arc(q.x, q.y, e.r * (0.7 + 0.3 * (i / e.ghost.length)), 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
      }
      if (this.x1()) { // v561 · X1: água na ala e anel de fôlego no pé de cada jogador
        for (const e of this.ents) { if (e.gk) continue;
          // v563 (Mickey): o stack saiu do campo e foi para o placar (ui.js renderStack)
          if ((e.fol ?? 100) >= 99.5) continue; const f = (e.fol ?? 100) / 100; this.at(ctx, e.x, e.y + C.SPRITE_FEET, true); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.arc(e.x, e.y + C.SPRITE_FEET, e.r + 6, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = f < C.X1.fol.low / 100 ? "#ff4f5e" : "#26d9ff"; ctx.beginPath(); ctx.arc(e.x, e.y + C.SPRITE_FEET, e.r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke(); ctx.restore(); }
      }
      // jogadores
      const teamCol = [{ fill: "#146CFF", ring: "#26D9FF", txt: "#fff" }, boss ? { fill: "#1a0a0e", ring: "#ffb02e", txt: "#ffd27a" } : { fill: "#f2f5ff", ring: "#0A1124", txt: "#0A1124" }];
      for (const e of IMG.persp ? [...this.ents].sort((p, q) => p.y - q.y) : this.ents) { // v222: quem está mais na frente é desenhado por cima
        this.at(ctx, e.x, e.y, false, e.y + C.SPRITE_FEET);
        const col = teamCol[e.team], im = e.gk ? BL.spriteImg(C.GK_SPRITE, "a:idle") : e.p && BL.fieldSprite(e.p.charId);
        if (!e.gk && e.skNinja > this.time) ctx.globalAlpha = this.skAlpha(e); // v623: Ninja Invisível
        if (im) this.drawSprite(ctx, e, im, e.gk ? { ring: e.team === 0 || e.own ? "#ffd23f" : "#ff4f8b" } : col, e === b.owner, boss); // v216: anel do goleiro amarelo (nosso) / rosa (deles)
        else {
        ctx.save();
        if (e === b.owner) { ctx.shadowColor = e.team === 0 ? "#26D9FF" : boss ? "#ffb02e" : "#ffffff"; ctx.shadowBlur = 18; }
        ctx.beginPath();
        if (e.slide > 0) ctx.ellipse(e.x, e.y, e.r * 1.25, e.r * 0.8, e.slideA, 0, Math.PI * 2); // v188: deitado no carrinho
        else ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = e.gk ? (e.team === 0 || e.own ? "#ffd23f" : "#ff4f8b") : col.fill; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = e.p?.shiny ? "#ffd23f" : col.ring; ctx.stroke();
        ctx.restore();
        ctx.fillStyle = e.gk ? "#0A1124" : col.txt;
        ctx.font = "800 13px 'Barlow Condensed', 'Arial Narrow', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(e.gk ? "GK" : e.p.initials, e.x, e.y + 1);
        }
        if (!e.gk) {
          // energia (com sprite fica acima da cabeça)
          const ey = im ? e.y + C.SPRITE_FEET - (e.sprHH || 70) - 9 : e.y - e.r - 12;
          this.energyBar(ctx, e, e.x, ey);
          // v354 (Mickey): sem nome em campo; o lado fica pela cor da barra
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          if (e === b.owner) { // v218: setinha em cima de quem está com a bola
            const ty = ey - 6 + Math.sin(this.time * 6) * 2;
            ctx.beginPath(); ctx.moveTo(e.x - 7, ty - 9); ctx.lineTo(e.x + 7, ty - 9); ctx.lineTo(e.x, ty); ctx.closePath();
            ctx.fillStyle = `rgb(${this.teamRGB(e.team)})`; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
            ctx.lineWidth = 1.5; ctx.strokeStyle = "#050914"; ctx.stroke();
          }
          if (e.stun > 0) { ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.font = "700 11px sans-serif"; ctx.fillText("✶", e.x + 22, ey + 3); } // v215: ao lado da barra
        }
        ctx.restore();
      }
      if (C.GK_POSS && b.owner && b.owner.gk && this.state === "play") { const g = b.owner, f = U.clamp(1 - (this.time - (g.possT ?? this.time)) / C.GK_POSS.t, 0, 1), V = C.GK_POSS, gy = g.y + C.SPRITE_FEET; // v603 (Mickey): circulozinho da posse do goleiro acabando em cima da cabeça
        this.at(ctx, g.x, g.y, false, gy); const cy = gy - V.head; ctx.lineWidth = V.w; ctx.strokeStyle = "rgba(10,17,36,.7)"; ctx.beginPath(); ctx.arc(g.x, cy, V.r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = f > 0.34 ? "#ffffff" : "#ffd23f"; ctx.beginPath(); ctx.arc(g.x, cy, V.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke(); ctx.restore(); }
      // bola
      { const go = b.owner && b.owner.gk && b.owner.gkBall; this.at(ctx, go ? b.owner.x : b.x, go ? b.owner.y : b.y, false, go ? b.owner.y + C.SPRITE_FEET : b.y + BALL_R); } // v222
      const lp = !b.owner && b.pass && b.pass.lob, lk = lp ? hyp(b.x - lp.x, b.y - lp.y) / (lp.len * (b.pass.air ? 1 : 0.8)) : 1; // v225: passe por cima sobe de verdade
      const bladeB = (lp && (b.pass.blade || b.pass.bladeTo)) || (b.shot && b.shot.blade), BV = (C.REPERT && C.REPERT.blade && C.REPERT.blade.vis) || {}; // v500 (Mickey): blade sobe mais e tem aura branca
      const lift = b.lift > 0 ? Math.sin(Math.PI * (1 - b.lift / 0.4)) * 18 : lk < 1 ? Math.sin(Math.PI * lk) * (bladeB && BV.h ? BV.h : lp.h || (b.pass.air ? C.COMBO.fogH || 26 : 26)) : 0; // v188: chapéu, a bola sobe
      if (lift) { ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(b.x, b.y + 3, BALL_R, BALL_R * 0.5, 0, 0, Math.PI * 2); ctx.fill(); }
      const gh = b.owner && b.owner.gk && b.owner.gkBall, gk = ((C.SPRITE_SIZE || {})[C.GK_SPRITE] || 1) * (C.SPRITE_SCALE || 1), bdx = gh ? b.owner.x + b.owner.face * gh[0] * gk : b.x, bdy = gh ? b.owner.y + C.SPRITE_FEET + gh[1] * gk : b.y; // v378: bola acompanha o goleiro menor // v216: nas mãos do goleiro
      if (!lift && !gh) { ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(bdx + 1.5, bdy + BALL_R - 1, BALL_R * 0.95, BALL_R * 0.4, 0, 0, Math.PI * 2); ctx.fill(); } // v217: sombra da bola
      const br = BALL_R * (1 + lift / 60);
      if (bladeB) { const pu = 0.75 + 0.25 * Math.sin(this.time * 14), ar = br * (BV.aura || 2.3) * pu, gr = ctx.createRadialGradient(bdx, bdy - lift, br * 0.6, bdx, bdy - lift, ar); gr.addColorStop(0, "rgba(255,255,255,.75)"); gr.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bdx, bdy - lift, ar, 0, Math.PI * 2); ctx.fill(); }
      ctx.beginPath(); ctx.arc(bdx, bdy - lift, br, 0, Math.PI * 2); ctx.fillStyle = "#ffffff"; ctx.shadowColor = bladeB ? "#ffffff" : b.shot ? `rgb(${this.teamRGB(b.shot.team)})` : "#26D9FF"; ctx.shadowBlur = bladeB ? 18 : b.shot ? 22 : 8; ctx.fill(); ctx.shadowBlur = 0;
      { // v217: gomos girando com a distância rolada (a bola parece rolar, não deslizar)
        const v = hyp(b.vx || 0, b.vy || 0), mv = b.owner && !gh ? hyp(b.owner.vx || 0, b.owner.vy || 0) : v, ma = b.owner && !gh ? Math.atan2(b.owner.vy || 0, b.owner.vx || 1) : Math.atan2(b.vy || 0, b.vx || 1);
        const dt = U.clamp(this.time - (b.rollT ?? this.time), 0, 0.1); b.rollT = this.time; b.roll = ((b.roll || 0) + (mv * dt) / br) % (Math.PI * 2);
        ctx.save(); ctx.beginPath(); ctx.arc(bdx, bdy - lift, br - 0.5, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = "#0A1124";
        for (let i = 0; i < 3; i++) { const ph = b.roll + (i * Math.PI * 2) / 3, off = Math.sin(ph) * br * 0.8, vis = Math.cos(ph); if (vis < -0.2) continue;
          ctx.beginPath(); ctx.arc(bdx + Math.cos(ma) * off + Math.cos(ma + 1.57) * (i - 1) * 1.6, bdy - lift + Math.sin(ma) * off + Math.sin(ma + 1.57) * (i - 1) * 1.6, 1.6 + vis * 0.7, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
      ctx.strokeStyle = "#0A1124"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bdx, bdy - lift, br, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      this.drawParts(ctx, true); // v217: faíscas, grama e confete por cima
      this.drawSkills(ctx, 1); // v623
      // textos flutuantes
      this.fx.forEach((f) => {
        if (f.kind !== "text") return;
        if (C.FX_TEXT_KEEP && !C.FX_TEXT_KEEP.some((k) => String(f.text).startsWith(k))) return; // v569 (Mickey): só os textos essenciais aparecem em campo
        // v217: entra com um "pop" (cresce, passa do ponto e assenta), levemente inclinado, sobe e some
        const life = f.life || (f.life = f.t), age = life - f.t, s = age < 0.1 ? 0.5 + (age / 0.1) * 0.85 : age < 0.2 ? 1.35 - ((age - 0.1) / 0.1) * 0.35 : 1;
        this.at(ctx, f.x, f.y); // v222
        ctx.save(); ctx.globalAlpha = Math.min(1, f.t * 2.5); ctx.translate(f.x, f.y - (age / life) * 22); ctx.rotate(-0.06); ctx.scale(s, s);
        ctx.font = `italic 900 ${f.big ? 34 : 24}px 'Barlow Condensed', Impact, sans-serif`; ctx.textAlign = "center"; ctx.lineJoin = "round"; // v582: big = jogada lendária
        ctx.fillStyle = "rgba(5,9,20,.55)"; ctx.fillText(f.text, 2, 3); // sombra
        ctx.lineWidth = 5; ctx.strokeStyle = "#050914"; ctx.strokeText(f.text, 0, 0);
        ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0);
        ctx.restore(); ctx.restore();
      });
      { const X = this.x1(); if (X && !this.golden && this.state !== "ended") for (const t of [0, 1]) { // v572: aparece já no início (stack ainda vazio) // v570 (Mickey): ícone de "proibido" em cima do gol enquanto o time não pode chutar
        if (((this.stack || [])[t] || 0) >= X.style.shotMin) continue; const gx = this.goalX(t), x = gx + this.dir(t) * 26, y = H / 2 - GH * 0.7, r = 10, pu = 0.75 + 0.25 * Math.sin(this.time * 4), by = Math.sin(this.time * 2.2) * 2.5; // v571 (Mickey): dentro da rede, respirando de leve, com sombrinha
        this.at(ctx, x, y); ctx.save(); ctx.translate(x, y);
        ctx.globalAlpha = 0.32 - by * 0.03; ctx.fillStyle = "#050914"; ctx.beginPath(); ctx.ellipse(0, r + 9, r * (0.85 - by * 0.03), 3.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.translate(0, by); ctx.globalAlpha = 0.9;
        ctx.shadowColor = "rgba(38,217,255,.7)"; ctx.shadowBlur = 12 * pu; ctx.fillStyle = "rgba(5,9,20,.78)"; ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.lineWidth = 4; ctx.strokeStyle = "#26D9FF"; ctx.globalAlpha = 0.65 + 0.35 * pu; ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-(r - 2) * 0.7, -(r - 2) * 0.7); ctx.lineTo((r - 2) * 0.7, (r - 2) * 0.7); ctx.stroke();
        ctx.restore(); ctx.restore(); } }
      ctx.restore(); ctx.save(); ctx.translate(ox, oy); ctx.scale(s, s); // v220: sai da câmera, HUD fixo
      this.drawHud(ctx, boss); // v218: minimapa e card de quem está com a bola, na mureta de baixo
      this.drawSkillBanner(ctx); // v623
      this.drawChemBanner(ctx); // v578 (Mickey): faixa arcade das Reações Químicas e Egos em Colisão
      // sobreposições grandes
      // v270 · faixa de TV (opção A do Mickey): faixa inclinada colorida que abre do centro, só o que aconteceu + quem marcou
      const BAND = { blue: ["#1f7bff", "#26c6ff", "38,198,255"], red: ["#c8143c", "#ff4f8b", "255,79,139"], gold: ["#e0a800", "#ffd23f", "255,210,63"], purple: ["#4a1fd0", "#8f2fff", "143,47,255"] };
      const big = (text, sub, tone) => {
        const key = this.state + "|" + text + "|" + this.score.join("-");
        if (this._bandKey !== key) { this._bandKey = key; this._bandT0 = performance.now(); }
        const age = (performance.now() - this._bandT0) / 1000, open = Math.min(1, age / 0.28), e = 1 - Math.pow(1 - open, 3), tx = Math.min(1, Math.max(0, (age - 0.12) / 0.3)), te = 1 - Math.pow(1 - tx, 3);
        const [c1, c2, rgb] = BAND[tone] || BAND.blue, bh = 96;
        ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.1); ctx.scale(e, 1);
        const g = ctx.createLinearGradient(-W * 0.65, 0, W * 0.65, 0);
        g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.18, c1); g.addColorStop(0.5, c2); g.addColorStop(0.82, c1); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.shadowColor = `rgba(${rgb},.6)`; ctx.shadowBlur = 24; ctx.fillStyle = g; ctx.fillRect(-W * 0.65, -bh / 2, W * 1.3, bh); ctx.shadowBlur = 0;
        const lg = ctx.createLinearGradient(-W * 0.6, 0, W * 0.6, 0); lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.3, "#fff"); lg.addColorStop(0.7, "#fff"); lg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = lg; ctx.fillRect(-W * 0.6, -bh / 2 - 10, W * 1.2, 3); ctx.fillRect(-W * 0.6, bh / 2 + 7, W * 1.2, 3);
        ctx.restore();
        ctx.save(); ctx.globalAlpha = te; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
        ctx.font = "italic 900 84px 'Barlow Condensed', Impact, sans-serif";
        const tw = ctx.measureText(text).width; ctx.font = "italic 900 30px 'Barlow Condensed', Impact, sans-serif";
        const sw = sub ? ctx.measureText(sub).width + 22 : 0, x0 = W / 2 - (tw + sw) / 2 - (1 - te) * 60, y0 = H / 2 + 4;
        ctx.font = "italic 900 84px 'Barlow Condensed', Impact, sans-serif"; ctx.textAlign = "left";
        ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillText(text, x0 + 3, y0 + 4); ctx.fillStyle = "#fff"; ctx.fillText(text, x0, y0);
        if (sub) { ctx.font = "italic 900 30px 'Barlow Condensed', Impact, sans-serif"; ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillText(sub, x0 + tw + 22 + 2, y0 + 3); ctx.fillStyle = "#fff"; ctx.fillText(sub, x0 + tw + 22, y0); }
        ctx.restore();
      };
      if (this.state === "goal") {
        const mine = this.flash.team === 0;
        big("GOL!", (this.flash.name || "").toUpperCase(), mine || this.training ? "blue" : "red");
      } else if (this.state === "halftime") {
        big("INTERVALO", "", "purple");
      } else if (this.state === "goldenIntro") {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 12);
        big("GOLDEN GOL", "", "gold"); void pulse;
      } else if (this.golden && this.state === "play" && this.time - this.goldenT < 2.6) {
        const k = this.time - this.goldenT, a = Math.min(1, k / 0.3, (2.6 - k) / 0.5);
        ctx.globalAlpha = a * 0.92;
        ctx.font = "800 22px 'Barlow Condensed', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const tw = ctx.measureText("GOLDEN GOL").width + 36;
        ctx.fillStyle = "rgba(10,14,30,0.6)"; ctx.fillRect(W / 2 - tw / 2, 18, tw, 34);
        ctx.fillStyle = "#ffd23f"; ctx.fillText("GOLDEN GOL", W / 2, 36);
        ctx.globalAlpha = 1;
      } else if (this.state === "ended" && this.training) {
        big("FIM DO TREINO", "", "blue");
      } else if (this.state === "ended") {
        big(this.result.win ? "VITÓRIA" : "DERROTA", "", this.result.win ? "gold" : "red");
      }
      ctx.restore();
    }
  }

  BL.Match = Match;
  BL.FIELD = { W, H, PAD };
})();
