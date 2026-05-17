---
title: "Building an AWS Infrastructure Map: Tools and Approaches"
description: "You need a map of your AWS infrastructure but AWS doesn't give you one. Here's what works for generating architecture diagrams, from manual tools to automated discovery, and where each approach breaks down."
link: "building-aws-infrastructure-map-tools-and-approaches"
pubDate: 2026-03-25
author: "Maksim"
draft: false
tags: ["aws", "infrastructure-map", "architecture", "diagram", "devops"]
---

At some point someone will ask you to draw a diagram of your AWS infrastructure. Maybe it's a new hire who needs context. Maybe it's an auditor. Maybe it's you, three months after deploying everything, realizing you can't remember how the pieces fit together.

You open a diagramming tool, draw a VPC box, put some EC2 instances in it, add an RDS database, connect them with arrows. Then you pause. Wait, is the NAT Gateway in the public subnet or private? Which security groups are attached to the ALB? Are there Lambda functions involved? What about that S3 bucket the frontend talks to?

Thirty minutes in, you're staring at something that's either incomplete or wrong. Probably both. And it'll be outdated within a week.

This is one of those problems that sounds like it should be solved by now. It mostly isn't.

## Why AWS doesn't just show you a map

It's a fair question. AWS knows every resource in your account. It knows the relationships between them: which security groups are attached to which instances, which subnets are in which VPCs, which load balancers route to which target groups. Why can't it just draw the diagram?

The honest answer is probably that the problem is harder than it looks at scale. An account with 15 resources has a clean diagram. An account with 1,500 resources has a mess of overlapping boxes that's less useful than a spreadsheet. AWS has apparently decided not to ship something mediocre for this, which I can respect even if it's frustrating.

What AWS does give you is pieces. The VPC console has a "Resource Map" feature (relatively new) that shows resources within a single VPC. It's actually decent for understanding the network topology of one VPC. But it doesn't span VPCs, doesn't include non-networking resources like Lambda or S3, and doesn't work across regions or accounts.

So you're left assembling the map yourself, one way or another.

## Manual diagramming tools

The most common approach, and honestly still the most common output, is a hand-drawn diagram in a tool like draw.io (now diagrams.net), Lucidchart, or Cloudcraft.

**draw.io / diagrams.net** is free, has AWS icon libraries built in, and exports to everything. The experience is drag-and-drop: you place VPC boxes, add subnets, drop in EC2 icons, draw arrows. For a small architecture that changes infrequently, this works fine. I've used it for years and still reach for it when I need to explain something in a document or presentation.

**Lucidchart** is similar but collaborative and paid. If multiple people need to edit the same diagram, it's worth considering. The AWS integration can import some resources automatically (more on that below), but the results need manual cleanup.

**Cloudcraft** is specifically built for AWS architecture diagrams. It has a 3D isometric view that looks nice in presentations. It can also connect to your AWS account and pull resources automatically, which sounds great until you try it on a non-trivial account and get a diagram with 200 overlapping components that you need to rearrange manually. Still, it's one of the better options if you're willing to spend time organizing the output.

The fundamental problem with all manual diagramming: the diagram starts decaying the moment you finish drawing it. Someone adds a new service, someone changes a subnet, a new region gets resources. Unless updating the diagram is part of your deployment process (it never is), it drifts.

## Diagram-as-code

A step up from manual drawing. Instead of dragging boxes around, you describe your architecture in code and a tool generates the diagram. The advantage is that you can version it in Git and update it alongside infrastructure changes.

**Diagrams (Python library)** by mingrammer is probably the most popular option. You write Python, it generates a PNG or PDF:

```python
from diagrams import Diagram, Cluster
from diagrams.aws.compute import EC2
from diagrams.aws.database import RDS
from diagrams.aws.network import ALB

with Diagram("Production", show=False):
    with Cluster("VPC"):
        lb = ALB("ALB")
        with Cluster("Private Subnets"):
            web = [EC2("web-1"), EC2("web-2")]
            db = RDS("postgres")
        lb >> web >> db
```

