/**
 * FlyAndEarn - Server-side i18n for Netlify Functions
 *
 * Provides localized:
 * - API error messages
 * - Email templates
 * - Notification content
 * - System messages
 *
 * Usage:
 *   import { getServerI18n, resolveLocaleFromRequest } from './lib/i18n.js';
 *   const i18n = getServerI18n(resolveLocaleFromRequest(event));
 *   i18n.t('errors.notFound');
 */

// ==========================================
// SUPPORTED LOCALES
// ==========================================

export const SUPPORTED_LOCALES = ['en-GB', 'en-US', 'fr-FR', 'pl-PL', 'de-DE', 'fr-CH', 'de-CH', 'de-AT'];
export const SUPPORTED_LANGUAGES = ['en', 'fr', 'pl', 'de'];
export const DEFAULT_LOCALE = 'en-GB';

// Language to default country mapping
const LANGUAGE_COUNTRY_MAP = {
  en: 'GB',
  fr: 'FR',
  pl: 'PL',
  de: 'DE',
};

// ==========================================
// SERVER TRANSLATIONS
// ==========================================

const SERVER_TRANSLATIONS = {
  // ==========================================
  // ERROR MESSAGES
  // ==========================================
  'errors.generic': {
    en: 'An error occurred. Please try again.',
    fr: 'Une erreur s\'est produite. Veuillez réessayer.',
    pl: 'Wystąpił błąd. Spróbuj ponownie.',
    de: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
  },
  'errors.notFound': {
    en: 'The requested resource was not found.',
    fr: 'La ressource demandée n\'a pas été trouvée.',
    pl: 'Nie znaleziono żądanego zasobu.',
    de: 'Die angeforderte Ressource wurde nicht gefunden.',
  },
  'errors.unauthorized': {
    en: 'You must be logged in to perform this action.',
    fr: 'Vous devez être connecté pour effectuer cette action.',
    pl: 'Musisz być zalogowany, aby wykonać tę akcję.',
    de: 'Sie müssen angemeldet sein, um diese Aktion auszuführen.',
  },
  'errors.forbidden': {
    en: 'You do not have permission to perform this action.',
    fr: 'Vous n\'avez pas la permission d\'effectuer cette action.',
    pl: 'Nie masz uprawnień do wykonania tej akcji.',
    de: 'Sie haben keine Berechtigung, diese Aktion auszuführen.',
  },
  'errors.invalidSession': {
    en: 'Your session has expired. Please log in again.',
    fr: 'Votre session a expiré. Veuillez vous reconnecter.',
    pl: 'Twoja sesja wygasła. Zaloguj się ponownie.',
    de: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
  },
  'errors.validation': {
    en: 'Please check your input and try again.',
    fr: 'Veuillez vérifier vos données et réessayer.',
    pl: 'Sprawdź wprowadzone dane i spróbuj ponownie.',
    de: 'Bitte überprüfen Sie Ihre Eingaben und versuchen Sie es erneut.',
  },
  'errors.rateLimited': {
    en: 'Too many requests. Please wait a moment before trying again.',
    fr: 'Trop de requêtes. Veuillez patienter avant de réessayer.',
    pl: 'Zbyt wiele żądań. Poczekaj chwilę przed ponowną próbą.',
    de: 'Zu viele Anfragen. Bitte warten Sie einen Moment.',
  },

  // ==========================================
  // AUTH MESSAGES
  // ==========================================
  'auth.loginSuccess': {
    en: 'Welcome back, {{name}}!',
    fr: 'Bon retour, {{name}} !',
    pl: 'Witaj ponownie, {{name}}!',
    de: 'Willkommen zurück, {{name}}!',
  },
  'auth.registerSuccess': {
    en: 'Account created successfully. Please verify your email.',
    fr: 'Compte créé avec succès. Veuillez vérifier votre email.',
    pl: 'Konto utworzone pomyślnie. Zweryfikuj swój adres email.',
    de: 'Konto erfolgreich erstellt. Bitte bestätigen Sie Ihre E-Mail.',
  },
  'auth.logoutSuccess': {
    en: 'You have been logged out.',
    fr: 'Vous avez été déconnecté.',
    pl: 'Zostałeś wylogowany.',
    de: 'Sie wurden abgemeldet.',
  },
  'auth.invalidCredentials': {
    en: 'Invalid email or password.',
    fr: 'Email ou mot de passe invalide.',
    pl: 'Nieprawidłowy email lub hasło.',
    de: 'Ungültige E-Mail oder Passwort.',
  },
  'auth.emailExists': {
    en: 'An account with this email already exists.',
    fr: 'Un compte avec cet email existe déjà.',
    pl: 'Konto z tym adresem email już istnieje.',
    de: 'Ein Konto mit dieser E-Mail existiert bereits.',
  },
  'auth.emailVerified': {
    en: 'Your email has been verified. You can now log in.',
    fr: 'Votre email a été vérifié. Vous pouvez maintenant vous connecter.',
    pl: 'Twój email został zweryfikowany. Możesz się teraz zalogować.',
    de: 'Ihre E-Mail wurde bestätigt. Sie können sich jetzt anmelden.',
  },
  'auth.passwordResetSent': {
    en: 'If an account exists with this email, you will receive password reset instructions.',
    fr: 'Si un compte existe avec cet email, vous recevrez les instructions de réinitialisation.',
    pl: 'Jeśli konto z tym adresem istnieje, otrzymasz instrukcje resetowania hasła.',
    de: 'Falls ein Konto mit dieser E-Mail existiert, erhalten Sie Anweisungen zum Zurücksetzen.',
  },
  'auth.passwordResetSuccess': {
    en: 'Your password has been reset. You can now log in with your new password.',
    fr: 'Votre mot de passe a été réinitialisé. Vous pouvez maintenant vous connecter.',
    pl: 'Twoje hasło zostało zresetowane. Możesz się teraz zalogować.',
    de: 'Ihr Passwort wurde zurückgesetzt. Sie können sich jetzt anmelden.',
  },
  'auth.accountBanned': {
    en: 'Your account has been suspended. Contact support for assistance.',
    fr: 'Votre compte a été suspendu. Contactez le support.',
    pl: 'Twoje konto zostało zawieszone. Skontaktuj się z pomocą techniczną.',
    de: 'Ihr Konto wurde gesperrt. Kontaktieren Sie den Support.',
  },

  // ==========================================
  // TRIP MESSAGES
  // ==========================================
  'trips.created': {
    en: 'Your trip has been created successfully.',
    fr: 'Votre voyage a été créé avec succès.',
    pl: 'Twoja podróż została utworzona pomyślnie.',
    de: 'Ihre Reise wurde erfolgreich erstellt.',
  },
  'trips.updated': {
    en: 'Your trip has been updated.',
    fr: 'Votre voyage a été mis à jour.',
    pl: 'Twoja podróż została zaktualizowana.',
    de: 'Ihre Reise wurde aktualisiert.',
  },
  'trips.deleted': {
    en: 'Your trip has been deleted.',
    fr: 'Votre voyage a été supprimé.',
    pl: 'Twoja podróż została usunięta.',
    de: 'Ihre Reise wurde gelöscht.',
  },
  'trips.notFound': {
    en: 'Trip not found.',
    fr: 'Voyage non trouvé.',
    pl: 'Nie znaleziono podróży.',
    de: 'Reise nicht gefunden.',
  },
  'trips.notOwner': {
    en: 'You are not authorized to modify this trip.',
    fr: 'Vous n\'êtes pas autorisé à modifier ce voyage.',
    pl: 'Nie masz uprawnień do modyfikacji tej podróży.',
    de: 'Sie sind nicht berechtigt, diese Reise zu ändern.',
  },
  'trips.onlyTravellers': {
    en: 'Only travellers can create trips.',
    en_US: 'Only travelers can create trips.',
    fr: 'Seuls les voyageurs peuvent créer des voyages.',
    pl: 'Tylko podróżni mogą tworzyć podróże.',
    de: 'Nur Reisende können Reisen erstellen.',
  },

  // ==========================================
  // REQUEST MESSAGES
  // ==========================================
  'requests.created': {
    en: 'Your request has been created successfully.',
    fr: 'Votre demande a été créée avec succès.',
    pl: 'Twoje zapytanie zostało utworzone pomyślnie.',
    de: 'Ihre Anfrage wurde erfolgreich erstellt.',
  },
  'requests.updated': {
    en: 'Your request has been updated.',
    fr: 'Votre demande a été mise à jour.',
    pl: 'Twoje zapytanie zostało zaktualizowane.',
    de: 'Ihre Anfrage wurde aktualisiert.',
  },
  'requests.deleted': {
    en: 'Your request has been deleted.',
    fr: 'Votre demande a été supprimée.',
    pl: 'Twoje zapytanie zostało usunięte.',
    de: 'Ihre Anfrage wurde gelöscht.',
  },
  'requests.notFound': {
    en: 'Request not found.',
    fr: 'Demande non trouvée.',
    pl: 'Nie znaleziono zapytania.',
    de: 'Anfrage nicht gefunden.',
  },
  'requests.matched': {
    en: 'Your request has been matched with a traveller!',
    en_US: 'Your request has been matched with a traveler!',
    fr: 'Votre demande a été associée à un voyageur !',
    pl: 'Twoje zapytanie zostało dopasowane do podróżnego!',
    de: 'Ihre Anfrage wurde einem Reisenden zugeordnet!',
  },

  // ==========================================
  // ORDER MESSAGES
  // ==========================================
  'orders.created': {
    en: 'Order created successfully.',
    fr: 'Commande créée avec succès.',
    pl: 'Zamówienie utworzone pomyślnie.',
    de: 'Bestellung erfolgreich erstellt.',
  },
  'orders.paymentReceived': {
    en: 'Payment received. Your order is now in progress.',
    fr: 'Paiement reçu. Votre commande est en cours.',
    pl: 'Płatność otrzymana. Twoje zamówienie jest w trakcie realizacji.',
    de: 'Zahlung erhalten. Ihre Bestellung wird bearbeitet.',
  },
  'orders.completed': {
    en: 'Order completed! Thank you for using FlyAndEarn.',
    fr: 'Commande terminée ! Merci d\'utiliser FlyAndEarn.',
    pl: 'Zamówienie zakończone! Dziękujemy za korzystanie z FlyAndEarn.',
    de: 'Bestellung abgeschlossen! Vielen Dank für die Nutzung von FlyAndEarn.',
  },
  'orders.refunded': {
    en: 'Your order has been refunded.',
    fr: 'Votre commande a été remboursée.',
    pl: 'Twoje zamówienie zostało zwrócone.',
    de: 'Ihre Bestellung wurde erstattet.',
  },

  // ==========================================
  // WALLET MESSAGES
  // ==========================================
  'wallet.payoutRequested': {
    en: 'Payout request submitted. Funds will arrive in {{days}} business days.',
    fr: 'Demande de versement soumise. Les fonds arriveront dans {{days}} jours ouvrés.',
    pl: 'Wniosek o wypłatę złożony. Środki dotrą w ciągu {{days}} dni roboczych.',
    de: 'Auszahlungsantrag eingereicht. Die Mittel werden in {{days}} Werktagen eintreffen.',
  },
  'wallet.payoutCompleted': {
    en: 'Your payout of {{amount}} has been completed.',
    fr: 'Votre versement de {{amount}} a été effectué.',
    pl: 'Twoja wypłata {{amount}} została zrealizowana.',
    de: 'Ihre Auszahlung von {{amount}} wurde durchgeführt.',
  },
  'wallet.insufficientFunds': {
    en: 'Insufficient funds in your wallet.',
    fr: 'Fonds insuffisants dans votre portefeuille.',
    pl: 'Niewystarczające środki w portfelu.',
    de: 'Unzureichendes Guthaben in Ihrer Geldbörse.',
  },
  'wallet.minimumPayout': {
    en: 'Minimum payout amount is {{amount}}.',
    fr: 'Le montant minimum de versement est de {{amount}}.',
    pl: 'Minimalna kwota wypłaty to {{amount}}.',
    de: 'Der Mindestauszahlungsbetrag beträgt {{amount}}.',
  },

  // ==========================================
  // MESSAGE/NOTIFICATION CONTENT
  // ==========================================
  'notifications.newOffer': {
    en: 'You have a new offer from {{name}} for your request.',
    fr: 'Vous avez une nouvelle offre de {{name}} pour votre demande.',
    pl: 'Masz nową ofertę od {{name}} dla swojego zapytania.',
    de: 'Sie haben ein neues Angebot von {{name}} für Ihre Anfrage.',
  },
  'notifications.offerAccepted': {
    en: '{{name}} has accepted your offer!',
    fr: '{{name}} a accepté votre offre !',
    pl: '{{name}} zaakceptował(a) Twoją ofertę!',
    de: '{{name}} hat Ihr Angebot angenommen!',
  },
  'notifications.newMessage': {
    en: 'New message from {{name}}.',
    fr: 'Nouveau message de {{name}}.',
    pl: 'Nowa wiadomość od {{name}}.',
    de: 'Neue Nachricht von {{name}}.',
  },
  'notifications.deliveryReminder': {
    en: 'Reminder: You have a delivery scheduled with {{name}} on {{date}}.',
    fr: 'Rappel : Vous avez une livraison prévue avec {{name}} le {{date}}.',
    pl: 'Przypomnienie: Masz zaplanowaną dostawę z {{name}} na {{date}}.',
    de: 'Erinnerung: Sie haben eine Lieferung mit {{name}} am {{date}}.',
  },

  // ==========================================
  // EMAIL SUBJECTS
  // ==========================================
  'email.subject.welcome': {
    en: 'Welcome to FlyAndEarn!',
    fr: 'Bienvenue sur FlyAndEarn !',
    pl: 'Witamy w FlyAndEarn!',
    de: 'Willkommen bei FlyAndEarn!',
  },
  'email.subject.verifyEmail': {
    en: 'Verify your FlyAndEarn email',
    fr: 'Vérifiez votre email FlyAndEarn',
    pl: 'Zweryfikuj swój email FlyAndEarn',
    de: 'Bestätigen Sie Ihre FlyAndEarn E-Mail',
  },
  'email.subject.passwordReset': {
    en: 'Reset your FlyAndEarn password',
    fr: 'Réinitialisez votre mot de passe FlyAndEarn',
    pl: 'Zresetuj hasło FlyAndEarn',
    de: 'FlyAndEarn Passwort zurücksetzen',
  },
  'email.subject.orderConfirmation': {
    en: 'Order confirmation #{{orderId}}',
    fr: 'Confirmation de commande #{{orderId}}',
    pl: 'Potwierdzenie zamówienia #{{orderId}}',
    de: 'Bestellbestätigung #{{orderId}}',
  },
  'email.subject.payoutConfirmation': {
    en: 'Payout confirmation - {{amount}}',
    fr: 'Confirmation de versement - {{amount}}',
    pl: 'Potwierdzenie wypłaty - {{amount}}',
    de: 'Auszahlungsbestätigung - {{amount}}',
  },

  // ==========================================
  // VALIDATION MESSAGES
  // ==========================================
  'validation.required': {
    en: '{{field}} is required.',
    fr: '{{field}} est requis.',
    pl: 'Pole {{field}} jest wymagane.',
    de: '{{field}} ist erforderlich.',
  },
  'validation.invalidEmail': {
    en: 'Please enter a valid email address.',
    fr: 'Veuillez entrer une adresse email valide.',
    pl: 'Wprowadź prawidłowy adres email.',
    de: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
  },
  'validation.passwordTooShort': {
    en: 'Password must be at least {{min}} characters.',
    fr: 'Le mot de passe doit contenir au moins {{min}} caractères.',
    pl: 'Hasło musi mieć co najmniej {{min}} znaków.',
    de: 'Das Passwort muss mindestens {{min}} Zeichen haben.',
  },
  'validation.passwordRequirements': {
    en: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
    fr: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.',
    pl: 'Hasło musi zawierać co najmniej jedną wielką literę, jedną małą literę i jedną cyfrę.',
    de: 'Das Passwort muss mindestens einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten.',
  },
  'validation.invalidDate': {
    en: 'Please enter a valid date.',
    fr: 'Veuillez entrer une date valide.',
    pl: 'Wprowadź prawidłową datę.',
    de: 'Bitte geben Sie ein gültiges Datum ein.',
  },
  'validation.dateInPast': {
    en: 'Date cannot be in the past.',
    fr: 'La date ne peut pas être dans le passé.',
    pl: 'Data nie może być w przeszłości.',
    de: 'Das Datum darf nicht in der Vergangenheit liegen.',
  },
  'validation.amountTooLow': {
    en: 'Amount must be at least {{min}}.',
    fr: 'Le montant doit être d\'au moins {{min}}.',
    pl: 'Kwota musi wynosić co najmniej {{min}}.',
    de: 'Der Betrag muss mindestens {{min}} betragen.',
  },
};

