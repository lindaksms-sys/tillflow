import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user-scoped client to verify caller
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub;

    const { email, role, business_id, full_name } = await req.json();

    // Validate inputs
    if (!email || !role || !business_id || !full_name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["manager", "cashier"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is owner of this business
    const { data: membership } = await supabaseAdmin
      .from("business_members")
      .select("role")
      .eq("user_id", callerId)
      .eq("business_id", business_id)
      .eq("is_active", true)
      .single();

    if (!membership || membership.role !== "owner") {
      return new Response(JSON.stringify({ error: "Only business owners can invite staff" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Invite user via admin API — sends magic link email
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { business_id, role, full_name },
    });

    if (inviteError) {
      // Check for duplicate
      if (inviteError.message?.includes("already been registered") || inviteError.message?.includes("already exists")) {
        // User exists — check if already a member
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
        const user = existingUser?.users?.find((u: any) => u.email === email);
        
        if (user) {
          // Check if already a member of this business
          const { data: existingMember } = await supabaseAdmin
            .from("business_members")
            .select("id")
            .eq("user_id", user.id)
            .eq("business_id", business_id)
            .single();

          if (existingMember) {
            return new Response(JSON.stringify({ error: "This user is already a member of your business" }), {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Add existing user as member
          const { error: insertErr } = await supabaseAdmin.from("business_members").insert({
            business_id,
            user_id: user.id,
            role,
            full_name,
          });

          if (insertErr) {
            console.error("Insert member error:", insertErr);
            return new Response(JSON.stringify({ error: "Failed to add staff member" }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ success: true, message: "Existing user added as staff member" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      console.error("Invite error:", inviteError);
      return new Response(JSON.stringify({ error: "Failed to send invitation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert into business_members immediately
    if (inviteData?.user?.id) {
      const { error: insertErr } = await supabaseAdmin.from("business_members").insert({
        business_id,
        user_id: inviteData.user.id,
        role,
        full_name,
      });

      if (insertErr) {
        console.error("Insert member error:", insertErr);
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Invitation sent successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("invite-staff error:", e);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
