import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEmployee, useCreateEmployee, useUpdateEmployee, useCreateStripeConnectAccount, useGenerateOnboardingLink, useSetEmployeePassword } from '../../hooks/useEmployees';
import { ArrowLeft, Save, CreditCard, Shield, Users, Calendar, ShoppingBag, Tag, Gift, Mail, BookOpen, Image, MapPin, Clock, BarChart3, DollarSign, Star, HelpCircle, Settings, MessageCircle, FileText, Share2, Lock } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency } from '../../lib/utils';
import type { AdminRole, EmployeePermissions, EmployeeRole, EmployeeStatus } from '../../types/database';

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const dayLabels: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const PERMISSION_AREAS: { key: keyof EmployeePermissions; label: string; description: string; icon: React.ElementType; group: string }[] = [
  { key: 'dashboard', label: 'Dashboard', description: 'View dashboard and KPIs', icon: BarChart3, group: 'Overview' },
  { key: 'events', label: 'Events', description: 'Create, edit, and manage events', icon: Calendar, group: 'Events & Sales' },
  { key: 'attendees', label: 'Attendees', description: 'View and manage event attendees', icon: Users, group: 'Events & Sales' },
  { key: 'sales', label: 'Sales', description: 'View and manage orders', icon: DollarSign, group: 'Events & Sales' },
  { key: 'reports', label: 'Reports', description: 'Access sales and analytics reports', icon: BarChart3, group: 'Events & Sales' },
  { key: 'products', label: 'Products', description: 'Manage shop products and categories', icon: ShoppingBag, group: 'Shop' },
  { key: 'coupons', label: 'Coupons', description: 'Create and manage discount codes', icon: Tag, group: 'Shop' },
  { key: 'giftCards', label: 'Gift Cards', description: 'Manage gift cards', icon: Gift, group: 'Shop' },
  { key: 'customers', label: 'Customers', description: 'View customer profiles and history', icon: Users, group: 'People' },
  { key: 'newsletter', label: 'Newsletter', description: 'Manage subscribers and send emails', icon: Mail, group: 'People' },
  { key: 'submissions', label: 'Submissions', description: 'View private party inquiries', icon: FileText, group: 'People' },
  { key: 'waitlist', label: 'Waitlist', description: 'Manage event waitlists', icon: Clock, group: 'People' },
  { key: 'referrals', label: 'Referrals', description: 'Manage referral codes', icon: Share2, group: 'People' },
  { key: 'blog', label: 'Blog', description: 'Create and edit blog posts', icon: BookOpen, group: 'Content' },
  { key: 'galleries', label: 'Galleries', description: 'Manage photo galleries', icon: Image, group: 'Content' },
  { key: 'testimonials', label: 'Testimonials', description: 'Manage customer testimonials', icon: Star, group: 'Content' },
  { key: 'FAQs', label: 'FAQs', description: 'Manage frequently asked questions', icon: HelpCircle, group: 'Content' },
  { key: 'venues', label: 'Venues', description: 'Manage venue listings', icon: MapPin, group: 'Content' },
  { key: 'chat', label: 'Live Chat', description: 'Respond to customer chat messages', icon: MessageCircle, group: 'System' },
  { key: 'settings', label: 'Settings', description: 'Access site settings and configuration', icon: Settings, group: 'System' },
  { key: 'timeTracking', label: 'Time Tracking', description: 'Clock in/out and view time entries', icon: Clock, group: 'System' },
  { key: 'payroll', label: 'Payroll', description: 'View payroll reports and manage pay rates', icon: DollarSign, group: 'System' },
];

const GROUP_ORDER = ['Overview', 'Events & Sales', 'Shop', 'People', 'Content', 'System'];

const DEFAULT_PERMISSIONS = PERMISSION_AREAS.reduce<EmployeePermissions>((acc, area) => {
  acc[area.key] = false;
  return acc;
}, {});

function ShieldCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export default function EditEmployeePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const { data: employee, isLoading } = useEmployee(id || '');
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const createStripeAccount = useCreateStripeConnectAccount();
  const generateOnboardingLink = useGenerateOnboardingLink();
  const setEmployeePassword = useSetEmployeePassword();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'instructor' as EmployeeRole,
    hourly_rate: '',
    overtime_multiplier: '1.5',
    status: 'active' as EmployeeStatus,
    notes: '',
  });
  const [availability, setAvailability] = useState<string[]>([]);
  const [adminRole, setAdminRole] = useState<AdminRole>('none');
  const [permissions, setPermissions] = useState<EmployeePermissions>({ ...DEFAULT_PERMISSIONS });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (employee) {
      queueMicrotask(() => {
        setFormData({
        name: employee.name || '',
        email: employee.email || '',
        phone: employee.phone || '',
        role: employee.role || 'instructor',
        hourly_rate: employee.hourly_rate?.toString() || '',
        overtime_multiplier: employee.overtime_multiplier?.toString() || '1.5',
        status: employee.status || 'active',
        notes: employee.notes || '',
        });
        setAvailability(employee.availability_days || []);
        setAdminRole(employee.admin_role || 'none');
        setPermissions(
          (employee.permissions && typeof employee.permissions === 'object' && !Array.isArray(employee.permissions))
            ? { ...DEFAULT_PERMISSIONS, ...employee.permissions }
            : { ...DEFAULT_PERMISSIONS }
        );
      });
    } else if (isNew) {
      queueMicrotask(() => {
        setFormData({ name: '', email: '', phone: '', role: 'instructor', hourly_rate: '', overtime_multiplier: '1.5', status: 'active', notes: '' });
        setAvailability([]);
        setAdminRole('none');
        setPermissions({ ...DEFAULT_PERMISSIONS });
      });
    }
  }, [employee, isNew]);

  const toggleDay = (day: string) => {
    setAvailability((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const togglePermission = (key: keyof EmployeePermissions) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleGroup = (group: string) => {
    const groupKeys = PERMISSION_AREAS.filter((a) => a.group === group).map((a) => a.key);
    const allOn = groupKeys.every((key) => permissions[key]);
    setPermissions((prev) => {
      const next = { ...prev };
      groupKeys.forEach((key) => {
        next[key] = !allOn;
      });
      return next;
    });
  };

  const groupedPermissions = GROUP_ORDER.reduce<Record<string, typeof PERMISSION_AREAS>>((acc, group) => {
    acc[group] = PERMISSION_AREAS.filter((a) => a.group === group);
    return acc;
  }, {});

  const enabledCount = PERMISSION_AREAS.filter((a) => permissions[a.key]).length;

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      showToast('Name and email are required', 'error');
      return;
    }
    if (!formData.hourly_rate || parseFloat(formData.hourly_rate) <= 0) {
      showToast('Hourly rate is required', 'error');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        role: formData.role,
        hourly_rate: parseFloat(formData.hourly_rate),
        overtime_multiplier: parseFloat(formData.overtime_multiplier) || 1.5,
        status: formData.status,
        availability_days: availability,
        notes: formData.notes || null,
        admin_role: adminRole as AdminRole,
        permissions: adminRole === 'admin' ? null : adminRole === 'none' ? null : permissions,
      };

      if (isNew) {
        const result = await createEmployee.mutateAsync(payload);
        if (adminRole !== 'none' && password.trim()) {
          await setEmployeePassword.mutateAsync({ employeeId: result.id, password: password.trim() });
        }
        showToast('Employee created successfully');
        navigate('/admin/employees');
      } else if (employee) {
        await updateEmployee.mutateAsync({ id: employee.id, ...payload });
        if (password.trim()) {
          await setEmployeePassword.mutateAsync({ employeeId: employee.id, password: password.trim() });
        }
        showToast('Employee updated successfully');
      }
    } catch (err: unknown) {
      showToast('Failed to save employee: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  const handleConnectStripe = async () => {
    if (!employee) return;
    try {
      if (!employee.stripe_account_id) {
        const result = await createStripeAccount.mutateAsync({ employeeId: employee.id, email: employee.email });
        if (result?.url) window.open(result.url, '_blank');
      } else if (!employee.stripe_onboarding_complete) {
        const result = await generateOnboardingLink.mutateAsync({ stripeAccountId: employee.stripe_account_id });
        if (result?.url) window.open(result.url, '_blank');
      }
    } catch (err: unknown) {
      showToast('Failed to connect Stripe: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  if (!isNew && isLoading) return <LoadingSpinner />;

  const isSaving = createEmployee.isPending || updateEmployee.isPending || setEmployeePassword.isPending;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/employees')} className="p-2 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {isNew ? 'New Employee' : 'Edit Employee'}
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {isNew ? 'Add a new team member' : `Editing ${employee?.name || 'employee'}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Employee Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Name *" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder="Jane Doe" />
                <Input label="Email *" type="email" value={formData.email} onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))} placeholder="jane@example.com" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Phone" type="tel" value={formData.phone} onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))} placeholder="(555) 123-4567" />
                <Select label="Job Role *" options={[{ value: 'instructor', label: 'Instructor' }, { value: 'artist', label: 'Artist' }, { value: 'host', label: 'Host' }]} value={formData.role} onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value as EmployeeRole }))} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Hourly Rate ($) *" type="number" step="0.01" min="0" placeholder="0.00" value={formData.hourly_rate} onChange={(e) => setFormData((prev) => ({ ...prev, hourly_rate: e.target.value }))} />
                <Input label="Overtime Multiplier" type="number" step="0.1" placeholder="1.5" value={formData.overtime_multiplier} onChange={(e) => setFormData((prev) => ({ ...prev, overtime_multiplier: e.target.value }))} />
              </div>
              {!isNew && (
                <Select label="Status" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} value={formData.status} onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as EmployeeStatus }))} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Default Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {days.map((day) => {
                  const isChecked = availability.includes(day);
                  return (
                    <label key={day} className="flex flex-col items-center gap-1 p-2 rounded-lg border cursor-pointer transition-colors"
                      style={{ borderColor: isChecked ? 'var(--primary-color)' : 'var(--border-color)', backgroundColor: isChecked ? 'color-mix(in srgb, var(--primary-color) 10%, transparent)' : 'transparent' }}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleDay(day)} className="sr-only" />
                      <span className="text-xs font-medium" style={{ color: isChecked ? 'var(--primary-color)' : 'var(--text-muted)' }}>{dayLabels[day].slice(0, 3)}</span>
                      <div className="w-4 h-4 rounded border-2 flex items-center justify-center"
                        style={{ borderColor: isChecked ? 'var(--primary-color)' : 'var(--border-color)', backgroundColor: isChecked ? 'var(--primary-color)' : 'transparent' }}>
                        {isChecked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Admin Role"
                options={[
                  { value: 'none', label: 'No admin access' },
                  { value: 'staff', label: 'Staff — Custom permissions' },
                  { value: 'manager', label: 'Manager — Custom permissions' },
                  { value: 'admin', label: 'Admin — Full access' },
                ]}
                value={adminRole}
                onChange={(e) => setAdminRole(e.target.value as AdminRole)}
              />
              {(adminRole !== 'none') && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    {isNew ? 'Password *' : 'Set Password' + (employee?.password_hash ? '' : ' (required)')}
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isNew ? 'Required for login' : 'Leave blank to keep current'}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                      <Lock className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Passwords are stored using bcrypt encryption.
                  </p>
                </div>
              )}
              {adminRole === 'admin' && (
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)', border: '1px solid var(--border-color)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheckIcon className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Full Admin Access</span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Admin accounts have unrestricted access to all areas. No permission configuration needed.
                  </p>
                </div>
              )}
              {(adminRole === 'manager' || adminRole === 'staff') && (
                <>
                  <div className="border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2 mb-4">
                      <Shield className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Permissions</span>
                      <span className="text-sm ml-auto" style={{ color: 'var(--text-muted)' }}>{enabledCount} of {PERMISSION_AREAS.length} enabled</span>
                    </div>
                    <div className="space-y-6">
                      {GROUP_ORDER.map((group) => {
                        const areas = groupedPermissions[group] || [];
                        const groupKeys = areas.map((a) => a.key);
                        const allOn = groupKeys.every((key) => permissions[key]);
                        const someOn = groupKeys.some((key) => permissions[key]) && !allOn;
                        return (
                          <div key={group}>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{group}</h3>
                              <button onClick={() => toggleGroup(group)} className="text-xs font-medium px-2 py-1 rounded"
                                style={{ backgroundColor: allOn ? 'var(--primary-color)' : someOn ? 'var(--primary-color)' : 'transparent', color: allOn ? '#fff' : someOn ? '#fff' : 'var(--text-muted)', opacity: allOn ? 1 : someOn ? 0.7 : 1 }}>
                                {allOn ? 'All on' : someOn ? 'Some on' : 'All off'}
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {areas.map((area) => {
                                const Icon = area.icon;
                                return (
                                  <label key={area.key} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:opacity-90"
                                    style={{ backgroundColor: permissions[area.key] ? 'color-mix(in srgb, var(--primary-color) 10%, transparent)' : 'transparent' }}>
                                    <input type="checkbox" checked={!!permissions[area.key]} onChange={() => togglePermission(area.key)} className="rounded" />
                                    <Icon className="h-4 w-4" style={{ color: permissions[area.key] ? 'var(--primary-color)' : 'var(--text-muted)' }} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{area.label}</p>
                                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{area.description}</p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {enabledCount === 0 && (
                    <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                      <p className="text-sm" style={{ color: '#991b1b' }}>This account won't be able to access any admin areas.</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={formData.notes} onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Any additional notes about this employee..." rows={4} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Admin Access</span>
                <p className="text-sm font-medium" style={{ color: adminRole !== 'none' ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                  {adminRole === 'admin' ? 'Full Admin' : adminRole === 'manager' ? 'Manager' : adminRole === 'staff' ? 'Staff' : 'None'}
                </p>
                {adminRole !== 'none' && adminRole !== 'admin' && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{enabledCount} of {PERMISSION_AREAS.length} permissions enabled</p>
                )}
              </div>
              {!isNew && employee && (
                <>
                  <div className="border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Stripe Status</span>
                    <div className="flex items-center gap-2 mt-1">
                      <CreditCard className="h-4 w-4" style={{ color: employee.stripe_onboarding_complete ? '#22c55e' : 'var(--text-muted)' }} />
                      <span className="text-sm font-medium" style={{ color: employee.stripe_onboarding_complete ? '#22c55e' : 'var(--text-primary)' }}>
                        {employee.stripe_onboarding_complete ? 'Connected' : employee.stripe_account_id ? 'Incomplete' : 'Not Connected'}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2" onClick={handleConnectStripe} disabled={createStripeAccount.isPending || generateOnboardingLink.isPending}>
                      <CreditCard className="h-4 w-4 mr-1" />
                      {employee.stripe_account_id ? 'Complete Setup' : 'Connect Stripe'}
                    </Button>
                  </div>
                  <div className="border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Hourly Rate</span>
                    <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{employee.hourly_rate ? formatCurrency(employee.hourly_rate) : '—'}</p>
                  </div>
                </>
              )}
              <div className="border-t pt-4 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
                {(!isNew && employee) && (
                  <>
                    <div>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Created</span>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{new Date(employee.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Updated</span>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{new Date(employee.updated_at).toLocaleDateString()}</p>
                    </div>
                  </>
                )}
              </div>
              <div className="pt-2 space-y-2">
                <Button onClick={handleSave} disabled={isSaving} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {isNew ? 'Create Employee' : 'Save Changes'}
                </Button>
                <Button variant="secondary" onClick={() => navigate('/admin/employees')} className="w-full">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
