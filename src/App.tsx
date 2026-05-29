import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, Component, lazy, Suspense, type ReactNode, type ErrorInfo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('App crash:', error, info); }
  render() {
    if (this.state.error) {
      return <div style={{ padding: 40, fontFamily: 'monospace' }}><h1 style={{ color: 'red' }}>Application Error</h1><pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 16, borderRadius: 8 }}>{this.state.error.message}{'\n\n'}{this.state.error.stack}</pre></div>;
    }
    return this.props.children;
  }
}
import { PublicLayout } from './components/layout/PublicLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { ToastProvider } from './components/ui/Toast';
import { ThemeProvider } from './hooks/useTheme';
import { AuthGuard } from './components/auth/AuthGuard';
import { CustomerAuthGuard } from './components/auth/CustomerAuthGuard';
import { AuthProvider } from './hooks/useAuth';
import { CustomerAuthProvider } from './hooks/useCustomerAuth';
import { AnalyticsTracker } from './components/analytics/AnalyticsTracker';

const HomePage = lazy(() => import('./pages/public/HomePage'));
const EventsPage = lazy(() => import('./pages/public/EventsPage'));
const EventDetailPage = lazy(() => import('./pages/public/EventDetailPage'));
const CheckoutPage = lazy(() => import('./pages/public/CheckoutPage'));
const CheckoutSuccessPage = lazy(() => import('./pages/public/CheckoutSuccessPage'));
const AccountLoginPage = lazy(() => import('./pages/public/AccountLoginPage'));
const AccountPage = lazy(() => import('./pages/public/AccountPage'));
const BlogPage = lazy(() => import('./pages/public/BlogPage'));
const BlogDetailPage = lazy(() => import('./pages/public/BlogDetailPage'));
const GalleriesPage = lazy(() => import('./pages/public/GalleriesPage'));
const ShopPage = lazy(() => import('./pages/public/ShopPage'));
const ProductDetailPage = lazy(() => import('./pages/public/ProductDetailPage'));
const CartPage = lazy(() => import('./pages/public/CartPage'));
const FAQsPage = lazy(() => import('./pages/public/FAQsPage'));
const GiftCardPage = lazy(() => import('./pages/public/GiftCardPage'));
const UnsubscribePage = lazy(() => import('./pages/public/UnsubscribePage'));
const PrivateEventRequestPage = lazy(() => import('./pages/public/PrivateEventRequestPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const AdminEventsPage = lazy(() => import('./pages/admin/EventsPage'));
const AdminVenuesPage = lazy(() => import('./pages/admin/VenuesPage'));
const AdminCouponsPage = lazy(() => import('./pages/admin/CouponsPage'));
const AdminSalesPage = lazy(() => import('./pages/admin/SalesPage'));
const AdminBlogPage = lazy(() => import('./pages/admin/BlogPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const AdminGalleriesPage = lazy(() => import('./pages/admin/GalleriesPage'));
const EditBlogPage = lazy(() => import('./pages/admin/EditBlogPage'));
const EditEventPage = lazy(() => import('./pages/admin/EditEventPage'));
const DebugBlogPage = lazy(() => import('./pages/admin/DebugBlogPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const TrashPage = lazy(() => import('./pages/admin/TrashPage'));
const AttendeesPage = lazy(() => import('./pages/admin/AttendeesPage'));
const AdminTestimonialsPage = lazy(() => import('./pages/admin/TestimonialsPage'));
const AdminFAQsPage = lazy(() => import('./pages/admin/FAQsPage'));
const AdminLoginPage = lazy(() => import('./pages/admin/LoginPage'));
const GiftCardsPage = lazy(() => import('./pages/admin/GiftCardsPage'));
const MembershipsPage = lazy(() => import('./pages/admin/MembershipsPage'));
const WaitlistPage = lazy(() => import('./pages/admin/WaitlistPage'));
const ReferralsPage = lazy(() => import('./pages/admin/ReferralsPage'));
const ActivityLogPage = lazy(() => import('./pages/admin/ActivityLogPage'));
const EmailCenterPage = lazy(() => import('./pages/admin/EmailCenterPage'));
const MarketingCenterPage = lazy(() => import('./pages/admin/MarketingCenterPage'));
const ChatPage = lazy(() => import('./pages/admin/ChatPage'));
const AssistantPage = lazy(() => import('./pages/admin/AssistantPage'));
const NotificationsPage = lazy(() => import('./pages/admin/NotificationsPage'));
const AdminProductsPage = lazy(() => import('./pages/admin/ProductsPage'));
const AdminProductCategoriesPage = lazy(() => import('./pages/admin/ProductCategoriesPage'));
const AdminProductOrdersPage = lazy(() => import('./pages/admin/ProductOrdersPage'));
const AdminCustomersPage = lazy(() => import('./pages/admin/CustomersPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/ReportsPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage'));

const AdminSupportCenterPage = lazy(() => import('./pages/admin/SupportCenterPage'));
const TimeClockPage = lazy(() => import('./pages/admin/TimeClockPage'));
const TimeTrackingPage = lazy(() => import('./pages/admin/TimeTrackingPage'));
const PayrollReportPage = lazy(() => import('./pages/admin/PayrollReportPage'));
const EmployeesPage = lazy(() => import('./pages/admin/EmployeesPage'));
const EmployeeDetailPage = lazy(() => import('./pages/admin/EmployeeDetailPage'));
const EditEmployeePage = lazy(() => import('./pages/admin/EditEmployeePage'));
const PayQueuePage = lazy(() => import('./pages/admin/PayQueuePage'));
const AssignmentsPage = lazy(() => import('./pages/admin/AssignmentsPage'));
const PrivateRequestsPage = lazy(() => import('./pages/admin/PrivateRequestsPage'));
const CorporateAccountsPage = lazy(() => import('./pages/admin/CorporateAccountsPage'));
const CorporateAccountDetailPage = lazy(() => import('./pages/admin/CorporateAccountDetailPage'));
const EditCorporateAccountPage = lazy(() => import('./pages/admin/EditCorporateAccountPage'));
const CorporateInvoicesPage = lazy(() => import('./pages/admin/CorporateInvoicesPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <CustomerAuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <BrowserRouter>
            <ScrollToTop />
            <AnalyticsTracker />
            <ErrorBoundary>
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" /></div>}>
            <Routes>
            <Route path="/debug-blog" element={<DebugBlogPage />} />
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/events/:slug" element={<EventDetailPage />} />
              <Route path="/checkout/:slug" element={<CheckoutPage />} />
              <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/blog/:slug" element={<BlogDetailPage />} />
              <Route path="/galleries" element={<GalleriesPage />} />
              <Route path="/faqs" element={<FAQsPage />} />
<Route path="/gift-cards" element={<GiftCardPage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/shop/:slug" element={<ProductDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/unsubscribe" element={<UnsubscribePage />} />
              <Route path="/private-events" element={<PrivateEventRequestPage />} />
              <Route path="/account/login" element={<AccountLoginPage />} />
              <Route path="/account" element={<CustomerAuthGuard><AccountPage /></CustomerAuthGuard>} />
            </Route>
            
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={
              <AuthGuard>
                <AdminLayout />
              </AuthGuard>
            }>
              <Route index element={<AdminDashboardPage />} />
              <Route path="events" element={<AdminEventsPage />} />
              <Route path="events/new" element={<EditEventPage />} />
              <Route path="events/:id" element={<EditEventPage />} />
              <Route path="venues" element={<AdminVenuesPage />} />
              <Route path="coupons" element={<AdminCouponsPage />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="product-categories" element={<AdminProductCategoriesPage />} />
              <Route path="product-orders" element={<AdminProductOrdersPage />} />
              <Route path="sales" element={<AdminSalesPage />} />
              <Route path="blog" element={<AdminBlogPage />} />
            <Route path="blog/new" element={<EditBlogPage />} />
<Route path="blog/:id" element={<EditBlogPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
              <Route path="galleries" element={<AdminGalleriesPage />} />
<Route path="accounts" element={<Navigate to="/admin/employees" replace />} />
               <Route path="accounts/new" element={<Navigate to="/admin/employees/new" replace />} />
               <Route path="accounts/:id" element={<Navigate to="/admin/employees" replace />} />
              <Route path="time-clock" element={<TimeClockPage />} />
              <Route path="time-tracking" element={<TimeTrackingPage />} />
              <Route path="payroll" element={<PayrollReportPage />} />
              <Route path="trash" element={<TrashPage />} />
              <Route path="attendees" element={<AttendeesPage />} />
              <Route path="testimonials" element={<AdminTestimonialsPage />} />
              <Route path="faqs" element={<AdminFAQsPage />} />
              <Route path="submissions" element={<Navigate to="/admin/private-requests" replace />} />
              <Route path="gift-cards" element={<GiftCardsPage />} />
              <Route path="memberships" element={<MembershipsPage />} />
              <Route path="customers" element={<AdminCustomersPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="waitlist" element={<WaitlistPage />} />
              <Route path="newsletter" element={<Navigate to="/admin/email" replace />} />
              <Route path="referrals" element={<ReferralsPage />} />
              <Route path="activity-log" element={<ActivityLogPage />} />
              <Route path="revenue" element={<Navigate to="/admin/reports" replace />} />
              <Route path="bulk-email" element={<Navigate to="/admin/email" replace />} />
              <Route path="email" element={<EmailCenterPage />} />
              <Route path="marketing" element={<MarketingCenterPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="assistant" element={<AssistantPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="analytics" element={<AdminAnalyticsPage />} />
              <Route path="onboarding" element={<Navigate to="/admin" replace />} />
              <Route path="support" element={<AdminSupportCenterPage />} />
              <Route path="shop" element={<Navigate to="/admin/products" replace />} />
<Route path="employees" element={<EmployeesPage />} />
               <Route path="employees/new" element={<EditEmployeePage />} />
               <Route path="employees/:id" element={<EmployeeDetailPage />} />
               <Route path="employees/:id/edit" element={<EditEmployeePage />} />
              <Route path="pay-queue" element={<PayQueuePage />} />
              <Route path="assignments" element={<AssignmentsPage />} />
              <Route path="private-requests" element={<PrivateRequestsPage />} />
              <Route path="corporate-accounts" element={<CorporateAccountsPage />} />
              <Route path="corporate-accounts/new" element={<EditCorporateAccountPage />} />
              <Route path="corporate-accounts/:id" element={<CorporateAccountDetailPage />} />
              <Route path="corporate-invoices" element={<CorporateInvoicesPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
          </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </CustomerAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
