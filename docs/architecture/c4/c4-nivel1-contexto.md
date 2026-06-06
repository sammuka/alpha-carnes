# C4 Nível 1 — Diagrama de Contexto

## Descrição
Visão de alto nível: quem usa o sistema e com quais sistemas externos ele se comunica.

```mermaid
C4Context
    title AlphaCarnes — Diagrama de Contexto

    Person(compras, "Comprador", "Registra compra programada e disponibilidade virtual")
    Person(comercial, "Vendedor", "Registra pedidos de clientes sobre disponibilidade virtual")
    Person(pesagem, "Op. Pesagem", "Pesa peças e confirma associação a pedidos (terminal touch)")
    Person(expedicao, "Op. Expedição", "Confere e fecha carga do caminhão (terminal touch)")
    Person(faturamento, "Faturamento", "Emite NFS-e e libera caminhão")
    Person(gestor, "Gestor/Diretoria", "Dashboards, KPIs, auditoria")

    System(alphacarnes, "Sistema AlphaCarnes", "Gestão operacional de cross-docking: compra programada, disponibilidade virtual, pesagem, expedição, faturamento e dashboards")

    System_Ext(eiss, "EISS NFS-e\nPrefeitura de Osasco-SP", "Emissão de Nota Fiscal de Serviços Eletrônica")
    System_Ext(balanca, "Balança Industrial\n(RS-232/serial)", "Fornece leituras de peso das peças")
    System_Ext(impressora, "Impressora de Etiquetas\n(ZPL/ESC-POS)", "Imprime etiquetas com QR code")
    System_Ext(leitor_qr, "Leitores QR Code", "Leitura de etiquetas na expedição e conferência")
    System_Ext(email, "Servidor de E-mail", "Envio de NFS-e e DANFE ao motorista")

    Rel(compras, alphacarnes, "Registra compra programada")
    Rel(comercial, alphacarnes, "Registra pedidos")
    Rel(pesagem, alphacarnes, "Pesa e associa peças")
    Rel(expedicao, alphacarnes, "Confere e fecha carga")
    Rel(faturamento, alphacarnes, "Emite NFS-e")
    Rel(gestor, alphacarnes, "Consulta dashboards e relatórios")

    Rel(alphacarnes, eiss, "Emite NFS-e via SOAP")
    Rel(alphacarnes, balanca, "Lê peso via serial RS-232")
    Rel(alphacarnes, impressora, "Envia payload ZPL/ESC-POS")
    Rel(alphacarnes, leitor_qr, "Recebe leituras de QR code")
    Rel(alphacarnes, email, "Envia DANFE e NFS-e")
```

## Atores

| Ator | Perfil no sistema | Uso principal |
|------|------------------|---------------|
| Comprador | `compras` | Compra Programada, Disponibilidade Virtual |
| Vendedor | `comercial` | Pedidos de Venda |
| Operador de Pesagem | `operador_pesagem` | Terminal de Pesagem |
| Operador de Corte | `operador_corte` | Corte e Transformação |
| Operador de Expedição | `operador_expedicao` | Terminal de Expedição |
| Conferente | `conferente` | Conferência de carga |
| Faturamento | `faturamento` | Emissão NFS-e |
| Gestor | `gestor` | Dashboards, aprovações |
| Diretoria | `diretoria` | Relatórios executivos |
| Administrador | `administrador` | Cadastros, configurações |
| Auditoria | `auditoria` | Consulta de auditoria |

## Sistemas Externos

| Sistema | Protocolo | Criticidade |
|---------|-----------|-------------|
| EISS NFS-e (Osasco-SP) | SOAP/HTTPS | Alta — bloqueante para liberar caminhão |
| Balança Industrial | RS-232 serial | Alta — bloqueante para pesagem |
| Impressora de Etiquetas | ZPL/ESC-POS (TCP ou USB) | Alta — necessária para rastreabilidade |
| Leitores QR Code | USB HID / TCP | Média — expedição pode funcionar sem |
| Servidor de E-mail | SMTP | Baixa — envio assíncrono ao motorista |
