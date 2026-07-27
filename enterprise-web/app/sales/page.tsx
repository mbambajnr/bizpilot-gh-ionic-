import { EnterpriseSales } from '@/components/enterprise-sales';

import '../enterprise-preview/preview.css';

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ action?: string; customer?: string; correctionSourceSaleId?: string }> }) {
  const query = await searchParams;
  return <EnterpriseSales initialCustomerId={query.customer ?? ''} correctionSourceSaleId={query.correctionSourceSaleId ?? ''} initiallyOpenComposer={query.action === 'new' || Boolean(query.correctionSourceSaleId)} />;
}
