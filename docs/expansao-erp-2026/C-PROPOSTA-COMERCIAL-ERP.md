# CADERNO C — Proposta comercial e técnico-econômica | AlphaCarnes
**Versão de negociação 1.0 · 10/10/2026 · PROPOSTA SEM VALORES VINCULANTES**
**Contratante:** AlphaCarnes (razão social, CNPJ e responsável a confirmar) • **Proponente:** a definir nos dados contratuais • **Moeda:** BRL • **Validade:** a definir antes do envio formal.

## 1. Resumo executivo
Esta proposta propõe a extensão modular do AlphaCarnes para **ERP fiscal estadual NF-e/SEFAZ-SP, financeiro, tesouraria, APIs bancárias Bradesco/Itaú/Santander, escrituração contábil integral, apuração e SPED legalmente aplicável**, preservando o núcleo operacional já em desenvolvimento. O software operacional não será indevidamente reprecificado como novo desenvolvimento.
Os termos técnicos e as inclusões/exclusões são definidos pelos anexos contratuais:
- **Anexo A:** `A-ESCOPO-EXISTENTE-DEVELOP.md` (39 telas, 8 jornadas, implementações/parcialidades/legado, RNF e exclusões).
- **Anexo B:** `B-ESCOPO-NOVOS-MODULOS-ERP.md` (10 épicos, 49 novas telas/funcionalidades, 8 jornadas, RNF e requisitos inversos).
- **Anexos de planejamento interno:** `00-INDICE-DECISOES-FONTES.md` e `10-BACKLOG-KIRO-TESTES.md`, após aprovação técnica.
Em conflito documental, prevalece o contrato assinado, a matriz de escopo assinada, e depois os anexos versionados com SHA explícito; modificações posteriores não integram automaticamente o preço.

## 2. Histórico e delimitação objetiva
O levantamento operacional remonta a junho/2026. Na reunião com Karina em 25/09/2026, surgiram fluxos fiscais, financeiros e contábeis que não estavam cobertos pelo código operacional. A conversa de 01/10 complementou telas operacionais. Em 10/10 o patrocinador decidiu NF-e SP direta, APIs dos três bancos desde o início e ERP contábil integral. **Os exemplos XML são evidência de operação existente, nunca chancela legal de alíquota.**
Escopo A é a linha-base e não constitui serviço novo contratado. Eventuais pendências no A devem ser examinadas frente à contratação anterior e classificadas como suporte, correção, entrega em andamento ou nova mudança aprovada. Escopo B é o objeto comercial desta proposta.

## 3. Objeto do contrato e forma de contratação
Prestação de serviços de desenvolvimento, integração, documentação e homologação assistida dos épicos E01–E10 do Anexo B. Código-fonte e artefatos no repo AlphaCarnes, seguindo pipeline `feature/* → PR → develop` e gates. **Não inclui** obrigação de executar escrituração/assinar como contador nem serviços de bancos/SEFAZ. Cada operação externa depende de habilitação do cliente.
Modelo comercial recomendado: **preço fixo por marcos homologáveis com critérios de mudança estritos**, e itens condicionais sob teto/orçamento separado (bancos, normativa SPED, migração histórica, integrações adicionais). Contratação parcial por marco deve ser tecnicamente viável sem reduzir completude dos entregáveis assumidos.

