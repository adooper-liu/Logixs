# 云当网认证、限流与安全

> 状态：**外部供应商接入约束（参考，待签约联调复核）** · 2026-09-18

## 1. 认证模型

云当网不使用 `Authorization: Bearer` 头，而是**签名换 token + token 走 Query 参数**两步。

### 1.1 第一步：签名

对每个企业编码（`companyCode`）分配一个密钥 `secret`（**需联系客服取得**）。签名算法为 **HmacSHA256 + Base64**：

```text
signPayload = companyCode + "\n" + timestamp + "\n" + nonce
sign        = Base64( HmacSHA256(signPayload, secret) )
```

- `timestamp`：**毫秒级**时间戳。
- `nonce`：随机串，官方示例为 UUID v4 去掉连字符。
- 三行以 `\n` 连接，顺序固定为 `code` → `timestamp` → `nonce`。

文档给出的 Java 参考实现（doc 9321040）确认了上述结构：

```java
String signPayload = code + "\n" + timestamp + "\n" + nonce;
Mac mac = Mac.getInstance("HmacSHA256");
mac.init(new SecretKeySpec(secret.getBytes(UTF_8), "HmacSHA256"));
return Base64.getEncoder().encodeToString(mac.doFinal(signPayload.getBytes(UTF_8)));
```

### 1.2 第二步：换取 token

```
POST /api/auth/authorization
→ { code: 200, type, message, result }   // result = 加密签名 token，≤512 字符
```

**token 有效期 2 小时**，超时须重新获取。

### 1.3 第三步：调用业务接口

拿到 token 后，**token 值与公司编码作为 Query 参数**附加到每次请求：

```
GET /api/oceanbill/oceanBill?token=<token>&companyCode=<code>&...
```

业务响应统一信封 `{ code, type, message, result }`，`code=200` 成功；`type=warning` **表示部分失败**，必须逐条读取错误码，不得整体判成功。

## 2. 限流

文档已明示的限制：

| 接口                            | 限制        |
| ------------------------------- | ----------- |
| 下载运单详情（231328435）       | 60 次/分钟  |
| 港到港船期查询 1.0（221743607） | 2 次/秒     |
| 港到港船期查询 2.0（390978577） | 2 次/秒     |
| 几乎所有订阅接口                | 单次 ≤30 条 |
| 几乎所有下载接口                | 单次 ≤30 条 |

未在文档中说明的限制（**待确认**）：订阅接口本身的调用频次、每日总量、并发上限，以及推送是否有总量节流。

## 3. 对 Logixs 的接入要求

### 3.1 出站凭据管理尚未就位

云当网要求持有一个**长期密钥**（`secret`）与一个**短周期 token**（2 小时）。而 Logixs 当前的 [identity](../../../apps/api/src/modules/identity) 模块只做**入站**认证（OIDC Bearer 校验、服务身份中间件），**没有出站调用的凭据存储与轮换机制**。对应启动清单 P5-03「定义服务身份、Worker 身份和最小数据库权限」与 P4-10「建立模型凭据、对象存储凭据和数据库凭据的秘密管理方式」，两者均未完成。

在凭据管理落地前，**不得**把 `secret` 写进代码、环境变量示例或任何迁移文件；推送接入应等 P5-03 之后再开。

### 3.2 token 缓存与并发

2 小时有效期意味着：

- token 必须**缓存并复用**，不能每次请求都换取——否则触发未知的鉴权接口限流。
- 需要**提前刷新**（建议在剩余有效期小于 10 分钟时刷新），并处理"刷新瞬间并发请求"的竞态。
- token 失效时的重试必须**幂等**，且不得因重试造成重复订阅或重复业务写入。

token 缓存是**跨进程共享状态**：API 与 business-worker 若都要调云当网，需要明确谁持有 token（建议由受控的出站网关统一持有，与 [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md) 中「其余模块经 workflow 代理 Temporal」是同一类收敛思路）。

### 3.3 推送入口的安全

云当网回调我方地址，属于**未经认证的入站请求**，与 Logixs 现有的服务身份中间件不同：

- 推送地址须**不可猜测**（含随机路径段），并在收到载荷后校验来源。
- 文档**未说明推送是否带签名头或验签协议**（待确认）。在确认前，推送载荷只能进 Inbox 做**原始留存**，不得直接产生业务事实。
- 接收端必须在返回成功前完成耐久化，返回体格式为 `{ code:200, type:"S", message, time }`。

### 3.4 日志与隐私

- `secret`、`token`、完整请求 URL（token 在 Query 里！）**不得进入日志、错误消息与追踪**。Query 传参天然容易被访问日志记录，须显式脱敏。
- `orderNo`（需货单号，≤600 字符）、派送地址、客户字段可能含 PII，按 [安全威胁模型 V1](../../architecture/SECURITY_THREAT_MODEL_V1.md) 与证据契约 §13 处理。
- 美国清关与 Bond 查询涉及进口商信息，属敏感数据。

## 4. 待供应商确认

1. `secret` 的轮换流程、是否有双密钥并行期、泄露后的吊销方式。
2. 推送请求是否带签名头；若有，验签算法与密钥是否与 `secret` 相同。
3. 鉴权接口自身的限流；token 是否支持提前失效或主动续期。
4. 订阅/下载接口的完整限流与配额（是否按合同分级）。
5. 是否存在 IP 白名单要求。
6. 出现 `code != 200` 时的重试语义：哪些错误可重试、是否有退避要求、重复调用是否幂等。
