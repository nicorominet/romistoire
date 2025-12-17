import React, { useState, useMemo } from "react";
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
import {
  Pencil,
  Trash2,
  Loader2,
  ArrowLeft,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Series } from "@/types/Series";
import { useNavigate } from "react-router-dom";
import { useSeries, useSeriesMutations } from "@/hooks/useSeries";
import { SeriesDialog } from "@/components/Series/SeriesDialog";
import { SeriesDetailsDialog } from "@/components/Series/SeriesDetailsDialog";

type SortConfig = {
  key: "name" | "count" | "date";
  direction: "asc" | "desc";
};

const SeriesManagementPage = () => {
  const navigate = useNavigate();
  const t = (key: string, params?: any) => i18n.t(key, params);

  const { data: series = [], isLoading: loading } = useSeries();
  const { createSeries, updateSeries, deleteSeries } = useSeriesMutations();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "date",
    direction: "desc",
  });

  // Dialog States
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [viewingSeries, setViewingSeries] = useState<Series | null>(null);

  // Handlers
  const handleCreateSeries = async (data: { name: string; description?: string }) => {
    try {
      await createSeries.mutateAsync(data);
      toast.success(t("series.createSuccess"));
    } catch (e) {
      toast.error(t("series.management.createError"));
    }
  };

  const handleUpdateSeries = async (data: { name: string; description?: string }) => {
    if (!editingSeries) return;
    try {
      await updateSeries.mutateAsync({
        id: editingSeries.id,
        data: { ...editingSeries, ...data },
      });
      toast.success(t("series.updateSuccess"));
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

  // Sorting and Filtering
  const filteredAndSortedSeries = useMemo(() => {
    let result = [...(series || [])];

    // Filter
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(lowerQuery)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortConfig.key) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "count":
          comparison = (a.storyCount || 0) - (b.storyCount || 0);
          break;
        case "date":
          comparison =
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime();
          break;
      }
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });

    return result;
  }, [series, searchQuery, sortConfig]);

  const toggleSort = (key: SortConfig["key"]) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const SortIcon = ({ column }: { column: SortConfig["key"] }) => {
    if (sortConfig.key !== column)
      return <ArrowUpDown className="ml-2 h-3 w-3 inline text-gray-400" />;
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="ml-2 h-3 w-3 inline text-story-purple-600" />
    ) : (
      <ArrowDown className="ml-2 h-3 w-3 inline text-story-purple-600" />
    );
  };

  return (
    <PageLayout>
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold text-story-purple-800">
            {t("series.management.title")}
          </h1>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-story-purple hover:bg-story-purple-600"
        >
          {t("series.management.createButton")}
        </Button>
      </div>

      <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-xl border border-white/20 dark:border-white/10 shadow-lg p-6">
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
        ) : filteredAndSortedSeries.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {t("series.management.noSeries")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => toggleSort("name")}
                >
                  {t("series.management.table.name")}
                  <SortIcon column="name" />
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => toggleSort("count")}
                >
                  {t("series.management.table.stories")}
                  <SortIcon column="count" />
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => toggleSort("date")}
                >
                  {t("series.management.table.createdAt")}
                  <SortIcon column="date" />
                </TableHead>
                <TableHead className="text-right">
                  {t("series.management.table.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedSeries.map((s: Series) => (
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
                    {s.created_at
                      ? format(new Date(s.created_at), "PPP", {
                          locale: i18n.getCurrentLocale() === "fr" ? fr : enUS,
                        })
                      : "-"}
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
                        onClick={() => setEditingSeries(s)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("series.management.delete.title")}
                            </AlertDialogTitle>
                            <AlertDialogDescription
                              dangerouslySetInnerHTML={{
                                __html: t("series.management.delete.description", {
                                  name: s.name,
                                }),
                              }}
                            />
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t("series.management.delete.cancel")}
                            </AlertDialogCancel>
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

      {/* Dialogs */}
      <SeriesDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        mode="create"
        onSubmit={handleCreateSeries}
      />

      <SeriesDialog
        open={!!editingSeries}
        onOpenChange={(open) => !open && setEditingSeries(null)}
        mode="edit"
        initialData={editingSeries}
        onSubmit={handleUpdateSeries}
      />

      <SeriesDetailsDialog
        series={viewingSeries}
        open={!!viewingSeries}
        onOpenChange={(open) => !open && setViewingSeries(null)}
      />
    </PageLayout>
  );
};

export default SeriesManagementPage;
