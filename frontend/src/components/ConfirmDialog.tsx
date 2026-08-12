import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, ShieldCheck, X } from 'lucide-react';

type ConfirmTone = 'default' | 'danger' | 'success' | 'warning';

type ConfirmOptions = {
  title: string;
  description?: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  hideCancel?: boolean;
};

type ConfirmState = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

const toneIcon = {
  default: ShieldCheck,
  danger: AlertTriangle,
  success: CheckCircle2,
  warning: AlertTriangle
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        tone: 'default',
        cancelLabel: 'Cancelar',
        confirmLabel: 'Confirmar',
        ...options,
        resolve
      });
    });
  }, []);

  const Icon = state ? toneIcon[state.tone || 'default'] : ShieldCheck;
  const toneClass = state?.tone ? `confirm-dialog-${state.tone}` : 'confirm-dialog-default';

  function close(confirmed: boolean) {
    if (!state) return;
    state.resolve(confirmed);
    setState(null);
  }

  const modal = useMemo(() => {
    if (!state) return null;

    return createPortal(
      <div className="confirm-dialog-backdrop" role="dialog" aria-modal="true" aria-label={state.title}>
        <div className={`confirm-dialog-card ${toneClass}`}>
          <button type="button" className="confirm-dialog-close" onClick={() => close(false)} aria-label="Cancelar confirmacao">
            <X size={18} />
          </button>

          <div className="confirm-dialog-glow" />
          <div className="confirm-dialog-icon">
            <Icon size={24} />
          </div>

          <div className="confirm-dialog-copy">
            <p className="confirm-dialog-eyebrow">Confirme a acao</p>
            <h3>{state.title}</h3>
            {state.description && <p>{state.description}</p>}
            {Boolean(state.details?.length) && (
              <ul>
                {state.details!.map((detail) => <li key={detail}>{detail}</li>)}
              </ul>
            )}
          </div>

          <div className="confirm-dialog-actions">
            {!state.hideCancel && (
              <button type="button" className="btn-muted confirm-dialog-cancel" onClick={() => close(false)}>
                {state.cancelLabel}
              </button>
            )}
            <button type="button" className="btn-primary confirm-dialog-confirm" onClick={() => close(true)}>
              {state.confirmLabel}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }, [Icon, state, toneClass]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {modal}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm precisa estar dentro do ConfirmProvider.');
  return confirm;
}
