import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import UpgradeModal from "@/components/UpgradeModal";

interface UpgradeNudgeProps {
  message: string;
  className?: string;
  fullPage?: boolean;
}

export default function UpgradeNudge({ message, className = "", fullPage = false }: UpgradeNudgeProps) {
  const [open, setOpen] = useState(false);

  if (fullPage) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
        <Lock className="w-10 h-10 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
        <Button size="sm" onClick={() => setOpen(true)}>Upgrade to Pro</Button>
        <UpgradeModal open={open} onOpenChange={setOpen} />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
      <Lock className="w-3.5 h-3.5" />
      <span>{message}</span>
      <button onClick={() => setOpen(true)} className="underline text-primary hover:text-primary/80 transition-colors">
        Upgrade
      </button>
      <UpgradeModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
