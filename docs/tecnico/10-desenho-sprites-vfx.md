# 10 · Desenho, sprites e VFX

Documentação do que o canvas da partida desenha: ordem do quadro, perspectiva do estádio, sprites animados, partículas e efeitos, HUD e placas de LED. Conferida contra o código na **BL.BUILD "226"** (`game/js/config.js`). A fonte da verdade é o código; se algo aqui divergir, vale `game/js/engine.js`.

Arquivos envolvidos:

| Arquivo | O que tem |
|---|---|
| `game/js/engine.js` | Tudo do desenho da partida: `IMG`, `K`, `VIEW`, `proj()`, `BL.spriteImg`, `Match.draw`, `drawSprite`, `spriteAt`, `at()`, `emit`/`drawParts`, `footFx`, `drawLed`, `drawHud`, `energyBar`, `camStep`, `shake`. |
| `game/js/config.js` | `C.SPRITES` (sprites e folhas), `SPRITE_PX`, `SPRITE_FEET`, `SPRITE_CYCLE`, `SPRITE_RUN_FPS`, `GK_SPRITE`, `CAM_ZOOM`, `RUN_MAX`, `GAME_SPEED`, `BOSS_SPEED`, `arena` dos Bosses. |
| `game/js/ui.js` | `frame()` (laço de desenho), `fit()`, `spr()`/`tok()` (sprite em cards), `wcDraw()` (canvas do Wildcard). |
| `game/css/style.css` | `.has-spr`, `.spr`, `.pitch-wrap` (proporção do canvas). |
| `game/img/` | `campo.jpg`, `sprites/*.png`. |
| `dev/sprites/` | Scripts Python que padronizam as folhas (`seg.py`, `build.py`, `run.py`, `gk.py`, `idle_from_kick.py`) e os originais dos estádios em `src/`. Fora do jogo publicado. |
| `docs/sprites/` | Prompts para o gerador de imagem (`prompts-animacoes-isagi.md`, `prompts-goleiro-robo.md`, `prompt-estadio.md`, `prompt-estadio-inclinado.md`). |

Pessoa que decide o visual: Mickey (dono do projeto). Ele envia a arte; o Claude não desenha pixel art, só padroniza e integra.

---

## 1. Regras fixas do projeto (valem para qualquer mudança de desenho)

1. **Legibilidade para sprites em pixel art.** O desenho foi pensado para o sprite ser lido em movimento. Por isso a corrida é limitada: `C.RUN_MAX = 210` px/s para jogador de linha, aplicado em `Match.runSpeed(e)` com `Math.min(C.RUN_MAX, (180 + 2·IV velocidade) · 0.85)`. **O nível não aumenta a corrida**: nível pesa em disputa, passe e chute, não na velocidade. O teto nunca cresce com o nível. Goleiro: `250 · 0.85`. O burst (arrancada) multiplica por 1,25 e cansaço reduz.
2. **Jogo em velocidade 1×.** `C.GAME_SPEED = 1` e `C.BOSS_SPEED = 1` são fixos; o jogador não muda a velocidade (`game.js` passa `speed` ao `BL.Match`, `this.speed` multiplica o acumulador de passos em `update`). Animações e durações de VFX foram calibradas para 1×.
3. **Câmera fixa, campo inteiro visível.** O Mickey recusou a câmera que segue a bola (v220/v221). Por "câmera" ele queria dizer o **ângulo de visão** (3/4 inclinado, como no mockup dele), não zoom. A câmera de seguir ainda existe no código (`camStep`, `C.CAM_ZOOM = 1.6`) mas está desligada, ver seção 7.
4. **Jogadores na escala ×1.** `IMG.persp.spr = 1`. Com `spr = 1.3` (v222) ficaram grandes demais; o Mickey pediu campo maior e jogadores menores e a v223 voltou para 1.
5. **Sprite sempre olhando para a direita no arquivo.** O motor espelha (`face = -1`) para a esquerda. Folhas novas têm que seguir isso.
6. **Números de equilíbrio e de arte ficam em `config.js`.** Nada de mágico novo solto no `engine.js` quando for um parâmetro de arte reutilizável (as folhas de animação são o exemplo).

---

## 2. Espaços de coordenadas e ordem de desenho de um quadro

### 2.1 Os quatro espaços

| Espaço | Origem e unidade | Onde é usado |
|---|---|---|
| **Campo (unidades do motor)** | `W = 1079` × `H = 560`, origem no canto superior esquerdo da linha de fundo do gramado. Física, IA, `e.x/e.y`, `ball.x/y`. Gol: `GH = 129` (boca entre `MOUTH_T = H/2 − GH/2` e `MOUTH_B`), `PAD = 36`. | `step()`, física, posições dos efeitos. |
| **Imagem (pixels de `campo.jpg`)** | 1672 × 941. | Tudo que é desenhado entre `ctx.translate(VIEW.x, VIEW.y); ctx.scale(K, K)` (linha em `draw`, só com `IMG.persp`) e o fim do bloco de textos flutuantes. Placas de LED, rastro, fx, partículas, jogadores, bola. |
| **Tela do jogo (VIEW)** | Unidades do campo, mas com a origem deslocada para mostrar a imagem inteira. `K = W / IMG.fw = 1079 / 1358 ≈ 0,7946` converte pixel da imagem em unidade do campo. `VIEW = { x: −fx·K, y: −fy·K, w: 1672·K, h: 941·K }` ≈ `{ −124,7; −118,8; 1328,5; 747,7 }`. | Escala do canvas (`s`), HUD, letreiros grandes. O fundo da VIEW é a imagem inteira. |
| **Canvas (pixels do navegador)** | `canvas.width/height`, definidos em `ui.js > fit()` pelo tamanho do `.pitch-wrap` × `devicePixelRatio`. `.pitch-wrap` tem `aspect-ratio: 1672 / 941`. | `draw(ctx, cw, ch)` calcula `s = min(cw/VIEW.w, ch/VIEW.h)` e `ox/oy` para centralizar. |

`IMG.fx = 157`, `IMG.fy = 149.5`, `IMG.fw = 1358` existem **só para o layout da tela** (posição do HUD e dos letreiros, herdados da v219). A posição real do gramado na imagem vem de `IMG.persp`, não desses três.

### 2.2 Ordem em `Match.draw(ctx, cw, ch)`

Chamada de `ui.js > frame()` a cada `requestAnimationFrame`, logo depois de `m.update(dt)`. Em ordem:

1. `ctx.clearRect`, `translate(ox, oy)`, `scale(s, s)`: entra no espaço VIEW.
2. **Tremida de tela** (`shakeT > 0`): `translate(rand(−k, k), rand(−k, k))` com `k = shakeMag · (shakeT / shakeDur)`. Vale para tudo até o passo 17.
3. **Câmera** `camStep()`: se `cam.z > 1.001` aplica zoom e centro. Com a perspectiva ativa `cam.z` fica em 1 e nada muda.
4. **Fundo**: `drawImage(fieldImg, VIEW.x, VIEW.y, VIEW.w, VIEW.h)`. `imageSmoothingEnabled = K·s·cam.z < 1` (reduzido: suavizado; ampliado: pixel nítido).
5. **Arena de Boss** (se `this.arena`): por cima da imagem inteira, `fillRect` com `arena.tint`, depois degradê horizontal `arena.grad` (lista de cores, só o Estádio Nacional U-20 usa) e vinheta radial `arena.vignette` com `globalAlpha = 0,8 + 0,2·sin(Date.now()/900)` (respira). Ver seção 9.
6. **Fallback sem imagem** (enquanto `campo.jpg` não carrega): gramado em degradê, listras, linhas e gols desenhados em código (bloco `else` do passo 4). Existe só para o instante de carga; não é calibrado para a perspectiva.
7. `translate(VIEW.x, VIEW.y); scale(K, K)` (só com `IMG.persp`): **a partir daqui as coordenadas de desenho são pixels da imagem**, e cada objeto se posiciona com `this.at()`.
8. `drawLed(ctx, boss)`: texto das placas de LED (seção 8).
9. **Rastro da bola** (se não há dono e `trail.length > 2`): fita que afina, `at(…, ground = true)`. Chute no modo duelo (`duelMode`) usa cor do time e duas passadas (cor + miolo branco).
10. **Efeitos de parede** (`this.fx`, exceto texto): `spark`, `ring`, `dust`, `impact`, `wave`, `pop`, `swoosh`, `net`, `burst`. Com `IMG.persp`, `net` é pulado (a rede da imagem inclinada já tem volume).
11. `drawParts(ctx, false)`: partículas **no chão** (poeira), por baixo dos jogadores.
12. **Imagem residual** (`ghost`, só `duelMode`): ver seção 6.2 (linha Imagem residual).
13. **Jogadores e goleiros**, ordenados por `y` crescente (`[...this.ents].sort((p, q) => p.y − q.y)`): quem está mais perto da câmera (maior `y`) é desenhado por cima. Para cada um: `drawSprite` (ou círculo com iniciais), barra de energia (sem nome desde a v354), seta do condutor, estrela de atordoado.
14. **Bola**: sombra, círculo branco com brilho, gomos que giram, contorno. Quando o goleiro segura, a bola é desenhada nas mãos dele (`e.gkBall`).
15. `drawParts(ctx, true)`: partículas **no ar** (faíscas, lascas, confete), por cima de tudo.
16. **Textos flutuantes** (`fx.kind === "text"`).
17. `ctx.restore(); ctx.save(); translate(ox, oy); scale(s, s)`: **sai da tremida, da câmera e do espaço da imagem. O HUD fica em unidades VIEW, fixo na tela.**
18. `drawHud(ctx, boss)`: minimapa e card do condutor, sobre a mureta de baixo.
19. **Sobreposições grandes** (`big()`): GOL!, INTERVALO, GOLDEN GOL, FIM DO TREINO, VITÓRIA/DERROTA, e a faixa "GOLDEN GOL" durante os primeiros 2,6 s de morte súbita. `ctx.restore()` final.

