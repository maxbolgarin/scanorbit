---
title: "AWS Compliance Checklist: SOC2 and CIS Benchmarks for Startups"
description: "Your first enterprise customer wants to see your SOC2 report. Here's what that actually means for your AWS account, which CIS benchmarks matter, and how to get compliant without hiring a full-time security team."
link: "aws-compliance-checklist-soc2-cis-benchmarks-for-startups"
pubDate: 2026-04-08
author: "Maksim"
draft: false
tags: ["aws", "compliance", "soc2", "cis-benchmark", "startup", "security"]
---

It usually starts with a sales conversation. You're talking to your first enterprise prospect, everything is going well, and then they ask: "Can you share your SOC2 report?"

If you're a startup with three engineers and no security team, that question lands like a brick. You don't have a SOC2 report. You might not even know exactly what SOC2 is beyond "the compliance thing enterprise customers ask about." And now you're wondering how much it costs, how long it takes, and whether your AWS account is anywhere close to ready.

I went through this process myself. Not fun, but not as terrifying as it looks from the outside. Most of the actual work is configuration you should probably have anyway. The hard part is knowing what to configure and in what order.

## SOC2 and CIS: what they actually are

SOC2 (Service Organization Control 2) is an audit framework. A certified auditor examines your systems against a set of trust principles — security, availability, processing integrity, confidentiality, and privacy — and issues a report saying whether your controls meet the standard. Enterprise customers ask for it because it's the closest thing to a standardized way of verifying that a vendor isn't going to leak their data.

The audit itself doesn't tell you what to implement. It checks whether you have controls in place and whether they're working. That's where CIS benchmarks come in.

CIS (Center for Internet Security) publishes specific configuration benchmarks for AWS. The CIS AWS Foundations Benchmark is a checklist of about 50 specific settings: enable CloudTrail in all regions, require MFA for IAM users, encrypt EBS volumes, don't use the root account, that kind of thing. Each recommendation has a clear pass/fail test. Either your account meets it or it doesn't.

Here's how they relate: CIS benchmarks give you the specific technical controls. SOC2 auditors want to see that you have controls like these in place and that you can prove they're working. You don't technically need to follow CIS to pass SOC2, but CIS gives you a concrete starting point instead of staring at abstract trust principles trying to figure out what to do.

## The CIS controls that actually matter first

The full CIS AWS Foundations Benchmark has dozens of recommendations. Some are critical. Some matter less for a small startup. Here's where to start if you're trying to get your account into shape and you don't have unlimited time.

### Identity and access management

This is where auditors look first, and it's where most startups fail hardest.

**No root account usage.** The AWS root account should have MFA enabled and should never be used for daily operations. Create IAM users or use SSO. If your root account has access keys, delete them. This sounds basic but I still see root access keys in production accounts regularly.

**MFA on every human user.** No exceptions. The [IAM audit section of the account checklist](/blog/aws-account-audit-checklist-for-solo-engineers) has the CLI commands to check this in bulk. If any user has a password but no MFA device, that's a CIS finding and an auditor will flag it.

**No inline IAM policies.** Attach managed policies to groups, assign users to groups. Inline policies on individual users are harder to audit and easier to lose track of. An auditor wants to see that you have a consistent, reviewable permission structure.

**Rotate access keys.** CIS recommends rotating access keys every 90 days. In practice, most startups use longer rotation cycles. At minimum, deactivate keys that haven't been used in 90 days. They're either forgotten or unnecessary, and either way they're a liability.

### Logging and monitoring

An auditor needs to see that you can detect and investigate security events. No logs means no evidence that anything is working.

**CloudTrail enabled in all regions.** Not just the region you deploy to. All of them. A bad actor isn't going to helpfully use your preferred region. CloudTrail should log to an S3 bucket with versioning enabled and server-side encryption. If CloudTrail is off, or only on in one region, that's one of the most common CIS failures I see.

**CloudTrail log file validation enabled.** This proves your logs haven't been tampered with. It's a single setting when you create the trail. No reason not to enable it.

**VPC Flow Logs on production VPCs.** You need network-level logging for any VPC that handles customer data. Flow logs capture source, destination, ports, and whether traffic was accepted or rejected. Store them in S3 or CloudWatch Logs with appropriate retention.

**Config enabled.** AWS Config records resource configuration changes over time. For SOC2, this gives you evidence that your controls have been consistently applied, not just that they're correct right now. The cost adds up across many resource types, so at minimum enable it for the high-value resources: IAM, EC2, RDS, S3, security groups.

### Network security

**No security groups open to 0.0.0.0/0 on management ports.** Port 22 (SSH) and port 3389 (RDP) open to the internet is a CIS critical finding. I wrote a [full guide on finding and fixing open security groups](/blog/how-to-find-open-security-groups-aws) with both console and CLI methods. Run those checks. If anything is open, fix it before the auditor arrives.

**Default security groups should deny all traffic.** The default security group in every VPC allows all outbound and all inbound from itself. CIS says to restrict it. Most teams never touch the default group, which means it's sitting there with permissive rules that could be accidentally attached to a resource.

**Use private subnets for anything that doesn't need public access.** Databases, application servers, internal services — none of these need a public IP. Put them in private subnets behind a NAT Gateway. Auditors check for this because it reduces attack surface in a verifiable way.

### Data protection

