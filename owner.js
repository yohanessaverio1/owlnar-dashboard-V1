/* OWLNAR OWNER v4.2 — Dashboard lengkap dengan Firestore listeners */
console.log('%c OWLNAR v4.2 LOADED', 'color:#8b5cf6;font-weight:bold;font-size:14px');

/* ===== FIREBASE (compat) ===== */
var db = null, auth = null, FieldValue = null, googleProvider = null;
try {
  firebase.initializeApp({
    apiKey: "AIzaSyB3Aca4aLik1-ldoAMt6i4AaJTUwjT2Lbg",
    authDomain: "owlnar1.firebaseapp.com",
    projectId: "owlnar1",
    storageBucket: "owlnar1.firebasestorage.app",
    messagingSenderId: "484692430861",
    appId: "1:484692430861:web:18f653052f3a46a6a00544"
  });
  db = firebase.firestore();
  auth = firebase.auth();
  FieldValue = firebase.firestore.FieldValue;
  googleProvider = new firebase.auth.GoogleAuthProvider();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});
} catch (e) { console.error('Firebase init error:', e); }

/* ===== STATE ===== */
var OWNER_EMAIL = 'saverioyohanes@gmail.com';
var user = null, profile = null;
var allTx = [], allUsers = [], allClaims = [], allProducts = [], allCoupons = [];
var chartPeriod = '7d', claimFilter = 'pending', currentPage = 'dashboard';
var editingProductId = null, flashMaintenance = false, unsubs = [], globalSearchQuery = '';

/* ===== HELPERS ===== */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function showToast(msg, type) {
  var box = document.getElementById('toasts'); if (!box) return;
  var d = document.createElement('div');
  d.className = 'toast ' + (type || 'info');
  var ic = type === 'ok' ? 'fa-check-circle' : type === 'err' ? 'fa-exclamation-circle' : 'fa-info-circle';
  d.innerHTML = '<i class="fas ' + ic + '"></i><span>' + esc(msg) + '</span>';
  box.appendChild(d);
  setTimeout(function () { d.remove(); }, 3200);
}
function priceToNum(p) {
  if (typeof p === 'number') return p;
  if (!p) return 0;
  var s = String(p).replace(/[^\d.K]/gi, '');
  if (s.indexOf('K') > -1) return parseFloat(s.replace('K', '')) * 1000;
  return parseInt(s) || 0;
}
function formatRp(n) { return 'Rp ' + (n || 0).toLocaleString('id-ID'); }
function formatDate(ts) {
  if (!ts) return '-';
  try { var d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return '-'; }
}
function nowStr() { return new Date().toLocaleString('id-ID'); }
function statusBadge(s) {
  var map = { pending: 'bdg-p', success: 'bdg-s', rejected: 'bdg-r', diproses: 'bdg-i' };
  var lbl = { pending: 'PENDING', success: 'SUKSES', rejected: 'DITOLAK', diproses: 'DIPROSES' };
  return '<span class="bdg ' + (map[s] || 'bdg-i') + '">' + (lbl[s] || s) + '</span>';
}
function isOwner(u) { return !!u && (u.email || '').toLowerCase() === OWNER_EMAIL.toLowerCase(); }
async function withBusy(e, label, fn) {
  var btn = e.target.closest('button') || e.target, orig = btn.innerHTML;
  btn.innerHTML = '<span class="loader"></span> ' + label; btn.disabled = true;
  try { await fn(); } catch (err) { showToast('Gagal: ' + err.message, 'err'); }
  finally { btn.innerHTML = orig; btn.disabled = false; }
}

/* ===== AUTH ===== */
function doLogin(e) {
  if (!auth) return showToast('Firebase belum siap', 'err');
  var email = document.getElementById('loginEmail').value.trim();
  var pass = document.getElementById('loginPass').value.trim();
  if (!email || !pass) return showToast('Email dan password wajib diisi!', 'err');
  return withBusy(e, 'Masuk...', async function () {
    var cred = await auth.signInWithEmailAndPassword(email, pass);
    if (!isOwner(cred.user)) { await auth.signOut(); throw new Error('Bukan akun owner!'); }
    showToast('Login berhasil', 'ok');
  });
}
function doGoogle(e) {
  if (!auth) return showToast('Firebase belum siap', 'err');
  return withBusy(e, 'Login...', async function () {
    var res = await auth.signInWithPopup(googleProvider);
    if (!isOwner(res.user)) { await auth.signOut(); throw new Error('Bukan akun owner!'); }
    showToast('Login Google berhasil', 'ok');
  });
}
async function doLogout() {
  if (!confirm('Logout dari dashboard?')) return;
  unsubs.forEach(function (u) { try { u(); } catch (e) {} });
  if (auth) await auth.signOut();
  location.reload();
}

if (auth) {
  auth.onAuthStateChanged(async function (au) {
    if (au && !isOwner(au)) { await auth.signOut(); showToast('Bukan akun owner!', 'err'); au = null; }
    if (!au) {
      document.getElementById('shell').classList.add('hide');
      document.getElementById('loginBox').classList.remove('hide');
      return;
    }
    user = au;
    try {
      var snap = await db.collection('users').doc(au.uid).get();
      if (!snap.exists) {
        await db.collection('users').doc(au.uid).set({
          name: au.displayName || 'Owner', username: au.email.split('@')[0],
          email: au.email, role: 'owner', balance: 0, isVip: true,
          createdAt: FieldValue.serverTimestamp(), lastLogin: FieldValue.serverTimestamp()
        });
        snap = await db.collection('users').doc(au.uid).get();
      } else {
        db.collection('users').doc(au.uid).update({ lastLogin: FieldValue.serverTimestamp() }).catch(function () {});
      }
      profile = snap.data();
    } catch (e) {
      console.error('Profile fetch error:', e);
      profile = { name: 'Owner', username: au.email.split('@')[0] };
    }
    document.getElementById('loginBox').classList.add('hide');
    document.getElementById('shell').classList.remove('hide');
    var dn = profile.name || profile.username || 'Owner';
    document.getElementById('userName').textContent = dn;
    document.getElementById('userAvatar').textContent = dn[0].toUpperCase();
    document.getElementById('infoEmail').textContent = au.email;
    document.getElementById('infoUid').textContent = au.uid;
    
    /* ⭐ KUNCI FIX: START LISTENERS */
    startListeners();
    
    console.log('✅ Logged in:', au.email);
  });
}

