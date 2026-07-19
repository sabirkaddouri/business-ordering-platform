// Predefined list of Moroccan cities
(function() {
const MOROCCAN_CITIES = [
  { name: "Casablanca", region: "Casablanca-Settat" },
  { name: "Rabat", region: "Rabat-Salé-Kénitra" },
  { name: "Marrakech", region: "Marrakech-Safi" },
  { name: "Fès", region: "Fès-Meknès" },
  { name: "Tanger", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Agadir", region: "Souss-Massa" },
  { name: "Meknès", region: "Fès-Meknès" },
  { name: "Oujda", region: "L'Oriental" },
  { name: "Kénitra", region: "Rabat-Salé-Kénitra" },
  { name: "Tétouan", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Salé", region: "Rabat-Salé-Kénitra" },
  { name: "Témara", region: "Rabat-Salé-Kénitra" },
  { name: "Safi", region: "Marrakech-Safi" },
  { name: "Mohammedia", region: "Casablanca-Settat" },
  { name: "El Jadida", region: "Casablanca-Settat" },
  { name: "Béni Mellal", region: "Béni Mellal-Khénifra" },
  { name: "Nador", region: "L'Oriental" },
  { name: "Khouribga", region: "Béni Mellal-Khénifra" },
  { name: "Settat", region: "Casablanca-Settat" },
  { name: "Larache", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Khémisset", region: "Rabat-Salé-Kénitra" },
  { name: "Guelmim", region: "Guelmim-Oued Noun" },
  { name: "Berrechid", region: "Casablanca-Settat" },
  { name: "Taza", region: "Fès-Meknès" },
  { name: "Ksar El Kébir", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Essaouira", region: "Marrakech-Safi" },
  { name: "Errachidia", region: "Drâa-Tafilalet" },
  { name: "Taroudant", region: "Souss-Massa" },
  { name: "Berkane", region: "L'Oriental" },
  { name: "Ouarzazate", region: "Drâa-Tafilalet" },
  { name: "Sidi Slimane", region: "Rabat-Salé-Kénitra" },
  { name: "Sidi Kacem", region: "Rabat-Salé-Kénitra" },
  { name: "Khénifra", region: "Béni Mellal-Khénifra" },
  { name: "Tiznit", region: "Souss-Massa" },
  { name: "Al Hoceïma", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Chefchaouen", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Ifrane", region: "Fès-Meknès" },
  { name: "Azrou", region: "Fès-Meknès" },
  { name: "Midelt", region: "Drâa-Tafilalet" },
  { name: "Tan-Tan", region: "Guelmim-Oued Noun" },
  { name: "Laâyoune", region: "Laâyoune-Sakia El Hamra" },
  { name: "Dakhla", region: "Dakhla-Oued Ed-Dahab" },
  { name: "Guercif", region: "L'Oriental" },
  { name: "Sefrou", region: "Fès-Meknès" },
  { name: "Taourirt", region: "L'Oriental" },
  { name: "Oued Zem", region: "Béni Mellal-Khénifra" },
  { name: "Fquih Ben Salah", region: "Béni Mellal-Khénifra" },
  { name: "Youssoufia", region: "Marrakech-Safi" },
  { name: "Tifelt", region: "Rabat-Salé-Kénitra" },
  { name: "Ouezzane", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Sidi Bennour", region: "Casablanca-Settat" }
];

// Provide it globally if needed or module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MOROCCAN_CITIES;
} else if (typeof window !== 'undefined') {
  window.MOROCCAN_CITIES = MOROCCAN_CITIES;
}
})();
