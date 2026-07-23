# Alfa Carnes — Documentação Base do Sistema Operacional

**Versão:** 0.1
**Data:** 2026-06-19
**Finalidade:** documento base para prototipação das telas, estruturação da aplicação, desenho do banco de dados, regras de negócio e validação com os usuários da Alfa Carnes.

---

## 1. Objetivo deste pacote de documentação

Este pacote consolida o entendimento levantado até o momento sobre a operação da Alfa Carnes e transforma as decisões operacionais em insumos para construção do sistema.

A documentação cobre:

1. entendimento da operação atual;
2. fluxos de negócio ponta a ponta;
3. segmentação por grupos de usuários/personas;
4. hierarquia de menu;
5. telas previstas;
6. campos, ações, validações e regras por tela;
7. motor de disponibilidade virtual inteligente;
8. regras de transformação/desossa;
9. cancelamentos, estornos e travas operacionais;
10. lacunas ainda abertas para validação.

A prioridade desta versão é **completude funcional**, não acabamento visual.

---

## 2. Premissas centrais já consolidadas

### 2.1 A operação é cross-docking com possibilidade de estoque

A operação principal da Alfa Carnes funciona como cross-docking: a mercadoria chega, é conferida, pesada/destinada e, sempre que possível, segue diretamente para pedidos/cargas. Porém, a operação também precisa aceitar estoque:

- **estoque inicial:** produtos, peças, cortes ou caixas que sobraram de dias anteriores;
- **estoque final:** peças, partes, sobras ou itens não destinados no dia;
- **estoque intermediário:** peças enviadas para desossa ou aguardando destinação;
- **estoque de itens não pesáveis:** caixas e itens vendidos por unidade.

O sistema deve controlar os dois mundos sem duplicar dados: cross-docking e estoque são estados/visões de uma mesma operação.

### 2.2 Estoque físico e disponibilidade não são módulos separados

A base de dados de mercadorias é única. O que muda é a visão:

- **Estoque:** visão física do que existe, onde está, origem, peso/quantidade, status e localização.
- **Disponibilidade:** visão comercial calculada a partir de compras, estoque, pedidos, reservas e regras de transformação.

Não devem existir módulos independentes chamados “estoque físico” e “estoque virtual”. O correto é existir:

```text
Estoque = base física
Disponibilidade = visão comercial inteligente
```

### 2.3 Representante não é uma persona

Representante é uma dimensão comercial do cliente/pedido. Persona/perfil é o papel funcional do usuário.

Exemplo:

```text
Usuário: Sabrina
Perfil funcional: Comercial
Representante vinculado: Alpha Carnes / Sabrina
```

```text
Usuário: Funcionário Cemol
Perfil funcional: Comercial
Representante vinculado: Cemol / Duda
```

```text
Usuário: Fabrício
Perfil funcional: Gestão
Representantes permitidos: Todos
```

Todo cliente deve ter um representante/canal no cadastro. O pedido herda o representante do cliente.

### 2.4 Pedido é por unidade, cobrança frequentemente por peso

A maior parte dos itens é vendida por unidade/peça, mas o preço final é calculado pelo peso total quando o produto exige pesagem.

Exemplo:

```text
Cliente pede: 10 PAs
Operação pesa: 10 peças de PA
Faturamento cobra: peso total das 10 PAs x preço por kg
```

Produtos como caixas são vendidos e cobrados por unidade.

### 2.5 Balança não transforma

Na balança principal, o operador trabalha com a peça como ela chegou.

Peças principais recebidas:

```text
DT
PA
TZ
Banda de porco
```

A balança pode:

```text
pesar;
classificar características;
associar a pedido compatível;
enviar para estoque;
enviar TZ para desossa;
imprimir etiqueta;
cancelar/estornar ações permitidas.
```

A balança **não** associa pedido de corte transformado. Exemplo: pedido de alcatra, jacaré, filé ou coxão bola deve ser atendido na desossa, não na balança principal.

### 2.6 Desossa transforma somente TZ

A transformação acontece na desossa e somente o **TZ** será tratado como origem transformável.

