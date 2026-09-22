import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  CartDetails,
  CartItemWithProduct,
  CartSummary,
  CheckoutInput,
  CheckoutResult,
  Product,
  ProductCategory,
  ProductCategoryWithProducts,
  ProductOrder,
  ProductOrderItem,
  ProductOrderItemWithProduct,
  PaymentSetting,
  ProductPayment,
  ProductPaymentSlipInput,
  ProductOrderWithItems,
  ProductPaymentTransaction,
  ProductWithCategory,
} from "./types";

type BCareSupabaseClient = SupabaseClient<Database>;

function groupProductsByCategory(
  categories: ProductCategory[],
  products: Product[],
) {
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  );

  const productsWithCategories: ProductWithCategory[] = products.map(
    (product) => ({
      ...product,
      category: categoriesById.get(product.product_category_id) ?? null,
    }),
  );

  const categoriesWithProducts: ProductCategoryWithProducts[] = categories.map(
    (category) => ({
      ...category,
      products: productsWithCategories.filter(
        (product) => product.product_category_id === category.id,
      ),
    }),
  );

  const uncategorizedProducts = productsWithCategories.filter(
    (product) => !product.category,
  );

  return {
    categories: categoriesWithProducts,
    products: productsWithCategories,
    uncategorizedProducts,
  };
}

export async function getActivePaymentSetting(supabase: BCareSupabaseClient) {
  const settingsResult = await supabase
    .from("payment_settings")
    .select("*")
    .eq("setting_key", "default")
    .eq("status", "active")
    .maybeSingle();

  if (settingsResult.error) {
    return {
      data: null,
      error: settingsResult.error,
    };
  }

  return {
    data: settingsResult.data satisfies PaymentSetting | null,
    error: null,
  };
}

export async function getStorefrontProducts(supabase: BCareSupabaseClient) {
  const [categoriesResult, productsResult] = await Promise.all([
    supabase
      .from("product_categories")
      .select("*")
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("products")
      .select("*")
      .eq("status", "active")
      .order("name", { ascending: true }),
  ]);

  if (categoriesResult.error) {
    return {
      data: null,
      error: categoriesResult.error,
    };
  }

  if (productsResult.error) {
    return {
      data: null,
      error: productsResult.error,
    };
  }

  return {
    data: groupProductsByCategory(
      categoriesResult.data ?? [],
      productsResult.data ?? [],
    ),
    error: null,
  };
}

async function getActiveCart(
  supabase: BCareSupabaseClient,
  customerId: string,
) {
  return supabase
    .from("shopping_carts")
    .select("*")
    .eq("customer_id", customerId)
    .eq("status", "active")
    .maybeSingle();
}

async function createActiveCart(
  supabase: BCareSupabaseClient,
  customerId: string,
) {
  return supabase
    .from("shopping_carts")
    .insert({
      customer_id: customerId,
      status: "active",
    })
    .select("*")
    .single();
}

export async function getCartSummary(
  supabase: BCareSupabaseClient,
  customerId: string,
) {
  const cartResult = await getActiveCart(supabase, customerId);

  if (cartResult.error) {
    return {
      data: null,
      error: cartResult.error,
    };
  }

  if (!cartResult.data) {
    return {
      data: {
        cart: null,
        itemCount: 0,
      } satisfies CartSummary,
      error: null,
    };
  }

  const itemsResult = await supabase
    .from("shopping_cart_items")
    .select("quantity")
    .eq("shopping_cart_id", cartResult.data.id);

  if (itemsResult.error) {
    return {
      data: null,
      error: itemsResult.error,
    };
  }

  return {
    data: {
      cart: cartResult.data,
      itemCount: (itemsResult.data ?? []).reduce(
        (total, item) => total + item.quantity,
        0,
      ),
    } satisfies CartSummary,
    error: null,
  };
}

