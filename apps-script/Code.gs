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
    .addItem('Slå automatisk hentning til (hver time + månedsmail)', 'installerTrigger')
    .addItem('Send månedsmail nu (test)', 'maanedsmail')
    .addToUi();
}

// ---------- Web app ----------

function doGet() {
  return ContentService.createTextOutput('Webshoppen API kører.');
}

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    var conf = cfg_();
    var profil = verificer_(req.token, conf);
    var me = Core.resolveUser(SheetDB, profil, liste_(conf.ADMIN_EMAILS));
    var data;
    if (req.action === 'login') {
      // Kun et Google-login kan give en ny nøgle – ellers kunne en nøgle fornyes i det uendelige
      if (String(req.token).indexOf('ws1.') === 0) throw Core.err('TOKEN_EXPIRED', 'Log ind med Google.');
      // Google-login tjekkes én gang (ovenfor) – derefter bruger browseren Webshoppens egen nøgle i 30 dage.
      // Forsiden sendes med, så login kun koster ét kald.
      data = { token: udstedNoegle_(profil), boot: Core.handle(SheetDB, me, 'boot', {}, env_()) };
    } else if (Core.skriver(req.action)) {
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        SheetDB.nulstil();
        data = Core.handle(SheetDB, me, req.action, req.data, env_());
        SpreadsheetApp.flush();
      } finally {
        lock.releaseLock();
      }
    } else {
      data = Core.handle(SheetDB, me, req.action, req.data, env_());
    }
    out = { ok: true, data: data };
  } catch (err) {
    out = { ok: false, code: err.code || 'ERROR', error: String(err.message || err) };
    if (!err.code) console.error(err);
  }
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

function env_() {
  return {
    now: function () { return new Date(); },
    uuid: function () { return Utilities.getUuid().slice(0, 8); },
    notify: notify_,
    teambudget: teambudget_,
    shop: shopStatus_,
    sync: syncOptjening
  };
}

function notify_(b) {
  var conf = cfg_();
  var url = conf.SIDE_URL ? '\n' + conf.SIDE_URL + '/#/admin/bestillinger' : '';
  try {
    if (conf.CHAT_WEBHOOK) {
      UrlFetchApp.fetch(conf.CHAT_WEBHOOK, {
        method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
        payload: JSON.stringify({ text: '🛒 *' + b.emne + '*\n' + b.tekst + url })
      });
    }
    if (conf.NOTIFIKATION_MAIL) {
      MailApp.sendEmail(conf.NOTIFIKATION_MAIL, 'Webshoppen · ' + b.emne, b.tekst + url);
    }
  } catch (e) {
    console.error('Notifikation fejlede', e);
  }
}

function teambudget_() {
  var conf = cfg_();
  if (!conf.TEAMBUDGET_ARK_ID || !(conf.TEAMBUDGET_BUDGET_CELLE || conf.TEAMBUDGET_REST_CELLE)) return null;
  var cache = CacheService.getScriptCache();
  var hit = cache.get('teambudget');
  if (hit) return JSON.parse(hit);
  try {
    var ark = SpreadsheetApp.openById(conf.TEAMBUDGET_ARK_ID);
    var celle = function (c) { return c ? Core.num(ark.getRange(c).getValue()) : 0; };
    var brugt = celle(conf.TEAMBUDGET_BRUGT_CELLE);
    // Viser arket allerede, hvad der er tilbage (fx "Balance"), bruges TEAMBUDGET_REST_CELLE i stedet for budget − brugt
    var rest = conf.TEAMBUDGET_REST_CELLE ? celle(conf.TEAMBUDGET_REST_CELLE) : celle(conf.TEAMBUDGET_BUDGET_CELLE) - brugt;
    var tb = { budget: rest + brugt, brugt: brugt, rest: rest, saeson: conf.TEAMBUDGET_SAESON || '' };
    cache.put('teambudget', JSON.stringify(tb), 300);
    return tb;
  } catch (e) {
    console.error('Teambudget kunne ikke læses', e);
    return null;
  }
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
function fravaer_(conf) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('fravaer');
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
  cache.put('fravaer', res, 300);
  return res;
}

// ---------- Optjening ----------

