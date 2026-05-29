import { Outlet, Link } from 'react-router-dom';
import { Palette, Menu, X, ShoppingCart, UserCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import ExpertBot from '../public/ExpertBot';
import NewsletterPopup from '../public/NewsletterPopup';
import { useCart } from '../../hooks/useCart';
import { useIsAdmin } from '../../hooks/useAuth';

export function PublicLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAdminBanner, setShowAdminBanner] = useState(true);
  const [showFloatingCta, setShowFloatingCta] = useState(false);
  const { getItemCount } = useCart();
  const cartCount = getItemCount();
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    const handleScroll = () => {
      const hero = document.getElementById('hero');
      if (hero) {
        setShowFloatingCta(window.scrollY > hero.offsetHeight - 100);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Workshops', href: '/events' },
    { name: 'Gift Cards', href: '/gift-cards' },
    { name: 'Private Events', href: '/private-events' },
    { name: 'FAQ', href: '/faqs' },
    { name: 'Gallery', href: '/galleries' },
  ];

  return (
    <div className="public-layout min-h-screen flex flex-col bg-white text-slate-900">
      <header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/50 shadow-[0_24px_24px_rgba(15,23,42,0.04)]">
        <div className="flex justify-between items-center h-16 md:h-20 px-5 md:px-8 max-w-7xl mx-auto gap-4">
          <Link to="/" className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-slate-900 font-serif tracking-tight leading-tight">
            <Palette className="h-7 w-7 text-secondary" />
            Paint & Sip
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="text-slate-600 font-medium font-serif hover:text-secondary border-b-2 border-transparent hover:border-secondary pb-1 transition-all duration-300"
              >
                {item.name}
              </Link>
            ))}
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="relative">
                <Link to="/cart" className="p-2 rounded-lg transition-colors relative block" title="Shopping Cart">
                  <ShoppingCart className="h-5 w-5 text-slate-600 hover:text-secondary transition-colors" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-secondary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-label-md">
                      {cartCount}
                    </span>
                  )}
                </Link>
              </div>
              <Link to="/account" className="p-2 rounded-lg transition-colors relative block" title="Customer Account">
                <UserCircle className="h-5 w-5 text-slate-600 hover:text-secondary transition-colors" />
              </Link>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/events"
              className="bg-secondary text-white px-6 py-3 rounded-full font-label-md text-sm hover:bg-secondary/90 transition-all shadow-md whitespace-nowrap active:scale-95"
            >
              Reserve a Spot
            </Link>
          </div>

          <button
            className="md:hidden p-2 text-slate-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md">
            <div className="flex flex-col py-4 px-5 gap-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className="text-slate-600 font-medium font-serif py-2 hover:text-secondary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
                <Link
                  to="/cart"
                  className="text-slate-600 hover:text-secondary transition-colors flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ShoppingCart className="h-5 w-5" />
                  Cart {cartCount > 0 && `(${cartCount})`}
                </Link>
                <Link
                  to="/account"
                  className="text-slate-600 hover:text-secondary transition-colors flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <UserCircle className="h-5 w-5" />
                  Account
                </Link>
              </div>
              <Link
                to="/events"
                className="bg-secondary text-white text-center px-4 py-3 rounded-full font-label-md text-sm mt-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Reserve a Spot
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 pt-16 md:pt-20">
        <Outlet />
      </main>

      {/* ── Floating CTA (desktop) ── */}
      <div className={`hidden lg:block fixed bottom-8 right-8 z-[60] book-now-floating ${showFloatingCta ? 'visible' : ''}`}>
        <Link
          to="/events"
          className="bg-secondary text-white px-8 py-4 rounded-full font-label-md shadow-2xl active:scale-95 transition-all duration-300 flex items-center gap-2"
        >
          <span className="material-symbols-outlined">calendar_month</span>
          Book Now
        </Link>
      </div>

      {/* ── Mobile sticky bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur-md border-t border-surface-container-highest p-3 shadow-[0_-16px_40px_rgba(15,23,42,0.12)] md:hidden">
        <Link
          to="/events"
          className="w-full bg-secondary text-white rounded-full px-5 py-3 flex items-center justify-between gap-4 shadow-lg"
        >
          <span className="text-left">
            <span className="block text-[11px] uppercase tracking-[0.18em] opacity-80">Next Class</span>
            <span className="font-semibold">Book a workshop</span>
          </span>
          <span className="font-label-md whitespace-nowrap">Reserve</span>
        </Link>
      </div>

      {/* ── Footer ── */}
      <footer className="bg-tertiary-container text-surface-container-highest font-display-lg border-t border-white/5">
        <div className="max-w-7xl mx-auto px-8 py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-16">
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-3xl font-bold text-white tracking-tight">
                <Palette className="h-8 w-8 text-secondary-container" />
                Paint & Sip
              </div>
              <p className="text-body-md text-slate-400 leading-relaxed max-w-xs">
                Where fine art meets refined hospitality. Join us for guided painting, good conversation, and a studio night that feels easy from the moment you arrive.
              </p>
              <div className="flex space-x-4">
                <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-secondary transition-all duration-300 group" aria-label="Social media">
                  <span className="material-symbols-outlined text-white text-xl">share</span>
                </button>
                <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-secondary transition-all duration-300 group" aria-label="Instagram">
                  <span className="material-symbols-outlined text-white text-xl">photo_camera</span>
                </button>
                <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-secondary transition-all duration-300 group" aria-label="Website">
                  <span className="material-symbols-outlined text-white text-xl">public</span>
                </button>
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-8 font-sans">Navigation</h4>
              <ul className="space-y-4 font-body-md">
                <li><Link to="/events" className="text-slate-400 hover:text-white transition-colors font-sans">Workshops</Link></li>
                <li><Link to="/gift-cards" className="text-slate-400 hover:text-white transition-colors font-sans">Gift Cards</Link></li>
                <li><Link to="/events?type=private" className="text-slate-400 hover:text-white transition-colors font-sans">Private Events</Link></li>
                <li><Link to="/faqs" className="text-slate-400 hover:text-white transition-colors font-sans">FAQ</Link></li>
                <li><Link to="/galleries" className="text-slate-400 hover:text-white transition-colors font-sans">Gallery</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-8 font-sans">Support</h4>
              <ul className="space-y-4 font-body-md">
                <li><a className="text-slate-400 hover:text-white transition-colors font-sans" href="mailto:hello@paintandsip.com">Contact Us</a></li>
                <li><span className="text-slate-400 font-sans">Terms of Service</span></li>
                <li><span className="text-slate-400 font-sans">Privacy Policy</span></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-8 font-sans">Visit Us</h4>
              <div className="space-y-6 font-body-md text-slate-400 font-sans">
                <div>
                  <p className="text-white font-semibold mb-1">Downtown Studio</p>
                  <p>1224 Artisan Boulevard<br/>Your City, ST 00000</p>
                </div>
                <div>
                  <p className="text-white font-semibold mb-1">Hours</p>
                  <p>Wed-Sun by workshop schedule<br/>Private events available by request</p>
                </div>
                <div className="pt-2">
                  <p className="text-xs italic text-secondary-fixed-dim">Inquiries: hello@paintandsip.com</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-20 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-sans">
            <div>&copy; {new Date().getFullYear()} Paint & Sip. Refined Creativity &amp; Upscale Hospitality.</div>
            <div className="flex gap-8">
              <span className="hover:text-slate-300 cursor-default transition-colors">Artisanal Sip &amp; Canvas</span>
              <span className="hover:text-slate-300 cursor-default transition-colors">Boutique Events</span>
            </div>
          </div>
        </div>
      </footer>

      {isAdmin && showAdminBanner && (
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 text-white py-2 px-4 flex items-center justify-center gap-4 relative">
          <span className="text-sm font-medium">
            You're viewing the public site
          </span>
          <Link
            to="/admin"
            className="text-sm font-semibold underline hover:text-primary-100"
          >
            Go to Admin →
          </Link>
          <button
            onClick={() => setShowAdminBanner(false)}
            className="absolute right-4 hover:text-primary-200 text-lg"
          >
            ✕
          </button>
        </div>
      )}

      <ExpertBot />
      <NewsletterPopup />
    </div>
  );
}
