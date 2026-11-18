export function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 py-8">
      <div className="container mx-auto px-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
        <p>
          &copy; {new Date().getFullYear()} GymOS SaaS. Stage 1 Architectural
          Foundation.
        </p>
        <p className="mt-1 text-xs">
          Multi-Tenant Gym Management & Automation Platform
        </p>
      </div>
    </footer>
  );
}
