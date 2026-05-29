import { useState } from 'react';
import { FeatureGate } from '../../components/ui/FeatureGate';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useReferrals, useCreateReferral, useDeleteReferral } from '../../hooks/useReferrals';
import { formatDateTime } from '../../lib/utils';
import { Users, Trash2, Plus, Copy, Check } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';

export default function ReferralsPage() {
  const { data: referrals, isLoading } = useReferrals();
  const createReferral = useCreateReferral();
  const deleteReferral = useDeleteReferral();
  const { showToast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', discount: '10' });
  const [copiedCode, setCopiedCode] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      showToast('Please enter both name and email', 'error');
      return;
    }
    try {
      await createReferral.mutateAsync({
        referrerName: formData.name,
        referrerEmail: formData.email,
        discountPercent: parseFloat(formData.discount) || 10,
      });
      showToast('Referral code created', 'success');
      setShowCreate(false);
      setFormData({ name: '', email: '', discount: '10' });
    } catch (err) {
      showToast('Failed to create referral: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      try {
        await deleteReferral.mutateAsync(deleteTarget);
        showToast('Referral code deleted', 'success');
      } catch (err) {
        showToast('Failed to delete referral: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
      }
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  if (isLoading) return <LoadingSpinner />;

  const totalUses = referrals?.reduce((sum, r) => sum + r.uses, 0) || 0;

  const totalPages = referrals ? Math.ceil(referrals.length / pageSize) : 1;
  const paginatedReferrals = referrals?.slice((currentPage - 1) * pageSize, currentPage * pageSize) || [];

  return (
    <FeatureGate feature="referrals" showUpgradeCard upgradeTitle="Referral Program" upgradeDescription="Upgrade to Pro to create and manage referral codes with usage tracking.">
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Referral Program</h1>
          <p className="text-gray-500">{referrals?.length || 0} codes, {totalUses} total uses</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Code
        </Button>
      </div>

      {!referrals || referrals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No referral codes yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>All Referral Codes</CardTitle>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={referrals?.length || 0} pageSize={pageSize} onPageChange={setCurrentPage} position="top" />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Code</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Referrer</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Discount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Uses</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Created</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReferrals.map((ref) => (
                    <tr key={ref.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-primary-600">{ref.code}</span>
                          <button onClick={() => handleCopy(ref.code)} className="text-gray-400 hover:text-gray-600">
                            {copiedCode === ref.code ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-900">{ref.referrer_name}</div>
                        <div className="text-sm text-gray-500">{ref.referrer_email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="primary">{ref.discount_percent}% off</Badge>
                      </td>
                      <td className="py-3 px-4 font-medium">{ref.uses}{ref.max_uses ? `/${ref.max_uses}` : ''}</td>
                      <td className="py-3 px-4 text-sm text-gray-500">{formatDateTime(ref.created_at)}</td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => {
                          setDeleteTarget(ref.id);
                          setShowDeleteConfirm(true);
                        }}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={referrals?.length || 0} pageSize={pageSize} onPageChange={setCurrentPage} position="bottom" />
          </CardContent>
        </Card>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Referral Code" className="max-w-md">
        <div className="space-y-4">
          <Input
            label="Referrer Name *"
            value={formData.name}
            onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
            placeholder="Jane Smith"
          />
          <Input
            label="Referrer Email *"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
            placeholder="jane@example.com"
          />
          <Input
            label="Discount %"
            type="number"
            min="1"
            max="100"
            value={formData.discount}
            onChange={(e) => setFormData(p => ({ ...p, discount: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createReferral.isPending}>
              {createReferral.isPending ? 'Creating...' : 'Create Code'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Referral Code"
        message="Are you sure you want to delete this referral code?"
        confirmLabel="Delete"
        variant="danger"
        icon="trash"
      />
    </div>
    </FeatureGate>
  );
}
