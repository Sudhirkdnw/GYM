"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileText,
  CreditCard,
  Clock,
  Wallet,
} from "lucide-react";

export function BillingNav() {
  const pathname = usePathname();

  const links = [
    {
      name: "Overview",
      href: "/dashboard/billing",
      icon: BarChart3,
      exact: true,
    },
    {
      name: "Invoices",
      href: "/dashboard/billing/invoices",
      icon: FileText,
      exact: false,
    },
    {
      name: "Payments",
      href: "/dashboard/billing/payments",
      icon: CreditCard,
      exact: false,
    },
    {
      name: "Outstanding Dues",
      href: "/dashboard/billing/dues",
      icon: Clock,
      exact: false,
    },
    {
      name: "Member Credits",
      href: "/dashboard/billing/credits",
      icon: Wallet,
      exact: false,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-6">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = link.exact
          ? pathname === link.href
          : pathname?.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              isActive
                ? "bg-emerald-600 text-white shadow-sm font-semibold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{link.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
