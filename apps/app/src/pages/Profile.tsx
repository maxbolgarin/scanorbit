import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Calendar, Settings } from "lucide-react";
import { getInitials, formatDate } from "@/lib/utils";

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">View your account information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-2xl">
                {user ? getInitials(user.fullName || user.email) : "?"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-4 text-center sm:text-left">
              <div>
                <h2 className="text-xl font-semibold">
                  {user?.fullName || "No name set"}
                </h2>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-muted-foreground sm:justify-start">
                  <Mail className="h-4 w-4" />
                  <span>{user?.email}</span>
                </div>

                {user?.createdAt && (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground sm:justify-start">
                    <Calendar className="h-4 w-4" />
                    <span>Member since {formatDate(user.createdAt)}</span>
                  </div>
                )}
              </div>

              <Button onClick={() => navigate("/settings")} className="gap-2">
                <Settings className="h-4 w-4" />
                Edit Profile
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
