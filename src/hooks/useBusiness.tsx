import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type BusinessContextType = {
  businessId: string | null;
  businessName: string | null;
  role: string | null;
  loading: boolean;
  onboard: (name: string, type: string, currency?: string, country?: string) => Promise<void>;
};

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBusinessId(null);
      setBusinessName(null);
      setRole(null);
      setLoading(false);
      return;
    }
    loadBusiness();
  }, [user]);

  const loadBusiness = async () => {
    setLoading(true);
    const { data: member } = await supabase
      .from("business_members")
      .select("business_id, role, business_profiles(name)")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (member) {
      setBusinessId(member.business_id);
      setRole(member.role);
      setBusinessName((member as any).business_profiles?.name || null);
    } else {
      setBusinessId(null);
      setRole(null);
      setBusinessName(null);
    }
    setLoading(false);
  };

  const onboard = async (name: string, type: string, currency = "USD", country = "Zimbabwe") => {
    const { data, error } = await supabase.rpc("onboard_business", {
      _name: name,
      _type: type,
      _currency: currency,
      _country: country,
    });
    if (error) throw error;
    setBusinessId(data as string);
    setBusinessName(name);
    setRole("owner");
  };

  return (
    <BusinessContext.Provider value={{ businessId, businessName, role, loading, onboard }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) throw new Error("useBusiness must be used within BusinessProvider");
  return context;
}
