"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { MemberData, Gender } from "@gymos/shared-types";
import {
  ArrowLeft,
  UserPlus,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  HeartPulse,
  Calendar,
  FileText,
  Loader2,
  AlertCircle,
} from "lucide-react";

export default function NewMemberPage() {
  const { selectedBranch, branches, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    branchId: "",
    firstName: "",
    lastName: "",
    preferredName: "",
    phone: "",
    email: "",
    gender: "" as Gender | "",
    dateOfBirth: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "India",
    postalCode: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    notes: "",
    joinedAt: new Date().toISOString().split("T")[0],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (selectedBranch) {
      setFormData((prev) => ({ ...prev, branchId: selectedBranch.id }));
    } else if (branches && branches.length > 0 && !formData.branchId) {
      setFormData((prev) => ({ ...prev, branchId: branches[0].id }));
    }
  }, [authLoading, isAuthenticated, selectedBranch, branches, router, formData.branchId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.branchId) {
      setError("Please select a gym branch");
      return;
    }
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("First name and Last name are required");
      return;
    }
    if (!formData.phone.trim()) {
      setError("Phone number is required");
      return;
    }

    try {
      setLoading(true);
      const payload: Record<string, unknown> = {
        branchId: formData.branchId,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
      };

      if (formData.preferredName.trim()) payload.preferredName = formData.preferredName.trim();
      if (formData.email.trim()) payload.email = formData.email.trim();
      if (formData.gender) payload.gender = formData.gender;
      if (formData.dateOfBirth) payload.dateOfBirth = formData.dateOfBirth;
      if (formData.addressLine1.trim()) payload.addressLine1 = formData.addressLine1.trim();
      if (formData.addressLine2.trim()) payload.addressLine2 = formData.addressLine2.trim();
      if (formData.city.trim()) payload.city = formData.city.trim();
      if (formData.state.trim()) payload.state = formData.state.trim();
      if (formData.country.trim()) payload.country = formData.country.trim();
      if (formData.postalCode.trim()) payload.postalCode = formData.postalCode.trim();
      if (formData.emergencyContactName.trim())
        payload.emergencyContactName = formData.emergencyContactName.trim();
      if (formData.emergencyContactPhone.trim())
        payload.emergencyContactPhone = formData.emergencyContactPhone.trim();
      if (formData.emergencyContactRelationship.trim())
        payload.emergencyContactRelationship = formData.emergencyContactRelationship.trim();
      if (formData.notes.trim()) payload.notes = formData.notes.trim();
      if (formData.joinedAt) payload.joinedAt = formData.joinedAt;

      const newMember = await apiClient<MemberData>("/members", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      router.push(`/dashboard/members/${newMember.id}`);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to register member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16 max-w-4xl mx-auto">
      {/* Top Header */}
      <div>
        <Link
          href="/dashboard/members"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Members
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-primary" />
            Register New Member
          </h1>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            Registration
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Create an enterprise member profile. A tamper-evident member number and digital badge will be generated automatically.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-500 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Branch Assignment */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Branch Assignment</h3>
              <p className="text-[11px] text-muted-foreground">Select the primary home facility for this member</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Primary Branch <span className="text-red-500">*</span>
            </label>
            <select
              name="branchId"
              value={formData.branchId}
              onChange={handleChange}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              <option value="">Select a branch...</option>
              {branches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.branchCode})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Personal Details */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Personal Information</h3>
              <p className="text-[11px] text-muted-foreground">Legal name, nickname, gender, and date of birth</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                placeholder="John"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                placeholder="Doe"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Preferred / Nickname
              </label>
              <input
                type="text"
                name="preferredName"
                value={formData.preferredName}
                onChange={handleChange}
                placeholder="Johnny"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Gender
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              >
                <option value="">Select gender...</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Date of Birth
              </label>
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Contact & Address</h3>
              <p className="text-[11px] text-muted-foreground">Mobile phone, email notifications, and residential address</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="+91 9876543210"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john.doe@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Address Line 1
              </label>
              <input
                type="text"
                name="addressLine1"
                value={formData.addressLine1}
                onChange={handleChange}
                placeholder="123 Gym Street"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Address Line 2
              </label>
              <input
                type="text"
                name="addressLine2"
                value={formData.addressLine2}
                onChange={handleChange}
                placeholder="Apt 4B"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                City
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Mumbai"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                State
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="Maharashtra"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Country
              </label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="India"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Postal Code
              </label>
              <input
                type="text"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                placeholder="400001"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
              <HeartPulse className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Emergency Contact</h3>
              <p className="text-[11px] text-muted-foreground">Designated person to reach in the event of medical or safety concerns</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Contact Name
              </label>
              <input
                type="text"
                name="emergencyContactName"
                value={formData.emergencyContactName}
                onChange={handleChange}
                placeholder="Jane Doe"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Contact Phone
              </label>
              <input
                type="tel"
                name="emergencyContactPhone"
                value={formData.emergencyContactPhone}
                onChange={handleChange}
                placeholder="+91 9876543211"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Relationship
              </label>
              <input
                type="text"
                name="emergencyContactRelationship"
                value={formData.emergencyContactRelationship}
                onChange={handleChange}
                placeholder="Spouse / Parent / Friend"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>
        </div>

        {/* Additional Notes & Joining Date */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Joining Date & Notes</h3>
              <p className="text-[11px] text-muted-foreground">Official registration date and staff notes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Joining Date
              </label>
              <input
                type="date"
                name="joinedAt"
                value={formData.joinedAt}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Internal Staff Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Health considerations, preferences, or referral source..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/dashboard/members"
            className="px-5 py-2.5 rounded-xl border border-border text-foreground hover:bg-accent/50 text-xs font-semibold transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Registering...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" /> Register Member
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
