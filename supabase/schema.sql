-- BCare database schema (exported 2026-10-03)
-- Run on an empty Supabase project (SQL Editor).

set check_function_bodies = off;

create table public.booking_payments (
  id uuid default gen_random_uuid() not null,
  booking_id uuid not null,
  customer_id uuid not null,
  amount numeric(10,2) not null,
  payment_method text default 'bank_transfer'::text not null,
  slip_image_url text not null,
  payment_status text default 'pending'::text not null,
  rejected_reason text,
  submitted_at timestamp with time zone default now() not null,
  paid_at timestamp with time zone,
  verified_at timestamp with time zone,
  verified_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  verification_status text default 'submitted'::text not null,
  verification_provider text,
  provider_reference text,
  verification_response jsonb,
  slip_amount numeric(10,2)
);

create table public.bookings (
  id uuid default gen_random_uuid() not null,
  customer_id uuid not null,
  vehicle_id uuid,
  service_id uuid not null,
  booking_date date not null,
  booking_time time without time zone not null,
  status text default 'pending'::text not null,
  note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  payment_status text default 'not_required'::text not null,
  payment_amount numeric(10,2),
  picked_up_at timestamp with time zone
);

create table public.delivery_addresses (
  id uuid default gen_random_uuid() not null,
  customer_id uuid not null,
  recipient_name text not null,
  phone_number text not null,
  address_line text not null,
  province text not null,
  district text not null,
  postal_code text not null,
  is_default boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.garage_capacity (
  id uuid default gen_random_uuid() not null,
  booking_date date not null,
  booking_time time without time zone not null,
  max_bookings integer default 1 not null,
  status text default 'open'::text not null,
  note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.garage_closed_dates (
  closed_date date not null,
  reason text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.garage_operating_days (
  weekday integer not null,
  is_open boolean default true not null,
  open_time time without time zone default '09:00:00'::time without time zone not null,
  close_time time without time zone default '18:00:00'::time without time zone not null,
  note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.homepage_appearance_settings (
  id uuid default gen_random_uuid() not null,
  setting_key text default 'default'::text not null,
  background_color text default '#0a0d0b'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid,
  background_image_url text,
  logo_url text
);

create table public.homepage_footer_settings (
  id uuid default gen_random_uuid() not null,
  setting_key text default 'default'::text not null,
  status text default 'active'::text not null,
  background_color text default '#C81010'::text not null,
  office_title text default 'สำนักงานใหญ่'::text not null,
  office_address text,
  office_phone text,
  office_fax text,
  contact_title text default 'สอบถามข้อมูล'::text not null,
  contact_phone text,
  contact_email text,
  services_title text default 'สินค้าและบริการ'::text not null,
  services_content text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid,
  office_latitude numeric(10,7),
  office_longitude numeric(10,7)
);

create table public.homepage_slides (
  id uuid default gen_random_uuid() not null,
  title text not null,
  subtitle text,
  description text,
  image_url text not null,
  primary_label text default 'จองบริการ'::text not null,
  primary_href text default '/services'::text not null,
  secondary_label text,
  secondary_href text,
  sort_order integer default 0 not null,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid
);

create table public.inventory_movements (
  id uuid default gen_random_uuid() not null,
  product_id uuid not null,
  movement_type text not null,
  quantity integer not null,
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null
);

create table public.payment_settings (
  id uuid default gen_random_uuid() not null,
  setting_key text default 'default'::text not null,
  status text default 'active'::text not null,
  promptpay_enabled boolean default true not null,
  promptpay_display_name text default 'BigO-RepairCar'::text not null,
  promptpay_id text,
  promptpay_qr_image_url text,
  bank_transfer_enabled boolean default true not null,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  bank_branch text,
  payment_instructions text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid
);

create table public.product_categories (
  id uuid default gen_random_uuid() not null,
  name text not null,
  description text,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.product_order_items (
  id uuid default gen_random_uuid() not null,
  product_order_id uuid not null,
  product_id uuid not null,
  quantity integer not null,
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) not null,
  created_at timestamp with time zone default now() not null
);

create table public.product_orders (
  id uuid default gen_random_uuid() not null,
  customer_id uuid not null,
  order_number text not null,
  status text default 'pending'::text not null,
  delivery_method text default 'pickup'::text not null,
  delivery_address text,
  subtotal_amount numeric(10,2) default 0 not null,
  delivery_fee numeric(10,2) default 0 not null,
  total_amount numeric(10,2) default 0 not null,
  payment_status text default 'unpaid'::text not null,
  note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  delivery_latitude numeric(10,7),
  delivery_longitude numeric(10,7)
);

create table public.product_payment_transactions (
  id uuid default gen_random_uuid() not null,
  product_payment_id uuid not null,
  product_order_id uuid not null,
  provider_reference text not null,
  verified_amount numeric(10,2) not null,
  verified_by_type text not null,
  verified_by_user_id uuid,
  verified_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null
);

create table public.product_payments (
  id uuid default gen_random_uuid() not null,
  product_order_id uuid not null,
  payment_method text default 'cash'::text not null,
  payment_status text default 'pending'::text not null,
  amount numeric(10,2) default 0 not null,
  paid_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  verification_provider text default 'manual'::text not null,
  verification_status text default 'not_submitted'::text not null,
  slip_image_url text,
  slip_qr_payload text,
  slip_reference text,
  slip_amount numeric(10,2),
  slip_transfer_at timestamp with time zone,
  slip_sender_bank text,
  slip_sender_account text,
  slip_receiver_bank text,
  slip_receiver_account text,
  slip_receiver_name text,
  provider_reference text,
  verification_response jsonb,
  submitted_at timestamp with time zone,
  verified_at timestamp with time zone,
  verified_by uuid,
  rejected_reason text
);

create table public.products (
  id uuid default gen_random_uuid() not null,
  product_category_id uuid not null,
  name text not null,
  description text,
  price numeric(10,2) not null,
  stock_quantity integer default 0 not null,
  image_url text,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  sku text,
  unit_price numeric(10,2) default 0 not null,
  cost_price numeric(10,2) default 0 not null
);

create table public.profiles (
  id uuid not null,
  full_name text not null,
  email text not null,
  phone_number text,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  role text default 'customer'::text not null,
  technician_specialty text,
  avatar_url text
);

create table public.repair_jobs (
  id uuid default gen_random_uuid() not null,
  booking_id uuid not null,
  customer_id uuid not null,
  vehicle_id uuid,
  mechanic_id uuid,
  status text default 'pending'::text not null,
  problem_description text,
  repair_detail text,
  labor_cost numeric(10,2) default 0 not null,
  parts_cost numeric(10,2) default 0 not null,
  total_cost numeric(10,2) default 0 not null,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  diagnosis text,
  repair_notes text
);

create table public.service_categories (
  id uuid default gen_random_uuid() not null,
  name text not null,
  description text,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.services (
  id uuid default gen_random_uuid() not null,
  service_category_id uuid not null,
  name text not null,
  description text,
  base_price numeric(10,2) default 0 not null,
  estimated_duration_minutes integer,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  image_url text
);

create table public.shopping_cart_items (
  id uuid default gen_random_uuid() not null,
  shopping_cart_id uuid not null,
  product_id uuid not null,
  quantity integer default 1 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.shopping_carts (
  id uuid default gen_random_uuid() not null,
  customer_id uuid not null,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.technician_profile_skills (
  technician_id uuid not null,
  skill_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table public.technician_skills (
  id uuid default gen_random_uuid() not null,
  name text not null,
  description text,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.vehicles (
  id uuid default gen_random_uuid() not null,
  customer_id uuid not null,
  license_plate text not null,
  brand text not null,
  model text not null,
  year integer,
  color text,
  engine_number text,
  chassis_number text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  image_url text
);

alter table public.booking_payments add constraint booking_payments_amount_check CHECK ((amount > (0)::numeric));

alter table public.booking_payments add constraint booking_payments_payment_method_check CHECK ((payment_method = ANY (ARRAY['bank_transfer'::text, 'promptpay'::text])));

alter table public.booking_payments add constraint booking_payments_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'rejected'::text])));

alter table public.booking_payments add constraint booking_payments_pkey PRIMARY KEY (id);

alter table public.booking_payments add constraint booking_payments_verification_provider_check CHECK (((verification_provider IS NULL) OR (verification_provider = ANY (ARRAY['slipok'::text, 'admin_manual'::text]))));

alter table public.booking_payments add constraint booking_payments_verification_status_check CHECK ((verification_status = ANY (ARRAY['submitted'::text, 'verified'::text, 'rejected'::text, 'failed'::text])));

alter table public.bookings add constraint bookings_payment_status_check CHECK ((payment_status = ANY (ARRAY['not_required'::text, 'awaiting_payment'::text, 'pending_review'::text, 'paid'::text, 'rejected'::text])));

alter table public.bookings add constraint bookings_pkey PRIMARY KEY (id);

alter table public.bookings add constraint bookings_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'completed'::text])));

alter table public.delivery_addresses add constraint delivery_addresses_address_line_check CHECK (((char_length(btrim(address_line)) >= 5) AND (char_length(btrim(address_line)) <= 500)));

alter table public.delivery_addresses add constraint delivery_addresses_phone_number_check CHECK (((char_length(btrim(phone_number)) >= 8) AND (char_length(btrim(phone_number)) <= 30)));

alter table public.delivery_addresses add constraint delivery_addresses_pkey PRIMARY KEY (id);

alter table public.delivery_addresses add constraint delivery_addresses_postal_code_check CHECK (((char_length(btrim(postal_code)) >= 4) AND (char_length(btrim(postal_code)) <= 20)));

alter table public.delivery_addresses add constraint delivery_addresses_recipient_name_check CHECK (((char_length(btrim(recipient_name)) >= 2) AND (char_length(btrim(recipient_name)) <= 120)));

alter table public.garage_capacity add constraint garage_capacity_booking_slot_key UNIQUE (booking_date, booking_time);

alter table public.garage_capacity add constraint garage_capacity_business_hours_check CHECK (((booking_time >= '09:00:00'::time without time zone) AND (booking_time <= '18:00:00'::time without time zone)));

alter table public.garage_capacity add constraint garage_capacity_max_bookings_check CHECK (((max_bookings >= 0) AND (max_bookings <= 100)));

alter table public.garage_capacity add constraint garage_capacity_pkey PRIMARY KEY (id);

alter table public.garage_capacity add constraint garage_capacity_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])));

alter table public.garage_closed_dates add constraint garage_closed_dates_pkey PRIMARY KEY (closed_date);

