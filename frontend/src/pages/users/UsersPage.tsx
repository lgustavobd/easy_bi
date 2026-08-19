import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Edit3, KeyRound, Layers3, Save, Search, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import { api } from '../../api/resources.api';
import { useAuthStore } from '../../store/auth.store';
import { useConfirm } from '../../components/ConfirmDialog';

function canManageUsers(user: any, organization: any) {
  const role = String(organization?.role || '').toUpperCase();
  return Boolean(user?.isSuperAdmin || role === 'SUPER_ADMIN' || role === 'ORG_ADMIN');
}

function roleName(user: any) {
  return user.role?.name || user.organizations?.[0]?.role?.name || '-';
}

function roleId(user: any) {
  return user.role?.id || user.organizations?.[0]?.role?.id || '';
}

function roleCode(user: any) {
  return user.role?.code || user.organizations?.[0]?.role?.code || '';
}

function userOrganization(user: any) {
  return user.organization || user.organizations?.[0]?.organization;
}

function isOrgAdminCode(code: any) {
  return String(code || '').toUpperCase() === 'ORG_ADMIN';
}

function isOrgAdminRole(roles: any[], selectedRoleId: string) {
  return isOrgAdminCode(roles.find((role: any) => role.id === selectedRoleId)?.code);
}

function sectorNames(user: any) {
  if (isOrgAdminCode(roleCode(user))) return 'Todos os setores';
  return (user.sectors || []).map((sector: any) => sector.name).join(', ') || 'Sem setor';
}

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id];
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every(id => right.includes(id));
}

function generateTemporaryPassword() {
  const bytes = new Uint8Array(8);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  }
  const suffix = Array.from(bytes, value => value.toString(36).padStart(2, '0')).join('').slice(0, 10);
  return `EasyBI-${suffix}!`;
}

