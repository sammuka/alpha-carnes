# Onda 10 — Faturamento (EISS real + RTC, Notas/XML, Seguro F6b, Liberação c/ checklist) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar este plano task a task. Steps usam checkbox (`- [ ]`).
> Workers seguem o plano LITERALMENTE: não decidem regra de negócio, não improvisam. `old_string` não casa / teste falha após 1 correção / caso não coberto → PARAR e reportar.

**Goal:** Fechar as 4 rotas de Faturamento da matriz (linhas 26–29) e o adapter EISS real: (a) `EissClientAdapter` funcional (SOAP via template string + `fetch` nativo) com estrutura XML dos manuais oficiais (V10.6 padrão + 2.0 RTC), feature flag `modelo_fiscal` e serialização de emissões; (b) Pré-Faturamento fiel (KPIs, bloqueios fiscais, reprocesso individual — **emissão em lote fora de escopo nesta onda, P-Onda10.3**); (c) Notas/XML fiel (filtros, rastreabilidade pedido→peças→pesos→item fiscal, cancelamento com trava pós-liberação); (d) Seguro Manual F6b (tabela nova `seguros_carga`, transições pendente→enviado→confirmado, anexos referenciais); (e) Liberação do Caminhão com checklist calculado (carga conferida + NFs autorizadas + seguro confirmado + caminhão/motorista) bloqueando `liberar-saida`.

**Architecture:** Extensão do módulo `operacao/faturamento` (services consolidacao/faturamento existentes + novos `seguros.service` e `liberacao-checklist.service`) e do gateway `integracoes/nfse` (adapter real substitui o stub; porta `NfseGateway` INALTERADA — RA-03/ADR-011). Migration **`0026`** expand: tabela `seguros_carga` + coluna `notas_fiscais.modelo_fiscal` (CHECK `padrao|rtc`, default `padrao`). Frontend: reescreve `pre-faturamento` (remove nota "pendente de definição" — AD-02), substitui os placeholders de `notas-xml` e `seguro-manual`, e completa `liberacao` com o checklist real. **A emissão contra o EISS de homologação NÃO faz parte do gate desta onda** — CI/dev usam `NFSE_FAKE=1`; o teste de homologação real é o passo pós-merge (ver "Homologação: plano de ativação").

**Tech Stack:** NestJS 11 + TS 5 strict (**zero dependência nova nesta onda** — o WSDL real do EISS não está vendorizado no repo e o D10.11 anterior exigia `node-soap` + WSDL; a via fixada é template string + `fetch` nativo do Node 22, já usado no runtime), Drizzle (PostgreSQL 18), Zod 4, `@nestjs/event-emitter` + hub WS nativo, Jest, Next.js 16 (BFF) + React 19 + shadcn/ui + Playwright. `NFSE_FAKE=1` em testes (ADR-011).

**Base tip:** `origin/develop` @ `53a3ad3`. Migration desta onda: **`0026`** (a `0025` é da Onda 9). Protótipo pinado: `F:\Projetos\alpha-carnes-prototipo` @ `feature/completude-v1.1` `8d32aa4c`.

**Branch:** `feature/onda10-faturamento` → PR para `develop`.

**Fontes EISS (revisadas 2026-08-02 contra os manuais oficiais):** `docs/integrações/nfse-osasco/` — `eiss-webservice.md` (namespaces reais, envelope `<tem:request><eis:NotaFiscal>`, campo `Atividade`, retorno `NotaFiscalGerada`), `estrutura-xml.md` (obrigatoriedade campo a campo, campos RTC), `ambiente-homologacao.md` (credenciais por auto-atendimento no portal), `codigos-erro.md` (mensagens textuais; sem códigos numéricos).

---

## Global Constraints (herda constituição + plano mestre)

1. Regra de negócio só no backend (RA-01): elegibilidade de emissão, checklist de liberação, trava de cancelamento — nada disso no client.
2. Mutação crítica em `db.transaction` + auditoria no mesmo escopo (RA-02); eventos SEMPRE pós-commit (RA-04). Padrão já vigente em `faturamento.service.ts` — não regredir.
3. Gateway isolado (RA-03/ADR-011): o backend depende só de `NfseGateway` (token DI `NFSE_GATEWAY`); o adapter real e o fake são intercambiáveis. **Nenhum teste toca o EISS real** (`NFSE_FAKE=1`).
4. Nenhuma falha silenciosa (RA-05/06): `Erro=true` com HTTP 200 é falha de negócio → `statusNfse='erro_emissao'` + `ultimoErroNfse`; `NfseTransporteError` → retry com backoff; jamais `success` especulativo.
5. `ChaveAutenticacao` NUNCA em log/banco/payload persistido — `redigirSegredos()` antes de qualquer persistência de `payloadEiss` (padrão existente).
6. Envelope de listagem `{ data, total, page, pageSize }`; client lê `.data`.
7. Grep "Marca" como rótulo = 0 (Princípio IX). Cores: só tokens do DS Onda 2; zero hex avulso novo.
8. Princípio VIII (não inventar o pendente): valores/documentos de seguro que o fluxo operacional ainda não definiu (docs_v2/05 §3.5) entram como campos livres + badge "Provisório" — sem inventar integração com corretora.

## Escopo

Backend: T1–T7 (migration, adapter SOAP, flag RTC, rotas novas, seguros, checklist, RBAC). Frontend: T8–T11 (4 telas). Gate: T12.

## Fora de escopo

- **Emissão real contra homologação/produção EISS** — pós-merge (ver seção "Homologação").
- Notas de Repasse R1/R2 (`DeduzirRepasse` sempre `false` — exige Regime Especial que a AlphaCarnes não tem).
- **"Emitir em lote" (endpoint `emitirLote`, botão da tela Pré-Faturamento) — fora de escopo desta onda.** Motivo: o valor monetário da NFS-e não é calculado por nenhum service hoje — a tela unitária exige que o operador DIGITE o valor antes de emitir (`pre-faturamento-client.tsx`), e não existe modelagem de preço/faixa vinculada ao pedido de venda (a tabela de preços em `comercial/precos` não tem nenhum vínculo com `pedidos_venda` ou `clientes.prioridade`). Fixar um cálculo de valor agora seria inventar uma regra de precificação — Princípio VIII proíbe. Registrado como **P-Onda10.3** (ver Pendências); o botão "Emitir em lote" do protótipo fica NÃO implementado nesta onda (T8 não o inclui).
- Download de XML/DANFE reais: o EISS retorna `Link` da nota (não um XML bruto para download); os botões da tela abrem o `Link` — sem gerador de DANFE próprio.
- Conversão de RPS (`NumeroRecibo`/`DataRecibo`), tomadores de nota agrupada, módulo construção civil.
- Upload físico de anexos do seguro (armazenamento de arquivos não existe no sistema): `anexos_json` guarda referências nominais (nome/descrição), fiel ao caráter manual do fluxo — registrado como P-Onda10.1 (ver Pendências).

## Referências do protótipo (`F:\Projetos\alpha-carnes-prototipo` @ `feature/completude-v1.1` `8d32aa4c`)

| Tela app | Arquivo protótipo | Blocos obrigatórios nesta onda |
|---|---|---|
| /faturamento/pre-faturamento | `src/app/pages/Faturamento.tsx` (409 l.) | Header `:206-216` (SEM o badge âmbar "Integração fiscal externa — pendente de definição" — AD-02 resolveu; substituir por badge de ambiente: "Homologação EISS" âmbar quando `EISS_HOMOLOGACAO=true`, "Produção EISS" verde caso contrário); seletor de carga + botão "Emitir em lote" `:219-243`; 5 KPIs `:245-261` (Pedidos na carga/Preparados/Autorizados/Com erro/Valor total); bloco "Bloqueios ativos — dados fiscais incompletos" `:263-284`; lista de pedidos com StatusBadge (Preparado/Enviado/Autorizado/Erro) e ações por status (enviar/consultar retorno/reprocessar) `:286-380` |
| /faturamento/notas-xml | `src/app/pages/NotasXml.tsx` (519 l.) | Header `:388-391`; KPIs; filtros (busca+status); tabela de notas (número, chave/autenticador, cliente, carga, valor, status, ações); botões "Baixar XML"/"Ver DANFE" `:335-338` (abrem o `Link` EISS; `title` explicando quando não houver link); `ModalCancelar` `:149-` (motivo obrigatório); trava: cancelar desabilitado quando `liberada=true` `:32,492` com `title` "Cancelamento bloqueado — caminhão já liberado"; rastreabilidade (drawer/detalhe pedido→peças→pesos→item fiscal); nota de rodapé `:511` |
| /faturamento/seguro-manual | `src/app/pages/SeguroManual.tsx` (271 l.) | Header `:123-129`; 4 KPIs `:132-147` (Cargas com seguro/Pendentes/Enviados/Confirmados); nota informativa "O seguro é tratado manualmente — o sistema apenas registra o status" `:150-153`; filtros busca+status `:156-168`; lista de cargas com StatusBadge (Pendente âmbar/Enviado azul/Confirmado verde `:62-64`), ações "Marcar enviado"/"Marcar confirmado" `:99-106`, anexar comprovante (referência) `:109-113`, observação editável `:115-119`, notas vinculadas |
| /faturamento/liberacao | `src/app/pages/LiberacaoCaminhao.tsx` (331 l.) | Header `:137-139`; KPIs "Liberáveis agora"/"Com pendência" `:145-148`; master "Caminhões no pátio" `:163-196`; detail: botão "Liberar Caminhão" desabilitado com pendência `:236-243`; checklist calculado 4 requisitos `:247-260` (Carga conferida / NF-e(s) autorizadas N de M / Seguro confirmado / Caminhão-motorista preenchidos); bloco "Pendências impeditivas" com links de resolução `:262-296` (→ /carga/conferencia, /faturamento/notas-xml, /faturamento/seguro-manual, /cadastros/caminhoes); tabela "Notas fiscais desta carga" `:298-325` |

## Decisões de design (fixadas — só reabrir se houver quebra)

**D10.1 — Estrutura SOAP real (manuais oficiais).** O adapter monta o envelope conforme `docs/integrações/nfse-osasco/eiss-webservice.md`: 4 namespaces (`tem`, `eis`=Mensagem, `eis1`=Prestador, `eis2`=Contribuinte), corpo em `<tem:request>`, nota em `<eis:NotaFiscal>` (padrão) ou `<eis:NotaFiscal_RTC>` (RTC). Campos que DIFEREM do contrato interno atual e exigem atualização do `payload-builder.ts` + `nfse.types.ts` (mantendo a INTERFACE `NfseGateway` estável):
- `codigoServico` interno → tag `<Atividade>` (formato `00.00` da LC 404/2022; o default `"04014"` do builder está errado → parâmetro `faturamento.codigo_servico_atividade`, seed `"14.01"` com badge Provisório até o contador confirmar — Princípio VIII).
- `descricaoServico` interno → tag `<InformacoesAdicionais>` (máx. 2300 chars; `|` = parágrafo).
- NÃO existe objeto `Prestador` no request de emissão (prestador = `ChaveAutenticacao`); `DadosPrestador` sai do payload SOAP (mantido internamente só p/ exibição).
- Campos obrigatórios novos no request: `nrExercicioReferencia`/`nrMesReferencia` (da data de emissão), `SemIncidenciaISS=false`, `SimplesNacional` (parâmetro `faturamento.simples_nacional`, seed `false`), `TomadorEstrangeiro=false`, `DeduzirRepasse=false`, `Identificador` = id do pedido de venda (rastreio ERP↔EISS, ecoado no response).
- `Aliquota`: para não-Simples enviar `0.00` (o EISS aplica a vigente); a coluna `notas_fiscais.aliquota` continua registrando a alíquota informativa interna.
- Retorno: `NotaFiscalGerada.{Numero,Autenticador,Link,Identificador}` → mapear `numeroNota=Numero`, `codigoVerificacao=Autenticador`, `linkNota=Link` no `NfseResultado` (contrato interno inalterado).
- `Cancelar`: request com `NumeroNota` (int) + `Motivo`; sem `Prestador`.
- `ConsultarNotaCompleta`: consulta por intervalo `NumeroNotaInicial==NumeroNotaFinal` (não há parâmetro de nota única); em timeout de emissão, a reconciliação consulta por `Identificador`+período.

**D10.2 — Feature flag RTC.** Coluna nova `notas_fiscais.modelo_fiscal` TEXT CHECK (`padrao|rtc`) DEFAULT `padrao` + parâmetro `faturamento.modelo_fiscal` (seed `padrao`, badge Provisório). Emissão lê o parâmetro no momento do envio e grava na nota o modelo usado. `modelo_fiscal='rtc'` → método `RTC_EmitirNFE` com os 4 campos obrigatórios (`ClassTrib` 6 díg., `CodigoNBS` 12 díg. pontuado, `IndOperacao` 6 díg., `IdLocalIncidencia` 1 díg.) vindos de parâmetros (`faturamento.rtc_class_trib`, `faturamento.rtc_codigo_nbs`, `faturamento.rtc_ind_operacao`, `faturamento.rtc_id_local_incidencia` — seeds vazios; emissão RTC com parâmetro vazio → erro de validação claro `RTC_PARAMETROS_INCOMPLETOS`, sem chamada SOAP). Os métodos de pesquisa (`RTC_PesquisarNbsClassTrib` etc.) NÃO ganham UI nesta onda: são utilitários de configuração — expostos como método do gateway + endpoint admin `GET /faturamento/rtc/pesquisar-nbs?atividade=` (`FATURAMENTO_GERENCIAR`) para o operador descobrir os códigos e preencher os parâmetros.

**D10.3 — Serialização de emissões (manual: "requisições simultâneas podem falhar ambas").** O `FaturamentoService.emitir` (e `reprocessar`) executam em fila por prestador: mutex simples em memória (`private emissaoEmAndamento: Promise<void>`) encadeando emissões — suficiente para instância única on-premises (deployment atual). **"Emitir em lote" fora de escopo desta onda (P-Onda10.3 — ver "Fora de escopo"): não há endpoint `emitir-lote`.** Cada pedido é emitido individualmente pela tela (valor digitado pelo operador, como já é hoje); a serialização em fila garante que emissões manuais disparadas em sequência rápida não colidam no EISS.

**D10.4 — Trava de cancelamento pós-liberação.** `cancelar` já existente ganha guard: se o caminhão da nota tem `statusCaminhao IN ('liberado_saida','expedido')` → 409 `NOTA_TRAVADA_CAMINHAO_LIBERADO` (sem chamada SOAP). Frontend desabilita o botão com `title` (fidelidade `NotasXml.tsx:492`), mas a regra vive no backend (RA-01).

**D10.5 — `seguros_carga` (F6b).** Migration 0026: `id` uuidv7 PK, `caminhao_id` FK NOT NULL UNIQUE-parcial (1 seguro vivo por caminhão: `WHERE deleted_at IS NULL`), `valor_carga` NUMERIC(15,2) NULL (apurável), `status` TEXT CHECK (`pendente|enviado|confirmado`) DEFAULT `pendente`, `responsavel_id` FK usuarios NULL, `enviado_em`/`confirmado_em` TIMESTAMPTZ NULL, `observacao` TEXT NULL, `anexos_json` JSONB DEFAULT `[]` (lista de `{nome, descricao, registradoEm, registradoPor}` — referências, sem upload físico), `created_at`/`updated_at`/`deleted_at` padrão. Transições válidas: `pendente→enviado` (grava `enviado_em`+`responsavel_id`), `enviado→confirmado` (grava `confirmado_em`), `enviado→pendente` (regressão permitida com auditoria; protótipo não mostra, mas operação manual erra — regra registrada aqui). `confirmado` é terminal (correção = soft delete + novo registro, auditado). O registro nasce lazy: primeiro acesso da tela de seguro a um caminhão com carga cria o registro `pendente` (ou `POST /faturamento/seguros` idempotente por `caminhaoId`).

**D10.6 — Checklist de liberação calculado (sem tabela própria).** `GET /faturamento/liberacao/:caminhaoId/checklist` monta em SQL: (1) `cargaConferida` = caminhão `statusCaminhao IN ('fechado','liberado_faturamento','faturado','liberado_saida','expedido')` (conferência concluída); (2) `notasAutorizadas` = COUNT notas vivas do caminhão com `statusNfse='emitida'` vs total de pedidos da carga (`ok` quando todas); (3) `seguroConfirmado` = registro `seguros_carga` vivo com `status='confirmado'` — **se o parâmetro `faturamento.seguro_obrigatorio` (seed `true`, badge Provisório) for `false`, o requisito reporta `ok=true` com detalhe "dispensado por parâmetro"**; (4) `caminhaoMotorista` = `placa` e `motorista` não-nulos/não-vazios. Response: `{ requisitos: [{chave, rotulo, ok, detalhe}], liberavel: boolean }`. O `POST /caminhoes/:id/liberar-saida` EXISTENTE ganha o guard: checklist não-liberável → 409 `CHECKLIST_INCOMPLETO` com a lista de requisitos reprovados (RA-01 — a trava é do backend, o botão desabilitado é cortesia).

**D10.7 — Rastreabilidade da nota.** `GET /faturamento/notas/:id/rastreabilidade`: nota → pedido de venda (nº, cliente) → `carga_itens` do pedido no caminhão da nota → peças/subitens (etiqueta, produto, peso) → totais. Somente leitura, joins sobre tabelas existentes; response espelha o drawer do protótipo.

**D10.8 — Listagem de notas.** `GET /faturamento/notas?status=&caminhaoId=&clienteId=&busca=&page=&pageSize=` (envelope padrão). `busca` cobre `numero_nfse`, `codigo_verificacao` e nome do cliente (ILIKE). Perfis de consulta ampliada (matriz linha 27): `logistica` e `diretoria` ganham `FATURAMENTO_LER`.

**D10.9 — RBAC.** Permissões novas: `SEGURO_GERENCIAR` (`'Registrar envio e confirmação do seguro de carga'`) e `LIBERACAO_GERENCIAR` (`'Liberar caminhão por checklist'`). Concessões: `faturamento`, `gestor`, `administrador` → ambas; `logistica` → ambas (doc 04 §7.3/§7.4 — logística opera seguro e liberação); `diretoria`+`logistica` → `FATURAMENTO_LER` (consulta). GETs de seguro/checklist aceitam `FATURAMENTO_LER` OU a permissão de gestão respectiva (padrão `@RequireQualquerPermissao` da Onda 9). Regenerar `perfil-permissoes.snapshot.json` via `scripts/regen-rbac-snapshot.ts`.

