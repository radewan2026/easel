import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useSmsPreferences, useUpdateSmsPreferences } from '../../hooks/useSmsPreferences';

export function SmsPreferencesWidget() {
  const [phone, setPhone] = useState('');
  const [submittedPhone, setSubmittedPhone] = useState('');
  const [status, setStatus] = useState('');

  const preferences = useSmsPreferences(submittedPhone);
  const updatePrefs = useUpdateSmsPreferences();

  const [marketingEnabled, setMarketingEnabled] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  useEffect(() => {
    if (preferences.data) {
      setMarketingEnabled(preferences.data.marketingEnabled);
      setRemindersEnabled(preferences.data.appointmentRemindersEnabled);
    }
  }, [preferences.data]);

  const phoneValid = /^\+?[\d\s\-().]{7,20}$/.test(phone.trim());

  const handleLookup = () => {
    setStatus('');
    if (!phoneValid) {
      setStatus('Please enter a valid phone number.');
      return;
    }
    setSubmittedPhone(phone.trim());
  };

  const handleSave = async () => {
    setStatus('');
    try {
      await updatePrefs.mutateAsync({
        phone: submittedPhone,
        marketingEnabled,
        appointmentRemindersEnabled: remindersEnabled,
      });
      setStatus('Your text message preferences were saved.');
    } catch {
      setStatus('Failed to save preferences. Please try again.');
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 font-serif text-xl font-bold text-slate-950">
        <MessageSquare className="h-5 w-5 text-secondary" />
        Text Message Preferences
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Get event reminders and booking confirmations by text. Standard message and data rates may apply. Reply STOP at any time to opt out.
      </p>

      {!submittedPhone ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 123-4567"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-secondary focus:outline-none"
          />
          <button
            type="button"
            onClick={handleLookup}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary/90"
          >
            Manage
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">{submittedPhone}</p>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={marketingEnabled}
              onChange={(e) => setMarketingEnabled(e.target.checked)}
              className="mt-1 rounded border-slate-300"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Marketing &amp; promotions</span>
              <span className="mt-0.5 block text-sm text-slate-600">Upcoming classes, special events, and gift card offers.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={remindersEnabled}
              onChange={(e) => setRemindersEnabled(e.target.checked)}
              className="mt-1 rounded border-slate-300"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Event reminders</span>
              <span className="mt-0.5 block text-sm text-slate-600">A reminder text before your booked classes.</span>
            </span>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={updatePrefs.isPending}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary/90 disabled:opacity-60"
            >
              {updatePrefs.isPending ? 'Saving…' : 'Save preferences'}
            </button>
            <button
              type="button"
              onClick={() => { setSubmittedPhone(''); setPhone(''); setStatus(''); }}
              className="text-sm font-semibold text-slate-500 hover:text-slate-700"
            >
              Use a different number
            </button>
          </div>
        </div>
      )}

      {status && <p className="mt-3 text-sm text-slate-600">{status}</p>}
    </section>
  );
}
