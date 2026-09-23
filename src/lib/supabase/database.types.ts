export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type GenericTable = {
  Row: Record<string, Json>;
  Insert: Record<string, Json>;
  Update: Record<string, Json>;
  Relationships: [];
};

type ServiceStatus = "active" | "inactive";
type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
type BookingPaymentStatus =
  | "not_required"
  | "awaiting_payment"
  | "pending_review"
  | "paid"
  | "rejected";
type BookingPaymentVerificationStatus =
  | "submitted"
  | "verified"
  | "rejected"
  | "failed";
type BookingPaymentVerificationProvider = "slipok" | "admin_manual";
type ProfileRole = "customer" | "admin" | "technician";
type CapacityStatus = "open" | "closed";
type InventoryMovementType =
  | "stock_in"
  | "stock_out"
  | "adjustment_in"
  | "adjustment_out"
  | "sale"
  | "repair_usage"
  | "return";
type ProductOrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "completed"
  | "cancelled";
type ProductDeliveryMethod = "pickup" | "delivery";
type ProductOrderPaymentStatus =
  | "unpaid"
  | "pending"
  | "partially_paid"
  | "paid"
  | "refunded"
  | "cancelled";
type ProductPaymentTransactionVerifiedByType = "system_slipok" | "admin_manual";
type ProductPaymentMethod =
  | "cash"
  | "bank_transfer"
  | "promptpay"
  | "card"
  | "other";
type ProductPaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled";
type ProductPaymentVerificationProvider = "manual" | "slipok";
type ProductPaymentVerificationStatus =
  | "not_submitted"
  | "submitted"
  | "verified"
  | "rejected"
  | "failed";
