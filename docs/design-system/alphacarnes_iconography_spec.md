# AlphaCarnes — Especificação Técnica da Iconografia para Design System no Figma

**Documento:** `alphacarnes_iconography_spec.md`  
**Objetivo:** orientar a reconstrução fiel da biblioteca de ícones AlphaCarnes no Figma, com grid, stroke, cores, nomes de componentes, variantes e regras de uso.  
**Imagem de referência principal:** `Iconografia AlphaCarnes.png`  
**Dimensão da referência:** `1448 × 1086 px`  
**Sistema:** AlphaCarnes Design System  
**Estilo:** iconografia linear, limpa, operacional, corporativa, adequada para ERP/logística/distribuição de carnes.

---

## 1. Direção visual da iconografia

A iconografia da AlphaCarnes deve parecer parte de um sistema operacional profissional, não de uma landing page ou aplicativo genérico. Os ícones devem ser simples, legíveis, consistentes e pensados para uso frequente em telas densas, como dashboard, tabelas, sidebar, cards, filtros, alertas e módulos de logística.

A imagem de referência apresenta uma biblioteca com ícones em cards individuais, com nomes em português e paleta baseada em azul primário, cinza neutro e cores semânticas para status.

---

## 2. Princípios de design

1. **Linearidade:** ícones desenhados com stroke, sem preenchimentos complexos.
2. **Consistência:** todos os ícones compartilham espessura, arredondamento, escala e peso visual.
3. **Legibilidade operacional:** devem ser reconhecíveis em 16 px, 20 px e 24 px.
4. **Baixo ruído visual:** evitar detalhes finos demais.
5. **Aderência ao negócio:** incluir ícones específicos de recebimento, pesagem, expedição, cortes de carne, frigorífico e unidade/matriz.
6. **Semântica por cor:** status operacionais devem usar cores funcionais, não decorativas.
7. **Compatibilidade com sidebar:** todo ícone deve funcionar em branco sobre gradiente azul.

---

## 3. Grid e construção base

### 3.1 Canvas mestre

| Propriedade | Valor |
|---|---:|
| Canvas base | `24 × 24 px` |
| Grid | `1 px` com subdivisão visual de `4 px` |
| Padding interno mínimo | `2 px` |
| Área útil recomendada | `20 × 20 px` |
| Stroke padrão | `2 px` |
| Stroke alternativo para ícones densos | `1.75 px` |
| Cap | Round |
| Join | Round |
| Corner style | Arredondado |
| Bounding box exportável | Sempre `24 × 24 px` |

### 3.2 Tamanhos derivados

Criar variantes por tamanho usando o mesmo vetor, com ajuste óptico quando necessário.

| Variante | Canvas | Stroke sugerido | Uso |
|---|---:|---:|---|
| `Size=16` | `16 × 16` | `1.5 px` | texto inline, status pequeno |
| `Size=20` | `20 × 20` | `1.75 px` | sidebar compacta, botões |
| `Size=24` | `24 × 24` | `2 px` | padrão |
| `Size=32` | `32 × 32` | `2.25 px` | cards, guia de iconografia |
| `Size=40` | `40 × 40` | `2.5 px` | ilustrações pequenas, empty states |

### 3.3 Regras de alinhamento

- Ícones circulares devem ocupar diâmetro visual de `18–20 px` dentro do canvas de `24 px`.
- Ícones quadrados/cubos devem respeitar padding mínimo de `2 px`.
- Ícones horizontais, como caminhão, podem ocupar até `21 px` de largura.
- Ícones verticais, como balança ou documento, devem ocupar altura de `19–20 px`.
- O centro óptico deve ficar entre `x=12`, `y=12`, com compensações visuais permitidas.

---

## 4. Paleta da iconografia

### 4.1 Cores principais da referência

