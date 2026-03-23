import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate API key
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const expectedKey = Deno.env.get("ADMIN_STATS_KEY");

  if (!expectedKey || token !== expectedKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Get all businesses
    const { data: businesses, error: bizError } = await supabase
      .from("business_profiles")
      .select("id, name, plan, created_at, trial_ends_at, pro_expires_at, owner_id");

    if (bizError) throw bizError;

    // Get all members count
    const { count: userCount, error: memError } = await supabase
      .from("business_members")
      .select("id", { count: "exact", head: true });

    if (memError) throw memError;

    // Get recent payments
    const { data: recentPayments, error: payError } = await supabase
      .from("manual_payments")
      .select("business_id, amount, note, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (payError) throw payError;

    // Aggregate plan breakdown
    const byPlan: Record<string, number> = { trial: 0, pro: 0, expired: 0 };
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const recentSignups: any[] = [];
    const expiringSoon: any[] = [];

    for (const biz of businesses || []) {
      byPlan[biz.plan] = (byPlan[biz.plan] || 0) + 1;

      if (new Date(biz.created_at) >= thirtyDaysAgo) {
        recentSignups.push({
          name: biz.name,
          plan: biz.plan,
          created_at: biz.created_at,
          trial_ends_at: biz.trial_ends_at,
          pro_expires_at: biz.pro_expires_at,
        });
      }

      if (biz.plan === "pro" && biz.pro_expires_at) {
        const expiresAt = new Date(biz.pro_expires_at);
        if (expiresAt <= sevenDaysFromNow && expiresAt > now) {
          const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          expiringSoon.push({
            name: biz.name,
            pro_expires_at: biz.pro_expires_at,
            days_left: daysLeft,
          });
        }
      }
    }

    const response = {
      totals: {
        businesses: businesses?.length || 0,
        users: userCount || 0,
      },
      by_plan: byPlan,
      expiring_soon: expiringSoon,
      recent_signups: recentSignups.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      recent_payments: recentPayments || [],
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-stats error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
