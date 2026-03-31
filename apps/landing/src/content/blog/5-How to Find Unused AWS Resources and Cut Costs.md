---
title: "How to Find Unused AWS Resources and Cut Costs"
description: "Unused AWS resources silently inflate your bill every month. Here's how to find idle EC2 instances, orphaned volumes, unused IPs, and forgotten load balancers — with CLI commands and practical cleanup steps."
link: "how-to-find-unused-aws-resources-and-cut-costs"
pubDate: 2026-02-24
author: "Maksim"
draft: false
tags: ["aws", "cost-optimization", "unused-resources", "cloud-waste", "devops"]
---

Your AWS bill is higher than it should be. I don't need to see it to know this. After scanning hundreds of accounts, the pattern is always the same: somewhere between 15% and 30% of the monthly spend goes to resources that aren't doing anything useful.

Not resources that are overprovisioned (that's a separate problem). Resources that are completely idle. Volumes nobody reads from. Elastic IPs pointing at nothing. Load balancers with zero targets. NAT Gateways routing traffic for VPCs that stopped mattering months ago.

The frustrating part is that AWS won't flag most of this for you. Cost Explorer shows you totals per service, but it won't tell you which specific EBS volume has been sitting unattached since January. You have to go looking.

Here's what to look for and how to find it.

## The usual suspects

Some resource types go unused far more often than others. These are the ones I check first because they almost always turn up something.

### Unattached EBS volumes

This is the single most common source of waste I see. I wrote a [full guide on finding orphaned EBS volumes](/blog/how-to-find-orphaned-ebs-volumes-in-aws) with three different methods, but the quick version:

```bash
for region in $(aws ec2 describe-regions --query 'Regions[].RegionName' --output text); do
  waste=$(aws ec2 describe-volumes \
    --region "$region" \
    --filters Name=status,Values=available \
    --query 'sum(Volumes[].Size)' \
    --output text)
  if [ "$waste" != "None" ] && [ "$waste" != "0" ]; then
    cost=$(echo "$waste * 0.08" | bc)
    echo "$region: ${waste} GB unattached (~\$${cost}/month)"
  fi
done
```

A 500 GB gp3 volume costs about $40/month. I've seen accounts with ten or fifteen of these scattered across regions. That's $4,800-$7,200 a year gone.

They accumulate because the default `DeleteOnTermination` flag on non-root EBS volumes is `false`. Every time someone terminates an EC2 instance, the extra volumes stay behind. Silently billing.

### Unused Elastic IPs

Since February 2024, AWS charges for all public IPv4 addresses. An Elastic IP not associated with a running instance costs $3.65/month. Doesn't sound like much until you have a dozen of them across different regions.

```bash
for region in $(aws ec2 describe-regions --query 'Regions[].RegionName' --output text); do
  unused=$(aws ec2 describe-addresses \
    --region "$region" \
    --query "Addresses[?AssociationId==null].PublicIp" \
    --output text)
  if [ -n "$unused" ]; then
    echo "$region: $unused"
  fi
done
```

Release anything that isn't actively associated. If you're holding an IP "just in case," consider whether that insurance is worth $44/year per address.

### Idle load balancers

Application Load Balancers cost about $16/month minimum (hourly charge plus LCU charges), even with zero traffic. Classic Load Balancers are similar. If a load balancer has no healthy targets or hasn't processed a request in weeks, it's waste.

```bash
for region in $(aws ec2 describe-regions --query 'Regions[].RegionName' --output text); do
  aws elbv2 describe-load-balancers --region "$region" \
    --query "LoadBalancers[].{Name:LoadBalancerName,DNS:DNSName,State:State.Code}" \
    --output table 2>/dev/null
done
```

This lists them all, but you need to cross-reference with target group health to know which ones are actually doing something. Check each load balancer's target groups:

```bash
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:REGION:ACCOUNT:targetgroup/NAME/ID
```

If every target is unhealthy or the target group is empty, that load balancer is a candidate for removal.

### NAT Gateways

A NAT Gateway costs roughly $32/month just for existing, plus $0.045 per GB of data processed. Teams create them for private subnets that need outbound internet access, then the workload moves or gets decommissioned, but the NAT Gateway stays.

```bash
for region in $(aws ec2 describe-regions --query 'Regions[].RegionName' --output text); do
  nats=$(aws ec2 describe-nat-gateways --region "$region" \
    --filter "Name=state,Values=available" \
    --query "NatGateways[].{Id:NatGatewayId,Subnet:SubnetId,VpcId:VpcId}" \
    --output table 2>/dev/null)
  if echo "$nats" | grep -q "nat-"; then
    echo "=== $region ==="
    echo "$nats"
  fi
done
```

For each NAT Gateway, check whether its VPC still has active workloads. If the VPC is empty or unused, the NAT Gateway is pure overhead.

### Old EBS snapshots

Snapshots are cheap per GB (about $0.05/month) but they compound over time. Automated backup processes create them, nobody cleans them up, and after a year you might have hundreds.

```bash
aws ec2 describe-snapshots --owner-ids self \
  --query "Snapshots[?StartTime<='2025-10-01'].{ID:SnapshotId,Size:VolumeSize,Created:StartTime,Desc:Description}" \
  --output table
```

Adjust the date filter based on what you consider "old." Anything older than 6 months deserves a review. Anything older than a year with no description or a generic description like "Created by CreateImage" is probably safe to delete, but snapshot the snapshot ID somewhere first. Paranoid? Yes. But I've been burned.

## The less obvious waste

Beyond the usual suspects, there are resources that cost money in less visible ways.

**CloudWatch Log Groups with no retention.** By default, CloudWatch Logs retains data forever. If you have log groups from a service you decommissioned two years ago, they're still storing data and charging for it. Set retention policies on every log group, even active ones. 30 days is fine for most applications. 90 if you have compliance requirements.

```bash
aws logs describe-log-groups \
  --query "logGroups[?retentionInDays==null].{Name:logGroupName,StoredBytes:storedBytes}" \
  --output table
```

**RDS instances running 24/7 in non-production environments.** A db.t3.medium in eu-west-1 costs around $50/month. If your staging database doesn't need to be available outside working hours, stop it on evenings and weekends. That alone cuts the cost by 65%.

**Unused ECR images.** Container images in ECR cost $0.10/GB/month for storage. If you push a new image on every deploy but never clean up old tags, the repository grows indefinitely. Set a lifecycle policy that keeps the last 10 or 20 images and expires the rest.

**S3 buckets with no lifecycle rules.** Similar to CloudWatch Logs. If a bucket stores temporary build artifacts or logs, add a lifecycle rule that transitions to Glacier after 30 days or expires after 90. Without it, you pay standard S3 rates on data you'll never look at again.

## Why this is harder than it should be

You'd think finding unused resources would be a built-in AWS feature. It mostly isn't. The [AWS Console doesn't give you a unified view of everything in your account](/blog/why-you-cant-get-a-full-aws-resource-inventory-from-the-console), and the tools AWS provides each cover different slices of the problem.

Cost Explorer shows cost per service but not per resource. Resource Explorer shows resources but not their cost or whether they're idle. Trusted Advisor flags some unused resources but only on Business or Enterprise support plans ($100+/month). Config records resource state changes but doesn't tell you what's wasting money.

So you end up running CLI scripts per service, per region, stitching together a picture from different sources. It works, but it doesn't scale once your account grows past a handful of services. And it certainly doesn't work as ongoing monitoring, because the moment you stop running the scripts, waste starts accumulating again.

## Automation options

If the manual approach feels like too much effort to sustain (it is, honestly), there are several paths.

**AWS Cost Anomaly Detection** catches unexpected spikes but not slow steady waste. It won't flag a $40/month orphaned volume that's been there since March because the spend is consistent, not anomalous.

**Custom Lambda functions** triggered by EventBridge can scan for specific resource types on a schedule. You're writing and maintaining code for each check, but it's a solid approach if you have specific things you want to monitor. Works best for teams that already have a mature infrastructure-as-code practice.

**Open-source tools like Prowler** include cost-related checks alongside security audits. Free, runs on demand, but requires setup and somebody to actually look at the output.

**[ScanOrbit](https://scanorbit.cloud)** scans your entire account across all regions and surfaces cost waste, security misconfigurations, and compliance issues in one report. It connects through a read-only IAM role and doesn't store your credentials. Full disclosure: I built it because I got tired of maintaining the exact scripts in this article. The free scan shows you the severity summary so you can see how much waste exists before you decide if it's worth paying for detailed findings.

## A reasonable cleanup process

Don't try to fix everything at once. Here's the order I'd prioritize:

Start with the expensive items: unattached EBS volumes and idle NAT Gateways. These are usually the biggest line items and the easiest to verify as genuinely unused.

Next, handle the quick wins: unused Elastic IPs and empty load balancers. Low cost individually, but releasing them takes seconds and it adds up.

Then address the slow leaks: CloudWatch Log retention, old snapshots, and ECR lifecycle policies. These are smaller amounts but they grow over time.

For anything you're not sure about, don't delete it. Snapshot EBS volumes before removing them. Tag questionable resources with a review date. Put a calendar reminder to check back in two weeks. If nothing broke, clean them up.

The [AWS audit checklist](/blog/aws-account-audit-checklist-solo-engineers) covers the security side of this same process if you want to combine cost cleanup with a broader account review. They work well back-to-back since you're already looking at the same resources.

---

*Part of our series on AWS infrastructure hygiene. See also: [How to Find Orphaned EBS Volumes](/blog/how-to-find-orphaned-ebs-volumes-in-aws), [How to Find Open Security Groups](/blog/how-to-find-open-security-groups-aws), and [Why You Can't Get a Full Resource Inventory from the Console](/blog/why-you-cant-get-a-full-aws-resource-inventory-from-the-console).*