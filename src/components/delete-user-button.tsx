"use client";

import { Trash2 } from "lucide-react";

export function DeleteUserButton({
  action,
  label,
  iconOnly = false
}: {
  action: () => Promise<void>;
  label: string;
  iconOnly?: boolean;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Stergi șoferul ${label}? Vehiculele alocate vor ramane nealocate.`)) {
          event.preventDefault();
        }
      }}
    >
      <button
        className={iconOnly ? "flex size-9 items-center justify-center rounded-md border border-rose-500/40 bg-card/90 text-rose-300 shadow-lg backdrop-blur hover:border-rose-400" : "btn-secondary h-9 border-rose-500/40 px-3 text-rose-300"}
        type="submit"
        title="Sterge"
      >
        {iconOnly ? <Trash2 className="size-4" /> : "Sterge"}
      </button>
    </form>
  );
}
