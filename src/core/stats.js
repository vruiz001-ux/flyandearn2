/**
 * FlyAndEarn - Live Stats Tracking
 */

import { Store } from './store.js';

export const Stats = {
  // Get all stats from localStorage
  get() {
    return {
      totalSavings: Store.get('stats_totalSavings', 0),
      activeTravelers: Store.get('stats_activeTravelers', 0),
      completedDeliveries: Store.get('stats_completedDeliveries', 0),
      totalFees: Store.get('stats_totalFees', 0),
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

  // Update the hero stats display
  updateDisplay() {
    const stats = this.get();
    const avgFee = this.getAvgFee();

    const statValues = document.querySelectorAll('.hero-stats .stat-value');
    if (statValues.length >= 3) {
      statValues[0].textContent = this.formatNumber(stats.totalSavings, '\u20AC');
      statValues[1].textContent = stats.activeTravelers.toLocaleString();
      statValues[2].textContent = '\u20AC' + avgFee;
    }
  },

  // Initialize stats display on page load
  init() {
    this.updateDisplay();
  },
};

// Expose to window for backward compatibility
if (typeof window !== 'undefined') {
  window.Stats = Stats;
}
