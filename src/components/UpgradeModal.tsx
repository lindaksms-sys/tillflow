import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBusiness } from "@/hooks/useBusiness";
import { useAuth } from "@/hooks/useAuth";
import { CreditCard, Smartphone, Building2, MessageCircle, ExternalLink, Mail } from "lucide-react";

const WHATSAPP_NUMBER = "971525109164";

const paymentOptions = [
  {
    icon: CreditCard,
    title: "International Card / PayPal",
    desc: "Pay via PayPal — works from anywhere",
  },
  {
    icon: Smartphone,
    title: "Mobile Money",
    desc: "EcoCash, M-Pesa, MTN MoMo, Airtel Money",
  },
  {
    icon: Building2,
    title: "Bank Transfer / EFT",
    desc: "Local or international bank transfer",
  },
  {
    icon: MessageCircle,
    title: "Other",
    desc: "Get in touch and we'll figure it out",
  },
];

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const { businessName } = useBusiness();
  const { user } = useAuth();
  const email = user?.email || "";
  const biz = businessName || "My Business";

  const waText = encodeURIComponent(
    `Hi! I'd like to upgrade to TillFlow Pro ($2.99/month). My business name is ${biz} and my email is ${email}.`
  );
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

  const mailSubject = encodeURIComponent("TillFlow Pro Upgrade");
  const mailBody = encodeURIComponent(
    `Hi, I'd like to upgrade to TillFlow Pro. My business: ${biz}. Email: ${email}.`
  );
  const mailUrl = `mailto:info@creativehauz.space?subject=${mailSubject}&body=${mailBody}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Upgrade to TillFlow Pro — $2.99/month</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground">Let's get you on Pro</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose how you'd like to pay — we'll activate your account within 24 hours.
            </p>
          </div>

          <div className="grid gap-2">
            {paymentOptions.map((opt) => (
              <div
                key={opt.title}
                className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/10 transition-colors"
              >
                <opt.icon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{opt.title}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <Button className="w-full gap-2" asChild>
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4" />
                Chat With Us on WhatsApp →
              </a>
            </Button>
            <Button variant="outline" className="w-full gap-2" asChild>
              <a href={mailUrl}>
                <Mail className="w-4 h-4" />
                Email Us Instead
              </a>
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Questions? WhatsApp us at +971 52 510 9164 or email info@creativehauz.space
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