**D10.10 — Eventos novos.** `SEGURO_ATUALIZADO: 'seguro_atualizado'` (payload `{caminhaoId, seguroId, status, dataOperacao}`) e `CAMINHAO_LIBERADO: 'caminhao_liberado'` (payload `{caminhaoId, dataOperacao}` — emitido pelo `liberar-saida` que hoje não emite). Handlers no gateway (padrão F5); clients das 4 telas: `conectarRealtime(['dashboard'])` com refetch em `NFSE_EMITIDA|CANCELADA|ERRO_EMISSAO`, `SEGURO_ATUALIZADO`, `CAMINHAO_LIBERADO`, `EXPEDICAO_LIBERADA_FATURAMENTO`.

**D10.11 — Transporte SOAP: template string + `fetch` nativo (FIXADO — zero dependência nova).** O WSDL real do EISS não está vendorizado no repositório e obtê-lo exige acesso ao portal de homologação (fora do alcance do worker/CI). Em vez de depender de `node-soap` + um WSDL a buscar, o adapter monta o envelope SOAP por template string (estrutura literal dos manuais — `docs/integrações/nfse-osasco/eiss-webservice.md`, `estrutura-xml.md`, exemplos em `docs/integrações/nfse-osasco/exemplos/*.xml`) e envia via `fetch()` nativo do Node 22 (`POST`, `Content-Type: text/xml; charset=utf-8`, header `SOAPAction` conforme o método) para o endpoint `EISS_ENDPOINT_HML|PRD`; resposta XML é parseada com regex/string simples pelos nomes de tag literais dos exemplos (sem parser XML novo — os campos de interesse são poucos e o shape é estável). Timeout via `AbortSignal.timeout(EISS_TIMEOUT_MS)` (30s). Falha de transporte (timeout/5xx/ECONNREFUSED/fetch rejeitado) → `NfseTransporteError`; resposta com `<Erro>true</Erro>` → `NfseResultado.erro=true` (NÃO exception). Contrato testável é `NfseGateway` — a forma de transporte é um detalhe interno do adapter.

**D10.12 — Fake atualizado.** `FakeNfseGateway` passa a devolver `NfseResultado` no shape novo (com `linkNota` e eco de `identificador`) e ganha gatilhos determinísticos: pedido com valor `999.99` → `Erro=true` "Atividade não autorizada" (testa caminho de erro de negócio); valor `888.88` → `NfseTransporteError` (testa retry). Mantém emissões felizes para os demais.

## Estrutura de arquivos

```
app/backend/src/database/migrations/0026_onda10_faturamento_expand.sql      [T1: gerada por drizzle-kit]
app/backend/src/database/schema/faturamento.schema.ts                       [T1: + segurosCarga, + modeloFiscal]
app/backend/src/database/schema/index.ts                                    [T1: export]
app/backend/src/database/seed.ts                                            [T1: parâmetros faturamento.*]
app/backend/src/integracoes/nfse/nfse.types.ts                              [T2: campos novos req/res (interface NfseGateway estável + método rtcPesquisarNbsClassTrib)]
app/backend/src/integracoes/nfse/payload-builder.ts                         [T2: estrutura real D10.1]
app/backend/src/integracoes/nfse/eiss-client.adapter.ts                     [T2: adapter real via template string + fetch]
app/backend/src/integracoes/nfse/fake-nfse.gateway.ts                       [T2: D10.12]
app/backend/src/modules/operacao/faturamento/faturamento.service.ts         [T3: mutex + flag RTC + trava cancelamento]
app/backend/src/modules/operacao/faturamento/faturamento.controller.ts     [T4: rotas novas]
app/backend/src/modules/operacao/faturamento/notas-consulta.service.ts      [T4: novo — listagem + rastreabilidade]
app/backend/src/modules/operacao/faturamento/seguros.service.ts             [T5: novo]
app/backend/src/modules/operacao/faturamento/liberacao-checklist.service.ts [T6: novo]
app/backend/src/modules/operacao/faturamento/dto/faturamento.dto.ts         [T3–T6: schemas Zod]
app/backend/src/modules/operacao/faturamento/faturamento.module.ts          [T3–T6: providers]
app/backend/src/modules/operacao/expedicao/liberacao.service.ts             [T6: guard checklist em liberar-saida + evento]
app/backend/src/common/rbac/permissoes.ts                                   [T7: SEGURO_GERENCIAR, LIBERACAO_GERENCIAR, concessões]
app/backend/src/common/rbac/perfil-permissoes.snapshot.json                 [T7: regenerado]
app/backend/src/realtime/events/eventos.ts                                  [T7: 2 eventos]
app/backend/src/realtime/realtime.gateway.ts                                [T7: handlers]
app/backend/test/unit/payload-builder.spec.ts                               [T2: estrutura real]
app/backend/test/unit/eiss-adapter.spec.ts                                  [T2: novo — parse/erros (SOAP mockado)]
app/backend/test/unit/seguros-regras.spec.ts                                [T5]
app/backend/test/unit/liberacao-checklist.spec.ts                           [T6]
app/backend/test/integration/onda10-faturamento.e2e-spec.ts                 [T12: DoDs]
app/frontend/src/app/(admin)/faturamento/pre-faturamento/pre-faturamento-client.tsx [T8]
app/frontend/src/app/(admin)/faturamento/notas-xml/{page,notas-xml-client}.tsx      [T9: substitui placeholder]
app/frontend/src/app/(admin)/faturamento/seguro-manual/{page,seguro-manual-client}.tsx [T10: substitui placeholder]
app/frontend/src/app/(admin)/faturamento/liberacao/liberacao-client.tsx     [T11: checklist real]
app/frontend/src/app/api/operacao/faturamento/...                           [T8–T11: rotas BFF repasse]
app/frontend/src/lib/faturamento.ts                                         [T8–T11: tipos + rótulos]
app/frontend/__tests__/{pre-faturamento,notas-xml,seguro-manual,liberacao}.test.tsx [T8–T11]
app/frontend/e2e/onda10-faturamento.spec.ts                                 [T12: Playwright + evidências]
docs/execucao/DECISOES.md                                                   [T12: AD-xx seguro_obrigatorio se decidido]
```

## Tasks

## Task 1 — Migration 0026 + schema + seeds

**Files:** `faturamento.schema.ts`, `database/seed.ts`

- [ ] Step 1 — em `faturamento.schema.ts`, após a definição de `notasFiscais` (antes de `// ── Relations`), adicionar a tabela `segurosCarga` (D10.5):
```ts
// ── seguros_carga ─────────────────────────────────────────────────────────────
// F6b — controle manual do seguro por caminhão. Máximo 1 registro vivo por
// caminhão (unicidade parcial). Transições: pendente→enviado→confirmado,
// com regressão enviado→pendente permitida (auditada). confirmado é terminal.
export const segurosCarga = pgTable(
  'seguros_carga',
  {
    id:                   uuid('id').primaryKey().default(sql`uuidv7()`),
    caminhaoId:           uuid('caminhao_id').notNull().references(() => caminhoes.id),
    valorCarga:           numeric('valor_carga', { precision: 15, scale: 2 }),
    status:               text('status').notNull().default('pendente'),
    responsavelId:        uuid('responsavel_id').references(() => usuarios.id),
    enviadoEm:            timestamp('enviado_em', { withTimezone: true }),
    confirmadoEm:         timestamp('confirmado_em', { withTimezone: true }),
    observacao:           text('observacao'),
    // Lista de {nome, descricao, registradoEm, registradoPor} — referências nominais,
    // sem upload físico (P-Onda10.1).
    anexosJson:           jsonb('anexos_json').notNull().default(sql`'[]'::jsonb`),
    createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:            timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_seguros_carga_status', sql`${t.status} IN ('pendente','enviado','confirmado')`),
    // Máximo 1 seguro vivo por caminhão
    uniqueIndex('uq_seguros_carga_caminhao')
      .on(t.caminhaoId)
      .where(sql`${t.deletedAt} IS NULL`),
    index('idx_seguros_carga_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const segurosCargaRelations = relations(segurosCarga, ({ one }) => ({
  caminhao: one(caminhoes, {
    fields: [segurosCarga.caminhaoId],
    references: [caminhoes.id],
  }),
  responsavel: one(usuarios, {
    fields: [segurosCarga.responsavelId],
    references: [usuarios.id],
  }),
}));
```
  (`segurosCarga` já cai no `export * from './faturamento.schema'` existente em `database/schema/index.ts` — nenhuma linha nova precisa ser adicionada nesse arquivo.)

- [ ] Step 2 — na definição de `notasFiscais`, coluna nova `modeloFiscal` (D10.2) e CHECK correspondente:
```ts
    // request + response EISS; token REDACTADO antes de persistir
    payloadEiss:          jsonb('payload_eiss').notNull().default(sql`'{}'::jsonb`),
    // D10.2 — modelo fiscal usado na emissão (lido do parâmetro faturamento.modelo_fiscal
    // no momento do envio; gravado na nota para auditoria/consulta).
    modeloFiscal:         text('modelo_fiscal').notNull().default('padrao'),
    createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
```
  e no array de constraints de `notasFiscais`, após `chk_notas_fiscais_aliquota_valida`:
```ts
    check(
      'chk_notas_fiscais_modelo_fiscal',
      sql`${t.modeloFiscal} IN ('padrao','rtc')`,
    ),
```

- [ ] Step 3 — gerar e conferir a migration:
```bash
cd app/backend
npx drizzle-kit generate --name onda10_faturamento_expand
```
Saída esperada: novo arquivo `src/database/migrations/0026_onda10_faturamento_expand.sql` + `meta/0026_snapshot.json` com `"prevId"` apontando para o snapshot `0025` (Onda 9) — conferir com `Get-Content` (PowerShell) ou:
```bash
grep -o '"prevId": *"[^"]*"' app/backend/src/database/migrations/meta/0026_snapshot.json
```
Saída esperada: 1 linha, o UUID igual ao `"id"` do `meta/0025_snapshot.json`. Journal (`meta/_journal.json`) deve terminar com a entrada `0026_onda10_faturamento_expand` — contiguidade `0000..0026` sem buracos.

- [ ] Step 4 — em `database/seed.ts`, no array `PARAMETROS_SEED`, após o bloco `fiscal.expiracao_reserva_rascunho` (último item), adicionar os 8 parâmetros de D10.1/D10.2/D10.6 — todos `provisorio: true` (fonte: contador/parametrização ainda pendente — Princípio VIII):
```ts
  {
    chave: 'faturamento.codigo_servico_atividade',
    descricao: 'Código de serviço (Atividade) na emissão EISS',
    valorJson: {
      pergunta: 'Qual o código de Atividade (LC 404/2022) usado na emissão de NFS-e?',
      texto: 'Enviado como <Atividade> no request EISS (formato "00.00"). Valor provisório até o contador confirmar.',
      valor: '14.01',
      provisorio: true,
      pendencia: 'Confirmação do contador do cliente — D10.1',
    },
  },
  {
    chave: 'faturamento.simples_nacional',
    descricao: 'Enquadramento Simples Nacional (EISS SimplesNacional)',
    valorJson: {
      pergunta: 'A AlphaCarnes é optante do Simples Nacional?',
      texto: 'Enviado como <SimplesNacional> no request EISS. Valor provisório até confirmação contábil.',
      valor: false,
      provisorio: true,
      pendencia: 'Confirmação do contador do cliente — D10.1',
    },
  },
  {
    chave: 'faturamento.modelo_fiscal',
    descricao: 'Modelo fiscal da emissão EISS (padrão ou RTC)',
    valorJson: {
      pergunta: 'A emissão deve usar o modelo padrão (Emitir) ou o modelo RTC (RTC_EmitirNFE)?',
      texto: 'Lido no momento do envio e gravado na nota emitida (notas_fiscais.modelo_fiscal).',
      valor: 'padrao',
      opcoes: ['padrao', 'rtc'],
      provisorio: true,
      pendencia: 'D10.2',
    },
  },
  {
    chave: 'faturamento.seguro_obrigatorio',
    descricao: 'Seguro confirmado é requisito obrigatório para liberação do caminhão',
    valorJson: {
      pergunta: 'A liberação do caminhão deve exigir seguro confirmado?',
      texto: 'Quando false, o requisito de seguro do checklist de liberação reporta ok=true (dispensado por parâmetro).',
      valor: true,
      provisorio: true,
      pendencia: 'D10.6',
    },
  },
  {
    chave: 'faturamento.rtc_class_trib',
    descricao: 'RTC — ClassTrib (6 dígitos)',
    valorJson: {
      pergunta: 'Qual o ClassTrib (6 dígitos) para emissão no modelo RTC?',
      texto: 'Obrigatório apenas quando faturamento.modelo_fiscal="rtc". Vazio → RTC_PARAMETROS_INCOMPLETOS.',
      valor: '',
      provisorio: true,
      pendencia: 'Obter via GET /faturamento/rtc/pesquisar-nbs — D10.2',
    },
  },
  {
    chave: 'faturamento.rtc_codigo_nbs',
    descricao: 'RTC — Código NBS (12 dígitos pontuado)',
    valorJson: {
      pergunta: 'Qual o Código NBS para emissão no modelo RTC?',
      texto: 'Obrigatório apenas quando faturamento.modelo_fiscal="rtc". Vazio → RTC_PARAMETROS_INCOMPLETOS.',
      valor: '',
      provisorio: true,
      pendencia: 'Obter via GET /faturamento/rtc/pesquisar-nbs — D10.2',
    },
  },
  {
    chave: 'faturamento.rtc_ind_operacao',
    descricao: 'RTC — IndOperacao (6 dígitos)',
    valorJson: {
      pergunta: 'Qual o IndOperacao para emissão no modelo RTC?',
      texto: 'Obrigatório apenas quando faturamento.modelo_fiscal="rtc". Vazio → RTC_PARAMETROS_INCOMPLETOS.',
      valor: '',
      provisorio: true,
      pendencia: 'D10.2',
    },
  },
  {
    chave: 'faturamento.rtc_id_local_incidencia',
    descricao: 'RTC — IdLocalIncidencia (1 dígito)',
    valorJson: {
      pergunta: 'Qual o IdLocalIncidencia para emissão no modelo RTC?',
      texto: 'Obrigatório apenas quando faturamento.modelo_fiscal="rtc". Vazio → RTC_PARAMETROS_INCOMPLETOS.',
      valor: '',
      provisorio: true,
      pendencia: 'D10.2',
    },
  },
```

- [ ] Step 5 — migrar banco local e conferir:
```bash
cd app/backend
npm run db:migrate
```
Saída esperada: log terminando em `0026_onda10_faturamento_expand` sem erro; depois:
```bash
npm run db:seed
```
Saída esperada: sem erro de conflito (todos os `onConflictDoNothing` por `chave`); os 8 parâmetros novos aparecem em `SELECT chave FROM parametros WHERE chave LIKE 'faturamento.%'` (8 linhas).

Commit: `feat(onda10): migration 0026 — seguros_carga + modelo_fiscal + seeds fiscais provisórios`

## Task 2 — Adapter EISS real + tipos + fake

**Files:** `nfse.types.ts`, `payload-builder.ts`, `eiss-client.adapter.ts`, `fake-nfse.gateway.ts`, `test/unit/payload-builder.spec.ts`, `test/unit/eiss-adapter.spec.ts`

- [ ] Step 1 — SEM dependência nova (D10.11 fixou template string + `fetch` nativo do Node 22 — zero `npm i`). Pular direto para o Step 2.

- [ ] Step 2 — em `nfse.types.ts`, substituir `EmitirNfseRequest` (D10.1) — campos que mudam de nome/entram novos:
```ts
export interface EmitirNfseRequest {
  /** Token EISS — NUNCA logar, persistir ou serializar este campo! */
  chaveAutenticacao: string;
  homologacao: boolean;
  /** Rastreio ERP↔EISS — id do pedido de venda, ecoado no response (NotaFiscalGerada.Identificador). */
  identificador: string;
  nrExercicioReferencia: number;
  nrMesReferencia: number;
  /** Tag <Atividade> — código LC 404/2022, formato "00.00". Substitui codigoServico. */
  atividade: string;
  aliquota: string; // decimal string, ex: "0.00" para não-Simples
  valor: string; // decimal string, ex: "1500.00"
  valorDeducao: string;
  /** Tag <InformacoesAdicionais> — máx. 2300 chars; "|" separa parágrafos. Substitui descricaoServico. */
  informacoesAdicionais: string;
  notificarTomadorPorEmail: boolean;
  substituicaoTributaria: boolean;
  semIncidenciaISS: boolean;
  simplesNacional: boolean;
  tomadorEstrangeiro: boolean;
  deduzirRepasse: boolean;
  tomador: PessoaDto;
  /** Modelo fiscal usado — 'rtc' aciona RTC_EmitirNFE + campos rtc*. */
  modeloFiscal: 'padrao' | 'rtc';
  /** Obrigatórios apenas quando modeloFiscal='rtc' (D10.2). */
  rtcClassTrib?: string;
  rtcCodigoNbs?: string;
  rtcIndOperacao?: string;
  rtcIdLocalIncidencia?: string;
  numeroRps?: string;
  serieRps?: string;
  dataRps?: string;
}
```
(remove `descricaoServico`, `codigoServico` e `prestador` — D10.1: "NÃO existe objeto `Prestador` no request de emissão"; `DadosPrestador` continua existindo em `payload-builder.ts` só para exibição interna.)
<!-- DIVERGÊNCIA: D10.1 diz "prestador = ChaveAutenticacao" e remove Prestador do request. O código atual em faturamento.service.ts monta `prestador: { nome, cnpj, ... }` e passa no objeto — a Fase B (chamarGateway) também usa `prestadorNome`/`prestadorCnpjDigitos` para a consulta em timeout. Ajustar T3 para não repassar `prestador` no EmitirNfseRequest; `ConsultarNfseRequest`/`CancelarNfseRequest` (D10.1: "Cancelar: request com NumeroNota + Motivo; sem Prestador") também perdem o campo `prestador`. Ver Step 3 abaixo. -->

  Ajustar também `CancelarNfseRequest` (D10.1 — sem `Prestador`) e `ConsultarNfseRequest` (consulta por intervalo):
