import { TechnicianWorkOrderDetailPanel } from "@/features/technician/components/technician-work-order-detail-panel";

export default async function TechnicianWorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <TechnicianWorkOrderDetailPanel workOrderId={id} />;
}