// ==========================================
// LOCALE RESOLUTION
// ==========================================

/**
 * Parse a locale string into language and country
 * @param {string} locale
 * @returns {{ language: string, country: string|null }}
 */
function parseLocale(locale) {
  if (!locale) return { language: 'en', country: null };

  const normalized = locale.replace('_', '-');
  const parts = normalized.split('-');
  const language = parts[0].toLowerCase();
  const country = parts[1] ? parts[1].toUpperCase() : null;

  return { language, country };
}

/**
 * Build a canonical locale string
 * @param {string} language
 * @param {string} country
 * @returns {string}
 */
function buildLocale(language, country) {
  const lang = language.toLowerCase();
  const ctry = country ? country.toUpperCase() : LANGUAGE_COUNTRY_MAP[lang] || 'GB';
  return `${lang}-${ctry}`;
}

/**
 * Resolve locale from a Netlify Function event
 *
 * Priority:
 * 1. X-Locale header
 * 2. User profile locale (if userId provided)
 * 3. fae_locale cookie
 * 4. Accept-Language header
 * 5. Default locale
 *
 * @param {Object} event - Netlify Function event
 * @param {Object} options
 * @param {string} options.userLocale - Locale from user profile
 * @returns {string} Resolved locale
 */
export function resolveLocaleFromRequest(event, options = {}) {
  const { userLocale } = options;
  const headers = event.headers || {};

  // 1. Check X-Locale header
  const headerLocale = headers['x-locale'] || headers['X-Locale'];
  if (headerLocale && isValidLocale(headerLocale)) {
    return normalizeLocale(headerLocale);
  }

  // 2. Check user profile locale
  if (userLocale && isValidLocale(userLocale)) {
    return normalizeLocale(userLocale);
  }

  // 3. Check cookie
  const cookies = parseCookies(headers.cookie);
  const cookieLocale = cookies.fae_locale;
  if (cookieLocale && isValidLocale(cookieLocale)) {
    return normalizeLocale(cookieLocale);
  }

  // 4. Check Accept-Language header
  const acceptLanguage = headers['accept-language'] || headers['Accept-Language'];
  if (acceptLanguage) {
    const preferred = parseAcceptLanguage(acceptLanguage);
    if (preferred && isValidLocale(preferred)) {
      return normalizeLocale(preferred);
    }
  }

  // 5. Default
  return DEFAULT_LOCALE;
}

