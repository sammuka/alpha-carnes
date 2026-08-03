# Onda 10 — Faturamento (EISS real + RTC, Notas/XML, Seguro F6b, Liberação c/ checklist) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar este plano task a task. Steps usam checkbox (`- [ ]`).
> Workers seguem o plano LITERALMENTE: não decidem regra de negócio, não improvisam. `old_string` não casa / teste falha após 1 correção / caso não coberto → PARAR e reportar.

**Goal:** Fechar as 4 rotas de Faturamento da matriz (linhas 26–29) e o adapter EISS real: (a) `EissClientAdapter` node-soap funcional com estrutura XML dos manuais oficiais (V10.6 padrão + 2.0 RTC), feature flag `modelo_fiscal` e serialização de emissões; (b) Pré-Faturamento fiel (KPIs, bloqueios fiscais, emitir em lote sequencial, reprocesso); (c) Notas/XML fiel (filtros, rastreabilidade pedido→peças→pesos→item fiscal, cancelamento com trava pós-liberação); (d) Seguro Manual F6b (tabela nova `seguros_carga`, transições pendente→enviado→confirmado, anexos referenciais); (e) Liberação do Caminhão com checklist calculado (carga conferida + NFs autorizadas + seguro confirmado + caminhão/motorista) bloqueando `liberar-saida`.

**Architecture:** Extensão do módulo `operacao/faturamento` (services consolidacao/faturamento existentes + novos `seguros.service` e `liberacao-checklist.service`) e do gateway `integracoes/nfse` (adapter real substitui o stub; porta `NfseGateway` INALTERADA — RA-03/ADR-011). Migration **`0026`** expand: tabela `seguros_carga` + coluna `notas_fiscais.modelo_fiscal` (CHECK `padrao|rtc`, default `padrao`). Frontend: reescreve `pre-faturamento` (remove nota "pendente de definição" — AD-02), substitui os placeholders de `notas-xml` e `seguro-manual`, e completa `liberacao` com o checklist real. **A emissão contra o EISS de homologação NÃO faz parte do gate desta onda** — CI/dev usam `NFSE_FAKE=1`; o teste de homologação real é o passo pós-merge (ver "Homologação: plano de ativação").

**Tech Stack:** NestJS 11 + TS 5 strict, **node-soap** (dependência nova — única desta onda), Drizzle (PostgreSQL 18), Zod 4, `@nestjs/event-emitter` + hub WS nativo, Jest, Next.js 16 (BFF) + React 19 + shadcn/ui + Playwright. `NFSE_FAKE=1` em testes (ADR-011).

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
- `EmitirEmLote` SOAP assíncrono (lote do EISS): o "Emitir em lote" da tela é um laço **sequencial** de `Emitir` unitário no backend (o manual proíbe emissões simultâneas; o lote SOAP de 5000 notas é para volumes que não são o caso).
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

**D10.3 — Serialização de emissões (manual: "requisições simultâneas podem falhar ambas").** O `FaturamentoService.emitir` e o laço do lote executam em fila por prestador: mutex simples em memória (`private emissaoEmAndamento: Promise<void>`) encadeando emissões — suficiente para instância única on-premises (deployment atual). "Emitir em lote" da tela = endpoint `POST /faturamento/caminhoes/:caminhaoId/emitir-lote` que itera os pedidos elegíveis (status `pendente`/`erro_emissao` com dados fiscais completos) chamando a MESMA rotina unitária em sequência; resultado por pedido no response (`{ emitidas: n, erros: [{pedidoId, mensagem}] }`). Timeout de transporte no meio do lote → para o lote no ponto (pedidos restantes ficam `pendente`), consulta reconciliação do que ficou em dúvida.

**D10.4 — Trava de cancelamento pós-liberação.** `cancelar` já existente ganha guard: se o caminhão da nota tem `statusCaminhao IN ('liberado_saida','expedido')` → 409 `NOTA_TRAVADA_CAMINHAO_LIBERADO` (sem chamada SOAP). Frontend desabilita o botão com `title` (fidelidade `NotasXml.tsx:492`), mas a regra vive no backend (RA-01).

