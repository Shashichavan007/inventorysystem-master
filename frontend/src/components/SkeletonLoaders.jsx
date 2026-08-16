import React from 'react';

export const CardSkeleton = () => (
  <div className="card-surface p-6 space-y-4 animate-pulse">
    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
    <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
  </div>
);

export const ProductSkeleton = () => (
  <div className="card-surface p-5 space-y-4 animate-pulse">
    <div className="h-40 bg-slate-100 dark:bg-slate-800/80 rounded-xl"></div>
    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
    <div className="pt-4 flex justify-between items-center border-t border-slate-100 dark:border-slate-800">
      <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-20"></div>
      <div className="h-9 bg-slate-200 dark:bg-slate-800 rounded-xl w-28"></div>
    </div>
  </div>
);

export const TableSkeleton = () => (
  <div className="card-surface p-6 space-y-3 animate-pulse">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-full"></div>
    ))}
  </div>
);