/**
 * Parse Accept-Language header and return best match
 * @param {string} header
 * @returns {string|null}
 */
function parseAcceptLanguage(header) {
  const locales = header
    .split(',')
    .map((part) => {
      const [locale, q = 'q=1'] = part.trim().split(';');
      const quality = parseFloat(q.replace('q=', ''));
      return { locale: locale.trim(), quality };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { locale } of locales) {
    const { language } = parseLocale(locale);
    if (SUPPORTED_LANGUAGES.includes(language)) {
      return locale;
    }
  }

  return null;
}

/**
 * Parse cookies from header string
 * @param {string} cookieHeader
 * @returns {Object}
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name && rest.length > 0) {
      cookies[name] = rest.join('=');
    }
  });

  return cookies;
}

/**
 * Check if locale is valid
 * @param {string} locale
 * @returns {boolean}
 */
function isValidLocale(locale) {
  const { language } = parseLocale(locale);
  return SUPPORTED_LANGUAGES.includes(language);
}

/**
 * Normalize locale to supported format
 * @param {string} locale
 * @returns {string}
 */
function normalizeLocale(locale) {
  const { language, country } = parseLocale(locale);

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return DEFAULT_LOCALE;
  }

  const fullLocale = buildLocale(language, country);

  if (SUPPORTED_LOCALES.includes(fullLocale)) {
    return fullLocale;
  }

  // Return language default
  return buildLocale(language, LANGUAGE_COUNTRY_MAP[language]);
}

