export type AccountRole = 'admin' | 'manager' | 'staff';
export type AdminRole = 'admin' | 'manager' | 'staff' | 'none';

export type EmployeePermissions = {
  dashboard?: boolean;
  events?: boolean;
  sales?: boolean;
  products?: boolean;
  customers?: boolean;
  attendees?: boolean;
  reports?: boolean;
  coupons?: boolean;
  giftCards?: boolean;
  newsletter?: boolean;
  blog?: boolean;
  galleries?: boolean;
  venues?: boolean;
  waitlist?: boolean;
  submissions?: boolean;
  referrals?: boolean;
  testimonials?: boolean;
  FAQs?: boolean;
  settings?: boolean;
  chat?: boolean;
  timeTracking?: boolean;
  payroll?: boolean;
};

export type AccountPermissions = EmployeePermissions;

export type BlogCategoryType = 'Events' | 'Tips' | 'News' | 'Community';

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
}

export type { BlogCategory as default };

export interface Account {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  password_hash: string;
  avatar_url: string | null;
  is_active: boolean;
  permissions: EmployeePermissions | null;
  hourly_rate: number | null;
  overtime_multiplier: number;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  account_id: string;
  employee_id?: string;
  clock_in: string;
  clock_out: string | null;
  hours: number | null;
  notes: string | null;
  is_manual: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
  account?: Account;
  employee?: Employee;
}

export interface Venue {
  id: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  phone: string | null;
  capacity: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string | null;
  venue_id: string | null;
  base_price_per_seat: number | null;
  max_seats: number | null;
  seats_available: number | null;
  main_image_url: string | null;
  is_published: boolean;
  is_archived: boolean;
  recurrence: Record<string, unknown> | null;
  parent_event_id: string | null;
  created_at: string;
  updated_at: string;
  venue?: Venue;
}

export interface EventImage {
  id: string;
  event_id: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}

export type DiscountType = 'percentage' | 'fixed';
export type CouponSource = 'internal' | 'groupon' | 'other_platform';

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  max_uses: number | null;
  uses_so_far: number;
  valid_from: string | null;
  valid_to: string | null;
  source: CouponSource;
  external_platform_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';

export interface Order {
  id: string;
  event_id: string;
  purchaser_name: string;
  purchaser_email: string;
  purchaser_phone: string | null;
  total_seats: number;
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  coupon_id: string | null;
  status: OrderStatus;
  refund_reason: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
  event?: Event;
  coupon?: Coupon;
  attendees?: Attendee[];
}

