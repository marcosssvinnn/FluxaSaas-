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
  buscarOS,
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

// ── Emissão de NFS-e a partir de uma OS concluída ────────────────────────
// Gatilho mudou de "orçamento aprovado" pra "OS concluída" (17/08) — fato
// gerador do ISS é o serviço PRESTADO, não o orçamento aceito, confirmado
// por documento do contador. Nem todo orçamento aprovado vira execução na
// hora, então emitir na aprovação datava a nota errado.
app.post("/emitir", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
    const { empresaId, osId, codigoTributacaoNacional, ambiente } = req.body;

    if (!empresaId || !osId) {
      return res.status(400).json({ erro: "Faltam campos: empresaId, osId." });
    }

    await exigirGestorDaEmpresa(bearerToken, empresaId);

    const os = await buscarOS(osId, empresaId);
    if (os.status !== "concluido") {
      return res.status(400).json({ erro: "Só OS concluída pode gerar nota fiscal — o fato gerador do ISS é o serviço prestado, não o orçamento aprovado." });
    }
    if (!os.loja_id) {
      return res.status(400).json({ erro: "OS sem loja vinculada — não dá pra saber qual CNPJ emite a nota." });
    }

    // ⚠️ Achado ao ligar isto na OS (17/08): não existe coluna de CPF em
    // NENHUMA tabela do schema (nem orcamentos, nem ordens_servico) — só
    // CNPJ. Pra cliente pessoa física (que o Marcos confirmou ser parte
    // real do negócio: "casas e residências de veraneio"), a nota de
    // serviço EXIGE um documento do tomador (CPF ou CNPJ) — sem isso a
    // SEFIN Nacional rejeita. Bloqueia aqui, cedo, com mensagem clara, em
    // vez de deixar montarXmlDPS() quebrar tentando formatar `undefined`.
    // Resolver de vez precisa de uma coluna nova (orcamentos.cpf_cliente
    // e/ou ordens_servico.cpf_cliente) + campo no formulário — não fiz
    // isso agora pra não misturar esquema fiscal com schema de cadastro
    // sem o Marcos decidir onde esse campo deveria morar (no cliente? no
    // orçamento? nos dois?).
    if (!os.cnpj) {
      return res.status(400).json({
        erro: "OS sem CNPJ do cliente e sem campo de CPF no sistema (ainda não existe coluna de CPF no schema). Nota fiscal de serviço exige documento do tomador — não dá pra emitir pra cliente pessoa física até isso ser resolvido no cadastro.",
      });
    }

    const dadosFiscaisLoja = await buscarDadosFiscaisLoja(os.loja_id);

    // Ambiente de produção fica bloqueado até o bloco de tributação (regTrib/
    // opSimpNac=2 — declaração de MEI, ver dps.js) ser validado contra a
    // SEFIN Nacional de verdade. A fonte dos nomes de campo (17/08) é um SDK
    // de terceiros que mapeia o schema oficial, não o XSD/manual do governo
    // relido nem um round-trip real — melhor confiança que uma adivinhação
    // do zero, mas ainda não confirmado. Homologação continua liberada (é
    // exatamente onde essa validação precisa acontecer, com o Marcos
    // presente e o certificado real — Marco 0, passo 4 do plano).
    if (ambiente === "producao") {
      return res.status(400).json({
        erro: "Emissão em produção ainda bloqueada — a declaração de tributação do MEI (regTrib/opSimpNac) ainda não foi confirmada por um teste real contra a SEFIN Nacional. Use homologação primeiro.",
      });
    }

    // A discriminação/valores da DPS continuam vindo do ORÇAMENTO de
    // origem (tem subtotal/desconto detalhados; a OS só guarda o total já
    // líquido) quando existir um; OS avulsa (sem orçamento por trás) usa os
    // próprios servicos/total dela, sem desconto — end-to-end nunca foi
    // testado com esse caminho ainda (ver CLAUDE.md).
    const origemValores = os.orcamento_id
      ? await buscarOrcamento(os.orcamento_id, empresaId)
      : { servicos: os.servicos, subtotal: os.total, desconto: 0, total: os.total };

    const referencia = `OS-${os.numero}-${Date.now()}`;

    // registro 'pendente' ANTES de tentar emitir — se der erro no meio, fica
    // registrado que a tentativa aconteceu (auditoria), não desaparece.
    const notaPendente = await gravarNotaFiscal({
      empresa_id: empresaId,
      loja_id: os.loja_id || null,
      orcamento_id: os.orcamento_id || null,
      os_id: osId,
      tipo: "nfse",
      referencia,
      status: "pendente",
    });

    try {
      const { pfxBase64, senha } = await obterCertificado(empresaId);
      const { keyPem, certPem } = extrairChaveECertificado(Buffer.from(pfxBase64, "base64"), senha);

      // Código IBGE vem de lojas.codigo_ibge (setup-v2-delta22.sql),
      // verificado contra a API oficial do IBGE. município de emissão E de
      // prestação usam o MESMO valor — ver comentário em dps.js sobre o
      // subitem 14.01 não ser exceção de local (achado do contador, 17/08).
      const idDPS = `DPS${randomUUID().replace(/-/g, "")}`;
      const xmlSemAssinar = montarXmlDPS({
        idDPS,
        ambiente: ambiente === "producao" ? "1" : "2",
        dataEmissao: new Date().toISOString(),
        serie: "00001",
        numeroDPS: String(os.numero),
        competencia: new Date().toISOString().slice(0, 10),
        municipioEmissaoIbge: dadosFiscaisLoja.codigo_ibge,
        municipioPrestacaoIbge: dadosFiscaisLoja.codigo_ibge,
        prestadorCnpj: dadosFiscaisLoja.cnpj.replace(/\D/g, ""),
        prestadorNome: dadosFiscaisLoja.razao_social || dadosFiscaisLoja.cnpj,
        // Só CNPJ por enquanto — ver bloqueio de "!os.cnpj" acima (não há
        // coluna de CPF no schema ainda).
        tomadorDoc: { tipo: "CNPJ", valor: os.cnpj.replace(/\D/g, "") },
        tomadorNome: os.cliente,
        codigoTributacaoNacional,
        regimeTributario: dadosFiscaisLoja.regime_tributario,
        orcamento: origemValores,
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
