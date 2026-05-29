import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
}

export function Badge({ className, variant = 'primary', children, ...props }: BadgeProps) {
  const variants = {
    primary: 'bg-primary-100 text-primary-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    gray: '',
  };

  const grayStyle = variant === 'gray' ? {
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
  } : undefined;

  return (
    <span
      style={grayStyle}
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variant !== 'gray' && variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}