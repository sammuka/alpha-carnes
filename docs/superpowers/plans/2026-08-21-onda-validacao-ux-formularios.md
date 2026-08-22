# Onda Validação & UX de Formulários — Especificação de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans para implementar este plano tarefa a tarefa. Passos usam checkbox (`- [ ]`) para acompanhamento. Cada tarefa é autocontida: contém todo o código e contexto necessários — não é preciso ler outras tarefas para executar a sua.

**Goal:** Toda tela com formulário de criar/editar no AlphaCarnes deve, ao falhar a validação: (1) destacar a borda do campo específico que falhou, (2) destacar a aba que contém esse campo quando a tela tem abas, (3) mostrar mensagem clara em PT-BR (nunca o texto genérico "Validação falhou" nem mensagens técnicas do Zod em inglês), e (4) impedir digitação além do limite/formato esperado via máscara + `maxLength`.

**Architecture:**
- **Backend:** mapa de erro Zod global em PT-BR (`z.config({ customError })`), registrado num módulo dedicado importado no topo do `main.ts`. Zero mudança de contrato HTTP — o shape `{ statusCode, message: { message: 'Validação falhou', errors: ZodIssue[] } }` já é o que o frontend precisa (confirmado em `zod-validation.pipe.ts` + `all-exceptions.filter.ts`).
- **Frontend, camada compartilhada:** `extrairErrosPorCampo(body)` devolve `Record<string, string>` (chave = `issue.path.join('.')`); `detalharErro(res)` devolve `{ mensagem, porCampo }` de uma só leitura do body; hook `useErrosPorCampo()` padroniza o estado (aplicar no catch do submit, limpar por campo ao digitar, limpar tudo ao abrir/trocar registro).
- **Componentes de campo:** `Input`/`Textarea`/`SelectNative`/`SelectTrigger`/`Checkbox` **já têm** o CSS `aria-invalid:border-destructive`; `FormField` **já tem** a prop `error`. Nenhum visual novo — é 100% plumbing de props.
- **`TabsTrigger`:** ganha prop `temErro` (borda/texto destrutivo + ponto indicador). Único componente com código novo.
- **Máscaras:** `lib/masks.ts` (já tem CNPJ/CPF, CEP, telefone) ganha só `mascararPlaca`. Máscara/`maxLength` viram props **declarativas** nos configs de campo (`CampoCadastro` do drawer, `CampoConfig` de `cadastros-config.ts`), não código repetido por tela.

**Tech Stack:** Zod 4.4.3 (`z.config`, `zod/v4/core` exportado e importável — confirmado no lockfile), NestJS 11, Next.js 16 / React 19, react-hook-form + `@hookform/resolvers/zod` (já instalado, usado só pelo `CadastroForm`), Tailwind 4, Radix Tabs, Jest (backend: `test/unit/*.spec.ts`; frontend: `src/**/__tests__/*.test.ts(x)`).

**Decisões de design desta especificação** (tomadas na revisão de 2026-08-21 sobre o rascunho tático; toda a base de código foi re-verificada):

| # | Decisão | Racional |
|---|---|---|
| D1 | **Escopo em dois níveis confirmado**: Nível 1 (campo+aba+máscara) para cadastros; Nível 2 (só mensagem clara) para as telas operacionais. | Fluxos operacionais têm formulários pequenos e contextuais; instrumentar campo a campo dobraria a onda com ganho marginal. Registrar como AD-12. |
| D2 | `mascararPercentual` e `mascararMoeda` **removidos do escopo**. | Não têm consumidor: Produtos não tem campos percentuais (os fiscais reais são NCM/CFOP/origem/CEST, texto), e Tabela de Preços/Fornecedores usam `<input type="number">` nativo. YAGNI. |
| D3 | Tarefa de Regras de Transformação **reduzida** a troca da extração de erro no `carregar()`. | A tela é somente leitura — botão "Nova regra" está `disabled` ("em breve"); não existe formulário para instrumentar. |
| D4 | Tarefa de Modelos de Etiqueta **removida**. | O submit envia só `{ campos }` (checkboxes) e já usa `mensagemDeErro`. Nada a fazer. |
| D5 | `CadastroForm` passa a registrar campos JSON pelo **caminho aninhado** (`dadosFiscaisJson.cep`), não pelo nome plano. | Corrige de raiz dois defeitos: (a) hoje o `/novo` envia os campos JSON planos e o Zod do backend os descarta silenciosamente; (b) alinha as chaves do react-hook-form com o `path` dos issues do servidor, viabilizando `setError` por campo. |
| D6 | Máscara/`maxLength` entram como **props declarativas** (`mascara?`, `maxLength?`) em `CampoCadastro` e `CampoConfig`, aplicadas uma vez nos componentes genéricos. | Uma implementação cobre drawer, master-detail e form; telas só declaram. |
| D7 | Motorista `documento` **não recebe** `mascararCpfCnpj`. | O campo aceita CNH (placeholder "CNH nº", backend `max(100)` sem validação de CPF). Máscara de CPF corromperia a digitação. Só `maxLength={100}`. |
| D8 | Frontend **não** ganha mapa de erro Zod global. | Os schemas client-side de `cadastros-config.ts` já têm mensagens custom; os 4 call-sites sem mensagem ganham mensagem inline (Tarefa 5) — menor que duplicar o mapa entre workspaces. |

## Global Constraints

- **Sem lógica de negócio nova.** Só extração/exibição de erro, destaque visual, formatação de entrada e texto de mensagem. Nenhuma regra de validação muda de comportamento (dígito verificador, formato de placa etc. continuam como estão).
- **Convenção de chave de campo = `issue.path.join('.')`.** Campo simples: `razaoSocial`. Campo em JSONB: `dadosFiscaisJson.cep`. Item de array: `paradas.2.descricao`. Aninhado profundo: `atributosJson.fiscal.ncm`. Todo lookup `erros[chave]` usa exatamente essa convenção.
- **Tom das mensagens:** direto, sem jargão técnico, sem nome de campo em camelCase, sem código interno (RF-xx), nunca em inglês. Bom: "CNPJ ou CPF inválido — confira o número digitado." Mau: "documentoFiscal inválido (CNPJ ou CPF com dígito verificador inválido)".
- **Máscara nunca bloqueia colar/editar** — só reformata o valor completo a cada digitação (padrão de `mascararCpfCnpj` já implementado). O backend de clientes/fornecedores normaliza o documento (remove pontuação) antes de validar, então enviar o valor mascarado é seguro.
- **`maxLength` reflete o limite real do DTO do backend** — todos os valores desta spec foram conferidos nos DTOs em 2026-08-21 e estão citados por tarefa. Não aplicar `maxLength` quando a máscara já limita o tamanho (ela usa `.slice()`).
- **Gates por tarefa:** `npm run lint && npm run type-check && npm run test` (frontend) / `npm run lint && npm run type-check && npm run test:cov` (backend) verdes antes de cada commit, no workspace tocado.
- **Commits:** um por tarefa, `fix(validacao): <resumo>` ou `feat(validacao): <resumo>`, terminando com `Co-Authored-By: Claude <noreply@anthropic.com>`.
- **Nunca inventar mensagem nova de regra de negócio** — mensagens custom existentes só mudam conforme a tabela de-para da Tarefa 16.

---

## PARTE 1 — FUNDAÇÕES

### Tarefa 1: Mapa de erro Zod em PT-BR (backend, global)

**Files:**
- Create: `app/backend/src/common/validation/zod-error-map.pt-br.ts`
- Create: `app/backend/src/common/validation/zod-config.ts`
- Modify: `app/backend/src/main.ts` (adicionar 1 import no topo)
- Test: `app/backend/test/unit/zod-error-map.spec.ts`

**Interfaces:**
- Produces: toda validação Zod **sem** mensagem customizada devolve texto PT-BR. Mensagens já customizadas por schema (`.min(1, 'msg')`, `.refine(..., { message })`) **não mudam** — o `customError` do Zod 4 tem precedência menor que mensagens definidas no schema. Shape do erro HTTP não muda.

- [ ] **Step 1: Criar o mapa de erro**

```ts
// app/backend/src/common/validation/zod-error-map.pt-br.ts
import type { $ZodErrorMap } from 'zod/v4/core';

const UNIDADE: Record<string, string> = {
  string: 'caracteres',
  array: 'itens',
};

/**
 * Traduz os códigos de issue do Zod para PT-BR claro, sem jargão de validador.
 * Só entra em jogo quando o schema não define mensagem própria (ex.: `.min(1, 'msg')`),
 * então mensagens de negócio (dígito verificador, formatos de data etc.) continuam intactas.
 */
export const zodErrorMapPtBr: $ZodErrorMap = (issue) => {
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined || issue.input === null
        ? 'Campo obrigatório.'
        : 'Valor em formato inesperado.';
    case 'too_small': {
      const unidade = UNIDADE[String(issue.origin ?? '')] ?? '';
      if (Number(issue.minimum) === 1 && unidade === 'caracteres') return 'Campo obrigatório.';
      return unidade
        ? `Deve ter pelo menos ${issue.minimum} ${unidade}.`
        : `Deve ser maior ou igual a ${issue.minimum}.`;
    }
    case 'too_big': {
      const unidade = UNIDADE[String(issue.origin ?? '')] ?? '';
      return unidade
        ? `Deve ter no máximo ${issue.maximum} ${unidade}.`
        : `Deve ser menor ou igual a ${issue.maximum}.`;
    }
    case 'invalid_format':
      if ('format' in issue && issue.format === 'email') return 'E-mail inválido.';
      if ('format' in issue && issue.format === 'uuid') return 'Identificador inválido.';
      return 'Formato inválido.';
    case 'invalid_value':
      return 'Selecione uma das opções válidas.';
    case 'invalid_union':
      return 'Valor inválido.';
    case 'unrecognized_keys':
      return 'Campo desconhecido enviado.';
    case 'not_multiple_of':
      return 'Valor inválido.';
    default:
      return 'Valor inválido.';
  }
};
```

- [ ] **Step 2: Criar o módulo de registro** (efeito colateral único, isolado para ser importável tanto pelo `main.ts` quanto pelos testes):

```ts
// app/backend/src/common/validation/zod-config.ts
import { z } from 'zod';
import { zodErrorMapPtBr } from './zod-error-map.pt-br';

// Registrado uma única vez, antes de qualquer parse. O main.ts importa este módulo
// como primeira dependência da aplicação; testes que dependem do mapa importam-no no topo.
z.config({ customError: zodErrorMapPtBr });
```

