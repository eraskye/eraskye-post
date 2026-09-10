// ---------- helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const API = '/api';

const state = {
  user: null,
  view: 'feed',
  feed: [],
  feedCursor: null,
  feedLoading: false,
  profileUser: null,
  searchQ: '',
  searchType: 'all',
  searchResults: { users: [], posts: [] },
  notifications: [],
  unread: 0,
  savedPosts: [],
  editAvatar: null,
  createImages: [],
  createMusic: null,
};

async function api(path, { method = 'GET', body, raw = false } = {}) {
  const opts = { method, credentials: 'include' };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
  const r = await fetch(API + path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), ms);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtTime(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'now';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  const dd = Math.floor(h / 24);
  if (dd < 7) return dd + 'd';
  return new Date(ts).toLocaleDateString();
}

function avatarHtml(user, cls = '') {
  if (user?.avatar) return `<img class="avatar ${cls}" src="${escapeHtml(user.avatar)}" alt="">`;
  const letter = (user?.username || '?')[0].toUpperCase();
  return `<div class="avatar-letter ${cls}">${letter}</div>`;
}

// ---------- router ----------
function setView(view) {
  state.view = view;
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  render();
}

function render() {
  if (!state.user) return renderAuth();
  const main = $('#main');
  main.innerHTML = '';
  ({ feed: renderFeed, search: renderSearch, notifications: renderNotifications, profile: renderProfile, saved: renderSaved }[state.view] || renderFeed)(main);
}