type PaymentSettingStatus = "active" | "inactive";
type ShoppingCartStatus = "active" | "ordered" | "abandoned";
type RepairJobStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type Database = {
  public: {
    Tables: {
      delivery_addresses: {
        Row: {
          id: string;
          customer_id: string;
          recipient_name: string;
          phone_number: string;
          address_line: string;
          province: string;
          district: string;
          postal_code: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          recipient_name: string;
          phone_number: string;
          address_line: string;
          province: string;
          district: string;
          postal_code: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          recipient_name?: string;
          phone_number?: string;
          address_line?: string;
          province?: string;
          district?: string;
          postal_code?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      garage_capacity: {
        Row: {
          id: string;
          booking_date: string;
          booking_time: string;
          max_bookings: number;
          status: CapacityStatus;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_date: string;
          booking_time: string;
          max_bookings?: number;
          status?: CapacityStatus;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_date?: string;
          booking_time?: string;
          max_bookings?: number;
          status?: CapacityStatus;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      garage_closed_dates: {
        Row: {
          closed_date: string;
          reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          closed_date: string;
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          closed_date?: string;
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      garage_operating_days: {
        Row: {
          weekday: number;
          is_open: boolean;
          open_time: string;
          close_time: string;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          weekday: number;
          is_open?: boolean;
          open_time?: string;
          close_time?: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          weekday?: number;
          is_open?: boolean;
          open_time?: string;
          close_time?: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          customer_id: string;
          // Nullable: bookings_vehicle_id_fkey is ON DELETE SET NULL so a
          // vehicle can be deleted (per the vehicle-delete business rule)
          // without being blocked by, or destroying, its booking history.
          vehicle_id: string | null;
          service_id: string;
          booking_date: string;
          booking_time: string;
          status: BookingStatus;
          note: string | null;
          payment_status: BookingPaymentStatus;
          payment_amount: number | null;
          picked_up_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          vehicle_id: string;
          service_id: string;
          booking_date: string;
          booking_time: string;
          status?: BookingStatus;
          note?: string | null;
          payment_status?: BookingPaymentStatus;
          payment_amount?: number | null;
          picked_up_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          vehicle_id?: string;
          service_id?: string;
          booking_date?: string;
          booking_time?: string;
          status?: BookingStatus;
          note?: string | null;
          payment_status?: BookingPaymentStatus;
          payment_amount?: number | null;
          picked_up_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      booking_payments: {
        Row: {
          id: string;
          booking_id: string;
          customer_id: string;
          amount: number;
          payment_method: "bank_transfer" | "promptpay";
          slip_image_url: string;
          payment_status: "pending" | "paid" | "rejected";
          rejected_reason: string | null;
          submitted_at: string;
          paid_at: string | null;
          verified_at: string | null;
          verified_by: string | null;
          verification_status: BookingPaymentVerificationStatus;
          verification_provider: BookingPaymentVerificationProvider | null;
          provider_reference: string | null;
          verification_response: Json | null;
          slip_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          customer_id: string;
          amount: number;
          payment_method?: "bank_transfer" | "promptpay";
          slip_image_url: string;
          payment_status?: "pending" | "paid" | "rejected";
          rejected_reason?: string | null;
          submitted_at?: string;
          paid_at?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          verification_status?: BookingPaymentVerificationStatus;
          verification_provider?: BookingPaymentVerificationProvider | null;
          provider_reference?: string | null;
          verification_response?: Json | null;
          slip_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          customer_id?: string;
          amount?: number;
          payment_method?: "bank_transfer" | "promptpay";
          slip_image_url?: string;
          payment_status?: "pending" | "paid" | "rejected";
          rejected_reason?: string | null;
          submitted_at?: string;
          paid_at?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          verification_status?: BookingPaymentVerificationStatus;
          verification_provider?: BookingPaymentVerificationProvider | null;
          provider_reference?: string | null;
          verification_response?: Json | null;
          slip_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          avatar_url: string | null;
          full_name: string;
          phone_number: string;
          email: string | null;
          role: ProfileRole;
          technician_specialty: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          avatar_url?: string | null;
          full_name: string;
          phone_number: string;
          email?: string | null;
          role?: ProfileRole;
          technician_specialty?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          avatar_url?: string | null;
          full_name?: string;
          phone_number?: string;
          email?: string | null;
          role?: ProfileRole;
          technician_specialty?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory_movements: {
        Row: {
          id: string;
          product_id: string;
          movement_type: InventoryMovementType;
          quantity: number;
          reference_type: string | null;
          reference_id: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          movement_type: InventoryMovementType;
          quantity: number;
          reference_type?: string | null;
          reference_id?: string | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          movement_type?: InventoryMovementType;
          quantity?: number;
          reference_type?: string | null;
          reference_id?: string | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      product_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          status: ServiceStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          status?: ServiceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          status?: ServiceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_order_items: {
        Row: {
          id: string;
          product_order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_order_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
          total_price?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      product_orders: {
        Row: {
          id: string;
          customer_id: string;
          order_number: string;
          status: ProductOrderStatus;
          delivery_method: ProductDeliveryMethod;
          delivery_address: string | null;
          delivery_latitude: number | null;
          delivery_longitude: number | null;
          subtotal_amount: number;
          delivery_fee: number;
          total_amount: number;
          payment_status: ProductOrderPaymentStatus;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          order_number?: string;
          status?: ProductOrderStatus;
          delivery_method?: ProductDeliveryMethod;
          delivery_address?: string | null;
          delivery_latitude?: number | null;
          delivery_longitude?: number | null;
          subtotal_amount?: number;
          delivery_fee?: number;
          total_amount?: number;
          payment_status?: ProductOrderPaymentStatus;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          order_number?: string;
          status?: ProductOrderStatus;
          delivery_method?: ProductDeliveryMethod;
          delivery_address?: string | null;
          delivery_latitude?: number | null;
          delivery_longitude?: number | null;
          subtotal_amount?: number;
          delivery_fee?: number;
          total_amount?: number;
          payment_status?: ProductOrderPaymentStatus;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_payments: {
        Row: {
          id: string;
          product_order_id: string;
          payment_method: ProductPaymentMethod;
          payment_status: ProductPaymentStatus;
          amount: number;
          paid_at: string | null;
          verification_provider: ProductPaymentVerificationProvider;
          verification_status: ProductPaymentVerificationStatus;
          slip_image_url: string | null;
          slip_qr_payload: string | null;
          slip_reference: string | null;
          slip_amount: number | null;
          slip_transfer_at: string | null;
          slip_sender_bank: string | null;
          slip_sender_account: string | null;
          slip_receiver_bank: string | null;
          slip_receiver_account: string | null;
          slip_receiver_name: string | null;
          provider_reference: string | null;
          verification_response: Json | null;
          submitted_at: string | null;
          verified_at: string | null;
          verified_by: string | null;
          rejected_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_order_id: string;
          payment_method?: ProductPaymentMethod;
          payment_status?: ProductPaymentStatus;
          amount?: number;
          paid_at?: string | null;
          verification_provider?: ProductPaymentVerificationProvider;
          verification_status?: ProductPaymentVerificationStatus;
          slip_image_url?: string | null;
          slip_qr_payload?: string | null;
          slip_reference?: string | null;
          slip_amount?: number | null;
          slip_transfer_at?: string | null;
          slip_sender_bank?: string | null;
          slip_sender_account?: string | null;
          slip_receiver_bank?: string | null;
          slip_receiver_account?: string | null;
          slip_receiver_name?: string | null;
          provider_reference?: string | null;
          verification_response?: Json | null;
          submitted_at?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          rejected_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_order_id?: string;
          payment_method?: ProductPaymentMethod;
          payment_status?: ProductPaymentStatus;
          amount?: number;
          paid_at?: string | null;
          verification_provider?: ProductPaymentVerificationProvider;
          verification_status?: ProductPaymentVerificationStatus;
          slip_image_url?: string | null;
          slip_qr_payload?: string | null;
          slip_reference?: string | null;
          slip_amount?: number | null;
          slip_transfer_at?: string | null;
          slip_sender_bank?: string | null;
          slip_sender_account?: string | null;
          slip_receiver_bank?: string | null;
          slip_receiver_account?: string | null;
          slip_receiver_name?: string | null;
          provider_reference?: string | null;
          verification_response?: Json | null;
          submitted_at?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          rejected_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_payment_transactions: {
        Row: {
          id: string;
          product_payment_id: string;
          product_order_id: string;
          provider_reference: string;
          verified_amount: number;
          verified_by_type: ProductPaymentTransactionVerifiedByType;
          verified_by_user_id: string | null;
          verified_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_payment_id: string;
          product_order_id: string;
          provider_reference: string;
          verified_amount: number;
          verified_by_type: ProductPaymentTransactionVerifiedByType;
          verified_by_user_id?: string | null;
          verified_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_payment_id?: string;
          product_order_id?: string;
          provider_reference?: string;
          verified_amount?: number;
          verified_by_type?: ProductPaymentTransactionVerifiedByType;
          verified_by_user_id?: string | null;
          verified_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      payment_settings: {
        Row: {
          id: string;
          setting_key: string;
          status: PaymentSettingStatus;
          promptpay_enabled: boolean;
          promptpay_display_name: string;
          promptpay_id: string | null;
          promptpay_qr_image_url: string | null;
          bank_transfer_enabled: boolean;
          bank_name: string | null;
          bank_account_number: string | null;
          bank_account_name: string | null;
          bank_branch: string | null;
          payment_instructions: string | null;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          setting_key?: string;
          status?: PaymentSettingStatus;
          promptpay_enabled?: boolean;
          promptpay_display_name?: string;
          promptpay_id?: string | null;
          promptpay_qr_image_url?: string | null;
          bank_transfer_enabled?: boolean;
          bank_name?: string | null;
          bank_account_number?: string | null;
          bank_account_name?: string | null;
          bank_branch?: string | null;
          payment_instructions?: string | null;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          setting_key?: string;
          status?: PaymentSettingStatus;
          promptpay_enabled?: boolean;
          promptpay_display_name?: string;
          promptpay_id?: string | null;
          promptpay_qr_image_url?: string | null;
          bank_transfer_enabled?: boolean;
          bank_name?: string | null;
          bank_account_number?: string | null;
          bank_account_name?: string | null;
          bank_branch?: string | null;
          payment_instructions?: string | null;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      homepage_footer_settings: {
        Row: {
          id: string;
          setting_key: string;
          status: ServiceStatus;
          background_color: string;
          office_title: string;
          office_address: string | null;
          office_phone: string | null;
          office_fax: string | null;
          office_latitude: number | null;
          office_longitude: number | null;
          contact_title: string;
          contact_phone: string | null;
          contact_email: string | null;
          services_title: string;
          services_content: string | null;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          setting_key?: string;
          status?: ServiceStatus;
          background_color?: string;
          office_title?: string;
          office_address?: string | null;
          office_phone?: string | null;
          office_fax?: string | null;
          office_latitude?: number | null;
          office_longitude?: number | null;
          contact_title?: string;
          contact_phone?: string | null;
          contact_email?: string | null;
          services_title?: string;
          services_content?: string | null;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          setting_key?: string;
          status?: ServiceStatus;
          background_color?: string;
          office_title?: string;
          office_address?: string | null;
          office_phone?: string | null;
          office_fax?: string | null;
          office_latitude?: number | null;
          office_longitude?: number | null;
          contact_title?: string;
          contact_phone?: string | null;
          contact_email?: string | null;
          services_title?: string;
          services_content?: string | null;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      homepage_appearance_settings: {
        Row: {
          id: string;
          setting_key: string;
          background_color: string;
          background_image_url: string | null;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          setting_key?: string;
          background_color?: string;
          background_image_url?: string | null;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          setting_key?: string;
          background_color?: string;
          background_image_url?: string | null;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      homepage_slides: {
        Row: {
          id: string;
          title: string;
          subtitle: string | null;
          description: string | null;
          image_url: string;
          primary_label: string;
          primary_href: string;
          secondary_label: string | null;
          secondary_href: string | null;
          sort_order: number;
          status: ServiceStatus;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          subtitle?: string | null;
          description?: string | null;
          image_url: string;
          primary_label?: string;
          primary_href?: string;
          secondary_label?: string | null;
          secondary_href?: string | null;
          sort_order?: number;
          status?: ServiceStatus;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          subtitle?: string | null;
          description?: string | null;
          image_url?: string;
          primary_label?: string;
          primary_href?: string;
          secondary_label?: string | null;
          secondary_href?: string | null;
          sort_order?: number;
          status?: ServiceStatus;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          product_category_id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          sku: string | null;
          unit_price: number;
          cost_price: number;
          stock_quantity: number;
          status: ServiceStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_category_id: string;
          name: string;
          description?: string | null;
          image_url?: string | null;
          sku?: string | null;
          unit_price?: number;
          cost_price?: number;
          stock_quantity?: number;
          status?: ServiceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_category_id?: string;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          sku?: string | null;
          unit_price?: number;
          cost_price?: number;
          stock_quantity?: number;
          status?: ServiceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shopping_cart_items: {
        Row: {
          id: string;
          shopping_cart_id: string;
          product_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shopping_cart_id: string;
          product_id: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shopping_cart_id?: string;
          product_id?: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shopping_carts: {
        Row: {
          id: string;
          customer_id: string;
          status: ShoppingCartStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          status?: ShoppingCartStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          status?: ShoppingCartStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      repair_jobs: {
        Row: {
          id: string;
          booking_id: string;
          customer_id: string | null;
          // Nullable: repair_jobs_vehicle_id_fkey is ON DELETE SET NULL so
          // deleting a vehicle (once eligible) keeps the completed repair
          // record instead of cascading a delete onto it.
          vehicle_id: string | null;
          mechanic_id: string | null;
          status: RepairJobStatus;
          diagnosis: string | null;
          repair_notes: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          customer_id?: string | null;
          vehicle_id: string;
          mechanic_id?: string | null;
          status?: RepairJobStatus;
          diagnosis?: string | null;
          repair_notes?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          customer_id?: string | null;
          vehicle_id?: string;
          mechanic_id?: string | null;
          status?: RepairJobStatus;
          diagnosis?: string | null;
          repair_notes?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          status: ServiceStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          status?: ServiceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          status?: ServiceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      technician_profile_skills: {
        Row: {
          technician_id: string;
          skill_id: string;
          created_at: string;
        };
        Insert: {
          technician_id: string;
          skill_id: string;
          created_at?: string;
        };
        Update: {
          technician_id?: string;
          skill_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      technician_skills: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          status: ServiceStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          status?: ServiceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          status?: ServiceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          service_category_id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          base_price: number;
          estimated_duration_minutes: number;
          status: ServiceStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_category_id: string;
          name: string;
          description?: string | null;
          image_url?: string | null;
          base_price: number;
          estimated_duration_minutes: number;
          status?: ServiceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          service_category_id?: string;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          base_price?: number;
          estimated_duration_minutes?: number;
          status?: ServiceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          customer_id: string;
          license_plate: string;
          brand: string | null;
          model: string | null;
          year: number | null;
          color: string | null;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          license_plate: string;
          brand?: string | null;
          model?: string | null;
          year?: number | null;
          color?: string | null;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          license_plate?: string;
          brand?: string | null;
          model?: string | null;
          year?: number | null;
          color?: string | null;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    } & Record<string, GenericTable>;
    Views: Record<string, GenericTable>;
    Functions: {
      get_homepage_stats: {
        Args: Record<string, never>;
        Returns: {
          trusted_customers_count: number;
          completed_repair_jobs_count: number;
          technician_team_count: number;
        }[];
      };
      apply_product_order_inventory: {
        Args: {
          target_order_id: string;
        };
        Returns: number;
      };
      cancel_product_order_with_inventory_return: {
        Args: {
          target_order_id: string;
        };
        Returns: number;
      };
      cancel_own_product_order_with_inventory_return: {
        Args: {
          target_order_id: string;
        };
        Returns: number;
      };
      get_garage_operating_status: {
        Args: {
          target_date: string;
        };
        Returns: {
          booking_date: string;
          weekday: number;
          is_open: boolean;
          open_time: string;
          close_time: string;
          is_special_closed: boolean;
          note: string | null;
          closed_reason: string | null;
        }[];
      };
      get_garage_slot_availability: {
        Args: {
          target_date: string;
          target_time: string;
        };
        Returns: {
          booking_date: string;
          booking_time: string;
          max_bookings: number;
          active_booking_count: number;
          available_booking_count: number;
          is_open: boolean;
        }[];
      };
      is_garage_slot_available: {
        Args: {
          target_date: string;
          target_time: string;
        };
        Returns: boolean;
      };
      complete_repair_job_and_request_payment: {
        Args: {
          target_work_order_id: string;
          diagnosis_text: string | null;
          repair_notes_text: string | null;
        };
        Returns: {
          id: string;
          booking_id: string;
          customer_id: string | null;
          vehicle_id: string;
          mechanic_id: string | null;
          status: RepairJobStatus;
          diagnosis: string | null;
          repair_notes: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      reopen_repair_job: {
        Args: {
          target_work_order_id: string;
        };
        Returns: {
          id: string;
          booking_id: string;
          customer_id: string | null;
          vehicle_id: string;
          mechanic_id: string | null;
          status: RepairJobStatus;
          diagnosis: string | null;
          repair_notes: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      submit_booking_payment_slip: {
        Args: {
          target_booking_id: string;
          slip_url: string;
          slip_payment_method: string;
        };
        Returns: {
          id: string;
          booking_id: string;
          customer_id: string;
          amount: number;
          payment_method: "bank_transfer" | "promptpay";
          slip_image_url: string;
          payment_status: "pending" | "paid" | "rejected";
          rejected_reason: string | null;
          submitted_at: string;
          paid_at: string | null;
          verified_at: string | null;
          verified_by: string | null;
          verification_status: BookingPaymentVerificationStatus;
          verification_provider: BookingPaymentVerificationProvider | null;
          provider_reference: string | null;
          verification_response: Json | null;
          slip_amount: number | null;
          created_at: string;
          updated_at: string;
        };
      };
      approve_booking_payment: {
        Args: {
          target_booking_payment_id: string;
        };
        Returns: {
          id: string;
          customer_id: string;
          vehicle_id: string;
          service_id: string;
          booking_date: string;
          booking_time: string;
          status: BookingStatus;
          note: string | null;
          payment_status: BookingPaymentStatus;
          payment_amount: number | null;
          picked_up_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      reject_booking_payment: {
        Args: {
          target_booking_payment_id: string;
          reason: string;
        };
        Returns: {
          id: string;
          customer_id: string;
          vehicle_id: string;
          service_id: string;
          booking_date: string;
          booking_time: string;
          status: BookingStatus;
          note: string | null;
          payment_status: BookingPaymentStatus;
          payment_amount: number | null;
          picked_up_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      confirm_booking_pickup: {
        Args: {
          target_booking_id: string;
        };
        Returns: {
          id: string;
          customer_id: string;
          vehicle_id: string;
          service_id: string;
          booking_date: string;
          booking_time: string;
          status: BookingStatus;
          note: string | null;
          payment_status: BookingPaymentStatus;
          payment_amount: number | null;
          picked_up_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
