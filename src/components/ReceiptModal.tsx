import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { format } from "date-fns";
import { Download, Share2, Copy, X } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

type SaleDetail = {
  id: string;
  user_id: string;
  total_amount: number;
  payment_method: string;
  is_voided: boolean;
  created_at: string;
  notes: string | null;
};

type LineItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  promo_label: string | null;
  product_name: string;
};

type CreditInfo = {
  customer_name: string;
  customer_phone: string | null;
  amount: number;
  amount_paid: number;
  balance: number | null;
  due_date: string | null;
  status: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  sale: SaleDetail | null;
};

export default function ReceiptModal({ open, onClose, sale }: Props) {
  const { businessName, currency } = useBusiness();
  const [items, setItems] = useState<LineItem[]>([]);
  const [cashierName, setCashierName] = useState("");
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cur = currency || "USD";
  const sym = cur === "USD" ? "$" : cur;

  useEffect(() => {
    if (open && sale) loadReceiptData();
    else { setItems([]); setCreditInfo(null); }
  }, [open, sale]);

  const loadReceiptData = async () => {
    if (!sale) return;
    setLoading(true);

    // Load line items with product names
    const { data: saleItems } = await supabase
      .from("sale_items")
      .select("id, product_id, quantity, unit_price, discount_amount, promo_label")
      .eq("sale_id", sale.id);

    if (saleItems && saleItems.length > 0) {
      const productIds = saleItems.map(si => si.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .in("id", productIds);

      const productMap = new Map((products || []).map(p => [p.id, p.name]));
      setItems(saleItems.map(si => ({
        ...si,
        product_name: productMap.get(si.product_id) || "Unknown Product",
      })));
    }

    // Load cashier name
    const { data: member } = await supabase
      .from("business_members")
      .select("full_name")
      .eq("user_id", sale.user_id)
      .maybeSingle();
    setCashierName(member?.full_name || "Staff");

    // Load business logo
    const { data: bp } = await supabase
      .from("business_profiles")
      .select("logo_url")
      .eq("name", businessName!)
      .maybeSingle();
    setLogoUrl(bp?.logo_url || null);

    // If credit sale, load credit info
    if (sale.payment_method === "credit") {
      const { data: cs } = await supabase
        .from("credit_sales")
        .select("amount, amount_paid, balance, due_date, status, customer_id")
        .eq("sale_id", sale.id)
        .maybeSingle();
      if (cs) {
        const { data: cust } = await supabase
          .from("credit_customers")
          .select("full_name, phone")
          .eq("id", cs.customer_id)
          .maybeSingle();
        setCreditInfo({
          customer_name: cust?.full_name || "Unknown",
          customer_phone: cust?.phone || null,
          amount: Number(cs.amount),
          amount_paid: Number(cs.amount_paid),
          balance: cs.balance != null ? Number(cs.balance) : null,
          due_date: cs.due_date,
          status: cs.status,
        });
      }
    }

    setLoading(false);
  };

  if (!sale) return null;

  const receiptNo = sale.id.substring(0, 8).toUpperCase();
  const saleDate = format(new Date(sale.created_at), "MMM d, yyyy");
  const saleTime = format(new Date(sale.created_at), "HH:mm");
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const totalDiscount = items.reduce((s, i) => s + Number(i.discount_amount), 0);
  const total = Number(sale.total_amount);

  const fmt = (n: number) => `${sym}${n.toFixed(2)}`;

  const buildTextReceipt = (): string => {
    const bName = businessName || "Business";
    const line = "─".repeat(30);
    let text = `=== ${bName.toUpperCase()} ===\n`;
    text += `Receipt #: ${receiptNo}\n`;
    text += `Date: ${saleDate} ${saleTime}\n`;
    text += `Cashier: ${cashierName}\n`;
    text += `${line}\n`;
    for (const item of items) {
      const lineTotal = item.unit_price * item.quantity - Number(item.discount_amount);
      let desc = `${item.product_name} x${item.quantity}`;
      if (item.promo_label) desc += ` (${item.promo_label})`;
      text += `${desc}    ${fmt(lineTotal)}\n`;
    }
    text += `${line}\n`;
    if (totalDiscount > 0) text += `Discount:      -${fmt(totalDiscount)}\n`;
    text += `TOTAL:         ${fmt(total)}\n`;
    text += `Payment:       ${sale.payment_method.replace("_", " ")}\n`;
    if (creditInfo) {
      text += `${line}\n`;
      text += `Customer: ${creditInfo.customer_name}\n`;
      if (creditInfo.customer_phone) text += `Phone: ${creditInfo.customer_phone}\n`;
      text += `Amount Due: ${fmt(creditInfo.balance ?? creditInfo.amount)}\n`;
      if (creditInfo.due_date) text += `Due Date: ${creditInfo.due_date}\n`;
    }
    text += `${line}\nThank you!\n`;
    return text;
  };

  const handleShare = async () => {
    const text = buildTextReceipt();
    if (navigator.share) {
      try {
        await navigator.share({ title: `Receipt ${receiptNo}`, text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Receipt copied to clipboard");
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({ unit: "mm", format: [80, 200] });
    const bName = businessName || "Business";
    let y = 8;
    const lm = 4;
    const pw = 72;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(bName, 40, y, { align: "center" });
    y += 6;

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Receipt #: ${receiptNo}`, lm, y); y += 3.5;
    doc.text(`Date: ${saleDate}  ${saleTime}`, lm, y); y += 3.5;
    doc.text(`Cashier: ${cashierName}`, lm, y); y += 3.5;

    doc.setLineWidth(0.2);
    doc.line(lm, y, lm + pw, y); y += 3;

    doc.setFontSize(7);
    for (const item of items) {
      const lineTotal = item.unit_price * item.quantity - Number(item.discount_amount);
      let desc = `${item.product_name} x${item.quantity}`;
      if (item.promo_label) desc += ` (${item.promo_label})`;

      const descLines = doc.splitTextToSize(desc, pw - 20);
      for (const dl of descLines) {
        doc.text(dl, lm, y);
        y += 3;
      }
      doc.text(fmt(lineTotal), lm + pw, y - 3, { align: "right" });
      y += 1;
    }

    doc.line(lm, y, lm + pw, y); y += 3;

    if (totalDiscount > 0) {
      doc.text("Discount:", lm, y);
      doc.text(`-${fmt(totalDiscount)}`, lm + pw, y, { align: "right" });
      y += 3.5;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", lm, y);
    doc.text(fmt(total), lm + pw, y, { align: "right" });
    y += 4;

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Payment: ${sale.payment_method.replace("_", " ")}`, lm, y);
    y += 4;

    if (creditInfo) {
      doc.line(lm, y, lm + pw, y); y += 3;
      doc.text(`Customer: ${creditInfo.customer_name}`, lm, y); y += 3.5;
      if (creditInfo.customer_phone) { doc.text(`Phone: ${creditInfo.customer_phone}`, lm, y); y += 3.5; }
      doc.setFont("helvetica", "bold");
      doc.text(`Amount Due: ${fmt(creditInfo.balance ?? creditInfo.amount)}`, lm, y); y += 3.5;
      doc.setFont("helvetica", "normal");
      if (creditInfo.due_date) { doc.text(`Due Date: ${creditInfo.due_date}`, lm, y); y += 3.5; }
    }

    y += 2;
    doc.line(lm, y, lm + pw, y); y += 3;
    doc.setFontSize(6);
    doc.text(`Powered by TillFlow`, 40, y, { align: "center" });

    const safeName = bName.replace(/[^a-zA-Z0-9]/g, "_");
    doc.save(`receipt_${safeName}_${receiptNo}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="bg-card border-border max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Receipt #{receiptNo}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {/* Header */}
            <div className="text-center space-y-0.5">
              {logoUrl && <img src={logoUrl} alt="logo" className="w-10 h-10 mx-auto rounded-md object-cover mb-1" />}
              <p className="font-semibold">{businessName}</p>
              <p className="text-xs text-muted-foreground">{saleDate} at {saleTime}</p>
              <p className="text-xs text-muted-foreground">Cashier: {cashierName}</p>
              {sale.is_voided && (
                <span className="inline-block text-[10px] font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">VOIDED</span>
              )}
            </div>

            {/* Line items */}
            <div className="border-t border-b border-border py-2 space-y-1.5">
              {items.map(item => {
                const lineTotal = item.unit_price * item.quantity - Number(item.discount_amount);
                return (
                  <div key={item.id}>
                    <div className="flex justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm">{item.product_name}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          x{item.quantity} @ {fmt(item.unit_price)}
                        </span>
                      </div>
                      <span className="text-sm tabular-nums font-medium">{fmt(lineTotal)}</span>
                    </div>
                    {item.promo_label && (
                      <p className="text-[10px] text-primary ml-1">{item.promo_label}</p>
                    )}
                    {Number(item.discount_amount) > 0 && (
                      <p className="text-[10px] text-muted-foreground ml-1">Discount: -{fmt(Number(item.discount_amount))}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="space-y-1">
              {totalDiscount > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal</span><span className="tabular-nums">{fmt(subtotal)}</span>
                </div>
              )}
              {totalDiscount > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Discount</span><span className="tabular-nums">-{fmt(totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base">
                <span>TOTAL</span><span className="tabular-nums">{fmt(total)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Payment</span><span className="capitalize">{sale.payment_method.replace("_", " ")}</span>
              </div>
            </div>

            {/* Credit info */}
            {creditInfo && (
              <div className="border-t border-border pt-2 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Credit Details</p>
                <div className="flex justify-between text-sm">
                  <span>Customer</span><span className="font-medium">{creditInfo.customer_name}</span>
                </div>
                {creditInfo.customer_phone && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Phone</span><span>{creditInfo.customer_phone}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold">
                  <span>Amount Due</span><span className="tabular-nums">{fmt(creditInfo.balance ?? creditInfo.amount)}</span>
                </div>
                {creditInfo.due_date && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Due Date</span><span>{creditInfo.due_date}</span>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <p className="text-center text-[10px] text-muted-foreground pt-1">
              Powered by TillFlow
            </p>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={handleDownloadPDF}>
                <Download className="w-3.5 h-3.5 mr-1.5" />PDF
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={handleShare}>
                <Share2 className="w-3.5 h-3.5 mr-1.5" />Share
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