// ---------- auth ----------
function renderAuth() {
  const main = $('#main');
  main.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-hero">
        <h1>ERA<span>SKYE</span></h1>
        <p>share the moment</p>
      </div>
      <div class="tabs">
        <button class="active" data-tab="login">Login</button>
        <button data-tab="register">Register</button>
      </div>
      <form id="authForm"></form>
    </div>`;
  $$('.tabs button', main).forEach(b => b.onclick = () => {
    $$('.tabs button', main).forEach(x => x.classList.toggle('active', x === b));
    renderAuthForm(b.dataset.tab);
  });
  renderAuthForm('login');
}

function renderAuthForm(mode) {
  const form = $('#authForm');
  if (mode === 'login') {
    form.innerHTML = `
      <label class="form-field"><label>Username or Email</label><input name="username" autocomplete="username" required></label>
      <label class="form-field"><label>Password</label><input type="password" name="password" autocomplete="current-password" required></label>
      <button type="submit" class="btn primary full" style="margin-top:14px">Login</button>`;
  } else {
    form.innerHTML = `
      <label class="form-field"><label>Avatar (optional)</label><input type="file" accept="image/*" name="avatar"></label>
      <label class="form-field"><label>Username</label><input name="username" pattern="[a-zA-Z0-9_.]{3,24}" required></label>
      <label class="form-field"><label>Full name</label><input name="name" required></label>
      <label class="form-field"><label>Email</label><input type="email" name="email" required></label>
      <label class="form-field"><label>Password</label><input type="password" name="password" minlength="6" required></label>
      <label class="form-field"><label>Confirm password</label><input type="password" name="confirm" minlength="6" required></label>
      <button type="submit" class="btn primary full" style="margin-top:14px">Create account</button>`;
  }
  form.onsubmit = async e => {
    e.preventDefault();
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      if (mode === 'login') {
        const r = await api('/auth/login', { method: 'POST', body: { username: form.username.value.trim(), password: form.password.value } });
        state.user = r.user;
      } else {
        const fd = new FormData();
        ['username', 'name', 'email', 'password', 'confirm'].forEach(k => fd.append(k, form[k].value.trim ? form[k].value.trim() : form[k].value));
        if (form.avatar.files[0]) fd.append('avatar', form.avatar.files[0]);
        const r = await api('/auth/register', { method: 'POST', body: fd });
        state.user = r.user;
      }
      setView('feed'); loadFeed(true); loadUnread();
    } catch (err) { toast(err.message); btn.disabled = false; }
  };
}

// ---------- feed ----------
async function loadFeed(reset = false) {
  if (state.feedLoading) return;
  state.feedLoading = true;
  if (reset) { state.feed = []; state.feedCursor = null; }
  render();
  try {
    const url = `/posts/feed?limit=15${state.feedCursor ? `&cursor=${state.feedCursor}` : ''}`;
    const r = await api(url);
    state.feed = reset ? r.posts : [...state.feed, ...r.posts];
    state.feedCursor = r.nextCursor;
  } catch (e) { toast(e.message); }
  state.feedLoading = false;
  render();
}

function renderFeed(main) {
  if (state.feedLoading && !state.feed.length) {
    main.innerHTML = Array.from({ length: 3 }).map(() => `
      <div class="sk-card">
        <div style="padding:14px;display:flex;gap:10px;align-items:center"><div class="sk avatar"></div><div style="flex:1"><div class="sk sk-line" style="width:40%"></div><div class="sk sk-line" style="width:20%"></div></div></div>
        <div class="sk" style="height:220px"></div>
      </div>`).join('');
    return;
  }
  if (!state.feed.length) {
    main.innerHTML = `<div class="empty"><div class="icon">✦</div><div>No posts yet</div><div style="margin-top:6px;font-size:13px">Be the first to share something</div></div>`;
    return;
  }
  main.innerHTML = state.feed.map(postHtml).join('') + (state.feedCursor ? `<div id="loadMore" style="padding:20px;text-align:center;color:var(--muted);font-size:13px">Loading...</div>` : '');
  attachPostHandlers(main);
  if (state.feedCursor) {
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { io.disconnect(); loadFeed(false); }
    }, { rootMargin: '400px' });
    io.observe($('#loadMore'));
  }
}

function postHtml(p) {
  const isMine = p.user.id === state.user.id;
  return `
    <article class="card" data-post-id="${p.id}">
      <div class="post-head">
        <div data-nav-user="${escapeHtml(p.user.username)}" style="cursor:pointer">${avatarHtml(p.user)}</div>
        <div class="who" data-nav-user="${escapeHtml(p.user.username)}" style="cursor:pointer">
          <div class="uname">${escapeHtml(p.user.username)}</div>
          <div class="time">${fmtTime(p.created_at)}</div>
        </div>
        <button class="menu" data-menu="${p.id}" data-owner="${p.user.id}">⋯</button>
      </div>
      ${p.text ? `<div class="post-text">${escapeHtml(p.text)}</div>` : ''}
      ${p.images.length ? `<div class="post-imgs ${p.images.length > 1 ? 'multi' : ''}">${p.images.map(u => `<img src="${escapeHtml(u)}" loading="lazy" alt="">`).join('')}</div>` : ''}
      ${p.music ? musicHtml(p.music, p.id) : ''}
      <div class="actions">
        <button data-like="${p.id}" class="${p.liked ? 'liked' : ''}">${p.liked ? '♥' : '♡'} <span data-like-count="${p.id}">${p.likes}</span></button>
        <button data-comments="${p.id}">💬 <span>${p.comments}</span></button>
        <button data-share="${p.id}">↗ Share</button>
        <span class="spacer"></span>
        <button data-save="${p.id}" class="${p.saved ? 'saved' : ''}">${p.saved ? '★' : '☆'}</button>
      </div>
    </article>`;
}

function musicHtml(m, postId) {
  if (m.preview_url) {
    return `
      <div class="music-card" data-music-post="${postId}">
        <img src="${escapeHtml(m.cover_url)}" alt="">
        <div class="music-meta">
          <div class="t">${escapeHtml(m.track_name)}</div>
          <div class="a">${escapeHtml(m.artist)}</div>
          <div class="progress"><i data-progress="${postId}"></i></div>
        </div>
        <button class="music-play" data-play="${postId}">▶</button>
        <audio data-audio="${postId}" src="${escapeHtml(m.preview_url)}" preload="none"></audio>
      </div>`;
  }
  if (m.embed_url) {
    return `<div class="spotify-embed"><iframe src="${escapeHtml(m.embed_url)}" loading="lazy" allow="encrypted-media; clipboard-write"></iframe></div>`;
  }
  return '';
}

function attachPostHandlers(root) {
  $$('[data-like]', root).forEach(b => b.onclick = async () => {
    try {
      const r = await api(`/likes/${b.dataset.like}`, { method: 'POST' });
      b.classList.toggle('liked', r.liked);
      b.firstChild.textContent = r.liked ? '♥ ' : '♡ ';
      $(`[data-like-count="${b.dataset.like}"]`).textContent = r.likes;
    } catch (e) { toast(e.message); }
  });
  $$('[data-save]', root).forEach(b => b.onclick = async () => {
    try {
      const r = await api(`/saved/${b.dataset.save}`, { method: 'POST' });
      b.classList.toggle('saved', r.saved);
      b.textContent = r.saved ? '★' : '☆';
    } catch (e) { toast(e.message); }
  });
  $$('[data-comments]', root).forEach(b => b.onclick = () => openComments(b.dataset.comments));
  $$('[data-share]', root).forEach(b => b.onclick = () => sharePost(b.dataset.share));
  $$('[data-menu]', root).forEach(b => b.onclick = () => openPostMenu(b.dataset.menu, +b.dataset.owner));
  $$('[data-play]', root).forEach(b => b.onclick = () => togglePlay(b.dataset.play));
  $$('[data-nav-user]', root).forEach(el => el.onclick = () => openProfile(el.dataset.navUser));
}

// ---------- audio ----------
const audioState = {};
function togglePlay(postId) {
  const audio = $(`[data-audio="${postId}"]`);
  const btn = $(`[data-play="${postId}"]`);
  if (!audio) return;
  if (audio.paused) {
    Object.keys(audioState).forEach(k => { if (audioState[k] && k != postId) { audioState[k].pause(); const ob = $(`[data-play="${k}"]`); if (ob) ob.textContent = '▶'; } });
    audio.play().then(() => { btn.textContent = '❚❚'; audioState[postId] = audio; });
    audio.onended = () => { btn.textContent = '▶'; };
    audio.ontimeupdate = () => {
      const prog = $(`[data-progress="${postId}"]`);
      if (prog && audio.duration) prog.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
    };
  } else {
    audio.pause(); btn.textContent = '▶';
  }
}

// ---------- share ----------
async function sharePost(postId) {
  const url = `${location.origin}/#post-${postId}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'ERASKYE', text: 'Check this post on ERASKYE', url }); }
    catch {}
  } else {
    try { await navigator.clipboard.writeText(url); toast('Link copied'); }
    catch { toast(url); }
  }
}

