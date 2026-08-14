# dsh-catgirl-plugin

**Neko — a token-efficient persona runtime for DeepSeek Harness.**

把人格留在界面，把智能留给模型。Keep personality in the interface, intelligence in the model.

让 DeepSeek Harness 的模型像猫娘一样说话，**同时比默认 Harness 更省 Token**——实测首个请求新输入减少 67%，稳态缓存命中减少 66%。

Make the DeepSeek Harness model talk like a catgirl — **while using fewer tokens than the default harness**. Measured: -67% new input tokens on the first request, -66% cache reads in steady state.

## 核心思想 / Core idea

传统做法让 LLM 自己"演猫娘"：在 system prompt 里注入几百 token 的长 persona，每个请求重复付费，还会让模型输出变啰嗦。

The traditional approach makes the LLM "act catgirl" itself: a few hundred tokens of persona injected into the system prompt, paid again on every request, and the model's output gets wordier.

本插件反其道而行：

This plugin does the opposite:

```text
用户
 ↓
DeepSeek（正常、简洁回答，极短 persona 约束）
 ↓
Neko 插件层（本地渲染：喵化 / 颜文字 / 称呼）
 ↓
「主人，这段代码的问题在这里喵～」
```

- **会话日志保存原文**，模型上下文零污染（Persona Virtualization）
- **猫娘风味 0 LLM Token**，全部由本地渲染完成
- **工具 schema 裁剪**：模型只看到最小编码工具集，省下每请求数千 token

## 插件家族 / Plugin family

| 插件 | 作用 | Token 影响 |
|---|---|---|
| `catgirl-lite.js` | 极短 persona（6 token）：`Be concise, friendly, and natural.` | 每请求 +6（可忽略） |
| `neko-renderer.js` | headless 显示层本地渲染：句尾「喵~」+ 颜文字，代码块原样保留 | 0 |
| `catgirl-economy.js` | 工具裁剪 + **渐进式披露**：25 个工具 → 8 个，模型可调用 `enable_tool` 按需解锁（subagent/web_search/skill 等） | **每请求 -8,491 token（-69%）**，解锁时只付对应工具 schema |
| `client/`（`dsh-catgirl-plugin-client`） | **Web UI 渲染**：shadow 默认 assistant 渲染器，喵化显示文本；会话日志保持原文 | 0 |
| `index.js` | 传统长 persona 猫娘（对比用，不推荐） | 每请求 +数百 |
| `usage-meter.js` | 开发工具：把每次请求的 usage chunk 写入文件 | 0 |

## 实测数据 / Measured results

同一任务（写快速排序 + 保存 + 运行验证，4 步 agent 任务），真实 DeepSeek API，2026-08-14：

Same task (write quicksort + save + run, 4-step agent task), real DeepSeek API:

### 冷启动（首个 agent 请求，无缓存）/ Cold start (first agent request, no cache)

| 配置 / Config | 首个请求新输入 | 全程新输入 | 全程缓存命中 | 输出 |
|---|---|---|---|---|
| 基线（无插件）/ Baseline | 12,372 | 12,520 | 25,856 | 838 |
| 传统猫娘 / Traditional catgirl | 12,576 | 13,156 | 26,240 | 860 |
| **Neko Lite + Economy** | **3,881** | **4,178** | **8,960** | 739 |

### 稳态（第二次运行，缓存已建立）/ Steady state (second run, cache warm)

| 配置 / Config | 新输入 | 缓存命中 |
|---|---|---|
| 基线 / Baseline | 497 | 38,144 |
| **Neko Lite + Economy** | 386 | **12,800**（-66%） |

### 结论 / Findings

1. 传统长 persona 猫娘**更费** token（+5% 新输入）——persona 是 per-request 重复成本
2. 极短 persona 本身 ≈ 基线——它的价值是让模型输出正常文本，把猫娘风味让给本地渲染
3. **工具 schema 裁剪才是省 token 引擎**——`ctx.tools.restrict()` 在 agent 作用域裁剪，模型看到的与可执行的保持一致

## 质量对比测试 / Quality comparison

同一批任务在基线和 Neko Lite + Economy 上各跑一遍（真实 API，2026-08-14）：

Same task battery on baseline vs Neko Lite + Economy (real API):

