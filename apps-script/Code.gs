/**
 * Webshoppen – Apps Script backend.
 * Bindes til Google Sheet'et "Webshoppen DB". Kræver også filen Core.gs (= shared/core.js).
 * Opsætning: se NOTES.md → "Sådan sættes backend op".
 */

// ---------- Menu i arket ----------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Webshoppen')
    .addItem('Opsæt faner (første gang)', 'opsaet')
    .addItem('Hent optjening nu', 'syncOptjening')
    .addItem('Slå automatisk hentning til (hver time)', 'installerTrigger')
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
    if (Core.skriver(req.action)) {
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

function verificer_(token, conf) {
  if (!token) throw Core.err('TOKEN_EXPIRED', 'Log ind igen.');
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
  if (!conf.TEAMBUDGET_ARK_ID || !conf.TEAMBUDGET_BUDGET_CELLE) return null;
  var cache = CacheService.getScriptCache();
  var hit = cache.get('teambudget');
  if (hit) return JSON.parse(hit);
  try {
    var ark = SpreadsheetApp.openById(conf.TEAMBUDGET_ARK_ID);
    var budget = Core.num(ark.getRange(conf.TEAMBUDGET_BUDGET_CELLE).getValue());
    var brugt = conf.TEAMBUDGET_BRUGT_CELLE ? Core.num(ark.getRange(conf.TEAMBUDGET_BRUGT_CELLE).getValue()) : 0;
    var tb = { budget: budget, brugt: brugt, rest: budget - brugt, saeson: conf.TEAMBUDGET_SAESON || '' };
    cache.put('teambudget', JSON.stringify(tb), 600);
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
    var kilder = {};
    SheetDB.all('Kilder').forEach(function (k) {
      var id = String(k.kilde).trim();
      if (!id || !k.sheet_id) return;
      var data = kilder[id] = kilder[id] || {};
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
          data[key] = (data[key] || 0) + v;
        }
      } catch (e) {
        console.error('Kilde ' + id + ' fejlede: ' + e);
      }
    });
    var res = Core.applyEarnings(SheetDB, kilder, env_(), cfg_().OPTJENING_FRA || '');
    SpreadsheetApp.flush();
    return res;
  } finally {
    lock.releaseLock();
  }
}

function installerTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncOptjening') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncOptjening').timeBased().everyHours(1).create();
  SpreadsheetApp.getActive().toast('Optjening hentes nu automatisk hver time.');
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
  var tekstKol = ['id', 'tid', 'maaned', 'initialer', 'fra', 'til', 'ref', 'email', 'sheet_id', 'noegle', 'vaerdi'];
  Object.keys(Core.TABELLER).forEach(function (navn) {
    var headers = Core.TABELLER[navn];
    var sh = ss.getSheetByName(navn) || ss.insertSheet(navn);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    headers.forEach(function (h, i) {
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
    { noegle: 'TEAMBUDGET_SAESON', vaerdi: '' },
    { noegle: 'HJUL_PRIS', vaerdi: 15 },
    { noegle: 'MDK_PRAEMIE', vaerdi: 'En snack efter eget valg' }
  ]);
  seed('Menu', [
    { id: 'sodavand', navn: 'Sodavand', ikon: '🥤', pris: 10, kostpris: 8, varianter: 'Pepsi Max, Faxe Kondi, Faxe Kondi 0 kalorier, Danskvand', aktiv: 'ja' },
    { id: 'monster', navn: 'Monster', ikon: '⚡', pris: 20, kostpris: 15, varianter: 'Hvid Monster', aktiv: 'ja' },
    { id: 'candybar', navn: 'Candybar', ikon: '🍫', pris: 8, kostpris: 6, varianter: 'Marsbar, Snickers', aktiv: 'ja' },
    { id: 'andet', navn: 'Andet', ikon: '✨', pris: 0, kostpris: 0, snart: 'ja', aktiv: 'ja' }
  ]);
  // Feelin' Lucky? – vægt = relativ chance. type: vare (admin leverer), webcoins (lægges på saldo), intet.
  seed('Hjul', [
    { id: 'h-candybar', navn: 'Candybar', ikon: '🍫', type: 'vare', beloeb: 0, kostpris: 6, vaegt: 28, aktiv: 'ja' },
    { id: 'h-5', navn: '5 Webcoins', ikon: '✨', type: 'webcoins', beloeb: 5, kostpris: 0, vaegt: 22, aktiv: 'ja' },
    { id: 'h-intet', navn: 'Ingen gevinst', ikon: '🙈', type: 'intet', beloeb: 0, kostpris: 0, vaegt: 25, aktiv: 'ja' },
    { id: 'h-sodavand', navn: 'Sodavand', ikon: '🥤', type: 'vare', beloeb: 0, kostpris: 8, vaegt: 10, aktiv: 'ja' },
    { id: 'h-25', navn: '25 Webcoins', ikon: '💰', type: 'webcoins', beloeb: 25, kostpris: 0, vaegt: 7, aktiv: 'ja' },
    { id: 'h-monster', navn: 'Hvid Monster', ikon: '⚡', type: 'vare', beloeb: 0, kostpris: 15, vaegt: 6, aktiv: 'ja' },
    { id: 'h-50', navn: '50 Webcoins', ikon: '🏆', type: 'webcoins', beloeb: 50, kostpris: 0, vaegt: 2, aktiv: 'ja' }
  ]);
  seed('Projekter', [
    { id: 'frokost', navn: 'Teamfrokost', ikon: '🍽️', maal: 1500, aaben: 'ja' },
    { id: 'biograf', navn: 'Tur i biografen', ikon: '🎬', maal: 800, aaben: 'ja' }
  ]);
  seed('Kilder', [
    { kilde: 'nyfak', navn: 'Nyfak', sheet_id: '', fane: '', kol_initialer: '', kol_vaerdi: '', kol_dato: '', start_raekke: 2 },
    { kilde: 'genfak', navn: 'Genfak', sheet_id: '', fane: '', kol_initialer: '', kol_vaerdi: '', kol_dato: '', start_raekke: 2 },
    { kilde: 'anmeldelser', navn: 'Anmeldelser', sheet_id: '', fane: '', kol_initialer: '', kol_vaerdi: '', kol_dato: '', start_raekke: 2 },
    { kilde: 'leverancer', navn: 'Leverancer', sheet_id: '', fane: '', kol_initialer: '', kol_vaerdi: '', kol_dato: '', start_raekke: 2 }
  ]);
  // Pladsholder-regler – skal regnes igennem før lancering.
  seed('Regler', [
    { gruppe: 'Hjemmeside', kilde: 'nyfak', sats: 0.001, tekst: '1 Webcoin pr. 1.000 kr' },
    { gruppe: 'Hjemmeside', kilde: 'anmeldelser', sats: 15, tekst: '15 Webcoins pr. anmeldelse' },
    { gruppe: 'Redaktør', kilde: 'leverancer', sats: 4, tekst: '4 Webcoins pr. leverance' },
    { gruppe: 'Redaktør', kilde: 'anmeldelser', sats: 15, tekst: '15 Webcoins pr. anmeldelse' },
    { gruppe: 'Fotograf', kilde: 'leverancer', sats: 6, tekst: '6 Webcoins pr. optagelse' },
    { gruppe: 'Fotograf', kilde: 'anmeldelser', sats: 15, tekst: '15 Webcoins pr. anmeldelse' },
    { gruppe: 'Support', kilde: 'genfak', sats: 0.002, tekst: '2 Webcoins pr. 1.000 kr' },
    { gruppe: 'Support', kilde: 'anmeldelser', sats: 15, tekst: '15 Webcoins pr. anmeldelse' }
  ]);
  var standard = ss.getSheetByName('Ark1') || ss.getSheetByName('Sheet1');
  if (standard && standard.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(standard);
  SpreadsheetApp.getUi().alert('Fanerne er klar. Udfyld Config, Brugere og Kilder.');
}
