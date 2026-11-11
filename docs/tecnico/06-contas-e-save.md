# 6. Contas e salvamento

[← Índice](README.md)

Arquivos: `game/js/accounts.js` (`BL.Accounts`), `game/js/game.js` (`G.load`, `G.save`, `G.reset`, `G.newGame`, `G.recStart/recEnd`), `game/js/ui.js` (`enterAccount`, `logout`, `openAuth`, formulário `#ldForm`, `showStart`). Não existe servidor: tudo vive no `localStorage` do navegador.

## 6.1 Contas (protótipo)

As contas ficam só no navegador e servem para separar os saves de quem divide o mesmo computador.

- **Usuário**: 3 a 16 caracteres `[a-z0-9_.]`, normalizado para minúsculas (`USER_RE`).
- **Senha**: no mínimo 4 caracteres. É guardada como hash FNV-1a com sal `blpi:<usuário>:<senha>` e 64 voltas (`hash(user, pass)`), o que **não é seguro**. É só para não ficar em texto puro.
- `BL.Accounts.create(u, p)` / `login(u, p)` devolvem `{ ok, user }` ou `{ ok: false, msg }` (mensagens em pt-BR prontas para o `#ldErr`) e gravam a sessão. Criar conta pede a senha duas vezes no formulário (`#ldPass2`); criar um usuário que já existe neste navegador é recusado.
- `session()` devolve o usuário logado se a conta ainda existe; `logout()` apaga só a sessão; `count()` conta as contas (alimenta o contador da aba Sobre); `needsPassword(u)` diz se a conta migrada ainda não tem senha.
- **Migração** (`migrateLegacy`, chamada na carga do `ui.js`): um save antigo de antes das contas (`blpi_save_v1` sem sufixo) vira uma conta sem senha (`pass: null`, `migrated: true`) com o nome do jogador limpo para `[a-z0-9_.]`, 3 a 16 caracteres (colisão ganha sufixo numérico), a chave antiga é movida para `blpi_save_v1:<usuário>` e o jogo já entra nessa conta. No primeiro login, uma senha digitada com 4+ caracteres passa a valer; com menos, o login entra sem gravar senha.
- **Fluxo no jogo**: página inicial → "Minha conta" ou "▶ Jogar" → `openAuth` (Entrar/Criar) → `enterAccount(user)`: define `G.account`, grava a sessão e chama `G.load()`; com save vai direto ao jogo (`boot`), sem save abre `showStart` (nome do jogador sugerido = usuário, Tag, função e roleta do inicial → `G.newGame`). Com sessão ativa, "Jogar" entra direto sem pedir senha. `logout()` (Configurações > Conta) salva, para o laço e volta à página inicial.

## 6.2 Chaves no `localStorage`

| Chave | Conteúdo | Dono |
|---|---|---|
| `blpi_accounts` | `{ users: { <usuário>: { pass, created, migrated? } } }` | `accounts.js` |
| `blpi_session` | usuário logado | `accounts.js` |
| `blpi_save_v1:<usuário>` | o save do jogo (JSON de `G.state`) | `game.js` (`G.saveKey()`) |
| `blpi_save_v1` | save antigo, sem conta; existe só até a migração (e é a chave usada se `G.account` for nulo) | `accounts.js` |
| `blpi_matches:<usuário>` | últimas 30 partidas registradas (JSON, mais nova primeiro) | `game.js` (`recEnd`) |
| `blpi_dev` | `"1"` com o modo dev ligado (vale para o navegador, não para a conta) | `game.js` |
| `blpi_audio:<usuário>` | volumes e mudos por canal (ver [07](07-audio.md)) | `ui.js` |
| `blpi_sound`, `blpi_music` | botões antigos de som (v93), lidos só como padrão | `ui.js` |
| `blpi_market` | mercado da Casa de Leilões, igual para todas as contas do navegador (v621) | `game.js` (`G.mkRead/mkWrite`) |
| `blpi_gyms` | ginásios dos Líderes, iguais para todas as contas do navegador (v622, ver doc 04) | `game.js` (`G.gyRead/gyWrite`) |
| `blpi_float_pos` | posição das janelas flutuantes | `ui.js` |

