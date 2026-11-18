"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { UserRole, Permission, UserStatus } from "@gymos/shared-types";
import { LoginInput, RegisterUserInput } from "@gymos/validation";

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  emailVerified: boolean;
  status: UserStatus;
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
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterUserInput) => Promise<void>;
  logout: () => Promise<void>;
  selectOrganization: (organizationId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [organization, setOrganization] =
    useState<OrganizationContextData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

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
      } else {
        setUser(null);
        setOrganization(null);
      }
    } catch {
      setUser(null);
      setOrganization(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
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

    // If user has organization, navigate to dashboard, else organization selection
    if (res.organization) {
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

    if (res.organization) {
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
      setUser(null);
      setOrganization(null);
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
    router.push("/dashboard");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        selectOrganization,
        refreshSession,
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