export async function getCartDetails(
  supabase: BCareSupabaseClient,
  customerId: string,
) {
  const cartResult = await getActiveCart(supabase, customerId);

  if (cartResult.error) {
    return {
      data: null,
      error: cartResult.error,
    };
  }

  if (!cartResult.data) {
    return {
      data: {
        cart: null,
        itemCount: 0,
        items: [],
        subtotal: 0,
      } satisfies CartDetails,
      error: null,
    };
  }

  const itemsResult = await supabase
    .from("shopping_cart_items")
    .select("*")
    .eq("shopping_cart_id", cartResult.data.id)
    .order("created_at", { ascending: true });

  if (itemsResult.error) {
    return {
      data: null,
      error: itemsResult.error,
    };
  }

  const cartItems = itemsResult.data ?? [];
  const productIds = Array.from(
    new Set(cartItems.map((item) => item.product_id)),
  );

  const productsResult =
    productIds.length > 0
      ? await supabase.from("products").select("*").in("id", productIds)
      : { data: [], error: null };

  if (productsResult.error) {
    return {
      data: null,
      error: productsResult.error,
    };
  }

  const categoryIds = Array.from(
    new Set(
      (productsResult.data ?? []).map((product) => product.product_category_id),
    ),
  );

  const categoriesResult =
    categoryIds.length > 0
      ? await supabase.from("product_categories").select("*").in("id", categoryIds)
      : { data: [], error: null };

  if (categoriesResult.error) {
    return {
      data: null,
      error: categoriesResult.error,
    };
  }

  const categoriesById = new Map(
    (categoriesResult.data ?? []).map((category) => [category.id, category]),
  );
  const productsById = new Map(
    (productsResult.data ?? []).map((product) => [
      product.id,
      {
        ...product,
        category: categoriesById.get(product.product_category_id) ?? null,
      } satisfies ProductWithCategory,
    ]),
  );
  const items: CartItemWithProduct[] = cartItems.map((item) => ({
    ...item,
    product: productsById.get(item.product_id) ?? null,
  }));
  const subtotal = items.reduce(
    (total, item) => total + (item.product?.unit_price ?? 0) * item.quantity,
    0,
  );

  return {
    data: {
      cart: cartResult.data,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      items,
      subtotal,
    } satisfies CartDetails,
    error: null,
  };
}

async function getOrCreateActiveCart(
  supabase: BCareSupabaseClient,
  customerId: string,
) {
  const cartResult = await getActiveCart(supabase, customerId);

  if (cartResult.error) {
    return cartResult;
  }

  if (cartResult.data) {
    return {
      data: cartResult.data,
      error: null,
    };
  }

  return createActiveCart(supabase, customerId);
}

export async function addProductToCart(
  supabase: BCareSupabaseClient,
  customerId: string,
  productId: string,
) {
  const productResult = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("status", "active")
    .single();

  if (productResult.error) {
    return {
      data: null,
      error: productResult.error,
    };
  }

  if (productResult.data.stock_quantity <= 0) {
    return {
      data: null,
      error: new Error("สินค้านี้หมดสต๊อกแล้ว"),
    };
  }

  const cartResult = await getOrCreateActiveCart(supabase, customerId);

  if (cartResult.error || !cartResult.data) {
    return {
      data: null,
      error: cartResult.error ?? new Error("ไม่สามารถสร้างตะกร้าได้"),
    };
  }

  const existingItemResult = await supabase
    .from("shopping_cart_items")
    .select("*")
    .eq("shopping_cart_id", cartResult.data.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existingItemResult.error) {
    return {
      data: null,
      error: existingItemResult.error,
    };
  }

  if (existingItemResult.data) {
    const nextQuantity = existingItemResult.data.quantity + 1;

    if (nextQuantity > productResult.data.stock_quantity) {
      return {
        data: null,
        error: new Error("จำนวนในตะกร้าเกินสต๊อกที่มี"),
      };
    }

    const updateResult = await supabase
      .from("shopping_cart_items")
      .update({
        quantity: nextQuantity,
      })
      .eq("id", existingItemResult.data.id)
      .select("*")
      .single();

    if (updateResult.error) {
      return {
        data: null,
        error: updateResult.error,
      };
    }

    return getCartSummary(supabase, customerId);
  }

  const insertResult = await supabase
    .from("shopping_cart_items")
    .insert({
      product_id: productId,
      quantity: 1,
      shopping_cart_id: cartResult.data.id,
    })
    .select("*")
    .single();

  if (insertResult.error) {
    return {
      data: null,
      error: insertResult.error,
    };
  }

  return getCartSummary(supabase, customerId);
}

