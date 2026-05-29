import { useState, useMemo } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useCoupons, useCreateCoupon, useUpdateCoupon, useTrashCoupon } from '../../hooks/useEvents';
import { Plus, Edit2, Trash2, Upload, ChevronUp, ChevronDown, ArrowUpDown, Tag } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';
import type { Coupon } from '../../types/database';

type SortField = 'code' | 'discount_value' | 'uses_so_far' | 'valid_from' | 'source' | 'is_active' | 'created_at';
type SortDirection = 'asc' | 'desc';

function SortIcon({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
}) {
  if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
  return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1 inline" /> : <ChevronDown className="h-4 w-4 ml-1 inline" />;
}

export default function AdminCouponsPage() {
  const { data: coupons, isLoading } = useCoupons();
  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();
  const trashCoupon = useTrashCoupon();
  const { showToast } = useToast();

  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const sortedCoupons = useMemo(() => {
    if (!coupons) return [];
    return [...coupons].sort((a, b) => {
      let aVal: string | number | boolean | Date | null = null;
      let bVal: string | number | boolean | Date | null = null;

      switch (sortField) {
        case 'code':
          aVal = a.code || '';
          bVal = b.code || '';
          break;
        case 'discount_value':
          aVal = a.discount_value || 0;
          bVal = b.discount_value || 0;
          break;
        case 'uses_so_far':
          aVal = a.uses_so_far || 0;
          bVal = b.uses_so_far || 0;
          break;
        case 'valid_from':
          aVal = a.valid_from ? new Date(a.valid_from) : null;
          bVal = b.valid_from ? new Date(b.valid_from) : null;
          break;
        case 'source':
          aVal = a.source || '';
          bVal = b.source || '';
          break;
        case 'is_active':
          aVal = a.is_active;
          bVal = b.is_active;
          break;
        case 'created_at':
          aVal = a.created_at ? new Date(a.created_at) : null;
          bVal = b.created_at ? new Date(b.created_at) : null;
          break;
      }

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        return sortDirection === 'asc' ? (aVal === bVal ? 0 : aVal ? -1 : 1) : (aVal === bVal ? 0 : aVal ? 1 : -1);
      }
      if (aVal instanceof Date && bVal instanceof Date) {
        return sortDirection === 'asc' ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [coupons, sortField, sortDirection]);

  const totalCoupons = sortedCoupons.length;
  const totalPages = Math.max(1, Math.ceil(totalCoupons / pageSize));

  const paginatedCoupons = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedCoupons.slice(start, start + pageSize);
  }, [sortedCoupons, currentPage, pageSize]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [showTrashConfirm, setShowTrashConfirm] = useState(false);
  const [trashTarget, setTrashTarget] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    max_uses: '',
    valid_from: '',
    valid_to: '',
    source: 'internal',
    external_platform_name: '',
    is_active: true,
  });
  const [bulkData, setBulkData] = useState('');

  const openModal = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setFormData({
        code: coupon.code,
        description: coupon.description || '',
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value?.toString() || '',
        max_uses: coupon.max_uses?.toString() || '',
        valid_from: coupon.valid_from ? new Date(coupon.valid_from).toISOString().slice(0, 16) : '',
        valid_to: coupon.valid_to ? new Date(coupon.valid_to).toISOString().slice(0, 16) : '',
        source: coupon.source,
        external_platform_name: coupon.external_platform_name || '',
        is_active: coupon.is_active,
      });
    } else {
      setEditingCoupon(null);
      setFormData({
        code: '',
        description: '',
        discount_type: 'percentage',
        discount_value: '',
        max_uses: '',
        valid_from: '',
        valid_to: '',
        source: 'internal',
        external_platform_name: '',
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.code.trim()) {
      showToast('Coupon code is required', 'error');
      return;
    }
    if (!formData.discount_value) {
      showToast('Discount value is required', 'error');
      return;
    }

    try {
      const couponData = {
        code: formData.code.toUpperCase(),
        description: formData.description || null,
        discount_type: formData.discount_type as 'percentage' | 'fixed',
        discount_value: parseFloat(formData.discount_value),
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : null,
        valid_to: formData.valid_to ? new Date(formData.valid_to).toISOString() : null,
        source: formData.source as 'internal' | 'groupon' | 'other_platform',
        external_platform_name: formData.external_platform_name || null,
        is_active: formData.is_active,
      };

      if (editingCoupon) {
        await updateCoupon.mutateAsync({ id: editingCoupon.id, ...couponData });
      } else {
        await createCoupon.mutateAsync(couponData);
      }
      setIsModalOpen(false);
    } catch (err) {
      showToast('Failed to save coupon: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  const handleBulkImport = async () => {
    const lines = bulkData.split('\n').filter((line) => line.trim());
    let successCount = 0;
    for (const line of lines) {
      const [code, value, type = 'percentage', source = 'groupon', maxUses = ''] = line.split(',').map((s) => s.trim());
      if (code && value) {
        try {
          await createCoupon.mutateAsync({
            code: code.toUpperCase(),
            discount_type: type as 'percentage' | 'fixed',
            discount_value: parseFloat(value),
            max_uses: maxUses ? parseInt(maxUses) : null,
            source: source as 'internal' | 'groupon' | 'other_platform',
            is_active: true,
          });
          successCount++;
        } catch (err) {
          showToast('Failed to import coupon ' + code + ': ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
        }
      }
    }
    setIsBulkModalOpen(false);
    setBulkData('');
    if (successCount > 0) {
      showToast('Imported ' + successCount + ' of ' + lines.length + ' coupons', 'success');
    }
  };

  const handleConfirmTrash = async () => {
    if (trashTarget) {
      try {
        await trashCoupon.mutateAsync(trashTarget);
        showToast('Coupon moved to trash', 'success');
      } catch (err) {
        showToast('Failed to trash coupon: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
      }
    }
    setShowTrashConfirm(false);
    setTrashTarget(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Coupons</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage discount codes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setIsBulkModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button onClick={() => openModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Coupon
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>All Coupons</CardTitle>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalCoupons}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </CardHeader>
          <CardContent>
            {totalCoupons === 0 ? (
              <div className="text-center py-12">
                <Tag className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
                <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>No coupons yet</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Create discount codes to run promotions and track usage.</p>
              </div>
            ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('code')}>
                      <span className="flex items-center gap-1">Code <SortIcon field="code" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('discount_value')}>
                      <span className="flex items-center gap-1">Discount <SortIcon field="discount_value" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('uses_so_far')}>
                      <span className="flex items-center gap-1">Uses <SortIcon field="uses_so_far" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('valid_from')}>
                      <span className="flex items-center gap-1">Valid <SortIcon field="valid_from" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('source')}>
                      <span className="flex items-center gap-1">Source <SortIcon field="source" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('is_active')}>
                      <span className="flex items-center gap-1">Status <SortIcon field="is_active" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCoupons.map((coupon) => (
                    <tr key={coupon.id} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 px-4">
                        <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{coupon.code}</span>
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                        {coupon.discount_type === 'percentage'
                          ? `${coupon.discount_value}%`
                          : `$${coupon.discount_value}`}
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                        {coupon.uses_so_far} / {coupon.max_uses || '∞'}
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                        {coupon.valid_from
                          ? `${new Date(coupon.valid_from).toLocaleDateString()} - ${new Date(coupon.valid_to || '').toLocaleDateString()}`
                          : 'No expiration'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={coupon.source === 'groupon' ? 'warning' : 'gray'}>
                          {coupon.source || 'Manual'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {coupon.is_active ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="danger">Inactive</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openModal(coupon)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                            setTrashTarget(coupon.id);
                            setShowTrashConfirm(true);
                          }}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalCoupons}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              position="bottom"
            />
            </>
          )}
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
      >
        <div className="space-y-4">
          <Input
            label="Code"
            value={formData.code}
            onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
            placeholder="SUMMER25"
            required
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Summer discount"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Discount Type"
              options={[
                { value: 'percentage', label: 'Percentage' },
                { value: 'fixed', label: 'Fixed Amount' },
              ]}
              value={formData.discount_type}
              onChange={(e) => setFormData((prev) => ({ ...prev, discount_type: e.target.value }))}
            />
            <Input
              label="Discount Value"
              type="number"
              value={formData.discount_value}
              onChange={(e) => setFormData((prev) => ({ ...prev, discount_value: e.target.value }))}
              placeholder="25"
              required
            />
          </div>
          <Input
            label="Max Uses"
            type="number"
            value={formData.max_uses}
            onChange={(e) => setFormData((prev) => ({ ...prev, max_uses: e.target.value }))}
            placeholder="100"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Valid From"
              type="datetime-local"
              value={formData.valid_from}
              onChange={(e) => setFormData((prev) => ({ ...prev, valid_from: e.target.value }))}
            />
            <Input
              label="Valid To"
              type="datetime-local"
              value={formData.valid_to}
              onChange={(e) => setFormData((prev) => ({ ...prev, valid_to: e.target.value }))}
            />
          </div>
          <Select
            label="Source"
            options={[
              { value: 'internal', label: 'Internal' },
              { value: 'groupon', label: 'Groupon' },
              { value: 'other_platform', label: 'Other Platform' },
            ]}
            value={formData.source}
            onChange={(e) => setFormData((prev) => ({ ...prev, source: e.target.value }))}
          />
          <Input
            label="External Platform Name"
            value={formData.external_platform_name}
            onChange={(e) => setFormData((prev) => ({ ...prev, external_platform_name: e.target.value }))}
            placeholder="Groupon"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Active
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createCoupon.isPending || updateCoupon.isPending}>
              {editingCoupon ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Bulk Import Coupons"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter one coupon per line in format: code, value, type, source, max_uses
          </p>
          <textarea
            value={bulkData}
            onChange={(e) => setBulkData(e.target.value)}
            placeholder="CODE1, 20, percentage, groupon, 50&#10;CODE2, 10, fixed, groupon"
            className="w-full h-48 px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkImport} disabled={createCoupon.isPending}>
              Import
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showTrashConfirm}
        onClose={() => setShowTrashConfirm(false)}
        onConfirm={handleConfirmTrash}
        title="Move to Trash"
        message="Are you sure you want to move this coupon to trash?"
        confirmLabel="Move to Trash"
        variant="warning"
        icon="warning"
      />
    </div>
  );
}
