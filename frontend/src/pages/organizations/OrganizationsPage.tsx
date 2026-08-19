import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, CreditCard, Edit3, Layers3, PlusCircle, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { api } from '../../api/resources.api';
import { useAuthStore } from '../../store/auth.store';
import { useConfirm } from '../../components/ConfirmDialog';

function canManageSectors(user: any, organization: any) {
  const role = String(organization?.role || '').toUpperCase();
  return Boolean(user?.isSuperAdmin || role === 'SUPER_ADMIN' || role === 'ORG_ADMIN');
}

function sectorStatusClass(status: string) {
  return status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500';
}

function formatLimit(value: any) {
  return value === null || value === undefined ? 'Ilimitado' : Number(value || 0).toLocaleString('pt-BR');
}

function formatPlanPrice(plan: any) {
  if (plan?.priceLabel && Number(plan?.monthlyPrice || 0) === 0) return plan.priceLabel;
  if (plan?.monthlyPrice === null || plan?.monthlyPrice === undefined) return plan?.priceLabel || 'Sob consulta';
  return `${Number(plan.monthlyPrice).toLocaleString('pt-BR', { style: 'currency', currency: plan.currency || 'BRL' })}/mes`;
}

function hasPlanFeature(organization: any, feature: string) {
  return organization?.plan?.features?.[feature] !== false;
}

