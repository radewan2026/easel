import { Outlet, Link, useLocation, useNavigate, type Location } from 'react-router-dom';
import { useState, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { AdminChatBot } from '../ui/AdminChatBot';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard,
  Calendar,
  Tag,
  ShoppingCart,
  Users,
  Menu,
  X,
  LogOut,
  Palette,
  Search,
  ChevronRight,
  UserCircle,
  Trash2,
  MessageCircle,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  Mail,
  Share2,
  Activity,
  BarChart3,
  Send,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  FileText,
  Settings,
  Package,
  Clock,
  Sparkles,
  CreditCard,
  LifeBuoy,
  type LucideIcon,
} from 'lucide-react';
import { useEvents } from '../../hooks/useEvents';
import { usePendingChatCount } from '../../hooks/useChat';
import { useVenues } from '../../hooks/useEvents';
import { useCoupons } from '../../hooks/useEvents';
import { useEmployees } from '../../hooks/useEmployees';
import { useBlogPosts } from '../../hooks/useBlog';
import { useTestimonials } from '../../hooks/useTestimonials';
import { useFAQs } from '../../hooks/useFAQs';
import { useSubmissions } from '../../hooks/useSubmissions';
import { useOrders } from '../../hooks/useEvents';
import { useProducts } from '../../hooks/useProducts';
import { useGiftCards } from '../../hooks/useGiftCards';
import { useGalleries } from '../../hooks/useGallery';
import { useCorporateAccounts } from '../../hooks/useCorporateAccounts';
import { useTheme } from '../../hooks/useTheme';
import { useOwnerActionFeed } from '../../hooks/useOwnerActionFeed';
import { useFeatures } from '../../hooks/useTenantPlan';
import { cn } from '../../lib/utils';

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

type NavChild = { name: string; href: string };
type NavItem = { name: string; icon: LucideIcon; href?: string; standalone?: boolean; children?: NavChild[] };
type SearchResult = { title: string; section: string; action: () => void; icon?: LucideIcon; detail?: string };
type BrowserWindowWithAudio = Window & { webkitAudioContext?: typeof AudioContext };
type ThemeOption = 'light' | 'dark' | 'system';

