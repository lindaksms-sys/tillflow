import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/hooks/useBusiness";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import UpgradeNudge from "@/components/UpgradeNudge";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Minus, ShoppingCart, X, CreditCard, Banknote, Smartphone, RotateCcw, ScanLine, Keyboard, Tag, UserCheck, AlertTriangle, Receipt, Hash } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Product, CartItem, Promotion, SerialItem } from "@/lib/supabase-helpers";
import BarcodeScanner from "@/components/BarcodeScanner";
import ReceiptModal from "@/components/ReceiptModal";

type CreditCustomer = {
  id: string;
  full_name: string;
  credit_limit: number;
  total_outstanding: number;
};

/** Calculate line total with bundle pricing */
function calcLineTotal(item: CartItem): { total: number; bundleCount: number; remainder: number } {
  if (item.usePromo && item.promo) {
    const { bundle_qty, bundle_price } = item.promo;
    const bundleCount = Math.floor(item.quantity / bundle_qty);
    const remainder = item.quantity % bundle_qty;
    const total = bundleCount * bundle_price + remainder * item.product.selling_price - item.discount;
    return { total, bundleCount, remainder };
  }
  return { total: item.product.selling_price * item.quantity - item.discount, bundleCount: 0, remainder: item.quantity };
}

function formatLineLabel(item: CartItem): string | null {
  if (!item.usePromo || !item.promo) return null;
  const { bundleCount, remainder } = calcLineTotal(item);
  const parts: string[] = [];
  if (bundleCount > 0) parts.push(`${bundleCount} × ${item.promo.label}`);
  if (remainder > 0) parts.push(`${remainder} × unit`);
  return parts.join(" + ");
}