alter table public.garage_operating_days add constraint garage_operating_days_pkey PRIMARY KEY (weekday);

alter table public.garage_operating_days add constraint garage_operating_days_time_check CHECK ((open_time < close_time));

alter table public.garage_operating_days add constraint garage_operating_days_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)));

alter table public.homepage_appearance_settings add constraint homepage_appearance_settings_pkey PRIMARY KEY (id);

alter table public.homepage_appearance_settings add constraint homepage_appearance_settings_setting_key_key UNIQUE (setting_key);

alter table public.homepage_footer_settings add constraint homepage_footer_settings_pkey PRIMARY KEY (id);

alter table public.homepage_footer_settings add constraint homepage_footer_settings_setting_key_key UNIQUE (setting_key);

alter table public.homepage_footer_settings add constraint homepage_footer_settings_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

alter table public.homepage_slides add constraint homepage_slides_pkey PRIMARY KEY (id);

alter table public.homepage_slides add constraint homepage_slides_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

alter table public.inventory_movements add constraint inventory_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['stock_in'::text, 'stock_out'::text, 'adjustment_in'::text, 'adjustment_out'::text, 'sale'::text, 'repair_usage'::text, 'return'::text])));

alter table public.inventory_movements add constraint inventory_movements_pkey PRIMARY KEY (id);

alter table public.inventory_movements add constraint inventory_movements_quantity_check CHECK (((quantity > 0) AND (quantity <= 100000)));

alter table public.payment_settings add constraint payment_settings_pkey PRIMARY KEY (id);

alter table public.payment_settings add constraint payment_settings_setting_key_unique UNIQUE (setting_key);

alter table public.payment_settings add constraint payment_settings_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

alter table public.product_categories add constraint product_categories_name_key UNIQUE (name);

alter table public.product_categories add constraint product_categories_pkey PRIMARY KEY (id);

alter table public.product_categories add constraint product_categories_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

alter table public.product_order_items add constraint product_order_items_pkey PRIMARY KEY (id);

alter table public.product_order_items add constraint product_order_items_price_check CHECK (((unit_price >= (0)::numeric) AND (total_price >= (0)::numeric) AND (total_price = ((quantity)::numeric * unit_price))));

alter table public.product_order_items add constraint product_order_items_quantity_check CHECK (((quantity > 0) AND (quantity <= 1000)));

alter table public.product_orders add constraint product_orders_amounts_check CHECK (((subtotal_amount >= (0)::numeric) AND (delivery_fee >= (0)::numeric) AND (total_amount >= (0)::numeric) AND (total_amount = (subtotal_amount + delivery_fee))));

alter table public.product_orders add constraint product_orders_delivery_address_check CHECK (((delivery_method = 'pickup'::text) OR ((delivery_method = 'delivery'::text) AND (delivery_address IS NOT NULL) AND (btrim(delivery_address) <> ''::text))));

alter table public.product_orders add constraint product_orders_delivery_location_check CHECK ((((delivery_latitude IS NULL) AND (delivery_longitude IS NULL)) OR ((delivery_latitude IS NOT NULL) AND (delivery_longitude IS NOT NULL) AND ((delivery_latitude >= ('-90'::integer)::numeric) AND (delivery_latitude <= (90)::numeric)) AND ((delivery_longitude >= ('-180'::integer)::numeric) AND (delivery_longitude <= (180)::numeric)))));

alter table public.product_orders add constraint product_orders_delivery_method_check CHECK ((delivery_method = ANY (ARRAY['pickup'::text, 'delivery'::text])));

alter table public.product_orders add constraint product_orders_order_number_key UNIQUE (order_number);

alter table public.product_orders add constraint product_orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'pending'::text, 'partially_paid'::text, 'paid'::text, 'refunded'::text, 'cancelled'::text])));

alter table public.product_orders add constraint product_orders_pkey PRIMARY KEY (id);

alter table public.product_orders add constraint product_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'preparing'::text, 'ready_for_pickup'::text, 'out_for_delivery'::text, 'completed'::text, 'cancelled'::text])));

alter table public.product_payment_transactions add constraint product_payment_transactions_pkey PRIMARY KEY (id);

alter table public.product_payment_transactions add constraint product_payment_transactions_verified_amount_check CHECK ((verified_amount > (0)::numeric));

alter table public.product_payment_transactions add constraint product_payment_transactions_verified_by_type_check CHECK ((verified_by_type = ANY (ARRAY['system_slipok'::text, 'admin_manual'::text])));

alter table public.product_payments add constraint product_payments_amount_check CHECK ((amount >= (0)::numeric));

alter table public.product_payments add constraint product_payments_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'bank_transfer'::text, 'promptpay'::text, 'card'::text, 'other'::text])));

alter table public.product_payments add constraint product_payments_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text, 'cancelled'::text])));

alter table public.product_payments add constraint product_payments_pkey PRIMARY KEY (id);

alter table public.product_payments add constraint product_payments_slip_amount_check CHECK (((slip_amount IS NULL) OR (slip_amount >= (0)::numeric)));

alter table public.product_payments add constraint product_payments_verification_provider_check CHECK ((verification_provider = ANY (ARRAY['manual'::text, 'slipok'::text])));

alter table public.product_payments add constraint product_payments_verification_status_check CHECK ((verification_status = ANY (ARRAY['not_submitted'::text, 'submitted'::text, 'verified'::text, 'rejected'::text, 'failed'::text])));

alter table public.products add constraint products_cost_price_check CHECK ((cost_price >= (0)::numeric));

alter table public.products add constraint products_pkey PRIMARY KEY (id);

alter table public.products add constraint products_price_check CHECK ((price >= (0)::numeric));

alter table public.products add constraint products_product_category_id_name_key UNIQUE (product_category_id, name);

alter table public.products add constraint products_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

alter table public.products add constraint products_stock_quantity_check CHECK ((stock_quantity >= 0));

alter table public.products add constraint products_unit_price_check CHECK ((unit_price >= (0)::numeric));

alter table public.profiles add constraint profiles_email_key UNIQUE (email);

alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);

alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['customer'::text, 'admin'::text, 'technician'::text])));

alter table public.profiles add constraint profiles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'inactive'::text])));

alter table public.repair_jobs add constraint repair_jobs_booking_id_key UNIQUE (booking_id);

alter table public.repair_jobs add constraint repair_jobs_check CHECK (((completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at)));

alter table public.repair_jobs add constraint repair_jobs_labor_cost_check CHECK ((labor_cost >= (0)::numeric));

alter table public.repair_jobs add constraint repair_jobs_parts_cost_check CHECK ((parts_cost >= (0)::numeric));

alter table public.repair_jobs add constraint repair_jobs_pkey PRIMARY KEY (id);

alter table public.repair_jobs add constraint repair_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'assigned'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]))) NOT VALID;

alter table public.repair_jobs add constraint repair_jobs_total_cost_check CHECK ((total_cost >= (0)::numeric));

alter table public.service_categories add constraint service_categories_name_key UNIQUE (name);

alter table public.service_categories add constraint service_categories_pkey PRIMARY KEY (id);

alter table public.service_categories add constraint service_categories_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

alter table public.services add constraint services_base_price_check CHECK ((base_price >= (0)::numeric));

alter table public.services add constraint services_estimated_duration_minutes_check CHECK (((estimated_duration_minutes IS NULL) OR (estimated_duration_minutes > 0)));

alter table public.services add constraint services_pkey PRIMARY KEY (id);

alter table public.services add constraint services_service_category_id_name_key UNIQUE (service_category_id, name);

alter table public.services add constraint services_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

alter table public.shopping_cart_items add constraint shopping_cart_items_cart_product_key UNIQUE (shopping_cart_id, product_id);

alter table public.shopping_cart_items add constraint shopping_cart_items_pkey PRIMARY KEY (id);

alter table public.shopping_cart_items add constraint shopping_cart_items_quantity_check CHECK (((quantity > 0) AND (quantity <= 1000)));

alter table public.shopping_carts add constraint shopping_carts_pkey PRIMARY KEY (id);

alter table public.shopping_carts add constraint shopping_carts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'ordered'::text, 'abandoned'::text])));

alter table public.technician_profile_skills add constraint technician_profile_skills_pkey PRIMARY KEY (technician_id, skill_id);

alter table public.technician_skills add constraint technician_skills_name_key UNIQUE (name);

alter table public.technician_skills add constraint technician_skills_pkey PRIMARY KEY (id);

alter table public.technician_skills add constraint technician_skills_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

alter table public.vehicles add constraint vehicles_customer_id_license_plate_key UNIQUE (customer_id, license_plate);

alter table public.vehicles add constraint vehicles_pkey PRIMARY KEY (id);

alter table public.booking_payments add constraint booking_payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;

alter table public.booking_payments add constraint booking_payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.booking_payments add constraint booking_payments_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.bookings add constraint bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE RESTRICT;

alter table public.bookings add constraint bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT;

alter table public.bookings add constraint bookings_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

alter table public.delivery_addresses add constraint delivery_addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.homepage_appearance_settings add constraint homepage_appearance_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.homepage_footer_settings add constraint homepage_footer_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.homepage_slides add constraint homepage_slides_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.inventory_movements add constraint inventory_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.inventory_movements add constraint inventory_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

alter table public.payment_settings add constraint payment_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.product_order_items add constraint product_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

alter table public.product_order_items add constraint product_order_items_product_order_id_fkey FOREIGN KEY (product_order_id) REFERENCES product_orders(id) ON DELETE CASCADE;

alter table public.product_orders add constraint product_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE RESTRICT;

alter table public.product_payment_transactions add constraint product_payment_transactions_product_payment_id_fkey FOREIGN KEY (product_payment_id) REFERENCES product_payments(id) ON DELETE CASCADE;

alter table public.product_payment_transactions add constraint product_payment_transactions_product_order_id_fkey FOREIGN KEY (product_order_id) REFERENCES product_orders(id) ON DELETE CASCADE;

