import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type BusinessContextType = {
  businessId: string | null;
  businessName: string | null;
  businessType: string | null;
  role: string | null;
  plan: string | null;
  trialEndsAt: string | null;
  proExpiresAt: string | null;
  currency: string | null;
  loading: boolean;
  isOwner: boolean;
  isManager: boolean;
  isCashier: boolean;
  isAdmin: boolean;
  onboard: (name: string, type: string, currency?: string, country?: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [proExpiresAt, setProExpiresAt] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBusinessId(null);
      setBusinessName(null);
      setBusinessType(null);
      setRole(null);
      setPlan(null);
      setTrialEndsAt(null);
      setProExpiresAt(null);
      setCurrency(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    loadBusiness();
  }, [user]);

  const loadBusiness = async () => {
    setLoading(true);

    const { data: adminRow } = await supabase
      .from("saas_admin")
      .select("user_id")
      .eq("user_id", user!.id)
      .maybeSingle();
    setIsAdmin(!!adminRow);

    const { data: member } = await supabase
      .from("business_members")
      .select("business_id, role, business_profiles(name, type, plan, trial_ends_at, pro_expires_at, currency)")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (member) {
      const bp = (member as any).business_profiles;
      setBusinessId(member.business_id);
      setRole(member.role);
      setBusinessName(bp?.name || null);
      setBusinessType(bp?.type || null);
      setPlan(bp?.plan || null);
      setTrialEndsAt(bp?.trial_ends_at || null);
      setProExpiresAt(bp?.pro_expires_at || null);
      setCurrency(bp?.currency || null);
    } else {
      setBusinessId(null);
      setRole(null);
      setBusinessName(null);
      setBusinessType(null);
      setPlan(null);
      setTrialEndsAt(null);
      setProExpiresAt(null);
      setCurrency(null);
    }
    setLoading(false);
  };

  const onboard = async (name: string, type: string, currency = "USD", country = "Zimbabwe") => {
    const { data, error } = await supabase.rpc("onboard_business", {
      _name: name, _type: type, _currency: currency, _country: country,
    });
    if (error) throw error;
    await loadBusiness();
  };

  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isCashier = role === "cashier";

  return (
    <BusinessContext.Provider value={{
      businessId, businessName, businessType, role, plan, trialEndsAt, proExpiresAt, currency,
      loading, isOwner, isManager, isCashier, isAdmin, onboard, refresh: loadBusiness,
    }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) throw new Error("useBusiness must be used within BusinessProvider");
  return context;
}
