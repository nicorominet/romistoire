import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

export const StoryCardSkeleton = () => (
  <Card className="h-full flex flex-col overflow-hidden">
    <div className="aspect-[4/3] w-full relative overflow-hidden bg-muted">
         <Skeleton className="h-full w-full" />
    </div>
    <CardHeader className="p-4 pb-2 space-y-2">
       <div className="flex justify-between items-start">
         <Skeleton className="h-4 w-1/3" />
         <Skeleton className="h-4 w-8 rounded-full" />
       </div>
       <Skeleton className="h-6 w-3/4" />
    </CardHeader>
    <CardContent className="p-4 py-2 flex-grow space-y-2">
       <Skeleton className="h-4 w-full" />
       <Skeleton className="h-4 w-5/6" />
       <div className="flex gap-2 mt-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
       </div>
    </CardContent>
    <CardFooter className="p-4 pt-2 flex justify-between items-center">
       <Skeleton className="h-4 w-20" />
       <div className="flex gap-2">
         <Skeleton className="h-8 w-8 rounded-full" />
         <Skeleton className="h-8 w-8 rounded-full" />
       </div>
    </CardFooter>
  </Card>
);

export const StoryDetailSkeleton = () => (
    <div className="max-w-7xl mx-auto space-y-8 animate-pulse px-4 md:px-6">
        {/* Navigation Header */}
        <div className="flex items-center justify-between">
           <Skeleton className="h-10 w-24" />
           <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
           </div>
        </div>

        {/* Story Header */}
        <div className="space-y-4 text-center mb-8 flex flex-col items-center">
             <Skeleton className="h-10 w-1/2" />
             <div className="flex gap-2 justify-center">
                 <Skeleton className="h-6 w-16 rounded-full" />
                 <Skeleton className="h-6 w-16 rounded-full" />
             </div>
             <Skeleton className="h-20 w-3/4" />
        </div>

        {/* Content */}
        <div className="w-full space-y-4">
             <Skeleton className="h-64 w-full rounded-xl" />
             <Skeleton className="h-4 w-full" />
             <Skeleton className="h-4 w-full" />
             <Skeleton className="h-4 w-3/4" />
        </div>
    </div>
);
