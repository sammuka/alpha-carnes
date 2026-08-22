# Relatório da carga inicial — dados legados

Gerado por `scripts/carga-inicial/carga-inicial.ts`.

## Resumo

- Clientes importados: 1262
- Fornecedores importados: 447
- Veículos importados: 13
- Motoristas importados: 40
- Produtos novos no catálogo curado: 16
- Preços lançados: 23
- Registros excluídos (documento inválido/duplicado): 256

## Excluídos por CNPJ/CPF inválido ou duplicado (256)

Estes registros existem no legado, mas não foram importados porque o documento
fiscal não passa na validação de dígito verificador (ou é um placeholder do ERP
antigo, como `00000000000000`), ou porque colide com outro documento já importado.
Reconciliação manual do documento real fica pendente para o gestor.

### Clientes (7)

| Código legado | Nome | Motivo |
|---|---|---|
| 103 | CASA DE CARNES ALPHAVILLE LTDA - EPP | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 122 | SOARES MENDONCA SUP. DO GUAP. LTDA - 55 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 406 | SUPERMERCADO ALTA ROTAÇÃO LTDA (inativo) | CNPJ/CPF inválido ou placeholder ("02895198000097") |
| 1184 | MERCADO MBM EIRELI - ME   276 F | CNPJ/CPF duplicado ("23672069000167") |
| 1186 | BDML2 COMERCIO LTDA - 667 F | CNPJ/CPF duplicado ("07425463000144") |
| 1267 | SUPERMERCADO MAIS KAUCAIA LTDA - L7 F | CNPJ/CPF duplicado ("51863936000187") |
| 1268 | SUPERMERCADO MAIS KAUCAIA LTDA - L7 F | CNPJ/CPF duplicado ("51863936000187") |

### Fornecedores (249)

