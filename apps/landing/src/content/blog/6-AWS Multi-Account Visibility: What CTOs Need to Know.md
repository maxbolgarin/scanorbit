---
title: "AWS Multi-Account Visibility: What CTOs Need to Know"
description: "Managing multiple AWS accounts is standard practice. Seeing what's actually in them is a different problem entirely. Here's what breaks when visibility doesn't scale with your account structure."
pubDate: 2026-03-11
author: "Maksim"
draft: false
tags: ["aws", "multi-account", "aws-organizations", "visibility", "cto"]
---

At some point every growing team ends up with multiple AWS accounts. A production account and a staging account. Then a sandbox for experiments. Then separate accounts per team because the shared dev account became a mess. Before long you're managing five, ten, maybe twenty accounts under an AWS Organization, and the question stops being "how do we organize this" and becomes "what's actually running across all of these?"

That second question is harder than it looks. And if you're a CTO or engineering lead, it's your problem even if you never touch the AWS console yourself.

## How multi-account gets out of hand

The multi-account strategy itself is sound. AWS recommends it. Separating workloads into different accounts gives you blast radius isolation, cleaner billing, and easier permission boundaries. The AWS Organizations documentation makes it look straightforward: create an OU structure, apply SCPs, done.

The part they don't emphasize is that every new account is another place where resources can exist without anyone knowing. A developer spins up a test RDS instance in the sandbox account and forgets about it. Someone creates an IAM user with admin access in a dev account "just for testing." A failed CloudFormation deployment leaves orphaned resources in a staging account that nobody checks regularly.

Multiply these by the number of accounts you have. Now multiply by the [30+ AWS regions each account has access to](/blog/why-you-cant-get-a-full-aws-resource-inventory-from-the-console). The visibility problem grows quadratically.

I've talked to CTOs who were genuinely surprised to learn they had running EC2 instances in accounts they thought were empty. Not because anyone was negligent. Just because nobody had an easy way to check.

## What "visibility" actually means here

When I say visibility, I don't mean dashboards with green checkmarks. I mean being able to answer basic questions about your AWS environment without it turning into a research project:

**What resources exist across all our accounts right now?** Not what we think exists based on Terraform state files (those drift). Not what someone remembers deploying. What's actually there.

**What's costing money that shouldn't be?** Across every account, every region. [Unused resources](/blog/how-to-find-unused-aws-resources-cut-costs) in a single account are annoying. Unused resources spread across ten accounts are invisible until someone aggregates the billing.

**Are there security misconfigurations we don't know about?** An [open security group in a dev account](/blog/how-to-find-open-security-groups-aws) is still an open security group. If that account has any access to internal services or data, the risk is real.

**Where is our data physically located?** This matters particularly if you're subject to GDPR or other data residency regulations. Resources in the wrong region in any account can be a compliance issue. And the more accounts you have, the higher the odds that someone deployed something somewhere they shouldn't have.

These questions are easy to answer for one account. They become genuinely difficult at five accounts. At ten or more, manual approaches break down completely.

## The tools AWS gives you (and where they fall short)

AWS has invested in multi-account tooling over the past few years. Some of it is useful. None of it gives you the full picture out of the box.

**AWS Organizations** handles the structure: account creation, OU hierarchy, billing consolidation, and service control policies. It's the foundation. But it doesn't tell you what's inside each account. It manages the containers, not the contents.

**AWS Control Tower** sits on top of Organizations and adds guardrails, landing zone setup, and an account factory. It's helpful for governance and preventing certain configurations. It does not, however, provide a cross-account inventory of what resources exist or what they're costing you. The dashboard shows compliance with guardrails, not resource visibility.

**Consolidated Billing and Cost Explorer** aggregate costs across accounts. You can see that your staging account spent $850 last month. What you can't easily see is that $200 of that was [orphaned EBS volumes](/blog/how-to-find-orphaned-ebs-volumes-in-aws) and idle load balancers that nobody knew about. Cost Explorer groups by service and account, not by "things that are wasting money."

**AWS Config Aggregator** can collect configuration data from multiple accounts and regions into a single view. This is probably the closest thing to multi-account visibility that AWS offers natively. The catch: it requires setup in every member account, it bills per configuration item recorded, and the query interface (Config Advanced Queries) is SQL-like but limited. For a team that wants ongoing multi-account monitoring, Config Aggregator is a reasonable foundation but a significant project to set up and maintain.

