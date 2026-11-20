# GymOS — Comprehensive UI/UX Audit & Screen Inventory
**Document:** `docs/ui-ux/GYMOS-UI-UX-AUDIT.md`  
**Version:** 1.0.0  
**Baseline Commit:** `ce51fc6`  
**Date:** 2026-11-20  
**Scope:** Complete Next.js Frontend (`apps/web`)  
**Design Direction:** Enterprise SaaS (Equal Priority Light Mode + Dark Mode)

---

## 1. Executive Summary

GymOS is an automation-first, multi-tenant Gym Management SaaS. While the backend architecture (NestJS, Prisma, PostgreSQL RLS, BullMQ, Argon2id, QR cryptographic engine) is robust and production-grade, the frontend has evolved incrementally across milestone stages (Stages 2.1 through 2.7). 

As a result:
- The navigation model is fragmented: a single top navbar attempts to house all tenant, branch, module, and user controls in a cramped horizontal bar.
- Individual modules (Attendance, Billing) use disparate sub-navbars (`AttendanceNav`, `BillingNav`), while others (Members, Memberships, Branches) lack local navigation entirely.
- The root Dashboard (`/dashboard`) surfaces low-level technical architecture details (e.g., PostgreSQL RLS policies and JWT duration) rather than actionable gym management metrics.
- Forms and data tables rely on repetitive, inline Tailwind styles without centralized enterprise UI primitives.
- Mobile and tablet layouts suffer from horizontal navigation crowding, overlapping controls, and inconsistent touch targets.
- Dark mode lacks depth, card elevation hierarchy, and contrast refinement compared to the modern enterprise design standard.

This audit catalogues every route, screen, user journey, and design defect across the repository to establish the baseline for the full Enterprise UI/UX Redesign.

---

## 2. Existing Route Inventory & Current Implementation

