# AlphaCarnes | Catálogo verificado de documentação oficial para integrações
**Data-base: 11/10/2026 (America/Sao_Paulo).** Status: pesquisa pública documental (não comprova credenciamento, convênios ou aceites). Escopo: NF-e modelo 55 SP, DF-e entrada, Reforma Tributária, SPED, Bradesco, Itaú, Santander, arquivos fallback e cadastros externos. Referências fixadas com data/versão quando verificáveis. Antes de cada integração verificar se surgiu versão nova no portal do emissor.
**Tipos de evidência**: `CONFIRMADO_PORTAL_PUBLICO` documento oficial com versão/data; `PORTAL_LOGADO` catálogo oficial, mas endpoints/payload privados; `HABILITACAO_CLIENTE_PENDENTE` banco/SEFAZ devem habilitar; `PROPOSTA_ARQUITETURAL` decisão do projeto, não norma.

## 1. Nota Fiscal Eletrônica — NF-e 55 (SEFAZ/SP)
### 1.1 Fontes oficiais e versão
| ID | Artefato | Versão/data encontrada | URL oficial | Ação Kiro |
|---|---|---|---|---|
| NF-01 | MOC NF-e/NFC-e e Anexo I regras, Anexo II DANFE, Anexo III contingência | MOC 7.0, com NTs que o complementam | https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?AspxAutoDetectCookieSupport=1&tipoConteudo=ndIjl+iEFdE%3D | estudar regras NF-e **modelo 55** (não confundir NFC-e ou serviços municipais) |
| NF-02 | NT 2025.002 Reforma Tributária do Consumo | **v1.52 publicada em 01/10/2026** | https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?AspxAutoDetectCookieSupport=1&tipoConteudo=6WfrpZYE4Ik%3D | aplicar regras vigentes por implantação, data, CRT/CST e cClassTrib |
| NF-03 | Pacote XSD NF-e 010f (NT 2025.002 v1.50 e NT 2026.007 v1.00) | **010f, 31/08/2026** no portal público consultado | https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?AspxAutoDetectCookieSupport=1&tipoConteudo=BMPFMBoln3w%3D | checar pacote mais recente aplicável à **NT v1.52** antes de habilitar schema produção; não presumir que NT nova já implique ZIP novo |
| NF-04 | Schemas de eventos RTC | NT 2025.002 v1.40 em 27/07/2026 na listagem pública | mesmo portal NF-03 | tratar versionamento dos eventos à parte do XML autorizado |
| NF-05 | NT 2026.007 cadastros LCC-RFB/CCC | **v1.10 de 01/10/2026** | portal NF-02 | validar identificação/cadastro de emitente/destinatário |
| NF-06 | NT 2026.008 alteração de leiaute e regras | **v1.00 de 01/10/2026** | portal NF-02 | inspecionar diferenças de schema/rules e impacto em XML 55 |
| NF-07 | NT 2026.010 DANFE RTC | **v1.00 de 01/10/2026** | portal NF-02 | revisar DANFE e cálculos do RTC |
| NF-08 | NT 2026.006 vinculação NF-e × transação financeira/split payment | v1.00 de 25/08/2026 | portal NF-02 | planejar dados/correlação com E05/E07, sem prometer operação antes vigência |
| NF-09 | NT 2014.002 — distribuição DF-e | v1.40 de 03/07/2026 | portal NF-02 | consumir NSU, distNSU/consNSU/consChNFe conforme regras vigentes, evitar consumo abusivo |
| NF-10 | Pacote XSD distribuição DF-e | **v1.04 de 03/07/2026** | portal NF-03 | validar retornos, eventos e zip XML; separar do XSD de emissão |
| NF-11 | Tabelas IBS/CBS `cClassTrib`, `cCredPres`, alíquotas CBS; tabelas NCM×uTrib, municípios, meios de pagamento | no portal: Informe Técnico 2025.002 v1.60 de 23/06/2026 para `cClassTrib`; NCM×uTrib vigente a partir de 01/02/2026 | https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?AspxAutoDetectCookieSupport=1&tipoConteudo=%2FNJarYc9nus%3D | catálogos oficiais importáveis com checksum, versão, vigência, responsável, bloqueio em tabelas expiradas |
| NF-12 | Tabela `cBenef` SP | versão de arquivo 20260610 localizada; não inferir versão posterior | https://portal.fazenda.sp.gov.br/servicos/nfe/Downloads/Tabela-cBenef-SP-v20260610.pdf | usar por vigência/CST/objeto normativo; contador valida SP020450/SP020740/SP020100 dos XMLs |
| NF-13 | SEFAZ/SP — ambientes, produção, SVC-AN e DF-e Ambiente Nacional | página oficial de URLs, WS v4.00 SP | https://portal.fazenda.sp.gov.br/servicos/nfe/Paginas/URL-WEBSERVICES.aspx | carregar `IntegrationEndpoint` por ambiente e serviço via catálogo, NÃO hardcode nem .env |
| NF-14 | Credenciamento e certificação ICP-Brasil | SP: contribuintes não MEI em regra credenciados de ofício; MEI verifica caso | https://portal.fazenda.sp.gov.br/servicos/nfe/Paginas/PaginaGuiaDoUsuario.aspx | UI de estabelecimento: estado credenciamento declarado/verificado, CNPJ/IE, número série, ambiente, certificado associado |
| NF-15 | Modelo operacional oficial | NF-e precisa autorização uso antes trânsito normal e DANFE correspondente | https://portal.fazenda.sp.gov.br/servicos/nfe/Paginas/Descri%C3%A7%C3%A3o-de-Modelo-Operacional.aspx | bloquear liberação caminhão sem autorização, exceto contingência legal aprovada |
| NF-16 | Certificado e transmissão | ICP-Brasil e-CNPJ A1 adequado a batch; operações de assinatura/transmissão usam certificado conforme MOC | https://portal.fazenda.sp.gov.br/servicos/nfe/Paginas/PaginaGuiaDoUsuario.aspx | upload seguro com chave privada em cofre, mTLS e XMLDSig; **A3 token/cartão não é via simples upload e não atende batch desacompanhado** |
### 1.2 Serviços SEFAZ/SP modelo 55 v4.00
Os endereços abaixo são **constantes oficiais versionadas de catálogo**; instalar somente depois de validar serviço e conectividade por ambiente no console de integrações.
| Serviço | Homologação | Produção |
|---|---|---|
| Autorização | https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx | https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx |
| Retorno autorização | https://homologacao.nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx | https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx |
| Consulta protocolo | https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx | https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx |
| Status | https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx | https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx |
| Recepção evento | https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx | https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx |
| Inutilização | https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx | https://nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx |
| Consulta cadastro | https://homologacao.nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx | https://nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx |
| DF-e Ambiente Nacional | https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx | https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx |
**Atenção:** ambiente de homologação estadual ≠ testes nacionais DF-e ≠ SVC-AN, serviços distintos. Referência completa da SVC-AN está na NF-13; só entrar em contingência autorizada conforme MOC Anexo III. Autorização com status indeterminado exige consulta/recibo antes de reenvio, nunca criar outra nota. Chave única por estabelecimento/série/número/ambiente, XML autorizado e retorno arquivados.
### 1.3 Checklist de credenciamento externo SEFAZ
- [ ] CNPJ/IE/UF e CRT conferidos na RFB/SEFAZ, **inclusive CNPJ alfanumérico**;
- [ ] situação habilitada por estabelecimento e ambiente; acesso ao portal SP/credenciamento quando necessário;
- [ ] e-CNPJ A1 ICP-Brasil compatível, validade, cadeia, CNPJ e autorização formal do titular; upload e teste na UI;
- [ ] série/número/ambiente/codigo UF aprovados; contador revisa tributos/benefícios/NTs e RTC;
- [ ] consultar status WS e autorizar NF sintética em homologação;
- [ ] eventos de consulta, cancelamento, inutilização, CC-e e contingência testados;
- [ ] separar primeira emissão de produção por perfil/aprovação, nunca autoativar depois de upload.

