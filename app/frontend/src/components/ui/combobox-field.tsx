"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { cn } from "./utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface ComboboxItem {
  id: string;
  label: string;
  sublabel?: string;
}

interface ComboboxFieldProps {
  items: ComboboxItem[];
  /** id do item selecionado; '' = nenhum. */
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
}

export function ComboboxField({
  items,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  id,
  disabled,
  className,
  clearable,
}: ComboboxFieldProps) {
  const [open, setOpen] = React.useState(false);
  const selected = items.find((i) => i.id === value);

  return (
    <div className={cn("relative w-full", className)}>
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          data-slot="combobox-trigger"
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-md border border-input bg-card px-2.5 text-[13px] transition-[border-color,box-shadow] duration-100 outline-none",
            "hover:not-disabled:border-fg-faint",
            "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/35",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted-foreground",
          )}
        >
          <span className={cn("flex-1 truncate text-left", !selected && "text-fg-faint")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-fg-faint" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-8 text-[13px]" />
          <CommandList className="max-h-56">
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
              {emptyText}
            </CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.sublabel ?? ""}`}
                  onSelect={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "gap-2 text-[13px]",
                    item.id === value && "bg-primary-soft font-semibold text-primary-fg",
                  )}
                >
                  <Check
                    className={cn("size-3.5", item.id === value ? "opacity-100" : "opacity-0")}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.sublabel && (
                    <span className="font-data text-[11px] text-muted-foreground">
                      {item.sublabel}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    {clearable && value ? (
      <button
        type="button"
        aria-label="Limpar seleção"
        className="absolute top-1/2 right-8 -translate-y-1/2"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onChange('');
        }}
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    ) : null}
    </div>
  );
}
