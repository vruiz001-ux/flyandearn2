/**
 * FlyAndEarn - Domain Glossary & Terminology
 *
 * This file contains locale-specific terminology for consistent translation
 * of domain-specific terms. It ensures that:
 *
 * 1. The same term is always translated the same way within a locale
 * 2. Country-specific variations are handled (e.g., US vs UK English)
 * 3. Contextually appropriate wording is used (not literal translations)
 *
 * TRANSLATOR NOTES are included for each term to guide translators.
 */

/**
 * GLOSSARY
 *
 * Structure:
 * {
 *   termKey: {
 *     note: "Translator note explaining context and usage",
 *     translations: {
 *       'en-GB': 'Term',
 *       'en-US': 'Term (US variant)',
 *       'fr-FR': 'Terme',
 *       ...
 *     }
 *   }
 * }
 */
export const GLOSSARY = {
  // ==========================================
  // USER ROLES
  // ==========================================
  traveller: {
    note: 'A user who travels and can purchase duty-free goods for others. In US English, spelled "traveler" (one L). This is the person doing the shopping service.',
    translations: {
      'en-GB': 'Traveller',
      'en-US': 'Traveler',
      'fr-FR': 'Voyageur',
      'fr-CH': 'Voyageur',
      'pl-PL': 'Podróżny',
      'de-DE': 'Reisender',
      'de-CH': 'Reisender',
      'de-AT': 'Reisender',
    },
  },

  travellerPlural: {
    note: 'Plural form of traveller.',
    translations: {
      'en-GB': 'Travellers',
      'en-US': 'Travelers',
      'fr-FR': 'Voyageurs',
      'fr-CH': 'Voyageurs',
      'pl-PL': 'Podróżni',
      'de-DE': 'Reisende',
      'de-CH': 'Reisende',
      'de-AT': 'Reisende',
    },
  },

  buyer: {
    note: 'A user who requests duty-free goods to be purchased. Also called "requestor" in some contexts. They pay for goods + service fee.',
    translations: {
      'en-GB': 'Buyer',
      'en-US': 'Buyer',
      'fr-FR': 'Acheteur',
      'fr-CH': 'Acheteur',
      'pl-PL': 'Kupujący',
      'de-DE': 'Käufer',
      'de-CH': 'Käufer',
      'de-AT': 'Käufer',
    },
  },

  requestor: {
    note: 'Alternative term for buyer - the person making a request for goods.',
    translations: {
      'en-GB': 'Requestor',
      'en-US': 'Requester',
      'fr-FR': 'Demandeur',
      'fr-CH': 'Demandeur',
      'pl-PL': 'Wnioskodawca',
      'de-DE': 'Antragsteller',
      'de-CH': 'Antragsteller',
      'de-AT': 'Antragsteller',
    },
  },

  shopper: {
    note: 'Informal/friendly term for traveller when emphasizing the shopping service aspect.',
    translations: {
      'en-GB': 'Shopper',
      'en-US': 'Shopper',
      'fr-FR': 'Acheteur personnel',
      'fr-CH': 'Acheteur personnel',
      'pl-PL': 'Kupujący',
      'de-DE': 'Einkäufer',
      'de-CH': 'Einkäufer',
      'de-AT': 'Einkäufer',
    },
  },

  // ==========================================
  // DUTY-FREE CONCEPTS
  // ==========================================
  dutyFree: {
    note: 'Tax-exempt goods purchased at airports/borders. Keep hyphenated. In some locales (especially non-EU), this concept may be less familiar - use "tax-free airport shopping" as clarification if needed.',
    translations: {
      'en-GB': 'Duty-free',
      'en-US': 'Duty-free',
      'fr-FR': 'Duty-free',
      'fr-CH': 'Duty-free',
      'pl-PL': 'Duty-free',
      'de-DE': 'Duty-free',
      'de-CH': 'Zollfrei',
      'de-AT': 'Duty-free',
    },
  },

  dutyFreeShop: {
    note: 'Physical store at airport/border selling duty-free goods.',
    translations: {
      'en-GB': 'Duty-free shop',
      'en-US': 'Duty-free store',
      'fr-FR': 'Boutique duty-free',
      'fr-CH': 'Boutique duty-free',
      'pl-PL': 'Sklep duty-free',
      'de-DE': 'Duty-free-Shop',
      'de-CH': 'Duty-free-Laden',
      'de-AT': 'Duty-free-Shop',
    },
  },

  dutyFreeAllowance: {
    note: 'Personal customs allowance for bringing goods across borders without paying duty. This is a legal quota, not a discount.',
    translations: {
      'en-GB': 'Duty-free allowance',
      'en-US': 'Duty-free allowance',
      'fr-FR': 'Franchise douanière',
      'fr-CH': 'Franchise douanière',
      'pl-PL': 'Limit duty-free',
      'de-DE': 'Zollfreimenge',
      'de-CH': 'Zollfreimenge',
      'de-AT': 'Zollfreimenge',
    },
  },

  outsideDutyFree: {
    note: 'Shopping done in regular retail stores (not airport duty-free). Translate as "regular stores" or "non-airport shops" - avoid literal translation.',
    translations: {
      'en-GB': 'Regular store shopping',
      'en-US': 'Retail store shopping',
      'fr-FR': 'Achats en magasin',
      'fr-CH': 'Achats en magasin',
      'pl-PL': 'Zakupy w sklepach detalicznych',
      'de-DE': 'Einkäufe im Einzelhandel',
      'de-CH': 'Einkäufe im Detailhandel',
      'de-AT': 'Einkäufe im Einzelhandel',
    },
  },

  outsideDutyFreeBadge: {
    note: 'Badge shown on traveller profile indicating willingness to shop in regular stores.',
    translations: {
      'en-GB': 'Shops in regular stores',
      'en-US': 'Shops in retail stores',
      'fr-FR': 'Achète en magasin',
      'fr-CH': 'Achète en magasin',
      'pl-PL': 'Robi zakupy w sklepach',
      'de-DE': 'Kauft im Einzelhandel ein',
      'de-CH': 'Kauft im Detailhandel ein',
      'de-AT': 'Kauft im Einzelhandel ein',
    },
  },

  taxFree: {
    note: 'Similar to duty-free but emphasizes tax exemption. Used in some countries instead of duty-free.',
    translations: {
      'en-GB': 'Tax-free',
      'en-US': 'Tax-free',
      'fr-FR': 'Hors taxes',
      'fr-CH': 'Hors taxes',
      'pl-PL': 'Bez podatku',
      'de-DE': 'Steuerfrei',
      'de-CH': 'Steuerfrei',
      'de-AT': 'Steuerfrei',
    },
  },

  // ==========================================
  // FINANCIAL TERMS
  // ==========================================
  serviceFee: {
    note: 'Fee paid to traveller for their shopping service. NOT a sales commission - this is payment for the service of shopping and delivery.',
    translations: {
      'en-GB': 'Service fee',
      'en-US': 'Service fee',
      'fr-FR': 'Frais de service',
      'fr-CH': 'Frais de service',
      'pl-PL': 'Opłata za usługę',
      'de-DE': 'Servicegebühr',
      'de-CH': 'Servicegebühr',
      'de-AT': 'Servicegebühr',
    },
  },

  platformFee: {
    note: 'Fee charged by FlyAndEarn platform (5% of goods value). Keep this distinct from service fee.',
    translations: {
      'en-GB': 'Platform fee',
      'en-US': 'Platform fee',
      'fr-FR': 'Frais de plateforme',
      'fr-CH': 'Frais de plateforme',
      'pl-PL': 'Opłata platformy',
      'de-DE': 'Plattformgebühr',
      'de-CH': 'Plattformgebühr',
      'de-AT': 'Plattformgebühr',
    },
  },

  earnings: {
    note: 'Money earned by travellers from service fees. Use a term that implies income/profit.',
    translations: {
      'en-GB': 'Earnings',
      'en-US': 'Earnings',
      'fr-FR': 'Gains',
      'fr-CH': 'Gains',
      'pl-PL': 'Zarobki',
      'de-DE': 'Verdienst',
      'de-CH': 'Verdienst',
      'de-AT': 'Verdienst',
    },
  },

  payout: {
    note: 'Transfer of earnings from wallet to bank account.',
    translations: {
      'en-GB': 'Payout',
      'en-US': 'Payout',
      'fr-FR': 'Versement',
      'fr-CH': 'Versement',
      'pl-PL': 'Wypłata',
      'de-DE': 'Auszahlung',
      'de-CH': 'Auszahlung',
      'de-AT': 'Auszahlung',
    },
  },

  deposit: {
    note: 'Upfront payment (€20) made by buyer when request is accepted. Held in escrow.',
    translations: {
      'en-GB': 'Deposit',
      'en-US': 'Deposit',
      'fr-FR': 'Acompte',
      'fr-CH': 'Acompte',
      'pl-PL': 'Kaucja',
      'de-DE': 'Anzahlung',
      'de-CH': 'Anzahlung',
      'de-AT': 'Anzahlung',
    },
  },

  escrow: {
    note: 'Funds held securely until order completion. Use a term that implies safety/security.',
    translations: {
      'en-GB': 'Held securely',
      'en-US': 'Held in escrow',
      'fr-FR': 'En séquestre',
      'fr-CH': 'En séquestre',
      'pl-PL': 'Depozyt zabezpieczający',
      'de-DE': 'Treuhänderisch verwahrt',
      'de-CH': 'Treuhänderisch verwahrt',
      'de-AT': 'Treuhänderisch verwahrt',
    },
  },

  wallet: {
    note: 'Digital wallet within the platform for managing earnings/balance.',
    translations: {
      'en-GB': 'Wallet',
      'en-US': 'Wallet',
      'fr-FR': 'Portefeuille',
      'fr-CH': 'Portefeuille',
      'pl-PL': 'Portfel',
      'de-DE': 'Geldbörse',
      'de-CH': 'Portemonnaie',
      'de-AT': 'Geldbörse',
    },
  },

  balance: {
    note: 'Available balance in wallet.',
    translations: {
      'en-GB': 'Balance',
      'en-US': 'Balance',
      'fr-FR': 'Solde',
      'fr-CH': 'Solde',
      'pl-PL': 'Saldo',
      'de-DE': 'Guthaben',
      'de-CH': 'Guthaben',
      'de-AT': 'Guthaben',
    },
  },

  // ==========================================
  // TRIP & REQUEST TERMS
  // ==========================================
  trip: {
    note: 'A traveller\'s journey from one airport to another.',
    translations: {
      'en-GB': 'Trip',
      'en-US': 'Trip',
      'fr-FR': 'Voyage',
      'fr-CH': 'Voyage',
      'pl-PL': 'Podróż',
      'de-DE': 'Reise',
      'de-CH': 'Reise',
      'de-AT': 'Reise',
    },
  },

  request: {
    note: 'A buyer\'s request for specific goods to be purchased.',
    translations: {
      'en-GB': 'Request',
      'en-US': 'Request',
      'fr-FR': 'Demande',
      'fr-CH': 'Demande',
      'pl-PL': 'Zapytanie',
      'de-DE': 'Anfrage',
      'de-CH': 'Anfrage',
      'de-AT': 'Anfrage',
    },
  },

  offer: {
    note: 'When a traveller offers to fulfill a buyer\'s request.',
    translations: {
      'en-GB': 'Offer',
      'en-US': 'Offer',
      'fr-FR': 'Offre',
      'fr-CH': 'Offre',
      'pl-PL': 'Oferta',
      'de-DE': 'Angebot',
      'de-CH': 'Angebot',
      'de-AT': 'Angebot',
    },
  },

  order: {
    note: 'A confirmed transaction between buyer and traveller.',
    translations: {
      'en-GB': 'Order',
      'en-US': 'Order',
      'fr-FR': 'Commande',
      'fr-CH': 'Commande',
      'pl-PL': 'Zamówienie',
      'de-DE': 'Bestellung',
      'de-CH': 'Bestellung',
      'de-AT': 'Bestellung',
    },
  },

  delivery: {
    note: 'Handover of goods from traveller to buyer (in-person meeting).',
    translations: {
      'en-GB': 'Delivery',
      'en-US': 'Delivery',
      'fr-FR': 'Livraison',
      'fr-CH': 'Livraison',
      'pl-PL': 'Dostawa',
      'de-DE': 'Lieferung',
      'de-CH': 'Lieferung',
      'de-AT': 'Lieferung',
    },
  },

  handover: {
    note: 'In-person meeting point for goods exchange. More accurate than "delivery" for peer-to-peer.',
    translations: {
      'en-GB': 'Handover',
      'en-US': 'Pickup',
      'fr-FR': 'Remise',
      'fr-CH': 'Remise',
      'pl-PL': 'Przekazanie',
      'de-DE': 'Übergabe',
      'de-CH': 'Übergabe',
      'de-AT': 'Übergabe',
    },
  },

  // ==========================================
  // STATUS TERMS
  // ==========================================
  statusOpen: {
    note: 'Request is open and waiting for traveller offers.',
    translations: {
      'en-GB': 'Open',
      'en-US': 'Open',
      'fr-FR': 'Ouvert',
      'fr-CH': 'Ouvert',
      'pl-PL': 'Otwarte',
      'de-DE': 'Offen',
      'de-CH': 'Offen',
      'de-AT': 'Offen',
    },
  },

  statusMatched: {
    note: 'Request has been matched with a traveller.',
    translations: {
      'en-GB': 'Matched',
      'en-US': 'Matched',
      'fr-FR': 'Accepté',
      'fr-CH': 'Accepté',
      'pl-PL': 'Dopasowane',
      'de-DE': 'Zugeordnet',
      'de-CH': 'Zugeordnet',
      'de-AT': 'Zugeordnet',
    },
  },

  statusInProgress: {
    note: 'Traveller is shopping/traveling with the goods.',
    translations: {
      'en-GB': 'In progress',
      'en-US': 'In progress',
      'fr-FR': 'En cours',
      'fr-CH': 'En cours',
      'pl-PL': 'W trakcie',
      'de-DE': 'In Bearbeitung',
      'de-CH': 'In Bearbeitung',
      'de-AT': 'In Bearbeitung',
    },
  },

  statusCompleted: {
    note: 'Order completed and delivered.',
    translations: {
      'en-GB': 'Completed',
      'en-US': 'Completed',
      'fr-FR': 'Terminé',
      'fr-CH': 'Terminé',
      'pl-PL': 'Zakończone',
      'de-DE': 'Abgeschlossen',
      'de-CH': 'Abgeschlossen',
      'de-AT': 'Abgeschlossen',
    },
  },

  statusCancelled: {
    note: 'Order was cancelled.',
    translations: {
      'en-GB': 'Cancelled',
      'en-US': 'Canceled',
      'fr-FR': 'Annulé',
      'fr-CH': 'Annulé',
      'pl-PL': 'Anulowane',
      'de-DE': 'Storniert',
      'de-CH': 'Storniert',
      'de-AT': 'Storniert',
    },
  },

  // ==========================================
  // ADDRESS TERMS (Country-specific)
  // ==========================================
  postalCode: {
    note: 'Postal/ZIP code. US uses "ZIP code", UK uses "postcode", others use "postal code".',
    translations: {
      'en-GB': 'Postcode',
      'en-US': 'ZIP code',
      'fr-FR': 'Code postal',
      'fr-CH': 'Code postal',
      'pl-PL': 'Kod pocztowy',
      'de-DE': 'Postleitzahl',
      'de-CH': 'Postleitzahl',
      'de-AT': 'Postleitzahl',
    },
  },

  state: {
    note: 'State/Province/Region. Primarily used in US. In other countries, may be region/province or omitted.',
    translations: {
      'en-GB': 'County',
      'en-US': 'State',
      'fr-FR': 'Région',
      'fr-CH': 'Canton',
      'pl-PL': 'Województwo',
      'de-DE': 'Bundesland',
      'de-CH': 'Kanton',
      'de-AT': 'Bundesland',
    },
  },

  // ==========================================
  // LEGAL/COMPLIANCE
  // ==========================================
  customsAllowance: {
    note: 'Legal limits for bringing goods across borders. Emphasize this is a legal personal limit.',
    translations: {
      'en-GB': 'Customs allowance',
      'en-US': 'Customs allowance',
      'fr-FR': 'Franchise douanière',
      'fr-CH': 'Franchise douanière',
      'pl-PL': 'Limit celny',
      'de-DE': 'Zollfreimenge',
      'de-CH': 'Zollfreimenge',
      'de-AT': 'Zollfreimenge',
    },
  },

  personalImport: {
    note: 'Goods brought in for personal use (not commercial). Important for legal compliance.',
    translations: {
      'en-GB': 'Personal import',
      'en-US': 'Personal import',
      'fr-FR': 'Importation personnelle',
      'fr-CH': 'Importation personnelle',
      'pl-PL': 'Import osobisty',
      'de-DE': 'Persönliche Einfuhr',
      'de-CH': 'Persönliche Einfuhr',
      'de-AT': 'Persönliche Einfuhr',
    },
  },

  termsOfService: {
    note: 'Legal terms and conditions.',
    translations: {
      'en-GB': 'Terms of Service',
      'en-US': 'Terms of Service',
      'fr-FR': 'Conditions d\'utilisation',
      'fr-CH': 'Conditions d\'utilisation',
      'pl-PL': 'Regulamin',
      'de-DE': 'Nutzungsbedingungen',
      'de-CH': 'Nutzungsbedingungen',
      'de-AT': 'Nutzungsbedingungen',
    },
  },

  privacyPolicy: {
    note: 'Data privacy policy.',
    translations: {
      'en-GB': 'Privacy Policy',
      'en-US': 'Privacy Policy',
      'fr-FR': 'Politique de confidentialité',
      'fr-CH': 'Politique de confidentialité',
      'pl-PL': 'Polityka prywatności',
      'de-DE': 'Datenschutzerklärung',
      'de-CH': 'Datenschutzerklärung',
      'de-AT': 'Datenschutzerklärung',
    },
  },
};