| 任务 / Task | 工具状态 | 基线质量 | Lite 质量 | 基线 token（新输入/缓存） | Lite token（新输入/缓存） |
|---|---|---|---|---|---|
| 编码（斐波那契）/ Coding | 保留 | ✅ 正确 | ✅ 正确（+边界处理） | 309 / 37,760 | 725 / 22,016 |
| Web 搜索（GitHub stars）/ Web | **被裁** | ✅ 新闻数据 | ✅ 实时 API（curl 绕过） | 2,476 / 65,408 | 1,403 / 17,024 |
| 文件搜索 / File search | 保留 | ✅ 215 个 | ✅ 215 个 | 7,066 / 40,832 | 3,490 / 22,912 |
| 纯问答（KV cache）/ Q&A | 无工具 | ✅ 详细 | ✅ 简洁 | 192 / 12,288 | 149 / 3,840 |
| Subagent 并行 / Subagent | **被裁** | ⚠️ 派发但输出截断 | ✅ 直接回答（诚实说明） | 18,702 / 61,312 | 189 / 3,840 |

### 质量结论 / Quality findings

1. **质量无退化**：4/5 任务持平或更好；模型自适应能力强（web 任务用 `curl` 绕过缺失的 web 工具，subagent 任务直接回答）
2. **真正的退化边界**：需要专用工具的任务（subagent 并行、skill 调用）——模型会改变策略，无法完成"必须用工具"的任务
3. **Token 全面下降**：缓存命中在所有任务中 -40% ~ -94%
4. **启示**：固定最小编码集适合编码任务，不适合研究/委派任务——按任务类型切换工具档位（Neko Coding / Neko Normal）是下一步方向

## 渐进式披露解决 Subagent 问题 / Progressive disclosure

`catgirl-economy` 注册一个极小的 `enable_tool` 工具（~80 token），模型需要被裁的工具时按需解锁：

`catgirl-economy` registers a tiny `enable_tool` tool (~80 tokens); the model unlocks trimmed tools on demand:

```text
模型：enable_tool("subagent") → 工具已解锁
模型：subagent × 2（并行委派）→ 子代理完成 → 汇总
```

实测（真实 API）：模型识别到 subagent 缺失 → 调用 `enable_tool` → 并行派发两个子代理 → 同步等待 → 正确汇总。**能力完整恢复**，而父 agent 的每请求工具 schema 在解锁前保持最小（省 ~2,000 token/请求）。委派本身的成本（子代理的工作量）是固有的，与插件无关。

Measured (real API): the model recognized the missing tool, called `enable_tool`, delegated to two parallel subagents, waited synchronously, and summarized correctly. **Capability fully restored**, while the parent's per-request tool schemas stay minimal until escalation (~2,000 tokens/request saved). The delegation cost itself (the child's work) is inherent and plugin-independent.

## 安装 / Install

```sh
dsh plugin --profile demo add ./catgirl-plugin
```

或从 GitHub：`dsh plugin --profile demo add github:you/dsh-catgirl-plugin`（需要 `prepare` 构建脚本，见 [publish 指南](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/user/develop/basic/publish.md)）。

## 配置 / Config

```yaml
- insert:
    - id: catgirl-lite
      name: dsh-catgirl-plugin/catgirl-lite
      config:
        persona: 'Be concise, friendly, and natural.'
    - id: neko-renderer
      name: dsh-catgirl-plugin/neko-renderer
    - id: catgirl-economy
      name: dsh-catgirl-plugin/catgirl-economy
      config:
        allow: [bash, read, write, edit, glob, grep, str_replace_editor, todo_write]
```

传统长 persona 版（不推荐，仅对比）：

```yaml
- insert:
    - id: catgirl
      name: dsh-catgirl-plugin
      config:
        name: 喵酱
        intensity: 2
        enableNyaTool: true
```

## 效果示例 / Example

> 用户：帮我写个排序算法
> 模型（正常输出）：已写入 `/tmp/qs.py`：原地分区版快速排序，6 组测试全部 PASS。
> 渲染后：已写入 `/tmp/qs.py`：原地分区版快速排序，6 组测试全部 PASS。**喵~ (｡･ω･｡)**

## 开发 / Development

```sh
npm install
node smoke-test.mjs          # mock ctx 冒烟测试
node composition-test.mjs    # 真实 Loader 组合测试（需 deepseek-harness 仓库已构建）
node client/decorate-test.mjs  # 喵化逻辑单元测试
```

`overlays/` 下的测试 overlay 含绝对路径，使用前请替换为你的 checkout 路径。

### 构建客户端插件 / Building the client plugin

npm registry 的 rc 包依赖链损坏（`dsh-compact` 未发布），需要从 harness checkout 链接依赖：

