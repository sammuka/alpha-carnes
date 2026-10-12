# AlphaCarnes ERP — protótipo navegável DS v3 | Matriz integral de interfaces
> Versão 1.0 (11/10/2026). Definição funcional do protótipo, não implementação operacional. Adoção ratificada: 13 grupos de navegação, PostgreSQL para ciphertext AES-256-GCM, chave mestra AWS KMS externa.

## Execução local e aprofundamento
- O navegador deve servir arquivos locais por HTTP para garantir resolução do CSS compartilhado DS v3: na raiz do repo execute `python -m http.server 8000`, depois acesse `http://localhost:8000/docs/prototipos/erp-integrado-v1/index.html`.
- O protótipo é HTML/CSS/JS estático e sem dependência de backend. **Nenhuma API, criptografia verdadeira, certificado ou arquivo real deve ser usado**. Uploads demonstram somente metadados locais e jamais comprovam habilitação bancária/SEFAZ.
- Navegação por deep-link: `index.html#E01-T01`, `index.html#E11-V03`, `index.html#E12-V02`. Para telas existentes, a referência é a branch develop; a UI nova não reimplementa a operação original.
- O CSS importa os tokens oficiais `docs/ds-preview/direcao-a/tokens.css` aprovados na AD-10. Nomes/identificadores derivam do Caderno B v1.1, E11 e E12. Dados de cenário são sintéticos.

## Cobertura verificável e componentes transversais
- 13 grupos no menu, 39 rotas legadas preservadas e 61 interfaces novas: E01=5, E02=5, E03=4, E04=5, E05=4, E06=5, E07=4, E08=4, E09=9, E10=4, E11=5, E12=7.
- Cada interface abre tela com filtros/seleção de registros, ficha com campos específicos da especificação, ações de domínio, formulação de versões, movimentos, regras, exceções, histórico, integração, aceite e testes. O protótipo contém módulos complementares específicos para fiscal, compra, contas, bancos, caixa, contabilidade e operações.
- 7 abas consistentes: **Ficha e campos**, **Movimentações**, **Regras e validações**, **Exceções**, **Histórico**, **Integrações**, **Aceite e testes**.
- Estados de loading/empty/error, validação HTML, confirmação com justificativa, bloqueio de operações financeiras reais, permissões demonstrativas e troca de ambiente HML/PROD. **A especificação exige que os agentes implementem backend e testes reais**, esta UI estática não lhes substitui.
- Jornada de certificados: upload simulado, verificação de metadados, senha transitória e rota de aprovação; na implementação usar KMS envelope + ciphertext no PostgreSQL, nunca segredo plaintext.
- Jornada bancária: remessa ≠ envio aceito; retorno de cobrança ≠ extrato; múltiplas observações API/arquivo convergem em um fato econômico, com revisão de identidade fraca.
- Critérios de qualidade no protótipo: navegação via teclado/foco, layout responsivo, avisos de conteúdo fictício, 13 grupos recolhíveis, nomenclatura DS v3, ausência de network calls e preservação da distinção homologação/produção.

## Mapeamento de cada interface (fonte → rota/hash → perfil → ações e exceções)

### E01 — Motor tributário (5 interfaces)

