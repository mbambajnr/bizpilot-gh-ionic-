import { EnterpriseWaybill } from '@/components/enterprise-waybill';

import '../../../enterprise-preview/preview.css';

export default async function WaybillPage({ params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  return <EnterpriseWaybill saleId={saleId} />;
}
