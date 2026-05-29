import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useCustomerAuth } from '../../hooks/useCustomerAuth';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export function CustomerAuthGuard({ children }: { children: ReactNode }) {
  const { customer, loading } = useCustomerAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!customer) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/account/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}