#### E01-T01 — Empresas, estabelecimentos e regime
- **Protótipo:** [`index.html#E01-T01`](index.html#E01-T01); grupo **FISCAL**, perfil de referência **gestor fiscal, contador e administrador**.
- **Campos:** CNPJ, IE, IM, CNAE, CRT, UF, município, certificado referenciado, vigência.
- **Ações e decisões:** cadastrar empresa e filial, ativar regime por vigência, aprovar alteração.
- **Regras:** não admitir empresa sem identificação nem regime sobreposto; regras por estabelecimento e competência.
- **Exceções:** CNPJ rejeitado; troca de regime; competência bloqueada.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E01-T01.

#### E01-T02 — Operações fiscais e enquadramentos
- **Protótipo:** [`index.html#E01-T02`](index.html#E01-T02); grupo **FISCAL**, perfil de referência **fiscal**.
- **Campos:** natureza operação, tpNF, finNFe, CFOP, origem/ destino, tipo própria ou revenda, NCM, CEST, contribuinte.
- **Ações e decisões:** cadastrar operação, duplicar perfil, relacionar produto e cliente, controlar prioridade.
- **Regras:** perfil nunca usa CFOP global como único determinante; critério temporal obrigatório.
- **Exceções:** empate de enquadramento e operação sem regra aprovada.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E01-T02.

#### E01-T03 — Editor de regras tributárias
- **Protótipo:** [`index.html#E01-T03`](index.html#E01-T03); grupo **FISCAL**, perfil de referência **fiscal/contador**.
- **Campos:** CST/CSOSN ICMS, pRedBC, pICMS, cBenef, CST IPI/PIS/COFINS, IBS/CBS/IS e cClassTrib.
- **Ações e decisões:** criar rascunho, adicionar versão, comparar, submeter, aprovar, aposentar.
- **Regras:** motor de regras não permite edição retroativa em nota emitida; aprovação segregada.
- **Exceções:** benefício não elegível; vigência ambígua; versão NT inválida.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E01-T03.

#### E01-T04 — Simulador fiscal e memória de cálculo
- **Protótipo:** [`index.html#E01-T04`](index.html#E01-T04); grupo **FISCAL**, perfil de referência **fiscal/contador**.
- **Campos:** NCM, operação, cliente, data, pesos, vProd, descontos, bases, tributos por item, regras selecionadas.
- **Ações e decisões:** simular, explicar tributos, exportar memória, comparar versões.
- **Regras:** nenhum valor gerado vira lançamento fiscal sem documento; Decimal exato.
- **Exceções:** base tributável difere de valor bruto; falta referência legal.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E01-T04.

#### E01-T05 — Painel de alterações e homologação de regras
- **Protótipo:** [`index.html#E01-T05`](index.html#E01-T05); grupo **FISCAL**, perfil de referência **contador e auditor**.
- **Campos:** identificador regra, autor, motivo, legislação, cenários aprovados, vigência.
- **Ações e decisões:** revisar diff, aprovar/rejeitar, publicar e auditar.
- **Regras:** aprovador diferente do autor; cenários de regressão obrigatórios.
- **Exceções:** atualização normativa em meio à operação.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E01-T05.

### E02 — NF-e SEFAZ/SP (5 interfaces)

#### E02-T01 — Pré-emissão NF-e
- **Protótipo:** [`index.html#E02-T01`](index.html#E02-T01); grupo **FISCAL**, perfil de referência **faturamento/fiscal**.
- **Campos:** carga, pedido, cliente, estabelecimento, itens físicos, quantidades, valores e bloqueios.
- **Ações e decisões:** consolidar, pré-visualizar, validar cadastro, simular tributação, solicitar emissão.
- **Regras:** NF-e só dos itens efetivamente carregados e após fechamento; valores comerciais corretos.
- **Exceções:** divergência aberta, item sem NCM, série indisponível.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E02-T01.

#### E02-T02 — Central de emissão/autorização
- **Protótipo:** [`index.html#E02-T02`](index.html#E02-T02); grupo **FISCAL**, perfil de referência **faturamento com permissão NF-e**.
- **Campos:** série, nNF, chave 44 dígitos, tpAmb, status, protocolo, recibo, XML hash.
- **Ações e decisões:** assinar XML, enviar, consultar SEFAZ, reconciliar timeout, reprocessar rejeição.
- **Regras:** alocação serializável; não emitir duas notas para mesmo fato/identificador; certificado A1.
- **Exceções:** SEFAZ indisponível, falha TLS, timeout, rejeição  duplicidade.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E02-T02.

#### E02-T03 — Documentos autorizados e DANFE
- **Protótipo:** [`index.html#E02-T03`](index.html#E02-T03); grupo **FISCAL**, perfil de referência **faturamento, cliente interno**.
- **Campos:** XML nfeProc, protocolo, recibo, status, destinatário, valor e itens.
- **Ações e decisões:** listar, filtrar, baixar XML, gerar DANFE, reenviar ao destinatário, inspecionar auditoria.
- **Regras:** impressão DANFE nunca substitui autorização; XML íntegro arquivado.
- **Exceções:** arquivo indisponível, reenvio e acesso de terceiro.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E02-T03.

#### E02-T04 — Eventos e pós-autorização
- **Protótipo:** [`index.html#E02-T04`](index.html#E02-T04); grupo **FISCAL**, perfil de referência **fiscal**.
- **Campos:** eventos CC-e, cancelamento, inutilização de numeração, contingência, origem.
- **Ações e decisões:** solicitar, validar elegibilidade, transmitir evento, consultar status, registrar motivo.
- **Regras:** CC-e não corrige valor/tributação; cancelamento exige regra legal temporal, aprovação e trilha.
- **Exceções:** cancelamento fora prazo, evento rejeitado, contingência com reconciliação.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E02-T04.

#### E02-T05 — Console homologação SEFAZ
- **Protótipo:** [`index.html#E02-T05`](index.html#E02-T05); grupo **FISCAL**, perfil de referência **administrador fiscal**.
- **Campos:** ambiente, endpoint, certificado, expiração, séries, XSD/NT, status serviço.
- **Ações e decisões:** testar certificado sem expor segredo, validar schemas, executar cenários e liberar produção.
- **Regras:** produção desabilitada até credenciamento, checklist e autorização humana.
- **Exceções:** certificado vencido, indisponibilidade e schema novo.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E02-T05.

### E03 — Documentos de entrada (4 interfaces)

#### E03-T01 — Inbox de XML/DF-e de fornecedor
- **Protótipo:** [`index.html#E03-T01`](index.html#E03-T01); grupo **FISCAL**, perfil de referência **recebimento/fiscal**.
- **Campos:** NSU, chave, CNPJ, número/série, CFOP, itens, pesos/quantidades, total, status.
- **Ações e decisões:** sincronizar distribuição autorizada, importar XML, validar XML/assinatura, deduplicar, manifestar quando legal.
- **Regras:** importação não confirma recebimento físico; sem AP duplicado.
- **Exceções:** NSU repetido, XML malformado, destinatário divergente.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E03-T01.

#### E03-T02 — Conferência tripla de entrada
- **Protótipo:** [`index.html#E03-T02`](index.html#E03-T02); grupo **FISCAL**, perfil de referência **Fabrício, Richard, Karina**.
- **Campos:** pedido ao fornecedor, preço negociado, peso NF, peso Richard, peças e diferença.
- **Ações e decisões:** vincular NF a pedido/lote, conciliar, classificar divergências, aprovar ressalva.
- **Regras:** divergência de peso não cria devolução autorizada nem desconto tácito.
- **Exceções:** faltas, excesso, preço divergente, mercadoria não prevista.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E03-T02.

#### E03-T03 — Solicitações de devolução
- **Protótipo:** [`index.html#E03-T03`](index.html#E03-T03); grupo **FISCAL**, perfil de referência **Carla/fiscal**.
- **Campos:** origem NF, itens, quantidade/peso, motivo, acordo, autorização e referência.
- **Ações e decisões:** criar pré-solicitação, negociar, aprovar, emitir NF referenciada, acompanhar aceite.
- **Regras:** finNFe 4 + refNFe; sem aprovação nenhuma emissão automática.
- **Exceções:** devolução parcial, crédito não confirmado.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E03-T03.

#### E03-T04 — Custo de aquisição/CMV e valorização
- **Protótipo:** [`index.html#E03-T04`](index.html#E03-T04); grupo **FISCAL**, perfil de referência **controladoria/contador**.
- **Campos:** lote, produto, entradas, custos acessórios, movimento, método aprovado, saldo.
- **Ações e decisões:** consultar ficha custo, aprovar rateios, reconciliar estoque físico versus contábil.
- **Regras:** método de custo aprovado por contador; sem alteração de custo histórico silenciosa.
- **Exceções:** reclassificação tardia, período encerrado, perda de desossa.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E03-T04.

### E04 — Contas a pagar (5 interfaces)

#### E04-T01 — Painel contas a pagar
- **Protótipo:** [`index.html#E04-T01`](index.html#E04-T01); grupo **FINANCEIRO**, perfil de referência **Karina, Micaela**.
- **Campos:** fornecedor, título origem, total, saldo, parcelas, vencimento, status, natureza, centro custo.
- **Ações e decisões:** filtrar, abrir título, aprovar lançamento e consultar aging.
- **Regras:** NF conferida cria obrigação somente pela política aprovada; sem dupla obrigação por XML.
- **Exceções:** cancelamento documento, cobrança duplicada.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E04-T01.

#### E04-T02 — Cadastro de título/parcelamento
- **Protótipo:** [`index.html#E04-T02`](index.html#E04-T02); grupo **FINANCEIRO**, perfil de referência **financeiro**.
- **Campos:** documento suporte, credor, parcelas, vencimento, forma, retenções, juros, desconto.
- **Ações e decisões:** criar manualmente, parcelar, anexar evidência, reagendar e aprovar.
- **Regras:** soma parcelas igual valor líquido do título; alterações com motivo.
- **Exceções:** valor negativo, competência fechada, boleto divergente.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E04-T02.

#### E04-T03 — Despesas recorrentes e variáveis
- **Protótipo:** [`index.html#E04-T03`](index.html#E04-T03); grupo **FINANCEIRO**, perfil de referência **financeiro**.
- **Campos:** categoria água/luz/serviço/folha referenciada, fornecedor, periodicidade, competência.
- **Ações e decisões:** programar recorrência, gerar provisão, aprovar documento e pagamento.
- **Regras:** não gerar passivo contábil duplicado por recorrência e nota.
- **Exceções:** contrato vencido, calendário e duplicidade.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E04-T03.

#### E04-T04 — Agenda de pagamentos
- **Protótipo:** [`index.html#E04-T04`](index.html#E04-T04); grupo **FINANCEIRO**, perfil de referência **tesouraria**.
- **Campos:** conta pagadora, títulos aptos, banco, destinatário, limites, saldo projetado.
- **Ações e decisões:** agendar, submeter dupla aprovação, transmitir API quando habilitada, consultar retorno.
- **Regras:** nunca considerar pago antes da confirmação bancária; autorização em duas etapas.
- **Exceções:** saldo insuficiente, API indisponível, pagamento rejeitado.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E04-T04.

#### E04-T05 — Devoluções, abatimentos e créditos
- **Protótipo:** [`index.html#E04-T05`](index.html#E04-T05); grupo **FINANCEIRO**, perfil de referência **Karina**.
- **Campos:** NF original, reclamação, acordo, documento emitido, abatimento aprovado.
- **Ações e decisões:** relacionar crédito, abater parcial, estornar, reconciliar DDA.
- **Regras:** não baixar valor de fornecedor apenas por peso divergente.
- **Exceções:** DDA não reflete abatimento, autorização não recebida.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E04-T05.

### E05 — Contas a receber (4 interfaces)

#### E05-T01 — Painel contas a receber
- **Protótipo:** [`index.html#E05-T01`](index.html#E05-T01); grupo **FINANCEIRO**, perfil de referência **financeiro/comercial consulta**.
- **Campos:** cliente, documento fiscal autorizado, parcela, valor, vencimento, saldo, cobrança.
- **Ações e decisões:** listar, buscar, notificar, abrir aging, classificar atraso.
- **Regras:** reconhecer AR por documento/evidência de faturamento sem duplicidade.
- **Exceções:** NF-e cancelada, crédito devolvido, cliente inadimplente.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E05-T01.

#### E05-T02 — Faturamento financeiro e parcelamento
- **Protótipo:** [`index.html#E05-T02`](index.html#E05-T02); grupo **FINANCEIRO**, perfil de referência **faturamento/financeiro**.
- **Campos:** NF-e, pedidos, condições negociadas, vencimentos, juros, descontos autorizados.
- **Ações e decisões:** gerar títulos, parcelar, revisar, emitir cobrança por banco.
- **Regras:** total de parcelas reconcilia ao valor devido; preço após expedição imutável sem evento.
- **Exceções:** parcelas inconsistentes, prazos divergentes.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E05-T02.

#### E05-T03 — Central de cobrança
- **Protótipo:** [`index.html#E05-T03`](index.html#E05-T03); grupo **FINANCEIRO**, perfil de referência **financeiro**.
- **Campos:** banco/conta, nosso número, documento, linha digitável, código barras, status registro.
- **Ações e decisões:** registrar boleto, consultar, cancelar/alterar conforme capability, reenviar link.
- **Regras:** somente boleto registrado realmente é cobrança ativa; evitar cobrança duplicada.
- **Exceções:** registro pendente, convênio não habilitado, webhook atrasado.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E05-T03.

#### E05-T04 — Inadimplência e renegociação
- **Protótipo:** [`index.html#E05-T04`](index.html#E05-T04); grupo **FINANCEIRO**, perfil de referência **cobrança/gestão**.
- **Campos:** cliente, títulos, históricos, acordos, desconto, encargos, status.
- **Ações e decisões:** negociar com autorização, formalizar acordo, reprogramar vencimentos.
- **Regras:** não apagar original; crédito e saldo continuam rastreáveis.
- **Exceções:** baixa parcial, contestação, desconto fora alçada.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E05-T04.

### E06 — APIs bancárias (5 interfaces)

#### E06-T01 — Contas bancárias, convênios e capacidades
- **Protótipo:** [`index.html#E06-T01`](index.html#E06-T01); grupo **BANCOS & TESOURARIA**, perfil de referência **admin bancário**.
- **Campos:** banco, agência/conta mascaradas, carteira, convênio, scopes, mTLS, OAuth, secrets refs.
- **Ações e decisões:** cadastrar banco, solicitar homologação, habilitar capability por conta, testar conectividade.
- **Regras:** capability não é presumida; credencial armazenada no cofre, jamais no UI.
- **Exceções:** convênio ausente, cert vencido, API só disponível em ambiente diferente.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E06-T01.

#### E06-T02 — Monitor cobrança multi-banco
- **Protótipo:** [`index.html#E06-T02`](index.html#E06-T02); grupo **BANCOS & TESOURARIA**, perfil de referência **tesouraria**.
- **Campos:** operação, externalId, nosso número, status, webhook, reconsulta.
- **Ações e decisões:** registrar, consultar, cancelar/alterar, sincronizar evento, recuperar erro.
- **Regras:** idempotência por banco/conta/operação/payload; reconciliação ativa de timeout.
- **Exceções:** 409 idempotência, 429, webhook duplicado, retorno fora de ordem.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E06-T02.

#### E06-T03 — Hub extratos, saldos e DDA
- **Protótipo:** [`index.html#E06-T03`](index.html#E06-T03); grupo **BANCOS & TESOURARIA**, perfil de referência **tesouraria**.
- **Campos:** data e período, transactionId, valor, descrição, vencimento, beneficiário, banco.
- **Ações e decisões:** consultar extratos/saldos, puxar títulos DDA quando disponível, agendar sincronismo.
- **Regras:** acesso autorizado, sem inventar endpoint DDA/baixa automática.
- **Exceções:** capability indisponível, lacuna de movimentos, rate limit.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E06-T03.

#### E06-T04 — Fila de pagamentos bancários
- **Protótipo:** [`index.html#E06-T04`](index.html#E06-T04); grupo **BANCOS & TESOURARIA**, perfil de referência **tesouraria**.
- **Campos:** instrução, assinatura, aprovadores, comprovante, status banco.
- **Ações e decisões:** enviar ordem, acompanhar, cancelar se permitido, anexar comprovante.
- **Regras:** não transmitir sem permissão e dupla aprovação; estado final depende do banco.
- **Exceções:** retorno desconhecido, falha de autenticação, saldo insuficiente.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E06-T04.

#### E06-T05 — Console operacional APIs
- **Protótipo:** [`index.html#E06-T05`](index.html#E06-T05); grupo **BANCOS & TESOURARIA**, perfil de referência **admin técnico**.
- **Campos:** monitoramento por banco, health, retry, audit trail, DLQ, credencial vencendo.
- **Ações e decisões:** consultar incidentes, reprocessar com idempotência, suspender conta.
- **Regras:** segredos redigidos, mTLS, rate limit e backoff por contrato homologado.
- **Exceções:** indisponibilidade, divergência de payload por versão.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E06-T05.

### E07 — Conciliação bancária (4 interfaces)

#### E07-T01 — Painel conciliação por conta/período
- **Protótipo:** [`index.html#E07-T01`](index.html#E07-T01); grupo **BANCOS & TESOURARIA**, perfil de referência **Karina/tesouraria**.
- **Campos:** extrato consolidado, títulos AP/AR, pagamentos, recebimentos, tarifas, pendências.
- **Ações e decisões:** sincronizar, comparar, filtrar conciliados/não conciliados, fechar sessão.
- **Regras:** um lançamento de extrato não pode liquidar duas obrigações salvo rateio explícito.
- **Exceções:** mesmo valor várias vezes, informações incompletas.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E07-T01.

#### E07-T02 — Motor de sugestões e matching
- **Protótipo:** [`index.html#E07-T02`](index.html#E07-T02); grupo **BANCOS & TESOURARIA**, perfil de referência **tesouraria**.
- **Campos:** banco, txId, nosso número, cliente, valor, data, documento e confiança.
- **Ações e decisões:** gerar matches determinísticos, exibir explicação, conciliar manualmente, desfazer.
- **Regras:** auto-conciliação somente para chave forte + valor/competência compatíveis; resto revisão.
- **Exceções:** pagamento parcial, tarifa, chargeback, duplicidade.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E07-T02.

#### E07-T03 — Baixas e estornos financeiros
- **Protótipo:** [`index.html#E07-T03`](index.html#E07-T03); grupo **BANCOS & TESOURARIA**, perfil de referência **financeiro com alçada**.
- **Campos:** títulos, alocações, diferença, encargos, conta, momento e autorização.
- **Ações e decisões:** confirmar baixa total/parcial, contabilizar tarifa e desconto, estornar com motivo.
- **Regras:** saldo não pode ficar negativo; estorno não exclui baixa histórica.
- **Exceções:** arquivo de banco retroativo, pagamento devolvido.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E07-T03.

#### E07-T04 — Fechamento da conciliação
- **Protótipo:** [`index.html#E07-T04`](index.html#E07-T04); grupo **BANCOS & TESOURARIA**, perfil de referência **controladoria**.
- **Campos:** período, saldo abertura, créditos/débitos, saldo final, reconciliações e discrepâncias.
- **Ações e decisões:** submeter conferência, aprovar fechamento, reabrir mediante trilha.
- **Regras:** saldo conciliado deve bater com extrato disponível e razão tesouraria.
- **Exceções:** movimento tardio, ajuste contábil posterior.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E07-T04.

### E08 — Tesouraria (4 interfaces)

#### E08-T01 — Posição bancária e de caixa
- **Protótipo:** [`index.html#E08-T01`](index.html#E08-T01); grupo **BANCOS & TESOURARIA**, perfil de referência **Karina**.
- **Campos:** contas, saldos bancários, pendências, saldos conciliados, reservas e exposição.
- **Ações e decisões:** atualizar, consultar origem, comparar saldos e extratos.
- **Regras:** saldo bancário informado pela API versus saldo contábil exibidos separadamente.
- **Exceções:** API sem extrato ou saldo em tempo real.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E08-T01.

#### E08-T02 — Fluxo de caixa previsto/realizado
- **Protótipo:** [`index.html#E08-T02`](index.html#E08-T02); grupo **BANCOS & TESOURARIA**, perfil de referência **gestão/financeiro**.
- **Campos:** entradas AR, saídas AP, despesas, parcelas, contas, datas, cenário.
- **Ações e decisões:** simular período, filtrar conta, visualizar projeção, exportar.
- **Regras:** projetado nunca misturar com realizado; data efetiva de liquidação.
- **Exceções:** atrasos, pagamentos parciais e novos compromissos.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E08-T02.

#### E08-T03 — Aplicações, tarifas e transferências
- **Protótipo:** [`index.html#E08-T03`](index.html#E08-T03); grupo **BANCOS & TESOURARIA**, perfil de referência **tesouraria/contador**.
- **Campos:** conta origem/destino, operação bancária, rendimento, taxa, categoria, tributos.
- **Ações e decisões:** registrar aplicação/resgate, conciliar, reconhecer encargo e transferência.
- **Regras:** transferências não duplicam receita/despesa; cada perna conciliada.
- **Exceções:** tarifa automática, estorno e data de liquidação.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E08-T03.

#### E08-T04 — Painel de risco de liquidez
- **Protótipo:** [`index.html#E08-T04`](index.html#E08-T04); grupo **BANCOS & TESOURARIA**, perfil de referência **diretoria**.
- **Campos:** saldo mínimo, contas a vencer, caixa disponível, alertas, concentração.
- **Ações e decisões:** configurar alertas, visualizar janelas e compromissos.
- **Regras:** alerta não é aprovação de crédito nem execução automática.
- **Exceções:** falta de saldo, previsão incerta.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E08-T04.

### E09 — Contabilidade e SPED (9 interfaces)

#### E09-T01 — Plano de contas e centros de custo
- **Protótipo:** [`index.html#E09-T01`](index.html#E09-T01); grupo **CONTABILIDADE**, perfil de referência **contador/controladoria**.
- **Campos:** conta sintética/analítica, código, natureza, grupo, validade, centro custo.
- **Ações e decisões:** criar, versionar, aprovar, bloquear conta e mapear lançamentos.
- **Regras:** partida dobrada, níveis hierárquicos válidos, competência obrigatória.
- **Exceções:** conta desativada, mudança de classificação após fechamento.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E09-T01.

#### E09-T02 — Políticas de contabilização
- **Protótipo:** [`index.html#E09-T02`](index.html#E09-T02); grupo **CONTABILIDADE**, perfil de referência **contador**.
- **Campos:** evento fonte, regra débito/crédito, centro custo, imposto, versão e data.
- **Ações e decisões:** configurar mappings, simular evento, aprovar regra.
- **Regras:** origem imutável, não lançar sem mapeamento correto, balanceamento exato.
- **Exceções:** mapeamento ausente, evento duplicado.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E09-T02.

#### E09-T03 — Diário, razão e lançamentos
- **Protótipo:** [`index.html#E09-T03`](index.html#E09-T03); grupo **CONTABILIDADE**, perfil de referência **contador**.
- **Campos:** data, competência, origem, linhas débitos/créditos, valor, histórico, usuário.
- **Ações e decisões:** consultar, lançar ajuste, estornar, anexar suporte, exportar.
- **Regras:** deve haver soma débitos=soma créditos; não editar lançamento postado.
- **Exceções:** período encerrado, documento cancelado.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E09-T03.

#### E09-T04 — Balancete, DRE e balanço
- **Protótipo:** [`index.html#E09-T04`](index.html#E09-T04); grupo **CONTABILIDADE**, perfil de referência **contador/diretoria**.
- **Campos:** período, plano contas, saldos, agrupamento, comparativo, centro custo.
- **Ações e decisões:** gerar, detalhar contas, comparar, exportar.
- **Regras:** reconciliar saldos com razão e critérios de competência.
- **Exceções:** saldo patrimonial incompatível, mapeamento incorreto.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E09-T04.

#### E09-T05 — Apuração fiscal por competência
- **Protótipo:** [`index.html#E09-T05`](index.html#E09-T05); grupo **CONTABILIDADE**, perfil de referência **contador/fiscal**.
- **Campos:** ICMS débitos/créditos, benefícios, IPI/PIS/COFINS, IBS/CBS/IS, IRPJ/CSLL e ajustes.
- **Ações e decisões:** apurar, simular, revisar, aprovar, emitir memória, contabilizar impostos.
- **Regras:** apuração depende regime, norma vigente e validação do responsável habilitado.
- **Exceções:** base divergente, tributo sem documentação, mudança legal.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E09-T05.

#### E09-T06 — Inventário contábil/CMV
- **Protótipo:** [`index.html#E09-T06`](index.html#E09-T06); grupo **CONTABILIDADE**, perfil de referência **controladoria**.
- **Campos:** entradas, saídas, desossa, perdas, produtos, custo por lote, critério método.
- **Ações e decisões:** fechar período, reconciliar físico, fiscal e razão, aprovar ajuste.
- **Regras:** método custo e avaliação fixados por política contábil, com histórico.
- **Exceções:** diferenças físicas e devoluções tardias.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E09-T06.

#### E09-T07 — Obrigações acessórias SPED
- **Protótipo:** [`index.html#E09-T07`](index.html#E09-T07); grupo **CONTABILIDADE**, perfil de referência **contador**.
- **Campos:** empresa, período, layout, arquivo ECD/ECF/EFD, regras, erros, recibo.
- **Ações e decisões:** gerar conforme obrigatoriedade, validar, revisar, assinar/transmitir apenas com credenciais e processo aprovado.
- **Regras:** não alegar conformidade por gerar arquivo; homologação PVA/validador é gate externo.
- **Exceções:** registro obrigatório ausente, versão de layout nova.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E09-T07.

#### E09-T08 — Fechamento e reabertura de períodos
- **Protótipo:** [`index.html#E09-T08`](index.html#E09-T08); grupo **CONTABILIDADE**, perfil de referência **contador/controller**.
- **Campos:** período, módulos reconciliados, pendências, aprovação, hash.
- **Ações e decisões:** pré-fechar, validar balanço, fechar, emitir relatório, reabrir com alçada.
- **Regras:** período fechado só altera por lançamento de ajuste/estorno e reabertura auditada.
- **Exceções:** movimento bancário tardio, NF-e retroativa.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E09-T08.

#### E09-T09 — Relatórios e exportação contábil
- **Protótipo:** [`index.html#E09-T09`](index.html#E09-T09); grupo **CONTABILIDADE**, perfil de referência **contador/auditoria**.
- **Campos:** filtros, lançamentos, contas, tributos, comprovantes e trilhas.
- **Ações e decisões:** exportar CSV/XLSX/layout contábil homologado, agendar relatórios.
- **Regras:** auditoria e máscara de dados; totais conciliados.
- **Exceções:** layout exportação do escritório desconhecido.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E09-T09.

### E10 — Integração operacional (4 interfaces)

#### E10-T01 — Adaptação de pré-faturamento para SEFAZ
- **Protótipo:** [`index.html#E10-T01`](index.html#E10-T01); grupo **FATURAMENTO**, perfil de referência **faturamento**.
- **Campos:** dados reais de expedição, preço Onda14, peso, tributos, NFe chave e bloqueios.
- **Ações e decisões:** substituir ação de emissão NFS-e para mercadorias, abrir prévia NF-e.
- **Regras:** não alterar fluxo operacional/estoque já aprovado; EISS não é autorização mercadoria.
- **Exceções:** carga parcial, estado pendente do SEFAZ.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E10-T01.

#### E10-T02 — Conferência e ocorrência fiscal no recebimento
- **Protótipo:** [`index.html#E10-T02`](index.html#E10-T02); grupo **FATURAMENTO**, perfil de referência **recebimento/fiscal**.
- **Campos:** item comprado, XML fornecedor, peso Richard, preço Fabrício, qualidade.
- **Ações e decisões:** abrir divergência, criar reclamação e pré-devolução.
- **Regras:** ocorrência não vira NF-e nem baixa bancária sem tratamento.
- **Exceções:** item não mapeado, desconto pendente.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E10-T02.

#### E10-T03 — Checklist de liberação fiscal
- **Protótipo:** [`index.html#E10-T03`](index.html#E10-T03); grupo **FATURAMENTO**, perfil de referência **expedição/logística**.
- **Campos:** placa, motorista, pedido, carga, NF-e autorizada, seguro e documento.
- **Ações e decisões:** mostrar bloqueios, emitir alerta, liberar após gates.
- **Regras:** sem NF-e autorizada e outros requisitos não libera carga normal.
- **Exceções:** contingência quando legalmente admitida.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E10-T03.

#### E10-T04 — Menus, perfis e auditoria ERP
- **Protótipo:** [`index.html#E10-T04`](index.html#E10-T04); grupo **FATURAMENTO**, perfil de referência **admin**.
- **Campos:** telas financeiras/fiscais por perfil, permissões por ação e segregação.
- **Ações e decisões:** criar grupos UI aprovados e trilha end-to-end.
- **Regras:** não quebrar menu canônico sem aditamento/protótipo e Quality Owner.
- **Exceções:** telas sem referência visual; aprovações conflitantes.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme Caderno B §E10-T04.

### E11 — Arquivo e contingência (5 interfaces)

#### E11-V01 — Caixa de Entrada de Arquivos
- **Protótipo:** [`index.html#E11-V01`](index.html#E11-V01); grupo **BANCOS & TESOURARIA**, perfil de referência **tesouraria e auditoria**.
- **Campos:** Banco, conta mascarada, convênio, serviço, formato CNAB 240/400, OFX ou CSV, versão layout, nome, tamanho, SHA256, situação, responsável, recebimento.
- **Ações e decisões:** importar arquivo, identificar formato pelo cabeçalho, pré-validar, classificar e acompanhar lote.
- **Regras:** nunca baixar títulos apenas por importar um arquivo; lote idempotente, com status de quarentena.
- **Exceções:** arquivo de outro convênio, extensão inválida, arquivo duplicado, hash conflitante.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme E11 especificação §4.

#### E11-V02 — Prévia, Validação e Aprovação do Lote
- **Protótipo:** [`index.html#E11-V02`](index.html#E11-V02); grupo **BANCOS & TESOURARIA**, perfil de referência **tesouraria e auditoria**.
- **Campos:** Instituição, conta, formato, serviço, versão, header, trailer, total de linhas, total créditos, total débitos, saldos, erros por linha, lote.
- **Ações e decisões:** comparar header e trailer, validar somatórios, aprovar lote, rejeitar com motivo, baixar relatório de inconsistências.
- **Regras:** somente lote validado e revisado alimenta observações canônicas; remessa gerada não significa enviada.
- **Exceções:** conta divergente, soma inconsistente, linha truncada, layout desatualizado.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme E11 especificação §4.

#### E11-V03 — Conflitos entre API e Arquivos
- **Protótipo:** [`index.html#E11-V03`](index.html#E11-V03); grupo **BANCOS & TESOURARIA**, perfil de referência **tesouraria e auditoria**.
- **Campos:** transação canônica, origem API/webhook/CNAB/OFX/CSV, chave bancária, valor, data efetiva, banco, nosso número, evidências.
- **Ações e decisões:** comparar observações, sugerir correspondência, solicitar revisão, confirmar ou rejeitar conciliação.
- **Regras:** mesma transação pode ter várias observações; valor/data isolados nunca justificam baixa.
- **Exceções:** identificador ausente, mesmo valor em transações distintas, retorno e extrato de datas diferentes.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme E11 especificação §4.

#### E11-V04 — Proveniência e Linha do Tempo Bancária
- **Protótipo:** [`index.html#E11-V04`](index.html#E11-V04); grupo **BANCOS & TESOURARIA**, perfil de referência **tesouraria e auditoria**.
- **Campos:** identificador transação, banco/conta, ID externo, hash arquivo, lotes, eventos API, webhook, origens, usuários, data/hora.
- **Ações e decisões:** navegar evidências originais, consultar decisões, reverter alocação com justificativa.
- **Regras:** proveniência append-only, não eliminar registros ao ocorrer falha ou correção.
- **Exceções:** duas fontes discordam, arquivo substituído, correção de retorno D+1.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme E11 especificação §4.

#### E11-V05 — Saúde dos Canais e Fallback
- **Protótipo:** [`index.html#E11-V05`](index.html#E11-V05); grupo **BANCOS & TESOURARIA**, perfil de referência **tesouraria e auditoria**.
- **Campos:** banco/conta/serviço, API disponível, formato de contingência homologado, último sucesso, falhas, modo, aprovador, próximo sync.
- **Ações e decisões:** habilitar fallback controlado, suspender, executar sincronização, reativar API, consultar checkpoint.
- **Regras:** API preferencial, arquivo contingência; não reenviar pagamento após timeout sem consulta.
- **Exceções:** API fora, layout não homologado, falha temporária, período sobreposto.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme E11 especificação §4.

### E12 — Central de integrações (7 interfaces)

#### E12-V01 — Catálogo de Integrações
- **Protótipo:** [`index.html#E12-V01`](index.html#E12-V01); grupo **ADMINISTRAÇÃO**, perfil de referência **administrador e responsável de integração**.
- **Campos:** provedor, serviço, empresa/CNPJ, estabelecimento, ambiente, endpoint, versão, certificados, capacidade, status, responsável.
- **Ações e decisões:** criar perfil, associar serviço, testar conexão sem efeitos externos, solicitar ativação, aprovar e suspender.
- **Regras:** configuração versionada em PostgreSQL; segregação HML/PROD e aprovação de produção.
- **Exceções:** endpoint não autorizado, credencial ausente, usuário sem permissão, dois perfis PROD ativos.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme E12 arquitetura §3 e Caderno B §4-B.

#### E12-V02 — Certificados Digitais e Rotação
- **Protótipo:** [`index.html#E12-V02`](index.html#E12-V02); grupo **ADMINISTRAÇÃO**, perfil de referência **administrador e responsável de integração**.
- **Campos:** empresa, estabelecimento, finalidade, ambiente, PFX/P12 ou CRT+KEY, senha transitória, emissor, titular/CNPJ, SHA256, cadeia, validade.
- **Ações e decisões:** fazer upload, validar certificado, testar assinatura ou mTLS, associar a perfil, substituir, revogar e programar alertas.
- **Regras:** chave privada criptografada no PostgreSQL sob envelope AES-256-GCM e KMS externo; senha PFX jamais persistida.
- **Exceções:** senha incorreta, chave/cert incompatíveis, certificado expirado, CNPJ divergente, revogação, A3 não compatível.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme E12 arquitetura §3 e Caderno B §4-B.

#### E12-V03 — Aplicações Bancárias e Credenciais
- **Protótipo:** [`index.html#E12-V03`](index.html#E12-V03); grupo **ADMINISTRAÇÃO**, perfil de referência **administrador e responsável de integração**.
- **Campos:** Bradesco/Itaú/Santander, CNPJ titular, conta, carteira, convênio, app ID, client ID, secrets write-only, escopos, certificados mTLS, webhook.
- **Ações e decisões:** cadastrar aplicações por ambiente/serviço, importar credencial, gerar CSR se permitido, testar token, homologar e suspender.
- **Regras:** OAuth/mTLS conforme banco habilitado; secrets criptografados; nunca preencher secret existente no GET.
- **Exceções:** contrato não disponível, certificado vencido, CA trocada, scope insuficiente, API limitada por convênio.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme E12 arquitetura §3 e Caderno B §4-B.

#### E12-V04 — Configuração Fiscal e SEFAZ
- **Protótipo:** [`index.html#E12-V04`](index.html#E12-V04); grupo **ADMINISTRAÇÃO**, perfil de referência **administrador e responsável de integração**.
- **Campos:** empresa e estabelecimento, IE, CRT, série, número, ambiente, status credenciamento, endpoints NF-e e DF-e, certificado e teste.
- **Ações e decisões:** configurar emitente, homologar status, consultar, simular XSD, habilitar credenciamento comprovado.
- **Regras:** URL aprovada por serviço e ambiente, não habilitar PROD sem certificado e parecer.
- **Exceções:** sem credenciamento, IE incorreta, certificado de outro CNPJ, XSD incompatível.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme E12 arquitetura §3 e Caderno B §4-B.

#### E12-V05 — Catálogos Oficiais e Versões
- **Protótipo:** [`index.html#E12-V05`](index.html#E12-V05); grupo **ADMINISTRAÇÃO**, perfil de referência **administrador e responsável de integração**.
- **Campos:** fonte oficial, norma, NT, XSD, layout bancário, versão, data de publicação, vigência, hash, diff, situação.
- **Ações e decisões:** baixar fonte em staging, comparar, validar, aprovar ativação por vigência, consultar histórico.
- **Regras:** sem mudança automática de tributação, regra fiscal ou retorno bancário pela simples atualização.
- **Exceções:** XSD NT incompatível, hash divergente, nova regra não aprovada, fonte offline.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme E12 arquitetura §3 e Caderno B §4-B.

#### E12-V06 — Jobs Batch e Histórico de Execução
- **Protótipo:** [`index.html#E12-V06`](index.html#E12-V06); grupo **ADMINISTRAÇÃO**, perfil de referência **administrador e responsável de integração**.
- **Campos:** provedor, serviço, agendamento, fuso, job, checkpoint, versão cert, status, tentativas, worker, run ID, resultado, erro.
- **Ações e decisões:** criar/pausar/agendar job, executar agora, inspecionar log, reprocessar sob aprovação, alterar checkpoint com trilha.
- **Regras:** sem sessão de usuário e sem .env de integração; lease/fencing, idempotência, retry e auditoria.
- **Exceções:** falha SEFAZ, NSU duplicado, rate limit, credencial expirada, lote pendente de revisão.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme E12 arquitetura §3 e Caderno B §4-B.

#### E12-V07 — Monitoramento e Alertas de Integrações
- **Protótipo:** [`index.html#E12-V07`](index.html#E12-V07); grupo **ADMINISTRAÇÃO**, perfil de referência **administrador e responsável de integração**.
- **Campos:** certificados a 60/30/15/7 dias, API status, última execução, falhas WS, incidentes, filas, webhook, versão, provedor.
- **Ações e decisões:** inspecionar evento, reconhecer alerta, pausar integração, consultar reprocessamento, emitir relatório.
- **Regras:** segredo nunca aparece em log; alarme rastreável e sem sucesso falso.
- **Exceções:** cert vencido, API indisponível, falha webhook, layout fora vigência, job parado.
- **Aceite do protótipo:** navegar até a tela e acessar 7 abas, ficha completa, formulário, ações com justificativa, histórico, fluxo de erro, controles de acesso simulados, vínculo com próximo domínio e evidência de reuso. **Aceite do software futuro:** implementar as ações reais e testes E2E conforme E12 arquitetura §3 e Caderno B §4-B.

## Jornadas interdomínios obrigatórias
- **Compra → NF entrada → conferência tripla → AP → conciliação → razão:** [E03-T01](index.html#E03-T01) → [E03-T02](index.html#E03-T02) → [E03-T03](index.html#E03-T03) → [E04-T01](index.html#E04-T01) → [E07-T02](index.html#E07-T02) → [E09-T02](index.html#E09-T02).
- **Venda → carga → NF-e → título → boleto → conciliação → razão:** [E10-T01](index.html#E10-T01) → [E02-T01](index.html#E02-T01) → [E02-T02](index.html#E02-T02) → [E05-T02](index.html#E05-T02) → [E05-T03](index.html#E05-T03) → [E07-T03](index.html#E07-T03) → [E09-T03](index.html#E09-T03).
- **Devolução referenciada → abatimento → fiscal/contábil:** [E03-T03](index.html#E03-T03) → [E02-T04](index.html#E02-T04) → [E04-T05](index.html#E04-T05) → [E07-T03](index.html#E07-T03) → [E09-T05](index.html#E09-T05).
- **Contingência API → arquivo → provenance → baixa única:** [E06-T01](index.html#E06-T01) → [E06-T02](index.html#E06-T02) → [E11-V01](index.html#E11-V01) → [E11-V02](index.html#E11-V02) → [E11-V03](index.html#E11-V03) → [E07-T02](index.html#E07-T02) → [E08-T02](index.html#E08-T02).
- **Fechamento contábil + SPED:** [E09-T01](index.html#E09-T01) → [E09-T02](index.html#E09-T02) → [E09-T04](index.html#E09-T04) → [E09-T05](index.html#E09-T05) → [E09-T07](index.html#E09-T07) → [E09-T08](index.html#E09-T08).
- **Configurar A1 e banco → job sem operador:** [E12-V01](index.html#E12-V01) → [E12-V02](index.html#E12-V02) → [E12-V03](index.html#E12-V03) → [E12-V04](index.html#E12-V04) → [E12-V06](index.html#E12-V06) → [E12-V07](index.html#E12-V07).
- **Atualizar norma → simulação fiscal → autorização:** [E12-V05](index.html#E12-V05) → [E01-T03](index.html#E01-T03) → [E01-T04](index.html#E01-T04) → [E02-T05](index.html#E02-T05) → [E09-T05](index.html#E09-T05).
- **API + CNAB + extrato e prevenção de duplicidade:** [E11-V01](index.html#E11-V01) → [E11-V03](index.html#E11-V03) → [E11-V04](index.html#E11-V04) → [E07-T01](index.html#E07-T01) → [E07-T03](index.html#E07-T03) → [E09-T03](index.html#E09-T03).

## Decisões, limites e requisitos inversos
- O menu **13 grupos** e a disposição proposta são ratificados para a expansão; não alterar 39 rotas antigas nem sua operação. Módulos novos ficam em grupos Fiscal, Financeiro, Bancos & Tesouraria e Contabilidade; E12 é submódulo em Administração → Integrações.
- Segredos e certificados: coluna PostgreSQL `BYTEA` para cipher e DEK cifrada; criptografia AES-256-GCM no NestJS; KEK no AWS KMS via IAM role; separar PROD/HML, contexto de criptografia, rotação e backup.
- O protótipo **não implementa** cryptografia, emissão NF-e, validação XSD, acesso a banco, upload real, execução batch ou escrita no banco. Qualquer alegação de disponibilidade dessas funções exige PR de código e UAT.
- Não produzir telas simplificadas no software final: cada item implica todos os campos, ações, estados, erros, versões e critérios explicitados nas specs e nos testes de aceite. O padrão de tela em mock não autoriza omitir decisões de domínio.
- Mudanças de menu no código exigem matriz RBAC, revisão do backend `MENUS_CANONICOS`, atualização do frontend `MENU_V2`, semântica de submenus, teste de perfis, DS v3 e gate Portão 1/2.

## Evidências de verificação do pacote
- Catálogo 61 novas interfaces com IDs sem duplicidade; 39 rotas existentes; navegação cobre 13 grupos.
- Código `aplicacao.js` compilado em V8 sem erro sintático e renderizado em DOM de teste para página inicial, jornadas e amostras representativas de todos os tipos de domínio. **Teste de navegador real e inspeção visual de screenshots ainda são necessários antes do aceite UX**.
- User acceptance exige revisar todas as 61 telas e 8 jornadas, estados de erro, loading, vazio e permissões conforme papéis indicados. Não afirmar certificação de acessibilidade AA apenas pelo CSS.
