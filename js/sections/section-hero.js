import { animateCounters, ensureGsap } from '../core/animations.js';

export function initHero() {
  initParticles();
  typeWriter('hero-typewriter', 'Gestao operacional inteligente para distribuicao de carnes', 50);
  animateCounters(document.getElementById('hero-stats'));
  heroEntrance();
}

/* ------------------------------------------------------------------ */
/*  tsParticles                                                       */
/* ------------------------------------------------------------------ */

function waitForTsParticles() {
  return new Promise((resolve) => {
    if (window.tsParticles) {
      resolve(window.tsParticles);
      return;
    }
    const check = setInterval(() => {
      if (window.tsParticles) {
        clearInterval(check);
        resolve(window.tsParticles);
      }
    }, 50);
  });
}

async function initParticles() {
  const tsParticles = await waitForTsParticles();

  await tsParticles.load('hero-particles', {
    fullScreen: { enable: false },
    background: { color: { value: 'transparent' } },
    fpsLimit: 60,
    particles: {
      number: {
        value: 60,
        density: { enable: true, area: 900 },
      },
      color: {
        value: ['#06b6d4', '#10b981'],
      },
      shape: { type: 'circle' },
      opacity: {
        value: { min: 0.3, max: 0.7 },
        animation: { enable: true, speed: 0.5, minimumValue: 0.2, sync: false },
      },
      size: {
        value: { min: 1, max: 3 },
        animation: { enable: true, speed: 1, minimumValue: 0.5, sync: false },
      },
      links: {
        enable: true,
        distance: 140,
        color: '#06b6d4',
        opacity: 0.15,
        width: 1,
      },
      move: {
        enable: true,
        speed: 0.6,
        direction: 'none',
        random: true,
        straight: false,
        outModes: { default: 'out' },
      },
    },
    interactivity: {
      detectsOn: 'canvas',
      events: {
        onHover: { enable: true, mode: 'grab' },
        resize: true,
      },
      modes: {
        grab: { distance: 160, links: { opacity: 0.35 } },
      },
    },
    detectRetina: true,
    responsive: [
      {
        maxWidth: 768,
        options: {
          particles: {
            number: { value: 30 },
            links: { distance: 100 },
          },
        },
      },
    ],
  });
}

/* ------------------------------------------------------------------ */
/*  Typewriter                                                        */
/* ------------------------------------------------------------------ */

function typeWriter(elementId, text, speed) {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.classList.add('typewriter');
  let i = 0;

  function tick() {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      i++;
      setTimeout(tick, speed);
    } else {
      // Done typing — start blinking caret
      el.classList.add('typewriter--blink');
    }
  }

  // Small initial delay so the hero has time to fade in
  setTimeout(tick, 600);
}

/* ------------------------------------------------------------------ */
/*  GSAP Hero Entrance                                                */
/* ------------------------------------------------------------------ */

async function heroEntrance() {
  await ensureGsap();

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.from('.hero-badge', {
    y: -20,
    opacity: 0,
    duration: 0.6,
  })
    .from(
      '.hero-title',
      {
        y: 40,
        opacity: 0,
        duration: 0.8,
      },
      '-=0.3'
    )
    .from(
      '.hero-subtitle',
      {
        y: 20,
        opacity: 0,
        duration: 0.6,
      },
      '-=0.4'
    )
    .from(
      '.hero-desc',
      {
        y: 20,
        opacity: 0,
        duration: 0.6,
      },
      '-=0.3'
    )
    .from(
      '.hero-actions',
      {
        y: 20,
        opacity: 0,
        duration: 0.6,
      },
      '-=0.3'
    )
    .from(
      '.hero-stats .stat-card',
      {
        y: 30,
        opacity: 0,
        duration: 0.5,
        stagger: 0.12,
      },
      '-=0.2'
    );
}
