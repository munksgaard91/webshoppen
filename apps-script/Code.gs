/**
 * Webshoppen – Apps Script backend.
 * Bindes til Google Sheet'et "Webshoppen DB". Kræver også Core.gs (= shared/core.js) og Sortiment.gs (= shared/sortiment.js).
 * Menu, lykkehjul og events rettes i shared/sortiment.js og kopieres ind som Sortiment.gs – ikke i arket.
 * Opsætning: se NOTES.md → "Sådan sættes backend op".
 */

// ---------- Menu i arket ----------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Webshoppen')
    .addItem('Opsæt faner (første gang)', 'opsaet')
    .addItem('Hent optjening nu', 'syncOptjening')
    .addItem('Genberegn optjening (også ned)', 'genberegnOptjening')
    .addItem('Slå automatisk hentning til (hver time + månedsmail)', 'installerTrigger')
    .addItem('Send månedsmail nu (test)', 'maanedsmail')
    .addToUi();
}

// ---------- Web app ----------

function doGet() {
  return ContentService.createTextOutput('Webshoppen API kører.');
}

// Handlinger, hvor browseren ikke bruger den friske forside i svaret (den opdaterer selv) – så sparer vi at regne den ud
var UDEN_BOOT_ = { gaver_set: 1, admin_forslag_laest: 1, admin_sync: 1 };

function doPost(e) {
  var out, t0 = Date.now(), ms = {};
  try {
    var req = JSON.parse(e.postData.contents);
    // Alle faner hentes i ét kald (Sheets-tjenesten), i stedet for 2–3 kald pr. fane. Virker også uden – så læses fane for fane.
    SheetDB.preload();
    var conf = cfg_();
    var profil = verificer_(req.token, conf);
    var me = Core.resolveUser(SheetDB, profil, liste_(conf.ADMIN_EMAILS));
    ms.start = Date.now() - t0;
    var data, boot, t1 = Date.now();
    if (req.action === 'login') {
      // Kun et Google-login kan give en ny nøgle – ellers kunne en nøgle fornyes i det uendelige
      if (String(req.token).indexOf('ws1.') === 0) throw Core.err('TOKEN_EXPIRED', 'Log ind med Google.');
      // Google-login tjekkes én gang (ovenfor) – derefter bruger browseren Webshoppens egen nøgle i 30 dage.
      // Forsiden sendes med, så login kun koster ét kald.
      data = { token: udstedNoegle_(profil), boot: Core.handle(SheetDB, me, 'boot', {}, env_()) };
      ms.handling = Date.now() - t1;
    } else if (Core.skriver(req.action)) {
      var lock = LockService.getScriptLock();
      try { lock.waitLock(20000); } catch (e) { throw Core.err('BUSY', 'Shoppen er travl lige nu – prøv igen om lidt.'); }
      try {
        // Friske tal under låsen (saldo-tjekket skal ske på det, der står i arket lige nu)
        SheetDB.nulstil();
        SheetDB.preload();
        data = Core.handle(SheetDB, me, req.action, req.data, env_());
        SpreadsheetApp.flush();
      } finally {
        lock.releaseLock();
      }
      ms.handling = Date.now() - t1;
      // Chat/mail sendes først nu, uden for låsen – og kun fordi handlingen lykkedes (ellers er køen tømt i catch)
      sendKoe_();
      // Den friske forside sendes med, så browseren ikke skal lave et kald mere bagefter (hvert kald koster en opstart).
      // Ikke efter admin_sync – synken læser og skriver uden om SheetDB's cache.
      if (!UDEN_BOOT_[req.action]) {
        var t2 = Date.now();
        try { boot = Core.handle(SheetDB, me, 'boot', {}, env_()); } catch (x) { console.error('Boot efter handling fejlede', x); }
        ms.boot = Date.now() - t2;
      }
    } else {
      data = Core.handle(SheetDB, me, req.action, req.data, env_());
      ms.handling = Date.now() - t1;
    }
    out = { ok: true, data: data };
    if (boot) out.boot = boot;
  } catch (err) {
    KOE_ = [];
    // Fejl fra core (med kode) er beskeder til brugeren. Andre fejl er interne: fuld tekst i loggen og til admin,
    // en kort dansk besked til medarbejdere (ingen fanenavne m.m.)
    var erAdmin = !!(typeof me !== 'undefined' && me && me.admin);
    out = { ok: false, code: err.code || 'ERROR', error: err.code || erAdmin ? String(err.message || err) : 'Noget gik galt – prøv igen.' };
    if (!err.code) console.error(err);
  }
  // Tidsforbrug i backend (ms) – browseren skriver det i konsollen, så ventetid kan måles uden at gætte
  ms.ialt = Date.now() - t0;
  out.ms = ms;
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Config ----------

var CFG_ = null;
function cfg_() {
  if (CFG_) return CFG_;
  CFG_ = {};
  SheetDB.all('Config').forEach(function (r) { CFG_[String(r.noegle).trim()] = String(r.vaerdi).trim(); });
  return CFG_;
}
function liste_(s) {
  return String(s || '').split(/[,;\s]+/).filter(String);
}

// ---------- Login ----------

// Webshoppens egen login-nøgle: "ws1.<data>.<signatur>", signeret med SESSION_SECRET (Script Properties, aldrig i repoet).
// Gælder 30 dage. Brugeren slås stadig op i Brugere ved hver forespørgsel, så deaktiverede er ude med det samme.
// Nødbremse: slet SESSION_SECRET under Projektindstillinger → Script Properties, så er alle logget ud.
var NOEGLE_DAGE_ = 30;
function hemmelighed_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('SESSION_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('SESSION_SECRET', s); }
  return s;
}
function signer_(data) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(data, hemmelighed_())).replace(/=+$/, '');
}
function udstedNoegle_(profil) {
  var data = Utilities.base64EncodeWebSafe(JSON.stringify({ e: profil.email, n: profil.name, p: profil.picture, x: Date.now() + NOEGLE_DAGE_ * 864e5 }), Utilities.Charset.UTF_8).replace(/=+$/, '');
  return 'ws1.' + data + '.' + signer_(data);
}
function tjekNoegle_(token) {
  var dele = String(token).split('.');
  if (dele.length !== 3 || signer_(dele[1]) !== dele[2]) throw Core.err('TOKEN_EXPIRED', 'Ugyldigt login. Log ind igen.');
  var pad = dele[1] + '===='.slice(0, (4 - dele[1].length % 4) % 4);
  var o = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(pad)).getDataAsString('UTF-8'));
  if (!(o.x > Date.now())) throw Core.err('TOKEN_EXPIRED', 'Din session er udløbet. Log ind igen.');
  return { email: String(o.e).toLowerCase(), name: o.n || '', picture: o.p || '' };
}

