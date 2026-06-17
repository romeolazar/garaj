"use client";

import { Trash2 } from "lucide-react";

export function DeleteVehicleButton({
  action,
  plateNumber,
  iconOnly = false
}: {
  action: () => Promise<void>;
  plateNumber: string;
  iconOnly?: boolean;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Stergi vehiculul ${plateNumber}? Actiunea nu poate fi anulata.`)) {
          event.preventDefault();
        }
      }}
    >
      <button
        className={iconOnly ? "flex size-10 items-center justify-center rounded-md border border-rose-400/40 bg-black/45 text-rose-200 backdrop-blur hover:border-rose-300" : "btn-secondary border-rose-500/40 text-rose-300 hover:border-rose-400"}
        type="submit"
        title="Sterge vehicul"
      >
        {iconOnly ? <Trash2 className="size-4" /> : "Sterge vehicul"}
      </button>
    </form>
  );
}
