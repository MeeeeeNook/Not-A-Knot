import React from 'react';

export interface AdminTabHeaderProps {
  icon?: React.ReactNode;
  iconBgColor?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  eyebrow?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const AdminTabHeader: React.FC<AdminTabHeaderProps> = ({
  title,
  badge,
  actions,
  children,
  className = ''
}) => {
  return (
    <div className={`bg-white rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 border border-slate-200/80 shadow-2xs space-y-3 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            {title}
          </h2>
          {badge}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 self-start sm:self-auto">
            {actions}
          </div>
        )}
      </div>

      {children && (
        <div className="pt-2 border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  );
};
