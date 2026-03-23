import { useBusiness } from "@/hooks/useBusiness";

export type PlanLimits = {
  isFree: boolean;
  isPro: boolean;
  isTrial: boolean;
  effectivePlan: string;
  maxProducts: number;
  maxStaff: number;
  salesHistoryDays: number | null; // null = unlimited
  allowedPaymentMethods: string[];
  hasInsights: boolean;
  hasReceiptScan: boolean;
  hasBulkUpload: boolean;
};

export function usePlanLimits(): PlanLimits {
  const { plan, trialEndsAt } = useBusiness();

  // Determine effective plan: if trial has expired but DB hasn't caught up yet, treat as free
  let effectivePlan = plan || "free";
  if (effectivePlan === "trial" && trialEndsAt && new Date(trialEndsAt) < new Date()) {
    effectivePlan = "free";
  }

  const isFree = effectivePlan === "free";
  const isPro = effectivePlan === "pro";
  const isTrial = effectivePlan === "trial";

  return {
    isFree,
    isPro,
    isTrial,
    effectivePlan,
    maxProducts: isFree ? 50 : Infinity,
    maxStaff: isFree ? 1 : 10,
    salesHistoryDays: isFree ? 7 : null,
    allowedPaymentMethods: isFree ? ["cash"] : ["cash", "card", "mobile_money", "credit"],
    hasInsights: !isFree,
    hasReceiptScan: !isFree,
    hasBulkUpload: !isFree,
  };
}
