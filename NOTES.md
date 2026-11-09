# NOTES – status og næste skridt

Opdateres ved hver arbejdsblok, så arbejdet kan fortsættes fra en anden maskine.
Sidst opdateret: **2026-11-09** (privat Mac). Seneste kodegennemgang: 2026-11-09 – alle filer parser, `tests/core.test.js` 16/16 OK, alle sider klikket igennem i demo uden konsolfejl.

## Status

Alt kører i **demo-tilstand** (tom `API_URL`) på https://munksgaard91.github.io/webshoppen/. Backend er skrevet, men **ikke sat op i Google endnu**.

### Medarbejder – Overblik (`#/`)
Rækkefølge (se også CLAUDE.md):
1. **Saldo-kort** (blåt, halvskjult "b" i højre side) med hilsen, saldo og i-ikon med egne optjeningsregler (hover/klik). Ved siden af **Teambudget**: rest i alt som stort tal, "Brugt i sæsonen: kr x", sæson som tag (`TEAMBUDGET_SAESON`).
2. **Bestil** – kompakt liste med skiftevis hvid/lysegrå rækker. Priser er højrestillede tal (1–3 cifre flugter) + "Webcoins" + mønt til sidst. Knapper: Giv (gave til kollega) og Bestil. Varer med `varianter` åbner et valg (Sodavand, Candybar); én variant vælges automatisk (Monster → Hvid Monster). `snart = ja` → "Kommer snart", kan ikke bestilles (Andet). Note om ventetid (personlig levering).
3. **Feelin' Lucky?** – lykkehjul, fast pris pr. drej. Gevinsten afgøres i backend; browseren animerer kun hjulet hen til resultatet.
4. **Projekter** – liste med skiftevis baggrund. Stor progressbar med "**245** af 1.500 Webcoins 🪙" og fed procent. Top 3 under hinanden med beløb tæt på navnet. Blå **Donér**-knap (handlingen hedder `indskyd` i koden), "Dit bidrag" småt under knappen.
5. **Månedens kollega** – stem én gang pr. måned på en kollega (ikke sig selv) med påkrævet begrundelse. Tekst: godt arbejde, hjælp eller god stemning – resultater (salg, fakturering) tæller ikke. Viser præmie og sidste måneds vinder.

Lukket shop (uden for 08:00–15:30 på hverdage, eller når admin har "Ikke til stede" i kalenderen): overlay "Shoppen har lukket", Bestil bliver til **Forudbestil** (`forud = ja` på bestillingen). Admin ser et banner i stedet.

### Medarbejder – Min profil (`#/profil`)
- Blåt topkort: billede, gruppe (ingen initialer), navn, saldo i højre hjørne (uden ordet "Saldo").
- Tre visuelle nøgletal: **Optjent i <måned>** (sparkline 6 mdr. + i alt), **Brugt i alt** (delt bjælke selv/donationer/projekter + forklaring), **Donationer** (antal givet som hovedtal, gave-ikoner, modtaget som undertekst).
- Faner: **Aktivitet** (alle posteringer grupperet pr. måned med farvet ikon), **Optjening** (pr. måned fordelt på kilder), **Bestillinger** (med status). Disclaimer: "Tallene kan ændre sig, hvis der bliver rettet fejl."

### Admin (sidepanel)
Bestillinger (udleveret / annullér med refusion / fortryd) · **Opgørelse** (kr pr. måned ud fra kostpris = beløbet der skal trækkes) · Brugere (opret/ret/gruppe/justér saldo) · Sortiment (menu inkl. varianter + kommer snart, projekter, lykkehjulets præmier/vægt/chance/pris) · **Månedens kollega** (præmie, stilling med anonyme begrundelser, tidligere vindere) · Regler (alle grupper) · Posteringer (alle + "Hent optjening nu").

