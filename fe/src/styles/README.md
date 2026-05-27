# Dash UI Class Names

Dash 的 TSX 页面采用两类 class，它们承担不同职责：

- `dash-*` 语义类名用于定位元素职责，例如 `dash-welcome-title`。
- Tailwind 工具类用于描述视觉表现，例如 `text-6xl`、`text-white`。

## Naming Rules

1. 项目直接创建且会参与布局、展示或交互的 HTML 元素，都应包含一个稳定的 `dash-*` 类名。
2. 类名使用 `dash-区域-元素[-细分]` 形式，表达业务职责，不表达颜色或尺寸。
3. 组件根元素使用组件职责命名，例如未来的 `repository-nav.tsx` 根节点应为 `dash-repository-nav`。
4. 状态采用独立类名或 `data-*` 标识，例如 `is-selected`、`has-conflict`，不要将状态塞进固定元素名称。
5. Tailwind 工具类可以随视觉设计迭代；`dash-*` 语义类名应尽量稳定，便于调试、测试和后续维护。

## Current Example

```tsx
<p class="dash-welcome-status mb-6 text-xl text-slate-200">
  语义类名规则已建立
</p>
```

其中 `dash-welcome-status` 表示该元素在欢迎区域中负责展示当前状态；后续即使文本颜色或间距改变，这个职责名称也无需改变。
