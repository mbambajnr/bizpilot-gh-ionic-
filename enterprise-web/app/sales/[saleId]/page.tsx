import { EnterpriseInvoice } from '@/components/enterprise-invoice';

import '../../enterprise-preview/preview.css';

export default async function SalePage({ params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  return <EnterpriseInvoice saleId={saleId} />;
}
