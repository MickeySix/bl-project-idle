# 2. Motor da partida e IA
v501 (Mickey): `lastMan` pesa o Ala Of (`COVER.alaOf`) e favorece o Ala Def (`COVER.alaDef`); `C.OF_DEF` no `thinkField` limita a profundidade do Ala Of defendendo (não abaixo do Ala Def + gap) e faz o Ala Def à frente da bola voltar correndo.

v500 (Mickey): `posIv(e, k)` multiplica o IV em `iv()` e `q()` pela tabela `C.POS_IV` da posição; `C.PIVO_DRIB` no `decide` do Pivô com `dribSlow`; blade desenhado mais alto e com aura branca (`REPERT.blade.vis`, `ball.shot.blade` no voleio).

v499 (Mickey): fogueteiro só para companheiro à frente ou ao lado (para trás com chance `fog.back`); `selfBack(e)`: quando o Pivô escolhe chutar, com chance `HAXBALL.selfBack.p` bate na parede do fundo para a bola voltar para ele (`pass.sbb`) e chuta de primeira na recepção (via `e.hax`/`repRecv`); `C.LATERAL`: Ala Of conduzindo no ataque mira a própria ala (`POS_AI.wingY`).

v498 (Mickey: blade pela ala): o Ala Of só faz o blade dentro de `REPERT.blade.wing` (a menos de `x` px da linha de fundo e `y` px fora do meio); `decide` chama `repStep(e, true)` (só blade) antes de `playStep`; `bladeSeek(e)` (blade sobrando, aberto) multiplica a condução na ala (`seek.carry`) e reduz o corte para dentro (`seek.cut`). ~4,7 blades/partida, 80/20.

v497 (Mickey: blade): `repStep` com `REPERT.blade`: Ala Of (`pOf`, alvo o Pivô a `pass` px em `pivoEff`) ou Pivô (`pPivo`, em `shotEff`) levanta a bola para si (`pass.blade = { kind, to }`); ao dominar, `e.blade` e `repRecv` fazem o passe aéreo (`pass.bladeTo`, quem recebe liga `e.bRecv` e chuta na hora até `win` s) ou o chute de voleio (`e.volley`).

v496: `haxAim` devolve `L1` (até a parede) e `L2` (depois do quique) e aceita bater na boca do gol (por cima); `haxKick` usa força `(arrive + 1,05 × L2) / k + 1,05 × L1` (k = `kSide` ou `kEnd`; no fundo `back.arrive`) e desiste acima de `maxL`/`maxSp` (lançamento `launchL`/`launchSp`, backboard `back.maxSp`). Em `moveBall`, a linha de fundo fora da boca devolve `vx × kEnd`; com `pass.hax === "end"` a boca também quica. No `decide`, passe backboard quando quem tem a bola e o aliado estão a menos de `back.x` da linha de fundo deles.

v495 (Mickey: fogueteiro): `repStep` com `REPERT.fog` (condições em `from`, `near`, `mateDep`, `mateEff`; sorteio `pFirst` até `firstT` s depois de receber, senão `p`, um a cada `rollGap` s por time, até `max`) levanta a bola (`lob`, `speed`, erro `err − errIv × Passe`) e marca `pass.fog`. Ao receber `pass.fog` (ou `pass.launch`), `e.fog`/`e.hax` ligam, `think` = 0 e `duelCd` ≥ 0,25. `repRecv(e)`, chamado antes de `playStep` no `decide`, chuta na hora (até `win` s); o chute do fogueteiro (`e.fogShot`) ganha `+add` e o bloqueio do marcador perto × `block`.

v494 (Mickey: dado no duelo): com `C.DICE`, `duelOdds` calcula a chance base com `d20Win(atk − def)` (d20 contra d20, empate do marcador; `atk` = `interp(DICE.drib, iv Drible)` + `vel` × Vel/31 + `lvl` × log2(levelMult dele / do marcador) + `first` × q² no drible de primeira; `def` = `interp(DICE.def, iv Defesa)` + `fis` × Fís/31) e multiplica as chances por (modificadores do portador / do marcador)^4, sem os status (estilo, `defSig`, sem atacantes). `duel` limita entre `DICE.min` e `DICE.max`. Drible ganho liga `e.dribSlow` (× `DRIB_SLOW` na corrida, sem o ×1,25 do `burst`) até ele perder a bola. `runSpeed` usa `interp(RUN_IV, Vel)` no lugar de 2 × Vel. Bloqueio: `BLOCK.near`/`reach` no marcador perto de quem chuta, `BLOCK.path`/`reach` na perna esticada no caminho.

v493 (Mickey: alas atacando): o inimigo recebe `myShapes[1].com` = `C.POS_SHAPES.com`. Em `decide`, `C.WING_PLAY` multiplica os passes pelo passador e recebedor (Fixo→Pivô `toPivo`, Ala Def→Pivô `adToPivo`, Ala Of→Pivô `ofToPivo`, qualquer um→Ala Of `toOf`, Fixo→Ala Def `fixoToAd`; não vale para lançamento). Em `alaDefSpot`, com a bola nossa, o Ala Def ataca também quando `coverOk`: o Fixo está `ALA_DEF.coverGap` px atrás da bola e no máximo 1 adversário está mais fundo que o Fixo (+40 px).

v492: o peso da opção "wall" (haxball de drible) e do passe haxball é × `interp(HAXBALL.wallK, distância à parede do lado)`; na zona do backboard (`back.x`, `back.y`) × `back.w`.

v491 (Mickey: haxball e livre na frente): `haxAim(e, tx, ty, wall)` acha o ponto espelhado para a bola, batendo na parede `top`/`bot` (y × 1/`kSide`) ou `end` (fundo deles, x × 1/`kEnd`, recusa se bater na boca do gol ± `mouth`), cair em (tx, ty); `haxKick` chuta nesse ponto com velocidade `(arrive + 1,05 × caminho) / k` (sem o limite de velocidade de passe), erro `err − errIv × Passe` (mais `passErrK`/`passLongErr`), marca `pass.hax` ("side"/"end") e `pass.spot`; `haxFx` mostra HAXBALL!/BACKBOARD! no primeiro quique. `wallPass` usa o haxball (ele mesmo pega `self.reach` px à frente; com `back.x`/`back.y` perto da linha de fundo deles, backboard para `back.spot` px da linha, ao lado da trave). Em `decide`, companheiro a `pass.min`–`pass.max` px com a linha direta fechada e as duas pernas da tabela livres vira opção `{pass, hax}` com peso `pass.w × (0,4 + Passe/31)`. `REPERT.hax` (lançamento) usa `haxKick` com `lob` pela parede do lado do recebedor e marca `pass.launch` (quem domina chuta na hora com +`add`). `FREE_RUN`: livre na frente (nenhum adversário à frente a menos de `lane` px do caminho ao gol nem a `near` px), passado `from` do campo e a menos de `dist` px do gol: passe/recuo/parede × `pass` (exceto passe `ahead` px para frente), conduzir × `carry`, reto para o gol.

v490 (Mickey: menos gols, desarme forte, lançamento haxball): no chute, depois de `shotDist` e `SHOT_NEAR`, a chance é × `C.GOAL_K`; em `duelOdds`, a força do marcador é × `C.DUEL_DEF`. `repStep`: `REPERT.hax`, jogador no próprio campo (até `from`) sem adversário a `free` px, no máximo `max` por time e um sorteio (`p`) a cada `rollGap` s por time, lança por cima (`lob`) para `spotX` px da linha do gol, y puxado para o mais adiantado (`mate`), com erro `err − errIv × Passe`; o passe leva `pass.hax`. Quem domina (`e.hax`) chuta na hora no próximo `repStep` (até `win` s), e esse chute (`e.haxShot`) ganha `+add` pontos, até `GOAL_MAX`.

v488 (Mickey: Drible e Passe pelo IV): em `duelOdds`, a força de quem dribla é × `lerpQ(IVX.dribPow, q drible)`. Em `duel`, a chance final é × `dribChainK(c)`: `dribChainN(c)` conta os dribles seguidos (`c.dribN`, zera se passaram mais de `dribChainT` s desde o último ou se ele recebeu/recuperou a bola depois dele) e escolhe o fator em `IVX.dribChain`; o drible no carrinho do 1×1 também conta. Em `kickTo`, o erro de mira do passe é × `lerpQ(IVX.passErrK, q passe)` e, em lançamento (`lob` ou mais de `passLongD` px), × `lerpQ(IVX.passLongErr, q passe)`.

v487 (Mickey: Ala Def como segundo Fixo): `alaFixo(e)` em `thinkField`, logo depois de `fixoDuel`, só para o `alaDef` e fora de press/close/chase/slide/last. Bola deles até `ALA_FIXO.zone` do nosso campo; o Fixo conta como presente se não está mais que `fixoBehind` px atrás do mais adiantado deles. O homem do Ala Def é o mais adiantado deles que não é o do Fixo (o portador se o Fixo está em `fixoDuel`, senão o mais adiantado); se o Ala Def está mais que `behind` px atrás dele, desiste. Fica `gap` px à frente dele na direção do nosso gol, y puxado `k` para o centro e afastado no mínimo `sep` px do y do Fixo; se o homem é o portador, encosta como no `fixoDuel`. Modo `alaFixo`, ×`sprint`, fora do anti-amontoado, `SWAY` e `myShapes`.

v485 (Mickey: recuo e Fixo que não marca): em `decide`, antes do sorteio, se a soma dos pesos de passe para trás (opção `back` ou passe comum para o goleiro ou para quem está 40 px atrás) passa de `C.BACK_MAX` do total, ela é reduzida para exatamente `BACK_MAX`. `fixoDuel(e)` no fim de `thinkField` (depois de `lastMan`): portador deles (não o goleiro) a menos de `FIXO.duel.zone` do campo a partir do nosso gol, com o Fixo não mais que `behind` px atrás dele, e sendo o mais adiantado deles ou a até `r` px do Fixo: o Fixo vai para a reta portador→centro do gol, a `hold` px se o portador está a mais de `commit` px do gol, senão a `gap − gapIv × Defesa` px (encosta e o contato vira duelo); modo `fixoDuel`, ×`sprint`, fora do anti-amontoado, do `SWAY` e do `myShapes`. `lastMan` com o Fixo em `fixoDuel` usa `COVER.deep`. `SHOT_MARK` × (`iv[0]` + `iv[1]` × Defesa).

v484 (Mickey: chute livre e de longe demais): em `shoot`, `C.SHOT_MARK` troca o `GOAL_PRESSURE_PENALTY`: adversário de linha entre o chutador e o gol (projeção > 0, a até `lane` px da linha do chute) e a menos de `r` px tira `base + front × (1 − dist/r)` pontos; senão, a menos de `near` px tira `side` (vale o maior). Depois do `shotDist`, a chance × `interp(SHOT_NEAR, distância ao centro do gol)`, limitada a `GOAL_MAX`. `shotEff`: perto demais da zona multiplica por `SHOT_ZONE.inK` (0 = não piora). `lastMan`: se o atacante mais adiantado é o próprio portador, o ponto do último homem fica na reta portador→centro do gol, a `min(COVER.lane, 45% da distância)` dele. Zona de chute `x 100, rx 55, ry 120`; `finEff`, `dribShot.eff`, `wingEff`, `lift.fin` 170, `oneEff` 168.

v483 (Mickey: o inimigo deixava o Pivô/Ala sair sozinho na cara do goleiro): `lastMan(e)` no fim de `thinkField` (antes de `myShapes`), escolhido 1 vez por quadro por time em `this.lastMen[t]`: com a bola deles (ou passe limpo deles no ar, ou bola solta depois da posse deles) até `COVER.far` do campo, um jogador fora de press/close/double/slide (e fora de chase, exceto com passe limpo deles no ar) vai para `cushion` px pelo lado do gol do atacante deles mais adiantado (y puxado `k` para o centro), modo `last`, ×`sprint`. Custo da escolha = distância ao ponto, Pivô ×3, −`fixo` px para o Fixo, −`keep` px para quem já era. No bote, se outro (não o Pivô) chega até `fixoYield` px depois do Fixo, ele vai no lugar do Fixo. No ramo de bola solta, modos de bote velhos (press/close/double/track/sweep/box) voltam a `hold` (antes travavam `fixoSpot`). `FIXO.mark` 55, `mark2` 80, `zoneGap` 50. Medido: saídas na cara do goleiro (portador a < 330 px sem ninguém no corredor) 14,2 → 6,6 por partida; gols 5,0 → 4,1.

v474 (Mickey, 8 clipes do Rematch: "essência das marcações e das jogadas"): `C.REPERT`. **Marcação**: o pressionador longe do portador (> 90 px) vem em ângulo, desviando `shadow` da linha portador→gol na direção do adversário mais perto do portador (até `shadowR` px e só se ele não está atrás, |desvio| < 90°), fechando o passe mais provável. **2×1** (`hold`): pressionador que é o último homem (ninguém do time mais perto do gol que o portador), com outro atacante a até `mate` px e nenhum companheiro a `help` px do portador, segura a `gap` px pelo lado do gol, puxado `lean` para o outro atacante, até `t` s (`e.holdT`/`e.holdOf`); sem carrinho enquanto segura. **Ataque**: `repStep(e)` logo depois de `pivoStep` em `decide` (`this.rplays[t]`, só 4×4 com posições, cada lance até `max` por time na partida, `p` por oportunidade a cada `rollGap` s): **levantada** (`lift`: marcador a até `mark` px na frente, além do meio e com `shotEff` até `eff`: lob para si mesmo `dist` px adiante, corre (`runTo` com `pass.spot`) e, se dominar até 1,6 s e `shotEff` ≤ `fin`, finaliza de voleio com `e.volley`); **lançamento** (`longBall`: defensor nos primeiros `to` do campo, livre `free` px, linha deles abaixo de `high`, Ala Of/Pivô na linha (`line`): lob `ahead` px atrás do último defensor, até `reach` px). **Tabela em cadeia** (`chain`): `kickTo` grava `pass.held` (quanto quem tocou segurou a bola); ao receber, `this.chain[t].n` conta toques de primeira seguidos (< `held` s, intervalo < `gap`); além de `from` do campo e com n < `max`, `e.chainGo` sorteia `p` (ou `keep` se já vinha de primeira). Com `chainGo`, no primeiro `decide` passes para quem está livre (`free`) ao lado ou à frente ×`w`, conduzir ×0,5, `CARRY_FREE` não segura, e quem tocou dispara `run` px (`ggT`/`ggUntil` = `t`). Medido: ~0,5 levantada e ~1,1 lançamento por partida; perfil de chutes igual ao v472 (Pivô 80%, Ala Of 17%). Blitz `sigWin` 1,19, Muralha 1,12: 71/69/69.

