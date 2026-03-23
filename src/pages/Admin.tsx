import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { useRequireAdmin } from "@/hooks/useRequireRole";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays, differenceInDays } from "date-fns";
import { Search, CheckCircle, Clock, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";

function planStatus(b: any): { label: string; color: string; icon: any } {
  if (b.plan === "pro") {
    if (!b.pro_expires_at) return { label: "Pro (no expiry)", color: "text-green-400", icon: CheckCircle };
    const days = differenceInDays(new Date(b.pro_expires_at), new Date());
    if (days < 0) return { label: "Pro Expired", color: "text-destructive", icon: XCircle };
    if (days <= 7) return { label: `Pro (${days}d left)`, color: "text-yellow-400", icon: AlertTriangle };
    return { label: `Pro (${days}d left)`, color: "text-green-400", icon: CheckCircle };
  }
  if (b.plan === "expired") return { label: "Expired", color: "text-destructive", icon: XCircle };
  if (b.plan === "trial") {
    if (!b.trial_ends_at) return { label: "Trial", color: "text-muted-foreground", icon: Clock };
    const days = differenceInDays(new Date(b.trial_ends_at), new Date());
    if (days < 0) return { label: "Trial Expired", color: "text-destructive", icon: XCircle };
    if (days <= 7) return { label: `Trial (${days}d)`, color: "text-yellow-400", icon: AlertTriangle };
    return { label: `Trial (${days}d)`, color: "text-muted-foreground", icon: Clock };
  }
  return { label: b.plan, color: "text-muted-foreground", icon: Clock };
}

export default function Admin() {
  const { verified, verifying } = useRequireAdmin();
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => { if (verified) load(); }, [verified]);

  const load = async () => {
    const [{ data: biz }, { data: pay }] = await Promise.all([
      supabase.from("business_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("manual_payments").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setBusinesses(biz || []);
    setPayments(pay || []);
    setLoading(false);
  };

  const activatePro = async (bizId: string) => {
    setActivating(bizId);
    const expiresAt = addDays(new Date(), 30).toISOString();
    const { error: updateErr } = await supabase
      .from("business_profiles")
      .update({ plan: "pro", pro_expires_at: expiresAt } as any)
      .eq("id", bizId);
    if (updateErr) { toast.error(updateErr.message); setActivating(null); return; }

    await supabase.from("manual_payments").insert({
      business_id: bizId,
      amount: 2.99,
      note: notes[bizId] || "Activated Pro",
      activated_by: user!.id,
    } as any);

    // Sync clients table
    await supabase.from("clients" as any)
      .update({ status: "pro", plan: "pro", upgrade_date: new Date().toISOString(), mrr: 2.99 } as any)
      .eq("business_id", bizId);

    toast.success("Pro activated for 30 days");
    setNotes((prev) => ({ ...prev, [bizId]: "" }));
    await load();
    setActivating(null);
  };

  const extendPro = async (bizId: string) => {
    setActivating(bizId);
    const biz = businesses.find((b) => b.id === bizId);
    const base = biz?.pro_expires_at && new Date(biz.pro_expires_at) > new Date()
      ? new Date(biz.pro_expires_at)
      : new Date();
    const expiresAt = addDays(base, 30).toISOString();

    const { error: updateErr } = await supabase
      .from("business_profiles")
      .update({ plan: "pro", pro_expires_at: expiresAt } as any)
      .eq("id", bizId);
    if (updateErr) { toast.error(updateErr.message); setActivating(null); return; }

    await supabase.from("manual_payments").insert({
      business_id: bizId,
      amount: 2.99,
      note: notes[bizId] || "Extended Pro 30 days",
      activated_by: user!.id,
    } as any);

    toast.success("Extended 30 days");
    setNotes((prev) => ({ ...prev, [bizId]: "" }));
    await load();
    setActivating(null);
  };

  if (verifying || !verified || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filtered = businesses.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.name?.toLowerCase().includes(q) || b.owner_id?.toLowerCase().includes(q);
  });

  const total = businesses.length;
  const byPlan: Record<string, number> = {};
  businesses.forEach((b) => { byPlan[b.plan] = (byPlan[b.plan] || 0) + 1; });

  return (
    <div className="page-container pb-24">
      <PageHeader title="Admin Dashboard" />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="stat-card">
          <p className="text-[10px] text-muted-foreground">Total Businesses</p>
          <p className="text-xl font-bold tabular-nums">{total}</p>
        </div>
        {Object.entries(byPlan).map(([p, count]) => (
          <div key={p} className="stat-card">
            <p className="text-[10px] text-muted-foreground capitalize">{p}</p>
            <p className="text-xl font-bold tabular-nums">{count}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by business name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Business list */}
      <div className="space-y-3">
        {filtered.map((b) => {
          const status = planStatus(b);
          const StatusIcon = status.icon;
          return (
            <div key={b.id} className="glass-card p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.type} · {b.country} · {b.currency}</p>
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
                  <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                </div>
              </div>

              {b.pro_expires_at && (
                <p className="text-[11px] text-muted-foreground">
                  Pro expires: {format(new Date(b.pro_expires_at), "MMM d, yyyy")}
                </p>
              )}

              <Textarea
                placeholder="Payment note (e.g. Paid $2.99 via PayPal)"
                value={notes[b.id] || ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [b.id]: e.target.value }))}
                className="text-xs min-h-[60px]"
              />

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => activatePro(b.id)}
                  disabled={activating === b.id}
                  className="flex-1 text-xs"
                >
                  Activate Pro
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => extendPro(b.id)}
                  disabled={activating === b.id}
                  className="flex-1 text-xs"
                >
                  Extend 30 days
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent payments */}
      {payments.length > 0 && (
        <div className="glass-card p-4 mt-6">
          <h2 className="text-sm font-semibold mb-3">Recent Payment Logs</h2>
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between items-start text-xs">
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground truncate">{p.note || "—"}</p>
                </div>
                <div className="text-right ml-2 shrink-0">
                  <p className="font-medium tabular-nums">${p.amount}</p>
                  <p className="text-muted-foreground">{format(new Date(p.created_at), "MMM d")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
