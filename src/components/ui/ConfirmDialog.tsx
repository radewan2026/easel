import { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  icon?: 'trash' | 'warning' | 'none';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  icon = 'warning',
  isLoading = false,
}: ConfirmDialogProps) {
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
    danger: { bg: '#fef2f2', border: '#fecaca', iconColor: '#dc2626', titleColor: '#991b1b' },
    warning: { bg: '#fffbeb', border: '#fde68a', iconColor: '#d97706', titleColor: '#92400e' },
    info: { bg: '#eff6ff', border: '#bfdbfe', iconColor: '#2563eb', titleColor: '#1e40af' },
  };
  const s = variantStyles[variant];

  const confirmBtnClass = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : variant === 'warning'
    ? 'bg-amber-600 hover:bg-amber-700 text-white'
    : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative rounded-xl shadow-xl max-w-md w-full mx-4"
        style={{ backgroundColor: 'var(--card-bg)' }}
      >
        <div className="flex items-start gap-4 p-6">
          {IconComp && (
            <div
              className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
            >
              <IconComp className="h-5 w-5" style={{ color: s.iconColor }} />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{message}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button className={confirmBtnClass} onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}