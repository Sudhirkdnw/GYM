"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-red-200 dark:border-red-900 text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-bold text-red-600 dark:text-red-400">
            Access Denied
          </CardTitle>
          <CardDescription>
            You do not have the required role permissions to perform this action or view this resource.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            If you believe this is an error, please contact your Gym Administrator or Gym Owner to update your role permissions.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Link href="/dashboard" className="w-full">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Return to Dashboard
            </Button>
          </Link>
          <Link href="/select-organization" className="w-full">
            <Button variant="outline" className="w-full flex items-center justify-center gap-2">
              <Building2 className="h-4 w-4" /> Switch Organization
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
