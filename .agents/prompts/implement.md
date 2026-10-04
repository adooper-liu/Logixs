先读 `.agents/skills/logix-same-slice/SKILL.md`。

在其他内容之前写出：

1. 这一片只做的一个业务步骤。
2. `writeScopes`。
3. 界面与服务端允许动作是否在同一片。

技术控制先过三问，并点名当前消费者。兄弟模块只从公开入口引用，不进入对方的 `domain/`、`application/`、`infrastructure/`、`presentation/`、`security/` 或 `engines/`。`kind` 为 `base` 的模块不 import、也不 `depends` `incremental`。`operational` 与 `WB-B10` 按 `08-role-workbenches.md` §3.1 分开，不在本提示里重写定义。
