import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import UpgradeNudge from "@/components/UpgradeNudge";
import { useRequireRole } from "@/hooks/useRequireRole";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Shield, ShieldCheck, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

type Member = {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

const roleIcons: Record<string, any> = { owner: ShieldCheck, manager: Shield, cashier: ShoppingCart };
const roleColors: Record<string, string> = {
  owner: "bg-primary/15 text-primary",
  manager: "bg-accent/15 text-accent",
  cashier: "bg-muted text-muted-foreground",
};

export default function Staff() {
  const { verified, verifying } = useRequireRole(['owner']);
  const { businessId } = useBusiness();
  const { isFree, maxStaff } = usePlanLimits();

  const [members, setMembers] = useState<Member[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("cashier");
  const [inviteName, setInviteName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (businessId && verified) load(); }, [businessId, verified]);

  const load = async () => {
    const { data } = await supabase
      .from("business_members")
      .select("*")
      .eq("business_id", businessId!)
      .order("created_at");
    setMembers(data || []);
  };

  const invite = async () => {
    if (!inviteEmail || !inviteName || !businessId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("invite-staff", {
        body: {
          email: inviteEmail,
          role: inviteRole,
          business_id: businessId,
          full_name: inviteName,
        },
      });

      if (error) {
        toast.error("Failed to send invitation");
        setLoading(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setLoading(false);
        return;
      }

      toast.success(`Invite sent to ${inviteEmail}. Ask them to check their inbox and spam folder. The link expires in 24 hours.`);
      setDialogOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("cashier");
      load();
    } catch (err) {
      toast.error("Failed to send invitation");
    }
    setLoading(false);
  };

  const toggleActive = async (member: Member) => {
    if (member.role === "owner") {
      toast.error("Cannot deactivate the owner");
      return;
    }
    await supabase
      .from("business_members")
      .update({ is_active: !member.is_active })
      .eq("id", member.id);
    toast.success(member.is_active ? "Staff deactivated" : "Staff activated");
    load();
  };

  if (verifying || !verified) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader title="Staff" />

      {isFree && members.length > maxStaff ? (
        <UpgradeNudge message={`Free plan: max ${maxStaff} staff member. Upgrade for up to 10.`} className="mb-4" />
      ) : (
        <Button size="sm" className="mb-4" onClick={() => setDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" /> Invite Staff
        </Button>
      )}

      <div className="glass-card p-3 mb-4">
        <p className="text-xs text-muted-foreground mb-2">Role Permissions</p>
        <div className="space-y-1 text-xs">
          <p><span className="text-primary font-medium">Owner:</span> Full access including staff & settings</p>
          <p><span className="text-accent font-medium">Manager:</span> Products, Stock, Sales, Expenses, Insights</p>
          <p><span className="text-muted-foreground font-medium">Cashier:</span> Sales & Stock only</p>
        </div>
      </div>

      <div className="space-y-2">
        {members.map(m => {
          const Icon = roleIcons[m.role] || Shield;
          return (
            <div key={m.id} className={`glass-card p-3 flex items-center justify-between ${!m.is_active ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.full_name}</p>
                  <Badge variant="secondary" className={`text-[10px] ${roleColors[m.role] || ""}`}>
                    {m.role}
                  </Badge>
                </div>
              </div>
              {m.role !== "owner" && (
                <Button
                  size="sm"
                  variant={m.is_active ? "destructive" : "outline"}
                  className="text-xs h-7"
                  onClick={() => toggleActive(m)}
                >
                  {m.is_active ? "Deactivate" : "Activate"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Invite Staff Member</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input className="input-dark" placeholder="Full name" value={inviteName} onChange={e => setInviteName(e.target.value)} />
            <Input className="input-dark" type="email" placeholder="Email address" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="cashier">Cashier</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={invite} disabled={loading}>
              {loading ? "Inviting..." : "Send Invite"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
