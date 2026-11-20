# GymOS — Complete Enterprise UI/UX Redesign Implementation Plan
**Document:** `docs/ui-ux/GYMOS-REDESIGN-PLAN.md`  
**Version:** 1.0.0  
**Baseline Commit:** `ce51fc6`  
**Date:** 2026-11-20  
**Target:** Full Admin Panel Transformation | Light + Dark Mode

---

## 1. Overview & Objective

GymOS is being transformed from an early-stage, CRUD-oriented scaffolding interface into a cohesive, high-performance Enterprise SaaS platform.

The redesign is anchored by the user-approved enterprise visual direction (`media_1795178839455_f55dd23a.jpg`):
- Deep obsidian / layered surfaces for Dark Mode, crisp slate / porcelain surfaces for Light Mode.
- Vibrant violet/indigo primary accents and meaningful semantic status indicators.
- High-efficiency sidebar navigation with collapsible state and mobile slide-over.
- Real-time business intelligence dashboard with 5 KPI metrics, 7-day attendance trend, live floor occupancy gauge, quick actions, recent check-ins, and expiring memberships.
- Ergonomic front desk workflow for receptionists.
- Clean, searchable, filterable data tables for members, billing, subscriptions, and attendance logs.

### Non-Negotiable Architecture Constraints
- **Preserve Backend:** NestJS controllers, PostgreSQL RLS, BullMQ workers, QR signing engine, and Prisma schemas remain strictly untouched.
- **No Mock or Fake Data:** All metrics, lists, and actions must connect directly to existing, working backend endpoints.
- **Strict Role-Based Visibility:** Navigation items and actions reflect real RBAC permissions (`user.permissions` / `organization.role`).
- **Equal-Priority Theming:** Every redesigned screen must look exceptional in both Light and Dark mode.

---

## 2. Phased Implementation Milestones

### Milestone 1: Enterprise Layout & App Shell
- **Deliverables:**
  - Create `apps/web/src/components/layout/AppShell.tsx`: Unified container for all authenticated dashboard pages.
  - Create `apps/web/src/components/layout/Sidebar.tsx`: Collapsible enterprise navigation sidebar with role-aware section grouping (WORKSPACE/OPERATIONS, MANAGEMENT, INSIGHTS, SETTINGS).
  - Create `apps/web/src/components/layout/TopBar.tsx`: Modern top bar featuring:
    - Organization selector dropdown with branch counts.
    - Branch selector with active status dot.
    - Global search bar with `Ctrl + K` shortcut indicator.
    - Seamless Light/Dark/System theme toggle.
    - Notifications bell with unread badge.
    - User avatar menu with name, role badge, switch org link, and sign-out action.
  - Create `apps/web/src/app/dashboard/layout.tsx`: Next.js nested layout wrapping all `/dashboard/*` routes inside `AppShell`.
  - Refactor root `apps/web/src/app/layout.tsx` so authentication and public pass pages render without redundant dashboard headers/footers.

### Milestone 2: Design Tokens & Base Component Library
- **Deliverables:**
  - Update `apps/web/src/app/globals.css` and `apps/web/tailwind.config.ts` to support layered surface tokens (`bg-surface-card`, `bg-surface-elevated`, `border-subtle`, `accent-glow`).
  - Create `apps/web/src/components/ui/badge.tsx`: Semantic status badge supporting `success`, `warning`, `destructive`, `info`, `accent`, `neutral`.
  - Create `apps/web/src/components/ui/stat-card.tsx`: Metric card with icon glow, value, label, and trend percentage.
  - Create `apps/web/src/components/ui/data-table.tsx`: Standardized data table with hover rows, empty states, and pagination bar.
  - Create `apps/web/src/components/ui/modal.tsx`: Accessible dialog with backdrop blur, keyboard navigation, and action buttons.
  - Create `apps/web/src/components/ui/tabs.tsx`: Segmented pill and underline tab controls.
  - Create `apps/web/src/components/ui/empty-state.tsx`: Illustrated empty state with action CTA.
  - Create `apps/web/src/components/charts/SvgLineChart.tsx`: Responsive SVG line chart with gradient fill, grid lines, and interactive tooltips.
  - Create `apps/web/src/components/charts/OccupancyGauge.tsx`: Circular donut gauge showing live occupancy percentage, member count, and capacity.

### Milestone 3: Executive & Operational Overview Dashboard
- **Deliverables:**
  - Redesign `apps/web/src/app/dashboard/page.tsx`:
    - Welcome header with personalized greeting ("Good Morning, [Name] 👋"), gym/branch context, and current date.
    - 5 KPI Cards:
      1. Active Members (live count from `/members?status=ACTIVE`).
      2. Today's Check-ins (live count from `/attendance/records`).
      3. Expiring Memberships (count from `/memberships`).
      4. Revenue (This Month) (sum from `/billing/payments`).
      5. Outstanding Dues (sum and count from `/billing/dues`).
    - Middle Section:
      - Attendance Trend 7-Day Line Chart.
      - Live Floor Occupancy Gauge with current members inside and capacity.
      - Quick Actions 2x2 grid (Scan QR, Add Member, Manual Check-in, Create Invoice).
    - Bottom Section:
      - Recent Check-ins live feed with avatars, check-in timestamps, and branch tags.
      - Expiring Memberships countdown list with days-left badges.
      - Operational Alerts & AI Insights card.