function verificer_(token, conf) {
  if (!token) throw Core.err('TOKEN_EXPIRED', 'Log ind igen.');
  if (String(token).indexOf('ws1.') === 0) return tjekNoegle_(token);
  var cache = CacheService.getScriptCache();
  var key = 't:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 43);
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw Core.err('TOKEN_EXPIRED', 'Din session er udløbet. Log ind igen.');
  var t = JSON.parse(res.getContentText());
  if (t.aud !== conf.CLIENT_ID) throw Core.err('TOKEN_EXPIRED', 'Ugyldigt login.');
  if (String(t.email_verified) !== 'true') throw Core.err('NOT_REGISTERED', 'Mailen er ikke verificeret.');
  var email = String(t.email).toLowerCase();
  var domaene = (conf.TILLADT_DOMAENE || '').toLowerCase();
  var admins = liste_(conf.ADMIN_EMAILS).map(function (x) { return x.toLowerCase(); });
  if (domaene && email.split('@')[1] !== domaene && admins.indexOf(email) < 0) {
    throw Core.err('NOT_REGISTERED', 'Du er desværre ikke registreret.');
  }
  var profil = { email: email, name: t.name || '', picture: t.picture || '' };
  var ttl = Math.min(900, Number(t.exp) - Math.floor(Date.now() / 1000) - 30);
  if (ttl > 30) cache.put(key, JSON.stringify(profil), ttl);
  return profil;
}

// ---------- Miljø til Core ----------

// I doPost lægges beskeder i en kø og sendes efter låsen (sendKoe_) – Chat og mail tager 0,3–1,5 sek., som andre
// ellers ville vente på. Triggere (synk, månedsmail) sender direkte, da der ikke er nogen kø at tømme bagefter.
var KOE_ = [];
function env_(direkte) {
  return {
    now: function () { return new Date(); },
    uuid: function () { return Utilities.getUuid().slice(0, 8); },
    notify: direkte ? notify_ : function (b) { KOE_.push(b); },
    teambudget: teambudget_,
    shop: shopStatus_,
    sync: syncOptjening,
    synkStatus: synkStatus_
  };
}
function sendKoe_() {
  var koe = KOE_;
  KOE_ = [];
  koe.forEach(notify_);
}

// ---------- Status for den timelige hentning ----------
// Gemmes i Script Properties (ikke i arket): hvornår den sidst kørte og hvilke fejl der var.
function synkStatus_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('SYNK_STATUS') || 'null'); } catch (e) { return null; }
}
// Mail til admin ved fejl – højst én gang i døgnet for de samme fejl – og én gang, når det virker igen.
function gemSynkStatus_(fejl) {
  var props = PropertiesService.getScriptProperties();
  var nu = new Date();
  props.setProperty('SYNK_STATUS', JSON.stringify({ tid: nu.toISOString(), fejl: fejl }));
  var sidst = {};
  try { sidst = JSON.parse(props.getProperty('SYNK_MAIL') || '{}'); } catch (e) { sidst = {}; }
  var conf = cfg_();
  var til = conf.NOTIFIKATION_MAIL || liste_(conf.ADMIN_EMAILS)[0];
  if (!til) return;
  var url = conf.SIDE_URL ? '\n\n' + conf.SIDE_URL : '';
  var noegle = fejl.join('|');
  try {
    if (fejl.length) {
      if (sidst.noegle === noegle && nu - new Date(sidst.tid) < 24 * 36e5) return;
      MailApp.sendEmail(til, 'Webshoppen · Hentning af tal fejlede',
        'Den automatiske hentning af tal fejlede kl. ' + Utilities.formatDate(nu, 'Europe/Copenhagen', 'HH:mm') + ':\n\n' +
        fejl.map(function (f) { return '• ' + f; }).join('\n') +
        '\n\nOptjening eller fælles mål bliver ikke opdateret, før det er rettet. Du får ikke flere mails om de samme fejl i dag.' + url);
      props.setProperty('SYNK_MAIL', JSON.stringify({ noegle: noegle, tid: nu.toISOString() }));
    } else if (sidst.noegle) {
      MailApp.sendEmail(til, 'Webshoppen · Hentning virker igen', 'Den automatiske hentning af tal virker igen.' + url);
      props.deleteProperty('SYNK_MAIL');
    }
  } catch (e) {
    console.error('Mail om hentning fejlede', e);
  }
}

