import * as React from "react";
import { cn } from "./utils";
import { Label } from "./label";

interface FormFieldProps {
  label: React.ReactNode;
  required?: boolean;
  help?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Bloco label + controle + ajuda/erro do DS v3.
 * Estrutura fixa: gap de 4px; erro substitui a ajuda quando presente.
 */
export function FormField({
  label,
  required,
  help,
  error,
  htmlFor,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger-fg">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-[11px] font-medium text-danger-fg">
          {error}
        </p>
      ) : (
        help && <p className="text-[11px] text-muted-foreground">{help}</p>
      )}
    </div>
  );
}
