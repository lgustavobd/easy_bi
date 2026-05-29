import { useState } from 'react';
import { KeyRound, Layers3, Lock, Save, ShieldCheck, UserCircle } from 'lucide-react';
import { changePassword } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';

function sectorNames(organization: any) {
  const sectors = organization?.sectors || [];
  if (!sectors.length) return organization?.role === 'SUPER_ADMIN' ? 'Todos os setores da organização' : 'Nenhum setor vinculado';
  return sectors.map((sector: any) => sector.name).join(', ');
}

export function ProfilePage() {
  const { user, organization } = useAuthStore();
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function patchPassword(field: keyof typeof passwordForm, value: string) {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    setMessage('');
    setError('');
  }

  async function submitPasswordChange() {
    setMessage('');
    setError('');

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError('Preencha a senha atual, a nova senha e a confirmação.');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('A confirmação da nova senha não confere.');
      return;
    }

    setLoading(true);
    try {
      const response = await changePassword(passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage(response?.message || 'Senha alterada com sucesso.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Não foi possível alterar a senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Conta</p>
        <h2 className="page-title">Perfil do usuário</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500">Gerencie seus dados de acesso e confira organização, perfil e setores liberados.</p>
      </div>

      <section className="card-premium max-w-5xl p-8">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            <div className="rounded-[2rem] bg-primary-soft p-5 text-primary"><UserCircle size={48} /></div>
            <div>
              <p className="text-2xl font-black text-slate-950">{user?.name}</p>
              <p className="font-semibold text-slate-500">{user?.email}</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500">
            <ShieldCheck size={16} className="text-primary" /> Conta protegida
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Organização ativa</p>
            <p className="mt-2 font-black text-slate-950">{organization?.name || 'Global'}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Perfil</p>
            <p className="mt-2 font-black text-slate-950">{organization?.role || (user?.isSuperAdmin ? 'SUPER_ADMIN' : '-')}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400"><Layers3 size={15} className="text-primary" /> Setores</div>
            <p className="mt-2 font-black text-slate-950">{sectorNames(organization)}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">A alteração de setores é feita pelo Admin SaaS ou Admin da Organização no painel de Usuários.</p>
          </div>
        </div>
      </section>

      <section className="card-premium max-w-5xl p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-slate-950 p-3 text-white"><Lock size={22} /></div>
          <div>
            <p className="eyebrow text-xs">Segurança</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">Alterar senha</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Os campos ficam mascarados com pontos para não expor a senha na tela.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="space-y-1"><span className="form-label">Senha atual</span><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-primary focus-within:ring-4 focus-within:ring-[var(--easy-ring)]"><KeyRound size={17} className="text-slate-400" /><input type="password" autoComplete="current-password" className="h-12 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none" value={passwordForm.currentPassword} onChange={(event) => patchPassword('currentPassword', event.target.value)} placeholder="••••••••" /></div></label>
          <label className="space-y-1"><span className="form-label">Nova senha</span><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-primary focus-within:ring-4 focus-within:ring-[var(--easy-ring)]"><KeyRound size={17} className="text-slate-400" /><input type="password" autoComplete="new-password" className="h-12 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none" value={passwordForm.newPassword} onChange={(event) => patchPassword('newPassword', event.target.value)} placeholder="••••••••" /></div></label>
          <label className="space-y-1"><span className="form-label">Confirmar nova senha</span><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-primary focus-within:ring-4 focus-within:ring-[var(--easy-ring)]"><KeyRound size={17} className="text-slate-400" /><input type="password" autoComplete="new-password" className="h-12 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none" value={passwordForm.confirmPassword} onChange={(event) => patchPassword('confirmPassword', event.target.value)} placeholder="••••••••" /></div></label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            {message && <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</p>}
            {error && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-red-700">{error}</p>}
          </div>
          <button type="button" onClick={submitPasswordChange} disabled={loading} className="btn-primary disabled:opacity-60"><Save size={16} /> {loading ? 'Alterando...' : 'Alterar senha'}</button>
        </div>
      </section>
    </div>
  );
}
