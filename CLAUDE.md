# Webshoppen

Intern "shop" for webafdelingen hos Best One A/S. Medarbejdere optjener **Webcoins** automatisk ud fra faktureringsark, anmeldelser m.m., og bruger dem på ting fra menuen (sodavand, Monster …), gaver til kolleger eller fælles projekter (teamfrokost, biograf …). Admin (Rasmus, `rmu`) får besked ved hver bestilling og kan rette i alt.

Læs altid `NOTES.md` for status, næste skridt og beslutninger, før du går i gang.

## Arkitektur

```
GitHub Pages (statisk frontend, custom domæne via CNAME, DNS hos Curanet)
   │  fetch POST (Content-Type: text/plain → ingen CORS-preflight)
   ▼
Google Apps Script web app (apps-script/Code.gs + shared/core.js som "Core.gs")
   │  bundet til Google Sheet "Webshoppen DB" (= databasen)
   ├─ læser faktureringsark / anmeldelser (fanen Kilder) via timer-trigger
   ├─ læser teambudget-arket (Config-nøgler TEAMBUDGET_*)
   ├─ sender notifikation (Google Chat webhook og/eller mail)
   └─ læser admins kalender: "Ikke til stede" → shoppen lukker
```

- **Login:** Google Identity Services i browseren giver et ID-token. Backend verificerer det mod `oauth2.googleapis.com/tokeninfo` (aud = CLIENT_ID, domæne = best-one.dk) og slår mailen op i fanen `Brugere`. Ukendt mail → "Du er desværre ikke registreret".
- **Grupper:** Hjemmeside, Redaktør, Fotograf, Support. Alle ser samme dashboard; tallene afhænger af bruger og gruppe (optjeningsregler pr. gruppe i fanen `Regler`).
- **Webcoins er en posteringslog** (fanen `Posteringer`). Saldo = sum af posteringer. Typer: `optjent`, `koeb`, `gave`, `gave_modtaget` (0 Webcoins, kun historik), `projekt` (donation til projekt), `refusion`, `justering`, `hjul` (betaling for lykkehjul), `gevinst`.
- **Lykkehjulet er to trin:** `koeb_drej` (betaling, gemmes i fanen `Spil`) og `spin` (resultat). Drej-knappen er låst, indtil der er købt et drej. Hvert resultat registreres i `Spil`, og admin får **altid** besked med "via lykkehjulet".
- **Tilfældighed og afstemninger afgøres altid i backend** (`spin` og `stem` i core.js) – aldrig i browseren. Hjulets vægte og stemmetal sendes kun til admin.
- **Optjening er idempotent:** én postering pr. `optjent:<kilde>:<YYYY-MM>:<initialer>` (feltet `ref`), som opdateres ved hver synk.
- Personer identificeres **altid med initialer** (JST, DSI …) i kildeark.

## Filer

| Sti | Indhold |
|---|---|
| `index.html` | Skal for hele appen |
| `assets/config.js` | `API_URL` (Apps Script web app-URL) og `GOOGLE_CLIENT_ID`. Tom `API_URL` = demo-tilstand |
| `assets/app.js` | Al UI-logik (vanilla JS, hash-routing `#/`, `#/profil`, `#/admin/bestillinger`, `…/opgoerelse`, `…/brugere`, `…/sortiment`, `…/kollega`, `…/regler`, `…/posteringer`) |
| `assets/app.css` | Design (lyst shop-look med blå + guld, mørkt tema som valg) |
| `assets/mock.js` | Demo-backend i browseren (localStorage), bruger `shared/core.js` |
| `shared/core.js` | **Al forretningslogik**, delt mellem demo og Apps Script. Ingen Google-API'er her |
| `apps-script/Code.gs` | Sheet-adapter, auth, doPost, synk, notifikationer, kalenderfravær, opsætning af arket |
| `tools/udskaer.py` | Skærer produktbilleder ud til Bestil-listen (Pillow) – se NOTES.md |
| `tests/core.test.js` | Logiktest af core.js – køres med macOS' indbyggede `jsc` (se NOTES.md → Test) |
| `CNAME` | Custom domæne til GitHub Pages (oprettes når subdomænet er valgt) |

## Konventioner

