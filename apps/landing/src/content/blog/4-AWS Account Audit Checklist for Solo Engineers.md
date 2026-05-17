---
title: "AWS Account Audit Checklist for Solo Engineers"
description: "A practical AWS account audit checklist built for solo engineers and small teams. Covers security, cost waste, IAM hygiene, and compliance checks you can run in under an hour."
link: "aws-account-audit-checklist-for-solo-engineers"
pubDate: 2026-02-11
author: "Maksim"
draft: false
tags: ["aws", "audit", "security", "cost-optimization", "checklist"]
---

Nobody audits their AWS account often enough. I say this as someone who has looked inside hundreds of accounts professionally and still catches myself skipping it on my own infrastructure. There's always something more urgent. A deploy to ship, a bug to fix, a feature someone's waiting on.

Then one day you check your bill and there's a $200 line item you can't explain. Or worse, a security group open to the internet that's been sitting there since last summer.

If you're a solo engineer or the only DevOps person on a small team, there's no second pair of eyes. No dedicated security team running scans. It's just you. So here's the checklist I actually use when I audit an AWS account. It takes about an hour if you do it manually, and it catches most of the things that quietly go wrong.

## IAM: the stuff nobody wants to deal with

IAM is boring until it isn't. Start here because identity issues tend to have the worst consequences.

**Check for IAM users without MFA.** This is the single most common finding I see across accounts. Go to IAM → Users and look at the MFA column. Every human user should have MFA enabled. No exceptions. Even the "test" user someone created six months ago. Especially that one.

```bash
aws iam generate-credential-report
aws iam get-credential-report --query 'Content' --output text | base64 -d | cut -d',' -f1,4,8
```

The output shows each user with their password status and MFA status. Anyone with a password but no MFA is a problem.

**Find unused access keys.** Access keys that haven't been used in 90+ days are either forgotten or belong to a workflow that got replaced. Either way, they're an unnecessary credential sitting around waiting to be compromised.

```bash
aws iam list-users --query 'Users[].UserName' --output text | tr '\t' '\n' | while read user; do
  aws iam list-access-keys --user-name "$user" --query "AccessKeyMetadata[?Status=='Active'].[UserName,AccessKeyId,CreateDate]" --output text
done
```

Cross-reference with `get-access-key-last-used` for each key. Anything untouched for 90 days should be deactivated. Not deleted right away, deactivated. Give it two weeks to see if something breaks, then delete.

**Look at IAM policies.** Anyone with `AdministratorAccess` or `*:*` on a policy attached to their user? That's more privilege than they probably need. Principle of least privilege sounds tedious but it matters most when a key leaks. If the leaked key can only read S3 in one bucket, that's a bad day. If it has admin access, that's a catastrophe.

## Security: the things people leave open

I covered this in detail in the [open security groups guide](/blog/how-to-find-open-security-groups-aws), but here's the abbreviated version for audit purposes.

**Security groups open to 0.0.0.0/0 on sensitive ports.** Ports 22, 3389, 3306, 5432, 27017. If any of these are open to the entire internet, that's an immediate fix.

```bash
aws ec2 describe-security-groups \
  --filters "Name=ip-permission.cidr,Values=0.0.0.0/0" \
  --query "SecurityGroups[*].{ID:GroupId,Name:GroupName}" \
  --output table
```

Run this for each region you use, or loop through all regions if you're not 100% sure which ones have resources (you'd be surprised, [most accounts have resources in regions nobody remembers deploying to](/blog/why-you-cant-get-full-aws-resource-inventory-from-console)).

**S3 bucket public access.** AWS has gotten better about blocking public access by default, but older buckets or buckets created through automation might still have public ACLs or bucket policies.

```bash
for bucket in $(aws s3api list-buckets --query 'Buckets[].Name' --output text); do
  result=$(aws s3api get-public-access-block --bucket "$bucket" 2>/dev/null)
  if [ $? -ne 0 ]; then
    echo "NO public access block: $bucket"
  fi
done
```

Any bucket without a public access block should get one immediately, unless it's genuinely meant to serve public content (a static website, for example).

**EBS encryption.** Unencrypted EBS volumes are a compliance finding in pretty much every framework. Check what you have:

```bash
aws ec2 describe-volumes \
  --query "Volumes[?Encrypted==\`false\`].{ID:VolumeId,Size:Size,State:State}" \
  --output table
```

You can enable encryption by default per region so all new volumes are automatically encrypted. Existing unencrypted volumes need to be copied (create snapshot → copy snapshot with encryption → create volume from encrypted snapshot).

## Cost waste: money leaving your account for nothing

This is usually the part that motivates the audit in the first place. I wrote a [full guide on finding orphaned EBS volumes](/blog/how-to-find-orphaned-ebs-volumes-in-aws) because it's the single biggest source of quiet waste I see. But here's the broader checklist.

