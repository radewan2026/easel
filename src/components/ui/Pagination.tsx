import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  position?: 'top' | 'bottom';
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  position = 'bottom',
}: PaginationProps) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  if (totalPages <= 1 && totalItems <= pageSize) return null;

  return (
    <div className={`flex items-center justify-between ${position === 'top' ? '' : position === 'bottom' ? 'pt-4' : ''}`}>
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Showing {startItem}–{endItem} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-1.5 rounded disabled:opacity-30 hover:bg-gray-100"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageNumbers.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e-${i}`} className="px-1" style={{ color: 'var(--text-muted)' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className="w-8 h-8 text-sm rounded"
              style={{
                backgroundColor: p === currentPage ? 'var(--primary-color)' : 'transparent',
                color: p === currentPage ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded disabled:opacity-30 hover:bg-gray-100"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}