/* ===== LISTENERS (FIX UTAMA) ===== */
function startListeners() {
  if (!db) { console.error('❌ db null, cannot start listeners'); return; }
  unsubs.forEach(function (u) { try { u(); } catch (e) {} });
  unsubs = [];
  console.log('🔥 Starting Firestore listeners...');

  unsubs.push(db.collection('transactions').orderBy('createdAt', 'desc').limit(500).onSnapshot(function (snap) {
    allTx = []; snap.forEach(function (d) { allTx.push(Object.assign({ id: d.id }, d.data())); });
    console.log('📊 Transactions:', allTx.length);
    updateAllViews();
  }, function (err) { console.error('Transactions error:', err.code, err.message); }));

  unsubs.push(db.collection('users').onSnapshot(function (snap) {
    allUsers = []; snap.forEach(function (d) { allUsers.push(Object.assign({ uid: d.id }, d.data())); });
    console.log('👥 Users:', allUsers.length);
    updateAllViews();
  }, function (err) { console.error('Users error:', err.code, err.message); }));

  unsubs.push(db.collection('claims').orderBy('createdAt', 'desc').limit(300).onSnapshot(function (snap) {
    allClaims = []; snap.forEach(function (d) { allClaims.push(Object.assign({ id: d.id }, d.data())); });
    console.log('🎯 Claims:', allClaims.length);
    updateAllViews();
  }, function (err) { console.error('Claims error:', err.code, err.message); }));

  unsubs.push(db.collection('products').onSnapshot(function (snap) {
    allProducts = []; snap.forEach(function (d) { allProducts.push(Object.assign({ id: d.id }, d.data())); });
    console.log('📦 Products:', allProducts.length);
    if (!snap.size) seedDefaultProducts();
    if (currentPage === 'products') renderProductsTable();
    if (currentPage === 'flashsale') renderFlashSaleList();
  }, function (err) { console.error('Products error:', err.code, err.message); }));

  unsubs.push(db.collection('coupons').onSnapshot(function (snap) {
    allCoupons = []; snap.forEach(function (d) { allCoupons.push(Object.assign({ id: d.id }, d.data())); });
    console.log('🏷️ Coupons:', allCoupons.length);
    if (currentPage === 'coupons') renderCouponsList();
  }, function (err) { console.error('Coupons error:', err.code, err.message); }));

  unsubs.push(db.collection('auditLogs').orderBy('createdAt', 'desc').limit(100).onSnapshot(function (snap) {
    if (currentPage === 'auditlog') renderAuditLogs(snap);
  }, function (err) { console.error('AuditLogs error:', err.code, err.message); }));

  console.log('✅ Listeners started');
}

function updateAllViews() {
  try { updateDashboardStats(); } catch (e) { console.warn('stats:', e); }
  try { updateNavBadges(); } catch (e) {}
  try { if (currentPage === 'transactions') renderTransactions(); } catch (e) {}
  try { if (currentPage === 'claims') renderClaims(); } catch (e) {}
  try { if (currentPage === 'users') renderUsersTable(); } catch (e) {}
  try { if (currentPage === 'banned') renderBannedList(); } catch (e) {}
  try { if (currentPage === 'dashboard') { drawSalesChart(); drawCategoryChart(); renderActivityFeed(); } } catch (e) {}
}

function updateDashboardStats() {
  var orders = allTx.length;
  var income = allTx.filter(function (t) { return t.status === 'success'; }).reduce(function (a, t) { return a + priceToNum(t.price); }, 0);
  var pending = allTx.filter(function (t) { return t.status === 'pending'; }).length;
  var users = allUsers.length;
  var successCount = allTx.filter(function (t) { return t.status === 'success'; }).length;
  var aov = successCount > 0 ? income / successCount : 0;
  var conv = users > 0 ? ((orders / users) * 100).toFixed(1) : 0;
  var els = { statOrders: orders, statIncome: formatRp(income), statPending: pending, statUsers: users, statConv: conv + '%', statAOV: formatRp(aov) };
  Object.keys(els).forEach(function (k) { var el = document.getElementById(k); if (el) el.textContent = els[k]; });
}

function updateNavBadges() {
  var p = allTx.filter(function (t) { return t.status === 'pending'; }).length;
  var c = allClaims.filter(function (x) { return ['pending', 'link_ready', 'selected'].indexOf(x.status) > -1; }).length;
  var nbP = document.getElementById('navBadgePending'); if (nbP) { nbP.textContent = p; nbP.classList.toggle('hide', !p); }
  var nbC = document.getElementById('navBadgeClaim'); if (nbC) { nbC.textContent = c; nbC.classList.toggle('hide', !c); }
  var dot = document.getElementById('notifDot'); if (dot) dot.classList.toggle('hide', !(p + c));
}

/* ===== CHARTS ===== */
function drawSalesChart() {
  var days = chartPeriod === '7d' ? 7 : chartPeriod === '30d' ? 30 : 90;
  var now = Date.now(), daily = {};
  for (var i = days - 1; i >= 0; i--) { var d = new Date(now - i * 86400000); daily[d.toDateString()] = { revenue: 0, orders: 0 }; }
  allTx.forEach(function (t) {
    if (t.status !== 'success' || !t.createdAt) return;
    var d = new Date((t.createdAt.seconds || 0) * 1000);
    var key = d.toDateString();
    if (daily[key]) { daily[key].revenue += priceToNum(t.price); daily[key].orders++; }
  });
  var entries = Object.entries(daily);
  var revenues = entries.map(function (e) { return e[1].revenue; });
  var maxRev = Math.max.apply(null, revenues.concat([1]));
  var W = 600, H = 280, PAD = 32;
  var stepX = (W - PAD * 2) / Math.max(entries.length - 1, 1);
  var revPts = [];
  entries.forEach(function (e, idx) {
    var x = PAD + idx * stepX;
    var y = H - PAD - (e[1].revenue / maxRev) * (H - PAD * 2);
    revPts.push([x, y]);
  });
  var pathRev = revPts.map(function (p, i) { return (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]; }).join(' ');
  var areaRev = pathRev + ' L' + revPts[revPts.length - 1][0] + ',' + (H - PAD) + ' L' + revPts[0][0] + ',' + (H - PAD) + ' Z';
  var svg = '<defs><linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.4"/><stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/></linearGradient></defs>';
  svg += '<path d="' + areaRev + '" fill="url(#gradRev)"/>';
  svg += '<path d="' + pathRev + '" stroke="#8b5cf6" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
  var el = document.getElementById('salesChart'); if (el) el.innerHTML = svg;
}