| Route | File Path | Current Purpose | Auth / RBAC Required | Identified Usability & Design Issues |
|---|---|---|---|---|
| `/` | `apps/web/src/app/page.tsx` | Landing / Redirect | Public | Generic marketing placeholder; redirects authenticated users to `/dashboard`. Lacks branding coherence. |
| `/(auth)/login` | `apps/web/src/app/(auth)/login/page.tsx` | User Login | Public | Standalone card without enterprise split-screen or brand framing. |
| `/(auth)/register` | `apps/web/src/app/(auth)/register/page.tsx` | Organization & Admin Onboarding | Public | Long vertical form; lacks progressive onboarding feel. |
| `/(auth)/forgot-password` | `apps/web/src/app/(auth)/forgot-password/page.tsx` | Password Recovery Request | Public | Minimalist form; lacks helpful security messaging. |
| `/(auth)/reset-password` | `apps/web/src/app/(auth)/reset-password/page.tsx` | Set New Password | Public | Basic password reset interface. |
| `/(auth)/verify-email` | `apps/web/src/app/(auth)/verify-email/page.tsx` | Token Email Verification | Authenticated | Standalone prompt. Inconsistent alert banners. |
| `/(auth)/select-organization` | `apps/web/src/app/(auth)/select-organization/page.tsx` | Tenant Selection | Authenticated | Grid of cards; functional but plain; lacks search for multi-org users. |
| `/dashboard` | `apps/web/src/app/dashboard/page.tsx` | Executive Dashboard | Authenticated | **Critical Issue:** Displays developer-focused database/security status instead of business KPIs (active members, check-ins, revenue, dues, occupancy). |
| `/dashboard/attendance` | `apps/web/src/app/dashboard/attendance/page.tsx` | Live Floor & Attendance Overview | `attendance.floor.read` | Functional live occupancy cards and checked-in list, but uses custom `AttendanceNav` sub-header that clashes with the global top navbar. |
| `/dashboard/attendance/scanner` | `apps/web/src/app/dashboard/attendance/scanner/page.tsx` | Front Desk Browser QR Scanner | `attendance.checkin` | Video viewfinder works well, but layout on tablets/laptops is off-center; audio feedback is basic. |
| `/dashboard/attendance/history` | `apps/web/src/app/dashboard/attendance/history/page.tsx` | Attendance Logs & CSV Export | `attendance.read` | Functional table with filters, but pagination controls and table styling are ad-hoc. |
| `/dashboard/attendance/settings` | `apps/web/src/app/dashboard/attendance/settings/page.tsx` | Branch Attendance Rules | `attendance.settings.manage` | Raw form layout without structured card sections, tooltips, or preview of rules. |
| `/dashboard/billing` | `apps/web/src/app/dashboard/billing/page.tsx` | Billing Overview | `invoice.read`, `payment.read` | Shows summary cards, but separated by another custom sub-navbar (`BillingNav`). |
| `/dashboard/billing/invoices` | `apps/web/src/app/dashboard/billing/invoices/page.tsx` | Invoices Directory & Creation | `invoice.read`, `invoice.create` | Table layout lacks inline status badges and responsive card collapse on mobile. |
| `/dashboard/billing/payments` | `apps/web/src/app/dashboard/billing/payments/page.tsx` | Payments Log & Payment Recording | `payment.read`, `payment.record` | Record payment modal uses basic styling; receipt view is sparse. |
| `/dashboard/billing/dues` | `apps/web/src/app/dashboard/billing/dues/page.tsx` | Outstanding Dues Tracker | `invoice.read` | Plain list; lacks quick-action "Collect Payment" or automated reminder cues. |
| `/dashboard/billing/credits` | `apps/web/src/app/dashboard/billing/credits/page.tsx` | Member Credit Balances | `member_credit.read` | Basic member credit search and display. |
| `/dashboard/members` | `apps/web/src/app/dashboard/members/page.tsx` | Member Directory | `member.read` | Functional search and status filters, but table columns wrap awkwardly; mobile view hides critical data. |
| `/dashboard/members/new` | `apps/web/src/app/dashboard/members/new/page.tsx` | Add Member Form | `member.create` | Long single-column form; lacks visual steps or sensible field grouping (Personal, Emergency, Branch). |
| `/dashboard/members/[memberId]` | `apps/web/src/app/dashboard/members/[memberId]/page.tsx` | Member Profile & Tabs | `member.read` | Tab switching implemented via ad-hoc state; pass card is functional but visually unrefined. |
| `/dashboard/members/[memberId]/edit` | `apps/web/src/app/dashboard/members/[memberId]/edit/page.tsx` | Edit Member Details | `member.update` | Form duplicates `members/new` logic without shared form primitives. |
| `/dashboard/memberships` | `apps/web/src/app/dashboard/memberships/page.tsx` | Subscriptions Directory | `member_subscription.read` | List of member subscriptions; lacks quick renewal action. |
| `/dashboard/memberships/plans` | `apps/web/src/app/dashboard/memberships/plans/page.tsx` | Membership Plan Management | `membership_plan.read` | Functional plan cards and creation modal; lacks comparison view. |
| `/dashboard/branches` | `apps/web/src/app/dashboard/branches/page.tsx` | Branch Directory | `organization.branches.read` | Basic list of branches with active/inactive indicators. |
| `/dashboard/branches/new` | `apps/web/src/app/dashboard/branches/new/page.tsx` | Create Branch Form | `organization.branches.create` | Basic form without location/tax validation guidance. |
| `/dashboard/branches/[branchId]` | `apps/web/src/app/dashboard/branches/[branchId]/page.tsx` | Branch Details | `organization.branches.read` | Shows branch data; lacks visual integration with staff and settings. |
| `/dashboard/branches/[branchId]/staff` | `apps/web/src/app/dashboard/branches/[branchId]/staff/page.tsx` | Branch Staff Assignments | `organization.branch_staff.read` | Staff assignment modal is rudimentary. |
| `/dashboard/organization` | `apps/web/src/app/dashboard/organization/page.tsx` | Organization Settings | `organization.settings.read` | Disconnected form layout. |
| `/dashboard/organization/profile` | `apps/web/src/app/dashboard/organization/profile/page.tsx` | Organization Profile | `organization.profile.read` | Basic profile fields. |
| `/pass/[passToken]` | `apps/web/src/app/pass/[passToken]/page.tsx` | Public Member Mobile Pass | Public (Signed Token) | High-contrast mobile pass is functional, but lacks polished digital wallet aesthetics (Apple Wallet / Google Wallet feel). |
| `/health` | `apps/web/src/app/health/page.tsx` | System Status / Health Check | Public | Shows API & DB status. |
| `/unauthorized` | `apps/web/src/app/unauthorized/page.tsx` | Access Denied Screen | Public | Plain error text; lacks clear navigation back to authorized context. |

