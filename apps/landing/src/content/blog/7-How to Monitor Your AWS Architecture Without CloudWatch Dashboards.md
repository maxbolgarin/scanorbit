---
title: "How to Monitor Your AWS Architecture Without CloudWatch Dashboards"
description: "CloudWatch dashboards show you metrics for things you already know about. The harder problem is understanding what you actually have running. Here's how to get an architecture-level view of your AWS account without building dashboards for every service."
link: "how-to-monitor-aws-architecture-without-cloudwatch-dashboards"
pubDate: 2026-03-21
author: "Maksim"
draft: false
tags: ["aws", "monitoring", "architecture", "infrastructure", "cloudwatch"]
---

CloudWatch is good at what it does. You pick a metric, you put it on a dashboard, you set an alarm. CPU utilization goes above 80%, you get a notification. RDS storage drops below 10%, same thing. It works.

But here's what CloudWatch can't tell you: what your AWS architecture actually looks like right now.

I don't mean a pretty diagram. I mean the practical stuff. How many EC2 instances are running across all your regions? Are there resources in regions you didn't expect? Which security groups are attached to what? Do you have load balancers pointing at empty target groups? Is that NAT Gateway in eu-central-1 still connected to anything?

CloudWatch monitors the things you've already instrumented. The problem is everything else. The resources you forgot about, the ones that drifted from your Terraform state, the stuff someone created through the console at 11pm and never documented. CloudWatch doesn't know those exist unless you explicitly tell it to watch them.

## The gap between monitoring and visibility

I think people conflate these two things and it causes real confusion.

Monitoring answers: "Is the thing I know about working correctly?" You have an RDS instance, you monitor its CPU and connections and free storage. You have an ALB, you monitor request count and error rates. This is well-solved. CloudWatch, Datadog, Grafana, whatever you prefer. Plenty of good options.

Visibility answers a different question: "What do I actually have?" Not what I think I have. Not what my infrastructure-as-code says I should have. What's literally sitting in my AWS account right now, across every region, costing money and potentially exposing attack surface.

These are different problems. Most teams invest heavily in the first one and almost nothing in the second. Then they're surprised when the [AWS bill has $200/month in resources nobody remembers creating](/blog/how-to-find-unused-aws-resources-and-cut-costs).

## What CloudWatch dashboards actually cover

Let me be specific about what you get and don't get with CloudWatch dashboards.

You get per-resource metrics for services you've deployed. CPU, memory (with the CloudWatch agent), network, disk, request counts, error rates, latency. You can build dashboards per application, per environment, per team. You can set alarms and route them to SNS, PagerDuty, Slack, wherever.

You don't get any kind of inventory. CloudWatch has no concept of "show me all resources in this account." It monitors resources. It doesn't discover them.

You also don't get cross-region views without effort. Each dashboard is scoped to a region by default. You can create cross-region dashboards, but you have to manually add widgets for each region. If a resource exists in a region you haven't added to the dashboard, it's invisible.

And you don't get cost data. CloudWatch knows an EC2 instance is running. It doesn't know that instance is costing you $73/month and hasn't had meaningful CPU activity in six weeks.

For a small account with five EC2 instances and a database, this is fine. You know what you have. For anything bigger, or for any account that's been around for more than a year, there are blind spots.

## Getting architecture visibility without CloudWatch

So what does work? A few approaches, from manual to automated.

### AWS CLI resource enumeration

The brute-force method. Write scripts that call describe/list APIs for every service you care about, across every region. I covered the basics in the [AWS audit checklist](/blog/aws-account-audit-checklist-for-solo-engineers), but here's a broader sweep:

```bash
for region in $(aws ec2 describe-regions --query 'Regions[].RegionName' --output text); do
  echo "=== $region ==="
  
  # EC2 instances
  instances=$(aws ec2 describe-instances --region "$region" \
    --query 'length(Reservations[].Instances[])' --output text)
  [ "$instances" != "0" ] && echo "  EC2 instances: $instances"
  
  # EBS volumes
  volumes=$(aws ec2 describe-volumes --region "$region" \
    --query 'length(Volumes[])' --output text)
  [ "$volumes" != "0" ] && echo "  EBS volumes: $volumes"
  
  # RDS instances
  rds=$(aws rds describe-db-instances --region "$region" \
    --query 'length(DBInstances[])' --output text 2>/dev/null)
  [ "$rds" != "0" ] && [ -n "$rds" ] && echo "  RDS instances: $rds"
  
  # Lambda functions
  lambdas=$(aws lambda list-functions --region "$region" \
    --query 'length(Functions[])' --output text 2>/dev/null)
  [ "$lambdas" != "0" ] && [ -n "$lambdas" ] && echo "  Lambda functions: $lambdas"
  
  # Load balancers
  albs=$(aws elbv2 describe-load-balancers --region "$region" \
    --query 'length(LoadBalancers[])' --output text 2>/dev/null)
  [ "$albs" != "0" ] && [ -n "$albs" ] && echo "  Load balancers: $albs"
done
```