```ts
export interface CancelarNfseRequest {
  /** Token EISS — NUNCA logar, persistir ou serializar este campo! */
  chaveAutenticacao: string;
  homologacao: boolean;
  numeroNota: string;
  motivoCancelamento: string;
}

export interface ConsultarNfseRequest {
  /** Token EISS — NUNCA logar, persistir ou serializar este campo! */
  chaveAutenticacao: string;
  homologacao: boolean;
  /** Consulta por intervalo — número único usa numeroNotaInicial === numeroNotaFinal. */
  numeroNotaInicial?: string;
  numeroNotaFinal?: string;
  /** Fallback de reconciliação em timeout de emissão (D10.1). */
  identificador?: string;
}
```
  E `NfseResultado` ganha o eco do identificador:
```ts
export interface NfseResultado {
  erro: boolean;
  mensagemErro?: string;
  numeroNota?: string;
  codigoVerificacao?: string;
  linkNota?: string;
  /** Eco do EmitirNfseRequest.identificador — usado na reconciliação por Identificador+período. */
  identificadorEco?: string;
  /** Resposta bruta do EISS — ChaveAutenticacao já redactada por redigirSegredos(). */
  raw: unknown;
}
```
  E a porta `NfseGateway` ganha o método utilitário de pesquisa (D10.2 — sem UI nesta onda):
```ts
export interface RtcPesquisaNbsClassTrib {
  codigoNbs: string;
  classTrib: string;
  descricao: string;
}

/** Gateway de emissão NFS-e via EISS Osasco-SP. */
export interface NfseGateway {
  emitir(req: EmitirNfseRequest): Promise<NfseResultado>;
  cancelar(req: CancelarNfseRequest): Promise<NfseResultado>;
  consultarNotaCompleta(req: ConsultarNfseRequest): Promise<NfseResultado>;
  /** D10.2 — utilitário de configuração (endpoint admin, sem tela nesta onda). */
  rtcPesquisarNbsClassTrib(chaveAutenticacao: string, homologacao: boolean, atividade: string): Promise<RtcPesquisaNbsClassTrib[]>;
}
```

- [ ] Step 3 — em `payload-builder.ts`, reescrever `montarPayloadEiss` para o shape D10.1 (assinatura ganha `codigoServicoAtividade`, `simplesNacional` e `modeloFiscal` — parâmetros lidos de `parametros` pelo service, não hardcoded no builder):
```ts
export interface DadosPedidoParaNfse {
  pedidoId: string;
  cliente: {
    razaoSocial: string;
    /** CNPJ ou CPF — apenas dígitos ou com pontuação (normalizado internamente). */
    documentoFiscal: string;
    dadosFiscaisJson: Record<string, unknown>;
    dadosContatoJson: Record<string, unknown>;
  };
  /** Descrição legível dos itens, ex: "Dianteiro 2un, Central 1un". */
  itensDescricao: string;
  /** Peso total NUMERIC(10,3) como string, ex: "125.500". */
  pesoTotalKg: string;
  /** Valor do serviço NUMERIC(15,2) como string, ex: "1500.00". */
  valor: string;
}

export interface DadosFiscaisEmissao {
  /** faturamento.codigo_servico_atividade — tag <Atividade>, ex: "14.01". */
  atividade: string;
  /** faturamento.simples_nacional. */
  simplesNacional: boolean;
  /** faturamento.modelo_fiscal. */
  modeloFiscal: 'padrao' | 'rtc';
  /** Obrigatórios apenas quando modeloFiscal='rtc'. */
  rtc?: { classTrib: string; codigoNbs: string; indOperacao: string; idLocalIncidencia: string };
}

export interface DadosPrestador {
  razaoSocial: string;
  cnpj: string;
  inscricaoMunicipal: string;
  email?: string;
}

/**
 * Monta o EmitirNfseRequest sem chaveAutenticacao.
 * O campo chaveAutenticacao é omitido intencionalmente — injete-o apenas no adapter,
 * imediatamente antes do envio SOAP, e nunca persista o objeto completo.
 */
export function montarPayloadEiss(
  pedido: DadosPedidoParaNfse,
  fiscal: DadosFiscaisEmissao,
  homologacao: boolean,
  numeroRps: string,
  serieRps = 'A',
): Omit<EmitirNfseRequest, 'chaveAutenticacao'> {
  const docCliente = pedido.cliente.documentoFiscal.replace(/\D/g, '');
  const fiscalCliente = pedido.cliente.dadosFiscaisJson as Record<string, string | undefined>;
  const contato = pedido.cliente.dadosContatoJson as Record<string, string | undefined>;

  const tomador: PessoaDto = {
    nome: pedido.cliente.razaoSocial,
    ...(docCliente.length === 14 ? { cnpj: docCliente } : { cpf: docCliente }),
    inscricaoMunicipal: fiscalCliente['inscricao_municipal'],
    email: contato['email'] as string | undefined,
    endereco: {
      logradouro: fiscalCliente['logradouro'] as string | undefined,
      numero: fiscalCliente['numero'] as string | undefined,
      complemento: fiscalCliente['complemento'] as string | undefined,
      bairro: fiscalCliente['bairro'] as string | undefined,
      cidade: fiscalCliente['cidade'] as string | undefined,
      codigoCidadeIBGE: fiscalCliente['codigo_ibge'] as string | undefined,
      estado: fiscalCliente['uf'] as string | undefined,
      cep: (fiscalCliente['cep'] as string | undefined)?.replace(/\D/g, ''),
      pais: 'BRASIL',
    },
  };

  const informacoesAdicionais =
    `Distribuição de carnes — Pedido ${pedido.pedidoId} — ` +
    `${pedido.itensDescricao} — ${pedido.pesoTotalKg}kg`;

  const agora = new Date();

  return {
    homologacao,
    identificador: pedido.pedidoId,
    nrExercicioReferencia: agora.getFullYear(),
    nrMesReferencia: agora.getMonth() + 1,
    atividade: fiscal.atividade,
    aliquota: '0.00',
    valor: pedido.valor,
    valorDeducao: '0',
    informacoesAdicionais: informacoesAdicionais.slice(0, 2300),
    notificarTomadorPorEmail: true,
    substituicaoTributaria: false,
    semIncidenciaISS: false,
    simplesNacional: fiscal.simplesNacional,
    tomadorEstrangeiro: false,
    deduzirRepasse: false,
    tomador,
    modeloFiscal: fiscal.modeloFiscal,
    ...(fiscal.modeloFiscal === 'rtc' && fiscal.rtc
      ? {
          rtcClassTrib: fiscal.rtc.classTrib,
          rtcCodigoNbs: fiscal.rtc.codigoNbs,
          rtcIndOperacao: fiscal.rtc.indOperacao,
          rtcIdLocalIncidencia: fiscal.rtc.idLocalIncidencia,
        }
      : {}),
    numeroRps,
    serieRps,
    dataRps: agora.toISOString(),
  };
}
```
(`redigirSegredos` permanece inalterado — já cobre `chaveAutenticacao`/`ChaveAutenticacao`/`chave_autenticacao` recursivamente.)

- [ ] Step 3b — `test/unit/payload-builder.spec.ts`: reescrever as asserções para o shape novo, campo a campo contra `docs/integrações/nfse-osasco/exemplos/emitir-request.xml` (tag `<Atividade>14.01</Atividade>` → `atividade: '14.01'`; `<SemIncidenciaISS>false</SemIncidenciaISS>` → `semIncidenciaISS: false`; `<DeduzirRepasse>false</DeduzirRepasse>` → `deduzirRepasse: false`; sem `prestador` no objeto retornado). Nome do teste âncora do DoD 10.1:
```ts
it('DoD 10.1 payload padrao segue estrutura do manual V10.6', () => {
  const payload = montarPayloadEiss(
    { pedidoId: 'PED-000984', cliente: CLIENTE_FAKE, itensDescricao: 'Contrafilé', pesoTotalKg: '1256.300', valor: '15000.00' },
    { atividade: '14.01', simplesNacional: false, modeloFiscal: 'padrao' },
    true, 'RPS-1',
  );
  expect(payload.atividade).toBe('14.01');
  expect(payload.semIncidenciaISS).toBe(false);
  expect(payload.simplesNacional).toBe(false);
  expect(payload.tomadorEstrangeiro).toBe(false);
  expect(payload.deduzirRepasse).toBe(false);
  expect(payload.aliquota).toBe('0.00');
  expect(payload).not.toHaveProperty('prestador');
});
```
Comando:
```bash
cd app/backend && npx jest test/unit/payload-builder.spec.ts
```
Saída esperada: `Tests: N passed, 0 failed` (todos os `it` do arquivo, incluindo o DoD 10.1 acima).

- [ ] Step 4 — `eiss-client.adapter.ts`: nova implementação via template string + `fetch` nativo (D10.11 — FIXADO, sem WSDL/node-soap). Namespaces e envelopes literais de `docs/integrações/nfse-osasco/eiss-webservice.md` e dos exemplos em `docs/integrações/nfse-osasco/exemplos/*.xml`:
```ts
import { Injectable, Logger } from '@nestjs/common';
import type {
  NfseGateway,
  NfseResultado,
  EmitirNfseRequest,
  CancelarNfseRequest,
  ConsultarNfseRequest,
  RtcPesquisaNbsClassTrib,
} from './nfse.types';
import { NfseTransporteError } from './nfse.types';
import { redigirSegredos } from './payload-builder';

const NS = {
  tem: 'http://tempuri.org/',
  eis: 'http://schemas.datacontract.org/2004/07/Eissnfe.Negocio.WebServices.Mensagem',
  eis1: 'http://schemas.datacontract.org/2004/07/Eissnfe.Dominio.DataTransferObject.Prestador',
  eis2: 'http://schemas.datacontract.org/2004/07/Eissnfe.Dominio.DataTransferObject.Contribuinte',
};

function endpoint(homologacao: boolean): string {
  const url = homologacao ? process.env['EISS_ENDPOINT_HML'] : process.env['EISS_ENDPOINT_PRD'];
  if (!url) throw new Error(`Variável EISS_ENDPOINT_${homologacao ? 'HML' : 'PRD'} não configurada`);
  return url;
}

/** Escapa entidades XML nos valores de texto interpolados no envelope. */
function xmlEscape(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Extrai o conteúdo de texto da primeira ocorrência de uma tag XML (regex simples — shape estável dos manuais). */
function tag(xml: string, nome: string): string | undefined {
  const m = xml.match(new RegExp(`<[\\w:]*${nome}[^>]*>([^<]*)</[\\w:]*${nome}>`));
  return m?.[1];
}

@Injectable()
export class EissClientAdapter implements NfseGateway {
  private readonly logger = new Logger(EissClientAdapter.name);

  async emitir(req: EmitirNfseRequest): Promise<NfseResultado> {
    const metodo = req.modeloFiscal === 'rtc' ? 'RTC_EmitirNFE' : 'Emitir';
    const tagNota = req.modeloFiscal === 'rtc' ? 'NotaFiscal_RTC' : 'NotaFiscal';
    const camposRtc = req.modeloFiscal === 'rtc'
      ? `<eis1:ClassTrib>${xmlEscape(req.rtcClassTrib)}</eis1:ClassTrib>
          <eis1:CodigoNBS>${xmlEscape(req.rtcCodigoNbs)}</eis1:CodigoNBS>
          <eis1:IndOperacao>${xmlEscape(req.rtcIndOperacao)}</eis1:IndOperacao>
          <eis1:IdLocalIncidencia>${xmlEscape(req.rtcIdLocalIncidencia)}</eis1:IdLocalIncidencia>`
      : '';
    const corpo = `<eis:${tagNota}>
          <eis1:ChaveAutenticacao>${xmlEscape(req.chaveAutenticacao)}</eis1:ChaveAutenticacao>
          <eis1:Homologacao>${req.homologacao}</eis1:Homologacao>
          <eis1:Identificador>${xmlEscape(req.identificador)}</eis1:Identificador>
          <eis1:nrExercicioReferencia>${req.nrExercicioReferencia}</eis1:nrExercicioReferencia>
          <eis1:nrMesReferencia>${req.nrMesReferencia}</eis1:nrMesReferencia>
          <eis1:Atividade>${xmlEscape(req.atividade)}</eis1:Atividade>
          <eis1:Aliquota>${xmlEscape(req.aliquota)}</eis1:Aliquota>
          <eis1:SubstituicaoTributaria>${req.substituicaoTributaria}</eis1:SubstituicaoTributaria>
          <eis1:SemIncidenciaISS>${req.semIncidenciaISS}</eis1:SemIncidenciaISS>
          <eis1:SimplesNacional>${req.simplesNacional}</eis1:SimplesNacional>
          <eis1:TomadorEstrangeiro>${req.tomadorEstrangeiro}</eis1:TomadorEstrangeiro>
          <eis1:Tomador>
            ${req.tomador.cnpj ? `<eis2:CNPJ>${xmlEscape(req.tomador.cnpj)}</eis2:CNPJ>` : `<eis2:CPF>${xmlEscape(req.tomador.cpf)}</eis2:CPF>`}
            <eis2:Nome>${xmlEscape(req.tomador.nome)}</eis2:Nome>
            ${req.tomador.email ? `<eis2:Email>${xmlEscape(req.tomador.email)}</eis2:Email>` : ''}
          </eis1:Tomador>
          <eis1:NotificarTomadorPorEmail>${req.notificarTomadorPorEmail}</eis1:NotificarTomadorPorEmail>
          <eis1:InformacoesAdicionais>${xmlEscape(req.informacoesAdicionais)}</eis1:InformacoesAdicionais>
          <eis1:Valor>${xmlEscape(req.valor)}</eis1:Valor>
          <eis1:DeduzirRepasse>${req.deduzirRepasse}</eis1:DeduzirRepasse>
          ${camposRtc}
        </eis:${tagNota}>`;
    const envelope = this.envelopeComNs(`<tem:${metodo}><tem:request>${corpo}</tem:request></tem:${metodo}>`, true);
    return this.chamar(metodo, envelope, req.homologacao, `${metodo}Result`);
  }

  async cancelar(req: CancelarNfseRequest): Promise<NfseResultado> {
    const corpo = `<eis:ChaveAutenticacao>${xmlEscape(req.chaveAutenticacao)}</eis:ChaveAutenticacao>
        <eis:Homologacao>${req.homologacao}</eis:Homologacao>
        <eis:NumeroNota>${xmlEscape(req.numeroNota)}</eis:NumeroNota>
        <eis:Motivo>${xmlEscape(req.motivoCancelamento)}</eis:Motivo>`;
    const envelope = this.envelopeComNs(`<tem:Cancelar><tem:request>${corpo}</tem:request></tem:Cancelar>`, false);
    return this.chamar('Cancelar', envelope, req.homologacao, 'CancelarResult');
  }

  async consultarNotaCompleta(req: ConsultarNfseRequest): Promise<NfseResultado> {
    const inicial = req.numeroNotaInicial ?? '';
    const corpo = `<eis:ChaveAutenticacao>${xmlEscape(req.chaveAutenticacao)}</eis:ChaveAutenticacao>
        <eis:NumeroNotaInicial>${xmlEscape(inicial)}</eis:NumeroNotaInicial>
        <eis:NumeroNotaFinal>${xmlEscape(req.numeroNotaFinal ?? inicial)}</eis:NumeroNotaFinal>`;
    const envelope = this.envelopeComNs(`<tem:ConsultarNotaCompleta><tem:request>${corpo}</tem:request></tem:ConsultarNotaCompleta>`, false);
    return this.chamar('ConsultarNotaCompleta', envelope, req.homologacao, 'ConsultarNotaCompletaResult');
  }

  async rtcPesquisarNbsClassTrib(
    chaveAutenticacao: string, homologacao: boolean, atividade: string,
  ): Promise<RtcPesquisaNbsClassTrib[]> {
    const corpo = `<eis:ChaveAutenticacao>${xmlEscape(chaveAutenticacao)}</eis:ChaveAutenticacao>
        <eis:CodigoAtividade>${xmlEscape(atividade)}</eis:CodigoAtividade>`;
    const envelope = this.envelopeComNs(`<tem:RTC_PesquisarNbsClassTrib><tem:request>${corpo}</tem:request></tem:RTC_PesquisarNbsClassTrib>`, false);
    const resposta = await this.enviar('RTC_PesquisarNbsClassTrib', envelope, homologacao);
    // Resposta em lista: cada ocorrência de <CodigoNBS>/<ClassTrib>/<Descricao> — parse simples por regex global.
    const nbs = [...resposta.matchAll(/<[\w:]*CodigoNBS[^>]*>([^<]*)</g)].map((m) => m[1]);
    const classTrib = [...resposta.matchAll(/<[\w:]*ClassTrib[^>]*>([^<]*)</g)].map((m) => m[1]);
    const descricao = [...resposta.matchAll(/<[\w:]*Descricao[^>]*>([^<]*)</g)].map((m) => m[1]);
    return nbs.map((codigoNbs, i) => ({ codigoNbs, classTrib: classTrib[i] ?? '', descricao: descricao[i] ?? '' }));
  }

  private envelopeComNs(corpo: string, comEis1Eis2: boolean): string {
    const declaracoes = comEis1Eis2
      ? `xmlns:eis1="${NS.eis1}" xmlns:eis2="${NS.eis2}"`
      : '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="${NS.tem}" xmlns:eis="${NS.eis}" ${declaracoes}>
  <soapenv:Header/>
  <soapenv:Body>${corpo}</soapenv:Body>
</soapenv:Envelope>`;
  }

  /** POST HTTPS com SOAPAction + timeout; lança NfseTransporteError em falha de rede/timeout/5xx. */
  private async enviar(metodo: string, envelope: string, homologacao: boolean): Promise<string> {
    const timeoutMs = parseInt(process.env['EISS_TIMEOUT_MS'] ?? '30000', 10);
    let resposta: Response;
    try {
      resposta = await fetch(endpoint(homologacao), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `http://tempuri.org/INotaFiscalEletronica/${metodo}`,
        },
        body: envelope,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new NfseTransporteError(`Falha de transporte EISS (${metodo}): ${(e as Error).message}`);
    }
    if (resposta.status >= 500) {
      throw new NfseTransporteError(`Falha de transporte EISS (${metodo}): HTTP ${resposta.status}`);
    }
    return resposta.text();
  }

  private async chamar(
    metodo: string, envelope: string, homologacao: boolean, tagResultado: string,
  ): Promise<NfseResultado> {
    const bruto = await this.enviar(metodo, envelope, homologacao);
    const erroTxt = tag(bruto, 'Erro');
    const erro = erroTxt === 'true';
    if (erro) {
      this.logger.warn(`EISS retornou Erro=true em ${metodo}: ${tag(bruto, 'MensagemErro')}`);
    }
    return {
      erro,
      mensagemErro: erro ? (tag(bruto, 'MensagemErro') ?? 'Erro de negócio EISS') : undefined,
      numeroNota: tag(bruto, 'Numero'),
      codigoVerificacao: tag(bruto, 'Autenticador'),
      linkNota: tag(bruto, 'Link'),
      identificadorEco: tag(bruto, 'Identificador'),
      raw: redigirSegredos({ tagResultado, xml: bruto }),
    };
  }
}
```

- [ ] Step 5 — `fake-nfse.gateway.ts`: D10.12 — adicionar gatilhos determinísticos por valor e o novo método `rtcPesquisarNbsClassTrib` (contrato da interface):
```ts
  async rtcPesquisarNbsClassTrib(): Promise<import('./nfse.types').RtcPesquisaNbsClassTrib[]> {
    return [{ codigoNbs: '111041000', classTrib: '000001', descricao: 'Fake — pesquisa determinística' }];
  }

  async emitir(req: EmitirNfseRequest): Promise<NfseResultado> {
    if (req.valor === '999.99') return { erro: true, mensagemErro: 'Atividade não autorizada', raw: {} };
    if (req.valor === '888.88') throw new NfseTransporteError('Timeout simulado (valor gatilho 888.88)');
    return { ...this.resolverCenario(), identificadorEco: req.identificador };
  }