alter table public.product_payment_transactions add constraint product_payment_transactions_verified_by_user_id_fkey FOREIGN KEY (verified_by_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.product_payments add constraint product_payments_product_order_id_fkey FOREIGN KEY (product_order_id) REFERENCES product_orders(id) ON DELETE CASCADE;

alter table public.product_payments add constraint product_payments_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.products add constraint products_product_category_id_fkey FOREIGN KEY (product_category_id) REFERENCES product_categories(id) ON DELETE RESTRICT;

alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.repair_jobs add constraint repair_jobs_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;

alter table public.repair_jobs add constraint repair_jobs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE RESTRICT;

alter table public.repair_jobs add constraint repair_jobs_mechanic_id_fkey FOREIGN KEY (mechanic_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.repair_jobs add constraint repair_jobs_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

alter table public.services add constraint services_service_category_id_fkey FOREIGN KEY (service_category_id) REFERENCES service_categories(id) ON DELETE RESTRICT;

alter table public.shopping_cart_items add constraint shopping_cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

alter table public.shopping_cart_items add constraint shopping_cart_items_shopping_cart_id_fkey FOREIGN KEY (shopping_cart_id) REFERENCES shopping_carts(id) ON DELETE CASCADE;

alter table public.shopping_carts add constraint shopping_carts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.technician_profile_skills add constraint technician_profile_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES technician_skills(id) ON DELETE CASCADE;

alter table public.technician_profile_skills add constraint technician_profile_skills_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.vehicles add constraint vehicles_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX booking_payments_booking_idx ON public.booking_payments USING btree (booking_id);

CREATE INDEX booking_payments_customer_idx ON public.booking_payments USING btree (customer_id);

CREATE UNIQUE INDEX booking_payments_provider_reference_key ON public.booking_payments USING btree (provider_reference) WHERE (provider_reference IS NOT NULL);

CREATE INDEX delivery_addresses_customer_id_idx ON public.delivery_addresses USING btree (customer_id);

CREATE INDEX garage_capacity_booking_date_idx ON public.garage_capacity USING btree (booking_date);

CREATE INDEX garage_capacity_status_idx ON public.garage_capacity USING btree (status);

CREATE INDEX idx_bookings_customer_id ON public.bookings USING btree (customer_id);

CREATE INDEX idx_bookings_date_time ON public.bookings USING btree (booking_date, booking_time);

CREATE INDEX idx_bookings_service_id ON public.bookings USING btree (service_id);

CREATE INDEX idx_bookings_status ON public.bookings USING btree (status);

CREATE INDEX idx_bookings_vehicle_id ON public.bookings USING btree (vehicle_id);

CREATE INDEX idx_products_category_id ON public.products USING btree (product_category_id);

CREATE INDEX idx_products_name ON public.products USING btree (name);

CREATE INDEX idx_products_status ON public.products USING btree (status);

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);

CREATE INDEX idx_profiles_status ON public.profiles USING btree (status);

CREATE INDEX idx_repair_jobs_booking_id ON public.repair_jobs USING btree (booking_id);

CREATE INDEX idx_repair_jobs_customer_id ON public.repair_jobs USING btree (customer_id);

CREATE INDEX idx_repair_jobs_mechanic_id ON public.repair_jobs USING btree (mechanic_id);

CREATE INDEX idx_repair_jobs_status ON public.repair_jobs USING btree (status);

CREATE INDEX idx_vehicles_customer_id ON public.vehicles USING btree (customer_id);

CREATE INDEX idx_vehicles_license_plate ON public.vehicles USING btree (license_plate);

CREATE INDEX inventory_movements_created_at_idx ON public.inventory_movements USING btree (created_at DESC);

CREATE INDEX inventory_movements_created_by_idx ON public.inventory_movements USING btree (created_by);

CREATE INDEX inventory_movements_product_id_idx ON public.inventory_movements USING btree (product_id);

CREATE UNIQUE INDEX inventory_movements_product_order_return_key ON public.inventory_movements USING btree (reference_id, product_id) WHERE ((reference_type = 'product_order'::text) AND (movement_type = 'return'::text) AND (reference_id IS NOT NULL));

CREATE UNIQUE INDEX inventory_movements_product_order_sale_key ON public.inventory_movements USING btree (reference_id, product_id) WHERE ((reference_type = 'product_order'::text) AND (movement_type = 'sale'::text) AND (reference_id IS NOT NULL));

CREATE INDEX product_order_items_product_id_idx ON public.product_order_items USING btree (product_id);

CREATE INDEX product_order_items_product_order_id_idx ON public.product_order_items USING btree (product_order_id);

CREATE INDEX product_orders_created_at_idx ON public.product_orders USING btree (created_at DESC);

CREATE INDEX product_orders_customer_id_idx ON public.product_orders USING btree (customer_id);

CREATE INDEX product_orders_payment_status_idx ON public.product_orders USING btree (payment_status);

CREATE INDEX product_orders_status_idx ON public.product_orders USING btree (status);

CREATE INDEX product_payment_transactions_order_idx ON public.product_payment_transactions USING btree (product_order_id);

CREATE UNIQUE INDEX product_payment_transactions_provider_reference_key ON public.product_payment_transactions USING btree (provider_reference);

CREATE INDEX product_payments_payment_status_idx ON public.product_payments USING btree (payment_status);

CREATE INDEX product_payments_product_order_id_idx ON public.product_payments USING btree (product_order_id);

CREATE UNIQUE INDEX product_payments_provider_reference_key ON public.product_payments USING btree (provider_reference) WHERE (provider_reference IS NOT NULL);

CREATE UNIQUE INDEX product_payments_slip_reference_key ON public.product_payments USING btree (slip_reference) WHERE (slip_reference IS NOT NULL);

CREATE INDEX product_payments_verification_status_idx ON public.product_payments USING btree (verification_status);

CREATE INDEX products_product_category_id_idx ON public.products USING btree (product_category_id);

CREATE INDEX products_sku_idx ON public.products USING btree (lower(sku)) WHERE ((sku IS NOT NULL) AND (btrim(sku) <> ''::text));

CREATE INDEX products_status_idx ON public.products USING btree (status);

CREATE INDEX repair_jobs_booking_id_idx ON public.repair_jobs USING btree (booking_id);

CREATE INDEX repair_jobs_customer_id_idx ON public.repair_jobs USING btree (customer_id);

CREATE INDEX repair_jobs_mechanic_id_idx ON public.repair_jobs USING btree (mechanic_id);

CREATE INDEX repair_jobs_status_idx ON public.repair_jobs USING btree (status);

CREATE INDEX shopping_cart_items_product_id_idx ON public.shopping_cart_items USING btree (product_id);

CREATE INDEX shopping_cart_items_shopping_cart_id_idx ON public.shopping_cart_items USING btree (shopping_cart_id);

CREATE INDEX shopping_carts_customer_id_idx ON public.shopping_carts USING btree (customer_id);

CREATE UNIQUE INDEX shopping_carts_one_active_per_customer_idx ON public.shopping_carts USING btree (customer_id) WHERE (status = 'active'::text);

CREATE INDEX technician_profile_skills_skill_id_idx ON public.technician_profile_skills USING btree (skill_id);

CREATE INDEX technician_skills_status_idx ON public.technician_skills USING btree (status);

CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  current_stock integer;
  stock_delta integer;
begin
  if new.movement_type in ('stock_in', 'adjustment_in', 'return') then
    stock_delta := new.quantity;
  elsif new.movement_type in ('stock_out', 'adjustment_out', 'sale', 'repair_usage') then
    stock_delta := -new.quantity;
  else
    raise exception 'Unsupported inventory movement type: %', new.movement_type;
  end if;

  select products.stock_quantity
  into current_stock
  from public.products
  where products.id = new.product_id
  for update;

  if current_stock is null then
    raise exception 'Product was not found for inventory movement.';
  end if;

  if current_stock + stock_delta < 0 then
    raise exception 'Inventory movement would make product stock negative.';
  end if;

  update public.products
  set
    stock_quantity = current_stock + stock_delta,
    updated_at = now()
  where products.id = new.product_id;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.apply_product_order_inventory(target_order_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  order_record public.product_orders%rowtype;
  order_item record;
  existing_movement_count integer;
  inserted_movement_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'BCare product order stock deduction requires an authenticated user.';
  end if;

  select *
  into order_record
  from public.product_orders
  where id = target_order_id
  for update;

  if order_record.id is null then
    raise exception 'BCare product order was not found.';
  end if;

  if order_record.customer_id <> auth.uid()
    and not public.current_user_is_admin()
  then
    raise exception 'BCare product order does not belong to the current user.';
  end if;

  if order_record.status = 'cancelled' then
    raise exception 'BCare cancelled product orders cannot deduct stock.';
  end if;

  select count(*)::integer
  into existing_movement_count
  from public.inventory_movements
  where movement_type = 'sale'
    and reference_type = 'product_order'
    and reference_id = target_order_id;

  if existing_movement_count > 0 then
    return existing_movement_count;
  end if;

  if not exists (
    select 1
    from public.product_order_items
    where product_order_id = target_order_id
  ) then
    raise exception 'BCare product order has no items.';
  end if;

  for order_item in
    select
      product_order_items.product_id,
      product_order_items.quantity,
      products.name,
      products.status,
      products.stock_quantity
    from public.product_order_items
    join public.products
      on products.id = product_order_items.product_id
    where product_order_items.product_order_id = target_order_id
    order by product_order_items.created_at
  loop
    if order_item.status <> 'active' then
      raise exception 'BCare product "%" is not active.', order_item.name;
    end if;

    if order_item.quantity > order_item.stock_quantity then
      raise exception 'BCare product "%" does not have enough stock.', order_item.name;
    end if;
  end loop;

  for order_item in
    select
      product_order_items.product_id,
      product_order_items.quantity,
      products.name
    from public.product_order_items
    join public.products
      on products.id = product_order_items.product_id
    where product_order_items.product_order_id = target_order_id
    order by product_order_items.created_at
  loop
    insert into public.inventory_movements (
      product_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      note,
      created_by
    )
    values (
      order_item.product_id,
      'sale',
      order_item.quantity,
      'product_order',
      target_order_id,
      'Product order sale: ' || order_record.order_number,
      auth.uid()
    );

    inserted_movement_count := inserted_movement_count + 1;
  end loop;

  return inserted_movement_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_booking_payment(target_booking_payment_id uuid)
 RETURNS bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  payment_record public.booking_payments;
  booking_record public.bookings;
  now_ts timestamptz := now();
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  ) then
    raise exception 'เฉพาะแอดมินเท่านั้น';
  end if;

  select * into payment_record
  from public.booking_payments
  where id = target_booking_payment_id
  for update;

  if payment_record is null then
    raise exception 'ไม่พบรายการชำระเงินนี้';
  end if;

  if payment_record.payment_status <> 'pending'
    or payment_record.verification_status <> 'submitted' then
    raise exception 'รายการนี้ถูกตรวจสอบไปแล้ว ไม่สามารถอนุมัติซ้ำได้';
  end if;

  begin
    update public.booking_payments
    set
      payment_status = 'paid',
      paid_at = now_ts,
      verified_at = now_ts,
      verified_by = auth.uid(),
      verification_status = 'verified',
      verification_provider = 'admin_manual',
      provider_reference = 'admin-manual:' || target_booking_payment_id::text,
      rejected_reason = null,
      updated_at = now_ts
    where id = target_booking_payment_id;
  exception
    when unique_violation then
      raise exception 'สลิปนี้เคยถูกใช้ยืนยันการชำระเงินสำเร็จไปแล้วในรายการอื่น';
  end;

  update public.bookings
  set payment_status = 'paid', updated_at = now_ts
  where id = payment_record.booking_id
  returning * into booking_record;

  return booking_record;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_own_product_order_with_inventory_return(target_order_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  order_record public.product_orders%rowtype;
  sale_movement_count integer;
  existing_return_count integer;
  inserted_return_count integer := 0;
  order_item record;
begin
  if auth.uid() is null then
    raise exception 'BCare product order cancellation requires an authenticated user.';
  end if;

  select *
  into order_record
  from public.product_orders
  where id = target_order_id
  for update;

  if order_record.id is null then
    raise exception 'BCare product order was not found.';
  end if;

  if order_record.customer_id <> auth.uid() then
    raise exception 'BCare product order does not belong to this account.';
  end if;

  if order_record.status <> 'pending' then
    raise exception 'BCare product order can only be cancelled while it is still pending.';
  end if;

  if order_record.payment_status = 'paid' then
    raise exception 'BCare product order has already been paid and cannot be self-cancelled.';
  end if;

  select count(*)::integer
  into existing_return_count
  from public.inventory_movements
  where movement_type = 'return'
    and reference_type = 'product_order'
    and reference_id = target_order_id;

  if existing_return_count > 0 then
    update public.product_orders
    set status = 'cancelled'
    where id = target_order_id;

    return existing_return_count;
  end if;

  if not exists (
    select 1
    from public.product_order_items
    where product_order_id = target_order_id
  ) then
    raise exception 'BCare product order has no items.';
  end if;

  select count(*)::integer
  into sale_movement_count
  from public.inventory_movements
  where movement_type = 'sale'
    and reference_type = 'product_order'
    and reference_id = target_order_id;

  if sale_movement_count > 0 then
    for order_item in
      select
        product_order_items.product_id,
        sum(product_order_items.quantity)::integer as quantity
      from public.product_order_items
      where product_order_items.product_order_id = target_order_id
      group by product_order_items.product_id
      order by product_order_items.product_id
    loop
      insert into public.inventory_movements (
        product_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        note,
        created_by
      )
      values (
        order_item.product_id,
        'return',
        order_item.quantity,
        'product_order',
        target_order_id,
        'Customer cancelled order: ' || order_record.order_number,
        auth.uid()
      );

      inserted_return_count := inserted_return_count + 1;
    end loop;
  end if;

  update public.product_orders
  set status = 'cancelled'
  where id = target_order_id;

  return inserted_return_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_product_order_with_inventory_return(target_order_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  order_record public.product_orders%rowtype;
  sale_movement_count integer;
  existing_return_count integer;
  inserted_return_count integer := 0;
  order_item record;
begin
  if auth.uid() is null then
    raise exception 'BCare product order cancellation requires an authenticated user.';
  end if;

  if not public.current_user_is_admin() then
    raise exception 'BCare product order cancellation requires admin access.';
  end if;

  select *
  into order_record
  from public.product_orders
  where id = target_order_id
  for update;

  if order_record.id is null then
    raise exception 'BCare product order was not found.';
  end if;

  select count(*)::integer
  into existing_return_count
  from public.inventory_movements
  where movement_type = 'return'
    and reference_type = 'product_order'
    and reference_id = target_order_id;

  if existing_return_count > 0 then
    update public.product_orders
    set status = 'cancelled'
    where id = target_order_id;

    return existing_return_count;
  end if;

  if not exists (
    select 1
    from public.product_order_items
    where product_order_id = target_order_id
  ) then
    raise exception 'BCare product order has no items.';
  end if;

  select count(*)::integer
  into sale_movement_count
  from public.inventory_movements
  where movement_type = 'sale'
    and reference_type = 'product_order'
    and reference_id = target_order_id;

  if sale_movement_count > 0 then
    for order_item in
      select
        product_order_items.product_id,
        sum(product_order_items.quantity)::integer as quantity
      from public.product_order_items
      where product_order_items.product_order_id = target_order_id
      group by product_order_items.product_id
      order by product_order_items.product_id
    loop
      insert into public.inventory_movements (
        product_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        note,
        created_by
      )
      values (
        order_item.product_id,
        'return',
        order_item.quantity,
        'product_order',
        target_order_id,
        'Product order cancellation return: ' || order_record.order_number,
        auth.uid()
      );

      inserted_return_count := inserted_return_count + 1;
    end loop;
  end if;

  update public.product_orders
  set status = 'cancelled'
  where id = target_order_id;

  return inserted_return_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.complete_repair_job_and_request_payment(target_work_order_id uuid, diagnosis_text text, repair_notes_text text)
 RETURNS repair_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  job_record public.repair_jobs;
  booking_record public.bookings;
  service_price numeric(10, 2);
  now_ts timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบ';
  end if;

  select * into job_record
  from public.repair_jobs
  where id = target_work_order_id
  for update;

  if job_record is null then
    raise exception 'ไม่พบใบงานซ่อมนี้';
  end if;

  if job_record.mechanic_id is distinct from auth.uid() then
    raise exception 'ไม่มีสิทธิ์แก้ไขใบงานซ่อมนี้';
  end if;

  if job_record.status in ('completed', 'cancelled') then
    raise exception 'ใบงานซ่อมนี้ปิดแล้ว ไม่สามารถแก้ไขได้';
  end if;

  select * into booking_record
  from public.bookings
  where id = job_record.booking_id
  for update;

  if booking_record is null then
    raise exception 'ไม่พบการจองของใบงานซ่อมนี้';
  end if;

  select base_price into service_price
  from public.services
  where id = booking_record.service_id;

  update public.repair_jobs
  set
    status = 'completed',
    diagnosis = diagnosis_text,
    repair_notes = repair_notes_text,
    completed_at = now_ts,
    started_at = coalesce(job_record.started_at, now_ts),
    updated_at = now_ts
  where id = target_work_order_id
  returning * into job_record;

  update public.bookings
  set
    payment_status = 'awaiting_payment',
    payment_amount = coalesce(service_price, 0),
    updated_at = now_ts
  where id = booking_record.id;

  return job_record;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.confirm_booking_pickup(target_booking_id uuid)
 RETURNS bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  booking_record public.bookings;
  now_ts timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบ';
  end if;

  select * into booking_record
  from public.bookings
  where id = target_booking_id
  for update;

  if booking_record is null then
    raise exception 'ไม่พบการจองนี้';
  end if;

  if booking_record.customer_id is distinct from auth.uid() then
    raise exception 'ไม่มีสิทธิ์เข้าถึงการจองนี้';
  end if;

  if booking_record.payment_status is distinct from 'paid' then
    raise exception 'ต้องชำระเงินให้เรียบร้อยก่อนยืนยันรับรถ';
  end if;

  if booking_record.picked_up_at is not null then
    raise exception 'ยืนยันรับรถไปแล้ว';
  end if;

  update public.bookings
  set picked_up_at = now_ts, status = 'completed', updated_at = now_ts
  where id = target_booking_id
  returning * into booking_record;

  return booking_record;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(public.current_user_role() = 'admin', false)
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.generate_product_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.order_number is null or btrim(new.order_number) = '' then
    new.order_number :=
      'PO-' ||
      to_char(now(), 'YYYYMMDD') ||
      '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_report_summary()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with booking_rows as (
    select status, service_id, customer_id, vehicle_id
    from public.bookings
  ),
  revenue as (
    select
      coalesce(sum(s.base_price), 0) as total,
      count(*) as booking_count
    from public.bookings b
    left join public.services s on s.id = b.service_id
    where b.status in ('confirmed', 'completed')
  )
  select jsonb_build_object(
    'total_booking_count', (select count(*) from booking_rows),
    'total_customer_count', (select count(*) from public.profiles),
    'total_vehicle_count', (select count(*) from public.vehicles),
    'active_customer_count',
      (select count(distinct customer_id) from booking_rows),
    'estimated_revenue', (select total from revenue),
    'revenue_booking_count', (select booking_count from revenue),
    'status_counts', (
      select coalesce(jsonb_object_agg(status, status_count), '{}'::jsonb)
      from (
        select status, count(*) as status_count
        from booking_rows
        group by status
      ) counts
    ),
    'top_services', (
      select coalesce(
        jsonb_agg(jsonb_build_object('id', id, 'count', id_count)
          order by id_count desc, id),
        '[]'::jsonb
      )
      from (
        select service_id as id, count(*) as id_count
        from booking_rows
        where service_id is not null
        group by service_id
        order by id_count desc, service_id
        limit 5
      ) top
    ),
    'top_customers', (
      select coalesce(
        jsonb_agg(jsonb_build_object('id', id, 'count', id_count)
          order by id_count desc, id),
        '[]'::jsonb
      )
      from (
        select customer_id as id, count(*) as id_count
        from booking_rows
        where customer_id is not null
        group by customer_id
        order by id_count desc, customer_id
        limit 5
      ) top
    ),
    'top_vehicles', (
      select coalesce(
        jsonb_agg(jsonb_build_object('id', id, 'count', id_count)
          order by id_count desc, id),
        '[]'::jsonb
      )
      from (
        select vehicle_id as id, count(*) as id_count
        from booking_rows
        where vehicle_id is not null
        group by vehicle_id
        order by id_count desc, vehicle_id
        limit 5
      ) top
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_garage_operating_status(target_date date)
 RETURNS TABLE(booking_date date, weekday integer, is_open boolean, open_time time without time zone, close_time time without time zone, is_special_closed boolean, note text, closed_reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    target_date as booking_date,
    extract(dow from target_date)::integer as weekday,
    (
      coalesce(garage_operating_days.is_open, extract(dow from target_date)::integer not in (0, 6))
      and garage_closed_dates.closed_date is null
    ) as is_open,
    coalesce(garage_operating_days.open_time, time '09:00') as open_time,
    coalesce(garage_operating_days.close_time, time '18:00') as close_time,
    garage_closed_dates.closed_date is not null as is_special_closed,
    garage_operating_days.note,
    garage_closed_dates.reason as closed_reason
  from (select 1) seed
  left join public.garage_operating_days
    on garage_operating_days.weekday = extract(dow from target_date)::integer
  left join public.garage_closed_dates
    on garage_closed_dates.closed_date = target_date
$function$
;

CREATE OR REPLACE FUNCTION public.get_garage_slot_availability(target_date date, target_time time without time zone)
 RETURNS TABLE(booking_date date, booking_time time without time zone, max_bookings integer, active_booking_count integer, available_booking_count integer, is_open boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with capacity as (
    select
      garage_capacity.max_bookings,
      garage_capacity.status
    from public.garage_capacity
    where garage_capacity.booking_date = target_date
      and garage_capacity.booking_time = target_time
    limit 1
  ),
  operating as (
    select *
    from public.get_garage_operating_status(target_date)
    limit 1
  ),
  booking_counts as (
    select count(*)::integer as active_count
    from public.bookings
    where bookings.booking_date::date = target_date
      and left(bookings.booking_time::text, 5) = to_char(target_time, 'HH24:MI')
      and bookings.status in ('pending', 'confirmed')
  ),
  resolved as (
    select
      coalesce(capacity.max_bookings, 1) as resolved_max_bookings,
      coalesce(capacity.status, 'open') as resolved_status,
      coalesce(operating.is_open, true) as operating_is_open,
      coalesce(operating.open_time, time '09:00') as operating_open_time,
      coalesce(operating.close_time, time '18:00') as operating_close_time,
      booking_counts.active_count
    from booking_counts
    left join capacity on true
    left join operating on true
  )
  select
    target_date as booking_date,
    target_time as booking_time,
    resolved.resolved_max_bookings as max_bookings,
    resolved.active_count as active_booking_count,
    greatest(resolved.resolved_max_bookings - resolved.active_count, 0)
      as available_booking_count,
    (
      resolved.operating_is_open
      and target_time >= resolved.operating_open_time
      and target_time <= resolved.operating_close_time
      and resolved.resolved_status = 'open'
      and resolved.resolved_max_bookings > resolved.active_count
    ) as is_open
  from resolved
$function$
;

CREATE OR REPLACE FUNCTION public.get_homepage_stats()
 RETURNS TABLE(trusted_customers_count bigint, completed_repair_jobs_count bigint, technician_team_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    (select count(*) from public.profiles where role = 'customer') as trusted_customers_count,
    (select count(*) from public.repair_jobs where status = 'completed') as completed_repair_jobs_count,
    (select count(*) from public.profiles where role = 'technician') as technician_team_count;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_customer_booking_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or current_user not in ('authenticated', 'anon')
     or public.current_user_is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.payment_status := 'not_required';
    new.payment_amount := null;
    new.picked_up_at := null;
    return new;
  end if;

  if old.status = 'pending'
     and new.status = 'cancelled'
     and (to_jsonb(new) - 'status' - 'updated_at')
       = (to_jsonb(old) - 'status' - 'updated_at') then
    return new;
  end if;

  raise exception 'Customers can only cancel their own pending bookings'
    using errcode = '42501';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_customer_product_order_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_delivery_fee constant numeric := 60; -- must match deliveryFee in checkout-panel.tsx
begin
  if public.is_trusted_product_order_writer() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.payment_status := 'unpaid';
    new.delivery_fee :=
      case when new.delivery_method = 'delivery' then v_delivery_fee else 0 end;
    new.subtotal_amount := 0;
    new.total_amount := new.delivery_fee;
    return new;
  end if;

  if (to_jsonb(new) - 'status' - 'payment_status' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'status' - 'payment_status' - 'updated_at') then
    raise exception 'Customers cannot change order details or prices'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and not (old.status = 'pending' and new.status = 'cancelled') then
    raise exception 'Customers can only cancel a pending order'
      using errcode = '42501';
  end if;

  if new.payment_status is distinct from old.payment_status
     and not (
       new.payment_status = 'pending'
       and old.payment_status in ('unpaid', 'pending')
     ) then
    raise exception 'Customers cannot change the payment status'
      using errcode = '42501';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_garage_slot_available(target_date date, target_time time without time zone)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select is_open
    from public.get_garage_slot_availability(target_date, target_time)
    limit 1
  ), false)
$function$
;

CREATE OR REPLACE FUNCTION public.is_trusted_product_order_writer()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(auth.role(), '') = 'service_role'
    or current_user not in ('authenticated', 'anon')
    or public.current_user_is_admin();
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_booking_over_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  target_date date;
  target_time time;
  capacity_max integer;
  capacity_status text;
  active_booking_count integer;
  shop_is_open boolean;
  shop_open_time time;
  shop_close_time time;
begin
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;

  target_date := new.booking_date::date;
  target_time := new.booking_time::time;

  select operating_status.is_open,
         operating_status.open_time,
         operating_status.close_time
  into shop_is_open, shop_open_time, shop_close_time
  from public.get_garage_operating_status(target_date) operating_status
  limit 1;

  if coalesce(shop_is_open, true) = false then
    raise exception 'BCare shop is closed on selected date.'
      using errcode = 'check_violation';
  end if;

  if target_time < coalesce(shop_open_time, time '09:00')
    or target_time > coalesce(shop_close_time, time '18:00') then
    raise exception 'BCare booking time is outside operating hours.'
      using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('bcare_booking_capacity'),
    hashtext(target_date::text || '|' || to_char(target_time, 'HH24:MI'))
  );

  select garage_capacity.max_bookings, garage_capacity.status
  into capacity_max, capacity_status
  from public.garage_capacity
  where garage_capacity.booking_date = target_date
    and garage_capacity.booking_time = target_time
  limit 1;

  capacity_max := coalesce(capacity_max, 1);
  capacity_status := coalesce(capacity_status, 'open');

  if capacity_status <> 'open' or capacity_max <= 0 then
    raise exception 'BCare booking slot is closed.'
      using errcode = 'check_violation';
  end if;

  select count(*)::integer
  into active_booking_count
  from public.bookings
  where bookings.booking_date::date = target_date
    and left(bookings.booking_time::text, 5) = to_char(target_time, 'HH24:MI')
    and bookings.status in ('pending', 'confirmed')
    and (
      tg_op = 'INSERT'
      or bookings.id is distinct from new.id
    );

  if active_booking_count >= capacity_max then
    raise exception 'BCare booking slot is full.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_invalid_technician_repair_job_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if current_setting('app.bcare_status_sync', true) = 'on' then
    return new;
  end if;

  if public.current_user_is_admin() then
    return new;
  end if;

  -- The vehicle FK's ON DELETE SET NULL action landing here: old.vehicle_id
  -- pointed at a vehicle that has just been deleted, so it no longer exists.
  if new.vehicle_id is null
    and old.vehicle_id is not null
    and not exists (
      select 1 from public.vehicles where vehicles.id = old.vehicle_id
    ) then
    return new;
  end if;

  if old.mechanic_id is distinct from auth.uid() then
    raise exception 'Only the assigned technician can update this repair job.';
  end if;

  if old.status in ('completed', 'cancelled') then
    raise exception 'Closed repair jobs cannot be updated by technicians.';
  end if;

  if new.status not in ('assigned', 'in_progress', 'completed') then
    raise exception 'Technicians can only set assigned, in_progress, or completed.';
  end if;

  if new.booking_id is distinct from old.booking_id
    or new.customer_id is distinct from old.customer_id
    or new.vehicle_id is distinct from old.vehicle_id
    or new.mechanic_id is distinct from old.mechanic_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Technicians cannot change repair job ownership fields.';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_repair_job_booking_status_mismatch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  linked_booking_status text;
begin
  select bookings.status
  into linked_booking_status
  from public.bookings
  where bookings.id = new.booking_id;

  if linked_booking_status is null then
    raise exception 'Repair job must be linked to an existing booking.';
  end if;

  if linked_booking_status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'Cannot keep an open repair job for a cancelled booking.';
  end if;

  if linked_booking_status = 'completed' and new.status <> 'completed' then
    raise exception 'Cannot keep an open repair job for a completed booking.';
  end if;

  if linked_booking_status = 'pending'
    and new.status in ('assigned', 'in_progress', 'completed') then
    raise exception 'Booking must be confirmed before repair work can progress.';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.protect_profile_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  -- Service-role key (server API routes) or SQL Editor: allow anything.
  if coalesce(auth.role(), '') = 'service_role'
     or current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'customer';
    return new;
  end if;

  if new.role is distinct from old.role
     and not public.current_user_is_admin() then
    raise exception 'Only an admin can change a profile role'
      using errcode = '42501';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_product_order_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.product_orders o
  set
    subtotal_amount = coalesce(items.subtotal, 0),
    total_amount = coalesce(items.subtotal, 0) + o.delivery_fee
  from (
    select sum(total_price) as subtotal
    from public.product_order_items
    where product_order_id = new.product_order_id
  ) items
  where o.id = new.product_order_id;

  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_booking_payment(target_booking_payment_id uuid, reason text)
 RETURNS bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  payment_record public.booking_payments;
  booking_record public.bookings;
  now_ts timestamptz := now();
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  ) then
    raise exception 'เฉพาะแอดมินเท่านั้น';
  end if;

  if reason is null or length(trim(reason)) = 0 then
    raise exception 'กรุณาระบุเหตุผลที่ปฏิเสธ';
  end if;

  select * into payment_record
  from public.booking_payments
  where id = target_booking_payment_id
  for update;

  if payment_record is null then
    raise exception 'ไม่พบรายการชำระเงินนี้';
  end if;

  if payment_record.payment_status <> 'pending'
    or payment_record.verification_status <> 'submitted' then
    raise exception 'รายการนี้ถูกตรวจสอบไปแล้ว ไม่สามารถปฏิเสธซ้ำได้';
  end if;

  update public.booking_payments
  set
    payment_status = 'rejected',
    rejected_reason = reason,
    verified_at = now_ts,
    verified_by = auth.uid(),
    verification_status = 'rejected',
    paid_at = null,
    updated_at = now_ts
  where id = target_booking_payment_id;

  update public.bookings
  set payment_status = 'rejected', updated_at = now_ts
  where id = payment_record.booking_id
  returning * into booking_record;

  return booking_record;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reopen_repair_job(target_work_order_id uuid)
 RETURNS repair_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  job_record public.repair_jobs;
  booking_record public.bookings;
  now_ts timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบ';
  end if;

  select * into job_record
  from public.repair_jobs
  where id = target_work_order_id
  for update;

  if job_record is null then
    raise exception 'ไม่พบใบงานซ่อมนี้';
  end if;

  if job_record.mechanic_id is distinct from auth.uid() then
    raise exception 'ไม่มีสิทธิ์แก้ไขใบงานซ่อมนี้';
  end if;

  if job_record.status <> 'completed' then
    raise exception 'เปิดใบงานซ่อมนี้อีกครั้งไม่ได้ เพราะยังไม่ได้ถูกปิดงาน';
  end if;

  select * into booking_record
  from public.bookings
  where id = job_record.booking_id
  for update;

  if booking_record is null then
    raise exception 'ไม่พบการจองของใบงานซ่อมนี้';
  end if;

  if booking_record.payment_status <> 'awaiting_payment' then
    raise exception 'ลูกค้าเริ่มดำเนินการชำระเงินแล้ว ไม่สามารถเปิดงานซ่อมนี้อีกครั้งได้ กรุณาติดต่อแอดมิน';
  end if;

  -- Lift the "closed job can't be touched by a technician" trigger guard
  -- for the repair_jobs update below - every real check has already run.
  perform set_config('app.bcare_status_sync', 'on', true);

  -- Move the booking off 'completed' first, so the repair_jobs update
  -- right after this doesn't get rejected by
  -- prevent_repair_job_booking_status_mismatch for looking "open" while
  -- its booking still reads as completed.
  update public.bookings
  set
    status = 'confirmed',
    payment_status = 'not_required',
    payment_amount = null,
    updated_at = now_ts
  where id = booking_record.id;

  update public.repair_jobs
  set
    status = 'in_progress',
    completed_at = null,
    updated_at = now_ts
  where id = target_work_order_id
  returning * into job_record;

  return job_record;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_garage_capacity_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_garage_operating_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_homepage_appearance_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_homepage_footer_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_homepage_slides_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_product_inventory_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_product_order_item_price()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_unit_price numeric;
  v_order_status text;
  v_payment_status text;
begin
  if public.is_trusted_product_order_writer() then
    return new;
  end if;

  select status, payment_status
  into v_order_status, v_payment_status
  from public.product_orders
  where id = new.product_order_id;

  if v_order_status is distinct from 'pending'
     or v_payment_status is distinct from 'unpaid' then
    raise exception 'Items can only be added to an unpaid pending order'
      using errcode = '42501';
  end if;

  if new.quantity is null or new.quantity <= 0 then
    raise exception 'Quantity must be greater than zero'
      using errcode = '22023';
  end if;

  select unit_price into v_unit_price
  from public.products
  where id = new.product_id;

  if v_unit_price is null then
    raise exception 'Product not found' using errcode = '23503';
  end if;

  new.unit_price := v_unit_price;
  new.total_price := v_unit_price * new.quantity;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_product_sales_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_booking_payment_slip(target_booking_id uuid, slip_url text, slip_payment_method text)
 RETURNS booking_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  booking_record public.bookings;
  payment_record public.booking_payments;
  now_ts timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบ';
  end if;

  select * into booking_record
  from public.bookings
  where id = target_booking_id
  for update;

  if booking_record is null then
    raise exception 'ไม่พบการจองนี้';
  end if;

  if booking_record.customer_id is distinct from auth.uid() then
    raise exception 'ไม่มีสิทธิ์เข้าถึงการจองนี้';
  end if;

  if booking_record.payment_status not in ('awaiting_payment', 'rejected') then
    raise exception 'การจองนี้ไม่ได้อยู่ในสถานะที่รอชำระเงิน';
  end if;

  if slip_url is null or length(trim(slip_url)) = 0 then
    raise exception 'ไม่พบไฟล์สลิป';
  end if;

  if slip_payment_method not in ('bank_transfer', 'promptpay') then
    slip_payment_method := 'bank_transfer';
  end if;

  select * into payment_record
  from public.booking_payments
  where booking_id = target_booking_id
    and payment_status in ('pending', 'rejected')
  order by created_at desc
  limit 1;

  if payment_record is null then
    insert into public.booking_payments (
      booking_id,
      customer_id,
      amount,
      payment_method,
      slip_image_url,
      payment_status,
      submitted_at,
      verification_status,
      verification_provider,
      provider_reference,
      verification_response,
      slip_amount
    ) values (
      target_booking_id,
      auth.uid(),
      coalesce(booking_record.payment_amount, 0),
      slip_payment_method,
      slip_url,
      'pending',
      now_ts,
      'submitted',
      null,
      null,
      null,
      null
    )
    returning * into payment_record;
  else
    update public.booking_payments
    set
      payment_method = slip_payment_method,
      slip_image_url = slip_url,
      payment_status = 'pending',
      rejected_reason = null,
      submitted_at = now_ts,
      verified_at = null,
      verified_by = null,
      verification_status = 'submitted',
      verification_provider = null,
      provider_reference = null,
      verification_response = null,
      slip_amount = null,
      updated_at = now_ts
    where id = payment_record.id
    returning * into payment_record;
  end if;

  update public.bookings
  set payment_status = 'pending_review', updated_at = now_ts
  where id = target_booking_id;

  return payment_record;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_booking_status_from_repair_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if current_setting('app.bcare_status_sync', true) = 'on' then
    return new;
  end if;

  perform set_config('app.bcare_status_sync', 'on', true);

  if new.status = 'completed' then
    update public.bookings
    set status = 'completed',
        updated_at = now()
    where id = new.booking_id
      and status <> 'cancelled';
  elsif new.status in ('pending', 'assigned', 'in_progress') then
    update public.bookings
    set status = 'confirmed',
        updated_at = now()
    where id = new.booking_id
      and status = 'pending';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_repair_job_status_from_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if current_setting('app.bcare_status_sync', true) = 'on' then
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  perform set_config('app.bcare_status_sync', 'on', true);

  if new.status = 'cancelled' then
    update public.repair_jobs
    set status = 'cancelled',
        completed_at = null,
        updated_at = now()
    where booking_id = new.id
      and status not in ('completed', 'cancelled');
  elsif new.status = 'completed' then
    update public.repair_jobs
    set status = 'completed',
        started_at = coalesce(started_at, now()),
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where booking_id = new.id
      and status <> 'cancelled';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_payment_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE TRIGGER apply_inventory_movement_on_insert BEFORE INSERT ON inventory_movements FOR EACH ROW EXECUTE FUNCTION apply_inventory_movement();

CREATE TRIGGER generate_product_order_number_on_insert BEFORE INSERT ON product_orders FOR EACH ROW EXECUTE FUNCTION generate_product_order_number();

CREATE TRIGGER guard_customer_booking_write BEFORE INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION guard_customer_booking_write();

CREATE TRIGGER guard_customer_product_order_write BEFORE INSERT OR UPDATE ON product_orders FOR EACH ROW EXECUTE FUNCTION guard_customer_product_order_write();

CREATE TRIGGER homepage_appearance_settings_set_updated_at BEFORE UPDATE ON homepage_appearance_settings FOR EACH ROW EXECUTE FUNCTION set_homepage_appearance_settings_updated_at();

CREATE TRIGGER homepage_footer_settings_set_updated_at BEFORE UPDATE ON homepage_footer_settings FOR EACH ROW EXECUTE FUNCTION set_homepage_footer_settings_updated_at();

CREATE TRIGGER homepage_slides_set_updated_at BEFORE UPDATE ON homepage_slides FOR EACH ROW EXECUTE FUNCTION set_homepage_slides_updated_at();

CREATE TRIGGER payment_settings_set_updated_at BEFORE UPDATE ON payment_settings FOR EACH ROW EXECUTE FUNCTION touch_payment_settings_updated_at();

CREATE TRIGGER prevent_booking_over_capacity BEFORE INSERT OR UPDATE OF booking_date, booking_time, status ON bookings FOR EACH ROW EXECUTE FUNCTION prevent_booking_over_capacity();

CREATE TRIGGER prevent_invalid_technician_repair_job_update BEFORE UPDATE ON repair_jobs FOR EACH ROW EXECUTE FUNCTION prevent_invalid_technician_repair_job_update();

CREATE TRIGGER prevent_repair_job_booking_status_mismatch BEFORE INSERT OR UPDATE OF booking_id, status ON repair_jobs FOR EACH ROW EXECUTE FUNCTION prevent_repair_job_booking_status_mismatch();

CREATE TRIGGER protect_profile_role BEFORE INSERT OR UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION protect_profile_role();

CREATE TRIGGER recalculate_product_order_totals AFTER INSERT ON product_order_items FOR EACH ROW EXECUTE FUNCTION recalculate_product_order_totals();

CREATE TRIGGER set_delivery_addresses_updated_at BEFORE UPDATE ON delivery_addresses FOR EACH ROW EXECUTE FUNCTION set_product_sales_updated_at();

CREATE TRIGGER set_garage_capacity_updated_at BEFORE UPDATE ON garage_capacity FOR EACH ROW EXECUTE FUNCTION set_garage_capacity_updated_at();

CREATE TRIGGER set_garage_closed_dates_updated_at BEFORE UPDATE ON garage_closed_dates FOR EACH ROW EXECUTE FUNCTION set_garage_operating_updated_at();

CREATE TRIGGER set_garage_operating_days_updated_at BEFORE UPDATE ON garage_operating_days FOR EACH ROW EXECUTE FUNCTION set_garage_operating_updated_at();

CREATE TRIGGER set_product_categories_updated_at BEFORE UPDATE ON product_categories FOR EACH ROW EXECUTE FUNCTION set_product_inventory_updated_at();

CREATE TRIGGER set_product_order_item_price BEFORE INSERT OR UPDATE ON product_order_items FOR EACH ROW EXECUTE FUNCTION set_product_order_item_price();

CREATE TRIGGER set_product_orders_updated_at BEFORE UPDATE ON product_orders FOR EACH ROW EXECUTE FUNCTION set_product_sales_updated_at();

CREATE TRIGGER set_product_payments_updated_at BEFORE UPDATE ON product_payments FOR EACH ROW EXECUTE FUNCTION set_product_sales_updated_at();

CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_product_inventory_updated_at();

CREATE TRIGGER set_shopping_cart_items_updated_at BEFORE UPDATE ON shopping_cart_items FOR EACH ROW EXECUTE FUNCTION set_product_sales_updated_at();

CREATE TRIGGER set_shopping_carts_updated_at BEFORE UPDATE ON shopping_carts FOR EACH ROW EXECUTE FUNCTION set_product_sales_updated_at();

CREATE TRIGGER sync_booking_status_from_repair_job AFTER INSERT OR UPDATE OF status ON repair_jobs FOR EACH ROW EXECUTE FUNCTION sync_booking_status_from_repair_job();

CREATE TRIGGER sync_repair_job_status_from_booking AFTER UPDATE OF status ON bookings FOR EACH ROW EXECUTE FUNCTION sync_repair_job_status_from_booking();

alter table public.booking_payments enable row level security;

alter table public.bookings enable row level security;

alter table public.delivery_addresses enable row level security;

alter table public.garage_capacity enable row level security;

alter table public.garage_closed_dates enable row level security;

alter table public.garage_operating_days enable row level security;

alter table public.homepage_appearance_settings enable row level security;

alter table public.homepage_footer_settings enable row level security;

alter table public.homepage_slides enable row level security;

alter table public.inventory_movements enable row level security;

alter table public.payment_settings enable row level security;

alter table public.product_categories enable row level security;

alter table public.product_order_items enable row level security;

alter table public.product_orders enable row level security;

alter table public.product_payment_transactions enable row level security;

alter table public.product_payments enable row level security;

alter table public.products enable row level security;

alter table public.profiles enable row level security;

alter table public.repair_jobs enable row level security;

alter table public.service_categories enable row level security;

alter table public.services enable row level security;

alter table public.shopping_cart_items enable row level security;

alter table public.shopping_carts enable row level security;

alter table public.technician_profile_skills enable row level security;

alter table public.technician_skills enable row level security;

alter table public.vehicles enable row level security;

create policy "Admins can read all booking payments" on public.booking_payments as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

create policy "Customers can read own booking payments" on public.booking_payments as permissive for select to authenticated
  using ((customer_id = auth.uid()));

create policy "Admins can read all bookings" on public.bookings as permissive for select to authenticated
  using (current_user_is_admin());

create policy "Admins can update all bookings" on public.bookings as permissive for update to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Assigned mechanics can read linked bookings" on public.bookings as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM repair_jobs
  WHERE ((repair_jobs.booking_id = bookings.id) AND (repair_jobs.mechanic_id = auth.uid())))));

