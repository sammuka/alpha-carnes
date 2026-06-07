# AlphaCarnes — Especificação Técnica do Logo para Reconstrução no Figma

**Documento:** `alphacarnes_logo_spec.md`  
**Objetivo:** orientar a reconstrução fiel do logo AlphaCarnes no Figma, com variações de uso, tokens, proporções, anatomia visual, regras de exportação e critérios de qualidade.  
**Imagem de referência principal:** `Logo AlphaCarnes.png`  
**Dimensão da referência:** `1448 × 1086 px`  
**Marca:** AlphaCarnes  
**Subtítulo:** Distribuição de Carnes  
**Contexto de uso:** Design System AlphaCarnes, dashboard operacional, sidebar do sistema, materiais institucionais e componentes de identidade visual.

---

## 1. Leitura visual da marca

O logo AlphaCarnes apresentado na imagem de referência possui uma linguagem corporativa, tecnológica e operacional. Ele combina um símbolo de cabeça de boi estilizada com uma wordmark geométrica. A composição comunica distribuição de carnes, controle operacional, robustez, rastreabilidade e confiabilidade.

A marca não deve ser interpretada como artesanal, rural ou frigorífica tradicional. A leitura correta é: **empresa operacional/tecnológica de distribuição de carnes**, com um visual adequado para ERP, logística, controle de pedidos, recebimento, pesagem, expedição e estoque.

---

## 2. Anatomia geral do logo

A imagem contém duas aplicações principais:

1. **Logo horizontal completo**  
   Símbolo à esquerda, wordmark à direita e subtítulo abaixo da wordmark.

2. **Símbolo isolado**  
   Cabeça de boi com círculo parcial, usado como ícone, avatar, app icon, favicon, marca reduzida e elemento visual na sidebar.

### 2.1 Estrutura do logo horizontal

```text
┌──────────────────────────────────────────────────────────────┐
│ [Símbolo do boi]  AlphaCarnes                                │
│                  D I S T R I B U I Ç Ã O   D E   C A R N E S │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Hierarquia visual

- O símbolo é o elemento de maior personalidade da marca.
- A wordmark `AlphaCarnes` é o elemento de identificação verbal.
- O subtítulo `DISTRIBUIÇÃO DE CARNES` contextualiza o negócio e deve ter leitura secundária.
- A palavra `Alpha` usa azul-marinho profundo.
- A palavra `Carnes` usa azul vivo/primário.
- O subtítulo usa azul-marinho ou neutral escuro, com espaçamento amplo entre letras.

---

## 3. Especificação do símbolo

### 3.1 Conceito do símbolo

O símbolo é uma representação frontal de uma cabeça de boi/touro, com construção geométrica e simétrica. Ele sugere força, rastreabilidade, controle e setor de carnes, sem cair em linguagem agro rústica.

### 3.2 Elementos do símbolo

| Elemento | Descrição | Observação para Figma |
|---|---|---|
| Chifre esquerdo | Forma angular, ascendente, com ponta afilada para cima | Deve espelhar o chifre direito |
| Chifre direito | Forma angular simétrica ao chifre esquerdo | Usar mirror horizontal para máxima simetria |
| Cabeça central | Plano vertical geométrico com facetas retas | Deve formar eixo central forte |
| Focinho inferior | Ponta central afilada, apontando para baixo | Deve alinhar com o eixo vertical do símbolo |
| Cortes laterais do rosto | Recortes brancos/negativos simulando planos da face | Devem ser vetoriais limpos, não rasterizados |
| Círculo parcial externo | Arco circular azul envolvendo a cabeça | Não é círculo completo; possui interrupções visuais pelo boi |
| Contraste negativo | Áreas brancas internas | Essenciais para leitura em tamanho reduzido |

### 3.3 Geometria recomendada

Para reconstrução vetorial limpa no Figma, utilizar um frame mestre quadrado.

| Propriedade | Valor recomendado |
|---|---:|
| Frame mestre do símbolo | `512 × 512 px` |
| Grid base | `8 px` |
| Eixo vertical | `x = 256 px` |
| Círculo externo aproximado | centro `256, 260`; raio `178–188 px` |
| Largura máxima com chifres | `430–455 px` |
| Altura máxima | `400–430 px` |
| Padding mínimo interno | `36–44 px` |

### 3.4 Construção vetorial sugerida

Criar o símbolo com camadas nomeadas:

```text
LogoSymbol/AlphaCarnes
├── Arc/OuterBlue
├── Head/LeftHorn
├── Head/RightHorn
├── Head/CenterFace
├── Head/LeftFacePlane
├── Head/RightFacePlane
├── Cutout/LeftEyeNegative
├── Cutout/RightEyeNegative
├── Cutout/CenterNegative
└── Highlights/OptionalGradientOverlay
```

### 3.5 Simetria

A cabeça deve ser perfeitamente simétrica em relação ao eixo vertical. O processo recomendado é:

1. Desenhar metade esquerda do símbolo.
2. Duplicar.
3. Espelhar horizontalmente.
4. Ajustar apenas a junção central, sem distorcer as metades.
5. Validar com uma guia vertical central.

### 3.6 Estilo visual do símbolo

- Bordas externas com cortes retos e fortes.
- Pontas dos chifres levemente afiladas.
- Sem traços finos demais.
- Sem excesso de detalhes internos.
- Contraste forte entre azul-marinho, azul primário e áreas brancas.
- Aparência final deve parecer um símbolo vetorial moderno, não uma ilustração pictórica.

---

## 4. Paleta do logo

A referência visual usa uma combinação de azul-marinho e azul vivo. Para padronização no DS, usar os seguintes tokens.

### 4.1 Tokens principais

| Token | Valor | Uso |
|---|---:|---|
| `brand.logo.navy` | `#05224E` | Palavra `Alpha`, partes escuras do boi, textos escuros |
| `brand.logo.navy.deep` | `#031A3D` | Sombras internas e áreas mais profundas |
| `brand.logo.blue` | `#2563EB` | Palavra `Carnes`, arco circular, detalhes principais |
| `brand.logo.blue.strong` | `#0A55EC` | Gradiente/ênfase em partes azuis |
| `brand.logo.blue.light` | `#6797F2` | Highlights ocasionais, versão renderizada |
| `brand.logo.white` | `#FFFFFF` | Versão negativa, recortes e aplicações sobre sidebar |

