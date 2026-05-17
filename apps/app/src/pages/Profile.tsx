import { TeamSettings } from "@/components/settings/TeamSettings";

export default function Profile() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-muted-foreground">Manage your team members and invitations</p>
      </div>
      <TeamSettings />
    </div>
  );
}
