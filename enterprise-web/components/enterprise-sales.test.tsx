import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { seedState } from '../../src/data/seedBusiness';
import { EnterpriseSales } from './enterprise-sales';

const mockUseBusiness = vi.fn();

vi.mock('../../src/context/BusinessContext', () => ({
  useBusiness: () => mockUseBusiness(),
}));

vi.mock('./enterprise-app', () => ({ EnterpriseApp: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('./enterprise-shell', () => ({ EnterpriseShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const addSale = vi.fn<[Record<string, unknown>], { ok: boolean; receipt: { id: string; receiptId: string; totalAmount: number } }>(() => ({ ok: true, receipt: { id: 's-1', receiptId: 'RCT-1', totalAmount: 10 } }));

function buildContext(overrides: Partial<typeof seedState> = {}) {
  return {
    state: { ...seedState, ...overrides },
    currentUser: { userId: 'u-1', name: 'Owner', email: 'o@e.com', role: 'Admin', grantedPermissions: [], revokedPermissions: [] },
    hasPermission: (permission: string) => permission === 'sales.create',
    addSale,
    convertQuotationToSale: vi.fn(),
    reverseSale: vi.fn(),
  };
}

function renderComposer(context = buildContext()) {
  mockUseBusiness.mockReturnValue(context);
  return render(<EnterpriseSales initiallyOpenComposer />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SaleComposer walk-in customer', () => {
  it('records a sale for an unregistered walk-in using a customer snapshot, not a customer id', () => {
    renderComposer();

    fireEvent.click(screen.getByRole('button', { name: 'Walk-in' }));
    fireEvent.change(screen.getByPlaceholderText('Walk-in customer name'), { target: { value: 'Ama Owusu' } });
    fireEvent.click(screen.getByRole('button', { name: /create invoice/i }));

    expect(addSale).toHaveBeenCalledTimes(1);
    const arg = addSale.mock.calls[0][0];
    expect(arg.customerId).toBeUndefined();
    expect(arg.customerSnapshot).toMatchObject({ name: 'Ama Owusu', source: 'prospect' });
  });

  it('filters the item list as you search instead of listing every product', () => {
    renderComposer();

    const picker = screen.getAllByPlaceholderText('Search item by name or code')[0];
    fireEvent.focus(picker);
    fireEvent.change(picker, { target: { value: 'paracetamol' } });

    const list = screen.getByRole('listbox');
    expect(within(list).getByText('Paracetamol 500mg')).toBeInTheDocument();
    expect(within(list).queryByText('Sunlight Detergent')).not.toBeInTheDocument();
  });

  it('records the item chosen from the search results on the sale line', () => {
    renderComposer();

    const picker = screen.getAllByPlaceholderText('Search item by name or code')[0];
    fireEvent.focus(picker);
    fireEvent.change(picker, { target: { value: 'paracetamol' } });
    fireEvent.mouseDown(within(screen.getByRole('listbox')).getByText('Paracetamol 500mg'));
    fireEvent.click(screen.getByRole('button', { name: /create invoice/i }));

    const arg = addSale.mock.calls[0][0] as { items: { productId: string }[] };
    expect(arg.items[0].productId).toBe('p2');
  });

  it('blocks a walk-in sale with a blank name', () => {
    renderComposer();

    fireEvent.click(screen.getByRole('button', { name: 'Walk-in' }));
    const submit = screen.getByRole('button', { name: /create invoice/i });
    expect(submit).toBeDisabled();
    expect(addSale).not.toHaveBeenCalled();
  });

  it('still records a registered-customer sale with a customer id', () => {
    renderComposer();

    // Registered is the default mode when active customers exist.
    fireEvent.click(screen.getByRole('button', { name: /create invoice/i }));

    expect(addSale).toHaveBeenCalledTimes(1);
    const arg = addSale.mock.calls[0][0];
    expect(typeof arg.customerId).toBe('string');
    expect((arg.customerId as string).length).toBeGreaterThan(0);
    expect(arg.customerSnapshot).toBeUndefined();
  });

  it('defaults to walk-in when there are no active customers, and the registered toggle still responds with a helpful empty state', () => {
    renderComposer(buildContext({ customers: [] }));

    expect(screen.getByPlaceholderText('Walk-in customer name')).toBeInTheDocument();

    const registered = screen.getByRole('button', { name: 'Registered' });
    expect(registered).toBeEnabled();
    fireEvent.click(registered);

    expect(screen.getByText(/no registered customers yet/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Walk-in customer name')).not.toBeInTheDocument();
  });
});
