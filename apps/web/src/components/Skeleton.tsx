type SkeletonProps = {
  className?: string
}

export const Skeleton = ({ className = "" }: SkeletonProps) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
)

export const CardSkeleton = () => (
  <div className="card space-y-3">
    <Skeleton className="h-6 w-2/3" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-4/5" />
  </div>
)

export const ListSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className="space-y-3">
    {[...Array(count)].map((_, i) => (
      <Skeleton key={i} className="h-16" />
    ))}
  </div>
)

export const ChatSkeleton = () => (
  <div className="flex-1 p-4 space-y-4">
    <div className="flex justify-end">
      <Skeleton className="h-16 w-2/3 rounded-lg" />
    </div>
    <div className="flex justify-start">
      <Skeleton className="h-24 w-3/4 rounded-lg" />
    </div>
    <div className="flex justify-end">
      <Skeleton className="h-12 w-1/2 rounded-lg" />
    </div>
  </div>
)

export const PageSkeleton = () => (
  <div className="p-4 lg:p-6 space-y-6">
    <Skeleton className="h-8 w-48" />
    <div className="grid gap-4 md:grid-cols-2">
      <CardSkeleton />
      <CardSkeleton />
    </div>
  </div>
)
