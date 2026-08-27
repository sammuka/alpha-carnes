"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "./utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex items-end gap-0.5 border-b border-border bg-transparent p-0",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  temErro,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & { temErro?: boolean }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-[7px] text-[13px] font-medium text-muted-foreground transition-colors duration-100 outline-none hover:text-foreground focus-visible:rounded focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-primary-fg",
        temErro && "text-destructive data-[state=active]:border-destructive data-[state=active]:text-destructive",
        className,
      )}
      {...props}
    >
      {children}
      {temErro && (
        <span aria-label="Aba com campo inválido" className="size-1.5 rounded-full bg-destructive" />
      )}
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
