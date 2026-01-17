import {
  Server,
  HardDrive,
  Database,
  FolderArchive,
  Globe,
  Shield,
  Wifi,
  Camera,
  Zap,
  FileText,
  Bell,
  User,
  UserCheck,
  FileKey,
  Key,
  ShieldCheck,
  Lock,
  KeyRound,
  Network,
  Router,
} from "lucide-react";
import type { ServiceType } from "@/types";
import { cn } from "@/lib/utils";

interface ServiceIconProps {
  service: ServiceType;
  className?: string;
}

const serviceIcons: Record<ServiceType, React.ElementType> = {
  ec2: Server,
  ebs: HardDrive,
  eip: Wifi,
  rds: Database,
  rds_snapshot: Camera,
  s3: FolderArchive,
  alb: Globe,
  acm: Shield,
  lambda: Zap,
  cloudwatch_logs: FileText,
  cloudwatch_alarm: Bell,
  iam_user: User,
  iam_role: UserCheck,
  iam_policy: FileKey,
  iam_access_key: Key,
  security_group: ShieldCheck,
  secret: Lock,
  kms_key: KeyRound,
  eni: Network,
  nat_gateway: Router,
};

const serviceColors: Record<ServiceType, string> = {
  ec2: "text-orange-500",
  ebs: "text-blue-500",
  eip: "text-pink-500",
  rds: "text-purple-500",
  rds_snapshot: "text-purple-400",
  s3: "text-green-500",
  alb: "text-cyan-500",
  acm: "text-yellow-500",
  lambda: "text-amber-500",
  cloudwatch_logs: "text-teal-500",
  cloudwatch_alarm: "text-red-500",
  iam_user: "text-indigo-500",
  iam_role: "text-indigo-400",
  iam_policy: "text-indigo-300",
  iam_access_key: "text-rose-500",
  security_group: "text-emerald-500",
  secret: "text-violet-500",
  kms_key: "text-slate-500",
  eni: "text-sky-500",
  nat_gateway: "text-lime-500",
};

export function ServiceIcon({ service, className }: ServiceIconProps) {
  const Icon = serviceIcons[service] || Server;
  const color = serviceColors[service] || "text-gray-500";

  return <Icon className={cn("h-5 w-5", color, className)} />;
}

export function getServiceLabel(service: ServiceType): string {
  const labels: Record<ServiceType, string> = {
    ec2: "EC2",
    ebs: "EBS",
    eip: "Elastic IP",
    rds: "RDS",
    rds_snapshot: "RDS Snapshot",
    s3: "S3",
    alb: "ALB",
    acm: "ACM",
    lambda: "Lambda",
    cloudwatch_logs: "CloudWatch Logs",
    cloudwatch_alarm: "CloudWatch Alarm",
    iam_user: "IAM User",
    iam_role: "IAM Role",
    iam_policy: "IAM Policy",
    iam_access_key: "Access Key",
    security_group: "Security Group",
    secret: "Secret",
    kms_key: "KMS Key",
    eni: "ENI",
    nat_gateway: "NAT Gateway",
  };
  return labels[service] || service.toUpperCase();
}
