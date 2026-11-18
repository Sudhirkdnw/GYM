import Link from "next/link";
import { ShieldCheck, Layers, Cpu, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-4 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          Stage 1 Foundation Operational
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-zinc-900 dark:text-zinc-50">
          Gym Management & Automation{" "}
          <span className="text-emerald-600">Reimagined</span>
        </h1>
        <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          GymOS is a multi-tenant SaaS built for gym owners, staff, and fitness
          enterprises. Engineered as a high-performance modular monolith with
          tenant-scoped isolation.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link href="/dashboard">
            <Button size="lg">Enter Dashboard</Button>
          </Link>
          <Link href="/health">
            <Button variant="outline" size="lg">
              Inspect System Health
            </Button>
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-20 max-w-5xl">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <Layers className="h-8 w-8 text-emerald-600 mb-2" />
              <CardTitle className="text-lg">Modular Monolith</CardTitle>
              <CardDescription>
                Clean domain boundaries with shared type contracts.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-zinc-500">
              Structured modules for CRM, attendance, and billing ready for
              Stage 2.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Database className="h-8 w-8 text-emerald-600 mb-2" />
              <CardTitle className="text-lg">PostgreSQL & Prisma</CardTitle>
              <CardDescription>
                PostgreSQL connection and multi-tenant schema.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-zinc-500">
              PostgreSQL 18 database with decimal precision money types.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Cpu className="h-8 w-8 text-emerald-600 mb-2" />
              <CardTitle className="text-lg">Redis & BullMQ</CardTitle>
              <CardDescription>
                Decoupled async job processing foundation.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-zinc-500">
              Gracefully managed background queue worker architecture.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <ShieldCheck className="h-8 w-8 text-emerald-600 mb-2" />
              <CardTitle className="text-lg">Multi-Tenancy</CardTitle>
              <CardDescription>
                Strict tenant-scoped isolation architecture.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-zinc-500">
              Tenant context resolution and PostgreSQL RLS design conventions.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
