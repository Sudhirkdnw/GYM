"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  ArrowLeft,
  KeyRound,
  Laptop,
  Smartphone,
  Globe,
  Trash2,
  RefreshCw,
  X,
  Camera,
  Calendar,
  Sparkles,
} from "lucide-react";

interface SessionItem {
  id: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  expiresAt: string;
}

interface ProfileSettingsViewProps {
  backHref: string;
  panelName: string;
}

export function ProfileSettingsView({
  backHref,
  panelName,
}: ProfileSettingsViewProps) {
  const { user, organization, refreshSession } = useAuth();

  // Tabs
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "sessions">("profile");

  // Profile Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Sessions State
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  // Action States
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Feedback Notification
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Populate user data when loaded
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setAvatarUrl(user.avatarUrl || "");
    }
  }, [user]);

  // Load Sessions when Sessions tab is active
  const loadSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const res = await apiClient<SessionItem[]>("/auth/sessions");
      setSessions(res || []);
    } catch {
      // Non-blocking error
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (activeTab === "sessions") {
      loadSessions();
    }
  }, [activeTab]);

  // Handle Profile Update
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFirstName = (firstName || "").trim();
    const cleanLastName = (lastName || "").trim();
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPhone = (phone || "").trim();
    const cleanAvatarUrl = (avatarUrl || "").trim();

    if (!cleanFirstName || !cleanLastName || !cleanEmail) {
      setNotification({
        type: "error",
        message: "First name, last name, and email are required fields.",
      });
      return;
    }

    try {
      setIsSavingProfile(true);
      setNotification(null);

      await apiClient("/auth/me/profile", {
        method: "PUT",
        body: JSON.stringify({
          firstName: cleanFirstName,
          lastName: cleanLastName,
          email: cleanEmail,
          phone: cleanPhone ? cleanPhone : null,
          avatarUrl: cleanAvatarUrl ? cleanAvatarUrl : null,
        }),
      });

      setNotification({
        type: "success",
        message: "Your profile details have been successfully updated!",
      });

      // Refresh global authentication context to update topbar/avatars
      await refreshSession();
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update profile",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Password Change
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCurrent = (currentPassword || "").trim();
    const cleanNew = (newPassword || "").trim();
    const cleanConfirm = (confirmPassword || "").trim();

    if (!cleanCurrent) {
      setNotification({
        type: "error",
        message: "Please enter your current password for verification.",
      });
      return;
    }

    if (cleanNew.length < 8) {
      setNotification({
        type: "error",
        message: "New password must be at least 8 characters long.",
      });
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setNotification({
        type: "error",
        message: "New password and confirmation password do not match.",
      });
      return;
    }

    try {
      setIsChangingPassword(true);
      setNotification(null);

      await apiClient<{ success: boolean; message: string }>("/auth/me/password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: cleanCurrent,
          newPassword: cleanNew,
        }),
      });

      setNotification({
        type: "success",
        message: "Password changed successfully! Please use your new password for future logins.",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to change password",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle Revoke Session
  const handleRevokeSession = async (sessionId: string) => {
    try {
      setRevokingSessionId(sessionId);
      await apiClient(`/auth/sessions/${sessionId}`, {
        method: "DELETE",
      });

      setNotification({
        type: "success",
        message: "Session revoked successfully.",
      });

      await loadSessions();
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to revoke session",
      });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const initials = `${(firstName || "")[0] || ""}${(lastName || "")[0] || ""}`.toUpperCase() || "U";

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/[0.08] pb-6">
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to {panelName}</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-glow shadow-blue-500/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                My Profile & Account Settings
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Manage your personal information, contact email, and security credentials.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] text-slate-700 dark:text-zinc-300 shadow-sm flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-500" />
            <span>{user?.isSuperAdmin ? "Super Admin" : organization?.role || "Member"}</span>
          </span>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-slide-down ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Profile Overview Hero Card */}
      <div className="rounded-3xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-6 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500/10 via-violet-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative z-10">
          {/* Avatar */}
          <div className="relative group">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-lg shadow-violet-500/20 overflow-hidden border-2 border-white dark:border-[#12131a]">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${firstName} ${lastName}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to initials if broken image
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
          </div>

          {/* User Meta */}
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {firstName || "User"} {lastName || ""}
              </h2>
              {user?.isSuperAdmin ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                  Platform Super Admin
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {organization?.role || "Gym Member"}
                </span>
              )}
              {user?.emailVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  Verified
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{email}</span>
            </p>

            {user?.createdAt && (
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Account registered on {new Date(user.createdAt).toLocaleDateString()}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/[0.08] pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
            activeTab === "profile"
              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 shadow-sm"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.03]"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Personal Details</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
            activeTab === "security"
              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 shadow-sm"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.03]"
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Password & Security</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sessions")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
            activeTab === "sessions"
              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 shadow-sm"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.03]"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Active Sessions</span>
        </button>
      </div>

      {/* Tab 1: Personal Details */}
      {activeTab === "profile" && (
        <form onSubmit={handleProfileSubmit} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Personal Identification
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Update your legal display name, contact phone, and avatar.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Sudhir"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50/50 dark:bg-[#1a1b26] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Last Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Kumar"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50/50 dark:bg-[#1a1b26] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50/50 dark:bg-[#1a1b26] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                  Used for account login, password resets, and critical system notifications.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50/50 dark:bg-[#1a1b26] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Avatar Image URL
                </label>
                <div className="relative">
                  <Camera className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50/50 dark:bg-[#1a1b26] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-ellipsis"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-end">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingProfile ? "Saving Profile..." : "Save Profile Changes"}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab 2: Password & Security */}
      {activeTab === "security" && (
        <form onSubmit={handlePasswordSubmit} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-500" />
                Change Password
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Ensure your account is using a long, random password to stay secure.
              </p>
            </div>

            <div className="space-y-4 max-w-lg">
              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50/50 dark:bg-[#1a1b26] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50/50 dark:bg-[#1a1b26] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type your new password"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50/50 dark:bg-[#1a1b26] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                />
              </div>

              {/* Security Hint */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-500 dark:text-zinc-400 space-y-1">
                <p className="font-semibold text-slate-700 dark:text-zinc-300">
                  Password Requirements:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li>At least 8 characters long</li>
                  <li>Include upper and lowercase letters</li>
                  <li>Include at least one number and special symbol</li>
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-end">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                <Lock className="w-4 h-4" />
                <span>{isChangingPassword ? "Updating Password..." : "Update Password"}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab 3: Active Sessions */}
      {activeTab === "sessions" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Active Logged-In Sessions
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Devices and locations currently signed in with active refresh tokens.
                </p>
              </div>
              <button
                type="button"
                onClick={loadSessions}
                disabled={isLoadingSessions}
                className="p-2 rounded-xl border border-slate-200 dark:border-white/[0.1] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-600 dark:text-zinc-400 transition-colors"
                title="Refresh sessions"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingSessions ? "animate-spin text-blue-500" : ""}`} />
              </button>
            </div>

            {isLoadingSessions ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                <span>Loading active sessions...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 dark:text-zinc-500">
                <Laptop className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-slate-600 dark:text-zinc-400">
                  Current Session Only
                </p>
                <p className="text-[11px] mt-0.5">
                  You are securely signed in from your current browser session.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {sessions.map((sess, idx) => {
                  const isMobile = sess.userAgent?.toLowerCase().includes("mobile") ||
                    sess.userAgent?.toLowerCase().includes("android") ||
                    sess.userAgent?.toLowerCase().includes("iphone");

                  return (
                    <div
                      key={sess.id}
                      className="py-4 flex items-center justify-between gap-4 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-zinc-300">
                          {isMobile ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              {sess.userAgent?.split(" ")[0] || "Web Browser"}
                            </p>
                            {idx === 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                                Current Device
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                            IP: {sess.ipAddress || "127.0.0.1"} &bull; Signed in{" "}
                            {new Date(sess.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {idx !== 0 && (
                        <button
                          type="button"
                          onClick={() => handleRevokeSession(sess.id)}
                          disabled={revokingSessionId === sess.id}
                          className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 hover:bg-rose-100 text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                          <span>{revokingSessionId === sess.id ? "Revoking..." : "Revoke"}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