Resumo da regra: **mundo (passos 4 a 16) treme e (se ligada) segue a câmera; HUD e sobreposições (17 a 19) não tremem nem dão zoom.**

---

## 3. O campo atual: estádio inclinado (`img/campo.jpg`)

### 3.1 O que é a imagem

- `img/campo.jpg`, 1672 × 941, **estádio em vista 3/4 do Mickey (v222), câmera fixa mostrando o campo todo**. Atrás do campo: placas de LED em branco, arquibancada de torcida azul e branca. À frente: mureta baixa escura com neon azul (onde mora o HUD).
- Histórico: v199/v218 estádio reto, v219 estádio reto do Mickey (esticado 12,2% na vertical), v221 reto de cima, **v222 inclinado**, v223 recorte atual (cortou 150 px de arquibancada e esticou ×1,34 só as linhas do gramado, y 332..773 do original viram 182,5..772,5; a mureta de baixo ficou igual). Originais em `dev/sprites/src/estadio-inclinado-original.png` e `estadio-original.png`; versões antigas em `dev/old-img/`. `img/hero.jpg` (mesmo tamanho) é a imagem da tela inicial, não é usada no campo.
- A imagem **não tem trapézio de ponto de fuga puro**: as linhas laterais convergem de forma suave (`persp` descreve isso). O pedido original ao gerador pedia retângulo achatado; o que o Mickey mandou veio com perspectiva e o jogo se adaptou.

### 3.2 `IMG.persp` (valores e significado)

```js
persp: { yf: 182.5, yn: 772.5, b: 512.3, a: 77.7, lf: 140.3, rf: 1531.7, ln: -11, rn: 1683, spr: 1,
  led: { y: 133, h: 23, B: [[192,190],[446,215],[725,221],[1010,215],[1289,190]] } }
```

Todos em **pixels da imagem**:

| Chave | Significado |
|---|---|
| `yf` | `y` da **linha de fundo** (lateral distante) do gramado. |
| `yn` | `y` da **linha da frente** (lateral próxima). `yn − yf` = 590 px. |
| `b`, `a` | Curva da profundidade. Com `v = y/H` (0 no fundo, 1 na frente), o `y` da imagem é `Y = yf + b·v + a·v²`. Tem que valer `yf + b + a = yn` (182,5 + 512,3 + 77,7 = 772,5). `a > 0` faz o fundo parecer mais comprimido que a frente. |
| `lf`, `rf` | `x` esquerdo e direito do campo na linha de fundo (140,3 e 1531,7). |
| `ln`, `rn` | `x` esquerdo e direito na linha da frente (−11 e 1683; saem um pouco da imagem). As laterais são retas entre `(lf,yf)→(ln,yn)` e `(rf,yf)→(rn,yn)`. |
| `spr` | Escala extra dos objetos **de pé** (jogadores, bola, textos). **1 = escala natural.** Foi 1,3 na v222 (grande demais). |
| `led.y`, `led.h` | Posição e altura das placas de LED, em pixels da imagem. |
| `led.B` | Lista `[x, largura]` das 5 placas em branco usadas hoje (pixels da imagem). |

### 3.3 `proj(x, y)`

Leva um ponto do chão do motor ao pixel da imagem:

```
v = y/H;  Y = yf + b·v + a·v²;  t = (Y − yf)/(yn − yf)
l = lf + (ln − lf)·t;  r = rf + (rn − rf)·t;  k = (r − l)/W
retorna { x: l + (x/W)·(r − l),  y: Y,  k,  g: (b + 2a·v)/H / k }
```

- `k` = pixels da imagem por unidade do campo **na horizontal** naquela profundidade (1,29 no fundo, 1,42 no meio, 1,57 na frente).
- `g` = quanto o **chão achata na altura** em relação à largura (0,71 no fundo, 0,74 no meio, 0,76 na frente). Vertical efetivo = `k·g`.
- Não é homografia exata, é um mapeamento calibrado à mão: horizontal por interpolação linear entre as laterais, vertical por parábola em `v`.

Valores calculados (conferem com a fórmula):

| `v` | `Y` | `l` | `r` | `k` | `g` |
|---|---|---|---|---|---|
| 0 (fundo) | 182,5 | 140,3 | 1531,7 | 1,290 | 0,709 |
| 0,5 (meio) | 458,1 | 69,6 | 1602,4 | 1,421 | 0,742 |
| 1 (frente) | 772,5 | −11,0 | 1683,0 | 1,570 | 0,759 |

### 3.4 `Match.at(ctx, x, y, ground, ay = y)`

Prende o desenho a um ponto do chão. Faz `ctx.save()`, calcula `proj(x, ay)` e aplica `translate(p.x, p.y); scale(sx, sy); translate(−x, −ay)`. **Quem chama é obrigado a fechar com `ctx.restore()`.** Depois disso, o código desenha com as coordenadas normais do motor (`e.x`, `e.y`) e elas caem no pixel certo.

- `ground = true`: `sx = k`, `sy = k·g`. Para coisas **deitadas no chão** (rastro da bola, `spark`, `ring`, `dust`, `impact`, `pop`, e a imagem residual sem sprite).
- `ground = false` (padrão): `sx = sy = k·spr`. Para coisas **de pé** (jogadores, bola, textos, partículas, `wave`, `swoosh`, `burst`).
- `ay` é o ponto de âncora vertical (padrão `y`). Jogador usa `ay = e.y + SPRITE_FEET` (os pés), bola usa `b.y + BALL_R`, bola nas mãos do goleiro usa `goleiro.y + SPRITE_FEET`.
- Sem `IMG.persp`, `at()` só faz `ctx.save()` (modo reto antigo).

### 3.5 Como recalibrar se a imagem do campo mudar

1. Trocar `img/campo.jpg` e ajustar `IMG.w`, `IMG.h` (e `fx/fy/fw` só se o layout do HUD tiver que mudar; `K` e `VIEW` dependem deles). A proporção do canvas vem de `.pitch-wrap { aspect-ratio: 1672 / 941 }` no CSS: mudar junto se o tamanho mudar.
2. Medir na imagem nova, em pixels: `yf` (lateral de cima do gramado), `yn` (lateral de baixo), `lf/rf` (x dos cantos de cima), `ln/rn` (x dos cantos de baixo, podem ficar fora da imagem), e `Ym` = `y` da linha do meio-campo.
3. Fechar a curva: com `D = yn − yf`, `a = 2·D − 4·(Ym − yf)` e `b = D − a`. (Hoje `Ym ≈ 458,1`.)
4. Colocar as 5 placas de LED em `led.y`, `led.h` e `led.B` (`[x, largura]`).
5. Conferir no jogo: jogador na linha de fundo deve ter os pés na lateral de cima; o círculo central e as áreas do motor (130 × 240 em cada lado, círculo de raio 70) têm que cair nas marcas da imagem; as bocas de gol (`MOUTH_T..MOUTH_B`, 129 de altura) nas traves desenhadas.
6. Se o campo desenhado tiver proporção diferente da do motor (1079 × 560), o gramado fica deformado. A v219 esticou 12,2% na vertical para casar a imagem com o motor; a v223 esticou ×1,34 as linhas do gramado. O motor (física) não muda por causa da imagem.