| Nome | Token | Valor | Uso |
|---|---|---:|---|
| Primária | `icon.primary` | `#2563EB` | Ícones principais e navegação ativa |
| Neutra | `icon.neutral` | `#64748B` | Ícones secundários, ações neutras |
| Sucesso | `icon.success` | `#16A34A` | Check, expedido, recebido confirmado |
| Atenção | `icon.warning` | `#F59E0B` | Pendência, alerta operacional |
| Erro | `icon.error` | `#DC2626` | Alerta crítico, erro |
| Informação | `icon.info` | `#2563EB` | Informação, estados ativos |
| Branco | `icon.white` | `#FFFFFF` | Sidebar e fundos escuros |
| Desabilitado | `icon.disabled` | `#CBD5E1` | Estado disabled |

### 4.2 Estados operacionais específicos

| Estado | Token | Valor | Ícone associado |
|---|---|---:|---|
| Recebido | `status.recebido` | `#3B82F6` | Recebido / caixa / entrada |
| Pesado | `status.pesado` | `#8B5CF6` | Balança |
| Expedido | `status.expedido` | `#10B981` | Expedição / caminhão / saída |
| Divergência | `status.divergencia` | `#F59E0B` | Exclamação / alerta |
| Bloqueado | `status.bloqueado` | `#EF4444` | Cadeado |
| Pendente | `status.pendente` | `#94A3B8` | Relógio / neutro |

---

## 5. Estrutura do guia visual de iconografia

A imagem de referência apresenta um board com:

```text
┌──────────────────────────────────────────────────────────────┐
│ Logo AlphaCarnes | ICONOGRAFIA | Paleta | Status referência │
├──────────────────────────────────────────────────────────────┤
│ Cards de ícones em grid                                      │
│ [Ícone]                                                       │
│ Nome                                                         │
└──────────────────────────────────────────────────────────────┘
```

### 5.1 Especificação do board no Figma

| Elemento | Valor recomendado |
|---|---:|
| Frame do guia | `1448 × 1086 px` ou `1600 × 1200 px` |
| Background | `#FFFFFF` |
| Border externo | `1 px #E2E8F0` |
| Radius externo | `8 px` |
| Header height | `170–190 px` |
| Divisor horizontal | `1 px #E2E8F0` |
| Card de ícone | `120 × 156 px` aproximadamente |
| Card radius | `8–12 px` |
| Card border | `1 px #E2E8F0` |
| Grid gap horizontal | `18–22 px` |
| Grid gap vertical | `22–26 px` |
| Ícone no card | `40–48 px` visual |
| Label | Inter 16/400 ou 15/500 |

---

## 6. Componentização no Figma

### 6.1 Componente base

Criar um componente para cada ícone:

```text
Icon/[Nome]
```

Exemplo:

```text
Icon/Dashboard
Icon/Recebimento
Icon/Pesagem
Icon/Expedicao
```

### 6.2 Variantes recomendadas

Cada ícone deve possuir propriedades:

```text
Size = 16 | 20 | 24 | 32 | 40
Color = Primary | Neutral | Success | Warning | Error | White | Disabled
State = Default | Hover | Active | Disabled
```

Quando o Figma tornar muito pesado manter todas as combinações como variantes manuais, usar um componente vetorial base com propriedades de cor via variable binding.

### 6.3 Nomenclatura de variantes

```text
Icon/Dashboard
  ├── Size=16, Color=Primary
  ├── Size=20, Color=Primary
  ├── Size=24, Color=Primary
  ├── Size=24, Color=Neutral
  ├── Size=24, Color=White
  └── Size=24, Color=Disabled
```

---

## 7. Inventário completo de ícones da referência

Abaixo está a biblioteca identificada na imagem de iconografia. Os nomes devem ser mantidos em português para o DS, com alternativa técnica em inglês se necessário para código.

### 7.1 Navegação principal

| Nome no DS | Nome técnico sugerido | Cor padrão | Descrição visual | Uso |
|---|---|---|---|---|
| Dashboard | `dashboard` | Primary | Quatro quadrados arredondados em grade 2×2 | Menu, visão geral |
| Recebimento | `receiving` | Primary | Caixa/cubo com seta para baixo | Entrada de mercadoria |
| Pesagem | `weighing` | Primary | Balança com prato superior | Pesagem de peças/lotes |
| Expedição | `shipping` | Primary | Retângulo/porta com seta para direita | Saída/carga |
| Estoque | `inventory` | Primary | Cubos empilhados | Estoque físico |
| Pedidos | `orders` | Primary | Carrinho de compras | Pedidos comerciais |
| Clientes | `customers` | Primary | Duas pessoas | Cadastro/consulta de clientes |
| Financeiro | `finance` | Primary | Círculo com cifrão | Módulo financeiro |
| Relatórios | `reports` | Primary | Gráfico de barras | Relatórios e analytics |
| Configurações | `settings` | Neutral | Engrenagem | Configurações |

