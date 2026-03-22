import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { format, addDays } from "date-fns";

export default function Admin() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase
      .from("business_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setBusinesses(data || []);
    setLoading(false);
  };

  const total = businesses.length;
  const byPlan: Record<string, number> = {};
  businesses.forEach(b => { byPlan[b.plan] = (byPlan[b.plan] || 0) + 1; });

  const sevenDaysOut = addDays(new Date(), 7).toISOString();
  const expiringTrials = businesses.filter(
    b => b.plan === "trial" && b.trial_ends_at && b.trial_ends_at <= sevenDaysOut && b.trial_ends_at >= new Date().toISOString()
  );

  const recent = businesses.slice(0, 10);

  if (loading) return (
    <div className="page-container flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="page-container">
      <PageHeader title="Admin Dashboard" />

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="stat-card">
          <p className="text-[10px] text-muted-foreground">Total Businesses</p>
          <p className="text-xl font-bold tabular-nums">{total}</p>
        </div>
        {Object.entries(byPlan).map(([plan, count]) => (
          <div key={plan} className="stat-card">
            <p className="text-[10px] text-muted-foreground capitalize">{plan}</p>
            <p className="text-xl font-bold tabular-nums">{count}</p>
          </div>
        ))}
      </div>

      {expiringTrials.length > 0 && (
        <div className="glass-card p-4 mb-4">
          <h2 className="text-sm font-semibold mb-3 text-accent">Trials Expiring (7 days)</h2>
          <div className="space-y-2">
            {expiringTrials.map(b => (
              <div key={b.id} className="flex justify-between items-center text-sm">
                <span>{b.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {format(new Date(b.trial_ends_at), "MMM d")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card p-4">
        <h2 className="text-sm font-semibold mb-3">Recent Signups</h2>
        <div className="space-y-2">
          {recent.map(b => (
            <div key={b.id} className="flex justify-between items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.type} · {b.country}</p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <Badge variant="secondary" className="text-[10px] capitalize">{b.plan}</Badge>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {format(new Date(b.created_at), "MMM d")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
