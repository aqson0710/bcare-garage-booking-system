import { AdminProductOrderReceiptPanel } from "@/features/admin/components/admin-product-order-receipt-panel";

export default async function AdminProductOrderReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <AdminProductOrderReceiptPanel orderId={id} />;
}
