// BL PROJECT IDLE · bancos de dados (personagens e itens)
// Posições são uma primeira proposta: ajuste livremente.
window.BL = window.BL || {};

(function () {
  const P = {
    atacante: [
      "Yoichi Isagi", "Rin Itoshi", "Shoei Barou", "Seishiro Nagi", "Ryusei Shidou", "Michael Kaiser",
      "Rensuke Kunigami", "Noel Noa", "Zantetsu Tsurugi", "Kento Cho", "Shuto Sendo", "Gurimu Igarashi",
      "Asahi Naruhaya", "Hajime Nishioka", "Adam Blake", "Lavinho", "Leonardo Luna", "Pablo Cavasoz",
      "Kairu Saramadara", "Jin Kiyora", "Teru Kitsunezato", "Dada Silva", "Erik Gesner", "Chris Prince",
      "Swift", "Busby", "Ali", "Bunny Iglesias", "LockHart", // v340: novos do Mickey (posições propostas pelo Claude)
    ],
    alaof: [
      "Meguru Bachira", "Hyoma Chigiri", "Reo Mikage", "Sae Itoshi", "Charles Chevalier", "Julian Loki",
      "Eita Otoya", "Yudai Imamura", "Ranze Kurona", "Kenyu Yukimiya", "Alexis Ness", "Yo Hiori",
      "Nijiro Nanase", "Keisuke Wanima", "Junichi Wanima", "Picasso", "Renoir", "Haru Hayate",
      "Hibiki Okawa", "Ignacio Lara", "Marc Snuffy", "Rico", "Ruiz", "Michelin", "Btter", "Onazi Innocent",
    ],
    aladef: [
      "Tabito Karasu", "Wataru Kuon", "Aoshi Tokimitsu", "Hirouki Tsuzuki", "Shingen Tanaka", "Itsuki Wakatsuki",
      "Shinichi Konan", "Akira Endoji", "Aiki Himizu", "Teppei Neru", "Reiji Hiiragi", "Yukio Ishikari",
      "Ashime Suzuki", "Kazuma Niou", "Yuza Dokomo", "Rian Sanga", "Abdi", "Agi", "Arthur", "Gabin", "Hugo Vivian", "Teddy Knight",
    ],
    zagueiro: [
      "Oliver Aiku", "Ikki Niko", "Gin Gagamaru", "Jyubei Aryu", "Miroku Darai", "Gen Fukaku", "Don Lorenzo",
      "Jingo Raichi", "Okuhito Iemon", "Daiya Morinaga", "Masumi Atatame", "Theo Sachs", "Benedict Grim",
      "Birkenstock", "Driver", "Damon", "Drago", "Chapa", "Espesso", "Mensah", "Peron", "Young",
    ],
  };
  // Nomes extras da lista (não são do anime): entram como jogadores normais por enquanto.
  const extras = ["samuelzin_", "guiro", "Mickey", "galtz", "luquitas5", "rina", "hazin", "Kakah", "hooS", "hONda", "ratoWORLD", "nazuna", "marin", "riq"];
  const posIds = ["atacante", "alaof", "aladef", "zagueiro"];

  const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const initials = (s) => {
    const w = s.replace(/_/g, "").split(/\s+/).filter(Boolean);
    return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : w[0].slice(0, 2)).toUpperCase();
  };

  const chars = [];
  posIds.forEach((pos) => P[pos].forEach((name) => chars.push({ id: slug(name), name, short: name.split(" ").slice(-1)[0], initials: initials(name), position: pos, extra: false })));
  extras.forEach((name, i) => chars.push({ id: slug(name), name, short: name, initials: initials(name), position: posIds[i % 4], extra: true }));
  // v589 (Mickey): personagens da lista oficial que ainda não tinham ficha. Ficam no banco (posição em MICKEY_POS) e entram no jogo quando o sprite chegar (C.ACTIVE_CHARS).
  ["Bricio", "Zzapy", "Pekas", "B", "Winter", "Efipe", "Sereno", "Yars", "Kyotz", "Blade", "Hyf", "Wellio", "Hazih", "Alanzin", "Lpz", "Thz", "Pedro Rego", "Viikks"] /* v631: Viikks (Mickey) */
    .forEach((name) => chars.push({ id: slug(name), name, short: name, initials: initials(name), position: "atacante", extra: true }));
  { const k = chars.findIndex((c) => c.id === "hazin"); if (k >= 0) chars.splice(k, 1); } // v590 (Mickey): "hazin" era erro de escrita, o certo é Hazih
  chars.push({ id: "ryosuke-kira", name: "Ryosuke Kira", short: "Kira", initials: "RK", position: "atacante", extra: false });

  // v426 (Mickey): posições oficiais do banco de jogadores. Pivô = atacante, Ala Of = alaof, Ala Def = aladef, Fixo = zagueiro.
  // Vale para quem já existe; nomes que ainda não estão no jogo ficam aqui para quando entrarem (mesmo id/slug).
  const PIVO = "atacante", ALO = "alaof", ALD = "aladef", FIXO = "zagueiro";
  BL.MICKEY_POS = {
    marin: ALO, riq: FIXO, mickey: PIVO, ratoworld: ALO, guiro: PIVO, bricio: FIXO, zzapy: ALO, pekas: FIXO, b: ALD, winter: PIVO,
    efipe: ALO, sereno: ALD, yars: PIVO, kyotz: FIXO, blade: PIVO, hyf: ALD, wellio: ALD, hazih: PIVO, alanzin: PIVO, lpz: ALO,
    thz: ALD, "pedro-rego": FIXO, viikks: ALD, /* v631 (Mickey): Viikks é Ala Def */ btter: FIXO, // v589 (Mickey): Btter é Fixo
    "hyoma-chigiri": ALO, "jingo-raichi": ALD, "meguru-bachira": ALO, "rensuke-kunigami": ALD, "yoichi-isagi": PIVO, "ryosuke-kira": PIVO,
    "shoei-barou": PIVO, "ikki-niko": FIXO, "reo-mikage": ALD, "seishiro-nagi": PIVO, "eita-otoya": ALO, "jin-kiyora": ALD,
    "jyubei-aryu": FIXO, "kenyu-yukimiya": ALO, "nijiro-nanase": ALD, "ranze-kurona": ALO, "rin-itoshi": PIVO, "ryusei-shidou": PIVO,
    "tabito-karasu": ALD, "yo-hiori": ALO, "adam-blake": PIVO, "dada-silva": FIXO, "julian-loki": PIVO, "pablo-cavasoz": ALO,
    "leonardo-luna": ALD, "oliver-aiku": FIXO, "sae-itoshi": ALO, "noel-noa": PIVO, "alexis-ness": ALO, "michael-kaiser": PIVO,
    lavinho: PIVO, "chris-prince": PIVO, "marc-snuffy": FIXO, "don-lorenzo": FIXO, "charles-chevalier": ALO, "onazi-innocent": PIVO,
    "hugo-vivian": ALO, "bunny-iglesias": PIVO, lockhart: PIVO, "teddy-knight": PIVO,
  };
  chars.forEach((c) => { if (BL.MICKEY_POS[c.id]) c.position = BL.MICKEY_POS[c.id]; });
  BL.ALL_CHARACTERS = chars;
  // v339: só os personagens liberados (C.ACTIVE_CHARS) entram nos sorteios; o resto fica escondido
  BL.CHARACTERS = chars.filter((c) => (BL.CONFIG.ACTIVE_CHARS || []).includes(c.id));
  if (!BL.CHARACTERS.length) BL.CHARACTERS = chars;
  // v170 · banco de habilidades (vazio por enquanto). Cada uma: { id, name, icon, cd (s), desc, ... } e ativa sozinha (passiva) quando o CD acaba
  BL.SKILLS = Object.fromEntries(Object.entries(BL.CONFIG.SKILL_DEF || {}).map(([id, d], ix) => [id, { id, ix, ...d }])); // v629: ix = posição no atlas img/skills.jpg (7×2, ícones do Mickey) // v623: as 14 habilidades do Mickey (números em C.SKILL_DEF)
  BL.CHAR_BY_ID = Object.fromEntries(chars.map((c) => [c.id, c]));

  // ---------- Itens ----------
  // v473 (Mickey): 3 slots por jogador (chuteira, caneleira, camisa), 10 designs em cada, 2 por raridade.
  // bonus soma pontos direto no status (antes da nature). O desenho (art) é só do item: não muda o uniforme em campo.
  // art: a/b = cores, p = padrão do desenho (ver BL.itemSvg)
  const I = (id, name, slot, rarity, bonus, art, desc, ef) => ({ id, name, slot, rarity, bonus, art, desc, ...(ef ? { ef } : {}) });
  BL.ITEMS = [
    I("ch-treino", "Chuteira de Treino", "chuteira", "comum", { velocidade: 1, chute: 1 }, { a: "#e8eeff", b: "#7f8db3", p: "liso" }, "A primeira chuteira de todo atacante. Leve, simples e confiável."),
    I("ch-varzea", "Chuteira de Várzea", "chuteira", "comum", { drible: 1, velocidade: 1 }, { a: "#3a2a1c", b: "#c98a4a", p: "costura" }, "Gasta de tanto jogo no terrão. Quem calça aprende a driblar no improviso."),
    I("ch-bluelock", "Chuteira Ofensiva", "chuteira", "incomum", { chute: 2, velocidade: 2 }, { a: "#146cff", b: "#26d9ff", p: "faixa" }, "Modelo oficial do programa BL PROJECT. Feita para quem quer ser o número 1."),
    I("ch-relampago", "Chuteira Relâmpago", "chuteira", "incomum", { velocidade: 3, drible: 1 }, { a: "#1b1f3a", b: "#ffd23f", p: "raio" }, "Solado fino e tração máxima. A arrancada sai antes do marcador piscar."),
    I("ch-predador", "Chuteira Predador", "chuteira", "raro", { chute: 4, drible: 2 }, { a: "#c4142b", b: "#111522", p: "garras" }, "Garras de borracha no peito do pé dão efeito e força ao chute."),
    I("ch-ventania", "Chuteira Ventania", "chuteira", "raro", { velocidade: 4, drible: 2 }, { a: "#e8fbff", b: "#2fd1c4", p: "vento" }, "Tão leve que parece não estar no pé. Ideal para contra-ataques."),
    I("ch-ego", "Chuteira do Ego", "chuteira", "epico", { chute: 5, drible: 2, velocidade: 2 }, { a: "#0b0f24", b: "#b06bff", p: "chamas" }, "Só calça quem acredita que o gol é dele. Chute pesado e decisão rápida."),
    I("ch-fantasma", "Chuteira Fantasma", "chuteira", "epico", { drible: 5, velocidade: 4 }, { a: "#dfe6ff", b: "#8b7bff", p: "degrade" }, "Translúcida e silenciosa. O zagueiro só percebe o drible quando já passou."),
    I("ch-mestre", "Chuteira do Mestre", "chuteira", "lendario", { chute: 6, velocidade: 4, drible: 3 }, { a: "#ffb02e", b: "#fff2c4", p: "coroa" }, "Usada por uma lenda que nunca perdeu uma final. Pura técnica."),
    I("ch-imperador", "Chuteira do Imperador", "chuteira", "lendario", { chute: 5, drible: 5, velocidade: 3 }, { a: "#1a0f2e", b: "#ffb02e", p: "estrelas" }, "Bordada a ouro, feita para quem manda no jogo do primeiro ao último minuto."),
    // v522 (Mickey): 12 chuteiras novas da lista de itens. ef = texto do efeito especial (v524: vale na partida, números em C.ITEM_FX)
    I("ch-pano", "Chuteira de Pano", "chuteira", "comum", { chute: 2 }, { a: "#c4142b", b: "#ffffff", p: "liso" }, "Lona costurada à mão. Não protege nada, mas o chute sai seco."),
    I("ch-society", "Chuteira Society", "chuteira", "comum", { velocidade: 2 }, { a: "#146cff", b: "#e8eeff", p: "faixa" }, "Travas baixas para grama sintética. Arrancada curta e rápida."),
    I("ch-potencia", "Chuteira Potência", "chuteira", "incomum", { chute: 4 }, { a: "#c4142b", b: "#111522", p: "raio" }, "Bico reforçado para bater forte de qualquer lugar."),
    I("ch-mira", "Chuteira Mira", "chuteira", "incomum", { chute: 3, drible: 1 }, { a: "#e8eeff", b: "#ff3f5e", p: "faixa" }, "Peito do pé liso e marcado com a mira. Para quem escolhe o canto."),
    I("ch-arranque", "Chuteira Arranque", "chuteira", "raro", { velocidade: 2, drible: 2 }, { a: "#7fd13b", b: "#1d3b10", p: "vento" }, "Travas viradas para a frente. Sai disparada na bola dividida.", "Chega 15% antes na bola dividida."),
    I("ch-precisao", "Chuteira Precisão", "chuteira", "raro", { chute: 3, drible: 1 }, { a: "#f2e6c8", b: "#ffb02e", p: "costura" }, "Costura dourada que guia a bola até o ângulo.", "Chutes 10% mais no canto."),
    I("ch-afiada", "Chuteira Afiada", "chuteira", "raro", { drible: 3, velocidade: 1 }, { a: "#b06bff", b: "#ff6bd5", p: "garras" }, "Corte rápido para os dois lados. O marcador fica plantado.", "Dribles 10% mais desconcertantes: o marcador demora mais a voltar."),
    I("ch-canhao", "Chuteira Canhão", "chuteira", "epico", { chute: 6 }, { a: "#c4142b", b: "#2a0a10", p: "chamas" }, "Pesada e brutal. O chute vem com tudo, o passe nem tanto.", "Chutes 20% mais fortes, passes 10% menos precisos."),
    I("ch-ritmo", "Chuteira Ritmo", "chuteira", "epico", { drible: 4, velocidade: 2 }, { a: "#2fd1c4", b: "#0b3a3a", p: "degrade" }, "Cada drible pega o embalo do anterior.", "Dribles seguidos 5% mais fáceis a cada um, até 4."),
    I("ch-voleio", "Chuteira Voleio", "chuteira", "epico", { chute: 4, velocidade: 2 }, { a: "#e8eeff", b: "#146cff", p: "faixa" }, "Feita para bater de primeira, com a bola no ar.", "Voleio e bate-pronto sem perder precisão."),
    I("ch-sanguefrio", "Chuteira Sangue Frio", "chuteira", "lendario", { chute: 5, drible: 4 }, { a: "#dfe6ff", b: "#26d9ff", p: "estrelas" }, "Gelada por fora, decidida por dentro. Cobra caro do fôlego.", "Chute e drible 15% melhores, mas gasta 20% mais energia."),
    I("ch-raio", "Chuteira Raio", "chuteira", "lendario", { velocidade: 5, chute: 2, drible: 2 }, { a: "#146cff", b: "#ffd23f", p: "raio" }, "Some e aparece do outro lado do zagueiro.", "Não fica lento depois do drible."),

    I("ca-simples", "Caneleira Simples", "caneleira", "comum", { defesa: 1, fisico: 1 }, { a: "#e8eeff", b: "#9aa7c7", p: "liso" }, "Proteção básica de plástico. Segura as pancadas do dia a dia."),
    I("ca-espuma", "Caneleira de Espuma", "caneleira", "comum", { defesa: 2 }, { a: "#4fd68a", b: "#1d6b43", p: "pontos" }, "Espuma macia que amortece a entrada. Dá coragem para chegar junto."),
    I("ca-aco", "Caneleira de Aço", "caneleira", "incomum", { defesa: 2, fisico: 2 }, { a: "#aeb8cc", b: "#5a6680", p: "rebites" }, "Placa de metal por dentro. Pesada, mas ninguém passa por cima."),
    I("ca-tatica", "Caneleira Tática", "caneleira", "incomum", { defesa: 3, passe: 1 }, { a: "#146cff", b: "#e8eeff", p: "listras" }, "Com as marcações do campo gravadas. Ajuda a ler a jogada antes do passe."),
    I("ca-muralha", "Caneleira Muralha", "caneleira", "raro", { defesa: 4, fisico: 2 }, { a: "#7a4a2a", b: "#d9a066", p: "tijolos" }, "Cada tijolo é um bote certo. Feita para zagueiros que não recuam."),
    I("ca-titanio", "Caneleira de Titânio", "caneleira", "raro", { fisico: 4, defesa: 2 }, { a: "#5d6b86", b: "#26d9ff", p: "chevron" }, "Leve como plástico e dura como aço. Ganha toda dividida de corpo."),
    I("ca-sub20", "Caneleira Sub-20", "caneleira", "epico", { defesa: 5, fisico: 4 }, { a: "#e8eeff", b: "#ff3f5e", p: "numero" }, "Da seleção Sub-20 do Japão. Carrega a pressão de jogar contra os melhores."),
    I("ca-dragao", "Caneleira do Dragão", "caneleira", "epico", { defesa: 4, fisico: 3, velocidade: 2 }, { a: "#0d3b2a", b: "#4fd68a", p: "escamas" }, "Escamas de dragão pintadas à mão. Fecha o espaço rápido e com força."),
    I("ca-guardiao", "Caneleira do Guardião", "caneleira", "lendario", { defesa: 7, fisico: 6 }, { a: "#ffb02e", b: "#3a2400", p: "escudo" }, "Dizem que quem usa nunca levou um drible. A defesa vira uma parede."),
    I("ca-fortaleza", "Caneleira Fortaleza", "caneleira", "lendario", { defesa: 6, fisico: 4, passe: 3 }, { a: "#1c2350", b: "#ffd23f", p: "torre" }, "Defende e já sai jogando. Para o zagueiro que começa o ataque."),
    // v522 (Mickey): 12 caneleiras novas
    I("ca-pedra", "Caneleira de Pedra", "caneleira", "comum", { fisico: 2 }, { a: "#5a6680", b: "#2a3044", p: "liso" }, "Dura, pesada e sem frescura. Aguenta qualquer pancada."),
    I("ca-fina", "Caneleira Fina", "caneleira", "comum", { defesa: 1, velocidade: 1 }, { a: "#146cff", b: "#e8eeff", p: "listras" }, "Leve e fininha. Protege sem atrasar a corrida."),
    I("ca-ferro", "Caneleira de Ferro", "caneleira", "incomum", { defesa: 4 }, { a: "#2a3044", b: "#ff3f5e", p: "rebites" }, "Placa de ferro inteira. Bote seco, sem medo."),
    I("ca-reforcada", "Caneleira Reforçada", "caneleira", "incomum", { fisico: 3, defesa: 1 }, { a: "#1d3b2a", b: "#4fd68a", p: "chevron" }, "Camadas extras nas bordas. Ganha no corpo a corpo."),
    I("ca-teimosa", "Caneleira Teimosa", "caneleira", "raro", { defesa: 3, fisico: 1 }, { a: "#146cff", b: "#e8eeff", p: "pontos" }, "Presa com corrente. Quem usa não desiste da bola.", "12% mais chance de roubar a bola no desarme."),
    I("ca-gruda", "Caneleira Gruda", "caneleira", "raro", { defesa: 3, velocidade: 1 }, { a: "#111522", b: "#ff3f5e", p: "raio" }, "Cola no atacante e não larga mais.", "Driblado, levanta 30% mais rápido e volta a colar no atacante."),
    I("ca-base", "Caneleira da Base", "caneleira", "raro", { defesa: 3, fisico: 1 }, { a: "#e8eeff", b: "#146cff", p: "faixa" }, "Da categoria de base do BL PROJECT. Ajuda quem ainda está subindo.", "+20% de Defesa e Físico em jogador abaixo do nível 50."),
    I("ca-ultimalinha", "Caneleira Última Linha", "caneleira", "epico", { defesa: 4, fisico: 2 }, { a: "#0b1640", b: "#e8eeff", p: "numero" }, "Do último homem da defesa. Ninguém passa de graça.", "Com energia acima de 80, o 1º duelo perdido no tempo vira empate."),
    I("ca-sombra", "Caneleira Sombra", "caneleira", "epico", { defesa: 3, velocidade: 3 }, { a: "#1a0f2e", b: "#b06bff", p: "degrade" }, "Aparece do nada na frente do atacante.", "Atacante erra 8% mais dribles contra ele."),
    I("ca-protetora", "Caneleira Protetora", "caneleira", "epico", { defesa: 4, fisico: 2 }, { a: "#0b1640", b: "#26d9ff", p: "escudo" }, "Escudo na frente da canela. Bloqueia o que vier.", "10% mais chutes bloqueados."),
    I("ca-raiz", "Caneleira Raiz Eterna", "caneleira", "lendario", { defesa: 5, fisico: 4 }, { a: "#2a7a3a", b: "#7a4a2a", p: "escamas" }, "Raízes vivas que nunca cansam.", "Recupera 1 de energia a cada 5 s."),
    I("ca-espinho", "Caneleira Espinho", "caneleira", "lendario", { defesa: 5, fisico: 2, velocidade: 2 }, { a: "#111522", b: "#ff3f5e", p: "garras" }, "Cheia de espinhos. Passar por ela custa caro.", "Quem vence um duelo contra ele perde 10 de energia."),

    I("cm-treino", "Camisa de Treino", "camisa", "comum", { passe: 1, fisico: 1 }, { a: "#9aa7c7", b: "#e8eeff", p: "liso" }, "Algodão grosso, suada de tanto treino. O básico de todo jogador."),
    I("cm-regata", "Camisa Regata", "camisa", "comum", { velocidade: 1, passe: 1 }, { a: "#ff9a2e", b: "#ffffff", p: "regata" }, "Sem mangas e bem fresca. Boa para correr o jogo inteiro."),
    I("cm-listrada", "Camisa Listrada", "camisa", "incomum", { passe: 2, drible: 2 }, { a: "#e8eeff", b: "#146cff", p: "listras" }, "Listras clássicas de clube grande. Toque curto e jogo bonito."),
    I("cm-11", "Camisa 11", "camisa", "incomum", { chute: 2, passe: 2 }, { a: "#4fd68a", b: "#0b3a22", p: "numero" }, "O número de quem joga pelas pontas e cruza na cabeça do atacante."),
    I("cm-bluelock", "Camisa BL PROJECT", "camisa", "raro", { passe: 3, chute: 2, fisico: 1 }, { a: "#0b1640", b: "#26d9ff", p: "faixa" }, "O uniforme do projeto. Lembra que só um sai daqui como o melhor."),
    I("cm-retro", "Camisa Retrô", "camisa", "raro", { passe: 4, drible: 2 }, { a: "#f2e6c8", b: "#b3262e", p: "gola" }, "Gola de botão e tecido antigo. Para quem joga com classe."),
    I("cm-metavisao", "Camisa da Metavisão", "camisa", "epico", { passe: 5, drible: 2, velocidade: 2 }, { a: "#0a0f2a", b: "#26d9ff", p: "olho" }, "Quem veste enxerga o campo de cima. Cada passe já sai pensado."),
    I("cm-rubronegra", "Camisa Rubro-Negra", "camisa", "epico", { fisico: 4, chute: 3, defesa: 2 }, { a: "#c4142b", b: "#111111", p: "metade" }, "Pesada de história. Dá raça para disputar cada bola."),
    I("cm-rei", "Camisa do Rei", "camisa", "lendario", { chute: 4, fisico: 5, drible: 4 }, { a: "#ffb02e", b: "#6b3b00", p: "coroa" }, "Só um pode vestir. Quem usa joga como dono do campo."),
    // v479 (Mickey): camisas básicas, só na Loja (não caem em baú): +1 em um status
    ...[["passe", "Azul", "#146cff"], ["chute", "Vermelha", "#ff3f5e"], ["fisico", "Verde", "#4fd68a"], ["velocidade", "Amarela", "#ffd23f"], ["defesa", "Cinza", "#9aa7c7"], ["drible", "Roxa", "#b06bff"]].map(([k, cor, c]) =>
      ({ ...I("cb-" + k, "Camisa Básica " + cor, "camisa", "comum", { [k]: 1 }, { a: c, b: "#e8eeff", p: "liso" }, "Camisa lisa de algodão, sem frescura. Ajuda só um pouquinho."), shop: true })),
    I("cm-neoegoista", "Camisa Neo Egoísta", "camisa", "lendario", { passe: 5, chute: 4, velocidade: 4 }, { a: "#111522", b: "#ff3f5e", p: "diagonal" }, "Da liga Neo Egoísta. O ego de cada um somado vira um time imbatível."),
    // v522 (Mickey): 15 camisas novas (as 4 de Posição contam como 1 modelo na lista)
    I("cm-larga", "Camisa Larga", "camisa", "comum", { fisico: 2 }, { a: "#e8eeff", b: "#146cff", p: "liso" }, "Dois números acima. Sobra pano para segurar o adversário."),
    I("cm-varzea", "Camisa de Várzea", "camisa", "comum", { drible: 1, chute: 1 }, { a: "#2a9a4a", b: "#e8eeff", p: "liso" }, "Do time do bairro. Joga solto e no improviso."),
    I("cm-pesada", "Camisa Pesada", "camisa", "incomum", { fisico: 3, defesa: 1 }, { a: "#3a2a1c", b: "#c98a4a", p: "gola" }, "Tecido grosso de inverno. Ninguém te tira da bola."),
    I("cm-chuva", "Camisa de Chuva", "camisa", "incomum", { passe: 3, velocidade: 1 }, { a: "#146cff", b: "#26d9ff", p: "listras" }, "Seca rápido e não pesa. O toque continua limpo no temporal."),
    I("cm-visao", "Camisa Visão de Jogo", "camisa", "raro", { passe: 3, velocidade: 1 }, { a: "#0b1640", b: "#26d9ff", p: "olho" }, "Um olho no peito que vê o companheiro livre.", "5% mais passes para o companheiro mais livre."),
    I("cm-capitao", "Camisa do Capitão", "camisa", "raro", { passe: 2, fisico: 2 }, { a: "#e8eeff", b: "#ff3f5e", p: "numero" }, "Com a braçadeira no braço, o time todo cresce.", "O time todo ganha 3% nos duelos (só vale 1 por time)."),
    I("cm-reserva", "Camisa Reserva", "camisa", "raro", { passe: 2, fisico: 2 }, { a: "#2a9a4a", b: "#0b3a22", p: "diagonal" }, "Esperou no banco e entra com gás total.", "Quem entra no Vestiário com ela volta com +20 de energia."),
    { ...I("cm-pos-pivo", "Camisa de Posição · Pivô", "camisa", "epico", { chute: 4, fisico: 2 }, { a: "#0b1640", b: "#146cff", p: "olho" }, "Feita para quem vive dentro da área.", "+3 em Chute se jogar de Pivô."), pos: "atacante", posK: "chute" },
    { ...I("cm-pos-alaof", "Camisa de Posição · Ala Ofensivo", "camisa", "epico", { drible: 4, velocidade: 2 }, { a: "#1a0f2e", b: "#ff6bd5", p: "diagonal" }, "Asas no peito para voar pela ponta.", "+3 em Drible se jogar de Ala Ofensivo."), pos: "alaof", posK: "drible" },
    { ...I("cm-pos-aladef", "Camisa de Posição · Ala Defensivo", "camisa", "epico", { defesa: 4, passe: 2 }, { a: "#0d3b2a", b: "#4fd68a", p: "diagonal" }, "Defende o lado e já sai tocando.", "+3 em Defesa se jogar de Ala Defensivo."), pos: "aladef", posK: "defesa" },
    { ...I("cm-pos-fixo", "Camisa de Posição · Fixo", "camisa", "epico", { defesa: 4, fisico: 2 }, { a: "#111522", b: "#ff9a2e", p: "diagonal" }, "O escudo do último homem.", "+3 em Defesa se jogar de Fixo."), pos: "zagueiro", posK: "defesa" },
    I("cm-dupla", "Camisa Dupla", "camisa", "epico", { passe: 4, velocidade: 2 }, { a: "#111522", b: "#e8eeff", p: "metade" }, "Metade de um par. Rende mais com a outra metade em campo.", "5% mais acerto nos passes entre os 2 jogadores que usam a Dupla."),
    I("cm-veterana", "Camisa Veterana", "camisa", "epico", { passe: 3, fisico: 3 }, { a: "#6b1a2a", b: "#e8eeff", p: "coroa" }, "Sabe dosar o fôlego. Termina o jogo inteira.", "Gasta 15% menos energia no 2º tempo."),
    I("cm-maestro", "Camisa 10 do Maestro", "camisa", "lendario", { passe: 5, drible: 2, velocidade: 2 }, { a: "#e8eeff", b: "#146cff", p: "numero" }, "A 10 de quem rege o time com lançamentos.", "Passes longos 15% mais precisos."),
    I("cm-dourada", "Camisa Dourada", "camisa", "lendario", { passe: 2, chute: 3, fisico: 2, velocidade: 2, defesa: 2, drible: 2 }, { a: "#ffb02e", b: "#fff2c4", p: "estrelas" }, "Toda feita de ouro. Melhora um pouco de tudo."),
  ];
  // saves antigos: itens que saíram (o Acessório virou Camisa) viram os novos de mesma raridade
  BL.ITEM_ALIAS = { "chuteira-treino": "ch-treino", "chuteira-azul": "ch-bluelock", "chuteira-predador": "ch-predador", "chuteira-ego": "ch-ego", "chuteira-mestre": "ch-mestre",
    "caneleira-simples": "ca-simples", "caneleira-aco": "ca-aco", "caneleira-muro": "ca-muralha", "caneleira-u20": "ca-sub20",
    "faixa-capitao": "cm-treino", "munhequeira": "cm-listrada", "colete-numero": "cm-bluelock", "metavisao": "cm-metavisao", "coroa-rei": "cm-rei" };
  // v522 (Mickey): arte desenhada (img/itens/atlas.png) recortada das folhas de itens do Mickey; sem arte fica o desenho SVG
  ["ch-treino", "ch-varzea", "ch-pano", "ch-society", "ch-bluelock", "ch-relampago", "ch-potencia", "ch-mira", "ch-predador", "ch-ventania", "ch-arranque", "ch-precisao", "ch-afiada", "ch-ego", "ch-fantasma", "ch-canhao", "ch-ritmo", "ch-voleio", "ch-mestre", "ch-imperador", "ch-sanguefrio", "ch-raio",
    "ca-simples", "ca-espuma", "ca-pedra", "ca-fina", "ca-aco", "ca-tatica", "ca-ferro", "ca-reforcada", "ca-muralha", "ca-titanio", "ca-teimosa", "ca-gruda", "ca-base", "ca-sub20", "ca-dragao", "ca-ultimalinha", "ca-sombra", "ca-protetora", "ca-guardiao", "ca-fortaleza", "ca-raiz", "ca-espinho",
    "cm-treino", "cm-regata", "cm-larga", "cm-varzea", "cm-listrada", "cm-11", "cm-bluelock", "cm-retro", "cm-visao", "cm-capitao", "cm-reserva", "cm-metavisao", "cm-rubronegra", "cm-pos-pivo", "cm-pos-alaof", "cm-pos-aladef", "cm-pos-fixo", "cm-dupla", "cm-veterana", "cm-rei", "cm-neoegoista", "cm-maestro", "cm-dourada", "cm-pesada", "cm-chuva", // v523: Pesada e Chuva no fim da folha
  ].forEach((id, n) => { const it = BL.ITEMS.find((x) => x.id === id); if (it) it.img = n; }); // posição na folha img/itens/atlas.png (9 colunas × 8 linhas)
  BL.ITEM_BY_ID = Object.fromEntries(BL.ITEMS.map((i) => [i.id, i]));
  // v525 (Mickey): arte dos sub-itens e contratos do Wildcard numa folha só (img/wildcard/atlas.png, 8 × 8 de 128 px)
  BL.WC_SPR = Object.fromEntries("sb-grama sb-suor sb-cal sb-cadarco sb-rede sb-cone sb-jornal sb-lanterna sb-gelo sb-faixa-chute sb-faixa-passe sb-faixa-drible sb-faixa-velocidade sb-faixa-defesa sb-faixa-fisico sb-ingresso sb-apito sb-eco sb-holofote sb-placar sb-degrau sb-chave sb-medalha sb-luva sb-trave sb-pena sb-chama sb-purpurina ct-amador ct-base ct-amigo ct-profissional ct-atacante ct-zagueiro ct-revanche ct-noturno ct-exame ct-chute ct-passe ct-drible ct-velocidade ct-fisico ct-defesa ct-olheiro ct-parceria ct-elite ct-prorrogacao ct-relampago ct-nivel ct-luxo ct-torneio ct-invicto ct-virada ct-estrela ct-sonhos ct-ego ct-goleada ct-brilhante ct-coringa".split(" ").map((id, n) => [id, n]));
  BL.wcSprite = (id) => { const n = BL.WC_SPR[id]; return n == null ? "" : `background:url(img/wildcard/atlas.png?v=${BL.BUILD}) ${(n % 8) * (100 / 7)}% ${Math.floor(n / 8) * (100 / 7)}%/800% 800% no-repeat`; };
  // v532 (Mickey): arte das Propostas, fichas, Treino Particular, itens do treinador e de personagem (img/itens/atlas2.png, 9 × 8 de 128 px)
  BL.IT2 = Object.fromEntries("pr-basica pr-forte pr-elite pr-bluelock fi-branca fi-verde fi-azul fi-roxa fi-dourada tp-nivel tr-caderno tr-apito tr-prancheta tr-cronometro tr-livro-ego tr-cofrinho tr-pochete tr-contrato tr-maleta tr-cartao tr-chave tr-lupa tr-mapa tr-chave-cristal tr-bussola tr-quadro tr-livro-entrosa tr-video tr-radio tr-mente tr-garrafinha tr-hidratacao tr-nutri tr-gelo tr-recuperacao tr-cone-marca tr-apito-pressao tr-linha-alta tr-muralha tr-cadeado tr-alvo tr-rede tr-placa tr-canhao-bola tr-cartaz tr-cartao-visita tr-agenda tr-dossie tr-rede-olheiros tr-agente tr-mochila tr-mapa-trilha tr-barraca tr-jipe tr-helicoptero tr-regador tr-adubo tr-estufa tr-irrigacao tr-gramado ci-isagi ci-nagi ci-bachira ci-barou ci-chigiri ci-rin ci-hugo tr-cofre-pres".split(" ").map((id, n) => [id, n]));
  BL.it2Art = (id) => { const n = BL.IT2[id]; return n == null ? "" : `<span class="it-svg it-img" style="background-position:${(n % 9) * 12.5}% ${Math.floor(n / 9) * (100 / 7)}%;background-image:url(img/itens/atlas2.png?v=${BL.BUILD})"></span>`; };
  BL.wcArt = (id) => BL.WC_SPR[id] == null ? "" : `<span class="it-svg it-img wc-spr" style="${BL.wcSprite(id)}"></span>`;
  // sub-itens da Fazenda: tempo, semente e colheita vêm da raridade (C.WC_TIER)
  Object.values(BL.CONFIG.WC_FARM.crops).forEach((c) => Object.assign(c, BL.CONFIG.WC_TIER[c.rarity] ? { min: BL.CONFIG.WC_TIER[c.rarity].min, seed: BL.CONFIG.WC_TIER[c.rarity].seed, yield: BL.CONFIG.WC_TIER[c.rarity].yield } : {}));
  BL.ITEM_SLOTS = { chuteira: "Chuteira", caneleira: "Caneleira", camisa: "Camisa" };
  // Peso de cada raridade de item no baú
  BL.ITEM_RARITY_WEIGHT = { comum: 55, incomum: 28, raro: 12, epico: 4.5, lendario: 0.5 };

  // v473 (Mickey): itens do treinador (a conta). fx soma no treinador enquanto estiver equipado (C.MGR_SLOTS espaços):
  // xp = XP das partidas, gold = Gold das partidas, chest = chance de baú durante a partida, ev = pontos de EV por partida
  const M = (id, name, rarity, fx, art, desc) => ({ id, name, slot: "treinador", rarity, fx, art, desc, mgr: true });
  BL.MGR_ITEMS = [
    M("tr-caderno", "Caderno de Táticas", "comum", { xp: 0.03 }, { g: "caderno", a: "#e8eeff", b: "#146cff" }, "Anotações de cada partida. Seu time aprende um pouco mais a cada jogo."),
    M("tr-apito", "Apito de Treino", "incomum", { xp: 0.05 }, { g: "apito", a: "#c8d2e8", b: "#4fd68a" }, "Um apito firme deixa o treino mais puxado e o time evolui mais rápido."),
    M("tr-prancheta", "Prancheta Magnética", "raro", { xp: 0.08 }, { g: "prancheta", a: "#e8eeff", b: "#3f9bff" }, "Os ímãs mostram cada movimento. Os jogadores entendem o jogo mais rápido."),
    M("tr-cronometro", "Cronômetro de Elite", "epico", { xp: 0.12 }, { g: "cronometro", a: "#e8eeff", b: "#b06bff" }, "Mede cada segundo do treino. Nenhum minuto é desperdiçado."),
    M("tr-livro-ego", "Livro do Ego", "lendario", { xp: 0.16 }, { g: "livro", a: "#ffb02e", b: "#1a0f2e" }, "As lições de Jinpachi Ego. Transforma qualquer jogador em atacante."),
    M("tr-cofrinho", "Cofrinho", "comum", { gold: 0.03 }, { g: "cofre", a: "#ff8fb1", b: "#b3426a" }, "Cada moedinha guardada conta. Um pouco mais de Gold no fim do jogo."),
    M("tr-pochete", "Pochete do Olheiro", "incomum", { gold: 0.05 }, { g: "pochete", a: "#3a2a1c", b: "#ffd23f" }, "O olheiro sempre volta com algum trocado dos amistosos."),
    M("tr-contrato", "Contrato Assinado", "raro", { gold: 0.08 }, { g: "contrato", a: "#f2e6c8", b: "#3f9bff" }, "Um bom contrato com cláusula de bônus por partida."),
    M("tr-maleta", "Maleta de Patrocínio", "epico", { gold: 0.12 }, { g: "maleta", a: "#2a2f45", b: "#ffb02e" }, "Patrocinadores pagam bem para ver seu time em campo."),
    M("tr-cartao", "Cartão Dourado", "lendario", { gold: 0.16 }, { g: "cartao", a: "#ffb02e", b: "#fff2c4" }, "Crédito sem limite com os maiores clubes. O Gold não para de entrar."),
    M("tr-chave", "Chave Enferrujada", "comum", { chest: 0.03 }, { g: "chave", a: "#c98a4a", b: "#6b3b00" }, "Abre algum baú esquecido no vestiário de vez em quando."),
    M("tr-lupa", "Lupa do Olheiro", "incomum", { chest: 0.05 }, { g: "lupa", a: "#9fe8ff", b: "#5a6680" }, "Olho atento acha mais espólios durante a partida."),
    M("tr-mapa", "Mapa do Tesouro", "raro", { chest: 0.08 }, { g: "mapa", a: "#f2e6c8", b: "#c4142b" }, "Marca onde os baús costumam aparecer. Mais baús durante o jogo."),
    M("tr-chave-cristal", "Chave de Cristal", "epico", { chest: 0.12 }, { g: "chave", a: "#9fe8ff", b: "#26d9ff" }, "Brilha perto de baús. Fica bem mais fácil encontrá-los."),
    M("tr-bussola", "Bússola Lendária", "lendario", { chest: 0.16 }, { g: "bussola", a: "#ffb02e", b: "#c4142b" }, "Sempre aponta para o próximo espólio."),
    // v527 (Mickey): 8 famílias novas (bônus menores quando mexe direto na partida) + Cofre do Presidente (só do Boss)
    M("tr-quadro", "Quadro Branco", "comum", { pass: 0.01 }, { g: "prancheta", a: "#e8eeff", b: "#146cff" }, "Desenha as jogadas antes do jogo. O time se entende melhor."),
    M("tr-livro-entrosa", "Livro de Entrosamento", "incomum", { pass: 0.02 }, { g: "livro", a: "#3f9bff", b: "#e8eeff" }, "Cada jogador sabe onde o outro vai estar."),
    M("tr-video", "Vídeo de Jogadas", "raro", { pass: 0.03 }, { g: "cartao", a: "#1b1f3a", b: "#26d9ff" }, "Rever os lances deixa o passe mais certo."),
    M("tr-radio", "Rádio no Ponto", "epico", { pass: 0.04 }, { g: "apito", a: "#2a2f45", b: "#26d9ff" }, "O técnico fala no ouvido de cada um durante o jogo."),
    M("tr-mente", "Mente Coletiva", "lendario", { pass: 0.05 }, { g: "livro", a: "#b06bff", b: "#ffb02e" }, "O time pensa como um só jogador."),
    M("tr-garrafinha", "Garrafinha do Time", "comum", { drain: 0.02 }, { g: "cone", a: "#26d9ff", b: "#e8eeff" }, "Água sempre por perto. O time cansa um pouco menos."),
    M("tr-hidratacao", "Plano de Hidratação", "incomum", { drain: 0.03 }, { g: "caderno", a: "#e8eeff", b: "#26d9ff" }, "Horário certo para beber. Mais fôlego no fim do jogo."),
    M("tr-nutri", "Nutricionista", "raro", { drain: 0.05 }, { g: "prancheta", a: "#e8eeff", b: "#4fd68a" }, "Cardápio de atleta. O time aguenta mais."),
    M("tr-gelo", "Câmara de Gelo", "epico", { drain: 0.07 }, { g: "cofre", a: "#bfe8ff", b: "#26d9ff" }, "Recuperação no gelo depois de cada treino."),
    M("tr-recuperacao", "Centro de Recuperação", "lendario", { drain: 0.1 }, { g: "maleta", a: "#1b1f3a", b: "#4fd68a" }, "Estrutura de clube grande. O time quase não cansa."),
    M("tr-cone-marca", "Cone de Marcação", "comum", { tackle: 0.01 }, { g: "cone", a: "#ff9a2e", b: "#ffffff" }, "Treino de bote no cone. Desarmes um pouco melhores."),
    M("tr-apito-pressao", "Apito de Pressão", "incomum", { tackle: 0.02 }, { g: "apito", a: "#c8d2e8", b: "#ff3f5e" }, "Um apito e o time inteiro aperta a saída de bola."),
    M("tr-linha-alta", "Manual da Linha Alta", "raro", { tackle: 0.03 }, { g: "livro", a: "#1b1f3a", b: "#ff3f5e" }, "Marcação adiantada rouba mais bolas."),
    M("tr-muralha", "Muralha Tática", "epico", { tackle: 0.04 }, { g: "escada", a: "#5a6680", b: "#ff3f5e" }, "Ninguém passa sem pagar pedágio."),
    M("tr-cadeado", "Cadeado do Fixo", "lendario", { tackle: 0.05 }, { g: "chave", a: "#ffb02e", b: "#5a6680" }, "A defesa fecha à chave."),
    M("tr-alvo", "Alvo de Lona", "comum", { shot: 0.01 }, { g: "bola", a: "#ff3f5e", b: "#ffffff" }, "Chutar no alvo todo dia. Mais chutes certos."),
    M("tr-rede", "Rede de Treino", "incomum", { shot: 0.02 }, { g: "escada", a: "#e8eeff", b: "#5a6680" }, "Rede atrás do gol para treinar sem parar."),
    M("tr-placa", "Placa de Precisão", "raro", { shot: 0.03 }, { g: "cartao", a: "#ffd23f", b: "#1b1f3a" }, "Acertar a placa no canto vira hábito."),
    M("tr-canhao-bola", "Canhão de Bola", "epico", { shot: 0.04 }, { g: "bola", a: "#2a2f45", b: "#ff9a2e" }, "Máquina que lança bola para finalizar de primeira."),
    M("tr-cartaz", "Cartaz do Artilheiro", "lendario", { shot: 0.05 }, { g: "trofeu", a: "#ffb02e", b: "#ff3f5e" }, "O pôster do maior goleador motiva o ataque."),
    M("tr-cartao-visita", "Cartão de Visita", "comum", { scout: 0.5 }, { g: "cartao", a: "#e8eeff", b: "#146cff" }, "Deixa o contato com o adversário depois do jogo."),
    M("tr-agenda", "Agenda do Olheiro", "incomum", { scout: 1 }, { g: "caderno", a: "#3a2a1c", b: "#ffd23f" }, "Anota quem jogou bem contra você."),
    M("tr-dossie", "Dossiê do Jogador", "raro", { scout: 1.5 }, { g: "contrato", a: "#f2e6c8", b: "#c4142b" }, "Sabe tudo sobre o jogador que quer roubar."),
    M("tr-rede-olheiros", "Rede de Olheiros", "epico", { scout: 2 }, { g: "mapa", a: "#f2e6c8", b: "#4fd68a" }, "Olheiros em todos os campos."),
    M("tr-agente", "Agente Famoso", "lendario", { scout: 3 }, { g: "maleta", a: "#1b1f3a", b: "#ffb02e" }, "Um agente que convence qualquer um."),
    M("tr-mochila", "Mochila", "comum", { ficha: 0.03 }, { g: "pochete", a: "#3f9bff", b: "#1b1f3a" }, "Cabe mais coisa na volta da Expedição."),
    M("tr-mapa-trilha", "Mapa de Trilha", "incomum", { ficha: 0.05 }, { g: "mapa", a: "#f2e6c8", b: "#4fd68a" }, "Atalhos que acham mais fichas."),
    M("tr-barraca", "Barraca", "raro", { ficha: 0.08 }, { g: "colete", a: "#4fd68a", b: "#1b1f3a" }, "Acampar rende mais tempo de busca."),
    M("tr-jipe", "Jipe do Clube", "epico", { ficha: 0.12 }, { g: "maleta", a: "#4fd68a", b: "#ffd23f" }, "Vai mais longe e volta com mais fichas."),
    M("tr-helicoptero", "Helicóptero", "lendario", { ficha: 0.16 }, { g: "bussola", a: "#e8eeff", b: "#ff3f5e" }, "Chega em qualquer canto da trilha."),
    M("tr-regador", "Regador", "comum", { farm: 0.03 }, { g: "cone", a: "#4fd68a", b: "#e8eeff" }, "A Fazenda rende um pouco mais."),
    M("tr-adubo", "Adubo", "incomum", { farm: 0.05 }, { g: "pochete", a: "#5a3a22", b: "#4fd68a" }, "Terra boa dá colheita boa."),
    M("tr-estufa", "Estufa", "raro", { farm: 0.08 }, { g: "cofre", a: "#bfe8ff", b: "#4fd68a" }, "Cresce protegido do tempo."),
    M("tr-irrigacao", "Irrigação Automática", "epico", { farm: 0.12 }, { g: "escada", a: "#26d9ff", b: "#4fd68a" }, "Água na hora certa, sem esquecer."),
    M("tr-gramado", "Gramado Perfeito", "lendario", { farm: 0.16 }, { g: "trofeu", a: "#4fd68a", b: "#ffd23f" }, "O sonho de todo jardineiro de campo."),
    M("tr-cofre-pres", "Cofre do Presidente", "lendario", { goldX: 0.5 }, { g: "cofre", a: "#ffb02e", b: "#1a0f2e" }, "O cofre particular do presidente do clube. Só aparece contra o Boss."),
  ];
  // v529 (Mickey): saíram os itens do treinador de EV e de Tempo tático (Vestiário); saves antigos perdem esses itens no carregamento
  BL.MGR_BY_ID = Object.fromEntries(BL.MGR_ITEMS.map((i) => [i.id, i]));
  BL.anyItem = (id) => BL.ITEM_BY_ID[id] || BL.MGR_BY_ID[id];
  BL.MGR_FX_NAME = { xp: "XP das partidas", gold: "Gold das partidas", chest: "chance de baú na partida", ev: "EV por partida", pass: "passes certos do time", drain: "energia gasta pelo time", tackle: "desarmes do time", shot: "chutes no alvo do time", scout: "na chance de roubo", ttime: "no Vestiário", ficha: "fichas da Expedição", farm: "chance de colheita extra na Fazenda", goldX: "Gold das partidas" };
  // v527: texto de cada bônus do treinador (scout = pontos, ttime = segundos, drain = menos energia, goldX = multiplica)
  BL.mgrFxTxt = (k, v) => k === "scout" ? `+${String(v).replace(".", ",")} ponto${v > 1 ? "s" : ""} ${BL.MGR_FX_NAME[k]}` : k === "ttime" ? `+${v} s ${BL.MGR_FX_NAME[k]}` : k === "drain" ? `−${Math.round(v * 100)}% ${BL.MGR_FX_NAME[k]}` : k === "goldX" ? `${BL.MGR_FX_NAME[k]} ×${String(1 + v).replace(".", ",")}` : `+${Math.round(v * 100)}% ${BL.MGR_FX_NAME[k]}`;
  // v527 (Mickey) · itens de personagem: espaço extra (p.items.personagem) só para jogador Épico ou acima do próprio personagem. Efeitos em C.CHAR_ITEMS.
  const CI = (id, name, emo, desc, ef) => ({ id, name, slot: "personagem", rarity: "lendario", bonus: {}, ci: true, char: BL.CONFIG.CHAR_ITEMS[id].char, emo, desc, ef });
  BL.CHAR_ITEM_LIST = [
    CI("ci-isagi", "Olho de Isagi", "👁️", "A metavisão do Isagi. Ele enxerga o campo inteiro antes de receber.", "Passe e Chute ×1,3."),
    CI("ci-nagi", "Domínio do Nagi", "🪶", "Nenhuma bola foge do pé do Nagi, venha de onde vier.", "Chute ×1,3 e domínio perfeito de bola aérea (voleio sem perda)."),
    CI("ci-bachira", "Instinto do Bachira", "🌀", "O monstro dentro dele dribla sozinho.", "Drible ×1,4."),
    CI("ci-barou", "Coroa do Barou", "👑", "O rei não divide a bola dentro da área.", "Chute +20% com a bola na zona ideal de chute."),
    CI("ci-chigiri", "Pernas do Chigiri", "🐆", "A velocidade que ninguém alcança em campo aberto.", "Velocidade ×1,3 (a corrida continua travada em 210)."),
    CI("ci-rin", "Instinto do Rin", "🐍", "A frieza do Itoshi mais novo para destruir o adversário.", "Chute e Drible ×1,25; com o Sae no time, os dois ganham +10% em tudo."),
    CI("ci-hugo", "Faixa Vermelha do Hugo", "🎗️", "A faixa do ponta francês que vive na linha de fundo.", "Jogando de Ala Of: Drible e Velocidade ×1,25 e passe para o Pivô 15% mais preciso."),
  ];
  BL.CHAR_ITEM_LIST.forEach((it) => { BL.ITEM_BY_ID[it.id] = it; it.who = (BL.CHARACTERS.find((c) => c.id === it.char) || {}).name || it.char.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "); }); // fora de BL.ITEMS: não cai em baú, Expedição nem Loja
  BL.charItemOk = (p, it) => !!(p && it && it.ci && p.charId === it.char && BL.CONFIG.RARITIES.findIndex((r) => r.id === p.rarity) >= BL.CONFIG.RARITIES.findIndex((r) => r.id === BL.CONFIG.CHAR_ITEM_MIN));

  // v473 · desenho dos itens (SVG 64×64, sem arquivo): forma pelo slot, padrão por item
  let svgN = 0;
  const PAT = {
    liso: () => "",
    listras: (a, b) => [10, 22, 34, 46].map((x) => `<rect x="${x}" y="0" width="6" height="64" fill="${b}"/>`).join(""),
    faixa: (a, b) => `<path d="M0 30 L64 22 L64 32 L0 40Z" fill="${b}"/>`,
    raio: (a, b) => `<path d="M30 14 L22 34 L31 34 L26 52 L42 28 L33 28 L38 14Z" fill="${b}"/>`,
    garras: (a, b) => [0, 8, 16].map((d) => `<path d="M${14 + d} 26 l6 6 l-6 6" stroke="${b}" stroke-width="3" fill="none"/>`).join(""),
    vento: (a, b) => `<path d="M6 28 Q24 22 40 30 M10 36 Q28 30 50 38" stroke="${b}" stroke-width="3" fill="none"/>`,
    chamas: (a, b) => `<path d="M4 48 Q10 30 16 40 Q20 24 28 38 Q32 22 40 36 Q46 28 52 44 L52 64 L4 64Z" fill="${b}"/>`,
    degrade: (a, b, id) => `<defs><linearGradient id="g${id}" x1="0" x2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="64" height="64" fill="url(#g${id})"/>`,
    coroa: (a, b) => `<path d="M20 34 L22 24 L27 30 L32 20 L37 30 L42 24 L44 34Z" fill="${b}"/>`,
    estrelas: (a, b) => [[18, 30], [32, 24], [46, 32]].map(([x, y]) => `<path d="M${x} ${y - 5} l1.6 3.4 3.6 .4 -2.7 2.5 .8 3.6 -3.3 -1.9 -3.3 1.9 .8 -3.6 -2.7 -2.5 3.6 -.4Z" fill="${b}"/>`).join(""),
    costura: (a, b) => `<path d="M8 34 L56 30" stroke="${b}" stroke-width="2" stroke-dasharray="3 3" fill="none"/>`,
    pontos: (a, b) => [16, 28, 40, 52].flatMap((y) => [24, 32, 40].map((x) => `<circle cx="${x + (y % 24 ? 4 : 0)}" cy="${y}" r="2.6" fill="${b}"/>`)).join(""),
    rebites: (a, b) => [[22, 14], [42, 14], [22, 50], [42, 50]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${b}"/>`).join("") + `<rect x="22" y="24" width="20" height="18" rx="3" fill="none" stroke="${b}" stroke-width="2.5"/>`,
    tijolos: (a, b) => [14, 24, 34, 44, 54].map((y, i) => `<path d="M0 ${y} H64" stroke="${b}" stroke-width="2"/>` + [0, 1, 2].map((k) => `<path d="M${16 + k * 16 + (i % 2) * 8} ${y - 10} V${y}" stroke="${b}" stroke-width="2"/>`).join("")).join(""),
    chevron: (a, b) => [20, 32, 44].map((y) => `<path d="M16 ${y} L32 ${y + 8} L48 ${y}" stroke="${b}" stroke-width="4" fill="none"/>`).join(""),
    numero: (a, b, id, n) => `<text x="32" y="44" font-family="Arial Black,Arial" font-weight="900" font-size="22" text-anchor="middle" fill="${b}">${n}</text>`,
    escamas: (a, b) => [18, 28, 38, 48].flatMap((y, i) => [20, 32, 44].map((x) => `<path d="M${x - 6 + (i % 2) * 6} ${y} q6 8 12 0" stroke="${b}" stroke-width="2" fill="none"/>`)).join(""),
    escudo: (a, b) => `<path d="M32 18 L44 22 L42 38 Q38 46 32 48 Q26 46 22 38 L20 22Z" fill="${b}"/><path d="M32 24 L38 26 L37 36 Q35 40 32 42Z" fill="${a}"/>`,
    torre: (a, b) => `<path d="M22 48 V28 H26 V24 H30 V28 H34 V24 H38 V28 H42 V48Z" fill="${b}"/><rect x="29" y="38" width="6" height="10" fill="${a}"/>`,
    regata: () => "",
    gola: (a, b) => `<path d="M24 10 L32 22 L40 10" stroke="${b}" stroke-width="4" fill="none"/><circle cx="32" cy="27" r="1.6" fill="${b}"/><circle cx="32" cy="33" r="1.6" fill="${b}"/>`,
    olho: (a, b) => `<path d="M14 34 Q32 20 50 34 Q32 48 14 34Z" fill="none" stroke="${b}" stroke-width="3"/><circle cx="32" cy="34" r="5" fill="${b}"/>`,
    metade: (a, b) => `<rect x="32" y="0" width="32" height="64" fill="${b}"/>`,
    diagonal: (a, b) => `<path d="M0 14 L14 0 L64 50 L50 64Z" fill="${b}"/>`,
  };
  const SHAPE = {
    camisa: { d: "M20 8 L27 11 Q32 15 37 11 L44 8 L58 18 L52 29 L46 25 L46 58 L18 58 L18 25 L12 29 L6 18Z", sleeveless: "M22 8 L27 11 Q32 15 37 11 L42 8 L45 14 Q42 22 46 26 L46 58 L18 58 L18 26 Q22 22 19 14Z" },
    chuteira: { d: "M5 41 Q5 31 13 29 L25 27 Q29 17 38 15 L47 15 Q51 23 53 30 L58 33 Q62 37 60 43 L7 45 Q5 44 5 41Z" },
    caneleira: { d: "M20 6 L44 6 Q50 8 50 16 L48 50 Q46 58 32 60 Q18 58 16 50 L14 16 Q14 8 20 6Z" },
  };
  const GLYPH = {
    caderno: (a, b) => `<rect x="16" y="8" width="34" height="48" rx="3" fill="${a}"/><rect x="16" y="8" width="7" height="48" fill="${b}"/>${[18, 26, 34, 42].map((y) => `<path d="M27 ${y} H45" stroke="${b}" stroke-width="2"/>`).join("")}`,
    apito: (a, b) => `<path d="M10 30 Q10 20 22 20 H48 L54 26 V32 H34 Q34 44 22 44 Q10 44 10 32Z" fill="${a}"/><circle cx="22" cy="32" r="5" fill="${b}"/><path d="M48 20 Q52 10 42 8" stroke="${b}" stroke-width="2.5" fill="none"/>`,
    prancheta: (a, b) => `<rect x="12" y="10" width="40" height="48" rx="4" fill="#5a3a22"/><rect x="16" y="16" width="32" height="38" fill="${a}"/><rect x="24" y="6" width="16" height="8" rx="2" fill="#aeb8cc"/><circle cx="24" cy="28" r="3" fill="${b}"/><circle cx="40" cy="40" r="3" fill="#ff3f5e"/><path d="M26 30 L37 38" stroke="${b}" stroke-width="2" stroke-dasharray="3 2"/>`,
    cronometro: (a, b) => `<circle cx="32" cy="36" r="20" fill="${a}" stroke="${b}" stroke-width="4"/><rect x="28" y="8" width="8" height="8" rx="2" fill="${b}"/><path d="M32 36 V24 M32 36 L40 40" stroke="#111522" stroke-width="3"/>`,
    livro: (a, b) => `<path d="M8 14 Q20 10 32 16 Q44 10 56 14 V52 Q44 48 32 54 Q20 48 8 52Z" fill="${a}"/><path d="M32 16 V54" stroke="${b}" stroke-width="3"/><path d="M14 22 Q22 20 28 24 M36 24 Q42 20 50 22" stroke="${b}" stroke-width="2" fill="none"/>`,
    cofre: (a, b) => `<ellipse cx="32" cy="36" rx="22" ry="17" fill="${a}"/><circle cx="50" cy="34" r="6" fill="${a}" stroke="${b}" stroke-width="2"/><rect x="26" y="20" width="12" height="3" rx="1" fill="${b}"/><path d="M18 50 V56 M42 50 V56" stroke="${b}" stroke-width="5"/><circle cx="20" cy="32" r="2" fill="${b}"/><circle cx="32" cy="10" r="6" fill="#ffd23f" stroke="#b37d00" stroke-width="2"/>`,
    pochete: (a, b) => `<path d="M2 24 Q32 34 62 24" stroke="#2a2f45" stroke-width="5" fill="none"/><rect x="14" y="26" width="36" height="24" rx="10" fill="${a}"/><path d="M16 34 H48" stroke="${b}" stroke-width="2.5"/><circle cx="32" cy="42" r="3" fill="${b}"/>`,
    contrato: (a, b) => `<path d="M14 6 H42 L52 16 V58 H14Z" fill="${a}"/>${[22, 30, 38].map((y) => `<path d="M20 ${y} H46" stroke="#7f8db3" stroke-width="2"/>`).join("")}<path d="M20 50 Q26 42 30 50 T42 48" stroke="${b}" stroke-width="2.5" fill="none"/>`,
    maleta: (a, b) => `<rect x="8" y="20" width="48" height="34" rx="5" fill="${a}"/><path d="M24 20 V14 H40 V20" stroke="${b}" stroke-width="4" fill="none"/><rect x="8" y="32" width="48" height="5" fill="${b}"/><rect x="28" y="30" width="8" height="9" rx="1" fill="#fff2c4"/>`,
    cartao: (a, b) => `<rect x="6" y="16" width="52" height="34" rx="5" fill="${a}"/><rect x="6" y="22" width="52" height="6" fill="#3a2400"/><rect x="12" y="34" width="10" height="8" rx="1.5" fill="${b}"/><path d="M28 42 H50" stroke="#3a2400" stroke-width="2.5"/>`,
    chave: (a, b) => `<circle cx="20" cy="22" r="11" fill="none" stroke="${a}" stroke-width="6"/><path d="M28 30 L52 54 M44 46 L50 40 M48 50 L54 44" stroke="${a}" stroke-width="6" stroke-linecap="round"/><circle cx="20" cy="22" r="3" fill="${b}"/>`,
    lupa: (a, b) => `<circle cx="26" cy="26" r="15" fill="${a}" stroke="${b}" stroke-width="5"/><path d="M37 37 L54 54" stroke="${b}" stroke-width="8" stroke-linecap="round"/><path d="M18 22 Q22 16 28 16" stroke="#fff" stroke-width="2.5" fill="none"/>`,
    mapa: (a, b) => `<path d="M6 14 L22 8 L42 14 L58 8 V50 L42 56 L22 50 L6 56Z" fill="${a}"/><path d="M22 8 V50 M42 14 V56" stroke="#c9b48a" stroke-width="2"/><path d="M14 40 Q24 30 32 34 T46 22" stroke="#7f8db3" stroke-width="2" stroke-dasharray="3 3" fill="none"/><path d="M42 18 L50 26 M50 18 L42 26" stroke="${b}" stroke-width="3.5"/>`,
    bussola: (a, b) => `<circle cx="32" cy="32" r="24" fill="${a}"/><circle cx="32" cy="32" r="18" fill="#fff2c4"/><path d="M32 14 L37 32 L32 50 L27 32Z" fill="${b}"/><path d="M32 32 L37 32 L32 50 L27 32Z" fill="#5a6680"/><circle cx="32" cy="32" r="2.5" fill="#111522"/>`,
    cone: (a, b) => `<path d="M24 12 Q32 6 40 12 L50 50 H14Z" fill="${a}"/><path d="M20 30 H44 M17 40 H47" stroke="${b}" stroke-width="5"/><rect x="8" y="50" width="48" height="6" rx="2" fill="${a}"/>`,
    bola: (a, b) => `<circle cx="32" cy="34" r="22" fill="${a}"/><path d="M12 30 Q32 40 52 30 M18 48 Q32 38 46 48 M32 12 V56" stroke="${b}" stroke-width="2.5" fill="none"/>`,
    escada: (a, b) => `<path d="M14 6 L22 58 M50 6 L42 58" stroke="${a}" stroke-width="5"/>${[14, 26, 38, 50].map((y) => `<path d="M${15 + y * 0.12} ${y} H${49 - y * 0.12}" stroke="${a}" stroke-width="4"/>`).join("")}<rect x="0" y="0" width="64" height="64" fill="none" stroke="${b}" stroke-opacity="0"/>`,
    colete: (a, b) => `<path d="M20 8 L28 12 H36 L44 8 L50 20 V56 H14 V20Z" fill="${a}"/>${[26, 36, 46].map((y) => `<rect x="18" y="${y}" width="28" height="6" rx="2" fill="${b}"/>`).join("")}`,
    trofeu: (a, b) => `<path d="M18 8 H46 V22 Q46 38 32 40 Q18 38 18 22Z" fill="${a}"/><path d="M18 14 H10 Q10 28 20 28 M46 14 H54 Q54 28 44 28" stroke="${a}" stroke-width="4" fill="none"/><rect x="28" y="40" width="8" height="8" fill="${a}"/><rect x="18" y="48" width="28" height="8" rx="2" fill="${b}"/><path d="M32 16 l2 4 4 .5 -3 3 .8 4 -3.8 -2 -3.8 2 .8 -4 -3 -3 4 -.5Z" fill="${b}"/>`,
  };
  BL.itemSvg = (it) => {
    if (it && BL.IT2[it.id] != null) return BL.it2Art(it.id); /* v532: arte do Mickey (atlas2) */
    if (it && it.emo) return `<span class="it-svg it-emo">${it.emo}</span>`; // v527: item de personagem (reserva sem arte)
    if (it && it.img != null) return `<span class="it-svg it-img" style="background-position:${(it.img % 9) * 12.5}% ${Math.floor(it.img / 9) * (100 / 7)}%;background-image:url(img/itens/atlas.png?v=${BL.BUILD})"></span>`; // v522: arte do Mickey numa folha só (limite de arquivos do artifact)
    if (!it || !it.art) return "";
    const n = ++svgN, A = it.art, a = A.a, b = A.b;
    let body;
    if (it.mgr) body = (GLYPH[A.g] || GLYPH.caderno)(a, b);
    else {
      const sh = SHAPE[it.slot] || SHAPE.camisa, d = it.slot === "camisa" && A.p === "regata" ? sh.sleeveless : sh.d;
      const num = it.id === "cm-11" ? 11 : it.id === "ca-sub20" ? 20 : 10;
      const pat = (PAT[A.p] || PAT.liso)(a, b, n, num);
      const extra = it.slot === "chuteira" ? `<path d="M7 45 L60 43 L60 47 Q58 50 54 50 L10 50 Q6 49 7 45Z" fill="#111522"/>${[14, 26, 40, 52].map((x) => `<rect x="${x}" y="49" width="4" height="5" rx="1" fill="#aeb8cc"/>`).join("")}<path d="M30 24 L38 22 M31 28 L39 26" stroke="#ffffff" stroke-opacity=".8" stroke-width="1.6"/>`
        : it.slot === "caneleira" ? `<path d="M20 9 Q32 6 44 9" stroke="#ffffff" stroke-opacity=".5" stroke-width="2" fill="none"/>` : "";
      body = `<defs><clipPath id="c${n}"><path d="${d}"/></clipPath></defs><path d="${d}" fill="${a}"/><g clip-path="url(#c${n})">${pat}</g><path d="${d}" fill="none" stroke="#0b0f24" stroke-opacity=".55" stroke-width="2"/>${extra}`;
    }
    return `<svg class="it-svg" viewBox="0 0 64 64" width="1em" height="1em" aria-hidden="true">${body}</svg>`;
  };
})();
