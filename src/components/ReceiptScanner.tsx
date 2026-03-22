import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Camera, Upload, Loader2, Plus, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type ExtractedItem = {
  name: string;
  quantity: number;
  unit_price: number | null;
  matched_product_id: string | null;
  matched_product_name: string | null;
  included: boolean;
};

type Product = { id: string; name: string; cost_price: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};

function fuzzyMatch(needle: string, haystack: string): number {
  const a = needle.toLowerCase().trim();
  const b = haystack.toLowerCase().trim();
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.8;
  const words = a.split(/\s+/);
  const matchCount = words.filter(w => b.includes(w)).length;
  return matchCount / words.length * 0.6;
}

export default function ReceiptScanner({ open, onOpenChange, onComplete }: Props) {
  const { businessId } = useBusiness();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"capture" | "loading" | "confirm">("capture");
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierInfo, setSupplierInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep("capture");
    setExtractedItems([]);
    setSupplierInfo(null);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const loadProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, cost_price")
      .eq("business_id", businessId!);
    return data || [];
  };

  const processImage = async (file: File) => {
    setStep("loading");

    const prods = await loadProducts();
    setProducts(prods);

    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.readAsDataURL(file);
    });

    const mimeType = file.type || "image/jpeg";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("You must be logged in to scan receipts");
        setStep("capture");
        return;
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-receipt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ image_base64: base64, mime_type: mimeType }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Failed to read receipt" }));
        toast.error(errData.error || "Failed to read receipt. Try again.");
        setStep("capture");
        return;
      }

      const parsed = await resp.json();
      setSupplierInfo(parsed.supplier || null);

      const mapped: ExtractedItem[] = (parsed.items || []).map((item: any) => {
        let bestMatch: Product | null = null;
        let bestScore = 0;
        for (const p of prods) {
          const score = fuzzyMatch(item.name, p.name);
          if (score > bestScore && score >= 0.4) {
            bestScore = score;
            bestMatch = p;
          }
        }
        return {
          name: item.name,
          quantity: Number(item.quantity) || 1,
          unit_price: item.unit_price != null ? Number(item.unit_price) : null,
          matched_product_id: bestMatch?.id || null,
          matched_product_name: bestMatch?.name || null,
          included: true,
        };
      });

      setExtractedItems(mapped);
      setStep("confirm");
    } catch (err) {
      console.error("Receipt scan error:", err);
      toast.error("Failed to process receipt");
      setStep("capture");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
    e.target.value = "";
  };

  const updateItem = (idx: number, updates: Partial<ExtractedItem>) => {
    setExtractedItems(prev => prev.map((it, i) => i === idx ? { ...it, ...updates } : it));
  };

  const matchProduct = (idx: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    updateItem(idx, {
      matched_product_id: productId,
      matched_product_name: prod?.name || null,
    });
  };

  const confirmRestock = async () => {
    if (!businessId || !user) return;
    setSaving(true);

    const included = extractedItems.filter(it => it.included && it.matched_product_id);
    
    try {
      for (const item of included) {
        // Insert stock adjustment
        await supabase.from("stock_adjustments").insert({
          product_id: item.matched_product_id!,
          type: "restock",
          quantity: item.quantity,
          note: `Receipt scan${supplierInfo ? ` - ${supplierInfo}` : ""}`,
          business_id: businessId,
        });

        // Update stock level
        const { data: current } = await supabase
          .from("stock_levels")
          .select("quantity")
          .eq("product_id", item.matched_product_id!)
          .single();

        await supabase
          .from("stock_levels")
          .update({
            quantity: (current?.quantity || 0) + item.quantity,
            last_updated: new Date().toISOString(),
          })
          .eq("product_id", item.matched_product_id!);

        // Update cost price if found
        if (item.unit_price != null) {
          await supabase
            .from("products")
            .update({ cost_price: item.unit_price })
            .eq("id", item.matched_product_id!);
        }
      }

      toast.success(`Restocked ${included.length} item${included.length !== 1 ? "s" : ""}`);
      handleClose(false);
      onComplete();
    } catch (err) {
      console.error("Restock error:", err);
      toast.error("Failed to save stock adjustments");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "capture" && "Scan Receipt"}
            {step === "loading" && "Reading Receipt..."}
            {step === "confirm" && "Confirm Restock"}
          </DialogTitle>
        </DialogHeader>

        {step === "capture" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Take a photo or upload an image of a supplier receipt to auto-restock items.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="w-6 h-6" />
                <span className="text-xs">Take Photo</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-6 h-6" />
                <span className="text-xs">Upload Image</span>
              </Button>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Reading receipt...</p>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-3">
            {supplierInfo && (
              <p className="text-xs text-muted-foreground">Supplier: {supplierInfo}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {extractedItems.length} item{extractedItems.length !== 1 ? "s" : ""} found. Match to products and confirm.
            </p>

            <div className="space-y-2">
              {extractedItems.map((item, idx) => {
                const unmatched = !item.matched_product_id;
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border space-y-2 ${
                      unmatched
                        ? "border-warning/50 bg-warning/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        {item.unit_price != null && (
                          <p className="text-[10px] text-muted-foreground">
                            Unit: ${item.unit_price.toFixed(2)}
                          </p>
                        )}
                      </div>
                      <Switch
                        checked={item.included}
                        onCheckedChange={(v) => updateItem(idx, { included: v })}
                      />
                    </div>

                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        className="input-dark w-20 h-8 text-sm"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(idx, { quantity: Number(e.target.value) || 0 })
                        }
                      />
                      <Select
                        value={item.matched_product_id || ""}
                        onValueChange={(v) => matchProduct(idx, v)}
                      >
                        <SelectTrigger className="input-dark h-8 text-xs flex-1">
                          <SelectValue placeholder="Match product..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {unmatched && (
                      <div className="flex items-center gap-1.5 text-warning">
                        <AlertTriangle className="w-3 h-3" />
                        <span className="text-[10px]">No match — select a product or add new</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {extractedItems.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-4">
                No items found on receipt
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("capture")}>
                Rescan
              </Button>
              <Button
                className="flex-1"
                disabled={saving || !extractedItems.some(it => it.included && it.matched_product_id)}
                onClick={confirmRestock}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Confirm Restock
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