- [ ] **Step 3: Registrar no bootstrap** — em `app/backend/src/main.ts`, o arquivo hoje começa assim:

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
```

Adicionar o import do config imediatamente após `reflect-metadata`:

```ts
import 'reflect-metadata';
import './common/validation/zod-config';
import { NestFactory } from '@nestjs/core';
```

- [ ] **Step 4: Escrever o teste**

```ts
// app/backend/test/unit/zod-error-map.spec.ts
import '../../src/common/validation/zod-config';
import { z } from 'zod';

function mensagem(resultado: z.ZodSafeParseResult<unknown>): string {
  if (resultado.success) throw new Error('esperava falha de validação');
  return resultado.error.issues[0]!.message;
}

describe('zodErrorMapPtBr (registrado via z.config)', () => {
  it('campo string ausente vira "Campo obrigatório."', () => {
    expect(mensagem(z.object({ nome: z.string() }).safeParse({}))).toBe('Campo obrigatório.');
  });

  it('string vazia com min(1) vira "Campo obrigatório."', () => {
    expect(mensagem(z.string().min(1).safeParse(''))).toBe('Campo obrigatório.');
  });

  it('min(3) em string informa o mínimo em PT-BR', () => {
    expect(mensagem(z.string().min(3).safeParse('ab'))).toBe('Deve ter pelo menos 3 caracteres.');
  });

  it('max(5) em string informa o máximo em PT-BR', () => {
    expect(mensagem(z.string().max(5).safeParse('abcdef'))).toBe('Deve ter no máximo 5 caracteres.');
  });

  it('número abaixo do mínimo usa a variante numérica', () => {
    expect(mensagem(z.number().min(10).safeParse(5))).toBe('Deve ser maior ou igual a 10.');
  });

  it('e-mail inválido', () => {
    expect(mensagem(z.email().safeParse('nao-email'))).toBe('E-mail inválido.');
  });

  it('enum inválido pede uma opção válida', () => {
    expect(mensagem(z.enum(['ativo', 'inativo']).safeParse('outro'))).toBe(
      'Selecione uma das opções válidas.',
    );
  });

  it('mensagem customizada do schema tem precedência sobre o mapa global', () => {
    expect(mensagem(z.string().min(1, 'mensagem própria').safeParse(''))).toBe('mensagem própria');
  });
});
```

Se `z.ZodSafeParseResult` não existir nessa versão do Zod, tipar o parâmetro como `{ success: boolean } & Record<string, unknown>` e fazer o narrowing inline — o comportamento testado é o mesmo.

- [ ] **Step 5: Rodar a suíte completa do backend** — `cd app/backend && npm run test:cov`. **Atenção:** testes existentes que asseguram mensagens default do Zod em inglês (ex.: `expect(...).toContain('Invalid input')`) passarão a falhar — atualizar a expectativa para a nova string PT-BR (isso é o efeito desejado do mapa, não regressão). Cobertura ≥80% mantida.

- [ ] **Step 6: Commit** — `feat(validacao): mapa de erro Zod global em PT-BR`

---

### Tarefa 2: Helpers de erro por campo + hook de estado (frontend)

**Files:**
- Modify: `app/frontend/src/lib/error-message.ts`
- Create: `app/frontend/src/lib/use-erros-campo.ts`
- Test: `app/frontend/src/lib/__tests__/error-message.test.ts`
- Test: `app/frontend/src/lib/__tests__/use-erros-campo.test.tsx`

**Interfaces:**
- Consumes: `ZodIssueLike` e `extrairMensagemErro` já existentes em `error-message.ts`.
- Produces (todas as tarefas seguintes dependem destas assinaturas exatas):
  - `extrairErrosPorCampo(body: unknown): Record<string, string>`
  - `detalharErro(res: Response, fallback?: string): Promise<{ mensagem: string; porCampo: Record<string, string> }>`
  - `useErrosPorCampo(): { erros: Record<string, string>; setErros: (e: Record<string, string>) => void; limparCampo: (chave: string) => void; limparTudo: () => void }`

- [ ] **Step 1: Adicionar as funções em `error-message.ts`** (após `extrairMensagemErro`; reusa a interface `ZodIssueLike` do topo do arquivo):

```ts
/** Extrai um mapa `caminho.pontilhado -> mensagem` dos issues do Zod, para destacar campo a campo. */
export function extrairErrosPorCampo(body: unknown): Record<string, string> {
  if (body == null || typeof body !== 'object') return {};
  const msg = (body as { message?: unknown }).message;
  if (typeof msg !== 'object' || msg === null) return {};
  const errors = (msg as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return {};

  const mapa: Record<string, string> = {};
  for (const e of errors) {
    if (typeof e !== 'object' || e === null) continue;
    const issue = e as ZodIssueLike;
    const texto = typeof issue.message === 'string' ? issue.message.trim() : '';
    const caminho = Array.isArray(issue.path) ? issue.path.join('.') : '';
    if (texto && caminho) mapa[caminho] = texto;
  }
  return mapa;
}

/** Lê o corpo de erro uma única vez e devolve texto (banner/toast) + mapa por campo juntos. */
export async function detalharErro(
  res: Response,
  fallback = 'Falha na operação',
): Promise<{ mensagem: string; porCampo: Record<string, string> }> {
  const body: unknown = await res.json().catch(() => null);
  return { mensagem: extrairMensagemErro(body, fallback), porCampo: extrairErrosPorCampo(body) };
}
```

- [ ] **Step 2: Criar o hook**

```ts
// app/frontend/src/lib/use-erros-campo.ts
import { useState } from 'react';

/**
 * Estado padrão do mapa campo→mensagem devolvido pelo backend (issues do Zod).
 * Uso: `setErros(porCampo)` no catch do submit; `limparCampo(chave)` no onChange
 * de cada campo (o erro some assim que o usuário corrige); `limparTudo()` ao
 * abrir formulário novo ou trocar de registro.
 */
export function useErrosPorCampo() {
  const [erros, setErros] = useState<Record<string, string>>({});

  function limparCampo(chave: string) {
    setErros((atual) => {
      if (!(chave in atual)) return atual;
      const { [chave]: _removida, ...resto } = atual;
      return resto;
    });
  }

  return { erros, setErros, limparCampo, limparTudo: () => setErros({}) };
}
```

- [ ] **Step 3: Testes**

```ts
// app/frontend/src/lib/__tests__/error-message.test.ts
import { extrairErrosPorCampo } from '../error-message';

describe('extrairErrosPorCampo', () => {
  const body = {
    statusCode: 400,
    message: {
      message: 'Validação falhou',
      errors: [
        { path: ['dadosFiscaisJson', 'cep'], message: 'CEP inválido.', code: 'custom' },
        { path: ['razaoSocial'], message: 'Campo obrigatório.', code: 'too_small' },
        { path: ['paradas', 2, 'descricao'], message: 'Campo obrigatório.', code: 'too_small' },
      ],
    },
  };

  it('mapeia path.join(".") para a mensagem, inclusive índices de array', () => {
    expect(extrairErrosPorCampo(body)).toEqual({
      'dadosFiscaisJson.cep': 'CEP inválido.',
      razaoSocial: 'Campo obrigatório.',
      'paradas.2.descricao': 'Campo obrigatório.',
    });
  });

  it('body sem errors devolve mapa vazio', () => {
    expect(extrairErrosPorCampo({ message: 'Não encontrado' })).toEqual({});
    expect(extrairErrosPorCampo(null)).toEqual({});
    expect(extrairErrosPorCampo('texto')).toEqual({});
  });
});
```

```tsx
// app/frontend/src/lib/__tests__/use-erros-campo.test.tsx
import { act, renderHook } from '@testing-library/react';
import { useErrosPorCampo } from '../use-erros-campo';

describe('useErrosPorCampo', () => {
  it('limparCampo remove só a chave editada', () => {
    const { result } = renderHook(() => useErrosPorCampo());
    act(() => result.current.setErros({ a: 'Erro A', b: 'Erro B' }));
    act(() => result.current.limparCampo('a'));
    expect(result.current.erros).toEqual({ b: 'Erro B' });
  });

  it('limparCampo de chave inexistente não altera o estado', () => {
    const { result } = renderHook(() => useErrosPorCampo());
    act(() => result.current.setErros({ a: 'Erro A' }));
    act(() => result.current.limparCampo('x'));
    expect(result.current.erros).toEqual({ a: 'Erro A' });
  });
});
```

- [ ] **Step 4: Verificar** — `cd app/frontend && npm run type-check && npm run test` — PASS.

- [ ] **Step 5: Commit** — `feat(validacao): extrairErrosPorCampo, detalharErro e hook useErrosPorCampo`

---

### Tarefa 3: `TabsTrigger` com indicador de erro

**Files:**
- Modify: `app/frontend/src/components/ui/tabs.tsx`

**Interfaces:**
- Produces: `<TabsTrigger temErro>` — prop opcional; sem ela, zero mudança visual/comportamental (retrocompatível com todos os usos atuais).

- [ ] **Step 1: Substituir a função `TabsTrigger`** (linhas 37-51 do arquivo atual) por:

```tsx
function TabsTrigger({
  className,
  temErro,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & { temErro?: boolean }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-[7px] text-[13px] font-medium text-muted-foreground transition-colors duration-100 outline-none hover:text-foreground focus-visible:rounded focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-primary-fg",
        temErro && "text-destructive data-[state=active]:border-destructive data-[state=active]:text-destructive",
        className,
      )}
      {...props}
    >
      {children}
      {temErro && (
        <span aria-label="Aba com campo inválido" className="size-1.5 rounded-full bg-destructive" />
      )}
    </TabsPrimitive.Trigger>
  );
}
```

Nota: a prop `temErro` **não** é repassada ao Radix (é desestruturada antes do spread).

- [ ] **Step 2: Verificar** — `cd app/frontend && npm run type-check && npm run test` — PASS. Abrir uma tela com abas existente (ex.: `/comercial/clientes`) e confirmar visualmente que nada mudou sem a prop.

- [ ] **Step 3: Commit** — `feat(validacao): TabsTrigger com indicador de erro (prop temErro)`

---

### Tarefa 4: `mascararPlaca` + testes de máscaras

**Files:**
- Modify: `app/frontend/src/lib/masks.ts`
- Test: `app/frontend/src/lib/__tests__/masks.test.ts`

**Interfaces:**
- Produces: `mascararPlaca(valor: string): string` — maiúsculas, só A-Z/0-9, corta em 7. Compatível com o regex do backend (`caminhao-cadastro.dto.ts`: `/^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/`, hífen opcional).

- [ ] **Step 1: Adicionar ao final de `masks.ts`:**

```ts
/** Placa Mercosul (ABC1D23) ou antiga (ABC1234): maiúsculas, sem pontuação, 7 caracteres. */
export function mascararPlaca(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}
```

- [ ] **Step 2: Testes** (o arquivo `masks.ts` foi criado sem testes; cobrir as 4 máscaras):

```ts
// app/frontend/src/lib/__tests__/masks.test.ts
import { mascararCep, mascararCpfCnpj, mascararPlaca, mascararTelefone } from '../masks';