### 4.2 Gradiente do símbolo

Na imagem, o símbolo tem aparência levemente volumétrica. Se o Figma permitir gradiente sem comprometer a clareza, usar:

```text
brand.logo.gradient.blue
Linear gradient 135°
0%   #05224E
45%  #0A55EC
100% #2563EB
```

Para uma versão de produção mais limpa, também criar versão flat:

```text
brand.logo.flat.navy = #05224E
brand.logo.flat.blue = #2563EB
```

### 4.3 Versões monocromáticas

Criar obrigatoriamente:

| Versão | Cor | Uso |
|---|---|---|
| `Logo/Mono/Navy` | `#05224E` | Fundo claro, documentos |
| `Logo/Mono/White` | `#FFFFFF` | Sidebar, fundo escuro, splash |
| `Logo/Mono/Blue` | `#2563EB` | App icon, estados especiais |
| `Logo/Symbol/White` | `#FFFFFF` | Sidebar e topbar escura |

---

## 5. Wordmark AlphaCarnes

### 5.1 Texto principal

Texto exato:

```text
AlphaCarnes
```

A wordmark aparenta ser uma fonte geométrica tecnológica, com cantos levemente quadrados e peso alto. Pode ser customizada por vetor, mas se for necessário iniciar com uma fonte editável, usar uma das opções abaixo.

### 5.2 Fontes candidatas

| Prioridade | Fonte | Uso sugerido | Observação |
|---:|---|---|---|
| 1 | Exo 2 ExtraBold / SemiBold | Base para wordmark | Boa estética tecnológica |
| 2 | Rajdhani Bold | Alternativa angular | Pode precisar de ajuste de largura |
| 3 | Chakra Petch SemiBold | Alternativa técnica | Boa para ERP/industrial |
| 4 | Orbitron Medium/Bold | Alternativa futurista | Pode ficar excessivamente sci-fi |
| 5 | Inter Display Black | Alternativa segura | Menos parecida, mas limpa |

**Recomendação:** para fidelidade máxima, converter o texto em vetor e ajustar manualmente proporções, especialmente a letra `C` de `Carnes`, que na referência tem presença visual forte.