### Design
Lyst tema som standard, mørkt som valg. **Kun blå eller hvid/grå/mørk** – guld findes kun i Webcoin-mønten. Logo = officielt "best One"-SVG i blå (hvid i mørkt tema); en fortegnsfejl i O'ets indre kurve er rettet (det var derfor, logoet så forkert ud). b-mærket ligger halvskjult i saldo- og profilkortet. "Webshoppen" i 18px fed i samme blå som logoet (`--brand` #225581, hvid i mørkt tema). Let animeret baggrund (to blå/grå farveskyer, kun CSS-transform, stopper ved "Reducer bevægelse"). Lykkehjulet bruger blå og hvide/grå felter. Favicon = W-mønten.

## Ikke gjort endnu
- Backend er ikke sat op i Google (tjekliste nedenfor).
- **Pladsholdere** der skal regnes igennem: optjeningsregler, varepriser og kostpriser, lykkehjulets præmier/vægte/pris.
- Kilder (faktureringsark, anmeldelser) og teambudget-arket er ikke koblet på.
- Subdomæne ikke valgt (`xxx.leksione.dk`); `SIDE_URL` står som `webshoppen.leksione.dk`. Ingen `CNAME`-fil endnu.
- Projekter tæller ikke med i Opgørelse (kun bestillinger/gevinster).
- Ingen varebilleder endnu – Rasmus har billeder til varer og baggrunde, der skal lægges i `assets/`.
- Rigtigt Google-login er ikke testet (kræver backend + Client ID).

## Beslutninger
- **Apps Script + Google Sheet som backend** (ikke Cloudflare): datakilderne er Google Sheets, mail/Chat er indbygget, DNS styres via GitHub Pages + Curanet, og der er ingen Node på den private Mac.
- **Saldo = sum af posteringer.** Admin kan rette direkte i arket.
- **Optjening pr. måned** med fast `ref` → synk kan køres igen uden dobbelt-optjening. `OPTJENING_FRA` i Config styrer startmåned.
- **Gave = vare** (ikke rå Webcoins). Giveren betaler, admin leverer.
- **Kostpris gemmes på bestillingen**, så gamle måneder ikke ændres, når en pris rettes.
- **Lykkehjul og stemmer afgøres altid i backend** (`spin`, `stem` i core.js). Hjulets vægte sendes kun til admin.
- **Stemmer er hemmelige.** Brugere ser kun egen stemme + sidste måneds vinder. Admin ser stilling og begrundelser uden afsenders navn (arket har det). Vinder = flest stemmer; ved lighed den, der fik sin første stemme først.
- **Fravær læses fra kalenderen** for den konto, der har deployet Apps Script (admin): Googles "Ikke til stede"-type eller titel med "Ikke til stede"/"Out of office". Cache 5 min.
- Brugere uden for `Brugere`-fanen ser "Du er desværre ikke registreret". Admin = `ADMIN_EMAILS`. Login-domæne = **best-one.dk**.
- **Repoet er offentligt** (gratis GitHub Pages) – kun frontend, ingen hemmeligheder.

## Faner i "Webshoppen DB"
`Config` · `Brugere` · `Menu` (id, navn, ikon, billede, pris, kostpris, varianter, snart, aktiv) · `Hjul` (id, navn, ikon, type vare/webcoins/intet, beloeb, kostpris, vaegt, aktiv) · `Projekter` · `Posteringer` · `Bestillinger` (… status, forud) · `Stemmer` (id, tid, maaned, fra, til, begrundelse) · `Kilder` · `Regler`.

Config-nøgler: `CLIENT_ID`, `ADMIN_EMAILS`, `TILLADT_DOMAENE`, `SIDE_URL`, `CHAT_WEBHOOK`, `NOTIFIKATION_MAIL`, `AABNER`, `LUKKER`, `AABNE_DAGE`, `LUK_VED_FRAVAER`, `KALENDER_ID`, `OPTJENING_FRA`, `TEAMBUDGET_ARK_ID`, `TEAMBUDGET_BUDGET_CELLE`, `TEAMBUDGET_BRUGT_CELLE`, `TEAMBUDGET_SAESON`, `HJUL_PRIS`, `MDK_PRAEMIE`.