**Encrypt EBS volumes.** Enable default EBS encryption in every region you use. New volumes will be encrypted automatically. Existing unencrypted volumes need the snapshot-copy-restore dance to encrypt them. Annoying but necessary. Check what you have with:

```bash
aws ec2 describe-volumes \
  --query "Volumes[?Encrypted==\`false\`].{ID:VolumeId,Size:Size}" \
  --output table
```

**Encrypt RDS instances.** RDS encryption is set at creation time and can't be changed after. If you have an unencrypted production database, you'll need to create an encrypted snapshot and restore from it. Plan for downtime.

**S3 bucket encryption and public access blocks.** Every bucket should have server-side encryption enabled (AES-256 or KMS) and the S3 Block Public Access settings turned on at the account level. This is one of the easiest CIS controls to implement and one of the most visible to auditors.

**Encrypt data in transit.** Use TLS everywhere. If you're serving traffic through an ALB, make sure the listener is HTTPS. If you have internal services talking to each other, TLS there too. Certificate management through ACM is free for AWS-hosted services.

### Resource hygiene

This doesn't get talked about enough in compliance contexts, but auditors notice it.

[Unused resources](/blog/how-to-find-unused-aws-resources-and-cut-costs) aren't just a cost problem. An [orphaned EBS volume](/blog/how-to-find-orphaned-ebs-volumes-in-aws) that's unencrypted and contains old data is a compliance finding. A load balancer with no targets might have been pointing at a decommissioned service that handled customer data. Stale resources in [unexpected regions](/blog/why-you-cant-get-full-aws-resource-inventory-from-console) can be a data residency violation, which matters a lot if your customers care about GDPR.

Clean accounts are easier to audit. That's not a compliance requirement per se, but it's practical reality. The fewer resources you have sitting around doing nothing, the fewer questions the auditor asks and the faster the process goes.

## The SOC2 process itself

The technical controls are the foundation. But SOC2 is about more than just AWS configuration. The auditor also looks at:

**Policies and procedures.** You need written security policies. Access control policy, incident response plan, change management process, data retention policy. These don't have to be 50-page documents. A clear, honest two-page policy that your team actually follows beats a comprehensive document nobody reads. Auditors can tell the difference.

**Evidence of operation.** It's not enough to have the right settings now. The auditor wants proof that they've been in place over the review period (typically 3-12 months). This is where CloudTrail logs, Config history, and access reviews become critical. If you enable everything a week before the audit, the review period will show a gap.

**Vendor management.** You need to document your third-party vendors and their security practices. For an AWS-hosted SaaS, AWS itself is a vendor, and you can point to AWS's own SOC2 report for infrastructure-level controls. But you also need to cover other tools: your email provider, your monitoring service, your payment processor.

**People processes.** Onboarding, offboarding, access reviews. When someone leaves the team, do you revoke their access? Can you prove it? When a [new engineer joins](/blog/how-to-onboard-devops-engineer-to-aws-account), do they get appropriate access or admin by default?

## What this costs

Rough numbers for a small startup. The SOC2 audit itself: $15,000-$50,000 depending on scope and auditor. Some firms specialize in startups and charge on the lower end. The prep work can be done internally if you have someone willing to own it, or you can use a compliance platform like Vanta, Drata, or Secureframe ($10,000-$25,000/year) that automates evidence collection and guides you through the policies.

The AWS configuration changes cost almost nothing. Most of what I've described above is either free (MFA, encryption, access policies) or very cheap (CloudTrail, Config for a subset of resources). The main cost is time.

If you're starting from zero, expect 2-4 months of prep work before you're ready for the audit. If you've already been doing [regular account audits](/blog/aws-account-audit-checklist-for-solo-engineers), you're probably closer than you think.

## Where to start today

Don't try to do everything at once. Here's the sequence that gets you the most compliance value per hour spent:

**Week 1:** IAM. Enable MFA everywhere, delete unused access keys, get off the root account. These are the highest-severity CIS findings and the first thing an auditor checks.

**Week 2:** Logging. Enable CloudTrail in all regions with log validation. Turn on VPC Flow Logs for production. Enable Config for your core resource types.

**Week 3:** Encryption. Enable default EBS encryption, check RDS encryption status, enable S3 Block Public Access at the account level.

**Week 4:** Network. Audit security groups for [0.0.0.0/0 rules](/blog/how-to-find-open-security-groups-aws). Restrict the default security group. Verify private subnet usage for non-public resources.

After that, start writing your policies and picking an audit firm. The technical controls are the foundation. The rest is documentation and evidence, which is tedious but not technically hard.

If you want to see where your account stands right now, [ScanOrbit](https://scanorbit.cloud) runs CIS-aligned checks alongside security misconfigurations, cost waste, and GDPR data residency findings. It's agentless, connects through a read-only IAM role, and shows you the severity breakdown so you can triage findings. I built it partly because compliance audits kept surfacing the same misconfigurations across different accounts, and I wanted a faster way to catch them upfront.

---

*Part of our series on AWS security and compliance. See also: [AWS Account Audit Checklist for Solo Engineers](/blog/aws-account-audit-checklist-for-solo-engineers), [How to Find and Fix Open Security Groups](/blog/how-to-find-open-security-groups-aws), and [How to Find Unused AWS Resources and Cut Costs](/blog/how-to-find-unused-aws-resources-and-cut-costs).*