v472 (Mickey, partida inteira do Rematch na visão do Ala Def): `C.FEEL` em `decide`: roubou a bola (até `counterT` s de `recoverT`) → passe para quem está `counterAhead` px à frente ×`counter`; Ala Of/Ala Def com `shotEff` até `wingEff` → chute ×`wingShot`; Ala Def livre (`adFree`) além do meio conduz ×`adCarry`; na condução, ala aberta (> `cutY` px do centro, além de `cutFrom`·W) decide 1 vez por posse (`cutIn`) se corta para dentro em vez de ir à linha de fundo. `SHOT_ZONE.ry` 70 → 100 (chute cruzado do lado da área). `POS_AI` assist 1,0, cross 1,6, pivoToOf 4,5. Medido: Pivô 86% → 79% dos chutes, Ala Of 11% → 18%, Ala Def 3% → 4%; chutes de ângulo 2% → 7%. Toque `markWin` 1,12, Muralha `sigWin` 1,16.

v471 (Mickey, mais vídeos do Pivô, "repertório e como se mexer na teoria"): `pivoDiag(e)`: com a nossa bola além de `diag.from`·W, o Pivô de vez em quando (chance `diag.p` a cada `rollGap` s, pausa `cd` s) corta em diagonal por trás do marcador para o outro lado da área (modo `diag`, ×`sprint`, ignorado por myShapes/SWAY/espaçamento). Lance **diagonal** em `pivoStep`: quem tem a bola livre acha o Pivô na frente da corrida (`lead` px) e ele finaliza de primeira no chão (`P.vol = false`). `dribShot`: driblou e está a até `eff` da zona → chute ×`w`. Blitz `sigWin` 1,22.

v470 (Mickey, vídeos na visão do Pivô): `this.pplays[t]` + `pivoStep(e)` logo depois de `playStep` em `decide`, com 3 lances que saem sozinhos quando o lance está montado, cada um até `PLAYS.pivo.max` vez por time na partida e só `pick[lance]` das oportunidades (1 decisão a cada `rollGap` s): **primeiroPau** (bola aberta a menos de `cross.x` px do gol, Pivô perto: cruzamento alto no primeiro pau e finalização de primeira), **parede** (Pivô de costas com marcador colado entre ele e o gol toca de primeira para quem chega, gira para a zona de chute e recebe a devolução), **costas** (bola livre no meio, Pivô na linha do último defensor, espaço atrás: passe por cima com `pass.spot`). v591 (Mickey, clipes): mais 3 lances no `pivoStep`: **pequenaArea** (`pa`: Ala Of a menos de `x` px do gol e aberto, cruza no centro da pequena área, rasteiro ou alto, Pivô corre e finaliza de primeira), **backFinta** (`finta`: Ala Of/Pivô perto da linha de fundo com marcador na frente bate o back na parede do fundo para ele mesmo; marcador perde 0,15 s, o goleiro vai para o primeiro pau por `fool` s e o chute de primeira ganha +`add`), **saida** (`saida`: na saída de bola quem dá a saída recua para o mais recuado, o Ala Of dispara pela ala e recebe o lançamento alto em `dep` do campo; armada em `kickoff` por `P.ko`). Medido: pequenaArea ~0,3, backFinta ~0,4, saída ~0,55 por partida (somando os dois times). A finalização de primeira (`st` "fin", até `finEff`) marca `e.volley`: chance × `volleyMul` e o sprite pula e gira (voleio). Medido: ~0,35 a 0,4 de cada por time por partida; voleios convertem ~45%.

v466: `this.plays[t]` (sorteado no construtor) + `playStep(e)` no começo de `decide`: estados lanc → tabela → fim; expira em `until` ou se o time perde a bola; o "go" do tabelador usa `e.ggUntil` além de `GIVE_GO_T`.
v465: `C.REMATCH`: anti-amontoado de `thinkField` usa `space`/`push`; em `decide`, `recvT` recente (< oneT) e `shotEff` ≤ oneEff → chute ×oneTouch e o `CARRY_FREE` não segura.
v464: fim de `thinkField`: `C.SWAY` soma um deslocamento aleatório (troca a cada 0,9–1,8 s) ao alvo de quem está sem a bola fora de press/close/chase/runTo/slide; a velocidade vai até o alvo com `min(sp, dist × arrive)` e é suavizada por `1 − e^(−dt·acc)` (só sem a bola). `oppPassAt` devolve a posição de `b.pass.to`.
v463: `decide` aplica `C.CARRY_FREE` antes do sorteio: com `heldT` abaixo do tempo (min, Ala Of ofMin, com variação por `e.seed`) e ninguém a menos de `press`, carry ×carry, wall ×wall, passes e recuo ×pass; passes para o Ala Of ×toOf. `shotEff`: dx = além da zona + 0,4 × aquém dela.
v459: `oppPassAt(e)`: com passe limpo do adversário no ar (sem `bad`, sem chute), quem não é o mais perto da bola entra no ramo "bola deles" com `c` virtual `{x, y, virt}` no ponto da bola (sem carrinho nele); `fixoSpot`/`alaDefSpot` também usam essa posse virtual, e com passe nosso a referência é a bola, não o recebedor.
v600 (Mickey): **combos do 1-1-3** (`C.COMBO`, `this.combo[t]`): `comboStart` (no `keeperCatch`, se `PLAY_STYLE[atk].combo`) escolhe o combo e espelha o lado; `thinkKeeper` segura até todos estarem a `near` px do `setup` (ou `wait` s) e chama `comboStep(g)`; `decide` chama `comboStep(e)` primeiro (dono errado = acaba); `comboSpotFor` leva cada um para o ponto do próximo passo em que recebe (modo `combo`); o combo acaba quando o adversário tem a bola, a bola fica solta ou passa `stepT` s sem passo. Recuo: `reset` (roubo no próprio campo, `recoverT`). v602: o goleiro sai quando o Fixo chega no `setup`; quem recebe passe `combo` joga de primeira (`think` 0); bola solta até 1,2 s depois do toque (`K.kickT`) não cancela; passo `fog` limitado a `fogR` px, com texto FOGUETEIRO! e voleio. Jogadas: `og`, `ogBack`, `ogParede`, `dfly`, `quina`, `parede`, `backboard`, `roda`, `fixoSobe`. v603: goleiro com 1 posse (`C.GK_POSS`, `gkLock`/`gkTrack`, `g.possT`, 3 s no máximo, circulozinho na cabeça); `PLAY_STYLE` ganhou `pass`, `passErr`, `hax`, `gkBack`, `gkSpend`, `shuffle` (+`rot`, `shufSlot`) e `haxShort` (núcleo escondido do bola no pé).

v605: o time das plays recua para o goleiro em quase toda recuperação até 80% do campo (`PLAY_STYLE.set.reset` 1, `GK_POSS.reset.from` 0.8); longe do gol (> `passR`) conduz para trás até `passR` e só então toca, mesmo pressionado. Goleiro segura no mínimo `GK_POSS.minHold` 2 s. Todos os setups abrem o Fixo na lateral. `COMBO.p` 0.97, `counter` 0.8.
v606: no recuo, Ala Of/Pivô longe do gol tocam para Ala Def/Fixo livre atrás (`GK_POSS.reset.back` behind 60, open 60), que herda o `resetRun`. `C.SWAY` vale marcando (×`mark`) e no ponto do combo (×`combo`); ao chegar a menos de `near` px do ponto, sorteia outro.
v607: marcações do Mickey em `C.ZONES` (fração do campo, lado 1/3 espelhado pelo `flip`). Passo do combo `[quem, ação|[ações], para, ponto|nome|[nomes], parede?]`: `comboStart` sorteia `K.kd`/`K.sp`; `comboAt` dá o ponto final (afastado do marcador por `comboFree`, fogueteiro preso a `fogR` de quem levanta). Back sem parede marcada usa a mais perto; longe da parede e sem marcador a `backPress` px, conduz antes. Fogueteiro com `pass.air` (velocidade para cair em `fogAir` s, altura `fogH`).
v608: zonas 1/3 relativas ao lado da bola (`comboFrac` espelha se o passo anterior está em y > 0,5). `comboTo`/`comboFrom` (destino sorteado, `"*"`). Lançamento do combo `pass.air` até `airT` (cai em `longAir`), espera `COMBO.ready`. `PLAY_STYLE.*.boost` (`e.spdB` em `runSpeed`), `tri` + `C.TRI` (passador corre em diagonal, terceiro abre o triângulo; `e.triOn` sorteado na recepção), `comboK` no `comboStart`. `C.BOX_COVER` em `thinkField`.
v618: ninguém parado na play: esperando no ponto, `SWAY.combo` 1.8 e troca de ponto ao chegar; quem vai lançar e espera o `ready` conduz de lado (`COMBO.holdR`/`holdT`) em vez de `hold`; `COMBO.wait` 2.8 s.
v619: `PLAY_STYLE.set.fixoPivo` (peso do passe Fixo → Pivô); bola no pé `triRot`: a cada passe completo `triTurn` gira `triPerm` (Def → Pivô → Ala Of → Def; com `fixoAtk` o Fixo entra no giro) e o puxão de posição usa `triPerm` no lugar do `shufSlot`; `haxSelf` = opção do `decide` perto da parede lateral com marcador à frente (haxball para ele mesmo).
v636 (Mickey): **triangulação da Bola no pé** (`C.TRI3`, ligada por `PLAY_STYLE.pe.tri3`). Ala Def, Ala Of e Pivô trocam de 5 a 7 passes seguidos (`passes`) num triângulo de lado `side` px que anda `adv` px para o gol e gira `spin` rad a cada passe. `tri3Step` (chamado no `decide` antes das jogadas do Pivô) começa quando um dos três tem a bola entre `from` e `to` do campo, sem combo nem jogada ensaiada em andamento e com no máximo um marcador a `pressR` px; a primeira sai entre `first` s e as outras a cada `gap` s (até `max` por partida), o que dá ~3 completas por jogo. O triângulo nasce com o portador numa ponta (`tri3V` dá a ponta de cada um, `tri3C` limita o centro entre `minX` e `maxX` do campo e `yMin`); quem está sem a bola corre para a sua ponta (`mode "tri3"`, ×`sprint`), quem tem a bola espera `hold` a `holdMax` s o companheiro chegar e toca para o próximo da roda (ou para o outro se a linha estiver fechada; as duas fechadas = toque por cima). O passe vai `lead` do caminho entre quem recebe e a ponta nova, passa pela marcação com chance `safe`, só vira bola solta quase parado e o Fixo não pega; quem recebe tem `recv` s de respiro. Fechou os passes: chuta com +`shotAdd` se estiver a menos de `shotR` px do gol, senão segue o jogo. Termina se perder a bola, a bola for para outro jogador, alguém dos três cair ou passar de `t` s. Na tela: "TRIANGULAÇÃO!" e o número de cada passe.
v635 (Mickey, vídeos de jogadas ensaiadas e rodízios do futsal): **ataque × defesa forte/fraco/neutro**. Cada preset de ataque tem `beats` (a formação que ele vence) e `beatenBy` (a que o countera): Bola no pé vence ofensiva e perde para defensiva, Plays setadas vence defensiva e perde para equilibrada, Equilíbrio vence equilibrada e perde para ofensiva; contra a terceira é neutro. `G.atkEdgeN(mine, theirs)` soma as vantagens de cada time (minha defesa countera o ataque deles + meu ataque vence a defesa deles); quem soma mais leva `FORMATION_EDGE` em todos os status e, com saldo 2, `FORMATION_EDGE × FORMATION_EDGE2`; `atkEdge` = `[n0 > n1, n1 > n0]` liga as marcas do estilo (`edge[t]`). **Equilíbrio no quadrado** (`PLAY_STYLE.rot.futsal`, `shape: "q"`): com a bola, `fsSpot` monta o 2x2 (vagas 0 atrás-cima, 1 atrás-baixo, 2 frente-baixo, 3 frente-cima; `q.back/backMin/backMax/front/frontMin/wide/follow`) que anda com a bola, e `fsTurn` gira a cada passe com `vert` (troca vertical no lado da bola), `diag` (quem passa corta na diagonal) e `redondo` (os 4 giram uma vaga); sem a bola marca por zona igual à Bola no pé (`zone: "pe"`, resolvido por `fsZ`). **Jogadas ensaiadas novas** no `pivoStep` (chance em `PLAYS.pivo.pick`, mesmo limite `max × setMax` por partida): **Cortina** (`PLAYS.pivo.cortina`: quem tem a bola no próprio campo, pressionado, inverte para o companheiro longe; um companheiro faz o bloqueio no marcador, que fica `stun` s parado; o recebedor toca de primeira no Pivô e corre para a entrada da área; o Pivô devolve pelo alto; estados `cort` → `parede` → `fin`), **Jogada 01 da saída de centro** (`PLAYS.pivo.centro`, no `P.ko`: toque para trás no Ala Def, lançamento longo para o Ala Of que correu para a ala oposta e cruzamento rasteiro/alto para o Pivô no segundo pau; estados `ce1` → `cruz` → `fin`; cruzamento em `PLAYS.pivo.cruz`) e **Saída 3x1 do goleiro** (`gkPlay` no `thinkKeeper`, `PLAYS.pivo.goleiro`: o goleiro lança no alto o ala da ala oposta sem companheiro perto e sem marcador em `open`, que conduz e cruza para o Pivô; estado `cruz`). Passes de ensaiada levam `pass.ens` (chance `PLAYS.pivo.ens` de atravessar a marcação; quem recebe ganha `duelCd = ensSafe`) e o chute que fecha uma ensaiada nova (`P.nw`) leva +`ensAdd` (`e.ensShot`). `decide` chama o `pivoStep` antes do `repRecv` para quem está numa ensaiada nova. O passe atravessando do Toque de bola não vale mais nos passes de combo das Plays setadas (`!p.combo`), que deixavam o 1-2-2 com Plays muito acima dos outros. `STYLES.*.sigBase` troca o `STYLE_SIG.base` por estilo (Blitz 1,7). Equilíbrio do pedra-papel-tesoura medido nos 36 pares formação × ataque em [08](08-config-e-balanceamento.md).
v634 (Mickey): a marcação por zona do Bola no pé (`fsZone`) segue o Sem a bola da formação (`markOf`): 1-2-2 (`22`) volta ao quadrado 2-2 (`SQUARE`); 1-3-1 (`31d`) faz o 3-1 defensivo do futsal (`futsal.zone.d31`: Fixo e alas numa linha de 3 que bascula para o lado da bola, ala do lado sobe na bola quando ela está na ala, ala oposto e Fixo fecham o meio, Pivô sozinho na frente cortando o passe); 1-1-3 (`31o`) segue no losango/triângulo da v633. Referências: livro de futsal do Mickey e o Manual de Treinamento de Futsal da FIFA (blocos, ala oposto, cortar o passe ao pivô).
v633 (Mickey, livro "Fundamentos técnicos e táticos do futsal"): `PLAY_STYLE.pe.futsal`. Com a bola, as vagas viram um losango do 3x1 que anda com a bola (`fsSpot`: 0 Fixo atrás da bola, 1/2 alas na lateral, com o ala do lado da bola dando profundidade e o oposto fechando o meio, 3 Pivô na frente), puxado por `pull`. A cada passe completo `fsTurn` aplica o rodízio da posse em `triPerm`: oito (Fixo e alas trocam), oito invertido (alas e Pivô), diagonal do passe (quem passa troca com quem recebe), diagonal oposta (quem passa vai para a vaga oposta à de quem recebeu), roda (os 4 giram no mesmo sentido) e o triângulo antigo (`triTurn`); o padrão é sorteado por `pats` e muda quando passa `newT` s sem passe. Sem a bola, no lugar do quadrado (`SQUARE`), `fsZone` marca por zona: bola no meio = losango (Pivô na ponta, alas nos lados, Fixo atrás); bola na ala (`zone.wingY`) = triângulo (ala do lado sobe na bola, Pivô e ala oposto fecham o meio, Fixo cobre do lado da bola). Plays setadas e Equilíbrio seguem como estavam.
v632 (Mickey): bola no pé mais passe, haxball e backboard: `PLAY_STYLE.pe` com `think` (multiplica o tempo entre decisões), `passSp` (velocidade do passe comum), `chainFrom`/`chainMax` (passe de primeira desde essa fração do campo e em cadeias maiores que `REPERT.chain.max`), `back` (multiplica a chance e o máximo do `backFinta`, a chance do `selfBack` e o peso do backboard para o aliado) e `backSelf` (peso da opção de backboard para ele mesmo do Pivô e do Ala Of a menos de `HAXBALL.selfBack.maxX` do gol). Passe comum (`act.pass`): mira 50 px (longo 70) na frente do companheiro, mas vai no pé se algum adversário estiver a menos de 50 + `C.PASS_LEAD.opp` desse ponto. Saída de bola: `kickoff` marca `taker.koFirst`; até o primeiro chute dele (no máximo 3 s) as opções `chapeu4`, `vaca4`, `wall` e `haxSelf` ficam com peso 0 (antes o primeiro toque podia ser bola no espaço, no meio dos adversários).
v620: `PLAY_STYLE.*.comboSafe` (chance de um passe do combo não ser cortado nem pego pelo goleiro; reduz o erro do passe do combo; quem recebe ganha `duelCd` = comboSafe × `COMBO.recvSafe`); `PLAY_STYLE.*.streak` (`this.pStreak` conta passes seguidos da posse; a partir de `min` soma `add` pontos por passe no chute, até `max`, e multiplica o peso do chute por `shotW`).
v610: `PLAY_STYLE.*.duelA`/`duelD` somam pontos no d20 do duelo (quem dribla / quem desarma), `shotAdd` soma na chance do chute fora do combo, `shot` multiplica a opção de chutar.

