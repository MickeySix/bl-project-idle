# 4. Progressão

[← Índice](README.md)

Arquivos: `game/js/game.js` (objeto `G`: lógica e estado), `game/js/config.js` (`C = BL.CONFIG`: `MAPS`, recompensas, baús, Wildcard, Expedição, Boss, Diária), `game/js/ui.js` (janelas `MODALS.*` e laços de tempo; aqui só as regras, o visual está em [05](05-interface.md)). Jogadores, raridade, roubo e escalação estão em [03](03-jogadores.md). O save é descrito em [06](06-contas-e-save.md).

Resumo do loop: partidas rendem XP, Gold, EV, baús e a chance de roubar um jogador; o idle paralelo vem do Wildcard, da Expedição, da Diária e do Boss. Tudo que conta tempo real (Wildcard, Expedição, Boss) segue contando com o jogo fechado, calculado na volta pelos timestamps do save.

## 4.1 Mapas e modos

| # | Nome | Modo | Níveis dos inimigos | Libera com | Boss (fase 10) | Arena | Buff do Boss / debuff seu |
|---|---|---|---|---|---|---|---|
| 1 | Seleção | 1×1 | 1–100 | 1 jogador | Shoei Barou, "O Rei", Épico Nv 100 (135 pontos, Ego Puro), time "Reino do Rei" | Cela do Rei | +10% / −5% |
| 2 | Segunda Seleção | 2×2 | 101–200 | 2 jogadores | Seishiro Nagi, "O Gênio", Raro Nv 200 (118, Fantasista), "Time do Gênio" | Sala do Gênio | +12% / −6% |
| 3 | Terceira Seleção | 3×3 | 201–300 | 3 jogadores | Meguru Bachira (v349, era Rin), "O Monstro", Épico Nv 300 (152, Predador), "Time do Monstro" | Toca do Monstro | +14% / −7% |
| 4 | U-20 | 4×4 | 301–400 | 4 jogadores | Sae Itoshi, "O Mágico do Meio", Lendário Nv 400 (167, Visionário), "Seleção U-20" | Estádio Nacional U-20 | +15% / −8% |
| 5 | Liga Neo Egoísta | 4×4 | 401–500 | Boss do mapa 4 | Hyoma Chigiri, "O Velocista", Épico Nv 500 | Pista do Velocista | +16% / −8% |
| 6 | Muralha | 4×4 | 501–600 | Boss do mapa 5 | Rensuke Kunigami, "O Herói", Épico Nv 600 | Muralha do Herói | +17% / −9% |
| 7 | Cemitério | 4×4 | 601–700 | Boss do mapa 6 | Don Lorenzo, "O Zumbi", Lendário Nv 700 | Cemitério do Zumbi | +18% / −9% |
| 8 | Abismo | 4×4 | 701–800 | Boss do mapa 7 | Rin Itoshi, "O Destruidor", Lendário Nv 800 (v574, sem keepPool) | Abismo do Rin | +19% / −10% |
| 9 | Palácio | 4×4 | 801–900 | Boss do mapa 8 | Hugo Vivian, "O Ala Lendário", Lendário Nv 900 | Palácio do Ala | +20% / −10% |
| 10 | Trono do Ego | 4×4 | 901–1000 | Boss do mapa 9 | Yoichi Isagi, "O Egoísta Supremo", Despertado Nv 1000 | Trono do Ego | +22% / −11% |

- v536 (Mickey: níveis até 1000, 10 mapas de 100 níveis): mapas 5 a 10 abrem só depois de vencer o Boss do anterior em qualquer dificuldade (`G.mapUnlocked`, `G.mapEverCleared`). Os Bosses deles têm `keepPool: true` (continuam como adversário comum e nas opções iniciais). Os Bosses são provisórios até o Mickey mandar os personagens famosos escolhidos (comentário em `C.MAPS`): 5 Ryusei Shidou, 6 Oliver Aiku, 7 Alexis Ness, 8 Rin Itoshi, 9 Noel Noa, 10 Michael Kaiser. A arte dos mapas novos também vem do Mickey. As dificuldades agora liberam vencendo o Boss do mapa 10, e os níveis somados param no 1000. A janela Mapa mostra os 10 atos em 2 linhas.

