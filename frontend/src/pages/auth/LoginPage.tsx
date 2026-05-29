import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, BarChart3, Database, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../api/auth.api';
import { Logo } from '../../components/Logo';
import { useAuthStore } from '../../store/auth.store';

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore(s => s.setSession);
  const [email, setEmail] = useState('superadmin@easybi.com');
  const [password, setPassword] = useState('EasyBI@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.accent = 'ORANGE';
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await login(email, password);
      setSession(data);
      if (data.user.isSuperAdmin || data.organizations.length !== 1) navigate('/select-organization');
      else {
        useAuthStore.getState().setOrganization(data.organizations[0]);
        navigate('/');
      }
    } catch {
      setError('E-mail ou senha invalidos.');
    } finally {
      setLoading(false);
    }
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
          min-height: 100vh;
          color: var(--login-ink);
          background: #f8fafc;
        }

        .easy-login-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(430px, 38vw) minmax(0, 1fr);
        }

        .easy-login-form-side {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          gap: 34px;
          padding: 36px clamp(34px, 4vw, 64px);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%);
          border-right: 1px solid rgba(148, 163, 184, 0.22);
          box-shadow: 24px 0 70px rgba(15, 23, 42, 0.08);
        }

        .easy-login-brand {
          width: fit-content;
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
        }

        .easy-login-secure {
          display: inline-flex;
          align-items: center;
          gap: 8px;
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

        .easy-login-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.11);
        }

        .easy-login-error {
          margin: 16px 0 0;
          border: 1px solid #fecaca;
          border-radius: 14px;
          background: #fff1f2;
          color: #dc2626;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 850;
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

        .easy-login-credentials {
          margin: 18px 0 0;
          border: 1px solid var(--login-line);
          border-radius: 14px;
          background: white;
          padding: 13px 14px;
          color: var(--login-muted);
          font-size: 12px;
          font-weight: 700;
          line-height: 1.55;
        }

        .easy-login-credentials strong {
          color: var(--login-ink);
          font-weight: 950;
        }

        .easy-login-foot {
          align-self: end;
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
          min-height: 100vh;
          overflow: hidden;
          padding: 32px clamp(34px, 5vw, 76px) 28px;
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
          min-height: calc(100vh - 60px);
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          gap: 18px;
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
          font-size: clamp(40px, 4.4vw, 64px);
          line-height: 1;
          letter-spacing: 0;
          font-weight: 950;
        }

        .easy-login-hero p {
          max-width: 640px;
          margin: 12px auto 0;
          color: rgba(239, 246, 255, 0.87);
          font-size: 15px;
          line-height: 1.55;
          font-weight: 650;
        }

        .easy-login-board {
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(270px, 0.85fr);
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
          min-height: 100%;
          border-radius: 24px;
          padding: 18px;
          display: flex;
          flex-direction: column;
        }

        .easy-login-panel-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 14px;
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
          min-height: 190px;
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 14px;
          align-items: end;
          height: auto;
        }

        .easy-login-bars span {
          border-radius: 999px 999px 8px 8px;
          background: linear-gradient(180deg, #ffffff 0%, #e5e7eb 54%, #cbd5e1 100%);
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.16);
        }

        .easy-login-mini-grid {
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          gap: 12px;
          min-height: 0;
        }

        .easy-login-mini-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .easy-login-mini-card {
          min-height: 92px;
          border-radius: 20px;
          padding: 15px;
        }

        .easy-login-mini-card svg {
          color: #f1f5f9;
        }

        .easy-login-mini-card strong {
          display: block;
          margin-top: 8px;
          color: white;
          font-size: 24px;
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
          padding: 15px;
          min-height: 108px;
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
          height: 66px;
          display: block;
        }

        .easy-login-line-svg path {
          fill: none;
          stroke: #e5e7eb;
          stroke-width: 5;
          stroke-linecap: round;
          stroke-linejoin: round;
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
          width: 142px;
          height: 142px;
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

        @media (max-width: 1024px) {
          .easy-login-shell {
            grid-template-columns: 1fr;
          }

          .easy-login-form-side {
            min-height: 100vh;
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
        }
      `}</style>

      <div className="easy-login-shell">
        <section className="easy-login-form-side">
          <div className="easy-login-brand">
            <Logo />
          </div>

          <form onSubmit={handleSubmit} className="easy-login-form-card">
            <div className="easy-login-secure">
              <ShieldCheck size={14} />
              Acesso seguro
            </div>

            <h2 className="easy-login-title">Entrar no Easy BI</h2>
            <p className="easy-login-copy">
              Acesse seu workspace para acompanhar datasets, metricas e dashboards da sua operacao.
            </p>

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

            {error && <p className="easy-login-error">{error}</p>}

            <button disabled={loading} className="easy-login-button">
              {loading ? 'Entrando...' : 'Entrar no sistema'}
              {!loading && <ArrowRight size={18} />}
            </button>

            <p className="easy-login-credentials">
              Admin SaaS inicial: <strong>superadmin@easybi.com</strong> / <strong>EasyBI@123</strong>
            </p>
          </form>

          <div className="easy-login-foot">
            <span className="easy-login-foot-line" />
            <span>Easy BI Insights</span>
          </div>
        </section>

        <section className="easy-login-showcase" aria-hidden="true">
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
                    <span>datasets monitorados</span>
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
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
