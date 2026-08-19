import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const buildPages = (lastPage, maxButtons = 50) => {
  const last = Math.max(1, Number(lastPage) || 1);
  const count = Math.min(last, maxButtons);
  const pages = Array.from({ length: count }, (_, i) => i + 1);
  if (last > maxButtons) {
    pages.push('ellipsis-end', last);
  }
  return pages;
};

const Pagination = ({
  page = 1,
  lastPage = 1,
  total = 0,
  loading = false,
  onPageChange,
  maxButtons = 50
}) => {
  const last = Math.max(1, Number(lastPage) || 1);
  const current = Math.min(Math.max(1, Number(page) || 1), last);
  const pages = useMemo(() => buildPages(last, maxButtons), [last, maxButtons]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100">
      <p className="text-sm text-slate-500">
        Showing page <span className="font-semibold text-slate-700">{current}</span> of{' '}
        <span className="font-semibold text-slate-700">{last}</span>
        {' · '}
        <span className="font-semibold text-slate-700">{total || 0}</span> total recordings
      </p>
      <div className="flex items-center gap-1 max-w-full overflow-x-auto pb-1">
        <button
          type="button"
          disabled={loading || current <= 1}
          onClick={() => onPageChange(current - 1)}
          className="inline-flex items-center justify-center h-9 px-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Prev
        </button>

        {pages.map((item) =>
          typeof item === 'string' ? (
            <span key={item} className="px-1.5 text-slate-400 text-sm">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              disabled={loading}
              onClick={() => onPageChange(item)}
              className={`min-w-9 h-9 px-2 rounded-lg text-xs font-bold ${
                item === current
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              } disabled:opacity-40`}
            >
              {item}
            </button>
          )
        )}

        <button
          type="button"
          disabled={loading || current >= last}
          onClick={() => onPageChange(current + 1)}
          className="inline-flex items-center justify-center h-9 px-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
