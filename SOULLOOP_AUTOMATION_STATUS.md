# Project Goal
这个项目最终要实现商业模式的闭环。

# Current State
- 已完成 Stripe / Alipay 双支付通道与统一 `completePayment` 支付完成服务。
- 已完成支付幂等、`credit_transactions` 记账、Supabase 支付迁移、Referral / Withdraw / 合规页基础能力。
- 已完成前端商业模式方向调整：参考 Co-Star，将 SoulLoop 从单一东方智慧问答扩展为多模式自我预测 / 自我理解平台。
- 已完成 `/chat` 主题按钮：Love / Career / Money / Self / Decision / Relationship。
- 已完成玩法模式配置：Eastern Wisdom 默认可用，Tarot / Color Personality / Daily Loop 作为付费增强包。
- 已完成新版提示词结构：一句话结论、为什么是这个答案、击中感段落、今日行动、今日禁忌、另一种可能、多模式交叉验证。
- 已新增玩法包权益设计与初始代码：`reading_mode_entitlements` migration、权益 API、前端锁定 / 解锁入口。
- 已新增 `npm run test:entitlements` 自动化脚本：使用临时 Supabase 用户验证 `reading_mode_entitlements` 表访问、RLS 隔离、`unlock_reading_mode` 扣费与幂等。
- 已确认 `/Users/zebramachine/Documents/soulloop` 是指向 `/Users/zebramachine/Documents/soulloop_demo_full` 的 symlink；后续命令需显式固定工作目录或使用绝对路径。
- 已复核上一轮失败原因：`npm run build` 在当前无沙箱限制环境通过，上一轮 Turbopack/PostCSS `Operation not permitted` 是沙箱端口绑定限制，不是业务代码错误。
- 已复核 `npm run test:entitlements`：当前环境可联网，失败原因已从 `fetch failed` 变为远端 Supabase schema 缺失，具体为找不到 `public.reading_mode_entitlements` 与 `public.unlock_reading_mode(...)`；说明 `20260524000000_reading_mode_entitlements.sql` 尚未应用到当前 Supabase 项目。
- 已补强 `npm run test:entitlements` 失败提示：现在会直接输出需执行的 migration 路径与 Supabase SQL Editor 执行位置。
- 已完成商业闭环前端一轮优化：`/credits` 现在明确区分一次性玩法包解锁与后续按次消耗，套餐卡片会提示可解锁玩法包范围；`/chat` 锁定态提示明确展示解锁成本与按次成本；`/pricing` 改为两阶段商业模型说明，并同步真实玩法包解锁/消耗结构。
- 已确认自动化执行过程中的成果文件已经落在当前项目目录 `/Users/zebramachine/Documents/soulloop`：玩法模式配置、权益 API、权益 migration、权益 smoke test、注册邮箱确认页、商业闭环前端更新均在当前工作树中。
- 本轮验证结果：`npm run lint` 通过；`npm run build` 通过；`npm run test:entitlements` 未通过，原因是远端 Supabase schema cache 中仍找不到 `public.reading_mode_entitlements` 与 `public.unlock_reading_mode(...)`，需要先应用本地 migration。

# Next Tasks，自动批准
- [ ] 在 Supabase SQL Editor 执行 `/Users/zebramachine/Documents/soulloop/supabase/migrations/20260524000000_reading_mode_entitlements.sql`，然后运行 `npm run test:entitlements`，确认玩法包权益表、RLS、RPC 可用。
- [ ] 在 `npm run test:entitlements` 通过后，完成玩法包解锁端到端测试：未解锁拦截、credits 解锁扣费、`credit_transactions` 写入、解锁后生成 Tarot / Color / Daily。
- [ ] 在可访问本地或线上页面的环境完成上线前截图检查：重点复核 `/credits` 套餐文案、`/chat` 锁定态提示、`/pricing` 模式价格说明。

# Guardrails
- 不要执行破坏性 git 命令。
- 改动前先读相关代码。
- 每轮结束要运行测试或说明无法测试。
- 每轮结束必须更新本文件。
