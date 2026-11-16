// BL PROJECT IDLE · anti-trapaça do save (v714). Compara o save novo com o último aceito e o tempo passado.
// Devolve null se está tudo certo, ou { tipo, detalhe } com o primeiro problema achado.
// Os números vêm da tabela "limites" (com os padrões abaixo). Listas de itens raros e habilidades lendárias
// foram tiradas do config.js da v713: item novo que não estiver aqui só não conta como raro (nunca bloqueia por isso).
type J = Record<string, any>;
export const PADRAO: Record<string, number> = {
  iv_max: 31, stat_total_max: 186, comum_min: 24, shiny_base: 25, shiny_extra: 4, starter_iv: 15,
  ev_max_stat: 252, ev_max_total: 504,
  nivel_jogador_por_save: 20, nivel_jogador_por_min: 5,
  elite_por_save: 1, elite_seg: 1200,
  itens_por_save: 12, itens_por_min: 2, itens_gold: 200,
  raros_por_save: 1, raros_seg: 1800,
  baus_por_save: 4, baus_por_min: 1, baus_lend_por_save: 1, baus_lend_seg: 1800,
  consumiveis_por_save: 250, consumiveis_por_min: 20, consumiveis_gold: 10,
  hab_lend_por_save: 1, hab_lend_seg: 1800, hab_por_save: 3,
  tecnicos_por_save: 1, tecnicos_seg: 600,
  gp_xp_por_save: 5000, gp_xp_por_min: 300, // XP do Game Pass (partida ~200 no máximo, missão diária 1500)
  gp_gold: 45000, gp_baus: 5, gp_consumiveis: 20, // folga por recompensa do Game Pass resgatada (Resgatar tudo)
  bau_gold: 12000, bau_itens: 3, // folga por baú aberto (Abrir todos)
};
const RAR = [["comum", 25], ["incomum", 50], ["raro", 70], ["epico", 85], ["lendario", 95], ["despertado", 100]] as const;
const ITENS_RAROS = new Set(["ch-mestre","ch-imperador","ch-sanguefrio","ch-raio","ca-guardiao","ca-fortaleza","ca-raiz","ca-espinho","cm-rei","cm-neoegoista","cm-maestro","cm-dourada","ci-isagi","ci-nagi","ci-bachira","ci-barou","ci-chigiri","ci-rin","ci-hugo","tr-livro-ego","tr-cartao","tr-bussola","tr-mente","tr-recuperacao","tr-cadeado","tr-cartaz","tr-agente","tr-helicoptero","tr-gramado","tr-cofre-pres"]);
const HAB_LEND = new Set(["curvado", "magico", "visao", "ego"]);
const STATS = ["passe", "chute", "fisico", "velocidade", "defesa", "drible"];

const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? (v as J) : {});
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
const players = (s: J) => arr(s.roster).concat(arr(s.offRoster)).filter((p) => p && typeof p === "object");

function rangeOf(r: string, L: Record<string, number>): [number, number] | null {
  const i = RAR.findIndex((x) => x[0] === r); if (i < 0) return null;
  const hi = Math.floor((RAR[i][1] / 100) * L.stat_total_max);
  const lo = i === 0 ? L.comum_min : Math.floor((RAR[i - 1][1] / 100) * L.stat_total_max) + 1;
  return [lo, hi];
}
function itemIds(s: J): string[] {
  const out: string[] = arr(s.inventory).filter((x) => typeof x === "string");
  players(s).forEach((p) => Object.values(obj(p.items)).forEach((x) => typeof x === "string" && out.push(x)));
  arr(s.mgrEq).forEach((x) => typeof x === "string" && out.push(x));
  return out;
}
const consSum = (s: J) => Object.values(obj(s.cons)).reduce((a: number, v) => a + Math.max(0, num(v)), 0);
const chests = (s: J) => arr(s.chests).filter((c) => c && typeof c === "object");

// novo jogador: os IVs precisam caber na raridade (como o jogo sorteia em players.js)
function newPlayerOk(p: J, L: Record<string, number>, strict: boolean): string | null {
  const st = obj(p.stats), v = STATS.map((k) => st[k]);
  if (v.some((x) => !Number.isInteger(x) || x < 1 || x > L.iv_max)) return "iv_invalido";
  const sum = v.reduce((a, b) => a + b, 0);
  if (!strict) return rangeOf(String(p.rarity), L) ? null : "raridade_invalida"; // primeiro save (conta importada de versões antigas): só confere IV e raridade existente
  if (p.shiny) return p.rarity === "lendario" && v.every((x) => x >= L.shiny_base && x <= L.shiny_base + L.shiny_extra) ? null : "shiny_invalido";
  if (p.rarity === "comum" && v.every((x) => x === L.starter_iv)) return null; // jogador inicial: 15 em tudo
  const r = rangeOf(String(p.rarity), L); if (!r) return "raridade_invalida";
  return sum >= r[0] && sum <= r[1] ? null : "raridade_nao_bate";
}

