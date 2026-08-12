import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Building2, CheckCircle2, Image as ImageIcon, Palette, Search, ShieldAlert, Sparkles, UploadCloud } from 'lucide-react';
import { api } from '../../api/resources.api';
import { useAuthStore } from '../../store/auth.store';
import { planBlockedMessage, planFeature } from '../../utils/plan';
import { useConfirm } from '../../components/ConfirmDialog';

type ThemeOption = {
  accent: string;
  name: string;
  group: string;
  primary: string;
  secondary: string;
  soft: string;
  description: string;
};

const themes: ThemeOption[] = [
  { accent: 'PURPLE', name: 'Roxo premium', group: 'SaaS', primary: '#7C3AED', secondary: '#A855F7', soft: '#F3E8FF', description: 'Moderno, forte e sofisticado.' },
  { accent: 'VIOLET', name: 'Violeta tech', group: 'SaaS', primary: '#6D28D9', secondary: '#8B5CF6', soft: '#F5F3FF', description: 'Tecnológico com presença visual.' },
  { accent: 'INDIGO', name: 'Índigo corporate', group: 'Corporativo', primary: '#4F46E5', secondary: '#6366F1', soft: '#EEF2FF', description: 'BI executivo e confiável.' },
  { accent: 'BLUE', name: 'Azul executivo', group: 'Corporativo', primary: '#2563EB', secondary: '#0EA5E9', soft: '#EFF6FF', description: 'Clássico, seguro e empresarial.' },
  { accent: 'SKY', name: 'Azul céu', group: 'Corporativo', primary: '#0284C7', secondary: '#38BDF8', soft: '#F0F9FF', description: 'Leve, limpo e moderno.' },
  { accent: 'CYAN', name: 'Ciano data', group: 'Tecnologia', primary: '#0891B2', secondary: '#22D3EE', soft: '#ECFEFF', description: 'Visual de dados e operação.' },
  { accent: 'TEAL', name: 'Teal analytics', group: 'Tecnologia', primary: '#0F766E', secondary: '#2DD4BF', soft: '#F0FDFA', description: 'Premium, técnico e elegante.' },
  { accent: 'GREEN', name: 'Verde growth', group: 'Operação', primary: '#059669', secondary: '#10B981', soft: '#ECFDF5', description: 'Crescimento, vendas e metas.' },
  { accent: 'EMERALD', name: 'Esmeralda', group: 'Operação', primary: '#047857', secondary: '#34D399', soft: '#ECFDF5', description: 'Sofisticado e positivo.' },
  { accent: 'LIME', name: 'Lima performance', group: 'Operação', primary: '#65A30D', secondary: '#A3E635', soft: '#F7FEE7', description: 'Energia para indicadores.' },
  { accent: 'YELLOW', name: 'Amarelo gestão', group: 'Comercial', primary: '#CA8A04', secondary: '#FACC15', soft: '#FEFCE8', description: 'Destaque sem perder seriedade.' },
  { accent: 'AMBER', name: 'Âmbar premium', group: 'Comercial', primary: '#D97706', secondary: '#F59E0B', soft: '#FFFBEB', description: 'Quente, elegante e comercial.' },
  { accent: 'ORANGE', name: 'Laranja Easy BI', group: 'Comercial', primary: '#EA580C', secondary: '#FB923C', soft: '#FFF7ED', description: 'Identidade original do produto.' },
  { accent: 'RED', name: 'Vermelho power', group: 'Impacto', primary: '#DC2626', secondary: '#F87171', soft: '#FEF2F2', description: 'Alta atenção e decisão rápida.' },
  { accent: 'ROSE', name: 'Rose premium', group: 'Impacto', primary: '#E11D48', secondary: '#FB7185', soft: '#FFF1F2', description: 'Elegante, moderno e marcante.' },
  { accent: 'PINK', name: 'Pink brand', group: 'Impacto', primary: '#DB2777', secondary: '#F472B6', soft: '#FDF2F8', description: 'Criativo e diferenciado.' },
  { accent: 'FUCHSIA', name: 'Fúcsia neon', group: 'Impacto', primary: '#C026D3', secondary: '#E879F9', soft: '#FDF4FF', description: 'Futurista e chamativo.' },
  { accent: 'SLATE', name: 'Grafite executivo', group: 'Neutros', primary: '#334155', secondary: '#64748B', soft: '#F1F5F9', description: 'Neutro para áreas administrativas.' },
  { accent: 'ZINC', name: 'Zinco minimalista', group: 'Neutros', primary: '#3F3F46', secondary: '#71717A', soft: '#F4F4F5', description: 'Minimalista estilo enterprise.' },
  { accent: 'STONE', name: 'Stone sofisticado', group: 'Neutros', primary: '#57534E', secondary: '#78716C', soft: '#F5F5F4', description: 'Off-white, discreto e premium.' }
];

const groups = Array.from(new Set(themes.map((theme) => theme.group)));

function currentAccent(organization: any) {
  const accent = String(organization?.themeConfig?.accent || organization?.themeConfig?.brand || 'PURPLE').toUpperCase();
  return themes.some((theme) => theme.accent === accent) ? accent : 'PURPLE';
}