### 3.6 Outros campos (v312, Seus mapas)

`C.PITCHES` (config.js) traz, para cada campo além do Estádio, `img` (`img/campos/{floresta,deserto,rua,espaco}.jpg`, 1672 × 941, imagens do Mickey) e o próprio `persp`, medido como em 3.5 (cantos das linhas e `Ym` = centro do círculo central). `BL.setPitchImg(pitch)` (engine.js) troca `IMG.persp` e a imagem `fieldImg` quando a partida começa; o Estádio volta para a calibragem original. Só o Estádio tem placas de LED (`persp.led`): nos outros `drawLed` não é chamado. O fundo do card do mapa no painel usa a imagem do campo escolhido (`--dm-img`, com URL absoluta desde a v313: relativa, era lida a partir de `css/` e o card ficava vazio).

O pedido original ao gerador de imagem está em `docs/sprites/prompt-estadio-inclinado.md` (placas de LED vêm em branco; o texto é o jogo que escreve).

---

## 4. Sprites

### 4.1 Quem tem sprite

`C.SPRITES` em `config.js`, chave = `charId` do personagem (`yoichi-isagi`), mais a chave do Boss diário (`isagi`) e o goleiro (`gk-robo`):

| Chave | Conteúdo | Usado onde |
|---|---|---|
| `"yoichi-isagi"` | `card`, `field`, `run` (+ `runFrames`, `runPx`, `runFx`, `idle`) e `anim` com **8 animações**. | Campo, Wildcard, cards, HUD. |
| `btter`, `bunny-iglesias`, `don-lorenzo`, `hugo-vivian`, `lockhart` (v340), `marin`, `mickey` (v341), `onazi-innocent`, `ratoworld` (v342), `riq`, `sae-itoshi` (v343), `rin-itoshi` (v573), `teddy-knight` (v344), `meguru-bachira` (v347, `al=True`), `hyoma-chigiri` e `rensuke-kunigami` (v348; faltam folhas: Chigiri usa chute no passe e corrida no drible; Kunigami usa drible na corrida e parado na comemoração), `shoei-barou` (v346; folha única 3×3 em dev/sprites/src/barou-folha.png, recortada por painel; chute 6 e bote 5 quadros via `n` no `novos.py`), `seishiro-nagi` (v345; folhas em grade 2 linhas sem título, roupa preta: `al=True` usa só o alfa como fundo e `hh` por folha iguala a escala) (v343: Sae também na chave `sae` do Boss diário) | Mesmo formato do Isagi (`card`, `field`, `run` e as 8 animações). | Campo, Wildcard, cards, HUD. |
| `isagi` | Só `card` e `field` (sem animação). | Chave do **Boss diário** (`C.BOSS` rotação, `id: "isagi"`), lida por `spr(b.id)` nas telas de Boss e roleta. Em campo nunca é usada: os jogadores vêm de `makePlayer(charId)`. |
| `"gk-robo"` | Só `anim`, **7 animações**. | Os dois goleiros (`C.GK_SPRITE = "gk-robo"`). |

Quem não tem entrada continua com o **círculo com as iniciais** em todo lugar (campo: círculo azul/branco + iniciais; menus: `.token` colorido). Hoje têm sprite o Isagi, os 9 personagens da v340 a v342 e o goleiro.

Arquivos em `img/sprites/`: `isagi.png` (card, 56×52, com a bola do desenho), `isagi-campo.png` (56×52, **sem a bola**, usado como `im` base e no gate `BL.fieldSprite`), `isagi-corrida.png`, `isagi-parado.png`, `isagi-chute.png`, `isagi-passe.png`, `isagi-drible.png`, `isagi-bote.png`, `isagi-carrinho.png`, `isagi-atordoado.png`, `isagi-comemoracao.png`, `gk-parado.png`, `gk-lateral.png`, `gk-segurando.png`, `gk-reposicao.png`, `gk-defesa.png`, `gk-espalmada.png`, `gk-levougol.png`.

### 4.2 Formato das folhas

- **Uma única fileira horizontal** de `n` quadros do mesmo tamanho (largura do quadro = `imagem.width / n`), PNG com transparência, **olhando para a direita**, **sem bola desenhada** (a bola do jogo é desenhada à parte), sem sombra no chão.
- Padronizadas por `dev/sprites/*.py`: componentes conexas numa grade conhecida, escala LANCZOS para a posição em pé ter **144 px** de altura (goleiro: 150 px, escalado pela largura da cabeça), pés alinhados na base de cada fileira, cabeça alinhada entre quadros (âncora = centroide da cabeça).
- `px = 0.5` (`anim.px`): cada pixel da folha vale 0,5 unidade do campo. Isagi em pé: 144 × 0,5 = **72 unidades de altura** (o círculo antigo tem 34 de diâmetro). `SPRITE_PX = 1.15` vale só para o sprite pequeno `field`/`card` (52 px ≈ 60 unidades) e para sprites sem `anim`.
- `imageSmoothingEnabled = px < 1` em `spriteAt`: folha reduzida (0,5) é suavizada; desenho ampliado (1,15) fica nítido.

Folhas do Isagi (`anim`; `hh: 75`):

| Chave `anim` | Arquivo | `n` | Quadro (px) | `fx` | `d` (s) | `from` | `fps` | Quando toca |
|---|---|---|---|---|---|---|---|---|
| `idle` | `isagi-parado.png` | 4 | 198×151 | 24 | | | 4 | parado (laço). Provisório: quadro em pé do chute + respiração (`idle_from_kick.py`). |
| `shot` | `isagi-chute.png` | 8 | 198×151 | 24 | 0,4 | 3 | | chute (`kickKind = "shot"`). |
| `pass` | `isagi-passe.png` | 6 | 174×145 | 24 | 0,36 | 1 | | qualquer outro `kickKind` (passe). |
| `drib` | `isagi-drible.png` | 8 | 224×147 | 35 | 0,55 | 0 | | drible bem-sucedido (`dribT`). |
| `tack` | `isagi-bote.png` | 6 | 238×158 | 27 | 0,45 | 1 | | roubada de bola (`tackT`). |
| `slide` | `isagi-carrinho.png` | 6 | 212×154 | 7 | | | | carrinho (`slide`/`slideT`), controlado por tempo, ver abaixo. |
| `stun` | `isagi-atordoado.png` | 6 | 224×156 | 25 | | | | atordoado (`stun`). |
| `celeb` | `isagi-comemoracao.png` | 8 | 154×182 | 18 | 1,8 | 0 | | comemora o gol (`celebT`). |

Corrida: `run: isagi-corrida.png`, `runFrames: 8` (quadro 228×150), `runPx: 0.5`, `runFx: 52`, `idle: 0` (quadro usado se parar sem a folha `idle`). A passada avança pela **distância percorrida**, não pelo tempo (ver 4.4).

Folhas do goleiro robô (`gk-robo.anim`, `hh: 78`):

| Chave | Arquivo | `n` | Quadro (px) | `fx` | `d` | `from` | `fps` | Quando toca |
|---|---|---|---|---|---|---|---|---|
| `idle` | `gk-parado.png` | 4 | 146×154 | 14 | | | 4 | parado. |
| `side` | `gk-lateral.png` | 6 | 166×131 | 22 | | | 10 | andando pela linha (passo lateral). |
| `hold` | `gk-segurando.png` | 4 | 142×151 | 16 | | | 4 | segurando a bola (mãos vazias na folha; a bola é desenhada à parte). |
| `kick` | `gk-reposicao.png` | 6 | 184×141 | 11 | 0,45 | 3 | | reposição (`kickT`). |
| `catch` | `gk-defesa.png` | 6 | 192×129 | 19 | 1,0 | 1 | | defesa segurando (`saveKind = "catch"`). |
| `parry` | `gk-espalmada.png` | 6 | 248×142 | 8 | 0,8 | 1 | | espalmada (`saveKind = "parry"`). |
| `miss` | `gk-levougol.png` | 6 | 222×124 | 14 | 1,6 | 1 | | levou gol (`missT`). |

Significado dos campos da folha:

