import Skeleton from './Skeleton'

export const ChannelCardSkeleton = () => (
  <div className="bg-slate-800 rounded-lg overflow-hidden">
    <Skeleton className="aspect-video w-full" />
    <div className="p-4 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-12 rounded-full" />
      </div>
    </div>
  </div>
)

export const VideoCardSkeleton = () => (
  <div className="bg-slate-800 rounded-lg overflow-hidden">
    <div className="relative">
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="absolute bottom-2 right-2 h-5 w-12 rounded" />
    </div>
    <div className="p-4 space-y-3">
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex items-center gap-2">
        <Skeleton variant="circular" className="h-6 w-6" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  </div>
)

export const ChannelGridSkeleton = ({ count = 8 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <ChannelCardSkeleton key={i} />
    ))}
  </div>
)

export const VideoGridSkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <VideoCardSkeleton key={i} />
    ))}
  </div>
)

export const ListItemSkeleton = () => (
  <div className="flex items-center gap-4 p-4 bg-slate-800 rounded-lg">
    <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
    <Skeleton className="h-8 w-20 rounded" />
  </div>
)

export const ListSkeleton = ({ count = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <ListItemSkeleton key={i} />
    ))}
  </div>
)

export default {
  ChannelCardSkeleton,
  VideoCardSkeleton,
  ChannelGridSkeleton,
  VideoGridSkeleton,
  ListItemSkeleton,
  ListSkeleton
}
