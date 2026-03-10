import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "./AccountSwitcher";
import { useAccountContext } from "@/hooks/use-account-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Server,
  AlertTriangle,
  History,
  Cloud,
  Settings,
  Network,
  BookOpen,
  Users,
  MoreHorizontal,
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
      label: "Team",
      href: "/profile",
      icon: Users,
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
  const navigate = useNavigate();
  const { currentAccountId, isOrgOverview } = useAccountContext();

  // Build mobile nav items based on current context
  const basePrefix = isOrgOverview
    ? "/overview"
    : `/accounts/${currentAccountId}`;

  const mobileNavItems = [
    {
      label: isOrgOverview ? "Overview" : "Home",
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
  ];

  // Items in the "More" menu
  const moreMenuItems = [
    {
      label: "Infrastructure Map",
      href: `${basePrefix}/infrastructure-map`,
      icon: Network,
    },
    {
      label: "Scans",
      href: `${basePrefix}/scans`,
      icon: History,
    },
    { separator: true },
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
    { separator: true },
    {
      label: "Team",
      href: "/profile",
      icon: Users,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ];

  const isMoreActive = moreMenuItems.some(item =>
    !item.separator && (
      location.pathname === item.href ||
      (item.href !== "/accounts" && location.pathname.startsWith(item.href!))
    )
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm lg:hidden pb-[max(0.375rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-around py-1.5">
        {mobileNavItems.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.href
            : location.pathname.startsWith(item.href);

          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 transition-transform active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px]">{item.label}</span>
            </NavLink>
          );
        })}

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 transition-transform active:scale-95",
                isMoreActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px]">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-48 mb-2">
            {moreMenuItems.map((item, index) =>
              item.separator ? (
                <DropdownMenuSeparator key={`sep-${index}`} />
              ) : (
                <DropdownMenuItem
                  key={item.href}
                  onClick={() => navigate(item.href!)}
                  className={cn(
                    "gap-3",
                    location.pathname === item.href ||
                    (item.href !== "/accounts" && location.pathname.startsWith(item.href!))
                      ? "text-primary"
                      : ""
                  )}
                >
                  {item.icon && <item.icon className="h-4 w-4" />}
                  {item.label}
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