v597 (Mickey): **presets de ataque** (`C.ATK_PRESETS`, opção `atk` do Match, `this.atk[t]`): `ps(t)` lê `C.PLAY_STYLE[pe|set|rot]` (antes pelo estilo da formação). `set` também multiplica o tempo de decisão (`think`); `rot` troca as vagas do Com a bola a cada `rot` s (fase 1 Ala Of↔Pivô, fase 2 Ala Def↔Ala Of). Pedra-papel-tesoura: `edge[t]` = a formação de t tem o tipo `beatenBy` do preset do adversário (`G.atkEdge`); quem tem `edge` ganha `FORMATION_EDGE` e a marca do estilo (`sigWin`/`markWin`). **Zona do gol** (`C.BOX_PLAY`): `boxN` conta passes da posse a menos de `r` px do gol (em `kickTo`); com `maxPass` atingido, quem recebe chuta ou faz `selfBack` (chance `back`); sair além de `reset` px zera. Bancada: `sim597.js` + `rps597.sh` (pares `formação:preset`).

v596 (Mickey, 4×4): `C.PLAY_STYLE[estilo]` via `ps(t)`: `set`/`setMax` multiplicam a chance e o máximo das jogadas do `pivoStep` (Muralha 3/3, Toque 2/2, Blitz 1,3/1); `rep` multiplica o máximo do repertório (blade, fogueteiro, haxball, levantada, lançamento); na Blitz `drib`, `wall`, `trick` e `chain` multiplicam condução, tabela na parede, chapéu/vaca e a chance da tabela em cadeia. Tackle no 4×4 espirra a bola (`C.TACKLE4` em `x1Knock`); `st4()` soma `C.STUN4_ADD` ao stun de quem toma tackle ou drible. `SQUARE` k 0,8, follow 0,7.

v591 (Mickey, clipe do Rematch): **marcação em quadrado** (`C.SQUARE`, 4×4 real, os dois times): com a bola deles, quem não está em bote/cobertura especial (press, chase, fixoDuel, alaFixo, last…) é puxado (`k`) para um canto de um quadrado de `side` px: Pivô e Ala Of nos cantos da frente (`gap` px atrás da bola, entre `minF` e `maxF` do campo), Fixo e Ala Def atrás; o centro segue o y da bola (`follow`); cada dupla divide em cima/embaixo pela posição atual.

v458: `myShapes` vai para os dois times: `{com, sem, mark}`, com `sem`/`mark` do preset da formação (`C.MARK_PRESETS`, inimigo com `com: null`). `markOf(t)`: `fixoPivo` faz o `fixoSpot` marcar o Pivô deles; `pivoX` puxa o Pivô (70%) para essa altura com a bola deles; `pivoR` deixa o Pivô entrar no bote perto dele (também na Muralha); `fixoPress` troca `FIXO.press`; `press` soma marcadores no campo deles.
v455: `opts.myShapes[t] = {com, sem}` (frações do campo por vaga `e.slot`). Em `thinkField`, com `time − hotT > CALM_T`, jogadores sem bola fora dos modos de disputa puxam `SHAPE_PULL` do alvo para a posição da fase. `hotT` é atualizado em `duel`, bola sem dono (exceto passe limpo) e troca de posse.

v454: decisão do Pivô: passe curto ao Ala Of × `POS_AI.pivoToOf`.

v453: com `wingRun(e)` ativo, carry × `wingCarry` (2,5) e chute/passes que não vão para o Pivô × `wingOther` (0,4). `thinkField`: Ala Def em `ala`/`alaRun` com ≤1 companheiro atrás da bola fica até `ALA_DEF.safeMax`·W.

v452: `crossSpot(e)` (Ala Of a menos de `POS_AI.crossX` do gol e mais de `crossY` do centro) → passe para o Pivô × `assist` × `cross` (×2 se a linha estiver marcada). `wingRun(e)`: Ala Of com a bola na ala nos 45% finais conduz pela lateral (y = centro ± `wingY`, peso × `wingCarry`).

v451: em `fixoSpot`/`alaDefSpot`, bola solta (último dono nosso) ou chute nosso com a bola além da metade do campo conta como posse nossa (`ours` / portador fictício na posição da bola). `alaRun`: `scheme[t].adRun` + corredor livre na ala oposta ao Ala Of → avança `runStep` px até `runMax`·W.

v450: `fixoSpot`: `fixoZone` é checado antes; o ramo de marcar o mais avançado vale também na defesa quando a bola está a mais de `arc + near` do gol. `alaDefSpot` com a bola deles (e Fixo em campo): `alaMark2` no 2º adiantado (fora o portador) ou `alaFree` (x = `wait`·W, ala oposta ao Ala Of); o modo `cover` não bloqueia mais o Ala Def.

v449: `shotEff(e)` = 160 + distância até o retângulo `SHOT_ZONE` (centro a `x` px do gol, ±`rx`, ±`ry`) − bônus de IV; `shotDist(e)` e o peso da opção de chute (`SHOT_TRY`) usam esse valor. `zoneOf(t)` dá o centro da zona no ataque de t. Pivô mira x = W − `SHOT_ZONE.x`. `fixoSpot` defesa: Pivô deles a menos de `FIXO.zoneR` da zona → `fixoZone`.

v448: `update` acumula `realDt × speed × GAME_PACE`; `clock += dt / GAME_PACE` (relógio em segundos reais). `kickTo` multiplica a velocidade por `BALL_SCALE`. As bancadas de simulação chamam `step` direto, então nelas o tempo de jogo de cada tempo fica em 51 s.

v447: `fixoSpot` ramo de ataque usa `up()` sem o limite `back` (só `F.min` até o meio); y puxado para `opY` (lado oposto ao Ala Def) por `sideK`; 2×1 → `fixo2x1` a `mark2` px do mais avançado. `alaWait` também no lado oposto ao Ala Of.

v446: `alaDefSpot` modo `ala`: x = max(bola + `ahead`, `ALA_DEF.buildX`·W). `attackSpot` Pivô: antes do corte `from`, vai a max(bola + `pivoAhead`, `pivoBuild`·W) (na troca só no terço final). Medição: o Fixo quase nunca segura a bola mais de 1 s, então o Ala Def ainda chega atrasado em parte dos lances.

v445: `scheme[t].wingGo` (90%) leva o Ala Of a (`POS_AI.wingX`·W, centro ± `wingY`) no modo `alaOfWing` com sprint `wingSprint`; o `side` da posse nova segue o lado em que o Ala Of já está. Pivô y = centro + 8% da bola, x até `pivoMax` 0,83.

v444: em `fixoSpot`/`alaDefSpot`, os modos `watch`/`cover`/`close` só bloqueiam com a bola do adversário (modo velho não prende mais). Fixo usa a lógica de marcar o mais adiantado também quando a bola deles está além de `FIXO.far`·W. `alaMark`: y no lado oposto ao Ala Of, x = max(atacante dele − `markGap`, bola − `opt`).

v443: drible ganho deixa o portador com `duelCd = DRIB_GRACE` (0,3 s); por `DRIB_CLOSE.t` s, perto do nosso gol, `closeHelper` (mais perto, sem presser/stun/Pivô sem `backOk`) fecha entre portador e gol (modo `close`, ignorado por `fixoSpot`/`alaDefSpot`). Peso da opção de chute = `interp(C.SHOT_TRY, dist)` (substitui `SHOT_DIST_AI_MIN`); `interp(P, x)` é a tabela linear usada também por `shotDist`.

v442: chance do chute × `shotDist(e, dist)` (tabela `C.SHOT_DIST`, ~1% do meio; os antigos `GOAL_LONG_RANGE_*` não são mais usados); opção de chute na IA × max(`SHOT_DIST_AI_MIN`, fator). `coverSpot(e, c, presser)`: com a bola deles, defensores (não Fixo, não quem pressiona) cobrem os atacantes deles à frente da bola (`C.MARK`), modo `cover`. Ala Def afastado `POS_AI.sep` do Ala Of. `C.RUN_SCALE` 0,85 em `runSpeed`; `C.SPRITE_SCALE` 0,85 no desenho.

v441: posições do 4×4 nos dois times (`opts.pos4`, vaga 0 Fixo, 1 Ala Def, 2 Ala Of, 3 Pivô). `attackSpot(e)`: Pivô no centro (`pivoAhead`, até `pivoMax`), Ala Of na ala `scheme[t].side`; `scheme[t].swap` (20%) inverte (Pivô abre, Ala Of centraliza, Ala Def no meio). Pivô sem `backOk` (90%) não ajuda nem pressiona perto do nosso gol e nunca recua além de `W*pivoMin`. Decisão: Ala Of passe ao Pivô ×`assist`, Pivô chute ×`pivoShot`. Números em `C.POS_AI`.

v440: Fixo com a nossa bola e o atacante deles mais adiantado a mais de `FIXO.free` px dentro do campo deles sobe para o meio (`fixoUp`). Ala Def com a nossa bola: só ataca (`ala`) se há `ALA_DEF.atkIfBack`+ adversários atrás da bola; senão `alaMark`: `markGap` px atrás do 2º adversário mais adiantado (o 1º é do Fixo), vale também quando ele é atacante (1-1-3).

[← Índice](README.md)

Tudo aqui está em `game/js/engine.js`, na classe `Match` (exportada como `BL.Match`), mais as constantes de `game/js/config.js` (`C`). Quem cria a partida é `G.startMatch()` / `G.startTraining()` em `game.js`. O desenho (campo, sprites, VFX, perspectiva, HUD) fica em [10-desenho-sprites-vfx.md](10-desenho-sprites-vfx.md). Todos os valores numéricos de config estão em [08](08-config-e-balanceamento.md).

Resumo: física simples estilo Haxball em passo fixo de 1/60 s; cada jogador de linha decide sozinho (`thinkField` e `decide`), o goleiro tem IA própria (`thinkKeeper`). O resultado do chute é sorteado na hora de chutar e a bola só "cumpre" o sorteio.

## 2.1 Campo e coordenadas

| Constante | Valor | Significado |
|---|---|---|
| `W × H` | 1079 × 560 | Campo em unidades do motor (batem com as linhas de `img/campo.jpg`, mapeadas por `IMG`, `K` e `VIEW`) |
| `GH` | 129 | Altura da boca do gol (`MOUTH_T`..`MOUTH_B`, centrada em `H/2`) |
| `PR` / `BALL_R` | 17 / 8 | Raio do jogador (goleiro +2) e da bola |
| `STEP` | 1/60 s | Passo fixo da simulação (`update` acumula `realDt` limitado a 0,1 s × `speed`) |

