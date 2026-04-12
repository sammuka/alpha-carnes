import { initTheme } from './core/theme.js';
import { initNavigation } from './core/navigation.js';
import { initScrollEngine } from './core/scroll-engine.js';
import { initAnimations } from './core/animations.js';
import { initHero } from './sections/section-hero.js';
import { initBusiness } from './sections/section-business.js';
import { initChallenges } from './sections/section-challenges.js';
import { initSolution } from './sections/section-solution.js';
import { initModules } from './sections/section-modules.js';
import { initFlow } from './sections/section-flow.js';
import { initIntelligence } from './sections/section-intelligence.js';
import { initArchitecture } from './sections/section-architecture.js';
import { initInfrastructure } from './sections/section-infrastructure.js';
import { initSecurity } from './sections/section-security.js';
import { initRoadmap } from './sections/section-roadmap.js';
import { initDocs } from './sections/section-docs.js';
import { initCTA } from './sections/section-cta.js';

function boot() {
  // Core systems
  initTheme();
  initScrollEngine();
  initNavigation();
  initAnimations();

  // Sections (each lazy-inits when visible)
  initHero();
  initBusiness();
  initChallenges();
  initSolution();
  initModules();
  initFlow();
  initIntelligence();
  initArchitecture();
  initInfrastructure();
  initSecurity();
  initRoadmap();
  initDocs();
  initCTA();
}

// Wait for DOM + GSAP
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