// ---------- post menu (report/delete) ----------
function openPostMenu(postId, ownerId) {
  const isMine = ownerId === state.user.id;
  const sheet = mkSheet('Post options');
  const body = $('.sheet-body', sheet);
  if (isMine) {
    body.innerHTML = `<button class="btn danger full" id="delPost">Delete post</button>`;
    $('#delPost', sheet).onclick = async () => {
      if (!confirm('Delete this post?')) return;
      await api(`/posts/${postId}`, { method: 'DELETE' });
      state.feed = state.feed.filter(p => p.id != postId);
      closeSheet(); toast('Deleted'); render();
    };
  } else {
    body.innerHTML = `
      <button class="btn full" data-reason="spam">🚫 Spam</button>
      <button class="btn full" data-reason="inappropriate" style="margin-top:8px">🔞 Inappropriate content</button>
      <button class="btn full" data-reason="insult" style="margin-top:8px">💢 Insult</button>
      <button class="btn full" data-reason="other" style="margin-top:8px">⚠ Other</button>`;
    $$('button[data-reason]', body).forEach(b => b.onclick = async () => {
      try { await api('/reports', { method: 'POST', body: { post_id: postId, reason: b.dataset.reason } }); toast('Reported. Thank you'); closeSheet(); }
      catch (e) { toast(e.message); }
    });
  }
}

