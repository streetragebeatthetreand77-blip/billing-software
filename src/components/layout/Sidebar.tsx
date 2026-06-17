import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Store, Package, FileText, Users, RotateCcw, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const links = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Billing (POS)", href: "/pos", icon: Store },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Sales Records", href: "/sales-records", icon: FileText },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Return & Exchange", href: "/returns", icon: RotateCcw },
];

export function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const isAdmin = user?.email?.toLowerCase().includes("admin") ?? true;
  const roleName = isAdmin ? "Admin" : "Billing / Cashier";

  const filteredLinks = links.filter(link => {
    if (!isAdmin) {
      return ["Billing (POS)", "Return & Exchange"].includes(link.name);
    }
    return true;
  });

  return (
    <aside className="w-64 border-r border-[#E4E3E0] bg-[#FAFAFA] flex flex-col h-full">
      <div className="p-6 border-b border-[#E4E3E0]">
        <h1 className="font-sans font-bold tracking-tight text-xl text-[#141414] uppercase">
          STREET RAGE
        </h1>
        <p className="text-[10px] uppercase font-mono tracking-widest text-[#999999] mt-1">Retail Management Space</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {filteredLinks.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.href;
          return (
            <Link
              key={link.name}
              to={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-[#141414] text-white font-medium"
                  : "text-[#666666] hover:bg-[#E4E3E0] hover:text-[#141414]"
              )}
            >
              <Icon className="w-4 h-4" />
              {link.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-[#E4E3E0] space-y-3">
        <div>
          <div className="text-[10px] text-[#999999] font-mono uppercase tracking-wider">Logged in as</div>
          <div className="text-xs font-semibold text-[#141414] truncate" title={user?.email || "Offline User"}>
            {user?.email || "Offline User"}
          </div>
          <div className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono uppercase font-bold tracking-wider inline-block mt-1">
             {roleName}
          </div>
        </div>
        <button 
          onClick={() => {
            if (confirm("Are you sure you want to logout?")) {
              logout();
            }
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 rounded-md text-xs font-mono uppercase tracking-wider transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