O time 0 (o seu) ataca para a direita (`dir(0) = +1`, `goalX(0) = W`); o time 1 ataca para a esquerda. `ownGoalX(t)` é o gol que o time defende. O goleiro fica 22 px para dentro da linha de fundo.

## 2.2 Criação (`constructor(opts)`)

`opts` vindo de `G.startMatch` (treino em `G.startTraining`):

| Campo | Conteúdo |
|---|---|
| `teams` | `[meusJogadores, inimigos]` (objetos de jogador do save) |
| `roles` | `"atk"`/`"def"` por jogador (`G.rolesFor`: os mais ofensivos pela posição atacam, quantos = `tac.atk`) |
| `mods` | multiplicadores de status por time; `all = 1 + FORMATION_EDGE` (×`FORMATION_EDGE2` com saldo 2) para quem soma mais vantagens no ataque × defesa (`G.formationMods`/`G.atkEdgeN`, só 4×4) |
| `shapes` | posições-base da formação (frações do campo, atacando para a direita; `[x, y]` defensor, `[x, y, "atk"]` atacante). Existe no 4×4 e nas táticas 3×3 com `shape` |
| `kickShapes`, `gkShapes`, `oppGkShapes` | desenhos opcionais para a saída de bola, nosso goleiro com a bola e goleiro deles com a bola. Código pronto, nenhuma formação usa hoje |
| `styles` | `toque` / `blitz` / `muralha` (só 4×4) |
| `edge` | `[bool, bool]`: o time venceu o confronto de formações |
| `gk` | status dos goleiros `{save, sb}` (`BL.goalkeeperFor(nível da conta)`, os dois iguais) |
| `arena` | arena do Boss (`bossBuff`/`userDebuff`, paleta) ou `null` |
| `speed` | multiplicador de tempo (1 em tudo, `GAME_SPEED`/`BOSS_SPEED`) |
| `training` | treino sem adversário (ver 2.14) |
| `scrimmage` | treino em dois times: partida normal, mas sem relógio, sem fim e sem mercy |
| `onEvent` | callback de eventos (ver 2.15) |

Cada jogador vira uma entidade `e` com `team`, `p` (jogador), posição, velocidade, `r`, `role`, `energy` (100), `stun`, `burst`, `duelCd`, `think`, `mode`, `tx/ty` (alvo), `hold` (goleiro) e `rel`. Campos temporários usados pela IA: `heldT` (há quanto tempo conduz), `recoverT` (quando recuperou a bola), `recvT` (quando recebeu passe do próprio time), `dribT` (quando driblou), `wallCd`, `slide`/`slideCd`, `ginga`/`zig`, `ggT/ggx/ggy` (tabela), `lastFrom/lastFromT`, `healT`.

Na criação:

- `e.rel = (levelMult(nível) / média de levelMult do time adversário) ^ 1,5`. É assim que o nível pesa: quem tem nível mais alto que o adversário chuta, passa, dribla e defende melhor. Recalculado em `substitute`. v587: o expoente vem de `C.LEVEL_REL_EXP[tamanho do time]` (1 no 1×1 ao 3×3), padrão 1,5 (4×4).
- `noAtk[t]`: time sem atacantes (táticas "0-2", "0-3"). Esse time não corta passes direito e só ataca no contra-ataque (ver 2.9 e 2.10).
- `duelMode = !training` (ginga, carrinho, chutaço, trave e efeitos em todos os modos, ver 2.13).
- `plan[t] = planFor(t)` (ver 2.11b).
- Muralha: os defensores, menos o mais recuado, recebem `e.wing = true` (podem subir no contra-ataque, `counterMate`).
- Treino: só o goleiro 1 entra, marcado `own` (é o seu goleiro no gol para onde o time chuta).
- A partida começa em `state = "kickoff"` (`stateT` 1 s) com `kickoff(0)`.

Outros campos da partida: `score`, `passes`, `passTry`, `shots`, `steals`, `poss` (posse em segundos; goleiro com a bola conta metade), `half`, `clock`, `golden`, `time`, `restart`, `stoppage`, `paused`, `pauseUsed`, `onSample`.

- v417 · passiva do técnico: `opts.coachFx[t]` (`this.cfx`). `slow` do técnico do time t reduz a corrida do outro time (`runSpeed`); `jitter` soma um desvio aleatório (renovado a cada 0,8 a 1,6 s) ao alvo de quem está sem a bola e não está pressionando. Os bônus de status chegam por `mods` (`G.matchMods`).
## 2.3 Status em campo

```
iv(e, k)  = BL.baseStat(p, k) × fatigue(e) × arenaMult(e) × statMod(e, k) × e.rel
pow(e, k) = iv(e, k) × BL.levelMult(nível)
q(e, k)   = clamp(BL.baseStat(p, k) / 31 × fatigue(e), 0, 1.25)
```

- `BL.baseStat` = (IV + itens) × nature (±10%) × (1 + 0,20 × EV/252). Ver [03](03-jogadores.md).
- `fatigue`: 1 com energia ≥ `ENERGY_LOW` (50); abaixo cai linearmente até `ENERGY_MIN_MULT` 0,45 com energia 0.
- `arenaMult`: no Boss, time 1 × (1 + `bossBuff`) e time 0 × (1 − `userDebuff`).
- `statMod`: `mods[t].all` (vantagem de formação) × `mods[t][k]`.
- `pow` (com o nível absoluto) é usado em duelos, bloqueios e corte de passe. `iv` (sem o nível absoluto, mas com `rel`) é usado em decisões, chute, goleiro-vs-chute e corrida. `q` mede quanto o IV efetivo chega perto de 31 (alimenta `C.IVX`).
- Goleiro: `gkStats.save` e `sb` fixos pela faixa de nível da conta; não cansa, não tem `rel`.

### Corrida (`runSpeed`)

- Goleiro: 250 × 0,85.
- Linha: `min(RUN_MAX = 210, (180 + 2 × iv(velocidade)) × 0,85)`, ×1,25 durante `burst` (logo após driblar), ×(1 − 0,2 × `tired`) cansado (`ENERGY_RUN_MIN` 0,8).
- Condutor da bola corre a `0,7 + 0,01 × iv(drible)` dessa velocidade. Na ginga, ×0,82.
- O nível não entra direto na corrida. Regra fixa do Mickey: legibilidade dos sprites, ninguém corre mais rápido. Não aumentar `RUN_MAX`.

### Energia (`drain`, v226)

Regra do Mickey: toda ação gasta e ficar sem energia tem que punir muito (Água e Gatorade passam a importar). `drain(e, v)` desconta `v × lerpQ(IVX.fisDrain, baseStat(físico)/31)`, ou seja, o Físico decide o gasto: ×1,35 com Físico 0 até ×0,55 com 31. Goleiro não cansa.

| Ação | Gasto (`C`) |
|---|---|
| Andar (v > 40 px/s), por segundo | `ENERGY_DRAIN_WALK` 0,1 |
| Correr (v > 180), por segundo, soma com o andar | `ENERGY_DRAIN_RUN` 0,7 |
| Passe (`kickTo`, goleiro não gasta) | `ENERGY_DRAIN_PASS` 0,4 |
| Drible (os dois da disputa), carrinho, chute (`shoot`), bloqueio | `ENERGY_DRAIN_ACTION` 1,3 |
| Quem dá o bote ou o carrinho (soma à ação) | `ENERGY_DRAIN_TACKLE` 1,8 |
| Bote errado (foi driblado) | `TACKLE_MISS_DRAIN` 1,2 e `TACKLE_MISS_STUN` 0,9 s no chão |

Abaixo de 50, `tired(e) = 1 − energia/50` (0 a 1) piora tudo: status até ×0,45 (`fatigue`, que também reduz `q`), corrida até ×0,8, e `actF` (tempo de decisão e de levantar) até +80% (`ENERGY_SLOW`). Itens: Água +40 e Gatorade +100 (`C.CONSUMABLES`); o Módulo de cura (VIP) usa item abaixo de `HEAL_AUTO_BELOW` 50 (`G.autoHeal`, chamado a cada segundo de jogo por `onSample`). No intervalo `G.halftime` dá `HALFTIME_REST` +15 aos dois times; o VIP com Gatorade automático ligado usa itens no seu time (custa Gold). Por que: a partida 153 mostrou um Nv 106 sozinho perdendo a bola 131 vezes; o Mickey quis IV e stamina mais decisivos. Totais medidos (sim sem itens): energia ~36 a 47 no intervalo e ~12 a 25 no fim.

### Função de cada IV (`IVX`, v226)

`C.IVX` guarda os números no q = 1; pares `[a, b]` vão de a (q 0) até b (q 1) via `lerpQ`. Efeitos fortes usam q² para IV 31 roubado não quebrar nada. `qc`/`qd` abaixo = `min(1, q)`.

- **Passe** (`kickTo`, `decide`, `checkContacts`): passe de gênio (flag `pass.genius`, atravessa a marcação sem corte, aviso "PASSE DE GÊNIO!") com chance `passGenius` 0,4 × q² (q aqui não é limitado a 1); linha fechada vira passe por cima (`lob`) com `passLob` 0,35 × q²; erro de mira × (1 − 0,5 × qc). Passe de parede e de goleiro nunca são de gênio.
- **Chute** (`shoot`, `decide`, `moveBall`): força × (1 + 0,22 qc); alcance de decisão +140 px × qc e a penalidade de longa distância só começa em 230 + 140 qc; curva a partir de qc > 0,45 (`b.curl`, ângulo 0,2 × qc rad, sai aberto e cruza no mesmo alvo); a curva tira até 35% da chance de bloqueio (`shotDodge`).
- **Físico**: gasto de energia (acima).
- **Velocidade** (`actF`): 1,25 (q 0) a 0,78 (q 1) × (1 + 0,8 × tired). Multiplica o intervalo de decisão (`think`), o tempo de levantar do chão (`stun` decai a `dt/actF`), a decisão depois de receber (0,12) ou roubar (0,15) e o ritmo da ginga.
- **Defesa**: corte de passe × 0,75 a 1,3, bloqueio de chute × 0,7 a 1,35 (nos dois bloqueios) e +14 px × qc de alcance do bloqueio em contato.
- **Drible** (`duelOdds`, `duel`, `shoot`, `kickTo`): drible de primeira, `recvT`: até 0,7 s depois de receber passe do próprio time, o ataque do duelo vale × (1 + 0,6 × qd²). Depois de ganhar um drible (`dribT`, 1 s): `think` cai para `0,3 − 0,25 qd²` s (decide quase na hora), +6 × qd² pontos de chance de gol e +0,25 × qd² na chance de passe de gênio.

### Efeitos dos equipamentos (`ifx`, v524)

`m.ifx(e)` soma os efeitos de `C.ITEM_FX` dos itens que o jogador veste (guardado em `e.fx` até trocar o jogador). Valem para qualquer time; quem não veste nada recebe `NOFX`. Onde cada um entra:

| Efeito | Item | Onde |
|---|---|---|
| `loose` | Chuteira Arranque | `looseMine` (tempo até a bola ×0,85) e alcance de domínio da bola solta em `checkContacts` |
| `aim`, `shotPow`, `shotK` | Precisão, Canhão, Sangue Frio | `shoot`: chance ×1,10 / ×1,08 / ×1,15 (teto `GOAL_MAX`); Canhão chuta 20% mais rápido |
| `volley` | Chuteira Voleio | `shoot`: não aplica `PLAYS.pivo.volleyMul` |
| `passErr`, `longPass`, `duo` | Canhão, Maestro, Dupla | `kickTo`: erro do passe ×1,10 / lançamento ×0,85 / entre dois da Dupla ×0,95 |
| `dribK`, `chain`, `shadow`, `tackle`, `capt` | Sangue Frio, Ritmo, Sombra, Teimosa, Capitão | `duel`: chance do drible e do bote; Capitão vale 1 por time (`captK`) |
| `lastLine` | Última Linha | `duel`: energia > 80, o 1º drible sofrido no tempo vira "ÚLTIMA LINHA!" (atacante segura 0,35 s, posse não muda; `e.llHalf`) |
| `thorn` | Espinho | `duel`: quem dribla ele perde 10 de energia |
| `dribStun`, `glue` | Afiada, Gruda | `duel`: tempo no chão de quem foi driblado ×1,10 / ×0,70 |
| `noDribSlow` | Raio | `runSpeed`: sem `DRIB_SLOW` (o resto da IA ainda vê `e.dribSlow`) |
| `block` | Protetora | `shoot` e `checkContacts`: bloqueio ×1,10 |
| `regen`, `drain`, `vet` | Raiz Eterna, Sangue Frio, Veterana | `step` (+0,2/s) e `drain` (×1,2; ×0,85 no 2º tempo) |
| `freePass` | Visão de Jogo | `decide`: peso do passe para o mais livre ×1,05 |
| `rest` | Camisa Reserva | `G.halftime`: +20 de energia no intervalo |

Fora do motor: Caneleira da Base (`BL.baseStat`, Defesa e Físico ×1,2 abaixo do nível 50) e Camisa de Posição (`BL.itemBonus`, +`C.ITEM_POS_BONUS` no status `posK` quando `p.position` é a `pos` da camisa).

### Item de personagem e itens do treinador na partida (v527)

- `cItem(e)` lê `C.CHAR_ITEMS[p.items.personagem]` só se `BL.charItemOk` (dono certo e raridade ≥ `C.CHAR_ITEM_MIN`) e, quando tem `pos`, se `p.position` bate. `cmul(e, k)` entra em `iv()` e `q()`: `mul[k]` e o par Rin + Sae (`duo`/`duoK`, conferido 1 vez por segundo de jogo). Coroa do Barou (`box`) soma no `shoot` quando `shotEff(e) <= 160` (zona ideal); Faixa do Hugo (`toPivo`) corta o erro do passe para o Pivô. Domínio do Nagi também tem `C.ITEM_FX["ci-nagi"].volley`.
- `opts.mgrFx` vira `this.tfx` (só o time 0, do jogador): `pass` corta o erro do passe, `drain` corta o gasto de energia, `tackle` soma no bote do defensor, `shot` multiplica a chance de gol.