**D10.5 — `seguros_carga` (F6b).** Migration 0026: `id` uuidv7 PK, `caminhao_id` FK NOT NULL UNIQUE-parcial (1 seguro vivo por caminhão: `WHERE deleted_at IS NULL`), `valor_carga` NUMERIC(15,2) NULL (apurável), `status` TEXT CHECK (`pendente|enviado|confirmado`) DEFAULT `pendente`, `responsavel_id` FK usuarios NULL, `enviado_em`/`confirmado_em` TIMESTAMPTZ NULL, `observacao` TEXT NULL, `anexos_json` JSONB DEFAULT `[]` (lista de `{nome, descricao, registradoEm, registradoPor}` — referências, sem upload físico), `created_at`/`updated_at`/`deleted_at` padrão. Transições válidas: `pendente→enviado` (grava `enviado_em`+`responsavel_id`), `enviado→confirmado` (grava `confirmado_em`), `enviado→pendente` (regressão permitida com auditoria; protótipo não mostra, mas operação manual erra — regra registrada aqui). `confirmado` é terminal (correção = soft delete + novo registro, auditado). O registro nasce lazy: primeiro acesso da tela de seguro a um caminhão com carga cria o registro `pendente` (ou `POST /faturamento/seguros` idempotente por `caminhaoId`).

**D10.6 — Checklist de liberação calculado (sem tabela própria).** `GET /faturamento/liberacao/:caminhaoId/checklist` monta em SQL: (1) `cargaConferida` = caminhão `statusCaminhao IN ('fechado','liberado_faturamento','faturado','liberado_saida','expedido')` (conferência concluída); (2) `notasAutorizadas` = COUNT notas vivas do caminhão com `statusNfse='emitida'` vs total de pedidos da carga (`ok` quando todas); (3) `seguroConfirmado` = registro `seguros_carga` vivo com `status='confirmado'` — **se o parâmetro `faturamento.seguro_obrigatorio` (seed `true`, badge Provisório) for `false`, o requisito reporta `ok=true` com detalhe "dispensado por parâmetro"**; (4) `caminhaoMotorista` = `placa` e `motorista` não-nulos/não-vazios. Response: `{ requisitos: [{chave, rotulo, ok, detalhe}], liberavel: boolean }`. O `POST /caminhoes/:id/liberar-saida` EXISTENTE ganha o guard: checklist não-liberável → 409 `CHECKLIST_INCOMPLETO` com a lista de requisitos reprovados (RA-01 — a trava é do backend, o botão desabilitado é cortesia).

**D10.7 — Rastreabilidade da nota.** `GET /faturamento/notas/:id/rastreabilidade`: nota → pedido de venda (nº, cliente) → `carga_itens` do pedido no caminhão da nota → peças/subitens (etiqueta, produto, peso) → totais. Somente leitura, joins sobre tabelas existentes; response espelha o drawer do protótipo.

**D10.8 — Listagem de notas.** `GET /faturamento/notas?status=&caminhaoId=&clienteId=&busca=&page=&pageSize=` (envelope padrão). `busca` cobre `numero_nfse`, `codigo_verificacao` e nome do cliente (ILIKE). Perfis de consulta ampliada (matriz linha 27): `logistica` e `diretoria` ganham `FATURAMENTO_LER`.

**D10.9 — RBAC.** Permissões novas: `SEGURO_GERENCIAR` (`'Registrar envio e confirmação do seguro de carga'`) e `LIBERACAO_GERENCIAR` (`'Liberar caminhão por checklist'`). Concessões: `faturamento`, `gestor`, `administrador` → ambas; `logistica` → ambas (doc 04 §7.3/§7.4 — logística opera seguro e liberação); `diretoria`+`logistica` → `FATURAMENTO_LER` (consulta). GETs de seguro/checklist aceitam `FATURAMENTO_LER` OU a permissão de gestão respectiva (padrão `@RequireQualquerPermissao` da Onda 9). Regenerar `perfil-permissoes.snapshot.json` via `scripts/regen-rbac-snapshot.ts`.

