# ADR 0001: Isolate grocery integrations in a loopback companion

- Status: Accepted
- Date: 7 August 2026
- Scope: Oda and future grocery providers

## Context

Family Table is a local-first browser application. A grocery integration may need credentials,
cookies, an MCP subprocess, unstable third-party schemas, and eventually explicitly confirmed cart
writes. Putting that responsibility in React would expose secrets to browser storage and make an
external outage part of the core planner lifecycle. Exposing a generic MCP proxy would also turn a
small integration into an arbitrary local command surface.

The currently inspected Oda community MCP is not ready for live use: product-search verification
fails and order history is absent. The architecture must therefore remain useful with no live Oda
implementation.

## Decision

Run external grocery integrations in a separate TypeScript/Node companion process.

The companion:

- binds explicitly to `127.0.0.1`, never a wildcard or LAN interface;
- requires a random per-install bearer token for data-bearing routes;
- accepts browser requests only from exact configured origins;
- exposes narrow, allowlisted Family Table operations rather than MCP tool names;
- validates external input and output with strict schemas;
- uses a capability-based `GroceryProvider` boundary;
- starts with `FakeGroceryProvider`; and
- keeps all live, write, order-import, and Home Stock flags disabled by default.

The browser will later keep integration state behind a separate `IntegrationProvider` and
`IntegrationRepository`. The existing planner repository and persisted `AppState` remain unchanged.

Preflight requests from an allowlisted origin may complete without a bearer token because browsers
cannot include the authorization header in CORS preflight. Preflight returns no application data.
CLI/native clients may omit `Origin` but must still present the token.

## Rejected alternatives

### Call Oda or MCP directly from React

Rejected because credentials and upstream responses would enter the browser boundary, CORS and
extension exposure increase risk, and external failures would become coupled to the planner.

### Expose a generic MCP passthrough

Rejected because tool names and schemas can change, mutation tools could be invoked outside the
product's confirmation flow, and the surface cannot be meaningfully allowlisted.

### Add a hosted backend now

Rejected for this MVP. It would introduce accounts, remote secret storage, operations, and privacy
work before product value is proven. A hosted connector can implement the same provider contract
later.

### Block all development until live Oda works

Rejected because provider contracts, validation, security, and deterministic UI fixtures are useful
and testable independently. Live capabilities remain gated and hidden.

## Consequences

Positive consequences:

- core meal planning remains offline and unaffected by Oda;
- no Oda secret needs to enter the app bundle or browser store;
- fake and future live providers share one validated contract; and
- the live integration can be disabled without data migration.

Costs and constraints:

- local development runs a second process;
- desktop packaging will eventually need process lifecycle and token bootstrap handling;
- CORS, token file permissions, schema drift, and unknown write outcomes require dedicated tests;
  and
- a provider reporting a capability is not sufficient; the operation must also pass its release
  gate.

## Rollback

Set all integration feature flags to false and stop the companion. No planner data needs to be
migrated or reverted. Integration data introduced in later releases should be retained but ignored
until the failing boundary is fixed.
