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
import { AlertTriangle, ArrowDownUp, Search, ScanLine, ChevronDown, ChevronUp, Hash, Package } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ReceiptScanner from "@/components/ReceiptScanner";
import type { SerialItem } from "@/lib/supabase-helpers";

type StockRow = {
  product_id: string;
  product_name: string;
  quantity: number;
  reorder_threshold: number;
  category: string;
  business_type: string;
  tracking_type: string;
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
  const [receiptOpen, setReceiptOpen] = useState(false);

  // Serial/batch entry state
  const [serialNumbers, setSerialNumbers] = useState(""); // one per line
  const [batchNumber, setBatchNumber] = useState("");
  const [batchExpiry, setBatchExpiry] = useState("");

  // Serial/batch viewer state
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [serialItems, setSerialItems] = useState<SerialItem[]>([]);

  // Damage serial selection
  const [damageSerials, setDamageSerials] = useState<string[]>([]);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    const { data: products } = await supabase.from("products").select("id, name, reorder_threshold, category, business_type, tracking_type");
    const { data: levels } = await supabase.from("stock_levels").select("product_id, quantity");
    const levelMap = Object.fromEntries(levels?.map(l => [l.product_id, l.quantity]) || []);
    setItems(
      (products || []).map(p => ({
        product_id: p.id, product_name: p.name, quantity: levelMap[p.id] ?? 0,
        reorder_threshold: p.reorder_threshold, category: p.category, business_type: p.business_type,
        tracking_type: (p as any).tracking_type || "none",
      }))
    );
  };

  const openAdjust = (item: StockRow) => {
    setSelectedProduct(item);
    setAdjType("restock");
    setAdjQty("");
    setAdjNote("");
    setSerialNumbers("");
    setBatchNumber("");
    setBatchExpiry("");
    setDamageSerials([]);
    setDialogOpen(true);

    // If damage/spoilage on tracked product, load in-stock serials
    if (item.tracking_type !== "none") {
      loadSerialItemsForProduct(item.product_id);
    }
  };

  const loadSerialItemsForProduct = async (productId: string) => {
    const { data } = await supabase
      .from("serial_items")
      .select("*")
      .eq("product_id", productId)
      .order("received_at", { ascending: true });
    setSerialItems((data as any[]) || []);
  };

  const saveAdj = async () => {
    if (!selectedProduct || !businessId) return;

    const isTracked = selectedProduct.tracking_type !== "none";
    const isSerial = selectedProduct.tracking_type === "serial";
    const isBatch = selectedProduct.tracking_type === "batch";

    if (adjType === "restock" && isSerial) {
      // Serial restock: each line is a serial number
      const serials = serialNumbers.split("\n").map(s => s.trim()).filter(Boolean);
      if (serials.length === 0) { toast.error("Enter at least one serial number"); return; }

      // Check for duplicates
      const { data: existing } = await supabase
        .from("serial_items")
        .select("serial_number")
        .eq("product_id", selectedProduct.product_id)
        .in("serial_number", serials);
      const dupes = (existing || []).map(e => (e as any).serial_number);
      if (dupes.length > 0) {
        toast.error(`Duplicate serials: ${dupes.join(", ")}`);
        return;
      }

      const rows = serials.map(sn => ({
        business_id: businessId,
        product_id: selectedProduct.product_id,
        serial_number: sn,
        status: "in_stock",
      }));
      await supabase.from("serial_items").insert(rows as any);

      // Record adjustment
      await supabase.from("stock_adjustments").insert({
        product_id: selectedProduct.product_id, type: "restock", quantity: serials.length,
        note: adjNote || `Serials: ${serials.join(", ")}`, business_id: businessId,
      });

      // Update stock level
      await supabase.from("stock_levels")
        .update({ quantity: selectedProduct.quantity + serials.length, last_updated: new Date().toISOString() })
        .eq("product_id", selectedProduct.product_id);

      toast.success(`${serials.length} serial items restocked`);
    } else if (adjType === "restock" && isBatch) {
      const qty = Number(adjQty);
      if (!batchNumber || !qty || qty <= 0) { toast.error("Enter batch number and quantity"); return; }

      const rows = Array.from({ length: qty }, () => ({
        business_id: businessId,
        product_id: selectedProduct.product_id,
        batch_number: batchNumber,
        expiry_date: batchExpiry || null,
        status: "in_stock",
      }));
      await supabase.from("serial_items").insert(rows as any);

      await supabase.from("stock_adjustments").insert({
        product_id: selectedProduct.product_id, type: "restock", quantity: qty,
        note: adjNote || `Batch: ${batchNumber}${batchExpiry ? `, Exp: ${batchExpiry}` : ""}`,
        business_id: businessId,
      });

      await supabase.from("stock_levels")
        .update({ quantity: selectedProduct.quantity + qty, last_updated: new Date().toISOString() })
        .eq("product_id", selectedProduct.product_id);

      toast.success(`${qty} items restocked (Batch: ${batchNumber})`);
    } else if (["spoilage", "theft"].includes(adjType) && isTracked && damageSerials.length > 0) {
      // Mark selected serials as damaged
      for (const sid of damageSerials) {
        await supabase.from("serial_items").update({ status: "damaged" } as any).eq("id", sid);
      }

      await supabase.from("stock_adjustments").insert({
        product_id: selectedProduct.product_id, type: adjType, quantity: damageSerials.length,
        note: adjNote || null, business_id: businessId,
      });

      const newQty = Math.max(0, selectedProduct.quantity - damageSerials.length);
      await supabase.from("stock_levels")
        .update({ quantity: newQty, last_updated: new Date().toISOString() })
        .eq("product_id", selectedProduct.product_id);

      toast.success(`${damageSerials.length} items marked as ${adjType}`);
    } else {
      // Non-tracked or correction
      const qty = Number(adjQty);
      if (!qty) return;

      await supabase.from("stock_adjustments").insert({
        product_id: selectedProduct.product_id, type: adjType, quantity: qty, note: adjNote || null,
        business_id: businessId,
      });

      const newQty = adjType === "restock"
        ? selectedProduct.quantity + qty
        : selectedProduct.quantity - Math.abs(qty);

      await supabase.from("stock_levels")
        .update({ quantity: Math.max(0, newQty), last_updated: new Date().toISOString() })
        .eq("product_id", selectedProduct.product_id);

      toast.success("Stock updated");
    }

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

  const toggleExpand = async (productId: string) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      return;
    }
    setExpandedProduct(productId);
    await loadSerialItemsForProduct(productId);
  };

  const filtered = items.filter(i => !search || i.product_name.toLowerCase().includes(search.toLowerCase()));
  const inStockSerials = serialItems.filter(s => s.status === "in_stock");

  return (
    <div className="page-container">
      <PageHeader title="Stock" />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="input-dark pl-9 h-9" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setReceiptOpen(true)}>
          <ScanLine className="w-4 h-4" />
          <span className="hidden sm:inline">Scan Receipt</span>
        </Button>
      </div>

      <div className="space-y-2">
        {filtered.map(item => {
          const low = item.quantity <= item.reorder_threshold;
          const isTracked = item.tracking_type !== "none";
          const isExpanded = expandedProduct === item.product_id;
          return (
            <div key={item.product_id} className="glass-card">
              <div className="p-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                    {low && <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />}
                    {isTracked && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {item.tracking_type === "serial" ? "SN" : "Batch"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.category} · Threshold: {item.reorder_threshold}</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className={`text-sm font-bold tabular-nums ${low ? "text-warning" : "text-foreground"}`}>{item.quantity}</span>
                  <button onClick={() => openAdjust(item)} className="p-2 text-muted-foreground hover:text-primary">
                    <ArrowDownUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => openHistory(item)} className="text-xs text-muted-foreground hover:text-foreground underline">Log</button>
                  {isTracked && (
                    <button onClick={() => toggleExpand(item.product_id)} className="p-1 text-muted-foreground hover:text-foreground">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Serial/Batch viewer */}
              {isExpanded && (
                <div className="border-t border-border px-3 py-2 space-y-1 max-h-48 overflow-y-auto">
                  {serialItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No tracked items</p>
                  ) : (
                    serialItems.map(si => (
                      <div key={si.id} className="flex justify-between items-center text-xs py-1">
                        <div className="flex items-center gap-2">
                          {si.serial_number ? (
                            <><Hash className="w-3 h-3 text-muted-foreground" /><span className="font-mono">{si.serial_number}</span></>
                          ) : (
                            <><Package className="w-3 h-3 text-muted-foreground" /><span>{si.batch_number}</span></>
                          )}
                          {si.expiry_date && <span className="text-muted-foreground">exp {si.expiry_date}</span>}
                        </div>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          si.status === "in_stock" ? "bg-primary/15 text-primary" :
                          si.status === "sold" ? "bg-muted text-muted-foreground" :
                          "bg-destructive/15 text-destructive"
                        }`}>{si.status.replace("_", " ")}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No products</p>}
      </div>

      {/* Adjust Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm max-h-[80vh] overflow-y-auto">
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

            {/* Serial restock */}
            {adjType === "restock" && selectedProduct?.tracking_type === "serial" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Enter serial numbers (one per line)</p>
                <Textarea
                  className="input-dark font-mono text-xs"
                  placeholder={"SN-001\nSN-002\nSN-003"}
                  value={serialNumbers}
                  onChange={e => setSerialNumbers(e.target.value)}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  {serialNumbers.split("\n").filter(s => s.trim()).length} serial(s) entered
                </p>
              </div>
            )}

            {/* Batch restock */}
            {adjType === "restock" && selectedProduct?.tracking_type === "batch" && (
              <div className="space-y-2">
                <Input className="input-dark" placeholder="Batch / Lot number" value={batchNumber} onChange={e => setBatchNumber(e.target.value)} />
                <Input className="input-dark" type="date" placeholder="Expiry date (optional)" value={batchExpiry} onChange={e => setBatchExpiry(e.target.value)} />
                <Input className="input-dark" type="number" placeholder="Quantity" value={adjQty} onChange={e => setAdjQty(e.target.value)} />
              </div>
            )}

            {/* Non-tracked or correction qty */}
            {(selectedProduct?.tracking_type === "none" || adjType === "correction") && (
              <Input className="input-dark" type="number" placeholder="Quantity" value={adjQty} onChange={e => setAdjQty(e.target.value)} />
            )}

            {/* Spoilage/theft on tracked products: select which serials */}
            {["spoilage", "theft"].includes(adjType) && selectedProduct?.tracking_type !== "none" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Select items to mark as {adjType}:</p>
                <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                  {inStockSerials.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No in-stock items</p>
                  ) : inStockSerials.map(si => (
                    <label key={si.id} className="flex items-center gap-2 text-xs cursor-pointer py-1 hover:bg-muted/30 px-1 rounded">
                      <input
                        type="checkbox"
                        checked={damageSerials.includes(si.id)}
                        onChange={e => {
                          setDamageSerials(prev =>
                            e.target.checked ? [...prev, si.id] : prev.filter(id => id !== si.id)
                          );
                        }}
                        className="rounded"
                      />
                      <span className="font-mono">{si.serial_number || si.batch_number}</span>
                      {si.expiry_date && <span className="text-muted-foreground">exp {si.expiry_date}</span>}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{damageSerials.length} selected</p>
              </div>
            )}

            {/* Non-tracked spoilage/theft qty */}
            {["spoilage", "theft"].includes(adjType) && selectedProduct?.tracking_type === "none" && (
              <Input className="input-dark" type="number" placeholder="Quantity" value={adjQty} onChange={e => setAdjQty(e.target.value)} />
            )}

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

      <ReceiptScanner open={receiptOpen} onOpenChange={setReceiptOpen} onComplete={load} />
    </div>
  );
}