Todo acesso ao `localStorage` está dentro de `try/catch`: sem armazenamento o jogo roda sem salvar. O `localStorage` nunca chega ao Claude; só o registro de partidas tem uma cópia no banco do artifact ([6.5](#65-registro-de-partidas)).

## 6.3 Formato do save (`G.state`)

Criado por `G.newGame(name, starter, tag)`; os demais campos entram sob demanda, por acessores que criam o padrão na primeira leitura (saves antigos continuam válidos).

```js
{
  version: 1,                             // fixo; não há migração por versão
  name, teamTag, created,
  teamName?, teamRenames?,                // troca de nome/Tag do time (1ª grátis, depois Diamantes)
  training: true,                         // começa no treino
  account: { level, xp },
  gold, diamonds?, evPoints?, vip?,
  roster: [jogador…],                     // ver 03-jogadores
  active: [uid…],                         // escalação (até 4, ordem importa)
  teamSets: [[uid…], [uid…], [uid…]], teamSel: 0, // v276: 3 times salvos (C.TEAM_SETS); o escolhido acompanha `active` (G.syncTeamSet em applyLineup/removeFromLineup); time vazio vira cópia do atual ao ser escolhido
  bench?: [uid…],                         // até 2 reservas
  inventory: [itemId…],            // itens de jogador e do treinador (v473)
  mgrEq: [itemId|null ×3], evCarry, // v473: espaços do treinador e fração de EV guardada
  chests: [{ id, source: "gol" | "partida" }],
  cons?: { agua, gatorade },              // Água e Gatorade (G.cons)
  progress: { map, stage, runSteals, runs, bossWins, repeat, unlocked2x2, cleared? },
  analyzer: { since, matches, wins, losses, xp, goldGained, goldSpent, goalsFor, goalsAgainst, steals, chests },
  settings: { speed, autoGatorade },      // speed não é lido hoje; autoGatorade = toggle do Módulo de cura
  tactics?: { <tamanho 1..4>: tacticId }, // tática escolhida por modo
  coach?: { first, last, nation, rarity },
  wildcard?: { slots, unlocked, last, acc, dropAcc },
  exped?: { level, prog, count, cur, last, cleared? },
  daily?: { day, last, streak },
  bossTeam?: [uid…],                      // seleção da equipe do Boss
  bossRun?: { boss, team, start, end, ticks, st, fake },
  skills?: [{ id, level } | null ×4],     // slots de habilidade (ainda vazios)
  matchNo?,                               // contador de partidas normais da conta
  career?: { wins, goals, steals },       // v287: totais da carreira (Jornada do Perfil)
  sleep?: { since, xph }, sleepBank?: { turbo, day, today }, // v291/v292: Modo Soneca
  trainSides?: { a: [uid], b: [uid] },   // v295: lados escolhidos no treino (null = automático)
  mail?: [{ id, at, claimed }],          // v290: Correio (texto e anexo vêm de C.MAIL_SYSTEM pelo id)
  devEqualLevel?                          // modo dev: inimigos no nível do time
}
```

Regras para campos novos: criar o valor padrão dentro de um acessor de `G` (como `G.cons()`, `G.wc()`, `G.exp()`, `G.daily()`), nunca presumir que ele já existe, e tolerar `undefined` (`|| 0`). Estruturas por jogador (`ev`, `items`) seguem a mesma regra.

Migrações e compatibilidades vivas no código:
- `G.load`: apaga `customTactics` (v142, formações personalizadas removidas) e, se a tática escolhida do 4×4 era uma delas, volta para a primeira.
- `G.exp()`: `cur` da v158 sem `lvl` vira nível 1; o antigo `xp` da Expedição vira a barra `prog` (v164).
- `G.teamTag()`: saves sem Tag usam as 3 primeiras letras do nome.
- `avatar` (v392, opcional): `{ skin, rosto, roupa, pescoco, cabelo, cabeloAc, saved }`, índices nas listas de `C.AVATAR_PARTS` (-1 = nenhum). `bossDay`/`bossSent` (v389): dia e equipe do último envio ao Boss.
- `G.tactic()`: id de tática desconhecido cai na primeira da lista do modo.
- Contas: `migrateLegacy` ([6.1](#61-contas-protótipo)).

## 6.4 Quando salva

`G.save()` grava o estado inteiro a cada mudança relevante: início e fim de partida normal (`recStart` e `endMatch`), EV, itens e baús, compras, escalação e reservas, tática, Wildcard, Expedição, Boss, Diária, troca de mapa ou fase, nome do time, técnico e os toggles do painel. Não há autosave por tempo nem durante a partida: a partida em andamento não é salva (ao recarregar começa outra). Wildcard, Expedição e Boss guardam timestamps, então o tempo offline é apurado na volta (`wcTick`, `expTick`, `bossTick`).

- `G.load()` lê o save da conta atual (`G.saveKey()` = `blpi_save_v1:<usuário>`); JSON inválido vira "sem save".
- `G.reset()` apaga só o save da conta e volta para a tela inicial (Configurações > Conta, clique duplo para confirmar). Áudio, registro de partidas e conta continuam.
- `logout()` salva, para o laço e volta para a página inicial.
- Recarregar a página volta para onde o jogador estava (treino ou fase).

## 6.5 Registro de partidas

Cada partida normal (não o treino) ganha um número por conta: `state.matchNo`, mostrado no placar como `#N · 1º TEMPO · 12'` (`#sbClock`). Serve para o Mickey citar uma partida e o Claude reconstruí-la.

- `G.recStart` (game.js) monta `G.rec`: número `no`, conta `user` (ou `"local"`), `build`, data `at`, `mode`, fase, `boss`, formações e vantagem (`tactics`, `edge`), nomes dos times, os dois times (`mine`, `them`: nome, raridade, nível, posição, nature, IV, EV, poder), `ents` (ordem dos jogadores em campo: `time:nome:papel` e `GK0/GK1`), `ev` (cada linha do log com o minuto, até 600) e `pos` (1 amostra por segundo de jogo: `[minuto, bolaX, bolaY, índice do dono ou −1, x,y de cada ent…]`, até ~400, amostrado por `m.onSample`).
- `G.recEnd` completa com placar, motivo do fim (`reason`), passes, posse, chutes, XP, Gold, quem foi roubado e a chance de roubo, `endMinute`, e grava:
  - no navegador, `localStorage["blpi_matches:<conta>"]` (últimas 30);
  - aberto no claude.ai, no banco do artifact (capability `db`, via `window.claude.use("db")`), coleção `matches`, doc `<conta>-<N>` (caracteres fora de `\w-` viram `_`, máx. 120). O Claude lê com ArtifactData `list`/`query` (`where no == N`). O artifact precisa manter `capabilities: { db: {} }` a cada republicação.
- Fora do claude.ai (arquivo local, simulações) `window.claude` não existe e só fica a cópia local; falhas de gravação são engolidas.

## 6.6 Limitações conhecidas

- Trocar de navegador ou limpar os dados do site perde contas e saves; cada navegador tem as suas contas.
- Sem servidor não há ranking real, PvP, chat real, Boss real nem proteção contra edição do save. O relógio usado por Wildcard, Expedição, Boss e Diária é o do aparelho, então pode ser adiantado à mão.
- O ranking da página inicial (`buildRanking`) mistura 10 nomes de exemplo com a conta logada, que entra pelo poder do save (`BL.teamPower`).

- **v553:** `BL.Accounts.remove(u)` apaga a conta do `blpi_accounts`, o save `blpi_save_v1:<u>`, o histórico local `blpi_matches:<u>` e a sessão, se for a atual. Usado pelo "Excluir conta e histórico" das Configurações (doc 05). O registro de partidas no banco do artifact não é apagado.

## Mercado (Casa de Leilões, v621)

Sem servidor, o mercado fica em `localStorage["blpi_market"]` (`C.MARKET.key`) e vale para todas as contas do navegador; quando o jogo ficar online, só `G.mkRead`/`G.mkWrite` mudam. Formato: `{ seq, list: [anúncio], inbox: { <conta>: [entrega] }, hist: [{ user, t, text }], sales: [{ key, cur, amt, t }] }`.

- **Anúncio**: `{ id, seller, sellerName, kind: "player"|"item", key ("p:<charId>" ou "q:/c:/s:<id>"), item, data (cópia do jogador), qty, name, mode: "fixo"|"leilao", price, cur: "gold"|"dia", start, end, end0, bids: [{ user, name, amt, t }], status: "open"|"sold"|"ended"|"cancelled", buyer?, closed? }`. Fechados somem depois de `keepDays` (7).
- **Anunciar** (`G.mkPost`): o jogador ou os itens saem do save na hora. Jogador em uso (time, reservas, Wildcard, Expedição, Boss: `G.mkBusy`) não pode, e a conta fica com pelo menos 4. Itens: os mesmos da Mochila que a Loja vende (`G.mkGoods`). Máximo `maxListings` (10) ativos.
- **Comprar** (`G.mkBuy`, só preço fixo): paga na hora; o comprador recebe e o vendedor ganha o valor menos a taxa (`fee` 5%, em diamante arredonda para cima, mínimo 1) em "A receber".
- **Lance** (`G.mkBid`): mínimo = lance inicial ou o maior + `bidStep` (5%). O valor sai na hora e fica travado; quem já liderava paga só a diferença; o lance coberto volta inteiro para quem perdeu. Lance nos últimos `snipe` (30) s prorroga o fim para 30 s depois (até `snipeMax` min além do fim original).
- **Fim** (`G.mkSettle`, chamado por `mkSync` sempre que alguém mexe no mercado): leilão com lance vai para o maior; sem lance, ou preço fixo vencido, volta para o vendedor. Cancelar (`G.mkCancel`) só sem lances.
- **A receber** (`G.mkClaim`): jogador (uid novo se colidir), itens (Mochila ou consumíveis) e Gold/Diamantes entram no save quando a conta abre a Casa de Leilões.
- Preço de referência (`G.mkPriceRef`): mediana de 7 dias, última venda e menor anúncio aberto, pelo `key` e pela moeda.


## Exportar e importar save (v680)

Configurações > Conta: "Exportar save" baixa `bl-save-<conta>-v<build>.json` (`{ blpi, build, account, state }`); "Importar save" lê o arquivo, valida (`roster`, `progress`, `account`), pede um segundo clique e troca o `state` da conta atual, recarregando a página.
