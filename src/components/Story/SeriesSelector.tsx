import React, { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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

// Removed local Series interface

interface SeriesSelectorProps {
  series: Series[];
  value?: string; // Series Name (or ID? Plan says Name for creation, logic handles lookup)
  onChange: (value: string) => void;
  isLoading?: boolean;
}

export const SeriesSelector: React.FC<SeriesSelectorProps> = ({ series, value, onChange, isLoading }) => {
  const { t } = i18n;
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleSelect = (currentValue: string) => {
    onChange(currentValue);
    setOpen(false);
  };

  const handleCreateRequest = () => {
      if (inputValue.trim()) {
          onChange(inputValue.trim());
          setOpen(false);
      }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={isLoading}
        >
          {value
            ? series.find((s) => s.name === value)?.name || value
            : t("series.selector.placeholder")}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput 
            placeholder={t('series.management.searchPlaceholder')} 
            className="h-9 glass-input"
            onValueChange={setInputValue} 
            value={inputValue}
          />
          <CommandList>
            <CommandEmpty>
                <div className="p-2">
                    <p className="text-sm text-gray-500 mb-2">{t("series.selector.noSeriesFound")}</p>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="w-full justify-start"
                        onClick={handleCreateRequest}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        {t("series.selector.create")} "{inputValue}"
                    </Button>
                </div>
            </CommandEmpty>
            <CommandGroup heading={t("series.selector.existingSeries")}>
              {series.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.name}
                  onSelect={(currentValue) => handleSelect(s.name)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === s.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {s.name}
                  <span className="ml-2 text-xs text-gray-400">({s.storyCount || 0})</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
