export type BusinessWrappedData = {
  businessName: string;
  monthName: string;
  year: number;
  totalSalesValue: number;
  totalOrders: number;
  topProduct: {
    name: string;
    quantitySold: number;
  };
  newCustomersCount: number;
  efficiencyScore: number; // 0-100
  savedHours: number;
};

export const sampleWrapped2026: BusinessWrappedData = {
  businessName: 'Mama Africa Wholesale',
  monthName: 'April',
  year: 2026,
  totalSalesValue: 45250,
  totalOrders: 184,
  topProduct: {
    name: 'Ghanaian Yam (Large)',
    quantitySold: 742,
  },
  newCustomersCount: 28,
  efficiencyScore: 94,
  savedHours: 22,
};
