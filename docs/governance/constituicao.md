# Constituição do Projeto AlphaCarnes

> **Versão:** 1.1.0 · **Status:** Vigente · **Ratificada em:** 2026-07-23 · **Emendada em:** 2026-08-25
> Documento de princípios **inegociáveis** do projeto. Em conflito com qualquer outro documento, prática ou preferência, **esta constituição prevalece** — exceto instrução direta e explícita do Quality Owner, registrada como emenda.
> Aplicada nos gates: todo plano (Portão 1) e todo PR (Portão 2) são auditados contra os princípios abaixo, citados por número. Ver [`pipeline-execucao.md`](pipeline-execucao.md).

---

## Princípio I — Fidelidade absoluta ao protótipo validado (NÃO-NEGOCIÁVEL)

O protótipo `F:\Projetos\alpha-carnes-prototipo`, branch `feature/completude-v1.1`, é a **fonte de verdade de UI/UX com prioridade zero**. Foi validado com o usuário final e não é uma sugestão — é o contrato visual e de interação do produto.

1. **Tudo idêntico ao prototipado:** componentes, layout de telas, hierarquia do menu (9 grupos, ordem e rótulos), fontes (Inter 400/500/600/700), cores (paleta do protótipo: navy `#265389`, hover `#1E4070`, blue-mid `#3B7FD4`, fundo `#F5F7FA`, sidebar em gradiente `#1E3A5F → #1B4E9B`, status `#18A84A`/`#F5B019`/`#FC5241`/`#3B7FD4`/`#7C3AED`, badge Provisório `#FEF3C7`/`#92400E`), espaçamentos, modais, abas, estados visuais, microcopy e fluxos de navegação.
2. **Únicas alterações permitidas:** (a) remoção de textos que existem apenas por ser protótipo (ex.: "SIMULAR PERFIL", datas fictícias hardcoded, avisos de dado demo); (b) substituição de dados mockados por dados reais; (c) correções que o próprio plano mestre registra como discrepância conhecida do protótipo (ex.: catálogo legado da aba "Grade Tabular" da Disponibilidade — usar o catálogo MVP correto). Qualquer outra divergência visual ou de fluxo é **defeito de gate**.
3. **Toda tela nova nasce do código do protótipo:** o implementador lê o `.tsx` correspondente no protótipo antes de escrever a tela real — nunca "de memória" nem "parecido". O plano tático de cada onda referencia o arquivo-fonte do protótipo por tela.
4. **Tokens centralizados:** cores e tipografia vivem nos tokens do design system (Onda 2); é proibido hex avulso em tela que não exista na paleta do protótipo.
5. **Verificação no gate:** o Portão 2 compara a tela entregue com a rota equivalente do protótipo (lado a lado — screenshot ou execução) e reprova divergência não autorizada. "Ficou até melhor" **não** é critério de aprovação; fiel é o critério.
6. O UX, o menu e o fluxo de dados do protótipo são **a espinha dorsal da implementação** — mudanças estruturais neles exigem emenda constitucional, não decisão de PR.

## Princípio II — Completude E2E, nunca MVP (NÃO-NEGOCIÁVEL)

Diante da escolha entre solução mínima e completa, escolhe-se a **completa**. Nenhuma feature entra como "tela mínima para complementação posterior": se a funcionalidade está na onda, entra com **todos** os modais, estados, ações, validações e mensagens que o protótipo e a spec v1.1 definem — mesmo que custe mais tempo/esforço. Não se adia design para "fase 2". Uma onda pode ser reescopada (feature sai inteira), mas nunca degradada (feature entra pela metade).

## Princípio III — Regras de negócio só no backend (RA-01, NÃO-NEGOCIÁVEL)

O frontend apresenta e valida formulário; **nenhuma decisão crítica** (saldo, bloqueio, associação, overbooking, fechamento) é decidida no cliente. O backend NestJS é a única fonte de verdade de autorização e de regra.

## Princípio IV — Transação + auditoria em toda etapa crítica (RA-02)

Reserva, confirmação de overbooking, adendo, conferência, troca de peça, transformação, fechamento de carga, emissão fiscal, liberação: sempre em transação única com registro de auditoria (quem, quando, valor anterior/novo, justificativa quando aplicável — v1.1 §12). Histórias append-only nunca são reescritas.

## Princípio V — Hardware e integrações externas como gateways isolados (RA-03)

Balança, impressora, leitor QR e o sistema fiscal (EISS Osasco — AD-02) vivem atrás de portas/adapters isolados, com **fake determinístico no CI**. O CI nunca toca dispositivo ou serviço externo real. Nenhuma operação grava sucesso sem confirmação real do gateway (proibido nota/peso/envio fantasma).

## Princípio VI — Tempo real por eventos, nunca polling (RA-04)

Todo estado que outra tela precisa ver muda por **evento de domínio publicado pós-commit** e broadcast via WebSocket. Emitir antes do commit ou usar polling é defeito de gate.

## Princípio VII — Nenhuma falha silenciosa, nenhum dado inventado (RA-05 + RA-06, NÃO-NEGOCIÁVEL)

Falha de integração vira erro explícito + log estruturado + status de falha — jamais `success=true` mascarando erro, jamais valor default no lugar de leitura real. Toda exceção operacional/fiscal é observável: registrada, rastreável, visível em alerta/ocorrência.

