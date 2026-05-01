---
name: Finance Master
description: Sistema de design para plataforma de gestão financeira de holding multientidade.
version: alpha
colors:
  primary: "#0F172A"
  primary-dim: "#1E293B"
  primary-muted: "#334155"
  secondary: "#1D4ED8"
  secondary-hover: "#1E40AF"
  accent: "#3B82F6"
  accent-soft: "#EFF6FF"
  surface: "#F8FAFC"
  surface-dim: "#F1F5F9"
  card: "#FFFFFF"
  on-primary: "#FFFFFF"
  on-surface: "#0F172A"
  on-surface-muted: "#64748B"
  on-surface-subtle: "#94A3B8"
  border: "#E2E8F0"
  border-subtle: "#F1F5F9"
  success: "#059669"
  success-soft: "#ECFDF5"
  warning: "#D97706"
  warning-soft: "#FFFBEB"
  danger: "#DC2626"
  danger-soft: "#FEF2F2"
  info: "#2563EB"
  info-soft: "#EFF6FF"
  simulation: "#D97706"
  simulation-soft: "#FFFBEB"
typography:
  display:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: "700"
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: "700"
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: "600"
    lineHeight: 24px
  headline-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: "600"
    lineHeight: 20px
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: "400"
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: "400"
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: "600"
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: "500"
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: "600"
    lineHeight: 14px
    letterSpacing: 0.04em
  mono-lg:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: 22px
    fontWeight: "700"
    lineHeight: 28px
  mono-md:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: 16px
    fontWeight: "600"
    lineHeight: 22px
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  page: 24px
  sidebar: 256px
  card-gap: 16px
  section-gap: 24px
components:
  sidebar:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    width: "{spacing.sidebar}"
  sidebar-nav-item:
    backgroundColor: transparent
    textColor: "#94A3B8"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    typography: "{typography.body-md}"
  sidebar-nav-item-active:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-primary}"
  kpi-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.xl}"
    padding: "20px"
  table-row:
    backgroundColor: "{colors.card}"
    textColor: "{colors.body-md}"
    rounded: "{rounded.md}"
  badge-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
    typography: "{typography.label-sm}"
  badge-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
    typography: "{typography.label-sm}"
  badge-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
    typography: "{typography.label-sm}"
  button-primary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: 36px
    typography: "{typography.label-lg}"
  button-primary-hover:
    backgroundColor: "{colors.secondary-hover}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: 36px
    typography: "{typography.label-lg}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.on-surface-muted}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: 36px
    typography: "{typography.label-lg}"
  input-field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: 36px
    typography: "{typography.body-md}"
  period-tab:
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface-muted}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    typography: "{typography.label-md}"
  period-tab-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  simulation-banner:
    backgroundColor: "{colors.simulation}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
---

## Overview

Finance Master é uma plataforma SaaS para gestão financeira consolidada de holdings com múltiplos CNPJs. O design evoca **confiança institucional** combinada com **clareza analítica** — como um painel Bloomberg adaptado para o universo PME brasileiro.

A identidade visual segue o princípio "dados em primeiro lugar": tipografia densa mas hierárquica, paleta cromática fria com acentos semânticos (verde/âmbar/vermelho), e espaçamento generoso que permite a respiração dos dados numéricos.

**Personalidade da marca:** Preciso, confiável, executivo. Sem frescuras decorativas. Cada pixel serve à legibilidade dos números.

## Colors

A paleta é fundamentada em contrastes de superfície e um único tom de acento azul como driver de interação.

- **Primary (`#0F172A`):** Azul-marinho quase preto — base do sidebar, texto de headline, e elementos de peso máximo. Transmite seriedade financeira.
- **Primary Dim (`#1E293B`):** Variante ligeiramente mais clara para hover states e bordas internas do sidebar.
- **Secondary (`#1D4ED8`):** Azul institucional — todos os CTAs primários, nav item ativo, e loading states.
- **Accent (`#3B82F6`):** Azul vivo para highlights de dados, links, ícones de KPI, e sparklines.
- **Surface (`#F8FAFC`):** Fundo de página off-white gelado. Mais suave que branco puro, reduz fadiga visual.
- **Card (`#FFFFFF`):** Superfície de cartão e modal. Contraste máximo contra o surface.
- **Border (`#E2E8F0`):** Divisores e bordas de card. Discreto, não competitivo.
- **Success (`#059669`):** Números positivos, benchmarks atingidos, status OK.
- **Warning (`#D97706`):** Atenção — métricas próximas do limite, modo simulação.
- **Danger (`#DC2626`):** Negativos, erros, benchmarks violados.

### Regras de uso
As cores "soft" (ex: `success-soft #ECFDF5`) são sempre backgrounds de badge e tag. As cores puras são texto/ícone. Nunca use cor pura como background de texto branco exceto nos botões primary.

## Typography

O sistema usa **Inter** em todas as escalas — uma escolha deliberada para consistência em ambientes de dados densos. A variante mono (`JetBrains Mono`) aparece exclusivamente em valores monetários grandes (KPI cards) para diferenciar dados de labels.

- **Display:** Títulos de página, valor principal de KPI de destaque.
- **Headline:** Títulos de seção e subtítulos de card.
- **Body:** Texto de linha de tabela, descrições, labels de campo.
- **Label:** Tags, badges, cabeçalhos de coluna em maiúsculas (uppercase + letter-spacing).
- **Mono:** Valores monetários em KPI cards (R$ 1.250,00). O espaçamento fixo evita "saltos" de layout ao atualizar valores.

