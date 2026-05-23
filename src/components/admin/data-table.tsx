'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  totalCount: number;
  pageSize: number;
  currentPage: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  searchQuery?: string;
  searchPlaceholder?: string;
  isLoading?: boolean;
  rowActions?: (row: T) => React.ReactNode;
  getRowKey: (row: T) => string;
}

// ============================================================
// Component
// ============================================================

export function DataTable<T>({
  columns,
  data,
  totalCount,
  pageSize,
  currentPage,
  sortBy,
  sortOrder = 'asc',
  searchQuery = '',
  searchPlaceholder = 'Search...',
  isLoading,
  rowActions,
  getRowKey,
}: DataTableProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchQuery);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const loading = isLoading || isPending;

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== searchQuery) {
        updateParams({ q: search || undefined, page: '1' });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams]
  );

  const handleSort = (key: string) => {
    const newOrder = sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc';
    updateParams({ sort: key, order: newOrder, page: '1' });
  };

  const handlePageChange = (page: number) => {
    updateParams({ page: String(page) });
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        {loading && <Loader2 className="size-4 animate-spin text-gray-400" />}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.className || ''}`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                      >
                        {col.label}
                        {sortBy === col.key ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-30" />
                        )}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
                {rowActions && (
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-[80px]">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (rowActions ? 1 : 0)}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {loading ? 'Loading...' : 'No results found'}
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={getRowKey(row)}
                    className="hover:bg-gray-50/60 transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={`px-4 py-3.5 text-gray-700 ${col.className || ''}`}>
                        {col.render
                          ? col.render(row)
                          : String((row as Record<string, unknown>)[col.key] ?? '')}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="px-4 py-3.5 text-right">
                        {rowActions(row)}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Showing {data.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
          {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
        </p>
        <div className="flex items-center gap-1">
          <PaginationBtn disabled={currentPage <= 1} onClick={() => handlePageChange(1)}>
            <ChevronsLeft className="size-4" />
          </PaginationBtn>
          <PaginationBtn disabled={currentPage <= 1} onClick={() => handlePageChange(currentPage - 1)}>
            <ChevronLeft className="size-4" />
          </PaginationBtn>
          <span className="px-3 text-xs font-medium text-gray-600">
            {currentPage} / {totalPages}
          </span>
          <PaginationBtn disabled={currentPage >= totalPages} onClick={() => handlePageChange(currentPage + 1)}>
            <ChevronRight className="size-4" />
          </PaginationBtn>
          <PaginationBtn disabled={currentPage >= totalPages} onClick={() => handlePageChange(totalPages)}>
            <ChevronsRight className="size-4" />
          </PaginationBtn>
        </div>
      </div>
    </div>
  );
}

function PaginationBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
