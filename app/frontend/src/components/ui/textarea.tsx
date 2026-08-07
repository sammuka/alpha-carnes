import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full rounded-md border border-input bg-card px-2.5 py-2 text-[13px] leading-[1.4] text-foreground transition-[color,border-color,box-shadow] duration-100 outline-none resize-y",
        "placeholder:text-fg-faint",
        "hover:not-focus:not-disabled:border-fg-faint",
        "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/35",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted-foreground",
        "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/25",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