export async function updateCartItemQuantity(
  supabase: BCareSupabaseClient,
  customerId: string,
  cartItemId: string,
  quantity: number,
) {
  if (quantity < 1 || quantity > 1000) {
    return {
      data: null,
      error: new Error("จำนวนสินค้าต้องอยู่ระหว่าง 1 ถึง 1000"),
    };
  }

  const detailsResult = await getCartDetails(supabase, customerId);

  if (detailsResult.error || !detailsResult.data) {
    return {
      data: null,
      error: detailsResult.error ?? new Error("ไม่สามารถโหลดตะกร้าได้"),
    };
  }

  const item = detailsResult.data.items.find(
    (cartItem) => cartItem.id === cartItemId,
  );

  if (!item) {
    return {
      data: null,
      error: new Error("ไม่พบสินค้าในตะกร้า"),
    };
  }

  if (!item.product) {
    return {
      data: null,
      error: new Error("ไม่พบข้อมูลสินค้า"),
    };
  }

  if (quantity > item.product.stock_quantity) {
    return {
      data: null,
      error: new Error("จำนวนที่เลือกเกินสต๊อกที่มี"),
    };
  }

  const updateResult = await supabase
    .from("shopping_cart_items")
    .update({ quantity })
    .eq("id", cartItemId)
    .select("*")
    .single();

  if (updateResult.error) {
    return {
      data: null,
      error: updateResult.error,
    };
  }

  return getCartDetails(supabase, customerId);
}

export async function removeCartItem(
  supabase: BCareSupabaseClient,
  customerId: string,
  cartItemId: string,
) {
  const detailsResult = await getCartDetails(supabase, customerId);

  if (detailsResult.error || !detailsResult.data) {
    return {
      data: null,
      error: detailsResult.error ?? new Error("ไม่สามารถโหลดตะกร้าได้"),
    };
  }

  const item = detailsResult.data.items.find(
    (cartItem) => cartItem.id === cartItemId,
  );

  if (!item) {
    return {
      data: null,
      error: new Error("ไม่พบสินค้าในตะกร้า"),
    };
  }

  const deleteResult = await supabase
    .from("shopping_cart_items")
    .delete()
    .eq("id", cartItemId);

  if (deleteResult.error) {
    return {
      data: null,
      error: deleteResult.error,
    };
  }

  return getCartDetails(supabase, customerId);
}

export async function createProductOrderFromCart(
  supabase: BCareSupabaseClient,
  customerId: string,
  input: CheckoutInput,
) {
  const detailsResult = await getCartDetails(supabase, customerId);

  if (detailsResult.error || !detailsResult.data) {
    return {
      data: null,
      error: detailsResult.error ?? new Error("ไม่สามารถโหลดตะกร้าได้"),
    };
  }

  if (!detailsResult.data.cart || detailsResult.data.items.length === 0) {
    return {
      data: null,
      error: new Error("ตะกร้ายังไม่มีสินค้า"),
    };
  }

  if (
    input.deliveryMethod === "delivery" &&
    (!input.deliveryAddress || input.deliveryAddress.trim().length < 5)
  ) {
    return {
      data: null,
      error: new Error("กรุณากรอกที่อยู่จัดส่ง"),
    };
  }

  for (const item of detailsResult.data.items) {
    if (!item.product) {
      return {
        data: null,
        error: new Error("พบสินค้าในตะกร้าที่ไม่มีข้อมูลสินค้า"),
      };
    }

    if (item.product.status !== "active") {
      return {
        data: null,
        error: new Error(`${item.product.name} ยังไม่เปิดขาย`),
      };
    }

    if (item.quantity > item.product.stock_quantity) {
      return {
        data: null,
        error: new Error(`${item.product.name} มีสต๊อกไม่พอ`),
      };
    }
  }

  const subtotal = detailsResult.data.subtotal;
  const deliveryFee = input.deliveryMethod === "delivery" ? input.deliveryFee : 0;
  const totalAmount = subtotal + deliveryFee;
  const orderResult = await supabase
    .from("product_orders")
    .insert({
      customer_id: customerId,
      delivery_address:
        input.deliveryMethod === "delivery" ? input.deliveryAddress : null,
      delivery_latitude:
        input.deliveryMethod === "delivery" ? input.deliveryLatitude : null,
      delivery_longitude:
        input.deliveryMethod === "delivery" ? input.deliveryLongitude : null,
      delivery_fee: deliveryFee,
      delivery_method: input.deliveryMethod,
      note: input.note,
      payment_status: "unpaid",
      status: "pending",
      subtotal_amount: subtotal,
      total_amount: totalAmount,
    })
    .select("*")
    .single();

  if (orderResult.error) {
    return {
      data: null,
      error: orderResult.error,
    };
  }

  const orderItemsInput = detailsResult.data.items.map((item) => ({
    product_id: item.product_id,
    product_order_id: orderResult.data.id,
    quantity: item.quantity,
    total_price: (item.product?.unit_price ?? 0) * item.quantity,
    unit_price: item.product?.unit_price ?? 0,
  }));
  const orderItemsResult = await supabase
    .from("product_order_items")
    .insert(orderItemsInput)
    .select("*");

  if (orderItemsResult.error) {
    return {
      data: null,
      error: orderItemsResult.error,
    };
  }

  const stockDeductionResult = await supabase.rpc(
    "apply_product_order_inventory",
    {
      target_order_id: orderResult.data.id,
    },
  );

  if (stockDeductionResult.error) {
    await supabase
      .from("product_orders")
      .update({ status: "cancelled" })
      .eq("id", orderResult.data.id);

    return {
      data: null,
      error: stockDeductionResult.error,
    };
  }

  const cartUpdateResult = await supabase
    .from("shopping_carts")
    .update({ status: "ordered" })
    .eq("id", detailsResult.data.cart.id)
    .select("*")
    .single();

  if (cartUpdateResult.error) {
    return {
      data: null,
      error: cartUpdateResult.error,
    };
  }

  return {
    data: {
      items: orderItemsResult.data ?? [],
      order: orderResult.data,
    } satisfies CheckoutResult,
    error: null,
  };
}

