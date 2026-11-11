# 9. Versão, publicação e bancada de simulação

[← Índice](README.md)

## 9.1 Não há build

O jogo é estático. Para rodar localmente, abra `game/index.html` no navegador (funciona por `file://`). Não há etapa de compilação, minificação nem pacote npm.

## 9.2 Versão e cache

- `BL.BUILD` em `game/js/config.js` (hoje `"226"`) é o número da versão. Desde a v555 ele não aparece em nenhuma tela (Mickey); `#buildStart` segue no HTML escondido.
- `index.html` carrega o CSS e os JS (16 `?v=` na v630) com `?v=<BUILD>`, e os mp3 usam o mesmo sufixo. **A cada publicação, suba os dois**: `BL.BUILD` e todos os `?v=` do `index.html` (12 ocorrências desde a v626: style.css, clan.css, rmt.css e 9 JS). Sem isso o navegador do jogador continua com o JS velho.
- Assim o Mickey confere pela versão se está vendo o build novo.

## 9.3 Fluxo de mudança

O fluxo usado em toda mudança do jogo:

1. Localize com `grep` e leia só o trecho necessário dos arquivos grandes (`engine.js`, `ui.js`, `style.css`).
2. Edite uma cópia (ou faça substituição pontual que confira se o trecho aparece uma vez só).
3. **Confira a sintaxe e o tamanho** de cada `.js` editado:
   `node -e "new Function(require('fs').readFileSync('arquivo.js','utf8'))"`.
   Um `sed -i` no mount já deixou `ui.js` cortado em ~64 KB uma vez, e um arquivo cortado quebra o jogo.
4. Copie para `game/` e confira com `cmp`.
5. Suba a versão (9.2).
6. Mudança de IA ou equilíbrio: rode as simulações (9.5) e mantenha cada vantagem perto de 70%. Mudanças pequenas: teste no final, antes de publicar.
7. Publique (9.4) e responda com o link do jogo.

Duas conversas do projeto mexem em `game/`: "Ajustes do jogo" (jogo) e "Ajustes do site" (landing, Wiki, logo; também edita `index.html`, `ui.js`, `style.css` e `config.js`). Antes de publicar, releia ou compare esses arquivos com a versão no ar, nunca sobrescreva a mudança da outra conversa e suba `BL.BUILD` acima da última versão publicada.

## 9.4 Publicação

O jogo é publicado como Artifact em https://claude.ai/artifact/4LFiip85peJuMZmXMS2nSS (sempre o mesmo link). Toda resposta ao Mickey sobre mudança no jogo leva esse link.

- Monte uma pasta `pub/` no scratchpad com a cópia do jogo e publique com `root = pub/`, a página `pub/index.html` e, em `files`, **só os arquivos que mudaram** (o resto continua no ar). Na primeira publicação de uma pasta nova vão todos: `css/style.css`, `js/*.js` (7), `img/campo.jpg`, `img/hero.jpg`, `img/logo.png`, `img/engrenagem.png`, `img/sobre/*.jpg`, `img/sprites/*.png` e os 9 mp3 de `snd/`.
- Não passe `capabilities`: o artifact já declara `{db:{}}` (banco usado pelo registro de partidas, ver [06](06-contas-e-save.md)) e omitir mantém.
- Se a publicação for recusada porque um arquivo mudou no ar (a outra conversa publicou), leia a versão no ar (`Artifact read` com `path`), aplique a sua mudança por cima dela e publique de novo. Nunca reenvie a cópia antiga.
- Use os mp3 de `dev/sim/snd-pub/`: o mount mostra tamanhos estranhos para `game/snd/`.

## 9.5 Bancada de simulação (`dev/sim/`)

Scripts Node + Playwright que abrem uma cópia do jogo no Chromium sem tela, criam uma conta (`mickey`/`1234`: `[data-ld-auth=login]`, aba `[data-ld-tab=create]`), escolhem a função, escolhem o jogador inicial, abrem a janela Mapas (`.dock-map`, desde a v224) e entram na fase 1, e então rodam partidas direto no motor (`new BL.Match(...)` + `m.step(1/60)` em laço, sem esperar tempo real).

Preparação: copie `dev/sim/` para o scratchpad e copie o jogo para uma pasta irmã `new/` (`cp -r /mnt/project-files/game ./new`).

No computador do Mickey (repositório BLPROJECT): em `dev/sim/`, `npm install` e `npx playwright install chromium` uma vez (`package.json` fixa o Playwright 1.56.1); depois copie o jogo para `dev/sim/new/` (ignorado pelo git). Os scripts acham o Playwright local ou o do container e montam o caminho do arquivo de forma portátil (Windows, Mac, Linux). O subagente `.claude/agents/simulacao.md` do repositório faz tudo isso e devolve só a tabela de vantagens; o `CLAUDE.md` manda delegar as simulações a ele.

