import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface SignupProgressProps {
  currentStep: number;
  totalSteps: number;
}

const stepLabels = ["Email", "Verify", "Password", "Profile"];

export function SignupProgress({ currentStep, totalSteps }: SignupProgressProps) {
  return (
    <div className="mb-8 flex justify-center">
      <div className="flex items-start">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step, index) => (
          <div key={step} className="flex items-center">
            {/* Step with label underneath */}
            <div className="flex flex-col items-center min-w-[60px]">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                  step < currentStep
                    ? "border-primary bg-primary text-primary-foreground"
                    : step === currentStep
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
                )}
              >
                {step < currentStep ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step
                )}
              </div>
              <span
                className={cn(
                  "mt-2 text-xs font-medium",
                  step <= currentStep ? "text-primary" : "text-muted-foreground"
                )}
              >
                {stepLabels[index]}
              </span>
            </div>

            {/* Connector line */}
            {step < totalSteps && (
              <div
                className={cn(
                  "h-0.5 w-8 mt-[-24px]",
                  step < currentStep ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
