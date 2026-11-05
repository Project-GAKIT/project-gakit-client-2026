'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export function AdminPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'items',
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}) {
  if (totalItems === 0) return null;

  const pageCount = Math.max(1, totalPages);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-default px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-xs text-muted-foreground"
      >
        Showing <span className="font-semibold tabular-nums text-secondary">{startItem}–{endItem}</span>{' '}
        of <span className="font-semibold tabular-nums text-secondary">{totalItems}</span>{' '}
        {itemLabel}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-default bg-panel text-secondary transition-colors hover:border-default hover:bg-page hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        <span className="px-2 text-xs font-semibold tabular-nums text-secondary">
          Page {currentPage} of {pageCount}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
          disabled={currentPage >= pageCount}
          aria-label="Next page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-default bg-panel text-secondary transition-colors hover:border-default hover:bg-page hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
