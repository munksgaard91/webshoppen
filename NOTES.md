# NOTES – status og næste skridt

Opdateres ved hver arbejdsblok, så arbejdet kan fortsættes fra en anden maskine.

## Status (2026-11-08)

**Færdigt (kører i demo-tilstand):**
- Nyt design adskilt fra salgsdashboardet: lyst, Best One-blå + guld Webcoin-mønt, mørkt tema som valg. Favicon = mønten.
- Medarbejdere: topmenu (Overblik / Min profil), intet sidepanel. Admin beholder sidepanel.
- Forside i prioriteret rækkefølge: saldo + teambudget + regler (i-ikon med hover/klik) → Bestil → Projekter → Statistik → Bevægelser + Mine bestillinger.
- "Webcoins" skrives altid helt ud.
- Åbningstid 08:00–15:30 på hverdage + lukket når admin har "Ikke til stede" i kalenderen → overlay "Shoppen har lukket" og bestil-knapper slået fra (håndhæves også i backend). Admin ser et banner i stedet.
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

1. Opret et nyt Google Sheet "Webshoppen DB" (på din bestone.dk-konto).
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
9. Valgfrit: `CHAT_WEBHOOK` (Google Chat → space → Apps & integrations → Webhooks), `NOTIFIKATION_MAIL`, `TEAMBUDGET_*`.
10. **Webshoppen → Slå automatisk hentning til**.

Ved ændringer i `shared/core.js` eller `Code.gs`: kopiér ind i Apps Script og lav **Administrer implementeringer → Rediger → Ny version** (så URL'en bevares).
Ved ændringer i assets: bump `?v=` i `index.html`.
Demo af lukket shop: tilføj `?lukket=fravaer` eller `?lukket=tid` til adressen.

## Næste skridt

1. Vælg subdomæne → tilføj `CNAME`-fil, opret CNAME hos Curanet → `munksgaard91.github.io`, slå Pages til.
2. Sæt backend op (tjekliste ovenfor).
3. Kobl faktureringsark, anmeldelser og teambudget på.
4. Regn optjeningsreglerne igennem (økonomi: hvad koster en sodavand i WC vs. hvad tjener man om måneden).
5. Test med 2-3 kolleger før alle får adgang.
