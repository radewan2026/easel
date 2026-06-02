import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSettings, useUpdateSetting } from '../../hooks/useAdmin';
import { useTenantPlan } from '../../hooks/useTenantPlan';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, CheckCircle, CreditCard, Database, DollarSign, ExternalLink, FileText, Globe, Key, Loader2, Mail, Palette, Save, ServerCog, Share2, ShieldCheck, XCircle, Bot } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toast';
import { Badge } from '../../components/ui/Badge';
import { hasAiGateway, verifyAiGateway } from '../../lib/aiGateway';
import { useProductionReadiness, type ProductionReadinessCheck, type ProductionReadinessStatus } from '../../hooks/useProductionReadiness';

const defaultSettings = {
  siteName: 'Paint & Sip',
  siteDescription: 'Sip, Paint, Repeat. Join us for a creative and fun evening of painting and wine!',
  contactEmail: 'hello@paintandsip.com',
  facebookUrl: '',
  instagramUrl: '',
  twitterUrl: '',
  brandName: '',
  brandPersona: '',
  openaiApiKey: '',
  emailProvider: 'smtp',
  emailFromName: 'Paint & Sip',
  emailFromAddress: 'hello@paintandsip.com',
  smtpHost: '',
  smtpPort: '587',
  smtpUsername: '',
  smtpPassword: '',
  resendApiKey: '',
  sendgridApiKey: '',
  stripeEnabled: 'false',
  paypalEnabled: 'false',
  stripePublishableKey: '',
  stripeSecretKey: '',
  stripeWebhookSecret: '',
  paypalClientId: '',
  paypalClientSecret: '',
  paypalSandbox: 'true',
  showPastEvents: 'false',
};

type TabType = 'readiness' | 'general' | 'social' | 'appearance' | 'persona' | 'api' | 'email' | 'payments' | 'billing';
type PaymentSubTab = 'methods' | 'stripe' | 'paypal';

const readinessIcons: Record<ProductionReadinessCheck['id'], LucideIcon> = {
  supabase: Database,
  memberships: CreditCard,
  email_backend: Mail,
  email_provider: ServerCog,
  payments: CreditCard,
  ai_gateway: Bot,
};

