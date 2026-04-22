export type SocialProofData = {
  activeBusinesses: number;
  totalTransactions: number;
  totalValueProcessed: string; // e.g. "GHS 1.2M"
  topRegions: string[];
  trendingCategory: string;
};

export const currentSocialProof: SocialProofData = {
  activeBusinesses: 124,
  totalTransactions: 15420,
  totalValueProcessed: 'GHS 1.4M',
  topRegions: ['Accra', 'Kumasi', 'Tema'],
  trendingCategory: 'Wholesale Retail',
};
