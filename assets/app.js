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
  var ui = { profilFane: 'aktivitet', bestFilter: 'ny', postType: 'alle', postPerson: '' };

  var MAANEDER = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
  var TYPER = {
    optjent: 'Optjent', koeb: 'Køb', gave: 'Gave givet', gave_modtaget: 'Gave modtaget',
    projekt: 'Event', refusion: 'Refusion', justering: 'Justering',
    hjul: "Feelin' Lucky?", gevinst: 'Gevinst'
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
  // Best One-logoet (samme SVG som salgsdashboardet), farves med currentColor.
  // Best One-logo (SVG). Må kun vises i blå eller hvid – farven styres af CSS (.bo-logo).
  var LOGO_PATHS = ["M212.4,93.2h-64.6c1.3,4.6,3.9,8.1,7.6,10.6c3.8,2.5,8.5,3.7,14.2,3.7c4.3,0,8-0.6,11.1-1.8c3.1-1.2,6.3-3.2,9.4-5.9l16.4,17.1c-8.6,9.6-21.3,14.4-37.9,14.4c-10.4,0-19.5-2-27.4-5.9c-7.9-3.9-14-9.4-18.3-16.4c-4.3-7-6.5-14.9-6.5-23.8c0-8.7,2.1-16.6,6.3-23.5c4.2-6.9,10-12.4,17.5-16.3c7.4-3.9,15.8-5.9,25.1-5.9c8.9,0,16.9,1.8,24.1,5.5c7.2,3.7,12.9,9,17.1,15.9c4.2,6.9,6.3,15.2,6.3,24.7C212.9,85.7,212.7,88.3,212.4,93.2z M153.4,65.6c-3.2,2.7-5.3,6.5-6.2,11.2h36.4c-0.9-4.7-2.9-8.4-6.1-11.2c-3.2-2.7-7.2-4.1-12.1-4.1C160.6,61.5,156.6,62.9,153.4,65.6z", "M237.4,128.7c-7.2-1.7-13-3.9-17.4-6.6l9.3-21.3c4,2.5,8.9,4.5,14.4,6c5.6,1.5,11.1,2.2,16.6,2.2c5,0,8.6-0.5,10.7-1.6c2.1-1,3.2-2.5,3.2-4.5s-1.3-3.4-3.9-4.2c-2.6-0.8-6.6-1.6-12.2-2.4c-7.1-0.9-13.1-2-18.1-3.4c-5-1.4-9.3-4-12.9-7.9c-3.6-3.8-5.4-9.2-5.4-16.1c0-5.7,1.7-10.7,5.1-15.2c3.4-4.4,8.3-7.9,14.8-10.5c6.5-2.6,14.3-3.9,23.4-3.9c6.5,0,12.8,0.7,19.2,2c6.3,1.3,11.6,3.2,15.9,5.6l-9.3,21.2c-7.9-4.4-16.4-6.6-25.6-6.6c-4.9,0-8.5,0.6-10.8,1.7c-2.3,1.1-3.4,2.7-3.4,4.5c0,2.1,1.3,3.5,3.8,4.3c2.5,0.8,6.7,1.7,12.5,2.5c7.3,1.1,13.4,2.4,18.2,3.8c4.8,1.4,9,4,12.5,7.8c3.6,3.8,5.3,9,5.3,15.8c0,5.6-1.7,10.6-5.1,15c-3.4,4.4-8.4,7.9-15,10.4c-6.6,2.5-14.6,3.8-23.9,3.8C251.9,131.2,244.6,130.4,237.4,128.7z", "M310.4,44.2V21h31.2v23.1h20.3v23.3h-20.3V97c0,3.2,0.8,5.7,2.5,7.5c1.7,1.8,4,2.7,6.8,2.7c3.6,0,6.8-0.9,9.5-2.8l7.7,21.8c-2.6,1.6-5.8,2.9-9.6,3.8c-3.8,0.9-7.8,1.3-12.1,1.3c-11.6,0-20.5-2.8-26.7-8.5c-6.2-5.7-9.3-14.2-9.3-25.4V67.4V44.2z", "M418.3,123.5c-9.7-5.1-17.3-12.2-22.8-21.3c-5.5-9.1-8.3-19.3-8.3-30.7c0-11.4,2.8-21.6,8.3-30.7c5.5-9.1,13.1-16.2,22.8-21.3c9.7-5.1,20.6-7.7,32.7-7.7s23,2.6,32.7,7.7c9.7,5.1,17.3,12.2,22.8,21.3c5.5,9.1,8.3,19.3,8.3,30.7c0,11.4-2.8,21.6-8.3,30.7c-5.5,9.1-13.1,16.2-22.8,21.3c-9.7,5.1-20.6,7.7-32.7,7.7S428,128.7,418.3,123.5z M466.8,100.2c4.7-2.7,8.4-6.6,11.2-11.6c2.7-5,4.1-10.7,4.1-17.1c0-6.4-1.4-12.2-4.1-17.1c-2.7-5-6.5-8.8-11.2-11.6c-4.7-2.7-10-4.1-15.7-4.1c-5.8,0-11,1.4-15.7,4.1c-4.7,2.7-8.4,6.6-11.2,11.6c-2.7,5-4.1,10.7-4.1,17.1c0,6.5,1.4,12.2,4.1,17.1c2.7,5,6.5,8.8,11.2,11.6c4.7,2.7,9.9,4.1,15.7,4.1C456.8,104.3,462.1,103,466.8,100.2z", "M606.5,50.7c6.7,6.6,10.1,16.5,10.1,29.7v50.8h-31.2V85.5c0-12.1-4.9-18.2-14.6-18.2c-5.4,0-9.7,1.8-12.9,5.2c-3.2,3.5-4.8,8.7-4.8,15.7v43h-31.2V42.3h29.7V52c3.5-3.6,7.7-6.4,12.5-8.3c4.8-1.9,10.1-2.9,15.7-2.9C590.9,40.9,599.8,44.2,606.5,50.7z", "M719.6,93.2H655c1.3,4.6,3.9,8.1,7.6,10.6c3.8,2.5,8.5,3.7,14.2,3.7c4.3,0,8-0.6,11.1-1.8c3.1-1.2,6.3-3.2,9.4-5.9l16.4,17.1c-8.6,9.6-21.3,14.4-37.9,14.4c-10.4,0-19.5-2-27.4-5.9c-7.9-3.9-14-9.4-18.3-16.4c-4.3-7-6.5-14.9-6.5-23.8c0-8.7,2.1-16.6,6.3-23.5c4.2-6.9,10-12.4,17.5-16.3c7.4-3.9,15.8-5.9,25.1-5.9c8.9,0,16.9,1.8,24.1,5.5c7.2,3.7,12.9,9,17.1,15.9c4.2,6.9,6.3,15.2,6.3,24.7C720.1,85.7,719.9,88.3,719.6,93.2z M660.7,65.6c-3.2,2.7-5.3,6.5-6.2,11.2h36.4c-0.9-4.7-2.9-8.4-6.2-11.2c-3.2-2.7-7.2-4.1-12.1-4.1C667.9,61.5,663.9,62.9,660.7,65.6z", "M102.9,61c-4.3-7-10.3-12.4-18-16.3c-7.7-3.9-16.4-5.9-26.1-5.9c-6.8,0-13,1-18.8,2.9V7.2H8.3l0.1,74.9h0c0,0.9-0.1,1.8-0.1,2.8c0,8.9,2.2,16.9,6.5,23.9c4.3,7,10.4,12.5,18.1,16.5c7.7,4,16.3,5.9,25.9,5.9c9.7,0,18.4-2,26.1-5.9c7.7-4,13.7-9.5,18-16.5c4.3-7,6.4-15,6.4-23.9S107.2,68,102.9,61z M72.4,100.6c-3.5,3.8-8,5.7-13.5,5.7c-5.5,0-10-1.9-13.5-5.7c-3.5-3.8-5.3-9-5.3-15.8c0-6.6,1.8-11.8,5.3-15.5c3.5-3.7,8-5.6,13.5-5.6c5.5,0,10,1.9,13.5,5.6c3.5,3.7,5.3,8.9,5.3,15.5C77.6,91.6,75.9,96.8,72.4,100.6z"];
  function boLogo(cls) {
    return '<svg class="bo-logo ' + (cls || '') + '" viewBox="0 0 727 141" role="img" aria-label="Best One">' + LOGO_PATHS.map(function (d) { return '<path fill="currentColor" d="' + d + '"/>'; }).join('') + '</svg>';
  }
  // Best One "b"-mærket alene (samme glyf som i logoet) – til dekoration.
  function bMark(cls) {
    return '<svg class="b-mark ' + (cls || '') + '" viewBox="8 7 102 125" aria-hidden="true"><path fill="currentColor" d="' + LOGO_PATHS[6] + '"/></svg>';
  }
  function spark(vals) {
    var w = 170, h = 44, n = vals.length;
    var max = Math.max.apply(null, vals.concat([1]));
    var pts = vals.map(function (v, i) { return [i * (w / (n - 1)), h - 4 - (v / max) * (h - 12)]; });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var last = pts[pts.length - 1];
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + line + ' L' + w + ' ' + h + ' L0 ' + h + ' Z" fill="var(--brand-2)" opacity=".12"/>' +
      '<path d="' + line + '" fill="none" stroke="var(--brand-2)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4" fill="var(--brand)" stroke="var(--card)" stroke-width="1.5"/></svg>';
  }
  function logo() {
    return '<a class="brand" href="#/">' + boLogo() + '<span class="brand-sep"></span><span class="brand-name">Webshoppen</span></a>';
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
    star: '<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/>',
    down: '<path d="M17 7 7 17M7 9v8h8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    list: '<rect x="3" y="4" width="18" height="3" rx="1"/><rect x="3" y="10.5" width="18" height="3" rx="1"/><rect x="3" y="17" width="12" height="3" rx="1"/>',
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    logout: '<path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 8l4 4-4 4M19 12H9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    burger: '<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    fold: '<path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
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
        app.innerHTML = '<div class="center-screen"><div class="login-card">' + boLogo('logo-login') + '<h1>Hov</h1><p>' + esc(e.message) + '</p><button class="btn primary" data-act="reload">Prøv igen</button></div></div>';
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
      boLogo('logo-login') +
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
    'admin/brugere': { titel: 'Brugere', fn: pageAdminBrugere, admin: true },
    'admin/kollega': { titel: 'Månedens Webkollega', fn: pageAdminKollega, admin: true },
    'admin/regler': { titel: 'Regler', fn: pageRegler, admin: true },
    'admin/posteringer': { titel: 'Posteringer', fn: pageAdminPosteringer, admin: true }
  };

  function navLink(path, ikon, tekst, extra) {
    var on = route() === path ? ' class="on"' : '';
    return '<a href="#/' + path + '"' + on + ' title="' + esc(tekst) + '">' + (ikon ? ico(ikon) : '') + '<span>' + tekst + '</span>' + (extra || '') + '</a>';
  }

  function render() {
    if (!S) return;
    var r = route();
    var side = SIDER[r] || SIDER[''];
    if (side.admin && !S.me.admin) side = SIDER[''];
    // Admin deltager ikke: overblikket er et admin-overblik i stedet for medarbejdernes forside
    if (side === SIDER[''] && S.me.admin) side = { titel: 'Overblik', fn: pageAdminOverblik, admin: true };
    if (side === SIDER.profil && !S.me.initialer) side = SIDER[''];
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
      '<button class="icon-btn" data-act="theme" title="Skift tema" aria-label="Skift tema">' + ico('sun') + '</button>' +
      '<div class="me-menu"><button class="me-btn" data-act="me-menu" aria-haspopup="true" title="' + esc(me.navn) + '">' + avatar(me) + '</button>' +
      '<div class="me-drop" role="menu"><div class="me-who"><b>' + esc(me.navn) + '</b><small>' + esc([me.gruppe, me.initialer].filter(Boolean).join(' · ')) + '</small></div>' +
      '<button data-act="logout" role="menuitem">' + ico('logout') + 'Log ud</button></div></div>' +
      '</div></div></header>' +
      '<main class="main"><div class="wrap">' + indhold + '</div></main>';
  }

  // Sidepanelet kan foldes sammen til kun ikoner. Valget huskes i browseren.
  function sideFoldet() { try { return localStorage.getItem('ws-side-foldet') === '1'; } catch (e) { return false; } }

  // Admin: sidepanel med admin-sider.
  function adminShell(indhold) {
    var me = S.me;
    var nyeBest = A ? A.bestillinger.filter(function (b) { return b.status === 'ny'; }).length : 0;
    return '<div class="shell' + (sideFoldet() ? ' foldet' : '') + '" id="shell">' +
      '<div class="scrim" data-act="close-nav"></div>' +
      '<aside class="side">' +
      '<div class="side-head">' + logo() + '<button class="icon-btn side-fold" data-act="fold-side" title="' + (sideFoldet() ? 'Fold ud' : 'Fold sammen') + '" aria-label="Fold sidepanelet">' + ico('fold') + '</button></div>' +
      '<nav class="nav">' + navLink('', 'home', 'Overblik') +
      navLink('admin/bestillinger', 'cart', 'Bestillinger', nyeBest ? '<span class="badge">' + nyeBest + '</span>' : '') +
      navLink('admin/brugere', 'users', 'Brugere') +
      navLink('admin/kollega', 'star', 'Månedens Webkollega') +
      navLink('admin/regler', 'book', 'Regler') +
      navLink('admin/posteringer', 'list', 'Posteringer') + '</nav>' +
      '<div class="side-foot">' +
      '<div class="me">' + avatar(me) + '<div class="who"><b>' + esc(fornavn(me.navn)) + '</b><small>Admin</small></div>' +
      '<button class="icon-btn" data-act="theme" title="Skift tema" aria-label="Skift tema">' + ico('sun') + '</button>' +
      '<button class="icon-btn" data-act="logout" title="Log ud" aria-label="Log ud">' + ico('logout') + '</button></div>' +
      '</div></aside>' +
      '<div class="shell-main">' +
      '<header class="top top-admin"><div class="top-in"><button class="icon-btn" data-act="open-nav" aria-label="Menu">' + ico('burger') + '</button>' + logo() + '</div></header>' +
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
      '<p>Du kan forudbestille. Den leveres, når shoppen åbner.</p>' +
      '<button class="btn primary grow" data-act="close">OK</button></div>');
  }

  // ---------- Sider ----------

  function mineRegler() {
    // Gruppens egne regler først, derefter dem for alle (Konkurrencer, Fælles mål)
    var r = S.regler.filter(function (x) { return x.gruppe === S.me.gruppe; }).concat(S.regler.filter(function (x) { return x.gruppe === 'Alle'; }));
    // Månedens Webkollega står øverst hos alle med denne måneds præmie
    return '<div class="rule"><span>Månedens Webkollega</span><b>' + mdkVaerdi() + '</b></div>' +
      r.map(function (x) { return '<div class="rule"><span>' + esc(x.navn) + '</span><b>' + regelVaerdi(x) + '</b></div>'; }).join('');
  }
  // Regelens værdi med mønten til sidst, fx "20 Webcoins 🪙"
  function mdkVaerdi() {
    var p = S.mdk && S.mdk.praemie;
    return p ? esc(p) + (/webcoin/i.test(p) ? ' ' + coin() : '') : 'Coming soon';
  }
  function regelVaerdi(x) {
    if (x.kilde === 'faelles_maal') return '<button class="rule-link" data-act="faelles-maal">' + esc(x.tekst || 'Se status') + '</button>';
    return esc(x.tekst || x.sats) + ' ' + coin();
  }

  function statusTag(b) {
    var forud = b.forud && b.status === 'ny';
    return '<span class="tag ' + esc(b.status) + '">' + (forud ? 'Forudbestilt' : esc(cap(b.status))) + '</span>';
  }

  // Projekter: kun nr. 1 vises ("Top contributor"); resten (top 10) ses ved hover på "Se resten"
  function topRaekke(t, i, me) {
    var med = ['🥇', '🥈', '🥉'][i] || (i + 1) + '.';
    return '<li class="' + (t.initialer === me.initialer ? 'mig' : '') + '"><span class="t3-med">' + med + '</span><span class="t3-navn">' + esc(t.navn) + '</span>' +
      '<span class="t3-beloeb num"><b>' + fmt(t.beloeb) + '</b> ' + enhed(t.beloeb) + '</span></li>';
  }
  function topDonator(p, me) {
    if (!p.top.length) return '<div class="top-don"><span class="top-don-titel">Top contributors</span><div class="faint" style="font-size:13px">Ingen bidrag endnu</div></div>';
    return '<div class="top-don"><span class="top-don-titel">Top contributors</span>' +
      '<ol class="top3-list">' + topRaekke(p.top[0], 0, me) + '</ol>' +
      (p.top.length > 1 ? '<span class="info top10" tabindex="0"><span class="se-resten">Se resten</span>' +
        '<span class="pop" role="tooltip"><b class="pop-title">Top 10 contributors</b><ol class="top3-list">' + p.top.map(function (t, i) { return topRaekke(t, i, me); }).join('') + '</ol></span></span>' : '') +
      '</div>';
  }

  function vareBillede(v) {
    if (v.billede) return '<span class="thumb"><img src="' + esc(v.billede) + '" alt="" loading="lazy"></span>';
    return '<span class="thumb">' + esc(v.ikon || '🛍️') + '</span>';
  }

  function pageOverblik() {
    var me = S.me, st = S.stats;
    var kanKoebe = !!me.initialer;
    var tb = S.teambudget;
    var shop = S.shop || { aaben: true };
    var lukket = !shop.aaben;

    // 1. Saldo + teambudget + regler
    var saldo = '<section class="saldo-card"><span class="saldo-deco" aria-hidden="true">' + bMark() + '</span>' +
      '<div class="saldo-top"><span class="hello">' + hilsen() + ', ' + esc(fornavn(me.navn)) + ' 👋</span>' +
      (me.gruppe ? '<span class="info"><button class="info-link" data-act="regler-boks"><span class="info-txt">Hvordan optjener jeg?</span><span class="info-btn">' + ico('info') + '</span></button>' +
        '<span class="pop" role="tooltip"><b class="pop-title">' + esc(me.gruppe) + '</b>' + mineRegler() + '</span></span>' : '') +
      '</div>' +
      (kanKoebe
        ? '<div class="saldo-big num">' + coin('coin-lg') + '<span>' + fmt(st.saldo) + '</span><small>' + enhed(st.saldo) + '</small></div>'
        : '<div class="saldo-big"><span style="font-size:40px">Admin</span></div><div class="saldo-sub">Du deltager ikke. Her ser du siden, som medarbejderne gør.</div>') +
      '</section>';

    var team = tb ? '<section class="card tb-card">' +
      '<div class="tb-head"><span class="eyebrow">Teambudget</span>' + (tb.saeson ? '<span class="tag">Sæson ' + esc(tb.saeson) + '</span>' : '') + '</div>' +
      '<div class="tb-big num">' + kr(tb.rest) + '</div>' +
      '<div class="tb-sub num">Brugt i sæsonen: <b class="brugt">' + kr(tb.brugt) + '</b></div></section>'
      : (me.admin ? '<section class="card tb-card"><div class="eyebrow">Teambudget</div><div class="empty">Ikke koblet på arket endnu.</div></section>' : '');

    var top = '<div class="row-top' + (team ? '' : ' solo') + '">' + saldo + team + '</div>';

    // 2. Bestil – liste i fuld bredde
    var menu = '<section class="block"><div class="block-head"><h2 class="block-title">Bestil</h2>' +
      (lukket ? '<span class="tag annulleret">Lukket' + (shop.tekst ? ' · ' + esc(shop.tekst) : '') + '</span>' : '') +
      '<span class="note">' + (lukket ? 'Forudbestil, så leveres det, når shoppen åbner.' : 'Personlig levering, forvent lidt ventetid.') + '</span></div>' +
      (S.menu.length ? '<div class="card list compact">' + S.menu.slice().sort(function (a, b) {
        // Billigst først; "Andet?" (kommer snart) altid til sidst
        return (a.snart - b.snart) || (a.pris - b.pris);
      }).map(function (v) {
        var raad = st.saldo >= v.pris && kanKoebe && !v.snart;
        if (v.snart) return forslagRaekke(vareBillede(v), v.navn, '', 'vare', kanKoebe);
        return '<div class="row">' + vareBillede(v) +
          '<div class="row-main"><b>' + esc(v.navn) + '</b></div>' +
          '<div class="row-price num">' + (v.snart ? '<span class="tag">Kommer snart</span>' : '<span class="amt">' + fmt(v.pris) + '</span><span class="unit">' + enhed(v.pris) + '</span>' + coin()) + '</div>' +
          '<div class="row-acts">' +
          '<button class="btn sm" data-act="giv" data-id="' + esc(v.id) + '"' + (raad && S.kolleger.length ? '' : ' disabled') + '>' + ico('gift') + 'Donér til en kollega</button>' +
          '<button class="btn primary sm" data-act="koeb" data-id="' + esc(v.id) + '"' + (raad ? '' : ' disabled') + '>' + (lukket ? 'Forudbestil' : 'Bestil') + '</button></div></div>';
      }).join('') + '</div>' : '<div class="card empty">Menuen er tom.</div>') +
      '</section>';

    // 3. Projekter – liste i fuld bredde med top 3
    var projekter = '<section class="block"><h2 class="block-title">Events</h2>' +
      (S.projekter.length ? '<div class="card list">' + S.projekter.slice().sort(function (a, b) {
        // Billigst mål først; projekter uden mål til sidst
        return ((a.maal || 1e9) - (b.maal || 1e9));
      }).map(function (p) {
        var pp = p.maal > 0 ? Math.min(100, (p.indsamlet / p.maal) * 100) : 0;
        return '<div class="row proj-item">' +
          '<span class="thumb">' + esc(p.ikon || '🎯') + '</span>' +
          '<div class="row-main"><b>' + esc(p.navn) + '</b>' +
          '<div class="bar bar-big' + (p.maal > 0 && p.indsamlet >= p.maal ? ' fuld' : '') + '"><i style="width:' + pp.toFixed(0) + '%"></i>' +
          '<span class="bar-label num"><span class="bar-amt">' + (p.maal
            ? '<b>' + fmt(p.indsamlet) + '</b> af ' + fmt(p.maal) + ' ' + enhed(p.maal) + coin()
            : '<b>' + fmt(p.indsamlet) + '</b> ' + enhed(p.indsamlet) + coin()) + '</span>' + (p.maal ? '<b>' + pp.toFixed(0) + ' %</b>' : '') + '</span></div>' +
          topDonator(p, me) + '</div>' +
          '<div class="proj-acts"><div class="donate">' + (p.maal > 0 && p.indsamlet >= p.maal
            ? '<button class="btn primary yehaw" data-act="yehaw">Yehaw! 🎉</button><span class="dit event">Event loading..</span>'
            : '<button class="btn primary" data-act="indskyd" data-id="' + esc(p.id) + '"' + (kanKoebe && st.saldo > 0 ? '' : ' disabled') + '>Donér</button>') +
          (p.mitBidrag ? '<span class="dit num">Dit bidrag<br>' + wc(p.mitBidrag) + '</span>' : '') + '</div></div></div>';
      }).join('') + forslagRaekke('<span class="thumb">💡</span>', 'Andet?', 'Har du en idé til et event?', 'projekt', kanKoebe) + '</div>' : '<div class="card list">' + forslagRaekke('<span class="thumb">💡</span>', 'Andet?', 'Har du en idé til et event?', 'projekt', kanKoebe) + '</div>') + '</section>';

    var banner = lukket && me.admin ? '<div class="banner">Shoppen er lukket for medarbejderne lige nu' + (shop.grund === 'fravaer' ? ' (du er ikke til stede)' : '') + '. ' + esc(shop.tekst || '') + '</div>' : '';
    return banner + top + menu + lucky(kanKoebe) + projekter + kollega(kanKoebe) + faellesMaal();
  }

  // Fælles mål for hele holdet – "Fælles mål | Se status" i regel-boksen linker hertil. Indholdet kommer senere.
  function faellesMaal() {
    return '<section class="block" id="faelles-maal"><h2 class="block-title">Fælles mål</h2><div class="card"><p class="faint" style="margin:0">Kommer snart.</p></div></section>';
  }

  // "Andet?"-række med én hvid knap, der sender et forslag direkte til admin
  function forslagRaekke(billede, navn, undertekst, type, kan) {
    return '<div class="row forslag-row">' + billede +
      '<div class="row-main"><b>' + esc(navn) + '</b>' + (undertekst ? '<small class="variants">' + esc(undertekst) + '</small>' : '') + '</div>' +
      '<div class="row-acts"><button class="btn" data-act="forslag" data-type="' + type + '"' + (kan ? '' : ' disabled') + '>' + ico('send') + 'Send forslag</button></div></div>';
  }

  // Konfetti i Best One-farver. Ren DOM + CSS-animation, ryddes op efter 4 sek.
  function konfetti() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { toast('Yehaw! 🎉', 'Eventet er fuldt.'); return; }
    var farver = ['#225581', '#2f74b5', '#79b0ff', '#c9dcf2', '#ffffff', '#8b97ab'];
    var boks = document.createElement('div');
    boks.className = 'confetti';
    for (var i = 0; i < 140; i++) {
      var c = document.createElement('i');
      var w = 6 + Math.random() * 6;
      c.style.cssText = 'left:' + (Math.random() * 100) + 'vw;width:' + w + 'px;height:' + (w * (0.4 + Math.random() * 0.8)) + 'px;background:' + farver[i % farver.length] +
        ';animation-duration:' + (2.2 + Math.random() * 1.6) + 's;animation-delay:' + (Math.random() * 0.4) + 's;--dx:' + ((Math.random() - 0.5) * 40) + 'vw;--rot:' + (360 + Math.random() * 720) + 'deg';
      boks.appendChild(c);
    }
    document.body.appendChild(boks);
    setTimeout(function () { boks.remove(); }, 4500);
  }

  // ---------- Månedens Webkollega ----------

  function kollega(kanKoebe) {
    var m = S.mdk;
    if (!m) return '';
    var mNavn = MAANEDER[Number(m.maaned.slice(5)) - 1];
    var nu = new Date(S.nu);
    var dageTilbage = new Date(nu.getFullYear(), nu.getMonth() + 1, 0).getDate() - nu.getDate();
    var forrigeNavn = MAANEDER[(nu.getMonth() + 11) % 12];
    var naesteNavn = MAANEDER[(nu.getMonth() + 1) % 12];
    var kandidater = S.kolleger.filter(function (u) { return u.gruppe; });
    var forkort = function (navn) { return String(navn || '').split(' ').map(function (x) { return x[0]; }).join('').slice(0, 2).toUpperCase(); };

    // Venstre: kun sidste måneds vinder. Ingen vinder endnu = tom plads, der teaser at det kan være dig.
    var spot = '<div class="mdk-spot"><span class="saldo-deco" aria-hidden="true">' + bMark() + '</span>' +
      (m.sidste
        ? '<span class="mdk-eyebrow">Vinder i ' + MAANEDER[Number(m.sidste.maaned.slice(5)) - 1] + '</span>' +
          '<div class="mdk-winner"><span class="mdk-crown">🏆</span><span class="mdk-avatar">' + esc(m.sidste.initialer || forkort(m.sidste.navn)) + '</span></div>' +
          '<b class="mdk-name">' + esc(m.sidste.navn) + '</b>'
        : '<span class="mdk-eyebrow">Vinder i ' + forrigeNavn + '</span>' +
          '<div class="mdk-winner"><span class="mdk-crown faded">🏆</span><span class="mdk-avatar empty">?</span></div>' +
          '<b class="mdk-name">Det kunne være dig!</b><span class="mdk-tease">Den første vinder kåres 1. ' + naesteNavn + '</span>') +
      '</div>';

    // Højre: denne måneds afstemning med præmie og deadline øverst
    var fakta = '<div class="mdk-meta"><span class="mdk-pill">' + (/webcoin/i.test(m.praemie) ? coin() : '🎁') + '<small>Præmie</small><b>' + (m.praemie ? esc(m.praemie) : 'Coming soon') + '</b></span>' +
      '<span class="mdk-pill">⏳<small>Slutter om</small><b>' + (dageTilbage === 0 ? 'i dag' : dageTilbage + (dageTilbage === 1 ? ' dag' : ' dage')) + '</b></span></div>';
    var hoejre;
    if (m.minStemme) {
      hoejre = '<h3 class="mdk-q">Tak for din stemme</h3>' + fakta +
        '<div class="mdk-voted"><span class="mdk-avatar sm">' + esc(m.minStemme.initialer || forkort(m.minStemme.navn)) + '</span><div><b>' + esc(m.minStemme.navn) + '</b>' +
        (m.minStemme.begrundelse ? '<q>' + esc(m.minStemme.begrundelse) + '</q>' : '') + '</div></div>' +
        '<p class="mdk-fine">Vinderen findes, når ' + mNavn + ' er slut. Stemmerne er hemmelige.</p>';
    } else if (kanKoebe) {
      hoejre = '<h3 class="mdk-q">Hvem gør en forskel i ' + mNavn + '?</h3>' + fakta +
        '<p class="mdk-why">Stem på en kollega, der har hjulpet dig, gjort noget ekstra eller løftet stemningen. Det handler om mennesker, ikke salgstal.</p>' +
        '<div class="mdk-select"><select class="input" id="mdk-til"><option value="">Vælg en kollega</option>' +
          kandidater.map(function (u) { return '<option value="' + esc(u.initialer) + '">' + esc(u.navn) + ' · ' + esc(u.gruppe) + '</option>'; }).join('') +
        '</select></div>' +
        '<textarea class="input vote-why" id="mdk-hvorfor" rows="2" maxlength="500" placeholder="Hvorfor?"></textarea>' +
        '<div class="mdk-send"><button class="btn primary" data-act="stem">Stem</button><span class="mdk-fine">Én stemme i ' + mNavn + ' · stemmerne er hemmelige</span></div>';
    } else {
      hoejre = '<h3 class="mdk-q">Hvem gør en forskel i ' + mNavn + '?</h3>' + fakta + '<p class="mdk-why">Medarbejderne stemmer her. Du kan se stillingen under Admin → Månedens Webkollega.</p>';
    }

    return '<section class="block"><h2 class="block-title">Månedens Webkollega</h2><div class="card mdk2">' + spot + '<div class="mdk-vote">' + hoejre + '</div></div></section>';
  }


  // ---------- Feelin' Lucky? – tombola ----------
  // En vandret rulle med præmiekort kører forbi markøren, sætter farten ned og stopper på gevinsten.
  // Gevinsten afgøres i backend (spin); rullen bygges bare, så vinderkortet lander under markøren.

  var KORT_B = 128; // kortets bredde + mellemrum (px) – skal matche CSS (.reel-card 120px + 8px gap)

  // Sjældenhed som i CS-kasser: farvet stribe i bunden af kortet (grå → blå nuancer → guld)
  function reelSjaelden(f) {
    if (f.hoved) return 'r-guld';
    if (f.type === 'intet') return 'r0';
    var vaerdi = f.type === 'webcoins' ? f.beloeb : ({ 'Hvid Monster': 15, 'Sodavand': 10, 'Candybar': 5 }[f.navn] || 10);
    return vaerdi >= 20 ? 'r3' : vaerdi >= 10 ? 'r2' : 'r1';
  }

  function reelKort(f) {
    var cls = (f.hoved ? 'hoved' : f.type === 'intet' ? 'nitte' : f.type === 'vare' ? 'vare' : 'coins') + ' ' + reelSjaelden(f);
    var ikon = f.type === 'webcoins' ? coin('coin-reel') : (f.ikon ? esc(f.ikon) : '');
    var indhold = (ikon ? '<span class="rico">' + ikon + '</span>' : '') + (f.type === 'webcoins'
      ? '<b class="num">' + fmt(f.beloeb) + '</b><small>' + enhed(f.beloeb) + '</small>'
      : '<b class="txt">' + esc(f.navn) + '</b>');
    return '<div class="reel-card ' + cls + '">' + indhold + '</div>';
  }

  // Kort til rullen – kun visuelt, afgør ikke gevinsten. Fordelingen er balanceret, så man ser
  // varer lige så tit som Webcoins: kategori først (vare 45 %, Webcoins 40 %, Nitte 15 %), så en præmie
  // i kategorien. To Webcoins-kort står aldrig lige efter hinanden, og samme præmie ikke inden for 2 kort.
  function reelKat(f) { return f.type === 'webcoins' ? 'coins' : f.type === 'intet' ? 'nitte' : 'vare'; }
  function reelTraek(felter, forrige) {
    forrige = (forrige || []).filter(Boolean);
    var undgaa = forrige.map(function (f) { return f.navn; });
    var sidsteKat = forrige.length ? reelKat(forrige[forrige.length - 1]) : '';
    var kat = { vare: [], coins: [], nitte: [] };
    felter.forEach(function (f) { kat[reelKat(f)].push(f); });
    var vaegt = { vare: kat.vare.length ? 45 : 0, coins: kat.coins.length ? 40 : 0, nitte: kat.nitte.length ? 15 : 0 };
    if (sidsteKat === 'coins') vaegt.coins = 0;
    if (sidsteKat === 'nitte') vaegt.nitte = 0;
    for (var forsoeg = 0; forsoeg < 20; forsoeg++) {
      var sum = vaegt.vare + vaegt.coins + vaegt.nitte, x = Math.random() * sum;
      var k = x < vaegt.vare ? 'vare' : x < vaegt.vare + vaegt.coins ? 'coins' : 'nitte';
      var liste = kat[k].filter(function (f) { return undgaa.indexOf(f.navn) < 0; });
      if (!liste.length) continue;
      // Hovedpræmien vises sjældnere end de andre
      var vl = liste.map(function (f) { return f.hoved ? 0.35 : 1; });
      var y = Math.random() * vl.reduce(function (a, b) { return a + b; }, 0);
      for (var i = 0; i < liste.length; i++) { y -= vl[i]; if (y <= 0) return liste[i]; }
      return liste[liste.length - 1];
    }
    return felter.filter(function (f) { return undgaa.indexOf(f.navn) < 0; })[0] || felter[0];
  }

  function reelStart(felter) {
    var kort = [];
    for (var i = 0; i < 24; i++) kort.push(reelTraek(felter, kort.slice(-2)));
    // Sømløst loop: sidste og første kort må heller ikke være to Webcoins / samme præmie
    if (reelKat(kort[0]) === 'coins' && reelKat(kort[23]) === 'coins' || kort[0].navn === kort[23].navn) kort[23] = reelTraek(felter, [kort[22], kort[0]]);
    return kort;
  }

  // Tomgang: JS flytter rullen langsomt og husker positionen (ui.idle), så den aldrig springer tilbage ved
  // opdateringer. Den står stille, når musen er over den, og er slået fra ved "Reducer bevægelse".
  var IDLE_FART = 75; // px pr. sekund
  function idleLoop(ts) {
    var spor = document.getElementById('reel'), box = document.getElementById('reel-box');
    var sidst = ui.idleTs || ts;
    ui.idleTs = ts;
    if (spor && spor.classList.contains('tomgang') && ui.reelStartKort) {
      var periode = ui.reelStartKort.length * KORT_B;
      if (!(box && box.matches(':hover'))) ui.idleOffset = ((ui.idleOffset || 0) + Math.min(100, ts - sidst) / 1000 * IDLE_FART) % periode;
      spor.style.transform = 'translateX(' + (-ui.idleOffset).toFixed(1) + 'px)';
    }
    requestAnimationFrame(idleLoop);
  }
  if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) requestAnimationFrame(idleLoop);

  // Lille i-ikon med chancerne (vises ved hover), samlet pr. præmie og sorteret efter chance
  function chancePop(felter) {
    var samlet = {};
    felter.forEach(function (f) { var k = f.navn; samlet[k] = samlet[k] || { navn: k, ikon: f.type === 'webcoins' ? coin() : esc(f.ikon || ''), andel: 0 }; samlet[k].andel += f.andel || 0; });
    var rk = Object.keys(samlet).map(function (k) { return samlet[k]; }).sort(function (a, b) { return b.andel - a.andel; });
    return '<span class="info chance-info" tabindex="0"><span class="info-mini" aria-label="Se chancerne">' + ico('info') + '</span>' +
      '<span class="pop" role="tooltip"><b class="pop-title">Chancer pr. drej</b>' + rk.map(function (x) {
        return '<div class="rule"><span class="chance-navn">' + x.ikon + ' ' + esc(x.navn) + '</span><b class="num">' + (x.andel * 100).toFixed(1).replace('.', ',').replace(',0', '') + ' %</b></div>';
      }).join('') + '</span></span>';
  }

  function lucky(kanKoebe) {
    var h = S.hjul;
    if (!h || !h.felter.length) return '';
    var klar = h.klar > 0;
    var kanKoebeDrej = kanKoebe && !klar && S.stats.saldo >= h.pris;
    var knapper = '<div class="lucky-acts">' +
      (klar
        ? '<span class="tag ny">' + ico('unlock') + 'Dit drej er klar</span>'
        : '<button class="btn lg" data-act="koeb-drej"' + (kanKoebeDrej ? '' : ' disabled') + '>Køb et drej</button>') +
      '<button class="btn primary lg' + (klar ? '' : ' locked') + '" data-act="spin"' + (klar && kanKoebe ? '' : ' disabled') + '>' + (klar ? '<span class="btn-emoji">🎰</span>' : ico('lock')) + 'Drej hjulet</button></div>';
    // Uden et nyligt resultat ruller tombolaen langsomt i ring for at friste (rækken er dubleret, så loopet er sømløst)
    if (!ui.reelStartKort) ui.reelStartKort = reelStart(h.felter);
    var start = ui.reelStartKort.map(reelKort).join('');
    var spor = ui.reel ? ui.reel.html : start + start;
    var x = ui.reel ? ui.reel.x : -(ui.idleOffset || 0);
    var tomgang = !ui.reel;
    return '<section class="block"><h2 class="block-title">Feelin\' Lucky?</h2><div class="card lucky2">' +
      '<div class="reel" id="reel-box"><span class="reel-marker"></span><div class="reel-track' + (tomgang ? ' tomgang' : '') + '" id="reel" style="transform:translateX(' + x + 'px)">' + spor + '</div></div>' +
      '<div class="lucky-bund"><div class="lucky-price"><span class="lp-label">Drej hjulet</span>' + chancePop(h.felter) +
      '<span class="row-price num"><span class="amt">' + fmt(h.pris) + '</span><span class="unit">' + enhed(h.pris) + '</span>' + coin() + '</span></div>' +
      knapper + '</div></div></section>';
  }

  // Bygger en ny rulle med vinderen på plads nr. VINDER og animerer den ind under markøren
  function reelKoer(res, faerdig) {
    var box = document.getElementById('reel-box'), spor = document.getElementById('reel');
    var felter = S.hjul.felter;
    var vinder = felter.filter(function (f) { return f.id === res.id; })[0] || res;
    // Start med præcis de kort, der står nu (tomgang), så rullen fortsætter flydende fra hvor den er
    var startKort = ui.reel ? [] : (ui.reelStartKort || []).concat(ui.reelStartKort || []);
    var x0 = ui.reel ? 0 : -(ui.idleOffset || 0);
    var VINDER = startKort.length + 62, ANTAL = VINDER + 6;
    var kort = startKort.slice();
    for (var i = kort.length; i < ANTAL; i++) {
      // Kortene lige omkring vinderen må ikke være samme præmie som vinderen
      var naer = i >= VINDER - 2 && i <= VINDER + 2 && i !== VINDER;
      kort.push(i === VINDER ? vinder : reelTraek(felter, kort.slice(-2).concat(naer ? [vinder] : [])));
    }
    var html = kort.map(reelKort).join('');
    var bredde = box ? box.clientWidth : 600;
    var jitter = (Math.random() - 0.5) * 70; // stopper ikke altid præcis midt på kortet
    var slut = -(VINDER * KORT_B + 60 - bredde / 2 + jitter);
    var forbi = slut - (14 + Math.random() * 16); // glider lidt for langt og retter sig ind, som i CS
    ui.reel = { html: html, x: slut };
    if (!spor || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { faerdig(); return; }
    spor.classList.remove('tomgang');
    spor.style.transition = 'none';
    spor.innerHTML = html;
    spor.style.transform = 'translateX(' + x0.toFixed(1) + 'px)';
    void spor.offsetWidth; // tving browseren til at tegne startpositionen
    box.classList.remove('stoppet');
    // 8,5 sek. med en lang, langsom afslutning
    spor.style.transition = 'transform 8.5s cubic-bezier(.06,.62,.04,1)';
    spor.style.transform = 'translateX(' + forbi + 'px)';
    setTimeout(function () {
      spor.style.transition = 'transform .5s ease-in-out';
      spor.style.transform = 'translateX(' + slut + 'px)';
    }, 8550);
    setTimeout(function () {
      var k = spor.children[VINDER];
      if (k) k.classList.add('vinder');
      box.classList.add('stoppet');
      setTimeout(faerdig, 900);
    }, 9100);
  }

  function visGevinst(res) {
    var tekst = res.type === 'webcoins' ? '+' + wc(res.beloeb) + ' er lagt på din saldo.'
      : res.type === 'vare' ? 'Den bliver leveret til dig. Der kan være lidt ventetid.'
      : 'Bedre held næste gang.';
    var besked = res.type === 'vare' ? 'Admin har fået besked, hold øje med din chat.'
      : res.type === 'webcoins' ? 'Admin har fået besked om din gevinst.' : '';
    var ikon = res.type === 'webcoins' ? coin('coin-xl') : '<div class="win-ico">' + esc(res.ikon || '🎁') + '</div>';
    openModal('<div class="closed">' + ikon +
      '<h2>' + (res.type === 'intet' ? 'Ingen gevinst denne gang' : 'Du vandt ' + esc(res.navn) + '!') + '</h2>' +
      '<p>' + esc(tekst) + '</p>' + (besked ? '<p class="win-besked">📣 ' + esc(besked) + '</p>' : '') + '<button class="btn primary grow" data-act="close">' + (res.type === 'intet' ? 'Øv' : 'Fedt!') + '</button></div>');
  }

  // Ikon og farve pr. posteringstype i aktivitetslisten
  var AKT = {
    optjent: ['in', 'down'], gevinst: ['in', 'star'], refusion: ['in', 'sync'],
    koeb: ['out', 'cart'], hjul: ['out', 'coin'], projekt: ['out', 'heart'],
    gave: ['gift', 'gift'], gave_modtaget: ['gift', 'gift'], justering: ['neutral', 'list']
  };

  // Små gave-ikoner som visuel tæller (max 8, derefter +n)
  function giftDots(n, cls) {
    if (!n) return '';
    var vis = Math.min(n, 8), out = '';
    for (var i = 0; i < vis; i++) out += '<span class="gdot ' + cls + '">' + ico('gift') + '</span>';
    return out + (n > vis ? '<span class="faint" style="font-size:12px">+' + (n - vis) + '</span>' : '');
  }

  function pageProfil() {
    var me = S.me, st = S.stats, nu = new Date(S.nu);
    var mNavn = MAANEDER[nu.getMonth()];
    var fane = ui.profilFane || 'aktivitet';

    var head = '<section class="profile-card"><span class="saldo-deco" aria-hidden="true">' + bMark() + '</span>' + avatar(me, true) +
      '<div class="pc-who">' + (me.gruppe ? '<span>' + esc(me.gruppe) + '</span>' : '') + '<h1>' + esc(me.navn) + '</h1></div>' +
      '<div class="pc-saldo"><b class="num">' + wc(st.saldo) + coin() + '</b></div></section>';

    var del = function (v) { return st.brugt > 0 ? Math.max(0, v / st.brugt * 100) : 0; };
    var stats = '<div class="pstats">' +
      '<div class="pstat"><div class="pstat-top"><span class="pico in">' + ico('down') + '</span><span>Optjent i ' + mNavn + '</span></div>' +
      '<b class="num">' + wc(st.optjentMaaned) + '</b>' + spark(st.forloeb.map(function (f) { return f.beloeb; })) +
      '<small class="pstat-ialt num">I alt ' + wc(st.optjentTotal) + '</small></div>' +
      '<div class="pstat"><div class="pstat-top"><span class="pico out">' + ico('cart') + '</span><span>Brugt i alt</span></div>' +
      '<b class="num">' + wc(st.brugt) + '</b>' +
      '<div class="split"><i class="s1" style="width:' + del(st.brugtSelv).toFixed(1) + '%"></i><i class="s2" style="width:' + del(st.givet).toFixed(1) + '%"></i><i class="s3" style="width:' + del(st.indskudt).toFixed(1) + '%"></i><i class="s4" style="width:' + del(st.spins).toFixed(1) + '%"></i></div>' +
      '<div class="legend num"><span><i class="s1"></i>Selv ' + fmt(st.brugtSelv) + '</span><span><i class="s2"></i>Donationer ' + fmt(st.givet) + '</span><span><i class="s3"></i>Events ' + fmt(st.indskudt) + '</span><span><i class="s4"></i>Spins ' + fmt(st.spins) + '</span></div></div>' +
      '<div class="pstat"><div class="pstat-top"><span class="pico gift">' + ico('gift') + '</span><span>Donationer</span></div>' +
      '<b class="num">' + st.givetAntal + ' givet</b>' +
      '<div class="gift-row">' + giftDots(st.givetAntal, 'giv') + '</div>' +
      '<small class="num">' + st.gaverModtaget + ' modtaget</small></div>' +
      '</div>';

    var faner = { aktivitet: 'Aktivitet', optjening: 'Optjening', bestillinger: 'Bestillinger' };
    var tabs = '<nav class="ptabs">' + Object.keys(faner).map(function (k) {
      return '<button class="' + (fane === k ? 'on' : '') + '" data-act="pfane" data-f="' + k + '">' + faner[k] + '</button>';
    }).join('') + '</nav>';

    var indhold;
    if (fane === 'optjening') {
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
      indhold = mRows.length ? mRows.map(function (m) {
        return '<div class="prow month-row"><div class="month-name"><b>' + esc(maanedLabel(m.maaned)) + '</b></div>' +
          '<div class="row-main"><div class="bar"><i style="width:' + ((m.total / maxM) * 100).toFixed(0) + '%"></i></div>' +
          '<div class="top3">' + Object.keys(m.kilder).map(function (k) { return '<span>' + esc(k) + ' <b class="num">' + wc(m.kilder[k]) + '</b></span>'; }).join('') + '</div></div>' +
          '<span class="pamt plus num">+' + wc(m.total) + '</span></div>';
      }).join('') : '<div class="empty">Intet optjent endnu.</div>';
    } else if (fane === 'bestillinger') {
      indhold = S.bestillinger.length ? S.bestillinger.map(function (b) {
        var tekst = b.fra === me.initialer
          ? (b.til !== b.fra ? b.vare + ' til ' + b.tilNavn : b.vare)
          : b.vare + ' fra ' + b.fraNavn;
        var b2 = b.fra === me.initialer ? -b.pris : 0;
        var type = b.fra !== me.initialer || b.til !== b.fra ? 'gift' : 'out';
        return '<div class="prow"><span class="pico ' + type + '">' + ico(type === 'gift' ? 'gift' : 'cart') + '</span>' +
          '<div class="row-main"><b>' + esc(tekst) + '</b><small>' + dato(b.tid) + '</small></div>' + statusTag(b) +
          '<span class="pamt num">' + (b2 ? beloebCell(b2) : '<span class="zero">Gave</span>') + '</span></div>';
      }).join('') : '<div class="empty">Intet bestilt endnu.</div>';
    } else {
      var grupper = [], sidst = null;
      // Grupperet efter den måned posteringen hører til (optjening tæller i den måned, den er tjent)
      S.historik.slice().sort(function (x, y) { return String(y.maaned).localeCompare(String(x.maaned)) || String(y.tid).localeCompare(String(x.tid)); }).forEach(function (p) {
        var k = String(p.maaned || String(p.tid).slice(0, 7));
        if (k !== sidst) { grupper.push({ maaned: k, rows: [] }); sidst = k; }
        grupper[grupper.length - 1].rows.push(p);
      });
      indhold = grupper.length ? grupper.map(function (g) {
        return '<div class="pmonth">' + esc(cap(MAANEDER[Number(g.maaned.slice(5)) - 1] || '')) + ' ' + esc(g.maaned.slice(0, 4)) + '</div>' +
          g.rows.map(function (p) {
            var a = AKT[p.type] || ['neutral', 'list'];
            return '<div class="prow"><span class="pico ' + a[0] + '">' + ico(a[1]) + '</span>' +
              '<div class="row-main"><b>' + esc(p.tekst) + '</b><small>' + esc(TYPER[p.type] || p.type) + ' · ' + dato(p.tid) + '</small></div>' +
              '<span class="pamt num">' + (p.beloeb ? beloebCell(p.beloeb) : '<span class="zero">' + (p.type === 'gave_modtaget' ? 'Gave' : '–') + '</span>') + '</span></div>';
          }).join('');
      }).join('') : '<div class="empty">Ingen bevægelser endnu.</div>';
    }

    return head + stats + tabs + '<section class="card plist">' + indhold +
      '<p class="disclaimer">Tallene kan ændre sig, hvis der bliver rettet fejl.</p></section>' +
      '<section class="card fb-card"><b>Har du feedback til Webshoppen?</b><button class="btn" data-act="forslag" data-type="feedback">💬 Giv feedback</button></section>';
  }

  function statBox(label, val, sub) {
    return '<div class="card stat"><div class="eyebrow">' + label + '</div><div class="val num">' + val + '</div>' + (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div>';
  }

  // ---------- Admin-sider ----------

  function adminHead(titel, knapper) {
    return '<div class="page-head"><div><div class="eyebrow">Admin</div><h1>' + titel + '</h1></div><div class="chips">' + (knapper || '') + '</div></div>';
  }

  // Regler: simpel liste – overskrift pr. gruppe og hvad hver ting er værd
  function pageRegler() {
    return adminHead('Regler') +
      '<section class="card regel-liste">' + S.grupper.concat('Alle').map(function (g) {
        var r = S.regler.filter(function (x) { return x.gruppe === g; });
        return '<h2 class="card-title">' + esc(g === 'Alle' ? 'Alle grupper' : g) + '</h2>' +
          (g === 'Alle' ? '<ul><li><span>Månedens Webkollega</span><b>' + mdkVaerdi() + '</b></li></ul>' : '') +
          (r.length ? '<ul>' + r.map(function (x) { return '<li><span>' + esc(x.navn) + '</span><b>' + regelVaerdi(x) + '</b></li>'; }).join('') + '</ul>' : '<p class="faint">Kommer senere.</p>');
      }).join('') + '</section>';
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
          return '<tr><td class="faint">' + dato(b.tid) + '</td><td>' + esc(b.fraNavn) + '</td><td>' + (b.til !== b.fra ? '🎁 ' + esc(b.tilNavn) : '<span class="faint">—</span>') + '</td><td><b>' + esc(b.vare) + '</b>' + (b.oenske ? '<small class="variants">Ønske: ' + esc(b.oenske) + '</small>' : '') + '</td><td class="r num">' + wc(b.pris) + '</td><td>' + statusTag(b) + '</td><td><div class="row-acts">' + acts + '</div></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">Ingen bestillinger.</div>') +
      '</section>';
  }

  // Admin-overblik: det vigtigste samlet ét sted (bestillinger, økonomi, events, månedens kollega, aktivitet)
  function pageAdminOverblik() {
    var nuKey = Core.maanedKey(new Date(S.nu)); // lokal tid, ikke UTC
    var mNavn = MAANEDER[Number(nuKey.slice(5)) - 1];
    var rows = A.opgoerelse;
    var denne = rows.filter(function (o) { return o.maaned === nuKey; })[0];
    var nye = A.bestillinger.filter(function (b) { return b.status === 'ny'; });
    var tb = S.teambudget;
    var m = A.mdk;


    var stats = '<div class="stat-grid to">' +
      statBox('Brugt i ' + mNavn, wcSmall(denne ? denne.wc : 0) + coin(), denne ? denne.antal + ' bestillinger' : 'Ingen bestillinger') +
      (tb ? statBox('Teambudget tilbage', kr(tb.rest), 'Brugt i sæsonen: ' + kr(tb.brugt)) : '') +
      '</div>';

    var best = '<section class="card"><div class="card-head"><h2 class="card-title">Nye bestillinger' + (nye.length ? ' <span class="badge">' + nye.length + '</span>' : '') + '</h2><a class="link" href="#/admin/bestillinger">Se alle</a></div>' +
      (nye.length ? '<div class="adm-list">' + nye.slice(0, 10).map(function (b) {
        return '<div class="adm-row"><div class="adm-main"><b>' + esc(b.vare) + '</b>' + (b.oenske ? ' <span class="faint">· ' + esc(b.oenske) + '</span>' : '') +
          '<small class="faint">Til ' + esc(b.til !== b.fra ? b.tilNavn : b.fraNavn) + (b.til !== b.fra ? ' · 🎁 gave fra ' + esc(b.fraNavn) : '') + ' · ' + dato(b.tid) + (b.forud ? ' · forudbestilt' : '') + '</small></div>' +
          '<div class="row-acts"><button class="btn primary sm" data-act="bstatus" data-id="' + esc(b.id) + '" data-s="udleveret">Udleveret</button><button class="btn danger sm" data-act="bstatus" data-id="' + esc(b.id) + '" data-s="annulleret">Annullér</button></div></div>';
      }).join('') + '</div>' + (nye.length > 10 ? '<small class="faint">+ ' + (nye.length - 10) + ' flere</small>' : '') : '<div class="empty">Ingen nye bestillinger.</div>') +
      '</section>';

    var top = m.stilling.slice(0, 3);
    var kollega = '<section class="card"><div class="card-head"><h2 class="card-title">Månedens Webkollega</h2><a class="link" href="#/admin/kollega">Åbn</a></div>' +
      '<div class="rule"><span>Præmie i ' + mNavn + '</span>' + (m.praemie ? '<b>' + esc(m.praemie) + '</b>' : '<a class="link" href="#/admin/kollega">Coming soon – vælg præmie</a>') + '</div>' +
      '<div class="rule"><span>Stemmer</span><b class="num">' + m.afgivet + '</b></div>' +
      (top.length ? top.map(function (x, i) { return '<div class="rule"><span>' + ['🥇', '🥈', '🥉'][i] + ' ' + esc(x.navn) + '</span><b class="num">' + x.stemmer + '</b></div>'; }).join('') : '') +
      (m.historik.length ? '<small class="faint">Sidste vinder: ' + esc(m.historik[0].vinder.navn) + ' (' + esc(maanedLabel(m.historik[0].maaned)) + ')</small>' : '') +
      '</section>';

    // Sorteret efter højeste procent først
    var pct = function (p) { return p.maal > 0 ? p.indsamlet / p.maal : 0; };
    var events = A.projekter.filter(function (p) { return p.aaben; }).sort(function (a, b) { return pct(b) - pct(a); });
    var ev = '<section class="card"><div class="card-head"><h2 class="card-title">Events</h2></div>' +
      (events.length ? events.map(function (p) {
        var pp = p.maal > 0 ? Math.min(100, p.indsamlet / p.maal * 100) : 0;
        return '<div class="adm-ev"><div class="adm-ev-top"><span>' + esc(p.ikon || '🎯') + ' <b>' + esc(p.navn) + '</b></span><span class="num faint">' + fmt(p.indsamlet) + (p.maal ? ' af ' + fmt(p.maal) : '') + ' · <b>' + pp.toFixed(0) + ' %</b></span></div>' +
          '<div class="bar' + (pp >= 100 ? ' fuld' : '') + '"><i style="width:' + pp.toFixed(0) + '%"></i></div></div>';
      }).join('') : '<div class="empty">Ingen åbne events.</div>') +
      '</section>';

    var akt = '<section class="card"><div class="card-head"><h2 class="card-title">Seneste aktivitet</h2><a class="link" href="#/admin/posteringer">Se alle</a></div>' +
      (A.posteringer.length ? '<div class="adm-list">' + A.posteringer.filter(function (p) { return p.type !== 'gave_modtaget'; }).slice(0, 6).map(function (p) {
        return '<div class="adm-row"><div class="adm-main"><b>' + esc(p.navn) + '</b><small class="faint">' + esc(TYPER[p.type] || p.type) + ' · ' + esc(p.tekst) + ' · ' + dato(p.tid) + '</small></div>' +
          '<span class="num ' + (p.beloeb < 0 ? 'minus' : 'plus') + '">' + (p.beloeb > 0 ? '+' : '') + fmt(p.beloeb) + '</span></div>';
      }).join('') + '</div>' : '<div class="empty">Ingen aktivitet endnu.</div>') +
      '</section>';

    var opg = '<section class="card"><div class="card-head"><h2 class="card-title">Opgørelse pr. måned</h2><span class="faint">Sendes til RAB ved månedens udgang · i alt ' + kr(rows.reduce(function (sum, o) { return sum + o.kr; }, 0)) + '</span></div>' +
      (rows.length ? '<div class="table-wrap"><table><thead><tr><th>Måned</th><th class="r">Bestillinger</th><th class="r">Webcoins brugt</th><th class="r">Kr i alt</th><th class="r">Sendt til RAB</th></tr></thead><tbody>' +
        rows.map(function (o) {
          var rab = o.sendt
            ? '<span class="tag ok">✓ Sendt' + (o.sendtTid ? ' ' + esc(dato(o.sendtTid).split(' · ')[0]) : '') + '</span> <button class="btn sm" data-act="afregnet" data-m="' + esc(o.maaned) + '" data-s="0">Fortryd</button>'
            : '<button class="btn primary sm" data-act="afregnet" data-m="' + esc(o.maaned) + '" data-s="1">Markér som sendt</button>';
          return '<tr' + (o.sendt ? ' class="afregnet"' : '') + '><td><b>' + esc(maanedLabel(o.maaned)) + '</b></td><td class="r num">' + o.antal + '</td><td class="r num">' + wc(o.wc) + '</td><td class="r num"><b>' + kr(o.kr) + '</b></td><td class="r"><div class="row-acts rab">' + rab + '</div></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">Ingen bestillinger endnu.</div>') +
      '</section>';

    // Rækkefølge: det der skal klares (nye bestillinger) øverst, så økonomi, derefter resten
    return adminHead('Overblik') + '<div class="adm-first">' + best + '</div>' + stats +
      '<div class="grid-2 top0 lige">' + ev + kollega + '</div>' +
      '<div class="adm-stak">' + opg + akt + '</div>';
  }

  // Brugere: klik på en kolonneoverskrift sorterer; klik igen vender rækkefølgen
  function sortTh(k, tekst, cls) {
    var b = ui.brugerSort || { k: 'navn', op: true };
    var pil = b.k === k ? (b.op ? ' ▲' : ' ▼') : '';
    return '<th' + (cls ? ' class="' + cls + '"' : '') + '><button class="th-sort' + (b.k === k ? ' on' : '') + '" data-act="bsort" data-k="' + k + '">' + tekst + pil + '</button></th>';
  }
  function sorterBrugere(liste) {
    var b = ui.brugerSort || { k: 'navn', op: true };
    return liste.slice().sort(function (x, y) {
      var r = b.k === 'saldo' ? x.saldo - y.saldo : String(x[b.k] || '').localeCompare(String(y[b.k] || ''), 'da');
      return (b.op ? r : -r) || x.navn.localeCompare(y.navn, 'da');
    });
  }

  function pageAdminBrugere() {
    return adminHead('Brugere', '<button class="btn primary" data-act="ny-bruger">Tilføj bruger</button>') +
      '<section class="card"><div class="card-head"><input class="input search" placeholder="Søg navn, initialer, gruppe" data-search="brugere"></div>' +
      '<div class="table-wrap"><table><thead><tr>' + sortTh('navn', 'Navn') + sortTh('initialer', 'Initialer') + sortTh('gruppe', 'Gruppe') + sortTh('saldo', 'Saldo', 'r') + '<th></th></tr></thead><tbody>' +
      sorterBrugere(A.brugere).map(function (u) {
        var q = (u.navn + ' ' + u.initialer + ' ' + u.email + ' ' + u.gruppe).toLowerCase();
        return '<tr data-q="' + esc(q) + '"' + (u.aktiv ? '' : ' style="opacity:.5"') + '><td><b>' + esc(u.navn) + '</b>' + (u.aktiv ? '' : ' <span class="tag">Inaktiv</span>') + '</td><td>' + esc(u.initialer) + '</td><td>' + (u.gruppe ? esc(u.gruppe) : '<span class="tag ny">Ingen gruppe</span>') + '</td><td class="r num"><b>' + wc(u.saldo) + '</b></td>' +
          '<td><div class="row-acts"><button class="btn sm" data-act="ret-bruger" data-email="' + esc(u.email) + '">Rediger</button><button class="btn sm" data-act="juster" data-ini="' + esc(u.initialer) + '">Justér</button></div></td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function pageAdminKollega() {
    var m = A.mdk;
    var mNavn = MAANEDER[Number(m.maaned.slice(5)) - 1];
    return adminHead('Månedens Webkollega') +
      '<section class="card" style="margin-bottom:20px"><div class="card-head"><h2 class="card-title">Præmie</h2></div>' +
      '<div class="vote-form"><input class="input" id="mdk-praemie" value="' + esc(m.praemie) + '" placeholder="fx 50 Webcoins"><button class="btn primary" data-act="mdk-praemie-ok">Gem</button></div>' +
      '<small class="faint">' + (m.praemie ? 'Gælder ' + mNavn + '.' : 'Ingen præmie for ' + mNavn + ' endnu – medarbejderne ser "Coming soon".') + ' Præmien nulstilles hver måned og gives manuelt (Brugere → Justér).</small></section>' +
      '<div class="adm-stak" style="margin-top:0"><section class="card"><div class="card-head"><h2 class="card-title">Stilling i ' + mNavn + '</h2><span class="tag">' + m.afgivet + ' stemmer</span></div>' +
      (m.stilling.length ? '<div class="table-wrap"><table><thead><tr><th>#</th><th>Kollega</th><th class="r">Stemmer</th><th class="r">Første stemme</th></tr></thead><tbody>' +
        m.stilling.map(function (x, i) {
          return '<tr><td>' + (i === 0 ? '🏆' : i + 1) + '</td><td><b>' + esc(x.navn) + '</b>' +
            (x.begrundelser.length ? '<ul class="why-list">' + x.begrundelser.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' : '') +
            '</td><td class="r num" style="vertical-align:top">' + x.stemmer + '</td><td class="r faint" style="vertical-align:top">' + dato(x.foerste) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">Ingen stemmer endnu.</div>') +
      '<small class="faint">Kun synlig for admin. Begrundelserne vises uden navn på den, der har stemt. Ved lighed vinder den, der fik sin første stemme først.</small></section>' +
      '<section class="card"><div class="card-head"><h2 class="card-title">Tidligere vindere</h2></div>' +
      (m.historik.length ? '<div class="mini-list">' + m.historik.map(function (h) {
        return '<div class="mini"><div class="t"><b>' + esc(h.vinder.navn) + '</b><small>' + esc(maanedLabel(h.maaned)) + '</small></div><span class="muted num">' + h.vinder.stemmer + ' af ' + h.stemmer + ' stemmer</span></div>';
      }).join('') + '</div>' : '<div class="empty">Ingen vindere endnu.</div>') + '</section></div>';
  }

  function pageAdminPosteringer() {
    var typer = ['alle'].concat(Object.keys(TYPER));
    var rows = A.posteringer.filter(function (p) {
      return (ui.postType === 'alle' || p.type === ui.postType) && (!ui.postPerson || p.initialer === ui.postPerson);
    });
    var vist = rows.slice(0, ui.postVis || 25);
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
        }).join('') + '</tbody></table></div>' +
        (rows.length > vist.length ? '<div class="vis-flere"><button class="btn" data-act="post-flere">Vis flere</button></div>' : '') : '<div class="empty">Ingen posteringer.</div>') +
      '</section>';
  }

  // ---------- Modaler ----------

  // Skifter kun indholdet i en allerede åben boks (ingen fade/blink), ellers åbnes en ny
  function modalIndhold(html) {
    var m = modalRoot.querySelector('.modal');
    if (m) { m.innerHTML = html; return; }
    openModal(html);
  }

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
    if (v.snart) return;
    koebState = { vare: v, gave: gave, til: '', variant: v.varianter.length === 1 ? v.varianter[0] : '' };
    renderKoeb();
  }
  function renderKoeb() {
    var k = koebState, v = k.vare;
    var efter = S.stats.saldo - v.pris;
    var forud = S.shop && !S.shop.aaben;
    var kollegaer = S.kolleger.map(function (u) {
      return '<option value="' + esc(u.initialer) + '"' + (k.til === u.initialer ? ' selected' : '') + '>' + esc(u.navn) + ' · ' + esc(u.gruppe) + '</option>';
    }).join('');
    var mangler = v.varianter.length > 1 && !k.variant;
    modalIndhold('<h2><span class="ico">' + esc(v.ikon || '🛍️') + '</span>' + esc(v.navn) + '</h2>' +
      (v.varianter.length > 1 ? '<div class="field"><label>Vælg</label><div class="choices">' + v.varianter.map(function (x) {
        return '<button class="choice' + (k.variant === x ? ' on' : '') + '" data-act="koeb-variant" data-v="' + esc(x) + '">' + esc(x) + '</button>';
      }).join('') + '</div></div>' : !v.oenskeFelt ? '' : '<div class="field"><label for="koeb-oenske">Dit ønske</label><input class="input" id="koeb-oenske" maxlength="200" value="' + esc(k.oenske || '') + '" placeholder="Skriv dit ønske, fx Pepsi Max"></div>') +
      '<div class="seg"><button class="' + (k.gave ? '' : 'on') + '" data-act="koeb-mode" data-g="0">Til mig</button><button class="' + (k.gave ? 'on' : '') + '" data-act="koeb-mode" data-g="1">Donér til en kollega</button></div>' +
      (k.gave ? '<div class="field"><label for="koeb-til">Kollega</label><select class="input" id="koeb-til" data-act="koeb-til"><option value="">Vælg …</option>' + kollegaer + '</select></div>' : '') +
      '<div class="sum"><span class="muted">Pris</span><b class="num">' + wc(v.pris) + '</b></div>' +
      '<div class="sum"><span class="muted">Saldo efter</span><b class="num ' + (efter < 0 ? 'minus' : '') + '">' + wc(efter) + '</b></div>' +
      '<p class="note" style="margin:6px 0 0">' + (forud ? 'Shoppen har lukket. Den leveres, når shoppen åbner.' : 'Personlig levering, forvent lidt ventetid.') + '</p>' +
      '<div class="modal-acts"><button class="btn grow" data-act="close">Annullér</button><button class="btn primary grow" data-act="koeb-ok"' + (efter < 0 || mangler || (k.gave && !k.til) ? ' disabled' : '') + '>' + (forud ? (k.gave ? 'Forudbestil donation' : 'Forudbestil') : (k.gave ? 'Donér' : 'Bestil')) + '</button></div>');
  }

  var indskydState = null;
  function openIndskyd(id) {
    var p = S.projekter.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    indskydState = { p: p };
    var maks = p.maal > 0 ? Math.min(S.stats.saldo, Math.max(0, p.maal - p.indsamlet)) : S.stats.saldo;
    var forslag = [10, 20, 30, 40, 50, 100]; // beløb man ikke har råd til (eller som overstiger det der mangler) er slået fra
    openModal('<h2><span class="ico">' + esc(p.ikon || '🎯') + '</span>' + esc(p.navn) + '</h2>' +
      '<div class="field"><label for="ind-beloeb">Antal Webcoins' + (p.maal > 0 ? ' (der mangler ' + wc(Math.max(0, p.maal - p.indsamlet)) + ')' : '') + '</label><input class="input num" id="ind-beloeb" type="number" min="1" max="' + Math.max(0, maks) + '" inputmode="numeric" placeholder="0"></div>' +
      '<div class="chips beloeb-chips">' + forslag.map(function (n) { return '<button class="chip" data-act="ind-forslag" data-n="' + n + '"' + (n > maks ? ' disabled' : '') + '>' + n + '</button>'; }).join('') + '</div>' +
      '<div class="sum"><span class="muted">Din saldo</span><b class="num">' + wc(S.stats.saldo) + '</b></div>' +
      '<div class="modal-acts"><button class="btn grow" data-act="close">Annullér</button><button class="btn primary grow" data-act="ind-ok">Donér</button></div>');
  }

  function openBruger(email) {
    var u = email ? A.brugere.filter(function (x) { return x.email === email; })[0] : { email: '', initialer: '', navn: '', gruppe: '', aktiv: true };
    openModal('<h2>' + (email ? 'Rediger bruger' : 'Ny bruger') + '</h2>' +
      '<input type="hidden" id="b-orig" value="' + esc(email || '') + '">' +
      '<div class="field"><label for="b-navn">Navn</label><input class="input" id="b-navn" value="' + esc(u.navn) + '"></div>' +
      '<div class="row-2"><div class="field"><label for="b-ini">Initialer</label><input class="input" id="b-ini" maxlength="5" value="' + esc(u.initialer) + '" style="text-transform:uppercase"></div>' +
      '<div class="field"><label for="b-gruppe">Gruppe</label><select class="input" id="b-gruppe"><option value="">Ingen</option>' + A.grupper.map(function (g) { return '<option' + (u.gruppe === g ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label for="b-email">Google-mail</label><input class="input" id="b-email" type="email" value="' + esc(u.email) + '" placeholder="navn@best-one.dk"></div>' +
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

  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function checked(id) { var el = document.getElementById(id); return !!(el && el.checked); }

  // ---------- Events ----------

  document.addEventListener('click', function (ev) {
    // Luk regel-popover ved klik udenfor
    document.querySelectorAll('.info.open, .me-menu.open').forEach(function (el) { if (!el.contains(ev.target)) el.classList.remove('open'); });

    var t = ev.target.closest('[data-act]');
    if (!t) return;
    var act = t.dataset.act;
    if (act === 'modal-bg' && ev.target !== t) return;
    if (t.tagName === 'SELECT') return;

    switch (act) {
      case 'forslag': {
        var ftype = t.dataset.type || 'vare', proj = ftype === 'projekt', fb = ftype === 'feedback';
        openModal('<h2><span class="ico">' + (fb ? '💬' : '💡') + '</span>' + (fb ? 'Giv feedback' : 'Send forslag') + '</h2>' +
          '<p class="muted" style="margin:-8px 0 14px">' + (fb ? 'Hvad kan gøres bedre i Webshoppen?' : proj ? 'Hvad skal vi samle ind til?' : 'Hvad mangler der i menuen?') + '</p>' +
          '<input type="hidden" id="f-type" value="' + ftype + '">' +
          '<textarea class="input" id="f-tekst" rows="4" maxlength="1000"></textarea>' +
          '<div class="modal-acts"><button class="btn grow" data-act="close">Annullér</button><button class="btn primary grow" data-act="forslag-ok">Send</button></div>');
        break;
      }
      case 'forslag-ok': {
        var ft = val('f-tekst').trim();
        if (ft.length < 5) { toast('Skriv dit forslag', '', true); break; }
        submit(t, 'forslag', { type: val('f-type'), tekst: ft }, val('f-type') === 'feedback' ? 'Tak for din feedback!' : 'Tak! Dit forslag er sendt');
        break;
      }
      case 'yehaw': konfetti(); break;
      case 'regler-boks':
        openModal('<h2><span class="info-btn dark">' + ico('info') + '</span>Sådan optjener du Webcoins</h2>' +
          '<p class="muted" style="margin:-8px 0 14px">Gælder for din gruppe: <b>' + esc(S.me.gruppe) + '</b></p>' +
          '<div class="rules-box">' + mineRegler() + '</div>' +
          '<p class="note" style="margin:14px 0 0">Webcoins hentes automatisk og lægges på din saldo hver måned.</p>' +
          '<div class="modal-acts"><button class="btn primary grow" data-act="close">Forstået</button></div>');
        break;
      case 'faelles-maal': {
        closeModal();
        var fm = document.getElementById('faelles-maal');
        if (fm) fm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
      case 'me-menu': t.parentNode.classList.toggle('open'); break;
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
      case 'afregnet':
        submit(t, 'admin_afregnet', { maaned: t.dataset.m, sendt: t.dataset.s === '1' }, t.dataset.s === '1' ? 'Markeret som sendt til RAB' : 'Markering fjernet');
        break;
      case 'post-flere': ui.postVis = (ui.postVis || 25) + 25; render(); break;
      case 'bsort': {
        var nb = ui.brugerSort || { k: 'navn', op: true };
        // Saldo sorteres højeste først ved første klik, tekst A–Å
        ui.brugerSort = nb.k === t.dataset.k ? { k: nb.k, op: !nb.op } : { k: t.dataset.k, op: t.dataset.k !== 'saldo' };
        render();
        break;
      }
      case 'fold-side': {
        var fold = !sideFoldet();
        try { localStorage.setItem('ws-side-foldet', fold ? '1' : '0'); } catch (e) {}
        document.getElementById('shell').classList.toggle('foldet', fold);
        t.title = fold ? 'Fold ud' : 'Fold sammen';
        break;
      }
      case 'open-nav': document.getElementById('shell').classList.add('open'); break;
      case 'close-nav': document.getElementById('shell').classList.remove('open'); break;
      case 'close': case 'modal-bg': closeModal(); break;

      case 'koeb': openKoeb(t.dataset.id, false); break;
      case 'giv': openKoeb(t.dataset.id, true); break;
      case 'koeb-mode': koebState.oenske = val('koeb-oenske'); koebState.gave = t.dataset.g === '1'; renderKoeb(); break;
      case 'koeb-variant': koebState.variant = t.dataset.v; renderKoeb(); break;
      case 'koeb-drej': {
        // Bekræft købet, så man altid ser prisen
        var hp = S.hjul.pris;
        openModal('<h2><span class="ico">🎰</span>Køb et drej</h2>' +
          '<div class="sum"><span class="muted">Pris</span><b class="num">' + wc(hp) + '</b></div>' +
          '<div class="sum"><span class="muted">Saldo efter</span><b class="num">' + wc(S.stats.saldo - hp) + '</b></div>' +
          '<div class="modal-acts"><button class="btn grow" data-act="close">Annullér</button><button class="btn primary grow" data-act="koeb-drej-ok">Køb for ' + wc(hp) + '</button></div>');
        break;
      }
      case 'koeb-drej-ok':
        busy(t, true);
        api('koeb_drej').then(function () {
          ui.reel = null;
          closeModal();
          toast('Drej købt', 'Hjulet er låst op. Tryk på Drej hjulet.');
          return refresh();
        }).catch(function (e) { busy(t, false); if (e.code !== 'TOKEN_EXPIRED' && e.code !== 'NOT_REGISTERED') toast('Det gik ikke', e.message, true); });
        break;
      case 'spin': {
        if (ui.spinning) break;
        ui.spinning = true;
        busy(t, true);
        api('spin').then(function (res) {
          reelKoer(res, function () { ui.spinning = false; visGevinst(res); refresh(); });
        }).catch(function (e) {
          ui.spinning = false; busy(t, false);
          if (e.code !== 'TOKEN_EXPIRED' && e.code !== 'NOT_REGISTERED') toast('Det gik ikke', e.message, true);
        });
        break;
      }
      case 'koeb-ok': {
        var k = koebState;
        var forud = S.shop && !S.shop.aaben;
        submit(t, 'bestil', { vareId: k.vare.id, variant: k.variant, oenske: val('koeb-oenske'), til: k.gave ? k.til : '' },
          forud ? (k.gave ? 'Din donation er forudbestilt 🎁' : k.vare.navn + ' er forudbestilt') : (k.gave ? 'Din donation er sendt 🎁' : k.vare.navn + ' er bestilt'),
          forud ? 'Den leveres, når shoppen åbner.' : 'Personlig levering, forvent lidt ventetid.');
        break;
      }
      case 'indskyd': openIndskyd(t.dataset.id); break;
      case 'ind-forslag':
        document.getElementById('ind-beloeb').value = t.dataset.n;
        document.querySelectorAll('.beloeb-chips .chip').forEach(function (c) { c.classList.toggle('on', c === t); });
        break;
      case 'ind-ok':
        submit(t, 'indskyd', { projektId: indskydState.p.id, beloeb: val('ind-beloeb') }, 'Tak for din donation til ' + indskydState.p.navn);
        break;

      case 'pfane': ui.profilFane = t.dataset.f; render(); break;
      case 'bfilter': ui.bestFilter = t.dataset.f; render(); break;
      case 'ptype': ui.postType = t.dataset.f; ui.postVis = 25; render(); break;
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
      case 'stem': {
        var til = val('mdk-til');
        var hvorfor = val('mdk-hvorfor').trim();
        if (!til) { toast('Vælg en kollega', '', true); break; }
        var navn = (S.kolleger.filter(function (u) { return u.initialer === til; })[0] || {}).navn || til;
        // Bekræftelse i en boks på siden (browserens confirm() vises ikke alle steder)
        ui.stemKlar = { til: til, begrundelse: hvorfor };
        openModal('<h2><span class="ico">🏆</span>Stem på ' + esc(navn) + '?</h2>' +
          '<p class="muted" style="margin:-8px 0 14px">Du kan kun stemme én gang i denne måned.</p>' +
          (hvorfor ? '<div class="mdk-voted" style="margin:0"><div><q>' + esc(hvorfor) + '</q></div></div>' : '') +
          '<div class="modal-acts"><button class="btn grow" data-act="close">Annullér</button><button class="btn primary grow" data-act="stem-ok">Stem</button></div>');
        break;
      }
      case 'stem-ok':
        if (!ui.stemKlar) break;
        submit(t, 'stem', ui.stemKlar, 'Tak for din stemme');
        ui.stemKlar = null;
        break;
      case 'mdk-praemie-ok':
        submit(t, 'admin_mdk_praemie', { praemie: val('mdk-praemie') }, 'Præmie gemt');
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
    if (t.dataset.act === 'koeb-til') { koebState.oenske = val('koeb-oenske'); koebState.til = t.value; renderKoeb(); }
    if (t.dataset.act === 'pperson') { ui.postPerson = t.value; ui.postVis = 25; render(); }
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
      document.querySelectorAll('.info.open, .me-menu.open').forEach(function (el) { el.classList.remove('open'); });
    }
    if (ev.key === 'Enter' && ev.target.closest && ev.target.closest('.modal') && ev.target.tagName === 'INPUT') {
      var ok = modalRoot.querySelector('.btn.primary:not([disabled])');
      if (ok) ok.click();
    }
  });

  window.addEventListener('hashchange', function () { window.scrollTo(0, 0); render(); });

  window.addEventListener('demo-notify', function (e) {
    if (ui.spinning || /^Hjul/.test(e.detail.emne)) return; // gevinsten må ikke afsløres før rullen stopper
    toast('📣 Admin får besked', e.detail.emne);
  });

  // ---------- Start ----------

  try { session = JSON.parse(store('webshoppen-session') || 'null'); } catch (e) { session = null; }
  if (session && (DEMO ? session.email : session.token)) start(); else renderLogin();
})();
