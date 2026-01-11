import { Link, useNavigate, useLocation } from "react-router-dom";
import { LoginForm } from "@/components/auth/LoginForm";
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

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const requestedPath = (location.state as { from?: { pathname: string } })?.from?.pathname;
  const from = isValidInternalPath(requestedPath) ? requestedPath : "/dashboard";

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
          <CardContent>
            <LoginForm onSuccess={handleSuccess} />
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
