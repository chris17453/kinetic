# Kinetic — UI Gap Analysis

Full analysis of the frontend against best-in-class BI/reporting SaaS products (Metabase, Retool, Looker, Power BI).
Covers branding, management, user interaction, and ease of use.

---

## 1. Branding & Visual Identity

### CRITICAL
- **No real logo** — The sidebar shows the text "Kinetic" with a hardcoded bolt emoji. There is no SVG logo asset, no favicon beyond the React default, and no logo in the login screen. Brands like this look unfinished instantly.
- **No login page branding** — LoginPage has a two-column layout with a left-side brand panel but it renders a generic gradient + placeholder text. No illustration, no product screenshot, nothing that communicates value.
- **Color system is wired but not applied** — `brandingStore` and `lib/theme.tsx` inject CSS variables, but the Tailwind classes throughout the app are hardcoded (`text-blue-600`, `bg-indigo-50`, etc.) instead of consuming `var(--color-primary)`. Switching themes has zero visual effect.

### HIGH
- **No org branding admin UI** — The data model and backend support custom logos, colors, and fonts per organization, but there is no settings page where an admin can actually configure this. The `OrganizationPage.tsx` exists but is incomplete.
- **Favicon is the React logo** — Ships with `react.svg` as the favicon. Every browser tab says "React" instead of "Kinetic".
- **Dashboard background / login background images** — Supported in the data model, but no upload UI and no preview.
- **Dark mode toggle exists but is broken** — The toggle in `brandingStore` flips a boolean and writes CSS variables, but most components use hardcoded Tailwind color classes so nothing actually changes.

### MEDIUM
- **No loading skeleton screens** — Data fetching shows spinners or blank space. Modern BI tools use skeleton loaders that match the layout of the content about to appear, making the app feel faster.
- **No empty-state illustrations** — When no reports/connections exist the pages show plain text. Good products show illustrated empty states with a clear CTA ("Create your first report →").
- **Typography is default Inter everywhere** — No typographic hierarchy beyond font-size. Headings, labels, body copy, and captions are indistinguishable in weight and letter-spacing.
- **No micro-animations** — Zero transition or animation on sidebar collapse, modal open/close, tab switch, card hover. Feels static compared to modern SaaS.

---

## 2. Navigation & Information Architecture

### CRITICAL
- **Flat sidebar with no grouping** — 9 items in one undifferentiated list. Items like "Tables", "Playground", "Stream Ingest" are developer tools that should be in a separate section from end-user items like "Dashboard" and "Reports".
- **No breadcrumbs** — When a user is on `/reports/abc123/edit` there is nothing in the header to tell them where they are or let them navigate back without using the browser button.
- **No page titles in the browser tab** — Every page shows the Vite default title. Power BI and Metabase always set `document.title` to the current report/page name.

### HIGH
- **No search in sidebar/header** — Users with 50+ reports can only find them by going to the Catalog page and typing in the search box. A global Cmd+K search palette (like Linear, Vercel, Notion) would be dramatically faster.
- **Admin pages not protected by role gate in UI** — The sidebar shows Users/Groups/Audit links to all users. Non-admins see links they can't use.
- **No "Recent" persistent state** — Dashboard shows recent reports from the API, but there is no persistent "recently viewed" list stored per-user in localStorage or the backend.
- **No keyboard navigation** — No `accesskey` attributes, no focusable sidebar items, no Esc-to-close on modals.

### MEDIUM
- **Sidebar does not remember collapsed state** — Every page refresh resets it to expanded.
- **No contextual back button** — The Report Viewer has no "Back to Catalog" link. Users rely on the browser back button.
- **"Stream Ingest" and "Tables" are buried in main nav** — These are power-user features that would be better under a "Data" or "Connections" sub-section.

---

## 3. Dashboard & Home Page

### CRITICAL
- **Dashboard stats are static placeholders** — The stat cards (Total Reports, Connections, etc.) appear to render real counts, but there is no trend line, no sparkline, no comparison to last period. They are just numbers.
- **No personalized home** — Every user sees the same dashboard. Best-in-class tools show "your recently viewed", "pinned for you", and activity from your team.

### HIGH
- **No activity feed** — No record of "John edited Sales Report 2 hours ago". Metabase and Looker show a team activity feed on the home screen.
- **No pinned/featured reports** — Admins can't promote important reports to appear prominently for all users.
- **Quick action cards are too generic** — "Create Report", "Add Connection" etc. are the same for every user regardless of their role or history.

### MEDIUM
- **No announcements or banner system** — Admins cannot push a message to all users ("Maintenance tonight at 10pm").
- **No usage stats widget** — No "you ran 12 queries this week" or "most popular report this month" context.

---

## 4. Report Catalog

