import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type TokenInfo =
  | { kind: "hash"; access_token: string; refresh_token: string }
  | { kind: "otp"; token_hash: string };

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [step, setStep] = useState<"loading" | "form" | "no-token">("loading");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    extractToken();
  }, []);

  async function extractToken() {
    // Clear any existing session on this device
    await supabase.auth.signOut();

    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(window.location.search);

    const hashAccessToken = hashParams.get("access_token");
    const hashRefreshToken = hashParams.get("refresh_token");
    const hashType = hashParams.get("type");

    const queryTokenHash = searchParams.get("token_hash") || searchParams.get("token");
    const queryType = searchParams.get("type");

    if (hashAccessToken && hashRefreshToken && hashType === "invite") {
      setTokenInfo({ kind: "hash", access_token: hashAccessToken, refresh_token: hashRefreshToken });
      setStep("form");
    } else if (queryTokenHash && queryType === "invite") {
      setTokenInfo({ kind: "otp", token_hash: queryTokenHash });
      setStep("form");
    } else {
      setStep("no-token");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!tokenInfo) {
      toast.error("No invite token found");
      return;
    }

    setSubmitting(true);
    try {
      // NOW authenticate using the stored token
      if (tokenInfo.kind === "hash") {
        const { error } = await supabase.auth.setSession({
          access_token: tokenInfo.access_token,
          refresh_token: tokenInfo.refresh_token,
        });
        if (error) {
          toast.error("This invitation link is invalid or has expired. Please ask your manager to resend.");
          setSubmitting(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenInfo.token_hash,
          type: "invite",
        });
        if (error) {
          toast.error("This invitation link is invalid or has expired. Please ask your manager to resend.");
          setSubmitting(false);
          return;
        }
      }

      // Set password and full name
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { full_name: fullName.trim() },
      });

      if (updateError) {
        toast.error(updateError.message);
        setSubmitting(false);
        return;
      }

      // Update business_members full_name
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("business_members")
          .update({ full_name: fullName.trim() })
          .eq("user_id", user.id);
      }

      // Sign out so they must log in with their new credentials
      await supabase.auth.signOut();
      window.location.hash = "";

      toast.success("Account created! You can now log in with your email and this password.");

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2000);
    } catch (err) {
      console.error("Setup error:", err);
      toast.error("Failed to set up your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (step === "no-token") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-xl">TF</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Invalid Invite Link</h1>
          <p className="text-muted-foreground text-sm">
            Your invite link may have expired or is invalid. Ask your manager to resend the invitation.
          </p>
          <Button onClick={() => navigate("/login", { replace: true })} className="w-full">
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-xl">TF</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Welcome to TillFlow</h1>
          <p className="text-muted-foreground text-sm">
            Set up your password to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              minLength={8}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Setting up..." : "Set Up My Account"}
          </Button>
        </form>
      </div>
    </div>
  );
}
