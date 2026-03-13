import * as React from "react";
import { cn } from "@/lib/utils";

const Card = ({ ref, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.RefObject<HTMLDivElement | null> }) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      className
    )}
    {...props}
  />
);
Card.displayName = "Card";

const CardHeader = ({ ref, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.RefObject<HTMLDivElement | null> }) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-4 sm:p-6", className)}
    {...props}
  />
);
CardHeader.displayName = "CardHeader";

const CardTitle = ({ ref, className, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { ref?: React.RefObject<HTMLParagraphElement | null> }) => (
  <h3
    ref={ref}
    className={cn("font-bold leading-none tracking-tight text-card-foreground", className)}
    {...props}
  />
);
CardTitle.displayName = "CardTitle";

const CardDescription = ({ ref, className, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { ref?: React.RefObject<HTMLParagraphElement | null> }) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
);
CardDescription.displayName = "CardDescription";

const CardContent = ({ ref, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.RefObject<HTMLDivElement | null> }) => (
  <div ref={ref} className={cn("px-4 pb-4 sm:px-6 sm:pb-6", className)} {...props} />
);
CardContent.displayName = "CardContent";

const CardFooter = ({ ref, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.RefObject<HTMLDivElement | null> }) => (
  <div
    ref={ref}
    className={cn("flex items-center px-4 pb-4 sm:px-6 sm:pb-6", className)}
    {...props}
  />
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