Não haverá transformação em cadeia do tipo:

```text
TZ -> Coxão Bola -> Alcatra
```

O correto é cadastrar alternativas diretas a partir do TZ:

```text
TZ -> Jacaré + Coxão Bola
TZ -> Jacaré + 2 Alcatras
TZ -> Jacaré + Filé
TZ -> Pontas + Filés
TZ -> outras combinações cadastradas
```

Cada regra terá quantidade fixa de saídas. O peso das saídas é variável e será capturado na desossa.

### 2.7 O estoque virtual é inteligente

O estoque virtual deve mostrar todos os itens potencialmente vendáveis, mesmo que eles compartilhem a mesma origem física.

Exemplo com 1 TZ e regras hipotéticas:

```text
1 TZ = 1 Jacaré + 1 Coxão Bola
1 TZ = 1 Jacaré + 2 Alcatras
1 TZ = 1 Jacaré + 1 Filé
```

A disponibilidade pode mostrar:

```text
Jacaré: 1 disponível
Coxão Bola: 1 disponível
Alcatra: 2 disponíveis
Filé: 1 disponível
```

Ao reservar um item, a reserva inteligente recalcula tudo que continua possível e baixa automaticamente o que deixou de ser possível.

Frase-chave:

> A disponibilidade virtual mostra possibilidades de venda; a reserva inteligente elimina possibilidades incompatíveis.

### 2.8 Desossa não será travada pelo sistema

Não haverá trava operacional que impeça a equipe da desossa de produzir uma peça fisicamente. A desossa precisa de orientação, não de burocracia.

O sistema terá um **dashboard estilo aeroporto** para a sala de desossa, exibindo o que falta produzir para atender os pedidos.

Exemplo:

```text
Produto       Faltam     Pronto em estoque     Origem
Alcatra       15         2                      TZ
Jacaré        13         0                      TZ
Filé          6          1                      TZ
Coxão Bola    8          0                      TZ
```

A interação real com o sistema acontece na balança da desossa, onde as partes geradas são pesadas, classificadas, etiquetadas e destinadas a pedido ou estoque.

### 2.9 Caixaria não é módulo específico

“Caixaria” é apenas um apelido operacional para itens cadastrados como produtos, como caixas de miúdos, rabo, fígado etc.

Regra:

```text
Caixas são vendidas por unidade.
Preço por unidade.
Não passam por balança.
Não passam por desossa.
Podem ir direto para pedido ou estoque.
```

### 2.10 O sistema emitirá nota

O sistema deve emitir nota fiscal, com comunicação com a SEFAZ Osasco já considerada no escopo. O XML será gerado pelo sistema.

Seguro será manual, com registro de status no sistema.

---

## 3. Arquivos deste pacote

| Arquivo | Conteúdo |
|---|---|
| `00_LEIA_ME.md` | Visão geral do pacote, premissas e mapa da documentação. |
| `01_entendimento_operacional_fluxos.md` | Entendimento detalhado da operação e fluxos ponta a ponta. |
| `02_regras_de_negocio_core.md` | Regras centrais: disponibilidade virtual, transformação, estoque, cancelamento e faturamento. |
| `03_menu_personas_permissoes.md` | Grupos de usuários, perfis, escopos por representante e hierarquia de menu. |
| `04_especificacao_telas_campos.md` | Telas previstas, campos, ações, validações e comportamentos. |
| `05_glossario_lacunas_backlog.md` | Glossário, decisões fechadas, lacunas pendentes e backlog inicial sugerido. |

---

## 4. Próximo passo sugerido

A próxima etapa deve refinar em detalhe, um bloco por vez:

1. **Cadastro de Produtos e Regras de Transformação** — base do motor de disponibilidade virtual.
2. **Comercial / Pedido de Venda / Disponibilidade** — como a venda reserva corretamente os itens.
3. **Recebimento & Balança** — tela crítica do Richard.
4. **Desossa** — dashboard estilo aeroporto e balança da desossa.
5. **Faturamento** — emissão de nota, XML, seguro manual e liberação.
