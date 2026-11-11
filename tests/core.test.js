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
var n = 0, tal = 0, aaben = true, beskeder = [], sidsteBesked = null;
var env = {
  now: function () { return new Date(2026, 10, 15, 12, 0); },
  uuid: function () { return 'id' + (++n); },
  random: function () { return tal; },
  notify: function (b) { beskeder.push(b.emne); sidsteBesked = b; },
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
  eq(sidsteBesked.kunChat, true); // bestillinger kun i Chat
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
t('events er lukket (ingen donationer)', function () {
  kaster(function () { Core.handle(db, B, 'indskyd', { projektId: 'p0', beloeb: 1 }, env); }, 'Ukendt handling');
  eq(Core.handle(db, B, 'state', {}, env).projekter, undefined);
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
  beskeder = []; Core.handle(db, B, 'koeb_drej', {}, env); tal = 0.9; Core.handle(db, B, 'spin', {}, env); eq(sidsteBesked.ikon, '🎰'); eq(sidsteBesked.kunChat, true); foer -= 15;
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
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
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
  Core.applyEarnings(db, { sager: { 'BBB|2026-11': 12 } }, env); // rettet ned – tjente Webcoins beholdes
  eq(bonus()[0].beloeb, 20);
  data.Regler = data.Regler.filter(function (r) { return r.kilde !== 'sager'; });
});
t('optjening: tjente Webcoins tages aldrig fra nogen, afsluttede måneder er låst', function () {
  data.Regler.push({ gruppe: 'Support', kilde: 'gammel', sats: 2, navn: '', fra: 0 });
  var post = function (mk) { return data.Posteringer.filter(function (p) { return p.ref === 'optjent:gammel:' + mk + ':BBB'; })[0]; };
  Core.applyEarnings(db, { gammel: { 'BBB|2026-11': 5, 'BBB|2026-10': 5 } }, env);
  eq(post('2026-11').beloeb, 10);
  data.Regler = data.Regler.filter(function (r) { return r.kilde !== 'gammel'; }); // regel fjernet
  Core.applyEarnings(db, { gammel: { 'BBB|2026-11': 5 } }, env);
  eq(post('2026-11').beloeb, 10); // beholdes
  data.Regler.push({ gruppe: 'Support', kilde: 'gammel', sats: 4, navn: '', fra: 0 }); // højere sats
  Core.applyEarnings(db, { gammel: { 'BBB|2026-11': 5, 'BBB|2026-10': 5 } }, env);
  eq(post('2026-11').beloeb, 20); // indeværende måned stiger
  eq(post('2026-10'), undefined); // oktober er låst (d. 15. november) – heller ingen ny optjening
  data.Regler = data.Regler.filter(function (r) { return r.kilde !== 'gammel'; });
  data.Regler.push({ gruppe: 'Support', kilde: 'gammel', sats: 3, navn: '', fra: 0 }); // sat for højt → rettes ned
  Core.applyEarnings(db, { gammel: { 'BBB|2026-11': 5 } }, env);
  eq(post('2026-11').beloeb, 20); // almindelig hentning sænker ikke
  Core.applyEarnings(db, { gammel: { 'BBB|2026-11': 5 } }, env, null, { genberegn: true });
  eq(post('2026-11').beloeb, 15); // genberegn gør
  data.Regler = data.Regler.filter(function (r) { return r.kilde !== 'gammel'; });
});
t('audit: initialer låst, ingen 0-refusion, forslag højst 5 om dagen, ukendt handling', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
  var bb = data.Brugere.filter(function (u) { return u.initialer === 'BBB'; })[0];
  kaster(function () { Core.handle(db, adm, 'admin_bruger', { origEmail: bb.email, email: bb.email, initialer: 'BBX', navn: bb.navn, gruppe: bb.gruppe }, env); }, 'Initialer kan ikke');
  data.Bestillinger.push({ id: 'gratis1', tid: env.now().toISOString(), fra: 'BBB', til: 'BBB', vare: 'Hjulgevinst: Sodavand', pris: 0, kostpris: 10, status: 'ny' });
  Core.handle(db, adm, 'admin_bestilling', { id: 'gratis1', status: 'annulleret' }, env);
  eq(data.Posteringer.filter(function (p) { return p.ref === 'gratis1'; }).length, 0);
  var B2 = Core.resolveUser(db, { email: bb.email }, []);
  data.Forslag = (data.Forslag || []).filter(function (f) { return f.initialer !== 'BBB'; });
  for (var k = 0; k < 5; k++) Core.handle(db, B2, 'forslag', { type: 'vare', tekst: 'Forslag nummer ' + k }, env);
  kaster(function () { Core.handle(db, B2, 'forslag', { type: 'vare', tekst: 'Et forslag mere' }, env); }, 'mange forslag');
  kaster(function () { Core.handle(db, B2, 'constructor', {}, env); }, 'Ukendt');
  eq(Core.skriver('toString'), false);
  data.Forslag = data.Forslag.filter(function (f) { return f.initialer !== 'BBB'; });
});
t('startbeløb: 5 Webcoins én gang pr. bruger', function () {
  var start = function () { return data.Posteringer.filter(function (p) { return p.ref === 'start:BBB'; }); };
  Core.applyEarnings(db, {}, env);
  Core.applyEarnings(db, {}, env);
  eq(start().length, 1);
  eq(start()[0].beloeb, 5);
});
t('admin: ret saldo direkte og giv gave (Webcoins eller vare)', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
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
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
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
t('annulleret bestilling vises i popuppen, til den er set', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
  var kl = function (t, m) { return { now: function () { return new Date(2026, 10, 15, t, m); }, uuid: env.uuid, notify: env.notify, shop: env.shop }; };
  Core.handle(db, B, 'gaver_set', {}, kl(15, 0));
  Core.handle(db, B, 'bestil', { vareId: 'mon' }, kl(15, 10));
  var b = data.Bestillinger[data.Bestillinger.length - 1];
  eq(Core.handle(db, B, 'state', {}, kl(15, 20)).annulleret.length, 0, 'ingen før annullering');
  Core.handle(db, adm, 'admin_bestilling', { id: b.id, status: 'annulleret' }, kl(15, 30));
  var a = Core.handle(db, B, 'state', {}, kl(15, 40)).annulleret;
  eq(a.length, 1);
  eq(a[0].beloeb, 20);
  eq(/Monster/.test(a[0].hvad), true);
  Core.handle(db, B, 'gaver_set', { seneste: a[0].tid }, kl(15, 45));
  eq(Core.handle(db, B, 'state', {}, kl(15, 50)).annulleret.length, 0, 'vises kun én gang');
});
t('udsolgt: kan ikke bestilles, før den er på lager igen', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
  var id = data.Menu[0].id;
  Core.handle(db, adm, 'admin_udsolgt', { vareId: id, udsolgt: true }, env);
  eq(Core.handle(db, B, 'state', {}, env).menu[0].udsolgt, true);
  kaster(function () { Core.handle(db, B, 'bestil', { vareId: id, variant: 'Pepsi Max' }, env); }, 'udsolgt');
  Core.handle(db, adm, 'admin_udsolgt', { vareId: id, udsolgt: false }, env);
  eq(Core.handle(db, B, 'state', {}, env).menu[0].udsolgt, false);
});
t('luk shoppen: medarbejdere kan ikke gemme noget, admin kan', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
  kaster(function () { Core.handle(db, B, 'admin_vedligehold', { lukket: true }, env); }, 'admin');
  Core.handle(db, adm, 'admin_vedligehold', { lukket: true }, env);
  eq(Core.handle(db, B, 'state', {}, env).vedligehold, true);
  kaster(function () { Core.handle(db, B, 'bestil', { vareId: data.Menu[1].id }, env); }, 'opdateres');
  kaster(function () { Core.handle(db, B, 'koeb_drej', {}, env); }, 'opdateres');
  Core.handle(db, adm, 'admin_udsolgt', { vareId: data.Menu[0].id, udsolgt: false }, env); // admin kan stadig gemme
  Core.handle(db, adm, 'admin_vedligehold', { lukket: false }, env);
  eq(Core.handle(db, B, 'state', {}, env).vedligehold, false);
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
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
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
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
  Core.handle(db, adm, 'admin_mdk_praemie', { praemie: '25 Webcoins' }, env);
  eq(Core.handle(db, B, 'state', {}, env).mdk.praemie, '25 Webcoins');
  data.Config.forEach(function (r) { if (r.noegle === 'MDK_PRAEMIE_MAANED') r.vaerdi = '2026-10'; });
  data.Webkollega.forEach(function (w) { if (w.maaned === '2026-11') w.maaned = '2026-10'; }); // præmien blev sat i oktober
  eq(Core.handle(db, B, 'state', {}, env).mdk.praemie, '');
});
t('afslør: præmien i Webcoins udbetales én gang og huskes, selv om ny præmie er sat', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
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
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
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
  var R = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
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
  Core.handle(db, B, 'forslag', { type: 'feedback', tekst: 'Mørkt tema er fedt' }, env);
  eq(sidsteBesked.ikon, '💬');
  eq(sidsteBesked.side, 'feedback');
  eq(sidsteBesked.kunChat, undefined); // feedback går stadig også på mail
  eq(beskeder[beskeder.length - 1], 'Feedback på Webshoppen fra Bo B');
  // Gemmes også, så admin kan se det under Feedback (nyeste først, med navn)
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
  var f = Core.handle(db, adm, 'admin_state', {}, env).forslag;
  eq(f[0].tekst, 'Mørkt tema er fedt');
  eq(f[0].navn, 'Bo B');
  eq(f[0].type, 'feedback');
  eq(Core.handle(db, B, 'state', {}, env).forslag, undefined, 'kun admin ser feedback');
  kaster(function () { Core.handle(db, B, 'admin_forslag_laest', { id: f[0].id, laest: true }, env); }, 'admin');
  Core.handle(db, adm, 'admin_forslag_laest', { id: f[0].id, laest: true }, env);
  eq(!!Core.handle(db, adm, 'admin_state', {}, env).forslag[0].laest, true, 'læst = arkiveret');
  Core.handle(db, adm, 'admin_forslag_laest', { id: f[0].id, laest: false }, env);
  eq(Core.handle(db, adm, 'admin_state', {}, env).forslag[0].laest, '', 'kan gendannes');
});
t('saldoen kan aldrig gå i minus', function () {
  data.Brugere.push({ email: 'f@best-one.dk', initialer: 'FFF', navn: 'Fattig F', gruppe: 'Support', aktiv: 'ja' });
  var F = Core.resolveUser(db, { email: 'f@best-one.dk' }, []);
  data.Posteringer.push({ id: 'f1', tid: '2026-11-01T10:00:00.000Z', initialer: 'FFF', type: 'justering', beloeb: 12, tekst: 'Start' });
  kaster(function () { Core.handle(db, F, 'bestil', { vareId: 'mon' }, env); }, 'ikke nok');
  kaster(function () { Core.handle(db, F, 'bestil', { vareId: 'mon', til: 'BBB' }, env); }, 'ikke nok');
  kaster(function () { Core.handle(db, F, 'koeb_drej', {}, env); }, 'ikke nok');
  kaster(function () { Core.handle(db, A, 'admin_justering', { initialer: 'FFF', beloeb: -13, tekst: 'Fejl' }, env); }, 'minus');
  Core.handle(db, F, 'bestil', { vareId: 'cola', oenske: '' }, env);
  eq(Core.handle(db, F, 'state', {}, env).stats.saldo, 2, 'kun det, der var råd til');
  Core.handle(db, A, 'admin_justering', { initialer: 'FFF', beloeb: -2, tekst: 'Ned til nul' }, env);
  eq(Core.handle(db, F, 'state', {}, env).stats.saldo, 0);
});
t('afslør: en glemt måned kan stadig afsløres (ældste først)', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
  data.Stemmer.push({ id: 's-sep', tid: '2026-09-10T09:00:00.000Z', maaned: '2026-09', fra: 'AAA', til: 'BBB', begrundelse: '' });
  eq(Core.handle(db, adm, 'admin_state', {}, env).mdk.afsloer.maaned, '2026-09');
  eq(Core.handle(db, adm, 'admin_mdk_afsloer', {}, env).maaned, '2026-09');
  eq(/september 2026/.test(Core.maanedsrapport(db, env).tekst), false);
});
t('boot: forside + admin-data i ét kald', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
  var bb = Core.handle(db, B, 'boot', {}, env);
  eq(bb.admin, null, 'medarbejder får ingen admin-data');
  eq(bb.state.stats.saldo, Core.handle(db, B, 'state', {}, env).stats.saldo);
  eq(Core.handle(db, adm, 'boot', {}, env).admin.brugere.length > 0, true, 'admin får admin-data');
});
t('fælles mål: Tid ÷ Antal fra Web/Tekst, holdtotaler tæller ikke', function () {
  var kendte = { SMA: 'Hjemmeside', RHE: 'Hjemmeside', MNO: 'Redaktør' };
  // Web: initialer på "Samlet"-rækken under blokken; holdblokken (Gators) har ingen initialer på Samlet
  var web = [
    ['', '', 'Sæson', '', '', 'Oktober', '', '', 'November', '', ''],
    ['', '', 'Antal', 'Tid', 'Beløb', 'Antal', 'Tid', 'Beløb', 'Antal', 'Tid', 'Beløb'],
    ['', 'Hjemmeside', 7, 6.2, 0, 1, 7.3, 0, 2, 12.7, 0],
    ['', 'Redesign', 11, 5.1, 0, 4, 17.5, 0, 0, 0, 0],
    ['', 'Sager+', 4, 17.1, 0, 1, 16.5, 0, 0, 0, 0],
    ['SMA', 'Samlet', 22, 5.1, 0, 6, 24.8, 0, 2, 12.7, 0],
    ['SMA', 'Support', 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['', 'Hjemmeside', 14, 5.6, 0, 0, 3.5, 0, 0, 4.3, 0],
    ['', 'Redesign', 11, 6, 0, 1, 6.5, 0, 1, 1, 0],
    ['', 'Sager+', 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['RHE', 'Samlet', 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['RHE', 'Support', 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['', 'Hjemmeside', 99, 99, 0, 99, 99, 0, 99, 99, 0],
    ['', 'Redesign', 99, 99, 0, 99, 99, 0, 99, 99, 0],
    ['', 'Sager+', 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['', 'Samlet', 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Gators', 'Support', 0, 0, 0, 0, 0, 0, 0, 0, 0]
  ];
  eq(Core.maalTid(web, '2026-11', kendte, ['hjemmeside', 'redesign']), Math.round((12.7 + 4.3 + 1) / 3 * 100) / 100);
  eq(Core.maalTid(web, '2026-10', kendte, ['hjemmeside', 'redesign']), Math.round((7.3 + 17.5 + 3.5 + 6.5) / 6 * 100) / 100);
  eq(Core.maalTid(web, '2026-12', kendte, ['hjemmeside']), null, 'måned mangler');
  // Tekst: initialer på samme række; holdrækken (Owls) og ukendte (BLO) tæller ikke
  var tekst = [
    ['', '', '', 'Sæson', '', '', 'November', '', ''],
    ['', '', '', 'Antal', 'Tid', 'Beløb', 'Antal', 'Tid', 'Beløb'],
    ['', 'MNO', 'Tekster', 326, 0.7, 0, 33, 15, 0],
    ['', 'MNO', 'Support', 16, 76, 0, 1, 7, 0],
    ['', 'Owls', 'Tekster', 964, 0.8, 0, 67, 47.7, 0],
    ['', '', 'Samlet', 0, 0, 0, 0, 0, 0],
    ['', 'BLO', 'Tekster', 24, 0, 0, 10, 0, 0]
  ];
  eq(Core.maalTid(tekst, '2026-11', kendte, ['tekster']), Math.round(15 / 33 * 100) / 100);
});
t('fælles mål: belønning (3 af 4) sættes af admin og tælles op', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
  data.Maal = [
    { maaned: '2026-11', navn: 'A', retning: 'under', graense: 6.5, nu: 6 },
    { maaned: '2026-11', navn: 'B', retning: 'under', graense: 70, nu: 65 },
    { maaned: '2026-11', navn: 'C', retning: 'under', graense: 0.7, nu: 0.71 },
    { maaned: '2026-11', navn: 'D', retning: 'over', graense: 20, nu: 20 }
  ];
  var p = Core.handle(db, B, 'state', {}, env).faellesMaal.praemie;
  eq(p.praemie, '', 'Coming soon uden belønning');
  eq(p.antal, 3, 'standard: alle på nær ét');
  eq(p.naaet, 3);
  kaster(function () { Core.handle(db, B, 'admin_maal_praemie', { praemie: 'Teamfrokost', antal: 3 }, env); }, 'admin');
  kaster(function () { Core.handle(db, adm, 'admin_maal_praemie', { praemie: 'Teamfrokost', antal: 5 }, env); }, 'mellem 1 og 4');
  Core.handle(db, adm, 'admin_maal_praemie', { praemie: 'Teamfrokost', antal: 4 }, env);
  p = Core.handle(db, B, 'state', {}, env).faellesMaal.praemie;
  eq(p.praemie, 'Teamfrokost');
  eq(p.opnaaet, false, '3 af 4 er ikke nok, når kravet er 4');
  Core.handle(db, adm, 'admin_maal_praemie', { praemie: 'Teamfrokost', antal: 3 }, env);
  eq(Core.handle(db, B, 'state', {}, env).faellesMaal.praemie.opnaaet, true);
  eq(data.MaalPraemie.length, 1, 'samme måned opdateres');
});
t('ikon til præmier: emoji eller Webcoin-mønt, alt andet afvises', function () {
  var adm = Core.resolveUser(db, { email: 'demo.admin@best-one.dk', name: 'Demo Admin' }, ['demo.admin@best-one.dk']);
  Core.handle(db, adm, 'admin_maal_praemie', { praemie: 'Pizza', antal: 3, ikon: '🍕' }, env);
  eq(Core.handle(db, B, 'state', {}, env).faellesMaal.praemie.ikon, '🍕');
  Core.handle(db, adm, 'admin_maal_praemie', { praemie: 'Pizza', antal: 3, ikon: '<img src=x>' }, env);
  eq(Core.handle(db, B, 'state', {}, env).faellesMaal.praemie.ikon, '', 'HTML afvises');
  Core.handle(db, adm, 'admin_mdk_praemie', { praemie: '50 Webcoins', ikon: 'coin' }, env);
  eq(Core.handle(db, B, 'state', {}, env).mdk.praemieIkon, 'coin');
  Core.handle(db, adm, 'admin_mdk_praemie', { praemie: 'Biografbilletter', ikon: '🎬' }, env);
  eq(Core.handle(db, B, 'state', {}, env).mdk.praemieIkon, '🎬');
});
print('OK: ' + ok + '  FEJL: ' + fejl);
