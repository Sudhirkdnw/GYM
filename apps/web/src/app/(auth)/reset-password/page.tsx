"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, ResetPasswordInput } from "@gymos/validation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { Lock, CheckCircle2, AlertCircle } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = searchParams?.get("token") || "";

  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: initialToken,
    },
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    try {
      setServerError(null);
      await apiClient("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(data),
      });

      setIsSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError("Failed to reset password. Token may be expired.");
      }
    }
  };

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md shadow-lg border-zinc-200 dark:border-zinc-800 text-center p-6">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <CardTitle className="text-2xl font-bold mb-2">Password Reset Successful</CardTitle>
        <CardDescription className="mb-6">
          Your credentials have been securely updated. Redirecting to login...
        </CardDescription>
        <Link href="/login">
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            Go to Login
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-lg border-zinc-200 dark:border-zinc-800">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <Lock className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
        <CardDescription>
          Enter your single-use verification token and choose a new password
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          {serverError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-900"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="token"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Reset Token
            </label>
            <input
              id="token"
              type="text"
              {...register("token")}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 font-mono"
              placeholder="Paste token from email or reset prompt"
              aria-invalid={!!errors.token}
            />
            {errors.token && (
              <p className="mt-1 text-xs text-red-500">{errors.token.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...register("newPassword")}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              aria-invalid={!!errors.newPassword}
            />
            {errors.newPassword && (
              <p className="mt-1 text-xs text-red-500">
                {errors.newPassword.message}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Updating Password..." : "Update Password"}
          </Button>
          <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
            <Link
              href="/login"
              className="text-emerald-600 hover:underline dark:text-emerald-400 font-medium"
            >
              Back to Sign In
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <Suspense fallback={<div>Loading reset form...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
