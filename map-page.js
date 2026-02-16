/**
 * FlyAndEarn Map Page
 * Interactive map for finding nearby Travelers and Buyers
 */

(function() {
    'use strict';

    // State
    let map = null;
    let markers = [];
    let currentUser = null;
    let allUsers = [];
    let nearbyUsers = [];
    let radiusKm = 25;
    let showAll = false;

    // Colors
    const COLORS = {
        TRAVELER: '#d4a853',  // gold
        BUYER: '#2dd4bf',     // teal
        CURRENT: '#ef4444',   // red
        NEARBY: '#f59e0b',    // amber
    };

    // Default center (Europe)
    const DEFAULT_CENTER = [50, 10];
    const DEFAULT_ZOOM = 5;

    // DOM Elements
    const elements = {
        map: document.getElementById('map'),
        radiusSelect: document.getElementById('radius-select'),
        showAllCheckbox: document.getElementById('show-all'),
        nearbyCount: document.getElementById('nearby-count'),
        totalCount: document.getElementById('total-count'),
        nearbySection: document.getElementById('nearby-section'),
        nearbyTitle: document.getElementById('nearby-title'),
        nearbyList: document.getElementById('nearby-list'),
        currentUserInfo: document.getElementById('current-user-info'),
        updateLocationBtn: document.getElementById('update-location-btn'),
        useBrowserLocationBtn: document.getElementById('use-browser-location-btn'),
        loginNotice: document.getElementById('login-notice'),
    };

    // Initialize
    async function init() {
        initMap();
        setupEventListeners();
        await loadMapData();
    }

    // Initialize Leaflet map
    function initMap() {
        map = L.map('map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

        // Use CartoDB dark tiles for consistent look
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);
    }

    // Setup event listeners
    function setupEventListeners() {
        elements.radiusSelect.addEventListener('change', (e) => {
            radiusKm = parseInt(e.target.value, 10);
            updateDisplay();
        });

        elements.showAllCheckbox.addEventListener('change', (e) => {
            showAll = e.target.checked;
            elements.radiusSelect.disabled = showAll;
            updateDisplay();
        });

        elements.updateLocationBtn.addEventListener('click', updateLocationFromAddress);
        elements.useBrowserLocationBtn.addEventListener('click', updateLocationFromBrowser);
    }

    // Load map data from API
    async function loadMapData() {
        try {
            const params = new URLSearchParams(window.location.search);
            const userId = params.get('userId');

            const response = await fetch(`/.netlify/functions/map-users?showAll=true&radiusKm=${radiusKm}${userId ? `&userId=${userId}` : ''}`, {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to load map data');
            }

            const data = await response.json();

            allUsers = data.users || [];
            currentUser = data.currentUser;
            nearbyUsers = data.nearbyUsers || [];

            updateDisplay();
            updateCurrentUserInfo();

        } catch (error) {
            console.error('Error loading map data:', error);
            showNotification('Failed to load map data', 'error');
        }
    }

    // Update map display
    function updateDisplay() {
        clearMarkers();

        if (currentUser && !showAll) {
            // Calculate nearby users on client side for responsiveness
            nearbyUsers = calculateNearbyUsers();
        } else {
            nearbyUsers = [];
        }

        const nearbyIds = new Set(nearbyUsers.map(u => u.id));

        // Add markers for all users
        allUsers.forEach(user => {
            if (!user.latitude || !user.longitude) return;

            const isCurrentUser = currentUser && user.id === currentUser.id;
            const isNearby = nearbyIds.has(user.id);

            let color = user.role === 'TRAVELER' ? COLORS.TRAVELER : COLORS.BUYER;
            if (isCurrentUser) {
                color = COLORS.CURRENT;
            } else if (isNearby) {
                color = COLORS.NEARBY;
            }

            const marker = createMarker(user, color, isCurrentUser);
            markers.push(marker);
        });

        // Update stats
        elements.totalCount.textContent = allUsers.length;
        elements.nearbyCount.textContent = nearbyUsers.length;

        // Update nearby list
        updateNearbyList();

        // Center map on current user if available
        if (currentUser && currentUser.latitude && currentUser.longitude) {
            map.setView([currentUser.latitude, currentUser.longitude], 10);
        }
    }

    // Calculate nearby users (opposite role within radius)
    function calculateNearbyUsers() {
        if (!currentUser || !currentUser.latitude || !currentUser.longitude) {
            return [];
        }

        const oppositeRole = currentUser.role === 'TRAVELER' ? 'BUYER' : 'TRAVELER';

        return allUsers
            .filter(u => {
                if (u.id === currentUser.id) return false;
                if (u.role !== oppositeRole) return false;
                if (!u.latitude || !u.longitude) return false;

                const distance = haversineDistance(
                    currentUser.latitude,
                    currentUser.longitude,
                    u.latitude,
                    u.longitude
                );
                return distance <= radiusKm;
            })
            .map(u => ({
                ...u,
                distance: haversineDistance(
                    currentUser.latitude,
                    currentUser.longitude,
                    u.latitude,
                    u.longitude
                ),
            }))
            .sort((a, b) => a.distance - b.distance);
    }

    // Haversine distance formula
    function haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // km
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function toRad(deg) {
        return deg * (Math.PI / 180);
    }

    // Create map marker
    function createMarker(user, color, isCurrentUser) {
        const size = isCurrentUser ? 16 : 12;

        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                background-color: ${color};
                width: ${size}px;
                height: ${size}px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                ${isCurrentUser ? 'display: flex; align-items: center; justify-content: center;' : ''}
            ">${isCurrentUser ? '<span style="color: white; font-size: 10px;">★</span>' : ''}</div>`,
            iconSize: [size + 6, size + 6],
            iconAnchor: [(size + 6) / 2, (size + 6) / 2],
        });

        const marker = L.marker([user.latitude, user.longitude], { icon }).addTo(map);

        // Popup content
        const roleColor = user.role === 'TRAVELER' ? COLORS.TRAVELER : COLORS.BUYER;
        const roleLabel = user.role === 'TRAVELER' ? 'Traveler' : 'Buyer';
        const distanceHtml = user.distance !== undefined
            ? `<div class="popup-distance">${user.distance.toFixed(1)} km away</div>`
            : '';

        const gmapsEmbedUrl = `https://maps.google.com/maps?q=${user.latitude},${user.longitude}&z=12&output=embed`;
        const gmapsLinkUrl = `https://www.google.com/maps?q=${user.latitude},${user.longitude}`;

        marker.bindPopup(`
            <div class="popup-name">${user.name}${isCurrentUser ? ' (You)' : ''}</div>
            <span class="popup-role" style="background: ${roleColor}; color: white;">${roleLabel}</span>
            <div class="popup-location">${user.city || ''}${user.city && user.country ? ', ' : ''}${user.country || ''}</div>
            ${distanceHtml}
            <iframe width="220" height="120" frameborder="0" style="border:0;border-radius:8px;margin-top:8px;" src="${gmapsEmbedUrl}" allowfullscreen loading="lazy"></iframe>
            <div style="margin-top:6px;display:flex;gap:6px;">
                <a href="${gmapsLinkUrl}" target="_blank" rel="noopener" style="font-size:0.75rem;color:#d4a853;text-decoration:none;">📍 View on Google Maps</a>
                <a href="/dashboard" style="font-size:0.75rem;color:#2dd4bf;text-decoration:none;">💬 Contact</a>
            </div>
        `, { maxWidth: 260 });

        return marker;
    }

    // Clear all markers
    function clearMarkers() {
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
    }

    // Update current user info display
    function updateCurrentUserInfo() {
        if (currentUser) {
            const roleClass = currentUser.role === 'TRAVELER' ? 'role-traveler' : 'role-buyer';
            const roleLabel = currentUser.role === 'TRAVELER' ? 'Traveler' : 'Buyer';

            elements.currentUserInfo.innerHTML = `
                <div class="current-user-badge">
                    <span>${currentUser.name}</span>
                    <span class="user-role-tag ${roleClass}">${roleLabel}</span>
                </div>
            `;
            elements.loginNotice.style.display = 'none';

            // Update nearby title
            const oppositeRole = currentUser.role === 'TRAVELER' ? 'Buyers' : 'Travelers';
            elements.nearbyTitle.textContent = `Nearby ${oppositeRole}`;
        } else {
            elements.currentUserInfo.innerHTML = '';
            elements.loginNotice.style.display = 'block';
            elements.nearbyTitle.textContent = 'Nearby Users';
        }
    }

    // Update nearby users list
    function updateNearbyList() {
        if (nearbyUsers.length === 0 || showAll) {
            elements.nearbySection.style.display = 'none';
            return;
        }

        elements.nearbySection.style.display = 'block';

        elements.nearbyList.innerHTML = nearbyUsers.map(user => `
            <div class="nearby-item" data-lat="${user.latitude}" data-lng="${user.longitude}">
                <div class="nearby-info">
                    <h4>${user.name}</h4>
                    <p>${user.city || ''}${user.city && user.country ? ', ' : ''}${user.country || ''}</p>
                </div>
                <span class="nearby-distance">${user.distance.toFixed(1)} km</span>
            </div>
        `).join('');

        // Add click handlers to pan to user
        elements.nearbyList.querySelectorAll('.nearby-item').forEach(item => {
            item.addEventListener('click', () => {
                const lat = parseFloat(item.dataset.lat);
                const lng = parseFloat(item.dataset.lng);
                map.setView([lat, lng], 14);
            });
        });
    }

    // Update location from address (geocode)
    async function updateLocationFromAddress() {
        if (!currentUser) {
            showNotification('Please log in to update your location', 'error');
            return;
        }

        elements.updateLocationBtn.disabled = true;
        elements.updateLocationBtn.textContent = '⏳ Geocoding...';

        try {
            const response = await fetch('/.netlify/functions/update-location', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ geocodeAddress: true }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update location');
            }

            showNotification('Location updated from your address!', 'success');
            await loadMapData();

        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            elements.updateLocationBtn.disabled = false;
            elements.updateLocationBtn.textContent = '📍 Update My Location';
        }
    }

    // Update location from browser geolocation
    async function updateLocationFromBrowser() {
        if (!currentUser) {
            showNotification('Please log in to update your location', 'error');
            return;
        }

        if (!navigator.geolocation) {
            showNotification('Geolocation is not supported by your browser', 'error');
            return;
        }

        elements.useBrowserLocationBtn.disabled = true;
        elements.useBrowserLocationBtn.textContent = '⏳ Getting location...';

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const response = await fetch('/.netlify/functions/update-location', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            fromBrowser: true,
                        }),
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to update location');
                    }

                    showNotification('Location updated from browser!', 'success');
                    await loadMapData();

                } catch (error) {
                    showNotification(error.message, 'error');
                } finally {
                    elements.useBrowserLocationBtn.disabled = false;
                    elements.useBrowserLocationBtn.textContent = '🌐 Use Browser Location';
                }
            },
            (error) => {
                showNotification(`Geolocation error: ${error.message}`, 'error');
                elements.useBrowserLocationBtn.disabled = false;
                elements.useBrowserLocationBtn.textContent = '🌐 Use Browser Location';
            },
            { enableHighAccuracy: true }
        );
    }

    // Show notification
    function showNotification(message, type = 'info') {
        // Use existing notification system if available, otherwise alert
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            alert(message);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
