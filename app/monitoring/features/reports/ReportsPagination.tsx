'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ReportsPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'reports',
  compact = false,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  compact?: boolean;
}) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className={compact ? 'flex items-center justify-between gap-2 border-t border-default px-3 py-2' : 'border-t border-default px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'}>
      <div className={compact ? 'min-w-0 text-[11px] tabular-nums text-muted-foreground' : 'text-sm text-muted-foreground'}>
        {compact ? `${startItem}–${endItem} of ${totalItems}` : `Showing ${startItem}-${endItem} of ${totalItems} ${itemLabel}`}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={compact ? 'rounded-lg border border-default p-1.5 text-secondary disabled:opacity-40' : 'inline-flex items-center gap-2 rounded-lg border border-default px-3 py-2 text-sm font-semibold text-secondary hover:bg-page disabled:cursor-not-allowed disabled:opacity-50'}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className={compact ? 'sr-only' : ''}>Previous</span>
        </button>

        <div className={compact ? 'text-[11px] font-medium tabular-nums text-secondary' : 'rounded-lg border border-default bg-page px-3 py-2 text-sm font-semibold text-secondary'}>
          Page {currentPage} of {totalPages}
        </div>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages || totalPages === 0}
          className={compact ? 'rounded-lg border border-default p-1.5 text-secondary disabled:opacity-40' : 'inline-flex items-center gap-2 rounded-lg border border-default px-3 py-2 text-sm font-semibold text-secondary hover:bg-page disabled:cursor-not-allowed disabled:opacity-50'}
        >
          <span className={compact ? 'sr-only' : ''}>Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
