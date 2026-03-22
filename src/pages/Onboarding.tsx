import { useState } from "react";
import { useBusiness } from "@/hooks/useBusiness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export default function Onboarding() {
  const { onboard } = useBusiness();
  const [name, setName] = useState("");
  const [type, setType] = useState("retail");
  const [currency, setCurrency] = useState("USD");
  const [country, setCountry] = useState("Zimbabwe");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onboard(name.trim(), type, currency, country);
      toast.success("Business created!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create business");
    }
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
          <h1 className="text-3xl font-bold text-foreground" style={{ lineHeight: "1.1" }}>Set Up Your Business</h1>
          <p className="text-muted-foreground text-sm">Tell us about your business to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Business Name</label>
            <Input className="input-dark" value={name} onChange={e => setName(e.target.value)} placeholder="My Shop" required />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Business Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Currency</label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="ZWL">ZWL</SelectItem>
                <SelectItem value="ZAR">ZAR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Country</label>
            <Input className="input-dark" value={country} onChange={e => setCountry(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create Business"}
          </Button>
        </form>
      </div>
    </div>
  );
}