## Sådan sættes backend op
1. Opret et nyt Google Sheet "Webshoppen DB" på din best-one.dk-konto.
2. Udvidelser → Apps Script. Opret `Code.gs` (← `apps-script/Code.gs`) og `Core.gs` (← `shared/core.js`). Projektindstillinger → vis `appsscript.json` → indsæt `apps-script/appsscript.json`.
3. Genindlæs arket → **Webshoppen → Opsæt faner**. Godkend adgang (Sheets, mail, kalender, ekstern URL).
4. Google Cloud Console → APIs & Services → Credentials → **OAuth client ID** (Web application). Authorized JavaScript origins: `https://<subdomæne>.leksione.dk`, `https://munksgaard91.github.io` og `http://localhost:8765`. Client ID → Config `CLIENT_ID` og `assets/config.js` `GOOGLE_CLIENT_ID`.
5. Apps Script → Implementér → Ny implementering → Webapp (kør som: mig, adgang: alle). URL → `assets/config.js` `API_URL`.
6. Udfyld `Brugere` (eller via admin-siden), `Kilder` (ark-ID, fane, kolonnebogstaver; tom `kol_vaerdi` = tæl rækker) og evt. `CHAT_WEBHOOK`, `NOTIFIKATION_MAIL`, `TEAMBUDGET_*`.
7. **Webshoppen → Slå automatisk hentning til**.

Ændringer i `shared/core.js` eller `Code.gs`: kopiér ind i Apps Script → **Administrer implementeringer → Rediger → Ny version** (URL bevares).
Ændringer i assets: bump `?v=` i `index.html` (nu `v=39`).
Er arket allerede sat op, laver "Opsæt faner" kun nye faner – nye kolonner skal tilføjes sidst i hånden (tekstformat for `id`, `tid`, `maaned`, initialer).

## Test
```bash
cd ~/code/webshoppen && /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc shared/core.js tests/core.test.js
```
Dækker: login-afvisning, varianter, kommer snart, gave + refusion, admin-rettigheder, forudbestilling, saldo-tjek, lykkehjul (alle tre typer), skjulte vægte, stemmeregler, hemmelige stemmer, tie-breaker, idempotent optjening, åbningstider.
Demo-tricks: `?lukket=fravaer` / `?lukket=tid` viser lukket shop. "Nulstil demodata" på login-siden.

## Før go-live (kendte svagheder)
1. **Login udløber hver time** – Google ID-token (~1 t). Ved udløb sendes brugeren til login. Overvej stille fornyelse.
2. ~~Månedsfejl omkring midnat i Opgørelse~~ – rettet 2026-11-09 (lokal tid).
3. **Ingen refusion af projektdonationer**, hvis et projekt lukkes. Brug Justér under Brugere.
4. **Forældede optjeningsposteringer** – ved gruppeskift eller fjernet regel bliver gamle `optjent`-posteringer liggende (applyEarnings opdaterer kun refs, den stadig beregner).
5. Månedens kollega-præmie og webcoins-justeringer gives **manuelt**.

## Næste skridt
1. Rasmus' feedback på Min profil v3 og den nye menu.
2. Varebilleder og baggrundsbilleder i `assets/` (Menu-kolonnen `billede` er klar).
3. Vælg subdomæne → `CNAME`-fil + CNAME hos Curanet → `munksgaard91.github.io`.
4. Sæt backend op (tjekliste ovenfor) og kobl faktureringsark, anmeldelser og teambudget på.
5. Regn økonomien igennem: optjening pr. gruppe vs. varepriser vs. lykkehjulets forventede værdi.
6. Test med 2–3 kolleger, før alle får adgang.
