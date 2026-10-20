'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n => Number(n || 0).toLocaleString('pt-BR');
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const initials = name => String(name || '').trim().split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase();
const avatar = name => `<span class="avatar">${esc(initials(name))}</span>`;
const dateOnly = value => value ? new Date(value.length === 10 ? value+'T12:00:00' : value).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : '—';
const empty = (title, detail, glyph='book') => `<div class="empty">${icon(glyph)}<h3>${esc(title)}</h3><p>${esc(detail)}</p></div>`;

let token = sessionStorage.getItem('communhao_session') || '';
let user = null, page = 'dashboard', epoch = 0, reviewPage = 1, reviewFilter = 'all';
let members = [], reviews = [], churchData = null, rewardsData = null, groupsData = [], photoUrl = '';
let toastTimer;

function toast(message, bad=false) {
  $('toast').textContent = message;
  $('toast').className = 'toast' + (bad ? ' bad' : '');
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').hidden = true, 5000);
}

async function api(url, options={}) {
  const response = await fetch('/api' + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({ error: 'O servidor retornou uma resposta inesperada.' }));
  if (response.status === 401 && url !== '/auth/login') logout();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}

function logout() {
  epoch++;
  token = '';
  user = null;
  sessionStorage.removeItem('communhao_session');
  $('shell').hidden = true;
  $('login').hidden = false;
  closeModal();
  $('password').value = '';
}

async function login(email, password) {
  const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (!['church_admin', 'super_admin'].includes(data.user.role)) {
    throw new Error('Este painel é exclusivo de administradores. Utilize o aplicativo para acessar seu perfil.');
  }
  token = data.token;
  sessionStorage.setItem('communhao_session', token);
  await restore();
}

async function restore() {
  user = await api('/auth/me');
  if (!['church_admin', 'super_admin'].includes(user.role)) {
    logout();
    throw new Error('Acesso ao painel não autorizado.');
  }
  $('login').hidden = true;
  $('shell').hidden = false;
  $('churchName').textContent = user.church_name || 'Sua igreja';
  $('accountName').textContent = user.name;
  $('accountInitials').textContent = initials(user.name);
  $('date').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  await show('dashboard');
}

function heading(title, subtitle, action='') {
  return `<div class="page-heading"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${action}</div>`;
}

function footer() {
  return `<footer class="page-footer"><span>comunhão · cuidado que aproxima</span><span>Dados atualizados às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></footer>`;
}

function button(label, action, glyph='plus', cls='primary') {
  return `<button class="btn ${cls}" data-action="${action}">${icon(glyph)}${esc(label)}</button>`;
}

async function show(target) {
  page = target;
  const current = ++epoch;
  document.querySelectorAll('[data-page]').forEach(el => {
    const active = el.dataset.page === page;
    el.classList.toggle('active', active);
    if (el.closest('nav')) el.setAttribute('aria-current', active ? 'page' : 'false');
  });

  $('content').setAttribute('aria-busy', 'true');
  $('content').innerHTML = '<div class="loading"><span class="spinner"></span>Carregando sua comunidade…</div>';

  try {
    let html = '';
    if (page === 'dashboard') html = dashboard(await api('/admin/stats'));
    if (page === 'church') { churchData = await api('/admin/church'); html = churchPage(churchData); }
    if (page === 'members') { members = await api('/admin/members'); html = memberPage(); }
    if (page === 'groups') {
      const groups = await api('/gamification/groups-ranking');
      if (!members.length) members = await api('/admin/members').catch(() => []);
      html = groupsPage(groups);
    }
    if (page === 'reviews') {
      reviews = await api('/devotionals/leader-reviews?page=' + reviewPage + '&status=' + reviewFilter);
      html = reviewList();
    }
    if (page === 'rewards') {
      const [rData, gList] = await Promise.all([
        api('/gamification/rewards'),
        api('/groups').catch(() => [])
      ]);
      rewardsData = rData;
      groupsData = gList;
      html = rewardsPage(rewardsData, groupsData);
    }
    if (page === 'challenge') html = challengePage(await api('/gamification/challenge'));

    if (current !== epoch || !user) return;
    $('content').innerHTML = html + footer();
    $('connection').textContent = 'Conectado';
    $('connection').className = 'pill';
  } catch (error) {
    if (current !== epoch || !user) return;
    $('connection').textContent = 'Falha ao atualizar';
    $('connection').className = 'pill warm';
    $('content').innerHTML = heading('Não foi possível carregar', 'Seus dados continuam salvos.') +
      `<div class="card"><p class="error" role="alert">${esc(error.message || 'Verifique a conexão com o servidor.')}</p>${button('Tentar novamente', 'refresh', 'refresh')}</div>`;
  } finally {
    if (current === epoch) $('content').setAttribute('aria-busy', 'false');
  }
}

function dashboard(data) {
  const s = data.summary;
  const metrics = [
    ['Leituras de hoje', s.today_devotionals, 'devocionais registrados', 'book'],
    ['Pessoas na comunidade', s.total_members, `${num(s.today_participants)} participaram hoje`, 'users'],
    ['Grupos de leitura', s.total_groups, 'caminhando em comunidade', 'chart'],
    ['Orientações pendentes', s.pending_feedbacks, 'anotações aguardam seu cuidado', 'gift']
  ];
  const activity = data.activity || [];
  const max = Math.max(1, ...activity.map(d => d.count));
  const chart = activity.length
    ? `<div class="bars" role="img" aria-label="Devocionais dos últimos 7 dias">${activity.map(d => `<div class="bar-col"><small>${num(d.count)}</small><div class="bar" style="height:${Math.max(2, d.count/max*100)}px"></div></div>`).join('')}</div><div class="bar-labels">${activity.map(d => `<span>${esc(new Date(d.day + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }))}</span>`).join('')}</div>`
    : empty('Sua jornada começa aqui', 'Os devocionais aparecerão conforme sua comunidade participar.');

  return heading('Sua comunidade, mais perto.', 'Acompanhe a caminhada de fé da sua igreja.', button('Atualizar', 'refresh', 'refresh', '')) +
    `<section class="hero">
      <div>
        <p class="eyebrow">CULTIVANDO A PALAVRA, TODOS OS DIAS</p>
        <h2>Cada leitura é um novo começo.</h2>
        <p>${s.pending_feedbacks > 0 ? `${num(s.pending_feedbacks)} ${s.pending_feedbacks === 1 ? 'anotação aguarda' : 'anotações aguardam'} uma palavra de orientação. Seu cuidado faz parte dessa jornada.` : 'As orientações estão em dia. Continue incentivando sua comunidade a compartilhar a Palavra.'}</p>
        <button class="btn" data-page="reviews">Acompanhar devocionais ${icon('arrow')}</button>
      </div>
      <div class="hero-symbol">${icon('book')}</div>
    </section>` +
    `<div class="metrics">${metrics.map(([label, value, sub, glyph]) => `<div class="metric"><div class="metric-top">${label}<span class="metric-icon">${icon(glyph)}</span></div><strong>${num(value)}</strong><small>${sub}</small></div>`).join('')}</div>` +
    `<div class="dashboard-grid">
      <section class="card"><div class="section-head"><h2>Constância em comunidade</h2><span class="pill gray">Últimos 7 dias</span></div>${chart}</section>
      <section class="card"><div class="section-head"><h2>Nossos grupos</h2><button class="btn link small" data-page="groups">Ver todos ${icon('arrow')}</button></div>${data.group_engagement.length ? data.group_engagement.slice(0,3).map(g => `<div class="group-mini"><div class="row"><strong>${esc(g.title)}</strong><span class="spacer"></span><small>${num(g.members_count)} membros</small></div><div class="progress"><span style="width:${Math.min(100, g.today_members/Math.max(1, g.members_count)*100)}%"></span></div><small>${num(g.today_members)} participaram hoje</small></div>`).join('') : empty('Nenhum grupo ainda', 'Crie o primeiro grupo de leitura.', 'users')}</section>
      <section class="card wide"><div class="section-head"><h2>Os últimos passos da comunidade</h2><button class="btn link small" data-page="reviews">Ver devocionais ${icon('arrow')}</button></div>${data.recent_devotionals.length ? data.recent_devotionals.slice(0,5).map(d => `<div class="activity-row">${avatar(d.user_name)}<div><strong>${esc(d.user_name)}</strong><p>Compartilhou ${esc(d.passage_or_chapter || 'uma leitura')} · ${esc(d.group_title)}</p></div><span class="spacer"></span><span class="pill ${d.existing_feedback ? '' : 'warm'}">${d.existing_feedback ? 'Orientado' : 'Aguardando orientação'}</span><small>${dateOnly(d.devotional_date)}</small></div>`).join('') : empty('Ainda não há devocionais', 'Convide os membros para compartilhar a primeira leitura.')}</section>
    </div>`;
}