### HIGH
- **No category sidebar/tree** — Categories are rendered as a flat horizontal filter bar. Products with 100+ reports need a tree view sidebar with report counts per category.
- **No bulk actions** — Cannot select multiple reports to delete, move to category, or change visibility in one action.
- **Rating system has no visual polish** — The 5-star rating component renders but there's no count display ("4.2 ★ (47 ratings)"), no hover preview, and no confirmation toast on submit.
- **No report preview on hover** — Metabase shows a thumbnail/preview of the report's last result on hover. High value for UX.
- **Tags are not filterable in the UI** — Tags are stored and displayed on report cards but clicking a tag does nothing (no filter applied).

### MEDIUM
- **No sort options** — The catalog only has text search and category filter. No "sort by: newest / most popular / last run / rating".
- **No "shared with me" filter** — No way to see only reports that have been shared with the user vs. ones they own.
- **Report cards show no last-run time** — Users can't tell if a report's data is 5 minutes old or 3 months old.

---

## 5. Report Builder

### CRITICAL
- **Report builder tabs have no validation before switching** — A user can go to the Visualization tab without ever writing a query. The tab order implies a workflow but doesn't enforce it.
- **Query editor has no schema browser** — The Monaco editor is great, but there is no sidebar showing the available tables and columns for the selected connection. Users must have the schema memorized or use the Tables page in a separate tab.

### HIGH
- **No query result preview inside builder** — After writing a query the user must navigate away to test it. There should be an inline "Run & Preview" section in the Query tab.
- **Parameter builder has no live preview** — You define parameters but can't see how the resulting input controls will look to the end user without actually viewing the report.
- **No version history for reports** — No way to see what the query looked like yesterday or roll back a bad edit.
- **Save button does not show unsaved-changes indicator** — The user has no visual cue that they have unsaved changes (no dirty dot, no "*" in title).
- **No AI assistant integration** — `QueryAssistant.tsx`, `ColumnNamingSuggestions.tsx`, and `VisualizationSuggester.tsx` are all built but not wired into the builder UI.

### MEDIUM
- **Column editor has no drag-to-reorder** — Columns can be reordered in the data model but the UI shows a static list with no drag handle.
- **Visualization builder adds new viz but doesn't scroll to it** — After clicking "Add Visualization" the new config panel is added but the user must scroll down to find it.
- **No "Duplicate Report" action** — Common workflow: duplicate a working report, tweak the query.

---

## 6. Report Viewer

### HIGH
- **No auto-refresh option** — Real-time dashboards need a "refresh every 30s / 1m / 5m" toggle. No such control exists.
- **Visualization panels have no resize/rearrange** — All visualizations stack vertically. Looker/Metabase let users arrange panels in a grid layout.
- **Export buttons exist but PDF/Excel may not work end-to-end** — The export modal shows all formats but the streaming CSV export was only just added; PDF and Excel export completeness is unclear.
- **No full-screen mode for charts** — A single click to expand a chart to full screen is standard in Tableau, Power BI, Metabase.
- **Parameter panel always visible** — If a report has no parameters the panel still occupies space. If it has many parameters they overflow without a collapse/expand control.

### MEDIUM
- **No "copy link with current parameters" button** — Users can't share a deep link to a report with specific parameter values already filled in.
- **No data freshness indicator** — Cache TTL is configured per report but the viewer shows no "Data as of 14:32 UTC" indicator.
- **Drill-through / click to filter** — Clicking a bar in a chart does nothing. Looker/Metabase let you click a data point to filter the whole dashboard.

---

## 7. User & Admin Management

### CRITICAL
- **ProfilePage.tsx is broken** — It imports from `@/components/ui` (shadcn/ui) which is not installed. The page will throw a runtime error for every user who navigates to it.

### HIGH
- **No department management UI** — The backend supports hierarchical departments but there is no page to create/edit/delete departments or assign users to them.
- **No permission matrix UI** — Permissions are stored per group but admins can only see a raw list. There is no grid showing "Group × Permission" with checkboxes.
- **User invite flow missing** — The only way to create a user is to register. Admins cannot send email invitations to new users.
- **No user bulk import (CSV)** — Enterprise deployments need to import hundreds of users at once.
- **Groups page shows groups but no member count or quick-add member** — You can't see "this group has 14 members" without clicking into it.

### MEDIUM
- **No password reset flow** — There is no "Forgot password" link on the login page and no admin "Reset user password" button.
- **No user deactivation confirmation dialog** — Clicking "Deactivate" immediately deactivates. No confirmation, no undo.
- **No audit log for admin actions** — The audit log page exists but admin actions (user created, group modified) may not be captured.

---

## 8. Playground / Query Editor

### HIGH
- **No saved queries** — The Playground has no way to save and name a query for reuse. Users lose their work on every page reload.
- **No query history** — No list of recently executed queries (like a terminal history). Metabase and Redash both have this.
- **No multi-tab support** — Can only work on one query at a time. Power users want multiple tabs open simultaneously.
- **No schema browser** — Same issue as Report Builder. No sidebar showing available tables and columns.

### MEDIUM
- **Result table has no column resize** — Fixed-width columns with no drag-to-resize.
- **No "Open in Report Builder" button** — After writing a good query in the Playground there's no one-click path to turn it into a saved report.
- **Keyboard shortcut Ctrl+Enter documented nowhere** — The one shortcut that exists has no tooltip or hint in the UI.