## 2.4 Fluxo da partida

Estados (`this.state`): `kickoff` → `play` → `goal` → `kickoff` … `halftime` → `kickoff` … `ended`. (`goldenIntro` ainda existe em `advanceState` e no desenho, mas nada o ativa mais.)

- `update(realDt)`: congelado se `paused`; senão roda `step(STEP)` quantas vezes o acumulador permitir.
- `step(dt)`: fora de `play` só conta `stateT` e chama `advanceState` (e mexe os goleiros em `kickoff`/`goal`). Em `play`: relógio, posse, e para cada entidade `stun`/cooldowns, `thinkKeeper`/`thinkField`; depois `moveBall` e `checkContacts`. `onSample` roda 1 vez por segundo de jogo (cura automática e registro da partida).
- Tempos (v613): cada tempo dura `this.halfSec` = `HALF_SECONDS_NORMAL` 51 s (ritmo `PACE_NORMAL` 1 via `this.pace`; v617 desfez 45 s/1.2); no Boss do mapa, `HALF_SECONDS` 51 s. `minute()` converte para 0 a 90 (45 por tempo, trava em 45' nos acréscimos) ou "GG".
- Durações: abertura 1 s; gol 1,8 s mostrando o gol e depois `kickoff` de 0,7 s; início do 2º tempo `kickoff` de 0,9 s. Quem sofreu o gol (`lastConceded`) bate a saída; o 2º tempo começa com o time 1.
- `endHalf`: no 1º tempo vai para `halftime` (evento `halftime`, cujo retorno é guardado em `halftimeInfo`); no 2º, empate vira gol de ouro (`golden`, evento `golden`; o jogo segue sem voltar pro meio, só um aviso "GOLDEN GOL" por 2,6 s), senão `finish()`.
- **Acréscimos do 1º tempo** (`waitPlay`): quando o tempo acaba com um time atacando (bola com jogador de linha, chute no ar ou bola solta após posse), o intervalo espera o lance acabar: roubo ou bola do adversário, bola com um goleiro, espalmada (`stoppage.done`), gol (`advanceState` manda direto pro intervalo). Teto `HALF_STOPPAGE_MAX` 12 s. Média ~1 s extra, máx ~3,4 s.
- `checkEnd` (após cada gol): `MERCY_DIFF` 4 gols de diferença encerra (`reason "mercy"`); no gol de ouro, qualquer gol encerra (`"golden"`). Treino e `scrimmage` nunca terminam.
- `finish(reason)`: `result = { score, win, reason: "time"|"mercy"|"golden", passes, poss, shots }`, evento `end`. No gol de ouro o jogo segue sem limite de tempo até alguém marcar.
- `kickoff(team)`: reposiciona todos e zera `restart`. Com formação desenhada, cada jogador vai para a sua âncora sem passar do meio nem entrar no círculo central de 95 px (o time que não bate a saída fica atrás do meio); sem desenho, atacantes ficam a 110 a 140 px do meio e defensores a 250 px, em faixas (`lane`). Quem bate é `kickTaker` (o jogador mais avançado do desenho, ou o primeiro atacante), a 22 px do centro. Energia não é resetada.

## 2.5 Bola (`kickTo`, `moveBall`)

- `kickTo(e, x, y, speed, errDeg, pass)`: aplica erro de mira aleatório de até `errDeg` graus (reduzido por Passe, ver 2.3). Passes normais têm a velocidade limitada a `220 + distância × 1,25` (parede não). Marca `pass.bad` quando a direção real erra o alvo por mais de 35 px. Velocidades usadas: passe 600 (lançamento 680), enfiada 640, parede 640, recuo ao goleiro 480, reposição do goleiro 560, chute `(820 + 9 × iv chute) × (1 + 0,22 qc)`.
- `ball.pass = { from, to, wall, ot, team, bad, lob, genius, spot?, fill? }` e `ball.shot = { team, goal, post, ty, chance, shooter }` descrevem o que a bola está fazendo; `ball.ignore/ignoreT` impede o chutador de pegá-la por 0,18 s.
- `moveBall`: atrito `exp(-1,05·dt)` (chute: `exp(-0,2·dt)`), quica nas laterais (×0,88) e na linha de fundo fora da boca (×0,85). Na linha de fundo: dentro da boca e chute marcado como gol → `scoreGoal`; dentro da boca sem gol → `keeperCatch`; fora, volta. Desde a v273, chute que bate na lateral vira bola solta na hora, e chute que sai pela linha de fundo fora da boca vira tiro de meta (`keeperCatch` do goleiro que defende, sem contar defesa; log "Chute para fora · tiro de meta"). Antes o chute perdido ficava quicando com atrito baixo por vários segundos e a defesa ficava parada esperando (partida 357). Chute abaixo de 160 px/s vira bola solta; abaixo de 25 px/s a bola para. Trave (só `duelMode`): ver 2.13.
- Portador: a bola fica colada no pé, na direção do movimento. Goleiro: colada à frente dele.

## 2.6 Chute e gol (`shoot`)

Quando o portador chega a menos de `C.SHOT_CLOSE` (50 px) do centro do gol, `thinkField` zera `think` e `decide` retorna `shoot` direto, sem conduzir mais (antes ~10% dos chutes saíam colados na linha). Fora disso o chute vem do sorteio de `decide` (2.9).

1. **Bloqueio do marcador**: o adversário mais perto não atordoado, até 75 px se está à frente (55 px de lado ou atrás), bloqueia com `clamp(0,12 + pow(defesa)/110, 0,15, 0,45)`, ×0,6 se não está à frente, × marca da Muralha (`defSig`), × `lerpQ(defBlock)` × (1 − 0,35 qc do chutador). Gasta energia dos dois; "BLOQUEIO!", a bola sai solta.
2. **Chance de gol** (`BL.goalChance(iv chute, Save)`): `50 + 2 × (Chute − Save)`, limitada a 5% e 90% (`GOAL_MIN`/`GOAL_MAX`). Chute é `iv(chute)` (com `rel`, sem nível absoluto); Save é o do goleiro adversário.
   - −10 se há marcador a menos de 60 px (`GOAL_PRESSURE_PENALTY`).
   - −1 a cada 10 px além de `230 + 140 qc` px do gol (`GOAL_LONG_RANGE_*`).
   - +6 × qd² no 1 s depois de driblar.
   - Limite final de 5% a 90%.
3. O resultado é sorteado na hora do chute (`ball.shot.goal`); a bola vai a um canto oposto ao goleiro se for gol, perto dele se não for, ou na trave (`post`, 2.13).
4. **No caminho**: cada defensor de linha adversário que chega a `r + 8 + 24 + 14 qd` px da bola pode bloquear uma vez por chute (`checkContacts`, `shot.tried`): `clamp(0,18 + pow(defesa)/90, 0,2, 0,6)` × marca da Muralha × `lerpQ(defBlock)` × (1 − 0,35 qc). A bola quica a 40% da velocidade, "BLOQUEIO!".
5. **Goleiro** (`keeperCatch`): num chute defensável, 40% de chance de espalmar ("ESPALMOU!", bola viva, `stoppage.done`); senão segura ("DEFESA!"). Chute que vai entrar ou na trave o goleiro não pega. Tempo segurando: `hold = 1,8 − (SB − 15) × 0,08` s (SB 15: 1,8 s; SB 31: 0,5 s).

## 2.7 Goleiro (`thinkKeeper`, `moveKeepers`)

- Sem a bola: acompanha a altura da bola dentro da boca do gol a 230 px/s. Em chute adversário que vai entrar (ou na trave), "pula para o lado errado" a 120 px/s; em chute defensável, vai a 700 px/s na altura do chute.
- Com a bola (tiro de meta): quando `hold` acaba, passa para o companheiro de linha com mais espaço real: `min(openness, 220) × (linha fechada ? 0,4 : 1)`. Abre `restart = { team, until: agora + 1,6 s }` e emite `gkpass`.

### Tiro de meta (`restart`, `restartFor(t)`)

- Vale enquanto o goleiro segura (`until = Infinity`, definido em `keeperCatch`) e 1,6 s depois do passe.
- Os adversários mantêm o alvo a pelo menos 180 px de cada jogador de linha do time que repõe (final de `thinkField`).
- O passe do goleiro não pode ser cortado (`checkContacts`).
- Quem recebe ganha `duelCd = 1,2 s` (ninguém dá bote) e a janela se estende +1,2 s.
- Desligado no treino; cancelado se o adversário pegar a bola.
- Efeito medido: botes nos 2 s depois da reposição caíram de 50 a 68% para 21 a 33%.

## 2.8 Jogador de linha (`thinkField`)

Cada quadro define um alvo `tx/ty` e um `mode` (`idle`, `carry`, `press`, `box`, `hold`, `double`, `sweep`, `track`, `markBack`, `outlet`, `recover`, `runTo`, `chase`, `support`, `cover`, `counter`, `watch`, `go`, `slide`), depois move o jogador até lá (velocidade limitada a `runSpeed`, e a `dist × 6` perto do alvo). Atordoado (`stun`) só desliza. Em carrinho (`slide`) segue `slideStep`.

**Com a bola**: conta `think`; quando zera chama `decide(e)` (próximo em `rand(0,22, 0,42) × actF`). Construção do plano `build` segura o passo (`BUILD_WAIT`) enquanto o apoio ainda está atrás.

**Adversário com a bola** (`b.owner` de linha do outro time):
- `press`: o mais perto do portador fica entre ele e o gol e dá o bote. Muralha (`press: 0`) não pressiona com a bola a mais de 55% do campo do próprio gol. Em `duelMode` o pressionador que já passou do portador (26 a 72 px, por trás ou de lado) pode se jogar no carrinho (2.13).
- `box`: com a jogada a até 210 px do gol e 190 px do eixo, defensores fecham a área (`boxSpot`: o mais perto dobra no portador, os outros marcam pelo lado do gol os atacantes perto da área, o que sobra protege a frente do gol, sempre dentro de 150 px de profundidade).
- Defensor (`hold`): linha entre a bola e o gol na sua faixa, ou âncora da formação (75% âncora + 25% altura da bola).
- Atacante sem bola: alterna entre `markBack` (corta a saída dos zagueiros deles) e `outlet` (espera o contra-ataque no campo deles). Muralha: o atacante sempre espera o contra-ataque.
- Times com poucos defensores (menos de 2 sobrando) mandam atacantes voltar: `double` (dobra no portador), `sweep` (cobertura) e `track` (marca colado quem pode receber); perto da área todos ajudam. Blitz pressiona alto com mais um no campo deles. Quem ficou à frente da bola corre ×1,12 para voltar.
- Toque contra a 1-3-1: o zagueiro mais recuado vigia o atacante isolado deles pelo lado do gol (`mode = "watch"`), tanto com a bola deles quanto com a nossa.

**Goleiro adversário com a bola**: recompõe (âncoras ou `oppGkShape`, `mode "recover"`).

**Bola solta ou chute no ar**: o mais perto de cada time vai nela; quem não é do time do chutador congela (×0,3) durante o chute. Desde a v469 (Mickey: o mais perto passava reto ignorando a bola), `looseMine` escolhe quem **chega primeiro** (segue a bola freando, `C.LOOSE.t`/`step`/`pad`) e põe modo `chase`, que `fixoSpot`/`alaDefSpot`/`attackSpot` não sobrepõem; quem está a menos de `LOOSE.near` px da bola também disputa se o escolhido ainda não está a `mateNear` px dela (nunca quem acabou de tocar o passe limpo). Passe lento (< 200 px/s) ou errado conta como bola solta (`oppPassAt` e o portador fictício do nosso passe). Medido: o mais perto indo na bola 73% → 90% (a menos de 100 px: 81% → 96%).

**Passe a caminho**: quem recebe corre para o ponto; na infiltração (`runTo`) corre para o ponto futuro e, perto da bola, vai nela; o terceiro atacante ocupa o espaço deixado (`fill`, `mode "support"`). Na tabela com a parede, corre para onde a bola volta.

**Time com a bola**:
- Atacantes abrem espaço; com formação desenhada, a forma sobe junto com a bola (no máximo ~260 px à frente do portador), sem ficar atrás da própria âncora; os dois da frente esperam o lançamento no campo deles.
- Blitz saindo do próprio campo (bola nos primeiros 45%): apoio curto do lado da bola, outro abre do lado oposto escalonado, o terceiro fica de referência lá na frente.
- Dupla da frente (`duoMate`): o parceiro se oferece na diagonal à frente.
- Ala da Muralha no contra-ataque (`counterMate`): um só ala sobe e acompanha o portador pelo outro lado, se há no máximo 2 adversários entre a bola e o gol.
- Defensores (`cover`) seguram a sobra e sobem com a bola sem sair da forma. No plano `build`, apoiam em `buildSpot`.
- Tabela: quem acabou de passar dispara (`mode "go"`, 2.11b).

**Fixo (v437, Mickey)**: `e.fixo` (de `opts.fixo = [índice meu, índice inimigo]`, só 4×4; meu = vaga 0 do Meu time, inimigo = 1º `zagueiro`). `fixoSpot(e)` roda depois dos ramos acima e sobrepõe o alvo, exceto com a bola, recebendo passe ou em `press`/`box`/`runTo`/`watch`: fica sempre `C.FIXO.gap` atrás do companheiro mais recuado e nunca passa do meio; com a nossa bola vigia (`fixoMark`) o adversário mais perto do nosso gol, `C.FIXO.mark` px do lado do gol; sem a bola fica na linha bola–centro do gol a até `C.FIXO.arc` px (`fixo`); bola solta perto e no nosso campo ele vai nela. Só pode ser o pressionador com o portador a menos de `C.FIXO.press` do gol. Não faz tabela (`ggT`).
**Ala Def (v438, Mickey)**: `e.alaDef` (`opts.alaDef`, só 4×4; meu = vaga 1, inimigo = 1º `aladef`). `alaDefSpot(e)` roda depois do Fixo: se é defensor e a bola é nossa (não do goleiro), sobe até `ALA_DEF.ahead` à frente do portador (no máximo `max` do campo) e abre `wide` px pelo lado (`ala`); se é atacante e o adversário conduz nos primeiros `back` do nosso lado, volta para `cover` do caminho bola→gol (`alaBack`). Não mexe em quem está em bote, área, tabela, dobra, marcação ou com a bola.

v439: passe nosso a caminho conta como posse (referência = quem recebe); sobe com `sp × ALA_DEF.sprint`; com a bola deles além de `high` do campo espera em `wait` do campo (`alaWait`, exceto Muralha). No Toque, quem vigia o atacante isolado (`watch`) é o Fixo.

**Anti-amontoado**: quem só está se posicionando (fora de `press`, `double`, `chase`, `runTo`, `carry`, `go`) e teria o alvo a menos de 46 px de um companheiro desloca 56 px para o lado.

Auxiliares: `openness(e)` = distância ao adversário de linha mais perto; `laneBlocked(a, m)` = adversário a menos de 30 px da reta do passe; `isAtk(e)` (atacante ou time sem atacantes/ala com a bola); `defSig(e)` (marca do estilo, 2.10).

## 2.9 Decisão com a bola (`decide`)

`decide` monta uma lista de opções com pesos e sorteia uma (`U.weighted`). Antes de tudo: se `distGoal < SHOT_CLOSE`, finaliza (2.6). Estado de partida usado nas contas: `blocked` = adversário à frente (> −12 px) a menos de 130 px; `clear` = caminho livre (nenhum adversário de linha num corredor de ~110 px até o gol; nunca no treino).

| Opção | Peso base |
|---|---|
| `shoot` | se `dist < range`: `(range − dist)/range × (0,5 + Chute/31)`; ×2,2 a menos de 180 px; ×0,4 com marcador colado (< 55 px) à frente; `clear`: ×3 a menos de 250 px, senão ×0,4; × `style.shot`. `range` = 330, 400 Toque, 360 Blitz, 420 treino ou sem atacantes, + 140 × qc |
| `carry` | `(0,9 + Drible/25)` × `style.drib`; ×0,25 defensor que passou do meio; ×0,45 time sem atacantes pressionado; ×4 com caminho livre |
| `wall` (tabela com a parede) | só depois de conduzir 0,6 s (0,3 no treino), fora do cooldown (2,5 a 4,5 s) e sem caminho livre; `0,5 + Passe/35` marcado, 0,1 senão (0,45 no treino); ×0,5 longe da lateral (> 170 px) |
| `pass` para cada companheiro | `pz × (0,7 + Passe/25)` × (à frente ×1,5, atrás ×0,6, ×0,2 se time sem atacantes já no campo deles) × (receptor livre > 70 px ×1,2, senão ×0,5) × (receptor atacante e portador defensor ×1,6) × (linha fechada ×0,2). `pz` = `style.pass`, 1,5 sem atacantes (2,4 pressionado), `0,8/(companheiros)` no treino |
| `back` (recuo ao goleiro) | `0,45 + Passe/40`, só fora do treino, pressionado (`blocked`, `distO < 90`), longe do gol (> 420 px) e sem caminho livre |
| lançamento longo (`long`) | Muralha no próprio campo (primeira metade) e times sem atacantes: para quem está 220 px à frente e livre (> 60 px), `0,55 + Passe/30` (×2,2 da Muralha pressionada) |

Com caminho livre, os passes só valem para quem está 80 px à frente (×0,15), os outros ×0,02.

Ajustes por cima dos pesos, na ordem do código:

- **Chutes do modo duelo** (`duelMode`): chute de longe com caminho livre (250 a 430 px) `DUEL_LONG_SHOT` × (0,5 + Chute/31), ×2,5 com marcador chegando por trás; logo depois do drible (`burst`, < 380 px) os chutes valem ×`DUEL_BURST_SHOT` (2,5 no 1×1) ou ×`DUEL_BURST_SHOT_TEAM` (1,5 em time).
- **Atacante solitário da Muralha** (`soloAtk`: Muralha com um só atacante): "solo" = até 3 s depois de recuperar a bola (`recoverT`) ou, no campo deles, com até 2 adversários entre ele e o gol. Em solo conduz ×2,5, chuta ×1,5, tabela com a parede ×1,3, recuo ×0,05, passe ×0,06; travado (marcador colado à frente) quase tudo ×0,5 a ×1. Chute de longe extra `SOLO_SHOT` (330 a 440 px) existe mas está em 0: mesmo 0,05 fazia a 1-3-1 vencer a 1-2-2.
- **Enfiada / infiltração** (`thru`, Blitz ou plano `attack`, atacante com a bola além de 35% do campo e a mais de 200 px do gol): passe no "ponto futuro" 115 px à frente do companheiro, só se ele chega lá 30 px antes de qualquer adversário (e do goleiro) e a linha está livre. `(0,5 + Passe/30)` ×1,6 se pega as costas de um defensor (×0,8 senão); toques laterais ou para trás comuns ×0,6.
- **Passe para trás** (todas as formações, fora do treino): se há companheiro livre ao lado ou à frente (espaço > 90 e linha limpa), recuos (goleiro ou companheiro 40 px atrás) ×0,12 (×0,5 se pressionado). Recuo para quem está marcado (espaço < 70) ou com a linha fechada ×0,05.
- **Visão de jogo** (fora do treino): portador no campo deles, com companheiro ao lado/à frente e 2+ adversários no campo do portador. `vis = clamp((média de iv passe, drible, físico, velocidade − 8) / 20, 0, 1)`. Recuo arriscado (receptor a menos de 170 px de um adversário ou linha fechada) ×(1 − 0,95·vis), outros recuos ×(1 − 0,6·vis); toque para companheiro do lado ×(1 + 0,8·vis); conduzir ou tabela ×(1 + 0,6·vis). IV 28 quase nunca recua (0 a 0,7%), IV 16 recua um pouco menos.
- **Plano de jogo** (`build` / `attack`, 2.11b).
- **Dupla da frente** (`duoMate`: formação com exatamente 2 não-defensores, portador além do meio menos 60 px, no máximo 1 adversário à frente, até 4 s depois de recuperar a bola): parceiro ×1,6; passe para defensor ×0,15; recuo ×0,1 (×0,4 e ×0,5 se estiver travado).

Execução: `shoot` → `shoot()`; `wall` → `wallPass()` (a bola vai à lateral e volta, `ball.pass.wall`); `back` → passe ao goleiro (log "recuou para o goleiro"); `thru` → passe no ponto com `ball.pass.spot/fill`; `pass` → passe no pé (lançamento com `lob`, ou `lob` por `passLob`); senão conduz para a frente com `ty` aleatório, desviando do marcador (e em `duelMode`, a ginga, 2.13).

## 2.10 Contatos, corte de passe e duelo

`checkContacts` com a bola livre, para cada entidade não atordoada que encosta (ignora o chutador por 0,18 s):

1. Bloqueio de chute no caminho (ver 2.6).
2. Goleiro: segura ou espalma (a não ser que o chute vá entrar ou na trave).
3. **Bola solta**: passe com `bad` ou bola abaixo de 200 px/s é de quem encostar, sem sorteio (nem corte, nem Toque).
4. Exceções que deixam a bola passar pelo adversário (nesta ordem):
   - time sem atacantes deixa passar 55% dos passes (sorteado uma vez por passe);
   - passe de reposição do goleiro;
   - lançamento pelo alto nos primeiros 70% do percurso;
   - passe de gênio (`pass.genius`): passa por todos;
   - corte por habilidade, uma tentativa por defensor: corta com `clamp(0,72 × (pow(defesa)/pow(passe do passador))², 0,25, 0,97) × lerpQ(defCut)`;
   - Toque de bola: 20% dos passes atravessam a marcação (45% com a vantagem), sorteado uma vez por passe.
5. Ao dominar: conta passe certo (`passes++`; "TABELA!" se `wall`/`ot`), ou desarme por corte (`steals++`, log "interceptou"); marca `recoverT` se foi recuperação; `recvT` se veio de passe do próprio time; `think = 0,12 × actF`; proteção do tiro de meta.

Com a bola dominada, um marcador do outro time a até `r + r + 6` px do portador (sem `stun`, `duelCd` nem carrinho) abre um **duelo** (`duel`):

```
ataque = (pow(drible) × 0,65 + pow(velocidade) × 0,35) × (0,9 se time sem atacantes e sem plano build) × (1 + 0,6 qd² se recvT < 0,7 s)
defesa = (pow(defesa) × 0,65 + pow(físico) × 0,35) × (0,85 se time sem atacantes) × sig
p(drible) = clamp(ataque⁴ / (ataque⁴ + defesa⁴), 0,08, 0,92)      (duelOdds é a parte sem o clamp)
```

- `sig` = marca do estilo (`defSig`): Muralha no próprio campo, Blitz no campo deles. Vale `STYLE_SIG.base` (1,1), ou `sigWin` do estilo com a vantagem. Toque soma `mark`/`markWin` contra o atacante isolado da Muralha, `markTeam` contra o resto da Muralha e `duel` em todos os botes.
- O expoente 4 faz o mais forte (nível, IV) ganhar bem mais disputas. É isso que sustenta a regra do espelho: na mesma formação, o time melhor quase sempre vence.
- Drible ganho: portador ganha `burst` 0,7 s e `dribT`; marcador fica no chão `TACKLE_MISS_STUN` 0,9 s e perde energia extra; "DRIBLE!" (nome no modo duelo). Bote ganho: a bola muda de dono (`recoverT` do marcador), o portador fica atordoado 0,5 s, "ROUBOU!". Os dois ganham `duelCd` 0,9 s. Gasto de energia: 2.3.
- Time sem atacantes como marcador: em 60% das vezes em que o bote venceria, ele só segura o portador (stun 0,35 s, "BLOQUEIO!"), a posse não muda.

## 2.11 Formações e estilos (4×4)

Definidas em `CONFIG.TACTICS[4]` e `CONFIG.STYLES`. Detalhes de números em [08](08-config-e-balanceamento.md).

| id | Nome | Tipo | Estilo | Atacantes | Vence |
|---|---|---|---|---|---|
| `2-2` | 1-2-2 | equilibrada | Toque de bola | 2 | 1-3-1 |
| `1-3` | 1-1-3 | ofensiva | Blitz | 3 | 1-2-2 |
| `3-1` | 1-3-1 | defensiva | Muralha | 1 | 1-1-3 |

- **Toque de bola**: muito passe (×1,7), pouco drible (×0,75), chuta mais (`shot 2`, `range 400`). 20% dos passes atravessam a marcação; marca colado o atacante isolado da 1-3-1 (`mark`/`markWin`) e leva um bônus em todos os botes (`duel`).
- **Blitz**: conduz e dribla (×1,45), chuta de 360 px, pressiona alto com dois (`press 2`), rouba mais no campo deles (`sigWin`), enfiada no ponto futuro e saída de bola escalonada.
- **Muralha**: bloco baixo (`press 0`, não pressiona no campo deles), desarma e bloqueia mais no próprio campo, lançamento longo pelo alto, atacante isolado finalizador (`soloAtk`), um ala sobe no contra-ataque (`counterMate`).
- **Vantagem** (`FORMATION_BEATS` por `type`): quem soma mais vantagens no ataque × defesa ganha `FORMATION_EDGE` (11%) em todos os status naquela partida, ×`FORMATION_EDGE2` (1,5) com saldo 2 (aplicado em `mods[t].all` por `G.formationMods`, v635) e a marca do estilo fica mais forte (`edge[t]` → `sigWin`, `markWin`, 45% de Toque atravessando).
- **Formações personalizadas** (quadro Tático): herdam tipo, estilo e vantagem da base; o desenho define as âncoras. O inimigo sorteia só as três de fábrica (a preferida do nome do time 70% das vezes, `ENEMY_PREF_CHANCE`).
- **1×1 a 3×3**: táticas simples (`TACTICS[1..3]`) que só definem quantos atacam; sem estilo e sem pedra-papel-tesoura. O 3×3 "Ataque total" e "Retranca" têm `shape` em "V".
- `anchor(e, kick)`: posição-base do jogador no desenho (o k-ésimo defensor ocupa a k-ésima vaga de defensor; idem atacante). `kickTaker(t)`, `lane(list, e)` e `boxSpot` usam isso.

## 2.11b Plano de jogo: construção e ataque (v197)

`planFor(t)` define `plan[t]` (recalculado em `setTactic`): `"build"` quando há mais defensores que atacantes (2×2 Defensivo, 3×3 Defensivo e Retranca), `"attack"` com mais atacantes ou estilo Blitz, `null` em Toque, Muralha (mantém o contra-ataque, decisão do Mickey), contagens iguais, 1×1 e treino.

- **build**: defensores de apoio vão para `buildSpot(e, own)` (cache de 0,35 s): com 2+ apoios o mais recuado vira cobertura (`BUILD_COVER` atrás da bola, no próprio campo, no máximo até o meio); os outros buscam ângulo livre num arco de ±`BUILD_ARC` graus a `BUILD_AHEAD` px (e +50) à frente (nota = espaço livre até 130 + avanço·`BUILD_FWD` − linha bloqueada − apoio vizinho). Condutor desacelera (`BUILD_WAIT`) se ninguém o acompanha. Em `decide`: recuo ×`BUILD_BACK` (×`BUILD_BACK_PRESSED` se pressionado, ×0,5 se for ao goleiro sem aperto), passe com linha livre ×`BUILD_PASS`, devolver para quem acabou de passar ×0,3 (se está atrás) ou ×1,5 (se subiu e está livre). Sem penalidade de condução do `noAtk`.
- **attack**: devolução para quem acabou de passar, à frente e livre, ×`ATTACK_ONE_TWO` (marca `ot` → "TABELA!"); viradas (|dy| > 200) ×1,4; passe para frente livre ×1,3; condução ×`ATTACK_CARRY` quando há opção livre à frente; enfiadas como na Blitz.
- **Tabela (give-and-go)**: após passar para frente ou para o lado (exceto lançamento e devolução), o passador corre (`mode "go"`, `GIVE_GO_T` s) para `ggx/ggy` (ataque: 160 px à frente; construção: `BUILD_STEP` à frente do receptor). Zera ao receber.

## 2.12 Desenho (`draw`)

Desenho no canvas (campo em perspectiva, sprites, barra de energia, partículas, textos flutuantes, tremida, câmera, HUD, letreiros de LED, sobreposições de gol, intervalo e gol de ouro) está em [10-desenho-sprites-vfx.md](10-desenho-sprites-vfx.md). O motor expõe para ele `fx`, `parts`, `flash`, `shakeT`, `ball.lift/curl` e os tempos de pose (`kickT`, `dribT`, `tackT`, `saveT`, `missT`, `celebT`); nada disso afeta a simulação.

## 2.13 Modo duelo: ginga, carrinho, chutaço e trave (`duelMode`)

`duelMode = !training` (ou seja, qualquer partida normal e o treino em dois times). Nasceu no 1×1 (v188) e foi para todos os modos na v191. Pedido do Mickey: mais emoção. Constantes `C.DUEL_*`. Câmera lenta e "DRIBLE DA VACA" foram removidos a pedido dele: não recolocar.

- **Ginga** (`decide`, ramo de conduzir): marcador à frente (`blocked`, < 130 px) e sem caminho livre → o portador corta para um lado e para o outro (`e.ginga`, `e.zig`, passo ×0,82, nova decisão a cada 0,16 a 0,26 s × `actF`).
- **Carrinho** (`startSlide` / `slideStep` / `slideHit`): o pressionador que corre atrás do portador, a 26 a 72 px e já por trás ou de lado, se joga com chance `DUEL_SLIDE_RATE` 2,2 por segundo (precisa de `slideCd` e `duelCd` zerados). Arranque de `DUEL_SLIDE_SPEED` 290 por 0,3 s na direção prevista do portador; `slideCd` 2,2 a 3,2 s. Ao encostar usa `duelOdds` (mesma conta do bote, com a marca de cada formação): acerta com `(1 − duelOdds) × DUEL_SLIDE_WIN` 0,8, limitado a 6% a 85%. Acertou: bola espirra solta, portador no chão 0,5 s, "CARRINHO!" (evento `tackle`). Errou: quem deu fica 0,9 s no chão, portador ganha arrancada, "PULOU O CARRINHO!" (evento `dribble`). Não achou o portador: 0,55 s no chão. Gasto de energia como no bote.
- **Chutaço**: chute de longe com caminho livre (250 a 430 px) e finalização de primeira logo depois do drible (`burst`). Chute de mais de 300 px mostra "CHUTAÇO!" e treme a tela.
- **Trave**: `DUEL_POST` 25% dos chutes que não entram vão na trave (`shot.post`): o goleiro não pega, a bola bate na linha, volta viva a 45% da velocidade, "NA TRAVE!".
- **Dribles com nome**: `C.DUEL_MOVES` (CANETA, ELÁSTICO, CHAPÉU, PEDALADA, LAMBRETA; CHAPÉU levanta a bola, `ball.lift`).
- **Efeitos**: estouro no choque (`impact`), anel no chute (`ring`), imagem residual de quem arranca (`e.ghost`), poeira do carrinho, explosão de cor no gol (`burst`). Visual em [10](10-desenho-sprites-vfx.md).
- Equilíbrio: o carrinho usar `duelOdds` (e não uma chance fixa) é o que mantém o Toque forte contra a Muralha; `DUEL_BURST_SHOT_TEAM` baixo (1,5) evita a 1-3-1 forte demais contra a 1-1-3. Números medidos em [08 §8.18](08-config-e-balanceamento.md#818-equilíbrio-medido).

## 2.14 Pausa tática, pré-jogo, vestiário e treino (lado do motor)

O motor só oferece os ganchos; o fluxo está em `game.js` (`G.prematchPick`, `G.tacticalPause`, `G.applyPause`, `G.halftime`, `G.vestEnd`, `G.subIn`, `G.vestTactic`).

- `paused`: `update` não avança nada enquanto verdadeiro. A partida nasce pausada no pré-jogo (`PREMATCH_SECONDS` 15 s; escolher outra formação chama `applyLive` e `kickoff(0)` de novo). A Pausa tática é 1 por partida (`pauseUsed`), não vale no treino nem no gol de ouro (`G.pauseState`).
- `setTactic(t, o)`: troca papéis, desenhos, estilo, `noAtk`, `plan` e `cm` de um time com a partida rolando; em seguida `G.applyLive` refaz `mods` e `edge` no 4×4. Não reposiciona ninguém.
- `substitute(e, p)`: o reserva assume a vaga (mesmo papel e posição) com energia 100, sem `stun`, e recalcula `rel`. Só no vestiário, só o seu time (o inimigo não usa as reservas dele).
- Intervalo: `endHalf` emite `halftime`; `G.halftime` dá +15 de energia aos dois times, aplica o Módulo de cura (v509: item permanente, energia 100 no time em campo) e a Cura automática (VIP), pausa a partida e abre o Vestiário (`VESTIARIO_SECONDS` 15 s, cada mexida reinicia a contagem). Ao voltar, `advanceState` começa o 2º tempo com `kickoff(1)`.
- **Treino** (`training`): só o seu time em campo e o goleiro no gol da direita; sem relógio, sem fim, sem tiro de meta, sem caminho livre. Em `decide`: alcance de chute 420, peso de passe `0,8/companheiros`, tabela na parede liberada após 0,3 s (peso 0,45), conduz para `ty` variado. Posse sempre do time 0. `lastConceded = 0`.
- **Treino em dois times** (`scrimmage`, v161): quem não está no Wildcard nem na Expedição se divide em dois times (até 4×4), partida normal com `duelMode`, sem relógio nem mercy; `G.healEnt` aceita os dois lados.
- `onSample` (cura automática e registro da partida) roda a cada segundo de jogo; o registro vai para `matches` (ver [06](06-contas-e-save.md)).

## 2.15 Eventos emitidos (`onEvent(tipo, dados)`)

Tratados em `G.onMatchEvent` (log, sons, baú de gol, vestiário, fim).

| Evento | Dados | Quando |
|---|---|---|
| `pass` | `{ team }` | todo `kickTo` de passe (inclui goleiro e parede); som de passe |
| `gkpass` | `{ team }` | reposição do goleiro |
| `shot` | `{ team, chance, name }` | chute que não foi bloqueado de cara |
| `goal` | `{ team, name, chance, score, minute }` | `scoreGoal` |
| `save` | `{ team, parry }` | goleiro segurou ou espalmou (`team` é o do goleiro) |
| `dribble` | `{ team, name, vs }` | drible ganho ou carrinho pulado |
| `tackle` | `{ team, name, vs }` | bote ou carrinho que roubou |
| `log` | `{ team, text }` | bloqueio, interceptação, recuo ao goleiro, lançamento, tabela com parede, trave |
| `halftime` | `{ match }` | fim do 1º tempo; o retorno vira `halftimeInfo` |
| `golden` | `{}` | empate no fim do 2º tempo |
| `end` | `result` | `finish` |

## 2.16 Onde mexer (mapa rápido)

| Quero mudar | Onde |
|---|---|
| Quanto pesa nível, IV, nature | `iv`/`pow`/`q`, `e.rel` (construtor), [03](03-jogadores.md) |
| Cansaço, gasto, cura | `drain`, `fatigue`, `tired`, `C.ENERGY_*`, `G.autoHeal` |
| O que cada IV faz | `C.IVX` e os pontos de uso listados em 2.3 |
| Chance de gol, bloqueio, defesa | `shoot`, `BL.goalChance`, `keeperCatch`, `checkContacts` (bloqueio) |
| Quanto a IA chuta, passa, conduz | `decide` (pesos) e `C.STYLES` |
| Quem marca/pressiona onde | `thinkField`, `boxSpot`, `defSig` |
| Disputa de bola | `duelOdds`, `duel`, `startSlide`/`slideHit` |
| Formação, âncoras, vantagem | `C.TACTICS`, `anchor`, `G.formationMods`, `C.FORMATION_*` |
| Construção/ataque das táticas pequenas | `planFor`, `buildSpot`, `C.BUILD_*`, `C.ATTACK_*` |
| Tempo, acréscimos, fim | `step`, `endHalf`, `waitPlay`, `checkEnd`, `C.HALF_*`, `C.MERCY_DIFF` |
| Tiro de meta | `restart`, `restartFor`, `thinkKeeper`, `keeperCatch` |

Depois de qualquer mudança de IA, confira o pedra-papel-tesoura do 4×4 (meta: cada vantagem perto de 70%) com a bancada de [09 §9.5](09-build-publicacao-e-simulacao.md).

**v550 (Mickey):** um bloqueio por lance: depois de qualquer "BLOQUEIO!" (chute travado na frente, perna no caminho ou bote que só segura) nenhum outro sai por `C.BLOCK.gap` s, e com chance `C.BLOCK.keep` quem bloqueou já domina a bola (`blockKeep`/`blockOk` em `engine.js`). Quem perde a bola num roubo: `C.STEAL_LOST` stun 0,5 s e `duelCd` 1 s (sem tentar roubo). Vale para os dois times.

**v551:** para manter cada vantagem perto de 70% com o bloqueio único, a Muralha pressiona um pouco (`STYLES.muralha.press` 1) e a assinatura da Blitz caiu (`sigWin` 1.15). RPS 71/69/67.

- **v559 (Mickey): status pesa mais, crítico escondido e embalo** (`C.DICE`): a margem do d20 vira `base + (atk − def − base) × statK` (base −4 = dois jogadores iguais, statK 1,3), então quem é melhor ganha mais vezes sem acabar com a sorte (limites min/max seguem). Em cada duelo, `crit` 4% o atacante ganha de qualquer jeito ("CRÍTICO!", marcador no chão × `critStun` 1,5) e 4% o marcador rouba limpo ("ROUBO LIMPO!", portador no chão × 1,5). Embalo: cada jogador conta duelos ganhos seguidos (`momN`); a partir do 2º ganha +1 no dado por vitória extra, até +3 (`mom`), perder zera; sem texto na tela (v560, Mickey tirou o "EMBALADO!"). Vale para os dois times. RPS 70/68/66.

- **v561 (Mickey) · X1 mais dinâmico** (`C.X1`, só quando os dois times têm 1 jogador de linha, `Match.x1()`): **fôlego temporário** `e.fol` 0-100 (separado da energia): com a bola gasta `hold` 3/s parado ou `run` 7/s conduzindo; drible 14, chute 12, push 6, blade 10 na hora; sem a bola recupera 16/s. Abaixo de 30: −3 no dado do drible e conduz ×0,85. Anel ciano (vermelho quando baixo) no pé mostra o fôlego. **Push ball** (`decide` opção "push"): sem marcador colado na frente e longe do gol, toca a bola 150-210 px à frente (auto-passe `kickTo` para si) e corre atrás na velocidade normal; o marcador aposta corrida pela bola solta. **Blade** (opção "blade"): marcador na frente a até 125 px, levanta a bola por cima dele (lob, `ball.lift`) e corre para pegar; texto "BLADE!". **Água**: 1 a 2 por partida entre 12% e 85% do jogo, numa ala (45 px da lateral, `Match.water`); quem chegar primeiro volta a 100 de fôlego ("ÁGUA!"); quem está com pouco fôlego corre para ela (o portador conduz pela ala até ela). Novo nome de drible "ROLETA!". Na simulação 1×1 (30 jogos espelhados Nv 50): gols 4,0→4,9, dribles ~13, blades 3,3, água aparece 1,2 e é pega 0,7 por jogo. RPS do 4×4 não muda (nada vale fora do X1).

- **v562 (Mickey, estilo FIFA Street) · X1:** água removida. Fôlego só cai correndo (velocidade > `runR` 0,8 × corrida, 1,2/s) ou em ação (drible 7, chute 8, push 4, blade 7); andando ou parado recupera 10/s, com ou sem bola. **Stack de estilo** por time (`Match.stack`, `addStack`): drible +1, drible humilhante (CANETA, CHAPÉU, ROLETA, LAMBRETA ou crítico) +2, push +1, blade +2, até 12. O gol vale `goalValue` = 1 + floor(stacks / 3), até 4 (`GOL x2!` etc.), e o stack zera ao marcar ou quando o time perde a posse (`possT` no `step`). Embaixo do jogador aparece "★N · GOL xV". No X1 não existe misericórdia de 4 gols (`checkEnd`). Simulação 1×1 (30 jogos): 5,1 gols marcados e 6,3 no placar por jogo, 1,2 gols multiplicados, 24% do tempo com fôlego baixo.

- **v563 (Mickey) · X1:** stack saiu de baixo do jogador e foi para o placar (`#stkA`/`#stkB` em `.sb-team`, `renderStack` em ui.js a cada 120 ms: "★ N" + "GOL xV" / "CHUTE LIBERADO" / "faltam N", sobe com animação a cada ganho, dourado quando o gol vale mais). **Chute só com `style.shotMin` 3 stacks e a menos de `shotDist` 330 px do gol** (`x1ShotOk`; vale em `decide`, no `SHOT_CLOSE` e no próprio `shoot`); sem isso o portador vai para cima do marcador (carry × `faceK` 1,6, alvo no marcador; perto do gol volta para driblar). **X1 15% mais rápido** (`X1.speed` 1,15 no passo da simulação; o relógio divide pelo mesmo valor, então a duração da partida não muda). Simulação 1×1 (30 jogos): dribles 13→20, chutes 9→3,7, 1,6 gols marcados e 3,3 no placar por jogo (quase todos multiplicados).
- **v564 (Mickey) · X1, dribles em dobro:** `C.X1.trick` cria "caneta" (bola entre as pernas) e "vaca" (bola por um lado, ele corre pelo outro; só longe da lateral) em `decide`: chute para ele mesmo (`kickTo ... to: e`) atrás do marcador; acerto = `duelOdds × edge`, no acerto o marcador fica `ball.ignore2` por `ignore` s e `stun`. `this.trick` guarda o lance; no rastreador de posse do `step` ele só soma stack (`humilN`, blade = `style.blade`), dispara `dribble` (XP) e mostra o texto se o próprio jogador pega a bola. `trick.react`: marcador a menos de `near` px na frente zera o `think` (reage logo). `X1.chain` substitui `IVX.dribChain`, `X1.atk` multiplica a chance de drible no `duel`, `X1.shotGo` = chance de já chutar quando `x1ShotOk`. Tudo atrás de `this.x1()`; 2×2+ inalterado.
- **v565 (Mickey) · X1, dribles de verdade e combos:** no `decide`, erro do truque (caneta/vaca/puxada) = desarme na hora (mesma saída do duelo perdido, evento `tackle`); acerto = toque curto com `ball.ignore2` no marcador. `puxada`: bola para trás (`trick.back`, `backSide`, `backSpeed`), marcador empurrado para o lado errado. Combo: o rastreador de posse grava `e.comboT`/`comboN`; dentro de `combo.win` s os truques pesam × `combo.k` e entra a opção `hax` (`wallPass`, conta como truque "HAXBALL!" ao pegar). `e.mood` = peso sorteado por partida para cada truque (`X1.mood`). `x1ShotOk`: `shotMin` 5; v566 (Mickey): no gol de ouro não precisa de stack e `goalValue` = 1 (ui.js `renderStack` usa o mesmo). Bola com `pass.spot` parada (< 60 px/s) ou receptor já no ponto: ele vai na bola (bug que travava o gol de ouro, todos os modos).
- **v567 (Mickey) · X1, desarme espirra a bola:** `x1Knock(c, e)` (usado na derrota do `duel` e no truque errado): bola solta na direção marcador→bola (± `tackle.spread`), `ignore` no driblador, ele com `stun` 0,8, o marcador com `self` s. Opção `hax` (`wallPass`) também sem combo quando o marcador está na frente a menos de `hax.near`; no X1 o erro do `haxKick` × `hax.errK`. No rastreador de posse, pegar um "HAXBALL!" dá chance `hax.drib × Passe/31` de zerar `trickCd` e `think` (emenda drible).
- **v568 (Mickey) · X1, firula e cozinhar:** na condução (`b.owner === e` no step) `e.cooking` (fôlego < `cook.fol`, sem chute liberado; sai com `fol + hyst`) faz andar a `cook.walk` da velocidade, recuando e balançando; `e.flairOn` (até `e.flairT`, sorteado por `x1Flair` depois de drible no duelo, truque pego ou esquiva) faz voltar para o marcador a `flair.walk`. No começo do `duel`, cozinhando ou de firula, chance `cook.dodge × (0,4 + Drible/31)` (× `flairK` na firula) de esquivar: marcador `cook.stun`, +`humilN` stack, evento `dribble`. Cozinhando, truques × `cook.trickK`.
- **Estado atual do X1 (v658):** chute liberado com `style.shotMin` 2 stacks a menos de `shotDist` 330 px; todo gol vale 1 (`maxGoal` 1); v658: com stack para chutar o jogador não cozinha nem faz firula (vai para o gol); passo da simulação ×`X1.speed` 1,06. As notas de versão acima guardam os valores antigos.
- **v570 (Mickey) · X1, haxball em série e backboard:** no rastreador de posse, pegar "HAXBALL!" pontua só se passou do marcador (`tk.vs`) e se `by.haxPaid` ainda é falso (zera quando pega outro truque); perto da parede, chance `hax.chain × Passe/31` de `haxAgain` (opção `hax` com peso `hax.again` por 0,6 s). `wallPass` usa `hax.backX/backY` para o backboard no X1 e a opção `hax` pesa × `backW` nessa zona. Todo drible (duelo, truque, esquiva) dá `burst = X1.boost`. Blade pego: chance `combo.blade2 × Drible/31` de zerar `bladeCd`.

- **v575 · teto de velocidade:** na condução, `sp *= 0,7 + 0,01 × min(31, iv(drible))`; antes do movimento, `sp = min(sp, C.RUN_MAX × (C.RUN_HARD_K ‖ 1,4))`. Regra fixa: o nível nunca acelera a corrida.


## Reações Químicas e Egos em Colisão (v577)

Pedido do Mickey. As tabelas aprovadas estão em `docs/quimica/proposta-final.md`.

- **Onde vale:** nos dois times, em partidas valendo (não no treino nem no 1×1), até o fim da partida.
- **Dados:** `C.CHEM` (23 reações) e `C.EGO_CLASH` (13 duplas) em `config.js`.
- **Como acha o personagem:** por uma palavra do id ou do nome, sem acento (`chemKey`). Quem ainda não existe no jogo liga sozinho quando entrar, desde que o id ou o nome tenha a palavra usada na tabela (reo, ness, kaiser, shidou, charles, lavinho, loki, niko, kurona, gagamaru, igarashi, aiku, zantetsu, raichi, igaguri, karasu, otoya).
- **Contadores por jogador:** ficam em `e.cs` (`chemEv`): `drib` no drible ganho, `steal` nos eventos de desarme, `shot`, `goal`, `ast` e `pass`.
  - `pass` são passes certos para cada companheiro: `chemKick` em `kickTo` guarda o passe, e `chemOwner` em `step` confere se a bola chegou no companheiro.
  - `ast` conta quando quem marca recebeu a bola por passe (`recvFrom`).
- **Reação:** quando a âncora atinge `n`, o alvo ganha `+p` no status `k`.
- **Ego:** quem cumprir a condição primeiro tira `p` do status do outro e ganha esse valor convertido em % do próprio status (base × `cmul`).
- **Efeito:** entra em `cmul` (`e.chem[k]`), então vale em `iv` e `q`.
- **Teto:** `C.CHEM_CAP` 0,20 de ganho por status. O que passar do teto vai para outro status sorteado do mesmo jogador.
- **Aviso:** desde a v579 usa a arte do Mickey, `img/fx-chem.png` (ego em cima, reação embaixo; o texto da linha de baixo foi apagado da arte). `drawChemBanner` desenha a faixa no alto da tela (6% da altura, v581) por 2,8 s, uma por vez (fila `chemQ`, até 3). Entra com tranco e clarão, pulsa brilhando, tem uma faixa de luz correndo por cima (canvas auxiliar `_chemCv`), raios piscando nas pontas, faíscas subindo e estrelas girando. Os nomes e o efeito são escritos por cima e piscam. O aviso também vai para o registro da partida.
- **Medição** (30 partidas 4×4, Nv 100):
  - Reações: Bachira→Isagi 20%, Chigiri→Kunigami 20%, Isagi→Chigiri 13%. Kunigami→Isagi 0%, porque o Kunigami de defensor quase não chuta.
  - Egos: Chigiri x Kunigami 57%, Isagi x Rin/Barou ~75% somando os dois, Hugo x Isagi 30%.
- **Teste no modo dev (v580):** o painel DEV tem os botões "Testar Reação Química" e "Testar Ego em Colisão" (`data-dev-chem`, chamam `Match.chemDev(kind)`). Eles disparam na hora uma dupla real da tabela que esteja no seu time em campo. Se não houver nenhuma, usam os 2 primeiros jogadores com uma linha sorteada. Aplicam o efeito e mostram a faixa.
- **v582 (Mickey) jogada lendária** (`C.LEGEND_PLAY`, `Match.legendStep`): só no 4×4 (`opts.pos4`, fora de treino), chance `chance` 0,2 por partida, uma vez, para um time sorteado (os dois iguais). Entre `from` e `to` s de `this.time`, quando o portador desse time está no campo de ataque, ele faz o lance do maior status dele (Chute, Drible ou Passe, por `BL.baseStat`): texto grande "★ NOME ★" (`fx.big`), anel e tremida. Chute (só a até `shotDist` 380 px do gol): chuta na hora com chance × `shotK` 1,8 (teto `shotMax` 90). Drible: ganha todas as disputas por `t` 4 s. Passe: passes de gênio por `t` s. Nomes por personagem em `names`, padrão em `def`. Evento `legend`. `opts.legendNow` (DEV) dispara aos 3 s. Sim: ~22% das partidas.
- **v582 auras extras** no desenho do jogador: depois de Despertado e Boss, `p.goldTeam` (Time Dourado, `C.GOLDEN_TEAM.aura`) ou `p.msAura` (marco de gols).
- **v583:** jogada lendária usa só os nomes de `C.LEGEND_PLAY.def` (sem nomes por personagem). Aura de marco de gols (`msAura`) removida. `Match.mastEv(e, k)` (chamado no início de `chemEv`, e `ast` para quem deu o passe do gol) manda o evento `mast` do seu time para a Maestria; não mexe em nada do jogo.
- **v588 (Mickey) 4×4:**
  - Pivô que recebe o passe do blade (`e.bRecv`) faz backboard para ele mesmo com chance `C.REPERT.blade.pivoBack` 0,55 (`selfBack(e, true)` ignora o sorteio), senão chuta de primeira. Reequilíbrio: `GOAL_K` 1,5, Muralha `sigWin` 3,0, Toque `markWin` 2,2 e `duel` 1,02 (RPS 69/71/66).
  - Backboards ×3: `HAXBALL.selfBack.p` 0,45→0,9 e `HAXBALL.back.w` 300→900. Medido: backboard + backboard para ele mesmo 2,0 → ~5,4 por partida.
  - Dribles novos `C.TRICK4` (dois times, só 4×4 de verdade: `rplays[t]`), opção na `decide` com o marcador na frente: **CHAPÉU** (`chapeu4`, marcador a menos de `near` 55 px; dá certo com `base` 0,45 + `k` 0,6 × (Drible − Defesa)/31, entre 0,15 e 0,85; errou = roubo; certo = bola por cima, `lift`, o marcador não pega por `ignore` 0,9 s) e **DRIBLE DA VACA** (`vaca4`, até 75 px: bola para um lado, ele corre pelo outro; sem proteção, a bola fica em disputa). `trick4Go`; `this.trick4` só conta drible (texto, evento `dribble` com `trick4`) se ele pegar a bola. Medido por partida (dois times): ~11 chapéus tentados, ~1,7 dão certo e ele fica com a bola; ~6 vacas, ~2 ganhas.

- **v611 (Mickey) · Reações do Rematch:** `C.CHEM` ganhou 16 regras (Marin→Yars, Riq→Kyotz, Ratoworld→Pekas, Guiro→Zzapy, Winter→Efipe, Bricio→Blade, B→Mickey, Sereno→Hazih, Blade→Hyf, Wellio→Pedro Rego e 6 entre Alanzin, Lpz e Thz). Tokens: `ratoworld`, `b`, `rego`. Tabela em `docs/quimica/reacoes-rematch.md`.

## Habilidades (v625)

As 14 habilidades do Mickey (`docs/habilidades/`), números em `C.SKILL_DEF` (config.js). Desde a v638 as habilidades são **do time**, não de cada jogador: 4 slots em `state.skills` (`G.teamSkills()`, passados à partida em `opts.skills[0]`). O motor guarda uma lista por time (`skTeamL(t)`, recarga compartilhada; `skList(e)` devolve a lista do time do jogador, goleiro não usa; `skCut(t, s)` corta a recarga do time). Todo jogador de linha testa a condição a cada decisão, então quem está na melhor posição (em geral o dono da bola ou quem recebe) usa primeiro. Sem `opts.skills` (inimigo, PvP, guilda), o time usa a soma dos `p.skills` dos jogadores em campo. São automáticas e valem nos dois times; o inimigo pode vir com uma (`BL.enemySkills`, chance em `C.SKILL_ENEMY` pelo tamanho do mapa; Boss sempre).

- **Estado no motor:** `skList(e)` monta `e.sk` (recarga `cd`, `cdMax`, efeito `k` pelo nível, `C.SKILL_LV`); a recarga começa em `C.SKILL_START` (metade). `skStep(dt)` (no `step`, só com bola rolando) desconta a recarga e dispara as de time: Energia Infinita, Visão de Jogo e Ego (seu time com a bola no campo de ataque), Muralha (adversário com a bola a `zone` px do seu gol) e Ninja (aliado com a bola, ele à frente e perto do gol). Estado de time em `skT(t)`.
- **Com a bola (`skDecide`, no começo do `decide`):** volta da Tabela, Direct Shot (recebeu na área há < 0,6 s), Voleio (recebeu entre `from` e `to` px do gol: chance fixa), Chute Curvado (entre `from` e `to`), Passe Mágico e Passe Calibrado (`skBest`: melhor aliado à frente, passe `genius` que não é cortado), Tabela (pressionado, aliado perto), passe da Visão/Ninja; e as que não gastam a jogada: Drible do Monstro, Arrancada da Pantera, Arrancada Reta.
- **Chute:** `skWallHit` (Muralha bloqueia o chute no começo do `shoot`); `skShot` soma os bônus em pontos de % até `C.SKILL_CAP` (40) e a chance final segue presa em `GOAL_MAX` (90): nunca é gol garantido. `skPow` multiplica a velocidade do chute; `skAfterShot` marca rebote (Voleio, o goleiro sempre espalma), curva (Curvado) e a cor do rastro (`b.skCol`).
- **Duelo:** `skDribP` (Monstro +25%), `skDodge` (Pantera passa pelo 1º bote), `skDribWon` (+5% no chute por drible, até +15%, que vai junto no passe via `skGenius`).
- **Velocidade:** `skSpdK` no `runSpeed` (Pantera, Reta, Energia); o teto absoluto `RUN_MAX × RUN_HARD_K` (×1,4) continua valendo. **Ego:** `skStatK` no `cmul` (+12% em tudo por 8 s).
- **Visual:** `drawSkills(ctx, 0|1)` (linhas de visão, rastro vermelho/branco das arrancadas, muralha azul na frente do gol, caminho da Visão, silhueta de monstro, raios da Energia, linhas de velocidade, linha dourada/régua/zigue-zague dos passes), Ninja translúcido (`skAlpha`), explosão do Voleio e `drawSkillBanner` (faixa pequena com nome e jogador, na cor da raridade, no lado do time; Visão escurece o topo, Ego escurece a tela com "EGO"). Evento `onEvent("skill", { team, id, name, who })` e linha no log.

**Quando usar (v639, Mickey: "usadas do nada")**, limites em `C.SKILL_USE`: Ego só com a bola a menos de `egoGoal` (420 px) do gol; Visão de Jogo a menos de `visaoGoal` (560) e com um aliado bom à frente (`skBest`); Energia Infinita perto do gol (`energiaGoal`) ou com energia média do time abaixo de `energiaLow`; Passe Mágico e Calibrado só para quem fica a menos de `passTo` do gol, `passGain` à frente de quem passa e livre (`openness > passOpen`, `skGood`); Drible do Monstro só com marcador à frente e a menos de `monstroGoal` do gol, e o efeito acaba ao soltar a bola ou após `dur` (6 s); Arrancadas não saem do campo de defesa (`panteraMax`, `retaMax`).
