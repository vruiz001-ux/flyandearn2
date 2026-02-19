// Calculator feature module - lazy loaded
import { Store } from '../core/store.js';

class Calculator {
    constructor() {
        this.initialized = false;
        this.airports = null;
        this.currencies = null;
        this.currentCalculation = null;
    }

    async init() {
        if (this.initialized) return;

        try {
            // Load required data
            await this.loadData();
            
            // Render calculator UI
            this.render();
            
            // Bind events
            this.bindEvents();
            
            this.initialized = true;
            console.log('Calculator module initialized');
        } catch (error) {
            console.error('Failed to initialize calculator:', error);
            throw error;
        }
    }

    async loadData() {
        // Load airports and currencies data lazily
        const [airportsModule, currenciesModule] = await Promise.all([
            import('../data/airports.js'),
            import('../data/currencies.js')
        ]);

        this.airports = airportsModule.airports;
        this.currencies = currenciesModule.currencies;
    }

    render() {
        const main = document.querySelector('main');
        main.innerHTML = `
            <div class="calculator-container">
                <div class="hero">
                    <h1>Flight & Delivery Calculator</h1>
                    <p>Calculate potential earnings and savings</p>
                </div>

                <div class="calculator-card">
                    <form id="calculator-form" class="calculator-form">
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="from-airport">From Airport</label>
                                <select id="from-airport" required>
                                    <option value="">Select departure airport...</option>
                                    ${this.renderAirportOptions()}
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="to-airport">To Airport</label>
                                <select id="to-airport" required>
                                    <option value="">Select arrival airport...</option>
                                    ${this.renderAirportOptions()}
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="departure-date">Departure Date</label>
                                <input type="date" id="departure-date" min="${this.getTodayString()}" required>
                            </div>

                            <div class="form-group">
                                <label for="return-date">Return Date (optional)</label>
                                <input type="date" id="return-date" min="${this.getTodayString()}">
                            </div>

                            <div class="form-group">
                                <label for="delivery-weight">Delivery Weight (kg)</label>
                                <input type="number" id="delivery-weight" min="0" max="23" step="0.1" placeholder="0.0">
                            </div>

                            <div class="form-group">
                                <label for="delivery-value">Delivery Value</label>
                                <div class="input-group">
                                    <input type="number" id="delivery-value" min="0" step="0.01" placeholder="0.00">
                                    <select id="delivery-currency">
                                        ${this.renderCurrencyOptions()}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <button type="submit" class="btn-primary" id="calculate-btn">
                            <span class="btn-text">Calculate</span>
                            <div class="loading-spinner hidden"></div>
                        </button>
                    </form>

                    <div id="calculation-results" class="results-section hidden">
                        <!-- Results will be populated here -->
                    </div>
                </div>
            </div>
        `;

        // Load calculator-specific CSS
        this.loadCSS();
    }

    renderAirportOptions() {
        if (!this.airports) return '';
        
        return Object.entries(this.airports)
            .map(([code, airport]) => 
                `<option value="${code}">${airport.name} (${code}) - ${airport.city}, ${airport.country}</option>`
            )
            .join('');
    }

    renderCurrencyOptions() {
        if (!this.currencies) return '';
        
        return Object.entries(this.currencies)
            .map(([code, currency]) => 
                `<option value="${code}" ${code === 'USD' ? 'selected' : ''}>${code} - ${currency.name}</option>`
            )
            .join('');
    }

    getTodayString() {
        return new Date().toISOString().split('T')[0];
    }

    bindEvents() {
        const form = document.getElementById('calculator-form');
        form.addEventListener('submit', (e) => this.handleCalculation(e));

        // Auto-update return date minimum
        const departureDate = document.getElementById('departure-date');
        const returnDate = document.getElementById('return-date');
        
        departureDate.addEventListener('change', () => {
            if (departureDate.value) {
                returnDate.min = departureDate.value;
                if (returnDate.value && returnDate.value < departureDate.value) {
                    returnDate.value = departureDate.value;
                }
            }
        });

        // Real-time validation feedback
        form.addEventListener('input', (e) => this.validateField(e.target));
    }

    validateField(field) {
        const value = field.value.trim();
        const fieldGroup = field.closest('.form-group');
        
        // Remove existing validation classes
        fieldGroup.classList.remove('valid', 'invalid');
        
        if (field.hasAttribute('required') && !value) {
            fieldGroup.classList.add('invalid');
            return false;
        }

        if (field.type === 'number' && value) {
            const num = parseFloat(value);
            const min = parseFloat(field.min);
            const max = parseFloat(field.max);
            
            if (isNaN(num) || (min !== null && num < min) || (max !== null && num > max)) {
                fieldGroup.classList.add('invalid');
                return false;
            }
        }

        fieldGroup.classList.add('valid');
        return true;
    }