function SectorSelector({
  sectors,
  value,
  onChange,
  disabled = false,
  allAccess = false
}: {
  sectors: any[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  allAccess?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700">
        <Layers3 size={16} className="text-primary" /> Setores de acesso
      </div>
      <div className="max-h-44 space-y-2 overflow-auto pr-1">
        {sectors.map((sector: any) => (
          <label
            key={sector.id}
            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm font-bold transition ${disabled ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'} ${value.includes(sector.id) ? 'border-primary/40 bg-primary-soft text-primary' : 'border-slate-200 bg-white text-slate-600 hover:border-primary/30'}`}
          >
            <span>{sector.name}</span>
            <input type="checkbox" disabled={disabled} checked={value.includes(sector.id)} onChange={() => onChange(toggleId(value, sector.id))} />
          </label>
        ))}
        {!sectors.length && (
          <p className="rounded-xl bg-white p-3 text-xs font-bold text-slate-500">
            Crie pelo menos um setor em Organizacoes antes de cadastrar usuarios.
          </p>
        )}
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-500">
        {allAccess
          ? 'Admin da Organizacao recebe automaticamente acesso a todos os setores ativos.'
          : 'Todo usuario precisa ter pelo menos um setor. Ele podera ver dashboards, bases de dados e modelos dos setores selecionados.'}
      </p>
    </div>
  );
}

export function UsersPage() {
  const currentOrg = useAuthStore(s => s.organization);
  const currentUser = useAuthStore(s => s.user);
  const confirm = useConfirm();
  const allowed = canManageUsers(currentUser, currentOrg);
  const [selectedUserOrganizationId, setSelectedUserOrganizationId] = useState(currentOrg?.id || '');
  const { data: users = [], refetch } = useQuery({
    queryKey: ['users', currentOrg?.id, selectedUserOrganizationId],
    queryFn: () => api.users.list(currentUser?.isSuperAdmin && selectedUserOrganizationId ? { organizationId: selectedUserOrganizationId } : {}),
    enabled: allowed
  });
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: api.users.roles, enabled: allowed });
  const { data: organizations = [] } = useQuery({ queryKey: ['organizations'], queryFn: api.organizations.list, enabled: Boolean(currentUser?.isSuperAdmin && allowed) });

  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: '', organizationId: currentOrg?.id || '', sectorIds: [] as string[] });
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', status: 'ACTIVE', roleId: '', password: '', organizationId: '', fromOrganizationId: '', sectorIds: [] as string[] });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const sectorOrganizationId = currentUser?.isSuperAdmin ? (editing ? editForm.organizationId : selectedUserOrganizationId) : currentOrg?.id;
  const { data: sectors = [] } = useQuery({
    queryKey: ['sectors', sectorOrganizationId],
    queryFn: () => api.sectors.list(currentUser?.isSuperAdmin ? { organizationId: sectorOrganizationId } : {}),
    enabled: allowed && Boolean(sectorOrganizationId)
  });

  const roleOptions = useMemo(() => roles.filter((role: any) => {
    if (role.code === 'SUPER_ADMIN') return false;
    if (!currentUser?.isSuperAdmin && role.code === 'ORG_ADMIN') return false;
    return true;
  }), [roles, currentUser?.isSuperAdmin]);

  const allSectorIds = useMemo(() => sectors.map((sector: any) => sector.id), [sectors]);
  const formIsOrgAdmin = useMemo(() => isOrgAdminRole(roles, form.roleId), [roles, form.roleId]);
  const editIsOrgAdmin = useMemo(() => isOrgAdminRole(roles, editForm.roleId), [roles, editForm.roleId]);
  const filteredUsers = useMemo(() => {
    const term = userFilter.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user: any) => [
      user.name,
      user.email,
      user.status,
      roleName(user),
      sectorNames(user),
      userOrganization(user)?.name
    ].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [users, userFilter]);

  useEffect(() => {
    if (!form.organizationId && currentOrg?.id) setForm(current => ({ ...current, organizationId: currentOrg.id }));
  }, [currentOrg?.id, form.organizationId]);

  useEffect(() => {
    if (!currentUser?.isSuperAdmin || selectedUserOrganizationId || !organizations.length) return;
    const firstOrgId = organizations[0].id;
    setSelectedUserOrganizationId(firstOrgId);
    setForm(current => current.organizationId ? current : { ...current, organizationId: firstOrgId });
  }, [currentUser?.isSuperAdmin, organizations, selectedUserOrganizationId]);

  useEffect(() => {
    if (currentUser?.isSuperAdmin && selectedUserOrganizationId !== form.organizationId) {
      setSelectedUserOrganizationId(form.organizationId);
    }
  }, [currentUser?.isSuperAdmin, form.organizationId, selectedUserOrganizationId]);

  useEffect(() => {
    if (!formIsOrgAdmin && !form.sectorIds.length && sectors.length) {
      setForm(current => ({ ...current, sectorIds: [sectors[0].id] }));
    }
  }, [form.sectorIds.length, formIsOrgAdmin, sectors]);

  useEffect(() => {
    if (!editing || editIsOrgAdmin || editForm.sectorIds.length || !sectors.length) return;
    setEditForm(current => ({ ...current, sectorIds: [sectors[0].id] }));
  }, [editing, editForm.sectorIds.length, editIsOrgAdmin, sectors]);

  useEffect(() => {
    if (!formIsOrgAdmin || !allSectorIds.length) return;
    setForm(current => sameIds(current.sectorIds, allSectorIds) ? current : { ...current, sectorIds: allSectorIds });
  }, [formIsOrgAdmin, allSectorIds]);

  useEffect(() => {
    if (!editIsOrgAdmin || !allSectorIds.length) return;
    setEditForm(current => sameIds(current.sectorIds, allSectorIds) ? current : { ...current, sectorIds: allSectorIds });
  }, [editIsOrgAdmin, allSectorIds]);

  if (!allowed) {
    return (
      <div className="card-premium p-8 text-center">
        <h2 className="text-2xl font-black text-slate-950">Sem permissao para gerenciar usuarios</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Seu perfil nao permite criar, editar permissoes ou resetar senhas.</p>
      </div>
    );
  }

  function openEdit(user: any) {
    const nextRoleId = roleId(user);
    const nextOrganizationId = userOrganization(user)?.id || user.organizations?.[0]?.organizationId || selectedUserOrganizationId || currentOrg?.id || '';
    const nextIsOrgAdmin = isOrgAdminCode(roleCode(user)) || isOrgAdminRole(roles, nextRoleId);
    setEditing(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      status: user.status || 'ACTIVE',
      roleId: nextRoleId,
      password: '',
      organizationId: nextOrganizationId,
      fromOrganizationId: nextOrganizationId,
      sectorIds: nextIsOrgAdmin ? allSectorIds : user.sectorIds || (user.sectors || []).map((sector: any) => sector.id)
    });
    setMessage('');
  }

  async function createUser() {
    if (!form.name || !form.email || !form.password || !form.roleId) return;
    const sectorIds = formIsOrgAdmin ? allSectorIds : form.sectorIds;
    if (!sectorIds.length) { setMessage('Selecione pelo menos um setor para o usuario.'); return; }
    if (currentUser?.isSuperAdmin && !form.organizationId && !currentOrg?.id) { setMessage('Selecione a organizacao em que o usuario sera criado.'); return; }
    const confirmed = await confirm({
      title: 'Criar usuario?',
      description: `Confirma a criacao do usuario "${form.name}" com acesso ao e-mail ${form.email}?`,
      details: [
        formIsOrgAdmin ? 'Perfil Admin da Organizacao: acesso a todos os setores.' : `${sectorIds.length} setor(es) selecionado(s).`,
        currentUser?.isSuperAdmin ? `Organizacao: ${organizations.find((org: any) => org.id === form.organizationId)?.name || currentOrg?.name || 'selecionada'}` : `Organizacao: ${currentOrg?.name || 'atual'}`
      ],
      confirmLabel: 'Sim, criar usuario',
      tone: 'success'
    });
    if (!confirmed) return;
    setLoading(true);
    setMessage('');
    try {
      await api.users.create({ ...form, sectorIds, organizationId: form.organizationId || currentOrg?.id });
      setForm({ name: '', email: '', password: '', roleId: form.roleId, organizationId: form.organizationId, sectorIds });
      setMessage(formIsOrgAdmin ? 'Usuario criado como Admin da Organizacao com acesso a todos os setores.' : 'Usuario criado e vinculado aos setores selecionados.');
      await refetch();
      await confirm({
        title: 'Usuario criado',
        description: `O usuario "${form.name}" foi criado com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Nao foi possivel criar o usuario.');
    } finally {
      setLoading(false);
    }
  }

  async function saveUser() {
    if (!editing) return;
    const sectorIds = editIsOrgAdmin ? allSectorIds : editForm.sectorIds;
    if (!sectorIds.length) { setMessage('O usuario precisa ter pelo menos um setor.'); return; }
    const confirmed = await confirm({
      title: 'Salvar alteracoes do usuario?',
      description: `As permissoes e dados de "${editForm.name || editing.name}" serao atualizados.`,
      details: [
        editIsOrgAdmin ? 'Perfil Admin da Organizacao: acesso a todos os setores.' : `${sectorIds.length} setor(es) selecionado(s).`,
        editForm.password.trim() ? 'A senha tambem sera redefinida.' : 'A senha nao sera alterada.'
      ],
      confirmLabel: 'Sim, salvar',
      tone: 'warning'
    });
    if (!confirmed) return;
    setLoading(true);
    setMessage('');
    try {
      await api.users.update(editing.id, {
        name: editForm.name,
        email: editForm.email,
        status: editForm.status,
        roleId: editForm.roleId,
        organizationId: currentUser?.isSuperAdmin ? editForm.organizationId : undefined,
        fromOrganizationId: currentUser?.isSuperAdmin ? editForm.fromOrganizationId : undefined,
        sectorIds
      });
      if (editForm.password.trim()) await api.users.resetPassword(editing.id, { password: editForm.password.trim() });
      setMessage(editIsOrgAdmin ? 'Usuario atualizado com acesso a todos os setores.' : 'Usuario atualizado com sucesso.');
      setEditing(null);
      await refetch();
      await confirm({
        title: 'Usuario atualizado',
        description: `As alteracoes de "${editForm.name || editing.name}" foram salvas com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Nao foi possivel atualizar o usuario.');
    } finally {
      setLoading(false);
    }
  }

  async function removeUser(user: any) {
    const targetOrgId = currentUser?.isSuperAdmin ? userOrganization(user)?.id || selectedUserOrganizationId : undefined;
    const name = user.name;
    const confirmed = await confirm({
      title: 'Remover acesso do usuario?',
      description: `Tem certeza que deseja remover/inativar o acesso de "${name}" nesta organizacao?`,
      confirmLabel: 'Sim, remover',
      tone: 'danger'
    });
    if (!confirmed) return;
    try {
      await api.users.remove(user.id, targetOrgId ? { organizationId: targetOrgId } : {});
      setMessage('Usuario removido/inativado nesta organizacao.');
      await refetch();
      await confirm({
        title: 'Acesso removido',
        description: `O acesso de "${name}" foi removido/inativado com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Nao foi possivel remover o usuario.');
    }
  }

  return (
    <div className="space-y-6">
      <section className="dashboard-gallery-hero selection-hero selection-hero-users">
        <div className="dashboard-gallery-hero-content">
          <p className="eyebrow text-white/80">Easy BI Workspace</p>
          <h3>Gerencie acessos e permissoes</h3>
          <p>Cadastre usuarios, defina perfis e controle setores para liberar apenas os dados certos para cada pessoa.</p>
        </div>
        <div className="selection-hero-actions">
          <span className="selection-hero-pill"><Users size={15} /> {users.length} usuarios</span>
          <span className="selection-hero-pill"><ShieldCheck size={15} /> Perfis e setores</span>
        </div>
      </section>

      {currentUser?.isSuperAdmin && (
        <section className="card-premium p-5">
          <label className="grid gap-2 md:grid-cols-[220px_1fr] md:items-center">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Organizacao de trabalho</span>
            <select
              className="input"
              value={selectedUserOrganizationId}
              onChange={e => {
                setSelectedUserOrganizationId(e.target.value);
                setForm(current => ({ ...current, organizationId: e.target.value, sectorIds: [] }));
              }}
            >
              <option value="">Todas as organizacoes</option>
              {organizations.map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          </label>
          <p className="mt-3 text-xs font-semibold text-slate-500">O Admin Global pode criar, editar perfil, trocar organizacao de acesso e ajustar setores do usuario.</p>
        </section>
      )}

      <div className="space-y-6">
        <section className="card-premium p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary-soft p-3 text-primary"><UserPlus /></div>
            <div>
              <p className="text-lg font-black">Novo usuario</p>
              <p className="text-sm text-slate-500">Defina perfil, organizacao e setores.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {currentUser?.isSuperAdmin && (
              <select className="input lg:col-span-2" value={form.organizationId || currentOrg?.id || ''} onChange={e => setForm({ ...form, organizationId: e.target.value, sectorIds: [] })}>
                <option value="">Selecione a organizacao</option>
                {organizations.map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            )}
            <input className="input" placeholder="Nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="E-mail" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input type="password" autoComplete="new-password" className="input" placeholder="Senha inicial" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            <select
              className="input"
              value={form.roleId}
              onChange={e => {
                const nextRoleId = e.target.value;
                const nextIsOrgAdmin = isOrgAdminRole(roles, nextRoleId);
                setForm({ ...form, roleId: nextRoleId, sectorIds: nextIsOrgAdmin ? allSectorIds : form.sectorIds });
              }}
            >
              <option value="">Selecione o perfil</option>
              {roleOptions.map((role: any) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            <div className="lg:col-span-2">
              <SectorSelector
                sectors={sectors}
                value={formIsOrgAdmin ? allSectorIds : form.sectorIds}
                disabled={formIsOrgAdmin}
                allAccess={formIsOrgAdmin}
                onChange={(sectorIds) => setForm({ ...form, sectorIds })}
              />
            </div>
            <button onClick={createUser} disabled={loading || !sectors.length} className="btn-primary w-full justify-center disabled:opacity-50 lg:col-span-2">
              <ShieldCheck size={18} /> {loading ? 'Salvando...' : 'Criar usuario'}
            </button>
            {message && <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600 lg:col-span-2">{message}</p>}
          </div>
        </section>

        <section className="card-premium overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-black">Listagem de usuarios</p>
                <p className="text-sm text-slate-500">Filtre e edite perfil, setores, status e senha sem sair da pagina.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-primary-soft px-4 py-2 text-xs font-black text-primary">{filteredUsers.length} de {users.length}</span>
                <Users className="text-primary" />
              </div>
            </div>
            <div className="app-search-shell app-search-shell-compact mt-4">
              <div className="app-search-icon"><Search size={18} /></div>
              <label className="app-search-field">
                <span className="sr-only">Filtrar usuarios</span>
                <input
                  placeholder="Filtrar por nome, e-mail, org, perfil, setor ou status"
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Nome</th>
                  <th className="px-5 py-3">E-mail</th>
                  <th className="px-5 py-3">Org</th>
                  <th className="px-5 py-3">Setores</th>
                  <th className="px-5 py-3">Perfil</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user: any) => (
                  <tr key={user.id} className="hover:bg-primary-soft">
                    <td className="px-5 py-4 font-bold text-slate-900">{user.name}</td>
                    <td className="px-5 py-4 text-slate-500">{user.email}</td>
                    <td className="px-5 py-4 text-slate-500">{userOrganization(user)?.name || currentOrg?.name || '-'}</td>
                    <td className="px-5 py-4 text-slate-600">{sectorNames(user)}</td>
                    <td className="px-5 py-4 text-slate-700">{roleName(user)}</td>
                    <td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-600">{user.status}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(user)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:border-primary hover:bg-primary-soft hover:text-primary"><Edit3 size={15} /></button>
                        <button onClick={() => removeUser(user)} className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 hover:bg-red-100"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredUsers.length && <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500">Nenhum usuario encontrado para o filtro informado.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editing && createPortal((
        <div className="builder-modal-backdrop" role="dialog" aria-modal="true" aria-label="Editar usuario">
          <div className="builder-modal-panel max-w-[760px]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Usuario</p>
                <h3 className="mt-1 text-2xl font-black text-slate-950">Editar permissoes e setores</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Altere dados, perfil, status, setores ou defina uma nova senha.</p>
              </div>
              <button onClick={() => setEditing(null)} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="form-label">Nome</span>
                  <input className="form-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="form-label">E-mail</span>
                  <input className="form-input" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                </label>
                {currentUser?.isSuperAdmin && (
                  <label className="space-y-1 md:col-span-2">
                    <span className="form-label">Organizacao do acesso</span>
                    <select
                      className="form-select"
                      value={editForm.organizationId}
                      onChange={e => setEditForm({ ...editForm, organizationId: e.target.value, sectorIds: [] })}
                    >
                      <option value="">Selecione a organizacao</option>
                      {organizations.map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}
                    </select>
                  </label>
                )}
                <label className="space-y-1">
                  <span className="form-label">Perfil</span>
                  <select
                    className="form-select"
                    value={editForm.roleId}
                    onChange={e => {
                      const nextRoleId = e.target.value;
                      const nextIsOrgAdmin = isOrgAdminRole(roles, nextRoleId);
                      setEditForm({ ...editForm, roleId: nextRoleId, sectorIds: nextIsOrgAdmin ? allSectorIds : editForm.sectorIds });
                    }}
                  >
                    {roleOptions.map((role: any) => <option key={role.id} value={role.id}>{role.name}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="form-label">Status</span>
                  <select className="form-select" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                    <option value="BLOCKED">Bloqueado</option>
                  </select>
                </label>
                <div className="md:col-span-2">
                  <SectorSelector
                    sectors={sectors}
                    value={editIsOrgAdmin ? allSectorIds : editForm.sectorIds}
                    disabled={editIsOrgAdmin}
                    allAccess={editIsOrgAdmin}
                    onChange={(sectorIds) => setEditForm({ ...editForm, sectorIds })}
                  />
                </div>
                <label className="space-y-1 md:col-span-2">
                  <span className="form-label">Nova senha opcional</span>
                  <div className="flex gap-2">
                    <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4">
                      <KeyRound size={17} className="text-slate-400" />
                      <input
                        type="password"
                        autoComplete="new-password"
                        className="h-12 flex-1 bg-transparent text-sm font-bold outline-none"
                        value={editForm.password}
                        onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                        placeholder="Preencha somente se quiser resetar a senha"
                      />
                    </div>
                    <button type="button" onClick={() => setEditForm({ ...editForm, password: generateTemporaryPassword() })} className="btn-muted">Gerar senha</button>
                  </div>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <button onClick={() => setEditing(null)} className="btn-muted">Cancelar</button>
              <button onClick={saveUser} disabled={loading} className="btn-primary"><Save size={16} /> {loading ? 'Salvando...' : 'Salvar usuario'}</button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}
