"use client";

import React from "react";
import { ProfileSettingsView } from "@/components/profile/ProfileSettingsView";

export default function DashboardProfilePage() {
  return (
    <ProfileSettingsView
      backHref="/dashboard"
      panelName="Gym Dashboard"
    />
  );
}