### Milestone 4: Front Desk & Attendance Module
- **Deliverables:**
  - Redesign `apps/web/src/app/dashboard/attendance/page.tsx` (Live Floor):
    - Real-time floor occupancy cards, capacity progress bar, and active visit cards with 1-click checkout.
  - Redesign `apps/web/src/app/dashboard/attendance/scanner/page.tsx` (QR Scanner):
    - Clean camera viewfinder with guide frame, instant sound/visual feedback on admission/rejection, camera switch control, and manual check-in fallback.
  - Redesign `apps/web/src/app/dashboard/attendance/history/page.tsx` (Attendance History):
    - Advanced search, date range, branch, method, and status filters with paginated table and CSV export.
  - Redesign `apps/web/src/app/dashboard/attendance/settings/page.tsx` (Attendance Settings):
    - Card-grouped policy forms for QR validity, auto-checkout intervals, pass generation, and cooldown rules.
  - Remove redundant `AttendanceNav` sub-header in favor of seamless sidebar navigation and tab switching.

### Milestone 5: Member & Membership Management
- **Deliverables:**
  - Redesign `apps/web/src/app/dashboard/members/page.tsx`:
    - Searchable, filterable member directory with avatars, membership badges, branch chips, and action menus.
  - Redesign `apps/web/src/app/dashboard/members/new/page.tsx` & `edit/page.tsx`:
    - Structured card layout grouping Personal Details, Contact Information, Emergency Contact, and Branch Assignment.
  - Redesign `apps/web/src/app/dashboard/members/[memberId]/page.tsx`:
    - Comprehensive member profile with tabs: Overview, Memberships, Payments, Attendance, and Digital Access Pass.
  - Redesign `apps/web/src/app/dashboard/memberships/page.tsx` & `plans/page.tsx`:
    - Membership plan cards with pricing tiers, duration, branch scope, and active subscription directory.

### Milestone 6: Billing & Financial Management
- **Deliverables:**
  - Redesign `apps/web/src/app/dashboard/billing/page.tsx`:
    - Financial summary cards (Total Revenue, Paid Invoices, Outstanding Dues, Active Credits).
  - Redesign `apps/web/src/app/dashboard/billing/invoices/page.tsx`:
    - Invoice list, status filters (PAID, PARTIAL, UNPAID, VOID), invoice detail drawer, and invoice creation modal.
  - Redesign `apps/web/src/app/dashboard/billing/payments/page.tsx`:
    - Payment logs with method tags (UPI, CASH, CARD, NETBANKING), and Record Payment modal.
  - Redesign `apps/web/src/app/dashboard/billing/dues/page.tsx`:
    - Overdue member ledger with quick "Collect Payment" trigger.
  - Remove redundant `BillingNav` sub-header.

### Milestone 7: Branches, Team & Organization Settings
- **Deliverables:**
  - Redesign `apps/web/src/app/dashboard/branches/page.tsx`:
    - Branch directory cards with active staff count, capacity, and status badges.
  - Redesign `apps/web/src/app/dashboard/branches/[branchId]/page.tsx` & `staff/page.tsx`:
    - Branch details and staff assignment management.
  - Redesign `apps/web/src/app/dashboard/organization/page.tsx` & `profile/page.tsx`:
    - Clean organization settings, tax information, and business profile.

### Milestone 8: Public Pass Polish & Mobile/A11y Pass
- **Deliverables:**
  - Polish `/pass/[passToken]`: Digital wallet styling with animated QR, validity timer, and member badge.
  - Comprehensive responsiveness verification (Desktop 1440px+, Laptop 1024px, Tablet 768px, Mobile 375px).
  - Accessibility audit (ARIA labels, keyboard focus indicators, screen reader text, WCAG AA contrast).

### Milestone 9: Regression Testing & Final Visual QA
- **Deliverables:**
  - Full production build (`npm run build`).
  - Unit and integration tests (`npm run test`).
  - Browser inspection across Light and Dark themes.
  - Generate final `docs/ui-ux/GYMOS-REDESIGN-REPORT.md`.

---

## 3. Execution Plan

We will proceed step-by-step through each milestone:
1. **Milestone 1:** Enterprise Layout & App Shell (`AppShell`, `Sidebar`, `TopBar`, dashboard layout refactor).
2. **Milestone 2:** Design Tokens & Base UI Primitives (`stat-card`, `badge`, `data-table`, `modal`, `tabs`, `charts`).
3. **Milestone 3:** Overview Dashboard Redesign (`/dashboard`).
4. **Milestone 4:** Front Desk & Attendance Module.
5. **Milestone 5:** Member & Membership Management.
6. **Milestone 6:** Billing & Financial Management.
7. **Milestone 7:** Branches, Team & Settings.
8. **Milestone 8:** Polish, Responsive & Verification.