// ==========================================
// SERVER I18N CLASS
// ==========================================

class ServerI18n {
  constructor(locale) {
    this.locale = locale;
    const { language, country } = parseLocale(locale);
    this.language = language;
    this.country = country;
  }

  /**
   * Translate a key with interpolation
   *
   * @param {string} key - Translation key
   * @param {Object} variables - Interpolation variables
   * @returns {string}
   */
  t(key, variables = {}) {
    const entry = SERVER_TRANSLATIONS[key];

    if (!entry) {
      console.warn(`[Server i18n] Missing translation: ${key}`);
      return key;
    }

    // Try locale-specific (e.g., en_US for en-US)
    let translation =
      entry[`${this.language}_${this.country}`] ||
      entry[this.language] ||
      entry.en ||
      key;

    // Interpolate variables
    if (Object.keys(variables).length > 0) {
      translation = translation.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return varName in variables ? variables[varName] : match;
      });
    }

    return translation;
  }

  /**
   * Format currency
   * @param {number} amount
   * @param {string} currency
   * @returns {string}
   */
  formatCurrency(amount, currency = 'EUR') {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '—';
    }

    try {
      return new Intl.NumberFormat(this.locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (e) {
      return `${currency} ${amount.toFixed(2)}`;
    }
  }

  /**
   * Format date
   * @param {Date|string|number} date
   * @param {string} style
   * @returns {string}
   */
  formatDate(date, style = 'medium') {
    if (!date) return '—';

    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return '—';

    const styles = {
      short: { year: 'numeric', month: 'numeric', day: 'numeric' },
      medium: { year: 'numeric', month: 'short', day: 'numeric' },
      long: { year: 'numeric', month: 'long', day: 'numeric' },
      full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
    };

    try {
      return new Intl.DateTimeFormat(this.locale, styles[style] || styles.medium).format(dateObj);
    } catch (e) {
      return dateObj.toLocaleDateString();
    }
  }

  /**
   * Format number
   * @param {number} number
   * @param {Object} options
   * @returns {string}
   */
  formatNumber(number, options = {}) {
    if (number === null || number === undefined || isNaN(number)) {
      return '—';
    }

    try {
      return new Intl.NumberFormat(this.locale, options).format(number);
    } catch (e) {
      return number.toString();
    }
  }
}

