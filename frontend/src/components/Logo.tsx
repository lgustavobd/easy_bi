import { useAuthStore } from '../store/auth.store';

type LogoProps = {
  compact?: boolean;
};

function brandImageUrl(value?: string) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
  const origin = apiBase.replace(/\/api\/?$/i, '').replace(/\/$/, '');
  return `${origin}${value.startsWith('/') ? value : `/${value}`}`;
}

/**
 * Logo institucional fixo do Easy BI.
 *
 * Importante:
 * - Não depende do tema da organização.
 * - Não usa currentColor nem variáveis CSS de aparência.
 * - Mantém a identidade do produto sempre estável em laranja.
 */
export function Logo({ compact = false }: LogoProps) {
  const organization = useAuthStore((state) => state.organization);
  const organizationLogo = brandImageUrl(organization?.themeConfig?.brandImageUrl);

  return (
    <div
      className={`easybi-brand-lock ${compact ? 'easybi-brand-lock-compact' : ''} ${organizationLogo && !compact ? 'easybi-brand-lock-with-org' : ''}`}
      aria-label="Easy BI"
    >
      <div className="easybi-brand-mark" aria-hidden="true">
        <span>BI</span>
      </div>

      {!compact && (
        <div className="easybi-brand-copy">
          <div className="easybi-brand-title">
            <span className="easybi-brand-title-dark">Easy</span>
            <span className="easybi-brand-title-accent">BI</span>
          </div>
          <span className="easybi-brand-subtitle">Insights</span>
        </div>
      )}

      {organizationLogo && !compact && (
        <div className="easybi-brand-org-logo" aria-label={`Logo da organizaÃ§Ã£o ${organization?.name || ''}`}>
          <img src={organizationLogo} alt={organization?.name ? `Logo ${organization.name}` : 'Logo da organizaÃ§Ã£o'} />
        </div>
      )}
    </div>
  );
}
