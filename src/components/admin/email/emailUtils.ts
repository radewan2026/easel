import { type LucideIcon } from 'lucide-react';
import { Activity, Megaphone, Mail, MessageSquare, ServerCog, Settings, TrendingUp, Users, Workflow } from 'lucide-react';
import type { EmailTemplate, EmailSegment } from '../../../hooks/useEmailCenter';

export type Tab = 'overview' | 'automations' | 'campaigns' | 'segments' | 'templates' | 'sms' | 'delivery' | 'performance' | 'settings';

export const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'automations', label: 'Automations', icon: Workflow },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'segments', label: 'Segments', icon: Users },
  { id: 'templates', label: 'Templates', icon: Mail },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'delivery', label: 'Delivery', icon: ServerCog },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// ── SMS types ──────────────────────────────────────────────
export type SmsTemplateType = 'transactional' | 'marketing' | 'automation';

export type SmsTemplate = {
  id: string;
  name: string;
  templateType: SmsTemplateType;
  triggerName: string;
  body: string;
  isActive: boolean;
  updatedAt: string;
};

export type SmsMessage = {
  id: string;
  recipientPhone: string;
  recipientName: string | null;
  bodySnapshot: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'opted_out';
  providerMessageId: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failedReason: string | null;
  createdAt: string;
};

export const smsStatusVariant: Record<SmsMessage['status'], 'primary' | 'success' | 'warning' | 'danger' | 'gray'> = {
  queued: 'gray',
  sent: 'primary',
  delivered: 'success',
  failed: 'danger',
  bounced: 'danger',
  opted_out: 'warning',
};

// SMS segment limit — Twilio splits messages over 160 GSM-7 chars into multiple segments.
export function smsSegmentCount(body: string): number {
  const length = body.length;
  if (length === 0) return 0;
  if (length <= 160) return 1;
  return Math.ceil(length / 153);
}

export const intentVariant: Record<EmailSegment['intent'], 'primary' | 'success' | 'warning' | 'gray'> = {
  revenue: 'success',
  retention: 'warning',
  operations: 'primary',
  growth: 'gray',
};

export function getErrorMessage(error: unknown, fallback = 'Unknown error') {
  return error instanceof Error ? error.message : fallback;
}

export const workflowSteps = [
  'Customer or owner action creates an event.',
  'Automation checks timing, consent, suppression, and template rules.',
  'Email is queued server-side with provider metadata.',
  'Provider webhooks write opens, clicks, bounces, spam, and delivery status.',
  'Customer profile, dashboard signals, and campaign reports update.',
];

export type SuppressionReason = 'unsubscribe' | 'bounce' | 'complaint' | 'manual';

export type SuppressionEntry = {
  id: string;
  email: string;
  reason: SuppressionReason;
  notes: string;
  createdAt: string;
};

export type SegmentRule = {
  id: string;
  name: string;
  description: string;
  intent: EmailSegment['intent'];
  source: 'customers' | 'newsletter' | 'gift_cards' | 'private_requests' | 'memberships' | 'analytics';
  condition: 'all' | 'lapsed' | 'recent' | 'unredeemed' | 'open_leads' | 'credits_available' | 'abandoned_checkout';
  count: number;
};

export type RecoveryCampaignDraft = {
  name: string;
  subject: string;
  body: string;
  recipientCount: number;
  source?: string;
};

export const RECOVERY_DRAFT_STORAGE_KEY = 'easel_recovery_campaign_draft';

export type EmailBlockType = 'hero' | 'heading' | 'text' | 'button' | 'image' | 'divider' | 'spacer' | 'promo' | 'event' | 'columns';

export type EmailBlock = {
  id: string;
  type: EmailBlockType;
  content: string;
  eyebrow?: string;
  secondaryContent?: string;
  url?: string;
  align?: 'left' | 'center';
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  padding?: 'compact' | 'normal' | 'spacious';
  condition?: string;
};

export type EmailBrandStyles = {
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardColor: string;
  footerAddress: string;
};

export type EmailTemplateVersion = {
  id: string;
  templateId: string;
  templateName: string;
  subject: string;
  previewText: string;
  body: string;
  savedAt: string;
  note: string;
};

export type EmailWorkspaceSettings = {
  templates: EmailTemplate[];
  templateVersions?: EmailTemplateVersion[];
  customSegments: SegmentRule[];
  suppressionList: SuppressionEntry[];
  brandStyles?: EmailBrandStyles;
  providerSettings: {
    provider: string;
    fromName: string;
    fromEmail: string;
    replyTo: string;
    sendingDomain: string;
    ownerApprovalRequired: boolean;
  };
};

export const defaultBrandStyles: EmailBrandStyles = {
  brandName: 'Easel Paint & Sip',
  logoUrl: '',
  primaryColor: '#111827',
  accentColor: '#f97316',
  backgroundColor: '#f8fafc',
  cardColor: '#ffffff',
  footerAddress: 'Lake Tahoe Paint & Sip',
};

