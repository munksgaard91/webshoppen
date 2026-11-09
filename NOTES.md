# NOTES – status og næste skridt

Opdateres ved hver arbejdsblok, så arbejdet kan fortsættes fra en anden maskine.
Sidst opdateret: **2026-11-09** (privat Mac). Seneste kodegennemgang: 2026-11-09 (aften) – alle filer parser, `tests/core.test.js` 21/21 OK, alle sider klikket igennem som ren admin og som medarbejder uden konsolfejl, ingen rigtige navne/numre i sporede filer.

## Status

Alt kører i **demo-tilstand** (tom `API_URL`) på https://munksgaard91.github.io/webshoppen/. Backend er skrevet, men **ikke sat op i Google endnu**.

### Medarbejder – Overblik (`#/`)
Rækkefølge (se også CLAUDE.md):
1. **Saldo-kort** (blåt, halvskjult "b" i højre side) med hilsen, saldo og "Hvordan optjener jeg?" + i-ikon i hjørnet: hover viser en lille boble, klik åbner en boks med gruppens optjeningsregler. Ved siden af **Teambudget** (stort blåt tal – ingen b-mærke, kant, ring eller "tilbage"): rest i alt som stort tal, "Brugt i sæsonen: kr x" i mild rød, sæson som tag (`TEAMBUDGET_SAESON`).
2. **Bestil** – sorteret **billigst først** ("Andet?" altid sidst), kompakt liste med skiftevis hvid/lysegrå rækker, **ingen små undertekster** under navnene (heller ikke ved "Andet?"). Bestillingsvinduet skifter mellem "Til mig" og "Donér til en kollega" uden at blinke (kun indholdet skiftes, `modalIndhold()`). I bestillingsvinduet styres det **pr. vare**: varer med `varianter` viser valgknapper (Candybar: Marsbar/Snickers – opdateres senere); varer med `oenske = ja` viser et **"Dit ønske"**-felt (Sodavand); andre bestilles direkte uden noget (Hvid Monster). Ønsket gemmes i Bestillinger-kolonnen `oenske`, står i admins besked og under varen på Admin → Bestillinger. Priser er højrestillede tal (1–3 cifre flugter) + "Webcoins" + mønt til sidst. Knapper: **Donér til en kollega** (gave – hed før "Giv") og Bestil. Note: "Personlig levering, forvent lidt ventetid." Knapkolonnen er 280px i både Bestil og Projekter, så de flugter. Varer med `varianter` åbner et valg (Sodavand, Candybar); én variant vælges automatisk (Monster → Hvid Monster). `snart = ja` → rækken bliver en **"Andet?"-række** med én hvid knap "Send forslag" (kan ikke bestilles). Note om ventetid (personlig levering).
3. **Feelin' Lucky?** – **15 Webcoins pr. drej** ("Drej hjulet 15 Webcoins 🪙" + lille i-ikon, der ved hover/fokus viser chancerne pr. præmie, samlet og sorteret). Præmier (2026-11-09, justeret): Nitte 10 %, 5 Webcoins 8 %, 10 Webcoins 18 %, 15 Webcoins 20 %, Sodavand 12 %, Candybar 8 %, Hvid Monster 7 %, 20 Webcoins 14 %, 50 Webcoins 3 % (vægte i promille, sum 1000). I snit får man ca. 12,2 Webcoins tilbage pr. drej til 15 (~81 %, varer regnet til deres pris i shoppen); 44 % af drejene giver mindst prisen tilbage, 24 % giver overskud; varegevinster koster teambudgettet ca. 2,50 kr pr. drej. Gevinsten vises **først i præmie-popuppen** (ingen notifikation/toast mens rullen kører); popuppen siger ved varegevinster "📣 Admin har fået besked, hold øje med din chat." (ved Webcoins: "Admin har fået besked om din gevinst."). **Visning: tombola-rulle i Counter-Strike-kasse-stil** (hjulet er droppet – det så rodet ud): **hvid** rulle (passer til siden) med blå markørstreg og præmiekort – Webcoins blå, varer hvide med blå kant, Nitte grå – (ikon + tekst: Webcoins-gevinster har **W-mønten**, varer og Nitte har deres emoji; ingen bjælke i bunden; 50 Webcoins er et guld-kort). Kortene har næsten skarpe hjørner (2px) og kun en svag 1px-kant på varer (ingen kant på Webcoins og Nitte). Kortene i rullen er **kun visuelle og balancerede** (kategori først: varer 45 %, Webcoins 40 %, Nitte 15 %; hovedpræmien vises sjældnere) – to Webcoins-kort står aldrig i træk, og samme præmie ikke inden for 2 kort (heller ikke omkring vinderen). Selve gevinsten trækkes stadig med de rigtige chancer i backend. Ved drej fyldes rullen med 68 kort trukket efter chancen (`andel` i state), vinderen fra backend lægges på plads 62, rullen kører ca. 8,5 sek. med en lang, langsom afslutning, glider lidt forbi og retter sig ind; vinderkortet lyser op, resten dæmpes. I **tomgang** ruller tombolaen flydende i ring for at friste (JS-styret `idleLoop`, 75 px/sek., pauser ved hover). Positionen huskes i `ui.idleOffset`, så den ikke springer tilbage ved opdateringer, og et drej starter fra den aktuelle position uden hop; efter et drej står den stille på vinderen, indtil man køber et nyt drej. Ved "Reducer bevægelse" springes animationerne over. "Køb et drej" og "Drej hjulet" er lige store (170×48); åben Drej-knap har 🎰 i stedet for hængelås. Lykkehjul i **to trin**: "Køb et drej" (åbner en **bekræftelse** med pris og saldo efter → "Køb for 15 Webcoins"; betaler `HJUL_PRIS`, prisen står som i Bestil: tal + Webcoins + mønt) → "Drej hjulet" låses op (hængelås-ikon) → drej → låst igen. Man kan højst have ét købt drej ad gangen. Købte drej ligger i ny fane `Spil` (id, tid, initialer, status koebt/drejet, resultat). Gevinsten afgøres i backend; browseren animerer kun hjulet hen til resultatet. **Hvert drej registreres** (fanen `Spil`: status `drejet` + resultat), og **admin får altid besked** (mail/Chat) med "via lykkehjulet (Feelin' Lucky?)" – også ved Webcoins og ingen gevinst. Vare-gevinster kommer på Admin → Bestillinger som "Hjulgevinst: <vare>" med beskeden "Spørg om de vil have den med det samme".
4. **Events** (hed før Projekter; i kode/ark stadig `Projekter`) – sorteret efter mål, **billigst først**, liste med skiftevis baggrund. Stor progressbar med "**245** af 1.500 Webcoins 🪙" og fed procent. Top 3 under hinanden med beløb tæt på navnet. Under baren står kun **"Top contributors"** (viser nr. 1); **"Se resten"** viser ved hover/fokus en boks med **top 10** (backend sender op til 10 i `top`). Listerne står i faste kolonner (medalje/nummer | navn | beløb højrestillet), så det flugter uanset navnelængde og antal cifre. Når et projekt er **100 %**, bliver progressbaren **grøn** (samme grøn som Yehaw!, hvid skrift), Donér forsvinder, og der står en grøn **"Yehaw! 🎉"**-knap med den lille tekst **"Event loading.."** under (samme stil som "Dit bidrag"), der sender konfetti over skærmen (blå/hvid/grå, ren CSS, kun en kort toast ved "Reducer bevægelse"). Backend afviser donationer til fulde projekter og beløb over det, der mangler. Donér-vinduet har tekstfelt + hurtigvalg **5 · 10 · 15 · 20 · 25 · 50** (valgt beløb markeres; beløb over saldo eller over det der mangler er slået fra). Ellers en stor blå **Donér**-knap (min. 150px bred, 16px tekst; handlingen hedder `indskyd` i koden), "Dit bidrag" småt under knappen.
   Under projekterne er der også en "Andet?"-række med "Send forslag". Forslagsvinduet har kun overskriften ("Hvad mangler der i menuen?" / "Hvad skal vi samle ind til?") og et tomt tekstfelt – ingen eksempler og ingen "sendes til Rasmus". Forslag sendes via backend (`forslag` i core.js → `env.notify` → `NOTIFIKATION_MAIL` + evt. Google Chat) – ikke via mailto, så det virker uanset mailprogram.