function drawCategoryChart() {
  var cats = {};
  allTx.filter(function (t) { return t.status === 'success'; }).forEach(function (t) {
    var key = (t.productName || 'Lain').split(' ')[0];
    cats[key] = (cats[key] || 0) + priceToNum(t.price);
  });
  var entries = Object.entries(cats).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
  var total = entries.reduce(function (s, e) { return s + e[1]; }, 0) || 1;
  var colors = ['#8b5cf6', '#3b82f6', '#10d981', '#f59e0b', '#ec4899', '#06b6d4'];
  var html = '';
  entries.forEach(function (e, i) {
    var pct = (e[1] / total * 100).toFixed(1);
    html += '<div style="margin-bottom:.8rem"><div style="display:flex;justify-content:space-between;font-size:.72rem;margin-bottom:.3rem"><span>' + esc(e[0]) + '</span><span style="color:var(--dim)">' + formatRp(e[1]) + ' (' + pct + '%)</span></div><div style="height:6px;background:var(--inp);border-radius:3px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + colors[i % colors.length] + ';border-radius:3px"></div></div></div>';
  });
  if (!html) html = '<div class="empty"><i class="fas fa-chart-pie"></i>Belum ada data</div>';
  var el = document.getElementById('categoryChart'); if (el) el.innerHTML = html;
}

function renderActivityFeed() {
  var recent = allTx.slice(0, 20);
  var feed = document.getElementById('activityFeed'); if (!feed) return;
  if (!recent.length) { feed.innerHTML = '<div class="empty">Belum ada aktivitas</div>'; return; }
  feed.innerHTML = recent.map(function (t) {
    var cls = t.status === 'success' ? 's' : t.status === 'rejected' ? 'r' : '';
    return '<div class="feed-item ' + cls + '"><b>' + esc(t.username || 'User') + '</b> order <b>' + esc(t.productName || '-') + '</b><div class="t">' + formatDate(t.createdAt) + ' • ' + formatRp(priceToNum(t.price)) + '</div></div>';
  }).join('');
}