| Código legado | Nome | Motivo |
|---|---|---|
| 393 | 11 4247-5060 - ALPHA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 324 | 11 9 9689-2059 - ALPHA CARNES / DOUGLAS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 325 | 11 9 9901-6697 - ALPHA CARNES | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 205 | 13 º SALARIO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 94 | 13º SALARIO - DAVID NOGUEIRA DA SILVA | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 95 | 13º SALARIO - ELIOMAR FERREIRA SOUZA | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 90 | 13º SALARIO - EMANUEL NUNES GONCALVES | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 88 | 13º SALARIO - HEVELIN LORANDI SILVA | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 96 | 13º SALARIO - JUSCILER BELEM DOS SANTOS | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 89 | 13º SALARIO - KARINA FERREIRA F PALOPOLI | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 45 | 3262 - 9272 - TELEFONICA ( PORTO FELIZ) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 97 | 3262-9272 - PORTO FELIZ | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 41 | 3387 - 1741 - TELEFONICA (GUARUJA) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 98 | 3387-1741 - GUARUJA | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 42 | 3681 - 7775  - TELEFONICA  (ENTREPOSTO) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 99 | 3681-7775 - ENTREPOSTO | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 176 | 3681-8585 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 49 | 4153 - 5583 - TELEFONICA (IGUAPE) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 100 | 4153-4010 - IGUAPE | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 48 | 4153-4010 - TELEFONICA ( IGUAPE) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 101 | 4153-5583 - IGUAPE | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 40 | 4193 - 8017 - TELEFONICA  - (ESCRITORIO) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 36 | TELEFONICA TELECOMINICAÇÕES DE SÃO PAULO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 102 | 4193-8017 - CRISANTEMOS | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 43 | 4195-2467 - TELEFONICA ( ESCRITORIO) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 4 | 4195 - 7466 - TELEFONICA -  (ESCRITORIO) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 103 | 4195-2467 - CRISANTEMOS | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 105 | 7207-1892 - DNA MARLENE | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 333 | A.L.M. TRANSPORTES LTDA. EPP | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 106 | ADILSON | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 107 | AGUA - CRISANTEMOS | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 108 | AGUA - ENTREPOSTO | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 109 | AGUA - IGUAPE | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 172 | AGUA ENTREPOSTO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 692 | ALMOÇO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 189 | ALPHA DOCUMENTACOES | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 68 | ALUGUEL - DIVERSOS | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 110 | ALUGUEL | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 59 | ALUGUEL - ENTREPOSTO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 113 | AMIL - ADILSON | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 112 | AMIL - FABRICIO | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 114 | ASSOCIACAO COMERCIAL | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 142 | AUTO ELETRICO EGUCHI LTDA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 317 | AUTO ELETRICO EGUCHI LTDA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 334 | AUTO ELETRICO EGUCHI LTDA EPP | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 115 | AUTO SAT | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 216 | AUTO SUECO SAO PAULO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 221 | BRADESCO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 240 | BURITICOMERCIODECARNES | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 116 | C. SOCIAL | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 370 | CAFE / AÇUCAR | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 153 | CAIXINHA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 35 | CAIXINHA- DESPESAS DIVERSAS | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 117 | CAMINHAO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 378 | CARLOS JOSE DE LIMA | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 30 | CARTÃO BOM - PROMOBOM AUTOPASS S.A | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 129 | CASA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 340 | SEGURANÇA - CLAUDIO | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 360 | CMOL | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 118 | COMPUTADOR | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 121 | CONDOMINIO - CENTRO COMERCIAL | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 123 | CONDOMINIO - GUARUJA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 17 | CONDOMINIO - GUARUJA - EDFICIO FLAVIA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 124 | CONDOMINIO - JARDINS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 120 | CONDOMINIO - LE BOUNGAINVILLE | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 119 | CONDOMINIO - PORTO FELIZ | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 71 | CONDOMINIO - PORTO FELIZ | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 52 | CONDOMINIO CENTRO COMERCIAL DE ALPHAVILLE | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 202 | CONDOMINIO JANDIRA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 183 | CONDOMINIO CENTRO EMPRESARIAL ARAGUAIA II CEA II | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 125 | CONTABILIDADE - CONTEC | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 309 | ESCON ESCRITORIO CONTÁBIL | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 126 | CONTABILIDADE - TTL | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 169 | CONTEC | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 127 | CONTR. ASSIST. | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 128 | CONTR. SINDICAL | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 328 | RS DECOR DESIGN DE INTERIORES LTDA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 390 | CRISTAIS BAUS E REFRIGERAÇAO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 33 | DARF - 3208 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 179 | DARF ( 2073 ) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 166 | DARF ( 2484) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 151 | DARF ( 3208 ) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 194 | DARF ( 5856) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 167 | DARF ( 5993) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 195 | DARF ( 6912) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 190 | DARF (0211) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 254 | DARF (0561) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 165 | DARF (190) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 191 | DARF (4600) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 276 | DARF (5952) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 263 | DARF | CNPJ/CPF inválido ou placeholder ("22222222222") |
| 218 | DARF 2294 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 534 | DARF 6789 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 264 | DARF | CNPJ/CPF inválido ou placeholder ("33333333333") |
| 255 | DARF(1708) | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 130 | DAS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 76 | DAS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 24 | DAVI NOGUEIRA DA SILVA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 308 | AMBIENTE CONTROLE DE PRAGAS URBANAS LTDA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 199 | DELL COMPUTADORES LTDA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 320 | DOUGLAS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 321 | JUSCILER | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 322 | KARINA | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 495 | SERVIÇOS DE DETRAN | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 28 | DIESEL | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 34 | DIVERSOS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 157 | DIVERSOS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 180 | ECONJET | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 382 | EDUARDO REPRESENTAÇOES | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 23 | ELIOMAR FERREIRA SOUZA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 315 | ELOS TORE MATERIAIS PARA CONSTRUÇÃO LTDA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 18 | EMANUEL NUNES DE GONÇLVES | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 159 | EMBRATEL | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 83 | EMBRATEL - ADILSON | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 326 | CM EQUIPAMENTOS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 467 | E- SOCIAL | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 164 | ESTACIONAMENTO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 258 | EXAME ADMISSIONAL | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 31 | FABRICIO | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 140 | FABRICO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 173 | FERIAS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 154 | FGTS - FUNDO DE GARANTIA DO TEMPO DE SERVICO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 185 | FORO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 67 | FRETE | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 141 | FRETE | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 177 | GARE - GUIA DE ARRECADACAO ESTADUAL | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 310 | GUIA DE ARRECADAÇÃO ESTADUAL | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 21 | GASOLINA | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 181 | GASOLINA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 58 | FRIGORIGICO DON GLUTÃO LTDA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 175 | GPS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 201 | GRAFICA IMAGE MARK | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 341 | GRAFICA  VENDA  HOJE | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 598 | GUIA DE RECOLHIMENTO DA UNIAO - GRU | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 460 | GARE 081-4 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 20 | HEVELIN LORANDI SILVA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 149 | INTELIG | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 50 | INTELIG - 4153-4010 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 47 | INTELIG - 4195-2467 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 44 | INTELIG - 4195-7466 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 162 | INTERMEDICA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 55 | IPTU - JOÃO EUCLIDES PEREIRA, 123 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 54 | IPTU - JOÃO EUCLIDES, 184 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 111 | IPTU - ARANDU | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 73 | IPTU - ARANDU 1080 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 72 | IPTU - ARANDU 1110 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 53 | IPTU - ARMENIA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 174 | IPTU - CRISANTEMOS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 171 | IPTU - FLAT | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 137 | IPTU - GUARUJA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 56 | IPTU - GUARUJA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 196 | IPTU - JANDIRA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 207 | IPTU - MASA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 150 | IPTU - OSASCO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 57 | IPTU  - PORTO FELIZ | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 147 | IPTU - PORTO FELIZ | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 224 | IPTU DIVERSOS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 148 | IPVA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 182 | IRPF | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 675 | IRPJ CSLL | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 609 | ISS SERVIÇOS TOMADOS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 26 | JAIME PEREIRA LEITE | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 331 | JATOBA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 307 | JINSEI COMPUTADORES | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 212 | JS BORRACHEIRO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 22 | JUSCILER  BELEM DOS SANTOS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 316 | KABUM S.A - SITE DE COMPRAS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 186 | KACULAS SUPERMERCADOS LTDA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 642 | LICENCIAMENTO DE VEICULOS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 64 | LOMBADOR | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 144 | LOMBADOR | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 342 | AES ELETROPAULO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 38 | LUZ ENTREPOSTO - AS ELETROPAULO - 41433611 | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 7 | LUZ IGUAPE  - AS ELETROPAULO - 40142531 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 37 | LUZ - JOÃO EUCLIDES PEREIA - 184 - AS ELETROPAULO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 74 | LUZ - GUARUJA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 132 | LUZ - IGUAPE | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 39 | LUZ ESCRITORIO - 200421517 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 156 | LUZ PORTO FELIZ | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 32 | MARLENE | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 244 | MARQUINHOS | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 210 | MARTINS INDUSTRIA E COMERCIO DE IMPLEMENTACAO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 586 | MINISTERIO DA ECONOMIA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 29 | MOTORISTA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 143 | MOTORISTA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 168 | MULTAS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 352 | NATAL | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 241 | FRIGORIFICO NHANDEARA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 211 | NICLEVISK E CIA LTDA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 314 | O BAGAÇÃO COMÉRCIO DE MÓVEIS PARA ESCRITÓRIO LTDA. | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 217 | PERI ALIMENTOS LTDA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 530 | RETENÇÕES | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 464 | PARTICIPAÇÃO DE LUCRO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 198 | POSTO DE MOLAS ALEMAO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 226 | POUPANCA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 163 | PREVIDENCIA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 313 | TERRA NETWORKS BRASIL S/A | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 225 | RESCISAO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 65 | RESERVA | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 214 | REUCABRAS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 131 | RIVER ALIMENTOS LTDA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 204 | ROLDAO AUTO SERVICO COM DE ALIM LTDA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 9 | SABESP - IGUAPE, 100 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 327 | SABRINA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 134 | SALARIO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 215 | SAN | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 248 | HIROSH SATO E FILHOS LTDA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 319 | SANTIL COMERCIAL ELETRICA  EIRELI | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 414 | SEGURANÇA | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 158 | SEGURO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 66 | SEGURADORA PORTO SEGURO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 161 | CENTRO DE GESTAO DE MEIOS DE PGTO. LTDA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 219 | SERASA SA. | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 332 | SERRALHERIA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 61 | SIMTRATECOR SINDICATO DOS MOTORISTA E TRABALHOS N | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 60 | SINDICATO EMPREGADOS NO COMERCIO DE OSASCO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 138 | SINDICATO EMPREGADOS NO COMERCIO DE OSASCO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 62 | SIMTRATECOR SINDICATO MOTORISTA CARGAS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 160 | SINERGIA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 256 | SINETROSV | CNPJ/CPF inválido ou placeholder ("11111111111") |
| 139 | SINTRATECOR SIND DOS MOTO E TRAB NO RAMO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 236 | TA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 197 | TARIFAS BANCARIAS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 178 | TAXA INCENDIO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 192 | TAXAS | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 208 | NICLEVISK E CIA LTDA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 323 | ADIANTAMENTO DE SALARIO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 80 | VALE - DAVID NOGUEIRA DA SILVA | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 82 | VALE - ELIOMAR FERREIRA SOUZA | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 79 | VALE - EMANUEL NUNES GONCALVES | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 77 | VALE - HEVELIN LORANDI SILVA | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 81 | VALE - JUSCILER BELEM DOS SANTOS | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 78 | VALE - KARINA F. DE F. PALOPOLI | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 136 | VALE REFEICAO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 84 | VALE TRANSPORTE - HEVELIN LORANDI | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 133 | VALE TRANSPORTE | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 70 | FUNCIONARIOS | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 69 | FUNCIONARIOS | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 85 | VALE TRANSPORTE - KARINA PALOPOLI | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 347 | NATAL | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 374 | ELISEU | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 312 | JULIANA FERRARI PACHECO | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 213 | VICENTE COMPRA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 239 | TRANSPORTADORA TRANS BIBI LTDA | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 155 | VIVO SA | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 46 | VIVO - 7207 - 7892 | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 209 | BANCO VOLVO ( BRASIL) S/A | CNPJ/CPF inválido ou placeholder ("00000000000000") |
| 27 | WILSON DE ARAUJO MOREIRA | CNPJ/CPF inválido ou placeholder ("00000000000") |
| 184 | XEROX | CNPJ/CPF inválido ou placeholder ("00000000000000") |
