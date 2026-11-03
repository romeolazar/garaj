import { AppShell } from "@/components/app-shell";
import { LicenseCard } from "@/components/license-card";
import { ProfilePhotoUpload } from "@/components/profile-photo-upload";
import { Avatar } from "@/components/ui/avatar";
import { loadGarage } from "@/lib/garage-data";

export const dynamic = "force-dynamic";

// Every user (drivers too) can set their own photo here; it is the same photo as on their driver card.
export default async function ProfilePage() {
  const { user, vehicles, settings } = await loadGarage();
  const car = vehicles.find((v) => v.driverId === user.id) ?? null;

  return (
    <AppShell>
      <section className="card page">
        <div className="profile-head">
          <Avatar name={user} imageUrl={user.profileImageUrl} />
          <div>
            <h2 style={{ margin: 0 }}>{user.firstName} {user.lastName}</h2>
            <p style={{ margin: "4px 0 12px", color: "var(--muted)" }}>{user.email} · {user.role === "ADMIN" ? "Administrator" : "Șofer"}</p>
            <ProfilePhotoUpload userId={user.id} hasPhoto={!!user.profileImageUrl} />
          </div>
        </div>
        <div className="grid3">
          <LicenseCard driver={user} vehicle={car} highPriorityDays={settings.highPriorityDays} />
        </div>
        <p className="ios-caption">Poza este aceeași pe cardul de permis, în banner și în colțul aplicației. Datele permisului le poate modifica un administrator, din Șoferi.</p>
      </section>
    </AppShell>
  );
}
