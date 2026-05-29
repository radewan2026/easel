import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import SEO from '../../components/SEO';
import { useEmailPreferences, useSaveEmailPreferences } from '../../hooks/useEmailPreferences';

export default function UnsubscribePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') || '';
  const [emailInput, setEmailInput] = useState(initialEmail);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const preferences = useEmailPreferences(emailInput);
  const savePreferences = useSaveEmailPreferences();
  const [marketingEnabled, setMarketingEnabled] = useState(true);
  const [privateEventUpdatesEnabled, setPrivateEventUpdatesEnabled] = useState(true);
  const [membershipUpdatesEnabled, setMembershipUpdatesEnabled] = useState(true);

  useEffect(() => {
    if (!preferences.data) return;
    queueMicrotask(() => {
      setMarketingEnabled(preferences.data.marketingEnabled);
      setPrivateEventUpdatesEnabled(preferences.data.privateEventUpdatesEnabled);
      setMembershipUpdatesEnabled(preferences.data.membershipUpdatesEnabled);
    });
  }, [preferences.data]);

  const normalizedEmail = emailInput.trim().toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!normalizedEmail) {
      setError('Please enter your email');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      setError('Please enter a valid email');
      return;
    }
    try {
      await savePreferences.mutateAsync({
        email: normalizedEmail,
        transactionalEnabled: true,
        marketingEnabled,
        privateEventUpdatesEnabled,
        membershipUpdatesEnabled,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    }
  };

  return (
    <div className="bg-slate-50 px-4 py-16">
      <SEO title="Email Preferences - Paint & Sip" />
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="py-10">
            {submitted ? (
              <div className="text-center">
                <Check className="mx-auto mb-4 h-12 w-12 text-green-500" />
                <h1 className="text-xl font-bold text-slate-950">Preferences Saved</h1>
                <p className="mx-auto mt-2 max-w-md text-slate-600">
                  We updated email preferences for {normalizedEmail}. Transactional emails for purchases, receipts, and account security remain enabled.
                </p>
                <Button className="mt-6" onClick={() => navigate('/')}>Back to Home</Button>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <Mail className="mx-auto mb-4 h-12 w-12 text-secondary" />
                  <h1 className="text-2xl font-bold text-slate-950">Email Preferences</h1>
                  <p className="mx-auto mt-2 max-w-md text-slate-600">
                    Choose which updates you want from Paint & Sip. Purchase receipts and required account messages always stay on.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

                  <Input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />

                  <div className="space-y-3">
                    <PreferenceToggle
                      checked={marketingEnabled}
                      onChange={setMarketingEnabled}
                      title="Marketing emails"
                      body="Upcoming events, promos, gift card reminders, and studio news."
                    />
                    <PreferenceToggle
                      checked={privateEventUpdatesEnabled}
                      onChange={setPrivateEventUpdatesEnabled}
                      title="Private event updates"
                      body="Follow-ups, proposals, quotes, and planning messages for private events."
                    />
                    <PreferenceToggle
                      checked={membershipUpdatesEnabled}
                      onChange={setMembershipUpdatesEnabled}
                      title="Membership updates"
                      body="Credit reminders, renewal notices, plan changes, and membership benefit updates."
                    />
                    <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-500" />
                      <div>
                        <p className="font-semibold text-slate-900">Transactional emails stay enabled</p>
                        <p className="mt-1 text-sm text-slate-600">Receipts, booking confirmations, payment notices, and account security messages are required for service.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => navigate('/')}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={savePreferences.isPending}>
                      {savePreferences.isPending ? 'Saving...' : 'Save Preferences'}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PreferenceToggle({ checked, onChange, title, body }: { checked: boolean; onChange: (checked: boolean) => void; title: string; body: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 rounded border-slate-300 text-secondary focus:ring-secondary"
      />
      <span>
        <span className="block font-semibold text-slate-950">{title}</span>
        <span className="mt-1 block text-sm text-slate-600">{body}</span>
      </span>
    </label>
  );
}
