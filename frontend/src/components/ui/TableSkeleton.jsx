import Skeleton from './Skeleton'

const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-slate-700">
      <thead className="bg-slate-800">
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} className="px-6 py-3 text-left">
              <Skeleton className="h-4 w-20" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-700">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <tr key={rowIndex} className="bg-slate-800/50">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <td key={colIndex} className="px-6 py-4 whitespace-nowrap">
                <Skeleton
                  className={`h-4 ${
                    colIndex === 0 ? 'w-32' : colIndex === columns - 1 ? 'w-16' : 'w-24'
                  }`}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export const StatCardSkeleton = () => (
  <div className="bg-slate-800 rounded-lg p-6">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16" />
      </div>
      <Skeleton variant="circular" className="h-12 w-12" />
    </div>
  </div>
)

export const StatGridSkeleton = ({ count = 4 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <StatCardSkeleton key={i} />
    ))}
  </div>
)

export const DashboardSkeleton = () => (
  <div className="space-y-6">
    <StatGridSkeleton />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-slate-800 rounded-lg p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <TableSkeleton rows={5} columns={3} />
      </div>
      <div className="bg-slate-800 rounded-lg p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <TableSkeleton rows={5} columns={3} />
      </div>
    </div>
  </div>
)

export default TableSkeleton
