/**
 * FlyAndEarn Duty-Free Savings Calculator
 * Embeddable widget for flyandearn.eu
 *
 * Usage:
 * <div id="flyandearn-calculator"></div>
 * <script src="flyandearn-calculator.js"></script>
 */

(function() {
  'use strict';

  // Use local Netlify function as proxy
  const API_BASE = window.FAE_API_BASE || '';

  const CURRENCIES = [
    { value: 'EUR', symbol: '€', label: 'EUR' },
    { value: 'USD', symbol: '$', label: 'USD' },
    { value: 'GBP', symbol: '£', label: 'GBP' },
    { value: 'AED', symbol: 'د.إ', label: 'AED' },
    { value: 'SGD', symbol: 'S$', label: 'SGD' },
    { value: 'PLN', symbol: 'zł', label: 'PLN' },
    { value: 'CHF', symbol: 'Fr', label: 'CHF' },
  ];

  const REGIONS = [
    { value: 'all', label: 'All Regions' },
    { value: 'europe', label: 'Europe' },
    { value: 'asia', label: 'Asia' },
    { value: 'middle_east', label: 'Middle East' },
  ];

  function formatPrice(price, currency) {
    const curr = CURRENCIES.find(c => c.value === currency);
    return `${curr?.symbol || currency}${price.toFixed(2)}`;
  }

  function createCalculator(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('FlyAndEarn Calculator: Container not found:', containerId);
      return;
    }

    // Inject styles
    const styleId = 'fae-calculator-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .fae-calc {
          --fae-bg: #18181b;
          --fae-bg-secondary: #111113;
          --fae-border: rgba(255,255,255,0.1);
          --fae-text: #fafafa;
          --fae-text-muted: #a1a1aa;
          --fae-gold: #d4a853;
          --fae-gold-light: #e8c878;
          --fae-teal: #2dd4bf;
          --fae-radius: 16px;
          --fae-radius-sm: 10px;

          font-family: 'Outfit', system-ui, -apple-system, sans-serif;
          background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--fae-bg);
          border: 1px solid var(--fae-border);
          border-radius: var(--fae-radius);
          padding: 2rem;
          color: var(--fae-text);
          max-width: 100%;
          box-sizing: border-box;
        }

        .fae-calc *, .fae-calc *::before, .fae-calc *::after {
          box-sizing: border-box;
        }

        .fae-calc-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .fae-calc-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.75rem;
          font-weight: 600;
          margin: 0 0 0.5rem;
          background: linear-gradient(135deg, var(--fae-gold) 0%, var(--fae-gold-light) 50%, var(--fae-gold) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .fae-calc-subtitle {
          font-size: 0.9rem;
          color: var(--fae-text-muted);
          margin: 0;
        }

        .fae-calc-filters {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .fae-calc-field {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .fae-calc-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--fae-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .fae-calc-select,
        .fae-calc-input {
          width: 100%;
          padding: 0.75rem 1rem;
          font-size: 0.9rem;
          font-family: inherit;
          color: var(--fae-text);
          background: var(--fae-bg-secondary);
          border: 1px solid var(--fae-border);
          border-radius: var(--fae-radius-sm);
          transition: border-color 0.2s, box-shadow 0.2s;
          -webkit-appearance: none;
          appearance: none;
        }

        .fae-calc-select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          padding-right: 2.5rem;
          cursor: pointer;
        }

        .fae-calc-select option {
          background: var(--fae-bg);
          color: var(--fae-text);
        }

        .fae-calc-select:focus,
        .fae-calc-input:focus {
          outline: none;
          border-color: var(--fae-gold);
          box-shadow: 0 0 0 3px rgba(212, 168, 83, 0.15);
        }

        .fae-calc-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background: var(--fae-bg-secondary);
          border: 1px solid var(--fae-border);
          border-radius: var(--fae-radius-sm);
          margin-bottom: 1.25rem;
        }

        .fae-calc-toggle-info {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }

        .fae-calc-toggle-label {
          font-size: 0.875rem;
          font-weight: 500;
        }

        .fae-calc-badge {
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          background: linear-gradient(135deg, var(--fae-teal), #14b8a6);
          color: #0a0a0b;
        }

        .fae-calc-badge[data-mode="live"] {
          background: linear-gradient(135deg, var(--fae-gold), var(--fae-gold-light));
        }

        .fae-calc-toggle {
          position: relative;
          width: 48px;
          height: 26px;
          background: rgba(255,255,255,0.1);
          border: none;
          border-radius: 26px;
          cursor: pointer;
          transition: background 0.2s;
          padding: 0;
        }

        .fae-calc-toggle[aria-checked="true"] {
          background: linear-gradient(135deg, var(--fae-teal), #14b8a6);
        }

        .fae-calc-toggle-thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .fae-calc-toggle[aria-checked="true"] .fae-calc-toggle-thumb {
          transform: translateX(22px);
        }

        .fae-calc-search-section {
          margin-bottom: 1.25rem;
        }

        .fae-calc-section-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.625rem;
        }

        .fae-calc-section-title {
          font-size: 0.9rem;
          font-weight: 600;
        }

        .fae-calc-region-tag {
          font-size: 0.625rem;
          font-weight: 600;
          text-transform: uppercase;
          padding: 0.25rem 0.625rem;
          border-radius: 4px;
          background: rgba(255,255,255,0.1);
          color: var(--fae-text-muted);
        }

        .fae-calc-region-tag[data-region="europe"] {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }

        .fae-calc-region-tag[data-region="asia"] {
          background: rgba(251, 191, 36, 0.2);
          color: #fbbf24;
        }

        .fae-calc-region-tag[data-region="middle_east"] {
          background: rgba(244, 114, 182, 0.2);
          color: #f472b6;
        }

        .fae-calc-search-wrap {
          position: relative;
        }

        .fae-calc-search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          color: var(--fae-text-muted);
          pointer-events: none;
        }

        .fae-calc-search-input {
          width: 100%;
          padding: 0.875rem 1rem 0.875rem 2.75rem;
          font-size: 0.9rem;
          font-family: inherit;
          color: var(--fae-text);
          background: var(--fae-bg-secondary);
          border: 1px solid var(--fae-border);
          border-radius: var(--fae-radius-sm);
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .fae-calc-search-input::placeholder {
          color: var(--fae-text-muted);
        }

        .fae-calc-search-input:focus {
          outline: none;
          border-color: var(--fae-gold);
          box-shadow: 0 0 0 3px rgba(212, 168, 83, 0.15);
        }

        .fae-calc-results {
          max-height: 280px;
          overflow-y: auto;
          margin-bottom: 1rem;
        }

        .fae-calc-results::-webkit-scrollbar {
          width: 6px;
        }

        .fae-calc-results::-webkit-scrollbar-track {
          background: var(--fae-bg-secondary);
          border-radius: 3px;
        }

        .fae-calc-results::-webkit-scrollbar-thumb {
          background: var(--fae-border);
          border-radius: 3px;
        }

        .fae-calc-result {
          display: block;
          width: 100%;
          text-align: left;
          padding: 1rem;
          margin-bottom: 0.5rem;
          background: var(--fae-bg-secondary);
          border: 1px solid var(--fae-border);
          border-radius: var(--fae-radius-sm);
          cursor: pointer;
          font-family: inherit;
          color: var(--fae-text);
          transition: all 0.2s;
        }

        .fae-calc-result:hover {
          border-color: var(--fae-gold);
          transform: translateY(-1px);
        }

        .fae-calc-result.best {
          border-left: 3px solid var(--fae-teal);
          background: linear-gradient(90deg, rgba(45, 212, 191, 0.08), var(--fae-bg-secondary));
        }

        .fae-calc-result-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.375rem;
        }

        .fae-calc-result-name {
          font-weight: 500;
          font-size: 0.875rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 60%;
        }

        .fae-calc-result-price {
          font-weight: 700;
          font-size: 1rem;
          color: var(--fae-gold);
        }

        .fae-calc-result-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: var(--fae-text-muted);
        }

        .fae-calc-best-badge {
          background: var(--fae-teal);
          color: #0a0a0b;
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          font-weight: 700;
          font-size: 0.625rem;
          text-transform: uppercase;
        }

        .fae-calc-confidence {
          font-weight: 500;
        }

        .fae-calc-confidence.high { color: var(--fae-teal); }
        .fae-calc-confidence.medium { color: #fbbf24; }

        .fae-calc-selected {
          background: linear-gradient(135deg, var(--fae-gold) 0%, var(--fae-gold-light) 100%);
          color: #0a0a0b;
          padding: 1.5rem;
          border-radius: var(--fae-radius-sm);
          text-align: center;
          margin-bottom: 1rem;
        }

        .fae-calc-selected-label {
          font-size: 0.75rem;
          opacity: 0.8;
          margin-bottom: 0.25rem;
        }

        .fae-calc-selected-price {
          font-family: 'Playfair Display', serif;
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }

        .fae-calc-selected-store {
          font-size: 0.875rem;
          opacity: 0.9;
        }

        .fae-calc-savings {
          background: linear-gradient(135deg, var(--fae-teal), #14b8a6);
          color: #0a0a0b;
          padding: 1.5rem;
          border-radius: var(--fae-radius-sm);
          text-align: center;
          margin-bottom: 1rem;
        }

        .fae-calc-savings-label {
          font-size: 0.75rem;
          opacity: 0.8;
          margin-bottom: 0.25rem;
        }

        .fae-calc-savings-value {
          font-family: 'Playfair Display', serif;
          font-size: 2.25rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }

        .fae-calc-savings-detail {
          font-size: 0.9rem;
          opacity: 0.9;
        }

        .fae-calc-loading {
          text-align: center;
          padding: 2rem;
          color: var(--fae-text-muted);
        }

        .fae-calc-spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 2px solid var(--fae-border);
          border-top-color: var(--fae-gold);
          border-radius: 50%;
          animation: fae-spin 0.6s linear infinite;
          margin-right: 0.5rem;
        }

        @keyframes fae-spin {
          to { transform: rotate(360deg); }
        }

        .fae-calc-hint {
          background: var(--fae-bg-secondary);
          border: 1px solid var(--fae-border);
          border-radius: var(--fae-radius-sm);
          padding: 0.875rem;
          font-size: 0.8rem;
          color: var(--fae-text-muted);
          margin-bottom: 1rem;
        }

        .fae-calc-hint strong {
          color: var(--fae-text);
        }

        .fae-calc-savings-banner {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: linear-gradient(135deg, rgba(45, 212, 191, 0.15), rgba(45, 212, 191, 0.05));
          border: 1px solid var(--fae-teal);
          border-radius: var(--fae-radius-sm);
          padding: 0.875rem 1rem;
          margin-bottom: 1rem;
        }

        .fae-calc-savings-icon {
          font-size: 1.5rem;
        }

        .fae-calc-savings-text {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          color: var(--fae-text);
          font-size: 0.9rem;
        }

        .fae-calc-savings-text strong {
          color: var(--fae-teal);
        }

        .fae-calc-savings-text .fae-calc-savings-detail {
          font-size: 0.75rem;
          color: var(--fae-text-muted);
        }

        .fae-calc-section-label {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--fae-text-muted);
          margin-bottom: 0.5rem;
          padding-left: 0.25rem;
        }

        .fae-calc-retail-label {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--fae-border);
          color: var(--fae-text-muted);
          opacity: 0.8;
        }

        .fae-calc-retail-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          background: rgba(255,255,255,0.02);
          border-radius: 6px;
          margin-bottom: 0.25rem;
          font-size: 0.8rem;
          color: var(--fae-text-muted);
        }

        .fae-calc-retail-store {
          flex: 1;
        }

        .fae-calc-retail-country {
          font-size: 0.7rem;
          background: rgba(255,255,255,0.1);
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          margin: 0 0.5rem;
        }

        .fae-calc-retail-price {
          font-weight: 500;
          color: var(--fae-text-muted);
          text-decoration: line-through;
          opacity: 0.7;
        }

        .fae-calc-footer {
          text-align: center;
          font-size: 0.75rem;
          color: var(--fae-text-muted);
          padding-top: 1rem;
          border-top: 1px solid var(--fae-border);
        }

        .fae-calc-footer a {
          color: var(--fae-gold);
          text-decoration: none;
          font-weight: 500;
        }

        .fae-calc-footer a:hover {
          text-decoration: underline;
        }

        @media (max-width: 480px) {
          .fae-calc {
            padding: 1.25rem;
          }

          .fae-calc-filters {
            grid-template-columns: 1fr 1fr;
          }

          .fae-calc-filters .fae-calc-field:last-child {
            grid-column: span 2;
          }

          .fae-calc-title {
            font-size: 1.5rem;
          }

          .fae-calc-toggle-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }

          .fae-calc-selected-price,
          .fae-calc-savings-value {
            font-size: 1.75rem;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Render HTML
    container.innerHTML = `
      <div class="fae-calc">
        <header class="fae-calc-header">
          <h2 class="fae-calc-title">Savings Calculator</h2>
          <p class="fae-calc-subtitle">Compare duty-free prices across 5+ stores worldwide</p>
        </header>

        <div class="fae-calc-filters">
          <div class="fae-calc-field">
            <label class="fae-calc-label" for="fae-region">Region</label>
            <select id="fae-region" class="fae-calc-select">
              ${REGIONS.map(r => `<option value="${r.value}">${r.label}</option>`).join('')}
            </select>
          </div>
          <div class="fae-calc-field">
            <label class="fae-calc-label" for="fae-currency">Currency</label>
            <select id="fae-currency" class="fae-calc-select">
              ${CURRENCIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
            </select>
          </div>
          <div class="fae-calc-field">
            <label class="fae-calc-label" for="fae-retail">Retail Price</label>
            <input type="number" id="fae-retail" class="fae-calc-input" value="150" min="0" step="0.01">
          </div>
        </div>

        <div class="fae-calc-toggle-row">
          <div class="fae-calc-toggle-info">
            <span class="fae-calc-toggle-label">Use Researched Prices</span>
            <span id="fae-mode-badge" class="fae-calc-badge">Verified</span>
          </div>
          <button type="button" id="fae-toggle" class="fae-calc-toggle" role="switch" aria-checked="true" aria-label="Toggle researched prices mode">
            <span class="fae-calc-toggle-thumb"></span>
          </button>
        </div>

        <div class="fae-calc-search-section">
          <div class="fae-calc-section-header">
            <span class="fae-calc-section-title">Find Duty-Free Price</span>
            <span id="fae-region-tag" class="fae-calc-region-tag" data-region="all">All Regions</span>
          </div>
          <div class="fae-calc-search-wrap">
            <svg class="fae-calc-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" id="fae-search" class="fae-calc-search-input" placeholder="iPhone 15 Pro, Johnnie Walker Blue, Chanel...">
          </div>
        </div>

        <div id="fae-results" class="fae-calc-results"></div>
        <div id="fae-selected"></div>
        <div id="fae-savings"></div>

        <div class="fae-calc-hint">
          <strong>Popular:</strong> iPhone 16 Pro, Samsung S24, MacBook Air, AirPods Pro, Apple Watch, PS5, Marlboro, Johnnie Walker
        </div>

        <footer class="fae-calc-footer">
          Powered by <a href="https://flyandearn.eu" target="_blank" rel="noopener">FlyAndEarn</a>
        </footer>
      </div>
    `;

    // State
    let useResearch = true;
    let selectedPrice = null;
    let searchTimeout;

    // Elements
    const regionSelect = container.querySelector('#fae-region');
    const currencySelect = container.querySelector('#fae-currency');
    const retailInput = container.querySelector('#fae-retail');
    const searchInput = container.querySelector('#fae-search');
    const resultsDiv = container.querySelector('#fae-results');
    const selectedDiv = container.querySelector('#fae-selected');
    const savingsDiv = container.querySelector('#fae-savings');
    const regionTag = container.querySelector('#fae-region-tag');
    const toggleBtn = container.querySelector('#fae-toggle');
    const modeBadge = container.querySelector('#fae-mode-badge');

    // Event handlers
    regionSelect.addEventListener('change', () => {
      const region = REGIONS.find(r => r.value === regionSelect.value);
      regionTag.textContent = region?.label || 'All Regions';
      regionTag.setAttribute('data-region', regionSelect.value);
      clearSelection();
      if (searchInput.value.length >= 2) doSearch(searchInput.value);
    });

    currencySelect.addEventListener('change', () => {
      clearSelection();
      if (searchInput.value.length >= 2) doSearch(searchInput.value);
    });

    toggleBtn.addEventListener('click', () => {
      useResearch = !useResearch;
      toggleBtn.setAttribute('aria-checked', useResearch);
      modeBadge.textContent = useResearch ? 'Verified' : 'Live';
      modeBadge.setAttribute('data-mode', useResearch ? 'verified' : 'live');
      clearSelection();
      if (searchInput.value.length >= 2) doSearch(searchInput.value);
    });

    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      searchTimeout = setTimeout(() => doSearch(query), 300);
    });

    retailInput.addEventListener('input', updateSavings);

    function clearSelection() {
      selectedPrice = null;
      selectedDiv.innerHTML = '';
      savingsDiv.innerHTML = '';
      resultsDiv.innerHTML = '';
    }

    async function doSearch(query) {
      if (query.length < 2) {
        resultsDiv.innerHTML = '';
        return;
      }

      resultsDiv.innerHTML = '<div class="fae-calc-loading"><span class="fae-calc-spinner"></span>Searching...</div>';

      try {
        const currency = currencySelect.value;
        const region = regionSelect.value;
        // Use Netlify function proxy
        const url = `/api/prices?q=${encodeURIComponent(query)}&currency=${currency}&region=${region}`;

        console.log('FlyAndEarn: Fetching', url);
        const response = await fetch(url);

        if (!response.ok) {
          console.error('FlyAndEarn: HTTP error', response.status);
          resultsDiv.innerHTML = `<div class="fae-calc-loading">Server error (${response.status}). Please try again.</div>`;
          return;
        }

        const data = await response.json();
        console.log('FlyAndEarn: Response', data);

        if (!data.success) {
          resultsDiv.innerHTML = '<div class="fae-calc-loading">No results found</div>';
          return;
        }

        const prices = data.data?.prices || data.data?.products || [];
        const retailPrices = data.data?.retailPrices || [];
        const savingsInfo = data.data?.savings || null;

        if (!prices || prices.length === 0) {
          resultsDiv.innerHTML = '<div class="fae-calc-loading">No products found. Try: iPhone 16, Samsung S24, MacBook</div>';
          return;
        }

        // Build results HTML
        let html = '';

        // Show savings banner if available
        if (savingsInfo && savingsInfo.savingsPercent > 0) {
          html += `
            <div class="fae-calc-savings-banner">
              <div class="fae-calc-savings-icon">💰</div>
              <div class="fae-calc-savings-text">
                <strong>Save ${savingsInfo.savingsPercent}%</strong> vs retail stores
                <span class="fae-calc-savings-detail">${formatPrice(savingsInfo.savingsAmount, currency)} off avg retail price</span>
              </div>
            </div>
          `;
        }

        // Show duty-free prices
        html += '<div class="fae-calc-section-label">✈️ Duty-Free Prices</div>';
        html += prices.slice(0, 5).map((p, i) => {
          const price = p.convertedPrice || p.price;
          const name = p.product || p.name;
          const store = p.store;
          const pRegion = p.region || 'europe';
          const country = p.country || '';
          const confidence = p.confidence || 'medium';

          return `
            <button type="button" class="fae-calc-result ${i === 0 ? 'best' : ''}"
                    data-price="${price}" data-name="${name}" data-store="${store}" data-region="${pRegion}"
                    data-retail="${savingsInfo ? savingsInfo.averageRetailPrice : ''}">
              <div class="fae-calc-result-top">
                <span class="fae-calc-result-name">${name}</span>
                <span class="fae-calc-result-price">${formatPrice(price, currency)}</span>
              </div>
              <div class="fae-calc-result-meta">
                <span>${store}</span>
                <span class="fae-calc-region-tag" data-region="${pRegion}">${country || REGIONS.find(r => r.value === pRegion)?.label}</span>
                ${useResearch ? `<span class="fae-calc-confidence ${confidence}">${confidence}</span>` : ''}
                ${i === 0 ? '<span class="fae-calc-best-badge">Best Price</span>' : ''}
              </div>
            </button>
          `;
        }).join('');

        // Show retail prices for comparison (MEA and Asia)
        if (retailPrices.length > 0) {
          const meaRetail = retailPrices.filter(p => p.region === 'middle_east').slice(0, 3);
          const asiaRetail = retailPrices.filter(p => p.region === 'asia').slice(0, 3);

          if (meaRetail.length > 0 || asiaRetail.length > 0) {
            html += '<div class="fae-calc-section-label fae-calc-retail-label">🏪 Retail Store Prices (for comparison)</div>';

            [...meaRetail, ...asiaRetail].forEach(p => {
              const price = p.convertedPrice || p.price;
              html += `
                <div class="fae-calc-retail-item">
                  <span class="fae-calc-retail-store">${p.store}</span>
                  <span class="fae-calc-retail-country">${p.country}</span>
                  <span class="fae-calc-retail-price">${formatPrice(price, currency)}</span>
                </div>
              `;
            });
          }
        }

        resultsDiv.innerHTML = html;

        // Add click handlers
        resultsDiv.querySelectorAll('.fae-calc-result').forEach(btn => {
          btn.addEventListener('click', () => selectProduct(btn));
        });
      } catch (err) {
        console.error('FlyAndEarn Calculator Error:', err.message, err);
        resultsDiv.innerHTML = `<div class="fae-calc-loading">Failed to connect. Please try again.</div>`;
      }
    }

    function selectProduct(btn) {
      const price = parseFloat(btn.dataset.price);
      const name = btn.dataset.name;
      const store = btn.dataset.store;
      const region = btn.dataset.region;
      const currency = currencySelect.value;

      selectedPrice = price;
      searchInput.value = name;
      resultsDiv.innerHTML = '';

      selectedDiv.innerHTML = `
        <div class="fae-calc-selected">
          <div class="fae-calc-selected-label">Best Duty-Free Price</div>
          <div class="fae-calc-selected-price">${formatPrice(price, currency)}</div>
          <div class="fae-calc-selected-store">${store} • ${REGIONS.find(r => r.value === region)?.label}</div>
        </div>
      `;

      updateSavings();
    }

    function updateSavings() {
      const retail = parseFloat(retailInput.value);
      const currency = currencySelect.value;

      if (retail > 0 && selectedPrice !== null && selectedPrice > 0) {
        const savings = retail - selectedPrice;
        const percent = ((savings / retail) * 100).toFixed(0);

        if (savings > 0) {
          savingsDiv.innerHTML = `
            <div class="fae-calc-savings">
              <div class="fae-calc-savings-label">Your Savings</div>
              <div class="fae-calc-savings-value">${formatPrice(savings, currency)}</div>
              <div class="fae-calc-savings-detail">${percent}% off retail price</div>
            </div>
          `;
        } else {
          savingsDiv.innerHTML = '';
        }
      }
    }
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => createCalculator('flyandearn-calculator'));
  } else {
    createCalculator('flyandearn-calculator');
  }

  // Expose global API
  window.FlyAndEarnCalculator = { init: createCalculator };
})();
