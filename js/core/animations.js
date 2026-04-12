/**
 * GSAP animation utilities.
 * GSAP and ScrollTrigger are loaded globally via CDN.
 */

let gsapReady = false;

function waitForGsap() {
  return new Promise((resolve) => {
    if (window.gsap && window.ScrollTrigger) {
      resolve();
      return;
    }
    const check = setInterval(() => {
      if (window.gsap && window.ScrollTrigger) {
        clearInterval(check);
        resolve();
      }
    }, 50);
  });
}

export async function initAnimations() {
  await waitForGsap();
  gsap.registerPlugin(ScrollTrigger);
  gsapReady = true;
}

export async function ensureGsap() {
  if (!gsapReady) await waitForGsap();
}

/**
 * Animate counters within a container when it scrolls into view.
 */
export function animateCounters(container) {
  if (!container) return;
  const counters = container.querySelectorAll('[data-count]');
  counters.forEach((el) => {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            obs.unobserve(el);
            animateValue(el, 0, target, 2000, prefix, suffix);
          }
        });
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
  });
}

function animateValue(el, start, end, duration, prefix, suffix) {
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * eased);
    el.textContent = `${prefix}${current}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}

/**
 * Create a scroll-triggered animation for an element.
 */
export async function scrollReveal(selector, options = {}) {
  await ensureGsap();
  const defaults = {
    y: 30,
    opacity: 0,
    duration: 0.8,
    stagger: 0.1,
    ease: 'power2.out',
    start: 'top 85%',
    ...options,
  };

  gsap.from(selector, {
    y: defaults.y,
    opacity: defaults.opacity,
    duration: defaults.duration,
    stagger: defaults.stagger,
    ease: defaults.ease,
    scrollTrigger: {
      trigger: typeof selector === 'string' ? selector : selector[0] || selector,
      start: defaults.start,
      toggleActions: 'play none none none',
    },
  });
}