- `n`: número de quadros. `src`: caminho.
- `fx`: quanto (px da folha) os **pés ficam atrás do centro do quadro**. O desenho é empurrado `fx · px` para a frente (`ox += fx·px`, com `face` já aplicado) para os pés pisarem no anel do time (v214: antes a sombra ficava fora do personagem). **Medir `fx` em cada folha nova** (centro do quadro menos o x dos pés).
- `d`: duração em segundos de uma passada única da animação (tocada de `from` ao último quadro, em `seq()`).
- `from`: primeiro quadro tocado. Pula a preparação para a ação aparecer na hora (chute: a bola sai no mesmo instante em que `kickT` é marcado, então começa no quadro 3).
- `fps`: velocidade do laço (`idle`, `side`, `hold`), em `loop()`: `floor(now · fps · mult + seed) % n`. `seed` é aleatório por jogador (cada um respira fora de fase).
- `hh` (no nível de `anim`): altura usada para posicionar a **barra de energia** acima da cabeça (`e.sprHH`).

### 4.3 Como `drawSprite(ctx, e, im, col, hasBall, boss)` escolhe a animação

Chamada para cada jogador/goleiro que tem imagem `field` (jogador: `BL.fieldSprite(e.p.charId)`; goleiro: `BL.spriteImg(C.GK_SPRITE, "a:idle")`). Sem imagem carregada, cai no círculo.

Pré-processamento (v211, anti-tremedeira):

- **Direção** (`e.face`, 1 ou −1): só vira se `|vx| > 25`, o jogador não está atordoado e passaram 0,2 s desde a última virada (`faceT`). Goleiro sempre olha para o campo (`this.dir(team)`).
- **Parado × correndo com histerese**: `sp0 = min(1, velocidade/160)`; passa a "correndo" acima de 0,2 e a "parado" abaixo de 0,08, e só troca se passaram 0,15 s (`mvT`). `run = max(sp0, 0.16)` correndo, `min(sp0, 0.15)` parado. O goleiro não tem `vx/vy`: usa a variação de `y` por segundo (`gv`).
- **Pré-carga**: na primeira vez, `e.sprPre` dispara `BL.spriteImg(sid, "a:" + nome)` para todas as folhas (evita mostrar o desenho antigo no primeiro chute).
- `hitT`/`stunMax`: quando `e.stun` sobe, guarda a duração do atordoamento.

**Jogador de linha com `anim`**, prioridade da maior para a menor:

1. **Carrinho**: `e.slide > 0` ou (`e.stun > 0` e `slideT` há menos de 1,1 s). Quadro por tempo: `1 + min(2, floor((now − slideT)/0.3·3))` enquanto desliza (quadros 1 a 3); depois do carrinho atordoado: quadro 3 se `stun > 0,22`, senão 4 (levanta).
2. **Comemoração**: `celebT` nos últimos `celeb.d` (1,8 s). `scoreGoal` marca `celebT = max(time, kickT + shot.d)`, ou seja, começa quando o chute termina.
3. **Drible**: `dribT` nos últimos 0,55 s (quem **passou** pelo marcador).
4. **Bote**: `tackT` nos últimos 0,45 s (quem roubou).
5. **Chute/passe**: `kickT` nos últimos `d` da folha (`shot` 0,4 s se `kickKind === "shot"`, senão `pass` 0,36 s).
6. **Atordoado**: `e.stun > 0`. Progresso `kk = 1 − stun/max(stun, stunMax)`. Atordoamento longo (`stunMax ≥ 0,55`): quadros `[0,1,2,3,3,4,5]` (vai ao chão e levanta); curto: `[0,1,1,0]` (cambaleia).
7. **Parado** (`run ≤ 0,15`): folha `idle` em laço.
8. Senão (correndo): `strip = null` e usa a **folha de corrida** `run` (`sheet`), quadro pela distância.

**Goleiro** (`an && e.gk`), prioridade: `miss` (`missT`, setado em `scoreGoal` no goleiro que levou) > `kick` (`kickT`) > defesa (`saveT` com `saveKind` `catch`/`parry`, setados em `keeperCatch`) > preparo da reposição (`hasBall && hold < 0,3`: usa a folha `kick` nos quadros 1 e 2) > `hold` (com a bola) > `side` (andando, `fps` ajustado por `0,6 + run·0,6`) > `idle`. Se a folha não carregou, usa `idle` quadro 0.

**Bola nas mãos do goleiro**: `e.gkBall = [dx, dy]` (relativo aos pés, `dx` espelhado por `face`): `catch` usa uma tabela por quadro (`[30,−40]`, `[30,−40]`, `[28,−16]`, `[28,−16]`, `[10,−34]`, `[10,−42]`), `kick` quadro 1 `[14,−30]` e demais `[18,−14]`, `hold`/outros `[10,−42]`. `draw` lê `gkBall` para posicionar a bola.

**Sem `anim`** (personagem que tenha só `field`/`run`, ou folha ainda não carregada): poses **procedurais** sobre `field`/`run`: carrinho deitado (`rot −1,3`), pulinhos na comemoração, giro no drible (`sx = cos`), inclinação no bote, rotação no chute (`−0,28` até `+0,22`), tremida no atordoamento, balanço e leve inclinação na corrida, "respirar" parado. Quem tem `run` mas não `anim` usa a folha de corrida.

**Quadro de corrida**: `e.runPh = (runPh + max(velocidade, 90) · dt · N / SPRITE_CYCLE) % N`. `SPRITE_CYCLE = 120` unidades = um ciclo completo (2 passadas) da folha de 8 quadros; o pé acompanha o chão em vez de "patinar". Mínimo de 90 para o drible no lugar andar.

### 4.4 O que `drawSprite` desenha, na ordem

1. **Anel do time nos pés**: elipse em `(e.x, e.y + SPRITE_FEET − 4)`, raio `r + 1` × 6. Preenchimento: time 0 `rgba(20,108,255,.45)`; time 1 `rgba(242,245,255,.35)` (ou `rgba(255,176,46,.35)` se Boss). Contorno `col.ring`: ciano `#26D9FF` (time 0), branco `#f2f5ff` (time 1; o anel `#0A1124` do círculo é trocado), âmbar `#ffb02e` (Boss). **Shiny: anel dourado `#ffd23f`.** Goleiro: amarelo `#ffd23f` do nosso time, rosa `#ff4f8b` do adversário (em treino o goleiro "dono" também é amarelo).
2. **Aura de quem tem a bola**: segunda elipse pulsante com `teamRGB`, `0,35..0,70` de alpha.
3. **Sombra de contato** (v209; sem ela o desenho parecia flutuar): elipse preta `0,42` de alpha, largura 17 (30 se deitado); encolhe e clareia quando o jogador pula (`air = max(0, −oy)`).
4. **Fade entre folhas** (v211): quando a imagem muda (parado para corrida, para chute…), o último quadro da folha anterior (`e.sprLast`) é desenhado com alpha `(1 − k)·0,85` por 0,1 s por baixo do novo, em vez de corte seco.
5. **O sprite**, com `shadowBlur 10` na cor do time quando está com a bola, e **lampejo branco** (`filter brightness(2.2) saturate(0.3)` por 0,12 s depois de `hitT`) quando leva drible ou roubo.

`spriteAt(ctx, im, x, y, face, rot, ox, oy, sx, sy, fi, n, px)` faz o desenho cru: `translate(x, y + SPRITE_FEET)`, espelha por `face`, aplica deslocamento/rotação/escala e `drawImage` do quadro `fi` com a base nos pés. `e.spr = { im, fi, n, rot, px }` guarda o último quadro desenhado (usado pelo rastro).

### 4.5 Escala, pés e ordenação

- **Escala**: `px` (0,5) × `k·spr` do `at()` (≈1,29 a 1,57 vezes, `spr = 1`). Isagi em pé: 72 unidades × k = **93 a 113 pixels da imagem** de altura. A escala por profundidade é automática, não precisa de código por personagem.
- **Pés**: `C.SPRITE_FEET = 14` unidades abaixo do centro do jogador. A bola e as colisões ficam no **centro** (raio `PR = 17`, goleiro 19); só o desenho é deslocado. `at()` ancora em `e.y + SPRITE_FEET`.
- **Ordenação por `y`**: no passo 13, `ents` ordenados por `p.y − q.y`. Goleiro está em `ents`, então entra na mesma ordenação. Empates e sprites de tamanhos diferentes não têm tratamento extra.
- **Nome, energia e seta** ficam no mesmo `at()` do jogador. Nome (`short` em caixa alta, `700 12px Manrope`) em `e.y + e.r + 12`. Energia e seta ficam acima da cabeça: `ey = e.y + SPRITE_FEET − sprHH − 9`.

