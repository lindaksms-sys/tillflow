import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { AlertTriangle, TrendingDown, PackageX, ShieldAlert } from "lucide-react";
import { subDays, startOfMonth } from "date-fns";

type InsightItem = { name: string; value: number; detail: string };

export default function Insights() {
  const { user } = useAuth();
  const [deadStock, setDeadStock] = useState<InsightItem[]>([]);
  const [lowMargin, setLowMargin] = useState<InsightItem[]>([]);
  const [highWastage, setHighWastage] = useState<InsightItem[]>([]);
  const [shrinkage, setShrinkage] = useState<InsightItem[]>([]);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    const { data: products } = await supabase.from("products").select("*");
    const { data: stockLevels } = await supabase.from("stock_levels").select("*");
    const { data: saleItems } = await supabase.from("sale_items").select("product_id, quantity, sale_id");
    const { data: sales } = await supabase.from("sales").select("id, created_at, is_voided");
    const { data: adjustments } = await supabase.from("stock_adjustments").select("*");

    if (!products) return;

    const levelMap = Object.fromEntries(stockLevels?.map(l => [l.product_id, l.quantity]) || []);
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const monthStart = startOfMonth(new Date()).toISOString();

    // Recent sale IDs (not voided, last 30 days)
    const recentSaleIds = new Set(
      sales?.filter(s => !s.is_voided && s.created_at >= thirtyDaysAgo).map(s => s.id) || []
    );
    const monthSaleIds = new Set(
      sales?.filter(s => !s.is_voided && s.created_at >= monthStart).map(s => s.id) || []
    );

    // Sales per product last 30 days
    const salesByProduct: Record<string, number> = {};
    saleItems?.filter(si => recentSaleIds.has(si.sale_id)).forEach(si => {
      salesByProduct[si.product_id] = (salesByProduct[si.product_id] || 0) + si.quantity;
    });

    // 1. Dead stock
    const dead: InsightItem[] = [];
    products.forEach(p => {
      const qty = levelMap[p.id] || 0;
      const soldQty = salesByProduct[p.id] || 0;
      if (soldQty === 0 && qty > 0) {
        dead.push({ name: p.name, value: qty * p.cost_price, detail: `${qty} units @ $${p.cost_price}` });
      }
    });
    setDeadStock(dead);

    // 2. Low margin
    const lowM: InsightItem[] = [];
    products.forEach(p => {
      if (p.selling_price > 0) {
        const margin = ((p.selling_price - p.cost_price) / p.selling_price) * 100;
        if (margin < 20) {
          lowM.push({ name: p.name, value: margin, detail: `Cost: $${p.cost_price} / Sell: $${p.selling_price}` });
        }
      }
    });
    setLowMargin(lowM);

    // 3. High wastage (spoilage + theft this month)
    const wastage: Record<string, number> = {};
    adjustments?.filter(a => (a.type === "spoilage" || a.type === "theft") && a.created_at >= monthStart)
      .forEach(a => { wastage[a.product_id] = (wastage[a.product_id] || 0) + a.quantity; });
    const highW: InsightItem[] = [];
    Object.entries(wastage).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([pid, qty]) => {
      const p = products.find(pr => pr.id === pid);
      if (p) highW.push({ name: p.name, value: qty * p.cost_price, detail: `${qty} units lost` });
    });
    setHighWastage(highW);

    // 4. Shrinkage: (restocks this month) + opening - sales ≠ current
    const restocks: Record<string, number> = {};
    adjustments?.filter(a => a.type === "restock" && a.created_at >= monthStart)
      .forEach(a => { restocks[a.product_id] = (restocks[a.product_id] || 0) + a.quantity; });
    const monthSalesByProduct: Record<string, number> = {};
    saleItems?.filter(si => monthSaleIds.has(si.sale_id)).forEach(si => {
      monthSalesByProduct[si.product_id] = (monthSalesByProduct[si.product_id] || 0) + si.quantity;
    });
    const losses: Record<string, number> = {};
    adjustments?.filter(a => (a.type === "spoilage" || a.type === "theft") && a.created_at >= monthStart)
      .forEach(a => { losses[a.product_id] = (losses[a.product_id] || 0) + a.quantity; });

    const shrink: InsightItem[] = [];
    products.forEach(p => {
      const current = levelMap[p.id] || 0;
      const restocked = restocks[p.id] || 0;
      const sold = monthSalesByProduct[p.id] || 0;
      const lost = losses[p.id] || 0;
      // expected = current + sold + lost - restocked (if we work backwards)
      // But simpler: discrepancy = (restocked - sold - lost) != change in stock
      // Since we don't have opening stock, flag if current seems off
      const expected = current + sold + lost - restocked;
      // If expected < 0, there's unaccounted loss
      if (restocked > 0 && expected < -2) { // threshold of 2 to avoid noise
        const diff = Math.abs(expected);
        shrink.push({ name: p.name, value: diff * p.cost_price, detail: `${diff} unaccounted units` });
      }
    });
    setShrinkage(shrink);
  };

  const Section = ({ title, icon: Icon, items, valueLabel }: { title: string; icon: any; items: InsightItem[]; valueLabel: string }) => (
    <div className="glass-card p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-warning" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing flagged — looking good!</p>
      ) : (
        <>
          <div className="space-y-2 mb-2">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <div>
                  <p className="text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <span className="text-sm font-medium text-warning tabular-nums">
                  {valueLabel === "%" ? `${item.value.toFixed(1)}%` : `$${item.value.toFixed(2)}`}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-2 flex justify-between text-xs">
            <span className="text-muted-foreground">Est. total {valueLabel === "%" ? "" : "value at risk"}</span>
            <span className="font-medium text-warning tabular-nums">
              {valueLabel === "%" ? "" : `$${items.reduce((s, i) => s + i.value, 0).toFixed(2)}`}
            </span>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="page-container">
      <PageHeader title="Insights" />
      <Section title="Dead Stock (no sales in 30 days)" icon={PackageX} items={deadStock} valueLabel="$" />
      <Section title="Low Margin Products (<20%)" icon={TrendingDown} items={lowMargin} valueLabel="%" />
      <Section title="High Wastage This Month" icon={AlertTriangle} items={highWastage} valueLabel="$" />
      <Section title="Shrinkage Alerts" icon={ShieldAlert} items={shrinkage} valueLabel="$" />
    </div>
  );
}
