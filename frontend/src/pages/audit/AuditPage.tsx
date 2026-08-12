import { useQuery } from '@tanstack/react-query';
import { Activity, ShieldCheck } from 'lucide-react';
import { api } from '../../api/resources.api';

export function AuditPage() {
  const { data: logs } = useQuery({ queryKey: ['audit-logs'], queryFn: api.audit.list });

  return (
    <div className="space-y-6">
      <section className="dashboard-gallery-hero selection-hero selection-hero-audit">
        <div className="dashboard-gallery-hero-content">
          <p className="eyebrow text-white/80">Easy BI Workspace</p>
          <h3>Auditoria</h3>
          <p>Registro de acoes criticas como login, criacao de dashboard, uploads, publicacoes e alteracoes administrativas.</p>
        </div>
        <div className="selection-hero-actions">
          <span className="selection-hero-pill"><Activity size={15} /> {logs?.length || 0} eventos</span>
          <span className="selection-hero-pill"><ShieldCheck size={15} /> Rotas protegidas</span>
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-3">
        <div className="card-premium p-5"><Activity className="text-orange-500" /><p className="mt-3 text-3xl font-black">{logs?.length || 0}</p><p className="text-sm text-zinc-500">eventos recentes</p></div>
        <div className="card-premium p-5"><ShieldCheck className="text-orange-500" /><p className="mt-3 text-3xl font-black">Tenant</p><p className="text-sm text-zinc-500">logs filtrados pela organização</p></div>
        <div className="card-premium p-5"><ShieldCheck className="text-orange-500" /><p className="mt-3 text-3xl font-black">JWT</p><p className="text-sm text-zinc-500">rotas protegidas por token</p></div>
      </div>

      <section className="card-premium overflow-hidden">
        <div className="border-b border-zinc-100 p-5"><p className="text-lg font-black">Linha do tempo</p></div>
        <div className="divide-y divide-zinc-100">
          {(logs || []).map((log: any) => (
            <div key={log.id} className="grid gap-2 p-5 md:grid-cols-[180px_1fr_220px]">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{new Date(log.createdAt).toLocaleString()}</p>
              <div><p className="font-black text-zinc-900">{log.action}</p><p className="text-sm text-zinc-500">{log.entity} {log.entityId ? `· ${log.entityId}` : ''}</p></div>
              <p className="text-sm text-zinc-500">{log.user?.name || 'Sistema'}</p>
            </div>
          ))}
          {(!logs || logs.length === 0) && <p className="p-8 text-center text-sm text-zinc-500">Nenhum log encontrado ainda.</p>}
        </div>
      </section>
    </div>
  );
}
