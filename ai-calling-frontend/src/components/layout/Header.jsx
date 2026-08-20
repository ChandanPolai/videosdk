import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, User } from 'lucide-react';
import ConfirmLogoutModal from '../ui/ConfirmLogoutModal';
import { getAuth, logout } from '../../utils/auth';

export const Header = ({ onToggleSidebar, activeTitle }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const menuRef = useRef(null);
  const auth = getAuth();
  const email = auth?.email || 'admin@gmail.com';
  const initial = email.charAt(0).toUpperCase();

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleLogout = () => {
    setConfirmOpen(false);
    setOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
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

        <div className="relative pl-2 border-l border-slate-200" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 sm:gap-3 rounded-xl px-1.5 py-1.5 hover:bg-slate-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center">
              {initial}
            </div>
            <div className="hidden md:block min-w-0 text-left">
              <p className="text-sm font-semibold text-slate-800 truncate max-w-[180px]">{email}</p>
              <p className="text-[11px] text-slate-500 truncate max-w-[180px]">Account active</p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/60 py-1.5 z-50 animate-fade-in">
              <div className="px-3 py-2.5 border-b border-slate-100">
                <p className="text-xs text-slate-400 font-medium">Signed in as</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{email}</p>
              </div>
              <div className="px-1.5 py-1.5">
                <div className="flex items-center gap-2.5 px-2.5 py-2 text-sm text-slate-600 rounded-lg">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Admin</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setConfirmOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <ConfirmLogoutModal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleLogout}
      />
    </>
  );
};

export default Header;