## 4. Matriz de entregas e pacote de investimento
| Pacote | Entregáveis e escopo | Dependência | Preço (R$) | Prazo (semanas) |
|---|---|---|---:|---:|
| P-01 | **Mobilização e análise das dependências** — revisão inventário A, workshop com Karina/contador/Fabrício, dados e papéis, plano de contas inicial, credenciais, regime/UF e aprovações | aprovação das tarefas ALP e insumos | a orçar | a estimar |
| P-02 | **Infra e arquitetura de integração** — entidades empresa/estabelecimento, RBAC segregado, outbox/inbox, filas, idempotência, cofre certificados, observabilidade, migrations, testes | aprovação das tarefas ALP e insumos | a orçar | a estimar |
| P-03 | **Motor fiscal versionado** — regras por operação/NCM/regime/UF/data, cenários XML, simulação, validação fiscal com contador e RTC | aprovação das tarefas ALP e insumos | a orçar | a estimar |
| P-04 | **NF-e 55 SEFAZ-SP** — assinatura digital A1, XML 4.00 schemas vigentes, autorização/consulta/cancelamento/CC-e/inutilização/contingência legal, DANFE, HML | aprovação das tarefas ALP e insumos | a orçar | a estimar |
| P-05 | **DF-e entrada e devoluções** — consulta distribuição NSU, importação, vínculo compra e peso Richard, divergências, devolução, custo fiscal | aprovação das tarefas ALP e insumos | a orçar | a estimar |
| P-06 | **AP, AR e pagamentos** — títulos, despesas recorrentes, parcelamento, comprovantes, cobrança, estorno, autorizações e trilhas | aprovação das tarefas ALP e insumos | a orçar | a estimar |
| P-07 | **APIs bancárias** — três conectores individualizados Bradesco/Itaú/Santander, cobrança, consulta, extrato e ordens somente quando capability contratada; HML | aprovação das tarefas ALP e insumos | a orçar | a estimar |
| P-08 | **Conciliação e tesouraria** — ingestão extrato, matching, baixa/estorno, saldos, fluxo previsto/realizado, aplicações/tarifas | aprovação das tarefas ALP e insumos | a orçar | a estimar |
| P-09 | **Contabilidade completa e SPED aplicável** — plano de contas, partidas dobradas, mapeamentos, razão/diário, DRE/BP, inventário e CMV, apuração, obrigações ECD/ECF/EFD conforme regime | aprovação das tarefas ALP e insumos | a orçar | a estimar |
| P-10 | **Adaptação operação e homologação ponta a ponta** — adequações a pré-faturamento, recebimento e liberação, perfis, cenários críticos, performance, Playwright e testes com usuários | aprovação das tarefas ALP e insumos | a orçar | a estimar |
**Não atribuir preço/prazo sem dimensionamento por equipe, análise de convênios e política fiscal aprovada.** Se houver custo de terceiros, itemizá-lo fora dos honorários e confirmar recorrência.

## 5. Entregáveis detalhados, critério de aceite e evidência por fase
### P-01 — Mobilização e análise das dependências
**Escopo funcional/tecnológico:** revisão inventário A, workshop com Karina/contador/Fabrício, dados e papéis, plano de contas inicial, credenciais, regime/UF e aprovações.
**Entregáveis verificáveis:** ata, matriz confirmação de premissas, backlog ALP fechado para execução, mapa de riscos.
**Pré-requisitos do cliente:** dados reais anonimizados para testes; aprovação de regras de negócio; credenciais/certificados bancários ou fiscais pertinentes; perfis e responsáveis habilitados. Se a API de um banco não expõe determinada operação no convênio do cliente, marcar como dependência externa e propor mudança formal em vez de simulá-la como sucesso.
**Aceite formal:** roteiro de testes com casos positivos/negativos do Caderno B; log do CI oito jobs, evidência de assinatura, certificado/sandbox quando pertinente, demonstração de operação e aceite por escrito do usuário responsável. Homologação externa é marco separado de implementação local.
**Limites explícitos:** requisitos inversos RI-B01 a RI-B17, sem customização de outro banco, nota modelo ou obrigação sem análise e aditivo.

### P-02 — Infra e arquitetura de integração
**Escopo funcional/tecnológico:** entidades empresa/estabelecimento, RBAC segregado, outbox/inbox, filas, idempotência, cofre certificados, observabilidade, migrations, testes.
**Entregáveis verificáveis:** migrações, contratos API, runbooks, testes CI.
**Pré-requisitos do cliente:** dados reais anonimizados para testes; aprovação de regras de negócio; credenciais/certificados bancários ou fiscais pertinentes; perfis e responsáveis habilitados. Se a API de um banco não expõe determinada operação no convênio do cliente, marcar como dependência externa e propor mudança formal em vez de simulá-la como sucesso.
**Aceite formal:** roteiro de testes com casos positivos/negativos do Caderno B; log do CI oito jobs, evidência de assinatura, certificado/sandbox quando pertinente, demonstração de operação e aceite por escrito do usuário responsável. Homologação externa é marco separado de implementação local.
**Limites explícitos:** requisitos inversos RI-B01 a RI-B17, sem customização de outro banco, nota modelo ou obrigação sem análise e aditivo.