### 4.6 Onde `ui.js` usa sprites fora do campo

- `spr(id)` devolve `<img class="spr" src="…card">` se há `C.SPRITES[id]`; `tok(id, iniciais, cor, cls)` devolve o `.token.has-spr` com o sprite, ou o token colorido com iniciais. Usados nos cards do elenco, Boss (`.bo-sprite`), roleta (`.rl-badge`), Wildcard (`.wc-slot`, `.wc-row`), Exploração, ranking de Boss, drops, e o `pc-badge` do card de jogador.
- CSS (`style.css`): `.has-spr` tira fundo, borda, sombra e recorte do token (o sprite sai "solto"); `.has-spr .spr { width/height: 122% }` com `drop-shadow`; Shiny ganha brilho dourado; no Boss e na roleta `image-rendering: pixelated`.
- **HUD de transmissão** (`drawHud`): retrato do condutor usa `BL.spriteImg(p.charId, "card")` com `imageSmoothingEnabled = false`.
- **Canvas do Wildcard**: `wcDraw(now)` em `ui.js` (laço próprio, `wcRaf`; só desenha se `#wcCanvas` está visível, `cv.offsetParent`). Cinco cenas (`WC_SCENES`: academia, chutes, cones, passe, defesa) trocam a cada `C.WILDCARD_SCENE_SECONDS`. Cada jogador do Wildcard (`G.wcPlayers()`) é um sprite 2D simples: sem `at()`/perspectiva, olhando para onde anda (`wcFace`), parado usa a folha `idle` (`a:idle`) em laço, andando usa a folha `run` a `C.SPRITE_RUN_FPS = 13` quadros/s (não segue distância como em campo), sem `anim` usa o desenho `field` com balanço. Escala por `px = (rad·3,4/52) · px_folha / SPRITE_PX` (referência: 52 px = altura do desenho do chute), `fx` aplicado para os pés caírem no lugar. Sem sprite: círculo da raridade com iniciais. Efeitos próprios do Wildcard: `wcBurst` (7 partículas + anel + "+XP" subindo), array `wcFx`, limite de 300.

### 4.7 Como adicionar um personagem novo

**Plano do projeto** (ainda não implementado; confirmar com o Mickey): **corpo base + troca de cabeça**. Como todas as folhas do Isagi têm a **cabeça alinhada entre os quadros** (âncora = centroide da cabeça, feita em `build.py`) e o corpo em uniforme/pose padrão, a ideia é reaproveitar as 8 folhas e só trocar a cabeça por personagem (por exemplo, compondo a cabeça no carregamento da folha em um `canvas` fora da tela e guardando o resultado no cache `SPR`). Hoje cada personagem precisaria de todas as folhas próprias.

**Caminho rápido (v340): `dev/sprites/novos.py`.** O Mickey manda 9 folhas por personagem (carrinho, chute, comemoração, drible, parado, passe, bote/roubo, corrida, atordoado), fundo preto, título em cima, uma linha de quadros (ou grade de 2 linhas). O script tira o fundo, separa os quadros (contagem fixa em `N`; componentes conexos, pedaços soltos vão para o boneco mais perto, bonecos grudados são cortados no vale de pixels), padroniza (quadro neutro = `h` px, 144; Don Lorenzo 132 porque fica curvado), gera `card` 56×52 e `campo` a partir do parado, reduz para 256 cores e grava `dev/sprites/novos/info.json` com `n`, `FW` e `fx`. Para um personagem novo: acrescentar a entrada em `CH` (ids dos uploads e `(id, 2)` para grade de 2 linhas) e rodar `python3 novos.py <id>`. Corrida e atordoado usam `fx` = mediana dos quadros (o primeiro quadro engana). v341: aceita folha já transparente (pixels com alfa < 128 viram fundo, some a franja vermelha), `neu` por personagem quando o último quadro do carrinho não é em pé (Mickey usa o 1º), bonecos grudados separados por distância dentro do boneco a partir das cabeças, pedaços soltos pelo corpo mais perto, e `FORCE` para corrigir à mão um retângulo que o recorte erra (chute da Marin). v342: as sementes de cada boneco grudado ficam só no topo perto do centro do quadro (senão um tufo de cabelo do vizinho vira semente errada). Depois: entrada em `C.SPRITES` (copiar a do `btter`), id em `C.ACTIVE_CHARS` e nome em `database.js` se ainda não existir.

Passo a passo antigo, para um personagem com folhas completas:

1. Gerar as 8 folhas de ação + corrida no mesmo estilo, usando os prompts de `docs/sprites/prompts-animacoes-isagi.md` com a folha do chute do Isagi como referência de estilo e tamanho (fundo transparente, sem bola, olhando para a direita, pés na mesma linha de base).
2. Padronizar com os scripts de `dev/sprites/` (estado do Isagi como modelo): estância em pé = 144 px, pés na base, cabeça alinhada. Salvar em `game/img/sprites/<nome>-*.png`.
3. Medir `fx` de cada folha (centro do quadro menos x dos pés, em px da folha).
4. Criar o desenho pequeno `card` (com a bola, fundo transparente) e o `field` (sem a bola), por exemplo 56×52.
5. Adicionar em `C.SPRITES`, chave = `charId` do `database.js`:
   ```js
   "novo-id": { card: "…", field: "…", run: "…", runFrames: 8, runPx: 0.5, runFx: 52, idle: 0,
     anim: { px: 0.5, hh: 75, idle:{src,n,fx,fps}, shot:{…}, pass:{…}, drib:{…}, tack:{…}, slide:{…}, stun:{…}, celeb:{…} } }
   ```
6. **Armadilha**: `drawSprite` acessa `an.celeb.d`, `an.drib.d`, `an.tack.d`, `an.shot.d`/`an.pass.d` e `an.idle.fps` sem checar. Se o personagem tiver `anim`, ele **precisa ter as 8 chaves** (`idle`, `shot`, `pass`, `drib`, `tack`, `slide`, `stun`, `celeb`), senão dá erro em tempo de execução. Sem `anim`, só `card` + `field` (+ `run` opcional) funciona, com poses procedurais.
7. Nada mais é necessário: `tok()`/`spr()`, `drawHud`, Wildcard e campo leem `C.SPRITES[charId]` sozinhos.
8. Goleiro específico: criar nova chave com `anim` de 7 folhas (`idle`, `side`, `hold`, `kick`, `catch`, `parry`, `miss`) e trocar `C.GK_SPRITE`. Hoje existe um goleiro genérico para os dois times.

---

v460: aura do Boss em `drawSprite`: antes do anel, se `e.p.boss` e `C.BOSS_AURA[charId]`, gradiente radial pulsando (modo `lighter`) do pé à cabeça (`e.sprHH`), 6 faíscas subindo, e `shadowColor` da aura no sprite.

## 5. Carga de imagens

- `fieldImg` (`campo.jpg`) é criada no carregamento do módulo `engine.js`.
- `BL.spriteImg(id, key = "field")`: devolve a `Image` já carregada ou **`null` até ela chegar**. `key` pode ser `"field"`, `"card"`, `"run"` ou `"a:<nome>"` (folha de `anim`). Cache em `SPR[id + "|" + key]`. `BL.fieldSprite(id)` é atalho para `"field"`.
- Tudo que desenha sprite trata `null` desenhando o fallback (círculo/pose procedural/imagem antiga), então a partida nunca trava esperando imagem.
- Em Node (simulação, sem `Image`) as funções devolvem `null`.

---

## 6. VFX: partículas e efeitos (v217 e seguintes)

Dois sistemas coexistem em `Match`: **`this.fx`** (efeitos de parede, em `update` somem por `t` real) e **`this.parts`** (partículas físicas, até 420). O texto flutuante também é um item de `fx`.

### 6.1 Partículas: `emit(n, x, y, o)`, `stepParts(dt)`, `drawParts(ctx, air)`

Parâmetros de `o` (todos opcionais, com padrão):

