# Alfa Carnes — Menu, Personas, Usuários e Permissões

**Versão:** 0.1
**Objetivo:** documentar a segmentação de usuários, escopo por representante e hierarquia de menu da aplicação.

---

# 1. Conceito de segmentação

A aplicação deve evitar duplicação de módulos por representante. A mesma tela comercial deve atender Sabrina, Cemol/Duda, Zona Sul/Carlos ou qualquer outro representante futuro.

A segmentação deve ser feita por três dimensões:

```text
1. Perfil funcional
2. Representantes permitidos
3. Permissões específicas
```

## 1.1 Perfil funcional

Define quais menus e ações aparecem.

Exemplos:

```text
Comercial
Gestão
Recebimento & Balança
Desossa
Estoque
Carga
Faturamento
Administração
Consulta
```

## 1.2 Representantes permitidos

Define o escopo de dados que o usuário enxerga.

Exemplos:

```text
Sabrina / Alpha Carnes
Duda / Cemol
Carlos / Zona Sul
Todos
```

## 1.3 Permissões específicas

Define ações pontuais.

Exemplos:

```text
criar pedido;
alterar preço negociado;
publicar tabela;
aprovar estorno;
consultar todos os representantes;
faturar;
liberar caminhão;
administrar usuários.
```

---

# 2. Grupos de usuários / personas

## 2.1 Comercial

Usuários típicos:

```text
Sabrina
Funcionário Cemol
Usuário Zona Sul
Outros vendedores/representantes futuros
```

Responsabilidades:

```text
consultar clientes;
lançar pedidos;
consultar disponibilidade;
consultar tabela de preços, conforme permissão;
negociar preço, conforme permissão;
gerar/consultar espelho comercial;
acompanhar pedidos do seu representante.
```

Escopo:

```text
filtrado por representantes permitidos.
```

## 2.2 Gestão / Fabrício

Responsabilidades:

```text
compras;
visão consolidada da disponibilidade;
aprovações;
preços;
acompanhamento operacional;
exceções;
relatórios.
```

Escopo:

```text
todos os representantes;
toda a operação.
```

## 2.3 Recebimento & Balança / Richard

Responsabilidades:

```text
receber carga;
conferir lote;
pesar peças;
classificar características;
destinar para pedido, estoque ou desossa;
imprimir etiquetas;
registrar divergências;
estornar ações permitidas.
```

Escopo:

```text
operação física da balança.
```

## 2.4 Desossa

Responsabilidades:

```text
acompanhar dashboard de faltas;
receber TZ destinado à desossa;
aplicar regra de transformação;
pesar partes;
classificar características;
destinar partes a pedido ou estoque;
imprimir etiquetas;
registrar divergências.
```

Escopo:

```text
peças destinadas à desossa;
pedidos que dependem de partes transformadas.
```

## 2.5 Estoque

Responsabilidades:

```text
consultar estoque físico;
registrar entrada de itens não pesáveis;
ajustar estoque;
consultar local/câmara;
acompanhar itens disponíveis/reservados.
```

## 2.6 Carga / Ludmila

Responsabilidades:

```text
planejar carga;
conferir itens destinados;
organizar caminhão/rota;
confirmar carga;
enviar para faturamento.
```

## 2.7 Faturamento / Carla

Responsabilidades:

```text
pré-faturamento;
conferir peso e preço final;
emitir nota fiscal;
gerar XML;
registrar seguro manual;
liberar caminhão;
tratar cancelamentos fiscais/reaberturas autorizadas.
```

## 2.8 Administração

Responsabilidades:

```text
cadastros estruturais;
usuários;
perfis;
permissões;
parâmetros;
auditoria.
```

---

# 3. Menu principal canônico

Este é o menu completo da aplicação antes de aplicar permissões.

```text
COMERCIAL
├─ Clientes
├─ Pedidos de Venda
├─ Tabela de Preços
├─ Disponibilidade
└─ Espelho Comercial

GESTÃO
├─ Dashboard Operacional
├─ Compras
├─ Aprovações
└─ Relatórios de Gestão

RECEBIMENTO & BALANÇA
├─ Recebimento de Carga
├─ Pesagem e Destinação
└─ Etiquetas

DESOSSA
├─ Dashboard da Desossa
├─ Pesagem e Destinação
└─ Etiquetas

ESTOQUE
├─ Consulta de Estoque
├─ Entrada de Itens
└─ Ajustes

CARGA
├─ Planejamento de Carga
├─ Conferência
└─ Enviar para Faturamento

FATURAMENTO
├─ Pré-Faturamento
├─ Notas / XML
├─ Seguro Manual
└─ Liberação do Caminhão

CADASTROS & REGRAS
├─ Representantes
├─ Produtos
├─ Fornecedores / Frigoríficos
├─ Caminhões
├─ Motoristas
├─ Rotas / Itinerários
├─ Regras de Transformação
└─ Modelos de Etiqueta

ADMINISTRAÇÃO
├─ Usuários
├─ Perfis de Acesso
├─ Parâmetros
└─ Auditoria
```

---

# 4. Menus por perfil

## 4.1 Sabrina / Comercial Alpha Carnes

Escopo:

```text
Representante: Sabrina / Alpha Carnes
```

Menu:

```text
COMERCIAL
├─ Clientes
├─ Pedidos de Venda
├─ Tabela de Preços
├─ Disponibilidade
└─ Espelho Comercial
```

Permissões prováveis:

```text
consultar/criar cliente conforme política;
lançar pedido;
consultar disponibilidade;
negociar preço dentro de limite;
consultar pedidos do representante;
gerar espelho comercial.
```

## 4.2 Usuário Cemol / Duda

