"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { HealthCheckResult } from "@gymos/shared-types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SystemHealthPage() {
  const { data, error, isLoading, refetch, isFetching } =
    useQuery<HealthCheckResult>({
      queryKey: ["system-health"],
      queryFn: () => apiClient<HealthCheckResult>("health"),
      refetchInterval: 10000,
    });

  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            System Infrastructure Health
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Live health verification for GymOS API, PostgreSQL database, and
            Redis cache/queues
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50/50 dark:border-red-950 dark:bg-red-950/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <XCircle className="h-6 w-6 text-red-600" />
              <CardTitle className="text-red-900 dark:text-red-300">
                API Connection Failed
              </CardTitle>
            </div>
            <CardDescription className="text-red-700 dark:text-red-400">
              {error instanceof Error
                ? error.message
                : "Could not contact the GymOS backend service."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : data ? (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Overall Status</CardTitle>
                <CardDescription>
                  Uptime: {data.uptime} seconds | Environment:{" "}
                  {data.environment}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {data.status === "ok" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> Operational
                  </span>
                ) : data.status === "degraded" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" /> Degraded
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-300">
                    <XCircle className="h-4 w-4" /> Outage
                  </span>
                )}
              </div>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Database Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    PostgreSQL Database
                  </CardTitle>
                  {data.services.database.status === "up" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <CardDescription>
                  Multi-tenant relational database storage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Status:</span>
                  <span className="font-semibold uppercase">
                    {data.services.database.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Latency:</span>
                  <span>{data.services.database.latencyMs} ms</span>
                </div>
                {data.services.database.message && (
                  <div className="text-xs text-red-500 mt-2">
                    {data.services.database.message}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Redis Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Redis Cache & Queue
                  </CardTitle>
                  {data.services.redis.status === "up" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <CardDescription>
                  In-memory cache and BullMQ job runner
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Status:</span>
                  <span className="font-semibold uppercase">
                    {data.services.redis.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Latency:</span>
                  <span>{data.services.redis.latencyMs} ms</span>
                </div>
                {data.services.redis.message && (
                  <div className="text-xs text-red-500 mt-2">
                    {data.services.redis.message}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
