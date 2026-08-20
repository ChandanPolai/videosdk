import React from 'react';
import { LogOut } from 'lucide-react';
import Button from './Button';

export const ConfirmLogoutModal = ({ open, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-6 animate-fade-in">
        <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
          <LogOut className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Logout?</h2>
        <p className="text-sm text-slate-500 mt-1.5 mb-6">
          Are you sure you want to logout from this account?
        </p>
        <div className="flex gap-3">
          <Button type="button" variant="ghost" fullWidth onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="danger" fullWidth onClick={onConfirm}>
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmLogoutModal;