| Chave | Padrão | Função |
|---|---|---|
| `a`, `spread` | 0, π | Direção base e abertura (aleatório em `±spread`). |
| `v0`, `v1` | 30, 90 | Velocidade inicial (unidades/s). |
| `l0`, `l1` | 0,3, 0,6 | Vida (s). |
| `r0`, `r1` | 2, 4 | Raio. `grow`: quanto cresce até sumir. |
| `z0`, `z1`, `g` | 0, 0, 0 | Velocidade vertical inicial e gravidade: faz a lasca subir e cair (`z` é altura; ao tocar o chão quica com `−0,25`). |
| `drag` | 3 | Atrito exponencial (`exp(−drag·dt)`). |
| `flat` | 1 | Multiplica `vy` (achata a nuvem de poeira no chão). |
| `alpha` | 1 | Opacidade máxima. |
| `jx`, `jy` | 0 | Dispersão da origem. |
| `col` | `DUST` | `"r,g,b"` ou lista sorteada. Constantes `DUST = "226,220,198"` e `GRASS = ["70,150,55","48,120,40","120,190,80","110,80,45"]`. |
| `shape` | `"dot"` | `dot` (círculo), `chip` (retângulo girando, lasca/confete), `streak` (risco na direção da velocidade, comprimento `min(20, v·0,045) + r`). |
| `air` | `false` | `false` = desenhada no passo 11 (chão, **por baixo** dos jogadores); `true` = passo 15 (**por cima**). |

Alpha final = `min(1, 1,8·t/vida) · alpha` (some no fim). Teto de 420 partículas ao mesmo tempo (`emit` ignora o excedente). `stepParts` roda em `update(realDt)` com tempo real, **independente da velocidade**. `teamRGB(t)`: time 0 `38,217,255`, time 1 `255,79,139`, e `255,176,46` (âmbar) se há Boss.

### 6.2 Catálogo de efeitos

| Efeito | Onde nasce | Como é |
|---|---|---|
| **Poeira dos passos** | `footFx(e, dt)`, chamado em `step()` para quem não é goleiro nem está atordoado. | Se `v > 150`: 1 nuvem a cada 0,17 s atrás do jogador (`stepFx`). Arrancada/virada brusca (mudança de direção > 1,0 rad comparando com 0,12 s antes, velocidade > 120, no máximo a cada 0,35 s): 5 nuvens achatadas (`flat 0,5`) e 3 lascas de grama no ar. Abaixo de `v < 40` não emite nada. |
| **Rastro de velocidade** | `footFx`. | Quem está com a bola em arrancada (`burst > 0` ou `v > 185`): riscos `streak` (cor do time e branco) a cada 0,045 s atrás do portador, na altura do corpo. |
| **Faíscas do chute** | `kickTo` (se `kind === "shot"`). | `pop` (flash branco 0,14 s) + `wave` na cor do time (`r 34`, 0,35 s) + 10 `streak` na direção do chute (cor do time + branco) + 6 lascas de grama. |
| **Toque de passe** | `kickTo` (outros). | `wave` branca pequena (`r 16`, 0,22 s) + 2 nuvens de poeira. |
| **Onda no chão (`wave`)** | `kickTo`, `keeperCatch` (`r 40` espalmada, `r 36` defesa). | Elipse achatada (`ry = r·0,42`) que se expande e some; `f.col` em "r,g,b". |
| **Swoosh do drible** | `duel` (drible vence): `fx.push({kind:"swoosh"})`. | Dois arcos elípticos girando em volta de quem driblou (cor do time e branco), 0,4 s, na altura do tronco (`SPRITE_FEET − 26`). Também 7 `streak` verdes/brancos e `impact`. |
| **Estouro (`impact`)** | Drible, roubo, carrinho, trave, gol. | Anel branco que cresce (raio 8 até 42) + 8 raios, 0,35-0,5 s. Só no `duelMode` em alguns casos. Desenhado no chão (`ground`). |
| **Roubo e carrinho** | `duel`, `slideStep`, `slideHit`. | `streak` vermelhos/brancos, lascas de grama, poeira atrás do carrinho (`slideA + π`), `impact`. |
| **Rede balançando (`net`)** | `scoreGoal`. | 6 linhas verticais onduladas atrás do gol, amplitude `7·exp(−3k)`, 1 s. **Pulada com `IMG.persp`** (a imagem inclinada já tem rede). |
| **Confete do gol** | `scoreGoal`. | 56 `chip` no ar (cores do time, branco e `255,210,63`), `z0..z1 160..340`, `g 260`, vida 1,2 a 2 s. |
| **Explosão de cor (`burst`)** | `scoreGoal` no `duelMode`. | 34 bolinhas radiais na cor do time, 1,3 s, com gravidade. |
| **Bola rolando** | `draw`, passo 14. | Três gomos escuros (`#0A1124`) que giram com a distância percorrida (`b.roll += v·dt/br`) dentro do círculo da bola; na posse, usa a velocidade do condutor. A bola parece rolar, não deslizar. |
| **Bola no ar** | `b.lift` (chapéu, 0,4 s, altura 18) e passe por cima (`b.pass.lob`, altura 26, v225). | A bola sobe (`lift`), cresce (`br = BALL_R·(1 + lift/60)`) e a sombra fica no chão. |
| **Rastro da bola** | `draw`, passo 9. | Fita `lineCap round` que afina; só quando a bola não tem dono. Chute no `duelMode`: cor do time, mais grossa, com miolo branco; bola com `shadowBlur 22` na cor do time durante o chute. |
| **Faísca de parede (`spark`) e `ring`** | Bola bate na linha lateral/de fundo; chute e passe de tabela. | Disco ciano que some (`spark`) ou anel branco (`ring`). |
| **Trave** | `moveBall`. | `spark` + `impact` + 14 `streak` (brancos/amarelos) + texto "NA TRAVE!" + `shake(10, 0.4)`. |
| **Defesa/espalmada** | `keeperCatch`. | 14 `streak` + `wave` + texto ("ESPALMOU!" azul `#1f5bff`, "DEFESA!" ciano) + `shake(7, 0.28)` na espalmada; mergulho levanta 8 nuvens de poeira. |
| **Texto que pula** | `fx.push({kind:"text"})` em dezenas de pontos do motor. | Fonte `italic 900 24px Barlow Condensed`. Entra com "pop": escala `0,5 → 1,35 → 1` em 0,2 s, levemente inclinado (`rotate(−0,06)`), sobe 22 unidades e some. Sombra deslocada, contorno `lineWidth 5 #050914` e preenchimento na cor `f.color`. Exemplos: "CHUTAÇO!" (`#ff9f1c`), "BLOQUEIO!", "TABELA!", "PASSE DE GÊNIO!", "ROUBOU!" (`#c0081c`), "CARRINHO!", "PULOU O CARRINHO!" (`#9dff6a`), nome do drible (`#9dff6a`). |
| **Tremida de tela** | `shake(mag, t)`; aplicada no passo 2 de `draw`. | A mais forte vence se vierem juntas. Intensidades: gol 12 (0,5 s, só `duelMode`), trave 10 (0,4), carrinho 9 (0,35), espalmada 7 (0,28), roubo 7 (0,3), drible e pulo do carrinho 5 (0,22), chutaço 4 (0,2). Decai linearmente (`shakeT/shakeDur`). |
| **Imagem residual (`ghost`)** | `step()` guarda 5 posições (a cada 0,035 s) no `duelMode`. | Desenhada só se `slide > 0` ou o portador está em arrancada (`burst`/`recoverT` < 0,7 s). **Quem tem folha de corrida não deixa rastro** (parecia um desenho voando, v209); hoje só o círculo de iniciais (personagens sem sprite) usa. |
| **Estrela de atordoado** | `draw`, passo 13. | "✶" ao lado da barra de energia. |

`dust` existe no desenho de `fx` (círculo claro que cresce) mas nenhum ponto do motor o emite hoje (legado).

### 6.3 Onde ajustar

- **Quantidade, cor, tamanho, vida de um efeito**: no `this.emit(...)`/`this.fx.push(...)` do ponto que dispara (`kickTo`, `keeperCatch`, `scoreGoal`, `duel`, `slideStep`, `slideHit`, `footFx`). A forma está em `drawParts` (partículas) ou nos `if (f.kind === …)` de `draw` (fx).
- **Intensidade da tremida**: segundo argumento de cada `this.shake(mag, t)`.
- **Cor do time nos efeitos**: `teamRGB(t)`.
- **Tetos**: 420 partículas em `emit`; ghost de 5 posições em `step`.
- **Posição na perspectiva**: partículas e fx passam por `at()`; para um efeito novo no chão use `ground = true`, para um efeito "de pé" o padrão. Lembre de `ctx.restore()`.

---

## 7. Câmera (`camStep`, `CAM_ZOOM`) e por que está desligada

