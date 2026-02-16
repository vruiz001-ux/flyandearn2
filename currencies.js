// Country to Currency Mapping
// Based on ISO 4217 currency codes

const CURRENCIES = {
    // Currency definitions
    EUR: { symbol: '€', code: 'EUR', name: 'Euro', decimals: 2, position: 'before' },
    USD: { symbol: '$', code: 'USD', name: 'US Dollar', decimals: 2, position: 'before' },
    GBP: { symbol: '£', code: 'GBP', name: 'British Pound', decimals: 2, position: 'before' },
    PLN: { symbol: 'zł', code: 'PLN', name: 'Polish Zloty', decimals: 2, position: 'after' },
    CHF: { symbol: 'CHF', code: 'CHF', name: 'Swiss Franc', decimals: 2, position: 'before' },
    JPY: { symbol: '¥', code: 'JPY', name: 'Japanese Yen', decimals: 0, position: 'before' },
    AED: { symbol: 'AED', code: 'AED', name: 'UAE Dirham', decimals: 2, position: 'before' },
    SAR: { symbol: 'SAR', code: 'SAR', name: 'Saudi Riyal', decimals: 2, position: 'before' },
    QAR: { symbol: 'QAR', code: 'QAR', name: 'Qatari Riyal', decimals: 2, position: 'before' },
    KWD: { symbol: 'KWD', code: 'KWD', name: 'Kuwaiti Dinar', decimals: 3, position: 'before' },
    BHD: { symbol: 'BHD', code: 'BHD', name: 'Bahraini Dinar', decimals: 3, position: 'before' },
    OMR: { symbol: 'OMR', code: 'OMR', name: 'Omani Rial', decimals: 3, position: 'before' },
    PHP: { symbol: '₱', code: 'PHP', name: 'Philippine Peso', decimals: 2, position: 'before' },
    SGD: { symbol: 'S$', code: 'SGD', name: 'Singapore Dollar', decimals: 2, position: 'before' },
    THB: { symbol: '฿', code: 'THB', name: 'Thai Baht', decimals: 2, position: 'before' },
    MYR: { symbol: 'RM', code: 'MYR', name: 'Malaysian Ringgit', decimals: 2, position: 'before' },
    IDR: { symbol: 'Rp', code: 'IDR', name: 'Indonesian Rupiah', decimals: 0, position: 'before' },
    KRW: { symbol: '₩', code: 'KRW', name: 'South Korean Won', decimals: 0, position: 'before' },
    CNY: { symbol: '¥', code: 'CNY', name: 'Chinese Yuan', decimals: 2, position: 'before' },
    HKD: { symbol: 'HK$', code: 'HKD', name: 'Hong Kong Dollar', decimals: 2, position: 'before' },
    TWD: { symbol: 'NT$', code: 'TWD', name: 'Taiwan Dollar', decimals: 0, position: 'before' },
    INR: { symbol: '₹', code: 'INR', name: 'Indian Rupee', decimals: 2, position: 'before' },
    PKR: { symbol: 'Rs', code: 'PKR', name: 'Pakistani Rupee', decimals: 2, position: 'before' },
    EGP: { symbol: 'E£', code: 'EGP', name: 'Egyptian Pound', decimals: 2, position: 'before' },
    TRY: { symbol: '₺', code: 'TRY', name: 'Turkish Lira', decimals: 2, position: 'before' },
    ILS: { symbol: '₪', code: 'ILS', name: 'Israeli Shekel', decimals: 2, position: 'before' },
    JOD: { symbol: 'JOD', code: 'JOD', name: 'Jordanian Dinar', decimals: 3, position: 'before' },
    MAD: { symbol: 'MAD', code: 'MAD', name: 'Moroccan Dirham', decimals: 2, position: 'before' },
    ZAR: { symbol: 'R', code: 'ZAR', name: 'South African Rand', decimals: 2, position: 'before' },
    AUD: { symbol: 'A$', code: 'AUD', name: 'Australian Dollar', decimals: 2, position: 'before' },
    NZD: { symbol: 'NZ$', code: 'NZD', name: 'New Zealand Dollar', decimals: 2, position: 'before' },
    CAD: { symbol: 'C$', code: 'CAD', name: 'Canadian Dollar', decimals: 2, position: 'before' },
    MXN: { symbol: 'MX$', code: 'MXN', name: 'Mexican Peso', decimals: 2, position: 'before' },
    BRL: { symbol: 'R$', code: 'BRL', name: 'Brazilian Real', decimals: 2, position: 'before' },
    CZK: { symbol: 'Kč', code: 'CZK', name: 'Czech Koruna', decimals: 2, position: 'after' },
    HUF: { symbol: 'Ft', code: 'HUF', name: 'Hungarian Forint', decimals: 0, position: 'after' },
    RON: { symbol: 'lei', code: 'RON', name: 'Romanian Leu', decimals: 2, position: 'after' },
    BGN: { symbol: 'лв', code: 'BGN', name: 'Bulgarian Lev', decimals: 2, position: 'after' },
    HRK: { symbol: 'kn', code: 'HRK', name: 'Croatian Kuna', decimals: 2, position: 'after' },
    SEK: { symbol: 'kr', code: 'SEK', name: 'Swedish Krona', decimals: 2, position: 'after' },
    NOK: { symbol: 'kr', code: 'NOK', name: 'Norwegian Krone', decimals: 2, position: 'after' },
    DKK: { symbol: 'kr', code: 'DKK', name: 'Danish Krone', decimals: 2, position: 'after' },
    RUB: { symbol: '₽', code: 'RUB', name: 'Russian Ruble', decimals: 2, position: 'after' },
    UAH: { symbol: '₴', code: 'UAH', name: 'Ukrainian Hryvnia', decimals: 2, position: 'after' },
};

