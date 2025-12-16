import React, { useState } from "react";
import { i18n } from "@/lib/i18n";
import PageLayout from "@/components/Layout/PageLayout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Loader2, ArrowLeft, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Series } from "@/types/Series";
import { useNavigate } from "react-router-dom";
import { useSeries, useSeriesMutations } from "@/hooks/useSeries";
import { useStories } from "@/hooks/useStories";

const SeriesManagementPage = () => {
  const navigate = useNavigate();
  // Helper for translation
  const t = (key: string, params?: any) => i18n.t(key, params);

  const { data: series = [], isLoading: loading } = useSeries();
  const { createSeries, updateSeries, deleteSeries } = useSeriesMutations();

  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [newName, setNewName] = useState("");
  const [searchQuery, setSearchQuery] = useState(""); 
  
  // Edit State
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  
  // Create State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState("");

  const [viewingSeries, setViewingSeries] = useState<Series | null>(null);

  const handleEditClick = (s: Series) => {
    setEditingSeries(s);
    setNewName(s.name);
    setIsRenameDialogOpen(true);
  };

  const handleUpdateSeries = async () => {
    if (!editingSeries || !newName.trim()) return;

    try {
      await updateSeries.mutateAsync({ id: editingSeries.id, data: { name: newName, description: editingSeries.description } });
      toast.success(t("series.updateSuccess"));
      setIsRenameDialogOpen(false);
    } catch (error) {
      toast.error(t("series.management.updateError"));
    }
  };

  const handleDeleteSeries = async (id: string) => {
    try {
       await deleteSeries.mutateAsync(id);
       toast.success(t("series.deleteSuccess"));
    } catch (error) {
       toast.error(t("series.management.deleteError"));
    }
  };

  const handleCreateSeries = async () => {
      if (!newSeriesName.trim()) return;
      
      try {
          await createSeries.mutateAsync({ name: newSeriesName });
          toast.success(t("series.createSuccess"));
          setIsCreateDialogOpen(false);
          setNewSeriesName("");
      } catch (e) {
          toast.error(t("series.management.createError"));
      }
  };

  const filteredSeries = (series || []).filter((s: Series) => 
     s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageLayout>
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold text-story-purple-800">{t("series.management.title")}</h1>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-story-purple hover:bg-story-purple-600">
           {t("series.management.createButton")}
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-md shadow p-4">
        <div className="mb-4">
            <Input 
               placeholder={t("series.management.searchPlaceholder")} 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="max-w-sm"
            />
        </div>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredSeries.length === 0 ? (
          <p className="text-center text-gray-500 py-8">{t("series.management.noSeries")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("series.management.table.name")}</TableHead>
                <TableHead>{t("series.management.table.stories")}</TableHead>
                <TableHead>{t("series.management.table.createdAt")}</TableHead>
                <TableHead className="text-right">{t("series.management.table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSeries.map((s: Series) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                      <span 
                         className="cursor-pointer hover:text-story-purple-600 hover:underline"
                         onClick={() => navigate(`/stories?seriesId=${s.id}`)}
                      >
                         {s.name}
                      </span>
                  </TableCell>
                  <TableCell>{s.storyCount}</TableCell>
                  <TableCell>
                    {s.created_at ? format(new Date(s.created_at), "PPP", { locale: i18n.getCurrentLocale() === 'fr' ? fr : enUS }) : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                       <Button
                        variant="ghost"
                        size="icon"
                        title={t("series.management.kpi.viewStats")}
                        onClick={() => setViewingSeries(s)}
                      >
                        <Eye className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(s)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("series.management.delete.title")}</AlertDialogTitle>
                            <AlertDialogDescription dangerouslySetInnerHTML={{ __html: t("series.management.delete.description", { name: s.name }) }} />
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("series.management.delete.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteSeries(s.id)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              {t("series.management.delete.confirm")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

       {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("series.management.rename.title")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                {t("series.management.table.name")}
              </Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateSeries}>{t("series.management.rename.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("series.management.create.title")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newSeriesName" className="text-right">
                {t("series.management.table.name")}
              </Label>
              <Input
                id="newSeriesName"
                value={newSeriesName}
                onChange={(e) => setNewSeriesName(e.target.value)}
                className="col-span-3"
                placeholder={t("series.management.create.placeholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateSeries}>{t("series.management.create.action")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <SeriesDetailsDialog 
         series={viewingSeries}
         open={!!viewingSeries}
         onOpenChange={(open) => !open && setViewingSeries(null)}
      />

    </PageLayout>
  );
};

// Sub-component for Series Details
function SeriesDetailsDialog({ series, open, onOpenChange }: { series: Series | null, open: boolean, onOpenChange: (open: boolean) => void }) {
    const t = (key: string, params?: any) => i18n.t(key, params);
    
    // We use useStories hook. But we need to pass seriesId.
    // useStories params expects { seriesId: string, limit: number }
    // Only fetch when open and series exists.
    const { data: storiesData, isLoading: loading } = useStories(
        series && open ? { seriesId: series.id, limit: 100 } : {}, 
        { enabled: !!(series && open) }
    );
    
    const stories = (storiesData as any)?.data || [];
    // Note: useStories returns { data, pagination }. So storiesData.data is the array.

    if (!series) return null;

    // Calculate KPIs
    const totalStories = stories.length;
    const uniqueWeeks = Array.from(new Set(stories.map((s: any) => s.week_number))).sort((a: any,b: any) => a - b);
    
    // Group by Week
    const storiesByWeek: Record<number, any[]> = {};
    const storiesByAge: Record<string, number> = {};

    stories.forEach((s: any) => {
        if (!storiesByWeek[s.week_number]) storiesByWeek[s.week_number] = [];
        storiesByWeek[s.week_number].push(s);

        if (s.age_group) {
            storiesByAge[s.age_group] = (storiesByAge[s.age_group] || 0) + 1;
        }
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-story-purple-800">{series.name}</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <div className="space-y-6 overflow-y-auto pr-2">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                             <div className="bg-purple-50 dark:bg-slate-800 p-4 rounded-lg border border-purple-100 dark:border-slate-700">
                                 <p className="text-sm text-gray-500 dark:text-gray-400">{t("series.management.kpi.totalStories")}</p>
                                 <p className="text-2xl font-bold text-story-purple-600">{totalStories}</p>
                             </div>
                             <div className="bg-blue-50 dark:bg-slate-800 p-4 rounded-lg border border-blue-100 dark:border-slate-700">
                                 <p className="text-sm text-gray-500 dark:text-gray-400">{t("series.management.kpi.weeksCovered")}</p>
                                 <p className="text-2xl font-bold text-blue-600">{uniqueWeeks.length}</p>
                             </div>
                             
                             <div className="bg-green-50 dark:bg-slate-800 p-4 rounded-lg border border-green-100 dark:border-slate-700 col-span-2 md:col-span-1">
                                 <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t("series.management.kpi.ages")}</p>
                                 <div className="flex flex-wrap gap-1">
                                     {Object.entries(storiesByAge).map(([age, count]) => (
                                         <span key={age} className="text-xs bg-white dark:bg-slate-900 border border-green-200 dark:border-green-900 rounded px-1.5 py-0.5 whitespace-nowrap">
                                             {age}: <strong>{count}</strong>
                                         </span>
                                     ))}
                                     {Object.keys(storiesByAge).length === 0 && <span className="text-xs text-gray-400">-</span>}
                                 </div>
                             </div>
                        </div>

                        {/* Breakdown */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">{t("series.management.kpi.timelineCoverage")}</h3>
                            
                            {uniqueWeeks.length === 0 && <p className="text-gray-500 italic">{t("series.management.kpi.noStories")}</p>}

                            {uniqueWeeks.map((week: any) => (
                                <div key={week} className="border rounded-md p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded dark:bg-gray-700 dark:text-gray-300">
                                            {t("series.management.kpi.week")} {week}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2 border-l-2 border-gray-100">
                                        {storiesByWeek[week].sort((a,b) => a.day_order - b.day_order).map(story => (
                                            <div key={story.id} className="text-sm flex items-center justify-between gap-2 p-1 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <span className="text-xs text-gray-400 w-6 flex-shrink-0">{t("series.management.kpi.day")} {story.day_order}</span>
                                                    <span className="truncate font-medium">{story.title}</span>
                                                </div>
                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 rounded text-slate-500 flex-shrink-0">
                                                    {story.age_group}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default SeriesManagementPage;
