# Onda DS v3 — Implementação Completa (Direção A + KPI strip da B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar o DS v3 aprovado (Direção A "Evolução" com KPI strip da Direção B) a TODO o frontend — tokens, componentes base e as ~40 telas — sem alterar comportamento, contratos de API ou lógica de negócio.

**Architecture:** Reescrita do `@theme` em `globals.css` (Tailwind 4, sem tailwind.config), substituição/criação de componentes em `src/components/ui/`, e migração tela a tela aplicando as classes utilitárias definidas nesta spec. Referência visual canônica: `docs/ds-preview/direcao-a/*.html` (protótipo aprovado pelo cliente em 05/08/2026).

**Tech Stack:** Next.js 16 (App Router) · React 19 · Tailwind 4 (`@theme` em CSS) · shadcn/radix já instalado · `next/font/google` (Inter + JetBrains Mono) · lucide-react 0.511 · Jest + Playwright.

## Global Constraints

- **Nada de lógica nova.** Esta onda é 100% visual: JSX/classes/estilos. Handlers, fetches, estados e contratos permanecem intactos. Se um passo pedir para mover JSX, os `onClick`/`onChange`/`value` originais vão junto, byte a byte.
- **AD-07 obrigatória antes do merge** (Tarefa 0): registra a substituição do Princípio I (fidelidade ao protótipo v1.1) pela fidelidade ao protótipo DS v3 (`docs/ds-preview/direcao-a/`).
- **Terminologia:** a palavra "Marca" segue banida de telas e código (v1.1 §6.8). Rótulo de busca de cliente é sempre `Buscar cliente…`.
- **Fontes:** Inter (`--font-inter`) para UI; JetBrains Mono (`--font-jbmono`) EXCLUSIVAMENTE para: valores de KPI, pesos, moeda, quantidades em coluna, códigos (UUID curto, ROM-*, CP-*, ETQ-*, CLI-*, placas, CNPJ), horas/datas em coluna de tabela. Nunca em rótulos, títulos ou texto corrido.
- **Grade de densidade (não negociável, é o núcleo da onda):**
  - Controle padrão: `h-8` (32px). Controle compacto (filtros/ações de linha): `h-7` (28px).
  - Linha de tabela: `h-9` (36px). Header de tabela: `h-[30px]`.
  - Header de card: `h-[38px]`. Padding de card: `p-3` (12px).
  - Página: `p-4` já existente no layout admin + `space-y-3` entre blocos.
  - Page header: UMA linha (h1 + subtítulo + ações à direita), `mb-3`.
  - Topbar: `h-11` (44px). Sidebar: `w-[232px]`.
- **Radii:** card `rounded-lg` (8px), controle `rounded-md` (6px), pill `rounded-full`. NUNCA `rounded-xl` em cards novos.
- **Sombras:** só via tokens `--shadow-1/2/3`. KPI strip e cards planos NÃO têm sombra além de `--shadow-1` (cards) e nenhuma (KPI strip).
- **Estados completos em todo controle novo:** default, hover, focus-visible (ring 3px `--color-ring`), active, disabled, error (`aria-invalid`), readonly, loading (onde aplicável).
- **Sem falha silenciosa:** nenhum teste/verificação desta spec pode ser pulado; se falhar, parar e reportar.
- **Gates por tarefa:** `npm run lint && npm run type-check && npm run test` no diretório `app/frontend` verdes antes de cada commit. E2E `npm run e2e:shell` no gate final.
- **Commits:** um por tarefa, mensagem no padrão `feat(ds3): <resumo>` ou `refactor(ds3): <resumo>`, terminando com `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Snapshot visual:** referência de aceite é o protótipo `docs/ds-preview/direcao-a/`. Onde esta spec e o protótipo divergirem em um detalhe de pixel, **esta spec vence** (ela já incorpora a decisão do KPI da Direção B).

---

## PARTE 1 — FUNDAÇÕES

### Tarefa 1: Fontes (Inter + JetBrains Mono)

**Files:**
- Modify: `app/frontend/src/app/layout.tsx`

**Interfaces:**
- Produces: variáveis CSS `--font-inter` e `--font-jbmono` disponíveis no `<html>`; consumidas pela Tarefa 2 (`--font-sans`, `--font-data`).

- [ ] **Step 1: Substituir o conteúdo integral de `src/app/layout.tsx` por:**

```tsx
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jbmono',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AlphaCarnes',
  description: 'Sistema de gestão operacional AlphaCarnes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `cd app/frontend && npm run type-check`
Expected: PASS (0 erros)

- [ ] **Step 3: Commit**

```bash
git add app/frontend/src/app/layout.tsx
git commit -m "feat(ds3): carrega JetBrains Mono ao lado da Inter via next/font"
```

---

### Tarefa 2: Tokens — reescrita completa do `globals.css`

**Files:**
- Modify: `app/frontend/src/app/globals.css` (substituição integral)

**Interfaces:**
- Produces: todos os tokens `--color-*`, `--radius-*`, `--shadow-*`, `--font-*` desta seção. Todas as tarefas seguintes consomem estas classes utilitárias Tailwind geradas (`bg-primary`, `text-status-recebido`, `shadow-1` etc.).
- **Compat:** os nomes de token legados que as 40 telas ainda referenciam são mantidos como aliases na seção `/* Compat DS v2 */` — a migração das telas os remove gradualmente; a Tarefa final (limpeza) apaga os que restarem sem uso.

- [ ] **Step 1: Substituir o conteúdo integral de `src/app/globals.css` por:**

```css
@import "tailwindcss";

@theme {
  /* ============ DS v3 — Direção A (aprovada 2026-08-05) ============ */

  /* Fontes */
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-data: var(--font-jbmono), ui-monospace, 'Cascadia Mono', monospace;

  /* Neutros */
  --color-background: #F4F6F9;
  --color-foreground: #18202C;
  --color-card: #FFFFFF;
  --color-card-foreground: #18202C;
  --color-popover: #FFFFFF;
  --color-popover-foreground: #18202C;
  --color-surface-2: #F8FAFC;
  --color-surface-3: #EEF2F7;
  --color-border: #DDE4EC;
  --color-border-strong: #C3CEDB;
  --color-input: #C3CEDB;
  --color-fg-secondary: #4A5A6E;
  --color-muted: #EEF2F7;
  --color-muted-foreground: #6E7E92;
  --color-fg-faint: #93A1B3;

  /* Marca / ação */
  --color-primary: #2D6BBE;
  --color-primary-foreground: #FFFFFF;
  --color-primary-hover: #24589E;
  --color-primary-active: #1D4880;
  --color-primary-soft: #E8F0FA;
  --color-primary-soft-border: #C4D8F0;
  --color-primary-fg: #1D5FAE;
  --color-ring: #2D6BBE;
  --color-secondary: #F1F5F9;
  --color-secondary-foreground: #18202C;
  --color-accent: #E8F0FA;
  --color-accent-foreground: #18202C;

  /* Semânticos */
  --color-destructive: #C23325;
  --color-destructive-foreground: #FFFFFF;
  --color-danger-hover: #A32A1E;
  --color-danger-soft: #FCEAE7;
  --color-danger-soft-border: #EAB4AC;
  --color-danger-fg: #B3362A;
  --color-success: #1B8449;
  --color-success-soft: #E4F4EB;
  --color-success-soft-border: #BEE5CD;
  --color-success-fg: #177A43;
  --color-warning: #B87D0E;
  --color-warning-soft: #FCF3DC;
  --color-warning-soft-border: #F0DCAE;
  --color-warning-fg: #91620B;
  --color-info-soft: #E7F0FB;
  --color-info-fg: #1D5FAE;

  /* Status operacionais — StatusPill (croma harmonizado) */
  --color-status-recebido: #1D5FAE;
  --color-status-recebido-bg: #E7F0FB;
  --color-status-recebido-dot: #2F6FC4;
  --color-status-pesado: #6636B8;
  --color-status-pesado-bg: #F1EAFB;
  --color-status-pesado-dot: #7C4FD0;
  --color-status-expedido: #177A43;
  --color-status-expedido-bg: #E3F5EA;
  --color-status-expedido-dot: #1E9A56;
  --color-status-divergencia: #91620B;
  --color-status-divergencia-bg: #FCF3DC;
  --color-status-divergencia-dot: #C98A12;
  --color-status-bloqueado: #B3362A;
  --color-status-bloqueado-bg: #FCE9E6;
  --color-status-bloqueado-dot: #D4453A;
  --color-status-pendente: #55657A;
  --color-status-pendente-bg: #EDF1F6;
  --color-status-pendente-dot: #7A8AA0;

  /* Sidebar (gradiente preservado da identidade) */
  --color-sidebar-gradient-start: #1E3A5F;
  --color-sidebar-gradient-end: #1B4E9B;
  --color-sidebar-text: rgba(255, 255, 255, 0.92);
  --color-sidebar-text-dim: rgba(255, 255, 255, 0.60);
  --color-sidebar-text-muted: rgba(255, 255, 255, 0.42);
  --color-sidebar-item-hover: rgba(255, 255, 255, 0.08);
  --color-sidebar-item-active: rgba(255, 255, 255, 0.16);
  --color-sidebar-border: rgba(255, 255, 255, 0.12);

  /* Charts (recharts) */
  --color-chart-1: #2D6BBE;
  --color-chart-2: #1B8449;
  --color-chart-3: #B87D0E;
  --color-chart-4: #C23325;
  --color-chart-5: #6E7E92;

  /* Tabela */
  --color-table-zebra: #FBFCFE;
  --color-table-row-hover: #F8FAFC;

  /* Badge Provisório */
  --color-provisorio-bg: #FCF3DC;
  --color-provisorio-text: #91620B;
  --color-provisorio-border: #F0DCAE;

  /* Raios — densidade */
  --radius: 0.5rem;        /* 8px — card */
  --radius-lg: 0.5rem;
  --radius-md: 0.375rem;   /* 6px — controle */
  --radius-sm: 0.25rem;
  --radius-xl: 0.625rem;   /* 10px — modal */

  /* Elevação */
  --shadow-1: 0 1px 2px rgba(24, 32, 44, 0.06);
  --shadow-2: 0 2px 6px rgba(24, 32, 44, 0.08), 0 1px 2px rgba(24, 32, 44, 0.05);
  --shadow-3: 0 8px 24px rgba(24, 32, 44, 0.14), 0 2px 6px rgba(24, 32, 44, 0.08);

  /* ============ Compat DS v2 (remover ao fim da onda; NÃO usar em código novo) ============ */
  --color-text-secondary: #4A5A6E;
  --color-text-muted: #93A1B3;
  --color-primary-dark: #24589E;
  --color-destructive-bg: #FCEAE7;
  --color-success-bg: #E4F4EB;
  --color-warning-bg: #FCF3DC;
  --color-info: #1D5FAE;
  --color-info-bg: #E7F0FB;
  --color-brand-navy: #24589E;
  --color-brand-navy-hover: #1D4880;
  --color-brand-navy-10: #E8F0FA;
  --color-brand-navy-deep: #1E3A5F;
  --color-brand-blue-mid: #2D6BBE;
  --color-action-blue: #2D6BBE;
  --color-action-blue-hover: #24589E;
  --color-action-blue-strong: #1D4880;
  --color-action-blue-bg: #E8F0FA;
  --color-action-blue-border: #C4D8F0;
  --color-action-blue-text: #1D5FAE;
  --color-action-blue-ring: #C4D8F0;
  --color-surface-subtle: #F8FAFC;
  --color-surface-chip: #EEF2F7;
  --color-border-chip: #DDE4EC;
  --color-text-strong: #18202C;
  --color-text-slate: #4A5A6E;
  --color-text-graphite: #4A5A6E;
  --color-text-ink: #4A5A6E;
  --color-login-panel: #1E3A5F;
  --color-login-panel-caption: rgba(255, 255, 255, 0.42);
  --color-login-panel-text: rgba(255, 255, 255, 0.60);
  --color-login-heading: #18202C;
  --color-login-text: #6E7E92;
  --color-pipeline-done: #1B8449;
  --color-pipeline-future: #93A1B3;
  --color-success-strong: #177A43;
  --color-success-surface: #E4F4EB;
  --color-success-strong-hover: #14603A;
  --color-success-strong-border: #BEE5CD;
  --color-danger-strong: #B3362A;
  --color-danger-surface: #FCEAE7;
  --color-danger-strong-text: #B3362A;
  --color-danger-strong-border: #EAB4AC;
  --color-danger-strong-hover: #A32A1E;
  --color-danger-rose: #C23325;
  --color-violet-accent: #6636B8;
  --color-violet-surface: #F1EAFB;
  --color-sidebar-popover: #1E3A5F;
  --color-avatar-blue-bg: rgba(45, 107, 190, 0.14);
  --color-avatar-violet-bg: rgba(102, 54, 184, 0.14);
  --color-avatar-green-bg: rgba(27, 132, 73, 0.14);
  --color-avatar-amber-bg: rgba(184, 125, 14, 0.14);
  --color-status-dot-ativo: #1E9A56;
  --color-status-dot-info: #2F6FC4;
  --color-status-dot-warning: #C98A12;
  --color-info-surface: #E7F0FB;
  --color-info-border: #C4D8F0;
  --color-info-icon: #1D5FAE;
  --color-info-ink: #1D5FAE;
  --color-placeholder: #93A1B3;
  --color-warning-surface: #FCF3DC;
  --color-warning-ink: #91620B;
  --color-code-surface: #18202C;
  --color-required-mark: #B3362A;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
    box-sizing: border-box;
  }

  body {
    @apply bg-background text-foreground antialiased;
    font-family: var(--font-sans);
    font-size: 0.8125rem; /* 13px — base densa da UI */
    line-height: 1.45;
  }
}

@layer utilities {
  /* Dados: números, códigos, moeda, pesos, datas em coluna */
  .font-data {
    font-family: var(--font-data);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
}
```

- [ ] **Step 2: Verificar build**

Run: `cd app/frontend && npm run build`
Expected: build verde. (As telas ainda usam tokens compat — todos definidos acima, nada quebra.)

- [ ] **Step 3: Verificação visual mínima**

Run: `docker compose up -d frontend` (se não estiver rodando) e abrir `http://localhost:4000/login`.
Expected: página carrega, azuis levemente mais escuros, sem tela branca ou erro de console.

- [ ] **Step 4: Commit**

```bash
git add app/frontend/src/app/globals.css
git commit -m "feat(ds3): tokens DS v3 (Direção A) + aliases de compat DS v2"
```

---

## PARTE 2 — COMPONENTES BASE

Regra geral desta parte: cada componente abaixo tem o código COMPLETO. O worker substitui/cria o arquivo exatamente como escrito. Nenhum outro arquivo é alterado na tarefa, exceto quando listado.

### Tarefa 3: `cn` único

**Files:**
- Modify: `app/frontend/src/components/ui/utils.ts`
- Keep: `app/frontend/src/lib/cn.ts` (fonte canônica, não muda)

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` re-exportado de `@/lib/cn` — os componentes `ui/` continuam importando `./utils` sem mudança.

- [ ] **Step 1: Substituir o conteúdo integral de `src/components/ui/utils.ts` por:**

```ts
export { cn } from '@/lib/cn';
```

- [ ] **Step 2: Verificar**

Run: `cd app/frontend && npm run type-check && npm run test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/frontend/src/components/ui/utils.ts
git commit -m "refactor(ds3): unifica cn() em @/lib/cn"
```

---

### Tarefa 4: Button v3

**Files:**
- Modify: `app/frontend/src/components/ui/button.tsx` (substituição integral)

**Interfaces:**
- Produces: `Button`, `buttonVariants`. Variants: `default | secondary | ghost | destructive | destructiveOutline | link`. Sizes: `default (h-8) | sm (h-7) | icon (32×32) | iconSm (28×28)`. Props extras preservadas: `asChild?: boolean`, `loading?: boolean`.
- **Breaking controlado:** o variant legado `acao` vira alias de `default` (mesma render); o variant `outline` vira alias de `secondary`. Ambos permanecem aceitos pelo type para não quebrar as ~40 telas antes da migração; a tarefa de limpeza final remove os aliases.

- [ ] **Step 1: Substituir o conteúdo integral de `src/components/ui/button.tsx` por:**

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent text-[13px] font-semibold transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35 aria-invalid:border-destructive select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-1 hover:bg-primary-hover active:bg-primary-active",
        acao:
          "bg-primary text-primary-foreground shadow-1 hover:bg-primary-hover active:bg-primary-active",
        secondary:
          "border-border-strong bg-card text-foreground shadow-1 hover:bg-surface-2 hover:border-fg-faint active:bg-surface-3",
        outline:
          "border-border-strong bg-card text-foreground shadow-1 hover:bg-surface-2 hover:border-fg-faint active:bg-surface-3",
        ghost:
          "text-fg-secondary hover:bg-surface-3 hover:text-foreground",
        destructive:
          "bg-destructive text-white shadow-1 hover:bg-danger-hover",
        destructiveOutline:
          "border-danger-soft-border bg-card text-danger-fg hover:bg-danger-soft hover:border-danger-fg",
        link: "text-primary-fg underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-9 px-4",
        icon: "size-8",
        iconSm: "size-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
```

