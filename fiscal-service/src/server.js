// Microsserviço fiscal do Fluxa v2 — assina e envia NFS-e (Sistema Nacional)
// usando o certificado A1 de cada empresa. Ver README.md deste diretório pra
// contexto completo (por que isto existe como serviço separado, em vez de uma
// Supabase Edge Function) e instruções de deploy.

import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";

import { exigirGestorDaEmpresa } from "./auth.js";
import {
  consumirTokenUpload,
  salvarCertificado,
  obterCertificado,
  buscarOrcamento,
  buscarDadosFiscaisLoja,
  gravarNotaFiscal,
  atualizarNotaFiscal,
} from "./supabaseAdmin.js";
import { extrairChaveECertificado } from "./certificado.js";
import { montarXmlDPS } from "./dps.js";
import { assinarDPS, verificarAssinatura } from "./assinatura.js";
import { enviarDPS } from "./sefinClient.js";

const app = express();
app.use(express.json());
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB — .pfx é sempre pequeno

// ── Upload do certificado ────────────────────────────────────────────────
// Fluxo completo: ver comentário no topo de setup-v2-delta21.sql.
// O navegador já chamou iniciar_upload_certificado() (authenticated) antes
// disto e recebeu um token — manda o arquivo direto pra cá, nunca pelo Postgres.
app.post("/certificado/upload", upload.single("pfx"), async (req, res) => {
  try {
    const { token, senha } = req.body;
    if (!token || !senha || !req.file) {
      return res.status(400).json({ erro: "Faltam campos: token, senha, arquivo pfx." });
    }

    const empresaId = await consumirTokenUpload(token);

    const { keyPem, certPem, cn, validoAte } = extrairChaveECertificado(req.file.buffer, senha);

    // salva o .pfx original (não a chave/cert já extraídos) — assim a extração
    // roda de novo, do zero, toda vez que for assinar uma nota, sem manter
    // chave privada "solta" fora do Vault em nenhum momento além do necessário
    // pra esta requisição em memória.
    await salvarCertificado(empresaId, req.file.buffer.toString("base64"), senha, cn, validoAte.toISOString());

    // NUNCA retorna o arquivo, a senha, ou a chave — só o que é seguro exibir.
    res.json({ ok: true, cn, validoAte: validoAte.toISOString() });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

// ── Emissão de NFS-e a partir de um orçamento aprovado ──────────────────
app.post("/emitir", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
    const { empresaId, orcamentoId, codigoTributacaoNacional, ambiente } = req.body;

    if (!empresaId || !orcamentoId) {
      return res.status(400).json({ erro: "Faltam campos: empresaId, orcamentoId." });
    }

    await exigirGestorDaEmpresa(bearerToken, empresaId);

    const orcamento = await buscarOrcamento(orcamentoId, empresaId);
    if (orcamento.status !== "aprovado") {
      return res.status(400).json({ erro: "Só orçamento aprovado pode gerar nota fiscal." });
    }
    if (!orcamento.loja_id) {
      return res.status(400).json({ erro: "Orçamento sem loja vinculada — não dá pra saber qual CNPJ emite a nota." });
    }
    // Achado confirmado pelo Marcos (LC 116/2003, art. 3º VII + subitem 7.10):
    // manutenção/limpeza de piscina tem o ISS devido no MUNICÍPIO ONDE O
    // SERVIÇO FOI EXECUTADO, não onde a empresa está sediada. Por isso exige
    // orcamento.municipio_servico_ibge (setup-v2-delta23.sql) — sem isso,
    // BLOQUEIA a emissão em vez de assumir a cidade da sede (que sairia
    // errada sempre que o serviço não for na mesma cidade da loja).
    if (!orcamento.municipio_servico_ibge) {
      return res.status(400).json({
        erro: "Orçamento sem cidade do serviço definida — obrigatório pra manutenção/limpeza de piscina (ISS é devido onde o serviço foi prestado, não na sede da empresa). Selecione a cidade no orçamento antes de emitir.",
      });
    }
    const dadosFiscaisLoja = await buscarDadosFiscaisLoja(orcamento.loja_id);

    const referencia = `ORC-${orcamento.numero}-${Date.now()}`;

    // registro 'pendente' ANTES de tentar emitir — se der erro no meio, fica
    // registrado que a tentativa aconteceu (auditoria), não desaparece.
    const notaPendente = await gravarNotaFiscal({
      empresa_id: empresaId,
      loja_id: orcamento.loja_id || null,
      orcamento_id: orcamentoId,
      tipo: "nfse",
      referencia,
      status: "pendente",
    });

    try {
      const { pfxBase64, senha } = await obterCertificado(empresaId);
      const { keyPem, certPem } = extrairChaveECertificado(Buffer.from(pfxBase64, "base64"), senha);

      // Código IBGE agora vem de lojas.codigo_ibge (setup-v2-delta22.sql) —
      // gap fechado. Antes exigia isso explicitamente no corpo da requisição
      // pra evitar mandar um código adivinhado; agora vem de um cadastro real,
      // verificado contra a API oficial do IBGE (achado: o código antigo do
      // código morto do v1 pra Itapema estava ERRADO — era o de Itapoá).

      const idDPS = `DPS${randomUUID().replace(/-/g, "")}`;
      const xmlSemAssinar = montarXmlDPS({
        idDPS,
        ambiente: ambiente === "producao" ? "1" : "2",
        dataEmissao: new Date().toISOString(),
        serie: "00001",
        numeroDPS: String(orcamento.numero),
        competencia: new Date().toISOString().slice(0, 10),
        municipioEmissaoIbge: dadosFiscaisLoja.codigo_ibge,
        municipioPrestacaoIbge: orcamento.municipio_servico_ibge,
        prestadorCnpj: dadosFiscaisLoja.cnpj.replace(/\D/g, ""),
        prestadorNome: dadosFiscaisLoja.razao_social || dadosFiscaisLoja.cnpj,
        tomadorDoc: orcamento.cnpj
          ? { tipo: "CNPJ", valor: orcamento.cnpj.replace(/\D/g, "") }
          : { tipo: "CPF", valor: (orcamento.cpf_cliente || "").replace(/\D/g, "") },
        tomadorNome: orcamento.cliente,
        codigoTributacaoNacional,
        orcamento,
      });

      const xmlAssinado = assinarDPS(xmlSemAssinar, idDPS, keyPem, certPem);
      verificarAssinatura(xmlAssinado, certPem); // aborta se a própria verificação falhar

      const resposta = await enviarDPS(xmlAssinado, keyPem, certPem, ambiente === "producao" ? "producao" : "homologacao");

      await atualizarNotaFiscal(notaPendente.id, {
        status: resposta.status >= 200 && resposta.status < 300 ? "autorizada" : "rejeitada",
        xml_autorizado: xmlAssinado,
        dados_envio: { statusHttp: resposta.status, respostaResumo: resposta.corpo.slice(0, 2000) },
      });

      res.json({ ok: true, notaFiscalId: notaPendente.id, statusHttp: resposta.status, resposta: resposta.corpo });
    } catch (erroInterno) {
      await atualizarNotaFiscal(notaPendente.id, {
        status: "rejeitada",
        motivo_rejeicao: erroInterno.message,
      });
      throw erroInterno;
    }
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get("/saude", (_req, res) => res.json({ ok: true }));

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => console.log(`fiscal-service ouvindo na porta ${PORTA}`));
