// Valida o JWT do Supabase mandado pelo navegador (Authorization: Bearer ...)
// e confirma que o usuário é gestor da empresa que ele diz estar chamando —
// usando um cliente Supabase com a ANON key + o JWT do chamador (respeita RLS
// normalmente, igual o navegador faria — o microsserviço NÃO usa service_role
// pra essa checagem, só pra chamar as 3 RPCs exclusivas dele).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

/**
 * @param {string} bearerToken - valor do header Authorization (sem "Bearer ")
 * @param {string} empresaId
 * @throws {Error} se não autenticado ou não for gestor da empresa
 * @returns {string} user_id de quem chamou
 */
export async function exigirGestorDaEmpresa(bearerToken, empresaId) {
  if (!bearerToken) throw new Error("Não autenticado — token ausente.");

  const clienteDoChamador = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await clienteDoChamador.auth.getUser(bearerToken);
  if (userError || !userData?.user) throw new Error("Token inválido ou expirado.");

  // meu_perfil() já existe no banco e é SECURITY DEFINER escopado por
  // auth.uid() — reusa a mesma função que todo o resto do app usa, em vez de
  // reimplementar a checagem de perfil aqui.
  const { data: perfil, error: perfilError } = await clienteDoChamador.rpc("meu_perfil", {
    p_empresa: empresaId,
  });
  if (perfilError) throw new Error(`Falha ao checar perfil: ${perfilError.message}`);
  if (perfil !== "gestor") throw new Error("Só o gestor da empresa pode fazer isso.");

  return userData.user.id;
}
