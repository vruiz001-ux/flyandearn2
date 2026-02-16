/**
 * FlyAndEarn - Airports Data (Lazy Loaded)
 */

export const AIRPORTS = [
  // Europe
  { code: 'WAW', city: 'Warsaw', country: 'Poland', name: 'Warsaw Chopin' },
  { code: 'KRK', city: 'Krakow', country: 'Poland', name: 'Krakow John Paul II' },
  { code: 'GDN', city: 'Gdansk', country: 'Poland', name: 'Gdansk Lech Walesa' },
  { code: 'WRO', city: 'Wroclaw', country: 'Poland', name: 'Wroclaw Copernicus' },
  { code: 'POZ', city: 'Poznan', country: 'Poland', name: 'Poznan Lawica' },
  { code: 'LHR', city: 'London', country: 'UK', name: 'London Heathrow' },
  { code: 'LGW', city: 'London', country: 'UK', name: 'London Gatwick' },
  { code: 'STN', city: 'London', country: 'UK', name: 'London Stansted' },
  { code: 'LTN', city: 'London', country: 'UK', name: 'London Luton' },
  { code: 'CDG', city: 'Paris', country: 'France', name: 'Paris Charles de Gaulle' },
  { code: 'ORY', city: 'Paris', country: 'France', name: 'Paris Orly' },
  { code: 'FRA', city: 'Frankfurt', country: 'Germany', name: 'Frankfurt am Main' },
  { code: 'MUC', city: 'Munich', country: 'Germany', name: 'Munich' },
  { code: 'BER', city: 'Berlin', country: 'Germany', name: 'Berlin Brandenburg' },
  { code: 'DUS', city: 'Dusseldorf', country: 'Germany', name: 'Dusseldorf' },
  { code: 'HAM', city: 'Hamburg', country: 'Germany', name: 'Hamburg' },
  { code: 'AMS', city: 'Amsterdam', country: 'Netherlands', name: 'Amsterdam Schiphol' },
  { code: 'BRU', city: 'Brussels', country: 'Belgium', name: 'Brussels' },
  { code: 'MAD', city: 'Madrid', country: 'Spain', name: 'Madrid Barajas' },
  { code: 'BCN', city: 'Barcelona', country: 'Spain', name: 'Barcelona El Prat' },
  { code: 'FCO', city: 'Rome', country: 'Italy', name: 'Rome Fiumicino' },
  { code: 'MXP', city: 'Milan', country: 'Italy', name: 'Milan Malpensa' },
  { code: 'VCE', city: 'Venice', country: 'Italy', name: 'Venice Marco Polo' },
  { code: 'VIE', city: 'Vienna', country: 'Austria', name: 'Vienna' },
  { code: 'ZRH', city: 'Zurich', country: 'Switzerland', name: 'Zurich' },
  { code: 'GVA', city: 'Geneva', country: 'Switzerland', name: 'Geneva' },
  { code: 'CPH', city: 'Copenhagen', country: 'Denmark', name: 'Copenhagen' },
  { code: 'OSL', city: 'Oslo', country: 'Norway', name: 'Oslo Gardermoen' },
  { code: 'ARN', city: 'Stockholm', country: 'Sweden', name: 'Stockholm Arlanda' },
  { code: 'HEL', city: 'Helsinki', country: 'Finland', name: 'Helsinki Vantaa' },
  { code: 'PRG', city: 'Prague', country: 'Czech Republic', name: 'Prague Vaclav Havel' },
  { code: 'BUD', city: 'Budapest', country: 'Hungary', name: 'Budapest Ferenc Liszt' },
  { code: 'ATH', city: 'Athens', country: 'Greece', name: 'Athens Eleftherios Venizelos' },
  { code: 'LIS', city: 'Lisbon', country: 'Portugal', name: 'Lisbon Humberto Delgado' },
  { code: 'DUB', city: 'Dublin', country: 'Ireland', name: 'Dublin' },
  { code: 'IST', city: 'Istanbul', country: 'Turkey', name: 'Istanbul' },

  // Middle East
  { code: 'DXB', city: 'Dubai', country: 'UAE', name: 'Dubai International' },
  { code: 'DWC', city: 'Dubai', country: 'UAE', name: 'Al Maktoum' },
  { code: 'AUH', city: 'Abu Dhabi', country: 'UAE', name: 'Abu Dhabi' },
  { code: 'DOH', city: 'Doha', country: 'Qatar', name: 'Hamad International' },
  { code: 'RUH', city: 'Riyadh', country: 'Saudi Arabia', name: 'King Khalid' },
  { code: 'JED', city: 'Jeddah', country: 'Saudi Arabia', name: 'King Abdulaziz' },
  { code: 'DMM', city: 'Dammam', country: 'Saudi Arabia', name: 'King Fahd' },
  { code: 'KWI', city: 'Kuwait City', country: 'Kuwait', name: 'Kuwait International' },
  { code: 'BAH', city: 'Bahrain', country: 'Bahrain', name: 'Bahrain International' },
  { code: 'MCT', city: 'Muscat', country: 'Oman', name: 'Muscat International' },
  { code: 'TLV', city: 'Tel Aviv', country: 'Israel', name: 'Ben Gurion' },
  { code: 'AMM', city: 'Amman', country: 'Jordan', name: 'Queen Alia' },
  { code: 'BEY', city: 'Beirut', country: 'Lebanon', name: 'Rafic Hariri' },
  { code: 'CAI', city: 'Cairo', country: 'Egypt', name: 'Cairo International' },

  // Asia (condensed for main bundle size)
  { code: 'SIN', city: 'Singapore', country: 'Singapore', name: 'Singapore Changi' },
  { code: 'HKG', city: 'Hong Kong', country: 'Hong Kong', name: 'Hong Kong International' },
  { code: 'BKK', city: 'Bangkok', country: 'Thailand', name: 'Suvarnabhumi' },
  { code: 'KUL', city: 'Kuala Lumpur', country: 'Malaysia', name: 'Kuala Lumpur International' },
  { code: 'NRT', city: 'Tokyo', country: 'Japan', name: 'Tokyo Narita' },
  { code: 'HND', city: 'Tokyo', country: 'Japan', name: 'Tokyo Haneda' },
  { code: 'ICN', city: 'Seoul', country: 'South Korea', name: 'Incheon' },
  { code: 'PEK', city: 'Beijing', country: 'China', name: 'Beijing Capital' },
  { code: 'PVG', city: 'Shanghai', country: 'China', name: 'Shanghai Pudong' },
  { code: 'DEL', city: 'New Delhi', country: 'India', name: 'Indira Gandhi' },
  { code: 'BOM', city: 'Mumbai', country: 'India', name: 'Chhatrapati Shivaji' },
  { code: 'MNL', city: 'Manila', country: 'Philippines', name: 'Ninoy Aquino' },
  { code: 'CGK', city: 'Jakarta', country: 'Indonesia', name: 'Soekarno-Hatta' },
  { code: 'SGN', city: 'Ho Chi Minh City', country: 'Vietnam', name: 'Tan Son Nhat' },

  // Americas
  { code: 'JFK', city: 'New York', country: 'USA', name: 'John F. Kennedy' },
  { code: 'LAX', city: 'Los Angeles', country: 'USA', name: 'Los Angeles International' },
  { code: 'ORD', city: 'Chicago', country: 'USA', name: "Chicago O'Hare" },
  { code: 'MIA', city: 'Miami', country: 'USA', name: 'Miami International' },
  { code: 'SFO', city: 'San Francisco', country: 'USA', name: 'San Francisco International' },
  { code: 'ATL', city: 'Atlanta', country: 'USA', name: 'Hartsfield-Jackson' },
  { code: 'YYZ', city: 'Toronto', country: 'Canada', name: 'Toronto Pearson' },
  { code: 'YVR', city: 'Vancouver', country: 'Canada', name: 'Vancouver International' },
  { code: 'MEX', city: 'Mexico City', country: 'Mexico', name: 'Benito Juarez' },
  { code: 'GRU', city: 'Sao Paulo', country: 'Brazil', name: 'Guarulhos' },

  // Africa & Oceania
  { code: 'JNB', city: 'Johannesburg', country: 'South Africa', name: 'O.R. Tambo' },
  { code: 'CPT', city: 'Cape Town', country: 'South Africa', name: 'Cape Town International' },
  { code: 'NBO', city: 'Nairobi', country: 'Kenya', name: 'Jomo Kenyatta' },
  { code: 'CMN', city: 'Casablanca', country: 'Morocco', name: 'Mohammed V' },
  { code: 'SYD', city: 'Sydney', country: 'Australia', name: 'Sydney Kingsford Smith' },
  { code: 'MEL', city: 'Melbourne', country: 'Australia', name: 'Melbourne Tullamarine' },
  { code: 'AKL', city: 'Auckland', country: 'New Zealand', name: 'Auckland' },
];

