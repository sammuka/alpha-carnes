// Network topology data for the AlphaCarnes on-premises infrastructure
// Based on Doc 018 — Arquitetura On-Premises e Topologia

export const topologyNodes = [
  // ── Core Infrastructure ──────────────────────────────────────────
  {
    id: 'firewall', type: 'security', label: 'Firewall / Router',
    x: 500, y: 30,
    specs: 'pfSense ou similar, VPN site-to-site, IDS/IPS',
    purpose: 'Seguranca perimetral, NAT, VPN para acesso remoto',
  },
  {
    id: 'servidor', type: 'server', label: 'Servidor Principal',
    x: 500, y: 120,
    specs: 'CPU 8+ cores, 32 GB RAM, SSD NVMe, RAID 1',
    purpose: 'Backend, banco de dados PostgreSQL, servicos internos',
  },
  {
    id: 'switch', type: 'network', label: 'Switch Gerenciavel',
    x: 500, y: 250,
    specs: '24 portas Gigabit, VLAN, PoE+, gerenciamento L2/L3',
    purpose: 'Backbone da rede local, segmentacao por VLAN',
  },

  // ── Access Points ────────────────────────────────────────────────
  {
    id: 'ap_operacional', type: 'wireless', label: 'AP Operacional',
    x: 280, y: 250,
    specs: 'Wi-Fi 6, 2.4/5 GHz, PoE, IP67 opcional',
    purpose: 'Cobertura area de producao e pesagem',
  },
  {
    id: 'ap_admin', type: 'wireless', label: 'AP Administrativo',
    x: 720, y: 250,
    specs: 'Wi-Fi 6, 2.4/5 GHz, PoE',
    purpose: 'Cobertura area administrativa e sala de gestao',
  },

  // ── Displays (TVs) ──────────────────────────────────────────────
  {
    id: 'tv_operacional', type: 'display', label: 'TV Dashboard Op.',
    x: 100, y: 250,
    specs: 'Smart TV 43"+, HDMI/Chromecast, montagem parede',
    purpose: 'Dashboard tempo real: filas, pesagem, alertas',
  },
  {
    id: 'tv_gestao', type: 'display', label: 'TV Dashboard Gestao',
    x: 900, y: 250,
    specs: 'Smart TV 43"+, HDMI/Chromecast, montagem parede',
    purpose: 'Dashboard gerencial: KPIs, vendas, expedicao',
  },

  // ── Tablets (mobile) ─────────────────────────────────────────────
  {
    id: 'tablet_recebimento', type: 'mobile', label: 'Tablet Receb.',
    x: 190, y: 170,
    specs: 'Android 10+, 8", capa rugged, Wi-Fi',
    purpose: 'Conferencia de NF no recebimento, registro de divergencias',
  },
  {
    id: 'tablet_doca', type: 'mobile', label: 'Tablet Doca',
    x: 340, y: 170,
    specs: 'Android 10+, 8", capa rugged, Wi-Fi',
    purpose: 'Controle de carga na doca, checklist de conferencia',
  },
  {
    id: 'tablet_conferencia', type: 'mobile', label: 'Tablet Confer.',
    x: 780, y: 170,
    specs: 'Android 10+, 10", Wi-Fi',
    purpose: 'Conferencia final de carga, assinatura digital',
  },

  // ── Workstations ─────────────────────────────────────────────────
  {
    id: 'pc_pesagem1', type: 'workstation', label: 'Pesagem 1',
    x: 130, y: 400,
    specs: 'Mini PC Linux, 8 GB RAM, SSD 120 GB',
    purpose: 'Estacao de pesagem — posto 1 (carnes bovinas)',
  },
  {
    id: 'pc_pesagem2', type: 'workstation', label: 'Pesagem 2',
    x: 260, y: 400,
    specs: 'Mini PC Linux, 8 GB RAM, SSD 120 GB',
    purpose: 'Estacao de pesagem — posto 2 (carnes suinas)',
  },
  {
    id: 'pc_pesagem3', type: 'workstation', label: 'Pesagem 3',
    x: 390, y: 400,
    specs: 'Mini PC Linux, 8 GB RAM, SSD 120 GB',
    purpose: 'Estacao de pesagem — posto 3 (aves e outros)',
  },
  {
    id: 'pc_recebimento', type: 'workstation', label: 'Recebimento',
    x: 540, y: 400,
    specs: 'Mini PC Linux, 8 GB RAM, SSD 120 GB',
    purpose: 'Estacao de recebimento e conferencia de NF',
  },
  {
    id: 'pc_expedicao', type: 'workstation', label: 'Expedicao',
    x: 680, y: 400,
    specs: 'Mini PC Linux, 8 GB RAM, SSD 120 GB',
    purpose: 'Estacao de expedicao, fechamento de carga',
  },
  {
    id: 'pc_admin', type: 'workstation', label: 'Administrativo',
    x: 840, y: 400,
    specs: 'Desktop Linux, 16 GB RAM, SSD 240 GB',
    purpose: 'Gestao, faturamento, emissao de NF, relatorios',
  },

  // ── Balancas (perifericos) ───────────────────────────────────────
  {
    id: 'balanca1', type: 'peripheral', label: 'Balanca 1',
    x: 90, y: 530,
    specs: 'Balanca digital 150 kg, RS-232/USB, precisao 5 g',
    purpose: 'Pesagem de pecas no posto 1',
  },
  {
    id: 'balanca2', type: 'peripheral', label: 'Balanca 2',
    x: 220, y: 530,
    specs: 'Balanca digital 150 kg, RS-232/USB, precisao 5 g',
    purpose: 'Pesagem de pecas no posto 2',
  },
  {
    id: 'balanca3', type: 'peripheral', label: 'Balanca 3',
    x: 350, y: 530,
    specs: 'Balanca digital 150 kg, RS-232/USB, precisao 5 g',
    purpose: 'Pesagem de pecas no posto 3',
  },

  // ── Impressoras ──────────────────────────────────────────────────
  {
    id: 'impressora_pesagem', type: 'printer', label: 'Etiquetas Pesagem',
    x: 180, y: 630,
    specs: 'Zebra GC420d ou compativel, ZPL, USB/Rede',
    purpose: 'Impressao de etiquetas QR para pesagem (3 postos)',
  },
  {
    id: 'impressora_expedicao', type: 'printer', label: 'Etiquetas Exped.',
    x: 640, y: 630,
    specs: 'Zebra GC420d ou compativel, ZPL, USB/Rede',
    purpose: 'Impressao de etiquetas para expedicao e caixas',
  },
  {
    id: 'impressora_nf', type: 'printer', label: 'NF / Danfe',
    x: 840, y: 630,
    specs: 'Impressora laser A4, duplex, rede',
    purpose: 'Impressao de DANFE, romaneios e relatorios',
  },

  // ── Leitores QR ──────────────────────────────────────────────────
  {
    id: 'qr_pesagem1', type: 'scanner', label: 'Leitor QR 1',
    x: 90, y: 470,
    specs: 'Leitor QR USB, 2D, leitura rapida',
    purpose: 'Leitura de etiquetas no posto de pesagem 1',
  },
  {
    id: 'qr_pesagem2', type: 'scanner', label: 'Leitor QR 2',
    x: 260, y: 470,
    specs: 'Leitor QR USB, 2D, leitura rapida',
    purpose: 'Leitura de etiquetas no posto de pesagem 2',
  },
  {
    id: 'qr_pesagem3', type: 'scanner', label: 'Leitor QR 3',
    x: 390, y: 470,
    specs: 'Leitor QR USB, 2D, leitura rapida',
    purpose: 'Leitura de etiquetas no posto de pesagem 3',
  },
  {
    id: 'qr_expedicao', type: 'scanner', label: 'Leitor QR Exped.',
    x: 680, y: 470,
    specs: 'Leitor QR USB, 2D, leitura rapida',
    purpose: 'Leitura de caixas e volumes na expedicao',
  },
  {
    id: 'qr_conferencia', type: 'scanner', label: 'Leitor QR Confer.',
    x: 540, y: 470,
    specs: 'Leitor QR Bluetooth, 2D, portatil',
    purpose: 'Conferencia final de carga antes do faturamento',
  },
];

