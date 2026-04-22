-- BizPilot GH Schema Alignment v2026.04.17
-- Adds multi-item support to invoices and establishes the missing expenses infrastructure.

-- 1. Add items JSONB to invoices/sales
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 2. Create public.expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  note TEXT,
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Add index for performance
CREATE INDEX IF NOT EXISTS expenses_business_id_idx ON public.expenses(business_id);

-- 4. Set RLS for expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage expenses" ON public.expenses;
CREATE POLICY "Owners can manage expenses"
ON public.expenses
FOR ALL
USING (public.user_owns_business(business_id))
WITH CHECK (public.user_owns_business(business_id));
