import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, Package } from "lucide-react";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = isSignUp ? await signUp(email, password) : await signIn(email, password);
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-primary">
            <Package className="w-8 h-8" />
            <BarChart3 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-foreground" style={{ lineHeight: '1.1' }}>StockIQ</h1>
          <p className="text-muted-foreground text-sm">Smart inventory for your business</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
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
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "..." : isSignUp ? "Create Account" : "Sign In"}
          </Button>
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
}
