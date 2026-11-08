# NOTES – status og næste skridt

Opdateres ved hver arbejdsblok, så arbejdet kan fortsættes fra en anden maskine.

## Status (2026-11-08)

**Færdigt (kører i demo-tilstand lokalt):**
- Forside: saldo, optjent i måneden + sparkline, brugt, givet væk, menu (bestil/giv), projekter (indskyd), mine bestillinger, teambudget, seneste bevægelser.
- Min profil: nøgletal + fuld historik med filtre.
- Regler-side pr. gruppe.
- Admin: bestillinger (udleveret/annullér med refusion), brugere (opret/ret/gruppe/justér saldo), sortiment (menu + projekter), alle posteringer + "Hent optjening nu".
- Backend-kode i `apps-script/Code.gs` (ikke deployet endnu).
- Mørkt og lyst tema, mobil-layout.

**Ikke gjort endnu:**
- Backend er ikke sat op i Google (se tjekliste nedenfor).
- Optjeningsregler er **pladsholdere** – skal regnes igennem.
- Kilder (faktureringsark, anmeldelser) er ikke koblet på – kræver ark-ID'er og kolonner.
- Teambudget-arket er ikke koblet på.
- Subdomæne er ikke valgt (`xxx.leksione.dk`). `SIDE_URL` står som `webshoppen.leksione.dk` indtil videre. Ingen `CNAME`-fil endnu.
- GitHub Pages: repo er privat. Pages på et privat repo kræver GitHub Pro – ellers skal repoet være offentligt (koden indeholder ingen hemmeligheder).

## Beslutninger

- **Apps Script + Google Sheet som backend** i stedet for Cloudflare: alle datakilder er Google Sheets, mail/Chat er indbygget, DNS styres via GitHub Pages + Curanet, og der er ingen Node på den private Mac.
- **Saldo = sum af posteringer** (ingen saldo-kolonne der kan komme ud af sync). Admin kan rette direkte i arket, hvis noget skal laves om.
- **Optjening pr. måned** med fast `ref` → synk kan køres igen og igen uden dobbelt-optjening. `OPTJENING_FRA` i Config bestemmer fra hvilken måned der tælles.
- **Gave = vare** (ikke rå Webcoins). Giveren betaler, admin får besked og leverer til modtageren.
- Brugere uden for `Brugere`-fanen ser "Du er desværre ikke registreret". Admin styres af `ADMIN_EMAILS` i Config.
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
8. Valgfrit: `CHAT_WEBHOOK` (Google Chat → space → Apps & integrations → Webhooks), `NOTIFIKATION_MAIL`, `TEAMBUDGET_*`.
9. **Webshoppen → Slå automatisk hentning til**.

Ved ændringer i `shared/core.js` eller `Code.gs`: kopiér ind i Apps Script og lav **Administrer implementeringer → Rediger → Ny version** (så URL'en bevares).
Ved ændringer i assets: bump `?v=` i `index.html`.

## Næste skridt

1. Vælg subdomæne → tilføj `CNAME`-fil, opret CNAME hos Curanet → `munksgaard91.github.io`, slå Pages til.
2. Sæt backend op (tjekliste ovenfor).
3. Kobl faktureringsark, anmeldelser og teambudget på.
4. Regn optjeningsreglerne igennem (økonomi: hvad koster en sodavand i WC vs. hvad tjener man om måneden).
5. Test med 2-3 kolleger før alle får adgang.
