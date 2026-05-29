import { useState } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useInvoices, useCreateInvoice, useUpdateInvoice, useApproveAndSendInvoice, useVoidInvoice } from '../../hooks/useInvoices';
import { useCorporateAccounts } from '../../hooks/useCorporateAccounts';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { FileText, Plus, Send, Edit, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { Invoice, InvoiceLineItem, InvoiceStatus } from '../../types/database';
import { useToast } from '../../components/ui/Toast';

type TabId = 'draft' | 'sent' | 'paid' | 'past_due';

const TABS: { id: TabId; label: string }[] = [
  { id: 'draft', label: 'Draft' },
  { id: 'sent', label: 'Sent' },
  { id: 'paid', label: 'Paid' },
  { id: 'past_due', label: 'Past Due' },
];

const STATUS_BADGE_VARIANT: Record<InvoiceStatus, 'gray' | 'primary' | 'success' | 'danger'> = {
  draft: 'gray',
  sent: 'primary',
  paid: 'success',
  past_due: 'danger',
  voided: 'gray',
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  past_due: 'Past Due',
  voided: 'Voided',
};

interface LineItemForm {
  description: string;
  quantity: number;
  unit_price: number;
}

function emptyLineItem(): LineItemForm {
  return { description: '', quantity: 1, unit_price: 0 };
}

export default function CorporateInvoicesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('draft');
  const [accountFilter, setAccountFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voidTarget, setVoidTarget] = useState<string | null>(null);

  const { data: accounts } = useCorporateAccounts();
  const { data: draftInvoices, isLoading: loadingDraft } = useInvoices({ status: 'draft', corporate_account_id: accountFilter || undefined });
  const { data: sentInvoices, isLoading: loadingSent } = useInvoices({ status: 'sent', corporate_account_id: accountFilter || undefined });
  const { data: paidInvoices, isLoading: loadingPaid } = useInvoices({ status: 'paid', corporate_account_id: accountFilter || undefined });
  const { data: pastDueInvoices, isLoading: loadingPastDue } = useInvoices({ status: 'past_due', corporate_account_id: accountFilter || undefined });

  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const approveAndSend = useApproveAndSendInvoice();
  const voidInvoice = useVoidInvoice();
  const { showToast } = useToast();

  const invoiceMap: Record<TabId, Invoice[]> = {
    draft: draftInvoices ?? [],
    sent: sentInvoices ?? [],
    paid: paidInvoices ?? [],
    past_due: pastDueInvoices ?? [],
  };

  const loadingMap: Record<TabId, boolean> = {
    draft: loadingDraft,
    sent: loadingSent,
    paid: loadingPaid,
    past_due: loadingPastDue,
  };

  const currentInvoices = invoiceMap[activeTab];
  const isLoading = loadingMap[activeTab];

  const totalPages = Math.max(1, Math.ceil(currentInvoices.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedInvoices = currentInvoices.slice((currentPageSafe - 1) * pageSize, currentPageSafe * pageSize);

  const [createForm, setCreateForm] = useState({
    corporate_account_id: '',
    billing_period_start: '',
    billing_period_end: '',
    line_items: [emptyLineItem()],
    discount_amount: 0,
    tax_amount: 0,
    due_date: '',
    admin_notes: '',
  });

  const [editForm, setEditForm] = useState({
    line_items: [emptyLineItem()],
    discount_amount: 0,
    tax_amount: 0,
    due_date: '',
    admin_notes: '',
  });

  const computeSubtotal = (items: LineItemForm[]) =>
    items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const computeTotal = (items: LineItemForm[], discount: number, tax: number) =>
    computeSubtotal(items) - discount + tax;

  const createSubtotal = computeSubtotal(createForm.line_items);
  const createTotal = computeTotal(createForm.line_items, createForm.discount_amount, createForm.tax_amount);
  const editSubtotal = computeSubtotal(editForm.line_items);
  const editTotal = computeTotal(editForm.line_items, editForm.discount_amount, editForm.tax_amount);

  const handleCreateLineItemChange = (index: number, field: keyof LineItemForm, value: string | number) => {
    setCreateForm(prev => {
      const items = [...prev.line_items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, line_items: items };
    });
  };

  const handleAddCreateLineItem = () => {
    setCreateForm(prev => ({ ...prev, line_items: [...prev.line_items, emptyLineItem()] }));
  };

  const handleRemoveCreateLineItem = (index: number) => {
    setCreateForm(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index),
    }));
  };

  const handleEditLineItemChange = (index: number, field: keyof LineItemForm, value: string | number) => {
    setEditForm(prev => {
      const items = [...prev.line_items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, line_items: items };
    });
  };

  const handleAddEditLineItem = () => {
    setEditForm(prev => ({ ...prev, line_items: [...prev.line_items, emptyLineItem()] }));
  };

  const handleRemoveEditLineItem = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index),
    }));
  };

  const openEditModal = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setEditForm({
      line_items: invoice.line_items.map(li => ({ description: li.description, quantity: li.quantity, unit_price: li.unit_price })),
      discount_amount: invoice.discount_amount,
      tax_amount: invoice.tax_amount,
      due_date: invoice.due_date ?? '',
      admin_notes: invoice.admin_notes ?? '',
    });
    setShowEditModal(true);
  };

  const handleCreate = async () => {
    if (!createForm.corporate_account_id) return;
    const line_items: InvoiceLineItem[] = createForm.line_items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.quantity * item.unit_price,
    }));
    await createInvoice.mutateAsync({
      corporate_account_id: createForm.corporate_account_id,
      billing_period_start: createForm.billing_period_start,
      billing_period_end: createForm.billing_period_end,
      line_items,
      subtotal: createSubtotal,
      discount_amount: createForm.discount_amount,
      tax_amount: createForm.tax_amount,
      total_amount: createTotal,
      due_date: createForm.due_date || null,
      admin_notes: createForm.admin_notes || null,
      status: 'draft',
    } as Partial<Invoice>);
    setShowCreateModal(false);
    setCreateForm({
      corporate_account_id: '',
      billing_period_start: '',
      billing_period_end: '',
      line_items: [emptyLineItem()],
      discount_amount: 0,
      tax_amount: 0,
      due_date: '',
      admin_notes: '',
    });
  };

  const handleUpdate = async () => {
    if (!editingInvoice) return;
    const line_items: InvoiceLineItem[] = editForm.line_items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.quantity * item.unit_price,
    }));
    await updateInvoice.mutateAsync({
      id: editingInvoice.id,
      line_items,
      subtotal: editSubtotal,
      discount_amount: editForm.discount_amount,
      tax_amount: editForm.tax_amount,
      total_amount: editTotal,
      due_date: editForm.due_date || null,
      admin_notes: editForm.admin_notes || null,
    });
    setShowEditModal(false);
    setEditingInvoice(null);
  };

  const handleApproveAndSend = async (invoiceId: string) => {
    try {
      await approveAndSend.mutateAsync(invoiceId);
      showToast('Invoice email queued');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to send invoice email', 'error');
    }
  };

  const handleVoid = (invoiceId: string) => {
    setVoidTarget(invoiceId);
    setShowVoidConfirm(true);
  };

  const handleConfirmVoid = async () => {
    if (voidTarget) {
      await voidInvoice.mutateAsync(voidTarget);
    }
    setShowVoidConfirm(false);
    setVoidTarget(null);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Corporate Invoices</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage and track corporate billing invoices</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
              className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
              style={{
                backgroundColor: activeTab === tab.id ? 'var(--primary)' : 'var(--bg-tertiary)',
                color: activeTab === tab.id ? 'white' : 'var(--text-primary)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <select
          value={accountFilter}
          onChange={(e) => { setAccountFilter(e.target.value); setCurrentPage(1); }}
          className="px-4 py-2 border rounded-lg text-sm"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All Accounts</option>
          {(accounts ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.company_name}</option>
          ))}
        </select>
        {activeTab === 'draft' && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {TABS.find(t => t.id === activeTab)?.label} Invoices
          </CardTitle>
          <Pagination
            currentPage={currentPageSafe}
            totalPages={totalPages}
            totalItems={currentInvoices.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            position="top"
          />
        </CardHeader>
        <CardContent>
          {currentInvoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
              <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>No {activeTab.replace('_', ' ')} invoices found</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {accountFilter ? 'Try adjusting your filter' : 'Invoices will appear here'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Corporate Account</th>
                    <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Period</th>
                    <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Subtotal</th>
                    <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Discount</th>
                    <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Tax</th>
                    <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Total</th>
                    <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Status</th>
                    <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Due Date</th>
                    <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b hover:bg-gray-50" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 px-4 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {invoice.corporate_account?.company_name ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {invoice.billing_period_start && invoice.billing_period_end
                          ? `${formatDate(invoice.billing_period_start)} - ${formatDate(invoice.billing_period_end)}`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(invoice.subtotal)}</td>
                      <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(invoice.discount_amount)}</td>
                      <td className="py-3 px-4 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(invoice.tax_amount)}</td>
                      <td className="py-3 px-4 text-right text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(invoice.total_amount)}</td>
                      <td className="py-3 px-4">
                        <Badge variant={STATUS_BADGE_VARIANT[invoice.status]}>
                          {invoice.status === 'past_due' && <AlertTriangle className="h-3 w-3 mr-1 inline" />}
                          {STATUS_LABEL[invoice.status]}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {invoice.due_date ? formatDate(invoice.due_date) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {activeTab === 'draft' && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => openEditModal(invoice)}>
                                <Edit className="h-4 w-4 mr-1" />Edit
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleApproveAndSend(invoice.id)}
                                disabled={approveAndSend.isPending}
                              >
                                <Send className="h-4 w-4 mr-1" />Send
                              </Button>
                              <Button variant="danger" size="sm" aria-label="Void invoice" onClick={() => handleVoid(invoice.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {activeTab === 'sent' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApproveAndSend(invoice.id)}
                                disabled={approveAndSend.isPending}
                              >
                                <RefreshCw className="h-4 w-4 mr-1" />Resend
                              </Button>
                            </>
                          )}
                          {activeTab === 'paid' && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {invoice.paid_at ? `Paid ${formatDate(invoice.paid_at)}` : '—'}
                            </span>
                          )}
                          {activeTab === 'past_due' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApproveAndSend(invoice.id)}
                              disabled={approveAndSend.isPending}
                            >
                              <Send className="h-4 w-4 mr-1" />Send Reminder
                            </Button>
                          )}
                        </div>
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
            totalItems={currentInvoices.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            position="bottom"
          />
        </CardContent>
      </Card>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Invoice" className="max-w-3xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Corporate Account *</label>
              <select
                value={createForm.corporate_account_id}
                onChange={(e) => setCreateForm(prev => ({ ...prev, corporate_account_id: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg"
                style={{
                  backgroundColor: 'var(--admin-input-bg, var(--card-bg))',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">Select account</option>
                {(accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.company_name}</option>
                ))}
              </select>
            </div>
            <div />
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Period Start</label>
              <input
                type="date"
                value={createForm.billing_period_start}
                onChange={(e) => setCreateForm(prev => ({ ...prev, billing_period_start: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg"
                style={{
                  backgroundColor: 'var(--admin-input-bg, var(--card-bg))',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Period End</label>
              <input
                type="date"
                value={createForm.billing_period_end}
                onChange={(e) => setCreateForm(prev => ({ ...prev, billing_period_end: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg"
                style={{
                  backgroundColor: 'var(--admin-input-bg, var(--card-bg))',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Line Items</label>
              <Button variant="ghost" size="sm" onClick={handleAddCreateLineItem}>
                <Plus className="h-4 w-4 mr-1" />Add Line
              </Button>
            </div>
            <div className="space-y-2">
              {createForm.line_items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => handleCreateLineItemChange(idx, 'description', e.target.value)}
                    className="col-span-5 px-3 py-2 border rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    min={0}
                    onChange={(e) => handleCreateLineItemChange(idx, 'quantity', Number(e.target.value))}
                    className="col-span-2 px-3 py-2 border rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="number"
                    placeholder="Unit Price"
                    value={item.unit_price}
                    min={0}
                    step={0.01}
                    onChange={(e) => handleCreateLineItemChange(idx, 'unit_price', Number(e.target.value))}
                    className="col-span-2 px-3 py-2 border rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  <span className="col-span-2 text-sm font-medium text-right" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(item.quantity * item.unit_price)}
                  </span>
                  <button
                    onClick={() => handleRemoveCreateLineItem(idx)}
                    className="col-span-1 p-1 rounded hover:bg-red-50 text-red-500"
                    disabled={createForm.line_items.length <= 1}
                    aria-label="Remove line item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(createSubtotal)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Discount</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={createForm.discount_amount}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, discount_amount: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Tax</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={createForm.tax_amount}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, tax_amount: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <span style={{ color: 'var(--text-primary)' }}>Total</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(createTotal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Due Date</label>
              <input
                type="date"
                value={createForm.due_date}
                onChange={(e) => setCreateForm(prev => ({ ...prev, due_date: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg"
                style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Admin Notes</label>
            <textarea
              value={createForm.admin_notes}
              onChange={(e) => setCreateForm(prev => ({ ...prev, admin_notes: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2 border rounded-lg"
              style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!createForm.corporate_account_id || createInvoice.isPending}>
              {createInvoice.isPending ? 'Creating...' : 'Create Invoice'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingInvoice(null); }} title="Edit Invoice" className="max-w-3xl">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Line Items</label>
              <Button variant="ghost" size="sm" onClick={handleAddEditLineItem}>
                <Plus className="h-4 w-4 mr-1" />Add Line
              </Button>
            </div>
            <div className="space-y-2">
              {editForm.line_items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => handleEditLineItemChange(idx, 'description', e.target.value)}
                    className="col-span-5 px-3 py-2 border rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    min={0}
                    onChange={(e) => handleEditLineItemChange(idx, 'quantity', Number(e.target.value))}
                    className="col-span-2 px-3 py-2 border rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="number"
                    placeholder="Unit Price"
                    value={item.unit_price}
                    min={0}
                    step={0.01}
                    onChange={(e) => handleEditLineItemChange(idx, 'unit_price', Number(e.target.value))}
                    className="col-span-2 px-3 py-2 border rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  <span className="col-span-2 text-sm font-medium text-right" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(item.quantity * item.unit_price)}
                  </span>
                  <button
                    onClick={() => handleRemoveEditLineItem(idx)}
                    className="col-span-1 p-1 rounded hover:bg-red-50 text-red-500"
                    disabled={editForm.line_items.length <= 1}
                    aria-label="Remove line item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(editSubtotal)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Discount</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={editForm.discount_amount}
                  onChange={(e) => setEditForm(prev => ({ ...prev, discount_amount: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Tax</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={editForm.tax_amount}
                  onChange={(e) => setEditForm(prev => ({ ...prev, tax_amount: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <span style={{ color: 'var(--text-primary)' }}>Total</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(editTotal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Due Date</label>
              <input
                type="date"
                value={editForm.due_date}
                onChange={(e) => setEditForm(prev => ({ ...prev, due_date: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg"
                style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Admin Notes</label>
            <textarea
              value={editForm.admin_notes}
              onChange={(e) => setEditForm(prev => ({ ...prev, admin_notes: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2 border rounded-lg"
              style={{ backgroundColor: 'var(--admin-input-bg, var(--card-bg))', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowEditModal(false); setEditingInvoice(null); }}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateInvoice.isPending}>
              {updateInvoice.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showVoidConfirm}
        onClose={() => setShowVoidConfirm(false)}
        onConfirm={handleConfirmVoid}
        title="Void Invoice"
        message="Are you sure you want to void this invoice? This action cannot be undone."
        confirmLabel="Void"
        variant="warning"
        icon="warning"
        isLoading={voidInvoice.isPending}
      />
    </div>
  );
}