// Country to Currency Code mapping
const COUNTRY_CURRENCY = {
    // Eurozone
    'Austria': 'EUR',
    'Belgium': 'EUR',
    'Cyprus': 'EUR',
    'Estonia': 'EUR',
    'Finland': 'EUR',
    'France': 'EUR',
    'Germany': 'EUR',
    'Greece': 'EUR',
    'Ireland': 'EUR',
    'Italy': 'EUR',
    'Latvia': 'EUR',
    'Lithuania': 'EUR',
    'Luxembourg': 'EUR',
    'Malta': 'EUR',
    'Netherlands': 'EUR',
    'Portugal': 'EUR',
    'Slovakia': 'EUR',
    'Slovenia': 'EUR',
    'Spain': 'EUR',

    // Non-Euro Europe
    'Poland': 'PLN',
    'United Kingdom': 'GBP',
    'UK': 'GBP',
    'Switzerland': 'CHF',
    'Czech Republic': 'CZK',
    'Czechia': 'CZK',
    'Hungary': 'HUF',
    'Romania': 'RON',
    'Bulgaria': 'BGN',
    'Croatia': 'EUR', // Joined EUR in 2023
    'Sweden': 'SEK',
    'Norway': 'NOK',
    'Denmark': 'DKK',
    'Russia': 'RUB',
    'Ukraine': 'UAH',
    'Turkey': 'TRY',

    // Middle East
    'UAE': 'AED',
    'United Arab Emirates': 'AED',
    'Saudi Arabia': 'SAR',
    'Qatar': 'QAR',
    'Kuwait': 'KWD',
    'Bahrain': 'BHD',
    'Oman': 'OMR',
    'Jordan': 'JOD',
    'Israel': 'ILS',
    'Egypt': 'EGP',
    'Morocco': 'MAD',

    // Asia
    'Japan': 'JPY',
    'China': 'CNY',
    'Hong Kong': 'HKD',
    'Taiwan': 'TWD',
    'South Korea': 'KRW',
    'Korea': 'KRW',
    'Philippines': 'PHP',
    'Singapore': 'SGD',
    'Thailand': 'THB',
    'Malaysia': 'MYR',
    'Indonesia': 'IDR',
    'India': 'INR',
    'Pakistan': 'PKR',

    // Americas
    'USA': 'USD',
    'United States': 'USD',
    'Canada': 'CAD',
    'Mexico': 'MXN',
    'Brazil': 'BRL',

    // Oceania
    'Australia': 'AUD',
    'New Zealand': 'NZD',

    // Africa
    'South Africa': 'ZAR',
};

// Get currency for a country (with EUR fallback)
function getCurrencyForCountry(country) {
    if (!country) return CURRENCIES.EUR;
    const code = COUNTRY_CURRENCY[country] || 'EUR';
    return CURRENCIES[code] || CURRENCIES.EUR;
}

// Get currency code for a country
function getCurrencyCodeForCountry(country) {
    if (!country) return 'EUR';
    return COUNTRY_CURRENCY[country] || 'EUR';
}

// Format amount with currency
function formatCurrencyAmount(amount, countryOrCode) {
    let currency;

    // Check if it's a currency code or country name
    if (CURRENCIES[countryOrCode]) {
        currency = CURRENCIES[countryOrCode];
    } else {
        currency = getCurrencyForCountry(countryOrCode);
    }

    const num = parseFloat(amount);
    if (isNaN(num)) return currency.symbol + '0';

    const formatted = num.toFixed(currency.decimals);

    // Add thousand separators
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const formattedNum = parts.join('.');

    if (currency.position === 'after') {
        return formattedNum + ' ' + currency.symbol;
    } else {
        return currency.symbol + formattedNum;
    }
}

// Get currency symbol for country
function getCurrencySymbol(country) {
    const currency = getCurrencyForCountry(country);
    return currency.symbol;
}

// Get currency from airport code
function getCurrencyFromAirport(airportCode) {
    // This requires AIRPORTS to be loaded
    if (typeof AIRPORTS !== 'undefined') {
        const airport = AIRPORTS.find(a => a.code === airportCode);
        if (airport && airport.country) {
            return getCurrencyForCountry(airport.country);
        }
    }
    return CURRENCIES.EUR;
}

// Format currency from airport destination
function formatCurrencyFromAirport(amount, airportCode) {
    const currency = getCurrencyFromAirport(airportCode);
    return formatCurrencyAmount(amount, currency.code);
}

// Export for use in modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CURRENCIES,
        COUNTRY_CURRENCY,
        getCurrencyForCountry,
        getCurrencyCodeForCountry,
        formatCurrencyAmount,
        getCurrencySymbol,
        getCurrencyFromAirport,
        formatCurrencyFromAirport
    };
}
