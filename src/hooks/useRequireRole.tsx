import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useAuth } from "@/hooks/useAuth";

/**
 * Server-side role verification hook.
 * Fetches the user's role directly from the database on mount
 * instead of relying on cached client-side context.
 * Redirects to "/" if role is not in allowedRoles.
 */
export function useRequireRole(allowedRoles: string[]) {
  const { user } = useAuth();
  const { businessId } = useBusiness();
  const navigate = useNavigate();
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    if (!user || !businessId) {
      setVerifying(false);
      return;
    }

    let cancelled = false;

    const verify = async () => {
      const { data: role } = await supabase.rpc("get_user_role_for_business", {
        p_business_id: businessId,
      });

      if (cancelled) return;

      if (!role || !allowedRoles.includes(role)) {
        navigate("/", { replace: true });
        return;
      }

      setVerified(true);
      setVerifying(false);
    };

    verify();
    return () => { cancelled = true; };
  }, [user, businessId, allowedRoles, navigate]);

  return { verified, verifying };
}

/**
 * Hook for admin pages — checks both business role AND saas_admin table.
 */
export function useRequireAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    if (!user) {
      setVerifying(false);
      return;
    }

    let cancelled = false;

    const verify = async () => {
      const { data } = await supabase
        .from("saas_admin")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!data) {
        navigate("/", { replace: true });
        return;
      }

      setVerified(true);
      setVerifying(false);
    };

    verify();
    return () => { cancelled = true; };
  }, [user, navigate]);

  return { verified, verifying };
}
