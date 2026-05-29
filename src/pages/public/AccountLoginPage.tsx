import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, UserCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useCustomerAuth } from '../../hooks/useCustomerAuth';
import SEO from '../../components/SEO';

export default function AccountLoginPage() {
  const { sendMagicLink } = useCustomerAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const handleMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setStatus('idle');
    setError('');

    try {
      await sendMagicLink(email);
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'We could not send that login link.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-50 py-12 md:py-20">
      <SEO title="Customer Account" description="Sign in to see your Paint & Sip orders, upcoming events, gift cards, and private event requests." />
      <div className="mx-auto grid max-w-6xl gap-8 px-5 md:grid-cols-[1fr_0.9fr] md:px-8">
        <section className="flex flex-col justify-center">
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
            <UserCircle className="h-6 w-6" />
          </div>
          <h1 className="max-w-2xl font-serif text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Your studio nights, gift cards, and orders in one place.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            Use the same email you booked with and we will pull together your upcoming workshops, receipts, waitlist spots, private event requests, and shop orders.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {['Upcoming events', 'Gift cards', 'Order history'].map((item) => (
              <div key={item} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6">
            <h2 className="font-serif text-2xl font-bold text-slate-950">Sign in</h2>
            <p className="mt-2 text-sm text-slate-600">We will email you a secure login link.</p>
          </div>

          <form onSubmit={handleMagicLink} className="space-y-4">
            <Input
              id="customer-email"
              label="Email address"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />

            {status === 'sent' && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Check your email for the login link. You can keep this tab open.
              </div>
            )}

            {status === 'error' && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full gap-2" disabled={sending}>
              <Mail className="h-4 w-4" />
              {sending ? 'Sending...' : 'Send magic link'}
            </Button>
          </form>

          <Link to="/events" className="mt-6 inline-flex text-sm font-semibold text-secondary hover:text-secondary/80">
            Back to workshops
          </Link>
        </section>
      </div>
    </div>
  );
}
