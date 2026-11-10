/*
 * Sortiment – menu, lykkehjul og events. Rettes her i koden (ikke i admin eller arket).
 * Bruges af både demoen og Apps Script (kopiér ind som "Sortiment.gs" ved siden af Core.gs).
 *
 * Økonomi: 1 kr = 2 Webcoins. pris/beloeb/maal er i Webcoins, kostpris i kr (det der sendes til RAB).
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
    { id: 'candybar', navn: 'Mini Candybar', ikon: '🍫', pris: 5, kostpris: 2.5 },
    { id: 'chips', navn: 'Mini Chipspose', ikon: '🥔', pris: 5, kostpris: 5 },
    { id: 'slik', navn: 'Mini Slikpose', ikon: '🍬', pris: 5, kostpris: 4 },
    { id: 'andet', navn: 'Andet?', ikon: '💡', pris: 0, kostpris: 0, snart: true }
  ],

  hjul: [
    { id: 'h-100', navn: '100 Webcoins', ikon: '🏆', type: 'webcoins', beloeb: 100, vaegt: 30 },
    { id: 'h-nitte', navn: 'Nitte', ikon: '❌', type: 'intet', vaegt: 100 },
    { id: 'h-10', navn: '10 Webcoins', ikon: '✨', type: 'webcoins', beloeb: 10, vaegt: 80 },
    { id: 'h-sodavand', navn: 'Sodavand', ikon: '🥤', type: 'vare', kostpris: 10, vaegt: 120 },
    { id: 'h-20', navn: '20 Webcoins', ikon: '💫', type: 'webcoins', beloeb: 20, vaegt: 180 },
    { id: 'h-candybar', navn: 'Mini Candybar', ikon: '🍫', type: 'vare', kostpris: 2.5, vaegt: 80 },
    { id: 'h-30', navn: '30 Webcoins', ikon: '💎', type: 'webcoins', beloeb: 30, vaegt: 200 },
    { id: 'h-monster', navn: 'Hvid Monster', ikon: '⚡', type: 'vare', kostpris: 15, vaegt: 70 },
    { id: 'h-40', navn: '40 Webcoins', ikon: '💰', type: 'webcoins', beloeb: 40, vaegt: 140 }
  ],

  events: [
    { id: 'frokost', navn: 'Teamfrokost', ikon: '🍽️', maal: 3000 },
    { id: 'biograf', navn: 'Tur i biografen', ikon: '🎬', maal: 1600 },
    { id: 'kage', navn: 'Kagefredag', ikon: '🍰', maal: 400 }
  ]
};
