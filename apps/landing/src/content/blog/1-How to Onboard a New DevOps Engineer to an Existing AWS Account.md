---
title: "How to Onboard a New DevOps Engineer to an Existing AWS Account"
description: "Handing someone the keys to an AWS account they've never seen is harder than it looks. Here's a practical onboarding process that gives a new DevOps engineer real context fast, not just a login and a prayer."
link: "how-to-onboard-devops-engineer-to-aws-account"
pubDate: 2025-12-24
author: "Maksim"
draft: false
tags: ["aws", "devops", "onboarding", "infrastructure", "team"]
---

You just hired a DevOps engineer. Maybe it's your first one. Maybe the previous person left and took all the context with them. Either way, you need this person to understand your AWS account quickly enough to be useful, and safely enough that they don't accidentally break production on day two.

Most teams handle this by giving the new person an IAM login, pointing them at a half-outdated wiki page, and saying "ask if you have questions." This technically works. It also means the new engineer spends their first two weeks clicking through console pages trying to piece together an infrastructure that nobody documented properly.

I've been the new person in this situation. I've also been the one doing the handoff. Both sides are frustrating for the same reason: there's no standard way to give someone a complete picture of an AWS account. AWS doesn't have an "explain this account to me" button. So you have to build the onboarding yourself.

Here's what actually works.

## Before they get access: build the map

The worst time to figure out what's in your AWS account is when someone is waiting for you to explain it. Do this before the new person's first day.

If you have architecture diagrams, dust them off. They're probably outdated (they always are, I wrote about [why infrastructure maps decay so fast](/blog/building-aws-infrastructure-map-tools-approaches)), but even a stale diagram gives someone a starting point. Label which parts are still accurate and which have drifted. Honest annotations are more useful than a perfect diagram that doesn't exist.

If you don't have diagrams, at minimum create a resource inventory. Run the [CLI enumeration scripts](/blog/aws-architecture-monitoring-without-cloudwatch-dashboards) across all regions and dump the output into a document. It takes five minutes and gives the new person something concrete to look at instead of poking around the console blindly.

What the document should cover:

- Which AWS regions you actually use (and whether there are stray resources elsewhere)
- The main services and how they connect. "We have an ALB in front of three EC2 instances, they talk to an RDS Postgres database, static assets are on S3 behind CloudFront." That level of detail is enough
- Where the infrastructure-as-code lives. Terraform repo, CloudFormation stacks, CDK project, whatever you use. If some things are managed in code and some aren't, say that explicitly. The gap between IaC and reality is useful information
- Which things are legacy and shouldn't be touched vs. which things are actively developed
- Any known tech debt or weirdness. Every account has at least one thing that makes no sense but can't be changed yet. Better to flag it upfront than have the new person discover it and spend half a day confused

This doesn't need to be beautiful. A markdown file in your team's repo is fine. The point is that it exists at all.

## Day one: access and guardrails

Give them IAM access with the minimum permissions they need for their first week. Not admin. I know it feels easier to hand someone AdministratorAccess and sort it out later, but "later" never comes. Start with read access across the account and write access to development/staging environments. Expand as needed.

If your account doesn't already have proper [IAM hygiene](/blog/aws-account-audit-checklist-solo-engineers), the new hire's onboarding is a good forcing function to fix it. Create a proper IAM user with MFA, attach a scoped policy, and document the permission sets you use. You'll need this documentation anyway as the team grows.

Make sure CloudTrail is active. This isn't about watching the new person. It's about having an audit trail so that if something breaks during the first few weeks, you can figure out what happened instead of guessing. I've been in situations where a console change caused an outage and nobody could tell who did what because logging was off. Unpleasant.

