# Family Table local companion

The companion is the process boundary for external integrations. Prompt 1 exposes only a protected
health endpoint backed by deterministic fake Oda data. It contains no live Oda adapter and no
mutation method.

## Security defaults

- Listens on `127.0.0.1:8787` only.
- Requires a 64-character bearer token stored at `~/.config/family-table/companion-token` with mode
  `0600`.
- Allows browser origins `http://127.0.0.1:5173` and `http://localhost:5173`.
- Exposes no arbitrary MCP passthrough.
- Keeps all Oda and Home Stock feature flags disabled by default.

## Commands

From `meal-planner-v2`:

```sh
npm run dev:companion
npm run test:companion
npm run build:companion
```

The browser is not connected to this service until Prompt 2.

The current live-provider decision and security boundary are documented in
[`docs/ODA_CAPABILITY_REPORT.md`](../docs/ODA_CAPABILITY_REPORT.md),
[`docs/ODA_THREAT_MODEL.md`](../docs/ODA_THREAT_MODEL.md), and
[`docs/adr/0001-local-companion-boundary.md`](../docs/adr/0001-local-companion-boundary.md).
