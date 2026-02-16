/**
 * FlyAndEarn - Data Store (localStorage persistence)
 */

export const Store = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(`flyandearn_${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(`flyandearn_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage error:', e);
    }
  },
  remove: (key) => localStorage.removeItem(`flyandearn_${key}`),
};

// Initialize user data
export let currentUser = Store.get('user', null);
export let requests = Store.get('requests', []);

// Update current user
export function setCurrentUser(user) {
  currentUser = user;
  if (user) {
    Store.set('user', user);
  } else {
    Store.remove('user');
  }
}

// Update requests
export function setRequests(newRequests) {
  requests = newRequests;
  Store.set('requests', requests);
}

// Expose to window for backward compatibility
if (typeof window !== 'undefined') {
  window.Store = Store;
}
