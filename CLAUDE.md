# BL PROJECT IDLE · regras para agentes

Jogo idle de futebol (Blue Lock + Pokémon) em HTML, CSS e JavaScript puro, sem build e sem servidor. O dono é o Mickey; responda em português do Brasil, curto e direto.

## Leitura: só a área da tarefa

Não leia o projeto inteiro. A ordem é sempre esta:

1. Leia `docs/tecnico/README.md`. Ele diz qual arquivo cobre cada assunto, resume o estado atual e lista as regras fixas do Mickey.
2. Abra **só** o arquivo da área da tarefa:
   - `01-arquitetura.md`: mapa de arquivos, objeto global `BL`, eventos, laço principal
   - `02-motor-e-ia.md`: partida (`BL.Match`), IA, passe, chute, duelo, 1×1, stamina, IVs, formações
   - `03-jogadores.md`: personagens, raridade, IV, nature, EV, nível, itens, roubo
   - `04-progressao.md`: mapas, fases, recompensas, baús, Wildcard, Expedição, Boss, Diária, economia
   - `05-interface.md`: telas, landing e Wiki, painéis, dock, pop-ups (`MODALS`), configurações, layout
   - `06-contas-e-save.md`: contas locais, `localStorage`, formato do save, registro de partidas
   - `07-audio.md`: sons e volume
   - `08-config-e-balanceamento.md`: referência de `config.js` e números medidos
   - `09-build-publicacao-e-simulacao.md`: versão, publicação, bancada de simulação
   - `10-desenho-sprites-vfx.md`: campo inclinado, perspectiva, sprites, efeitos, HUD
   - `11-historico-de-versoes.md`: só quando precisar saber quando ou por que algo entrou
3. No código, ache o trecho com `grep` pelo nome de função ou constante que o doc cita e leia só esse trecho. `engine.js`, `ui.js` e `style.css` passam de 130 KB cada: nunca leia inteiros.
4. Se o doc e o código discordarem, vale o código. Corrija o doc na mesma tarefa.

## Edição

- Edições pontuais no trecho certo. Nada de refatorar ou "melhorar" o que não foi pedido.
- Números de equilíbrio sempre em `game/js/config.js`; textos da interface em português.
- Depois de editar um `.js`, confira a sintaxe: `node -e "new Function(require('fs').readFileSync('arquivo.js','utf8'))"`.
- A cada versão nova: `BL.BUILD` +1 em `config.js` e os 8 `?v=` do `index.html`.
- Toda mudança de jogo atualiza o doc da área, ganha uma linha em `11-historico-de-versoes.md` e a "Versão documentada" do README.
- Pedidos só de visual (cores, layout, telas, pop-ups, sprites, efeitos, HUD) vão para o subagente `design-visual` (`.claude/agents/design-visual.md`): ele lê só os docs 05 e 10 e o trecho de tela, sem carregar as mecânicas.

## Execução e testes

- Testes no fim, não a cada passo.
- Simulações (`dev/sim/`, ver doc 09) só para mudanças de IA ou equilíbrio. Meta: cada vantagem do pedra-papel-tesoura do 4×4 perto de 70%.
- Delegue as simulações ao subagente `simulacao` (`.claude/agents/simulacao.md`): ele roda os scripts e devolve só a tabela de vantagens, sem encher esta conversa de logs.

## Regras fixas do Mickey

Estão no README da documentação (corrida limitada a 210, roleta inicial travada, câmera fixa, sons do Claude só com aprovação, entre outras). Qualidade primeiro: economize tokens, mas não quebre o projeto.
