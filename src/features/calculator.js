/**
 * FlyAndEarn - Calculator Feature (Lazy Loaded)
 * Dynamically imports the full calculator when needed
 */

let calculatorLoaded = false;

export async function loadCalculator() {
  if (calculatorLoaded) return;

  // Load the original calculator script dynamically
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/flyandearn-calculator.js?v=20260118c';
    script.onload = () => {
      calculatorLoaded = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export function initCalculatorLazyLoad() {
  const container = document.getElementById('flyandearn-calculator');
  if (!container) return;

  // Use IntersectionObserver to load calculator when visible
  const observer = new IntersectionObserver(
    async (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          observer.disconnect();
          await loadCalculator();
          break;
        }
      }
    },
    {
      rootMargin: '200px', // Start loading 200px before visible
      threshold: 0,
    }
  );

  observer.observe(container);
}

export default loadCalculator;
