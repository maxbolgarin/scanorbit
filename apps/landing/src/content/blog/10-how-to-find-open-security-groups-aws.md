---
title: "How to Find and Fix Open Security Groups in AWS"
description: "Open security groups are one of the most common AWS misconfigurations. Learn how to detect port 22, 3389, and 0.0.0.0/0 exposure using the Console and CLI."
link: "how-to-find-open-security-groups-aws"
pubDate: 2026-04-03
author: "Maksim"
tags: ["aws", "security groups", "cloud security", "aws misconfiguration", "network security"]
draft: false
---

Open security groups are among the most common AWS security misconfigurations found in production environments. A single inbound rule allowing `0.0.0.0/0` on port 22 exposes your EC2 instances to every scanner and brute-force bot on the internet. It happens gradually — an engineer opens SSH access for a quick debugging session and forgets to close it. A staging environment gets a permissive rule that's never tightened. Multiply that across dozens of instances and multiple AWS regions, and you have a serious attack surface hiding in plain sight.

This guide shows you how to find and fix open security groups in AWS using both the Console and CLI — and how to automate the process so nothing slips through.

## Why Open Security Groups Are a Real Threat

An AWS [security group](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html) acts as a virtual firewall for your EC2 instances. Each inbound rule specifies which traffic is allowed to reach your instance. When the source is set to `0.0.0.0/0`, it means every IP address on the internet can reach that port.

Automated scanners like Shodan and Censys index newly exposed services within minutes. If you open port 22 to the world at 2pm, brute-force attempts will start by 2:15pm. This isn't theoretical — it's measurable.

### The Most Dangerous Open Ports

Not all open ports carry the same risk. These are the ones that should never be exposed to `0.0.0.0/0`:

- **Port 22 (SSH)** — the primary target for credential brute-forcing and the most common entry point for lateral movement
- **Port 3389 (RDP)** — Windows Remote Desktop, a favorite delivery vector for ransomware
- **Port 3306 (MySQL) / 5432 (PostgreSQL)** — direct database access means direct data exfiltration
- **Port 27017 (MongoDB)** — default MongoDB port, frequently found exposed with no authentication
- **Port 0–65535 (all traffic)** — the worst case, sometimes set accidentally when engineers copy rules between environments

Ports 80 and 443 are often intentionally public for web servers, but even these deserve a review to confirm the exposure is deliberate.

## How to Find Open Security Groups in the AWS Console

The AWS Console provides a visual way to inspect security groups, though it requires manual effort across regions.

### Using the VPC Console

1. Sign in to the AWS Console and navigate to **VPC** (search "VPC" in the top bar)
2. In the left sidebar, click **Security Groups** under the "Security" section
3. Click any security group to open its detail panel
4. Select the **Inbound rules** tab
5. Look for rules where the **Source** column shows `0.0.0.0/0` or `::/0`
6. Flag any rule where that open source is paired with ports 22, 3389, 3306, 5432, or a wide port range

### The Cross-Region Problem

Here's where it gets tedious. The AWS Console shows security groups for one region at a time. If your organization uses 5 regions and has 40 security groups per region, you need to manually inspect 200 security groups — switching regions each time using the dropdown in the top-right corner.

There is no built-in cross-region view for security groups in the AWS Console. If you've ever done this manually, you know how easy it is to skip a region or miss a rule.

## How to Find Open Security Groups Using the AWS CLI

The CLI is significantly faster than clicking through the Console. You can query security groups programmatically and even loop across all regions.

### List All Security Groups with 0.0.0.0/0 Inbound Rules

```bash
aws ec2 describe-security-groups \
  --query "SecurityGroups[?IpPermissions[?IpRanges[?CidrIp=='0.0.0.0/0']]].{ID:GroupId,Name:GroupName}" \
  --output table
```

This JMESPath query filters for any security group with at least one inbound rule sourced from `0.0.0.0/0` and returns a clean table with the group ID and name.

### Check for Port 22 Open to the Internet

```bash
aws ec2 describe-security-groups \
  --filters "Name=ip-permission.cidr,Values=0.0.0.0/0" \
            "Name=ip-permission.from-port,Values=22" \
            "Name=ip-permission.to-port,Values=22" \
  --query "SecurityGroups[*].{ID:GroupId,Name:GroupName}" \
  --output table
```

### Scan Across All AWS Regions

