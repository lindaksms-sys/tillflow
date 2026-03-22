import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/hooks/useBusiness";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, Trash2, ScanLine, Keyboard, Tag, X } from "lucide-react";
import { toast } from "sonner";
import type { Product, Promotion } from "@/lib/supabase-helpers";
import BarcodeScanner from "@/components/BarcodeScanner";

const categories = ["General", "Beverages", "Food", "Electronics", "Clothing", "Household", "Other"];
const units = ["piece", "kg", "litre", "bottle", "pack", "carton", "dozen"];

export default function Products() {
  const { user } = useAuth();
  const { businessId } = useBusiness();
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [search, setSearch] = useState("");
  const [filterBiz, setFilterBiz] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualSku, setManualSku] = useState("");
  const [showManualSku, setShowManualSku] = useState(false);
  const [form, setForm] = useState({
    name: "", sku: "", category: "General", cost_price: "", selling_price: "",
    unit: "piece", reorder_threshold: "5", business_type: "retail"
  });

  // Promo state
  const [promoDialog, setPromoDialog] = useState<Product | null>(null);
  const [promoForm, setPromoForm] = useState({ label: "", bundle_qty: "", bundle_price: "" });

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts(data || []);
    const { data: promos } = await supabase.from("promotions").select("*");
    setPromotions(promos || []);
  };

  const openNew = () => { setEditing(null); setForm({ name: "", sku: "", category: "General", cost_price: "", selling_price: "", unit: "piece", reorder_threshold: "5", business_type: "retail" }); setDialogOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, sku: p.sku || "", category: p.category, cost_price: String(p.cost_price), selling_price: String(p.selling_price), unit: p.unit, reorder_threshold: String(p.reorder_threshold), business_type: p.business_type });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user || !form.name || !businessId) return;
    const payload = {
      name: form.name, sku: form.sku || null, category: form.category,
      cost_price: Number(form.cost_price) || 0, selling_price: Number(form.selling_price) || 0,
      unit: form.unit, reorder_threshold: Number(form.reorder_threshold) || 5,
      business_type: form.business_type, user_id: user.id, business_id: businessId,
    };

    if (editing) {
      await supabase.from("products").update(payload).eq("id", editing.id);
      toast.success("Product updated");
    } else {
      await supabase.from("products").insert(payload);
      toast.success("Product added");
    }
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("products").delete().eq("id", id);
    toast.success("Product deleted");
    load();
  };

  const addPromo = async () => {
    if (!promoDialog) return;
    const qty = Number(promoForm.bundle_qty);
    const price = Number(promoForm.bundle_price);
    if (!promoForm.label || !qty || qty < 2 || price <= 0) {
      toast.error("Fill in label, qty (≥2) and price");
      return;
    }
    await supabase.from("promotions").insert({
      product_id: promoDialog.id,
      label: promoForm.label,
      bundle_qty: qty,
      bundle_price: price,
    } as any);
    toast.success("Promotion added");
    setPromoForm({ label: "", bundle_qty: "", bundle_price: "" });
    load();
  };

  const removePromo = async (id: string) => {
    await supabase.from("promotions").delete().eq("id", id);
    toast.success("Promotion removed");
    load();
  };

  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.sku || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterBiz !== "all" && p.business_type !== filterBiz) return false;
    if (filterCat !== "all" && p.category !== filterCat) return false;
    return true;
  });

  const getProductPromos = (productId: string) => promotions.filter(pr => pr.product_id === productId && pr.is_active);

  return (
    <div className="page-container">
      <PageHeader title="Products" />

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="input-dark pl-9 h-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" onClick={() => setScannerOpen(true)}><ScanLine className="w-4 h-4" /></Button>
        <Button size="sm" variant="outline" onClick={() => setShowManualSku(v => !v)}><Keyboard className="w-4 h-4" /></Button>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" /></Button>
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
              openEdit(found);
              toast.info(`Found: ${found.name}`);
            } else {
              setEditing(null);
              setForm({ name: "", sku: code, category: "General", cost_price: "", selling_price: "", unit: "piece", reorder_threshold: "5", business_type: "retail" });
              setDialogOpen(true);
              toast.info(`SKU "${code}" not found — add new product`);
            }
            setManualSku("");
            setShowManualSku(false);
          }}
        >
          <Input className="input-dark h-9 flex-1" placeholder="Enter SKU manually…" value={manualSku} onChange={e => setManualSku(e.target.value)} autoFocus />
          <Button size="sm" type="submit">Go</Button>
        </form>
      )}

      <div className="flex gap-2 mb-4">
        <Select value={filterBiz} onValueChange={setFilterBiz}>
          <SelectTrigger className="input-dark h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="retail">Retail</SelectItem>
            <SelectItem value="bar">Bar</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="input-dark h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.map(p => {
          const promos = getProductPromos(p.id);
          return (
            <div key={p.id} className="glass-card p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category} · {p.business_type} · ${Number(p.selling_price).toFixed(2)}</p>
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => { setPromoDialog(p); setPromoForm({ label: "", bundle_qty: "", bundle_price: "" }); }} className="p-2 text-muted-foreground hover:text-foreground"><Tag className="w-4 h-4" /></button>
                  <button onClick={() => openEdit(p)} className="p-2 text-muted-foreground hover:text-foreground"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => remove(p.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {promos.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {promos.map(pr => (
                    <Badge key={pr.id} variant="secondary" className="text-[10px]">
                      <Tag className="w-3 h-3 mr-1" />{pr.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No products found</p>}
      </div>

      {/* Product Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input className="input-dark" placeholder="Product name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Input className="input-dark" placeholder="SKU (optional)" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.business_type} onValueChange={v => setForm({ ...form, business_type: v })}>
                <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input className="input-dark" type="number" placeholder="Cost price" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} />
              <Input className="input-dark" type="number" placeholder="Selling price" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}>
                <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
                <SelectContent>{units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
              <Input className="input-dark" type="number" placeholder="Reorder threshold" value={form.reorder_threshold} onChange={e => setForm({ ...form, reorder_threshold: e.target.value })} />
            </div>
            <Button className="w-full" onClick={save}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Promotions Dialog */}
      <Dialog open={promoDialog !== null} onOpenChange={() => setPromoDialog(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Promotions — {promoDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Existing promos */}
            {promotions.filter(pr => pr.product_id === promoDialog?.id).map(pr => (
              <div key={pr.id} className="flex items-center justify-between glass-card p-2">
                <div>
                  <p className="text-sm font-medium">{pr.label}</p>
                  <p className="text-xs text-muted-foreground">{pr.bundle_qty} for ${Number(pr.bundle_price).toFixed(2)}{!pr.is_active && " (inactive)"}</p>
                </div>
                <button onClick={() => removePromo(pr.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
              </div>
            ))}

            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Add bundle deal</p>
              <Input className="input-dark" placeholder='Label, e.g. "3 for $1"' value={promoForm.label} onChange={e => setPromoForm({ ...promoForm, label: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input className="input-dark" type="number" placeholder="Bundle qty" value={promoForm.bundle_qty} onChange={e => setPromoForm({ ...promoForm, bundle_qty: e.target.value })} />
                <Input className="input-dark" type="number" placeholder="Bundle price" value={promoForm.bundle_price} onChange={e => setPromoForm({ ...promoForm, bundle_price: e.target.value })} />
              </div>
              <Button className="w-full" size="sm" onClick={addPromo}><Plus className="w-4 h-4 mr-1" /> Add Promotion</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          const found = products.find(p => p.sku === code);
          if (found) {
            openEdit(found);
            toast.info(`Found: ${found.name}`);
          } else {
            setEditing(null);
            setForm({ name: "", sku: code, category: "General", cost_price: "", selling_price: "", unit: "piece", reorder_threshold: "5", business_type: "retail" });
            setDialogOpen(true);
            toast.info(`SKU "${code}" not found — add new product`);
          }
        }}
      />
    </div>
  );
}
