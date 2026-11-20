# GymOS — Enterprise Design System Specification
**Document:** `docs/ui-ux/GYMOS-DESIGN-SYSTEM.md`  
**Version:** 1.0.0  
**Baseline Commit:** `ce51fc6`  
**Target Aesthetic:** Modern Enterprise SaaS (Equal Priority Light Mode + Dark Mode)

---

## 1. Design Principles & Aesthetic Foundations

GymOS is designed for fast, high-volume front desk operations, deep executive business visibility, and effortless multi-tenant management.

### Core Visual Principles
1. **Clarity & Restraint:** High information density without visual chaos. Content takes precedence over decoration.
2. **Layered Surfaces:** Elevation is communicated through subtle contrast shifts, surface shading, and refined hairline borders (`1px`) rather than heavy drop shadows.
3. **Equal-Priority Theming:** Light Mode and Dark Mode are designed concurrently. Neither is an afterthought. Dark Mode uses rich, obsidian tones (`#0d0e15`, `#13151f`, `#1a1d2c`) with soft violet illumination, while Light Mode provides crisp, airy contrasts (`#f8fafc`, `#ffffff`, `#e2e8f0`) with refined slate borders.
4. **Vibrant & Meaningful Semantics:** Accent colors (Violet/Indigo for brand, Emerald for active/success, Amber for expiring/warning, Rose for dues/error, Sky for info) communicate status at a glance.
5. **Operational Ergonomics:** Designed for receptionists standing at a desk with a laptop or tablet, gym owners glancing at a phone, and managers analyzing financial reports on desktop monitors.

---

## 2. Color Palette & Semantic Tokens

### 2.1 Dark Mode Palette (Primary Operational Theme)
| Token | HEX / Tailwind Equivalent | Role & Application |
|---|---|---|
| `bg-canvas` | `#0b0c12` (Zinc 950 deep) | Main application background beneath all shells |
| `bg-surface-sidebar` | `#0e1017` | Navigation sidebar background with 1px border |
| `bg-surface-card` | `#131622` | Cards, metric tiles, table containers |
| `bg-surface-elevated` | `#1a1e2e` | Hover states, active list items, input fields |
| `bg-surface-popover` | `#202538` | Modals, dropdown menus, tooltips |
| `border-subtle` | `rgba(255, 255, 255, 0.08)` | Standard card borders, divider lines |
| `border-prominent` | `rgba(255, 255, 255, 0.15)` | Active inputs, selected rows, focused borders |
| `text-primary` | `#f8fafc` (Zinc 50) | Page titles, KPI numbers, primary data |
| `text-secondary` | `#94a3b8` (Slate 400) | Supporting labels, table headers, descriptions |
| `text-muted` | `#64748b` (Slate 500) | Timestamps, metadata, inactive icons |
| `accent-primary` | `#8b5cf6` (Violet 500) | Primary buttons, active nav tab, key focal elements |
| `accent-gradient` | `linear-gradient(135deg, #7c3aed, #6366f1)` | Primary CTA buttons, brand badges, active highlights |
| `accent-glow` | `rgba(139, 92, 246, 0.2)` | Focus rings, card highlights, active tab shadow |

### 2.2 Light Mode Palette (Executive & Daytime Front Desk)
| Token | HEX / Tailwind Equivalent | Role & Application |
|---|---|---|
| `bg-canvas` | `#f8fafc` (Slate 50) | Main background |
| `bg-surface-sidebar` | `#ffffff` | Clean white sidebar with subtle slate border |
| `bg-surface-card` | `#ffffff` | Crisp white cards with soft border |
| `bg-surface-elevated` | `#f1f5f9` (Slate 100) | Hover states, active list items, input fills |
| `bg-surface-popover` | `#ffffff` | Modals and dropdowns with refined elevation |
| `border-subtle` | `#e2e8f0` (Slate 200) | Card outlines, table cell borders |
| `border-prominent` | `#cbd5e1` (Slate 300) | Input borders, active element dividers |
| `text-primary` | `#0f172a` (Slate 900) | High-contrast headings and data values |
| `text-secondary` | `#475569` (Slate 600) | Field labels, table headers, secondary copy |
| `text-muted` | `#94a3b8` (Slate 400) | Captions, placeholders, inactive states |
| `accent-primary` | `#7c3aed` (Violet 600) | Primary buttons and interactive highlights |
| `accent-gradient` | `linear-gradient(135deg, #7c3aed, #4f46e5)` | Primary CTAs |
| `accent-glow` | `rgba(124, 58, 237, 0.12)` | Subtle focus rings and selection halos |

### 2.3 Semantic Status Indicators
| Status | Dark Mode Background | Dark Mode Text | Light Mode Background | Light Mode Text | Meaning / Usage |
|---|---|---|---|---|---|
| **Active / Success** | `rgba(16, 185, 129, 0.15)` | `#34d399` (Emerald 400) | `#ecfdf5` (Emerald 50) | `#059669` (Emerald 600) | Active member, Present on floor, Paid invoice, Healthy |
| **Warning / Expiring** | `rgba(245, 158, 11, 0.15)` | `#fbbf24` (Amber 400) | `#fffbeb` (Amber 50) | `#d97706` (Amber 600) | Expiring membership (< 7 days), Pending check-out, Unverified email |
| **Error / Dues / Alert** | `rgba(239, 68, 68, 0.15)` | `#f87171` (Rose 400) | `#fef2f2` (Rose 50) | `#dc2626` (Rose 600) | Outstanding dues, Rejection, Suspended member, Overcapacity |
| **Info / Scheduled** | `rgba(59, 130, 246, 0.15)` | `#60a5fa` (Sky 400) | `#eff6ff` (Sky 50) | `#2563eb` (Sky 600) | System info, Scheduled renewal, Neutral audit event |