Escopo:

```text
Representante: Duda / Cemol
```

Menu:

```text
COMERCIAL
├─ Clientes
├─ Pedidos de Venda
├─ Disponibilidade
└─ Espelho Comercial
```

Permissões prováveis:

```text
consultar clientes do seu representante;
lançar pedidos do seu representante;
consultar disponibilidade permitida;
consultar próprios pedidos.
```

Restrições:

```text
não ver todos os clientes;
não ver todos os representantes;
não ver compras;
não ver faturamento global;
não ver configurações.
```

## 4.3 Usuário Zona Sul / Carlos

Mesmo conceito do usuário Cemol.

Escopo:

```text
Representante: Carlos / Zona Sul
```

Menu:

```text
COMERCIAL
├─ Clientes
├─ Pedidos de Venda
├─ Disponibilidade
└─ Espelho Comercial
```

## 4.4 Fabrício / Gestão

Escopo:

```text
Todos os representantes
```

Menu:

```text
GESTÃO
├─ Dashboard Operacional
├─ Compras
├─ Aprovações
└─ Relatórios de Gestão

COMERCIAL
├─ Clientes
├─ Pedidos de Venda
├─ Tabela de Preços
└─ Disponibilidade

ESTOQUE
└─ Consulta de Estoque

CARGA
└─ Consulta / Acompanhamento

FATURAMENTO
└─ Consulta
```

Permissões prováveis:

```text
publicar ou validar preços;
comprar;
consultar tudo;
aprovar estornos/reaberturas;
acompanhar exceções;
ver disponibilidade consolidada.
```

## 4.5 Richard / Balança

Menu:

```text
RECEBIMENTO & BALANÇA
├─ Recebimento de Carga
├─ Pesagem e Destinação
└─ Etiquetas
```

Permissões:

```text
abrir/operar recebimento;
pesar;
destinar;
imprimir/reimprimir etiquetas;
estornar ações permitidas;
registrar divergência.
```

Não deve ver:

```text
Tabela de preços;
Compras gerenciais;
Faturamento;
Administração;
Todos os relatórios.
```

## 4.6 Desossa

Menu:

```text
DESOSSA
├─ Dashboard da Desossa
├─ Pesagem e Destinação
└─ Etiquetas
```

Permissões:

```text
consultar faltas do dashboard;
pesar partes;
destinar partes;
imprimir etiquetas;
registrar divergência;
estornar ações permitidas da desossa.
```

## 4.7 Estoque

Menu:

```text
ESTOQUE
├─ Consulta de Estoque
├─ Entrada de Itens
└─ Ajustes
```

Permissões:

```text
consultar estoque;
registrar entrada de itens não pesáveis;
ajustar estoque conforme permissão;
consultar histórico.
```

## 4.8 Ludmila / Carga

Menu:

```text
CARGA
├─ Planejamento de Carga
├─ Conferência
└─ Enviar para Faturamento
```

Permissões:

```text
visualizar pedidos destinados;
conferir carga;
confirmar carga;
enviar para faturamento;
registrar divergência de carga.
```

## 4.9 Carla / Faturamento

Menu:

```text
FATURAMENTO
├─ Pré-Faturamento
├─ Notas / XML
├─ Seguro Manual
└─ Liberação do Caminhão
```

Permissões:

```text
conferir pesos/preços finais;
emitir NF-e;
gerar XML;
registrar seguro manual;
liberar caminhão;
tratar cancelamentos fiscais;
consultar pedidos/cargas.
```

## 4.10 Administrador

Menu:

```text
CADASTROS & REGRAS
├─ Representantes
├─ Produtos
├─ Fornecedores / Frigoríficos
├─ Caminhões
├─ Motoristas
├─ Rotas / Itinerários
├─ Regras de Transformação
└─ Modelos de Etiqueta

ADMINISTRAÇÃO
├─ Usuários
├─ Perfis de Acesso
├─ Parâmetros
└─ Auditoria
```

Permissões:

```text
manutenção do sistema;
cadastro estrutural;
perfis e permissões;
auditoria.
```

---

# 5. Modelo de permissões recomendado

## 5.1 Usuário

Campos:

```text
Nome
Login
Perfil funcional
Representantes permitidos
Permissões especiais
Status
```

## 5.2 Perfil funcional

Campos:

```text
Nome do perfil
Menus permitidos
Ações permitidas
Pode consultar todos representantes?
Pode alterar preço?
Pode aprovar estorno?
Pode faturar?
Pode liberar caminhão?
```

## 5.3 Representante

Campos:

```text
Nome
Tipo / canal
Status
Clientes vinculados
Usuários vinculados
```

## 5.4 Cliente

Todo cliente deve ter representante obrigatório.

```text
Cliente
├─ Representante
├─ Tabela comercial
├─ Rota padrão
└─ Preferências operacionais
```

## 5.5 Pedido

Pedido herda o representante do cliente.

```text
Pedido
├─ Cliente
├─ Representante herdado
├─ Usuário que lançou
├─ Itens
└─ Status
```

---

# 6. Observações de prototipação

1. O menu do protótipo pode mostrar todos os grupos para o perfil Admin, mas cada persona operacional deve ver apenas seu recorte.
2. Não criar menus separados por representante.
3. Não criar “Comercial Alpha” e “Comercial Cemol”. Usar uma tela Comercial única com escopo por representante.
4. Não criar menu de Caixaria.
5. Não criar menu de Pendências ou Minha Fila neste momento.
6. A desossa precisa de um dashboard visual e uma tela operacional de pesagem/destinação.
7. A disponibilidade deve ser visível para Comercial e Gestão, mas com colunas/escopo diferentes.