- `camStep()` retorna `this.cam = { x, y, z }`, chamada a cada quadro em `draw`. Quando ligada: alvo = bola com antecipação (`vx·0,35` limitado a ±160, `vy·0,2` a ±80), suavização `1 − exp(−dt·3,5)` na posição e `1 − exp(−dt·2,5)` no zoom, zoom-alvo `C.CAM_ZOOM = 1.6`, centro preso dentro da VIEW. Abre (zoom 1) em `halftime`, `ended` e `goldenIntro`.
- Condição de ligada: `!IMG.persp && BL.CAM === "perto"`. **Com o estádio inclinado (`IMG.persp` definido) a câmera é sempre falsa**: `cam.z` volta a 1.
- `ui.js > frame()` ainda grava `BL.CAM = settings.camera || "inteiro"`; a aba **Tela** das Configurações saiu na v222. A opção não aparece mais.
- Por que está desligada: (1) o Mickey queria **mudar o ângulo de visão** (campo inteiro em 3/4) e não um zoom que segue a bola (decisão registrada: ele recusou a câmera que segue a bola); (2) o zoom é aplicado no passo 3, no espaço VIEW, antes da transformação da imagem. A projeção do chão para a imagem não é linear (`proj`), então um zoom linear centrado na bola em unidades do campo não bate com o ponto da imagem. (Razão técnica inferida do código; a decisão de produto é a primeira.)
- Para reativar no futuro seria preciso fazer a câmera operar em pixels da imagem (depois do passo 7), com HUD e LED recalculados.
- `drawHud` ainda tem o fator `hs = 1 + max(0, cam.z − 1)·0,6` (crescer o HUD com zoom); com `cam.z = 1` vale 1.

---

## 8. HUD de transmissão e placas de LED

### 8.1 Placas de LED: `drawLed(ctx, boss)`

Desenhadas no passo 8, **em pixels da imagem**, em `led.y`/`led.h` (133 e 23). Textos nas **5 placas** `led.B` (`[x, largura]`; sem `IMG.persp` o código tem uma lista antiga de 7 placas em unidades do campo): `BLUE LOCK` | letreiro | `● AO VIVO` | letreiro | `PROJECT IDLE`. Letreiro = `BLUE LOCK ★ PROJECT IDLE ★ ` correndo para a esquerda a `t·28` px/s em laço (`mode "ticker"`).

- Fonte `italic 900 (h·0,87)px Barlow Condensed`. Cor de destaque: ciano `38,217,255`, âmbar `255,176,46` no Boss; "AO VIVO" rosa `255,79,139` e pisca (`mode "blink"`: alpha `0,55 + 0,45·|sin(6t)|`).
- Cada placa: recorte retangular, fundo `rgba(col,.1)`, texto brilhante (glow com `shadowBlur 10` + camada branca 0,5), **grade de LED** (linhas verticais e horizontais a cada 2,5 px) e um brilho que passa (gradiente a `0,25` ciclo/s).
- **No gol** (`state === "goal"`): todas as placas piscam "GOL!" alternando a cor de quem marcou (`gc`: ciano se foi o time 0, âmbar se Boss, rosa) e branco.
- Para trocar texto: editar as listas em `drawLed`. Para mover/redimensionar placas: `IMG.persp.led`.

### 8.2 HUD: `drawHud(ctx, boss)`

Desenhado no passo 18, em **unidades VIEW**, na mureta de baixo do campo (`y0 = H + 7 = 567`, ~62 unidades de altura, de 567 até o fim da imagem em 628,9). Não treme.

- **Minimapa**, centralizado em `W/2`: `mw = 176` (v303; antes 104), indo até o topo da mureta, `mh = mw·H/W`, pé fixo e crescendo para cima. Painel escuro com contorno ciano, gramado translúcido, linha do meio, círculo, áreas. Cada jogador é um ponto na cor do time (`teamRGB`), goleiro amarelo (nosso/dono) ou rosa; quem tem a bola ganha ponto maior com contorno branco; bola branca. (Com câmera ligada, desenharia o retângulo da área visível.)
- **Cards de quem está com a bola** (v304, `hudCard`): um por time, o nosso à esquerda e o do inimigo à direita (espelhado em `W/2`), entre a borda e o minimapa, puxados 90 para o canto e no alto da mureta (`my + 10`, v305) (`cw = 230`, `chh = 56`). Cada um mostra o último jogador daquele time que teve a bola (`this.hudFoc[time]`; goleiro não entra), ou o primeiro de linha. Retrato, nome, Nv, barra de energia e XP (só o nosso time). Antes da v304 era um card só, colado na borda esquerda. v306: cores reforçadas (fundo azul-marinho ou vinho cheio, borda de 2 px na cor do time com brilho, retrato em gradiente, barras com brilho).
- `rrect()` é o retângulo arredondado com fallback sem `roundRect`.

### 8.2a Tamanho visual igual (v356)

Pedido do Mickey: todos com o mesmo tamanho em campo. As folhas têm a mesma altura em pixels (~143), mas quem está agachado na folha (Isagi, LockHart, Teddy...) parece maior que quem está de pé (Marin, Riq, Nagi...). `C.SPRITE_SIZE[charId]` multiplica `anim.px`, `runPx` e `hh` desse personagem em `drawSprite` (fatores 0,87 a 1,06, escolhidos comparando as folhas lado a lado com `szk.py`). Só o desenho muda: hitbox (`e.r`), alcance e velocidade são iguais para todos. Personagem novo: comparar com os outros e pôr o fator (sem entrada = 1). v378/v379 (Mickey): goleiro robô `"gk-robo": 0.715` (v378 0,5; v379 +30%; v380 +10%); a posição da bola nas mãos (`gkBall`) também é multiplicada por esse fator.

v357: o fade de 0,1 s entre folhas (`e.xf`) conta pelo relógio real (`performance.now`), não pelo tempo da partida; com a partida parada (pop-up de formação) ele ficava preso. E o desenho único (`card`/`field`, ~145 px) dos personagens novos usa `anim.px` enquanto a folha carrega, em vez de `SPRITE_PX` 1,15 (saía gigante).

### 8.2b Contorno do time nos sprites (v355)

Pedido do Mickey: todo sprite em campo (jogadores e goleiros, todas as folhas, inclusive o quadro que some na troca de folha) tem contorno na cor do time: `C.OUTLINE_MINE` `#4a95ff` (meu time; goleiro com `e.own` também) e `C.OUTLINE_ENEMY` `#ff3b3b`. `spriteAt(..., ol)` desenha antes do quadro a silhueta pintada (`silhouette(im, cor)` em engine.js, cache por folha e cor) em 8 direções deslocada `C.SPRITE_OUTLINE` (2). Os rastros (`e.ghost`) e as telas fora do campo não têm contorno.

### 8.3 Barra de energia em campo: `energyBar(ctx, e, x, y)` (v215)

Cápsula escura (`34 × 6` desde a v353; era `44 × 8` na v352) na **cor do time** (pedido do Mickey, para separar os lados): meu time **azul** `rgb(43,123,255)`, inimigo **vermelho** `rgb(255,59,59)`, com borda de 1,5 px e brilho na mesma cor; abaixo de `C.ENERGY_LOW` (50) o preenchimento escurece (`#1a4fb0` / `#a8202a`); com energia ≤ 25 a borda pisca em branco. v354 (Mickey): **sem nome em campo**, só a barra; o texto a seguir é histórico. v353: o **primeiro nome** (`p.name` até o primeiro espaço) fica logo acima da barra, Barlow Condensed itálico 800 11px com contorno `#050914` de 3 px, em azul-claro `#bcd6ff` ou vermelho-claro `#ffb3b3`; a seta do condutor subiu para cima do nome. Não há mais nome embaixo dos pés. 4 gomos de 25%, brilho em cima e **rastro branco** do que acabou de gastar (`e.enTrail`, recua 40/s). Desenhada acima da cabeça (`ey`, seção 4.5); sem sprite, em `e.y − e.r − 12`.

### 8.4 Seta do condutor (v218)

Triângulo na cor do time (`teamRGB`) acima da barra de energia de quem está com a bola, com `shadowBlur 8`, contorno `#050914` e flutuação `sin(6t)·2`.

### 8.5 Sobreposições grandes: `big(text, sub, tone)`

