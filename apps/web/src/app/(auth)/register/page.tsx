"use client";

import React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const registerSchema = z.object({
  gymName: z.string().min(2, "Gym name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Tenant slug must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  ownerEmail: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    // Stage 1 Foundation Shell
    console.log("Registration submitted (Stage 1 Foundation):", data);
    alert(
      "Stage 1 Foundation: Tenant registration endpoints will be implemented in Stage 2.",
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Register Your Gym on GymOS
          </CardTitle>
          <CardDescription>
            Create a new isolated multi-tenant organization
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Gym / Organization Name
              </label>
              <input
                type="text"
                {...register("gymName")}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800"
                placeholder="Titan Fitness Arena"
              />
              {errors.gymName && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.gymName.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tenant Subdomain Slug
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="text"
                  {...register("slug")}
                  className="block w-full rounded-l-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="titan-fitness"
                />
                <span className="inline-flex items-center rounded-r-md border border-l-0 border-zinc-300 bg-zinc-50 px-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
                  .gymos.cloud
                </span>
              </div>
              {errors.slug && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.slug.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Owner Email Address
              </label>
              <input
                type="email"
                {...register("ownerEmail")}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800"
                placeholder="owner@titanfitness.com"
              />
              {errors.ownerEmail && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.ownerEmail.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Password
              </label>
              <input
                type="password"
                {...register("password")}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating Organization..." : "Create Gym Tenant"}
            </Button>
            <p className="text-xs text-center text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="text-emerald-600 hover:underline">
                Sign In
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
