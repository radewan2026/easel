import { InputHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') + '-' + autoId : autoId);
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-4 py-2 border rounded-lg transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            error ? 'border-red-500' : '',
            className
          )}
          style={{ 
            backgroundColor: 'var(--admin-input-bg, var(--section-bg-light, var(--card-bg), #ffffff)', 
            borderColor: 'var(--border-color, #d1d5db)', 
            color: 'var(--text-primary, #111827)'
          }}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';