### 5.3 Cores na wordmark

| Parte | Cor |
|---|---|
| `Alpha` | `brand.logo.navy` `#05224E` |
| `Carnes` | `brand.logo.blue` `#2563EB` |

### 5.4 Proporções visuais da wordmark

| Propriedade | Diretriz |
|---|---|
| Altura da wordmark | Aproximadamente `38–45%` da altura do símbolo no logo horizontal |
| Peso | Bold/ExtraBold |
| Tracking | Baixo a neutro, sem espaçamento exagerado |
| Kerning | Ajustar manualmente entre `aC`, `Car`, `ne` |
| Alinhamento vertical | Centro óptico com símbolo, levemente acima do subtítulo |

---

## 6. Subtítulo

Texto exato:

```text
DISTRIBUIÇÃO DE CARNES
```

### 6.1 Estilo

| Propriedade | Valor recomendado |
|---|---|
| Fonte | Inter Medium, Exo 2 Medium ou Rajdhani Medium |
| Caixa | Alta |
| Peso | 500 ou 600 |
| Tracking | `0.28em–0.42em` |
| Cor | `#05224E` |
| Tamanho relativo | `18–24%` da altura da wordmark |
| Alinhamento | Centralizado sob a wordmark |

### 6.2 Regras

- O subtítulo nunca deve competir com `AlphaCarnes`.
- Em tamanhos pequenos, o subtítulo pode ser removido.
- Na sidebar, o subtítulo pode aparecer apenas se houver largura suficiente.
- Nunca usar o subtítulo com tracking baixo.

---

## 7. Versões oficiais do logo no Figma

Criar os seguintes componentes.

```text
Logo/Horizontal/FullColor
Logo/Horizontal/White
Logo/Horizontal/Navy
Logo/Horizontal/NoTagline
Logo/Symbol/FullColor
Logo/Symbol/White
Logo/Symbol/Navy
Logo/AppIcon/FullColor
Logo/Sidebar/White
Logo/Favicon/Simplified
```

### 7.1 Logo horizontal full color

Uso principal em telas de identidade, documentação, login, capa do DS e materiais comerciais.

### 7.2 Logo sidebar white

Uso dentro da sidebar azul em gradiente. Deve usar:

- Símbolo branco.
- Wordmark branca.
- Subtítulo branco com opacidade entre `70%` e `85%`.

### 7.3 Símbolo isolado

Uso em:

- Avatar do sistema.
- Favicon.
- Loading.
- App icon.
- Card institucional.
- Watermark.

### 7.4 Versão reduzida

Para tamanhos muito pequenos, simplificar:

- Manter chifres, cabeça central e círculo parcial.
- Remover detalhes internos muito finos.
- Evitar subtítulo.

---

## 8. Área de segurança

A área de respiro deve ser calculada com base na largura do traço/chifre lateral ou na altura da letra `A` da wordmark.

### 8.1 Regra prática

```text
Clear space mínimo = altura da letra A de Alpha / 2
```

Ou:

```text
Clear space mínimo = 12,5% da altura total do logo
```

### 8.2 Aplicação

Nenhum texto, borda, botão, gráfico ou outro elemento pode invadir essa área. Na sidebar, permitir uma redução controlada, mas ainda manter pelo menos `16 px` de padding horizontal.

---

## 9. Tamanhos mínimos

| Uso | Largura mínima | Observação |
|---|---:|---|
| Logo horizontal com subtítulo | `220 px` | Abaixo disso o subtítulo perde leitura |
| Logo horizontal sem subtítulo | `160 px` | Bom para sidebar compacta |
| Símbolo isolado completo | `40 px` | Mantém detalhes internos |
| Símbolo simplificado | `24 px` | Usar para favicon/ícone pequeno |
| App icon | `512 px`, `256 px`, `128 px`, `64 px` | Exportar em PNG e SVG |

---

## 10. Aplicação na sidebar do sistema

Na tela de referência, o logo aparece no topo da sidebar com símbolo branco e texto branco.

### 10.1 Especificação

| Propriedade | Valor |
|---|---:|
| Container do logo | `192 × 56 px` aproximado dentro de sidebar de `240 px` |
| Padding superior | `24 px` |
| Padding lateral | `24 px` |
| Símbolo | `32–40 px` de altura |
| Wordmark | `20–24 px` de altura |
| Subtítulo | `8–10 px`, tracking alto |
| Cor | `#FFFFFF` |
| Opacidade subtítulo | `75%–85%` |