// Lets the signed-in customer cancel their OWN order while it is still
// "pending" (the same window the RLS policy on product_orders already
// allows a direct customer update for). Routed through this RPC instead of
// a plain `.update({ status: "cancelled" })` call so the deducted stock is
// safely returned to inventory the same way the admin-only cancellation
// path does - a bare client-side update would leave stock incorrectly
// deducted. See supabase/product-order-customer-cancellation.sql.
export async function cancelOwnProductOrder(
  supabase: BCareSupabaseClient,
  orderId: string,
) {
  return supabase.rpc("cancel_own_product_order_with_inventory_return", {
    target_order_id: orderId,
  });
}

async function attachProductsToOrderItems(
  supabase: BCareSupabaseClient,
  orderItems: ProductOrderItem[],
) {
  const productIds = Array.from(
    new Set(orderItems.map((item) => item.product_id)),
  );

  if (productIds.length === 0) {
    return {
      data: [] satisfies ProductOrderItemWithProduct[],
      error: null,
    };
  }

  const productsResult = await supabase
    .from("products")
    .select("*")
    .in("id", productIds);

  if (productsResult.error) {
    return {
      data: null,
      error: productsResult.error,
    };
  }

  const categoryIds = Array.from(
    new Set(
      (productsResult.data ?? []).map((product) => product.product_category_id),
    ),
  );

  const categoriesResult =
    categoryIds.length > 0
      ? await supabase.from("product_categories").select("*").in("id", categoryIds)
      : { data: [], error: null };

  if (categoriesResult.error) {
    return {
      data: null,
      error: categoriesResult.error,
    };
  }

  const categoriesById = new Map(
    (categoriesResult.data ?? []).map((category) => [category.id, category]),
  );
  const productsById = new Map(
    (productsResult.data ?? []).map((product) => [
      product.id,
      {
        ...product,
        category: categoriesById.get(product.product_category_id) ?? null,
      } satisfies ProductWithCategory,
    ]),
  );

  return {
    data: orderItems.map((item) => ({
      ...item,
      product: productsById.get(item.product_id) ?? null,
    })) satisfies ProductOrderItemWithProduct[],
    error: null,
  };
}

function buildProductOrdersWithItems(
  orders: ProductOrder[],
  items: ProductOrderItemWithProduct[],
  payments: ProductPayment[],
  transactions: ProductPaymentTransaction[],
) {
  return orders.map((order) => {
    const orderTransactions = transactions.filter(
      (transaction) => transaction.product_order_id === order.id,
    );
    const amountPaid = orderTransactions.reduce(
      (sum, transaction) => sum + transaction.verified_amount,
      0,
    );

    return {
      ...order,
      amountPaid,
      amountRemaining: Math.max(order.total_amount - amountPaid, 0),
      items: items.filter((item) => item.product_order_id === order.id),
      payments: payments.filter((payment) => payment.product_order_id === order.id),
      transactions: orderTransactions,
    };
  }) satisfies ProductOrderWithItems[];
}