**D10.10 — Eventos novos.** `SEGURO_ATUALIZADO: 'seguro_atualizado'` (payload `{caminhaoId, seguroId, status, dataOperacao}`) e `CAMINHAO_LIBERADO: 'caminhao_liberado'` (payload `{caminhaoId, dataOperacao}` — emitido pelo `liberar-saida` que hoje não emite). Handlers no gateway (padrão F5); clients das 4 telas: `conectarRealtime(['dashboard'])` com refetch em `NFSE_EMITIDA|CANCELADA|ERRO_EMISSAO`, `SEGURO_ATUALIZADO`, `CAMINHAO_LIBERADO`, `EXPEDICAO_LIBERADA_FATURAMENTO`.

**D10.11 — node-soap.** Dependência nova `soap` (node-soap) no `app/backend`. Cliente criado por WSDL local **vendorizado** (`app/backend/src/integracoes/nfse/wsdl/NotaFiscalEletronica.wsdl`, baixado do endpoint e commitado — CI não acessa a internet) com `endpoint` sobrescrito por `EISS_ENDPOINT_HML|PRD`; `forceSoap12Headers: false`; timeout `EISS_TIMEOUT_MS` (30s). Falha de transporte (timeout/5xx/ECONNREFUSED) → `NfseTransporteError`; response com `Erro=true` → `NfseResultado.erro=true` (NÃO exception). Se baixar o WSDL não for possível antes da implementação, o adapter monta o envelope por template string (estrutura literal do manual, já documentada) e faz POST HTTPS com `SOAPAction` — decisão do worker registrada no PR (ambas as formas satisfazem o DoD; o contrato testável é o `NfseGateway`).

**D10.12 — Fake atualizado.** `FakeNfseGateway` passa a devolver `NfseResultado` no shape novo (com `linkNota` e eco de `identificador`) e ganha gatilhos determinísticos: pedido com valor `999.99` → `Erro=true` "Atividade não autorizada" (testa caminho de erro de negócio); valor `888.88` → `NfseTransporteError` (testa retry). Mantém emissões felizes para os demais.

## Estrutura de arquivos

