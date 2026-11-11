# BL PROJECT IDLE · Documentação técnica

Versão documentada: **v687** (`BL.BUILD` em `game/js/config.js`). Jogo publicado em https://claude.ai/artifact/4LFiip85peJuMZmXMS2nSS.

**Comece por aqui.** Esta pasta existe para dar contexto sem ler o projeto inteiro. Para uma tarefa, leia este README, abra só o arquivo da área da tarefa na tabela abaixo e, no código, ache o trecho com `grep` pelo nome de função ou constante citado no doc. Os arquivos grandes (`engine.js`, `ui.js`, `style.css`, com mais de 130 KB cada) nunca precisam ser lidos inteiros. Se o doc e o código discordarem, vale o código, e o doc deve ser corrigido na mesma tarefa.

## Índice

| # | Arquivo | Leia quando a tarefa for sobre |
|---|---|---|
| 1 | [01-arquitetura.md](01-arquitetura.md) | Mapa de arquivos, ordem de carga, objeto global `BL`, eventos motor → jogo → interface, laço principal e timers |
| 2 | [02-motor-e-ia.md](02-motor-e-ia.md) | Partida (`BL.Match`): física, fluxo, chute e gol, goleiro, IA, passe, duelo, 1×1 (`duelMode`), stamina, função de cada IV, formações e pedra-papel-tesoura |
| 3 | [03-jogadores.md](03-jogadores.md) | Personagens, posições, raridade e Shiny, IV, nature, EV, nível e XP, itens, status efetivo, inimigos, roubo |
| 4 | [04-progressao.md](04-progressao.md) | Mapas e fases, recompensas, baús, treino, Wildcard, técnico, Água e Gatorade, VIP, Expedição, Boss, Diária, economia |
| 5 | [05-interface.md](05-interface.md) | Telas, landing e Wiki, painéis, dock, pop-ups (`MODALS`), pré-jogo, pausa tática, vestiário, janelas flutuantes, configurações, modo dev, layout |
| 6 | [06-contas-e-save.md](06-contas-e-save.md) | Contas locais, `localStorage`, formato do save, registro de partidas no banco do artifact |
| 7 | [07-audio.md](07-audio.md) | Sons, música, volume e regra de aprovação de sons |
| 8 | [08-config-e-balanceamento.md](08-config-e-balanceamento.md) | Referência de `config.js` e números de equilíbrio medidos |
| 9 | [09-build-publicacao-e-simulacao.md](09-build-publicacao-e-simulacao.md) | Versão e cache, fluxo de mudança, publicação (inclusive com a conversa do site), bancada de simulação |
| 10 | [10-desenho-sprites-vfx.md](10-desenho-sprites-vfx.md) | Desenho do campo, estádio inclinado e perspectiva, sprites e animações, efeitos, HUD de transmissão, placas de LED |
| 11 | [11-historico-de-versoes.md](11-historico-de-versoes.md) | O que entrou em cada versão (só quando precisar saber "quando" ou "por que") |

## Resumo em uma página

- **O que é**: jogo idle de futebol inspirado em Blue Lock com mecânicas de Pokémon (roubar jogadores, IV, nature, raridade, EV). As partidas são jogadas só pela IA; o jogador monta o time, escolhe formação, usa Água e Gatorade e evolui o elenco.
- **Tecnologia**: HTML, CSS e JavaScript puro, sem build, sem framework e sem servidor. Tudo é salvo no `localStorage`; o registro de partidas também vai para o banco do artifact (coleção `matches`).
- **Pastas**: `game/` (o jogo), `dev/sim/` (bancada de simulação), `dev/sprites/` (montagem das folhas de sprite), `docs/` (roadmap, análises, prompts de imagem, sons candidatos e esta documentação).
- **Modos**: 1×1, 2×2, 3×3 e 4×4 (um por mapa, Boss na fase 10), sempre com 2 goleiros da IA, e o modo treino. Fora da partida: Wildcard, Expedição, Boss diário (envio 1 vez por dia, a qualquer hora), Diária, Loja.
- **Estado atual (v226)**: estádio inclinado com câmera fixa e campo grande; sprites do Isagi e do goleiro robô; HUD de transmissão; stamina punitiva (toda ação gasta, abaixo de 50 o jogador piora até ×0,45); cada IV com uma função na partida; vantagem de formação +3% com pedra-papel-tesoura em ~70% (72/70/70); mapa de fases dentro da janela Mapas; logo oficial.
- **Habilidades** ainda não existem (`BL.SKILLS` vazio; os 4 slots da barra de baixo só mostram a recarga). O botão Tático ainda não faz nada. A Arena PvP entrou na v630 (contra treinadores da IA até haver servidor; ver [04](04-progressao.md)). Reações Químicas e Egos em Colisão entraram na v577 (ver [02](02-motor-e-ia.md)).

## Regras fixas do projeto

Decisões do Mickey que valem para qualquer mudança:

- Números de equilíbrio sempre em `config.js`; textos da interface em português.
- Toda regra de jogo vale igual para os dois times (Mickey, 2026-10-25). Se algo só vale para um time, aplique nos dois; só fica de um time quando o Mickey avisar.
- Ninguém corre mais rápido com o nível: corrida limitada a 210 (legibilidade dos sprites). Jogo em velocidade 1×.
- Depois de qualquer mudança de IA ou equilíbrio, rode as simulações e mantenha cada vantagem do pedra-papel-tesoura perto de 67% (Mickey, 2026-11-07: "mais ou menos 67%", para o jogo ficar equilibrado e divertido; antes era 70%).
- Roleta inicial: removida na v350 a pedido do Mickey; o jogador escolhe entre até 3 personagens da função (sprites balançando).
- Câmera fixa mostrando o campo todo (a que segue a bola foi recusada); jogadores na escala ×1.
- Recusados na v226: proteção de 0,5 s ao receber a bola, "curva mais justa" de nível e disputa com 3 resultados. O medidor de Ego fica para o Mickey desenhar.
- Sons feitos pelo Claude precisam da aprovação do Mickey como arquivo antes de entrar no jogo.
- Monetização: VIP (e depois o Módulo de cura vendido à parte) dá a conveniência idle completa; quem não paga joga manualmente. Itens só pela Loja, com Gold.
- A cada publicação: `BL.BUILD` +1 e os 16 `?v=` do `index.html` (v630: + pvp.css e pvp.js; v624: + clan.css e clan.js; v626: + rmt.css e rmt.js; v628: + gamepass.css e gamepass.js); resposta ao Mickey com o link do jogo.