```
(`cancelar`/`consultarNotaCompleta` mantêm assinatura e `resolverCenario()` inalterado — só `emitir` ganha o eco do `identificador` no shape de retorno.)

- [ ] Step 6 — `test/unit/eiss-adapter.spec.ts` (novo): `global.fetch` mockado via `jest.spyOn(global, 'fetch')` (sem lib de mock SOAP — o adapter usa `fetch` nativo). Casos:
```ts
beforeEach(() => {
  process.env['EISS_ENDPOINT_HML'] = 'https://hml.exemplo/EissnfeWebApp.svc';
});

it('DoD 10.2a Erro=true nao lanca', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    status: 200,
    text: async () => '<EmitirResponse><EmitirResult><a:Erro>true</a:Erro><a:MensagemErro>CNPJ inválido</a:MensagemErro></EmitirResult></EmitirResponse>',
  } as Response);
  const resultado = await adapter.emitir(REQ_FAKE);
  expect(resultado.erro).toBe(true);
  expect(resultado.mensagemErro).toBe('CNPJ inválido');
});

it('timeout de transporte lanca NfseTransporteError', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));
  await expect(adapter.emitir(REQ_FAKE)).rejects.toThrow(NfseTransporteError);
});

it('HTTP 500 lanca NfseTransporteError', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ status: 500, text: async () => '' } as Response);
  await expect(adapter.emitir(REQ_FAKE)).rejects.toThrow(NfseTransporteError);
});

it('redige ChaveAutenticacao do raw devolvido', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    status: 200,
    text: async () => `<EmitirResponse><EmitirResult><a:Erro>false</a:Erro><a:NotaFiscalGerada><b:Numero>1</b:Numero></a:NotaFiscalGerada></EmitirResult></EmitirResponse>`,
  } as Response);
  const resultado = await adapter.emitir(REQ_FAKE);
  expect(JSON.stringify(resultado.raw)).not.toContain(REQ_FAKE.chaveAutenticacao);
});
```
Comando:
```bash
cd app/backend && npx jest test/unit/eiss-adapter.spec.ts
```
Saída esperada: `Tests: 4 passed, 0 failed` (os 4 casos: Erro=true, timeout, HTTP 500, redação).

Commit: `feat(onda10): adapter EISS real (template string + fetch) + tipos D10.1 + fake com gatilhos determinísticos`

## Task 3 — FaturamentoService: mutex, RTC, trava

**Files:** `faturamento.service.ts`, `dto/faturamento.dto.ts`, `test/unit/faturamento-mutex.spec.ts`

- [ ] Step 1 — mutex de emissão (D10.3). Em `FaturamentoService`, adicionar o campo e o helper de encadeamento:
```ts
  /** D10.3 — fila em memória: serializa emissões (manual: "requisições simultâneas podem falhar ambas"). */
  private emissaoEmAndamento: Promise<unknown> = Promise.resolve();

  /** Encadeia `tarefa` após a emissão em andamento, garantindo execução em série. */
  private async serializarEmissao<T>(tarefa: () => Promise<T>): Promise<T> {
    const anterior = this.emissaoEmAndamento.catch(() => undefined);
    const atual = anterior.then(tarefa);
    this.emissaoEmAndamento = atual.catch(() => undefined);
    return atual;
  }
```
  Em `emitir(...)` e `reprocessar(...)`, envolver a chamada a `this.chamarGateway(...)` com `this.serializarEmissao(() => this.chamarGateway(...))`.

- [ ] Step 1b — ajustar `chamarGateway` ao novo shape de `ConsultarNfseRequest`/`EmitirNfseRequest` (T2 Step 2). O código atual (`faturamento.service.ts` linhas ~71-118) recebe `numeroRps`/`serieRps`/`prestadorNome`/`prestadorCnpjDigitos` só para montar `consultarNotaCompleta({ ..., numeroRps, serieRps, prestador: {...} })` no branch de timeout — esses 4 parâmetros somem porque `ConsultarNfseRequest` não tem mais `numeroRps`/`serieRps`/`prestador`. Como o gateway não devolveu `numeroNota` (foi timeout), não há número de nota para consultar por intervalo — a reconciliação usa exclusivamente o `identificador` (já presente em `reqComToken.identificador`, campo obrigatório de `EmitirNfseRequest` — T2 Step 2), deixando `numeroNotaInicial`/`numeroNotaFinal` (ambos opcionais na interface) de fora. Substituir o método inteiro:
```ts
  private async chamarGateway(
    reqComToken: EmitirNfseRequest,
    homologacao: boolean,
  ): Promise<GatewayResult> {
    let tentativas = 0;
    let resultado: NfseResultado | null = null;
    let erroFinal: Error | null = null;

    while (tentativas < RETRY_MAX) {
      try {
        const res = await this.gateway.emitir(reqComToken);
        if (!res.erro) { resultado = res; break; }
        // Erro de negócio EISS (Erro=true) — não-retriável, sair imediatamente
        erroFinal = new Error(res.mensagemErro ?? 'Erro de negócio EISS');
        resultado = res;
        break;
      } catch (e) {
        if (!(e instanceof NfseTransporteError)) { erroFinal = e as Error; break; }
        tentativas++;
        if (e.message.toLowerCase().includes('timeout')) {
          try {
            // Sem numeroNota (timeout na emissão) — reconciliação só por identificador (D10.1).
            const consulta = await this.gateway.consultarNotaCompleta({
              chaveAutenticacao: reqComToken.chaveAutenticacao,
              homologacao,
              identificador: reqComToken.identificador,
            });
            if (!consulta.erro && consulta.numeroNota) { resultado = consulta; break; }
          } catch { /* consulta falhou — seguir para retry */ }
        }
        if (tentativas < RETRY_MAX) {
          const delay = parseInt(
            process.env['EISS_RETRY_DELAY_MS'] ?? String(RETRY_DELAYS_MS[tentativas - 1] ?? 5000), 10,
          );
          await new Promise(r => setTimeout(r, delay));
        } else {
          erroFinal = e;
        }
      }
    }

    return { resultado, erroFinal, tentativas };
  }
```
  Ajustar as 2 chamadas existentes (`emitir`, linha ~287-291, e `reprocessar`, linha ~435-439) para o novo número de argumentos, já envolvidas por `serializarEmissao` (Step 1):
```ts
    const gwResult = await this.serializarEmissao(() => this.chamarGateway(
      { ...payloadBase, chaveAutenticacao } as EmitirNfseRequest,
      homologacao,
    ));
```
  (remove os argumentos `numeroRps, serieRps, prestador.razaoSocial, prestador.cnpj.replace(/\D/g, '')` das duas chamadas — `numeroRps`/`serieRps` continuam sendo usados normalmente pelo resto de `emitir`/`reprocessar`, só não são mais repassados a `chamarGateway`.)

- [ ] Step 2 — `test/unit/faturamento-mutex.spec.ts` (novo): 2 emissões concorrentes provam ordem serializada via spy:
```ts
it('DoD 10.4 emissoes concorrentes serializam', async () => {
  const ordem: string[] = [];
  const gatewayLento: Partial<NfseGateway> = {
    emitir: jest.fn(async (req) => {
      ordem.push(`inicio:${req.identificador}`);
      await new Promise((r) => setTimeout(r, 20));
      ordem.push(`fim:${req.identificador}`);
      return { erro: false, numeroNota: '1', raw: {} };
    }),
  };
  // service construído com gatewayLento — chamar emitir() 2x sem esperar a primeira
  await Promise.all([service.emitir(caminhaoId, { pedidoVendaId: 'A', valor: '10.00' }, userId),
                      service.emitir(caminhaoId, { pedidoVendaId: 'B', valor: '10.00' }, userId)]);
  expect(ordem).toEqual(['inicio:A', 'fim:A', 'inicio:B', 'fim:B']); // nunca inicio:B antes de fim:A
});
```
Comando:
```bash
cd app/backend && npx jest test/unit/faturamento-mutex.spec.ts
```
Saída esperada: `Tests: 1 passed, 0 failed`.

- [ ] Step 3 — SEM "emitir em lote" nesta onda (P-Onda10.3 — ver "Fora de escopo"; nenhum método `emitirLote` é criado). Pular direto para o Step 4.

- [ ] Step 4 — flag RTC (D10.2). Novo helper privado + uso em `emitir`/`reprocessar` antes de montar o payload:
```ts
  /** D10.2 — lê parâmetros fiscais e monta DadosFiscaisEmissao para o payload-builder. */
  private async buscarDadosFiscaisEmissao(): Promise<DadosFiscaisEmissao> {
    const linhas = await this.db.select().from(parametros).where(
      inArray(parametros.chave, [
        'faturamento.codigo_servico_atividade', 'faturamento.simples_nacional', 'faturamento.modelo_fiscal',
        'faturamento.rtc_class_trib', 'faturamento.rtc_codigo_nbs', 'faturamento.rtc_ind_operacao', 'faturamento.rtc_id_local_incidencia',
      ]),
    );
    const mapa = new Map(linhas.map((l) => [l.chave, (l.valorJson as { valor?: unknown })?.valor]));
    const modeloFiscal = (mapa.get('faturamento.modelo_fiscal') ?? 'padrao') as 'padrao' | 'rtc';
    const atividade = String(mapa.get('faturamento.codigo_servico_atividade') ?? '14.01');
    const simplesNacional = mapa.get('faturamento.simples_nacional') === true;

    if (modeloFiscal === 'rtc') {
      const rtc = {
        classTrib: String(mapa.get('faturamento.rtc_class_trib') ?? ''),
        codigoNbs: String(mapa.get('faturamento.rtc_codigo_nbs') ?? ''),
        indOperacao: String(mapa.get('faturamento.rtc_ind_operacao') ?? ''),
        idLocalIncidencia: String(mapa.get('faturamento.rtc_id_local_incidencia') ?? ''),
      };
      if (!rtc.classTrib || !rtc.codigoNbs || !rtc.indOperacao || !rtc.idLocalIncidencia) {
        throw new ConflictException({ codigo: 'RTC_PARAMETROS_INCOMPLETOS', message: 'Parâmetros RTC incompletos — configure faturamento.rtc_* antes de emitir' });
      }
      return { atividade, simplesNacional, modeloFiscal, rtc };
    }
    return { atividade, simplesNacional, modeloFiscal };
  }
```
  Em `emitir`/`reprocessar`, substituir `montarPayloadEiss(..., prestador, ...)` por `montarPayloadEiss(..., await this.buscarDadosFiscaisEmissao(), ...)` (assinatura nova de T2 Step 3) e, no `persistirResultadoEmissao`, gravar `modeloFiscal: payloadBase.modeloFiscal` no `.set({...})` da nota emitida/erro (D10.2 — "grava na nota o modelo usado").
  Adicionar `import { inArray } from 'drizzle-orm';` e `type { DadosFiscaisEmissao } from '../../../integracoes/nfse/payload-builder';` no topo do arquivo.

- [ ] Step 5 — trava de cancelamento pós-liberação (D10.4). No início de `cancelar(...)`, após buscar `nf` e antes de `assertTransicaoNfse`, adicionar o guard por status do caminhão:
```ts
    const caminhaoDaNota = await this.db.select({ statusCaminhao: caminhoes.statusCaminhao })
      .from(caminhoes).where(eq(caminhoes.id, nf.caminhaoId)).then((r) => r[0]);
    if (caminhaoDaNota && ['liberado_saida', 'expedido'].includes(caminhaoDaNota.statusCaminhao)) {
      throw new ConflictException({
        codigo: 'NOTA_TRAVADA_CAMINHAO_LIBERADO',
        message: 'Cancelamento bloqueado — caminhão já liberado',
      });
    }
