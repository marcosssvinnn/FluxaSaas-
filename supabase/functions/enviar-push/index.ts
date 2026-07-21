// enviar-push — envia notificações Web Push (VAPID) pros dispositivos
// inscritos de uma empresa (Sprint 1 do plano mobile, docs/mobile-app-plano.md).
//
// Quem pode chamar:
//   1. O próprio app, autenticado (JWT do usuário logado) — ex.: um botão de
//      teste na tela de configurações.
//   2. Triggers internos do banco (RPC/trigger via pg_net), autenticados por
//      um header x-push-secret que só o Postgres conhece (guardado no Vault,
//      nunca no cliente) — ex.: portal_responder_orcamento ao aprovar.
//
// Nunca aceita chamada anônima sem um dos dois.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;
const PUSH_INTERNAL_SECRET = Deno.env.get("PUSH_INTERNAL_SECRET")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
  }

  // ── Autorização ──
  const internalSecret = req.headers.get("x-push-secret");
  const authHeader = req.headers.get("authorization") || "";
  let autorizado = false;

  if (internalSecret && internalSecret === PUSH_INTERNAL_SECRET) {
    autorizado = true; // chamada server-to-server (trigger do banco)
  } else if (authHeader.startsWith("Bearer ")) {
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await anon.auth.getUser();
    if (!error && data?.user) autorizado = true;
  }
  if (!autorizado) {
    return new Response(JSON.stringify({ error: "não autorizado" }), { status: 401 });
  }

  // ── Payload ──
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }
  const empresa_id = body.empresa_id as string | undefined;
  const titulo = body.titulo as string | undefined;
  const corpo = body.corpo as string | undefined;
  const url = (body.url as string | undefined) || "/";
  const perfisAlvo = body.perfis_alvo as string[] | undefined;

  if (!empresa_id || !titulo || !corpo) {
    return new Response(JSON.stringify({ error: "empresa_id, titulo e corpo são obrigatórios" }), { status: 400 });
  }

  // ── Busca inscrições ativas da empresa ──
  const { data: subs, error: subsErr } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key, user_id")
    .eq("empresa_id", empresa_id)
    .eq("ativo", true);
  if (subsErr) {
    return new Response(JSON.stringify({ error: subsErr.message }), { status: 500 });
  }

  let alvos = subs || [];

  // Filtro opcional por perfil (ex.: só gestor) — junta com membros
  if (perfisAlvo?.length && alvos.length) {
    const userIds = alvos.map((s) => s.user_id);
    const { data: membros } = await admin
      .from("membros")
      .select("user_id, perfil")
      .eq("empresa_id", empresa_id)
      .in("user_id", userIds);
    const perfilPorUser = new Map((membros || []).map((m) => [m.user_id, m.perfil]));
    alvos = alvos.filter((s) => perfisAlvo.includes(perfilPorUser.get(s.user_id) as string));
  }

  // ── Envia (em paralelo, cada falha isolada) ──
  const payload = JSON.stringify({ title: titulo, body: corpo, url });
  const resultados = await Promise.allSettled(
    alvos.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
          payload,
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404/410 = inscrição morta (usuário desinstalou/revogou permissão) — desativa
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").update({ ativo: false }).eq("id", s.id);
        }
        throw err;
      }
    }),
  );

  const enviados = resultados.filter((r) => r.status === "fulfilled").length;
  return new Response(
    JSON.stringify({ total: alvos.length, enviados, falhas: alvos.length - enviados }),
    { headers: { "Content-Type": "application/json" } },
  );
});