v270 (opção A do Mickey, prévias em `docs/visual/letreiro/`): faixa de TV inclinada (`rotate(-0.1)`, 96 de altura, gradiente transparente → cor → cor clara → cor → transparente, brilho e dois fios brancos em cima e embaixo) que abre do centro em 0,28 s (tempo real, `performance.now()`, chave `_bandKey`), com o texto branco `italic 900 84px` entrando da esquerda. Só o que aconteceu, sem placar nem recompensa: **GOL!** + nome de quem marcou (`flash.name`; azul se foi nosso ou treino, vermelho se do adversário), **INTERVALO** (roxo), **GOLDEN GOL** (dourado), **FIM DO TREINO** (azul), **VITÓRIA** (dourado) / **DERROTA** (vermelho). Tons em `BAND`. Durante a morte súbita aparece também uma faixa pequena "GOLDEN GOL" por 2,6 s (alpha com fade de 0,3 s e 0,5 s).

---

## 9. Arenas de Boss no desenho

`this.arena` (de `C.MAPS[i].boss` em `config.js`: `{ name, bossBuff, userDebuff, tint, grad?, vignette }`) só altera cores no desenho (mecânica fica no motor, ver [02](02-motor-e-ia.md) e [04](04-progressao.md)):

- Tinta sobre a imagem inteira (`tint`), degradê horizontal (`grad`, Estádio Nacional U-20), vinheta radial que respira (`vignette`). Arenas atuais: Cela do Rei (vermelho), Sala do Gênio (branco-azulado), Abismo do Rin (ciano), Estádio Nacional U-20 (rosa, escuro e verde).
- No Boss o time adversário usa âmbar: `teamRGB(1)` vira `255,176,46`, placas de LED em âmbar, anel `#ffb02e`, confete e rastro âmbar, círculo do adversário `#1a0a0e` com anel âmbar quando não há sprite.
- Arena sem texto no meio do campo (removido na v125).

---

## 10. Checklist para mudar o desenho sem quebrar

- Mexeu em tamanho de jogador? Ajuste `anim.px`/`SPRITE_PX` por folha, **não** `persp.spr` (que voltou a 1 por pedido do Mickey) e **não** o raio de colisão `PR`.
- Mexeu na imagem do campo? Recalibre `persp` (seção 3.5) e cheque as placas de LED.
- Folha nova? Medir `fx`, conferir pés na base, quadros iguais, olhando para a direita, sem bola. Registrar em `C.SPRITES` e subir `BL.BUILD`/cache (ver [09](09-build-publicacao-e-simulacao.md)).
- Efeito novo? Passar por `at()` e fechar com `restore()`; partícula nova com `air` correto (chão por baixo dos jogadores, ar por cima).
- Nunca aumentar `RUN_MAX`, ligar velocidade variável do jogador, ou fazer a corrida escalar com o nível.
- Simulação headless (Node, `dev/sim/`) não usa `draw`: as funções de desenho só rodam no navegador.

- **v569 · textos flutuantes:** só aparecem os que começam com um item de `C.FX_TEXT_KEEP` (v576: "GOL x", "COMBO x", "CHUTE", "CHUTAÇO", "PASSE", "DRIBLE" e os nomes dos dribles: CANETA, PUXADA, BLADE, HAXBALL, BACKBOARD, ELÁSTICO, CHAPÉU, PEDALADA, LAMBRETA, ROLETA, NO ÚLTIMO SEGUNDO, PULOU O CARRINHO; "CHUTE!" sai em todo chute que não é CHUTAÇO, "PASSE!" em todo passe para companheiro, nos dois times e em todos os modos); o filtro fica no início do bloco de textos flutuantes do `draw`. Para voltar um texto, adicione o começo dele na lista.
- **v570 · ícone de proibido no gol (X1):** no fim do bloco de textos flutuantes do `draw`, para cada time com stack < `C.X1.style.shotMin` (fora do gol de ouro) um círculo navy com anel e barra ciano #26D9FF pulsando, dentro da rede na parte de cima (v572: x = linha + 26 px, y = meio − 0,7 × GH, raio 10, já no início da partida), respirando 2,5 px com sombrinha embaixo.
- **v584:** removido o lampejo branco (`brightness(2.2)`) de quem toma tackle ou drible; a jogada lendária não desenha nada.


v603: personagens novos usam atlas: `src` = `"img/sprites/<id>.png#x,y,w,h"`; `BL.atlasImg` (engine.js) recorta num canvas com `complete`/`naturalWidth`, e `spriteImg` e o `idleDraw` da interface usam isso. O card vai embutido (data URI). Recorte: `dev/sprites/novos2.py` (cópia do novos.py, comemoração com escala pelo 6º quadro) e `pack.py`.

v604: TODOS os personagens usam atlas (antigos em `img/sprites/a/`, novos em `img/sprites/<id>.png`). Personagem novo = 1 arquivo só: recortar com `novos2.py` e juntar com `pack.py`.

v631: como montar personagens novos de um .rar do Mickey (9 folhas por personagem, títulos em cima): extraia, identifique cada folha pelo título (ou pelo nome do arquivo), copie para `U/<id8><anim>-image.png`, escreva `cfg.json` ({id: {anim: nome}}) e rode `dev/sprites/novos3.py` (recorte e padronização, `FORCE` para quadros grudados) e `pack.py` (atlas + linhas do `C.SPRITES`). Folha com fundo semitransparente: zere o alfa abaixo de 200 antes. Confira o atlas numa folha de contato antes de publicar.

## Sprites das 12 habilidades (v685)

Folhas do Mickey em `docs/skills-src/<id>.png`; `docs/skills-src/bake.py` recorta em tiras `game/img/skills/<id>.webp`. Configuração em `C.SKILL_SPR.<id>` (`h` = altura do quadro em alturas do jogador). Funções em `engine.js`: `skImg(id)` carrega a tira (enquanto não carrega, fica o desenho antigo), `skSprD` desenha um quadro, `skSeq` escolhe o quadro pelo tempo, `skKick` cuida de chute e passe. `skFx` ganhou `hold` para o efeito durar enquanto o sprite toca.

- **Chute e passe** (Chute Direto, Passe Calibrado, Passe Mágico, Tabela Relâmpago, Chute Curvado): no recorte cada quadro foi alinhado pela cabeça do efeito e girado para andar para a direita. `imp` = quadros de impacto no ponto do chute, girados para o alvo; `trail` = rastro com a cabeça presa na bola, girado na direção real da bola (últimos pontos de `skBT`), sem virar de cabeça para baixo; `end` = quadros no ponto onde a bola parou ou foi dominada. Tabela: ida usa 0 (impacto), 1 (raio) e 2 (chegada no companheiro); a devolução (`ret: 1` no `skFx`) usa 3, 4 e 5. Chute Curvado é um cometa: estrela na bola e cauda em curva atrás. A linha de luz `skBT` continua por baixo, com as cores das artes (`COL` em `drawSkills`).
- **Voleio Acrobático**: asas atrás das costas (camada 0), 6 quadros em 0,8 s.
- **Drible do Monstro**: monstro atrás de quem dribla, virado para o ataque: 0-2 surge, 2-4 em volta enquanto dura, 5 some.
- **Energia Infinita**: anel no pé de cada jogador do time, em repetição, com brilho somado (`add`). Saiu o raio amarelo em cima da cabeça.
- **Muralha do Capitão**: o favo verde no chão continua (v686) e a cobra fica por cima, na frente do próprio gol (`ahead` px), virada para o ataque: 0-1 surge, 3-5 guarda; o quadro 2 (bote) aparece quando bloqueia um chute (`skFx` `wallHit`).
- **Ninja Invisível**: fumaça (6 quadros, 0,7 s) onde ele some e onde reaparece.
- **Ego** (v686): sem a palavra EGO. A tela escurece, os raios dourados saem de quem ativou e o Ego aparece em pé ao lado dele (`side` px para trás), 12 quadros em 1,8 s. Desenhado em `drawSkills(ctx, 1)` (antes ficava em `drawSkillBanner`); o `skFx` do Ego guarda `e`.
- **Visão de Jogo**: anel de peças no pé de quem tem a bola: 0-4 monta, 5-6 gira, 7-9 desmonta. O cone, as linhas de passe e a mira continuam.

## Pantera da habilidade (v683)

`C.SKILL_SPR.pantera` (`config.js`): folha `img/skills/pantera.webp` com 6 quadros de 320 px (arte do Mickey). Em `drawSkills(ctx, 0)` (`engine.js`), enquanto `e.skSpd` da Pantera vale: o campo recebe `rgba(tint, tintA)` por cima e a pantera é desenhada atrás do jogador, virada para onde ele corre, com `alpha`, `w` (largura em alturas do jogador), `back` e `up`; os 6 quadros tocam `loops` vezes (2) na duração da skill (`SKILL_DEF.pantera.t`).

