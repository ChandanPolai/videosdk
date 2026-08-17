import React, { useState } from 'react';
import Sidebar, { navItems } from './Sidebar';
import Header from './Header';

export const Layout = ({ children, activeTab, setActiveTab }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const currentItem = navItems.find((item) => item.id === activeTab);
  const activeTitle = currentItem ? currentItem.label : 'AI Calling';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isCollapsed ? 'lg:pl-20' : 'lg:pl-72'
        }`}
      >
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} activeTitle={activeTitle} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
