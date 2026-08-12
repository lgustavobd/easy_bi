import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { GLOBAL_ADMIN_ORGANIZATION, useAuthStore } from '../../store/auth.store';

function accentOf(org: any) {
  return String(org?.themeConfig?.accent || 'PURPLE').toUpperCase();
}

export function SelectOrganizationPage() {
  const { organizations, setOrganization, user } = useAuthStore();
  const navigate = useNavigate();
  const cards = user?.isSuperAdmin ? [GLOBAL_ADMIN_ORGANIZATION] : organizations;

  useEffect(() => {
    document.documentElement.dataset.accent = 'ORANGE';
  }, []);

  return (
    <div className="auth-static-orange easy-gradient min-h-screen p-8">
      <Logo />
      <div className="mx-auto mt-10 max-w-5xl">
        <section className="dashboard-gallery-hero selection-hero selection-hero-workspace">
          <div className="dashboard-gallery-hero-content">
            <p className="eyebrow text-white/80">Easy BI Workspace</p>
            <h3>Escolha a organizacao</h3>
            <p>No Easy BI, cada organizacao tem dados, usuarios, dashboards, temas e permissoes isoladas.</p>
          </div>
          <div className="selection-hero-actions">
            <span className="selection-hero-pill"><Building2 size={15} /> {cards.length} workspace(s)</span>
          </div>
        </section>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(org => (
            <button key={org.id || 'global'} onClick={() => { setOrganization(org as any); document.documentElement.dataset.accent = accentOf(org); navigate(org.id ? '/' : '/admin-dashboard'); }} className="glass-card p-6 text-left transition hover:-translate-y-1 hover:shadow-lg">
              <p className="text-xl font-black text-slate-950">{org.name}</p>
              <p className="mt-2 text-sm font-semibold text-primary">{org.role}</p>
              <p className="mt-4 text-sm text-slate-500">{org.id ? 'Entrar na organizacao com isolamento de dados.' : 'Criar organizacoes, admins e usuarios sem acessar dados das empresas.'}</p>
            </button>
          ))}
          {!cards.length && <div className="glass-card p-6 text-sm font-bold text-slate-500">Nenhuma organizacao vinculada ao seu usuario.</div>}
        </div>
      </div>
    </div>
  );
}