### P-03 — Motor fiscal versionado
**Escopo funcional/tecnológico:** regras por operação/NCM/regime/UF/data, cenários XML, simulação, validação fiscal com contador e RTC.
**Entregáveis verificáveis:** motor de tributação, configurador, simulações, memórias e evidências de UAT.
**Pré-requisitos do cliente:** dados reais anonimizados para testes; aprovação de regras de negócio; credenciais/certificados bancários ou fiscais pertinentes; perfis e responsáveis habilitados. Se a API de um banco não expõe determinada operação no convênio do cliente, marcar como dependência externa e propor mudança formal em vez de simulá-la como sucesso.
**Aceite formal:** roteiro de testes com casos positivos/negativos do Caderno B; log do CI oito jobs, evidência de assinatura, certificado/sandbox quando pertinente, demonstração de operação e aceite por escrito do usuário responsável. Homologação externa é marco separado de implementação local.
**Limites explícitos:** requisitos inversos RI-B01 a RI-B17, sem customização de outro banco, nota modelo ou obrigação sem análise e aditivo.

### P-04 — NF-e 55 SEFAZ-SP
**Escopo funcional/tecnológico:** assinatura digital A1, XML 4.00 schemas vigentes, autorização/consulta/cancelamento/CC-e/inutilização/contingência legal, DANFE, HML.
**Entregáveis verificáveis:** emissor HML homologado, eventos, XML/DANFE, auditoria de autorização.
**Pré-requisitos do cliente:** dados reais anonimizados para testes; aprovação de regras de negócio; credenciais/certificados bancários ou fiscais pertinentes; perfis e responsáveis habilitados. Se a API de um banco não expõe determinada operação no convênio do cliente, marcar como dependência externa e propor mudança formal em vez de simulá-la como sucesso.
**Aceite formal:** roteiro de testes com casos positivos/negativos do Caderno B; log do CI oito jobs, evidência de assinatura, certificado/sandbox quando pertinente, demonstração de operação e aceite por escrito do usuário responsável. Homologação externa é marco separado de implementação local.
**Limites explícitos:** requisitos inversos RI-B01 a RI-B17, sem customização de outro banco, nota modelo ou obrigação sem análise e aditivo.

### P-05 — DF-e entrada e devoluções
**Escopo funcional/tecnológico:** consulta distribuição NSU, importação, vínculo compra e peso Richard, divergências, devolução, custo fiscal.
**Entregáveis verificáveis:** inbox de XMLs, conferência tripla, fluxo de devolução e integrações operacionais.
**Pré-requisitos do cliente:** dados reais anonimizados para testes; aprovação de regras de negócio; credenciais/certificados bancários ou fiscais pertinentes; perfis e responsáveis habilitados. Se a API de um banco não expõe determinada operação no convênio do cliente, marcar como dependência externa e propor mudança formal em vez de simulá-la como sucesso.
**Aceite formal:** roteiro de testes com casos positivos/negativos do Caderno B; log do CI oito jobs, evidência de assinatura, certificado/sandbox quando pertinente, demonstração de operação e aceite por escrito do usuário responsável. Homologação externa é marco separado de implementação local.
**Limites explícitos:** requisitos inversos RI-B01 a RI-B17, sem customização de outro banco, nota modelo ou obrigação sem análise e aditivo.

### P-06 — AP, AR e pagamentos
**Escopo funcional/tecnológico:** títulos, despesas recorrentes, parcelamento, comprovantes, cobrança, estorno, autorizações e trilhas.
**Entregáveis verificáveis:** contas a pagar/receber, agenda de pagamentos, instrumentos de cobrança.
**Pré-requisitos do cliente:** dados reais anonimizados para testes; aprovação de regras de negócio; credenciais/certificados bancários ou fiscais pertinentes; perfis e responsáveis habilitados. Se a API de um banco não expõe determinada operação no convênio do cliente, marcar como dependência externa e propor mudança formal em vez de simulá-la como sucesso.
**Aceite formal:** roteiro de testes com casos positivos/negativos do Caderno B; log do CI oito jobs, evidência de assinatura, certificado/sandbox quando pertinente, demonstração de operação e aceite por escrito do usuário responsável. Homologação externa é marco separado de implementação local.
**Limites explícitos:** requisitos inversos RI-B01 a RI-B17, sem customização de outro banco, nota modelo ou obrigação sem análise e aditivo.

