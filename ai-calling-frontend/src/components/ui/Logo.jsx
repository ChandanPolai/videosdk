import React from 'react';
import { PhoneCall } from 'lucide-react';

export const Logo = ({ size = 'md', showText = true }) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className={`${sizes[size] || sizes.md} rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-md shadow-brand-500/30 shrink-0`}
      >
        <PhoneCall className="w-5 h-5" />
      </div>
      {showText && (
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-900 leading-tight truncate">bhavsarparth</p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">AI Calling</p>
        </div>
      )}
    </div>
  );
};

export default Logo;