---

## 3. Typography & Hierarchy

GymOS standardizes on a modern interface typographic scale:

| Level | Size | Weight | Line Height | Tracking | Usage |
|---|---|---|---|---|---|
| **Display / Page Title** | `24px` (`1.5rem`) | `700` Bold | `32px` | `-0.025em` | Main page title ("Good Morning, Amit 👋") |
| **Section Header** | `18px` (`1.125rem`) | `600` Semibold | `24px` | `-0.015em` | Card titles ("Attendance Trend", "Live Floor") |
| **KPI Value** | `28px` (`1.75rem`) | `700` Bold | `36px` | `-0.03em` | Primary metric numbers ("1,248", "₹4,87,500") |
| **Subheading / Group** | `11px` (`0.6875rem`) | `700` Bold | `16px` | `+0.05em` | All-caps nav groups ("OPERATIONS", "SETTINGS") |
| **Body (Regular)** | `14px` (`0.875rem`) | `400` Regular | `20px` | `0` | Standard table text, modal descriptions, body copy |
| **Body (Medium)** | `14px` (`0.875rem`) | `500` Medium | `20px` | `0` | Member names, button text, input values |
| **Caption / Helper** | `12px` (`0.75rem`) | `400` Regular | `16px` | `0` | Field helper text, timestamps, secondary metadata |
| **Badge / Tag** | `11px` (`0.6875rem`) | `600` Semibold | `14px` | `+0.02em` | Status chips ("In Gym Now", "3 days left") |

---

## 4. Spacing, Radii & Depth

### 4.1 Spacing Grid
The design system operates on an `8px` baseline (with `4px` half-steps for compact UI):
- `gap-1` (`4px`): Icon-to-text spacing inside buttons/badges.
- `gap-2` (`8px`): Compact action lists, filter rows.
- `gap-3` (`12px`): Standard sidebar items, metric pill spacing.
- `gap-4` (`16px`): Standard grid gaps between KPI cards.
- `gap-6` (`24px`): Major page section spacing.

### 4.2 Corner Radii
- `rounded-lg` (`8px`): Inputs, select dropdowns, buttons, small status badges.
- `rounded-xl` (`12px`): Sub-panels, quick action tiles, table row containers.
- `rounded-2xl` (`16px`): Main cards, metric containers, modal dialogues, sidebar containers.
- `rounded-full`: Avatars, status dots, icon badges.

### 4.3 Borders & Elevation
- **Hairline Borders:** `1px solid border-subtle` is the primary separator between panels, avoiding blurry, heavy shadows.
- **Card Highlights:** In dark mode, top edge borders carry a subtle `1px` gradient or border highlight to give an optical glass/metallic edge.
- **Backdrop Blur:** Modals and sticky top bars utilize `backdrop-blur-md` with `80%` opacity to maintain spatial orientation.

---

## 5. Core Reusable Component Library

The enterprise design system introduces clean, reusable UI primitives located in `apps/web/src/components/ui`:

1. **`AppShell` (`apps/web/src/components/layout/AppShell.tsx`):**
   - Host layout providing the collapsible `Sidebar`, fixed responsive `TopBar`, and fluid `main` content area.
2. **`Sidebar` (`apps/web/src/components/layout/Sidebar.tsx`):**
   - Categorized sections: WORKSPACE/OPERATIONS, MANAGEMENT, INSIGHTS, SETTINGS.
   - Expanded state (`w-64` / 256px) and collapsed state (`w-20` / 80px) with tooltips.
   - Mobile slide-over drawer triggered by hamburger menu.
   - Role-aware filtering: hides sections the current user has no permissions to view.
3. **`TopBar` (`apps/web/src/components/layout/TopBar.tsx`):**
   - Compact brand indicator (on mobile/collapsed).
   - Organization Switcher with branch count.
   - Branch Selector with active indicator.
   - Global Search input (`Ctrl + K` shortcut cue).
   - Theme Toggle (Light/Dark/System with seamless transition).
   - User Profile Menu with avatar, role badge, and quick logout.
4. **`StatCard` (`apps/web/src/components/ui/stat-card.tsx`):**
   - Icon container with colored soft glow.
   - Title label.
   - Large formatted metric value.
   - Trend indicator (e.g. `+12.7% from yesterday`) or secondary note.
5. **`Badge` (`apps/web/src/components/ui/badge.tsx`):**
   - Variants: `default`, `secondary`, `success`, `warning`, `destructive`, `outline`, `accent`.
   - Sizes: `sm`, `md`.
6. **`DataTable` (`apps/web/src/components/ui/data-table.tsx`):**
   - Enterprise data table with standardized header row, hover effects, empty state, and server-side pagination bar.
7. **`Modal` / `Dialog` (`apps/web/src/components/ui/modal.tsx`):**
   - Keyboard accessible, trapped focus, smooth entrance animation, clean header, body, and action footer.
8. **`Tabs` (`apps/web/src/components/ui/tabs.tsx`):**
   - Modern pill or underline navigation tabs for switching views without reloading.
9. **`SvgLineChart` (`apps/web/src/components/charts/SvgLineChart.tsx`):**
   - Zero-dependency, responsive SVG curve chart with purple gradient area fill, interactive hover dots, and custom tooltip.
10. **`OccupancyGauge` (`apps/web/src/components/charts/OccupancyGauge.tsx`):**
    - High-polish circular occupancy ring with percentage center and capacity metrics.
