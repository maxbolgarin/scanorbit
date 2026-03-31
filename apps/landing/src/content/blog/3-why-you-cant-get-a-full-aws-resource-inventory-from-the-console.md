---
title: "Why You Can't Get a Full AWS Resource Inventory from the Console"
description: "AWS has no single screen that shows everything in your account. Here's why building a complete resource inventory is harder than it should be, and what actually works."
pubDate: 2026-01-29
author: "Maksim"
draft: false
tags: ["aws", "cloud-inventory", "infrastructure", "devops"]
---

There's a question that sounds simple until you actually try to answer it: what's running in my AWS account right now?

You'd think AWS would have a page for this. One screen, all your resources, every region. It doesn't. And the workarounds range from "almost good enough" to "I'll write a script and regret it later."

I've spent a lot of time on this problem, both managing AWS accounts professionally and building a tool that does inventory discovery automatically. The short version: it's genuinely harder than it should be.

## The Console Wants You to Already Know What You're Looking For

Open the AWS Console. You get a search bar and a list of services. That's it.

Want to see your EC2 instances? Go to the EC2 page. Your RDS databases? Different page. S3 buckets? Different page again. Lambda functions, IAM roles, EBS volumes, security groups, load balancers, KMS keys — each one lives in its own section of the console with its own layout, its own filters, and its own quirks.

There are over 200 AWS services. Even if you only use 10 or 15 of them, checking each one manually means opening a dozen tabs and clicking through region selectors. And here's the part that gets people: most of these pages only show resources in one region at a time. If you're looking at EC2 instances in eu-west-1, you won't see the instance someone spun up in us-east-1 three months ago for a quick test and forgot about.

This is fine when you know exactly what you're looking for. It falls apart when the question is "what do we have?"

## Multi-Region Is Where It Gets Painful

AWS operates in 30+ regions. Most teams use two or three. But resources end up in unexpected places all the time.

Someone creates a CloudFormation stack in us-east-1 because that's the default. A developer launches a test instance in ap-southeast-1 to check latency from Singapore. An old deployment left behind snapshots in eu-central-1 that nobody remembers creating.

The AWS Console doesn't help here. There's no "show me resources across all regions" toggle on most service pages. You have to manually switch regions in the top-right dropdown and check each one. For a single service. Then repeat for the next service.

If you're responsible for security or compliance — especially GDPR, where data residency matters — this is a real problem. Resources in the wrong region aren't just clutter. They can be a compliance violation you don't know about until an auditor asks.

## The Tools AWS Gives You (And Why They're Not Enough)

AWS isn't completely unaware of this problem. There are a few built-in options.

**AWS Resource Explorer** is the closest thing to a unified inventory. You enable it, it indexes your resources across regions, and you can search them in one place. It's better than clicking through service pages manually. But it doesn't cover every resource type, it doesn't show cost data, and the search interface works best when you already know what you're looking for. It's a search engine, not an inventory report. If you want to browse everything and understand the full picture, it's not quite there.

**AWS Tag Editor** lets you find resources across regions, but only if they're tagged. If your team has inconsistent tagging (and most teams do), you'll get a partial view at best. Untagged resources are invisible here, which is a problem because untagged resources are usually the ones you need to find the most — they're the forgotten ones.

**AWS Config** is the most thorough option — it records resource configurations and tracks changes over time. The catch: it's a compliance and audit tool, not something you'd use as a daily inventory dashboard. Setting it up across all regions takes real effort, it bills per recorded configuration item, and the output is dense enough that you'll probably need another tool to make sense of it.

**AWS Cost Explorer** shows you what's costing money, which is useful, but it groups costs by service and region, not by individual resource. You can see that EBS is costing you $340/month in eu-west-1, but you can't easily see which specific volumes are responsible.

You can cobble these together and get a partial answer. But none of them give you a single view that says: here's every resource in your account, across every region, with its cost, its security posture, and whether anyone is actually using it.

## The CLI Approach Works but Doesn't Scale

The most common DIY solution is writing AWS CLI scripts. Something like:

```bash
for region in $(aws ec2 describe-regions --query 'Regions[].RegionName' --output text); do
  echo "=== $region ==="
  aws ec2 describe-instances --region $region --query 'Reservations[].Instances[].[InstanceId,State.Name,InstanceType]' --output table
done
```

This works for one service. Now multiply it by every service you use. EC2 instances, EBS volumes, RDS databases, S3 buckets, Lambda functions, IAM users, security groups, snapshots, Elastic IPs, NAT Gateways, load balancers, KMS keys, CloudWatch log groups...

Each service has its own API call, its own response format, its own pagination logic. Some resources are global (like IAM and S3 buckets), some are regional. The script grows, the edge cases pile up, and eventually you're maintaining a mini infrastructure scanner that you never intended to build.

I've seen teams keep these scripts around for years. They break when AWS adds new regions or changes API responses. Nobody wants to maintain them. And they still don't give you cost estimates or security analysis — just a list of resource IDs.

## What You Actually Need

When I talk to engineers about this, the thing they want is simple: one view, everything in the account, across all regions, with enough context to make decisions.

That means seeing every resource with its type, region, state, tags, and estimated monthly cost. It means knowing which resources are orphaned (not attached to anything), which ones have security issues, and which ones are in regions they shouldn't be in.

The AWS Console was built for operating individual services, not for answering "what's in my account." The tools AWS provides are useful for specific tasks — searching, auditing, cost analysis — but they don't combine into a single inventory view without significant effort.

This is why I built [ScanOrbit](https://scanorbit.cloud). It connects through a read-only IAM role, scans all regions in one pass, and gives you a full inventory with cost estimates, security findings, and compliance checks. No agents, no scripts to babysit, no clicking through region dropdowns for an hour.

The [free scan](https://scanorbit.cloud) shows you how many resources and findings you have, so you can see the scope of the problem before committing to anything.

## Start With the Manual Check

Even if you don't use any tooling, there's a quick sanity check worth doing right now.

Go to the AWS Console, open Resource Explorer (if it's enabled), and search for `*` in each region. Look for resources in regions you didn't expect. Then check EC2 → Volumes and filter by "Available" status — those are unattached volumes costing you money right now. Check Elastic IPs for any that aren't associated with a running instance. Check Security Groups for any that aren't attached to anything.

You'll probably find something. Most accounts do.

---

*This article is part of our series on AWS infrastructure visibility. Previously: [How to Find and Fix Open Security Groups in AWS](/blog/how-to-find-open-security-groups-aws) and [How to Find Orphaned EBS Volumes in AWS](/blog/how-to-find-orphaned-ebs-volumes-in-aws).*