This takes a couple of minutes to run and gives you a region-by-region count of your main resource types. It's rough. It doesn't show dependencies or costs. But it catches the "wait, we have Lambda functions in ap-southeast-1?" moments, and those moments happen more often than you'd expect. I wrote about [why resources end up in unexpected regions](/blog/why-you-cant-get-full-aws-resource-inventory-from-console) separately because it's a whole thing.

The downside is obvious: this script covers five resource types. AWS has hundreds. And the script doesn't tell you anything about the resources beyond their count. You need deeper queries to understand what's actually going on.

### AWS Resource Explorer

Resource Explorer is AWS's answer to the "what do I have" question. You enable it, it indexes resources across regions, and you get a search interface.

It's decent for ad-hoc lookups. "Show me all S3 buckets" or "find resources tagged Environment=staging" works fine. Where it falls short is the browsing experience. It's a search engine, and search engines are great when you know what you're looking for. When the question is "show me everything and let me spot the problems," search doesn't really work. You need to know what to ask.

It also doesn't cover every resource type, doesn't show cost data, and doesn't flag whether something is misconfigured or unused. It tells you a resource exists. That's it.

### AWS Config

Config records resource configurations and changes over time. If you enable it across all regions (and all accounts, if you're using [multiple accounts](/blog/aws-multi-account-visibility-what-ctos-need-to-know)), you get a historical record of what existed and how it changed.

The advanced query feature lets you run SQL-like queries across your configuration data:

```sql
SELECT resourceId, resourceType, configuration.instanceType, 
       availabilityZone, tags
WHERE resourceType = 'AWS::EC2::Instance'
```

This is powerful for compliance and audit use cases. The trade-offs: Config bills per configuration item recorded (which adds up across many resource types and regions), the setup is per-region, and the query interface is functional but not exactly something you'd use as a daily dashboard.

For architecture visibility specifically, Config gives you the data but not the presentation. You still need something on top to make sense of it.

### Terraform state as a (partial) source of truth

If you manage infrastructure with Terraform, the state file is technically an inventory. Run `terraform state list` and you get every managed resource.

The problem is drift. The state file shows what Terraform thinks exists. Console-created resources won't be there. Resources created by other tools won't be there. Resources that were imported but then manually modified might be there with stale data. The gap between Terraform state and reality tends to grow over time, especially in accounts where multiple people have console access.

I've seen teams treat the Terraform state as the authoritative inventory and miss entire categories of resources that were created outside of it. State files are useful input. They're not a complete picture.

## What I actually recommend

Honestly? A combination.

Use CloudWatch for what it's good at: monitoring the health and performance of resources you already know about. Keep your dashboards, keep your alarms. That part works.

For architecture visibility, run the CLI enumeration script (or something like it) at least monthly. It takes five minutes and catches the obvious things. Add it to your [regular audit process](/blog/aws-account-audit-checklist-for-solo-engineers) and you'll avoid most surprises.

For ongoing, automated visibility, you need something that runs without you remembering to trigger it. AWS Config is one option if you're willing to invest in the setup and cost. Third-party tools are another.

[ScanOrbit](https://scanorbit.cloud) is what I built to solve this specific problem for myself. It connects through a read-only IAM role, scans all regions in one pass, and gives you a complete inventory alongside security and cost findings. No agents, no CloudWatch configuration, no scripts to maintain. It's EU-hosted in Amsterdam, which matters if GDPR data residency is a concern for you. The free scan shows your resource count and finding severity so you can see the scope before committing. I'm biased obviously, but I couldn't find anything else that did exactly this without requiring a platform-level commitment.

The point isn't which tool you pick. The point is recognizing that CloudWatch dashboards are monitoring, not visibility. They're complementary. If you only have one, you're missing half the picture.

---

*Part of our series on AWS infrastructure visibility. See also: [AWS Account Audit Checklist for Solo Engineers](/blog/aws-account-audit-checklist-for-solo-engineers), [How to Find Unused AWS Resources](/blog/how-to-find-unused-aws-resources-and-cut-costs), and [Why You Can't Get a Full Resource Inventory from the Console](/blog/why-you-cant-get-full-aws-resource-inventory-from-console).*