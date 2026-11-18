import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Activity, Users, CreditCard, CalendarCheck } from "lucide-react";

export default function DashboardShellPage() {
  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Gym Dashboard Shell
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Stage 1 Foundation: Architectural workspace shell. Business modules
          activate in Stage 2.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Members
            </CardTitle>
            <Users className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-zinc-500">Stage 2 Member Management</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today&apos;s Check-ins
            </CardTitle>
            <CalendarCheck className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-zinc-500">Stage 2 QR Attendance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Revenue
            </CardTitle>
            <CreditCard className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-zinc-500">
              Stage 2 Billing & Subscriptions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tenant Health</CardTitle>
            <Activity className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              Operational
            </div>
            <p className="text-xs text-zinc-500">
              Infrastructure Layer Connected
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">
          Stage 1 Foundation Completed
        </h3>
        <p className="mt-2 text-sm text-zinc-500 max-w-lg mx-auto">
          Monorepo architecture, Next.js frontend, NestJS backend, PostgreSQL
          schema, Redis caching, and BullMQ worker background queues are
          initialized and verified.
        </p>
      </div>
    </div>
  );
}
