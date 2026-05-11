# ScanOrbit — Twitter Posts (280 char limit, no formatting)

Each tweet marked with character count. Posts over 280 chars are split into threads (1/2, 2/2).

---

## WEEK 1

### Monday — AWS Quick Tip
*Source: Orphaned EBS Volumes*

The default DeleteOnTermination on non-root EBS volumes is false.

Every time you terminate an EC2 instance, the extra volumes stay behind. Running. Billing.

One Terraform line prevents this:
delete_on_termination = true

---

### Wednesday — Inherited Account
*Source: Audit Checklist*

Last time I ran through my own AWS audit checklist:

- 3 IAM users without MFA
- 2 security groups open to the internet on port 22
- Unattached EBS volumes in a region I forgot I used

Total time: 40 minutes.
Total wasted per month: $87.

---

### Friday — Blog Post (1/2)
*Source: Orphaned EBS Volumes article*

Wrote about orphaned EBS volumes in AWS.

Almost every account has them. They sit in "available" state, not attached to anything, billing you for storage nobody uses.

A single 500 GB gp3 volume = ~$40/month. Five of those = $2,400/year doing nothing.

---

### Friday — Blog Post (2/2)

Quick check in the CLI:
aws ec2 describe-volumes --filters Name=status,Values=available

Three ways to find and fix them:
scanorbit.cloud/blog/how-to-find-orphaned-ebs-volumes-in-aws

---

## WEEK 2

### Monday — AWS Quick Tip
*Source: Open Security Groups*

Scanners like Shodan index newly exposed services within minutes.

Open port 22 to 0.0.0.0/0 at 2pm, brute-force attempts start by 2:15.

Check yours:
aws ec2 describe-security-groups --filters "Name=ip-permission.cidr,Values=0.0.0.0/0"

---

### Wednesday — Building in Public
*Source: personal*

Solo founder update:

- 3 blog articles live
- Reddit account ready, posting starts this week
- Dev.to, Hashnode, Medium set up
- Paying customers: 0

No ads. No cold outreach. Just writing useful AWS content and hoping it compounds.

Ask me in 3 months if this was stupid.

---

### Friday — AWS Quick Tip
*Source: Resource Inventory*

AWS has 200+ services. The Console shows each one on a separate page, one region at a time.

There is no "show me everything in my account" button.

You'd think this would be solved by now. It mostly isn't.

---

## WEEK 3

### Monday — AWS Quick Tip
*Source: Unused Resources*

AWS resources that cost money when you forget about them:

- Unattached EBS volumes (~$40/mo per 500GB)
- Unused Elastic IPs ($3.65/mo each)
- NAT Gateways routing nothing ($32/mo)
- Load balancers with zero targets ($16/mo)

I check quarterly. Always find something.

---

### Wednesday — Inherited Account
*Source: Onboarding article*

"Can you take a look at our AWS?"

Translation: nobody has looked at it for a year and the person who built it left.

First thing I do: list all regions with active resources. Then find everything running that shouldn't be.

Usually saves 20-30% on the bill in week one.

---

### Friday — Blog Post (1/2)
*Source: Open Security Groups article*

Wrote about finding open security groups in AWS.

Port 22 open to 0.0.0.0/0 is the most common misconfiguration I see. It happens because someone opens SSH for debugging and forgets to close it.

---

### Friday — Blog Post (2/2)

The Console makes it hard to catch because you have to check each region separately.

CLI command that scans all regions + how to fix it:
scanorbit.cloud/blog/how-to-find-open-security-groups-aws

---

## WEEK 4

### Monday — AWS Quick Tip
*Source: Cost Visibility*

AWS Cost Explorer shows what you're paying for.

It doesn't show what you're paying for but not using.

A $40/month orphaned volume sitting unattached for six months looks identical to one actively serving data. Both show up as "EBS charges."

---

### Wednesday — Hot Take
*Source: Architecture Monitoring*

People confuse monitoring with visibility.

Monitoring: is the thing I know about working correctly?
Visibility: what do I actually have running?

Most teams invest in the first and ignore the second. Then wonder why there's $200/month in resources nobody remembers creating.

---

### Friday — Blog Post (1/2)
*Source: Resource Inventory article*

New article: why AWS doesn't have a "show me everything" button.

AWS knows every resource in your account. It knows the relationships between them. But there's no single screen that shows it all.

---

### Friday — Blog Post (2/2)

The workarounds range from "almost good enough" to "I'll write a script and regret it later."