/**
 * Get a server i18n instance for a locale
 *
 * @param {string} locale
 * @returns {ServerI18n}
 */
export function getServerI18n(locale = DEFAULT_LOCALE) {
  return new ServerI18n(locale);
}

/**
 * Convenience function: resolve locale from event and return i18n instance
 *
 * @param {Object} event - Netlify Function event
 * @param {Object} options
 * @returns {ServerI18n}
 */
export function getI18nForRequest(event, options = {}) {
  const locale = resolveLocaleFromRequest(event, options);
  return new ServerI18n(locale);
}

// ==========================================
// ERROR CODE MAPPING
// ==========================================

/**
 * Map of error codes to i18n keys
 * Use this to return consistent, localized error messages
 */
export const ERROR_CODES = {
  // Generic
  GENERIC_ERROR: 'errors.generic',
  NOT_FOUND: 'errors.notFound',
  UNAUTHORIZED: 'errors.unauthorized',
  FORBIDDEN: 'errors.forbidden',
  INVALID_SESSION: 'errors.invalidSession',
  VALIDATION_ERROR: 'errors.validation',
  RATE_LIMITED: 'errors.rateLimited',

  // Auth
  INVALID_CREDENTIALS: 'auth.invalidCredentials',
  EMAIL_EXISTS: 'auth.emailExists',
  ACCOUNT_BANNED: 'auth.accountBanned',

  // Trip
  TRIP_NOT_FOUND: 'trips.notFound',
  TRIP_NOT_OWNER: 'trips.notOwner',
  ONLY_TRAVELLERS: 'trips.onlyTravellers',

  // Request
  REQUEST_NOT_FOUND: 'requests.notFound',

  // Wallet
  INSUFFICIENT_FUNDS: 'wallet.insufficientFunds',
  MINIMUM_PAYOUT: 'wallet.minimumPayout',
};

/**
 * Get localized error message from error code
 *
 * @param {string} code - Error code
 * @param {ServerI18n} i18n - i18n instance
 * @param {Object} variables - Interpolation variables
 * @returns {string}
 */
export function getLocalizedError(code, i18n, variables = {}) {
  const key = ERROR_CODES[code] || 'errors.generic';
  return i18n.t(key, variables);
}

export default {
  resolveLocaleFromRequest,
  getServerI18n,
  getI18nForRequest,
  getLocalizedError,
  ERROR_CODES,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
};
