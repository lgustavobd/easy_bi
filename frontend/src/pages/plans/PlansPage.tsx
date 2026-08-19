import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, CreditCard, Send, Sparkles } from 'lucide-react';
import { api } from '../../api/resources.api';
import { useAuthStore } from '../../store/auth.store';
import { useConfirm } from '../../components/ConfirmDialog';

function money(plan: any) {
  if (plan?.priceLabel && Number(plan?.monthlyPrice || 0) === 0) return plan.priceLabel;
  if (plan?.monthlyPrice === null || plan?.monthlyPrice === undefined) return plan?.priceLabel || 'Sob consulta';
  return Number(plan.monthlyPrice).toLocaleString('pt-BR', { style: 'currency', currency: plan.currency || 'BRL' });
}

function priceCaption(plan: any) {
  if (plan?.requiresDedicatedInfra) return 'com Admin Master';
  if (plan?.trialDays) return `${plan.trialDays} dias de teste`;
  return 'por mes';
}

function limit(value: any, label: string) {
  return value === null || value === undefined ? `${label} ilimitados` : `${Number(value).toLocaleString('pt-BR')} ${label}`;
}

function canRequestPlan(user: any, organization: any) {
  const role = String(organization?.role || '').toUpperCase();
  return Boolean(organization?.id && (user?.isSuperAdmin || role === 'ORG_ADMIN'));
}

function canViewPlans(user: any, organization: any) {
  const role = String(organization?.role || '').toUpperCase();
  return Boolean(user?.isSuperAdmin || role === 'ORG_ADMIN');
}

function featureList(plan: any) {
  const features = plan?.features || {};
  return [
    features.canExportCharts && 'Exportacao de graficos e dashboards',
    features.canUseCalculatedMetrics && 'Metricas calculadas',
    features.canUseAppendRows && 'Inclusao de novas linhas',
    features.canUsePatchRows && 'Atualizacao por linhas especificas',
    features.canUseCustomLogo && 'Logo personalizado',
    features.canCreateSectors && 'Setores adicionais',
    features.canUseDatabaseConnections && 'Conexao com bancos de dados',
    plan?.requiresDedicatedInfra && 'Infraestrutura apartada'
  ].filter(Boolean);
}

function formatViolation(violation: any) {
  const current = Number(violation?.current || 0).toLocaleString('pt-BR');
  const max = Number(violation?.max || 0).toLocaleString('pt-BR');
  return `${violation?.label || 'Limite'}: uso atual ${current} / limite ${max}`;
}

