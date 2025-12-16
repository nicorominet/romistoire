import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const ThemeSkeleton = () => {
  return (
    <Card className="h-full border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <Skeleton className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-t-lg" />
      <CardHeader className="p-4 pb-2 space-y-2">
        <Skeleton className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700" />
        <Skeleton className="h-3 w-1/2 bg-gray-100 dark:bg-gray-700" />
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="flex justify-between items-center mt-4">
             <Skeleton className="h-3 w-16 bg-gray-100 dark:bg-gray-700" />
             <Skeleton className="h-6 w-20 bg-gray-100 dark:bg-gray-700 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
};

export const ThemeGridSkeleton = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <ThemeSkeleton key={i} />
      ))}
    </div>
  );
};

export default ThemeSkeleton;