```
(fica ANTES de qualquer chamada `this.gateway.cancelar(...)` — RA-05: nenhuma chamada SOAP acontece se a trava disparar.)

- [ ] Step 6 — rodar os testes unitários do módulo:
```bash
cd app/backend && npx jest test/unit/faturamento-mutex.spec.ts test/unit/payload-builder.spec.ts
```
Saída esperada: `Tests: N passed, 0 failed`, 0 failing.

Commit: `feat(onda10): mutex de emissao + flag RTC + trava de cancelamento pos-liberacao`

## Task 4 — Rotas de consulta

**Files:** `notas-consulta.service.ts` (novo), `faturamento.controller.ts`, `dto/faturamento.dto.ts`, `faturamento.module.ts`

- [ ] Step 1 — DTO de listagem em `dto/faturamento.dto.ts` (padrão `listarQuerySchema` — D10.8):
```ts
export const listarNotasQuerySchema = z.object({
  status: z.enum(['pendente', 'emitida', 'erro_emissao', 'cancelada', 'erro_cancelamento']).optional(),
  caminhaoId: z.string().uuid().optional(),
  clienteId: z.string().uuid().optional(),
  busca: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListarNotasQuery = z.infer<typeof listarNotasQuerySchema>;
```

- [ ] Step 2 — `notas-consulta.service.ts` (novo arquivo), `listar` (D10.8 — `busca` cobre `numero_nfse`, `codigo_verificacao` e nome do cliente ILIKE; envelope padrão `{data, total, page, pageSize}`):
```ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  notasFiscais, caminhoes, clientes, pedidosVenda, cargaItens, pecas, subitens, itensComerciais,
} from '../../../database/schema';
import { calcularRange, montarPaginado, type ListarNotasQuery } from './dto/faturamento.dto';

@Injectable()
export class NotasConsultaService {
  constructor(@Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> }) {}
  private get db() { return this.drizzle.db; }

  /** D10.8 — listagem paginada com filtros. */
  async listar(query: ListarNotasQuery) {
    const condicoes = [isNull(notasFiscais.deletedAt)];
    if (query.status) condicoes.push(eq(notasFiscais.statusNfse, query.status));
    if (query.caminhaoId) condicoes.push(eq(notasFiscais.caminhaoId, query.caminhaoId));
    if (query.clienteId) condicoes.push(eq(notasFiscais.clienteId, query.clienteId));
    if (query.busca) {
      const termo = `%${query.busca}%`;
      condicoes.push(or(
        ilike(notasFiscais.numeroNfse, termo),
        ilike(notasFiscais.codigoVerificacao, termo),
        ilike(clientes.razaoSocial, termo),
        ilike(clientes.nomeFantasia, termo),
      )!);
    }

    const { limit, offset } = calcularRange(query);
    const base = this.db.select({ nota: notasFiscais, cliente: clientes, caminhao: caminhoes })
      .from(notasFiscais)
      .innerJoin(clientes, eq(clientes.id, notasFiscais.clienteId))
      .innerJoin(caminhoes, eq(caminhoes.id, notasFiscais.caminhaoId))
      .where(and(...condicoes));

    const [linhas, [{ total }]] = await Promise.all([
      base.orderBy(desc(notasFiscais.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(notasFiscais)
        .innerJoin(clientes, eq(clientes.id, notasFiscais.clienteId)).where(and(...condicoes)),
    ]);

    return montarPaginado(
      linhas.map((l) => ({
        ...l.nota,
        clienteNome: l.cliente.nomeFantasia ?? l.cliente.razaoSocial,
        // D10.7/T9 — trava visual de cancelamento no client (NotasXml.tsx:485-497).
        caminhaoLiberado: ['liberado_saida', 'expedido'].includes(l.caminhao.statusCaminhao),
      })),
      total, query,
    );
  }

  /** D10.7 — cadeia nota → pedido → carga_itens → peças/subitens (etiqueta, produto, peso) → totais. Somente leitura. */
  async rastreabilidade(notaFiscalId: string) {
    const nota = await this.db.select().from(notasFiscais)
      .where(and(eq(notasFiscais.id, notaFiscalId), isNull(notasFiscais.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!nota) throw new NotFoundException('Nota fiscal não encontrada');

    const pedido = await this.db.select({ pedido: pedidosVenda, cliente: clientes })
      .from(pedidosVenda).innerJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
      .where(eq(pedidosVenda.id, nota.pedidoVendaId)).then((r) => r[0] ?? null);

    const itensPeca = await this.db.select({
      etiqueta: pecas.etiquetaAtual, produtoNome: itensComerciais.descricao, peso: pecas.pesoOriginal,
    }).from(cargaItens)
      .innerJoin(pecas, eq(pecas.id, cargaItens.pecaId))
      .innerJoin(itensComerciais, eq(itensComerciais.id, pecas.itemComercialBaseId))
      .where(and(eq(cargaItens.caminhaoId, nota.caminhaoId), eq(cargaItens.pedidoVendaId, nota.pedidoVendaId), eq(cargaItens.tipoOrigem, 'peca')));

    const itensSubitem = await this.db.select({
      etiqueta: subitens.etiquetaAtual, produtoNome: itensComerciais.descricao, peso: subitens.peso,
    }).from(cargaItens)
      .innerJoin(subitens, eq(subitens.id, cargaItens.subitemId))
      .innerJoin(itensComerciais, eq(itensComerciais.id, subitens.itemComercialId))
      .where(and(eq(cargaItens.caminhaoId, nota.caminhaoId), eq(cargaItens.pedidoVendaId, nota.pedidoVendaId), eq(cargaItens.tipoOrigem, 'subitem')));

    const pecasRastreio = [...itensPeca, ...itensSubitem];
    return {
      nota,
      pedido: pedido ? { id: pedido.pedido.id, clienteNome: pedido.cliente.nomeFantasia ?? pedido.cliente.razaoSocial } : null,
      pecas: pecasRastreio,
      pesoTotalKg: pecasRastreio.reduce((acc, p) => acc + Number(p.peso ?? 0), 0).toFixed(3),
    };
  }
}
```

- [ ] Step 3 — endpoints em `faturamento.controller.ts` (injetar `NotasConsultaService` no construtor). **Ordem importa** — nenhuma colisão de rota aqui pois os prefixos são distintos de `caminhoes/:caminhaoId`, mas `notas/:notaId/...` já existe; adicionar as rotas de leitura ANTES de qualquer rota futura com padrão coincidente:
```ts
  @Get('notas')
  @RequirePermissoes('FATURAMENTO_LER')
  listarNotas(@Query(new ZodValidationPipe(listarNotasQuerySchema)) query: ListarNotasQuery) {
    return this.notasConsulta.listar(query);
  }

  @Get('notas/:id/rastreabilidade')
  @RequirePermissoes('FATURAMENTO_LER')
  rastreabilidade(@Param('id') id: string) {
    return this.notasConsulta.rastreabilidade(id);
  }

  @Get('rtc/pesquisar-nbs')
  @RequirePermissoes('FATURAMENTO_GERENCIAR')
  rtcPesquisarNbs(@Query('atividade') atividade: string) {
    return this.faturamento.rtcPesquisarNbs(atividade);
  }
```
Adicionar em `FaturamentoService` (mesmo padrão de resolução de `homologacao`/`chaveAutenticacao` já usado em `cancelar`, linhas 313-316 do arquivo atual):
```ts
  /** Repasse fino ao gateway RTC — pesquisa NBS/ClassTrib por atividade (D10.2). */
  async rtcPesquisarNbs(atividade: string) {
    const homologacao = process.env['EISS_HOMOLOGACAO'] !== 'false';
    const chaveAutenticacao = homologacao
      ? (process.env['EISS_CHAVE_AUTENTICACAO_HML'] ?? '')
      : (process.env['EISS_CHAVE_AUTENTICACAO_PRD'] ?? '');
    return this.gateway.rtcPesquisarNbsClassTrib(chaveAutenticacao, homologacao, atividade);
  }
```

- [ ] Step 4 — registrar `NotasConsultaService` em `faturamento.module.ts` (`providers` e `exports`).

- [ ] Step 5 — conferir tipagem e lint do módulo:
```bash
cd app/backend && npx tsc --noEmit -p . && npx eslint src/modules/operacao/faturamento
```
Saída esperada: `0` erros TypeScript; ESLint sem erros (warnings, se houver, não bloqueiam).

Commit: `feat(onda10): listagem de notas + rastreabilidade + pesquisa RTC`

## Task 5 — Seguros (F6b)

**Files:** `seguros.service.ts` (novo), `dto/faturamento.dto.ts`, `faturamento.controller.ts`, `faturamento.module.ts`, `test/unit/seguros-regras.spec.ts`

- [ ] Step 1 — transições válidas (D10.5) em um arquivo auxiliar `transicoes-seguro.ts` (espelho de `transicoes-nfse.ts`):
```ts
export type StatusSeguro = 'pendente' | 'enviado' | 'confirmado';

const TRANSICOES_SEGURO: Record<StatusSeguro, StatusSeguro[]> = {
  pendente:   ['enviado'],
  enviado:    ['confirmado', 'pendente'], // regressão auditada (D10.5)
  confirmado: [], // terminal — correção = soft delete + novo registro
};

export function assertTransicaoSeguro(atual: StatusSeguro, para: StatusSeguro): void {
  if (!TRANSICOES_SEGURO[atual]?.includes(para)) {
    throw new Error(`Transição de seguro inválida: ${atual} → ${para}`);
  }
}
```

- [ ] Step 2 — DTOs em `dto/faturamento.dto.ts`:
```ts
export const listarSegurosQuerySchema = z.object({
  status: z.enum(['pendente', 'enviado', 'confirmado']).optional(),
  busca: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListarSegurosQuery = z.infer<typeof listarSegurosQuerySchema>;

export const criarSeguroSchema = z.object({ caminhaoId: z.string().uuid() });
export type CriarSeguroDto = z.infer<typeof criarSeguroSchema>;

export const alterarStatusSeguroSchema = z.object({
  status: z.enum(['pendente', 'enviado', 'confirmado']),
});
export type AlterarStatusSeguroDto = z.infer<typeof alterarStatusSeguroSchema>;

export const registrarAnexoSeguroSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(500).optional(),
});
export type RegistrarAnexoSeguroDto = z.infer<typeof registrarAnexoSeguroSchema>;

export const salvarObservacaoSeguroSchema = z.object({
  observacao: z.string().trim().max(2000),
});
export type SalvarObservacaoSeguroDto = z.infer<typeof salvarObservacaoSeguroSchema>;
```

- [ ] Step 3 — `seguros.service.ts` (novo):
```ts
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { segurosCarga, caminhoes, operacoes, notasFiscais } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { montarPaginado, calcularRange, type ListarSegurosQuery } from './dto/faturamento.dto';
import { EVENTOS } from '../../../realtime/events/eventos';
import { assertTransicaoSeguro, type StatusSeguro } from './transicoes-seguro';

@Injectable()
export class SegurosService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  private get db() { return this.drizzle.db; }

  /** Listagem com dados do caminhão/carga + notas vinculadas. */
  async listar(query: ListarSegurosQuery) {
    const condicoes = [isNull(segurosCarga.deletedAt)];
    if (query.status) condicoes.push(eq(segurosCarga.status, query.status));
    if (query.busca) {
      const termo = `%${query.busca}%`;
      condicoes.push(or(ilike(caminhoes.placa, termo), ilike(caminhoes.motorista, termo))!);
    }
    const { limit, offset } = calcularRange(query);
    const base = this.db.select({ seguro: segurosCarga, caminhao: caminhoes })
      .from(segurosCarga).innerJoin(caminhoes, eq(caminhoes.id, segurosCarga.caminhaoId))
      .where(and(...condicoes));

    const [linhas, [{ total }]] = await Promise.all([
      base.orderBy(desc(segurosCarga.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(segurosCarga)
        .innerJoin(caminhoes, eq(caminhoes.id, segurosCarga.caminhaoId)).where(and(...condicoes)),
    ]);
    return montarPaginado(linhas.map((l) => ({ ...l.seguro, caminhao: l.caminhao })), total, query);
  }

  /** Cria (lazy, idempotente por caminhaoId) ou retorna o seguro vivo do caminhão. */
  async obterOuCriar(caminhaoId: string, usuarioId: string) {
    const existente = await this.db.select().from(segurosCarga)
      .where(and(eq(segurosCarga.caminhaoId, caminhaoId), isNull(segurosCarga.deletedAt)))
      .then((r) => r[0] ?? null);
    if (existente) return existente;

    const caminhao = await this.db.select().from(caminhoes)
      .where(and(eq(caminhoes.id, caminhaoId), isNull(caminhoes.deletedAt))).then((r) => r[0] ?? null);
    if (!caminhao) throw new NotFoundException('Caminhão não encontrado');

    try {
      return await this.db.transaction(async (tx) => {
        const [seguro] = await tx.insert(segurosCarga).values({ caminhaoId, status: 'pendente' })
          .onConflictDoNothing().returning();
        if (!seguro) throw new ConflictException('Seguro já existe para este caminhão');
        await this.auditoria.registrar(tx, {
          tabela: 'seguros_carga', registroId: seguro.id, operacao: 'INSERT',
          modulo: 'faturamento', usuarioId, dadosNovos: seguro,
        });
        return seguro;
      });
    } catch (e) {
      if ((e as { code?: string })?.code === '23505') {
        return primeiroOuFalha(
          await this.db.select().from(segurosCarga)
            .where(and(eq(segurosCarga.caminhaoId, caminhaoId), isNull(segurosCarga.deletedAt))),
        );
      }
      throw e;
    }
  }

  /** Transição de status (D10.5) — 409 TRANSICAO_SEGURO_INVALIDA se fora do grafo. */
  async alterarStatus(seguroId: string, novoStatus: StatusSeguro, usuarioId: string) {
    const seguro = await this.db.select().from(segurosCarga)
      .where(and(eq(segurosCarga.id, seguroId), isNull(segurosCarga.deletedAt))).then((r) => r[0] ?? null);
    if (!seguro) throw new NotFoundException('Seguro não encontrado');

    try {
      assertTransicaoSeguro(seguro.status as StatusSeguro, novoStatus);
    } catch {
      throw new ConflictException({ codigo: 'TRANSICAO_SEGURO_INVALIDA', message: `Transição inválida: ${seguro.status} → ${novoStatus}` });
    }

    const patch: Partial<typeof segurosCarga.$inferInsert> = { status: novoStatus };
    if (novoStatus === 'enviado') { patch.enviadoEm = new Date(); patch.responsavelId = usuarioId; }
    if (novoStatus === 'confirmado') { patch.confirmadoEm = new Date(); }
    if (novoStatus === 'pendente') { patch.enviadoEm = null; }

    const atualizado = await this.db.transaction(async (tx) => {
      const [row] = await tx.update(segurosCarga).set(patch).where(eq(segurosCarga.id, seguroId)).returning();
      if (!row) throw new Error('Falha ao atualizar seguro');
      await this.auditoria.registrar(tx, {
        tabela: 'seguros_carga', registroId: seguroId, operacao: 'UPDATE',
        modulo: 'faturamento', usuarioId, dadosAnteriores: seguro, dadosNovos: row,
      });
      return row;
    });

    const dataOperacao = await this.db.select({ data: operacoes.data }).from(operacoes)
      .innerJoin(caminhoes, eq(caminhoes.operacaoId, operacoes.id))
      .where(eq(caminhoes.id, seguro.caminhaoId)).then((r) => r[0]?.data ?? '');
    this.eventEmitter.emit(EVENTOS.SEGURO_ATUALIZADO, {
      caminhaoId: seguro.caminhaoId, seguroId, status: novoStatus, dataOperacao,
    });

    return atualizado;
  }

  /** Anexo referencial (P-Onda10.1 — nome/descrição, sem upload físico). */
  async registrarAnexo(seguroId: string, nome: string, descricao: string | undefined, usuarioId: string) {
    const seguro = await this.db.select().from(segurosCarga)
      .where(and(eq(segurosCarga.id, seguroId), isNull(segurosCarga.deletedAt))).then((r) => r[0] ?? null);
    if (!seguro) throw new NotFoundException('Seguro não encontrado');

    const anexos = [...(seguro.anexosJson as unknown[]), { nome, descricao, registradoEm: new Date().toISOString(), registradoPor: usuarioId }];
    return this.db.transaction(async (tx) => {
      const [row] = await tx.update(segurosCarga).set({ anexosJson: anexos }).where(eq(segurosCarga.id, seguroId)).returning();
      if (!row) throw new Error('Falha ao registrar anexo');
      await this.auditoria.registrar(tx, {
        tabela: 'seguros_carga', registroId: seguroId, operacao: 'UPDATE',
        modulo: 'faturamento', usuarioId, dadosAnteriores: seguro, dadosNovos: row,
      });
      return row;
    });
  }

  /** Observação editável (sem regra de transição — texto livre). */
  async salvarObservacao(seguroId: string, observacao: string, usuarioId: string) {
    const seguro = await this.db.select().from(segurosCarga)
      .where(and(eq(segurosCarga.id, seguroId), isNull(segurosCarga.deletedAt))).then((r) => r[0] ?? null);
    if (!seguro) throw new NotFoundException('Seguro não encontrado');
    return this.db.transaction(async (tx) => {
      const [row] = await tx.update(segurosCarga).set({ observacao }).where(eq(segurosCarga.id, seguroId)).returning();
      if (!row) throw new Error('Falha ao salvar observação');
      await this.auditoria.registrar(tx, {
        tabela: 'seguros_carga', registroId: seguroId, operacao: 'UPDATE',
        modulo: 'faturamento', usuarioId, dadosAnteriores: seguro, dadosNovos: row,
      });
      return row;
    });
  }
}
```
(usar `notasFiscais` import somente se a listagem embutir notas vinculadas — se não usado, remover do import para não falhar lint `no-unused-vars`.)

- [ ] Step 4 — evento novo `SEGURO_ATUALIZADO` em `eventos.ts` (D10.10 — payload e handler ficam em T7; aqui só a chave usada em `alterarStatus`):
```ts
  // ── Onda 10 — Faturamento / Seguro / Liberação ─────────────────────────────
  SEGURO_ATUALIZADO: 'seguro_atualizado',
```
(inserir após `CARGA_ITEM_DIVERGENTE` no objeto `EVENTOS`.)

- [ ] Step 5 — rotas em `faturamento.controller.ts` (injetar `SegurosService`):
```ts
  @Get('seguros')
  @RequireQualquerPermissao('FATURAMENTO_LER', 'SEGURO_GERENCIAR')
  listarSeguros(@Query(new ZodValidationPipe(listarSegurosQuerySchema)) query: ListarSegurosQuery) {
    return this.seguros.listar(query);
  }

  @Post('seguros')
  @RequireQualquerPermissao('FATURAMENTO_LER', 'SEGURO_GERENCIAR')
  criarSeguro(@Body(new ZodValidationPipe(criarSeguroSchema)) dto: CriarSeguroDto, @CurrentUser() user: CurrentUserPayload) {
    return this.seguros.obterOuCriar(dto.caminhaoId, user.sub);
  }

  @Patch('seguros/:id/status')
  @RequirePermissoes('SEGURO_GERENCIAR')
  alterarStatusSeguro(@Param('id') id: string, @Body(new ZodValidationPipe(alterarStatusSeguroSchema)) dto: AlterarStatusSeguroDto, @CurrentUser() user: CurrentUserPayload) {
    return this.seguros.alterarStatus(id, dto.status, user.sub);
  }

  @Post('seguros/:id/anexos')
  @RequirePermissoes('SEGURO_GERENCIAR')
  registrarAnexoSeguro(@Param('id') id: string, @Body(new ZodValidationPipe(registrarAnexoSeguroSchema)) dto: RegistrarAnexoSeguroDto, @CurrentUser() user: CurrentUserPayload) {
    return this.seguros.registrarAnexo(id, dto.nome, dto.descricao, user.sub);
  }

  @Patch('seguros/:id/observacao')
  @RequirePermissoes('SEGURO_GERENCIAR')
  salvarObservacaoSeguro(@Param('id') id: string, @Body(new ZodValidationPipe(salvarObservacaoSeguroSchema)) dto: SalvarObservacaoSeguroDto, @CurrentUser() user: CurrentUserPayload) {
    return this.seguros.salvarObservacao(id, dto.observacao, user.sub);
  }
```
(`@Patch` exige importar `Patch` de `@nestjs/common` no topo do controller.)

- [ ] Step 6 — registrar `SegurosService` em `faturamento.module.ts`.

- [ ] Step 7 — `test/unit/seguros-regras.spec.ts` (novo). Nomes literais do mapa DoD:
```ts
describe('Seguros — transições (D10.5)', () => {
  it('DoD 10.10 transicoes de seguro', async () => {
    await expect(service.alterarStatus(seguroId, 'enviado', userId)).resolves.toMatchObject({ status: 'enviado' });
    await expect(service.alterarStatus(seguroId, 'confirmado', userId)).resolves.toMatchObject({ status: 'confirmado' });
  });

  it('rejeita transicao invalida pendente->confirmado com 409 TRANSICAO_SEGURO_INVALIDA', async () => {
    await expect(service.alterarStatus(seguroPendenteId, 'confirmado', userId)).rejects.toMatchObject({
      response: { codigo: 'TRANSICAO_SEGURO_INVALIDA' },
    });
  });

  it('confirmado e terminal — rejeita confirmado->enviado', async () => {
    await expect(service.alterarStatus(seguroConfirmadoId, 'enviado', userId)).rejects.toMatchObject({
      response: { codigo: 'TRANSICAO_SEGURO_INVALIDA' },
    });
  });

  it('unicidade parcial — obterOuCriar e idempotente por caminhaoId', async () => {
    const a = await service.obterOuCriar(caminhaoId, userId);
    const b = await service.obterOuCriar(caminhaoId, userId);
    expect(a.id).toBe(b.id);
  });
});
```
Comando:
```bash
cd app/backend && npx jest test/unit/seguros-regras.spec.ts
```
Saída esperada: `Tests: 4 passed, 0 failed`.

Commit: `feat(onda10): seguros de carga F6b — transicoes, anexos referenciais e observacao`

## Task 6 — Checklist de liberação

**Files:** `liberacao-checklist.service.ts` (novo), `faturamento.controller.ts`, `faturamento.module.ts`, `liberacao.service.ts` (expedicao), `eventos.ts`, `test/unit/liberacao-checklist.spec.ts`

- [ ] Step 1 — `liberacao-checklist.service.ts` (novo), cálculo D10.6:
```ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { caminhoes, cargaItens, notasFiscais, segurosCarga, parametros } from '../../../database/schema';

export interface RequisitoChecklist {
  chave: 'cargaConferida' | 'notasAutorizadas' | 'seguroConfirmado' | 'caminhaoMotorista';
  rotulo: string;
  ok: boolean;
  detalhe: string;
}

const STATUS_CARGA_CONFERIDA = ['fechado', 'liberado_faturamento', 'faturado', 'liberado_saida', 'expedido'];

@Injectable()
export class LiberacaoChecklistService {
  constructor(@Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> }) {}
  private get db() { return this.drizzle.db; }

  /** D10.6 — checklist calculado sem tabela própria. */
  async calcular(caminhaoId: string): Promise<{ requisitos: RequisitoChecklist[]; liberavel: boolean }> {
    const caminhao = await this.db.select().from(caminhoes)
      .where(and(eq(caminhoes.id, caminhaoId), isNull(caminhoes.deletedAt))).then((r) => r[0] ?? null);
    if (!caminhao) throw new NotFoundException('Caminhão não encontrado');

    // (1) cargaConferida
    const cargaConferida = STATUS_CARGA_CONFERIDA.includes(caminhao.statusCaminhao);

    // (2) notasAutorizadas — pedidos da carga vs notas emitidas
    const itensCarga = await this.db.select({ pedidoVendaId: cargaItens.pedidoVendaId }).from(cargaItens)
      .where(and(eq(cargaItens.caminhaoId, caminhaoId), ne(cargaItens.statusCargaItem, 'removido'), isNull(cargaItens.deletedAt)));
    const pedidoIds = [...new Set(itensCarga.map((i) => i.pedidoVendaId))];
    const notas = pedidoIds.length
      ? await this.db.select().from(notasFiscais).where(and(inArray(notasFiscais.pedidoVendaId, pedidoIds), isNull(notasFiscais.deletedAt)))
      : [];
    const notasAutorizadas = notas.filter((n) => n.statusNfse === 'emitida').length;
    const notasTotal = pedidoIds.length;

    // (3) seguroConfirmado — dispensável por parâmetro faturamento.seguro_obrigatorio
    const seguroObrigatorioParam = await this.db.select().from(parametros)
      .where(eq(parametros.chave, 'faturamento.seguro_obrigatorio')).then((r) => r[0] ?? null);
    const seguroObrigatorio = (seguroObrigatorioParam?.valorJson as { valor?: unknown })?.valor !== false;
    const seguro = await this.db.select().from(segurosCarga)
      .where(and(eq(segurosCarga.caminhaoId, caminhaoId), isNull(segurosCarga.deletedAt))).then((r) => r[0] ?? null);
    const seguroOk = !seguroObrigatorio || seguro?.status === 'confirmado';

    // (4) caminhaoMotorista
    const caminhaoMotoristaOk = Boolean(caminhao.placa?.trim()) && Boolean(caminhao.motorista?.trim());

    const requisitos: RequisitoChecklist[] = [
      { chave: 'cargaConferida', rotulo: 'Carga conferida', ok: cargaConferida, detalhe: cargaConferida ? 'Conferência concluída' : 'Não conferida' },
      { chave: 'notasAutorizadas', rotulo: 'NF-e(s) autorizadas', ok: notasTotal > 0 && notasAutorizadas === notasTotal, detalhe: `${notasAutorizadas} de ${notasTotal}` },
      { chave: 'seguroConfirmado', rotulo: 'Seguro confirmado', ok: seguroOk, detalhe: !seguroObrigatorio ? 'dispensado por parâmetro' : (seguro?.status ?? 'pendente') },
      { chave: 'caminhaoMotorista', rotulo: 'Caminhão/motorista preenchidos', ok: caminhaoMotoristaOk, detalhe: caminhaoMotoristaOk ? 'Completos' : 'Incompletos' },
    ];

    return { requisitos, liberavel: requisitos.every((r) => r.ok) };
  }
}
```

- [ ] Step 2 — evento `CAMINHAO_LIBERADO` em `eventos.ts` (D10.10), junto de `SEGURO_ATUALIZADO` (T5 Step 4):
```ts
  SEGURO_ATUALIZADO: 'seguro_atualizado',
  CAMINHAO_LIBERADO: 'caminhao_liberado',
```
E os payloads, na seção de tipos (após `CargaItemDivergentePayload` ou junto do bloco Onda 10):
```ts
export interface SeguroAtualizadoPayload {
  caminhaoId: string;
  seguroId: string;
  status: string;
  dataOperacao: string;
}

export interface CaminhaoLiberadoPayload {
  caminhaoId: string;
  dataOperacao: string;
}
```
E em `PayloadPorEvento`:
```ts
  seguro_atualizado: SeguroAtualizadoPayload;
  caminhao_liberado: CaminhaoLiberadoPayload;
```

- [ ] Step 3 — guard em `liberacao.service.ts` (expedicao) — `liberarSaida` passa a consultar o checklist ANTES da transição e emite `CAMINHAO_LIBERADO` pós-commit. Injetar `LiberacaoChecklistService` no construtor (import de `../faturamento/liberacao-checklist.service`) e alterar o método:
```ts
  /** faturado → liberado_saida. Exige checklist D10.6 liberável (guard RA-01) + faturamento concluído. */
  async liberarSaida(caminhaoId: string, operadorId: string) {
    const checklist = await this.checklistService.calcular(caminhaoId);
    if (!checklist.liberavel) {
      throw new ConflictException({
        codigo: 'CHECKLIST_INCOMPLETO',
        message: 'Liberação bloqueada — checklist incompleto',
        requisitos: checklist.requisitos.filter((r) => !r.ok),
      });
    }

    const resultado = await this.db.transaction(async (tx) => {
      const caminhao = await this.caminhaoService.caminhaoAtivo(tx, caminhaoId);
      const status = caminhao.statusCaminhao as StatusCaminhao;

      if (['liberado_saida', 'expedido'].includes(status)) {
        return { caminhao, jaLiberado: true as const };
      }

      assertTransicao(status, 'liberado_saida');

      const faturamento = await tx
        .select()
        .from(faturamentos)
        .where(and(eq(faturamentos.caminhaoId, caminhaoId), isNull(faturamentos.deletedAt)))
        .then((r) => r[0] ?? null);

      if (!faturamento || faturamento.statusFaturamento !== 'concluido') {
        throw new ConflictException(
          'Liberação de saída exige faturamento concluído (todas as NFS-e emitidas)',
        );
      }

      const atualizado = primeiroOuFalha(
        await tx
          .update(caminhoes)
          .set({ statusCaminhao: 'liberado_saida' })
          .where(eq(caminhoes.id, caminhaoId))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'caminhoes',
        registroId: caminhaoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: caminhao,
        dadosNovos: atualizado,
        justificativa: 'Liberação de saída na portaria',
      });

      return { caminhao: atualizado, jaLiberado: false as const };
    });

    if (!resultado.jaLiberado) {
      const dataOperacao = await this.caminhaoService.dataOperacaoDoCaminhao(this.db, resultado.caminhao);
      this.eventEmitter.emit(EVENTOS.EXPEDICAO_LIBERADA_SAIDA, { caminhaoId, dataOperacao });
      this.eventEmitter.emit(EVENTOS.CAMINHAO_LIBERADO, { caminhaoId, dataOperacao });
    }

    return resultado.caminhao;
  }
```
(o corpo interno do `db.transaction` é literalmente o mesmo já existente — só o guard no topo e o `emit(EVENTOS.CAMINHAO_LIBERADO, ...)` extra são novos; `EVENTOS.CHECKLIST_INCOMPLETO` NÃO é um evento de domínio, é apenas o `codigo` da exceção 409.)

- [ ] Step 4 — rota em `faturamento.controller.ts` (injetar `LiberacaoChecklistService`):
```ts
  @Get('liberacao/:caminhaoId/checklist')
  @RequireQualquerPermissao('FATURAMENTO_LER', 'LIBERACAO_GERENCIAR')
  checklistLiberacao(@Param('caminhaoId') caminhaoId: string) {
    return this.checklist.calcular(caminhaoId);
  }
```

- [ ] Step 5 — registrar `LiberacaoChecklistService` em `faturamento.module.ts` (`providers`+`exports`). **Atenção a import circular**: `FaturamentoModule` já importa `ExpedicaoModule` (ver `faturamento.module.ts` atual) e `LiberacaoChecklistService` (novo, em `faturamento/`) precisa ser injetado em `LiberacaoService` (existente, em `expedicao/`). Solução única e obrigatória: `forwardRef` nos dois módulos — não avaliar alternativas.
```ts
// expedicao.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { FaturamentoModule } from '../faturamento/faturamento.module';
// ...
@Module({
  imports: [/* ... */, forwardRef(() => FaturamentoModule)],
  // ...
})
```
```ts
// faturamento.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { ExpedicaoModule } from '../expedicao/expedicao.module';
// ...
@Module({
  imports: [/* ... */, forwardRef(() => ExpedicaoModule)],
  // ...
})
```
E em `liberacao.service.ts` (consumidor), injetar com `@Inject(forwardRef(() => LiberacaoChecklistService))` (campo `checklistService`, usado pelo Step 3):
```ts
  constructor(
    // ... dependências existentes,
    @Inject(forwardRef(() => LiberacaoChecklistService))
    private readonly checklistService: LiberacaoChecklistService,
  ) {}
```
Validar com:
```bash
cd app/backend && npm run start:dev
```
Saída esperada: boot completo sem erro `Nest can't resolve dependencies`; encerrar o processo (Ctrl+C) após confirmar.

- [ ] Step 6 — `test/unit/liberacao-checklist.spec.ts` (novo). Nomes literais do mapa DoD; cada `it()` monta seu próprio mock de `db.select()` — a ordem das respostas segue exatamente a ordem das 4-5 chamadas de `calcular()` (caminhoes → cargaItens → notasFiscais [só se houver pedido] → parametros → segurosCarga):
```ts
import { LiberacaoChecklistService } from '../../src/modules/operacao/faturamento/liberacao-checklist.service';

const caminhaoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

type Chain = {
  from: (...a: unknown[]) => Chain;
  where: (...a: unknown[]) => Chain;
  then: (cb: (r: unknown[]) => unknown) => unknown;
};

function selectChain(rows: unknown[]): Chain {
  const terminal: Chain = {
    from: () => terminal,
    where: () => terminal,
    then: (cb) => cb(rows),
  };
  return terminal;
}

/** `responses[i]` = linhas devolvidas pela i-ésima chamada a `db.select()` dentro de `calcular()`. */
function makeService(responses: unknown[][]): LiberacaoChecklistService {
  let idx = 0;
  const db = { select: jest.fn(() => selectChain(responses[idx++] ?? [])) };
  return new LiberacaoChecklistService({ db } as never);
}

describe('LiberacaoChecklistService (D10.6)', () => {
  it('reprova cargaConferida quando status ainda nao chegou a fechado', async () => {
    const service = makeService([
      [{ id: caminhaoId, statusCaminhao: 'em_carga', placa: 'ABC1234', motorista: 'Joao Silva' }], // caminhoes
      [], // cargaItens — sem pedidos na carga
      [{ valorJson: { valor: true } }], // parametros faturamento.seguro_obrigatorio
      [], // segurosCarga
    ]);
    const resultado = await service.calcular(caminhaoId);
    const req = resultado.requisitos.find((r) => r.chave === 'cargaConferida')!;
    expect(req.ok).toBe(false);
    expect(req.detalhe).toBe('Não conferida');
    expect(resultado.liberavel).toBe(false);
  });

  it('reprova notasAutorizadas quando ha pedido sem nota emitida', async () => {
    const service = makeService([
      [{ id: caminhaoId, statusCaminhao: 'fechado', placa: 'ABC1234', motorista: 'Joao Silva' }], // caminhoes
      [{ pedidoVendaId: 'pedido-1' }], // cargaItens
      [{ pedidoVendaId: 'pedido-1', statusNfse: 'pendente' }], // notasFiscais — ainda não emitida
      [{ valorJson: { valor: false } }], // parametros — seguro dispensado (isola o requisito em teste)
      [], // segurosCarga
    ]);
    const resultado = await service.calcular(caminhaoId);
    const req = resultado.requisitos.find((r) => r.chave === 'notasAutorizadas')!;
    expect(req.ok).toBe(false);
    expect(req.detalhe).toBe('0 de 1');
    expect(resultado.liberavel).toBe(false);
  });

  it('reprova seguroConfirmado quando status != confirmado e parametro obrigatorio', async () => {
    const service = makeService([
      [{ id: caminhaoId, statusCaminhao: 'fechado', placa: 'ABC1234', motorista: 'Joao Silva' }], // caminhoes
      [{ pedidoVendaId: 'pedido-1' }], // cargaItens
      [{ pedidoVendaId: 'pedido-1', statusNfse: 'emitida' }], // notasFiscais
      [{ valorJson: { valor: true } }], // parametros — seguro obrigatorio
      [{ status: 'pendente' }], // segurosCarga
    ]);
    const resultado = await service.calcular(caminhaoId);
    const req = resultado.requisitos.find((r) => r.chave === 'seguroConfirmado')!;
    expect(req.ok).toBe(false);
    expect(req.detalhe).toBe('pendente');
    expect(resultado.liberavel).toBe(false);
  });

  it('DoD 10.12 parametro dispensa seguro', async () => {
    const service = makeService([
      [{ id: caminhaoId, statusCaminhao: 'fechado', placa: 'ABC1234', motorista: 'Joao Silva' }], // caminhoes
      [{ pedidoVendaId: 'pedido-1' }], // cargaItens
      [{ pedidoVendaId: 'pedido-1', statusNfse: 'emitida' }], // notasFiscais
      [{ valorJson: { valor: false } }], // faturamento.seguro_obrigatorio = false
      [{ status: 'pendente' }], // segurosCarga — pendente, mas dispensado por parâmetro
    ]);
    const resultado = await service.calcular(caminhaoId);
    const req = resultado.requisitos.find((r) => r.chave === 'seguroConfirmado')!;
    expect(req.ok).toBe(true);
    expect(req.detalhe).toBe('dispensado por parâmetro');
  });

  it('reprova caminhaoMotorista quando placa ou motorista vazios', async () => {
    const service = makeService([
      [{ id: caminhaoId, statusCaminhao: 'fechado', placa: '', motorista: 'Joao Silva' }], // caminhoes — placa vazia
      [{ pedidoVendaId: 'pedido-1' }], // cargaItens
      [{ pedidoVendaId: 'pedido-1', statusNfse: 'emitida' }], // notasFiscais
      [{ valorJson: { valor: false } }], // parametros — seguro dispensado (isola o requisito em teste)
      [], // segurosCarga
    ]);
    const resultado = await service.calcular(caminhaoId);
    const req = resultado.requisitos.find((r) => r.chave === 'caminhaoMotorista')!;
    expect(req.ok).toBe(false);
    expect(req.detalhe).toBe('Incompletos');
    expect(resultado.liberavel).toBe(false);
  });

  it('libera quando os 4 requisitos estao ok', async () => {
    const service = makeService([
      [{ id: caminhaoId, statusCaminhao: 'fechado', placa: 'ABC1234', motorista: 'Joao Silva' }], // caminhoes
      [{ pedidoVendaId: 'pedido-1' }], // cargaItens
      [{ pedidoVendaId: 'pedido-1', statusNfse: 'emitida' }], // notasFiscais
      [{ valorJson: { valor: true } }], // parametros — seguro obrigatorio
      [{ status: 'confirmado' }], // segurosCarga
    ]);
    const resultado = await service.calcular(caminhaoId);
    expect(resultado.liberavel).toBe(true);
    expect(resultado.requisitos.every((r) => r.ok)).toBe(true);
  });
});
```
Comando:
```bash
cd app/backend && npx jest test/unit/liberacao-checklist.spec.ts
```
Saída esperada: `Tests: 6 passed, 0 failed`.

Commit: `feat(onda10): checklist de liberacao calculado + guard em liberar-saida + evento CAMINHAO_LIBERADO`

## Task 7 — RBAC + eventos

**Files:** `permissoes.ts`, `perfil-permissoes.snapshot.json`, `eventos.ts`, `realtime.gateway.ts`

- [ ] Step 1 — `PERMISSOES`, no bloco `── F6a — Faturamento + NFS-e`, adicionar as 2 chaves novas (D10.9):
```ts
  // ── F6a — Faturamento + NFS-e ────────────────────────────────────────────
  FATURAMENTO_LER: 'FATURAMENTO_LER',
  FATURAMENTO_GERENCIAR: 'FATURAMENTO_GERENCIAR',
  NFSE_EMITIR: 'NFSE_EMITIR',
  NFSE_CANCELAR: 'NFSE_CANCELAR',
  // ── Onda 10 — Seguro manual (F6b) + Liberação por checklist ─────────────
  SEGURO_GERENCIAR: 'SEGURO_GERENCIAR',
  LIBERACAO_GERENCIAR: 'LIBERACAO_GERENCIAR',
```

- [ ] Step 2 — `DESCRICOES_PERMISSOES`, no mesmo bloco (após `NFSE_CANCELAR: 'Cancelar NFS-e emitidas',`):
```ts
  SEGURO_GERENCIAR: 'Registrar envio e confirmação do seguro de carga',
  LIBERACAO_GERENCIAR: 'Liberar caminhão por checklist',
```

- [ ] Step 3 — concessões via `pushPermissoes` (D10.9), após o bloco `// Onda 9 — leitura das telas de carga`:
```ts
// Onda 10 — Faturamento: EISS real, seguro manual (F6b), liberação por checklist
pushPermissoes('faturamento', 'SEGURO_GERENCIAR', 'LIBERACAO_GERENCIAR');
pushPermissoes('gestor', 'SEGURO_GERENCIAR', 'LIBERACAO_GERENCIAR');
pushPermissoes('administrador', 'SEGURO_GERENCIAR', 'LIBERACAO_GERENCIAR');
pushPermissoes('logistica', 'SEGURO_GERENCIAR', 'LIBERACAO_GERENCIAR'); // D10.9 — doc 04 §7.3/§7.4
pushPermissoes('diretoria', 'FATURAMENTO_LER');
```
(`diretoria` e `logistica` já têm `FATURAMENTO_LER` — `logistica` desde o objeto base (`logistica: [...LEITURA_CADASTROS, 'DISPONIBILIDADE_LER', 'FATURAMENTO_LER']`), `diretoria` ainda não; conferir se a linha `pushPermissoes('diretoria', 'FATURAMENTO_LER')` já não é redundante com nenhum push anterior antes de aplicar — se `diretoria` já tiver `FATURAMENTO_LER` de outro ponto, omitir esta linha para não duplicar a permissão no array.)

- [ ] Step 4 — regenerar o snapshot:
```bash
cd app/backend && npx ts-node scripts/regen-rbac-snapshot.ts
```
Saída esperada: `perfil-permissoes.snapshot.json` atualizado; `git diff app/backend/src/common/rbac/perfil-permissoes.snapshot.json` mostra SÓ adições (`+`) — nenhuma permissão removida de nenhum perfil existente.

- [ ] Step 5 — eventos D10.10 já foram acrescentados em T5 Step 4 (`SEGURO_ATUALIZADO`) e T6 Step 2 (`CAMINHAO_LIBERADO` + payloads + `PayloadPorEvento`). Aqui só os handlers no gateway — em `realtime.gateway.ts`, importar os 2 payloads novos e adicionar, após o bloco `// ── F6a — Faturamento / NFS-e`:
```ts
  // ── Onda 10 — Seguro / Liberação ──────────────────────────────────────────

  @OnEvent(EVENTOS.SEGURO_ATUALIZADO)
  handleSeguroAtualizado(payload: SeguroAtualizadoPayload): void {
    this.broadcast(EVENTOS.SEGURO_ATUALIZADO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.CAMINHAO_LIBERADO)
  handleCaminhaoLiberado(payload: CaminhaoLiberadoPayload): void {
    this.broadcast(EVENTOS.CAMINHAO_LIBERADO, payload, payload.dataOperacao);
  }
```
E no import de `./events/eventos` no topo do arquivo, acrescentar `type SeguroAtualizadoPayload` e `type CaminhaoLiberadoPayload` à lista já existente.

- [ ] Step 6 — conferir RBAC + build do gateway:
```bash
cd app/backend && npx tsc --noEmit -p .
```
Saída esperada: `0` erros.
```bash
cd app/backend && npx jest test/unit --testPathPattern=rbac
```
Saída esperada: `Tests: N passed, 0 failed` (nenhum teste de snapshot RBAC quebrado).

Commit: `feat(onda10): RBAC SEGURO_GERENCIAR + LIBERACAO_GERENCIAR + eventos seguro_atualizado/caminhao_liberado`

## Task 8 — UI Pré-Faturamento fiel (badge de ambiente substitui "pendente de definição")

**Files:** `pre-faturamento-client.tsx` (reescrever), BFF novas, `lib/faturamento.ts`, `__tests__/pre-faturamento.test.tsx`

- [ ] Step 1 — badge de ambiente (AD-02 já resolveu a integração — D10 Goal item (a)). Substituir, no header do client, o padrão âmbar antigo "Integração fiscal externa — pendente de definição" (`Faturamento.tsx:212-215`) por um badge derivado de `EISS_HOMOLOGACAO` — como o front não lê env vars do servidor diretamente, o BFF de `consolidacao` (ou uma rota nova `GET /api/operacao/faturamento/ambiente`) deve expor o booleano. Adicionar em `lib/faturamento.ts`:
```ts
export interface AmbienteFiscal {
  homologacao: boolean;
}
```
  E no client, badge fiel ao layout do protótipo (mesmas classes de pílula, cores condicionais):
```tsx
function BadgeAmbiente({ homologacao }: { homologacao: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${
        homologacao
          ? 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
          : 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
      }`}
    >
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
      {homologacao ? 'Homologação EISS' : 'Produção EISS'}
    </span>
  );
}
```
(import `AlertTriangle` de `lucide-react`, já usado no protótipo.)

- [ ] Step 2 — rota BFF nova `app/frontend/src/app/api/operacao/faturamento/ambiente/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { AmbienteFiscal } from '@/lib/faturamento';

