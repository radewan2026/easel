import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ArrowRight, Copy, Download, Gift, Link2, Mail, Megaphone, MessageSquare, QrCode, RefreshCw, Save, Star, Tag, Trash2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { useOwnerActionFeed } from '../../hooks/useOwnerActionFeed';
import { absoluteMarketingUrl, analyticsHrefForSavedLink, buildQrImageUrl, buildTrackedUrl, readSavedMarketingLinks, writeSavedMarketingLinks, type SavedCampaignLink } from '../../lib/marketingLinks';
import { slugify } from '../../lib/utils';

const campaignIdeas = [
  {
    title: 'Promote Low-Fill Events',
    detail: 'Use event health signals to drive seats before the event window closes.',
    icon: Megaphone,
    to: '/admin/events',
    cta: 'Find events',
  },
  {
    title: 'Re-Engage Lapsed Customers',
    detail: 'Pull the lapsed segment and draft a return-offer email.',
    icon: RefreshCw,
    to: '/admin/customers',
    cta: 'Open segment',
  },
  {
    title: 'Gift Card Holder Reminder',
    detail: 'Nudge unredeemed gift-card holders toward upcoming classes.',
    icon: Gift,
    to: '/admin/gift-cards',
    cta: 'Review cards',
  },
  {
    title: 'Private Event Follow-Up',
    detail: 'Turn submitted private requests into booked events or invoices.',
    icon: MessageSquare,
    to: '/admin/private-requests',
    cta: 'Open pipeline',
  },
  {
    title: 'Testimonial Request',
    detail: 'Ask recent attendees for reviews while the event is still fresh.',
    icon: Star,
    to: '/admin/testimonials',
    cta: 'Review testimonials',
  },
  {
    title: 'Referral Push',
    detail: 'Create a referral offer for your most engaged repeat customers.',
    icon: Tag,
    to: '/admin/referrals',
    cta: 'Manage referrals',
  },
];

const marketingLinks = [
  { label: 'Email Center', to: '/admin/email', icon: Mail },
  { label: 'Customer Segments', to: '/admin/customers', icon: Users },
  { label: 'Coupons', to: '/admin/coupons', icon: Tag },
  { label: 'Referrals', to: '/admin/referrals', icon: Tag },
  { label: 'Testimonials', to: '/admin/testimonials', icon: Star },
];

const channelPresets = [
  { label: 'Email', source: 'email', medium: 'campaign', content: 'primary-cta' },
  { label: 'Instagram', source: 'instagram', medium: 'social', content: 'bio-link' },
  { label: 'Facebook', source: 'facebook', medium: 'social', content: 'post' },
  { label: 'Paid ad', source: 'meta', medium: 'paid-social', content: 'ad' },
  { label: 'QR code', source: 'studio-qr', medium: 'offline', content: 'counter-card' },
  { label: 'Partner', source: 'partner', medium: 'referral', content: 'partner-post' },
];

