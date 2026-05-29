import { TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '../../lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const autoId = useId();
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') + '-' + autoId : autoId);
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full px-4 py-2 border rounded-lg transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            error ? 'border-red-500' : '',
            className
          )}
          style={{ 
            backgroundColor: 'var(--admin-input-bg, var(--card-bg))', 
            borderColor: 'var(--border-color)', 
            color: 'var(--text-primary)' 
          }}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';