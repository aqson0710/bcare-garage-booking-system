import { CustomerProductOrderReceiptPanel } from "@/features/products/components/customer-product-order-receipt-panel";

export default async function MyProductOrderReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <CustomerProductOrderReceiptPanel orderId={id} />;
}
