# fiscal-service

Microsserviço de emissão de **NFS-e** (Sistema Nacional) do Fluxa v2. Assina o
XML da DPS com o certificado A1 da empresa e envia via mTLS pra SEFIN
Nacional.

## Por que isto existe como serviço separado (não uma Supabase Edge Function)

A NFS-e Nacional exige **mTLS** (o certificado A1 autentica a própria conexão
HTTPS) e assinatura XMLDSig com a chave do certificado. O runtime das Supabase
Edge Functions (Deno hospedado) não suporta isso de forma confiável —
`Deno.createHttpClient` (a única API de client-cert do Deno) fica atrás de uma
flag instável que o Supabase não habilita no ambiente hospedado. Node.js tem
suporte nativo e estável pra isso há mais de uma década (`https.Agent({cert,
key})`), por isso este é um processo Node separado. Ver plano completo em
`~/.claude/plans/fluttering-questing-milner.md` e a seção correspondente em
`CLAUDE.md` do repo principal.

## ⚠️ Estado atual (2026-07-20) — NÃO testado contra rede real

Este código foi escrito num ambiente sem Node.js disponível — a lógica de
extração de certificado (PKCS12) e assinatura XMLDSig foi **validada em
Python** (`cryptography` + `signxml`, mesmos algoritmos/conceitos) antes de
ser portada pra cá, e a lógica de construção do payload da nota foi testada
com dados no formato real do Fluxa. Mas o código Node em si (`node-forge`,
`xml-crypto`, `https.Agent`) **nunca rodou** — precisa de um smoke test antes
de confiar nele:

```bash
npm install
npm run dev
curl http://localhost:3000/saude   # deve responder {"ok":true}
```

Depois disso, testar `/certificado/upload` com um `.pfx` de teste (não o
certificado real ainda) antes de qualquer coisa envolvendo o certificado de
verdade do Marcos.

## Gaps conhecidos (documentados, não escondidos)

- **`municipioIbge` precisa ser informado explicitamente** em `/emitir` — não
  há ainda um cadastro de código IBGE por loja (`lojas.cidade` é só o nome da
  cidade, "Itapema", não o código numérico que a DPS exige). Resolver isso
  exige uma tabela de referência município→IBGE ou um campo novo em `lojas`.
- **A URL exata do endpoint de homologação/produção da SEFIN Nacional**
  (`src/sefinClient.js`) foi obtida por pesquisa em 2026-07 — confirme contra
  a documentação técnica atual (gov.br/nfse) antes do primeiro teste real,
  esse tipo de API pública em rollout nacional recente muda endpoint com
  alguma frequência.
- **Marco 0, passo 4** (testar com certificado real contra homologação de
  verdade) ainda não foi feito — precisa do Marcos presente com o `.pfx` real.
- **NFe (produto/mercadoria)** não é tratada aqui — só NFS-e (serviço). Fase
  futura.

## Variáveis de ambiente

Ver `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` é um segredo real — nunca
commitar, nunca logar. No host de deploy, configurar como secret/env var da
plataforma (Render/Railway/etc.), nunca em arquivo versionado.

## Deploy sugerido (sem custo)

Render free tier (ou similar) — o serviço "dorme" depois de ~15min sem uso e
leva uns 30-60s pra "acordar" na próxima chamada. Como emitir nota fiscal não
é uma ação instantânea por natureza, esse atraso ocasional é aceitável em
troca de não ter custo de hospedagem nenhum. Ver decisão completa no plano.

## Rotas

- `POST /certificado/upload` — multipart: `pfx` (arquivo), `senha`, `token`
  (obtido via RPC `iniciar_upload_certificado` no app principal). Retorna
  `{ok, cn, validoAte}` — nunca o arquivo/senha de volta.
- `POST /emitir` — `Authorization: Bearer <jwt do usuário>`, body
  `{empresaId, orcamentoId, municipioIbge, codigoTributacaoNacional, ambiente}`.
  Valida que quem chama é gestor da empresa (via `meu_perfil()`, mesma função
  que o resto do app usa), busca o orçamento e os dados fiscais da loja,
  monta/assina/envia a DPS, grava o resultado em `notas_fiscais`.
- `GET /saude` — healthcheck simples.
