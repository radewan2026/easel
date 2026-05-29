import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCorporateAccounts } from '../../hooks/useCorporateAccounts';
import { FeatureGate } from '../../components/ui/FeatureGate';
import { Building2, Plus, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import type { CorporateAccount, CorporatePlanType, CorporateStatus } from '../../types/database';

const PLAN_BADGE_VARIANT: Record<CorporatePlanType, 'primary' | 'success' | 'warning' | 'danger' | 'gray'> = {
  monthly_retainer: 'primary',
  pay_per_event: 'success',
  custom: 'gray',
};

const PLAN_LABEL: Record<CorporatePlanType, string> = {
  monthly_retainer: 'Monthly Retainer',
  pay_per_event: 'Pay Per Event',
  custom: 'Custom',
};

const STATUS_BADGE_VARIANT: Record<CorporateStatus, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  paused: 'warning',
  inactive: 'danger',
};

export default function CorporateAccountsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const { data: accounts, isLoading } = useCorporateAccounts({
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const filteredAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts;
  }, [accounts]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedAccounts = filteredAccounts.slice((currentPageSafe - 1) * pageSize, currentPageSafe * pageSize);

  if (isLoading) return <LoadingSpinner />;

  return (
    <FeatureGate feature="corporate_accounts" showUpgradeCard upgradeTitle="Corporate Accounts" upgradeDescription="Upgrade to Growth or Pro to manage B2B corporate clients, retainer plans, and invoicing.">
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Corporate Accounts</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage corporate clients and their billing plans</p>
        </div>
        <Button onClick={() => navigate('/admin/corporate-accounts/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Corporate Account
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by company name, contact, or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="px-4 py-2 border rounded-lg"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>All Corporate Accounts</CardTitle>
          <Pagination
            currentPage={currentPageSafe}
            totalPages={totalPages}
            totalItems={filteredAccounts.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            position="top"
          />
        </CardHeader>
        <CardContent>
          {filteredAccounts.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
              <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>No corporate accounts found</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {search || statusFilter ? 'Try adjusting your filters' : 'Create your first corporate account to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Company Name</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Primary Contact</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Email</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Plan Type</th>
                    <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Monthly Spend</th>
                    <th className="text-center py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Active Events</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAccounts.map((account: CorporateAccount) => (
                    <tr key={account.id} className="border-b hover:bg-gray-50" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => navigate(`/admin/corporate-accounts/${account.id}`)}
                          className="font-medium hover:underline"
                          style={{ color: 'var(--primary-color)' }}
                        >
                          {account.company_name}
                        </button>
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                        {account.primary_contact_name}
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                        {account.primary_contact_email}
                      </td>
                      <td className="py-3 px-4">
                        {account.plan_type === 'custom' ? (
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                          >
                            Custom
                          </span>
                        ) : (
                          <Badge variant={PLAN_BADGE_VARIANT[account.plan_type]}>
                            {PLAN_LABEL[account.plan_type]}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right" style={{ color: 'var(--text-secondary)' }}>
                        —
                      </td>
                      <td className="py-3 px-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                        —
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={STATUS_BADGE_VARIANT[account.status]}>
                          {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            currentPage={currentPageSafe}
            totalPages={totalPages}
            totalItems={filteredAccounts.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            position="bottom"
          />
        </CardContent>
      </Card>
    </div>
    </FeatureGate>
  );
}