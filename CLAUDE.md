# Webshoppen

Intern "shop" for webafdelingen hos Best One A/S. Medarbejdere optjener **Webcoins (WC)** automatisk ud fra faktureringsark, anmeldelser m.m., og bruger dem på ting fra menuen (sodavand, Monster …), gaver til kolleger eller fælles projekter (teamfrokost, biograf …). Admin (Rasmus, `rmu`) får besked ved hver bestilling og kan rette i alt.

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
   └─ sender notifikation (Google Chat webhook og/eller mail)
```

- **Login:** Google Identity Services i browseren giver et ID-token. Backend verificerer det mod `oauth2.googleapis.com/tokeninfo` (aud = CLIENT_ID, domæne = bestone.dk) og slår mailen op i fanen `Brugere`. Ukendt mail → "Du er desværre ikke registreret".
- **Grupper:** Hjemmeside, Redaktør, Fotograf, Support. Alle ser samme dashboard; tallene afhænger af bruger og gruppe (optjeningsregler pr. gruppe i fanen `Regler`).
- **Webcoins er en posteringslog** (fanen `Posteringer`). Saldo = sum af posteringer. Typer: `optjent`, `koeb`, `gave`, `gave_modtaget` (0 kr, kun historik), `projekt`, `refusion`, `justering`.
- **Optjening er idempotent:** én postering pr. `optjent:<kilde>:<YYYY-MM>:<initialer>` (feltet `ref`), som opdateres ved hver synk.
- Personer identificeres **altid med initialer** (JST, DSI …) i kildeark.

## Filer

| Sti | Indhold |
|---|---|
| `index.html` | Skal for hele appen |
| `assets/config.js` | `API_URL` (Apps Script web app-URL) og `GOOGLE_CLIENT_ID`. Tom `API_URL` = demo-tilstand |
| `assets/app.js` | Al UI-logik (vanilla JS, hash-routing `#/`, `#/profil`, `#/regler`, `#/admin/...`) |
| `assets/app.css` | Design (mørkt dashboard-look som det eksisterende Best One-dashboard, lyst tema som valg) |
| `assets/mock.js` | Demo-backend i browseren (localStorage), bruger `shared/core.js` |
| `shared/core.js` | **Al forretningslogik**, delt mellem demo og Apps Script. Ingen Google-API'er her |
| `apps-script/Code.gs` | Sheet-adapter, auth, doPost, synk, notifikationer, opsætning af arket |
| `CNAME` | Custom domæne til GitHub Pages (oprettes når subdomænet er valgt) |

## Konventioner

- Ingen build-step, ingen npm. Ren HTML/CSS/JS, så det kan køre direkte fra GitHub Pages.
- Forretningslogik ændres i `shared/core.js` og kopieres derefter ind i Apps Script-projektet som `Core.gs`.
- UI-tekster på dansk, korte. Ingen lange forklaringer i UI'et — funktionalitet og god UI.
- Branding: Montserrat, mørk navy + grøn accent (`--accent`), Best One-blå `#225581`. Logo "best one." med grøn prik.
- Escape altid brugerdata med `esc()` i app.js før det sættes ind i HTML.
- Danske Google Sheets bruger `;` i formler.
- Hemmeligheder (webhook-URL'er m.m.) ligger i fanen `Config` i arket — aldrig i repoet.

## Kør lokalt

```bash
cd ~/code/webshoppen && python3 -m http.server 8765
```
Åbn http://localhost:8765 — uden `API_URL` kører den i demo-tilstand med testbrugere.
