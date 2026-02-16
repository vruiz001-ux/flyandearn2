        // ==========================================
        // FLYANDEARN - COMPLETE FUNCTIONALITY
        // ==========================================
        // DATA STORE (localStorage persistence)
        // ==========================================
        
        const Store = {
            get: (key, defaultValue = null) => {
                try {
                    const item = localStorage.getItem(`flyandearn_${key}`);
                    return item ? JSON.parse(item) : defaultValue;
                } catch { return defaultValue; }
            },
            set: (key, value) => {
                try {
                    localStorage.setItem(`flyandearn_${key}`, JSON.stringify(value));
                } catch (e) { console.warn('Storage error:', e); }
            },
            remove: (key) => localStorage.removeItem(`flyandearn_${key}`)
        };

        // Initialize user data
        let currentUser = Store.get('user', null);
        let requests = Store.get('requests', []);

        // ==========================================
        // LIVE STATS TRACKING
        // ==========================================

        const Stats = {
            // Get all stats from localStorage
            get() {
                return {
                    totalSavings: Store.get('stats_totalSavings', 0),
                    activeTravelers: Store.get('stats_activeTravelers', 0),
                    completedDeliveries: Store.get('stats_completedDeliveries', 0),
                    totalFees: Store.get('stats_totalFees', 0)
                };
            },

            // Calculate average fee
            getAvgFee() {
                const stats = this.get();
                if (stats.completedDeliveries === 0) return 0;
                return Math.round(stats.totalFees / stats.completedDeliveries);
            },

            // Record a completed transaction
            recordTransaction(savings, fee) {
                const stats = this.get();
                Store.set('stats_totalSavings', stats.totalSavings + savings);
                Store.set('stats_totalFees', stats.totalFees + fee);
                Store.set('stats_completedDeliveries', stats.completedDeliveries + 1);
                this.updateDisplay();
            },

            // Register a new traveler
            registerTraveler() {
                const stats = this.get();
                Store.set('stats_activeTravelers', stats.activeTravelers + 1);
                this.updateDisplay();
            },

            // Remove a traveler (if account deleted)
            removeTraveler() {
                const stats = this.get();
                if (stats.activeTravelers > 0) {
                    Store.set('stats_activeTravelers', stats.activeTravelers - 1);
                    this.updateDisplay();
                }
            },

            // Format number with currency or suffix
            formatNumber(num, prefix = '') {
                if (num >= 1000000) {
                    return prefix + (num / 1000000).toFixed(1) + 'M+';
                } else if (num >= 1000) {
                    return prefix + (num / 1000).toFixed(1) + 'K+';
                }
                return prefix + num.toLocaleString();
            },

            // Update stats display (hero stats section was removed in redesign)
            updateDisplay() {
                // No-op: hero stats elements no longer exist
                // Stats are still tracked in localStorage for future use
            },

            // Initialize stats display on page load
            init() {
                this.updateDisplay();
            }
        };

        // ==========================================
        // MESSAGING SYSTEM
        // ==========================================

        const Messages = {
            // Get all conversations
            getConversations() {
                return Store.get('conversations', []);
            },

            // Get messages for a specific conversation
            getMessages(conversationId) {
                const conversations = this.getConversations();
                const convo = conversations.find(c => c.id === conversationId);
                return convo ? convo.messages : [];
            },

            // Create or get conversation between two users
            getOrCreateConversation(userId, otherUserId, otherUserName, requestId = null) {
                let conversations = this.getConversations();

                // Find existing conversation
                let convo = conversations.find(c =>
                    (c.participants.includes(userId) && c.participants.includes(otherUserId)) &&
                    (requestId ? c.requestId === requestId : true)
                );

                if (!convo) {
                    convo = {
                        id: 'conv_' + Date.now(),
                        participants: [userId, otherUserId],
                        participantNames: { [userId]: currentUser?.name || 'You', [otherUserId]: otherUserName },
                        requestId: requestId,
                        messages: [],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    conversations.push(convo);
                    Store.set('conversations', conversations);
                }

                return convo;
            },

            // Send a message
            send(conversationId, senderId, text) {
                if (!text.trim()) return null;

                let conversations = this.getConversations();
                const convoIndex = conversations.findIndex(c => c.id === conversationId);

                if (convoIndex === -1) return null;

                const message = {
                    id: 'msg_' + Date.now(),
                    senderId: senderId,
                    text: text.trim(),
                    timestamp: new Date().toISOString(),
                    read: false
                };

                conversations[convoIndex].messages.push(message);
                conversations[convoIndex].updatedAt = new Date().toISOString();
                Store.set('conversations', conversations);

                this.updateUnreadBadge();
                return message;
            },

            // Mark messages as read
            markAsRead(conversationId, userId) {
                let conversations = this.getConversations();
                const convoIndex = conversations.findIndex(c => c.id === conversationId);

                if (convoIndex === -1) return;

                conversations[convoIndex].messages.forEach(msg => {
                    if (msg.senderId !== userId) {
                        msg.read = true;
                    }
                });

                Store.set('conversations', conversations);
                this.updateUnreadBadge();
            },

            // Get unread count
            getUnreadCount(userId) {
                const conversations = this.getConversations();
                let count = 0;

                conversations.forEach(convo => {
                    if (convo.participants.includes(userId)) {
                        convo.messages.forEach(msg => {
                            if (msg.senderId !== userId && !msg.read) {
                                count++;
                            }
                        });
                    }
                });

                return count;
            },

            // Update unread badge in UI
            updateUnreadBadge() {
                if (!currentUser) return;

                const count = this.getUnreadCount(currentUser.id);
                const badges = document.querySelectorAll('.messages-badge');

                badges.forEach(badge => {
                    if (count > 0) {
                        badge.textContent = count > 99 ? '99+' : count;
                        badge.style.display = 'flex';
                    } else {
                        badge.style.display = 'none';
                    }
                });
            },

            // Format timestamp
            formatTime(timestamp) {
                const date = new Date(timestamp);
                const now = new Date();
                const diff = now - date;

                if (diff < 60000) return 'Just now';
                if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
                if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
                if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
                return date.toLocaleDateString();
            },

            // Initialize
            init() {
                this.updateUnreadBadge();
            }
        };

        // Open messaging modal
        function openMessagesModal(conversationId = null) {
            if (!currentUser) {
                openAuthModal();
                return;
            }

            const existingModal = document.getElementById('messagesModal');
            if (existingModal) existingModal.remove();

            const modal = document.createElement('div');
            modal.id = 'messagesModal';
            modal.className = 'cookie-modal';
            modal.style.display = 'flex';

            const conversations = Messages.getConversations().filter(c =>
                c.participants.includes(currentUser.id)
            ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            modal.innerHTML = `
                <div class="cookie-modal-content" style="max-width: 900px; max-height: 90vh; display: flex; flex-direction: column;">
                    <div class="cookie-modal-header">
                        <h3>💬 Messages</h3>
                        <button class="cookie-modal-close" onclick="closeMessagesModal()">×</button>
                    </div>
                    <div style="display: flex; flex: 1; min-height: 400px; overflow: hidden;">
                        <!-- Conversations List -->
                        <div id="conversationsList" style="width: 280px; border-right: 1px solid var(--border); overflow-y: auto;">
                            ${conversations.length === 0 ? `
                                <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
                                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
                                    <p>No conversations yet</p>
                                    <p style="font-size: 0.8rem;">Start by contacting a traveler or buyer</p>
                                </div>
                            ` : conversations.map(c => {
                                const otherUserId = c.participants.find(p => p !== currentUser.id);
                                const otherName = c.participantNames[otherUserId] || 'User';
                                const lastMsg = c.messages[c.messages.length - 1];
                                const unread = c.messages.filter(m => m.senderId !== currentUser.id && !m.read).length;

                                return `
                                    <div class="conversation-item ${conversationId === c.id ? 'active' : ''}"
                                         onclick="selectConversation('${c.id}')"
                                         style="padding: 1rem; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s;">
                                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                                            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-gold), var(--accent-teal)); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.9rem;">
                                                ${otherName.charAt(0).toUpperCase()}
                                            </div>
                                            <div style="flex: 1; min-width: 0;">
                                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                                    <span style="font-weight: 600;">${otherName}</span>
                                                    ${unread > 0 ? `<span style="background: var(--accent-gold); color: #000; padding: 0.1rem 0.5rem; border-radius: 10px; font-size: 0.7rem; font-weight: 600;">${unread}</span>` : ''}
                                                </div>
                                                <p style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0.25rem 0 0 0;">
                                                    ${lastMsg ? lastMsg.text.substring(0, 30) + (lastMsg.text.length > 30 ? '...' : '') : 'No messages'}
                                                </p>
                                                <span style="font-size: 0.7rem; color: var(--text-muted);">${lastMsg ? Messages.formatTime(lastMsg.timestamp) : ''}</span>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <!-- Chat Area -->
                        <div id="chatArea" style="flex: 1; display: flex; flex-direction: column;">
                            <div id="chatMessages" style="flex: 1; overflow-y: auto; padding: 1rem;">
                                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted);">
                                    Select a conversation to start messaging
                                </div>
                            </div>
                            <div id="chatInput" style="padding: 1rem; border-top: 1px solid var(--border); display: none;">
                                <form onsubmit="sendMessage(event)" style="display: flex; gap: 0.5rem;">
                                    <input type="text" id="messageInput" placeholder="Type a message..."
                                           style="flex: 1; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 25px; background: var(--bg-secondary); color: var(--text-primary);">
                                    <button type="submit" class="btn btn-primary" style="border-radius: 25px; padding: 0.75rem 1.5rem;">Send</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Add hover styles
            const style = document.createElement('style');
            style.textContent = `
                .conversation-item:hover { background: var(--bg-secondary); }
                .conversation-item.active { background: var(--bg-secondary); border-left: 3px solid var(--accent-gold); }
                .message-bubble { max-width: 70%; padding: 0.75rem 1rem; border-radius: 18px; margin-bottom: 0.5rem; }
                .message-sent { background: var(--accent-gold); color: #000; margin-left: auto; border-bottom-right-radius: 4px; }
                .message-received { background: var(--bg-secondary); border-bottom-left-radius: 4px; }
            `;
            modal.appendChild(style);

            if (conversationId) {
                selectConversation(conversationId);
            }
        }

        // Select a conversation
        let currentConversationId = null;

        function selectConversation(conversationId) {
            currentConversationId = conversationId;

            // Update active state
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('onclick').includes(conversationId)) {
                    item.classList.add('active');
                }
            });

            // Mark as read
            Messages.markAsRead(conversationId, currentUser.id);

            // Load messages
            const messages = Messages.getMessages(conversationId);
            const conversations = Messages.getConversations();
            const convo = conversations.find(c => c.id === conversationId);
            const otherUserId = convo.participants.find(p => p !== currentUser.id);
            const otherName = convo.participantNames[otherUserId] || 'User';

            const chatMessages = document.getElementById('chatMessages');
            const chatInput = document.getElementById('chatInput');

            if (messages.length === 0) {
                chatMessages.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted);">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">👋</div>
                        <p>Start a conversation with ${otherName}</p>
                    </div>
                `;
            } else {
                chatMessages.innerHTML = messages.map(msg => `
                    <div class="message-bubble ${msg.senderId === currentUser.id ? 'message-sent' : 'message-received'}">
                        <p style="margin: 0;">${msg.text}</p>
                        <span style="font-size: 0.65rem; opacity: 0.7;">${Messages.formatTime(msg.timestamp)}</span>
                    </div>
                `).join('');

                // Scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }

            chatInput.style.display = 'block';
            document.getElementById('messageInput').focus();
        }

        // Send message
        function sendMessage(event) {
            event.preventDefault();

            if (!currentConversationId || !currentUser) return;

            const input = document.getElementById('messageInput');
            const text = input.value.trim();

            if (!text) return;

            Messages.send(currentConversationId, currentUser.id, text);
            input.value = '';

            // Reload conversation
            selectConversation(currentConversationId);

            // Simulate reply after 2-5 seconds (demo only)
            if (Math.random() > 0.5) {
                setTimeout(() => {
                    const conversations = Messages.getConversations();
                    const convo = conversations.find(c => c.id === currentConversationId);
                    if (convo) {
                        const otherUserId = convo.participants.find(p => p !== currentUser.id);
                        const autoReplies = [
                            "Thanks for your message! I'll check and get back to you.",
                            "Great! When would you like to meet?",
                            "I can do that. What's your preferred location?",
                            "Sounds good! Let me confirm the details.",
                            "Perfect, I'll have it ready for you."
                        ];
                        Messages.send(currentConversationId, otherUserId, autoReplies[Math.floor(Math.random() * autoReplies.length)]);

                        // Update if modal is still open
                        if (document.getElementById('messagesModal')) {
                            selectConversation(currentConversationId);
                            showToast('New message received', 'info');
                        }
                    }
                }, 2000 + Math.random() * 3000);
            }
        }

        // Close messages modal
        function closeMessagesModal() {
            const modal = document.getElementById('messagesModal');
            if (modal) modal.remove();
            currentConversationId = null;
        }

        // Start conversation with a user (from request card or profile)
        function startConversation(otherUserId, otherUserName, requestId = null) {
            if (!currentUser) {
                openAuthModal();
                return;
            }

            const convo = Messages.getOrCreateConversation(currentUser.id, otherUserId, otherUserName, requestId);
            openMessagesModal(convo.id);
        }

        // ==========================================
        // MOBILE NAVIGATION
        // ==========================================
        
        function toggleMobileMenu() {
            const mobileNav = document.getElementById('mobileNav');
            const menuBtn = document.getElementById('mobileMenuBtn');
            const isOpen = mobileNav.classList.contains('show');
            
            if (isOpen) {
                closeMobileMenu();
            } else {
                mobileNav.classList.add('show');
                menuBtn.textContent = '✕';
                document.body.style.overflow = 'hidden';
            }
        }
        
        function closeMobileMenu() {
            const mobileNav = document.getElementById('mobileNav');
            const menuBtn = document.getElementById('mobileMenuBtn');
            mobileNav.classList.remove('show');
            menuBtn.textContent = '☰';
            document.body.style.overflow = '';
        }
        
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) closeMobileMenu();
        });

        // ==========================================
        // TOAST NOTIFICATIONS
        // ==========================================

        function showToast(message, type = 'success') {
            const container = document.getElementById('toastContainer') || createToastContainer();
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `
                <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
                <span class="toast-message">${message}</span>
                <button class="toast-close" onclick="this.parentElement.remove()">×</button>
            `;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        }

        function createToastContainer() {
            const container = document.createElement('div');
            container.id = 'toastContainer';
            container.style.cssText = 'position:fixed;bottom:2rem;right:2rem;z-index:9999;display:flex;flex-direction:column;gap:0.75rem;';
            document.body.appendChild(container);
            
            // Add toast styles
            const style = document.createElement('style');
            style.textContent = `
                .pulse-dot { width:8px;height:8px;border-radius:50%;display:inline-block;animation:pulse 2s infinite; }
                .pulse-dot.live { background:#22c55e;box-shadow:0 0 8px #22c55e; }
                .pulse-dot.checking { background:#f59e0b;box-shadow:0 0 8px #f59e0b;animation:pulse 0.5s infinite; }
                .pulse-dot.stopped { background:#6b7280;box-shadow:none;animation:none; }
                @keyframes pulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.5;transform:scale(1.2);} }
                .toast { display:flex;align-items:center;gap:0.75rem;padding:1rem 1.5rem;background:#18181b;border:1px solid #27272a;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.3);animation:toastIn 0.3s ease; }
                .toast-success .toast-icon { color:#22c55e; }
                .toast-error .toast-icon { color:#ef4444; }
                .toast-info .toast-icon { color:#3b82f6; }
                .toast-icon { font-size:1.25rem; }
                .toast-message { flex:1;color:#fafafa; }
                .toast-close { background:none;border:none;color:#a1a1aa;cursor:pointer;font-size:1.25rem; }
                @keyframes toastIn { from{opacity:0;transform:translateX(100%)} to{opacity:1;transform:translateX(0)} }
            `;
            document.head.appendChild(style);
            return container;
        }

        // ==========================================
        // AUTH MODALS (Login/Signup)
        // ==========================================

        function createAuthModal() {
            if (document.getElementById('authModal')) return;
            
            const modal = document.createElement('div');
            modal.id = 'authModal';
            modal.className = 'auth-modal';
            modal.innerHTML = `
                <div class="auth-modal-content">
                    <button class="auth-modal-close" onclick="closeAuthModal()">×</button>
                    
                    <div id="authTabs" class="auth-tabs">
                        <button class="auth-tab active" onclick="switchAuthTab('login')">Log In</button>
                        <button class="auth-tab" onclick="switchAuthTab('signup')">Sign Up</button>
                    </div>
                    
                    <!-- Login Form -->
                    <div id="loginForm" class="auth-form">
                        <h2 class="auth-title">Welcome Back</h2>
                        <p class="auth-subtitle">Log in to access your wallet and deals</p>
                        
                        <div class="auth-field">
                            <label>Email</label>
                            <input type="email" id="loginEmail" placeholder="your@email.com">
                        </div>
                        <div class="auth-field">
                            <label>Password</label>
                            <input type="password" id="loginPassword" placeholder="••••••••">
                        </div>

                        <div class="auth-forgot" style="text-align:right;margin-bottom:1rem;">
                            <a href="/forgot-password" style="color:#d4af37;font-size:0.875rem;text-decoration:none;">Forgot password?</a>
                        </div>

                        <button type="button" class="btn btn-primary btn-full" onclick="handleLogin()">Log In</button>
                        
                        <div class="auth-divider"><span>or continue with</span></div>
                        
                        <div class="auth-social">
                            <button class="auth-social-btn" onclick="socialLogin('google')">
                                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#EA4335" d="M5.27 9.76A7.08 7.08 0 0 1 12 5.18c1.68 0 3.19.55 4.4 1.57l3.27-3.27A11.9 11.9 0 0 0 12 0 12 12 0 0 0 1.24 6.65l4.03 3.11Z"/><path fill="#34A853" d="m23.49 12.27-.01-.18H12v4.63h6.47a5.53 5.53 0 0 1-2.4 3.63l3.88 3.01a11.99 11.99 0 0 0 3.54-11.09Z"/><path fill="#4285F4" d="M5.27 14.24A7.18 7.18 0 0 1 4.8 12c0-.79.15-1.55.38-2.24L1.24 6.65A12.04 12.04 0 0 0 0 12c0 1.94.46 3.77 1.24 5.35l4.03-3.11Z"/><path fill="#FBBC05" d="M12 24a11.9 11.9 0 0 0 7.67-2.84l-3.88-3.01a7.13 7.13 0 0 1-10.52-3.91L1.24 17.35A12 12 0 0 0 12 24Z"/></svg>
                                Google
                            </button>
                            <button class="auth-social-btn" onclick="socialLogin('apple')">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                                Apple
                            </button>
                        </div>
                        
                        <p class="auth-footer">Don't have an account? <a href="#" onclick="switchAuthTab('signup'); return false;">Sign up</a></p>
                    </div>
                    
                    <!-- Signup Form -->
                    <div id="signupForm" class="auth-form" style="display:none;">
                        <h2 class="auth-title">Create Account</h2>
                        <p class="auth-subtitle">Join FlyAndEarn and start saving or earning</p>
                        
                        <div class="auth-role-toggle">
                            <p class="role-hint">Select one or both:</p>
                            <button class="role-option" data-role="buyer" onclick="toggleRole('buyer')">
                                <span class="role-check"></span>
                                <span class="role-icon">🛍️</span>
                                <span class="role-label">Requestor</span>
                                <span class="role-desc">Request items from travelers</span>
                            </button>
                            <button class="role-option" data-role="traveler" onclick="toggleRole('traveler')">
                                <span class="role-check"></span>
                                <span class="role-icon">✈️</span>
                                <span class="role-label">Traveler</span>
                                <span class="role-desc">Earn by bringing items</span>
                            </button>
                        </div>
                        
                        <div class="auth-field">
                            <label>Full Name</label>
                            <input type="text" id="signupName" placeholder="Jan Kowalski">
                        </div>
                        <div class="auth-field">
                            <label>Email</label>
                            <input type="email" id="signupEmail" placeholder="your@email.com">
                        </div>
                        <div class="auth-field">
                            <label>Password</label>
                            <input type="password" id="signupPassword" placeholder="Min. 8 characters" oninput="updatePasswordStrength(this.value)">
                            <div id="passwordStrength" class="password-strength" style="display:none;">
                                <div class="strength-bar"><div class="strength-fill"></div></div>
                                <span class="strength-text"></span>
                            </div>
                            <ul id="passwordRequirements" class="password-requirements">
                                <li id="req-length">At least 8 characters</li>
                                <li id="req-upper">One uppercase letter</li>
                                <li id="req-lower">One lowercase letter</li>
                                <li id="req-number">One number</li>
                            </ul>
                        </div>
                        <div class="auth-field">
                            <label>Confirm Password</label>
                            <input type="password" id="signupConfirmPassword" placeholder="Re-enter password">
                        </div>

                        <!-- Address Fields (shown for travelers) -->
                        <div id="travelerAddressFields" style="display:none;">
                            <div class="address-section-header">
                                <span class="address-icon">📍</span>
                                <span>Your Address</span>
                                <small style="color:#a1a1aa;display:block;margin-top:0.25rem;">Required for travelers - determines your wallet currency</small>
                            </div>
                            <div class="auth-field">
                                <label>Street Address</label>
                                <input type="text" id="signupStreet" placeholder="ul. Marszałkowska 1/2">
                            </div>
                            <div class="auth-field-row">
                                <div class="auth-field">
                                    <label>City</label>
                                    <input type="text" id="signupCity" placeholder="Warsaw">
                                </div>
                                <div class="auth-field">
                                    <label>Postal Code</label>
                                    <input type="text" id="signupPostalCode" placeholder="00-001">
                                </div>
                            </div>
                            <div class="auth-field">
                                <label>Country</label>
                                <select id="signupCountry" class="auth-select">
                                    <option value="">Select your country</option>
                                    <option value="Poland">🇵🇱 Poland (PLN)</option>
                                    <option value="Germany">🇩🇪 Germany (EUR)</option>
                                    <option value="France">🇫🇷 France (EUR)</option>
                                    <option value="Netherlands">🇳🇱 Netherlands (EUR)</option>
                                    <option value="Belgium">🇧🇪 Belgium (EUR)</option>
                                    <option value="Austria">🇦🇹 Austria (EUR)</option>
                                    <option value="Spain">🇪🇸 Spain (EUR)</option>
                                    <option value="Italy">🇮🇹 Italy (EUR)</option>
                                    <option value="Portugal">🇵🇹 Portugal (EUR)</option>
                                    <option value="Ireland">🇮🇪 Ireland (EUR)</option>
                                    <option value="United Kingdom">🇬🇧 United Kingdom (GBP)</option>
                                    <option value="Switzerland">🇨🇭 Switzerland (CHF)</option>
                                    <option value="Sweden">🇸🇪 Sweden (SEK)</option>
                                    <option value="Norway">🇳🇴 Norway (NOK)</option>
                                    <option value="Denmark">🇩🇰 Denmark (DKK)</option>
                                    <option value="Czech Republic">🇨🇿 Czech Republic (CZK)</option>
                                    <option value="Other">Other (EUR)</option>
                                </select>
                            </div>
                            <div id="currencyNotice" class="currency-notice" style="display:none;">
                                Your wallet will use <strong id="walletCurrencyDisplay">EUR</strong>
                            </div>
                        </div>

                        <label class="auth-checkbox">
                            <input type="checkbox" id="signupTerms">
                            <span>I agree to the <a href="#" onclick="openTermsModal(); return false;">Terms of Service</a> and <a href="#" onclick="openPrivacyPolicy(); return false;">Privacy Policy</a></span>
                        </label>
                        
                        <button class="btn btn-primary btn-full" onclick="handleSignup()">Create Account</button>
                        
                        <p class="auth-footer">Already have an account? <a href="#" onclick="switchAuthTab('login'); return false;">Log in</a></p>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Add auth modal styles
            const style = document.createElement('style');
            style.textContent = `
                .auth-modal { display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(4px);z-index:10000;align-items:center;justify-content:center;padding:1rem; }
                .auth-modal.show { display:flex; }
                .auth-modal-content { background:#18181b;border:1px solid #27272a;border-radius:20px;width:100%;max-width:420px;padding:2rem;position:relative;max-height:90vh;overflow-y:auto; }
                .auth-modal-close { position:absolute;top:1rem;right:1rem;background:none;border:none;color:#a1a1aa;font-size:1.5rem;cursor:pointer; }
                .auth-tabs { display:flex;gap:0.5rem;margin-bottom:1.5rem;background:#111113;padding:0.25rem;border-radius:8px; }
                .auth-tab { flex:1;padding:0.75rem;background:none;border:none;color:#a1a1aa;cursor:pointer;border-radius:6px;transition:all 0.2s; }
                .auth-tab.active { background:#27272a;color:#fafafa; }
                .auth-title { font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;color:#fafafa; }
                .auth-subtitle { color:#a1a1aa;margin-bottom:1.5rem; }
                .auth-field { margin-bottom:1rem; }
                .auth-field label { display:block;font-size:0.875rem;color:#a1a1aa;margin-bottom:0.5rem; }
                .auth-field input { width:100%;padding:0.875rem 1rem;background:#111113;border:1px solid #27272a;border-radius:8px;color:#fafafa;font-size:1rem; }
                .auth-field input:focus { outline:none;border-color:#d4a853; }
                .btn-full { width:100%;margin-top:0.5rem; }
                .auth-divider { display:flex;align-items:center;gap:1rem;margin:1.5rem 0;color:#a1a1aa;font-size:0.875rem; }
                .auth-divider::before,.auth-divider::after { content:'';flex:1;height:1px;background:#27272a; }
                .auth-social { display:flex;gap:0.75rem; }
                .auth-social-btn { flex:1;display:flex;align-items:center;justify-content:center;gap:0.5rem;padding:0.75rem;background:#111113;border:1px solid #27272a;border-radius:8px;color:#fafafa;cursor:pointer;transition:all 0.2s; }
                .auth-social-btn:hover { background:#1f1f23;border-color:#3f3f46; }
                .auth-footer { text-align:center;margin-top:1.5rem;color:#a1a1aa;font-size:0.875rem; }
                .auth-footer a { color:#d4a853;text-decoration:none; }
                .auth-checkbox { display:flex;align-items:flex-start;gap:0.75rem;margin:1rem 0;font-size:0.875rem;color:#a1a1aa;cursor:pointer; }
                .auth-checkbox input { margin-top:0.25rem; }
                .auth-checkbox a { color:#d4a853; }
                .auth-role-toggle { display:flex;flex-direction:column;gap:0.75rem;margin-bottom:1.5rem; }
                .role-hint { font-size:0.875rem;color:#a1a1aa;margin:0 0 0.5rem 0; }
                .role-options-row { display:flex;gap:0.75rem; }
                .role-option { position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:0.25rem;padding:1rem 0.75rem;background:#111113;border:2px solid #27272a;border-radius:12px;cursor:pointer;transition:all 0.2s; }
                .role-option.active { border-color:#d4a853;background:rgba(212,168,83,0.1); }
                .role-check { position:absolute;top:8px;right:8px;width:20px;height:20px;border:2px solid #3f3f46;border-radius:50%;transition:all 0.2s; }
                .role-option.active .role-check { border-color:#d4a853;background:#d4a853; }
                .role-option.active .role-check::after { content:'';position:absolute;top:3px;left:6px;width:5px;height:9px;border:solid #111113;border-width:0 2px 2px 0;transform:rotate(45deg); }
                .role-icon { font-size:1.5rem; }
                .role-label { font-size:0.9rem;font-weight:600;color:#fafafa; }
                .role-desc { font-size:0.75rem;color:#a1a1aa;text-align:center; }
                .role-option.active .role-label { color:#d4a853; }
                .password-strength { margin-top:0.5rem; }
                .strength-bar { height:4px;background:#27272a;border-radius:2px;overflow:hidden; }
                .strength-fill { height:100%;width:0;transition:width 0.3s,background 0.3s; }
                .strength-fill.weak { width:25%;background:#ef4444; }
                .strength-fill.fair { width:50%;background:#f59e0b; }
                .strength-fill.good { width:75%;background:#22c55e; }
                .strength-fill.strong { width:100%;background:#10b981; }
                .strength-text { font-size:0.75rem;margin-top:0.25rem;display:block; }
                .strength-text.weak { color:#ef4444; }
                .strength-text.fair { color:#f59e0b; }
                .strength-text.good { color:#22c55e; }
                .auth-field-row { display:grid;grid-template-columns:1fr 1fr;gap:1rem; }
                .auth-select { width:100%;padding:0.875rem 1rem;background:#111113;border:1px solid #27272a;border-radius:8px;color:#fafafa;font-size:1rem;cursor:pointer; }
                .auth-select:focus { outline:none;border-color:#d4a853; }
                .auth-select option { background:#111113;color:#fafafa; }
                .address-section-header { display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;padding:1rem;background:rgba(212,168,83,0.1);border:1px solid rgba(212,168,83,0.3);border-radius:8px;margin-bottom:1rem;color:#d4a853;font-weight:500; }
                .address-icon { font-size:1.25rem; }
                .currency-notice { padding:0.75rem 1rem;background:rgba(45,212,191,0.1);border:1px solid rgba(45,212,191,0.3);border-radius:8px;color:#2dd4bf;font-size:0.875rem;margin-top:0.5rem; }
                .strength-text.strong { color:#10b981; }
                .password-requirements { list-style:none;padding:0;margin:0.5rem 0 0;font-size:0.75rem;color:#a1a1aa; }
                .password-requirements li { padding:0.125rem 0;padding-left:1.25rem;position:relative; }
                .password-requirements li::before { content:'○';position:absolute;left:0; }
                .password-requirements li.valid { color:#22c55e; }
                .password-requirements li.valid::before { content:'✓'; }
                .auth-error { background:rgba(239,68,68,0.1);border:1px solid #ef4444;color:#ef4444;padding:0.75rem;border-radius:8px;margin-bottom:1rem;font-size:0.875rem;display:none; }
                .auth-loading { opacity:0.7;pointer-events:none; }
            `;
            document.head.appendChild(style);
        }

        function updatePasswordStrength(password) {
            const strengthEl = document.getElementById('passwordStrength');
            const fillEl = strengthEl?.querySelector('.strength-fill');
            const textEl = strengthEl?.querySelector('.strength-text');

            if (!strengthEl || !password) {
                if (strengthEl) strengthEl.style.display = 'none';
                return;
            }

            strengthEl.style.display = 'block';

            // Check requirements
            const hasLength = password.length >= 8;
            const hasUpper = /[A-Z]/.test(password);
            const hasLower = /[a-z]/.test(password);
            const hasNumber = /[0-9]/.test(password);

            // Update requirement indicators
            document.getElementById('req-length')?.classList.toggle('valid', hasLength);
            document.getElementById('req-upper')?.classList.toggle('valid', hasUpper);
            document.getElementById('req-lower')?.classList.toggle('valid', hasLower);
            document.getElementById('req-number')?.classList.toggle('valid', hasNumber);

            // Calculate strength
            const score = [hasLength, hasUpper, hasLower, hasNumber].filter(Boolean).length;

            fillEl.className = 'strength-fill';
            textEl.className = 'strength-text';

            if (score <= 1) {
                fillEl.classList.add('weak');
                textEl.classList.add('weak');
                textEl.textContent = 'Weak';
            } else if (score === 2) {
                fillEl.classList.add('fair');
                textEl.classList.add('fair');
                textEl.textContent = 'Fair';
            } else if (score === 3) {
                fillEl.classList.add('good');
                textEl.classList.add('good');
                textEl.textContent = 'Good';
            } else {
                fillEl.classList.add('strong');
                textEl.classList.add('strong');
                textEl.textContent = 'Strong';
            }
        }

        function openAuthModal(tab = 'login') {
            createAuthModal();
            document.getElementById('authModal').classList.add('show');
            document.body.style.overflow = 'hidden';
            switchAuthTab(tab);
        }

        function closeAuthModal() {
            document.getElementById('authModal')?.classList.remove('show');
            document.body.style.overflow = '';
        }

        function switchAuthTab(tab) {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelector(`.auth-tab:${tab === 'login' ? 'first-child' : 'last-child'}`).classList.add('active');
            document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
            document.getElementById('signupForm').style.display = tab === 'signup' ? 'block' : 'none';
        }

        function selectRole(role) {
            // Legacy function - redirect to toggleRole
            toggleRole(role);
        }

        function toggleRole(role) {
            const btn = document.querySelector(`[data-role="${role}"]`);
            if (btn) {
                btn.classList.toggle('active');
            }

            // Show/hide address fields based on whether traveler is selected
            const addressFields = document.getElementById('travelerAddressFields');
            const travelerBtn = document.querySelector('[data-role="traveler"]');
            if (addressFields && travelerBtn) {
                addressFields.style.display = travelerBtn.classList.contains('active') ? 'block' : 'none';
            }

            // Ensure at least one role is selected
            const anyActive = document.querySelectorAll('.role-option.active').length > 0;
            if (!anyActive) {
                // Re-activate the clicked button if nothing is selected
                btn?.classList.add('active');
            }
        }

        function getSelectedRoles() {
            const isBuyer = document.querySelector('[data-role="buyer"]')?.classList.contains('active') || false;
            const isTraveler = document.querySelector('[data-role="traveler"]')?.classList.contains('active') || false;
            return { isBuyer, isTraveler };
        }

        function handleCountryChange() {
            const country = document.getElementById('signupCountry')?.value;
            const notice = document.getElementById('currencyNotice');
            const display = document.getElementById('walletCurrencyDisplay');

            if (!country || !notice || !display) return;

            // Determine currency based on country
            const currencyMap = {
                'Poland': 'PLN (Polish Zloty)',
                'United Kingdom': 'GBP (British Pound)',
                'Switzerland': 'CHF (Swiss Franc)',
                'Sweden': 'SEK (Swedish Krona)',
                'Norway': 'NOK (Norwegian Krone)',
                'Denmark': 'DKK (Danish Krone)',
                'Czech Republic': 'CZK (Czech Koruna)'
            };

            const currency = currencyMap[country] || 'EUR (Euro)';
            display.textContent = currency;
            notice.style.display = 'block';
        }

        // Add event listener for country change
        document.addEventListener('DOMContentLoaded', function() {
            const countrySelect = document.getElementById('signupCountry');
            if (countrySelect) {
                countrySelect.addEventListener('change', handleCountryChange);
            }
        });

        async function handleLogin() {
            const email = document.getElementById('loginEmail')?.value;
            const password = document.getElementById('loginPassword')?.value;
            const submitBtn = document.querySelector('#loginForm .btn-primary');

            if (!email || !password) {
                showToast('Please fill in all fields', 'error');
                return;
            }

            // Show loading state
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';

            try {
                const response = await fetch('/.netlify/functions/login', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.details || data.error || 'Login failed');
                }

                currentUser = data.user;
                Store.set('user', currentUser);
                closeAuthModal();
                updateUIForUser();
                updateSavingsCalculatorCurrency();
                showToast(`Welcome back, ${currentUser.name}!`, 'success');
            } catch (error) {
                showToast(error.message || 'Login failed. Please try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Log In';
            }
        }

        async function getLocationData() {
            return new Promise((resolve) => {
                if (!navigator.geolocation) {
                    resolve(null);
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        const { latitude, longitude } = pos.coords;
                        // Try reverse geocoding with OpenStreetMap Nominatim
                        try {
                            const geoResponse = await fetch(
                                `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
                                { headers: { 'Accept-Language': 'en' } }
                            );
                            const geoData = await geoResponse.json();
                            resolve({
                                latitude,
                                longitude,
                                city: geoData.address?.city || geoData.address?.town || geoData.address?.village || geoData.address?.municipality || null,
                                country: geoData.address?.country || null
                            });
                        } catch {
                            resolve({ latitude, longitude, city: null, country: null });
                        }
                    },
                    () => resolve(null),
                    { timeout: 10000, enableHighAccuracy: false }
                );
            });
        }

        async function handleSignup() {
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('signupConfirmPassword').value;
            const terms = document.getElementById('signupTerms').checked;
            const { isBuyer, isTraveler } = getSelectedRoles();
            const submitBtn = document.querySelector('#signupForm .btn-primary');

            // Get address fields for travelers
            const street = document.getElementById('signupStreet')?.value?.trim();
            const city = document.getElementById('signupCity')?.value?.trim();
            const postalCode = document.getElementById('signupPostalCode')?.value?.trim();
            const country = document.getElementById('signupCountry')?.value;

            if (!name || !email || !password || !confirmPassword) {
                showToast('Please fill in all fields', 'error');
                return;
            }

            // Check at least one role is selected
            if (!isBuyer && !isTraveler) {
                showToast('Please select at least one role', 'error');
                return;
            }

            // Validate address for travelers
            if (isTraveler) {
                if (!street || !city || !country) {
                    showToast('Travelers must provide complete address information', 'error');
                    return;
                }
            }

            if (!terms) {
                showToast('Please accept the Terms of Service', 'error');
                return;
            }
            if (password !== confirmPassword) {
                showToast('Passwords do not match', 'error');
                return;
            }

            // Validate password strength
            const hasLength = password.length >= 8;
            const hasUpper = /[A-Z]/.test(password);
            const hasLower = /[a-z]/.test(password);
            const hasNumber = /[0-9]/.test(password);

            if (!hasLength || !hasUpper || !hasLower || !hasNumber) {
                showToast('Password does not meet all requirements', 'error');
                return;
            }

            // Show loading state
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating account...';

            try {
                // Build registration data
                const registrationData = {
                    email,
                    password,
                    name,
                    isTraveler,
                    isBuyer
                };

                // Add address for travelers
                if (isTraveler) {
                    registrationData.street = street;
                    registrationData.city = city;
                    registrationData.postalCode = postalCode;
                    registrationData.country = country;
                }

                const response = await fetch('/.netlify/functions/register', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(registrationData)
                });

                const data = await response.json();

                if (!response.ok) {
                    const errorMsg = Array.isArray(data.details)
                        ? data.details.join('. ')
                        : (data.details || data.error || 'Registration failed');
                    throw new Error(errorMsg);
                }

                currentUser = data.user;
                Store.set('user', currentUser);
                closeAuthModal();
                updateUIForUser();
                updateSavingsCalculatorCurrency();
                showToast(`Welcome to FlyAndEarn, ${name}!`, 'success');
            } catch (error) {
                showToast(error.message || 'Registration failed. Please try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
            }
        }

        function socialLogin(provider) {
            showToast(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login coming soon!`, 'info');
        }

        async function logout() {
            try {
                await fetch('/.netlify/functions/logout', {
                    method: 'POST',
                    credentials: 'include'
                });
            } catch (e) {
                console.error('Logout failed:', e);
            }
            currentUser = null;
            Store.remove('user');
            updateUIForUser();
            showToast('You have been logged out', 'success');
        }

        function formatDisplayName(fullName) {
            if (!fullName) return 'User';
            const parts = fullName.trim().split(' ');
            if (parts.length === 1) return parts[0];
            return `${parts[0]} ${parts[parts.length - 1][0]}.`;
        }

        function updateUIForUser() {
            const loginBtn = document.getElementById('headerLoginBtn');
            const mobileLoginBtn = document.querySelector('#mobileNav .mobile-cta .btn-outline');

            if (currentUser) {
                const initials = currentUser.name ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
                const displayName = formatDisplayName(currentUser.name);

                if (loginBtn) {
                    loginBtn.outerHTML = `
                        <div id="userMenu" class="user-menu" style="display: flex; align-items: center; gap: 0.75rem;">
                            <a href="/dashboard.html" style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary); text-decoration: none;">
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #d4a853, #c49b4a); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.75rem; color: #000;">${initials}</div>
                                <span style="font-weight: 500;">${displayName}</span>
                            </a>
                            <button class="btn btn-outline" style="padding: 0.5rem 1rem; font-size: 0.875rem;" onclick="logout()">Log Out</button>
                        </div>`;
                }

                if (mobileLoginBtn) {
                    mobileLoginBtn.outerHTML = `<button class="btn btn-outline" onclick="logout(); closeMobileMenu();">Log Out (${displayName})</button>`;
                }
            } else {
                // If logged out, restore login button
                const userMenu = document.getElementById('userMenu');
                if (userMenu) {
                    userMenu.outerHTML = `<button class="btn btn-outline" id="headerLoginBtn" onclick="openAuthModal('login')">Log In</button>`;
                }
            }
        }

        // ==========================================
        // CREATE REQUEST MODAL
        // ==========================================

        function createRequestModal() {
            if (document.getElementById('requestModal')) return;
            
            const modal = document.createElement('div');
            modal.id = 'requestModal';
            modal.className = 'request-modal';
            modal.innerHTML = `
                <div class="request-modal-content">
                    <button class="auth-modal-close" onclick="closeRequestModal()">×</button>
                    
                    <h2 class="auth-title">Create a Request</h2>
                    <p class="auth-subtitle">Tell travelers what you're looking for</p>
                    
                    <div class="auth-field">
                        <label>Product Name *</label>
                        <input type="text" id="reqProduct" placeholder="e.g., Johnnie Walker Blue Label 1L">
                    </div>
                    
                    <div class="auth-field">
                        <label>Category *</label>
                        <select id="reqCategory" style="width:100%;padding:0.875rem 1rem;background:#111113;border:1px solid #27272a;border-radius:8px;color:#fafafa;">
                            <option value="">Select category</option>
                            <option value="spirits">🥃 Spirits</option>
                            <option value="perfume">✨ Perfume & Cosmetics</option>
                            <option value="electronics">📱 Electronics</option>
                            <option value="tobacco">🚬 Tobacco</option>
                            <option value="other">📦 Other</option>
                        </select>
                    </div>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div class="auth-field">
                            <label>Duty-Free Price (€) *</label>
                            <input type="number" id="reqPrice" placeholder="185">
                        </div>
                        <div class="auth-field">
                            <label>Service Fee (€) * <span style="font-weight:400;color:#a1a1aa;font-size:0.8rem;">(max 15%)</span></label>
                            <input type="number" id="reqFee" placeholder="25">
                        </div>
                    </div>
                    
                    <div class="auth-field">
                        <label>Preferred Route</label>
                        <input type="text" id="reqRoute" placeholder="e.g., Dubai → Warsaw">
                    </div>
                    
                    <div class="auth-field">
                        <label>Need by Date</label>
                        <input type="date" id="reqDate" style="width:100%;padding:0.875rem 1rem;background:#111113;border:1px solid #27272a;border-radius:8px;color:#fafafa;">
                    </div>
                    
                    <div class="auth-field">
                        <label>Additional Notes</label>
                        <textarea id="reqNotes" rows="3" placeholder="Any specific requirements..." style="width:100%;padding:0.875rem 1rem;background:#111113;border:1px solid #27272a;border-radius:8px;color:#fafafa;resize:vertical;font-family:inherit;"></textarea>
                    </div>
                    
                    <div style="background:#111113;border-radius:12px;padding:1rem;margin:1rem 0;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
                            <span style="color:#a1a1aa;">Product Cost</span>
                            <span id="reqSummaryPrice">€0</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
                            <span style="color:#a1a1aa;">Service Fee</span>
                            <span id="reqSummaryFee">€0</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
                            <span style="color:#a1a1aa;">Platform Fee (10% + €0.50)</span>
                            <span id="reqSummaryPlatform">€0</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding-top:0.75rem;border-top:1px solid #27272a;font-weight:600;">
                            <span>Total</span>
                            <span id="reqSummaryTotal" style="color:#d4a853;">€0</span>
                        </div>
                    </div>
                    
                    <button class="btn btn-primary btn-full" onclick="submitRequest()">Create Request</button>
                </div>
            `;
            document.body.appendChild(modal);

            // Add price update listeners
            document.getElementById('reqPrice').addEventListener('input', updateRequestSummary);
            document.getElementById('reqFee').addEventListener('input', updateRequestSummary);
        }

        function openRequestModal() {
            if (!currentUser) {
                openAuthModal('signup');
                showToast('Please sign up to create a request', 'info');
                return;
            }
            createRequestModal();
            document.getElementById('requestModal').classList.add('show');
            document.body.style.overflow = 'hidden';
        }

        function closeRequestModal() {
            document.getElementById('requestModal')?.classList.remove('show');
            document.body.style.overflow = '';
        }

        function updateRequestSummary() {
            const price = parseFloat(document.getElementById('reqPrice').value) || 0;
            let fee = parseFloat(document.getElementById('reqFee').value) || 0;
            const maxFee = price * 0.15; // 15% max
            
            // Check if fee exceeds 15%
            const feeWarning = document.getElementById('reqFeeWarning');
            if (price > 0 && fee > maxFee) {
                if (!feeWarning) {
                    const warning = document.createElement('div');
                    warning.id = 'reqFeeWarning';
                    warning.style.cssText = 'color:#ef4444;font-size:0.8rem;margin-top:0.25rem;';
                    warning.textContent = `⚠️ Max fee is €${maxFee.toFixed(2)} (15% of product price)`;
                    document.getElementById('reqFee').parentElement.appendChild(warning);
                } else {
                    feeWarning.textContent = `⚠️ Max fee is €${maxFee.toFixed(2)} (15% of product price)`;
                }
                document.getElementById('reqFee').style.borderColor = '#ef4444';
            } else {
                if (feeWarning) feeWarning.remove();
                document.getElementById('reqFee').style.borderColor = '#27272a';
            }
            
            const subtotal = price + fee;
            const platformFee = subtotal * 0.10; // 10% platform fee
            const processingFee = 0.50;
            const total = subtotal + platformFee + processingFee;
            
            document.getElementById('reqSummaryPrice').textContent = `€${price.toFixed(0)}`;
            document.getElementById('reqSummaryFee').textContent = `€${fee.toFixed(0)}`;
            document.getElementById('reqSummaryPlatform').textContent = `€${(platformFee + processingFee).toFixed(2)}`;
            document.getElementById('reqSummaryTotal').textContent = `€${total.toFixed(2)}`;
        }

        function submitRequest() {
            const product = document.getElementById('reqProduct').value;
            const category = document.getElementById('reqCategory').value;
            const price = parseFloat(document.getElementById('reqPrice').value);
            const fee = parseFloat(document.getElementById('reqFee').value);
            const route = document.getElementById('reqRoute').value;
            const date = document.getElementById('reqDate').value;
            
            if (!product || !category || !price || !fee) {
                showToast('Please fill in all required fields', 'error');
                return;
            }
            
            // Validate 15% max service fee
            const maxFee = price * 0.15;
            if (fee > maxFee) {
                showToast(`Service fee cannot exceed 15% of product price (max €${maxFee.toFixed(2)})`, 'error');
                return;
            }
            
            const newRequest = {
                id: Date.now(),
                product,
                category,
                price,
                fee,
                route: route || 'Any Route',
                date: date || new Date().toISOString().split('T')[0],
                status: 'open',
                buyer: currentUser.name
            };
            
            requests.unshift(newRequest);
            Store.set('requests', requests);
            
            closeRequestModal();
            showToast('Request created successfully! 🎉', 'success');
            
            // Clear form
            document.getElementById('reqProduct').value = '';
            document.getElementById('reqCategory').value = '';
            document.getElementById('reqPrice').value = '';
            document.getElementById('reqFee').value = '';
            document.getElementById('reqRoute').value = '';
            document.getElementById('reqDate').value = '';
            document.getElementById('reqNotes').value = '';
        }

        // ==========================================
        // GDPR/RODO COOKIE CONSENT MANAGEMENT
        // ==========================================

        const COOKIE_CONSENT_KEY = 'flyandearn_cookie_consent';
        const COOKIE_SETTINGS_KEY = 'flyandearn_cookie_settings';

        function checkCookieConsent() {
            const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
            if (!consent) {
                document.getElementById('cookieBanner').classList.add('show');
            }
        }

        function acceptAllCookies() {
            const settings = {
                necessary: true,
                functional: true,
                analytics: true,
                marketing: true,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };
            localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
            localStorage.setItem(COOKIE_SETTINGS_KEY, JSON.stringify(settings));
            document.getElementById('cookieBanner').classList.remove('show');
            document.getElementById('cookieModal').classList.remove('show');
            
            if (settings.analytics) initializeAnalytics();
            if (settings.marketing) initializeMarketing();
        }

        function rejectCookies() {
            const settings = {
                necessary: true,
                functional: false,
                analytics: false,
                marketing: false,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };
            localStorage.setItem(COOKIE_CONSENT_KEY, 'rejected');
            localStorage.setItem(COOKIE_SETTINGS_KEY, JSON.stringify(settings));
            document.getElementById('cookieBanner').classList.remove('show');
        }

        function openCookieSettings() {
            document.getElementById('cookieModal').classList.add('show');
            
            const savedSettings = localStorage.getItem(COOKIE_SETTINGS_KEY);
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                document.getElementById('cookieFunctional').checked = settings.functional || false;
                document.getElementById('cookieAnalytics').checked = settings.analytics || false;
                document.getElementById('cookieMarketing').checked = settings.marketing || false;
            }
        }

        function closeCookieSettings() {
            document.getElementById('cookieModal').classList.remove('show');
        }

        function saveCookieSettings() {
            const settings = {
                necessary: true,
                functional: document.getElementById('cookieFunctional').checked,
                analytics: document.getElementById('cookieAnalytics').checked,
                marketing: document.getElementById('cookieMarketing').checked,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };
            localStorage.setItem(COOKIE_CONSENT_KEY, 'custom');
            localStorage.setItem(COOKIE_SETTINGS_KEY, JSON.stringify(settings));
            document.getElementById('cookieBanner').classList.remove('show');
            document.getElementById('cookieModal').classList.remove('show');
            
            if (settings.analytics) initializeAnalytics();
            if (settings.marketing) initializeMarketing();
        }

        function initializeAnalytics() {
            console.log('Analytics initialized (GDPR compliant with IP anonymization)');
        }

        function initializeMarketing() {
            console.log('Marketing cookies initialized');
        }

        function openPrivacyPolicy() {
            document.getElementById('privacyModal').classList.add('show');
        }

        function closePrivacyPolicy() {
            document.getElementById('privacyModal').classList.remove('show');
        }

        function openTermsModal() {
            document.getElementById('termsModal').classList.add('show');
        }

        function closeTermsModal() {
            document.getElementById('termsModal').classList.remove('show');
        }

        function openImpressum() {
            document.getElementById('impressumModal').classList.add('show');
        }

        function closeImpressum() {
            document.getElementById('impressumModal').classList.remove('show');
        }

        function openWithdrawalModal() {
            document.getElementById('withdrawalModal').classList.add('show');
        }

        function closeWithdrawalModal() {
            document.getElementById('withdrawalModal').classList.remove('show');
        }

        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('cookie-modal') || e.target.classList.contains('auth-modal') || e.target.classList.contains('request-modal')) {
                e.target.classList.remove('show');
                document.body.style.overflow = '';
            }
        });

        // ==========================================
        // MAIN APPLICATION FUNCTIONALITY
        // ==========================================

        // Role toggle functionality (hero role toggle was removed in redesign)
        let currentRole = 'traveler';

        function setRole(role) {
            currentRole = role;
            updateHeroContent();
        }

        function updateHeroContent() {
            if (typeof T === 'undefined' || !T.t) {
                return;
            }

            const title = document.getElementById('hero-title');
            const subtitle = document.getElementById('hero-subtitle');

            // Hero was redesigned — no more role toggle, tagline, or legal elements
            // Just update title and subtitle if they exist
            if (title) title.innerHTML = T.t('hero.title');
            if (subtitle) subtitle.textContent = T.t('hero.subtitle');
        }

        // ==========================================
        // LIVE PRICE DATABASE & CHECKER
        // ==========================================

        const PriceDatabase = {
            // Real product prices (retail Poland vs duty-free)
            products: {
                spirits: [
                    { name: 'Johnnie Walker Blue Label 1L', retail: 320, dutyfree: 185, avgFee: 40 },
                    { name: 'Macallan 18yr 700ml', retail: 380, dutyfree: 220, avgFee: 45 },
                    { name: 'Hennessy XO 700ml', retail: 280, dutyfree: 145, avgFee: 40 },
                    { name: 'Grey Goose 1L', retail: 85, dutyfree: 38, avgFee: 20 },
                    { name: 'Glenfiddich 21yr 700ml', retail: 320, dutyfree: 175, avgFee: 42 },
                    { name: 'Chivas Regal 18yr 1L', retail: 145, dutyfree: 72, avgFee: 30 }
                ],
                perfume: [
                    { name: 'Chanel No. 5 EDP 100ml', retail: 185, dutyfree: 98, avgFee: 25 },
                    { name: 'Dior Sauvage EDP 200ml', retail: 175, dutyfree: 95, avgFee: 28 },
                    { name: 'Tom Ford Oud Wood 100ml', retail: 320, dutyfree: 195, avgFee: 35 },
                    { name: 'Creed Aventus 100ml', retail: 435, dutyfree: 280, avgFee: 45 },
                    { name: 'YSL Libre EDP 90ml', retail: 145, dutyfree: 78, avgFee: 22 }
                ],
                tobacco: [
                    { name: 'Marlboro Gold (carton)', retail: 95, dutyfree: 35, avgFee: 25 },
                    { name: 'IQOS Terea (10 packs)', retail: 85, dutyfree: 42, avgFee: 30 },
                    { name: 'Davidoff Gold (carton)', retail: 105, dutyfree: 38, avgFee: 25 },
                    { name: 'Parliament (carton)', retail: 90, dutyfree: 32, avgFee: 25 }
                ],
                electronics: [
                    { name: 'iPhone 15 Pro 256GB', retail: 1399, dutyfree: 1099, avgFee: 85 },
                    { name: 'AirPods Pro 2', retail: 299, dutyfree: 199, avgFee: 45 },
                    { name: 'Apple Watch Ultra 2', retail: 899, dutyfree: 749, avgFee: 75 },
                    { name: 'iPad Pro 11" 256GB', retail: 1099, dutyfree: 899, avgFee: 70 },
                    { name: 'Sony WH-1000XM5', retail: 379, dutyfree: 279, avgFee: 40 }
                ],
                chocolate: [
                    { name: 'Toblerone 4.5kg', retail: 65, dutyfree: 32, avgFee: 15 },
                    { name: 'Lindt Selection 1kg', retail: 45, dutyfree: 22, avgFee: 12 },
                    { name: 'Godiva Gold Collection 500g', retail: 58, dutyfree: 35, avgFee: 15 },
                    { name: 'Swiss Chocolate Gift Box 1kg', retail: 55, dutyfree: 28, avgFee: 14 }
                ]
            },

            lastUpdate: Date.now(),
            updateInterval: 300000, // 5 minutes

            // Get random product from category
            getProduct(category) {
                const products = this.products[category];
                if (!products || products.length === 0) return null;
                return products[Math.floor(Math.random() * products.length)];
            },

            // Simulate price fluctuation (±5%)
            simulatePriceChange(basePrice) {
                const fluctuation = (Math.random() - 0.5) * 0.1; // ±5%
                return Math.round(basePrice * (1 + fluctuation));
            },

            // Get live prices for a category (with simulated fluctuation)
            getLivePrices(category) {
                const product = this.getProduct(category);
                if (!product) return null;

                return {
                    name: product.name,
                    retail: this.simulatePriceChange(product.retail),
                    dutyfree: this.simulatePriceChange(product.dutyfree),
                    avgFee: product.avgFee
                };
            },

            // Format time since last update
            getLastUpdateText() {
                const seconds = Math.floor((Date.now() - this.lastUpdate) / 1000);
                if (seconds < 60) return 'Just now';
                if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
                return Math.floor(seconds / 3600) + ' hr ago';
            }
        };

        // Price Checker Robot - runs in background
        const PriceChecker = {
            isRunning: false,
            intervalId: null,
            statusElement: null,

            start() {
                if (this.isRunning) return;
                this.isRunning = true;
                this.updateStatus('checking');

                // Initial check
                this.checkPrices();

                // Run every 5 minutes
                this.intervalId = setInterval(() => {
                    this.checkPrices();
                }, PriceDatabase.updateInterval);
            },

            stop() {
                if (this.intervalId) {
                    clearInterval(this.intervalId);
                    this.intervalId = null;
                }
                this.isRunning = false;
                this.updateStatus('stopped');
            },

            checkPrices() {
                this.updateStatus('checking');

                // Simulate API call delay
                setTimeout(() => {
                    PriceDatabase.lastUpdate = Date.now();
                    this.updateStatus('live');

                    // Update calculator if category is selected
                    const category = document.getElementById('calc-category')?.value;
                    if (category) {
                        updateCalculatorPrices(category);
                    }
                }, 1000 + Math.random() * 2000);
            },

            updateStatus(status) {
                const indicator = document.getElementById('price-status');
                if (!indicator) return;

                switch(status) {
                    case 'checking':
                        indicator.innerHTML = '<span class="pulse-dot checking"></span> Checking prices...';
                        break;
                    case 'live':
                        indicator.innerHTML = '<span class="pulse-dot live"></span> Live prices • Updated ' + PriceDatabase.getLastUpdateText();
                        break;
                    case 'stopped':
                        indicator.innerHTML = '<span class="pulse-dot stopped"></span> Price updates paused';
                        break;
                }
            }
        };

        // Update calculator with live prices
        function updateCalculatorPrices(category) {
            const prices = PriceDatabase.getLivePrices(category);
            if (!prices) return;

            const retailInput = document.getElementById('calc-retail');
            const dutyfreeInput = document.getElementById('calc-dutyfree');
            const feeInput = document.getElementById('calc-fee');
            const productLabel = document.getElementById('calc-product-name');

            if (retailInput) retailInput.value = prices.retail;
            if (dutyfreeInput) dutyfreeInput.value = prices.dutyfree;
            if (feeInput) feeInput.value = prices.avgFee;
            if (productLabel) productLabel.textContent = prices.name;

            calculateSavings();
        }

        // Currency helpers for savings calculator
        const EXCHANGE_RATES = {
            'EUR': 1,
            'PLN': 4.32,
            'USD': 1.08,
            'GBP': 0.86,
            'CHF': 0.94,
            'AED': 3.97,
            'TRY': 35.20,
            'SGD': 1.45,
            'JPY': 162.50,
            'QAR': 3.93,
            'KRW': 1420
        };

        function getUserCurrency() {
            // Check logged-in user's country
            if (typeof FAE !== 'undefined' && FAE.Auth && FAE.Auth.currentUser && FAE.Auth.currentUser.country) {
                return FAE.Auth.currentUser.country.toLowerCase() === 'poland' ? 'PLN' : 'EUR';
            }
            // Check cached user from session
            const cachedUser = localStorage.getItem('cachedUser');
            if (cachedUser) {
                try {
                    const user = JSON.parse(cachedUser);
                    if (user.country && user.country.toLowerCase() === 'poland') return 'PLN';
                } catch(e) {}
            }
            return 'EUR';
        }

        function getCurrencySymbol(currency) {
            const symbols = {
                'EUR': '€', 'USD': '$', 'GBP': '£', 'CHF': 'CHF ', 'AED': 'AED ',
                'TRY': '₺', 'SGD': 'S$', 'JPY': '¥', 'QAR': 'QAR ', 'KRW': '₩', 'PLN': 'zł'
            };
            return symbols[currency] || '€';
        }

        function getSelectedCalcCurrency() {
            const select = document.getElementById('calc-currency');
            return select ? select.value : 'EUR';
        }

        function convertFromEUR(eurAmount, toCurrency) {
            const rate = EXCHANGE_RATES[toCurrency] || 1;
            return Math.round(eurAmount * rate);
        }

        function formatPriceWithCurrency(amount, currency) {
            const symbol = getCurrencySymbol(currency);
            // Currencies where symbol goes after the number
            const suffixCurrencies = ['PLN', 'KRW', 'TRY'];
            if (suffixCurrencies.includes(currency)) {
                return `${amount.toLocaleString()}${symbol}`;
            }
            return `${symbol}${amount.toLocaleString()}`;
        }

        // Savings calculator
        function calculateSavings() {
            const retail = parseFloat(document.getElementById('calc-retail').value) || 0;
            const dutyfree = parseFloat(document.getElementById('calc-dutyfree').value) || 0;
            const fee = parseFloat(document.getElementById('calc-fee').value) || 0;

            const total = dutyfree + fee;
            const savings = retail - total;
            const savingsPercent = retail > 0 ? Math.round((savings / retail) * 100) : 0;

            const currency = getSelectedCalcCurrency();

            const savingsEl = document.getElementById('calc-savings');
            if (savingsEl) {
                if (savings > 0) {
                    savingsEl.textContent = `${formatPriceWithCurrency(Math.round(savings), currency)} (${savingsPercent}%)`;
                } else {
                    savingsEl.textContent = formatPriceWithCurrency(0, currency);
                }
            }
        }

        // Update calculator when currency dropdown changes
        function updateCalculatorCurrency() {
            const currency = getSelectedCalcCurrency();
            const symbol = getCurrencySymbol(currency);

            // Base prices in EUR
            const baseRetail = 320, baseDutyFree = 185, baseFee = 40;

            // Convert to selected currency
            const retail = convertFromEUR(baseRetail, currency);
            const dutyfree = convertFromEUR(baseDutyFree, currency);
            const fee = convertFromEUR(baseFee, currency);
            const total = dutyfree + fee;
            const savings = retail - total;
            const savingsPercent = Math.round((savings / retail) * 100);

            // Update labels
            const lblRetail = document.getElementById('label-retail');
            const lblDutyfree = document.getElementById('label-dutyfree');
            const lblFee = document.getElementById('label-fee');

            if (lblRetail) lblRetail.textContent = `Local Retail Price (${symbol.trim()})`;
            if (lblDutyfree) lblDutyfree.textContent = `Duty-Free Price (${symbol.trim()})`;
            if (lblFee) lblFee.textContent = `Service Fee (${symbol.trim()})`;

            // Update calculator input values
            document.getElementById('calc-retail').value = retail;
            document.getElementById('calc-dutyfree').value = dutyfree;
            document.getElementById('calc-fee').value = fee;

            // Update example section
            const exRetail = document.getElementById('example-retail');
            const exDutyfree = document.getElementById('example-dutyfree');
            const exFee = document.getElementById('example-fee');
            const exTotal = document.getElementById('example-total');
            const exSavings = document.getElementById('example-savings');

            if (exRetail) exRetail.textContent = formatPriceWithCurrency(retail, currency);
            if (exDutyfree) exDutyfree.textContent = formatPriceWithCurrency(dutyfree, currency);
            if (exFee) exFee.textContent = formatPriceWithCurrency(fee, currency);
            if (exTotal) exTotal.textContent = formatPriceWithCurrency(total, currency);
            if (exSavings) exSavings.textContent = `${formatPriceWithCurrency(savings, currency)} (${savingsPercent}%)`;

            // Recalculate
            calculateSavings();
        }

        // Set initial currency based on user's country (called on page load)
        function updateSavingsCalculatorCurrency() {
            const userCurrency = getUserCurrency();
            const currencySelect = document.getElementById('calc-currency');
            if (currencySelect && userCurrency) {
                currencySelect.value = userCurrency;
                updateCalculatorCurrency();
            }
        }

        // Event listeners for calculator
        document.getElementById('calc-category')?.addEventListener('change', function() {
            updateCalculatorPrices(this.value);
        });
        document.getElementById('calc-retail')?.addEventListener('input', calculateSavings);
        document.getElementById('calc-dutyfree')?.addEventListener('input', calculateSavings);
        document.getElementById('calc-fee')?.addEventListener('input', calculateSavings);

        // Smooth scroll for nav links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                if (href !== '#') {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            });
        });

        // Header scroll effect
        let lastScroll = 0;
        window.addEventListener('scroll', () => {
            const header = document.querySelector('header');
            const currentScroll = window.pageYOffset;
            
            if (currentScroll > 100) {
                header.style.background = 'rgba(10, 10, 11, 0.95)';
            } else {
                header.style.background = 'rgba(10, 10, 11, 0.8)';
            }
            
            lastScroll = currentScroll;
        });

        // Animate stats on scroll
        const observerOptions = { threshold: 0.5, rootMargin: '0px' };

        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const statValues = entry.target.querySelectorAll('.stat-value');
                    statValues.forEach(stat => {
                        stat.style.animation = 'fadeInUp 0.6s ease forwards';
                    });
                }
            });
        }, observerOptions);

        // Hero stats section was removed in redesign — observer no longer needed

        // Add fade-in animation for cards on scroll
        const cardObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.request-card, .category-card, .trust-card, .step-card').forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = `opacity 0.5s ease ${index * 0.1}s, transform 0.5s ease ${index * 0.1}s`;
            cardObserver.observe(card);
        });

        // ==========================================
        // CTA BUTTON HANDLERS
        // ==========================================

        function handleStartEarning() {
            if (currentUser) {
                window.location.href = 'wallet.html';
            } else {
                openAuthModal('signup');
            }
        }

        function handleStartSaving() {
            if (currentUser) {
                openRequestModal();
            } else {
                openAuthModal('signup');
            }
        }

        function handleSeeRequests() {
            document.getElementById('requests').scrollIntoView({ behavior: 'smooth' });
        }

        // ==========================================
        // LANGUAGE SWITCHER
        // ==========================================
        
        function toggleLangDropdown(e) {
            if (e) e.stopPropagation();
            document.getElementById('langDropdown').classList.toggle('open');
        }
        
        document.addEventListener('click', function(e) {
            const dropdown = document.getElementById('langDropdown');
            if (dropdown && !dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
        
        function setLang(lang) {
            if (typeof T !== 'undefined') {
                T.setLanguage(lang);
                T.updatePage(); // Apply translations to all data-i18n elements
                updateLangDropdown();
                updateLandingText();
            }
            document.getElementById('langDropdown').classList.remove('open');
        }
        
        function updateLangDropdown() {
            const lang = T.getLanguage();
            // Update button flag
            document.querySelectorAll('.lang-dropdown-btn .flag-img').forEach(img => {
                img.style.display = img.dataset.lang === lang ? 'block' : 'none';
            });
            // Update active state in menu
            document.querySelectorAll('.lang-option').forEach(opt => {
                opt.classList.toggle('active', opt.dataset.lang === lang);
            });
            // Update mobile language buttons active state
            document.querySelectorAll('.mobile-lang-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lang === lang);
            });
        }
        
        function updateLangButtons() {
            updateLangDropdown();
        }
        
        function updateLandingText() {
            T.updatePage();

            // Update hero section based on current role
            updateHeroContent();

            // Update navigation links
            document.querySelectorAll('header nav a, .mobile-nav a').forEach(link => {
                const href = link.getAttribute('href') || '';
                if (href.includes('how-it-works')) link.textContent = t('nav.howItWorks');
                else if (href.includes('requests')) link.textContent = t('nav.browse');
                else if (href.includes('categories')) link.textContent = t('nav.categories');
                else if (href.includes('savings')) link.textContent = t('nav.savings');
            });
            
            // Update buttons
            document.querySelectorAll('.btn, button').forEach(btn => {
                const text = btn.textContent.toLowerCase();
                if (text.includes('start earning') || text.includes('zacznij zarabiać') || text.includes('gagner') || text.includes('verdienen')) {
                    btn.textContent = t('btn.startEarning');
                } else if (text.includes('start saving') || text.includes('zacznij oszczędzać') || text.includes('économiser') || text.includes('sparen')) {
                    btn.textContent = t('btn.startSaving');
                } else if (text.includes('log in') || text.includes('zaloguj') || text.includes('connecter') || text.includes('anmelden')) {
                    btn.textContent = t('btn.login');
                } else if (text.includes('sign up') || text.includes('zarejestruj') || text.includes('inscrire') || text.includes('registrieren')) {
                    btn.textContent = t('btn.signup');
                } else if (text.includes('learn more') || text.includes('dowiedz') || text.includes('savoir') || text.includes('erfahren')) {
                    btn.textContent = t('btn.learnMore');
                }
            });
            
            // Update section titles
            document.querySelectorAll('.section-title, h2').forEach(el => {
                const text = el.textContent.toLowerCase();
                if (text.includes('how it works') || text.includes('jak to działa') || text.includes('comment') || text.includes('funktioniert')) {
                    el.textContent = t('section.howItWorks');
                } else if (text.includes('faq') || text.includes('frequently') || text.includes('pytania') || text.includes('fragen')) {
                    el.textContent = t('section.faq');
                } else if (text.includes('for travelers') || text.includes('dla podróżnych') || text.includes('voyageurs') || text.includes('reisende')) {
                    el.textContent = t('section.forTravelers');
                } else if (text.includes('for buyers') || text.includes('dla kupujących') || text.includes('acheteurs') || text.includes('käufer')) {
                    el.textContent = t('section.forBuyers');
                } else if (text.includes('categories') || text.includes('kategorie') || text.includes('catégories') || text.includes('kategorien')) {
                    el.textContent = t('section.categories');
                } else if (text.includes('latest requests') || text.includes('najnowsze') || text.includes('dernières') || text.includes('neueste')) {
                    el.textContent = t('section.requests');
                }
            });
            
            // Update footer
            document.querySelectorAll('footer a, footer span').forEach(el => {
                const text = el.textContent.toLowerCase();
                if (text.includes('privacy') || text.includes('prywatności')) {
                    el.textContent = t('footer.privacy');
                } else if (text.includes('terms') || text.includes('regulamin')) {
                    el.textContent = t('footer.terms');
                } else if (text.includes('contact') || text.includes('kontakt')) {
                    el.textContent = t('footer.contact');
                }
            });
        }

        // ==========================================
        // FEATURED TRIPS
        // ==========================================

        const gradients = [
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
            'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)'
        ];

        async function loadFeaturedTrips() {
            const grid = document.getElementById('travelersGrid');
            if (!grid) return;

            try {
                const response = await fetch('/.netlify/functions/trips?limit=8');
                const data = await response.json();

                if (data.trips && data.trips.length > 0) {
                    // Store trips data for modal access
                    window.featuredTrips = data.trips;

                    // Count trips per traveller
                    const tripCountByTraveller = {};
                    data.trips.forEach(t => {
                        tripCountByTraveller[t.traveller.id] = (tripCountByTraveller[t.traveller.id] || 0) + 1;
                    });

                    grid.innerHTML = data.trips.map((trip, i) => {
                        const nameParts = trip.traveller.name.trim().split(' ');
                        const initials = nameParts.map(n => n[0]).join('').toUpperCase().slice(0, 2);
                        const displayName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.` : nameParts[0];
                        const gradient = gradients[i % gradients.length];
                        const departDate = new Date(trip.departureDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                        const returnDate = trip.returnDate ? new Date(trip.returnDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;
                        const travellerLocation = trip.traveller.city ? `📍 ${trip.traveller.city}${trip.traveller.country ? ', ' + trip.traveller.country : ''}` : '';
                        const tripCount = tripCountByTraveller[trip.traveller.id];
                        const multiTripBadge = tripCount > 1 ? `<span style="background:var(--accent-gold);color:#000;padding:0.2rem 0.5rem;border-radius:8px;font-size:0.65rem;font-weight:700;margin-left:0.5rem;">${tripCount} trips</span>` : '';

                        return `
                        <div class="traveler-card" data-trip-id="${trip.id}" style="cursor: pointer; background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 1.75rem; transition: all 0.3s; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                            <!-- Header with avatar and name -->
                            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem;">
                                <div style="width: 64px; height: 64px; border-radius: 50%; background: ${gradient}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.5rem; color: white; flex-shrink: 0;">${initials}</div>
                                <div style="flex: 1; min-width: 0;">
                                    <h4 style="font-weight: 600; font-size: 1.1rem; margin-bottom: 0.375rem; display:flex;align-items:center;">${displayName}${multiTripBadge}</h4>
                                    <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: var(--text-secondary);">
                                        <span style="color: #fbbf24;">⭐⭐⭐⭐⭐</span>
                                        <span style="font-weight: 500;">5.0</span>
                                    </div>
                                </div>
                                <div style="background: rgba(45, 212, 191, 0.15); color: #2dd4bf; padding: 0.375rem 0.875rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; white-space: nowrap;">✓ VERIFIED</div>
                            </div>

                            <!-- Route -->
                            <div style="background: var(--bg-secondary); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <div style="text-align: center; flex: 1;">
                                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">FROM</div>
                                        <div style="font-weight: 700; font-size: 1.1rem;">${trip.fromCity}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${trip.fromAirport}</div>
                                    </div>
                                    <div style="color: var(--accent-gold); font-size: 1.5rem; padding: 0 1rem;">✈️</div>
                                    <div style="text-align: center; flex: 1;">
                                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">TO</div>
                                        <div style="font-weight: 700; font-size: 1.1rem;">${trip.toCity}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${trip.toAirport}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Trip details -->
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
                                <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 10px;">
                                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">DEPART</div>
                                    <div style="font-weight: 600; font-size: 0.95rem;">${departDate}</div>
                                </div>
                                <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 10px;">
                                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">RETURN</div>
                                    <div style="font-weight: 600; font-size: 0.95rem;">${returnDate || 'One way'}</div>
                                </div>
                                <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 10px;">
                                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">CAPACITY</div>
                                    <div style="font-weight: 600; font-size: 0.95rem;">${trip.availableKg ? trip.availableKg + 'kg' : 'Flex'}</div>
                                </div>
                            </div>
                        </div>`;
                    }).join('');
                } else {
                    grid.innerHTML = `
                        <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                            <p style="color: var(--text-secondary); margin-bottom: 1rem;">No upcoming trips yet. Be the first to post your trip!</p>
                            <button class="btn btn-primary" onclick="handleStartEarning()">Post Your Trip →</button>
                        </div>`;
                }
            } catch (e) {
                console.error('Failed to load trips:', e);
                grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">Unable to load trips. Please try again later.</p>';
            }
        }

        // ==========================================
        // SESSION CHECK
        // ==========================================

        async function checkSession() {
            try {
                const response = await fetch('/.netlify/functions/me', {
                    method: 'GET',
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.user) {
                        currentUser = data.user;
                        Store.set('user', currentUser);
                        return;
                    }
                }
                // Session invalid - clear local state
                currentUser = null;
                Store.remove('user');
            } catch (e) {
                console.error('Session check failed:', e);
            }
        }

        // ==========================================
        // INITIALIZE
        // ==========================================

        document.addEventListener('DOMContentLoaded', async function() {
            // Initialize translations
            if (typeof T !== 'undefined') {
                T.init();
                T.updatePage(); // Apply translations to all data-i18n elements
                updateLangButtons();
                updateLandingText();
            }

            // Check session with API
            await checkSession();

            checkCookieConsent();
            updateUIForUser();

            // Update savings calculator currency based on user's country
            try {
                updateSavingsCalculatorCurrency();
            } catch (e) {
                console.error('Failed to update calculator currency:', e);
            }

            // Load trips first (most important)
            console.log('Loading featured trips...');
            try {
                await loadFeaturedTrips();
                console.log('Featured trips loaded');
            } catch (e) {
                console.error('Failed to load trips:', e);
            }

            // Load location-based requests
            console.log('Loading location-based requests...');
            try {
                await loadLocationBasedRequests();
                console.log('Location-based requests loaded');
            } catch (e) {
                console.error('Failed to load location-based requests:', e);
            }

            // Initialize optional features with error handling
            try { if (typeof Stats !== 'undefined') Stats.init(); } catch (e) { console.log('Stats not available'); }
            try { if (typeof PriceChecker !== 'undefined') PriceChecker.start(); } catch (e) { console.log('PriceChecker not available'); }
            try { if (typeof Messages !== 'undefined') Messages.init(); } catch (e) { console.log('Messages not available'); }

            // Check for openMessages URL parameter (from dashboard redirect)
            const urlParams = new URLSearchParams(window.location.search);
            const openMessagesParam = urlParams.get('openMessages');
            if (openMessagesParam && currentUser) {
                setTimeout(() => openMessagesModal(openMessagesParam), 500);
                // Clean up URL
                window.history.replaceState({}, '', window.location.pathname);
            }

            // Bind CTA buttons
            document.querySelectorAll('.btn-primary.btn-large').forEach(btn => {
                const text = btn.textContent.toLowerCase();
                if (text.includes('earn') || text.includes('start earning')) {
                    btn.onclick = handleStartEarning;
                } else if (text.includes('save') || text.includes('request') || text.includes('create')) {
                    btn.onclick = handleStartSaving;
                }
            });
            
            document.querySelectorAll('.btn-outline.btn-large').forEach(btn => {
                const text = btn.textContent.toLowerCase();
                if (text.includes('requests')) {
                    btn.onclick = () => document.getElementById('requests').scrollIntoView({ behavior: 'smooth' });
                } else if (text.includes('save')) {
                    btn.onclick = handleStartSaving;
                }
            });
            
            // Bind login buttons
            document.querySelectorAll('.header-buttons .btn-outline, #mobileNav .btn-outline').forEach(btn => {
                if (btn.textContent.includes('Log In')) {
                    btn.onclick = () => openAuthModal('login');
                }
            });

            // Request cards are now handled dynamically by loadLocationBasedRequests()
        });

        // ==========================================
        // TRAVELLER MODAL
        // ==========================================

        let userLocation = null;

        function calculateDistance(lat1, lon1, lat2, lon2) {
            if (!lat1 || !lon1 || !lat2 || !lon2) return null;
            const R = 6371; // Earth's radius in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return Math.round(R * c);
        }

        function getUserLocation() {
            return new Promise((resolve) => {
                if (!navigator.geolocation) {
                    resolve(null);
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                        resolve(userLocation);
                    },
                    () => resolve(null),
                    { timeout: 5000 }
                );
            });
        }

        // ==========================================
        // LOCATION SERVICE
        // ==========================================

        const LocationService = {
            async getUserCity() {
                // Check cache first
                const cached = sessionStorage.getItem('userCity');
                if (cached) return cached;

                // If logged in, use profile city
                if (currentUser && currentUser.city) {
                    sessionStorage.setItem('userCity', currentUser.city);
                    return currentUser.city;
                }

                // Otherwise, try geolocation reverse geocoding
                const location = await getUserLocation();
                if (location) {
                    try {
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?lat=${location.lat}&lon=${location.lon}&format=json`
                        );
                        const data = await response.json();
                        const city = data.address?.city || data.address?.town || data.address?.village || null;
                        if (city) {
                            sessionStorage.setItem('userCity', city);
                            return city;
                        }
                    } catch (e) {
                        console.log('Reverse geocoding failed:', e);
                    }
                }

                return null;
            },

            getUserTripFromCities() {
                // Get cities where user departs from (their home bases)
                if (!currentUser) return [];

                const trips = window.featuredTrips || [];
                const userTrips = trips.filter(t => t.traveller?.id === currentUser.id);
                const fromCities = userTrips.map(t => t.from?.city).filter(Boolean);

                // Also check localStorage trips if API trips not available
                try {
                    const storedTrips = JSON.parse(localStorage.getItem('trips') || '[]');
                    const userStoredTrips = storedTrips.filter(t => t.travelerId === currentUser.id);
                    userStoredTrips.forEach(t => {
                        if (t.fromCity && !fromCities.includes(t.fromCity)) {
                            fromCities.push(t.fromCity);
                        }
                    });
                } catch (e) {
                    console.log('Error reading stored trips:', e);
                }

                return [...new Set(fromCities)]; // Remove duplicates
            }
        };

        // ==========================================
        // LOCATION-BASED REQUESTS
        // ==========================================

        async function loadLocationBasedRequests() {
            const grid = document.querySelector('.requests-grid');
            if (!grid) return;

            // Show loading state
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">Loading requests near you...</p>';

            try {
                // Get user's city and trip from-cities
                const userCity = await LocationService.getUserCity();
                const tripFromCities = LocationService.getUserTripFromCities();

                // Fetch all open requests from API
                let requests = [];
                try {
                    const response = await fetch('/.netlify/functions/requests?status=open');
                    if (response.ok) {
                        const data = await response.json();
                        requests = data.requests || [];
                    }
                } catch (e) {
                    console.log('API fetch failed, using localStorage:', e);
                }

                // Fallback to localStorage if API returns nothing
                if (requests.length === 0) {
                    try {
                        requests = JSON.parse(localStorage.getItem('requests') || '[]')
                            .filter(r => r.status === 'open');
                    } catch (e) {
                        console.log('localStorage fallback failed:', e);
                    }
                }

                // If still no requests, use sample data
                if (requests.length === 0) {
                    requests = getSampleRequests();
                }

                // Categorize requests
                const nearYouRequests = [];
                const onRouteRequests = [];
                const otherRequests = [];

                requests.forEach(req => {
                    const toCity = (req.toCity || '').toLowerCase();

                    // Check if matches user's city
                    if (userCity && toCity.includes(userCity.toLowerCase())) {
                        nearYouRequests.push({ ...req, matchType: 'near' });
                    }
                    // Check if matches any trip from-city
                    else if (tripFromCities.some(city => toCity.includes(city.toLowerCase()))) {
                        onRouteRequests.push({ ...req, matchType: 'route' });
                    }
                    else {
                        otherRequests.push(req);
                    }
                });

                // Combine: near you first, then on route, then others
                const sortedRequests = [...nearYouRequests, ...onRouteRequests, ...otherRequests];

                if (sortedRequests.length === 0) {
                    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">No open requests at the moment. Check back soon!</p>';
                    return;
                }

                // Render request cards
                grid.innerHTML = sortedRequests.slice(0, 12).map(req => renderRequestCard(req)).join('');

                // Add click handlers
                grid.querySelectorAll('.request-card').forEach(card => {
                    card.style.cursor = 'pointer';
                    card.onclick = () => {
                        if (currentUser) {
                            showToast('Request details coming soon!', 'info');
                        } else {
                            openAuthModal('login');
                            showToast('Log in to view request details', 'info');
                        }
                    };
                });

            } catch (e) {
                console.error('Error loading requests:', e);
                grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">Failed to load requests. Please refresh the page.</p>';
            }
        }

        function getSampleRequests() {
            return [
                { id: 's1', product: 'Johnnie Walker Blue', category: 'Alcohol', description: '1L • Premium Whisky', dutyFreePrice: 650, currency: 'AED', serviceFee: 40, fromAirport: 'DXB', fromCity: 'Dubai', toAirport: 'KRK', toCity: 'Kraków', status: 'open', offers: [] },
                { id: 's2', product: 'Dior Sauvage EDP', category: 'Perfume', description: '200ml • Fragrance', dutyFreePrice: 125, currency: 'EUR', serviceFee: 30, fromAirport: 'CDG', fromCity: 'Paris', toAirport: 'WAW', toCity: 'Warsaw', status: 'open', offers: [1, 2] },
                { id: 's3', product: 'AirPods Pro 2', category: 'Electronics', description: 'Electronics', dutyFreePrice: 199, currency: 'USD', serviceFee: 55, fromAirport: 'JFK', fromCity: 'New York', toAirport: 'GDN', toCity: 'Gdańsk', status: 'open', offers: [] },
                { id: 's4', product: 'Lindt Selection Box', category: 'Food', description: '1kg • Chocolate', dutyFreePrice: 45, currency: 'CHF', serviceFee: 20, fromAirport: 'ZRH', fromCity: 'Zurich', toAirport: 'POZ', toCity: 'Poznań', status: 'open', offers: [] },
                { id: 's5', product: 'Marlboro Gold', category: 'Tobacco', description: '1 carton (200) • Cigarettes', dutyFreePrice: 1200, currency: 'TRY', serviceFee: 25, fromAirport: 'IST', fromCity: 'Istanbul', toAirport: 'WRO', toCity: 'Wrocław', status: 'open', offers: [1] },
                { id: 's6', product: 'Apple Watch Ultra 2', category: 'Electronics', description: 'Electronics', dutyFreePrice: 999, currency: 'SGD', serviceFee: 85, fromAirport: 'SIN', fromCity: 'Singapore', toAirport: 'WAW', toCity: 'Warsaw', status: 'open', offers: [] },
                { id: 's7', product: 'Macallan 18yr', category: 'Alcohol', description: '700ml • Single Malt', dutyFreePrice: 185, currency: 'GBP', serviceFee: 50, fromAirport: 'LHR', fromCity: 'London', toAirport: 'WAW', toCity: 'Warsaw', status: 'open', offers: [] },
                { id: 's8', product: 'Chanel No. 5', category: 'Perfume', description: '100ml EDP • Perfume', dutyFreePrice: 98, currency: 'EUR', serviceFee: 25, fromAirport: 'CDG', fromCity: 'Paris', toAirport: 'KTW', toCity: 'Katowice', status: 'open', offers: [1, 2, 3] },
                { id: 's9', product: 'PlayStation 5 Slim', category: 'Electronics', description: 'Digital Edition', dutyFreePrice: 49980, currency: 'JPY', serviceFee: 70, fromAirport: 'NRT', fromCity: 'Tokyo', toAirport: 'WAW', toCity: 'Warsaw', status: 'open', offers: [] },
                { id: 's10', product: 'Hennessy XO', category: 'Alcohol', description: '700ml • Cognac', dutyFreePrice: 580, currency: 'QAR', serviceFee: 45, fromAirport: 'DOH', fromCity: 'Doha', toAirport: 'GDN', toCity: 'Gdańsk', status: 'open', offers: [] },
                { id: 's11', product: 'La Mer Moisturizer', category: 'Cosmetics', description: '60ml • Skincare', dutyFreePrice: 385000, currency: 'KRW', serviceFee: 60, fromAirport: 'ICN', fromCity: 'Seoul', toAirport: 'POZ', toCity: 'Poznań', status: 'open', offers: [1] },
                { id: 's12', product: 'Grey Goose Vodka', category: 'Alcohol', description: '1L • Premium Vodka', dutyFreePrice: 38, currency: 'EUR', serviceFee: 20, fromAirport: 'AMS', fromCity: 'Amsterdam', toAirport: 'WRO', toCity: 'Wrocław', status: 'open', offers: [] }
            ];
        }

        function getCategoryIcon(category) {
            const icons = {
                'Alcohol': '🥃',
                'Perfume': '💄',
                'Electronics': '📱',
                'Food': '🍫',
                'Tobacco': '🚬',
                'Cosmetics': '💊',
                'Fashion': '👜',
                'Watches': '⌚'
            };
            return icons[category] || '📦';
        }

        function renderRequestCard(req) {
            const icon = getCategoryIcon(req.category);
            const offerCount = req.offers?.length || 0;
            const statusClass = offerCount > 0 ? 'status-matched' : 'status-open';
            const statusText = offerCount > 0 ? `${offerCount} offer${offerCount > 1 ? 's' : ''}` : 'Open';
            const currencySymbol = getCurrencySymbol(req.currency || 'EUR');

            let badge = '';
            if (req.matchType === 'near') {
                badge = '<span class="location-badge badge-near-you">📍 Near You</span>';
            } else if (req.matchType === 'route') {
                badge = '<span class="location-badge badge-on-route">✈️ On Your Route</span>';
            }

            return `
                <div class="request-card" data-request-id="${req.id}">
                    <div class="request-header">
                        <div class="request-product">
                            <div class="request-product-icon">${icon}</div>
                            <div class="request-product-info">
                                <h4>${req.product}${badge}</h4>
                                <span>${req.description || req.category}</span>
                            </div>
                        </div>
                        <span class="request-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="request-route">
                        <span class="from">${req.fromAirport} ${req.fromCity}</span>
                        <span class="arrow">→</span>
                        <span class="to">${req.toAirport} ${req.toCity}</span>
                    </div>
                    <div class="request-details">
                        <div class="request-price">${currencySymbol}${req.dutyFreePrice?.toLocaleString() || '0'} <span>duty-free</span></div>
                        <div class="request-fee">
                            <div class="request-fee-amount">+€${req.serviceFee || 0}</div>
                            <div class="request-fee-label">service fee</div>
                        </div>
                    </div>
                </div>
            `;
        }

        function createTravellerModal() {
            if (document.getElementById('travellerModal')) return;

            const modal = document.createElement('div');
            modal.id = 'travellerModal';
            modal.className = 'traveller-modal';
            modal.innerHTML = `
                <div class="traveller-modal-content">
                    <button class="auth-modal-close" onclick="closeTravellerModal()">×</button>
                    <div id="travellerModalBody"></div>
                </div>
            `;
            document.body.appendChild(modal);

            const style = document.createElement('style');
            style.textContent = `
                .traveller-modal { display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(4px);z-index:10000;align-items:center;justify-content:center;padding:1rem;overflow-y:auto; }
                .traveller-modal.show { display:flex; }
                .traveller-modal-content { background:#18181b;border:1px solid #27272a;border-radius:20px;width:100%;max-width:500px;padding:2rem;position:relative;margin:auto; }
                .traveller-header { display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem; }
                .traveller-avatar { width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.5rem; }
                .traveller-info h3 { font-size:1.25rem;font-weight:600;margin-bottom:0.25rem; }
                .traveller-rating { display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;color:#a1a1aa; }
                .traveller-location { display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;font-size:0.875rem;color:#a1a1aa; }
                .traveller-distance { background:rgba(45,212,191,0.1);color:#2dd4bf;padding:0.25rem 0.75rem;border-radius:20px;font-size:0.75rem;font-weight:500; }
                .traveller-section { margin-bottom:1.5rem; }
                .traveller-section-title { font-size:0.75rem;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem; }
                .trip-route { display:flex;align-items:center;gap:0.75rem;background:#111113;padding:1rem;border-radius:12px; }
                .trip-route-city { font-weight:600; }
                .trip-route-airport { font-size:0.75rem;color:#a1a1aa; }
                .trip-route-arrow { color:#a1a1aa;font-size:1.25rem; }
                .trip-details { display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;background:#111113;padding:1rem;border-radius:12px; }
                .trip-detail-label { font-size:0.75rem;color:#a1a1aa;margin-bottom:0.25rem; }
                .trip-detail-value { font-weight:600; }
                .contact-btn { width:100%;padding:1rem;background:linear-gradient(135deg,#d4a853,#b8860b);color:#000;font-weight:600;border:none;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:opacity 0.2s; }
                .contact-btn:hover { opacity:0.9; }
                .nearby-badge { background:rgba(34,197,94,0.1);color:#22c55e;padding:0.375rem 0.75rem;border-radius:20px;font-size:0.8rem;font-weight:500;display:inline-flex;align-items:center;gap:0.375rem; }
            `;
            document.head.appendChild(style);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeTravellerModal();
            });
        }

        async function openTravellerModal(tripId) {
            createTravellerModal();
            const trip = window.featuredTrips?.find(t => t.id === tripId);
            if (!trip) return;

            // Get ALL trips from this traveller
            const travellerId = trip.traveller.id;
            const travellerTrips = window.featuredTrips.filter(t => t.traveller.id === travellerId);

            // Try to get user's location for distance calculation
            if (!userLocation) {
                await getUserLocation();
            }

            const nameParts = trip.traveller.name.trim().split(' ');
            const initials = nameParts.map(n => n[0]).join('').toUpperCase().slice(0, 2);
            const displayName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.` : nameParts[0];

            // Calculate distance if both locations are available
            let distanceHtml = '';
            let nearbyHtml = '';
            if (userLocation && trip.traveller.latitude && trip.traveller.longitude) {
                const distance = calculateDistance(userLocation.lat, userLocation.lon, trip.traveller.latitude, trip.traveller.longitude);
                if (distance !== null) {
                    distanceHtml = `<span class="traveller-distance">${distance} km away</span>`;
                    if (distance < 50) {
                        nearbyHtml = `<div class="nearby-badge">🎯 Nearby - Hand delivery possible!</div>`;
                    }
                }
            }

            const travellerLocation = trip.traveller.city
                ? `${trip.traveller.city}${trip.traveller.country ? ', ' + trip.traveller.country : ''}`
                : 'Location not shared';

            const gradients = [
                'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            ];
            const gradient = gradients[Math.abs(trip.id.charCodeAt(0)) % gradients.length];

            // Build trips HTML - show all trips from this traveller
            const tripsHtml = travellerTrips.map((t, idx) => {
                const departDate = new Date(t.departureDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                const returnDate = t.returnDate ? new Date(t.returnDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'One way';
                return `
                    <div style="background:var(--bg-secondary);border-radius:12px;padding:1rem;margin-bottom:0.75rem;${t.id === tripId ? 'border:2px solid var(--accent-gold);' : 'border:1px solid var(--border);'}">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                            <div style="font-weight:700;font-size:1rem;">${t.fromCity} → ${t.toCity}</div>
                            ${travellerTrips.length > 1 ? `<span style="background:var(--accent-gold);color:#000;padding:0.125rem 0.5rem;border-radius:8px;font-size:0.7rem;font-weight:600;">Trip ${idx + 1}</span>` : ''}
                        </div>
                        <div style="display:flex;gap:0.5rem;font-size:0.75rem;color:var(--text-secondary);margin-bottom:0.5rem;">
                            <span>${t.fromAirport}</span>
                            <span>→</span>
                            <span>${t.toAirport}</span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;text-align:center;">
                            <div style="background:rgba(255,255,255,0.05);padding:0.5rem;border-radius:8px;">
                                <div style="font-size:0.65rem;color:var(--text-muted);">DEPART</div>
                                <div style="font-weight:600;font-size:0.85rem;">${departDate}</div>
                            </div>
                            <div style="background:rgba(255,255,255,0.05);padding:0.5rem;border-radius:8px;">
                                <div style="font-size:0.65rem;color:var(--text-muted);">RETURN</div>
                                <div style="font-weight:600;font-size:0.85rem;">${returnDate}</div>
                            </div>
                            <div style="background:rgba(255,255,255,0.05);padding:0.5rem;border-radius:8px;">
                                <div style="font-size:0.65rem;color:var(--text-muted);">CAPACITY</div>
                                <div style="font-weight:600;font-size:0.85rem;">${t.availableKg ? t.availableKg + 'kg' : 'Flex'}</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            document.getElementById('travellerModalBody').innerHTML = `
                <div class="traveller-header">
                    <div class="traveller-avatar" style="background: ${gradient};">${initials}</div>
                    <div class="traveller-info">
                        <h3>${displayName}</h3>
                        <div class="traveller-rating">
                            <span style="color: #fbbf24;">⭐⭐⭐⭐⭐</span>
                            <span>5.0</span>
                            <span style="background:rgba(45,212,191,0.1);color:#2dd4bf;padding:0.125rem 0.5rem;border-radius:10px;font-size:0.7rem;">VERIFIED</span>
                        </div>
                        <div class="traveller-location">
                            📍 ${travellerLocation} ${distanceHtml}
                        </div>
                    </div>
                </div>

                ${nearbyHtml ? `<div style="margin-bottom:1rem;">${nearbyHtml}</div>` : ''}

                <div class="traveller-section">
                    <div class="traveller-section-title" style="display:flex;justify-content:space-between;align-items:center;">
                        <span>Upcoming Trips</span>
                        <span style="background:var(--accent-gold);color:#000;padding:0.25rem 0.75rem;border-radius:12px;font-size:0.75rem;font-weight:600;">${travellerTrips.length} trip${travellerTrips.length > 1 ? 's' : ''}</span>
                    </div>
                    ${tripsHtml}
                </div>

                ${trip.note ? `
                <div class="traveller-section">
                    <div class="traveller-section-title">Note from Traveller</div>
                    <p style="color:#a1a1aa;font-size:0.875rem;line-height:1.5;">${trip.note}</p>
                </div>
                ` : ''}

                <button class="contact-btn" onclick="contactTraveller('${trip.id}')">
                    💬 Contact ${displayName}
                </button>
            `;

            document.getElementById('travellerModal').classList.add('show');
        }

        function closeTravellerModal() {
            document.getElementById('travellerModal')?.classList.remove('show');
        }

        function contactTraveller(tripId) {
            if (!currentUser) {
                closeTravellerModal();
                openAuthModal('signup');
                showToast('Please sign up to contact travelers', 'info');
                return;
            }

            const trip = window.featuredTrips?.find(t => t.id === tripId);
            if (!trip) return;

            closeTravellerModal();
            openMessageComposer(trip);
        }

        function createMessageComposerModal() {
            if (document.getElementById('messageComposerModal')) return;

            const modal = document.createElement('div');
            modal.id = 'messageComposerModal';
            modal.className = 'message-composer-modal';
            modal.innerHTML = `
                <div class="message-composer-content">
                    <button class="auth-modal-close" onclick="closeMessageComposer()">×</button>
                    <div id="messageComposerBody"></div>
                </div>
            `;
            document.body.appendChild(modal);

            const style = document.createElement('style');
            style.textContent = `
                .message-composer-modal { display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(4px);z-index:10001;align-items:center;justify-content:center;padding:1rem;overflow-y:auto; }
                .message-composer-modal.show { display:flex; }
                .message-composer-content { background:#18181b;border:1px solid #27272a;border-radius:20px;width:100%;max-width:500px;padding:2rem;position:relative;margin:auto; }
            `;
            document.head.appendChild(style);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeMessageComposer();
            });
        }

        function openMessageComposer(trip) {
            createMessageComposerModal();

            const nameParts = trip.traveller.name.trim().split(' ');
            const displayName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1][0]}.` : nameParts[0];
            const initials = nameParts.map(n => n[0]).join('').toUpperCase().slice(0, 2);

            document.getElementById('messageComposerBody').innerHTML = `
                <h3 style="font-size:1.25rem;margin-bottom:1.5rem;">Send Message</h3>

                <div style="display:flex;align-items:center;gap:1rem;padding:1rem;background:#111113;border-radius:12px;margin-bottom:1.5rem;">
                    <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;">${initials}</div>
                    <div>
                        <div style="font-weight:600;">${displayName}</div>
                        <div style="font-size:0.875rem;color:#a1a1aa;">${trip.fromCity} → ${trip.toCity}</div>
                    </div>
                </div>

                <div style="margin-bottom:1.5rem;">
                    <label style="display:block;font-size:0.875rem;color:#a1a1aa;margin-bottom:0.5rem;">Your message</label>
                    <textarea id="composerMessageText" rows="4" placeholder="Hi! I'm interested in sending a package on your trip..." style="width:100%;padding:0.75rem;background:#111113;border:1px solid #27272a;border-radius:12px;color:#fff;resize:none;font-family:inherit;font-size:0.9rem;"></textarea>
                </div>

                <button onclick="sendFirstMessage('${trip.id}')" style="width:100%;padding:1rem;background:linear-gradient(135deg,#d4a853,#b8860b);color:#000;font-weight:600;border:none;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem;">
                    📤 Send Message
                </button>
            `;

            document.getElementById('messageComposerModal').classList.add('show');
            document.getElementById('composerMessageText').focus();
        }

        function closeMessageComposer() {
            document.getElementById('messageComposerModal')?.classList.remove('show');
        }

        async function sendFirstMessage(tripId) {
            const textarea = document.getElementById('composerMessageText');
            const text = textarea.value.trim();

            if (!text) {
                showToast('Please enter a message', 'error');
                return;
            }

            textarea.disabled = true;

            try {
                const response = await fetch('/.netlify/functions/messages', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tripId, text })
                });

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || 'Failed to send message');
                }

                closeMessageComposer();
                showToast('Message sent! Check your dashboard for replies.', 'success');

                // Redirect to dashboard messages after a short delay
                setTimeout(() => {
                    window.location.href = 'dashboard.html#messages';
                }, 1500);
            } catch (e) {
                console.error('Failed to send message:', e);
                showToast(e.message || 'Failed to send message', 'error');
                textarea.disabled = false;
            }
        }

        // ==========================================
        // MAP VIEW WITH PINS - ARRIVAL DESTINATIONS
        // ==========================================

        let arrivalsMap = null;
        let mapMarkers = [];
        const cityCache = {};

        function showListView() {
            document.getElementById('travelersGrid').style.display = 'grid';
            document.getElementById('mapViewContainer').style.display = 'none';
            document.getElementById('listViewBtn').classList.add('active');
            document.getElementById('mapViewBtn').classList.remove('active');
        }

        function showMapView() {
            document.getElementById('travelersGrid').style.display = 'none';
            document.getElementById('mapViewContainer').style.display = 'block';
            document.getElementById('listViewBtn').classList.remove('active');
            document.getElementById('mapViewBtn').classList.add('active');

            setTimeout(() => initArrivalsMap(), 100);
        }

        // Common city coordinates fallback
        const cityCoords = {
            'warsaw': { lat: 52.2297, lon: 21.0122 },
            'dubai': { lat: 25.2048, lon: 55.2708 },
            'london': { lat: 51.5074, lon: -0.1278 },
            'paris': { lat: 48.8566, lon: 2.3522 },
            'berlin': { lat: 52.5200, lon: 13.4050 },
            'amsterdam': { lat: 52.3676, lon: 4.9041 },
            'rome': { lat: 41.9028, lon: 12.4964 },
            'madrid': { lat: 40.4168, lon: -3.7038 },
            'barcelona': { lat: 41.3851, lon: 2.1734 },
            'prague': { lat: 50.0755, lon: 14.4378 },
            'vienna': { lat: 48.2082, lon: 16.3738 },
            'budapest': { lat: 47.4979, lon: 19.0402 },
            'krakow': { lat: 50.0647, lon: 19.9450 },
            'new york': { lat: 40.7128, lon: -74.0060 },
            'los angeles': { lat: 34.0522, lon: -118.2437 },
            'tokyo': { lat: 35.6762, lon: 139.6503 },
            'singapore': { lat: 1.3521, lon: 103.8198 },
            'bangkok': { lat: 13.7563, lon: 100.5018 },
            'sydney': { lat: -33.8688, lon: 151.2093 },
            'cairo': { lat: 30.0444, lon: 31.2357 },
            'istanbul': { lat: 41.0082, lon: 28.9784 },
            'moscow': { lat: 55.7558, lon: 37.6173 },
            'lisbon': { lat: 38.7223, lon: -9.1393 },
            'athens': { lat: 37.9838, lon: 23.7275 },
            'zurich': { lat: 47.3769, lon: 8.5417 },
            'munich': { lat: 48.1351, lon: 11.5820 },
            'frankfurt': { lat: 50.1109, lon: 8.6821 },
            'brussels': { lat: 50.8503, lon: 4.3517 },
            'milan': { lat: 45.4642, lon: 9.1900 },
            'copenhagen': { lat: 55.6761, lon: 12.5683 },
            'stockholm': { lat: 59.3293, lon: 18.0686 },
            'oslo': { lat: 59.9139, lon: 10.7522 },
            'helsinki': { lat: 60.1699, lon: 24.9384 },
            'dublin': { lat: 53.3498, lon: -6.2603 },
            'doha': { lat: 25.2854, lon: 51.5310 },
            'abu dhabi': { lat: 24.4539, lon: 54.3773 },
            'riyadh': { lat: 24.7136, lon: 46.6753 },
            'johannesburg': { lat: -26.2041, lon: 28.0473 },
            'cape town': { lat: -33.9249, lon: 18.4241 },
            'nairobi': { lat: -1.2921, lon: 36.8219 },
            'mumbai': { lat: 19.0760, lon: 72.8777 },
            'delhi': { lat: 28.7041, lon: 77.1025 },
            'hong kong': { lat: 22.3193, lon: 114.1694 },
            'seoul': { lat: 37.5665, lon: 126.9780 },
            'beijing': { lat: 39.9042, lon: 116.4074 },
            'shanghai': { lat: 31.2304, lon: 121.4737 },
            'kuala lumpur': { lat: 3.1390, lon: 101.6869 },
            'jakarta': { lat: -6.2088, lon: 106.8456 },
            'manila': { lat: 14.5995, lon: 120.9842 },
            'toronto': { lat: 43.6532, lon: -79.3832 },
            'vancouver': { lat: 49.2827, lon: -123.1207 },
            'chicago': { lat: 41.8781, lon: -87.6298 },
            'miami': { lat: 25.7617, lon: -80.1918 },
            'san francisco': { lat: 37.7749, lon: -122.4194 },
            'mexico city': { lat: 19.4326, lon: -99.1332 },
            'sao paulo': { lat: -23.5505, lon: -46.6333 },
            'buenos aires': { lat: -34.6037, lon: -58.3816 },
            'rio de janeiro': { lat: -22.9068, lon: -43.1729 },
            'bogota': { lat: 4.7110, lon: -74.0721 },
            'lima': { lat: -12.0464, lon: -77.0428 },
            'santiago': { lat: -33.4489, lon: -70.6693 }
        };

        function getCityCoords(city) {
            if (!city) return null;
            const key = city.toLowerCase().trim();
            return cityCoords[key] || null;
        }

        async function geocodeCity(city) {
            if (!city) return null;

            // Check local cache first
            if (cityCache[city]) return cityCache[city];

            // Check hardcoded coordinates
            const local = getCityCoords(city);
            if (local) {
                cityCache[city] = local;
                return local;
            }

            // Try Nominatim API
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`,
                    { headers: { 'User-Agent': 'FlyAndEarn/1.0' } }
                );
                const data = await response.json();
                if (data && data[0]) {
                    cityCache[city] = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
                    return cityCache[city];
                }
            } catch (e) {
                console.log('Geocoding API failed for:', city);
            }
            return null;
        }

        async function initArrivalsMap() {
            const mapDiv = document.getElementById('arrivalsMap');
            if (!mapDiv) return;

            // Check Leaflet
            if (typeof L === 'undefined') {
                mapDiv.innerHTML = '<p style="padding:2rem;text-align:center;color:#d4a853;">Loading map...</p>';
                setTimeout(initArrivalsMap, 500);
                return;
            }

            // Destroy existing map
            if (arrivalsMap) {
                arrivalsMap.remove();
                arrivalsMap = null;
            }

            // Create map centered on Europe
            arrivalsMap = L.map('arrivalsMap').setView([50, 15], 4);

            // Dark tile layer
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap © CARTO',
                subdomains: 'abcd',
                maxZoom: 18
            }).addTo(arrivalsMap);

            // Get trips
            const trips = window.featuredTrips || [];

            if (!trips.length) {
                const listEl = document.getElementById('locationList');
                if (listEl) listEl.innerHTML = '<p style="text-align:center;color:#888;padding:1rem;">No trips available.</p>';
                return;
            }

            // Add markers
            mapMarkers = [];
            const bounds = [];

            for (const trip of trips) {
                const returnCity = trip.fromCity;
                if (!returnCity) continue;

                const returnDate = trip.returnDate
                    ? new Date(trip.returnDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    : 'TBD';

                const coords = await geocodeCity(returnCity);
                if (!coords) continue;

                const nameParts = (trip.traveller?.name || 'Traveller').trim().split(' ');
                const displayName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1][0]}.` : nameParts[0];

                // Small pin with date
                const icon = L.divIcon({
                    className: 'return-marker',
                    html: `<div style="background:#d4a853;color:#000;padding:4px 8px;border-radius:10px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4);border:2px solid #fff;">${returnDate}</div>`,
                    iconSize: [60, 22],
                    iconAnchor: [30, 11]
                });

                const popup = `
                    <div style="font-family:Outfit,sans-serif;min-width:160px;">
                        <strong>${displayName}</strong><br>
                        <div style="margin:6px 0;padding:6px;background:#f5f5f5;border-radius:6px;">
                            <div style="font-size:11px;color:#666;">Route</div>
                            <div style="font-weight:600;">${trip.fromCity} → ${trip.toCity}</div>
                        </div>
                        <div style="font-size:12px;">📅 Returns: <strong>${returnDate}</strong></div>
                    </div>
                `;

                const marker = L.marker([coords.lat, coords.lon], { icon: icon })
                    .addTo(arrivalsMap)
                    .bindPopup(popup);

                mapMarkers.push(marker);
                bounds.push([coords.lat, coords.lon]);
            }

            // Fit to markers
            if (bounds.length === 1) {
                arrivalsMap.setView(bounds[0], 8);
            } else if (bounds.length > 1) {
                arrivalsMap.fitBounds(bounds, { padding: [40, 40] });
            }

            // Fix size after render
            setTimeout(() => arrivalsMap.invalidateSize(), 100);

            // Load list
            loadTripsList();
        }

        function loadTripsList() {
            const container = document.getElementById('locationList');
            if (!container) return;

            const trips = window.featuredTrips || [];
            if (!trips.length) return;

            container.innerHTML = trips.map(trip => {
                const nameParts = trip.traveller.name.trim().split(' ');
                const displayName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1][0]}.` : nameParts[0];
                const returnDate = trip.returnDate
                    ? new Date(trip.returnDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                    : 'TBD';

                return `
                    <div onclick="openTravellerModal('${trip.id}')" style="background:rgba(255,255,255,0.03);border:1px solid rgba(212,168,83,0.15);border-radius:10px;padding:1rem;cursor:pointer;display:flex;align-items:center;gap:1rem;transition:all 0.2s;" onmouseover="this.style.borderColor='#d4a853'" onmouseout="this.style.borderColor='rgba(212,168,83,0.15)'">
                        <div style="width:44px;height:44px;background:linear-gradient(135deg,#d4a853,#c49b4a);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.25rem;">✈️</div>
                        <div style="flex:1;">
                            <div style="font-weight:600;color:#fff;">${displayName}</div>
                            <div style="font-size:0.85rem;color:#888;">📍 ${trip.fromCity} → ${trip.toCity} → <span style="color:#d4a853;">${trip.fromCity}</span></div>
                            <div style="font-size:0.8rem;color:#2dd4bf;">🏠 Returns ${returnDate}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // ==========================================
        // EVENT DELEGATION FOR CARDS
        // ==========================================

        // Use event delegation for traveller card clicks
        document.addEventListener('click', function(e) {
            const card = e.target.closest('.traveler-card[data-trip-id]');
            if (card) {
                const tripId = card.dataset.tripId;
                if (tripId) {
                    openTravellerModal(tripId);
                }
            }
        });

        // ==========================================
        // EXPOSE FUNCTIONS TO GLOBAL SCOPE
        // ==========================================
        // Required for onclick handlers in HTML
        window.setRole = setRole;
        window.handleStartEarning = handleStartEarning;
        window.handleStartSaving = handleStartSaving;
        window.handleSeeRequests = handleSeeRequests;
        window.setLang = setLang;
        window.toggleLangDropdown = toggleLangDropdown;
        window.openAuthModal = openAuthModal;
        window.closeAuthModal = closeAuthModal;
        window.openMessagesModal = openMessagesModal;
        window.openTravellerModal = openTravellerModal;
        window.showListView = showListView;
        window.showMapView = showMapView;
        window.openTermsModal = openTermsModal;
        window.closeTermsModal = closeTermsModal;
        window.openPrivacyPolicy = openPrivacyPolicy;
        window.closePrivacyPolicy = closePrivacyPolicy;
        window.openImpressum = openImpressum;
        window.closeImpressum = closeImpressum;
        window.openCookieSettings = openCookieSettings;
        window.closeCookieSettings = closeCookieSettings;
        window.saveCookieSettings = saveCookieSettings;
        window.acceptAllCookies = acceptAllCookies;
        window.rejectCookies = rejectCookies;
        window.openWithdrawalModal = openWithdrawalModal;
        window.closeWithdrawalModal = closeWithdrawalModal;
        // Auth functions
        window.handleSignup = handleSignup;
        window.handleLogin = handleLogin;
        window.switchAuthTab = switchAuthTab;
        window.toggleRole = toggleRole;
        window.updatePasswordStrength = updatePasswordStrength;
        window.logout = logout;
