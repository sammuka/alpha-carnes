"use client";

import * as React from "react";
import { format, parse, subDays } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "./utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DatePickerFieldProps {
  /** Valor ISO `yyyy-MM-dd` (contrato idêntico ao <input type="date">). Vazio = sem data. */
  value: string;
  onChange: (isoDate: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
}

function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function DatePickerField({
  value,
  onChange,
  id,
  disabled,
  className,
  ...aria
}: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false);
  const selected = isoToDate(value);

  const pick = (d: Date | undefined) => {
    onChange(d ? format(d, "yyyy-MM-dd") : "");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          data-slot="date-picker-trigger"
          className={cn(
            "flex h-8 w-[150px] items-center gap-2 rounded-md border border-input bg-card px-2.5 text-[13px] transition-[border-color,box-shadow] duration-100 outline-none",
            "hover:not-disabled:border-fg-faint",
            "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/35",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted-foreground",
            "aria-invalid:border-destructive",
            className,
          )}
          {...aria}
        >
          <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn("font-data", !selected && "text-fg-faint")}>
            {selected ? format(selected, "dd/MM/yyyy") : "dd/mm/aaaa"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar mode="single" selected={selected} onSelect={pick} defaultMonth={selected} />
        <div className="flex gap-1.5 border-t border-border p-2">
          <Button variant="ghost" size="sm" type="button" onClick={() => pick(new Date())}>
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => pick(subDays(new Date(), 1))}
          >
            Ontem
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="ml-auto"
            onClick={() => pick(undefined)}
          >
            Limpar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
