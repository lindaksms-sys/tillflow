import { useState } from "react";
import { Package, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/hooks/useBusiness";
import UpgradeModal from "@/components/UpgradeModal";

export default function TrialExpired() {
  const { signOut } = useAuth();
  const { plan } = useBusiness();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const isProExpired = plan === "expired";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="inline-flex items-center gap-2 text-muted-foreground">
          <Package className="w-8 h-8" />
          <BarChart3 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-foreground" style={{ lineHeight: "1.1" }}>
          {isProExpired ? "Pro Plan Expired" : "Trial Expired"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isProExpired
            ? "Your TillFlow Pro plan has expired. Renew to keep full access."
            : "Your TillFlow free trial has ended. Upgrade your plan to continue."}
        </p>
        <div className="space-y-3">
          <Button className="w-full" onClick={() => setUpgradeOpen(true)}>
            {isProExpired ? "Renew Now" : "Upgrade Now"}
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </div>
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