### Regras tipográficas
- Valores monetários nos KPI cards: `mono-lg` ou `mono-md`.
- Cabeçalhos de tabela: `label-sm` uppercase.
- Texto de linha de tabela: `body-md`.
- Percentuais e benchmarks: `label-md` colored.

## Layout

O layout segue um modelo **sidebar fixa + conteúdo scrollável**:

- **Sidebar:** 256px fixa à esquerda, altura 100vh, overflow-y auto.
- **Conteúdo:** `flex-1`, padding `24px`, `max-w-6xl mx-auto` para conteúdo de dashboard.
- **Grid de KPI:** 5 colunas em desktop (`lg:grid-cols-5`), 2 em mobile (`grid-cols-2`).
- **Grid de gráficos:** 3 colunas em desktop, 1 em mobile. Gráfico principal ocupa 2/3.
- **Cards:** `rounded-xl` (16px), `border border-gray-100`, `bg-white`, sem shadow pesada.
- **Espaçamento base:** múltiplos de 4px. Gap padrão entre cards: 16px. Gap entre seções: 24px.

### Densidade
A interface é deliberadamente **densa** — mais próxima de Excel/Bloomberg do que de landing page SaaS. Padding interno de cards: 16-20px. Rows de tabela: 10-12px vertical.

## Elevation & Depth

A hierarquia de profundidade é comunicada por **contraste tonal**, não por shadows pesadas:

- **Nível 0 (Background):** `surface #F8FAFC` — base de todas as páginas.
- **Nível 1 (Cards):** `card #FFFFFF` + `border border-gray-100` — cards de conteúdo.
- **Nível 2 (Sidebar):** `primary #0F172A` — isolado visualmente da área de conteúdo.
- **Nível 3 (Modais):** `card #FFFFFF` + `shadow-xl` + `backdrop-blur-sm` no overlay.
- **Nível 4 (Tooltips):** `primary #0F172A` com texto branco — máximo contraste.

Não usar `box-shadow` em cards no estado estático. Apenas modais e dropdowns elevam com shadow.

## Shapes

Linguagem de formas: **arredondado moderno, mas disciplinado**.

- `rounded-xs` (4px): badges inline, dots de status.
- `rounded-sm` (6px): inputs pequenos, chips de filtro.
- `rounded-md` (8px): botões, inputs padrão, nav items.
- `rounded-lg` (12px): cards menores, modais de confirmação.
- `rounded-xl` (16px): KPI cards, cards de seção principal.
- `rounded-full` (9999px): avatars, badges de canal, progress pills.

Regra: **nunca misture** `rounded-sm` e `rounded-xl` no mesmo nível visual. Todos os cards de uma seção devem ter o mesmo border-radius.

## Components

### KPI Cards
Estrutura interna: ícone no topo esquerdo (24×24px, fundo `accent-soft`, cor `accent`), delta percentual no topo direito (verde/vermelho), label pequena, valor em `mono-lg`/`mono-md`, sub-label opcional, dot de benchmark na base.

### Tabela de Dados
- Header: `label-sm uppercase`, cor `on-surface-subtle`, background `surface-dim`.
- Rows: `body-md`, altura mínima 44px (acessibilidade touch), border-bottom `border-subtle`.
- Rows alternadas: sem zebra-striping — apenas hover `surface-dim`.
- Valores monetários em rows: alinhados à direita, `label-md font-semibold`.
- Negativos em tabela: `danger` color.

### Gráficos (Recharts)
- CartesianGrid: `stroke: #F1F5F9`, `strokeDasharray: "3 3"`.
- Eixos: `fill: #94A3B8`, `fontSize: 11px`.
- Tooltip: background `#0F172A`, texto branco, `borderRadius: 8px`, sem borda.
- Linhas: strokeWidth 2, sem pontos individuais (`dot: false`) para séries longas.
- Cores de série: Receita `#3B82F6`, Despesas `#EF4444`, Lucro `#10B981`.

### Sidebar
Fundo `primary`, logo no topo com ícone azul, seletor de empresa logo abaixo com fundo `primary-dim`, nav links com hover `primary-dim` e active `secondary`. Seção inferior com botão de simulação e avatar do usuário.

### Badges de Status
`rounded-full`, padding `2px 8px`, `label-sm`. Usar variantes: `success-soft/success`, `warning-soft/warning`, `danger-soft/danger`, `info-soft/info`.

### Modo Simulação
Banner âmbar persistente abaixo do header, largura total. Sidebar button âmbar quando ativo. Todos os dados com badge "SIMULAÇÃO" visível no topo da página.

## Do's and Don'ts

**Fazer:**
- Usar `mono-lg` ou `mono-md` para valores monetários em destaque
- Manter hierarquia clara: label (cinza) → valor (preto/cor) → sub (cinza claro)
- Usar cores semânticas consistentemente: verde=positivo, vermelho=negativo
- Alinhar valores monetários à direita em tabelas
- Usar `rounded-xl` para todos os KPI cards e seções principais

**Não fazer:**
- Não usar sombras pesadas em cards (apenas em modais)
- Não usar mais de 3 cores de destaque na mesma tela
- Não misturar tamanhos de border-radius no mesmo nível visual
- Não usar fonte bold em texto de parágrafo — apenas em valores e labels
- Não mostrar zero como `R$ 0,00` em vermelho — zeros são neutros
- Não truncar valores monetários sem tooltip (ex: "R$ 1,2M" deve ter hover com valor exato)
