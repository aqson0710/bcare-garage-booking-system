import type { Database } from "@/lib/supabase/database.types";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductCategory =
  Database["public"]["Tables"]["product_categories"]["Row"];
export type ShoppingCart =
  Database["public"]["Tables"]["shopping_carts"]["Row"];
export type ShoppingCartItem =
  Database["public"]["Tables"]["shopping_cart_items"]["Row"];
export type ProductOrder =
  Database["public"]["Tables"]["product_orders"]["Row"];
export type ProductOrderItem =
  Database["public"]["Tables"]["product_order_items"]["Row"];
export type ProductPayment =
  Database["public"]["Tables"]["product_payments"]["Row"];
export type ProductPaymentTransaction =
  Database["public"]["Tables"]["product_payment_transactions"]["Row"];
export type PaymentSetting =
  Database["public"]["Tables"]["payment_settings"]["Row"];

export type ProductWithCategory = Product & {
  category: ProductCategory | null;
};

export type ProductCategoryWithProducts = ProductCategory & {
  products: ProductWithCategory[];
};

export type CartItemWithProduct = ShoppingCartItem & {
  product: ProductWithCategory | null;
};

export type ProductOrderItemWithProduct = ProductOrderItem & {
  product: ProductWithCategory | null;
};

export type ProductOrderWithItems = ProductOrder & {
  items: ProductOrderItemWithProduct[];
  payments: ProductPayment[];
  // Optional: populated by the customer-facing queries (getCustomerProductOrders,
  // getCustomerProductOrderById) from the product_payment_transactions ledger.
  // Left optional so AdminProductOrder (admin/types.ts), which doesn't carry
  // these yet, can still structurally satisfy anything typed against
  // ProductOrderWithItems (e.g. ProductOrderReceiptDocument) ahead of the
  // admin-side rebuild stage picking up the same ledger fields.
  transactions?: ProductPaymentTransaction[];
  amountPaid?: number;
  amountRemaining?: number;
};

export type ProductOrderPaymentSettlement = {
  order: ProductOrder;
  paymentStatus: ProductOrder["payment_status"];
  amountPaid: number;
  amountRemaining: number;
  transactions: ProductPaymentTransaction[];
};

export type CartDetails = {
  cart: ShoppingCart | null;
  items: CartItemWithProduct[];
  itemCount: number;
  subtotal: number;
};

export type CartSummary = {
  cart: ShoppingCart | null;
  itemCount: number;
};

export type CheckoutDeliveryMethod = ProductOrder["delivery_method"];

export type CheckoutInput = {
  deliveryMethod: CheckoutDeliveryMethod;
  deliveryAddress: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  deliveryFee: number;
  note: string | null;
};

export type CheckoutResult = {
  order: ProductOrder;
  items: ProductOrderItem[];
};

export type ProductPaymentSlipInput = {
  amount: number;
  file: File;
  orderId: string;
  paymentMethod: Extract<ProductPayment["payment_method"], "bank_transfer" | "promptpay">;
  slipReference: string | null;
};
