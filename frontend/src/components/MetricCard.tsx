import { LucideIcon } from 'lucide-react';
export function MetricCard({ title, value, detail, icon: Icon }: { title: string; value: string; detail: string; icon: LucideIcon }) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-500">{title}</p>
          <p className="mt-3 text-3xl font-black text-zinc-950">{value}</p>
          <p className="mt-2 text-xs font-medium text-orange-600">{detail}</p>
        </div>
        <div className="rounded-2xl bg-orange-50 p-3 text-orange-600"><Icon size={22} /></div>
      </div>
    </div>
  );
}
