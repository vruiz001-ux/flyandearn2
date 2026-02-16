// ==========================================
// FLYANDEARN MVP - COMPLETE APPLICATION
// ==========================================

const FlyAndEarn = (function() {
    'use strict';

    // ==========================================
    // SECURITY - INPUT SANITIZATION
    // ==========================================

    const Security = {
        // HTML entity encoding to prevent XSS
        escapeHtml(str) {
            if (str === null || str === undefined) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

        // Sanitize user input for display
        sanitize(input) {
            if (typeof input !== 'string') return input;
            return this.escapeHtml(input.trim());
        },

        // Sanitize object properties
        sanitizeObject(obj) {
            if (!obj || typeof obj !== 'object') return obj;
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'string') {
                    sanitized[key] = this.sanitize(value);
                } else if (typeof value === 'object' && value !== null) {
                    sanitized[key] = this.sanitizeObject(value);
                } else {
                    sanitized[key] = value;
                }
            }
            return sanitized;
        },

        // Validate email format
        isValidEmail(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        },

        // Validate amount (positive number)
        isValidAmount(amount) {
            const num = parseFloat(amount);
            return !isNaN(num) && num > 0 && num < 1000000;
        }
    };

    // ==========================================
    // COOKIE CONSENT
    // Compatible with index.html's flyandearn_cookie_consent
    // ==========================================

    const CookieConsent = {
        MAIN_KEY: 'flyandearn_cookie_consent',
        SETTINGS_KEY: 'flyandearn_cookie_settings',

        // Check for consent (compatible with both keys)
        hasConsent() {
            const consent = localStorage.getItem(this.MAIN_KEY);
            return consent === 'accepted' || consent === 'custom' || consent === 'rejected' || consent === 'necessary-only';
        },

        accept() {
            localStorage.setItem(this.MAIN_KEY, 'accepted');
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify({
                necessary: true,
                functional: true,
                analytics: true,
                marketing: true,
                timestamp: new Date().toISOString(),
                version: '1.0'
            }));
            this.hideModal();
        },

        reject() {
            localStorage.setItem(this.MAIN_KEY, 'rejected');
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify({
                necessary: true,
                functional: false,
                analytics: false,
                marketing: false,
                timestamp: new Date().toISOString(),
                version: '1.0'
            }));
            this.hideModal();
        },

        decline() {
            // For users who completely refuse - set necessary-only preference
            localStorage.setItem(this.MAIN_KEY, 'necessary-only');
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify({
                necessary: true,
                functional: false,
                analytics: false,
                marketing: false,
                timestamp: new Date().toISOString(),
                version: '1.0'
            }));
            this.hideModal();
        },

        showModal() {
            // Don't show if consent exists or index.html banner is present
            if (this.hasConsent()) return;
            if (document.getElementById('cookieBanner')) return;
            if (document.getElementById('cookieConsentModal')) return;

            const modal = document.createElement('div');
            modal.id = 'cookieConsentModal';
            modal.innerHTML = `
                <div style="position:fixed;bottom:0;left:0;right:0;background:#18181b;border-top:1px solid #27272a;padding:1.5rem 2rem;z-index:10000;display:flex;flex-wrap:wrap;gap:1rem;align-items:center;justify-content:space-between;">
                    <div style="flex:1;min-width:300px;">
                        <p style="color:#fafafa;margin-bottom:0.5rem;font-weight:600;">🍪 Cookies & Privacy / Pliki cookies</p>
                        <p style="color:#a1a1aa;font-size:0.875rem;">This site uses cookies for authentication and functionality. See our <a href="/privacy.html" style="color:#d4a853;">Privacy Policy</a>.<br>
                        <span style="color:#71717a;">Ta strona używa plików cookies. Zobacz naszą Politykę Prywatności.</span></p>
                    </div>
                    <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
                        <button onclick="FAE.CookieConsent.reject()" style="padding:0.75rem 1.5rem;background:transparent;border:1px solid #27272a;color:#a1a1aa;border-radius:8px;cursor:pointer;">Reject / Odrzuć</button>
                        <button onclick="FAE.CookieConsent.accept()" style="padding:0.75rem 1.5rem;background:linear-gradient(135deg,#d4a853,#f0d78c);border:none;color:#000;border-radius:8px;cursor:pointer;font-weight:600;">Accept / Akceptuję</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        },

        hideModal() {
            const modal = document.getElementById('cookieConsentModal');
            if (modal) modal.remove();
        },

        getSettings() {
            const settings = localStorage.getItem(this.SETTINGS_KEY);
            return settings ? JSON.parse(settings) : { necessary: true, functional: false, analytics: false, marketing: false };
        }
    };

    // ==========================================
    // DATA STORE (localStorage)
    // ==========================================

    const Store = {
        get: (key, defaultValue = null) => {
            try {
                const item = localStorage.getItem(`fae_${key}`);
                return item ? JSON.parse(item) : defaultValue;
            } catch { return defaultValue; }
        },
        set: (key, value) => {
            try {
                localStorage.setItem(`fae_${key}`, JSON.stringify(value));
                return true;
            } catch (e) { 
                console.error('Storage error:', e);
                return false;
            }
        },
        remove: (key) => localStorage.removeItem(`fae_${key}`),
        clear: () => {
            Object.keys(localStorage)
                .filter(k => k.startsWith('fae_'))
                .forEach(k => localStorage.removeItem(k));
        }
    };

    // ==========================================
    // SEED DATA
    // ==========================================

    const seedUsers = [
        { id: 'u1', email: 'maria@example.com', name: 'Maria Kowalska', avatar: 'MK', role: 'traveler', rating: 4.9, deliveries: 47, verified: true, joined: '2024-03-15', location: 'Warsaw', bio: 'Frequent flyer, love helping people get great deals!' },
        { id: 'u2', email: 'jan@example.com', name: 'Jan Nowak', avatar: 'JN', role: 'traveler', rating: 5.0, deliveries: 23, verified: true, joined: '2024-05-20', location: 'Kraków', bio: 'Business traveler, happy to help on my routes.' },
        { id: 'u3', email: 'anna@example.com', name: 'Anna Wiśniewska', avatar: 'AW', role: 'buyer', rating: 4.8, purchases: 12, verified: true, joined: '2024-06-10', location: 'Poznań', bio: 'Looking for duty-free deals!' },
        { id: 'u4', email: 'piotr@example.com', name: 'Piotr Wójcik', avatar: 'PW', role: 'traveler', rating: 4.9, deliveries: 156, verified: true, joined: '2023-11-01', location: 'Gdańsk', bio: 'Top seller - Asia routes specialist' },
        { id: 'u5', email: 'kasia@example.com', name: 'Katarzyna Lewandowska', avatar: 'KL', role: 'both', rating: 4.7, deliveries: 34, purchases: 8, verified: true, joined: '2024-01-15', location: 'Wrocław', bio: 'Sometimes I travel, sometimes I buy!' }
    ];

    const seedRequests = [
        { id: 'r1', buyerId: 'u3', product: 'Johnnie Walker Blue Label', category: 'spirits', description: '1L bottle, original packaging', dutyFreePrice: 165, serviceFee: 40, fromAirport: 'DXB', fromCity: 'Dubai', toAirport: 'KRK', toCity: 'Kraków', neededBy: '2025-01-15', status: 'open', created: '2024-12-20', offers: [] },
        { id: 'r2', buyerId: 'u3', product: 'Dior Sauvage EDP', category: 'perfume', description: '200ml, gift box preferred', dutyFreePrice: 125, serviceFee: 30, fromAirport: 'CDG', fromCity: 'Paris', toAirport: 'WAW', toCity: 'Warsaw', neededBy: '2025-01-10', status: 'open', created: '2024-12-19', offers: ['u1', 'u2'] },
        { id: 'r3', buyerId: 'u5', product: 'AirPods Pro 2', category: 'electronics', description: 'USB-C version, sealed', dutyFreePrice: 199, serviceFee: 55, fromAirport: 'JFK', fromCity: 'New York', toAirport: 'GDN', toCity: 'Gdańsk', neededBy: '2025-01-20', status: 'open', created: '2024-12-18', offers: [] },
        { id: 'r4', buyerId: 'u3', product: 'Macallan 18yr', category: 'spirits', description: '700ml Single Malt', dutyFreePrice: 220, serviceFee: 50, fromAirport: 'LHR', fromCity: 'London', toAirport: 'WAW', toCity: 'Warsaw', neededBy: '2025-01-25', status: 'matched', created: '2024-12-15', offers: ['u1'], matchedTraveler: 'u1' },
        { id: 'r5', buyerId: 'u5', product: 'PlayStation 5 Slim', category: 'electronics', description: 'Digital Edition', dutyFreePrice: 350, serviceFee: 70, fromAirport: 'NRT', fromCity: 'Tokyo', toAirport: 'WAW', toCity: 'Warsaw', neededBy: '2025-02-01', status: 'open', created: '2024-12-17', offers: ['u4'] },
        { id: 'r6', buyerId: 'u3', product: 'Chanel No. 5', category: 'perfume', description: '100ml EDP', dutyFreePrice: 98, serviceFee: 25, fromAirport: 'CDG', fromCity: 'Paris', toAirport: 'POZ', toCity: 'Poznań', neededBy: '2025-01-08', status: 'open', created: '2024-12-21', offers: ['u1', 'u2', 'u5'] }
    ];

    const seedTrips = [
        { id: 't1', travelerId: 'u1', fromAirport: 'WAW', fromCity: 'Warsaw', toAirport: 'DXB', toCity: 'Dubai', departureDate: '2024-12-28', returnDate: '2025-01-05', status: 'upcoming', capacity: { spirits: 1, perfume: 2, electronics: 1 }, note: 'Can bring whisky and perfumes' },
        { id: 't2', travelerId: 'u2', fromAirport: 'KRK', fromCity: 'Kraków', toAirport: 'CDG', toCity: 'Paris', departureDate: '2025-01-03', returnDate: '2025-01-07', status: 'upcoming', capacity: { spirits: 1, perfume: 3, electronics: 0 }, note: 'Perfume specialist!' },
        { id: 't3', travelerId: 'u4', fromAirport: 'WAW', fromCity: 'Warsaw', toAirport: 'SIN', toCity: 'Singapore', departureDate: '2025-01-08', returnDate: '2025-01-15', status: 'upcoming', capacity: { spirits: 1, perfume: 2, electronics: 2 }, note: 'Electronics OK, have extra luggage' },
        { id: 't4', travelerId: 'u1', fromAirport: 'WAW', fromCity: 'Warsaw', toAirport: 'LHR', toCity: 'London', departureDate: '2025-01-12', returnDate: '2025-01-14', status: 'upcoming', capacity: { spirits: 1, perfume: 1, electronics: 1 }, note: 'Quick business trip' },
        { id: 't5', travelerId: 'u5', fromAirport: 'WRO', fromCity: 'Wrocław', toAirport: 'AMS', toCity: 'Amsterdam', departureDate: '2025-01-20', returnDate: '2025-01-23', status: 'upcoming', capacity: { spirits: 2, perfume: 2, electronics: 0 }, note: 'Can bring alcohol' }
    ];

    const seedDeals = [
        { id: 'd1', requestId: 'r4', travelerId: 'u1', buyerId: 'u3', product: 'Macallan 18yr', dutyFreePrice: 220, serviceFee: 50, platformFee: 2.50, totalAmount: 272.50, status: 'in_progress', escrowId: 'e1', created: '2024-12-16', deliveryDate: '2025-01-14' }
    ];

    const seedEscrows = [
        { id: 'e1', dealId: 'd1', amount: 272.50, buyerId: 'u3', travelerId: 'u1', status: 'held', createdAt: '2024-12-16', expiresAt: '2025-01-28' }
    ];

    const seedMessages = [
        { id: 'm1', dealId: 'd1', from: 'u3', to: 'u1', text: 'Hi Maria! Thanks for accepting my request. Will you be able to get the Macallan from Heathrow?', timestamp: '2024-12-16T10:30:00Z', read: true },
        { id: 'm2', dealId: 'd1', from: 'u1', to: 'u3', text: 'Hi Anna! Yes, I checked and they have it in stock at World Duty Free. I\'ll grab it on my way back.', timestamp: '2024-12-16T11:15:00Z', read: true },
        { id: 'm3', dealId: 'd1', from: 'u3', to: 'u1', text: 'Perfect! Let me know when you land and we can arrange the handover.', timestamp: '2024-12-16T11:20:00Z', read: true },
        { id: 'm4', dealId: 'd1', from: 'u1', to: 'u3', text: 'Will do! I land at 6pm on the 14th. Can meet you at Warszawa Centralna around 7:30pm?', timestamp: '2024-12-16T14:00:00Z', read: false }
    ];

    const seedNotifications = [
        { id: 'n1', userId: 'u3', type: 'offer', title: 'New offer on your request', message: 'Maria K. offered to fulfill your Dior Sauvage request', link: '/requests/r2', read: false, created: '2024-12-21T09:00:00Z' },
        { id: 'n2', userId: 'u3', type: 'message', title: 'New message from Maria K.', message: 'Re: Macallan 18yr deal', link: '/deals/d1', read: false, created: '2024-12-16T14:00:00Z' },
        { id: 'n3', userId: 'u1', type: 'match', title: 'Your trip matches a request!', message: 'Your London trip matches a request for Macallan 18yr', link: '/trips/t4', read: true, created: '2024-12-15T08:00:00Z' }
    ];

    // ==========================================
    // INITIALIZE DATA
    // ==========================================

    function initializeData() {
        if (!Store.get('initialized')) {
            Store.set('users', seedUsers);
            Store.set('requests', seedRequests);
            Store.set('trips', seedTrips);
            Store.set('deals', seedDeals);
            Store.set('escrows', seedEscrows);
            Store.set('messages', seedMessages);
            Store.set('notifications', seedNotifications);
            Store.set('initialized', true);
            console.log('FlyAndEarn: Data initialized');
        }
    }

    // ==========================================
    // AUTH MODULE
    // ==========================================

    const Auth = {
        currentUser: null,
        isLoading: false,

        async init() {
            // Try to restore from localStorage cache first for instant UI
            const cachedUser = Store.get('cachedUser');
            if (cachedUser) {
                this.currentUser = cachedUser;
                this.updateUI();
            }

            // Then verify session with server
            await this.checkSession();
        },

        async checkSession() {
            try {
                const response = await fetch('/.netlify/functions/me', {
                    method: 'GET',
                    credentials: 'include',
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.user) {
                        this.currentUser = this._enrichUser(data.user);
                        Store.set('cachedUser', this.currentUser);
                        this.updateUI();
                        return this.currentUser;
                    }
                }

                // Session invalid or expired
                this.currentUser = null;
                Store.remove('cachedUser');
                this.updateUI();
                return null;
            } catch (error) {
                console.error('Session check failed:', error);
                // Keep cached user for offline support
                return this.currentUser;
            }
        },

        async login(email, password) {
            // Validate email format
            if (!Security.isValidEmail(email)) {
                throw new Error('Please enter a valid email address');
            }

            this.isLoading = true;

            try {
                const response = await fetch('/.netlify/functions/login', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.details || data.error || 'Login failed');
                }

                this.currentUser = this._enrichUser(data.user);
                Store.set('cachedUser', this.currentUser);
                this.updateUI();

                return this.currentUser;
            } finally {
                this.isLoading = false;
            }
        },

        async signup(data) {
            // Validate email
            if (!Security.isValidEmail(data.email)) {
                throw new Error('Please enter a valid email address');
            }

            // Validate password confirmation
            if (data.password !== data.confirmPassword) {
                throw new Error('Passwords do not match');
            }

            this.isLoading = true;

            try {
                const response = await fetch('/.netlify/functions/register', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: data.email,
                        password: data.password,
                        name: data.name,
                        role: (data.role || 'buyer').toUpperCase(),
                        phone: data.phone || null,
                    }),
                });

                const result = await response.json();

                if (!response.ok) {
                    // Handle specific error cases
                    if (result.details && Array.isArray(result.details)) {
                        throw new Error(result.details.join('. '));
                    }
                    throw new Error(result.details || result.error || 'Registration failed');
                }

                this.currentUser = this._enrichUser(result.user);
                Store.set('cachedUser', this.currentUser);
                this.updateUI();

                // Add welcome notification
                Notifications.add(this.currentUser.id, 'welcome', 'Welcome to FlyAndEarn!',
                    'Complete your profile to start trading duty-free goods.', '/profile');

                return this.currentUser;
            } finally {
                this.isLoading = false;
            }
        },

        // Enrich user object with frontend-specific properties
        _enrichUser(user) {
            return {
                ...user,
                avatar: user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2),
                rating: 0,
                deliveries: 0,
                purchases: 0,
                verified: false,
                joined: new Date(user.createdAt).toISOString().split('T')[0],
                location: '',
                bio: '',
                gdprConsent: true,
                gdprConsentDate: user.createdAt,
            };
        },

        // GDPR: Delete user account and all associated data
        deleteAccount() {
            if (!this.currentUser) throw new Error('Must be logged in');

            const userId = this.currentUser.id;

            // Remove user from users list
            const users = Store.get('users', []);
            const filteredUsers = users.filter(u => u.id !== userId);
            Store.set('users', filteredUsers);

            // Remove user's requests
            const requests = Store.get('requests', []);
            const filteredRequests = requests.filter(r => r.buyerId !== userId);
            Store.set('requests', filteredRequests);

            // Remove user's trips
            const trips = Store.get('trips', []);
            const filteredTrips = trips.filter(t => t.travelerId !== userId);
            Store.set('trips', filteredTrips);

            // Remove user's wallet
            const wallets = Store.get('wallets', {});
            delete wallets[userId];
            Store.set('wallets', wallets);

            // Remove user's transactions
            const transactions = Store.get('transactions', {});
            delete transactions[userId];
            Store.set('transactions', transactions);

            // Remove user's notifications
            const notifications = Store.get('notifications', []);
            const filteredNotifications = notifications.filter(n => n.userId !== userId);
            Store.set('notifications', filteredNotifications);

            // Remove user's messages
            const messages = Store.get('messages', []);
            const filteredMessages = messages.filter(m => m.from !== userId && m.to !== userId);
            Store.set('messages', filteredMessages);

            // Logout
            this.currentUser = null;
            Store.remove('currentUserId');
            this.updateUI();

            return { success: true, message: 'Account deleted successfully' };
        },

        // GDPR: Export all user data
        exportData() {
            if (!this.currentUser) throw new Error('Must be logged in');

            const userId = this.currentUser.id;
            const exportData = {
                exportDate: new Date().toISOString(),
                userData: this.currentUser,
                requests: Store.get('requests', []).filter(r => r.buyerId === userId),
                trips: Store.get('trips', []).filter(t => t.travelerId === userId),
                deals: Store.get('deals', []).filter(d => d.buyerId === userId || d.travelerId === userId),
                wallet: Wallet.get(userId),
                transactions: Wallet.getTransactions(userId, 1000),
                notifications: Notifications.getForUser(userId),
                messages: Store.get('messages', []).filter(m => m.from === userId || m.to === userId)
            };

            // Create downloadable JSON file
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `flyandearn-data-export-${userId}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return exportData;
        },

        async logout() {
            try {
                await fetch('/.netlify/functions/logout', {
                    method: 'POST',
                    credentials: 'include',
                });
            } catch (error) {
                console.error('Logout API call failed:', error);
            }

            // Clear local state regardless of API result
            this.currentUser = null;
            Store.remove('cachedUser');
            this.updateUI();
            window.location.href = '/';
        },

        updateProfile(data) {
            if (!this.currentUser) return null;
            
            const users = Store.get('users', []);
            const idx = users.findIndex(u => u.id === this.currentUser.id);
            
            if (idx !== -1) {
                users[idx] = { ...users[idx], ...data };
                Store.set('users', users);
                this.currentUser = users[idx];
            }
            
            return this.currentUser;
        },

        updateUI() {
            const loginBtns = document.querySelectorAll('[data-auth="login"]');
            const logoutBtns = document.querySelectorAll('[data-auth="logout"]');
            const userMenus = document.querySelectorAll('[data-auth="user-menu"]');
            const guestMenus = document.querySelectorAll('[data-auth="guest-menu"]');

            if (this.currentUser) {
                loginBtns.forEach(btn => btn.style.display = 'none');
                logoutBtns.forEach(btn => btn.style.display = '');
                userMenus.forEach(el => {
                    el.style.display = '';
                    const nameEl = el.querySelector('[data-user="name"]');
                    const avatarEl = el.querySelector('[data-user="avatar"]');
                    if (nameEl) nameEl.textContent = this.currentUser.name;
                    if (avatarEl) avatarEl.textContent = this.currentUser.avatar;
                });
                guestMenus.forEach(el => el.style.display = 'none');
            } else {
                loginBtns.forEach(btn => btn.style.display = '');
                logoutBtns.forEach(btn => btn.style.display = 'none');
                userMenus.forEach(el => el.style.display = 'none');
                guestMenus.forEach(el => el.style.display = '');
            }
        },

        requireAuth(callback) {
            if (this.currentUser) {
                callback(this.currentUser);
            } else {
                UI.showAuthModal('login', callback);
            }
        }
    };

    // ==========================================
    // REQUESTS MODULE
    // ==========================================

    const Requests = {
        getAll(filters = {}) {
            let requests = Store.get('requests', []);
            
            if (filters.status) {
                requests = requests.filter(r => r.status === filters.status);
            }
            if (filters.category) {
                requests = requests.filter(r => r.category === filters.category);
            }
            if (filters.buyerId) {
                requests = requests.filter(r => r.buyerId === filters.buyerId);
            }
            if (filters.toCity) {
                requests = requests.filter(r => r.toCity.toLowerCase().includes(filters.toCity.toLowerCase()));
            }
            
            return requests.sort((a, b) => new Date(b.created) - new Date(a.created));
        },

        getById(id) {
            const requests = Store.get('requests', []);
            return requests.find(r => r.id === id);
        },

        create(data) {
            if (!Auth.currentUser) throw new Error('Must be logged in');

            const dutyFreePrice = parseFloat(data.dutyFreePrice);
            const serviceFee = parseFloat(data.serviceFee);

            // Validate amounts
            if (!Security.isValidAmount(dutyFreePrice)) {
                throw new Error('Please enter a valid duty-free price');
            }
            if (!Security.isValidAmount(serviceFee)) {
                throw new Error('Please enter a valid service fee');
            }

            // Validate 15% max service fee
            const maxFee = dutyFreePrice * 0.15;
            if (serviceFee > maxFee) {
                throw new Error(`Service fee cannot exceed 15% of product price (max €${maxFee.toFixed(2)})`);
            }

            const requests = Store.get('requests', []);
            const request = {
                id: 'r' + Date.now(),
                buyerId: Auth.currentUser.id,
                product: Security.sanitize(data.product),
                category: Security.sanitize(data.category),
                description: Security.sanitize(data.description || ''),
                dutyFreePrice: dutyFreePrice,
                serviceFee: serviceFee,
                fromAirport: Security.sanitize(data.fromAirport),
                fromCity: Security.sanitize(data.fromCity),
                toAirport: Security.sanitize(data.toAirport),
                toCity: Security.sanitize(data.toCity),
                neededBy: data.neededBy,
                status: 'open',
                created: new Date().toISOString(),
                offers: []
            };

            requests.push(request);
            Store.set('requests', requests);

            // Find matching trips and notify travelers
            const matchingTrips = Trips.findMatches(request);
            matchingTrips.forEach(trip => {
                Notifications.add(trip.travelerId, 'match', 
                    'New request matches your trip!',
                    `${request.product} - ${request.fromCity} → ${request.toCity}`,
                    `/requests/${request.id}`);
            });

            return request;
        },

        makeOffer(requestId) {
            if (!Auth.currentUser) throw new Error('Must be logged in');
            
            const requests = Store.get('requests', []);
            const idx = requests.findIndex(r => r.id === requestId);
            
            if (idx === -1) throw new Error('Request not found');
            if (requests[idx].buyerId === Auth.currentUser.id) throw new Error('Cannot offer on your own request');
            if (requests[idx].offers.includes(Auth.currentUser.id)) throw new Error('Already made an offer');

            requests[idx].offers.push(Auth.currentUser.id);
            Store.set('requests', requests);

            // Notify buyer
            Notifications.add(requests[idx].buyerId, 'offer',
                'New offer on your request!',
                `${Auth.currentUser.name} offered to fulfill your ${requests[idx].product} request`,
                `/requests/${requestId}`);

            return requests[idx];
        },

        acceptOffer(requestId, travelerId) {
            if (!Auth.currentUser) throw new Error('Must be logged in');
            
            const requests = Store.get('requests', []);
            const idx = requests.findIndex(r => r.id === requestId);
            
            if (idx === -1) throw new Error('Request not found');
            if (requests[idx].buyerId !== Auth.currentUser.id) throw new Error('Not your request');

            requests[idx].status = 'matched';
            requests[idx].matchedTraveler = travelerId;
            Store.set('requests', requests);

            // Create deal
            const deal = Deals.create(requests[idx], travelerId);

            // Notify traveler
            const users = Store.get('users', []);
            const traveler = users.find(u => u.id === travelerId);
            Notifications.add(travelerId, 'accepted',
                'Your offer was accepted!',
                `${Auth.currentUser.name} accepted your offer for ${requests[idx].product}`,
                `/deals/${deal.id}`);

            return deal;
        },

        cancel(requestId) {
            if (!Auth.currentUser) throw new Error('Must be logged in');
            
            const requests = Store.get('requests', []);
            const idx = requests.findIndex(r => r.id === requestId);
            
            if (idx === -1) throw new Error('Request not found');
            if (requests[idx].buyerId !== Auth.currentUser.id) throw new Error('Not your request');
            if (requests[idx].status !== 'open') throw new Error('Cannot cancel - already matched');

            requests[idx].status = 'cancelled';
            Store.set('requests', requests);

            return requests[idx];
        }
    };

    // ==========================================
    // TRIPS MODULE
    // ==========================================

    const Trips = {
        getAll(filters = {}) {
            let trips = Store.get('trips', []);
            
            if (filters.travelerId) {
                trips = trips.filter(t => t.travelerId === filters.travelerId);
            }
            if (filters.status) {
                trips = trips.filter(t => t.status === filters.status);
            }
            if (filters.fromCity) {
                trips = trips.filter(t => t.fromCity.toLowerCase().includes(filters.fromCity.toLowerCase()));
            }
            if (filters.toCity) {
                trips = trips.filter(t => t.toCity.toLowerCase().includes(filters.toCity.toLowerCase()));
            }
            
            return trips.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));
        },

        getById(id) {
            const trips = Store.get('trips', []);
            return trips.find(t => t.id === id);
        },

        create(data) {
            if (!Auth.currentUser) throw new Error('Must be logged in');
            
            const trips = Store.get('trips', []);
            const trip = {
                id: 't' + Date.now(),
                travelerId: Auth.currentUser.id,
                fromAirport: data.fromAirport,
                fromCity: data.fromCity,
                toAirport: data.toAirport,
                toCity: data.toCity,
                departureDate: data.departureDate,
                returnDate: data.returnDate,
                status: 'upcoming',
                capacity: {
                    spirits: parseInt(data.spiritsCapacity) || 1,
                    perfume: parseInt(data.perfumeCapacity) || 2,
                    electronics: parseInt(data.electronicsCapacity) || 1
                },
                note: data.note || ''
            };

            trips.push(trip);
            Store.set('trips', trips);

            // Find matching requests and notify
            const matchingRequests = this.findMatchingRequests(trip);
            if (matchingRequests.length > 0) {
                Notifications.add(Auth.currentUser.id, 'matches',
                    `${matchingRequests.length} requests match your trip!`,
                    `Check out requests for your ${trip.fromCity} → ${trip.toCity} trip`,
                    `/browse?from=${trip.toCity}`);
            }

            return trip;
        },

        findMatches(request) {
            const trips = Store.get('trips', []);
            return trips.filter(trip => {
                const routeMatch = trip.toAirport === request.fromAirport || 
                                   trip.toCity.toLowerCase() === request.fromCity.toLowerCase();
                const dateMatch = new Date(trip.returnDate) <= new Date(request.neededBy);
                const statusMatch = trip.status === 'upcoming';
                return routeMatch && dateMatch && statusMatch;
            });
        },

        findMatchingRequests(trip) {
            const requests = Store.get('requests', []);
            return requests.filter(req => {
                const routeMatch = trip.toAirport === req.fromAirport ||
                                   trip.toCity.toLowerCase() === req.fromCity.toLowerCase();
                const dateMatch = new Date(trip.returnDate) <= new Date(req.neededBy);
                const statusMatch = req.status === 'open';
                return routeMatch && dateMatch && statusMatch;
            });
        },

        cancel(tripId) {
            if (!Auth.currentUser) throw new Error('Must be logged in');
            
            const trips = Store.get('trips', []);
            const idx = trips.findIndex(t => t.id === tripId);
            
            if (idx === -1) throw new Error('Trip not found');
            if (trips[idx].travelerId !== Auth.currentUser.id) throw new Error('Not your trip');

            trips[idx].status = 'cancelled';
            Store.set('trips', trips);

            return trips[idx];
        }
    };

    // ==========================================
    // DEALS MODULE
    // ==========================================

    const Deals = {
        getAll(filters = {}) {
            let deals = Store.get('deals', []);
            
            if (filters.travelerId) {
                deals = deals.filter(d => d.travelerId === filters.travelerId);
            }
            if (filters.buyerId) {
                deals = deals.filter(d => d.buyerId === filters.buyerId);
            }
            if (filters.status) {
                deals = deals.filter(d => d.status === filters.status);
            }
            
            return deals.sort((a, b) => new Date(b.created) - new Date(a.created));
        },

        getById(id) {
            const deals = Store.get('deals', []);
            return deals.find(d => d.id === id);
        },

        getForUser(userId) {
            const deals = Store.get('deals', []);
            return deals.filter(d => d.travelerId === userId || d.buyerId === userId);
        },

        create(request, travelerId) {
            const deals = Store.get('deals', []);
            
            // Platform fee: 10% of total (product + service fee)
            const subtotal = request.dutyFreePrice + request.serviceFee;
            const platformFee = subtotal * 0.10; // 10% platform fee
            const processingFee = 0.50; // Fixed processing fee
            
            const deal = {
                id: 'd' + Date.now(),
                requestId: request.id,
                travelerId: travelerId,
                buyerId: request.buyerId,
                product: request.product,
                category: request.category,
                dutyFreePrice: request.dutyFreePrice,
                serviceFee: request.serviceFee,
                platformFee: platformFee,
                processingFee: processingFee,
                totalAmount: subtotal + platformFee + processingFee,
                travelerPayout: subtotal, // Traveler gets product cost + service fee
                status: 'pending_payment',
                created: new Date().toISOString(),
                deliveryDate: null
            };

            deals.push(deal);
            Store.set('deals', deals);

            return deal;
        },

        pay(dealId) {
            if (!Auth.currentUser) throw new Error('Must be logged in');
            
            const deals = Store.get('deals', []);
            const idx = deals.findIndex(d => d.id === dealId);
            
            if (idx === -1) throw new Error('Deal not found');
            if (deals[idx].buyerId !== Auth.currentUser.id) throw new Error('Not your deal');

            // Create escrow
            const escrow = Escrow.create(deals[idx]);
            
            deals[idx].status = 'in_progress';
            deals[idx].escrowId = escrow.id;
            Store.set('deals', deals);

            // Notify traveler
            Notifications.add(deals[idx].travelerId, 'payment',
                'Payment received - Deal confirmed!',
                `${Auth.currentUser.name} paid for ${deals[idx].product}. Funds are in escrow.`,
                `/deals/${dealId}`);

            // Update wallet
            Wallet.debit(Auth.currentUser.id, deals[idx].totalAmount, 'ESCROW_HOLD', `Deal #${dealId}`);

            return deals[idx];
        },

        confirmDelivery(dealId) {
            if (!Auth.currentUser) throw new Error('Must be logged in');
            
            const deals = Store.get('deals', []);
            const idx = deals.findIndex(d => d.id === dealId);
            
            if (idx === -1) throw new Error('Deal not found');
            if (deals[idx].buyerId !== Auth.currentUser.id) throw new Error('Not your deal');

            // Release escrow to traveler
            Escrow.release(deals[idx].escrowId);
            
            deals[idx].status = 'completed';
            deals[idx].completedAt = new Date().toISOString();
            Store.set('deals', deals);

            // Credit traveler
            const travelerAmount = deals[idx].dutyFreePrice + deals[idx].serviceFee;
            Wallet.credit(deals[idx].travelerId, travelerAmount, 'ESCROW_RELEASE', `Deal #${dealId}`);

            // Update stats
            Users.incrementDeliveries(deals[idx].travelerId);
            Users.incrementPurchases(deals[idx].buyerId);

            // Notify traveler
            Notifications.add(deals[idx].travelerId, 'completed',
                'Deal completed! Payment released.',
                `€${travelerAmount.toFixed(2)} has been added to your wallet.`,
                `/wallet`);

            return deals[idx];
        },

        dispute(dealId, reason) {
            if (!Auth.currentUser) throw new Error('Must be logged in');
            
            const deals = Store.get('deals', []);
            const idx = deals.findIndex(d => d.id === dealId);
            
            if (idx === -1) throw new Error('Deal not found');
            if (deals[idx].buyerId !== Auth.currentUser.id && deals[idx].travelerId !== Auth.currentUser.id) {
                throw new Error('Not your deal');
            }

            deals[idx].status = 'disputed';
            deals[idx].disputeReason = reason;
            deals[idx].disputedAt = new Date().toISOString();
            deals[idx].disputedBy = Auth.currentUser.id;
            Store.set('deals', deals);

            // Update escrow
            const escrows = Store.get('escrows', []);
            const escrowIdx = escrows.findIndex(e => e.id === deals[idx].escrowId);
            if (escrowIdx !== -1) {
                escrows[escrowIdx].status = 'disputed';
                Store.set('escrows', escrows);
            }

            // Notify other party
            const otherParty = deals[idx].buyerId === Auth.currentUser.id ? deals[idx].travelerId : deals[idx].buyerId;
            Notifications.add(otherParty, 'dispute',
                'Dispute opened on deal',
                `A dispute has been opened for ${deals[idx].product}. Our team will review.`,
                `/deals/${dealId}`);

            return deals[idx];
        }
    };

    // ==========================================
    // ESCROW MODULE
    // ==========================================

    const Escrow = {
        create(deal) {
            const escrows = Store.get('escrows', []);
            const escrow = {
                id: 'e' + Date.now(),
                dealId: deal.id,
                amount: deal.totalAmount,
                buyerId: deal.buyerId,
                travelerId: deal.travelerId,
                status: 'held',
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days
            };

            escrows.push(escrow);
            Store.set('escrows', escrows);

            return escrow;
        },

        release(escrowId) {
            const escrows = Store.get('escrows', []);
            const idx = escrows.findIndex(e => e.id === escrowId);
            
            if (idx === -1) throw new Error('Escrow not found');

            escrows[idx].status = 'released';
            escrows[idx].releasedAt = new Date().toISOString();
            Store.set('escrows', escrows);

            return escrows[idx];
        },

        refund(escrowId) {
            const escrows = Store.get('escrows', []);
            const idx = escrows.findIndex(e => e.id === escrowId);
            
            if (idx === -1) throw new Error('Escrow not found');

            escrows[idx].status = 'refunded';
            escrows[idx].refundedAt = new Date().toISOString();
            Store.set('escrows', escrows);

            // Credit buyer
            Wallet.credit(escrows[idx].buyerId, escrows[idx].amount, 'ESCROW_REFUND', `Escrow #${escrowId}`);

            return escrows[idx];
        },

        getForUser(userId) {
            const escrows = Store.get('escrows', []);
            return escrows.filter(e => e.buyerId === userId || e.travelerId === userId);
        }
    };

    // ==========================================
    // WALLET MODULE
    // ==========================================

    const Wallet = {
        get(userId) {
            const wallets = Store.get('wallets', {});
            if (!wallets[userId]) {
                wallets[userId] = {
                    balance: 0,
                    escrowHeld: 0,
                    totalEarned: 0,
                    totalSpent: 0
                };
                Store.set('wallets', wallets);
            }
            return wallets[userId];
        },

        credit(userId, amount, type, description) {
            const wallets = Store.get('wallets', {});
            if (!wallets[userId]) {
                wallets[userId] = { balance: 0, escrowHeld: 0, totalEarned: 0, totalSpent: 0 };
            }
            
            wallets[userId].balance += amount;
            wallets[userId].totalEarned += amount;
            Store.set('wallets', wallets);

            // Record transaction
            this.addTransaction(userId, {
                type: type,
                amount: amount,
                direction: 'credit',
                description: description,
                balanceAfter: wallets[userId].balance
            });

            return wallets[userId];
        },

        debit(userId, amount, type, description) {
            const wallets = Store.get('wallets', {});
            if (!wallets[userId]) {
                wallets[userId] = { balance: 0, escrowHeld: 0, totalEarned: 0, totalSpent: 0 };
            }
            
            wallets[userId].balance -= amount;
            wallets[userId].totalSpent += amount;
            
            if (type === 'ESCROW_HOLD') {
                wallets[userId].escrowHeld += amount;
            }
            
            Store.set('wallets', wallets);

            // Record transaction
            this.addTransaction(userId, {
                type: type,
                amount: amount,
                direction: 'debit',
                description: description,
                balanceAfter: wallets[userId].balance
            });

            return wallets[userId];
        },

        addFunds(userId, amount, method) {
            return this.credit(userId, amount, 'DEPOSIT', `Added via ${method}`);
        },

        withdraw(userId, amount, method) {
            const wallet = this.get(userId);
            if (wallet.balance < amount) {
                throw new Error('Insufficient balance');
            }
            return this.debit(userId, amount, 'WITHDRAWAL', `Withdrawal to ${method}`);
        },

        addTransaction(userId, data) {
            const transactions = Store.get('transactions', {});
            if (!transactions[userId]) {
                transactions[userId] = [];
            }

            transactions[userId].unshift({
                id: 'txn' + Date.now(),
                ...data,
                timestamp: new Date().toISOString()
            });

            // Keep last 100 transactions
            transactions[userId] = transactions[userId].slice(0, 100);
            Store.set('transactions', transactions);
        },

        getTransactions(userId, limit = 20) {
            const transactions = Store.get('transactions', {});
            return (transactions[userId] || []).slice(0, limit);
        }
    };

    // ==========================================
    // MESSAGES MODULE
    // ==========================================

    const Messages = {
        getForDeal(dealId) {
            const messages = Store.get('messages', []);
            return messages
                .filter(m => m.dealId === dealId)
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        },

        send(dealId, toUserId, text) {
            if (!Auth.currentUser) throw new Error('Must be logged in');
            
            const messages = Store.get('messages', []);
            const message = {
                id: 'm' + Date.now(),
                dealId: dealId,
                from: Auth.currentUser.id,
                to: toUserId,
                text: text,
                timestamp: new Date().toISOString(),
                read: false
            };

            messages.push(message);
            Store.set('messages', messages);

            // Notify recipient
            Notifications.add(toUserId, 'message',
                `New message from ${Auth.currentUser.name}`,
                text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                `/deals/${dealId}`);

            return message;
        },

        markAsRead(messageId) {
            const messages = Store.get('messages', []);
            const idx = messages.findIndex(m => m.id === messageId);
            if (idx !== -1) {
                messages[idx].read = true;
                Store.set('messages', messages);
            }
        },

        getUnreadCount(userId) {
            const messages = Store.get('messages', []);
            return messages.filter(m => m.to === userId && !m.read).length;
        }
    };

    // ==========================================
    // NOTIFICATIONS MODULE
    // ==========================================

    const Notifications = {
        add(userId, type, title, message, link = null) {
            const notifications = Store.get('notifications', []);
            notifications.unshift({
                id: 'n' + Date.now(),
                userId: userId,
                type: type,
                title: title,
                message: message,
                link: link,
                read: false,
                created: new Date().toISOString()
            });

            // Keep last 50 notifications per user
            const userNotifs = notifications.filter(n => n.userId === userId);
            if (userNotifs.length > 50) {
                const toRemove = userNotifs.slice(50).map(n => n.id);
                Store.set('notifications', notifications.filter(n => !toRemove.includes(n.id)));
            } else {
                Store.set('notifications', notifications);
            }
        },

        getForUser(userId, unreadOnly = false) {
            const notifications = Store.get('notifications', []);
            let result = notifications.filter(n => n.userId === userId);
            if (unreadOnly) {
                result = result.filter(n => !n.read);
            }
            return result.sort((a, b) => new Date(b.created) - new Date(a.created));
        },

        markAsRead(notificationId) {
            const notifications = Store.get('notifications', []);
            const idx = notifications.findIndex(n => n.id === notificationId);
            if (idx !== -1) {
                notifications[idx].read = true;
                Store.set('notifications', notifications);
            }
        },

        markAllAsRead(userId) {
            const notifications = Store.get('notifications', []);
            notifications.forEach(n => {
                if (n.userId === userId) n.read = true;
            });
            Store.set('notifications', notifications);
        },

        getUnreadCount(userId) {
            return this.getForUser(userId, true).length;
        }
    };

    // ==========================================
    // USERS MODULE
    // ==========================================

    const Users = {
        getById(id) {
            const users = Store.get('users', []);
            return users.find(u => u.id === id);
        },

        getByEmail(email) {
            const users = Store.get('users', []);
            return users.find(u => u.email.toLowerCase() === email.toLowerCase());
        },

        incrementDeliveries(userId) {
            const users = Store.get('users', []);
            const idx = users.findIndex(u => u.id === userId);
            if (idx !== -1) {
                users[idx].deliveries = (users[idx].deliveries || 0) + 1;
                Store.set('users', users);
            }
        },

        incrementPurchases(userId) {
            const users = Store.get('users', []);
            const idx = users.findIndex(u => u.id === userId);
            if (idx !== -1) {
                users[idx].purchases = (users[idx].purchases || 0) + 1;
                Store.set('users', users);
            }
        },

        updateRating(userId, newRating) {
            const users = Store.get('users', []);
            const idx = users.findIndex(u => u.id === userId);
            if (idx !== -1) {
                const oldRating = users[idx].rating || 0;
                const totalDeals = (users[idx].deliveries || 0) + (users[idx].purchases || 0);
                // Weighted average
                users[idx].rating = totalDeals > 0 
                    ? ((oldRating * (totalDeals - 1)) + newRating) / totalDeals 
                    : newRating;
                Store.set('users', users);
            }
        },

        search(query) {
            const users = Store.get('users', []);
            const q = query.toLowerCase();
            return users.filter(u => 
                u.name.toLowerCase().includes(q) || 
                u.email.toLowerCase().includes(q) ||
                u.location?.toLowerCase().includes(q)
            );
        }
    };

    // ==========================================
    // UI HELPERS
    // ==========================================

    const UI = {
        toast(message, type = 'success') {
            let container = document.getElementById('toastContainer');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toastContainer';
                container.style.cssText = 'position:fixed;bottom:2rem;right:2rem;z-index:9999;display:flex;flex-direction:column;gap:0.75rem;';
                document.body.appendChild(container);
            }

            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `
                <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
                <span class="toast-message">${message}</span>
                <button class="toast-close" onclick="this.parentElement.remove()">×</button>
            `;
            toast.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:1rem 1.5rem;background:#18181b;border:1px solid #27272a;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.3);animation:slideIn 0.3s ease;color:#fafafa;';
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        },

        showLoading(text = 'Loading...') {
            let overlay = document.getElementById('loadingOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'loadingOverlay';
                overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem;';
                overlay.innerHTML = `
                    <div style="width:48px;height:48px;border:3px solid #27272a;border-top-color:#d4a853;border-radius:50%;animation:spin 1s linear infinite;"></div>
                    <span style="color:#a1a1aa;" id="loadingText">${text}</span>
                    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
                `;
                document.body.appendChild(overlay);
            } else {
                document.getElementById('loadingText').textContent = text;
                overlay.style.display = 'flex';
            }
        },

        hideLoading() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) overlay.style.display = 'none';
        },

        confirm(message) {
            return new Promise((resolve) => {
                const modal = document.createElement('div');
                modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;';
                modal.innerHTML = `
                    <div style="background:#18181b;border:1px solid #27272a;border-radius:16px;padding:2rem;max-width:400px;text-align:center;">
                        <p style="color:#fafafa;margin-bottom:1.5rem;font-size:1.1rem;">${message}</p>
                        <div style="display:flex;gap:1rem;justify-content:center;">
                            <button class="btn btn-outline" onclick="this.closest('div').parentElement.remove(); window._confirmResolve(false);">Cancel</button>
                            <button class="btn btn-primary" onclick="this.closest('div').parentElement.remove(); window._confirmResolve(true);">Confirm</button>
                        </div>
                    </div>
                `;
                window._confirmResolve = resolve;
                document.body.appendChild(modal);
            });
        },

        showAuthModal(tab = 'login', callback = null) {
            // Check if modal exists, create if not
            let modal = document.getElementById('authModal');
            if (!modal) {
                // Create the auth modal dynamically (same as in index.html)
                createAuthModal();
                modal = document.getElementById('authModal');
            }
            
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
            
            if (callback) {
                window._authCallback = callback;
            }
        },

        formatCurrency(amount, countryOrCode) {
            // Use currencies.js if available, otherwise fallback to EUR
            if (typeof formatCurrencyAmount === 'function') {
                return formatCurrencyAmount(amount, countryOrCode || 'EUR');
            }
            return '€' + parseFloat(amount).toFixed(2);
        },

        formatDate(dateStr) {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        },

        formatRelativeTime(dateStr) {
            const date = new Date(dateStr);
            const now = new Date();
            const diff = now - date;
            
            if (diff < 60000) return 'Just now';
            if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
            if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
            if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
            return this.formatDate(dateStr);
        }
    };

    // ==========================================
    // INITIALIZE
    // ==========================================

    async function init() {
        initializeData();
        await Auth.init();
        // Show cookie consent banner if not accepted
        CookieConsent.showModal();
        console.log('FlyAndEarn MVP initialized');
    }

    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init());
    } else {
        init();
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    return {
        Auth,
        Requests,
        Trips,
        Deals,
        Escrow,
        Wallet,
        Messages,
        Notifications,
        Users,
        UI,
        Store,
        Security,
        CookieConsent,
        init
    };

})();

// Make it globally available
window.FlyAndEarn = FlyAndEarn;
window.FAE = FlyAndEarn; // Short alias
