"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginInput } from "@gymos/validation";
import { useAuth } from "@/lib/auth-context";
import { ApiClientError } from "@/lib/api-client";
import { AlertCircle, Dumbbell, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      setServerError(null);
      await login(data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError("An unexpected error occurred. Please try again.");
      }
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#131622] rounded-3xl border border-slate-200 dark:border-white/[0.08] shadow-2xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/25">
            <Dumbbell className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome to GymOS
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in to access your multi-tenant gym operations workspace
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {serverError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              placeholder="owner@yourgym.com"
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-rose-500">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[11px] text-violet-600 hover:text-violet-500 dark:text-violet-400 font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-rose-500">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-violet-500/20 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? "Authenticating..." : "Sign In to Dashboard"}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <p className="text-xs text-center text-slate-500 dark:text-slate-400 pt-2">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-violet-600 hover:text-violet-500 dark:text-violet-400 font-semibold"
            >
              Register Gym
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