function churchPage(c) {
  return heading('Minha Igreja', 'Configurações gerais, endereço e links de convite da sua congregação.') +
    `<section class="church-hero">
      <div class="row" style="gap:20px">
        <div class="church-logo-wrap">
          ${c.logo_url ? `<img class="church-logo-img" src="${esc(c.logo_url)}" alt="Logo da Igreja">` : `<svg class="icon" style="width:36px;height:36px"><use href="#i-church"/></svg>`}
        </div>
        <div>
          <h2>${esc(c.name)}</h2>
          <p>${esc(c.denomination || 'Congregação')} · ${esc(c.city || 'Cidade não informada')}/${esc(c.state || 'UF')}</p>
          <p style="margin-top:6px;font-size:12px;opacity:0.85">${num(c.members_count)} membros cadastrados · ${num(c.groups_count)} células/grupos</p>
        </div>
      </div>
    </section>` +
    `<section class="share-card">
      <h3>Links de Convite para a Igreja</h3>
      <p>Compartilhe o código ou o link direto para que novos irmãos se conectem à congregação:</p>
      <div class="share-row">
        <span class="code-badge">${esc(c.slug_code)}</span>
        <button class="btn small soft" data-copy="${esc(c.slug_code)}"><svg class="icon"><use href="#i-copy"/></svg> Copiar Código</button>
        <button class="btn small soft" data-copy-link="${esc(c.slug_code)}"><svg class="icon"><use href="#i-copy"/></svg> Copiar Link Direto</button>
        <button class="btn small" style="background:#25d366;color:#fff;border-color:#25d366" data-whatsapp-church="${esc(c.slug_code)}" data-church-name="${esc(c.name)}"><svg class="icon"><use href="#i-share"/></svg> Enviar no WhatsApp</button>
      </div>
    </section>` +
    `<section class="card">
      <div class="section-head"><h2>Editar Dados da Congregação</h2><span class="pill gray">Atualização em tempo real</span></div>
      <form id="churchForm">
        <div class="two-fields">
          <div class="field">
            <label for="churchNameInput">Nome da Igreja *</label>
            <input id="churchNameInput" name="name" required minlength="3" maxlength="150" value="${esc(c.name)}">
          </div>
          <div class="field">
            <label for="churchSlugInput">Código de Convite (Alfanumérico) *</label>
            <input id="churchSlugInput" name="slug_code" required minlength="3" maxlength="30" value="${esc(c.slug_code)}" style="text-transform:uppercase">
            <small>Código que os membros usam ao se cadastrar no app.</small>
          </div>
        </div>
        <div class="two-fields">
          <div class="field">
            <label for="churchDenomination">Denominação / Ministério</label>
            <input id="churchDenomination" name="denomination" placeholder="Ex.: Comunhão, Batista, Videira" value="${esc(c.denomination || '')}">
          </div>
          <div class="field">
            <label for="churchCnpj">CNPJ (opcional)</label>
            <input id="churchCnpj" name="cnpj" placeholder="00.000.000/0001-00" value="${esc(c.cnpj || '')}">
          </div>
        </div>
        <div class="two-fields">
          <div class="field">
            <label for="churchPhone">Telefone / WhatsApp da Secretaria</label>
            <input id="churchPhone" name="phone" placeholder="(11) 98765-4321" value="${esc(c.phone || '')}">
          </div>
          <div class="field">
            <label for="churchLogo">URL da Logo / Imagem da Igreja</label>
            <input id="churchLogo" name="logo_url" placeholder="https://exemplo.com/logo.png" value="${esc(c.logo_url || '')}">
          </div>
        </div>
        <div class="field">
          <label for="adminChurchCep">Buscar Endereço pelo CEP (Correios)</label>
          <div class="cep-group">
            <input id="adminChurchCep" placeholder="01001-000" maxlength="9" style="max-width:220px">
            <button class="btn soft" type="button" data-action="admin-search-cep"><svg class="icon"><use href="#i-search"/></svg> Buscar CEP</button>
          </div>
          <div id="adminCepStatus" style="font-size:12px;margin-top:6px;display:none"></div>
        </div>
        <div class="field">
          <label for="churchAddress">Endereço Completo (Rua, Número, Bairro)</label>
          <input id="churchAddress" name="address_full" placeholder="Ex.: Praça da Sé, 100, Centro" value="${esc(c.address_full || '')}">
        </div>
        <div class="two-fields">
          <div class="field">
            <label for="churchCity">Cidade</label>
            <input id="churchCity" name="city" placeholder="Ex.: São Paulo" value="${esc(c.city || '')}">
          </div>
          <div class="field">
            <label for="churchState">Estado (UF)</label>
            <input id="churchState" name="state" placeholder="SP" maxlength="2" style="text-transform:uppercase" value="${esc(c.state || '')}">
          </div>
        </div>
        <div class="form-actions">
          <button class="btn primary" type="submit"><svg class="icon"><use href="#i-check"/></svg> Salvar alterações da congregação</button>
        </div>
      </form>
    </section>`;
}

const roles = { member: 'Membro', leader: 'Líder', church_admin: 'Administrador', super_admin: 'Administrador' };

function memberPage() {
  return heading('Pessoas que caminham juntas.', 'Acompanhe a participação e reconheça a dedicação de cada pessoa.') +
    `<div class="toolbar"><input id="memberSearch" class="search" aria-label="Buscar membro" placeholder="Buscar por nome ou e-mail…"><span class="pill gray">${num(members.length)} membros</span></div>
    <section class="card table-wrap">
      <table>
        <thead><tr><th>Membro</th><th>Perfil</th><th>Devocionais</th><th>Pontos</th><th>Última leitura</th><th>Ação</th></tr></thead>
        <tbody id="memberRows">${memberRows(members)}</tbody>
      </table>
    </section>`;
}