create policy "Users can insert own bookings" on public.bookings as permissive for insert to authenticated
  with check ((customer_id = auth.uid()));

create policy "Users can read own bookings" on public.bookings as permissive for select to authenticated
  using ((customer_id = auth.uid()));

create policy "Users can update own pending bookings" on public.bookings as permissive for update to authenticated
  using (((customer_id = auth.uid()) AND (status = 'pending'::text)))
  with check ((customer_id = auth.uid()));

create policy "Admins can manage delivery addresses" on public.delivery_addresses as permissive for all to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Users can insert own delivery addresses" on public.delivery_addresses as permissive for insert to authenticated
  with check ((customer_id = auth.uid()));

create policy "Users can read own delivery addresses" on public.delivery_addresses as permissive for select to authenticated
  using ((customer_id = auth.uid()));

create policy "Users can update own delivery addresses" on public.delivery_addresses as permissive for update to authenticated
  using ((customer_id = auth.uid()))
  with check ((customer_id = auth.uid()));

create policy "Admins can manage garage capacity" on public.garage_capacity as permissive for all to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Authenticated users can read open garage capacity" on public.garage_capacity as permissive for select to authenticated
  using (((status = 'open'::text) OR current_user_is_admin()));

create policy "Admins can manage garage closed dates" on public.garage_closed_dates as permissive for all to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Anyone can read garage closed dates" on public.garage_closed_dates as permissive for select to anon, authenticated
  using (true);