export function PlansPage() {
  const user = useAuthStore(s => s.user);
  const organization = useAuthStore(s => s.organization);
  const confirm = useConfirm();
  const canRequest = canRequestPlan(user, organization);
  const { data: plans = [] } = useQuery({ queryKey: ['public-plans'], queryFn: api.plans.publicList });
  const { data: requests = [], refetch: refetchRequests } = useQuery({
    queryKey: ['plan-change-requests', organization?.id],
    queryFn: api.planChangeRequests.list,
    enabled: canRequest
  });
  const currentPlanId = organization?.plan?.id || organization?.planId || '';
  const availableTargets = useMemo(() => plans.filter((plan: any) => plan.id !== currentPlanId), [plans, currentPlanId]);
  const [requestedPlanId, setRequestedPlanId] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const pendingRequest = requests.find((request: any) => request.status === 'PENDING');
  const { data: selectedImpact, isFetching: loadingImpact } = useQuery({
    queryKey: ['plan-change-impact', organization?.id, requestedPlanId],
    queryFn: () => api.planChangeRequests.impact(requestedPlanId),
    enabled: canRequest && Boolean(requestedPlanId) && !pendingRequest
  });
  const selectedViolations = selectedImpact?.violations || [];
  const planDoesNotFit = selectedViolations.length > 0;

  useEffect(() => {
    if (!requestedPlanId && availableTargets.length) setRequestedPlanId(availableTargets[0].id);
  }, [availableTargets, requestedPlanId]);

  if (!canViewPlans(user, organization)) {
    return (
      <div className="card-premium p-8 text-center">
        <h2 className="text-2xl font-black text-slate-950">Sem acesso aos planos</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">A visualizacao de planos e valores fica disponivel apenas para Admin da Organizacao e Admin Geral.</p>
      </div>
    );
  }

  async function requestPlanChange() {
    if (!requestedPlanId) return;
    if (planDoesNotFit) {
      setMessage(selectedImpact?.message || 'Este plano nao comporta o uso atual da organizacao.');
      return;
    }
    const requestedPlan = plans.find((plan: any) => plan.id === requestedPlanId);
    const confirmed = await confirm({
      title: 'Solicitar troca de plano?',
      description: `Confirma enviar a solicitacao para alterar o plano da organizacao "${organization?.name}" para "${requestedPlan?.name || 'plano selecionado'}"?`,
      details: ['O pedido ficara pendente para o Super Admin aprovar ou recusar.'],
      confirmLabel: 'Sim, solicitar',
      tone: 'warning'
    });
    if (!confirmed) return;
    setMessage('');
    try {
      await api.planChangeRequests.create({ requestedPlanId, reason });
      setReason('');
      setMessage('Solicitacao enviada para o Super Admin analisar.');
      await refetchRequests();
      await confirm({
        title: 'Solicitacao enviada',
        description: 'O pedido de troca de plano foi enviado para analise do Super Admin.',
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Nao foi possivel solicitar a troca de plano.');
    }
  }

  return (
    <div className="space-y-6">
      <section className="dashboard-gallery-hero selection-hero selection-hero-plans">
        <div className="dashboard-gallery-hero-content">
          <p className="eyebrow text-white/80">Easy BI Workspace</p>
          <h3>Escolha o plano certo</h3>
          <p>Compare valores, limites e recursos disponiveis para manter a operacao dentro do pacote ideal.</p>
        </div>
        <div className="selection-hero-actions">
          <span className="selection-hero-pill"><CreditCard size={15} /> {organization?.plan?.name || 'Sem plano'}</span>
          <span className="selection-hero-pill"><Sparkles size={15} /> {plans.length} opcoes</span>
        </div>
      </section>

      {organization?.id && (
        <section className="card-premium p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary-soft p-3 text-primary"><CreditCard /></div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Plano atual</p>
                <h3 className="mt-1 text-2xl font-black text-slate-950">{organization.plan?.name || 'Sem plano vinculado'}</h3>
                <p className="text-sm font-bold text-slate-500">{organization.name}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="plans-grid">
        {plans.map((plan: any) => {
          const current = plan.id === currentPlanId;
          return (
            <article key={plan.id} className={`card-premium relative flex min-w-0 flex-col overflow-hidden p-5 sm:p-6 ${current ? 'ring-2 ring-orange-300/70' : ''}`}>
              <div className="pointer-events-none absolute -right-14 -top-16 h-36 w-36 rounded-full bg-orange-200/30 blur-2xl" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xl font-black text-slate-950">{plan.name}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-500">{plan.description || 'Plano Easy BI'}</p>
                </div>
                {current && <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-black text-primary">Atual</span>}
              </div>
              <div className="mt-5 rounded-[1.65rem] border border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-4 shadow-[0_18px_42px_rgba(249,115,22,0.16)]">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Valor mensal</p>
                <p className="mt-1 break-words text-[clamp(2rem,4vw,2.5rem)] font-black tracking-[-0.05em] text-orange-600 drop-shadow-sm">{money(plan)}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{priceCaption(plan)}</p>
              </div>
              <div className="mt-5 space-y-2 text-sm font-bold text-slate-600">
                <p>{limit(plan.limits?.maxUsers, 'usuarios')}</p>
                <p>{limit(plan.limits?.maxDatasets, 'bases de dados')}</p>
                <p>{limit(plan.limits?.maxDashboards, 'dashboards')}</p>
                <p>{limit(plan.limits?.maxTotalRows, 'linhas totais')}</p>
                {plan.trialDays ? <p>{plan.trialDays} dias de acesso para teste</p> : null}
              </div>
              {plan.requiresDedicatedInfra && (
                <p className="mt-4 rounded-3xl border border-cyan-100 bg-cyan-50 p-4 text-sm font-bold text-cyan-800">
                  O Corporate libera conexoes com bancos de dados e opera em infraestrutura apartada dos planos Free e Starter. A liberacao e o valor devem ser combinados com o Admin Master.
                </p>
              )}
              <div className="mt-5 flex-1 space-y-2">
                {featureList(plan).map((feature: any) => (
                  <p key={feature} className="flex items-center gap-2 text-sm font-bold text-slate-700"><CheckCircle2 size={16} className="text-primary" /> {feature}</p>
                ))}
                {!featureList(plan).length && <p className="text-sm font-bold text-slate-400">Recursos essenciais para comecar.</p>}
              </div>
            </article>
          );
        })}
      </section>

      {canRequest && (
        <section className="card-premium p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary-soft p-3 text-primary"><Sparkles /></div>
            <div>
              <p className="text-lg font-black">Solicitar alteracao de plano</p>
              <p className="text-sm text-slate-500">O pedido fica pendente para o Super Admin aprovar ou recusar.</p>
            </div>
          </div>
          {pendingRequest ? (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
              Ja existe uma solicitacao pendente para {pendingRequest.requestedPlan?.name}. Aguarde a analise do Super Admin.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-[260px_1fr_190px]">
              <select className="input" value={requestedPlanId} onChange={event => setRequestedPlanId(event.target.value)}>
                {availableTargets.map((plan: any) => <option key={plan.id} value={plan.id}>{plan.name} - {money(plan)}</option>)}
              </select>
              <input className="input" value={reason} onChange={event => setReason(event.target.value)} placeholder="Motivo opcional para a troca de plano" />
              <button className="btn-primary" onClick={requestPlanChange} disabled={!requestedPlanId || planDoesNotFit || loadingImpact}><Send size={16} /> Solicitar</button>
              {planDoesNotFit && (
                <div className="lg:col-span-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <p>Este plano nao comporta o uso atual da organizacao. Antes de reduzir, ajuste o uso ou escolha um plano maior.</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {selectedViolations.map((violation: any) => (
                          <span key={violation.limit} className="rounded-2xl bg-white/70 px-3 py-2">{formatViolation(violation)}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {!planDoesNotFit && selectedImpact?.canApply && (
                <div className="lg:col-span-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                  O uso atual cabe no plano selecionado. A solicitacao pode ser enviada para analise do Super Admin.
                </div>
              )}
            </div>
          )}
          {message && <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">{message}</p>}
        </section>
      )}

      {canRequest && requests.length > 0 && (
        <section className="card-premium overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <p className="text-lg font-black">Historico de solicitacoes</p>
          </div>
          <div className="overflow-auto">
            <table className="min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="px-5 py-3">De</th><th className="px-5 py-3">Para</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Data</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request: any) => (
                  <tr key={request.id}>
                    <td className="px-5 py-4 font-bold text-slate-700">{request.currentPlan?.name || '-'}</td>
                    <td className="px-5 py-4 font-bold text-slate-700">{request.requestedPlan?.name || '-'}</td>
                    <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{request.status}</span></td>
                    <td className="px-5 py-4 text-xs font-bold text-slate-500">{new Date(request.createdAt).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