### 7.2 Ações e utilitários globais

| Nome no DS | Nome técnico sugerido | Cor padrão | Descrição visual | Uso |
|---|---|---|---|---|
| Busca | `search` | Neutral | Lupa circular | Campo de busca |
| Notificações | `notifications` | Neutral | Sino | Alertas e notificações |
| Usuário | `user` | Neutral | Cabeça e ombros | Perfil do usuário |
| Calendário | `calendar` | Neutral | Calendário retangular | Filtro de data |
| Filtro | `filter` | Neutral | Funil | Filtragem de listas |
| Tabela | `table` | Neutral | Grade tabular | Visualização em tabela |
| Menu | `menu` | Neutral | Três linhas horizontais | Abrir/fechar menu |
| Mais ações | `more-actions` | Neutral | Três pontos verticais | Menu contextual |
| Avatar | `avatar` | Neutral | Usuário dentro de círculo | Usuário/participante |
| Localização | `location` | Neutral | Pin de localização | Unidade/endereço |

### 7.3 Logística, produtos e operação

| Nome no DS | Nome técnico sugerido | Cor padrão | Descrição visual | Uso |
|---|---|---|---|---|
| Caminhão | `truck` | Neutral | Caminhão lateral simples | Transporte e entrega |
| Caixa | `box` | Neutral | Cubo isométrico | Volume/lote/produto |
| Etiqueta | `tag` | Neutral | Tag inclinada com furo | Etiqueta/código/preço |
| Balança | `scale` | Neutral ou Pesado | Balança operacional | Pesagem |
| Carne/Corte | `meat-cut` | Neutral | Corte de carne oval/fatiado | Produto/corte bovino |
| Frigorífico | `factory` | Neutral | Prédio fabril | Origem/frigorífico |
| Unidade/Matriz | `branch` | Neutral | Prédio corporativo | Unidade operacional |

### 7.4 Status operacionais

| Nome no DS | Nome técnico sugerido | Cor padrão | Descrição visual | Uso |
|---|---|---|---|---|
| Alerta | `alert` | Error | Triângulo com exclamação | Alerta crítico |
| Check | `check` | Success | Círculo com check | Concluído/sucesso |
| Bloqueado | `blocked` | Neutral/Error | Cadeado | Bloqueio fiscal/operacional |
| Pendente | `pending` | Warning | Relógio circular | Aguardando ação |
| Divergência | `divergence` | Warning | Círculo com exclamação | Diferença/pendência |
| Recebido | `received` | Success/Received | Seta para baixo em caixa | Item recebido |
| Pesado | `weighed` | Primary/Pesado | Balança azul | Item pesado |
| Expedido | `shipped` | Primary/Expedido | Saída com seta | Item expedido |

### 7.5 Dados e documentos

| Nome no DS | Nome técnico sugerido | Cor padrão | Descrição visual | Uso |
|---|---|---|---|---|
| Gráfico de barras | `bar-chart` | Neutral | Barras ascendentes | Métricas |
| Gráfico de linha | `line-chart` | Neutral | Linha ascendente com eixo | Tendências |
| Documento | `document` | Neutral | Folha com dobra | Documento/pedido/NF |
| Impressão | `print` | Neutral | Impressora | Imprimir |
| Upload | `upload` | Neutral | Seta para cima em base | Upload de arquivos |
| Download | `download` | Neutral | Seta para baixo em base | Download de arquivos |

---

## 8. Descrições construtivas dos principais ícones

### 8.1 Dashboard