### P-07 — APIs bancárias
**Escopo funcional/tecnológico:** três conectores individualizados Bradesco/Itaú/Santander, cobrança, consulta, extrato e ordens somente quando capability contratada; HML.
**Entregáveis verificáveis:** adapters, contratos por versão, test harness, evidências homologação por banco/conta/operação.
**Pré-requisitos do cliente:** dados reais anonimizados para testes; aprovação de regras de negócio; credenciais/certificados bancários ou fiscais pertinentes; perfis e responsáveis habilitados. Se a API de um banco não expõe determinada operação no convênio do cliente, marcar como dependência externa e propor mudança formal em vez de simulá-la como sucesso.
**Aceite formal:** roteiro de testes com casos positivos/negativos do Caderno B; log do CI oito jobs, evidência de assinatura, certificado/sandbox quando pertinente, demonstração de operação e aceite por escrito do usuário responsável. Homologação externa é marco separado de implementação local.
**Limites explícitos:** requisitos inversos RI-B01 a RI-B17, sem customização de outro banco, nota modelo ou obrigação sem análise e aditivo.

### P-08 — Conciliação e tesouraria
**Escopo funcional/tecnológico:** ingestão extrato, matching, baixa/estorno, saldos, fluxo previsto/realizado, aplicações/tarifas.
**Entregáveis verificáveis:** conciliação e fluxo caixa conectados a contas efetivamente habilitadas.
**Pré-requisitos do cliente:** dados reais anonimizados para testes; aprovação de regras de negócio; credenciais/certificados bancários ou fiscais pertinentes; perfis e responsáveis habilitados. Se a API de um banco não expõe determinada operação no convênio do cliente, marcar como dependência externa e propor mudança formal em vez de simulá-la como sucesso.
**Aceite formal:** roteiro de testes com casos positivos/negativos do Caderno B; log do CI oito jobs, evidência de assinatura, certificado/sandbox quando pertinente, demonstração de operação e aceite por escrito do usuário responsável. Homologação externa é marco separado de implementação local.
**Limites explícitos:** requisitos inversos RI-B01 a RI-B17, sem customização de outro banco, nota modelo ou obrigação sem análise e aditivo.

### P-09 — Contabilidade completa e SPED aplicável
**Escopo funcional/tecnológico:** plano de contas, partidas dobradas, mapeamentos, razão/diário, DRE/BP, inventário e CMV, apuração, obrigações ECD/ECF/EFD conforme regime.
**Entregáveis verificáveis:** razão, diário, balancete, DRE, balanço, fechamentos, arquivos validados e trilha de aceite contador.
**Pré-requisitos do cliente:** dados reais anonimizados para testes; aprovação de regras de negócio; credenciais/certificados bancários ou fiscais pertinentes; perfis e responsáveis habilitados. Se a API de um banco não expõe determinada operação no convênio do cliente, marcar como dependência externa e propor mudança formal em vez de simulá-la como sucesso.
**Aceite formal:** roteiro de testes com casos positivos/negativos do Caderno B; log do CI oito jobs, evidência de assinatura, certificado/sandbox quando pertinente, demonstração de operação e aceite por escrito do usuário responsável. Homologação externa é marco separado de implementação local.
**Limites explícitos:** requisitos inversos RI-B01 a RI-B17, sem customização de outro banco, nota modelo ou obrigação sem análise e aditivo.

### P-10 — Adaptação operação e homologação ponta a ponta
**Escopo funcional/tecnológico:** adequações a pré-faturamento, recebimento e liberação, perfis, cenários críticos, performance, Playwright e testes com usuários.
**Entregáveis verificáveis:** jornadas completas, manuais e termos de aceite por módulo.
**Pré-requisitos do cliente:** dados reais anonimizados para testes; aprovação de regras de negócio; credenciais/certificados bancários ou fiscais pertinentes; perfis e responsáveis habilitados. Se a API de um banco não expõe determinada operação no convênio do cliente, marcar como dependência externa e propor mudança formal em vez de simulá-la como sucesso.
**Aceite formal:** roteiro de testes com casos positivos/negativos do Caderno B; log do CI oito jobs, evidência de assinatura, certificado/sandbox quando pertinente, demonstração de operação e aceite por escrito do usuário responsável. Homologação externa é marco separado de implementação local.
**Limites explícitos:** requisitos inversos RI-B01 a RI-B17, sem customização de outro banco, nota modelo ou obrigação sem análise e aditivo.

