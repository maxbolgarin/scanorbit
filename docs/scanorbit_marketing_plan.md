# ScanOrbit — Маркетинг-план на 12 недель

## Фаза 1: Контент-батч (Неделя 1)

Цель: написать 10 SEO-статей за одну неделю и выложить все на сайт.

### 10 статей (от простого к сложному)

| # | Тема | Целевой запрос | Персона |
|---|------|---------------|---------|
| 1 | How to See All Resources in Your AWS Account | "list all aws resources", "aws resource inventory" | Solo DevOps |
| 2 | AWS Account Audit Checklist for Solo Engineers | "aws audit checklist", "aws account review" | Solo DevOps |
| 3 | How to Find Unused AWS Resources and Cut Costs | "find unused aws resources", "aws cost optimization" | Solo DevOps / CTO |
| 4 | AWS Multi-Account Visibility: What CTOs Need to Know | "aws multi account management", "aws organization visibility" | CTO / Team Lead |
| 5 | How to Monitor Your AWS Architecture Without CloudWatch Dashboards | "aws architecture monitoring", "aws infrastructure overview" | Solo DevOps |
| 6 | AWS Security Groups Audit: Finding Open Ports and Misconfigurations | "aws security group audit", "open ports aws" | Solo DevOps |
| 7 | Building an AWS Infrastructure Map: Tools and Approaches | "aws infrastructure diagram tool", "aws architecture visualization" | Solo DevOps / CTO |
| 8 | AWS Cost Visibility for Small Teams: Beyond the Billing Dashboard | "aws cost visibility small team", "aws spending breakdown" | CTO / Team Lead |
| 9 | How to Onboard a New DevOps Engineer to an Existing AWS Account | "onboard devops aws", "understand existing aws infrastructure" | CTO / Team Lead |
| 10 | AWS Compliance Checklist: SOC2 and CIS Benchmarks for Startups | "aws soc2 compliance checklist", "aws cis benchmark startup" | CTO |

### Структура каждой статьи

- 1000–1500 слов
- Формат: Проблема → Ручное решение → Почему это больно → Как автоматизировать → CTA на ScanOrbit
- Canonical URL всегда на свой сайт
- Каждая статья линкует на 2–3 других статьи блога (internal linking)
- CTA: не агрессивный, в стиле "If you want to automate this, ScanOrbit does X in one click"

### Как писать быстро

- Используй Claude Code: даёшь outline + ключевой запрос → получаешь драфт → редактируешь
- Один день = 2 статьи
- 5 рабочих дней = 10 статей


---

## Фаза 2: Дистрибуция (Недели 2–11)

**Один фиксированный день в неделю.** Например, вторник.

### Еженедельный ритуал (~30–40 минут):

1. Взять следующую статью из списка
2. Адаптировать под площадку (убрать прямую рекламу, добавить вступление)
3. Опубликовать с **canonical URL** на свой сайт
4. Написать твит с ключевым тезисом + ссылка
5. Найти 1 релевантный тред на Reddit → оставить полезный комментарий (без ссылки!)

### Ротация площадок

| Неделя | Статья | Площадка | Доп. действие |
|--------|--------|----------|---------------|
| 2 | #1 (All Resources) | dev.to | Твит + Reddit r/devops комментарий |
| 3 | #2 (Audit Checklist) | Medium | Твит + Reddit r/aws комментарий |
| 4 | #3 (Unused Resources) | Hashnode | Твит + Reddit r/devops комментарий |
| 5 | #4 (Multi-Account) | dev.to | Твит + LinkedIn пост (CTO-контент) |
| 6 | #5 (Without CloudWatch) | Medium | Твит + Reddit r/aws комментарий |
| 7 | #6 (Security Groups) | Hashnode | Твит + HackerNews (если статья сильная) |
| 8 | #7 (Infra Map) | dev.to | Твит + Reddit r/devops комментарий |
| 9 | #8 (Cost Visibility) | Medium | Твит + LinkedIn пост |
| 10 | #9 (Onboarding) | dev.to | Твит + Reddit r/devops комментарий |
| 11 | #10 (Compliance) | Hashnode | Твит + LinkedIn пост |

---

## Фаза 3: Product Hunt (Неделя 6–7)

### Подготовка (неделя 6):
- Сделать 4–5 скриншотов/GIF продукта
- Написать tagline (1 строка) и description (3–4 предложения)
- Подготовить "maker comment" — история создания, почему сделал
- Попросить 5–10 человек (друзья, коллеги) зайти и upvote в день запуска

### Запуск (неделя 7):
- Запустить в 00:01 PST (09:01 по Амстердаму)
- Первый комментарий — свой maker comment
- Поделиться в Twitter, LinkedIn, Reddit

---

## Фаза 4: Community presence (параллельно, ongoing)

### Reddit стратегия

**НЕ постить ссылки на продукт.** Модераторы банят.

Стратегия: быть полезным участником.

- Подписаться на r/aws, r/devops, r/terraform, r/sysadmin
- Каждую неделю: найти 2–3 вопроса, на которые можешь ответить как эксперт
- Примеры вопросов, на которые отвечать:
  - "How do I audit my AWS account?"
  - "What tools do you use for AWS visibility?"
  - "New job, inherited a messy AWS account, where to start?"
  - "How to track AWS resources across regions?"
- В ответе: давать реальную пользу, в конце *иногда* упоминать "I actually built a tool for this — [name]"
- Цель: через 2–3 месяца набрать 1500+ кармы и стать узнаваемым в нише

### Twitter стратегия

С 0 подписчиков Twitter — это не канал дистрибуции, а канал присутствия.

- 2–3 твита в неделю (не больше)
- Формат: short tips об AWS ("TIL: You can have 500+ unused EIPs and not know it. Here's how to find them.")
- Reply to DevOps influencers (Corey Quinn, Last Week in AWS, etc.)
- Не промоутить продукт чаще 1 раза в 2 недели

---

## DevOps-комьюнити (разовые действия)

- [ ] Подать заявку в AWS Community Builders программу
- [ ] Вступить в CNCF Slack → #aws channel
- [ ] Вступить в DevOps-focused Discord серверы (DevOps, Platform Engineering)
- [ ] Написать Show HN пост на Hacker News (после Product Hunt)

---

## Метрики (трекать еженедельно)

| Метрика | Цель через 12 недель |
|---------|---------------------|
| Уникальные посетители сайта | 500+/мес |
| Регистрации | 20+ |
| Платящие пользователи | 2–3 |
| Reddit карма | 1500+ |
| Twitter подписчики | 100+ |
| Бэклинки (от площадок) | 10+ |

---

## Важные правила

1. **Canonical URL** — ВСЕГДА ставить на свой сайт при репосте на площадки. Иначе Google проиндексирует dev.to вместо тебя.
2. **Не спамить ссылками на Reddit.** Только полезные ответы. Ссылка = 1 из 5 комментариев максимум.
3. **Не менять расписание.** Один день в неделю — это всё. Если пропустил, не догоняй, просто продолжай.
4. **Первые деньги ≠ успех маркетинга.** SEO работает через 2–4 месяца. Первые 6 недель — это инвестиция без возврата. Это нормально.