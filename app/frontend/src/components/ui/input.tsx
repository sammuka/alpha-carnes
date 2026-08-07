import * as React from "react";

import { cn } from "./utils";

interface InputProps extends React.ComponentProps<"input"> {
  adornLeft?: React.ReactNode;
  adornRight?: React.ReactNode;
}

function Input({ className, type, adornLeft, adornRight, ...props }: InputProps) {
  const base = (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-8 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-[13px] text-foreground transition-[color,border-color,box-shadow] duration-100 outline-none",
        "placeholder:text-fg-faint selection:bg-primary selection:text-primary-foreground",
        "hover:not-focus:not-disabled:border-fg-faint",
        "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/35",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted-foreground",
        "read-only:bg-surface-2 read-only:text-fg-secondary",
        "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/25",
        adornLeft && "pl-8",
        adornRight && "pr-9 text-right font-data",
        className,
      )}
      {...props}
    />
  );

  if (!adornLeft && !adornRight) return base;

  return (
    <div className="relative flex w-full items-center">
      {adornLeft && (
        <span className="pointer-events-none absolute left-2.5 flex items-center text-fg-faint [&_svg]:size-3.5">
          {adornLeft}
        </span>
      )}
      {base}
      {adornRight && (
        <span className="pointer-events-none absolute right-2.5 text-xs font-semibold text-muted-foreground">
          {adornRight}
        </span>
      )}
    </div>
  );
}

export { Input };
