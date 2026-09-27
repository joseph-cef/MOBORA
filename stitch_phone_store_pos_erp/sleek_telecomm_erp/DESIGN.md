---
name: Sleek Telecomm ERP
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#89ceff'
  on-secondary: '#00344d'
  secondary-container: '#00a2e6'
  on-secondary-container: '#00344e'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#e29100'
  on-tertiary-container: '#523200'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#c9e6ff'
  secondary-fixed-dim: '#89ceff'
  on-secondary-fixed: '#001e2f'
  on-secondary-fixed-variant: '#004c6e'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system establishes a high-performance, precision-engineered desktop ERP and POS environment tailored for electronics repair and mobile retail operations. It bridges multilingual requirements (Algerian Arabic and French) through native right-to-left (RTL) ergonomics, bi-directional parity, and local financial workflows (DZD, BaridiMob, CCP, cash-on-counter).

### Design Archetype & Atmosphere
- **Modern Utilitarian Dark Mode:** Dominated by deep graphite-slate layers (`#090D16`, `#0F172A`) to minimize eye fatigue during high-volume daily counter interactions and late-night technician shifts.
- **Precision Neon Accents:** Razor-sharp emerald (`#10B981`) indicates completed repair tickets, successful transactions, and positive cash flow; cyan/sky (`#0EA5E9`) represents diagnostic states and system actions; amber (`#F59E0B`) flags warranty expirations, low spare parts stock, or pending customer pickup.
- **Tactile Density:** Information-rich layouts, strict column alignment, tabular numbers, and micro-borders engineered for rapid barcode scanning, IMEI tracking, and multi-stage repair status transitions.

## Colors

The palette leverages high-contrast luminescence over a multi-tiered slate foundation. Functional roles are strictly partitioned to eliminate cognitive overhead in busy retail conditions.

### Surface Architecture
- **Canvas Base (`#090D16`):** The foundational backdrop behind panels and navigation drawers.
- **Surface Elevation 1 (`#0F172A`):** Main operational surfaces, table containers, and Kanban columns.
- **Surface Elevation 2 (`#1E293B`):** Interactive cards, repair ticket nodes, POS quick-select item cards.
- **Surface Elevation 3 (`#334155`):** Hover states, active dropdown lists, modal overlays.
- **Border Subtle (`rgba(148, 163, 184, 0.12)`): Primary hair-line division for cards and cells.
- **Border Active (`rgba(16, 185, 129, 0.4)`):** Highlighted rows, active POS keypad inputs, and focused IMEI fields.

### Functional Accents & Localization
- **Primary / Emerald (`#10B981`):** "Paid in Full", "Delivered", "Ready for Pickup", checkout button, BaridiMob validation.
- **Secondary / Cyan (`#0EA5E9`):** "Diagnosing", "Parts Ordered", technical specs, active tab indicator, POS item category pills.
- **Tertiary / Amber (`#F59E0B`):** "Pending Payment / CCP Check", "Awaiting Customer Approval", low battery/stock alerts.
- **Destructive / Rose (`#F43F5E`):** "Unrepairable", "Void Warranty", "Stock Depleted", refund actions.
- **Text Primary (`#F8FAFC`):** Display headers, prices, quantities, client names.
- **Text Secondary (`#94A3B8`):** Serial/IMEI tags, dates, SKU numbers, subsidiary notes.

## Typography

The type scale is optimized for fast scanning of mixed alphanumeric codes, prices, and bilingual text pairs.

### Font Pairing Strategy
- **Primary & Interface Font (`Inter` fallback to system Arabic / Cairo / Tajawal):** Delivers uniform optical weight across Latin (French ERP workflows) and Arabic scripts. Vertical metrics are calibrated with relaxed line-heights in body text to prevent Arabic diacritics and descenders from clipping.
- **Tabular & Technical Font (`JetBrains Mono`):** Applied to device IMEI identifiers, serial numbers, DZD monetary representations (e.g., `45,000.00 DZD`), barcode values, and timestamp badges.

### RTL & Language Rules
- Number strings, IMEIs, and currency tokens remain visually `ltr` (`direction: ltr; unicode-bidi: isolate;`) even within Arabic context, preserving numeric readability.
- Headlines use reduced letter spacing (`-0.015em`) in Latin and standard letter tracking (`0em`) in Arabic.

## Layout & Spacing

The layout is built for high-density widescreen desktop terminals (1280px to 1920px+ displays) operating in sales counters and technician workbenches.