// ---------- comments sheet ----------
async function openComments(postId) {
  const sheet = mkSheet('Comments');
  const body = $('.sheet-body', sheet);
  body.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px">Loading...</div>`;
  const footHtml = `
    <div class="comment-input" style="position:sticky;bottom:0">
      <input type="text" id="commentInput" placeholder="Add a comment..." maxlength="500" autocomplete="off">
      <button id="sendComment">Post</button>
    </div>`;
  const foot = document.createElement('div');
  foot.innerHTML = footHtml;
  sheet.appendChild(foot);

  async function load() {
    const { comments } = await api(`/comments/post/${postId}`);
    body.innerHTML = comments.length
      ? comments.map(c => `
        <div class="comment" data-cid="${c.id}">
          <div>${avatarHtml(c.user, 'sm')}</div>
          <div class="body">
            <div class="head"><span class="u">${escapeHtml(c.user.username)}</span><span class="t">· ${fmtTime(c.created_at)}</span></div>
            <div class="text">${escapeHtml(c.text)}</div>
            <div class="cactions">
              <button data-clike="${c.id}" class="${c.liked ? 'liked' : ''}">${c.liked ? '♥' : '♡'} ${c.likes}</button>
              ${c.user.id === state.user.id ? `<button data-cdel="${c.id}">Delete</button>` : ''}
            </div>
          </div>
        </div>`).join('')
      : `<div class="empty" style="padding:30px">No comments yet</div>`;
    $$('[data-clike]', body).forEach(b => b.onclick = async () => {
      const r = await api(`/comments/${b.dataset.clike}/like`, { method: 'POST' });
      b.classList.toggle('liked', r.liked);
      b.textContent = `${r.liked ? '♥' : '♡'} ${r.likes}`;
    });
    $$('[data-cdel]', body).forEach(b => b.onclick = async () => {
      if (!confirm('Delete comment?')) return;
      await api(`/comments/${b.dataset.cdel}`, { method: 'DELETE' });
      load();
    });
  }

  $('#sendComment', foot).onclick = async () => {
    const inp = $('#commentInput', foot);
    const text = inp.value.trim(); if (!text) return;
    inp.value = '';
    try {
      const r = await api(`/comments/post/${postId}`, { method: 'POST', body: { text } });
      const c = r.comment;
      const html = `
        <div class="comment" data-cid="${c.id}">
          <div>${avatarHtml(c.user, 'sm')}</div>
          <div class="body">
            <div class="head"><span class="u">${escapeHtml(c.user.username)}</span><span class="t">· now</span></div>
            <div class="text">${escapeHtml(c.text)}</div>
            <div class="cactions"><button data-clike="${c.id}">♡ 0</button><button data-cdel="${c.id}">Delete</button></div>
          </div>
        </div>`;
      if ($('.empty', body)) body.innerHTML = '';
      body.insertAdjacentHTML('beforeend', html);
      const newPost = state.feed.find(p => p.id == postId);
      if (newPost) newPost.comments++;
      render();
      load();
    } catch (e) { toast(e.message); }
  };
  load();
}

// ---------- sheet helpers ----------
let sheetEls = [];
function mkSheet(title) {
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `<div class="sheet-grip"></div><div class="sheet-header"><div class="sheet-title">${escapeHtml(title)}</div><button class="icon-btn" data-close>✕</button></div><div class="sheet-body"></div>`;
  $('#modalRoot').appendChild(backdrop);
  $('#modalRoot').appendChild(sheet);
  requestAnimationFrame(() => { backdrop.classList.add('show'); sheet.classList.add('show'); });
  const close = () => closeSheet();
  backdrop.onclick = close;
  $('[data-close]', sheet).onclick = close;
  sheetEls.push({ backdrop, sheet });
  return sheet;
}
function closeSheet() {
  const item = sheetEls.pop();
  if (!item) return;
  item.backdrop.classList.remove('show');
  item.sheet.classList.remove('show');
  setTimeout(() => { item.backdrop.remove(); item.sheet.remove(); }, 250);
}

