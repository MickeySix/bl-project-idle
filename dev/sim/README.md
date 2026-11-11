# Simulação do jogo (bancada de testes)

Scripts Node + Playwright que abrem a cópia do jogo e rodam partidas em velocidade máxima.

No computador (repositório BLPROJECT): `npm install` e `npx playwright install chromium` uma vez nesta pasta, e copie o jogo para `new/` aqui dentro; ou use o subagente `simulacao` do Claude Code (`.claude/agents/simulacao.md`). No container do projeto: melhor copiar esta pasta para o scratchpad antes de rodar. Uso (copie a pasta do jogo para um diretório irmão, ex. `new/`, e rode a partir desta pasta):
- `cp -r /mnt/project-files/game ./new` (e substitua snd/ por snd-pub/ se precisar publicar)
- Equilíbrio 4x4: `DIR=new PAIRS='2-2/3-1;3-1/1-3;1-3/2-2' node wr2.js 30 > w_1.txt` (vários processos em paralelo, `sleep 3-4` entre eles; timeout no login às vezes → `agg.py` mostra ERR) e `python3 agg.py "w_*.txt"`.
  - `OV='{"STYLES.blitz.sigWin":1.3}'` sobrescreve caminhos do CONFIG sem editar arquivo.
  - Times iguais nos dois lados: nível 100, IV 16, natureza neutra, sem EV. ids: 2-2=1-2-2, 3-1=1-3-1, 1-3=1-1-3.
- `gkr.js`+`agg2.py`: reposição do goleiro (bote em 2 s). `duo.js`+`agg3.py`: dupla de frente 1-2-2. `thru.js`+`agg4.py`: infiltrações 1-1-3. `bk.js`+`agg5.py`: passes para trás com opção livre.  `solo.js`: decisões do atacante solitário da 1-3-1 no campo deles (v132). `vb.js` (IV=16|28, DIR=...): passes para trás no ataque com 2+ atacantes deles no nosso campo (v131). `vis.js`: posições na saída de bola.
- `en.js`+`agge.py` (v226): igual ao wr2.js mais energia por time (intervalo, fim, mínimo) e duração; aceita `OV` e `PAIRS`. `smoke.js`: fumaça dos efeitos de IV (IV 31 contra IV 10 em 1x1/2x2/4x4; conta passes de gênio, por cima e chutes com curva). `m1.js`: bancada do 1x1 (duelMode). `sty.js`+docs/analise/estilos-v195.md: estilo de jogo de cada formação.
- `node stall.js` (treino; sempre usa a pasta new/), `node rate3.js new` (1x1): testes de fumaça.
- Login dos scripts (v224+): a landing abre o login por `[data-ld-auth=login]` e a aba `[data-ld-tab=create]`; o mapa de fases fica dentro da janela Mapas, então clique `.dock-map` antes de `button.sm-node[data-play="1"]`.

Publicação: snd-pub/ tem os mp3 bons (o mount mostra tamanhos estranhos). Publicar com root numa pasta pub/ (ver docs/tecnico/09-build-publicacao-e-simulacao.md).
