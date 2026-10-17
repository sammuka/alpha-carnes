# E2E (Playwright)

## `npm run e2e:ci` — execução determinística (AD-41)

Um comando, da raiz ou de `app/frontend`, roda os specs contra um ambiente descartável:

```bash
npm run e2e:ci -- e2e/shell-ds.spec.ts e2e/e01-t01-empresas.spec.ts   # specs, -g, --trace... vão para o Playwright
npm run e2e:ci -- --no-build e2e/e01-t03-regras.spec.ts                # reaproveita dist/ e .next/
```

O que acontece, nesta ordem:

1. Cria um banco novo `alphacarnes_<timestamp>_<id>_e2e` clonado do template
   `alphacarnes_e2e_template_<hash>`. O hash cobre migrations, seeds e RBAC. Se o template não
   existe, o script migra, semeia e publica o template para a próxima execução.
2. Exporta `DATABASE_URL` do banco novo e os defaults de teste do CI (JWT, `NFSE_FAKE=1`,
   `HARDWARE_FAKE=1`, throttle 100/min, admin do seed). Uma variável já definida no ambiente
   prevalece. O script não lê `.env` nem ecoa segredos.
3. Backend: `npm run build` se `dist/` não existe (ou com `--build`), depois `node dist/main.js`
   numa porta livre. O script espera `/health` responder.
4. Frontend: `next build --webpack`, depois `next start` numa porta livre. O script espera `/login`
   responder. `next dev` não é usado.
5. Roda `playwright test` com `E2E_EXTERNAL=1`; nesse modo o `webServer` do config não sobe nada.
6. No `finally`, mata só os PIDs que o script criou e remove o banco da execução (o template fica).
   Também restaura `AGENTS.md` e `next-env.d.ts`, que o Next regrava. O código de saída é o do
   Playwright.

Flags: `--keep-db` (mantém o banco para inspeção), `--no-build`, `--build`,
`--port-backend <n>` e `--port-frontend <n>`. Variáveis: `E2E_PG_URL` (padrão
`postgres://alphacarnes:alphacarnes@localhost:15433/postgres`), `E2E_BACKEND_PORT` e
`E2E_FRONTEND_PORT`.

O `NEXT_PUBLIC_API_URL` fica embutido no build. Por isso, `--no-build` só funciona se o backend
subir na mesma porta do build anterior (`.next/e2e-ci.json`). O script tenta essa porta primeiro e,
se ela estiver ocupada, falha com uma mensagem clara.

Os specs de evidência (`shell-ds`, `capture-*`) regravam PNGs em `docs/evidencias/`. Descarte
essas mudanças com `git checkout -- docs/evidencias` quando não forem evidência nova.

## SQL nos specs

Todo acesso SQL passa por `helpers/banco.ts` (`executarSql`). A conexão vem de `DATABASE_URL` e o
helper recusa banco sem sufixo `_test`, `_e2e` ou `_e01_tNN`. Não há nome fixo de banco nem de
contêiner.
