# Alfa Carnes — Glossário, Decisões, Lacunas e Backlog Inicial

**Versão:** 0.1
**Objetivo:** registrar termos, decisões já fechadas, lacunas remanescentes e backlog inicial de construção.

---

# 1. Glossário operacional

## Balança principal

Tela/local onde as peças recebidas são pesadas e destinadas. Trabalha com produto como chegou: DT, PA, TZ, banda de porco e outros pesáveis inteiros.

## Balança da desossa

Tela/local onde as partes geradas a partir do TZ são pesadas, classificadas, etiquetadas e destinadas para pedido ou estoque.

## Cross-docking

Fluxo em que a mercadoria recebida é rapidamente destinada a pedidos/cargas, sem permanecer como estoque por longo período.

## Estoque

Visão física dos itens existentes: peças, partes, caixas, bandas, produtos por unidade e sobras.

## Disponibilidade

Visão comercial calculada a partir de estoque físico, compras, pedidos, reservas e regras de transformação.

## Estoque virtual inteligente

Motor que exibe todos os itens potencialmente vendáveis com base nas regras de transformação e recalcula dependentes/compartilhados a cada reserva.

## Representante

Dimensão comercial vinculada ao cliente e ao pedido. Exemplos: Sabrina/Alpha, Duda/Cemol, Carlos/Zona Sul.

## Perfil funcional

Papel operacional do usuário no sistema: Comercial, Gestão, Balança, Desossa, Estoque, Carga, Faturamento, Administração.

## TZ

Traseiro. É a origem transformável da operação.

## PA

Ponta de Agulha. Pode ser vendida como peça inteira e associada na balança.

## DT

Dianteiro. Pode ser vendido como peça inteira e associado na balança.

## Transformação

Abertura/desmembramento de um TZ em partes/cortes cadastrados por regra.

## Regra de transformação

Cenário cadastrado que define quais produtos e quantidades fixas são gerados a partir de 1 TZ.

## Saída virtual

Possibilidade comercial de item derivado de TZ antes da desossa física.

## Saída física

Parte real gerada após desossa, com peso e etiqueta.

## Reserva inteligente

Reserva que compromete uma origem física ou virtual e recalcula automaticamente tudo que continua ou deixa de ser possível vender.

## Peça mãe

TZ original enviado à desossa.

## Parte gerada

Produto resultante da transformação do TZ.

## Etiqueta de destino interno

Etiqueta usada quando a peça/parte vai para estoque ou desossa, sem cliente final ainda.

## Etiqueta de pedido

Etiqueta usada quando a peça/parte está associada a um pedido/cliente.

---

# 2. Decisões já fechadas

## Operação

```text
A operação é cross-docking com possibilidade de estoque inicial e final.
A base de estoque é única.
Disponibilidade é uma visão calculada.
```

## Representante / usuário

```text
Representante não é persona.
Todo cliente tem representante obrigatório.
Pedido herda representante do cliente.
Usuário tem perfil funcional e representantes permitidos.
```

## Pedido

```text
Maioria dos pedidos é por unidade.
Preço pode ser por peso.
Item do pedido deve registrar peso atendido.
Pedido trava sem disponibilidade.
```

## Balança principal

```text
Balança não transforma.
Pode associar direto a pedido apenas DT, PA, TZ inteiro, banda de porco ou produto pesável compatível.
Pedidos de partes derivadas de TZ são atendidos na desossa.
Busca na balança é por cliente/marca.
```

## Desossa

```text
Somente TZ é transformado.
Não haverá transformação em cadeia.
Toda regra parte diretamente do TZ.
Quantidade de saídas é fixa.
Peso das saídas é variável.
Partes não associadas a pedido vão automaticamente para estoque.
Desossa não será travada; será orientada por dashboard estilo aeroporto.
```

## Estoque virtual

```text
Deve mostrar todos os itens potencialmente vendáveis.
Ao reservar um item, recalcula os dependentes/compartilhados.
A reserva inteligente baixa o que deixou de ser possível.
```

## Características de qualidade/perfil

```text
Mais pesada
Mais gorda
Melhor acabamento
```