Clean output, easy to read, version-controlled. The catch: you're still manually describing the architecture. If someone adds an EC2 instance through the console, your diagram code doesn't know about it. It's a better workflow than drag-and-drop, but it has the same drift problem.

**Mermaid and PlantUML** work similarly for simpler diagrams. Good for documentation that lives in Markdown files. Less suited for complex AWS architectures with many components.

The diagram-as-code approach works best when your infrastructure is entirely managed by Terraform or CloudFormation and changes go through code review. In that world, updating the diagram in the same PR as the infra change is realistic. In accounts where people also use the console (which is most accounts), it still drifts.

## Automated discovery tools

This is where things get more interesting and more messy.

**AWS Application Discovery Service** exists but it's designed for migration planning, not architecture mapping. It uses agents or agentless connectors to discover on-premises servers. Not really what you want for understanding your existing AWS setup.

**Former2** is an open-source tool that scans your AWS account and generates CloudFormation or Terraform templates from existing resources. It's not a diagramming tool per se, but the output gives you a machine-readable description of what exists. You could feed that into a diagramming tool. In practice, the generated templates are verbose and need significant cleanup, but it's a useful starting point for understanding what's there.

**Steampipe** lets you query your AWS account using SQL. It doesn't generate diagrams, but it gives you the data you'd need to build one:

```sql
select vpc_id, subnet_id, instance_id, instance_type, 
       public_ip_address, security_groups
from aws_ec2_instance
where region = 'eu-west-1';
```

Pair it with a visualization tool and you have something. The gap is that "pair it with a visualization tool" is a project, not a feature.

**Lucidchart and Cloudcraft AWS integrations** pull resources from your account and place them on a canvas. Of the automated options, these probably produce the most immediately usable output. The tradeoff is cost (both are paid for meaningful use) and the fact that auto-generated layouts for complex accounts look like someone dumped a box of Lego on a table. You'll spend time rearranging.

None of these give you a clean, accurate, always-up-to-date map without effort. The automated ones get you closer to accuracy (they read real state, not someone's memory) but sacrifice visual clarity. The manual ones give you clean visuals but sacrifice accuracy over time.

## What I actually do

I'll be honest about my own process because I don't think there's a clean answer here.

For documentation and presentations, I draw diagrams manually in draw.io. I keep them simple: major components, main data flows, no attempt to show every security group or subnet. A diagram that shows the big picture is more useful than a comprehensive one nobody can read.

For understanding what actually exists, I don't use diagrams at all. I use resource enumeration. The [CLI scripts from the audit checklist](/blog/aws-account-audit-checklist-for-solo-engineers) or a scanner that [covers all regions automatically](/blog/how-to-monitor-aws-architecture-without-cloudwatch-dashboards). A list of resources with their types, regions, and states tells me more than a diagram when the question is "what do we have and is anything wrong."

For ongoing visibility, I use [ScanOrbit](https://scanorbit.cloud) — I built it, so take this with appropriate skepticism. It doesn't generate architecture diagrams (I might add that someday), but it does give you a complete inventory across all regions with security findings and cost analysis attached. The inventory is always current because it scans your account through a read-only IAM role rather than depending on someone updating a diagram. It shows you the resource count and finding severity, which at minimum tells you how much you don't know about your own account.

The broader point: a map of your infrastructure is two different things depending on why you need it. If you need something to put in a document or show to a new team member, draw it manually and accept that it'll drift. If you need to actually understand what's running in your account right now, [an inventory](/blog/why-you-cant-get-full-aws-resource-inventory-from-console) is more useful than a diagram.

And if you need both, do both. But don't confuse the pretty picture with the real state. They're almost never the same thing after the first week.

---

*Part of our series on AWS infrastructure visibility. See also: [How to Monitor Your Architecture Without CloudWatch Dashboards](/blog/how-to-monitor-aws-architecture-without-cloudwatch-dashboards), [AWS Multi-Account Visibility for CTOs](/blog/aws-multi-account-visibility-what-ctos-need-to-know), and [How to Find Unused AWS Resources](/blog/how-to-find-unused-aws-resources-and-cut-costs).*