export async function GET() {
  const { data, error, status } = await fetchBackend<AmbienteFiscal>('/operacao/faturamento/ambiente');
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
```
  Backend correspondente — endpoint simples em `faturamento.controller.ts`:
```ts
  @Get('ambiente')
  @RequirePermissoes('FATURAMENTO_LER')
  ambiente() {
    return { homologacao: process.env['EISS_HOMOLOGACAO'] !== 'false' };
  }
```

- [ ] Step 3 — SEM botão "Emitir em lote" nesta onda (P-Onda10.3 — ver "Fora de escopo": não há endpoint `emitir-lote` para chamar). O bloco de seleção de carga (`Faturamento.tsx:219-233`, sem o botão de lote) permanece com a emissão unitária já existente (`emitir`/`reprocessar`, botões por linha de pedido). Pular direto para o Step 4.

- [ ] Step 4 — os 5 KPIs (`Faturamento.tsx:245-259`: Pedidos na carga/Preparados/Autorizados/Com erro/Valor total), deriváveis do `consolidacao` atual. Adicionar, logo após o cabeçalho do caminhão (após o `</div>` que fecha o bloco de `CaminhaoPipelineBar`/status de faturamento, antes do painel de bloqueios), o grid literal com as classes e cores do protótipo (`Faturamento.tsx:245-259`):
```tsx
{(() => {
  const notas = consolidacao.notasFiscais;
  const preparados = consolidacao.pedidos.filter((p) => !notaPorPedido(p.pedidoVendaId)).length;
  const autorizados = notas.filter((n) => n.statusNfse === 'emitida').length;
  const erros = notas.filter((n) => n.statusNfse === 'erro_emissao').length;
  const valorTotal = notas.reduce((acc, n) => acc + Number(n.valor), 0);
  const kpis = [
    { label: 'Pedidos na carga', value: `${consolidacao.pedidos.length}`, sub: 'para faturamento', color: 'text-[#1E3A5F]', bg: 'bg-[#F8FAFC]' },
    { label: 'Preparados', value: `${preparados}`, sub: 'aguardando envio', color: 'text-[#64748B]', bg: 'bg-[#F1F5F9]' },
    { label: 'Autorizados', value: `${autorizados}`, sub: 'nota emitida', color: 'text-[#15803D]', bg: 'bg-[#F0FDF4]' },
    { label: 'Com erro', value: `${erros}`, sub: 'aguardando reprocessamento', color: 'text-[#E11D48]', bg: 'bg-[#FFF1F2]' },
    { label: 'Valor total da carga', value: valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), sub: 'notas emitidas', color: 'text-[#1E3A5F]', bg: 'bg-[#F8FAFC]' },
  ];
  return (
    <div className="grid grid-cols-5 gap-3">
      {kpis.map(({ label, value, sub, color, bg }) => (
        <div key={label} className={`border border-[#E2E8F0] rounded-xl px-4 py-3.5 ${bg}`}>
          <p className="text-[11px] text-[#64748B] font-medium mb-1">{label}</p>
          <p className={`text-[22px] font-black leading-none ${color}`}>{value}</p>
          <p className="text-[10px] text-[#94A3B8] mt-1.5">{sub}</p>
        </div>
      ))}
    </div>
  );
})()}
```
(usa o helper `notaPorPedido` já existente no client — linha 365-367 do arquivo atual; "Valor total da carga" soma apenas `nota.valor` das NFS-e já criadas, pois `PedidoConsolidado` não traz preço/kg — não há como calcular "peso × preço" como no protótipo sem esse dado; `sub` do último KPI reflete essa base: "notas emitidas".)

- [ ] Step 5 — bloqueios ativos (`Faturamento.tsx:261-281`) já renderizados pelo client atual (`painel-bloqueios` `data-testid`) — ajustar o título de `Bloqueios ({consolidacao.bloqueios.length})` (linha 522 do arquivo atual) para o rótulo literal do protótipo:
```tsx
<h2 className="font-semibold text-red-800">
  Bloqueios ativos — dados fiscais incompletos ({consolidacao.bloqueios.length})
