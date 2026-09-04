import { getCurrentSession } from "@/lib/session";
import { getCashflowProjection } from "@/lib/cashflow-engine";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { horizon?: string };
}) {
  const session = await getCurrentSession();
  const horizon = Number(searchParams.horizon ?? 90) || 90;

  const projection = await getCashflowProjection(session!.organizationId, { horizonDays: horizon });

  return <DashboardClient projection={projection} horizon={horizon} />;
}
