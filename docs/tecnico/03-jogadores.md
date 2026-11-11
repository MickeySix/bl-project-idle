# 3. Sistemas de jogador

[← Índice](README.md)

Arquivos: `game/js/database.js` (personagens e itens), `game/js/players.js` (geração e fórmulas, `BL.makePlayer` e vizinhos), `game/js/game.js` (objeto `G`: EV, XP, roubo, itens, escalação), números em `game/js/config.js` (`BL.CONFIG`, abreviado `C`). Progressão, recompensas e economia ficam em [04](04-progressao.md); o que cada status faz dentro da partida fica em [02](02-motor-e-ia.md).

## 3.1 Objeto jogador

Criado por `BL.makePlayer(charId, opts)` (opts: `rarity`, `shiny`, `stats`, `nature`, `level`) e guardado em `state.roster`:

```js
{
  uid, charId, name, short, initials, position,   // do personagem (database.js)
  rarity, shiny, stats: { passe, chute, fisico, velocidade, defesa, drible }, // IV 1..31
  nature, level, xp,
  items: { chuteira, caneleira, camisa },       // ids de BL.ITEMS ou null
  ev: { <status>: pontos },                        // só existe depois do primeiro EV distribuído
  skills: [{ id, lv }],                            // v625: habilidades equipadas (C.SKILL_DEF); slots = skills da raridade
  boss?, title?,                                   // só em inimigo-Boss (BL.makeEnemy)
  temp?                                            // jogador de teste do modo dev (G.devFill): não ganha XP, não fica no elenco
}
```

`uid` é único (`Date.now` + contador + aleatório). Acha-se o jogador por `G.player(uid)` (elenco + jogadores de teste do dev) ou `G.enemyPlayer(uid)` (adversários e reservas deles na partida).

## 3.2 Personagens e posições

