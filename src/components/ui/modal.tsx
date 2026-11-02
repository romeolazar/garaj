"use client";

import { useRef } from "react";

export function Modal({
  trigger,
  triggerClassName = "btn-secondary btn-sm",
  triggerTitle,
  title,
  sub,
  size = "narrow",
  children
}: {
  trigger: React.ReactNode;
  triggerClassName?: string;
  triggerTitle?: string;
  title: string;
  sub?: string;
  size?: "narrow" | "wide";
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={triggerClassName} title={triggerTitle} onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        className={`modal-dialog ${size}`}
        onClick={(event) => {
          if (event.target === ref.current) ref.current?.close();
        }}
        // Server actions redirect back to the same page; close so the dialog does not stay open over the result.
        onSubmit={() => setTimeout(() => ref.current?.close(), 0)}
      >
        <div className="card modal">
          <h2>{title}</h2>
          {sub ? <p className="sub">{sub}</p> : <div style={{ height: 14 }} />}
          {children}
        </div>
      </dialog>
    </>
  );
}

export function ModalFooter({ submitLabel = "Salvează", children }: { submitLabel?: string; children?: React.ReactNode }) {
  return (
    <div className="foot">
      {children}
      <button
        type="button"
        className="btn-secondary"
        onClick={(event) => (event.currentTarget.closest("dialog") as HTMLDialogElement | null)?.close()}
      >
        Anulează
      </button>
      <button type="submit" className="btn">{submitLabel}</button>
    </div>
  );
}