---

## 3. Usability Problems & Architecture Shortcomings

### 3.1 Fractured Navigation (Lack of an Application Shell)
- **Problem:** All pages currently share `apps/web/src/app/layout.tsx`, which injects `<Navbar />` and `<Footer />` globally.
- **Impact:** 
  - Every single route (even public pass and authentication screens) carries the same navbar.
  - The top navigation bar has 10+ items (`GymOS`, `System Status`, `Switch Organization`, `BranchSelector`, `Members`, `Memberships`, `Billing`, `Attendance`, `User Initials`, `Sign Out`, `ThemeToggle`) crammed horizontally into a single 64px header.
  - On laptops and tablets (< 1280px), navbar items wrap or trigger horizontal scrolling.
  - Sub-modules have had to invent secondary navigation bars (`AttendanceNav`, `BillingNav`) stacked beneath the top navbar, wasting vertical viewport real estate (120px+ eaten by headers alone).
- **Required Fix:** Introduce an enterprise sidebar navigation shell (`Sidebar` + `TopBar`) with collapsible states, breadcrumbs, search, user menu, and role-aware navigation grouping.

### 3.2 Developer Dashboard Instead of Business Dashboard
- **Problem:** The current `/dashboard` page displays:
  - "Authenticated multi-tenant session active via PostgreSQL RLS & Argon2id"
  - "PostgreSQL Row-Level Security: Active & Enforced"
  - "Session Duration: 15m Access / 7d Refresh"
  - Raw JSON-like user context dumps.
- **Impact:** Gym owners, managers, and receptionists see zero operational metrics upon logging in.
- **Required Fix:** Transform `/dashboard` into an executive and operational dashboard matching the design mockup:
  - 5 Real-Time KPI Cards: Active Members, Today's Check-ins, Expiring Memberships, Revenue (This Month), Outstanding Dues.
  - Attendance Trend chart (7-day check-in activity using real attendance data).
  - Live Floor gauge / occupancy donut with real-time capacity percentage.
  - Quick Action tiles (Scan QR, Add Member, Manual Check-in, Create Invoice).
  - Recent Check-ins live feed.
  - Expiring Memberships countdown list.
  - Operational Alerts / Insights.

### 3.3 Duplicate & Ad-Hoc UI Styling
- **Problem:** Only two components exist in `apps/web/src/components/ui`: `button.tsx` and `card.tsx`.
- **Impact:**
  - Every form input (`<input>`, `<select>`, `<textarea>`) is written with raw, duplicated Tailwind strings across 20+ page files.
  - Table headers, rows, cells, and empty states are re-coded from scratch on every page with varying borders and paddings.
  - Modal dialogs use inconsistent backdrop overlays, z-indexes, and transition animations.
  - Status badges use conflicting color palettes (e.g., active status is sometimes `emerald-600`, sometimes `green-500`, sometimes `purple-600`).
- **Required Fix:** Establish a complete, reusable UI component library:
  - `Badge` (with semantic variants: success, warning, destructive, neutral, accent).
  - `Input`, `Select`, `Textarea`, `Checkbox`, `Label`, `FormField`.
  - `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `TableEmpty`.
  - `Modal` / `Dialog` (with backdrop blur, focus trap, and keyboard Escape listener).
  - `Tabs` (with animated active pill indicators).
  - `StatCard` / `MetricCard`.
  - `EmptyState` and `Skeleton` loaders.

### 3.4 Theme Inconsistency (Light Mode vs Dark Mode)
- **Problem:**
  - Dark mode was built with harsh `#09090b` / `zinc-950` backgrounds and high-contrast `#27272a` borders without subtle elevation layering (surfaces, cards, popovers, borders).
  - Light mode was treated as an afterthought, resulting in washed-out cards, faint text contrast on light gray backgrounds, and jarring transitions.
  - Several components had hardcoded colors (e.g. `text-zinc-600`, `bg-white`) that failed to adapt when toggling between themes.
- **Required Fix:** Implement a unified semantic token system with layered surfaces (`surface-1`, `surface-2`, `surface-3`), refined borders, and vibrant accents that render with equal elegance in both Light and Dark modes.

