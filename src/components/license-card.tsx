import { Avatar } from "@/components/ui/avatar";
import { docStatus, fmtDate, type GarageDriver, type GarageVehicle } from "@/lib/garage";

const STARS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  return [Number((12 + 6.6 * Math.cos(a)).toFixed(2)), Number((12 + 6.6 * Math.sin(a)).toFixed(2))];
});

// Driver card styled after the EU driving licence (numbered fields 1, 2, 4a, 4b, 9).
export function LicenseCard({ driver, vehicle, highPriorityDays, children }: { driver: GarageDriver; vehicle?: GarageVehicle | null; highPriorityDays: number; children?: React.ReactNode }) {
  const license = driver.licenseExpiresAt ? docStatus(driver.licenseExpiresAt, highPriorityDays) : null;
  const idCard = driver.idCardExpiresAt ? docStatus(driver.idCardExpiresAt, highPriorityDays) : null;
  return (
    <div className="lic-wrap">
      <div className="eu-license">
        <div className="eu-top">
          <svg viewBox="0 0 24 24" className="eu-flag">
            <rect width="24" height="24" rx="4" fill="#1e40af" />
            {STARS.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.05" fill="#fde047" />)}
            <text x="12" y="14.2" textAnchor="middle" fontSize="6" fontWeight="800" fill="#fff">RO</text>
          </svg>
          <div>
            <div className="eu-title">PERMIS DE CONDUCERE</div>
            <div className="eu-country">ROMÂNIA</div>
          </div>
        </div>
        <div className="eu-body">
          <Avatar name={driver} imageUrl={driver.profileImageUrl} className="eu-photo" />
          <dl className="eu-fields">
            <div><dt>1.</dt><dd>{driver.lastName.toUpperCase()}</dd></div>
            <div><dt>2.</dt><dd>{driver.firstName}</dd></div>
            <div><dt>4a.</dt><dd>{fmtDate(driver.licenseIssuedAt, "DD.MM.YYYY")}</dd></div>
            <div><dt>4b.</dt><dd>{fmtDate(driver.licenseExpiresAt, "DD.MM.YYYY")}</dd></div>
            <div><dt>9.</dt><dd>{driver.licenseCategory || "—"}</dd></div>
          </dl>
        </div>
        <div className="eu-sign">{driver.firstName} {driver.lastName}</div>
      </div>
      <div className="lic-meta">
        <div className="row">
          <div className="grow">
            <span className={`pill ${driver.role === "ADMIN" ? "info" : "muted"}`}>{driver.role === "ADMIN" ? "Administrator" : "Șofer"}</span>
            <small style={{ marginTop: 6 }}>{vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}` : "Nicio mașină alocată"}</small>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {license ? <span className={`pill ${license.cls}`}>Permis: {license.cls === "ok" ? "valabil" : license.text.toLowerCase()}</span> : null}
          {idCard ? <span className={`pill ${idCard.cls}`}>CI: {idCard.cls === "ok" ? "valabilă" : idCard.text.toLowerCase()}</span> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
