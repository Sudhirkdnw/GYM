"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, ForgotPasswordInput } from "@gymos/validation";
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
import { KeyRound, CheckCircle2, AlertCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [devNotice, setDevNotice] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      setServerError(null);
      setSuccessMessage(null);
      setDevNotice(null);

      const res = await apiClient<{ message: string; devTokenNotice?: string }>(
        "/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      );

      setSuccessMessage(res.message);
      if (res.devTokenNotice) {
        setDevNotice(res.devTokenNotice);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError("Failed to send reset instructions. Please try again.");
      }
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-zinc-200 dark:border-zinc-800">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>
            Enter your account email to receive a secure password reset link
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
                <div className="space-y-2">
                  <p>{successMessage}</p>
                  {devNotice && (
                    <div className="rounded bg-emerald-100 p-2 font-mono text-xs dark:bg-emerald-900/50">
                      {devNotice}
                    </div>
                  )}
                </div>
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
                htmlFor="email"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="owner@yourgym.com"
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending Request..." : "Send Reset Link"}
            </Button>
            <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
              Remember your password?{" "}
              <Link
                href="/login"
                className="text-emerald-600 hover:underline dark:text-emerald-400 font-medium"
              >
                Return to Login
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