## 2. Documentação dos três bancos e escopo efetivamente comprovado
*Detalhamento de API, perfis de certificados e manuais por banco:* [21-FONTES-BANCARIAS-ONBOARDING-E-LAYOUTS.md](21-FONTES-BANCARIAS-ONBOARDING-E-LAYOUTS.md).
**Atenção:** Itaú exige conta autenticada/contrato para API Reference OpenAPI/Postman, não reproduzir endpoints fictícios. Bradesco e Santander também têm documentação restrita a produto/convênio. Registrar status `PORTAL_LOGADO`, não inventar URL/campo nem chamar de integrado.

## 3. SPED e entregas contábeis externas
| Obrigação | Documento oficial atual encontrado | Vigência / limite | Portal |
|---|---|---|---|
| EFD ICMS/IPI | Guia Prático **3.2.4** (10/09/2026), substitui 3.2.3/3.2.2 na revisão atual | Layout/validação por período; verificar aplicabilidade por empresa/UF | https://www.gov.br/sped/pt-br/assuntos/comunicados/efd-icms-ipi/nova-versao-do-guia-pratico-da-efd-icms-ipi-2 |
| ECF | Manual **leiaute 12**, atualizado 23/07/2026 | ano calendário 2025/situações especiais 2026, NÃO presumir leiaute de 2027 | https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/ecf/manuais-e-documentos-tecnicos/manual_ecf_leiaute_12_20_05_2026_ac_2025_sit_esp_2026.pdf |
| ECF plano contas referencial | tabelas dinâmicas leiaute 12, atualização 24/09/2026 | usar arquivo vigente correspondente ao ano-calendário | https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/ecf/manuais-e-documentos-tecnicos/tabelas-dinamicas-e-planos-de-contas-referenciais-leiaute-12-atualizacao-28-05-2026 |
| ECD | documentação técnica e PVA oficiais, **versão específica não fixada nesta pesquisa** | levantar leiaute por ano calendário e regime com contador | https://www.gov.br/sped/pt-br |
| EFD-Contribuições | guias técnicos oficiais por ano-calendário, sem inferência de obrigatoriedade | competência e legislação do cliente | https://www.gov.br/sped/pt-br |
**Não confundir SPED arquivo gerado com declaração legalmente entregue**: assinatura, validação PVA e envio/recibo são fluxos separados e aprovados pelo contador. O software não atua como contador nem obtém procuração e-CAC.

