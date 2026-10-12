# Matriz UX integral — 61 interfaces AlphaCarnes ERP (campos, componentes, comportamento, origem e navegação)
**Vínculo técnico:** [Protótipo navegável](index.html) · [Modelo de componentes](componentes.js) · [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md) · [Governança AD-18](../../expansao-erp-2026/24-ADR-COFRE-POSTGRES-KMS-MENU-13-GRUPOS.md).

## Contrato global de UX: aplicação final, não MVP
**Proibido exibir qualquer GUID, UUID, ID de tabela, código interno de integração, identificador de issue/tarefa e número artificial de registro.** A aplicação renderiza **nome do cliente/fornecedor**, produto, instituição, conta mascarada, documento fiscal de negócio, descrição do evento e status humano. Chave NF-e, nosso número, CFOP, NCM, NSU e protocolos oficiais só aparecem quando indispensáveis à tarefa e com identificação clara; hashes e IDs externos ficam na seção de auditoria avançada para usuários autorizados, nunca como título principal.
**Origem obrigatória:** campos marcados CADASTRO são seletores vinculados às entidades já existentes, com busca pelo nome, escopo de empresa/estabelecimento, opções inativas omitidas, label amigável, seleção persistida por FK **invisível**, acesso contextual ao cadastro e criação vinculada só se o perfil permitir. Campos ENUM são combos com opções pré-definidas; é inválido digitar valor livre. Códigos fiscais vêm de tabelas oficiais versionadas. Valores derivados não são editáveis.
**Cascata de combos:** empresa → estabelecimento; banco → conta bancária → convênio → carteira; empresa → certificado; provedor → integração; integração → job; NCM → CEST; serviço/banco → layout homologado. Ao mudar o pai, limpar o filho incompatível, mostrar razão e exigir seleção nova. APIs do backend devem validar o vínculo e evitar referência cruzada entre empresas.
**Datagrid:** colunas específicas do negócio listadas por tela, ordenação e filtros persistentes, pesquisa pela descrição, paginação preferencialmente server-side, estado vazio com instrução, loading/skeleton, erro com retry, seleção de linha que abre detalhe, atualização sem perder foco. **Nunca** incluir colunas `id`, `uuid`, foreignKey ou código de implementação; multi-seleção só onde fluxo suportar lote auditado.
**Controles:** DatePicker com máscara dia/mês/ano e calendário acessível, seletor de competência AAAA-MM, DateTimePicker para eventos, moeda decimal exata com máscara pt-BR, peso com unidade, percentual em 0–100, textarea com limite/justificativa, upload com validação de conteúdo, secrets sempre write-only, estados de edição/leitura.
**Segurança/estados:** rascunho, validação, revisão, aprovação, bloqueio, sucesso com evidência; RBAC por ação no backend, segregação de função, idempotência, confirmação para efeito externo, tratamento de concorrência 409, erro externo, retry e reversão em vez de apagar. O protótipo simula visualmente e **não** valida certificado ou efetiva qualquer transação.
**Critérios de aceite de todas as tasks:** cada componente da tabela abaixo implementado, dados vinculados a cadastros reais, datas e máscaras corretas, navegação teclado/leitor de tela, validação no backend, testes negativos e de lote, Playwright, screenshots e revisão UX do protótipo. Implementação incompleta de campos, ações e estados não é aceitável.

## Matriz por interface (61 contratos individualizados)

## E01 — Motor tributário · 5 interfaces

### E01-T01 — Empresas, estabelecimentos e regime
**Protótipo de referência:** [Abrir Empresas, estabelecimentos e regime](index.html#E01-T01) · **Localização:** FISCAL → Motor tributário · **Acesso por função:** gestor fiscal, contador e administrador.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Estabelecimento` · `CNPJ` · `Regime tributário` · `Estado` · `Situação` · `Empresa`. Ordenação por Estabelecimento, CNPJ, Regime tributário, Estado, Empresa, default Estabelecimento. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Empresa (Combo de cadastro com busca); Estabelecimento (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** não admitir empresa sem identificação nem regime sobreposto; regras por estabelecimento e competência.
**Exceções e resposta UX:** CNPJ rejeitado; troca de regime; competência bloqueada. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** cadastrar empresa e filial, ativar regime por vigência, aprovar alteração.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Empresa | Combo de cadastro com busca | CADASTRO: empresas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Razão social | Texto validado | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |
| CNPJ | Documento com máscara e DV | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |
| Estabelecimento | Combo de cadastro com busca | CADASTRO: estabelecimentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa |
| Inscrição estadual | Texto validado | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |
| Inscrição municipal | Texto validado | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |
| Estado | Combo fechado (enum) | ENUM: uf | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Município | Combo de cadastro com busca | CADASTRO: municipios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Estado |
| Atividade econômica (CNAE) | Combo de cadastro com busca | CADASTRO: cnae | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Regime tributário | Combo fechado (enum) | ENUM: crt | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Certificado vinculado | Combo de cadastro com busca | CADASTRO: certificados | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa + Ambiente |
| Início de vigência | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Fim de vigência | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E01-T01) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E01-T02 — Operações fiscais e enquadramentos
**Protótipo de referência:** [Abrir Operações fiscais e enquadramentos](index.html#E01-T02) · **Localização:** FISCAL → Motor tributário · **Acesso por função:** fiscal.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Operação` · `Operação fiscal (CFOP)` · `Início de vigência` · `Estabelecimento` · `Tipo da nota` · `Finalidade`. Ordenação por Operação, Operação fiscal (CFOP), Início de vigência, Estabelecimento, Tipo da nota, Finalidade, default Operação. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Estabelecimento (Combo de cadastro com busca); Operação fiscal (CFOP) (Combo de cadastro com busca); Produto (Combo de cadastro com busca); Cliente (Combo de cadastro com busca). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** perfil nunca usa CFOP global como único determinante; critério temporal obrigatório.
**Exceções e resposta UX:** empate de enquadramento e operação sem regra aprovada. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** cadastrar operação, duplicar perfil, relacionar produto e cliente, controlar prioridade.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Estabelecimento | Combo de cadastro com busca | CADASTRO: estabelecimentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa |
| Operação | Combo de cadastro com busca | CADASTRO: operacoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Tipo da nota | Combo fechado (enum) | ENUM: tpNF | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Finalidade | Combo fechado (enum) | ENUM: finNFe | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Operação fiscal (CFOP) | Combo de cadastro com busca | CADASTRO: cfops | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Abrangência da operação | Combo fechado (enum) | ENUM: origemDestino | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Origem do produto | Combo fechado (enum) | ENUM: tipoProduto | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Produto | Combo de cadastro com busca | CADASTRO: produtos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Classificação fiscal (NCM) | Combo de cadastro com busca | CADASTRO: ncm | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Substituição tributária (CEST) | Texto validado | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |
| Cliente | Combo de cadastro com busca | CADASTRO: clientes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Início de vigência | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Fim de vigência | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E01-T02) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E01-T03 — Editor de regras tributárias
**Protótipo de referência:** [Abrir Editor de regras tributárias](index.html#E01-T03) · **Localização:** FISCAL → Motor tributário · **Acesso por função:** fiscal/contador.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Enquadramento fiscal` · `Operação fiscal (CFOP)` · `Benefício fiscal` · `Classificação IBS/CBS` · `Operação` · `Tratamento ICMS`. Ordenação por Enquadramento fiscal, Operação fiscal (CFOP), Benefício fiscal, Classificação IBS/CBS, Operação, Tratamento ICMS, default Enquadramento fiscal. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Operação fiscal (CFOP) (Combo de cadastro com busca). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** motor de regras não permite edição retroativa em nota emitida; aprovação segregada.
**Exceções e resposta UX:** benefício não elegível; vigência ambígua; versão NT inválida. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** criar rascunho, adicionar versão, comparar, submeter, aprovar, aposentar.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Enquadramento fiscal | Combo de cadastro com busca | CADASTRO: regrasFiscais | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Operação | Combo de cadastro com busca | CADASTRO: operacoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Operação fiscal (CFOP) | Combo de cadastro com busca | CADASTRO: cfops | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Tratamento ICMS | Combo fechado (enum) | ENUM: icmsCst | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Redução de base do ICMS (%) | Percentual com faixa | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Alíquota (%) | Percentual com faixa | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Benefício fiscal | Combo de cadastro com busca | CADASTRO: cBenef | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Tratamento IPI | Combo fechado (enum) | ENUM: ipiCst | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Tratamento PIS/COFINS | Combo fechado (enum) | ENUM: pisCst | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Tratamento IBS/CBS | Combo fechado (enum) | ENUM: ibsCst | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Classificação IBS/CBS | Combo de cadastro com busca | CADASTRO: cClassTrib | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Início de vigência | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Fim de vigência | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E01-T03) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E01-T04 — Simulador fiscal e memória de cálculo
**Protótipo de referência:** [Abrir Simulador fiscal e memória de cálculo](index.html#E01-T04) · **Localização:** FISCAL → Motor tributário · **Acesso por função:** fiscal/contador.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Cliente` · `Produto` · `Valor` · `Valor líquido (calculado)` · `Estabelecimento` · `Operação`. Ordenação por Cliente, Produto, Valor, Valor líquido (calculado), Estabelecimento, Operação, default Cliente. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Estabelecimento (Combo de cadastro com busca); Cliente (Combo de cadastro com busca); Produto (Combo de cadastro com busca); Competência (Seletor de competência). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** nenhum valor gerado vira lançamento fiscal sem documento; Decimal exato.
**Exceções e resposta UX:** base tributável difere de valor bruto; falta referência legal. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** simular, explicar tributos, exportar memória, comparar versões.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Estabelecimento | Combo de cadastro com busca | CADASTRO: estabelecimentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa |
| Operação | Combo de cadastro com busca | CADASTRO: operacoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Cliente | Combo de cadastro com busca | CADASTRO: clientes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Produto | Combo de cadastro com busca | CADASTRO: produtos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Classificação fiscal (NCM) | Combo de cadastro com busca | CADASTRO: ncm | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Quantidade | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Peso informado na nota (kg) | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Desconto | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Competência | Seletor de competência | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Enquadramento fiscal | Combo de cadastro com busca | CADASTRO: regrasFiscais | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Base tributável (calculada) | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Valor líquido (calculado) | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E01-T04) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E01-T05 — Painel de alterações e homologação de regras
**Protótipo de referência:** [Abrir Painel de alterações e homologação de regras](index.html#E01-T05) · **Localização:** FISCAL → Motor tributário · **Acesso por função:** contador e auditor.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Enquadramento fiscal` · `Início de vigência` · `Situação` · `Usuário` · `Responsável pela aprovação` · `Descrição`. Ordenação por Enquadramento fiscal, Início de vigência, Usuário, Responsável pela aprovação, Descrição, default Enquadramento fiscal. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** aprovador diferente do autor; cenários de regressão obrigatórios.
**Exceções e resposta UX:** atualização normativa em meio à operação. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** revisar diff, aprovar/rejeitar, publicar e auditar.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Enquadramento fiscal | Combo de cadastro com busca | CADASTRO: regrasFiscais | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Usuário | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Responsável pela aprovação | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Descrição | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |
| Início de vigência | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Fim de vigência | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E01-T05) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

## E02 — NF-e SEFAZ/SP · 5 interfaces

