import { AdminProductOrderDetailPanel } from "@/features/admin/components/admin-product-order-detail-panel";

export default async function AdminProductOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <AdminProductOrderDetailPanel orderId={id} />;
}
