# 017-infraestrutura-e-equipamentos-recomendados-para-operacao

## Objetivo do documento
Consolidar a recomendação macro de infraestrutura e equipamentos da solução AlphaCarnes, considerando:
1. os postos operacionais e administrativos previstos;
2. a arquitetura on-premises detalhada no documento 018;
3. a preferência por estações mínimas, pequenas e com Linux;
4. a necessidade de integração com balança, impressoras, leitores, tablets e dashboards;
5. e a necessidade de manter a operação estável, rastreável e escalável.

Este documento deve ser lido como o **inventário macro recomendado de infraestrutura**.  
O detalhamento arquitetural on-premises, topologia e acesso externo está no documento:
- **018-arquitetura-onpremises-e-topologia-de-equipamentos-minimos.md**

---

# 1. Princípios da recomendação

## 1.1 Princípios gerais
A infraestrutura da AlphaCarnes deve:
- suportar a operação em tempo real;
- reduzir dependência de processos manuais;
- manter integração estável com equipamentos físicos;
- usar estações simples e padronizadas;
- permitir crescimento gradual;
- evitar superdimensionamento desnecessário na V1;
- e manter contingência mínima nos pontos críticos.

## 1.2 Direcionadores principais
- postos fixos preferencialmente com **mini PCs Linux**;
- tablets para mobilidade e conferência;
- leitores QR/2D como periféricos de operação;
- balança e impressão tratadas com integração local controlada;
- rede local estável como requisito obrigatório;
- servidor on-premises local como base operacional da V1.

---

# 2. Estrutura de referência da operação

A operação exige, em alto nível, os seguintes pontos de uso:

1. **Compras / Comercial**
2. **Pesagem / Recebimento**
3. **Corte / Transformação**
4. **Expedição**
5. **Conferência móvel**
6. **Faturamento / Liberação**
7. **Monitoramento por TV / Dashboard**
8. **Infraestrutura central on-premises**

---

# 3. Classes de equipamentos

Para simplificar a análise, os equipamentos são separados em:

1. **Infraestrutura central**
2. **Estações fixas**
3. **Periféricos operacionais**
4. **Dispositivos móveis**
5. **Rede e conectividade**
6. **Contingência**
7. **Painel operacional / TV**

---

# 4. Infraestrutura central

## 4.1 Servidor on-premises principal
### Finalidade
Hospedar:
- frontend web;
- backend/API;
- banco de dados;
- serviço de tempo real;
- storage local de documentos;
- integrações lógicas do sistema.

### Recomendação macro
Na **V1**, a AlphaCarnes deve ter:
- **1 servidor local principal** bem dimensionado;
- Linux Server;
- SSD/NVMe;
- backup;
- nobreak;
- boa ventilação e segurança física.

### Evolução recomendada
Quando a operação crescer:
- separar banco e aplicação em hosts distintos;
- adicionar storage/backup dedicado;
- acrescentar maior redundância.

---

## 4.2 Storage e backup
### Finalidade
Armazenar:
- PDFs/DANFE;
- documentos fiscais;
- evidências e anexos;
- backups do sistema e banco.

### Recomendação macro
Na V1:
- storage local no servidor principal ou volume dedicado;
- rotina automatizada de backup;
- cópia externa/offsite, se possível.

---

## 4.3 Firewall / roteador corporativo
### Finalidade
- controlar a rede interna;
- suportar publicação segura, se houver;
- suportar VPN para acesso externo;
- registrar e proteger o tráfego.

### Recomendação macro
Obrigatório no cenário on-premises com acesso externo controlado.

---

# 5. Estações fixas preferenciais

## 5.1 Diretriz padrão
As estações fixas devem ser, preferencialmente:
- **mini PCs Linux**
- pequenos
- silenciosos
- de baixo consumo
- com SSD
- com navegador moderno
- com múltiplas portas USB
- com rede gigabit

## 5.2 Motivos para preferir mini PCs Linux
- custo total menor que desktops tradicionais, em muitos cenários;
- menor espaço físico;
- padronização;
- boa aderência a aplicação web;
- facilidade de modo kiosk;
- facilidade para integrar agentes leves de balança/impressão;
- menor dependência de licenciamento.

