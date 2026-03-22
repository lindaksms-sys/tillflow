import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, Package } from "lucide-react";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSignUpSuccess(false);
    const { error } = isSignUp ? await signUp(email, password) : await signIn(email, password);
    if (error) {
      setError(error.message);
    } else if (isSignUp) {
      setSignUpSuccess(true);
    }
    setLoading(false);
  };

  const buildGoogleFallbackUrl = () => {
    const state =
      typeof crypto !== "undefined" && "getRandomValues" in crypto
        ? [...crypto.getRandomValues(new Uint8Array(16))]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("")
        : `${Date.now()}`;

    const params = new URLSearchParams({
      provider: "google",
      redirect_uri: window.location.origin,
      prompt: "select_account",
      state,
    });

    return `/~oauth/initiate?${params.toString()}`;
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");

    const forceRedirectFallback = () => {
      window.location.assign(buildGoogleFallbackUrl());
    };

    try {
      console.log("Starting Google sign-in...");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      console.log("Google sign-in result:", result);

      if (result?.error) {
        const message = result.error.message || "Google sign-in failed";
        const lowerMessage = message.toLowerCase();

        if (
          lowerMessage.includes("popup") ||
          lowerMessage.includes("cancelled") ||
          lowerMessage.includes("legacy_flow")
        ) {
          forceRedirectFallback();
          return;
        }

        setError(message);
      }
    } catch (err: unknown) {
      console.error("Google sign-in error:", err);
      setError(err instanceof Error ? err.message : "Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-primary">
            <Package className="w-8 h-8" />
            <BarChart3 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-foreground" style={{ lineHeight: '1.1' }}>TillFlow</h1>
          <p className="text-muted-foreground text-sm">Know your stock. Own your profit.</p>
        </div>

        <div className="glass-card p-6 space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-3"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {googleLoading ? "Signing in..." : "Continue with Google"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-dark"
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-dark"
              required
              minLength={6}
            />
            {signUpSuccess && (
              <div className="bg-primary/10 border border-primary/20 rounded-md p-3 text-sm text-foreground">
                <p className="font-medium">Check your email</p>
                <p className="text-muted-foreground mt-1">
                  We've sent a confirmation link to <strong>{email}</strong>. Please check your inbox (and spam folder) to verify your account before signing in.
                </p>
              </div>
            )}
            {forgotSent && (
              <div className="bg-primary/10 border border-primary/20 rounded-md p-3 text-sm text-foreground">
                <p className="font-medium">Password reset email sent</p>
                <p className="text-muted-foreground mt-1">
                  Check your inbox (and spam folder) at <strong>{email}</strong> for a link to reset your password.
                </p>
              </div>
            )}
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
              {loading ? "..." : isSignUp ? "Create Account" : "Sign In"}
            </Button>
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(""); setSignUpSuccess(false); }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </button>
            {!isSignUp && (
              <button
                type="button"
                onClick={async () => {
                  if (!email) {
                    setError("Enter your email address first");
                    return;
                  }
                  setLoading(true);
                  setError("");
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  setLoading(false);
                  if (error) {
                    setError(error.message);
                  } else {
                    setSignUpSuccess(false);
                    setError("");
                    setForgotSent(true);
                  }
                }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot password?
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}