// b = { emne, tekst, ikon?, side?, kunChat?, kort? } – side er admin-siden linket peger på ('bestillinger', 'feedback' …, '' = Overblik)
// kunChat (bestillinger, forudbestillinger, gaver, lykkehjul): ingen mail – medmindre CHAT_WEBHOOK mangler, så beskeden ikke forsvinder
function notify_(b) {
  var conf = cfg_();
  var side = b.side === undefined ? 'bestillinger' : b.side;
  var link = conf.SIDE_URL ? conf.SIDE_URL + '/#/' + (side ? 'admin/' + side : '') : '';
  var url = link ? '\n' + link : '';
  var ikon = b.ikon || '🛒';
  var kort = b.kort === undefined ? b.tekst : b.kort; // kort linje til Chat (tom = kun overskrift + link)
  try {
    if (conf.CHAT_WEBHOOK) {
      UrlFetchApp.fetch(conf.CHAT_WEBHOOK, {
        method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
        payload: JSON.stringify({ text: ikon + ' *' + b.emne + '*' + (kort ? '\n' + kort : '') + (link ? '\n<' + link + '|Åbn i admin>' : '') })
      });
    }
    if (conf.NOTIFIKATION_MAIL && !(b.kunChat && conf.CHAT_WEBHOOK)) {
      MailApp.sendEmail(conf.NOTIFIKATION_MAIL, 'Webshoppen · ' + ikon + ' ' + b.emne, b.tekst + url);
    }
  } catch (e) {
    console.error('Notifikation fejlede', e);
  }
}

// Teambudget og fravær ligger i CacheService. Triggeren varmCache (hvert 5. min) genopfrisker dem med 11 min levetid,
// så ingen bruger rammer et tomt cache og venter på det fremmede ark/kalenderen. Mangler triggeren, læses de ved behov som før.
var CACHE_TTL_ = 660;
function teambudget_(tving) {
  var conf = cfg_();
  if (!conf.TEAMBUDGET_ARK_ID || !(conf.TEAMBUDGET_BUDGET_CELLE || conf.TEAMBUDGET_REST_CELLE)) return null;
  var cache = CacheService.getScriptCache();
  var hit = tving ? null : cache.get('teambudget');
  if (hit) return JSON.parse(hit);
  try {
    var ark = SpreadsheetApp.openById(conf.TEAMBUDGET_ARK_ID);
    var celle = function (c) { return c ? Core.num(ark.getRange(c).getValue()) : 0; };
    var brugt = celle(conf.TEAMBUDGET_BRUGT_CELLE);
    // Viser arket allerede, hvad der er tilbage (fx "Balance"), bruges TEAMBUDGET_REST_CELLE i stedet for budget − brugt
    var rest = conf.TEAMBUDGET_REST_CELLE ? celle(conf.TEAMBUDGET_REST_CELLE) : celle(conf.TEAMBUDGET_BUDGET_CELLE) - brugt;
    var tb = { budget: rest + brugt, brugt: brugt, rest: rest, saeson: conf.TEAMBUDGET_SAESON || '' };
    cache.put('teambudget', JSON.stringify(tb), CACHE_TTL_);
    return tb;
  } catch (e) {
    console.error('Teambudget kunne ikke læses', e);
    return null;
  }
}

// Trigger hvert 5. minut: holder teambudget og fravær varme i cachen. Fejler den, læser forespørgslerne selv som før.
function varmCache() {
  SheetDB.nulstil(true);
  try { teambudget_(true); } catch (e) { console.error('varmCache teambudget', e); }
  try { fravaer_(cfg_(), true); } catch (e) { console.error('varmCache fravaer', e); }
}

// ---------- Åbningstid og fravær ----------

var SHOP_ = null;
function shopStatus_() {
  if (SHOP_) return SHOP_;
  var conf = cfg_();
  var t = Core.aabningstider(new Date(), conf.AABNER, conf.LUKKER, conf.AABNE_DAGE);
  if (!t.aaben) return (SHOP_ = t);
  if (String(conf.LUK_VED_FRAVAER || 'ja').toLowerCase() !== 'nej') {
    var f = fravaer_(conf);
    if (f) return (SHOP_ = { aaben: false, grund: 'fravaer', tekst: f });
  }
  return (SHOP_ = { aaben: true });
}

// Tjekker kalenderen (som scriptet kører som = admin) for "Ikke til stede" lige nu.
// Returnerer tekst om hvornår der åbnes igen, eller '' hvis ingen fravær.
function fravaer_(conf, tving) {
  var cache = CacheService.getScriptCache();
  var hit = tving ? null : cache.get('fravaer');
  if (hit !== null) return hit;
  var res = '';
  try {
    var cal = conf.KALENDER_ID ? CalendarApp.getCalendarById(conf.KALENDER_ID) : CalendarApp.getDefaultCalendar();
    var nu = new Date();
    var events = cal.getEvents(new Date(nu.getTime() - 60000), new Date(nu.getTime() + 60000));
    events.forEach(function (e) {
      if (res) return;
      var ooo = false;
      try { ooo = e.getEventType() === CalendarApp.EventType.OUT_OF_OFFICE; } catch (x) { /* ældre API */ }
      if (ooo || /ikke til stede|out of office/i.test(e.getTitle())) {
        var slut = e.getEndTime();
        res = 'Tilbage ' + Utilities.formatDate(slut, Session.getScriptTimeZone(), 'dd.MM') + ' kl. ' + Utilities.formatDate(slut, Session.getScriptTimeZone(), 'HH:mm');
      }
    });
  } catch (e) {
    console.error('Kalender kunne ikke læses', e);
  }
  cache.put('fravaer', res, CACHE_TTL_);
  return res;
}

