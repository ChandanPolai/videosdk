import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Build page list like: 1 2 3 4 5 … 20 or 1 … 4 5 6 7 8 … 20 */
const buildPages = (current, lastPage, windowSize = 5) => {
  const last = Math.max(1, Number(lastPage) || 1);
  const cur = Math.min(Math.max(1, Number(current) || 1), last);

  if (last <= windowSize + 2) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }

  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, cur - half);
  let end = Math.min(last, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const pages = [];
  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('ellipsis-start');
  }
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < last) {
    if (end < last - 1) pages.push('ellipsis-end');
    pages.push(last);
  }
  return pages;
};

const Pagination = ({
  page = 1,
  lastPage = 1,
  total = 0,
  loading = false,
  onPageChange,
  itemLabel = 'items',
  windowSize = 5
}) => {
  const last = Math.max(1, Number(lastPage) || 1);
  const current = Math.min(Math.max(1, Number(page) || 1), last);
  const pages = useMemo(() => buildPages(current, last, windowSize), [current, last, windowSize]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100">
      <p className="text-sm text-slate-500">
        Showing page <span className="font-semibold text-slate-700">{current}</span> of{' '}
        <span className="font-semibold text-slate-700">{last}</span>
        {' · '}
        <span className="font-semibold text-slate-700">{total || 0}</span> total {itemLabel}
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
            <span key={item} className="px-1.5 text-slate-400 text-sm select-none">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              disabled={loading}
              onClick={() => onPageChange(item)}
              className={`min-w-9 h-9 px-2 rounded-lg text-xs font-bold transition-colors ${
                item === current
                  ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/25'
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
