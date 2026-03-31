---
title: "How to Find Orphaned EBS Volumes in AWS (3 Methods)"
description: "Orphaned EBS volumes silently inflate your AWS bill every month. Learn three ways to find and clean them up — from the AWS Console to CLI automation to dedicated scanning tools."
link: "how-to-find-orphaned-ebs-volumes-in-aws"
pubDate: 2026-01-12
author: "Maksim"
draft: false
tags: ["aws", "cost-optimization", "ebs", "cloud-waste"]
---

If you're running anything on AWS, you almost certainly have orphaned EBS volumes sitting in your account right now. They're not attached to any instance. They're not doing anything useful. And they're costing you money every single month.

This isn't a theoretical problem. After scanning hundreds of AWS accounts, the pattern is remarkably consistent: nearly every account has at least a few unattached volumes left behind after instance terminations, failed deployments, or snapshot restores that nobody cleaned up.

A single 500 GB gp3 volume costs around $40/month. Leave five of those sitting around and you're burning $2,400/year on storage nobody uses. Across multiple regions, it adds up fast.

Here are three ways to find and deal with them.

## What Makes an EBS Volume "Orphaned"?

An EBS volume becomes orphaned when it exists in an `available` state — meaning it's not attached to any EC2 instance. This typically happens when:

- An EC2 instance is terminated but the volume's `DeleteOnTermination` flag was set to `false`
- Someone creates a volume from a snapshot for debugging and forgets to clean it up
- A deployment or auto-scaling event creates volumes that never get attached
- Infrastructure-as-code runs create volumes that later drift from the managed state

AWS doesn't warn you about these. They don't show up in cost anomaly reports unless you're specifically watching for them. They just sit there, accruing charges.

## Method 1: AWS Console (Quick Visual Check)

The fastest way to get a sense of the problem, though it doesn't scale well across regions.