5. **Månedens kollega** (v3, præmie via Config `MDK_PRAEMIE` + `MDK_PRAEMIE_MAANED`, gives manuelt. **Månedsskifte:** sidste måneds vinder vises automatisk ud fra stemmerne; præmien gælder kun den måned, admin satte den i – ny måned = **"Coming soon"**, indtil admin gemmer en ny præmie under Admin → Månedens kollega) – **venstre** (blåt felt): kun **"Vinder i <forrige måned>"** med 🏆, initialer og navn; ingen vinder endnu = tom stiplet plads med "?", "Det kunne være dig!" og "Den første vinder kåres 1. <næste måned>". **Højre**: "Hvem gør en forskel i <måned>?" + to piller **Præmie** og **Slutter om X dage**, derefter teksten "Stem på en kollega, der har hjulpet dig, gjort noget ekstra eller løftet stemningen. Det handler om mennesker, ikke salgstal.", en pæn **dropdown** ("Vælg en kollega", navn · gruppe), tekstfelt "Hvorfor?" (frivilligt – alt godtages, ingen eksempler) og Stem. Efter stemmen: "Tak for din stemme" + valg og begrundelse. Én stemme pr. måned, ikke på sig selv. Demoen har ingen tidligere vinder.

Lukket shop (uden for 08:00–15:30 på hverdage, eller når admin har "Ikke til stede" i kalenderen): overlay "Shoppen har lukket", Bestil bliver til **Forudbestil** (`forud = ja` på bestillingen). Admin ser et banner i stedet.