What I tried and what works:
scanorbit.cloud/blog/why-you-cant-get-a-full-aws-resource-inventory-from-the-console

---

## WEEK 5

### Monday — AWS Quick Tip
*Source: Compliance Checklist*

Your AWS root account should have MFA and should never be used for anything.

If your root account has access keys, delete them right now. Stop reading. Go delete them.

Number one CIS benchmark failure. Easiest one to fix.

---

### Wednesday — Inherited Account
*Source: Multi-Account Visibility*

Every AWS account tells a story.

Unused NAT Gateways = someone tried multi-AZ and gave up.
Empty ECR repos = containerization project that never shipped.
5 VPCs = 5 architectures from 5 engineers.
Resources in ap-southeast-1 = a latency test nobody cleaned up.

---

### Friday — Blog Post (1/2)
*Source: Unused Resources article*

Wrote about finding unused AWS resources.

The pattern across hundreds of accounts: 15-30% of the monthly bill goes to resources doing absolutely nothing. Not overprovisioned. Completely idle.

---

### Friday — Blog Post (2/2)

The frustrating part: AWS won't flag most of this for you. Cost Explorer shows totals per service, not "this specific volume has been sitting unattached since January."

scanorbit.cloud/blog/how-to-find-unused-aws-resources-cut-costs

---

## WEEK 6

### Monday — AWS Quick Tip
*Source: Compliance Checklist*

CloudTrail should be enabled in ALL regions. Not just the one you deploy to.

A bad actor isn't going to use your preferred region.

Also turn on log file validation. Proves your logs haven't been tampered with. Single checkbox. No reason not to.

---

### Wednesday — Building in Public
*Source: personal*

The hardest part of building a micro-SaaS isn't the code.

It's writing blog posts about your product when your brain just wants to write more code.

Blog articles take 4-6 hours each. The feature code takes 2-3. Marketing is a different muscle. And it hurts.

---

### Friday — Blog Post (1/2)
*Source: Audit Checklist article*

Published an AWS audit checklist for solo engineers.

If you're the only DevOps person on a small team, there's no second pair of eyes. No security team running scans. It's just you.

---

### Friday — Blog Post (2/2)

This is the checklist I actually use. Takes about an hour. Covers IAM, security groups, S3 exposure, cost waste, and region hygiene.

scanorbit.cloud/blog/aws-account-audit-checklist-solo-engineers

---

## WEEK 7

### Monday — AWS Quick Tip
*Source: Infrastructure Map*

The VPC console has a "Resource Map" feature now. Decent for understanding network topology of a single VPC.

But it doesn't span VPCs, doesn't include Lambda or S3, doesn't work across regions.

So you still need something else for the full picture.

---

### Wednesday — Hot Take

Unpopular opinion: most startups don't need Kubernetes. They need to understand what's already running in their AWS account.

I've seen teams spend months on k8s while their existing infra had 15 orphaned volumes and 4 open security groups.

---

### Friday — Blog Post (1/2)
*Source: Cost Visibility article*

New post on AWS cost visibility for small teams.

Monthly ritual at most startups: open Cost Explorer, look at total, compare to last month. If it stayed the same, move on.

Works until the bill jumps $400 and nobody can explain why.

---

### Friday — Blog Post (2/2)

What actually works at the 3-5 person scale (hint: not a FinOps platform):
scanorbit.cloud/blog/aws-cost-visibility-small-teams-beyond-billing-dashboard

---

## WEEK 8

### Monday — AWS Quick Tip
*Source: Compliance Checklist*

First enterprise customer asks for your SOC2 report. Panic.

But most of the work is AWS config you should already have:
- MFA on all IAM users
- CloudTrail in all regions
- EBS encryption by default
- No 0.0.0.0/0 on port 22

Do this first. Worry about the audit firm later.

---

### Wednesday — Inherited Account
*Source: Onboarding article*

Best onboarding task for a new DevOps hire: hand them the security audit checklist.

They check IAM, scan security groups, find orphaned volumes, verify logging.

They get context. You get an audit report you needed anyway. Beats "read the wiki" every time.

---

### Friday — Blog Post (1/2)
*Source: Multi-Account article*

New article on AWS multi-account visibility.

Every growing team ends up with multiple accounts. The problem: each one is another place where resources exist without anyone knowing.

---

### Friday — Blog Post (2/2)

I've talked to CTOs surprised to learn they had running EC2 instances in accounts they thought were empty.

What breaks and how to fix it:
scanorbit.cloud/blog/aws-multi-account-visibility-ctos

---

## WEEK 9

