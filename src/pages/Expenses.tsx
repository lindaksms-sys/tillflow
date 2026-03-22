import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/hooks/useBusiness";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

const expenseCategories = ["Restock", "Rent", "Wages", "Utilities", "Marketing", "Other"];

export default function Expenses() {
  const { user } = useAuth();
  const { businessId } = useBusiness();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ category: "Restock", amount: "", note: "" });
  const [filterCat, setFilterCat] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [monthlySummary, setMonthlySummary] = useState<Record<string, number>>({});

  useEffect(() => { if (user) load(); }, [user, filterCat, dateFilter]);

  const load = async () => {
    let q = supabase.from("expenses").select("*").order("created_at", { ascending: false });
    if (filterCat !== "all") q = q.eq("category", filterCat);
    if (dateFilter) q = q.gte("created_at", dateFilter + "T00:00:00").lte("created_at", dateFilter + "T23:59:59");
    const { data } = await q;
    setExpenses(data || []);

    // Monthly totals
    const now = new Date();
    const ms = startOfMonth(now).toISOString();
    const me = endOfMonth(now).toISOString();
    const { data: monthData } = await supabase.from("expenses").select("category, amount").gte("created_at", ms).lte("created_at", me);
    const summary: Record<string, number> = {};
    monthData?.forEach(e => { summary[e.category] = (summary[e.category] || 0) + Number(e.amount); });
    setMonthlySummary(summary);
  };

  const save = async () => {
    if (!user || !form.amount || !businessId) return;
    await supabase.from("expenses").insert({
      user_id: user.id, category: form.category,
      amount: Number(form.amount), note: form.note || null,
      business_id: businessId,
    });
    toast.success("Expense logged");
    setDialogOpen(false);
    setForm({ category: "Restock", amount: "", note: "" });
    load();
  };

  const monthTotal = Object.values(monthlySummary).reduce((s, v) => s + v, 0);

  return (
    <div className="page-container">
      <PageHeader title="Expenses" />

      {monthTotal > 0 && (
        <div className="glass-card p-4 mb-4">
          <h2 className="text-sm font-semibold mb-2">This Month: ${monthTotal.toFixed(2)}</h2>
          <div className="space-y-1">
            {Object.entries(monthlySummary).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{cat}</span>
                <span className="tabular-nums">${amt.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="input-dark h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {expenseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="input-dark h-8 text-xs flex-1" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4" /></Button>
      </div>

      <div className="space-y-2">
        {expenses.map(e => (
          <div key={e.id} className="glass-card p-3 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">${Number(e.amount).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{e.category} · {format(new Date(e.created_at), "MMM d")}</p>
              {e.note && <p className="text-xs text-muted-foreground mt-0.5">{e.note}</p>}
            </div>
          </div>
        ))}
        {expenses.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No expenses</p>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Log Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
              <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
              <SelectContent>{expenseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Input className="input-dark" type="number" placeholder="Amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <Textarea className="input-dark" placeholder="Note (optional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            <Button className="w-full" onClick={save}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
