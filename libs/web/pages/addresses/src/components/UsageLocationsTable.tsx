'use client';

import { UsageLocationRecord } from '@myorganizer/core';
import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@myorganizer/web-ui';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Edit, ExternalLink, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

import { titleCase } from '../utils/enumUtils';

export function UsageLocationsTable(props: {
  usageLocations: UsageLocationRecord[];
  onEdit: (location: UsageLocationRecord) => void;
  onDelete: (locationId: string) => void;
}) {
  const columns = useMemo<ColumnDef<UsageLocationRecord>[]>(
    () => [
      {
        accessorKey: 'organisationName',
        header: 'Organisation',
        cell: ({ row }) => (
          <div className="font-medium">{row.original.organisationName}</div>
        ),
      },
      {
        accessorKey: 'organisationType',
        header: 'Type',
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            {titleCase(row.original.organisationType)}
          </div>
        ),
      },
      {
        accessorKey: 'updateMethod',
        header: 'Update Method',
        cell: ({ row }) => (
          <div className="text-sm">{titleCase(row.original.updateMethod)}</div>
        ),
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ row }) => {
          const priority = row.original.priority;
          const colorClass =
            priority === 'high'
              ? 'text-red-600 bg-red-50'
              : priority === 'low'
              ? 'text-gray-600 bg-gray-50'
              : 'text-blue-600 bg-blue-50';
          return (
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${colorClass}`}
            >
              {titleCase(priority)}
            </span>
          );
        },
      },
      {
        accessorKey: 'link',
        header: 'Link',
        cell: ({ row }) =>
          row.original.link ? (
            <a
              href={row.original.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View
            </a>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          ),
      },
      {
        accessorKey: 'changed',
        header: 'Status',
        cell: ({ row }) =>
          row.original.changed ? (
            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
              Changed
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700">
              Pending
            </span>
          ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => props.onEdit(row.original)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
              <span className="sr-only">Edit</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => props.onDelete(row.original.id)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        ),
      },
    ],
    [props]
  );

  const table = useReactTable({
    data: props.usageLocations,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  if (props.usageLocations.length === 0) {
    return (
      <Card className="p-4">
        <CardTitle className="text-lg">Used at</CardTitle>
        <CardContent className="mt-4">
          <p className="text-sm text-muted-foreground">
            No usage locations yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <CardTitle className="text-lg mb-4">Used at</CardTitle>
      <CardContent className="p-0">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {table.getPageCount() > 1 && (
          <div className="flex items-center justify-between px-2 py-4">
            <div className="text-sm text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount()}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
