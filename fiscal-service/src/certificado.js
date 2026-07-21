// Extração de chave privada + certificado de um .pfx (PKCS12) via node-forge.
// Validado no spike Python (cryptography.pkcs12) contra o mesmo conceito —
// node-forge implementa a mesma extração em Node.

import forge from "node-forge";

/**
 * @param {Buffer} pfxBuffer - bytes crus do arquivo .pfx
 * @param {string} senha
 * @returns {{ keyPem: string, certPem: string, cn: string, validoAte: Date }}
 * @throws {Error} se a senha estiver errada ou o arquivo não for um PKCS12 válido
 */
export function extrairChaveECertificado(pfxBuffer, senha) {
  const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer.toString("binary")));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

  const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
  const certBag = (certBags[forge.pki.oids.certBag] || [])[0];

  if (!keyBag || !certBag) {
    throw new Error("Não foi possível extrair chave/certificado do .pfx — arquivo inválido ou senha incorreta.");
  }

  const keyPem = forge.pki.privateKeyToPem(keyBag.key);
  const certPem = forge.pki.certificateToPem(certBag.cert);
  const cn = certBag.cert.subject.getField("CN")?.value || "";
  const validoAte = certBag.cert.validity.notAfter;

  return { keyPem, certPem, cn, validoAte };
}
