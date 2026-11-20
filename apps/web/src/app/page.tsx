import Link from "next/link";
import { ShieldCheck, Layers, ArrowRight, Activity, Users, CreditCard } from "lucide-react";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden py-16 sm:py-24">
      {/* Background glow effects */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 blur-[120px] pointer-events-none rounded-full" />

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3.5 py-1 text-xs font-semibold text-violet-600 dark:text-violet-300">
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            Enterprise Gym Automation SaaS
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-slate-900 dark:text-white">
            Next-Gen Gym Operations{" "}
            <span className="bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
              Engineered for Scale
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            GymOS delivers unified multi-tenant facility management, dynamic QR front-desk check-ins, automated billing, and audit-grade financial ledgers for modern gym enterprises.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/25 transition-all"
            >
              Enter Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/health"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-semibold border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131622] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 shadow-sm transition-colors"
            >
              <Activity className="w-4 h-4 text-emerald-500" />
              System Status
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="mx-auto mt-20 max-w-5xl">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center mb-3">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                Modular Monolith
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Isolated NestJS domain boundaries with shared type contracts and zero circular dependencies.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                PostgreSQL RLS
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Multi-tenant row-level security with ENABLE + FORCE policies guaranteeing strict tenant isolation.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                Dynamic QR Attendance
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rotating digital passcodes with cryptographic HMAC signatures and anti-passback cooldowns.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                Billing & Credits
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                GST compliant invoicing, aging receivables tracking, and immutable prepaid credit wallets.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