async function getProductPaymentsForOrders(
  supabase: BCareSupabaseClient,
  orderIds: string[],
) {
  if (orderIds.length === 0) {
    return {
      data: [] satisfies ProductPayment[],
      error: null,
    };
  }

  const paymentsResult = await supabase
    .from("product_payments")
    .select("*")
    .in("product_order_id", orderIds)
    .order("updated_at", { ascending: false });

  return {
    data: paymentsResult.data ?? null,
    error: paymentsResult.error,
  };
}

async function getProductPaymentTransactionsForOrders(
  supabase: BCareSupabaseClient,
  orderIds: string[],
) {
  if (orderIds.length === 0) {
    return {
      data: [] satisfies ProductPaymentTransaction[],
      error: null,
    };
  }

  const transactionsResult = await supabase
    .from("product_payment_transactions")
    .select("*")
    .in("product_order_id", orderIds)
    .order("verified_at", { ascending: true });

  return {
    data: transactionsResult.data ?? null,
    error: transactionsResult.error,
  };
}

export async function getCustomerProductOrders(
  supabase: BCareSupabaseClient,
  customerId: string,
) {
  const ordersResult = await supabase
    .from("product_orders")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (ordersResult.error) {
    return {
      data: null,
      error: ordersResult.error,
    };
  }

  const orders = ordersResult.data ?? [];
  const orderIds = orders.map((order) => order.id);

  if (orderIds.length === 0) {
    return {
      data: [] satisfies ProductOrderWithItems[],
      error: null,
    };
  }

  const itemsResult = await supabase
    .from("product_order_items")
    .select("*")
    .in("product_order_id", orderIds)
    .order("created_at", { ascending: true });

  if (itemsResult.error) {
    return {
      data: null,
      error: itemsResult.error,
    };
  }

  const itemsWithProductsResult = await attachProductsToOrderItems(
    supabase,
    itemsResult.data ?? [],
  );

  if (itemsWithProductsResult.error) {
    return {
      data: null,
      error: itemsWithProductsResult.error,
    };
  }

  const paymentsResult = await getProductPaymentsForOrders(supabase, orderIds);

  if (paymentsResult.error) {
    return {
      data: null,
      error: paymentsResult.error,
    };
  }

  const transactionsResult = await getProductPaymentTransactionsForOrders(
    supabase,
    orderIds,
  );

  if (transactionsResult.error) {
    return {
      data: null,
      error: transactionsResult.error,
    };
  }

  return {
    data: buildProductOrdersWithItems(
      orders,
      itemsWithProductsResult.data ?? [],
      paymentsResult.data ?? [],
      transactionsResult.data ?? [],
    ),
    error: null,
  };
}

export async function getCustomerProductOrderById(
  supabase: BCareSupabaseClient,
  customerId: string,
  orderId: string,
) {
  const orderResult = await supabase
    .from("product_orders")
    .select("*")
    .eq("id", orderId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (orderResult.error) {
    return {
      data: null,
      error: orderResult.error,
    };
  }

  if (!orderResult.data) {
    return {
      data: null,
      error: null,
    };
  }

  const itemsResult = await supabase
    .from("product_order_items")
    .select("*")
    .eq("product_order_id", orderResult.data.id)
    .order("created_at", { ascending: true });

  if (itemsResult.error) {
    return {
      data: null,
      error: itemsResult.error,
    };
  }

  const itemsWithProductsResult = await attachProductsToOrderItems(
    supabase,
    itemsResult.data ?? [],
  );

  if (itemsWithProductsResult.error) {
    return {
      data: null,
      error: itemsWithProductsResult.error,
    };
  }

  const paymentsResult = await getProductPaymentsForOrders(supabase, [
    orderResult.data.id,
  ]);

  if (paymentsResult.error) {
    return {
      data: null,
      error: paymentsResult.error,
    };
  }

  const transactionsResult = await getProductPaymentTransactionsForOrders(supabase, [
    orderResult.data.id,
  ]);

  if (transactionsResult.error) {
    return {
      data: null,
      error: transactionsResult.error,
    };
  }

  const transactions = transactionsResult.data ?? [];
  const amountPaid = transactions.reduce(
    (sum, transaction) => sum + transaction.verified_amount,
    0,
  );

  return {
    data: {
      ...orderResult.data,
      amountPaid,
      amountRemaining: Math.max(orderResult.data.total_amount - amountPaid, 0),
      items: itemsWithProductsResult.data ?? [],
      payments: paymentsResult.data ?? [],
      transactions,
    } satisfies ProductOrderWithItems,
    error: null,
  };
}

function getSafePaymentSlipExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "png" || extension === "jpg" || extension === "jpeg") {
    return extension;
  }

  if (file.type === "image/png") {
    return "png";
  }

  return "jpg";
}

