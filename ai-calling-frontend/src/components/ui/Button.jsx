import React from 'react';

export const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  className = '',
  icon: Icon = null,
  onClick,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-btn transition-all duration-200 focus:outline-none active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none';

  const variants = {
    primary: 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/25',
    secondary: 'bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200',
    outline: 'border-2 border-brand-500 text-brand-600 hover:bg-brand-50',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    danger: 'bg-rose-500 hover:bg-rose-600 text-white'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs h-9',
    md: 'px-5 py-2.5 text-sm h-11',
    lg: 'px-6 py-3.5 text-base h-12'
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 mr-2 stroke-[2.2]" />}
      {children}
    </button>
  );
};

export default Button;
