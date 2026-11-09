// Demo-backend: kører shared/core.js mod data i localStorage. Bruges kun når API_URL er tom.
window.Mock = (function () {
  var KEY = 'webshoppen-demo-v4';
  var ADMINS = ['demo.admin@best-one.dk'];

  var BRUGERE = [
    { email: 'demo.admin@best-one.dk', initialer: 'RMU', navn: 'Demo Admin', gruppe: 'Hjemmeside', aktiv: 'ja' },
    { email: 'demo.jst@best-one.dk', initialer: 'JST', navn: 'Demo Hjemmeside', gruppe: 'Hjemmeside', aktiv: 'ja' },
    { email: 'demo.dsi@best-one.dk', initialer: 'DSI', navn: 'Demo Redaktør', gruppe: 'Redaktør', aktiv: 'ja' },
    { email: 'demo.cbo@best-one.dk', initialer: 'CBO', navn: 'Demo Fotograf', gruppe: 'Fotograf', aktiv: 'ja' },
    { email: 'demo.jfr@best-one.dk', initialer: 'JFR', navn: 'Demo Support', gruppe: 'Support', aktiv: 'ja' }
  ];

  function seed() {
    return {
      Brugere: BRUGERE.map(function (b) { return Object.assign({}, b); }),
      Menu: [
        { id: 'sodavand', navn: 'Sodavand', ikon: '🥤', pris: 10, kostpris: 8, aktiv: 'ja' },
        { id: 'monster', navn: 'Monster', ikon: '⚡', pris: 20, kostpris: 15, aktiv: 'ja' },
        { id: 'kaffe', navn: 'Kaffe to go', ikon: '☕', pris: 30, kostpris: 35, aktiv: 'ja' },
        { id: 'is', navn: 'Is', ikon: '🍦', pris: 15, kostpris: 12, aktiv: 'ja' },
        { id: 'slik', navn: 'Slikpose', ikon: '🍬', pris: 15, kostpris: 20, aktiv: 'ja' },
        { id: 'morgenmad', navn: 'Morgenmad', ikon: '🥐', pris: 40, kostpris: 45, aktiv: 'ja' }
      ],
      Projekter: [
        { id: 'frokost', navn: 'Teamfrokost', ikon: '🍽️', maal: 1500, aaben: 'ja' },
        { id: 'biograf', navn: 'Tur i biografen', ikon: '🎬', maal: 800, aaben: 'ja' }
      ],
      Posteringer: [],
      Bestillinger: [],
      Kilder: [
        { kilde: 'nyfak', navn: 'Nyfak' },
        { kilde: 'genfak', navn: 'Genfak' },
        { kilde: 'anmeldelser', navn: 'Anmeldelser' },
        { kilde: 'leverancer', navn: 'Leverancer' }
      ],
      Regler: [
        { gruppe: 'Hjemmeside', kilde: 'nyfak', sats: 0.001, tekst: '1 Webcoin pr. 1.000 kr' },
        { gruppe: 'Hjemmeside', kilde: 'anmeldelser', sats: 15, tekst: '15 Webcoins pr. anmeldelse' },
        { gruppe: 'Redaktør', kilde: 'leverancer', sats: 4, tekst: '4 Webcoins pr. leverance' },
        { gruppe: 'Redaktør', kilde: 'anmeldelser', sats: 15, tekst: '15 Webcoins pr. anmeldelse' },
        { gruppe: 'Fotograf', kilde: 'leverancer', sats: 6, tekst: '6 Webcoins pr. optagelse' },
        { gruppe: 'Fotograf', kilde: 'anmeldelser', sats: 15, tekst: '15 Webcoins pr. anmeldelse' },
        { gruppe: 'Support', kilde: 'genfak', sats: 0.002, tekst: '2 Webcoins pr. 1.000 kr' },
        { gruppe: 'Support', kilde: 'anmeldelser', sats: 15, tekst: '15 Webcoins pr. anmeldelse' }
      ]
    };
  }

  var data = null;
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { data = null; }

  var db = {
    all: function (t) { return data[t] || (data[t] = []); },
    insert: function (t, o) { db.all(t).push(Object.assign({}, o)); },
    update: function (t, row, patch) { Object.assign(row, patch); }
  };

  // Falske kildetal for de seneste 4 måneder, så der er noget at se på.
  function falskeKilder(nu) {
    var k = { nyfak: {}, genfak: {}, anmeldelser: {}, leverancer: {} };
    var tilfaeldig = (function (s) { return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })(42);
    data.Brugere.forEach(function (u) {
      for (var i = 3; i >= 0; i--) {
        var mk = Core.maanedKey(new Date(nu.getFullYear(), nu.getMonth() - i, 1));
        var key = u.initialer + '|' + mk;
        var del = i === 0 ? 0.3 : 1;
        k.nyfak[key] = Math.round((80000 + tilfaeldig() * 160000) * del);
        k.genfak[key] = Math.round((60000 + tilfaeldig() * 120000) * del);
        k.anmeldelser[key] = Math.round(tilfaeldig() * 4 * del);
        k.leverancer[key] = Math.round((10 + tilfaeldig() * 30) * del);
      }
    });
    return k;
  }

  function env() {
    return {
      now: function () { return new Date(); },
      uuid: function () { return Math.random().toString(36).slice(2, 10); },
      notify: function (b) {
        window.dispatchEvent(new CustomEvent('demo-notify', { detail: b }));
      },
      teambudget: function () { return { budget: 25000, brugt: 8450, rest: 16550, saeson: '2026/27' }; },
      // Demo: åben som standard. ?lukket=tid eller ?lukket=fravaer viser lukket shop.
      shop: function () {
        var m = (location.search.match(/[?&]lukket=(\w+)/) || [])[1];
        if (m === 'fravaer') return { aaben: false, grund: 'fravaer', tekst: 'Tilbage mandag kl. 08:00' };
        if (m === 'tid') return Core.aabningstider(new Date(new Date().setHours(17, 0)), '08:00', '15:30', '1-5');
        return { aaben: true };
      },
      sync: function () { return Core.applyEarnings(db, falskeKilder(new Date()), env()); }
    };
  }

  function gem() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ingen lagring – fint i demo */ }
  }

  if (!data) {
    data = seed();
    Core.applyEarnings(db, falskeKilder(new Date()), env());
    var e = env();
    var rmu = Core.resolveUser(db, { email: 'demo.admin@best-one.dk' }, ADMINS);
    Core.handle(db, rmu, 'bestil', { vareId: 'monster' }, Object.assign({}, e, { notify: function () {} }));
    var dsi = Core.resolveUser(db, { email: 'demo.dsi@best-one.dk' }, ADMINS);
    Core.handle(db, dsi, 'bestil', { vareId: 'kaffe', til: 'JST' }, Object.assign({}, e, { notify: function () {} }));
    Core.handle(db, dsi, 'indskyd', { projektId: 'frokost', beloeb: 120 }, Object.assign({}, e, { notify: function () {} }));
    var stille = Object.assign({}, e, { notify: function () {} });
    [['demo.jst@best-one.dk', 'frokost', 80], ['demo.cbo@best-one.dk', 'frokost', 45], ['demo.jfr@best-one.dk', 'biograf', 60], ['demo.cbo@best-one.dk', 'biograf', 25]].forEach(function (x) {
      Core.handle(db, Core.resolveUser(db, { email: x[0] }, ADMINS), 'indskyd', { projektId: x[1], beloeb: x[2] }, stille);
    });
    gem();
  }

  return {
    demoBrugere: BRUGERE.concat([{ email: 'ukendt@best-one.dk', initialer: '?', navn: 'Ikke registreret', gruppe: '' }]),
    call: function (email, action, payload) {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          try {
            var me = Core.resolveUser(db, { email: email }, ADMINS);
            var res = Core.handle(db, me, action, JSON.parse(JSON.stringify(payload || {})), env());
            if (Core.skriver(action)) gem();
            resolve(JSON.parse(JSON.stringify(res)));
          } catch (err) {
            reject(err);
          }
        }, 120);
      });
    },
    nulstil: function () {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      location.reload();
    }
  };
})();