### 10.2 Componente sugerido

```text
Brand/SidebarLogo
Properties:
- Variant: Full / Compact / SymbolOnly
- Theme: White / FullColor
```

---

## 11. Aplicação no guia de iconografia

Na imagem `Iconografia AlphaCarnes.png`, o logo aparece no canto superior esquerdo do guia. Ali, a aplicação usa:

- Símbolo full color.
- Wordmark full color.
- Subtítulo em azul-marinho.
- Fundo claro.
- Separador vertical após o logo.

### 11.1 Medida recomendada no guia

| Elemento | Valor aproximado |
|---|---:|
| Bloco do logo | `330 × 110 px` |
| Símbolo | `72 × 72 px` |
| Wordmark | `210 × 40 px` |
| Subtítulo | `180 × 12 px` |
| Separador vertical | `1 px`, `#E2E8F0` |

---

## 12. Exportação

### 12.1 Formatos obrigatórios

| Arquivo | Formato | Observação |
|---|---|---|
| `alphacarnes-logo-horizontal.svg` | SVG | Preferencial para web |
| `alphacarnes-logo-horizontal-white.svg` | SVG | Sidebar/fundo escuro |
| `alphacarnes-symbol.svg` | SVG | Ícone vetorial |
| `alphacarnes-symbol-white.svg` | SVG | Fundo escuro |
| `alphacarnes-app-icon-512.png` | PNG | App icon |
| `alphacarnes-favicon-32.png` | PNG | Favicon |
| `alphacarnes-favicon-16.png` | PNG | Favicon reduzido |

### 12.2 Regras de SVG

- Usar paths vetoriais limpos.
- Evitar máscaras complexas se possível.
- Nomear camadas de forma semântica.
- Converter textos em paths apenas nas versões finais de exportação.
- Manter versão editável com texto vivo no Figma.

---

## 13. Critérios de fidelidade visual

Validar o logo final contra a imagem de referência usando estes critérios:

| Critério | Aceitação |
|---|---|
| Silhueta do boi | Deve ser reconhecível mesmo em 40 px |
| Simetria | Chifres e face alinhados ao eixo central |
| Círculo parcial | Deve envolver a cabeça sem fechar completamente a marca |
| Wordmark | Deve transmitir tecnologia/força, sem parecer fonte genérica |
| Contraste | Azul-marinho e azul primário devem estar claros e consistentes |
| Subtítulo | Deve estar legível em tamanho médio e opcional em tamanho pequeno |
| Sidebar | Versão branca deve funcionar sobre o gradiente azul |

---

## 14. Checklist de reconstrução no Figma

- [ ] Criar frame mestre `Logo Construction / 512`.
- [ ] Criar eixo central vertical.
- [ ] Vetorizar metade esquerda do símbolo.
- [ ] Espelhar metade direita.
- [ ] Criar círculo parcial externo.
- [ ] Criar recortes internos como boolean subtract ou paths brancos.
- [ ] Criar versão full color.
- [ ] Criar versão flat.
- [ ] Criar versão white.
- [ ] Criar versão horizontal com wordmark.
- [ ] Criar versão horizontal sem subtítulo.
- [ ] Criar símbolo isolado.
- [ ] Criar componente `Logo` com variantes.
- [ ] Exportar SVGs limpos.
- [ ] Testar a 24 px, 32 px, 40 px, 160 px e 220 px.

---

## 15. Nomenclatura recomendada no Figma

```text
Brand / Logo / Horizontal / Full Color
Brand / Logo / Horizontal / White
Brand / Logo / Horizontal / Navy
Brand / Logo / Horizontal / No Tagline
Brand / Logo / Symbol / Full Color
Brand / Logo / Symbol / White
Brand / Logo / Symbol / Navy
Brand / Logo / App Icon
Brand / Logo / Favicon Simplified
```

---

## 16. Observação crítica

A imagem de referência é rasterizada. Para uso profissional no Figma e no produto, **não importar o PNG como logo final**. O PNG deve ser usado apenas como guia visual. O resultado correto deve ser um logo vetorial reconstruído, com componentes, variantes e tokens.
