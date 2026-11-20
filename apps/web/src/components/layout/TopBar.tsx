"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  Building2,
  ChevronDown,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  Check,
  Building,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";

interface TopBarProps {
  onOpenMobileSidebar: () => void;
  _isSidebarCollapsed?: boolean;
}

export function TopBar({
  onOpenMobileSidebar,
  _isSidebarCollapsed,
}: TopBarProps) {
  const {
    user,
    organization,
    branches,
    selectedBranch,
    selectBranch,
    logout,
  } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const router = useRouter();

  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const branchMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        branchMenuRef.current &&
        !branchMenuRef.current.contains(e.target as Node)
      ) {
        setIsBranchMenuOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/dashboard/members?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const userInitials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user?.firstName
      ? user.firstName.substring(0, 2).toUpperCase()
      : "U";

  return (
    <header
      className={`sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b px-4 lg:px-8 transition-all duration-300
        bg-white/80 dark:bg-[#0b0c12]/80 backdrop-blur-md
        border-slate-200 dark:border-white/[0.08]
      `}
    >
      {/* Left: Mobile Menu & Organization/Branch Selectors */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Organization Badge / Switcher */}
        {organization && (
          <Link
            href="/select-organization"
            className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all
              bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800
              dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/[0.08] dark:text-zinc-200"
            title="Switch Gym Organization"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600/15 text-violet-600 dark:text-violet-400">
              <Building className="h-4 w-4" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold leading-tight truncate max-w-[140px]">
                {organization.name}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">
                {branches.length} {branches.length === 1 ? "Branch" : "Branches"}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
          </Link>
        )}

        {/* Active Branch Selector Dropdown */}
        {branches.length > 0 && (
          <div className="relative" ref={branchMenuRef}>
            <button
              onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all
                bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800
                dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/[0.08] dark:text-zinc-200"
            >
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold truncate max-w-[120px]">
                {selectedBranch ? selectedBranch.name : "All Branches"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
            </button>

            {isBranchMenuOpen && (
              <div
                className="absolute left-0 mt-2 w-56 rounded-xl border shadow-xl p-1.5 z-50 animate-in fade-in-80
                  bg-white border-slate-200 text-slate-800
                  dark:bg-[#131622] dark:border-white/[0.1] dark:text-zinc-100"
              >
                <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 dark:text-zinc-400 uppercase tracking-wider">
                  Select Branch Context
                </div>
                {branches.map((b) => {
                  const isSelected = selectedBranch?.id === b.id;
                  return (
                    <button
                      key={b.id}
                      onClick={() => {
                        selectBranch(b.id);
                        setIsBranchMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isSelected
                          ? "bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 font-semibold"
                          : "hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-700 dark:text-zinc-300"
                      }`}
                    >
                      <span className="truncate">{b.name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Middle: Global Search Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="hidden md:flex flex-1 max-w-md mx-6"
      >
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search members, invoices, plans... (Enter)"
            className="w-full pl-9 pr-12 py-2 rounded-xl text-xs border transition-all focus:outline-none
              bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20
              dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-violet-500 dark:focus:ring-violet-500/30"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 dark:text-zinc-500 bg-slate-200/60 dark:bg-white/[0.08] rounded border border-slate-300 dark:border-white/[0.1]">
            Ctrl K
          </kbd>
        </div>
      </form>

      {/* Right: Theme Toggle, Notifications, User Menu */}
      <div className="flex items-center gap-2.5">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl border transition-all text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] border-slate-200 dark:border-white/[0.08]"
          title={`Switch to ${resolvedTheme === "dark" ? "Light" : "Dark"} Mode`}
          aria-label="Toggle theme"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-slate-700" />
          )}
        </button>

        {/* Notifications Icon */}
        <button
          className="relative p-2 rounded-xl border transition-all text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] border-slate-200 dark:border-white/[0.08]"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-violet-500 ring-2 ring-white dark:ring-[#0b0c12]" />
        </button>

        {/* User Profile Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl border transition-all
              bg-slate-50 hover:bg-slate-100 border-slate-200
              dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/[0.08]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 text-white font-bold text-xs shadow-sm">
              {userInitials}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 leading-tight">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium capitalize">
                {organization?.role?.toLowerCase() || "Staff"}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 hidden sm:block" />
          </button>

          {isUserMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-xl border shadow-xl p-1.5 z-50 animate-in fade-in-80
                bg-white border-slate-200 text-slate-800
                dark:bg-[#131622] dark:border-white/[0.1] dark:text-zinc-100"
            >
              <div className="px-3 py-2 border-b border-slate-100 dark:border-white/[0.08]">
                <p className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                  {user?.email}
                </p>
              </div>

              <div className="py-1">
                <Link
                  href="/dashboard/organization"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                >
                  <Building2 className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                  <span>Gym Settings</span>
                </Link>
                <Link
                  href="/select-organization"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                >
                  <UserIcon className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                  <span>Switch Organization</span>
                </Link>
              </div>

              <div className="pt-1 border-t border-slate-100 dark:border-white/[0.08]">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors font-medium"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