// ---------- Optjening ----------

// Efter en regel er sat for højt: retter indeværende (ulåste) måned efter de nuværende regler – også ned.
// Saldoen sænkes højst til 0. Kør kun bevidst fra menuen; den timelige hentning sænker aldrig.
function genberegnOptjening() {
  var ui = SpreadsheetApp.getUi();
  var svar = ui.alert('Genberegn optjening', 'Optjening for ulåste måneder rettes efter de nuværende regler – også ned. Fortsæt?', ui.ButtonSet.OK_CANCEL);
  if (svar !== ui.Button.OK) return;
  var res = syncOptjening({ genberegn: true });
  ui.alert('Færdig: ' + (res ? res.nye + ' nye, ' + res.rettede + ' rettede' : 'se loggen'));
}

function syncOptjening(opts) {
  var genberegn = !!(opts && opts.genberegn === true); // timer-triggeren sender et event-objekt uden genberegn
  var fejl = [], res, raa = {};
  try {
    // Kildearkene læses FØR låsen (det kan tage op til 20 sek.), så bestillinger ikke venter imens
    SheetDB.nulstil(true);
    // OPTJENING_FRA er en måned (2026-11) eller en dato (2026-11-17 / 17-11-2026 = lanceringsdagen). Rækker før tælles ikke.
    var fraV = String(cfg_().OPTJENING_FRA || '').trim();
    var fraDato = dato_(fraV);
    var fraMaaned = fraDato ? Core.maanedKey(fraDato) : fraV;
    var kilder = {}, fejlede = {};
    SheetDB.all('Kilder').forEach(function (k) {
      var id = String(k.kilde).trim();
      if (!id || !k.sheet_id) return;
      var data = kilder[id] = kilder[id] || {};
      var alle = raa[id] = raa[id] || {};
      try {
        var ss = SpreadsheetApp.openById(String(k.sheet_id).trim());
        var sh = k.fane ? ss.getSheetByName(String(k.fane)) : ss.getSheets()[0];
        if (!sh) throw new Error('Fanen "' + k.fane + '" findes ikke');
        var rows = sh.getDataRange().getValues();
        var cI = kol_(k.kol_initialer), cV = k.kol_vaerdi ? kol_(k.kol_vaerdi) : -1, cD = kol_(k.kol_dato);
        for (var r = (Number(k.start_raekke) || 2) - 1; r < rows.length; r++) {
          var ini = String(rows[r][cI] || '').trim().toUpperCase();
          var d = dato_(rows[r][cD]);
          if (!ini || !d) continue;
          var v = cV >= 0 ? Core.num(rows[r][cV]) : 1;
          var key = ini + '|' + Core.maanedKey(d);
          alle[key] = (alle[key] || 0) + v; // fælles mål tæller også før lanceringen
          if (fraDato && d < fraDato) continue;
          data[key] = (data[key] || 0) + v;
        }
      } catch (e) {
        console.error('Kilde ' + id + ' fejlede: ' + e);
        fejlede[id] = 1;
        fejl.push('Kilde ' + id + (k.fane ? ' (' + k.fane + ')' : '') + ': ' + (e.message || e));
      }
    });
    // En kilde, der fejlede, tages helt ud – både af optjeningen og af fælles mål (de beholder deres gamle tal)
    Object.keys(fejlede).forEach(function (id) { delete kilder[id]; delete raa[id]; });
    var lock = LockService.getScriptLock();
    try { lock.waitLock(30000); } catch (e) { throw new Error('Shoppen var optaget – prøver igen ved næste hentning'); }
    try {
      SheetDB.nulstil(true);
      res = Core.applyEarnings(SheetDB, kilder, env_(true), fraMaaned, { genberegn: genberegn });
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    fejl.push('Optjening: ' + (e.message || e));
    console.error('Optjening fejlede', e);
  }
  // Fælles mål efter låsen: ClickUp og målarket kan tage tid, og kun synken skriver i fanen Maal,
  // så bestillinger skal ikke vente på dem. En fejl her stopper ikke optjeningen.
  try {
    opdaterMaal_(raa, fejl);
    SpreadsheetApp.flush();
  } catch (e) {
    console.error('Fælles mål kunne ikke opdateres: ' + e);
    fejl.push('Fælles mål: ' + (e.message || e));
  }
  gemSynkStatus_(fejl);
  return res;
}

// Fælles mål med `kilde` i fanen Maal får `nu` udfyldt ved hver synk (indeværende og sidste måned):
//   tid:<fane>:<række>+<række>  → Tid ÷ Antal for måneden i MAAL_ARK_ID (fx tid:Web:Hjemmeside+Redesign)
//   anmeldelser:<gruppe>        → antal anmeldelser i måneden fra gruppens kolleger (kilden "anmeldelser")
//   celle:<fane>!<celle>        → tallet i én celle i MAAL_ARK_ID
//   clickup:<liste-id>:<status> → antal opgaver med den status på listen lige nu (kræver CLICKUP_TOKEN)
// celle og clickup er øjebliksbilleder, så de opdaterer kun indeværende måned – sidste måned beholder sit sluttal.
function opdaterMaal_(raa, fejl) {
  var conf = cfg_();
  var mk0 = Core.maanedKey(new Date()), maaneder = [mk0, Core.forrigeMaaned(mk0)];
  var kendte = {};
  SheetDB.all('Brugere').forEach(function (u) {
    if (Core.sand(u.aktiv) && u.initialer) kendte[String(u.initialer).trim().toUpperCase()] = String(u.gruppe).trim();
  });
  var ark = null, faner = {};
  function bog() { return ark || (ark = SpreadsheetApp.openById(String(conf.MAAL_ARK_ID).trim())); }
  function fane(navn) {
    if (!faner[navn]) {
      var sh = bog().getSheetByName(navn);
      if (!sh) throw new Error('Fanen "' + navn + '" findes ikke');
      faner[navn] = sh.getDataRange().getValues();
    }
    return faner[navn];
  }
  SheetDB.all('Maal').forEach(function (m) {
    var k = String(m.kilde || '').trim(), mk = String(m.maaned).trim();
    if (!k || maaneder.indexOf(mk) < 0) return;
    try {
      var d = k.split(':'), v = null;
      if ((d[0] === 'celle' || d[0] === 'clickup') && mk !== mk0) return;
      if (d[0] === 'tid') {
        v = Core.maalTid(fane(d[1]), mk, kendte, String(d[2] || '').split('+').map(function (x) { return x.trim().toLowerCase(); }));
      } else if (d[0] === 'anmeldelser') {
        // Kunne kilden ikke hentes, beholder målet sit gamle tal (ellers ville det vise 0 og "Ikke nået")
        if (!raa.anmeldelser) throw new Error('kilden "anmeldelser" kunne ikke hentes – det gamle tal beholdes');
        v = 0;
        Object.keys(raa.anmeldelser || {}).forEach(function (key) {
          var p = key.split('|');
          if (p[1] === mk && kendte[p[0]] === d[1]) v += raa.anmeldelser[key];
        });
      } else if (d[0] === 'celle') {
        v = Core.num(bog().getRange(k.slice(6)).getValue());
      } else if (d[0] === 'clickup') {
        v = clickupAntal_(conf, d[1], d.slice(2).join(':'));
      }
      if (v !== null && (String(m.nu) === '' || v !== Number(m.nu))) SheetDB.update('Maal', m, { nu: v });
    } catch (e) {
      console.error('Mål ' + m.navn + ' fejlede: ' + e);
      if (fejl) fejl.push('Fælles mål "' + m.navn + '": ' + (e.message || e));
    }
  });
}

// Antal opgaver (uden underopgaver) med en bestemt status på en ClickUp-liste. 100 pr. side.
function clickupAntal_(conf, liste, status) {
  if (!conf.CLICKUP_TOKEN) throw new Error('CLICKUP_TOKEN mangler i Config');
  var antal = 0;
  for (var side = 0; side < 50; side++) {
    var url = 'https://api.clickup.com/api/v2/list/' + encodeURIComponent(liste) + '/task?subtasks=false&page=' + side +
      '&statuses%5B%5D=' + encodeURIComponent(status);
    var svar = JSON.parse(UrlFetchApp.fetch(url, { headers: { Authorization: conf.CLICKUP_TOKEN } }).getContentText());
    var opg = svar.tasks || [];
    antal += opg.length;
    if (svar.last_page === true || opg.length < 100) break;
  }
  return antal;
}

function installerTrigger() {
  // Gamle triggere fjernes først, så der aldrig bliver dubletter
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['syncOptjening', 'maanedsmail', 'varmCache'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncOptjening').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('maanedsmail').timeBased().onMonthDay(1).atHour(7).create();
  ScriptApp.newTrigger('varmCache').timeBased().everyMinutes(5).create();
  varmCache();
  SpreadsheetApp.getActive().toast('Optjening hentes hver time, månedsmailen sendes den 1. kl. 7–8, og teambudget/fravær holdes varme hvert 5. minut.');
}

// Månedsmail til admin den 1.: opgørelse til RAB + påmindelser (fælles mål, præmie, Afslør). Til NOTIFIKATION_MAIL eller første admin.
function maanedsmail() {
  SheetDB.nulstil(true);
  var conf = cfg_();
  var til = conf.NOTIFIKATION_MAIL || liste_(conf.ADMIN_EMAILS)[0];
  if (!til) return;
  var r = Core.maanedsrapport(SheetDB, env_(true));
  MailApp.sendEmail(til, 'Webshoppen · ' + r.emne, r.tekst + (conf.SIDE_URL ? '\n\n' + conf.SIDE_URL : ''));
}

// "C" -> 2, "AA" -> 26
function kol_(s) {
  s = String(s || '').trim().toUpperCase();
  var n = 0;
  for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n - 1;
}

// Date-objekt, "08-11-2026", "8.11.2026" eller "2026-11-08"
function dato_(v) {
  if (v instanceof Date) return isNaN(v) ? null : v;
  var s = String(v || '').trim();
  // En datocelle i et af vores egne faner kommer som ISO i UTC (SheetDB.all) – læs den som lokal dato, ellers bliver 17-11 til 16-11
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    var iso = new Date(s);
    return isNaN(iso) ? null : new Date(iso.getFullYear(), iso.getMonth(), iso.getDate());
  }
  var m = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})/);
  if (m) return new Date(Number(m[3].length === 2 ? '20' + m[3] : m[3]), Number(m[2]) - 1, Number(m[1]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return null;
}

// ---------- Sheet som database ----------

// Kolonner der altid skal være tekst. Ellers laver Sheets "2026-11" om til en dato og id'er som "12e45678" om til tal.
var TEKST_KOL_ = ['id', 'tid', 'maaned', 'initialer', 'fra', 'til', 'ref', 'email', 'sheet_id', 'noegle', 'vaerdi', 'gaver_set', 'afsloeret', 'vinder'];

// Hvert kald til SpreadsheetApp (getSheetByName, getValues, setValue …) koster 50–150 ms. Derfor:
//  - preload() henter alle faner i ét kald via Sheets-tjenesten (Advanced Sheets Service, v4). Er den ikke slået til,
//    eller fejler kaldet, læses fane for fane som før (all).
//  - insert/update skriver med så få kald som muligt (én formatering + én setValues pr. række/sammenhængende felter).
//  - nulstil() beholder Config og Brugere (de indgår ikke i saldo-tjekket); nulstil(true) smider alt væk (synk, triggere).
var SheetDB = (function () {
  var cache = {}; // fane -> { headers, rows, sh (hentes først ved skrivning), sidste (sidste række med data), max (antal rækker i arket) }
  var SS_ = null, TITLER_ = null;
  function ss() { return SS_ || (SS_ = SpreadsheetApp.getActive()); }
  function ark(navn) {
    var sh = ss().getSheetByName(navn);
    if (!sh) throw new Error('Fanen "' + navn + '" mangler. Kør Webshoppen → Opsæt faner.');
    return sh;
  }
  function fane(c, navn) { return c.sh || (c.sh = ark(navn)); }
  // Rækker (som getValues giver dem) -> objekter. Korte rækker fyldes op til headers, tomme rækker springes over.
  function laes(navn, values, sh) {
    var headers = (values[0] || []).map(String);
    var rows = [];
    for (var i = 1; i < values.length; i++) {
      var r = values[i].slice();
      while (r.length < headers.length) r.push('');
      if (r.every(function (c) { return c === ''; })) continue;
      var o = { _row: i + 1 };
      headers.forEach(function (h, j) {
        var v = r[j];
        // En måned gemt som dato (ældre rækker fra appendRow) læses tilbage som "YYYY-MM"
        if (v instanceof Date && h === 'maaned') o[h] = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM');
        else o[h] = v instanceof Date ? v.toISOString() : v;
      });
      rows.push(o);
    }
    cache[navn] = { headers: headers, rows: rows, sh: sh || null, sidste: rows.length ? rows[rows.length - 1]._row : 1, max: 0 };
    return rows;
  }
  function all(navn) {
    if (cache[navn]) return cache[navn].rows;
    var sh = ark(navn);
    return laes(navn, sh.getDataRange().getValues(), sh);
  }
  // Sheets-tjenesten giver datoer som serienumre (dage siden 30-12-1899 i arkets tidszone). Samme Date som getValues giver.
  function serialDato(n) {
    var u = new Date(Date.UTC(1899, 11, 30) + Math.round(n * 864e5));
    return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds(), u.getUTCMilliseconds());
  }
  // Alle faner i ét kald (to med listen over faner, så en manglende fane ikke vælter hele kaldet).
  // Datoer kan kun skelnes fra tal på kolonnen: i datokolonnerne (DATO_KOL) er et tal mellem 20000 og 100000 en dato
  // (år 1954–2173), som ældre rækker kan have. Id'er og Config-værdier røres aldrig, selv om de er blevet til tal.
  var DATO_KOL = ['tid', 'maaned', 'gaver_set', 'afsloeret', 'laest'];
  function preload() {
    if (typeof Sheets === 'undefined') return false;
    try {
      var id = ss().getId();
      if (!TITLER_) {
        TITLER_ = {};
        (Sheets.Spreadsheets.get(id, { fields: 'sheets.properties.title' }).sheets || []).forEach(function (s) { TITLER_[s.properties.title] = 1; });
      }
      var navne = Object.keys(Core.TABELLER).filter(function (n) { return TITLER_[n]; });
      if (!navne.length) return false;
      var res = Sheets.Spreadsheets.Values.batchGet(id, {
        ranges: navne.map(function (n) { return "'" + n.replace(/'/g, "''") + "'"; }),
        valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER'
      });
      var vr = res.valueRanges || [];
      if (vr.length !== navne.length) throw new Error('Fik ' + vr.length + ' faner, bad om ' + navne.length);
      navne.forEach(function (navn, k) {
        var values = vr[k].values || [];
        var headers = (values[0] || []).map(String);
        for (var i = 1; i < values.length; i++) {
          for (var j = 0; j < values[i].length; j++) {
            var v = values[i][j];
            if (typeof v === 'number' && v > 20000 && v < 100000 && DATO_KOL.indexOf(headers[j]) >= 0) values[i][j] = serialDato(v);
          }
        }
        laes(navn, values, null);
      });
      return true;
    } catch (e) {
      console.error('Preload via Sheets-tjenesten fejlede – læser fane for fane', e);
      return false;
    }
  }
  // Tekst, der starter med = + - @, ville Sheets regne ud som en formel (fx "=Config!B18" i en begrundelse).
  // Et ' foran gør den til ren tekst; det gemmes ikke i cellen og kommer ikke med ud igen.
  function sikker(v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; }
  function mangler(navn, k) { return new Error('Kolonnen "' + k + '" mangler i fanen ' + navn + '. Kør Webshoppen → Opsæt faner.'); }
  // 0 -> "A", 26 -> "AA"
  function bogstav(i) { var s = ''; i++; while (i > 0) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = (i - r - 1) / 26; } return s; }
  // Tekstformat på tekstkolonnerne i én omgang (RangeList = ét kald). Ellers laver Sheets "2026-11" om til en dato.
  function tekstFormat(sh, nr, kolonner) {
    if (!kolonner.length) return;
    sh.getRangeList(kolonner.map(function (i) { return bogstav(i) + nr; })).setNumberFormat('@');
  }
  function insert(navn, obj) {
    all(navn);
    var c = cache[navn];
    Object.keys(obj).forEach(function (k) {
      if (c.headers.indexOf(k) < 0 && obj[k] !== undefined && obj[k] !== '') throw mangler(navn, k);
    });
    var sh = fane(c, navn);
    // Ikke appendRow – den ignorerer tekstformatet. Rækkenummeret kendes fra cachen (sidste række med data).
    var nr = c.sidste + 1;
    if (!c.max) c.max = sh.getMaxRows();
    if (nr > c.max) { sh.insertRowsAfter(c.max, 100); c.max += 100; }
    var tekstKol = [];
    c.headers.forEach(function (h, i) { if (TEKST_KOL_.indexOf(h) >= 0) tekstKol.push(i); });
    tekstFormat(sh, nr, tekstKol);
    sh.getRange(nr, 1, 1, c.headers.length).setValues([c.headers.map(function (h) { return obj[h] === undefined ? '' : sikker(obj[h]); })]);
    var row = { _row: nr };
    c.headers.forEach(function (h) { row[h] = obj[h] === undefined ? '' : obj[h]; });
    c.rows.push(row);
    c.sidste = nr;
    return row;
  }
  function update(navn, row, patch) {
    all(navn);
    var c = cache[navn];
    var kol = [];
    Object.keys(patch).forEach(function (k) {
      var col = c.headers.indexOf(k);
      if (col < 0) throw mangler(navn, k);
      kol.push(col);
    });
    if (!kol.length) return;
    var sh = fane(c, navn);
    kol.sort(function (a, b) { return a - b; });
    tekstFormat(sh, row._row, kol.filter(function (i) { return TEKST_KOL_.indexOf(c.headers[i]) >= 0; }));
    // Felter ved siden af hinanden skrives i ét kald; andre celler røres ikke
    for (var s = 0; s < kol.length;) {
      var e = s;
      while (e + 1 < kol.length && kol[e + 1] === kol[e] + 1) e++;
      var vaerdier = kol.slice(s, e + 1).map(function (i) { return sikker(patch[c.headers[i]]); });
      sh.getRange(row._row, kol[s] + 1, 1, vaerdier.length).setValues([vaerdier]);
      s = e + 1;
    }
    Object.keys(patch).forEach(function (k) { row[k] = patch[k]; });
  }
  function nulstil(alt) {
    var behold = {};
    if (!alt) ['Config', 'Brugere'].forEach(function (n) { if (cache[n]) behold[n] = cache[n]; });
    cache = behold;
    CFG_ = null;
  }
  return { all: all, insert: insert, update: update, preload: preload, nulstil: nulstil };
})();

// ---------- Opsætning ----------

function opsaet() {
  var ss = SpreadsheetApp.getActive();
  var tekstKol = TEKST_KOL_;
  Object.keys(Core.TABELLER).forEach(function (navn) {
    var headers = Core.TABELLER[navn];
    var sh = ss.getSheetByName(navn) || ss.insertSheet(navn);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sh.setFrozenRows(1);
    } else {
      // Ældre ark: tilføj nye kolonner sidst, så fx gaver_set og fra også findes der
      var har = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
      headers.filter(function (h) { return har.indexOf(h) < 0; }).forEach(function (h) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(h).setFontWeight('bold');
      });
    }
    var alle = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    alle.forEach(function (h, i) {
      if (tekstKol.indexOf(h) >= 0) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@');
    });
  });
  var seed = function (navn, rows) {
    var sh = ss.getSheetByName(navn);
    if (sh.getLastRow() > 1) return;
    var h = Core.TABELLER[navn];
    sh.getRange(2, 1, rows.length, h.length).setValues(rows.map(function (r) { return h.map(function (k) { return r[k] === undefined ? '' : r[k]; }); }));
  };
  seed('Config', [
    { noegle: 'CLIENT_ID', vaerdi: '' },
    { noegle: 'ADMIN_EMAILS', vaerdi: Session.getActiveUser().getEmail() },
    { noegle: 'TILLADT_DOMAENE', vaerdi: 'best-one.dk' },
    { noegle: 'SIDE_URL', vaerdi: 'https://webshoppen.leksione.dk' },
    { noegle: 'CHAT_WEBHOOK', vaerdi: '' },
    { noegle: 'NOTIFIKATION_MAIL', vaerdi: Session.getActiveUser().getEmail() },
    { noegle: 'AABNER', vaerdi: '08:00' },
    { noegle: 'LUKKER', vaerdi: '15:30' },
    { noegle: 'AABNE_DAGE', vaerdi: '1-5' },
    { noegle: 'LUK_VED_FRAVAER', vaerdi: 'ja' },
    { noegle: 'KALENDER_ID', vaerdi: '' },
    { noegle: 'OPTJENING_FRA', vaerdi: Core.maanedKey(new Date()) },
    { noegle: 'TEAMBUDGET_ARK_ID', vaerdi: '' },
    { noegle: 'TEAMBUDGET_BUDGET_CELLE', vaerdi: '' },
    { noegle: 'TEAMBUDGET_BRUGT_CELLE', vaerdi: '' },
    { noegle: 'TEAMBUDGET_REST_CELLE', vaerdi: '' },
    // Ark med tallene til fælles mål (kilde tid:/celle: i fanen Maal) – fx Fakturering 26/27
    { noegle: 'MAAL_ARK_ID', vaerdi: '' },
    // Personlig ClickUp-nøgle (pk_…) til fælles mål med kilde clickup: – hemmelig, kun i arket
    { noegle: 'CLICKUP_TOKEN', vaerdi: '' },
    { noegle: 'TEAMBUDGET_SAESON', vaerdi: '' },
    // Profilbilleder: {ini} = initialer med små bogstaver, {INI} = store. Mangler et billede, vises initialer.
    // Udsolgte varer (id'er fra sortiment.js) – sættes fra Admin → Bestillinger
    { noegle: 'UDSOLGT', vaerdi: '' },
    { noegle: 'BILLEDE_URL', vaerdi: 'https://leksione.dk/avatar/{ini}.png' },
    { noegle: 'MDK_PRAEMIE', vaerdi: '50 Webcoins' },
    { noegle: 'MDK_PRAEMIE_MAANED', vaerdi: Core.maanedKey(new Date()) }
  ]);
  // Feelin' Lucky? – vægt = relativ chance. type: vare (admin leverer), webcoins (lægges på saldo), intet.
  // Tom kol_vaerdi = hver række tæller som 1 (én sag, én tekst, én session, én 5-stjernet anmeldelse).
  seed('Kilder', [
    { kilde: 'sager', navn: 'Sag', sheet_id: '', fane: '', kol_initialer: '', kol_vaerdi: '', kol_dato: '', start_raekke: 2 },
    { kilde: 'tekster', navn: 'Tekster', sheet_id: '', fane: '', kol_initialer: '', kol_vaerdi: '', kol_dato: '', start_raekke: 2 },
    { kilde: 'sessioner', navn: 'Session', sheet_id: '', fane: '', kol_initialer: '', kol_vaerdi: '', kol_dato: '', start_raekke: 2 },
    { kilde: 'anmeldelser', navn: 'Anmeldelse', sheet_id: '', fane: '', kol_initialer: '', kol_vaerdi: '', kol_dato: '', start_raekke: 2 },
    // Uden ark: kun til visning i regel-boksen. Konkurrencer gives manuelt (Justér), fælles mål vises på overblikket.
    { kilde: 'konkurrencer', navn: 'Konkurrencer', sheet_id: '', fane: '', kol_initialer: '', kol_vaerdi: '', kol_dato: '', start_raekke: 2 },
    { kilde: 'faelles_maal', navn: 'Fælles mål', sheet_id: '', fane: '', kol_initialer: '', kol_vaerdi: '', kol_dato: '', start_raekke: 2 }
  ]);
  // Bevidst stramt (2026-11-10) – hellere løsne senere. Gruppe 'Alle' vises hos alle grupper.
  seed('Regler', [
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
    { gruppe: 'Support', kilde: 'anmeldelser', sats: 25, tekst: '25 Webcoins' },
    { gruppe: 'Alle', kilde: 'faelles_maal', sats: 0, tekst: 'Se status' },
    { gruppe: 'Alle', kilde: 'konkurrencer', sats: 0, tekst: '?' }
  ]);
  // Fælles mål pr. måned: retning under/over grænsen. nu = resultatet, skrives dagen efter månedens udgang.
  seed('Maal', [
    { maaned: '2026-11', navn: 'Hjemmeside', tekst: 'Under 6,5 t produktionstid pr. sag', retning: 'under', graense: 6.5, nu: '', enhed: 't', kilde: 'tid:Web:Hjemmeside+Redesign' },
    { maaned: '2026-11', navn: 'Afventer online', tekst: 'Under 70 kunder på listen', retning: 'under', graense: 70, nu: '', enhed: 'kunder', kilde: 'clickup:900800029466:afventer online' },
    { maaned: '2026-11', navn: 'Redaktører', tekst: 'Under 0,7 t produktionstid pr. tekst', retning: 'under', graense: 0.7, nu: '', enhed: 't', kilde: 'tid:Tekst:Tekster' },
    { maaned: '2026-11', navn: 'Support', tekst: '20 anmeldelser eller flere', retning: 'over', graense: 20, nu: '', enhed: 'anmeldelser', kilde: 'anmeldelser:Support' }
  ]);
  var standard = ss.getSheetByName('Ark1') || ss.getSheetByName('Sheet1');
  if (standard && standard.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(standard);
  SpreadsheetApp.getUi().alert('Fanerne er klar. Udfyld Config, Brugere og Kilder.');
}
