import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CreditCard, Inbox, Info, Search, ShieldCheck, UserPlus, X, XCircle } from 'lucide-react';
import { api } from '../../api/resources.api';
import { useAuthStore } from '../../store/auth.store';
import { useConfirm } from '../../components/ConfirmDialog';

function money(plan: any) {
  if (plan?.monthlyPrice === null || plan?.monthlyPrice === undefined) return plan?.priceLabel || 'Sob consulta';
  return Number(plan.monthlyPrice).toLocaleString('pt-BR', { style: 'currency', currency: plan.currency || 'BRL' });
}

function statusClass(status: string) {
  if (status === 'APPROVED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'REJECTED') return 'bg-red-50 text-red-700';
  return 'bg-amber-50 text-amber-700';
}

export function AdminRequestsPage() {
  const user = useAuthStore(s => s.user);
  const confirm = useConfirm();
  const { data: plans = [] } = useQuery({ queryKey: ['public-plans'], queryFn: api.plans.publicList, enabled: Boolean(user?.isSuperAdmin) });
  const { data: accessRequests = [], refetch: refetchAccess } = useQuery({ queryKey: ['access-requests'], queryFn: api.accessRequests.list, enabled: Boolean(user?.isSuperAdmin) });
  const { data: planRequests = [], refetch: refetchPlans } = useQuery({ queryKey: ['admin-plan-change-requests'], queryFn: api.planChangeRequests.list, enabled: Boolean(user?.isSuperAdmin) });
  const [filter, setFilter] = useState('');
  const [accessForms, setAccessForms] = useState<Record<string, any>>({});
  const [planNotes, setPlanNotes] = useState<Record<string, string>>({});
  const [infoModal, setInfoModal] = useState<{ title: string; rows: { label: string; value: any }[] } | null>(null);
  const [message, setMessage] = useState('');

  const filteredAccess = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return accessRequests;
    return accessRequests.filter((request: any) => [
      request.requesterName,
      request.requesterEmail,
      request.companyName,
      request.status,
      request.requestedPlan?.name
    ].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [accessRequests, filter]);

  const filteredPlans = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return planRequests;
    return planRequests.filter((request: any) => [
      request.organization?.name,
      request.currentPlan?.name,
      request.requestedPlan?.name,
      request.requestedBy?.name,
      request.status
    ].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [planRequests, filter]);

  if (!user?.isSuperAdmin) {
    return (
      <div className="card-premium p-8 text-center">
        <h2 className="text-2xl font-black text-slate-950">Sem acesso as solicitacoes</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Este modulo e exclusivo para o Admin SaaS global.</p>
      </div>
    );
  }

  function patchAccess(id: string, payload: any) {
    setAccessForms(current => ({ ...current, [id]: { ...(current[id] || {}), ...payload } }));
  }

  function openInfo(title: string, rows: { label: string; value: any }[]) {
    setInfoModal({ title, rows });
  }

  async function reviewAccess(request: any, status: 'APPROVED' | 'REJECTED') {
    const form = accessForms[request.id] || {};
    const confirmed = await confirm({
      title: status === 'APPROVED' ? 'Aprovar acesso e criar login?' : 'Reprovar solicitacao de acesso?',
      description: status === 'APPROVED'
        ? `A organizacao "${form.organizationName || request.companyName}" sera criada/atualizada e o login inicial de "${form.userName || request.requesterName}" sera liberado.`
        : `A solicitacao de acesso de "${request.requesterName}" sera recusada.`,
      details: status === 'APPROVED' ? [
        `E-mail: ${form.userEmail || request.requesterEmail}`,
        `Plano: ${plans.find((plan: any) => plan.id === (form.planId || request.requestedPlan?.id))?.name || request.requestedPlan?.name || 'selecionado'}`
      ] : undefined,
      confirmLabel: status === 'APPROVED' ? 'Sim, aprovar' : 'Sim, reprovar',
      tone: status === 'APPROVED' ? 'success' : 'danger'
    });
    if (!confirmed) return;
    setMessage('');
    try {
      await api.accessRequests.review(request.id, {
        status,
        adminNotes: form.adminNotes,
        planId: form.planId || request.requestedPlan?.id || plans[0]?.id,
        organizationName: form.organizationName || request.companyName,
        document: form.document || request.document,
        userName: form.userName || request.requesterName,
        userEmail: form.userEmail || request.requesterEmail,
        password: form.password
      });
      setMessage(status === 'APPROVED' ? 'Acesso aprovado e login criado.' : 'Solicitacao de acesso recusada.');
      await refetchAccess();
      await confirm({
        title: status === 'APPROVED' ? 'Acesso aprovado' : 'Solicitacao recusada',
        description: status === 'APPROVED' ? 'O acesso foi aprovado e o login foi criado com sucesso.' : 'A solicitacao de acesso foi recusada com sucesso.',
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Nao foi possivel analisar a solicitacao.');
    }
  }

  async function reviewPlan(request: any, status: 'APPROVED' | 'REJECTED') {
    const confirmed = await confirm({
      title: status === 'APPROVED' ? 'Aprovar troca de plano?' : 'Reprovar troca de plano?',
      description: status === 'APPROVED'
        ? `A organizacao "${request.organization?.name}" sera alterada para o plano "${request.requestedPlan?.name}".`
        : `A solicitacao de troca de plano da organizacao "${request.organization?.name}" sera recusada.`,
      details: [`Plano atual: ${request.currentPlan?.name || '-'}`, `Plano solicitado: ${request.requestedPlan?.name || '-'}`],
      confirmLabel: status === 'APPROVED' ? 'Sim, aprovar' : 'Sim, reprovar',
      tone: status === 'APPROVED' ? 'success' : 'danger'
    });
    if (!confirmed) return;
    setMessage('');
    try {
      await api.planChangeRequests.review(request.id, { status, adminNotes: planNotes[request.id] });
      setMessage(status === 'APPROVED' ? 'Troca de plano aprovada.' : 'Troca de plano recusada.');
      await refetchPlans();
      await confirm({
        title: status === 'APPROVED' ? 'Plano aprovado' : 'Plano recusado',
        description: status === 'APPROVED' ? 'A troca de plano foi aprovada com sucesso.' : 'A troca de plano foi recusada com sucesso.',
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Nao foi possivel analisar a troca de plano.');
    }
  }

  return (
    <div className="space-y-6">
      <section className="dashboard-gallery-hero selection-hero selection-hero-requests">
        <div className="dashboard-gallery-hero-content">
          <p className="eyebrow text-white/80">Easy BI Workspace</p>
          <h3>Acompanhe solicitacoes</h3>
          <p>Aprove novos acessos, crie logins iniciais e analise pedidos de troca de plano das organizacoes.</p>
        </div>
        <div className="selection-hero-actions">
          <span className="selection-hero-pill"><UserPlus size={15} /> {accessRequests.length} acessos</span>
          <span className="selection-hero-pill"><CreditCard size={15} /> {planRequests.length} planos</span>
        </div>
      </section>

      <section className="app-search-shell">
        <div className="app-search-icon"><Search size={22} /></div>
        <label className="app-search-field">
          <span className="sr-only">Pesquisar solicitacoes</span>
          <input placeholder="Pesquisar por empresa, pessoa, e-mail, plano ou status" value={filter} onChange={event => setFilter(event.target.value)} />
        </label>
        <span className="app-search-count">{filteredAccess.length + filteredPlans.length} itens</span>
      </section>

      {message && <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">{message}</p>}

      <section className="card-premium overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary-soft p-3 text-primary"><UserPlus /></div>
            <div>
              <p className="text-lg font-black">Pedidos de acesso</p>
              <p className="text-sm text-slate-500">Aprovando aqui, o Easy BI cria a org e o Admin da Organizacao.</p>
            </div>
          </div>
          <span className="rounded-full bg-primary-soft px-4 py-2 text-xs font-black text-primary">{filteredAccess.length} pedidos</span>
        </div>
        <div className="divide-y divide-slate-100">
          {filteredAccess.map((request: any) => {
            const form = accessForms[request.id] || {};
            return (
              <article key={request.id} className="grid gap-5 p-5 xl:grid-cols-[1fr_1.35fr]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-black text-slate-950">{request.companyName}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(request.status)}`}>{request.status}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-600">{request.requesterName} - {request.requesterEmail}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{request.phone || 'Sem telefone'} - {request.document || 'Sem documento'}</p>
                  <button
                    type="button"
                    onClick={() => openInfo('Detalhes do pedido de acesso', [
                      { label: 'Mensagem', value: request.message || 'Sem mensagem adicional.' },
                      { label: 'Observacao interna', value: request.adminNotes || 'Sem observacao.' },
                      { label: 'Criado em', value: request.createdAt ? new Date(request.createdAt).toLocaleString('pt-BR') : '-' },
                      { label: 'Analisado em', value: request.reviewedAt ? new Date(request.reviewedAt).toLocaleString('pt-BR') : 'Ainda pendente' }
                    ])}
                    className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:border-primary hover:text-primary"
                  >
                    <Info size={14} /> Ver mensagem
                  </button>
                  <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Plano solicitado</p>
                  <p className="mt-1 font-black text-primary">{request.requestedPlan?.name || '-'} - {money(request.requestedPlan)}/mes</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {request.status === 'PENDING' ? (
                    <>
                      <input className="input" value={form.organizationName ?? request.companyName} onChange={event => patchAccess(request.id, { organizationName: event.target.value })} placeholder="Nome da organizacao" />
                      <input className="input" value={form.document ?? request.document ?? ''} onChange={event => patchAccess(request.id, { document: event.target.value })} placeholder="Documento/CNPJ" />
                      <input className="input" value={form.userName ?? request.requesterName} onChange={event => patchAccess(request.id, { userName: event.target.value })} placeholder="Nome do admin" />
                      <input className="input" value={form.userEmail ?? request.requesterEmail} onChange={event => patchAccess(request.id, { userEmail: event.target.value })} placeholder="E-mail do admin" />
                      <select className="input" value={form.planId || request.requestedPlan?.id || plans[0]?.id || ''} onChange={event => patchAccess(request.id, { planId: event.target.value })}>
                        {plans.map((plan: any) => <option key={plan.id} value={plan.id}>{plan.name} - {money(plan)}/mes</option>)}
                      </select>
                      <input className="input" type="password" value={form.password ?? ''} onChange={event => patchAccess(request.id, { password: event.target.value })} placeholder="Senha inicial (min. 8)" />
                      <input className="input md:col-span-2" value={form.adminNotes || ''} onChange={event => patchAccess(request.id, { adminNotes: event.target.value })} placeholder="Observacao interna opcional" />
                      <div className="flex gap-2 md:col-span-2">
                        <button onClick={() => reviewAccess(request, 'APPROVED')} className="btn-primary flex-1"><CheckCircle2 size={16} /> Aprovar e criar login</button>
                        <button onClick={() => reviewAccess(request, 'REJECTED')} className="btn-danger flex-1 justify-center"><XCircle size={16} /> Reprovar</button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Pedido analisado</p>
                      <p className="mt-2 text-sm font-bold text-slate-700">
                        {request.status === 'APPROVED' ? 'Acesso aprovado e login criado.' : 'Solicitacao recusada.'}
                      </p>
                      {request.createdOrganization && <p className="mt-2 text-sm font-bold text-slate-600">Organizacao: {request.createdOrganization.name}</p>}
                      {request.createdUser && <p className="text-sm font-bold text-slate-600">Usuario: {request.createdUser.name} - {request.createdUser.email}</p>}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
          {!filteredAccess.length && <div className="p-8 text-center text-sm font-bold text-slate-500">Nenhum pedido de acesso encontrado.</div>}
        </div>
      </section>

      <section className="card-premium overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary-soft p-3 text-primary"><Inbox /></div>
            <div>
              <p className="text-lg font-black">Trocas de plano</p>
              <p className="text-sm text-slate-500">Pedidos enviados pelos Admins das Organizacoes.</p>
            </div>
          </div>
          <span className="rounded-full bg-primary-soft px-4 py-2 text-xs font-black text-primary">{filteredPlans.length} pedidos</span>
        </div>
        <div className="overflow-auto">
          <table className="min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="px-5 py-3">Organizacao</th><th className="px-5 py-3">Atual</th><th className="px-5 py-3">Solicitado</th><th className="px-5 py-3">Solicitante</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Acoes</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPlans.map((request: any) => {
                return (
                  <tr key={request.id} className="align-top hover:bg-primary-soft">
                    <td className="px-5 py-4">
                      <p className="font-black text-slate-900">{request.organization?.name}</p>
                      <button
                        type="button"
                        onClick={() => openInfo('Motivo da troca de plano', [
                          { label: 'Motivo', value: request.reason || 'Sem motivo informado.' },
                          { label: 'Observacao interna', value: request.adminNotes || 'Sem observacao.' },
                          { label: 'Criado em', value: request.createdAt ? new Date(request.createdAt).toLocaleString('pt-BR') : '-' },
                          { label: 'Analisado em', value: request.reviewedAt ? new Date(request.reviewedAt).toLocaleString('pt-BR') : 'Ainda pendente' }
                        ])}
                        className="mt-2 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:border-primary hover:text-primary"
                      >
                        <Info size={14} /> Motivo
                      </button>
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-600">{request.currentPlan?.name || '-'}<p className="text-xs text-slate-400">{money(request.currentPlan)}/mes</p></td>
                    <td className="px-5 py-4 font-bold text-primary">{request.requestedPlan?.name || '-'}<p className="text-xs text-slate-400">{money(request.requestedPlan)}/mes</p></td>
                    <td className="px-5 py-4 text-slate-600">{request.requestedBy?.name}<p className="text-xs text-slate-400">{request.requestedBy?.email}</p></td>
                    <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(request.status)}`}>{request.status}</span></td>
                    <td className="px-5 py-4">
                      {request.status === 'PENDING' ? (
                        <div className="grid min-w-[260px] gap-2">
                          <input className="input py-2 text-xs" value={planNotes[request.id] || ''} onChange={event => setPlanNotes(current => ({ ...current, [request.id]: event.target.value }))} placeholder="Observacao opcional" />
                          <div className="flex gap-2">
                            <button onClick={() => reviewPlan(request, 'APPROVED')} className="btn-primary flex-1 px-3 py-2 text-xs"><ShieldCheck size={14} /> Aprovar</button>
                            <button onClick={() => reviewPlan(request, 'REJECTED')} className="btn-danger flex-1 justify-center px-3 py-2 text-xs"><XCircle size={14} /> Reprovar</button>
                          </div>
                        </div>
                      ) : (
                        <span className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-500">Analisado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredPlans.length && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">Nenhum pedido de troca de plano encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {infoModal && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={infoModal.title}>
          <div className="w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-white/70 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Detalhes</p>
                <h3 className="mt-1 text-2xl font-black text-slate-950">{infoModal.title}</h3>
              </div>
              <button type="button" onClick={() => setInfoModal(null)} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 hover:bg-slate-100" aria-label="Fechar detalhes">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[65vh] space-y-4 overflow-auto p-5">
              {infoModal.rows.map((row) => (
                <div key={row.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{row.label}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6 text-slate-700">{row.value || '-'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