### E02-T01 — Pré-emissão NF-e
**Protótipo de referência:** [Abrir Pré-emissão NF-e](index.html#E02-T01) · **Localização:** FISCAL → NF-e SEFAZ/SP · **Acesso por função:** faturamento/fiscal.
**Ação primária e governança:** Validar pré-condições de emissão. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Cliente` · `Valor` · `Situação` · `Carga` · `Pedido de venda` · `Estabelecimento`. Ordenação por Cliente, Valor, Carga, Pedido de venda, Estabelecimento, default Cliente. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Cliente (Combo de cadastro com busca); Estabelecimento (Combo de cadastro com busca); Produto (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** NF-e só dos itens efetivamente carregados e após fechamento; valores comerciais corretos.
**Exceções e resposta UX:** divergência aberta, item sem NCM, série indisponível. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** consolidar, pré-visualizar, validar cadastro, simular tributação, solicitar emissão.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Carga | Combo de cadastro com busca | CADASTRO: cargas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Pedido de venda | Combo de cadastro com busca | CADASTRO: pedidosVenda | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Cliente |
| Cliente | Combo de cadastro com busca | CADASTRO: clientes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Estabelecimento | Combo de cadastro com busca | CADASTRO: estabelecimentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa |
| Produto | Combo de cadastro com busca | CADASTRO: produtos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Quantidade | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Peso conferido (kg) | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Desconto | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Enquadramento fiscal | Combo de cadastro com busca | CADASTRO: regrasFiscais | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Certificado vinculado | Combo de cadastro com busca | CADASTRO: certificados | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa + Ambiente |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E02-T01) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E02-T02 — Central de emissão/autorização
**Protótipo de referência:** [Abrir Central de emissão/autorização](index.html#E02-T02) · **Localização:** FISCAL → NF-e SEFAZ/SP · **Acesso por função:** faturamento com permissão NF-e.
**Ação primária e governança:** Validar pré-condições de emissão. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Série da NF-e` · `Número da NF-e` · `Emissão` · `Protocolo SEFAZ` · `Situação` · `Estabelecimento`. Ordenação por Série da NF-e, Número da NF-e, Emissão, Protocolo SEFAZ, Estabelecimento, default Emissão. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Estabelecimento (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** alocação serializável; não emitir duas notas para mesmo fato/identificador; certificado A1.
**Exceções e resposta UX:** SEFAZ indisponível, falha TLS, timeout, rejeição  duplicidade. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** assinar XML, enviar, consultar SEFAZ, reconciliar timeout, reprocessar rejeição.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Estabelecimento | Combo de cadastro com busca | CADASTRO: estabelecimentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa |
| Série da NF-e | Número inteiro | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |
| Número da NF-e | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Chave de acesso (documento) | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Ambiente | Combo fechado (enum) | ENUM: ambiente | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Certificado vinculado | Combo de cadastro com busca | CADASTRO: certificados | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa + Ambiente |
| Protocolo SEFAZ | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Recibo oficial | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Verificação de integridade XML | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Emissão | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E02-T02) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E02-T03 — Documentos autorizados e DANFE
**Protótipo de referência:** [Abrir Documentos autorizados e DANFE](index.html#E02-T03) · **Localização:** FISCAL → NF-e SEFAZ/SP · **Acesso por função:** faturamento, cliente interno.
**Ação primária e governança:** Validar pré-condições de emissão. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Nota fiscal` · `Cliente` · `Valor` · `Situação` · `Chave de acesso (documento)` · `Protocolo SEFAZ`. Ordenação por Nota fiscal, Cliente, Valor, Chave de acesso (documento), Protocolo SEFAZ, default Nota fiscal. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Cliente (Combo de cadastro com busca); Produto (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** impressão DANFE nunca substitui autorização; XML íntegro arquivado.
**Exceções e resposta UX:** arquivo indisponível, reenvio e acesso de terceiro. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** listar, filtrar, baixar XML, gerar DANFE, reenviar ao destinatário, inspecionar auditoria.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Nota fiscal | Combo de cadastro com busca | CADASTRO: notas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Estabelecimento |
| Chave de acesso (documento) | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Protocolo SEFAZ | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Recibo oficial | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Cliente | Combo de cadastro com busca | CADASTRO: clientes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Produto | Combo de cadastro com busca | CADASTRO: produtos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Quantidade | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Verificação de integridade XML | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E02-T03) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E02-T04 — Eventos e pós-autorização
**Protótipo de referência:** [Abrir Eventos e pós-autorização](index.html#E02-T04) · **Localização:** FISCAL → NF-e SEFAZ/SP · **Acesso por função:** fiscal.
**Ação primária e governança:** Validar pré-condições de emissão. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Situação` · `Nota fiscal de origem` · `Evento fiscal` · `Documento de origem` · `Certificado vinculado` · `Data e hora do evento`. Ordenação por Nota fiscal de origem, Evento fiscal, Documento de origem, Certificado vinculado, Data e hora do evento, default Data e hora do evento. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** CC-e não corrige valor/tributação; cancelamento exige regra legal temporal, aprovação e trilha.
**Exceções e resposta UX:** cancelamento fora prazo, evento rejeitado, contingência com reconciliação. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** solicitar, validar elegibilidade, transmitir evento, consultar status, registrar motivo.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Nota fiscal de origem | Combo de cadastro com busca | CADASTRO: notas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Evento fiscal | Combo fechado (enum) | ENUM: eventoNFe | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Documento de origem | Combo de cadastro com busca | CADASTRO: documentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Certificado vinculado | Combo de cadastro com busca | CADASTRO: certificados | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa + Ambiente |
| Data e hora do evento | DateTimePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Protocolo SEFAZ | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E02-T04) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E02-T05 — Console homologação SEFAZ
**Protótipo de referência:** [Abrir Console homologação SEFAZ](index.html#E02-T05) · **Localização:** FISCAL → NF-e SEFAZ/SP · **Acesso por função:** administrador fiscal.
**Ação primária e governança:** Validar pré-condições de emissão. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Integração vinculada` · `Certificado vinculado` · `Validade do certificado` · `Situação` · `Estabelecimento` · `Ambiente`. Ordenação por Integração vinculada, Certificado vinculado, Validade do certificado, Estabelecimento, Ambiente, default Integração vinculada. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Estabelecimento (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** produção desabilitada até credenciamento, checklist e autorização humana.
**Exceções e resposta UX:** certificado vencido, indisponibilidade e schema novo. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** testar certificado sem expor segredo, validar schemas, executar cenários e liberar produção.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Estabelecimento | Combo de cadastro com busca | CADASTRO: estabelecimentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa |
| Ambiente | Combo fechado (enum) | ENUM: ambiente | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Integração vinculada | Combo de cadastro com busca | CADASTRO: integracoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Instituição ou órgão + Ambiente |
| Serviço oficial | Combo de endpoint aprovado | Catálogo E12 de endpoints | Endpoint deve ser selecionado do cadastro de endpoints oficiais aprovados, nunca URL arbitrária. |
| Certificado vinculado | Combo de cadastro com busca | CADASTRO: certificados | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa + Ambiente |
| Validade do certificado | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Série da NF-e | Número inteiro | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |
| Tabela ou versão oficial | Combo de cadastro com busca | CADASTRO: datasets | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E02-T05) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

## E03 — Documentos de entrada · 4 interfaces

### E03-T01 — Inbox de XML/DF-e de fornecedor
**Protótipo de referência:** [Abrir Inbox de XML/DF-e de fornecedor](index.html#E03-T01) · **Localização:** FISCAL → Documentos de entrada · **Acesso por função:** recebimento/fiscal.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Nota fiscal` · `Fornecedor` · `Produto` · `Peso informado na nota (kg)` · `Situação` · `Estabelecimento`. Ordenação por Nota fiscal, Fornecedor, Produto, Peso informado na nota (kg), Estabelecimento, default Nota fiscal. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Estabelecimento (Combo de cadastro com busca); Fornecedor (Combo de cadastro com busca); Operação fiscal (CFOP) (Combo de cadastro com busca); Produto (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** importação não confirma recebimento físico; sem AP duplicado.
**Exceções e resposta UX:** NSU repetido, XML malformado, destinatário divergente. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** sincronizar distribuição autorizada, importar XML, validar XML/assinatura, deduplicar, manifestar quando legal.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Estabelecimento | Combo de cadastro com busca | CADASTRO: estabelecimentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa |
| Fornecedor | Combo de cadastro com busca | CADASTRO: fornecedores | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Nota fiscal | Combo de cadastro com busca | CADASTRO: notas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Estabelecimento |
| Controle da distribuição (NSU) | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Chave de acesso (documento) | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Série da NF-e | Número inteiro | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |
| Operação fiscal (CFOP) | Combo de cadastro com busca | CADASTRO: cfops | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Produto | Combo de cadastro com busca | CADASTRO: produtos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Quantidade | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Peso informado na nota (kg) | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E03-T01) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E03-T02 — Conferência tripla de entrada
**Protótipo de referência:** [Abrir Conferência tripla de entrada](index.html#E03-T02) · **Localização:** FISCAL → Documentos de entrada · **Acesso por função:** Fabrício, Richard, Karina.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Pedido de compra` · `Nota fiscal` · `Peso informado na nota (kg)` · `Peso conferido (kg)` · `Diferença de peso (calculada)` · `Fornecedor`. Ordenação por Pedido de compra, Nota fiscal, Peso informado na nota (kg), Peso conferido (kg), Diferença de peso (calculada), Fornecedor, default Pedido de compra. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Fornecedor (Combo de cadastro com busca); Produto (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** divergência de peso não cria devolução autorizada nem desconto tácito.
**Exceções e resposta UX:** faltas, excesso, preço divergente, mercadoria não prevista. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** vincular NF a pedido/lote, conciliar, classificar divergências, aprovar ressalva.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Pedido de compra | Combo de cadastro com busca | CADASTRO: pedidosCompra | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Fornecedor |
| Fornecedor | Combo de cadastro com busca | CADASTRO: fornecedores | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Nota fiscal | Combo de cadastro com busca | CADASTRO: notas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Estabelecimento |
| Produto | Combo de cadastro com busca | CADASTRO: produtos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Quantidade | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Peso informado na nota (kg) | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Peso conferido (kg) | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Diferença de peso (calculada) | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Ocorrência relacionada | Combo de cadastro com busca | CADASTRO: ocorrencias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E03-T02) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E03-T03 — Solicitações de devolução
**Protótipo de referência:** [Abrir Solicitações de devolução](index.html#E03-T03) · **Localização:** FISCAL → Documentos de entrada · **Acesso por função:** Carla/fiscal.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Fornecedor` · `Produto` · `Peso informado na nota (kg)` · `Situação` · `Nota fiscal de origem` · `Quantidade`. Ordenação por Fornecedor, Produto, Peso informado na nota (kg), Nota fiscal de origem, Quantidade, default Fornecedor. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Fornecedor (Combo de cadastro com busca); Produto (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** finNFe 4 + refNFe; sem aprovação nenhuma emissão automática.
**Exceções e resposta UX:** devolução parcial, crédito não confirmado. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** criar pré-solicitação, negociar, aprovar, emitir NF referenciada, acompanhar aceite.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Nota fiscal de origem | Combo de cadastro com busca | CADASTRO: notas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Fornecedor | Combo de cadastro com busca | CADASTRO: fornecedores | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Produto | Combo de cadastro com busca | CADASTRO: produtos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Quantidade | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Peso informado na nota (kg) | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Motivo da devolução | Combo fechado (enum) | ENUM: motivoDevolucao | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Ocorrência relacionada | Combo de cadastro com busca | CADASTRO: ocorrencias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E03-T03) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E03-T04 — Custo de aquisição/CMV e valorização
**Protótipo de referência:** [Abrir Custo de aquisição/CMV e valorização](index.html#E03-T04) · **Localização:** FISCAL → Documentos de entrada · **Acesso por função:** controladoria/contador.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Fornecedor` · `Produto` · `Lote de produção` · `Pedido de compra` · `Quantidade` · `Valor`. Ordenação por Fornecedor, Produto, Lote de produção, Pedido de compra, Quantidade, Valor, default Fornecedor. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Produto (Combo de cadastro com busca); Fornecedor (Combo de cadastro com busca); Competência (Seletor de competência). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** método de custo aprovado por contador; sem alteração de custo histórico silenciosa.
**Exceções e resposta UX:** reclassificação tardia, período encerrado, perda de desossa. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** consultar ficha custo, aprovar rateios, reconciliar estoque físico versus contábil.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Lote de produção | Combo de cadastro com busca | CADASTRO: lotes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Produto | Combo de cadastro com busca | CADASTRO: produtos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Pedido de compra | Combo de cadastro com busca | CADASTRO: pedidosCompra | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Fornecedor |
| Fornecedor | Combo de cadastro com busca | CADASTRO: fornecedores | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Quantidade | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Centro de custo | Combo de cadastro com busca | CADASTRO: centrosCusto | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Método de custo | Combo fechado (enum) | ENUM: criterioCusto | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Saldo | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor.; somente leitura |
| Competência | Seletor de competência | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E03-T04) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

## E04 — Contas a pagar · 5 interfaces

### E04-T01 — Painel contas a pagar
**Protótipo de referência:** [Abrir Painel contas a pagar](index.html#E04-T01) · **Localização:** FINANCEIRO → Contas a pagar · **Acesso por função:** Karina, Micaela.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Conta a pagar` · `Fornecedor` · `Valor da obrigação` · `Vencimento` · `Situação` · `Documento de origem`. Ordenação por Conta a pagar, Fornecedor, Valor da obrigação, Vencimento, Documento de origem, default Vencimento. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Fornecedor (Combo de cadastro com busca); Vencimento (DatePicker); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** NF conferida cria obrigação somente pela política aprovada; sem dupla obrigação por XML.
**Exceções e resposta UX:** cancelamento documento, cobrança duplicada. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** filtrar, abrir título, aprovar lançamento e consultar aging.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Fornecedor | Combo de cadastro com busca | CADASTRO: fornecedores | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta a pagar | Combo de cadastro com busca | CADASTRO: titulosPagar | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Documento de origem | Combo de cadastro com busca | CADASTRO: documentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Valor da obrigação | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Saldo | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor.; somente leitura |
| Vencimento | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Categoria da despesa | Combo fechado (enum) | ENUM: classificacaoDespesa | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Centro de custo | Combo de cadastro com busca | CADASTRO: centrosCusto | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E04-T01) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E04-T02 — Cadastro de título/parcelamento
**Protótipo de referência:** [Abrir Cadastro de título/parcelamento](index.html#E04-T02) · **Localização:** FINANCEIRO → Contas a pagar · **Acesso por função:** financeiro.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Fornecedor` · `Valor da obrigação` · `Vencimento` · `Documento de origem` · `Quantidade` · `Emissão`. Ordenação por Fornecedor, Valor da obrigação, Vencimento, Documento de origem, Quantidade, Emissão, default Vencimento. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Fornecedor (Combo de cadastro com busca); Vencimento (DatePicker). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** soma parcelas igual valor líquido do título; alterações com motivo.
**Exceções e resposta UX:** valor negativo, competência fechada, boleto divergente. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** criar manualmente, parcelar, anexar evidência, reagendar e aprovar.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Fornecedor | Combo de cadastro com busca | CADASTRO: fornecedores | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Documento de origem | Combo de cadastro com busca | CADASTRO: documentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Valor da obrigação | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Quantidade | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Emissão | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Vencimento | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Meio de pagamento | Combo fechado (enum) | ENUM: formaPagamento | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Juros | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Desconto | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Centro de custo | Combo de cadastro com busca | CADASTRO: centrosCusto | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E04-T02) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E04-T03 — Despesas recorrentes e variáveis
**Protótipo de referência:** [Abrir Despesas recorrentes e variáveis](index.html#E04-T03) · **Localização:** FINANCEIRO → Contas a pagar · **Acesso por função:** financeiro.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Fornecedor` · `Vencimento` · `Situação` · `Categoria da despesa` · `Centro de custo` · `Periodicidade`. Ordenação por Fornecedor, Vencimento, Categoria da despesa, Centro de custo, Periodicidade, default Vencimento. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Fornecedor (Combo de cadastro com busca); Competência (Seletor de competência); Vencimento (DatePicker); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** não gerar passivo contábil duplicado por recorrência e nota.
**Exceções e resposta UX:** contrato vencido, calendário e duplicidade. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** programar recorrência, gerar provisão, aprovar documento e pagamento.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Fornecedor | Combo de cadastro com busca | CADASTRO: fornecedores | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Categoria da despesa | Combo fechado (enum) | ENUM: classificacaoDespesa | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Centro de custo | Combo de cadastro com busca | CADASTRO: centrosCusto | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Periodicidade | Combo fechado (enum) | ENUM: frequencia | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Competência | Seletor de competência | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Vencimento | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Meio de pagamento | Combo fechado (enum) | ENUM: formaPagamento | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E04-T03) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E04-T04 — Agenda de pagamentos
**Protótipo de referência:** [Abrir Agenda de pagamentos](index.html#E04-T04) · **Localização:** FINANCEIRO → Contas a pagar · **Acesso por função:** tesouraria.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Conta a pagar` · `Conta bancária` · `Valor` · `Responsável pela aprovação` · `Situação` · `Banco`. Ordenação por Conta a pagar, Conta bancária, Valor, Responsável pela aprovação, Banco, default Conta a pagar. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Conta bancária (Combo de cadastro com busca); Banco (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** nunca considerar pago antes da confirmação bancária; autorização em duas etapas.
**Exceções e resposta UX:** saldo insuficiente, API indisponível, pagamento rejeitado. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** agendar, submeter dupla aprovação, transmitir API quando habilitada, consultar retorno.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| Banco | Combo de cadastro com busca | CADASTRO: bancos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta a pagar | Combo de cadastro com busca | CADASTRO: titulosPagar | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Data de confirmação bancária | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Responsável pela aprovação | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Meio de pagamento | Combo fechado (enum) | ENUM: formaPagamento | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Documento relacionado | Combo de cadastro com busca | CADASTRO: documentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E04-T04) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E04-T05 — Devoluções, abatimentos e créditos
**Protótipo de referência:** [Abrir Devoluções, abatimentos e créditos](index.html#E04-T05) · **Localização:** FINANCEIRO → Contas a pagar · **Acesso por função:** Karina.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Fornecedor` · `Situação` · `Nota fiscal de origem` · `Ocorrência relacionada` · `Motivo da devolução` · `Documento relacionado`. Ordenação por Fornecedor, Nota fiscal de origem, Ocorrência relacionada, Motivo da devolução, Documento relacionado, default Fornecedor. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Fornecedor (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** não baixar valor de fornecedor apenas por peso divergente.
**Exceções e resposta UX:** DDA não reflete abatimento, autorização não recebida. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** relacionar crédito, abater parcial, estornar, reconciliar DDA.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Nota fiscal de origem | Combo de cadastro com busca | CADASTRO: notas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Fornecedor | Combo de cadastro com busca | CADASTRO: fornecedores | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Ocorrência relacionada | Combo de cadastro com busca | CADASTRO: ocorrencias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Motivo da devolução | Combo fechado (enum) | ENUM: motivoDevolucao | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Documento relacionado | Combo de cadastro com busca | CADASTRO: documentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Desconto | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Responsável pela aprovação | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E04-T05) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

## E05 — Contas a receber · 4 interfaces

### E05-T01 — Painel contas a receber
**Protótipo de referência:** [Abrir Painel contas a receber](index.html#E05-T01) · **Localização:** FINANCEIRO → Contas a receber · **Acesso por função:** financeiro/comercial consulta.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Conta a receber` · `Cliente` · `Valor da obrigação` · `Vencimento` · `Situação` · `Nota fiscal`. Ordenação por Conta a receber, Cliente, Valor da obrigação, Vencimento, Nota fiscal, default Vencimento. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Cliente (Combo de cadastro com busca); Vencimento (DatePicker); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** reconhecer AR por documento/evidência de faturamento sem duplicidade.
**Exceções e resposta UX:** NF-e cancelada, crédito devolvido, cliente inadimplente. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** listar, buscar, notificar, abrir aging, classificar atraso.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Cliente | Combo de cadastro com busca | CADASTRO: clientes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Nota fiscal | Combo de cadastro com busca | CADASTRO: notas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Estabelecimento |
| Conta a receber | Combo de cadastro com busca | CADASTRO: titulosReceber | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Valor da obrigação | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Saldo | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor.; somente leitura |
| Vencimento | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Meio de pagamento | Combo fechado (enum) | ENUM: formaPagamento | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E05-T01) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E05-T02 — Faturamento financeiro e parcelamento
**Protótipo de referência:** [Abrir Faturamento financeiro e parcelamento](index.html#E05-T02) · **Localização:** FINANCEIRO → Contas a receber · **Acesso por função:** faturamento/financeiro.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Cliente` · `Valor da obrigação` · `Vencimento` · `Situação` · `Nota fiscal` · `Pedido de venda`. Ordenação por Cliente, Valor da obrigação, Vencimento, Nota fiscal, Pedido de venda, default Vencimento. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Cliente (Combo de cadastro com busca); Vencimento (DatePicker); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** total de parcelas reconcilia ao valor devido; preço após expedição imutável sem evento.
**Exceções e resposta UX:** parcelas inconsistentes, prazos divergentes. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** gerar títulos, parcelar, revisar, emitir cobrança por banco.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Cliente | Combo de cadastro com busca | CADASTRO: clientes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Nota fiscal | Combo de cadastro com busca | CADASTRO: notas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Estabelecimento |
| Pedido de venda | Combo de cadastro com busca | CADASTRO: pedidosVenda | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Cliente |
| Valor da obrigação | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Quantidade | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Vencimento | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Taxa de juros (%) | Percentual com faixa | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Desconto | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Meio de pagamento | Combo fechado (enum) | ENUM: formaPagamento | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Responsável pela aprovação | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E05-T02) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E05-T03 — Central de cobrança
**Protótipo de referência:** [Abrir Central de cobrança](index.html#E05-T03) · **Localização:** FINANCEIRO → Contas a receber · **Acesso por função:** financeiro.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Conta a receber` · `Banco` · `Carteira de cobrança` · `Referência de cobrança` · `Situação` · `Conta bancária`. Ordenação por Conta a receber, Banco, Carteira de cobrança, Referência de cobrança, Conta bancária, default Conta a receber. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Banco (Combo de cadastro com busca); Conta bancária (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** somente boleto registrado realmente é cobrança ativa; evitar cobrança duplicada.
**Exceções e resposta UX:** registro pendente, convênio não habilitado, webhook atrasado. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** registrar boleto, consultar, cancelar/alterar conforme capability, reenviar link.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Banco | Combo de cadastro com busca | CADASTRO: bancos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| Convênio bancário | Combo de cadastro com busca | CADASTRO: convenios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Conta bancária |
| Carteira de cobrança | Combo de cadastro com busca | CADASTRO: carteiras | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Convênio bancário |
| Conta a receber | Combo de cadastro com busca | CADASTRO: titulosReceber | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Nota fiscal | Combo de cadastro com busca | CADASTRO: notas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Estabelecimento |
| Referência de cobrança | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Número do documento | Texto validado | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |
| Referência fornecida pelo banco | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E05-T03) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E05-T04 — Inadimplência e renegociação
**Protótipo de referência:** [Abrir Inadimplência e renegociação](index.html#E05-T04) · **Localização:** FINANCEIRO → Contas a receber · **Acesso por função:** cobrança/gestão.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Conta a receber` · `Cliente` · `Vencimento` · `Situação` · `Valor` · `Saldo`. Ordenação por Conta a receber, Cliente, Vencimento, Valor, Saldo, default Vencimento. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Cliente (Combo de cadastro com busca); Vencimento (DatePicker); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** não apagar original; crédito e saldo continuam rastreáveis.
**Exceções e resposta UX:** baixa parcial, contestação, desconto fora alçada. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** negociar com autorização, formalizar acordo, reprogramar vencimentos.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Cliente | Combo de cadastro com busca | CADASTRO: clientes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta a receber | Combo de cadastro com busca | CADASTRO: titulosReceber | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Saldo | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor.; somente leitura |
| Vencimento | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Taxa de juros (%) | Percentual com faixa | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Desconto | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Responsável pela aprovação | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E05-T04) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

## E06 — APIs bancárias · 5 interfaces

### E06-T01 — Contas bancárias, convênios e capacidades
**Protótipo de referência:** [Abrir Contas bancárias, convênios e capacidades](index.html#E06-T01) · **Localização:** BANCOS & TESOURARIA → APIs bancárias · **Acesso por função:** admin bancário.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Banco` · `Conta bancária` · `Convênio bancário` · `Serviço contratado` · `Situação` · `Empresa`. Ordenação por Banco, Conta bancária, Convênio bancário, Serviço contratado, Empresa, default Banco. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Empresa (Combo de cadastro com busca); Banco (Combo de cadastro com busca); Conta bancária (Combo de cadastro com busca); Serviço contratado (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** capability não é presumida; credencial armazenada no cofre, jamais no UI.
**Exceções e resposta UX:** convênio ausente, cert vencido, API só disponível em ambiente diferente. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** cadastrar banco, solicitar homologação, habilitar capability por conta, testar conectividade.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Empresa | Combo de cadastro com busca | CADASTRO: empresas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Banco | Combo de cadastro com busca | CADASTRO: bancos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| Convênio bancário | Combo de cadastro com busca | CADASTRO: convenios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Conta bancária |
| Carteira de cobrança | Combo de cadastro com busca | CADASTRO: carteiras | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Convênio bancário |
| Serviço contratado | Combo de cadastro com busca | CADASTRO: servicos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Integração vinculada | Combo de cadastro com busca | CADASTRO: integracoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Instituição ou órgão + Ambiente |
| Certificado vinculado | Combo de cadastro com busca | CADASTRO: certificados | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa + Ambiente |
| Ambiente | Combo fechado (enum) | ENUM: ambiente | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E06-T01) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E06-T02 — Monitor cobrança multi-banco
**Protótipo de referência:** [Abrir Monitor cobrança multi-banco](index.html#E06-T02) · **Localização:** BANCOS & TESOURARIA → APIs bancárias · **Acesso por função:** tesouraria.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Banco` · `Conta bancária` · `Situação` · `Convênio bancário` · `Conta a receber` · `Referência de cobrança`. Ordenação por Banco, Conta bancária, Convênio bancário, Conta a receber, Referência de cobrança, default Banco. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Banco (Combo de cadastro com busca); Conta bancária (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** idempotência por banco/conta/operação/payload; reconciliação ativa de timeout.
**Exceções e resposta UX:** 409 idempotência, 429, webhook duplicado, retorno fora de ordem. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** registrar, consultar, cancelar/alterar, sincronizar evento, recuperar erro.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Banco | Combo de cadastro com busca | CADASTRO: bancos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| Convênio bancário | Combo de cadastro com busca | CADASTRO: convenios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Conta bancária |
| Conta a receber | Combo de cadastro com busca | CADASTRO: titulosReceber | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Referência de cobrança | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Referência fornecida pelo banco | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Origem do dado | Combo fechado (enum) | ENUM: fonteEvento | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Data e hora do evento | DateTimePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E06-T02) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E06-T03 — Hub extratos, saldos e DDA
**Protótipo de referência:** [Abrir Hub extratos, saldos e DDA](index.html#E06-T03) · **Localização:** BANCOS & TESOURARIA → APIs bancárias · **Acesso por função:** tesouraria.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Banco` · `Conta bancária` · `Situação` · `De` · `Até` · `Movimentação bancária`. Ordenação por Banco, Conta bancária, De, Até, Movimentação bancária, default Banco. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Banco (Combo de cadastro com busca); Conta bancária (Combo de cadastro com busca); De (DatePicker); Até (DatePicker); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** acesso autorizado, sem inventar endpoint DDA/baixa automática.
**Exceções e resposta UX:** capability indisponível, lacuna de movimentos, rate limit. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** consultar extratos/saldos, puxar títulos DDA quando disponível, agendar sincronismo.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Banco | Combo de cadastro com busca | CADASTRO: bancos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| De | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Até | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Movimentação bancária | Combo de cadastro com busca | CADASTRO: transacoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Data da movimentação | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Origem do dado | Combo fechado (enum) | ENUM: fonteEvento | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E06-T03) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E06-T04 — Fila de pagamentos bancários
**Protótipo de referência:** [Abrir Fila de pagamentos bancários](index.html#E06-T04) · **Localização:** BANCOS & TESOURARIA → APIs bancárias · **Acesso por função:** tesouraria.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Conta bancária` · `Situação` · `Conta a pagar` · `Valor` · `Data de confirmação bancária` · `Meio de pagamento`. Ordenação por Conta bancária, Conta a pagar, Valor, Data de confirmação bancária, Meio de pagamento, default Data de confirmação bancária. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Conta bancária (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** não transmitir sem permissão e dupla aprovação; estado final depende do banco.
**Exceções e resposta UX:** retorno desconhecido, falha de autenticação, saldo insuficiente. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** enviar ordem, acompanhar, cancelar se permitido, anexar comprovante.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| Conta a pagar | Combo de cadastro com busca | CADASTRO: titulosPagar | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Data de confirmação bancária | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Meio de pagamento | Combo fechado (enum) | ENUM: formaPagamento | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Responsável pela aprovação | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Referência fornecida pelo banco | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Documento relacionado | Combo de cadastro com busca | CADASTRO: documentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E06-T04) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E06-T05 — Console operacional APIs
**Protótipo de referência:** [Abrir Console operacional APIs](index.html#E06-T05) · **Localização:** BANCOS & TESOURARIA → APIs bancárias · **Acesso por função:** admin técnico.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Serviço contratado` · `Situação` · `Instituição ou órgão` · `Integração vinculada` · `Ambiente` · `Certificado vinculado`. Ordenação por Serviço contratado, Instituição ou órgão, Integração vinculada, Ambiente, Certificado vinculado, default Serviço contratado. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Instituição ou órgão (Combo de cadastro com busca); Serviço contratado (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** segredos redigidos, mTLS, rate limit e backoff por contrato homologado.
**Exceções e resposta UX:** indisponibilidade, divergência de payload por versão. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** consultar incidentes, reprocessar com idempotência, suspender conta.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Instituição ou órgão | Combo de cadastro com busca | CADASTRO: provedores | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Integração vinculada | Combo de cadastro com busca | CADASTRO: integracoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Instituição ou órgão + Ambiente |
| Ambiente | Combo fechado (enum) | ENUM: ambiente | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Certificado vinculado | Combo de cadastro com busca | CADASTRO: certificados | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa + Ambiente |
| Validade do certificado | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Serviço contratado | Combo de cadastro com busca | CADASTRO: servicos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Origem do dado | Combo fechado (enum) | ENUM: fonteEvento | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Data e hora do evento | DateTimePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E06-T05) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

## E07 — Conciliação bancária · 4 interfaces

### E07-T01 — Painel conciliação por conta/período
**Protótipo de referência:** [Abrir Painel conciliação por conta/período](index.html#E07-T01) · **Localização:** BANCOS & TESOURARIA → Conciliação bancária · **Acesso por função:** Karina/tesouraria.
**Ação primária e governança:** Revisar correspondência. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Movimentação bancária` · `Conta bancária` · `Valor` · `Situação` · `De` · `Até`. Ordenação por Movimentação bancária, Conta bancária, Valor, De, Até, default Movimentação bancária. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Conta bancária (Combo de cadastro com busca); De (DatePicker); Até (DatePicker); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** um lançamento de extrato não pode liquidar duas obrigações salvo rateio explícito.
**Exceções e resposta UX:** mesmo valor várias vezes, informações incompletas. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** sincronizar, comparar, filtrar conciliados/não conciliados, fechar sessão.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| De | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Até | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Movimentação bancária | Combo de cadastro com busca | CADASTRO: transacoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta a pagar | Combo de cadastro com busca | CADASTRO: titulosPagar | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta a receber | Combo de cadastro com busca | CADASTRO: titulosReceber | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E07-T01) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E07-T02 — Motor de sugestões e matching
**Protótipo de referência:** [Abrir Motor de sugestões e matching](index.html#E07-T02) · **Localização:** BANCOS & TESOURARIA → Conciliação bancária · **Acesso por função:** tesouraria.
**Ação primária e governança:** Revisar correspondência. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Movimentação bancária` · `Conta bancária` · `Valor` · `Situação` · `Conta a pagar` · `Conta a receber`. Ordenação por Movimentação bancária, Conta bancária, Valor, Conta a pagar, Conta a receber, default Movimentação bancária. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Conta bancária (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** auto-conciliação somente para chave forte + valor/competência compatíveis; resto revisão.
**Exceções e resposta UX:** pagamento parcial, tarifa, chargeback, duplicidade. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** gerar matches determinísticos, exibir explicação, conciliar manualmente, desfazer.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Movimentação bancária | Combo de cadastro com busca | CADASTRO: transacoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| Conta a pagar | Combo de cadastro com busca | CADASTRO: titulosPagar | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta a receber | Combo de cadastro com busca | CADASTRO: titulosReceber | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Referência de cobrança | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Data da movimentação | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Origem do dado | Combo fechado (enum) | ENUM: fonteEvento | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E07-T02) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E07-T03 — Baixas e estornos financeiros
**Protótipo de referência:** [Abrir Baixas e estornos financeiros](index.html#E07-T03) · **Localização:** BANCOS & TESOURARIA → Conciliação bancária · **Acesso por função:** financeiro com alçada.
**Ação primária e governança:** Revisar correspondência. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Movimentação bancária` · `Conta bancária` · `Valor` · `Situação` · `Conta a pagar` · `Conta a receber`. Ordenação por Movimentação bancária, Conta bancária, Valor, Conta a pagar, Conta a receber, default Movimentação bancária. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Conta bancária (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** saldo não pode ficar negativo; estorno não exclui baixa histórica.
**Exceções e resposta UX:** arquivo de banco retroativo, pagamento devolvido. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** confirmar baixa total/parcial, contabilizar tarifa e desconto, estornar com motivo.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Movimentação bancária | Combo de cadastro com busca | CADASTRO: transacoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta a pagar | Combo de cadastro com busca | CADASTRO: titulosPagar | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta a receber | Combo de cadastro com busca | CADASTRO: titulosReceber | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Juros | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Desconto | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Responsável pela aprovação | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E07-T03) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E07-T04 — Fechamento da conciliação
**Protótipo de referência:** [Abrir Fechamento da conciliação](index.html#E07-T04) · **Localização:** BANCOS & TESOURARIA → Conciliação bancária · **Acesso por função:** controladoria.
**Ação primária e governança:** Revisar correspondência. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Conta bancária` · `De` · `Até` · `Saldo` · `Situação` · `Valor`. Ordenação por Conta bancária, De, Até, Saldo, Valor, default Conta bancária. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Conta bancária (Combo de cadastro com busca); De (DatePicker); Até (DatePicker); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** saldo conciliado deve bater com extrato disponível e razão tesouraria.
**Exceções e resposta UX:** movimento tardio, ajuste contábil posterior. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** submeter conferência, aprovar fechamento, reabrir mediante trilha.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| De | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Até | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Saldo | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor.; somente leitura |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Responsável pela aprovação | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E07-T04) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

## E08 — Tesouraria · 4 interfaces

### E08-T01 — Posição bancária e de caixa
**Protótipo de referência:** [Abrir Posição bancária e de caixa](index.html#E08-T01) · **Localização:** BANCOS & TESOURARIA → Tesouraria · **Acesso por função:** Karina.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Conta bancária` · `De` · `Saldo` · `Valor` · `Situação` · `Banco`. Ordenação por Conta bancária, De, Saldo, Valor, Banco, default Conta bancária. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Banco (Combo de cadastro com busca); Conta bancária (Combo de cadastro com busca); De (DatePicker); Até (DatePicker); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** saldo bancário informado pela API versus saldo contábil exibidos separadamente.
**Exceções e resposta UX:** API sem extrato ou saldo em tempo real. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** atualizar, consultar origem, comparar saldos e extratos.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Banco | Combo de cadastro com busca | CADASTRO: bancos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| De | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Até | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Saldo | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor.; somente leitura |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E08-T01) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E08-T02 — Fluxo de caixa previsto/realizado
**Protótipo de referência:** [Abrir Fluxo de caixa previsto/realizado](index.html#E08-T02) · **Localização:** BANCOS & TESOURARIA → Tesouraria · **Acesso por função:** gestão/financeiro.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Conta bancária` · `De` · `Valor` · `Situação` · `Até` · `Conta a receber`. Ordenação por Conta bancária, De, Valor, Até, Conta a receber, default Conta bancária. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** De (DatePicker); Até (DatePicker); Conta bancária (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** projetado nunca misturar com realizado; data efetiva de liquidação.
**Exceções e resposta UX:** atrasos, pagamentos parciais e novos compromissos. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** simular período, filtrar conta, visualizar projeção, exportar.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| De | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Até | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| Conta a receber | Combo de cadastro com busca | CADASTRO: titulosReceber | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta a pagar | Combo de cadastro com busca | CADASTRO: titulosPagar | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Periodicidade | Combo fechado (enum) | ENUM: frequencia | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E08-T02) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E08-T03 — Aplicações, tarifas e transferências
**Protótipo de referência:** [Abrir Aplicações, tarifas e transferências](index.html#E08-T03) · **Localização:** BANCOS & TESOURARIA → Tesouraria · **Acesso por função:** tesouraria/contador.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Conta bancária` · `Valor` · `Situação` · `Conta contábil` · `Natureza da conta` · `Juros`. Ordenação por Conta bancária, Valor, Conta contábil, Natureza da conta, Juros, default Conta bancária. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Conta bancária (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** transferências não duplicam receita/despesa; cada perna conciliada.
**Exceções e resposta UX:** tarifa automática, estorno e data de liquidação. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** registrar aplicação/resgate, conciliar, reconhecer encargo e transferência.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| Conta contábil | Combo de cadastro com busca | CADASTRO: planosConta | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Natureza da conta | Combo fechado (enum) | ENUM: naturezaConta | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Juros | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Tipo de ocorrência | Combo fechado (enum) | ENUM: tipoEvento | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Data da movimentação | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E08-T03) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E08-T04 — Painel de risco de liquidez
**Protótipo de referência:** [Abrir Painel de risco de liquidez](index.html#E08-T04) · **Localização:** BANCOS & TESOURARIA → Tesouraria · **Acesso por função:** diretoria.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Conta bancária` · `De` · `Saldo` · `Valor` · `Situação` · `Até`. Ordenação por Conta bancária, De, Saldo, Valor, Até, default Conta bancária. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Conta bancária (Combo de cadastro com busca); De (DatePicker); Até (DatePicker); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** alerta não é aprovação de crédito nem execução automática.
**Exceções e resposta UX:** falta de saldo, previsão incerta. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** configurar alertas, visualizar janelas e compromissos.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| De | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Até | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Saldo | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor.; somente leitura |
| Reserva mínima desejada | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Conta a pagar | Combo de cadastro com busca | CADASTRO: titulosPagar | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E08-T04) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

## E09 — Contabilidade e SPED · 9 interfaces

### E09-T01 — Plano de contas e centros de custo
**Protótipo de referência:** [Abrir Plano de contas e centros de custo](index.html#E09-T01) · **Localização:** CONTABILIDADE → Contabilidade e SPED · **Acesso por função:** contador/controladoria.
**Ação primária e governança:** Revisar competência. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Conta contábil` · `Situação` · `Natureza da conta` · `Centro de custo` · `Início de vigência` · `Fim de vigência`. Ordenação por Conta contábil, Natureza da conta, Centro de custo, Início de vigência, Fim de vigência, default Conta contábil. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** partida dobrada, níveis hierárquicos válidos, competência obrigatória.
**Exceções e resposta UX:** conta desativada, mudança de classificação após fechamento. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** criar, versionar, aprovar, bloquear conta e mapear lançamentos.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Conta contábil | Combo de cadastro com busca | CADASTRO: planosConta | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Natureza da conta | Combo fechado (enum) | ENUM: naturezaConta | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Centro de custo | Combo de cadastro com busca | CADASTRO: centrosCusto | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Início de vigência | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Fim de vigência | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E09-T01) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E09-T02 — Políticas de contabilização
**Protótipo de referência:** [Abrir Políticas de contabilização](index.html#E09-T02) · **Localização:** CONTABILIDADE → Contabilidade e SPED · **Acesso por função:** contador.
**Ação primária e governança:** Revisar competência. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Competência` · `Situação` · `Conta de débito` · `Conta de crédito` · `Centro de custo` · `Tipo de ocorrência`. Ordenação por Competência, Conta de débito, Conta de crédito, Centro de custo, Tipo de ocorrência, default Competência. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Competência (Seletor de competência); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** origem imutável, não lançar sem mapeamento correto, balanceamento exato.
**Exceções e resposta UX:** mapeamento ausente, evento duplicado. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** configurar mappings, simular evento, aprovar regra.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Conta de débito | Combo de cadastro com busca | CADASTRO: planosConta | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta de crédito | Combo de cadastro com busca | CADASTRO: planosConta | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Centro de custo | Combo de cadastro com busca | CADASTRO: centrosCusto | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Tipo de ocorrência | Combo fechado (enum) | ENUM: tipoEvento | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Competência | Seletor de competência | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Enquadramento fiscal | Combo de cadastro com busca | CADASTRO: regrasFiscais | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Início de vigência | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E09-T02) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E09-T03 — Diário, razão e lançamentos
**Protótipo de referência:** [Abrir Diário, razão e lançamentos](index.html#E09-T03) · **Localização:** CONTABILIDADE → Contabilidade e SPED · **Acesso por função:** contador.
**Ação primária e governança:** Revisar competência. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Competência` · `Valor` · `Situação` · `Conta de débito` · `Conta de crédito` · `Centro de custo`. Ordenação por Competência, Valor, Conta de débito, Conta de crédito, Centro de custo, default Competência. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Competência (Seletor de competência); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** deve haver soma débitos=soma créditos; não editar lançamento postado.
**Exceções e resposta UX:** período encerrado, documento cancelado. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** consultar, lançar ajuste, estornar, anexar suporte, exportar.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Conta de débito | Combo de cadastro com busca | CADASTRO: planosConta | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta de crédito | Combo de cadastro com busca | CADASTRO: planosConta | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Centro de custo | Combo de cadastro com busca | CADASTRO: centrosCusto | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Competência | Seletor de competência | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Data e hora do evento | DateTimePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Documento de origem | Combo de cadastro com busca | CADASTRO: documentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E09-T03) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E09-T04 — Balancete, DRE e balanço
**Protótipo de referência:** [Abrir Balancete, DRE e balanço](index.html#E09-T04) · **Localização:** CONTABILIDADE → Contabilidade e SPED · **Acesso por função:** contador/diretoria.
**Ação primária e governança:** Revisar competência. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Conta contábil` · `Competência` · `Valor` · `Situação` · `De` · `Até`. Ordenação por Conta contábil, Competência, Valor, De, Até, default Competência. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Competência (Seletor de competência); De (DatePicker); Até (DatePicker); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** reconciliar saldos com razão e critérios de competência.
**Exceções e resposta UX:** saldo patrimonial incompatível, mapeamento incorreto. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** gerar, detalhar contas, comparar, exportar.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Competência | Seletor de competência | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| De | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Até | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Centro de custo | Combo de cadastro com busca | CADASTRO: centrosCusto | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta contábil | Combo de cadastro com busca | CADASTRO: planosConta | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E09-T04) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E09-T05 — Apuração fiscal por competência
**Protótipo de referência:** [Abrir Apuração fiscal por competência](index.html#E09-T05) · **Localização:** CONTABILIDADE → Contabilidade e SPED · **Acesso por função:** contador/fiscal.
**Ação primária e governança:** Revisar competência. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Competência` · `Valor` · `Situação` · `Estabelecimento` · `Tributo` · `Base tributável (calculada)`. Ordenação por Competência, Valor, Estabelecimento, Tributo, Base tributável (calculada), default Competência. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Estabelecimento (Combo de cadastro com busca); Competência (Seletor de competência); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** apuração depende regime, norma vigente e validação do responsável habilitado.
**Exceções e resposta UX:** base divergente, tributo sem documentação, mudança legal. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** apurar, simular, revisar, aprovar, emitir memória, contabilizar impostos.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Estabelecimento | Combo de cadastro com busca | CADASTRO: estabelecimentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa |
| Competência | Seletor de competência | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Tributo | Combo fechado (enum) | ENUM: tipoTributo | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Base tributável (calculada) | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Alíquota (%) | Percentual com faixa | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Redução de base do ICMS (%) | Percentual com faixa | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Benefício fiscal | Combo de cadastro com busca | CADASTRO: cBenef | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E09-T05) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E09-T06 — Inventário contábil/CMV
**Protótipo de referência:** [Abrir Inventário contábil/CMV](index.html#E09-T06) · **Localização:** CONTABILIDADE → Contabilidade e SPED · **Acesso por função:** controladoria.
**Ação primária e governança:** Revisar competência. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Competência` · `Valor` · `Situação` · `Estabelecimento` · `Lote de produção` · `Produto`. Ordenação por Competência, Valor, Estabelecimento, Lote de produção, Produto, default Competência. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Estabelecimento (Combo de cadastro com busca); Produto (Combo de cadastro com busca); Competência (Seletor de competência); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** método custo e avaliação fixados por política contábil, com histórico.
**Exceções e resposta UX:** diferenças físicas e devoluções tardias. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** fechar período, reconciliar físico, fiscal e razão, aprovar ajuste.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Estabelecimento | Combo de cadastro com busca | CADASTRO: estabelecimentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa |
| Lote de produção | Combo de cadastro com busca | CADASTRO: lotes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Produto | Combo de cadastro com busca | CADASTRO: produtos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Método de custo | Combo fechado (enum) | ENUM: criterioCusto | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Quantidade | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Peso conferido (kg) | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Competência | Seletor de competência | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E09-T06) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E09-T07 — Obrigações acessórias SPED
**Protótipo de referência:** [Abrir Obrigações acessórias SPED](index.html#E09-T07) · **Localização:** CONTABILIDADE → Contabilidade e SPED · **Acesso por função:** contador.
**Ação primária e governança:** Revisar competência. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Competência` · `Obrigação digital` · `Arquivo processado` · `Recibo oficial` · `Situação` · `Estabelecimento`. Ordenação por Competência, Obrigação digital, Arquivo processado, Recibo oficial, Estabelecimento, default Competência. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Estabelecimento (Combo de cadastro com busca); Competência (Seletor de competência); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** não alegar conformidade por gerar arquivo; homologação PVA/validador é gate externo.
**Exceções e resposta UX:** registro obrigatório ausente, versão de layout nova. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** gerar conforme obrigatoriedade, validar, revisar, assinar/transmitir apenas com credenciais e processo aprovado.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Estabelecimento | Combo de cadastro com busca | CADASTRO: estabelecimentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa |
| Competência | Seletor de competência | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Obrigação digital | Combo fechado (enum) | ENUM: tipoLayoutSped | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Tabela ou versão oficial | Combo de cadastro com busca | CADASTRO: datasets | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Certificado vinculado | Combo de cadastro com busca | CADASTRO: certificados | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa + Ambiente |
| Arquivo processado | Combo de cadastro com busca | CADASTRO: arquivos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Recibo oficial | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E09-T07) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E09-T08 — Fechamento e reabertura de períodos
**Protótipo de referência:** [Abrir Fechamento e reabertura de períodos](index.html#E09-T08) · **Localização:** CONTABILIDADE → Contabilidade e SPED · **Acesso por função:** contador/controller.
**Ação primária e governança:** Revisar competência. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Competência` · `Situação` · `De` · `Até` · `Responsável pela aprovação`. Ordenação por Competência, De, Até, Responsável pela aprovação, default Competência. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Competência (Seletor de competência); De (DatePicker); Até (DatePicker); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** período fechado só altera por lançamento de ajuste/estorno e reabertura auditada.
**Exceções e resposta UX:** movimento bancário tardio, NF-e retroativa. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** pré-fechar, validar balanço, fechar, emitir relatório, reabrir com alçada.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Competência | Seletor de competência | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| De | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Até | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Responsável pela aprovação | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E09-T08) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E09-T09 — Relatórios e exportação contábil
**Protótipo de referência:** [Abrir Relatórios e exportação contábil](index.html#E09-T09) · **Localização:** CONTABILIDADE → Contabilidade e SPED · **Acesso por função:** contador/auditoria.
**Ação primária e governança:** Revisar competência. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Conta contábil` · `Competência` · `Situação` · `De` · `Até` · `Centro de custo`. Ordenação por Conta contábil, Competência, De, Até, Centro de custo, default Competência. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Competência (Seletor de competência); De (DatePicker); Até (DatePicker); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** auditoria e máscara de dados; totais conciliados.
**Exceções e resposta UX:** layout exportação do escritório desconhecido. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** exportar CSV/XLSX/layout contábil homologado, agendar relatórios.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Competência | Seletor de competência | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| De | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Até | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Conta contábil | Combo de cadastro com busca | CADASTRO: planosConta | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Centro de custo | Combo de cadastro com busca | CADASTRO: centrosCusto | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Tributo | Combo fechado (enum) | ENUM: tipoTributo | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Arquivo processado | Combo de cadastro com busca | CADASTRO: arquivos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E09-T09) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

## E10 — Integração operacional · 4 interfaces

### E10-T01 — Adaptação de pré-faturamento para SEFAZ
**Protótipo de referência:** [Abrir Adaptação de pré-faturamento para SEFAZ](index.html#E10-T01) · **Localização:** FATURAMENTO → Integração operacional · **Acesso por função:** faturamento.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Carga` · `Pedido de venda` · `Nota fiscal` · `Situação` · `Cliente` · `Estabelecimento`. Ordenação por Carga, Pedido de venda, Nota fiscal, Cliente, Estabelecimento, default Carga. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Cliente (Combo de cadastro com busca); Estabelecimento (Combo de cadastro com busca); Produto (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** não alterar fluxo operacional/estoque já aprovado; EISS não é autorização mercadoria.
**Exceções e resposta UX:** carga parcial, estado pendente do SEFAZ. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** substituir ação de emissão NFS-e para mercadorias, abrir prévia NF-e.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Carga | Combo de cadastro com busca | CADASTRO: cargas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Pedido de venda | Combo de cadastro com busca | CADASTRO: pedidosVenda | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Cliente |
| Cliente | Combo de cadastro com busca | CADASTRO: clientes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Estabelecimento | Combo de cadastro com busca | CADASTRO: estabelecimentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa |
| Produto | Combo de cadastro com busca | CADASTRO: produtos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Quantidade | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Peso conferido (kg) | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Enquadramento fiscal | Combo de cadastro com busca | CADASTRO: regrasFiscais | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Nota fiscal | Combo de cadastro com busca | CADASTRO: notas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Estabelecimento |
| Chave de acesso (documento) | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E10-T01) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E10-T02 — Conferência e ocorrência fiscal no recebimento
**Protótipo de referência:** [Abrir Conferência e ocorrência fiscal no recebimento](index.html#E10-T02) · **Localização:** FATURAMENTO → Integração operacional · **Acesso por função:** recebimento/fiscal.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Nota fiscal` · `Situação` · `Pedido de compra` · `Fornecedor` · `Produto` · `Peso informado na nota (kg)`. Ordenação por Nota fiscal, Pedido de compra, Fornecedor, Produto, Peso informado na nota (kg), default Nota fiscal. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Fornecedor (Combo de cadastro com busca); Produto (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** ocorrência não vira NF-e nem baixa bancária sem tratamento.
**Exceções e resposta UX:** item não mapeado, desconto pendente. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** abrir divergência, criar reclamação e pré-devolução.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Pedido de compra | Combo de cadastro com busca | CADASTRO: pedidosCompra | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Fornecedor |
| Fornecedor | Combo de cadastro com busca | CADASTRO: fornecedores | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Nota fiscal | Combo de cadastro com busca | CADASTRO: notas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Estabelecimento |
| Produto | Combo de cadastro com busca | CADASTRO: produtos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Peso informado na nota (kg) | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Peso conferido (kg) | Decimal de quantidade/peso | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Diferença de peso (calculada) | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Ocorrência relacionada | Combo de cadastro com busca | CADASTRO: ocorrencias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E10-T02) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E10-T03 — Checklist de liberação fiscal
**Protótipo de referência:** [Abrir Checklist de liberação fiscal](index.html#E10-T03) · **Localização:** FATURAMENTO → Integração operacional · **Acesso por função:** expedição/logística.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Carga` · `Caminhão` · `Motorista` · `Nota fiscal` · `Situação` · `Pedido de venda`. Ordenação por Carga, Caminhão, Motorista, Nota fiscal, Pedido de venda, default Carga. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** sem NF-e autorizada e outros requisitos não libera carga normal.
**Exceções e resposta UX:** contingência quando legalmente admitida. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** mostrar bloqueios, emitir alerta, liberar após gates.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Carga | Combo de cadastro com busca | CADASTRO: cargas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Caminhão | Combo de cadastro com busca | CADASTRO: veiculos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Motorista | Combo de cadastro com busca | CADASTRO: motoristas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Pedido de venda | Combo de cadastro com busca | CADASTRO: pedidosVenda | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Cliente |
| Nota fiscal | Combo de cadastro com busca | CADASTRO: notas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Estabelecimento |
| Chave de acesso (documento) | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Protocolo SEFAZ | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Documento relacionado | Combo de cadastro com busca | CADASTRO: documentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E10-T03) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E10-T04 — Menus, perfis e auditoria ERP
**Protótipo de referência:** [Abrir Menus, perfis e auditoria ERP](index.html#E10-T04) · **Localização:** FATURAMENTO → Integração operacional · **Acesso por função:** admin.
**Ação primária e governança:** Cadastrar / revisar. Justificativa: solicitar para operações críticas. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Situação` · `Usuário` · `Área do menu` · `Perfil` · `Decisão` · `Ambiente`. Ordenação por Usuário, Área do menu, Perfil, Decisão, Ambiente, default Situação. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** não quebrar menu canônico sem aditamento/protótipo e Quality Owner.
**Exceções e resposta UX:** telas sem referência visual; aprovações conflitantes. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** criar grupos UI aprovados e trilha end-to-end.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Usuário | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Área do menu | Combo fechado (enum) | ENUM: grupoMenu | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Perfil | Combo fechado (enum) | ENUM: perfilSistema | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Decisão | Combo fechado (enum) | ENUM: acaoAprovacao | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Ambiente | Combo fechado (enum) | ENUM: ambiente | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E10-T04) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

## E11 — Arquivo e contingência · 5 interfaces

### E11-V01 — Caixa de Entrada de Arquivos
**Protótipo de referência:** [Abrir Caixa de Entrada de Arquivos](index.html#E11-V01) · **Localização:** BANCOS & TESOURARIA → Arquivos • entrada · **Acesso por função:** tesouraria e auditoria.
**Ação primária e governança:** Pré-validar arquivo. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Banco` · `Conta bancária` · `Modelo de arquivo homologado` · `Situação` · `Convênio bancário` · `Serviço contratado`. Ordenação por Banco, Conta bancária, Modelo de arquivo homologado, Convênio bancário, Serviço contratado, default Banco. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Banco (Combo de cadastro com busca); Conta bancária (Combo de cadastro com busca); Serviço contratado (Combo de cadastro com busca); Modelo de arquivo homologado (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Painel conciliação por conta/período. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** nunca baixar títulos apenas por importar um arquivo; lote idempotente, com status de quarentena.
**Exceções e resposta UX:** arquivo de outro convênio, extensão inválida, arquivo duplicado, hash conflitante. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** importar arquivo, identificar formato pelo cabeçalho, pré-validar, classificar e acompanhar lote.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Banco | Combo de cadastro com busca | CADASTRO: bancos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| Convênio bancário | Combo de cadastro com busca | CADASTRO: convenios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Conta bancária |
| Serviço contratado | Combo de cadastro com busca | CADASTRO: servicos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Tipo do arquivo | Combo fechado (enum) | ENUM: tipoArquivo | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Modelo de arquivo homologado | Combo de cadastro com busca | CADASTRO: layouts | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Serviço contratado |
| Selecionar arquivo | Upload de arquivo controlado | Entrada ou cálculo do domínio | Upload validado por tipo/limite, quarentena, AV e aprovação; no protótipo não ler conteúdo real. |
| Integridade do arquivo | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E11-V01) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E11-V02 — Prévia, Validação e Aprovação do Lote
**Protótipo de referência:** [Abrir Prévia, Validação e Aprovação do Lote](index.html#E11-V02) · **Localização:** BANCOS & TESOURARIA → Arquivos • validação · **Acesso por função:** tesouraria e auditoria.
**Ação primária e governança:** Pré-validar arquivo. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Arquivo processado` · `Banco` · `Modelo de arquivo homologado` · `Situação` · `Conta bancária` · `De`. Ordenação por Arquivo processado, Banco, Modelo de arquivo homologado, Conta bancária, De, default Arquivo processado. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Banco (Combo de cadastro com busca); Conta bancária (Combo de cadastro com busca); Modelo de arquivo homologado (Combo de cadastro com busca); De (DatePicker); Até (DatePicker). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Painel conciliação por conta/período. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** somente lote validado e revisado alimenta observações canônicas; remessa gerada não significa enviada.
**Exceções e resposta UX:** conta divergente, soma inconsistente, linha truncada, layout desatualizado. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** comparar header e trailer, validar somatórios, aprovar lote, rejeitar com motivo, baixar relatório de inconsistências.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Arquivo processado | Combo de cadastro com busca | CADASTRO: arquivos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Banco | Combo de cadastro com busca | CADASTRO: bancos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| Modelo de arquivo homologado | Combo de cadastro com busca | CADASTRO: layouts | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Serviço contratado |
| De | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Até | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Saldo | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor.; somente leitura |
| Responsável pela aprovação | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E11-V02) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E11-V03 — Conflitos entre API e Arquivos
**Protótipo de referência:** [Abrir Conflitos entre API e Arquivos](index.html#E11-V03) · **Localização:** BANCOS & TESOURARIA → Arquivos • conflitos · **Acesso por função:** tesouraria e auditoria.
**Ação primária e governança:** Pré-validar arquivo. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Movimentação bancária` · `Origem do dado` · `Valor` · `Data da movimentação` · `Situação` · `Banco`. Ordenação por Movimentação bancária, Origem do dado, Valor, Data da movimentação, Banco, default Data da movimentação. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Banco (Combo de cadastro com busca); Conta bancária (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Painel conciliação por conta/período. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** mesma transação pode ter várias observações; valor/data isolados nunca justificam baixa.
**Exceções e resposta UX:** identificador ausente, mesmo valor em transações distintas, retorno e extrato de datas diferentes. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** comparar observações, sugerir correspondência, solicitar revisão, confirmar ou rejeitar conciliação.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Movimentação bancária | Combo de cadastro com busca | CADASTRO: transacoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Banco | Combo de cadastro com busca | CADASTRO: bancos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| Origem do dado | Combo fechado (enum) | ENUM: fonteEvento | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Referência fornecida pelo banco | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Referência de cobrança | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Valor | Moeda BRL com máscara | Entrada ou cálculo do domínio | Máscara pt-BR, limites legais/de negócio e precisão decimal; validação no servidor. |
| Data da movimentação | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E11-V03) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E11-V04 — Proveniência e Linha do Tempo Bancária
**Protótipo de referência:** [Abrir Proveniência e Linha do Tempo Bancária](index.html#E11-V04) · **Localização:** BANCOS & TESOURARIA → Arquivos • proveniência · **Acesso por função:** tesouraria e auditoria.
**Ação primária e governança:** Pré-validar arquivo. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Arquivo processado` · `Situação` · `Movimentação bancária` · `Conta bancária` · `Origem do dado` · `Referência fornecida pelo banco`. Ordenação por Arquivo processado, Movimentação bancária, Conta bancária, Origem do dado, Referência fornecida pelo banco, default Arquivo processado. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Conta bancária (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Painel conciliação por conta/período. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** proveniência append-only, não eliminar registros ao ocorrer falha ou correção.
**Exceções e resposta UX:** duas fontes discordam, arquivo substituído, correção de retorno D+1. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** navegar evidências originais, consultar decisões, reverter alocação com justificativa.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Movimentação bancária | Combo de cadastro com busca | CADASTRO: transacoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| Arquivo processado | Combo de cadastro com busca | CADASTRO: arquivos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Origem do dado | Combo fechado (enum) | ENUM: fonteEvento | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Referência fornecida pelo banco | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Integridade do arquivo | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Data e hora do evento | DateTimePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Usuário | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E11-V04) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E11-V05 — Saúde dos Canais e Fallback
**Protótipo de referência:** [Abrir Saúde dos Canais e Fallback](index.html#E11-V05) · **Localização:** BANCOS & TESOURARIA → Arquivos • continuidade · **Acesso por função:** tesouraria e auditoria.
**Ação primária e governança:** Pré-validar arquivo. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Banco` · `Modelo de arquivo homologado` · `Situação` · `Conta bancária` · `Convênio bancário` · `Serviço contratado`. Ordenação por Banco, Modelo de arquivo homologado, Conta bancária, Convênio bancário, Serviço contratado, default Banco. Seleção múltipla por alçada e ação em lote auditada. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Banco (Combo de cadastro com busca); Conta bancária (Combo de cadastro com busca); Serviço contratado (Combo de cadastro com busca); Modelo de arquivo homologado (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Painel conciliação por conta/período. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** API preferencial, arquivo contingência; não reenviar pagamento após timeout sem consulta.
**Exceções e resposta UX:** API fora, layout não homologado, falha temporária, período sobreposto. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** habilitar fallback controlado, suspender, executar sincronização, reativar API, consultar checkpoint.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Banco | Combo de cadastro com busca | CADASTRO: bancos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| Convênio bancário | Combo de cadastro com busca | CADASTRO: convenios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Conta bancária |
| Serviço contratado | Combo de cadastro com busca | CADASTRO: servicos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Modo de operação | Combo fechado (enum) | ENUM: modoFallback | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Modelo de arquivo homologado | Combo de cadastro com busca | CADASTRO: layouts | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Serviço contratado |
| Integração vinculada | Combo de cadastro com busca | CADASTRO: integracoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Instituição ou órgão + Ambiente |
| Data e hora do evento | DateTimePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Responsável pela aprovação | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E11-V05) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

## E12 — Central de integrações · 7 interfaces

### E12-V01 — Catálogo de Integrações
**Protótipo de referência:** [Abrir Catálogo de Integrações](index.html#E12-V01) · **Localização:** ADMINISTRAÇÃO → Integrações • catálogo · **Acesso por função:** administrador e responsável de integração.
**Ação primária e governança:** Configurar serviço. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Integração vinculada` · `Instituição ou órgão` · `Serviço contratado` · `Ambiente` · `Situação` · `Empresa`. Ordenação por Integração vinculada, Instituição ou órgão, Serviço contratado, Ambiente, Empresa, default Integração vinculada. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Empresa (Combo de cadastro com busca); Estabelecimento (Combo de cadastro com busca); Instituição ou órgão (Combo de cadastro com busca); Serviço contratado (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** configuração versionada em PostgreSQL; segregação HML/PROD e aprovação de produção.
**Exceções e resposta UX:** endpoint não autorizado, credencial ausente, usuário sem permissão, dois perfis PROD ativos. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** criar perfil, associar serviço, testar conexão sem efeitos externos, solicitar ativação, aprovar e suspender.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Empresa | Combo de cadastro com busca | CADASTRO: empresas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Estabelecimento | Combo de cadastro com busca | CADASTRO: estabelecimentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa |
| Instituição ou órgão | Combo de cadastro com busca | CADASTRO: provedores | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Serviço contratado | Combo de cadastro com busca | CADASTRO: servicos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Tipo Servico | Combo fechado (enum) | ENUM: tipoServico | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Integração vinculada | Combo de cadastro com busca | CADASTRO: integracoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Instituição ou órgão + Ambiente |
| Ambiente | Combo fechado (enum) | ENUM: ambiente | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Serviço oficial | Combo de endpoint aprovado | Catálogo E12 de endpoints | Endpoint deve ser selecionado do cadastro de endpoints oficiais aprovados, nunca URL arbitrária. |
| Certificado vinculado | Combo de cadastro com busca | CADASTRO: certificados | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa + Ambiente |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E12-V01) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E12-V02 — Certificados Digitais e Rotação
**Protótipo de referência:** [Abrir Certificados Digitais e Rotação](index.html#E12-V02) · **Localização:** ADMINISTRAÇÃO → Integrações • certificados · **Acesso por função:** administrador e responsável de integração.
**Ação primária e governança:** Configurar serviço. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Estabelecimento` · `Finalidade do certificado` · `Titular do certificado` · `Validade do certificado` · `Situação` · `Empresa`. Ordenação por Estabelecimento, Finalidade do certificado, Titular do certificado, Validade do certificado, Empresa, default Estabelecimento. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Empresa (Combo de cadastro com busca); Estabelecimento (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** chave privada criptografada no PostgreSQL sob envelope AES-256-GCM e KMS externo; senha PFX jamais persistida.
**Exceções e resposta UX:** senha incorreta, chave/cert incompatíveis, certificado expirado, CNPJ divergente, revogação, A3 não compatível. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** fazer upload, validar certificado, testar assinatura ou mTLS, associar a perfil, substituir, revogar e programar alertas.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Empresa | Combo de cadastro com busca | CADASTRO: empresas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Estabelecimento | Combo de cadastro com busca | CADASTRO: estabelecimentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa |
| Finalidade do certificado | Combo fechado (enum) | ENUM: finalidadeCert | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Ambiente | Combo fechado (enum) | ENUM: ambiente | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Formato do certificado | Combo fechado (enum) | ENUM: formatoCert | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Enviar certificado digital | Upload de arquivo controlado | Entrada ou cálculo do domínio | Upload validado por tipo/limite, quarentena, AV e aprovação; no protótipo não ler conteúdo real. |
| Certificado público | Upload de arquivo controlado | Entrada ou cálculo do domínio | Upload validado por tipo/limite, quarentena, AV e aprovação; no protótipo não ler conteúdo real. |
| Titular do certificado | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Autoridade certificadora | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Série do certificado | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Impressão digital do certificado | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Validade do certificado | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Senha para leitura (temporária) | Campo sensível write-only | Entrada ou cálculo do domínio | Entrada transitória, write-only, nunca ecoada; no protótipo usar exclusivamente conteúdo fictício.; nunca retornar ou pré-preencher |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E12-V02) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E12-V03 — Aplicações Bancárias e Credenciais
**Protótipo de referência:** [Abrir Aplicações Bancárias e Credenciais](index.html#E12-V03) · **Localização:** ADMINISTRAÇÃO → Integrações • bancos · **Acesso por função:** administrador e responsável de integração.
**Ação primária e governança:** Configurar serviço. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Banco` · `Integração vinculada` · `Ambiente` · `Certificado vinculado` · `Situação` · `Empresa`. Ordenação por Banco, Integração vinculada, Ambiente, Certificado vinculado, Empresa, default Banco. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Empresa (Combo de cadastro com busca); Banco (Combo de cadastro com busca); Conta bancária (Combo de cadastro com busca); Serviço contratado (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** OAuth/mTLS conforme banco habilitado; secrets criptografados; nunca preencher secret existente no GET.
**Exceções e resposta UX:** contrato não disponível, certificado vencido, CA trocada, scope insuficiente, API limitada por convênio. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** cadastrar aplicações por ambiente/serviço, importar credencial, gerar CSR se permitido, testar token, homologar e suspender.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Empresa | Combo de cadastro com busca | CADASTRO: empresas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Banco | Combo de cadastro com busca | CADASTRO: bancos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Conta bancária | Combo de cadastro com busca | CADASTRO: contasBancarias | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Empresa |
| Convênio bancário | Combo de cadastro com busca | CADASTRO: convenios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Conta bancária |
| Carteira de cobrança | Combo de cadastro com busca | CADASTRO: carteiras | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Convênio bancário |
| Serviço contratado | Combo de cadastro com busca | CADASTRO: servicos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Integração vinculada | Combo de cadastro com busca | CADASTRO: integracoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Instituição ou órgão + Ambiente |
| Ambiente | Combo fechado (enum) | ENUM: ambiente | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Identificação da aplicação bancária | Texto validado | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |
| Certificado vinculado | Combo de cadastro com busca | CADASTRO: certificados | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa + Ambiente |
| Endereço de retorno (gerado) | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Segredo de autenticação | Campo sensível write-only | Entrada ou cálculo do domínio | Entrada transitória, write-only, nunca ecoada; no protótipo usar exclusivamente conteúdo fictício.; nunca retornar ou pré-preencher |
| Chave de API | Campo sensível write-only | Entrada ou cálculo do domínio | Entrada transitória, write-only, nunca ecoada; no protótipo usar exclusivamente conteúdo fictício.; nunca retornar ou pré-preencher |
| Segredo das notificações | Campo sensível write-only | Entrada ou cálculo do domínio | Entrada transitória, write-only, nunca ecoada; no protótipo usar exclusivamente conteúdo fictício.; nunca retornar ou pré-preencher |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E12-V03) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E12-V04 — Configuração Fiscal e SEFAZ
**Protótipo de referência:** [Abrir Configuração Fiscal e SEFAZ](index.html#E12-V04) · **Localização:** ADMINISTRAÇÃO → Integrações • fiscal · **Acesso por função:** administrador e responsável de integração.
**Ação primária e governança:** Configurar serviço. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Integração vinculada` · `Ambiente` · `Situação` · `Empresa` · `Estabelecimento` · `Inscrição estadual`. Ordenação por Integração vinculada, Ambiente, Empresa, Estabelecimento, Inscrição estadual, default Integração vinculada. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Empresa (Combo de cadastro com busca); Estabelecimento (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** URL aprovada por serviço e ambiente, não habilitar PROD sem certificado e parecer.
**Exceções e resposta UX:** sem credenciamento, IE incorreta, certificado de outro CNPJ, XSD incompatível. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** configurar emitente, homologar status, consultar, simular XSD, habilitar credenciamento comprovado.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Empresa | Combo de cadastro com busca | CADASTRO: empresas | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Estabelecimento | Combo de cadastro com busca | CADASTRO: estabelecimentos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa |
| Inscrição estadual | Texto validado | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |
| Regime tributário | Combo fechado (enum) | ENUM: crt | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Série da NF-e | Número inteiro | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |
| Número da NF-e | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Integração vinculada | Combo de cadastro com busca | CADASTRO: integracoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Instituição ou órgão + Ambiente |
| Ambiente | Combo fechado (enum) | ENUM: ambiente | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Certificado vinculado | Combo de cadastro com busca | CADASTRO: certificados | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa + Ambiente |
| Serviço oficial | Combo de endpoint aprovado | Catálogo E12 de endpoints | Endpoint deve ser selecionado do cadastro de endpoints oficiais aprovados, nunca URL arbitrária. |
| Tabela ou versão oficial | Combo de cadastro com busca | CADASTRO: datasets | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E12-V04) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E12-V05 — Catálogos Oficiais e Versões
**Protótipo de referência:** [Abrir Catálogos Oficiais e Versões](index.html#E12-V05) · **Localização:** ADMINISTRAÇÃO → Integrações • referências · **Acesso por função:** administrador e responsável de integração.
**Ação primária e governança:** Configurar serviço. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Instituição ou órgão` · `Situação` · `Tabela ou versão oficial` · `Modelo de arquivo homologado` · `Tipo Servico` · `Início de vigência`. Ordenação por Instituição ou órgão, Tabela ou versão oficial, Modelo de arquivo homologado, Tipo Servico, Início de vigência, default Tabela ou versão oficial. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Instituição ou órgão (Combo de cadastro com busca); Modelo de arquivo homologado (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** sem mudança automática de tributação, regra fiscal ou retorno bancário pela simples atualização.
**Exceções e resposta UX:** XSD NT incompatível, hash divergente, nova regra não aprovada, fonte offline. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** baixar fonte em staging, comparar, validar, aprovar ativação por vigência, consultar histórico.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Instituição ou órgão | Combo de cadastro com busca | CADASTRO: provedores | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Tabela ou versão oficial | Combo de cadastro com busca | CADASTRO: datasets | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Modelo de arquivo homologado | Combo de cadastro com busca | CADASTRO: layouts | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Banco + Serviço contratado |
| Tipo Servico | Combo fechado (enum) | ENUM: tipoServico | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Início de vigência | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Fim de vigência | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Integridade do arquivo | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Selecionar arquivo | Upload de arquivo controlado | Entrada ou cálculo do domínio | Upload validado por tipo/limite, quarentena, AV e aprovação; no protótipo não ler conteúdo real. |
| Responsável pela aprovação | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E12-V05) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E12-V06 — Jobs Batch e Histórico de Execução
**Protótipo de referência:** [Abrir Jobs Batch e Histórico de Execução](index.html#E12-V06) · **Localização:** ADMINISTRAÇÃO → Integrações • processamento · **Acesso por função:** administrador e responsável de integração.
**Ação primária e governança:** Configurar serviço. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Agendamento` · `Serviço contratado` · `Frequência de execução` · `Fuso horário` · `Situação` · `Integração vinculada`. Ordenação por Agendamento, Serviço contratado, Frequência de execução, Fuso horário, Integração vinculada, default Agendamento. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Serviço contratado (Combo de cadastro com busca); De (DatePicker); Até (DatePicker); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** sem sessão de usuário e sem .env de integração; lease/fencing, idempotência, retry e auditoria.
**Exceções e resposta UX:** falha SEFAZ, NSU duplicado, rate limit, credencial expirada, lote pendente de revisão. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** criar/pausar/agendar job, executar agora, inspecionar log, reprocessar sob aprovação, alterar checkpoint com trilha.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Integração vinculada | Combo de cadastro com busca | CADASTRO: integracoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Instituição ou órgão + Ambiente |
| Serviço contratado | Combo de cadastro com busca | CADASTRO: servicos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Agendamento | Combo de cadastro com busca | CADASTRO: jobs | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Integração vinculada |
| Frequência de execução | Combo de frequência + horários futuros | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |
| Fuso horário | Combo fechado (enum) | ENUM: timezone | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| De | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Até | DatePicker | Entrada ou cálculo do domínio | Seletor de data/competência; período e vigência fiscal validados. |
| Certificado vinculado | Combo de cadastro com busca | CADASTRO: certificados | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa + Ambiente |
| Usuário | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E12-V06) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

### E12-V07 — Monitoramento e Alertas de Integrações
**Protótipo de referência:** [Abrir Monitoramento e Alertas de Integrações](index.html#E12-V07) · **Localização:** ADMINISTRAÇÃO → Integrações • saúde · **Acesso por função:** administrador e responsável de integração.
**Ação primária e governança:** Configurar serviço. Justificativa: obrigatória. Efeito externo exige confirmação/revisão de estado. Voltar mantém filtros e rascunho (com aviso quando houver mudanças).
**Datagrid específico:** `Integração vinculada` · `Instituição ou órgão` · `Serviço contratado` · `Situação` · `Certificado vinculado` · `Validade do certificado`. Ordenação por Integração vinculada, Instituição ou órgão, Serviço contratado, Certificado vinculado, Validade do certificado, default Integração vinculada. Seleção individual contextual. Paginação server-side e persistência de filtro/ordenação. Sem colunas técnicas.
**Filtros:** Instituição ou órgão (Combo de cadastro com busca); Serviço contratado (Combo de cadastro com busca); Situação (Combo fechado (enum)). Buscar nomes, descrições e referências de negócio, nunca GUID.
**Navegabilidade e estados:** retorna ao filtro, ordenação e posição anteriores; preserva rascunho sob confirmação. Destino relacionado: Catálogo de Integrações. Estados contemplados: inicial, carregando, sem registros, validação inválida, sem acesso, conflito concorrente, serviço externo indisponível, revisão pendente, concluído com evidência.
**Regras de negócio:** segredo nunca aparece em log; alarme rastreável e sem sucesso falso.
**Exceções e resposta UX:** cert vencido, API indisponível, falha webhook, layout fora vigência, job parado. Falha não apaga rascunho, impede confirmação incorreta, informa causa e ação de correção.
**Fluxos e comandos específicos:** inspecionar evento, reconhecer alerta, pausar integração, consultar reprocessamento, emitir relatório.

| Campo exibido | Componente | Fonte de dados permitida | Dependências, validação e comportamento |
|---|---|---|---|
| Instituição ou órgão | Combo de cadastro com busca | CADASTRO: provedores | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Integração vinculada | Combo de cadastro com busca | CADASTRO: integracoes | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Instituição ou órgão + Ambiente |
| Serviço contratado | Combo de cadastro com busca | CADASTRO: servicos | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Certificado vinculado | Combo de cadastro com busca | CADASTRO: certificados | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Empresa + Ambiente |
| Validade do certificado | Campo derivado somente leitura | Entrada ou cálculo do domínio | Valor de origem externa ou calculado pelo backend; nunca digitável ou usado como identificador visual.; somente leitura |
| Agendamento | Combo de cadastro com busca | CADASTRO: jobs | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado.; depende de Integração vinculada |
| Usuário | Combo de cadastro com busca | CADASTRO: usuarios | Selecionar somente cadastro ativo, filtrado por empresa/estabelecimento; valor interno invisível; não aceitar GUID digitado. |
| Situação | Combo fechado (enum) | ENUM: status | Selecionar somente alternativas canônicas; a seleção nunca aceita texto livre. |
| Justificativa auditável | Texto longo com auditoria | Entrada ou cálculo do domínio | Campo formatado com limite de caracteres e normalização; se código fiscal, sempre explicação amigável. |

**Especificação e conclusão da task:** desenvolver interface completa seguindo [Caderno B](../../expansao-erp-2026/B-ESCOPO-NOVOS-MODULOS-ERP.md), [contrato do layout](index.html#E12-V07) e testes de domínio; protótipo não substitui homologação de serviço externo. **Requisito inverso:** não expor IDs, não permitir texto livre para enum/cadastro, não criar segundo cadastro/ledger/job/credencial.

## Regras adicionais por agrupamento
**Fiscal / NF-e:** operações/CFOP/CST/cBenef/cClassTrib vêm de tabelas vigentes; cada combo exibe descrição + código oficial quando legalmente necessário. Vincular documento a pedido/carga/cliente/estabelecimento com contexto e ações de retorno. Documento autorizado tem protocolo legal, não GUID.
**Financeiro:** títulos apontam para cliente ou fornecedor ativo, documento de origem e parcelas; moeda exata, dataPicker de vencimento, simulação de juros/desconto limitada à alçada; baixa depende de evidência bancária.
**Bancos:** banco→conta→convênio→carteira obrigatoriamente vinculado; API e arquivo observam o mesmo pagamento, mantendo múltiplas evidências sem duas baixas; layouts definidos por serviço e convênio.
**Contabilidade:** contas analíticas selecionadas no plano, centro de custo no cadastro, períodos em calendário fiscal; não permitir lançamento desbalanceado, duplicado ou em competência fechada.
**Certificados e integrações:** empresa→estabelecimento→serviço→certificado, formato A1, upload, máscara, validade, privilégios, rotação e serviço oficial selecionado. Certificados PFX/PEM privados cifrados no PostgreSQL com DEK AES-256-GCM e KEK fora do DB sob AWS KMS, senha temporária. O protótipo não processa arquivos reais.
**Jobs:** formulário com combo de operação e frequência (padrões amigáveis; cron técnico gerado pelo backend), timezone, checkpoint interno oculto na UX padrão, status e reprocessamento seguro. Não exigir que o operador digite SQL, cron bruto ou IDs internos.

## Observação para Kiro e revisão
Os rótulos, regras de filtros e fontes neste documento são base funcional obrigatória para as issues já criadas. Diferenças de terminologia, entidade atual na develop e protótipo deverão ser resolvidas na avaliação CROSS antes da implementação, **não** pela invenção de inputs ou criação de novo cadastro duplicado. Confirmar com Quality Owner se um domínio antes apresentado como textarea já é entidade cadastrada; converter em lookup e atualizar o contrato.
**Dados demonstrativos:** todos os exemplos da aplicação são fictícios; nenhum certificado, credencial ou XML real foi incorporado ao protótipo. A matriz exige testes E2E reais em backend homologado posteriormente.