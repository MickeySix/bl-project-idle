# 1. Arquitetura e mapa de arquivos

[← Índice](README.md)

## Visão geral

O jogo é uma página estática. Não há bundler, módulos ES nem dependências de runtime além das fontes do Google Fonts (Barlow Condensed, Manrope e JetBrains Mono). Cada arquivo JS é um IIFE que pendura o que exporta no objeto global `window.BL`.

```
index.html
 ├─ css/style.css
 ├─ css/clan.css (v624: tela da Guilda)
 ├─ css/rmt.css (v626: tela do RMT)
 ├─ css/gamepass.css (v628: tela do Game Pass)
 ├─ css/pvp.css (v630: tela da Arena PvP)
 └─ js/ (carregados nesta ordem, todos com ?v=<BUILD>)
     config.js    → BL.BUILD, BL.CONFIG, BL.cleanTag
     accounts.js  → BL.Accounts
     database.js  → BL.CHARACTERS, BL.CHAR_BY_ID, BL.ITEMS, BL.ITEM_BY_ID, BL.ITEM_SLOTS, BL.ITEM_RARITY_WEIGHT, BL.SKILLS
     players.js   → BL.util, BL.rarity…, BL.NATURES, BL.makePlayer/Starter/Enemy, BL.baseStat, BL.ev, BL.levelMult, BL.power, BL.teamPower, BL.goalkeeperFor, BL.goalChance, BL.stealChance
     engine.js    → BL.Match (classe), BL.FIELD, BL.spriteImg, BL.fieldSprite
     game.js      → BL.Game (objeto G: estado, partida, progressão, save)
     ui.js        → tudo da tela; exporta BL.UI = { renderAll, toast } e BL.sfx
     clan.js      → v624: BL.Clan (Guilda: dados, partidas de Raide/Guerra e a própria tela #clOv)
     rmt.js       → v626: BL.RMT (mercado em reais/Pix entre treinadores e a própria tela #rmOv)
     gamepass.js  → v628: BL.GamePass (passe de temporada: XP, trilhas, missões diárias, auras e a tela #gpOv)
     pvp.js       → v630: BL.PvP (Arena PvP: Ranqueada, Copas do dia, Multi 2x2, histórico e a tela #pvOv; partidas via G.pvpFight)
```

A ordem importa: cada arquivo usa o que os anteriores criaram (`players.js` lê `BL.CONFIG` e `BL.CHAR_BY_ID`; `engine.js` usa `BL.util`, `BL.baseStat` e `BL.levelMult`; `game.js` cria `BL.Match`; `ui.js` amarra tudo).

## Arquivos

Linhas longas: o tamanho em KB diz mais que o número de linhas. Nos arquivos grandes, ache o trecho com `grep` e leia só ele.

| Arquivo | Tamanho (v226) | Responsabilidade |
|---|---|---|
| `game/index.html` | 367 linhas, 27 KB | Estrutura de todas as telas: landing (`#landing` com `#ldHome`, `#ldAbout`, `#ldWiki`, `#ldRanking`), login (`#ldAuth`), escolha de função (`#start`; o inicial é escolhido num modal), jogo (`#app`: topbar, painéis, placar, `#pitch`, dock), trilho de janelas flutuantes (`.rail`), pop-up (`#modal`), toasts. Detalhe em [05](05-interface.md). |
| `game/css/style.css` | 1623 linhas, 155 KB | Todo o visual (paleta Blue Lock, painéis, cards, dock, pop-ups, landing, Wiki, Boss, Expedição, Diária). Modo `html.fit-screen` para telas largas. |
| `game/js/config.js` | 448 linhas, 36 KB | `BL.BUILD` e todos os números de equilíbrio e tabelas em `BL.CONFIG` (ver [08](08-config-e-balanceamento.md)). |
| `game/js/accounts.js` | 60 linhas | Contas locais e sessão (ver [06](06-contas-e-save.md)). |
| `game/js/database.js` | 72 linhas | Personagens por posição, banco de itens, `BL.SKILLS` (vazio: habilidades ainda não criadas). |
| `game/js/players.js` | 139 linhas | Geração de jogadores, raridade, nature, status efetivo, poder, fórmulas de gol e roubo (ver [03](03-jogadores.md)). |
| `game/js/engine.js` | 1775 linhas, 130 KB | `BL.Match`: física, IA, duelos, stamina, IVs ([02](02-motor-e-ia.md)) e todo o desenho do campo, sprites e efeitos ([10](10-desenho-sprites-vfx.md)). Também `BL.spriteImg`/`BL.fieldSprite`. |
| `game/js/game.js` | 966 linhas, 58 KB | Objeto `G` (`BL.Game`): save, início e fim de partida, pré-jogo, vestiário, recompensas, roubo, progressão, EV, itens, Água/Gatorade, Wildcard, Expedição, Boss, Diária, registro de partidas ([04](04-progressao.md)). |
| `game/js/ui.js` | 1643 linhas, 152 KB | Painéis, pop-ups (`MODALS`), janelas flutuantes, áudio (`BL.sfx`), escolha do inicial, laço de desenho, landing, Wiki, contas, modo dev ([05](05-interface.md), [07](07-audio.md)). |
| `game/img/` | | `campo.jpg` (estádio inclinado, fundo do campo), `hero.jpg` (landing), `logo.png` (logo oficial), `engrenagem.png`, `sobre/*.jpg` (aba Sobre), `sprites/*.png` (Isagi e goleiro robô, ver [10](10-desenho-sprites-vfx.md)). |
| `game/snd/` | | 9 mp3 (ver [07](07-audio.md)). |
| `game/README.md` | | Notas da versão 0.1 (desatualizadas; a referência é esta pasta). |

