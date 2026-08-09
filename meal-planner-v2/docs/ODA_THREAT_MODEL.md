# Oda local companion threat model

Reviewed: 7 August 2026

## Scope and security objective

This model covers the browser app, the loopback companion, a future provider adapter, its MCP
subprocess, and Oda. Prompt 1 implements only the browser-independent fake-provider foundation.

The objective is to preserve the confidentiality of Oda credentials and household data, prevent
unapproved cart changes, and ensure external failures cannot damage or block the local meal planner.
Checkout, payment, delivery slots, and final order placement are permanently outside this boundary.

## Assets

- Oda cookies or credentials owned by an upstream local process;
- the companion bearer token;
- current cart contents and future order history;
- household ingredient mappings and future Home Stock data;
- immutable cart previews, confirmations, and idempotency keys; and
- the integrity and availability of existing recipes, plans, and shopping lists.

The app must not collect payment data, delivery addresses, or Oda passwords.

## Trust boundaries

```text
React app -> loopback HTTP companion -> allowlisted provider adapter -> MCP subprocess -> Oda
     |                 |
     |                 +-> future IntegrationRepository (non-secret household data only)
     +-> existing local MealPlannerRepository (unchanged)
```

Every arrow is a validation boundary. MCP output is untrusted external input even when the process
runs locally.

## Threats and controls

| Threat | Impact | Prompt 1 control | Later release gate |
| --- | --- | --- | --- |
| LAN exposure from wildcard binding | Other devices invoke the companion | Bind explicitly to `127.0.0.1` | Packaging test verifies no alternate bind address |
| Malicious website calls loopback service | Household data disclosure or cart writes | Exact origin allowlist plus bearer token; no wildcard CORS | Desktop bootstrap passes the token without URL/query leakage |
| Token theft from permissive file mode | Unauthorized local calls | Random 256-bit token, private directory, `0600` file | Native packaging uses OS credential storage where practical |
| Secret enters React, browser storage, URL, or logs | Oda account compromise | No credential fields or live adapter; token is never logged | Log-redaction tests cover adapter failures |
| Arbitrary MCP invocation | Access to unexpected or destructive tools | No generic proxy; allowlisted `GroceryProvider` methods only | Each new operation has an explicit route and schema |
| Schema drift or malicious response | Wrong products, crash, or unsafe quantity | Strict Zod DTOs and fixture contract tests | Live smoke test fails closed on unknown shapes |
| CSRF-like cart mutation | Unapproved cart changes | No mutation interface or route in Prompt 1 | Fresh preview, explicit confirmation, idempotency key |
| Retry after ambiguous write | Duplicate cart items | No writes yet | Read/reconcile; never automatically retry |
| Clear/replace cart or checkout | Destructive/unintended purchase workflow | Such operations are outside provider contract | Tests assert routes do not exist |
| Stale preview | Product, price, or cart changed before apply | No writes yet | Fingerprint and expiry; confirm against fresh preview |
| Incorrect product variant/allergen | Unsafe substitution | Deterministic fake data; no cart path | Qualifier constraints and mandatory review |
| Imported order duplicated | Inflated Home Stock | Order import unsupported | Provider order ID uniqueness and idempotent movements |
| Purchase assumed still present | Incorrect stock deduction | Home Stock not in Prompt 1 | Purchases are proposed additions; movements reversible |
| Companion or Oda outage | Planner becomes unusable | Separate process/repository boundary; flags default off | Integration errors never block core app |
| Vulnerable upstream dependency | Local compromise or data exposure | MCP not installed in app; revision/audit findings recorded | Dependency review is required before live enablement |
| Sensitive fixture data committed | Household privacy leak | Prompt 1 fixtures are synthetic | Live fixtures are anonymised before commit |

## Security invariants

1. The companion never listens on `0.0.0.0`, `::`, a LAN address, or a hostname that can resolve
   away from loopback.
2. Data-bearing routes require the per-install bearer token. Browser calls additionally require an
   exact allowed origin.
3. No route accepts a tool name, command, URL, or arbitrary upstream method from the caller.
4. External values are schema-validated before they become domain objects.
5. Live features are absent or hidden unless both their flag and detected capability are true.
6. No integration failure mutates or replaces the core `AppState` document.
7. Cart changes are impossible until a later release implements a separate confirmation-aware write
   contract and passes its test gate.
8. An unknown cart-write outcome is reconciled by reading the cart, never by automatic retry.

## Residual risks

A bearer token cannot protect against a fully compromised user account, browser, or machine. Exact
origin checks do not authenticate native/CLI callers that omit `Origin`; the bearer token remains
mandatory for them. A community MCP may stop working when Oda changes private interfaces and may
have supply-chain vulnerabilities. These risks are accepted only for an opt-in local pilot and are
re-evaluated before enabling a live provider.

## Prompt 1 verification

- tests assert a valid token and allowed origin can access only the health endpoint;
- tests reject missing tokens and disallowed origins;
- tests assert no arbitrary MCP route exists;
- tests verify token reuse and private file mode;
- DTO fixtures cover accepted product/cart shapes and malformed values; and
- all live and mutation flags default to false.

See [ODA_CAPABILITY_REPORT.md](./ODA_CAPABILITY_REPORT.md) for the current live-provider NO-GO
decision.
