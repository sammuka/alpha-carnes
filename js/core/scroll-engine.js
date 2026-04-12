export function initScrollEngine() {
  // Reveal-on-scroll for elements with .reveal class
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Don't unobserve — allows re-animation on re-scroll
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  );

  // Observe all .reveal elements
  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

  // Stagger observer
  const staggerObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll('.stagger').forEach((el) => staggerObserver.observe(el));

  // Re-run observers when new content is added
  const mutationObs = new MutationObserver(() => {
    document.querySelectorAll('.reveal:not(.visible)').forEach((el) => revealObserver.observe(el));
    document.querySelectorAll('.stagger:not(.visible)').forEach((el) => staggerObserver.observe(el));
  });
  mutationObs.observe(document.getElementById('main-content'), { childList: true, subtree: true });
}