## 5.3 Especificação macro mínima sugerida
- CPU: 4 núcleos ou equivalente
- RAM: 8 GB
- SSD: 256 GB
- rede gigabit
- pelo menos 4 portas USB
- saída HDMI/DisplayPort
- Linux Desktop estável

---

# 6. Posto por posto

## 6.1 Compras / Comercial
### Finalidade
- compra programada;
- disponibilidade virtual;
- pedidos;
- monitoramento comercial.

### Equipamentos recomendados
- 1 mini PC Linux
- 1 monitor 22" a 24"
- teclado e mouse
- rede cabeada, preferencialmente

### Observações
Não requer programação local específica do SO.  
Opera essencialmente via navegador.

---

## 6.2 Pesagem / Recebimento
### Finalidade
- capturar peso;
- associar peça ao pedido;
- imprimir etiqueta;
- registrar divergência;
- encaminhar para corte/expedição.

### Equipamentos recomendados
- 1 mini PC Linux dedicado
- 1 monitor 22" a 24" ou touch
- 1 balança integrada
- 1 impressora de etiqueta principal
- 1 leitor QR/2D
- 1 adaptador USB-RS232, se necessário
- 1 nobreak dedicado

### Observações importantes
Este é o posto mais crítico da operação.  
É o principal candidato a precisar de **agente local** para:
- leitura da balança;
- acionamento controlado da impressão.

---

## 6.3 Corte / Transformação
### Finalidade
- registrar corte;
- gerar subitens;
- reetiquetar;
- pesar subitens, se aplicável.

### Equipamentos recomendados
- 1 mini PC Linux ou estação compartilhada, conforme volume real
- 1 monitor
- 1 leitor QR/2D
- 1 impressora de etiqueta de apoio ou compartilhada
- 1 balança local, se o processo exigir

### Observações
Na V1, pode ser dedicado ou compartilhado com outro posto, dependendo do fluxo real.

---

## 6.4 Expedição
### Finalidade
- montar carga;
- transferir peças entre pedidos enquanto permitido;
- acompanhar o caminhão;
- fechar expedição.

### Equipamentos recomendados
- 1 mini PC Linux
- 1 monitor 22" a 24"
- 1 leitor QR/2D
- 1 nobreak compartilhado ou dedicado
- impressora de apoio opcional

### Observações
Opera principalmente por navegador e atualização em tempo real.

---

## 6.5 Faturamento / Liberação
### Finalidade
- consolidar carga;
- emitir NF;
- gerar seguro;
- enviar documentos;
- liberar caminhão.

### Equipamentos recomendados
- 1 mini PC Linux
- 1 monitor 24"
- teclado e mouse
- rede cabeada
- impressora A4 opcional

### Observações
Embora possa operar em navegador, este posto depende da estabilidade do servidor local e da integração fiscal.

---

# 7. Dispositivos móveis

## 7.1 Tablets para conferência
### Finalidade
- conferência de carga;
- consulta de pedidos;
- leitura e validação em doca/caminhão;
- registro de faltas/sobras/divergências.

### Quantidade sugerida
- 2 tablets para a V1

### Características recomendadas
- autonomia razoável
- resistência maior que tablet de consumo comum, de preferência com capa robusta
- boa conectividade Wi‑Fi
- tela legível em operação

### Observações
Na V1, devem operar preferencialmente com **aplicação web responsiva**, sem necessidade obrigatória de app nativo.

---

# 8. Periféricos operacionais

## 8.1 Impressoras de etiqueta
### Quantidade sugerida
- 2 unidades

### Distribuição recomendada
- 1 principal na pesagem
- 1 apoio/contingência para corte ou expedição

### Finalidade
- etiqueta inicial da peça
- reetiquetagem após corte
- contingência operacional

### Observações
Devem ser compatíveis com a estratégia de integração definida com a balança/terminal.

---

## 8.2 Leitores QR/2D
### Quantidade sugerida
- 4 unidades