create policy "Admins can manage garage operating days" on public.garage_operating_days as permissive for all to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Anyone can read garage operating days" on public.garage_operating_days as permissive for select to anon, authenticated
  using (true);

create policy "Admins can insert homepage appearance settings" on public.homepage_appearance_settings as permissive for insert to authenticated
  with check (current_user_is_admin());

create policy "Admins can update homepage appearance settings" on public.homepage_appearance_settings as permissive for update to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Anyone can read homepage appearance settings" on public.homepage_appearance_settings as permissive for select to anon, authenticated
  using (true);

create policy "Admins can delete homepage footer settings" on public.homepage_footer_settings as permissive for delete to authenticated
  using (current_user_is_admin());

create policy "Admins can insert homepage footer settings" on public.homepage_footer_settings as permissive for insert to authenticated
  with check (current_user_is_admin());

create policy "Admins can update homepage footer settings" on public.homepage_footer_settings as permissive for update to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Anyone can read active homepage footer settings" on public.homepage_footer_settings as permissive for select to anon, authenticated
  using (((status = 'active'::text) OR current_user_is_admin()));

create policy "Admins can delete homepage slides" on public.homepage_slides as permissive for delete to authenticated
  using (current_user_is_admin());

create policy "Admins can insert homepage slides" on public.homepage_slides as permissive for insert to authenticated
  with check (current_user_is_admin());

