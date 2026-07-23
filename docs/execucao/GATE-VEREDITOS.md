# Vereditos de Gate — AlphaCarnes

> **Escritor único: Monitor. Append-only** — nunca editar/remover linhas anteriores.
> Formato: `| data-hora | onda | portão (1=plano, 2=PR, A=adversarial) | veredito (aprovado/ajustar/bloqueado) | evidência (link/comando) | feedback resumido |`
> Critérios: [`pipeline-execucao.md`](../governance/pipeline-execucao.md) §3–§4; princípios: [`constituicao.md`](../governance/constituicao.md).

| Data/hora | Onda | Portão | Veredito | Evidência | Feedback |
|---|---|---|---|---|---|
| 2026-07-23T09:56:36-03:00 | 0 | 2 | aprovado | PR [#10](https://github.com/sammuka/alpha-carnes/pull/10), head `72e2ac961b59e47ae1737b2d287f2134df53a7e4`, run `30008201248` | Monitor independente: 41/41 entradas, AD-03–AD-06, lock, plano literal, coverage ACMR/base SHA, gitleaks e Vercel exclusiva da landing aprovados sem ressalvas. |
| 2026-07-23T09:57:56-03:00 | 0 | A | aprovado | PR [#10](https://github.com/sammuka/alpha-carnes/pull/10), head `72e2ac961b59e47ae1737b2d287f2134df53a7e4`, squash `0f8491ff2141473b5b7e3cf784b9c878fce35549` | Segundo Monitor independente: testes adicionais de ownership/concorrência, pins, migrations, RBAC e limite de deploy confirmados; nenhum bloqueio. |
