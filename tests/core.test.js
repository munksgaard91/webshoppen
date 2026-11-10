// Logiktest af shared/core.js (ingen Node nødvendig). Kør fra repo-roden:
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc shared/core.js tests/core.test.js
var fejl = 0, ok = 0;
function t(navn, fn) { try { fn(); ok++; } catch (e) { fejl++; print('FEJL: ' + navn + ' – ' + e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' forventede ' + JSON.stringify(b) + ' fik ' + JSON.stringify(a)); }
function kaster(fn, tekst) { try { fn(); } catch (e) { if (tekst && e.message.indexOf(tekst) < 0) throw new Error('forkert fejl: ' + e.message); return; } throw new Error('kastede ikke'); }

var data = {
  Config: [{ noegle: 'MDK_PRAEMIE', vaerdi: 'Snack' }],
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
// Sortimentet ligger i koden (shared/sortiment.js); testen bruger sit eget
var SORTIMENT = { menu: data.Menu, hjul: data.Hjul, events: data.Projekter, hjulPris: 15, startWebcoins: 5 };
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
t('admin ser hvem der har stemt på hvem', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Rasmus' }, ['demo.admin@best-one.dk']);
  var st = Core.handle(db, adm, 'admin_state', {}, env).mdk.stilling;
  eq(st[0].initialer, 'BBB');
  eq(st[0].fra[0].initialer, 'AAA');
  eq(st[0].fra[0].begrundelse, 'test');
});
t('fælles mål: denne måned + sidste måneds resultat (under/over)', function () {
  data.Maal = [
    { maaned: '2026-11', navn: 'Hjemmeside', tekst: 'Under 6,5 t', retning: 'under', graense: 6.5, nu: '' },
    { maaned: '2026-10', navn: 'Hjemmeside', tekst: 'Under 6,5 t', retning: 'under', graense: 6.5, nu: '6,8' },
    { maaned: '2026-10', navn: 'Support', tekst: '20 eller flere', retning: 'over', graense: 20, nu: 20 },
    { maaned: '2026-10', navn: 'Afventer', tekst: 'Under 70', retning: 'under', graense: 70, nu: '' }
  ];
  var f = Core.handle(db, B, 'state', {}, env).faellesMaal;
  eq(f.maal.length, 1);
  eq(f.maal[0].nu, null);
  eq(f.sidste.maaned, '2026-10');
  eq(f.sidste.maal[0].naaet, false);
  eq(f.sidste.maal[1].naaet, true);
  eq(f.sidste.maal[2].nu, null);
  eq(f.sidste.maal[0].pct, 95); // 6,5 ÷ 6,8
  eq(f.sidste.maal[1].pct, 100);
  eq(f.sidste.maal[2].pct, 0);
});
t('klub-bonus: kun højeste klub, rykker op når tallet stiger', function () {
  data.Regler.push({ gruppe: 'Support', kilde: 'sager', sats: 15, navn: 'Klub 15', fra: 15 });
  data.Regler.push({ gruppe: 'Support', kilde: 'sager', sats: 20, navn: 'Klub 20', fra: 20 });
  var bonus = function () { return data.Posteringer.filter(function (p) { return p.ref === 'optjent:sager-klub:2026-11:BBB'; }); };
  Core.applyEarnings(db, { sager: { 'BBB|2026-11': 14 } }, env);
  eq(bonus().length, 0);
  Core.applyEarnings(db, { sager: { 'BBB|2026-11': 16 } }, env);
  eq(bonus()[0].beloeb, 15);
  Core.applyEarnings(db, { sager: { 'BBB|2026-11': 22 } }, env);
  eq(bonus().length, 1);
  eq(bonus()[0].beloeb, 20);
  eq(bonus()[0].tekst, 'Klub 20 · november 2026');
  data.Regler = data.Regler.filter(function (r) { return r.kilde !== 'sager'; });
});
t('startbeløb: 5 Webcoins én gang pr. bruger', function () {
  var start = function () { return data.Posteringer.filter(function (p) { return p.ref === 'start:BBB'; }); };
  Core.applyEarnings(db, {}, env);
  Core.applyEarnings(db, {}, env);
  eq(start().length, 1);
  eq(start()[0].beloeb, 5);
});
t('admin: ret saldo direkte og giv gave (Webcoins eller vare)', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Rasmus' }, ['demo.admin@best-one.dk']);
  var saldo = function () { return data.Posteringer.filter(function (p) { return p.initialer === 'BBB'; }).reduce(function (s, p) { return s + Number(p.beloeb); }, 0); };
  Core.handle(db, adm, 'admin_saldo', { initialer: 'BBB', saldo: 80 }, env);
  eq(saldo(), 80);
  kaster(function () { Core.handle(db, adm, 'admin_saldo', { initialer: 'BBB', saldo: -1 }, env); }, '0 eller mere');
  Core.handle(db, adm, 'admin_gave', { initialer: 'BBB', beloeb: 20, besked: 'Godt gået' }, env);
  eq(saldo(), 100);
  var foer = data.Bestillinger.length;
  Core.handle(db, adm, 'admin_gave', { initialer: 'BBB', vareId: data.Menu[0].id }, env);
  eq(data.Bestillinger.length, foer + 1);
  eq(data.Bestillinger[data.Bestillinger.length - 1].pris, 0);
  eq(saldo(), 100);
  kaster(function () { Core.handle(db, B, 'admin_gave', { initialer: 'BBB', beloeb: 20 }, env); }, 'admin');
});
t('gave-popup: nye gaver vises, til de er set', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Rasmus' }, ['demo.admin@best-one.dk']);
  Core.handle(db, B, 'gaver_set', {}, env);
  eq(Core.handle(db, B, 'state', {}, env).gaver.length, 0);
  var senere = { now: function () { return new Date(2026, 10, 15, 13, 0); }, uuid: env.uuid, notify: env.notify, shop: env.shop };
  Core.handle(db, adm, 'admin_gave', { initialer: 'BBB', beloeb: 10, besked: 'Tak' }, senere);
  var g = Core.handle(db, B, 'state', {}, senere).gaver;
  eq(g.length, 1);
  eq(g[0].beloeb, 10);
  eq(g[0].besked, 'Tak');
  eq(g[0].fraNavn, 'Admin');
  Core.handle(db, B, 'gaver_set', {}, { now: function () { return new Date(2026, 10, 15, 14, 0); }, uuid: env.uuid });
  eq(Core.handle(db, B, 'state', {}, senere).gaver.length, 0);
});
t('udsolgt: kan ikke bestilles, før den er på lager igen', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Rasmus' }, ['demo.admin@best-one.dk']);
  var id = data.Menu[0].id;
  Core.handle(db, adm, 'admin_udsolgt', { vareId: id, udsolgt: true }, env);
  eq(Core.handle(db, B, 'state', {}, env).menu[0].udsolgt, true);
  kaster(function () { Core.handle(db, B, 'bestil', { vareId: id, variant: 'Pepsi Max' }, env); }, 'udsolgt');
  Core.handle(db, adm, 'admin_udsolgt', { vareId: id, udsolgt: false }, env);
  eq(Core.handle(db, B, 'state', {}, env).menu[0].udsolgt, false);
});
t('månedsrapport: opgørelse for sidste måned + påmindelser', function () {
  var r = Core.maanedsrapport(db, env);
  eq(/oktober 2026/.test(r.emne), true);
  eq(/Husk:/.test(r.tekst), true);
  eq(/fanen Maal/.test(r.tekst), true);
});
t('tie-breaker: første stemme vinder', function () {
  data.Stemmer.push({ id: 's1', tid: '2026-10-05T09:00:00.000Z', maaned: '2026-10', fra: 'CCC', til: 'BBB', begrundelse: 'x' });
  data.Stemmer.push({ id: 's2', tid: '2026-10-04T09:00:00.000Z', maaned: '2026-10', fra: 'BBB', til: 'AAA', begrundelse: 'y' });
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Rasmus' }, ['demo.admin@best-one.dk']);
  // Før Afslør: vinderen er skjult for brugerne
  eq(Core.handle(db, B, 'state', {}, env).mdk.sidste, null);
  eq(Core.handle(db, B, 'state', {}, env).mdk.afventer, '2026-10');
  var r = Core.handle(db, adm, 'admin_mdk_afsloer', {}, env);
  eq(r.initialer, 'AAA');
  eq(Core.handle(db, B, 'state', {}, env).mdk.sidste.initialer, 'AAA');
  kaster(function () { Core.handle(db, adm, 'admin_mdk_afsloer', {}, env); }, 'allerede');
});
t('præmie: Coming soon ved ny måned, indtil admin vælger', function () {
  eq(Core.handle(db, B, 'state', {}, env).mdk.praemie, '');
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Rasmus' }, ['demo.admin@best-one.dk']);
  Core.handle(db, adm, 'admin_mdk_praemie', { praemie: '25 Webcoins' }, env);
  eq(Core.handle(db, B, 'state', {}, env).mdk.praemie, '25 Webcoins');
  data.Config.forEach(function (r) { if (r.noegle === 'MDK_PRAEMIE_MAANED') r.vaerdi = '2026-10'; });
  data.Webkollega.forEach(function (w) { if (w.maaned === '2026-11') w.maaned = '2026-10'; }); // præmien blev sat i oktober
  eq(Core.handle(db, B, 'state', {}, env).mdk.praemie, '');
});
t('afslør: præmien i Webcoins udbetales én gang og huskes, selv om ny præmie er sat', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Rasmus' }, ['demo.admin@best-one.dk']);
  var okt = { now: function () { return new Date(2026, 9, 20, 12, 0); }, uuid: env.uuid, notify: env.notify };
  Core.handle(db, adm, 'admin_mdk_praemie', { praemie: '50 Webcoins' }, okt); // sat i oktober
  data.Stemmer.push({ id: 's3', tid: '2026-10-06T09:00:00.000Z', maaned: '2026-10', fra: 'AAA', til: 'BBB', begrundelse: '' });
  data.Webkollega = data.Webkollega.filter(function (w) { return w.maaned !== '2026-10' || (w.afsloeret = '', w.vinder = '', true); });
  Core.handle(db, adm, 'admin_mdk_praemie', { praemie: 'Biografbillet' }, env); // ny præmie i november før afsløring
  var r = Core.handle(db, adm, 'admin_mdk_afsloer', {}, env);
  eq(r.praemie, '50 Webcoins');
  eq(r.udbetalt, 50);
  eq(data.Posteringer.filter(function (p) { return p.ref === 'mdk:2026-10'; }).length, 1);
});
t('afregning: admin krydser måned af som sendt til RAB', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Rasmus' }, ['demo.admin@best-one.dk']);
  var mk = Core.maanedKey(env.now());
  var opg = function () { return Core.handle(db, adm, 'admin_state', {}, env).opgoerelse.filter(function (o) { return o.maaned === mk; })[0]; };
  eq(opg().sendt, false);
  Core.handle(db, adm, 'admin_afregnet', { maaned: mk, sendt: true }, env);
  eq(opg().sendt, true);
  Core.handle(db, adm, 'admin_afregnet', { maaned: mk, sendt: false }, env);
  eq(opg().sendt, false);
  kaster(function () { Core.handle(db, B, 'admin_afregnet', { maaned: mk, sendt: true }, env); }, 'admin');
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
  eq(beskeder[0], 'Forslag til events fra Bo B');
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
