# Kiro — comando idempotente para executar a expansão ERP AlphaCarnes E2E

Copie integralmente o bloco abaixo para uma sessão do Kiro no repositório `sammuka/alpha-carnes`. Ele instrui a execução real por agentes e subagentes, com retomada segura e crítica independente obrigatória. A criação deste comando não aprova plano, implementação, integração externa ou merge.

```text
Execute e retome a expansão ERP AlphaCarnes E01–E12 ponta a ponta, utilizando agentes e subagentes reais. Trabalhe até concluir o escopo autorizado e verificável, ou identificar um bloqueio concreto. Não entregue apenas um plano. Este mesmo comando pode ser reaplicado: descubra e retome o estado existente, sem recriar tarefas, PRs, documentos, migrations ou efeitos de negócio.

REGRA PRINCIPAL DE REVISÃO
Depois de CADA implementação, fatia integrada ou correção de código, invoque obrigatoriamente um NOVO subagente crítico independente com modelo forte. Ele deve inspecionar o SHA exato, executar verificações próprias, procurar falhas e devolver achados acionáveis. O implementador e o coordenador nunca substituem esse subagente por autoavaliação. Relatos de outros agentes são hipóteses até reprodução. Mudança posterior no código invalida a aprovação do SHA anterior e exige nova revisão. Nenhum item pode ser declarado concluído apenas porque o Worker disse que terminou.

1. RECONHEÇA O AMBIENTE E AS CAPACIDADES

Identifique primeiro a superfície e versão reais do Kiro, ferramentas disponíveis, agentes configurados, modelos efetivamente acessíveis, Git/GitHub, Linear, PostgreSQL, ambiente de teste e browser. Use a ajuda/documentação correspondente à instalação; não invente comandos de terminal, nomes de ferramentas, identificadores de modelo ou campos de configuração.

Descubra/reutilize configurações de agentes existentes antes de criar outras. Quando necessário, configure agentes de projeto em .kiro/agents/ conforme o schema da versão instalada, preservando configurações do usuário. Não copie configuração legada incompatível. No CLI V3, confira a migração de permissões e seletores MCP com a documentação atual. Configuração não equivale a execução: prove que a delegação iniciou uma instância independente.

Para Monitores críticos e adversariais, selecione explicitamente o melhor modelo de raciocínio disponível e adequado à revisão. Prefira a versão mais forte de Claude Opus realmente habilitada nessa conta/superfície; se indisponível, use outro modelo forte verificado, por exemplo a opção GPT Sol de maior capacidade disponível. Use esforço de raciocínio alto quando suportado. Não fixe um model ID com base em memória ou neste texto. Registre no laudo o modelo solicitado, o modelo efetivo confirmado pela plataforma e o esforço utilizado. Se a plataforma não permitir confirmar o modelo efetivo, declare-o desconhecido e bloqueie a certificação da revisão forte; não alegue que a preferência foi aplicada. Fallback silencioso para modelo padrão é inválido. Reconfigure e reinvoque um Monitor novo quando houver fallback incompatível.

Se a instalação não oferecer delegação independente ou um modelo forte para revisão, registre requires-human com a capacidade ausente e a configuração necessária. Não simule subagentes no mesmo contexto e não assuma o papel deles. Não altere permissões globais para contornar restrições.

2. RECUPERE AS FONTES E O ESTADO REAL ANTES DE ESCREVER

Localize o checkout correto e leia AGENTS.md do repositório e de diretórios afetados. Respeite integralmente a separação de papéis. Leia na ordem de precedência:
  a) docs/governance/constituicao.md;
  b) docs/execucao/DECISOES.md, incluindo AD-04, AD-10, AD-15 e AD-18;
  c) docs_v2/alphacarnes_contexto_funcional_e_recomendacoes_prototipo_v1.1.md;
  d) protótipo operacional sammuka/alpha-carnes-prototipo, branch main, e referência visual DS v3 da AD-10;
  e) docs/governance/roadmap-canonico.md, plano mestre, matriz de rastreabilidade, docs/governance/pipeline-execucao.md e quality-gates.md;
  f) docs/expansao-erp-2026/README.md, A-ESCOPO-EXISTENTE-DEVELOP.md, B-ESCOPO-NOVOS-MODULOS-ERP.md e C-PROPOSTA-COMERCIAL-ERP.md;
  g) docs/expansao-erp-2026/10-BACKLOG-KIRO-TESTES.md, 11-E11-FALLBACK-BANCARIO-ARQUIVOS.md, 12-AVALIACAO-CROSS-ARQUITETURA-BANCARIA.md, 20-CATALOGO-OFICIAL-INTEGRACOES-OUT-2026.md, 21-FONTES-BANCARIAS-ONBOARDING-E-LAYOUTS.md, 22-ARQUITETURA-INTEGRACOES-CERTIFICADOS-BATCH-CADASTROS.md, 23-CROSS-IMPACTO-E12-PLANO-KIRO.md e 24-ADR-COFRE-POSTGRES-KMS-MENU-13-GRUPOS.md;
  h) docs/prototipos/erp-integrado-v1/index.html, catalogo.js, componentes.js, contratos-dominios.js quando existente, MATRIZ-INTEGRAL-INTERFACES.md, MATRIZ-UX-COMPONENTES-61-TELAS.md, RASTREABILIDADE-TAREFAS.md, ROTEIROS-DE-VALIDACAO.md, RECUPERACAO-DO-TRABALHO.md e RELATORIO-COMPLETUDE-E-EVIDENCIAS.md, quando existentes;
  i) skills .agents/skills/gate-plano/SKILL.md, gate-pr/SKILL.md, disparar-onda e demais skills de execução realmente existentes;
  j) docs/execucao/EXECUCAO-STATUS.md, GATE-VEREDITOS.md, planos táticos autoritativos, commits, PRs, testes, CI e evidências atuais.

Não escolha um plano por ser o arquivo mais recente: resolva-o pelo registro autoritativo de execução. Fonte obrigatória ausente, conflito com régua superior ou decisão de produto pendente é bloqueio, não permissão para inventar. Caso o clone do protótipo operacional seja necessário, use o repositório privado autorizado e configure ALPHACARNES_PROTOTYPE_PATH conforme AGENTS.md. Não publique esse repositório para conseguir acesso. Sem a referência exigida, a onda com UI fica requires-human.

Consulte o PR documental existente #157, https://github.com/sammuka/alpha-carnes/pull/157, branch feature/erp-fiscal-financeiro-contabil-especificacoes-2026, com destino develop, e descubra sua revisão ATUAL. Não suponha que ele foi mergeado, que seu conteúdo está em develop ou que todos os protótipos foram aprovados. Recupere documentação da branch quando necessário, mantendo a proveniência. Não implemente aplicação real dentro desse PR documental nem o mergeie para liberar dependências. Preserve trabalho em andamento de outros agentes e alterações preexistentes do usuário.

Recupere no Linear o projeto AlphaCarnes — Expansão ERP Fiscal, Financeiro e Contábil da equipe ALP. Leia descrições COMPLETAS, relações, bloqueios, estado e vínculos de todas as 86 issues existentes: 12 épicos e 74 subtarefas. Não use snippets como contrato completo. Inventário de referência, a confirmar na consulta atual:
  E01: pai ALP-100, tarefas ALP-110..114 — cadastros/motor tributário;
  E02: pai ALP-101, tarefas ALP-115..119 — NF-e 55 SEFAZ/SP;
  E03: pai ALP-102, tarefas ALP-120..123 — entrada DF-e/devoluções/custos;
  E04: pai ALP-103, tarefas ALP-124..128 — contas a pagar/despesas;
  E05: pai ALP-104, tarefas ALP-129..132 — contas a receber/cobrança;
  E06: pai ALP-105, tarefas ALP-133..137 — APIs bancárias;
  E07: pai ALP-106, tarefas ALP-138..141 — conciliação;
  E08: pai ALP-107, tarefas ALP-142..145 — tesouraria/caixa;
  E09: pai ALP-108, tarefas ALP-146..154 — contabilidade/tributos/SPED;
  E10: pai ALP-109, tarefas ALP-155..158 — complementos operacionais/UX;
  E11: pai ALP-159, tarefas ALP-160..171 — arquivos/fallback; ALP-160 é E11-T00 CROSS;
  E12: pai ALP-172, tarefas ALP-173..185 — fundação de integrações; ALP-173 é E12-T00 CROSS.

Não crie novas issues ou novos pais para substituir esses itens. Se o inventário vigente divergir, explique a divergência e use as relações verificadas, sem renumerar silenciosamente. Protótipo pronto não transforma task de backend, integração, homologação ou gate CROSS em Done.

3. OPERE DE FORMA IDEMPOTENTE, CONCORRENTE E RETOMÁVEL

O Executor deve inventariar origin/develop, HEADs de branches e PRs, worktrees, diff/stash preexistentes, migrations aplicadas, versões de schema, checkpoints, locks, gates com seus hashes, CI por SHA e tarefas concluídas/ativas. Não faça reset --hard, clean destrutivo, force-push, exclusão de branch/worktree ativa ou reescrita de histórico.

Use a infraestrutura de lock/checkpoint já existente. Adquira o lock coordination nas operações de coordenação exigidas pelas skills, com run-id e papel reais, e libere em finally. Locks por tarefa e ownership de arquivos impedem dois Workers de escreverem o mesmo artefato. Lease vencido não permite roubar trabalho ativo: verifique o titular, processos, PR, checkpoint e revisão antes de recuperar o lock; use fencing token quando suportado. Não mantenha lock global durante todo o desenvolvimento.

O Executor mantém um checkpoint por issue/onda/fase em .codex/runtime/ com escrita atômica e schema versionado, sem commitá-lo. Registre: repo, issue, onda autoritativa, operação, run-id, agente/papel/modelo, base SHA, branch/worktree/PR, hash do plano, hash dos critérios, SHA dos artefatos, gates, testes/CI, bloqueios e próximo passo. Estado durável vem de Git/PR, EXECUCAO-STATUS, vereditos e evidências versionadas; checkpoint efêmero sozinho nunca prova conclusão.

Use operation-id estável para a MESMA intenção, derivado de repositório + issue + operação + versão/hash dos critérios; não use apenas timestamp ou um novo run-id. Antes de toda mutação externa, consulte se essa operation-id ou efeito equivalente já existe. Após interrupção entre envio e resposta, consulte o resultado real antes de repetir. Checkpoint de intenção antes e resultado depois, com expected SHA/version. Não marque succeeded antes de verificar o efeito.

Na retomada, reconcilie o checkpoint com GitHub, Linear, arquivos, banco e CI atuais. Reutilize branch, PR, plano e artefatos existentes quando correspondem à mesma operação. Se o HEAD avançou, integre normalmente e refaça verificações afetadas. Não publique a árvore de um checkout parcial sobre a árvore completa remota. Não aplique novamente migration já registrada, seed de negócio ou comando financeiro sem chave idempotente e confirmação do estado.

Considere concluído somente o que possui critérios atendidos, testes reproduzíveis e gates válidos para hashes atuais. Revalide conclusão anterior se houve mudança de contrato, dependência, schema, código relevante ou evidência vencida. Não refaça trabalho comprovadamente vigente apenas para gerar novos commits. Não duplique seções documentais: encontre pela chave da task/operação e atualize a seção correspondente.

Em atualizações Linear, releia descrição integral, updatedAt/version e relações imediatamente antes de gravar; preserve requisitos originais, autorias, links e dependências. Acrescente/atualize um único bloco identificável de contrato/evidência por operação. Releia e confira depois. Se não existir CAS/expected-version, serialize as gravações sob lock e compare o conteúdo atual; aborte a gravação em conflito e reconcilie sem sobrescrever alteração humana. Não envie comentários repetidos nem feche item com gate pendente.

4. RESPEITE OS PAPÉIS E A SEQUÊNCIA OBRIGATÓRIA

Você, agente raiz, é SOMENTE coordenador: delega, mantém o DAG de execução em memória, transmite contratos e consolida fatos. Não escreve plano, código, estado ou veredito.

  Planner: escreve um plano tático autossuficiente em docs/superpowers/plans/; nunca implementa, audita ou altera estado.
  Monitor: somente append em docs/execucao/GATE-VEREDITOS.md; não corrige plano/código nem muda status. Instância nova em cada Portão 1, Portão 2, rodada de crítica e Portão A.
  Worker: código/testes/documentação de implementação nos paths aprovados do worktree e PR; não decide produto, audita, mergeia nem escreve docs/execucao/.
  Executor: worktrees, estado/checkpoint/EXECUCAO-STATUS e operações Git/PR/merge permitidas; não escreve código de produto, plano ou veredito. Pode incluir GATE-VEREDITOS byte a byte em commit sem editá-lo.

Identifique ondas pela governança vigente; os 12 épicos não equivalem automaticamente a 12 ondas ou 12 PRs. O Executor registra a associação issue → onda → plano → branch → PR conforme pipeline, antes do gate. Não invente número de onda ou um veredito formal fora do formato das skills. O Planner não altera o registro de estado.

Para cada onda/fatia com ownership definido:
  a) Planner produz plano completo com escopo, fontes exatas por tela, dependências, arquitetura, contratos/schema/endpoints/eventos, paths, tasks executáveis, rollback, DoD → testes 1:1 e critérios de parada.
  b) NOVO Monitor independente executa Portão 1, conforme gate-plano, sobre SHA-256 exato do plano. Só aprovado permite implementação. Plano corrigido exige NOVO Planner e NOVO Monitor de Portão 1.
  c) Executor cria/reutiliza worktree isolado .worktrees/o<N>, branch filha de develop e PR próprio do escopo. Workers implementam conforme o plano. Não escreva no worktree coordenador ou diretamente em develop/main.
  d) Após CADA entrega/correção de Worker, invoque imediatamente NOVO Monitor crítico forte sobre o commit entregue. Se uma fatia ainda não satisfaz pré-condições do Portão 2, a crítica é verificação preliminar e NÃO aprovação de gate; registre esse limite. Corrija achados com Worker e repita em nova instância. Não avance uma dependência baseada em revisão preliminar.
  e) Para a implementação integrada, NOVO Monitor forte executa Portão 2 completo conforme gate-pr, em worktree de auditoria separado e destacado no head SHA real do PR. Exige Portão 1 vigente e CI completo. Aguarde o resultado, não apenas o início do subagente.
  f) Depois do Portão 2 aprovado, OUTRO Monitor forte novo realiza revisão adversarial Portão A, com casos e sequência diferentes e decisão própria antes de ler veredito anterior da mesma rodada.
  g) Executor pode integrar APENAS se existir autorização explícita de merge do usuário aplicável ao PR/SHA/escopo, Portões 2 e A aprovados sobre o mesmo HEAD atual, plano vigente e oito jobs verdes desse SHA. Sem autorização de merge, deixe o PR aberto e reviewable e continue trabalho independente. Este comando autoriza execução/desenvolvimento e criação/atualização de PRs, NÃO concede autorização genérica para merge/deploy/produção.

Modelo de ordem ao subagente crítico, a ser enviado de verdade após cada implementação/correção:

“Use o agente Monitor crítico independente configurado com modelo forte verificado. Audite a implementação da issue/onda indicada no commit SHA exato fornecido, em worktree de auditoria separado. Não edite o produto. Forme sua conclusão antes de ler o veredito anterior desta rodada. Leia as réguas, o plano/hash e os contratos completos; inspecione o diff, execute verificações próprias e ataque fluxos felizes, negativos, concorrência, replay, permissões e falhas externas. Teste UI → API → PostgreSQL → eventos → UI, não só presença de arquivos ou status de teste. Reproduza achados com comandos e dados sintéticos; confira efeitos colaterais, saldos, histórico e ausência de sucesso falso. Informe severidade, arquivo/local, reprodução, impacto, critério violado, correção esperada e teste necessário. Compare o protótipo correspondente/DS v3 e registre limites reais de browser/homologação. Não aceite relatório do Worker como prova. Retorne modelo solicitado/efetivo, plano-sha256, SHA inicial/final, testes próprios, veredito aprovado/ajustar/bloqueado e bloqueios. Só registre Portão 2 se todas as suas pré-condições foram atendidas; revisão preliminar não libera merge. Preserve histórico e faça append do veredito formal sob lock quando cabível. Se o HEAD mudar, a rodada é inválida.”

5. APLIQUE AS DEFINIÇÕES JÁ RATIFICADAS

Stack e arquitetura reais: Node 22/npm workspaces, NestJS 11/TS strict, Next.js 16 App Router/BFF, PostgreSQL 18/Drizzle, Zod 4, WebSocket nativo, JWT/RBAC. Siga convenções existentes; nenhuma troca de stack, microserviço, CQRS ou motor genérico duplicado sem decisão.

Preserve as 39 rotas operacionais canônicas da AD-15, a ordem relativa dos nove grupos originais e os 11 perfis da AD-04. AD-18 permite exatamente 13 grupos, na ordem do ADR-ERP-024: Comercial; Gestão; Recebimento & Balança; Desossa; Estoque; Carga; Faturamento; Fiscal; Financeiro; Bancos & Tesouraria; Contabilidade; Cadastros & Regras; Administração. E12 fica em Administração → Integrações. Personas demonstrativas não criam novos perfis/seed reais.

As 61 interfaces novas têm contratos completos: E01=5, E02=5, E03=4, E04=5, E05=4, E06=5, E07=4, E08=4, E09=9, E10=4, E11=5 views, E12=7 views. Views E11/E12 não equivalem a suas 12/13 tasks. Não implemente CRUD genérico, UI mínima, botões que só mostram descrição, seleção manual de status fingindo operação, nem campos soltos para relacionamentos/enums. Preserve layouts, hierarquia, densidade, tokens DS v3, abas, ações específicas, modais, estados, microcopy e fluxo ratificados. Leia o arquivo real do protótipo por tela antes de implementar e cite-o no plano. Não declare aprovação visual sem comparação executada.

Combos pesquisáveis, enums rotulados, banco → conta → convênio → carteira/serviço, UF → município e NCM → CEST devem respeitar dependências, empresa/estabelecimento/ambiente, limpar filhos incompatíveis e preservar edição. Datepickers, filtros/sort/paginação do grid, seleção estável, volta/contexto e rascunho devem funcionar com API/dados reais. Valide valores BRL como 123,45, 1.234,56 e 0,01, pesos e arredondamento conforme contrato. Não exponha UUID/GUID, PK, tenantId, secretRef, rowId, códigos E##/ALP ou numeração artificial em texto visível, tooltip, aria-label, toast, timeline, impressão ou exportação. Identificadores fiscais e bancários legais continuam contextualizados quando necessários.

NF-e modelo 55 direta SEFAZ/SP é distinta da NFS-e/EISS Osasco existente; preserve gateway/fluxo EISS e legado. Não acrescente outros modelos fiscais, bancos, folha/eSocial ou formatos não homologados fora do escopo. Regras legais, alçadas, método de custo, regime e capability pendentes não são inventados: respeite parâmetros/badge Provisório e gates humanos aplicáveis. Normas/URLs/layouts oficiais devem ser verificados na data de implementação; fonte baixada, versionada e aprovada não altera regra em produção automaticamente.

Bradesco, Itaú e Santander entram desde o início com APIs e fallback CNAB/OFX/CSV homologado no MESMO motor de transação econômica, conciliação e razão. Uma observação de API e uma de arquivo podem ser duas evidências de um fato; não são dois créditos. Chave fraca por valor/data nunca faz auto-match. Importação não prova pagamento; remessa não prova registro; retorno de registro não prova liquidação. E11 não cria contas, títulos, ledger ou conciliação paralelos. Preserve owners definidos nos pareceres CROSS.

E12 é fundação única de perfis/endpoints/certificados/segredos/jobs/referências para os consumidores; não duplique em E02/E06/E11. Parâmetros operacionais e agenda vivem em PostgreSQL/UI. .env só mantém bootstrap técnico inevitável/injeção de infraestrutura; não remover env existente abruptamente nem acrescentar configuração fiscal/bancária/certificados/cron operacional.

Cofre AD-18: criptografia no backend AES-256-GCM, nonce nova por cifragem, AAD/contexto autenticado, DEK aleatória por segredo/versão, DEK cifrada armazenada junto do ciphertext PostgreSQL e KEK externa não exportável AWS KMS via IAM. Nenhuma chave mestra no DB, .env, frontend ou repo; nenhum secret em parametros.valorJson, logs, auditoria before/after ou export. Upload A1 PFX/P12 e CRT/KEY/CSR bancário conforme serviço real; senha transitória write-only, chave privada nunca devolvida/baixada. A3 não é upload batch autônomo. Validar titular/empresa/ambiente, validade, cadeia, privada/pública, key usage, revogação, binding/rotatividade e restore. Upload/teste não ativa produção automaticamente.

Jobs backend executam sem sessão do operador, por identidade técnica de menor privilégio; configuração/certificado pinados por run, checkpoint, lease/fencing, retry/backoff e reprocessamento idempotente. UI recebe eventos pós-commit; não introduza polling de frontend. Revogação/expiração suspendem novas operações. Reconhecer alerta não corrige causa nem marca saúde falsa.

6. EXECUTE O DAG SEM PULAR OS GATES CROSS

Primeiro, recupere aprovações reais e pendências de ALP-173/E12-T00 e ALP-160/E11-T00. Parecer técnico documentado NÃO prova homologação/aceite externo concluído.

  - E12-T00/ALP-173 precede migrations/contratos da fundação e implementação de adapters, credenciais e jobs que dependem dela. Examine impacto E01..E11, referência oficial, cofre/KMS/identidade, UI e ownership, sem tabelas redundantes.
  - E11-T00/ALP-160 precede congelamento de schema bancário e E06/E07/E08/E11: contas/convênios/carteiras/serviços reais, API/formatos/versões, dedupe, capabilities e aprovação CROSS. E04/E05 independentes podem avançar se não congelarem contrato bancário ainda pendente.
  - Depois das dependências aprovadas: fundação fiscal E01-T01, plano de contas E09-T01, contas E06-T01, canonicalização E11-T01 e blocos pertinentes E12; em seguida motor E01-T02..T05.
  - E02-T01..T05 depende da base fiscal/certificados; emissão real requer parecer fiscal/SEFAZ e homologação aplicáveis.
  - E03-T01..T04 cobre XML/DF-e, conferência Pedido × NF × Pesagem, devolução e custo aprovado.
  - E04-T01..T05 e E05-T01..T04 cobrem obrigações/recebíveis, parcelas, retenções, recorrência, cobrança, renegociação, baixa e reversão.
  - E06-T02..T05 e E11-T02..T08 cobrem os três bancos/API e arquivos na arquitetura única, sem fallback adiado para fase 2.
  - E07-T01..T04, E08-T01..T04 e E11-T09..T11 cobrem conciliação, tesouraria, provenance/dedupe e homologação cruzada.
  - E09-T02..T09 cobre contabilização, livros/relatórios, apuração, inventário/CMV, SPED aplicável, fechamento/reabertura e exportações.
  - E10-T01..T04 integra pontos operacionais e checklist fiscal sem refazer compras/pedidos/pesagem ou quebrar EISS.
  - E12-T01..T12 integra schema/cofre/upload/7 views/catálogos/jobs/migração controlada/observabilidade/jornadas, colocando cada dependência antes do consumidor, sem esperar terminar consumidores para criar sua fundação.

Planner deve montar DAG task a task com dependências verificadas no Linear/código/documentação. Paralelize somente tarefas realmente independentes, com ownership exclusivo de paths e contratos compartilhados estáveis. Cada entrega preserva fatia E2E completa; não reduza feature a tela parcial para caber numa onda. Se faltar aprovação externa, pare apenas o ramo dependente, registre blocker e continue ramos autorizados independentes. Não declare o épico inteiro completo com esse ramo pendente.

7. IMPLEMENTE E PROVE A FATIA REAL UI → API → POSTGRESQL

Backend decide regras críticas e autorização; frontend não é fonte de verdade para saldo, bloqueio, baixa, lançamento ou fechamento. Mutação crítica é transação com auditoria, concorrência/versionamento apropriados, inbox/outbox quando previsto, evento pós-commit e história append-only. Rede externa ocorre fora da transação de negócio, com reconciliação por recibo/chave antes de repetir. Não grave sucesso sem confirmação real do gateway.

Drizzle migrations geradas, reversíveis e incrementais expand → backfill → contract conforme conventions/schema atual; sem ALTER manual, DELETE físico ou seed destrutivo de dados reais. Dinheiro NUMERIC/strings/decimal apropriado, jamais float para invariant financeira; peso/quantidade com escala e regra explícita. Identificadores CNPJ, inclusive alfanuméricos conforme referência aplicável, são strings.

Exija, em cada task, testes unitários relevantes, integração PostgreSQL 18 real em ambiente isolado, autenticação/tenant/RBAC e 403, concorrência de duas requisições, replay, restart e falhas do gateway fake determinístico. Testes não podem reimplementar o algoritmo para passar: chamam handlers/services/API reais e consultam efeitos no DB. Backend services de domínio atendem cobertura ≥80% de linhas e branches. Use fakes determinísticos de integrações no CI; CI nunca contata banco, SEFAZ, EISS ou KMS de produção.

Execute E2E frontend em browser legitimamente disponível, com usuário/permissões, API e PostgreSQL de teste; confira eventos e reação da segunda sessão/tela. Teste também acesso direto, edição/reload, contextos, hierarquia de combo, paginação, dirty navigation, foco/teclado, estados vazios/loading/erro/conflito/sem acesso e screenshots comparativos DS v3/protótipo. Browser ausente/bloqueado é limitação/bloqueio do gate correspondente; VM/DOM e CSS estáticos não substituem prova visual/browser nem implantação real. Não contorne políticas de URL/acesso para obter screenshots.

Inclua todas as jornadas JB-01..JB-08, J01..J08 da matriz/roteiros e XB-01..XB-16 de E11, sem excluir caso por caber em uma lista menor. Prove no mínimo:
  compra/XML/conferência/AP/pagamento confirmado/conciliação/partida;
  venda/carga/NF-e autorizada/AR/parcelas/boleto/liquidação/contabilização;
  devolução parcial/crédito/abatimento/estorno sem perder original;
  tesouraria prevista × realizada/transferência com origem e destino/tarifa/liquidez;
  lançamento multilinha D=C/razão/relatórios/apuração/SPED/período fechado/reabertura autorizada;
  certificado/upload/binding/rotação/revogação/configuração/job/restart/alerta;
  regra fiscal versionada/vigência/simulação/segregação/aprovação/histórico;
  API timeout → consulta antes de reenvio/fallback arquivo/failback/provenance sem dupla baixa ou razão.

Negativos obrigatórios: datas invertidas, autor autoaprovando, parcelas divergentes, lançamento desbalanceado, período fechado, crédito/baixa excedente, transferência origem=destino, segredo vazando, certificado vencido/revogado/incorreto, token/CA incorretos, layout/header/trailer inválidos, duas transações legítimas mesmo valor/data, duplicidade API/arquivo, reprocessamento concorrente, timeout com confirmação posterior, exportação com ID interno e operação sem permissão/fora de tenant. Falha deve preservar consistência, tornar erro observável e não produzir efeito falso.

Execute os comandos de validação reais de AGENTS/plano e os adicionais por risco. No Windows, use pwsh 7; não invoque bash. No Linux, use o shell disponível. Os oito jobs obrigatórios do SHA atual são lint, type-check, test-backend, coverage, test-frontend, build, audit e secret-scan. Pending, skipped ou verde em SHA antigo não aprova. Vercel só é gate quando o diff toca landing/**. Não altere audit, cobertura ou CI para esconder falha. Não torne repo público nem habilite lease de visibilidade sem autorização explícita aplicável; se o gate depende disso sem autorização, registre o bloqueio sem contorno.

8. REPITA CORREÇÃO → CRÍTICA NOVA → GATES VIGENTES

Para achado reproduzível, envie ao Worker responsável o caso, critério, fix esperado e regressão. Para falha de plano, delegue a NOVO Planner e reinicie Portão 1. Após cada correção de código, invoque NOVO Monitor forte; ninguém reaproveita aprovação do commit anterior. A revisão adversarial final também é nova e não pode ser realizada pelo implementador ou pelo Monitor do Portão 2.

Limite ciclos automáticos de correção sem progresso conforme workflow instalado; não invente sintaxe de loop incompatível com Kiro. Se repetir a mesma falha, houver decisão de domínio ausente, ferramenta obrigatória indisponível ou dependência externa não obtida, registre o ponto preciso, tentativas/evidências e próximo passo humano. Nunca encerre o item como concluído para sair do loop.

Antes de qualquer merge autorizado, o Executor releia HEAD do PR, base, hash do plano, dependências, os dois vereditos por SHA, oito checks desse SHA, estado de revisão/proteções e autorização aplicável. Mudança em qualquer pin exige repetir a validação relevante. Use operação normal com expected SHA; sem force-push ou push direto em develop/main. Em conflito, preserve avanço concorrente, integre normalmente e repita os gates afetados. Merge autorizado de um PR não autoriza deploy, ativação de banco/SEFAZ, migração em produção ou execução de pagamento.

9. DOCUMENTE O RESULTADO VERDADEIRO E RETOME AUTOMATICAMENTE

O Executor atualiza estado somente com prova atual. Worker mantém contratos/OpenAPI, runbooks, matrizes de UI/UX, DoD → testes e vínculos issue/PR/SHA coerentes; Monitor mantém vereditos append-only. DECISOES/Constituição só mudam por decisão explícita do Quality Owner; não fabrique emenda. Preserve descrições originais Linear e o histórico documental.

Distinga sempre: contrato especificado; protótipo simulado verificado; aplicação real implementada/testada; integração homologada; merge efetuado; produção autorizada/ativada. UI/fake/pronto local não provam homologação ou produção. Gate externo pendente impede Done da task que o exige. Tasks cuja definição é somente desenvolvimento podem ter seu estado ajustado apenas pelos critérios/status reais do projeto e com dependência externa explícita; nunca feche épico por contagem de telas.

Ao terminar uma fatia, selecione a próxima task elegível pelo DAG, consulte estado atual e repita o rito sem pedir confirmação rotineira já autorizada. Não envie mensagens a terceiros, operações fiscais/bancárias reais, exposição de repositório ou alteração destrutiva sem autorização explícita. Pergunta humana só quando informação/decisão indispensável não foi definida, ou uma ação adicional exigir autorização; apresente o resultado concreto e a origem exata do bloqueio.

Saída de cada rodada: issue/épico/onda; fase; agentes e modelos solicitados/efetivos; plano/hash; base/head SHAs; branch/worktree/PR; paths; funcionalidades reais; testes executados/resultados; provas E2E/DB/visual; CI por SHA; Portões 1/2/A vigentes; achados e correções; status Linear antes/depois; homologações/autorizações pendentes; checkpoint e próximo passo. Saída final resume o que foi implementado e validado, o que permanece bloqueado e por quê, com links e comandos reproduzíveis. Não reporte conclusão sem evidência.

COMECE AGORA: recupere ambiente/fontes/estado e delegue o diagnóstico/plano do próximo ramo elegível. Em seguida execute a sequência autorizada. Depois de cada implementação ou correção, chame efetivamente o subagente crítico forte, aguarde seu laudo, corrija e repita até os critérios e gates aplicáveis estarem satisfeitos.
```

Referências oficiais do Kiro consultadas em 12/10/2026 UTC (11/10/2026 em São Paulo): [Custom agents](https://kiro.dev/docs/custom-agents/), [Invoking as sub-agents](https://kiro.dev/docs/custom-agents/subagents/) e [Models](https://kiro.dev/docs/models/). O comando exige descobrir a configuração e os modelos da instalação para permanecer aplicável sem depender de um identificador fixo ou schema antigo.
