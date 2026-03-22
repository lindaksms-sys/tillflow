import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Layers, ShoppingCart, Receipt, Lightbulb, Users, Settings } from "lucide-react";
import { useBusiness } from "@/hooks/useBusiness";

const allTabs = [
  { path: "/", icon: LayoutDashboard, label: "Home", roles: ["owner", "manager", "cashier"] },
  { path: "/products", icon: Package, label: "Products", roles: ["owner", "manager"] },
  { path: "/stock", icon: Layers, label: "Stock", roles: ["owner", "manager", "cashier"] },
  { path: "/sales", icon: ShoppingCart, label: "Sales", roles: ["owner", "manager", "cashier"] },
  { path: "/expenses", icon: Receipt, label: "Expenses", roles: ["owner", "manager"] },
  { path: "/insights", icon: Lightbulb, label: "Insights", roles: ["owner", "manager"] },
  { path: "/staff", icon: Users, label: "Staff", roles: ["owner"] },
  { path: "/settings", icon: Settings, label: "Settings", roles: ["owner"] },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useBusiness();

  const tabs = allTabs.filter(t => role && t.roles.includes(role));

  return (
    <nav className="bottom-nav">
      <div className="flex justify-around items-center py-2 max-w-lg mx-auto">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-1.5 py-1 transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
