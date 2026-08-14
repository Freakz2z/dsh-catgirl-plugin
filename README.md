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
| `neko-renderer.js` | 显示层本地渲染：句尾「喵~」+ 颜文字，代码块原样保留 | 0 |
| `catgirl-economy.js` | 工具裁剪：25 个工具 → 8 个（bash/read/write/edit/glob/grep/str_replace_editor/todo_write） | **每请求 -8,491 token（-69%）** |
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
```

`overlays/` 下的测试 overlay 含绝对路径，使用前请替换为你的 checkout 路径。

## 已知限制 / Known Limitations

- **渲染层仅支持 headless**：`neko-renderer` 通过替换 headless 显示层实现；Web UI 的渲染需要客户端插件（`session/event` 渲染，未来工作）
- **工具裁剪是固定档位**：当前是"最小编码集"；纯聊天档（2-3 个工具）和自适应档（Reasoning Router）是未来工作
- **`nya` 工具输出随机**（`Math.random()`），不适合快照测试
- **人设文案为中文单语**：`INTENSITY_TEXT` 在 `index.js` 中，可自行修改或通过 `traits` 扩展

- **Renderer is headless-only**: `neko-renderer` decorates the headless display layer; Web UI rendering needs a client plugin (future work)
- **Tool trimming is a fixed profile**: a chat-only tier (2-3 tools) and adaptive tier (reasoning routing) are future work
- **`nya` tool output is random** (`Math.random()`), unsuitable for snapshot tests
- **Persona text is Chinese-only**: edit `INTENSITY_TEXT` in `index.js` or extend via `traits`