### Monday — AWS Quick Tip
*Source: Infrastructure Map*

Terraform state is not an inventory.

It shows what Terraform thinks exists. Console-created resources won't be there. Resources from other tools won't be there.

I've seen teams treat state as truth and miss entire categories of resources created outside it.

---

### Wednesday — GDPR / EU
*Source: positioning*

Most AWS security tools store your scan results on US servers.

If you're an EU company, that's a GDPR consideration most teams overlook.

Built ScanOrbit in Amsterdam for this. EU-hosted, no data leaves Europe. Small thing until an auditor asks where your scan data lives.

---

### Friday — Blog Post (1/2)
*Source: Onboarding article*

Wrote about onboarding a new DevOps engineer to an existing AWS account.

Most teams give them an IAM login, point at a half-outdated wiki, and say "ask if you have questions."

---

### Friday — Blog Post (2/2)

Then the new person spends two weeks clicking through console pages trying to figure out what nobody documented.

A better process:
scanorbit.cloud/blog/how-to-onboard-devops-engineer-existing-aws-account

---

## WEEK 10

### Monday — AWS Quick Tip
*Source: Cost Visibility*

AWS Cost Anomaly Detection catches sudden spikes but not slow steady waste.

It won't flag a $40/month orphaned volume that's been there since March. The spend is consistent, not anomalous.

Silent waste needs a different approach than alerting.

---

### Wednesday — Building in Public
*Source: personal*

Writing blog articles about AWS security and costs is my entire marketing strategy.

No ads. No cold outreach. No sales calls. Just content aimed at people with the problems my tool solves.

We'll see if it compounds.

---

### Friday — Blog Post (1/2)
*Source: Compliance Checklist article*

New post: AWS compliance checklist for startups approaching SOC2.

Usually starts with a sales call. Enterprise prospect asks for your SOC2 report. You don't have one.

---

### Friday — Blog Post (2/2)

Most of the technical work is config you should already have. The hard part is knowing the order.

Week-by-week sequence from IAM to encryption:
scanorbit.cloud/blog/aws-compliance-checklist-soc2-cis-benchmarks-startups

---

## WEEK 11

### Monday — AWS Quick Tip
*Source: Architecture Monitoring*

Resource Explorer is a search engine, not an inventory.

Good for "show me all S3 buckets." Bad for "show me everything and let me spot problems."

Search works when you know what to look for. "What do we have?" is a different question entirely.

---

### Wednesday — Hot Take

Every company has two AWS architectures:

1. The one in the diagram
2. The one actually running

They match for about a week after you draw the diagram. Then someone adds a service through the console at 11pm.

---

### Friday — Blog Post (1/2)
*Source: Infrastructure Map article*

New article on building an AWS infrastructure map.

Someone asks you to diagram your AWS setup. You open draw.io, draw a VPC box, add EC2 instances. Then pause.

Wait, is the NAT Gateway in the public or private subnet?

---

### Friday — Blog Post (2/2)

30 minutes later you're staring at something incomplete and wrong. Probably both. And it'll be outdated within a week.

What works and what doesn't:
scanorbit.cloud/blog/building-aws-infrastructure-map-tools-approaches

---

## EVERGREEN (post anytime to fill gaps)

### Hot Take 1
AWS pricing is designed so that only AWS understands it.

### Hot Take 2
"We use AWS best practices" usually means "we use whatever the first tutorial told us to."

### Hot Take 3
The AWS Console is the world's most expensive IDE.

### Quick Tip — EIPs
Since February 2024, AWS charges for ALL public IPv4 addresses. An Elastic IP not associated with a running instance costs $3.65/month.

Doesn't sound like much until you have 12 of them across different regions.

### Quick Tip — Log Retention
CloudWatch Logs retains data forever by default.

If you have log groups from a service you killed two years ago, they're still storing data and charging you.

Set retention on every log group. 30 days is fine for most apps.

### Quick Tip — S3
A misconfigured S3 bucket policy can expose your entire data lake to the public internet.

Check:
aws s3api get-bucket-policy-status --bucket YOUR_BUCKET

If IsPublic is true, you have a problem.

### Inherited Account
"Can you take a look at our AWS?"

The 6 scariest words for a DevOps engineer. Translation: nobody has looked at it for 2 years and the original engineer left.

### Quick Tip — IAM Roles
Your AWS account has more IAM roles than you think. Many are auto-created by Lambda, ECS, CloudFormation.

They accumulate. Some have admin-level permissions nobody remembers granting. Worth a quarterly review.