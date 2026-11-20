"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { MemberDetailData, Gender } from "@gymos/shared-types";
import {
  ArrowLeft,
  Edit,
  User,
  Phone,
  Mail,
  MapPin,
  HeartPulse,
  FileText,
  Loader2,
  AlertCircle,
  Save,
} from "lucide-react";

export default function EditMemberPage() {
  const params = useParams();
  const memberId = params.memberId as string;
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
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
  });

  const [memberNumber, setMemberNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    async function loadMember() {
      try {
        setLoading(true);
        setError(null);
        const m = await apiClient<MemberDetailData>(`/members/${memberId}`);
        setMemberNumber(m.memberNumber);
        setFormData({
          firstName: m.firstName || "",
          lastName: m.lastName || "",
          preferredName: m.preferredName || "",
          phone: m.phone || "",
          email: m.email || "",
          gender: (m.gender as Gender) || "",
          dateOfBirth: m.dateOfBirth ? m.dateOfBirth.split("T")[0] : "",
          addressLine1: m.addressLine1 || "",
          addressLine2: m.addressLine2 || "",
          city: m.city || "",
          state: m.state || "",
          country: m.country || "India",
          postalCode: m.postalCode || "",
          emergencyContactName: m.emergencyContactName || "",
          emergencyContactPhone: m.emergencyContactPhone || "",
          emergencyContactRelationship: m.emergencyContactRelationship || "",
          notes: m.notes || "",
        });
      } catch (err: unknown) {
        setError((err as Error).message || "Failed to load member");
      } finally {
        setLoading(false);
      }
    }

    if (memberId) {
      loadMember();
    }
  }, [authLoading, isAuthenticated, memberId, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("First name and Last name are required");
      return;
    }
    if (!formData.phone.trim()) {
      setError("Phone number is required");
      return;
    }

    try {
      setSubmitting(true);
      const payload: Record<string, unknown> = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
        preferredName: formData.preferredName.trim() || null,
        email: formData.email.trim() || null,
        gender: formData.gender || null,
        dateOfBirth: formData.dateOfBirth || null,
        addressLine1: formData.addressLine1.trim() || null,
        addressLine2: formData.addressLine2.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        country: formData.country.trim() || null,
        postalCode: formData.postalCode.trim() || null,
        emergencyContactName: formData.emergencyContactName.trim() || null,
        emergencyContactPhone: formData.emergencyContactPhone.trim() || null,
        emergencyContactRelationship: formData.emergencyContactRelationship.trim() || null,
        notes: formData.notes.trim() || null,
      };

      await apiClient(`/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      router.push(`/dashboard/members/${memberId}`);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to update member");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm font-semibold text-foreground">Loading member details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-16 max-w-4xl mx-auto">
      {/* Top Header */}
      <div>
        <Link
          href={`/dashboard/members/${memberId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Profile
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Edit className="h-6 w-6 text-primary" />
            Edit Member Profile
          </h1>
          <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 font-bold text-primary">
            {memberNumber}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Update personal data, contact coordinates, or emergency details.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-500 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Details */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Personal Information</h3>
              <p className="text-[11px] text-muted-foreground">Legal identity, name preference, gender, and birthday</p>
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
              <p className="text-[11px] text-muted-foreground">Mobile phone, email notifications, and address</p>
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
              <p className="text-[11px] text-muted-foreground">Designated emergency contact</p>
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Internal Notes</h3>
              <p className="text-[11px] text-muted-foreground">Staff observations, health conditions, or personal notes</p>
            </div>
          </div>

          <div>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={`/dashboard/members/${memberId}`}
            className="px-5 py-2.5 rounded-xl border border-border text-foreground hover:bg-accent/50 text-xs font-semibold transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
