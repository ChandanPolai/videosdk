import React from 'react';
import Logo from '../ui/Logo';
import {
  Phone,
  PhoneCall,
  DoorOpen,
  Clapperboard,
  History,
  ScrollText,
  ChevronRight,
  ChevronLeft,
  X
} from 'lucide-react';

export const navItems = [
  { id: 'test-call', label: 'Test Call', icon: PhoneCall },
  { id: 'agent-script', label: 'Agent Script', icon: ScrollText },
  { id: 'calls', label: 'Call History', icon: Phone },
  { id: 'rooms', label: 'Rooms', icon: DoorOpen },
  { id: 'sessions', label: 'Sessions', icon: History },
  { id: 'recordings', label: 'Recordings', icon: Clapperboard }
];

export const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen, isCollapsed, onToggleCollapse }) => (
  <>
    {isOpen && (
      <div
        onClick={() => setIsOpen(false)}
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
      />
    )}

    <aside
      className={`fixed top-0 bottom-0 left-0 z-50 bg-white border-r border-slate-200/80 flex flex-col transition-all duration-300 ease-in-out lg:translate-x-0 ${
        isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      } ${isCollapsed ? 'lg:w-20' : 'lg:w-72'} w-72`}
    >
      <button
        onClick={onToggleCollapse}
        className="hidden lg:flex absolute -right-3.5 top-7 z-50 w-7 h-7 bg-white border border-slate-200 rounded-full shadow-md items-center justify-center text-slate-500 hover:text-brand-600"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div
        className={`h-20 flex items-center justify-between border-b border-slate-100 ${
          isCollapsed ? 'lg:px-3 px-6' : 'px-6'
        }`}
      >
        <Logo size="md" showText={!isCollapsed} />
        <button
          onClick={() => setIsOpen(false)}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                setActiveTab(item.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                active
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                  : item.disabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'
              } ${isCollapsed ? 'lg:justify-center' : ''}`}
              title={item.disabled ? 'Coming soon' : item.label}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className={`${isCollapsed ? 'lg:hidden' : ''} truncate`}>{item.label}</span>
              {item.disabled && !isCollapsed && (
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wide opacity-70">Soon</span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  </>
);

export default Sidebar;