**Step 1:** Open the [EC2 Console](https://console.aws.amazon.com/ec2/) and select **Volumes** from the left sidebar.

**Step 2:** In the filter bar, add a filter for **Status → Available**. Every volume that shows up here is not attached to any instance.

**Step 3:** Check the **Created** column. Volumes that have been sitting in `available` state for weeks or months are almost certainly orphaned.

**Step 4:** Look at the **Size** and **Volume Type** to estimate what each one costs. As a rough guide:

| Volume Type | Cost per GB/month (eu-west-1) |
|---|---|
| gp3 | ~$0.08 |
| gp2 | ~$0.10 |
| io1 | ~$0.125 + IOPS charges |
| st1 | ~$0.045 |
| sc1 | ~$0.015 |

**The catch:** You need to repeat this for every AWS region you use. If your team deploys across `eu-west-1`, `eu-central-1`, and `us-east-1`, that's three separate checks. If you have multiple accounts, multiply again.

Good for a quick spot check. Not practical for ongoing monitoring.

## Method 2: AWS CLI (Scriptable and Multi-Region)

The CLI approach lets you scan all regions in one go and is easy to automate with a cron job.

**Find all unattached volumes across all regions:**

```bash
for region in $(aws ec2 describe-regions --query 'Regions[].RegionName' --output text); do
  echo "=== $region ==="
  aws ec2 describe-volumes \
    --region "$region" \
    --filters Name=status,Values=available \
    --query 'Volumes[].{ID:VolumeId,Size:Size,Type:VolumeType,Created:CreateTime,AZ:AvailabilityZone}' \
    --output table
done
```

This outputs a clean table of every unattached volume in your account, across every region.

**Calculate estimated monthly waste:**

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

This gives you a region-by-region cost estimate using gp3 pricing as a baseline.

**Add age filtering to find the worst offenders:**

```bash
# Find volumes unattached for more than 30 days
threshold=$(date -d '30 days ago' +%Y-%m-%dT%H:%M:%S 2>/dev/null \
  || date -v-30d +%Y-%m-%dT%H:%M:%S)

aws ec2 describe-volumes \
  --filters Name=status,Values=available \
  --query "Volumes[?CreateTime<='${threshold}'].{ID:VolumeId,Size:Size,Created:CreateTime}" \
  --output table
```

**Before you delete anything:** Always create a snapshot first if you're not 100% sure the data isn't needed. Snapshots are significantly cheaper than keeping the full volume around (you only pay for the actual data stored, not allocated size), and they give you a recovery path.

```bash
# Snapshot a volume before deleting
aws ec2 create-snapshot \
  --volume-id vol-0abc123def456 \
  --description "Backup before cleanup - $(date +%Y-%m-%d)"

# Then delete the volume
aws ec2 delete-volume --volume-id vol-0abc123def456
```

**Automate it:** Save the discovery script and schedule it weekly with cron or an EventBridge rule triggering a Lambda function. Send the output to Slack or email so orphaned volumes don't accumulate silently again.

This approach works well if you're comfortable with the CLI and only manage one or two AWS accounts. It gets unwieldy with multi-account setups or when you need historical tracking of what's been cleaned up.

## Method 3: Automated Scanning Tools

Both methods above require you to remember to run them. The moment you get busy — and you will — orphaned volumes start accumulating again.

Dedicated scanning tools solve this by running checks automatically and tracking findings over time. There are several options depending on your setup:

**Open-source scanners** like [Prowler](https://github.com/prowler-cloud/prowler) and [ScoutSuite](https://github.com/nccgroup/ScoutSuite) can detect unattached volumes as part of a broader security audit. They're free but require installation, configuration, and you need to manage the scanning schedule yourself.

**AWS Trusted Advisor** flags some unused resources, but only in the Business or Enterprise support plans ($100+/month minimum). The free tier Trusted Advisor checks are very limited.

**[ScanOrbit](https://scanorbit.cloud)** (full disclosure: this is my product) takes a different approach — it's agentless, connects through a read-only IAM role, and scans your entire account across all regions automatically. It detects orphaned EBS volumes along with other cost waste like unattached Elastic IPs, stopped instances, old snapshots, and unused NAT Gateways. It also covers security misconfigurations, compliance gaps, and GDPR data residency checks if that matters to you (it's EU-hosted, which was a deliberate choice for European companies).

The free scan gives you a full severity breakdown so you can see how big the problem is before committing to anything.

## Preventing Orphaned Volumes in the First Place

Finding orphaned volumes is useful. Not creating them is better.

**Set `DeleteOnTermination` to `true` by default.** When launching instances, ensure non-root EBS volumes are configured to be deleted when the instance terminates. In CloudFormation or Terraform, this is a single property on the block device mapping.

Terraform example:

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.medium"

  ebs_block_device {
    device_name           = "/dev/sdf"
    volume_size           = 100
    volume_type           = "gp3"
    delete_on_termination = true  # Don't leave volumes behind
  }
}
```

**Tag everything.** At minimum, tag volumes with `Owner`, `Environment`, and `Purpose`. When a volume shows up as unattached, tags tell you whether it's safe to delete or whether someone needs to investigate. Without tags, every cleanup becomes a guessing game.

**Set up a lifecycle policy.** Create an automated check (Lambda + EventBridge, or a tool like ScanOrbit) that alerts you when volumes have been in `available` state for more than 7 days. Seven days is long enough that legitimate temporary volumes get reattached, but short enough that waste doesn't pile up.

**Audit after deployments.** If your CI/CD pipeline creates and destroys infrastructure frequently, add a post-deployment step that checks for leftover volumes. This is especially important for staging and development environments where resources get created ad-hoc.

## The Real Cost Isn't Just Storage

Orphaned EBS volumes are a symptom of a broader problem: lack of visibility into what's running in your AWS account. If you have orphaned volumes, you almost certainly also have unused Elastic IPs ($3.65/month each), old snapshots you'll never restore, security groups attached to nothing, and maybe even stopped instances still holding reserved capacity.

The volume cleanup is worth doing on its own — but it's worth treating as a starting point for a broader account hygiene practice.

If you want to see the full picture of what's hiding in your AWS account — cost waste, security misconfigurations, compliance gaps, the whole thing — [ScanOrbit's free scan](https://scanorbit.cloud) covers all of it in a single pass. No agents, no credentials stored, takes about five minutes to connect.

---

*This is the second article in our AWS cost optimization series. The first covers [how to find and fix open security groups](/blog/how-to-find-open-security-groups-aws) — another common issue lurking in most AWS accounts.*
