import React from 'react';

export const Card = ({ children, className = '', title, subtitle, action }) => (
  <div className={`card-aesthetic p-5 sm:p-6 ${className}`}>
    {(title || subtitle || action) && (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
        <div>
          {title && <h3 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h3>}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    )}
    {children}
  </div>
);

export default Card;
