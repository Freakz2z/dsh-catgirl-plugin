<p align="center">
  <img src="./assets/readme/hero.jpg" width="100%" alt="dsh-catgirl-plugin — token-efficient catgirl persona for DeepSeek Harness: -67% new input on the first request, -66% cache reads in steady state, catgirl flavor rendered locally at zero LLM token cost">
</p>

# dsh-catgirl-plugin

**Neko — a token-efficient persona runtime for DeepSeek Harness.**

把人格留在界面，把智能留给模型。Keep personality in the interface, intelligence in the model.

<p align="center">
  <img src="./assets/logo.png" width="160" alt="Neko logo — a pixel-art blue-haired catgirl maid">
</p>

## 效果示例 / Example

> 用户：帮我写个排序算法
>
> 模型（正常输出）：已写入 `/tmp/qs.py`：原地分区版快速排序，6 组测试全部 PASS。
>
> **你看到的**：已写入 `/tmp/qs.py`：原地分区版快速排序，6 组测试全部 PASS。**喵~ (｡･ω･｡)**

## 核心思想 / Core idea

传统做法让 LLM 自己"演猫娘"：几百 token 的长 persona 注入 system prompt，每个请求重复付费，模型输出还变啰嗦。

The traditional approach makes the LLM "act catgirl": a few hundred tokens of persona paid again on every request.

本插件反其道而行——**Persona Virtualization**：

This plugin does the opposite — **persona virtualization**:

<p align="center">
  <img src="./assets/readme/mechanism.svg" width="100%" alt="Persona virtualization: the model answers normally with a 6-token persona, the session log stores raw text, and a local render layer adds the catgirl flavor at zero LLM token cost">
</p>

- **会话日志保存原文**，模型上下文零污染
- **猫娘风味 0 LLM Token**，全部本地渲染
- **工具 schema 裁剪**：25 → 8 个，省下每请求数千 token

## 实测数据 / Measured results

真实 DeepSeek API，同一任务（写快速排序 + 保存 + 运行验证，4 步 agent 任务），2026-08-14。

Real DeepSeek API, same 4-step coding task.

### 冷启动 / Cold start

| 配置 | 首个请求新输入 | 全程新输入 | 全程缓存命中 | 输出 |
|---|---|---|---|---|
| 基线（无插件） | 12,372 | 12,520 | 25,856 | 838 |
| 传统猫娘 | 12,576 | 13,156 | 26,240 | 860 |
| **Neko Lite + Economy** | **3,881** | **4,178** | **8,960** | 739 |

### 稳态 / Steady state

| 配置 | 新输入 | 缓存命中 |
|---|---|---|
| 基线 | 497 | 38,144 |
| **Neko Lite + Economy** | 386 | **12,800**（-66%） |

**结论 / Findings**

1. 传统长 persona 猫娘**更费** token（+5%）——persona 是 per-request 重复成本
2. 极短 persona ≈ 基线——它的价值是让模型输出正常文本，把猫娘风味让给本地渲染
3. **工具 schema 裁剪才是省 token 引擎**——`ctx.tools.restrict()` 在 agent 作用域裁剪，模型看到的与可执行的保持一致

## 质量对比 / Quality comparison

5 类任务 × 基线 vs Neko（真实 API）：**质量无退化**，模型自适应（web 任务用 `curl` 绕过、subagent 任务直接回答）。

5-task battery, baseline vs Neko (real API): no quality degradation; the model adapts to missing tools.

| 任务 | 工具状态 | 基线质量 | Neko 质量 | 基线 token（新输入/缓存） | Neko token |
|---|---|---|---|---|---|
| 编码 | 保留 | ✅ | ✅（+边界处理） | 309 / 37,760 | 725 / 22,016 |
| Web 搜索 | **被裁** | ✅ 新闻数据 | ✅ 实时 API（curl） | 2,476 / 65,408 | 1,403 / 17,024 |
| 文件搜索 | 保留 | ✅ 215 个 | ✅ 215 个 | 7,066 / 40,832 | 3,490 / 22,912 |
| 纯问答 | 无工具 | ✅ 详细 | ✅ 简洁 | 192 / 12,288 | 149 / 3,840 |
| Subagent | **被裁** | ⚠️ 输出截断 | ✅ 直接回答 | 18,702 / 61,312 | 189 / 3,840 |

**退化边界 / The real boundary**：需要专用工具的任务（subagent 并行、skill 调用）——模型会改变策略。`enable_tool` 渐进式披露解决这个问题：

Tasks that require a specialized tool change strategy. Progressive disclosure solves this:

```text
模型：enable_tool("subagent") → 工具已解锁
模型：subagent × 2（并行委派）→ 子代理完成 → 汇总
```

实测：模型识别到 subagent 缺失 → 调用 `enable_tool` → 并行派发两个子代理 → 正确汇总。**能力完整恢复**，父 agent 的工具 schema 在解锁前保持最小（省 ~2,000 token/请求）。

Measured end-to-end: the model recognized the missing tool, called `enable_tool`, delegated to two parallel subagents, and summarized correctly. Capability fully restored; the parent's tool schemas stay minimal until escalation.

## 安装 / Install

```sh
dsh plugin --profile demo add ./catgirl-plugin
```

或从 GitHub：`dsh plugin --profile demo add github:you/dsh-catgirl-plugin`（需 `prepare` 构建脚本，见 [publish 指南](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/user/develop/basic/publish.md)）。

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

Web UI 渲染（可选）：安装 `dsh-catgirl-plugin-client` 并加入 profile patch：

```yaml
- insert:
    - id: neko-renderer-client
      name: dsh-catgirl-plugin-client
```

## 插件家族 / Plugin family

| 插件 | 作用 | Token 影响 |
|---|---|---|
| `catgirl-lite.js` | 极短 persona（6 token） | 每请求 +6 |
| `neko-renderer.js` | headless 显示层喵化 | 0 |
| `catgirl-economy.js` | 工具裁剪 + `enable_tool` 按需解锁 | **每请求 -8,491（-69%）** |
| `client/` | Web UI 渲染（shadow assistant 渲染器） | 0 |
| `index.js` | 传统长 persona（对比用） | 每请求 +数百 |
| `usage-meter.js` | 开发工具：usage 记录 | 0 |

## RoadMap（V2）

- **工具档位切换**（Neko Coding / Normal / Chat）：按任务类型自动选工具集
- **Reasoning Router**：社交对话关 reasoning，复杂任务开 high/max（收益最大，风险也最大）
- **纯聊天档**：只留 2-3 个工具
- **自适应工具披露**：按任务类型预判解锁
- **Web UI 状态机**：agent 生命周期 → 猫娘状态，0 LLM token

## 已知限制 / Known Limitations

- **headless 一次性进程不等待后台 subagent**：`run_in_background: true` 的子代理在父进程退出时被终止（headless 应用限制，Web UI 无此问题）；同步模式完整可用
- **npm registry 的 rc 包依赖链损坏**：`dsh-client-runtime` 依赖未发布的 `dsh-compact`，构建客户端包需从 harness checkout 链接依赖（见 [开发](#开发--development)）
- **`nya` 工具输出随机**（`Math.random()`），不适合快照测试
- **人设文案为中文单语**：`INTENSITY_TEXT` 在 `index.js`，可自行修改或通过 `traits` 扩展

## 开发 / Development

```sh
npm install
node smoke-test.mjs            # mock ctx 冒烟测试
node composition-test.mjs      # 真实 Loader 组合测试（需 deepseek-harness 已构建）
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

## License

[MIT](LICENSE)
