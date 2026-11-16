# Banco do BL PROJECT IDLE (Supabase, projeto bl-project-idle, ref jzlvxvkqriojxwtzbqyu, região São Paulo)

Aplicado em 2026-11-13 (v712). Ordem: 001 init_saves, 002 funções save_game/diamond_drop.
A versão de 3 argumentos de save_game (antiga) ainda existe no banco, sem uso e sem permissão para ninguém além do dono.
003 (v713): anti-trapaça. Tabela `limites` (números editáveis no painel), `alertas` (cada save barrado, com antes/depois), `profiles.banido` (marque true para bloquear a conta). Função `save_game_v2` usada pela Edge Function `save`.
004 (2026-11-13): limites novos (itens, baús, consumíveis, habilidades, Game Pass) e função `save_game_v3` (aceita p_gold_extra). Edge Function `save` v3 usa `check.ts`. pg_net ligado só para testes (chamar as funções a partir do SQL). Conta de teste `zz_robo_teste` ficou no Auth (pode apagar no painel).
