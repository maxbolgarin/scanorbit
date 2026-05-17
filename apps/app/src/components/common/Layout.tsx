import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar, MobileNav } from "./Sidebar";

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto pb-16 lg:pb-0">
          <div className="w-full max-w-7xl mx-auto p-3 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
