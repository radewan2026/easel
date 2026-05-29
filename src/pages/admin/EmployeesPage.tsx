import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Plus, UserCheck, UserX, CreditCard, Shield } from 'lucide-react';
import { useEmployees } from '../../hooks/useEmployees';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import type { EmployeeRole, AdminRole } from '../../types/database';
import { getStaffReadiness } from '../../lib/adminInsights';

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Roles' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'artist', label: 'Artist' },
  { value: 'host', label: 'Host' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const ADMIN_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Access' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
  { value: 'none', label: 'No Access' },
];

const adminRoleBadgeVariant = (role: AdminRole): 'primary' | 'warning' | 'success' | 'gray' => {
  switch (role) {
    case 'admin': return 'primary';
    case 'manager': return 'warning';
    case 'staff': return 'success';
    default: return 'gray';
  }
};

export default function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [adminRoleFilter, setAdminRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const { data: employees, isLoading } = useEmployees({
    status: statusFilter || undefined,
    role: roleFilter || undefined,
    search: search || undefined,
  });

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    if (!adminRoleFilter) return employees;
    return employees.filter(e => e.admin_role === adminRoleFilter);
  }, [employees, adminRoleFilter]);

  const readiness = useMemo(() => getStaffReadiness(employees || []), [employees]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedEmployees = filteredEmployees.slice((currentPageSafe - 1) * pageSize, currentPageSafe * pageSize);

  const roleBadgeVariant = (role: EmployeeRole): 'primary' | 'warning' | 'success' | 'gray' => {
    switch (role) {
      case 'instructor': return 'primary';
      case 'artist': return 'warning';
      case 'host': return 'success';
      default: return 'gray';
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Employees</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage staff, instructors, and artists</p>
        </div>
        <Link to="/admin/employees/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Staff Readiness</p>
            <p className="text-2xl font-bold" style={{ color: readiness.readinessScore >= 80 ? '#16a34a' : readiness.readinessScore >= 50 ? '#d97706' : '#dc2626' }}>{readiness.readinessScore}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Active Staff</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{readiness.activeStaff}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Missing Rates</p>
            <p className="text-2xl font-bold" style={{ color: readiness.missingRates ? '#d97706' : 'var(--text-primary)' }}>{readiness.missingRates}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Stripe Incomplete</p>
            <p className="text-2xl font-bold" style={{ color: readiness.stripeIncomplete ? '#d97706' : 'var(--text-primary)' }}>{readiness.stripeIncomplete}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>All Employees</CardTitle>
          <Pagination currentPage={currentPageSafe} totalPages={totalPages} totalItems={filteredEmployees.length} pageSize={pageSize} onPageChange={setCurrentPage} position="top" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm"
                style={{
                  backgroundColor: 'var(--admin-input-bg)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--admin-input-bg)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--admin-input-bg)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={adminRoleFilter}
              onChange={(e) => { setAdminRoleFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--admin-input-bg)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {ADMIN_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Name</th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Email</th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Phone</th>
<th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Job Role</th>
                   <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Admin Access</th>
                   <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Status</th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Hourly Rate</th>
                  <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Stripe Connected</th>
                  <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No employees found
                    </td>
                  </tr>
                ) : (
                  paginatedEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 px-4">
                        <Link
                          to={`/admin/employees/${employee.id}`}
                          className="font-medium hover:underline"
                          style={{ color: 'var(--primary-color)' }}
                        >
                          {employee.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{employee.email}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{employee.phone || '—'}</td>
<td className="py-3 px-4">
                         <Badge variant={roleBadgeVariant(employee.role)}>{employee.role}</Badge>
                       </td>
                       <td className="py-3 px-4">
                         {employee.admin_role && employee.admin_role !== 'none' ? (
                           <span className="inline-flex items-center gap-1">
                             <Shield className="h-3.5 w-3.5" style={{ color: 'var(--primary-color)' }} />
                             <Badge variant={adminRoleBadgeVariant(employee.admin_role)}>{employee.admin_role}</Badge>
                           </span>
                         ) : (
                           <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>
                         )}
                       </td>
                       <td className="py-3 px-4">
                        {employee.status === 'active' ? (
                          <span className="inline-flex items-center gap-1">
                            <UserCheck className="h-3.5 w-3.5" style={{ color: '#16a34a' }} />
                            <Badge variant="success">Active</Badge>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <UserX className="h-3.5 w-3.5" style={{ color: '#dc2626' }} />
                            <Badge variant="danger">Inactive</Badge>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                        {employee.hourly_rate != null ? `$${employee.hourly_rate.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {employee.stripe_onboarding_complete ? (
                          <span className="inline-flex items-center gap-1">
                            <CreditCard className="h-3.5 w-3.5" style={{ color: '#16a34a' }} />
                            <Badge variant="success">Connected</Badge>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <CreditCard className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                            <Badge variant="gray">Not Connected</Badge>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link to={`/admin/employees/${employee.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={currentPageSafe} totalPages={totalPages} totalItems={filteredEmployees.length} pageSize={pageSize} onPageChange={setCurrentPage} position="bottom" />
        </CardContent>
      </Card>
    </div>
  );
}