export default function Sales() {
  const { user } = useAuth();
  const { businessId, role, isOwner, isManager } = useBusiness();
  const { isFree, allowedPaymentMethods, salesHistoryDays } = usePlanLimits();
  const [tab, setTab] = useState<"pos" | "history">("pos");
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [discountDialog, setDiscountDialog] = useState<{ index: number } | null>(null);
  const [discountValue, setDiscountValue] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualSku, setManualSku] = useState("");
  const [showManualSku, setShowManualSku] = useState(false);
  const [dateFilter, setDateFilter] = useState("");

  // Serial selection state
  const [serialDialog, setSerialDialog] = useState<Product | null>(null);
  const [availableSerials, setAvailableSerials] = useState<SerialItem[]>([]);
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  // Track which serial_item IDs are allocated per cart product
  const [cartSerialMap, setCartSerialMap] = useState<Map<string, string[]>>(new Map());

  // Receipt modal
  const [receiptSale, setReceiptSale] = useState<any | null>(null);

  // History filters
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [staffMembers, setStaffMembers] = useState<{ user_id: string; full_name: string }[]>([]);
  const [creditCustomerSales, setCreditCustomerSales] = useState<Map<string, string[]>>(new Map());
  const [customerSummary, setCustomerSummary] = useState<{ purchased: number; outstanding: number; paid: number } | null>(null);

  // Credit state
  const [creditCustomers, setCreditCustomers] = useState<CreditCustomer[]>([]);
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState<CreditCustomer | null>(null);
  const [creditSearch, setCreditSearch] = useState("");
  const [creditSettings, setCreditSettings] = useState({
    max_cashier_credit_amount: 20,
    require_owner_approval_credit: false,
  });

  useEffect(() => { if (user && businessId) { loadProducts(); loadHistory(); loadCreditData(); loadStaffMembers(); } }, [user, businessId]);

  const loadProducts = async () => {
    const { data } = await supabase.from("products").select("*").eq("business_id", businessId!).order("name");
    setProducts(data || []);
    const { data: promos } = await supabase.from("promotions").select("*").eq("is_active", true).eq("business_id", businessId!);
    setPromotions(promos || []);
  };

  const loadHistory = async () => {
    let q = supabase.from("sales").select("*").eq("business_id", businessId!).order("created_at", { ascending: false }).limit(50);
    if (dateFilter) {
      q = q.gte("created_at", dateFilter + "T00:00:00").lte("created_at", dateFilter + "T23:59:59");
    } else if (salesHistoryDays) {
      // Free plan: limit to last N days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - salesHistoryDays);
      q = q.gte("created_at", cutoff.toISOString());
    }
    if (staffFilter !== "all") {
      q = q.eq("user_id", staffFilter);
    }
    const { data } = await q;
    let sales = data || [];

    // If customer filter is active, filter by credit_sales
    if (customerFilter !== "all") {
      const { data: cs } = await supabase
        .from("credit_sales")
        .select("sale_id, amount, amount_paid")
        .eq("business_id", businessId!)
        .eq("customer_id", customerFilter);
      const saleIds = new Set((cs || []).map(c => c.sale_id).filter(Boolean));
      sales = sales.filter(s => saleIds.has(s.id));
      const purchased = (cs || []).reduce((s, c) => s + Number(c.amount), 0);
      const paid = (cs || []).reduce((s, c) => s + Number(c.amount_paid), 0);
      setCustomerSummary({ purchased, outstanding: purchased - paid, paid });
    } else {
      setCustomerSummary(null);
    }

    setSalesHistory(sales);
  };

  const loadStaffMembers = async () => {
    const { data } = await supabase
      .from("business_members")
      .select("user_id, full_name")
      .eq("business_id", businessId!)
      .eq("is_active", true)
      .order("full_name");
    setStaffMembers(data || []);
  };

  const loadCreditData = async () => {
    const { data: customers } = await supabase
      .from("credit_customers")
      .select("id, full_name, credit_limit, total_outstanding")
      .eq("business_id", businessId!)
      .eq("is_active", true)
      .order("full_name");
    setCreditCustomers((customers as CreditCustomer[]) || []);

    const { data: bp } = await supabase
      .from("business_profiles")
      .select("max_cashier_credit_amount, require_owner_approval_credit")
      .eq("id", businessId!)
      .single();
    if (bp) setCreditSettings(bp as any);
  };

  useEffect(() => { if (user && businessId) loadHistory(); }, [dateFilter, customerFilter, staffFilter]);

  const getActivePromo = (productId: string): Promotion | null => {
    return promotions.find(p => p.product_id === productId) || null;
  };

  const addToCart = async (p: Product) => {
    const trackingType = (p as any).tracking_type || "none";

    if (trackingType === "serial") {
      // Open serial selection dialog
      const { data } = await supabase
        .from("serial_items")
        .select("*")
        .eq("product_id", p.id)
        .eq("status", "in_stock")
        .order("received_at", { ascending: true });
      const available = (data as any[]) || [];
      // Exclude already-allocated serials
      const alreadyAllocated = cartSerialMap.get(p.id) || [];
      const filtered = available.filter(s => !alreadyAllocated.includes(s.id));
      if (filtered.length === 0) {
        toast.error("No serial numbers available in stock");
        return;
      }
      setAvailableSerials(filtered);
      setSelectedSerials([]);
      setSerialDialog(p);
      return;
    }

    if (trackingType === "batch") {
      // Auto-pick FIFO: just add to cart, we'll resolve batches at sale time
      const promo = getActivePromo(p.id);
      setCart(prev => {
        const idx = prev.findIndex(c => c.product.id === p.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          return next;
        }
        return [...prev, { product: p, quantity: 1, discount: 0, usePromo: !!promo, promo }];
      });
      return;
    }

    // Non-tracked: normal add
    const promo = getActivePromo(p.id);
    setCart(prev => {
      const idx = prev.findIndex(c => c.product.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { product: p, quantity: 1, discount: 0, usePromo: !!promo, promo }];
    });
  };

  const confirmSerialSelection = () => {
    if (!serialDialog || selectedSerials.length === 0) return;
    const promo = getActivePromo(serialDialog.id);
    const qty = selectedSerials.length;

    setCart(prev => {
      const idx = prev.findIndex(c => c.product.id === serialDialog.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [...prev, { product: serialDialog, quantity: qty, discount: 0, usePromo: !!promo, promo }];
    });

    // Track allocated serials
    setCartSerialMap(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(serialDialog.id) || [];
      newMap.set(serialDialog.id, [...existing, ...selectedSerials]);
      return newMap;
    });

    setSerialDialog(null);
    setSelectedSerials([]);
  };

  const updateQty = (idx: number, delta: number) => {
    setCart(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: Math.max(1, next[idx].quantity + delta) };
      return next;
    });
  };

  const togglePromo = (idx: number) => {
    setCart(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], usePromo: !next[idx].usePromo };
      return next;
    });
  };

  const removeFromCart = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));

  const applyDiscount = () => {
    if (discountDialog === null) return;
    setCart(prev => {
      const next = [...prev];
      next[discountDialog.index] = { ...next[discountDialog.index], discount: Number(discountValue) || 0 };
      return next;
    });
    setDiscountDialog(null);
    setDiscountValue("");
  };

  const total = cart.reduce((s, c) => s + calcLineTotal(c).total, 0);

  // Credit validation
  const isCreditSale = paymentMethod === "credit";
  const creditLimitExceeded = isCreditSale && selectedCreditCustomer
    ? (selectedCreditCustomer.total_outstanding + total) > selectedCreditCustomer.credit_limit
    : false;
  const cashierOverLimit = isCreditSale && role === "cashier" && total > creditSettings.max_cashier_credit_amount;
  const needsApproval = isCreditSale && (
    creditSettings.require_owner_approval_credit && role === "cashier"
  );
  const creditBlocked = isCreditSale && (
    !selectedCreditCustomer || creditLimitExceeded || cashierOverLimit || needsApproval
  );

  const confirmSale = async () => {
    if (!user || cart.length === 0 || !businessId) return;
    if (isCreditSale && creditBlocked) return;

    const { data: sale, error } = await supabase.from("sales").insert({
      user_id: user.id, payment_method: paymentMethod, total_amount: total, is_voided: false, business_id: businessId,
    }).select().single();

    if (error || !sale) { toast.error("Failed"); return; }

    const items = cart.map(c => {
      const line = calcLineTotal(c);
      const effectiveUnitPrice = c.quantity > 0 ? (line.total + c.discount) / c.quantity : c.product.selling_price;
      return {
        sale_id: sale.id, product_id: c.product.id, quantity: c.quantity,
        unit_price: effectiveUnitPrice, discount_amount: c.discount,
        promo_label: c.usePromo && c.promo ? formatLineLabel(c) || c.promo.label : null,
      };
    });
    await supabase.from("sale_items").insert(items as any);

    // If credit sale, use server-side RPC for validation and insertion
    if (isCreditSale && selectedCreditCustomer) {
      const { error: creditError } = await supabase.rpc("record_credit_sale" as any, {
        _customer_id: selectedCreditCustomer.id,
        _sale_id: sale.id,
        _amount: total,
        _due_date: null,
      });
      if (creditError) {
        toast.error(creditError.message || "Credit sale failed");
        // Sale was already inserted, but credit recording failed — notify user
        console.error("Credit sale RPC error:", creditError);
      }
    }

    // Deduct stock and mark serial items as sold
    for (const c of cart) {
      const trackingType = (c.product as any).tracking_type || "none";

      if (trackingType === "serial") {
        // Mark allocated serials as sold
        const allocatedIds = cartSerialMap.get(c.product.id) || [];
        for (const sid of allocatedIds) {
          await supabase.from("serial_items").update({
            status: "sold", sale_id: sale.id, sold_at: new Date().toISOString(),
          } as any).eq("id", sid);
        }
      } else if (trackingType === "batch") {
        // FIFO: pick oldest in-stock batch items
        const { data: batchItems } = await supabase
          .from("serial_items")
          .select("id")
          .eq("product_id", c.product.id)
          .eq("status", "in_stock")
          .order("received_at", { ascending: true })
          .limit(c.quantity);
        for (const bi of batchItems || []) {
          await supabase.from("serial_items").update({
            status: "sold", sale_id: sale.id, sold_at: new Date().toISOString(),
          } as any).eq("id", (bi as any).id);
        }
      }

      const { data: sl } = await supabase.from("stock_levels").select("quantity").eq("product_id", c.product.id).single();
      if (sl) {
        await supabase.from("stock_levels").update({
          quantity: Math.max(0, sl.quantity - c.quantity), last_updated: new Date().toISOString(),
        }).eq("product_id", c.product.id);
      }
    }

    toast.success(`${isCreditSale ? "Credit " : ""}Sale: $${total.toFixed(2)}`);

    // Show receipt immediately after sale
    setReceiptSale({ ...sale, sale_items: items.map((item, i) => ({ ...item, products: cart[i].product })) });

    setCart([]);
    setCartSerialMap(new Map());
    setSelectedCreditCustomer(null);
    setCreditSearch("");
    loadHistory();
    if (isCreditSale) loadCreditData();
  };

  const voidSale = async (saleId: string) => {
    const { data: items } = await supabase.from("sale_items").select("product_id, quantity").eq("sale_id", saleId);
    for (const item of items || []) {
      const { data: sl } = await supabase.from("stock_levels").select("quantity").eq("product_id", item.product_id).single();
      if (sl) {
        await supabase.from("stock_levels").update({
          quantity: sl.quantity + item.quantity, last_updated: new Date().toISOString(),
        }).eq("product_id", item.product_id);
      }
    }
    await supabase.from("sales").update({ is_voided: true }).eq("id", saleId);
    toast.success("Sale voided, stock restored");
    loadHistory();
  };

  const filteredProducts = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));
  const filteredCreditCustomers = creditCustomers.filter(c =>
    !creditSearch || c.full_name.toLowerCase().includes(creditSearch.toLowerCase())
  );

  const paymentIcons: Record<string, any> = { cash: Banknote, card: CreditCard, mobile_money: Smartphone, credit: UserCheck };

  return (
    <div className="page-container">
      <PageHeader title="Sales" />

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("pos")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === "pos" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>POS</button>
        <button onClick={() => setTab("history")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === "history" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>History</button>
      </div>

      {tab === "pos" ? (
        <>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="input-dark pl-9 h-9" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button size="sm" variant="outline" onClick={() => setScannerOpen(true)}><ScanLine className="w-4 h-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setShowManualSku(v => !v)}><Keyboard className="w-4 h-4" /></Button>
          </div>

          {showManualSku && (
            <form
              className="flex gap-2 mb-3"
              onSubmit={e => {
                e.preventDefault();
                const code = manualSku.trim();
                if (!code) return;
                const found = products.find(p => p.sku === code);
                if (found) { addToCart(found); toast.success(`Added: ${found.name}`); }
                else toast.error(`No product with SKU "${code}"`);
                setManualSku("");
              }}
            >
              <Input className="input-dark h-9 flex-1" placeholder="Enter SKU manually…" value={manualSku} onChange={e => setManualSku(e.target.value)} autoFocus />
              <Button size="sm" type="submit">Go</Button>
            </form>
          )}

          {search && (
            <div className="glass-card mb-3 max-h-40 overflow-y-auto divide-y divide-border">
              {filteredProducts.slice(0, 8).map(p => {
                const promo = getActivePromo(p.id);
                return (
                  <button key={p.id} onClick={() => { addToCart(p); setSearch(""); }} className="w-full flex justify-between items-center p-3 hover:bg-muted/50 transition-colors text-left">
                    <div>
                      <span className="text-sm">{p.name}</span>
                      {promo && <Badge variant="secondary" className="ml-2 text-[10px]"><Tag className="w-3 h-3 mr-0.5" />{promo.label}</Badge>}
                    </div>
                    <span className="text-sm text-muted-foreground">${Number(p.selling_price).toFixed(2)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {cart.length > 0 && (
            <div className="glass-card p-3 mb-3 space-y-2">
              {cart.map((c, i) => {
                const line = calcLineTotal(c);
                const promoLabel = formatLineLabel(c);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{c.product.name}</p>
                        {c.discount > 0 && <p className="text-[10px] text-warning">-${c.discount.toFixed(2)} discount</p>}
                        {promoLabel && <p className="text-[10px] text-primary">{c.product.name} ×{c.quantity} ({promoLabel})</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(i, -1)} className="p-1 text-muted-foreground hover:text-foreground"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="text-sm w-6 text-center tabular-nums">{c.quantity}</span>
                        <button onClick={() => updateQty(i, 1)} className="p-1 text-muted-foreground hover:text-foreground"><Plus className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { setDiscountValue(String(c.discount || "")); setDiscountDialog({ index: i }); }} className="text-[10px] text-muted-foreground underline ml-1">%</button>
                        <button onClick={() => removeFromCart(i)} className="p-1 text-muted-foreground hover:text-destructive ml-1"><X className="w-3.5 h-3.5" /></button>
                      </div>
                      <span className="text-sm font-medium tabular-nums w-16 text-right">${line.total.toFixed(2)}</span>
                    </div>
                    {c.promo && (
                      <button
                        onClick={() => togglePromo(i)}
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                          c.usePromo ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                        }`}
                      >
                        <Tag className="w-3 h-3" />
                        {c.promo.label} {c.usePromo ? "✓" : "off"}
                      </button>
                    )}
                  </div>
                );
              })}
              <div className="border-t border-border pt-2 flex justify-between items-center">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-lg font-bold tabular-nums">${total.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Payment method selection */}
          <div className="flex gap-2 mb-3">
            {(["cash", "card", "mobile_money", "credit"] as const).map(m => {
              const Icon = paymentIcons[m];
              const locked = !allowedPaymentMethods.includes(m);
              return (
                <button key={m} onClick={() => { if (locked) return; setPaymentMethod(m); if (m !== "credit") setSelectedCreditCustomer(null); }}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border transition-colors ${
                    locked ? "border-border/50 text-muted-foreground/40 cursor-not-allowed opacity-50" :
                    paymentMethod === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}>
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] capitalize">{m.replace("_", " ")}</span>
                </button>
              );
            })}
          </div>
          {isFree && <UpgradeNudge message="Free plan: cash only. Upgrade for card, mobile money & credit." className="mb-3" />}

          {/* Credit customer selection */}
          {isCreditSale && (
            <div className="glass-card p-3 mb-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Credit Customer</p>
              <Input
                className="input-dark h-8 text-sm"
                placeholder="Search customer name..."
                value={creditSearch}
                onChange={e => setCreditSearch(e.target.value)}
              />
              {creditSearch && !selectedCreditCustomer && (
                <div className="max-h-32 overflow-y-auto divide-y divide-border rounded-lg border border-border">
                  {filteredCreditCustomers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCreditCustomer(c); setCreditSearch(c.full_name); }}
                      className="w-full flex justify-between items-center p-2 hover:bg-muted/50 text-left text-sm"
                    >
                      <span>{c.full_name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">${c.total_outstanding.toFixed(2)} / ${c.credit_limit.toFixed(2)}</span>
                    </button>
                  ))}
                  {filteredCreditCustomers.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">No customers found</p>
                  )}
                </div>
              )}
              {selectedCreditCustomer && (
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{selectedCreditCustomer.full_name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Outstanding: ${selectedCreditCustomer.total_outstanding.toFixed(2)} / Limit: ${selectedCreditCustomer.credit_limit.toFixed(2)}
                    </p>
                  </div>
                  <button onClick={() => { setSelectedCreditCustomer(null); setCreditSearch(""); }} className="text-muted-foreground hover:text-destructive">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Warnings */}
              {creditLimitExceeded && (
                <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg text-destructive text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Credit limit exceeded. Owner approval required.
                </div>
              )}
              {cashierOverLimit && (
                <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg text-destructive text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Amount exceeds cashier credit limit (${creditSettings.max_cashier_credit_amount.toFixed(2)}). Requires manager/owner approval.
                </div>
              )}
              {needsApproval && (
                <div className="flex items-center gap-2 p-2 bg-warning/10 rounded-lg text-warning text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Owner approval required for all credit sales.
                </div>
              )}
            </div>
          )}

          <Button
            className="w-full"
            disabled={cart.length === 0 || (isCreditSale && creditBlocked)}
            onClick={confirmSale}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {isCreditSale && (isOwner || isManager) ? "Approve & Record Credit Sale" : "Confirm Sale"}
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            <Input type="date" className="input-dark h-9" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
            <div className="flex gap-2">
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="h-9 flex-1 text-sm">
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {creditCustomers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(isOwner || isManager) && (
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger className="h-9 flex-1 text-sm">
                    <SelectValue placeholder="All Staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Staff</SelectItem>
                    {staffMembers.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {customerSummary && customerFilter !== "all" && (
            <div className="glass-card p-3 mb-3 flex justify-between text-xs">
              <span>Purchased: <strong className="tabular-nums">${customerSummary.purchased.toFixed(2)}</strong></span>
              <span>Outstanding: <strong className="tabular-nums text-destructive">${customerSummary.outstanding.toFixed(2)}</strong></span>
              <span>Paid: <strong className="tabular-nums text-primary">${customerSummary.paid.toFixed(2)}</strong></span>
            </div>
          )}

          <div className="space-y-2">
            {salesHistory.map(s => (
              <button
                key={s.id}
                onClick={() => setReceiptSale(s)}
                className={`w-full glass-card p-3 text-left transition-colors hover:bg-muted/50 ${s.is_voided ? "opacity-50" : ""}`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <p className="text-sm font-medium tabular-nums">${Number(s.total_amount).toFixed(2)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                      {s.payment_method.replace("_", " ")} · {format(new Date(s.created_at), "MMM d, HH:mm")}
                    </p>
                  </div>
                  {s.is_voided ? (
                    <span className="text-xs text-destructive font-medium">Voided</span>
                  ) : (isOwner || isManager) ? (
                    <button
                      onClick={e => { e.stopPropagation(); voidSale(s.id); }}
                      className="p-2 text-muted-foreground hover:text-destructive"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              </button>
            ))}
            {salesHistory.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No sales</p>}
          </div>
        </>
      )}

      <Dialog open={discountDialog !== null} onOpenChange={() => setDiscountDialog(null)}>
        <DialogContent className="bg-card border-border max-w-xs">
          <DialogHeader><DialogTitle>Apply Discount ($)</DialogTitle></DialogHeader>
          <Input className="input-dark" type="number" placeholder="0.00" value={discountValue} onChange={e => setDiscountValue(e.target.value)} />
          <Button className="w-full" onClick={applyDiscount}>Apply</Button>
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          const found = products.find(p => p.sku === code);
          if (found) { addToCart(found); toast.success(`Added: ${found.name}`); }
          else toast.error(`No product with SKU "${code}"`);
        }}
      />

      <ReceiptModal
        open={!!receiptSale}
        onClose={() => setReceiptSale(null)}
        sale={receiptSale}
      />

      {/* Serial number selection dialog */}
      <Dialog open={serialDialog !== null} onOpenChange={() => setSerialDialog(null)}>
        <DialogContent className="bg-card border-border max-w-sm max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Select Serial Numbers — {serialDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{availableSerials.length} available. Select which to sell:</p>
            <div className="max-h-52 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {availableSerials.map(si => (
                <label key={si.id} className="flex items-center gap-2 text-xs cursor-pointer py-1.5 hover:bg-muted/30 px-2 rounded">
                  <input
                    type="checkbox"
                    checked={selectedSerials.includes(si.id)}
                    onChange={e => {
                      setSelectedSerials(prev =>
                        e.target.checked ? [...prev, si.id] : prev.filter(id => id !== si.id)
                      );
                    }}
                    className="rounded"
                  />
                  <Hash className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono">{si.serial_number}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{selectedSerials.length} selected</p>
            <Button className="w-full" disabled={selectedSerials.length === 0} onClick={confirmSerialSelection}>
              Add {selectedSerials.length} to Cart
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
