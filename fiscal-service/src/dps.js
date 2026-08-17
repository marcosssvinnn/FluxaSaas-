// Constrói a discriminação/valores da DPS a partir de um orçamento do Fluxa.
// Lógica validada em Python (ver scratchpad da sessão — 3 cenários: com
// desconto, sem desconto, e total inconsistente) antes de portar pra cá.
//
// Achado do spike de assinatura (ver CLAUDE.md): a DPS NÃO tem itens/quantidade
// estruturados — só um campo de texto livre (xDescServ, até 2000 caracteres)
// e valores agregados (vServ = bruto, vDescIncond = desconto incondicionado).
// O código morto do v1 (emitirNota() em app.js) colapsava os itens numa frase
// só, sem preço nem quantidade, e ignorava o desconto por completo — aqui
// corrige os dois problemas.

const LIMITE_XDESCSERV = 2000;

/**
 * @param {object} orcamento - linha de `orcamentos` (schema real: servicos
 *   jsonb = [{desc,preco,precoUnit,qty,produto_id}], subtotal, desconto, total)
 * @returns {{ xDescServ: string, vServ: string, vDescIncond: string|null }}
 * @throws {Error} se o orçamento tiver dados inconsistentes (subtotal-desconto
 *   != total) ou a descrição exceder o limite do campo — nesses casos a
 *   emissão deve ser BLOQUEADA, nunca mandar um número errado pro governo.
 */
export function construirDiscriminacaoEValores(orcamento) {
  const linhas = [];
  let somaItens = 0;

  for (const item of orcamento.servicos || []) {
    const qty = item.qty || 1;
    const precoUnit = item.precoUnit || 0;
    const precoTotalItem = item.preco != null ? item.preco : qty * precoUnit;
    somaItens += precoTotalItem;
    linhas.push(
      `${item.desc} (qtd ${qty} x R$ ${precoUnit.toFixed(2)} = R$ ${precoTotalItem.toFixed(2)})`
    );
  }

  const subtotal = orcamento.subtotal != null ? orcamento.subtotal : somaItens;
  const desconto = orcamento.desconto || 0;
  const total = orcamento.total != null ? orcamento.total : subtotal - desconto;

  const esperado = Math.round((subtotal - desconto) * 100) / 100;
  if (Math.abs(esperado - Math.round(total * 100) / 100) > 0.01) {
    throw new Error(
      `Inconsistência: subtotal(${subtotal}) - desconto(${desconto}) = ${esperado}, ` +
        `mas o total do orçamento é ${total}. Emissão bloqueada — corrija o ` +
        `orçamento antes de emitir a nota.`
    );
  }

  let discriminacao = linhas.join("; ");
  discriminacao +=
    desconto > 0
      ? `. Valor bruto: R$ ${subtotal.toFixed(2)}. Desconto: R$ ${desconto.toFixed(2)}. Valor líquido: R$ ${total.toFixed(2)}.`
      : `. Valor total: R$ ${total.toFixed(2)}.`;

  if (discriminacao.length > LIMITE_XDESCSERV) {
    throw new Error(
      `Discriminação excede ${LIMITE_XDESCSERV} caracteres (limite do campo ` +
        `xDescServ da DPS): ${discriminacao.length} caracteres. Orçamento tem ` +
        `itens demais ou descrições longas demais pra caber numa nota.`
    );
  }

  return {
    xDescServ: discriminacao,
    vServ: subtotal.toFixed(2),
    vDescIncond: desconto > 0 ? desconto.toFixed(2) : null,
  };
}

/**
 * Monta o XML mínimo da DPS (estrutura conferida contra o XSD oficial
 * DPS_v1.01.xsd / tiposComplexos_v1.01.xsd — não adivinhada). Retorna string
 * XML SEM assinatura; quem chama assina em seguida (ver assinatura.js).
 *
 * IMPORTANTE (achado do spike): o namespace precisa estar declarado no MESMO
 * elemento que carrega o Id assinado (infDPS), não herdado de um ancestral —
 * senão a verificação da assinatura falha.
 */
// Regimes tributários já suportados pela declaração de tributação abaixo.
// Qualquer outro valor BLOQUEIA a emissão de propósito — ver comentário em
// montarXmlDPS(). Lista fecha aqui até o dia em que a Fluxa (ou outra
// empresa do SaaS) sair do MEI e este arquivo ganhar o bloco de ME/Simples.
const REGIMES_SUPORTADOS = ["mei"];