## Estoque

```text
Estoque anterior sai primeiro automaticamente.
```

## Caixas / caixaria

```text
Caixaria não é módulo separado.
Caixas são produtos cadastrados.
Caixas são vendidas por unidade.
Caixas não passam por balança nem desossa.
```

## Faturamento

```text
Sistema emitirá NF-e.
Comunicação SEFAZ Osasco considerada.
Seguro é manual.
```

## Cancelamento / estorno

```text
Deve listar ações realizadas.
Não apenas cancelar última ação.
Pode estornar enquanto não houver consumo posterior.
Não pode estornar na balança um TZ já transformado na desossa.
```

---

# 3. Lacunas ainda abertas

## 3.1 Regras completas de transformação do TZ

Ainda falta levantar a lista real de todas as regras possíveis.

Para cada regra, precisamos saber:

```text
Nome da regra
Produtos gerados
Quantidade fixa de cada produto
Se a regra é comum ou excepcional
Observações operacionais
```

Exemplos hipotéticos a validar:

```text
TZ -> 1 Jacaré + 1 Coxão Bola
TZ -> 1 Jacaré + 2 Alcatras
TZ -> 1 Jacaré + 1 Filé
TZ -> Pontas + Filés
TZ -> outras combinações
```

## 3.2 Produtos comercializáveis completos

Ainda é necessário receber/listar todos os produtos vendidos:

```text
DT
PA
TZ
Jacaré
Coxão Bola
Alcatra
Filé
Miolo
Pontas
Banda de porco
Caixas de miúdos
Caixas de rabo
Caixas de fígado
Mocotó
Outros
```

Para cada produto, definir:

```text
unidade de pedido;
unidade de preço;
exige peso;
passa pela balança;
passa pela desossa;
pode ir para estoque;
ativo na tabela de venda.
```

## 3.3 Marco exato de fechamento do pedido

Sugestão atual:

```text
Pedido fechado = carga conferida ou enviada para faturamento.
```

Precisa ser validado se a trava deve ocorrer em:

```text
carga conferida;
envio para faturamento;
nota emitida;
liberação do caminhão.
```

## 3.4 Regras fiscais detalhadas

Ainda será necessário detalhar:

```text
ambiente SEFAZ;
emissão NF-e;
cancelamento fiscal;
contingência;
tratamento de erro de autorização;
integração com certificado digital;
guarda de XML.
```

## 3.5 Seguro manual

Confirmar fluxo operacional:

```text
quem envia;
quando envia;
quais dados obrigatórios;
se anexa comprovante;
quando considera seguro OK.
```

## 3.6 Impressoras e etiquetas

Ainda precisa definir:

```text
modelo físico da etiqueta;
tamanho;
campos obrigatórios;
QR Code ou código de barras;
impressora na balança principal;
impressora na desossa;
processo de reimpressão.
```

## 3.7 Hardware e integração de balança

Confirmar:

```text
integração automática com balança;
digitação manual no MVP;
dispositivos usados na balança;
dispositivos usados na desossa;
uso em câmara fria/ambiente úmido.
```

---

# 4. Backlog inicial sugerido

## P0 — Base obrigatória

```text
Cadastro de usuários/perfis/representantes
Cadastro de clientes
Cadastro de produtos
Cadastro de regras de transformação
Cadastro de fornecedores/frigoríficos
Tabela de preços
Pedido de venda com validação de disponibilidade
Motor de disponibilidade virtual inteligente
Gestão de compras
Recebimento de carga
Pesagem e destinação na balança principal
Etiquetas da balança
Dashboard da desossa
Pesagem/destinação da desossa
Consulta de estoque
Pré-faturamento
Emissão NF-e / XML
```

## P1 — Operação integrada

```text
Planejamento/conferência de carga
Seguro manual
Liberação do caminhão
Estornos/cancelamentos operacionais com histórico
Divergências de recebimento
Divergências de transformação
Ajustes de estoque
Relatórios básicos
```

## P2 — Refinamentos

```text
Simulador de regras de transformação
Sugestão avançada por perfil de cliente
Painel de gestão mais completo
Dashboards executivos
Integrações adicionais
Relatórios analíticos
```

