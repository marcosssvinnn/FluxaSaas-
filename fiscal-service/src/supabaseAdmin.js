// Cliente Supabase com a service_role key — só pra chamar as 3 funções
// exclusivas do microsserviço (consumir_token_upload_certificado,
// salvar_certificado_empresa, obter_certificado_empresa) e ler
// orçamentos/gravar notas_fiscais. NUNCA usar essa chave em código que roda
// no navegador — é só pra esse processo de servidor.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configurados " +
      "(variáveis de ambiente / secrets do host) antes de iniciar o serviço."
  );
}

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function consumirTokenUpload(token) {
  const { data, error } = await supabaseAdmin.rpc("consumir_token_upload_certificado", {
    p_token: token,
  });
  if (error) throw new Error(`Token de upload inválido: ${error.message}`);
  if (!data) throw new Error("Token de upload expirado, já usado, ou inválido.");
  return data; // empresa_id
}

export async function salvarCertificado(empresaId, pfxBase64, senha, cn, validoAte) {
  const { error } = await supabaseAdmin.rpc("salvar_certificado_empresa", {
    p_empresa: empresaId,
    p_pfx_base64: pfxBase64,
    p_senha: senha,
    p_cn: cn,
    p_valido_ate: validoAte,
  });
  if (error) throw new Error(`Falha ao salvar certificado: ${error.message}`);
}

export async function obterCertificado(empresaId) {
  const { data, error } = await supabaseAdmin.rpc("obter_certificado_empresa", {
    p_empresa: empresaId,
  });
  if (error) throw new Error(`Falha ao ler certificado: ${error.message}`);
  const linha = data?.[0];
  if (!linha) throw new Error("Empresa não tem certificado fiscal configurado.");
  return { pfxBase64: linha.pfx_base64, senha: linha.senha };
}

export async function buscarOrcamento(orcamentoId, empresaId) {
  // Usa service_role (ignora RLS) mas FILTRA por empresa_id explicitamente —
  // o filtro por empresa vem de auth.js (validado contra o JWT do chamador),
  // nunca confiar em empresa_id vindo só do corpo da requisição sem essa
  // validação prévia.
  const { data, error } = await supabaseAdmin
    .from("orcamentos")
    .select("*")
    .eq("id", orcamentoId)
    .eq("empresa_id", empresaId)
    .single();
  if (error) throw new Error(`Orçamento não encontrado: ${error.message}`);
  return data;
}

// O CNPJ/razão social do PRESTADOR (a empresa que emite a nota) vive em
// `lojas`, não no orçamento — schema já tem esses campos fiscais (cnpj,
// razao_social, inscricao_municipal, regime_tributario, codigo_servico_municipal,
// iss_aliquota), só não tinham UI pra preencher até agora. Buscar aqui em vez
// de supor um campo solto no orçamento.
export async function buscarDadosFiscaisLoja(lojaId) {
  const { data, error } = await supabaseAdmin
    .from("lojas")
    .select("cnpj, razao_social, inscricao_municipal, regime_tributario, codigo_servico_municipal, iss_aliquota, cidade, codigo_ibge")
    .eq("id", lojaId)
    .single();
  if (error) throw new Error(`Dados fiscais da loja não encontrados: ${error.message}`);
  if (!data.cnpj) throw new Error("Loja sem CNPJ cadastrado — preencha em Configurações antes de emitir nota.");
  if (!data.codigo_ibge) throw new Error("Loja sem código IBGE do município cadastrado — preencha em Configurações antes de emitir nota.");
  return data;
}

export async function gravarNotaFiscal(registro) {
  const { data, error } = await supabaseAdmin.from("notas_fiscais").insert(registro).select().single();
  if (error) throw new Error(`Falha ao gravar nota fiscal: ${error.message}`);
  return data;
}

export async function atualizarNotaFiscal(id, mudancas) {
  const { error } = await supabaseAdmin.from("notas_fiscais").update(mudancas).eq("id", id);
  if (error) throw new Error(`Falha ao atualizar nota fiscal: ${error.message}`);
}
