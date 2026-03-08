import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { completeOAuthSignup, setAccessToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Orbit } from "lucide-react";

export default function OAuthConsent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkAuth } = useAuthStore();

  const consentToken = searchParams.get("token");
  const provider = searchParams.get("provider") || "OAuth";

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!consentToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Invalid consent link. Please try signing up again.</p>
            <Button className="mt-4" onClick={() => navigate("/signup")}>
              Back to Sign Up
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!termsAccepted || !privacyAccepted) return;

    setIsSubmitting(true);
    try {
      const result = await completeOAuthSignup(consentToken);

      // Store the access token
      setAccessToken(result.accessToken);

      // Refresh auth state
      await checkAuth();

      toast({
        title: "Account created",
        description: "Welcome to ScanOrbit!",
        type: "success",
      });

      navigate("/onboarding/org");
    } catch (err) {
      toast({
        title: "Sign-up failed",
        description: err instanceof Error ? err.message : "Failed to create account. Please try again.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const providerName = provider === "google" ? "Google" : provider === "github" ? "GitHub" : provider;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              <Orbit className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">ScanOrbit</span>
            </div>

            <div className="text-center">
              <h2 className="text-lg font-semibold">Complete your sign-up</h2>
              <p className="text-sm text-muted-foreground mt-1">
                You're signing up with {providerName}. Please review and accept our policies to continue.
              </p>
            </div>

            <div className="w-full space-y-4 mt-2">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                label={
                  <span>
                    I agree to the{" "}
                    <Link to="https://scanorbit.cloud/terms" target="_blank" className="text-primary underline hover:no-underline">
                      Terms of Service
                    </Link>
                  </span>
                }
              />

              <Checkbox
                id="privacy"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                label={
                  <span>
                    I agree to the{" "}
                    <Link to="https://scanorbit.cloud/privacy" target="_blank" className="text-primary underline hover:no-underline">
                      Privacy Policy
                    </Link>
                    {" "}and{" "}
                    <Link to="https://scanorbit.cloud/cookies" target="_blank" className="text-primary underline hover:no-underline">
                      Cookie Policy
                    </Link>
                  </span>
                }
              />
            </div>

            <Button
              className="w-full mt-2"
              onClick={handleSubmit}
              disabled={!termsAccepted || !privacyAccepted || isSubmitting}
            >
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Changed your mind?{" "}
            <Link to="/login" className="text-primary underline hover:no-underline">
              Back to login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
