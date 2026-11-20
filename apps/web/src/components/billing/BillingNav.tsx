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
      name: "Financial Overview",
      href: "/dashboard/billing",
      icon: BarChart3,
      exact: true,
    },
    {
      name: "Invoices Ledger",
      href: "/dashboard/billing/invoices",
      icon: FileText,
      exact: false,
    },
    {
      name: "Payment Receipts",
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
    <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-card/60 border border-border/60 backdrop-blur-xl w-fit overflow-x-auto max-w-full shadow-sm">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = link.exact
          ? pathname === link.href
          : pathname?.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              isActive
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{link.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
