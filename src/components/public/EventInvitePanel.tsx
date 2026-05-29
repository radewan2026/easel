import { Check, Link2, Mail, Share2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { trackAnalyticsEvent } from '../../lib/analytics';

interface EventInvitePanelProps {
  eventTitle: string;
  eventSlug: string;
  purchaserEmail?: string | null;
  orderId?: string | null;
  totalSeats?: number | null;
}

function getOrigin() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export default function EventInvitePanel({
  eventTitle,
  eventSlug,
  purchaserEmail,
  orderId,
  totalSeats,
}: EventInvitePanelProps) {
  const [copied, setCopied] = useState(false);

  const inviteUrl = useMemo(() => {
    const params = new URLSearchParams({
      utm_source: 'guest_invite',
      utm_medium: 'share',
      utm_campaign: eventSlug,
    });
    return `${getOrigin()}/events/${eventSlug}?${params.toString()}`;
  }, [eventSlug]);

  const emailHref = useMemo(() => {
    const subject = encodeURIComponent(`Join me at ${eventTitle}`);
    const body = encodeURIComponent(
      `I booked seats for ${eventTitle} and wanted to share the event details with you.\n\nView the event here:\n${inviteUrl}`
    );
    return `mailto:?subject=${subject}&body=${body}`;
  }, [eventTitle, inviteUrl]);

  const trackInviteAction = (action: 'copy' | 'native_share' | 'email') => {
    void trackAnalyticsEvent({
      eventName: 'guest_invite_action',
      userType: 'customer',
      userEmail: purchaserEmail || null,
      properties: {
        action,
        eventSlug,
        eventTitle,
        orderId: orderId || null,
        totalSeats: totalSeats ?? null,
      },
    });
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = inviteUrl;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      trackInviteAction('copy');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = inviteUrl;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const didCopy = document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(didCopy);
      if (didCopy) {
        trackInviteAction('copy');
        window.setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) {
      await handleCopy();
      return;
    }

    try {
      await navigator.share({
        title: eventTitle,
        text: `Join me at ${eventTitle}`,
        url: inviteUrl,
      });
      trackInviteAction('native_share');
    } catch {
      // Sharing can be cancelled by the customer.
    }
  };

  return (
    <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 text-left">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-gray-900">Invite your guests</p>
          <p className="mt-1 text-sm text-gray-600">
            Share the event details now. Guest names can still be handled later from the confirmation flow.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={handleNativeShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <a href={emailHref} onClick={() => trackInviteAction('email')}>
            <Button type="button" variant="outline" size="sm">
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Button>
          </a>
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="mr-2 h-4 w-4 text-green-600" /> : <Link2 className="mr-2 h-4 w-4" />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      </div>
    </div>
  );
}