// ---------- create post ----------
function openCreate() {
  const sheet = mkSheet('New post');
  sheet.style.maxHeight = '92dvh';
  const body = $('.sheet-body', sheet);
  body.innerHTML = `
    <div class="create-form">
      <textarea id="postText" placeholder="What's on your mind?" maxlength="2000" style="min-height:100px;background:transparent;border:0;outline:none;font-size:16px;resize:none;color:var(--text)"></textarea>
      <div id="imgPreviews" class="create-preview-grid"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ghost sm" id="pickImg">🖼 Photo</button>
        <button class="btn ghost sm" id="pickMusic">♪ Music</button>
      </div>
      <div id="musicSlot"></div>
    </div>`;
  const fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.multiple = true;
  fileInput.style.display = 'none';
  body.appendChild(fileInput);

  function renderPreviews() {
    const grid = $('#imgPreviews', body);
    grid.innerHTML = state.createImages.map((f, i) => {
      const url = URL.createObjectURL(f);
      return `<div class="create-preview"><img src="${url}" alt=""><button class="x" data-rm="${i}">✕</button></div>`;
    }).join('') + (state.createImages.length < 4 ? `<label class="pick-tile" id="addImg"><div class="big">+</div><div>Add</div></label>` : '');
    const add = $('#addImg', body);
    if (add) add.onclick = () => fileInput.click();
    $$('[data-rm]', body).forEach(b => b.onclick = () => { state.createImages.splice(+b.dataset.rm, 1); renderPreviews(); });
  }

  fileInput.onchange = () => {
    for (const f of fileInput.files) { if (state.createImages.length >= 4) break; state.createImages.push(f); }
    fileInput.value = '';
    renderPreviews();
  };
  $('#pickImg', body).onclick = () => fileInput.click();
  renderPreviews();

  function renderMusic() {
    const slot = $('#musicSlot', body);
    if (!state.createMusic) { slot.innerHTML = ''; return; }
    const m = state.createMusic;
    slot.innerHTML = `
      <div class="music-card" style="margin:0">
        <img src="${escapeHtml(m.cover_url || '')}" alt="">
        <div class="music-meta"><div class="t">${escapeHtml(m.track_name)}</div><div class="a">${escapeHtml(m.artist)}</div></div>
        <button class="icon-btn" id="rmMusic">✕</button>
      </div>
      ${m.preview_url ? `<div style="margin-top:8px"><audio controls src="${escapeHtml(m.preview_url)}" style="width:100%"></audio></div>` : ''}`;
    $('#rmMusic', slot).onclick = () => { state.createMusic = null; renderMusic(); };
  }
  $('#pickMusic', body).onclick = () => openMusicPicker(track => { state.createMusic = track; renderMusic(); });
  renderMusic();

  const actions = document.createElement('div');
  actions.className = 'sheet-actions';
  actions.innerHTML = `<button class="btn ghost full" data-close>Cancel</button><button class="btn primary full" id="publishBtn">Publish</button>`;
  sheet.appendChild(actions);
  $('[data-close]', actions).onclick = closeSheet;
  $('#publishBtn', actions).onclick = async () => {
    const text = $('#postText', body).value.trim();
    if (!text && !state.createImages.length && !state.createMusic) return toast('Empty post');
    const fd = new FormData();
    fd.append('text', text);
    state.createImages.forEach(f => fd.append('images', f));
    if (state.createMusic) fd.append('music', JSON.stringify(state.createMusic));
    $('#publishBtn', actions).disabled = true;
    try {
      const r = await api('/posts', { method: 'POST', body: fd });
      state.feed.unshift(r.post);
      state.createImages = []; state.createMusic = null;
      closeSheet(); setView('feed'); toast('Posted');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { toast(e.message); $('#publishBtn', actions).disabled = false; }
  };
}

// ---------- music picker ----------
function openMusicPicker(onPick) {
  const sheet = mkSheet('Add music');
  const body = $('.sheet-body', sheet);
  body.innerHTML = `
    <div class="search-bar" style="padding:0 0 12px">
      <input id="musicQ" placeholder="Search on Spotify..." autocomplete="off">
    </div>
    <div id="musicResults" style="text-align:center;color:var(--muted);font-size:13px;padding:20px">Start typing…</div>`;
  const input = $('#musicQ', body);
  let timer = null;
  input.oninput = () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) { $('#musicResults', body).innerHTML = 'Start typing…'; return; }
    timer = setTimeout(async () => {
      $('#musicResults', body).innerHTML = 'Searching…';
      try {
        const r = await api(`/music/search?q=${encodeURIComponent(q)}`);
        const tr = r.tracks;
        $('#musicResults', body).innerHTML = tr.length
          ? tr.map(t => `
            <div class="track-row" data-track='${escapeHtml(JSON.stringify(t))}'>
              <img src="${escapeHtml(t.cover_url)}" alt="">
              <div class="info"><div class="n">${escapeHtml(t.track_name)}</div><div class="a">${escapeHtml(t.artist)}</div></div>
            </div>`).join('')
          : 'Nothing found';
        $$('.track-row', body).forEach(row => row.onclick = () => {
          const t = JSON.parse(row.dataset.track);
          onPick(t); closeSheet();
        });
      } catch (e) { $('#musicResults', body).innerHTML = escapeHtml(e.message); }
    }, 350);
  };
}