export const mergeTagGroups = [
  { label: 'Customer', tags: ['{{first_name}}', '{{customer_email}}', '{{unsubscribe_url}}'] },
  { label: 'Event', tags: ['{{event_title}}', '{{event_datetime}}', '{{event_url}}', '{{venue_name}}'] },
  { label: 'Order', tags: ['{{order_total}}', '{{ticket_count}}', '{{receipt_url}}'] },
  { label: 'Membership', tags: ['{{credit_count}}', '{{renewal_date}}', '{{membership_plan}}'] },
  { label: 'Gift Card', tags: ['{{gift_card_balance}}', '{{gift_card_code}}'] },
  { label: 'Private Request', tags: ['{{proposal_url}}', '{{guest_count}}', '{{preferred_date}}'] },
];

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function bodyToBlocks(body: string): EmailBlock[] {
  if (!body.trim()) {
    return [{ id: `block-${Date.now()}`, type: 'text', content: 'Hi {{first_name}}, we would love to see you at the studio soon.', padding: 'normal' }];
  }

  if (body.includes('data-email-builder="true"')) {
    const blocks: EmailBlock[] = [];
    const blockPattern = /<!-- block:(.*?) -->([\s\S]*?)<!-- \/block -->/g;
    let match;
    while ((match = blockPattern.exec(body)) !== null) {
      const type = match[1] as EmailBlockType;
      const html = match[2];
      const condition = body.slice(0, match.index).match(/<!-- condition:(.*?) -->\s*$/)?.[1];
      const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const href = html.match(/href="([^"]+)"/)?.[1] || html.match(/src="([^"]+)"/)?.[1];
      const backgroundColor = html.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,6}|[a-zA-Z]+)/)?.[1];
      const color = html.match(/color:\s*(#[0-9a-fA-F]{3,6}|[a-zA-Z]+)/)?.[1];
      blocks.push({
        id: `block-${Date.now()}-${blocks.length}`,
        type,
        content: text || (type === 'divider' || type === 'spacer' ? '' : 'Edit this block'),
        url: href,
        align: html.includes('text-align:center') || html.includes('align="center"') ? 'center' : 'left',
        backgroundColor,
        textColor: color,
        padding: html.includes('padding:32px') ? 'spacious' : html.includes('padding:12px') ? 'compact' : 'normal',
        condition,
      });
    }
    if (blocks.length) return blocks;
  }

  return body
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph, index) => ({
      id: `block-${Date.now()}-${index}`,
      type: index === 0 && paragraph.length < 90 ? 'heading' as const : 'text' as const,
      content: paragraph.replace(/<[^>]+>/g, '').trim(),
      align: index === 0 ? 'center' as const : 'left' as const,
      padding: 'normal' as const,
    }));
}