The npm registry rc chain is broken (`dsh-compact` unpublished); link deps from a harness checkout:

```sh
cd client
npm install react tsdown typescript @types/react@18.3.31 --no-audit --no-fund
mkdir -p node_modules/@deepseek-ai
ln -s <harness>/packages/attachment/attachment node_modules/@deepseek-ai/dsh-attachment
ln -s <harness>/packages/client/runtime node_modules/@deepseek-ai/dsh-client-runtime
ln -s <harness>/packages/client/ui-attachment node_modules/@deepseek-ai/dsh-client-ui-attachment
ln -s <harness>/packages/client/ui-conversation node_modules/@deepseek-ai/dsh-client-ui-conversation
ln -s <harness>/packages/client/ui-primitives node_modules/@deepseek-ai/dsh-client-ui-primitives
ln -s <harness>/packages/client/ui-slots node_modules/@deepseek-ai/dsh-client-ui-slots
ln -s <harness>/vendor/cordis node_modules/@deepseek-ai/cordis
npx tsc --noEmit && npx tsdown
npx tsc src/index.ts --outDir lib --module esnext --target es2022 --moduleResolution bundler --skipLibCheck
```

## RoadMap（V2）

- **工具档位切换（Neko Coding / Neko Normal / Neko Chat）**：按任务类型自动选择工具集——编码任务用最小编码集，研究/委派任务保留 web/subagent。质量测试显示固定档位是当前主要权衡点
- **Reasoning Router**：社交/琐碎对话关 reasoning，复杂任务开 high/max。潜在收益最大，但错误路由一次复杂任务的质量损失比省 token 严重，放 V2 后期
- **纯聊天档**：只留 2-3 个工具（bash + read），聊天场景极致省 token
- **自适应工具披露**：`enable_tool` 目前是模型主动调用；未来可按任务类型预判解锁
- **Web UI 状态机**：agent 生命周期 → 猫娘状态（工作中/搜索/敲代码/炸毛），基于 `session/event` 渲染，0 LLM token
- **npm 发布**：`dsh-catgirl-plugin` + `dsh-catgirl-plugin-client` 已就绪，待 `npm adduser` 后发布

## 已知限制 / Known Limitations

- **Web UI 渲染已支持**：`client/` 客户端插件 shadow 默认 assistant 渲染器（priority -1），喵化显示文本；会话日志保持原文。若组件崩溃会自动 abdicate 回退默认渲染
- **工具裁剪是固定档位 + 按需解锁**：初始为"最小编码集"，`enable_tool` 按需解锁；纯聊天档（2-3 个工具）和自适应档（Reasoning Router）是未来工作
- **headless 一次性进程不等待后台 subagent**：`run_in_background: true` 的子代理会在父进程退出时被终止（headless 应用限制，Web UI 无此问题）；同步模式（`run_in_background: false`）完整可用
- **npm registry 的 rc 包依赖链损坏**：`@deepseek-ai/dsh-client-runtime` 依赖未发布的 `@deepseek-ai/dsh-compact`，`npm install` 客户端包会 404；构建时用 repo 的 node_modules 链接（见 `client/` 构建说明）

- **Web UI rendering supported**: the `client/` plugin shadows the default assistant renderer (priority -1) and decorates display text; the session log stays raw. A component crash abdicates back to the default renderer
- **Tool trimming is a fixed profile + on-demand unlock**: starts at the minimal coding set; `enable_tool` unlocks on demand; a chat-only tier and adaptive tier (reasoning routing) are future work
- **Headless one-shot does not wait for background subagents**: `run_in_background: true` children are killed on parent exit (headless app limitation, not the plugin; sync mode works)
- **npm registry rc packages have a broken dep chain**: `@deepseek-ai/dsh-client-runtime` depends on unpublished `@deepseek-ai/dsh-compact`; building the client package requires linking from a harness checkout (see `client/` build notes)
- **`nya` 工具输出随机**（`Math.random()`），不适合快照测试
- **人设文案为中文单语**：`INTENSITY_TEXT` 在 `index.js` 中，可自行修改或通过 `traits` 扩展

- **Renderer is headless-only**: `neko-renderer` decorates the headless display layer; Web UI rendering needs a client plugin (future work)
- **Tool trimming is a fixed profile**: a chat-only tier (2-3 tools) and adaptive tier (reasoning routing) are future work
- **`nya` tool output is random** (`Math.random()`), unsuitable for snapshot tests
- **Persona text is Chinese-only**: edit `INTENSITY_TEXT` in `index.js` or extend via `traits`