Set up a budget alert if you don't have one. New engineers experiment. They spin things up to understand how they work. That's fine and expected. But a budget alert at 110% of your normal monthly spend catches the "forgot to terminate the m5.2xlarge" situation before it becomes a $500 surprise. Takes two minutes to configure, and [it's one of the cheapest insurance policies you can have](/blog/aws-cost-visibility-small-teams-beyond-billing-dashboard).

## The guided tour (not the sink-or-swim)

Spend 30-60 minutes walking the new person through the account. Screen share, talk through the console, show them the actual resources. This is the part most teams skip, and it's the part that saves the most time in the first month.

What to cover in the walkthrough:

**The network layout.** Open VPC, show them the subnets, explain which are public and which are private, point out the NAT Gateway and where traffic flows. If you have multiple VPCs or peering connections, explain why. Network is the thing that confuses new people the most because it's invisible until something doesn't connect.

**The compute layer.** EC2 instances, ECS services, Lambda functions, whatever you run. Show them where the application actually lives. Explain the deployment process. "We push to main, GitHub Actions builds a Docker image, pushes to ECR, and updates the ECS service" is a paragraph but it saves someone hours of reverse engineering.

**The data layer.** RDS instances, DynamoDB tables, S3 buckets that matter. Which database is production? Which one is staging? Where are backups? How do you restore if something goes wrong? If the answer to that last question is "I don't know," that's worth figuring out before you need it.

**The scary parts.** Every account has resources that would cause real damage if someone modified or deleted them by accident. The production database. The S3 bucket with customer data. The IAM role that your CI pipeline depends on. Point these out explicitly. "Don't touch this unless we've talked about it" is a perfectly valid thing to say. People appreciate knowing where the landmines are.

Don't try to cover everything. The goal is orientation, not total knowledge transfer. They'll learn the rest over the next few weeks by working in the account.

## Give them a first task that builds context

The best onboarding tasks are ones that force the new person to explore the account while doing something useful. My favorite: run a [security and cost audit](/blog/aws-account-audit-checklist-solo-engineers).

Hand them the audit checklist and ask them to run through it. They'll check IAM users, scan for [open security groups](/blog/how-to-find-open-security-groups-aws), look for [orphaned EBS volumes](/blog/how-to-find-orphaned-ebs-volumes-in-aws), and verify that logging is enabled. In the process, they'll touch most of the major service consoles, learn what exists in the account, and probably find a few things that need fixing.

This works better than a "read the docs" assignment because it's hands-on and produces a deliverable. The new person gets context. You get an audit report you probably needed anyway. Win-win, and nobody has to read a 40-page runbook that nobody maintains.

If the audit feels like too much for week one, start smaller. "Find all the EC2 instances in this account, tell me which regions they're in, and flag any that look like they shouldn't be running." That's a two-hour task that gives real insight into the account's state.

## What about multi-account setups?

If you're running an AWS Organization with multiple accounts, onboarding gets harder because the new person needs to understand both the individual accounts and the relationships between them.

Start with a list of accounts and what each one is for. Production, staging, sandbox, shared services, whatever your structure looks like. Explain which account they'll work in most often and which ones they shouldn't touch without a conversation.

The [multi-account visibility problem](/blog/aws-multi-account-visibility-ctos) is worth acknowledging openly. If you don't have cross-account tooling, say so. If you rely on role-switching to check different accounts, show them how. If cost data is aggregated through consolidated billing but resource visibility isn't, explain the gap. Honesty about what you don't have is better than pretending the setup is more organized than it is.

For organizations with more than five or six accounts, manual onboarding hits its limits. The new person can't realistically click through every account and every region. This is where automated scanning pays off: run [ScanOrbit](https://scanorbit.cloud) across the accounts and hand the new person the results. Here's every resource across every account, here's what's misconfigured, here's what's costing money for no reason. That report replaces a week of manual exploration. Full disclosure: I built this, and this exact onboarding use case was one of the reasons.

## The stuff nobody writes down

Every AWS account has tribal knowledge. Things that work but nobody knows why. Configuration choices that were made for a reason that's been forgotten. Workarounds for problems that might have been fixed upstream months ago.

Some of this you can't document because you don't know it's tribal knowledge until someone asks about it. But some of it you can capture:

- Why certain resources are tagged with specific values (or why they're not tagged at all)
- Which parts of the infrastructure are managed by IaC and which are manual
- What the deployment process looks like end-to-end, including the parts that aren't automated
- What monitoring exists and where the gaps are
- Who to ask about specific services or historical decisions

Write this down in whatever format your team already uses. Don't create a new system. If it goes in a README in the infrastructure repo, fine. If it goes in Notion, fine. The format matters less than the existence.

The goal of onboarding isn't to transfer everything in your head. It's to give the new person enough context to start asking good questions, and enough safety rails that their first mistake is recoverable. Everything else they'll learn by doing the work.

---

*Part of our series on AWS infrastructure for growing teams. See also: [AWS Account Audit Checklist for Solo Engineers](/blog/aws-account-audit-checklist-solo-engineers), [Building an AWS Infrastructure Map](/blog/building-aws-infrastructure-map-tools-approaches), and [AWS Multi-Account Visibility for CTOs](/blog/aws-multi-account-visibility-ctos).*