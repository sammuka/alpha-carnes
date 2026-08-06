"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";

import { cn } from "./utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      className={cn("p-2.5", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-2",
        caption: "relative flex h-7 items-center justify-center",
        caption_label: "text-[13px] font-bold",
        nav: "flex items-center",
        nav_button:
          "absolute inline-flex size-7 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-surface-3 hover:text-foreground",
        nav_button_previous: "left-0",
        nav_button_next: "right-0",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell:
          "w-8 pb-1 text-center text-[10px] font-bold uppercase text-fg-faint",
        row: "mt-0.5 flex",
        cell: "p-0",
        day: cn(
          "size-8 rounded-md font-data text-xs text-foreground transition-colors",
          "hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35",
        ),
        day_selected:
          "bg-primary font-bold text-primary-foreground hover:bg-primary-hover",
        day_today: "font-bold text-primary-fg shadow-[inset_0_0_0_1px_var(--color-primary)]",
        day_outside: "text-fg-faint",
        day_disabled: "text-fg-faint opacity-50",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="size-4" />,
        IconRight: () => <ChevronRight className="size-4" />,
      }}
      {...props}
    />
  );
}

export { Calendar };
