# ScanOrbit — Twitter контент-план

## Стратегия

**Цель:** не продавать, а стать узнаваемым лицом в AWS/DevOps нише.
С 0 подписчиков Twitter работает как social proof, не как канал продаж.

**Частота:** 3 твита в неделю (пн, ср, пт). Можно писать батчем в воскресенье.
**Соотношение:** 80% полезный контент / 10% личный опыт / 10% продукт

---

## 5 форматов твитов

### 1. AWS Quick Tip (2 раза в неделю)

Короткие практические факты, которые DevOps реально полезны.

**Примеры:**

> TIL: A single AWS account can accumulate 100+ unused Elastic IPs, idle load balancers, and detached EBS volumes without anyone noticing.
>
> The billing dashboard won't flag most of them.
>
> Here's a quick CLI one-liner to find detached EBS volumes:
> `aws ec2 describe-volumes --filters Name=status,Values=available`

---

> Most AWS accounts have at least one security group with 0.0.0.0/0 on port 22.
>
> Not because someone wanted it. Because someone forgot to remove it after debugging.
>
> Quick check:
> `aws ec2 describe-security-groups --filters Name=ip-permission.cidr,Values=0.0.0.0/0`

---

> AWS has 200+ services. The average startup uses 15–20.
>
> But most teams can't answer a simple question: "What exactly is running in our account right now?"
>
> No CloudWatch dashboard will tell you that.

---

> You can have resources in us-east-1 that nobody on your team created.
>
> Some AWS services (like IAM, Route53, CloudFront) default to us-east-1 regardless of your region setting.
>
> Always scan all regions. Not just the one you think you're using.

---

> AWS Cost Explorer shows you what you're paying for.
>
> It doesn't show you what you're paying for but not using.
>
> Big difference.

---

> A single misconfigured S3 bucket policy can expose your entire data lake to the public internet.
>
> `aws s3api get-bucket-policy-status --bucket YOUR_BUCKET`
>
> If IsPublic: true — you have a problem.

---

> Your AWS account has more IAM roles than you think.
>
> Many are auto-created by services like Lambda, ECS, CloudFormation.
>
> Over time they accumulate. Some have admin-level permissions nobody remembers granting.
>
> `aws iam list-roles --query 'Roles[?AssumeRolePolicyDocument]'`

---

### 2. "I inherited an AWS account" stories (1 раз в неделю)

Самый резонансный формат. Каждый DevOps хоть раз получал чужой аккаунт.

**Примеры:**

> Started a new job. Inherited an AWS account with:
>
> - 47 EC2 instances, 12 of them stopped but with attached EBS
> - 3 RDS instances nobody could name the app for
> - An S3 bucket last accessed in 2021
> - Total bill: $4,200/month
>
> First week was just archaeology.

---

> "Can you take a look at our AWS?" — the 6 scariest words for a DevOps engineer.
>
> What they mean: nobody has looked at it for 2 years and the original engineer left.

---

> Every AWS account tells a story.
>
> Unused NAT Gateways = someone tried a multi-AZ setup and gave up.
> Empty ECR repos = the containerization project that never shipped.
> 5 VPCs = 5 different "architectures" from 5 different engineers.

---

> The first thing I do when I inherit an AWS account:
>
> 1. List all regions with active resources
> 2. Find everything that's running but shouldn't be
> 3. Map what's connected to what
> 4. Figure out what can be safely turned off
>
> Usually saves 20-30% on the bill in week one.

---

### 3. Building in public (1 раз в 2 недели)

Личный опыт строительства micro-SaaS. Люди любят такой контент.

**Примеры:**

> Building an AWS account analyzer as a solo dev.
>
> Week 1: MVP done, scans 15 AWS services.
> Week 4: Added multi-account support.
> Week 8: First blog post published.
> Week 12: First user signed up.
>
> Slow is fine. Shipping is what matters.

---

> The hardest part of building a micro-SaaS isn't the code.
>
> It's writing blog posts about your product when your brain just wants to write more code.
>
> Marketing is a different muscle. And it hurts.

---

> Spent 3 months building an AWS tool.
> Spent 0 months telling anyone about it.
> Got 1 signup.
>
> Lesson learned: distribution > product.

---

> Solo founder week: Monday-Friday writing code. Saturday-Sunday writing about code.
>
> The writing is harder.

---

### 4. AWS Memes / Hot takes (1 раз в 2 недели)

