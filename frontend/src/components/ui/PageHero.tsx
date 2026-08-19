import type { ReactNode } from 'react';

type PageHeroMetric = {
  label: string;
  value: ReactNode;
};

type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  metrics?: PageHeroMetric[];
  className?: string;
};

export function PageHero({ eyebrow = 'Easy BI Workspace', title, description, actions, metrics = [], className = '' }: PageHeroProps) {
  return (
    <section className={`page-hero ${className}`}>
      <div className="page-hero-main">
        {eyebrow && <p className="page-hero-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>

      {actions && <div className="page-hero-actions">{actions}</div>}

      {Boolean(metrics.length) && (
        <div className="page-hero-metrics">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