---

## 9. Connections Management

### HIGH
- **No connection health status on list page** — The connections list shows name and type but no "Last tested: 2h ago ✓" or "FAILING ✗" status indicator.
- **No connection usage stats** — No "14 reports use this connection" next to each connection. Deleting an in-use connection would break reports silently.
- **Test Connection only available in form** — You can only test a connection when creating/editing it. There's no test button on the list page for quick health checks.

### MEDIUM
- **Connection string is shown in plain text in the form** — It should be masked (like a password field) with a show/hide toggle, since it contains credentials.
- **No connection cloning** — Can't duplicate an existing connection to create a variant with different credentials.

---

## 10. Accessibility & Quality

### HIGH
- **No ARIA live regions** — Search results, filter changes, and query execution results appear without notifying screen readers.
- **Modal focus trapping missing** — Opening a modal does not trap focus inside it. Tab will cycle through background content.
- **Color contrast ratios not verified** — Gray text on white backgrounds (`text-gray-400 on bg-white`) may fail WCAG AA contrast requirements.
- **No skip-to-main-content link** — Keyboard users must tab through the entire sidebar on every page.

### MEDIUM
- **No error boundary** — A JavaScript error in a component will crash the entire app. React Error Boundaries should wrap each page.
- **No toast notification system** — Success/error feedback happens inline (sometimes). There is no global toast/snackbar system so some actions give no feedback at all.
- **Form submission doesn't disable the submit button** — Double-clicking "Save" can submit twice.
- **No confirmation dialogs for destructive actions** — Deleting a connection or report happens immediately.

---

## 11. Performance & Loading

### HIGH
- **No route-based code splitting** — All pages are bundled together. Large pages like ReportBuilderPage (which includes Monaco Editor) are downloaded even for users who only view reports.
- **Monaco Editor not lazy-loaded** — The Monaco Editor is a ~2MB bundle. It should only load when the user navigates to the Playground or Report Builder.

### MEDIUM
- **No optimistic updates** — Toggling a favorite or rating re-fetches from the server. Should update UI immediately and reconcile in background.
- **React Query cache not prefetching** — Hovering over a report card could prefetch its data before the user clicks.
- **No virtual scrolling for large result sets** — The results table loads all rows into the DOM. 10,000-row results will freeze the browser.

---

## Summary Priority Table

| # | Area | Issue | Severity |
|---|------|--------|----------|
| UI-1 | Branding | No real logo / favicon | CRITICAL |
| UI-2 | Branding | Dark mode broken (hardcoded Tailwind classes) | CRITICAL |
| UI-3 | Navigation | No global Cmd+K search | HIGH |
| UI-4 | Navigation | No breadcrumbs | HIGH |
| UI-5 | Navigation | Admin links visible to non-admins | HIGH |
| UI-6 | Dashboard | Stats have no trend / context | HIGH |
| UI-7 | Catalog | Tags not filterable | HIGH |
| UI-8 | Catalog | No sort options | MEDIUM |
| UI-9 | Report Builder | No inline schema browser | CRITICAL |
| UI-10 | Report Builder | AI components not wired up | HIGH |
| UI-11 | Report Builder | No unsaved-changes indicator | HIGH |
| UI-12 | Report Builder | No query result preview in builder | HIGH |
| UI-13 | Report Viewer | No auto-refresh | HIGH |
| UI-14 | Report Viewer | No full-screen chart mode | MEDIUM |
| UI-15 | Admin | ProfilePage broken (shadcn/ui not installed) | CRITICAL |
| UI-16 | Admin | No department management UI | HIGH |
| UI-17 | Admin | No permission matrix UI | HIGH |
| UI-18 | Admin | No password reset flow | HIGH |
| UI-19 | Admin | No user invite flow | HIGH |
| UI-20 | Playground | No saved queries / history | HIGH |
| UI-21 | Playground | No schema browser | HIGH |
| UI-22 | Connections | No health status on list | HIGH |
| UI-23 | Connections | No usage count ("14 reports use this") | HIGH |
| UI-24 | Accessibility | No modal focus trapping | HIGH |
| UI-25 | Accessibility | No toast notification system | HIGH |
| UI-26 | Accessibility | No error boundaries | HIGH |
| UI-27 | Performance | No route-based code splitting | HIGH |
| UI-28 | Performance | Monaco not lazy-loaded | HIGH |
| UI-29 | Branding | No empty-state illustrations | MEDIUM |
| UI-30 | Branding | No micro-animations | MEDIUM |
| UI-31 | Branding | No loading skeleton screens | MEDIUM |
| UI-32 | Navigation | Page titles not set in browser tab | HIGH |
| UI-33 | Catalog | No report preview on hover | MEDIUM |
| UI-34 | Report Viewer | No "copy link with params" button | MEDIUM |
| UI-35 | Connections | Connection string not masked | MEDIUM |
| UI-36 | Admin | No org branding admin UI | HIGH |

---

*Cross-reference: see `tasks.md` for the backend gap fixes already completed.*