// ---------- profile ----------
async function openProfile(username) {
  try {
    const r = await api(`/users/${encodeURIComponent(username)}`);
    state.profileUser = r.user;
    state.view = 'profile';
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'profile'));
    render();
  } catch (e) { toast(e.message); }
}

async function renderProfile(main) {
  const u = state.profileUser;
  if (!u) {
    if (state.user) return openProfile(state.user.username);
    return;
  }
  main.innerHTML = `
    <div class="profile-head">
      ${avatarHtml(u, 'lg')}
      <div class="profile-name">${escapeHtml(u.name)}</div>
      <div class="profile-username">@${escapeHtml(u.username)}</div>
      ${u.bio ? `<div class="profile-bio">${escapeHtml(u.bio)}</div>` : ''}
      <div class="stats">
        <div class="stat"><div class="n" id="cntPosts">${u.posts}</div><div class="l">Posts</div></div>
        <div class="stat" id="followersBtn"><div class="n">${u.followers}</div><div class="l">Followers</div></div>
        <div class="stat" id="followingBtn"><div class="n">${u.following}</div><div class="l">Following</div></div>
      </div>
      <div class="profile-actions">
        ${u.isMe
          ? `<button class="btn ghost full" id="editProfile">Edit profile</button><button class="btn ghost full" id="openSaved">Saved</button>`
          : `<button class="btn ${u.isFollowing ? 'ghost' : 'primary'} full" id="followBtn">${u.isFollowing ? 'Following' : 'Follow'}</button>`}
      </div>
    </div>
    <div id="profilePosts"></div>`;

  $('#followersBtn').onclick = () => openUserList(u.username, 'followers');
  $('#followingBtn').onclick = () => openUserList(u.username, 'following');

  if (u.isMe) {
    $('#editProfile').onclick = () => openEditProfile();
    $('#openSaved').onclick = () => { state.view = 'saved'; $$('.nav-item').forEach(b => b.classList.toggle('active', false)); render(); };
  } else {
    $('#followBtn').onclick = async () => {
      const r = await api(`/follow/${u.id}`, { method: 'POST' });
      u.isFollowing = r.following; u.followers = r.followers;
      $('#followBtn').textContent = r.following ? 'Following' : 'Follow';
      $('#followBtn').className = `btn ${r.following ? 'ghost' : 'primary'} full`;
      $('.stat:nth-child(2) .n').textContent = r.followers;
    };
  }

  const cont = $('#profilePosts');
  cont.innerHTML = `<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px">Loading…</div>`;
  try {
    const r = await api(`/posts/user/${encodeURIComponent(u.username)}`);
    cont.innerHTML = r.posts.length ? r.posts.map(postHtml).join('') : `<div class="empty">No posts yet</div>`;
    attachPostHandlers(cont);
  } catch (e) { cont.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`; }
}

function openUserList(username, kind) {
  const sheet = mkSheet(kind === 'followers' ? 'Followers' : 'Following');
  const body = $('.sheet-body', sheet);
  body.innerHTML = 'Loading…';
  api(`/users/${encodeURIComponent(username)}/${kind}`).then(r => {
    body.innerHTML = r.users.length
      ? r.users.map(u => `<div class="user-row" data-u="${escapeHtml(u.username)}">${avatarHtml(u)}<div class="info"><div class="n">${escapeHtml(u.name)}</div><div class="u">@${escapeHtml(u.username)}</div></div></div>`).join('')
      : `<div class="empty">Nobody here</div>`;
    $$('.user-row', body).forEach(r2 => r2.onclick = () => { closeSheet(); openProfile(r2.dataset.u); });
  });
}

function openEditProfile() {
  const u = state.user;
  const sheet = mkSheet('Edit profile');
  const body = $('.sheet-body', sheet);
  body.innerHTML = `
    <div style="text-align:center;margin-bottom:14px">
      <div id="avatarPreview" style="display:inline-block">${avatarHtml(u, 'lg')}</div>
      <div style="margin-top:8px"><input type="file" accept="image/*" id="avatarFile" style="display:none"><button class="btn ghost sm" id="pickAvatar">Change avatar</button></div>
    </div>
    <label class="form-field"><label>Username</label><input id="eUsername" value="${escapeHtml(u.username)}"></label>
    <label class="form-field"><label>Name</label><input id="eName" value="${escapeHtml(u.name)}"></label>
    <label class="form-field"><label>Bio</label><textarea id="eBio" rows="3">${escapeHtml(u.bio || '')}</textarea></label>`;
  const fi = $('#avatarFile', sheet);
  $('#pickAvatar', sheet).onclick = () => fi.click();
  fi.onchange = () => { state.editAvatar = fi.files[0] || null; if (state.editAvatar) $('#avatarPreview', sheet).innerHTML = `<img class="avatar lg" src="${URL.createObjectURL(state.editAvatar)}">`; };

  const actions = document.createElement('div');
  actions.className = 'sheet-actions';
  actions.innerHTML = `<button class="btn ghost full" data-close>Cancel</button><button class="btn primary full" id="saveProfile">Save</button>`;
  sheet.appendChild(actions);
  $('[data-close]', actions).onclick = closeSheet;
  $('#saveProfile', actions).onclick = async () => {
    const fd = new FormData();
    fd.append('username', $('#eUsername', sheet).value.trim());
    fd.append('name', $('#eName', sheet).value.trim());
    fd.append('bio', $('#eBio', sheet).value);
    if (state.editAvatar) fd.append('avatar', state.editAvatar);
    try {
      const r = await api('/auth/me', { method: 'PATCH', body: fd });
      state.user = r.user;
      state.editAvatar = null;
      state.profileUser = { ...state.profileUser, ...r.user, isMe: true };
      closeSheet(); toast('Saved'); render();
    } catch (e) { toast(e.message); }
  };
}

// ---------- search ----------
function renderSearch(main) {
  main.innerHTML = `
    <div class="search-bar"><input id="searchQ" placeholder="Search users, posts..." value="${escapeHtml(state.searchQ)}" autocomplete="off"></div>
    <div class="search-tabs">
      <button data-st="all" class="${state.searchType === 'all' ? 'active' : ''}">All</button>
      <button data-st="users" class="${state.searchType === 'users' ? 'active' : ''}">Users</button>
      <button data-st="posts" class="${state.searchType === 'posts' ? 'active' : ''}">Posts</button>
    </div>
    <div id="searchRes"></div>`;
  const inp = $('#searchQ');
  inp.focus();
  let timer;
  inp.oninput = () => { clearTimeout(timer); state.searchQ = inp.value; timer = setTimeout(doSearch, 300); };
  $$('.search-tabs button').forEach(b => b.onclick = () => { state.searchType = b.dataset.st; render(); });
  doSearch();
}

async function doSearch() {
  const res = $('#searchRes'); if (!res) return;
  if (!state.searchQ.trim()) { res.innerHTML = `<div class="empty">Search ERASKYE</div>`; return; }
  res.innerHTML = `<div style="text-align:center;color:var(--muted);padding:20px">Searching…</div>`;
  try {
    const r = await api(`/search?q=${encodeURIComponent(state.searchQ)}&type=${state.searchType}`);
    state.searchResults = r;
    const parts = [];
    if (r.users.length) parts.push(r.users.map(u => `<div class="user-row" data-u="${escapeHtml(u.username)}">${avatarHtml(u)}<div class="info"><div class="n">${escapeHtml(u.name)}</div><div class="u">@${escapeHtml(u.username)}</div></div></div>`).join(''));
    if (r.posts.length) parts.push(r.posts.map(postHtml).join(''));
    res.innerHTML = parts.length ? parts.join('') : `<div class="empty">No results</div>`;
    $$('.user-row', res).forEach(r2 => r2.onclick = () => openProfile(r2.dataset.u));
    attachPostHandlers(res);
  } catch (e) { res.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`; }
}

