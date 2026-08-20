import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Logo from '../ui/Logo';
import ConfirmLogoutModal from '../ui/ConfirmLogoutModal';
import {
  LayoutDashboard,
  Phone,
  PhoneCall,
  DoorOpen,
  Clapperboard,
  History,
  ScrollText,
  ChevronRight,
  ChevronLeft,
  LogOut,
  X
} from 'lucide-react';
import { logout } from '../../utils/auth';

export const navItems = [
  { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'test-call', path: '/test-call', label: 'Test Call', icon: PhoneCall },
  { id: 'agent-script', path: '/agent-script', label: 'Agent Script', icon: ScrollText },
  { id: 'calls', path: '/calls', label: 'Call History', icon: Phone },
  { id: 'rooms', path: '/rooms', label: 'Rooms', icon: DoorOpen },
  { id: 'sessions', path: '/sessions', label: 'Sessions', icon: History },
  { id: 'recordings', path: '/recordings', label: 'Recordings', icon: Clapperboard }
];

export const Sidebar = ({ isOpen, setIsOpen, isCollapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleLogout = () => {
    setConfirmOpen(false);
    setIsOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  return (
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
            return (
              <NavLink
                key={item.id}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                      : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'
                  } ${isCollapsed ? 'lg:justify-center' : ''}`
                }
                title={item.label}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className={`${isCollapsed ? 'lg:hidden' : ''} truncate`}>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className={`border-t border-slate-100 p-3 ${isCollapsed ? 'lg:px-2' : ''}`}>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            title="Logout"
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-all ${
              isCollapsed ? 'lg:justify-center' : ''
            }`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className={`${isCollapsed ? 'lg:hidden' : ''} truncate`}>Logout</span>
          </button>
        </div>
      </aside>

      <ConfirmLogoutModal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleLogout}
      />
    </>
  );
};

export default Sidebar;
