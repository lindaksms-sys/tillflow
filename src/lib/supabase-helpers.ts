import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  user_id: string;
  name: string;
  sku: string | null;
  category: string;
  cost_price: number;
  selling_price: number;
  unit: string;
  reorder_threshold: number;
  business_type: string;
  created_at: string;
};

export type StockLevel = {
  id: string;
  product_id: string;
  quantity: number;
  last_updated: string;
};

export type StockAdjustment = {
  id: string;
  product_id: string;
  type: string;
  quantity: number;
  note: string | null;
  created_at: string;
};

export type Sale = {
  id: string;
  user_id: string;
  payment_method: string;
  total_amount: number;
  notes: string | null;
  is_voided: boolean;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
};

export type Expense = {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  note: string | null;
  created_at: string;
};

export type Promotion = {
  id: string;
  product_id: string;
  label: string;
  bundle_qty: number;
  bundle_price: number;
  is_active: boolean;
  created_at: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
  discount: number;
  usePromo?: boolean;
  promo?: Promotion | null;
};
