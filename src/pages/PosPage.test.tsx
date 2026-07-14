import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PosPage from './PosPage';

const loadMagentoCatalog = vi.fn();
const createMagentoPosOrder = vi.fn();

vi.mock('../lib/magentoClient', () => ({
  loadMagentoCatalog: () => loadMagentoCatalog(),
  createMagentoPosOrder: (input: unknown) => createMagentoPosOrder(input),
}));

describe('PosPage', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads Magento stock and builds a branch-aware cart', async () => {
    loadMagentoCatalog.mockResolvedValue({
      ok: true,
      catalog: {
        generated_at: '2026-07-09T00:00:00Z',
        store_code: 'default',
        currency: 'GHS',
        branches: [
          {
            id: 1,
            name: 'Market Circle',
            city: 'Takoradi',
            address: 'Poppet Street',
            phone: '0200000000',
            is_active: true,
            source_code: 'market_circle',
          },
        ],
        products: [
          {
            id: 1,
            sku: 'FUR-001',
            name: 'Nordic Oak Bookshelf',
            price: 295,
            quantity: 25,
            is_salable: true,
            image_url: '',
            source_quantities: [
              { source_code: 'market_circle', quantity: 13, is_salable: true },
              { source_code: 'pipe_ano', quantity: 12, is_salable: true },
            ],
          },
        ],
      },
    });

    render(<PosPage />);

    expect(await screen.findByText('Nordic Oak Bookshelf')).toBeInTheDocument();
    expect(screen.getAllByText('Market Circle').length).toBeGreaterThan(0);
    // Branch-aware stock: the selected branch's own shelf, plus network total.
    expect(screen.getByText('13 at this branch (25 network-wide)')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('pos-add-FUR-001'));

    await waitFor(() => {
      expect(screen.getByText('1 in cart')).toBeInTheDocument();
      expect(screen.getByText('Magento subtotal')).toBeInTheDocument();
    });
    expect(screen.getByTestId('pos-complete-sale')).not.toHaveAttribute('disabled');
  });
});
