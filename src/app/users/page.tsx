import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createUser, deleteUser } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { LicenseCard } from "@/components/license-card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { vehicleInclude } from "@/lib/garage";
import { loadGarage } from "@/lib/garage-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "email-exists": "Această adresă de email este deja folosită de un alt utilizator.",
  "password-mismatch": "Parolele introduse nu se potrivesc.",
  invalid: "Datele introduse sunt invalide sau parola este prea scurtă (minim 8 caractere)."
};

export default async function DriversPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { isAdmin, session, settings } = await loadGarage();
  if (!isAdmin) redirect("/");
  const { error } = await searchParams;

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
    include: { vehicles: { include: vehicleInclude } }
  });

  return (
    <AppShell active="drivers">
      {error && ERRORS[error] ? <div className="notice bad">{ERRORS[error]}</div> : null}
      <section className="card page">
        <div className="panel-head">
          <div>
            <h2>
              Șoferi
              <span className="info-tip" tabIndex={0}>
                i
                <span className="tip">Fiecare șofer este și <b>utilizator al aplicației</b>: se autentifică cu email și parolă. <b>Administratorii</b> văd și editează toate mașinile; <b>șoferii</b> văd doar mașina alocată și pot adăuga costuri, alimentări și documente pentru ea.</span>
              </span>
            </h2>
            <p>{users.length} șoferi · fiecare are cont în aplicație</p>
          </div>
          <div className="actions">
            <Modal trigger={<><Plus className="i" />Adaugă șofer</>} triggerClassName="btn btn-sm" title="Adaugă șofer" sub="Creează contul cu care șoferul se autentifică. Datele permisului le completezi apoi din Editează.">
              <form action={createUser}>
                <div className="form">
                  <label>Prenume<input className="field" name="firstName" required /></label>
                  <label>Nume<input className="field" name="lastName" required /></label>
                  <label className="full">Email<input className="field" name="email" type="email" required /></label>
                  <label>Parolă inițială<input className="field" name="password" type="password" minLength={8} required /></label>
                  <label>Confirmă parola<input className="field" name="confirmPassword" type="password" minLength={8} required /></label>
                  <label className="full">
                    Rol
                    <select className="field" name="role" defaultValue="DRIVER">
                      <option value="DRIVER">Șofer</option>
                      <option value="ADMIN">Administrator</option>
                    </select>
                  </label>
                </div>
                <ModalFooter submitLabel="Creează cont" />
              </form>
            </Modal>
          </div>
        </div>
        <div className="grid3">
          {users.map((user) => (
            <LicenseCard key={user.id} driver={user} vehicle={user.vehicles[0] ?? null} highPriorityDays={settings.highPriorityDays}>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <Link className="btn-secondary btn-sm" href={`/users/${user.id}/edit`}><Pencil className="i" />Editează</Link>
                {user.id !== session.user.id ? (
                  <ConfirmForm action={deleteUser.bind(null, user.id)} message={`Ștergi contul lui ${user.firstName} ${user.lastName}? Mașinile alocate rămân nealocate.`} className="icon-btn danger-icon" title={`Șterge contul lui ${user.firstName}`}>
                    <Trash2 className="i" />
                  </ConfirmForm>
                ) : null}
              </div>
            </LicenseCard>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
