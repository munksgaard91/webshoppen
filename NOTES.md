# NOTES – status og næste skridt

Opdateres ved hver arbejdsblok, så arbejdet kan fortsættes fra en anden maskine.

## Status (2026-11-08)

**Færdigt (kører i demo-tilstand):**
- Nyt design adskilt fra salgsdashboardet: lyst, Best One-blå + guld Webcoin-mønt, mørkt tema som valg. Favicon = mønten.
- Medarbejdere: topmenu (Overblik / Min profil), intet sidepanel. Admin beholder sidepanel.
- Forside i prioriteret rækkefølge: saldo + teambudget + regler (i-ikon med hover/klik) → Bestil → Projekter → Statistik → Bevægelser + Mine bestillinger.
- "Webcoins" skrives altid helt ud.
- Forside v2: "Du har" + "Du har optjent +x Webcoins i <måned>". Bestil og Projekter er lister i fuld bredde. Projekter viser top 3 bidragydere + dit bidrag. Statistik = kun dine tal: optjent i måneden + brugt i alt fordelt på til dig selv / donationer / i projekter. Disclaimer under Bevægelser.
- Min profil v2: saldo-pille, kort for optjent i alt (heraf i måneden), brugt i alt (selv/donationer/projekter) og gaver. Derefter "Optjent pr. måned" fordelt på kilder, "Mine bestillinger" med status og "Alle bevægelser" med filtre + disclaimer.
- Varer kan have et billede (kolonne `billede` i Menu-fanen, URL eller sti som `assets/varer/monster.jpg`). Uden billede vises emoji.
- Åbningstid 08:00–15:30 på hverdage + lukket når admin har "Ikke til stede" i kalenderen → overlay "Shoppen har lukket". Bestil bliver til **Forudbestil**: bestillingen gemmes med `forud = ja` (ny kolonne i Bestillinger), admin får "Forudbestilling · …" og den vises som "Forudbestilt", indtil den er udleveret. Admin ser et banner i stedet for overlay.
- Topmenu (2026-11-09): rigtigt Best One-logo (SVG fra salgsdashboardet, `boLogo()` i app.js, farves med `currentColor`), Overblik/Min profil centreret, ingen Webcoins-saldo i toppen, "Log ud" ligger i dropdown under brugerens badge.
- Forside v3 (2026-11-09): kompakt bestil-liste, højere projektrækker med samme kolonner som menuen, "Du har optjent …" fjernet fra saldo-kortet, teambudget viser rest i alt som stort tal, derunder "Brugt i sæsonen: kr x" og sæsonen som tag (Config `TEAMBUDGET_SAESON`, fx `2026/27`). Statistik, bevægelser og bestillinger er flyttet helt til Min profil.
- Projekter (2026-11-09): knappen hedder **Donér** (handlingen hedder stadig `indskyd` i koden). Beløb og mål står inde i en større progressbar ("245 Webcoins af 1.500 Webcoins" + procent), så rækken ikke har en separat beløbskolonne. "Dit bidrag" står småt under knappen.
- Note om ventetid ved bestilling (personlig levering).
- Min profil: nøgletal + fuld historik med filtre.
- Regler-side for alle grupper (kun admin; medarbejdere ser egne regler via i-ikonet).
- Admin: bestillinger (udleveret/annullér med refusion), **opgørelse** (rigtige kr pr. måned ud fra varernes kostpris – det beløb der skal trækkes), brugere (opret/ret/gruppe/justér saldo), sortiment (menu + projekter), alle posteringer + "Hent optjening nu".
- Backend-kode i `apps-script/Code.gs` (ikke deployet endnu).
- Mobil-layout.

**Ikke gjort endnu:**
- Backend er ikke sat op i Google (se tjekliste nedenfor).
- Optjeningsregler er **pladsholdere** – skal regnes igennem.
- Kilder (faktureringsark, anmeldelser) er ikke koblet på – kræver ark-ID'er og kolonner.
- Teambudget-arket er ikke koblet på.
- Subdomæne er ikke valgt (`xxx.leksione.dk`). `SIDE_URL` står som `webshoppen.leksione.dk` indtil videre. Ingen `CNAME`-fil endnu.
- Projekter (teamfrokost, biograf) tæller ikke med i opgørelsen endnu – kun menuvarer.

## Beslutninger

