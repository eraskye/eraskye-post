const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const API = '/api/admin';

const state = { user: null, tab: 'dashboard' };

async function api(path, { method = 'GET', body } = {}) {
  const opts = { method, credentials: 'include' };
  if (body) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
  const r = await fetch(API + path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Failed');
  return data;
}

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(m) { const t = document.createElement('div'); t.className='toast show'; t.textContent=m; document.body.appendChild(t); setTimeout(()=>t.remove(), 2200); }

function renderLogin() {
  $('#adminRoot').innerHTML = `
    <div class="auth-wrap">
      <div class="auth-hero"><h1>ERA<span>SKYE</span></h1><p>ADMIN</p></div>
      <form id="adminForm">
        <label class="form-field"><label>Admin username</label><input name="username" required></label>
        <label class="form-field"><label>Password</label><input type="password" name="password" required></label>
        <button class="btn primary full" style="margin-top:14px">Sign in</button>
      </form>
    </div>`;
  $('#adminForm').onsubmit = async e => {
    e.preventDefault();
    const f = e.target;
    try {
      const r = await api('/login', { method: 'POST', body: { username: f.username.value.trim(), password: f.password.value } });
      state.user = r.user; renderApp();
    } catch (err) { toast(err.message); }
  };
}

async function renderApp() {
  $('#adminRoot').innerHTML = `
    <div class="admin-top">
      <div class="logo">ERA<span>SKYE</span> · ADMIN</div>
      <button class="icon-btn" id="adminLogout">⎋</button>
    </div>
    <div class="admin-tabs">
      ${['dashboard','users','posts','comments','reports'].map(t => `<button data-t="${t}" class="${state.tab === t ? 'active' : ''}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}
    </div>
    <div id="adminBody" style="padding-bottom:40px"></div>`;
  $('#adminLogout').onclick = async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); location.reload(); };
  $$('.admin-tabs button').forEach(b => b.onclick = () => { state.tab = b.dataset.t; renderApp(); });
  const body = $('#adminBody');
  body.innerHTML = 'Loading…';
  try {
    if (state.tab === 'dashboard') {
      const s = await api('/stats');
      body.innerHTML = `<div class="admin-grid">
        <div class="admin-stat"><div class="n">${s.users}</div><div class="l">Users</div></div>
        <div class="admin-stat"><div class="n">${s.posts}</div><div class="l">Posts</div></div>
        <div class="admin-stat"><div class="n">${s.comments}</div><div class="l">Comments</div></div>
        <div class="admin-stat"><div class="n">${s.likes}</div><div class="l">Likes</div></div>
        <div class="admin-stat"><div class="n">${s.reports}</div><div class="l">Pending reports</div></div>
      </div>`;
    }
    if (state.tab === 'users') {
      const r = await api('/users');
      body.innerHTML = r.users.map(u => `
        <div class="admin-row">
          <div class="g"><b>@${escapeHtml(u.username)}</b> ${u.is_admin ? '· admin':''} ${u.is_blocked ? '· <span style="color:var(--red)">blocked</span>':''}<small>${escapeHtml(u.email)}</small></div>
          <div class="actions-row">
            ${u.is_blocked ? `<button data-unblock="${u.id}">Unblock</button>` : `<button data-block="${u.id}" class="danger">Block</button>`}
            <button data-deluser="${u.id}" class="danger">Delete</button>
          </div>
        </div>`).join('');
      $$('[data-block]', body).forEach(b => b.onclick = async () => { await api(`/users/${b.dataset.block}/block`, { method: 'POST' }); toast('Blocked'); renderApp(); });
      $$('[data-unblock]', body).forEach(b => b.onclick = async () => { await api(`/users/${b.dataset.unblock}/unblock`, { method: 'POST' }); toast('Unblocked'); renderApp(); });
      $$('[data-deluser]', body).forEach(b => b.onclick = async () => { if (!confirm('Delete user?')) return; await api(`/users/${b.dataset.deluser}`, { method: 'DELETE' }); toast('Deleted'); renderApp(); });
    }
    if (state.tab === 'posts') {
      const r = await api('/posts');
      body.innerHTML = r.posts.map(p => `
        <div class="admin-row">
          <div class="g"><b>@${escapeHtml(p.username)}</b><small>${escapeHtml((p.text||'').slice(0,120)) || '[image/music]'}</small></div>
          <div class="actions-row"><button data-delpost="${p.id}" class="danger">Delete</button></div>
        </div>`).join('') || '<div class="empty">None</div>';
      $$('[data-delpost]', body).forEach(b => b.onclick = async () => { if (!confirm('Delete post?')) return; await api(`/posts/${b.dataset.delpost}`, { method: 'DELETE' }); toast('Deleted'); renderApp(); });
    }
    if (state.tab === 'comments') {
      const r = await api('/comments');
      body.innerHTML = r.comments.map(c => `
        <div class="admin-row">
          <div class="g"><b>@${escapeHtml(c.username)}</b><small>${escapeHtml(c.text)}</small></div>
          <div class="actions-row"><button data-delcomm="${c.id}" class="danger">Delete</button></div>
        </div>`).join('') || '<div class="empty">None</div>';
      $$('[data-delcomm]', body).forEach(b => b.onclick = async () => { if (!confirm('Delete?')) return; await api(`/comments/${b.dataset.delcomm}`, { method: 'DELETE' }); toast('Deleted'); renderApp(); });
    }
    if (state.tab === 'reports') {
      const r = await api('/reports');
      body.innerHTML = r.reports.map(x => `
        <div class="admin-row">
          <div class="g"><b>${escapeHtml(x.reason)}</b> · @${escapeHtml(x.reporter)}<small>${escapeHtml((x.post_text||'').slice(0,120))} · <span style="color:${x.status==='pending'?'var(--red)':'var(--green)'}">${x.status}</span></small></div>
          ${x.status === 'pending' ? `<div class="actions-row">
            <button data-res="${x.id}" class="ok">Resolve</button>
            <button data-rej="${x.id}" class="danger">Reject</button>
          </div>` : ''}
        </div>`).join('') || '<div class="empty">No reports</div>';
      $$('[data-res]', body).forEach(b => b.onclick = async () => { await api(`/reports/${b.dataset.res}/resolve`, { method: 'POST' }); renderApp(); });
      $$('[data-rej]', body).forEach(b => b.onclick = async () => { await api(`/reports/${b.dataset.rej}/reject`, { method: 'POST' }); renderApp(); });
    }
  } catch (e) {
    body.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
  }
}

// boot
(async () => {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json());
    if (r.user?.is_admin) { state.user = r.user; renderApp(); return; }
  } catch {}
  renderLogin();
})();
