import { Link, useLocation } from "wouter";
import {
  Network,
  BrainCircuit,
  FileText,
  Boxes,
  MessageSquare,
  Layers,
  LayoutDashboard,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealthCheck } from "@workspace/api-client-react";
import { useState, useEffect } from "react";

function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("kspace-theme");
    return saved ? saved === "dark" : true;
  });

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.remove("light");
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
      html.classList.add("light");
    }
    localStorage.setItem("kspace-theme", isDark ? "dark" : "light");
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((v) => !v) };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();
  const { isDark, toggle } = useTheme();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/notes", label: "Notes", icon: FileText },
    { href: "/blocks", label: "Blocks", icon: Boxes },
    { href: "/graph", label: "Knowledge Graph", icon: Network },
    { href: "/flashcards", label: "Flashcards", icon: Layers },
    { href: "/mindmaps", label: "Mind Maps", icon: BrainCircuit },
    { href: "/chat", label: "AI Chat", icon: MessageSquare },
  ];

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <aside className="w-60 border-r border-border bg-sidebar flex flex-col justify-between shrink-0">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-lg">
              K
            </div>
            <div>
              <div className="font-bold text-base tracking-tight leading-tight">K-Space</div>
              <div className="text-[10px] text-muted-foreground">Personal Knowledge OS</div>
            </div>
          </div>

          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive =
                location === item.href ||
                (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all cursor-pointer font-medium",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-5 border-t border-sidebar-border space-y-3">
          <button
            onClick={toggle}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                health?.status === "ok" ? "bg-green-500" : "bg-destructive"
              )}
            />
            System {health?.status === "ok" ? "Online" : "Offline"}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
        {children}
      </main>
    </div>
  );
}
