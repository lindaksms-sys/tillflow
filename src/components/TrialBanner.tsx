import { useState } from "react";
import { useBusiness } from "@/hooks/useBusiness";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { differenceInDays } from "date-fns";
import { X, Clock, Zap } from "lucide-react";
import UpgradeModal from "@/components/UpgradeModal";

export default function TrialBanner() {
  const { plan, trialEndsAt } = useBusiness();
  const { isFree, effectivePlan } = usePlanLimits();
  const [dismissed, setDismissed] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (dismissed) return null;

  // Free plan banner
  if (isFree || effectivePlan === "free") {
    return (
      <>
        <div className="bg-muted/50 border-b border-border px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              You're on the Free plan — limited features.{" "}
              <button onClick={() => setUpgradeOpen(true)} className="underline font-medium text-primary hover:text-primary/80 transition-colors">
                Upgrade to Pro →
              </button>
            </span>
          </div>
          <button onClick={() => setDismissed(true)} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      </>
    );
  }

  // Trial banner
  if (plan !== "trial" || !trialEndsAt) return null;

  const daysLeft = Math.max(0, differenceInDays(new Date(trialEndsAt), new Date()));

  return (
    <>
      <div className="bg-accent/15 border-b border-accent/30 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-accent" />
          <span className="text-accent">
            You're on a TillFlow free trial — <strong className="tabular-nums">{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong> remaining.{" "}
            <button onClick={() => setUpgradeOpen(true)} className="underline font-medium hover:text-foreground transition-colors">
              Upgrade to keep access →
            </button>
          </span>
        </div>
        <button onClick={() => setDismissed(true)} className="p-1 text-accent hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}