function ReadinessCard({ check }: { check: ProductionReadinessCheck }) {
  const statusConfig: Record<ProductionReadinessStatus, { label: string; badge: 'success' | 'warning' | 'gray'; color: string; bg: string }> = {
    ready: { label: 'Ready', badge: 'success', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)' },
    needs_setup: { label: 'Needs setup', badge: 'warning', color: '#d97706', bg: 'rgba(245, 158, 11, 0.12)' },
    demo: { label: 'Demo mode', badge: 'gray', color: 'var(--text-muted)', bg: 'var(--section-bg-light)' },
  };
  const Icon = readinessIcons[check.id];
  const config = statusConfig[check.status];

  return (
    <Card>
      <CardContent className="flex gap-4 pt-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: config.bg, color: config.color }}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{check.title}</p>
            <Badge variant={config.badge}>{config.label}</Badge>
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{check.body}</p>
          <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: 'var(--section-bg-light)', color: 'var(--text-secondary)' }}>
            {check.detail}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSetting = useUpdateSetting();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tabParam = searchParams.get('tab');
    const validTabs: TabType[] = ['readiness', 'general', 'social', 'appearance', 'persona', 'api', 'email', 'payments', 'billing'];
    return tabParam && validTabs.includes(tabParam as TabType) ? (tabParam as TabType) : 'general';
  });
  const [paymentSubTab, setPaymentSubTab] = useState<PaymentSubTab>('methods');

  const [formData, setFormData] = useState<Record<string, string>>(defaultSettings);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (settings) {
      const stored = settings.find((s) => s.key === 'siteSettings')?.value as Record<string, string> | undefined;
      if (stored) {
        setFormData(prev => ({ ...prev, ...defaultSettings, ...stored }));
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [settings]);

  const handleSave = async () => {
    await updateSetting.mutateAsync({
      key: 'siteSettings',
      value: formData,
    });
    showToast('Settings saved successfully!');
  };

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<'success' | 'error' | null>(null);

  const verifyApiKey = async () => {
    if (!hasAiGateway()) {
      setVerifyResult('error');
      showToast('AI gateway is not configured. Set VITE_AI_GATEWAY_URL for production AI calls.');
      return;
    }

    setIsVerifying(true);
    setVerifyResult(null);

    try {
      const connected = await verifyAiGateway();
      if (connected) {
        setVerifyResult('success');
        showToast('AI gateway verified successfully!');
      } else {
        setVerifyResult('error');
        showToast('AI gateway verification failed');
      }
    } catch (err) {
      console.debug('Failed to verify AI gateway', err);
      setVerifyResult('error');
      showToast('Failed to verify AI gateway');
    } finally {
      setIsVerifying(false);
    }
  };

  const tabs = [
    { id: 'readiness' as TabType, label: 'Production Setup', icon: ShieldCheck },
    { id: 'general' as TabType, label: 'General', icon: Globe },
    { id: 'social' as TabType, label: 'Social Links', icon: Share2 },
    { id: 'appearance' as TabType, label: 'Appearance', icon: Palette },
    { id: 'persona' as TabType, label: 'Brand Persona', icon: Bot },
    { id: 'api' as TabType, label: 'API Keys', icon: Key },
    { id: 'email' as TabType, label: 'Email', icon: Mail },
    { id: 'payments' as TabType, label: 'Payment Methods', icon: CreditCard },
    { id: 'billing' as TabType, label: 'Billing', icon: DollarSign },
  ];
  const { checks: readinessChecks, readyCount, demoCount, needsSetupCount } = useProductionReadiness(formData);

  if (isLoading) return <LoadingSpinner />;

  const siteSettings = settings?.find((s) => s.key === 'siteSettings')?.value as Record<string, string> || {};
  
  const getSetting = (key: string, fallback: string) => siteSettings?.[key] || fallback;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your site settings</p>
        </div>
        <Button onClick={handleSave} disabled={updateSetting.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="border-b mb-6" style={{ borderColor: 'var(--border-color)' }}>
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-primary-500'
                    : 'border-transparent'
                  }
                `}
                style={{ color: activeTab === tab.id ? 'var(--primary-color)' : 'var(--text-muted)' }}
              >
                <Icon className="h-5 w-5 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="">
        {activeTab === 'readiness' && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Ready</p>
                  <p className="mt-1 text-3xl font-bold" style={{ color: '#16a34a' }}>{readyCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Needs setup</p>
                  <p className="mt-1 text-3xl font-bold" style={{ color: '#d97706' }}>{needsSetupCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Demo mode</p>
                  <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{demoCount}</p>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-lg border p-4" style={{ borderColor: 'rgba(245, 158, 11, 0.35)', backgroundColor: 'rgba(245, 158, 11, 0.12)' }}>
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#d97706' }} />
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Use this before launch or handoff</p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    These checks expose the places where the app can still run in local/demo mode. They do not replace server logs, but they give owners and developers one reliable setup map.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {readinessChecks.map((check) => (
                <ReadinessCard key={check.title} check={check} />
              ))}
            </div>
          </div>
        )}

            {activeTab === 'general' && (
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="Site Name"
                    value={formData.siteName || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, siteName: e.target.value }))}
                    placeholder="My Site"
                  />
                  <Input
                    label="Site Description"
                    value={formData.siteDescription || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, siteDescription: e.target.value }))}
                    placeholder="My site description"
                  />
                  <Input
                    label="Contact Email"
                    type="email"
                    value={formData.contactEmail || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="contact@example.com"
                  />
                  <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Show Past Events</p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Display past events on the public calendar and events page</p>
                    </div>
                    <button
                      onClick={() => setFormData((prev) => ({ ...prev, showPastEvents: prev.showPastEvents === 'true' ? 'false' : 'true' }))}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                      style={{ backgroundColor: formData.showPastEvents === 'true' ? 'var(--primary-color)' : 'var(--border-color)' }}
                    >
                      <span
                        className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                        style={{ transform: formData.showPastEvents === 'true' ? 'translateX(20px)' : 'translateX(2px)' }}
                      />
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}

        {activeTab === 'social' && (
          <Card>
            <CardHeader>
              <CardTitle>Social Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Facebook URL"
                value={formData.facebookUrl || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, facebookUrl: e.target.value }))}
                placeholder="https://facebook.com/yourpage"
              />
              <Input
                label="Instagram URL"
                value={formData.instagramUrl || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, instagramUrl: e.target.value }))}
                placeholder="https://instagram.com/yourpage"
              />
              <Input
                label="Twitter URL"
                value={formData.twitterUrl || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, twitterUrl: e.target.value }))}
                placeholder="https://twitter.com/yourpage"
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-6">
            {/* Brand Colors */}
            <Card>
              <CardHeader>
                <CardTitle>Brand Colors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p style={{ color: 'var(--text-muted)' }}>Define your brand's primary and accent colors.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                    <div>
                      <label htmlFor="primary-hex" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Primary Color</label>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Buttons, links, accents</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        id="primary-color"
                        value={formData.primaryColor || getSetting('primaryColor', '#eb6a3d')}
                        onChange={(e) => setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-12 h-10 p-1 cursor-pointer rounded"
                      />
                      <Input
                        id="primary-hex"
                        value={formData.primaryColor || getSetting('primaryColor', '#eb6a3d')}
                        onChange={(e) => setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-24 font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                    <div>
                      <label htmlFor="accent-hex" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Accent Color</label>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Secondary highlights</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        id="accent-color"
                        value={formData.accentColor || getSetting('accentColor', '#fce9e1')}
                        onChange={(e) => setFormData((prev) => ({ ...prev, accentColor: e.target.value }))}
                        className="w-12 h-10 p-1 cursor-pointer rounded"
                      />
                      <Input
                        id="accent-hex"
                        value={formData.accentColor || getSetting('accentColor', '#fce9e1')}
                        onChange={(e) => setFormData((prev) => ({ ...prev, accentColor: e.target.value }))}
                        className="w-24 font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Hero Section */}
            <Card>
              <CardHeader>
                <CardTitle>Hero Section</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p style={{ color: 'var(--text-muted)' }}>Customize the gradient background of your homepage hero section.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                    <label htmlFor="gradient-start-hex" className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Gradient Start Color</label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        id="gradient-start-color"
                        value={formData.heroGradientStart || getSetting('heroGradientStart', '#fff7ed')}
                        onChange={(e) => setFormData((prev) => ({ ...prev, heroGradientStart: e.target.value }))}
                        className="w-12 h-10 p-1 cursor-pointer rounded"
                      />
                      <Input
                        id="gradient-start-hex"
                        value={formData.heroGradientStart || getSetting('heroGradientStart', '#fff7ed')}
                        onChange={(e) => setFormData((prev) => ({ ...prev, heroGradientStart: e.target.value }))}
                        placeholder="#fff7ed"
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                    <label htmlFor="gradient-end-hex" className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Gradient End Color</label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        id="gradient-end-color"
                        value={formData.heroGradientEnd || getSetting('heroGradientEnd', '#ffedd5')}
                        onChange={(e) => setFormData((prev) => ({ ...prev, heroGradientEnd: e.target.value }))}
                        className="w-12 h-10 p-1 cursor-pointer rounded"
                      />
                      <Input
                        id="gradient-end-hex"
                        value={formData.heroGradientEnd || getSetting('heroGradientEnd', '#ffedd5')}
                        onChange={(e) => setFormData((prev) => ({ ...prev, heroGradientEnd: e.target.value }))}
                        placeholder="#ffedd5"
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dark Mode Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Dark Mode Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p style={{ color: 'var(--text-muted)' }}>See how your colors appear in dark mode.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                    <div className="h-2 rounded mb-2" style={{ backgroundColor: formData.primaryColor || getSetting('primaryColor', '#eb6a3d') }}></div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Primary</p>
                  </div>
                  <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                    <div className="h-2 rounded mb-2" style={{ backgroundColor: formData.accentColor || getSetting('accentColor', '#fce9e1') }}></div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Accent</p>
                  </div>
                  <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--section-bg-dark)', border: '1px solid var(--border-color)' }}>
                    <div className="h-2 rounded mb-2" style={{ background: `linear-gradient(90deg, ${formData.heroGradientStart || getSetting('heroGradientStart', '#fff7ed')}, ${formData.heroGradientEnd || getSetting('heroGradientEnd', '#ffedd5')})` }}></div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Hero Gradient</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'persona' && (
          <Card>
            <CardHeader>
              <CardTitle>Brand Persona</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="mb-4" style={{ color: 'var(--text-muted)' }}>
                Define your brand personality to personalize the AI assistant's tone and style.
              </p>
              <Input
                label="Brand Name"
                value={formData.brandName || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, brandName: e.target.value }))}
                placeholder="e.g., Paint & Sip Studio"
              />
              <Textarea
                label="Brand Persona / Tone"
                value={formData.brandPersona || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, brandPersona: e.target.value }))}
                placeholder="Describe your brand's personality, tone, and style. Example: Friendly, creative, energetic, and welcoming. We love to help beginners feel comfortable and excited about their first painting experience."
                className="min-h-[600px]"
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'api' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Gateway</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p style={{ color: 'var(--text-muted)' }}>
                  AI features should run through a server-side gateway so provider keys are never exposed in the browser.
                </p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      label="Legacy API Key"
                      type="password"
                      value={formData.openaiApiKey || ''}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, openaiApiKey: e.target.value }));
                        setVerifyResult(null);
                      }}
                      placeholder="sk-..."
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="secondary"
                      onClick={verifyApiKey}
                      disabled={isVerifying}
                    >
                      {isVerifying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : verifyResult === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : verifyResult === 'error' ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        'Verify'
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {formData.openaiApiKey ? (
                    <Badge variant="warning">Legacy key saved</Badge>
                  ) : (
                    <Badge variant="gray">No legacy key</Badge>
                  )}
                  {hasAiGateway() ? (
                    <Badge variant="success">Gateway configured</Badge>
                  ) : (
                    <Badge variant="warning">Gateway missing</Badge>
                  )}
                  {verifyResult === 'success' && (
                    <Badge variant="success">Connected</Badge>
                  )}
                  {verifyResult === 'error' && (
                    <Badge variant="danger">Failed</Badge>
                  )}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Production setup: configure <code>VITE_AI_GATEWAY_URL</code> to call your backend or Supabase Edge Function, then store provider keys only on that server.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Other API Keys</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p style={{ color: 'var(--text-muted)' }}>
                  Additional API integrations can be added here as needed.
                </p>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>More API integrations coming soon...</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Outbound Email Provider</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p style={{ color: 'var(--text-muted)' }}>
                  Configure the provider used for order confirmations and admin notifications.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email-provider" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Provider</label>
                    <select
                      id="email-provider"
                      value={formData.emailProvider || 'smtp'}
                      onChange={(e) => setFormData((prev) => ({ ...prev, emailProvider: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      <option value="smtp">SMTP</option>
                      <option value="resend">Resend</option>
                      <option value="sendgrid">SendGrid</option>
                    </select>
                  </div>
                  <Input
                    label="From Name"
                    value={formData.emailFromName || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, emailFromName: e.target.value }))}
                    placeholder="Paint & Sip"
                  />
                  <Input
                    label="From Address"
                    type="email"
                    value={formData.emailFromAddress || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, emailFromAddress: e.target.value }))}
                    placeholder="hello@yourdomain.com"
                  />
                </div>

                {formData.emailProvider === 'smtp' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="SMTP Host"
                      value={formData.smtpHost || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, smtpHost: e.target.value }))}
                      placeholder="smtp.example.com"
                    />
                    <Input
                      label="SMTP Port"
                      type="number"
                      value={formData.smtpPort || '587'}
                      onChange={(e) => setFormData((prev) => ({ ...prev, smtpPort: e.target.value }))}
                      placeholder="587"
                    />
                    <Input
                      label="SMTP Username"
                      value={formData.smtpUsername || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, smtpUsername: e.target.value }))}
                    />
                    <Input
                      label="SMTP Password"
                      type="password"
                      value={formData.smtpPassword || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, smtpPassword: e.target.value }))}
                    />
                  </div>
                )}

                {formData.emailProvider === 'resend' && (
                  <Input
                    label="Resend API Key"
                    type="password"
                    value={formData.resendApiKey || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, resendApiKey: e.target.value }))}
                    placeholder="re_..."
                  />
                )}

                {formData.emailProvider === 'sendgrid' && (
                  <Input
                    label="SendGrid API Key"
                    type="password"
                    value={formData.sendgridApiKey || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sendgridApiKey: e.target.value }))}
                    placeholder="SG..."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="border-b" style={{ borderColor: 'var(--border-color)' }}>
              <nav className="-mb-px flex space-x-6">
                {([
                  { id: 'methods' as PaymentSubTab, label: 'Accepted Methods' },
                  { id: 'stripe' as PaymentSubTab, label: 'Stripe Settings' },
                  { id: 'paypal' as PaymentSubTab, label: 'PayPal Settings' },
                ]).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setPaymentSubTab(tab.id)}
                    className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                      paymentSubTab === tab.id ? 'border-primary-500' : 'border-transparent'
                    }`}
                    style={{ color: paymentSubTab === tab.id ? 'var(--primary-color)' : 'var(--text-muted)' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {paymentSubTab === 'methods' && (
              <Card>
                <CardHeader>
                  <CardTitle>Accepted Payment Methods</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p style={{ color: 'var(--text-muted)' }}>
                    Enable or disable payment methods for your checkout.
                  </p>

                  <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#635bff20' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13.976 9.15c-2.172-.806-3.356-1.346-3.356-2.226 0-.768.717-1.268 1.902-1.268 1.305 0 2.67.45 3.67.968l.96-2.81c-1.126-.552-2.72-.962-4.362-.962-3.72 0-6.06 2.04-6.06 4.95 0 3.6 4.26 4.14 6.24 4.86 1.86.66 2.64 1.2 2.64 2.16 0 .87-.84 1.38-2.22 1.38-1.62 0-3.24-.63-4.32-1.29l-.96 2.88c1.32.72 3.24 1.26 5.16 1.26 3.9 0 6.36-1.98 6.36-5.04 0-3.72-4.38-4.32-6.36-5.1z" fill="#635bff"/>
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Stripe</p>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Accept credit cards, Apple Pay, Google Pay, and more</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setFormData((prev) => ({ ...prev, stripeEnabled: prev.stripeEnabled === 'true' ? 'false' : 'true' }))}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                        style={{ backgroundColor: formData.stripeEnabled === 'true' ? 'var(--primary-color)' : 'var(--border-color)' }}
                      >
                        <span
                          className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                          style={{ transform: formData.stripeEnabled === 'true' ? 'translateX(20px)' : 'translateX(2px)' }}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between py-4" style={{ borderColor: 'var(--border-color)' }}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#00308720' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7.076 18.56h-3.56l2.16-11.12h3.56L7.076 18.56zm11.24-10.86c-.7-.26-1.8-.54-3.16-.54-3.48 0-5.94 1.76-5.96 4.28-.02 1.86 1.76 2.9 3.1 3.52 1.38.64 1.84 1.04 1.84 1.62-.02.88-1.1 1.28-2.12 1.28-1.42 0-2.18-.2-3.34-.68l-.46-.2-.5 2.94c.84.36 2.38.68 3.98.7 3.7 0 6.12-1.74 6.14-4.42.02-1.48-.92-2.6-2.96-3.52-1.24-.6-2-1-2-1.62 0-.56.64-1.16 2.04-1.16 1.16-.02 2 .24 2.66.5l.32.14.48-2.84z" fill="#003087"/>
                            <path d="M18.56 7.44h2.76L23.8 18.56h-3.26l-.46-1.44h-4.02l-.78 1.44H12.2l5.12-10.62c.3-.58.8-.88 1.48-.88h.76zm-1.12 3.84l-1.38 3.36h2.56l-1.18-3.36z" fill="#003087"/>
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>PayPal</p>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Accept PayPal, debit, and credit cards</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setFormData((prev) => ({ ...prev, paypalEnabled: prev.paypalEnabled === 'true' ? 'false' : 'true' }))}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                        style={{ backgroundColor: formData.paypalEnabled === 'true' ? 'var(--primary-color)' : 'var(--border-color)' }}
                      >
                        <span
                          className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                          style={{ transform: formData.paypalEnabled === 'true' ? 'translateX(20px)' : 'translateX(2px)' }}
                        />
                      </button>
                    </div>
                  </div>

                  {(formData.stripeEnabled !== 'true' && formData.paypalEnabled !== 'true') && (
                    <div className="p-4 rounded-lg" style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b' }}>
                      <p className="text-sm font-medium" style={{ color: '#92400e' }}>No payment methods enabled</p>
                      <p className="text-xs mt-1" style={{ color: '#a16207' }}>Enable at least one payment method so customers can complete checkout.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {paymentSubTab === 'stripe' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CardTitle>Stripe Settings</CardTitle>
                    {formData.stripeEnabled === 'true' ? (
                      <Badge variant="success">Enabled</Badge>
                    ) : (
                      <Badge variant="warning">Disabled</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p style={{ color: 'var(--text-muted)' }}>
                    Connect your Stripe account to accept online payments. Find your keys in the{' '}
                    <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary-color)' }}>
                      Stripe Dashboard
                    </a>.
                  </p>

                  <Input
                    label="Publishable Key"
                    value={formData.stripePublishableKey || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, stripePublishableKey: e.target.value }))}
                    placeholder="pk_live_..."
                  />
                  <Input
                    label="Secret Key"
                    type="password"
                    value={formData.stripeSecretKey || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, stripeSecretKey: e.target.value }))}
                    placeholder="sk_live_..."
                  />
                  <Input
                    label="Webhook Secret"
                    type="password"
                    value={formData.stripeWebhookSecret || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, stripeWebhookSecret: e.target.value }))}
                    placeholder="whsec_..."
                  />

                  <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Webhook Endpoint</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      Configure your Stripe webhook to point to:
                    </p>
                    <code className="block mt-2 px-3 py-2 rounded text-sm font-mono" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                      {'{your-domain}'}/api/webhooks/stripe
                    </code>
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      Events to listen for: checkout.session.completed, payment_intent.payment_failed, charge.refunded
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {paymentSubTab === 'paypal' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CardTitle>PayPal Settings</CardTitle>
                    {formData.paypalEnabled === 'true' ? (
                      <Badge variant="success">Enabled</Badge>
                    ) : (
                      <Badge variant="warning">Disabled</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p style={{ color: 'var(--text-muted)' }}>
                    Connect your PayPal Business account to accept PayPal payments. Get your credentials from the{' '}
                    <a href="https://developer.paypal.com/dashboard/applications/live" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary-color)' }}>
                      PayPal Developer Dashboard
                    </a>.
                  </p>

                  <Input
                    label="Client ID"
                    value={formData.paypalClientId || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, paypalClientId: e.target.value }))}
                    placeholder="AX..."
                  />
                  <Input
                    label="Client Secret"
                    type="password"
                    value={formData.paypalClientSecret || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, paypalClientSecret: e.target.value }))}
                    placeholder="EL..."
                  />

                  <div className="flex items-center justify-between py-3 px-4 rounded-lg" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Sandbox Mode</p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Use PayPal Sandbox for testing (no real charges)</p>
                    </div>
                    <button
                      onClick={() => setFormData((prev) => ({ ...prev, paypalSandbox: prev.paypalSandbox === 'true' ? 'false' : 'true' }))}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                      style={{ backgroundColor: formData.paypalSandbox === 'true' ? 'var(--primary-color)' : 'var(--border-color)' }}
                    >
                      <span
                        className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                        style={{ transform: formData.paypalSandbox === 'true' ? 'translateX(20px)' : 'translateX(2px)' }}
                      />
                    </button>
                  </div>

                  {formData.paypalSandbox === 'true' && (
                    <div className="p-4 rounded-lg" style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b' }}>
                      <p className="text-sm font-medium" style={{ color: '#92400e' }}>Sandbox mode is active</p>
                      <p className="text-xs mt-1" style={{ color: '#a16207' }}>Payments will not be processed. Use sandbox credentials from the PayPal Developer Dashboard.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'billing' && (
          <BillingTabContent />
        )}
      </div>
    </div>
  );
}

