import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Orbit } from "lucide-react";
import {
  SignupProgress,
  EmailStep,
  CodeStep,
  PasswordStep,
  ProfileStep,
} from "@/components/auth/signup";
import { useAuthStore } from "@/stores/auth-store";

type SignupStep = 1 | 2 | 3 | 4;

interface SignupState {
  email: string;
  signupToken: string;
}

interface PersistedSignupState {
  step: SignupStep;
  email: string;
  signupToken: string;
  timestamp: number;
}

const SIGNUP_STATE_KEY = "scanorbit_signup_state";
const STATE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

function loadPersistedState(): PersistedSignupState | null {
  try {
    const saved = sessionStorage.getItem(SIGNUP_STATE_KEY);
    if (!saved) return null;

    const parsed: PersistedSignupState = JSON.parse(saved);

    // Check if state has expired
    if (Date.now() - parsed.timestamp > STATE_EXPIRY_MS) {
      sessionStorage.removeItem(SIGNUP_STATE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function savePersistedState(step: SignupStep, state: SignupState): void {
  const persisted: PersistedSignupState = {
    step,
    email: state.email,
    signupToken: state.signupToken,
    timestamp: Date.now(),
  };
  sessionStorage.setItem(SIGNUP_STATE_KEY, JSON.stringify(persisted));
}

function clearPersistedState(): void {
  sessionStorage.removeItem(SIGNUP_STATE_KEY);
}

export default function Signup() {
  const navigate = useNavigate();
  const { isAuthenticated, hasOrg } = useAuthStore();

  // Load persisted state or use defaults
  const getInitialState = useCallback(() => {
    // If user is authenticated but has no org, they completed step 3 - show step 4
    if (isAuthenticated && !hasOrg) {
      return { step: 4 as SignupStep, email: "", signupToken: "" };
    }

    // Try to restore from sessionStorage
    const persisted = loadPersistedState();
    if (persisted) {
      // Don't restore step 3 without a valid signupToken
      if (persisted.step === 3 && !persisted.signupToken) {
        return { step: 2 as SignupStep, email: persisted.email, signupToken: "" };
      }
      return {
        step: persisted.step,
        email: persisted.email,
        signupToken: persisted.signupToken,
      };
    }

    return { step: 1 as SignupStep, email: "", signupToken: "" };
  }, [isAuthenticated, hasOrg]);

  const initial = getInitialState();
  const [step, setStep] = useState<SignupStep>(initial.step);
  const [state, setState] = useState<SignupState>({
    email: initial.email,
    signupToken: initial.signupToken,
  });

  // Persist state changes
  useEffect(() => {
    if (step < 4) {
      savePersistedState(step, state);
    }
  }, [step, state]);

  const handleEmailNext = (email: string) => {
    setState((prev) => ({ ...prev, email }));
    setStep(2);
  };

  const handleCodeNext = (signupToken: string) => {
    setState((prev) => ({ ...prev, signupToken }));
    setStep(3);
  };

  const handlePasswordNext = () => {
    setStep(4);
  };

  const handleComplete = () => {
    // Clear persisted state and redirect to dashboard
    clearPersistedState();
    navigate("/dashboard");
  };

  const handleBackToEmail = () => {
    clearPersistedState();
    setStep(1);
    setState({ email: "", signupToken: "" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <Orbit className="h-10 w-10 text-cyber-cyan" />
          <span className="text-2xl font-bold bg-gradient-to-r from-orbit-purple to-cyber-cyan bg-clip-text text-transparent">
            ScanOrbit
          </span>
        </div>

        <Card>
          <CardContent className="pt-6">
            {/* Progress indicator */}
            <SignupProgress currentStep={step} totalSteps={4} />

            {/* Step content */}
            {step === 1 && (
              <EmailStep
                onNext={handleEmailNext}
                initialEmail={state.email}
              />
            )}

            {step === 2 && (
              <CodeStep
                email={state.email}
                onNext={handleCodeNext}
                onBack={handleBackToEmail}
              />
            )}

            {step === 3 && (
              <PasswordStep
                signupToken={state.signupToken}
                email={state.email}
                onNext={handlePasswordNext}
              />
            )}

            {step === 4 && (
              <ProfileStep onComplete={handleComplete} />
            )}
          </CardContent>

          {step === 1 && (
            <CardFooter className="flex justify-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          )}
        </Card>

      </div>
    </div>
  );
}
