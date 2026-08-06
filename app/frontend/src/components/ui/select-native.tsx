import * as React from "react";

import { cn } from "./utils";

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236E7E92' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

interface SelectNativeProps extends React.ComponentProps<"select"> {
  selectSize?: "default" | "sm";
}

function SelectNative({ className, selectSize = "default", ...props }: SelectNativeProps) {
  return (
    <select
      data-slot="select-native"
      style={{ backgroundImage: CHEVRON }}
      className={cn(
        "w-full appearance-none rounded-md border border-input bg-card bg-no-repeat pl-2.5 pr-7 text-[13px] text-foreground transition-[border-color,box-shadow] duration-100 outline-none [background-position:right_8px_center]",
        selectSize === "default" ? "h-8" : "h-7 text-xs",
        "hover:not-focus:not-disabled:border-fg-faint",
        "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/35",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted-foreground",
        "aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { SelectNative };