const gpGot = (s: J) => { const g = obj(s.gp), got = obj(g.got); return Object.keys(obj(got.f)).length + Object.keys(obj(got.p)).length; };
// Gold extra que o banco deve aceitar neste save (Game Pass resgatado e baús abertos), calculado junto com a checagem
export function goldExtra(prev: J | null, next: J, L: Record<string, number>): number {
  if (!prev) return 0;
  const sameSeason = obj(prev.gp).season === obj(next.gp).season, claims = Math.max(0, gpGot(next) - (sameSeason ? gpGot(prev) : 0));
  const opened = Math.max(0, chests(prev).length - chests(next).length);
  return claims * L.gp_gold + opened * L.bau_gold;
}
export function check(prev: J | null, next: J, secs: number, spent: number, L: Record<string, number>): { tipo: string; detalhe: J } | null {
  const min = secs / 60, bad = (tipo: string, detalhe: J = {}) => ({ tipo, detalhe });
  // EVs de todo jogador
  for (const p of players(next)) {
    const ev = obj(p.ev), vals = Object.values(ev).map(num);
    if (vals.some((x) => x < 0 || x > L.ev_max_stat) || vals.reduce((a, b) => a + b, 0) > L.ev_max_total) return bad("ev", { jogador: p.name, ev });
  }
  const before = new Map<string, J>(); if (prev) players(prev).forEach((p) => before.set(String(p.uid), p));
  let elite = 0;
  for (const p of players(next)) {
    const o = before.get(String(p.uid));
    if (o) { // jogador que já existia: personagem, raridade, shiny e IVs não mudam
      if (o.charId !== p.charId || o.rarity !== p.rarity || !!o.shiny !== !!p.shiny) return bad("jogador_alterado", { jogador: p.name, antes: { charId: o.charId, rarity: o.rarity, shiny: o.shiny }, agora: { charId: p.charId, rarity: p.rarity, shiny: p.shiny } });
      if (STATS.some((k) => obj(o.stats)[k] !== obj(p.stats)[k])) return bad("iv_alterado", { jogador: p.name, antes: o.stats, agora: p.stats });
      if (num(p.level) - num(o.level) > L.nivel_jogador_por_save + L.nivel_jogador_por_min * min) return bad("nivel_jogador_salto", { jogador: p.name, antes: o.level, agora: p.level });
    } else {
      const e = newPlayerOk(p, L, !!prev); if (e) return bad(e, { jogador: p.name, rarity: p.rarity, shiny: p.shiny, stats: p.stats });
      if (prev && (p.shiny || p.rarity === "lendario" || p.rarity === "despertado")) elite++;
    }
  }
  if (!prev) return null; // primeiro save da conta: só as regras de valor acima e as do banco
  if (elite > L.elite_por_save + secs / L.elite_seg) return bad("jogadores_raros_demais", { novos: elite });

  const goldDrop = Math.max(0, num(prev.gold) - num(next.gold));
  const gA = obj(prev.gp), gB = obj(next.gp), sameSeason = gA.season === gB.season;
  if (sameSeason && num(gB.xp) - num(gA.xp) > L.gp_xp_por_save + L.gp_xp_por_min * min) return bad("gamepass_xp", { antes: gA.xp, agora: gB.xp });
  const claims = Math.max(0, gpGot(next) - (sameSeason ? gpGot(prev) : 0));
  const cA0 = chests(prev), cB0 = chests(next), lendN = (l: J[]) => l.filter((c) => c.kind === "lendario" || c.kind === "epico").length;
  const opened = Math.max(0, cA0.length - cB0.length), openedTop = Math.max(0, lendN(cA0) - lendN(cB0));
  const iA = itemIds(prev), iB = itemIds(next);
  if (iB.length - iA.length > L.itens_por_save + L.itens_por_min * min + goldDrop / L.itens_gold + opened * L.bau_itens) return bad("itens_demais", { antes: iA.length, agora: iB.length });
  const rare = (l: string[]) => l.filter((x) => ITENS_RAROS.has(x)).length;
  if (rare(iB) - rare(iA) > L.raros_por_save + secs / L.raros_seg + openedTop) return bad("itens_raros_demais", { antes: rare(iA), agora: rare(iB) });

  const cA = chests(prev), cB = chests(next), lend = (l: J[]) => l.filter((c) => c.kind === "lendario").length;
  if (cB.length - cA.length > L.baus_por_save + L.baus_por_min * min + claims * L.gp_baus) return bad("baus_demais", { antes: cA.length, agora: cB.length });
  if (lend(cB) - lend(cA) > L.baus_lend_por_save + secs / L.baus_lend_seg + claims * L.gp_baus) return bad("baus_lendarios_demais", { antes: lend(cA), agora: lend(cB) });

  if (consSum(next) - consSum(prev) > L.consumiveis_por_save + L.consumiveis_por_min * min + goldDrop / L.consumiveis_gold + claims * L.gp_consumiveis + opened * L.gp_consumiveis) return bad("consumiveis_demais", { antes: prev.cons, agora: next.cons });

  const kA = Object.keys(obj(prev.skillLib)), kB = Object.keys(obj(next.skillLib)).filter((k) => !kA.includes(k));
  if (kB.length > L.hab_por_save + min / 10 + openedTop) return bad("habilidades_demais", { novas: kB });
  if (kB.filter((k) => HAB_LEND.has(k)).length > L.hab_lend_por_save + secs / L.hab_lend_seg + openedTop) return bad("habilidade_lendaria", { novas: kB });

  const tA = arr(obj(prev.coach).owned).length, tB = arr(obj(next.coach).owned).length;
  if (tB - tA > L.tecnicos_por_save + secs / L.tecnicos_seg) return bad("tecnicos_demais", { antes: tA, agora: tB });

  if (!spent && obj(next.gp).prem && !obj(prev.gp).prem) return bad("compra_sem_diamante", { item: "Game Pass premium" });
  return null;
}
