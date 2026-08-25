import { CustomerProductOrderDetailPanel } from "@/features/products/components/customer-product-order-detail-panel";

export default async function MyProductOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <CustomerProductOrderDetailPanel orderId={id} />;
}