- **Apps Script + Google Sheet som backend** i stedet for Cloudflare: alle datakilder er Google Sheets, mail/Chat er indbygget, DNS styres via GitHub Pages + Curanet, og der er ingen Node på den private Mac.
- **Saldo = sum af posteringer** (ingen saldo-kolonne der kan komme ud af sync). Admin kan rette direkte i arket, hvis noget skal laves om.
- **Optjening pr. måned** med fast `ref` → synk kan køres igen og igen uden dobbelt-optjening. `OPTJENING_FRA` i Config bestemmer fra hvilken måned der tælles.
- **Gave = vare** (ikke rå Webcoins). Giveren betaler, admin får besked og leverer til modtageren.
- Brugere uden for `Brugere`-fanen ser "Du er desværre ikke registreret". Admin styres af `ADMIN_EMAILS` i Config.
- **Repoet er offentligt** (gratis GitHub Pages). Det er kun frontend – alle data, mails og webhooks ligger i Google-arket.
- **Kostpris gemmes på bestillingen** i bestillingsøjeblikket, så gamle måneder ikke ændrer sig, hvis prisen på en vare rettes.
- **Fravær læses fra kalenderen** for den konto, der har deployet Apps Script (admin). Både Googles "Ikke til stede"-begivenhedstype og titler med "Ikke til stede"/"Out of office" tæller. Cache 5 min. Projekter kan stadig få indskud, når shoppen er lukket – kun bestillinger blokeres.
- Notifikationer: Google Chat webhook og/eller mail – begge kan slås til i Config.

## Sådan sættes backend op

1. Opret et nyt Google Sheet "Webshoppen DB" (på din best-one.dk-konto).
2. Udvidelser → Apps Script. Opret filerne:
   - `Code.gs` ← indholdet af `apps-script/Code.gs`
   - `Core.gs` ← indholdet af `shared/core.js`
   - Projektindstillinger → vis `appsscript.json` → indsæt `apps-script/appsscript.json`
3. Genindlæs arket → menuen **Webshoppen → Opsæt faner**. Godkend adgang.
4. Google Cloud Console (samme konto) → APIs & Services → Credentials → **OAuth client ID** (Web application).
   - Authorized JavaScript origins: `https://<subdomæne>.leksione.dk` og `http://localhost:8765`.
   - Kopiér Client ID ind i Config-fanen (`CLIENT_ID`) og i `assets/config.js` (`GOOGLE_CLIENT_ID`).
5. Apps Script → Implementér → Ny implementering → Webapp (kør som: mig, adgang: alle). Kopiér URL'en ind i `assets/config.js` (`API_URL`).
6. Udfyld fanen `Brugere` (email, initialer, navn, gruppe, aktiv=ja) – eller gør det fra admin-siden.
7. Udfyld `Kilder` (ark-ID, fane, kolonnebogstaver for initialer/værdi/dato). Tom `kol_vaerdi` = tæl rækker (fx anmeldelser).
8. Åbningstid: `AABNER`, `LUKKER`, `AABNE_DAGE` (1-5 = man–fre), `LUK_VED_FRAVAER` (ja/nej), `KALENDER_ID` (tom = din primære kalender).
9. Valgfrit: `CHAT_WEBHOOK` (Google Chat → space → Apps & integrations → Webhooks), `NOTIFIKATION_MAIL`, `TEAMBUDGET_*` (inkl. `TEAMBUDGET_SAESON`, fx `2026/27`).
10. **Webshoppen → Slå automatisk hentning til**.

Ved ændringer i `shared/core.js` eller `Code.gs`: kopiér ind i Apps Script og lav **Administrer implementeringer → Rediger → Ny version** (så URL'en bevares).
Ved ændringer i assets: bump `?v=` i `index.html`.
Demo af lukket shop: tilføj `?lukket=fravaer` eller `?lukket=tid` til adressen.

## Før go-live (fundet ved kodegennemgang 2026-11-09)

Skal tages op ved fejlsøgning og før lancering:
1. **Login udløber hver time** – Google ID-token (~1 t) gemmes i localStorage; ved udløb sendes brugeren til login (`api()` → `logout` på TOKEN_EXPIRED). Overvej stille fornyelse.
2. **Månedsfejl omkring midnat** – `pageAdminOpgoerelse` bruger `S.nu.slice(0,7)` (UTC). Den 1. i måneden kl. 00–01/02 dansk tid vises forrige måned i "Brugt i <måned>".
3. **Ingen refusion ved lukkede projekter** – indskud (`type: projekt`) kan ikke gives tilbage.
4. **Forældede optjeningsposteringer** – `applyEarnings` opdaterer kun refs, den stadig beregner. Ved gruppeskift eller fjernet regel bliver gamle `optjent`-posteringer liggende.

## Næste skridt

0. **Næste i designet:** Rasmus' feedback på Min profil v2, derefter menuen (bestillingslisten). Rasmus har billeder til baggrunde og varer, der skal lægges i `assets/`.

1. Vælg subdomæne → tilføj `CNAME`-fil, opret CNAME hos Curanet → `munksgaard91.github.io`, slå Pages til.
2. Sæt backend op (tjekliste ovenfor).
3. Kobl faktureringsark, anmeldelser og teambudget på.
4. Regn optjeningsreglerne igennem (økonomi: hvad koster en sodavand i WC vs. hvad tjener man om måneden).
5. Test med 2-3 kolleger før alle får adgang.
