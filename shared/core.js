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
    Menu: ['id', 'navn', 'ikon', 'pris', 'kostpris', 'aktiv'],
    Projekter: ['id', 'navn', 'ikon', 'maal', 'aaben'],
    Posteringer: ['id', 'tid', 'initialer', 'type', 'beloeb', 'tekst', 'ref'],
    Bestillinger: ['id', 'tid', 'fra', 'til', 'vare', 'pris', 'kostpris', 'status'],
    Kilder: ['kilde', 'navn', 'sheet_id', 'fane', 'kol_initialer', 'kol_vaerdi', 'kol_dato', 'start_raekke'],
    Regler: ['gruppe', 'kilde', 'sats', 'tekst']
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

  function nyesteFoerst(a, b) { return String(b.tid).localeCompare(String(a.tid)); }

  function saldoFor(posteringer, initialer) {
    var s = 0;
    for (var i = 0; i < posteringer.length; i++) if (posteringer[i].initialer === initialer) s += num(posteringer[i].beloeb);
    return s;
  }

  function statsFor(posteringer, initialer, nu) {
    var mk = maanedKey(nu);
    var st = { saldo: 0, optjentMaaned: 0, optjentTotal: 0, brugt: 0, givet: 0, givetAntal: 0, indskudt: 0, gaverModtaget: 0, forloeb: [] };
    var perMaaned = {};
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
      if (p.type === 'koeb') st.brugt -= b;
      if (p.type === 'gave') { st.brugt -= b; st.givet -= b; st.givetAntal++; }
      if (p.type === 'projekt') { st.brugt -= b; st.indskudt -= b; }
      if (p.type === 'refusion') st.brugt -= b;
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

  function projekterMedStatus(db, initialer) {
    var poster = db.all('Posteringer');
    return db.all('Projekter').map(function (p) {
      var indsamlet = 0, mit = 0;
      poster.forEach(function (x) {
        if (x.type === 'projekt' && str(x.ref) === str(p.id)) {
          indsamlet -= num(x.beloeb);
          if (initialer && x.initialer === initialer) mit -= num(x.beloeb);
        }
      });
      return { id: str(p.id), navn: str(p.navn), ikon: str(p.ikon), maal: num(p.maal), aaben: sand(p.aaben), indsamlet: indsamlet, mitBidrag: mit };
    });
  }

  function menu(db, alle) {
    return db.all('Menu').filter(function (v) { return alle || sand(v.aktiv); }).map(function (v) {
      return { id: str(v.id), navn: str(v.navn), ikon: str(v.ikon), pris: num(v.pris), kostpris: num(v.kostpris), aktiv: sand(v.aktiv) };
    });
  }

  function aktiveBrugere(db) {
    return db.all('Brugere').filter(function (u) { return sand(u.aktiv) && ini(u.initialer); });
  }

  function regler(db) {
    var kilder = {};
    db.all('Kilder').forEach(function (k) { kilder[str(k.kilde)] = str(k.navn) || str(k.kilde); });
    return db.all('Regler').map(function (r) {
      return { gruppe: str(r.gruppe), kilde: str(r.kilde), kildeNavn: kilder[str(r.kilde)] || str(r.kilde), sats: num(r.sats), tekst: str(r.tekst) };
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
        return { id: str(b.id), tid: str(b.tid), fra: str(b.fra), fraNavn: navne[b.fra] || b.fra, til: str(b.til), tilNavn: navne[b.til] || b.til, vare: str(b.vare), pris: num(b.pris), status: str(b.status) };
      }),
      regler: regler(db),
      grupper: GRUPPER,
      teambudget: env.teambudget ? env.teambudget() : null
    };
  }

  function bestil(db, me, data, env) {
    kraevBruger(me);
    var vare = null;
    db.all('Menu').forEach(function (v) { if (str(v.id) === str(data.vareId) && sand(v.aktiv)) vare = v; });
    if (!vare) throw err('BAD', 'Varen findes ikke længere.');
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
    db.insert('Bestillinger', { id: id, tid: tid, fra: me.initialer, til: modtager.initialer, vare: str(vare.navn), pris: pris, kostpris: num(vare.kostpris), status: 'ny' });
    db.insert('Posteringer', {
      id: env.uuid(), tid: tid, initialer: me.initialer, type: gave ? 'gave' : 'koeb', beloeb: -pris,
      tekst: gave ? str(vare.navn) + ' til ' + modtager.navn : str(vare.navn), ref: id
    });
    if (gave) {
      db.insert('Posteringer', {
        id: env.uuid(), tid: tid, initialer: modtager.initialer, type: 'gave_modtaget', beloeb: 0,
        tekst: str(vare.navn) + ' fra ' + me.navn, ref: id
      });
    }
    env.notify({
      emne: gave ? 'Gave: ' + vare.navn + ' til ' + modtager.navn : 'Bestilling: ' + vare.navn + ' til ' + me.navn,
      tekst: (gave
        ? me.navn + ' (' + me.initialer + ') giver ' + str(vare.ikon) + ' ' + vare.navn + ' til ' + modtager.navn + ' (' + modtager.initialer + ').'
        : me.navn + ' (' + me.initialer + ') har bestilt ' + str(vare.ikon) + ' ' + vare.navn + '.') + ' Pris: ' + pris + ' WC.'
    });
    return { id: id };
  }

  function indskyd(db, me, data, env) {
    kraevBruger(me);
    var beloeb = Math.floor(num(data.beloeb));
    if (!(beloeb > 0)) throw err('BAD', 'Angiv et beløb.');
    var p = null;
    db.all('Projekter').forEach(function (x) { if (str(x.id) === str(data.projektId) && sand(x.aaben)) p = x; });
    if (!p) throw err('BAD', 'Projektet er lukket.');
    if (saldoFor(db.all('Posteringer'), me.initialer) < beloeb) throw err('FUNDS', 'Du har ikke nok Webcoins.');
    db.insert('Posteringer', { id: env.uuid(), tid: env.now().toISOString(), initialer: me.initialer, type: 'projekt', beloeb: -beloeb, tekst: str(p.navn), ref: str(p.id) });
    env.notify({ emne: 'Projekt: ' + p.navn, tekst: me.navn + ' (' + me.initialer + ') har lagt ' + beloeb + ' WC i ' + str(p.ikon) + ' ' + p.navn + '.' });
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
    return Object.keys(m).sort().reverse().map(function (k) {
      var o = m[k];
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
        return { id: str(b.id), tid: str(b.tid), fra: str(b.fra), fraNavn: navne[b.fra] || b.fra, til: str(b.til), tilNavn: navne[b.til] || b.til, vare: str(b.vare), pris: num(b.pris), kostpris: num(b.kostpris), status: str(b.status) };
      }),
      opgoerelse: opgoerelse(db),
      posteringer: poster.slice().sort(nyesteFoerst).slice(0, 2000).map(function (p) {
        return { id: str(p.id), tid: str(p.tid), initialer: str(p.initialer), navn: navne[p.initialer] || p.initialer, type: str(p.type), beloeb: num(p.beloeb), tekst: str(p.tekst), maaned: postMaaned(p) };
      }),
      menu: menu(db, true),
      projekter: projekterMedStatus(db, ''),
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
    return { ok: true };
  }

  function adminVare(db, me, data, env) {
    kraevAdmin(me);
    if (!str(data.navn).trim()) throw err('BAD', 'Navn mangler.');
    var pris = Math.floor(num(data.pris));
    if (!(pris >= 0)) throw err('BAD', 'Ugyldig pris.');
    var obj = { navn: str(data.navn).trim(), ikon: str(data.ikon).trim(), pris: pris, kostpris: Math.max(0, num(data.kostpris)), aktiv: data.aktiv === false ? 'nej' : 'ja' };
    var row = null;
    if (data.id) db.all('Menu').forEach(function (r) { if (str(r.id) === str(data.id)) row = r; });
    if (row) db.update('Menu', row, obj);
    else { obj.id = env.uuid(); db.insert('Menu', obj); }
    return { ok: true };
  }

  function adminProjekt(db, me, data, env) {
    kraevAdmin(me);
    if (!str(data.navn).trim()) throw err('BAD', 'Navn mangler.');
    var obj = { navn: str(data.navn).trim(), ikon: str(data.ikon).trim(), maal: Math.max(0, Math.floor(num(data.maal))), aaben: data.aaben === false ? 'nej' : 'ja' };
    var row = null;
    if (data.id) db.all('Projekter').forEach(function (r) { if (str(r.id) === str(data.id)) row = r; });
    if (row) db.update('Projekter', row, obj);
    else { obj.id = env.uuid(); db.insert('Projekter', obj); }
    return { ok: true };
  }

  function adminJustering(db, me, data, env) {
    kraevAdmin(me);
    var i = ini(data.initialer);
    var beloeb = Math.round(num(data.beloeb));
    if (!beloeb) throw err('BAD', 'Angiv et beløb.');
    var findes = db.all('Brugere').some(function (u) { return ini(u.initialer) === i; });
    if (!findes) throw err('BAD', 'Ukendte initialer.');
    db.insert('Posteringer', { id: env.uuid(), tid: env.now().toISOString(), initialer: i, type: 'justering', beloeb: beloeb, tekst: str(data.tekst).trim() || 'Justering', ref: '' });
    return { ok: true };
  }

  /*
   * Optjening. `kilder` = { kildeId: { 'INI|YYYY-MM': værdi } } (summeret pr. måned).
   * Laver/opdaterer én postering pr. regel-kilde, måned og person. Idempotent.
   */
  function applyEarnings(db, kilder, env, fraMaaned) {
    var fra = fraMaaned || '0000-00';
    var navne = {};
    db.all('Kilder').forEach(function (k) { navne[str(k.kilde)] = str(k.navn) || str(k.kilde); });
    var regelListe = db.all('Regler');
    var oensket = {};
    aktiveBrugere(db).forEach(function (u) {
      var i = ini(u.initialer);
      regelListe.forEach(function (r) {
        if (str(r.gruppe) !== str(u.gruppe)) return;
        var data = kilder[str(r.kilde)] || {};
        Object.keys(data).forEach(function (key) {
          var dele = key.split('|');
          if (dele[0] !== i || dele[1] < fra) return;
          var ref = 'optjent:' + str(r.kilde) + ':' + dele[1] + ':' + i;
          var beloeb = Math.floor(num(data[key]) * num(r.sats));
          oensket[ref] = { initialer: i, beloeb: (oensket[ref] ? oensket[ref].beloeb : 0) + beloeb, tekst: (navne[str(r.kilde)] || r.kilde) + ' · ' + maanedNavn(dele[1]) };
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
        if (num(p.beloeb) !== o.beloeb) { db.update('Posteringer', p, { beloeb: o.beloeb }); rettede++; }
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
    admin_state: adminState,
    admin_bestilling: adminBestilling,
    admin_bruger: adminBruger,
    admin_vare: adminVare,
    admin_projekt: adminProjekt,
    admin_justering: adminJustering,
    admin_sync: function (db, me, data, env) { kraevAdmin(me); return env.sync(); }
  };
  var SKRIVER = { bestil: 1, indskyd: 1, admin_bestilling: 1, admin_bruger: 1, admin_vare: 1, admin_projekt: 1, admin_justering: 1, admin_sync: 1 };

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
    applyEarnings: applyEarnings
  };
})();