export function montarXmlDPS({
  idDPS,
  ambiente, // '1' produção | '2' homologação
  dataEmissao, // ISO 8601 com timezone, ex: '2026-07-20T21:00:00-03:00'
  serie,
  numeroDPS,
  competencia, // 'YYYY-MM-DD'
  municipioEmissaoIbge, // cLocEmi — cidade da SEDE da empresa (lojas.codigo_ibge)
  municipioPrestacaoIbge, // cLocPrestacao — sempre o MESMO valor que
  // municipioEmissaoIbge nesta versão. Achado confirmado por documento do
  // contador (17/08): o serviço real da Fluxa piscinas — substituição de
  // motobomba/aquecedor/filtro/areia, manutenção de equipamento — é o
  // subitem 14.01 da lista da LC 116/2003 ("manutenção e conservação de
  // máquinas, equipamentos... exceto peças, que ficam sujeitas ao ICMS"),
  // NÃO o 7.10 (limpeza/manutenção de piscinas propriamente, que teria sido
  // a leitura anterior deste código). O art. 3º da LC 116/2003 só manda o
  // ISS pro município da EXECUÇÃO nos incisos de exceção (7.10 é um deles);
  // 14.01 não está na lista de exceções, então o ISS é sempre devido no
  // município da SEDE do prestador — os dois parâmetros continuam
  // separados aqui só porque são elementos XML distintos no schema
  // (cLocEmi/cLocPrestacao), não porque o valor deles deva divergir na
  // prática da Fluxa hoje. Se a empresa um dia também prestar serviço de
  // limpeza/tratamento químico (aí sim 7.10), municipioPrestacaoIbge
  // precisaria vir do endereço do cliente de novo — mas isso é uma
  // pergunta de produto nova, não a regra atual.
  prestadorCnpj,
  prestadorNome,
  tomadorDoc, // { tipo: 'CNPJ'|'CPF', valor }
  tomadorNome,
  codigoTributacaoNacional,
  regimeTributario, // 'mei' — ver REGIMES_SUPORTADOS acima
  orcamento,
}) {
  if (!REGIMES_SUPORTADOS.includes(regimeTributario)) {
    throw new Error(
      `Regime tributário "${regimeTributario}" não suportado por este emissor. ` +
        `Só "mei" está implementado (ISS fixo no DAS, sem alíquota na nota — ` +
        `Resolução CGSN 140/2018 art. 103 IV). Bloqueado de propósito: declarar ` +
        `tributação errada numa nota real é pior que não emitir.`
    );
  }

  const { xDescServ, vServ, vDescIncond } = construirDiscriminacaoEValores(orcamento);
  const escapeXml = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const descCondIncond = vDescIncond
    ? `<vDescCondIncond><vDescIncond>${vDescIncond}</vDescIncond></vDescCondIncond>`
    : "";

  // Regime tributário do PRESTADOR — declara "sou MEI" pro governo, dentro
  // de <prest>. Achado em 17/08 pesquisando o SDK open-source
  // nfse-nacional/nfse-php (github.com/nfse-nacional/nfse-php,
  // RegimeTributarioData.php), que mapeia os campos do schema oficial do
  // Sistema Nacional NFS-e — não é a fonte primária (XSD/manual do
  // gov.br/nfse), mas é uma implementação de terceiros documentada e
  // consistente com tudo que já sabíamos (a lista de valores bate:
  // 1=Não optante, 2=Optante MEI, 3=Optante ME/EPP). `opSimpNac=2` é o
  // valor de MEI; `regEspTrib=0` é "nenhum regime especial" (não é
  // cooperativa/cartório/profissional autônomo etc., que teriam outros
  // códigos). `regApTribSN` (regime de apuração SN) só é exigido quando
  // opSimpNac=3 (ME/EPP) — omitido aqui de propósito, não se aplica a MEI.
  const regTrib = `<regTrib><opSimpNac>2</opSimpNac><regEspTrib>0</regEspTrib></regTrib>`;

  // Tributação da OPERAÇÃO (dentro de <valores>) — separado do regime do
  // prestador acima. tribISSQN=1 (operação tributável normalmente — não é
  // exportação/imunidade/não-incidência) e tpRetISSQN=1 (não retido —
  // retenção de ISS é VEDADA pro MEI por lei, Resolução CGSN 140/2018 art.
  // 103 IV, confirmado pelo contador). NÃO inclui pAliq/vISSQN: são campos
  // opcionais no schema (confirmado no mesmo SDK) e o MEI não calcula ISS
  // por nota — é valor fixo dentro do DAS, não faz sentido destacar uma
  // alíquota/valor aqui. Se a SEFIN Nacional rejeitar por exigir algum
  // desses, o retorno do teste em homologação (Marco 0) vai dizer
  // exatamente o quê — não adivinhar de novo antes disso.
  const trib = `<trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN></tribMun></trib>`;

  // ⚠️ Ainda pendente de verificação real (Marco 0, passo 4): este bloco
  // nunca foi testado contra a SEFIN Nacional de verdade. A fonte dos
  // nomes de campo é um SDK de terceiros, não o XSD oficial relido nem um
  // round-trip real — por isso ambiente:'producao' continua bloqueado em
  // server.js até um teste real em homologação confirmar que isso é aceito
  // (ou dizer o que falta).
  return (
    `<DPS>` +
    `<infDPS xmlns="http://www.sped.fazenda.gov.br/nfse" Id="${idDPS}">` +
    `<tpAmb>${ambiente}</tpAmb>` +
    `<dhEmi>${dataEmissao}</dhEmi>` +
    `<verAplic>Fluxa1.0</verAplic>` +
    `<serie>${serie}</serie>` +
    `<nDPS>${numeroDPS}</nDPS>` +
    `<dCompet>${competencia}</dCompet>` +
    `<tpEmit>1</tpEmit>` +
    `<cLocEmi>${municipioEmissaoIbge}</cLocEmi>` +
    `<prest><CNPJ>${prestadorCnpj}</CNPJ><xNome>${escapeXml(prestadorNome)}</xNome>${regTrib}</prest>` +
    `<toma><${tomadorDoc.tipo}>${tomadorDoc.valor}</${tomadorDoc.tipo}><xNome>${escapeXml(tomadorNome)}</xNome></toma>` +
    `<serv>` +
    `<locPrest><cLocPrestacao>${municipioPrestacaoIbge}</cLocPrestacao></locPrest>` +
    `<cServ><cTribNac>${codigoTributacaoNacional}</cTribNac><xDescServ>${escapeXml(xDescServ)}</xDescServ></cServ>` +
    `</serv>` +
    `<valores><vServPrest><vServ>${vServ}</vServ></vServPrest>${descCondIncond}${trib}</valores>` +
    `</infDPS>` +
    `</DPS>`
  );
}