```bash
for region in $(aws ec2 describe-regions --query "Regions[*].RegionName" --output text); do
  echo "--- $region ---"
  aws ec2 describe-security-groups \
    --region "$region" \
    --filters "Name=ip-permission.cidr,Values=0.0.0.0/0" \
    --query "SecurityGroups[*].{ID:GroupId,Name:GroupName}" \
    --output table 2>/dev/null
done
```

This loop hits every AWS region. Expect it to take 30–60 seconds. If you use multiple AWS accounts, you'll need to repeat this with assumed roles for each account — or script that too.

At this point, the overhead should be clear. You're writing scripts to do what should be a single button click. And scripts don't run themselves — someone has to remember to execute them regularly.

[ScanOrbit](https://scanorbit.cloud) detects permissive security groups across all your AWS regions and accounts automatically — no scripts, no region-switching. Run a free scan and get a complete report in minutes.

## How to Fix Permissive Security Group Rules

Finding the open rules is half the problem. Here's how to fix them.

### Replace 0.0.0.0/0 with a Specific CIDR Block

If only your office or VPN needs SSH access, restrict the source to that IP range:

```bash
# Remove the open rule
aws ec2 revoke-security-group-ingress \
  --group-id sg-0123456789abcdef0 \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

# Add a restricted rule
aws ec2 authorize-security-group-ingress \
  --group-id sg-0123456789abcdef0 \
  --protocol tcp \
  --port 22 \
  --cidr 203.0.113.0/24
```

Replace `203.0.113.0/24` with your actual office or VPN CIDR range.

### Use Security Group References for Internal Traffic

Instead of CIDR blocks, reference another security group as the source. This is the right pattern for service-to-service communication — for example, allowing your application tier to reach the database:

```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-database \
  --protocol tcp \
  --port 5432 \
  --source-group sg-application
```

This way, only instances in the `sg-application` security group can reach the database. No IP addresses to manage.

### Use SSM Session Manager Instead of SSH

For EC2 access, consider replacing SSH entirely with [AWS Systems Manager Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html). SSM routes traffic through the AWS service — no inbound ports required. This eliminates the need for bastion hosts and removes port 22 from the equation.

### Remediation Checklist

- **Restrict sources immediately** — replace every `0.0.0.0/0` rule on sensitive ports with specific CIDR ranges or security group references
- **Enforce with SCPs** — use AWS Organizations Service Control Policies to prevent rules allowing `0.0.0.0/0` on ports 22 and 3389 from being created
- **Enable AWS Config rules** — the managed rule `restricted-ssh` flags any security group with port 22 open to the internet; set it to auto-remediate
- **Tag your security groups** — clear naming and tagging makes it easy to identify which groups belong to which workload
- **Review in code** — treat security group changes as part of your infrastructure-as-code review process, not an afterthought

## Automating Security Group Audits at Scale

The fundamental problem with point-in-time audits — whether you use the Console or CLI — is that they go stale immediately. A developer adds a `0.0.0.0/0` rule at 11pm for a quick test. Your next manual audit is scheduled for next Tuesday. That's a week of exposure.

As we covered in [why AWS infrastructure scanning matters](/blog/why-aws-infrastructure-scanning-matters), the real value of automated scanning isn't a single report — it's continuous coverage. The same applies to [finding orphaned resources](/blog/how-to-find-orphaned-resources-in-aws) and every other hygiene check. Automation turns a periodic audit into a persistent safety net.

What to look for in an automated scanner:

- **Cross-region coverage** — checks every region, not just the ones you remember to select
- **Cross-account support** — organizations with multiple accounts need a single view
- **Agentless architecture** — no agents to install, no Lambda functions to manage, no additional attack surface
- **Actionable findings** — not just "this rule exists" but what it affects and how to fix it

ScanOrbit uses a read-only IAM role to scan your entire AWS environment and surfaces permissive security group rules alongside other findings like [expiring SSL certificates](/blog/ssl-certificate-monitoring-aws), [data residency violations](/blog/gdpr-compliance-aws-data-residency), and cost waste. Because it's agentless and hosted in the EU, there's no operational overhead and no new attack surface.

The steps in this guide will find open security groups in your AWS account today. But staying on top of them over time — as your team grows, new rules get added, and old ones go unreviewed — requires automation.

[ScanOrbit](https://scanorbit.cloud) detects permissive security groups across all regions automatically. Try a free scan and see what's exposed in your account right now.
