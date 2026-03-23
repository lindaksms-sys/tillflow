import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Downgrade pro plans that have expired
  const { data: expiredPro, error: proError } = await supabase
    .from("business_profiles")
    .update({ plan: "expired" })
    .eq("plan", "pro")
    .lt("pro_expires_at", new Date().toISOString())
    .select("id, name");

  if (proError) {
    console.error("Pro expiry check error:", proError);
  } else {
    console.log(`Expired ${expiredPro?.length || 0} pro businesses:`, expiredPro);
    // Sync clients table for expired pro
    for (const biz of expiredPro || []) {
      await supabase.from("clients").update({ status: "expired" }).eq("business_id", biz.id);
    }
  }

  // Downgrade expired trials to free plan
  const { data: expiredTrials, error: trialError } = await supabase
    .from("business_profiles")
    .update({ plan: "free" })
    .eq("plan", "trial")
    .lt("trial_ends_at", new Date().toISOString())
    .select("id, name");

  if (trialError) {
    console.error("Trial expiry check error:", trialError);
  } else {
    console.log(`Downgraded ${expiredTrials?.length || 0} trials to free:`, expiredTrials);
    // Sync clients table for free downgrades
    for (const biz of expiredTrials || []) {
      await supabase.from("clients").update({ status: "free" }).eq("business_id", biz.id);
    }
  }

  return new Response(JSON.stringify({
    expired_pro: expiredPro?.length || 0,
    downgraded_to_free: expiredTrials?.length || 0,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
