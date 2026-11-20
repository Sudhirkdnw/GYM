"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  QrCode,
  Users,
  CreditCard,
  Receipt,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  CalendarCheck,
  Building,
  ArrowLeftRight,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEntitlements } from "@/hooks/useEntitlements";

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  permission?: string;
  requiredFeature?: string;
  subItems?: { label: string; href: string; exact?: boolean; requiredFeature?: string }[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function Sidebar({
  isOpen,
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, organization } = useAuth();
  const { isEntitled } = useEntitlements();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    "Front Desk": true,
    Memberships: false,
    Finance: false,
  });

  const toggleSubmenu = (label: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const navSections: NavSection[] = [
    ...(user?.isSuperAdmin
      ? [
          {
            title: "PLATFORM SAAS",
            items: [
              {
                label: "Super Admin Console",
                href: "/platform",
                icon: ShieldCheck,
              },
            ],
          },
        ]
      : []),
    {
      title: "WORKSPACE",
      items: [
        {
          label: "Overview",
          href: "/dashboard",
          icon: LayoutDashboard,
          exact: true,
        },
      ],
    },
    {
      title: "OPERATIONS",
      items: [
        {
          label: "Front Desk",
          href: "/dashboard/attendance",
          icon: QrCode,
          subItems: [
            { label: "Live Floor", href: "/dashboard/attendance", exact: true },
            { label: "QR Scanner", href: "/dashboard/attendance/scanner" },
            {
              label: "Counter QR (Kiosk)",
              href: "/dashboard/attendance/kiosk",
              requiredFeature: "attendance.kiosk.dynamic_qr",
            },
            {
              label: "Attendance History",
              href: "/dashboard/attendance/history",
              requiredFeature: "attendance.history.export",
            },
          ],
        },
        {
          label: "Members",
          href: "/dashboard/members",
          icon: Users,
          requiredFeature: "members.read",
        },
        {
          label: "Memberships",
          href: "/dashboard/memberships",
          icon: CreditCard,
          requiredFeature: "memberships.plans.create",
          subItems: [
            { label: "Subscriptions", href: "/dashboard/memberships", exact: true },
            { label: "Plans", href: "/dashboard/memberships/plans" },
          ],
        },
        {
          label: "Finance",
          href: "/dashboard/billing",
          icon: Receipt,
          requiredFeature: "billing.invoices.view",
          subItems: [
            { label: "Overview", href: "/dashboard/billing", exact: true },
            { label: "Invoices", href: "/dashboard/billing/invoices" },
            { label: "Payments", href: "/dashboard/billing/payments" },
            { label: "Outstanding Dues", href: "/dashboard/billing/dues" },
            { label: "Credits", href: "/dashboard/billing/credits" },
          ],
        },
      ],
    },
    {
      title: "MANAGEMENT",
      items: [
        {
          label: "Branches",
          href: "/dashboard/branches",
          icon: Building2,
          requiredFeature: "core.branches.multi",
        },
      ],
    },
    {
      title: "SETTINGS",
      items: [
        {
          label: "Attendance Settings",
          href: "/dashboard/attendance/settings",
          icon: CalendarCheck,
        },
        {
          label: "Organization",
          href: "/dashboard/organization",
          icon: Building,
        },
        {
          label: "Switch Gym",
          href: "/select-organization",
          icon: ArrowLeftRight,
        },
      ],
    },
  ];

  const visibleNavSections = navSections
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => !item.requiredFeature || isEntitled(item.requiredFeature))
        .map((item) => ({
          ...item,
          subItems: item.subItems?.filter(
            (sub) => !sub.requiredFeature || isEntitled(sub.requiredFeature),
          ),
        })),
    }))
    .filter((section) => section.items.length > 0);

  const isActive = (href: string, exact: boolean = false) => {
    if (exact) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r transition-all duration-300 ease-in-out
          bg-white dark:bg-[#0e1017] border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-zinc-100
          ${isCollapsed ? "w-20" : "w-64"}
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200 dark:border-white/[0.08]">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 overflow-hidden group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-glow shadow-violet-500/30 text-white font-bold">
              <span className="text-xl">🏋️</span>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                  GymOS
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium tracking-wide uppercase truncate">
                  Gym Management SaaS
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse / Mobile Close */}
          <div className="flex items-center">
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {visibleNavSections.map((section) => (
            <div key={section.title} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 pb-1.5 text-[10px] font-bold tracking-wider text-slate-400 dark:text-zinc-500 uppercase">
                  {section.title}
                </div>
              )}

              {section.items.map((item) => {
                const ItemIcon = item.icon;
                const hasSub = item.subItems && item.subItems.length > 0;
                const isItemActive = hasSub
                  ? item.subItems?.some((sub) => isActive(sub.href, sub.exact))
                  : isActive(item.href, item.exact);
                const isSubOpen = expandedMenus[item.label] ?? false;

                return (
                  <div key={item.label} className="space-y-1">
                    {hasSub && !isCollapsed ? (
                      <div>
                        <button
                          onClick={() => toggleSubmenu(item.label)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                            isItemActive
                              ? "bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white"
                              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <ItemIcon
                              className={`h-4 w-4 shrink-0 transition-colors ${
                                isItemActive
                                  ? "text-violet-600 dark:text-violet-400"
                                  : "text-slate-500 dark:text-zinc-400 group-hover:text-slate-700 dark:group-hover:text-zinc-200"
                              }`}
                            />
                            <span>{item.label}</span>
                          </div>
                          {isSubOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                          )}
                        </button>

                        {/* Submenu */}
                        {isSubOpen && (
                          <div className="ml-7 mt-1 pl-2 border-l border-slate-200 dark:border-white/[0.08] space-y-1">
                            {item.subItems?.map((sub) => {
                              const isSubActive = isActive(sub.href, sub.exact);
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  onClick={onCloseMobile}
                                  className={`block px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    isSubActive
                                      ? "bg-violet-50 text-violet-700 dark:bg-gradient-to-r dark:from-violet-600/30 dark:to-indigo-600/20 dark:text-white font-semibold border-l-2 border-violet-600 -ml-[9px] pl-3"
                                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                                  }`}
                                >
                                  {sub.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={onCloseMobile}
                        title={isCollapsed ? item.label : undefined}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                          isItemActive
                            ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-glow shadow-violet-500/25 font-semibold"
                            : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                        } ${isCollapsed ? "justify-center" : ""}`}
                      >
                        <ItemIcon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isItemActive
                              ? "text-white"
                              : "text-slate-500 dark:text-zinc-400 group-hover:text-slate-700 dark:group-hover:text-zinc-200"
                          }`}
                        />
                        {!isCollapsed && <span>{item.label}</span>}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Organization / User Snapshot at Bottom */}
        {!isCollapsed && organization && (
          <div className="p-3 border-t border-slate-200 dark:border-white/[0.08]">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.05]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:border dark:border-violet-500/30 dark:text-violet-300 font-bold text-xs uppercase">
                {organization.name.substring(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {organization.name}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-medium">
                  {organization.role}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