</h2>
```

- [ ] Step 6 — `__tests__/pre-faturamento.test.tsx`: adicionar casos para o badge de ambiente e o botão de lote:
```tsx
it('renderiza badge Homologação EISS quando ambiente.homologacao=true', async () => {
  // mock fetch /api/operacao/faturamento/ambiente -> { homologacao: true }
  render(<FaturamentoClient permissoes={['FATURAMENTO_LER']} />);
  expect(await screen.findByText('Homologação EISS')).toBeInTheDocument();
});
```
Comando:
```bash
cd app/frontend && npx jest pre-faturamento.test.tsx
```
Saída esperada: `Tests: N passed, 0 failed`.

Commit: `feat(onda10): pre-faturamento — badge de ambiente EISS + KPIs`

## Task 9 — UI Notas/XML (substitui placeholder)

**Files:** `notas-xml/page.tsx` (substituir), `notas-xml/notas-xml-client.tsx` (novo), BFF novas, `lib/faturamento.ts`, `__tests__/notas-xml.test.tsx`

- [ ] Step 1 — `page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { NotasXmlClient } from './notas-xml-client';

export default async function NotasXmlPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <NotasXmlClient permissoes={user.permissoes} />;
}
```

- [ ] Step 2 — BFF novas: `app/frontend/src/app/api/operacao/faturamento/notas/route.ts` (repasse de `GET /operacao/faturamento/notas` com querystring) e `app/frontend/src/app/api/operacao/faturamento/notas/[id]/rastreabilidade/route.ts` (repasse `GET`):
```ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { Paginado } from '@/lib/paginacao';
import type { NotaFiscal } from '@/lib/faturamento';

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search;
  const { data, error, status } = await fetchBackend<Paginado<NotaFiscal>>(`/operacao/faturamento/notas${qs}`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
```

- [ ] Step 3 — `notas-xml-client.tsx`: header + badge de ambiente (duplicar o componente `BadgeAmbiente` de T8 Step 1 diretamente em `notas-xml-client.tsx` — sem extrair para arquivo compartilhado nesta onda); 3 KPIs (`NotasXml.tsx:401-412`: Autorizadas hoje/Com erro/Aguardando retorno — mapeados para `statusNfse==='emitida'`/`'erro_emissao'`/`'pendente'`); filtros busca+status (`:416-429`); tabela (`:439-503`) com colunas Nº nota/Chave/Pedido·Carga/Cliente/Valor/Status/Data/Ações; botões "Baixar XML"/"Ver DANFE" abrindo `nota.linkNfse` — fiel a `NotasXml.tsx:467-478` mas usando o link real:
```tsx
<a
  href={nota.linkNfse ?? undefined}
  target="_blank"
  rel="noopener noreferrer"
  title={nota.linkNfse ? 'Baixar XML' : 'Link da nota ainda não disponível — emissão pendente ou sem retorno do EISS'}
  aria-disabled={!nota.linkNfse}
  className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${nota.linkNfse ? 'hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#475569]' : 'text-[#CBD5E1] cursor-not-allowed pointer-events-none'}`}
>
  <Download className="w-3.5 h-3.5" />
</a>
```
  Trava de cancelamento visual (`NotasXml.tsx:485-497`, D10.4) — usa o campo `nota.caminhaoLiberado` já devolvido por `NotasConsultaService.listar` (T4 Step 2, join com `caminhoes` + `caminhaoLiberado: ['liberado_saida','expedido'].includes(caminhao.statusCaminhao)` no map de retorno):
```tsx
{nota.statusNfse === 'emitida' && (
  nota.caminhaoLiberado ? (
    <span title="Caminhão já liberado — cancelamento bloqueado" className="w-6 h-6 flex items-center justify-center text-[#CBD5E1] cursor-help">
      <Ban className="w-3.5 h-3.5" />
    </span>
  ) : (
    <button title="Cancelar nota" onClick={() => setModalCancelar(nota)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#FFF1F2] text-[#94A3B8] hover:text-[#E11D48] transition-colors">
      <XCircle className="w-3.5 h-3.5" />
    </button>
  )
)}
```
  `ModalCancelar` (`NotasXml.tsx:149-215`) — motivo obrigatório via `<select>` com as mesmas 5 opções literais do protótipo, chamando `POST /api/operacao/faturamento/notas/:id/cancelar` (já existe); se `nota.caminhaoLiberado`, renderizar o bloco "Cancelamento bloqueado" (`:156-174`) em vez do form.
  Drawer de rastreabilidade (D10.7) — ao clicar "Ver detalhe" (`Eye`, `:475-478`), buscar `GET /api/operacao/faturamento/notas/:id/rastreabilidade` e renderizar pedido→peças (etiqueta/produto/peso)→totais no mesmo layout de `Sheet` do protótipo (`DrawerDetalhe`, itens/histórico/rodapé `:280-330`) — histórico real vem da tabela `auditoria` (`tabela='notas_fiscais', registroId=nota.id`) se o worker optar por incluí-lo; caso o backend de T4 não devolva histórico, omitir a seção "Histórico" do drawer sem inventar dados (Princípio VIII).
  Rodapé informativo (`:508-513`) mantido, ajustando o texto para não citar "sistema fiscal externo" pendente de definição (já resolvido — AD-02).

- [ ] Step 4 — `__tests__/notas-xml.test.tsx`:
```tsx
it('trava visual: cancelar desabilitado quando caminhaoLiberado=true', () => {
  render(<NotasXmlClient permissoes={['FATURAMENTO_LER', 'NFSE_CANCELAR']} />);
  expect(screen.getByTitle('Caminhão já liberado — cancelamento bloqueado')).toBeInTheDocument();
});

it('ModalCancelar exige motivo antes de confirmar', async () => {
  render(<NotasXmlClient permissoes={['FATURAMENTO_LER', 'NFSE_CANCELAR']} />);
  await userEvent.click(screen.getByTitle('Cancelar nota'));
  expect(screen.getByRole('button', { name: /confirmar cancelamento/i })).toBeDisabled();
});
```
Comando:
```bash
cd app/frontend && npx jest notas-xml.test.tsx
```
Saída esperada: `Tests: 2 passed, 0 failed`.

Commit: `feat(onda10): tela Notas/XML — listagem, rastreabilidade, cancelamento com trava`

## Task 10 — UI Seguro Manual (substitui placeholder)

**Files:** `seguro-manual/page.tsx` (substituir), `seguro-manual/seguro-manual-client.tsx` (novo), BFF novas, `__tests__/seguro-manual.test.tsx`

- [ ] Step 1 — `page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { SeguroManualClient } from './seguro-manual-client';

export default async function SeguroManualPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <SeguroManualClient permissoes={user.permissoes} />;
}
```

- [ ] Step 2 — BFF novas de repasse (padrão `repassar()` já usado nos vizinhos): `seguros/route.ts` (GET listar + POST criar), `seguros/[id]/status/route.ts` (PATCH), `seguros/[id]/anexos/route.ts` (POST), `seguros/[id]/observacao/route.ts` (PATCH) — todas repassando 1:1 para os endpoints de T5.

- [ ] Step 3 — `seguro-manual-client.tsx`: header (`SeguroManual.tsx:123-129`); 4 KPIs (`:132-144`: Cargas com seguro/Pendentes/Enviados/Confirmados — de `seguros.data`); nota informativa (`:148-151`, texto literal "O seguro é tratado manualmente — o sistema apenas registra o status."); filtros busca+status (`:154-167`); lista de cargas (`:169-259`) com `StatusBadge` (Pendente âmbar/Enviado azul/Confirmado verde — usar as mesmas cores hex do protótipo `STATUS_STYLE` `:61-65` já que não há token do DS v2 para status de seguro ainda — ou mapear para `StatusPill` do DS se existir variante equivalente; se não existir, usar classes inline como o protótipo, sem inventar novo token).
  Ações "Marcar como enviado"/"Marcar como confirmado" (`:238-249`) chamando `PATCH /api/operacao/faturamento/seguros/:id/status`:
```tsx
async function alterarStatus(seguroId: string, status: 'enviado' | 'confirmado') {
  setErro(null);
  setSubmittingId(seguroId);
  try {
    const res = await fetch(`/api/operacao/faturamento/seguros/${seguroId}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErro((data as { message?: string }).message ?? 'Falha ao alterar status'); return; }
    await carregar();
  } catch {
    setErro('Erro de conexão');
  } finally {
    setSubmittingId(null);
  }
}
```
  Anexar comprovante (`:232-236`, D10 regra do worker: "prompt de nome via Dialog do DS — NUNCA `window.prompt`") — usar `Dialog`/`DialogContent` do DS (já importado no protótipo de `../components/ui/dialog`, equivalente em `@/components/ui/dialog` no app) com um `Input` de nome + `Textarea` opcional de descrição, confirmando com `POST /api/operacao/faturamento/seguros/:id/anexos`:
```tsx
<Dialog open={dialogAnexoAbertoPara === seguro.id} onOpenChange={(v) => !v && setDialogAnexoAbertoPara(null)}>
  <DialogContent>
    <DialogHeader><DialogTitle>Anexar comprovante</DialogTitle></DialogHeader>
    <div className="space-y-3 p-1">
      <div>
        <Label htmlFor="anexo-nome">Nome do arquivo</Label>
        <Input id="anexo-nome" value={anexoNome} onChange={(e) => setAnexoNome(e.target.value)} placeholder="averbacao-centro-1130.pdf" />
      </div>
      <div>
        <Label htmlFor="anexo-descricao">Descrição (opcional)</Label>
        <Input id="anexo-descricao" value={anexoDescricao} onChange={(e) => setAnexoDescricao(e.target.value)} />
      </div>
      <Button disabled={!anexoNome.trim()} onClick={() => void confirmarAnexo(seguro.id)}>Anexar</Button>
    </div>
  </DialogContent>
</Dialog>
```
  Observação editável (`:218-228`) — `<textarea>` com `onBlur` chamando `salvarObservacao` (`PATCH /seguros/:id/observacao`), mesmo padrão do protótipo.
  Rodapé informativo (`:262-268`) mantido, ligando à liberação (texto literal já cita "Liberação do Caminhão").

- [ ] Step 4 — `__tests__/seguro-manual.test.tsx`:
```tsx
it('KPIs contam pendentes/enviados/confirmados', async () => {
  render(<SeguroManualClient permissoes={['FATURAMENTO_LER']} />);
  expect(await screen.findByText('Pendentes')).toBeInTheDocument();
});

it('Marcar como enviado so aparece para status Pendente', async () => {
  render(<SeguroManualClient permissoes={['SEGURO_GERENCIAR']} />);
  expect(await screen.findByText('Marcar como enviado')).toBeInTheDocument();
});

