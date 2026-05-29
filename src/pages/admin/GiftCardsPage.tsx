import { useState, useMemo, useEffect } from 'react';
import { FeatureGate } from '../../components/ui/FeatureGate';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useGiftCards, useDeleteGiftCard } from '../../hooks/useGiftCards';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Gift, Trash2, Eye, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import type { GiftCard } from '../../types/database';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';

type SortField = 'code' | 'amount' | 'purchaser_name' | 'recipient_name' | 'is_redeemed' | 'created_at';
type SortDirection = 'asc' | 'desc';

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return null;
  return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
}

export default function GiftCardsPage() {
  const { data: giftCards, isLoading } = useGiftCards();
  const deleteGiftCard = useDeleteGiftCard();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<GiftCard | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
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
  };

  const sortedCards = useMemo(() => {
    if (!giftCards) return [];
    return [...giftCards].sort((a, b) => {
      let aVal = a[sortField as keyof GiftCard];
      let bVal = b[sortField as keyof GiftCard];
      if (sortField === 'is_redeemed') {
        aVal = a.is_redeemed ? 1 : 0;
        bVal = b.is_redeemed ? 1 : 0;
      }
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [giftCards, sortField, sortDirection]);

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1));
  }, [sortField, sortDirection]);

  const totalPages = Math.ceil(sortedCards.length / pageSize);
  const paginatedCards = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedCards.slice(start, start + pageSize);
  }, [sortedCards, currentPage, pageSize]);

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      try {
        await deleteGiftCard.mutateAsync(deleteTarget);
        showToast('Gift card deleted', 'success');
      } catch (err) {
        showToast('Failed to delete gift card: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
      }
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  if (isLoading) return <LoadingSpinner />;

  const activeCards = giftCards?.filter(g => !g.is_redeemed).length || 0;
  const redeemedCards = giftCards?.filter(g => g.is_redeemed).length || 0;
  const totalValue = giftCards?.reduce((sum, g) => sum + g.amount, 0) || 0;

  return (
    <FeatureGate feature="gift_cards" showUpgradeCard upgradeTitle="Gift Cards" upgradeDescription="Upgrade to Pro to sell and manage gift cards with partial balance redemption.">
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Gift Cards</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage purchased gift cards</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Active</p>
            <p className="text-2xl font-bold text-green-600">{activeCards}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Redeemed</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-muted)' }}>{redeemedCards}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Total Value</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>{formatCurrency(totalValue)}</p>
          </CardContent>
        </Card>
      </div>

      {!giftCards || giftCards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Gift className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-muted)' }}>No gift cards yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>All Gift Cards</CardTitle>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={sortedCards.length} pageSize={pageSize} onPageChange={setCurrentPage} />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderColor: 'var(--border-color)' }}>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('code')}>
                      <span className="flex items-center gap-1">Code <SortIcon field="code" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('amount')}>
                      <span className="flex items-center gap-1">Amount <SortIcon field="amount" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('purchaser_name')}>
                      <span className="flex items-center gap-1">Purchaser <SortIcon field="purchaser_name" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('recipient_name')}>
                      <span className="flex items-center gap-1">Recipient <SortIcon field="recipient_name" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('is_redeemed')}>
                      <span className="flex items-center gap-1">Status <SortIcon field="is_redeemed" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('created_at')}>
                      <span className="flex items-center gap-1">Purchased <SortIcon field="created_at" sortField={sortField} sortDirection={sortDirection} /></span>
                    </th>
                    <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCards.map((card) => (
                    <tr key={card.id} style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 px-4 font-mono font-semibold" style={{ color: 'var(--primary-color)' }}>{card.code}</td>
                      <td className="py-3 px-4 font-semibold" style={{ color: 'var(--primary-color)' }}>{formatCurrency(card.amount)}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{card.purchaser_name}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{card.recipient_name || '-'}</td>
                      <td className="py-3 px-4">
                        {card.is_redeemed ? (
                          <Badge variant="gray">Redeemed</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-muted)' }}>{formatDateTime(card.created_at)}</td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelected(card)}>
                          <Eye className="h-4 w-4" />
                        </Button>
<Button variant="ghost" size="sm" onClick={() => {
                            setDeleteTarget(card.id);
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
          </CardContent>
        </Card>
      )}

      {giftCards && giftCards.length > 0 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={sortedCards.length} pageSize={pageSize} onPageChange={setCurrentPage} position="bottom" />
      )}

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Gift Card Details" className="max-w-lg">
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl p-6 text-center" style={{ backgroundColor: 'var(--section-bg-light)', borderColor: 'var(--border-color)', borderWidth: '1px', borderStyle: 'solid' }}>
              <Gift className="h-6 w-6 mx-auto mb-1" style={{ color: 'var(--primary-color)' }} />
              <p className="text-2xl font-mono font-bold tracking-widest" style={{ color: 'var(--primary-color)' }}>{selected.code}</p>
              <p className="text-lg font-semibold" style={{ color: 'var(--primary-color)' }}>{formatCurrency(selected.amount)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Purchaser</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selected.purchaser_name}</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{selected.purchaser_email}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Recipient</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selected.recipient_name || 'Not specified'}</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{selected.recipient_email || '-'}</p>
              </div>
            </div>
            {selected.message && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Message</p>
                <p style={{ color: 'var(--text-primary)' }}>{selected.message}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Status</p>
                <Badge variant={selected.is_redeemed ? 'gray' : 'success'}>
                  {selected.is_redeemed ? 'Redeemed' : 'Active'}
                </Badge>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Purchased</p>
                <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{formatDateTime(selected.created_at)}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Gift Card"
        message="Are you sure you want to delete this gift card?"
        confirmLabel="Delete"
        variant="danger"
        icon="trash"
      />
    </div>
    </FeatureGate>
  );
}
