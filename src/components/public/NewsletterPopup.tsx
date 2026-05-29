import { useState, useEffect } from 'react';
import { useSubscribe } from '../../hooks/useNewsletter';
import { Mail, X, PartyPopper } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

const POPUP_DELAY = 8000;
const DISMISS_KEY = 'newsletter_dismissed';

export default function NewsletterPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const subscribe = useSubscribe();

  useEffect(() => {
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (dismissed) return;
    const timer = setTimeout(() => setIsOpen(true), POPUP_DELAY);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    await subscribe.mutateAsync({ email, name: name || undefined, source: 'popup' });
    setSubmitted(true);
  };

  const handleDismiss = () => {
    setIsOpen(false);
    sessionStorage.setItem(DISMISS_KEY, 'true');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={handleDismiss}>
      <div
        className="rounded-2xl shadow-2xl max-w-md w-full p-8 relative"
        style={{ backgroundColor: 'var(--card-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4"
          style={{ color: 'var(--text-muted)' }}
        >
          <X className="h-5 w-5" />
        </button>

        {submitted ? (
          <div className="text-center py-4">
            <PartyPopper className="h-12 w-12 text-primary-500 mx-auto mb-3" />
            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Welcome aboard!</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              You'll be the first to hear about new events, special offers, and creative tips.
            </p>
            <Button variant="ghost" onClick={handleDismiss} className="mt-4">Close</Button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3" style={{ backgroundColor: 'var(--admin-input-bg)' }}>
                <Mail className="h-7 w-7" style={{ color: 'var(--primary-color)' }} />
              </div>
              <h3 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Stay in the Loop!</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Get exclusive event updates, early access, and special deals delivered to your inbox.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                placeholder="Your name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" disabled={subscribe.isPending}>
                {subscribe.isPending ? 'Subscribing...' : 'Subscribe'}
              </Button>
            </form>

            <button
              onClick={handleDismiss}
              className="block mx-auto mt-3 text-xs text-gray-400 hover:text-gray-600"
            >
              No thanks, maybe later
            </button>
          </>
        )}
      </div>
    </div>
  );
}
