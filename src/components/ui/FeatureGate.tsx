import { type ReactNode } from 'react';
import { useFeatures } from '../../hooks/useTenantPlan';
import type { TenantFeatures } from '../../types/database';
import { Button } from './Button';
import { Card } from './Card';
import { Sparkles } from 'lucide-react';

interface FeatureGateProps {
  feature: keyof TenantFeatures;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradeCard?: boolean;
  upgradeTitle?: string;
  upgradeDescription?: string;
}

export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradeCard = false,
  upgradeTitle = 'Upgrade to unlock',
  upgradeDescription = 'This feature is available on a higher plan.',
}: FeatureGateProps) {
  const { hasFeature, isLoading } = useFeatures();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <div className="p-8 text-center">
            <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-gray-200 animate-pulse" />
            <div className="h-5 w-48 mx-auto mb-2 rounded bg-gray-200 animate-pulse" />
            <div className="h-4 w-64 mx-auto mb-6 rounded bg-gray-200 animate-pulse" />
            <div className="h-10 w-32 mx-auto rounded bg-gray-200 animate-pulse" />
          </div>
        </Card>
      </div>
    );
  }

  if (hasFeature(feature)) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  if (showUpgradeCard) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <div className="p-8 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              {upgradeTitle}
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              {upgradeDescription}
            </p>
            <Button onClick={() => window.location.href = '/admin/settings?tab=billing'}>
              View Plans
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}
