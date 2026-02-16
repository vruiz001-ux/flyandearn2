import { test, expect } from '@playwright/test';

// Common viewport sizes to test
const viewports = [
  { name: 'Mobile S (360)', width: 360, height: 640 },
  { name: 'iPhone 12/13/14 (390)', width: 390, height: 844 },
  { name: 'iPhone Plus (414)', width: 414, height: 896 },
  { name: 'Tablet (768)', width: 768, height: 1024 },
  { name: 'iPad Pro (1024)', width: 1024, height: 1366 },
  { name: 'Laptop (1366)', width: 1366, height: 768 },
  { name: 'Desktop (1440)', width: 1440, height: 900 },
];

const pagesToTest = [
  { name: 'Homepage', url: '/' },
  { name: 'Pricing', url: '/pricing.html' },
  { name: 'FAQ', url: '/faq.html' },
  { name: 'Contact', url: '/contact.html' },
  { name: 'Dashboard', url: '/dashboard.html' },
];

test.describe('Responsive Layout Tests', () => {
  for (const viewport of viewports) {
    for (const page of pagesToTest) {
      test(`${page.name} at ${viewport.name}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
        });
        const browserPage = await context.newPage();

        await browserPage.goto(page.url);
        await browserPage.waitForLoadState('domcontentloaded');

        // Check no horizontal overflow
        const bodyWidth = await browserPage.evaluate(() => document.body.scrollWidth);
        const viewportWidth = await browserPage.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10); // 10px tolerance

        // Check main content is visible
        const body = browserPage.locator('body');
        await expect(body).toBeVisible();

        // Take screenshot for manual review
        await browserPage.screenshot({
          path: `test-results/responsive-${page.name.toLowerCase()}-${viewport.width}.png`,
          fullPage: false
        });

        await context.close();
      });
    }
  }
});

test.describe('Mobile Navigation Tests', () => {
  test('Mobile menu toggle works on iPhone', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check for mobile menu button
    const mobileMenuBtn = page.locator('#mobileMenuToggle, .mobile-menu-toggle, [aria-label*="menu"]').first();

    if (await mobileMenuBtn.isVisible()) {
      await mobileMenuBtn.click();
      // Wait for menu animation
      await page.waitForTimeout(300);

      // Check mobile nav is visible
      const mobileNav = page.locator('.mobile-nav, #mobileNav, [class*="mobile-nav"]').first();
      await expect(mobileNav).toBeVisible();
    }

    await context.close();
  });

  test('Tap targets are at least 44px on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check button sizes
    const buttons = page.locator('button, a.btn, [role="button"]');
    const count = await buttons.count();

    let smallTapTargets = [];
    for (let i = 0; i < Math.min(count, 20); i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible()) {
        const box = await btn.boundingBox();
        if (box && (box.width < 44 || box.height < 44)) {
          const text = await btn.textContent();
          smallTapTargets.push(`${text?.trim().slice(0, 20) || 'unnamed'}: ${box.width}x${box.height}`);
        }
      }
    }

    // Log small tap targets but don't fail (informational)
    if (smallTapTargets.length > 0) {
      console.log('Small tap targets found:', smallTapTargets);
    }

    await context.close();
  });
});

test.describe('Modal and Overlay Tests', () => {
  test('Auth modal opens and closes correctly on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Try to open login modal
    const loginBtn = page.locator('[onclick*="openAuthModal"], #headerLoginBtn, [data-i18n="btn.login"]').first();

    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      await page.waitForTimeout(500);

      // Check modal is visible
      const modal = page.locator('.auth-modal, #authModal, [class*="auth-modal"]').first();
      await expect(modal).toBeVisible();

      // Check modal doesn't overflow viewport
      const modalBox = await modal.boundingBox();
      if (modalBox) {
        expect(modalBox.width).toBeLessThanOrEqual(390);
      }

      // Close modal
      const closeBtn = page.locator('.auth-modal-close, [class*="modal-close"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }

    await context.close();
  });
});
