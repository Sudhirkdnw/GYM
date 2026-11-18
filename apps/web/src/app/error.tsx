"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled UI Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
      <div className="mb-4 rounded-full bg-red-100 p-3 text-red-600 dark:bg-red-950/50">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        Something went wrong
      </h2>
      <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        {error.message ||
          "An unexpected error occurred while rendering this page."}
      </p>
      <div className="mt-6 flex gap-4">
        <Button onClick={() => reset()}>Try Again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          Return Home
        </Button>
      </div>
    </div>
  );
}
