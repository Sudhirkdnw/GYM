"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerUserSchema, RegisterUserInput } from "@gymos/validation";
import { useAuth } from "@/lib/auth-context";
import { ApiClientError } from "@/lib/api-client";
import { AlertCircle, Dumbbell, ArrowRight } from "lucide-react";

export default function RegisterPage() {
  const { register: registerAuth } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterUserInput>({
    resolver: zodResolver(registerUserSchema),
  });

  const handleGymNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue("gymName", val);
    const generatedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setValue("slug", generatedSlug);
  };

  const onSubmit = async (data: RegisterUserInput) => {
    try {
      setServerError(null);
      await registerAuth(data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError("Registration failed. Please verify your details.");
      }
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#131622] rounded-3xl border border-slate-200 dark:border-white/[0.08] shadow-2xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/25">
            <Dumbbell className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Register Your Gym
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Create your owner account and start your multi-tenant SaaS workspace
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

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="firstName"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                autoComplete="given-name"
                {...register("firstName")}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                placeholder="John"
                aria-invalid={!!errors.firstName}
              />
              {errors.firstName && (
                <p className="mt-1 text-[11px] text-rose-500">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                autoComplete="family-name"
                {...register("lastName")}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                placeholder="Doe"
                aria-invalid={!!errors.lastName}
              />
              {errors.lastName && (
                <p className="mt-1 text-[11px] text-rose-500">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Owner Work Email
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
              <p className="mt-1 text-[11px] text-rose-500">{errors.email.message}</p>
            )}
          </div>



          <div>
            <label
              htmlFor="gymName"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Gym / Brand Name
            </label>
            <input
              id="gymName"
              type="text"
              {...register("gymName")}
              onChange={handleGymNameChange}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              placeholder="FitZone Fitness Club"
              aria-invalid={!!errors.gymName}
            />
            {errors.gymName && (
              <p className="mt-1 text-[11px] text-rose-500">{errors.gymName.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="slug"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Workspace Subdomain / Slug
            </label>
            <div className="flex rounded-xl shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-white/[0.05] text-[11px] text-slate-500 dark:text-slate-400">
                gymos.io/
              </span>
              <input
                id="slug"
                type="text"
                {...register("slug")}
                className="w-full px-3 py-2 text-xs rounded-r-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
                placeholder="fitzone"
                aria-invalid={!!errors.slug}
              />
            </div>
            {errors.slug && (
              <p className="mt-1 text-[11px] text-rose-500">{errors.slug.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
            />
            {errors.password && (
              <p className="mt-1 text-[11px] text-rose-500">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-violet-500/20 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? "Creating Workspace..." : "Create Organization Account"}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <p className="text-xs text-center text-slate-500 dark:text-slate-400 pt-2">
            Already registered?{" "}
            <Link
              href="/login"
              className="text-violet-600 hover:text-violet-500 dark:text-violet-400 font-semibold"
            >
              Sign In
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
