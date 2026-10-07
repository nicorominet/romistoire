import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  id?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  /** Trigger text when several items are selected, e.g. "3 selected" */
  selectedLabel: (count: number) => string;
  selectAllLabel: string;
  clearLabel: string;
  disabled?: boolean;
}

/**
 * Multi-choice dropdown (checkbox list in a popover). Touch friendly, unlike <select multiple>.
 */
export const MultiSelect = ({
  id,
  options,
  value,
  onChange,
  placeholder,
  selectedLabel,
  selectAllLabel,
  clearLabel,
  disabled = false,
}: MultiSelectProps) => {
  const toggle = (optionValue: string, checked: boolean) => {
    // Keep the options order whatever the click order
    const next = checked ? [...value, optionValue] : value.filter(v => v !== optionValue);
    onChange(options.map(o => o.value).filter(v => next.includes(v)));
  };

  const triggerText = value.length === 0
    ? placeholder
    : value.length === 1
      ? options.find(o => o.value === value[0])?.label ?? value[0]
      : selectedLabel(value.length);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn("w-full justify-between font-normal", value.length === 0 && "text-muted-foreground")}
        >
          <span className="truncate">{triggerText}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex justify-between border-b px-3 py-2 text-xs">
          <button type="button" className="text-primary hover:underline" onClick={() => onChange(options.map(o => o.value))}>
            {selectAllLabel}
          </button>
          <button type="button" className="text-muted-foreground hover:underline" onClick={() => onChange([])}>
            {clearLabel}
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto p-1" role="listbox" aria-multiselectable="true">
          {options.map(option => {
            const checked = value.includes(option.value);
            const optionId = `${id ?? "multiselect"}-${option.value}`;
            return (
              <label
                key={option.value}
                htmlFor={optionId}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  id={optionId}
                  checked={checked}
                  onCheckedChange={(state) => toggle(option.value, state === true)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