export const topologyLinks = [
  // ── Core backbone ────────────────────────────────────────────────
  { source: 'firewall', target: 'servidor', type: 'ethernet', speed: '1 Gbps', label: 'WAN/LAN' },
  { source: 'servidor', target: 'switch', type: 'ethernet', speed: '1 Gbps', label: 'Trunk' },

  // ── Switch → Access Points ───────────────────────────────────────
  { source: 'switch', target: 'ap_operacional', type: 'ethernet', speed: '1 Gbps', label: 'PoE' },
  { source: 'switch', target: 'ap_admin', type: 'ethernet', speed: '1 Gbps', label: 'PoE' },

  // ── Switch → Displays (TVs via rede) ─────────────────────────────
  { source: 'switch', target: 'tv_operacional', type: 'ethernet', speed: '100 Mbps', label: '' },
  { source: 'switch', target: 'tv_gestao', type: 'ethernet', speed: '100 Mbps', label: '' },

  // ── Switch → Workstations ────────────────────────────────────────
  { source: 'switch', target: 'pc_pesagem1', type: 'ethernet', speed: '1 Gbps', label: '' },
  { source: 'switch', target: 'pc_pesagem2', type: 'ethernet', speed: '1 Gbps', label: '' },
  { source: 'switch', target: 'pc_pesagem3', type: 'ethernet', speed: '1 Gbps', label: '' },
  { source: 'switch', target: 'pc_recebimento', type: 'ethernet', speed: '1 Gbps', label: '' },
  { source: 'switch', target: 'pc_expedicao', type: 'ethernet', speed: '1 Gbps', label: '' },
  { source: 'switch', target: 'pc_admin', type: 'ethernet', speed: '1 Gbps', label: '' },

  // ── Wireless → Tablets ───────────────────────────────────────────
  { source: 'ap_operacional', target: 'tablet_recebimento', type: 'wireless', speed: 'Wi-Fi 6', label: '' },
  { source: 'ap_operacional', target: 'tablet_doca', type: 'wireless', speed: 'Wi-Fi 6', label: '' },
  { source: 'ap_admin', target: 'tablet_conferencia', type: 'wireless', speed: 'Wi-Fi 6', label: '' },

  // ── Peripherals → Workstations (serial/USB) ─────────────────────
  { source: 'pc_pesagem1', target: 'balanca1', type: 'serial', speed: 'RS-232', label: 'Serial' },
  { source: 'pc_pesagem2', target: 'balanca2', type: 'serial', speed: 'RS-232', label: 'Serial' },
  { source: 'pc_pesagem3', target: 'balanca3', type: 'serial', speed: 'RS-232', label: 'Serial' },

  // ── QR Readers → Workstations (USB) ──────────────────────────────
  { source: 'pc_pesagem1', target: 'qr_pesagem1', type: 'usb', speed: 'USB', label: '' },
  { source: 'pc_pesagem2', target: 'qr_pesagem2', type: 'usb', speed: 'USB', label: '' },
  { source: 'pc_pesagem3', target: 'qr_pesagem3', type: 'usb', speed: 'USB', label: '' },
  { source: 'pc_expedicao', target: 'qr_expedicao', type: 'usb', speed: 'USB', label: '' },
  { source: 'pc_recebimento', target: 'qr_conferencia', type: 'usb', speed: 'USB', label: '' },

  // ── Printers → Workstations (USB/Rede) ──────────────────────────
  { source: 'pc_pesagem1', target: 'impressora_pesagem', type: 'usb', speed: 'USB', label: '' },
  { source: 'pc_expedicao', target: 'impressora_expedicao', type: 'usb', speed: 'USB', label: '' },
  { source: 'pc_admin', target: 'impressora_nf', type: 'usb', speed: 'USB/Rede', label: '' },
];