### 3.5 Receptionist Workflow Friction (Front Desk Operations)
- **Problem:** Receptionists at a gym front desk have to juggle multiple disconnected screens:
  - Live floor is at `/dashboard/attendance`.
  - QR scanner is at `/dashboard/attendance/scanner`.
  - Manual check-in is an uncoordinated modal.
  - Member search requires navigating to `/dashboard/members`.
- **Impact:** Checking in a member or verifying an issue takes multiple page transitions and clicks.
- **Required Fix:** Consolidate Front Desk into a unified, high-efficiency operational workspace:
  - Live Floor with instant 1-click check-out.
  - Fast QR Scanner with instant admission/rejection sound, visual badges, and immediate retry.
  - Instant Manual Check-In with quick member search by code, phone, or name.
  - History log with real-time updates.

---

## 4. Role-Specific Navigation & Access Audit

Based on backend permissions and user roles (`SUPER_ADMIN`, `OWNER`, `ADMIN`, `MANAGER`, `STAFF`, `TRAINER`, `MEMBER`), the UI must show only authorized navigation sections:

| Module / Screen | Required Permission | Allowed Roles | UI Handling when Unauthorized |
|---|---|---|---|
| Executive Overview | `ORGANIZATION_DASHBOARD_READ` | Owner, Admin, Manager, Staff | Redirect to assigned branch or restricted front desk view. |
| Front Desk / Live Floor | `ATTENDANCE_FLOOR_READ` | Owner, Admin, Manager, Staff, Trainer | Show live floor and check-out button. |
| QR Scanner | `ATTENDANCE_CHECKIN` | Owner, Admin, Manager, Staff | Show scanner viewfinder. |
| Manual Check-in | `ATTENDANCE_MANUAL` | Owner, Admin, Manager, Staff | Show manual check-in form. |
| Attendance History | `ATTENDANCE_READ` | Owner, Admin, Manager, Staff | Show filterable history table. |
| Attendance Settings | `ATTENDANCE_SETTINGS_MANAGE` | Owner, Admin | Hide link in navigation for Staff/Trainer. |
| Member Directory | `MEMBER_READ` | Owner, Admin, Manager, Staff, Trainer | Show members; hide "Add Member" button if lacking `MEMBER_CREATE`. |
| Add / Edit Member | `MEMBER_CREATE`, `MEMBER_UPDATE` | Owner, Admin, Manager, Staff | Prevent navigation or display permission-denied state. |
| Member Access Pass | `ATTENDANCE_PASS_MANAGE` | Owner, Admin, Manager, Staff | Show Pass card and QR generation. |
| Membership Plans | `MEMBERSHIP_PLAN_READ` | Owner, Admin, Manager, Staff | Show plan cards; hide "Create Plan" if lacking `MEMBERSHIP_PLAN_MANAGE`. |
| Member Subscriptions | `MEMBER_SUBSCRIPTION_READ` | Owner, Admin, Manager, Staff | Show subscriptions; hide "Assign" if lacking `MEMBER_SUBSCRIPTION_ASSIGN`. |
| Invoices & Payments | `INVOICE_READ`, `PAYMENT_READ` | Owner, Admin, Manager, Staff | Show billing tables; hide payment recording if lacking `PAYMENT_RECORD`. |
| Outstanding Dues | `INVOICE_READ` | Owner, Admin, Manager | Show dues table. |
| Team & Staff | `ORGANIZATION_BRANCH_STAFF_READ` | Owner, Admin, Manager | Hide from Staff/Trainer. |
| Branches | `ORGANIZATION_BRANCHES_READ` | Owner, Admin | Hide from Staff/Trainer. |
| Organization Settings | `ORGANIZATION_SETTINGS_READ` | Owner, Admin | Hide from Manager, Staff, Trainer. |

---

## 5. Audit Conclusion & Next Steps

The current GymOS frontend is fully connected to working backend APIs, but its presentation resembles early-stage developer scaffolding rather than an enterprise SaaS product. 

The audit confirms:
1. All required data and endpoints are already available in the NestJS backend.
2. No backend schema or API changes are required.
3. The redesign must focus entirely on:
   - Modern enterprise layout (`AppShell` with collapsible `Sidebar` and unified `TopBar`).
   - Unified design tokens and reusable component system.
   - True executive & operational Overview Dashboard.
   - Streamlined Front Desk workspace.
   - Refined tables, forms, modals, and responsive layouts across all existing modules.
   - Equal-first-class Light Mode and Dark Mode styling.
