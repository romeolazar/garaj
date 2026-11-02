"use client";

export function ConfirmForm({
  action,
  message,
  className = "icon-sm",
  title,
  children
}: {
  action: () => Promise<void>;
  message: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <button type="submit" className={className} title={title}>
        {children}
      </button>
    </form>
  );
}
