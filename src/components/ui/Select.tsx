import { SelectHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '../../lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, ...props }, ref) => {
    const autoId = useId();
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') + '-' + autoId : autoId);
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full px-4 py-2 border rounded-lg transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            error ? 'border-red-500' : 'border-[var(--border-color)]',
            className
          )}
          style={{ 
            backgroundColor: 'var(--admin-input-bg, var(--card-bg))',
            color: 'var(--text-primary)',
            borderColor: 'var(--border-color)'
          }}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';