- Canvas `24 × 24`.
- Quatro quadrados arredondados.
- Cada quadrado com `6 × 6 px` aproximadamente.
- Gap interno de `4 px`.
- Stroke `2 px`.
- Radius dos quadrados `1.5–2 px`.

### 8.2 Recebimento

- Cubo isométrico central.
- Setinha para baixo no lado direito ou inferior.
- Evitar excesso de linhas internas.
- Deve parecer entrada de mercadoria, não apenas embalagem.

### 8.3 Pesagem

- Prato superior horizontal.
- Corpo trapezoidal ou retangular da balança.
- Círculo/ponto central opcional.
- Base inferior horizontal.
- Deve ser legível em `20 px`.

### 8.4 Expedição

- Retângulo com cantos arredondados representando porta/saída.
- Seta para direita com haste curta.
- A seta deve atravessar visualmente a lateral direita.
- Usar para saída de mercadoria, expedição e concluir carga.

### 8.5 Estoque

- Três cubos empilhados, estilo isométrico simples.
- Um cubo superior e dois inferiores.
- Linhas internas reduzidas.
- Evitar parecer molécula ou rede.

### 8.6 Pedidos

- Carrinho com cesta inclinada ou retangular.
- Duas rodas circulares.
- Haste simples.
- Stroke consistente com demais ícones.

### 8.7 Clientes

- Duas silhuetas humanas.
- Cabeças circulares.
- Ombros com arcos simples.
- Não usar preenchimento.

### 8.8 Financeiro

- Círculo externo.
- Símbolo `$` centralizado.
- Cifrão pode ser texto convertido em path ou desenhado manualmente.

### 8.9 Relatórios

- Três ou quatro barras verticais ascendentes.
- Linha de base opcional.
- Alturas progressivas.
- Evitar gráfico excessivamente detalhado.

### 8.10 Configurações

- Engrenagem com 8 dentes preferencialmente.
- Círculo central.
- Em tamanho pequeno, simplificar dentes para manter legibilidade.

### 8.11 Carne/Corte

- Forma oval irregular representando corte de carne.
- Um círculo interno ou curva representando gordura/miolo.
- Linha curva externa.
- Não usar textura; manter linear.

### 8.12 Frigorífico

- Fachada industrial simples.
- Telhado serrilhado.
- Pequenos retângulos como janelas.
- Base horizontal.

### 8.13 Alerta

- Triângulo de cantos arredondados.
- Exclamação central.
- Stroke vermelho.
- Deve ser usado também em alert cards.

### 8.14 Bloqueado

- Cadeado com arco superior.
- Corpo retangular com radius.
- Ponto/chave central opcional.
- Usar cor neutra ou vermelha dependendo do contexto.

### 8.15 Pendente

- Círculo com ponteiros de relógio.
- Ponteiro vertical/horizontal simples.
- Cor warning ou neutral.

### 8.16 Divergência

- Círculo com exclamação.
- Cor warning.
- Usar em divergências de peso, quantidade, pedido e conferência.

---

## 9. Ícones na sidebar

Na sidebar, os ícones aparecem em branco sobre gradiente azul.

### 9.1 Especificação

| Propriedade | Valor |
|---|---:|
| Tamanho visual | `20–22 px` |
| Canvas | `24 × 24 px` |
| Cor | `#FFFFFF` |
| Opacidade default | `90%` |
| Opacidade active | `100%` |
| Item active background | `rgba(255,255,255,0.16–0.18)` |

### 9.2 Ícones usados na sidebar da tela

```text
Dashboard
Recebimento
Pesagem
Expedição
Estoque
Pedidos
Clientes
Financeiro
Relatórios
Configurações
Unidade/Matriz
```

---

## 10. Ícones em cards de KPI

Na tela de dashboard, os cards usam ícones dentro de círculos suaves.

### 10.1 Especificação

| Elemento | Valor |
|---|---:|
| Container circular | `44 × 44 px` ou `48 × 48 px` |
| Radius | `9999 px` |
| Fundo recebido | `rgba(59,130,246,0.12)` |
| Fundo pesado | `rgba(139,92,246,0.12)` |
| Fundo expedição | `rgba(16,185,129,0.12)` |
| Fundo divergência | `rgba(245,158,11,0.12)` |
| Ícone | `22–24 px` |