## 6. Precificação rastreável por esforço
Para estimar de maneira auditável, obter produtividade da equipe e alocação por competência:
- `H_d`: horas de discovery/validação, `H_f`: horas frontend, `H_b`: backend/migração, `H_i`: integrações SEFAZ/bancos, `H_q`: testes e segurança, `H_u`: UAT/implantação, `H_g`: arquitetura/governança/documentação.
- `R_d,R_f,R_b,R_i,R_q,R_u,R_g`: taxas horárias por papel acordadas e registradas; `E`: reserva de contingência com critério de uso e aprovação, não percentual automático invisível; `T`: tributos da prestação, `C_terceiros`: custos repassáveis explicitamente discriminados.
- **Preço de serviço por pacote = Σ(H_papel × R_papel) + reserva aprovada + impostos explicitados na proposta financeira**. Cobrança de terceiros e suporte recorrente apresentados em quadros separados; evitar dupla contagem.
Faixas de complexidade orientativas de cotação, **não estimativas**: baixa=CRUD validado; média=processo com segregação e cálculo; alta=integração normativa crítica / banco / SEFAZ / SPED. A planilha final deve ter uma linha por `E##-T##` e fatores de integração, testes, homologação e documentação, com revisão independente.
### Planilha financeira a ser preenchida pelo proponente
| Épico | Horas análise | Horas dev | Horas integração | Horas QA/UAT | Riscos/terceiros | Subtotal (R$) |
|---|---:|---:|---:|---:|---|---:|
| E01 Tributação | — | — | — | — | — | a estimar |
| E02 NF-e SP | — | — | — | — | — | a estimar |
| E03 Entrada DF-e | — | — | — | — | — | a estimar |
| E04 AP | — | — | — | — | — | a estimar |
| E05 AR | — | — | — | — | — | a estimar |
| E06 Bancos 3 | — | — | — | — | — | a estimar |
| E07 Conciliação | — | — | — | — | — | a estimar |
| E08 Tesouraria | — | — | — | — | — | a estimar |
| E09 Contábil/SPED | — | — | — | — | — | a estimar |
| E10 Operação/UX | — | — | — | — | — | a estimar |
**Proteção de escopo comercial:** custo de completar integração municipal EISS não está incorporado à NF-e 55; adaptações indispensáveis à saída estadual são E10. Funcionalidades efetivamente prontas de E10 devem ter desconto por reuso evidenciado, não ser orçadas como implementação do zero.

## 7. Condições comerciais a deliberar
- **Preço fechado:** apenas após preencher esforço e políticas fiscais e obter documentação de capacidades dos três bancos; sem preço global indicado neste rascunho.
- **Faturamento sugerido:** por pacote aceito, separando adiantamento de mobilização e retenção contratual se negociados; percentuais não presumidos.
- **Prazo:** cronograma em ondas após validação de disponibilidade das equipes, documentos SEFAZ e bancos e do contador. Prazos suspensos por bloqueios externos formalizados.
- **Gestão das mudanças:** solicitação escrita → diff Anexo B + análise custo/prazo/segurança → aprovação aditivo → atualização docs/Linear → execução; nenhuma conversa informal vira promessa de entrega.
- **Garantia/correção:** bugs em funcionalidades aceitas distinguem-se de novos requisitos, evolução normativa, solicitações de terceiro e suporte; prazo de garantia e níveis de atendimento serão negociados separadamente.
- **Propriedade intelectual e código:** detalhar titularidade, licença, reutilização de bibliotecas e acesso GitHub no contrato definitivo.
- **LGPD e confidencialidade:** definir controlador/operador, transferências, retenção fiscal, criptografia, incidente e DPA onde aplicável.
- **Rescisão:** pagamento proporcional a marcos aprovados, entrega de fonte/docs e transição, sem apagar histórico; condições negociadas juridicamente.
- **Sustentação:** suporte evolutivo e correções normativas continuadas não incluídos automaticamente no valor de implementação; pacote mensal separado, se escolhido.

## 8. Obrigações do cliente
Disponibilizar responsável fiscal/contador e patrocinador para aprovar decisões; certificado A1 e credenciamento SEFAZ; documentação de acesso, contratos, escopos API, certificados e ambientes habilitados para Bradesco, Itaú e Santander; cadastros/planos, políticas de estoque e CMV; usuários para UAT; infraestrutura e política de backup; governança de dados pessoais e autorização antes de produção.

