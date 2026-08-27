import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface TabsProps {
  value: string;
  onValueChange: (val: string) => void;
  children: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({ children }) => {
  return <div className="w-full space-y-2">{children}</div>;
};

export const TabsList: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div className={twMerge(clsx('inline-flex items-center p-1 bg-slate-100 border border-slate-200 rounded-lg', className))} {...props}>
    {children}
  </div>
);

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, className, children, ...props }) => (
  <button
    type="button"
    className={twMerge(
      clsx(
        'px-3 py-1.5 text-xs font-semibold rounded-md transition-all text-slate-600 hover:text-slate-900',
        className
      )
    )}
    {...props}
  >
    {children}
  </button>
);

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({ className, children, ...props }) => (
  <div className={twMerge(clsx('w-full', className))} {...props}>
    {children}
  </div>
);