export const topologyNodeTypes = {
  server:      { icon: '\uD83D\uDDA5\uFE0F', color: '#06b6d4', size: 60, label: 'Servidor' },
  network:     { icon: '\uD83D\uDD00',       color: '#3b82f6', size: 50, label: 'Switch / Rede' },
  security:    { icon: '\uD83D\uDEE1\uFE0F', color: '#ef4444', size: 50, label: 'Firewall' },
  workstation: { icon: '\uD83D\uDCBB',       color: '#10b981', size: 45, label: 'Estacao' },
  peripheral:  { icon: '\u2696\uFE0F',       color: '#f59e0b', size: 40, label: 'Balanca' },
  printer:     { icon: '\uD83D\uDDA8\uFE0F', color: '#8b5cf6', size: 40, label: 'Impressora' },
  wireless:    { icon: '\uD83D\uDCE1',       color: '#06b6d4', size: 42, label: 'Access Point' },
  mobile:      { icon: '\uD83D\uDCF1',       color: '#10b981', size: 35, label: 'Tablet' },
  display:     { icon: '\uD83D\uDCFA',       color: '#f59e0b', size: 45, label: 'TV / Display' },
  scanner:     { icon: '\uD83D\uDCF7',       color: '#6b7280', size: 35, label: 'Leitor QR' },
};
