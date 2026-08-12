import { useState } from 'react';
import { KeyRound, Layers3, Lock, Save, ShieldCheck, UserCircle } from 'lucide-react';
import { changePassword } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { useConfirm } from '../../components/ConfirmDialog';

function sectorNames(organization: any) {
  const sectors = organization?.sectors || [];
  if (!sectors.length) return organization?.role === 'SUPER_ADMIN' ? 'Todos os setores da organizacao' : 'Nenhum setor vinculado';
  return sectors.map((sector: any) => sector.name).join(', ');
}

export function ProfilePage() {
  const { user, organization } = useAuthStore();
  const confirm = useConfirm();
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
      setError('Preencha a senha atual, a nova senha e a confirmacao.');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setError('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('A confirmacao da nova senha nao confere.');
      return;
    }

    const confirmed = await confirm({
      title: 'Alterar senha?',
      description: 'Confirma a alteracao da sua senha de acesso?',
      details: ['Depois de salvar, use a nova senha nos proximos logins.'],
      confirmLabel: 'Sim, alterar senha',
      tone: 'warning'
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await changePassword(passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage(response?.message || 'Senha alterada com sucesso.');
      await confirm({
        title: 'Senha alterada',
        description: 'Sua senha foi alterada com sucesso.',
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nao foi possivel alterar a senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="profile-page space-y-5 sm:space-y-6">
      <section className="dashboard-gallery-hero selection-hero selection-hero-profile">
        <div className="dashboard-gallery-hero-content">
          <p className="eyebrow text-white/80">Easy BI Workspace</p>
          <h3>Perfil do usuario</h3>
          <p>Gerencie seus dados de acesso e confira organizacao, perfil e setores liberados.</p>
        </div>
        <div className="selection-hero-actions">
          <span className="selection-hero-pill"><UserCircle size={15} /> {user?.name || 'Usuario'}</span>
          <span className="selection-hero-pill"><ShieldCheck size={15} /> Conta protegida</span>
        </div>
      </section>

      <section className="card-premium w-full p-5 sm:p-8">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <div className="shrink-0 rounded-[1.5rem] bg-primary-soft p-4 text-primary sm:rounded-[2rem] sm:p-5">
              <UserCircle className="h-10 w-10 sm:h-12 sm:w-12" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-black text-slate-950 sm:text-2xl">{user?.name || 'Usuario'}</p>
              <p className="break-all text-sm font-semibold text-slate-500 sm:text-base">{user?.email}</p>
            </div>
          </div>
          <div className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 sm:w-auto">
            <ShieldCheck size={16} className="text-primary" /> Conta protegida
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:mt-8 sm:gap-4 md:grid-cols-3">
          <div className="min-w-0 rounded-3xl bg-slate-50 p-4 sm:p-5">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Organizacao ativa</p>
            <p className="mt-2 break-words font-black text-slate-950">{organization?.name || 'Global'}</p>
          </div>
          <div className="min-w-0 rounded-3xl bg-slate-50 p-4 sm:p-5">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Perfil</p>
            <p className="mt-2 break-words font-black text-slate-950">{organization?.role || (user?.isSuperAdmin ? 'SUPER_ADMIN' : '-')}</p>
          </div>
          <div className="min-w-0 rounded-3xl bg-slate-50 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400"><Layers3 size={15} className="shrink-0 text-primary" /> Setores</div>
            <p className="mt-2 break-words font-black text-slate-950">{sectorNames(organization)}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">A alteracao de setores e feita pelo Admin SaaS ou Admin da Organizacao no painel de Usuarios.</p>
          </div>
        </div>
      </section>

      <section className="card-premium w-full p-5 sm:p-8">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="shrink-0 rounded-2xl bg-slate-950 p-3 text-white"><Lock size={22} /></div>
          <div className="min-w-0">
            <p className="eyebrow text-xs">Seguranca</p>
            <h3 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">Alterar senha</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Os campos ficam mascarados com pontos para nao expor a senha na tela.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="min-w-0 space-y-1">
            <span className="form-label">Senha atual</span>
            <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-primary focus-within:ring-4 focus-within:ring-[var(--easy-ring)]">
              <KeyRound size={17} className="shrink-0 text-slate-400" />
              <input type="password" autoComplete="current-password" className="h-12 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none" value={passwordForm.currentPassword} onChange={(event) => patchPassword('currentPassword', event.target.value)} placeholder="********" />
            </div>
          </label>
          <label className="min-w-0 space-y-1">
            <span className="form-label">Nova senha</span>
            <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-primary focus-within:ring-4 focus-within:ring-[var(--easy-ring)]">
              <KeyRound size={17} className="shrink-0 text-slate-400" />
              <input type="password" autoComplete="new-password" className="h-12 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none" value={passwordForm.newPassword} onChange={(event) => patchPassword('newPassword', event.target.value)} placeholder="********" />
            </div>
          </label>
          <label className="min-w-0 space-y-1">
            <span className="form-label">Confirmar nova senha</span>
            <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-primary focus-within:ring-4 focus-within:ring-[var(--easy-ring)]">
              <KeyRound size={17} className="shrink-0 text-slate-400" />
              <input type="password" autoComplete="new-password" className="h-12 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none" value={passwordForm.confirmPassword} onChange={(event) => patchPassword('confirmPassword', event.target.value)} placeholder="********" />
            </div>
          </label>
        </div>

        <div className="mt-5 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            {message && <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</p>}
            {error && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-red-700">{error}</p>}
          </div>
          <button type="button" onClick={submitPasswordChange} disabled={loading} className="btn-primary w-full disabled:opacity-60 sm:w-auto"><Save size={16} /> {loading ? 'Alterando...' : 'Alterar senha'}</button>
        </div>
      </section>
    </div>
  );
}
