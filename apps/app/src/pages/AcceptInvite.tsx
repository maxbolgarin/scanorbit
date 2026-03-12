import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useAuthStore } from "@/stores/auth-store";
import * as api from "@/lib/api";
import { setAccessToken } from "@/lib/api";
import { Orbit, AlertTriangle } from "lucide-react";
import type { InviteInfo } from "@/types";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, refreshAuth } = useAuthStore();

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid invitation link");
      setLoading(false);
      return;
    }

    api
      .getInviteInfo(token)
      .then((info) => {
        setInviteInfo(info);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message || "This invitation is invalid or has expired");
        setLoading(false);
      });
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      const { accessToken } = await api.acceptInvitation(token);
      setAccessToken(accessToken);
      // Refresh auth store to pick up new org
      await refreshAuth();
      // Navigate to overview of the new org
      navigate("/overview", { replace: true });
    } catch (err) {
      setError((err as Error).message || "Failed to accept invitation");
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Orbit className="h-6 w-6 text-primary-foreground" />
          </div>
          {error ? (
            <>
              <CardTitle className="flex items-center justify-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Invitation Error
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </>
          ) : (
            <>
              <CardTitle>Join {inviteInfo?.orgName}</CardTitle>
              <CardDescription>
                {inviteInfo?.inviterName} invited you to join{" "}
                <strong>{inviteInfo?.orgName}</strong> on ScanOrbit
              </CardDescription>
            </>
          )}
        </CardHeader>

        {!error && inviteInfo && (
          <CardContent>
            {isAuthenticated ? (
              <Button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full"
                size="lg"
              >
                {accepting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Joining...
                  </>
                ) : (
                  `Accept & Join ${inviteInfo.orgName}`
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <Button asChild className="w-full" size="lg">
                  <Link
                    to="/signup"
                    state={{ from: { pathname: `/invite/${token}` } }}
                  >
                    Sign up to join {inviteInfo.orgName}
                  </Link>
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    state={{ from: { pathname: `/invite/${token}` } }}
                    className="text-primary hover:underline"
                  >
                    Log in
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        )}

        {error && (
          <CardFooter className="justify-center">
            <Button variant="outline" asChild>
              <Link to="/login">Go to Login</Link>
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
