# GymOS — UI/UX Design System & Theme Specification

**Document Version:** 1.0.0  
**Mandatory Requirement:** All current and future frontend modules must strictly follow this specification.

---

## 1. Core Design Philosophy

GymOS must feel like a **commercial-grade, modern, premium, and clean SaaS platform**. 

### Guiding Principles:
1. **Simple, Modern & Clean:** Uncluttered layouts, deliberate whitespace, structured hierarchy.
2. **Dual-Theme Parity:** 100% feature and visual parity between Light Mode and Dark Mode. Neither is an afterthought.
3. **Frictionless Navigation:** Workflows should be discoverable in $\le 2$ clicks.
4. **Purposeful Visual Feedback:** Consistent loading skeletons, clear empty states, informative success notifications, and human-readable form validation errors.
5. **No Visual Bloat:** Zero decorative clutter, no excessive neon gradients, no distracting animations.

---

## 2. Design Tokens & Color Palette

### 2.1 Emerald Accent (Primary Brand)
- **Brand / Primary:**
  - `primary-50`: `#f0fdf4` (light badge backgrounds)
  - `primary-100`: `#dcfce7`
  - `primary-600`: `#16a34a` (primary buttons, active accents)
  - `primary-700`: `#15803d` (button hover states)
  - `emerald-950/60`: Dark mode badge backgrounds

### 2.2 Neutral Canvas & Surface (Zinc Palette)
| Element | Light Mode | Dark Mode |
|:---|:---|:---|
| **Page Background** | `bg-white` (`#ffffff`) | `bg-zinc-950` (`#09090b`) |
| **Card / Surface** | `bg-white` with `border-zinc-200` | `bg-zinc-900` with `border-zinc-800` |
| **Muted Canvas** | `bg-zinc-50` | `bg-zinc-900/60` |
| **Primary Text** | `text-zinc-900` | `text-zinc-100` |
| **Secondary Text** | `text-zinc-600` | `text-zinc-400` |
| **Muted / Subtitle Text** | `text-zinc-500` | `text-zinc-500` |
| **Input Borders** | `border-zinc-300 focus:ring-emerald-500` | `border-zinc-700 focus:ring-emerald-500` |
| **Dividers & Table Rows** | `divide-zinc-200` | `divide-zinc-800` |

### 2.3 Semantic Status Tokens
- **ACTIVE:** `bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400`
- **INACTIVE / PENDING:** `bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400`
- **SUSPENDED / FROZEN:** `bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400`
- **ARCHIVED / CANCELLED:** `bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400`

---

## 3. Theme Engine & Persistence Architecture

1. **Storage & Persistence:** User's choice (`light`, `dark`, `system`) is persisted in `localStorage.getItem('gymos_theme')`.
2. **Flash Prevention (FOUC):** An inline script in `app/layout.tsx` executes before stylesheet evaluation to set `.dark` on `document.documentElement` immediately.
3. **Tailwind Engine:** `darkMode: "class"` configured in `tailwind.config.ts`.
4. **Header Accessibility:** The `<ThemeToggle />` button is permanently pinned in the top navigation bar, featuring accessible aria labels and Lucide `Sun`/`Moon` icons.

---

## 4. UI Patterns & Screen Standards

### 4.1 Tables & Directories
- **Search:** Instant debounced input with leading search icon.
- **Filters:** Minimalist select menus with matching background/border styling.
- **Pagination:** Fixed footer with item count ("Showing X of Y"), current page indicator, and disabled states on boundary buttons.
- **Empty States:** Centered icon, clear title, and contextual guidance (e.g., "Adjust your search filters" or "Register your first member").

### 4.2 Forms & Inputs
- **Required Indicators:** Red asterisk (`<span className="text-red-500">*</span>`).
- **Focus Rings:** Accessible emerald focus ring (`focus:ring-2 focus:ring-emerald-500`).
- **Input Spacing:** Compact vertical gap with readable label font (`text-xs font-medium mb-1`).
- **Submission States:** Disabled state with progress indicator (e.g., "Registering...", "Saving...").

### 4.3 Modals & Dialogs
- **Backdrop:** Translucent backdrop with soft blur (`bg-black/50 backdrop-blur-sm`).
- **Container:** High-contrast background (`bg-white dark:bg-zinc-900`) with matching dark borders (`border-zinc-200 dark:border-zinc-800`) and elevated shadow (`shadow-xl`).
- **Buttons:** Clear primary action on the right, neutral "Cancel" outline on the left.

### 4.4 Dashboard KPI Cards
- Hero metric in large, bold typography (`text-2xl font-bold`).
- Compact subtitle explaining the metric period or context.
- Top-right semantic icon with soft tinted background badge.

---

## 5. Mandatory Verification Checklist per Feature

Before marking any module complete, verify:
- [ ] Screen renders with high contrast and readable text in **Light Mode**.
- [ ] Screen renders with high contrast and readable text in **Dark Mode**.
- [ ] Theme switching from the navbar button reflects immediately without page reload.
- [ ] Selected theme persists across hard browser reloads (`Ctrl + F5`).
- [ ] Responsive layout adapts cleanly on mobile ($\le 640\text{px}$), tablet ($\approx 768\text{px}$), and desktop ($\ge 1024\text{px}$).
- [ ] All table filters, search bars, modals, and dropdowns visually match design tokens.
- [ ] Form submission validation errors display in accessible red text.
- [ ] No unstyled elements or raw browser defaults exist.