## Camadas

1. **Dados e regras puras** (`config.js`, `database.js`, `players.js`): sem DOM, sem estado. Podem ser carregados no Node com `global.window = global`.
2. **Motor** (`engine.js`): a classe `Match` recebe times, papéis e opções e simula em passos fixos de 1/60 s. Não conhece o save; comunica tudo por `opts.onEvent(type, data)`. Também sabe se desenhar (`draw(ctx, cw, ch)`).
3. **Jogo** (`game.js`): o objeto `G` (`BL.Game`) guarda `state` (o save), cria partidas, trata eventos do motor, aplica recompensas e salva. Avisa a interface por um barramento simples `G.on(type, fn)` / `G.emit(type, data)`.
4. **Interface** (`ui.js`): escuta os eventos de `G`, desenha painéis e trata cliques por delegação (um único `document.addEventListener("click")` que despacha por `data-*`).

## Eventos

### Do motor para o jogo (`Match.onEvent` → `G.onMatchEvent`)

| Evento | Quando | O que `G` faz |
|---|---|---|
| `goal` | gol marcado (`scoreGoal`) | log, chance de baú (`CHEST_ON_GOAL`, só gol seu e fora do treino), som, `emit("score")` |
| `shot` | chute (`shoot`) | log com a % de gol |
| `pass` | qualquer passe (`kickTo`) | som de passe |
| `gkpass` | reposição do goleiro | nada (reservado) |
| `save` | defesa (`keeperCatch`), `parry` = espalmou | som e log |
| `dribble` / `tackle` | duelo ganho pelo portador / pelo marcador (`duel`) | log e som |
| `log` | textos livres (tabela, bloqueio, recuo, lançamento, interceptação) | log |
| `halftime` | fim do 1º tempo | `G.halftime`: descanso (`HALFTIME_REST`), Módulo de cura do VIP e abre o Vestiário (`emit("vestiario")`) |
| `golden` | empate no fim do 2º tempo | log |
| `end` | fim da partida | `G.endMatch` (ou `endTraining`) |

Além disso, `match.onSample` (1 vez por segundo de jogo) chama `G.autoHeal` e grava posições no registro da partida.

### Do jogo para a interface (`G.emit`)

`matchStart`, `matchEnd`, `score`, `log`, `resources`, `roster`, `chest`, `wildcard`, `dev`, `teamName`, `stage`, `reset`, `prematch` (pop-up de formação antes do jogo), `vestiario` (intervalo), `cons` (Água/Gatorade), `skills` (recarga dos slots de habilidade). Cada um dispara as funções `render*` correspondentes em `ui.js` (`G.on(...)`).

## Laço principal

`ui.js` → `frame(t)` via `requestAnimationFrame` (`startLoop`):

- `G.match.update(dt)`: acumula tempo real × `speed` e chama `step(1/60)` quantas vezes couber (teto de 0,1 s por quadro, para não "pular" depois de uma aba parada). Com `match.paused` (pré-jogo, pausa tática, vestiário) o motor fica congelado.
- `G.match.draw(ctx, w, h)` no canvas `#pitch` (ver [10](10-desenho-sprites-vfx.md)).
- Placar a cada 0,25 s (`renderScore`); dock, trilho lateral e janelas flutuantes a cada 1 s.

Fim de partida: `G.endMatch` agenda a próxima com `setTimeout(startMatch)` em 3,4 s na vitória (tempo da roleta de roubo) ou 2,6 s na derrota, divididos por `max(1, GAME_SPEED × 0,6)`; o treino reinicia em 1,2 s.

Timers separados em `ui.js`: Wildcard (`G.wcTick`, 5 s, com aviso do que rendeu offline), Expedição (`G.expTick` e contagem, 1 s), Diária (bolinha no botão e contagem até a meia-noite, 1 s), botões de cura e de pausa (1 s), pré-jogo (0,25 s), vestiário (contagem), slots de habilidade (50 ms) e o canvas do Wildcard (`wcDraw`, `requestAnimationFrame` próprio).

## Convenções do código

- Textos visíveis em português (pt-BR); comentários também.
- Números de equilíbrio em `BL.CONFIG`, nunca soltos no código. Exceção: constantes internas de IA no motor (distâncias e pesos de decisão).
- Comentários com `vNNN` marcam a versão em que uma regra entrou, quase sempre com o pedido do Mickey que a originou.
- Toda função que muda o save termina com `this.save()` e um `emit`.