- Ingen build-step, ingen npm. Ren HTML/CSS/JS, så det kan køre direkte fra GitHub Pages.
- Forretningslogik ændres i `shared/core.js` og kopieres derefter ind i Apps Script-projektet som `Core.gs`.
- **Skriv altid "Webcoins" helt ud** ("1 Webcoin" i ental) – aldrig WC eller andre forkortelser. Brug `wc(n)` i app.js. Mønt-ikonet (`coin()`) står **kun én gang og til sidst** efter beløbet, f.eks. "245 af 1.500 Webcoins 🪙" – aldrig foran eller midt i. **Eneste undtagelse:** den store saldo i saldo-kortet øverst på Overblik har mønten **foran** tallet (🪙 67 Webcoins).
- **Primært laptop (MacBook) og desktop.** Mobil skal bare fungere (ingen vandret scroll) – brug ikke tid på at finpudse mobil.
- UI-tekster på dansk, korte. Ingen lange forklaringer i UI'et — funktionalitet og god UI.
- Branding: Montserrat, Best One-blå `#225581`. **Farver: kun blå eller hvid/grå/mørk** – ingen gul/guld baggrunde, bjælker eller flader. Guld (`--gold`) bruges **kun** i selve Webcoin-mønten (`coin()`). Lyst tema som standard, mørkt som valg. Skal bevidst **ikke** ligne det mørke salgsdashboard 1:1. Favicon = Webcoin-mønten (`favicon.svg`).
- Medarbejdere får topmenu (Overblik, Min profil) – intet sidepanel. Kun admin har sidepanel.
- **Logo = det officielle "best One"-ordmærke som SVG** (`boLogo()`, `LOGO_PATHS` i app.js). Må **kun** vises i blå (`--brand`) eller hvid (mørkt tema). Ikke en tekst-efterligning. "Webshoppen" ved siden af er fed og en anelse mindre end logoet.
- **b-mærket** (`bMark()`, samme glyf som b'et i logoet) bruges som halvskjult dekoration i højre side af saldo-kortet og profilkortet – hvidt, lav opacitet.
- Min profil: topkort (gruppe, navn, saldo uden ordet "Saldo"), tre visuelle nøgletal (Optjent, Brugt, Donationer) og faner Aktivitet / Optjening / Bestillinger. Ingen initialer i toppen.
- "Donationer" = gaver givet til kolleger; projekter bruger knappen "Donér".
- **Admin (rmu) deltager ikke**: står kun i `ADMIN_EMAILS`, ikke i `Brugere`. Ingen bestilling, hjul, donation, stemme eller profil – kun moderering.
- **Demo-saldo er altid 67 Webcoins** for alle testbrugere (justering til sidst i seed i `mock.js`). Ændres demo-data, skal saldoen stadig ende på 67 – og bump `KEY` i mock.js, så demoen nulstilles.
- **Ingen rigtige navne/mails i repoet** (det er offentligt). Rigtig brugerliste ligger i `brugere.local.csv` (gitignored). Demo bruger "Demo …"-navne.
- Forsidens prioritet: 1) saldo + teambudget (stort tal = rest i alt, derunder kun "Brugt i sæsonen", sæson som tag fra `TEAMBUDGET_SAESON`) + regler (i-ikon), 2) menu/bestil (kompakt liste), 3) Feelin' Lucky?, 4) projekter, 5) Månedens kollega (nederst). Optjent, forbrug, bevægelser og bestillinger ligger **kun** på Min profil.
- Bestil- og projektlisten deler kolonner (billede | indhold | beløb | knapper) – hold dem aligned.
### Faste tekster og farver (aftalt med Rasmus)
- Gave til kollega hedder **"Donér til en kollega"** (knap og dialog); bekræftelse "Din donation er sendt 🎁". Projekter bruger knappen **"Donér"**.
- Ventetid: **"Personlig levering, forvent lidt ventetid."**
- Bestil-listen har **ingen små undertekster** under varenavne og bruger **emojis**, ikke produktfotos. I bestillingsvinduet styres det pr. vare: `varianter` → valgknapper, `oenske = ja` → "Dit ønske"-felt, ellers direkte bestilling.
- "Andet?"-rækker (menu: "Har du en idé?", projekter: "Har du en idé til et projekt?") har én hvid knap **"Send forslag"**. Forslag sendes via backend (`forslag` → `env.notify` → `NOTIFIKATION_MAIL`/Chat), ikke mailto.
- Saldo-kortet: **"Hvordan optjener jeg?"** + i-ikon; klik åbner en boks med gruppens regler, hover viser en boble.
- Teambudget: rest i alt som stort tal; "Brugt i sæsonen" står i **mild rød** (`.tb-sub .brugt`).
- Månedens kollega: begrundelse påkrævet; teksten siger, at resultater (salg, fakturering) ikke tæller.
- Røde tal = brugt/minus, grønne = optjent/plus. Ellers kun blå, hvid, grå og mørk.

- Escape altid brugerdata med `esc()` i app.js før det sættes ind i HTML.
- Danske Google Sheets bruger `;` i formler.
- Hemmeligheder (webhook-URL'er m.m.) ligger i fanen `Config` i arket — aldrig i repoet.

## Kør lokalt

```bash
cd ~/code/webshoppen && python3 -m http.server 8765
```
Åbn http://localhost:8765 — uden `API_URL` kører den i demo-tilstand med testbrugere (`@best-one.dk`). Port 8080 er optaget af qBittorrent på den private Mac.

Test af kernen (ingen Node nødvendig):
```bash
cd ~/code/webshoppen && /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc shared/core.js tests/core.test.js
```
Efter ændringer: kør testen, klik siderne igennem i demo, bump `?v=` i `index.html`, opdatér NOTES.md, commit og push.
