import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';

// Mock Supabase to avoid resolution or environment issues during tests
// This ensures the test does not depend on real Supabase config/env
vi.mock('./lib/supabase', () => {
  const mockSupa = {
    auth: {
      onAuthStateChange: vi.fn(() => ({ 
        data: { subscription: { unsubscribe: vi.fn() } } 
      })),
      getSession: vi.fn(() => Promise.resolve({ 
        data: { session: null }, 
        error: null 
      })),
    },
  };
  return {
    supabase: mockSupa,
    hasSupabaseConfig: true,
    getSupabaseClient: vi.fn(() => mockSupa),
  };
});

test('renders without crashing', () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeDefined();
});
