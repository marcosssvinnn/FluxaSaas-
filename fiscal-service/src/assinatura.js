// Assinatura XMLDSig (enveloped, RSA-SHA256, C14N exclusivo) via xml-crypto.
// Mesmo padrão validado no spike Python com signxml — a norma W3C XMLDSig é a
// mesma independente da biblioteca/linguagem, então as 2 regras encontradas no
// spike valem igual aqui:
//   1. O elemento com o Id referenciado (infDPS) precisa ter o namespace
//      declarado NELE MESMO, não herdado de um elemento pai — senão a
//      verificação (canonicalização exclusiva) falha.
//   2. NUNCA reformatar/pretty-print o XML depois de assinado — isso muda o
//      conteúdo textual e invalida a assinatura no round-trip. `xmlSemAssinar`
//      abaixo já deve vir compacto (dps.js gera assim, sem indentação).

import { SignedXml } from "xml-crypto";

/**
 * @param {string} xmlSemAssinar - XML da DPS, compacto (sem pretty-print), com
 *   o Id no elemento infDPS.
 * @param {string} idReferenciado - valor do atributo Id em infDPS (sem o '#')
 * @param {string} keyPem
 * @param {string} certPem
 * @returns {string} XML assinado, forma compacta
 */
export function assinarDPS(xmlSemAssinar, idReferenciado, keyPem, certPem) {
  const sig = new SignedXml({ privateKey: keyPem, publicCert: certPem });

  sig.addReference({
    xpath: `//*[@Id='${idReferenciado}']`,
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
  });

  sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
  sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";

  sig.computeSignature(xmlSemAssinar, {
    location: { reference: `//*[@Id='${idReferenciado}']`, action: "append" },
  });

  // getSignedXml() já retorna a forma compacta (nunca chamar um formatador
  // "bonito" em cima disso antes de salvar/enviar — ver aviso acima).
  return sig.getSignedXml();
}

/**
 * Verificação própria, ANTES de mandar pro governo — mesma lógica que o spike
 * usou como checagem independente (re-deriva tudo do zero a partir do XML já
 * assinado, não reaproveita nenhum estado de `assinarDPS`). Se isto falhar, o
 * microsserviço deve abortar o envio — nunca mandar uma nota com assinatura
 * que nem nós mesmos conseguimos validar.
 */
export function verificarAssinatura(xmlAssinado, certPem) {
  const sig = new SignedXml();
  sig.publicCert = certPem;
  sig.loadSignature(
    xmlAssinado.match(/<Signature[^]*?<\/Signature>/i)?.[0] ||
      (() => {
        throw new Error("XML não contém elemento <Signature> — assinatura ausente.");
      })()
  );
  const valido = sig.checkSignature(xmlAssinado);
  if (!valido) {
    throw new Error(
      "Assinatura inválida na verificação própria — abortando envio. " +
        (sig.validationErrors || []).join("; ")
    );
  }
  return true;
}