    async handleCalculation(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        // Validate form
        const isValid = this.validateForm();
        if (!isValid) return;

        try {
            this.showLoading(true);
            
            // Perform calculation
            const results = await this.calculate(data);
            
            // Store calculation for potential booking
            this.currentCalculation = { data, results };
            Store.set('lastCalculation', this.currentCalculation);
            
            // Display results
            this.displayResults(results);
            
        } catch (error) {
            console.error('Calculation error:', error);
            this.showError('Failed to calculate. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    validateForm() {
        const form = document.getElementById('calculator-form');
        const fields = form.querySelectorAll('input[required], select[required]');
        let isValid = true;

        fields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        return isValid;
    }

    async calculate(data) {
        // Simulate calculation (replace with actual API call)
        await new Promise(resolve => setTimeout(resolve, 800));

        const fromAirport = this.airports[data['from-airport']];
        const toAirport = this.airports[data['to-airport']];
        const deliveryWeight = parseFloat(data['delivery-weight']) || 0;
        const deliveryValue = parseFloat(data['delivery-value']) || 0;

        // Mock calculation logic
        const distance = this.calculateDistance(fromAirport, toAirport);
        const baseFlightCost = distance * 0.15; // $0.15 per km
        const deliveryFee = deliveryWeight * 5 + deliveryValue * 0.01; // $5/kg + 1% of value
        const savings = Math.min(baseFlightCost * 0.3, deliveryFee * 0.8); // Max 30% flight savings

        return {
            flightCost: baseFlightCost,
            deliveryFee,
            savings,
            netCost: baseFlightCost - savings,
            distance,
            route: `${data['from-airport']} → ${data['to-airport']}`,
            departureDate: data['departure-date'],
            returnDate: data['return-date'] || null
        };
    }

    calculateDistance(from, to) {
        // Haversine formula for distance calculation
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRad(to.lat - from.lat);
        const dLon = this.toRad(to.lon - from.lon);
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                 Math.cos(this.toRad(from.lat)) * Math.cos(this.toRad(to.lat)) *
                 Math.sin(dLon/2) * Math.sin(dLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return Math.round(R * c);
    }

    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    displayResults(results) {
        const resultsSection = document.getElementById('calculation-results');
        
        resultsSection.innerHTML = `
            <div class="results-header">
                <h3>Calculation Results</h3>
                <p class="route">${results.route}</p>
            </div>

            <div class="results-grid">
                <div class="result-card">
                    <div class="result-value">$${results.flightCost.toFixed(2)}</div>
                    <div class="result-label">Estimated Flight Cost</div>
                </div>

                <div class="result-card">
                    <div class="result-value">$${results.deliveryFee.toFixed(2)}</div>
                    <div class="result-label">Potential Delivery Earnings</div>
                </div>

                <div class="result-card highlight">
                    <div class="result-value">$${results.savings.toFixed(2)}</div>
                    <div class="result-label">Your Savings</div>
                </div>

                <div class="result-card">
                    <div class="result-value">$${results.netCost.toFixed(2)}</div>
                    <div class="result-label">Final Flight Cost</div>
                </div>
            </div>

            <div class="results-details">
                <p><strong>Distance:</strong> ${results.distance} km</p>
                <p><strong>Departure:</strong> ${results.departureDate}</p>
                ${results.returnDate ? `<p><strong>Return:</strong> ${results.returnDate}</p>` : ''}
            </div>

            <div class="results-actions">
                <button class="btn-primary" onclick="app.navigate('/browse')">
                    Find Delivery Requests
                </button>
                <button class="btn-secondary" onclick="this.bookFlight()">
                    Book Flight
                </button>
            </div>
        `;

        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    showLoading(show) {
        const btn = document.getElementById('calculate-btn');
        const text = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.loading-spinner');

        if (show) {
            text.textContent = 'Calculating...';
            spinner.classList.remove('hidden');
            btn.disabled = true;
        } else {
            text.textContent = 'Calculate';
            spinner.classList.add('hidden');
            btn.disabled = false;
        }
    }

    showError(message) {
        const resultsSection = document.getElementById('calculation-results');
        resultsSection.innerHTML = `
            <div class="error-message">
                <h4>Calculation Error</h4>
                <p>${message}</p>
            </div>
        `;
        resultsSection.classList.remove('hidden');
    }

    loadCSS() {
        // Load calculator-specific styles
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/assets/calculator.css';
        document.head.appendChild(link);
    }

    bookFlight() {
        if (this.currentCalculation) {
            // Navigate to booking with calculation data
            const params = new URLSearchParams({
                from: this.currentCalculation.data['from-airport'],
                to: this.currentCalculation.data['to-airport'],
                departure: this.currentCalculation.data['departure-date'],
                return: this.currentCalculation.data['return-date'] || '',
                savings: this.currentCalculation.results.savings.toFixed(2)
            });
            
            window.location.href = `/book?${params.toString()}`;
        }
    }
}

// Export default for lazy loading
export default new Calculator();