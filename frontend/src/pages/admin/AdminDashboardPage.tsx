import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, Building2, Database, Layers3, LayoutDashboard, Users } from 'lucide-react';
import { api } from '../../api/resources.api';
import { useAuthStore } from '../../store/auth.store';

function formatNumber(value: any) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function formatMoney(value: any) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function planPrice(plan: any) {
  if (plan?.monthlyPrice === null || plan?.monthlyPrice === undefined) return plan?.priceLabel || 'Sob consulta';
  return `${formatMoney(plan.monthlyPrice)}/mes`;
}

function formatDate(value: any) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function SaasMetricCard({ title, value, detail, icon: Icon, money = false }: { title: string; value: any; detail: string; icon: any; money?: boolean }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{money ? formatMoney(value) : formatNumber(value)}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
        </div>
        <div className="rounded-2xl bg-primary-soft p-3 text-primary"><Icon size={20} /></div>
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const user = useAuthStore(s => s.user);
  const { data: summary, isLoading } = useQuery({
    queryKey: ['organizations-summary'],
    queryFn: api.organizations.summary,
    enabled: Boolean(user?.isSuperAdmin)
  });
  const usage = summary?.organizationUsage || [];
  const monthlyRevenue = usage
    .filter((org: any) => org.status === 'ACTIVE' && !org.deletedAt)
    .reduce((sum: number, org: any) => sum + Number(org.plan?.monthlyPrice || 0), 0);

  if (!user?.isSuperAdmin) {
    return (
      <div className="card-premium p-8 text-center">
        <h2 className="text-2xl font-black text-slate-950">Sem acesso ao dashboard admin</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Este modulo e exclusivo para o Admin SaaS global.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="dashboard-gallery-hero selection-hero selection-hero-admin">
        <div className="dashboard-gallery-hero-content">
          <p className="eyebrow text-white/80">Easy BI Workspace</p>
          <h3>Dashboard Admin</h3>
          <p>Acompanhe uso, clientes, usuarios e operacao geral do Easy BI sem abrir dados internos das organizacoes.</p>
        </div>
        <div className="selection-hero-actions">
          <span className="selection-hero-pill"><Building2 size={15} /> {formatNumber(summary?.organizations?.total)} orgs</span>
          <span className="selection-hero-pill"><Users size={15} /> {formatNumber(summary?.users?.total)} usuarios</span>
        </div>
      </section>

      {isLoading && <div className="card-premium p-6 text-sm font-bold text-slate-500">Carregando indicadores do negocio...</div>}

      {summary && (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SaasMetricCard title="Organizacoes" value={summary.organizations.total} detail={`${formatNumber(summary.organizations.active)} ativas - ${formatNumber(summary.organizations.inactive)} inativas`} icon={Building2} />
            <SaasMetricCard title="Usuarios" value={summary.users.total} detail={`${formatNumber(summary.users.active)} ativos - ${formatNumber(summary.users.activeLast30Days)} logaram em 30 dias`} icon={Users} />
            <SaasMetricCard title="Dashboards" value={summary.dashboards.total} detail={`${formatNumber(summary.dashboards.published)} publicados - ${formatNumber(summary.dashboards.widgets)} widgets`} icon={LayoutDashboard} />
            <SaasMetricCard title="Bases de dados" value={summary.datasets.total} detail={`${formatNumber(summary.datasets.rows)} linhas importadas - ${formatNumber(summary.datasets.ready)} prontas`} icon={Database} />
            <SaasMetricCard title="Vinculos ativos" value={summary.users.activeMemberships} detail="usuarios vinculados a organizacoes" icon={Activity} />
            <SaasMetricCard title="Modelos" value={summary.templates.total} detail="modelos reutilizaveis criados" icon={Layers3} />
            <SaasMetricCard title="Auditoria 30d" value={summary.activity.auditLast30Days} detail="eventos recentes no sistema" icon={BarChart3} />
            <SaasMetricCard title="Receita mensal" value={monthlyRevenue} detail="MRR estimado pelos planos ativos" icon={BarChart3} money />
            <SaasMetricCard title="Falhas nas bases" value={summary.datasets.failed} detail="cargas com erro para acompanhar" icon={Database} />
          </section>

          <section className="card-premium overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <p className="text-lg font-black text-slate-950">Uso por organizacao</p>
                <p className="text-sm font-semibold text-slate-500">Ranking operacional: usuarios, bases de dados, dashboards, linhas e ultima atividade.</p>
              </div>
              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-black text-primary">{formatNumber(usage.length)} orgs</span>
            </div>
            <div className="overflow-auto">
              <table className="min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Organizacao</th>
                    <th className="px-5 py-3">Plano</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Usuarios</th>
                    <th className="px-5 py-3">Bases</th>
                    <th className="px-5 py-3">Dashboards</th>
                    <th className="px-5 py-3">Linhas</th>
                    <th className="px-5 py-3">Eventos</th>
                    <th className="px-5 py-3">Ultima atividade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usage.map((org: any) => (
                    <tr key={org.id} className="hover:bg-primary-soft">
                      <td className="px-5 py-4"><p className="font-black text-slate-900">{org.name}</p><p className="text-xs font-semibold text-slate-400">/{org.slug}</p></td>
                      <td className="px-5 py-4"><span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-black text-primary">{org.plan?.name || 'Sem plano'}</span><p className="mt-1 text-xs font-bold text-slate-500">{planPrice(org.plan)}</p></td>
                      <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${org.status === 'ACTIVE' && !org.deletedAt ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{org.deletedAt ? 'INACTIVE' : org.status}</span></td>
                      <td className="px-5 py-4 font-bold text-slate-700">{formatNumber(org.users)}</td>
                      <td className="px-5 py-4 font-bold text-slate-700">{formatNumber(org.datasets)}</td>
                      <td className="px-5 py-4 font-bold text-slate-700">{formatNumber(org.dashboards)}</td>
                      <td className="px-5 py-4 font-bold text-slate-700">{formatNumber(org.rows)}</td>
                      <td className="px-5 py-4 font-bold text-slate-700">{formatNumber(org.auditEvents)}</td>
                      <td className="px-5 py-4 text-xs font-bold text-slate-500">{formatDate(org.lastActivityAt)}</td>
                    </tr>
                  ))}
                  {!usage.length && <tr><td colSpan={9} className="px-5 py-8 text-center text-slate-500">Nenhuma organizacao cadastrada.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