it('anexo abre Dialog em vez de window.prompt', async () => {
  const promptSpy = jest.spyOn(window, 'prompt');
  render(<SeguroManualClient permissoes={['SEGURO_GERENCIAR']} />);
  await userEvent.click(screen.getAllByText('Anexar comprovante')[0]);
  expect(promptSpy).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
```
Comando:
```bash
cd app/frontend && npx jest seguro-manual.test.tsx
```
Saída esperada: `Tests: 3 passed, 0 failed`.

Commit: `feat(onda10): tela Seguro Manual — KPIs, transicoes, anexo referencial via Dialog`

## Task 11 — UI Liberação (completar com checklist real)

**Files:** `liberacao-client.tsx` (reescrever), `liberacao/page.tsx`, BFF novas, `__tests__/liberacao.test.tsx`

- [ ] Step 1 — o client atual (`LiberacaoCaminhaoClient`) usa um checklist decorativo local (`danfe`/`canhoto`/`seguro`/`temperatura` — checkboxes soltos, sem ligação com dados reais). Substituir por consumo do checklist real de T6 (`GET /api/operacao/faturamento/liberacao/:caminhaoId/checklist`). Estado novo:
```tsx
const [checklist, setChecklist] = useState<{ requisitos: RequisitoChecklist[]; liberavel: boolean } | null>(null);

const carregarChecklist = useCallback(async (caminhaoId: string) => {
  const res = await fetch(`/api/operacao/faturamento/liberacao/${caminhaoId}/checklist`, { cache: 'no-store' });
  if (res.ok) setChecklist(await res.json()); else setChecklist(null);
}, []);

useEffect(() => {
  if (selecionado) void carregarChecklist(selecionado.id);
}, [selecionado, carregarChecklist]);
```

- [ ] Step 2 — bloco "Requisitos para liberação" (`LiberacaoCaminhao.tsx:247-259`, `RequisitoLinha`) substitui o "Checklist de Documentos"/"Lacre e Segurança" decorativo atual:
```tsx
function RequisitoLinha({ ok, label, detalhe }: { ok: boolean; label: string; detalhe?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-[#F1F5F9] last:border-0">
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="w-4 h-4 text-[#15803D] flex-shrink-0" /> : <XCircle className="w-4 h-4 text-[#E11D48] flex-shrink-0" />}
        <span className={`text-[13px] font-medium ${ok ? 'text-[#1E293B]' : 'text-[#9F1239]'}`}>{label}</span>
      </div>
      {detalhe && <span className={`text-[11px] font-semibold ${ok ? 'text-[#64748B]' : 'text-[#E11D48]'}`}>{detalhe}</span>}
    </div>
  );
}
```
```tsx
<Card>
  <CardContent className="p-0">
    <div className="px-5 py-3.5 border-b flex items-center gap-2">
      <FileText className="h-4 w-4 text-primary" />
      <h3 className="text-[13px] font-bold">Requisitos para liberação</h3>
    </div>
    <div className="px-5 py-1">
      {checklist?.requisitos.map((r) => (
        <RequisitoLinha key={r.chave} ok={r.ok} label={r.rotulo} detalhe={r.detalhe} />
      ))}
    </div>
  </CardContent>
</Card>
```

- [ ] Step 3 — pendências impeditivas com links de resolução (`LiberacaoCaminhao.tsx:262-295`) — mapear cada `chave` reprovada para o `Link` correspondente:
```tsx
const LINK_RESOLUCAO: Record<string, { texto: string; href: string }> = {
  cargaConferida: { texto: 'Resolver em Carga → Conferência', href: '/carga/conferencia' },
  notasAutorizadas: { texto: 'Resolver em Notas / XML', href: '/faturamento/notas-xml' },
  seguroConfirmado: { texto: 'Resolver em Seguro Manual', href: '/faturamento/seguro-manual' },
  caminhaoMotorista: { texto: 'Resolver em Cadastros → Caminhões', href: '/cadastros/caminhoes' },
};
```
```tsx
{checklist && !checklist.liberavel && (
  <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl overflow-hidden">
    <div className="px-5 py-3 border-b border-[#FDE68A] flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 text-[#D97706]" />
      <h3 className="text-[13px] font-bold text-[#92400E]">Pendências impeditivas</h3>
    </div>
    <div className="flex flex-col divide-y divide-[#FDE68A]/60">
      {checklist.requisitos.filter((r) => !r.ok).map((r) => (
        <div key={r.chave} className="px-5 py-3 flex items-center justify-between gap-3">
          <p className="text-[12px] text-[#92400E]">{r.rotulo} — {r.detalhe}</p>
          <Link href={LINK_RESOLUCAO[r.chave].href} className="text-[12px] font-semibold text-[#1D4ED8] hover:underline whitespace-nowrap">
            {LINK_RESOLUCAO[r.chave].texto}
          </Link>
        </div>
      ))}
    </div>
  </div>
)}
```
(import `Link` de `next/link` — Next App Router, não `react-router` como no protótipo standalone.)

- [ ] Step 4 — botão "Liberar Caminhão" chama `POST /caminhoes/:id/liberar-saida` (rota BFF já existe) e, em 409, exibe os `requisitos` reprovados devolvidos pelo backend (D10.6 — "409 CHECKLIST_INCOMPLETO com a lista de requisitos reprovados"):
```tsx
async function liberarSaida() {
  if (!selecionado || !checklist?.liberavel) return;
  setErro(null); setSubmitting(true);
  try {
    const res = await fetch(`/api/operacao/expedicao/caminhoes/${selecionado.id}/liberar-saida`, { method: 'POST', body: '{}' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data as { message?: unknown }).message;
      setErro(typeof msg === 'object' && msg !== null && 'message' in (msg as object) ? (msg as { message: string }).message : 'Falha ao liberar saída');
      return;
    }
    await carregar();
    await carregarChecklist(selecionado.id);
  } catch {
    setErro('Erro de conexão');
  } finally {
    setSubmitting(false);
  }
}
```
```tsx
<Button disabled={submitting || !checklist?.liberavel} onClick={() => void liberarSaida()}>
  <CheckCircle2 className="h-5 w-5" /> {submitting ? 'Liberando…' : 'Liberar Caminhão'}
</Button>
```

- [ ] Step 5 — remover o estado/UI decorativos antigos (`checklist` local de checkboxes `danfe`/`canhoto`/`seguro`/`temperatura`, `lacre`) que não correspondem a nenhuma decisão D10.x — eram um checklist manual sem base em dado real; o checklist calculado de T6 os substitui integralmente.

- [ ] Step 6 — `__tests__/liberacao.test.tsx`:
```tsx
it('checklist incompleto desabilita Liberar Caminhao', async () => {
  render(<LiberacaoCaminhaoClient permissoes={['LIBERACAO_GERENCIAR']} />);
  expect(await screen.findByText('Liberar Caminhão')).toBeDisabled();
});

it('pendencias impeditivas mostram link de resolucao para cada requisito reprovado', async () => {
  render(<LiberacaoCaminhaoClient permissoes={['LIBERACAO_GERENCIAR']} />);
  expect(await screen.findByText('Resolver em Seguro Manual')).toBeInTheDocument();
});
```
Comando:
```bash
cd app/frontend && npx jest liberacao.test.tsx
```
Saída esperada: `Tests: 2 passed, 0 failed`.

Commit: `feat(onda10): tela Liberacao — checklist real D10.6 + pendencias com links de resolucao`

## Task 12 — Gate local + evidências

**Files:** `test/integration/onda10-faturamento.e2e-spec.ts` (novo), `e2e/onda10-faturamento.spec.ts` (novo), `docs/evidencias/onda10-faturamento/`

- [ ] Step 1 — `onda10-faturamento.e2e-spec.ts` (integração, `NFSE_FAKE=1`): implementar os 15 `it()` do Mapa DoD→teste (linhas do mapa acima) com os nomes literais exatos. Reusar fixtures de `expedicao.e2e-spec.ts`/`onda9-carga.e2e-spec.ts` (caminhão→carga→conferência→fechamento) e estender até faturamento (consolidar→emitir→cancelar→seguro→checklist→liberar-saida). Padrão de spy de evento + mock de auditoria que lança para DoD 10.15 (rollback sem evento) — mesmo padrão de `corte-eventos.spec.ts:28-41` já lido (spy em `EventEmitter2.emit`, `db.transaction` que propaga erro).

- [ ] Step 2 — rodar a suíte de integração:
```bash
cd app/backend && npx jest test/integration/onda10-faturamento.e2e-spec.ts --runInBand
```
Saída esperada: `Tests: 15 passed, 0 failed` (um por linha do Mapa DoD→teste, incluindo 10.2 que tem 2 sub-its `a`/`b`).

- [ ] Step 3 — regressão dos e2e existentes que este onda toca (RBAC, liberação, faturamento):
```bash
cd app/backend && npx jest test/integration/faturamento.e2e-spec.ts test/integration/expedicao.e2e-spec.ts test/integration/onda9-carga.e2e-spec.ts --runInBand
```
Saída esperada: `Tests: N passed, 0 failed` (nenhuma regressão nas permissões/eventos alterados por T3/T6/T7).

- [ ] Step 4 — `e2e/onda10-faturamento.spec.ts` (Playwright, backend+frontend reais, `NFSE_FAKE=1`): jornada completa pré-faturamento (emitir 1 nota unitária — SEM "emitir em lote", fora de escopo P-Onda10.3) → notas/XML (rastreabilidade, tentar cancelar nota de caminhão liberado → trava) → seguro manual (pendente→enviado→confirmado) → liberação (checklist incompleto→completo→liberar). Screenshots das 4 telas em `docs/evidencias/onda10-faturamento/` comparadas por hash+elementos-chave ("Cancelamento bloqueado", "Marcar como confirmado", "Liberar Caminhão") contra o protótipo — script fail-hard igual ao padrão da Onda 9 (`docs/evidencias/onda9-carga/`).
```bash
cd app/frontend && npx playwright test e2e/onda10-faturamento.spec.ts
```
Saída esperada: `X passed (Ys)`, 0 failed; 4 arquivos `.png` novos em `docs/evidencias/onda10-faturamento/`.

- [ ] Step 5 — Gate local (= CI, 8 jobs canônicos):
```bash
cd app/backend && npm run lint && npm run build && npx tsc --noEmit -p .
cd app/backend && npm run test:cov
cd app/frontend && npm run lint && npm run build
cd app/frontend && npm run test -- --coverage
```
Saída esperada: lint 0 erros; `test:cov` (backend) — cobertura de linha e branch ≥80% no relatório final (`Jest: coverage threshold met`); build de ambos sem erro; frontend `test --coverage` ≥80%.

- [ ] Step 6 — grep de conformidade Princípio IX (Global Constraint 7 — "Marca" banido):
```bash
grep -rniE '\bmarca\b' app/frontend/src/app/\(admin\)/faturamento app/backend/src/modules/operacao/faturamento
```
Saída esperada: **0 ocorrências** (exit code 1 do grep = nenhum match = OK).

- [ ] Step 7 — abrir PR (sem merge):
```bash
git push -u origin feature/onda10-faturamento
gh pr create --title "Onda 10 — Faturamento (EISS real + RTC, Notas/XML, Seguro F6b, Liberação)" --base develop --body "..."
```
Atualizar `docs/execucao/EXECUCAO-STATUS.md` → `aguardando_portao2`.

Commit: `test(onda10): integração DoD 10.1–10.15 + Playwright + evidências`

## Ordem de execução

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → (T8 ∥ T9 ∥ T10 ∥ T11) → T12
```

## Self-Review (critérios Portão 1)

1. Princípio I: 4 telas com `.tsx` + linhas pinadas do protótipo; blocos cercados; T11 remove o checklist decorativo (danfe/canhoto/lacre) sem base em D10.x e substitui pelo calculado real. ✓
2. Princípio II: as 4 rotas de Faturamento da matriz (linhas 26–29) cobertas por inteiro; RTC/pesquisa-nbs sem UI é decisão explícita de D10.2 (utilitário admin), não corte silencioso. ✓
3. Princípio VIII: parâmetros fiscais provisórios com badge (T1); anexos referenciais sem upload físico (T5, P-Onda10.1); histórico do drawer de rastreabilidade omitido se o backend não o expuser (T9) — nenhum dado inventado. ✓
4. RA-01: elegibilidade de emissão, checklist de liberação e trava de cancelamento vivem no backend (T3 Step 5, T6 Step 3) — UI só desabilita por cortesia. ✓
5. RA-02: toda mutação crítica (seguros, checklist→liberar-saida, cancelamento) em `db.transaction` + auditoria no mesmo escopo (T5, T6). ✓
6. RA-03/ADR-011: `NfseGateway` permanece a única porta — adapter real e fake trocáveis por DI token; nenhum teste toca o EISS real (T2). ✓
7. RA-04: eventos SEMPRE pós-commit — `SEGURO_ATUALIZADO`/`CAMINHAO_LIBERADO` emitidos depois do `db.transaction` resolver (T5 Step 3, T6 Step 3). ✓
8. RA-05/06: `Erro=true` HTTP 200 nunca é sucesso especulativo (T2 Step 4); `ChaveAutenticacao` redigida antes de qualquer persistência (T2 Step 4, `redigirSegredos` reutilizado). ✓
9. Mapa DoD→teste 1:1 com nomes literais; DoD 10.15 (rollback sem evento) cobre concorrência/atomicidade (T12 Step 1, padrão `corte-eventos.spec.ts`). ✓
10. Divergências conscientes registradas com `<!-- DIVERGÊNCIA: ... -->`, cada uma já com resolução concreta e código literal fornecido no próprio texto (T2 Step 2 — remoção de `prestador` do request; T6 Step 5 — import circular FaturamentoModule↔ExpedicaoModule, `forwardRef` como padrão; T9 Step 3 — `caminhaoLiberado` no shape de listagem de T4, join já indicado) — nenhuma decisão de produto nova tomada por conta própria; Monitor humano resolve se o worker encontrar divergência adicional. Transporte SOAP (D10.11) e "Emitir em lote" (P-Onda10.3) foram FIXADOS nesta correção — não são mais decisões abertas para o worker. ✓
11. Grep proibidos: zero `TBD`/`a definir` nas Tasks; grep "Marca" = 0 é passo explícito do Gate (T12 Step 6). ✓

## Mapa DoD → teste (1:1)

| DoD | Invariante | Teste (nome literal do `it`) |
|---|---|---|
| 10.1 | Payload `Emitir` padrão bate campo a campo com a estrutura do manual (Atividade, InformacoesAdicionais, referências, booleans obrigatórios, DeduzirRepasse=false, sem Prestador) | `payload-builder.spec.ts › 'DoD 10.1 payload padrao segue estrutura do manual V10.6'` |
| 10.2 | `Erro=true` com HTTP 200 → `NfseResultado.erro=true` sem exception; nota vai a `erro_emissao` com `ultimoErroNfse` | `eiss-adapter.spec.ts › 'DoD 10.2a Erro=true nao lanca'` + e2e `'DoD 10.2b emissao com erro de negocio grava erro_emissao'` |
| 10.3 | Timeout de transporte → `NfseTransporteError`; serviço consulta antes de retransmitir; sem nota duplicada | e2e `'DoD 10.3 timeout gera retry com reconciliacao e nota unica'` |
| 10.4 | Duas emissões concorrentes executam serializadas (mutex) | unit `'DoD 10.4 emissoes concorrentes serializam'` |
| 10.6 | `modelo_fiscal=rtc` sem parâmetros RTC → 422 `RTC_PARAMETROS_INCOMPLETOS` sem chamada ao gateway; com parâmetros → request RTC com 4 campos | e2e `'DoD 10.6 flag rtc valida parametros e monta request RTC'` |
| 10.7 | Cancelar nota de caminhão `liberado_saida` → 409 `NOTA_TRAVADA_CAMINHAO_LIBERADO`, status inalterado, gateway NÃO chamado | e2e `'DoD 10.7 trava de cancelamento pos-liberacao'` |
| 10.8 | `GET /faturamento/notas` filtra por status/carga/busca com envelope padrão | e2e `'DoD 10.8 listagem de notas com filtros'` |
| 10.9 | Rastreabilidade devolve cadeia pedido→peças→pesos→valores da nota | e2e `'DoD 10.9 rastreabilidade da nota'` |
| 10.10 | Transições de seguro: válidas persistem com timestamps+auditoria+evento; inválidas → 409 sem persistir | e2e `'DoD 10.10 transicoes de seguro'` |
| 10.11 | Checklist reprova cada requisito individualmente; `liberar-saida` com checklist incompleto → 409 `CHECKLIST_INCOMPLETO`; completo libera e emite `CAMINHAO_LIBERADO` | e2e `'DoD 10.11 checklist bloqueia e libera'` |
| 10.12 | `seguro_obrigatorio=false` dispensa o requisito de seguro | unit `'DoD 10.12 parametro dispensa seguro'` |
| 10.13 | RBAC: perfil sem `SEGURO_GERENCIAR` → 403 no PATCH status; sem `LIBERACAO_GERENCIAR`/checklist → 403; `logistica` acessa GETs | e2e `'DoD 10.13 rbac faturamento'` |
| 10.14 | `payloadEiss` persistido NUNCA contém a ChaveAutenticacao (grep no jsonb) | e2e `'DoD 10.14 token redigido no payload persistido'` |
| 10.15 | Rollback na transação de emissão → evento NÃO emitido | unit `'DoD 10.15 rollback sem evento'` |

## Colisões e dependências

- Depende de Ondas 8 e 9 **mergeadas** (✅ `7f93ad6`, `98aee6c`). Nenhuma onda paralela — arquivos de colisão clássicos (`eventos.ts`, `permissoes.ts`, gateway, `schema/index.ts`, seed) são desta onda apenas.
- Migration `0026` é a próxima do journal (`0025` = Onda 9).
- `liberacao.service.ts` (expedicao) foi tocado pela Onda 9 — base nova já em develop.

## Homologação: plano de ativação (pós-merge, fora do gate)

A pendência externa foi **reclassificada** (era "credenciais junto à prefeitura"; os manuais provam auto-atendimento):
1. **Cliente**: confirmar Inscrição Municipal + Autorização de Emissão de NFS-e ativas; o usuário autorizado gera a `ChaveAutenticacao` nos portais de homologação e produção (roteiro em `docs/integrações/nfse-osasco/ambiente-homologacao.md`).
2. **Operação**: preencher `EISS_CHAVE_AUTENTICACAO_HML` no `.env` on-premises; `EISS_HOMOLOGACAO=true`; executar o procedimento E2E do doc (emitir teste → consultar → caminho de erro). Registrar o resultado em `DECISOES.md` (AD-xx "homologação EISS validada em <data>").
3. **Contador do cliente**: confirmar código de serviço (`Atividade`), enquadramento (Simples?) e, se RTC, obter `ClassTrib`/`NBS`/`IndOperacao`/`LocalIncidencia` via endpoint de pesquisa — preencher os parâmetros e remover os badges Provisório (exige AD-xx, Princípio VIII).

## Pendências registradas (Princípio VIII)

- **P-Onda10.1** — anexos do seguro são referências nominais (sem armazenamento de arquivo). Resolver quando o fluxo operacional do seguro for definido com a corretora (docs_v2/05 §3.5).
- **P-Onda10.2** — parâmetros fiscais (`codigo_servico_atividade`, `simples_nacional`, RTC) com seeds provisórios + badge; remoção do badge exige AD-xx após validação do contador.
- **P-Onda10.3** — "Emitir em lote" (botão do protótipo `Faturamento.tsx:235-241`) não foi implementado: exigiria calcular o valor monetário de cada pedido automaticamente, e hoje não existe nenhuma modelagem de preço vinculada a `pedidos_venda` (a tela unitária depende do operador digitar o valor). Resolver quando o Comercial definir como o valor da NFS-e deve ser derivado (tabela de preços por faixa do cliente, valor do pedido de venda, ou outro) — decisão de produto fora do escopo de Faturamento.