**Unattached EBS volumes.** Filter EC2 → Volumes by status "Available." Each one is billing you right now for storage nobody uses.

**Unused Elastic IPs.** Since February 2024, AWS charges $3.65/month for every public IPv4 address, including Elastic IPs that aren't associated with a running instance.

```bash
aws ec2 describe-addresses \
  --query "Addresses[?AssociationId==null].{IP:PublicIp,AllocationId:AllocationId}" \
  --output table
```

**Stopped instances with attached storage.** A stopped EC2 instance doesn't charge for compute, but its EBS volumes keep billing. If an instance has been stopped for weeks, either start it or snapshot the volumes and terminate.

**Old snapshots.** Snapshots are cheap per GB but they accumulate quietly. Sort by creation date and question anything older than 6 months.

```bash
aws ec2 describe-snapshots --owner-ids self \
  --query "Snapshots[].{ID:SnapshotId,Size:VolumeSize,Created:StartTime}" \
  --output table | sort -k3
```

**NAT Gateways.** Each NAT Gateway costs roughly $32/month plus data processing charges. If you created one for a VPC you no longer use, it's still billing.

## Network and region hygiene

**Resources in unexpected regions.** This one bites people more than they expect. Someone creates a quick test in us-east-1 (the default for everything), forgets about it, and six months later there's a running instance in a region your team has never officially used.

If you care about GDPR or data residency, resources in the wrong region can be a compliance problem, not just a cost issue. Loop through all regions for your main resource types:

```bash
for region in $(aws ec2 describe-regions --query 'Regions[].RegionName' --output text); do
  count=$(aws ec2 describe-instances --region "$region" \
    --query 'length(Reservations[].Instances[])' --output text)
  if [ "$count" != "0" ] && [ "$count" != "None" ]; then
    echo "$region: $count instances"
  fi
done
```

Do the same for RDS, EBS volumes, and Lambda functions. You'll probably find something.

**VPC flow logs.** If you're not logging network traffic in your VPCs, you have no way to investigate if something goes wrong. Enable VPC flow logs on at least your production VPCs.

**CloudTrail.** Make sure CloudTrail is active and logging to an S3 bucket you actually retain. It should be on by default, but I've seen accounts where someone disabled it "temporarily" and never turned it back on.

## Making this repeatable

The hardest part of an AWS audit isn't doing it once. It's doing it regularly. A monthly or quarterly review catches problems before they compound. But being honest: I've never met a solo engineer who consistently ran manual audit scripts on a schedule. You do it once, feel good about it, and then three months go by.

This is where automation earns its keep. Some options depending on how much effort you want to invest:

**AWS Config rules** can flag specific violations automatically (like unencrypted volumes or open security groups). The setup is per-region and the pricing is per configuration item recorded, which adds up across many resource types.

**Open-source tools** like Prowler or ScoutSuite run comprehensive audits on demand. They require installation and maintenance, but they're free and thorough.

**[ScanOrbit](https://scanorbit.cloud)** is an open-source, self-hosted tool that does this. It connects through a read-only IAM role, scans all regions in one pass, and gives you findings across security, cost waste, and compliance. No agents, no scripts to maintain. I built it because I got tired of running these checklists manually.

Whatever approach you pick, the principle is the same: audit regularly, automate what you can, and treat the manual checklist as a fallback, not a primary strategy.

## The one-hour version

If you only have an hour and want to hit the highest-impact checks:

1. IAM: check MFA on all users (5 minutes)
2. Security groups: scan for 0.0.0.0/0 on sensitive ports (10 minutes)
3. S3: verify public access blocks (5 minutes)
4. Cost: find unattached EBS volumes and unused Elastic IPs (10 minutes)
5. Regions: loop through all regions for stray EC2 instances (10 minutes)
6. CloudTrail: confirm it's active (2 minutes)

That's about 40 minutes of actual work. The remaining 20 go to documenting what you found and creating tickets for the fixes.

Not comprehensive, but it catches 80% of what goes wrong in solo-managed accounts. If you want the other 20%, check the [full security groups deep-dive](/blog/how-to-find-open-security-groups-aws) and [unused resource guide](/blog/how-to-find-orphaned-ebs-volumes-in-aws) for the detailed walkthroughs.

---

*Part of our series on AWS infrastructure hygiene. See also: [How to Find and Fix Open Security Groups](/blog/how-to-find-open-security-groups-aws), [How to Find Orphaned EBS Volumes](/blog/how-to-find-orphaned-ebs-volumes-in-aws), and [Why You Can't Get a Full Resource Inventory from the Console](/blog/why-you-cant-get-full-aws-resource-inventory-from-console).*