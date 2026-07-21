import { EnterpriseQuotationDocument } from '@/components/enterprise-quotation-document';

import '../../enterprise-preview/preview.css';

export default async function QuotationPage({ params }: { params: Promise<{ quotationId: string }> }) {
  const { quotationId } = await params;
  return <EnterpriseQuotationDocument quotationId={quotationId} />;
}
