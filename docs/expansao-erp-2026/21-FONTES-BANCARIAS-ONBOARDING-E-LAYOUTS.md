# AlphaCarnes — Bradesco, Itaú e Santander | APIs, credenciamento, arquivos e homologação
**Pesquisado em 11/10/2026**. Complementa [catálogo oficial](20-CATALOGO-OFICIAL-INTEGRACOES-OUT-2026.md) e [E11 fallback](11-E11-FALLBACK-BANCARIO-ARQUIVOS.md). Fonte bancária por **produto, conta, convênio, carteira, ambiente e capability**. Nenhum endpoint genérico suposto substitui especificação OpenAPI disponível na área logada. Bancos contratam e aprovam acesso fora da aplicação; AlphaCarnes administra credenciais e configurações **dentro** da aplicação.

## 1. Modelo de capacidades (fonte de verdade única)
`institution=(BRADESCO|ITAU|SANTANDER)`, `bankAccountId`, `legalEntityId`, `contractReference`, `wallet`, `service`, `environment`, `channel=(API|FILE)`, `status=(draft|awaiting_bank|awaiting_documents|ready_hml|hml_tested|awaiting_business_approval|active_prod|suspended|expired)`; documentos oficiais/versionamento em `integration_reference_versions`.
Serviços independentes: **boleto registro, consulta boleto, alteração/cancelamento, boleto com Pix, liquidacao/retorno cobrança, saldo, extrato, pagamentos a terceiros, PIX cobrança, PIX pagamentos, DDA, webhook**. Habilitar **cada capability** somente quando contrato, credencial e teste provarem suporte. Aprovação da capability API não autoriza remessa CNAB com outra carteira.
O monitor de contratos exibe `canal primário API → fallback FILE` somente onde arquivo foi homologado. Disponibilidade de API para boleto não significa API extrato. Não habilitar DDA só porque o banco oferece no internet banking.

