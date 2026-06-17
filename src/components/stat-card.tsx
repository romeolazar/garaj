import type { LucideIcon } from "lucide-react";

export function StatCard({
  title,
  value,
  icon: Icon,
  tone = "default"
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "primary" | "warning" | "success";
}) {
  const tones = {
    default: "border-border bg-card text-foreground",
    primary: "border-primary bg-primary text-primary-foreground",
    warning: "border-amber-500/30 bg-card text-amber-300",
    success: "border-emerald-500/30 bg-card text-emerald-300"
  };

  return (
    <div className={`panel relative overflow-hidden p-5 ${tones[tone]}`}>
      <div className="text-xs font-bold uppercase tracking-widest opacity-70">{title}</div>
      <div className="mt-7 text-4xl font-black">{value}</div>
      <Icon className="absolute bottom-4 right-4 size-14 opacity-15" />
    </div>
  );
}
