import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { DollarSign, TrendingDown, TrendingUp, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { format, subDays, startOfDay, endOfDay, startOfMonth } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const today = new Date();
    const dayStart = startOfDay(today).toISOString();
    const dayEnd = endOfDay(today).toISOString();
    const monthStart = startOfMonth(today).toISOString();

    // Today's revenue
    const { data: salesData } = await supabase
      .from("sales")
      .select("total_amount")
      .eq("is_voided", false)
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd);
    const rev = salesData?.reduce((s, r) => s + Number(r.total_amount), 0) || 0;
    setTodayRevenue(rev);

    // Today's expenses
    const { data: expData } = await supabase
      .from("expenses")
      .select("amount")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd);
    const exp = expData?.reduce((s, r) => s + Number(r.amount), 0) || 0;
    setTodayExpenses(exp);

    // Last 7 days chart
    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const ds = startOfDay(d).toISOString();
      const de = endOfDay(d).toISOString();

      const { data: dSales } = await supabase
        .from("sales").select("total_amount").eq("is_voided", false)
        .gte("created_at", ds).lte("created_at", de);
      const { data: dExp } = await supabase
        .from("expenses").select("amount")
        .gte("created_at", ds).lte("created_at", de);

      days.push({
        day: format(d, "EEE"),
        revenue: dSales?.reduce((s, r) => s + Number(r.total_amount), 0) || 0,
        expenses: dExp?.reduce((s, r) => s + Number(r.amount), 0) || 0,
      });
    }
    setChartData(days);

    // Top 5 products this month
    const { data: saleItems } = await supabase
      .from("sale_items")
      .select("product_id, quantity, unit_price, sale_id");

    // Filter by month through sales
    const { data: monthSales } = await supabase
      .from("sales").select("id")
      .eq("is_voided", false)
      .gte("created_at", monthStart);

    const monthSaleIds = new Set(monthSales?.map(s => s.id) || []);
    const productTotals: Record<string, number> = {};
    saleItems?.filter(si => monthSaleIds.has(si.sale_id)).forEach(si => {
      productTotals[si.product_id] = (productTotals[si.product_id] || 0) + si.quantity;
    });

    const sorted = Object.entries(productTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const { data: products } = await supabase.from("products").select("id, name, cost_price, selling_price");
    const prodMap = Object.fromEntries(products?.map(p => [p.id, p]) || []);

    setTopProducts(sorted.map(([id, qty]) => ({
      name: prodMap[id]?.name || "Unknown",
      qty,
      margin: prodMap[id] ? Math.round(((prodMap[id].selling_price - prodMap[id].cost_price) / prodMap[id].selling_price) * 100) : 0,
    })));

    setLoading(false);
  };

  const netProfit = todayRevenue - todayExpenses;

  return (
    <div className="page-container">
      <PageHeader title="Dashboard" />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="stat-card">
          <DollarSign className="w-4 h-4 text-primary mb-1" />
          <p className="text-[10px] text-muted-foreground">Revenue</p>
          <p className="text-sm font-bold tabular-nums">${todayRevenue.toFixed(0)}</p>
        </div>
        <div className="stat-card">
          <TrendingDown className="w-4 h-4 text-destructive mb-1" />
          <p className="text-[10px] text-muted-foreground">Expenses</p>
          <p className="text-sm font-bold tabular-nums">${todayExpenses.toFixed(0)}</p>
        </div>
        <div className="stat-card">
          <TrendingUp className={`w-4 h-4 mb-1 ${netProfit >= 0 ? "text-primary" : "text-destructive"}`} />
          <p className="text-[10px] text-muted-foreground">Profit</p>
          <p className="text-sm font-bold tabular-nums">${netProfit.toFixed(0)}</p>
        </div>
      </div>

      <div className="glass-card p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Last 7 Days</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData}>
            <XAxis dataKey="day" tick={{ fill: "hsl(215,12%,55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(215,12%,55%)", fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(220,18%,15%)", border: "1px solid hsl(220,14%,20%)", borderRadius: 8, color: "hsl(210,20%,92%)" }}
            />
            <Bar dataKey="revenue" fill="hsl(142,60%,45%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="hsl(0,72%,55%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {topProducts.length > 0 && (
        <div className="glass-card p-4">
          <h2 className="text-sm font-semibold mb-3">Top Sellers This Month</h2>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                  <span className="text-sm">{p.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{p.qty} sold</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    p.margin >= 20 ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                  }`}>{p.margin}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
