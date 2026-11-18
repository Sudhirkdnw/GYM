"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { verifyEmailSchema, VerifyEmailInput } from "@gymos/validation";
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
import { MailCheck, CheckCircle2, AlertCircle } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams?.get("token") || "";

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      token: tokenParam,
    },
  });

  useEffect(() => {
    if (tokenParam) {
      setValue("token", tokenParam);
    }
  }, [tokenParam, setValue]);

  const onSubmit = async (data: VerifyEmailInput) => {
    try {
      setServerError(null);
      const res = await apiClient<{ message: string }>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify(data),
      });

      setSuccessMessage(res.message);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError("Failed to verify email. Token may be invalid or expired.");
      }
    }
  };

  return (
    <Card className="w-full max-w-md shadow-lg border-zinc-200 dark:border-zinc-800">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <MailCheck className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold">Email Verification</CardTitle>
        <CardDescription>
          Verify your email address to unlock all organization capabilities
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          {successMessage && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p>{successMessage}</p>
            </div>
          )}

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
              Verification Token
            </label>
            <input
              id="token"
              type="text"
              {...register("token")}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 font-mono"
              placeholder="Paste verification token"
              aria-invalid={!!errors.token}
            />
            {errors.token && (
              <p className="mt-1 text-xs text-red-500">{errors.token.message}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Verifying..." : "Verify Email"}
          </Button>
          <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
            <Link
              href="/dashboard"
              className="text-emerald-600 hover:underline dark:text-emerald-400 font-medium"
            >
              Return to Dashboard
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <Suspense fallback={<div>Loading verification...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