export interface Attendee {
  id: string;
  order_id: string;
  full_name: string;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export type MembershipStatus = 'active' | 'paused' | 'past_due' | 'canceled';

export interface CustomerMembership {
  id: string;
  customer_email: string;
  customer_name: string | null;
  plan_id: string | null;
  plan_name: string;
  monthly_price: number;
  credits_per_cycle: number;
  renewal_date: string;
  status: MembershipStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MembershipCreditRedemption {
  id: string;
  customer_membership_id: string | null;
  customer_email: string;
  event_id: string;
  order_id: string;
  credits_used: number;
  amount_covered: number;
  redeemed_at: string;
  created_at: string;
  event?: Event;
  order?: Order;
  membership?: CustomerMembership;
}

export interface GiftCard {
  id: string;
  code: string;
  amount: number;
  remaining_balance: number;
  purchaser_name: string;
  purchaser_email: string;
  recipient_name: string | null;
  recipient_email: string | null;
  message: string | null;
  is_redeemed: boolean;
  redeemed_at: string | null;
  created_at: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name: string | null;
  source: string;
  is_active: boolean;
  created_at: string;
}

export type Subscriber = NewsletterSubscriber;

export interface Referral {
  id: string;
  code: string;
  referrer_name: string;
  referrer_email: string;
  uses: number;
  max_uses: number | null;
  discount_percent: number;
  created_at: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  header_image_url: string | null;
  category_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  category?: BlogCategory;
}

export interface Setting {
  id: string;
  key: string;
  value: unknown;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogEntry {
  id: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export type EventViewMode = 'card' | 'calendar' | 'list';

export interface GalleryCategory {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface GalleryImage {
  id: string;
  gallery_id: string;
  url: string;
  caption: string | null;
  sort_order: number;
  paintable: boolean;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  estimated_time_minutes: number | null;
  created_at: string;
}

export interface Gallery {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  is_active: boolean;
  is_deleted: boolean;
  default_image_url: string | null;
  created_at: string;
  updated_at: string;
  images?: GalleryImage[];
  category?: GalleryCategory;
}

export type EmailBroadcastStatus = 'draft' | 'scheduled' | 'sent' | 'failed';

export interface EmailBroadcast {
  id: string;
  event_id: string;
  subject: string;
  body: string;
  recipient_count: number;
  status: EmailBroadcastStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  event?: Event;
}

export type SubmissionStatus = 'new' | 'contacted' | 'booked' | 'archived';

export interface Submission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  event_type: string;
  preferred_date: string | null;
  preferred_time: string | null;
  group_size: number | null;
  notes: string | null;
  status: SubmissionStatus;
  created_at: string;
  updated_at: string;
}

export interface WaitlistEntry {
  id: string;
  event_id: string;
  name: string;
  email: string;
  phone: string | null;
  seats_desired: number;
  notified: boolean;
  created_at: string;
  event?: Event;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  images: string[];
  category_id: string | null;
  is_active: boolean;
  stock: number;
  sku: string | null;
  weight_oz: number | null;
  created_at: string;
  updated_at: string;
  category?: ProductCategory;
}

export interface ProductOrder {
  id: string;
  order_id: string | null;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  purchaser_name: string;
  purchaser_email: string;
  purchaser_phone: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export type EmployeeRole = 'instructor' | 'artist' | 'host';
export type EmployeeStatus = 'active' | 'inactive';

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: EmployeeRole;
  hourly_rate: number;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  status: EmployeeStatus;
  availability_days: string[];
  account_id: string | null;
  notes: string | null;
  password_hash: string | null;
  avatar_url: string | null;
  admin_role: AdminRole;
  permissions: EmployeePermissions | null;
  overtime_multiplier: number;
  created_at: string;
  updated_at: string;
}

export type AssignmentStatus = 'assigned' | 'confirmed' | 'declined' | 'completed';

export interface EventAssignment {
  id: string;
  event_id: string;
  employee_id: string;
  status: AssignmentStatus;
  assigned_at: string;
  confirmed_at: string | null;
  clock_in: string | null;
  clock_out: string | null;
  hours_worked: number | null;
  hourly_rate_snapshot: number | null;
  pay_amount: number | null;
  pay_override: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee;
  event?: Event;
}

export type PayStatus = 'pending' | 'approved' | 'paid' | 'failed';

export interface PayRecord {
  id: string;
  event_assignment_id: string;
  employee_id: string;
  event_id: string;
  hours_worked: number;
  hourly_rate: number;
  pay_amount: number;
  pay_override: boolean;
  status: PayStatus;
  stripe_transfer_id: string | null;
  stripe_error: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  employee?: Employee;
  event?: Event;
  assignment?: EventAssignment;
}

export type PrivateRequestEventType = 'bachelorette' | 'corporate' | 'birthday' | 'holiday' | 'other';
export type PrivateRequestTime = 'morning' | 'afternoon' | 'evening';
export type PaintingSelectionType = 'chosen' | 'owner_chooses' | 'custom_request';
export type PrivateRequestStatus = 'submitted' | 'contacted' | 'confirmed' | 'converted_to_event' | 'declined';

export interface PrivateEventRequest {
  id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  company_name: string | null;
  corporate_account_id: string | null;
  event_type: PrivateRequestEventType;
  preferred_date: string;
  alternate_date: string | null;
  preferred_time: PrivateRequestTime;
  guest_count: number;
  venue_preference_id: string | null;
  painting_selection_type: PaintingSelectionType;
  selected_painting_id: string | null;
  custom_painting_request: string | null;
  special_requests: string | null;
  status: PrivateRequestStatus;
  admin_notes: string | null;
  deposit_required: boolean;
  deposit_amount: number | null;
  created_at: string;
  updated_at: string;
  venue?: Venue;
  painting?: GalleryImage;
  corporate_account?: CorporateAccount;
}

export type CorporatePlanType = 'monthly_retainer' | 'pay_per_event' | 'custom';
export type CorporateStatus = 'active' | 'paused' | 'inactive';

export interface CorporateAccount {
  id: string;
  company_name: string;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string | null;
  billing_address: { street: string; city: string; state: string; zip: string } | null;
  tax_id: string | null;
  plan_type: CorporatePlanType;
  monthly_seat_allotment: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  auto_charge: boolean;
  status: CorporateStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'past_due' | 'voided';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: string;
  corporate_account_id: string;
  billing_period_start: string;
  billing_period_end: string;
  line_items: InvoiceLineItem[];
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  status: InvoiceStatus;
  stripe_invoice_id: string | null;
  sent_at: string | null;
  paid_at: string | null;
  due_date: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  corporate_account?: CorporateAccount;
}

export interface PaymentLink {
  id: string;
  private_event_request_id: string | null;
  event_id: string | null;
  amount: number;
  description: string | null;
  stripe_checkout_session_id: string | null;
  status: 'pending' | 'paid' | 'expired';
  created_at: string;
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
export type SupportLevel = 'standard' | 'priority' | 'dedicated' | 'white-glove';

export interface TenantFeatures {
  analytics: boolean;
  email_marketing: boolean;
  gift_cards: boolean;
  referrals: boolean;
  corporate_accounts: boolean;
  api_access: boolean;
  automations: boolean;
  unlimited_staff: boolean;
  max_staff: number | null;
  support_level: SupportLevel;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  features: TenantFeatures;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  company_name: string;
  plan_id: string | null;
  plan?: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  subscription_current_period_end: string | null;
  settings: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
