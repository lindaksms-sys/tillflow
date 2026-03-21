import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Layers, ShoppingCart, Receipt, Lightbulb } from "lucide-react";

const tabs = [
  { path: "/", icon: LayoutDashboard, label: "Home" },
  { path: "/products", icon: Package, label: "Products" },
  { path: "/stock", icon: Layers, label: "Stock" },
  { path: "/sales", icon: ShoppingCart, label: "Sales" },
  { path: "/expenses", icon: Receipt, label: "Expenses" },
  { path: "/insights", icon: Lightbulb, label: "Insights" },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="bottom-nav">
      <div className="flex justify-around items-center py-2 max-w-lg mx-auto">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${
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