function NavSection({ item, location, sidebarCollapsed, onClick, expandedSection, onToggle }: { 
  item: NavItem;
  location: Location;
  sidebarCollapsed: boolean;
  onClick: () => void;
  expandedSection: string | null;
  onToggle: (name: string | null) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isAnyChildActive = item.children?.some(
    child => location.pathname === child.href || (child.href !== '/admin' && location.pathname.startsWith(child.href + '/'))
  );
  const expanded = expandedSection === item.name || isAnyChildActive;

  const handleToggle = () => {
    onToggle(expandedSection === item.name ? null : item.name);
  };

  if (sidebarCollapsed) {
    return (
      <div className="relative group">
        <button
          onClick={handleToggle}
          className="flex items-center justify-center w-full py-3 text-sm font-medium rounded-lg transition-colors"
          style={{ color: isAnyChildActive ? 'var(--admin-sidebar-active-text)' : 'var(--admin-sidebar-text)', backgroundColor: isAnyChildActive ? 'var(--admin-sidebar-active-bg)' : 'transparent' }}
        >
          <item.icon className="h-5 w-5" />
        </button>
        <div className="absolute left-full top-0 ml-1 hidden group-hover:block z-50">
          <div className="flex flex-col py-1 rounded-lg shadow-lg min-w-[140px]" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <div className="px-3 py-2 text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>
              {item.name}
            </div>
            {item.children?.map(child => {
              const isActive = location.pathname === child.href;
              return (
                <Link
                  key={child.name}
                  to={child.href}
                  onClick={onClick}
                  className="px-3 py-2 text-sm hover:opacity-80"
                  style={{ 
                    backgroundColor: isActive ? 'var(--primary-color)' : 'transparent',
                    color: isActive ? 'white' : 'var(--text-primary)'
                  }}
                >
                  {child.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleToggle}
        className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:opacity-80"
        style={{ color: isAnyChildActive || expanded ? 'var(--admin-sidebar-active-text)' : 'var(--admin-sidebar-text)', backgroundColor: isAnyChildActive || expanded ? 'var(--admin-sidebar-active-bg)' : 'transparent' }}
      >
        <div className="flex items-center">
          <item.icon className="h-4 w-4 mr-3" />
          {item.name}
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
      </button>
      <div 
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ 
          maxHeight: expanded ? '500px' : '0px',
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="ml-4 pl-2 border-l space-y-1" style={{ borderColor: 'var(--admin-sidebar-border)' }}>
          {item.children?.map(child => {
            const isActive = location.pathname === child.href;
            return (
              <Link
                key={child.name}
                to={child.href}
                onClick={onClick}
                className="flex items-center px-3 py-2 text-sm rounded-lg transition-colors"
                style={{ 
                  backgroundColor: isActive ? 'var(--admin-sidebar-active)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--admin-sidebar-text)'
                }}
              >
                {child.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, standalone: true },
  { name: 'Support Center', href: '/admin/support', icon: LifeBuoy, standalone: true },
  { name: 'Ask Easel', href: '/admin/assistant', icon: Sparkles, standalone: true },
  { 
    name: 'Bookings', 
    icon: Calendar, 
    children: [
      { name: 'Events', href: '/admin/events' },
      { name: 'Attendees', href: '/admin/attendees' },
      { name: 'Private Requests', href: '/admin/private-requests' },
      { name: 'Waitlist', href: '/admin/waitlist' },
    ]
  },
  {
    name: 'Transactions', 
    icon: ShoppingCart, 
    children: [
      { name: 'Orders', href: '/admin/sales' },
      { name: 'Corporate Invoices', href: '/admin/corporate-invoices' },
      { name: 'Shop Orders', href: '/admin/product-orders' },
    ]
  },
  {
    name: 'Customers', 
    icon: Users, 
    children: [
      { name: 'All Customers', href: '/admin/customers' },
      { name: 'Corporate Accounts', href: '/admin/corporate-accounts' },
      { name: 'Memberships', href: '/admin/memberships' },
    ]
  },
  {
    name: 'Marketing',
    icon: Send,
    children: [
      { name: 'Email', href: '/admin/email' },
      { name: 'Blog', href: '/admin/blog' },
      { name: 'Marketing Center', href: '/admin/marketing' },
      { name: 'FAQs', href: '/admin/faqs' },
      { name: 'Testimonials', href: '/admin/testimonials' },
      { name: 'Galleries', href: '/admin/galleries' },
      { name: 'Coupons', href: '/admin/coupons' },
      { name: 'Gift Cards', href: '/admin/gift-cards' },
      { name: 'Referrals', href: '/admin/referrals' },
    ]
  },
  { 
    name: 'Operations', 
    icon: Clock, 
    children: [
      { name: 'Employees', href: '/admin/employees' },
      { name: 'Time Clock', href: '/admin/time-clock' },
      { name: 'Time Tracking', href: '/admin/time-tracking' },
      { name: 'Payroll', href: '/admin/payroll' },
      { name: 'Pay Queue', href: '/admin/pay-queue' },
      { name: 'Products', href: '/admin/products' },
      { name: 'Product Categories', href: '/admin/product-categories' },
      { name: 'Assignments', href: '/admin/assignments' },
      { name: 'Venues', href: '/admin/venues' },
    ]
  },
  {
    name: 'Reports & Analytics',
    icon: BarChart3,
    children: [
      { name: 'Reports', href: '/admin/reports' },
      { name: 'Analytics', href: '/admin/analytics' },
    ]
  },
  { name: 'Account Settings', href: '/admin/settings', icon: Settings, standalone: true },
];

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const { user, logout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { data: events } = useEvents();
  const { data: venues } = useVenues();
  const { data: coupons } = useCoupons();
  const { data: accounts } = useEmployees();
  const { data: blogPosts } = useBlogPosts();
  const { data: testimonials } = useTestimonials();
  const { data: faqs } = useFAQs();
  const { data: submissions } = useSubmissions();
  const { data: orders } = useOrders();
  const { data: products } = useProducts();
  const { data: giftCards } = useGiftCards();
  const { data: galleries } = useGalleries();
  const { data: corporateAccounts } = useCorporateAccounts();
  const { data: pendingChatCount } = usePendingChatCount();
  const ownerActionFeed = useOwnerActionFeed();
  const { planName } = useFeatures();

  const playRingSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as BrowserWindowWithAudio).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.3);
      oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.45);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.6);
    } catch (error) {
      console.debug('Audio not supported', error);
    }
  };

  const prevPendingCountRef = useRef(-1);
  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (pendingChatCount === undefined) return;
    // Only play ring after first load completes and when count increases
    if (!isFirstLoad.current && pendingChatCount > 0 && pendingChatCount > prevPendingCountRef.current) {
      playRingSound();
    }
    prevPendingCountRef.current = pendingChatCount;
    isFirstLoad.current = false;
  }, [pendingChatCount]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!e?.target) return;
      const target = e.target as HTMLElement;
      if (!target.closest('.search-container') && !target.closest('.search-results')) {
        setSearchOpen(false);
      }
    };
    
    let timeoutId: ReturnType<typeof setTimeout>;
    const debouncedHandler = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleClickOutside, 200);
    };
    
    document.addEventListener('click', debouncedHandler);
    return () => {
      document.removeEventListener('click', debouncedHandler);
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = () => setUserMenuOpen(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!themeMenuOpen) return;
    const handleClickOutside = () => setThemeMenuOpen(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [themeMenuOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const handleClickOutside = () => setNotificationsOpen(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [notificationsOpen]);

  const commandItems = useMemo(() => [
    { title: 'Create event', section: 'Command', icon: Calendar, terms: ['new event', 'add event', 'class'], action: () => navigate('/admin/events/new') },
    { title: 'Create coupon', section: 'Command', icon: Tag, terms: ['discount', 'promo code', 'promotion'], action: () => navigate('/admin/coupons') },
    { title: 'Add employee', section: 'Command', icon: Users, terms: ['staff', 'team member', 'instructor'], action: () => navigate('/admin/employees/new') },
    { title: 'Open Ask Easel workspace', section: 'Command', icon: Sparkles, terms: ['assistant', 'ai', 'help'], action: () => navigate('/admin/assistant') },
    { title: 'Open live chat inbox', section: 'Command', icon: MessageCircle, terms: ['chat', 'customer messages', 'support'], action: () => navigate('/admin/chat') },
    { title: 'Review private requests', section: 'Command', icon: Inbox, terms: ['private event', 'leads', 'pipeline'], action: () => navigate('/admin/private-requests') },
    { title: 'Open notification center', section: 'Command', icon: Bell, terms: ['notifications', 'alerts', 'owner actions', 'action feed'], action: () => navigate('/admin/notifications') },
    { title: 'Open memberships', section: 'Command', icon: CreditCard, terms: ['subscriptions', 'credits', 'membership credits', 'plans'], action: () => navigate('/admin/memberships') },
    { title: 'Open email center', section: 'Command', icon: Mail, terms: ['campaign', 'newsletter', 'marketing', 'automations', 'templates'], action: () => navigate('/admin/email') },
    { title: 'Send email campaign', section: 'Command', icon: Mail, terms: ['simple email', 'blast', 'attendees', 'bulk email', 'newsletter'], action: () => navigate('/admin/email') },
    { title: 'Review payroll queue', section: 'Command', icon: CreditCard, terms: ['pay', 'payments', 'pay queue'], action: () => navigate('/admin/pay-queue') },
    { title: 'Open reports', section: 'Command', icon: BarChart3, terms: ['sales report', 'revenue'], action: () => navigate('/admin/reports') },
    { title: 'Open frontend analytics', section: 'Command', icon: BarChart3, terms: ['analytics', 'page views', 'clicks', 'funnels', 'tracking'], action: () => navigate('/admin/analytics') },
    { title: 'Open launch checklist', section: 'Command', icon: Settings, terms: ['onboarding', 'launch', 'go live', 'setup checklist'], action: () => navigate('/admin/onboarding') },
    { title: 'Open support center', section: 'Command', icon: LifeBuoy, terms: ['support', 'help', 'case', 'ticket', 'export', 'revenue blocker'], action: () => navigate('/admin/support') },
    { title: 'Open settings', section: 'Command', icon: Settings, terms: ['configuration', 'site settings', 'api'], action: () => navigate('/admin/settings') },
  ], [navigate]);

  const searchResults = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    commandItems.forEach(command => {
      const haystack = [command.title, command.section, ...command.terms].join(' ').toLowerCase();
      if (!searchQuery.trim() || haystack.includes(query)) {
        results.push({ title: command.title, section: command.section, action: command.action, icon: command.icon });
      }
    });

    if (!searchQuery.trim()) {
      ownerActionFeed.slice(0, 4).forEach(item => {
        results.push({
          title: item.summary,
          section: item.urgent ? 'Needs attention' : 'Recent activity',
          detail: item.detail,
          action: () => navigate(item.to),
          icon: Bell,
        });
      });
      return results.slice(0, 12);
    }

    events?.forEach(e => {
      if (e.title.toLowerCase().includes(query) || e.slug?.toLowerCase().includes(query)) {
        results.push({ title: e.title, section: 'Events', action: () => navigate(`/admin/events/${e.id}`) });
      }
    });

    venues?.forEach(v => {
      if (v.name.toLowerCase().includes(query) || v.city?.toLowerCase().includes(query)) {
        results.push({ title: v.name, section: 'Venues', action: () => navigate('/admin/venues') });
      }
    });

    coupons?.forEach(c => {
      if (c.code.toLowerCase().includes(query)) {
        results.push({ title: c.code, section: 'Coupons', action: () => navigate('/admin/coupons') });
      }
    });

    accounts?.forEach(a => {
      if (a.name.toLowerCase().includes(query) || a.email.toLowerCase().includes(query)) {
        results.push({ title: a.name, section: 'Employees', action: () => navigate('/admin/employees') });
      }
    });

    blogPosts?.forEach(p => {
      if (p.title.toLowerCase().includes(query) || p.slug?.toLowerCase().includes(query)) {
        results.push({ title: p.title, section: 'Blog', action: () => navigate(`/admin/blog/${p.id}`) });
      }
    });

    testimonials?.forEach(t => {
      if (t.author_name?.toLowerCase().includes(query) || t.content?.toLowerCase().includes(query)) {
        results.push({ title: t.author_name || 'Testimonial', section: 'Testimonials', action: () => navigate('/admin/testimonials') });
      }
    });

    faqs?.forEach(f => {
      if (f.question.toLowerCase().includes(query) || f.answer?.toLowerCase().includes(query)) {
        results.push({ title: f.question.slice(0, 60), section: 'FAQs', action: () => navigate('/admin/faqs') });
      }
    });

    submissions?.forEach(s => {
      if (s.name.toLowerCase().includes(query) || s.email.toLowerCase().includes(query) || s.notes?.toLowerCase().includes(query)) {
        results.push({ title: s.name, section: 'Private Requests', action: () => navigate('/admin/private-requests') });
      }
    });

    orders?.forEach(o => {
      if (o.purchaser_name.toLowerCase().includes(query) || o.purchaser_email.toLowerCase().includes(query)) {
        results.push({ title: `${o.purchaser_name} — ${o.status}`, section: 'Orders', action: () => navigate('/admin/sales') });
      }
    });

    products?.forEach(p => {
      if (p.name.toLowerCase().includes(query)) {
        results.push({ title: p.name, section: 'Products', action: () => navigate('/admin/products') });
      }
    });

    giftCards?.forEach(g => {
      const searchable = [g.code, g.purchaser_name, g.purchaser_email, g.recipient_name || ''].join(' ').toLowerCase();
      if (searchable.includes(query)) {
        results.push({ title: `${g.code} — ${g.purchaser_name}`, section: 'Gift Cards', action: () => navigate('/admin/gift-cards') });
      }
    });

    galleries?.forEach(g => {
      if (g.title.toLowerCase().includes(query)) {
        results.push({ title: g.title, section: 'Galleries', action: () => navigate('/admin/galleries') });
      }
    });

    corporateAccounts?.forEach(c => {
      if (c.company_name.toLowerCase().includes(query) || c.primary_contact_name?.toLowerCase().includes(query)) {
        results.push({ title: c.company_name, section: 'Corporate Accounts', action: () => navigate('/admin/corporate-accounts') });
      }
    });

    return results.slice(0, 12);
  }, [searchQuery, commandItems, ownerActionFeed, events, venues, coupons, accounts, blogPosts, testimonials, faqs, submissions, orders, products, giftCards, galleries, corporateAccounts, navigate]);

  const handleResultClick = (action: () => void) => {
    action();
    setSearchOpen(false);
    setSearchQuery('');
    setSelectedSearchIndex(0);
  };

  return (
    <div className="min-h-screen overflow-x-hidden admin-layout" style={{ backgroundColor: 'var(--admin-bg)' }}>
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => { setSidebarOpen(false); setExpandedSection(null); }}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col transform transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-64',
          isMobile ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'
        )}
        style={{ backgroundColor: 'var(--admin-sidebar)' }}
      >
        <div className={cn(
          'flex h-16 items-center border-b transition-all duration-300',
          sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-4'
        )} style={{ borderColor: 'var(--admin-sidebar-border)' }}>
          <Link to="/admin" className="flex items-center gap-2">
            <Palette className={cn('flex-shrink-0', sidebarCollapsed ? 'h-7 w-7' : 'h-8 w-8')} style={{ color: '#eb6a3d' }} />
            {!sidebarCollapsed && <span className="text-xl font-bold text-white">Paint & Sip</span>}
          </Link>
          <button
            className="lg:hidden"
            style={{ color: 'var(--admin-sidebar-text)' }}
            onClick={() => { setSidebarOpen(false); setExpandedSection(null); }}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className={cn('flex-1 min-h-0 px-2 py-4 space-y-1 overflow-y-auto', sidebarCollapsed && 'px-1')}>
          {navigation.map((item) => {
            if (item.standalone) {
              const href = item.href || '/admin';
              const isActive = location.pathname === href ||
                (href !== '/admin' && location.pathname.startsWith(href));
              return (
                <Link
                  key={item.name}
                  to={href}
                  title={sidebarCollapsed ? item.name : undefined}
                  className={cn(
                    'flex items-center text-sm font-medium rounded-lg transition-colors',
                    sidebarCollapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'
                  )}
                  style={{ 
                    backgroundColor: isActive ? 'var(--admin-sidebar-active-bg)' : 'transparent',
                    color: isActive ? 'var(--admin-sidebar-active-text)' : 'var(--admin-sidebar-text)'
                  }}
                  onClick={() => { setSidebarOpen(false); setExpandedSection(null); }}
                >
                  <item.icon className={cn('h-5 w-5 flex-shrink-0', !sidebarCollapsed && 'mr-3')} />
                  {!sidebarCollapsed && item.name}
                </Link>
              );
            }
            
            return (
              <NavSection key={item.name} item={item} location={location} sidebarCollapsed={sidebarCollapsed} onClick={() => { setSidebarOpen(false); setExpandedSection(null); }} expandedSection={expandedSection} onToggle={setExpandedSection} />
            );
          })}
        </nav>

        <div className={cn('flex-shrink-0 w-full border-t', sidebarCollapsed ? 'p-2' : 'p-4')} style={{ borderColor: 'var(--admin-sidebar-border)' }}>
          <Link
            to="/"
            title={sidebarCollapsed ? 'Back to Site' : undefined}
            className={cn(
              'flex items-center text-sm font-medium',
              sidebarCollapsed ? 'justify-center px-0 py-2' : 'px-4 py-2'
            )}
            style={{ color: 'var(--admin-sidebar-text)' }}
          >
            <LogOut className={cn('h-5 w-5 flex-shrink-0', !sidebarCollapsed && 'mr-3')} />
            {!sidebarCollapsed && 'Back to Site'}
          </Link>
          {!sidebarCollapsed && (
            <div className="mt-2 px-4 py-2 rounded-lg text-xs font-medium text-center" style={{ backgroundColor: 'var(--admin-sidebar-active-bg)', color: 'var(--admin-sidebar-active-text)' }}>
              {planName} Plan
            </div>
          )}
        </div>
      </aside>

      <div className={cn(
        'min-w-0 max-w-full overflow-x-hidden transition-all duration-300',
        isMobile ? '' : (sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64')
      )}>
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between px-4 border-b" style={{ backgroundColor: 'var(--admin-content)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2">
            {isMobile ? (
              <button
                className="hover:opacity-80"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </button>
            ) : (
              <button
                className="hover:opacity-80 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </button>
            )}
          </div>
          
          <div className="hidden min-w-0 flex-1 max-w-md mr-auto pl-5 search-container sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search or type a command... (Ctrl+K)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedSearchIndex(0);
                  setNotificationsOpen(false);
                }}
                onFocus={() => {
                  setSearchOpen(true);
                  setSelectedSearchIndex(0);
                  setNotificationsOpen(false);
                }}
                onKeyDown={(e) => {
                  if (!searchOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
                    setSearchOpen(true);
                    return;
                  }
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedSearchIndex((index) => Math.min(index + 1, Math.max(searchResults.length - 1, 0)));
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedSearchIndex((index) => Math.max(index - 1, 0));
                  }
                  if (e.key === 'Enter' && searchResults[selectedSearchIndex]) {
                    e.preventDefault();
                    handleResultClick(searchResults[selectedSearchIndex].action);
                  }
                }}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              {searchOpen && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-lg shadow-lg border max-h-80 overflow-y-auto z-50 search-results" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleResultClick(result.action)}
                      className="w-full px-4 py-3 text-left flex items-center justify-between last:border-0"
                      style={{
                        borderColor: 'var(--border-color)',
                        backgroundColor: selectedSearchIndex === idx ? 'var(--admin-input-bg)' : 'transparent',
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {result.icon && (
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--admin-input-bg)', color: 'var(--primary-color)' }}>
                            <result.icon className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{result.title}</div>
                          <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                            {result.section}{result.detail ? ` · ${result.detail}` : ''}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                    </button>
                  ))}
                </div>
              )}
              {searchOpen && searchQuery.trim() && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-lg shadow-lg border p-4 text-sm" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                  No results found
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchOpen(false);
                  setNotificationsOpen(!notificationsOpen);
                }}
                className="relative p-2 rounded-lg hover:opacity-80"
                style={{ color: 'var(--text-secondary)' }}
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {(ownerActionFeed.some(item => item.urgent) || (pendingChatCount || 0) > 0) && (
                  <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2" style={{ '--tw-ring-color': 'var(--admin-content)' } as CSSProperties} />
                )}
              </button>
              {notificationsOpen && (
                <div
                  className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-xl shadow-xl border overflow-hidden z-50"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Owner actions and customer messages</p>
                    </div>
                    <Link
                      to="/admin/notifications"
                      className="text-xs font-medium"
                      style={{ color: 'var(--primary-color)' }}
                      onClick={() => setNotificationsOpen(false)}
                    >
                      View all
                    </Link>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {(pendingChatCount || 0) > 0 && (
                      <button
                        onClick={() => {
                          setNotificationsOpen(false);
                          navigate('/admin/chat');
                        }}
                        className="flex w-full items-start gap-3 border-b px-4 py-3 text-left"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                          <MessageCircle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pendingChatCount} live chat waiting</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Review customer conversations in the live chat inbox.</p>
                        </div>
                      </button>
                    )}
                    {ownerActionFeed.length === 0 && (pendingChatCount || 0) === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <Bell className="mx-auto h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                        <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>All clear</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>No urgent owner actions right now.</p>
                      </div>
                    ) : (
                      ownerActionFeed.slice(0, 8).map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setNotificationsOpen(false);
                            navigate(item.to);
                          }}
                          className="flex w-full items-start gap-3 border-b px-4 py-3 text-left last:border-b-0 hover:opacity-90"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          <div
                            className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: item.urgent ? '#ef4444' : item.tone === 'success' ? '#22c55e' : 'var(--primary-color)' }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.summary}</p>
                              <span className="flex-shrink-0 text-xs font-medium" style={{ color: item.urgent ? '#dc2626' : 'var(--primary-color)' }}>
                                {item.actionLabel}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'var(--text-muted)' }}>{item.detail}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setThemeMenuOpen(!themeMenuOpen);
              }}
              className="p-2 rounded-lg hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}
              title="Toggle theme"
            >
                {resolvedTheme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </button>
              {themeMenuOpen && (
                <div className="absolute right-0 mt-2 w-40 rounded-lg shadow-lg border py-1 z-50" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                  {[
                    { value: 'light', label: 'Light', icon: Sun },
                    { value: 'dark', label: 'Dark', icon: Moon },
                    { value: 'system', label: 'System', icon: Monitor },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => { setTheme(value as ThemeOption); setThemeMenuOpen(false); }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm"
                      style={{ 
                        backgroundColor: 'transparent',
                        color: theme === value ? 'var(--primary-color)' : 'var(--text-secondary)',
                        fontWeight: theme === value ? 500 : 400
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setUserMenuOpen(!userMenuOpen);
                }}
                className="flex items-center gap-2 text-sm hover:opacity-80"
                style={{ color: 'var(--text-secondary)' }}
              >
                {user?.avatar_url ? (
                  <img 
                    src={user.avatar_url} 
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--primary-color), var(--primary-hover))' }}>
                    <span className="text-white font-medium text-sm">{getInitials(user?.name || 'Admin')}</span>
                  </div>
                )}
                <span className="hidden md:inline" style={{ color: 'var(--text-primary)' }}>{user?.name || 'Admin'}</span>
              </button>
              
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg border py-1 z-50" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                  <Link
                    to="/"
                    className="flex items-center gap-2 px-4 py-2 text-sm hover:opacity-80"
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Palette className="h-4 w-4" />
                    View Site
                  </Link>
                  <div className="my-1" style={{ borderColor: 'var(--border-color)', borderTopWidth: '1px' }} />
                  <Link
                    to="/admin/activity-log"
                    className="flex items-center gap-2 px-4 py-2 text-sm hover:opacity-80"
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Activity className="h-4 w-4" />
                    Activity Log
                  </Link>
                  <Link
                    to="/admin/chat"
                    className="flex items-center gap-2 px-4 py-2 text-sm hover:opacity-80"
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Live Chat Inbox
                    {pendingChatCount !== undefined && pendingChatCount > 0 && (
                      <span className="ml-auto w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </Link>
                  <Link
                    to="/admin/trash"
                    className="flex items-center gap-2 px-4 py-2 text-sm hover:opacity-80"
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Trash
                  </Link>
                  <div className="my-1" style={{ borderColor: 'var(--border-color)', borderTopWidth: '1px' }} />
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:opacity-80"
                    style={{ color: '#dc2626' }}
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                      navigate('/admin/login');
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <main className="min-w-0 max-w-full overflow-x-hidden p-4 md:p-6 lg:p-8" style={{ backgroundColor: 'var(--admin-bg)' }}>
          <Outlet context={{ openAssistant: () => setChatDrawerOpen(true) }} />
        </main>

        <AdminChatBot isOpen={chatDrawerOpen} onToggle={() => setChatDrawerOpen(!chatDrawerOpen)} navigate={navigate} pathname={location.pathname} />
      </div>
    </div>
  );
}
