"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Load sidebar collapsed state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("gymos_sidebar_collapsed");
      if (saved !== null) {
        setIsSidebarCollapsed(saved === "true");
      }
    } catch {
      // LocalStorage access may fail in restricted iframes
    }
  }, []);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("gymos_sidebar_collapsed", String(next));
      } catch {
        // LocalStorage access may fail in restricted iframes
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-zinc-100 flex flex-col transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={isMobileSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
        }`}
      >
        {/* Top Header Bar */}
        <TopBar
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          _isSidebarCollapsed={isSidebarCollapsed}
        />

        {/* Dynamic Route Viewport */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto animate-in fade-in-50 duration-200">
          {children}
        </main>
      </div>
    </div>
  );
}
