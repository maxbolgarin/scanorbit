import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
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
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { GitHubAuthButton } from "@/components/auth/GitHubAuthButton";
import { useAuthStore } from "@/stores/auth-store";

type SignupStep = 1 | 2 | 3 | 4;

interface SignupState {
  email: string;
  signupToken: string;
  consent: boolean;
}

// Note: signupToken is intentionally NOT persisted to sessionStorage for security.
// Only non-sensitive data (step, email, consent) is persisted. The token lives only in memory.
interface PersistedSignupState {
  step: SignupStep;
  email: string;
  consent: boolean;
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

function savePersistedState(step: SignupStep, email: string, consent: boolean): void {
  // Only persist non-sensitive data - signupToken stays in memory only
  const persisted: PersistedSignupState = {
    step,
    email,
    consent,
    timestamp: Date.now(),
  };
  sessionStorage.setItem(SIGNUP_STATE_KEY, JSON.stringify(persisted));
}

function clearPersistedState(): void {
  sessionStorage.removeItem(SIGNUP_STATE_KEY);
}

// OAuth error messages
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "Google sign-up was cancelled",
  oauth_failed: "Failed to sign up with Google. Please try again.",
  invalid_state: "Security validation failed. Please try again.",
  invalid_request: "Invalid request. Please try again.",
};

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, hasOrg, checkAuth } = useAuthStore();

  // Handle OAuth callback
  useEffect(() => {
    const oauthStatus = searchParams.get("oauth");
    const error = searchParams.get("error");

    if (oauthStatus === "success") {
      // OAuth was successful, refresh auth state
      checkAuth().then(() => {
        // Clear query params
        setSearchParams({}, { replace: true });
        // Navigate based on org status (checkAuth will update hasOrg)
      });
    } else if (error) {
      // Show error message
      const message = OAUTH_ERROR_MESSAGES[error] || decodeURIComponent(error);
      toast({
        title: "Sign-up failed",
        description: message,
        type: "error",
      });
      // Clear the error from URL
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, checkAuth, setSearchParams]);

  // Load persisted state or use defaults
  const getInitialState = useCallback(() => {
    // If user is authenticated but has no org, they completed step 3 - show step 4
    if (isAuthenticated && !hasOrg) {
      return { step: 4 as SignupStep, email: "", signupToken: "", consent: true };
    }

    // Try to restore from sessionStorage
    const persisted = loadPersistedState();
    if (persisted) {
      // signupToken is not persisted for security - if user was on step 3,
      // they need to re-verify their email to get a new token
      if (persisted.step >= 3) {
        return { step: 2 as SignupStep, email: persisted.email, signupToken: "", consent: persisted.consent };
      }
      return {
        step: persisted.step,
        email: persisted.email,
        signupToken: "", // Token only lives in memory
        consent: persisted.consent,
      };
    }

    return { step: 1 as SignupStep, email: "", signupToken: "", consent: false };
  }, [isAuthenticated, hasOrg]);

  const initial = getInitialState();
  const [step, setStep] = useState<SignupStep>(initial.step);
  const [state, setState] = useState<SignupState>({
    email: initial.email,
    signupToken: initial.signupToken,
    consent: initial.consent,
  });

  // Persist state changes (without sensitive signupToken)
  useEffect(() => {
    if (step < 4) {
      savePersistedState(step, state.email, state.consent);
    }
  }, [step, state.email, state.consent]);

  const handleEmailNext = (email: string, consent: boolean) => {
    setState((prev) => ({ ...prev, email, consent }));
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
    navigate("/overview");
  };

  const handleBackToEmail = () => {
    clearPersistedState();
    setStep(1);
    setState({ email: "", signupToken: "", consent: false });
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
              <div className="space-y-6">
                {/* Header */}
                <div className="text-center">
                  <h2 className="text-lg font-semibold">Create your account</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Get started with ScanOrbit
                  </p>
                </div>

                {/* Email Step */}
                <EmailStep
                  onNext={handleEmailNext}
                  initialEmail={state.email}
                  initialConsent={state.consent}
                />

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Or sign up with
                    </span>
                  </div>
                </div>

                {/* OAuth Sign-Up Buttons */}
                <div className="space-y-2">
                  <GoogleAuthButton mode="signup" />
                  <GitHubAuthButton mode="signup" />
                </div>
              </div>
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
                consent={state.consent}
                onNext={handlePasswordNext}
                onTokenError={handleBackToEmail}
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
