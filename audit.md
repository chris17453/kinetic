# Kinetic UI Audit vs. Power BI

## What Power BI Is

Power BI is a business intelligence platform built around a few core concepts:

- `Workspace`: the container for reports, dashboards, semantic models, and permissions.
- `Report`: the primary interactive analysis surface, usually multi-page and dense.
- `Dashboard`: a high-level tile board used for monitoring.
- `Semantic model`: the governed data layer behind reports.
- `Navigation`: a compact, left-rail experience that makes recent items, workspaces, and content easy to reach.

The important product idea is not just “charts on a page”. It is a governed analytics workspace with:

- strong information hierarchy
- dense drill-through
- role-aware access
- reusable data assets
- report-first navigation
- fast movement between workspace, report, dataset, and governance context

## Current State

The app is materially better than it was, but it is still not at a Power BI level.

What is now working:

- a collapsible left rail
- icon-first navigation
- report drill-through links
- workspace detail pages
- signals and ontology surfaces
- a more enterprise-oriented dark shell
- some report metadata and context panels

What is still weak:

- the dashboard tab does not yet have a clear product purpose
- workspaces are represented too much like isolated cards instead of navigable containers
- workspace cards do not yet lead into a strong workspace experience
- workspace dashboards are not clearly differentiated from reports
- many reports are just oversized charts with too little depth
- navigation between related assets is still inconsistent
- creator and consumer views are not cleanly separated

## Main Gaps

### 1. Visual language is still inconsistent

- Some pages use the new dark shell.
- Many page bodies still look like default Bootstrap admin screens.
- Card styles, spacing, header rhythm, and density are not unified.
- The app still reads as “custom app with cards” instead of “BI product”.

### 2. Report pages are still not the center of the product

- Power BI puts the report canvas first.
- This app still shows too much surrounding chrome.
- Report metadata, controls, and details still compete with the visualization area.
- Some report pages feel like a detail form, not an analysis surface.

### 3. Navigation is better, but still not product-grade

- Power BI uses a compact, disciplined left rail.
- The current shell is closer, but not yet as refined.
- Missing are stronger active-state treatment, better section grouping, and a clearer “recent / workspace / favorites” mental model.
- The dashboard tab needs a defined job, not just a page name.
- Workspace and report navigation should behave like a content graph, not a dead-end card list.
- Creator and consumer navigation should not share the same surface in a way that blurs intent.

### 4. Workspace and catalog behavior is not deep enough

- Workspaces should feel like containers for reports, datasets, dashboards, and members.
- Catalog should feel like the entry point for finding reports quickly.
- Right now, the pages still expose too much list/card UI and not enough structured drill-down.
- Workspaces need a real list-and-detail rhythm, not just a card and a landing page.
- Workspace dashboards need a clear role, separate from reports and separated by purpose.
- Report discovery should be direct, not hidden behind multiple generic card layers.

### 5. Governance is present but not fully productized

- Signals and ontology exist, which is good.
- They need to be surfaced as first-class governed BI concepts, not side pages.
- There should be clearer relationships between report, dataset, workspace, signals, and ontology artifacts.

### 6. “Enterprise” is not yet believable end-to-end

An enterprise BI product usually has:

- denser hierarchy
- more intentional typography
- stronger permission cues
- richer empty/loading states
- better drill-through between related assets
- fewer dead ends

We have some of this, but not enough of it.

## Specific Product Deficiencies

- report lists are still too card-heavy in places
- several views still rely on generic Bootstrap defaults
- dashboard/workspace/report surfaces are not visually unified
- some content is present but not strongly connected
- the app still lacks the “one workspace, many governed assets” feel
- there is not yet enough visual weight on the actual report canvas

## What Should Be Built

### Shell

- keep the dark, compact left rail
- make the shell feel closer to a BI workspace than an app sidebar
- add clearer sectioning for home, recent, workspaces, reports, and governance
- split creator tools from consumer views
- use role-aware navigation so users only see the surfaces they need

### Navigation First

- define the purpose of Dashboard, Workspaces, Reports, Catalog, and Governance
- make every major surface a clear entry point with an obvious next click
- replace dead-end cards with navigable rows, tiles, or drill-through panels
- make workspace membership, dashboards, reports, and datasets visible as related objects
- keep report navigation direct and visually dominant
- give creators separate tools without polluting the consumer experience

### Home

- make the home page a true launch surface
- prioritize recent reports, favorite reports, active workspaces, and alerts
- reduce decorative hero treatment

### Reports

- make report rendering the dominant element
- treat metadata as supporting context, not the primary content
- add clearer drill-through to workspace, dataset, and governance items
- stop treating reports like generic full-width bar charts with little depth
- show multiple report shapes and views, not one oversized chart pattern

### Workspaces

- show workspace summary, members, reports, datasets, dashboards, and signals in one coherent layout
- emphasize the workspace as the organizing unit
- make workspace pages navigable and hierarchical
- ensure workspace dashboards are distinguishable from reports and actually useful

### Catalog

- optimize for finding the report fast
- minimize oversized cards
- increase scanability and filtering power
- make it easy to jump straight into the report from the list

### Governance

- present signals and ontology as a governed semantic layer
- connect them visibly to reports and datasets
- make governance reachable from the main content graph, not a side corridor

### Target Feature Set

- embedded vs. internal BI
- end user dashboard creation and modification
- white-labeling
- CSS custom styling
- localization
- multi-tenant architecture
- dashboard templates and charts
- drag-and-drop builder
- visualizations from code
- custom charts
- period-over-period comparison
- formulas
- interactivity and external platform integration
- drilldown
- native array column support
- embeddable AI and conversational experiences
- intelligent data acceleration
- licensing model
- roles and security
- domain independence
- mobile and tablet responsiveness

## Implementation Backlog

### P0 Platform Shape

- finalize internal BI vs embedded BI modes
- hard-separate creator, consumer, and admin experiences
- keep role-aware route and nav gating complete
- make the shell and content hierarchy consistent across all core pages
- ensure mobile and tablet layouts remain usable

### P1 Report Experience

- make report canvas the primary screen region
- support drilldown and cross-navigation between report, dataset, workspace, and governance
- add period-over-period patterns and formulas to the report model
- support custom charts and code-defined visualizations
- improve report density, multi-view behavior, and navigation

### P2 Workspace and Catalog

- turn workspaces into true content hubs
- make catalog the fastest route to a report
- replace dead-end cards with navigable rows and summaries
- distinguish workspace dashboards from reports by purpose and layout

### P3 Governance and Semantic Layer

- surface signals and ontology as first-class governed assets
- connect governance artifacts to reports and datasets
- add native support for richer data shapes such as arrays
- improve intelligent data acceleration and dataset reuse

### P4 Productization

- white-labeling and CSS customization
- localization support
- dashboard templates and drag-and-drop editing
- embeddable AI and conversational entry points
- licensing and tenant management
- external platform integration and embedding controls

## Priority Order

1. Fix navigation and role separation first.
2. Define the purpose of Dashboard, Workspaces, Reports, Catalog, and Governance.
3. Unify layout and card system across all major pages.
4. Make report pages report-first.
5. Rework workspaces and catalog for faster drill-down.
6. Make governance a first-class part of the navigation and content model.
7. Add richer density, icons, and hierarchy everywhere.

## Bottom Line

The app is moving in the right direction, but it is still not Power BI-like in depth, density, or coherence.

The biggest issue is not missing one component. It is that the whole product still behaves like a collection of pages instead of a governed analytics workspace.