## Princípio VIII — Proibido inventar o que está pendente (v1.1 §16)

Os pontos que a spec v1.1 marca como pendentes (e os que o plano mestre lista em aberto) entram como **parâmetro configurável + badge "Provisório"** com referência ao item pendente — nunca como regra fixa de código. Remover um badge "Provisório" exige decisão do cliente registrada em [`../execucao/DECISOES.md`](../execucao/DECISOES.md) (ex.: AD-01 fixou a composição do boi casado em 2 TZ + 2 DT + 2 PA; AD-02 fixou o sistema fiscal em EISS Osasco).

## Princípio IX — Terminologia do domínio

`Nome Fantasia/Marca` e `Razão Social` no cadastro de clientes; `Buscar cliente` nas buscas. A palavra **"Marca"** permanece banida como nome de entidade, rótulo isolado e termo de busca (v1.1 §6.8). O único rótulo autorizado que a contém é `Nome Fantasia/Marca` no campo `nomeFantasia` (AD-13). `Estoque` é o destino interno — a AlphaCarnes nunca é cadastrada como cliente interno.

## Princípio X — Dados conforme convenções, migrations disciplinadas

Convenções de [`../data/convencoes-schema.md`](../data/convencoes-schema.md): UUID PK (uuidv7), TIMESTAMPTZ, NUMERIC(15,2) dinheiro / NUMERIC(10,3) peso, status TEXT+CHECK, soft delete `deleted_at`, 1 schema Drizzle por domínio. Migrations **somente** via `drizzle-kit generate`, reversíveis, sem `ALTER TABLE` manual, sem DELETE físico em entidade de negócio. Migrações estruturais em passos expand → backfill → contract.

---

## Restrições adicionais

- **Stack fixada** (ADR-001..011): NestJS 11 + TS 5 strict, Next.js 16 App Router (BFF), PostgreSQL 18 + Drizzle, Zod 4, WebSocket nativo, JWT+RBAC 11 perfis (doc 013), node-soap p/ EISS. Trocar peça da stack = ADR nova + emenda.
- **Sem over-engineering:** sem CQRS, sem Event Sourcing, sem microserviços, sem camada de repositório genérica. Se pode ser uma função, não vira serviço.
- **Fontes de verdade em ordem de precedência:** (1) decisões registradas em `docs/execucao/DECISOES.md`; (2) `docs_v2/alphacarnes_contexto_funcional_e_recomendacoes_prototipo_v1.1.md`; (3) código do protótipo `feature/completude-v1.1`; (4) docs_v2 v0.1 onde não contradito; (5) docs/001–018 + ADRs. Nunca inventar fato que nenhuma fonte sustenta.
- **Cobertura backend ≥ 80% (linha e branch)** nos services de domínio — gate de CI, não meta aspiracional.

## Pendências externas declaradas

| Pendência | Efeito |
|---|---|
| Credenciais de homologação EISS Osasco | Adapter SOAP real só é validável end-to-end com elas; CI segue no fake (Princípio V) |
| Modelos oficiais dos relatórios SIF | Área SIF opera com layouts provisórios configuráveis (Princípio VIII) |
| Catálogo oficial completo de produtos | Seed MVP marcado provisório |
| Hardware físico (balança RS-232, impressora, leitor) | Gateways prontos com fakes; driver serial adiado (ADR-010) |

## Fluxo de desenvolvimento e gates

O rito completo (Plano → Portão 1 → Implementação → Portão 2 → Merge), os papéis (Executor/Monitor/Worker) e o estado vivo estão em [`pipeline-execucao.md`](pipeline-execucao.md). Os critérios objetivos por PR e a DoD por onda estão em [`quality-gates.md`](quality-gates.md). Nenhum PR entra em `develop` sem Portão 2 aprovado; nenhuma implementação começa sem Portão 1 aprovado sobre o plano tático da onda.

## Governança

- **Emendas:** somente o Quality Owner (usuário) emenda esta constituição. Toda emenda incrementa a versão (semver: MAJOR muda/remove princípio; MINOR adiciona; PATCH clarifica) e é registrada no log abaixo com data e motivo. Princípios marcados NÃO-NEGOCIÁVEIS exigem emenda MAJOR.
- **Conflitos:** constituição > decisões registradas (DECISOES.md) > plano mestre > planos táticos > preferências do implementador.
- **Dúvida no gate:** entre aprovar e reprovar, **reprova-se** (ajustar). O Monitor nunca aprova com ressalva não registrada.

## Log de emendas

| Versão | Data | Mudança |
|---|---|---|
| 1.0.0 | 2026-07-23 | Ratificação inicial. Consolida RA-01..RA-06 (quality-gates), premissas do usuário (fidelidade ao protótipo como Princípio I; completude E2E como Princípio II) e convenções vigentes. Incorpora AD-01 (boi casado 2TZ+2DT+2PA) e AD-02 (fiscal = EISS Osasco) por referência. |
| 1.1.0 | 2026-08-25 | MINOR — Princípio IX: autoriza o rótulo composto `Nome Fantasia/Marca` no cadastro de clientes (AD-13). “Marca” segue banida como entidade, rótulo isolado e termo de busca. |
