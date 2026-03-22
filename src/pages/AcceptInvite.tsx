import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"loading" | "form" | "error">("loading");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    handleInviteToken();
  }, []);

  async function handleInviteToken() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const type = params.get("type");

    if (!accessToken || type !== "invite") {
      // No invite token — redirect to login
      navigate("/", { replace: true });
      return;
    }

    try {
      // Clear any existing session first (e.g. owner's session)
      await supabase.auth.signOut();

      // Verify the invite token
      const { error } = await supabase.auth.verifyOtp({
        token_hash: accessToken,
        type: "invite",
      });

      if (error) {
        console.error("Invite verification error:", error);
        setErrorMsg("This invitation link is invalid or has expired. Please ask your manager to send a new invite.");
        setStep("error");
        return;
      }

      // Token verified — user is now signed in with a temporary session
      // Pre-fill name from user metadata if available
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.full_name) {
        setFullName(user.user_metadata.full_name);
      }

      setStep("form");
    } catch (err) {
      console.error("Invite processing error:", err);
      setErrorMsg("Something went wrong processing your invitation. Please try again.");
      setStep("error");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      // Update password and name
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { full_name: fullName.trim() },
      });

      if (updateError) {
        toast.error(updateError.message);
        setSubmitting(false);
        return;
      }

      // Update the business_members record with the entered name
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("business_members")
          .update({ full_name: fullName.trim() })
          .eq("user_id", user.id);
      }

      toast.success("Account set up successfully! Welcome to TillFlow.");
      
      // Clear hash from URL and redirect
      window.location.hash = "";
      navigate("/", { replace: true });
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

  if (step === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-semibold text-foreground">Invitation Error</h1>
          <p className="text-muted-foreground text-sm">{errorMsg}</p>
          <Button onClick={() => navigate("/", { replace: true })} className="w-full">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-lg">T</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Welcome to TillFlow</h1>
          <p className="text-muted-foreground text-sm">
            Set up your account to get started
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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              minLength={6}
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
            {submitting ? "Setting up..." : "Complete Setup"}
          </Button>
        </form>
      </div>
    </div>
  );
}
