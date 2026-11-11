/* OWLNAR PLAYER v5 - tampilan lirik gaya Apple Music.
   Pasang SEBELUM owner.js. Tidak butuh CSS/HTML tambahan (semuanya dibuat dari sini).
   Cover : iTunes Search API (otomatis, di-cache di localStorage)
   Lirik : LRCLIB (otomatis, sinkron per baris) atau LRC milikmu sendiri lewat window.OWLNAR_LRC */
(function () {
  'use strict';
  var T = [
    ['As It Was', 'Harry Styles', 'https://atiswas.edgeone.dev/'],
    ['Mata Air', 'Hindia ft. Natasha Udu & Kamga', 'https://mataair.edgeone.dev/'],
    ['My Lo Lo Love', 'Evelyn Kirana', 'https://mylololove.edgeone.dev/'],
    ['Secukupnya', 'Hindia', 'https://secukupnya.edgeone.dev/'],
    ['Tarot', '.Feast', 'https://tarot-2573ocqe.edgeone.dev/'],
    ['Evaluasi', 'Hindia', 'https://evaluasi.edgeone.dev/'],
    ['Katakan Saja', 'Pria Terbaik', 'https://katakansaja.edgeone.dev/'],
    ['In Another Lifetime', 'Evelyn Kirana', 'https://ialasassas.edgeone.dev/'],
    ['Amnesia', 'Al Ghazali', 'https://amnesia-btkvphq9.edgeone.dev/'],
    ['Angin Kencang', 'Noh Salleh', 'https://anginkencang.edgeone.dev/'],
    ['Lihat Kebunku', 'Ajeje', 'https://lihatkebunkujeje.edgeone.dev/'],
    ['Dinda', 'Masdo', 'https://dinda.edgeone.dev/'],
    ['The Shade', 'Rex Orange County', 'https://theshadexcomeinsideofmyheart.edgeone.dev/'],
    ['Kita Ke Sana', 'Hindia', 'https://kitakesana.edgeone.dev/'],
    ['Pandangan Pertama', 'RAN', 'https://pandanganpertama.edgeone.dev/'],
    ['Who Knows', 'Daniel Caesar', 'https://whoknows.edgeone.dev/']
  ].map(function (a) { return { name: a[0], artist: a[1], url: a[2] }; });

  /* LRC buatan sendiri (opsional), contoh: window.OWLNAR_LRC = {'Dinda|Masdo': '[00:12.30]teks...'} */
  var MANUAL = window.OWLNAR_LRC || {};
  var PH = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#1b1f2e"/><text x="50" y="64" font-size="44" text-anchor="middle" fill="#6a7a96">&#9835;</text></svg>');
  var LS = window.localStorage;
  function jget(k, d) { try { return JSON.parse(LS.getItem(k)) || d; } catch (e) { return d; } }
  function jset(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var M = jget('ap_meta_v1', {}), FAV = jget('ap_fav', {});
  var S = { i: 0, playing: false, shuf: false, rep: 0, lrc: [], els: [], act: -1, wc: -1, hold: 0 };
  var A = new Audio(); A.preload = 'auto'; A.volume = +(LS.getItem('ap_vol') || 0.8);

  function K(t) { return t.name + '|' + t.artist; }
  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(s) { s = Math.max(0, s || 0); return Math.floor(s / 60) + ':' + ('0' + Math.floor(s % 60)).slice(-2); }
  function firstArtist(a) { return a.split(/\s+(?:ft\.?|feat\.?)\s+|,|&/i)[0].trim(); }

  /* ---------- CSS ---------- */
  var css = [
    '#ap{position:fixed;inset:0;z-index:9999;background:#0d0d0d;color:#fff;font-family:Inter,-apple-system,Segoe UI,sans-serif;opacity:0;visibility:hidden;transition:opacity .5s,visibility .5s;overflow:hidden;--c1:#2f5d2a;--c2:#6b5a1c;--c3:#173b2a}',
    '#ap.open{opacity:1;visibility:visible}',
    '.ap-bg{position:absolute;inset:-25%;filter:blur(80px) saturate(1.7)}',
    '.ap-blob{position:absolute;width:62vmax;height:62vmax;border-radius:50%;opacity:.9;transition:background 1.4s;animation:apf 26s ease-in-out infinite alternate}',
    '.ap-blob:nth-child(1){left:-8%;top:-12%;background:var(--c1)}',
    '.ap-blob:nth-child(2){right:-12%;top:8%;background:var(--c2);animation-duration:32s;animation-delay:-9s}',
    '.ap-blob:nth-child(3){left:22%;bottom:-34%;background:var(--c3);animation-duration:38s;animation-delay:-18s}',
    '@keyframes apf{to{transform:translate(14%,9%) scale(1.22) rotate(45deg)}}',
    '.ap-shade{position:absolute;inset:0;background:rgba(0,0,0,.3)}',
    '.ap-x,.ap-lb{position:absolute;z-index:3;width:38px;height:38px;border:0;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;font-size:16px;cursor:pointer;backdrop-filter:blur(12px);transition:background .25s,transform .25s}',
    '.ap-x{left:24px;top:22px}.ap-lb{right:28px;bottom:26px;border-radius:10px}',
    '.ap-x:hover,.ap-lb:hover{background:rgba(255,255,255,.3);transform:scale(1.08)}.ap-lb.on{background:rgba(255,255,255,.9);color:#222}',
    '.ap-main{position:relative;z-index:2;height:100%;display:flex;align-items:center;justify-content:center;gap:6vw;padding:4vh 5vw}',
    '.ap-left{width:min(34vw,370px);flex:none}',
    '.ap-cover{display:block;width:100%;aspect-ratio:1;border-radius:10px;object-fit:cover;background:#1b1f2e;box-shadow:0 24px 70px rgba(0,0,0,.5);transform:scale(.86);transition:transform .7s cubic-bezier(.2,.8,.2,1)}',
    '#ap.playing .ap-cover{transform:scale(1)}',
    '.ap-meta{display:flex;align-items:center;gap:10px;margin:22px 0 14px}.ap-tt{flex:1;min-width:0}',
    '.ap-t{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ap-a{font-size:15px;color:rgba(255,255,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ap-ib{width:26px;height:26px;border:0;border-radius:50%;background:rgba(255,255,255,.2);color:#fff;font-size:11px;cursor:pointer;transition:transform .2s,background .2s}.ap-ib:hover{background:rgba(255,255,255,.35);transform:scale(1.12)}.ap-ib.on{color:#ffd60a}',
    '.ap-bar{position:relative;height:14px;display:flex;align-items:center;cursor:pointer;transition:transform .2s;touch-action:none}',
    '.ap-bar::before{content:"";position:absolute;left:0;right:0;height:4px;border-radius:4px;background:rgba(255,255,255,.28)}',
    '.ap-bar i{position:relative;display:block;height:4px;border-radius:4px;background:#fff;width:0}.ap-bar:hover{transform:scaleY(1.5)}',
    '.ap-tm{display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,.55);margin-top:2px;font-variant-numeric:tabular-nums}',
    '.ap-ctl{display:flex;justify-content:center;align-items:center;gap:30px;margin:14px 0 22px}',
    '.ap-ctl button{background:none;border:0;color:rgba(255,255,255,.65);font-size:20px;cursor:pointer;position:relative;transition:transform .2s,color .2s}.ap-ctl button:hover{color:#fff;transform:scale(1.12)}.ap-ctl button:active{transform:scale(.9)}',
    '.ap-ctl button.on{color:#fff}.ap-ctl button.on::after{content:"";position:absolute;left:50%;bottom:-8px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:#fff}',
    '.ap-ctl button.one::before{content:"1";position:absolute;right:-6px;top:-8px;font-size:9px;font-weight:800}',
    '.ap-ctl .ap-pp{font-size:34px;color:#fff;width:44px}',
    '.ap-vol{display:flex;align-items:center;gap:10px;color:rgba(255,255,255,.55);font-size:12px}.ap-vol .ap-bar{flex:1}',
    '.ap-right{position:relative;flex:1;max-width:620px;height:82vh;-webkit-mask-image:linear-gradient(transparent,#000 14%,#000 78%,transparent);mask-image:linear-gradient(transparent,#000 14%,#000 78%,transparent)}',
    '.ap-lyr,.ap-list{position:relative;height:100%;overflow-y:auto;scrollbar-width:none}.ap-lyr::-webkit-scrollbar,.ap-list::-webkit-scrollbar{display:none}',
    '.ap-lyr{padding:38vh 0 40vh}.ap-list{display:none;padding:14vh 0}#ap.list .ap-lyr{display:none}#ap.list .ap-list{display:block}',
    '.ap-line{font-size:clamp(22px,2.7vw,36px);font-weight:700;line-height:1.25;padding:11px 14px;margin:0 -14px;border-radius:12px;color:rgba(255,255,255,.34);cursor:pointer;transform:scale(.93);transform-origin:left center;filter:blur(var(--b,0px));transition:color .5s,transform .7s cubic-bezier(.2,.8,.2,1),filter .6s,background .3s;animation:apin .7s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i) * 45ms)}',
    '@keyframes apin{from{opacity:0;transform:translateY(28px) scale(.93)}}',
    '.ap-line.act{color:#fff;transform:scale(1)}.ap-line:hover{background:rgba(255,255,255,.08)}.ap-lyr:hover .ap-line{filter:blur(0)}',
    '.ap-line .w{transition:opacity .35s}.ap-line.act .w{opacity:.42}.ap-line.act .w.on{opacity:1}',
    '.ap-empty{padding:0 14px;font-size:22px;font-weight:700;color:rgba(255,255,255,.4);animation:apin .6s both}',
    '.ap-it{display:flex;align-items:center;gap:14px;padding:10px 14px;border-radius:12px;cursor:pointer;transition:background .25s,transform .25s}.ap-it:hover{background:rgba(255,255,255,.1);transform:translateX(4px)}.ap-it.on{background:rgba(255,255,255,.18)}',
    '.ap-it img{width:48px;height:48px;border-radius:6px;object-fit:cover;background:#1b1f2e}.ap-it b{display:block;font-size:15px}.ap-it span{font-size:13px;color:rgba(255,255,255,.55)}',
    '.ap-note{position:absolute;z-index:4;top:26px;left:50%;transform:translate(-50%,-20px);padding:9px 18px;border-radius:20px;background:rgba(0,0,0,.6);backdrop-filter:blur(12px);font-size:13px;opacity:0;transition:.4s;pointer-events:none}.ap-note.on{opacity:1;transform:translate(-50%,0)}',
    '#apFab{position:fixed;right:18px;bottom:18px;width:54px;height:54px;border-radius:50%;border:2px solid rgba(255,255,255,.25);padding:0;overflow:hidden;cursor:pointer;z-index:950;background:#111420;box-shadow:0 6px 22px rgba(0,0,0,.45);transition:transform .25s}#apFab:hover{transform:scale(1.08)}',
    '#apFab img{width:100%;height:100%;object-fit:cover;display:block}#apFab.on img{animation:aps 9s linear infinite}@keyframes aps{to{transform:rotate(360deg)}}',
    '@media(max-width:820px){.ap-main{flex-direction:column;justify-content:flex-start;gap:14px;padding:64px 22px 20px;overflow-y:auto}.ap-left{width:min(80vw,330px)}.ap-right{width:100%;height:48vh;flex:none}.ap-lb{right:18px;bottom:16px}}',
    '@media(prefers-reduced-motion:reduce){.ap-blob,.ap-line{animation:none}}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- DOM ---------- */
  var root = document.createElement('div'); root.id = 'ap';
  root.innerHTML =
    '<div class="ap-bg"><i class="ap-blob"></i><i class="ap-blob"></i><i class="ap-blob"></i></div><div class="ap-shade"></div>' +
    '<button class="ap-x" id="apX" title="Tutup"><i class="fas fa-xmark"></i></button>' +
    '<div class="ap-main"><div class="ap-left">' +
    '<img class="ap-cover" id="apCover" alt="">' +
    '<div class="ap-meta"><div class="ap-tt"><div class="ap-t" id="apT"></div><div class="ap-a" id="apA"></div></div>' +
    '<button class="ap-ib" id="apFav" title="Favorit"><i class="far fa-star"></i></button><button class="ap-ib" id="apMore" title="Salin info lagu"><i class="fas fa-ellipsis"></i></button></div>' +
    '<div class="ap-bar" id="apBar"><i id="apFill"></i></div><div class="ap-tm"><span id="apCur">0:00</span><span id="apRem">-0:00</span></div>' +
    '<div class="ap-ctl"><button id="apShuf" title="Acak"><i class="fas fa-shuffle"></i></button><button id="apPrev" title="Sebelumnya"><i class="fas fa-backward"></i></button>' +
    '<button class="ap-pp" id="apPP" title="Putar"><i class="fas fa-play"></i></button><button id="apNext" title="Berikutnya"><i class="fas fa-forward"></i></button><button id="apRep" title="Ulangi"><i class="fas fa-repeat"></i></button></div>' +
    '<div class="ap-vol"><i class="fas fa-volume-low"></i><div class="ap-bar" id="apVol"><i id="apVf"></i></div></div>' +
    '</div><div class="ap-right"><div class="ap-lyr" id="apLyr"></div><div class="ap-list" id="apList"></div></div></div>' +
    '<div class="ap-note" id="apNote"></div><button class="ap-lb" id="apLb" title="Daftar lagu"><i class="fas fa-message"></i></button>';
  var fab = document.createElement('button'); fab.id = 'apFab'; fab.title = 'Owlnar Music'; fab.innerHTML = '<img id="apFabImg" alt="">';
  document.body.appendChild(root); document.body.appendChild(fab);
  function $(id) { return document.getElementById(id); }
  root.addEventListener('error', function (e) { if (e.target.tagName === 'IMG' && e.target.src !== PH) e.target.src = PH; }, true);
  $('apFabImg').onerror = function () { this.src = PH; };

  function note(msg) { var n = $('apNote'); n.textContent = msg; n.classList.add('on'); clearTimeout(note.t); note.t = setTimeout(function () { n.classList.remove('on'); }, 3200); }

  /* ---------- Warna latar dari cover ---------- */
  function fallbackCols(seed) {
    var h = 0; for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
    return ['hsl(' + h + ',60%,34%)', 'hsl(' + ((h + 40) % 360) + ',55%,28%)', 'hsl(' + ((h + 300) % 360) + ',50%,22%)'];
  }
  function setCols(c) { root.style.setProperty('--c1', c[0]); root.style.setProperty('--c2', c[1]); root.style.setProperty('--c3', c[2]); }
  function paint(src, seed) {
    setCols(fallbackCols(seed));
    if (!src) return;
    var im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = function () {
      try {
        var c = document.createElement('canvas'); c.width = c.height = 30;
        var x = c.getContext('2d'); x.drawImage(im, 0, 0, 30, 30);
        var avg = function (a, b, w, h) { var d = x.getImageData(a, b, w, h).data, r = 0, g = 0, bl = 0, n = d.length / 4; for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; } return 'rgb(' + Math.round(r / n * .85) + ',' + Math.round(g / n * .85) + ',' + Math.round(bl / n * .85) + ')'; };
        setCols([avg(0, 0, 15, 30), avg(15, 0, 15, 15), avg(0, 15, 30, 15)]);
      } catch (e) { /* canvas tainted: pakai warna cadangan */ }
    };
    im.src = src;
  }

  /* ---------- Cover (iTunes) + lirik (LRCLIB) ---------- */
  async function getLrc(t, m) {
    var a = firstArtist(t.artist), enc = encodeURIComponent;
    var urls = ['https://lrclib.net/api/search?track_name=' + enc(t.name) + '&artist_name=' + enc(a), 'https://lrclib.net/api/search?q=' + enc(t.name + ' ' + a)];
    for (var u = 0; u < urls.length; u++) {
      var r = await (await fetch(urls[u])).json();
      var c = (r || []).filter(function (x) { return x.syncedLyrics && (norm(x.trackName).indexOf(norm(t.name)) > -1 || norm(t.name).indexOf(norm(x.trackName)) > -1); });
      if (c.length) { if (m.dur) c.sort(function (x, y) { return Math.abs(x.duration - m.dur) - Math.abs(y.duration - m.dur); }); return c[0].syncedLyrics; }
    }
    return '';
  }
  async function meta(i) {
    var t = T[i], k = K(t), m = M[k] = M[k] || {};
    if (m.done) return m;
    var fail = false;
    try {
      var r = await (await fetch('https://itunes.apple.com/search?entity=song&limit=6&term=' + encodeURIComponent(t.name + ' ' + firstArtist(t.artist)))).json();
      var h = (r.results || []).filter(function (x) { return norm(x.trackName).indexOf(norm(t.name)) > -1 || norm(t.name).indexOf(norm(x.trackName)) > -1; })[0];
      if (h) { m.art = h.artworkUrl100.replace('100x100', '600x600'); m.album = h.collectionName; m.dur = h.trackTimeMillis / 1000; }
    } catch (e) { fail = true; }
    if (MANUAL[k] === undefined && m.lrc === undefined) {
      try { m.lrc = await getLrc(t, m); } catch (e) { fail = true; }
    }
    if (!fail) m.done = 1;
    jset('ap_meta_v1', M);
    return m;
  }

  /* ---------- Lirik ---------- */
  function parseLrc(s) {
    var o = [];
    String(s || '').split(/\r?\n/).forEach(function (l) {
      var m = l.match(/^((?:\[\d+:\d+(?:\.\d+)?\])+)(.*)$/); if (!m) return;
      var tx = m[2].trim(); if (!tx) return;
      m[1].replace(/\[(\d+):(\d+(?:\.\d+)?)\]/g, function (_, a, b) { o.push({ t: +a * 60 + +b, x: tx }); });
    });
    return o.sort(function (a, b) { return a.t - b.t; });
  }
  function renderLyr() {
    var t = T[S.i], k = K(t), m = M[k] || {}, txt = MANUAL[k] !== undefined ? MANUAL[k] : m.lrc, box = $('apLyr');
    S.lrc = parseLrc(txt); S.act = -1; S.wc = -1; S.els = [];
    if (!S.lrc.length) { box.innerHTML = '<div class="ap-empty">' + (m.done || MANUAL[k] !== undefined ? 'Lirik belum tersedia' : 'Mencari lirik\u2026') + '</div>'; return; }
    box.innerHTML = S.lrc.map(function (l, i) {
      var end = S.lrc[i + 1] ? S.lrc[i + 1].t : l.t + 5, ws = l.x.split(/\s+/), c = 0, span = Math.min(end - l.t, 6) * 0.85;
      l.w = ws.map(function (w) { var s = l.t + span * c / l.x.length; c += w.length + 1; return s; });
      return '<div class="ap-line" style="--i:' + Math.min(i, 14) + '" data-i="' + i + '">' + ws.map(function (w) { return '<span class="w">' + esc(w) + '</span>'; }).join(' ') + '</div>';
    }).join('');
    S.els = box.querySelectorAll('.ap-line'); box.scrollTop = 0; sync(A.currentTime || 0, true);
  }
  function sync(ct, force) {
    var L = S.lrc; if (!L.length || !S.els.length) return;
    var a = -1; for (var i = L.length - 1; i >= 0; i--) { if (L[i].t <= ct + 0.12) { a = i; break; } }
    if (a !== S.act || force) {
      for (i = 0; i < S.els.length; i++) { S.els[i].classList.toggle('act', i === a); S.els[i].style.setProperty('--b', (a < 0 ? 0 : Math.min(Math.abs(i - a) * 0.7, 3.5)) + 'px'); }
      S.act = a; S.wc = -1;
      if (a >= 0 && Date.now() > S.hold) { var e = S.els[a], b = $('apLyr'); b.scrollTo({ top: e.offsetTop - b.clientHeight * 0.38 + e.offsetHeight / 2, behavior: 'smooth' }); }
    }
    if (a >= 0) {
      var w = L[a].w, n = 0; while (n < w.length && w[n] <= ct) n++;
      if (n !== S.wc) { var sp = S.els[a].children; for (var j = 0; j < sp.length; j++) sp[j].classList.toggle('on', j < n); S.wc = n; }
    }
  }

  /* ---------- Tampilan ---------- */
  function setCover(src) { $('apCover').src = src || PH; $('apFabImg').src = src || PH; }
  function renderList() {
    $('apList').innerHTML = T.map(function (t, i) {
      var m = M[K(t)] || {};
      return '<div class="ap-it' + (i === S.i ? ' on' : '') + '" data-i="' + i + '"><img src="' + esc(m.art || PH) + '" alt=""><div><b>' + esc(t.name) + '</b><span>' + esc(t.artist) + '</span></div></div>';
    }).join('');
  }
  function favUi() { var on = !!FAV[K(T[S.i])], b = $('apFav'); b.classList.toggle('on', on); b.innerHTML = '<i class="' + (on ? 'fas' : 'far') + ' fa-star"></i>'; }
  function ui() { root.classList.toggle('playing', S.playing); fab.classList.toggle('on', S.playing); $('apPP').innerHTML = '<i class="fas fa-' + (S.playing ? 'pause' : 'play') + '"></i>'; }
  function head() {
    var t = T[S.i], m = M[K(t)] || {};
    $('apT').textContent = t.name; $('apA').textContent = t.artist + (m.album ? ' \u2014 ' + m.album : '');
    setCover(m.art); paint(m.art, K(t)); favUi(); renderList();
  }

  function load(i, play) {
    S.i = (i + T.length) % T.length; var t = T[S.i];
    A.src = t.url; A.loop = S.rep === 2; A.load();
    head(); renderLyr(); frame();
    if (play) doPlay();
    meta(S.i).then(function () { if (T[S.i] === t) { head(); renderLyr(); } });
  }
  function doPlay() { var p = A.play(); if (p && p.catch) p.catch(function () { note('Audio gagal diputar: ' + T[S.i].name); }); }
  function next(auto) {
    if (S.shuf && T.length > 1) { var j; do { j = Math.floor(Math.random() * T.length); } while (j === S.i); return load(j, true); }
    if (auto && S.rep === 0 && S.i === T.length - 1) { A.pause(); A.currentTime = 0; return; }
    load(S.i + 1, true);
  }
  function prev() { if (A.currentTime > 3) A.currentTime = 0; else load(S.i - 1, true); }

  var raf = 0;
  function frame() {
    var d = A.duration || 0, c = A.currentTime || 0;
    $('apFill').style.width = (d ? c / d * 100 : 0) + '%'; $('apCur').textContent = fmt(c); $('apRem').textContent = '-' + fmt(d - c);
    sync(c);
  }
  function loop() { cancelAnimationFrame(raf); (function f() { frame(); if (S.playing) raf = requestAnimationFrame(f); })(); }

  A.addEventListener('play', function () { S.playing = true; ui(); loop(); });
  A.addEventListener('pause', function () { S.playing = false; ui(); });
  A.addEventListener('seeked', frame);
  A.addEventListener('loadedmetadata', frame);
  A.addEventListener('ended', function () { next(true); });
  A.addEventListener('error', function () { if (A.getAttribute('src')) note('Audio tidak bisa dimuat: ' + T[S.i].name); });

  /* ---------- Kontrol ---------- */
  function drag(el, fn) {
    el.addEventListener('pointerdown', function (e) { el.setPointerCapture(e.pointerId); fn(e); el.onpointermove = fn; });
    el.addEventListener('lostpointercapture', function () { el.onpointermove = null; });
  }
  function ratio(el, e) { var r = el.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); }
  drag($('apBar'), function (e) { if (A.duration) A.currentTime = ratio($('apBar'), e) * A.duration; frame(); });
  function setVol(p) { A.volume = p; $('apVf').style.width = p * 100 + '%'; LS.setItem('ap_vol', p); }
  drag($('apVol'), function (e) { setVol(ratio($('apVol'), e)); });
  setVol(A.volume);

  $('apPP').onclick = function () { if (A.paused) doPlay(); else A.pause(); };
  $('apNext').onclick = function () { next(false); };
  $('apPrev').onclick = prev;
  $('apShuf').onclick = function () { S.shuf = !S.shuf; this.classList.toggle('on', S.shuf); };
  $('apRep').onclick = function () { S.rep = (S.rep + 1) % 3; A.loop = S.rep === 2; this.classList.toggle('on', S.rep > 0); this.classList.toggle('one', S.rep === 2); };
  $('apFav').onclick = function () { var k = K(T[S.i]); FAV[k] = !FAV[k]; jset('ap_fav', FAV); favUi(); };
  $('apMore').onclick = function () { var t = T[S.i]; if (navigator.clipboard) navigator.clipboard.writeText(t.name + ' \u2014 ' + t.artist).then(function () { note('Info lagu disalin'); }, function () {}); };
  $('apLb').onclick = function () { root.classList.toggle('list'); this.classList.toggle('on'); };
  $('apList').onclick = function (e) { var it = e.target.closest('.ap-it'); if (!it) return; load(+it.dataset.i, true); root.classList.remove('list'); $('apLb').classList.remove('on'); };
  $('apLyr').addEventListener('click', function (e) { var l = e.target.closest('.ap-line'); if (l && S.lrc[+l.dataset.i]) { A.currentTime = S.lrc[+l.dataset.i].t; if (A.paused) doPlay(); } });
  ['wheel', 'touchmove'].forEach(function (ev) { $('apLyr').addEventListener(ev, function () { S.hold = Date.now() + 3000; }, { passive: true }); });

  function open(v) { root.classList.toggle('open', v); if (v) frame(); }
  fab.onclick = function () { open(true); };
  $('apX').onclick = function () { open(false); };
  document.addEventListener('keydown', function (e) {
    if (!root.classList.contains('open') || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'Escape') open(false);
    else if (e.key === ' ') { e.preventDefault(); $('apPP').click(); }
    else if (e.key === 'ArrowRight') A.currentTime = Math.min(A.duration || 0, A.currentTime + 5);
    else if (e.key === 'ArrowLeft') A.currentTime = Math.max(0, A.currentTime - 5);
  });

  /* kompatibilitas dengan tombol lama di HTML */
  window.toggleMusicPanel = function () { open(!root.classList.contains('open')); };
  window.expandMusic = function () { open(true); };
  window.openMusicLyrics = function () { open(true); root.classList.remove('list'); };
  window.closeMusicFull = function () { open(false); };

  load(0, false);
  /* muat cover + lirik semua 16 lagu satu per satu di latar belakang */
  T.reduce(function (p, _, i) { return p.then(function () { return meta(i); }).then(function () { renderList(); if (i === S.i) { head(); renderLyr(); } }); }, Promise.resolve());
})();
