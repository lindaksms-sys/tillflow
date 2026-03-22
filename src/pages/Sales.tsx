import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/hooks/useBusiness";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, Minus, ShoppingCart, X, CreditCard, Banknote, Smartphone, RotateCcw, ScanLine, Keyboard, Tag } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Product, CartItem, Promotion } from "@/lib/supabase-helpers";
import BarcodeScanner from "@/components/BarcodeScanner";

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
  const { businessId } = useBusiness();
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

  useEffect(() => { if (user) { loadProducts(); loadHistory(); } }, [user]);

  const loadProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("name");
    setProducts(data || []);
    const { data: promos } = await supabase.from("promotions").select("*").eq("is_active", true);
    setPromotions(promos || []);
  };

  const loadHistory = async () => {
    let q = supabase.from("sales").select("*").order("created_at", { ascending: false }).limit(50);
    if (dateFilter) {
      q = q.gte("created_at", dateFilter + "T00:00:00").lte("created_at", dateFilter + "T23:59:59");
    }
    const { data } = await q;
    setSalesHistory(data || []);
  };

  useEffect(() => { if (user) loadHistory(); }, [dateFilter]);

  const getActivePromo = (productId: string): Promotion | null => {
    return promotions.find(p => p.product_id === productId) || null;
  };

  const addToCart = (p: Product) => {
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

  const confirmSale = async () => {
    if (!user || cart.length === 0) return;
    const { data: sale, error } = await supabase.from("sales").insert({
      user_id: user.id, payment_method: paymentMethod, total_amount: total, is_voided: false,
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

    // Deduct stock
    for (const c of cart) {
      const { data: sl } = await supabase.from("stock_levels").select("quantity").eq("product_id", c.product.id).single();
      if (sl) {
        await supabase.from("stock_levels").update({
          quantity: Math.max(0, sl.quantity - c.quantity), last_updated: new Date().toISOString(),
        }).eq("product_id", c.product.id);
      }
    }

    toast.success(`Sale: $${total.toFixed(2)}`);
    setCart([]);
    loadHistory();
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

  const paymentIcons: Record<string, any> = { cash: Banknote, card: CreditCard, mobile_money: Smartphone };

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
                if (found) {
                  addToCart(found);
                  toast.success(`Added: ${found.name}`);
                } else {
                  toast.error(`No product with SKU "${code}"`);
                }
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
                          c.usePromo
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground"
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

          <div className="flex gap-2 mb-3">
            {(["cash", "card", "mobile_money"] as const).map(m => {
              const Icon = paymentIcons[m];
              return (
                <button key={m} onClick={() => setPaymentMethod(m)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border transition-colors ${
                    paymentMethod === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}>
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] capitalize">{m.replace("_", " ")}</span>
                </button>
              );
            })}
          </div>

          <Button className="w-full" disabled={cart.length === 0} onClick={confirmSale}>
            <ShoppingCart className="w-4 h-4 mr-2" /> Confirm Sale
          </Button>
        </>
      ) : (
        <>
          <Input type="date" className="input-dark mb-3 h-9" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          <div className="space-y-2">
            {salesHistory.map(s => (
              <div key={s.id} className={`glass-card p-3 ${s.is_voided ? "opacity-50" : ""}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium tabular-nums">${Number(s.total_amount).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{s.payment_method.replace("_", " ")} · {format(new Date(s.created_at), "MMM d, HH:mm")}</p>
                  </div>
                  {s.is_voided ? (
                    <span className="text-xs text-destructive font-medium">Voided</span>
                  ) : (
                    <button onClick={() => voidSale(s.id)} className="p-2 text-muted-foreground hover:text-destructive">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
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
          if (found) {
            addToCart(found);
            toast.success(`Added: ${found.name}`);
          } else {
            toast.error(`No product with SKU "${code}"`);
          }
        }}
      />
    </div>
  );
}
