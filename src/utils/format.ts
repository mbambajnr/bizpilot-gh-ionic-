export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatRelativeDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-GH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
