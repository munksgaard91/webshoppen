// Demo-backend: kører shared/core.js mod data i localStorage. Bruges kun når API_URL er tom.
window.Mock = (function () {
  var KEY = 'webshoppen-demo-v17';
  var ADMINS = ['demo.admin@best-one.dk'];

  var BRUGERE = [
    { email: 'demo.jst@best-one.dk', initialer: 'JST', navn: 'Demo Hjemmeside', gruppe: 'Hjemmeside', aktiv: 'ja' },
    { email: 'demo.dsi@best-one.dk', initialer: 'DSI', navn: 'Demo Redaktør', gruppe: 'Redaktør', aktiv: 'ja' },
    { email: 'demo.cbo@best-one.dk', initialer: 'CBO', navn: 'Demo Fotograf', gruppe: 'Fotograf', aktiv: 'ja' },
    { email: 'demo.jfr@best-one.dk', initialer: 'JFR', navn: 'Demo Support', gruppe: 'Support', aktiv: 'ja' }
  ];

  var DEMO_ALLE = [{ email: 'demo.admin@best-one.dk', initialer: 'RMU', navn: 'Demo Admin', gruppe: '' }].concat(BRUGERE, [{ email: 'ukendt@best-one.dk', initialer: '?', navn: 'Ikke registreret', gruppe: '' }]);

  function seed() {
    return {
      Brugere: BRUGERE.map(function (b) { return Object.assign({}, b); }),
      Config: [{ noegle: 'HJUL_PRIS', vaerdi: 15 }, { noegle: 'MDK_PRAEMIE', vaerdi: 'En snack efter eget valg' }],
      Stemmer: [],
      Spil: [],
      Menu: [
        { id: 'sodavand', navn: 'Sodavand', ikon: '🥤', pris: 10, kostpris: 8, varianter: 'Pepsi Max, Faxe Kondi, Faxe Kondi 0 kalorier, Danskvand', aktiv: 'ja' },
        { id: 'monster', navn: 'Monster', ikon: '⚡', billede: 'assets/varer/monster.webp', pris: 20, kostpris: 15, varianter: 'Hvid Monster', aktiv: 'ja' },
        { id: 'candybar', navn: 'Candybar', ikon: '🍫', pris: 8, kostpris: 6, varianter: 'Marsbar, Snickers', aktiv: 'ja' },
        { id: 'andet', navn: 'Andet?', ikon: '💡', pris: 0, kostpris: 0, snart: 'ja', aktiv: 'ja' }
      ],
      Hjul: [
        { id: 'h-candybar', navn: 'Candybar', ikon: '🍫', type: 'vare', beloeb: 0, kostpris: 6, vaegt: 28, aktiv: 'ja' },
        { id: 'h-5', navn: '5 Webcoins', ikon: '✨', type: 'webcoins', beloeb: 5, kostpris: 0, vaegt: 22, aktiv: 'ja' },
        { id: 'h-intet', navn: 'Ingen gevinst', ikon: '🙈', type: 'intet', beloeb: 0, kostpris: 0, vaegt: 25, aktiv: 'ja' },
        { id: 'h-sodavand', navn: 'Sodavand', ikon: '🥤', type: 'vare', beloeb: 0, kostpris: 8, vaegt: 10, aktiv: 'ja' },
        { id: 'h-25', navn: '25 Webcoins', ikon: '💰', type: 'webcoins', beloeb: 25, kostpris: 0, vaegt: 7, aktiv: 'ja' },
        { id: 'h-monster', navn: 'Hvid Monster', ikon: '⚡', type: 'vare', beloeb: 0, kostpris: 15, vaegt: 6, aktiv: 'ja' },
        { id: 'h-50', navn: '50 Webcoins', ikon: '🏆', type: 'webcoins', beloeb: 50, kostpris: 0, vaegt: 2, aktiv: 'ja' }
      ],
      Projekter: [
        { id: 'frokost', navn: 'Teamfrokost', ikon: '🍽️', maal: 1500, aaben: 'ja' },
        { id: 'biograf', navn: 'Tur i biografen', ikon: '🎬', maal: 800, aaben: 'ja' },
        { id: 'kage', navn: 'Kagefredag', ikon: '🍰', maal: 200, aaben: 'ja' }
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
      random: function () { return Math.random(); },
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
    var jst = Core.resolveUser(db, { email: 'demo.jst@best-one.dk' }, ADMINS);
    Core.handle(db, jst, 'bestil', { vareId: 'monster' }, Object.assign({}, e, { notify: function () {} }));
    var dsi = Core.resolveUser(db, { email: 'demo.dsi@best-one.dk' }, ADMINS);
    Core.handle(db, dsi, 'bestil', { vareId: 'candybar', variant: 'Snickers', til: 'JST' }, Object.assign({}, e, { notify: function () {} }));
    Core.handle(db, dsi, 'indskyd', { projektId: 'frokost', beloeb: 120 }, Object.assign({}, e, { notify: function () {} }));
    var stille = Object.assign({}, e, { notify: function () {} });
    var HV = ["Hjalp mig med en svær Bricks-opsætning", "Altid god stemning på kontoret", "Tog en ekstra supportvagt for mig", "Skaffede kage til hele afdelingen", "Gav mig gode råd om en kunde"];
    var nu0 = new Date(), sidst = new Date(nu0.getFullYear(), nu0.getMonth() - 1, 12, 10);
    [['DSI', 'JST', 0], ['CBO', 'DSI', 1], ['JFR', 'JST', 2], ['JST', 'DSI', 3]].forEach(function (x) {
      data.Stemmer.push({ id: 's' + x[2], tid: new Date(sidst.getTime() + x[2] * 3600e3).toISOString(), maaned: Core.maanedKey(sidst), fra: x[0], til: x[1], begrundelse: HV[x[2]] });
    });
    data.Stemmer.push({ id: 's9', tid: new Date().toISOString(), maaned: Core.maanedKey(nu0), fra: 'JST', til: 'CBO', begrundelse: HV[4] });
    [['demo.jst@best-one.dk', 'frokost', 80], ['demo.cbo@best-one.dk', 'frokost', 45], ['demo.jfr@best-one.dk', 'biograf', 60], ['demo.cbo@best-one.dk', 'biograf', 25], ['demo.jst@best-one.dk', 'kage', 80], ['demo.dsi@best-one.dk', 'kage', 70], ['demo.jfr@best-one.dk', 'kage', 50]].forEach(function (x) {
      Core.handle(db, Core.resolveUser(db, { email: x[0] }, ADMINS), 'indskyd', { projektId: x[1], beloeb: x[2] }, stille);
    });
    // Demo: alle testbrugere starter med en saldo på 67 Webcoins (resten af historikken bevares).
    BRUGERE.forEach(function (u) {
      var saldo = data.Posteringer.filter(function (p) { return p.initialer === u.initialer; }).reduce(function (sum, p) { return sum + Number(p.beloeb || 0); }, 0);
      if (saldo !== 67) data.Posteringer.push({ id: 'demo-' + u.initialer, tid: new Date().toISOString(), initialer: u.initialer, type: 'justering', beloeb: 67 - saldo, tekst: 'Demo-saldo', ref: '' });
    });
    gem();
  }

  return {
    demoBrugere: DEMO_ALLE,
    call: function (email, action, payload) {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          try {
            var demo = DEMO_ALLE.filter(function (u) { return u.email === email; })[0];
            var me = Core.resolveUser(db, { email: email, name: demo ? demo.navn : '' }, ADMINS);
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
