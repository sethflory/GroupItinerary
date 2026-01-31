// ========================================
// FLAG UTILITIES
// Cross-browser country flag support
// ========================================

/**
 * Country mapping: location names to ISO 3166-1 alpha-2 codes
 */
const COUNTRY_CODES = {
  // Greece
  'athens': 'GR',
  'greece': 'GR',
  'santorini': 'GR',
  'mykonos': 'GR',
  'crete': 'GR',
  'thessaloniki': 'GR',

  // India
  'bangalore': 'IN',
  'india': 'IN',
  'delhi': 'IN',
  'mumbai': 'IN',
  'chennai': 'IN',
  'kolkata': 'IN',
  'hyderabad': 'IN',
  'goa': 'IN',
  'jaipur': 'IN',
  'agra': 'IN',

  // Dubai/UAE
  'dubai': 'AE',
  'uae': 'AE',
  'abu dhabi': 'AE',

  // Common destinations
  'usa': 'US',
  'united states': 'US',
  'new york': 'US',
  'los angeles': 'US',
  'san francisco': 'US',
  'miami': 'US',
  'las vegas': 'US',
  'chicago': 'US',

  'uk': 'GB',
  'united kingdom': 'GB',
  'london': 'GB',
  'england': 'GB',

  'france': 'FR',
  'paris': 'FR',
  'nice': 'FR',

  'italy': 'IT',
  'rome': 'IT',
  'milan': 'IT',
  'venice': 'IT',
  'florence': 'IT',

  'spain': 'ES',
  'madrid': 'ES',
  'barcelona': 'ES',

  'germany': 'DE',
  'berlin': 'DE',
  'munich': 'DE',

  'japan': 'JP',
  'tokyo': 'JP',
  'osaka': 'JP',
  'kyoto': 'JP',

  'thailand': 'TH',
  'bangkok': 'TH',
  'phuket': 'TH',

  'singapore': 'SG',

  'australia': 'AU',
  'sydney': 'AU',
  'melbourne': 'AU',

  'portugal': 'PT',
  'lisbon': 'PT',

  'netherlands': 'NL',
  'amsterdam': 'NL',

  'switzerland': 'CH',
  'zurich': 'CH',
  'geneva': 'CH',

  'turkey': 'TR',
  'istanbul': 'TR',

  'egypt': 'EG',
  'cairo': 'EG',

  'mexico': 'MX',
  'cancun': 'MX',

  'brazil': 'BR',
  'rio': 'BR',
  'sao paulo': 'BR'
};

/**
 * Get country code from location string
 * @param {string} location - Location name
 * @returns {string|null} ISO country code or null
 */
export function getCountryCode(location) {
  if (!location) return null;

  const normalized = location.toLowerCase().trim();

  for (const [key, code] of Object.entries(COUNTRY_CODES)) {
    if (normalized.includes(key)) {
      return code;
    }
  }

  return null;
}

/**
 * Get flag image URL for a country code
 * Uses flagcdn.com for reliable SVG flags
 * @param {string} countryCode - ISO 3166-1 alpha-2 code
 * @param {number} width - Image width (default 24)
 * @returns {string} Flag image URL
 */
export function getFlagUrl(countryCode, width = 24) {
  if (!countryCode) return null;
  return `https://flagcdn.com/w${width}/${countryCode.toLowerCase()}.png`;
}

/**
 * Get flag HTML element for a location
 * @param {string} location - Location name
 * @param {object} options - Configuration options
 * @param {number} options.size - Image size (default 20)
 * @param {string} options.className - Additional CSS class
 * @param {string} options.fallback - Fallback text if no flag found
 * @returns {string} HTML string for flag image or fallback
 */
export function getFlagHtml(location, options = {}) {
  const { size = 20, className = '', fallback = '📍' } = options;

  const countryCode = getCountryCode(location);

  if (!countryCode) {
    return `<span class="flag-fallback ${className}">${fallback}</span>`;
  }

  const url = getFlagUrl(countryCode, size * 2); // 2x for retina
  const alt = `${countryCode} flag`;

  return `<img src="${url}" alt="${alt}" class="country-flag ${className}" width="${size}" height="${Math.round(size * 0.75)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"><span class="flag-fallback" style="display:none">${countryCode}</span>`;
}

/**
 * Get flag element (DOM) for a location
 * @param {string} location - Location name
 * @param {object} options - Configuration options
 * @returns {HTMLElement} Flag image element or fallback span
 */
export function createFlagElement(location, options = {}) {
  const { size = 20, className = '', fallback = '📍' } = options;

  const countryCode = getCountryCode(location);

  if (!countryCode) {
    const span = document.createElement('span');
    span.className = `flag-fallback ${className}`;
    span.textContent = fallback;
    return span;
  }

  const container = document.createElement('span');
  container.className = `flag-container ${className}`;

  const img = document.createElement('img');
  img.src = getFlagUrl(countryCode, size * 2);
  img.alt = `${countryCode} flag`;
  img.className = 'country-flag';
  img.width = size;
  img.height = Math.round(size * 0.75);
  img.loading = 'lazy';

  // Fallback on error
  const fallbackSpan = document.createElement('span');
  fallbackSpan.className = 'flag-fallback';
  fallbackSpan.textContent = countryCode;
  fallbackSpan.style.display = 'none';

  img.onerror = () => {
    img.style.display = 'none';
    fallbackSpan.style.display = 'inline';
  };

  container.appendChild(img);
  container.appendChild(fallbackSpan);

  return container;
}

/**
 * Replace emoji flags in an element with image flags
 * @param {HTMLElement} container - Container to search within
 */
export function replaceEmojiFlags(container) {
  // Common flag emojis to replace
  const flagEmojis = {
    '🇬🇷': 'GR',
    '🇮🇳': 'IN',
    '🇦🇪': 'AE',
    '🇺🇸': 'US',
    '🇬🇧': 'GB',
    '🇫🇷': 'FR',
    '🇮🇹': 'IT',
    '🇪🇸': 'ES',
    '🇩🇪': 'DE',
    '🇯🇵': 'JP',
    '🇹🇭': 'TH',
    '🇸🇬': 'SG',
    '🇦🇺': 'AU'
  };

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const nodesToReplace = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    for (const [emoji, code] of Object.entries(flagEmojis)) {
      if (node.textContent.includes(emoji)) {
        nodesToReplace.push({ node, emoji, code });
        break;
      }
    }
  }

  nodesToReplace.forEach(({ node, emoji, code }) => {
    const parts = node.textContent.split(emoji);
    const parent = node.parentNode;

    const fragment = document.createDocumentFragment();
    parts.forEach((part, i) => {
      if (part) {
        fragment.appendChild(document.createTextNode(part));
      }
      if (i < parts.length - 1) {
        const img = document.createElement('img');
        img.src = getFlagUrl(code, 40);
        img.alt = `${code} flag`;
        img.className = 'country-flag';
        img.width = 20;
        img.height = 15;
        fragment.appendChild(img);
      }
    });

    parent.replaceChild(fragment, node);
  });
}
