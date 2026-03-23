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
  const { data, error } = await supabase
    .from("business_profiles")
    .update({ plan: "expired" })
    .eq("plan", "pro")
    .lt("pro_expires_at", new Date().toISOString())
    .select("id, name");

  if (error) {
    console.error("Expiry check error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`Expired ${data?.length || 0} businesses:`, data);

  return new Response(JSON.stringify({ expired: data?.length || 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
