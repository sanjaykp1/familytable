# Oda MCP capability report

Verified: 7 August 2026

## Decision

**NO-GO for a live Oda provider. GO for the fake-provider foundation only.**

The reviewed community MCP installs and builds, but its current anonymous product-search contract
fails against Oda and it exposes no order-history tools. The Release 0 gate requires both product
search and read-only cart access to succeed. No credentials were requested, no authenticated cart
read was attempted, and no Oda mutation was called.

Family Table must keep every live Oda feature flag off. Work may continue against
`FakeGroceryProvider`, but Release 2 live product matching cannot begin until the read-only gate is
repeated successfully.

## Artifact inspected

| Item | Result |
| --- | --- |
| Repository | [`gbbirkisson/mcp-oda`](https://github.com/gbbirkisson/mcp-oda) |
| Ownership | Community project; not treated as an Oda-supported contract |
| Pinned revision | `05a1af25d9d0b60d45004652df50f54a1b5edfce` |
| Package | `mcp-oda` `0.4.5` |
| Install/build | `npm ci` and TypeScript build succeeded |
| Dependency audit | `npm audit` reported 15 findings: 1 low, 2 moderate, 12 high |
| Authentication | CLI accepts username/password and stores a cookie file; not exercised |
| Transport | MCP over stdio |

The upstream revision is recorded for reproducibility, not vendored or installed as a production
dependency. Before any future live adapter is added, re-audit the pinned dependency graph and decide
whether the remaining findings are acceptable or can be removed.

## Exposed tool inventory

The inventory below comes from the pinned source. Family Table has not exposed these tools through
its companion.

| Tool | Classification | Input | Prompt 1 disposition |
| --- | --- | --- | --- |
| `check_login` | Read | none | Not called; credentials were not requested |
| `cart_get_contents` | Read | none | Not called; requires authenticated setup |
| `products_search` | Read | `query: string`, optional `page: number` | Underlying anonymous search failed |
| `recipes_search` | Read | optional query, page and filter IDs | Upstream tests passed |
| `recipes_get_details` | Read | `id: number` | Upstream test failed for returned recipe |
| `cart_clear` | Destructive write | none | Forbidden and not called |
| `cart_remove_item` | Write | product ID, optional count | Forbidden and not called |
| `product_add_to_cart` | Write | product ID, optional count | Forbidden and not called |
| `recipe_add_to_cart` | Write | recipe ID and portions | Forbidden and not called |
| `recipe_remove_from_cart` | Write | recipe ID | Forbidden and not called |

There is no tool for listing orders, retrieving an order, determining delivered/completed state, or
importing historical purchases. The proposed completed-order-to-Home-Stock workflow is therefore
unsupported by this MCP revision.

## Read-only verification

The upstream test suite ran without an Oda cookie path:

- 10 tests discovered;
- 4 passed;
- 3 failed; and
- 3 authenticated cart mutation tests were skipped.

The failures were:

1. product search for `melk` returned no items;
2. product pagination for `brød` returned no items; and
3. recipe-detail loading failed for a recipe returned by search.

Anonymous recipe search/filter tests and a raw page fetch passed. This is not sufficient for Family
Table: the core product-search result is empty, recipe contracts are inconsistent, and cart reading
remains unverified.

## Release 0 gate matrix

| Gate | Required | Observed | Status |
| --- | --- | --- | --- |
| Install and pin an implementation | Yes | Installed, built, revision pinned | Pass |
| Product search returns usable products | Yes | Empty results in upstream tests | **Fail** |
| Read the current cart without mutation | Yes | Not attempted without auth | Blocked |
| Order history with delivered state | Needed for Releases 4–6 | No order tools exist | Unsupported |
| No mutation during feasibility work | Yes | No mutation called | Pass |
| Credentials stay outside the app | Yes | No credentials requested or stored | Pass |

## Conditions for reconsidering the live provider

Repeat this gate only when a supported or actively maintained interface is available. A live adapter
may proceed when all of the following are true:

1. the exact dependency revision and tool schemas are captured;
2. dependency risk has been reviewed;
3. anonymous or authenticated read-only product search returns schema-valid products;
4. authenticated `cart_get_contents` succeeds without any write;
5. credentials/cookies remain owned by the local upstream process; and
6. anonymised fixtures can be captured for contract tests.

Order import remains separately feature-detected. Its absence must hide Releases 4–6 rather than
encouraging reverse engineering of Oda's private endpoints.

## Prompt 1 output

The safe foundation is implemented in `companion/`: loopback-only HTTP, per-install bearer token,
exact origin allowlisting, strict DTO validation, an allowlisted read-only provider interface,
deterministic fake data, feature flags defaulting to off, a protected health endpoint, and contract
fixtures/tests. There is no live Oda adapter, generic MCP route, user-facing integration UI, or cart
mutation method.
