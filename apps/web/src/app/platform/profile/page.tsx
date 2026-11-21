"use client";

import React from "react";
import { ProfileSettingsView } from "@/components/profile/ProfileSettingsView";

export default function PlatformAdminProfilePage() {
  return (
    <ProfileSettingsView
      backHref="/platform"
      panelName="Platform Super Admin"
    />
  );
}
