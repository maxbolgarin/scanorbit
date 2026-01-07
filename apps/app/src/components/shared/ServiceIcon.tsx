import {
  Server,
  HardDrive,
  Database,
  FolderArchive,
  Globe,
  Shield,
  Wifi,
  Camera,
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
  rds: Database,
  s3: FolderArchive,
  alb: Globe,
  acm: Shield,
  eip: Wifi,
  snapshot: Camera,
};

const serviceColors: Record<ServiceType, string> = {
  ec2: "text-orange-500",
  ebs: "text-blue-500",
  rds: "text-purple-500",
  s3: "text-green-500",
  alb: "text-cyan-500",
  acm: "text-yellow-500",
  eip: "text-pink-500",
  snapshot: "text-gray-500",
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
    rds: "RDS",
    s3: "S3",
    alb: "ALB",
    acm: "ACM",
    eip: "Elastic IP",
    snapshot: "Snapshot",
  };
  return labels[service] || service.toUpperCase();
}
