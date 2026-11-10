# Webshoppen

Intern "shop" for webafdelingen hos Best One A/S. Medarbejdere optjener **Webcoins** automatisk ud fra faktureringsark, anmeldelser m.m., og bruger dem på ting fra menuen (sodavand, Monster …), eller gaver til kolleger. Fælles mål pr. måned udløser en belønning for hele holdet (fx teamfrokost). Admin (Rasmus, `rmu`) får besked ved hver bestilling og kan rette i alt.

Læs altid `NOTES.md` for status, næste skridt og beslutninger, før du går i gang.

## Arkitektur

```
GitHub Pages (statisk frontend, custom domæne via CNAME, DNS hos Curanet)
   │  fetch POST (Content-Type: text/plain → ingen CORS-preflight)
   ▼
Google Apps Script web app (apps-script/Code.gs + shared/core.js som "Core.gs" + shared/sortiment.js som "Sortiment.gs")
   │  bundet til Google Sheet "Webshoppen DB" (= databasen)
   ├─ læser faktureringsark / anmeldelser (fanen Kilder) via timer-trigger
   ├─ læser teambudget-arket (Config-nøgler TEAMBUDGET_*)
   ├─ sender notifikation (Google Chat webhook og/eller mail)
   └─ læser admins kalender: "Ikke til stede" → shoppen lukker
```