function memberRows(list) {
  return list.length ? list.map(m => `
    <tr>
      <td><div class="row">${avatar(m.name)}<div><strong>${esc(m.name)}</strong><small>${esc(m.email)}</small></div></div></td>
      <td><span class="role-badge role-${m.role === 'church_admin' ? 'admin' : m.role === 'leader' ? 'leader' : 'member'}">${esc(roles[m.role] || m.role)}</span></td>
      <td>${num(m.devotionals_count)}</td>
      <td><strong>${num(m.total_points)}</strong></td>
      <td>${dateOnly(m.last_devotional_date)}</td>
      <td>
        <button class="btn small soft" data-manage="${esc(m.id)}"><svg class="icon"><use href="#i-edit"/></svg> Gerenciar</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="6"><div class="empty">Nenhum membro encontrado.</div></td></tr>';
}

function manageMemberModal(id) {
  const m = members.find(x => x.id === id);
  if (!m) return;
  openModal(`
    <div class="row" style="margin-bottom:18px">
      ${avatar(m.name)}
      <div>
        <h2>${esc(m.name)}</h2>
        <p class="caption" style="margin:2px 0 0">${esc(m.email)} · ${esc(roles[m.role] || m.role)}</p>
      </div>
    </div>
    <div class="metrics" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      <div class="metric" style="padding:12px">
        <div class="metric-top">Pontos</div>
        <strong style="font-size:20px;margin:4px 0">${num(m.total_points)}</strong>
      </div>
      <div class="metric" style="padding:12px">
        <div class="metric-top">Sequência</div>
        <strong style="font-size:20px;margin:4px 0">${m.current_streak} dias</strong>
      </div>
      <div class="metric" style="padding:12px">
        <div class="metric-top">Devocionais</div>
        <strong style="font-size:20px;margin:4px 0">${num(m.devotionals_count)}</strong>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px;padding:18px">
      <h3 style="margin-bottom:10px">Alterar Cargo Eclesiástico</h3>
      <form id="memberRoleForm" data-id="${esc(id)}">
        <div class="field">
          <label for="selectRole">Cargo do Usuário</label>
          <select id="selectRole" name="role">
            <option value="member" ${m.role === 'member' ? 'selected' : ''}>Membro (Acesso ao app devocional)</option>
            <option value="leader" ${m.role === 'leader' ? 'selected' : ''}>Líder Discipulador (Orientação de grupos e validação)</option>
            <option value="church_admin" ${m.role === 'church_admin' ? 'selected' : ''}>Administrador da Igreja (Controle total do painel)</option>
          </select>
        </div>
        <button class="btn primary small" type="submit">Salvar novo cargo</button>
      </form>
    </div>
    <div class="card" style="margin-bottom:16px;padding:18px">
      <h3 style="margin-bottom:10px">Reconhecer Dedicação (Bônus Pastoral)</h3>
      <form id="memberBonusForm" data-id="${esc(id)}">
        <div class="two-fields">
          <div class="field">
            <label for="bonusAmount">Pontos</label>
            <input id="bonusAmount" name="amount" type="number" min="1" max="1000" value="100" required>
          </div>
          <div class="field">
            <label for="bonusReason">Motivo do reconhecimento</label>
            <input id="bonusReason" name="reason" placeholder="Ex.: Fidelidade nos devocionais" required minlength="3" maxlength="300">
          </div>
        </div>
        <button class="btn soft small" type="submit">Conceder bônus de pontos</button>
      </form>
    </div>
    <div class="card" style="padding:18px;border-color:#f2d4d4;background:#fffaf9">
      <h3 style="color:var(--red);margin-bottom:6px">Zona de Gestão</h3>
      <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Ao desvincular, o membro perde o vínculo com esta congregação e é removido dos grupos da igreja.</p>
      <button class="btn small danger" data-unlink="${esc(id)}">Desvincular membro da congregação</button>
    </div>
  `);
}

function groupsPage(groups) {
  return heading('Crescer fica melhor em grupo.', 'Organize as leituras e acompanhe a participação de cada célula.', button('Criar grupo', 'create-group')) +
    `<div class="grid">${groups.length ? groups.map((g, i) => `
      <article class="card group-card">
        <span class="pill gray">${g.category === 'biblia' ? 'Estudo bíblico' : 'Leitura de livro'}</span>
        <h2>${esc(g.title)}</h2>
        <p>${esc(g.book_or_theme || 'Leitura em comunidade')}</p>
        <div class="stat-row">
          <div><strong>${num(g.total_members)}</strong><small>membros</small></div>
          <div><strong>${num(g.total_devotionals)}</strong><small>devocionais</small></div>
          <div><strong>${num(g.total_group_points)}</strong><small>pontos</small></div>
        </div>
        <div class="code">Convite: ${esc(g.invite_code)}</div>
        <p style="margin-top:14px;font-size:12px">Liderança · <strong>${esc(g.leader_name || 'Sem líder definido')}</strong></p>
        
        ${g.cycle_start_date && g.cycle_end_date ? `
          <div style="margin:10px 0;padding:8px 12px;background:#f0fdf4;border-radius:6px;font-size:12px;border:1px solid #bbf7d0">
            <strong>📅 Ciclo:</strong> ${esc(g.cycle_start_date)} até ${esc(g.cycle_end_date)}
            <span class="pill ${g.cycle_status === 'completed' ? 'gray' : 'primary'}" style="margin-left:6px">${g.cycle_status === 'completed' ? 'Encerrado' : 'Ativo'}</span>
          </div>
        ` : `
          <div style="margin:10px 0;font-size:12px;color:#6b7280">
            📅 Ciclo: 90 dias (Padrão)
          </div>
        `}

        <div class="card-actions">
          <button class="btn small soft" data-edit-group="${esc(g.id)}"><svg class="icon"><use href="#i-edit"/></svg> Editar</button>
          <button class="btn small soft" data-group-members="${esc(g.id)}"><svg class="icon"><use href="#i-users"/></svg> Membros (${num(g.total_members)})</button>
          <button class="btn small soft" data-close-cycle="${esc(g.id)}" data-group-title="${esc(g.title)}" title="Encerrar ciclo da célula e emitir prêmios do pódio aos vencedores" style="color:#d97706;border-color:#fde68a">🏆 Encerrar Ciclo</button>
          <button class="btn small soft" data-copy="${esc(g.invite_code)}" title="Copiar código de convite"><svg class="icon"><use href="#i-copy"/></svg></button>
          <button class="btn small soft" style="color:#25d366" data-whatsapp-group="${esc(g.invite_code)}" data-group-title="${esc(g.title)}" title="Compartilhar no WhatsApp"><svg class="icon"><use href="#i-share"/></svg></button>
          <button class="btn small danger" data-delete-group="${esc(g.id)}" title="Excluir Grupo"><svg class="icon"><use href="#i-trash"/></svg></button>
        </div>
      </article>
    `).join('') : empty('Vamos formar o primeiro grupo?', 'Use “Criar grupo” para começar.', 'users')}</div>`;
}

async function editGroupModal(id) {
  const g = await api('/groups/' + id);
  if (!members.length) members = await api('/admin/members').catch(() => []);
  const leaders = members.filter(m => ['leader', 'church_admin', 'super_admin'].includes(m.role));
  openModal(`
    <h2>Editar Grupo de Leitura</h2>
    <p class="muted">Altere as informações, ciclo de datas ou transfira a liderança desta célula.</p>
    <form id="editGroupForm" data-id="${esc(id)}">
      <div class="field">
        <label for="editGroupTitle">Nome do grupo *</label>
        <input id="editGroupTitle" name="title" required maxlength="100" value="${esc(g.title)}">
      </div>
      <div class="two-fields">
        <div class="field">
          <label for="editGroupCategory">Tipo de leitura</label>
          <select id="editGroupCategory" name="category">
            <option value="biblia" ${g.category === 'biblia' ? 'selected' : ''}>Bíblia</option>
            <option value="livro" ${g.category === 'livro' ? 'selected' : ''}>Livro</option>
          </select>
        </div>
        <div class="field">
          <label for="editGroupTheme">Livro ou tema *</label>
          <input id="editGroupTheme" name="book_or_theme" required maxlength="150" value="${esc(g.book_or_theme)}">
        </div>
      </div>
      <div class="two-fields">
        <div class="field">
          <label for="editCycleStart">Início do Ciclo de Leitura</label>
          <input id="editCycleStart" name="cycle_start_date" type="date" value="${esc(g.cycle_start_date || '')}">
        </div>
        <div class="field">
          <label for="editCycleEnd">Término do Ciclo (Encerramento)</label>
          <input id="editCycleEnd" name="cycle_end_date" type="date" value="${esc(g.cycle_end_date || '')}">
        </div>
      </div>
      <div class="field">
        <label for="editGroupLeader">Líder Discipulador Responsável</label>
        <select id="editGroupLeader" name="leader_id">
          <option value="">Sem líder definido</option>
          ${leaders.map(l => `<option value="${esc(l.id)}" ${l.id === g.leader_id ? 'selected' : ''}>${esc(l.name)} (${esc(roles[l.role])})</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="editGroupDescription">Descrição</label>
        <textarea id="editGroupDescription" name="description" maxlength="1000">${esc(g.description || '')}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" data-action="close">Cancelar</button>
        <button class="btn primary" type="submit">Salvar alterações</button>
      </div>
    </form>
  `);
}

async function groupMembersModal(groupId) {
  const data = await api('/groups/' + groupId + '/members');
  if (!members.length) members = await api('/admin/members').catch(() => []);
  const enrolledIds = new Set(data.members.map(m => m.id));
  const availableMembers = members.filter(m => !enrolledIds.has(m.id));
  openModal(`
    <h2>Membros do Grupo</h2>
    <p class="muted"><strong>${esc(data.group.title)}</strong> · Código: <code>${esc(data.group.invite_code)}</code></p>
    
    <div class="card" style="margin:16px 0;padding:16px;background:#f8faf6">
      <h3 style="margin-bottom:10px">Vincular Membro a este Grupo</h3>
      <form id="addGroupMemberForm" data-id="${esc(groupId)}" class="row">
        <select name="userId" required style="flex:1;min-height:44px">
          <option value="">Selecione um membro da igreja…</option>
          ${availableMembers.map(m => `<option value="${esc(m.id)}">${esc(m.name)} (${esc(m.email)})</option>`).join('')}
        </select>
        <button class="btn primary small" type="submit">Vincular</button>
      </form>
    </div>

    <h3 style="margin:16px 0 8px">Membros Inscritos (${data.members.length})</h3>
    <div class="member-list">
      ${data.members.length ? data.members.map(m => `
        <div class="member-item">
          ${avatar(m.name)}
          <div style="flex:1">
            <strong>${esc(m.name)} ${m.is_leader ? '<span class="pill">Líder</span>' : ''}</strong>
            <small>${esc(m.email)} · ${num(m.total_points)} pts</small>
          </div>
          ${!m.is_leader ? `<button class="btn small danger" data-remove-group-member="${esc(groupId)}" data-user-id="${esc(m.id)}" title="Desvincular deste grupo"><svg class="icon"><use href="#i-trash"/></svg></button>` : ''}
        </div>
      `).join('') : '<p class="muted" style="padding:16px">Nenhum membro inscrito além da liderança.</p>'}
    </div>
  `);
}

function reviewList() {
  return heading('Tempo de ouvir e orientar.', 'Anotações privadas, compartilhadas com o autor e sua liderança.') +
    `<div class="toolbar">
      <select id="reviewFilter" aria-label="Filtrar devocionais">
        <option value="all" ${reviewFilter==='all'?'selected':''}>Todos os devocionais</option>
        <option value="pending" ${reviewFilter==='pending'?'selected':''}>Aguardando orientação</option>
        <option value="done" ${reviewFilter==='done'?'selected':''}>Já orientados</option>
      </select>
      <span class="pill gray">Página ${reviewPage}</span>
    </div>
    <section class="card">
      ${reviews.length ? reviews.map(d => `
        <article class="review">
          <span class="review-icon">${icon('book')}</span>
          <div>
            <strong>${esc(d.member_name)}</strong>
            <p>${esc(d.passage_or_chapter || 'Leitura do dia')} · ${esc(d.group_title)} · ${dateOnly(d.devotional_date)}</p>
            <span class="pill ${d.existing_feedback?'':'warm'}">${d.existing_feedback ? 'Orientação enviada' : 'Aguardando orientação'}</span>
          </div>
          <button class="btn small" data-review="${esc(d.id)}">${d.existing_feedback ? 'Ver devocional' : 'Ler e orientar'} ${icon('arrow')}</button>
        </article>
      `).join('') : empty('Tudo em dia por aqui.', 'Não há devocionais para este filtro.')}
      <div class="pager">
        <button class="btn small" data-action="review-prev" ${reviewPage===1?'disabled':''}>Anterior</button>
        <button class="btn small" data-action="review-next" ${reviews.length<20?'disabled':''}>Próxima</button>
      </div>
    </section>`;
}

function rewardsPage(data, groups = []) {
  const gList = (groups && groups.length) ? groups : (groupsData || []);
  return heading('Reconheça cada conquista.', 'Prêmios que celebram a dedicação à leitura e à comunidade.', button('Cadastrar prêmio', 'create-reward')) +
    `<section class="card" style="margin-bottom:24px">
      <div class="section-head"><h2>Entregar um prêmio</h2><span class="pill gray">Validação de cupom</span></div>
      <form id="redeemForm">
        <div class="field">
          <label for="couponCode">Código apresentado pelo membro</label>
          <input id="couponCode" name="couponCode" required placeholder="CUPOM-OURO-… ou CUPOM-PODIO-…" maxlength="100" autocomplete="off">
          <small>A confirmação registra a entrega. Confira o código antes de continuar.</small>
        </div>
        <button class="btn primary" type="submit">${icon('check')} Confirmar entrega do prêmio</button>
        <div id="redeemResult" style="margin-top:16px" role="status"></div>
      </form>
    </section>
    <div class="section-head"><h2>Catálogo ${data.quarter ? '· ' + esc(data.quarter.title) : ''}</h2></div>
    <div class="grid">${data.rewards.length ? data.rewards.map((r, i) => `
      <article class="card reward-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <span class="reward-tier">${r.podium_position === 1 ? '🥇' : r.podium_position === 2 ? '🥈' : r.podium_position === 3 ? '🥉' : ['I','II','III','IV'][i] || '✦'}</span>
          <div>
            ${r.group_id ? `<span class="pill primary" style="background:#e8f5e9;color:#2e7d32;margin-right:4px">📍 ${esc(r.group_title || 'Célula')}</span>` : `<span class="pill gray" style="margin-right:4px">🌐 Toda a Igreja</span>`}
            ${r.reward_type === 'podium' ? `<span class="pill gold" style="background:#fff8e1;color:#b45309">🏆 ${r.podium_position}º Pódio</span>` : `<span class="pill warm">${esc(r.tier)}</span>`}
          </div>
        </div>
        <h2 style="margin-top:6px">${esc(r.title)}</h2>
        <p class="muted">${esc(r.description || '')}</p>
        ${r.reward_type === 'podium' 
          ? `<div class="cost">Pódio do Ciclo <small>Entregue ao encerrar a temporada</small></div>`
          : `<div class="cost">${num(r.points_required)} <small>pontos para desbloquear</small></div>`
        }
        <p class="caption">${icon('gift')} ${esc(r.partner_name)}</p>
        <div class="card-actions">
          <button class="btn small soft" data-edit-reward="${esc(r.id)}"><svg class="icon"><use href="#i-edit"/></svg> Editar</button>
          <button class="btn small danger" data-delete-reward="${esc(r.id)}" title="Excluir Prêmio"><svg class="icon"><use href="#i-trash"/></svg></button>
        </div>
      </article>
    `).join('') : empty('Nenhum prêmio nesta temporada', 'O catálogo ficará disponível quando houver uma temporada com prêmios cadastrados.', 'gift')}</div>`;
}

function editRewardModal(id) {
  const r = (rewardsData?.rewards || []).find(x => x.id === id);
  if (!r) return;
  const gList = groupsData || [];
  openModal(`
    <h2>Editar Prêmio</h2>
    <form id="editRewardForm" data-id="${esc(id)}">
      <div class="field">
        <label for="editRewTitle">Nome do prêmio *</label>
        <input id="editRewTitle" name="title" required minlength="3" maxlength="150" value="${esc(r.title)}">
      </div>
      <div class="two-fields">
        <div class="field">
          <label for="editRewGroupId">Destino do Prêmio</label>
          <select id="editRewGroupId" name="groupId">
            <option value="">🌐 Toda a Igreja (Geral)</option>
            ${gList.map(g => `<option value="${esc(g.id)}" ${g.id === r.group_id ? 'selected' : ''}>📍 Célula: ${esc(g.title)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="editRewType">Modelo de Conquista *</label>
          <select id="editRewType" name="rewardType">
            <option value="points" ${r.reward_type !== 'podium' ? 'selected' : ''}>⭐ Por Meta de Pontos (Desbloqueio Contínuo)</option>
            <option value="podium" ${r.reward_type === 'podium' ? 'selected' : ''}>🏆 Por Pódio do Ciclo (1º, 2º ou 3º Lugar)</option>
          </select>
        </div>
      </div>

      <div class="two-fields" id="editPodiumConfigRow" style="display:${r.reward_type === 'podium' ? 'grid' : 'none'}">
        <div class="field">
          <label for="editRewPodiumPos">Colocação no Pódio *</label>
          <select id="editRewPodiumPos" name="podiumPosition">
            <option value="1" ${r.podium_position === 1 ? 'selected' : ''}>🥇 1º Lugar (Campeão da Célula)</option>
            <option value="2" ${r.podium_position === 2 ? 'selected' : ''}>🥈 2º Lugar (Vice-Campeão)</option>
            <option value="3" ${r.podium_position === 3 ? 'selected' : ''}>🥉 3º Lugar (3ª Colocação)</option>
          </select>
        </div>
        <div class="field">
          <label for="editRewTierPodium">Nível do Selo/Troféu</label>
          <select id="editRewTierPodium" name="tier">
            <option value="ouro" ${r.tier === 'ouro' ? 'selected' : ''}>Ouro</option>
            <option value="prata" ${r.tier === 'prata' ? 'selected' : ''}>Prata</option>
            <option value="bronze" ${r.tier === 'bronze' ? 'selected' : ''}>Bronze</option>
            <option value="especial" ${r.tier === 'especial' ? 'selected' : ''}>Especial</option>
          </select>
        </div>
      </div>

      <div class="two-fields" id="editPointsConfigRow" style="display:${r.reward_type === 'podium' ? 'none' : 'grid'}">
        <div class="field">
          <label for="editRewTier">Nível</label>
          <select id="editRewTier" name="tier">
            <option value="bronze" ${r.tier === 'bronze' ? 'selected' : ''}>Bronze</option>
            <option value="prata" ${r.tier === 'prata' ? 'selected' : ''}>Prata</option>
            <option value="ouro" ${r.tier === 'ouro' ? 'selected' : ''}>Ouro</option>
            <option value="especial" ${r.tier === 'especial' ? 'selected' : ''}>Especial</option>
          </select>
        </div>
        <div class="field">
          <label for="editRewPoints">Pontos para desbloquear *</label>
          <input id="editRewPoints" name="pointsRequired" type="number" min="1" max="1000000" value="${r.points_required || 1400}" ${r.reward_type === 'podium' ? '' : 'required'}>
        </div>
      </div>

      <div id="editCalcCard" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin:8px 0 16px;font-size:12px;display:${r.reward_type === 'podium' ? 'none' : 'block'}">
        <strong>🧮 Calculadora de Metas (Estimativa de 3 Meses / 90 dias):</strong>
        <p style="margin:4px 0 8px;color:#166534">50 pts/dia + 10 pts bônus diário = <strong>até 5.400 pontos possíveis</strong> na temporada.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn small soft" data-calc-fill="1600">🥉 Sugestão Bronze: 1.600 pts (30%)</button>
          <button type="button" class="btn small soft" data-calc-fill="3200">🥈 Sugestão Prata: 3.200 pts (60%)</button>
          <button type="button" class="btn small soft" data-calc-fill="4500">🥇 Sugestão Ouro: 4.500 pts (85%)</button>
        </div>
      </div>

      <div class="field">
        <label for="editRewPartner">Local ou parceiro de retirada *</label>
        <input id="editRewPartner" name="partnerName" required maxlength="150" value="${esc(r.partner_name)}">
      </div>
      <div class="field">
        <label for="editRewDesc">Descrição</label>
        <textarea id="editRewDesc" name="description" maxlength="1000">${esc(r.description || '')}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" data-action="close">Cancelar</button>
        <button class="btn primary" type="submit">Salvar alterações</button>
      </div>
    </form>
  `);

  const typeSelect = $('editRewType');
  const podiumRow = $('editPodiumConfigRow');
  const pointsRow = $('editPointsConfigRow');
  const calcCard = $('editCalcCard');
  const ptsInput = $('editRewPoints');

  typeSelect?.addEventListener('change', () => {
    const isPodium = typeSelect.value === 'podium';
    if (isPodium) {
      podiumRow.style.display = 'grid';
      pointsRow.style.display = 'none';
      calcCard.style.display = 'none';
      ptsInput.removeAttribute('required');
      ptsInput.value = '0';
    } else {
      podiumRow.style.display = 'none';
      pointsRow.style.display = 'grid';
      calcCard.style.display = 'block';
      ptsInput.setAttribute('required', 'required');
      if (ptsInput.value === '0') ptsInput.value = '1400';
    }
  });
}

function challengePage(data) {
  const c = data.active_challenge;
  return heading('A fé também conecta igrejas.', 'Participe de uma jornada de leitura com outras comunidades.') +
    (c ? `<section class="hero">
      <div>
        <p class="eyebrow">JORNADA EM COMUNIDADE</p>
        <h2>${esc(c.title)}</h2>
        <p>${esc(c.description)}</p>
        <p style="margin-top:14px">${dateOnly(c.start_date)} a ${dateOnly(c.end_date)} · Convite: ${esc(c.invite_code)}</p>
      </div>
      <div class="hero-symbol">${icon('church')}</div>
    </section>
    <section class="card">
      <div class="section-head"><h2>Comunidades participantes</h2></div>
      ${data.leaderboard.map((g, i) => `
        <div class="activity-row">
          <span class="avatar warm">${i+1}</span>
          <div><strong>${esc(g.church_name)}</strong><p>${esc(g.city || '')} · ${num(g.active_members_count)} participantes</p></div>
          <span class="spacer"></span>
          <strong>${num(g.total_points_earned)} pts</strong>
        </div>
      `).join('')}
    </section>` :
    `<div class="split">
      <section class="card">
        <h2>Entrar em uma jornada</h2>
        <p class="muted">Recebeu um convite de outra igreja? Digite o código abaixo.</p>
        <form id="joinChallenge">
          <div class="field"><label for="inviteCode">Código da jornada</label><input id="inviteCode" name="inviteCode" required maxlength="50"></div>
          <button class="btn primary">Participar com minha igreja</button>
        </form>
      </section>
      <section class="card">
        <h2>Começar uma nova jornada</h2>
        <p class="muted">Defina um período e convide outras comunidades para lerem juntas.</p>
        ${button('Criar jornada', 'create-challenge')}
      </section>
    </div>`);
}

function openModal(html) {
  closeModal();
  $('modalContent').innerHTML = html;
  $('modal').showModal();
}

function closeModal() {
  if (photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = ''; }
  $('modal').close();
  $('modalContent').innerHTML = '';
}

async function reviewModal(id) {
  const d = reviews.find(x => x.id === id);
  if (!d) return;
  openModal(`
    <h2>${esc(d.member_name)}</h2>
    <p class="caption">${esc(d.group_title)} · ${esc(d.passage_or_chapter)} · ${dateOnly(d.devotional_date)}</p>
    <div id="photoState" class="loading" style="min-height:90px">Carregando anotação…</div>
    <p style="white-space:pre-wrap">${esc(d.notes || 'O membro compartilhou apenas a foto da anotação.')}</p>
    ${d.existing_feedback ? `
      <div class="notice">
        <strong>Sua orientação</strong>
        <p style="white-space:pre-wrap;margin:10px 0 0">${esc(d.existing_feedback)}</p>
      </div>
    ` : `
      <form id="feedbackForm" data-id="${esc(id)}">
        <div class="field">
          <label for="guidance">Uma palavra de orientação</label>
          <textarea id="guidance" name="pastoralGuidance" required maxlength="5000" placeholder="Acolha a reflexão e ajude o membro a aprofundar sua leitura…"></textarea>
        </div>
        <p class="caption">Somente o membro e a liderança responsável podem ler esta orientação.</p>
        <div class="form-actions">
          <button class="btn" type="button" data-action="close">Agora não</button>
          <button class="btn primary">Enviar orientação ${icon('arrow')}</button>
        </div>
      </form>
    `}
  `);
  $('modalContent').insertAdjacentHTML('beforeend', '<div class="form-actions"><button class="btn small danger" data-delete="' + esc(id) + '">Excluir devocional</button></div>');
  try {
    if (!d.image_url.startsWith('/api/')) {
      $('photoState').innerHTML = '<p class="caption">Anotação de demonstração · foto ilustrativa</p>';
      return;
    }
    const response = await fetch(d.image_url, { headers: { Authorization: 'Bearer ' + token } });
    if (!response.ok) throw new Error('A foto não está disponível.');
    const blob = await response.blob();
    if (!$('modal').open || !$('photoState')) return;
    photoUrl = URL.createObjectURL(blob);
    $('photoState').className = '';
    $('photoState').innerHTML = `<img class="photo" alt="Foto da anotação manuscrita" src="${photoUrl}">`;
  } catch (error) {
    if ($('photoState')) $('photoState').innerHTML = `<p class="caption">${esc(error.message)}</p>`;
  }
}

function groupModal() {
  const today = new Date().toISOString().slice(0, 10);
  const next90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  openModal(`
    <h2>Um novo grupo de leitura</h2>
    <p class="muted">Você será o líder inicial desta célula de leitura comunitária.</p>
    <form id="groupForm">
      <div class="field"><label for="title">Nome do grupo *</label><input id="title" name="title" required maxlength="100" placeholder="Ex.: Caminhando em Salmos"></div>
      <div class="two-fields">
        <div class="field"><label for="category">Tipo de leitura</label><select id="category" name="category"><option value="biblia">Bíblia</option><option value="livro">Livro</option></select></div>
        <div class="field"><label for="theme">Livro ou tema *</label><input id="theme" name="book_or_theme" required maxlength="150" placeholder="Ex.: Salmos"></div>
      </div>
      <div class="two-fields">
        <div class="field"><label for="groupCycleStart">Início do Ciclo</label><input id="groupCycleStart" name="cycle_start_date" type="date" value="${today}"></div>
        <div class="field"><label for="groupCycleEnd">Término do Ciclo</label><input id="groupCycleEnd" name="cycle_end_date" type="date" value="${next90}"></div>
      </div>
      <div class="field"><label for="description">Descrição (opcional)</label><textarea id="description" name="description" maxlength="1000"></textarea></div>
      <div class="form-actions">
        <button type="button" class="btn" data-action="close">Cancelar</button>
        <button class="btn primary" type="submit">Criar grupo</button>
      </div>
    </form>
  `);
}

function rewardModal() {
  const gList = groupsData || [];
  openModal(`
    <h2>Cadastrar Recompensa</h2>
    <p class="muted">Defina se o prêmio é geral da congregação ou exclusivo para uma célula/grupo de devocional.</p>
    <form id="rewardForm">
      <div class="field">
        <label for="rewTitle">Nome do prêmio *</label>
        <input id="rewTitle" name="title" required minlength="3" maxlength="150" placeholder="Ex.: Bíblia de Estudo NVT / Livro Teologia do Povo">
      </div>
      
      <div class="two-fields">
        <div class="field">
          <label for="rewGroupId">Destino do Prêmio</label>
          <select id="rewGroupId" name="groupId">
            <option value="">🌐 Toda a Igreja (Geral)</option>
            ${gList.map(g => `<option value="${esc(g.id)}">📍 Célula: ${esc(g.title)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="rewType">Modelo de Conquista *</label>
          <select id="rewType" name="rewardType">
            <option value="points">⭐ Por Meta de Pontos (Desbloqueio Contínuo)</option>
            <option value="podium">🏆 Por Pódio do Ciclo (1º, 2º ou 3º Lugar)</option>
          </select>
        </div>
      </div>

      <!-- Configuração de Pódio (1º, 2º ou 3º lugar) -->
      <div class="two-fields" id="podiumConfigRow" style="display:none">
        <div class="field">
          <label for="rewPodiumPos">Colocação no Pódio *</label>
          <select id="rewPodiumPos" name="podiumPosition">
            <option value="1">🥇 1º Lugar (Campeão da Célula)</option>
            <option value="2">🥈 2º Lugar (Vice-Campeão)</option>
            <option value="3">🥉 3º Lugar (3ª Colocação)</option>
          </select>
        </div>
        <div class="field">
          <label for="rewTierPodium">Nível do Troféu / Selo</label>
          <select id="rewTierPodium" name="tier">
            <option value="ouro">Ouro</option>
            <option value="prata">Prata</option>
            <option value="bronze">Bronze</option>
            <option value="especial">Especial</option>
          </select>
        </div>
      </div>

      <!-- Configuração por Pontos -->
      <div class="two-fields" id="pointsConfigRow">
        <div class="field">
          <label for="rewTierPoints">Nível</label>
          <select id="rewTierPoints" name="tier">
            <option value="bronze">Bronze</option>
            <option value="prata">Prata</option>
            <option value="ouro">Ouro</option>
            <option value="especial">Especial</option>
          </select>
        </div>
        <div class="field">
          <label for="pointsRequired">Pontos para desbloquear *</label>
          <input id="pointsRequired" name="pointsRequired" type="number" min="1" max="1000000" step="1" placeholder="Ex.: 1400" required>
        </div>
      </div>

      <!-- Calculadora de Metas de 3 Meses -->
      <div id="calculatorCard" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin:8px 0 16px;font-size:12px">
        <strong>🧮 Calculadora de Metas (Estimativa de 3 Meses / 90 dias):</strong>
        <p style="margin:4px 0 8px;color:#166534">50 pts/dia + 10 pts bônus diário = <strong>até 5.400 pontos possíveis</strong> na temporada.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn small soft" data-calc-fill="1600">🥉 Sugestão Bronze: 1.600 pts (30%)</button>
          <button type="button" class="btn small soft" data-calc-fill="3200">🥈 Sugestão Prata: 3.200 pts (60%)</button>
          <button type="button" class="btn small soft" data-calc-fill="4500">🥇 Sugestão Ouro: 4.500 pts (85%)</button>
        </div>
      </div>

      <div class="field">
        <label for="rewPartner">Local ou parceiro de retirada *</label>
        <input id="rewPartner" name="partnerName" required maxlength="150" placeholder="Ex.: Secretaria da Igreja / Livraria Central">
      </div>
      <div class="field">
        <label for="rewDesc">Descrição</label>
        <textarea id="rewDesc" name="description" maxlength="1000" placeholder="Detalhes, orientações ou regras de entrega deste prêmio..."></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" data-action="close">Cancelar</button>
        <button class="btn primary" type="submit">Cadastrar prêmio</button>
      </div>
    </form>
  `);

  const typeSelect = $('rewType');
  const groupSelect = $('rewGroupId');
  const podiumRow = $('podiumConfigRow');
  const pointsRow = $('pointsConfigRow');
  const calcCard = $('calculatorCard');
  const ptsInput = $('pointsRequired');

  typeSelect?.addEventListener('change', () => {
    const isPodium = typeSelect.value === 'podium';
    if (isPodium) {
      podiumRow.style.display = 'grid';
      pointsRow.style.display = 'none';
      calcCard.style.display = 'none';
      ptsInput.removeAttribute('required');
      ptsInput.value = '0';
      if (!groupSelect.value && gList.length > 0) {
        groupSelect.value = gList[0].id;
      }
    } else {
      podiumRow.style.display = 'none';
      pointsRow.style.display = 'grid';
      calcCard.style.display = 'block';
      ptsInput.setAttribute('required', 'required');
      if (ptsInput.value === '0') ptsInput.value = '';
    }
  });
}

function challengeModal() {
  openModal(`
    <h2>Uma jornada para compartilhar</h2>
    <form id="challengeForm">
      <div class="field"><label for="title">Título</label><input id="title" name="title" required maxlength="100"></div>
      <div class="field"><label for="description">Descrição</label><textarea id="description" name="description" maxlength="1000"></textarea></div>
      <div class="two-fields">
        <div class="field"><label for="startDate">Início</label><input id="startDate" name="startDate" type="date" required></div>
        <div class="field"><label for="endDate">Fim</label><input id="endDate" name="endDate" type="date" required></div>
      </div>
      <button class="btn primary">Criar e gerar convite</button>
    </form>
  `);
}

// Manipulação global de cliques
document.addEventListener('click', async event => {
  const el = event.target.closest('button, [data-action], [data-copy], [data-copy-link], [data-whatsapp-church], [data-whatsapp-group], [data-close-cycle], [data-calc-fill]');
  if (!el) return;

  if (el.dataset.calcFill) {
    const input = $('pointsRequired') || $('editRewPoints');
    if (input) {
      input.value = el.dataset.calcFill;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }

  if (el.dataset.closeCycle) {
    const gid = el.dataset.closeCycle;
    const gtitle = el.dataset.groupTitle || 'Grupo';
    if (confirm(`🏆 Deseja encerrar o ciclo do grupo "${gtitle}"?\n\nEsta ação consagrará a classificação final e emitirá os cupons digitais de premiação aos 3 primeiros colocados do pódio.`)) {
      try {
        const res = await api(`/groups/${gid}/close-cycle`, { method: 'POST' });
        const awarded = res.result?.awardedCoupons || [];
        const podium = res.result?.podiumWinners || [];
        openModal(`
          <h2>🏆 Ciclo Encerrado com Sucesso!</h2>
          <p class="muted">Parabéns aos irmãos da célula <strong>${esc(gtitle)}</strong> pela dedicação ao longo do ciclo de leitura!</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
            <h3 style="margin-top:0">🏅 Pódio da Célula:</h3>
            <ul style="list-style:none;padding:0;margin:0">
              ${podium.length ? podium.map(p => `
                <li style="padding:8px 0;border-bottom:1px solid #edf2f7;display:flex;justify-content:space-between">
                  <span><strong>${p.position === 1 ? '🥇 1º Lugar' : p.position === 2 ? '🥈 2º Lugar' : '🥉 3º Lugar'}</strong>: ${esc(p.name)}</span>
                  <span class="pill primary">${num(p.points)} pts</span>
                </li>
              `).join('') : '<li class="muted">Nenhum membro inscrito neste grupo ainda.</li>'}
            </ul>
          </div>
          ${awarded.length ? `
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
              <h3 style="margin-top:0;color:#166534">🎁 Cupons Emitidos para o Pódio:</h3>
              ${awarded.map(c => `
                <p style="margin:6px 0"><strong>${esc(c.winner_name)}</strong> (${c.position}º lugar): <code>${esc(c.coupon_code)}</code> · <em>${esc(c.reward_title)}</em></p>
              `).join('')}
            </div>
          ` : '<p class="muted">Dica: Para emitir cupons no pódio, cadastre prêmios do tipo "Por Pódio do Ciclo" vinculados a este grupo na aba de Prêmios.</p>'}
          <div class="form-actions">
            <button class="btn primary" type="button" data-action="close">Concluir</button>
          </div>
        `);
        await show('groups');
      } catch (err) {
        toast(err.message, true);
      }
    }
    return;
  }

  if (el.dataset.page) {
    if (el.dataset.page === 'reviews') reviewPage = 1;
    show(el.dataset.page);
  }

  if (el.dataset.demo) {
    $('email').value = el.dataset.demo;
    $('password').value = el.dataset.pwd || '1234';
    $('loginForm').requestSubmit();
  }

  // Copiar código
  if (el.dataset.copy) {
    navigator.clipboard?.writeText(el.dataset.copy);
    toast(`Código "${el.dataset.copy}" copiado para a área de transferência!`);
  }

  // Copiar link direto
  if (el.dataset.copyLink) {
    const url = `${window.location.protocol}//${window.location.hostname}:8081?invite=${encodeURIComponent(el.dataset.copyLink)}`;
    navigator.clipboard?.writeText(url);
    toast(`Link de convite copiado: ${url}`);
  }

  // WhatsApp Igreja
  if (el.dataset.whatsappChurch) {
    const churchName = el.dataset.churchName || 'nossa igreja';
    const code = el.dataset.whatsappChurch;
    const msg = `A paz do Senhor! Venha participar dos nossos momentos de oração e devocional na congregação ${churchName}. Conecte-se pelo aplicativo com nosso código: ${code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // WhatsApp Grupo
  if (el.dataset.whatsappGroup) {
    const title = el.dataset.groupTitle || 'grupo de leitura';
    const code = el.dataset.whatsappGroup;
    const msg = `A paz! Venha caminhar conosco no grupo "${title}". Entre no aplicativo e use o código de convite: ${code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // Gestão de Membros
  if (el.dataset.manage) manageMemberModal(el.dataset.manage);
  if (el.dataset.unlink) {
    const id = el.dataset.unlink;
    if (confirm('Tem certeza que deseja desvincular este membro da congregação? Ele será removido dos grupos da igreja.')) {
      try {
        const res = await api('/admin/members/' + id, { method: 'DELETE' });
        closeModal();
        toast(res.message);
        await show('members');
      } catch (err) {
        toast(err.message, true);
      }
    }
  }

  // Gestão de Grupos
  if (el.dataset.editGroup) editGroupModal(el.dataset.editGroup);
  if (el.dataset.groupMembers) groupMembersModal(el.dataset.groupMembers);
  if (el.dataset.deleteGroup) {
    const id = el.dataset.deleteGroup;
    if (confirm('Tem certeza que deseja excluir este grupo? Todas as anotações e vínculos desta célula serão removidos.')) {
      try {
        const res = await api('/groups/' + id, { method: 'DELETE' });
        toast(res.message);
        await show('groups');
      } catch (err) {
        toast(err.message, true);
      }
    }
  }
  if (el.dataset.removeGroupMember) {
    const groupId = el.dataset.removeGroupMember;
    const userId = el.dataset.userId;
    try {
      const res = await api(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
      toast(res.message);
      await groupMembersModal(groupId);
    } catch (err) {
      toast(err.message, true);
    }
  }

  // Gestão de Prêmios
  if (el.dataset.editReward) editRewardModal(el.dataset.editReward);
  if (el.dataset.deleteReward) {
    const id = el.dataset.deleteReward;
    if (confirm('Tem certeza que deseja excluir este prêmio do catálogo da temporada?')) {
      try {
        const res = await api('/admin/rewards/' + id, { method: 'DELETE' });
        toast(res.message);
        await show('rewards');
      } catch (err) {
        toast(err.message, true);
      }
    }
  }

  // Busca de CEP nos Correios na aba Igreja
  if (el.dataset.action === 'admin-search-cep') {
    const cepInput = $('adminChurchCep');
    const statusBox = $('adminCepStatus');
    const clean = (cepInput?.value || '').replace(/\D/g, '');
    if (clean.length !== 8) {
      statusBox.style.display = 'block';
      statusBox.className = 'error';
      statusBox.textContent = 'Digite o CEP com 8 dígitos numéricos.';
      return;
    }
    statusBox.style.display = 'block';
    statusBox.className = 'notice';
    statusBox.textContent = 'Consultando base dos Correios…';
    try {
      const res = await api(`/cep/${clean}`);
      if (res.success && res.address) {
        if ($('churchCity')) $('churchCity').value = res.address.city || '';
        if ($('churchState')) $('churchState').value = res.address.state || '';
        if ($('churchAddress')) $('churchAddress').value = [res.address.street, res.address.neighborhood].filter(Boolean).join(', ');
        statusBox.className = 'success';
        statusBox.textContent = `Endereço localizado via Correios: ${res.address.street || ''}, ${res.address.neighborhood || ''} - ${res.address.city}/${res.address.state}`;
      }
    } catch (err) {
      statusBox.className = 'error';
      statusBox.textContent = err.message || 'CEP não localizado. Preencha manualmente.';
    }
  }

  // Ações de Devocional
  if (el.dataset.review) reviewModal(el.dataset.review);
  if (el.dataset.delete) {
    const id = el.dataset.delete;
    openModal(`
      <h2>Excluir este devocional?</h2>
      <p>A anotação e suas orientações serão removidas. Os pontos deste registro serão descontados. Essa ação não pode ser desfeita.</p>
      <form id="deleteForm" data-id="${esc(id)}">
        <div class="form-actions">
          <button class="btn" type="button" data-action="close">Cancelar</button>
          <button class="btn danger">Excluir e corrigir pontos</button>
        </div>
      </form>
    `);
  }

  const action = el.dataset.action;
  if (action === 'logout') logout();
  if (action === 'refresh') show(page);
  if (action === 'close') closeModal();
  if (action === 'create-reward') rewardModal();
  if (action === 'create-group') groupModal();
  if (action === 'create-challenge') challengeModal();
  if (action === 'review-prev' && reviewPage > 1) { reviewPage--; show('reviews'); }
  if (action === 'review-next') { reviewPage++; show('reviews'); }
});

// Filtros e buscas
document.addEventListener('input', event => {
  if (event.target.id === 'memberSearch') {
    const term = event.target.value.toLocaleLowerCase('pt-BR');
    $('memberRows').innerHTML = memberRows(members.filter(m => (m.name + ' ' + m.email).toLocaleLowerCase('pt-BR').includes(term)));
  }
});

document.addEventListener('change', event => {
  if (event.target.id === 'reviewFilter') {
    reviewFilter = event.target.value;
    reviewPage = 1;
    show('reviews');
  }
});

// Submissão de Formulários
document.addEventListener('submit', async event => {
  const form = event.target;
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"], button:not([type])');
  if (submit?.disabled) return;
  if (submit) submit.disabled = true;
  const values = Object.fromEntries(new FormData(form));

  try {
    // 1. Login
    if (form.id === 'loginForm') {
      $('loginError').hidden = true;
      await login(values.email.trim(), values.password);
    }

    // 2. Editar Igreja
    if (form.id === 'churchForm') {
      const res = await api('/admin/church', { method: 'PATCH', body: JSON.stringify(values) });
      toast(res.message);
      $('churchName').textContent = res.church.name;
      await show('church');
    }

    // 3. Alterar Cargo de Membro
    if (form.id === 'memberRoleForm') {
      const res = await api('/admin/users/role', { method: 'PATCH', body: JSON.stringify({ userId: form.dataset.id, role: values.role }) });
      closeModal();
      toast(res.message);
      await show('members');
    }

    // 4. Conceder Bônus
    if (form.id === 'memberBonusForm') {
      const res = await api('/admin/bonus', { method: 'POST', body: JSON.stringify({ userId: form.dataset.id, amount: Number(values.amount), reason: values.reason }) });
      closeModal();
      toast(res.message);
      await show('members');
    }

    // 5. Editar Grupo
    if (form.id === 'editGroupForm') {
      const res = await api('/groups/' + form.dataset.id, { method: 'PATCH', body: JSON.stringify(values) });
      closeModal();
      toast(res.message);
      await show('groups');
    }

    // 6. Criar Grupo
    if (form.id === 'groupForm') {
      const res = await api('/groups', { method: 'POST', body: JSON.stringify(values) });
      closeModal();
      toast('Grupo criado! Convite: ' + res.group.invite_code);
      await show('groups');
    }

    // 7. Vincular Membro ao Grupo
    if (form.id === 'addGroupMemberForm') {
      const res = await api(`/groups/${form.dataset.id}/members`, { method: 'POST', body: JSON.stringify(values) });
      toast(res.message);
      await groupMembersModal(form.dataset.id);
    }

    // 8. Cadastrar Prêmio
    if (form.id === 'rewardForm') {
      await api('/admin/rewards', { method: 'POST', body: JSON.stringify(values) });
      closeModal();
      toast('Prêmio cadastrado para este trimestre.');
      await show('rewards');
    }

    // 9. Editar Prêmio
    if (form.id === 'editRewardForm') {
      const res = await api('/admin/rewards/' + form.dataset.id, { method: 'PATCH', body: JSON.stringify(values) });
      closeModal();
      toast(res.message);
      await show('rewards');
    }

    // 10. Resgate de Cupom
    if (form.id === 'redeemForm') {
      const res = await api('/gamification/redeem', { method: 'POST', body: JSON.stringify(values) });
      $('redeemResult').innerHTML = `<div class="success"><strong>Entrega registrada.</strong><p style="margin:8px 0 0">${esc(res.coupon?.member_name || '')} · ${esc(res.coupon?.reward_title || res.message)}</p></div>`;
      form.reset();
    }

    // 11. Jornada Inter-Igrejas
    if (form.id === 'joinChallenge') {
      await api('/gamification/challenge/join', { method: 'POST', body: JSON.stringify(values) });
      toast('Sua igreja entrou na jornada.');
      await show('challenge');
    }
    if (form.id === 'challengeForm') {
      if (values.endDate < values.startDate) throw new Error('A data final deve ser igual ou posterior à inicial.');
      await api('/gamification/challenge', { method: 'POST', body: JSON.stringify(values) });
      closeModal();
      toast('Jornada criada. Compartilhe o código de convite.');
      await show('challenge');
    }

    // 12. Devocional (Exclusão e Orientação)
    if (form.id === 'deleteForm') {
      await api('/admin/devotionals/' + form.dataset.id + '?deductPoints=true', { method: 'DELETE' });
      closeModal();
      toast('Devocional excluído e pontos corrigidos.');
      await show('reviews');
    }
    if (form.id === 'feedbackForm') {
      await api('/devotionals/' + form.dataset.id + '/feedback', { method: 'POST', body: JSON.stringify(values) });
      closeModal();
      toast('Orientação enviada. Seu cuidado chegou ao membro.');
      await show('reviews');
    }
  } catch (error) {
    const message = error.message || 'Falha na conexão. Tente novamente.';
    if (form.id === 'loginForm') {
      $('loginError').textContent = message;
      $('loginError').hidden = false;
    } else if (form.id === 'redeemForm') {
      $('redeemResult').innerHTML = `<p class="error" role="alert">${esc(message)}</p>`;
    } else {
      toast(message, true);
    }
  } finally {
    if (submit) submit.disabled = false;
  }
});

$('closeModal').addEventListener('click', closeModal);
$('modal').addEventListener('cancel', event => { event.preventDefault(); closeModal(); });

fetch('/api/health').then(r => r.json()).then(d => $('demo').hidden = !d.demo_mode).catch(() => {});
if (token) restore().catch(error => {
  logout();
  $('loginError').textContent = error.message || 'Reconecte-se ao servidor.';
  $('loginError').hidden = false;
});