export const AIRPORT_REGIONS = {
  Europe: ['WAW', 'KRK', 'GDN', 'WRO', 'POZ', 'LHR', 'LGW', 'STN', 'LTN', 'CDG', 'ORY', 'FRA', 'MUC', 'BER', 'DUS', 'HAM', 'AMS', 'BRU', 'MAD', 'BCN', 'FCO', 'MXP', 'VCE', 'VIE', 'ZRH', 'GVA', 'CPH', 'OSL', 'ARN', 'HEL', 'PRG', 'BUD', 'ATH', 'LIS', 'DUB', 'IST'],
  'Middle East': ['DXB', 'DWC', 'AUH', 'DOH', 'RUH', 'JED', 'DMM', 'KWI', 'BAH', 'MCT', 'TLV', 'AMM', 'BEY', 'CAI'],
  Asia: ['SIN', 'HKG', 'BKK', 'KUL', 'NRT', 'HND', 'ICN', 'PEK', 'PVG', 'DEL', 'BOM', 'MNL', 'CGK', 'SGN'],
  Americas: ['JFK', 'LAX', 'ORD', 'MIA', 'SFO', 'ATL', 'YYZ', 'YVR', 'MEX', 'GRU'],
  Africa: ['JNB', 'CPT', 'NBO', 'CMN'],
  Oceania: ['SYD', 'MEL', 'AKL'],
};

export function getAirportByCode(code) {
  return AIRPORTS.find((a) => a.code === code);
}

export function searchAirports(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return AIRPORTS.filter(
    (a) =>
      a.code.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q)
  ).slice(0, 15);
}

export function formatAirportOption(airport) {
  return `${airport.code} - ${airport.city}, ${airport.country}`;
}

// Expose to window for backward compatibility
if (typeof window !== 'undefined') {
  window.AIRPORTS = AIRPORTS;
  window.AIRPORT_REGIONS = AIRPORT_REGIONS;
  window.getAirportByCode = getAirportByCode;
  window.searchAirports = searchAirports;
  window.formatAirportOption = formatAirportOption;
}
