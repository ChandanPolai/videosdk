import React from 'react';
import { Menu } from 'lucide-react';

export const Header = ({ onToggleSidebar, activeTitle }) => (
  <header className="sticky top-0 z-30 h-16 sm:h-20 bg-white/90 backdrop-blur border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0">
      <button
        onClick={onToggleSidebar}
        className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="min-w-0">
        <h1 className="text-base sm:text-xl font-bold text-slate-800 truncate">{activeTitle}</h1>
        <p className="text-[11px] text-slate-500 hidden sm:block">AI Calling Agent Portal</p>
      </div>
    </div>

    <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
      <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center">
        B
      </div>
      <div className="hidden md:block min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate max-w-[160px]">bhavsarparth</p>
        <p className="text-[11px] text-slate-500 truncate max-w-[160px]">Account active</p>
      </div>
    </div>
  </header>
);

export default Header;