/* ===== NAVIGATION ===== */
function goPage(page, btn) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  else { var t = document.querySelector('.nav-item[data-page="' + page + '"]'); if (t) t.classList.add('on'); }
  document.querySelectorAll('[id^="page-"]').forEach(function (p) { p.classList.add('hide'); });
  var target = document.getElementById('page-' + page); if (target) target.classList.remove('hide');
  if (window.innerWidth < 900) document.getElementById('sidebar').classList.remove('open');
  try {
    if (page === 'transactions') renderTransactions();
    if (page === 'claims') renderClaims();
    if (page === 'products') { populateCategoryFilter(); renderProductsTable(); }
    if (page === 'users') renderUsersTable();
    if (page === 'banned') renderBannedList();
    if (page === 'flashsale') renderFlashSaleList();
    if (page === 'coupons') renderCouponsList();
    if (page === 'banner') loadBanner();
    if (page === 'broadcast') loadBcHistory();
    if (page === 'settings') loadConfig();
    if (page === 'auditlog') renderAuditLogs();
  } catch (e) { console.error('goPage error:', e); }
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarBackdrop').classList.toggle('on');
}
function toggleTheme() {
  document.body.classList.toggle('light');
  document.getElementById('themeIcon').className = document.body.classList.contains('light') ? 'fas fa-sun' : 'fas fa-moon';
}
function openModal(id) { var m = document.getElementById(id); if (m) m.classList.add('on'); }
function closeModal(id) { var m = document.getElementById(id); if (m) m.classList.remove('on'); }
function handleGlobalSearch(q) { globalSearchQuery = (q || '').toLowerCase().trim(); }
function setChartPeriod(p, btn) {
  chartPeriod = p;
  document.querySelectorAll('.period-tabs button').forEach(function (b) { b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  drawSalesChart();
}

/* ===== RENDER ===== */
function renderTransactions() {
  var filter = (document.getElementById('txFilter') || {}).value || 'all';
  var q = ((document.getElementById('txSearch') || {}).value || '').toLowerCase() || globalSearchQuery;
  var list = allTx.filter(function (t) {
    if (filter !== 'all' && t.status !== filter) return false;
    if (q) {
      var txt = ((t.orderId || '') + (t.username || '') + (t.productName || '')).toLowerCase();
      if (txt.indexOf(q) === -1) return false;
    }
    return true;
  });
  var tbody = document.getElementById('txTable'); if (!tbody) return;
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--dim)">Tidak ada data</td></tr>'; return; }
  tbody.innerHTML = list.slice(0, 200).map(function (t) {
    return '<tr><td><b style="font-family:monospace;font-size:.68rem;color:var(--accent)">' + esc((t.orderId || t.id).slice(0, 12)) + '</b></td><td><b>' + esc(t.username || '-') + '</b></td><td>' + esc(t.productName || '-') + '</td><td style="font-weight:700">' + formatRp(priceToNum(t.price)) + '</td><td>' + statusBadge(t.status) + '</td><td style="color:var(--dim);font-size:.68rem">' + formatDate(t.createdAt) + '</td><td><div style="display:flex;gap:.25rem;justify-content:flex-end">' + (t.status === 'pending' ? '<button class="btn btn-success btn-sm" onclick="approveTx(\'' + t.id + '\')"><i class="fas fa-check"></i></button><button class="btn btn-danger btn-sm" onclick="rejectTx(\'' + t.id + '\')"><i class="fas fa-times"></i></button>' : '') + '<button class="btn btn-ghost btn-sm" onclick="viewTx(\'' + t.id + '\')"><i class="fas fa-eye"></i></button><button class="btn btn-danger btn-sm" onclick="deleteTx(\'' + t.id + '\')"><i class="fas fa-trash"></i></button></div></td></tr>';
  }).join('');
}

function renderClaims() {
  var list = claimFilter === 'all' ? allClaims : allClaims.filter(function (c) { return c.status === claimFilter; });
  var box = document.getElementById('claimsList'); if (!box) return;
  if (!list.length) { box.innerHTML = '<div class="empty"><i class="fas fa-hand-holding-usd"></i>Tidak ada klaim</div>'; return; }
  box.innerHTML = list.map(function (c) {
    var u = allUsers.find(function (x) { return x.username === c.username; });
    var bad = u && (u.isPermanentBan || u.banned);
    var action = '';
    if (c.status === 'pending' || c.status === 'link_ready') action = '<button class="btn btn-success btn-sm" onclick="openClaimLink(\'' + c.id + '\')"><i class="fas fa-link"></i> Submit Link</button>';
    else if (c.status === 'selected') action = '<button class="btn btn-info btn-sm" onclick="accClaim(\'' + c.id + '\')"><i class="fas fa-check"></i> ACC</button>';
    else if (c.status === 'success') action = '<span class="bdg bdg-s">SUDAH ACC</span>';
    return '<div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:.8rem"><div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;margin-bottom:.6rem"><div><b style="color:var(--accent)">' + esc(c.claimName || '-') + '</b> ' + (bad ? '<span class="bdg bdg-r">BANNED</span>' : '') + '<br><small style="color:var(--dim)">@' + esc(c.username) + ' • ' + formatDate(c.createdAt) + '</small></div>' + statusBadge(c.status === 'link_ready' ? 'diproses' : c.status) + '</div>' + (c.photo ? '<img src="' + c.photo + '" style="max-width:100%;max-height:200px;border-radius:8px;margin-bottom:.6rem">' : '') + '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' + action + '<button class="btn btn-danger btn-sm" onclick="promptBan(\'' + esc(c.username) + '\')"><i class="fas fa-ban"></i> Ban</button></div></div>';
  }).join('');
}

function renderProductsTable() {
  var q = ((document.getElementById('prodSearch') || {}).value || '').toLowerCase() || globalSearchQuery;
  var catF = (document.getElementById('prodCatFilter') || {}).value || 'all';
  var list = allProducts.filter(function (p) {
    if (catF !== 'all' && p.category !== catF) return false;
    if (q && p.name.toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
  var tbody = document.getElementById('productsTable'); if (!tbody) return;
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--dim)">Belum ada produk. Klik "Tambah Produk"</td></tr>'; return; }
  tbody.innerHTML = list.map(function (p) {
    return '<tr><td><b>' + esc(p.name) + '</b><br><small style="color:var(--dim)">' + esc((p.downloadLink || '—').slice(0, 40)) + '</small></td><td><span class="bdg bdg-a">' + esc(p.category) + '</span></td><td><b style="color:var(--success)">' + formatRp(priceToNum(p.price)) + '</b></td><td><div class="switch ' + (p.flashSale ? 'on' : '') + '" onclick="toggleProductSwitch(\'' + p.id + '\', \'flashSale\')"></div></td><td><div class="switch ' + (p.featured ? 'on' : '') + '" onclick="toggleProductSwitch(\'' + p.id + '\', \'featured\')"></div></td><td>' + (p.sold || 0) + 'x</td><td><div style="display:flex;gap:.25rem;justify-content:flex-end"><button class="btn btn-info btn-sm" onclick="editProduct(\'' + p.id + '\')"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm" onclick="deleteProduct(\'' + p.id + '\')"><i class="fas fa-trash"></i></button></div></td></tr>';
  }).join('');
}

function renderUsersTable() {
  var q = ((document.getElementById('userSearch') || {}).value || '').toLowerCase() || globalSearchQuery;
  var list = allUsers.filter(function (u) {
    if (q && (u.username || '').toLowerCase().indexOf(q) === -1 && (u.email || '').toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
  var tbody = document.getElementById('usersTable'); if (!tbody) return;
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--dim)">Tidak ada user</td></tr>'; return; }
  tbody.innerHTML = list.slice(0, 200).map(function (u) {
    var orderCount = allTx.filter(function (t) { return t.usernameReal === u.username && t.status === 'success'; }).length;
    var st = '<span class="bdg bdg-s">AKTIF</span>';
    if (u.isPermanentBan) st = '<span class="bdg bdg-r">BLACKLIST</span>';
    else if (u.banned) st = '<span class="bdg bdg-p">SUSPEND</span>';
    return '<tr><td><b>' + esc(u.name || u.username || '-') + '</b> ' + (u.isVip ? '<span class="bdg bdg-vip">VIP</span>' : '') + '<br><small style="color:var(--dim)">@' + esc(u.username || '-') + '</small></td><td style="font-size:.7rem">' + esc(u.email || '-') + '</td><td style="color:var(--success);font-weight:700">' + formatRp(u.balance || 0) + '</td><td>' + st + '</td><td>' + orderCount + '</td><td><div style="display:flex;gap:.25rem;justify-content:flex-end"><button class="btn btn-ghost btn-sm" onclick="viewUser(\'' + u.uid + '\')"><i class="fas fa-eye"></i></button><button class="btn btn-warn btn-sm" onclick="promptBan(\'' + esc(u.username) + '\')"><i class="fas fa-ban"></i></button>' + (u.banned ? '<button class="btn btn-success btn-sm" onclick="unbanUser(\'' + u.uid + '\')"><i class="fas fa-unlock"></i></button>' : '') + '</div></td></tr>';
  }).join('');
}

function renderBannedList() {
  var list = allUsers.filter(function (u) { return u.banned || u.isPermanentBan; });
  var c = document.getElementById('bannedCount'); if (c) c.textContent = list.length;
  var box = document.getElementById('bannedList'); if (!box) return;
  if (!list.length) { box.innerHTML = '<div class="empty"><i class="fas fa-shield-alt"></i>Tidak ada user banned</div>'; return; }
  box.innerHTML = list.map(function (u) {
    return '<div style="background:rgba(239,68,68,.05);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:.8rem;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:flex-start;gap:.6rem;flex-wrap:wrap"><div><b>@' + esc(u.username || '-') + '</b> ' + (u.isPermanentBan ? '<span class="bdg bdg-r">PERMANENT</span>' : '<span class="bdg bdg-p">SUSPEND</span>') + '<br><small style="color:var(--dim)">' + esc(u.banReason || 'Tidak ada alasan') + '</small></div><button class="btn btn-success btn-sm" onclick="unbanUser(\'' + u.uid + '\')"><i class="fas fa-unlock"></i> Unban</button></div>';
  }).join('');
}

function renderFlashSaleList() {
  var active = allProducts.filter(function (p) { return p.flashSale; });
  var box = document.getElementById('flashSaleList'); if (!box) return;
  if (!active.length) { box.innerHTML = '<div class="empty"><i class="fas fa-bolt"></i>Belum ada flash sale aktif</div>'; return; }
  box.innerHTML = active.map(function (p) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;background:var(--inp);border-radius:10px;padding:.75rem;margin-bottom:.5rem"><div><b>' + esc(p.name) + '</b><br><small style="color:var(--dim)">' + formatRp(priceToNum(p.price)) + ' • ' + (p.sold || 0) + 'x</small></div><button class="btn btn-danger btn-sm" onclick="toggleProductSwitch(\'' + p.id + '\', \'flashSale\')"><i class="fas fa-times"></i> Hentikan</button></div>';
  }).join('');
}

function renderCouponsList() {
  var box = document.getElementById('couponsList'); if (!box) return;
  if (!allCoupons.length) { box.innerHTML = '<div class="empty"><i class="fas fa-tag"></i>Belum ada kupon</div>'; return; }
  box.innerHTML = allCoupons.map(function (c) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;background:var(--inp);border-radius:10px;padding:.7rem;margin-bottom:.5rem"><div><b style="color:var(--accent);font-family:monospace">' + esc(c.id) + '</b> <span class="bdg bdg-s">' + c.discount + '%</span></div><button class="btn btn-danger btn-sm" onclick="deleteCoupon(\'' + c.id + '\')"><i class="fas fa-trash"></i></button></div>';
  }).join('');
}

async function renderAuditLogs(snap) {
  var tbody = document.getElementById('auditLogTable'); if (!tbody) return;
  if (!snap) { try { snap = await db.collection('auditLogs').orderBy('createdAt', 'desc').limit(100).get(); } catch (e) { return; } }
  if (snap.empty) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--dim)">Belum ada log</td></tr>'; return; }
  var arr = []; snap.forEach(function (d) { arr.push(d.data()); });
  tbody.innerHTML = arr.map(function (l) {
    return '<tr><td style="color:var(--dim);font-size:.7rem">' + formatDate(l.createdAt) + '</td><td><span class="bdg bdg-i">' + esc(l.action) + '</span></td><td><b>' + esc(l.by) + '</b></td><td>' + esc(l.detail) + '</td></tr>';
  }).join('');
}

/* ===== PRODUCTS ===== */
function seedDefaultProducts() {
  if (!db || !user) return;
  var defaults = [
    { name: 'Aimbot V1', category: 'AIMBOT', price: '5K', downloadLink: 'https://example.com', desc: 'Aimbot V1' },
    { name: 'EasyDrag V1', category: 'EASYDRAG', price: '5K', downloadLink: 'https://example.com', desc: 'EasyDrag V1' },
    { name: 'Aimlock Lite 60%', category: 'LITE', price: '1K', downloadLink: 'https://example.com', desc: 'Lite 60%' }
  ];
  var batch = db.batch();
  defaults.forEach(function (p) { var ref = db.collection('products').doc(); batch.set(ref, Object.assign({ sold: 0, createdAt: FieldValue.serverTimestamp() }, p)); });
  batch.commit().then(function () { showToast('Default products seeded', 'ok'); }).catch(function (e) { showToast('Seed error: ' + e.message, 'err'); });
}
function populateCategoryFilter() {
  var cats = []; allProducts.forEach(function (p) { if (cats.indexOf(p.category) === -1) cats.push(p.category); });
  cats.sort();
  var sel = document.getElementById('prodCatFilter');
  if (sel) sel.innerHTML = '<option value="all">Semua Kategori</option>' + cats.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
  var dl = document.getElementById('catList'); if (dl) dl.innerHTML = cats.map(function (c) { return '<option value="' + c + '">'; }).join('');
}
function openProductForm(id) {
  editingProductId = id || null;
  document.getElementById('prodFormTitle').innerHTML = id ? '<i class="fas fa-edit"></i> Edit Produk' : '<i class="fas fa-plus"></i> Tambah Produk';
  if (id) {
    var p = allProducts.find(function (x) { return x.id === id; }); if (!p) return;
    document.getElementById('prodName').value = p.name || '';
    document.getElementById('prodCat').value = p.category || '';
    document.getElementById('prodPrice').value = p.price || '';
    document.getElementById('prodOldPrice').value = p.oldPrice || '';
    document.getElementById('prodLink').value = p.downloadLink || '';
    document.getElementById('prodDesc').value = p.desc || '';
    document.getElementById('swFlash').classList.toggle('on', !!p.flashSale);
    document.getElementById('swFeatured').classList.toggle('on', !!p.featured);
  } else {
    ['prodName', 'prodCat', 'prodPrice', 'prodOldPrice', 'prodLink', 'prodDesc'].forEach(function (f) { var el = document.getElementById(f); if (el) el.value = ''; });
    document.getElementById('swFlash').classList.remove('on');
    document.getElementById('swFeatured').classList.remove('on');
  }
  populateCategoryFilter();
  openModal('modalProduct');
}
function editProduct(id) { openProductForm(id); }
async function saveProduct(e) {
  if (!db) { showToast('Firebase belum siap', 'err'); return; }
  var name = document.getElementById('prodName').value.trim();
  var cat = document.getElementById('prodCat').value.trim().toUpperCase();
  var price = document.getElementById('prodPrice').value.trim();
  var oldPrice = document.getElementById('prodOldPrice').value.trim();
  var link = document.getElementById('prodLink').value.trim();
  var desc = document.getElementById('prodDesc').value.trim();
  var flashSale = document.getElementById('swFlash').classList.contains('on');
  var featured = document.getElementById('swFeatured').classList.contains('on');
  if (!name || !cat || !price) { showToast('Nama, kategori, harga wajib!', 'err'); return; }
  var btn = e.target, orig = btn.innerHTML; btn.innerHTML = '<span class="loader"></span> Menyimpan...'; btn.disabled = true;
  try {
    var data = { name: name, category: cat, price: price, oldPrice: oldPrice || null, downloadLink: link || '', desc: desc || '', flashSale: flashSale, featured: featured, updatedAt: FieldValue.serverTimestamp() };
    if (editingProductId) {
      await db.collection('products').doc(editingProductId).update(data);
      showToast('✅ Produk diupdate', 'ok');
    } else {
      data.createdAt = FieldValue.serverTimestamp();
      data.sold = 0;
      await db.collection('products').add(data);
      showToast('✅ Produk ditambah', 'ok');
    }
    closeModal('modalProduct');
  } catch (err) {
    var msg = err.message;
    if (err.code === 'permission-denied') msg = 'Firestore Rules blokir! Cek Console → Rules.';
    showToast('Gagal: ' + msg, 'err');
  } finally { btn.innerHTML = orig; btn.disabled = false; }
}
async function deleteProduct(id) {
  if (!confirm('Hapus produk?')) return;
  try { await db.collection('products').doc(id).delete(); showToast('Dihapus', 'ok'); } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}
async function toggleProductSwitch(id, field) {
  var p = allProducts.find(function (x) { return x.id === id; }); if (!p) return;
  try { await db.collection('products').doc(id).update({ [field]: !p[field] }); showToast(field + ' toggled', 'ok'); } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}

/* ===== BAN ===== */
function promptBan(username) {
  var u = allUsers.find(function (x) { return x.username === username; });
  if (!u) { showToast('User tidak ditemukan', 'err'); return; }
  document.getElementById('banUid').value = u.uid;
  document.getElementById('banUsername').value = username;
  document.getElementById('banReason').value = 'Bukti palsu';
  var off = u.banOffenses || 0;
  document.getElementById('banWarning').style.display = off >= 1 ? 'block' : 'none';
  document.getElementById('banMethod').value = off >= 1 ? 'permanent' : 'suspend1';
  openModal('modalBan');
}
async function confirmBan() {
  if (!db) { showToast('Firebase belum siap', 'err'); return; }
  var uid = document.getElementById('banUid').value;
  var username = document.getElementById('banUsername').value;
  var reason = document.getElementById('banReason').value.trim() || 'Bukti palsu';
  var method = document.getElementById('banMethod').value;
  var target = allUsers.find(function (u) { return u.uid === uid; });
  if (!target) { showToast('User tidak ditemukan', 'err'); return; }
  var offenses = (target.banOffenses || 0) + 1;
  var data = { banned: true, banReason: reason, banOffenses: offenses, bannedAt: FieldValue.serverTimestamp(), bannedBy: profile ? profile.username : 'owner' };
  if (method === 'permanent' || offenses > 1) { data.isPermanentBan = true; data.blacklisted = true; data.suspendedUntil = null; }
  else { var hours = method === 'suspend24' ? 24 : 1; data.suspendedUntil = Date.now() + hours * 3600 * 1000; data.isPermanentBan = false; }
  try { await db.collection('users').doc(uid).update(data); showToast('🚫 ' + username + ' di-ban', 'ok'); closeModal('modalBan'); }
  catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}
async function unbanUser(uid) {
  try { await db.collection('users').doc(uid).update({ banned: false, suspendedUntil: null, isPermanentBan: false, blacklisted: false }); showToast('User di-unban', 'ok'); } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}

/* ===== BROADCAST ===== */
async function sendBroadcast(e) {
  if (!db) { showToast('Firebase belum siap', 'err'); return; }
  var title = document.getElementById('bcTitle').value.trim();
  var message = document.getElementById('bcMessage').value.trim();
  var target = document.getElementById('bcTarget').value;
  if (!title || !message) { showToast('Isi judul & pesan!', 'err'); return; }
  var users = allUsers;
  if (target === 'buyers') {
    var buyers = {}; allTx.filter(function (t) { return t.status === 'success'; }).forEach(function (t) { buyers[t.usernameReal] = 1; });
    users = allUsers.filter(function (u) { return buyers[u.username]; });
  } else if (target === 'nonbuyers') {
    var buyers2 = {}; allTx.filter(function (t) { return t.status === 'success'; }).forEach(function (t) { buyers2[t.usernameReal] = 1; });
    users = allUsers.filter(function (u) { return !buyers2[u.username]; });
  }
  if (!users.length) { showToast('Tidak ada user target', 'err'); return; }
  if (!confirm('Kirim broadcast ke ' + users.length + ' user?')) return;
  var btn = e.target, orig = btn.innerHTML; btn.innerHTML = '<span class="loader"></span> Mengirim...'; btn.disabled = true;
  try {
    var batch = db.batch();
    var bcRef = db.collection('broadcasts').doc();
    batch.set(bcRef, { title: title, message: message, target: target, count: users.length, sentAt: FieldValue.serverTimestamp(), sentBy: profile ? profile.username : 'owner' });
    users.forEach(function (u) {
      var nRef = db.collection('users').doc(u.uid).collection('notifications').doc();
      batch.set(nRef, { title: title, message: message, read: false, createdAt: FieldValue.serverTimestamp() });
    });
    await batch.commit();
    showToast('✅ Broadcast ke ' + users.length + ' user', 'ok');
    document.getElementById('bcTitle').value = '';
    document.getElementById('bcMessage').value = '';
    loadBcHistory();
  } catch (err) { showToast('Gagal: ' + err.message, 'err'); }
  finally { btn.innerHTML = orig; btn.disabled = false; }
}
async function loadBcHistory() {
  try {
    var snap = await db.collection('broadcasts').orderBy('sentAt', 'desc').limit(10).get();
    var box = document.getElementById('bcHistory'); if (!box) return;
    if (snap.empty) { box.innerHTML = ''; return; }
    var html = '<h4 style="font-size:.75rem;margin-bottom:.5rem;color:var(--dim)">Riwayat:</h4>';
    snap.forEach(function (d) { var b = d.data(); html += '<div style="background:var(--inp);border-radius:8px;padding:.6rem;margin-bottom:.4rem;font-size:.72rem"><b>' + esc(b.title) + '</b> <span class="bdg bdg-s">' + b.count + ' user</span><br><small style="color:var(--dim)">' + formatDate(b.sentAt) + '</small></div>'; });
    box.innerHTML = html;
  } catch (e) { console.error(e); }
}

/* ===== COUPONS ===== */
async function saveCoupon() {
  var code = document.getElementById('cpCode').value.trim().toUpperCase();
  var disc = parseInt(document.getElementById('cpDisc').value);
  var exp = document.getElementById('cpExp').value;
  if (!code || !disc) { showToast('Isi kode & diskon!', 'err'); return; }
  try {
    await db.collection('coupons').doc(code).set({ discount: disc, active: true, expiresAt: exp || null, createdAt: FieldValue.serverTimestamp() });
    document.getElementById('cpCode').value = ''; document.getElementById('cpDisc').value = '';
    showToast('✅ Kupon dibuat', 'ok');
  } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}
async function deleteCoupon(id) {
  if (!confirm('Hapus kupon?')) return;
  try { await db.collection('coupons').doc(id).delete(); showToast('Dihapus', 'ok'); } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}

/* ===== BANNER ===== */
async function loadBanner() {
  try {
    var snap = await db.collection('announcements').doc('active').get();
    var txt = snap.exists ? (snap.data().text || '') : '';
    document.getElementById('bannerText').value = txt;
    document.getElementById('bannerPreview').innerHTML = txt ? esc(txt) : 'Ketik sesuatu...';
  } catch (e) { console.error(e); }
}
async function saveBanner() {
  var text = document.getElementById('bannerText').value.trim();
  if (!text) { showToast('Isi banner!', 'err'); return; }
  try { await db.collection('announcements').doc('active').set({ text: text, updatedAt: FieldValue.serverTimestamp() }); showToast('✅ Banner published', 'ok'); } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}
async function deleteBanner() {
  if (!confirm('Hapus banner?')) return;
  try { await db.collection('announcements').doc('active').delete(); document.getElementById('bannerText').value = ''; showToast('Dihapus', 'ok'); } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}

/* ===== SETTINGS ===== */
async function loadConfig() {
  try {
    var snap = await db.collection('config').doc('main').get();
    if (snap.exists) {
      var c = snap.data();
      document.getElementById('cfgWA').value = c.wa || '';
      document.getElementById('cfgRefBonus').value = c.refBonus || '';
      document.getElementById('cfgStoreName').value = c.storeName || 'Owlnar';
      flashMaintenance = c.maintenance || false;
      document.getElementById('swMaintenance').classList.toggle('on', flashMaintenance);
      document.getElementById('swDana').classList.toggle('on', c.payDana !== false);
      document.getElementById('swQris').classList.toggle('on', c.payQris !== false);
    }
  } catch (e) { console.error(e); }
}
async function saveConfig() {
  var wa = document.getElementById('cfgWA').value.trim();
  var refBonus = parseInt(document.getElementById('cfgRefBonus').value) || 0;
  var storeName = document.getElementById('cfgStoreName').value.trim();
  var dana = document.getElementById('swDana').classList.contains('on');
  var qris = document.getElementById('swQris').classList.contains('on');
  try { await db.collection('config').doc('main').set({ wa: wa, refBonus: refBonus, storeName: storeName, maintenance: flashMaintenance, payDana: dana, payQris: qris, updatedAt: FieldValue.serverTimestamp() }, { merge: true }); showToast('✅ Konfigurasi tersimpan', 'ok'); }
  catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}
function toggleMaintenance() {
  flashMaintenance = !flashMaintenance;
  document.getElementById('swMaintenance').classList.toggle('on', flashMaintenance);
  showToast('Maintenance: ' + (flashMaintenance ? 'ON' : 'OFF'), 'info');
}

/* ===== TRANSACTIONS ===== */
async function approveTx(id) {
  try {
    var tx = allTx.find(function (t) { return t.id === id; }); if (!tx) return;
    var tl = tx.timeline || []; tl.push({ step: 'Sukses', at: nowStr() });
    var prod = allProducts.find(function (p) { return p.name === tx.productName; });
    await db.collection('transactions').doc(id).update({ status: 'success', timeline: tl, downloadLink: prod ? (prod.downloadLink || '#') : '#', downloadTool: prod ? prod.name : tx.productName, deliveredAt: FieldValue.serverTimestamp() });
    showToast('✅ Transaksi di-ACC', 'ok');
  } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}
async function rejectTx(id) {
  if (!confirm('Tolak transaksi?')) return;
  try { await db.collection('transactions').doc(id).update({ status: 'rejected' }); showToast('Ditolak', 'ok'); } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}
async function deleteTx(id) {
  if (!confirm('Hapus transaksi?')) return;
  try { await db.collection('transactions').doc(id).delete(); showToast('Dihapus', 'ok'); } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}
function viewTx(id) {
  var t = allTx.find(function (x) { return x.id === id; }); if (!t) return;
  document.getElementById('txDetailBody').innerHTML = '<div style="background:var(--inp);border-radius:12px;padding:1rem;font-size:.78rem;line-height:1.9"><div><b>ID:</b> ' + esc(t.id) + '</div><div><b>User:</b> ' + esc(t.username || '-') + '</div><div><b>Produk:</b> ' + esc(t.productName || '-') + '</div><div><b>Harga:</b> ' + formatRp(priceToNum(t.price)) + '</div><div><b>Status:</b> ' + statusBadge(t.status) + '</div><div><b>Waktu:</b> ' + formatDate(t.createdAt) + '</div></div>';
  openModal('modalTx');
}
async function approveAllPending() {
  var pending = allTx.filter(function (t) { return t.status === 'pending'; });
  if (!pending.length) { showToast('Tidak ada pending', 'info'); return; }
  if (!confirm('ACC ' + pending.length + ' transaksi?')) return;
  var batch = db.batch();
  pending.forEach(function (tx) { batch.update(db.collection('transactions').doc(tx.id), { status: 'success', deliveredAt: FieldValue.serverTimestamp() }); });
  try { await batch.commit(); showToast('✅ ' + pending.length + ' di-ACC', 'ok'); } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}

/* ===== CLAIMS ===== */
function setClaimFilter(f, btn) {
  claimFilter = f;
  document.querySelectorAll('#page-claims .tab').forEach(function (t) { t.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  renderClaims();
}
function openClaimLink(id) {
  var c = allClaims.find(function (x) { return x.id === id; }); if (!c) return;
  document.getElementById('claimLinkId').value = id;
  var html = '';
  for (var i = 1; i <= 3; i++) {
    html += '<label>Link #' + i + '</label><input type="text" id="cln' + i + '" placeholder="Nama tools" style="margin-bottom:.3rem"><input type="text" id="clu' + i + '" placeholder="https://..." style="margin-bottom:.6rem">';
  }
  html += '<button class="btn btn-success btn-block" onclick="saveClaimLinks()"><i class="fas fa-paper-plane"></i> Submit</button>';
  document.getElementById('claimLinkBody').innerHTML = html;
  openModal('modalClaimLink');
}
async function saveClaimLinks() {
  var id = document.getElementById('claimLinkId').value;
  var links = [];
  for (var i = 1; i <= 3; i++) {
    var n = document.getElementById('cln' + i).value.trim();
    var u = document.getElementById('clu' + i).value.trim();
    if (u) links.push({ name: n || ('Link ' + i), url: u });
  }
  if (!links.length) { showToast('Isi minimal 1 link!', 'err'); return; }
  try {
    await db.collection('claims').doc(id).update({ links: links, status: 'link_ready', linkSubmittedAt: FieldValue.serverTimestamp() });
    showToast('✅ Link disubmit', 'ok');
    closeModal('modalClaimLink');
  } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}
async function accClaim(id) {
  var c = allClaims.find(function (x) { return x.id === id; });
  if (!c || !c.selectedLink) { showToast('User belum pilih', 'err'); return; }
  try { await db.collection('claims').doc(id).update({ status: 'success', accAt: FieldValue.serverTimestamp() }); showToast('✅ Claim ACC', 'ok'); } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}
async function deleteClaim(id) {
  if (!confirm('Hapus klaim?')) return;
  try { await db.collection('claims').doc(id).delete(); showToast('Dihapus', 'ok'); } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}

/* ===== USERS ===== */
function viewUser(uid) {
  var u = allUsers.find(function (x) { return x.uid === uid; }); if (!u) return;
  var myTx = allTx.filter(function (t) { return t.usernameReal === u.username; });
  var spent = myTx.filter(function (t) { return t.status === 'success'; }).reduce(function (a, t) { return a + priceToNum(t.price); }, 0);
  document.getElementById('userDetailBody').innerHTML = '<div style="background:var(--inp);border-radius:12px;padding:1rem;font-size:.78rem;line-height:1.9;margin-bottom:1rem"><div><b>Nama:</b> ' + esc(u.name || '-') + '</div><div><b>Username:</b> @' + esc(u.username || '-') + '</div><div><b>Email:</b> ' + esc(u.email || '-') + '</div><div><b>Saldo:</b> ' + formatRp(u.balance || 0) + '</div><div><b>Total Order:</b> ' + myTx.length + '</div><div><b>Total Belanja:</b> ' + formatRp(spent) + '</div><div><b>Status:</b> ' + (u.isPermanentBan ? 'BLACKLIST' : u.banned ? 'SUSPEND' : 'AKTIF') + '</div></div><div style="display:flex;gap:.4rem;flex-wrap:wrap"><button class="btn btn-warn btn-sm" onclick="addBalance(\'' + u.uid + '\')"><i class="fas fa-plus"></i> Saldo</button><button class="btn btn-info btn-sm" onclick="toggleVip(\'' + u.uid + '\', ' + !!u.isVip + ')"><i class="fas fa-crown"></i> VIP</button><button class="btn btn-ghost btn-sm" onclick="sendPM(\'' + u.uid + '\', \'' + esc(u.username) + '\')"><i class="fas fa-envelope"></i> Pesan</button></div>';
  openModal('modalUser');
}
async function addBalance(uid) {
  var amt = prompt('Tambah saldo berapa? (Rupiah)'); if (!amt) return;
  var n = parseInt(amt); if (isNaN(n) || n <= 0) { showToast('Nominal tidak valid', 'err'); return; }
  try { await db.collection('users').doc(uid).update({ balance: FieldValue.increment(n) }); showToast('+' + formatRp(n) + ' ditambahkan', 'ok'); } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}
async function toggleVip(uid, cur) {
  try { await db.collection('users').doc(uid).update({ isVip: !cur }); showToast('VIP ' + (!cur ? 'ON' : 'OFF'), 'ok'); closeModal('modalUser'); } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}
async function sendPM(uid, username) {
  var msg = prompt('Kirim pesan ke @' + username + ':'); if (!msg) return;
  try { await db.collection('users').doc(uid).collection('notifications').add({ title: 'Pesan Admin', message: msg, read: false, createdAt: FieldValue.serverTimestamp() }); showToast('Pesan terkirim', 'ok'); } catch (e) { showToast('Gagal: ' + e.message, 'err'); }
}

/* ===== MASS BALANCE ===== */
async function massAddBalance(e) {
  var amount = parseInt(document.getElementById('mbAmount').value);
  var note = document.getElementById('mbNote').value.trim();
  var target = document.getElementById('mbTarget').value;
  if (!amount || amount <= 0) { showToast('Nominal tidak valid', 'err'); return; }
  var users = allUsers;
  if (target === 'banned') users = allUsers.filter(function (u) { return u.banned || u.isPermanentBan; });
  else if (target === 'buyers') {
    var buyers = {}; allTx.filter(function (t) { return t.status === 'success'; }).forEach(function (t) { buyers[t.usernameReal] = 1; });
    users = allUsers.filter(function (u) { return buyers[u.username]; });
  }
  if (!users.length) { showToast('Tidak ada user', 'err'); return; }
  var total = amount * users.length;
  if (!confirm('Kirim ' + formatRp(amount) + ' ke ' + users.length + ' user? Total: ' + formatRp(total))) return;
  var btn = e.target, orig = btn.innerHTML; btn.innerHTML = '<span class="loader"></span> Mengirim...'; btn.disabled = true;
  try {
    var batch = db.batch();
    users.forEach(function (u) { batch.update(db.collection('users').doc(u.uid), { balance: FieldValue.increment(amount) }); });
    await batch.commit();
    showToast('✅ ' + formatRp(total) + ' terkirim', 'ok');
    document.getElementById('mbAmount').value = ''; document.getElementById('mbNote').value = '';
  } catch (err) { showToast('Gagal: ' + err.message, 'err'); }
  finally { btn.innerHTML = orig; btn.disabled = false; }
}

/* ===== EXPORT ===== */
async function exportData(type, format) {
  var data = type === 'transactions' ? allTx : type === 'users' ? allUsers : allClaims;
  if (!data.length) { showToast('Tidak ada data', 'err'); return; }
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = type + '_' + Date.now() + '.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('✅ File diunduh', 'ok');
}
async function fullBackup() {
  var data = { transactions: allTx, users: allUsers, claims: allClaims, products: allProducts, coupons: allCoupons, exportedAt: new Date().toISOString() };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = 'owlnar_backup_' + Date.now() + '.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Backup diunduh', 'ok');
}

/* ===== EXPOSE GLOBAL ===== */
window.doLogin = doLogin;
window.doGoogle = doGoogle;
window.doLogout = doLogout;
window.goPage = goPage;
window.toggleSidebar = toggleSidebar;
window.toggleTheme = toggleTheme;
window.openModal = openModal;
window.closeModal = closeModal;
window.handleGlobalSearch = handleGlobalSearch;
window.setChartPeriod = setChartPeriod;
window.openProductForm = openProductForm;
window.editProduct = editProduct;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.toggleProductSwitch = toggleProductSwitch;
window.seedDefaultProducts = seedDefaultProducts;
window.promptBan = promptBan;
window.confirmBan = confirmBan;
window.unbanUser = unbanUser;
window.sendBroadcast = sendBroadcast;
window.loadBcHistory = loadBcHistory;
window.saveCoupon = saveCoupon;
window.deleteCoupon = deleteCoupon;
window.saveBanner = saveBanner;
window.deleteBanner = deleteBanner;
window.saveConfig = saveConfig;
window.toggleMaintenance = toggleMaintenance;
window.approveTx = approveTx;
window.rejectTx = rejectTx;
window.deleteTx = deleteTx;
window.viewTx = viewTx;
window.approveAllPending = approveAllPending;
window.setClaimFilter = setClaimFilter;
window.openClaimLink = openClaimLink;
window.saveClaimLinks = saveClaimLinks;
window.accClaim = accClaim;
window.deleteClaim = deleteClaim;
window.viewUser = viewUser;
window.addBalance = addBalance;
window.toggleVip = toggleVip;
window.sendPM = sendPM;
window.massAddBalance = massAddBalance;
window.exportData = exportData;
window.fullBackup = fullBackup;
window.renderTransactions = renderTransactions;
window.renderProductsTable = renderProductsTable;
window.renderUsersTable = renderUsersTable;

console.log('%c✅ OWLNAR v4.2 READY — Data akan muncul setelah login', 'color:#10d981;font-weight:bold');