import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, checked: controlledChecked, ...props }, ref) => {
    // Use internal state only for uncontrolled mode
    const [internalChecked, setInternalChecked] = React.useState(
      controlledChecked ?? props.defaultChecked ?? false
    );

    // Determine if controlled or uncontrolled
    const isControlled = controlledChecked !== undefined;
    const checked = isControlled ? controlledChecked : internalChecked;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setInternalChecked(e.target.checked);
      }
      props.onChange?.(e);
    };

    return (
      <label
        htmlFor={id}
        className={cn(
          "flex items-start gap-3 cursor-pointer",
          props.disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <div className="relative flex-shrink-0">
          <input
            type="checkbox"
            ref={ref}
            id={id}
            className="sr-only peer"
            checked={checked}
            {...props}
            onChange={handleChange}
          />
          <div
            className={cn(
              "h-5 w-5 rounded border-2 border-border transition-colors",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
              checked
                ? "bg-primary border-primary"
                : "bg-input hover:border-primary/50"
            )}
          >
            {checked && (
              <Check className="h-4 w-4 text-primary-foreground absolute top-0.5 left-0.5" />
            )}
          </div>
        </div>
        {label && (
          <span className="text-sm text-foreground leading-tight">{label}</span>
        )}
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
