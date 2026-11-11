/*
 * Sortiment – menu, lykkehjul og events. Rettes her i koden (ikke i admin eller arket).
 * Bruges af både demoen og Apps Script (kopiér ind som "Sortiment.gs" ved siden af Core.gs).
 *
 * Økonomi: 1 kr = 2 Webcoins. pris/beloeb/maal er i Webcoins, kostpris i kr = det der sendes til RAB.
 * Kun varer firmaet har købt (Sodavand, Monster) har kostpris. Varer købt for teamkassen har kostpris 0
 * (betalt på forhånd – sendes ikke til RAB; indkøbsprisen står i kommentaren).
 *
 * Menu:   id (fast – bruges i bestillinger), navn, ikon (emoji), pris, kostpris,
 *         varianter ("A, B" → valgknapper), oenske: true → "Dit ønske"-felt,
 *         snart: true → "Andet?"-række med "Send forslag", aktiv: false → skjult.
 * Hjul:   type 'webcoins' | 'vare' | 'intet', beloeb (ved webcoins), kostpris (kr, ved vare),
 *         vaegt = chance i promille (summen behøver ikke være 1000). Største Webcoins-gevinst = guld-kort.
 * Events: id (fast – donationer peger på det, skift det aldrig), navn, ikon, maal, aaben: false → skjult.
 */
var SORTIMENT = {
  hjulPris: 30,
  // Alle brugere starter med dette antal Webcoins (gives én gang, når de er oprettet i Brugere)
  startWebcoins: 5,

  menu: [
    { id: 'sodavand', navn: 'Sodavand', ikon: '🥤', pris: 20, kostpris: 10, oenske: true },
    { id: 'monster', navn: 'Hvid Monster', ikon: '⚡', pris: 30, kostpris: 15 },
    // Teamkassen (kostpris 0 – ikke til RAB). Indkøb (Nemlig 2026-11-11): Celebrations 419,25 kr / ca. 160 stk ≈ 2,62 kr,
    // Lay's mini 16 kr / 6 poser ≈ 2,67 kr, Mini Mix Slikposer 49,95 kr / 17 poser ≈ 2,94 kr
    { id: 'candybar', navn: 'Mini Candybar', ikon: '🍫', pris: 5, kostpris: 0 },
    { id: 'chips', navn: 'Mini Chipspose', ikon: '🥔', pris: 6, kostpris: 0 },
    { id: 'slik', navn: 'Mini Slikpose', ikon: '🍬', pris: 6, kostpris: 0 },
    { id: 'andet', navn: 'Andet?', ikon: '💡', pris: 0, kostpris: 0, snart: true }
  ],

  hjul: [
    { id: 'h-100', navn: '100 Webcoins', ikon: '🏆', type: 'webcoins', beloeb: 100, vaegt: 30 },
    { id: 'h-nitte', navn: 'Nitte', ikon: '❌', type: 'intet', vaegt: 90 },
    { id: 'h-10', navn: '10 Webcoins', ikon: '✨', type: 'webcoins', beloeb: 10, vaegt: 70 },
    { id: 'h-sodavand', navn: 'Sodavand', ikon: '🥤', type: 'vare', kostpris: 10, vaegt: 110 },
    { id: 'h-20', navn: '20 Webcoins', ikon: '💫', type: 'webcoins', beloeb: 20, vaegt: 170 },
    { id: 'h-candybar', navn: 'Mini Candybar', ikon: '🍫', type: 'vare', kostpris: 0, vaegt: 45 }, // teamkassen
    { id: 'h-30', navn: '30 Webcoins', ikon: '💎', type: 'webcoins', beloeb: 30, vaegt: 180 },
    { id: 'h-chips', navn: 'Mini Chipspose', ikon: '🥔', type: 'vare', kostpris: 0, vaegt: 45 }, // teamkassen
    { id: 'h-monster', navn: 'Hvid Monster', ikon: '⚡', type: 'vare', kostpris: 15, vaegt: 70 },
    { id: 'h-slik', navn: 'Mini Slikpose', ikon: '🍬', type: 'vare', kostpris: 0, vaegt: 40 }, // teamkassen
    { id: 'h-40', navn: '40 Webcoins', ikon: '💰', type: 'webcoins', beloeb: 40, vaegt: 150 }
  ],

  events: [
    { id: 'frokost', navn: 'Teamfrokost', ikon: '🍽️', maal: 3000 },
    { id: 'biograf', navn: 'Tur i biografen', ikon: '🎬', maal: 1600 },
    { id: 'kage', navn: 'Kagefredag', ikon: '🍰', maal: 400 }
  ]
};
