"use client";

import { useRef, useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";

export type CarDataCounts = { documents: number; costs: number; services: number; tires: number; plans: number; files: number };

// Deleting a car wipes everything attached to it, so the dialog spells that out and asks for the plate number.
export function DeleteCarDialog({
  action,
  car,
  counts,
  iconOnly = false
}: {
  action: () => Promise<void>;
  car: { make: string; model: string; plateNumber: string };
  counts: CarDataCounts;
  iconOnly?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const confirmed = normalize(typed) === normalize(car.plateNumber);
  const items: Array<[number, string, string]> = [
    [counts.documents, "document", "documente (ITP, RCA, CASCO…) și mementourile lor"],
    [counts.costs, "cost", "costuri, alimentări și încărcări"],
    [counts.services, "revizie", "revizii"],
    [counts.tires, "set de anvelope", "seturi de anvelope"],
    [counts.plans, "plan de rate", "planuri de rate cu toate ratele"],
    [counts.files, "fișier", "fișiere încărcate (poze, facturi)"]
  ];

  return (
    <>
      <button
        type="button"
        className={iconOnly ? "icon-btn danger-icon" : "btn-secondary btn-sm btn-danger"}
        title="Șterge mașina"
        aria-label="Șterge mașina"
        onClick={() => { setTyped(""); dialog.current?.showModal(); }}
      >
        <Trash2 className="i" />{iconOnly ? null : "Șterge mașina"}
      </button>
      <dialog ref={dialog} className="modal-dialog narrow" onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <div className="card modal danger-modal">
          <div className="danger-head"><TriangleAlert className="i" /></div>
          <h2>Ștergi {car.make} {car.model}?</h2>
          <p className="sub">{car.plateNumber}</p>
          <div className="danger-box">
            <b>Se șterg definitiv toate datele mașinii:</b>
            <ul>
              {items.map(([count, one, many]) => (
                <li key={many} className={count ? "" : "zero"}>{count === 1 ? `1 ${one}` : `${count} ${many}`}</li>
              ))}
              <li>istoricul de kilometraj, statisticile și rapoartele ei</li>
            </ul>
            <b>Acțiunea nu poate fi anulată.</b> Dacă ai nevoie de date mai târziu, descarcă întâi un backup din Setări → Backup & export.
          </div>
          <form action={action} onSubmit={(e) => { if (!confirmed) e.preventDefault(); }}>
            <label className="danger-confirm">
              <span>Scrie <code>{car.plateNumber}</code> ca să confirmi</span>
              <input className="field" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
            </label>
            <div className="foot">
              <button type="button" className="btn-secondary" onClick={() => dialog.current?.close()}>Anulează</button>
              <button type="submit" className="btn btn-danger-solid" disabled={!confirmed}><Trash2 className="i" />Șterge definitiv</button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
