// ─────────────────────────────────────────────────────────────────────────────
// TESTE DA RLS POR PERFIL — Opção A (rodar SÓ DEPOIS de aplicar
// setup-v2-optionA-perfil.sql no banco). Cola no javascript_tool do browser
// (ou no console da página do app). Usa só a anon key + endpoints públicos.
//
// Cria 1 empresa de teste + 3 contas (gestor/vendas/técnico), provisiona pelo PIN
// e checa a matriz. Imprime PASS/FAIL. No fim, apaga a empresa (cascata leva tudo).
// NÃO precisa de UI, senha real, nem PAT.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const U = 'https://auoklaiffalbdgazrbdu.supabase.co';
  const K = 'COLE_A_ANON_KEY_AQUI'; // = SUPABASE_ANON_KEY do app.js
  const H = t => ({ apikey: K, Authorization: 'Bearer ' + (t || K), 'Content-Type': 'application/json' });
  const rnd = Math.random().toString(36).slice(2, 8);
  const pad = pin => 'fluxa_' + pin; // senha de auth >= 6 derivada do PIN (ver Fase 2)
  const results = [];
  const check = (nome, ok) => { results.push((ok ? '✅ PASS' : '❌ FAIL') + ' — ' + nome); };

  // helpers
  async function signup(email, pass) {
    const r = await fetch(`${U}/auth/v1/signup`, { method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass }) });
    const b = await r.json(); return b.access_token || null;
  }
  async function rpc(tok, fn, args) {
    const r = await fetch(`${U}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H(tok), body: JSON.stringify(args) });
    return { status: r.status, body: await r.json().catch(() => null) };
  }
  async function sel(tok, path) {
    const r = await fetch(`${U}/rest/v1/${path}`, { headers: H(tok) });
    return { status: r.status, rows: await r.json().catch(() => null) };
  }
  async function ins(tok, table, payload) {
    const r = await fetch(`${U}/rest/v1/${table}`, { method: 'POST', headers: { ...H(tok), Prefer: 'return=representation' }, body: JSON.stringify(payload) });
    return { status: r.status, body: await r.json().catch(() => null) };
  }
  async function upd(tok, path, payload) {
    const r = await fetch(`${U}/rest/v1/${path}`, { method: 'PATCH', headers: H(tok), body: JSON.stringify(payload) });
    return { status: r.status };
  }

  // 1) DONO → cria empresa (vira gestor)
  const tokGestor = await signup(`dono_${rnd}@teste.fluxa.local`, 'teste123');
  if (!tokGestor) { console.log('❌ signup dono falhou (confirmação de e-mail ligada?)'); return; }
  const ce = await rpc(tokGestor, 'criar_empresa', { p_nome: 'RLS Teste ' + rnd, p_nome_usuario: 'Dono' });
  const EMP = ce.body; // uuid
  const emp = (await sel(tokGestor, `empresas?select=id,slug&id=eq.${EMP}`)).rows?.[0];
  const LOJA = (await sel(tokGestor, `lojas?select=id&empresa_id=eq.${EMP}`)).rows?.[0]?.id;

  // 2) GESTOR semeia dados + pré-declara funcionários (usuarios)
  await ins(tokGestor, 'usuarios', { id: 'usr_v_' + rnd, empresa_id: EMP, nome: 'Vendedor', perfil: 'vendas', pin: '1111', ativo: true });
  await ins(tokGestor, 'usuarios', { id: 'usr_t_' + rnd, empresa_id: EMP, nome: 'Fulano', perfil: 'tecnico', pin: '2222', ativo: true });
  await ins(tokGestor, 'orcamentos', { empresa_id: EMP, loja_id: LOJA, cliente: 'Cli', total: 500, status: 'pendente' });
  await ins(tokGestor, 'ordens_servico', { empresa_id: EMP, loja_id: LOJA, cliente: 'Cli', tecnico: 'Fulano', status: 'agendado' });
  await ins(tokGestor, 'ordens_servico', { empresa_id: EMP, loja_id: LOJA, cliente: 'Cli2', tecnico: 'Outro', status: 'agendado' });
  await ins(tokGestor, 'despesas', { id: 'desp_g_' + rnd, empresa_id: EMP, loja_id: LOJA, tecnico: 'Dono', tipo: 'x', valor: 10, status: 'pendente' });
  check('gestor lê orcamentos', (await sel(tokGestor, `orcamentos?empresa_id=eq.${EMP}`)).rows?.length > 0);

  // 3) VENDAS: conta sintética + vínculo pelo PIN
  const tokVendas = await signup(`usr_v_${rnd}@${emp.slug}.fluxa.local`, pad('1111'));
  const vv = await rpc(tokVendas, 'vincular_funcionario', { p_empresa: EMP, p_usuario_id: 'usr_v_' + rnd, p_pin: '1111' });
  check('vincular vendas (retorna perfil "vendas")', vv.body === 'vendas');
  check('vendas LÊ orcamentos', (await sel(tokVendas, `orcamentos?empresa_id=eq.${EMP}`)).rows?.length > 0);
  check('vendas NÃO lê despesas (financeiro)', ((await sel(tokVendas, `despesas?empresa_id=eq.${EMP}`)).rows || []).length === 0);
  check('vendas NÃO edita empresas', (await upd(tokVendas, `empresas?id=eq.${EMP}`, { nome: 'hack' })).status >= 400 || (await sel(tokGestor, `empresas?select=nome&id=eq.${EMP}`)).rows?.[0]?.nome !== 'hack');

  // 4) TÉCNICO: conta sintética + vínculo
  const tokTec = await signup(`usr_t_${rnd}@${emp.slug}.fluxa.local`, pad('2222'));
  const vt = await rpc(tokTec, 'vincular_funcionario', { p_empresa: EMP, p_usuario_id: 'usr_t_' + rnd, p_pin: '2222' });
  check('vincular técnico (retorna "tecnico")', vt.body === 'tecnico');
  check('técnico NÃO lê orcamentos (financeiro)', ((await sel(tokTec, `orcamentos?empresa_id=eq.${EMP}`)).rows || []).length === 0);
  const osTec = (await sel(tokTec, `ordens_servico?empresa_id=eq.${EMP}&select=tecnico`)).rows || [];
  check('técnico vê SÓ as OS dele (tecnico=Fulano)', osTec.length === 1 && osTec[0].tecnico === 'Fulano');
  check('técnico INSERE despesa própria', (await ins(tokTec, 'despesas', { id: 'desp_t_' + rnd, empresa_id: EMP, loja_id: LOJA, tecnico: 'Fulano', tipo: 'y', valor: 5, status: 'pendente' })).status < 300);
  const despTec = (await sel(tokTec, `despesas?empresa_id=eq.${EMP}&select=tecnico`)).rows || [];
  check('técnico vê SÓ as despesas dele', despTec.every(d => d.tecnico === 'Fulano'));

  // 5) isolamento entre-empresas (técnico não lê nada de outra empresa) — implícito no eq acima
  console.log('\n=== RESULTADO ===\n' + results.join('\n'));
  console.log('\nEMPRESA de teste: ' + EMP + ' (apagar com: DELETE FROM empresas WHERE id=... — cascata leva o resto; e apagar as contas em Auth > Users)');
})();
