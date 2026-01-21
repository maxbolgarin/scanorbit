import { useEffect } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { LoginForm } from "@/components/auth/LoginForm";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { GitHubAuthButton } from "@/components/auth/GitHubAuthButton";
import { useAuthStore } from "@/stores/auth-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Orbit } from "lucide-react";

/**
 * Validate that a redirect path is internal to prevent open redirect attacks.
 * Only allows paths starting with "/" that don't contain protocol indicators.
 */
function isValidInternalPath(path: string | undefined): path is string {
  if (!path || typeof path !== "string") return false;
  // Must start with "/" and not contain protocol indicators
  return path.startsWith("/") && !path.includes("://") && !path.startsWith("//");
}

// OAuth error messages
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "Google sign-in was cancelled",
  oauth_failed: "Failed to sign in with Google. Please try again.",
  invalid_state: "Security validation failed. Please try again.",
  invalid_request: "Invalid request. Please try again.",
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { checkAuth } = useAuthStore();

  const requestedPath = (location.state as { from?: { pathname: string } })?.from?.pathname;
  const from = isValidInternalPath(requestedPath) ? requestedPath : "/overview";

  // Handle OAuth callback
  useEffect(() => {
    const oauthStatus = searchParams.get("oauth");
    const error = searchParams.get("error");

    if (oauthStatus === "success") {
      // OAuth was successful, refresh auth state and navigate
      checkAuth().then(() => {
        // Clear query params
        setSearchParams({}, { replace: true });
        navigate(from, { replace: true });
      });
    } else if (error) {
      // Show error message
      const message = OAUTH_ERROR_MESSAGES[error] || decodeURIComponent(error);
      toast({
        title: "Sign-in failed",
        description: message,
        type: "error",
      });
      // Clear the error from URL
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, checkAuth, navigate, from, setSearchParams]);

  const handleSuccess = () => {
    navigate(from, { replace: true });
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
          <CardHeader className="text-center">
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email/Password Form */}
            <LoginForm onSuccess={handleSuccess} />

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            {/* OAuth Sign-In Buttons */}
            <div className="space-y-2">
              <GoogleAuthButton mode="signin" />
              <GitHubAuthButton mode="signin" />
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
