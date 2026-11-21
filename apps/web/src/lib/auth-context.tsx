"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { UserRole, Permission, UserStatus, BranchData } from "@gymos/shared-types";
import { LoginInput, RegisterUserInput } from "@gymos/validation";

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  isSuperAdmin: boolean;
  emailVerified: boolean;
  status: UserStatus;
  createdAt?: string;
  lastLoginAt?: string | null;
}

export interface OrganizationContextData {
  id: string;
  name: string;
  slug: string;
  role: UserRole;
  permissions: Permission[];
}

interface AuthContextType {
  user: UserProfile | null;
  organization: OrganizationContextData | null;
  branches: BranchData[];
  selectedBranch: BranchData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterUserInput) => Promise<void>;
  logout: () => Promise<void>;
  selectOrganization: (organizationId: string) => Promise<void>;
  selectBranch: (branchId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshBranches: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [organization, setOrganization] =
    useState<OrganizationContextData | null>(null);
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<BranchData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshBranches = async () => {
    try {
      const branchList = await apiClient<BranchData[]>("/auth/organizations/current/branches");
      setBranches(branchList || []);

      const savedBranchId = typeof window !== "undefined" ? localStorage.getItem("gymos_selected_branch_id") : null;
      let active = branchList.find((b) => b.id === savedBranchId);
      if (!active && branchList.length > 0) {
        active = branchList[0];
      }

      if (active) {
        setSelectedBranch(active);
        if (typeof window !== "undefined") {
          localStorage.setItem("gymos_selected_branch_id", active.id);
        }
      } else {
        setSelectedBranch(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("gymos_selected_branch_id");
        }
      }
    } catch {
      setBranches([]);
      setSelectedBranch(null);
    }
  };

  const refreshSession = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient<{
        user: UserProfile;
        organization?: OrganizationContextData;
      }>("/auth/me");

      if (res && res.user) {
        setUser(res.user);
        setOrganization(res.organization || null);
        if (res.organization) {
          await refreshBranches();
        }
      } else {
        setUser(null);
        setOrganization(null);
        setBranches([]);
        setSelectedBranch(null);
      }
    } catch {
      setUser(null);
      setOrganization(null);
      setBranches([]);
      setSelectedBranch(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (data: LoginInput) => {
    const res = await apiClient<{
      user: UserProfile;
      organization?: OrganizationContextData;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });

    setUser(res.user);
    setOrganization(res.organization || null);

    if (res.user?.isSuperAdmin) {
      router.push("/platform");
    } else if (res.organization) {
      await refreshBranches();
      router.push("/dashboard");
    } else {
      router.push("/select-organization");
    }
  };

  const register = async (data: RegisterUserInput) => {
    const res = await apiClient<{
      user: UserProfile;
      organization?: OrganizationContextData;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });

    setUser(res.user);
    setOrganization(res.organization || null);

    if (res.user?.isSuperAdmin) {
      router.push("/platform");
    } else if (res.organization) {
      await refreshBranches();
      router.push("/dashboard");
    } else {
      router.push("/select-organization");
    }
  };

  const logout = async () => {
    try {
      await apiClient("/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("gymos_selected_branch_id");
      }
      setUser(null);
      setOrganization(null);
      setBranches([]);
      setSelectedBranch(null);
      router.push("/login");
    }
  };

  const selectOrganization = async (organizationId: string) => {
    const res = await apiClient<{
      user: UserProfile;
      organization: OrganizationContextData;
    }>(`/auth/organizations/${organizationId}/select`, {
      method: "POST",
    });

    setUser(res.user);
    setOrganization(res.organization);
    await refreshBranches();
    router.push("/dashboard");
  };

  const selectBranch = async (branchId: string) => {
    const res = await apiClient<{ selectedBranch: BranchData }>(
      "/auth/organizations/current/branches/select",
      {
        method: "POST",
        body: JSON.stringify({ branchId }),
      },
    );

    if (res && res.selectedBranch) {
      setSelectedBranch(res.selectedBranch);
      if (typeof window !== "undefined") {
        localStorage.setItem("gymos_selected_branch_id", res.selectedBranch.id);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        branches,
        selectedBranch,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        selectOrganization,
        selectBranch,
        refreshSession,
        refreshBranches,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
