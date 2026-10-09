import React, { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { i18n } from '@/lib/i18n';
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Series } from '@/types/Series';

interface SeriesSelectorProps {
  series: Series[];
  /** Series name ("" = no series). A name that does not exist yet is created when the story is saved. */
  value?: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

/** Comparison key of a series name: case, accents and extra spaces ignored (like the database). */
export const seriesKey = (name: string) => name
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/\s+/g, " ").trim().toLowerCase();

const cleanName = (name: string) => name.replace(/\s+/g, " ").trim();

/**
 * SeriesSelector Component
 *
 * Picks an existing series, removes the series, or names a new one (created by the server when the
 * story is saved, see storySeriesHelper.resolveSeriesId). A typed name matching an existing series
 * (case and accents ignored) selects that series.
 */
export const SeriesSelector: React.FC<SeriesSelectorProps> = ({ series, value, onChange, isLoading, disabled = false }) => {
  const { t } = i18n;
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const typed = cleanName(inputValue);
  const existing = (name: string) => series.find((s) => seriesKey(s.name) === seriesKey(name));
  const isNew = Boolean(value) && !existing(value!);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setInputValue("");
  };

  const choose = (name: string) => {
    onChange(name);
    handleOpenChange(false);
  };

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={isLoading || disabled}
          >
            <span className="truncate">
              {value
                ? <>{existing(value)?.name || value}{isNew && <span className="ml-1 text-xs text-indigo-600 dark:text-indigo-400">({t("series.selector.newBadge")})</span>}</>
                : t("series.selector.placeholder")}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput
              placeholder={t('series.selector.searchPlaceholder')}
              className="h-9 glass-input"
              onValueChange={setInputValue}
              value={inputValue}
            />
            <CommandList>
              <CommandEmpty>
                <p className="px-2 text-sm text-gray-500">
                  {series.length === 0 && !typed ? t("series.selector.emptyHint") : t("series.selector.noSeriesFound")}
                </p>
              </CommandEmpty>

              {/* Always offered while typing a name that is not an existing series */}
              {typed && !existing(typed) && (
                <CommandGroup forceMount>
                  <CommandItem forceMount value={`__create__${typed}`} onSelect={() => choose(typed)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("series.selector.createNamed", { name: typed })}
                  </CommandItem>
                </CommandGroup>
              )}

              {value && !typed && (
                <CommandGroup forceMount>
                  <CommandItem forceMount value="__none__" onSelect={() => choose("")}>
                    <X className="mr-2 h-4 w-4" />
                    {t("series.selector.none")}
                  </CommandItem>
                </CommandGroup>
              )}

              {series.length > 0 && (
                <CommandGroup heading={t("series.selector.existingSeries")}>
                  {series.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={s.name}
                      onSelect={() => choose(s.name)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value && seriesKey(value) === seriesKey(s.name) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {s.name}
                      <span className="ml-2 text-xs text-gray-400">({s.storyCount || 0})</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {isNew && <p className="text-xs text-gray-500 dark:text-gray-400">{t("series.selector.newHint")}</p>}
    </div>
  );
};
