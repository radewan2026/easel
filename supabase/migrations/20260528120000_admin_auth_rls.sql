-- Admin Auth + RLS migration
-- Adds user_id column to employees, creates RLS policies on all tables

-- 1. Add user_id to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);

-- 2. Enable RLS on all tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_credit_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_event_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_broadcasts ENABLE ROW LEVEL SECURITY;

-- 3. Helper: check if the authenticated user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid()
    AND admin_role IN ('admin', 'manager')
    AND status = 'active'
  );
$$;

-- 4. RLS Policies

-- Events: anyone can read published, only admins can write
CREATE POLICY "events_select_published" ON events FOR SELECT
  USING (is_published = true OR is_admin());

CREATE POLICY "events_insert_admin" ON events FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "events_update_admin" ON events FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "events_delete_admin" ON events FOR DELETE
  USING (is_admin());

-- Event images: anyone can read published event images, admins can write
CREATE POLICY "event_images_select" ON event_images FOR SELECT
  USING (EXISTS (SELECT 1 FROM events WHERE events.id = event_images.event_id AND (events.is_published OR is_admin())));

CREATE POLICY "event_images_insert_admin" ON event_images FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "event_images_update_admin" ON event_images FOR UPDATE
  USING (is_admin());

CREATE POLICY "event_images_delete_admin" ON event_images FOR DELETE
  USING (is_admin());

-- Orders: admins can read all, customers can read their own
CREATE POLICY "orders_select_admin" ON orders FOR SELECT
  USING (is_admin());

CREATE POLICY "orders_insert" ON orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "orders_update_admin" ON orders FOR UPDATE
  USING (is_admin());

-- Attendees: admins can read all
CREATE POLICY "attendees_select_admin" ON attendees FOR SELECT
  USING (is_admin());

CREATE POLICY "attendees_insert" ON attendees FOR INSERT
  WITH CHECK (true);

-- Venues: anyone can read active, only admins can write
CREATE POLICY "venues_select" ON venues FOR SELECT
  USING (is_active = true OR is_admin());

CREATE POLICY "venues_insert_admin" ON venues FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "venues_update_admin" ON venues FOR UPDATE
  USING (is_admin());

CREATE POLICY "venues_delete_admin" ON venues FOR DELETE
  USING (is_admin());

-- Coupons: only admins
CREATE POLICY "coupons_select_admin" ON coupons FOR SELECT
  USING (is_admin());

CREATE POLICY "coupons_insert_admin" ON coupons FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "coupons_update_admin" ON coupons FOR UPDATE
  USING (is_admin());

-- Employees: admins can read/write all, employees can read own
CREATE POLICY "employees_select" ON employees FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "employees_insert_admin" ON employees FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "employees_update_admin" ON employees FOR UPDATE
  USING (is_admin());

-- Settings: only admins
CREATE POLICY "settings_select_admin" ON settings FOR SELECT
  USING (is_admin());

CREATE POLICY "settings_insert_admin" ON settings FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "settings_update_admin" ON settings FOR UPDATE
  USING (is_admin());

-- Blog: anyone can read published, only admins can write
CREATE POLICY "blog_posts_select" ON blog_posts FOR SELECT
  USING (is_published = true OR is_admin());

CREATE POLICY "blog_posts_insert_admin" ON blog_posts FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "blog_posts_update_admin" ON blog_posts FOR UPDATE
  USING (is_admin());

CREATE POLICY "blog_posts_delete_admin" ON blog_posts FOR DELETE
  USING (is_admin());

-- Gift cards: only admins
CREATE POLICY "gift_cards_select_admin" ON gift_cards FOR SELECT
  USING (is_admin());

CREATE POLICY "gift_cards_insert_admin" ON gift_cards FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "gift_cards_update_admin" ON gift_cards FOR UPDATE
  USING (is_admin());

-- Products: anyone can read active, only admins can write
CREATE POLICY "products_select" ON products FOR SELECT
  USING (is_active = true OR is_admin());

CREATE POLICY "products_insert_admin" ON products FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "products_update_admin" ON products FOR UPDATE
  USING (is_admin());

-- Product orders: admins can read all
CREATE POLICY "product_orders_select_admin" ON product_orders FOR SELECT
  USING (is_admin());

CREATE POLICY "product_orders_insert" ON product_orders FOR INSERT
  WITH CHECK (true);

-- Gallery: anyone can read active, only admins can write
CREATE POLICY "galleries_select" ON galleries FOR SELECT
  USING (is_active = true OR is_admin());

CREATE POLICY "galleries_insert_admin" ON galleries FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "galleries_update_admin" ON galleries FOR UPDATE
  USING (is_admin());

-- Gallery images: anyone can read, only admins can write
CREATE POLICY "gallery_images_select" ON gallery_images FOR SELECT
  USING (true);

CREATE POLICY "gallery_images_insert_admin" ON gallery_images FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "gallery_images_update_admin" ON gallery_images FOR UPDATE
  USING (is_admin());

-- Activity log: only admins
CREATE POLICY "activity_log_select_admin" ON activity_log FOR SELECT
  USING (is_admin());

CREATE POLICY "activity_log_insert" ON activity_log FOR INSERT
  WITH CHECK (true);

-- Private event requests: anyone can insert, admins can read/update
CREATE POLICY "private_event_requests_insert" ON private_event_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "private_event_requests_select_admin" ON private_event_requests FOR SELECT
  USING (is_admin());

CREATE POLICY "private_event_requests_update_admin" ON private_event_requests FOR UPDATE
  USING (is_admin());

-- Corporate accounts: only admins
CREATE POLICY "corporate_accounts_select_admin" ON corporate_accounts FOR SELECT
  USING (is_admin());

CREATE POLICY "corporate_accounts_insert_admin" ON corporate_accounts FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "corporate_accounts_update_admin" ON corporate_accounts FOR UPDATE
  USING (is_admin());

-- Email broadcasts: only admins
CREATE POLICY "email_broadcasts_select_admin" ON email_broadcasts FOR SELECT
  USING (is_admin());

CREATE POLICY "email_broadcasts_insert_admin" ON email_broadcasts FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "email_broadcasts_update_admin" ON email_broadcasts FOR UPDATE
  USING (is_admin());

-- 5. Function to create an admin auth user and link to employee
CREATE OR REPLACE FUNCTION public.create_admin_auth_user(
  employee_id UUID,
  email TEXT,
  password TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auth_user_id UUID;
BEGIN
  -- Create the user in auth.users
  auth_user_id := extensions.uuid_generate_v4();

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    auth_user_id,
    '00000000-0000-0000-0000-000000000000',
    email,
    crypt(password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"employee_id":"' || employee_id || '"}',
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    auth_user_id,
    auth_user_id,
    format('{"sub":"%s","email":"%s"}', auth_user_id::text, email)::jsonb,
    'email',
    email,
    now(),
    now(),
    now()
  );

  -- Link to employee record
  UPDATE employees SET user_id = auth_user_id WHERE id = employee_id;

  RETURN auth_user_id;
END;
$$;