create policy "Admins can update homepage slides" on public.homepage_slides as permissive for update to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Anyone can read active homepage slides" on public.homepage_slides as permissive for select to anon, authenticated
  using (((status = 'active'::text) OR current_user_is_admin()));

create policy "Admins can create inventory movements" on public.inventory_movements as permissive for insert to authenticated
  with check (current_user_is_admin());

create policy "Admins can read inventory movements" on public.inventory_movements as permissive for select to authenticated
  using (current_user_is_admin());

create policy "Admins can insert payment settings" on public.payment_settings as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

create policy "Admins can read all payment settings" on public.payment_settings as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

create policy "Admins can update payment settings" on public.payment_settings as permissive for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

create policy "Anyone can read active payment settings" on public.payment_settings as permissive for select to anon, authenticated
  using (((setting_key = 'default'::text) AND (status = 'active'::text)));

create policy "Admins can manage product categories" on public.product_categories as permissive for all to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Anyone can read active product categories" on public.product_categories as permissive for select to anon, authenticated
  using (((status = 'active'::text) OR current_user_is_admin()));

create policy "Authenticated users can read active product categories" on public.product_categories as permissive for select to authenticated
  using (((status = 'active'::text) OR current_user_is_admin()));

create policy "Admins can manage product order items" on public.product_order_items as permissive for all to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Users can insert own pending product order items" on public.product_order_items as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM product_orders
  WHERE ((product_orders.id = product_order_items.product_order_id) AND (product_orders.customer_id = auth.uid()) AND (product_orders.status = 'pending'::text)))));

