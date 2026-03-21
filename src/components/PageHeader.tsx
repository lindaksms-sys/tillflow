import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";

export default function PageHeader({ title }: { title: string }) {
  const { signOut } = useAuth();
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-xl font-bold text-foreground" style={{ lineHeight: '1.2' }}>{title}</h1>
      <button onClick={signOut} className="text-muted-foreground hover:text-foreground transition-colors p-2">
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  );
}