---

## 11. Ícones em alertas

No right rail da tela, os alertas usam ícones de status dentro de círculos com fundo suave.

| Tipo | Ícone | Cor | Fundo |
|---|---|---|---|
| Pedido bloqueado | Bloqueado | `#EF4444` | `rgba(239,68,68,0.12)` |
| Divergência aberta | Alerta/Divergência | `#F59E0B` | `rgba(245,158,11,0.12)` |
| Pesagem pendente | Pesagem | `#3B82F6` ou `#8B5CF6` | `rgba(59,130,246,0.12)` |
| Estoque baixo | Caixa/Estoque | `#64748B` | `rgba(100,116,139,0.12)` |

---

## 12. Card de ícone no guia do DS

Cada ícone no guia deve ser apresentado em um card próprio.

```text
IconCard
├── Icon container
│   └── Icon component
└── Label
```

### 12.1 Especificação do IconCard

| Propriedade | Valor |
|---|---:|
| Width | `120 px` |
| Height | `156 px` |
| Background | `#FFFFFF` |
| Border | `1 px #E2E8F0` |
| Radius | `10 px` |
| Padding top | `24 px` |
| Gap icon-label | `22–26 px` |
| Icon size | `44–48 px` |
| Label font | Inter 15/500 |
| Label color | `#0F172A` |
| Shadow | none ou muito sutil |

---

## 13. Variáveis de cor no Figma

Criar coleção:

```text
Icon / Color
├── icon/primary       #2563EB
├── icon/neutral       #64748B
├── icon/success       #16A34A
├── icon/warning       #F59E0B
├── icon/error         #DC2626
├── icon/info          #2563EB
├── icon/white         #FFFFFF
└── icon/disabled      #CBD5E1
```

Criar coleção complementar:

```text
Status / Color
├── status/recebido     #3B82F6
├── status/pesado       #8B5CF6
├── status/expedido     #10B981
├── status/divergencia  #F59E0B
├── status/bloqueado    #EF4444
└── status/pendente     #94A3B8
```

---

## 14. Critérios de qualidade

### 14.1 Consistência

- [ ] Todos os ícones usam canvas `24 × 24`.
- [ ] Todos possuem stroke visual equivalente.
- [ ] Todos usam cap e join arredondados.
- [ ] Nenhum ícone tem preenchimento indevido.
- [ ] Todos estão centralizados opticamente.
- [ ] Todos funcionam em `16 px`.
- [ ] Todos funcionam em branco sobre sidebar azul.
- [ ] Todos possuem nomes em português no Figma.

### 14.2 Performance e exportação

- [ ] Ícones exportam como SVG limpo.
- [ ] Não há bitmaps dentro dos componentes.
- [ ] Não há sombras em ícones base.
- [ ] Não há masks desnecessárias.
- [ ] Paths estão simplificados.
- [ ] Bounding box preservado em `24 × 24`.

---

## 15. Mapeamento para código

Recomenda-se exportar os nomes técnicos em kebab-case:

```text
dashboard.svg
receiving.svg
weighing.svg
shipping.svg
inventory.svg
orders.svg
customers.svg
finance.svg
reports.svg
settings.svg
search.svg
notifications.svg
user.svg
calendar.svg
filter.svg
table.svg
truck.svg
box.svg
tag.svg
scale.svg
meat-cut.svg
factory.svg
alert.svg
check.svg
blocked.svg
pending.svg
divergence.svg
received.svg
weighed.svg
shipped.svg
bar-chart.svg
line-chart.svg
document.svg
print.svg
upload.svg
download.svg
menu.svg
more-actions.svg
avatar.svg
location.svg
branch.svg
```

---

## 16. Observação crítica

A imagem de referência de iconografia deve ser usada como guia visual. A entrega final correta deve ser uma biblioteca vetorial limpa. Não importar os ícones como recortes rasterizados. Cada ícone precisa ser redesenhado ou importado como SVG editável, componentizado e vinculado a tokens de cor.
