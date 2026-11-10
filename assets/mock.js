// Demo-backend: kører shared/core.js mod data i localStorage. Bruges kun når API_URL er tom.
window.Mock = (function () {
  var KEY = 'webshoppen-demo-v53';
  var ADMINS = ['demo.admin@best-one.dk'];

  var BRUGERE = [
    { email: 'demo.jst@best-one.dk', initialer: 'JST', navn: 'Demo Hjemmeside', gruppe: 'Hjemmeside', aktiv: 'ja' },
    { email: 'demo.dsi@best-one.dk', initialer: 'DSI', navn: 'Demo Redaktør', gruppe: 'Redaktør', aktiv: 'ja' },
    { email: 'demo.cbo@best-one.dk', initialer: 'CBO', navn: 'Demo Fotograf', gruppe: 'Fotograf', aktiv: 'ja' },
    { email: 'demo.jfr@best-one.dk', initialer: 'JFR', navn: 'Demo Support', gruppe: 'Support', aktiv: 'ja' },
    // Pladsholdere, så demoen har lige så mange kolleger som det rigtige hold (13). Opdigtede navne/initialer.
    { email: 'ade@best-one.dk', initialer: 'ADE', navn: 'Anders Demo', gruppe: 'Hjemmeside', aktiv: 'ja', ekstra: true },
    { email: 'bde@best-one.dk', initialer: 'BDE', navn: 'Bente Demo', gruppe: 'Hjemmeside', aktiv: 'ja', ekstra: true },
    { email: 'cde@best-one.dk', initialer: 'CDE', navn: 'Camilla Demo', gruppe: 'Hjemmeside', aktiv: 'ja', ekstra: true },
    { email: 'dde@best-one.dk', initialer: 'DDE', navn: 'Dennis Demo', gruppe: 'Hjemmeside', aktiv: 'ja', ekstra: true },
    { email: 'ede@best-one.dk', initialer: 'EDE', navn: 'Eva Demo', gruppe: 'Hjemmeside', aktiv: 'ja', ekstra: true },
    { email: 'fde@best-one.dk', initialer: 'FDE', navn: 'Frederik Demo', gruppe: 'Hjemmeside', aktiv: 'ja', ekstra: true },
    { email: 'gde@best-one.dk', initialer: 'GDE', navn: 'Gitte Demo', gruppe: 'Redaktør', aktiv: 'ja', ekstra: true },
    { email: 'hde@best-one.dk', initialer: 'HDE', navn: 'Henrik Demo', gruppe: 'Redaktør', aktiv: 'ja', ekstra: true },
    { email: 'ide@best-one.dk', initialer: 'IDE', navn: 'Ida Demo', gruppe: 'Support', aktiv: 'ja', ekstra: true }
  ];

  var DEMO_ALLE = [{ email: 'demo.admin@best-one.dk', initialer: 'RMU', navn: 'Demo Admin', gruppe: '' }].concat(BRUGERE.filter(function (b) { return !b.ekstra; }), [{ email: 'ukendt@best-one.dk', initialer: '?', navn: 'Ikke registreret', gruppe: '' }]);

  function seed() {
    return {
      Brugere: BRUGERE.map(function (b) { return Object.assign({}, b); }),
      Config: [{ noegle: 'MDK_PRAEMIE', vaerdi: '50 Webcoins' }, { noegle: 'MDK_PRAEMIE_MAANED', vaerdi: Core.maanedKey(new Date()) }],
      Stemmer: [],
      Forslag: [
        { id: 'f1', tid: new Date(Date.now() - 2 * 864e5).toISOString(), initialer: 'DSI', type: 'vare', tekst: 'Kunne vi få Faxe Kondi Free i menuen?' },
        { id: 'f2', tid: new Date(Date.now() - 864e5).toISOString(), initialer: 'JFR', type: 'praemie', tekst: 'Pizza og brætspil en fredag eftermiddag 🍕' },
        { id: 'f3', tid: new Date(Date.now() - 3 * 36e5).toISOString(), initialer: 'JST', type: 'feedback', tekst: 'Fedt med tombolaen! Kunne være sjovt med en lyd, når den stopper.' }
      ],
      Spil: [],
      Posteringer: [],
      Bestillinger: [],
      Kilder: [
        { kilde: 'sager', navn: 'Sag' },
        { kilde: 'tekster', navn: 'Tekster' },
        { kilde: 'sessioner', navn: 'Session' },
        { kilde: 'anmeldelser', navn: 'Anmeldelse' },
        { kilde: 'konkurrencer', navn: 'Konkurrencer' },
        { kilde: 'faelles_maal', navn: 'Fælles mål' }
      ],
      Maal: [
        { maaned: Core.maanedKey(new Date()), navn: 'Hjemmeside', tekst: 'Under 6,5 t produktionstid pr. sag', retning: 'under', graense: 6.5, nu: 6.8, enhed: 't' },
        { maaned: Core.maanedKey(new Date()), navn: 'Afventer online', tekst: 'Under 70 kunder på listen', retning: 'under', graense: 70, nu: 74, enhed: 'kunder' },
        { maaned: Core.maanedKey(new Date()), navn: 'Redaktører', tekst: 'Under 0,7 t produktionstid pr. tekst', retning: 'under', graense: 0.7, nu: 0.65, enhed: 't' },
        { maaned: Core.maanedKey(new Date()), navn: 'Support', tekst: '20 anmeldelser eller flere', retning: 'over', graense: 20, nu: 14, enhed: 'anmeldelser' }
      ],
      Regler: [
        { gruppe: 'Hjemmeside', kilde: 'sager', sats: 1, tekst: '1 Webcoin', navn: 'Per sag' },
        { gruppe: 'Hjemmeside', kilde: 'sager', sats: 15, tekst: '15 Webcoins', navn: 'Klub 15', fra: 15 },
        { gruppe: 'Hjemmeside', kilde: 'sager', sats: 20, tekst: '20 Webcoins', navn: 'Klub 20', fra: 20 },
        { gruppe: 'Hjemmeside', kilde: 'sager', sats: 25, tekst: '25 Webcoins', navn: 'Klub 25', fra: 25 },
        { gruppe: 'Hjemmeside', kilde: 'anmeldelser', sats: 20, tekst: '20 Webcoins' },
        { gruppe: 'Redaktør', kilde: 'tekster', sats: 0.1, tekst: '1 Webcoin', navn: 'Per 10. tekst' },
        { gruppe: 'Redaktør', kilde: 'tekster', sats: 15, tekst: '15 Webcoins', navn: 'Klub 150', fra: 150 },
        { gruppe: 'Redaktør', kilde: 'tekster', sats: 20, tekst: '20 Webcoins', navn: 'Klub 200', fra: 200 },
        { gruppe: 'Redaktør', kilde: 'tekster', sats: 25, tekst: '25 Webcoins', navn: 'Klub 250', fra: 250 },
        { gruppe: 'Redaktør', kilde: 'anmeldelser', sats: 20, tekst: '20 Webcoins' },
        { gruppe: 'Fotograf', kilde: 'sessioner', sats: 1, tekst: '1 Webcoin', navn: 'Per session' },
        { gruppe: 'Fotograf', kilde: 'sessioner', sats: 15, tekst: '15 Webcoins', navn: 'Klub 25', fra: 25 },
        { gruppe: 'Fotograf', kilde: 'sessioner', sats: 20, tekst: '20 Webcoins', navn: 'Klub 30', fra: 30 },
        { gruppe: 'Fotograf', kilde: 'anmeldelser', sats: 20, tekst: '20 Webcoins' },
        { gruppe: 'Support', kilde: 'anmeldelser', sats: 30, tekst: '30 Webcoins' },
        { gruppe: 'Alle', kilde: 'faelles_maal', sats: 0, tekst: 'Se status' },
        { gruppe: 'Alle', kilde: 'konkurrencer', sats: 0, tekst: '?' }
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
    var k = { sager: {}, tekster: {}, sessioner: {}, anmeldelser: {} };
    var tilfaeldig = (function (s) { return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })(42);
    data.Brugere.forEach(function (u) {
      for (var i = 3; i >= 0; i--) {
        var mk = Core.maanedKey(new Date(nu.getFullYear(), nu.getMonth() - i, 1));
        var key = u.initialer + '|' + mk;
        var del = i === 0 ? 0.3 : 1;
        k.sager[key] = Math.round((2 + tilfaeldig() * 17) * del);
        k.tekster[key] = Math.round((100 + tilfaeldig() * 100) * del);
        k.sessioner[key] = Math.round((10 + tilfaeldig() * 15) * del);
        k.anmeldelser[key] = Math.round(tilfaeldig() * 4 * del);
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
      sync: function () { return Core.applyEarnings(db, falskeKilder(new Date()), env()); },
      // Demo: ?synkfejl viser banneret for en fejlet hentning
      synkStatus: function () {
        return /[?&]synkfejl\b/.test(location.search)
          ? { tid: new Date(Date.now() - 20 * 6e4).toISOString(), fejl: ['Kilde nyfak (Nyfak): Fanen "Nyfak" findes ikke'] }
          : { tid: new Date(Date.now() - 12 * 6e4).toISOString(), fejl: [] };
      }
    };
  }

  function gem() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ingen lagring – fint i demo */ }
  }

  if (!data) {
    data = seed();
    Core.applyEarnings(db, falskeKilder(new Date()), env());
    // Startbeløb, så demoens bestillinger og donationer kan betales. Rettes til sidst, så saldoen ender på 67.
    var start = {};
    BRUGERE.forEach(function (u) {
      start[u.initialer] = { id: 'demo-' + u.initialer, tid: new Date().toISOString(), initialer: u.initialer, type: 'justering', beloeb: 1000, tekst: 'Demo-saldo', ref: '' };
      data.Posteringer.push(start[u.initialer]);
    });
    var e = env();
    var jst = Core.resolveUser(db, { email: 'demo.jst@best-one.dk' }, ADMINS);
    Core.handle(db, jst, 'bestil', { vareId: 'monster' }, Object.assign({}, e, { notify: function () {} }));
    var dsi = Core.resolveUser(db, { email: 'demo.dsi@best-one.dk' }, ADMINS);
    Core.handle(db, dsi, 'bestil', { vareId: 'candybar', til: 'JST' }, Object.assign({}, e, { notify: function () {} }));
    // Én stemme fra en pladsholder, så admin ser en stilling, mens alle demobrugere selv kan stemme.
    data.Stemmer.push({ id: 's9', tid: new Date().toISOString(), maaned: Core.maanedKey(new Date()), fra: 'ADE', til: 'CBO', begrundelse: 'Gav mig gode råd om en kunde' });
    // Sidste måned: stemmer + præmie, men ikke afsløret – så admin kan prøve "Afslør vinder" (til briefingen)
    var sidstMd = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 10, 9), sidstKey = Core.maanedKey(sidstMd);
    [['ADE', 'CBO', 'Altid god stemning på kontoret'], ['BDE', 'JST', 'Hjalp mig med en svær Bricks-opsætning'], ['CDE', 'CBO', ''], ['GDE', 'DSI', 'Skaffede kage til hele afdelingen']].forEach(function (x, i) {
      data.Stemmer.push({ id: 'so' + i, tid: new Date(sidstMd.getTime() + i * 864e5).toISOString(), maaned: sidstKey, fra: x[0], til: x[1], begrundelse: x[2] });
    });
    data.Webkollega = [{ maaned: sidstKey, praemie: '50 Webcoins', vinder: '', afsloeret: '' }, { maaned: Core.maanedKey(new Date()), praemie: '50 Webcoins', vinder: '', afsloeret: '' }];
    // Demo: alle testbrugere starter med en saldo på 67 Webcoins (resten af historikken bevares).
    BRUGERE.forEach(function (u) {
      var saldo = data.Posteringer.filter(function (p) { return p.initialer === u.initialer; }).reduce(function (sum, p) { return sum + Number(p.beloeb || 0); }, 0);
      start[u.initialer].beloeb += 67 - saldo;
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