**AWS Resource Explorer** works within a single account. It can't aggregate across accounts in an Organization. For multi-account visibility, it's not the answer.

**AWS Security Hub** aggregates security findings from multiple accounts and integrates with tools like GuardDuty, Inspector, and Config. It's designed for security posture management and does that reasonably well. It doesn't cover cost waste, inventory completeness, or general resource visibility.

The common pattern here: each tool covers one slice of the problem. Billing, security, configuration, governance. Getting a unified view means stitching them together, and most teams don't have the bandwidth for that.

## What actually works

From what I've seen working with engineering teams, the approaches that produce real multi-account visibility fall into three categories.

### The DIY approach

Write scripts that assume a role in each member account and enumerate resources. This is what the [CLI audit scripts](/blog/aws-account-audit-checklist-solo-engineers) do at a single-account level. Scaling it to multiple accounts means adding role assumption:

```bash
for account_id in 111111111111 222222222222 333333333333; do
  creds=$(aws sts assume-role \
    --role-arn "arn:aws:iam::${account_id}:role/AuditRole" \
    --role-session-name "audit-session" \
    --query 'Credentials' --output json)

  export AWS_ACCESS_KEY_ID=$(echo $creds | jq -r '.AccessKeyId')
  export AWS_SECRET_ACCESS_KEY=$(echo $creds | jq -r '.SecretAccessKey')
  export AWS_SESSION_TOKEN=$(echo $creds | jq -r '.SessionToken')

  echo "=== Account: $account_id ==="
  # Run your audit checks here
done
```

This works if you have 3-5 accounts and a few specific things to check. Past that, you're maintaining a mini infrastructure scanner. I've been down this path. The scripts get long, the edge cases multiply, and eventually nobody wants to own the code.

### The platform approach

Tools like CloudHealth (VMware), Spot.io (NetApp), or Vantage provide multi-account cost and resource visibility through their platforms. They're comprehensive but they come with platform-level pricing and sales cycles. For a 50-person engineering org, the ROI usually makes sense. For a 5-person team, the cost might exceed the waste you're trying to find.

### The focused approach

This is the space I built [ScanOrbit](https://scanorbit.cloud) for. Instead of a full cloud management platform, it focuses specifically on the three things that matter most for multi-account visibility: what resources exist, what's misconfigured, and what's costing money unnecessarily.

It connects to each account through a read-only IAM role in the Organization, scans all regions in every account in a single pass, and gives you consolidated findings for security misconfigurations, cost waste, and compliance gaps. No agents to install per account. No infrastructure to maintain. EU-hosted, which matters if you're dealing with GDPR requirements around where your scan data is stored.

The free scan works at the single-account level so you can see what it finds before connecting your whole Organization. Full disclosure: this is my product.

## What to prioritize

If you're a CTO looking at this problem and wondering where to start, here's the pragmatic sequence:

**First: know what accounts you have.** This sounds obvious but I've seen Organizations where nobody had a definitive list. Run `aws organizations list-accounts` and compare it against what your team thinks exists. Look for accounts with no tags, no description, or names like "test-account-2" that nobody remembers creating.

**Second: aggregate your costs.** Enable Cost Explorer with account-level grouping. Identify which accounts are spending more than expected. The account with the surprising bill is where you start digging.

**Third: audit your highest-risk accounts first.** Production accounts and any account with access to customer data. Use the [security audit checklist](/blog/aws-account-audit-checklist-solo-engineers) as a starting template and expand it per account.

**Fourth: decide on an ongoing approach.** Whether that's AWS Config Aggregator, a third-party platform, or something lighter like ScanOrbit, pick something that runs without someone remembering to trigger it. The value of multi-account visibility isn't a single audit. It's knowing that when something drifts, you'll find out before it becomes a problem.

The worst outcome isn't having multi-account complexity. It's having it without knowing what's actually in there.

---

*Part of our series on AWS infrastructure visibility. See also: [AWS Account Audit Checklist for Solo Engineers](/blog/aws-account-audit-checklist-solo-engineers), [How to Find Unused AWS Resources and Cut Costs](/blog/how-to-find-unused-aws-resources-cut-costs), and [Why You Can't Get a Full Resource Inventory from the Console](/blog/why-you-cant-get-a-full-aws-resource-inventory-from-the-console).*