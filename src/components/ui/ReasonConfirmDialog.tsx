import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Button } from './Button';

interface ReasonConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  message: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  icon?: 'trash' | 'warning' | 'none';
  isLoading?: boolean;
  requireReason?: boolean;
}

export function ReasonConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  reasonLabel = 'Reason',
  reasonPlaceholder = 'Add a short note for the activity log...',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  icon = 'warning',
  isLoading = false,
  requireReason = false,
}: ReasonConfirmDialogProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!isOpen) {
      queueMicrotask(() => setReason(''));
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const IconComp = icon === 'trash' ? Trash2 : icon === 'warning' ? AlertTriangle : null;
  const variantStyles = {
    danger: { bg: '#fef2f2', border: '#fecaca', iconColor: '#dc2626' },
    warning: { bg: '#fffbeb', border: '#fde68a', iconColor: '#d97706' },
    info: { bg: '#eff6ff', border: '#bfdbfe', iconColor: '#2563eb' },
  };
  const s = variantStyles[variant];
  const disabled = isLoading || (requireReason && !reason.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative rounded-xl shadow-xl max-w-lg w-full mx-4" style={{ backgroundColor: 'var(--card-bg)' }}>
        <div className="flex items-start gap-4 p-6">
          {IconComp && (
            <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
              <IconComp className="h-5 w-5" style={{ color: s.iconColor }} />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{message}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 pb-4">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{reasonLabel}{requireReason ? ' *' : ''}</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={reasonPlaceholder}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>{cancelLabel}</Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={() => onConfirm(reason.trim())} disabled={disabled}>
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