### Distribuição recomendada
- 1 pesagem
- 1 corte
- 2 expedição/conferência

### Finalidade
- leitura de peças
- leitura de subitens
- conferência de carga
- rastreabilidade operacional

### Observações
Na maior parte dos cenários, funcionam como dispositivo padrão de entrada e não exigem app nativo específico.

---

## 8.3 Adaptadores USB-RS232
### Quantidade sugerida
- 2 unidades

### Finalidade
- integrar balança
- cobrir eventuais periféricos seriais

### Observações
Devem ser estáveis e padronizados.

---

# 9. TV / painel operacional

## 9.1 Finalidade
Exibir o dashboard operacional do dia em área visível.

## 9.2 Conteúdo sugerido da TV
- lote do dia
- percentual vendido / recebido / expedido
- caminhões em carga
- caminhões fechados
- caminhões liberados
- alertas críticos
- peças em corte
- pendências do faturamento
- fila operacional

## 9.3 Equipamentos recomendados
- 1 TV de 43" a 55"
- 1 mini PC Linux ou player dedicado
- suporte de parede
- conexão cabeada preferencialmente

## 9.4 Observações
A TV funciona como cliente de dashboard em tempo real, não como posto transacional.  
Ela não precisa de lógica de negócio local.

---

# 10. Rede e conectividade

## 10.1 Componentes recomendados
- 1 switch gigabit
- 2 access points Wi‑Fi corporativos
- cabeamento para pontos fixos críticos
- 1 firewall/router corporativo

## 10.2 Pontos que devem ser cabeados, preferencialmente
- servidor
- pesagem
- expedição
- faturamento
- TV/painel operacional

## 10.3 Pontos que podem usar Wi‑Fi
- tablets
- estações não críticas, se necessário
- acessos de consulta leve

---

# 11. Contingência mínima

## 11.1 Energia
Devem ter nobreak:
- servidor
- pesagem
- impressora principal
- expedição fixa, preferencialmente

## 11.2 Impressão
Deve haver impressora de contingência ou compartilhável.

## 11.3 Rede
A operação local deve continuar funcional mesmo sem internet externa, desde que a rede interna esteja íntegra.

## 11.4 Fallback operacional controlado
O sistema deve aceitar, com auditoria:
- peso manual;
- reimpressão;
- reprocessamento fiscal controlado.

---

# 12. Inventário macro recomendado para a V1

## 12.1 Quantitativo sugerido
- 1 servidor on-premises principal
- 4 mini PCs Linux
- 4 monitores
- 2 impressoras de etiqueta
- 2 tablets
- 4 leitores QR/2D
- 2 adaptadores USB-RS232
- 1 switch gigabit
- 2 access points Wi‑Fi
- 1 firewall/router corporativo
- 2 a 3 nobreaks
- 1 TV 43" a 55"
- 1 mini PC/player para a TV
- 1 impressora A4 opcional

## 12.2 Distribuição resumida
### Estações fixas
- compras/comercial
- pesagem
- expedição
- faturamento

### Móveis
- 2 tablets para conferência

### Painel
- 1 TV de dashboard

---

# 13. Classificação por criticidade

## 13.1 Críticos
- servidor local
- estação da pesagem
- impressora de etiqueta principal
- estação da expedição
- estação do faturamento
- rede local estável

## 13.2 Muito recomendáveis
- tablets
- impressora de contingência
- nobreaks
- TV com dashboard operacional

## 13.3 Evolução / maturidade
- segundo servidor
- storage dedicado
- maior redundância de conectividade
- maior robustez física dos postos operacionais

---

# 14. Relação com o documento 018

Este documento 017 deve ser entendido como:
- **inventário macro e recomendação de infraestrutura/equipamentos**

Enquanto o documento 018 detalha:
- topologia on-premises
- integração da TV
- agentes locais
- arquitetura do servidor
- acesso externo seguro

---

# 15. Resultado esperado deste documento
Com este documento, a AlphaCarnes passa a ter uma visão consolidada e executiva dos equipamentos e da infraestrutura necessários para sustentar a solução, já alinhada ao desenho on-premises definido no documento 018.
