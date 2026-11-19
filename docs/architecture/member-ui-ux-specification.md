# GymOS — Member Management UI/UX Specification (Stage 2.4 Planning)

## 1. Design System & Component Reuse

The Member Management module reuses existing GymOS frontend primitives (`apps/web/src`):
- **Components**: `Card`, `Button`, `Navbar`, `BranchSelector`
- **Styling**: Tailwind CSS with dark/light mode tokens (`zinc`, `emerald`, `red`)
- **Icons**: Lucide React (`Users`, `UserPlus`, `Search`, `Building2`, `Phone`, `Mail`, `ArrowRightLeft`, `Archive`, `AlertCircle`)
- **Validation**: React Hook Form + `@hookform/resolvers/zod` with `@gymos/validation` schemas

---

## 2. Screen Specifications

### 2.1 `/dashboard/members` (Directory Screen)
- **Header**:
  - Title: "Members Directory"
  - Subtitle: "Manage gym members, registrations, and branch assignments"
  - Action Button: "+ Register Member" (Links to `/dashboard/members/new`)
- **Search & Filters Toolbar**:
  - Live search input: Debounced search for Name, Phone, Email, or Member Number (`MEM-XXXXX`).
  - Branch Selector Filter: Filter by specific physical branch or "All Branches" (restricted to assigned branches for Staff).
  - Status Filter: `All`, `Active`, `Inactive`, `Suspended`, `Archived`.
- **Members Table / Mobile Card Grid**:
  - Columns: Member ID, Name, Contact (Phone/Email), Home Branch, Status Badge, Join Date, Actions.
  - Badges:
    - `ACTIVE`: `bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300`
    - `INACTIVE`: `bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300`
    - `SUSPENDED`: `bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300`
    - `ARCHIVED`: `bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300`
- **Pagination Controls**: Server-side page navigation with total counts.

### 2.2 `/dashboard/members/new` (Registration Form)
- **Card 1: Facility Assignment**:
  - Branch selector dropdown (defaults to current active branch from `BranchSelector`).
- **Card 2: Personal Information**:
  - First Name, Last Name, Preferred Name (Optional), Gender dropdown, Date of Birth.
- **Card 3: Contact & Address**:
  - Phone Number (Required, with format hint), Email Address (Optional), Address Line 1 & 2, City, State, PIN Code.
- **Card 4: Emergency Contact Details**:
  - Emergency Contact Name, Emergency Phone Number, Relationship (e.g. Spouse, Parent, Friend).
- **Card 5: Internal Notes**:
  - Free-form text area for medical alerts, fitness goals, or administrative notes.

### 2.3 `/dashboard/members/[memberId]` (Profile & Details)
- **Profile Banner**:
  - Member photo/avatar, Member Number badge, Full Name, Current Status badge, Home Branch link.
- **Quick Action Bar**:
  - "Edit Profile" button
  - "Change Status" dropdown (Active / Inactive / Suspended)
  - "Transfer Branch" modal trigger
  - "Archive Member" modal trigger (with confirmation prompt)
- **Tabbed Information Panes**:
  - **Overview Tab**: Personal info, contact details, emergency contacts, notes.
  - **Branch History Tab**: List of previous transfers with timestamps, reasons, and authorized actors.
  - **Future Extensions Tab**: Placeholder for Subscriptions (Stage 2.5) & Attendance History (Stage 2.6).

### 2.4 `/dashboard/members/[memberId]/edit` (Profile Editor)
- Pre-populated form allowing updates to contact info, address, emergency contact, and notes.
- Home branch cannot be changed directly in this form (must use verified Branch Transfer workflow).
