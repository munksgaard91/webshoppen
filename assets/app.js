/* Webshoppen – frontend. Vanilla JS, hash-routing. Al data hentes via api().
 * Medarbejdere får topmenu (Overblik, Min profil). Admin får sidepanel med admin-sider. */
(function () {
  'use strict';

  var C = window.WEBSHOP_CONFIG || {};
  var DEMO = !C.API_URL || /[?&]demo\b/.test(location.search);
  var app = document.getElementById('app');
  var modalRoot = document.getElementById('modal-root');

  var S = null;       // brugerens state
  var A = null;       // admin-state (hentes kun når admin åbner admin-sider)
  var session = null; // { token } eller { email } i demo
  var ui = { profilFilter: 'alle', bestFilter: 'ny', postType: 'alle', postPerson: '' };

  var MAANEDER = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
  var TYPER = {
    optjent: 'Optjent', koeb: 'Køb', gave: 'Gave givet', gave_modtaget: 'Gave modtaget',
    projekt: 'Projekt', refusion: 'Refusion', justering: 'Justering'
  };

  // ---------- Hjælpere ----------

  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return null; }
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('da-DK'); }
  function kr(n) { return 'kr ' + fmt(n); }
  // Webcoins skrives altid helt ud.
  function enhed(n) { return Math.abs(Math.round(Number(n) || 0)) === 1 ? 'Webcoin' : 'Webcoins'; }
  function wc(n) { return fmt(n) + ' ' + enhed(n); }
  function wcSmall(n) { return fmt(n) + ' <small>' + enhed(n) + '</small>'; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function fornavn(n) { return String(n || '').split(' ')[0]; }
  function initialerAf(navn) { return String(navn || '?').split(' ').map(function (x) { return x[0]; }).join('').slice(0, 2).toUpperCase(); }
  function dato(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  }
  function maanedLabel(key) {
    var p = String(key).split('-');
    return cap(MAANEDER[Number(p[1]) - 1] || '') + ' ' + p[0];
  }
  function hilsen() {
    var h = new Date().getHours();
    if (h < 5) return 'Godnat';
    if (h < 9) return 'Godmorgen';
    if (h < 12) return 'Godformiddag';
    if (h < 18) return 'God eftermiddag';
    return 'Godaften';
  }
  function beloebCell(b) {
    var cls = b > 0 ? 'plus' : b < 0 ? 'minus' : 'zero';
    return '<span class="' + cls + ' num">' + (b > 0 ? '+' : '') + wc(b) + '</span>';
  }
  function avatar(me, lg) {
    var c = 'avatar' + (lg ? ' lg' : '');
    if (me.billede) return '<span class="' + c + '"><img src="' + esc(me.billede) + '" alt="" referrerpolicy="no-referrer"></span>';
    return '<span class="' + c + '">' + esc(me.initialer || initialerAf(me.navn)) + '</span>';
  }
  function logo() {
    return '<a class="brand" href="#/"><span class="logo">best one<i>.</i></span><span class="brand-sep"></span><span class="brand-name">Webshoppen</span></a>';
  }
  function coin(cls) {
    return '<svg class="coin ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="var(--gold)"/><circle cx="12" cy="12" r="8.3" fill="none" stroke="var(--gold-deep)" stroke-width="1.4"/><path d="M7.2 8.6 9 15.4l3-5.2 3 5.2 1.8-6.8" fill="none" stroke="var(--gold-deep)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  var IKON = {
    home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6z"/>',
    book: '<path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/>',
    cart: '<path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="9" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5z"/><circle cx="17" cy="9" r="2.8"/><path d="M16.5 14.2c3 .2 5.5 2 5.5 5.3h-4"/>',
    box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/>',
    coin: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 9.5 10 15l2-3.6 2 3.6 1.5-5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    list: '<rect x="3" y="4" width="18" height="3" rx="1"/><rect x="3" y="10.5" width="18" height="3" rx="1"/><rect x="3" y="17" width="12" height="3" rx="1"/>',
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    logout: '<path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 8l4 4-4 4M19 12H9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    burger: '<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    gift: '<path d="M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM3 7h18v4H3zM12 7v14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 7c-1.5-3-5-4-5-1.5S10 7 12 7zm0 0c1.5-3 5-4 5-1.5S14 7 12 7z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    info: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1.4"/>',
    sync: '<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 3v4h-4M6 21v-4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  };
  function ico(n) { return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + IKON[n] + '</svg>'; }

  function toast(titel, tekst, fejl) {
    var el = document.createElement('div');
    el.className = 'toast' + (fejl ? ' err' : '');
    el.innerHTML = esc(titel) + (tekst ? '<small>' + esc(tekst) + '</small>' : '');
    document.getElementById('toasts').appendChild(el);
    setTimeout(function () { el.remove(); }, fejl ? 6000 : 4000);
  }

  function spark(vals) {
    var w = 170, h = 44, n = vals.length;
    var max = Math.max.apply(null, vals.concat([1]));
    var pts = vals.map(function (v, i) { return [i * (w / (n - 1)), h - 4 - (v / max) * (h - 12)]; });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var last = pts[pts.length - 1];
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
      '<path d="' + line + ' L' + w + ' ' + h + ' L0 ' + h + ' Z" fill="var(--brand-2)" opacity=".12"/>' +
      '<path d="' + line + '" fill="none" stroke="var(--brand-2)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4" fill="var(--gold)" stroke="var(--card)" stroke-width="1.5"/></svg>';
  }

  // ---------- API ----------

  function api(action, data) {
    var p;
    if (DEMO) {
      p = window.Mock.call(session.email, action, data);
    } else {
      p = fetch(C.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ token: session.token, action: action, data: data || {} })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) { var e = new Error(j.error); e.code = j.code; throw e; }
        return j.data;
      });
    }
    return p.catch(function (e) {
      if (e.code === 'TOKEN_EXPIRED') { logout(e.message); }
      else if (e.code === 'NOT_REGISTERED') { renderNotReg(); }
      throw e;
    });
  }

  function refresh() {
    var jobs = [api('state').then(function (s) { S = s; })];
    if (A && S && S.me.admin) jobs.push(api('admin_state').then(function (a) { A = a; }));
    return Promise.all(jobs).then(render);
  }

  // ---------- Login ----------

  function start() {
    app.innerHTML = '<div class="boot"><span class="spinner"></span></div>';
    api('state').then(function (s) {
      S = s;
      if (S.me.admin) return api('admin_state').then(function (a) { A = a; render(); });
      render();
    }).catch(function (e) {
      if (e.code !== 'TOKEN_EXPIRED' && e.code !== 'NOT_REGISTERED') {
        app.innerHTML = '<div class="center-screen"><div class="login-card"><div class="logo logo-big">best one<i>.</i></div><h1>Hov</h1><p>' + esc(e.message) + '</p><button class="btn primary" data-act="reload">Prøv igen</button></div></div>';
      }
    });
  }

  function renderLogin(besked) {
    var demo = '';
    if (DEMO) {
      demo = '<div class="demo-tag">Demo-tilstand</div><div class="demo-list">' + window.Mock.demoBrugere.map(function (u) {
        return '<button data-act="demo-login" data-email="' + esc(u.email) + '"><span class="avatar">' + esc(u.initialer) + '</span><span><b>' + esc(u.navn) + '</b><br><small class="faint">' + esc(u.gruppe || '—') + (u.email === 'demo.admin@best-one.dk' ? ' · admin' : '') + '</small></span></button>';
      }).join('') + '</div><p style="margin:18px 0 0"><button class="btn sm" data-act="demo-reset">Nulstil demodata</button></p>';
    }
    app.innerHTML = '<div class="center-screen"><div class="login-card">' +
      coin('coin-xl') +
      '<div class="logo">best one<i>.</i></div>' +
      '<h1>Webshoppen</h1>' +
      '<p>' + esc(besked || 'Log ind med din Best One-konto') + '</p>' +
      (DEMO ? demo : '<div class="gbtn" id="gbtn"></div>') +
      '</div></div>';
    if (!DEMO) loadGis(function () {
      google.accounts.id.initialize({ client_id: C.GOOGLE_CLIENT_ID, callback: onCredential, auto_select: true, use_fedcm_for_prompt: true });
      google.accounts.id.renderButton(document.getElementById('gbtn'), { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'da' });
      google.accounts.id.prompt();
    });
  }

  function loadGis(cb) {
    if (window.google && google.accounts && google.accounts.id) return cb();
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = cb;
    s.onerror = function () { toast('Google-login kunne ikke hentes', 'Tjek din forbindelse og genindlæs.', true); };
    document.head.appendChild(s);
  }

  function onCredential(r) {
    session = { token: r.credential };
    store('webshoppen-session', JSON.stringify(session));
    start();
  }

  function logout(besked) {
    session = null; S = null; A = null;
    store('webshoppen-session', null);
    if (!DEMO && window.google && google.accounts) google.accounts.id.disableAutoSelect();
    closeModal();
    renderLogin(besked);
  }

  function renderNotReg() {
    app.innerHTML = '<div class="center-screen"><div class="login-card">' +
      coin('coin-xl') +
      '<div class="logo">best one<i>.</i></div>' +
      '<h1>Ikke registreret</h1>' +
      '<p>Du er desværre ikke registreret i Webshoppen.</p>' +
      '<button class="btn" data-act="logout">' + ico('logout') + 'Log ud</button>' +
      '</div></div>';
  }

  // ---------- Layout ----------

  function route() { return location.hash.replace(/^#\/?/, ''); }

  var SIDER = {
    '': { titel: 'Overblik', fn: pageOverblik },
    'profil': { titel: 'Min profil', fn: pageProfil },
    'admin/bestillinger': { titel: 'Bestillinger', fn: pageAdminBestillinger, admin: true },
    'admin/opgoerelse': { titel: 'Opgørelse', fn: pageAdminOpgoerelse, admin: true },
    'admin/brugere': { titel: 'Brugere', fn: pageAdminBrugere, admin: true },
    'admin/sortiment': { titel: 'Sortiment', fn: pageAdminSortiment, admin: true },
    'admin/regler': { titel: 'Regler', fn: pageRegler, admin: true },
    'admin/posteringer': { titel: 'Posteringer', fn: pageAdminPosteringer, admin: true }
  };

  function navLink(path, ikon, tekst, extra) {
    var on = route() === path ? ' class="on"' : '';
    return '<a href="#/' + path + '"' + on + '>' + (ikon ? ico(ikon) : '') + '<span>' + tekst + '</span>' + (extra || '') + '</a>';
  }

  function render() {
    if (!S) return;
    var r = route();
    var side = SIDER[r] || SIDER[''];
    if (side.admin && !S.me.admin) side = SIDER[''];
    if (side.admin && !A) {
      api('admin_state').then(function (a) { A = a; render(); }).catch(function (e) { toast('Fejl', e.message, true); });
      app.innerHTML = '<div class="boot"><span class="spinner"></span></div>';
      return;
    }
    var indhold = side.fn();
    app.innerHTML = S.me.admin ? adminShell(indhold) : brugerShell(indhold);
    document.title = side.titel + ' · Webshoppen';
    visLukket();
  }

  // Medarbejder: slank topmenu, intet sidepanel.
  function brugerShell(indhold) {
    var me = S.me;
    return '<header class="top"><div class="top-in">' + logo() +
      '<nav class="tabs">' + navLink('', '', 'Overblik') + navLink('profil', '', 'Min profil') + '</nav>' +
      '<div class="top-r">' +
      '<span class="saldo-pill num">' + coin() + wc(S.stats.saldo) + '</span>' +
      '<button class="icon-btn" data-act="theme" title="Skift tema" aria-label="Skift tema">' + ico('sun') + '</button>' +
      '<a class="me-link" href="#/profil" title="' + esc(me.navn) + '">' + avatar(me) + '</a>' +
      '<button class="icon-btn" data-act="logout" title="Log ud" aria-label="Log ud">' + ico('logout') + '</button>' +
      '</div></div></header>' +
      '<main class="main"><div class="wrap">' + indhold + '</div></main>';
  }

  // Admin: sidepanel med admin-sider.
  function adminShell(indhold) {
    var me = S.me;
    var nyeBest = A ? A.bestillinger.filter(function (b) { return b.status === 'ny'; }).length : 0;
    return '<div class="shell" id="shell">' +
      '<div class="scrim" data-act="close-nav"></div>' +
      '<aside class="side">' +
      '<div class="side-head">' + logo() + '</div>' +
      '<nav class="nav">' + navLink('', 'home', 'Overblik') + navLink('profil', 'user', 'Min profil') + '</nav>' +
      '<div class="nav-label">Admin</div>' +
      '<nav class="nav">' +
      navLink('admin/bestillinger', 'cart', 'Bestillinger', nyeBest ? '<span class="badge">' + nyeBest + '</span>' : '') +
      navLink('admin/opgoerelse', 'coin', 'Opgørelse') +
      navLink('admin/brugere', 'users', 'Brugere') +
      navLink('admin/sortiment', 'box', 'Sortiment') +
      navLink('admin/regler', 'book', 'Regler') +
      navLink('admin/posteringer', 'list', 'Posteringer') + '</nav>' +
      '<div class="side-foot">' +
      '<div class="me">' + avatar(me) + '<div class="who"><b>' + esc(fornavn(me.navn)) + '</b><small>Admin</small></div>' +
      '<button class="icon-btn" data-act="theme" title="Skift tema" aria-label="Skift tema">' + ico('sun') + '</button>' +
      '<button class="icon-btn" data-act="logout" title="Log ud" aria-label="Log ud">' + ico('logout') + '</button></div>' +
      '</div></aside>' +
      '<div class="shell-main">' +
      '<header class="top top-admin"><div class="top-in"><button class="icon-btn" data-act="open-nav" aria-label="Menu">' + ico('burger') + '</button>' + logo() +
      '<span class="saldo-pill num">' + coin() + wc(S.stats.saldo) + '</span></div></header>' +
      '<main class="main"><div class="wrap">' + indhold + '</div></main>' +
      '</div></div>';
  }

  // Overlay når shoppen er lukket (uden for åbningstid eller admin er "Ikke til stede").
  function visLukket() {
    var shop = S.shop || { aaben: true };
    if (shop.aaben || S.me.admin || ui.lukketSet || route() !== '') return;
    ui.lukketSet = true;
    openModal('<div class="closed">' + coin('coin-xl') +
      '<h2>Shoppen har lukket</h2>' +
      '<p>' + (shop.grund === 'fravaer' ? 'Vi er ikke på kontoret lige nu.' : 'Åben hverdage ' + esc(shop.tider || '08:00–15:30') + '.') + '</p>' +
      (shop.tekst ? '<p class="closed-when">' + esc(shop.tekst) + '</p>' : '') +
      '<button class="btn primary grow" data-act="close">Se min saldo</button></div>');
  }

  // ---------- Sider ----------

  function mineRegler() {
    var r = S.regler.filter(function (x) { return x.gruppe === S.me.gruppe; });
    if (!r.length) return '<div class="faint">Ingen regler for din gruppe endnu.</div>';
    return r.map(function (x) { return '<div class="rule"><span>' + esc(x.kildeNavn) + '</span><b>' + esc(x.tekst || x.sats) + '</b></div>'; }).join('');
  }

  function vareBillede(v) {
    if (v.billede) return '<span class="thumb"><img src="' + esc(v.billede) + '" alt="" loading="lazy"></span>';
    return '<span class="thumb">' + esc(v.ikon || '🛍️') + '</span>';
  }

  function pageOverblik() {
    var me = S.me, st = S.stats, nu = new Date(S.nu);
    var mNavn = MAANEDER[nu.getMonth()];
    var kanKoebe = !!me.initialer;
    var tb = S.teambudget;
    var shop = S.shop || { aaben: true };
    var lukket = !shop.aaben;

    // 1. Saldo + teambudget + regler
    var saldo = '<section class="saldo-card">' +
      '<div class="saldo-top"><span class="hello">' + hilsen() + ', ' + esc(fornavn(me.navn)) + ' 👋</span>' +
      (me.gruppe ? '<span class="info" tabindex="0" data-act="info"><button class="info-btn" aria-label="Sådan optjener du Webcoins">' + ico('info') + '</button>' +
        '<span class="pop" role="tooltip"><b class="pop-title">' + esc(me.gruppe) + '</b>' + mineRegler() + '</span></span>' : '') +
      '</div>' +
      '<div class="saldo-label">Du har</div>' +
      '<div class="saldo-big num">' + coin('coin-lg') + '<span>' + fmt(st.saldo) + '</span><small>' + enhed(st.saldo) + '</small></div>' +
      (kanKoebe
        ? '<div class="saldo-sub num">Du har optjent +' + wc(st.optjentMaaned) + ' i ' + mNavn + '</div>'
        : '<div class="saldo-sub">Din konto er ikke tilknyttet initialer endnu.</div>') +
      '</section>';

    var team = tb ? '<section class="card tb-card"><div class="eyebrow">Teambudget</div>' +
      '<div class="tb-big num">' + kr(tb.rest) + '</div>' +
      '<div class="bar"><i style="width:' + (tb.budget > 0 ? Math.max(0, Math.min(100, (tb.rest / tb.budget) * 100)) : 0).toFixed(0) + '%"></i></div>' +
      '<div class="meta num"><span>Brugt ' + kr(tb.brugt) + '</span><span>af ' + kr(tb.budget) + '</span></div></section>'
      : (me.admin ? '<section class="card tb-card"><div class="eyebrow">Teambudget</div><div class="empty">Ikke koblet på arket endnu.</div></section>' : '');

    var top = '<div class="row-top' + (team ? '' : ' solo') + '">' + saldo + team + '</div>';

    // 2. Bestil – liste i fuld bredde
    var menu = '<section class="block"><div class="block-head"><h2 class="block-title">Bestil</h2>' +
      (lukket ? '<span class="tag annulleret">Lukket' + (shop.tekst ? ' · ' + esc(shop.tekst) : '') + '</span>' : '') +
      '<span class="note">Personlig levering, så der kan være lidt ventetid.</span></div>' +
      (S.menu.length ? '<div class="card list">' + S.menu.map(function (v) {
        var raad = st.saldo >= v.pris && kanKoebe && !lukket;
        return '<div class="row">' + vareBillede(v) +
          '<div class="row-main"><b>' + esc(v.navn) + '</b></div>' +
          '<div class="row-price num">' + coin() + wc(v.pris) + '</div>' +
          '<div class="row-acts">' +
          '<button class="btn sm" data-act="giv" data-id="' + esc(v.id) + '"' + (raad && S.kolleger.length ? '' : ' disabled') + '>' + ico('gift') + 'Giv</button>' +
          '<button class="btn primary sm" data-act="koeb" data-id="' + esc(v.id) + '"' + (raad ? '' : ' disabled') + '>Bestil</button></div></div>';
      }).join('') + '</div>' : '<div class="card empty">Menuen er tom.</div>') +
      '</section>';

    // 3. Projekter – liste i fuld bredde med top 3
    var medaljer = ['🥇', '🥈', '🥉'];
    var projekter = '<section class="block"><h2 class="block-title">Projekter</h2>' +
      (S.projekter.length ? '<div class="card list">' + S.projekter.map(function (p) {
        var pp = p.maal > 0 ? Math.min(100, (p.indsamlet / p.maal) * 100) : 0;
        return '<div class="row proj-item">' +
          '<span class="thumb">' + esc(p.ikon || '🎯') + '</span>' +
          '<div class="row-main"><div class="proj-line"><b>' + esc(p.navn) + '</b><span class="muted num">' + wc(p.indsamlet) + (p.maal ? ' af ' + wc(p.maal) : '') + '</span></div>' +
          '<div class="bar"><i style="width:' + pp.toFixed(0) + '%"></i></div>' +
          '<div class="top3">' + (p.top.length ? p.top.map(function (t, i) {
            return '<span class="' + (t.initialer === me.initialer ? 'mig' : '') + '">' + medaljer[i] + ' ' + esc(t.navn) + ' <b class="num">' + wc(t.beloeb) + '</b></span>';
          }).join('') : '<span class="faint">Ingen bidrag endnu</span>') +
          (p.mitBidrag ? '<span class="dit num">Dit bidrag: ' + wc(p.mitBidrag) + '</span>' : '') + '</div></div>' +
          '<div class="row-acts"><button class="btn sm" data-act="indskyd" data-id="' + esc(p.id) + '"' + (kanKoebe && st.saldo > 0 ? '' : ' disabled') + '>Indskyd</button></div></div>';
      }).join('') + '</div>' : '<div class="card empty">Ingen åbne projekter.</div>') + '</section>';

    // 4. Statistik – kun dine egne tal
    var stats = '<section class="block"><h2 class="block-title">Statistik</h2><div class="stats two">' +
      '<div class="card stat"><div class="eyebrow">Du har optjent i ' + mNavn + '</div><div class="val num">' + wcSmall(st.optjentMaaned) + '</div>' + spark(st.forloeb.map(function (f) { return f.beloeb; })) + '</div>' +
      '<div class="card stat"><div class="eyebrow">Du har brugt i alt</div><div class="val num">' + wcSmall(st.brugt) + '</div>' +
      '<div class="breakdown num">' +
      '<div><span>Til dig selv</span><b>' + wc(st.brugtSelv) + '</b></div>' +
      '<div><span>Donationer</span><b>' + wc(st.givet) + '</b></div>' +
      '<div><span>I projekter</span><b>' + wc(st.indskudt) + '</b></div>' +
      '</div></div>' +
      '</div></section>';

    // 5. Bevægelser (+ mine bestillinger)
    var seneste = S.historik.slice(0, 6);
    var bevaeg = '<section class="card"><div class="card-head"><h2 class="card-title">Bevægelser</h2><a class="link" href="#/profil">Se alt</a></div>' +
      (seneste.length ? '<div class="mini-list">' + seneste.map(function (p) {
        return '<div class="mini"><div class="t">' + esc(p.tekst) + '<small>' + esc(TYPER[p.type] || p.type) + ' · ' + dato(p.tid) + '</small></div>' + beloebCell(p.beloeb) + '</div>';
      }).join('') + '</div>' : '<div class="empty">Ingen bevægelser endnu.</div>') +
      '<p class="disclaimer">Tallene kan ændre sig, hvis der bliver rettet fejl.</p></section>';

    var mineBest = S.bestillinger.slice(0, 6);
    var bestillinger = '<section class="card"><div class="card-head"><h2 class="card-title">Mine bestillinger</h2></div>' +
      (mineBest.length ? '<div class="mini-list">' + mineBest.map(function (b) {
        var tekst = b.fra === me.initialer
          ? (b.til !== b.fra ? b.vare + ' til ' + fornavn(b.tilNavn) : b.vare)
          : b.vare + ' fra ' + fornavn(b.fraNavn);
        return '<div class="mini"><div class="t">' + esc(tekst) + '<small>' + dato(b.tid) + '</small></div><span class="tag ' + esc(b.status) + '">' + esc(cap(b.status)) + '</span></div>';
      }).join('') + '</div>' : '<div class="empty">Intet bestilt endnu.</div>') + '</section>';

    var banner = lukket && me.admin ? '<div class="banner">Shoppen er lukket for medarbejderne lige nu' + (shop.grund === 'fravaer' ? ' (du er ikke til stede)' : '') + '. ' + esc(shop.tekst || '') + '</div>' : '';
    return banner + top + menu + projekter + stats + '<div class="grid-2">' + bevaeg + bestillinger + '</div>';
  }

  function pageProfil() {
    var me = S.me, st = S.stats, nu = new Date(S.nu);
    var mNavn = MAANEDER[nu.getMonth()];

    // Optjent pr. måned, fordelt på kilde (teksten er "Kilde · måned år")
    var maaneder = {};
    S.historik.forEach(function (p) {
      if (p.type !== 'optjent') return;
      var m = maaneder[p.maaned] = maaneder[p.maaned] || { maaned: p.maaned, total: 0, kilder: {} };
      var kilde = String(p.tekst).split(' · ')[0];
      m.total += p.beloeb;
      m.kilder[kilde] = (m.kilder[kilde] || 0) + p.beloeb;
    });
    var mRows = Object.keys(maaneder).sort().reverse().map(function (k) { return maaneder[k]; });
    var maxM = Math.max.apply(null, mRows.map(function (m) { return m.total; }).concat([1]));

    var head = '<div class="profile-head">' + avatar(me, true) +
      '<div><div class="eyebrow">' + esc([me.gruppe, me.initialer].filter(Boolean).join(' · ')) + '</div><h1>' + esc(me.navn) + '</h1></div>' +
      '<span class="saldo-pill big num">' + coin() + 'Du har ' + wc(st.saldo) + '</span></div>';

    var stats = '<div class="stats three">' +
      '<div class="card stat"><div class="eyebrow">Du har optjent i alt</div><div class="val num">' + wcSmall(st.optjentTotal) + '</div>' +
      '<div class="breakdown num"><div><span>Heraf i ' + mNavn + '</span><b>' + wc(st.optjentMaaned) + '</b></div></div></div>' +
      '<div class="card stat"><div class="eyebrow">Du har brugt i alt</div><div class="val num">' + wcSmall(st.brugt) + '</div>' +
      '<div class="breakdown num">' +
      '<div><span>Til dig selv</span><b>' + wc(st.brugtSelv) + '</b></div>' +
      '<div><span>Donationer</span><b>' + wc(st.givet) + '</b></div>' +
      '<div><span>I projekter</span><b>' + wc(st.indskudt) + '</b></div></div></div>' +
      '<div class="card stat"><div class="eyebrow">Gaver</div><div class="val num">' + st.gaverModtaget + ' <small>modtaget</small></div>' +
      '<div class="breakdown num"><div><span>Givet væk</span><b>' + st.givetAntal + (st.givetAntal === 1 ? ' gave' : ' gaver') + '</b></div></div></div>' +
      '</div>';

    var optjent = '<section class="block"><h2 class="block-title">Optjent pr. måned</h2>' +
      (mRows.length ? '<div class="card list">' + mRows.map(function (m) {
        return '<div class="row month-row"><div class="month-name"><b>' + esc(maanedLabel(m.maaned)) + '</b></div>' +
          '<div class="row-main"><div class="bar"><i style="width:' + ((m.total / maxM) * 100).toFixed(0) + '%"></i></div>' +
          '<div class="top3">' + Object.keys(m.kilder).map(function (k) { return '<span>' + esc(k) + ' <b class="num">' + wc(m.kilder[k]) + '</b></span>'; }).join('') + '</div></div>' +
          '<div class="row-price num plus">+' + wc(m.total) + '</div></div>';
      }).join('') + '</div>' : '<div class="card empty">Intet optjent endnu.</div>') + '</section>';

    var bestillinger = '<section class="block"><h2 class="block-title">Mine bestillinger</h2>' +
      (S.bestillinger.length ? '<div class="card list">' + S.bestillinger.map(function (b) {
        var tekst = b.fra === me.initialer
          ? (b.til !== b.fra ? b.vare + ' til ' + b.tilNavn : b.vare)
          : b.vare + ' fra ' + b.fraNavn;
        var b2 = b.fra === me.initialer ? -b.pris : 0;
        return '<div class="row slim"><div class="row-main"><b>' + esc(tekst) + '</b><small class="faint" style="display:block">' + dato(b.tid) + '</small></div>' +
          '<span class="tag ' + esc(b.status) + '">' + esc(cap(b.status)) + '</span>' +
          '<div class="row-price num" style="justify-content:flex-end">' + (b2 ? beloebCell(b2) : '<span class="zero">Gave</span>') + '</div></div>';
      }).join('') + '</div>' : '<div class="card empty">Intet bestilt endnu.</div>') + '</section>';

    var filtre = { alle: 'Alle', optjent: 'Optjent', koeb: 'Køb', gave: 'Gaver', projekt: 'Projekter', andet: 'Andet' };
    var match = {
      alle: function () { return true; },
      optjent: function (p) { return p.type === 'optjent'; },
      koeb: function (p) { return p.type === 'koeb'; },
      gave: function (p) { return p.type === 'gave' || p.type === 'gave_modtaget'; },
      projekt: function (p) { return p.type === 'projekt'; },
      andet: function (p) { return p.type === 'refusion' || p.type === 'justering'; }
    }[ui.profilFilter] || function () { return true; };
    var rows = S.historik.filter(match);

    var historik = '<section class="block"><div class="block-head"><h2 class="block-title">Alle bevægelser</h2><div class="chips" style="margin-left:auto">' +
      Object.keys(filtre).map(function (k) { return '<button class="chip' + (ui.profilFilter === k ? ' on' : '') + '" data-act="pfilter" data-f="' + k + '">' + filtre[k] + '</button>'; }).join('') +
      '</div></div><section class="card">' +
      (rows.length ? '<div class="table-wrap"><table><thead><tr><th>Dato</th><th>Type</th><th>Tekst</th><th class="r">Beløb</th></tr></thead><tbody>' +
        rows.map(function (p) {
          return '<tr><td class="faint">' + dato(p.tid) + '</td><td><span class="tag">' + esc(TYPER[p.type] || p.type) + '</span></td><td>' + esc(p.tekst) + '</td><td class="r">' + beloebCell(p.beloeb) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">Intet at vise.</div>') +
      '<p class="disclaimer">Tallene kan ændre sig, hvis der bliver rettet fejl.</p></section></section>';

    return head + stats + optjent + bestillinger + historik;
  }

  function statBox(label, val, sub) {
    return '<div class="card stat"><div class="eyebrow">' + label + '</div><div class="val num">' + val + '</div>' + (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div>';
  }

  // ---------- Admin-sider ----------

  function adminHead(titel, knapper) {
    return '<div class="page-head"><div><div class="eyebrow">Admin</div><h1>' + titel + '</h1></div><div class="chips">' + (knapper || '') + '</div></div>';
  }

  function pageRegler() {
    return adminHead('Regler') +
      '<div class="rules">' + S.grupper.map(function (g) {
        var r = S.regler.filter(function (x) { return x.gruppe === g; });
        return '<section class="card"><div class="card-head" style="margin-bottom:10px"><h2 class="card-title">' + esc(g) + '</h2></div>' +
          (r.length ? r.map(function (x) { return '<div class="rule"><span>' + esc(x.kildeNavn) + '</span><b>' + esc(x.tekst || x.sats) + '</b></div>'; }).join('') : '<div class="empty">Ingen regler endnu.</div>') +
          '</section>';
      }).join('') + '</div>';
  }

  function pageAdminBestillinger() {
    var filtre = { ny: 'Nye', udleveret: 'Udleveret', annulleret: 'Annulleret', alle: 'Alle' };
    var rows = A.bestillinger.filter(function (b) { return ui.bestFilter === 'alle' || b.status === ui.bestFilter; });
    return adminHead('Bestillinger') +
      '<section class="card"><div class="card-head"><div class="chips">' +
      Object.keys(filtre).map(function (k) {
        var n = k === 'alle' ? A.bestillinger.length : A.bestillinger.filter(function (b) { return b.status === k; }).length;
        return '<button class="chip' + (ui.bestFilter === k ? ' on' : '') + '" data-act="bfilter" data-f="' + k + '">' + filtre[k] + ' · ' + n + '</button>';
      }).join('') + '</div></div>' +
      (rows.length ? '<div class="table-wrap"><table><thead><tr><th>Tid</th><th>Fra</th><th>Til</th><th>Vare</th><th class="r">Pris</th><th>Status</th><th></th></tr></thead><tbody>' +
        rows.map(function (b) {
          var acts = '';
          if (b.status === 'ny') acts = '<button class="btn primary sm" data-act="bstatus" data-id="' + esc(b.id) + '" data-s="udleveret">Udleveret</button><button class="btn danger sm" data-act="bstatus" data-id="' + esc(b.id) + '" data-s="annulleret">Annullér</button>';
          else if (b.status === 'udleveret') acts = '<button class="btn sm" data-act="bstatus" data-id="' + esc(b.id) + '" data-s="ny">Fortryd</button><button class="btn danger sm" data-act="bstatus" data-id="' + esc(b.id) + '" data-s="annulleret">Annullér</button>';
          return '<tr><td class="faint">' + dato(b.tid) + '</td><td>' + esc(b.fraNavn) + '</td><td>' + (b.til !== b.fra ? '🎁 ' + esc(b.tilNavn) : '<span class="faint">—</span>') + '</td><td><b>' + esc(b.vare) + '</b></td><td class="r num">' + wc(b.pris) + '</td><td><span class="tag ' + esc(b.status) + '">' + esc(cap(b.status)) + '</span></td><td><div class="row-acts">' + acts + '</div></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">Ingen bestillinger.</div>') +
      '</section>';
  }

  function pageAdminOpgoerelse() {
    var rows = A.opgoerelse;
    var nuKey = S.nu.slice(0, 7);
    var denne = rows.filter(function (o) { return o.maaned === nuKey; })[0];
    return adminHead('Opgørelse') +
      '<div class="stat-grid">' +
      statBox('Brugt i ' + MAANEDER[Number(nuKey.slice(5)) - 1], kr(denne ? denne.kr : 0), denne ? denne.antal + ' bestillinger' + (denne.aabne ? ' · ' + denne.aabne + ' ikke udleveret' : '') : 'Ingen bestillinger') +
      statBox('Brugt i alt', kr(rows.reduce(function (s, o) { return s + o.kr; }, 0))) +
      '</div>' +
      '<section class="card"><div class="card-head"><h2 class="card-title">Pr. måned</h2></div>' +
      (rows.length ? '<div class="table-wrap"><table><thead><tr><th>Måned</th><th>Varer</th><th class="r">Bestillinger</th><th class="r">Webcoins</th><th class="r">At trække</th></tr></thead><tbody>' +
        rows.map(function (o) {
          return '<tr><td><b>' + esc(maanedLabel(o.maaned)) + '</b>' + (o.aabne ? ' <span class="tag ny">' + o.aabne + ' ikke udleveret</span>' : '') + '</td>' +
            '<td class="muted" style="font-size:13px">' + o.varer.map(function (v) { return esc(v.antal + '× ' + v.navn); }).join(', ') + '</td>' +
            '<td class="r num">' + o.antal + '</td><td class="r num">' + wc(o.wc) + '</td><td class="r num"><b>' + kr(o.kr) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">Ingen bestillinger endnu.</div>') +
      '</section>';
  }

  function pageAdminBrugere() {
    return adminHead('Brugere', '<button class="btn primary" data-act="ny-bruger">Tilføj bruger</button>') +
      '<section class="card"><div class="card-head"><input class="input search" placeholder="Søg navn, initialer, mail" data-search="brugere"></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Navn</th><th>Init.</th><th>Gruppe</th><th>Mail</th><th class="r">Saldo</th><th class="r">Optjent (md.)</th><th></th></tr></thead><tbody>' +
      A.brugere.map(function (u) {
        var q = (u.navn + ' ' + u.initialer + ' ' + u.email + ' ' + u.gruppe).toLowerCase();
        return '<tr data-q="' + esc(q) + '"' + (u.aktiv ? '' : ' style="opacity:.5"') + '><td><b>' + esc(u.navn) + '</b>' + (u.aktiv ? '' : ' <span class="tag">Inaktiv</span>') + '</td><td>' + esc(u.initialer) + '</td><td>' + (u.gruppe ? esc(u.gruppe) : '<span class="tag ny">Ingen gruppe</span>') + '</td><td class="faint">' + esc(u.email) + '</td><td class="r num"><b>' + wc(u.saldo) + '</b></td><td class="r num">' + wc(u.optjentMaaned) + '</td>' +
          '<td><div class="row-acts"><button class="btn sm" data-act="ret-bruger" data-email="' + esc(u.email) + '">Rediger</button><button class="btn sm" data-act="juster" data-ini="' + esc(u.initialer) + '">Justér</button></div></td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function pageAdminSortiment() {
    return adminHead('Sortiment') +
      '<div class="grid-2 top0"><section class="card"><div class="card-head"><h2 class="card-title">Menu</h2><button class="btn primary sm" data-act="ny-vare">Ny vare</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th></th><th>Navn</th><th class="r">Pris</th><th class="r">Kostpris</th><th>Status</th><th></th></tr></thead><tbody>' +
      A.menu.map(function (v) {
        return '<tr' + (v.aktiv ? '' : ' style="opacity:.5"') + '><td style="font-size:22px">' + esc(v.ikon) + '</td><td><b>' + esc(v.navn) + '</b></td><td class="r num">' + wc(v.pris) + '</td><td class="r num">' + (v.kostpris ? kr(v.kostpris) : '<span class="tag ny">Mangler</span>') + '</td><td>' + (v.aktiv ? '<span class="tag udleveret">Aktiv</span>' : '<span class="tag">Skjult</span>') + '</td><td><div class="row-acts"><button class="btn sm" data-act="ret-vare" data-id="' + esc(v.id) + '">Rediger</button></div></td></tr>';
      }).join('') + '</tbody></table></div></section>' +
      '<section class="card"><div class="card-head"><h2 class="card-title">Projekter</h2><button class="btn primary sm" data-act="nyt-projekt">Nyt projekt</button></div>' +
      (A.projekter.length ? A.projekter.map(function (p) {
        var pp = p.maal > 0 ? Math.min(100, (p.indsamlet / p.maal) * 100) : 0;
        return '<div class="proj-row"' + (p.aaben ? '' : ' style="opacity:.55"') + '><div class="proj-top"><span class="ico">' + esc(p.ikon || '🎯') + '</span><div class="t"><b>' + esc(p.navn) + '</b><small>' + (p.aaben ? 'Åben' : 'Lukket') + '</small></div><button class="btn sm" data-act="ret-projekt" data-id="' + esc(p.id) + '">Rediger</button></div>' +
          '<div class="bar"><i style="width:' + pp.toFixed(0) + '%"></i></div><div class="meta num"><span>' + wc(p.indsamlet) + '</span><span>' + (p.maal ? 'mål ' + wc(p.maal) : '') + '</span></div></div>';
      }).join('') : '<div class="empty">Ingen projekter.</div>') +
      '</section></div>';
  }

  function pageAdminPosteringer() {
    var typer = ['alle'].concat(Object.keys(TYPER));
    var rows = A.posteringer.filter(function (p) {
      return (ui.postType === 'alle' || p.type === ui.postType) && (!ui.postPerson || p.initialer === ui.postPerson);
    });
    var vist = rows.slice(0, 400);
    var sum = rows.reduce(function (s, p) { return s + p.beloeb; }, 0);
    return adminHead('Posteringer', '<button class="btn" data-act="sync">' + ico('sync') + 'Hent optjening nu</button>') +
      '<section class="card"><div class="card-head"><div class="chips">' +
      typer.map(function (t) { return '<button class="chip' + (ui.postType === t ? ' on' : '') + '" data-act="ptype" data-f="' + t + '">' + (t === 'alle' ? 'Alle' : TYPER[t]) + '</button>'; }).join('') +
      '</div><select class="input search" data-act="pperson"><option value="">Alle personer</option>' +
      A.brugere.map(function (u) { return '<option value="' + esc(u.initialer) + '"' + (ui.postPerson === u.initialer ? ' selected' : '') + '>' + esc(u.navn) + ' (' + esc(u.initialer) + ')</option>'; }).join('') +
      '</select></div>' +
      '<div class="muted num" style="font-size:13px;margin-bottom:8px">' + rows.length + ' posteringer · sum ' + wc(sum) + (rows.length > vist.length ? ' · viser de nyeste ' + vist.length : '') + '</div>' +
      (vist.length ? '<div class="table-wrap"><table><thead><tr><th>Tid</th><th>Person</th><th>Type</th><th>Tekst</th><th class="r">Beløb</th></tr></thead><tbody>' +
        vist.map(function (p) {
          return '<tr><td class="faint">' + dato(p.tid) + '</td><td>' + esc(p.navn) + '</td><td><span class="tag">' + esc(TYPER[p.type] || p.type) + '</span></td><td>' + esc(p.tekst) + '</td><td class="r">' + beloebCell(p.beloeb) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">Ingen posteringer.</div>') +
      '</section>';
  }

  // ---------- Modaler ----------

  function openModal(html) {
    modalRoot.innerHTML = '<div class="modal-bg" data-act="modal-bg"><div class="modal" role="dialog" aria-modal="true">' + html + '</div></div>';
    var f = modalRoot.querySelector('input:not([type=checkbox]):not([type=hidden]), select');
    if (f) f.focus();
  }
  function closeModal() { modalRoot.innerHTML = ''; }

  function busy(btn, on) {
    if (!btn) return;
    btn.disabled = on;
    if (on) { btn.dataset.txt = btn.innerHTML; btn.innerHTML = '<span class="spinner sm"></span>'; }
    else if (btn.dataset.txt) btn.innerHTML = btn.dataset.txt;
  }

  function submit(btn, action, data, ok, okTekst) {
    busy(btn, true);
    return api(action, data).then(function (res) {
      closeModal();
      if (ok) toast(ok, okTekst);
      return refresh().then(function () { return res; });
    }).catch(function (e) {
      busy(btn, false);
      if (e.code !== 'TOKEN_EXPIRED' && e.code !== 'NOT_REGISTERED') toast('Det gik ikke', e.message, true);
    });
  }

  var koebState = null;
  function openKoeb(vareId, gave) {
    var v = S.menu.filter(function (x) { return x.id === vareId; })[0];
    if (!v) return;
    koebState = { vare: v, gave: gave, til: '' };
    renderKoeb();
  }
  function renderKoeb() {
    var k = koebState, v = k.vare;
    var efter = S.stats.saldo - v.pris;
    var kollegaer = S.kolleger.map(function (u) {
      return '<option value="' + esc(u.initialer) + '"' + (k.til === u.initialer ? ' selected' : '') + '>' + esc(u.navn) + ' · ' + esc(u.gruppe) + '</option>';
    }).join('');
    openModal('<h2><span class="ico">' + esc(v.ikon || '🛍️') + '</span>' + esc(v.navn) + '</h2>' +
      '<div class="seg"><button class="' + (k.gave ? '' : 'on') + '" data-act="koeb-mode" data-g="0">Til mig</button><button class="' + (k.gave ? 'on' : '') + '" data-act="koeb-mode" data-g="1">Giv til kollega</button></div>' +
      (k.gave ? '<div class="field"><label for="koeb-til">Kollega</label><select class="input" id="koeb-til" data-act="koeb-til"><option value="">Vælg …</option>' + kollegaer + '</select></div>' : '') +
      '<div class="sum"><span class="muted">Pris</span><b class="num">' + wc(v.pris) + '</b></div>' +
      '<div class="sum"><span class="muted">Saldo efter</span><b class="num ' + (efter < 0 ? 'minus' : '') + '">' + wc(efter) + '</b></div>' +
      '<p class="note" style="margin:6px 0 0">Personlig levering, så der kan være lidt ventetid.</p>' +
      '<div class="modal-acts"><button class="btn grow" data-act="close">Annullér</button><button class="btn primary grow" data-act="koeb-ok"' + (efter < 0 || (k.gave && !k.til) ? ' disabled' : '') + '>' + (k.gave ? 'Giv gave' : 'Bestil') + '</button></div>');
  }

  var indskydState = null;
  function openIndskyd(id) {
    var p = S.projekter.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    indskydState = { p: p };
    var forslag = [10, 25, 50, 100].filter(function (n) { return n <= S.stats.saldo; });
    openModal('<h2><span class="ico">' + esc(p.ikon || '🎯') + '</span>' + esc(p.navn) + '</h2>' +
      '<div class="field"><label for="ind-beloeb">Antal Webcoins</label><input class="input num" id="ind-beloeb" type="number" min="1" max="' + Math.max(0, S.stats.saldo) + '" inputmode="numeric" placeholder="0"></div>' +
      (forslag.length ? '<div class="chips" style="margin-bottom:14px">' + forslag.map(function (n) { return '<button class="chip" data-act="ind-forslag" data-n="' + n + '">' + n + '</button>'; }).join('') + '</div>' : '') +
      '<div class="sum"><span class="muted">Din saldo</span><b class="num">' + wc(S.stats.saldo) + '</b></div>' +
      '<div class="modal-acts"><button class="btn grow" data-act="close">Annullér</button><button class="btn primary grow" data-act="ind-ok">Indskyd</button></div>');
  }

  function openBruger(email) {
    var u = email ? A.brugere.filter(function (x) { return x.email === email; })[0] : { email: '', initialer: '', navn: '', gruppe: '', aktiv: true };
    openModal('<h2>' + (email ? 'Rediger bruger' : 'Ny bruger') + '</h2>' +
      '<input type="hidden" id="b-orig" value="' + esc(email || '') + '">' +
      '<div class="field"><label for="b-navn">Navn</label><input class="input" id="b-navn" value="' + esc(u.navn) + '"></div>' +
      '<div class="row-2"><div class="field"><label for="b-ini">Initialer</label><input class="input" id="b-ini" maxlength="5" value="' + esc(u.initialer) + '" style="text-transform:uppercase"></div>' +
      '<div class="field"><label for="b-gruppe">Gruppe</label><select class="input" id="b-gruppe"><option value="">Ingen</option>' + A.grupper.map(function (g) { return '<option' + (u.gruppe === g ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label for="b-email">Google-mail</label><input class="input" id="b-email" type="email" value="' + esc(u.email) + '" placeholder="navn@bestone.dk"></div>' +
      '<label class="check"><input type="checkbox" id="b-aktiv"' + (u.aktiv ? ' checked' : '') + '> Aktiv</label>' +
      '<div class="modal-acts"><button class="btn grow" data-act="close">Annullér</button><button class="btn primary grow" data-act="bruger-ok">Gem</button></div>');
  }

  function openJuster(ini) {
    var u = A.brugere.filter(function (x) { return x.initialer === ini; })[0];
    if (!u) return;
    openModal('<h2>Justér saldo</h2><p class="muted" style="margin:-8px 0 16px">' + esc(u.navn) + ' · saldo ' + wc(u.saldo) + '</p>' +
      '<input type="hidden" id="j-ini" value="' + esc(ini) + '">' +
      '<div class="field"><label for="j-beloeb">Antal Webcoins (minus for at trække fra)</label><input class="input num" id="j-beloeb" type="number" inputmode="numeric" placeholder="fx 50 eller -20"></div>' +
      '<div class="field"><label for="j-tekst">Tekst</label><input class="input" id="j-tekst" placeholder="fx Bonus for ekstra indsats"></div>' +
      '<div class="modal-acts"><button class="btn grow" data-act="close">Annullér</button><button class="btn primary grow" data-act="juster-ok">Gem</button></div>');
  }

  function openVare(id) {
    var v = id ? A.menu.filter(function (x) { return x.id === id; })[0] : { id: '', navn: '', ikon: '', pris: 10, kostpris: 0, aktiv: true };
    openModal('<h2>' + (id ? 'Rediger vare' : 'Ny vare') + '</h2><input type="hidden" id="v-id" value="' + esc(v.id) + '">' +
      '<div class="row-2"><div class="field"><label for="v-navn">Navn</label><input class="input" id="v-navn" value="' + esc(v.navn) + '"></div>' +
      '<div class="field"><label for="v-ikon">Ikon (emoji)</label><input class="input" id="v-ikon" value="' + esc(v.ikon) + '" maxlength="4"></div></div>' +
      '<div class="field"><label for="v-billede">Billede (URL eller sti, valgfrit)</label><input class="input" id="v-billede" value="' + esc(v.billede || '') + '" placeholder="assets/varer/monster.jpg"></div>' +
      '<div class="row-2"><div class="field"><label for="v-pris">Pris (Webcoins)</label><input class="input num" id="v-pris" type="number" min="0" value="' + esc(v.pris) + '"></div>' +
      '<div class="field"><label for="v-kost">Kostpris (kr)</label><input class="input num" id="v-kost" type="number" min="0" step="0.5" value="' + esc(v.kostpris || '') + '"></div></div>' +
      '<label class="check"><input type="checkbox" id="v-aktiv"' + (v.aktiv ? ' checked' : '') + '> Vises i menuen</label>' +
      '<div class="modal-acts"><button class="btn grow" data-act="close">Annullér</button><button class="btn primary grow" data-act="vare-ok">Gem</button></div>');
  }

  function openProjekt(id) {
    var p = id ? A.projekter.filter(function (x) { return x.id === id; })[0] : { id: '', navn: '', ikon: '', maal: 1000, aaben: true };
    openModal('<h2>' + (id ? 'Rediger projekt' : 'Nyt projekt') + '</h2><input type="hidden" id="p-id" value="' + esc(p.id) + '">' +
      '<div class="row-2"><div class="field"><label for="p-navn">Navn</label><input class="input" id="p-navn" value="' + esc(p.navn) + '"></div>' +
      '<div class="field"><label for="p-ikon">Ikon (emoji)</label><input class="input" id="p-ikon" value="' + esc(p.ikon) + '" maxlength="4"></div></div>' +
      '<div class="field"><label for="p-maal">Mål (Webcoins)</label><input class="input num" id="p-maal" type="number" min="0" value="' + esc(p.maal) + '"></div>' +
      '<label class="check"><input type="checkbox" id="p-aaben"' + (p.aaben ? ' checked' : '') + '> Åben for indskud</label>' +
      '<div class="modal-acts"><button class="btn grow" data-act="close">Annullér</button><button class="btn primary grow" data-act="projekt-ok">Gem</button></div>');
  }

  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function checked(id) { var el = document.getElementById(id); return !!(el && el.checked); }

  // ---------- Events ----------

  document.addEventListener('click', function (ev) {
    // Luk regel-popover ved klik udenfor
    document.querySelectorAll('.info.open').forEach(function (el) { if (!el.contains(ev.target)) el.classList.remove('open'); });

    var t = ev.target.closest('[data-act]');
    if (!t) return;
    var act = t.dataset.act;
    if (act === 'modal-bg' && ev.target !== t) return;
    if (t.tagName === 'SELECT') return;

    switch (act) {
      case 'info': t.classList.toggle('open'); break;
      case 'demo-login':
        session = { email: t.dataset.email };
        store('webshoppen-session', JSON.stringify(session));
        location.hash = '#/';
        start();
        break;
      case 'demo-reset': window.Mock.nulstil(); break;
      case 'logout': logout(); break;
      case 'reload': location.reload(); break;
      case 'theme': {
        var cur = document.documentElement.getAttribute('data-theme') === 'dark';
        if (cur) document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', 'dark');
        store('webshoppen-tema', cur ? null : 'dark');
        break;
      }
      case 'open-nav': document.getElementById('shell').classList.add('open'); break;
      case 'close-nav': document.getElementById('shell').classList.remove('open'); break;
      case 'close': case 'modal-bg': closeModal(); break;

      case 'koeb': openKoeb(t.dataset.id, false); break;
      case 'giv': openKoeb(t.dataset.id, true); break;
      case 'koeb-mode': koebState.gave = t.dataset.g === '1'; renderKoeb(); break;
      case 'koeb-ok': {
        var k = koebState;
        submit(t, 'bestil', { vareId: k.vare.id, til: k.gave ? k.til : '' },
          k.gave ? 'Gaven er sendt 🎁' : k.vare.navn + ' er bestilt', 'Personlig levering, så der kan være lidt ventetid.');
        break;
      }
      case 'indskyd': openIndskyd(t.dataset.id); break;
      case 'ind-forslag': document.getElementById('ind-beloeb').value = t.dataset.n; break;
      case 'ind-ok':
        submit(t, 'indskyd', { projektId: indskydState.p.id, beloeb: val('ind-beloeb') }, 'Tak! Dine Webcoins er lagt i ' + indskydState.p.navn);
        break;

      case 'pfilter': ui.profilFilter = t.dataset.f; render(); break;
      case 'bfilter': ui.bestFilter = t.dataset.f; render(); break;
      case 'ptype': ui.postType = t.dataset.f; render(); break;
      case 'bstatus':
        busy(t, true);
        api('admin_bestilling', { id: t.dataset.id, status: t.dataset.s }).then(refresh).catch(function (e) { busy(t, false); toast('Det gik ikke', e.message, true); });
        break;
      case 'ny-bruger': openBruger(''); break;
      case 'ret-bruger': openBruger(t.dataset.email); break;
      case 'bruger-ok':
        submit(t, 'admin_bruger', { origEmail: val('b-orig'), navn: val('b-navn'), initialer: val('b-ini'), gruppe: val('b-gruppe'), email: val('b-email'), aktiv: checked('b-aktiv') }, 'Bruger gemt');
        break;
      case 'juster': openJuster(t.dataset.ini); break;
      case 'juster-ok':
        submit(t, 'admin_justering', { initialer: val('j-ini'), beloeb: val('j-beloeb'), tekst: val('j-tekst') }, 'Saldo justeret');
        break;
      case 'ny-vare': openVare(''); break;
      case 'ret-vare': openVare(t.dataset.id); break;
      case 'vare-ok':
        submit(t, 'admin_vare', { id: val('v-id'), navn: val('v-navn'), ikon: val('v-ikon'), billede: val('v-billede'), pris: val('v-pris'), kostpris: val('v-kost'), aktiv: checked('v-aktiv') }, 'Vare gemt');
        break;
      case 'nyt-projekt': openProjekt(''); break;
      case 'ret-projekt': openProjekt(t.dataset.id); break;
      case 'projekt-ok':
        submit(t, 'admin_projekt', { id: val('p-id'), navn: val('p-navn'), ikon: val('p-ikon'), maal: val('p-maal'), aaben: checked('p-aaben') }, 'Projekt gemt');
        break;
      case 'sync':
        busy(t, true);
        api('admin_sync').then(function (r) {
          toast('Optjening hentet', (r ? r.nye + ' nye · ' + r.rettede + ' rettede' : ''));
          return refresh();
        }).catch(function (e) { busy(t, false); toast('Det gik ikke', e.message, true); });
        break;
    }
  });

  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.dataset.act === 'koeb-til') { koebState.til = t.value; renderKoeb(); }
    if (t.dataset.act === 'pperson') { ui.postPerson = t.value; render(); }
  });

  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.dataset.search) {
      var q = t.value.trim().toLowerCase();
      document.querySelectorAll('tr[data-q]').forEach(function (tr) {
        tr.style.display = !q || tr.dataset.q.indexOf(q) >= 0 ? '' : 'none';
      });
    }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      if (modalRoot.innerHTML) closeModal();
      document.querySelectorAll('.info.open').forEach(function (el) { el.classList.remove('open'); });
    }
    if (ev.key === 'Enter' && ev.target.closest && ev.target.closest('.modal') && ev.target.tagName === 'INPUT') {
      var ok = modalRoot.querySelector('.btn.primary:not([disabled])');
      if (ok) ok.click();
    }
  });

  window.addEventListener('hashchange', function () { window.scrollTo(0, 0); render(); });

  window.addEventListener('demo-notify', function (e) {
    toast('📣 Admin får besked', e.detail.emne);
  });

  // ---------- Start ----------

  try { session = JSON.parse(store('webshoppen-session') || 'null'); } catch (e) { session = null; }
  if (session && (DEMO ? session.email : session.token)) start(); else renderLogin();
})();