- `database.js` monta `BL.CHARACTERS` (107): 93 nomes do anime distribuídos por posição (Atacante 27, Ala Ofensivo 24, Ala Defensivo 20, Zagueiro 22) mais 14 nomes extras (amigos do Mickey, `extra: true`) em rodízio pelas 4 posições. `BL.CHAR_BY_ID` indexa por id.
- `id` é o nome em slug, `short` é o último nome, `initials` são as iniciais (círculo quando o personagem não tem sprite em `C.SPRITES`, cuja chave é o id; hoje só Isagi e o robô goleiro).
- `C.POSITIONS` (4; v433 nomes do Mickey): `atacante` Pivô PIV, `alaof` Ala Of ALO, `aladef` Ala Def ALD, `zagueiro` Fixo FIX, com descrição e `focus` (2 status de foco, só informativo e usado na escolha de função: ATA chute+drible, ALO velocidade+passe, ALD defesa+velocidade, ZAG físico+defesa).
- v434: no **meu** time a posição em campo vem da vaga no Meu time (`C.LINEUP_POS` = zagueiro, aladef, alaof, atacante, na ordem de `s.active`), não do personagem. `G.rolesFor(list, tac, true)` usa a vaga. O card mostra a posição da vaga e, se diferente, "(é X)" com a do personagem.
- A posição pesa em três lugares: quem ataca na tática (`G.rolesFor` ordena Atacante > Ala Of > Ala Def > Zagueiro e marca os `tactic.atk` primeiros como `"atk"`), as chances e os pontos da simulação do Boss (`C.BOSS_RUN.rates/points`, ver [04 §4.12](04-progressao.md#412-boss-chefes-e-raids)) e a escolha do inicial.
- Os 4 Bosses de mapa (Barou, Nagi, Rin, Sae, `C.MAPS[i].boss.charId`) ficam fora do sorteio de inicial (`BL.makeStarter`) e de inimigos comuns, mas podem ser roubados ou ganhos depois como jogador normal.
- Personagens `extra` ficam fora do ranking simulado do Boss e dos jogadores sorteados nos baús do Boss.
- **v339 (Mickey): só personagens com sprite ficam no jogo.** A lista completa fica em `BL.ALL_CHARACTERS` e `BL.CHAR_BY_ID`; `BL.CHARACTERS` só tem os ids de `C.ACTIVE_CHARS` (v340: `yoichi-isagi`, `btter`, `bunny-iglesias`, `don-lorenzo`, `hugo-vivian`, `lockhart`; v341: + `marin` (ATA) e `mickey` (ALD), que já existiam como nomes extras; v342: + `onazi-innocent` (ALO, nome novo) e `ratoworld` (ALD, nome extra `ratoWORLD`); v343: + `riq` (ALO, nome extra) e `sae-itoshi` (ALO); v344: + `teddy-knight` (ALD, nome novo); v345: + `seishiro-nagi` (ATA); v346: + `shoei-barou` (ATA); v347: + `meguru-bachira` (ALO); v348: + `hyoma-chigiri` (ALO) e `rensuke-kunigami` (ATA), com animações provisórias (ver doc 10); posições propostas pelo Claude: Btter ALO, Bunny Iglesias e LockHart ATA, Hugo Vivian ALD, Don Lorenzo ZAG, que já estava na lista). Todo sorteio (opções do inicial, inimigos, Liberar tudo, drops de jogador, ranking simulado do Boss) usa `BL.CHARACTERS`. Quando falta personagem: `makeStarter` usa qualquer liberado na posição escolhida (`makePlayer` aceita `opts.position`) e `makeEnemy` repete o personagem no time com posição sorteada. v349 (Mickey): jogador do elenco sem sprite também sai: `Game.load` move para `s.offRoster` (e limpa `active`, `bench`, `teamSets`); volta sozinho quando o personagem entrar em `C.ACTIVE_CHARS`. Boss do Mapa 3 virou Bachira (era Rin). Para liberar um personagem novo: sprite em `C.SPRITES` e o id em `C.ACTIVE_CHARS`.
- **v432 (Mickey): posições oficiais** em `BL.MICKEY_POS` (database.js, por id/slug): Pivô = `atacante`, Ala Of = `alaof`, Ala Def = `aladef`, Fixo = `zagueiro`. Sobrepõe a posição do banco; ao liberar personagem novo, conferir se ele está no mapa (a lista do Mickey já traz amigos ainda sem sprite: guiro, bricio, zzapy, pekas, b, winter, efipe, sereno, yars, kyotz, blade, hyf, wellio, hazih, alanzin, lpz, thz, pedro-rego; e Ryosuke Kira). `Game.load` reescreve `p.position` do elenco com o mapa. **v589 (Mickey):** a lista oficial de 63 personagens tem todos ficha no banco (`BL.ALL_CHARACTERS`, 131 no total): entraram Bricio, Zzapy, Pekas, B, Winter, Efipe, Sereno, Yars, Kyotz, Blade, Hyf, Wellio, Hazih, Alanzin, Lpz, Thz, Pedro Rego e Ryosuke Kira, com as posições de `MICKEY_POS` (conferidas com a lista dele); Btter passou de Pivô para Fixo. Para liberar: sprite em `C.SPRITES` e o id em `C.ACTIVE_CHARS`.
- **v631**: `C.ACTIVE_CHARS` tem 44 personagens (+14 do SPRITES 2: Aryu, Raichi, Blade, Karasu, Kurona, Kiyora, Nanase, Otoya, Pekas, Shidou, Yukimiya, Kira, Niko, Viikks). Viikks entrou no banco (lista v589) como Ala Def (Mickey).

## 3.3 Status (IV)

Seis status de 1 a 31 (`C.STAT_MAX`), total máximo 186 (`C.STAT_TOTAL_MAX`): Passe, Chute, Físico, Velocidade, Defesa, Drible (`C.STATS`, rótulos em `C.STAT_LABEL`/`STAT_SHORT`; `STAT_KIND` só classifica Neutro/Ofensivo/Defensivo). `BL.rollStats(total)` parte de 1 em cada e distribui o resto em passos aleatórios de 1 a 4, respeitando o teto de 31. Os IV não mudam no jogo normal; só o modo dev edita (`G.devSetIv`, 1..31).

## 3.4 Raridade

A raridade é a faixa da soma dos 6 status, em % de 186 (`BL.rarityFromTotal`, `C.RARITIES`):

| Raridade | Teto | Pontos | Peso | Chance | Habilidades | Multiplicador de roubo | Cor |
|---|---|---|---|---|---|---|---|
| Comum | 25% | 24–46 | 80 | 37,2% | 1 | ×1,00 | `#9aa7c7` |
| Incomum | 50% | 47–93 | 60 | 27,9% | 1 | ×0,80 | `#4fd68a` |
| Raro | 70% | 94–130 | 50 | 23,3% | 1 | ×0,60 | `#3f9bff` |
| Épico | 85% | 131–158 | 20 | 9,3% | 2 | ×0,35 | `#b06bff` |
| Lendário | 95% | 159–176 | 5 | 2,3% | 2 | ×0,15 | `#ffb02e` |
| Despertado | 100% | 177–186 | 0,1 | 0,05% | 3 | ×0,025 (v552) | `#ff3f5e` |

- **v552 (Mickey):** Despertado é 2× mais difícil de roubar (`stealMult` 0,05→0,025) e, na partida, todo Despertado (seu ou inimigo) solta aura dourada `C.AWAKE_AURA` `#ffd23f` (engine, no lugar da aura colorida do Boss). O personagem Boss de cada mapa sempre vem Despertado (`C.BOSS_AWAKE`, ramo Boss de `BL.makeEnemy` em players.js); os colegas do Boss sorteiam raridade normal.
- Sorteio: `BL.rollRarity()` usa os pesos como relativos (somam 215,1). Só vale para inimigos comuns; o jogador inicial, os de baú do Boss e os da Diária têm raridade definida.
- Pontos: `BL.rarityPointRange(id)` dá a faixa; `makePlayer` sorteia `lo + (hi − lo) × √aleatório`, puxando para o topo da faixa. O Comum tem piso de 24 (`COMMON_MIN_POINTS`) para não surgir inimigo com tudo em 1.
- **Shiny** (7ª raridade, `shiny: true`): chance `C.SHINY_CHANCE` = 1/400 por inimigo gerado em `BL.makeEnemy`. Sempre Lendário, com `SHINY_BASE` 25 + 0 a `SHINY_EXTRA_MAX` 4 em cada status. Roubar um Shiny mantém `shiny` e a raridade, mas os status são sorteados de novo (de novo 25 + 0..4).
- **Inicial**: `BL.makeStarter(posição, charId)` usa o personagem escolhido pelo jogador (v350; sem `charId` sorteia de `BL.starterPool(posição)`: personagens da posição sem Bosses de mapa) e cria Comum com 15 em tudo (90 pontos), Nv 1, nature sorteada. A raridade é fixa por regra. Desde a v350 não há roleta: o jogador escolhe entre até 3 opções da função (`revealStarter` em ui.js, ver doc 05).
- Jogadores ganhos fora de partida (baú do Boss e Diária) usam `makePlayer(id, { rarity, level: 1 })`: personagem sorteado, status dentro da faixa da raridade.
- "Habilidades" por raridade (`skills`) = quantos slots o jogador tem. Desde a v625 existem as 14 habilidades (`BL.SKILLS`, de `C.SKILL_DEF`; motor em [02](02-motor-e-ia.md)). Biblioteca `state.skillLib { id: { lv } }` (`G.skLib`); `C.SKILL_FREE` (false desde a v653: todas têm regra; o modo dev libera todas). Desde a v652 as Raras vêm pelo nível da conta (`C.SKILL_UNLOCK_LV`, Mickey): Direct Shot Nv 1, Drible do Monstro 10, Passe Calibrado 25, Tabela Relâmpago 50, Energia Infinita 75, Arrancada Reta 100. Desde a v653 as Épicas e Lendárias vêm do Boss (fase 10) de um ato numa dificuldade (`C.SKILL_UNLOCK_CLEAR` = [mapa, dificuldade], lido em `progress.cleared`): Inferno libera Voleio Acrobático (Ato 1, 1v1), Arrancada da Pantera (Ato 2, 2v2), Muralha do Capitão (Ato 3, 3v3) e Ninja Invisível (Ato 10, 4v4); Tormento libera Passe Mágico (Ato 1), Chute Curvado (Ato 2), Ego (Ato 3) e Visão de Jogo (Ato 10). Quem já tinha vencido esses Bosses ganha na hora. `G.skNeed(id)` dá o nível que falta (0 = liberada), `G.skNeedClear(id)` o Boss que falta e `G.skLock(id)` o texto da carta travada; `skLib` tira de saves antigos a Rara ainda não liberada (e do slot do time); ao subir de nível aparece "Habilidade liberada"; no pop-up Habilidades a carta travada mostra o nível. Desde a v638 as habilidades não são equipadas em jogador: são do time (4 slots, `G.skillToggle(id, slot)`, ver [05](05-interface.md)); `p.skills` só vale para o inimigo. Já existe pronto, desligado em config: livros nos baús épico/lendário e no Boss (`C.SKILL_BOOK`, `G.skBook`: livro novo libera, repetido sobe o nível até 10, no máximo vira Gold). Inimigos: `BL.enemySkills` (`C.SKILL_ENEMY`).

## 3.5 Nature

`C.NATURE_GRID` é uma grade 6×6: a linha é o status que sobe, a coluna o que desce (ordem de `C.STATS`). A diagonal é neutra (6 neutras + 30 com efeito = 36 natures). `BL.NATURES` vira uma lista `{ name, up, down }`, `BL.NATURE_BY_NAME` indexa por nome. O efeito é ±10% (`C.NATURE_MOD`). A nature é sorteada (`BL.rollNature`, uniforme nas 36); Bosses têm nature fixa (`MAPS[i].boss.nature`). A tabela completa aparece na Wiki da página inicial (`buildWiki`).

## 3.6 EV (pontos de esforço)

- Máximo de 252 por status e 504 por jogador (`EV_MAX_STAT`, `EV_MAX_TOTAL`). 252 EV num status = +20% nele (`EV_POWER`); proporcional: `1 + 0,20 × EV/252`.
- **Ganho**: o fim de cada partida normal (não treino) soma no banco da conta (`state.evPoints`) vitória +4, derrota +1 (`EV_WIN`, `EV_LOSS`), ×3 contra o Boss (`BOSS_REWARD_MULT`).
- **Distribuir**: `G.addEv(uid, status, n | "max")` respeita o teto por status, o teto total e o saldo do banco; devolve quanto aplicou. Só vale para jogadores seus.
- **Resetar**: `G.resetEv(uid)` custa 300 Gold (`EV_RESET_COST`, não entra no `goldSpent` do Analyser) e devolve os pontos do jogador ao banco.
- **Modo dev**: banco infinito (`G.evPool()`), reset grátis, nível ±1/10/100 e "Todos os IV em 31/15/1".
- **Interface**: janela `MODALS.ev(uid)`, aberta ao clicar num jogador (cartas do campo, "Meu time", Jogadores, ranking do Boss). Mostra Qualidade IV (soma/186 e a raridade equivalente via `rarityFromTotal`), Poder, EV, nature e o status final de cada um. Para adversários (`G.enemyPlayer`) a mesma janela abre só para leitura, com a chance de roubo.
- A corrida continua limitada a 210 (`RUN_MAX`) mesmo com EV em Velocidade.

## 3.7 Itens e slots

- v473 (Mickey): 30 itens de jogador em `BL.ITEMS` (`database.js`): 10 chuteiras (`ch-*`), 10 caneleiras (`ca-*`) e 10 camisas (`cm-*`), 2 de cada raridade (comum → lendário) por slot. Slots (`BL.ITEM_SLOTS`): `chuteira`, `caneleira`, `camisa` (o Acessório saiu). Cada item soma pontos direto no status (`bonus`, mais pontos quanto maior a raridade: ~2, 4, 6, 9 e 13), antes da nature (`BL.itemBonus`). Um item por slot por jogador (`p.items`). Cada item tem `desc` (texto da Loja) e `art` (desenho): o desenho é só do item, não muda o uniforme em campo.
- Desenhos: `BL.itemSvg(item)` gera um SVG 64×64 na hora (sem arquivo): forma pelo slot (camisa, chuteira, caneleira) e padrão `art.p` (listras, faixa, raio, chamas, número etc.) com as cores `art.a`/`art.b`; itens do treinador usam `art.g` (caderno, apito, prancheta, cofre, chave, troféu...).
- Saves antigos: `G.load` troca ids que saíram pelos novos (`BL.ITEM_ALIAS`), move `items.acessorio` para `camisa` e devolve à mochila o que não cabe no slot.
- Raridade do item sorteada por peso (`BL.ITEM_RARITY_WEIGHT`): comum 55, incomum 28, raro 12, épico 4,5, lendário 0,5; sorteia-se a raridade e depois um item dela (`openChest`, drops do Wildcard e da Expedição).
- `state.inventory` é uma lista de ids (repetidos permitidos; itens de jogador e do treinador juntos). `G.equip(invIndex, uid)` troca o item do slot e devolve o antigo ao inventário (recusa item do treinador); `G.unequip(uid, slot)` tira. Equipar pela Mochila (escolhe o jogador) ou pela janela Itens; remover na janela Jogadores.
- v522 (Mickey, lista de itens): 39 equipamentos novos, agora 22 chuteiras, 22 caneleiras e 25 camisas que caem de baú (as 4 Camisas de Posição contam como um modelo). Raro para cima pode ter `ef` (texto do efeito especial); desde a v524 os efeitos valem na partida (`C.ITEM_FX`, ver [02 §2.3](02-motor-e-ia.md#efeitos-dos-equipamentos-ifx-v524)); Caneleira da Base e Camisa de Posição mexem no status (`BL.baseStat`, `BL.itemBonus`). Itens com `img` (índice) usam a arte do Mickey na folha `img/itens/atlas.png` (9 colunas × 8 linhas de 128 px; `BL.itemSvg` devolve um `<span class="it-svg it-img">` com `background-position`; folha única por causa do limite de 511 arquivos do artifact; recortes soltos em `docs/itens/arte-recortes/`); v523: Camisa Pesada e Camisa de Chuva ganharam arte; todos os equipamentos de baú têm desenho, e item sem `img` usa o SVG. v532: Propostas, fichas, Treino Particular, os 51 itens do treinador, os 7 itens de personagem e o Cofre do Presidente usam a arte do Mickey na segunda folha `img/itens/atlas2.png` (mesmo formato 9 × 8; `BL.IT2` mapeia id → posição, `BL.it2Art(id)`). `BL.itemSvg` e `shopArt` (ui.js) olham `BL.IT2` primeiro; recortes em `docs/itens/arte-recortes-2/`. A Chuteira Blue Lock virou Chuteira Ofensiva (mesmo id `ch-bluelock`).
- v479: 6 Camisas Básicas `cb-passe`…`cb-drible` (comum, +1 no status do nome, `shop: true`): só na Loja, nunca em baú/Wildcard/Expedição.
- Origem: baús de partida ([04 §4.4](04-progressao.md#44-baús)), Wildcard ([§4.7](04-progressao.md#47-wildcard)), Expedição ([§4.11](04-progressao.md#411-expedição)) e, desde a v473, a Loja por Gold (`C.ITEM_PRICE` pela raridade: 300, 900, 2.500, 7.000, 20.000; `G.buyItem`).
- **Itens do treinador** (v473): 20 em `BL.MGR_ITEMS` (`tr-*`, `mgr: true`), 5 de cada efeito (`fx`): `xp` (XP das partidas), `gold` (Gold das partidas), `chest` (chance do baú padrão durante a partida), `ev` (pontos de EV por partida, a fração fica em `s.evCarry`); valores por raridade 3%, 5%, 8%, 12%, 16%. O treinador tem `C.MGR_SLOTS` = 3 espaços (`s.mgrEq`); `G.mgrEquip(id, slot)`, `G.mgrUnequip(slot)`, `G.mgrFx()` soma os efeitos (aplicados em `endMatch` e `stdChestTick`). Nenhum item de roubo por enquanto (aba Roubo da Mochila segue vazia).

### Item de personagem e Treino Particular (v527)

- 7 itens de personagem (`BL.CHAR_ITEM_LIST`, `ci: true`, `slot: "personagem"`) ficam fora de `BL.ITEMS` (não caem em baú, Expedição nem Loja) e entram em `BL.ITEM_BY_ID`. Espaço extra `p.items.personagem`, aparece só para jogador Épico ou acima (`C.CHAR_ITEM_MIN`). `G.equip` recusa se `!BL.charItemOk(p, it)`. Efeitos em `C.CHAR_ITEMS` (ver 02). Arte ainda é emoji (`it.emo`, `.it-emo`). Fontes: Boss do mapa (`C.CHAR_ITEM_BOSS` 1% por vitória) e troca de Ficha Roxa/Dourada.
- Treino Particular (`C.SUPPLIES["tp-nivel"]`, `cat: "nivel"`, `noShop`): `G.useLevelItem(id, uid)` sobe 1 nível sem gastar XP, até `PLAYER_MAX_LEVEL`. Ainda sem fonte no jogo (o Mickey decide; ideia: Diária).

## 3.8 Status efetivo e Poder

```
BL.baseStat(p, k) = (IV + bônus de itens) × nature (1 ± 0,10) × (1 + 0,20 × EV/252)
BL.levelMult(nível) = 1 + (nível − 1) × 0,012          // Nv 100 ≈ 2,19×, Nv 1000 ≈ 13×
BL.power(p)    = round(Σ baseStat(p, 6 status) × levelMult(nível) × 10)   // igual para todos
BL.teamPower(s) = Σ power dos 4 primeiros (state.active, completando com o elenco)
```

- Inicial Nv 1 com 15 em tudo: Poder 900. O Poder é a régua dos requisitos da Expedição (`lvReq`), da força no Boss (`bossForce`, 900 = ×1) e do Ranking da página inicial.
- Em campo o motor ainda aplica cansaço (`fatigue`: abaixo de 50 de energia o status cai até ×0,45, `C.ENERGY_MIN_MULT`), buff/debuff da arena do Boss, vantagem de formação (+3%, `FORMATION_EDGE`) e nível relativo entre os times (ver [02 §2.3](02-motor-e-ia.md#23-status-em-campo)). O duelo Chute × Save usa o status sem o `levelMult` absoluto, para o goleiro continuar importando.
- A função de cada IV na partida (passe de gênio, curva, gasto de energia etc.) está em `C.IVX` e descrita em 02.

## 3.9 Nível e XP

- Jogador até Nv 1000 (`PLAYER_MAX_LEVEL`), XP para o próximo: `floor(10 + 4 × nível)` (`C.playerXpToNext`). Conta até Nv 100 (`ACCOUNT_MAX_LEVEL`), XP para o próximo: `floor(60 + 40 × nível)` (`C.accountXpToNext`). O XP e o nível do técnico são os da conta (`state.account`).
- `G.giveXp(xp, lista?)`: soma o XP em cada jogador da lista (padrão: `activePlayers()`, sem os `temp`) e, uma vez, na conta. Subidas de nível voltam em `ups` e viram toasts. Em `endMatch` a lista é a escalação mais os reservas que entraram (`match.played`).
- Quem dá XP: partida normal (não treino), Diária (`k: "xp"`, para os titulares e a conta) e baú do Boss (XP dividido entre os 3; a conta recebe a fração uma vez por drop). Wildcard e Expedição dão XP só ao jogador, nunca à conta. Treino não dá nada.
- O nível da conta define os goleiros (`C.GOALKEEPER_TABLE`, `BL.goalkeeperFor`, `G.keeper()`): Sobe nos níveis 25, 50 e 75 (v288).

| Nível da conta | Save | SB |
|---|---|---|
| até 24 | 15 | 15 |
| 25–49 | 20 | 20 |
| 50–74 | 25 | 25 |
| 75–100 | 25 | 31 |

SB define quanto tempo o goleiro segura a bola (`hold = 1,8 − (SB − 15) × 0,08` s, no engine). Os dois goleiros da partida usam a mesma tabela, e o goleiro não é um jogador do elenco. Chance de gol: `BL.goalChance(chute, save) = clamp(50 + 2 × (chute − save), 5, 90)` (ver [02 §2.6](02-motor-e-ia.md#26-chute-e-gol-shoot)).

## 3.10 Inimigos

`BL.makeEnemy(mapIdx, stage, excluirIds, escolta)`; `G.startMatch` chama `size` vezes para o time (o primeiro é o "líder", `G.enemy`) e `BENCH_SIZE` (2) vezes para as reservas dele (`G.enemyBench`, só aparecem no card), sempre sem repetir personagem.
- **Fase 10 de cada mapa**: o primeiro inimigo é o Boss, com status, raridade, nature e nível fixos de `C.MAPS[i].boss` (`p.boss = true`, `p.title`). Os outros (modos 2×2 em diante) e as reservas são escoltas normais no nível da fase 10.
- **Demais fases**: personagem aleatório (sem Bosses de mapa), raridade sorteada por `BL.rollRarity(nível)` (v535, Mickey: nível alto puxa raridade melhor; o peso vai de `RARITIES[].weight` no Nv 1 até `C.RARITY_W_TOP` no Nv 1000, em linha reta, usando o nível com a dificuldade somada; Comum 37% e Épico+ 12% no Nv 1, Comum 6% e Épico+ 44% no Nv 1000), chance de Shiny. O nível é sorteado dentro da faixa da fase: cada mapa cobre 100 níveis (`levelMin`–`levelMax`) e cada fase 10 deles (fase n: de `levelMin + (n−1)×10` a `+9`).
- Modo dev "inimigos no nível do seu time" (`state.devEqualLevel`) iguala o nível dos inimigos à média do seu time.
- Nome do time adversário: `TEAM_NAME_A + TEAM_NAME_B` sorteados; no Boss, o `team` do mapa. Cada nome de time tem uma formação preferida fixa (`G.prefTactic`, hash do nome), jogada em 70% das partidas (`ENEMY_PREF_CHANCE`); detalhes em 02.

## 3.11 Roubo de jogador

Fórmula (`BL.stealChance(inimigo, fase, golsSeus)`):

```
base = Boss ? STEAL_BOSS (3) : STEAL_BASE[min(fase, 9) − 1]   // 24, 21, 18, 15, 12, 10, 8, 6, 5
chance% = (base + 0,5 × gols seus) × multiplicador de roubo da raridade do inimigo
```

Exemplos: Comum na 1-1 sem gols = 24%; Lendário na 1-5 com 2 gols = (12 + 1) × 0,15 = 1,95%. A janela "Stealing Chance" (`MODALS.steal`) e o cartão do adversário mostram a chance ao vivo.

Em `G.endMatch`:
- v533 (Mickey): o Contrato Blue Lock (`pr-bluelock`) virou **Master Contract**; não se compra (saiu da Loja de Diamantes, `noShop`) nem se vende; cai só em baú lendário com `C.MASTER_CHEST` (0,2%, em `G.openChest`, aviso no canto) e, depois, como prêmio do modo história (a fazer).
- v527: Contrato Blue Lock (`sure: true`) põe a chance em 100%; itens do treinador Olheiro (`scout`) somam pontos na chance com Proposta ou contrato equipado.
- v526 (Mickey, "igual Pokébola"): **só tenta roubar com 1 Proposta ou contrato equipado** (`state.stealArm`, `G.stealArmed()`, `G.armSteal(id)` na Mochila). Proposta e contrato dividem o mesmo espaço (o `ctArm` da v525 foi juntado nele). Fica equipado entre partidas e gasta 1 a cada vitória que tenta o roubo, roubando ou não; ao acabar, `G.stealOut` limpa o espaço e avisa no log. Sem nada equipado, a vitória não tem roubo e a chance aparece como "Sem Proposta" no cartão do adversário. Conta nova e saves antigos ganham uma vez `C.STEAL_GIFT` (5 Propostas Básicas já equipadas, `G.stealGift`, marca `state.stealGift`).
- Só rouba vencendo (`STEAL_ON_LOSS = 0`) e só entre os jogadores em campo do adversário (as reservas dele não são roubáveis).
- Roleta (v128, Mickey): ao vencer, `Math.random()` escolhe UM adversário (`res.target`), e só ele tem o sorteio de roubo. Na tela, `stealRoulette` (ui.js, ~1,5 s) percorre os cards do Adversário e para no alvo: verde e cresce se roubou, vermelho se falhou. No máximo 1 roubo por partida. A próxima partida começa 3,4 s depois da vitória (2,6 s depois da derrota).
- O roubado é recriado com `makePlayer(charId, { rarity, shiny, level: 1 })`: mesma raridade e brilho, mas Nv 1, status novos dentro da raridade e nature nova. Entra no fim do elenco e aparece no pop-up "ROUBADO!" (`#stealPop`).
- Conta em `progress.runSteals` (zera ao fim do mapa/fase 10 e ao trocar de mapa) e no Analyser (`steals`). Ter 2, 3 ou 4 jogadores no elenco libera o 2×2, 3×3 ou 4×4 (`G.mapUnlocked`); `progress.unlocked2x2` é uma marca antiga que só é gravada.

## 3.12 Elenco, escalação e reservas

- `state.roster` é o elenco inteiro; `state.active` guarda a ordem da escalação (até 4, `TRAINING_MAX`). `G.activePlayers()` devolve o time em campo: no treino quem você escalou (1 a 4, sem completar); nas partidas os escalados até o tamanho do modo (`map.size`), completando com o resto do elenco; no modo dev completa com jogadores de teste.
- Vagas: `G.lineupLimit()` (4 no treino, `map.size` no resto). `G.addToLineup(uid)` entra se houver vaga ou devolve `{ needSwap: true }` (a tela pergunta quem sai); `G.swapLineup(in, out)`; `G.removeFromLineup(uid)` não deixa esvaziar. `applyLineup` só vale na próxima partida, exceto no treino, que reinicia na hora.
- Reservas: `state.bench` (até `BENCH_SIZE` 2 jogadores, fora da escalação), `G.bench/setBench/benchFree`. Só entram no Vestiário do intervalo (`G.subIn`), e quem entra também ganha o XP da partida.
- **Ausentes**: `G.isAway(uid)` é verdadeiro para quem está em Expedição (`expAway`) ou na equipe do Boss (`bossAway`). Ausente sai da escalação e das reservas, não completa o time em `activePlayers`, não treina no Wildcard (`wcTick` o remove), não entra no treino em dois times (`trainPool`) e não conta para liberar mapas. `addToLineup` e `swapLineup` recusam ausentes.
