-- delta44 — GESTÃO leva 2: marcar relatório (insights) como lido
-- Aplicado via Management API em 2026-11-12. 100% aditivo (só cria função).
--
-- A tabela `insights` só tem policy de SELECT ("membro le insights"); não há
-- policy de UPDATE, então o gestor NÃO consegue marcar status direto pela API.
-- Em vez de abrir uma policy de UPDATE ampla (arriscada — deixaria o cliente
-- reescrever qualquer coluna de insights), uma RPC SECURITY DEFINER mínima que
-- só troca `status` para 'lido' e confere, por dentro, que o usuário é membro
-- da empresa do insight (minhas_empresas()).
create or replace function marcar_insight_lido(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v int;
begin
  update insights set status = 'lido'
   where id = p_id
     and empresa_id in (select minhas_empresas());
  get diagnostics v = row_count;
  return v > 0;  -- false se o id não existe ou não é da empresa do usuário
end;
$$;
revoke all on function marcar_insight_lido(uuid) from public;
grant execute on function marcar_insight_lido(uuid) to authenticated;

-- Itens C/D/E da leva 2 (Pix/cobrança, revisões/garantias, link de avaliação do
-- Google) NÃO exigem schema novo — vivem em empresas.config (CFG): pix_chave,
-- pix_nome, pix_cidade, notif_cobranca, avaliacao_google.