function brandImageUrl(value?: string) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
  const origin = apiBase.replace(/\/api\/?$/i, '').replace(/\/$/, '');
  return `${origin}${value.startsWith('/') ? value : `/${value}`}`;
}

export function AppearancePage() {
  const { user, organization, updateCurrentOrganization } = useAuthStore();
  const confirm = useConfirm();
  const [selected, setSelected] = useState(currentAccent(organization));
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('TODAS');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const canEdit = Boolean(user?.isSuperAdmin || organization?.role === 'ORG_ADMIN' || organization?.role === 'SUPER_ADMIN');
  const canUseCustomLogo = planFeature(organization, 'canUseCustomLogo');
  const selectedTheme = useMemo(() => themes.find((item) => item.accent === selected) || themes[0], [selected]);
  const organizationLogo = brandImageUrl(organization?.themeConfig?.brandImageUrl);

  const filteredThemes = useMemo(() => {
    const search = query.trim().toLowerCase();
    return themes.filter((theme) => {
      const matchesGroup = group === 'TODAS' || theme.group === group;
      const matchesSearch = !search || `${theme.name} ${theme.group} ${theme.description}`.toLowerCase().includes(search);
      return matchesGroup && matchesSearch;
    });
  }, [query, group]);

  useEffect(() => {
    const accent = currentAccent(organization);
    setSelected(accent);
    document.documentElement.dataset.accent = accent;
  }, [organization?.id, organization?.themeConfig?.accent]);

  function previewTheme(accent: string) {
    setSelected(accent);
    document.documentElement.dataset.accent = accent;
    setMessage('Pré-visualização aplicada. Clique em Salvar aparência para gravar na organização.');
  }

  async function save() {
    if (!organization?.id) {
      setMessage('Selecione uma organização para personalizar a aparência.');
      return;
    }

    const confirmed = await confirm({
      title: 'Salvar aparencia?',
      description: `A identidade visual da organizacao "${organization.name}" sera alterada para "${selectedTheme.name}".`,
      confirmLabel: 'Sim, salvar aparencia',
      tone: 'warning'
    });
    if (!confirmed) return;

    try {
      const updated = await api.organizations.update(organization.id, {
        themeConfig: {
          ...(organization.themeConfig || {}),
          accent: selectedTheme.accent,
          primary: selectedTheme.primary,
          secondary: selectedTheme.secondary,
          soft: selectedTheme.soft
        }
      });

      updateCurrentOrganization({ themeConfig: updated.themeConfig });
      document.documentElement.dataset.accent = selectedTheme.accent;
      setMessage(`Aparência salva com a cor ${selectedTheme.name}. Essa identidade será aplicada para os usuários dessa organização.`);
      await confirm({
        title: 'Aparencia salva',
        description: `A cor "${selectedTheme.name}" foi aplicada com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível salvar a aparência.');
    }
  }

  async function uploadBrandImage(file?: File | null) {
    if (!file || !organization?.id) return;
    if (!canEdit) {
      setMessage('Apenas Super Admin ou Admin da OrganizaÃ§Ã£o pode enviar a imagem da marca.');
      return;
    }

    if (!canUseCustomLogo) {
      setMessage(planBlockedMessage(organization, 'usar logo personalizado'));
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setMessage('Envie uma imagem PNG, JPG ou WEBP.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage('A imagem deve ter atÃ© 2MB.');
      return;
    }

    const confirmed = await confirm({
      title: 'Enviar logo da organizacao?',
      description: `Confirma enviar "${file.name}" para aparecer ao lado do logo Easy BI da organizacao "${organization.name}"?`,
      confirmLabel: 'Sim, enviar imagem',
      tone: 'warning'
    });
    if (!confirmed) return;

    setUploadingLogo(true);
    setMessage('');

    try {
      const form = new FormData();
      form.append('file', file);
      const updated = await api.organizations.uploadBrandImage(organization.id, form);
      updateCurrentOrganization({ themeConfig: updated.themeConfig });
      await confirm({
        title: 'Logo salvo',
        description: 'A imagem da organizacao foi salva com sucesso.',
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
      setMessage('Imagem da organizaÃ§Ã£o salva. Ela aparecerÃ¡ ao lado direito do logo Easy BI.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'NÃ£o foi possÃ­vel enviar a imagem da organizaÃ§Ã£o.');
    } finally {
      setUploadingLogo(false);
    }
  }

  const previewStyle = {
    '--appearance-primary': selectedTheme.primary,
    '--appearance-secondary': selectedTheme.secondary,
    '--appearance-soft': selectedTheme.soft
  } as CSSProperties;

  return (
    <div className="space-y-6">
      <section className="dashboard-gallery-hero selection-hero selection-hero-appearance">
        <div className="dashboard-gallery-hero-content">
          <p className="eyebrow text-white/80">Easy BI Workspace</p>
          <h3>Aparencia da organizacao</h3>
          <p>Escolha a identidade visual da empresa. A cor selecionada muda menu, botoes, filtros, dashboards, graficos, cards, gradientes e destaques.</p>
        </div>
        <div className="selection-hero-actions">
          <span className="selection-hero-pill"><Palette size={15} /> {selectedTheme.name}</span>
          <span className="selection-hero-pill"><Building2 size={15} /> {organization?.name || 'Organizacao'}</span>
        </div>
      </section>

      {!canEdit && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 text-sm font-bold text-yellow-900">
          <ShieldAlert className="mb-2" /> Apenas Super Admin ou Admin da Organização pode alterar aparência.
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700 shadow-sm">
          {message}
        </div>
      )}

      <section className="appearance-shell">
        <div className="appearance-preview-panel" style={previewStyle}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="appearance-preview-icon"><Building2 size={22} /></div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-white/70">Organização</p>
                <p className="mt-1 text-2xl font-black text-white">{organization?.name || 'Nenhuma organização selecionada'}</p>
                <p className="mt-1 text-sm font-semibold text-white/75">Prévia ativa: {selectedTheme.name}</p>
              </div>
            </div>

            <button disabled={!canEdit || !organization?.id} onClick={save} className="appearance-save-btn disabled:opacity-50">
              <CheckCircle2 size={18} /> Salvar aparência
            </button>
          </div>

          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            <div className="appearance-preview-card">
              <p className="appearance-preview-label">Ação principal</p>
              <button className="appearance-demo-button">Botão da empresa</button>
            </div>

            <div className="appearance-preview-card">
              <p className="appearance-preview-label">Gráfico</p>
              <div className="mt-4 flex h-24 items-end gap-2">
                <span className="h-9 flex-1 rounded-t-xl bg-white/35" />
                <span className="h-16 flex-1 rounded-t-xl bg-white/80" />
                <span className="h-12 flex-1 rounded-t-xl bg-white/50" />
                <span className="h-20 flex-1 rounded-t-xl bg-white" />
              </div>
            </div>

            <div className="appearance-preview-card">
              <p className="appearance-preview-label">Status</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="appearance-demo-pill">Região</span>
                <span className="appearance-demo-pill-active">Status</span>
                <span className="appearance-demo-pill">Produto</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <section className="mb-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white p-3 text-primary shadow-sm"><ImageIcon size={20} /></div>
                <div>
                  <p className="text-lg font-black text-slate-950">Imagem ao lado do Easy BI</p>
                  <p className="text-sm font-semibold text-slate-500">Envie a marca da organizaÃ§Ã£o para aparecer no canto direito do logo do sistema.</p>
                </div>
              </div>

              <label className={`btn-primary cursor-pointer ${(!canEdit || !canUseCustomLogo || !organization?.id || uploadingLogo) ? 'pointer-events-none opacity-50' : ''}`}>
                <UploadCloud size={18} />
                {uploadingLogo ? 'Enviando...' : 'Enviar imagem'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={!canEdit || !canUseCustomLogo || !organization?.id || uploadingLogo}
                  onChange={(event) => {
                    uploadBrandImage(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
            {!canUseCustomLogo && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-700">O plano atual nao permite logo personalizado. O Super Admin pode alterar o plano da organizacao.</p>}

            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-white bg-white p-4">
              <div className="easybi-brand-lock max-w-sm">
                <div className="easybi-brand-mark" aria-hidden="true"><span>BI</span></div>
                <div className="easybi-brand-copy">
                  <div className="easybi-brand-title">
                    <span className="easybi-brand-title-dark">Easy</span>
                    <span className="easybi-brand-title-accent">BI</span>
                  </div>
                  <span className="easybi-brand-subtitle">Insights</span>
                </div>
                {organizationLogo && (
                  <div className="easybi-brand-org-logo">
                    <img src={organizationLogo} alt={organization?.name ? `Logo ${organization.name}` : 'Logo da organizaÃ§Ã£o'} />
                  </div>
                )}
              </div>
              <p className="max-w-xl text-sm font-semibold leading-6 text-slate-500">
                Use uma imagem com fundo transparente para ficar mais elegante. Se nenhuma imagem for enviada, o logo Easy BI continua sozinho.
              </p>
            </div>
          </section>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary-soft p-3 text-primary"><Sparkles /></div>
              <div>
                <p className="text-lg font-black text-slate-950">Selecione a cor da empresa</p>
                <p className="text-sm font-semibold text-slate-500">Agora há mais opções para personalizar cada organização.</p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row">
              <label className="app-search-field app-search-field-compact min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="form-input pl-10"
                  placeholder="Buscar cor ou estilo"
                />
              </label>
              <select value={group} onChange={(event) => setGroup(event.target.value)} className="form-select min-w-[190px]">
                <option value="TODAS">Todas as categorias</option>
                {groups.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredThemes.map((theme) => {
              const active = selected === theme.accent;
              return (
                <button
                  key={theme.accent}
                  disabled={!canEdit}
                  onClick={() => previewTheme(theme.accent)}
                  className={`appearance-theme-card ${active ? 'appearance-theme-card-active' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="appearance-swatch" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }} />
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{theme.group}</span>
                  </div>
                  <p className="mt-4 text-base font-black text-slate-950">{theme.name}</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{theme.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
