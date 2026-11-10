/*
 * Webshoppen – forretningslogik.
 * Delt mellem demo-backend (assets/mock.js) og Apps Script (indsættes som Core.gs).
 * Må IKKE bruge Google-API'er eller DOM. Al adgang til data går gennem `db`:
 *   db.all(tabel)                -> array af rækker (objekter)
 *   db.insert(tabel, obj)        -> indsætter række
 *   db.update(tabel, række, ret) -> retter felter på en række fra db.all
 * og `env`:
 *   env.now() -> Date, env.uuid() -> string, env.notify(besked), env.teambudget(), env.sync()
 */
var Core = (function () {
  var GRUPPER = ['Hjemmeside', 'Redaktør', 'Fotograf', 'Support'];
  var MAANEDER = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];

  var TABELLER = {
    Config: ['noegle', 'vaerdi'],
    Brugere: ['email', 'initialer', 'navn', 'gruppe', 'aktiv'],
    Stemmer: ['id', 'tid', 'maaned', 'fra', 'til', 'begrundelse'],
    Spil: ['id', 'tid', 'initialer', 'status', 'resultat'],
    Posteringer: ['id', 'tid', 'initialer', 'type', 'beloeb', 'tekst', 'ref'],
    Bestillinger: ['id', 'tid', 'fra', 'til', 'vare', 'pris', 'kostpris', 'status', 'forud', 'oenske'],
    Kilder: ['kilde', 'navn', 'sheet_id', 'fane', 'kol_initialer', 'kol_vaerdi', 'kol_dato', 'start_raekke'],
    Regler: ['gruppe', 'kilde', 'sats', 'tekst', 'navn', 'fra'],
    Afregning: ['maaned', 'sendt', 'tid'],
    Maal: ['maaned', 'navn', 'tekst', 'retning', 'graense', 'nu', 'enhed'],
    // Månedens Webkollega pr. måned: præmien (sat af admin) og vinderen (sat, når admin trykker Afslør)
    Webkollega: ['maaned', 'praemie', 'vinder', 'afsloeret']
  };

  function err(code, msg) {
    var e = new Error(msg || code);
    e.code = code;
    return e;
  }

  // Tal fra ark kan være 463867, "463.867", "kr 463.867,50" osv.
  function num(v) {
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    if (v === null || v === undefined || v === '') return 0;
    var s = String(v).replace(/kr\.?|\s|WC/gi, '');
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else s = s.replace(/,/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  // Tom celle = sand (aktiv). "nej", "false", 0 = falsk.
  function sand(v) {
    if (v === false || v === 0) return false;
    var s = String(v === undefined || v === null ? '' : v).trim().toLowerCase();
    return !(s === 'false' || s === 'nej' || s === '0' || s === 'falsk');
  }

  function str(v) { return v === undefined || v === null ? '' : String(v); }
  function ini(v) { return str(v).trim().toUpperCase(); }

  function maanedKey(d) {
    d = new Date(d);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
  }
  function maanedNavn(key) {
    var p = String(key).split('-');
    return MAANEDER[Number(p[1]) - 1] + ' ' + p[0];
  }
  // Optjening tælles i den måned den er optjent for, ikke hvornår synk kørte.
  function postMaaned(p) {
    if (p.type === 'optjent' && p.ref) {
      var dele = String(p.ref).split(':');
      if (dele.length >= 4) return dele[2];
    }
    return maanedKey(p.tid);
  }

  // Åbningstid, fx 08:00–15:30 på hverdage (dage "1-5", mandag = 1).
  var DAGE = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
  function tilMin(s) { var p = String(s || '0:0').split(':'); return Number(p[0]) * 60 + Number(p[1] || 0); }
  function aabningstider(nu, aabner, lukker, dage) {
    aabner = aabner || '08:00'; lukker = lukker || '15:30';
    var interval = String(dage || '1-5').split('-').map(Number);
    var fra = interval[0], til = interval[1] || interval[0];
    var erDag = function (d) { return d >= fra && d <= til; };
    var d = new Date(nu);
    var dag = d.getDay() || 7;
    var min = d.getHours() * 60 + d.getMinutes();
    if (erDag(dag) && min >= tilMin(aabner) && min < tilMin(lukker)) return { aaben: true };
    var tekst;
    if (erDag(dag) && min < tilMin(aabner)) tekst = 'Åbner i dag kl. ' + aabner;
    else {
      for (var i = 1; i <= 7; i++) {
        var n = ((dag - 1 + i) % 7) + 1;
        if (erDag(n)) { tekst = 'Åbner ' + (i === 1 ? 'i morgen' : DAGE[n - 1]) + ' kl. ' + aabner; break; }
      }
    }
    return { aaben: false, grund: 'tid', tekst: tekst || '', tider: aabner + '–' + lukker };
  }

  function nyesteFoerst(a, b) { return String(b.tid).localeCompare(String(a.tid)); }

  function saldoFor(posteringer, initialer) {
    var s = 0;
    for (var i = 0; i < posteringer.length; i++) if (posteringer[i].initialer === initialer) s += num(posteringer[i].beloeb);
    return s;
  }

  function statsFor(posteringer, initialer, nu) {
    var mk = maanedKey(nu);
    var st = { saldo: 0, optjentMaaned: 0, optjentTotal: 0, brugt: 0, brugtSelv: 0, spins: 0, givet: 0, givetAntal: 0, indskudt: 0, gaverModtaget: 0, forloeb: [] };
    var perMaaned = {};
    // Refusion af en gave trækkes fra donationer, ellers fra "til dig selv".
    var gaveRefs = {};
    posteringer.forEach(function (p) { if (p.initialer === initialer && p.type === 'gave') gaveRefs[str(p.ref)] = 1; });
    posteringer.forEach(function (p) {
      if (p.initialer !== initialer) return;
      var b = num(p.beloeb);
      st.saldo += b;
      if (p.type === 'optjent') {
        st.optjentTotal += b;
        var m = postMaaned(p);
        perMaaned[m] = (perMaaned[m] || 0) + b;
        if (m === mk) st.optjentMaaned += b;
      }
      if (p.type === 'koeb') { st.brugt -= b; st.brugtSelv -= b; }
      if (p.type === 'hjul') { st.brugt -= b; st.spins -= b; }
      if (p.type === 'gave') { st.brugt -= b; st.givet -= b; st.givetAntal++; }
      if (p.type === 'projekt') { st.brugt -= b; st.indskudt -= b; }
      if (p.type === 'refusion') {
        st.brugt -= b;
        if (gaveRefs[str(p.ref)]) { st.givet -= b; st.givetAntal--; } else st.brugtSelv -= b;
      }
      if (p.type === 'gave_modtaget') st.gaverModtaget++;
    });
    // Seneste 6 måneder til sparkline
    var d = new Date(nu);
    for (var i = 5; i >= 0; i--) {
      var k = maanedKey(new Date(d.getFullYear(), d.getMonth() - i, 1));
      st.forloeb.push({ maaned: k, beloeb: perMaaned[k] || 0 });
    }
    return st;
  }

  // Sortimentet (menu, hjul, events) ligger i koden: shared/sortiment.js (global SORTIMENT), ikke i arket.
  function sortiment() {
    var s = typeof SORTIMENT !== 'undefined' ? SORTIMENT : {};
    return { menu: s.menu || [], hjul: s.hjul || [], events: s.events || [], hjulPris: s.hjulPris === undefined ? 30 : s.hjulPris, startWebcoins: num(s.startWebcoins) };
  }
  // Mangler feltet, er varen/eventet med (aktiv/aaben er standard)
  function til(v) { return v === undefined || v === '' || sand(v); }
  // Kun et udtrykkeligt ja/true tæller (oenske, snart)
  function ja(v) { return v === true || /^(ja|true|1)$/i.test(str(v).trim()); }

  function projekterMedStatus(db, initialer) {
    var poster = db.all('Posteringer');
    var navne = {};
    db.all('Brugere').forEach(function (u) { navne[ini(u.initialer)] = str(u.navn); });
    return sortiment().events.map(function (p) {
      var indsamlet = 0, mit = 0, pr = {};
      poster.forEach(function (x) {
        if (x.type === 'projekt' && str(x.ref) === str(p.id)) {
          indsamlet -= num(x.beloeb);
          pr[x.initialer] = (pr[x.initialer] || 0) - num(x.beloeb);
          if (initialer && x.initialer === initialer) mit -= num(x.beloeb);
        }
      });
      var top = Object.keys(pr).filter(function (i) { return pr[i] > 0; })
        .sort(function (a, b) { return pr[b] - pr[a]; }).slice(0, 10)
        .map(function (i) { return { initialer: i, navn: navne[i] || i, beloeb: pr[i] }; });
      return { id: str(p.id), navn: str(p.navn), ikon: str(p.ikon), maal: num(p.maal), aaben: til(p.aaben), indsamlet: indsamlet, mitBidrag: mit, top: top };
    });
  }

  function menu(db, alle) {
    return sortiment().menu.filter(function (v) { return alle || til(v.aktiv); }).map(function (v) {
      return { id: str(v.id), navn: str(v.navn), ikon: str(v.ikon), billede: str(v.billede), pris: num(v.pris), kostpris: num(v.kostpris), varianter: varianter(v), oenskeFelt: ja(v.oenske), snart: ja(v.snart), aktiv: til(v.aktiv) };
    });
  }

  // "Pepsi Max, Faxe Kondi" -> ['Pepsi Max', 'Faxe Kondi']
  function varianter(v) {
    return str(v.varianter).split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(String);
  }

  function cfgVal(db, noegle, std) {
    var v = null;
    db.all('Config').forEach(function (r) { if (str(r.noegle).trim() === noegle) v = r.vaerdi; });
    return v === null || v === '' ? std : v;
  }

  function hjulFelter(db, alle) {
    return sortiment().hjul.filter(function (h) { return alle || til(h.aktiv); }).map(function (h) {
      return { id: str(h.id), navn: str(h.navn), ikon: str(h.ikon), type: str(h.type) || 'intet', beloeb: num(h.beloeb), kostpris: num(h.kostpris), vaegt: num(h.vaegt), aktiv: til(h.aktiv) };
    });
  }

  // Fælles mål for måneden (fanen Maal). retning 'under' = skal være under grænsen, 'over' = grænsen eller mere.
  // nu = status (opdateres løbende i arket; efter månedens udgang = det opgjorte resultat). Tomt = ingen tal endnu.
  // pct = hvor tæt vi er på målet (0–100) til progressbaren. Ved 'under' = grænse ÷ nu, ved 'over' = nu ÷ grænse.
  function faellesMaal(db, mk) {
    var rows = [];
    try { rows = db.all('Maal'); } catch (e) { rows = []; }
    return rows.filter(function (r) { return str(r.maaned).trim() === mk && str(r.navn).trim(); }).map(function (r) {
      var harTal = str(r.nu).trim() !== '';
      var nuTal = num(r.nu), graense = num(r.graense);
      var under = str(r.retning).trim().toLowerCase() === 'under';
      var naaet = harTal ? (under ? nuTal < graense : nuTal >= graense) : false;
      var pct = !harTal ? 0 : naaet ? 100 : under ? (nuTal > 0 ? graense / nuTal * 100 : 100) : (graense > 0 ? nuTal / graense * 100 : 100);
      return { navn: str(r.navn), tekst: str(r.tekst), enhed: str(r.enhed).trim(), retning: under ? 'under' : 'over', graense: graense, nu: harTal ? nuTal : null,
        naaet: naaet, pct: Math.max(0, Math.min(100, Math.floor(pct))) };
    });
  }

  function aktiveBrugere(db) {
    return db.all('Brugere').filter(function (u) { return sand(u.aktiv) && ini(u.initialer); });
  }

  function regler(db) {
    var kilder = {};
    db.all('Kilder').forEach(function (k) { kilder[str(k.kilde)] = str(k.navn) || str(k.kilde); });
    return db.all('Regler').map(function (r) {
      // navn = teksten i regel-boksen (fx "Per sag"); tom = kildens navn
      return { gruppe: str(r.gruppe), kilde: str(r.kilde), navn: str(r.navn) || kilder[str(r.kilde)] || str(r.kilde), sats: num(r.sats), tekst: str(r.tekst), fra: num(r.fra) };
    });
  }

  // ---------- Bruger ----------

  function resolveUser(db, profil, adminEmails) {
    var email = str(profil.email).trim().toLowerCase();
    var admin = (adminEmails || []).map(function (e) { return str(e).trim().toLowerCase(); }).indexOf(email) >= 0;
    var u = null;
    db.all('Brugere').forEach(function (r) {
      if (str(r.email).trim().toLowerCase() === email && sand(r.aktiv)) u = r;
    });
    if (!u && !admin) throw err('NOT_REGISTERED', 'Du er desværre ikke registreret.');
    return {
      email: email,
      navn: u ? str(u.navn) : str(profil.name || email),
      billede: str(profil.picture),
      initialer: u ? ini(u.initialer) : '',
      gruppe: u ? str(u.gruppe) : '',
      admin: admin
    };
  }

  function kraevBruger(me) {
    if (!me.initialer) throw err('NO_PROFILE', 'Din konto er ikke tilknyttet initialer endnu.');
  }
  function kraevAdmin(me) {
    if (!me.admin) throw err('FORBIDDEN', 'Kun for admin.');
  }

  // ---------- Handlinger ----------

  function state(db, me, data, env) {
    var nu = env.now();
    var poster = db.all('Posteringer');
    var mine = me.initialer ? poster.filter(function (p) { return p.initialer === me.initialer; }).sort(nyesteFoerst) : [];
    var bestillinger = me.initialer ? db.all('Bestillinger').filter(function (b) {
      return b.fra === me.initialer || b.til === me.initialer;
    }).sort(nyesteFoerst).slice(0, 50) : [];
    var navne = {};
    db.all('Brugere').forEach(function (u) { navne[ini(u.initialer)] = str(u.navn); });
    return {
      me: me,
      nu: nu.toISOString(),
      stats: me.initialer ? statsFor(poster, me.initialer, nu) : statsFor([], '', nu),
      menu: menu(db, false),
      projekter: projekterMedStatus(db, me.initialer).filter(function (p) { return p.aaben; }),
      kolleger: aktiveBrugere(db).filter(function (u) { return ini(u.initialer) !== me.initialer; }).map(function (u) {
        return { initialer: ini(u.initialer), navn: str(u.navn), gruppe: str(u.gruppe) };
      }).sort(function (a, b) { return a.navn.localeCompare(b.navn, 'da'); }),
      historik: mine.map(function (p) {
        return { id: str(p.id), tid: str(p.tid), type: str(p.type), beloeb: num(p.beloeb), tekst: str(p.tekst), maaned: postMaaned(p) };
      }),
      bestillinger: bestillinger.map(function (b) {
        return { id: str(b.id), tid: str(b.tid), fra: str(b.fra), fraNavn: navne[b.fra] || b.fra, til: str(b.til), tilNavn: navne[b.til] || b.til, vare: str(b.vare), pris: num(b.pris), status: str(b.status), forud: str(b.forud) === 'ja', oenske: str(b.oenske) };
      }),
      regler: regler(db),
      grupper: GRUPPER,
      teambudget: env.teambudget ? env.teambudget() : null,
      // Månedens mål + sidste måneds resultat (afgøres dagen efter månedens udgang, når tallene er opgjort)
      faellesMaal: { maaned: maanedKey(nu), maal: faellesMaal(db, maanedKey(nu)), sidste: { maaned: forrigeMaaned(maanedKey(nu)), maal: faellesMaal(db, forrigeMaaned(maanedKey(nu))) } },
      shop: env.shop ? env.shop() : { aaben: true },
      mdk: (function () {
        var mk = maanedKey(nu), sidst = forrigeMaaned(mk);
        var min = null, minHvorfor = '';
        db.all('Stemmer').forEach(function (v) { if (str(v.maaned) === mk && ini(v.fra) === me.initialer) { min = ini(v.til); minHvorfor = str(v.begrundelse); } });
        // Sidste måneds vinder vises først, når admin har trykket Afslør. Indtil da: "afsløres snart" (hvis der var stemmer).
        var row = mdkRaekke(db, sidst);
        var afsloeret = row && str(row.afsloeret).trim() && ini(row.vinder);
        var vinder = afsloeret ? { initialer: ini(row.vinder), navn: navne[ini(row.vinder)] || ini(row.vinder) } : null;
        var afventer = !afsloeret && db.all('Stemmer').some(function (v) { return str(v.maaned) === sidst; });
        return { maaned: mk, minStemme: min ? { initialer: min, navn: navne[min] || min, begrundelse: minHvorfor } : null, praemie: mdkPraemie(db, mk),
          sidste: vinder ? { maaned: sidst, initialer: vinder.initialer, navn: vinder.navn } : null, afventer: afventer ? sidst : '' };
      })(),
      hjul: { pris: Math.floor(num(sortiment().hjulPris)), klar: me.initialer ? ubrugteDrej(db, me.initialer) : 0, felter: (function () {
        // Felternes størrelse på hjulet følger chancen (andel 0–1), så hjulet viser de rigtige odds.
        var fs = hjulFelter(db, false);
        var tot = fs.reduce(function (sum, f) { return sum + Math.max(0, f.vaegt); }, 0) || 1;
        // Hovedpræmien = den største Webcoins-gevinst (får guld-baggrund på hjulet)
        var top = fs.filter(function (f) { return f.type === 'webcoins'; }).reduce(function (m, f) { return f.beloeb > m ? f.beloeb : m; }, 0);
        return fs.map(function (f) { return { id: f.id, navn: f.navn, ikon: f.ikon, type: f.type, beloeb: f.beloeb, andel: Math.round(Math.max(0, f.vaegt) / tot * 1000) / 1000, hoved: top > 0 && f.type === 'webcoins' && f.beloeb === top }; });
      })() }
    };
  }

  function bestil(db, me, data, env) {
    kraevBruger(me);
    var vare = null;
    sortiment().menu.forEach(function (v) { if (str(v.id) === str(data.vareId) && til(v.aktiv)) vare = v; });
    if (!vare) throw err('BAD', 'Varen findes ikke længere.');
    if (ja(vare.snart)) throw err('BAD', 'Varen kommer snart.');
    var valg = varianter(vare);
    var variant = '';
    if (valg.length) {
      variant = valg.length === 1 ? valg[0] : str(data.variant).trim();
      if (valg.indexOf(variant) < 0) throw err('BAD', 'Vælg en variant.');
    }
    var vareNavn = variant && variant !== str(vare.navn) ? str(vare.navn) + ' · ' + variant : str(vare.navn);
    // Varer uden valg har et frivilligt ønske-felt (fx "Kold, tak" eller "Gerne en med karamel")
    var oenske = valg.length <= 1 && ja(vare.oenske) ? str(data.oenske).trim().slice(0, 200) : '';
    // Lukket shop = forudbestilling. Den leveres, når shoppen åbner igen.
    var shop = env.shop ? env.shop() : { aaben: true };
    var forud = !shop.aaben;
    var pris = num(vare.pris);
    var gave = !!data.til;
    var modtager = { initialer: me.initialer, navn: me.navn };
    if (gave) {
      var t = ini(data.til);
      if (t === me.initialer) throw err('BAD', 'Vælg en kollega.');
      var u = null;
      aktiveBrugere(db).forEach(function (r) { if (ini(r.initialer) === t) u = r; });
      if (!u) throw err('BAD', 'Kollegaen findes ikke.');
      modtager = { initialer: t, navn: str(u.navn) };
    }
    if (saldoFor(db.all('Posteringer'), me.initialer) < pris) throw err('FUNDS', 'Du har ikke nok Webcoins.');

    var id = env.uuid();
    var tid = env.now().toISOString();
    db.insert('Bestillinger', { id: id, tid: tid, fra: me.initialer, til: modtager.initialer, vare: vareNavn, pris: pris, kostpris: num(vare.kostpris), status: 'ny', forud: forud ? 'ja' : '', oenske: oenske });
    db.insert('Posteringer', {
      id: env.uuid(), tid: tid, initialer: me.initialer, type: gave ? 'gave' : 'koeb', beloeb: -pris,
      tekst: gave ? vareNavn + ' til ' + modtager.navn : vareNavn, ref: id
    });
    if (gave) {
      db.insert('Posteringer', {
        id: env.uuid(), tid: tid, initialer: modtager.initialer, type: 'gave_modtaget', beloeb: 0,
        tekst: vareNavn + ' fra ' + me.navn, ref: id
      });
    }
    env.notify({
      emne: (forud ? 'Forudbestilling · ' : '') + (gave ? 'Gave: ' + vareNavn + ' til ' + modtager.navn : 'Bestilling: ' + vareNavn + ' til ' + me.navn),
      tekst: (gave
        ? me.navn + ' (' + me.initialer + ') giver ' + str(vare.ikon) + ' ' + vareNavn + ' til ' + modtager.navn + ' (' + modtager.initialer + ').'
        : me.navn + ' (' + me.initialer + ') har ' + (forud ? 'forudbestilt ' : 'bestilt ') + str(vare.ikon) + ' ' + vareNavn + '.') + ' Pris: ' + pris + ' Webcoins.' + (oenske ? ' Ønske: ' + oenske : '')
    });
    return { id: id, forud: forud };
  }

  // ---------- Månedens kollega ----------
  // Én stemme pr. person pr. måned. Flest stemmer vinder; ved lighed vinder den, der fik sin første stemme først.
  function forrigeMaaned(mk) {
    var p = mk.split('-');
    return maanedKey(new Date(Number(p[0]), Number(p[1]) - 2, 1));
  }
  function mdkStilling(db, mk) {
    var navne = {};
    db.all('Brugere').forEach(function (u) { navne[ini(u.initialer)] = str(u.navn); });
    var m = {};
    db.all('Stemmer').forEach(function (v) {
      if (str(v.maaned) !== mk) return;
      var t = ini(v.til);
      var o = m[t] = m[t] || { initialer: t, navn: navne[t] || t, stemmer: 0, foerste: str(v.tid), fra: [] };
      o.stemmer++;
      // Hvem der har stemt (kun til admin – state sender kun vinderens navn videre til brugerne)
      var f = ini(v.fra);
      o.fra.push({ initialer: f, navn: navne[f] || f, begrundelse: str(v.begrundelse).trim(), tid: str(v.tid) });
      if (str(v.tid) < o.foerste) o.foerste = str(v.tid);
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) {
      return b.stemmer - a.stemmer || a.foerste.localeCompare(b.foerste);
    });
  }
  // Præmien gælder kun den måned, admin har sat den for (MDK_PRAEMIE_MAANED). Ny måned = tom ("Coming soon"),
  // indtil admin vælger en ny præmie. Vinderen af sidste måned findes automatisk ud fra stemmerne.
  function mdkRaekke(db, mk) {
    var row = null;
    try { db.all('Webkollega').forEach(function (r) { if (str(r.maaned).trim() === mk) row = r; }); } catch (e) { row = null; }
    return row;
  }
  function mdkPraemie(db, mk) {
    var row = mdkRaekke(db, mk);
    if (row && str(row.praemie).trim()) return str(row.praemie).trim();
    if (str(cfgVal(db, 'MDK_PRAEMIE_MAANED', '')).trim() !== mk) return '';
    return str(cfgVal(db, 'MDK_PRAEMIE', '')).trim();
  }
  // "50 Webcoins" -> 50. Andre præmier (fx "Biografbillet") -> 0 = gives manuelt.
  function mdkWebcoins(praemie) {
    var m = str(praemie).match(/(\d[\d.]*)\s*webcoin/i);
    return m ? Math.floor(num(m[1])) : 0;
  }
  function saetCfg(db, noegle, vaerdi) {
    var row = null;
    db.all('Config').forEach(function (r) { if (str(r.noegle).trim() === noegle) row = r; });
    if (row) db.update('Config', row, { vaerdi: vaerdi }); else db.insert('Config', { noegle: noegle, vaerdi: vaerdi });
  }

  function stem(db, me, data, env) {
    kraevBruger(me);
    var mk = maanedKey(env.now());
    var har = db.all('Stemmer').some(function (v) { return str(v.maaned) === mk && ini(v.fra) === me.initialer; });
    if (har) throw err('BAD', 'Du har allerede stemt i ' + maanedNavn(mk).split(' ')[0] + '.');
    var t = ini(data.til);
    if (!t || t === me.initialer) throw err('BAD', 'Vælg en kollega.');
    var ok = aktiveBrugere(db).some(function (u) { return ini(u.initialer) === t && str(u.gruppe); });
    if (!ok) throw err('BAD', 'Kollegaen findes ikke.');
    var hvorfor = str(data.begrundelse).trim().slice(0, 500);
    db.insert('Stemmer', { id: env.uuid(), tid: env.now().toISOString(), maaned: mk, fra: me.initialer, til: t, begrundelse: hvorfor });
    return { ok: true };
  }

  // Forslag til menu eller projekter – sendes direkte til admin (mail/Chat via env.notify).
  function forslag(db, me, data, env) {
    kraevBruger(me);
    var tekst = str(data.tekst).trim().slice(0, 1000);
    if (tekst.length < 5) throw err('BAD', 'Skriv dit forslag.');
    if (str(data.type) === 'feedback') {
      env.notify({ emne: 'Feedback på Webshoppen fra ' + me.navn, tekst: me.navn + ' (' + me.initialer + ') har feedback til Webshoppen:\n\n' + tekst });
      return { ok: true };
    }
    var hvad = str(data.type) === 'projekt' ? 'events' : 'menuen';
    env.notify({ emne: 'Forslag til ' + hvad + ' fra ' + me.navn, tekst: me.navn + ' (' + me.initialer + ') foreslår til ' + hvad + ':\n\n' + tekst });
    return { ok: true };
  }

  // Kryds en måned af som sendt til RAB (eller fortryd)
  function adminAfregnet(db, me, data, env) {
    kraevAdmin(me);
    var mk = str(data.maaned);
    if (!/^\d{4}-\d{2}$/.test(mk)) throw err('BAD', 'Ugyldig måned.');
    var sendt = !!data.sendt, row = null;
    db.all('Afregning').forEach(function (r) { if (str(r.maaned) === mk) row = r; });
    var v = { sendt: sendt ? 'ja' : 'nej', tid: sendt ? env.now().toISOString() : '' };
    if (row) db.update('Afregning', row, v); else db.insert('Afregning', { maaned: mk, sendt: v.sendt, tid: v.tid });
    return { ok: true };
  }

  function adminMdkPraemie(db, me, data, env) {
    kraevAdmin(me);
    var tekst = str(data.praemie).trim();
    if (!tekst) throw err('BAD', 'Skriv en præmie.');
    var mk = maanedKey(env.now());
    saetCfg(db, 'MDK_PRAEMIE', tekst);
    saetCfg(db, 'MDK_PRAEMIE_MAANED', mk);
    // Præmien gemmes også pr. måned, så sidste måneds præmie huskes, selv om en ny er sat før afsløringen
    var row = mdkRaekke(db, mk);
    if (row) db.update('Webkollega', row, { praemie: tekst }); else db.insert('Webkollega', { maaned: mk, praemie: tekst, vinder: '', afsloeret: '' });
    return { ok: true };
  }

  // Afslør sidste måneds vinder (til briefingen): vinderen regnes ud fra stemmerne, vises for alle,
  // og en præmie i Webcoins lægges på saldoen. Kan kun ske én gang pr. måned.
  function adminMdkAfsloer(db, me, data, env) {
    kraevAdmin(me);
    var mk = forrigeMaaned(maanedKey(env.now()));
    var row = mdkRaekke(db, mk);
    if (row && str(row.afsloeret).trim()) throw err('BAD', 'Vinderen for ' + maanedNavn(mk).split(' ')[0] + ' er allerede afsløret.');
    var vinder = mdkStilling(db, mk)[0];
    if (!vinder) throw err('BAD', 'Ingen stemmer i ' + maanedNavn(mk).split(' ')[0] + '.');
    var praemie = mdkPraemie(db, mk);
    var tid = env.now().toISOString();
    var v = { praemie: praemie, vinder: vinder.initialer, afsloeret: tid };
    if (row) db.update('Webkollega', row, v); else db.insert('Webkollega', { maaned: mk, praemie: praemie, vinder: vinder.initialer, afsloeret: tid });
    var beloeb = mdkWebcoins(praemie);
    if (beloeb > 0) {
      db.insert('Posteringer', { id: env.uuid(), tid: tid, initialer: vinder.initialer, type: 'gevinst', beloeb: beloeb, tekst: 'Månedens Webkollega · ' + maanedNavn(mk), ref: 'mdk:' + mk });
    }
    return { maaned: mk, initialer: vinder.initialer, navn: vinder.navn, stemmer: vinder.stemmer, praemie: praemie, udbetalt: beloeb };
  }

  // Feelin' Lucky? – gevinsten afgøres altid her (server), aldrig i browseren.
  // Trin 1: køb et drej (betaling). Trin 2: drej (resultat). Et købt drej ligger i fanen Spil, til det bruges.
  function koebDrej(db, me, data, env) {
    kraevBruger(me);
    var pris = Math.max(0, Math.floor(num(sortiment().hjulPris)));
    var felter = hjulFelter(db, false);
    if (!felter.length) throw err('BAD', 'Hjulet er ikke sat op endnu.');
    if (ubrugteDrej(db, me.initialer) > 0) throw err('BAD', 'Du har allerede et drej klar.');
    if (saldoFor(db.all('Posteringer'), me.initialer) < pris) throw err('FUNDS', 'Du har ikke nok Webcoins.');
    var id = env.uuid(), tid = env.now().toISOString();
    if (pris) db.insert('Posteringer', { id: env.uuid(), tid: tid, initialer: me.initialer, type: 'hjul', beloeb: -pris, tekst: "Feelin' Lucky?", ref: id });
    db.insert('Spil', { id: id, tid: tid, initialer: me.initialer, status: 'koebt', resultat: '' });
    return { id: id };
  }

  function ubrugteDrej(db, initialer) {
    return db.all('Spil').filter(function (x) { return ini(x.initialer) === initialer && str(x.status) === 'koebt'; }).length;
  }

  // Feelin' Lucky? – gevinsten afgøres altid her (server), aldrig i browseren.
  function spin(db, me, data, env) {
    kraevBruger(me);
    var spil = null;
    db.all('Spil').forEach(function (x) { if (!spil && ini(x.initialer) === me.initialer && str(x.status) === 'koebt') spil = x; });
    if (!spil) throw err('BAD', 'Køb et drej først.');
    var felter = hjulFelter(db, false);
    var total = felter.reduce(function (s, f) { return s + Math.max(0, f.vaegt); }, 0);
    if (!felter.length || total <= 0) throw err('BAD', 'Hjulet er ikke sat op endnu.');
    var x = (env.random ? env.random() : Math.random()) * total;
    var vinder = felter[felter.length - 1];
    for (var i = 0, acc = 0; i < felter.length; i++) {
      acc += Math.max(0, felter[i].vaegt);
      if (x < acc) { vinder = felter[i]; break; }
    }
    var tid = env.now().toISOString();
    var ref = str(spil.id);
    // Resultatet registreres altid i fanen Spil, og admin får altid besked – også ved Webcoins og ingen gevinst.
    db.update('Spil', spil, { status: 'drejet', resultat: vinder.navn });
    var hvem = me.navn + ' (' + me.initialer + ')';
    var besked;
    if (vinder.type === 'webcoins' && vinder.beloeb > 0) {
      db.insert('Posteringer', { id: env.uuid(), tid: tid, initialer: me.initialer, type: 'gevinst', beloeb: Math.floor(vinder.beloeb), tekst: 'Hjulgevinst: ' + vinder.navn, ref: ref });
      besked = { emne: 'Hjulgevinst: ' + vinder.navn + ' til ' + me.navn, tekst: hvem + ' har vundet ' + vinder.navn + " via lykkehjulet (Feelin' Lucky?). Beløbet er lagt på saldoen automatisk." };
    } else if (vinder.type === 'vare') {
      var shop = env.shop ? env.shop() : { aaben: true };
      db.insert('Bestillinger', { id: env.uuid(), tid: tid, fra: me.initialer, til: me.initialer, vare: 'Hjulgevinst: ' + vinder.navn, pris: 0, kostpris: vinder.kostpris, status: 'ny', forud: shop.aaben ? '' : 'ja' });
      db.insert('Posteringer', { id: env.uuid(), tid: tid, initialer: me.initialer, type: 'gevinst', beloeb: 0, tekst: 'Hjulgevinst: ' + vinder.navn, ref: ref });
      besked = { emne: 'Hjulgevinst: ' + vinder.navn + ' til ' + me.navn, tekst: hvem + ' har vundet ' + str(vinder.ikon) + ' ' + vinder.navn + " via lykkehjulet (Feelin' Lucky?). Spørg om de vil have den med det samme." };
    } else {
      besked = { emne: 'Hjulet: ingen gevinst til ' + me.navn, tekst: hvem + " har drejet lykkehjulet (Feelin' Lucky?) og vandt ingenting denne gang." };
    }
    env.notify(besked);
    return { id: vinder.id, navn: vinder.navn, ikon: vinder.ikon, type: vinder.type, beloeb: vinder.beloeb };
  }


  function indskyd(db, me, data, env) {
    kraevBruger(me);
    var beloeb = Math.floor(num(data.beloeb));
    if (!(beloeb > 0)) throw err('BAD', 'Angiv et beløb.');
    var p = null;
    sortiment().events.forEach(function (x) { if (str(x.id) === str(data.projektId) && til(x.aaben)) p = x; });
    if (!p) throw err('BAD', 'Eventet er lukket.');
    // Et fuldt projekt kan ikke få flere donationer, og man kan ikke donere mere, end der mangler.
    var maal = num(p.maal);
    if (maal > 0) {
      var indsamlet = 0;
      db.all('Posteringer').forEach(function (x) { if (x.type === 'projekt' && str(x.ref) === str(p.id)) indsamlet -= num(x.beloeb); });
      var mangler = Math.max(0, maal - indsamlet);
      if (mangler <= 0) throw err('BAD', 'Eventet er fuldt. Yehaw!');
      if (beloeb > mangler) throw err('BAD', 'Der mangler kun ' + mangler + (mangler === 1 ? ' Webcoin.' : ' Webcoins.'));
    }
    if (saldoFor(db.all('Posteringer'), me.initialer) < beloeb) throw err('FUNDS', 'Du har ikke nok Webcoins.');
    db.insert('Posteringer', { id: env.uuid(), tid: env.now().toISOString(), initialer: me.initialer, type: 'projekt', beloeb: -beloeb, tekst: str(p.navn), ref: str(p.id) });
    env.notify({ emne: 'Event: ' + p.navn, tekst: me.navn + ' (' + me.initialer + ') har lagt ' + beloeb + ' Webcoins i ' + str(p.ikon) + ' ' + p.navn + '.' });
    return { ok: true };
  }

  // ---------- Admin ----------

  // Rigtige penge pr. måned: kostpris på alle bestillinger, der ikke er annulleret.
  function opgoerelse(db) {
    var m = {};
    db.all('Bestillinger').forEach(function (b) {
      if (str(b.status) === 'annulleret') return;
      var k = maanedKey(b.tid);
      var o = m[k] = m[k] || { maaned: k, antal: 0, wc: 0, kr: 0, aabne: 0, varer: {} };
      var kr = num(b.kostpris);
      o.antal++;
      o.wc += num(b.pris);
      o.kr += kr;
      if (str(b.status) === 'ny') o.aabne++;
      var v = o.varer[str(b.vare)] = o.varer[str(b.vare)] || { navn: str(b.vare), antal: 0, kr: 0 };
      v.antal++;
      v.kr += kr;
    });
    // Afregning: hvilke måneder admin har krydset af som sendt til RAB (fanen mangler i ældre ark → tom)
    var afr = {};
    try { db.all('Afregning').forEach(function (r) { if (sand(r.sendt)) afr[str(r.maaned)] = str(r.tid); }); } catch (e) { afr = {}; }
    return Object.keys(m).sort().reverse().map(function (k) {
      var o = m[k];
      o.sendt = !!afr[k];
      o.sendtTid = afr[k] || '';
      o.varer = Object.keys(o.varer).map(function (n) { return o.varer[n]; }).sort(function (a, b) { return b.kr - a.kr; });
      return o;
    });
  }

  function adminState(db, me, data, env) {
    kraevAdmin(me);
    var nu = env.now();
    var poster = db.all('Posteringer');
    var navne = {};
    db.all('Brugere').forEach(function (u) { navne[ini(u.initialer)] = str(u.navn); });
    return {
      brugere: db.all('Brugere').map(function (u) {
        var i = ini(u.initialer);
        var st = statsFor(poster, i, nu);
        return { email: str(u.email).toLowerCase(), initialer: i, navn: str(u.navn), gruppe: str(u.gruppe), aktiv: sand(u.aktiv), saldo: st.saldo, optjentMaaned: st.optjentMaaned, optjentTotal: st.optjentTotal, brugt: st.brugt };
      }).sort(function (a, b) { return a.navn.localeCompare(b.navn, 'da'); }),
      bestillinger: db.all('Bestillinger').slice().sort(nyesteFoerst).map(function (b) {
        return { id: str(b.id), tid: str(b.tid), fra: str(b.fra), fraNavn: navne[b.fra] || b.fra, til: str(b.til), tilNavn: navne[b.til] || b.til, vare: str(b.vare), pris: num(b.pris), kostpris: num(b.kostpris), status: str(b.status), forud: str(b.forud) === 'ja', oenske: str(b.oenske) };
      }),
      opgoerelse: opgoerelse(db),
      posteringer: poster.slice().sort(nyesteFoerst).slice(0, 2000).map(function (p) {
        return { id: str(p.id), tid: str(p.tid), initialer: str(p.initialer), navn: navne[p.initialer] || p.initialer, type: str(p.type), beloeb: num(p.beloeb), tekst: str(p.tekst), maaned: postMaaned(p) };
      }),
      projekter: projekterMedStatus(db, ''),
      mdk: (function () {
        var mk = maanedKey(nu), hist = [], m = mk;
        var afgivet = db.all('Stemmer').filter(function (v) { return str(v.maaned) === mk; }).length;
        var forrige = forrigeMaaned(mk), fRow = mdkRaekke(db, forrige);
        var fSkjult = !(fRow && str(fRow.afsloeret).trim());
        for (var i = 0; i < 6; i++) {
          m = forrigeMaaned(m);
          // Sidste måneds vinder står ikke i historikken, før den er afsløret (så skærmen ikke afslører den før briefingen)
          if (m === forrige && fSkjult) continue;
          var st = mdkStilling(db, m);
          if (st.length) hist.push({ maaned: m, vinder: st[0], stemmer: st.reduce(function (s, x) { return s + x.stemmer; }, 0) });
        }
        var sidst = forrigeMaaned(mk), sRow = mdkRaekke(db, sidst), sVinder = mdkStilling(db, sidst)[0] || null;
        var afsloer = { maaned: sidst, praemie: mdkPraemie(db, sidst), vinder: sVinder ? { initialer: sVinder.initialer, navn: sVinder.navn, stemmer: sVinder.stemmer } : null,
          afsloeret: !!(sRow && str(sRow.afsloeret).trim()) };
        return { maaned: mk, stilling: mdkStilling(db, mk), afgivet: afgivet, praemie: mdkPraemie(db, mk), historik: hist, afsloer: afsloer };
      })(),
      regler: regler(db),
      grupper: GRUPPER
    };
  }

  function adminBestilling(db, me, data, env) {
    kraevAdmin(me);
    var b = null;
    db.all('Bestillinger').forEach(function (x) { if (str(x.id) === str(data.id)) b = x; });
    if (!b) throw err('BAD', 'Bestillingen findes ikke.');
    var status = str(data.status);
    if (['ny', 'udleveret', 'annulleret'].indexOf(status) < 0) throw err('BAD', 'Ukendt status.');
    if (str(b.status) === 'annulleret' && status !== 'annulleret') throw err('BAD', 'En annulleret bestilling kan ikke genåbnes.');
    if (status === 'annulleret' && str(b.status) !== 'annulleret') {
      db.insert('Posteringer', { id: env.uuid(), tid: env.now().toISOString(), initialer: str(b.fra), type: 'refusion', beloeb: num(b.pris), tekst: 'Refusion: ' + str(b.vare), ref: str(b.id) });
    }
    db.update('Bestillinger', b, { status: status });
    return { ok: true };
  }

  function adminBruger(db, me, data, env) {
    kraevAdmin(me);
    var email = str(data.email).trim().toLowerCase();
    var i = ini(data.initialer);
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw err('BAD', 'Ugyldig mail.');
    if (!/^[A-ZÆØÅ]{2,5}$/.test(i)) throw err('BAD', 'Initialer skal være 2–5 bogstaver.');
    if (data.gruppe && GRUPPER.indexOf(data.gruppe) < 0) throw err('BAD', 'Ukendt gruppe.');
    var orig = str(data.origEmail || email).trim().toLowerCase();
    var rows = db.all('Brugere');
    var row = null;
    rows.forEach(function (r) {
      var e = str(r.email).trim().toLowerCase();
      if (e === orig) row = r;
    });
    rows.forEach(function (r) {
      if (r === row) return;
      if (str(r.email).trim().toLowerCase() === email) throw err('BAD', 'Mailen er allerede oprettet.');
      if (ini(r.initialer) === i) throw err('BAD', 'Initialerne ' + i + ' er allerede i brug.');
    });
    var obj = { email: email, initialer: i, navn: str(data.navn).trim(), gruppe: str(data.gruppe), aktiv: data.aktiv === false ? 'nej' : 'ja' };
    if (row) db.update('Brugere', row, obj); else db.insert('Brugere', obj);
    giveStart(db, env);
    return { ok: true };
  }


  // Startbeløb: hver bruger får SORTIMENT.startWebcoins én gang (ref start:<INI>). Kaldes ved oprettelse og ved hver synk,
  // så brugere, der er skrevet direkte ind i arket, også får dem.
  function giveStart(db, env) {
    var beloeb = Math.floor(sortiment().startWebcoins);
    if (!(beloeb > 0)) return 0;
    var har = {};
    db.all('Posteringer').forEach(function (p) { if (/^start:/.test(str(p.ref))) har[str(p.ref)] = 1; });
    var nye = 0;
    aktiveBrugere(db).forEach(function (u) {
      var ref = 'start:' + ini(u.initialer);
      if (har[ref]) return;
      db.insert('Posteringer', { id: env.uuid(), tid: env.now().toISOString(), initialer: ini(u.initialer), type: 'justering', beloeb: beloeb, tekst: 'Velkommen til Webshoppen', ref: ref });
      har[ref] = 1;
      nye++;
    });
    return nye;
  }

  function adminJustering(db, me, data, env) {
    kraevAdmin(me);
    var i = ini(data.initialer);
    var beloeb = Math.round(num(data.beloeb));
    if (!beloeb) throw err('BAD', 'Angiv et beløb.');
    var findes = db.all('Brugere').some(function (u) { return ini(u.initialer) === i; });
    if (!findes) throw err('BAD', 'Ukendte initialer.');
    // Saldoen må aldrig gå i minus – heller ikke ved en admin-justering
    var nu = saldoFor(db.all('Posteringer'), i);
    if (nu + beloeb < 0) throw err('FUNDS', 'Saldoen må ikke gå i minus. ' + i + ' har kun ' + nu + (nu === 1 ? ' Webcoin.' : ' Webcoins.'));
    db.insert('Posteringer', { id: env.uuid(), tid: env.now().toISOString(), initialer: i, type: 'justering', beloeb: beloeb, tekst: str(data.tekst).trim() || 'Justering', ref: '' });
    return { ok: true };
  }

  /*
   * Optjening. `kilder` = { kildeId: { 'INI|YYYY-MM': værdi } } (summeret pr. måned).
   * Laver/opdaterer én postering pr. regel-kilde, måned og person. Idempotent.
   */
  function applyEarnings(db, kilder, env, fraMaaned) {
    giveStart(db, env);
    var fra = fraMaaned || '0000-00';
    var navne = {};
    db.all('Kilder').forEach(function (k) { navne[str(k.kilde)] = str(k.navn) || str(k.kilde); });
    var regelListe = db.all('Regler');
    var oensket = {};
    aktiveBrugere(db).forEach(function (u) {
      var i = ini(u.initialer);
      regelListe.forEach(function (r) {
        if (str(r.gruppe) !== str(u.gruppe) || num(r.fra) > 0) return;
        var data = kilder[str(r.kilde)] || {};
        Object.keys(data).forEach(function (key) {
          var dele = key.split('|');
          if (dele[0] !== i || dele[1] < fra) return;
          var ref = 'optjent:' + str(r.kilde) + ':' + dele[1] + ':' + i;
          var beloeb = Math.floor(num(data[key]) * num(r.sats));
          oensket[ref] = { initialer: i, beloeb: (oensket[ref] ? oensket[ref].beloeb : 0) + beloeb, tekst: (navne[str(r.kilde)] || r.kilde) + ' · ' + maanedNavn(dele[1]) };
        });
      });
      // Klub-bonus (regler med `fra`): fast beløb, når månedens tal når grænsen. Kun den højeste klub pr. kilde tæller,
      // og den ligger på én fast ref, så den rykker op (Klub 15 → Klub 20), hvis tallet stiger.
      var klubber = regelListe.filter(function (r) { return str(r.gruppe) === str(u.gruppe) && num(r.fra) > 0; });
      klubber.forEach(function (r) {
        var data = kilder[str(r.kilde)] || {};
        Object.keys(data).forEach(function (key) {
          var dele = key.split('|');
          if (dele[0] !== i || dele[1] < fra) return;
          var vaerdi = num(data[key]);
          var bedst = klubber.filter(function (x) { return str(x.kilde) === str(r.kilde) && vaerdi >= num(x.fra); })
            .sort(function (a, b) { return num(b.fra) - num(a.fra); })[0];
          if (bedst !== r) return;
          var ref = 'optjent:' + str(r.kilde) + '-klub:' + dele[1] + ':' + i;
          oensket[ref] = { initialer: i, beloeb: Math.floor(num(r.sats)), tekst: (str(r.navn) || 'Klub ' + num(r.fra)) + ' · ' + maanedNavn(dele[1]) };
        });
      });
    });
    var eksisterende = {};
    db.all('Posteringer').forEach(function (p) { if (p.type === 'optjent' && p.ref) eksisterende[str(p.ref)] = p; });
    var nye = 0, rettede = 0;
    Object.keys(oensket).forEach(function (ref) {
      var o = oensket[ref];
      var p = eksisterende[ref];
      if (p) {
        if (num(p.beloeb) !== o.beloeb || str(p.tekst) !== o.tekst) { db.update('Posteringer', p, { beloeb: o.beloeb, tekst: o.tekst }); rettede++; }
      } else if (o.beloeb !== 0) {
        db.insert('Posteringer', { id: env.uuid(), tid: env.now().toISOString(), initialer: o.initialer, type: 'optjent', beloeb: o.beloeb, tekst: o.tekst, ref: ref });
        nye++;
      }
    });
    return { nye: nye, rettede: rettede };
  }

  var HANDLINGER = {
    state: state,
    bestil: bestil,
    indskyd: indskyd,
    spin: spin,
    koeb_drej: koebDrej,
    stem: stem,
    forslag: forslag,
    admin_mdk_praemie: adminMdkPraemie,
    admin_mdk_afsloer: adminMdkAfsloer,
    admin_afregnet: adminAfregnet,
    admin_state: adminState,
    admin_bestilling: adminBestilling,
    admin_bruger: adminBruger,
    admin_justering: adminJustering,
    admin_sync: function (db, me, data, env) { kraevAdmin(me); return env.sync(); }
  };
  var SKRIVER = { bestil: 1, indskyd: 1, spin: 1, koeb_drej: 1, stem: 1, admin_mdk_praemie: 1, admin_mdk_afsloer: 1, admin_afregnet: 1, admin_bestilling: 1, admin_bruger: 1, admin_justering: 1, admin_sync: 1 };

  function handle(db, me, action, data, env) {
    var fn = HANDLINGER[action];
    if (!fn) throw err('BAD', 'Ukendt handling: ' + action);
    return fn(db, me, data || {}, env);
  }

  return {
    GRUPPER: GRUPPER,
    TABELLER: TABELLER,
    err: err,
    num: num,
    sand: sand,
    maanedKey: maanedKey,
    maanedNavn: maanedNavn,
    resolveUser: resolveUser,
    handle: handle,
    skriver: function (action) { return !!SKRIVER[action]; },
    applyEarnings: applyEarnings,
    aabningstider: aabningstider
  };
})();
