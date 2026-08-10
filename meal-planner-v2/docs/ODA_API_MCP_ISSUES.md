# Oda API / MCP integration issues

**Prepared for:** Oda

**Assessment date:** 7 August 2026  
**Scope:** read-only compatibility assessment only. No Oda credentials were requested or used, and no cart mutation, checkout, delivery-slot, payment, or order action was attempted.

## Summary

We evaluated the publicly available community MCP implementation as a possible integration for Family Table, a local family meal-planning application. The implementation installed and built, but it is not currently suitable for a live integration. Its anonymous product search returned no products, its recipe-detail response was inconsistent, cart reading could not be verified without authentication, and it does not provide order-history access.

The project has therefore kept all live Oda functionality disabled. We can continue development against a fake provider, but need a reliable, supported read-only interface before connecting to Oda in production.

## Implementation assessed

| Item | Value |
| --- | --- |
| Project | Community-maintained [`gbbirkisson/mcp-oda`](https://github.com/gbbirkisson/mcp-oda) |
| Package | `mcp-oda` 0.4.5 |
| Revision | `05a1af25d9d0b60d45004652df50f54a1b5edfce` |
| Transport | MCP over stdio |
| Installation/build | Succeeded |
| Authentication test | Not performed; the tool expects locally stored credentials and cookies |

This is not presented as an Oda-supported integration or contract. The project’s own notes indicate that it relies on Oda web pages, session cookies, CSRF tokens, and private REST endpoints.

## Identified issues

### 1. Product search produces empty results

The core product-search function did not return usable products in the upstream test suite:

| Query | Expected outcome | Observed outcome |
| --- | --- | --- |
| `melk` | One or more matching products | No items returned |
| `brød`, including pagination | One or more matching products and valid pagination | No items returned |

This prevents product matching and a reviewed shopping-list-to-cart workflow.

### 2. Recipe details are not reliable

Recipe search/filter tests passed, but retrieving details for a recipe returned by search failed. That means a client cannot safely assume that a search result can be expanded into a valid recipe record.

### 3. Read-only cart access remains unverified

The MCP advertises `cart_get_contents`, but it requires authenticated setup. We intentionally did not use account credentials during the compatibility assessment, so we could not verify whether the current cart can be read reliably and without side effects.

Cart reading is a prerequisite for safely adding reviewed items: it is needed to avoid accidental duplicates and to reconcile an ambiguous write result.

### 4. No order-history or completed-delivery capability

The assessed MCP exposes no tool to:

- list orders;
- retrieve order details or line items;
- determine whether an order is delivered/completed; or
- import historical purchases.

This blocks a planned opt-in workflow that would let a user review a completed Oda order and then propose its products as additions to their household stock. A purchase would never be treated as proof that an item remains at home; the user would confirm each stock change.

### 5. Private, unstable integration surface

The available MCP appears to depend on private web and REST behaviour rather than a published, versioned integration contract. This makes changes to the website, session handling, CSRF protection, or response schemas likely to break downstream clients without notice.

The dependency audit also reported 15 findings in the assessed dependency graph (1 low, 2 moderate, 12 high). That finding concerns the community package’s dependency tree, not Oda’s own systems, but it prevents us from treating the package as production-ready without remediation and review.

### 6. Price and availability cannot be finalised by the exposed tools

Oda’s ordering flow updates availability and prices after a delivery slot is selected. The assessed MCP does not expose delivery-slot selection, so any pre-checkout cart preview would be indicative only. Checkout, payment, delivery selection, and order placement are deliberately outside the scope of Family Table.

## Test result at a glance

| Readiness condition | Result |
| --- | --- |
| Install and build an integration implementation | Pass |
| Search products and receive usable product records | Fail |
| Read current cart without a mutation | Not verified |
| List historical orders with delivery status | Unsupported |
| Keep credentials outside the browser application | Pass in our design |
| Perform mutations during assessment | Not attempted |

## What would unblock a safe integration

We would welcome guidance on, or access to, a supported interface that provides the following:

1. A documented, versioned API or officially maintained MCP server, with a support and change-notice policy.
2. Stable, authenticated or anonymous product search that returns product IDs, names, package size/unit, current availability, and price where appropriate.
3. Read-only access to the current cart.
4. Read-only order history, order-line details, and a reliable delivered/completed status.
5. A documented authentication approach suitable for a local companion application, without sending account credentials or session cookies to a browser app.
6. Clear rate limits, consent expectations, and permitted use for a personal household-planning integration.
7. If cart writes are supported, an idempotent add/merge operation with a way to reconcile the resulting cart. We do not need checkout, payment, delivery-slot management, or order placement.

## Proposed next step

If Oda can point us to an official API, supported partner channel, or maintained MCP server, we can repeat a strictly read-only compatibility check against the documented interface. We will capture the exact version and schemas, validate only the agreed capabilities, and keep credentials and cookies confined to a loopback-only local companion process.

## Supporting material

- Internal reproducibility record: [`ODA_CAPABILITY_REPORT.md`](./ODA_CAPABILITY_REPORT.md)
- Integration design and boundaries: [`ODA_INTEGRATION_PLAN.md`](./ODA_INTEGRATION_PLAN.md)
- Security boundary and residual risks: [`ODA_THREAT_MODEL.md`](./ODA_THREAT_MODEL.md)