export function OrganizationsPage() {
  const user = useAuthStore(s => s.user);
  const currentOrg = useAuthStore(s => s.organization);
  const updateCurrentOrganization = useAuthStore(s => s.updateCurrentOrganization);
  const confirm = useConfirm();
  const { data: organizations = [], refetch } = useQuery({ queryKey: ['organizations'], queryFn: api.organizations.list });
  const { data: plans = [] } = useQuery({ queryKey: ['plans'], queryFn: api.plans.list, enabled: Boolean(user?.isSuperAdmin) });
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(currentOrg?.id || '');
  const manageableOrgId = user?.isSuperAdmin ? selectedOrganizationId : currentOrg?.id;
  const selectedOrganization = useMemo(
    () => organizations.find((org: any) => org.id === manageableOrgId) || currentOrg,
    [organizations, manageableOrgId, currentOrg]
  );
  const defaultPlanId = useMemo(() => plans.find((plan: any) => plan.isDefault)?.id || plans[0]?.id || '', [plans]);
  const { data: sectors = [], refetch: refetchSectors } = useQuery({
    queryKey: ['sectors', manageableOrgId],
    queryFn: () => api.sectors.list(user?.isSuperAdmin ? { organizationId: manageableOrgId } : {}),
    enabled: Boolean(manageableOrgId && canManageSectors(user, selectedOrganization))
  });

  const [form, setForm] = useState({ name: '', document: '', planId: '', initialSectors: 'Comercial, Financeiro, Operacoes' });
  const [sectorForm, setSectorForm] = useState({ name: '', code: '', description: '' });
  const [editingSector, setEditingSector] = useState<any>(null);
  const [sectorEditForm, setSectorEditForm] = useState({ name: '', code: '', description: '', status: 'ACTIVE' });
  const [editingOrg, setEditingOrg] = useState<any>(null);
  const [orgEditForm, setOrgEditForm] = useState({ name: '', document: '', planId: '', status: 'ACTIVE', accent: 'PURPLE', primary: '#7C3AED', themeConfig: {} as any });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user?.isSuperAdmin || selectedOrganizationId || !organizations.length) return;
    setSelectedOrganizationId(organizations[0].id);
  }, [organizations, selectedOrganizationId, user?.isSuperAdmin]);

  useEffect(() => {
    if (!user?.isSuperAdmin || form.planId || !defaultPlanId) return;
    setForm((current) => ({ ...current, planId: defaultPlanId }));
  }, [defaultPlanId, form.planId, user?.isSuperAdmin]);

  useEffect(() => {
    setSectorForm({ name: '', code: '', description: '' });
    setEditingSector(null);
  }, [manageableOrgId]);

  async function refreshAll() {
    await refetch();
    if (manageableOrgId) await refetchSectors();
  }

  async function createOrganization() {
    if (!form.name) return;
    const planId = form.planId || defaultPlanId;
    const selectedPlan = plans.find((plan: any) => plan.id === planId);
    const initialSectors = form.initialSectors.split(',').map(item => item.trim()).filter(Boolean);
    const canCreateInitialSectors = selectedPlan?.features?.canCreateSectors !== false;
    const confirmed = await confirm({
      title: 'Criar organizacao?',
      description: `Confirma a criacao da organizacao "${form.name}"?`,
      details: [
        `Plano: ${selectedPlan?.name || 'padrao'}`,
        canCreateInitialSectors && initialSectors.length ? `Setores iniciais: ${initialSectors.join(', ')}` : 'A organizacao sera criada sem setores extras iniciais.'
      ],
      confirmLabel: 'Sim, criar organizacao',
      tone: 'success'
    });
    if (!confirmed) return;
    try {
      const org = await api.organizations.create({ name: form.name, document: form.document, planId, themeConfig: { accent: 'PURPLE', primary: '#7C3AED' } });
      if (canCreateInitialSectors) {
        for (const sectorName of initialSectors) {
          await api.sectors.create({ name: sectorName, organizationId: org.id });
        }
      }
      setForm({ name: '', document: '', planId: defaultPlanId, initialSectors: 'Comercial, Financeiro, Operacoes' });
      setSelectedOrganizationId(org.id);
      setMessage(canCreateInitialSectors ? 'Organizacao criada com setores iniciais. Agora crie o Admin da Organizacao em Usuarios.' : 'Organizacao criada. O plano escolhido usa apenas o setor padrao Geral.');
      await refreshAll();
      await confirm({
        title: 'Organizacao criada',
        description: `A organizacao "${org.name || form.name}" foi criada com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Apenas Super Admin pode criar organizacoes.');
    }
  }

  async function createSector() {
    if (!sectorForm.name || !manageableOrgId) return;
    if (!hasPlanFeature(selectedOrganization, 'canCreateSectors')) {
      setMessage('O plano atual da organizacao nao permite criar setores extras.');
      return;
    }
    const confirmed = await confirm({
      title: 'Criar setor?',
      description: `Confirma a criacao do setor "${sectorForm.name}" na organizacao "${selectedOrganization?.name || 'selecionada'}"?`,
      confirmLabel: 'Sim, criar setor',
      tone: 'success'
    });
    if (!confirmed) return;
    try {
      await api.sectors.create({ ...sectorForm, organizationId: manageableOrgId });
      setSectorForm({ name: '', code: '', description: '' });
      setMessage('Setor criado com sucesso. Agora voce pode vincular usuarios a ele.');
      await refetchSectors();
      await confirm({
        title: 'Setor criado',
        description: `O setor "${sectorForm.name}" foi criado com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Nao foi possivel criar o setor.');
    }
  }

  function openSectorEdit(sector: any) {
    setEditingSector(sector);
    setSectorEditForm({ name: sector.name || '', code: sector.code || '', description: sector.description || '', status: sector.status || 'ACTIVE' });
  }

  async function saveSector() {
    if (!editingSector) return;
    const confirmed = await confirm({
      title: 'Salvar alteracoes do setor?',
      description: `O setor "${editingSector.name}" sera atualizado para "${sectorEditForm.name}".`,
      details: [`Status: ${sectorEditForm.status}`],
      confirmLabel: 'Sim, salvar',
      tone: 'warning'
    });
    if (!confirmed) return;
    try {
      await api.sectors.update(editingSector.id, sectorEditForm);
      setEditingSector(null);
      setMessage('Setor atualizado.');
      await refetchSectors();
      await confirm({
        title: 'Setor atualizado',
        description: `As alteracoes do setor "${sectorEditForm.name}" foram salvas com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Nao foi possivel atualizar o setor.');
    }
  }

  async function removeSector(id: string, name: string) {
    const confirmed = await confirm({
      title: 'Inativar setor?',
      description: `Tem certeza que deseja inativar o setor "${name}"? Usuarios podem perder acesso aos dados desse setor.`,
      confirmLabel: 'Sim, inativar',
      tone: 'danger'
    });
    if (!confirmed) return;
    try {
      await api.sectors.remove(id);
      setMessage('Setor inativado.');
      await refetchSectors();
      await confirm({
        title: 'Setor inativado',
        description: `O setor "${name}" foi inativado com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Nao foi possivel remover o setor.');
    }
  }

  function openOrgEdit(org: any) {
    const themeConfig = org.themeConfig || {};
    setEditingOrg(org);
    setOrgEditForm({
      name: org.name || '',
      document: org.document || '',
      planId: org.planId || org.plan?.id || defaultPlanId,
      status: org.deletedAt ? 'INACTIVE' : org.status || 'ACTIVE',
      accent: themeConfig.accent || 'PURPLE',
      primary: themeConfig.primary || '#7C3AED',
      themeConfig
    });
  }

  async function saveOrganization() {
    if (!editingOrg) return;
    const confirmed = await confirm({
      title: 'Salvar organizacao?',
      description: `As configuracoes da organizacao "${editingOrg.name}" serao atualizadas.`,
      details: [
        `Novo nome: ${orgEditForm.name}`,
        `Status: ${orgEditForm.status}`,
        user?.isSuperAdmin ? `Plano: ${plans.find((plan: any) => plan.id === orgEditForm.planId)?.name || 'padrao'}` : 'Plano nao sera alterado neste perfil.'
      ],
      confirmLabel: 'Sim, salvar',
      tone: 'warning'
    });
    if (!confirmed) return;
    try {
      const payload: any = {
        name: orgEditForm.name,
        document: orgEditForm.document,
        status: orgEditForm.status,
        themeConfig: { ...orgEditForm.themeConfig, accent: orgEditForm.accent, primary: orgEditForm.primary }
      };
      if (user?.isSuperAdmin) payload.planId = orgEditForm.planId || defaultPlanId;
      const updated = await api.organizations.update(editingOrg.id, payload);
      if (currentOrg?.id === updated.id) updateCurrentOrganization(updated);
      setEditingOrg(null);
      setMessage('Organizacao atualizada.');
      await refreshAll();
      await confirm({
        title: 'Organizacao atualizada',
        description: `As alteracoes da organizacao "${orgEditForm.name}" foram salvas com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Nao foi possivel atualizar a organizacao.');
    }
  }

  async function inactiveOrganization(id: string, name: string) {
    const confirmed = await confirm({
      title: 'Inativar organizacao?',
      description: `Tem certeza que deseja inativar a organizacao "${name}"? Os usuarios podem perder acesso ao ambiente.`,
      confirmLabel: 'Sim, inativar',
      tone: 'danger'
    });
    if (!confirmed) return;
    try {
      await api.organizations.remove(id);
      setMessage('Organizacao inativada.');
      await refreshAll();
      await confirm({
        title: 'Organizacao inativada',
        description: `A organizacao "${name}" foi inativada com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Nao foi possivel inativar a organizacao.');
    }
  }

  async function activateOrganization(id: string, name: string) {
    const confirmed = await confirm({
      title: 'Ativar organizacao?',
      description: `Confirma a reativacao da organizacao "${name}"?`,
      confirmLabel: 'Sim, ativar',
      tone: 'success'
    });
    if (!confirmed) return;
    try {
      await api.organizations.update(id, { status: 'ACTIVE' });
      setMessage('Organizacao ativada novamente.');
      await refreshAll();
      await confirm({
        title: 'Organizacao ativada',
        description: `A organizacao "${name}" foi reativada com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Nao foi possivel ativar a organizacao.');
    }
  }

  return (
    <div className="space-y-6">
      <section className="dashboard-gallery-hero selection-hero selection-hero-organizations">
        <div className="dashboard-gallery-hero-content">
          <p className="eyebrow text-white/80">Easy BI Workspace</p>
          <h3>Administre organizacoes</h3>
          <p>Cadastre clientes, ajuste planos, reative empresas e organize setores para cada ambiente do Easy BI.</p>
        </div>
        <div className="selection-hero-actions">
          <span className="selection-hero-pill"><Building2 size={15} /> {organizations.length} organizacoes</span>
          <span className="selection-hero-pill"><CreditCard size={15} /> {plans.length} planos</span>
        </div>
      </section>

      {user?.isSuperAdmin && (
        <section className="card-premium p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-primary-soft p-3 text-primary"><PlusCircle /></div>
            <div>
              <p className="text-lg font-black">Criar nova organizacao</p>
              <p className="text-sm text-slate-500">Ja deixe setores iniciais para facilitar o cadastro dos usuarios.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_220px_220px_1fr_180px]">
            <input className="input" placeholder="Nome da organizacao" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Documento/CNPJ" value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} />
            <select className="input" value={form.planId || defaultPlanId} onChange={e => setForm({ ...form, planId: e.target.value })}>
              {plans.map((plan: any) => <option key={plan.id} value={plan.id}>{plan.name} - {formatPlanPrice(plan)}</option>)}
            </select>
            <input className="input" placeholder="Setores iniciais separados por virgula" value={form.initialSectors} onChange={e => setForm({ ...form, initialSectors: e.target.value })} />
            <button className="btn-primary" onClick={createOrganization}>Criar</button>
          </div>
          {message && <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">{message}</p>}
        </section>
      )}

      {canManageSectors(user, selectedOrganization) && (
        <section className="card-premium p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary-soft p-3 text-primary"><Layers3 /></div>
              <div>
                <p className="text-lg font-black">Setores da organizacao</p>
                <p className="text-sm text-slate-500">Organizacao: <strong>{selectedOrganization?.name || 'Selecione uma organizacao'}</strong></p>
              </div>
            </div>
            <span className="rounded-full bg-primary-soft px-4 py-2 text-xs font-black text-primary">{sectors.length} setores</span>
          </div>

          {user?.isSuperAdmin && (
            <select className="input mb-4" value={selectedOrganizationId} onChange={e => setSelectedOrganizationId(e.target.value)}>
              <option value="">Selecione a organizacao para gerir setores</option>
              {organizations.map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          )}

          <div className="grid gap-4 md:grid-cols-[1fr_170px_1fr_170px]">
            <input className="input" placeholder="Nome do setor" value={sectorForm.name} onChange={e => setSectorForm({ ...sectorForm, name: e.target.value })} />
            <input className="input" placeholder="Codigo opcional" value={sectorForm.code} onChange={e => setSectorForm({ ...sectorForm, code: e.target.value })} />
            <input className="input" placeholder="Descricao opcional" value={sectorForm.description} onChange={e => setSectorForm({ ...sectorForm, description: e.target.value })} />
            <button className="btn-primary disabled:opacity-50" disabled={!manageableOrgId || !hasPlanFeature(selectedOrganization, 'canCreateSectors')} onClick={createSector}>Adicionar</button>
          </div>
          {!hasPlanFeature(selectedOrganization, 'canCreateSectors') && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-700">O plano atual permite apenas o setor padrao. Para criar setores extras, o Super Admin precisa alterar o plano da organizacao.</p>}

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sectors.map((sector: any) => (
              <div key={sector.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                {editingSector?.id === sector.id ? (
                  <div className="space-y-3">
                    <input className="input" value={sectorEditForm.name} onChange={e => setSectorEditForm({ ...sectorEditForm, name: e.target.value })} />
                    <input className="input" value={sectorEditForm.code} onChange={e => setSectorEditForm({ ...sectorEditForm, code: e.target.value })} />
                    <input className="input" value={sectorEditForm.description} onChange={e => setSectorEditForm({ ...sectorEditForm, description: e.target.value })} />
                    <select className="input" value={sectorEditForm.status} onChange={e => setSectorEditForm({ ...sectorEditForm, status: e.target.value })}>
                      <option value="ACTIVE">Ativo</option>
                      <option value="INACTIVE">Inativo</option>
                      <option value="BLOCKED">Bloqueado</option>
                    </select>
                    <div className="flex gap-2">
                      <button onClick={saveSector} className="btn-primary flex-1 justify-center"><Save size={15} /> Salvar</button>
                      <button onClick={() => setEditingSector(null)} className="btn-muted"><X size={15} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{sector.name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{sector.code}</p>
                      <p className="mt-2 text-sm text-slate-500">{sector.description || 'Sem descricao'}</p>
                      <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${sectorStatusClass(sector.status)}`}>{sector.status}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openSectorEdit(sector)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:border-primary hover:text-primary"><Edit3 size={14} /></button>
                      {!sector.isDefault && <button onClick={() => removeSector(sector.id, sector.name)} className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600"><Trash2 size={14} /></button>}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!sectors.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">Nenhum setor cadastrado.</div>}
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {organizations.map((org: any) => {
          const inactive = org.status !== 'ACTIVE' || Boolean(org.deletedAt);
          const isEditing = editingOrg?.id === org.id;
          return (
            <div key={org.id} className="card-premium p-6">
              {isEditing ? (
                <div className="space-y-3">
                  <input className="input" value={orgEditForm.name} onChange={e => setOrgEditForm({ ...orgEditForm, name: e.target.value })} />
                  <input className="input" placeholder="Documento/CNPJ" value={orgEditForm.document} onChange={e => setOrgEditForm({ ...orgEditForm, document: e.target.value })} />
                  <select className="input" value={orgEditForm.status} onChange={e => setOrgEditForm({ ...orgEditForm, status: e.target.value })}>
                    <option value="ACTIVE">Ativa</option>
                    <option value="INACTIVE">Inativa</option>
                    <option value="BLOCKED">Bloqueada</option>
                  </select>
                  <select className="input" value={orgEditForm.planId || defaultPlanId} onChange={e => setOrgEditForm({ ...orgEditForm, planId: e.target.value })}>
                    {plans.map((plan: any) => <option key={plan.id} value={plan.id}>{plan.name} - {formatPlanPrice(plan)}</option>)}
                  </select>
                  <div className="grid grid-cols-[1fr_120px] gap-2">
                    <input className="input" placeholder="Tema/acento" value={orgEditForm.accent} onChange={e => setOrgEditForm({ ...orgEditForm, accent: e.target.value.toUpperCase() })} />
                    <input className="input" type="color" value={orgEditForm.primary} onChange={e => setOrgEditForm({ ...orgEditForm, primary: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveOrganization} className="btn-primary flex-1 justify-center"><Save size={16} /> Salvar</button>
                    <button onClick={() => setEditingOrg(null)} className="btn-muted"><X size={16} /></button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <Building2 className="text-primary" />
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${inactive ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{inactive ? 'INACTIVE' : org.status}</span>
                  </div>
                  <p className="mt-4 text-xl font-black text-slate-900">{org.name}</p>
                  <p className="mt-1 text-sm text-slate-500">/{org.slug}</p>
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <CreditCard size={15} className="text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Plano</span>
                    </div>
                    <p className="mt-1 font-black text-slate-800">{org.plan?.name || 'Sem plano'}</p>
                    {org.plan && <p className="mt-1 text-sm font-black text-primary">{formatPlanPrice(org.plan)}</p>}
                    {org.plan?.limits && (
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {formatLimit(org.plan.limits.maxUsers)} usuarios · {formatLimit(org.plan.limits.maxDatasets)} bases · {formatLimit(org.plan.limits.maxDashboards)} dashboards
                        {org.plan.limits.maxTotalRows !== null && org.plan.limits.maxTotalRows !== undefined ? ` · ${formatLimit(org.plan.limits.maxTotalRows)} linhas totais` : ''}
                      </p>
                    )}
                    {org.accessExpiresAt && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">Acesso ate {new Date(org.accessExpiresAt).toLocaleDateString('pt-BR')}</p>}
                  </div>
                  <div className="mt-5 rounded-2xl bg-slate-50 p-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tema</span>
                    <p className="font-bold text-slate-800">{org.themeConfig?.accent || 'PURPLE'}</p>
                  </div>
                  {user?.isSuperAdmin && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button onClick={() => openOrgEdit(org)} className="btn-muted justify-center"><Edit3 size={16} /> Editar</button>
                      {inactive
                        ? <button onClick={() => activateOrganization(org.id, org.name)} className="btn-primary justify-center"><RotateCcw size={16} /> Ativar</button>
                        : <button onClick={() => inactiveOrganization(org.id, org.name)} className="btn-danger justify-center"><Trash2 size={16} /> Inativar</button>}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