### Layout Mechanics
- **Structural Model:** Fluid CSS Grid with a fixed-width collapsible sidebar (`260px` open, `72px` collapsed) anchored right in RTL mode (anchored left in LTR).
- **POS / Register Split:** A 65/35 screen split where the 65% area displays a rapid product/repair catalog grid and the 35% fixed column provides an active receipt slip, payment method selectors (Cash, BaridiMob, CCP, Carte Edahabia), and total computations.
- **Kanban Repair Board:** Multi-column horizontal scrolling viewport (`min-width: 320px` per column) representing ticket statuses: *Diagnosing*, *Parts Pending*, *Bench Work*, *Quality Assurance*, *Ready*.
- **RTL Fluidity:** Grid column numbering flows right-to-left. Margins invert automatically via CSS logical properties (`margin-inline-start`, `padding-inline-end`).

## Elevation & Depth

This system avoids heavy drop shadows, relying on structural tonal layering and low-contrast perimeter strokes for a clean, non-distracting look.

### Elevation Hierarchy
- **Level 0 (App Canvas):** Pure background `#090D16` without borders or shadows.
- **Level 1 (Panels & Master Grids):** Surface `#0F172A` bound by a crisp 1px border `rgba(148, 163, 184, 0.08)`.
- **Level 2 (Cards, Interactive Modules, Table Rows on Hover):** Surface `#1E293B`, border `rgba(148, 163, 184, 0.16)`. Ambient shadow: `0 4px 12px -2px rgba(0, 0, 0, 0.4)`.
- **Level 3 (Modals, Slide-over Drawers, POS Action Sheets):** Surface `#1E293B`, border `rgba(16, 185, 129, 0.25)`. Elevation shadow: `0 16px 36px -4px rgba(0, 0, 0, 0.65)`.
- **Backdrop Overlays:** Slate-950 with 75% opacity and `backdrop-filter: blur(8px)`.

## Shapes

A soft, restrained corner radius (`roundedness: 1` = `0.25rem` / `4px` base) reinforces an industrial, technical look suitable for enterprise software.

### Radius Assignments
- **Inputs, Buttons, Badges, Table Rows:** `0.25rem` (`4px`) to preserve a compact grid footprint.
- **Cards, Kanban Columns, Modal Dialogs:** `0.5rem` (`8px`, via `rounded-lg`).
- **Avatar Icons & Payment Status Indicators:** Circular (`rounded-full`) for instant visual categorization.

## Components

### Buttons
- **Primary (Checkout / Save Ticket):** Emerald background (`#10B981`), text `#090D16`, bold font weight. Hover: `#059669`. Focus: 2px ring `#10B981` offset by 2px `#0F172A`.
- **Secondary (Add Part / Filter):** Surface `#1E293B`, text `#F8FAFC`, border `rgba(148, 163, 184, 0.2)`. Hover: `#334155`.
- **Ghost / Utility:** Transparent fill, text `#94A3B8`. Hover: text `#F8FAFC` on `#1E293B`.

### Status Badges & Chips
- **In Progress / Diagnosing:** Cyan tinted background (`rgba(14, 165, 233, 0.1)`), cyan border (`rgba(14, 165, 233, 0.3)`), text `#38BDF8`.
- **Ready for Pickup / Delivered:** Emerald tint (`rgba(16, 185, 129, 0.1)`), emerald border (`rgba(16, 185, 129, 0.3)`), text `#34D399`.
- **Pending Payment (CCP / BaridiMob Pending):** Amber tint (`rgba(245, 158, 11, 0.1)`), amber border (`rgba(245, 158, 11, 0.3)`), text `#FBBF24`.
- **Sold Out / Void:** Rose tint (`rgba(244, 63, 94, 0.1)`), text `#FB7185`.

### Input Fields & Search Bars
- **Barcode / IMEI Input:** Height `42px`, surface `#090D16`, border `rgba(148, 163, 184, 0.2)`, text `JetBrains Mono`. Includes leading icon (barcode icon on right in RTL) and keyboard shortcut indicator (`Ctrl + K`).
- **Standard Field:** Subtle background `#0F172A`, text `#F8FAFC`, focused with `#0EA5E9` stroke.

### Data Tables (Inventory & IMEI Tracking)
- **Header:** Sticky `#0F172A`, uppercase label font, subtle bottom stroke `#334155`.
- **Row:** Alternating micro-striping (`transparent` / `rgba(30, 41, 59, 0.4)`), padding `12px 16px`, cell borders `rgba(148, 163, 184, 0.06)`. Numeric data right-aligned in LTR, left-aligned in RTL.

### Specialized ERP/POS Modules
- **Repair Ticket Kanban Card:** Features client name, device model (`e.g., Galaxy S23 Ultra`), IMEI snippet, problem description tag, assigned technician avatar, and status badge.
- **Payment Method Toggle:** Segmented controls with distinct icons for Cash (`نقداً / Espèces`), BaridiMob (`بريدي موب`), and CCP (`حساب بريدي`). Selected state triggers bright emerald halo outline.