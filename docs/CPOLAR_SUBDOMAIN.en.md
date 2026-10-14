# cpolar reserved subdomain

[中文指南](CPOLAR_SUBDOMAIN.md)

cpolar assigns a **random temporary address** on every start. After reserving a subdomain (a paid cpolar feature) the address can stay fixed, so a browser bookmark or an address saved by the App keeps working across DSH and cpolar restarts.

| | Temporary address (default) | Reserved subdomain |
| --- | --- | --- |
| Account | Any cpolar account | Basic plan or above |
| Address | Random on every start | The fixed name you reserved |
| After a restart | Address changes; re-enter or re-pair | Address unchanged |

Either way the tunnel fronts the DSH Mobile authenticated gateway: the public address exposes only that gateway, and DSH itself still requires a paired device credential.

## Prerequisites

1. A cpolar account whose plan allows reserving a secondary subdomain (cpolar documents this as Basic plan or above).
2. In the [cpolar dashboard](https://dashboard.cpolar.com) open **Reserved → Reserve a secondary subdomain**, reserve a name, and note the **region** selected on that page.
3. The cpolar component is installed and the Authtoken is saved (**Mobile access → Remote → cpolar**).

The region offered while reserving maps to the configuration value as follows:

| Region selected while reserving | `cpolarRegion` | Address looks like |
| --- | --- | --- |
| China VIP | `cn_vip` | `<name>.vip.cpolar.cn` |
| China Top | `cn_top` | `<name>.top.cpolar.cn` |
| Default route (United States) | `us` | `<name>.cpolar.cn` |

The region must match the one chosen while reserving, otherwise cpolar will not hand out the hostname you reserved.

## Configuration

> **This step edits the DSH profile configuration file; the panel has no field for it.** A reserved subdomain is a low-frequency setting and is currently provided only through the loader configuration.

Add both keys to the `mobile-access` entry in the `cordis.patch.yml` of the profile you use (see your DSH profile directory, for example `$DSH_HOME/profiles/<profile>/cordis.patch.yml`):

```yaml
- id: mobile-access
  name: dsh-mobile
  config:
    cpolarSubdomain: your-reserved-name
    cpolarRegion: cn_vip
```

- `cpolarSubdomain`: the name reserved in the cpolar dashboard, **the name only** (not the full domain). Leave it empty or omit it to keep the random temporary address.
- `cpolarRegion`: the region chosen while reserving (see the table above). Omit it to let cpolar choose a route.

**Quit DSH completely and reopen it**, then reconnect under **Mobile access → Remote → cpolar**.

## Verify

After the restart the public address should be the hostname you reserved. Confirm it with:

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://your-reserved-name.vip.cpolar.cn
```

A `401` (or a `301` redirect to HTTPS) means the request reached the DSH Mobile gateway — **that is the expected result, not an error**: `401` means the entry point requires device pairing.

In the Android App choose the **Remote** entry point. After switching to a fixed address, **a phone that already paired treats that address as a new Origin** and must pair once more through **Generate remote pairing QR code** on the panel; the address is fixed afterwards, so this does not repeat.

## The name is rejected, or the address did not change

| Symptom | Cause and fix |
| --- | --- |
| The address is still random | The name did not take effect. Check that `cpolarSubdomain` sits under the `mobile-access` entry and that DSH was fully restarted. |
| The plugin reports `cpolar subdomain is invalid` | The name is not a valid DNS label: it must start with a letter or digit, contain only letters, digits, `.`, `_`, `-`, and stay within 63 characters. |
| cpolar still returns a random address | The name is not reserved by this account, or `cpolarRegion` does not match the region chosen while reserving. Recheck both in the dashboard. |
| The domain suffix changed after switching regions | Expected: `cn_vip` → `.vip.cpolar.cn`, `cn_top` → `.top.cpolar.cn`. |

A reserved name is a **request sent to cpolar**, not a local rewrite: the tunnel still uses only the public address cpolar reports and this plugin validates. A rejected reservation therefore cannot point the tunnel at an unvalidated host.

## Security boundaries

- These settings only affect the `-subdomain` and `-region` arguments passed to `cpolar http`; pairing, TLS and device authorization are unchanged.
- No credential is written: the Authtoken keeps living only in the plugin private directory as before.
- The reserved name appears in the public address and is public information; do not post the Authtoken alongside it in issues, screenshots or logs.