## 2. Bradesco
### Fontes oficiais
- [Portal corporativo oficial das APIs — Bradesco](https://api.bradesco/openapis): catálogo de API, saldo/extrato, Pix, TED, cadastro portal, assinatura, aplicação, credencial com upload da parte pública de certificado, sandbox/produção. Confirma **oferta do produto**; disponibilidade depende de contrato.
- [Validador Universal Bradesco e biblioteca de layouts](https://wspf.bradesco.com.br/wsValidadorUniversal/): menu oficial de arquivos Multipag, cobrança 400 (agosto/2022), cobrança 240 (dezembro/2024), conciliação 200/MT940, tabela de lançamentos. **Data/versão dos arquivos públicos não equivale à última variante do convênio**.
- [Documentação oficial de API Pix publicada pelo Bradesco](https://assets.bradesco/content/dam/portal-bradesco/pix/assets/docs/api_pix_200.pdf): mostra autenticação OAuth2 client_credentials + mTLS em documentação de PIX **de período anterior**; não usar endpoint do manual antigo para cobrança, saldo ou pagamentos sem documentação do produto vigente.
### Checklist banco para usuário administrativo
1. Criar/obter acesso ao portal e permissão para representar o CNPJ titular; assinar produtos `Cobrança`, `Saldo e Extrato`, `Pix`, `Pagamentos` apenas se usados e contratados. Registrar número da contratação e carteira/convênio.
2. Criar aplicação por ambiente e associá-la a cada produto/capability; gerar credencial/API key/client_id e se aplicável client_secret e certificado público, sempre upload pelo portal do banco, independentemente do upload do PFX privado na aplicação AlphaCarnes.
3. Receber **especificação OpenAPI/Swagger** vigente de cada serviço assinado, contratos webhook, OAuth token endpoint, exigências de certificado, lote de teste e limites. Identificar IDs de operação e idempotency policy.
4. Associar na aplicação banco+conta+serviço+ambiente+app externo, cadastrar segredo via UI protegido, upload certificado privado pela UI, cadastrar endpoint por versão e testar em HML.
5. Para contingência, identificar exatamente layout (ex.: cobrança 240 dez/2024 versus 400 ago/2022) e código de ocorrência. Conciliação 200/MT940 tem contratos próprios e **não entra automaticamente no E11** se não aprovado o layout.
6. Validar retorno de boleto registrado, rejeitado, liquidado, baixado/cancelado, tarifas, estornos. Testar API e arquivos do mesmo pagamento: um ledger.

**Sem evidência pública suficiente** para afirmar payloads/URL de produção mais novos por produto de Cobrança, Extrato, Pagamentos e webhook. Status `PORTAL_LOGADO/HABILITACAO_PENDENTE`.

## 3. Itaú
### Fontes oficiais
- [Como se conectar às APIs](https://devportal.itau.com.br/como-se-conectar-as-apis-itau): roteiro credenciais, certificado dinâmico, primeira chamada.
- [Conheça o Portal Itaú](https://devportal.itau.com.br/conheca-o-portal): **conta e contrato** necessários para o catálogo completo; API reference OpenAPI/Postman disponível na área logada.
- [Autenticação mTLS produção](https://devportal.itau.com.br/autenticacao-documentacao): OAuth2 `client_credentials` + mTLS, credenciais fornecidas pelo contato/API Owner, certificado dinâmico e tokens por requisição/validade do produto. O guia informa **access_token 300 s**, mas parametrizar pelo `expires_in` real e não codificar 300 s em outros bancos.
- [Primeira chamada à API Itaú](https://devportal.itau.com.br/como-fazer-a-primeira-chamada-a-uma-api): certificado de cliente/chave privada, CA, TLS e token. URL genérica de exemplo **não** é endpoint real.
- [Aviso de segurança de mudança da CA e domínios de API em 2026](https://devportal.itau.com.br/api-certificates-expiration-2026): `secure.api.itau` → `secure.gateway.api.itau` e `api.itau.com.br` → `api.gateway.itau.com.br` (janelas 15/09 e 18/10/2026); `api-bin.itau.com.br` → `api-bin.gateway.itau.com.br` (02/11/2026). Banco afirma **não ser necessário substituir certificado mTLS próprio apenas por troca da CA de servidor**. Evitar IP fixo em código; validar cadeia TLS e allowlists.
- [Layout Itaú CNAB400 cobrança — documento público de referência (anterior)](https://download.itau.com.br/bankline/cobranca_cnab400_mensagem.pdf). Exigir manual/layout **atual** do convênio antes de implementar parser/remessa; antigo não define versão corrente.
### Checklist operacional
1. Administrador cria conta do portal; comercial habilita produtos e convênios (cobrança, extratos, pagamentos, Pix/DDA conforme elegibilidade). API Reference é autenticado; solicitar **export OpenAPI 3/Postman de cada serviço habilitado**, sem segredos.
2. Receber `client_id`/dados de ativação, atender geração/assinatura **de certificado dinâmico do Itaú** e importar par certificado+chave privada na UI do AlphaCarnes ou CSR pela UI quando o banco exigir. Não compartilhar o mesmo material A1 da SEFAZ por padrão.
3. Configurar em DB por serviço `tokenUrl,apiBaseUrl,mtlsCertificateRef,clientIdRef,scopes,timeout,rateLimit,CA profile,environment,version` e validade; teste HML, depois PROD sob dupla aprovação.
4. **Mapear migração TLS 2026 antes de implementar**; criar healthcheck de cadeia CA e expiração. Token cache no backend cifrado/in-memory/cache distribuído com TTL de fato, não gravar bearer token em JSON público.
5. Registrar tipos/layouts de arquivo retorno e extrato homologados em Itaú Empresas; distinguir pagamento, liquidação e extrato, mesmas chaves da API.
**Sem prova** de que um endpoint `saldo/extrato` específico esteja habilitado ao AlphaCarnes pelo simples fato de existir catálogo Itaú. Não inventar endpoint nem token.
 
## 4. Santander
### Fontes oficiais
- [Portal Desenvolvedor Santander](https://developer.santander.com.br/): criar conta/aplicação e obter Swagger do produto sob credenciamento.
- [Guia API Cobrança v2.5, janeiro/2024 — documento oficial público de referência](https://developer.santander.com.br/sites/default/files/2024-02/user_guide_api_de_cobranca_pt_br_v2_5.pdf): descreve workspaces, registro, consulta e instruções de boletos, certificado A1 (parte pública PEM/CER/CRT) na aplicação. **Não provar que v2.5 seja versão mais recente**; pedir Swagger/guia vigente no portal autenticado.
- [Página oficial Layout de Arquivos Santander](https://www.santander.com.br/layout-de-arquivos): cobrança CNAB240/400, pagamentos fornecedor, folha e ferramenta **Teste de Arquivo** na conta empresarial autorizada.
- [CNAB cobrança Santander 240, H7815 v8.5, fevereiro/2026](https://cms.santander.com.br/sites/WPS/documentos/arq-layout-de-arquivos-download-cob240ptbr/26-02-25_131410_h7815_layout_cobran%C3%A7a_cnab_240_posi%C3%A7%C3%B5es_padr%C3%A3o_santander_multibanco_fev_2026_v.8.5_%28portugu%C3%AAs%29.pdf): layouts remessa/retorno e códigos de Pix boleto. **ATENÇÃO à parametrização de ocorrência de Pix**: retorno pode indicar `09 Baixa` ou `06 Liquidação` com códigos conforme convênio. Não assumir "baixa=recebido" sem contrato e tipo de ocorrência.
### Checklist operacional
1. Cliente habilita API de Cobrança no Santander Developers e contrato operacional por conta/carteira. Criar workspace/aplicação por ambiente. Registrar identificação `workspaceId` somente se API habilitada e documentação indicar.
2. Upload certificado privado na UI do AlphaCarnes e parte pública ao Santander quando necessário. Campos app/client ID, secrets, cert refs e token URLs via UI/cofre PostgreSQL+KMS; homologação com cert e sandbox por produto.
3. Baixar versão **H7815 v8.5 fev/2026** se convênio aceita CNAB240; obter 400 atualizado do convênio se aplicável; validar arquivo com ferramenta banco.
4. Para boleto SX/Pix, obter do banco códigos de ocorrência do convênio e obrigatoriedade segmento Y03; configurar `occurrence_map` versionado, não lógica fixa 09=baixa definitiva.
5. Verificar extrato por API separadamente; não extrapolar do guia Cobrança para saldo/DDA/transferências.

## 5. Arquivos bancários E11 — padrões x bancos
| Canal | Evidência de origem | Uso permitido | Proibição |
|---|---|---|---|
| CNAB240 extrato | padrão FEBRABAN e perfil do banco aprovado, eventualmente segmento E | alimentar extrato normalizado | presumir segmento E em qualquer convênio |
| CNAB240 retorno cobrança | segmento e códigos do contrato por banco/carteira | confirmar evento de cobrança conforme semântica | equivaler `baixa título` a recebimento em dinheiro |
| CNAB400 cobrança | variante por banco e carteira | registro/retorno mediante confirmação do banco | parser universal de 400 posições |
| CNAB240 remessa pagamentos | layout banco/serviço homologado, aprovação dupla | exportar instrução bancária | considerar pagamento efetuado após download |
| OFX | export do banco com FITID e extrato | movimentos conta sob perfil homologado | deduplicar por valor+dia sem ID forte |
| CSV | perfil de delimitador, decimal, data, moeda, timezone, coluna e conta aprovado | contingência de extrato conferida | heurística livre para colunas e auto-baixa |
| MT940 / CNAB200 | possível variante institucional (Bradesco) | **só aditivo após T00** | tratar como CNAB240 |
**Fonte oficial FEBRABAN**: https://portal.febraban.org.br/pagina/3425/33/pt-br/layout-febraban ; padrões são referência, mas **as diferenças por banco são mandatórias**. A aprovação pelo gestor financeiro precisa registrar `layoutVersion`, `bankAccountId`, `service`, `contractDocument`, `validatedTestFileHash` e evidência da homologação.

## 6. Matriz de contratação/cadastro externo (cliente versus software)
| Ação | Cliente/gerente/contador | Administração ERP AlphaCarnes |
|---|---|---|
| Abrir conta/conveniar carteira e aderir a serviços | **sim** | nunca cria conta bancária externa |
| Criar aplicação/assinatura no portal do banco | **sim**, usuário autorizado | registrar IDs, certificados e ambiente internamente |
| Emitir/comprar certificado A1/assinar CSR banco | cliente e AC/banco | upload, versionar, controlar validade, armazenar com KMS |
| Fornecer OpenAPI, layout e credenciais homologação | responsável banco/cliente | registrar versões, upload documento referência e executar teste |
| Homologar callback e disponibilizar webhook público | configurar liberações externas com TI | gerar URL callback, token/segredo em cofre, assinatura e retry |
| Operar batch extrato/arquivo/webhook | fornecer acesso e movimentações | scheduler interno por BD, DLQ, replay, dashboards |
| Confirmar recebimento e baixar AP/AR | Karina/tesouraria segundo alçada | motor E07 e E11 unificado com auditoria |
## 7. Testes obrigatórios e bloqueios para Kiro
- Matriz **3 bancos × contas reais × ambientes × capacidades × canais × versão** assinada; falta de produto significa `not_supported`, não simular.
- Token expirado/mTLS vencido, cadeia CA Itaú em 18/10 e 02/11/2026, sandbox e produção isolados, rotação sem downtime; testes sem segredo em log.
- Receber webhook+CNAB+extrato de mesmo boleto gera **um só fato econômico**, com observações múltiplas e sem segunda baixa; comparar saldos e datas e tratar divergências.
- Arquivos com CNPJ/conta divergente ou layout desconhecido → quarentena; processamento batch não depende de administrador estar logado; job usa credentialRef aprovado.
- Exigir evidência real do banco para cada endpoint e layout, PR não é homologação externa; aceitar somente casos E11 XB-01..XB-16 + casos específicos do provedor.
