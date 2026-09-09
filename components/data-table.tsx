'use client';

import * as React from 'react';
import {
  type ColumnDef,
  type SortingState,
  type OnChangeFn,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  /** Enables server-driven paging/sorting. When set, pass the matching state + handlers. */
  manual?: boolean;
  pageCount?: number;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  pageSize?: number;
  onRowClick?: (row: TData) => void;
  emptyMessage?: string;
}

export function DataTable<TData>({
  columns,
  data,
  manual = false,
  pageCount,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  pageSize = 25,
  onRowClick,
  emptyMessage = 'No rows.',
}: DataTableProps<TData>) {
  const [localSorting, setLocalSorting] = React.useState<SortingState>([]);
  const [localPagination, setLocalPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manual ? undefined : getSortedRowModel(),
    getPaginationRowModel: manual ? undefined : getPaginationRowModel(),
    manualSorting: manual,
    manualPagination: manual,
    pageCount: manual ? pageCount ?? -1 : undefined,
    state: {
      sorting: manual ? sorting : localSorting,
      pagination: manual ? pagination : localPagination,
    },
    onSortingChange: manual ? onSortingChange : setLocalSorting,
    onPaginationChange: manual ? onPaginationChange : setLocalPagination,
  });

  const rows = table.getRowModel().rows;
  const pageIndex = table.getState().pagination.pageIndex;
  const totalPages = table.getPageCount();

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id} className={cn(canSort && 'p-0')}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex h-10 w-full items-center gap-1.5 px-3 text-left uppercase tracking-wide hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(onRowClick && 'cursor-pointer')}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {pageIndex + 1} of {Math.max(totalPages, 1)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