function BillingTabContent() {
  const { showToast } = useToast();

  const { data: tenant, isLoading, error } = useTenantPlan();

  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const { data: invoiceData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['stripe-invoices'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const funcUrl = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/stripe-invoices`;
      if (!funcUrl.startsWith('http')) return { invoices: [] };

      const res = await fetch(funcUrl, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch invoices');
      return res.json() as Promise<{ invoices: InvoiceItem[] }>;
    },
    enabled: !!tenant?.stripe_customer_id,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    meta: { errorMessage: 'Failed to load invoices' },
  });

  const openPortal = useCallback(async () => {
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const funcUrl = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/stripe-portal`;
      if (!funcUrl.startsWith('http')) {
        showToast('Stripe portal is not yet available. Contact support to manage your subscription.', 'info');
        return;
      }

      const res = await fetch(funcUrl, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        showToast(data.error || 'Failed to open portal', 'error');
      }
    } catch (err) {
      console.debug('Portal error:', err);
      showToast('Failed to open Stripe portal', 'error');
    } finally {
      setPortalLoading(false);
    }
  }, [showToast]);

  const startCheckout = useCallback(async (planSlug: string) => {
    setCheckoutLoading(planSlug);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const funcUrl = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/stripe-checkout`;
      if (!funcUrl.startsWith('http')) {
        showToast('Stripe checkout is not yet available. Contact support to upgrade.', 'info');
        return;
      }

      const res = await fetch(funcUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan_slug: planSlug }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast(data.error || 'Failed to start checkout', 'error');
      }
    } catch (err) {
      console.debug('Checkout error:', err);
      showToast('Failed to start checkout', 'error');
    } finally {
      setCheckoutLoading(null);
    }
  }, [showToast]);

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm" style={{ color: 'var(--text-danger)' }}>Failed to load subscription data.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) return <LoadingSpinner />;

  const plan = tenant?.plan;
  const status = tenant?.subscription_status;
  const periodEnd = tenant?.subscription_current_period_end;

  const statusBadge: Record<string, { variant: 'success' | 'warning' | 'danger' | 'gray'; label: string }> = {
    active: { variant: 'success', label: 'Active' },
    trialing: { variant: 'success', label: 'Trial' },
    past_due: { variant: 'danger', label: 'Past Due' },
    canceled: { variant: 'gray', label: 'Canceled' },
    incomplete: { variant: 'warning', label: 'Incomplete' },
  };

  const badge = statusBadge[status || 'incomplete'] || { variant: 'gray' as const, label: status || 'Unknown' };

  const plans = [
    {
      slug: 'starter',
      name: 'Starter',
      price: 149,
      features: ['Event & booking management', 'Staff management (up to 5)', 'Basic reports', 'Standard support'],
      highlighted: false,
    },
    {
      slug: 'growth',
      name: 'Growth',
      price: 299,
      features: ['Everything in Starter', 'Email marketing & campaigns', 'Advanced analytics', 'Corporate accounts', 'Unlimited staff', 'Priority support'],
      highlighted: true,
    },
    {
      slug: 'pro',
      name: 'Pro',
      price: 499,
      features: ['Everything in Growth', 'Gift card system', 'Referral program', 'API access', 'Advanced automations', 'Dedicated support'],
      highlighted: false,
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {plan?.name || 'Starter'} Plan
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {plan?.price_monthly ? `$${plan.price_monthly / 100}/mo` : 'Custom pricing'}
              </p>
            </div>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          {periodEnd && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Current period ends: {new Date(periodEnd).toLocaleDateString()}
            </p>
          )}
          <div className="flex items-center gap-3 pt-2">
            {tenant?.stripe_customer_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={openPortal}
                disabled={portalLoading}
              >
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Manage Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {plans.map((p) => {
              const isCurrent = plan?.slug === p.slug;
              return (
                <div
                  key={p.slug}
                  className={`relative rounded-xl border-2 p-6 flex flex-col ${isCurrent ? 'border-primary-500' : 'border-gray-200'} ${p.highlighted ? 'shadow-lg' : ''}`}
                  style={isCurrent ? { borderColor: 'var(--primary-color)' } : { borderColor: 'var(--border-color)' }}
                >
                  {p.highlighted && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: 'var(--primary-color)' }}>
                      Popular
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-green-700 bg-green-100">
                      Current
                    </div>
                  )}
                  <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{p.name}</h3>
                  <p className="text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                    ${p.price}<span className="text-base font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span>
                  </p>
                  <ul className="space-y-2 mb-6 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button variant="outline" disabled className="w-full">
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => startCheckout(p.slug)}
                      disabled={checkoutLoading === p.slug}
                    >
                      {checkoutLoading === p.slug ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Upgrade to {p.name}
                    </Button>
                  )}
                </div>
              );
            })}

            <div
              className="relative rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center text-center"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Enterprise</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                Custom pricing for larger studios with advanced needs.
              </p>
              <ul className="space-y-2 mb-6 text-left w-full">
                {['White-glove onboarding', 'Custom integrations', 'Dedicated account manager', 'SLA guarantees', 'Priority support 24/7', 'Custom contract terms'].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary-500" style={{ color: 'var(--primary-color)' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open('mailto:sales@paintandsip.com?subject=Enterprise%20Plan%20Inquiry', '_blank')}
              >
                Contact Sales
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {tenant?.stripe_customer_id && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice History</CardTitle>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-gray-200 animate-pulse" />
                ))}
              </div>
            ) : invoiceData?.invoices && invoiceData.invoices.length > 0 ? (
              <div className="space-y-2">
                {invoiceData.invoices.slice(0, 10).map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {inv.number || inv.id.slice(0, 12)}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {new Date(inv.created).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        ${(inv.amount_paid / 100).toFixed(2)}
                      </span>
                      <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'past_due' ? 'danger' : inv.status === 'draft' ? 'gray' : 'warning'}>
                        {inv.status}
                      </Badge>
                      {inv.hosted_invoice_url && (
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-gray-100"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No invoices found for this account.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface InvoiceItem {
  id: string;
  number: string | null;
  amount_paid: number;
  amount_due: number;
  status: string;
  currency: string;
  created: string;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  lines: Array<{
    description: string | null;
    amount: number;
    period: { start: string; end: string };
  }>;
}
