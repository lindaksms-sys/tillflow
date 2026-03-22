import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/hooks/useBusiness";
import PageHeader from "@/components/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ArrowDownUp, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type StockRow = {
  product_id: string;
  product_name: string;
  quantity: number;
  reorder_threshold: number;
  category: string;
  business_type: string;
};

export default function Stock() {
  const { user } = useAuth();
  const { businessId } = useBusiness();
  const [items, setItems] = useState<StockRow[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockRow | null>(null);
  const [adjType, setAdjType] = useState("restock");
  const [adjQty, setAdjQty] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    const { data: products } = await supabase.from("products").select("id, name, reorder_threshold, category, business_type");
    const { data: levels } = await supabase.from("stock_levels").select("product_id, quantity");
    const levelMap = Object.fromEntries(levels?.map(l => [l.product_id, l.quantity]) || []);
    setItems(
      (products || []).map(p => ({
        product_id: p.id, product_name: p.name, quantity: levelMap[p.id] ?? 0,
        reorder_threshold: p.reorder_threshold, category: p.category, business_type: p.business_type,
      }))
    );
  };

  const openAdjust = (item: StockRow) => { setSelectedProduct(item); setAdjType("restock"); setAdjQty(""); setAdjNote(""); setDialogOpen(true); };

  const saveAdj = async () => {
    if (!selectedProduct || !adjQty) return;
    const qty = Number(adjQty);
    await supabase.from("stock_adjustments").insert({
      product_id: selectedProduct.product_id, type: adjType, quantity: qty, note: adjNote || null,
    });

    const newQty = adjType === "restock"
      ? selectedProduct.quantity + qty
      : selectedProduct.quantity - Math.abs(qty);

    await supabase.from("stock_levels")
      .update({ quantity: Math.max(0, newQty), last_updated: new Date().toISOString() })
      .eq("product_id", selectedProduct.product_id);

    toast.success("Stock updated");
    setDialogOpen(false);
    load();
  };

  const openHistory = async (item: StockRow) => {
    setSelectedProduct(item);
    const { data } = await supabase.from("stock_adjustments")
      .select("*").eq("product_id", item.product_id).order("created_at", { ascending: false }).limit(20);
    setHistory(data || []);
    setHistoryOpen(true);
  };

  const filtered = items.filter(i => !search || i.product_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-container">
      <PageHeader title="Stock" />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="input-dark pl-9 h-9" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="space-y-2">
        {filtered.map(item => {
          const low = item.quantity <= item.reorder_threshold;
          return (
            <div key={item.product_id} className="glass-card p-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{item.product_name}</p>
                  {low && <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground">{item.category} · Threshold: {item.reorder_threshold}</p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className={`text-sm font-bold tabular-nums ${low ? "text-warning" : "text-foreground"}`}>{item.quantity}</span>
                <button onClick={() => openAdjust(item)} className="p-2 text-muted-foreground hover:text-primary">
                  <ArrowDownUp className="w-4 h-4" />
                </button>
                <button onClick={() => openHistory(item)} className="text-xs text-muted-foreground hover:text-foreground underline">Log</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No products</p>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Adjust: {selectedProduct?.product_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={adjType} onValueChange={setAdjType}>
              <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="restock">Restock (+)</SelectItem>
                <SelectItem value="spoilage">Spoilage (-)</SelectItem>
                <SelectItem value="correction">Correction</SelectItem>
                <SelectItem value="theft">Theft (-)</SelectItem>
              </SelectContent>
            </Select>
            <Input className="input-dark" type="number" placeholder="Quantity" value={adjQty} onChange={e => setAdjQty(e.target.value)} />
            <Textarea className="input-dark" placeholder="Note (optional)" value={adjNote} onChange={e => setAdjNote(e.target.value)} />
            <Button className="w-full" onClick={saveAdj}>Save Adjustment</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="bg-card border-border max-w-sm max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>History: {selectedProduct?.product_name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex justify-between items-center py-2 border-b border-border">
                <div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    h.type === "restock" ? "bg-primary/15 text-primary" :
                    h.type === "spoilage" ? "bg-warning/15 text-warning" :
                    h.type === "theft" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
                  }`}>{h.type}</span>
                  {h.note && <p className="text-xs text-muted-foreground mt-1">{h.note}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums">{h.type === "restock" ? "+" : "-"}{h.quantity}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(h.created_at), "MMM d, HH:mm")}</p>
                </div>
              </div>
            ))}
            {history.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No history</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
