// Cliente mTLS pro Sistema Nacional NFS-e (SEFIN Nacional). Usa o
// https.Agent nativo do Node com cert/key — caminho padrão e estável há mais
// de uma década, ao contrário do Deno.createHttpClient (indisponível em
// Supabase Edge Functions — é exatamente por isso que este microsserviço
// existe como processo separado, ver README.md).

import https from "node:https";

const ENDPOINTS = {
  homologacao: "https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse",
  producao: "https://sefin.nfse.gov.br/SefinNacional/nfse",
};

/**
 * @param {string} xmlAssinado - DPS já assinada, forma compacta
 * @param {string} keyPem
 * @param {string} certPem
 * @param {'homologacao'|'producao'} ambiente
 * @returns {Promise<{status:number, corpo:string}>}
 */
export function enviarDPS(xmlAssinado, keyPem, certPem, ambiente = "homologacao") {
  const url = new URL(ENDPOINTS[ambiente]);
  const agent = new https.Agent({ cert: certPem, key: keyPem });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        agent,
        headers: {
          "Content-Type": "application/xml",
          "Content-Length": Buffer.byteLength(xmlAssinado),
        },
        timeout: 30000,
      },
      (res) => {
        let corpo = "";
        res.on("data", (chunk) => (corpo += chunk));
        res.on("end", () => resolve({ status: res.statusCode, corpo }));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Timeout ao conectar na SEFIN Nacional")));
    req.write(xmlAssinado);
    req.end();
  });
}

// NOTA (Marco 0, passo 4 — ainda não executado): a URL exata de homologação
// acima foi obtida por pesquisa da documentação oficial em 2026-07 — CONFIRME
// contra o manual técnico atual (gov.br/nfse) antes do primeiro teste real,
// endpoints de API pública mudam com alguma frequência nesse tipo de sistema
// em rollout nacional recente.