- **Login:** Google Identity Services i browseren giver et ID-token. Backend verificerer det mod `oauth2.googleapis.com/tokeninfo` (aud = CLIENT_ID, domæne = best-one.dk) og slår mailen op i fanen `Brugere`. Ukendt mail → "Du er desværre ikke registreret".
- **Grupper:** Hjemmeside, Redaktør, Fotograf, Support. Alle ser samme dashboard; tallene afhænger af bruger og gruppe (optjeningsregler pr. gruppe i fanen `Regler`).
- **Saldoen må aldrig gå i minus.** Alle handlinger der trækker Webcoins (`bestil`, `koeb_drej`, `admin_justering`, `admin_saldo`) tjekker saldoen i backend under lås. Nye handlinger skal gøre det samme.
- **Webcoins er en posteringslog** (fanen `Posteringer`). Saldo = sum af posteringer. Typer: `optjent`, `koeb`, `gave`, `gave_modtaget` (0 Webcoins, kun historik), `projekt` (donation til et event – Events er fjernet fra UI'et 2026-11-10, typen findes stadig), `refusion`, `justering`, `hjul` (betaling for lykkehjul), `gevinst`.
- **Lykkehjulet er to trin:** `koeb_drej` (betaling, gemmes i fanen `Spil`) og `spin` (resultat). Drej-knappen er låst, indtil der er købt et drej. Hvert resultat registreres i `Spil`, og admin får **altid** besked med "via lykkehjulet". **Visningen er en tombola-rulle i CS-kasse-stil** (ikke et hjul): hvid rulle (passer til siden), præmiekort med ikon + tekst (Webcoins-gevinster bruger `coin()`, varer/Nitte emoji; ingen bjælke i bunden; hovedpræmien er et guld-kort), hvid markørstreg. Rullen fyldes med kort trukket efter chancen, vinderen (fra backend) lægges på plads 62, ca. 8,5 sek. med langsom afslutning, og rullen glider lidt forbi og retter sig ind (`reelKoer()`). "Køb et drej" og "Drej hjulet" er lige store; åben Drej-knap har 🎰.
- **Tilfældighed og afstemninger afgøres altid i backend** (`spin` og `stem` i core.js) – aldrig i browseren. Chancerne pr. præmie vises åbent (i-ikon) – vægtene står i `shared/sortiment.js`. Stemmetal sendes kun til admin.
- **Optjening er idempotent:** én postering pr. `optjent:<kilde>:<YYYY-MM>:<initialer>` (feltet `ref`), som opdateres ved hver synk – men **kun opad**: tjente Webcoins tages aldrig fra nogen, regler gælder kun fremad, og afsluttede måneder er låst fra den 4. i næste måned.
- **Økonomi: 1 kr = 2 Webcoins.** Priser, gevinster, præmier og optjeningsregler er sat efter det (kostpris i kr er uændret). **Kostpris = det der sendes til RAB** – kun varer firmaet har købt (Sodavand, Monster). Varer købt for teamkassen har `kostpris: 0`.
- Personer identificeres **altid med initialer** (JST, DSI …) i kildeark. **Initialer kan aldrig ændres**, når en bruger er oprettet (alt hænger på dem).

## Filer

| Sti | Indhold |
|---|---|
| `index.html` | Skal for hele appen |
| `assets/config.js` | `API_URL` (Apps Script web app-URL) og `GOOGLE_CLIENT_ID` – **sat og live siden 2026-11-10**. Tom `API_URL` = demo-tilstand (tøm den kun lokalt til test, og commit den aldrig tom) |
| `assets/app.js` | Al UI-logik (vanilla JS, hash-routing `#/`, `#/profil`, `#/admin/bestillinger`, `…/brugere`, `…/konkurrencer`, `…/regler`, `…/posteringer`) |
| `assets/app.css` | Design (lyst shop-look med blå + guld, mørkt tema som valg) |
| `assets/mock.js` | Demo-backend i browseren (localStorage), bruger `shared/core.js` |
| `shared/sortiment.js` | **Sortimentet**: menu, lykkehjul (præmier/vægte/pris) og events (ikke vist længere). Rettes kun her i koden – ingen Sortiment-side i admin, ingen faner i arket |
| `shared/core.js` | **Al forretningslogik**, delt mellem demo og Apps Script. Ingen Google-API'er her |
| `apps-script/Code.gs` | Sheet-adapter, auth, doPost, synk, notifikationer, kalenderfravær, opsætning af arket |
| `tools/udskaer.py` | Skærer produktbilleder ud til Bestil-listen (Pillow) – se NOTES.md |
| `tests/core.test.js` | Logiktest af core.js – køres med macOS' indbyggede `jsc` (se NOTES.md → Test) |
| `CNAME` | Custom domæne til GitHub Pages: `webshoppen.leksione.dk` |

## Konventioner

- Ingen build-step, ingen npm. Ren HTML/CSS/JS, så det kan køre direkte fra GitHub Pages.
- Forretningslogik ændres i `shared/core.js` og kopieres derefter ind i Apps Script-projektet som `Core.gs`. Sortiment (varer, priser, hjul) ændres i `shared/sortiment.js` → `Sortiment.gs`. Event-id'er må ikke ændres.
- **Skriv altid "Webcoins" helt ud** ("1 Webcoin" i ental) – aldrig WC eller andre forkortelser. Brug `wc(n)` i app.js. Mønt-ikonet (`coin()`) står **kun én gang og til sidst** efter beløbet, f.eks. "245 af 1.500 Webcoins 🪙" – aldrig foran eller midt i. **Undtagelser:** den store saldo i saldo-kortet øverst på Overblik og præmien i Månedens Webkollega har mønten **foran** (🪙 67 Webcoins / 🪙 50 Webcoins).
- **Primært laptop (MacBook) og desktop.** Mobil skal bare fungere (ingen vandret scroll) – brug ikke tid på at finpudse mobil.
- **Intet må brække over 2 linjer** i lister, regel-boksen, knapper og labels på laptop/desktop – brug `white-space: nowrap` og bredere felter frem for linjeskift.
- UI-tekster på dansk, korte. Ingen lange forklaringer i UI'et — funktionalitet og god UI.
- Branding: Montserrat, Best One-blå `#225581`. **Farver: kun blå eller hvid/grå/mørk** – ingen gul/guld baggrunde, bjælker eller flader. Guld (`--gold`) bruges **kun** i selve Webcoin-mønten (`coin()`) **og** som baggrund på lykkehjulets hovedpræmie (største Webcoins-gevinst, `hoved` i state). Lyst tema som standard, mørkt som valg. Skal bevidst **ikke** ligne det mørke salgsdashboard 1:1. Favicon = Webcoin-mønten (`favicon.svg`).
- Medarbejdere får topmenu (Overblik, Min profil) – intet sidepanel. Kun admin har sidepanel – det kan foldes sammen til kun ikoner («-knappen øverst, huskes i `localStorage` `ws-side-foldet`).
- **Luk shoppen:** Config `VEDLIGEHOLD` = ja → medarbejdere ser kun "Shoppen opdateres / Vi åbner snart igen", og `handle()` afviser alle skrivende handlinger for ikke-admins. Nye skrivende handlinger skal i `SKRIVER`, så de også blokeres.
- **Admin-overblik** (`pageAdminOverblik`, route `#/` for admin): nye bestillinger **øverst** med Udleveret/Annullér, så tre nøgletal (Brugt i måneden, Teambudget tilbage, Webcoins i omløb ≈ kr). Øverst i sidehovedet står fast "Brugt siden start: X Webcoins ≈ kr Y" ved siden af "Hentet …", Fælles mål (belønning + status pr. mål) ved siden af Månedens Webkollega (præmie/stilling), seneste aktivitet og opgørelse pr. måned. Admin ser **ikke** medarbejdernes forside og har ingen Min profil; den gamle Opgørelse-side er lagt ind i overblikket.
- **Logo = det officielle "best One"-ordmærke som SVG** (`boLogo()`, `LOGO_PATHS` i app.js). Må **kun** vises i blå (`--brand`) eller hvid (mørkt tema). Ikke en tekst-efterligning. "Webshoppen" ved siden af er fed og en anelse mindre end logoet.
- **b-mærket** (`bMark()`, samme glyf som b'et i logoet) bruges som halvskjult dekoration i højre side af saldo-kortet og profilkortet – hvidt, lav opacitet.
- Min profil: topkort (gruppe, navn, saldo uden ordet "Saldo"), tre visuelle nøgletal (Optjent, Brugt, Donationer) og faner Bestillinger / Optjening / Aktivitet (Bestillinger åbner først). Ingen initialer i toppen.
- "Donationer" = gaver givet til kolleger.
- **Events er fjernet** (2026-11-10 – kollegerne ville næppe donere). I stedet har **Fælles mål** en belønning pr. måned: "Hvis vi når X ud af Y mål i <måned>: <belønning>" (med ikon valgt i admin) (fanen `MaalPraemie`, sat under Admin → Konkurrencer). Handlingen `indskyd` og `projekter` i state er fjernet; posteringstypen `projekt` tælles stadig i statistikken, og `SORTIMENT.events` står urørt. Genindfør det ikke uden aftale.
- **Admin (rmu) deltager ikke**: står kun i `ADMIN_EMAILS`, ikke i `Brugere`. Ingen bestilling, hjul, donation, stemme eller profil – kun moderering. Admin-sider: Overblik, Bestillinger, Brugere, Konkurrencer (Månedens Webkollega + kommende konkurrencer), Regler, Posteringer, Feedback (ingen Sortiment – det rettes i `shared/sortiment.js`). Plus **Vis som medarbejder** (kun visning, alle handlinger blokeres i `api()`).
- **Demobrugere bruger opdigtede mails** (`demo.<ini>@best-one.dk`, `ade@…` osv.) – aldrig kollegernes rigtige adresser.
- **Demo-saldo er altid 67 Webcoins** for alle testbrugere (justering til sidst i seed i `mock.js`). Ændres demo-data, skal saldoen stadig ende på 67 – og bump `KEY` i mock.js, så demoen nulstilles.
- **Ingen rigtige navne/mails i repoet** (det er offentligt). Rigtig brugerliste ligger i `brugere.local.csv` (gitignored). Demo bruger "Demo …"-navne.
- Forsidens prioritet: 1) saldo + teambudget (stort tal = rest i alt, derunder kun "Brugt i sæsonen", sæson som tag fra `TEAMBUDGET_SAESON`) + regler (i-ikon), 2) menu/bestil (kompakt liste), 3) Feelin' Lucky?, 4) midterstillet overskrift "Månedlige konkurrencer og mål" med "<Måned år>" i en blå pill over 5) Månedens Webkollega og 6) Fælles mål med belønning øverst (nederst – "Fælles mål | Se status" i regel-boksen scroller hertil). Optjent, forbrug, bevægelser og bestillinger ligger **kun** på Min profil.
- Bestil-listen har faste kolonner (billede | indhold | beløb | knapper) – hold dem aligned.
### Faste tekster og farver (aftalt med Rasmus)
- Gave til kollega hedder **"Donér til en kollega"** (knap og dialog); bekræftelse "Din donation er sendt 🎁".
- Ventetid: **"Personlig levering, forvent lidt ventetid."**
- Bestil-listen har **ingen små undertekster** under varenavne og bruger **emojis**, ikke produktfotos. I bestillingsvinduet styres det pr. vare: `varianter` → valgknapper, `oenske = ja` → "Dit ønske"-felt, ellers direkte bestilling.
- "Andet?"-rækken i menuen ("Har du en idé?") har én hvid knap **"Send forslag"**. Forslag og feedback sendes via backend (`forslag`): gemmes i fanen `Forslag` og vises under **Admin → Feedback** (+ mail/Chat til admin), ikke mailto. Fælles mål har nederst "Har du en idé til hvad vi skal lave næste gang?" + "Send forslag" (type `praemie`).
- Saldo-kortet: **"Hvordan optjener jeg?"** + i-ikon; klik åbner en boks med gruppens regler, hover viser en boble.
- Teambudget: rest i alt som stort tal; "Brugt i sæsonen" står i **mild rød** (`.tb-sub .brugt`).
- Månedens Webkollega: begrundelse frivillig (alt godtages, også tomt); præmien er "Coming soon" ved ny måned, indtil admin vælger en (`MDK_PRAEMIE_MAANED`); tekst: "Stem på en kollega, der har hjulpet dig, gjort noget ekstra eller løftet stemningen. Det handler om mennesker, ikke salgstal."
- Røde tal = brugt/minus, grønne = optjent/plus. **Fælles mål:** fyldet i progressbaren går fra lyseblå (0 %) til Best One-blå (99 %) (`maalFarve()` → CSS-variablen `--p`, `color-mix`), **dyb grøn** (#1f8a55) når målet er nået, og ✓ (grøn) / ✕ (rød) / – (ingen status) til højre. Ellers kun blå, hvid, grå og mørk.

- Escape altid brugerdata med `esc()` i app.js før det sættes ind i HTML. Tekst til arket neutraliseres i `SheetDB` (= + - @ foran → ren tekst), så fritekst aldrig bliver en formel.
- Danske Google Sheets bruger `;` i formler.
- Hemmeligheder (webhook-URL'er m.m.) ligger i fanen `Config` i arket — aldrig i repoet.

## Kør lokalt

```bash
cd ~/code/webshoppen && python3 -m http.server 8765
```
Åbn http://localhost:8765 — den kører mod den rigtige backend (localhost:8765 er godkendt i Google-login). Til demo-tilstand med testbrugere: åbn http://localhost:8765/?demo (`?demo` virker kun på localhost) eller tøm `API_URL` i `assets/config.js` midlertidigt og sæt den tilbage før commit. Port 8080 er optaget af qBittorrent på den private Mac.

Test af kernen (ingen Node nødvendig):
```bash
cd ~/code/webshoppen && /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc shared/core.js tests/core.test.js
```
Efter ændringer: kør testen, klik siderne igennem i demo, bump `?v=` i `index.html`, opdatér NOTES.md, commit og push.
Ændres `shared/core.js`, `shared/sortiment.js` eller `apps-script/Code.gs`, skal Rasmus kopiere filen ind i Apps Script (kopiér med `LC_ALL=en_US.UTF-8 pbcopy < fil` – uden UTF-8 bliver æøå og emojis forvanskede) og udgive en ny version (Administrer implementeringer → Rediger → Ny version). Saml ændringerne, så han ikke skal indsætte af flere omgange.
