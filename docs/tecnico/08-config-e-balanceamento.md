# 8. Configuração e números de equilíbrio

[← Índice](README.md)

Todos os números de equilíbrio ficam em `game/js/config.js` (`BL.CONFIG`, usado como `C` no código). Mudar um valor ali muda o jogo sem mexer em mais nada. Esta é a referência do estado atual (BL.BUILD "226"), organizada por grupo. Quem usa cada valor: [02](02-motor-e-ia.md) (motor), [03](03-jogadores.md), [04](04-progressao.md), [05](05-interface.md).

## 8.1 Versão e testes de valores

- `BL.BUILD` ("226"): sobe a cada publicação e deve bater com `?v=` em `index.html` (8 ocorrências). Ver [09](09-build-publicacao-e-simulacao.md).
- `BL.cleanTag(v)`: Tag do time, só letras maiúsculas, no máximo `TEAM_TAG_MAX`.
- Para testar um valor sem editar arquivo, a bancada aceita `OV='{"STYLES.blitz.sigWin":1.3}'` (ver [09 §9.5](09-build-publicacao-e-simulacao.md)).

## 8.2 Status, raridade, nature e posições

| Chave | Valor | Uso |
|---|---|---|
| `STATS` | passe, chute, fisico, velocidade, defesa, drible | ordem dos 6 status; `STAT_LABEL`, `STAT_SHORT` (PAS CHU FIS VEL DEF DRI) e `STAT_KIND` (neutro, ofensivo, defensivo) |
| `STAT_MAX` / `STAT_TOTAL_MAX` | 31 / 186 | teto por status e total |
| `COMMON_MIN_POINTS` | 24 | piso de pontos do Comum sorteado |
| `SHINY_CHANCE` / `SHINY_BASE` / `SHINY_EXTRA_MAX` | 1/400 / 25 / 4 | Shiny: sempre Lendário, 25 em tudo + 0 a 4 extras por status |
| `NATURE_MOD` | 0,10 | ±10% |
| `NATURE_GRID` | 6×6 nomes | linha sobe, coluna desce, diagonal neutra |
| `POSITIONS` | atacante, alaof, aladef, zagueiro | nome, sigla (ATA ALO ALD ZAG), descrição e `focus` (2 status) |