### Medarbejder – Min profil (`#/profil`)
- Blåt topkort: billede, gruppe (ingen initialer), navn, saldo i højre hjørne (uden ordet "Saldo").
- Tre visuelle nøgletal: **Optjent i <måned>** (sparkline 6 mdr. + i alt), **Brugt i alt** (delt bjælke selv/donationer/projekter/**spins** + forklaring), **Donationer** (antal givet som hovedtal, gave-ikoner, modtaget som undertekst – ingen "Ingen endnu").
- Faner: **Aktivitet** (alle posteringer grupperet pr. måned med farvet ikon), **Optjening** (pr. måned fordelt på kilder), **Bestillinger** (med status). Disclaimer: "Tallene kan ændre sig, hvis der bliver rettet fejl." Nederst: **"Har du feedback til Webshoppen?" + knappen "💬 Giv feedback"** – sendes via backend (`forslag` med type `feedback`) til admins `NOTIFIKATION_MAIL`/Chat.

### Admin (sidepanel)
Sidepanelet kan **foldes sammen** til en smal ikon-bjælke (72px) med «-knappen ved logoet; badge for nye bestillinger og tooltips bevares, valget huskes i browseren (`ws-side-foldet`). Kun på desktop – på mobil er det stadig burger-menuen.
**Rasmus er ren admin:** står i `ADMIN_EMAILS`, men **ikke** i `Brugere`. Han har ingen initialer/gruppe, kan ikke bestille, dreje hjulet, donere eller stemme, bliver ikke vist som kollega og har ingen Min profil. Han lander på **Admin-overblikket** (`#/`), i denne rækkefølge: **Nye bestillinger** øverst i fuld bredde (antal-badge, Udleveret/Annullér, op til 10), så to nøgletal (**Brugt i <måned>** i kr og **Teambudget tilbage**), så Events (progressbar) + Månedens kollega (præmie eller "Coming soon – vælg præmie", stemmer, top 3, sidste vinder), Seneste aktivitet (6 posteringer) og Opgørelse pr. måned. Medarbejdernes forside vises ikke for admin.
Bestillinger (udleveret / annullér med refusion / fortryd) · (Opgørelsen – kr pr. måned ud fra kostpris – ligger nu i Overblik) · Brugere (opret/ret/gruppe/justér saldo) · Sortiment (menu inkl. varianter + kommer snart, projekter, lykkehjulets præmier/vægt/chance/pris) · **Månedens kollega** (præmie, stilling med anonyme begrundelser, tidligere vindere) · Regler (alle grupper) · Posteringer (alle + "Hent optjening nu").

### Design
Lyst tema som standard, mørkt som valg. **Kun blå eller hvid/grå/mørk** – guld findes kun i Webcoin-mønten. Logo = officielt "best One"-SVG i blå (hvid i mørkt tema); en fortegnsfejl i O'ets indre kurve er rettet (det var derfor, logoet så forkert ud). b-mærket ligger halvskjult i saldo- og profilkortet. "Webshoppen" i 18px fed i samme blå som logoet (`--brand` #225581, hvid i mørkt tema). Let animeret baggrund (to blå/grå farveskyer, kun CSS-transform, stopper ved "Reducer bevægelse"). Lykkehjulets rulle er hvid med blå/hvide/grå kort – undtagen hovedpræmien i guld. Favicon = W-mønten.

## Brugere
Den rigtige brugerliste ligger i **`brugere.local.csv`** i repo-mappen på den private Mac. Filen er **gitignored** (`*.local.*`), fordi repoet er offentligt – den skal kopieres ind i fanen `Brugere`, når arket sættes op. Fordelingen pr. gruppe står i filen og i fanen `Brugere`. Demoen har **13 testbrugere** som det rigtige hold (7 Hjemmeside, 3 Redaktør, 2 Support, 1 Fotograf): de fire "Demo …"-brugere på login-listen + 9 pladsholdere med opdigtede navne ("Anders Demo" …, initialer ADE–IDE, `ekstra: true` i mock.js), som kun ses i lister som Månedens kollega og Donér til en kollega. Alle demobrugere starter med 67 Webcoins (en "Demo-saldo"-justering i mock.js).

## Ikke gjort endnu
- Backend er ikke sat op i Google (tjekliste nedenfor).
- **Pladsholdere** der skal regnes igennem: optjeningsregler, varepriser og kostpriser, lykkehjulets præmier/vægte/pris.
- Kilder (faktureringsark, anmeldelser) og teambudget-arket er ikke koblet på.
- Subdomæne ikke valgt (`xxx.leksione.dk`); `SIDE_URL` står som `webshoppen.leksione.dk`. Ingen `CNAME`-fil endnu.
- Projekter tæller ikke med i Opgørelse (kun bestillinger/gevinster).
- **Varer vises med emoji** (🥤 Sodavand, ⚡ Hvid Monster, 🍫 Candybar). Produktbillederne er fjernet igen efter ønske (de var ophavsretligt beskyttede fotos i et offentligt repo). Kolonnen `billede` og `tools/udskaer.py` virker stadig, hvis der skal bruges egne billeder senere.
- Rigtigt Google-login er ikke testet (kræver backend + Client ID).

## Beslutninger
- **Apps Script + Google Sheet som backend** (ikke Cloudflare): datakilderne er Google Sheets, mail/Chat er indbygget, DNS styres via GitHub Pages + Curanet, og der er ingen Node på den private Mac.
- **Saldoen kan aldrig gå i minus:** bestil/donér til kollega, køb af drej og donation til projekt afvises i backend, hvis man ikke har råd (og knapperne er slået fra i UI). Admins "Justér saldo" afvises også, hvis den ville sende nogen under 0. (Undtagelse: hvis en optjening rettes ned efter synk, kan saldoen i princippet blive negativ – det er en datarettelse, ikke et køb.)
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
`Config` · `Brugere` · `Menu` (id, navn, ikon, billede, pris, kostpris, varianter, oenske, snart, aktiv) · `Hjul` (id, navn, ikon, type vare/webcoins/intet, beloeb, kostpris, vaegt, aktiv) · `Projekter` · `Posteringer` · `Bestillinger` (… status, forud, oenske) · `Stemmer` (id, tid, maaned, fra, til, begrundelse) · `Spil` (id, tid, initialer, status, resultat) · `Kilder` · `Regler`.

Config-nøgler: `CLIENT_ID`, `ADMIN_EMAILS`, `TILLADT_DOMAENE`, `SIDE_URL`, `CHAT_WEBHOOK`, `NOTIFIKATION_MAIL`, `AABNER`, `LUKKER`, `AABNE_DAGE`, `LUK_VED_FRAVAER`, `KALENDER_ID`, `OPTJENING_FRA`, `TEAMBUDGET_ARK_ID`, `TEAMBUDGET_BUDGET_CELLE`, `TEAMBUDGET_BRUGT_CELLE`, `TEAMBUDGET_SAESON`, `HJUL_PRIS`, `MDK_PRAEMIE`, `MDK_PRAEMIE_MAANED` (YYYY-MM, sættes af admin ved Gem).

## Sådan sættes backend op
1. Opret et nyt Google Sheet "Webshoppen DB" på din best-one.dk-konto.
2. Udvidelser → Apps Script. Opret `Code.gs` (← `apps-script/Code.gs`) og `Core.gs` (← `shared/core.js`). Projektindstillinger → vis `appsscript.json` → indsæt `apps-script/appsscript.json`.
3. Genindlæs arket → **Webshoppen → Opsæt faner**. Godkend adgang (Sheets, mail, kalender, ekstern URL).
4. Google Cloud Console → APIs & Services → Credentials → **OAuth client ID** (Web application). Authorized JavaScript origins: `https://<subdomæne>.leksione.dk`, `https://munksgaard91.github.io` og `http://localhost:8765`. Client ID → Config `CLIENT_ID` og `assets/config.js` `GOOGLE_CLIENT_ID`.
5. Apps Script → Implementér → Ny implementering → Webapp (kør som: mig, adgang: alle). URL → `assets/config.js` `API_URL`.
6. Udfyld `Brugere` (eller via admin-siden), `Kilder` (ark-ID, fane, kolonnebogstaver; tom `kol_vaerdi` = tæl rækker) og evt. `CHAT_WEBHOOK`, `NOTIFIKATION_MAIL`, `TEAMBUDGET_*`.
7. **Webshoppen → Slå automatisk hentning til**.

Ændringer i `shared/core.js` eller `Code.gs`: kopiér ind i Apps Script → **Administrer implementeringer → Rediger → Ny version** (URL bevares).
Ændringer i assets: bump `?v=` i `index.html` (nu `v=110`).
Er arket allerede sat op, laver "Opsæt faner" kun nye faner – nye kolonner skal tilføjes sidst i hånden (tekstformat for `id`, `tid`, `maaned`, initialer).

## Test
```bash
cd ~/code/webshoppen && /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc shared/core.js tests/core.test.js
```
Dækker: ren admin uden deltagelse, forslag, login-afvisning, varianter, kommer snart, gave + refusion, admin-rettigheder, forudbestilling, saldo-tjek, lykkehjul (alle tre typer), skjulte vægte, stemmeregler, hemmelige stemmer, tie-breaker, idempotent optjening, åbningstider.
Demo-tricks: `?lukket=fravaer` / `?lukket=tid` viser lukket shop. "Nulstil demodata" på login-siden.

## Før go-live (kendte svagheder)
1. **Login udløber hver time** – Google ID-token (~1 t). Ved udløb sendes brugeren til login. Overvej stille fornyelse.
2. ~~Månedsfejl omkring midnat i Opgørelse~~ – rettet 2026-11-09 (lokal tid).
3. **Ingen refusion af projektdonationer**, hvis et projekt lukkes. Brug Justér under Brugere.
4. **Forældede optjeningsposteringer** – ved gruppeskift eller fjernet regel bliver gamle `optjent`-posteringer liggende (applyEarnings opdaterer kun refs, den stadig beregner).
5. Månedens kollega-præmie og webcoins-justeringer gives **manuelt**.

## Næste skridt
1. Rasmus' feedback på Min profil v3 og den nye menu.
2. Evt. baggrundsbilleder.
3. Vælg subdomæne → `CNAME`-fil + CNAME hos Curanet → `munksgaard91.github.io`.
4. Sæt backend op (tjekliste ovenfor) og kobl faktureringsark, anmeldelser og teambudget på.
5. Regn økonomien igennem: optjening pr. gruppe vs. varepriser vs. lykkehjulets forventede værdi.
6. Test med 2–3 kolleger, før alle får adgang.