## 4. Cadastros externos / catálogos auxiliares e dependências
| Fonte | Papel | Referência e limitação |
|---|---|---|
| RFB CNPJ alfanumérico | CPF/CNPJ não pode ser `digitsOnly` nem campo numérico; aceitar e validar DV formato alfanumérico; preservar zeros | https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico — primeiro CNPJ alfanumérico em 31/07/2026 |
| RFB Conecta Consulta CNPJ | **não é API pública livre para empresas**; Conecta destina-se a órgãos habilitados, não integrar sem elegibilidade/contrato | https://www.gov.br/conecta/catalogo/apis/consulta-cnpj |
| IBGE municípios/códigos IBGE | cadastro nacional do município de destinatário/fiscal; importar conjunto com versão/hash/atualização | https://servicodados.ibge.gov.br/api/v1/localidades/municipios |
| NF-e NCM e uTrib, GTIN | validar categoria do produto e códigos da nota por tabelas oficiais em vigência; GS1 eventualmente exige licença | portal NF-11 |
| cBenef SP | benefícios fiscais, CST/UF e vigência, com avaliação normativa por responsável fiscal | NF-12 |
| PVA/SPED e certificado e-CAC | assinatura/validação; software pode gerar arquivos mas transmissão só se tecnicamente disponibilizada e homologada | portal SPED; contador responsável |
| Bancos / APIs / CNAB / DDA | cadastro empresa/usuários/convênios e certificação/credenciamento fora da aplicação é pré-requisito legal/contratual; **configuração operacional interna pela UI** | portais dos bancos da seção 2 |
**Fora do escopo até aprovação expressa**: Open Finance em nome do cliente como substituto automático de API PJ, cartórios, eSocial, Serpro CNPJ comercial pago, SIF/API frigorífico não documentada, NFS-e municipais, NFC-e, CT-e, MDF-e.

## 5. Registro de atualização de documentação obrigatório
Para cada fonte: `sourceId,organization,artifactName,officialUrl,version,publicationDate,checkedAt,checkedBy,sha256Downloaded?,effectiveFrom?,effectiveTo?,supersededBy?,appliesTo,visibility,capability,approvalStatus`. Hash somente se arquivo efetivamente obtido; URL pesquisada não justifica inventar checksum. Atualizações são *staging → diff → validação QA/fiscal → aprovação → ativação*; nenhum job altera regra fiscal automaticamente só porque site publicou NT.

## 6. Divergências/limitações da pesquisa pública
- NT 2025.002 **v1.52 (01/10/2026)** é mais recente que a versão referenciada no pacote XSD **010f publicado em 31/08/2026** na listagem retornada; conferir se foi publicado XSD posterior e o calendário de implantação. Não associar v1.52 a ZIP 010f sem teste.
- **Não foi possível confirmar endpoints/payload/versionamento privado das APIs bancárias**, escopos habilitados e layout contratado, exigindo documentação fornecida pelos três bancos com autenticação.
- A versão SPED ECD e outros arquivos depende competência legal e não foi fixada sem evidência.
- Não inventar responsabilidades para contratação externa, aprovações de certificado ou procurações. A aplicação será autossuficiente na **operação técnica depois do provisionamento**, não na contratação/habilitação de terceiros.
