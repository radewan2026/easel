import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCorporateAccount, useCreateCorporateAccount, useUpdateCorporateAccount } from '../../hooks/useCorporateAccounts';
import { Save, ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toast';
import type { CorporateAccount, CorporatePlanType, CorporateStatus } from '../../types/database';

const PLAN_OPTIONS = [
  { value: 'monthly_retainer', label: 'Monthly Retainer' },
  { value: 'pay_per_event', label: 'Pay Per Event' },
  { value: 'custom', label: 'Custom' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'inactive', label: 'Inactive' },
];

export default function EditCorporateAccountPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const { data: account, isLoading } = useCorporateAccount(isNew ? '' : id!);
  const createAccount = useCreateCorporateAccount();
  const updateAccount = useUpdateCorporateAccount();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    company_name: '',
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    billing_street: '',
    billing_city: '',
    billing_state: '',
    billing_zip: '',
    tax_id: '',
    plan_type: 'pay_per_event' as CorporatePlanType,
    monthly_seat_allotment: '',
    status: 'active' as CorporateStatus,
    notes: '',
  });

  useEffect(() => {
    if (account && !isNew) {
      const addr = account.billing_address || { street: '', city: '', state: '', zip: '' };
      queueMicrotask(() => setFormData({
        company_name: account.company_name || '',
        primary_contact_name: account.primary_contact_name || '',
        primary_contact_email: account.primary_contact_email || '',
        primary_contact_phone: account.primary_contact_phone || '',
        billing_street: addr.street || '',
        billing_city: addr.city || '',
        billing_state: addr.state || '',
        billing_zip: addr.zip || '',
        tax_id: account.tax_id || '',
        plan_type: account.plan_type || 'pay_per_event',
        monthly_seat_allotment: account.monthly_seat_allotment?.toString() || '',
        status: account.status || 'active',
        notes: account.notes || '',
      }));
    }
  }, [account, isNew]);

  const handleSave = async () => {
    if (!formData.company_name.trim() || !formData.primary_contact_name.trim() || !formData.primary_contact_email.trim()) {
      showToast('Company name, primary contact name, and email are required');
      return;
    }

    const payload: Partial<CorporateAccount> = {
      company_name: formData.company_name,
      primary_contact_name: formData.primary_contact_name,
      primary_contact_email: formData.primary_contact_email,
      primary_contact_phone: formData.primary_contact_phone || null,
      billing_address: formData.billing_street || formData.billing_city || formData.billing_state || formData.billing_zip
        ? { street: formData.billing_street, city: formData.billing_city, state: formData.billing_state, zip: formData.billing_zip }
        : null,
      tax_id: formData.tax_id || null,
      plan_type: formData.plan_type,
      monthly_seat_allotment: formData.plan_type === 'monthly_retainer' && formData.monthly_seat_allotment
        ? parseInt(formData.monthly_seat_allotment, 10)
        : null,
      notes: formData.notes || null,
    };

    if (!isNew) {
      payload.status = formData.status;
    }

    try {
      if (isNew) {
        await createAccount.mutateAsync(payload);
        showToast('Corporate account created successfully');
      } else {
        await updateAccount.mutateAsync({ id: id!, ...payload });
        showToast('Corporate account updated successfully');
      }
      navigate('/admin/corporate-accounts');
    } catch (err: unknown) {
      showToast('Failed to save corporate account: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (isLoading && !isNew) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/admin/corporate-accounts')}
          className="p-2 rounded-lg hover:bg-gray-100"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {isNew ? 'New Corporate Account' : 'Edit Corporate Account'}
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {isNew ? 'Create a new corporate account' : `Editing ${account?.company_name || 'account'}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Company Name"
                value={formData.company_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, company_name: e.target.value }))}
                placeholder="Acme Corporation"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Primary Contact Name"
                  value={formData.primary_contact_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, primary_contact_name: e.target.value }))}
                  placeholder="Jane Smith"
                />
                <Input
                  label="Primary Contact Email"
                  type="email"
                  value={formData.primary_contact_email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, primary_contact_email: e.target.value }))}
                  placeholder="jane@acme.com"
                />
              </div>
              <Input
                label="Primary Contact Phone"
                type="tel"
                value={formData.primary_contact_phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, primary_contact_phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Street"
                value={formData.billing_street}
                onChange={(e) => setFormData((prev) => ({ ...prev, billing_street: e.target.value }))}
                placeholder="123 Main St"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="City"
                  value={formData.billing_city}
                  onChange={(e) => setFormData((prev) => ({ ...prev, billing_city: e.target.value }))}
                  placeholder="New York"
                />
                <Input
                  label="State"
                  value={formData.billing_state}
                  onChange={(e) => setFormData((prev) => ({ ...prev, billing_state: e.target.value }))}
                  placeholder="NY"
                />
                <Input
                  label="ZIP"
                  value={formData.billing_zip}
                  onChange={(e) => setFormData((prev) => ({ ...prev, billing_zip: e.target.value }))}
                  placeholder="10001"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plan & Billing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Plan Type"
                  options={PLAN_OPTIONS}
                  value={formData.plan_type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, plan_type: e.target.value as CorporatePlanType }))}
                />
                <Input
                  label="Tax ID"
                  value={formData.tax_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tax_id: e.target.value }))}
                  placeholder="XX-XXXXXXX"
                />
              </div>
              {formData.plan_type === 'monthly_retainer' && (
                <Input
                  label="Monthly Seat Allotment"
                  type="number"
                  value={formData.monthly_seat_allotment}
                  onChange={(e) => setFormData((prev) => ({ ...prev, monthly_seat_allotment: e.target.value }))}
                  placeholder="e.g. 50"
                />
              )}
            </CardContent>
          </Card>

          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle>Stripe Connection</CardTitle>
              </CardHeader>
              <CardContent>
                {account?.stripe_customer_id ? (
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                    >
                      Connected
                    </span>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Customer ID: {account.stripe_customer_id}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No Stripe customer account connected.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  label="Account Status"
                  options={STATUS_OPTIONS}
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as CorporateStatus }))}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                label="Internal Notes"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Any internal notes about this corporate account..."
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isNew && account && (
                <>
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Plan Type</span>
                    <p className="mt-1">
                      {account.plan_type === 'custom' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Custom
                        </span>
                      ) : (
                        <Badge variant={account.plan_type === 'monthly_retainer' ? 'primary' : 'success'}>
                          {PLAN_OPTIONS.find((o) => o.value === account.plan_type)?.label || account.plan_type}
                        </Badge>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Status</span>
                    <p className="mt-1">
                      <Badge
                        variant={account.status === 'active' ? 'success' : account.status === 'paused' ? 'warning' : 'danger'}
                      >
                        {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Created</span>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                      {new Date(account.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Last Updated</span>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                      {new Date(account.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </>
              )}
              <div className="pt-2 space-y-2">
                <Button
                  onClick={handleSave}
                  disabled={createAccount.isPending || updateAccount.isPending}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isNew ? 'Create Account' : 'Save Changes'}
                </Button>
                <Button variant="secondary" onClick={() => navigate('/admin/corporate-accounts')} className="w-full">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
