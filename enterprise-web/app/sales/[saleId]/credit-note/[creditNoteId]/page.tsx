import { EnterpriseCreditNote } from '@/components/enterprise-credit-note';

import '../../../../enterprise-preview/preview.css';

export default async function CreditNotePage({ params }: { params: Promise<{ saleId: string; creditNoteId: string }> }) {
  const { saleId, creditNoteId } = await params;
  return <EnterpriseCreditNote saleId={saleId} creditNoteId={creditNoteId} />;
}