- [ ] **Step 2: Verificar**

Run: `cd app/frontend && npm run type-check && npm run test`
Expected: PASS. Nota: `loading` agora mantém o texto do children com spinner à esquerda (antes trocava por "Carregando…") — comportamento visual definido pelo protótipo, sem impacto funcional.

- [ ] **Step 3: Commit**

```bash
git add app/frontend/src/components/ui/button.tsx
git commit -m "feat(ds3): Button v3 denso (h-8/h-7) com estados completos"
```

---

### Tarefa 5: Input, Textarea, Label, FormField

**Files:**
- Modify: `app/frontend/src/components/ui/input.tsx` (substituição integral)
- Modify: `app/frontend/src/components/ui/textarea.tsx` (substituição integral)
- Modify: `app/frontend/src/components/ui/label.tsx` (substituição integral)
- Create: `app/frontend/src/components/ui/form-field.tsx`

**Interfaces:**
- Produces:
  - `Input(props: React.ComponentProps<'input'> & { adornLeft?: React.ReactNode; adornRight?: React.ReactNode })` — h-8; com `adornRight` numérico alinha à direita em font-data.
  - `Textarea(props: React.ComponentProps<'textarea'>)` — min-h-16.
  - `Label` — 11px/600/uppercase.
  - `FormField({ label, required, help, error, htmlFor, children, className })` — wrapper label+controle+ajuda+erro usado por TODAS as telas de formulário desta onda.

- [ ] **Step 1: Substituir `src/components/ui/input.tsx` por:**

```tsx
import * as React from "react";

import { cn } from "./utils";

interface InputProps extends React.ComponentProps<"input"> {
  adornLeft?: React.ReactNode;
  adornRight?: React.ReactNode;
}

function Input({ className, type, adornLeft, adornRight, ...props }: InputProps) {
  const base = (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-8 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-[13px] text-foreground transition-[color,border-color,box-shadow] duration-100 outline-none",
        "placeholder:text-fg-faint selection:bg-primary selection:text-primary-foreground",
        "hover:not-focus:not-disabled:border-fg-faint",
        "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/35",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted-foreground",
        "read-only:bg-surface-2 read-only:text-fg-secondary",
        "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/25",
        adornLeft && "pl-8",
        adornRight && "pr-9 text-right font-data",
        className,
      )}
      {...props}
    />
  );

  if (!adornLeft && !adornRight) return base;

  return (
    <div className="relative flex w-full items-center">
      {adornLeft && (
        <span className="pointer-events-none absolute left-2.5 flex items-center text-fg-faint [&_svg]:size-3.5">
          {adornLeft}
        </span>
      )}
      {base}
      {adornRight && (
        <span className="pointer-events-none absolute right-2.5 text-xs font-semibold text-muted-foreground">
          {adornRight}
        </span>
      )}
    </div>
  );
}

export { Input };
```

- [ ] **Step 2: Substituir `src/components/ui/textarea.tsx` por:**

```tsx
import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full rounded-md border border-input bg-card px-2.5 py-2 text-[13px] leading-[1.4] text-foreground transition-[color,border-color,box-shadow] duration-100 outline-none resize-y",
        "placeholder:text-fg-faint",
        "hover:not-focus:not-disabled:border-fg-faint",
        "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/35",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted-foreground",
        "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/25",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
```

- [ ] **Step 3: Substituir `src/components/ui/label.tsx` por:**

```tsx
"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "./utils";

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex select-none items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.02em] text-fg-secondary",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
```

- [ ] **Step 4: Criar `src/components/ui/form-field.tsx`:**

```tsx
import * as React from "react";
import { cn } from "./utils";
import { Label } from "./label";

interface FormFieldProps {
  label: React.ReactNode;
  required?: boolean;
  help?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Bloco label + controle + ajuda/erro do DS v3.
 * Estrutura fixa: gap de 4px; erro substitui a ajuda quando presente.
 */
export function FormField({
  label,
  required,
  help,
  error,
  htmlFor,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger-fg">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-[11px] font-medium text-danger-fg">
          {error}
        </p>
      ) : (
        help && <p className="text-[11px] text-muted-foreground">{help}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar**

Run: `cd app/frontend && npm run type-check && npm run test && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/frontend/src/components/ui/input.tsx app/frontend/src/components/ui/textarea.tsx app/frontend/src/components/ui/label.tsx app/frontend/src/components/ui/form-field.tsx
git commit -m "feat(ds3): Input/Textarea/Label densos + FormField compartilhado"
```

---

### Tarefa 6: SelectNative (substituto padronizado do `<select>` cru)

**Files:**
- Create: `app/frontend/src/components/ui/select-native.tsx`

**Interfaces:**
- Produces: `SelectNative(props: React.ComponentProps<'select'> & { size?: 'default' | 'sm' })` — select nativo estilizado h-8/h-7 com chevron SVG embutido. Usado nas telas onde hoje há `<select>` com classes hardcoded (15 arquivos). O Radix `Select` (`select.tsx`) permanece para casos já migrados; **novo código usa SelectNative** para manter comportamento nativo (teclado/scroll) nas telas densas.

- [ ] **Step 1: Criar `src/components/ui/select-native.tsx`:**

```tsx
import * as React from "react";

import { cn } from "./utils";

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236E7E92' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

interface SelectNativeProps extends React.ComponentProps<"select"> {
  selectSize?: "default" | "sm";
}