export async function submitProductPaymentSlip(
  supabase: BCareSupabaseClient,
  customerId: string,
  input: ProductPaymentSlipInput,
) {
  const orderResult = await supabase
    .from("product_orders")
    .select("*")
    .eq("id", input.orderId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (orderResult.error) {
    return {
      data: null,
      error: orderResult.error,
    };
  }

  if (!orderResult.data) {
    return {
      data: null,
      error: new Error("ไม่พบคำสั่งซื้อของบัญชีนี้"),
    };
  }

  if (orderResult.data.status === "cancelled") {
    return {
      data: null,
      error: new Error("คำสั่งซื้อนี้ถูกยกเลิกแล้ว ไม่สามารถแนบสลิปได้"),
    };
  }

  if (orderResult.data.payment_status === "paid") {
    return {
      data: null,
      error: new Error("คำสั่งซื้อนี้ชำระเงินแล้ว"),
    };
  }

  if (input.amount <= 0) {
    return {
      data: null,
      error: new Error("ยอดเงินบนสลิปต้องมากกว่า 0"),
    };
  }

  // The amount that gets verified with SlipOK is always taken from the
  // order's own total (see the verify-slipok route), never from this
  // client-supplied value. Reject a mismatch here too so a customer who
  // tries to submit a smaller amount than the order total gets told
  // immediately, instead of finding out only when verification silently
  // never covers the full order.
  const amountDifference = Math.abs(
    input.amount - orderResult.data.total_amount,
  );

  if (amountDifference > 0.01) {
    return {
      data: null,
      error: new Error(
        `ยอดเงินต้องตรงกับยอดที่ต้องชำระของคำสั่งซื้อนี้ (${orderResult.data.total_amount.toFixed(2)} บาท)`,
      ),
    };
  }

  if (!input.file.type.startsWith("image/")) {
    return {
      data: null,
      error: new Error("กรุณาแนบไฟล์รูปภาพสลิป"),
    };
  }

  const extension = getSafePaymentSlipExtension(input.file);
  const uploadedPath = `${customerId}/${input.orderId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const uploadResult = await supabase.storage
    .from("payment-slips")
    .upload(uploadedPath, input.file, {
      cacheControl: "3600",
      contentType: input.file.type,
      upsert: false,
    });

  if (uploadResult.error) {
    return {
      data: null,
      error: uploadResult.error,
    };
  }

  const existingPaymentsResult = await supabase
    .from("product_payments")
    .select("*")
    .eq("product_order_id", input.orderId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingPaymentsResult.error) {
    return {
      data: null,
      error: existingPaymentsResult.error,
    };
  }

  const latestPayment = existingPaymentsResult.data?.[0] ?? null;
  const paymentInput = {
    amount: input.amount,
    paid_at: null,
    payment_method: input.paymentMethod,
    payment_status: "pending" as const,
    product_order_id: input.orderId,
    rejected_reason: null,
    slip_amount: input.amount,
    slip_image_url: uploadResult.data.path,
    slip_reference: input.slipReference,
    submitted_at: new Date().toISOString(),
    verification_provider: "slipok" as const,
    verification_response: null,
    verification_status: "submitted" as const,
    verified_at: null,
    verified_by: null,
  };
  const paymentResult =
    latestPayment &&
    (latestPayment.payment_status === "pending" ||
      latestPayment.payment_status === "failed")
      ? await supabase
          .from("product_payments")
          .update(paymentInput)
          .eq("id", latestPayment.id)
          .select("*")
          .single()
      : await supabase
          .from("product_payments")
          .insert(paymentInput)
          .select("*")
          .single();

  if (paymentResult.error) {
    await supabase.storage.from("payment-slips").remove([uploadResult.data.path]);

    return {
      data: null,
      error: paymentResult.error,
    };
  }

  const orderUpdateResult = await supabase
    .from("product_orders")
    .update({ payment_status: "pending" })
    .eq("id", input.orderId);

  if (orderUpdateResult.error) {
    return {
      data: null,
      error: orderUpdateResult.error,
    };
  }

  return {
    data: paymentResult.data,
    error: null,
  };
}