create policy "Users can read own product order items" on public.product_order_items as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM product_orders
  WHERE ((product_orders.id = product_order_items.product_order_id) AND (product_orders.customer_id = auth.uid())))));

create policy "Admins can manage product orders" on public.product_orders as permissive for all to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Users can insert own product orders" on public.product_orders as permissive for insert to authenticated
  with check ((customer_id = auth.uid()));

create policy "Users can read own product orders" on public.product_orders as permissive for select to authenticated
  using ((customer_id = auth.uid()));

create policy "Users can update own pending product orders" on public.product_orders as permissive for update to authenticated
  using (((customer_id = auth.uid()) AND (status = 'pending'::text)))
  with check (((customer_id = auth.uid()) AND (status = ANY (ARRAY['pending'::text, 'cancelled'::text]))));

create policy "Admins can read all payment transactions" on public.product_payment_transactions as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

create policy "Customers can read own order payment transactions" on public.product_payment_transactions as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM product_orders
  WHERE ((product_orders.id = product_payment_transactions.product_order_id) AND (product_orders.customer_id = auth.uid())))));

create policy "Admins can manage product payments" on public.product_payments as permissive for all to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Users can insert own product payments" on public.product_payments as permissive for insert to authenticated
  with check (((payment_status = ANY (ARRAY['pending'::text, 'failed'::text])) AND (paid_at IS NULL) AND (verified_at IS NULL) AND (EXISTS ( SELECT 1
   FROM product_orders
  WHERE ((product_orders.id = product_payments.product_order_id) AND (product_orders.customer_id = auth.uid()))))));

create policy "Users can read own product payments" on public.product_payments as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM product_orders
  WHERE ((product_orders.id = product_payments.product_order_id) AND (product_orders.customer_id = auth.uid())))));

create policy "Users can update own pending product payments" on public.product_payments as permissive for update to authenticated
  using (((payment_status = ANY (ARRAY['pending'::text, 'failed'::text])) AND (EXISTS ( SELECT 1
   FROM product_orders
  WHERE ((product_orders.id = product_payments.product_order_id) AND (product_orders.customer_id = auth.uid()))))))
  with check (((payment_status = ANY (ARRAY['pending'::text, 'failed'::text])) AND (paid_at IS NULL) AND (verified_at IS NULL) AND (EXISTS ( SELECT 1
   FROM product_orders
  WHERE ((product_orders.id = product_payments.product_order_id) AND (product_orders.customer_id = auth.uid()))))));

create policy "Admins can manage products" on public.products as permissive for all to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Anyone can read active products" on public.products as permissive for select to anon, authenticated
  using (((status = 'active'::text) OR current_user_is_admin()));

create policy "Authenticated users can read active products" on public.products as permissive for select to authenticated
  using (((status = 'active'::text) OR current_user_is_admin()));

create policy "Admins can read all profiles" on public.profiles as permissive for select to authenticated
  using (current_user_is_admin());

create policy "Assigned mechanics can read linked customers" on public.profiles as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM repair_jobs
  WHERE ((repair_jobs.customer_id = profiles.id) AND (repair_jobs.mechanic_id = auth.uid())))));

create policy "Customers can read assigned mechanic profiles" on public.profiles as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM repair_jobs
  WHERE ((repair_jobs.mechanic_id = profiles.id) AND (repair_jobs.customer_id = auth.uid())))));

create policy "Users can insert own profile" on public.profiles as permissive for insert to authenticated
  with check ((id = auth.uid()));

create policy "Users can read own profile" on public.profiles as permissive for select to authenticated
  using ((id = auth.uid()));

create policy "Users can update own profile" on public.profiles as permissive for update to authenticated
  using ((id = auth.uid()))
  with check ((id = auth.uid()));

create policy repair_jobs_admin_insert on public.repair_jobs as permissive for insert to authenticated
  with check (current_user_is_admin());