## 9. Responsabilidades do fornecedor
Entregar especificações, código com testes, migrações rastreáveis, gates de CI, documentação OpenAPI, observabilidade, trilha auditável, manuais e UAT assistida; reportar claramente bloqueios externos, não falsificar testes de homologação nem presumir aprovação normativa ou bancária.

## 10. Exclusões e requisitos inversos com força de delimitação
O fornecedor **não** está contratando: serviço profissional de contador/tributarista; retificação de anos fiscais anteriores; consultoria financeira operacional; operação permanente do ERP; credenciamento em bancos ou SEFAZ; pagamento de taxas, certificados, cloud, SMS, gateways; todas as APIs que os bancos não disponibilizam; CNAB como escopo base; outros documentos NFSe/NFCe/CTe/MDFe; aplicativo mobile nativo, hardware/driver físico, GPS ou ERP RH; disponibilidade de sistemas de terceiros; atualização normativa ilimitada sem manutenção. São vetados falsos comprovantes, baixas sem retorno, ocultação de receitas, operações fiscais sem documento e supressão do audit trail.
Cada exclusão pode originar **aditivo** mediante especificação, prazo, valor e critério de aceite; nunca incorporação tácita.

## 11. Matriz de aceite de negócio por responsável
| Módulo | Responsável cliente a homologar | Prova |
|---|---|---|
| Compra/DF-e e divergências | Fabrício, Richard, Karina, Carla conforme etapa | pedido × XML × pesagem × devolução |
| NF-e e regras fiscais | Contador e responsável fiscal | XML real em homologação, XSD, cStat, benefícios validados |
| Contas a pagar/receber e bancos | Karina e tesouraria | título, boleto registrado, baixa conciliada, extrato |
| Contábil/SPED | Contador habilitado | balancete, diário/razão, DRE/BP e PVA aplicável |
| Jornada de caminhão | Richard, Carla e logística | expedição encerrada, NF-e autorizada e saída segura |
| Segurança/auditoria | TI e Quality Owner | segregação de perfis, logs, testes acesso e dados |
## 12. Riscos e alocação
**Risco alto:** homologação de três APIs bancárias (capability distinta por instituição e por conta), aprovação de regimes tributários e legislação transitória IBS/CBS, autorização NF-e, obrigação contábil SPED e custo de migração de legado. Mitigação: gates externos por integração, mock/fake antes da homologação, calendário fiscal e revisão por contador, rollout controlado.
**Risco médio:** aderência à Onda 14 em código com Linear defasado, modelo de custo de estoques e telas financeiras sem protótipo validado. Mitigação: mapear implementado × backlog, aprovar mock UX e regra contábil antes de worker.
**Risco fora do controle do fornecedor:** lentidão e disponibilidade bancos/SEFAZ, revogação token, mudança interface bancária e legislação posterior; contrato de sustentação separado.

## 13. Marcos propostos de aceite
- M0: escopo e anexos assinados; parâmetros fiscais e bancários confirmados.
- M1: fundação/RBAC/idempotência/auditoria.
- M2: motor tributário e emissão NF-e SP **homologação**, não só fake.
- M3: DF-e, AP e AR com casos de devolução e parcelamento.
- M4: três bancos com capabilidades **documentadas por conta** e HML disponível; conciliação e fluxo de caixa.
- M5: plano de contas e livros, fechamentos, fiscal/SPED aplicável com validação contador.
- M6: E2E cross-modular e aceite operacional/documental, treinamento previsto e plano de rollout.
**Condições comerciais e data de cada marco pendentes de preenchimento.**
## 14. Tabela de mudanças
| Nº | Data | Documento/commit | Motivo | Alteração preço/prazo | Aprovação |
|---|---|---|---|---|---|
| CR-000 | 10/10/2026 | Cadernos A+B, versão 1.0 | proposta inicial | a negociar | pendente |
## 15. Aceitação da proposta
Esta é uma minuta para negociação. **Não configura orçamento irrevogável, compromisso de prazo nem contrato assinado.** Requer preencher contratante/proponente, valor, cronograma, condições de pagamento, prazo de garantia, impostos, tratamento de despesas, assinatura e data, além de anexar as versões Git/SHA dos Cadernos A e B aceitos.
