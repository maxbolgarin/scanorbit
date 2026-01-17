import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "./AccountSwitcher";
import { useAccountContext } from "@/hooks/use-account-context";
import {
  LayoutDashboard,
  Server,
  AlertTriangle,
  History,
  Cloud,
  Settings,
  Network,
  BookOpen,
} from "lucide-react";

export function Sidebar() {
  const location = useLocation();
  const { currentAccountId, isOrgOverview } = useAccountContext();

  // Build navigation items based on current context
  const getContextNavItems = () => {
    const basePrefix = isOrgOverview
      ? "/overview"
      : `/accounts/${currentAccountId}`;

    return [
      {
        label: isOrgOverview ? "Overview" : "Dashboard",
        href: basePrefix,
        icon: LayoutDashboard,
        exact: true,
      },
      {
        label: "Resources",
        href: `${basePrefix}/resources`,
        icon: Server,
      },
      {
        label: "Infrastructure Map",
        href: `${basePrefix}/infrastructure-map`,
        icon: Network,
      },
      {
        label: "Findings",
        href: `${basePrefix}/findings`,
        icon: AlertTriangle,
      },
      {
        label: "Scans",
        href: `${basePrefix}/scans`,
        icon: History,
      },
    ];
  };

  const contextNavItems = getContextNavItems();

  const staticNavItems = [
    {
      label: "AWS Accounts",
      href: "/accounts",
      icon: Cloud,
    },
    {
      label: "Docs",
      href: "/docs",
      icon: BookOpen,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ];

  const isNavItemActive = (href: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-muted/30 lg:block">
      <nav className="flex flex-col gap-1 p-4">
        {/* Account Switcher at top */}
        <div className="mb-4">
          <AccountSwitcher />
        </div>

        {/* Context-aware nav items */}
        {contextNavItems.map((item) => {
          const isActive = isNavItemActive(item.href, item.exact);

          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          );
        })}

        {/* Separator */}
        <div className="my-2 border-t" />

        {/* Static nav items */}
        {staticNavItems.map((item) => {
          const isActive =
            location.pathname === item.href ||
            (item.href !== "/accounts" &&
              location.pathname.startsWith(item.href));

          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const location = useLocation();
  const { currentAccountId, isOrgOverview } = useAccountContext();

  // Build mobile nav items based on current context
  const basePrefix = isOrgOverview
    ? "/overview"
    : `/accounts/${currentAccountId}`;

  const mobileNavItems = [
    {
      label: isOrgOverview ? "Overview" : "Dashboard",
      href: basePrefix,
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: "Resources",
      href: `${basePrefix}/resources`,
      icon: Server,
    },
    {
      label: "Findings",
      href: `${basePrefix}/findings`,
      icon: AlertTriangle,
    },
    {
      label: "Scans",
      href: `${basePrefix}/scans`,
      icon: History,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background lg:hidden">
      <div className="flex items-center justify-around py-2">
        {mobileNavItems.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.href
            : location.pathname.startsWith(item.href);

          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
