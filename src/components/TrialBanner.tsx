import { useState } from "react";
import { useBusiness } from "@/hooks/useBusiness";
import { differenceInDays } from "date-fns";
import { X, Clock } from "lucide-react";
import UpgradeModal from "@/components/UpgradeModal";

export default function TrialBanner() {
  const { plan, trialEndsAt } = useBusiness();
  const [dismissed, setDismissed] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (plan !== "trial" || !trialEndsAt || dismissed) return null;

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