`RARITIES` (`to` = teto em % de 186 pontos; a raridade é a primeira faixa cujo teto cobre a % do jogador; `weight` é peso relativo de sorteio, soma 215,1). Ver [03 §3.4](03-jogadores.md#34-raridade).

| id | Nome | `to` | `weight` (chance) | `skills` | `stealMult` | Cor |
|---|---|---|---|---|---|---|
| comum | Comum | 25 | 80 (37,2%) | 1 | 1,00 | `#9aa7c7` |
| incomum | Incomum | 50 | 60 (27,9%) | 1 | 0,80 | `#4fd68a` |
| raro | Raro | 70 | 50 (23,2%) | 1 | 0,60 | `#3f9bff` |
| epico | Épico | 85 | 20 (9,3%) | 2 | 0,35 | `#b06bff` |
| lendario | Lendário | 95 | 5 (2,3%) | 2 | 0,15 | `#ffb02e` |
| despertado | Despertado | 100 | 0,1 (0,05%) | 3 | 0,05 | `#ff3f5e` |

## 8.3 Nível, EV, goleiro e XP

| Chave | Valor |
|---|---|
| `PLAYER_MAX_LEVEL` / `ACCOUNT_MAX_LEVEL` | 1000 / 100 |
| `LEVEL_POWER` | 0,012 (`levelMult = 1 + (nível − 1) × 0,012`; Nv 100 ≈ 2,19×) |
| `playerXpToNext(lv)` | `floor(10 + 4·lv)` (Nv 1: 14, Nv 100: 410) |
| `accountXpToNext(lv)` | `floor(60 + 40·lv)` (Nv 1: 100, Nv 99: 4020) |
| `EV_MAX_STAT` / `EV_MAX_TOTAL` / `EV_POWER` | 252 / 504 / 0,20 (252 EV em um status = +20%) |
| `EV_WIN` / `EV_LOSS` / `EV_RESET_COST` | 4 / 1 (Boss ×3) / 300 Gold |
| `GOALKEEPER_TABLE` | por nível da conta: até 25 Save 15 e SB 15; até 50: 20/20; até 75: 25/25; até 100: Save 25 e SB 31 |

`Save` entra na chance de gol; `SB` define quanto tempo o goleiro segura a bola (`1,8 − (SB − 15) × 0,08` s).

## 8.4 Gol e chute

Chance de gol = `50 + 2 × (Chute − Save)` (`BL.goalChance`, Chute = `iv(chute)`, sem o nível absoluto).

| Chave | Valor |
|---|---|
| `GOAL_MIN` / `GOAL_MAX` | 5 / 90 (%) |
| `GOAL_PRESSURE_PENALTY` | −10 com marcador a menos de 60 px |
| `GOAL_LONG_RANGE_START` / `GOAL_LONG_RANGE_PER_10PX` | 230 px / −1 por 10 px (o IV de Chute empurra o início para mais longe, `IVX.shotRange`) |
| `SHOT_CLOSE` | 50 px: com a bola a menos disso do centro do gol, o jogador finaliza na hora (sem conduzir mais) |

## 8.5 Partida: tempo, ritmo e corrida

| Chave | Valor | Observação |
|---|---|---|
| `GAME_SPEED` / `BOSS_SPEED` | 1 / 1 | 1× em tudo (sprites legíveis) |
| `RUN_MAX` | 210 px/s | teto de corrida em qualquer nível. **Não aumentar** (regra do Mickey) |
| `HALF_SECONDS_NORMAL` | 51 | segundos por tempo nas partidas normais (v617, igual ao Boss) |
| `PACE_NORMAL` | 1 | ritmo das partidas normais (Boss = 1) |
| `HALF_SECONDS` | 51 | segundos por tempo só no Boss do mapa |
| `HALF_STOPPAGE_MAX` | 12 | teto (s) de espera do lance antes do intervalo (acréscimos do 1º tempo) |
| `MERCY_DIFF` | 4 | gols de diferença que encerram a partida |
| `TRAINING_MAX` | 4 | jogadores no treino, em qualquer modo |
| `BENCH_SIZE` | 2 | reservas que o time leva |

## 8.6 Energia e função dos IVs (v226)

Pedido do Mickey: toda ação gasta energia e ficar sem ela pune muito. Mecânica em [02 §2.3](02-motor-e-ia.md#23-status-em-campo).

| Chave | Valor | Uso |
|---|---|---|
| `ENERGY_DRAIN_WALK` | 0,1 /s | andar (v > 40 px/s) |
| `ENERGY_DRAIN_RUN` | 0,7 /s | correr (v > 180), soma com o andar |
| `ENERGY_DRAIN_PASS` | 0,4 | por passe |
| `ENERGY_DRAIN_ACTION` | 1,3 | por drible, carrinho, chute ou bloqueio |
| `ENERGY_DRAIN_TACKLE` | 1,8 | a mais para quem dá o bote ou o carrinho |
| `TACKLE_MISS_DRAIN` / `TACKLE_MISS_STUN` | 1,2 / 0,9 s | quem foi driblado perde energia extra e fica no chão |
| `ENERGY_LOW` | 50 | abaixo disso os status caem e o jogador desacelera |
| `ENERGY_MIN_MULT` | 0,45 | status com 0 de energia (era 0,7 até a v225) |
| `ENERGY_SLOW` | 0,8 | com 0 de energia, decide e levanta 80% mais devagar |
| `ENERGY_RUN_MIN` | 0,8 | com 0 de energia, corre a 80% |

`IVX` (valores no q = 1, q = status efetivo/31; pares `[a, b]` vão de a em q 0 até b em q 1):

| Chave | Valor | Efeito |
|---|---|---|
| `passGenius` | 0,4 | chance × q² de o passe atravessar a marcação sem corte |
| `passLob` | 0,35 | linha fechada: chance × q² de tocar por cima |
| `passErrK` | [1,25; 0,2] | v488: erro de mira × isto (Passe 0 → 31) |
| `passLongErr` / `passLongD` | [1,45; 0,5] / 320 | v488: lançamento erra mais ainda × isto |
| `dribPow` | [0,86; 1,13] | v488: força do drible no duelo × isto (IV 16 ≈ 1) |
| `dribChain` / `dribChainT` | [1; 0,65; 0,3; 0,2] / 3 s | v488: chance do 2º, 3º, 4º+ drible seguido |
| `shotPower` | 0,22 | chute até 22% mais forte |
| `shotRange` | 140 px | chuta de até 140 px mais longe sem perder precisão |
| `shotCurve` | 0,2 rad | curva do chute, a partir de q 0,45 |
| `shotDodge` | 0,35 | a curva tira até 35% da chance de bloqueio |
| `fisDrain` | [1,35, 0,55] | multiplicador do gasto de energia |
| `velAct` | [1,25, 0,78] | multiplicador do tempo de decidir e levantar |
| `defCut` | [0,75, 1,3] | corte de passe |
| `defBlock` | [0,7, 1,35] | bloqueio de chute |
| `defReach` | 14 px | alcance extra do bloqueio |
| `dribFirst` / `dribFirstT` | 0,6 / 0,7 s | drible de primeira: até +60% no ataque do duelo logo depois de receber |
| `dribAfterT` | 1,0 s | janela depois de driblar |
| `dribAfterShot` | 6 | pontos de chance de gol (× q²) na janela |
| `dribAfterPass` | 0,25 | chance extra de passe de gênio (× q²) na janela |

## 8.7 Itens, cura, pré-jogo e vestiário

| Chave | Valor | Uso |
|---|---|---|
| `CONSUMABLES` | `agua` 💧 +40, custo 10 Gold; `gatorade` ⚡ +100 (cheia), custo 30 Gold | comprados na Loja, usados no card do jogador (`G.useCons`) |
| `HEAL_COOLDOWN` | 30 s de jogo | espera entre dois usos no mesmo jogador (não vale no vestiário) |
| `HEAL_AUTO_BELOW` | 50 | Módulo de cura (VIP) usa item abaixo disso (era 35 até a v225; 50 é onde os status começam a cair) |
| `HALFTIME_REST` | 15 | energia que os dois times recuperam no intervalo |
| `VESTIARIO_SECONDS` | 15 | volta sozinho se ninguém mexer (cada mexida reinicia) |
| `PREMATCH_SECONDS` | 15 | contagem da escolha de formação |
| `ENEMY_PREF_CHANCE` | 0,7 | cada time inimigo joga a formação preferida do nome 70% das vezes |
| `HINT_LV_CLEAR` | 10 | técnico abaixo desse nível às vezes não lê o adversário |
| `STYLE_HINT` | 3 frases por estilo | leitura do técnico no pré-jogo e no vestiário |
| `GATORADE_RESTORE` / `GATORADE_COST` | 55 / 8 | **legado**, sem uso no código atual (valem os de `CONSUMABLES`) |

## 8.8 Modo duelo (ginga, carrinho, chutaço, trave)

Ativo em toda partida fora do treino (`Match.duelMode`). Mecânica em [02 §2.13](02-motor-e-ia.md#213-modo-duelo-ginga-carrinho-chutaço-e-trave-duelmode).

| Chave | Valor |
|---|---|
| `DUEL_MOVES` | CANETA!, ELÁSTICO!, CHAPÉU!, PEDALADA!, LAMBRETA! |
| `DUEL_SLIDE_RATE` | 2,2 /s: chance de o marcador por trás ou de lado se jogar no carrinho |
| `DUEL_SLIDE_SPEED` | 290 (arranque de 0,3 s, não é corrida) |
| `DUEL_SLIDE_WIN` | 0,8: o carrinho acerta a bola um pouco menos que o bote de frente |
| `DUEL_LONG_SHOT` | 0,3: peso do chute de longe (250 a 430 px) com caminho livre |
| `DUEL_BURST_SHOT` / `DUEL_BURST_SHOT_TEAM` | 2,5 no 1×1 / 1,5 em time (2,5 deixava a 1-3-1 forte demais contra a 1-1-3) |
| `DUEL_POST` | 0,25: parte dos chutes que não entram vai na trave |

## 8.9 Plano de jogo (táticas 2×2 e 3×3)

Escolhido por `Match.planFor` ([02 §2.11b](02-motor-e-ia.md#211b-plano-de-jogo-construção-e-ataque-v197)). `build` = mais defensores que atacantes; `attack` = mais atacantes ou Blitz.

| Chave | Valor | Uso |
|---|---|---|
| `BUILD_AHEAD` | 120 px | distância do apoio até quem tem a bola (testa também +50) |
| `BUILD_COVER` | 150 px | cobertura atrás da bola quando há 2+ apoios (no máximo até o meio) |
| `BUILD_FWD` | 90 | preferência por oferecer-se à frente em vez de ao lado |
| `BUILD_ARC` | 105° | arco de posições do apoio |
| `BUILD_BACK` / `BUILD_BACK_PRESSED` | 0,15 / 0,35 | peso do passe para trás sem pressão / pressionado |
| `BUILD_PASS` | 2,0 | passe curto para quem está livre ao lado ou à frente |
| `BUILD_CARRY` | 1,0 | conduzir quando ninguém está perto |
| `BUILD_WAIT` | 0,7 | portador segura o passo enquanto o apoio está atrás |
| `BUILD_STEP` | 90 px | passador passa à frente de quem recebeu |
| `ATTACK_ONE_TWO` | 2,5 | devolver a tabela de primeira |
| `ATTACK_CARRY` | 0,7 | conduzir menos com passe agressivo livre |
| `GIVE_GO_T` | 1,3 s | quanto tempo quem tocou fica disparando para a tabela |

## 8.10 Táticas, formações e estilos

`TACTICS[1..3]`: `{ id, name, atk, shape? }`. `TACTICS[4]`: `{ id, name, type, style, atk, shape }`.

| Modo | Táticas (id, nome, atacantes) |
|---|---|
| 1×1 | `1` Ataca com a bola, defende sem (1) |
| 2×2 | `1-1` Equilibrado (1), `2-0` Ofensivo (2), `0-2` Defensivo (0) |
| 3×3 | `2-1` Ofensivo (2), `1-2` Defensivo (1), `3-0` Ataque total (3, "V"), `0-3` Retranca (0, "V") |
| 4×4 | `2-2` 1-2-2 (2), `1-3` 1-1-3 (3), `3-1` 1-3-1 (1) |

Desenhos (frações do campo, atacando para a direita; goleiro fora da lista):

| Formação | Posições |
|---|---|
| 1-2-2 | def (0,17; 0,37), def (0,17; 0,64), atk (0,49; 0,32), atk (0,48; 0,67) |
| 1-1-3 | def (0,30; 0,47), atk (0,50; 0,32), atk (0,50; 0,68), atk (0,60; 0,49) |
| 1-3-1 | def (0,23; 0,50), def (0,34; 0,24), def (0,34; 0,75), atk (0,50; 0,50) |
| 3×3 Ataque total | atk (0,48; 0,50), atk (0,35; 0,27), atk (0,34; 0,69) |
| 3×3 Retranca | def (0,19; 0,48), def (0,32; 0,28), def (0,32; 0,69) |

Pedra, papel e tesoura (só 4×4): Muralha (1-3-1) vence Blitz (1-1-3), Toque (1-2-2) vence Muralha, Blitz vence Toque.

| Chave | Valor |
|---|---|
| `FORMATION_TYPE` | equilibrada, ofensiva, defensiva (rótulos) |
| `FORMATION_BEATS` | defensiva > ofensiva, equilibrada > defensiva, ofensiva > equilibrada |
| `FORMATION_EDGE` | 0,11 (v635): +11% em todos os status de quem soma mais vantagens no ataque × defesa (era 0,07 na v597, 0,03 na v226, 5% até a v225, 10% até a v102) |
| `FORMATION_EDGE2` | 1,5 (v635): com saldo de 2 vantagens (a defesa countera o ataque deles e o ataque vence a defesa deles) o bônus vira `FORMATION_EDGE × 1,5` (+17%) |
| `TRI3` | v636: triangulação da Bola no pé (Ala Def, Ala Of, Pivô): `first` [5, 14] s, `gap` [16, 26] s, `max` 5, `passes` [5, 7], `side` 190 px, `adv` 26, `spin` 0,45, `safe` 0,85, `recv` 0,45 s, `shotR` 380, `shotAdd` 8. Medido: ~4 começam e ~3 se completam por jogo |
| `ATK_PRESETS[*].beats` / `beatenBy` | v635: Bola no pé vence ofensiva e perde para defensiva; Plays setadas vence defensiva e perde para equilibrada; Equilíbrio vence equilibrada e perde para ofensiva |
| `STYLE_SIG` | `base 1,1` / `win 1,1`: força da marca do estilo, normal e quando vence o confronto |
| `SOLO_SHOT` | 0: chute de longe extra (330 a 440 px) do atacante solitário da 1-3-1. Desligado: mesmo 0,05 fazia a 1-3-1 vencer a 1-2-2 |

`STYLES` (as alavancas de equilíbrio):

| Estilo | pass | drib | range | shot | press | outros |
|---|---|---|---|---|---|---|
| toque | 1,7 | 0,75 | 400 | 2 | 1 | `mark 1,3`, `markWin 1,2` (v501), `markTeam 1,05`, `duel 1` (v500) |
| blitz | 0,75 | 1,45 | 360 | (1) | 2 | `sigWin 1,5` (v501) |
| muralha | 1 | 0,9 | 330 | (1) | 0 | `long: true`, `sigWin 1,6` (v501) |

- `pass`/`drib`: vontade de passar ou conduzir. `range`: distância máxima do chute. `shot`: multiplica o peso de chutar. `press 0` = bloco baixo, `press 2` = pressão alta com dois.
- `mark`/`markWin`/`markTeam`: botes do Toque contra o atacante isolado da Muralha (normal e com vantagem) e contra o resto do time dela. `duel`: bônus do Toque em todos os botes.
- `sigWin`: marca do estilo (Muralha no próprio campo, Blitz no campo deles) quando vence o confronto; sem vantagem vale `STYLE_SIG.base`.
- `sigWin` acima de ~1,45 quase não muda mais o resultado.
- Cada estilo também tem `name`, `sig` (frase da marca) e `desc` (texto da interface).

## 8.11 Fases, recompensas e baús

| Chave | Valor |
|---|---|
| `STAGES_PER_MAP` | 10 (a 10ª é o Boss do mapa) |
| `STEAL_BASE` | 24, 21, 18, 15, 12, 10, 8, 6, 5 (fases 1 a 9) |
| `STEAL_BOSS` / `STEAL_PER_GOAL` / `STEAL_ON_LOSS` | 3 / +0,5 por gol / 0 (só rouba vencendo) |
| `XP_BASE` / `XP_PER_STAGE` | 14 / 6 |
| `GOLD_BASE` / `GOLD_PER_STAGE` | 6 / 3 |
| `LOSS_REWARD_MULT` / `BOSS_REWARD_MULT` | 0,5 / 3 |
| `CHEST_ON_GOAL` / `CHEST_ON_WIN` / `CHEST_STD_PER_10S` | 8% / 10% / 1% (v477; eram 30% / 25% / 2%) |
| `CHEST_GOLD` | 5 a 25 (`CHEST_MAX_PENDING` saiu na v362: baús sem limite) |

A chance de roubo é `STEAL_BASE[fase]` × `stealMult` da raridade do inimigo.

## 8.12 Mapas e Bosses de fase

`MAPS[i] = { id, name, mode, size, levelMin, levelMax, boss: { charId, title, rarity, level, stats, nature, team, arena: { name, bossBuff, userDebuff, tint, grad?, vignette } } }`. Libera com jogadores suficientes para o modo. Detalhes em [04 §4.1](04-progressao.md#41-mapas-e-modos).

| Mapa | Modo | Níveis | Boss (fase 10) | Arena | `bossBuff` / `userDebuff` |
|---|---|---|---|---|---|
| 1 Seleção | 1×1 | 1 a 100 | Barou, Épico Nv 100 | Cela do Rei | 0,10 / 0,05 |
| 2 Segunda Seleção | 2×2 | 101 a 200 | Nagi, Raro Nv 200 | Sala do Gênio | 0,12 / 0,06 |
| 3 Terceira Seleção | 3×3 | 201 a 300 | Rin, Épico Nv 300 | Abismo do Rin | 0,14 / 0,07 |
| 4 U-20 | 4×4 | 301 a 400 | Sae, Lendário Nv 400 | Estádio Nacional U-20 | 0,15 / 0,08 |

| Boss | PAS | CHU | FIS | VEL | DEF | DRI | Nature | Time |
|---|---|---|---|---|---|---|---|---|
| Barou | 12 | 28 | 27 | 23 | 21 | 24 | Ego Puro | Reino do Rei |
| Nagi | 18 | 26 | 14 | 20 | 10 | 30 | Fantasista | Time do Gênio |
| Rin | 25 | 30 | 22 | 26 | 20 | 29 | Predador | Time do Prodígio |
| Sae | 31 | 29 | 24 | 28 | 24 | 31 | Visionário | Seleção U-20 |

`MAP_TITLES`: nomes provisórios mostrados na interface (Vale do Ego, Fortaleza Azul, Ninho do Predador, Arena da Coroa). `BOSS_TEAM_NAME` "Reino do Rei" é o padrão; cada Boss tem `team`.

## 8.13 Boss diário (v181 a v183)

Partida contra o Boss simulada em tempo real com o jogo fechado (`G.bossRoll` / `bossPoints` / `bossTicks`). Ver [04](04-progressao.md).

| Chave | Valor |
|---|---|
| `BOSS_TEAM_SIZE` | 3 jogadores enviados |
| `BOSS_WINDOW` | v389: 0–24 (envio a qualquer hora, 1 por dia via `s.bossDay`) |
| `BOSS_ROTATION` | por dia da semana (0 = domingo): Kaiser, Isagi, Bachira, Nagi, Barou, Rin, Sae |
| `BOSS_RUN.minutes` / `tickSec` / `startHour` / `fakeCount` | v391: 60 min / 60 s por lance / começa às 18h / 149 treinadores simulados no ranking |
| `BOSS_MIN_POINTS` | 1: pontos mínimos para ganhar baú |
| `BOSS_CHEST_BASE` | xp 400, gold 250, diamantes 3 (× `mult` do baú) |

`BOSS_RUN.rates` (chance por lance, × força: Poder 900 = 1×, até 2,5×) e `points`:

| Posição | gols | assist | passes | roubos | bloqueios | Pontos |
|---|---|---|---|---|---|---|
| atacante | 0,10 | 0,06 | 0,30 | 0,02 | 0,01 | gol 3, assist 2 |
| alaof | 0,05 | 0,08 | 0,40 | 0,05 | 0,03 | gol 3, assist 2, roubo 2, bloqueio 2 |
| aladef | 0,02 | 0,05 | 0,40 | 0,08 | 0,06 | gol 3, assist 2, roubo 2, bloqueio 2 |
| zagueiro | 0,01 | 0,02 | 0,30 | 0,10 | 0,10 | roubo 2, bloqueio 2 |

`BOSS_CHESTS` (um baú pela posição no ranking Geral; `w` = pesos por recompensa; `mult` multiplica XP, Gold e Diamantes; `boneco` = raridade do jogador que cai):

| Baú | Ranking | `drops` | `mult` | `w` xp/gold/diam/boneco | Raridades do boneco |
|---|---|---|---|---|---|
| Comum | demais (mín. 1 ponto) | 3 | 1 | 50/35/12/3 | comum 85, incomum 15 |
| Incomum | 51 a 100 | 4 | 2 | 42/33/18/7 | comum 50, incomum 40, raro 10 |
| Raro | 11 a 50 | 5 | 4 | 35/30/23/12 | incomum 45, raro 45, épico 10 |
| Épico | 4 a 10 | 6 | 8 | 28/27/27/18 | raro 45, épico 45, lendário 10 |
| Lendário | 2 e 3 | 7 | 16 | 22/24/30/24 | épico 60, lendário 40 |
| Despertado | 1 | 8 | 40 | 15/20/33/32 | lendário 100 |

## 8.14 Recompensa diária (v186)

Ciclo de 30 dias, 1 resgate por dia (vira à meia-noite local). `DAILY_MILESTONES` = [5, 10, 15, 20, 25, 30]. Itens: `gold`, `agua`, `xp`, `gatorade`, `diamantes`, `boneco` (de uma raridade).

| Dias | Sequência |
|---|---|
| 1 a 5 | 100 Gold, 3 Água, 300 XP, 2 Gatorade, 10 Diamantes |
| 6 a 10 | 200 Gold, 5 Água, 500 XP, 3 Gatorade, boneco Raro |
| 11 a 15 | 300 Gold, 8 Água, 800 XP, 5 Gatorade, 25 Diamantes |
| 16 a 20 | 500 Gold, 10 Água, 1200 XP, 8 Gatorade, boneco Épico |
| 21 a 25 | 750 Gold, 15 Água, 1600 XP, 10 Gatorade, 50 Diamantes |
| 26 a 30 | 1000 Gold, 20 Água, 2000 XP, 15 Gatorade, boneco Lendário |

## 8.15 Jogador inicial, nomes e técnico

| Chave | Valor |
|---|---|
| `SPRITE_SIZE` | fator de desenho por personagem para igualar o tamanho visual (v356); não mexe na hitbox |
| `OUTLINE_MINE` / `OUTLINE_ENEMY` / `SPRITE_OUTLINE` | `#4a95ff` / `#ff3b3b` / 2: contorno dos sprites em campo (v355) |
| `STARTER_OPTIONS` | 3: personagens da função mostrados na escolha do inicial (v350; a roleta e as chaves `ROULETTE_*` saíram a pedido do Mickey) |
| `TEAM_NAME_A` × `TEAM_NAME_B` | nome sorteado do time inimigo (16 × 14 palavras) |
| `NAME_MIN` / `TEAM_TAG_MAX` | 3 / 4 |
| `TEAM_RENAME_FREE` / `TEAM_RENAME_DIAMONDS` | 1 / 100 (provisório) |
| `DIAMOND_UNIT_PRICE` / `DIAMOND_EXACT_MAX` / `DIAMOND_PACKS` | R$ 0,50 / 10.000 / pacotes 10 R$4,80, 25 R$11,75, 50 R$23,00, 100 R$45,00, 250 R$110,00, Clube 120 R$24,90 (v289, vitrine) |
| `COACH_NATIONS` | 10 países (JPN, BRA, FRA, GER, ESP, ENG, ITA, ARG, POR, KOR) com 6 nomes e 6 sobrenomes cada |

## 8.16 Wildcard e Expedição

| Chave | Valor |
|---|---|
| `WILDCARD_SLOTS` / `WILDCARD_SLOTS_START` | 4 / 1 |
| `WILDCARD_XP_PER_MIN` | 6 (dividido entre quem treina) |
| `WILDCARD_DROP_PER_MIN` | 0,02 por jogador-minuto |
| `WILDCARD_OFFLINE_MAX_MIN` | 480 |
| `WILDCARD_SCENE_SECONDS` | 4 |

`EXPEDITION` (v158 a v166; ver [04 §4.11](04-progressao.md)): 1 jogador sai para farmar em tempo real. 10 regiões × `perRegion` 10 = `maxLevel` 100.

| Duração | min | `mult` | `prog` | `item` | `cons` |
|---|---|---|---|---|---|
| Rápida | 30 | 1 | 10 | 0,12 | 0,25 |
| Intermediária | 60 | 2 | 22 | 0,22 | 0,40 |
| Longa | 180 | 6 | 70 | 0,50 | 0,70 |
| Jornada de 8 horas | 480 | 16 | 200 | 0,90 | 1 |

- Regiões (`regions`, em ordem, com `rare` e afinidade `aff`): Campo de Terra (1, físico e passe), Futebol de Praia (1,2, físico e defesa), Quadras de Rua (1,4, drible e chute), Várzea Noturna (1,6, passe e velocidade), Campo Nevado (1,8, físico e velocidade), Estádio Abandonado (2,1, passe e chute), Selva do Drible (2,4, drible e velocidade), Vulcão do Ego (2,8, chute e físico), Arena Neo Egoísta (3,2, drible e passe), Torre BL PROJECT (3,8, velocidade e chute). `finds` é só visual.
- Fórmulas: `lvReq(L)` = nível mínimo `round(1 + (L−1)^1,5 × 0,6)` e Poder mínimo `round(850 × (1 + (lv−1)×0,012) × (0,9 + L×0,004) / 10) × 10`; `lvReward(L)` = Gold `20 + 4L`, XP `60 + 6 × (nível mínimo)`; `progNeed(L)` = `round((45 + 7,9L + 0,109L²) / 10) × 10`.
- Exemplos: L 1: Nv 1, Poder 770, 24 Gold, 66 XP, barra 50. L 50: Nv 207, Poder 3250, 220 Gold, 1301 XP, barra 710. L 100: Nv 592, Poder 8940, 420 Gold, 3612 XP, barra 1930 (~4,5 meses só com Jornadas de 8 h).

## 8.17 Sprites, câmera e habilidades

Detalhes de arte e animação em [10-desenho-sprites-vfx.md](10-desenho-sprites-vfx.md).

| Chave | Valor |
|---|---|
| `SPRITES[id]` | por id de personagem (`yoichi-isagi` com folhas completas de animação: parado, corrida, chute, passe, drible, bote, carrinho, atordoado, comemoração; `isagi` só card e campo) e `gk-robo` (goleiro, 7 animações). Quem não tem sprite fica com o círculo das iniciais |
| `GK_SPRITE` | `gk-robo`: sprite dos dois goleiros |
| `SPRITE_PX` / `SPRITE_FEET` | 1,15 unidades do campo por pixel da arte / 14 px dos pés abaixo do centro |
| `SPRITE_RUN_FPS` / `SPRITE_CYCLE` | 13 quadros/s (Wildcard) / 120 unidades por ciclo de corrida no campo |
| `CAM_ZOOM` | 1,6: zoom da câmera que segue a bola (opção "perto"; o padrão é câmera parada) |
| `SKILL_SLOTS` / `SKILL_DEMO_CD` | 4 slots na barra / 8 s de recarga de teste no modo dev (habilidades ainda não existem) |

## 8.18 Equilíbrio medido

Meta do Mickey: **cada vantagem do pedra-papel-tesoura perto de 70%**, conferida depois de toda mudança de IA ou de stamina. Medição padrão: Nv 100, IV 16, nature neutra, sem EV, mesmos 4 jogadores nos dois lados, lados alternados, empate vai ao gol de ouro, pelo menos 180 jogos por confronto (`dev/sim/wr2.js`; rodadas de 90 variam ±5 pontos).

| Estado | 1-2-2 > 1-3-1 (Toque > Muralha) | 1-3-1 > 1-1-3 (Muralha > Blitz) | 1-1-3 > 1-2-2 (Blitz > Toque) | O que mudou |
|---|---|---|---|---|
| v102 (+10%) | 62,5% | 97,3% | 93,0% | desequilibrado: 1-3-1 67% no geral, 1-2-2 35% |
| v103 (+5%) | 69,0% | 69,3% | 73,1% | geral 1-1-3 52%, 1-3-1 50%, 1-2-2 48% |
| v108 | 68% | 73% | 70% | passe para trás com opção livre |
| v131 | 72% | 69% | 71% | visão de jogo |
| v132 | 71% | 72% | ~75% | atacante solitário da 1-3-1 |
| v191 | 63% | 72% | 68% | modo duelo em time; carrinho com `duelOdds` (sem isso: 47/76/83) |
| v197 (sty.js) | 53 a 61% | 68% | 73% | plano build/attack nas táticas pequenas |
| v213, antes do `SHOT_CLOSE` | 58% | 72% | 66% | |
| v213 com `SHOT_CLOSE` 50 | 64% | 77% | 67% | valor adotado (70 px: 65/72/76; 105 px: 56/76/86, descartado por desequilibrar a Blitz) |
| **v226 (atual)** | **72%** | **70%** | **70%** | stamina e IVs; `FORMATION_EDGE` 0,05 para 0,03 (com 5% ficava em ~80%, o drible de primeira pesava mais na Blitz) |

- **v635 (meta do Mickey: ~67%)**, 36 pares formação × ataque, 40 partidas por par (`dev/sim` pe2.js + fit.py): vantagem da defesa 66%, do ataque 61% (modelo); pares com 1 vantagem a mais 68% em média (55 a 80%), com 2 vantagens 70% (59 a 81%), neutros 57%. Mais forte: 1-2-2 com Plays setadas; mais fraco: 1-2-2 com Bola no pé. Valores: `FORMATION_EDGE` 0,11, `PLAY_STYLE.pe` shotAdd 20/duelA 15/duelD 4, `set.duelD` -19, `rot` duelA 7/shotAdd 8, `STYLES.toque` duel 0,9/markWin 5, `STYLES.blitz.sigBase` 1,7, Toque não atravessa passes de combo.
- Espelhos dão ~50%.
- A 1-3-1 é a que menos marca gols; a 1-1-3 faz jogos abertos. O 4×4 tem poucos chutes (2 a 6 por time por partida na v102).
- Análises completas: `docs/analise/winrate-4x4-v102.md` (RPS e gols por confronto) e `docs/analise/estilos-v195.md` (comportamento de cada tática: passes por minuto, recuos, chutes, vitórias; bancada `dev/sim/sty.js`).

Outros resultados de simulação:
- **Regra do espelho**: na mesma formação, o time com mais nível, IV ou EV quase sempre vence.
- **Peso do EV** (20 jogos por cenário): nível 30 × 20 ganhou 17 a 20 e perdeu 0; IV 22 × 16 ganhou 18 a 20; EV 504 × 0 ganhou só 9 a 15 e perdeu 4 a 5. O EV pesa menos que nível e IV.
- **Tiro de meta**: botes nos 2 s depois da reposição caíram de 50 a 68% para 21 a 33%.
- **Dupla da frente da 1-2-2**: passes para trás caíram de 24% para 5%.
- **Passe para trás com opção livre**: 1-2-2 de 18% para 5%, 1-3-1 de 10% para 3%, 1-1-3 de 14% para 3%.
- **Visão de jogo**: IV 28 quase não recua (0 a 0,7%); IV 16 recua um pouco menos (ex. 1-3-1 de 27% para 20%).
- **Atacante solitário da 1-3-1**: recuos dele no campo deles contra a 1-2-2 caíram de 16% para 3% das decisões.
- **Plano build/attack** (v195 para v197): recuos 2×2 Defensivo 48% para 31%, 3×3 Defensivo 45% para 21%, Retranca 42% para 24%; jogadas da Retranca que terminam em chute 9% para 23% (gols 1,1 para 2,2 por jogo).
- **Acréscimos do 1º tempo**: média ~1 s extra, máx ~3,4 s.
- **Modo duelo no 1×1** (40 partidas): condução média 1,6 para 1,3 s, conduções acima de 3 s 16% para 9%, dribles 12,7 para 15,4/min, chutes 10,3 para 12,2/min, gols ~5,3 para 5,6/min, trave 0,5/min, carrinho certo 1,75/min (`dev/sim/m1.js`).
- **Stamina v226** (sim sem itens): energia ~36 a 47 no intervalo e ~12 a 25 no fim.

## 8.19 Constantes fixas no motor

Algumas regras de IA têm números dentro do `engine.js`, não no config. Os principais:

| Regra | Valor |
|---|---|
| Caminho livre (`clear`) | corredor de ~110 px até o gol |
| Bloqueio do marcador no chute | até 75 px à frente, 55 px de lado ou atrás; `0,12 + defesa/110` (15 a 45%) |
| Bloqueio no caminho do chute | `0,18 + defesa/90` (20 a 60%), alcance `r + 8 + 24` px |
| Corte de passe | `0,72 × (defesa/passe)²` (25 a 97%) |
| Toque: passes que atravessam | 20% (45% com a vantagem) |
| Time sem atacantes | deixa passar 55% dos passes; em 60% dos botes perdidos só segura (stun 0,35 s); ataque ×0,9, defesa ×0,85 |
| Expoente do duelo e limites | 4; 8% a 92% |
| Duelo | `duelCd` 0,9 s; drible ganho `burst` 0,7 s; bote ganho deixa o portador 0,5 s no chão |
| Goleiro | espalma 40%; velocidade 230 (700 em chute defensável, 120 no lado errado); passa em 560 px/s |
| Tiro de meta | proteção de 1,2 s (`duelCd`), janela de 1,6 s, adversários a 180 px |
| Dupla da frente | janela de 4 s depois de recuperar a bola |
| Atacante isolado da Muralha | janela de 3 s depois de recuperar a bola |
| Infiltração (enfiada) | ponto 115 px à frente, vantagem de 30 px |
| Passe para trás | espaço livre > 90 px, marcado < 70 px |
| Anti-amontoado | 46 px de distância mínima, desvio de 56 px |
| Visão de jogo | `(média − 8) / 20` |
| Condução | `0,7 + 0,01 × Drible` da corrida; ginga ×0,82 |
| Atrito da bola | `exp(−1,05·dt)`; chute `exp(−0,2·dt)`; chute some abaixo de 160 px/s |

Ver [02](02-motor-e-ia.md) para o efeito de cada uma.

## 8.20 Alavancas de equilíbrio (receitas)

- Vantagem do pedra-papel-tesoura muito alta ou baixa: `FORMATION_EDGE` primeiro (mexe nas três ao mesmo tempo); depois `STYLES.*.sigWin` (Blitz e Muralha), `toque.markWin`/`mark`/`duel`, `STYLE_SIG`.
- Um estilo finaliza demais: `STYLES.*.shot` e `range`, `SHOT_CLOSE`, `DUEL_BURST_SHOT_TEAM`.
- Jogador forte demais ou fraco demais: `LEVEL_POWER` (e `rel` no motor), `EV_POWER`, `IVX`.
- Jogo cansado demais: `ENERGY_DRAIN_*`, `IVX.fisDrain`, `ENERGY_MIN_MULT`, `HEAL_AUTO_BELOW`, preço e `restore` dos consumíveis.
- Jogo com poucos ou muitos gols: `GOAL_*`, `IVX.shot*`, `MERCY_DIFF`.
- Depois de qualquer mudança, rodar a bancada de [09 §9.5](09-build-publicacao-e-simulacao.md) com pelo menos 180 jogos por confronto.
