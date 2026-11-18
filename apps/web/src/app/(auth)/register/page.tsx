"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerUserSchema, RegisterUserInput } from "@gymos/validation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { ApiClientError } from "@/lib/api-client";
import { AlertCircle, Building2 } from "lucide-react";

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
      <Card className="w-full max-w-lg shadow-lg border-zinc-200 dark:border-zinc-800">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <Building2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Register Your Gym</CardTitle>
          <CardDescription>
            Create your owner account and start your multi-tenant SaaS workspace
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  {...register("firstName")}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="John"
                  aria-invalid={!!errors.firstName}
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.firstName.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  {...register("lastName")}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="Doe"
                  aria-invalid={!!errors.lastName}
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Work Email Address
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

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <label
                htmlFor="gymName"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Gym Organization Name
              </label>
              <input
                id="gymName"
                type="text"
                {...register("gymName")}
                onChange={handleGymNameChange}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="e.g. Iron Forge Gym"
                aria-invalid={!!errors.gymName}
              />
              {errors.gymName && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.gymName.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="slug"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Gym Tenant Slug
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <span className="inline-flex items-center rounded-l-md border border-r-0 border-zinc-300 bg-zinc-50 px-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  app.gymos.com/
                </span>
                <input
                  id="slug"
                  type="text"
                  {...register("slug")}
                  className="block w-full min-w-0 flex-1 rounded-none rounded-r-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="iron-forge"
                  aria-invalid={!!errors.slug}
                />
              </div>
              {errors.slug && (
                <p className="mt-1 text-xs text-red-500">{errors.slug.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating Gym Workspace..." : "Create Gym Workspace"}
            </Button>
            <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
              Already registered?{" "}
              <Link
                href="/login"
                className="text-emerald-600 hover:underline dark:text-emerald-400 font-medium"
              >
                Sign In
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
