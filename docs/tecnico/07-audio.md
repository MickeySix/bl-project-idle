# 7. Áudio

[← Índice](README.md)

Arquivos: `game/js/ui.js` (funções de som, `AUDIO_CH`, `vol`, `music`, `BL.sfx`, `SETTINGS_TABS`), `game/js/game.js` (`G.onMatchEvent` dispara os sons), `game/snd/*.mp3`. O motor não toca som: ele emite eventos (`onEvent("pass" | "save" | "dribble" | "tackle" | "goal"…)`), e `G.onMatchEvent` chama `BL.sfx(nome)`.

## 7.1 Sons

| Canal (`AUDIO_CH`) | Arquivo | Quando toca (evento do motor) | Origem | Intervalo mínimo |
|---|---|---|---|---|
| `goal` | `snd/gol.mp3` | `goal` do seu time | Claude ("arcade"), aprovado v87 | |
| `goalAgainst` | `snd/golsofrido.mp3` | `goal` do adversário | arquivo do Mickey (v96) | |
| `dribble` | `snd/drible.mp3` | `dribble` do seu time | Claude ("swoosh"), v88 | 0,3 s |
| `dribbleEnemy` | `snd/drible-inimigo.mp3` | `dribble` do adversário | arquivo do Mickey (v97) | 0,3 s |
| `pass` | `snd/passe.mp3` | todo `pass` (passe tentado), dos dois times | Claude, opção 3 "bolha" (v98) | 0,15 s |
| `stolen` | `snd/roubo.mp3` | `tackle`: roubo de bola de qualquer time | arquivo do Mickey (v91) | 0,5 s |
| `parry` | `snd/espalma.mp3` | `save` com `parry`: goleiro espalma | arquivo do Mickey (v90) | 0,5 s |
| `shot` | `snd/espalma.mp3` (velocidade 1,25) | `shot` dos dois times | arquivo do Mickey, reaproveitado v576 até ele mandar um som próprio de chute | 0,3 s |
| `save` | `snd/defesa.mp3` | `save` sem `parry`: goleiro segura | arquivo do Mickey (v92) | 0,5 s |
| `music` | `snd/musica.mp3` | fundo, em loop, na página inicial e no jogo todo | "TRILHA SONORA FASES NORMAIS" do Mickey (v93) | |
| `ui` | gerado (Web Audio) | "tic" ao clicar num card da escolha do inicial (`tick`) e fanfarra ao confirmar (`fanfare`) | código | |

- Os mp3 são carregados com `?v=<BUILD>` para furar o cache. Gol e gol sofrido reiniciam um único `Audio`; os outros clonam o elemento (`cloneNode`) se ele ainda estiver tocando, então sons rápidos se sobrepõem.
- Nenhum efeito toca com a aba oculta (`document.hidden`) ou com volume 0.
- `crowd()` (torcida gerada por ruído filtrado, aceita `BL.sfx("crowd")`) existe no código, mas ninguém a chama: não toca no roubo de bola (decisão do Mickey). A roleta de roubo da vitória (`stealRoulette`) e as janelas de Boss, Expedição e Diária não têm som.
- A música só começa depois do primeiro clique (exigência dos navegadores; o `pointerdown` `{ once: true }` libera o `AudioContext` e liga `bgmReady`), é reavaliada (`music()`) ao mexer em volume, entrar/sair de conta e trocar a visibilidade da aba (`visibilitychange` pausa quando oculta).
- Hoje há uma só música (a de fases normais); uma separada para os Bosses pode vir depois.

## 7.2 Volume

```
vol(canal) = Geral × grupo × canal        (cada parte 0..1; mudo = 0)
grupo = "Efeitos sonoros" para os efeitos; a música não passa pelo grupo de efeitos
```

| Canal | Padrão |
|---|---|
| Volume geral (`master`) | 100% |
| Música de fundo (`music`) | 40% |
| Efeitos sonoros (`sfx`, grupo) | 100% |
| Gol, Gol sofrido, Passe, Roubo de bola, Chute, Espalmada, Defesa | 45% |
| Drible, Drible do adversário | 38% |
| Roleta e menus (`ui`) | 100% |

Configurações (engrenagem) > Áudio (`SETTINGS_TABS[0]`): um controle deslizante e um botão de mudo por canal, linhas dos efeitos indentadas sob "Efeitos sonoros". Ao soltar o controle o som toca para teste (`testSound`, usando o campo `test` do canal; Geral e Efeitos testam o som de gol). "Restaurar padrão" volta aos valores acima e limpa as chaves antigas. Tudo fica salvo por conta em `blpi_audio:<usuário>` (`{ <canal>: { v: 0..100, mute } }`; ver [06](06-contas-e-save.md)); sem conta, a chave é só `blpi_audio`. Os botões antigos de som (v93, chaves `blpi_sound` / `blpi_music` = `"off"`) ainda entram como mudo padrão do grupo/música.

## 7.3 Regras do projeto

- Som feito pelo Claude precisa ser aprovado pelo Mickey como arquivo antes de entrar. Os candidatos ficam em `docs/sons/` (ex.: `passe-1-toque.mp3`, `gol-2-estadio.mp3`, `espalma-1-luva.mp3`, `drible-2-zip.mp3`).
- Arquivos enviados pelo próprio Mickey entram direto.
- Os nomes dos arquivos de som precisam ser distintos (o upload do drible inimigo chegou como `drible.mp3`).
- Para publicar, use os mp3 de `dev/sim/snd-pub/`: o mount mostra tamanhos estranhos para `game/snd/` (ver [09](09-build-publicacao-e-simulacao.md)).

## 7.4 Como adicionar um som

1. Coloque o arquivo em `game/snd/` (e em `dev/sim/snd-pub/`).
2. Crie a função no padrão das existentes em `ui.js` (`let xSnd = null, lastX = 0; function xSound() {…}` com intervalo mínimo e `vol("<canal>")`).
3. Adicione uma linha em `AUDIO_CH` (com `group: "sfx"`, `def` e `test`) e o caso em `testSound`.
4. Adicione o nome em `BL.sfx = (kind) => …` (`ui.js`) e chame `BL.sfx("<nome>")` no evento certo em `G.onMatchEvent` (`game.js`); se o evento ainda não existe, o motor o emite com `this.onEvent(...)`.
5. Inclua o arquivo na lista de publicação.
- v576: caneta, drible da vaca e puxada (X1) tocam o som do drible quando a bola sai do pé (evento `trickGo`, sem som de passe); na retomada da bola o evento `dribble` vem com `noSnd`.