export function blocksToHtml(blocks: EmailBlock[], brand: EmailBrandStyles = defaultBrandStyles) {
  const rendered = blocks.map((block) => {
    const align = block.align || 'left';
    const paddingMap = { compact: 12, normal: 20, spacious: 32 };
    const padding = paddingMap[block.padding || 'normal'];
    const textColor = block.textColor || '#111827';
    const accentColor = block.accentColor || '#f97316';
    const backgroundColor = block.backgroundColor || 'transparent';
    const panelStyle = backgroundColor !== 'transparent' ? `background:${escapeHtml(backgroundColor)};border-radius:14px;padding:${padding}px;margin:0 0 18px;` : `padding:${padding}px 0;margin:0;`;
    const conditionOpen = block.condition ? `<!-- condition:${block.condition} -->` : '';
    const conditionClose = block.condition ? '<!-- /condition -->' : '';
    if (block.type === 'hero') {
      return `${conditionOpen}<!-- block:hero --><div style="${panelStyle}text-align:${align};"><p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${accentColor};">${escapeHtml(block.eyebrow || 'Paint & Sip')}</p><h1 style="margin:0 0 14px;font-size:32px;line-height:1.15;color:${escapeHtml(textColor)};">${escapeHtml(block.content)}</h1><p style="margin:0;font-size:16px;line-height:1.6;color:#4b5563;">${escapeHtml(block.secondaryContent || 'A creative night out is waiting for you.').replaceAll('\n', '<br />')}</p></div><!-- /block -->${conditionClose}`;
    }
    if (block.type === 'heading') {
      return `${conditionOpen}<!-- block:heading --><h2 style="margin:0 0 18px;font-size:26px;line-height:1.2;color:${escapeHtml(textColor)};text-align:${align};">${escapeHtml(block.content)}</h2><!-- /block -->${conditionClose}`;
    }
    if (block.type === 'button') {
      const href = escapeHtml(block.url || '{{event_url}}');
      return `${conditionOpen}<!-- block:button --><p style="text-align:${align};margin:24px 0;"><a href="${href}" style="display:inline-block;background:${accentColor};color:#ffffff;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:700;">${escapeHtml(block.content || 'Reserve your seat')}</a></p><!-- /block -->${conditionClose}`;
    }
    if (block.type === 'image') {
      const src = escapeHtml(block.url || 'https://placehold.co/1200x675?text=Paint+%26+Sip');
      return `${conditionOpen}<!-- block:image --><img src="${src}" alt="${escapeHtml(block.content || 'Paint and sip event')}" style="display:block;width:100%;max-width:560px;border-radius:10px;margin:20px auto;" /><!-- /block -->${conditionClose}`;
    }
    if (block.type === 'promo') {
      return `${conditionOpen}<!-- block:promo --><div style="background:${escapeHtml(block.backgroundColor || '#fff7ed')};border:1px solid #fed7aa;border-radius:14px;padding:${padding}px;margin:0 0 18px;text-align:${align};"><p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${accentColor};">${escapeHtml(block.eyebrow || 'Limited offer')}</p><p style="margin:0 0 8px;font-size:24px;font-weight:800;color:${escapeHtml(textColor)};">${escapeHtml(block.content)}</p><p style="margin:0;font-size:15px;line-height:1.5;color:#4b5563;">${escapeHtml(block.secondaryContent || '').replaceAll('\n', '<br />')}</p></div><!-- /block -->${conditionClose}`;
    }
    if (block.type === 'event') {
      const href = escapeHtml(block.url || '{{event_url}}');
      return `${conditionOpen}<!-- block:event --><div style="border:1px solid #e5e7eb;border-radius:14px;padding:${padding}px;margin:0 0 18px;"><p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${accentColor};">${escapeHtml(block.eyebrow || '{{event_datetime}}')}</p><h3 style="margin:0 0 8px;font-size:22px;line-height:1.25;color:${escapeHtml(textColor)};">${escapeHtml(block.content || '{{event_title}}')}</h3><p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#4b5563;">${escapeHtml(block.secondaryContent || 'Seats are available for this upcoming workshop.').replaceAll('\n', '<br />')}</p><a href="${href}" style="color:${accentColor};font-weight:700;text-decoration:none;">View event details &rarr;</a></div><!-- /block -->${conditionClose}`;
    }
    if (block.type === 'columns') {
      const [left, right] = block.content.split('||');
      return `${conditionOpen}<!-- block:columns --><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;"><tr><td width="50%" style="vertical-align:top;padding:14px;border-radius:12px;background:${escapeHtml(block.backgroundColor || '#f9fafb')};"><p style="margin:0;font-size:15px;line-height:1.5;color:#374151;">${escapeHtml(left || 'Column one').replaceAll('\n', '<br />')}</p></td><td width="16"></td><td width="50%" style="vertical-align:top;padding:14px;border-radius:12px;background:${escapeHtml(block.backgroundColor || '#f9fafb')};"><p style="margin:0;font-size:15px;line-height:1.5;color:#374151;">${escapeHtml(right || 'Column two').replaceAll('\n', '<br />')}</p></td></tr></table><!-- /block -->${conditionClose}`;
    }
    if (block.type === 'divider') {
      return `${conditionOpen}<!-- block:divider --><hr style="border:0;border-top:1px solid #e5e7eb;margin:26px 0;" /><!-- /block -->${conditionClose}`;
    }
    if (block.type === 'spacer') {
      return `${conditionOpen}<!-- block:spacer --><div style="height:${block.padding === 'spacious' ? 40 : block.padding === 'compact' ? 12 : 24}px;line-height:${block.padding === 'spacious' ? 40 : block.padding === 'compact' ? 12 : 24}px;">&nbsp;</div><!-- /block -->${conditionClose}`;
    }
    return `${conditionOpen}<!-- block:text --><div style="${panelStyle}"><p style="margin:0;font-size:16px;line-height:1.6;color:${escapeHtml(block.textColor || '#374151')};text-align:${align};">${escapeHtml(block.content).replaceAll('\n', '<br />')}</p></div><!-- /block -->${conditionClose}`;
  }).join('\n');

  return `<div data-email-builder="true" style="background:${escapeHtml(brand.backgroundColor)};padding:24px;">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;">{{preview_text}}</div>
  <div style="max-width:640px;margin:0 auto;background:${escapeHtml(brand.cardColor)};border-radius:16px;padding:34px;font-family:Arial,Helvetica,sans-serif;box-shadow:0 8px 30px rgba(15,23,42,.08);">
    <div style="text-align:center;margin:0 0 26px;">${brand.logoUrl ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.brandName)}" style="max-width:160px;margin:0 auto 10px;display:block;" />` : ''}<p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${escapeHtml(brand.accentColor)};">${escapeHtml(brand.brandName)}</p></div>
${rendered}
    <p style="margin:30px 0 0;font-size:12px;line-height:1.5;color:#6b7280;text-align:center;">${escapeHtml(brand.footerAddress)}<br />You are receiving this because you opted into ${escapeHtml(brand.brandName)} updates. <a href="{{unsubscribe_url}}" style="color:${escapeHtml(brand.accentColor)};">Manage preferences</a></p>
  </div>
</div>`;
}

// Re-export EmailSegment type alias for convenience
export type { EmailSegment };