create policy repair_jobs_admin_update on public.repair_jobs as permissive for update to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy repair_jobs_assigned_mechanic_update on public.repair_jobs as permissive for update to authenticated
  using (((mechanic_id = auth.uid()) AND (status = ANY (ARRAY['assigned'::text, 'in_progress'::text]))))
  with check (((mechanic_id = auth.uid()) AND (status = ANY (ARRAY['assigned'::text, 'in_progress'::text, 'completed'::text]))));

create policy repair_jobs_customer_select_own on public.repair_jobs as permissive for select to authenticated
  using ((customer_id = auth.uid()));

create policy repair_jobs_select_allowed on public.repair_jobs as permissive for select to authenticated
  using ((current_user_is_admin() OR (customer_id = auth.uid()) OR (mechanic_id = auth.uid())));

create policy "Admins can create service categories" on public.service_categories as permissive for insert to authenticated
  with check (current_user_is_admin());

create policy "Admins can read all service categories" on public.service_categories as permissive for select to authenticated
  using (current_user_is_admin());

create policy "Admins can update service categories" on public.service_categories as permissive for update to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Anyone can read active service categories" on public.service_categories as permissive for select to anon, authenticated
  using (((status = 'active'::text) OR current_user_is_admin()));

create policy "Admins can read all services" on public.services as permissive for select to authenticated
  using (current_user_is_admin());

create policy "Admins can update services" on public.services as permissive for update to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Anyone can read active services" on public.services as permissive for select to anon, authenticated
  using (((status = 'active'::text) OR current_user_is_admin()));

create policy "Admins can read shopping cart items" on public.shopping_cart_items as permissive for select to authenticated
  using (current_user_is_admin());

create policy "Users can delete own shopping cart items" on public.shopping_cart_items as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1
   FROM shopping_carts
  WHERE ((shopping_carts.id = shopping_cart_items.shopping_cart_id) AND (shopping_carts.customer_id = auth.uid()) AND (shopping_carts.status = 'active'::text)))));

create policy "Users can insert own shopping cart items" on public.shopping_cart_items as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM shopping_carts
  WHERE ((shopping_carts.id = shopping_cart_items.shopping_cart_id) AND (shopping_carts.customer_id = auth.uid()) AND (shopping_carts.status = 'active'::text)))));

create policy "Users can read own shopping cart items" on public.shopping_cart_items as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM shopping_carts
  WHERE ((shopping_carts.id = shopping_cart_items.shopping_cart_id) AND (shopping_carts.customer_id = auth.uid())))));

create policy "Users can update own shopping cart items" on public.shopping_cart_items as permissive for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM shopping_carts
  WHERE ((shopping_carts.id = shopping_cart_items.shopping_cart_id) AND (shopping_carts.customer_id = auth.uid()) AND (shopping_carts.status = 'active'::text)))))
  with check ((EXISTS ( SELECT 1
   FROM shopping_carts
  WHERE ((shopping_carts.id = shopping_cart_items.shopping_cart_id) AND (shopping_carts.customer_id = auth.uid()) AND (shopping_carts.status = 'active'::text)))));

create policy "Admins can read shopping carts" on public.shopping_carts as permissive for select to authenticated
  using (current_user_is_admin());

create policy "Users can insert own shopping carts" on public.shopping_carts as permissive for insert to authenticated
  with check ((customer_id = auth.uid()));

create policy "Users can read own shopping carts" on public.shopping_carts as permissive for select to authenticated
  using ((customer_id = auth.uid()));

create policy "Users can update own shopping carts" on public.shopping_carts as permissive for update to authenticated
  using ((customer_id = auth.uid()))
  with check ((customer_id = auth.uid()));

create policy "Admins and own technician can insert profile skills" on public.technician_profile_skills as permissive for insert to authenticated
  with check ((current_user_is_admin() OR ((technician_id = auth.uid()) AND (current_user_role() = 'technician'::text))));

create policy "Admins and own technician can read profile skills" on public.technician_profile_skills as permissive for select to authenticated
  using ((current_user_is_admin() OR (technician_id = auth.uid())));

create policy "Admins and own technician can delete profile skills" on public.technician_profile_skills as permissive for delete to authenticated
  using ((current_user_is_admin() OR ((technician_id = auth.uid()) AND (current_user_role() = 'technician'::text))));

create policy "Admins and own technician can update profile skills" on public.technician_profile_skills as permissive for update to authenticated
  using ((current_user_is_admin() OR ((technician_id = auth.uid()) AND (current_user_role() = 'technician'::text))))
  with check ((current_user_is_admin() OR ((technician_id = auth.uid()) AND (current_user_role() = 'technician'::text))));

create policy "Admins can manage technician skills" on public.technician_skills as permissive for all to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

create policy "Anyone authenticated can read active technician skills" on public.technician_skills as permissive for select to authenticated
  using (((status = 'active'::text) OR current_user_is_admin()));

create policy "Admins can read all vehicles" on public.vehicles as permissive for select to authenticated
  using (current_user_is_admin());

create policy "Assigned mechanics can read linked vehicles" on public.vehicles as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM repair_jobs
  WHERE ((repair_jobs.vehicle_id = vehicles.id) AND (repair_jobs.mechanic_id = auth.uid())))));

create policy "Users can delete own unused vehicles" on public.vehicles as permissive for delete to authenticated
  using (((customer_id = auth.uid()) AND (NOT (EXISTS ( SELECT 1
   FROM bookings
  WHERE ((bookings.vehicle_id = vehicles.id) AND (bookings.status <> ALL (ARRAY['cancelled'::text, 'completed'::text])) AND (NOT (EXISTS ( SELECT 1
           FROM repair_jobs
          WHERE ((repair_jobs.booking_id = bookings.id) AND (repair_jobs.status = 'completed'::text)))))))))));

create policy "Users can insert own vehicles" on public.vehicles as permissive for insert to authenticated
  with check ((customer_id = auth.uid()));

create policy "Users can read own vehicles" on public.vehicles as permissive for select to authenticated
  using ((customer_id = auth.uid()));

create policy "Users can update own vehicles" on public.vehicles as permissive for update to authenticated
  using ((customer_id = auth.uid()))
  with check ((customer_id = auth.uid()));

create policy "Admins can delete homepage slide images" on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'homepage-slides'::text) AND current_user_is_admin()));

create policy "Admins can delete payment assets" on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'payment-assets'::text) AND current_user_is_admin()));

create policy "Admins can delete product images" on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'product-images'::text) AND current_user_is_admin()));

create policy "Admins can delete service images" on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'product-images'::text) AND (name ~~ 'services/%'::text) AND current_user_is_admin()));

create policy "Admins can manage payment slips" on storage.objects as permissive for all to authenticated
  using (((bucket_id = 'payment-slips'::text) AND current_user_is_admin()))
  with check (((bucket_id = 'payment-slips'::text) AND current_user_is_admin()));

create policy "Admins can read all booking payment slips" on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'payment-slips'::text) AND ((storage.foldername(name))[2] = 'bookings'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));

create policy "Admins can read payment slips" on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'payment-slips'::text) AND current_user_is_admin()));

create policy "Admins can update homepage slide images" on storage.objects as permissive for update to authenticated
  using (((bucket_id = 'homepage-slides'::text) AND current_user_is_admin()))
  with check (((bucket_id = 'homepage-slides'::text) AND current_user_is_admin()));

create policy "Admins can update payment assets" on storage.objects as permissive for update to authenticated
  using (((bucket_id = 'payment-assets'::text) AND current_user_is_admin()))
  with check (((bucket_id = 'payment-assets'::text) AND current_user_is_admin()));

create policy "Admins can update product images" on storage.objects as permissive for update to authenticated
  using (((bucket_id = 'product-images'::text) AND current_user_is_admin()))
  with check (((bucket_id = 'product-images'::text) AND current_user_is_admin()));

create policy "Admins can update service images" on storage.objects as permissive for update to authenticated
  using (((bucket_id = 'product-images'::text) AND (name ~~ 'services/%'::text) AND current_user_is_admin()))
  with check (((bucket_id = 'product-images'::text) AND (name ~~ 'services/%'::text) AND current_user_is_admin()));

create policy "Admins can upload homepage slide images" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'homepage-slides'::text) AND current_user_is_admin()));

create policy "Admins can upload payment assets" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'payment-assets'::text) AND current_user_is_admin()));

create policy "Admins can upload product images" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'product-images'::text) AND current_user_is_admin()));

create policy "Admins can upload service images" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'product-images'::text) AND (name ~~ 'services/%'::text) AND current_user_is_admin()));

create policy "Anyone can read homepage slide images" on storage.objects as permissive for select to anon, authenticated
  using ((bucket_id = 'homepage-slides'::text));

create policy "Anyone can read payment assets" on storage.objects as permissive for select to anon, authenticated
  using ((bucket_id = 'payment-assets'::text));

create policy "Anyone can read product images" on storage.objects as permissive for select to anon, authenticated
  using ((bucket_id = 'product-images'::text));

create policy "Anyone can read profile images" on storage.objects as permissive for select to anon, authenticated
  using ((bucket_id = 'profile-images'::text));

create policy "Anyone can read service images" on storage.objects as permissive for select to anon, authenticated
  using (((bucket_id = 'product-images'::text) AND (name ~~ 'services/%'::text)));

create policy "Anyone can read vehicle images" on storage.objects as permissive for select to anon, authenticated
  using ((bucket_id = 'vehicle-images'::text));

create policy "Customers can read own booking payment slips" on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'payment-slips'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND ((storage.foldername(name))[2] = 'bookings'::text)));

create policy "Customers can upload own booking payment slips" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'payment-slips'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND ((storage.foldername(name))[2] = 'bookings'::text)));

create policy "Users can delete own profile images" on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'profile-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "Users can delete own vehicle images" on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'vehicle-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "Users can read own payment slips" on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'payment-slips'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "Users can update own profile images" on storage.objects as permissive for update to authenticated
  using (((bucket_id = 'profile-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)))
  with check (((bucket_id = 'profile-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "Users can update own vehicle images" on storage.objects as permissive for update to authenticated
  using (((bucket_id = 'vehicle-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)))
  with check (((bucket_id = 'vehicle-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "Users can upload own payment slips" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'payment-slips'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "Users can upload own profile images" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'profile-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "Users can upload own vehicle images" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'vehicle-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

insert into storage.buckets (id, name, public) values ('homepage-slides', 'homepage-slides', 't') on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('payment-assets', 'payment-assets', 't') on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('payment-slips', 'payment-slips', 'f') on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', 't') on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('profile-images', 'profile-images', 't') on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('service-images', 'service-images', 't') on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('vehicle-images', 'vehicle-images', 't') on conflict (id) do nothing;