Юмор и спорные мнения получают engagement.

**Примеры:**

> AWS pricing is designed so that only AWS understands it.

---

> CloudFormation templates are just YAML-shaped anxiety.

---

> "We use all AWS best practices" usually means "we use whatever the first tutorial told us to."

---

> Every company has two AWS architectures:
>
> 1. The one in the diagram
> 2. The one actually running

---

> The AWS Console is the world's most expensive IDE.

---

> Unpopular opinion: most startups don't need Kubernetes. They need to understand what's already running in their AWS account.

---

### 5. Ответы на свои блог-посты (совпадает с расписанием дистрибуции)

Когда постишь статью на площадку, делаешь тред из ключевых тейков.

**Пример:**

> I just wrote about auditing AWS security groups.
>
> The TL;DR:
>
> → 80% of accounts have at least one overly permissive rule
> → Default SGs are the main culprit
> → One CLI command can find them all
>
> Full post: [link]

---

## Еженедельный календарь

| День | Формат | Пример типа |
|------|--------|-------------|
| Понедельник | AWS Quick Tip | CLI one-liner, факт о сервисе |
| Среда | "Inherited account" / Hot take / Building in public | Ротация |
| Пятница | AWS Quick Tip ИЛИ блог-пост тред (если неделя дистрибуции) | Совмещай с площадкой |

---

## Reply-стратегия (5 мин/день)

Самый быстрый способ получить подписчиков с 0 — отвечать на чужие твиты.

### Кого фолловить и reply'ить:

| Аккаунт | Почему |
|---------|--------|
| @QuinnyPig (Corey Quinn) | Last Week in AWS, самый известный AWS-контент-мейкер |
| @jeffbarr | AWS Chief Evangelist, огромный reach |
| @kelaboratory | AWS DevOps контент |
| @iamvickyav | AWS tips |
| @StephaneMaarek | AWS certifications, huge audience |
| @CloudNativeFdn | CNCF news |
| @taborwang | AWS content creator |

### Как отвечать:

**НЕ:** "Great post!" / "Thanks for sharing!"
**ДА:** Добавить конкретную деталь, свой опыт, или уточнение.

**Пример:**

Чужой твит: "AWS Cost Explorer is underrated"

Твой reply:
> True, but it still doesn't show you resources that cost $0 but shouldn't exist — like unused EIPs, detached volumes, or idle NAT Gateways. Those are the silent killers of AWS budgets.

---

Чужой твит: "Just started managing a multi-account AWS org"

Твой reply:
> First thing I'd do: run `aws organizations list-accounts` then check each account for resources in ALL regions, not just the default one. You'll be surprised what's hiding in ap-southeast-1.

---

## Хэштеги

Не больше 2 на твит. Использовать только если органично:

- #AWS
- #DevOps
- #CloudSecurity
- #BuildInPublic (для personal/product твитов)

---

## Батч-процесс: как написать 12 твитов за 30 минут

1. Открой терминал, вспомни 3 AWS-проблемы, которые видел на этой неделе
2. На каждую проблему — один tip-твит + один "inherited account" твит
3. Добавь 1 building-in-public + 1 hot take
4. Запланируй через Twitter scheduling (или Buffer/Typefully бесплатный тариф)
5. На 4 недели вперёд = 30 минут раз в месяц

---

## Метрики (первые 3 месяца)

| Месяц | Цель подписчики | Цель impressions/неделя |
|-------|----------------|----------------------|
| 1 | 30 | 1,000 |
| 2 | 70 | 3,000 |
| 3 | 150 | 5,000 |

Не гонись за числами. Тебе нужны не 10K подписчиков, а 50 правильных людей (DevOps, CTOs, solo engineers), которые запомнят ScanOrbit.

---

## Правило: что НЕ делать

1. **Не постить "Check out my product!" чаще 1 раза в 2 недели.** Люди отписываются от рекламы.
2. **Не покупать подписчиков.** Мертвые аккаунты убивают reach.
3. **Не постить больше 1 раза в день.** С 0 подписчиков это выглядит как спам-бот.
4. **Не игнорировать replies.** Если кто-то ответил — ответь. Это редкость на маленьком аккаунте.
5. **Не использовать AI-голос.** Пиши как человек: коротко, конкретно, с opinion. "AWS pricing is confusing" лучше чем "Navigating the complexities of AWS cost optimization strategies."