describe('mascararCpfCnpj', () => {
  it('formata CPF conforme digita', () => {
    expect(mascararCpfCnpj('12345678901')).toBe('123.456.789-01');
  });
  it('formata CNPJ quando passa de 11 dígitos', () => {
    expect(mascararCpfCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });
  it('ignora pontuação colada e corta em 14 dígitos', () => {
    expect(mascararCpfCnpj('11.222.333/0001-81xx99')).toBe('11.222.333/0001-81');
  });
});

describe('mascararCep', () => {
  it('formata 00000-000', () => {
    expect(mascararCep('06010100')).toBe('06010-100');
  });
});

describe('mascararTelefone', () => {
  it('fixo com 10 dígitos', () => {
    expect(mascararTelefone('1136540000')).toBe('(11) 3654-0000');
  });
  it('celular com 11 dígitos', () => {
    expect(mascararTelefone('11987654321')).toBe('(11) 98765-4321');
  });
});

describe('mascararPlaca', () => {
  it('remove pontuação, sobe caixa e corta em 7', () => {
    expect(mascararPlaca('abc-1d23')).toBe('ABC1D23');
    expect(mascararPlaca('abc1234xy')).toBe('ABC1234');
  });
});
```

- [ ] **Step 3: Verificar** — `cd app/frontend && npm run test` — PASS.

- [ ] **Step 4: Commit** — `feat(validacao): mascararPlaca + testes de masks`

---

## PARTE 2 — CAMADA DECLARATIVA E PADRÕES GENÉRICOS

### Tarefa 5: `cadastros-config.ts` — máscara/maxLength declarativos + mensagens PT-BR + documento mascarável

**Files:**
- Modify: `app/frontend/src/lib/cadastros-config.ts`

**Interfaces:**
- Consumes: `mascararCep`, `mascararCpfCnpj`, `mascararTelefone` de `@/lib/masks` (Tarefa 4 não é pré-requisito — placa não aparece aqui).
- Produces: `CampoConfig` ganha `mascara?: (valor: string) => string` e `maxLength?: number` (consumidos nas Tarefas 8 e 9). Schema de documento aceita valor mascarado. Nenhuma mensagem client-side em inglês.

- [ ] **Step 1: Estender a interface `CampoConfig`** (linha ~15) com:

```ts
  /** Reformata o valor a cada digitação (ex.: mascararCpfCnpj). Nunca bloqueia colar. */
  mascara?: (valor: string) => string;
  /** Limite físico de digitação — copiar do `.max(N)` do DTO do backend, nunca inventar. */
  maxLength?: number;
```

E importar no topo: `import { mascararCep, mascararCpfCnpj, mascararTelefone } from '@/lib/masks';`

- [ ] **Step 2: Documento fiscal mascarável** — o schema atual rejeita pontuação (`documentoRegex = /^\d{11}$|^\d{14}$/` sobre o valor cru), mas o backend normaliza (remove `\D`) antes de validar. Alinhar o client-side ao backend, substituindo (linhas ~50-51):

```ts
const documentoRegex = /^\d{11}$|^\d{14}$/;
const documentoMsg = 'Informe um CNPJ (14 dígitos) ou CPF (11 dígitos), apenas números';
```

por:

```ts
const documentoRegex = /^\d{11}$|^\d{14}$/;
const documentoMsg = 'Informe um CNPJ (14 dígitos) ou CPF (11 dígitos)';
/** Valida ignorando a pontuação da máscara — mesmo critério do backend (normalizarDocumento). */
const documentoValido = (valor: string) => documentoRegex.test(valor.replace(/\D/g, ''));
```

e nos dois schemas (`clientesConfig.schema` e `fornecedoresConfig.schema`) trocar
`documentoFiscal: z.string().regex(documentoRegex, documentoMsg)` por
`documentoFiscal: z.string().refine(documentoValido, documentoMsg)`.

- [ ] **Step 3: Mensagens PT-BR nos call-sites sem mensagem** (os defaults do Zod aqui sairiam em inglês na validação client-side do `CadastroForm`):
  - `representanteId: z.string().uuid().optional().or(z.literal(''))` → `z.string().uuid('Identificador do representante inválido').optional().or(z.literal(''))`
  - em `parametrosFornecedorFormSchema`:
    - `capacidadeMaximaKg: z.coerce.number().int().min(0).optional()` → `z.coerce.number().int().min(0, 'Deve ser maior ou igual a zero').optional()`
    - `toleranciaDivergenciaPercentual: z.coerce.number().min(0).max(100).optional()` → `z.coerce.number().min(0, 'Deve ser maior ou igual a zero').max(100, 'Deve ser no máximo 100').optional()`

- [ ] **Step 4: Declarar máscara/maxLength nos `campos`** — valores conferidos nos DTOs do backend em 2026-08-21 (`cliente.dto.ts`, `fornecedor.dto.ts`, `json-cadastros.dto.ts`, `item-compra.dto.ts`, `item-comercial.dto.ts`):

  **`clientesConfig.campos`:**
  | campo | acréscimo |
  |---|---|
  | `codigo` | `maxLength: 50` |
  | `razaoSocial` | `maxLength: 200` |
  | `nomeFantasia` | `maxLength: 200` |
  | `documentoFiscal` | `mascara: mascararCpfCnpj` e trocar `placeholder` para `'00.000.000/0000-00'` |
  | `logradouro` (dadosFiscaisJson) | `maxLength: 200` |
  | `numero` (dadosFiscaisJson) | `maxLength: 20` |
  | `bairro` (dadosFiscaisJson) | `maxLength: 100` |
  | `cidade` (dadosFiscaisJson) | `maxLength: 100` |
  | `uf` (dadosFiscaisJson) | `maxLength: 2`, `mascara: (v) => v.toUpperCase()` |
  | `cep` (dadosFiscaisJson) | `mascara: mascararCep` |
  | `inscricaoEstadual` (dadosFiscaisJson) | `maxLength: 30` |
  | `nome` (dadosContatoJson) | `maxLength: 200` |
  | `telefone` (dadosContatoJson) | `mascara: mascararTelefone` |
  | `cargo` (dadosContatoJson) | `maxLength: 100` |

  **`fornecedoresConfig.campos`:**
  | campo | acréscimo |
  |---|---|
  | `codigo` | `maxLength: 50` |
  | `razaoSocial` | `maxLength: 200` |
  | `documentoFiscal` | `mascara: mascararCpfCnpj`, `placeholder: '00.000.000/0000-00'` |
  | `nome` (contatosJson) | `maxLength: 200` |
  | `telefone` (contatosJson) | `mascara: mascararTelefone` |
  | `cargo` (contatosJson) | `maxLength: 100` |
  | `horarioLimiteRecebimento` (parametrosOperacionaisJson) | `maxLength: 5` |

  **`itensCompraConfig.campos`:** `codigo` 50, `descricao` 200, `categoria` 100, `unidadeCompra` 30.
  **`itensComerciaisConfig.campos`:** `codigo` 50, `descricao` 200, `categoria` 100, `unidadeComercial` 30.

  Não aplicar `maxLength` a campos que ganharam `mascara` com `.slice()` interno (documento, cep, telefone) — a máscara já limita.

- [ ] **Step 5: Verificar** — `cd app/frontend && npm run type-check && npm run test` — PASS (as props são inertes até as Tarefas 8/9 consumi-las; o refine de documento mantém aceitos os valores só-dígitos atuais).

- [ ] **Step 6: Commit** — `feat(validacao): mascara/maxLength declarativos e mensagens PT-BR em cadastros-config`

---

### Tarefa 6: `CadastroTabelaDrawer` — erro por campo + máscara declarativa

**Files:**
- Modify: `app/frontend/src/components/cadastros/cadastro-tabela-drawer.tsx`

**Interfaces:**
- Consumes: `detalharErro` (Tarefa 2), `useErrosPorCampo` (Tarefa 2).
- Produces: `CampoCadastro` ganha `mascara?: (valor: string) => string` e `maxLength?: number` (consumidos na Tarefa 7). As 3 telas que usam o componente (Motoristas, Caminhões, Representantes) ganham destaque de campo sem serem tocadas.

Este componente não tem abas — nada da Tarefa 3 aqui.

- [ ] **Step 1: Estender `CampoCadastro`** (interface na linha ~38) com os mesmos dois membros da Tarefa 5:

```ts
  /** Reformata o valor a cada digitação (ex.: mascararPlaca). Nunca bloqueia colar. */
  mascara?: (valor: string) => string;
  /** Limite físico de digitação — copiar do `.max(N)` do DTO do backend. */
  maxLength?: number;
```

- [ ] **Step 2: Imports e estado** — trocar `import { mensagemDeErro } from '@/lib/error-message';` por `import { detalharErro, mensagemDeErro } from '@/lib/error-message';` e adicionar `import { useErrosPorCampo } from '@/lib/use-erros-campo';`. Dentro do componente, junto aos outros `useState`:

```ts
const { erros, setErros, limparCampo, limparTudo } = useErrosPorCampo();
```

- [ ] **Step 3: Limpar ao abrir** — em `abrirNovo` e `abrirEdicao`, adicionar `limparTudo();` como primeira linha.

- [ ] **Step 4: Pré-checagem de obrigatórios com destaque** — em `salvar()`, o bloco atual:

```ts
if (faltando.length > 0) {
  toast.error(`Preencha: ${faltando.map((c) => c.rotulo).join(', ')}`);
  return;
}
```

vira:

```ts
if (faltando.length > 0) {
  setErros(Object.fromEntries(faltando.map((c) => [c.nome, 'Campo obrigatório.'])));
  toast.error(`Preencha: ${faltando.map((c) => c.rotulo).join(', ')}`);
  return;
}
```

- [ ] **Step 5: Erro do servidor por campo** — ainda em `salvar()`, trocar:

```ts
if (!res.ok) {
  toast.error(await mensagemDeErro(res));
  return;
}
```

por:

```ts
if (!res.ok) {
  const { mensagem, porCampo } = await detalharErro(res, 'Falha ao salvar');
  setErros(porCampo);
  toast.error(mensagem);
  return;
}
```

(`mensagemDeErro` continua usada em `carregar`/`alternarStatus` — não mexer nelas.)

- [ ] **Step 6: Render dos campos** — no `campos.map(...)` dentro do `SheetContent`, o bloco atual de cada tipo passa a: (a) receber `error`/`aria-invalid`, (b) aplicar máscara/maxLength, (c) limpar o erro do campo ao digitar. Substituir o corpo do map por:

```tsx
{campos.map((campo) => (
  <FormField
    key={campo.nome}
    label={campo.rotulo}
    required={campo.obrigatorio}
    htmlFor={campo.nome}
    error={erros[campo.nome]}
    className={campo.tipo === 'textarea' || campo.colSpan === 2 ? 'sm:col-span-2' : undefined}
  >
    {campo.tipo === 'textarea' ? (
      <Textarea
        id={campo.nome}
        rows={3}
        value={form[campo.nome] ?? ''}
        placeholder={campo.placeholder}
        maxLength={campo.maxLength}
        aria-invalid={campo.nome in erros || undefined}
        onChange={(e) => {
          limparCampo(campo.nome);
          setForm((f) => ({ ...f, [campo.nome]: e.target.value }));
        }}
      />
    ) : campo.tipo === 'select' ? (
      <SelectNative
        id={campo.nome}
        value={form[campo.nome] ?? ''}
        aria-invalid={campo.nome in erros || undefined}
        onChange={(e) => {
          limparCampo(campo.nome);
          setForm((f) => ({ ...f, [campo.nome]: e.target.value }));
        }}
      >
        {campo.placeholder && <option value="">{campo.placeholder}</option>}
        {(campo.opcoes ?? []).map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </SelectNative>
    ) : (
      <Input
        id={campo.nome}
        type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'data' ? 'date' : 'text'}
        value={form[campo.nome] ?? ''}
        placeholder={campo.placeholder}
        maxLength={campo.maxLength}
        aria-invalid={campo.nome in erros || undefined}
        onChange={(e) => {
          const valor = campo.mascara ? campo.mascara(e.target.value) : e.target.value;
          limparCampo(campo.nome);
          setForm((f) => ({ ...f, [campo.nome]: valor }));
        }}
        className={campo.monoespacado ? 'font-data' : undefined}
      />
    )}
  </FormField>
))}
```

(`aria-invalid={... || undefined}` evita `aria-invalid="false"` — a classe CSS reage à presença do atributo.)

- [ ] **Step 7: Verificar manualmente** — subir o app (`docker compose up -d` na raiz, frontend em `http://localhost:4000`), abrir Motoristas → Novo Motorista → Salvar vazio: `nome` e `documento` devem ficar com borda vermelha e "Campo obrigatório." abaixo; digitar em `nome` deve limpar o destaque só dele.

- [ ] **Step 8:** `cd app/frontend && npm run lint && npm run type-check && npm run test` + Commit — `feat(validacao): erro por campo e mascara declarativa no CadastroTabelaDrawer`

---

### Tarefa 7: Motoristas, Caminhões e Representantes — máscaras e limites declarados

**Files:**
- Modify: `app/frontend/src/app/(admin)/cadastros/motoristas/motoristas-client.tsx`
- Modify: `app/frontend/src/app/(admin)/cadastros/caminhoes/caminhoes-client.tsx`
- Modify: `app/frontend/src/app/(admin)/cadastros/representantes/representantes-client.tsx`

**Interfaces:**
- Consumes: props `mascara`/`maxLength` de `CampoCadastro` (Tarefa 6); `mascararPlaca`, `mascararTelefone` de `@/lib/masks` (Tarefa 4).

Só edição das arrays `campos={[...]}` — nenhuma lógica nova. Limites copiados dos DTOs (`motorista.dto.ts`, `caminhao-cadastro.dto.ts`, `representante.dto.ts`, conferidos em 2026-08-21):

- [ ] **Step 1: Motoristas** (`import { mascararTelefone } from '@/lib/masks';`):
  | campo | acréscimo |
  |---|---|
  | `nome` | `maxLength: 200` |
  | `documento` | `maxLength: 100` — **sem máscara** (aceita CNH, não é CPF; decisão D7) |
  | `telefone` | `mascara: mascararTelefone` |
  | `celular` | `mascara: mascararTelefone` |
  | `rg` | `maxLength: 30` |
  | `carteiraProfissional` | `maxLength: 50` |
  | `nacionalidade` | `maxLength: 50` |
  | `carteiraHabilitacao` | `maxLength: 30` |
  | `contato` | `maxLength: 200` |
  | `email` | `maxLength: 200` |

- [ ] **Step 2: Caminhões** (`import { mascararPlaca } from '@/lib/masks';`):
  | campo | acréscimo |
  |---|---|
  | `placa` | `mascara: mascararPlaca` |
  | `descricao` | `maxLength: 200` |
  | `nomeProprietario` | `maxLength: 200` |
  | `fabricante` | `maxLength: 100` |
  | `modelo` | `maxLength: 100` |
  | `cor` | `maxLength: 50` |
  | `chassi` | `maxLength: 50`, `mascara: (v) => v.toUpperCase()` |
  | `certificadoNumero` | `maxLength: 50` |
  | `certificadoCidade` | `maxLength: 100` |
  | `certificadoUf` | `maxLength: 2`, `mascara: (v) => v.toUpperCase()` |
  | `numeroSeguro` | `maxLength: 50` |

  Campos `tipo: 'numero'` (capacidades, anos, tara, km) ficam como estão — `maxLength` não se aplica a `<input type="number">` e o range é validado pelo backend.

- [ ] **Step 3: Representantes:** `codigo` `maxLength: 50`, `nome` `maxLength: 200`, `tipoCanal` `maxLength: 100`, `contato` `maxLength: 200`. Sem máscaras (campos livres).

- [ ] **Step 4: Verificar manualmente** — Caminhões → Novo: digitar `abc1d23` na placa deve virar `ABC1D23` e travar em 7 caracteres; salvar com placa `XX` deve destacar o campo com a mensagem do backend ("Placa inválida. Use o formato ABC-1D23").

- [ ] **Step 5:** `npm run lint && npm run type-check && npm run test` + Commit — `feat(validacao): mascaras e maxLength em motoristas, caminhoes e representantes`

---

### Tarefa 8: `CadastroMasterDetail` — erro por campo, seções/abas e máscara (cobre Fornecedores)

**Files:**
- Modify: `app/frontend/src/components/cadastro-master-detail.tsx`

**Interfaces:**
- Consumes: `detalharErro`, `extrairMensagemErro` (Tarefa 2), `useErrosPorCampo` (Tarefa 2), `TabsTrigger temErro` (Tarefa 3), props `mascara`/`maxLength` de `CampoConfig` (Tarefa 5), `chaveFormulario(campo)` (já existe no arquivo, linha 46 — é a mesma convenção `jsonCampo.nome`).
- Contexto: hoje só Fornecedores usa este componente, no layout `secoes` (duas colunas sempre visíveis — sem aba para destacar). O branch `usaAbas` é código vivo para configs futuras; o suporte a `temErro` custa 4 linhas e completa o padrão.

- [ ] **Step 1: Imports e estado** — adicionar `import { detalharErro, extrairMensagemErro } from '@/lib/error-message';` e `import { useErrosPorCampo } from '@/lib/use-erros-campo';`. No corpo do componente: `const { erros, setErros, limparCampo, limparTudo } = useErrosPorCampo();`

- [ ] **Step 2: `handleSalvar`** (linha ~296) — trocar:

```ts
if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  setErro((body as { message?: string }).message ?? 'Falha ao salvar');
  return;
}
```

por:

```ts
if (!res.ok) {
  const { mensagem, porCampo } = await detalharErro(res, 'Falha ao salvar');
  setErro(mensagem);
  setErros(porCampo);
  if (usaAbas) {
    const abaComErro = abasPresentes.find((aba) =>
      (camposPorAba.get(aba) ?? []).some((c) => chaveFormulario(c) in porCampo),
    );
    if (abaComErro) setAbaAtiva(abaComErro);
  }
  return;
}
```

E no início de `handleSalvar` (junto de `setErro(null)`), adicionar `limparTudo();`. Também chamar `limparTudo();` em `carregarDetalhe` (o erro não pode "vazar" ao trocar de registro).

- [ ] **Step 3: `carregarLista` e `carregarDetalhe`** — trocar as duas extrações inline
`setErro((body as { message?: string }).message ?? 'Erro ao carregar lista')` / `'Erro ao carregar registro'` por
`setErro(extrairMensagemErro(body, 'Erro ao carregar lista'))` / `setErro(extrairMensagemErro(body, 'Erro ao carregar registro'))` (o `body` já é lido na linha anterior em ambos).

- [ ] **Step 4: `CampoFormulario`** (linha ~102) — adicionar prop `erro?: string` e aplicar máscara/limite/limpeza:

```tsx
function CampoFormulario({
  campo,
  form,
  podeGerenciar,
  erro,
  onChange,
}: {
  campo: CampoConfig;
  form: FormState;
  podeGerenciar: boolean;
  erro?: string;
  onChange: (chave: string, valor: FormValor) => void;
}) {
  const chave = chaveFormulario(campo);
  const desabilitado = !podeGerenciar || campo.nome === 'codigo';
  const valor = form[chave];
  const invalido = erro ? true : undefined;
  // ... branch checkbox inalterado ...
```

No branch não-checkbox, passar `error={erro}` ao `FormField` e, em cada controle:
- `SelectNative`: `aria-invalid={invalido}`;
- `Textarea`: `aria-invalid={invalido}` e `maxLength={campo.maxLength}`;
- `Input`: `aria-invalid={invalido}`, `maxLength={campo.maxLength}` e
  `onChange={(e) => onChange(chave, campo.mascara ? campo.mascara(e.target.value) : e.target.value)}`.

- [ ] **Step 5: `handleCampoChange` e `renderCampos`** — em `handleCampoChange`, adicionar `limparCampo(chave);` antes do `setForm`. Em `renderCampos`, passar `erro={erros[chaveFormulario(campo)]}` a cada `CampoFormulario`.

- [ ] **Step 6: Abas com erro** — no bloco `usaAbas` (linha ~465), trocar o `TabsTrigger` por:

```tsx
<TabsTrigger
  key={aba}
  value={aba}
  temErro={(camposPorAba.get(aba) ?? []).some((c) => chaveFormulario(c) in erros)}
>
  {ABA_LABELS[aba]}
</TabsTrigger>
```

- [ ] **Step 7: Verificar manualmente** — `/cadastros/fornecedores`: apagar o CNPJ e salvar → campo "CNPJ/CPF" com borda vermelha e a mensagem do backend abaixo; digitar no campo deve reformatar com máscara (`11.222.333/0001-81`) e limpar o destaque.

- [ ] **Step 8:** `npm run lint && npm run type-check && npm run test` + Commit — `feat(validacao): erro por campo, abas e mascara no CadastroMasterDetail`

---

### Tarefa 9: `CadastroForm` — registro aninhado, erro do servidor por campo e máscara (cobre `/novo` e `/editar` de Clientes, Fornecedores, Itens de Compra e Itens Comerciais)

**Files:**
- Modify: `app/frontend/src/components/cadastro-form.tsx`

**Interfaces:**
- Consumes: `extrairErrosPorCampo`, `extrairMensagemErro` (Tarefa 2), props `mascara`/`maxLength` de `CampoConfig` (Tarefa 5).
- Contexto (bug corrigido de raiz — decisão D5): hoje o form registra campos com `jsonCampo` pelo nome plano (`cep` em vez de `dadosFiscaisJson.cep`). Consequências atuais: o POST envia os campos JSON no nível raiz e o Zod do backend os **descarta silenciosamente**, e o `defaultValues` aninhado do modo edição nunca preenche esses campos. Registrar pelo caminho aninhado corrige o payload, o preenchimento na edição e alinha as chaves com o `path` dos issues do servidor — três problemas, uma mudança.

- [ ] **Step 1: Chave aninhada + hooks extras** — no topo do map de campos, calcular a chave uma vez e usá-la em `register`/`htmlFor`/`Controller name`:

```tsx
const chave = campo.jsonCampo ? `${campo.jsonCampo}.${campo.nome}` : campo.nome;
```

No destructuring do `useForm`, adicionar `setError`, `setValue`, `getFieldState` e trocar `formState: { errors, isSubmitting }` por `formState` completo (mantendo `const { errors, isSubmitting } = formState;` na linha seguinte). O erro por campo passa a ser lido com suporte a caminho aninhado:

```tsx
const erroCampo = getFieldState(chave, formState).error?.message;
```

Substituir **todas** as ocorrências de `campo.nome` usadas como nome de registro (`register(campo.nome)`, `Controller name={campo.nome}`, `htmlFor={campo.nome}`, `id={campo.nome}`) por `chave`.

- [ ] **Step 2: Payload** — com o registro aninhado, `valores` já sai no shape `{ dadosFiscaisJson: { cep: ... } }`. A limpeza de vazios atual (`if (payload[chave] === '') delete payload[chave]`) só olha o nível raiz; estendê-la um nível:

```ts
const payload: Record<string, unknown> = { ...valores };
for (const k of Object.keys(payload)) {
  const v = payload[k];
  if (v === '') {
    delete payload[k];
  } else if (v && typeof v === 'object' && !Array.isArray(v)) {
    const obj = { ...(v as Record<string, unknown>) };
    for (const kj of Object.keys(obj)) {
      if (obj[kj] === '') delete obj[kj];
    }
    payload[k] = obj;
  }
}
```

- [ ] **Step 3: Erro do servidor por campo** — trocar o bloco (linhas ~55-59):

```ts
if (!res.ok) {
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  setErro(body.message ?? 'Falha ao salvar');
  return;
}
```

por:

```ts
if (!res.ok) {
  const body: unknown = await res.json().catch(() => null);
  // Erros que só o backend conhece (documento duplicado, regra de negócio) ancorados no campo.
  for (const [chave, mensagem] of Object.entries(extrairErrosPorCampo(body))) {
    setError(chave, { type: 'server', message: mensagem });
  }
  setErro(extrairMensagemErro(body, 'Falha ao salvar'));
  return;
}
```

(imports: `import { extrairErrosPorCampo, extrairMensagemErro } from '@/lib/error-message';`)

- [ ] **Step 4: `aria-invalid`, máscara e maxLength nos controles** — no `Input` (branch final):

```tsx
<Input
  id={chave}
  type={campo.tipo === 'number' ? 'number' : 'text'}
  aria-label={campo.rotulo}
  placeholder={campo.placeholder}
  maxLength={campo.maxLength}
  aria-invalid={erroCampo ? true : undefined}
  {...register(chave, campo.mascara
    ? {
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          setValue(chave, campo.mascara!(e.target.value), { shouldDirty: true });
        },
      }
    : undefined)}
/>
```

No `SelectNative`, adicionar `aria-invalid={erroCampo ? true : undefined}`. `Checkbox` e `DatePickerField` ficam como estão (sem estado de erro visual — não há caso de validação para eles nestes cadastros).

- [ ] **Step 5: Verificar manualmente** —
  1. `/cadastros/clientes/novo`: CNPJ ganha máscara ao digitar; submeter vazio mostra mensagens client-side em PT-BR sob cada campo obrigatório.
  2. Criar cliente com CNPJ de outro cliente existente: o erro de duplicidade do backend deve aparecer ancorado (banner + campo se o backend devolver issue com path).
  3. Preencher CEP/endereço e salvar; reabrir em `/cadastros/clientes/<id>/editar` e confirmar que os campos de endereço agora **persistem e reaparecem** (regressão do bug D5).

- [ ] **Step 6:** `npm run lint && npm run type-check && npm run test` + Commit — `fix(validacao): CadastroForm com registro aninhado, erro do servidor por campo e mascara`

---

## PARTE 3 — TELAS BESPOKE (Nível 1)

> Padrão comum destas tarefas: (1) `detalharErro` no catch do submit, (2) `useErrosPorCampo` como estado, (3) `error=`/`aria-invalid` por campo usando a chave `issue.path.join('.')`, (4) `TabsTrigger temErro` + salto para a primeira aba com erro quando a tela tem abas, (5) `limparTudo()` ao abrir/trocar registro e `limparCampo(chave)` no onChange de cada campo, (6) `maxLength`/máscara conforme a tabela da tarefa.

### Tarefa 10: Clientes (`app/frontend/src/app/(admin)/comercial/clientes/clientes-client.tsx`)

A tela já usa `mensagemDeErro` e as máscaras de CNPJ/CEP/telefone (adicionadas em 2026-08-21). Falta o destaque por campo/aba.

**Files:**
- Modify: `app/frontend/src/app/(admin)/comercial/clientes/clientes-client.tsx`

**Interfaces:**
- Consumes: `detalharErro`, `useErrosPorCampo`, `TabsTrigger temErro`.

**Mapa chave→aba** (as 4 abas ficam em `Tabs` na linha ~433; valores `gerais` | `fiscais` | `contatos` | `preferencias`). A regra é por prefixo — cobre todos os campos sem enumerar um a um:

```ts
type AbaClientes = 'gerais' | 'fiscais' | 'contatos' | 'preferencias';

function abaDaChave(chave: string): AbaClientes {
  if (chave.startsWith('dadosFiscaisJson.')) return 'fiscais';
  if (chave.startsWith('dadosContatoJson.')) return 'contatos';
  if (chave.startsWith('preferenciasJson.')) return 'preferencias';
  return 'gerais'; // razaoSocial, nomeFantasia, documentoFiscal, codigo, representanteId, rotaId, prioridade, status
}
```

(Exceção a conferir no arquivo: se `observacoesOperacionais` for renderizado numa aba diferente de "gerais", adicionar um `if (chave === 'observacoesOperacionais') return '<aba real>';` antes do fallback.)

- [ ] **Step 1: Estado e abas controladas** — adicionar `const { erros, setErros, limparCampo, limparTudo } = useErrosPorCampo();`. O `Tabs` hoje usa `defaultValue="gerais"` (não controlado); trocar para controlado: `const [abaAtiva, setAbaAtiva] = useState<AbaClientes>('gerais');` e `<Tabs value={abaAtiva} onValueChange={(v) => setAbaAtiva(v as AbaClientes)}>`.

- [ ] **Step 2: Submit** — em `salvar` (linhas ~253-293), trocar:

```ts
if (!response.ok) {
  setErro(await mensagemDeErro(response, 'Falha ao salvar cliente'));
  return;
}
```

por:

```ts
if (!response.ok) {
  const { mensagem, porCampo } = await detalharErro(response, 'Falha ao salvar cliente');
  setErro(mensagem);
  setErros(porCampo);
  const primeiraChave = Object.keys(porCampo)[0];
  if (primeiraChave) setAbaAtiva(abaDaChave(primeiraChave));
  return;
}
```

Chamar `limparTudo()` junto de `setErro(null)` no início de `salvar` e também ao trocar de cliente selecionado / abrir "Novo cliente" (onde o `form` é resetado).

- [ ] **Step 3: Campos** — para cada campo renderizado, passar `error={erros[chave]}` ao `FormField` e `aria-invalid={chave in erros || undefined}` ao controle, onde `chave` é: nome do campo para os de topo (`razaoSocial`, `documentoFiscal`, `codigo`, `nomeFantasia`, `representanteId`, `rotaId`, `prioridade`, `observacoesOperacionais`) e `dadosFiscaisJson.<nome>` / `dadosContatoJson.<nome>` / `preferenciasJson.<nome>` para os aninhados (a tela já organiza o estado nesses três objetos — usar o mesmo nome do estado). Nos `onChange` de cada campo, chamar `limparCampo(chave)`. Para os `Select` Radix (se houver): `aria-invalid` vai no `SelectTrigger`.

- [ ] **Step 4: Abas com erro** — nos 4 `TabsTrigger`:

```tsx
<TabsTrigger value="gerais" temErro={Object.keys(erros).some((c) => abaDaChave(c) === 'gerais')}>
```

(idem para `fiscais`, `contatos`, `preferencias` — extrair `const abasComErro = new Set(Object.keys(erros).map(abaDaChave));` antes do JSX e usar `temErro={abasComErro.has('gerais')}` para não varrer 4×).

- [ ] **Step 5: `maxLength`** (limites de `cliente.dto.ts`/`json-cadastros.dto.ts`): `codigo` 50, `razaoSocial` 200, `nomeFantasia` 200, `dadosFiscaisJson.logradouro` 200, `.numero` 20, `.complemento` 100, `.bairro` 100, `.cidade` 100, `.uf` 2, `.inscricaoEstadual` 30, `.inscricaoMunicipal` 30, `dadosContatoJson.nome` 200, `.cargo` 100, `preferenciasJson.perfilGordura` 50, observações (`observacoesOperacionais` sem max no DTO — não aplicar; `preferenciasJson.observacaoBalanca` 500). Campos já mascarados (documento, cep, telefones, whatsapp) não recebem `maxLength`.

- [ ] **Step 6: Verificar manualmente** — reproduzir o caso reportado: CNPJ `11.111.111/1111-11` → salvar. Esperado: campo CNPJ com borda vermelha, mensagem "CNPJ ou CPF inválido — confira o número digitado." abaixo (texto final vem da Tarefa 16; antes dela, a mensagem atual do DTO), aba "Dados Gerais" com ponto vermelho, banner com a mesma mensagem. Depois: apagar o CEP e digitar `9` → salvar → tela deve **pular** para a aba "Dados Fiscais & Endereço" com o campo CEP destacado.

- [ ] **Step 7:** `npm run lint && npm run type-check && npm run test` + Commit — `feat(validacao): destaque de campo e aba em Clientes`

---

### Tarefa 11: Produtos (`app/frontend/src/app/(admin)/cadastros/produtos/produtos-client.tsx`)

**Files:**
- Modify: `app/frontend/src/app/(admin)/cadastros/produtos/produtos-client.tsx`

**Interfaces:**
- Consumes: `detalharErro`, `useErrosPorCampo`, `TabsTrigger temErro`.

Abas (linhas ~439-446): `gerais`, `comercial`, `operacional`, `estoque`, `fiscal`. O estado do form é plano (`ncm`, `cfop`...), mas o backend valida os fiscais aninhados — o path do issue vem como `atributosJson.fiscal.ncm`. Mapa explícito:

```ts
type AbaProdutos = 'gerais' | 'comercial' | 'operacional' | 'estoque' | 'fiscal';

/** Chave de erro (path do Zod no backend) por campo do formulário. */
const CHAVE_ERRO: Record<string, string> = {
  ncm: 'atributosJson.fiscal.ncm',
  cfop: 'atributosJson.fiscal.cfop',
  origemFiscal: 'atributosJson.fiscal.origemFiscal',
  cestOpcional: 'atributosJson.fiscal.cestOpcional',
  // demais campos: a chave é o próprio nome
};
const chaveDe = (campo: string) => CHAVE_ERRO[campo] ?? campo;

function abaDaChave(chave: string): AbaProdutos {
  if (chave.startsWith('atributosJson.fiscal.')) return 'fiscal';
  if (['unidadePreco', 'ativoVenda', 'ativoCompra'].includes(chave)) return 'comercial';
  if (chave === 'podeEstoque') return 'estoque';
  if (
    ['tipoOperacional', 'unidadePedido', 'exigePeso', 'passaBalanca', 'passaDesossa',
     'origemTransformacao', 'saidaTransformacao', 'observacoesOperacionais'].includes(chave)
  ) return 'operacional';
  return 'gerais'; // codigo, categoria, nome, nomeOperacional, status
}
```

- [ ] **Step 1: Submit** — em `salvar` (linhas ~244-277): (a) a pré-checagem manual atual (`if (!form.codigo.trim() || ...)`) passa a também marcar os campos: `setErros({ ...(form.codigo.trim() ? {} : { codigo: 'Campo obrigatório.' }), ...(form.nome.trim() ? {} : { nome: 'Campo obrigatório.' }), ...(form.unidadePedido.trim() ? {} : { unidadePedido: 'Campo obrigatório.' }) });` antes do `setErro(...)`/`return`; (b) trocar a extração ad-hoc:

```ts
if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  setErro((body as { message?: string }).message ?? 'Falha ao salvar produto');
  return;
}
```

por:

```ts
if (!res.ok) {
  const { mensagem, porCampo } = await detalharErro(res, 'Falha ao salvar produto');
  setErro(mensagem);
  setErros(porCampo);
  const primeiraChave = Object.keys(porCampo)[0];
  if (primeiraChave) setAbaAtiva(abaDaChave(primeiraChave));
  return;
}
```

(import: `detalharErro` de `@/lib/error-message`; `Tabs` vira controlado como na Tarefa 10.) `limparTudo()` ao abrir o drawer (novo ou edição).

- [ ] **Step 2: Campos** — a tela tem um setter central `setCampo` (linha ~279); adicionar `limparCampo(chaveDe(campo))` dentro dele. Em cada `FormField`/controle, `error={erros[chaveDe(nome)]}` + `aria-invalid={chaveDe(nome) in erros || undefined}`.

- [ ] **Step 3: Abas** — `const abasComErro = new Set(Object.keys(erros).map(abaDaChave));` e `temErro={abasComErro.has('gerais')}` etc. nos 5 `TabsTrigger`.

- [ ] **Step 4: `maxLength`** (de `produto.dto.ts`): `codigo` 50, `nome` 200, `nomeOperacional` 200, `categoria` 100, `unidadePedido` 30, `ncm` 10, `cfop` 6, `origemFiscal` 60, `cestOpcional` 10. **Sem máscaras** — não há campo percentual/moeda real nesta tela (decisão D2).

- [ ] **Step 5: Verificar manualmente** — Novo produto → preencher só o nome → salvar: `codigo` e `unidadePedido` destacados na aba "Gerais". Depois: NCM com 11 dígitos não deve ser digitável (trava em 10).

- [ ] **Step 6:** `npm run lint && npm run type-check && npm run test` + Commit — `feat(validacao): destaque de campo e aba em Produtos`

---

### Tarefa 12: Rotas (`app/frontend/src/app/(admin)/cadastros/rotas/rotas-client.tsx`)

**Files:**
- Modify: `app/frontend/src/app/(admin)/cadastros/rotas/rotas-client.tsx`

**Interfaces:**
- Consumes: `detalharErro`, `useErrosPorCampo`. **Sem abas** nesta tela (o rascunho anterior estava errado) — não usar Tarefa 3 aqui.

Chaves de erro: campos de topo usam o próprio nome (`codigo`, `nome`, `regiao`, `representantePadrao`, `caminhaoPadrao`, `motoristaPadrao`, `observacoes`); a lista dinâmica de paradas usa índice — o backend valida `paradas[i].descricao`, então o path vem `paradas.2.descricao`.

- [ ] **Step 1: Submit** — em `salvar` (linhas ~162-202): (a) as duas pré-checagens manuais passam a marcar campos —

```ts
if (!form.codigo.trim() || !form.nome.trim()) {
  setErros({
    ...(form.codigo.trim() ? {} : { codigo: 'Campo obrigatório.' }),
    ...(form.nome.trim() ? {} : { nome: 'Campo obrigatório.' }),
  });
  setErro('Preencha código e nome da rota.');
  return;
}
const paradasVazias = form.paradas
  .map((p, i) => (p.descricao.trim() === '' ? i : -1))
  .filter((i) => i >= 0);
if (paradasVazias.length > 0) {
  setErros(Object.fromEntries(paradasVazias.map((i) => [`paradas.${i}.descricao`, 'Campo obrigatório.'])));
  setErro('Informe a descrição de todas as paradas.');
  return;
}
```

(b) trocar a extração ad-hoc do `!res.ok` por `const { mensagem, porCampo } = await detalharErro(res, 'Falha ao salvar rota'); setErro(mensagem); setErros(porCampo); return;`. `limparTudo()` ao selecionar outra rota e ao entrar em "modo novo".

- [ ] **Step 2: Campos de topo** — `error={erros[nome]}` no `FormField`, `aria-invalid` no controle, `limparCampo(nome)` no onChange.

- [ ] **Step 3: Linhas de parada** — no render de cada parada (índice `i`), no `Input` da descrição: `aria-invalid={`paradas.${i}.descricao` in erros || undefined}` e, abaixo do input, quando houver erro: `<p role="alert" className="text-[11px] font-medium text-danger-fg">{erros[`paradas.${i}.descricao`]}</p>`. No onChange da descrição, `limparCampo(`paradas.${i}.descricao`)`. Atenção: remover/reordenar paradas invalida os índices do mapa — chamar `limparTudo()` também ao adicionar/remover/mover parada (mais simples e correto que reindexar).

- [ ] **Step 4: `maxLength`** (de `rota.dto.ts`): `codigo` 50, `nome` 200, `regiao` 100, `representantePadrao` 200, `caminhaoPadrao` 100, `motoristaPadrao` 200, descrição de parada 120.

- [ ] **Step 5: Verificar manualmente** — Nova rota com 2 paradas, segunda vazia → salvar: só a segunda parada destacada com "Campo obrigatório.".

- [ ] **Step 6:** `npm run lint && npm run type-check && npm run test` + Commit — `feat(validacao): destaque de campo em Rotas, incluindo paradas por índice`

---

### Tarefa 13: Compras — modal de edição (`app/frontend/src/app/(admin)/gestao/compras/compras-edit-modal.tsx`)

**Files:**
- Modify: `app/frontend/src/app/(admin)/gestao/compras/compras-edit-modal.tsx`

**Interfaces:**
- Consumes: `detalharErro` (o arquivo já importa `mensagemDeErro` — trocar o import). Modal com um `Input type="number"` **por item** (linhas ~128-141); o erro precisa ancorar no item certo.

- [ ] **Step 1: Estado por item** — `const [errosPorItem, setErrosPorItem] = useState<Record<string, string>>({});` (chave = `item.id`). Limpar (`{}`) ao abrir o modal e no início de `salvar`.

- [ ] **Step 2: Loop de salvamento** — no `salvar` (linhas ~80-117), o branch 409 (`IMPACTO_CONFIRMACAO_NECESSARIA`) **não muda**. Trocar apenas:

```ts
if (!res.ok) throw new Error(await mensagemDeErro(res));
```

por:

```ts
if (!res.ok) {
  const { mensagem, porCampo } = await detalharErro(res, 'Erro ao salvar');
  setErrosPorItem((m) => ({ ...m, [item.id]: porCampo.quantidadeComprada ?? mensagem }));
  setErro(mensagem);
  setSalvando(false);
  return;
}
```

(o único campo do PATCH é `quantidadeComprada`; se o issue não trouxer path, cai na mensagem geral ancorada no item mesmo assim).

- [ ] **Step 3: Input por item** — `aria-invalid={item.id in errosPorItem || undefined}` e, sob o input com erro, `<p role="alert" className="text-[11px] font-medium text-danger-fg">{errosPorItem[item.id]}</p>`. No onChange da quantidade, remover a chave: `setErrosPorItem(({ [item.id]: _r, ...resto }) => resto);`.

- [ ] **Step 4: Verificar manualmente** — editar uma compra, colocar quantidade negativa num item → salvar: o input daquele item fica vermelho com a mensagem, os demais intactos; fluxo de déficit (409) continua funcionando.

- [ ] **Step 5:** `npm run lint && npm run type-check && npm run test` + Commit — `feat(validacao): erro ancorado por item no modal de edicao de compras`

---

### Tarefa 14: Admin — Usuários (`app/frontend/src/app/(admin)/admin/usuarios/usuarios-client.tsx`)

**Files:**
- Modify: `app/frontend/src/app/(admin)/admin/usuarios/usuarios-client.tsx`

**Interfaces:**
- Consumes: `detalharErro` (o arquivo já importa `extrairMensagemErro` — manter e adicionar), `useErrosPorCampo`.
- Contexto: `salvar` (linhas ~110-176) faz até 3 fetches sequenciais (PATCH dados, PUT perfis, PUT representantes) no modo edição, e 1 POST no modo criação. Campos do POST: `nome` (min 2, max 200), `email` (`.email()`), `password` (min 8), `perfis`, `representantes`.

- [ ] **Step 1: Estado** — `const { erros, setErros, limparCampo, limparTudo } = useErrosPorCampo();`; `limparTudo()` ao abrir o Sheet.

- [ ] **Step 2: Fetches** — nos 4 pontos que hoje fazem `setErro(extrairMensagemErro(data, '...'))` (linhas ~123, 133, 149, 165), como o `data`/`res` está disponível, padronizar com `detalharErro`:

```ts
if (!res.ok) {
  const { mensagem, porCampo } = await detalharErro(res, 'Falha ao criar usuário');
  setErro(mensagem);
  setErros(porCampo);
  return;
}
```

(usar o fallback específico de cada ponto: `'Falha ao atualizar'`, `'Falha ao atualizar perfis'`, `'Falha ao atualizar representantes'`, `'Falha ao criar usuário'`). Nota: o `superRefine` de representantes duplicados emite issue sem path — a mensagem aparece no banner, comportamento correto.

- [ ] **Step 3: Campos** — nos `FormField` de nome/e-mail/senha (linhas ~360-390): `error={erros.nome}` / `erros.email` / `erros.password`, `aria-invalid={'nome' in erros || undefined}` etc. nos `Input`s, `limparCampo('nome')` etc. nos onChange. Garantir `type="email"` no input de e-mail e `maxLength={200}` em nome e e-mail (limites de `create-usuario.dto.ts`/`update-usuario.dto.ts`). Erro em `perfis` (chave `perfis`): renderizar a mensagem sob o grupo de checkboxes de perfis com o mesmo `<p role="alert">` padrão.

- [ ] **Step 4: Verificar manualmente** — Novo usuário com e-mail `abc` e senha `123` → salvar: e-mail e senha destacados com mensagens PT-BR (do mapa da Tarefa 1: "E-mail inválido." / "Deve ter pelo menos 8 caracteres.").

- [ ] **Step 5:** `npm run lint && npm run type-check && npm run test` + Commit — `feat(validacao): destaque de campo em Admin Usuarios`

Nota de escopo: **Perfis** e **Parâmetros** já usam `mensagemDeErro` via toast e não têm formulário de texto relevante (toggles/chips e 1 input de valor por card) — conferidos em 2026-08-21, nada a fazer. **Modelos de Etiqueta** idem (decisão D4).

---

### Tarefa 15: Varredura final dos cadastros — Regras de Transformação

**Files:**
- Modify: `app/frontend/src/app/(admin)/cadastros/regras-transformacao/regras-transformacao-client.tsx`

A tela é somente leitura (decisão D3) — resta padronizar a extração de erro do `carregar()` (linhas ~74-80):

- [ ] **Step 1:** trocar:

```ts
if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  setErro((body as { message?: string }).message ?? 'Erro ao carregar regras');
  setRegras([]);
  return;
}
```

por:

```ts
if (!res.ok) {
  setErro(await mensagemDeErro(res, 'Erro ao carregar regras'));
  setRegras([]);
  return;
}
```

(import: `import { mensagemDeErro } from '@/lib/error-message';`)

- [ ] **Step 2:** `npm run lint && npm run type-check && npm run test` + Commit — `fix(validacao): extracao de erro padronizada em Regras de Transformacao`

---

## PARTE 4 — CURADORIA DAS MENSAGENS DO BACKEND

### Tarefa 16: De-para das mensagens customizadas técnicas

**Files:** (um `Edit` por linha da tabela; caminhos sob `app/backend/src/modules/`)

Regra: remover nome de campo em camelCase (a tela agora ancora a mensagem no próprio campo) e códigos internos (RF-xx viram comentário de código na mesma linha). **Não** mudar nenhuma condição de validação — só o texto.

- [ ] **Step 1: Aplicar a tabela** (strings exatas, `grep -rn "<antiga>"` para localizar todas as ocorrências):

| Arquivo(s) | Mensagem atual | Nova mensagem |
|---|---|---|
| `cadastros/clientes/dto/cliente.dto.ts`, `cadastros/fornecedores/dto/fornecedor.dto.ts` | `documentoFiscal é obrigatório` | `CNPJ ou CPF é obrigatório.` |
| idem | `documentoFiscal inválido (CNPJ ou CPF com dígito verificador inválido)` | `CNPJ ou CPF inválido — confira o número digitado.` |
| `cadastros/regras-desdobramento/dto/regra-desdobramento.dto.ts` | `itemCompraId inválido` | `Selecione um item de compra válido.` |
| idem | `itemComercialId inválido` | `Selecione um item comercial válido.` |
| idem (2 ocorrências) | `fatorQuantidade deve ser maior que zero` | `O fator de quantidade deve ser maior que zero.` |
| idem (2 ocorrências) | `vigenciaFim deve ser posterior a vigenciaInicio` | `O fim da vigência deve ser posterior ao início.` |
| `comercial/precos/dto/tabela-preco.dto.ts`, `frota/dto/caminhao-cadastro.dto.ts`, `frota/dto/motorista.dto.ts` | `data deve ser YYYY-MM-DD` | `Data inválida — use o formato AAAA-MM-DD.` |
| `comercial/*/dto/*` (compra-programada, disponibilidade, espelho, pedido) | `dataOperacao deve ser YYYY-MM-DD` | `Data da operação inválida — use o formato AAAA-MM-DD.` |
| `comercial/pedidos/dto/pedido.dto.ts` | `dataEntrega deve ser YYYY-MM-DD` | `Data de entrega inválida — use o formato AAAA-MM-DD.` |
| `comercial/pedidos/dto/pedido.dto.ts` | `item comercial duplicado no mesmo pedido` | `Item comercial duplicado no mesmo pedido.` |
| `gestao/overbooking/dto/overbooking.dto.ts` (ou caminho equivalente) | `motivo (mín. 5 caracteres) é obrigatório ao cancelar` | `Informe o motivo do cancelamento (mínimo de 5 caracteres).` |
| `.../subitem.dto.ts`, `.../pesagem.dto.ts` | `pesoManual é obrigatório no modo manual assistido` | `Informe o peso manual no modo manual assistido.` |
| `.../subitem.dto.ts`, `.../pesagem.dto.ts` | `motivoDetalhe é obrigatório quando motivo = outro` | `Detalhe o motivo ao selecionar "Outro".` |
| `.../corte.dto.ts` | `motivoDetalhe é obrigatório para decisão humana` | `Detalhe o motivo da decisão.` |
| `.../subitem.dto.ts` | `classificação de divergência é obrigatória` | `Classificação de divergência é obrigatória.` |
| `.../associacao.dto.ts` | `classificação de divergência é obrigatória (RF-PS-22)` | `Classificação de divergência é obrigatória.` — mover `RF-PS-22` para comentário `// RF-PS-22` na linha |
| `.../associacao.dto.ts` | `motivo é obrigatório para destinar à sobra (RF-PS-21)` | `Informe o motivo para destinar à sobra.` — `// RF-PS-21` em comentário |
| `.../estoque.dto.ts` | `pedidoVendaItemId é obrigatório quando destino=pedido` | `Selecione o item do pedido ao destinar para pedido.` |
| `.../operacao.dto.ts` (2 ocorrências) | `de deve ser anterior ou igual a ate` | `A data inicial deve ser anterior ou igual à final.` |
| `.../expedicao.dto.ts` | `placa é obrigatória quando não há caminhão da frota vinculado` | `Informe a placa quando não houver caminhão da frota vinculado.` |
| `.../compra-programada.dto.ts` | `quantidade deve ter até 3 casas decimais` | `Quantidade deve ter até 3 casas decimais.` |

**Fora do de-para (manter como estão):** `Placa inválida. Use o formato ABC-1D23`, `Chave da NF-e deve ter 44 dígitos`, `Valor deve ser numérico com até 2 casas decimais`, `Representantes permitidos não podem conter duplicidades`, `Use apenas minúsculas, números e hífen` (já claras) e `Simulação inválida em "${par}"...` (parâmetro de query de ferramenta interna, não chega a formulário).

- [ ] **Step 2: Atualizar os testes que asserem os textos antigos** — `grep -rn "documentoFiscal inválido\|documentoFiscal é obrigatório\|deve ser YYYY-MM-DD\|RF-PS-2" app/backend/test` e trocar as expectativas pelas novas strings.

- [ ] **Step 3:** `cd app/backend && npm run lint && npm run type-check && npm run test:cov` — PASS, cobertura mantida.

- [ ] **Step 4: Commit** — `fix(validacao): curadoria PT-BR das mensagens de validacao do backend`

---

## PARTE 5 — NÍVEL 2: TELAS OPERACIONAIS (só mensagem clara)

> **Receitas** (aplicar por call-site; inventário completo com linhas conferidas em 2026-08-21):
>
> **Receita A** — extração inline com body descartável:
> `const body = await res.json().catch(() => ({})); setErro((body as { message?: string }).message ?? 'X')`
> → `setErro(await mensagemDeErro(res, 'X'))` (remove a linha do `body` se ninguém mais o usa).
>
> **Receita B** — body reutilizado (ex.: checagem de `codigo` de negócio): manter a leitura do body e trocar só a extração da mensagem por `extrairMensagemErro(body, 'X')`.
>
> **Receita C** — helper local que duplica a extração (`lerResposta`, `corpoDeErro`, `respostaJson`): manter o nome e a assinatura do helper, substituir o miolo de extração por `extrairMensagemErro`/`extrairCodigoErro`, **preservando** campos extras que o chamador usa (`codigo`, `dados`, listas de negócio).
>
> **Receita D** — `catch (e) { setErro(e instanceof Error ? e.message : 'X') }`: **não mexer** — o texto bom passa a vir do ponto que fez o `throw` (corrigido pelas receitas A-C) ou é erro de rede real.
>
> Em todos: import `import { extrairMensagemErro, mensagemDeErro } from '@/lib/error-message';` conforme o que a tela usar.

### Tarefa 17: Nível 2 — Comercial

**Files:**
- Modify: `app/frontend/src/app/(admin)/comercial/pedidos/pedidos-client.tsx` — helper `lerResposta` (linha ~63: `throw new Error((JSON.parse(body) as { message?: string }).message ?? body)`) → Receita C: `throw new Error(extrairMensagemErro(JSON.parse(body), body))` com try/catch de parse preservado.
- Modify: `app/frontend/src/app/(admin)/comercial/pedidos/pedido-editor.tsx` — helper `corpoDeErro` (linhas ~76-91) → Receita C: o helper devolve `{ texto, ... }`; trocar a montagem do `texto` por `extrairMensagemErro(dados, fallback)`, preservando os demais campos devolvidos. Os 5 call-sites (`setErro((await corpoDeErro(...)).texto)`, linhas ~161, 196, 357, 379, 388) não mudam.
- Modify: `app/frontend/src/app/(admin)/comercial/disponibilidade/page.tsx` — helper local (linha ~47) → Receita C.
- Modify: `app/frontend/src/app/(admin)/comercial/espelho/espelho-client.tsx` — helper local (linha ~60) → Receita C.
- Modify: `app/frontend/src/app/(admin)/comercial/tabela-precos/tabela-precos-client.tsx` — `respostaJson` (linhas ~55-81) → Receita C: trocar a extração aninhada de `.message` por `extrairMensagemErro(dados, \`Falha HTTP ${response.status}\`)`, **preservando `error.dados`** (o fluxo `PRECOS_INCOMPLETOS` em `executar`, linhas ~194-196, depende dele).

- [ ] Aplicar as receitas acima; `npm run lint && npm run type-check && npm run test`; commit — `fix(validacao): extracao de erro padronizada no grupo Comercial`

### Tarefa 18: Nível 2 — Gestão

**Files:**
- Modify: `app/frontend/src/app/(admin)/gestao/compras/compras-client.tsx` — linhas ~226-236 (Receita B — o `body` é reutilizado para checar `codigo === 'IMPACTO_CONFIRMACAO_NECESSARIA'`; usar `extrairCodigoErro(body)` no lugar do cast e `extrairMensagemErro(body, 'Erro ao salvar item')` na mensagem), ~255-257 (`'Erro ao salvar compra'`), ~274-276 (`'Erro ao confirmar compra'`).
- Modify: `app/frontend/src/app/(admin)/gestao/operacoes/operacoes-client.tsx` — já importa `mensagemDeErro`; conferir os 4 pontos (linhas ~94, 123, 152, 170): onde o `setErro` vem de `catch` com `e.message`, verificar que o `throw` correspondente usa `mensagemDeErro`/`extrairMensagemErro`; corrigir os que não usam.
- Modify: `app/frontend/src/app/(admin)/gestao/overbooking/overbooking-client.tsx` — idem (linhas ~93, 124, 157, 173).
- Modify: `app/frontend/src/app/(admin)/gestao/relatorios/relatorios-client.tsx` — 5 pontos (linhas ~63, 76, 142, 151, 183): localizar os `throw`/`Promise.reject` de origem e aplicar Receita A/C.

- [ ] Aplicar; gates; commit — `fix(validacao): extracao de erro padronizada no grupo Gestao`

### Tarefa 19: Nível 2 — Recebimento

**Files:**
- Modify: `app/frontend/src/app/(admin)/recebimento/etiquetas/etiquetas-client.tsx` — Receita A nas linhas ~135, 153, 173.
- Modify: `app/frontend/src/app/(admin)/recebimento/pesagem-destinacao/pesagem-destinacao-client.tsx` — Receita A/B nas linhas ~208, 373, 478.
- Modify: `app/frontend/src/app/(admin)/recebimento/recebimento-carga/recebimento-carga-client.tsx` — **1373 linhas, 10 call-sites** (linhas ~274, 286, 429, 467, 492, 529, 568, 591, 613, 631), todos no padrão `(body as { message?: string }).message ?? '...'` → Receita A (ou B onde o body for reutilizado). Diff mecânico e repetitivo — manter cada fallback original.

- [ ] Aplicar; gates; commit — `fix(validacao): extracao de erro padronizada no grupo Recebimento`

### Tarefa 20: Nível 2 — Desossa

**Files:**
- Modify: `app/frontend/src/app/(admin)/desossa/dashboard/desossa-dashboard-client.tsx` — linhas ~371, 388-390 (Receita A).
- Modify: `app/frontend/src/app/(admin)/desossa/etiquetas/desossa-etiquetas-client.tsx` — linhas ~486-488, 508, 526 (Receita A).
- Modify: `app/frontend/src/app/(admin)/desossa/pesagem-destinacao/desossa-pesagem-client.tsx` — 7 call-sites (linhas ~318, 337-338, 352-353, 370, 599-600, 613, 631). Dois deles usam fallback `body.mensagem` além de `body.message` — preservar: `setErro(extrairMensagemErro(body, (body as { mensagem?: string }).mensagem ?? 'Falha ao carregar checklist'))`.

- [ ] Aplicar; gates; commit — `fix(validacao): extracao de erro padronizada no grupo Desossa`

### Tarefa 21: Nível 2 — Estoque

**Files:**
- Modify: `app/frontend/src/app/(admin)/estoque/ajustes/ajustes-client.tsx` — 3 pontos via catch (linhas ~172, 227, 245): localizar os `throw` de origem e aplicar Receita A/C.
- Modify: `app/frontend/src/app/(admin)/estoque/consulta/estoque-consulta-client.tsx` — **não é somente leitura** (tem POST de reimpressão de etiqueta): Receita A na linha ~315-316 (`setErroAcao(...)`); demais pontos são catch (Receita D — conferir os throws).
- Modify: `app/frontend/src/app/(admin)/estoque/entrada-itens/entrada-itens-client.tsx` — já usa `mensagemDeErro` na linha ~73; completar os outros 2 pontos (linhas ~64, 142) conferindo os throws de origem.

- [ ] Aplicar; gates; commit — `fix(validacao): extracao de erro padronizada no grupo Estoque`

### Tarefa 22: Nível 2 — Carga

**Files:**
- Modify: `app/frontend/src/app/(admin)/carga/conferencia/conferencia-client.tsx` — linhas ~202 (`bipMensagem`), 239, 262, 286, 296 (Receita A/B — o fallback de cada ponto é específico, manter: `'Falha na bipagem automática'`, `'Falha na conferência manual'`, `'Falha ao registrar divergência'`, `'Falha ao concluir conferência'`, `'Conferência concluída, mas o fechamento falhou'`).
- Modify: `app/frontend/src/app/(admin)/carga/enviar-faturamento/enviar-faturamento-client.tsx` — linha ~133.
- Modify: `app/frontend/src/app/(admin)/carga/planejamento/planejamento-client.tsx` — linhas ~179, 211, 230.

- [ ] Aplicar; gates; commit — `fix(validacao): extracao de erro padronizada no grupo Carga`

### Tarefa 23: Nível 2 — Faturamento

**Files:**
- Modify: `app/frontend/src/app/(admin)/faturamento/notas-xml/notas-xml-client.tsx` — linhas ~377, 394.
- Modify: `app/frontend/src/app/(admin)/faturamento/pre-faturamento/pre-faturamento-client.tsx` — bloco de extração aninhada nas linhas ~136-139 (Receita C) + linhas ~268, 324, 361, 389 (Receita A/B).
- Modify: `app/frontend/src/app/(admin)/faturamento/seguro-manual/seguro-manual-client.tsx` — linhas ~94, 112.
- Conferir (sem mudança esperada): `faturamento/liberacao/liberacao-client.tsx` já usa `extrairMensagemErro` corretamente (linha ~198).

- [ ] Aplicar; gates; commit — `fix(validacao): extracao de erro padronizada no grupo Faturamento`

---

## VERIFICAÇÃO FINAL (gate antes do PR)

- [ ] `cd app/backend && npm run lint && npm run type-check && npm run test:cov` — PASS, cobertura ≥80%.
- [ ] `cd app/frontend && npm run lint && npm run type-check && npm run test` — PASS.
- [ ] `docker compose up --build -d` na raiz (postgres + backend + frontend saudáveis) e validar manualmente no browser, um caso por padrão:
  - **Drawer** (Motoristas): salvar vazio → campos obrigatórios destacados.
  - **Master-detail** (Fornecedores): CNPJ inválido → campo destacado + máscara ao digitar.
  - **Form /novo** (Clientes): validação client-side PT-BR + campos de endereço persistindo após salvar/reabrir (regressão D5).
  - **Bespoke com abas** (Clientes e Produtos): erro em aba não visível → salto automático para a aba, ponto vermelho no `TabsTrigger`.
  - **Nível 2** (uma tela qualquer de cada grupo): erro de validação mostra texto PT-BR específico, nunca `"Validação falhou"` seco.
- [ ] `grep -rn '"Validação falhou"' app/frontend/src` — nenhuma tela exibe o literal cru (só o helper o traduz).
- [ ] Registrar **AD-12** em `docs/execucao/DECISOES.md`: adoção do mapa de erro Zod global PT-BR (`z.config({ customError })`), convenção de chave de campo `issue.path.join('.')`, e a divisão Nível 1 (cadastros: campo+aba+máscara) / Nível 2 (operacionais: só mensagem) desta onda, com as decisões D1–D8 desta spec como anexo.