```
app/backend/package.json                                                    [T2: + soap]
app/backend/src/database/migrations/0026_onda10_faturamento_expand.sql      [T1: gerada por drizzle-kit]
app/backend/src/database/schema/faturamento.schema.ts                       [T1: + segurosCarga, + modeloFiscal]
app/backend/src/database/schema/index.ts                                    [T1: export]
app/backend/src/database/seed.ts                                            [T1: parâmetros faturamento.*]
app/backend/src/integracoes/nfse/nfse.types.ts                              [T2: campos novos req/res (interface NfseGateway estável + método rtcPesquisarNbsClassTrib)]
app/backend/src/integracoes/nfse/payload-builder.ts                         [T2: estrutura real D10.1]
app/backend/src/integracoes/nfse/eiss-client.adapter.ts                     [T2: adapter node-soap real]
app/backend/src/integracoes/nfse/fake-nfse.gateway.ts                       [T2: D10.12]
app/backend/src/integracoes/nfse/wsdl/NotaFiscalEletronica.wsdl             [T2: vendorizado (se D10.11 via WSDL)]
app/backend/src/modules/operacao/faturamento/faturamento.service.ts         [T3: mutex + emitir-lote + flag RTC + trava cancelamento]
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

### T1 — Migration 0026 + schema + seeds
- [ ] `faturamento.schema.ts`: tabela `segurosCarga` (D10.5) + coluna `modeloFiscal` em `notasFiscais` (D10.2). Export em `index.ts`.
- [ ] `drizzle-kit generate --name onda10_faturamento_expand` → `0026` (conferir journal/snapshot contíguos, `prevId` = snapshot 0025).
- [ ] Seeds de parâmetros (`parametros`): `faturamento.codigo_servico_atividade`=`"14.01"`, `faturamento.simples_nacional`=`"false"`, `faturamento.modelo_fiscal`=`"padrao"`, `faturamento.seguro_obrigatorio`=`"true"`, `faturamento.rtc_class_trib`=`""`, `faturamento.rtc_codigo_nbs`=`""`, `faturamento.rtc_ind_operacao`=`""`, `faturamento.rtc_id_local_incidencia`=`""` — todos `provisorio=true` (badge na UI de Parâmetros já existente).

### T2 — Adapter EISS real + tipos + fake
- [ ] `npm i soap` (backend). Atualizar `nfse.types.ts` conforme D10.1 (campos novos: `identificador`, `nrExercicioReferencia`, `nrMesReferencia`, `semIncidenciaISS`, `simplesNacional`, `tomadorEstrangeiro`, `deduzirRepasse`, `informacoesAdicionais` substitui `descricaoServico`, `atividade` substitui `codigoServico`; campos RTC opcionais; `NfseResultado.linkNota` + `identificadorEco`; método novo `rtcPesquisarNbsClassTrib(atividade)` na interface).
- [ ] `payload-builder.ts`: montar o shape novo; unit tests com asserção campo a campo contra os exemplos de `docs/integrações/nfse-osasco/exemplos/`.
- [ ] `eiss-client.adapter.ts`: implementação node-soap (D10.11) para `emitir` (padrão E RTC conforme `modeloFiscal` do request), `cancelar`, `consultarNotaCompleta`, `rtcPesquisarNbsClassTrib`. Mapeamento de retorno `NotaFiscalGerada` → `NfseResultado`. `redigirSegredos` antes de devolver `raw`.
- [ ] `fake-nfse.gateway.ts`: D10.12.
- [ ] `eiss-adapter.spec.ts`: unit com client SOAP mockado — sucesso, `Erro=true` (não lança), timeout → `NfseTransporteError`, redação do token no `raw`.

### T3 — FaturamentoService: mutex, lote, RTC, trava
- [ ] Mutex de emissão (D10.3) encadeando `emitir`; teste unit: 2 `emitir` concorrentes executam em série (spy de ordem).
- [ ] `emitirLote(caminhaoId, usuarioId)`: itera pedidos elegíveis, chama a rotina unitária, agrega `{emitidas, erros[]}`; para em `NfseTransporteError`.
- [ ] Flag RTC (D10.2): leitura de parâmetros, validação `RTC_PARAMETROS_INCOMPLETOS`, gravação de `modeloFiscal` na nota.
- [ ] Trava de cancelamento (D10.4): guard por status do caminhão antes do SOAP; 409 `NOTA_TRAVADA_CAMINHAO_LIBERADO`.

### T4 — Rotas de consulta
- [ ] `notas-consulta.service.ts`: `listar` (D10.8) + `rastreabilidade` (D10.7). Controller: `GET /faturamento/notas` e `GET /faturamento/notas/:id/rastreabilidade` (`FATURAMENTO_LER`); `POST /faturamento/caminhoes/:caminhaoId/emitir-lote` (`NFSE_EMITIR`); `GET /faturamento/rtc/pesquisar-nbs` (`FATURAMENTO_GERENCIAR`).

### T5 — Seguros (F6b)
- [ ] `seguros.service.ts`: `listar` (com dados do caminhão/carga + notas vinculadas), `obterOuCriar(caminhaoId)` idempotente, `alterarStatus` (transições D10.5, `db.transaction`+auditoria+evento pós-commit), `registrarAnexo`, `salvarObservacao`.
- [ ] Rotas: `GET /faturamento/seguros?status=&busca=` e `POST /faturamento/seguros` (`FATURAMENTO_LER`/`SEGURO_GERENCIAR`), `PATCH /faturamento/seguros/:id/status`, `POST /faturamento/seguros/:id/anexos`, `PATCH /faturamento/seguros/:id/observacao` (`SEGURO_GERENCIAR`).
- [ ] `seguros-regras.spec.ts`: transições válidas/inválidas (409 `TRANSICAO_SEGURO_INVALIDA`), terminalidade de `confirmado`, unicidade parcial.

### T6 — Checklist de liberação
- [ ] `liberacao-checklist.service.ts`: cálculo D10.6. Rota `GET /faturamento/liberacao/:caminhaoId/checklist` (`FATURAMENTO_LER`/`LIBERACAO_GERENCIAR`).
- [ ] Guard em `liberacao.service.ts` (expedicao): `liberarSaida` consulta o checklist; não-liberável → 409 `CHECKLIST_INCOMPLETO` + requisitos reprovados; sucesso emite `CAMINHAO_LIBERADO` pós-commit.
- [ ] `liberacao-checklist.spec.ts`: 4 requisitos individualmente reprovados, `seguro_obrigatorio=false` dispensa, tudo-ok libera.

### T7 — RBAC + eventos
- [ ] D10.9 em `permissoes.ts` + regenerar snapshot. D10.10 em `eventos.ts` + handlers no gateway.

### T8–T11 — Telas (fidelidade Princípio I)
- [ ] T8 Pré-Faturamento: reescrever client fiel a `Faturamento.tsx` (blocos da tabela de referências) sobre `GET consolidacao` + `POST emitir`/`emitir-lote`/`reprocessar`; badge de ambiente substitui o badge "pendente de definição"; teste RTL (KPIs, bloqueios, ações por status).
- [ ] T9 Notas/XML: client novo fiel a `NotasXml.tsx` sobre `GET /faturamento/notas` + rastreabilidade + `ModalCancelar` (motivo obrigatório) + trava visual; botões XML/DANFE abrem `linkNfse` (desabilitados com `title` quando null); teste RTL (trava com carga liberada, modal exige motivo).
- [ ] T10 Seguro Manual: client novo fiel a `SeguroManual.tsx` sobre as rotas T5; ações de transição; anexo referencial (prompt de nome via Dialog do DS — NUNCA `window.prompt`); teste RTL (KPIs, transições, badge por status).
- [ ] T11 Liberação: completar client fiel a `LiberacaoCaminhao.tsx` sobre checklist real; pendências impeditivas com links; botão liberar → `POST liberar-saida` (exibe requisitos reprovados do 409); teste RTL (checklist incompleto desabilita, links de resolução).
- [ ] Rotas BFF de repasse para todos os endpoints novos (padrão `repassar()`).

### T12 — Gate local + evidências
- [ ] `onda10-faturamento.e2e-spec.ts` (integração, `NFSE_FAKE=1`): mapa DoD abaixo.
- [ ] Playwright `onda10-faturamento.spec.ts` (backend+frontend reais, fake NFS-e): jornada pré-faturamento → emitir → notas → seguro → liberação; screenshots em `docs/evidencias/onda10-faturamento/` comparados ao protótipo.
- [ ] Gate: lint + type-check + `test:cov` ≥80% (backend e frontend) + build. Abrir PR (sem merge).

## Mapa DoD → teste (1:1)

| DoD | Invariante | Teste (nome literal do `it`) |
|---|---|---|
| 10.1 | Payload `Emitir` padrão bate campo a campo com a estrutura do manual (Atividade, InformacoesAdicionais, referências, booleans obrigatórios, DeduzirRepasse=false, sem Prestador) | `payload-builder.spec.ts › 'DoD 10.1 payload padrao segue estrutura do manual V10.6'` |
| 10.2 | `Erro=true` com HTTP 200 → `NfseResultado.erro=true` sem exception; nota vai a `erro_emissao` com `ultimoErroNfse` | `eiss-adapter.spec.ts › 'DoD 10.2a Erro=true nao lanca'` + e2e `'DoD 10.2b emissao com erro de negocio grava erro_emissao'` |
| 10.3 | Timeout de transporte → `NfseTransporteError`; serviço consulta antes de retransmitir; sem nota duplicada | e2e `'DoD 10.3 timeout gera retry com reconciliacao e nota unica'` |
| 10.4 | Duas emissões concorrentes executam serializadas (mutex) | unit `'DoD 10.4 emissoes concorrentes serializam'` |
| 10.5 | `emitir-lote` emite só elegíveis, agrega erros por pedido, para em falha de transporte | e2e `'DoD 10.5 emitir em lote sequencial'` |
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