| Script | Mede | Agregador |
|---|---|---|
| `wr2.js` | winrate 4×4 por confronto (vitória, gols, gol de ouro, goleada, perdedor marcou, chutes) | `agg.py` |
| `node-wr.js` | winrate 4×4 só com Node, sem navegador (v437): `node node-wr.js <pasta do jogo> N 'A/B;C/D' 1` (último arg 1 = com Fixo; `OV` e `FXON=2-2,3-1` opcionais). ~0,5 s por jogo | |
| `gkr.js` | botes nos 2 s depois do tiro de meta | `agg2.py` |
| `duo.js` | dupla da frente da 1-2-2 (passes para trás) | `agg3.py` |
| `thru.js` | infiltrações da 1-1-3 (tentadas e recebidas) | `agg4.py` |
| `bk.js` | passes para trás com opção livre | `agg5.py` |
| `vis.js` | posições e alvos na saída de bola | |
| `en.js` | winrate 4×4 mais energia por time (intervalo, fim, mínimo) e duração (v226) | `agge.py` |
| `smoke.js` | efeitos de IV: IV 31 contra IV 10 no 1×1, 2×2 e 4×4 (passes de gênio, por cima, chutes com curva) | |
| `m1.js` | 1×1 com `duelMode` (gingas, carrinhos, chutaços) | |
| `sty.js` | estilo de jogo de cada formação (base em `docs/analise/estilos-v195.md`) | |
| `solo.js`, `vb.js` | atacante solitário da 1-3-1; passes para trás no ataque | |
| `stall.js` | fumaça do treino (sempre usa `new/`) | |
| `rate3.js` | fumaça do 1×1 (`node rate3.js new`) | |

Uso típico do equilíbrio:

```bash
DIR=new PAIRS='2-2/3-1;3-1/1-3;1-3/2-2' node wr2.js 30 > w_1.txt   # vários processos em paralelo, com sleep 3-4 entre eles
python3 agg.py "w_*.txt"
```

- `PAIRS`: confrontos `idA/idB` separados por `;` (ids: `2-2` = 1-2-2, `3-1` = 1-3-1, `1-3` = 1-1-3).
- `OV='{"STYLES.blitz.sigWin":1.3}'`: sobrescreve caminhos do `CONFIG` sem editar arquivo, para testar alavancas (também com caminho aninhado, ex. `IVX.dribFirst`).
- Meta do Mickey: cada vantagem do pedra-papel-tesoura perto de 67% depois de qualquer mudança de IA (era 70% até a v634). Última medida (v635, ataque × defesa): defesa 66%, ataque 61%, pares com 1 vantagem 68%.
- Times: 4 personagens sorteados, iguais nos dois lados, Nv 100, IV 16, nature neutra, sem EV; os lados alternam a cada partida.
- Use pelo menos 180 jogos por confronto: rodadas de 90 variam ±5 pontos.
- Os scripts esperam o botão Jogar da landing aparecer (`#ldEnter`, até 90 s) antes do login; se ainda sair `ERR` no `agg.py`, rode de novo só aquele processo.

O motor também roda direto no Node (sem navegador) carregando `config.js`, `database.js`, `players.js` e `engine.js` com `global.window = global`.

- **Ataque × defesa (v635)**: `dev/sim/rps635/` (ver `LEIA.md`): `runall.sh` roda os 36 pares `ataque:formação` na página do jogo com valores de teste em `OV`, `fit.py` dá a vantagem da defesa e do ataque e a força de cada time, `grp.py` agrupa os pares por saldo de vantagens. Meta do Mickey: ~67%.

## 9.6 Onde ficam as coisas

| Caminho | Conteúdo |
|---|---|
| `game/` | o jogo |
| `dev/sim/` | bancada de simulação e `snd-pub/` |
| `docs/bl-project-idle-roadmap.html` | roadmap |
| `docs/analise/` | análises: winrate v102/v103 e estilos de formação v195 |
| `docs/config/`, `docs/formacoes/` | capturas de tela e desenhos de formação de referência |
| `docs/sons/` | sons candidatos e originais do Mickey |
| `docs/sprites/` | prompts das imagens (estádio, estádio inclinado, animações do Isagi, goleiro robô) |
| `dev/sprites/` | scripts Python que montam as folhas de sprite a partir dos originais em `dev/sprites/src/` |
| `dev/old-img/` | versões antigas de `campo.jpg` e de folhas de sprite (backup) |
| `docs/tecnico/` | esta documentação |
| `uploads/hearth/` | imagens de referência da spec original |

## Pacote fora do Claude (v677, 2026-11-10)

Pedido do Mickey (testers de fora e PiP, que a página do Claude bloqueia): `/mnt/project-files/dist/bl-project-idle-vNNN.zip` + `COMO-PUBLICAR.md` (itch.io / GitHub Pages). Montagem: cópia de `game/` sem `README.md` e `shop_edit.py`, sons de `dev/sim/snd-pub/`, e o `index.html` embrulhado no mesmo esqueleto que o Claude põe na publicação (`<!doctype html>`, `<meta charset="utf-8">`, viewport), com título e fontes dentro do `<head>`. Testado em servidor HTTP comum (modo padrão, UTF-8, partida rodando). `window.claude` (registro de partidas) já é opcional no código.

## Vercel pelo GitHub (v687, 2026-11-11)

Pedido do Mickey: o repositório `marin69xd/BLPROJECT` recebe em `game/` o mesmo conteúdo do pacote de `dist/` (com o `index.html` já embrulhado em `<!doctype html>`), e o `vercel.json` da raiz aponta `outputDirectory` para `game`, sem build. Na Vercel basta importar o repositório. A fonte da verdade continua em `/mnt/project-files/game`; o repositório só é atualizado quando o Mickey pede.