function syncOptjening() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    SheetDB.nulstil();
    // OPTJENING_FRA er en måned (2026-11) eller en dato (2026-11-17 / 17-11-2026 = lanceringsdagen). Rækker før tælles ikke.
    var fraV = String(cfg_().OPTJENING_FRA || '').trim();
    var fraDato = dato_(fraV);
    var fraMaaned = fraDato ? Core.maanedKey(fraDato) : fraV;
    var kilder = {}, raa = {};
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
      }
    });
    var res = Core.applyEarnings(SheetDB, kilder, env_(), fraMaaned);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  // Fælles mål efter låsen: ClickUp og målarket kan tage tid, og kun synken skriver i fanen Maal,
  // så bestillinger skal ikke vente på dem. En fejl her stopper ikke optjeningen.
  try {
    opdaterMaal_(raa);
    SpreadsheetApp.flush();
  } catch (e) {
    console.error('Fælles mål kunne ikke opdateres: ' + e);
  }
  return res;
}

// Fælles mål med `kilde` i fanen Maal får `nu` udfyldt ved hver synk (indeværende og sidste måned):
//   tid:<fane>:<række>+<række>  → Tid ÷ Antal for måneden i MAAL_ARK_ID (fx tid:Web:Hjemmeside+Redesign)
//   anmeldelser:<gruppe>        → antal anmeldelser i måneden fra gruppens kolleger (kilden "anmeldelser")
//   celle:<fane>!<celle>        → tallet i én celle i MAAL_ARK_ID
//   clickup:<liste-id>:<status> → antal opgaver med den status på listen lige nu (kræver CLICKUP_TOKEN)
// celle og clickup er øjebliksbilleder, så de opdaterer kun indeværende måned – sidste måned beholder sit sluttal.
function opdaterMaal_(raa) {
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
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['syncOptjening', 'maanedsmail'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncOptjening').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('maanedsmail').timeBased().onMonthDay(1).atHour(7).create();
  SpreadsheetApp.getActive().toast('Optjening hentes hver time, og månedsmailen sendes den 1. kl. 7–8.');
}

// Månedsmail til admin den 1.: opgørelse til RAB + påmindelser (fælles mål, præmie, Afslør). Til NOTIFIKATION_MAIL eller første admin.
function maanedsmail() {
  SheetDB.nulstil();
  var conf = cfg_();
  var til = conf.NOTIFIKATION_MAIL || liste_(conf.ADMIN_EMAILS)[0];
  if (!til) return;
  var r = Core.maanedsrapport(SheetDB, env_());
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

var SheetDB = (function () {
  var cache = {};
  function ark(navn) {
    var sh = SpreadsheetApp.getActive().getSheetByName(navn);
    if (!sh) throw new Error('Fanen "' + navn + '" mangler. Kør Webshoppen → Opsæt faner.');
    return sh;
  }
  function all(navn) {
    if (cache[navn]) return cache[navn].rows;
    var sh = ark(navn);
    var values = sh.getDataRange().getValues();
    var headers = values[0].map(String);
    var rows = [];
    for (var i = 1; i < values.length; i++) {
      if (values[i].every(function (c) { return c === ''; })) continue;
      var o = { _row: i + 1 };
      headers.forEach(function (h, j) {
        var v = values[i][j];
        o[h] = v instanceof Date ? v.toISOString() : v;
      });
      rows.push(o);
    }
    cache[navn] = { headers: headers, rows: rows, sh: sh };
    return rows;
  }
  function insert(navn, obj) {
    all(navn);
    var c = cache[navn];
    c.sh.appendRow(c.headers.map(function (h) { return obj[h] === undefined ? '' : obj[h]; }));
    var row = { _row: c.sh.getLastRow() };
    c.headers.forEach(function (h) { row[h] = obj[h] === undefined ? '' : obj[h]; });
    c.rows.push(row);
    return row;
  }
  function update(navn, row, patch) {
    all(navn);
    var c = cache[navn];
    Object.keys(patch).forEach(function (k) {
      var col = c.headers.indexOf(k);
      if (col < 0) return;
      c.sh.getRange(row._row, col + 1).setValue(patch[k]);
      row[k] = patch[k];
    });
  }
  return { all: all, insert: insert, update: update, nulstil: function () { cache = {}; CFG_ = null; } };
})();

// ---------- Opsætning ----------

function opsaet() {
  var ss = SpreadsheetApp.getActive();
  var tekstKol = ['id', 'tid', 'maaned', 'initialer', 'fra', 'til', 'ref', 'email', 'sheet_id', 'noegle', 'vaerdi', 'gaver_set', 'afsloeret', 'vinder'];
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
    { gruppe: 'Support', kilde: 'anmeldelser', sats: 30, tekst: '30 Webcoins' },
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