export default function MarketingCenterPage() {
  const ownerFeed = useOwnerActionFeed();
  const marketingActions = ownerFeed.filter(item => ['event', 'private_request', 'inventory'].includes(item.type)).slice(0, 4);
  const [baseUrl, setBaseUrl] = useState('/events');
  const [utmSource, setUtmSource] = useState('instagram');
  const [utmMedium, setUtmMedium] = useState('social');
  const [utmCampaign, setUtmCampaign] = useState('weekend-seats');
  const [utmContent, setUtmContent] = useState('bio-link');
  const [copied, setCopied] = useState(false);
  const [linkName, setLinkName] = useState('Weekend seats Instagram link');
  const [savedLinks, setSavedLinks] = useState<SavedCampaignLink[]>(() => readSavedMarketingLinks());
  const [qrPreviewLink, setQrPreviewLink] = useState<SavedCampaignLink | null>(null);

  const trackedUrl = useMemo(() => buildTrackedUrl(baseUrl, {
    source: utmSource,
    medium: utmMedium,
    campaign: utmCampaign || slugify(baseUrl.replace(/^\//, '') || 'marketing-campaign'),
    content: utmContent,
  }), [baseUrl, utmCampaign, utmContent, utmMedium, utmSource]);

  const applyPreset = (preset: typeof channelPresets[number]) => {
    setUtmSource(preset.source);
    setUtmMedium(preset.medium);
    setUtmContent(preset.content);
    if (!utmCampaign.trim()) setUtmCampaign('weekend-seats');
    setCopied(false);
  };

  const copyTrackedUrl = async () => {
    const absoluteUrl = trackedUrl.startsWith('http') ? trackedUrl : `${window.location.origin}${trackedUrl}`;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const persistSavedLinks = (links: SavedCampaignLink[]) => {
    setSavedLinks(links);
    writeSavedMarketingLinks(links);
  };

  const saveTrackedLink = () => {
    const nextLink: SavedCampaignLink = {
      id: `link-${Date.now()}`,
      name: linkName.trim() || `${utmCampaign || 'Campaign'} ${utmSource || 'link'}`,
      url: trackedUrl,
      source: utmSource,
      medium: utmMedium,
      campaign: utmCampaign,
      content: utmContent,
      createdAt: new Date().toISOString(),
    };
    persistSavedLinks([nextLink, ...savedLinks].slice(0, 20));
  };

  const reuseSavedLink = (link: SavedCampaignLink) => {
    setBaseUrl(link.url.split('?')[0] || '/events');
    setUtmSource(link.source);
    setUtmMedium(link.medium);
    setUtmCampaign(link.campaign);
    setUtmContent(link.content);
    setLinkName(link.name);
    setCopied(false);
  };

  const deleteSavedLink = (id: string) => {
    persistSavedLinks(savedLinks.filter((link) => link.id !== id));
    if (qrPreviewLink?.id === id) setQrPreviewLink(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Marketing Center</h1>
          <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Campaign ideas, customer segments, and outreach tools in one workflow.</p>
        </div>
        <Link to="/admin/email">
          <Button>
            <Mail className="h-4 w-4 mr-2" />
            Email Center
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Campaign Ideas</p>
            <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{campaignIdeas.length}</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Ready-to-run studio campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Action Signals</p>
            <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{marketingActions.length}</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Current items that could use outreach</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Audience Tools</p>
            <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>6</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Segments, email, coupons, referrals</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Campaign Link Builder</CardTitle>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Create trackable links for social posts, QR codes, partners, ads, and emails.</p>
            </div>
            <Link to="/admin/analytics">
              <Button variant="outline">
                <ArrowRight className="mr-2 h-4 w-4" />
                View analytics
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Destination URL</label>
                <Input value={baseUrl} onChange={(event) => { setBaseUrl(event.target.value); setCopied(false); }} placeholder="/events or https://..." />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Link name</label>
                <Input value={linkName} onChange={(event) => setLinkName(event.target.value)} placeholder="Weekend seats Instagram link" />
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Source
                  <Input className="mt-1" value={utmSource} onChange={(event) => { setUtmSource(event.target.value); setCopied(false); }} placeholder="instagram" />
                </label>
                <label className="block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Medium
                  <Input className="mt-1" value={utmMedium} onChange={(event) => { setUtmMedium(event.target.value); setCopied(false); }} placeholder="social" />
                </label>
                <label className="block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Campaign
                  <Input className="mt-1" value={utmCampaign} onChange={(event) => { setUtmCampaign(event.target.value); setCopied(false); }} placeholder="weekend-seats" />
                </label>
                <label className="block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Content
                  <Input className="mt-1" value={utmContent} onChange={(event) => { setUtmContent(event.target.value); setCopied(false); }} placeholder="bio-link" />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {channelPresets.map((preset) => (
                  <Button key={preset.label} type="button" size="sm" variant="outline" onClick={() => applyPreset(preset)}>
                    {preset.label === 'QR code' ? <QrCode className="mr-1 h-4 w-4" /> : <Link2 className="mr-1 h-4 w-4" />}
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Tracked link</p>
              <p className="mt-2 break-all rounded-md border p-3 text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'var(--admin-input-bg)' }}>
                {trackedUrl}
              </p>
              <Button type="button" className="mt-3 w-full" onClick={copyTrackedUrl}>
                <Copy className="mr-2 h-4 w-4" />
                {copied ? 'Copied' : 'Copy Link'}
              </Button>
              <Button type="button" variant="outline" className="mt-2 w-full" onClick={saveTrackedLink}>
                <Save className="mr-2 h-4 w-4" />
                Save Link
              </Button>
              <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                Analytics will group this under {utmSource || 'source'} / {utmMedium || 'medium'} once customers visit the link.
              </p>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Saved tracking links</p>
              <Badge variant="gray">{savedLinks.length}</Badge>
            </div>
            {savedLinks.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {savedLinks.slice(0, 6).map((link) => (
                  <div key={link.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{link.name}</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{link.source} / {link.medium}</p>
                      </div>
                      <button type="button" onClick={() => deleteSavedLink(link.id)} className="shrink-0" style={{ color: 'var(--text-muted)' }} aria-label={`Delete ${link.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-2 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{link.url}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => reuseSavedLink(link)}>
                        Reuse
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setQrPreviewLink(link)}>
                        QR
                      </Button>
                      <Link to={analyticsHrefForSavedLink(link)}>
                        <Button type="button" size="sm" variant="outline" className="w-full">
                          Analyze
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                No saved links yet. Save links for recurring QR cards, social profiles, partner posts, and seasonal campaigns.
              </p>
            )}
          </div>
          {qrPreviewLink && (
            <div className="mt-5 rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="shrink-0 rounded-lg bg-white p-3">
                  <img src={buildQrImageUrl(qrPreviewLink.url, 240)} alt={`QR code for ${qrPreviewLink.name}`} className="h-40 w-40" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>QR asset: {qrPreviewLink.name}</p>
                  <p className="mt-1 break-all text-xs" style={{ color: 'var(--text-muted)' }}>{absoluteMarketingUrl(qrPreviewLink.url)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={buildQrImageUrl(qrPreviewLink.url, 720)} download={`${qrPreviewLink.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.png`} target="_blank" rel="noopener noreferrer">
                      <Button type="button" size="sm">
                        <Download className="mr-1 h-4 w-4" />
                        Download PNG
                      </Button>
                    </a>
                    <Button type="button" size="sm" variant="outline" onClick={() => setQrPreviewLink(null)}>
                      Close
                    </Button>
                  </div>
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>Use this on table tents, studio counter cards, window flyers, and partner printouts.</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 xl:col-span-8">
          <CardHeader>
            <CardTitle>Campaign Ideas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {campaignIdeas.map((idea) => {
                const Icon = idea.icon;
                return (
                  <Link key={idea.title} to={idea.to} className="rounded-lg border p-4 transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg p-2" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <Icon className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{idea.title}</p>
                        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{idea.detail}</p>
                        <span className="mt-3 inline-flex items-center text-sm font-semibold" style={{ color: 'var(--primary-color)' }}>
                          {idea.cta}
                          <ArrowRight className="ml-1 h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="col-span-12 space-y-6 xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Suggested Outreach</CardTitle>
            </CardHeader>
            <CardContent>
              {marketingActions.length ? (
                <div className="space-y-3">
                  {marketingActions.map((item) => (
                    <Link key={item.id} to={item.to} className="block rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.summary}</p>
                        <Badge variant={item.tone}>{item.actionLabel}</Badge>
                      </div>
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{item.detail}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No urgent outreach signals right now.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Marketing Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {marketingLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link key={link.label} to={link.to} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="h-4 w-4" />
                        {link.label}
                      </span>
                      <ArrowRight className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