/**
 * Get a glossary term for a specific locale
 *
 * @param {string} term - Glossary key (e.g., 'traveller', 'dutyFree')
 * @param {string} locale - BCP 47 locale (e.g., 'en-GB', 'fr-FR')
 * @returns {string} The localized term
 */
export function getGlossaryTerm(term, locale = 'en-GB') {
  const entry = GLOSSARY[term];

  if (!entry) {
    console.warn(`[Glossary] Unknown term: ${term}`);
    return term;
  }

  // Try exact locale match
  if (entry.translations[locale]) {
    return entry.translations[locale];
  }

  // Try language-only fallback
  const language = locale.split('-')[0];
  const languageFallback = Object.keys(entry.translations).find(
    (loc) => loc.startsWith(language + '-')
  );

  if (languageFallback) {
    return entry.translations[languageFallback];
  }

  // Default to en-GB
  return entry.translations['en-GB'] || term;
}

/**
 * Get translator note for a term
 *
 * @param {string} term
 * @returns {string|null}
 */
export function getTranslatorNote(term) {
  return GLOSSARY[term]?.note || null;
}

/**
 * Get all glossary terms for a locale (for translation export)
 *
 * @param {string} locale
 * @returns {Object}
 */
export function getGlossaryForLocale(locale) {
  const result = {};

  for (const [key, entry] of Object.entries(GLOSSARY)) {
    result[key] = getGlossaryTerm(key, locale);
  }

  return result;
}

/**
 * Export glossary with notes for translators
 *
 * @returns {Object}
 */
export function exportGlossaryWithNotes() {
  return Object.entries(GLOSSARY).map(([key, entry]) => ({
    key,
    note: entry.note,
    translations: entry.translations,
  }));
}

export default GLOSSARY;
