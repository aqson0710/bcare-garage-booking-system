import { AdminCustomerDetailPanel } from "@/features/admin/components/admin-customer-detail-panel";

type AdminCustomerDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminCustomerDetailPage({
  params,
}: AdminCustomerDetailPageProps) {
  const { id } = await params;

  return <AdminCustomerDetailPanel customerId={id} />;
}
