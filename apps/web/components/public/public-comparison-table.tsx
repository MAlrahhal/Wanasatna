import Link from 'next/link';
import { cn } from '@/lib/utils';

export type PublicComparisonRow = {
  href?: string;
  cells: readonly string[];
};

type PublicComparisonTableProps = {
  caption: string;
  columns: readonly string[];
  rows: readonly PublicComparisonRow[];
  className?: string;
};

export function PublicComparisonTable({
  caption,
  columns,
  rows,
  className,
}: PublicComparisonTableProps) {
  return (
    <div className={cn('border-wanas-border overflow-x-auto rounded-[20px] border', className)}>
      <table className="w-full min-w-[36rem] text-start text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-wanas-hero text-wanas-text-primary">
            {columns.map((column) => (
              <th key={column} scope="col" className="px-4 py-3 font-extrabold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-wanas-text-secondary">
          {rows.map((row) => (
            <tr key={row.cells.join('-')} className="border-wanas-border border-t">
              {row.cells.map((cell, index) => (
                <td key={`${row.cells[0]}-${index}`} className="px-4 py-3 align-top leading-6">
                  {index === 0 && row.href ? (
                    <Link
                      href={row.href}
                      className="text-wanas-primary-dark font-bold underline-offset-2 hover:underline"
                    >
                      {cell}
                    </Link>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