// ---------- notifications ----------
async function renderNotifications(main) {
  main.innerHTML = `<div style="text-align:center;color:var(--muted);padding:30px">Loading…</div>`;
  try {
    const r = await api('/notifications');
    state.notifications = r.notifications;
    state.unread = r.unread;
    if (r.unread) { await api('/notifications/read', { method: 'POST' }); state.unread = 0; updateNotifBadge(); }
    if (!r.notifications.length) { main.innerHTML = `<div class="empty"><div class="icon">♡</div><div>No notifications</div></div>`; return; }
    main.innerHTML = r.notifications.map(n => {
      const text = {
        like: 'liked your post',
        comment: 'commented on your post',
        follow: 'started following you',
      }[n.type] || 'interacted';
      return `
        <div class="user-row" data-u="${escapeHtml(n.actor.username)}">
          ${avatarHtml(n.actor)}
          <div class="info"><div class="n">${escapeHtml(n.actor.username)} <span style="color:var(--muted);font-weight:400">${escapeHtml(text)}</span></div><div class="u">${fmtTime(n.created_at)}</div></div>
        </div>`;
    }).join('');
    $$('.user-row', main).forEach(r2 => r2.onclick = () => openProfile(r2.dataset.u));
  } catch (e) { main.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`; }
}

async function updateNotifBadge() {
  try {
    const r = await api('/notifications/unread-count');
    state.unread = r.unread;
    const b = $('#notifBadge');
    if (r.unread > 0) { b.textContent = r.unread > 99 ? '99+' : r.unread; b.hidden = false; }
    else b.hidden = true;
  } catch {}
}

// ---------- saved ----------
async function renderSaved(main) {
  main.innerHTML = `<div style="text-align:center;color:var(--muted);padding:30px">Loading…</div>`;
  try {
    const r = await api('/saved');
    if (!r.posts.length) { main.innerHTML = `<div class="empty"><div class="icon">★</div><div>No saved posts</div></div>`; return; }
    main.innerHTML = r.posts.map(postHtml).join('');
    attachPostHandlers(main);
  } catch (e) { main.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`; }
}

// ---------- bootstrap ----------
async function boot() {
  try {
    const r = await api('/auth/me');
    state.user = r.user;
  } catch {}
  if (state.user) {
    setView('feed');
    loadFeed(true);
    updateNotifBadge();
  } else {
    renderAuth();
  }
}

$$('.nav-item').forEach(b => b.onclick = () => {
  const v = b.dataset.view;
  if (v === 'create') return openCreate();
  if (v === 'profile') return openProfile(state.user?.username || '');
  setView(v);
  if (v === 'feed' && !state.feed.length) loadFeed(true);
});

$('#logoutBtn').onclick = async () => {
  await api('/auth/logout', { method: 'POST' });
  state.user = null; state.feed = [];
  renderAuth();
};

boot();
