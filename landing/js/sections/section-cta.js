export function initCTA() {
  const container = document.getElementById('contato-content');
  if (!container) return;

  container.innerHTML = buildCTA();
}

/* ------------------------------------------------------------------ */
/*  CTA card                                                          */
/* ------------------------------------------------------------------ */

function buildCTA() {
  return `
    <div class="cta-card reveal">
      <p class="cta-card__text">
        Estamos prontos para iniciar a <strong>Fase 1</strong> do projeto assim que alinharmos os detalhes finais.
      </p>
      <p class="cta-card__text cta-card__text--secondary">
        Cronograma, equipe e proximos passos — tudo documentado e planejado.
      </p>
      <div class="cta-card__divider"></div>
      <p class="cta-card__footer">
        AlphaCarnes — Proposta Tecnica e Comercial — 2026
      </p>
    </div>
    <style>
      .cta-card {
        background: var(--glass-bg);
        backdrop-filter: blur(var(--glass-blur));
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-xl);
        padding: 3rem 2.5rem;
        position: relative;
        overflow: hidden;
        max-width: 700px;
        margin: 0 auto;
        text-align: center;
        box-shadow: var(--shadow-lg);
      }
      .cta-card::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        padding: 1px;
        background: linear-gradient(
          135deg,
          var(--accent-cyan-dim) 0%,
          transparent 40%,
          transparent 60%,
          var(--accent-emerald-dim) 100%
        );
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
      }
      .cta-card__text {
        font-size: var(--font-size-xl);
        color: var(--text-primary);
        line-height: 1.8;
        margin-bottom: var(--gap-sm);
      }
      .cta-card__text strong {
        color: var(--accent-cyan);
      }
      .cta-card__text--secondary {
        font-size: var(--font-size-base);
        color: var(--text-secondary);
      }
      .cta-card__divider {
        width: 60px;
        height: 2px;
        background: linear-gradient(90deg, var(--accent-cyan), var(--accent-emerald));
        margin: var(--gap-xl) auto;
        border-radius: 1px;
      }
      .cta-card__footer {
        font-size: var(--font-size-sm);
        color: var(--text-muted);
        font-weight: 600;
        letter-spacing: 0.05em;
      }
    </style>
  `;
}
