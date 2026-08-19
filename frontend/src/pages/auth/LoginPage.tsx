import { FormEvent, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BarChart3, Building2, Database, FileText, LockKeyhole, Mail, Phone, ShieldCheck, Sparkles, UserRound, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/resources.api';
import { login } from '../../api/auth.api';
import { Logo } from '../../components/Logo';
import { useAuthStore } from '../../store/auth.store';

function planPrice(plan: any) {
  if (plan?.priceLabel && Number(plan?.monthlyPrice || 0) === 0) return plan.priceLabel;
  if (plan?.monthlyPrice === null || plan?.monthlyPrice === undefined) return plan?.priceLabel || 'Sob consulta';
  return Number(plan.monthlyPrice).toLocaleString('pt-BR', { style: 'currency', currency: plan.currency || 'BRL' });
}

const fallbackShowcasePlans = [
  {
    id: 'free-preview',
    name: 'Free',
    monthlyPrice: 0,
    priceLabel: 'Gratis',
    currency: 'BRL',
    trialDays: 7,
    limits: { maxUsers: 1, maxDatasets: 2, maxDashboards: 1, maxTotalRows: 200 },
    features: { canUsePatchRows: true }
  },
  {
    id: 'starter-preview',
    name: 'Starter',
    monthlyPrice: 148.5,
    currency: 'BRL',
    limits: { maxUsers: 1, maxDatasets: 5, maxDashboards: 3, maxTotalRows: 2000 },
    features: { canUsePatchRows: true }
  },
  {
    id: 'essential-preview',
    name: 'Essencial',
    monthlyPrice: 249,
    currency: 'BRL',
    limits: { maxUsers: 3, maxDatasets: 8, maxDashboards: 5, maxTotalRows: 5000 },
    features: { canExportCharts: true, canUseCalculatedMetrics: true, canUsePatchRows: true, canUseAppendRows: true, canCreateSectors: true }
  },
  {
    id: 'pro-preview',
    name: 'Pro',
    monthlyPrice: 373.5,
    currency: 'BRL',
    limits: { maxUsers: 5, maxDatasets: 25, maxDashboards: 15, maxTotalRows: 5000 },
    features: { canExportCharts: true, canUseCalculatedMetrics: true, canUsePatchRows: true, canUseAppendRows: true, canCreateSectors: true }
  },
  {
    id: 'business-preview',
    name: 'Business',
    monthlyPrice: 748.5,
    currency: 'BRL',
    limits: { maxUsers: 10, maxDatasets: 100, maxDashboards: 60, maxTotalRows: 11000 },
    features: { canExportCharts: true, canUseCalculatedMetrics: true, canUsePatchRows: true, canUseAppendRows: true, canUseCustomLogo: true, canCreateSectors: true }
  }
];

function planSummary(plan: any) {
  const trial = plan?.trialDays ? `${plan.trialDays} dias de teste` : null;
  const users = plan?.limits?.maxUsers ? `${plan.limits.maxUsers} usuarios` : 'Usuarios ilimitados';
  const datasets = plan?.limits?.maxDatasets ? `${plan.limits.maxDatasets} bases` : 'Bases ilimitadas';
  const dashboards = plan?.limits?.maxDashboards ? `${plan.limits.maxDashboards} dashboards` : 'Dashboards ilimitados';
  const rows = plan?.limits?.maxTotalRows ? `${Number(plan.limits.maxTotalRows).toLocaleString('pt-BR')} linhas totais` : 'Linhas totais ilimitadas';
  return [trial, users, datasets, dashboards, rows].filter(Boolean);
}

function planHighlights(plan: any) {
  const features = plan?.features || {};
  return [
    features.canUseCalculatedMetrics && 'Metricas calculadas',
    features.canUsePatchRows && 'Atualizacao por linhas',
    features.canUseAppendRows && 'Inclusao de dados',
    features.canExportCharts && 'Exportacao de graficos e dashboards',
    features.canUseCustomLogo && 'Logo personalizado',
    features.canCreateSectors && 'Setores extras',
    features.canUseDatabaseConnections && 'Conexao com bancos',
    plan?.requiresDedicatedInfra && 'Infra apartada'
  ].filter(Boolean).slice(0, 3);
}

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore(s => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [requestForm, setRequestForm] = useState({
    requesterName: '',
    requesterEmail: '',
    phone: '',
    companyName: '',
    document: '',
    requestedPlanId: '',
    message: ''
  });
  const { data: publicPlans = [] } = useQuery({ queryKey: ['public-plans'], queryFn: api.plans.publicList });
  const showcasePlans = (publicPlans.length ? publicPlans : fallbackShowcasePlans).slice(0, 6);
  const planCount = Math.max(showcasePlans.length, 1);
  const [activePlanIndex, setActivePlanIndex] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.accent = 'ORANGE';
  }, []);

  useEffect(() => {
    setActivePlanIndex(0);
    if (showcasePlans.length <= 1) return;
    const timer = window.setInterval(() => {
      setActivePlanIndex(current => (current + 1) % showcasePlans.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [showcasePlans.length]);

  useEffect(() => {
    if (!requestForm.requestedPlanId && publicPlans.length) {
      setRequestForm(current => ({ ...current, requestedPlanId: publicPlans[0].id }));
    }
  }, [publicPlans, requestForm.requestedPlanId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setErrorModalOpen(false);
    try {
      const data = await login(email, password);
      setSession(data);
      if (data.user.isSuperAdmin || data.organizations.length !== 1) navigate('/select-organization');
      else {
        useAuthStore.getState().setOrganization(data.organizations[0]);
        navigate('/');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'E-mail ou senha invalidos.');
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleAccessRequest(event: FormEvent) {
    event.preventDefault();
    if (!requestForm.requesterName || !requestForm.requesterEmail || !requestForm.companyName) {
      setRequestMessage('Preencha nome, e-mail e empresa para enviar a solicitacao.');
      return;
    }
    setRequestLoading(true);
    setRequestMessage('');
    try {
      await api.accessRequests.create(requestForm);
      setRequestForm({
        requesterName: '',
        requesterEmail: '',
        phone: '',
        companyName: '',
        document: '',
        requestedPlanId: publicPlans[0]?.id || '',
        message: ''
      });
      setRequestSent(true);
      setRequestMessage('Solicitacao enviada. O Admin Geral vai analisar e liberar o acesso quando aprovar.');
    } catch (err: any) {
      setRequestMessage(err?.response?.data?.message || 'Nao foi possivel enviar a solicitacao.');
    } finally {
      setRequestLoading(false);
    }
  }

  function patchRequest(payload: Partial<typeof requestForm>) {
    setRequestForm(current => ({ ...current, ...payload }));
  }

  function openRequestModal() {
    setRequestSent(false);
    setRequestMessage('');
    setRequestModalOpen(true);
  }

  return (
    <main className="easy-login-page">
      <style>{`
        .easy-login-page {
          --login-ink: #07111f;
          --login-muted: #64748b;
          --login-line: #dbe4ef;
          --login-blue: #11386b;
          --login-orange: #f97316;
          height: 100vh;
          overflow: hidden;
          color: var(--login-ink);
          background: #f8fafc;
        }

        .easy-login-shell {
          height: 100vh;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(430px, 38vw) minmax(0, 1fr);
        }

        .easy-login-form-side {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          gap: 24px;
          padding: 36px clamp(34px, 4vw, 64px);
          height: 100vh;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%);
          border-right: 1px solid rgba(148, 163, 184, 0.22);
          box-shadow: 24px 0 70px rgba(15, 23, 42, 0.08);
        }

        .easy-login-brand {
          width: 100%;
          max-width: 410px;
          justify-self: center;
          display: flex;
          align-items: center;
        }

        .easy-login-brand .easybi-brand-lock {
          width: auto !important;
          min-height: auto !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .easy-login-form-card {
          width: 100%;
          max-width: 410px;
          align-self: center;
          justify-self: center;
          padding-top: 0;
        }

        .easy-login-secure {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
          color: #0f5fb8;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .easy-login-title {
          margin: 22px 0 0;
          color: var(--login-ink);
          font-size: clamp(36px, 4vw, 52px);
          line-height: 1.02;
          letter-spacing: 0;
          font-weight: 950;
        }

        .easy-login-copy {
          margin: 14px 0 0;
          color: var(--login-muted);
          font-size: 15px;
          line-height: 1.75;
          font-weight: 650;
        }

        .easy-login-fields {
          display: grid;
          gap: 18px;
          margin-top: 34px;
        }

        .easy-login-fields.compact {
          gap: 12px;
          margin-top: 22px;
        }

        .easy-login-label {
          display: grid;
          gap: 8px;
          color: #172033;
          font-size: 13px;
          font-weight: 850;
        }

        .easy-login-input-wrap {
          position: relative;
        }

        .easy-login-input-wrap svg {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .easy-login-input {
          width: 100%;
          height: 56px;
          padding: 0 16px 0 48px;
          border: 1px solid var(--login-line);
          border-radius: 16px;
          background: white;
          color: var(--login-ink);
          font-size: 14px;
          font-weight: 750;
          outline: none;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }

        .easy-login-select,
        .easy-login-textarea {
          width: 100%;
          border: 1px solid var(--login-line);
          border-radius: 16px;
          background: white;
          color: var(--login-ink);
          font-size: 14px;
          font-weight: 750;
          outline: none;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }

        .easy-login-select {
          height: 56px;
          padding: 0 16px;
        }

        .easy-login-textarea {
          min-height: 86px;
          resize: vertical;
          padding: 14px 16px;
          line-height: 1.5;
        }

        .easy-login-input:focus,
        .easy-login-select:focus,
        .easy-login-textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.11);
        }

        .easy-login-error,
        .easy-login-success {
          margin: 16px 0 0;
          border-radius: 14px;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 850;
        }

        .easy-login-error {
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #dc2626;
        }

        .easy-login-success {
          border: 1px solid #fed7aa;
          background: #fff7ed;
          color: #c2410c;
        }

        .easy-login-button {
          width: 100%;
          height: 58px;
          margin-top: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 0;
          border-radius: 16px;
          color: white;
          background: linear-gradient(135deg, #fb923c 0%, #f97316 46%, #ea580c 100%);
          box-shadow: 0 18px 38px rgba(249, 115, 22, 0.28);
          font-size: 14px;
          font-weight: 950;
          cursor: pointer;
          transition: transform 160ms ease, box-shadow 160ms ease, filter 160ms ease;
        }

        .easy-login-plan-carousel {
          position: relative;
          overflow: hidden;
          height: clamp(154px, 22vh, 210px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 28px;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06)),
            rgba(255, 255, 255, 0.08);
          box-shadow: 0 24px 70px rgba(124, 45, 18, 0.22);
          backdrop-filter: blur(18px);
        }

        .easy-login-plan-carousel::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
          transform: translateX(-100%);
          animation: easyLoginShimmer 4.8s ease-in-out infinite;
          pointer-events: none;
        }

        .easy-login-carousel-track {
          display: flex;
          height: 100%;
          width: calc(var(--plan-count, 3) * 100%);
          transition: transform 720ms cubic-bezier(.72, 0, .28, 1);
          will-change: transform;
        }

        .easy-login-plan-slide {
          width: calc(100% / var(--plan-count, 3));
          height: 100%;
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1.02fr) minmax(190px, 0.78fr);
          gap: clamp(12px, 1.4vw, 18px);
          padding: clamp(14px, 1.8vh, 20px);
        }

        .easy-login-plan-slide-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .easy-login-plan-slide-kicker {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 7px 11px;
          color: #7c2d12;
          background: #ffedd5;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .easy-login-plan-slide h3 {
          margin: 9px 0 0;
          color: white;
          font-size: clamp(19px, 1.8vw, 24px);
          line-height: 1;
          font-weight: 950;
        }

        .easy-login-plan-price {
          width: fit-content;
          margin-top: 8px;
          border-radius: 18px;
          padding: 7px 12px;
          color: #431407;
          background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 55%, #fdba74 100%);
          box-shadow: 0 16px 36px rgba(67, 20, 7, 0.2), inset 0 1px 0 rgba(255,255,255,0.76);
          font-size: clamp(20px, 2vw, 25px);
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .easy-login-plan-limits {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
        }

        .easy-login-plan-limits span {
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 999px;
          padding: 6px 9px;
          color: rgba(255, 247, 237, 0.9);
          background: rgba(255,255,255,0.1);
          font-size: 10px;
          font-weight: 900;
        }

        .easy-login-plan-features {
          display: grid;
          gap: 5px;
          max-height: 42px;
          margin-top: 9px;
          overflow: hidden;
        }

        .easy-login-plan-features span {
          color: rgba(255, 247, 237, 0.86);
          font-size: 11px;
          font-weight: 850;
        }

        .easy-login-slide-visual {
          position: relative;
          height: 100%;
          min-height: 0;
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 22px;
          overflow: hidden;
          background:
            radial-gradient(circle at 22% 18%, rgba(255,255,255,0.28), transparent 25%),
            linear-gradient(145deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08));
        }

        .easy-login-slide-visual::after {
          content: "";
          position: absolute;
          width: 92px;
          height: 92px;
          right: -24px;
          bottom: -30px;
          border: 18px solid rgba(255,255,255,0.84);
          border-top-color: rgba(253, 186, 116, 0.5);
          border-radius: 50%;
          animation: easyLoginSpin 8s linear infinite;
        }

        .easy-login-slide-window {
          position: absolute;
          inset: 16px 18px 18px 16px;
          display: grid;
          grid-template-rows: auto 1fr;
          gap: 12px;
        }

        .easy-login-window-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .easy-login-window-head span {
          width: 58%;
          height: 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.74);
        }

        .easy-login-window-head small {
          width: 40px;
          height: 20px;
          border-radius: 999px;
          background: rgba(255,255,255,0.28);
        }

        .easy-login-window-bars {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          align-items: end;
          gap: 8px;
        }

        .easy-login-window-bars span {
          border-radius: 999px 999px 8px 8px;
          background: linear-gradient(180deg, #fff7ed 0%, #fed7aa 100%);
          animation: easyMiniBar 2.6s ease-in-out infinite;
        }

        .easy-login-window-bars span:nth-child(2) { animation-delay: .12s; }
        .easy-login-window-bars span:nth-child(3) { animation-delay: .24s; }
        .easy-login-window-bars span:nth-child(4) { animation-delay: .36s; }
        .easy-login-window-bars span:nth-child(5) { animation-delay: .48s; }

        .easy-login-button:hover {
          transform: translateY(-1px);
          filter: saturate(1.05);
          box-shadow: 0 22px 46px rgba(249, 115, 22, 0.34);
        }

        .easy-login-button:disabled {
          cursor: not-allowed;
          opacity: 0.68;
          transform: none;
        }

        .easy-login-secondary-button {
          width: 100%;
          height: 52px;
          margin-top: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 1px solid #fed7aa;
          border-radius: 16px;
          color: #c2410c;
          background: #fff7ed;
          font-size: 13px;
          font-weight: 950;
          cursor: pointer;
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
        }

        .easy-login-secondary-button:hover {
          transform: translateY(-1px);
          border-color: #fdba74;
          background: #ffedd5;
        }

        .easy-login-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: grid;
          place-items: center;
          padding: 22px;
          background: rgba(15, 23, 42, 0.52);
          backdrop-filter: blur(14px);
        }

        .easy-login-modal-card {
          width: min(760px, 100%);
          max-height: min(92vh, 820px);
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.72);
          border-radius: 28px;
          background: linear-gradient(180deg, #ffffff 0%, #fff7ed 100%);
          box-shadow: 0 30px 90px rgba(15, 23, 42, 0.28);
        }

        .easy-login-modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding: 24px 26px 18px;
          border-bottom: 1px solid rgba(219, 228, 239, 0.82);
        }

        .easy-login-modal-head h3 {
          margin: 0;
          color: #07111f;
          font-size: 28px;
          line-height: 1.05;
          font-weight: 950;
        }

        .easy-login-modal-head p {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.55;
          font-weight: 700;
        }

        .easy-login-modal-close {
          flex: 0 0 auto;
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          color: #64748b;
          background: white;
          cursor: pointer;
        }

        .easy-login-modal-body {
          max-height: calc(min(92vh, 820px) - 116px);
          overflow: auto;
          padding: 22px 26px 26px;
        }

        .easy-login-alert-card {
          width: min(520px, 100%);
          overflow: hidden;
          border: 1px solid rgba(254, 202, 202, 0.88);
          border-radius: 30px;
          background:
            radial-gradient(circle at 18% 8%, rgba(254, 215, 170, 0.62), transparent 34%),
            linear-gradient(180deg, #ffffff 0%, #fff1f2 100%);
          box-shadow: 0 30px 90px rgba(127, 29, 29, 0.26);
        }

        .easy-login-alert-body {
          display: grid;
          gap: 14px;
          padding: 30px;
          text-align: center;
        }

        .easy-login-alert-icon {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          justify-self: center;
          border-radius: 20px;
          color: #dc2626;
          background: #fee2e2;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.78);
        }

        .easy-login-alert-body h3 {
          margin: 0;
          color: #7f1d1d;
          font-size: 25px;
          line-height: 1.05;
          font-weight: 950;
        }

        .easy-login-alert-body p {
          margin: 0;
          color: #dc2626;
          font-size: 14px;
          line-height: 1.65;
          font-weight: 850;
        }

        .easy-login-alert-actions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-top: 4px;
        }

        .easy-login-alert-actions .easy-login-button,
        .easy-login-alert-actions .easy-login-secondary-button {
          margin-top: 0;
        }

        .easy-login-modal-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .easy-login-modal-grid .full {
          grid-column: 1 / -1;
        }

        .easy-login-modal-success {
          display: grid;
          justify-items: center;
          gap: 12px;
          padding: 30px;
          border: 1px solid #fed7aa;
          border-radius: 24px;
          background: #fff7ed;
          text-align: center;
          color: #c2410c;
          font-weight: 850;
        }

        .easy-login-foot {
          align-self: end;
          width: 100%;
          max-width: 410px;
          justify-self: center;
          display: grid;
          gap: 10px;
          color: #94a3b8;
          font-size: 12px;
          font-weight: 750;
        }

        .easy-login-foot-line {
          height: 1px;
          width: 100%;
          background: linear-gradient(90deg, rgba(249,115,22,0.44), rgba(37,99,235,0.18), transparent);
        }

        .easy-login-showcase {
          position: relative;
          height: 100vh;
          overflow: hidden;
          padding: 24px clamp(28px, 4vw, 58px) 22px;
          color: white;
          background:
            radial-gradient(circle at 78% 18%, rgba(255, 237, 213, 0.24), transparent 31%),
            radial-gradient(circle at 12% 92%, rgba(255, 255, 255, 0.18), transparent 28%),
            linear-gradient(140deg, #7c2d12 0%, #c2410c 48%, #f97316 100%);
        }

        .easy-login-showcase::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
          background-size: 46px 46px;
          mask-image: linear-gradient(180deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.58) 68%, transparent 100%);
        }

        .easy-login-showcase-inner {
          position: relative;
          height: calc(100vh - 46px);
          min-height: 0;
          display: grid;
          grid-template-rows: auto auto clamp(154px, 22vh, 210px) minmax(0, 1fr);
          gap: clamp(10px, 1.35vh, 16px);
        }

        .easy-login-showcase-top {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
        }

        .easy-login-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(241, 245, 249, 0.3);
          border-radius: 999px;
          padding: 10px 14px;
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.12);
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.16em;
        }

        .easy-login-hero {
          display: grid;
          align-content: start;
          justify-items: center;
          max-width: 840px;
          margin: 0 auto;
          text-align: center;
        }

        .easy-login-hero h1 {
          margin: 0;
          color: #fffaf3;
          font-size: clamp(34px, 4vw, 58px);
          line-height: 1;
          letter-spacing: 0;
          font-weight: 950;
        }

        .easy-login-hero p {
          max-width: 640px;
          margin: 8px auto 0;
          color: rgba(239, 246, 255, 0.87);
          font-size: 14px;
          line-height: 1.45;
          font-weight: 650;
        }

        .easy-login-board {
          min-height: 0;
          height: 100%;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 1.18fr) minmax(250px, 0.82fr);
          gap: 16px;
          align-items: stretch;
        }

        .easy-login-panel,
        .easy-login-mini-card,
        .easy-login-chart-card {
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(18px);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .easy-login-panel {
          min-height: 0;
          overflow: hidden;
          border-radius: 24px;
          padding: clamp(14px, 1.6vh, 18px);
          display: flex;
          flex-direction: column;
        }

        .easy-login-panel-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: clamp(8px, 1vh, 14px);
        }

        .easy-login-panel-head strong {
          display: block;
          color: white;
          font-size: 14px;
          font-weight: 950;
        }

        .easy-login-panel-head span {
          display: block;
          margin-top: 5px;
          color: rgba(226, 232, 240, 0.72);
          font-size: 12px;
          font-weight: 750;
        }

        .easy-login-growth {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 9px 12px;
          color: #f8fafc;
          background: rgba(241, 245, 249, 0.14);
          border: 1px solid rgba(241, 245, 249, 0.26);
          font-size: 12px;
          font-weight: 950;
        }

        .easy-login-bars {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: clamp(9px, 1vw, 14px);
          align-items: end;
          height: 100%;
        }

        .easy-login-bars span {
          border-radius: 999px 999px 8px 8px;
          background: linear-gradient(180deg, #ffffff 0%, #e5e7eb 54%, #cbd5e1 100%);
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.16);
          animation: easyMainBar 3.2s ease-in-out infinite;
        }

        .easy-login-bars span:nth-child(2) { animation-delay: .1s; }
        .easy-login-bars span:nth-child(3) { animation-delay: .2s; }
        .easy-login-bars span:nth-child(4) { animation-delay: .3s; }
        .easy-login-bars span:nth-child(5) { animation-delay: .4s; }
        .easy-login-bars span:nth-child(6) { animation-delay: .5s; }
        .easy-login-bars span:nth-child(7) { animation-delay: .6s; }
        .easy-login-bars span:nth-child(8) { animation-delay: .7s; }

        .easy-login-panel-sparks {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
          margin-top: 12px;
        }

        .easy-login-spark-tile {
          min-width: 0;
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 16px;
          padding: 10px;
          background: rgba(255,255,255,0.09);
        }

        .easy-login-spark-tile strong {
          display: block;
          color: white;
          font-size: 12px;
          font-weight: 950;
        }

        .easy-login-spark-tile span {
          display: block;
          margin-top: 4px;
          color: rgba(226,232,240,0.72);
          font-size: 10px;
          font-weight: 850;
        }

        .easy-login-spark-track {
          height: 5px;
          margin-top: 8px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255,255,255,0.16);
        }

        .easy-login-spark-track i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #fff7ed, #fed7aa, #ffffff);
        }

        .easy-login-mini-grid {
          display: grid;
          grid-template-rows: auto minmax(66px, 0.58fr) minmax(82px, 0.84fr) auto;
          gap: 12px;
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }

        .easy-login-mini-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .easy-login-mini-card {
          min-height: 0;
          border-radius: 20px;
          padding: clamp(12px, 1.4vh, 15px);
        }

        .easy-login-mini-card svg {
          color: #f1f5f9;
        }

        .easy-login-mini-card strong {
          display: block;
          margin-top: 6px;
          color: white;
          font-size: clamp(20px, 2vw, 24px);
          font-weight: 950;
          line-height: 1;
        }

        .easy-login-mini-card span {
          display: block;
          margin-top: 7px;
          color: rgba(226, 232, 240, 0.72);
          font-size: 12px;
          font-weight: 800;
        }

        .easy-login-chart-card {
          border-radius: 20px;
          padding: clamp(12px, 1.4vh, 15px);
          min-height: 0;
          overflow: hidden;
        }

        .easy-login-chart-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 8px;
        }

        .easy-login-chart-head strong {
          color: white;
          font-size: 13px;
          font-weight: 950;
        }

        .easy-login-chart-head span {
          color: #f8fafc;
          font-size: 12px;
          font-weight: 950;
        }

        .easy-login-line-svg {
          width: 100%;
          height: clamp(46px, 6.4vh, 66px);
          display: block;
        }

        .easy-login-line-svg path {
          fill: none;
          stroke: #e5e7eb;
          stroke-width: 5;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 520;
          animation: easyLineDraw 3.8s ease-in-out infinite;
        }

        .easy-login-line-svg circle {
          fill: #f8fafc;
          stroke: rgba(124, 45, 18, 0.42);
          stroke-width: 4;
        }

        .easy-login-mix-card {
          min-height: 0;
          display: grid;
          place-items: center;
          padding: 18px;
        }

        .easy-login-donut {
          width: clamp(94px, 12vh, 132px);
          height: clamp(94px, 12vh, 132px);
          border-radius: 50%;
          background:
            radial-gradient(circle at center, rgba(124, 45, 18, 0.96) 0 47%, transparent 48%),
            conic-gradient(#f8fafc 0 72%, rgba(255,255,255,0.24) 72% 100%);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16), 0 18px 34px rgba(15,23,42,0.18);
          display: grid;
          place-items: center;
          color: white;
          font-size: 26px;
          font-weight: 950;
          animation: easyDonutGlow 3.4s ease-in-out infinite;
        }

        .easy-login-extra-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          min-height: 0;
        }

        .easy-login-tiny-chart {
          min-height: 64px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 18px;
          padding: 10px;
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(18px);
        }

        .easy-login-tiny-chart strong {
          display: block;
          color: white;
          font-size: 12px;
          font-weight: 950;
        }

        .easy-login-tiny-bars {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          align-items: end;
          gap: 5px;
          height: 34px;
          margin-top: 8px;
        }

        .easy-login-tiny-bars span {
          border-radius: 999px 999px 6px 6px;
          background: linear-gradient(180deg, #fff7ed, #fed7aa);
        }

        .easy-login-tiny-area {
          width: 100%;
          height: 42px;
          margin-top: 4px;
          display: block;
        }

        .easy-login-tiny-area path:first-child {
          fill: rgba(255,255,255,0.18);
        }

        .easy-login-tiny-area path:last-child {
          fill: none;
          stroke: #fff7ed;
          stroke-width: 4;
          stroke-linecap: round;
        }

        .easy-login-mix-card strong {
          display: block;
          color: white;
          font-size: 16px;
          font-weight: 950;
        }

        .easy-login-mix-card span {
          display: block;
          margin-top: 8px;
          color: rgba(226,232,240,0.72);
          font-size: 12px;
          line-height: 1.5;
          font-weight: 800;
        }

        @keyframes easyLoginShimmer {
          0%, 42% { transform: translateX(-110%); opacity: 0; }
          55% { opacity: 1; }
          76%, 100% { transform: translateX(110%); opacity: 0; }
        }

        @keyframes easyLoginSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes easyMiniBar {
          0%, 100% { transform: scaleY(.82); filter: brightness(.95); }
          50% { transform: scaleY(1.04); filter: brightness(1.12); }
        }

        @keyframes easyMainBar {
          0%, 100% { transform: translateY(0); opacity: .9; }
          50% { transform: translateY(-8px); opacity: 1; }
        }

        @keyframes easyLineDraw {
          0% { stroke-dashoffset: 520; opacity: .35; }
          45%, 70% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: -520; opacity: .45; }
        }

        @keyframes easyDonutGlow {
          0%, 100% { transform: scale(1); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16), 0 18px 34px rgba(15,23,42,0.18); }
          50% { transform: scale(1.04); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.22), 0 24px 48px rgba(67,20,7,0.32); }
        }

        @media (prefers-reduced-motion: reduce) {
          .easy-login-carousel-track,
          .easy-login-plan-carousel::before,
          .easy-login-slide-visual::after,
          .easy-login-window-bars span,
          .easy-login-bars span,
          .easy-login-line-svg path,
          .easy-login-donut {
            animation: none !important;
          }
        }

        @media (max-width: 1024px) {
          .easy-login-shell {
            grid-template-columns: 1fr;
          }

          .easy-login-form-side {
            height: 100vh;
            border-right: 0;
            box-shadow: none;
          }

          .easy-login-showcase {
            display: none;
          }
        }

        @media (max-width: 520px) {
          .easy-login-form-side {
            padding: 28px 20px;
          }

          .easy-login-form-card {
            max-width: none;
          }

          .easy-login-title {
            font-size: 34px;
          }

          .easy-login-modal-grid {
            grid-template-columns: 1fr;
          }

          .easy-login-alert-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="easy-login-shell">
        <section className="easy-login-form-side">
          <div className="easy-login-brand">
            <Logo />
          </div>

          <div className="easy-login-form-card">
            <div className="easy-login-secure">
              <ShieldCheck size={14} />
              Acesso seguro
            </div>

            <h2 className="easy-login-title">Entrar no Easy BI</h2>
            <p className="easy-login-copy">
              Acesse seu workspace para acompanhar bases de dados, metricas e dashboards da sua operacao.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="easy-login-fields">
                <label className="easy-login-label">
                  E-mail
                  <span className="easy-login-input-wrap">
                    <Mail size={18} />
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      type="email"
                      autoComplete="email"
                      className="easy-login-input"
                      placeholder="Digite seu e-mail"
                    />
                  </span>
                </label>

                <label className="easy-login-label">
                  Senha
                  <span className="easy-login-input-wrap">
                    <LockKeyhole size={18} />
                    <input
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      type="password"
                      autoComplete="current-password"
                      className="easy-login-input"
                      placeholder="Digite sua senha"
                    />
                  </span>
                </label>
              </div>

              <button disabled={loading} className="easy-login-button">
                {loading ? 'Entrando...' : 'Entrar no sistema'}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            <button type="button" onClick={openRequestModal} className="easy-login-secondary-button">
              Solicitar acesso
              <Sparkles size={16} />
            </button>
          </div>

          <div className="easy-login-foot">
            <span className="easy-login-foot-line" />
            <span>Easy BI Insights</span>
          </div>
        </section>

        <section className="easy-login-showcase">
          <div className="easy-login-showcase-inner">
            <div className="easy-login-showcase-top">
              <span className="easy-login-badge">
                <Sparkles size={14} />
                Business intelligence
              </span>
            </div>

            <div className="easy-login-hero">
              <h1>Dados claros para decisoes melhores.</h1>
              <p>
                Transforme planilhas em dashboards confiaveis, acompanhe metricas e mantenha sua equipe olhando para os mesmos numeros.
              </p>
            </div>

            <div className="easy-login-plan-carousel" aria-label="Planos Easy BI">
              <div
                className="easy-login-carousel-track"
                style={{
                  '--plan-count': planCount,
                  transform: `translateX(-${activePlanIndex * (100 / planCount)}%)`
                } as any}
              >
                {showcasePlans.map((plan: any, index: number) => {
                  const highlights = planHighlights(plan);
                  return (
                    <article key={plan.id || plan.name} className="easy-login-plan-slide">
                      <div className="easy-login-plan-slide-copy">
                        <span className="easy-login-plan-slide-kicker">
                          <Sparkles size={12} />
                          Plano {index + 1}
                        </span>
                        <h3>{plan.name}</h3>
                        <div className="easy-login-plan-price">{planPrice(plan)}</div>
                        <div className="easy-login-plan-limits">
                          {planSummary(plan).map(item => <span key={item}>{item}</span>)}
                        </div>
                        <div className="easy-login-plan-features">
                          {(highlights.length ? highlights : ['Dashboards essenciais', 'Bases organizadas']).map((item: any) => (
                            <span key={item}>+ {item}</span>
                          ))}
                        </div>
                      </div>
                      <div className="easy-login-slide-visual" aria-hidden="true">
                        <div className="easy-login-slide-window">
                          <div className="easy-login-window-head">
                            <span />
                            <small />
                          </div>
                          <div className="easy-login-window-bars">
                            {[42, 68, 54, 84, 72].map((height) => (
                              <span key={`${plan.id || plan.name}-${height}`} style={{ height: `${height + index * 3}%` }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="easy-login-board">
              <div className="easy-login-panel">
                <div className="easy-login-panel-head">
                  <div>
                    <strong>Performance comercial</strong>
                    <span>Receita por periodo</span>
                  </div>
                  <span className="easy-login-growth">+18.4%</span>
                </div>
                <div className="easy-login-bars">
                  {[42, 62, 48, 74, 56, 88, 70, 94].map((height) => (
                    <span key={height} style={{ height: `${height}%` }} />
                  ))}
                </div>
                <div className="easy-login-panel-sparks" aria-hidden="true">
                  {[
                    { label: 'Leads', value: '82%', progress: 82 },
                    { label: 'Receita', value: '76%', progress: 76 },
                    { label: 'Meta', value: '91%', progress: 91 },
                  ].map((item) => (
                    <div key={item.label} className="easy-login-spark-tile">
                      <strong>{item.value}</strong>
                      <span>{item.label}</span>
                      <div className="easy-login-spark-track">
                        <i style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="easy-login-mini-grid">
                <div className="easy-login-mini-row">
                  <div className="easy-login-mini-card">
                    <BarChart3 size={20} />
                    <strong>24</strong>
                    <span>dashboards ativos</span>
                  </div>
                  <div className="easy-login-mini-card">
                    <Database size={20} />
                    <strong>12</strong>
                    <span>bases monitoradas</span>
                  </div>
                </div>

                <div className="easy-login-chart-card">
                  <div className="easy-login-chart-head">
                    <strong>Ticket medio</strong>
                    <span>+9.7%</span>
                  </div>
                  <svg className="easy-login-line-svg" viewBox="0 0 320 110" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M8 82 C46 56, 72 65, 102 44 C140 16, 166 40, 196 32 C238 20, 258 34, 312 12" />
                    <circle cx="312" cy="12" r="7" />
                  </svg>
                </div>

                <div className="easy-login-chart-card easy-login-mix-card">
                  <div className="easy-login-donut">72%</div>
                </div>

                <div className="easy-login-extra-grid" aria-hidden="true">
                  <div className="easy-login-tiny-chart">
                    <strong>Conversao</strong>
                    <div className="easy-login-tiny-bars">
                      {[38, 54, 71, 86].map((height) => (
                        <span key={height} style={{ height: `${height}%` }} />
                      ))}
                    </div>
                  </div>
                  <div className="easy-login-tiny-chart">
                    <strong>Retencao</strong>
                    <svg className="easy-login-tiny-area" viewBox="0 0 120 48" preserveAspectRatio="none">
                      <path d="M0 38 C18 24 26 30 42 20 C58 10 72 18 86 12 C102 6 112 12 120 8 L120 48 L0 48 Z" />
                      <path d="M0 38 C18 24 26 30 42 20 C58 10 72 18 86 12 C102 6 112 12 120 8" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {errorModalOpen && error && (
        <div className="easy-login-modal-backdrop" role="dialog" aria-modal="true" aria-label="Aviso de login">
          <div className="easy-login-alert-card">
            <div className="easy-login-alert-body">
              <div className="easy-login-alert-icon">
                <ShieldCheck size={26} />
              </div>
              <h3>Acesso nao liberado</h3>
              <p>{error}</p>
              <div className="easy-login-alert-actions">
                <button type="button" onClick={() => setErrorModalOpen(false)} className="easy-login-secondary-button">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {requestModalOpen && (
        <div className="easy-login-modal-backdrop" role="dialog" aria-modal="true" aria-label="Solicitar acesso">
          <div className="easy-login-modal-card">
            <div className="easy-login-modal-head">
              <div>
                <h3>{requestSent ? 'Solicitacao enviada' : 'Solicitar acesso'}</h3>
                <p>{requestSent ? 'Seu pedido ficou registrado para analise do Admin Geral.' : 'Preencha os dados para o Admin Geral avaliar e liberar o login da organizacao.'}</p>
              </div>
              <button type="button" onClick={() => setRequestModalOpen(false)} className="easy-login-modal-close" aria-label="Fechar modal">
                <X size={18} />
              </button>
            </div>
            <div className="easy-login-modal-body">
              {requestSent ? (
                <div className="easy-login-modal-success">
                  <ShieldCheck size={42} />
                  <p>{requestMessage}</p>
                  <button type="button" onClick={() => setRequestModalOpen(false)} className="easy-login-button">Fechar</button>
                </div>
              ) : (
                <form onSubmit={handleAccessRequest}>
                  <div className="easy-login-modal-grid">
                    <label className="easy-login-label">
                      Seu nome
                      <span className="easy-login-input-wrap">
                        <UserRound size={18} />
                        <input className="easy-login-input" value={requestForm.requesterName} onChange={e => patchRequest({ requesterName: e.target.value })} placeholder="Nome do responsavel" />
                      </span>
                    </label>
                    <label className="easy-login-label">
                      E-mail
                      <span className="easy-login-input-wrap">
                        <Mail size={18} />
                        <input className="easy-login-input" type="email" value={requestForm.requesterEmail} onChange={e => patchRequest({ requesterEmail: e.target.value })} placeholder="email@empresa.com" />
                      </span>
                    </label>
                    <label className="easy-login-label">
                      Empresa
                      <span className="easy-login-input-wrap">
                        <Building2 size={18} />
                        <input className="easy-login-input" value={requestForm.companyName} onChange={e => patchRequest({ companyName: e.target.value })} placeholder="Nome da organizacao" />
                      </span>
                    </label>
                    <label className="easy-login-label">
                      Telefone
                      <span className="easy-login-input-wrap">
                        <Phone size={18} />
                        <input className="easy-login-input" value={requestForm.phone} onChange={e => patchRequest({ phone: e.target.value })} placeholder="Opcional" />
                      </span>
                    </label>
                    <label className="easy-login-label">
                      Documento
                      <span className="easy-login-input-wrap">
                        <FileText size={18} />
                        <input className="easy-login-input" value={requestForm.document} onChange={e => patchRequest({ document: e.target.value })} placeholder="CNPJ/CPF opcional" />
                      </span>
                    </label>
                    <label className="easy-login-label">
                      Plano desejado
                      <select className="easy-login-select" value={requestForm.requestedPlanId} onChange={e => patchRequest({ requestedPlanId: e.target.value })}>
                        {publicPlans.map((plan: any) => <option key={plan.id} value={plan.id}>{plan.name} - {planPrice(plan)}</option>)}
                      </select>
                    </label>
                    <label className="easy-login-label full">
                      Mensagem
                      <textarea className="easy-login-textarea" value={requestForm.message} onChange={e => patchRequest({ message: e.target.value })} placeholder="Conte rapidamente o que sua empresa precisa" />
                    </label>
                  </div>

                  {requestMessage && <p className="easy-login-error">{requestMessage}</p>}

                  <button disabled={requestLoading} className="easy-login-button">
                    {requestLoading ? 'Enviando...' : 'Enviar solicitacao'}
                    {!requestLoading && <ArrowRight size={18} />}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
