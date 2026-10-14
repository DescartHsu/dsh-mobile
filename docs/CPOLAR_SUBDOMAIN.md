# cpolar 固定子域名

[English guide](CPOLAR_SUBDOMAIN.en.md)

cpolar 默认给每次启动分配一个**随机临时地址**。保留子域名（cpolar 付费功能）后，地址可以固定下来，浏览器书签、App 里保存的电脑地址在 DSH 或 cpolar 重启后继续有效。

| | 临时地址（默认） | 保留子域名 |
| --- | --- | --- |
| 账号 | 任意 cpolar 账号 | 需基础套餐或以上 |
| 地址 | 每次启动随机分配 | 你自己保留的固定名字 |
| 重启后 | 地址变化，需重新输入或重新配对 | 地址不变 |

无论哪种地址，隧道背后都是 DSH Mobile 自己的认证网关：公开地址只暴露该网关，DSH 本体仍需要配对设备凭据。

## 前置条件

1. 一个 cpolar 账号，且套餐支持保留二级子域名（cpolar 官方说明：基础套餐或以上）。
2. 在 [cpolar 控制台](https://dashboard.cpolar.com) → **预留 → 保留二级子域名** 里保留一个名字，并记下该页面选择的**地区**。
3. 面板里 cpolar 组件已安装，Authtoken 已保存（**移动访问 → 远程 → cpolar**）。

保留页面可选择的地区与配置值对应关系：

| 保留时选择的地区 | `cpolarRegion` | 地址形如 |
| --- | --- | --- |
| China VIP | `cn_vip` | `<名字>.vip.cpolar.cn` |
| China Top | `cn_top` | `<名字>.top.cpolar.cn` |
| 默认线路（美国） | `us` | `<名字>.cpolar.cn` |

地区必须与保留时选择的一致，否则 cpolar 不会给出你保留的主机名。

## 配置

> **这一步需要编辑 DSH profile 的配置文件，面板里没有对应输入框。** 保留子域名是低频设置，目前只通过加载器配置提供。

在所用 profile 的 `cordis.patch.yml` 里给 `mobile-access` 条目补上两个键（路径见 DSH profile 目录，例如 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`）：

```yaml
- id: mobile-access
  name: dsh-mobile
  config:
    cpolarSubdomain: your-reserved-name
    cpolarRegion: cn_vip
```

- `cpolarSubdomain`：在 cpolar 控制台保留的那个名字，**只填名字本身**（不是完整域名）。留空或省略则保持随机临时地址。
- `cpolarRegion`：与保留时选择的地区一致（见上表）。省略时由 cpolar 选择线路。

改完**完整退出并重新打开 DSH**，再在 **移动访问 → 远程 → cpolar** 里重新连接。

## 校验

重启后公网地址应当是你保留的主机名。可这样确认：

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://your-reserved-name.vip.cpolar.cn
```

返回 `401`（或 `301` 跳向 HTTPS）表示请求已经到达 DSH Mobile 网关——**这是正常结果，不是错误**：`401` 表示该入口需要设备配对。

Android App 里请选择 **远程访问** 入口。切换到固定地址后，**已配对的手机会把该地址视为新 Origin**，需要按面板的 **生成远程配对二维码** 重新配对一次；之后地址固定，不再需要重复配对。

## 名字被拒绝或地址没变

| 现象 | 原因与处理 |
| --- | --- |
| 地址仍是随机值 | 名字未生效。确认 `cpolarSubdomain` 写在了 `mobile-access` 条目下，并已完整重启 DSH。 |
| 插件报 `cpolar subdomain is invalid` | 名字不符合 DNS 标签格式：需以字母或数字开头，只含字母、数字、`.`、`_`、`-`，且不超过 63 字符。 |
| cpolar 启动后仍给随机地址 | 该名字未被本账号保留，或 `cpolarRegion` 与保留地区不一致。回到控制台核对这两项。 |
| 换了地区后域名后缀变了 | 属于预期：`cn_vip` → `.vip.cpolar.cn`，`cn_top` → `.top.cpolar.cn`。 |

保留名字是**向 cpolar 发出的请求**，不是本地改写：隧道仍然只使用 cpolar 报告并校验通过的公网地址，因此一次被拒绝的保留不会把隧道指向未经校验的主机。

## 安全边界

- 本配置只影响传给 `cpolar http` 的 `-subdomain` 与 `-region` 参数，不改变配对、TLS 或设备授权逻辑。
- 不写入任何凭据：Authtoken 仍按原有方式只保存在插件私有目录。
- 保留名字会出现在公网地址中，属于公开信息；请勿把 Authtoken 与它一起发到 issue、截图或日志里。
