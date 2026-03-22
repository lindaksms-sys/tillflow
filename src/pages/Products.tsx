import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit2, Trash2, ScanLine, Keyboard } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/supabase-helpers";
import BarcodeScanner from "@/components/BarcodeScanner";

const categories = ["General", "Beverages", "Food", "Electronics", "Clothing", "Household", "Other"];
const units = ["piece", "kg", "litre", "bottle", "pack", "carton", "dozen"];

export default function Products() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
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

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts(data || []);
  };

  const openNew = () => { setEditing(null); setForm({ name: "", sku: "", category: "General", cost_price: "", selling_price: "", unit: "piece", reorder_threshold: "5", business_type: "retail" }); setDialogOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, sku: p.sku || "", category: p.category, cost_price: String(p.cost_price), selling_price: String(p.selling_price), unit: p.unit, reorder_threshold: String(p.reorder_threshold), business_type: p.business_type });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user || !form.name) return;
    const payload = {
      name: form.name, sku: form.sku || null, category: form.category,
      cost_price: Number(form.cost_price) || 0, selling_price: Number(form.selling_price) || 0,
      unit: form.unit, reorder_threshold: Number(form.reorder_threshold) || 5,
      business_type: form.business_type, user_id: user.id,
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

  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.sku || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterBiz !== "all" && p.business_type !== filterBiz) return false;
    if (filterCat !== "all" && p.category !== filterCat) return false;
    return true;
  });

  return (
    <div className="page-container">
      <PageHeader title="Products" />

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="input-dark pl-9 h-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" onClick={() => setScannerOpen(true)}><ScanLine className="w-4 h-4" /></Button>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" /></Button>
      </div>

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
        {filtered.map(p => (
          <div key={p.id} className="glass-card p-3 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.category} · {p.business_type} · ${Number(p.selling_price).toFixed(2)}</p>
            </div>
            <div className="flex gap-1 ml-2">
              <button onClick={() => openEdit(p)} className="p-2 text-muted-foreground hover:text-foreground"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => remove(p.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No products found</p>}
      </div>

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

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          // Look up product by SKU, or pre-fill SKU in new product form
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