- Dados em `C.MAPS[i]` (`size`, `levelMin/Max`, `boss{ charId, title, rarity, level, stats, nature, team, arena }`). O número de jogadores do modo (`size`) escolhe a lista de táticas (`C.TACTICS[size]`): 1×1 uma, 2×2 e 3×3 por número de atacantes, 4×4 as três formações pedra-papel-tesoura (detalhe em [02 §2.11](02-motor-e-ia.md#211-formações-e-estilos-44)).
- `G.mapUnlocked(i)`: o elenco (sem quem está em Expedição ou no Boss) tem pelo menos `size` jogadores, ou o modo dev está ligado.
- `G.switchMap(i, fase = 1)`: troca de mapa, zera `runSteals` e começa a partida. A janela "Mapas" (dock) lista os 4 e abriga o mapa de fases.
- **Arena do Boss**: só na fase 10. `BL.Match` recebe `arena` e multiplica todos os status do time dele por `1 + bossBuff` e os seus por `1 − userDebuff` (`arenaMult`). O fundo usa `tint`, `vignette` e, na de Sae, `grad` (rosa-vermelho para verde); o motor desenha vinheta que "respira", sem texto no centro.
- Nos modos maiores o Boss entra com escoltas sorteadas no nível da fase 10 ([03 §3.10](03-jogadores.md#310-inimigos)).
- Nomes de exibição do mapa de fases (provisórios, `C.MAP_TITLES`): Vale do Ego, Fortaleza Azul, Ninho do Predador, Arena da Coroa. Os nomes reais ainda são pergunta aberta para o Mickey.

## 4.2 Fases (`state.progress`)

```js
progress: { map, stage, runSteals, runs, bossWins, repeat, unlocked2x2, cleared: { [mapIdx]: true } }
```

- 10 fases por mapa (`C.STAGES_PER_MAP`); a 10ª é a do Boss (`G.isBoss()`). O rótulo é `mapa-fase` (`G.stageLabel`, ex. `2-7`).
- **Vitória** numa fase normal: avança uma fase, a não ser que "Repetir fase" (`progress.repeat`, checkbox `#repeatToggle`) esteja ligado.
- **Derrota** numa fase normal: repete a fase com novos adversários.
- **Fase 10**, ganhando ou perdendo: volta para a fase 1 do mapa com novos adversários (`runs++`, `runSteals = 0`). Vencer o Boss soma `bossWins`.
- **Zerar o modo**: a primeira vitória contra o Boss do mapa marca `progress.cleared[mapa]`. Daí em diante as casas do mapa de fases viram botões (`G.canPickStage`, `G.pickStage(n)`) e dá para jogar qualquer fase daquele mapa. No modo dev todas ficam livres.
- **Fases já passadas** (v615): mesmo sem zerar, `G.canPickStage(n)` libera as fases até `progress.reach` (a mais longe da volta atual do mapa); escolher uma anterior não perde o avanço. `reach` volta a 1 ao recomeçar o mapa, trocar de mapa ou de dificuldade.
- **Mapa de fases** (`renderStageMap` em ui.js; desde a v224 mora dentro da janela "Mapas", `#stageMap`): nós `done`/`now`/`lock`. O Boss é sempre vermelho com uma coroa. No treino, a fase atual pulsa como "JOGAR" (`data-play`): clicar sai do treino e começa o farm (`G.playStage`).

### 4.2b Dificuldades (v264)

- `C.DIFFICULTIES` (config.js): Normal (+0 Nv, XP/Gold ×1), Pesadelo (+100, ×1,5), Inferno (+200, ×2), Tormento (+300, ×3). Escolha do Mickey (2026-10-12).
- `progress.diff` (atual, padrão 0) e `progress.diffMax` (maior liberada). `G.diff()`, `G.diffUnlocked(d)` (dev libera todas), `G.setDiff(d)`: troca e volta para a fase 1 do mapa atual.
- Os níveis somam em todos os inimigos e reservas, Boss incluso (`startMatch`, teto `PLAYER_MAX_LEVEL`). O multiplicador vale para XP e Gold da partida (`endMatch`), não para EV, baús ou roubo.
- Vencer o Boss do último mapa (Ato 4) libera a próxima dificuldade (nota no registro).
- "Zerado" é por dificuldade: `progress.cleared` usa a chave `G.clearKey(i)` (Normal = número do mapa, como antes; outras = `"d:i"`).
- Interface na janela Mapa do trilho ([05](05-interface.md)).

## 4.3 Recompensas da partida (`G.endMatch`)

Recompensas da partida são só XP, Gold, EV e a chance de roubo (regra do Mickey). Baús são um extra separado ([4.4](#44-baús)). Partidas de treino não pagam nada.

```
XP (mapa 1, 1×1) = 14 + 6 × (fase − 1)   (XP_BASE, XP_PER_STAGE) → 1-1: 14, 1-9: 62, + bônus do X1
XP (mapas 2-10)  = pace[mapa] × nível médio dos inimigos (sem a dificuldade)   (v585, C.XP_RULE.pace 3,2 / 2,2 / 1,4 / 0,25…)
× early[mapa] nos mapas 1-3        (v668, C.XP_RULE.early 3 / 5 / 6; teto de níveis por partida maxByMap 6 / 4 / 3, depois 3)
× raridade média dos inimigos     (C.XP_RULE.rar: Comum 1 … Lendário 1,5, Despertado 1,75, Shiny +0,25; não vale no Time Dourado)
Gold =  6 + 3 × (fase − 1)        (GOLD_BASE, GOLD_PER_STAGE) → 1-1: 6, 1-9: 30
Boss: ×3                          (BOSS_REWARD_MULT)        → fase 10: XP 204, Gold 99
Derrota: ×0,5                     (LOSS_REWARD_MULT), arredondado
EV no banco: vitória 4, derrota 1, ×3 no Boss
```

- **v585 (Mickey) · ritmo da progressão:** rápido até o 4×4, idle de verdade depois. Meta (21 partidas por hora): mapa 1 ~3-4 h, mapa 2 ~7 h, mapa 3 ~10 h (4-1 em ~21 h de jogo), mapa 4 ~16 h, mapas 5 a 10 ~85 h cada. Conta em `G.matchXpBase`/`G.rarXp`/`G.enemyLv`; estudo em `docs/progressao/proposta-xp-ate-4x4.md`.
- **Teto** (`G.giveXp(xp, lista, noAcc, ref)`): numa partida cada jogador sobe no máximo `maxLevels` 3 níveis (o XP que sobra se perde). v586 (Mickey): sem reforço extra para quem está atrasado; o roubado de nível baixo já sobe rápido porque cada nível dele custa pouco. A conta (técnico) recebe o XP no ritmo antigo (`ref.acc`), para os goleiros não subirem antes.
- **Começo tranquilo** (v587, `C.EASY_MODES` por tamanho do time, em `BL.makeEnemy`): inimigos comuns (não o Boss nem Shiny) do 1×1 até Raro e status ×0,9; do 2×2 até Épico e ×0,93; do 3×3 até Épico. E o nível relativo pesa menos nesses modos (`C.LEVEL_REL_EXP` 1 no 1×1 ao 3×3; 1,5 no 4×4, no engine `e.rel`). Medido (time de Comuns, 40 partidas por ponto): no mesmo nível 1×1 ~63%, 2×2 ~55%, 3×3 ~47%; 20 níveis abaixo 2×2 ~50%, 3×3 ~27%; 50 abaixo 5-12%; 100 abaixo 0-7%. O 4×4 não muda.
- O modo dormir (`G.sleepRate`) usa a mesma conta, com o nível do meio da fase e raridade 1,15.

- A fórmula usa só o número da fase, não o mapa: os mapas 2–4 pagam igual ao 1.
- O XP vai para os escalados, reservas que entraram e a conta ([03 §3.9](03-jogadores.md#39-nível-e-xp)); Gold soma em `state.gold`; EV em `state.evPoints`.
- A tentativa de roubo segue [03 §3.11](03-jogadores.md#311-roubo-de-jogador).
- O Striker Analyser (`state.analyzer`, `MODALS.analyser`) soma partidas, vitórias, derrotas, XP, Gold ganho (partidas e baús), Gold gasto (só compras da Loja), gols pró e contra, roubos e baús abertos; mostra lucro, aproveitamento e XP por hora desde `since`. `G.resetAnalyzer()` zera.
- O resultado (`matchEnd`) mostra toasts de nível, a roleta/pop-up de roubo (`stealRoulette`, `#stealPop`) e a nota de progressão. A próxima partida começa sozinha 3,4 s depois de uma vitória ou 2,6 s depois de uma derrota.
- Cada partida normal gera também um registro para o Claude ler (`G.recStart/recEnd`, ver [06 §6.5](06-contas-e-save.md#65-registro-de-partidas)).
- A partida acaba quando o relógio termina (2 tempos de 60 s), com 4 gols de diferença ou no gol de ouro; ver 02.

## 4.4 Baús

- v541 (Mickey): baú comum e baú raro **nunca** dão item lendário (peso 0) e quase não dão épico (comum 0,5%, raro 2%). Baú épico e lendário seguem misturados (o lendário não dá só item lendário, só tem mais chance).

Dois tipos (v265; desde a v267 todos ficam na janela Espólios e nada aparece no campo). Números em `config.js`, primeira proposta do Claude:

| Tipo | Como cai | Gold | Raridade do item (comum/incomum/raro/épico/lendário) |
|---|---|---|---|
| **Comum** (`"padrao"`, madeira, card branco) | `CHEST_STD_PER_10S` = 1% a cada 10 s de partida de verdade (fora do treino, sem pausa) ≈ 3,5 por hora (v477; era 2%) | 3–12 | 70 / 22 / 6,5 / 1,4 / 0,1 |
| **Raro** (`"azul"`, card azul) | 8% a cada gol seu (`CHEST_ON_GOAL`) e 10% ao vencer (`CHEST_ON_WIN`) (v477; eram 30% e 25%) | 15–40 | 38 / 32 / 20 / 8 / 2 |
| **Épico** (`"epico"`, card roxo, v380) | 6% ao vencer (`CHEST_EPIC_ON_WIN`) | 50–120 | 12 / 23 / 33 / 25 / 7 |
| **Lendário** (`"lendario"`, card dourado, v380) | 1,5% ao vencer (`CHEST_LEG_ON_WIN`) | 150–400 | 0 / 8 / 27 / 40 / 25 |

- Guardados em `state.chests` (`{ id, kind }`), sem limite desde a v362 (antes `CHEST_MAX_PENDING` = 6 de cada tipo); "Abrir todos" (`G.openAllChests(kind)`) abre todos ou só um tipo; (o limite antigo fazia o baú novo se perder com o tipo cheio). Baús de saves antigos (sem `kind`) contam como raros.
- Tabelas em `C.CHEST_KINDS`. `G.addChest(kind)`, `G.stdChestTick()` (ui.js chama a cada 10 s), `G.openChest(id)` → `{ gold, item, kind, drinks }`. v522 (Mickey): cada baú também sorteia bebida à parte (`C.CHEST_DRINK`: comum 30%, raro 40%, épico 60%, lendário 100% com 2; Suco de Laranja, Água de Coco e Vitamina de Banana, que estão em `C.CONSUMABLES` com `chest: true`, só caem de baú e vendem a 5 Gold).
- Desde a v380 (Mickey), abrir no Espólios (um ou "Abrir todos") não mostra mais animação nem resumo: só itens de `LOOT_NOTE_MIN` ("raro") para cima avisam no canto superior direito (`lootNotes`, até 5 por vez, ~2 s com fade via Web Animations). O item vai para `state.inventory`, visto na Mochila. `chestOpenFx` ficou só para a janela antiga "Baús".
- Soma Gold ganho e baús abertos no Analyser. Os baús coloridos do Boss são outro sistema ([4.12](#412-boss-chefes-e-raids)).

## 4.5 Energia: Água, Gatorade e Módulo de cura

A energia dos jogadores cai com toda ação e abaixo de 50 os status despencam (ver [02 §2.3](02-motor-e-ia.md#23-status-em-campo)). Os itens que repõem energia ficam em `state.cons = { agua, gatorade }` (`G.cons()`), definidos em `C.CONSUMABLES`:

| Item | Preço (Loja) | Efeito |
|---|---|---|
| Água 💧 | 10 Gold | +40 de energia |
| Isotônico 🧃 | 20 Gold | +70 de energia (v475) |
| Gatorade ⚡ | 30 Gold | +100 (energia cheia) |

- **Origem**: comprados na Loja com Gold (`G.buyCons`), ou ganhos na Diária e na Expedição (quando cai, 70% Água e 30% Gatorade).
- **Uso manual**: botões 💧/⚡ no card de cada jogador em "Meu time" (`healRow`, atualizado a cada 1 s). `G.useCons(uid, id)` só funciona com a partida em andamento (inclui o treino em dois times, onde os dois lados são seus; não o treino solo), com item no estoque, energia < 100 e fora da espera `HEAL_COOLDOWN = 30 s` de jogo por jogador (`e.healT`). No Vestiário não há espera.
- **Módulo de Descanso** (v509 como Módulo de cura, renomeado na v512; Mickey): item permanente da Loja de Diamantes (`mod-cura`, 250 ◆ proposta, `state.healModule`). Em todo intervalo, `G.halftime` deixa a energia do time em campo em 100, sem gastar itens. Compra única.
- **Cura automática** (até a v508 chamada de Módulo de cura; benefício VIP, toggle `#gatoradeToggle` = `settings.autoGatorade`): `G.autoHeal()`, chamado a cada 1 s de jogo (`m.onSample`), usa Gatorade (ou Água, se não houver Gatorade) em quem está abaixo de `HEAL_AUTO_BELOW = 50` (onde os status começam a cair), respeitando a mesma espera. Sem item no estoque, não cura.
- **Intervalo** (`G.halftime`): os dois times ganham descanso natural de `HALFTIME_REST = 15` de energia; o VIP com o Módulo ligado ainda gasta itens em quem estiver abaixo de 50, sem espera. Os não VIP usam os botões no Vestiário (`VESTIARIO_SECONDS` 15 s, tela de trocas e formação em 05).
- `GATORADE_RESTORE` e `GATORADE_COST` ainda existem em `config.js`, mas nada os lê mais (sobra do Gatorade antigo do intervalo).

## 4.6 Modo treino

- `state.training = true`: todo jogo novo começa nele, e ele é infinito (sem relógio nem fim). `G.setTraining(on)` liga e desliga e reinicia a partida; o botão `#trainBtn` ("Modo treino" / "Sair do treino") e o "JOGAR" do mapa de fases (`G.playStage`) saem dele.
- Sem adversário, XP, Gold, EV, baú ou roubo.
- `G.startTraining(mine)`, de dois jeitos:
  - **Treino em dois times** (v161, `scrimmage`): se `G.trainPool()` tem 2 ou mais jogadores livres (elenco que não está em Wildcard, Expedição ou Boss, escalados primeiro, até `2 × TRAINING_MAX` = 8), eles se dividem em dois times (desde a v280 o seu lado é a escalação, completada com o elenco livre até 4 e o resto vira o time B; antes eram as posições pares/ímpares do pool e o card Meu time não batia com a escalação; metade de cada um ataca) com goleiros nos dois gols. É uma partida normal sem relógio e sem fim.
  - **Escolher quem treina** (v295): botão no card Adversário abre `MODALS.trainPick()` (classes `tp-*`, rascunho `trUi`): 4 slots Meu time × 4 slots Adversário; clicar num slot mostra os jogadores livres (`G.trainFree`) com filtro de posição (Todos/ATA/ALO/ALD/ZAG). "Começar treino" grava `state.trainSides = { a, b }` (`G.setTrainSides`) e reinicia o treino; sem ninguém no Adversário o Meu time treina sozinho. "Automático" apaga `trainSides` e volta à divisão automática. No treino a stamina é infinita (`Match.drain` não gasta com `training`/`scrimmage`).
  - **Sair do treino** (v296/v297): o botão não começa a fase direto; `exitTrainingMap` congela o treino (`kickoff(0)` + `paused`, todos na posição inicial; fechar o Mapa sem escolher volta o treino) e abre o Mapa (float `mapa`) com o aviso "Escolha a fase no Mapa para começar". Ao clicar na fase, `kickoffCountdown` mostra 3, 2, 1, "Valendo!" (`.kick-cd`) e chama `G.playStage`. Apito: `C.WHISTLE_FILE` (vazio até o Mickey aprovar `docs/sons/apito-1-longo.mp3` ou `apito-2-curto-longo.mp3`).
  - **Treino solo**: só o seu time (1 a 4 escalados, `TRAINING_MAX`), todos atacando, contra o seu goleiro no gol para onde o time chuta. A IA troca passes (peso `0,8/(n−1)`), tabela e chuta de todas as distâncias (alcance 420); a regra de caminho livre não vale.
- A escalação muda na hora (`applyLineup` reinicia a partida). O mapa e a fase escolhidos valem para quando se sai do treino.

## 4.7 Wildcard

Campo de treino idle para quem não está escalado. Painel `#wcPanel` com a animação no topo do pop-up `MODALS.wildcard()` (dock "Wildcard").

- Estado: `state.wildcard = { slots: [uid|null ×4], unlocked, last, acc: {uid: fração de XP}, dropAcc }` (`G.wc()`).
- 4 slots (`WILDCARD_SLOTS`), 1 liberado (`WILDCARD_SLOTS_START`). Os slots 2–4 aparecem "Em breve" com 💎 ("Libera com Diamantes"; ainda sem fluxo de compra).
- **XP**: 6 XP/min no total (`WILDCARD_XP_PER_MIN`), dividido entre quem treina (`G.wcRate(n) = 6/n`: 1 = 100%, 2 = 50% cada…). Conta também com o jogo fechado, até 8 h por apuração (`WILDCARD_OFFLINE_MAX_MIN` = 480). Não dá XP de conta, status nem EV.
- **Drops**: 2% por jogador-minuto (`WILDCARD_DROP_PER_MIN`, não dividido) de um item sorteado por `ITEM_RARITY_WEIGHT`, direto no `state.inventory`.
- `G.wcTick()` roda a cada 5 s (`setInterval` em `ui.js`) e também ao adicionar/remover. Tira do treino quem foi escalado, saiu do elenco ou está em Expedição/Boss, soma XP e drops; no primeiro tick depois de abrir, avisa o que rendeu offline.
- `G.wcAdd(uid)` / `G.wcRemove(i)`. Elegível: jogador fora da escalação, ainda não nos slots e não ausente (`wcEligible`). No modo dev os 4 slots abrem e qualquer jogador (até escalado ou de teste) pode treinar.
- Animação (`wcDraw` em `ui.js`): 5 cenas em rodízio a cada 4 s (`WILDCARD_SCENE_SECONDS`: Academia, Chutes, Cones, Passe, Defesa), jogadores como círculos com iniciais, só pops "+XP" (cosméticos). Fica 15% mais lenta por jogador extra.

- **HUB do Wildcard (v514; Mickey 2026-10-26):** o dock "Wildcard" abre uma instância própria em tela cheia (`openHub` em `ui.js`, `#wcHub`) com a arte gerada pelo Mickey (`img/wildcard/hub.jpg`) e 3 áreas clicáveis que abrem um painel: **Cápsulas** (os 4 slots acima, treino "mental" que sobe o nível sem ser titular), **Fazenda** e **Bancada**. Desde a v520 cada área abre numa cena animada e espaçada (esteira levando o jogador até a cápsula, XP subindo ao vivo, plantio e colheita animados, criação na Bancada); detalhes em [05-interface.md](05-interface.md). O pop-up antigo continua em `MODALS.wildcardOld`. Sprites recortados em `img/wildcard/` (cápsula vazia/ocupada/bloqueada, canteiro 0–3, insumos e propostas).
  - Fazenda: `state.wildcard.farm = { plots: [{ crop, at, ready }|null ×6], unlocked, bag: {insumo: n} }` (`G.farm()`). 3 canteiros liberados (`WC_FARM.plotsStart`); 4 a 6 com Gold (`plotGold` 2.000/5.000/12.000, `G.farmUnlock()`). `G.farmPlant(i, crop)` paga a semente em Gold e marca `ready`; `G.farmLeft(i)` = ms restantes; `G.farmHarvest(i)` colhe `yield` unidades para `bag`. Conta com o jogo fechado (só timestamps).
  - Sub-itens (v525, Mickey; `WC_FARM.crops`, 28): Comum (Tufo de Grama, Gota de Suor, Cal da Linha, Cadarço Solto), Incomum (Fio da Rede, Cone, Recorte de Jornal, Lanterna, Bolsa de Gelo, 6 Faixas Coloridas `sb-faixa-<status>`, Ingresso, Apito), Raro (Eco da Torcida, Holofote, Ponteiro do Placar, Degrau, Chave do Camarote, Medalha, Luva) e Muito raro (`rarity: "epico"`: Lasca da Trave, Pena do Mascote, Chama do Ego, Purpurina Shiny). Tempo, semente e colheita pela raridade em `C.WC_TIER` (30 min/20 Gold/3–5; 1 h/100/1; 3 h/400/1; 20 h/1.500/1; copiados para cada sub-item em `database.js`). Canteiro com insumo antigo (Papel, Tinta, Selo, Ego) fica livre em `G.farm()`. Também caem fora da Fazenda (`G.dropSub(src)`, `C.WC_SUB_DROP`): baú épico 25%, lendário 60%, vitória no Boss 50% (Raro ou Muito raro). Arte: folha `img/wildcard/atlas.png` (8×8, `BL.WC_SPR`, `BL.wcSprite`, `BL.wcArt`; no HUB `WS(k)` põe a célula como fundo de um `<img>` transparente); recortes soltos em `docs/itens/arte-recortes-wildcard/`.
  - Bancada (`WC_RECIPES`, `G.canCraft(id)`, `G.craft(id)`; v525): v530 (Mickey) também faz Água (3 Gota), Isotônico (4 Gota + 2 Tufo) e Gatorade (5 Gota + 1 Bolsa de Gelo), que vão para `state.cons`; nada que sirva só para vender. 31 contratos (`ct-*` em `C.SUPPLIES` com `wc: true`, `steal` fixo e `ct` = condição), receitas da lista do Mickey (Amador 3 Tufo + 1 Gota; Profissional 5 Tufo + 2 Gota + 1 Fio; Elite 5 Tufo + 3 Gota + 1 Eco + 1 Holofote; os outros no mesmo padrão por raridade). As Propostas e o Contrato Blue Lock não têm receita (só Lojas). Contrato não se compra nem se vende. Na Mochila: v526, Proposta ou contrato no mesmo espaço único (`state.stealArm`, ver [03 §3.11](03-jogadores.md#311-roubo-de-jogador)); em `endMatch` o contrato soma (`G.contractBonus(id, { en, r, m, boss })` → `{ add, mult }`; × age depois da soma) e depois a Proposta. Apoio: `m.goalLog` e `m.behind0` (engine `scoreGoal`), `state.beatenBy` (personagens que te venceram, Revanche), `p.luxo` (Luxo: +20% de XP em 10 partidas, `giveXp`). Contrato de Amigo e Exame Médico só somam pontos (química ainda não existe; o roubado já chega com energia cheia).

## 4.8 Técnico

- `G.coach()` sorteia uma vez por save um técnico `{ first, last, nation, rarity: "comum" }` a partir de `C.COACH_NATIONS` (10 países: JPN, BRA, FRA, GER, ESP, ENG, ITA, ARG, POR, KOR, com nomes e sobrenomes típicos) e grava em `state.coach`.
- Aparece no card do dock (`#dockLead`). O XP e o nível do técnico são os da conta (`state.account`).
- O nível da conta decide o quão bem o técnico "lê" o adversário: abaixo do Nv 10 (`HINT_LV_CLEAR`) metade das dicas de pré-jogo saem vagas (`G.hintFor`), e no Vestiário só a partir do Nv 10 ele revela a formação exata (`G.vestReading`). Também define o goleiro ([03 §3.9](03-jogadores.md#39-nível-e-xp)).

## 4.9 Economia: Gold, Diamantes, Loja e VIP

- **Gold** (`state.gold`): vem de partidas, baús de partida (5–25), Expedição, Diária e baú do Boss. Gasta-se na Loja e no reset de EV (300). Analyser conta ganhos de partidas e baús, e gastos só da Loja.
- **Diamantes** (`state.diamonds`, ◆/💎): vêm da Diária (10/25/50 nos dias 5/15/25) e dos baús do Boss. Único gasto hoje: trocar nome e/ou Tag do time depois da primeira troca grátis (`G.setTeamName`, `TEAM_RENAME_DIAMONDS` = 100, valor provisório; `state.teamRenames` conta as trocas). Futuro: slots 2–4 do Wildcard. O pop-up "Adicionar Diamante" (`MODALS.buyDiamonds`, pacotes de 100/550/1.200/2.500) é só vitrine, com botões desativados "Em breve".
- **Nome e Tag do time**: `G.teamName()` (padrão "`<nome>` FC") e `G.teamTag()` (1 a 4 letras maiúsculas, `BL.cleanTag`; saves antigos usam as 3 primeiras do nome). Nome do time e do jogador exigem pelo menos `NAME_MIN` = 3 caracteres.
- **Loja** (`MODALS.loja`, dock): Água e Gatorade com Gold (`G.buyCons`), técnicos com Diamantes e, desde a v473, os 30 equipamentos e os 20 itens do treinador por Gold (`G.buyItem`, preço `C.ITEM_PRICE` pela raridade). "Loja do Boss" segue desativada. v480 (Mickey): Contrato Blue Lock só por Diamantes (`dia: 500`, Lendário, não vendável); suprimentos têm `lore` ("Para que serve") e `where` ("Onde conseguir"). v479 (Mickey): Loja só vende camisas básicas (`cb-*`, +1 em um status, `C.SHOP_SHIRT_PRICE`); itens do treinador e as outras camisas só caem nos baús (`openChest` sorteia em `BL.ITEMS` sem `shop` + `BL.MGR_ITEMS`). v478 (Mickey): itens de XP (aba XP e itens do treinador com `fx.xp`) saíram da Loja de Gold; vão para a loja de Diamantes. v477: caneleiras também saíram da compra. v476 (Mickey): chuteiras não se compram mais, só caem nos baús da partida (seguem vendáveis). v475: Isotônico; compra com quantidade (`G.buyItem(id, n)`, `G.buyCons(id, n)`, até `C.SHOP_MAX_QTY`); venda (`G.sell`, `C.SELL_RATE` = 25% do preço; itens equipados não entram); suprimentos `C.SUPPLIES` com contagem em `state.cons`: **Roubo** (Proposta Básica +3 pontos, Forte +6, de Elite +10, Contrato Blue Lock ×2 na chance; 1 ativa por vez em `state.stealArm`, `G.armSteal`, gasta no roubo da próxima vitória em `endMatch`) e **XP** (Vídeo de análise +150, Treino extra +500, Camp de elite +2.000, só para o jogador escolhido: `G.useXpItem`, `giveXp(xp, [p], true)`). Módulo de cura usa Gatorade, depois Isotônico, depois Água. v502: **Loja de Diamantes** (`MODALS.diamantes`, botão Diamantes do dock; `G.buyDia`, catálogo `C.DIA_PRODUCTS`): boosts de XP/Gold +50%, Roubo +5 pontos e, desde a v503, Caçada Shiny (chance de inimigo shiny ×3 em `BL.makeEnemy`) (`C.DIA_BOOST`, 1h, 2h ou 3h (24h saiu na v507), comprar de novo soma tempo; `state.boosts`, aplicados em `endMatch`), Contrato Blue Lock (50 ◆) (itens de XP saíram na v510 e itens do treinador na v511) e, até a v512, VIP 30 dias (`state.vipUntil`, `G.vipTick` desliga no fim; v513: saiu, a categoria VIP mostra só o Game Pass "Em breve"). Oferta do dia: um boost de 3h com −20% (`C.DIA_OFFER_OFF`), 1 por dia. Histórico em `state.diaLog` (20).
- **VIP** (`state.vip`): booleano sem fluxo de compra; hoje só o modo dev liga (`G.devGrantAll`, "Liberar tudo"). Benefícios implementados: Módulo de cura ([4.5](#45-energia-água-gatorade-e-módulo-de-cura)) e resgate/reenvio automático da Expedição ([4.11](#411-expedição)). O Perfil mostra o selo VIP. Direção planejada (Mickey): quem paga ganha conveniência idle total; quem não paga joga manualmente.
- **Modo dev** (Ctrl+Shift+D ou 5 toques no logo "BL"; chave `blpi_dev`): `G.devGrantAll` dá todos os personagens, níveis máximos, 999.999.999 de Gold e Diamantes, VIP e 9.999 Água/Gatorade; mexe também em mapa/fase, Boss (terminar agora, baús de teste), Expedição (concluir agora) e Diária (próximo dia). Detalhes de tela em 05.

## 4.10 Recompensa diária

- `C.DAILY_REWARDS` (30 dias) e `C.DAILY_MILESTONES` `[5, 10, 15, 20, 25, 30]`. O ciclo repete um bloco de 5 dias: Gold, Água, XP do time, Gatorade e o marco ★.

| Dias | Gold | Água | XP do time | Gatorade | Marco ★ |
|---|---|---|---|---|---|
| 1–5 | 100 | 3 | 300 | 2 | d5: 10 Diamantes |
| 6–10 | 200 | 5 | 500 | 3 | d10: jogador Nv 1 Raro |
| 11–15 | 300 | 8 | 800 | 5 | d15: 25 Diamantes |
| 16–20 | 500 | 10 | 1.200 | 8 | d20: jogador Nv 1 Épico |
| 21–25 | 750 | 15 | 1.600 | 10 | d25: 50 Diamantes |
| 26–30 | 1.000 | 20 | 2.000 | 15 | d30: jogador Nv 1 Lendário |

- XP do time = `giveXp` nos titulares e na conta. O jogador do marco é um personagem sorteado de todo o `BL.CHARACTERS` com a raridade do prêmio.
- 1 resgate por dia; o dia vira à meia-noite local do aparelho (`G.dayKey`, `G.dailyNextReset`). Depois do dia 30 começa um ciclo novo.
- Perder um dia zera só a sequência (`G.dailyStreak` volta 0 se o último resgate foi antes de ontem); o ciclo continua de onde parou (`state.daily = { day, last, streak }`).
- API em game.js: `daily()`, `dailyCan()`, `dailyShown()` (dias resgatados no ciclo exibido), `dailyClaim()`, `dailyDevSkip()` (dev). Janela `MODALS.diaria` (dock 🎁 "Diária", classes `.dy-*`): calendário de 30 cartões, prêmio do dia, barra de marcos, contagem até o reset (`dyLeft`) e bolinha no botão da dock quando há prêmio (`dy-ready`).

## 4.11 Expedição

Um jogador sai para farmar em tempo real (conta com o jogo fechado) e volta com recompensas. Dock "Expedição" (`MODALS.expedicao`); o visual está em 05.

- **Config**: `C.EXPEDITION`: `durations`, 10 `regions` (com `aff`, `rare`, `finds` visuais), `perRegion` 10, `maxLevel` 100, `lvReq(L)`, `lvReward(L)`, `progNeed(L)`. **Lógica**: `G.exp()`, `expAway`, `expLevel(L)`, `expLevelOpen`, `expLevelDone`, `expWhy(p, L)`, `expSend(uid, L, dur)`, `expCancel`, `expAff`, `expDone`, `expClaim`, `expTick`, `expFinishNow` (dev).
- **Save**: `state.exped = { level, prog, count, cur: { uid, lvl, dur, start, end } | null, last, cleared? }`.
- **Trilha**: 10 regiões × 10 níveis = 100 níveis. Regiões, na ordem: Campo de Terra, Futebol de Praia, Quadras de Rua, Várzea Noturna, Campo Nevado, Estádio Abandonado, Selva do Drible, Vulcão do Ego, Arena Neo Egoísta, Torre BL PROJECT. O nível L pertence à região `⌊(L−1)/10⌋`.
- **Progresso por nível**: `x.level` é o nível mais alto liberado. Só a expedição feita nesse nível enche a barra do nível (`x.prog`): Rápida +10, 1 h +22, 3 h +70, 8 h +200 (`d.prog`). Barra cheia (`progNeed(L)` = `round((45 + 7,9L + 0,109L²)/10)×10`: L1 50, L10 130, L21 260, L50 710, L100 1.930; total 81.300) conclui o nível e libera o próximo; a sobra é descartada (nunca pula nível). No 100, `x.cleared = true`. Níveis concluídos podem ser repetidos só para farmar (sem progresso). Meta de design: ~4 meses e meio só com Jornadas de 8 h.
- **Requisitos do nível** (`lvReq`): jogador com Nv mínimo `max(1, round(1 + (L−1)^1,5 × 0,6))` e Poder mínimo (`BL.power`) `round(850 × levelMult(nvMin) × (0,9 + 0,004L) / 10) × 10`. Exemplos: L1 Nv 1 / Poder 770; L10 Nv 17 / 950; L21 Nv 55 / 1.380; L50 Nv 207 / 3.250; L100 Nv 592 / 8.940. O Poder pede um pouco mais de status (IV, nature, EV, itens) além de nível.
- **Durações** (`C.EXPEDITION.durations`):

| Duração | Tempo | Mult. de Gold/XP | Progresso | Chance de equipamento | Chance de Água/Gatorade |
|---|---|---|---|---|---|
| Rápida | 30 min | ×1 | +10 | 12% | 25% |
| Intermediária | 1 h | ×2 | +22 | 22% | 40% |
| Longa | 3 h | ×6 | +70 | 50% | 70% |
| Jornada de 8 horas | 8 h | ×16 | +200 | 90% | 100% |

- **Recompensa base** (`lvReward`, para a Rápida; as outras multiplicam por `mult`): Gold `20 + 4L`, XP do jogador `60 + 6 × Nv pedido` (L1: 24 Gold / 66 XP; L50: 220 / 1.301; L100: 420 / 3.612).
- **Resgate** (`expClaim`): sorteado só na volta. Gold (para a conta) e XP (só para o jogador, sem XP de conta) garantidos; chance de 1 equipamento (raridade pelo `ITEM_RARITY_WEIGHT` com Raro/Épico/Lendário multiplicados pelo `rare` da região: 1; 1,2; 1,4; 1,6; 1,8; 2,1; 2,4; 2,8; 3,2; 3,8) e de 1 Água ou Gatorade (30% Gatorade). Cancelar (`expCancel`) devolve o jogador sem nada.
- **Afinidade** (`G.expAff(p, L)`): cada região tem `aff: [status, status]` (Terra Físico+Passe, Praia Físico+Defesa, Rua Drible+Chute, Noturna Passe+Velocidade, Nevado Físico+Velocidade, Estádio Passe+Chute, Selva Drible+Velocidade, Vulcão Chute+Físico, Neo Drible+Passe, Torre Velocidade+Chute). `a` = média de `BL.baseStat` (IV com nature, itens e EV) nos 2 status ÷ 31, teto 1,25; afinidade = `a×100`%; multiplicador = `0,6 + 0,8a` (15 nos dois ≈ ×1,0; 31 ≈ ×1,4; teto ×1,6). Multiplica as chances de equipamento e de Água/Gatorade no `expClaim` (teto 98%). Gold, XP e progresso não mudam. A UI mostra "Afinidade X% · itens ×M" em cada jogador (verde ≥ ×1,2, vermelho < ×0,95).
- **Envio** (`expSend`): 1 expedição por vez; nível liberado (`expLevelOpen`); jogador que não esteja no Boss e passe em `expWhy`: não está em campo agora, sobram jogadores em casa para o modo atual (`roster − 1 ≥ size`), Nv e Poder mínimos. O modo dev ignora tudo isso exceto estar em campo.
- Enquanto está fora, o jogador sai da escalação (`state.active`), não completa o time em `activePlayers`, não entra na reserva, não treina no Wildcard e não conta para liberar mapas ([03 §3.12](03-jogadores.md#312-elenco-escalação-e-reservas)).
- **VIP**: `expTick` (a cada 5 s em ui.js) resgata sozinho e manda o mesmo jogador de novo (para o próximo nível, se concluiu; senão o mesmo nível, se ainda atende os requisitos). Free: aviso "Expedição concluída" e resgate manual.
- Não muda as recompensas das partidas.

### Fichas da Expedição (v527)

`expClaim` traz fichas (`C.FICHA_DUR` por duração: Rápida 1–2, Intermediária 2–4, Longa 6–10, Jornada 15–25), cor sorteada por `C.FICHA_REGION` (uma linha a cada 2 regiões), guardadas em `state.cons` como `C.SUPPLIES["fi-*"]` (`cat: "ficha"`, `noShop`). `res.fichas` aparece no último retorno. Na Mochila (v531: aba **Forja**, `forgeHtml` em ui.js, 2ª aba de `C.BAG_CATS`, aberta a qualquer jogador; criação no Wildcard continua só na Bancada), `G.fichaTrade(id)` gasta `C.FICHAS[id].n` (10/20/35/70/100) e dá 1 equipamento aleatório daquela raridade; Roxa 0,5% e Dourada 2% dão item de personagem no lugar.

## 4.12 Boss (Chefes e Raids)

Dock "Boss" (`MODALS.boss`, título "Chefes e Raids"). Não é a luta do fim de mapa (essa é a fase 10 de [4.1](#41-mapas-e-modos)): é uma simulação cooperativa-competitiva, escondida, em que sua equipe de 3 pontua contra um ranking.

- **Rotação diária** (`C.BOSS_ROTATION`, índice = `Date.getDay()`): Dom Kunigami, Seg Isagi, Ter Bachira, Qua Nagi, Qui Barou, Sex Chigiri, Sáb Sae (v349: Kaiser e Rin saíram por não ter sprite) (nome, título, cor, iniciais; o Boss do dia é só identidade visual, não muda regras). `G.bossOf(d)`.
- **Horário** (v389, Mickey): envio a qualquer hora (`C.BOSS_WINDOW = { open: 0, close: 24 }`), uma vez por dia: `G.bossSend` grava `s.bossDay` (data local) e `s.bossSent` e recusa um segundo envio no mesmo dia (o modo dev ignora). Depois de enviada, a equipe não muda até o boss do dia seguinte; a tela mostra os 3 como mini cards "Enviado".
- **Partida** (v391, Mickey): `C.BOSS_RUN` = 60 min, 1 lance por minuto (60 lances, igual a antes), `startHour: 18`. `G.bossSend` grava `start = max(agora, hoje 18h)`; antes disso a equipe já fica indisponível (`bossAway`) e a tela mostra "Começa às 18h". O baú ganho só aparece como card pequeno `.bo-tchest` ao lado do "?" (na cor do baú; "Sem baú" libera a equipe).
- **Enviar equipe** (`G.bossSend(ids)`): escolha exata de `BOSS_TEAM_SIZE` = 3 jogadores (`state.bossTeam`, alternados por clique) que não estejam em Expedição. Grava `state.bossRun = { boss, team, start, end, ticks, st: {uid: {gols, assist, roubos, passes, bloqueios}}, fake }` e tira a equipe da escalação. Não checa se sobra gente para o modo atual.
- **Simulação**: `BOSS_RUN.minutes` = 5 min reais, em `ticks` de `tickSec` 5 s (60 lances), calculados em `G.bossTick()` a partir do relógio (também depois de ficar offline; `ui.js` chama a cada 1 s e redesenha a janela). Em cada lance, para cada jogador e cada estatística, sai `+1` com chance `min(0,95, taxa[posição] × força)`, com `força = bossForce(Poder) = clamp(1 + log10(Poder/900) × 0,6, 0,5, 2,5)` (Poder 900 = ×1; ~9.000 = ×1,6):

| Posição | gols | assist | passes | roubos | bloqueios |
|---|---|---|---|---|---|
| Atacante | 0,10 | 0,06 | 0,30 | 0,02 | 0,01 |
| Ala Ofensivo | 0,05 | 0,08 | 0,40 | 0,05 | 0,03 |
| Ala Defensivo | 0,02 | 0,05 | 0,40 | 0,08 | 0,06 |
| Zagueiro | 0,01 | 0,02 | 0,30 | 0,10 | 0,10 |

- **Pontuação** (`C.BOSS_RUN.points`, `G.bossPoints`): Atacante gol 3 + assistência 2; Ala Ofensivo e Ala Defensivo gol 3, assistência 2, roubo 2, bloqueio 2; Zagueiro roubo 2 + bloqueio 2. Passes são contados mas não pontuam.
- **Ranking** (`G.bossTable/bossRank`): você + 149 treinadores simulados (`BOSS_RUN.fakeCount`, `G.bossFake`: nome sorteado, 3 personagens não-extra, Poder `900 × 10^(tier×1,45)` com `tier = aleatório^1,8`, já com os lances simulados). A tabela dos simulados avança junto com o tempo (`ticks/60`). Abas Geral (pontos), Gols, Assistências, Roubos de bola, Passes, Bloqueios (`BOSS_CAT` em ui.js); cada linha abre os 3 jogadores. Empate: você na frente. Sem partida, mostra prévia só com simulados (`bossPreview`). Os outros treinadores são falsos até existir servidor.
- **Baú final**: ao fim dos 5 min (`G.bossDone`), `G.bossMyChest()` define o baú pela posição no ranking Geral (mínimo `BOSS_MIN_POINTS` = 1 ponto; com 0 pontos, "Sem baú" e só libera a equipe). Cores (aura): Comum branco `#f2f5ff`, Incomum verde `#4fd68a`, Raro azul `#3f9bff`, Épico roxo `#b06bff`, Lendário dourado `#ffd23f`, Despertado vermelho `#ff3f5e` (o Despertado treme mais a tela, `bossShake`).

| Baú | Posição | Itens | Mult. | XP / Gold / Diamantes / Jogador (%) | Raridade do jogador (%) |
|---|---|---|---|---|---|
| Comum | demais | 3 | ×1 | 50 / 35 / 12 / 3 | comum 85, incomum 15 |
| Incomum | 51–100 | 4 | ×2 | 42 / 33 / 18 / 7 | comum 50, incomum 40, raro 10 |
| Raro | 11–50 | 5 | ×4 | 35 / 30 / 23 / 12 | incomum 45, raro 45, épico 10 |
| Épico | 4–10 | 6 | ×8 | 28 / 27 / 27 / 18 | raro 45, épico 45, lendário 10 |
| Lendário | 2–3 | 7 | ×16 | 22 / 24 / 30 / 24 | épico 60, lendário 40 |
| Despertado | 1 | 8 | ×40 | 15 / 20 / 33 / 32 | lendário 100 |

- **Abrir o baú**: cada item sorteia o tipo pelos pesos acima. Quantidade = `round(base × mult × aleatório(0,8–1,2))` com `BOSS_CHEST_BASE` XP 400, Gold 250, Diamantes 3. Jogador = personagem não-extra sorteado com a raridade da coluna, Nv 1. A janela revela um por um (toque no baú). `bossRoll` (ui.js) sorteia e `G.bossClaim(drops)` credita na hora: Gold, Diamantes, XP dividido pela equipe (`giveXp(n/3, equipe)`), jogadores novos no elenco; apaga `bossRun` e libera a equipe.
- Enquanto está no Boss a equipe fica fora de partidas, reservas, treino, Wildcard, Expedição e da contagem para liberar mapas (`G.isAway`).
- Modo dev: botões de baú de teste (nada creditado) e "Terminar agora" (`G.bossFinishNow`).

### Itens do treinador novos (v527)

51 itens em `BL.MGR_ITEMS` (v529: saíram os de EV e os de Tempo tático, pedido do Mickey): XP, Gold e baú (v473) e 7 famílias novas (`pass`, `drain`, `tackle`, `shot`, `scout`, `ficha`, `farm`) com a escada Comum a Lendário do doc de itens, mais o Cofre do Presidente (`goldX` 0,5, só do Boss do mapa, `C.COFRE_BOSS` 0,5%). Texto de cada bônus: `BL.mgrFxTxt`. `farm` = chance de +1 na colheita. No baú, `C.CHEST_MGR_SHARE` (22%) decide se o item é do treinador, para não diluir os equipamentos.

## 4.12b Missões (v534)

Pedido do Mickey: sistema de missões, cada uma com uma historinha curta explicando o que fazer e um prêmio. v537 (Mickey: "faça 20 capítulos"): **20 capítulos** (`C.CHAPTERS`: `who` Jinpachi Ego ou Anri Teieri, `title`, `story`, `rw` = prêmio do capítulo, entregue junto com a última missão; `G.misLast()`) com **10 missões cada** (v538; `C.MISSIONS`, 200 no total; `ch` = índice do capítulo, `line` = fala curta, `goal` = texto do objetivo). A história acompanha os 10 mapas, do Barou ao Trono do Ego. Os dados são gerados por `docs/missoes/gen.py` (rodar e colar no lugar do bloco em config.js). Saves da v534 recomeçam no capítulo 1 (`state.mis.v = 2`). `mapas` conta mapas diferentes zerados em qualquer dificuldade. Estado em `state.mis = { i, c, note, v }`: `i` = índice da missão atual, `c` = contadores desde que ela abriu, `note` = aviso de concluída já dado.

- Uma missão por vez, em ordem. `G.misEv(k, n)` soma no contador se a missão atual for daquele tipo. Ganchos: `endMatch` (`win`, `clean` = vitória sem sofrer gol, `goals`, `steal`, `boss`), `openChest` (`chest`), `expClaim` (`exp`), `farmHarvest` (`harvest`), `craft` (`craft`), `fichaTrade` (`forja`), `dailyClaim` (`daily`). Treino não conta. `roster`, `lvl` e `mapas` olham o estado atual (`G.misProg`).
- v538 (Mickey: "fase específica, tática específica, ganhe com 2 gols ou mais"): metade das missões são de partida, contadas em `endMatch` com contexto (`G.misOk(q, ctx)`): `stage` (vença a fase `m`-`st`, `m` = índice do mapa; `st` 10 = Boss), `tac` (vença no `sz`×`sz` com a tática ou formação `t`, olha `G.myTactic` no fim, então a Pausa tática conta), `mode` (vença no `sz`×`sz`), `margin` (vença por `d` gols ou mais), `hat` (marque `d` gols numa partida, vale até na derrota), `dif` (vença na dificuldade `d` ou acima; só no capítulo 20). Cada capítulo usa o mapa que o jogador já liberou nessa altura (`MAPI` em gen.py). Saves da v537 são convertidos (missão antiga j vira a posição 2j do capítulo; `state.mis.v = 3`).
- v539 (Mickey: prêmios misturados): cada missão dá uma mistura gerada por `reward()` em gen.py. Rodízio: Propostas em quantidade (Básica até 30, depois Forte e Elite, porque o roubo tem chance baixa), fichas da Forja (Branca a Dourada pelo capítulo), baú (comum, raro, épico), sub-item da Fazenda só 1 ou 2 (para valer a pena plantar), bebidas e Diamantes, sempre com Gold. Missão de Boss: `chestR` (baú épico, ou lendário com chance `p`; v541: 2% nos capítulos 1 a 6, depois de 5% no 7 subindo 3,5% por capítulo até 50%). Tudo isso soma umas 1.100 Propostas e 15 baús de Boss nos 20 capítulos. v540 (Mickey): o Treino Particular não vem fixo na missão; cai como chance dentro do baú (`C.CANDY_CHEST`: épico 8% → 1, lendário 20% → 3 de uma vez; `G.openChest` devolve `candy`, aviso no canto).
- v542 (Mickey): missões e capítulos **não dão Diamantes**. No lugar: Propostas da Loja em pacotes grandes (Básica 30 ou 50 até o capítulo 7, Forte 30 ou 50 até o 14, Elite 25 ou 40 depois; capítulos dão 25 a 50) e, bem de vez em quando, 1 contrato do Wildcard (`CT` em gen.py, 15 no total).
- `G.misClaim()` entrega `rw` (gold, dia, xp, chest = tipo de baú, sub = sub-item do Wildcard, sup = item de `state.cons`) e abre a próxima.
- O capítulo 20 (O Trono do Ego: 500 vitórias, Nv 1000, 1.300 gols, 60 Bosses, os 10 mapas zerados) dá o **Master Contract** (`pr-bluelock`). Pular é livre: quem ignora só não ganha os prêmios. O outro jeito de ter o Master Contract é o baú lendário (`C.MASTER_CHEST`, 0,2%).
- Tela: `MODALS.missoes()` (título "Missões", `modal-wide`), aberta pelo botão do trilho `data-float="missoes"` (ícone `img/menu/rail-missoes.png`, selo `#railMis` = capítulo atual "N/20", "!" dourado quando dá para resgatar, ✓ no fim; `misBadge()`) e pela Central do treinador. Botão `data-mis-claim`. Estilos `.ms-*`.

## 4.13 Ainda não implementado

Habilidades (os 4 slots existem, o banco `BL.SKILLS` está vazio), PvP, Raid diária, Loja do Boss, compra de Diamantes e VIP, desbloqueio dos slots 2–4 do Wildcard, troca de formação no intervalo contra Boss, nomes reais dos mapas, ranking e chat reais (a "Chat mundial" e o contador online são de mentira) e servidor. Os botões existem no dock como "em breve" (`MODALS.locked`). O roadmap fica em `docs/bl-project-idle-roadmap.html`.

## Modo Soneca (v291)

Pedido do Mickey: o jogo "continua rodando" com o computador desligado.
- Botão Soneca (lua) na barra do topo e na Central → `MODALS.sleep()`. "Entrar em modo soneca" só funciona numa partida valendo (fora do treino).
- Medição: `C.SLEEP_MEASURE_SEC` (120 s, relógio real, `slMeas` em ui.js). No fim, `G.sleepStart()` grava `state.sleep = { since, xph }` e `sleepExit()` volta à página inicial sem deslogar.
- Ritmo (`G.sleepRate`, v292 Mickey): sempre estimado pela fase e dificuldade atuais: XP por partida × 3600 / `C.SLEEP_MATCH_SEC_EST` (150 s).
- Ao entrar de novo (`enterAccount` → `G.sleepWake()`): horas = agora − since, sem teto (rende até abrir a conta). Só XP, sem Gold: XP = xph × (turbo + resto × `C.SLEEP_XP_MULT` 0,5), dado a cada jogador do time e à conta (`giveXp`).
- Turbo VIP (`state.sleepBank = { turbo, day, today }`, segundos): `G.sleepTick(5)` a cada 5 s de partida valendo soma `C.SLEEP_TURBO_PER_PLAYED` (2 h jogadas = 1 h), no máximo `C.SLEEP_TURBO_MAX_H` (8 h) ganhas por dia e 8 h guardadas. O turbo é gasto primeiro na soneca e rende XP cheio.

## Seus mapas: campos com efeito (v312)

- O card do mapa no canto inferior direito do painel (`.dock-map`, `data-open="pitches"`) abre **Seus mapas** (`MODALS.pitches`, `#modal.modal-sm`, classes `sm-*`). As fases do mapa continuam no botão "Ver fases do mapa" (`MODALS.maps`) e na janela Mapa da lateral.
- Campos em `C.PITCHES`: Estádio BL PROJECT (oficial, sem efeito), Floresta (todos os atributos ×1,05), Deserto (gasto de energia ×1,3), Street (bote e carrinho acertam ×0,8), Espaço (corrida ×1,08, sem passar de `C.RUN_MAX` 210). Vale para os dois times.
- Escolha em `state.pitch` (`G.setPitch` reinicia a partida no campo novo; `G.pitchId()`). Fora do dev só o Estádio está liberado (`G.pitchUnlocked`); por decisão do Mickey (2026-10-13) fica assim por enquanto; no futuro ele quer mapas para farmar itens e outras coisas. O Boss sempre joga no Estádio com a arena dele.
- No motor: `Match.pitch`/`Match.pfx` (de `opts.pitch`); `pfx.stats` em `iv()` e `q()`, `pfx.drain` em `drain()`, `pfx.tackle` em `duel()` e `slideHit()`, `pfx.run` em `runSpeed()`. Imagem e perspectiva trocadas por `BL.setPitchImg` (ver doc 10 §3.6).

## Prólogo (v558, Mickey)

`C.PROLOGUE`: o mapa 1 (1-1 a 1-10) é o Prólogo até o Boss dele ser vencido pela primeira vez (`G.prologue()` = mapa 1 e `!G.mapEverCleared(0)`). Jogo novo começa direto na 1-1 (`noTraining`, o treino continua no botão). Na 1-10 o Boss vem como **Mini Boss** (`BL.makeEnemy`: mesmo personagem, Despertado, Nv `mini.level` 95, status × `mini.statMul` 0,8, título "Mini Boss", `p.mini`), com arena mais leve (`G.arenaNow()`: buff do Boss 5%, debuff seu 2%). A primeira vitória contra ele rouba um personagem **Comum** garantido, sorteado entre os que não são Boss de mapa e que o jogador ainda não tem, sem gastar Proposta (`endMatch`, `res.prologue.pool`). A interface mostra o jackpot `prologueRoulette` (ui.js) e o 2×2 abre porque o elenco chega a 2. Depois disso a 1-10 volta ao Boss normal (Barou Nv 100) e o roubo volta às regras de sempre.

- **v561 XP do X1** (`C.X1.xp`): no 1×1, além do XP da partida, cada gol do seu jogador soma `goalK` 0,3 × XP da partida e cada drible dele soma 0,8 de um gol (`G.x1Drib`, contado no evento "dribble"). Entra antes dos multiplicadores (Boss, derrota, dificuldade, boosts).
- **v582 (Mickey) Time Dourado** (`C.GOLDEN_TEAM`, `G.startMatch`): no 4×4, fora do Boss e do Prólogo, chance `chance` 6% por partida de o adversário (titulares e reservas) virar "Time Dourado": todos refeitos como Lendário, ou Despertado com chance que sobe de `awake[0]` 5% no primeiro mapa 4×4 até `awake[1]` 35% no último. Aura dourada em campo. Vitória: XP e Gold × `xp`/`gold` 3; chance de roubo × `steal` 2 (dentro de `BL.stealChance`, o card do adversário já mostra). Flag `G.goldTeam`; DEV `G.devGold`.
- **v582 (Mickey) marcos por jogador** (`C.MILESTONES`): cada gol do seu jogador (evento `goal` com `uid`, fora do treino) soma `p.goals`; 100 = título "Artilheiro", 500 = "Matador" + aura ciano, 1000 = "Lenda do Gol" + aura branca (`p.msTitle`, `p.msAura`). Aviso no registro.
- **v582 jogada lendária do seu time:** +25% (`C.LEGEND_PLAY.xp`) no XP da partida e o lance entra na coleção `state.lances["charId:tipo"]` (contagem), vista na janela de status do jogador.
- **v583 (Mickey) Time Dourado** agora `chance` 1% e Despertado `awake` 0,1% a 0,5%. **Marcos de gols (v582) removidos** e trocados pela **Maestria** (`C.MASTERY`, igual a maestria do LoL, só cosmético): `p.mast` soma pontos pelo objetivo da posição (Pivô gol 20, chute 3; Fixo roubo 1; Ala Of assistência 15, passe certo 0,5; Ala Def roubo 0,5, passe certo 0,4), fora do treino; `need` [0, 60, 180, 400, 750, 1300, 2100, 3300, 5000, 7500] = pontos para Maestria 1 a 10 (`G.mastLv`). Subir avisa no registro.

## Líderes: ginásios (v622)

`C.GYMS` (config.js): 8 ginásios `{ id, name, n, icon, color, buff: "gold"|"xp"|"steal", val, npc, npcLv, npcRar }` e `wait` (15 min). Estado em `localStorage["blpi_gyms"]` (`G.gyRead/gyWrite`), igual para todas as contas do navegador: `{ g: { <id>: { leader (conta ou null = NPC), leaderName, team: [4 jogadores], since, prot (sempre 0 desde v623), wins } }, hist, cd: { <conta>: fim da espera } }`.

- Começo: cada ginásio tem um líder NPC com time gerado (`G.gyNpcTeam`, só personagens com sprite).
- **Desafiar** (`G.gyStart`): precisa de mapa 4×4, 4 escalados, fora do treino, sem liderar outro ginásio e fora da espera de derrota (`m.cd[conta]`). Liga `G.gymFight` e chama `startMatch`, que troca os inimigos pelas cópias do time do líder.
- **Fim** (`G.gyEnd`, chamado no começo de `endMatch`): vitória faz você líder (cópia do seu time escalado defende) sem timer nenhum (o ginásio é dele até alguém vencê-lo); derrota soma uma defesa para o líder e põe o desafiante `wait` min (15) sem poder desafiar nenhum ginásio. Não dá XP, Gold, EV nem roubo e não avança a fase.
- **Benefício** (`G.gyBuff`): `gold`/`xp` em % no fim das partidas normais, `steal` em pontos na chance de roubo; vale enquanto a conta for a líder. `G.gyAbdicate` devolve o ginásio a um NPC.

## Guilda: clãs (v624)

Tudo em `js/clan.js` (`BL.Clan`) e `C.CLANS` (config.js). Estado em `localStorage["blpi_clans"]`, igual para todas as contas do navegador: `{ c: { <id>: clã }, mem: { <conta>: id }, mail: { <conta>: [entregas] } }`. Online depois: só `read/write` mudam.
- **Clã**: criar custa `cost` Gold (nome 3 a 20 letras, símbolo = sprite de personagem, entrada livre ou com pedido). Até `max` membros. Cargos: líder (tudo), sublíder (aceita pedidos, edita mural, expulsa membros). Líder que sai passa o cargo para um sublíder ou o mais antigo; último membro que sai desfaz o clã.
- **Nível**: XP do clã vem de vitórias (`xpWin`), roubos (`xpSteal`) e missões dos membros, Raide derrotado e Guerra. Subir do nível n custa `lv.base + lv.step × n` (máximo `lv.max`). Bônus para todos: `perLv` × nível (% XP, % Gold, pontos de roubo) + bônus de vitória na Guerra. Entram em `endMatch` somados ao `G.gyBuff` (clan.js embrulha a função).
- **Missões diárias** (`missions`): `own` conta só o que a conta fez; as outras somam o clã. Resgatar dá XP ao clã e Gold à conta.
- **Raide** (`raid`): um boss por semana (segunda a domingo) da lista `bosses`, equipe 4×4 com o boss no Pivô (Despertado) e 3 Lendários, nível = média do seu time × (`lvK` + tier × `tierLv`) + `lvAdd`. 1 tentativa por dia, até `tries` na semana. Dano em barras = (gols × `goal` + finalizações × `shot`) × `winK` se vencer. Vida = `hpPer` × membros (mín. `hpMin`), +`tierHp` por tier. Boss derrotado: XP ao clã e `reward` por atacante (`share` igual, o resto pelo dano) via correio do clã; derrotado sobe o tier da semana seguinte.
- **Guerra** (`war`): na primeira leitura da semana o clã pega um rival NPC (`rivals`) e cada membro (até `max`, pela força) ganha um adversário com time da mesma raridade e nível (#1 contra #1). Ataques de `battleDay` (quinta) a domingo, até `tries` tentativas; vitória = 1 ponto. O rival "ataca" as defesas com chance pela diferença de força (sorteada no pareamento, revelada ao longo do dia de batalha). Na virada da semana: vitória dá `buff` por uma semana, XP e `win` (Fragmentos + Gold) para quem atacou; derrota dá `lose`.
- **Partidas**: `BL.Clan.start(kind)` liga `G.clanFight`; `startMatch` troca os inimigos por `BL.Clan.fightTeam()` e `endMatch` chama `BL.Clan.fightEnd` (sem XP, Gold, EV nem roubo). Precisa de mapa 4×4 e 4 escalados, fora do treino e sem desafio de ginásio.
- **Fragmentos** (`state.clanFrag`) e entregas do clã chegam pelo `mail` do clã quando a conta abre a Guilda ou joga. Loja do clã: `shop`.

## RMT: mercado em reais (v626)

`js/rmt.js` (`BL.RMT`) e `C.RMT`. Estado em `localStorage["blpi_rmt"]` (contas do navegador): `{ seq, list, orders: { conta: [...] }, vault: { conta: [...] }, wallet: { conta: { moves, saques, pix } } }`.
- **Anunciar**: jogador fora de uso (mesma regra do Leilão: `G.mkBusy`, mínimo 4 no elenco) ou itens da Mochila (`G.mkGoods`), preço `min` a `max` reais, até `maxListings` ativos. O que é anunciado sai da conta (custódia) e volta se cancelar.
- **Comprar**: "Comprar com Pix" reserva o anúncio só para o comprador por `reserve` min (1 reserva por vez); reserva vencida volta para a vitrine. Pagamento confirmado → item no Cofre RMT do comprador (Receber); venda entra na carteira do vendedor com taxa `fee` e fica pendente `hold` dias antes de virar disponível.
- **Carteira**: Pendente, Disponível, Em saque, Já recebido, Ajustes. Saque pede chave Pix, mínimo `saqueMin`, sem taxa; fica "Aguardando" (processado pela equipe quando houver servidor).
- **Sem servidor**: o Pix é de TESTE (botão "Confirmar pagamento de teste", nenhum dinheiro é cobrado). Online: trocar `read/write` por API, o passo do pagamento por Pix real verificado no servidor e o processamento dos saques.

## Game Pass (v628)

`js/gamepass.js` (`BL.GamePass`) e `C.GAMEPASS`. Dados por conta: `state.gp = { season, xp, prem, got: { f: {nível: 1}, p: {...} }, daily }` e `state.gpAuras = { celeste|ego: uid ou "" }` (auras ficam para sempre).
- **Temporada** = mês do calendário no horário de Brasília (`season()`; Temporada 1 = nov/2026, `start`). Virou o mês, zera XP, resgates e Premium; nome vem de `names`.
- **XP**: em cada `matchEnd` fora do treino: `match` + `win` + `goal` por gol (até `goalMax`) + `steal` + `boss`/`gym`/`clan` na vitória. Missões diárias (`daily`, zeram no `dayKey`) somam XP sozinhas ao completar. Nível l custa `need[0] + need[1]×l` (`cum(l)` = total; Nv 100 ≈ 89,7 mil, Nv 200 ≈ 239 mil).
- **Prêmios**: ciclo de 10 níveis `free`/`prem` (quantidade +50% a cada 50 níveis; baú não escala) e `special` nos níveis 50/100/150/200. Tipos: gold, dia, chest (`G.addChest`), aura e itens da Mochila (`G.cons()`).
- **Premium**: `price` Diamantes na tela (ou pelo card da Loja de Diamantes, `gp: true`), vale a temporada e libera os prêmios premium já alcançados. **Avançar níveis**: `skip` Diamantes por nível.
- **Auras** (`auras`): Celeste no Nv 100 e do Ego no Nv 200 Premium; só visual. O jogador escolhido ganha `p.gpAura` (sincronizado no `matchStart`, então jogador vendido não leva) e o motor desenha a aura como a do Despertado.

## Arena PvP (v630)

`js/pvp.js` (`BL.PvP`) e `C.PVP`. Dados por conta em `state.pvp = { elo, w, l, hist, cups: { "dia:formato": resultado }, cup, multi }`. Sem servidor: os adversários são treinadores da IA (`npcs`, ELO por nome com pequena variação diária).
- **Partidas**: 4×4 de verdade num mapa 4×4. `G.pvpFight = { kind: rank|cup|multi, name, team, ... }`; `game.js` troca os inimigos por `fightTeam()` (no Multi também o seu time por `myTeam()`: seus 2 + 2 do parceiro nas posições que sobram) e chama `fightEnd(r)`, que não dá XP nem roubo (o Game Pass conta a partida).
- **Time da IA** (`teamFor`): nível = sua média × (1 + (ELO dele − o seu) × `lvK`), raridade perto da sua, respeitando a regra da copa.
- **Ranqueada**: ELO com K = `k`, adversário entre os 6 de ELO mais perto; Gold `rank.gold`/`goldLose`.
- **Copas do dia**: `cupsPerDay` formatos por dia (rodízio de `formats`); 1 inscrição por formato por dia. 16 treinadores, 4 grupos de 4 (3 rodadas, vitória 3 pontos, desempate por saldo), 2 primeiros às quartas, semi e final. Sua luta é jogada; as outras são sorteadas pelo ELO quando a sua termina (ou em "Ver próxima rodada" se você caiu). Prêmio por colocação (`prize`: 1º, 2º, semi). Apostas em Gold nas outras lutas da rodada, pagando (1 − `betCut`) ÷ chance.
- **Regras de formato** (`rules`): `max` (raridade máxima), `maxLv`, `shiny` (pelo menos 1). Checadas na inscrição e antes de cada luta.

## Aviso de modo liberado (v679)

Os mapas 2 a 4 (2×2, 3×3, 4×4) abrem só pelo tamanho do elenco (`G.mapUnlocked`). `G.modeTop()` = maior desses já aberto; `state.modeMax` = maior já jogado (gravado em `switchMap`); `state.modeSeen` = último avisado. `G.modeNew()` devolve o modo a avisar e a interface (`modeNotice` em ui.js, a cada 2,5 s, sem pop-up aberto) mostra o pop-up uma vez; o selo do botão Mapa fica até o jogador entrar no modo. No modo dev não avisa.

## Diamantes e beta (v680)

Diamantes entram só por compra (Pix ainda não ativo), pelo Leilão (de outro jogador) e por `C.DIAMOND_DROP`: 0,2% (v687; era 0,5%) de cair 1 a cada vitória, em qualquer fase. Nenhuma recompensa dá Diamante (Diária, baú do Boss, PvP, Guilda, Game Pass e correio foram trocados por Gold). A conta nova começa com 205 Propostas Básicas (`C.STEAL_GIFT`). Até a primeira vitória, o adversário do 1×1 entra com stats ×0,55 (`C.FIRST_WIN`).
