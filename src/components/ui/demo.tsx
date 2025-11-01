import React, { useState } from "react";
import Sidebar from "@/components/ui/sidebar";
import { Menu } from "lucide-react";

export function SidebarDemo() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-bg-primary text-primary">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setSidebarOpen} />
      <main className="flex-1 p-4 md:p-8">
        <header className="flex items-center justify-between md:justify-end mb-8">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-md text-secondary hover:text-primary hover:bg-bg-hover">
                <Menu />
            </button>
            <div className="flex items-center space-x-4">
                 <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=50&h=50&fit=crop&q=80" alt="User avatar" className="w-10 h-10 rounded-full object-cover" />
                <div>
                    <p className="font-semibold text-sm">Alex Johnson</p>
                    <p className="text-xs text-muted">alex.j@example.com</p>
                </div>
            </div>
        </header>

        <div className="space-y-8">
            <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-bg-secondary p-6 rounded-xl border border-border-primary shadow-sm">
                        <h3 className="font-semibold mb-2 text-primary">Card Title</h3>
                        <p className="text-secondary text-sm">This is a placeholder card to demonstrate the main content area layout.</p>
                    </div>
                ))}
            </div>

            <div className="bg-bg-secondary p-6 rounded-xl border border-border-primary shadow-sm">
                 <h3 className="font-semibold mb-4 text-primary">Content Area</h3>
                 <div className="h-64 bg-bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-muted">Main content goes here.</p>
                 </div>
            </div>
        </div>
      </main>
    </div>
  );
}
