import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useAuth } from "@/hooks/useAuth";
import { useRequireRole } from "@/hooks/useRequireRole";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Upload, AlertTriangle, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";

export default function Settings() {
  const { verified, verifying } = useRequireRole(['owner']);
  const { businessId, businessName, plan, trialEndsAt, refresh } = useBusiness();
  const { signOut } = useAuth();

  const [name, setName] = useState("");
  const [type, setType] = useState("retail");
  const [currency, setCurrency] = useState("USD");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [defaultCreditLimit, setDefaultCreditLimit] = useState("50");
  const [maxCashierCreditAmount, setMaxCashierCreditAmount] = useState("20");
  const [requireOwnerApproval, setRequireOwnerApproval] = useState(false);
  const [allowCashierPayments, setAllowCashierPayments] = useState(true);
  const [savingCredit, setSavingCredit] = useState(false);

  useEffect(() => {
    if (businessId && verified) loadSettings();
  }, [businessId, verified]);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("id", businessId!)
      .single();
    if (data) {
      setName(data.name);
      setType(data.type);
      setCurrency(data.currency);
      setLogoUrl(data.logo_url);
      setDefaultCreditLimit(String((data as any).default_credit_limit ?? 50));
      setMaxCashierCreditAmount(String((data as any).max_cashier_credit_amount ?? 20));
      setRequireOwnerApproval((data as any).require_owner_approval_credit ?? false);
      setAllowCashierPayments((data as any).allow_cashier_record_payments ?? true);
    }
  };

  const save = async () => {
    if (!businessId || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("business_profiles")
      .update({ name: name.trim(), type, currency })
      .eq("id", businessId);
    if (error) toast.error(error.message);
    else {
      toast.success("Settings saved");
      await refresh();
    }
    setSaving(false);
  };

  const saveCreditSettings = async () => {
    if (!businessId) return;
    setSavingCredit(true);
    const { error } = await supabase
      .from("business_profiles")
      .update({
        default_credit_limit: Number(defaultCreditLimit) || 50,
        max_cashier_credit_amount: Number(maxCashierCreditAmount) || 20,
        require_owner_approval_credit: requireOwnerApproval,
        allow_cashier_record_payments: allowCashierPayments,
      } as any)
      .eq("id", businessId);
    if (error) toast.error(error.message);
    else toast.success("Credit settings saved");
    setSavingCredit(false);
  };

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId) return;
    const ext = file.name.split(".").pop();
    const path = `${businessId}/logo.${ext}`;

    const { error: upErr } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (upErr) { toast.error(upErr.message); return; }

    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
    await supabase.from("business_profiles").update({ logo_url: urlData.publicUrl }).eq("id", businessId);
    setLogoUrl(urlData.publicUrl);
    toast.success("Logo uploaded");
  };

  const deactivate = async () => {
    if (!businessId) return;
    if (!confirm("Are you sure? This will deactivate your business and all access.")) return;
    await supabase.from("business_profiles").update({ is_active: false }).eq("id", businessId);
    toast.success("Business deactivated");
    await signOut();
  };

  if (verifying || !verified) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const daysLeft = trialEndsAt ? Math.max(0, differenceInDays(new Date(trialEndsAt), new Date())) : null;

  return (
    <div className="page-container">
      <PageHeader title="Settings" />

      <div className="glass-card p-4 mb-4">
        <h2 className="text-sm font-semibold mb-3">Business Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Business Name</label>
            <Input className="input-dark" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Currency</label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="ZWL">ZWL</SelectItem>
                <SelectItem value="ZAR">ZAR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="glass-card p-4 mb-4">
        <h2 className="text-sm font-semibold mb-3">Logo</h2>
        {logoUrl && (
          <img src={logoUrl} alt="Business logo" className="w-16 h-16 rounded-lg object-cover mb-3 border border-border" />
        )}
        <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-primary hover:underline">
          <Upload className="w-4 h-4" />
          Upload Logo
          <input type="file" accept="image/*" onChange={uploadLogo} className="hidden" />
        </label>
      </div>

      <div className="glass-card p-4 mb-4">
        <h2 className="text-sm font-semibold mb-2">Plan</h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">{plan}</Badge>
          {plan === "trial" && daysLeft !== null && (
            <span className="text-xs text-accent tabular-nums">{daysLeft} days left</span>
          )}
        </div>
      </div>

      {/* Credit Controls */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <UserCheck className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Credit Controls</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Default Credit Limit ($)</label>
            <Input className="input-dark" type="number" step="0.01" value={defaultCreditLimit} onChange={e => setDefaultCreditLimit(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Max Cashier Credit Sale ($)</label>
            <Input className="input-dark" type="number" step="0.01" value={maxCashierCreditAmount} onChange={e => setMaxCashierCreditAmount(e.target.value)} />
            <p className="text-[10px] text-muted-foreground mt-1">Cashiers cannot create credit sales above this amount</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Require owner approval for all credit</p>
              <p className="text-[10px] text-muted-foreground">Cashiers must get owner/manager approval</p>
            </div>
            <Switch checked={requireOwnerApproval} onCheckedChange={setRequireOwnerApproval} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Allow cashiers to record payments</p>
              <p className="text-[10px] text-muted-foreground">If off, only owner/manager can record credit payments</p>
            </div>
            <Switch checked={allowCashierPayments} onCheckedChange={setAllowCashierPayments} />
          </div>
          <Button className="w-full" onClick={saveCreditSettings} disabled={savingCredit}>
            {savingCredit ? "Saving..." : "Save Credit Settings"}
          </Button>
        </div>
      </div>

      <div className="glass-card p-4 border-destructive/30">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Deactivating your business will prevent all members from accessing it.
        </p>
        <Button variant="destructive" size="sm" onClick={deactivate}>
          Deactivate Business
        </Button>
      </div>

      <Button variant="ghost" className="w-full mt-4 text-muted-foreground" onClick={signOut}>
        Sign Out
      </Button>
    </div>
  );
}