function SelectNative({ className, selectSize = "default", ...props }: SelectNativeProps) {
  return (
    <select
      data-slot="select-native"
      style={{ backgroundImage: CHEVRON }}
      className={cn(
        "w-full appearance-none rounded-md border border-input bg-card bg-no-repeat pl-2.5 pr-7 text-[13px] text-foreground transition-[border-color,box-shadow] duration-100 outline-none [background-position:right_8px_center]",
        selectSize === "default" ? "h-8" : "h-7 text-xs",
        "hover:not-focus:not-disabled:border-fg-faint",
        "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/35",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted-foreground",
        "aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { SelectNative };
```

- [ ] **Step 2: Verificar**

Run: `cd app/frontend && npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/frontend/src/components/ui/select-native.tsx
git commit -m "feat(ds3): SelectNative padronizado (h-8/h-7) com chevron"
```

---

### Tarefa 7: StatusPill v3 + mapa de status de pedido

**Files:**
- Modify: `app/frontend/src/components/ui/status-pill.tsx` (substituição integral)
- Modify: `app/frontend/src/lib/status-ui.ts` (apenas conferência — ver Step 2)

**Interfaces:**
- Consumes: tokens `--color-status-*` da Tarefa 2.
- Produces: `StatusPill({ variant, label?, className? })` — API idêntica à atual (as 19 telas que já usam não quebram). `StatusPillVariant` inalterado. Novo visual: h-5 (20px), dot 5px, texto 11px/600.

- [ ] **Step 1: Substituir `src/components/ui/status-pill.tsx` por:**

```tsx
import { cn } from '@/lib/cn';

export type StatusPillVariant =
  | 'recebido'
  | 'pesado'
  | 'expedido'
  | 'divergencia'
  | 'bloqueado'
  | 'pendente';

const VARIANT_CLASSES: Record<StatusPillVariant, string> = {
  recebido: 'text-status-recebido bg-status-recebido-bg [--pill-dot:var(--color-status-recebido-dot)]',
  pesado: 'text-status-pesado bg-status-pesado-bg [--pill-dot:var(--color-status-pesado-dot)]',
  expedido: 'text-status-expedido bg-status-expedido-bg [--pill-dot:var(--color-status-expedido-dot)]',
  divergencia:
    'text-status-divergencia bg-status-divergencia-bg [--pill-dot:var(--color-status-divergencia-dot)]',
  bloqueado: 'text-status-bloqueado bg-status-bloqueado-bg [--pill-dot:var(--color-status-bloqueado-dot)]',
  pendente: 'text-status-pendente bg-status-pendente-bg [--pill-dot:var(--color-status-pendente-dot)]',
};

const VARIANT_LABELS: Record<StatusPillVariant, string> = {
  recebido: 'Recebido',
  pesado: 'Pesado',
  expedido: 'Expedido',
  divergencia: 'Divergência',
  bloqueado: 'Bloqueado',
  pendente: 'Pendente',
};

interface StatusPillProps {
  variant: StatusPillVariant;
  label?: string;
  className?: string;
}

export function StatusPill({ variant, label, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-[5px] whitespace-nowrap rounded-full px-2 text-[11px] font-semibold',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      <span
        className="size-[5px] shrink-0 rounded-full bg-[var(--pill-dot)]"
        aria-hidden="true"
      />
      {label ?? VARIANT_LABELS[variant]}
    </span>
  );
}
```

- [ ] **Step 2: Conferir `src/lib/status-ui.ts`** — abrir o arquivo e garantir que os rótulos de status de pedido exibidos são acentuados (mapa `label` por status). Se o arquivo só mapeia `variant`, criar/atualizar a constante exportada:

```ts
export const ROTULO_STATUS_PEDIDO: Record<string, string> = {
  rascunho_com_reserva_ativa: 'Rascunho · reserva ativa',
  em_elaboracao_com_reserva_ativa: 'Em elaboração · reserva ativa',
  aguardando_confirmacao_overbooking: 'Aguardando confirmação de overbooking',
  finalizado: 'Finalizado',
  parcialmente_atendido: 'Parcialmente atendido',
  atendido: 'Atendido',
  faturado: 'Faturado',
  cancelado: 'Cancelado',
};

export function rotuloStatusPedido(status: string): string {
  return ROTULO_STATUS_PEDIDO[status] ?? status.replace(/_/g, ' ');
}
```

(Se as chaves reais do backend diferirem — conferir em `src/lib/status-ui.ts` os literais já usados por `statusPedidoVariant` — usar EXATAMENTE as chaves existentes ali; a regra é: todo status exibido passa por `rotuloStatusPedido`, nunca `replace(/_/g,' ')` inline.)

- [ ] **Step 3: Verificar**

Run: `cd app/frontend && npm run type-check && npm run test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/frontend/src/components/ui/status-pill.tsx app/frontend/src/lib/status-ui.ts
git commit -m "feat(ds3): StatusPill v3 (20px, classes utilitárias) + rótulos acentuados de status"
```

---

### Tarefa 8: KpiStrip (substitui KpiCard)

**Files:**
- Create: `app/frontend/src/components/ui/kpi-strip.tsx`
- Keep: `app/frontend/src/components/ui/kpi-card.tsx` (intocado até a limpeza final)

**Interfaces:**
- Produces:
  - `KpiStrip({ children, className })` — grid `grid-auto-flow: column` com divisores.
  - `Kpi({ label, value, hint, tone?: 'default' | 'ok' | 'alert' | 'danger' })` — célula.
- Visual EXATO (KPI da Direção B aprovado): célula `px-3 pt-2 pb-[7px]`; label 11px/500 `text-muted-foreground` truncado; valor `font-data` 20px/700 `leading-[1.2] tracking-[-0.02em]`; hint 10px `text-fg-faint` truncado; borda esquerda entre células; SEM sombra; SEM ícone.

- [ ] **Step 1: Criar `src/components/ui/kpi-strip.tsx`:**

```tsx
import * as React from 'react';
import { cn } from '@/lib/cn';

const TONE_VALUE_CLASS = {
  default: 'text-foreground',
  ok: 'text-success-fg',
  alert: 'text-warning-fg',
  danger: 'text-danger-fg',
} as const;

export type KpiTone = keyof typeof TONE_VALUE_CLASS;

interface KpiProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: KpiTone;
}

export function Kpi({ label, value, hint, tone = 'default' }: KpiProps) {
  return (
    <div className="min-w-0 border-l border-border px-3 pt-2 pb-[7px] first:border-l-0">
      <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          'font-data text-xl font-bold leading-[1.2] tracking-[-0.02em]',
          TONE_VALUE_CLASS[tone],
        )}
      >
        {value}
      </p>
      {hint && <p className="truncate text-[10px] text-fg-faint">{hint}</p>}
    </div>
  );
}

interface KpiStripProps {
  children: React.ReactNode;
  className?: string;
}

export function KpiStrip({ children, className }: KpiStripProps) {
  return (
    <div
      className={cn(
        'grid auto-cols-fr grid-flow-col overflow-hidden rounded-lg border border-border bg-card',
        className,
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Teste unitário — criar `src/components/ui/__tests__/kpi-strip.test.tsx`:**

```tsx
import { render, screen } from '@testing-library/react';
import { Kpi, KpiStrip } from '../kpi-strip';

describe('KpiStrip', () => {
  it('renderiza label, valor e hint', () => {
    render(
      <KpiStrip>
        <Kpi label="Overbookings abertos" value={2} hint="aguardando decisão" tone="alert" />
      </KpiStrip>,
    );
    expect(screen.getByText('Overbookings abertos')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('aguardando decisão')).toBeInTheDocument();
  });

  it('aplica tom de alerta no valor', () => {
    render(
      <KpiStrip>
        <Kpi label="X" value={1} tone="danger" />
      </KpiStrip>,
    );
    expect(screen.getByText('1')).toHaveClass('text-danger-fg');
  });
});
```

- [ ] **Step 3: Rodar o teste**

Run: `cd app/frontend && npm run test -- kpi-strip`
Expected: 2 PASS

- [ ] **Step 4: Commit**

```bash
git add app/frontend/src/components/ui/kpi-strip.tsx app/frontend/src/components/ui/__tests__/kpi-strip.test.tsx
git commit -m "feat(ds3): KpiStrip denso (estilo B aprovado) com testes"
```

---

### Tarefa 9: Table v3 (densa)

**Files:**
- Modify: `app/frontend/src/components/ui/table.tsx` (substituição integral)

**Interfaces:**
- Produces: mesma API exportada (`Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption`) + novos helpers `TableCellNum` e `TableCellCode`. Medidas: head h-[30px] sticky uppercase 11px; célula h-9 (36px) py-0.5 px-2.5 12px; footer h-8 font-data.

- [ ] **Step 1: Substituir `src/components/ui/table.tsx` por:**

```tsx
"use client";

import * as React from "react";

import { cn } from "./utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-xs", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b [&_tr]:border-border", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-border-strong bg-surface-2 font-data text-[11px] font-bold [&>tr]:last:border-b-0 [&_td]:h-8",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border transition-colors duration-100 hover:bg-surface-2 data-[state=selected]:bg-primary-soft",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "sticky top-0 z-10 h-[30px] whitespace-nowrap bg-surface-2 px-2.5 text-left align-middle text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "h-9 whitespace-nowrap px-2.5 py-0.5 align-middle [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

/** Célula numérica: alinhada à direita, mono tabular. */
function TableCellNum({ className, ...props }: React.ComponentProps<"td">) {
  return <TableCell className={cn("text-right font-data", className)} {...props} />;
}

/** Célula de código (UUID curto, ROM-*, placas): mono 11px rebaixado. */
function TableCellCode({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <TableCell
      className={cn("font-data text-[11px] text-fg-secondary", className)}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCellNum,
  TableCellCode,
  TableCaption,
};
```

- [ ] **Step 2: Verificar**

Run: `cd app/frontend && npm run type-check && npm run test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/frontend/src/components/ui/table.tsx
git commit -m "feat(ds3): Table densa (36px) com TableCellNum/TableCellCode"
```

---

### Tarefa 10: Card v3 + PageHeader

**Files:**
- Modify: `app/frontend/src/components/ui/card.tsx` (substituição integral)
- Create: `app/frontend/src/components/ui/page-header.tsx`

**Interfaces:**
- Produces:
  - `Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction` (API shadcn preservada). Card: `rounded-lg border shadow-1`; CardHeader compacto `h-[38px] border-b px-3`; CardTitle 13px/700; CardContent `p-3` (+ `p-0` via className para tabelas flush).
  - `PageHeader({ title, subtitle?, live?, children? })` — linha única `mb-3`: h1 18px/700 tracking -0.015em; subtítulo 12px muted; `live` renderiza o dot verde pulsante "tempo real"; `children` = ações à direita (`ml-auto flex items-center gap-2`).

- [ ] **Step 1: Substituir `src/components/ui/card.tsx` por:**

```tsx
import * as React from "react";

import { cn } from "./utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col rounded-lg border border-border bg-card text-card-foreground shadow-1",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex h-[38px] shrink-0 items-center gap-2 border-b border-border px-3",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-[13px] font-bold leading-none", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("ml-auto flex items-center gap-2", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-content" className={cn("p-3", className)} {...props} />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 border-t border-border px-3 py-2", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
```

- [ ] **Step 2: Criar `src/components/ui/page-header.tsx`:**

```tsx
import * as React from 'react';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Exibe o indicador verde pulsante "tempo real". */
  live?: boolean;
  className?: string;
  /** Ações à direita (botões, selects, badges de dispositivo). */
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, live, className, children }: PageHeaderProps) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <h1 className="text-lg font-bold tracking-[-0.015em] text-foreground">{title}</h1>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      {live && (
        <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold text-success-fg">
          <span
            aria-hidden="true"
            className="size-1.5 animate-pulse rounded-full bg-success"
          />
          tempo real
        </span>
      )}
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `cd app/frontend && npm run type-check && npm run test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/frontend/src/components/ui/card.tsx app/frontend/src/components/ui/page-header.tsx
git commit -m "feat(ds3): Card compacto (header 38px) + PageHeader de linha única"
```

---

### Tarefa 11: DatePickerField (datepicker do DS)

**Files:**
- Create: `app/frontend/src/components/ui/date-picker-field.tsx`
- Modify: `app/frontend/src/components/ui/calendar.tsx` (substituição integral — hoje está morto)

**Interfaces:**
- Consumes: `react-day-picker@8.10.1` e `date-fns@3.6.0` (já instalados), `Popover` (radix, já instalado), `Button`.
- Produces: `DatePickerField({ value, onChange, id?, disabled?, className?, 'aria-invalid'?: boolean })` onde `value: string` no formato ISO `yyyy-MM-dd` (mesmo contrato do `<input type="date">` que substitui — o `onChange` recebe a string ISO nova). Exibição sempre `dd/MM/yyyy` em `font-data`. Rodapé com atalhos **Hoje**, **Ontem**, **Limpar** (Limpar chama `onChange('')`).

- [ ] **Step 1: Substituir `src/components/ui/calendar.tsx` por:**

```tsx
"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";

import { cn } from "./utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      className={cn("p-2.5", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-2",
        caption: "relative flex h-7 items-center justify-center",
        caption_label: "text-[13px] font-bold",
        nav: "flex items-center",
        nav_button:
          "absolute inline-flex size-7 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-surface-3 hover:text-foreground",
        nav_button_previous: "left-0",
        nav_button_next: "right-0",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell:
          "w-8 pb-1 text-center text-[10px] font-bold uppercase text-fg-faint",
        row: "mt-0.5 flex",
        cell: "p-0",
        day: cn(
          "size-8 rounded-md font-data text-xs text-foreground transition-colors",
          "hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35",
        ),
        day_selected:
          "bg-primary font-bold text-primary-foreground hover:bg-primary-hover",
        day_today: "font-bold text-primary-fg shadow-[inset_0_0_0_1px_var(--color-primary)]",
        day_outside: "text-fg-faint",
        day_disabled: "text-fg-faint opacity-50",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="size-4" />,
        IconRight: () => <ChevronRight className="size-4" />,
      }}
      {...props}
    />
  );
}

export { Calendar };
```

- [ ] **Step 2: Criar `src/components/ui/date-picker-field.tsx`:**

```tsx
"use client";

import * as React from "react";
import { format, parse, subDays } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "./utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DatePickerFieldProps {
  /** Valor ISO `yyyy-MM-dd` (contrato idêntico ao <input type="date">). Vazio = sem data. */
  value: string;
  onChange: (isoDate: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
}

function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function DatePickerField({
  value,
  onChange,
  id,
  disabled,
  className,
  ...aria
}: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false);
  const selected = isoToDate(value);

  const pick = (d: Date | undefined) => {
    onChange(d ? format(d, "yyyy-MM-dd") : "");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          data-slot="date-picker-trigger"
          className={cn(
            "flex h-8 w-[150px] items-center gap-2 rounded-md border border-input bg-card px-2.5 text-[13px] transition-[border-color,box-shadow] duration-100 outline-none",
            "hover:not-disabled:border-fg-faint",
            "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/35",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted-foreground",
            "aria-invalid:border-destructive",
            className,
          )}
          {...aria}
        >
          <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn("font-data", !selected && "text-fg-faint")}>
            {selected ? format(selected, "dd/MM/yyyy") : "dd/mm/aaaa"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar mode="single" selected={selected} onSelect={pick} defaultMonth={selected} />
        <div className="flex gap-1.5 border-t border-border p-2">
          <Button variant="ghost" size="sm" type="button" onClick={() => pick(new Date())}>
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => pick(subDays(new Date(), 1))}
          >
            Ontem
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="ml-auto"
            onClick={() => pick(undefined)}
          >
            Limpar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 3: Teste unitário — criar `src/components/ui/__tests__/date-picker-field.test.tsx`:**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { DatePickerField } from '../date-picker-field';

describe('DatePickerField', () => {
  it('exibe a data ISO em dd/MM/yyyy', () => {
    render(<DatePickerField value="2026-08-05" onChange={() => {}} aria-label="Data operacional" />);
    expect(screen.getByText('05/08/2026')).toBeInTheDocument();
  });

  it('exibe placeholder quando vazio', () => {
    render(<DatePickerField value="" onChange={() => {}} aria-label="Data" />);
    expect(screen.getByText('dd/mm/aaaa')).toBeInTheDocument();
  });

  it('atalho Hoje devolve ISO de hoje', () => {
    const onChange = jest.fn();
    render(<DatePickerField value="" onChange={onChange} aria-label="Data" />);
    fireEvent.click(screen.getByRole('button', { name: 'Data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });
});
```

- [ ] **Step 4: Rodar os testes**

Run: `cd app/frontend && npm run test -- date-picker-field`
Expected: 3 PASS

- [ ] **Step 5: Commit**

```bash
git add app/frontend/src/components/ui/calendar.tsx app/frontend/src/components/ui/date-picker-field.tsx app/frontend/src/components/ui/__tests__/date-picker-field.test.tsx
git commit -m "feat(ds3): DatePickerField do DS (dd/mm/aaaa, atalhos Hoje/Ontem) + Calendar v3"
```

---

### Tarefa 12: ComboboxField (busca com lista)

**Files:**
- Create: `app/frontend/src/components/ui/combobox-field.tsx`

**Interfaces:**
- Consumes: `cmdk@1.1.1` via `command.tsx` (já instalado), `Popover`.
- Produces: `ComboboxField<T extends { id: string; label: string; sublabel?: string }>({ items, value, onChange, placeholder, searchPlaceholder, emptyText, id?, disabled?, className? })` — trigger h-8 com chevron; popover com input de busca; opção selecionada com fundo `primary-soft`; `sublabel` (ex.: código CLI-016) à direita em `font-data` 11px.

- [ ] **Step 1: Criar `src/components/ui/combobox-field.tsx`:**

```tsx
"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "./utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface ComboboxItem {
  id: string;
  label: string;
  sublabel?: string;
}

interface ComboboxFieldProps {
  items: ComboboxItem[];
  /** id do item selecionado; '' = nenhum. */
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function ComboboxField({
  items,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  id,
  disabled,
  className,
}: ComboboxFieldProps) {
  const [open, setOpen] = React.useState(false);
  const selected = items.find((i) => i.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          data-slot="combobox-trigger"
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-md border border-input bg-card px-2.5 text-[13px] transition-[border-color,box-shadow] duration-100 outline-none",
            "hover:not-disabled:border-fg-faint",
            "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/35",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted-foreground",
            className,
          )}
        >
          <span className={cn("flex-1 truncate text-left", !selected && "text-fg-faint")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-fg-faint" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-8 text-[13px]" />
          <CommandList className="max-h-56">
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
              {emptyText}
            </CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.sublabel ?? ""}`}
                  onSelect={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "gap-2 text-[13px]",
                    item.id === value && "bg-primary-soft font-semibold text-primary-fg",
                  )}
                >
                  <Check
                    className={cn("size-3.5", item.id === value ? "opacity-100" : "opacity-0")}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.sublabel && (
                    <span className="font-data text-[11px] text-muted-foreground">
                      {item.sublabel}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `cd app/frontend && npm run type-check && npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/frontend/src/components/ui/combobox-field.tsx
git commit -m "feat(ds3): ComboboxField (busca + sublabel de código)"
```

---

### Tarefa 13: Badges auxiliares (Provisório, contagem, dispositivo, chip de filtro)

**Files:**
- Modify: `app/frontend/src/components/ui/badge-provisorio.tsx` (substituição integral)
- Create: `app/frontend/src/components/ui/badge-count.tsx`
- Create: `app/frontend/src/components/ui/device-badge.tsx`
- Create: `app/frontend/src/components/ui/filter-chip.tsx`

**Interfaces:**
- Produces:
  - `BadgeProvisorio({ codigo?: string })` → `⚠ Provisório` ou `⚠ Provisório · P11`; h-[18px], 10px/700, âmbar.
  - `BadgeCount({ children })` → contagem cinza `font-data` h-[18px].
  - `DeviceBadge({ label, online })` → pill 22px verde/vermelho com dot (Balança/Impressora/Leitor).
  - `FilterChip({ active, onClick, children })` → chip toggle h-7.

- [ ] **Step 1: Substituir `src/components/ui/badge-provisorio.tsx` por:**

```tsx
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface BadgeProvisorioProps {
  codigo?: string;
  className?: string;
}

/** Badge "Provisório" — pendências v1.1 §16. Remoção exige AD-xx (Princípio VIII). */
export function BadgeProvisorio({ codigo, className }: BadgeProvisorioProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[18px] items-center gap-1 whitespace-nowrap rounded px-1.5 text-[10px] font-bold tracking-[0.03em]',
        'border border-provisorio-border bg-provisorio-bg text-provisorio-text',
        className,
      )}
    >
      <AlertTriangle className="size-2.5" aria-hidden="true" />
      Provisório{codigo ? ` · ${codigo}` : ''}
    </span>
  );
}
```

- [ ] **Step 2: Criar `src/components/ui/badge-count.tsx`:**

```tsx
import { cn } from '@/lib/cn';

interface BadgeCountProps {
  children: React.ReactNode;
  className?: string;
}

export function BadgeCount({ children, className }: BadgeCountProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[18px] items-center rounded-full bg-surface-3 px-1.5 font-data text-[10px] font-bold text-fg-secondary',
        className,
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Criar `src/components/ui/device-badge.tsx`:**

```tsx
import { cn } from '@/lib/cn';

interface DeviceBadgeProps {
  label: string;
  online: boolean;
  className?: string;
}

/** Status de dispositivo (balança/impressora/leitor). */
export function DeviceBadge({ label, online, className }: DeviceBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-full border px-2 text-[11px] font-semibold',
        online
          ? 'border-success-soft-border bg-success-soft text-success-fg'
          : 'border-danger-soft-border bg-danger-soft text-danger-fg',
        className,
      )}
    >
      <span className="size-[5px] rounded-full bg-current" aria-hidden="true" />
      {label}: {online ? 'disponível' : 'offline'}
    </span>
  );
}
```

- [ ] **Step 4: Criar `src/components/ui/filter-chip.tsx`:**

```tsx
'use client';

import { cn } from '@/lib/cn';

interface FilterChipProps extends React.ComponentProps<'button'> {
  active?: boolean;
}

export function FilterChip({ active, className, children, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium transition-colors duration-100 outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring/35',
        active
          ? 'border-primary-soft-border bg-primary-soft font-semibold text-primary-fg'
          : 'border-border-strong bg-card text-foreground hover:border-fg-faint hover:bg-surface-2',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 5: Verificar e commitar**

Run: `cd app/frontend && npm run type-check && npm run lint && npm run test`
Expected: PASS

```bash
git add app/frontend/src/components/ui/badge-provisorio.tsx app/frontend/src/components/ui/badge-count.tsx app/frontend/src/components/ui/device-badge.tsx app/frontend/src/components/ui/filter-chip.tsx
git commit -m "feat(ds3): badges auxiliares (Provisorio/Count/Device/FilterChip)"
```

---

### Tarefa 14: Tabs, Dialog, Switch — ajuste de medidas

**Files:**
- Modify: `app/frontend/src/components/ui/tabs.tsx`
- Modify: `app/frontend/src/components/ui/dialog.tsx`
- Modify: `app/frontend/src/components/ui/switch.tsx`

Estes três arquivos são shadcn/radix: NÃO reescrever a lógica, apenas substituir as strings de classe indicadas.

- [ ] **Step 1: `tabs.tsx` — localizar o componente `TabsList` e substituir sua string de classes por:**

```
"inline-flex items-end gap-0.5 border-b border-border bg-transparent p-0"
```

E no `TabsTrigger`, substituir a string de classes por:

```
"-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-[7px] text-[13px] font-medium text-muted-foreground transition-colors duration-100 outline-none hover:text-foreground focus-visible:rounded focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-primary-fg"
```

(Manter quaisquer `data-slot` e props existentes; apenas o `className` base muda. Se o arquivo tiver variantes de estilo "pill" com bg-muted, elas são removidas — o DS v3 usa apenas tabs sublinhadas.)

- [ ] **Step 2: `dialog.tsx` — no `DialogContent`, garantir que a classe contenha `rounded-[10px] shadow-3 sm:max-w-[480px]` (substituindo `rounded-lg`/`shadow-lg`/max-w antigos); no `DialogHeader`, `px-4 pt-3.5`; no `DialogFooter`, `gap-2 px-4 pb-4`.**

- [ ] **Step 3: `switch.tsx` — substituir as classes dimensionais do root para track 34×19px e thumb 15px:**

Root: trocar `h-[1.15rem] w-8` (ou equivalente atual) por `h-[19px] w-[34px]`; estado checked `data-[state=checked]:bg-success` (verde, não primary). Thumb: `size-[15px]` e translação `data-[state=checked]:translate-x-[15px]`.

- [ ] **Step 4: Verificar**

Run: `cd app/frontend && npm run type-check && npm run test && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/frontend/src/components/ui/tabs.tsx app/frontend/src/components/ui/dialog.tsx app/frontend/src/components/ui/switch.tsx
git commit -m "feat(ds3): Tabs sublinhadas, Dialog 10px/shadow-3, Switch 34x19 verde"
```

---

### Tarefa 15: EmptyState + itens de lista lateral (AlertItem/ActivityItem v3)

**Files:**
- Create: `app/frontend/src/components/ui/empty-state.tsx`
- Modify: `app/frontend/src/components/ui/alert-item.tsx` (substituição integral)
- Modify: `app/frontend/src/components/ui/activity-item.tsx` (substituição integral)

**Interfaces:**
- Produces:
  - `EmptyState({ icon?, title, description?, action?, className? })` — bloco central com borda tracejada.
  - `AlertItem({ title, description, time, variant })` — variant `'warning' | 'info' | 'danger' | 'violet'` (manter o union atual de `alert-item.tsx` se diferente — conferir e preservar); linha com dot colorido 7px, título 12px/600, hora `font-data` 10px à direita, descrição 11px muted.
  - `ActivityItem({ userName, initials, activity, time })` — mesma linha compacta com dot cinza.

- [ ] **Step 1: Criar `src/components/ui/empty-state.tsx`:**

```tsx
import * as React from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'grid place-items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-4 py-7 text-center',
        className,
      )}
    >
      {icon && <span className="text-fg-faint [&_svg]:size-6" aria-hidden="true">{icon}</span>}
      <p className="text-[13px] font-semibold text-fg-secondary">{title}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 2: ANTES de substituir `alert-item.tsx` e `activity-item.tsx`, abrir os arquivos atuais e anotar as props exatas exportadas.** Reescrever mantendo a MESMA interface de props (os call-sites no dashboard não mudam nesta tarefa), aplicando o layout novo:

`alert-item.tsx` — corpo do componente (adaptar apenas nomes de props ao que existir):

```tsx
import { cn } from '@/lib/cn';

const DOT_COLOR: Record<string, string> = {
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-status-recebido-dot',
  violet: 'bg-status-pesado-dot',
};

// Props: manter a assinatura atual do arquivo (title, description, time, variant, Icon?).
// Icon deixa de ser renderizado (dot colorido assume a semântica); manter na assinatura
// para não quebrar call-sites até a migração das telas.
export function AlertItem({ title, description, time, variant }: AlertItemProps) {
  return (
    <div className="flex gap-2 border-b border-border px-3 py-2 last:border-b-0">
      <span
        aria-hidden="true"
        className={cn('mt-[5px] size-[7px] shrink-0 rounded-full', DOT_COLOR[variant] ?? DOT_COLOR.info)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <time className="ml-auto font-data text-[10px] text-fg-faint">{time}</time>
        </div>
        <p className="text-[11px] leading-[1.4] text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
```

`activity-item.tsx` — mesmo padrão:

```tsx
export function ActivityItem({ userName, initials, activity, time }: ActivityItemProps) {
  return (
    <div className="flex gap-2 border-b border-border px-3 py-2 last:border-b-0">
      <span aria-hidden="true" className="mt-[5px] size-[7px] shrink-0 rounded-full bg-status-pendente-dot" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-xs font-semibold text-foreground">{userName}</p>
          <time className="ml-auto font-data text-[10px] text-fg-faint">{time}</time>
        </div>
        <p className="text-[11px] leading-[1.4] text-muted-foreground">{activity}</p>
      </div>
    </div>
  );
}
```

(`initials` sai da render — sem avatar circular no v3 — mas permanece na assinatura.)

- [ ] **Step 3: Verificar e commitar**

Run: `cd app/frontend && npm run type-check && npm run test`
Expected: PASS

```bash
git add app/frontend/src/components/ui/empty-state.tsx app/frontend/src/components/ui/alert-item.tsx app/frontend/src/components/ui/activity-item.tsx
git commit -m "feat(ds3): EmptyState + AlertItem/ActivityItem compactos"
```

---

## PARTE 3 — SHELL

### Tarefa 16: Sidebar v3

**Files:**
- Modify: `app/frontend/src/components/ui/app-sidebar.tsx`
- Modify: `app/frontend/src/components/ui/nav-group.tsx`
- Modify: `app/frontend/src/components/ui/nav-item.tsx`

Medidas exatas (protótipo `direcao-a/dashboard.html`): largura 232px; brand 14px 16px 12px com logo 30px; grupos com label 10px/700/tracking 0.12em; item h-[30px] px-2.5 rounded-[5px] ícone 15px texto 13px/500; item ativo `bg-sidebar-item-active text-white font-semibold`; usuário no rodapé com borda superior.

- [ ] **Step 1: Em `app-sidebar.tsx`, substituir APENAS o JSX do return (imports, tipos, ICON_MAP e lógica intactos):**

```tsx
  return (
    <aside
      aria-label="Navegação principal"
      className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col overflow-y-auto bg-gradient-to-b from-sidebar-gradient-start to-sidebar-gradient-end"
    >
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-3.5">
        <AlphaLogo className="h-[30px] w-[30px] shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight text-white">AlphaCarnes</p>
          <p className="mt-0.5 text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-sidebar-text-muted">
            Distribuição de Carnes
          </p>
        </div>
      </div>

      <nav className="flex w-full flex-1 flex-col overflow-y-auto px-2 pb-4">
        {sections.length === 0 ? (
          <p className="px-2 text-xs leading-relaxed text-sidebar-text-muted">
            Nenhum módulo liberado para o seu perfil. Solicite acesso ao administrador.
          </p>
        ) : (
          sections.map((section) => (
            <NavGroup
              key={section.title}
              title={section.title}
              defaultOpen={sections.length <= 3}
              items={section.items.map((item) => ({
                href: item.href,
                label: item.label,
                Icon: ICON_MAP[item.iconKey] ?? LayoutDashboard,
              }))}
            />
          ))
        )}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-white/18 text-[11px] font-bold text-white"
            aria-hidden="true"
          >
            {user.inicial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold leading-tight text-white">{user.nome}</p>
            <p className="mt-0.5 truncate text-[10px] leading-tight text-sidebar-text-muted">
              {user.perfil}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
```

- [ ] **Step 2: Em `nav-group.tsx`:**
  - Trocar a constante de altura: `const alturaItens = items.length * 32 + 4;` (item 30px + gap 2px).
  - No `<button>` do cabeçalho do grupo, substituir a string de classes por:
    `"group/hdr mb-1 mt-2.5 flex w-full items-center justify-between rounded-[5px] px-2.5 py-[5px] text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-text-dim transition-colors hover:text-white"`
  - No wrapper interno dos itens, trocar `gap-0.5 pb-1` por `gap-[2px] pb-0.5`.

- [ ] **Step 3: Em `nav-item.tsx`, substituir a string de classes do `<Link>` por:**

```
'flex h-[30px] w-full items-center gap-2 rounded-[5px] px-2.5 text-[13px] font-medium transition-colors duration-100',
isActive
  ? 'bg-sidebar-item-active font-semibold text-white'
  : 'text-sidebar-text-dim hover:bg-sidebar-item-hover hover:text-white',
```

E o ícone: `<Icon size={15} strokeWidth={1.75} className="shrink-0 opacity-85" />`.

- [ ] **Step 4: Verificar**

Run: `cd app/frontend && npm run type-check && npm run test`
Expected: PASS. Abrir `http://localhost:4000/gestao/dashboard` e comparar a sidebar com `docs/ds-preview/direcao-a/dashboard.html` lado a lado — largura, alturas e cores idênticas.

- [ ] **Step 5: Commit**

```bash
git add app/frontend/src/components/ui/app-sidebar.tsx app/frontend/src/components/ui/nav-group.tsx app/frontend/src/components/ui/nav-item.tsx
git commit -m "feat(ds3): sidebar densa 232px (itens 30px, grupos 10px)"
```

---

### Tarefa 17: Topbar (AdminHeader v3)

**Files:**
- Modify: `app/frontend/src/components/ui/admin-header.tsx`

Medidas exatas: h-11 (44px); breadcrumb 12px (grupo muted / página 600 foreground, separador `/`); metadados 12px com `label: valor`; data em `font-data` 11px; sino como Button ghost iconSm; avatar 28px circular primary.

- [ ] **Step 1: Substituir o JSX do return do componente `AdminHeader` (lógica e helpers intactos):**

```tsx
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-11 shrink-0 items-center justify-between border-b border-border bg-card px-5',
        className,
      )}
    >
      <nav aria-label="Breadcrumb" className="min-w-0">
        {breadcrumb ? (
          <p className="truncate text-xs">
            <span className="text-muted-foreground">{formatMenuGroupTitle(breadcrumb.group)}</span>
            <span className="mx-1.5 text-fg-faint">/</span>
            <span className="font-semibold text-foreground">{breadcrumb.item}</span>
          </p>
        ) : (
          <span className="text-xs font-semibold text-foreground">AlphaCarnes</span>
        )}
      </nav>

      <div className="flex shrink-0 items-center gap-3.5">
        <div className="hidden items-center gap-3.5 text-xs text-muted-foreground sm:flex">
          <MetaInline label="Usuário" value={user.nome} />
          <MetaInline label="Perfil" value={user.perfil} />
          <MetaInline label="Escopo" value={escopo.valor} title={escopo.title} />
        </div>

        <span className="hidden font-data text-[11px] text-muted-foreground lg:inline">
          {formatDate()}
        </span>

        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
          aria-label="Notificações"
        >
          <Bell size={15} strokeWidth={1.75} />
        </button>

        <div
          className="flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white"
          aria-hidden="true"
        >
          {user.inicial}
        </div>
      </div>
    </header>
  );
```

(Os separadores `·` entre MetaInline saem — o gap de 14px separa.)

- [ ] **Step 2: Verificar e commitar**

Run: `cd app/frontend && npm run type-check && npm run test`
Expected: PASS

```bash
git add app/frontend/src/components/ui/admin-header.tsx
git commit -m "feat(ds3): topbar 44px compacta"
```

---

## TAREFA 0 — Registro de decisão AD-07 (executar ANTES de qualquer outra)

**Files:**
- Modify: `docs/execucao/DECISOES.md` (append ao final)

- [ ] **Step 1: Adicionar ao final de `docs/execucao/DECISOES.md`:**

```markdown
## AD-07 — Design System v3 substitui a fidelidade ao protótipo v1.1 (2026-08-05)

**Decisão:** o cliente aprovou o DS v3 — Direção A "Evolução" com o KPI strip da
Direção B — prototipado em `docs/ds-preview/direcao-a/` (hub `docs/ds-preview/index.html`).
A partir desta onda, a referência visual canônica das telas é o protótipo DS v3 + a spec
`docs/superpowers/plans/2026-08-05-onda-ds-v3-implementacao.md`, e não mais o protótipo
`F:\Projetos\alpha-carnes-prototipo` (Princípio I da constituição fica satisfeito pela
fidelidade ao DS v3). Fluxos, textos funcionais, regras de negócio e contratos permanecem
os do protótipo v1.1/spec funcional — a mudança é exclusivamente visual (tokens,
componentes, densidade, tipografia com JetBrains Mono para dados).

**Motivação:** densidade operacional (10 KPIs + 16 linhas de pedido em um viewport HD),
alinhamento de colunas numéricas (mono tabular), vocabulário completo de estados,
datepicker/combobox próprios, eliminação de 19+ reimplementações ad-hoc de badge.
```

- [ ] **Step 2: Commit**

```bash
git add docs/execucao/DECISOES.md
git commit -m "docs(execucao): AD-07 — DS v3 aprovado como referência visual canônica"
```

---

## PARTE 4 — TELAS (43 rotas)

### R — RECEITAS CANÔNICAS (contexto obrigatório de TODA tarefa da Parte 4)

O executor de qualquer tarefa da Parte 4 DEVE ler esta seção antes de começar. As receitas são a definição exata; as tarefas por tela indicam qual receita aplicar a cada elemento e listam somente o que é específico da tela. Onde a tarefa diz "R2", o código da receita é copiado e preenchido com os dados da tela — sem variação de classes, alturas ou espaçamentos.

#### R1 — Esqueleto de página

Toda página (exceto login e Modo TV) tem esta estrutura exata:

```tsx
<div className="space-y-3">
  <PageHeader title="<TÍTULO>" subtitle="<SUBTÍTULO>" live={/* só se a tela tem indicador tempo real */}>
    {/* ações do header, na ordem: filtros globais (SeletorOperacao/DatePickerField) → badges (DeviceBadge/BadgeCount) → botões secundários → botão primário */}
  </PageHeader>
  {/* blocos da tela, cada um Card ou KpiStrip, separados pelo space-y-3 do wrapper */}
</div>
```

Regras fixas:
- Breadcrumbs manuais dentro da página (ex.: `<p>Cadastros & Regras / Produtos</p>`) são REMOVIDOS — o breadcrumb já existe na topbar.
- `space-y-6`/`space-y-5`/`space-y-4` de página viram `space-y-3`. `gap-4` entre cards vira `gap-2.5`.
- h1 nunca leva classe própria na tela — sempre via `PageHeader`.
- Import: `import { PageHeader } from '@/components/ui/page-header';`

#### R2 — Card de tabela (lista+tabela)

```tsx
<Card>
  <CardHeader>
    <CardTitle><TÍTULO DO BLOCO></CardTitle>
    <BadgeCount>{itens.length}</BadgeCount>
    <CardAction>
      {/* filtros da tabela — ver R6 */}
    </CardAction>
  </CardHeader>
  <CardContent className="p-0">
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>…</TableHead>
          {/* colunas numéricas: <TableHead className="text-right">…</TableHead> */}
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow key={…}>
          <TableCellCode>{codigo}</TableCellCode>          {/* códigos/UUID curto */}
          <TableCell className="text-[13px] font-semibold text-foreground">{nomePrincipal}</TableCell>
          <TableCell className="text-muted-foreground">{secundario}</TableCell>
          <TableCellNum>{numero}</TableCellNum>
          <TableCell><StatusPill variant={…} label={…} /></TableCell>
          <TableCell>
            <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {/* ações: Button variant="ghost" size="sm" (texto) ou size="iconSm" (ícone) */}
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
      {/* opcional: <TableFooter> com totais em TableCellNum */}
    </Table>
  </CardContent>
</Card>
```

Regras fixas:
- Linha com ações no hover recebe `className="group"` no `TableRow`.
- UUID exibido: sempre `id.slice(0, 8).toUpperCase()` em `TableCellCode`.
- Datas em coluna: `dd/MM` (mesma operação) ou `dd/MM/yyyy`, em `TableCellNum` (mono, à direita).
- Pesos: `formatKg` existente da tela, célula `TableCellNum`, header `Peso (kg)`.
- Nunca `<table>` cru — sempre os componentes da Tarefa 9.

#### R3 — Master-detail

```tsx
<div className="grid items-start gap-2.5 lg:grid-cols-[320px_1fr]">
  {/* MASTER */}
  <Card>
    <CardContent className="flex gap-1.5 p-2.5 pb-1.5">
      <Input adornLeft={<Search />} placeholder="<PLACEHOLDER DA TELA>" className="h-7 text-xs" />
      {/* filtro adicional: <SelectNative selectSize="sm" className="w-[110px]">…</SelectNative> */}
    </CardContent>
    <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
      {itens.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={…}
          className={cn(
            'block w-full border-b border-border px-3 py-2 text-left transition-colors duration-100 hover:bg-surface-2',
            selecionado && 'bg-primary-soft shadow-[inset_2px_0_0_var(--color-primary)]',
          )}
        >
          <span className="flex items-center gap-2">
            <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">{item.nome}</b>
            <StatusPill variant={…} className="h-[17px] text-[10px]" label={…} />
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {item.linha2} · <span className="font-data">{item.codigo}</span>
          </span>
        </button>
      ))}
    </div>
  </Card>
  {/* DETAIL */}
  <Card>{/* conteúdo específico da tela */}</Card>
</div>
```

- Detail vazio: R9 dentro de `<CardContent>`.
- Cabeçalho do detail (quando a tela tem título+ações): `<CardContent className="flex items-center gap-3 border-b border-border p-3">` com avatar quadrado 36px `rounded-lg bg-primary-soft text-primary-fg` (iniciais), título 16px/700 + sub 12px muted, ações à direita.

#### R4 — Formulário denso

```tsx
<div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
  <FormField label="<LABEL>" required htmlFor="<id>">
    <Input id="<id>" … />
  </FormField>
  <FormField label="<LABEL>" help="<AJUDA>" htmlFor="<id>">
    <SelectNative id="<id>" …>…</SelectNative>
  </FormField>
  {/* campo largo: <FormField className="sm:col-span-2" …><Textarea …/></FormField> */}
</div>
```

Regras fixas:
- TODO bloco `<Label>`+controle existente vira `FormField` (erro do react-hook-form entra na prop `error`, help na prop `help`).
- `<input type="date">` → `DatePickerField` (contrato ISO idêntico — trocar `e.target.value` por argumento direto).
- `<select>` cru → `SelectNative` (default) ou `SelectNative selectSize="sm"` (em filtros).
- Busca-e-escolhe de entidade (cliente, produto, pedido de compra) → `ComboboxField` com `sublabel` = código.
- Campos monetários: `<Input adornLeft={<span className="text-xs">R$</span>} inputMode="decimal" className="text-right font-data" />`.
- Campos de peso/quantidade com unidade: `<Input adornRight="kg" inputMode="decimal" />` (adornRight já alinha à direita em mono).

#### R5 — KPIs (migração KpiCard → KpiStrip)

```tsx
<KpiStrip>
  <Kpi label="<RÓTULO>" value={<valor>} hint="<detalhe>" tone="<tone>" />
  …
</KpiStrip>
```

Mapeamento de tom (determinístico, por semântica do KPI):
- Contagens neutras (totais, em andamento) → `tone="default"`.
- Concluído/pronto/autorizado/finalizado/confirmado → `tone="ok"`.
- Pendência que espera decisão/dados (overbooking aberto, divergência, SIF pendente, em análise, rascunho não é alerta → default) → `tone="alert"`.
- Falha/erro/bloqueio/faturamento pendente de NFS-e/cancelado → `tone="danger"`.
- Loading: `value="…"` (string), tone default.
- Duas linhas de 5 KPIs = dois `<KpiStrip>` irmãos dentro de `<div className="space-y-2">`.
- Ícones dos antigos KpiCard são DESCARTADOS.

#### R6 — Filtros de listagem

Ordem fixa dentro de `CardAction` (ou linha própria quando a tela filtra o page inteiro): chips → busca → selects → datepicker → botão limpar.

```tsx
<FilterChip active={f} onClick={…}>Somente ativos</FilterChip>
<div className="w-[240px]">
  <Input adornLeft={<Search />} placeholder="<PLACEHOLDER EXATO DA TELA>" className="h-7 text-xs" />
</div>
<SelectNative selectSize="sm" className="w-[150px]" value={…} onChange={…}>
  <option value="">Todos os status</option>
  …
</SelectNative>
<Button variant="ghost" size="sm" onClick={…}>Limpar filtros</Button>
```

`Search` = `lucide-react`. Placeholders NÃO mudam de texto (preservar os existentes, ex.: "Buscar lote, PC, fornecedor, NF…").

#### R7 — Modal de confirmação/decisão

Estrutura via `Dialog` (Tarefa 14): `DialogContent` já tem 480px/rounded-[10px]/shadow-3. Corpo 13px `text-fg-secondary`. Motivo obrigatório: `FormField label="Motivo" required` + `SelectNative` (opções EXATAS atuais) e/ou `Textarea`. Footer: `Button variant="ghost"` (Cancelar) + ação primária (`default` ou `destructive` conforme a ação atual). Modais custom `div fixed inset-0` (recebimento/etiquetas) são REESCRITOS com `Dialog` mantendo textos e handlers.

#### R8 — Sheet/Drawer

Largura fixa `sm:max-w-[520px]`. Header do sheet: título 16px/700 + descrição 12px muted. Corpo `space-y-3 p-4` com R4 para campos. Footer `gap-2 border-t border-border p-4`.

#### R9 — Empty state

```tsx
<EmptyState
  icon={<ÍconeLucideDaTela />}
  title="<TÍTULO EXATO ATUAL>"
  description="<descrição atual, se houver>"
  action={/* botão/link atual, se houver */}
/>
```

Textos dos empties atuais são PRESERVADOS byte a byte.

#### R10 — Célula/valor: regras de fonte

| Conteúdo | Onde | Classe |
|---|---|---|
| UUID curto, ROM-*, CP-*, ETQ-*, NF, placa, CNPJ, CLI-* | tabela | `TableCellCode` |
| idem, fora de tabela | inline | `font-data text-[11px] text-fg-secondary` |
| kg, R$, contagens em coluna | tabela | `TableCellNum` |
| Peso display (balança) | painel | `font-data text-[44px] font-bold leading-[1.1] tracking-[-0.03em]` |
| Valor de KPI | KpiStrip | (embutido no componente) |
| Hora em lista de alertas/atividades | item | `font-data text-[10px] text-fg-faint` |
| Rótulos, nomes, títulos, textos | qualquer | Inter (nunca `font-data`) |

#### R-teste — Verificação padrão de TODA tarefa de tela

Cada tarefa de tela termina com:
1. `cd app/frontend && npm run lint && npm run type-check && npm run test` → PASS.
2. `docker compose up -d --build frontend` (ou dev server) e abrir a(s) rota(s) migrada(s) logado como `admin@alphacarnes.local` / `change-me-admin-password`.
3. Conferir contra o protótipo de referência (`docs/ds-preview/direcao-a/<tela>.html` quando existir; senão contra as receitas): alturas de linha 36px, controles 32px, KPIs sem ícone/sombra, códigos em mono.
4. Zero erros no console do browser.
5. Commit com a mensagem indicada.

---

### Tarefa 18: Tela — Gestão / Dashboard (`/gestao/dashboard`)

**Files:**
- Modify: `app/frontend/src/app/(admin)/gestao/dashboard/dashboard-client.tsx`
- Modify: `app/frontend/src/lib/gestao.ts` (apenas se `MAPA_KPI_UI` precisar do campo `tone` — ver Step 2)

**Interfaces:**
- Consumes: `KpiStrip/Kpi` (T8), `PageHeader` (T10), `Table*` (T9), `Card*` (T10), `StatusPill` + `rotuloStatusPedido` (T7), `AlertItem/ActivityItem` (T15), `BadgeCount` (T13), `EmptyState` (T15), `SelectNative` (T6 — para o `SeletorOperacao`, ver Tarefa 30).

Referência visual: `docs/ds-preview/direcao-a/dashboard.html`.

- [ ] **Step 1: Header da página** — substituir o bloco `<div className="flex flex-wrap items-start justify-between gap-4">…</div>` (linhas ~152-178) por:

```tsx
<PageHeader
  title="Painel Geral da Operação"
  subtitle="Visão executiva da compra, venda, disponibilidade e operação do dia"
  live={status === 'conectado'}
>
  <SeletorOperacao />
  <Button
    variant="secondary"
    onClick={() => {
      setAtualizando(true);
      void refetch();
    }}
    disabled={atualizando || carregando}
  >
    <RefreshCw className={atualizando ? 'animate-spin' : ''} />
    Atualizar
  </Button>
</PageHeader>
```

(Rótulo do botão muda de "Atualizar dados" → "Atualizar". Remover o botão estilizado inline com `style={{ background: 'var(--color-primary)' }}`. Wrapper da página: `space-y-6` → `space-y-3`.)

- [ ] **Step 2: KPIs** — em `src/lib/gestao.ts`, adicionar ao `MAPA_KPI_UI` de cada chave o campo `tone` com estes valores exatos:

| chave | tone |
|---|---|
| `compras_programadas` | `default` |
| `disponibilidade_total` (ou chave equivalente de disponibilidade) | `default` |
| `reservas_em_elaboracao` | `default` |
| `pedidos_finalizados` | `ok` |
| `overbookings_abertos` | `alert` |
| `recebimentos_aguardados` | `default` |
| `divergencias_abertas` | `alert` |
| `pecas_em_desossa` | `default` |
| `relatorios_sif_pendentes` | `alert` |
| `faturamentos_pendentes` | `danger` |

(Usar as chaves EXATAS de `ORDEM_KPIS`; adicionar `tone: KpiTone` ao type do mapa, importando `KpiTone` de `@/components/ui/kpi-strip`. Os campos `Icon`/`variant`/`destacado` ficam no mapa mas deixam de ser consumidos pelo dashboard.)

Substituir os DOIS grids de KpiCard (linhas ~206-243) por:

```tsx
<div className="space-y-2">
  <KpiStrip>
    {(carregando ? ORDEM_KPIS.slice(0, 5) : linha1).map((kpi) => {
      const chave = typeof kpi === 'string' ? kpi : kpi!.chave;
      const ui = MAPA_KPI_UI[chave] ?? MAPA_KPI_UI.compras_programadas!;
      return (
        <Kpi
          key={chave}
          label={ROTULOS_KPI[chave] ?? chave}
          value={carregando ? '…' : (typeof kpi === 'object' ? kpi!.valor : '—')}
          hint={carregando ? '' : (typeof kpi === 'object' ? kpi!.detalhe : '')}
          tone={ui.tone}
        />
      );
    })}
  </KpiStrip>
  <KpiStrip>
    {(carregando ? ORDEM_KPIS.slice(5, 10) : linha2).map((kpi) => {
      const chave = typeof kpi === 'string' ? kpi : kpi!.chave;
      const ui = MAPA_KPI_UI[chave] ?? MAPA_KPI_UI.recebimentos_aguardados!;
      return (
        <Kpi
          key={chave}
          label={ROTULOS_KPI[chave] ?? chave}
          value={carregando ? '…' : (typeof kpi === 'object' ? kpi!.valor : '—')}
          hint={carregando ? '' : (typeof kpi === 'object' ? kpi!.detalhe : '')}
          tone={ui.tone}
        />
      );
    })}
  </KpiStrip>
</div>
```

- [ ] **Step 3: Grid principal** — trocar `grid grid-cols-1 gap-4 xl:grid-cols-12` por `grid grid-cols-1 items-start gap-2.5 xl:grid-cols-12` e `space-y-4 xl:col-span-4` por `space-y-2.5 xl:col-span-4`.

- [ ] **Step 4: Tabela "Pedidos em andamento"** — substituir o card com `<table>` cru (linhas ~246-302) pela R2 com este preenchimento exato:

- CardTitle: `Pedidos em andamento`; após o título, `<BadgeCount>{dados?.pedidosEmAndamento?.length ?? 0}</BadgeCount>`. Sem CardAction. (O ícone `ClipboardList` do header atual é removido.)
- Colunas, na ordem: `Pedido` | `Cliente` | `Produto / Corte` | `Peso (kg)` (header `className="text-right"`) | `Status` | `Data` (header `className="text-right"`).
- Células por linha: `TableCellCode` com `pedido.pedidoId.slice(0, 8).toUpperCase()`; `TableCell className="text-[13px] font-semibold text-foreground"` com `pedido.clienteNome`; `TableCell className="text-muted-foreground"` com `pedido.produtoResumo`; `TableCellNum` com `pedido.pesoTotalKg ?? '—'` (sem sufixo "kg" — está no header; a função `formatPesoKg` deixa de ser usada e é removida); `TableCell` com `<StatusPill variant={statusPedidoVariant(pedido.status)} label={rotuloStatusPedido(pedido.status)} />` (import de `@/lib/status-ui`; a função local `rotuloStatusPedido` do arquivo é REMOVIDA); `TableCellNum className="font-data text-[11px] text-fg-secondary"` com `formatDataOperacao(pedido.dataOperacao)`.
- Estados carregando/vazio: linha única `<TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground">Carregando pedidos…</TableCell>` / `Nenhum pedido em andamento no momento.`

- [ ] **Step 5: Cards laterais** — "Alertas operacionais" e "Atividades recentes": trocar cada header custom (`flex h-14 …`) por `<CardHeader><CardTitle>Alertas operacionais</CardTitle><BadgeCount>{dados?.alertas?.length ?? 0}</BadgeCount></CardHeader>` (ícones Bell/Truck removidos; Atividades sem BadgeCount). Trocar o wrapper `divide-y divide-border px-5` por `<div>` sem classes (os itens v3 já têm borda própria). Manter os componentes `AlertItem`/`ActivityItem` com as mesmas props atuais.

- [ ] **Step 6: Empty "Nenhuma operação cadastrada"** — substituir o `div rounded-xl…p-8` por R9: `<EmptyState title="Nenhuma operação cadastrada" description="Cadastre ou gere a cadência de operações para visualizar os KPIs." action={<Button variant="secondary" size="sm" asChild><Link href="/gestao/operacoes">Ir para Operações</Link></Button>} />`.

- [ ] **Step 7: R-teste + commit**

Meta de aceite adicional: em 1366×768, as duas faixas de KPI + ≥12 linhas de pedido + card de alertas visíveis sem scroll.

```bash
git add app/frontend/src/app/(admin)/gestao/dashboard/dashboard-client.tsx app/frontend/src/lib/gestao.ts
git commit -m "feat(ds3): dashboard gestão — KpiStrip, tabela densa, page header de linha única"
```

---

### Tarefa 19: Tela — Comercial / Pedidos (`/comercial/pedidos`)

**Files:**
- Modify: `app/frontend/src/app/(admin)/comercial/pedidos/pedidos-client.tsx`
- Modify: `app/frontend/src/app/(admin)/comercial/pedidos/pedido-editor.tsx`
- Modify: `app/frontend/src/app/(admin)/comercial/pedidos/modal-adendo.tsx`
- Modify: `app/frontend/src/app/(admin)/comercial/pedidos/modal-liberar-reserva.tsx`
- Modify: `app/frontend/src/app/(admin)/comercial/pedidos/modal-overbooking.tsx`

Referência visual: `docs/ds-preview/direcao-a/pedidos.html`.

- [ ] **Step 1: Lista (`pedidos-client.tsx`)**
  - R1: `PageHeader title="Pedidos de Venda" subtitle="Acompanhe reservas, overbooking e atendimento comercial"` com ação `<Button><Plus />Novo pedido</Button>`.
  - R5: os 4 KpiCard viram um `KpiStrip` único: `Kpi label="Total de pedidos" hint="na visão atual" tone="default"`, `Kpi label="Rascunhos" hint="com reserva ativa" tone="default"`, `Kpi label="Overbooking" hint="exige atenção" tone="alert"`, `Kpi label="Finalizados" hint="pedidos concluídos" tone="ok"` (valores = os mesmos cálculos atuais).
  - **A lista de `<article>` clicáveis vira R2 (tabela)** dentro de um Card com `CardTitle "Pedidos"` + `BadgeCount` (total filtrado) e `CardAction` com R6: busca (placeholder atual `Buscar pedido ou cliente...`, largura `w-[240px]`) + `SelectNative selectSize="sm" className="w-[170px]"` com as MESMAS opções de status atuais.
  - Colunas: `Pedido` (`TableCellCode`, `id.slice(0,8).toUpperCase()`) | `Cliente` (main-cell 13px/600) | `Representante` (`text-muted-foreground`; `Sem representante` quando vazio) | `Rota` (`TableCellCode`) | `Status` (`StatusPill` com `rotuloStatusPedido`) | ações.
  - Ações por linha (R2, hover): `Button variant="ghost" size="sm"` "Abrir" (mesmo handler do clique do article) e, quando o pedido é rascunho com reserva (mesma condição do botão atual), `Button variant="destructiveOutline" size="sm"` "Liberar reserva" (mesmo handler).
  - `TableRow` recebe também `onClick` de abrir e `className="group cursor-pointer"`.

- [ ] **Step 2: Editor (`pedido-editor.tsx`)**
  - R1: `PageHeader title={pedidoExistente ? 'Editar Pedido' : 'Novo Pedido'} subtitle={/* id do pedido em font-data quando existir */}` — o subtítulo com UUID: `<span className="font-data">{pedido.id}</span>` via prop `subtitle` string simples `Pedido ${pedido.id}` (PageHeader renderiza texto; manter string). Botão voltar: `Button variant="ghost" size="icon"` com `ArrowLeft` antes do título — envolver PageHeader e botão em `<div className="mb-3 flex items-center gap-2">` e usar `PageHeader className="mb-0 flex-1"`.
  - Card "dados do pedido": R4 em grid `sm:grid-cols-2 xl:grid-cols-4` — campos na ordem: `Buscar cliente` (ComboboxField com items dos clientes atuais, `sublabel` = código interno se disponível; disabled se pedido existente — mesmo estado atual), `Operação` (SelectNative, mesmas options), `Representante` (Input readOnly), `Rota` (Input readOnly ou text conforme atual), `Prioridade` (Input type number `className="w-full"`), `Observações` (Textarea, `className="xl:col-span-3"` FormField).
  - Card "Itens do pedido": `CardTitle "Itens do pedido"` + `CardDescription "A reserva é atualizada a cada ação da grade."` na linha do header (CardDescription após o título). Tabela R2: `Produto` | `Origem` | `Quantidade` (célula com `<Input inputMode="numeric" className="h-7 w-24 text-right font-data" …/>`) | ações (`Button variant="secondary" size="sm"` "Aplicar quantidade", `Button variant="ghost" size="iconSm"` com `Trash2`).
  - Linha "adicionar produto" (abaixo da tabela, `CardFooter`): `SelectNative` produto (flex-1) + `Input` quantidade (`className="w-28 text-right font-data"`) + `Button variant="secondary"` `<Plus />Adicionar produto`.
  - Footer da página: `<div className="flex justify-end gap-2">` com `Button variant="ghost"` "Cancelar", `Button variant="secondary"` "Salvar Rascunho" (se existir hoje), `Button` `<Send />Finalizar Pedido`.
  - Timeline: itens via `ActivityItem` (mantém), header do card conforme R2.

- [ ] **Step 3: Modais** — os três seguem R7, mantendo textos/validações/handlers atuais:
  - `modal-overbooking.tsx`: tabela interna vira R2 compacta (colunas `Produto` | `Disponível` | `Solicitado` | `Déficit`, todas as três últimas `TableCellNum`; déficit com `className="text-danger-fg font-bold"`). Botão principal `Button variant="destructive"` "Confirmar overbooking" (confirma criação de pendência — cor de atenção).
  - `modal-adendo.tsx`: `BadgeProvisorio codigo="P5"` (novo componente T13) no header; `FormField label="Motivo" required` + Textarea; `Button` "Registrar adendo".
  - `modal-liberar-reserva.tsx`: `FormField label="Justificativa" required help="Mínimo de 10 caracteres."` + Textarea; `Button variant="destructive"` "Confirmar liberação".

- [ ] **Step 4: R-teste + commit**

```bash
git add "app/frontend/src/app/(admin)/comercial/pedidos/"
git commit -m "feat(ds3): pedidos de venda — lista em tabela densa + editor com FormField/Combobox"
```

---

### Tarefa 20: Tela — Comercial / Clientes (`/comercial/clientes`)

**Files:**
- Modify: `app/frontend/src/app/(admin)/comercial/clientes/clientes-client.tsx`

Referência visual: `docs/ds-preview/direcao-a/clientes.html`.

- [ ] **Step 1:** R1 — `PageHeader title="Cadastro de Clientes" subtitle="Gerenciamento de clientes e preferências operacionais"`; ações: `<BadgeCount className="h-[22px] px-2 text-[11px]">{total} ativos</BadgeCount>` + `<Button><Plus />Novo cliente</Button>` (o botão `+` icônico atual vira este botão com rótulo).
- [ ] **Step 2:** R3 master-detail exato: master 320px com busca `Buscar cliente...` (h-7) + `SelectNative selectSize="sm" className="w-[110px]"` com options `Ativos` (default) / `Todos` / `Inativos` (mapeadas nos valores atuais do filtro). Cada item: nome + `StatusPill` compacta (`variant="expedido" label="Ativo"` / `variant="pendente" label="Inativo"`), linha 2 = razão social + CNPJ em `font-data`.
- [ ] **Step 3:** Detail header conforme R3: avatar 36px com 2 iniciais do nome fantasia, nome 16px/700, linha 2 `razão social · <span className="font-data">{codigoInterno}</span>`; à direita `<label className="flex items-center gap-2 text-[13px] font-semibold"><Switch …/>Cliente ativo</label>` + `<Button><Save />Salvar</Button>`.
- [ ] **Step 4:** Tabs (já shadcn — a Tarefa 14 restilizou): manter os 4 triggers com textos atuais. Conteúdo da aba Gerais: callout info atual vira:

```tsx
<div className="flex gap-2 rounded-md border border-primary-soft-border bg-info-soft px-3 py-2 text-xs text-info-fg">
  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
  <span><b>Representante e Rota são herdados automaticamente</b> pelo pedido de venda ao selecionar este cliente — não precisam ser escolhidos novamente na venda.</span>
</div>
```

Campos das 4 abas: todos via R4 (2 colunas; os 11 campos fiscais em 2 colunas com CEP/UF lado a lado como estão). O helper local `CampoTexto` é REMOVIDO — cada uso vira `FormField` + `Input`. `Código Interno`: `Input readOnly` + `help="Gerado automaticamente."`.
- [ ] **Step 5:** R-teste + commit `feat(ds3): clientes — master-detail denso com FormField`

---

### Tarefa 21: Tela — Recebimento / Pesagem e Destinação (`/recebimento/pesagem-destinacao`)

**Files:**
- Modify: `app/frontend/src/app/(admin)/recebimento/pesagem-destinacao/pesagem-destinacao-client.tsx`

Referência visual: `docs/ds-preview/direcao-a/pesagem.html`. Tela crítica de operação — NENHUM handler muda.

- [ ] **Step 1:** R1 — `PageHeader title="Pesagem & Destinação" subtitle="Captura de peso e destino da peça recebida" live={/* condição tempo real atual */}`; ações: os 3 `BadgeDispositivo` locais viram `<DeviceBadge label="Balança" online={…} />` etc. (o componente local `BadgeDispositivo` é REMOVIDO; o estado "instável" mapeia para `online={false}`).
- [ ] **Step 2: Lote bar** — vira um `Card` com `CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2"`:
  - código do lote: `font-data text-sm font-bold`; `StatusPill` ao lado;
  - metadados (`MetaLote` local REMOVIDO): cada um `<span className="text-xs text-muted-foreground">Fornecedor <b className="font-medium text-foreground">{…}</b></span>` — valores de NF/Romaneio/Placa com `font-data`;
  - progresso: rótulo 11px + `ProgressoBalancaBar` com container `w-[70px]` + percent `font-data text-[11px]`;
  - `Button variant="secondary" size="sm" className="ml-auto"` `<ArrowLeftRight />Trocar lote` (mesmo handler; o Select inline de troca permanece funcionalmente igual, restilizado como `SelectNative selectSize="sm"`).
- [ ] **Step 3: Abas de produto** — os botões crus viram `Tabs` shadcn (`TabsList`/`TabsTrigger` — visual da Tarefa 14), um trigger por produto com `<BadgeCount>{contagem}</BadgeCount>` embutido após o texto. Estado/param de aba ativa preservado.
- [ ] **Step 4: Grid 3 colunas** — `grid items-start gap-2.5 xl:grid-cols-[340px_1fr_320px]`:
  - **Card Balança**: `CardTitle "Balança"`. Display do peso: `<div className="rounded-lg border border-border bg-surface-2 px-4 pb-3 pt-3.5 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Peso atual</p><p className="font-data text-[44px] font-bold leading-[1.1] tracking-[-0.03em]">{peso}<span className="ml-1 text-sm font-semibold text-muted-foreground">kg</span></p></div>`. Campo Produto: `FormField label="Produto"` + `Input readOnly`. Características: `FormField label={<>Características <span className="font-normal normal-case text-fg-faint">(opcional)</span></>}` + linha de `FilterChip` (substitui `ToggleChip` local, que é REMOVIDO). Botões: `<Button className="flex-1"><Scale />Capturar peso</Button><Button variant="secondary">Digitar</Button>`. Fluxo "Digitar"/peso manual: campos via R4 (`Input inputMode="decimal"` + `SelectNative` motivo + `Button` "Confirmar peso manual"). Card da peça atual pós-captura: mantém estrutura, StatusPill v3, botões contextuais `Button variant="secondary" size="sm"` "→ Estoque" / "→ Desossa", `Button variant="destructiveOutline" size="sm"` "Cancelar ação realizada" (com `SelectNative` motivo + Input observações como hoje), `Button` "Confirmar e imprimir etiqueta".
  - **Card Pedidos compatíveis**: `CardTitle` + `CardAction` com busca `Buscar cliente` (`w-[220px] h-7`). Vazio: R9 com ícone `Scale`, título `Capture o peso para ver pedidos compatíveis`, descrição `A lista considera produto, faixa de peso e prioridade do cliente.` (padding interno `py-10`). Sugestões: itens com `Button size="sm"` "Vincular"; badge "Sugestão principal" vira `<BadgeCount className="bg-primary-soft text-primary-fg">Sugestão principal</BadgeCount>`.
  - **Card Demandas desossa**: `CardTitle` + `BadgeCount` (contagem). Cada demanda: `<div className="flex items-center gap-2.5 rounded-md border border-border px-2.5 py-2 text-xs"><span className="w-9 font-data text-[13px] font-bold">{sigla}</span><span className="min-w-0 flex-1 truncate font-semibold">{nome}</span><span className="whitespace-nowrap font-data text-[11px] text-muted-foreground">falt. {n} · est. {m}</span></div>`. Rodapé: `<p className="pt-0.5 text-[11px] text-fg-faint">Origem: TZ · regras provisórias por unidade</p>`.
- [ ] **Step 5: Tabelas inferiores** ("Acumulado do lote", "Ações realizadas") — R2; colunas numéricas em `TableCellNum`, etiquetas/horas em `TableCellCode`; footer de totais no Acumulado.
- [ ] **Step 6:** `EmptyState` local REMOVIDO (usar o de T15). R-teste (atenção: fluxo com `HARDWARE_FAKE=1`) + commit `feat(ds3): pesagem & destinação — painéis densos, DeviceBadge/FilterChip do DS`

---

### Tarefa 22: Telas — Recebimento / Carga e Etiquetas

**Files:**
- Modify: `app/frontend/src/app/(admin)/recebimento/recebimento-carga/recebimento-carga-client.tsx`
- Modify: `app/frontend/src/app/(admin)/recebimento/etiquetas/etiquetas-client.tsx`

- [ ] **Step 1: `recebimento-carga-client.tsx` (lista)** — R1 (`PageHeader title="Recebimento de carga" subtitle="Abertura de lotes a partir do Pedido ao Fornecedor — conferência na balança" live={…}`; ações: `Button variant="secondary"` `<RefreshCw />Atualizar` + `Button` `<Plus />Novo recebimento`). Tabela R2 com colunas atuais: `Lote` (TableCellCode `#XXXX`), `Pedido de Compra` (TableCellCode), `Fornecedor` (main-cell), `NF-e` (TableCellCode, `—` se vazio), `Romaneio` (TableCellCode), `Tipo de carga`, `Status` (StatusPill), `Progresso` (`ProgressoBalancaBar` em célula `w-[120px]`), ações hover (`Abrir`, `Ir para Balança`). Busca no CardAction (placeholder atual).
- [ ] **Step 2: detail** — cards R2/R4: "Ações do recebimento" = `CardContent className="flex flex-wrap gap-2 p-3"` com os 4 botões (`Ir para pesagem` = default; `Registrar divergência` = secondary; `Concluir conferência` = default; `Suspender` = destructiveOutline). Card de dados do lote: grid `grid grid-cols-2 gap-x-6 gap-y-1.5 p-3 text-xs sm:grid-cols-3` com pares `<p className="text-muted-foreground">Rótulo</p><p className="font-medium">valor</p>` (valores NF/romaneio/placa em `font-data`). Metadados operacionais e observações via R4. Tabela "Itens previstos importados" R2 (numéricos `TableCellNum`, status `StatusPill`, linha clicável `className="group cursor-pointer"` + `data-state={selecionado ? 'selected' : undefined}`).
- [ ] **Step 3: Sheets e Dialogs** — R8 para "Novo Recebimento" (seções A–D viram `<p className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">A — Pedido ao Fornecedor</p>` + R4; select do pedido vira `ComboboxField` com sublabel = código CP) e "Editar dados da NF". R7 para "Registrar divergência" (Select tipo → `SelectNative`, mesmas 8 opções) e "Conclusão da Conferência" (mantém `QuadroComparativo`).
- [ ] **Step 4: `etiquetas-client.tsx`** — R1 (`PageHeader title="Etiquetas — recebimento" subtitle="Consulta, reimpressão e cancelamento conforme v1.1 §10.4"`). Card filtros → CardAction do card da tabela (R6): `SelectNative selectSize="sm"` Recebimento + Estado, busca `Código, peça…`. Tabela R2 (Etiqueta `TableCellCode` com ícone `QrCode size={13}`; Status `StatusPill`; Peso `TableCellNum`). Sheet R8 (preview mono: `<pre className="rounded-md bg-surface-2 p-3 font-data text-[11px] leading-relaxed">`). **Os dois modais custom `div fixed` são REESCRITOS como `Dialog` (R7)** com os mesmos títulos, opções de motivo (6) e handlers.
- [ ] **Step 5:** R-teste + commit `feat(ds3): recebimento carga + etiquetas — tabelas densas, dialogs padronizados`

---

### Tarefa 23: Telas — Comercial / Disponibilidade, Espelho, Tabela de Preços

**Files:**
- Modify: `app/frontend/src/app/(admin)/comercial/disponibilidade/page.tsx`, `mapa-teatro.tsx`, `detalhe-unidade.tsx`
- Modify: `app/frontend/src/app/(admin)/comercial/espelho/espelho-client.tsx`
- Modify: `app/frontend/src/app/(admin)/comercial/tabela-precos/tabela-precos-client.tsx`

- [ ] **Step 1: Disponibilidade** — R1 (`PageHeader title="Disponibilidade" subtitle="Leitura do saldo físico, virtual e comprometido por produto." live={…}`; ações: toggle Mapa/Grade vira dois `FilterChip` mutuamente exclusivos com os textos atuais). Barra de controles: `Card` com `CardContent className="flex items-center gap-2 px-3 py-2"`: `FormField`-less inline `<span className="text-xs font-semibold">Data operacional</span>` + `DatePickerField` (substitui `input type=date`; contrato ISO) + `Button variant="secondary" size="sm"` `<Filter />Limpar filtros`.
  - **MapaTeatro (redesenho obrigatório — decisão do protótipo):** os blocos saturados F/V/R/C/D/O/E/! viram células neutras com cor apenas como acento: cada célula `<button className="min-w-[72px] rounded-md border border-border bg-card px-2 py-1.5 text-center transition-colors hover:border-fg-faint">` contendo sigla `<p className="text-[10px] font-bold text-muted-foreground">F</p>`, valor `<p className="font-data text-base font-bold">{valor}</p>`, barra `<span className="mx-auto mt-1 block h-[3px] w-8 rounded-full" style={{ background: COR_ESTADO[sigla] }} />` e unidades `<p className="text-[10px] text-fg-faint">{un} un.</p>`. `COR_ESTADO` exato: `F:#1E9A56, V:#2F6FC4, R:#C98A12, C:#2F6FC4, D:#7C4FD0, O:#D4453A, E:#7A8AA0, '!':#C98A12`. Célula selecionada: `border-primary ring-[3px] ring-ring/25`. Célula V (virtual) adicionalmente `border-dashed`. Legenda e `BadgeProvisorio codigo="P11"` mantidos.
  - Grade: KPIs (5) → R5 (`Esgotados` tone `alert`, demais `default`); Table → R2; card Alertas → AlertItem v3.
- [ ] **Step 2: Espelho** — R1 (`PageHeader` com `title="Espelho Comercial"`; `BadgeProvisorio codigo="P15"` como primeiro filho das ações, depois `Button variant="secondary"` `<Printer />Imprimir` e `<Download />Exportar`). Filtros R6 em Card próprio (date → `DatePickerField`; 2 selects nativos → `SelectNative selectSize="sm"`; busca `Buscar cliente`; toggle por cliente/rota/representante → 3 `FilterChip` exclusivos). KPIs (3) → R5 tone `default`. Tabela agrupada: header de grupo vira `<TableRow className="bg-surface-2 hover:bg-surface-2"><TableCell colSpan={6} className="h-7 text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{grupo}</TableCell></TableRow>`; subtotal em `TableRow` com `TableCellNum` em `font-bold`; nota provisória rodapé mantida.
- [ ] **Step 3: Tabela de Preços** — R1 (`PageHeader title="Tabela de Preços" subtitle="Tabela diária de preços por produto, com faixas A, B, C e D."`; ações: `DatePickerField` + `StatusPill` (Publicada→`expedido`, Rascunho→`pendente`) + texto `Publicada em …` `text-[11px] text-muted-foreground font-data`). Linha de ações: `Button variant="secondary"` `<Copy />Copiar tabela anterior` e `<History />Histórico`; à direita `Button variant="secondary"` `<Save />Salvar` + `Button` `<Upload />Publicar` (disabled como hoje). Tabela R2: `Produto` (main-cell + `BadgeProvisorio codigo="P11"` inline quando aplicável) | `Unidade` (`text-muted-foreground`) | `Preço A..D`: célula com `<Input adornLeft={<span className="text-[11px]">R$</span>} inputMode="decimal" className="h-7 w-28 text-right font-data" …/>`. Callouts → padrão do Step 4 da Tarefa 20 (info/warning/danger com tokens `*-soft`). Sheet histórico → R8. Empty → R9 com botão "Criar tabela do dia".
- [ ] **Step 4:** R-teste (3 rotas) + commit `feat(ds3): disponibilidade (mapa re-desenhado), espelho e tabela de preços`

---

### Tarefa 24: Telas — Gestão / Operações, Compras, Overbooking, Aprovações, Relatórios

**Files:**
- Modify: `app/frontend/src/app/(admin)/gestao/operacoes/operacoes-client.tsx`
- Modify: `app/frontend/src/app/(admin)/gestao/compras/compras-client.tsx` + `compras-edit-modal.tsx`
- Modify: `app/frontend/src/app/(admin)/gestao/overbooking/overbooking-client.tsx`
- Modify: `app/frontend/src/app/(admin)/gestao/aprovacoes/aprovacoes-client.tsx`
- Modify: `app/frontend/src/app/(admin)/gestao/relatorios/relatorios-client.tsx`

Aplicação uniforme das receitas; especificidades por tela:

- [ ] **Step 1: Operações** — R1 (ações: `Button variant="secondary"` `<RefreshCw />Gerar cadência` + `Button` `<Plus />Nova Operação Extraordinária`). Breadcrumb interno REMOVIDO. Callout info fixo mantém texto + `BadgeProvisorio` (formato T13). Filtro status → `SelectNative selectSize="sm"` acima da tabela no CardAction; contador `10 operação(ões)` vira `BadgeCount`. Tabela R2: `Operação` (main-cell + id `font-data text-[10px] text-fg-faint` na linha de baixo — célula com 2 linhas permitida: remover `whitespace-nowrap` via `className="whitespace-normal"`), `Data` (TableCellNum `dd/MM/yyyy`), `Dia da semana`, `Origem` (badge `Extraordinária` → `<BadgeCount className="bg-status-pesado-bg text-status-pesado">Extraordinária</BadgeCount>`; senão texto muted `Cadência automática`), `Contadores` (`TableCellNum` `0 compras · 0 pedidos · 0 OB` — manter formato), `Status` (StatusPill: Em andamento→`recebido`, Aberta→`pendente`, Fechada→`pendente` com label), `Ações` (hover: `Iniciar operação`/`Encerrar` `Button variant="secondary" size="sm"`). Dialog nova operação: R7 com `DatePickerField` + `FormField "Rótulo"` + `Button` "Criar Operação".
- [ ] **Step 2: Compras** — R1 (`PageHeader title="Compra Programada (Pedido de Compra)"`; ações `Button variant="secondary"` "Salvar rascunho" + `Button` "Confirmar compra"). Card dados gerais R4 (grid 4 col xl): `DatePickerField` (disabled conforme hoje), Fornecedor → `ComboboxField`, Referência externa → Input, Status → `StatusPill` inline, Observações Textarea `col-span` total. Card Itens: tabela R2 com célula de Select do item → `SelectNative`, Quantidade → `Input h-7 w-24 text-right font-data`, Regra/Previsão células muted, ação remover `iconSm Trash2`; `CardFooter` com `Button variant="secondary" size="sm"` `<Plus />Adicionar item`. Painel lateral "Disponibilidade gerada": Card com lista `flex justify-between text-xs` + valores `font-data`; total no `CardFooter` `font-data font-bold`. Modal edição: R7 + inputs quantidade `font-data text-right`; `PainelImpacto` mantido como está (componente de negócio).
- [ ] **Step 3: Overbooking** — R1 (ações: `SeletorOperacao` + `Button variant="secondary" size="icon"` `<RefreshCw />`). KPIs (4) → R5: Pendências abertas `alert`, Em análise `default`, Déficit total `danger`, Resolvidas hoje `ok`. Filtros R6. Master-detail R3 (master: id truncado `font-data` + StatusPill + déficit `font-data text-danger-fg`). Detail: dl → grid de pares rótulo/valor 12px (mesmo padrão do Step 2 da Tarefa 22); botões de transição: Iniciar análise `secondary`, Marcar como resolvido `default`, Cancelar pendência `destructiveOutline`. As 3 seções de resolução: cada uma `Card` interno com `CardTitle` numerado atual e botão de ação `secondary size="sm"`. Dialogs → R7 (Cancelar com `SelectNative` 4 motivos; Postergar com `Input` number `font-data text-right`).
- [ ] **Step 4: Aprovações** — R1 + `SeletorOperacao` nas ações. Abas shadcn Tabs (v3). Fila de ocorrências: master R3; detail com callout resultado (padrão T20-Step4), Textareas via `FormField`, timeline itens `AlertItem`-like mantendo componente atual; `QuadroComparativo` mantido. Aprovações operacionais: cards `Card` com `CardContent p-3` (tipo + StatusPill + descrição 12px + impacto muted); botões `Button size="sm"` "Aprovar solicitação" + `variant="destructiveOutline" size="sm"` "Rejeitar solicitação". Dialog decisão R7.
- [ ] **Step 5: Relatórios** — R1 (`title="Relatórios SIF"` + `BadgeProvisorio codigo="P8"` logo após o título — PageHeader aceita children de ação; o badge entra como primeiro filho). Callout warning fixo (padrão T23-Step3). KPIs (3) → R5: Pendentes de dados `alert`, Prontos para gerar `ok`, Gerados/Retificados `default`. Cards de relatório: `Card` + `CardContent className="flex flex-wrap items-center gap-2 p-3"` — nome 13px/600, badges, pendências em lista 11px com `AlertTriangle size={12}` warning-fg; botões à direita: Gerar `default sm`, Pré-visualizar `secondary sm`, Retificar `secondary sm`, Histórico `ghost sm`. Dialogs R7 (pré-visualização com `<pre className="max-h-80 overflow-auto rounded-md bg-surface-2 p-3 font-data text-[11px]">`).
- [ ] **Step 6:** R-teste (5 rotas) + commit `feat(ds3): telas de gestão — operações, compras, overbooking, aprovações, relatórios`

---

### Tarefa 25: Telas — Desossa (Dashboard, Etiquetas, Pesagem)

**Files:**
- Modify: `app/frontend/src/app/(admin)/desossa/dashboard/desossa-dashboard-client.tsx`
- Modify: `app/frontend/src/app/(admin)/desossa/etiquetas/desossa-etiquetas-client.tsx`
- Modify: `app/frontend/src/app/(admin)/desossa/pesagem-destinacao/desossa-pesagem-client.tsx`

- [ ] **Step 1: Dashboard desossa** — R1 (`PageHeader title="Painel de Necessidade"` — o rótulo "Desossa" acima do h1 é REMOVIDO, o breadcrumb da topbar já contextualiza; `live` conforme indicador atual; ações: `Button variant="secondary"` `<RefreshCw />Atualizar`, `<Tv />Modo TV`, `Button asChild` link "Pesagem e Destinação"). KPIs (5, hoje cards nativos) → R5: Itens faltantes `alert`, Prontos em estoque `ok`, TZs na desossa `default`, Regras sugeridas `default`, Prioridade alta `danger`. As 3 tabelas → R2 (colunas atuais; prioridade como `StatusPill` variant por criticidade se hoje é badge; numéricos `TableCellNum`; badges provisórios via `BadgeProvisorio`). Drawers → R8. **Modo TV: NÃO MIGRA** — permanece exatamente como está (tela cheia dark própria, fora do DS).
- [ ] **Step 2: Etiquetas desossa** — R1 + `SeletorOperacao` nas ações do PageHeader (o select nativo no topo é movido para lá). KPIs (5) → R5: Emitidas `default`, Reimpressões `default`, Canceladas `danger`, Invalidadas por troca `alert`, Pendentes de impressão `alert`. Filtros (busca + 4 selects nativos) → R6 no CardAction (selects `SelectNative selectSize="sm"`, larguras `w-[130px]`). Tabela R2 (Código `TableCellCode`, Peso `TableCellNum`, badges locais `StatusBadge`/`OrigemPesoBadge` REMOVIDOS → `StatusPill` com mapeamento: emitida→`expedido`, pendente de impressão→`pendente`, cancelada→`bloqueado`, invalidada→`divergencia`, reimpressa→`recebido`; origem peso → `BadgeCount`). Drawer R8; modais → R7 com `SelectNative` motivo (mesmas opções).
- [ ] **Step 3: Pesagem desossa** — mesmo tratamento da Tarefa 21 (é a tela irmã): PageHeader + SeletorOperacao; painel TZ origem em Card com código `font-data`; botões de regra → `FilterChip` (disabled conforme hoje); `BadgeProvisorioLocal` REMOVIDO → `BadgeProvisorio codigo="P12"`; empties R9 (ícones e textos atuais); painel Saídas: contador `BadgeCount`, slots como os itens de demanda da T21-Step4 com estado `registrado` = `bg-success-soft border-success-soft-border`; modais → R7/R8 (preview de etiqueta em `<pre>` mono como T22-Step4).
- [ ] **Step 4:** R-teste (3 rotas; `HARDWARE_FAKE=1`) + commit `feat(ds3): telas de desossa`

---

### Tarefa 26: Telas — Estoque (Consulta, Entrada, Ajustes)

**Files:**
- Modify: `app/frontend/src/app/(admin)/estoque/consulta/estoque-consulta-client.tsx`
- Modify: `app/frontend/src/app/(admin)/estoque/entrada-itens/entrada-itens-client.tsx`
- Modify: `app/frontend/src/app/(admin)/estoque/ajustes/ajustes-client.tsx`

- [ ] **Step 1: Consulta** — R1 (`PageHeader title="Consulta de Estoque"` — h2 com "Estoque /" REMOVIDO). Abas nativas → Tabs shadcn v3 (2 triggers com textos atuais). Aba 1: filtros R6 (3 `SelectNative sm` + busca + Limpar); tabela R2 — códigos `TableCellCode`, qtd/peso `TableCellNum`, Local com `BadgeProvisorio codigo="P1"`, Status badge local → `StatusPill` (disponível→`expedido`, reservado→`recebido`, bloqueado→`bloqueado`, demais→`pendente`), ações hover (Destinar `secondary sm`, demais `iconSm`). Aba 2: cards com `BadgeProvisorio codigo="P3"`, barra de ocupação `h-1 rounded-full bg-surface-3` com filho `bg-primary`, botões conforme hoje (Autorizar disabled). Modal Destinar → R7 (lista de pedidos clicável: itens R3-master style). Drawer histórico → R8.
- [ ] **Step 2: Entrada de itens** — R1. Callout info fixo (padrão T20-Step4). Grid 2 colunas `lg:grid-cols-[420px_1fr] gap-2.5`. Form R4 em coluna 1 (Card "Nova entrada"): Produto → `ComboboxField`; Quantidade `Input inputMode="numeric" text-right font-data` + Unidade `SelectNative w-[110px]`; Local/câmara `SelectNative`; Destino → 2 `FilterChip` exclusivos (Estoque/Pedido); busca cliente + lista de pedidos → itens clicáveis estilo R3-master; Observação Textarea; footer `Button variant="ghost"` Limpar + `Button` Confirmar entrada. Coluna 2: tabela R2 "Entradas de hoje" (Hora `TableCellCode`, Qtd `TableCellNum`, Destino `BadgeCount`).
- [ ] **Step 3: Ajustes** — R1 (`title="Ajustes de Estoque"`). Mesmo grid 2 colunas. Form R4: busca produto (autocomplete inline mantém lógica, visual do input R6), campos readonly `Input readOnly`, Ajuste +/- `Input inputMode="numeric" text-right font-data`, Motivo `SelectNative` (5 opções atuais), Descrição Textarea, callout warning de aprovação (padrão T23-Step3). Tabela R2 de ajustes recentes (Código `TableCellCode`, valores `TableCellNum`, Status → `StatusPill` pendente→`divergencia` label "Aguardando aprovação", aprovado→`expedido`, rejeitado→`bloqueado`; ações Aprovar `secondary sm`/Rejeitar `destructiveOutline sm`). Modal decisão → R7.
- [ ] **Step 4:** R-teste + commit `feat(ds3): telas de estoque`

---

### Tarefa 27: Telas — Carga (Planejamento, Conferência, Enviar p/ Faturamento)

**Files:**
- Modify: `app/frontend/src/app/(admin)/carga/planejamento/planejamento-client.tsx`
- Modify: `app/frontend/src/app/(admin)/carga/conferencia/conferencia-client.tsx` + `modal-divergencia.tsx` + `modal-leitura-manual.tsx`
- Modify: `app/frontend/src/app/(admin)/carga/enviar-faturamento/enviar-faturamento-client.tsx`
- Modify: `app/frontend/src/components/ui/pipeline-bar.tsx`

- [ ] **Step 1: PipelineBar v3** — reescrever o visual do componente (props/lógica intactas) para o padrão do protótipo (`componentes.html`, seção Pipeline): passo `flex items-center gap-1.5 text-[11px] font-semibold`; círculo 18px `rounded-full bg-surface-3 font-data text-[10px]` (futuro `text-fg-faint`), done `bg-success text-white` com `✓`, atual `bg-primary text-white shadow-[0_0_0_3px_var(--color-primary-soft)]`; conector `h-px w-6 bg-border-strong mx-1.5`, done `bg-success`.
- [ ] **Step 2: Planejamento** — R1 (`title="Planejamento de Expedição"`; ação `Button variant="secondary" asChild` "Itinerários"). Form novo caminhão: Card + R4 inline (`SelectNative` frota/avulso, Inputs condicionais, `Button` `<Plus />Novo Caminhão`). Coluna esquerda: busca R6; grupos por rota com header `text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground`; cards de pedido `rounded-md border border-border p-2.5 text-xs` com badge `S/ Caminhão` → `BadgeCount` warning-style (`bg-warning-soft text-warning-fg`) e `Button size="sm"` Alocar. Coluna direita: cards de caminhão com placa `font-data font-bold`, barra de ocupação (padrão T26-Step1; >90% filho `bg-warning`), lista de alocados 12px, botão de ação conforme estado. Modal alocar → R7 (lista clicável). Empties R9.
- [ ] **Step 3: Conferência** — PipelineBar v3 no topo (dentro do PageHeader children não — fica como bloco próprio logo após o PageHeader, `Card` com `CardContent px-3 py-2`). R1 (`title="Conferência de Carga"`). Master R3 (cards de carga: placa `font-data`, StatusPill, progresso barra fina). Detail: métricas (4) → R5 `KpiStrip` (Divergências `alert` se >0 — usar `tone={divergencias > 0 ? 'alert' : 'default'}`; demais `default`). Input de bipagem: `Input adornLeft={<ScanLine />} placeholder="Bipar etiqueta (ETQ-XXXXX)..." className="font-data"` + `Button` Bipar. Accordion de pedidos: manter Accordion shadcn; tabela interna R2 (Etiqueta `TableCellCode`, Peso `TableCellNum`, Status `StatusPill`, ação `Button variant="destructiveOutline" size="sm"` "Marcar divergência"). Banner lock: callout success + `Button` "Enviar para Faturamento". Modais → R7 (`SelectNative` 6 motivos / Textarea obrigatória).
- [ ] **Step 4: Enviar p/ Faturamento** — PipelineBar v3 idem. R1. Master R3 + chips de status → `FilterChip` (5, textos atuais). Detail: métricas (4) → R5; callouts (padrão T23); tabela R2; histórico tabela R2 própria em Card "Histórico de Envios". Empties R9.
- [ ] **Step 5:** R-teste + commit `feat(ds3): telas de carga + PipelineBar v3`

---

### Tarefa 28: Telas — Faturamento (Pré-Faturamento, Notas/XML, Seguro, Liberação)

**Files:**
- Modify: `app/frontend/src/app/(admin)/faturamento/pre-faturamento/pre-faturamento-client.tsx` (e o componente compartilhado `FaturamentoClient` onde residir)
- Modify: `app/frontend/src/app/(admin)/faturamento/notas-xml/notas-xml-client.tsx`
- Modify: `app/frontend/src/app/(admin)/faturamento/seguro-manual/seguro-manual-client.tsx`
- Modify: `app/frontend/src/app/(admin)/faturamento/liberacao/liberacao-client.tsx`

- [ ] **Step 1: Pré-Faturamento** — R1 (`live` + badge ambiente: `<BadgeCount className={homolog ? 'bg-warning-soft text-warning-fg' : 'bg-success-soft text-success-fg'}>{texto atual}</BadgeCount>`). Cards de caminhão elegível: R3-master style com `CaminhaoPipelineBar` (recebe visual v3 se compartilha PipelineBar; senão aplicar o mesmo padrão da T27-Step1). KPIs (5) → R5: Pedidos na carga `default`, Preparados `default`, Autorizados `ok`, Com erro `danger`, Valor total `default` (valor com `R$` no próprio value string como hoje). Painel de bloqueios: lista 12px com `AlertTriangle` warning. Pedidos consolidados: cards R2-like; `FormEmissao`: `Input adornLeft="R$" text-right font-data` + `Button` "Emitir NFS-e"; cancelar: `Input` motivo + `Button variant="destructiveOutline" size="sm"`. Form manual fallback: R4.
- [ ] **Step 2: Notas/XML** — R1 (badge ambiente idem). KPIs (3) → R5: Autorizadas hoje `ok`, Com erro `danger`, Aguardando retorno `alert`. Filtros R6. Tabela R2: Nº nota `TableCellCode`, Chave truncada `TableCellCode` com `title` completo, Valor `TableCellNum` (R$), Status `StatusPill` (autorizada→`expedido`, erro→`bloqueado`, processando→`recebido`, cancelada→`pendente` label "Cancelada") + nota "Caminhão liberado" 10px muted na linha de baixo, Data/hora `TableCellNum`, ações hover (`iconSm`: Download/FileText/Eye/RefreshCw/X conforme hoje). Drawer R8 (tabela de peças R2; peso total footer). Modal cancelar R7 (`SelectNative` 5 motivos; caso bloqueado → callout danger sem form). Rodapé informativo: `<p className="text-[11px] text-fg-faint">` mantido.
- [ ] **Step 3: Seguro Manual** — R1. KPIs (4) → R5: Cargas com seguro `default`, Pendentes `alert`, Enviados `default`, Confirmados `ok`. Callout info (padrão T20). Filtros R6. Cards de carga: `Card` + `CardContent p-3` com placa `font-data font-bold`, `StatusPill` (pendente→`divergencia` label "Pendente", enviado→`recebido` label "Enviado", confirmado→`expedido` label "Confirmado"), pares rótulo/valor 12px, valor da carga `font-data`, Textarea observação via `FormField label="Observação"`, botões: Anexar comprovante `secondary sm`, Marcar como enviado `secondary sm`, Marcar como confirmado `default sm`, Seguro tratado `ok`-style badge quando concluído. Dialog anexar → R7 (2 `FormField` + `Button` "Anexar").
- [ ] **Step 4: Liberação** — R1 (busca `Buscar placa…` nas ações do PageHeader, `w-[200px]`). KPIs (4) → R5: Cargas no pátio `default`, Liberáveis agora `ok`, Com pendência `alert`, Liberadas `default`. Master R3 (placa `font-data font-bold` + StatusPill). Detail: botão principal `Button` "Liberar Caminhão" (loading conforme hoje; "Já liberado" → `Button variant="secondary" disabled`); banner sucesso → callout success; `RequisitoLinha`: `flex items-center gap-2 py-1 text-xs` com `CheckCircle2 size={14} className="text-success"` / `XCircle size={14} className="text-danger-fg"`; pendências impeditivas: lista com links (`text-primary-fg font-semibold`); tabela de notas R2 (Nº `TableCellCode`, Status `StatusPill`).
- [ ] **Step 5:** R-teste (`NFSE_FAKE=1`) + commit `feat(ds3): telas de faturamento`

---

### Tarefa 29: Telas — Admin (Usuários, Perfis, Parâmetros, Auditoria)

**Files:**
- Modify: `app/frontend/src/app/(admin)/admin/usuarios/usuarios-client.tsx` + `resumo-perfis.tsx`
- Modify: `app/frontend/src/app/(admin)/admin/perfis/perfis-client.tsx`
- Modify: `app/frontend/src/app/(admin)/admin/parametros/parametros-client.tsx`
- Modify: `app/frontend/src/app/(admin)/admin/auditoria/auditoria-client.tsx`

- [ ] **Step 1: Usuários** — R1 (`title="Gestão de Usuários & Perfis"`; ações: `Button variant="secondary"` `<Filter />Filtros` (Popover: 2 selects → `SelectNative` + `Button variant="ghost" size="sm"` Limpar) + `Button` `<Plus />Novo Usuário`). Tabela R2: Nome/E-mail (nome main-cell; e-mail linha 2 `text-[11px] text-muted-foreground font-data`), Perfis (badges → `BadgeCount` um por perfil), Status `StatusPill` (ativo→`expedido`, inativo→`pendente`), Último Acesso `TableCellNum`, ações hover `iconSm` (Pencil/Trash2). `resumo-perfis.tsx`: Card v3, barras `h-1 rounded-full bg-surface-3`+filho `bg-primary`, rótulos 11px. Sheet R8 (form R4; checkboxes de perfis em grid 2 col `text-[13px]`).
- [ ] **Step 2: Perfis** — R1. Matriz: manter estrutura tabela com Switch; aplicar Table v3 (head sticky também na coluna `Perfil`: `className="sticky left-0 z-20 bg-surface-2"`); células `h-9 text-center`; agrupadores de módulo `colSpan` com `bg-surface-3 text-[10px] font-bold uppercase tracking-[0.05em]`. Painel de menus: botões toggle → `FilterChip` (aria-pressed já compatível). Callout rodapé padrão info.
- [ ] **Step 3: Parâmetros** — R1 (`title="Parâmetros do Sistema"`; breadcrumb interno removido). Grupos: `<p className="mb-1.5 mt-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground first:mt-0">` com ícone 13px. Cards de parâmetro: `Card` + `CardContent className="flex items-center gap-3 p-3"` — texto (título 13px/600 + descrição 11px muted + `BadgeProvisorio` quando houver) à esquerda, controle (Switch v3 ou `Input className="w-56"`) + `Button size="sm"` Salvar à direita. Grid `sm:grid-cols-2 gap-2.5`.
- [ ] **Step 4: Auditoria** — R1 (`title="Auditoria Filtrável"`; ações: `Button variant="secondary"` "Exportar CSV"). Card de filtros: R4 grid `sm:grid-cols-3 xl:grid-cols-6` — Registro (Input mono placeholder atual), Período início/fim (2× `DatePickerField`? NÃO — são `datetime-local`: manter `<Input type="datetime-local" className="font-data" />`), Usuário/Módulo/Operação (`SelectNative`), `Button` "Aplicar Filtros". Split: tabela R2 à esquerda (Data/Hora `TableCellNum`, Usuário main-cell, Módulo muted, Operação → `StatusPill` variant: INSERT→`expedido` label INSERT, UPDATE→`recebido`, DELETE→`bloqueado`, ACAO_MANUAL→`divergencia`; mapa local `COR_OPERACAO` REMOVIDO, Tabela/Registro `TableCellCode`, ação Eye `iconSm`), painel detalhe à direita `Card` com `<pre className="max-h-96 overflow-auto rounded-md bg-surface-2 p-3 font-data text-[11px]">` para os JSONs; paginação: `CardFooter` com `Button variant="secondary" size="sm"` Anterior/Próxima + `BadgeCount` página.
- [ ] **Step 5:** R-teste + commit `feat(ds3): telas de administração`

---

### Tarefa 30: Cadastros + componentes compartilhados de cadastro + SeletorOperacao

**Files:**
- Modify: `app/frontend/src/components/cadastro-lista.tsx`
- Modify: `app/frontend/src/components/cadastro-form.tsx`
- Modify: `app/frontend/src/components/cadastro-master-detail.tsx`
- Modify: `app/frontend/src/components/cadastros/cadastro-tabela-drawer.tsx`
- Modify: `app/frontend/src/components/gestao/seletor-operacao.tsx`
- Modify: `app/frontend/src/app/(admin)/cadastros/produtos/produtos-client.tsx`
- Modify: `app/frontend/src/app/(admin)/cadastros/rotas/rotas-client.tsx`
- Modify: `app/frontend/src/app/(admin)/cadastros/modelos-etiqueta/modelos-etiqueta-client.tsx`
- Modify: `app/frontend/src/app/(admin)/cadastros/regras-transformacao/regras-transformacao-client.tsx` + `simulador-desdobramento.tsx` + `simulador-desossa.tsx`
- Modify: `app/frontend/src/app/(admin)/cadastros/representantes/representantes-client.tsx` (+ `clientes-vinculados.tsx`, `usuarios-vinculados.tsx`)
- Modify: `app/frontend/src/app/(admin)/cadastros/caminhoes/caminhoes-client.tsx`, `motoristas/motoristas-client.tsx`, `fornecedores/fornecedores-client.tsx`

Como caminhões/motoristas/representantes usam `CadastroTabelaDrawer` e fornecedores usa `CadastroMasterDetail`, migrar os compartilhados resolve o grosso; os clients só ajustam headers e casos locais.

- [ ] **Step 1: `seletor-operacao.tsx`** — o select vira `SelectNative className="w-[190px]"` (mesmas options/handler/param de URL).
- [ ] **Step 2: `cadastro-lista.tsx`** (server) — R1+R2: form GET mantém `<form method="get">`, input vira as classes do Input v3 escritas inline (server component sem estado: copiar a string de classes do Input default h-8) + `Button variant="secondary" asChild`-equivalente `<button className={…}>Buscar</button>` com classes do Button secondary; tabela HTML pura recebe EXATAMENTE as classes da Table v3 (copiar strings de `table.tsx`: thead th = classes do TableHead, td = do TableCell); paginação `CardFooter` com links estilizados como Button secondary sm.
- [ ] **Step 3: `cadastro-form.tsx`** — todos os campos via `FormField` (erro do RHF na prop `error`); text/number → `Input`; select → `SelectNative`; checkbox → `<label className="flex items-center gap-2 text-[13px]"><Checkbox …/>{label}</label>`; date → `DatePickerField` (adaptar register → Controller do RHF, mantendo validação zod); footer `Button` Criar/Salvar (loading) + `Button variant="ghost"` Cancelar.
- [ ] **Step 4: `cadastro-master-detail.tsx`** — aplicar R3 integralmente (mesmas medidas); chips de filtro → `FilterChip`; abas de seção → Tabs v3; campos → FormField; bloco "Histórico & Ocorrências" como grid de pares 12px.
- [ ] **Step 5: `cadastro-tabela-drawer.tsx`** — R1 (título/subtítulo via props atuais → PageHeader) + R2 (tabela: colunas dinâmicas; célula tipo `mono` → `TableCellCode`, `numero` → `TableCellNum`, `pill` → `StatusPill`) + R6 (busca + selects) + R8 (drawer com FormField/Switch).
- [ ] **Step 6: clients específicos** — produtos: R1/R2/R6/R8 com as colunas e abas EXATAS do inventário (badges de tipo → `BadgeCount` com cores: Produto de compra/base `bg-success-soft text-success-fg`, Entrada direta por unidade `bg-warning-soft text-warning-fg`, Derivado de desossa `bg-status-pesado-bg text-status-pesado`); campo "Preço por kg" readonly mantém nota "Lacuna backend" como `help`. Rotas: R3 + seção paradas (inputs + `Button variant="ghost" size="iconSm"` subir/descer/remover, `Button variant="secondary" size="sm"` `<Plus />Adicionar Parada`) + dias da semana → `FilterChip` por dia. Modelos-etiqueta: grid 3 col `xl:grid-cols-[280px_1fr_320px] gap-2.5`; painel campos: grid 2 col de `<label className="flex items-center gap-2 text-[13px]"><Checkbox/>…</label>`; preview `<pre>` mono padrão. Regras-transformação: Tabs v3; tabelas R2 com footer "Soma dos fatores" (`TableFooter`); simuladores: R4 (selects nativos → `SelectNative`).
- [ ] **Step 7:** R-teste (todas as rotas de cadastro) + commit `feat(ds3): cadastros — compartilhados e clients`

---

### Tarefa 31: Tela — Login

**Files:**
- Modify: `app/frontend/src/app/(auth)/login/login-form-client.tsx` (e `login-form-shell.tsx` se o skeleton tiver classes de tamanho)

- [ ] **Step 1:** Layout split mantido (painel 45% escuro + form). Painel esquerdo: manter conteúdo/texto; trocar cor de fundo para `bg-[var(--color-sidebar-gradient-start)]` com o gradiente da sidebar (`bg-gradient-to-b from-sidebar-gradient-start to-sidebar-gradient-end`). Painel direito: form centralizado `w-full max-w-[400px]`; h2 `text-xl font-bold tracking-[-0.015em]` "Bem-vindo de volta"; subtítulo `text-[13px] text-muted-foreground`; campos via `FormField label="E-mail"` / `label="Senha"` + `Input` v3 (`h-9` AQUI — exceção única: alvo de toque confortável em tela de foco único; `className="h-9"`); botão `Button className="h-9 w-full" loading={…}` "Acessar Sistema". Badge ambiente → `BadgeCount` warning-style. Skeleton: alturas atualizadas para h-9/h-9/h-9.
- [ ] **Step 2:** R-teste + commit `feat(ds3): login`

---

## PARTE 5 — LIMPEZA E GATES

### Tarefa 32: Limpeza de código morto e aliases

**Files:**
- Delete: `app/frontend/src/components/ui/sidebar.tsx` (shadcn morto, 22KB)
- Delete: `app/frontend/src/components/ui/kpi-card.tsx`
- Modify: `app/frontend/src/components/ui/button.tsx` (remover variants `acao` e `outline` do cva)
- Modify: `app/frontend/src/app/globals.css` (remover bloco `/* Compat DS v2 */`)

- [ ] **Step 1:** `grep -rn "kpi-card\|KpiCard" app/frontend/src` → deve retornar VAZIO (todas as telas migradas). Se retornar algo, a tela foi esquecida: voltar à tarefa correspondente. Então deletar o arquivo.
- [ ] **Step 2:** `grep -rn "from './sidebar'\|from '@/components/ui/sidebar'" app/frontend/src` → vazio → deletar `sidebar.tsx`.
- [ ] **Step 3:** `grep -rn 'variant="acao"\|variant="outline"' app/frontend/src` → para cada ocorrência restante, trocar por `default`/`secondary` respectivamente; depois remover os dois aliases do cva do Button.
- [ ] **Step 4:** Para CADA token do bloco Compat (lista da Tarefa 2), rodar `grep -rn "<token>" app/frontend/src --include="*.tsx" --include="*.ts"`; remover do CSS os sem uso; os ainda usados permanecem e são listados no commit como pendência.
- [ ] **Step 5:** `npm run lint && npm run type-check && npm run test && npm run build` → PASS. Commit `refactor(ds3): remove código morto (sidebar/kpi-card), aliases e tokens compat sem uso`.

### Tarefa 33: Gate final da onda

- [ ] **Step 1:** `cd app/frontend && npm run test:cov` (se script existir; senão `npm run test`) + `npm run e2e:shell` com app no Docker (`docker compose up --build -d`, aguardar saudável). Expected: PASS. Ajustar seletores do `e2e/shell-ds.spec.ts` que referenciem medidas antigas do shell (h-14 → h-11, w-64 → w-[232px]) — é o ÚNICO ajuste de teste permitido, e somente de asserções visuais.
- [ ] **Step 2:** Rodar `npx playwright test e2e/jornada-operacional.spec.ts` — jornada E2E completa verde (nenhum fluxo quebrou).
- [ ] **Step 3:** Verificação visual final: abrir as 4 telas-farol (`/gestao/dashboard`, `/recebimento/pesagem-destinacao`, `/comercial/clientes`, `/comercial/pedidos`) em 1366×768 e comparar lado a lado com `docs/ds-preview/direcao-a/*.html`. Critérios de aceite: (a) dashboard = 2 faixas KPI + ≥12 linhas + alertas sem scroll; (b) nenhuma fonte proporcional em coluna numérica; (c) todos os controles 32px/28px (login 36px); (d) zero pills/badges fora de StatusPill/BadgeCount/BadgeProvisorio/DeviceBadge/FilterChip — verificar com `grep -rn "rounded-full px-2" app/frontend/src/app` (deve retornar vazio).
- [ ] **Step 4:** Detector do impeccable: `node C:/Users/sammuka/.claude/skills/impeccable/scripts/detect.mjs --json app/frontend/src` — sem findings de severidade `error`.
- [ ] **Step 5:** Atualizar `docs/execucao/EXECUCAO-STATUS.md` registrando a onda DS v3 concluída. Commit final `docs(execucao): onda DS v3 concluída` e abrir PR para `develop` com o resumo da onda.

---

## Autorrevisão (executada na escrita deste plano)

- **Cobertura:** 43 rotas do inventário ↔ tarefas 18–31 (dashboard=18; pedidos=19; clientes=20; pesagem-recebimento=21; recebimento-carga+etiquetas=22; disponibilidade/espelho/tabela-precos=23; operações/compras/overbooking/aprovações/relatórios=24; desossa×3=25; estoque×3=26; carga×3=27; faturamento×4=28; admin×4=29; cadastros×10+compartilhados+SeletorOperacao=30; login=31). Modo TV explicitamente fora de escopo (T25-Step1). `TrocaPecaFluxo`/`troca-peca-modal.tsx`, `QuadroComparativo`, `PainelImpacto` e `ProgressoBalancaBar` mantidos como estão (componentes de negócio — herdam tokens novos automaticamente).
- **Tipos:** `KpiTone` exportado em T8 e consumido em T18; `TableCellNum/TableCellCode` definidos em T9 e usados a partir de T18; `rotuloStatusPedido` definido em T7 e consumido em T18/T19; `DatePickerField` contrato ISO definido em T11 e usado em T23/T24/T29/T30.
- **Sem placeholders:** todas as tarefas têm código literal ou mapeamento determinístico para receita com valores exatos; nenhuma decisão delegada ao worker.

