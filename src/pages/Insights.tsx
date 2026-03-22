import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/hooks/useBusiness";
import PageHeader from "@/components/PageHeader";
import { AlertTriangle, TrendingDown, PackageX, ShieldAlert, UserCheck, DollarSign } from "lucide-react";
import { subDays, startOfMonth } from "date-fns";

type InsightItem = { name: string; value: number; detail: string };

export default function Insights() {
  const { user } = useAuth();
  const { businessId } = useBusiness();
  const [deadStock, setDeadStock] = useState<InsightItem[]>([]);
  const [lowMargin, setLowMargin] = useState<InsightItem[]>([]);
  const [highWastage, setHighWastage] = useState<InsightItem[]>([]);
  const [shrinkage, setShrinkage] = useState<InsightItem[]>([]);

  // Credit overview state
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [overLimitCustomers, setOverLimitCustomers] = useState<InsightItem[]>([]);
  const [creditVsCashRatio, setCreditVsCashRatio] = useState<string>("");
  const [oldestUnpaid, setOldestUnpaid] = useState<InsightItem | null>(null);
  const [topDebtors, setTopDebtors] = useState<InsightItem[]>([]);
  const [staffCreditActivity, setStaffCreditActivity] = useState<InsightItem[]>([]);

  useEffect(() => { if (user && businessId) { load(); loadCreditOverview(); } }, [user, businessId]);

  const load = async () => {
    const { data: products } = await supabase.from("products").select("*").eq("business_id", businessId!);
    const { data: stockLevels } = await supabase.from("stock_levels").select("*").eq("business_id", businessId!);
    const { data: saleItems } = await supabase.from("sale_items").select("product_id, quantity, sale_id");
    const { data: sales } = await supabase.from("sales").select("id, created_at, is_voided").eq("business_id", businessId!);
    const { data: adjustments } = await supabase.from("stock_adjustments").select("*").eq("business_id", businessId!);

    if (!products) return;

    const levelMap = Object.fromEntries(stockLevels?.map(l => [l.product_id, l.quantity]) || []);
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const monthStart = startOfMonth(new Date()).toISOString();

    const recentSaleIds = new Set(
      sales?.filter(s => !s.is_voided && s.created_at >= thirtyDaysAgo).map(s => s.id) || []
    );
    const monthSaleIds = new Set(
      sales?.filter(s => !s.is_voided && s.created_at >= monthStart).map(s => s.id) || []
    );

    const salesByProduct: Record<string, number> = {};
    saleItems?.filter(si => recentSaleIds.has(si.sale_id)).forEach(si => {
      salesByProduct[si.product_id] = (salesByProduct[si.product_id] || 0) + si.quantity;
    });

    const dead: InsightItem[] = [];
    products.forEach(p => {
      const qty = levelMap[p.id] || 0;
      const soldQty = salesByProduct[p.id] || 0;
      if (soldQty === 0 && qty > 0) {
        dead.push({ name: p.name, value: qty * p.cost_price, detail: `${qty} units @ $${p.cost_price}` });
      }
    });
    setDeadStock(dead);

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

    const wastage: Record<string, number> = {};
    adjustments?.filter(a => (a.type === "spoilage" || a.type === "theft") && a.created_at >= monthStart)
      .forEach(a => { wastage[a.product_id] = (wastage[a.product_id] || 0) + a.quantity; });
    const highW: InsightItem[] = [];
    Object.entries(wastage).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([pid, qty]) => {
      const p = products.find(pr => pr.id === pid);
      if (p) highW.push({ name: p.name, value: qty * p.cost_price, detail: `${qty} units lost` });
    });
    setHighWastage(highW);

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
      const expected = current + sold + lost - restocked;
      if (restocked > 0 && expected < -2) {
        const diff = Math.abs(expected);
        shrink.push({ name: p.name, value: diff * p.cost_price, detail: `${diff} unaccounted units` });
      }
    });
    setShrinkage(shrink);
  };

  const loadCreditOverview = async () => {
    const monthStart = startOfMonth(new Date()).toISOString();

    // Customers
    const { data: customers } = await supabase
      .from("credit_customers")
      .select("id, full_name, credit_limit, total_outstanding")
      .eq("business_id", businessId!)
      .eq("is_active", true);

    if (customers) {
      const total = customers.reduce((s, c) => s + Number(c.total_outstanding), 0);
      setTotalOutstanding(total);

      const overLimit = customers
        .filter(c => Number(c.total_outstanding) > Number(c.credit_limit))
        .map(c => ({ name: c.full_name, value: Number(c.total_outstanding), detail: `Limit: $${Number(c.credit_limit).toFixed(2)}` }));
      setOverLimitCustomers(overLimit);

      const top5 = [...customers]
        .sort((a, b) => Number(b.total_outstanding) - Number(a.total_outstanding))
        .slice(0, 5)
        .filter(c => Number(c.total_outstanding) > 0)
        .map(c => ({ name: c.full_name, value: Number(c.total_outstanding), detail: `Limit: $${Number(c.credit_limit).toFixed(2)}` }));
      setTopDebtors(top5);
    }

    // Credit vs cash this month
    const { data: monthSales } = await supabase
      .from("sales")
      .select("payment_method, total_amount")
      .eq("business_id", businessId!)
      .eq("is_voided", false)
      .gte("created_at", monthStart);

    if (monthSales) {
      const creditTotal = monthSales.filter(s => s.payment_method === "credit").reduce((s, r) => s + Number(r.total_amount), 0);
      const cashTotal = monthSales.filter(s => s.payment_method !== "credit").reduce((s, r) => s + Number(r.total_amount), 0);
      const totalSales = creditTotal + cashTotal;
      setCreditVsCashRatio(totalSales > 0 ? `Credit: $${creditTotal.toFixed(2)} (${((creditTotal / totalSales) * 100).toFixed(0)}%) vs Cash: $${cashTotal.toFixed(2)}` : "No sales this month");
    }

    // Oldest unpaid
    const { data: oldestCredit } = await supabase
      .from("credit_sales")
      .select("id, amount, balance, created_at, customer_id")
      .eq("business_id", businessId!)
      .neq("status", "paid")
      .order("created_at", { ascending: true })
      .limit(1);

    if (oldestCredit && oldestCredit.length > 0) {
      const oc = oldestCredit[0];
      const { data: cust } = await supabase.from("credit_customers").select("full_name").eq("id", oc.customer_id).single();
      const days = Math.floor((Date.now() - new Date(oc.created_at).getTime()) / 86400000);
      setOldestUnpaid({
        name: cust?.full_name || "Unknown",
        value: Number(oc.balance),
        detail: `${days} days old`,
      });
    }

    // Staff credit activity this month
    const { data: creditSalesMonth } = await supabase
      .from("credit_sales")
      .select("created_by")
      .eq("business_id", businessId!)
      .gte("created_at", monthStart);

    if (creditSalesMonth) {
      const byStaff: Record<string, number> = {};
      creditSalesMonth.forEach(cs => { byStaff[cs.created_by] = (byStaff[cs.created_by] || 0) + 1; });

      const { data: members } = await supabase
        .from("business_members")
        .select("user_id, full_name")
        .eq("business_id", businessId!);
      const nameMap = Object.fromEntries((members || []).map(m => [m.user_id, m.full_name]));

      const activity = Object.entries(byStaff)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([uid, count]) => ({
          name: nameMap[uid] || "Unknown",
          value: count,
          detail: `${count} credit sale${count > 1 ? "s" : ""} this month`,
        }));
      setStaffCreditActivity(activity);
    }
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

      {/* Credit Overview */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <UserCheck className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Credit Overview</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
            <p className="text-lg font-bold tabular-nums">${totalOutstanding.toFixed(2)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Over Limit</p>
            <p className={`text-lg font-bold tabular-nums ${overLimitCustomers.length > 0 ? "text-destructive" : ""}`}>{overLimitCustomers.length}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{creditVsCashRatio}</p>

        {oldestUnpaid && (
          <div className="flex items-center justify-between p-2 bg-destructive/10 rounded-lg mb-3">
            <div>
              <p className="text-xs font-medium">Oldest Unpaid</p>
              <p className="text-xs text-muted-foreground">{oldestUnpaid.name} — {oldestUnpaid.detail}</p>
            </div>
            <span className="text-sm font-medium text-destructive tabular-nums">${oldestUnpaid.value.toFixed(2)}</span>
          </div>
        )}

        {topDebtors.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Top Debtors</p>
            <div className="space-y-1">
              {topDebtors.map((d, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{d.name}</span>
                  <span className="tabular-nums font-medium">${d.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {staffCreditActivity.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Staff Credit Activity (This Month)</p>
            <div className="space-y-1">
              {staffCreditActivity.map((s, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{s.name}</span>
                  <span className="tabular-nums text-muted-foreground">{s.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Section title="Dead Stock (no sales in 30 days)" icon={PackageX} items={deadStock} valueLabel="$" />
      <Section title="Low Margin Products (<20%)" icon={TrendingDown} items={lowMargin} valueLabel="%" />
      <Section title="High Wastage This Month" icon={AlertTriangle} items={highWastage} valueLabel="$" />
      <Section title="Shrinkage Alerts" icon={ShieldAlert} items={shrinkage} valueLabel="$" />
    </div>
  );
}
