import {
  BriefcaseMedical,
  ClipboardCheck,
  Droplets,
  Fuel,
  Gavel,
  Hammer,
  Landmark,
  LifeBuoy,
  Repeat,
  ShieldCheck,
  Sparkles,
  SquareParking,
  Tag,
  Ticket,
  Wrench,
  Zap,
  type LucideIcon
} from "lucide-react";
import { categoryFor } from "@/lib/garage";
import type { CostCategory } from "@/lib/cost-categories";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  shield: ShieldCheck,
  wrench: Wrench,
  hammer: Hammer,
  clipboard: ClipboardCheck,
  ticket: Ticket,
  landmark: Landmark,
  fuel: Fuel,
  zap: Zap,
  tire: LifeBuoy,
  sparkles: Sparkles,
  droplets: Droplets,
  parking: SquareParking,
  repeat: Repeat,
  kit: BriefcaseMedical,
  gavel: Gavel,
  tag: Tag
};

export function CategoryIcon({ name, className = "i" }: { name: string; className?: string }) {
  const Icon = CATEGORY_ICON[name] ?? Tag;
  return <Icon className={className} />;
}

export function CatBadge({ categoryKey, categories }: { categoryKey: string; categories: CostCategory[] }) {
  const category = categoryFor(categoryKey, categories);
  return (
    <span className="cat-ic" style={{ "--c": category.color } as React.CSSProperties} title={category.name}>
      <CategoryIcon name={category.icon} />
    </span>
  );
}
