// Logiktest af shared/core.js (ingen Node nødvendig). Kør fra repo-roden:
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc shared/core.js tests/core.test.js
var fejl = 0, ok = 0;
function t(navn, fn) { try { fn(); ok++; } catch (e) { fejl++; print('FEJL: ' + navn + ' – ' + e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' forventede ' + JSON.stringify(b) + ' fik ' + JSON.stringify(a)); }
function kaster(fn, tekst) { try { fn(); } catch (e) { if (tekst && e.message.indexOf(tekst) < 0) throw new Error('forkert fejl: ' + e.message); return; } throw new Error('kastede ikke'); }

var data = {
  Config: [{ noegle: 'HJUL_PRIS', vaerdi: 15 }, { noegle: 'MDK_PRAEMIE', vaerdi: 'Snack' }],
  Brugere: [
    { email: 'a@best-one.dk', initialer: 'AAA', navn: 'Anna A', gruppe: 'Hjemmeside', aktiv: 'ja' },
    { email: 'b@best-one.dk', initialer: 'BBB', navn: 'Bo B', gruppe: 'Support', aktiv: 'ja' },
    { email: 'c@best-one.dk', initialer: 'CCC', navn: 'Carl C', gruppe: 'Fotograf', aktiv: 'nej' }
  ],
  Menu: [
    { id: 'soda', navn: 'Sodavand', pris: 10, kostpris: 8, varianter: 'Pepsi Max, Danskvand', aktiv: 'ja' },
    { id: 'mon', navn: 'Monster', pris: 20, kostpris: 15, varianter: 'Hvid Monster', aktiv: 'ja' },
    { id: 'cola', navn: 'Sodavand uden valg', pris: 10, kostpris: 8, oenske: 'ja', aktiv: 'ja' },
    { id: 'andet', navn: 'Andet', pris: 0, snart: 'ja', aktiv: 'ja' }
  ],
  Hjul: [
    { id: 'h1', navn: 'Candybar', type: 'vare', kostpris: 6, vaegt: 1, aktiv: 'ja' },
    { id: 'h2', navn: '25 Webcoins', type: 'webcoins', beloeb: 25, vaegt: 1, aktiv: 'ja' },
    { id: 'h3', navn: 'Ingen', type: 'intet', vaegt: 1, aktiv: 'ja' }
  ],
  Projekter: [{ id: 'p1', navn: 'Frokost', maal: 100, aaben: 'ja' }],
  Posteringer: [
    { id: 'x1', tid: '2026-11-01T10:00:00.000Z', initialer: 'AAA', type: 'justering', beloeb: 100, tekst: 'Start' },
    { id: 'x2', tid: '2026-11-01T10:00:00.000Z', initialer: 'BBB', type: 'justering', beloeb: 100, tekst: 'Start' }
  ],
  Bestillinger: [], Stemmer: [], Kilder: [], Regler: []
};
var db = {
  all: function (t) { return data[t] || (data[t] = []); },
  insert: function (t, o) { db.all(t).push(Object.assign({}, o)); },
  update: function (t, r, p) { Object.assign(r, p); }
};
var n = 0, tal = 0, aaben = true, beskeder = [];
var env = {
  now: function () { return new Date(2026, 10, 15, 12, 0); },
  uuid: function () { return 'id' + (++n); },
  random: function () { return tal; },
  notify: function (b) { beskeder.push(b.emne); },
  shop: function () { return aaben ? { aaben: true } : { aaben: false, tekst: 'Lukket' }; }
};
var A = Core.resolveUser(db, { email: 'a@best-one.dk' }, ['a@best-one.dk']);
var B = Core.resolveUser(db, { email: 'b@best-one.dk' }, []);
function saldo(me) { return Core.handle(db, me, 'state', {}, env).stats.saldo; }

t('ukendt og inaktiv bruger afvises', function () {
  kaster(function () { Core.resolveUser(db, { email: 'x@best-one.dk' }, []); }, 'ikke registreret');
  kaster(function () { Core.resolveUser(db, { email: 'c@best-one.dk' }, []); }, 'ikke registreret');
});
t('variant kræves ved flere valg', function () {
  kaster(function () { Core.handle(db, A, 'bestil', { vareId: 'soda' }, env); }, 'variant');
  kaster(function () { Core.handle(db, A, 'bestil', { vareId: 'soda', variant: 'Cola' }, env); }, 'variant');
});
t('bestil med variant', function () {
  Core.handle(db, A, 'bestil', { vareId: 'soda', variant: 'Danskvand' }, env);
  eq(data.Bestillinger[0].vare, 'Sodavand · Danskvand');
  eq(saldo(A), 90);
});
t('én variant vælges automatisk', function () {
  Core.handle(db, A, 'bestil', { vareId: 'mon' }, env);
  eq(data.Bestillinger[1].vare, 'Monster · Hvid Monster');
});
t('ønske gemmes kun på varer med ønske-felt', function () {
  Core.handle(db, A, 'bestil', { vareId: 'cola', oenske: 'Pepsi Max' }, env);
  eq(data.Bestillinger[data.Bestillinger.length - 1].oenske, 'Pepsi Max');
  Core.handle(db, A, 'bestil', { vareId: 'mon', oenske: 'ignoreres' }, env);
  eq(data.Bestillinger[data.Bestillinger.length - 1].oenske, '', 'ingen ønske-felt på Monster');
  Core.handle(db, A, 'bestil', { vareId: 'soda', variant: 'Danskvand', oenske: 'ignoreres' }, env);
  eq(data.Bestillinger[data.Bestillinger.length - 1].oenske, '');
});
t('kommer snart kan ikke bestilles', function () {
  kaster(function () { Core.handle(db, A, 'bestil', { vareId: 'andet' }, env); }, 'snart');
});
t('gave til kollega + refusion trækkes fra donationer', function () {
  var r = Core.handle(db, A, 'bestil', { vareId: 'soda', variant: 'Pepsi Max', til: 'BBB' }, env);
  var st = Core.handle(db, A, 'state', {}, env).stats;
  eq(st.givet, 10); eq(st.givetAntal, 1);
  Core.handle(db, A, 'admin_bestilling', { id: r.id, status: 'annulleret' }, env);
  st = Core.handle(db, A, 'state', {}, env).stats;
  eq(st.givet, 0, 'givet efter refusion'); eq(st.givetAntal, 0);
  eq(Core.handle(db, B, 'state', {}, env).stats.gaverModtaget, 1);
});
t('ikke-admin kan ikke admin-handlinger', function () {
  kaster(function () { Core.handle(db, B, 'admin_state', {}, env); }, 'admin');
});
t('forudbestilling når shoppen er lukket', function () {
  aaben = false;
  var r = Core.handle(db, B, 'bestil', { vareId: 'mon' }, env);
  aaben = true;
  eq(r.forud, true);
});
t('ikke nok Webcoins', function () {
  data.Projekter.push({ id: 'p0', navn: 'Uden mål', maal: 0, aaben: 'ja' });
  kaster(function () { Core.handle(db, B, 'indskyd', { projektId: 'p0', beloeb: 9999 }, env); }, 'ikke nok');
});
t('lykkehjul: vare, webcoins og intet', function () {
  var foer = saldo(B);
  kaster(function () { Core.handle(db, B, 'spin', {}, env); }, 'Køb et drej');
  var drej = function (v) { Core.handle(db, B, 'koeb_drej', {}, env); tal = v; return Core.handle(db, B, 'spin', {}, env).id; };
  eq(drej(0.1), 'h1'); eq(drej(0.5), 'h2'); eq(drej(0.9), 'h3');
  Core.handle(db, B, 'koeb_drej', {}, env);
  eq(Core.handle(db, B, 'state', {}, env).hjul.klar, 1, 'et drej klar');
  kaster(function () { Core.handle(db, B, 'koeb_drej', {}, env); }, 'allerede');
  tal = 0.9; Core.handle(db, B, 'spin', {}, env); foer -= 15;
  eq(saldo(B), foer - 45 + 25, 'saldo efter 3 drej');
  eq(data.Bestillinger.filter(function (b) { return b.vare === 'Hjulgevinst: Candybar'; }).length, 1);
  beskeder = []; Core.handle(db, B, 'koeb_drej', {}, env); tal = 0.9; Core.handle(db, B, 'spin', {}, env); foer -= 15;
  eq(beskeder.length, 1, 'besked ved ingen gevinst');
  eq(data.Spil.filter(function (x) { return x.status === 'drejet'; }).length, 5, 'alle drej registreret');
});
t('hjulets vægte vises ikke for brugere', function () {
  var f = Core.handle(db, B, 'state', {}, env).hjul.felter[0];
  eq(f.vaegt, undefined);
});
t('månedens kollega: ikke sig selv, begrundelse, én gang', function () {
  kaster(function () { Core.handle(db, A, 'stem', { til: 'AAA', begrundelse: 'Lang nok begrundelse' }, env); }, 'kollega');
  kaster(function () { Core.handle(db, A, 'stem', { til: 'CCC', begrundelse: 'Lang nok begrundelse' }, env); }, 'findes');
  Core.handle(db, A, 'stem', { til: 'BBB', begrundelse: 'test' }, env); // begrundelse er frivillig og må være kort
  kaster(function () { Core.handle(db, A, 'stem', { til: 'BBB', begrundelse: 'Hjalp med en kunde' }, env); }, 'allerede');
});
t('stemmer er hemmelige for brugere', function () {
  var m = Core.handle(db, B, 'state', {}, env).mdk;
  eq(m.minStemme, null);
  eq(JSON.stringify(m).indexOf('stemmer'), -1);
});
t('tie-breaker: første stemme vinder', function () {
  data.Stemmer.push({ id: 's1', tid: '2026-10-05T09:00:00.000Z', maaned: '2026-10', fra: 'CCC', til: 'BBB', begrundelse: 'x' });
  data.Stemmer.push({ id: 's2', tid: '2026-10-04T09:00:00.000Z', maaned: '2026-10', fra: 'BBB', til: 'AAA', begrundelse: 'y' });
  eq(Core.handle(db, B, 'state', {}, env).mdk.sidste.initialer, 'AAA');
});
t('præmie: Coming soon ved ny måned, indtil admin vælger', function () {
  eq(Core.handle(db, B, 'state', {}, env).mdk.praemie, '');
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Rasmus' }, ['demo.admin@best-one.dk']);
  Core.handle(db, adm, 'admin_mdk_praemie', { praemie: '25 Webcoins' }, env);
  eq(Core.handle(db, B, 'state', {}, env).mdk.praemie, '25 Webcoins');
  data.Config.forEach(function (r) { if (r.noegle === 'MDK_PRAEMIE_MAANED') r.vaerdi = '2026-10'; });
  eq(Core.handle(db, B, 'state', {}, env).mdk.praemie, '');
});
t('optjening er idempotent', function () {
  data.Regler.push({ gruppe: 'Support', kilde: 'genfak', sats: 0.002 });
  var k = { genfak: { 'BBB|2026-11': 10000 } };
  eq(Core.applyEarnings(db, k, env).nye, 1);
  eq(Core.applyEarnings(db, k, env).nye, 0);
  k.genfak['BBB|2026-11'] = 20000;
  eq(Core.applyEarnings(db, k, env).rettede, 1);
});
t('åbningstider', function () {
  eq(Core.aabningstider(new Date(2026, 10, 16, 9, 0)).aaben, true);
  eq(Core.aabningstider(new Date(2026, 10, 16, 15, 30)).aaben, false);
  eq(Core.aabningstider(new Date(2026, 10, 15, 12, 0)).tekst, 'Åbner i morgen kl. 08:00');
});
t('ren admin deltager ikke, men kan moderere', function () {
  var R = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Rasmus' }, ['demo.admin@best-one.dk']);
  eq(R.admin, true); eq(R.initialer, '');
  kaster(function () { Core.handle(db, R, 'bestil', { vareId: 'mon' }, env); }, 'initialer');
  kaster(function () { Core.handle(db, R, 'spin', {}, env); }, 'initialer');
  kaster(function () { Core.handle(db, R, 'koeb_drej', {}, env); }, 'initialer');
  kaster(function () { Core.handle(db, R, 'stem', { til: 'BBB', begrundelse: 'Lang nok begrundelse' }, env); }, 'initialer');
  kaster(function () { Core.handle(db, B, 'stem', { til: '', begrundelse: 'Lang nok begrundelse' }, env); }, 'kollega');
  var navne = Core.handle(db, B, 'state', {}, env).kolleger.map(function (k) { return k.initialer; });
  eq(navne.indexOf(''), -1, 'admin står ikke som kollega');
  eq(Array.isArray(Core.handle(db, R, 'admin_state', {}, env).brugere), true);
});
t('forslag sendes til admin', function () {
  beskeder = [];
  kaster(function () { Core.handle(db, B, 'forslag', { type: 'vare', tekst: 'hej' }, env); }, 'forslag');
  Core.handle(db, B, 'forslag', { type: 'projekt', tekst: 'Bowling for hele teamet' }, env);
  eq(beskeder[0], 'Forslag til projekt fra Bo B');
  Core.handle(db, B, 'forslag', { type: 'feedback', tekst: 'Mørkt tema er fedt' }, env);
  eq(beskeder[1], 'Feedback på Webshoppen fra Bo B');
});
t('fuldt projekt kan ikke få flere donationer', function () {
  data.Projekter.push({ id: 'p2', navn: 'Lille', maal: 20, aaben: 'ja' });
  kaster(function () { Core.handle(db, A, 'indskyd', { projektId: 'p2', beloeb: 25 }, env); }, 'mangler kun 20');
  Core.handle(db, A, 'indskyd', { projektId: 'p2', beloeb: 20 }, env);
  kaster(function () { Core.handle(db, A, 'indskyd', { projektId: 'p2', beloeb: 1 }, env); }, 'fuldt');
});
t('saldoen kan aldrig gå i minus', function () {
  data.Brugere.push({ email: 'f@best-one.dk', initialer: 'FFF', navn: 'Fattig F', gruppe: 'Support', aktiv: 'ja' });
  var F = Core.resolveUser(db, { email: 'f@best-one.dk' }, []);
  data.Posteringer.push({ id: 'f1', tid: '2026-11-01T10:00:00.000Z', initialer: 'FFF', type: 'justering', beloeb: 12, tekst: 'Start' });
  kaster(function () { Core.handle(db, F, 'bestil', { vareId: 'mon' }, env); }, 'ikke nok');
  kaster(function () { Core.handle(db, F, 'bestil', { vareId: 'mon', til: 'BBB' }, env); }, 'ikke nok');
  kaster(function () { Core.handle(db, F, 'koeb_drej', {}, env); }, 'ikke nok');
  kaster(function () { Core.handle(db, F, 'indskyd', { projektId: 'p0', beloeb: 13 }, env); }, 'ikke nok');
  kaster(function () { Core.handle(db, A, 'admin_justering', { initialer: 'FFF', beloeb: -13, tekst: 'Fejl' }, env); }, 'minus');
  Core.handle(db, F, 'bestil', { vareId: 'cola', oenske: '' }, env);
  eq(Core.handle(db, F, 'state', {}, env).stats.saldo, 2, 'kun det, der var råd til');
  Core.handle(db, A, 'admin_justering', { initialer: 'FFF', beloeb: -2, tekst: 'Ned til nul' }, env);
  eq(Core.handle(db, F, 'state', {}, env).stats.saldo, 0);
});
print('OK: ' + ok + '  FEJL: ' + fejl);