---

# 5. Sequência recomendada de refinamento de telas

## 1. Cadastros estruturais

```text
Produtos
Regras de transformação
Representantes
Clientes
Tabela de preços
```

Motivo: sem estes cadastros o motor de disponibilidade não funciona.

## 2. Comercial e disponibilidade

```text
Pedidos de venda
Disponibilidade
Reserva inteligente
```

Motivo: aqui está o core comercial da operação.

## 3. Recebimento e balança

```text
Recebimento de carga
Pesagem e destinação
Etiquetas
Estornos
```

Motivo: principal ponto operacional e de velocidade.

## 4. Desossa

```text
Dashboard estilo aeroporto
Pesagem e destinação
Divergências de transformação
Etiquetas
```

Motivo: transformação impacta estoque e atendimento de pedidos.

## 5. Estoque e carga

```text
Consulta de estoque
Entrada de itens
Planejamento de carga
Conferência
```

## 6. Faturamento

```text
Pré-faturamento
NF-e / XML
Seguro manual
Liberação
```

---

# 6. Regras de ouro do projeto

1. **Não duplicar módulos por representante.**
2. **Não duplicar estoque físico e estoque virtual.**
3. **Disponibilidade é cálculo inteligente sobre uma base única.**
4. **A balança precisa ser mais rápida que o papel.**
5. **A desossa precisa de orientação visual, não trava operacional.**
6. **O sistema deve sugerir, mas a operação ainda decide.**
7. **Transformação é direta do TZ; não há cadeia de transformação.**
8. **Peso real é essencial para faturamento.**
9. **Cancelamento deve ser fácil, mas auditado e bloqueado quando houver etapa posterior.**
10. **Toda peça/parte deve preservar origem e rastreabilidade.**

---

# 7. Absorção protótipo v2 — decisões e lacunas (2026-06)

## Telas reais alinhadas ao protótipo (2026-06)

As rotas operacionais abaixo foram reconstruídas ou padronizadas com DS v2 (`StatusPill`, `KpiCard`, `AlertItem`, `ActivityItem`):

- `/recebimento/recebimento-carga` — spec 3.1 (metadados placa/motorista/doca, previsto×apurado, divergência, finalizar/suspender)
- `/recebimento/pesagem-destinacao` — layout operacional (barra de lote, abas de produto, compatíveis, acumulado, ações, demandas desossa)
- `/gestao/dashboard` — pedidos em andamento + atividades recentes via API
- Cadastros Clientes/Fornecedores — abas Gerais/Fiscais/Contatos/Preferências (JSON tipado no backend)

## Placeholders fiéis ao protótipo (17 rotas)

Permanecem como `PlaceholderPage` até spec/backend dedicados: `comercial/tabela-precos`, `comercial/espelho`, `gestao/aprovacoes`, `gestao/relatorios`, `desossa/pesagem-destinacao`, `desossa/etiquetas`, `estoque/entrada-itens`, `estoque/ajustes`, `carga/enviar-faturamento`, `faturamento/notas-xml`, `faturamento/seguro-manual`, `cadastros/representantes`, `cadastros/caminhoes`, `cadastros/motoristas`, `cadastros/modelos-etiqueta`, `admin/perfis`, `admin/parametros`.

## Lacunas de backend / API identificadas na implementação

| Área | Lacuna |
|------|--------|
| Produtos | Campo preço por kg/unidade não existe no backend |
| Regras de Transformação | UI agrupada por item de compra no protótipo; backend expõe linhas individuais (sem join de nomes de itens) |
| Regras de Transformação | Criação/edição completa via UI ainda não implementada (somente listagem + simulador) |
| Pesagem | Leitura de peso ao vivo na balança (sem streaming); captura via POST /pecas |
| Pedidos | Status operacional “em expedição” incompleto no schema — KPI derivado quando possível |

## Legado removido do frontend

Pasta `(admin)/operacao/` eliminada (UI órfã). Redirects de compatibilidade permanecem em `next.config.ts`. Backend `CorteController` e rotas BFF `api/operacao/**` preservados.
