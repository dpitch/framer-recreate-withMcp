# Framer Plugin: Responsive Component Maker

## Problem

When converting page elements into components in Framer, only the primary breakpoint's layout is preserved. All responsive adaptations (tablet, mobile) are lost because Framer's "Create Component" only captures the primary variant.

## Solution

A Framer Plugin that:
1. **Captures** the responsive layouts (all breakpoints) of a selected element before component creation
2. Lets the user **create the component** manually (API can't do this)
3. **Restores** the responsive layouts as component variants

## Validated Assumptions (tested via MCP on real project)

| Capability | Status | How |
|---|---|---|
| Read primary breakpoint structure | YES | `getChildren()` on primary breakpoint frame |
| Detect breakpoints on a page | YES | `node.isBreakpoint` + `node.isPrimaryBreakpoint` on FrameNode |
| Identify replica nodes | YES | `node.isReplica` / `node.originalId` links replica to original |
| Read effective properties on replicas | YES | Replica nodes expose same properties as originals (width, padding, layout, gap, etc.) |
| Clone a variant to create a new variant | YES | `node.clone()` on an existing variant creates a real variant (tested via MCP `duplicateNode`) |
| Update variant properties | YES | `node.setAttributes()` or `framer.setAttributes(id, attrs)` |
| Create component programmatically | NO | No public API exists |
| Store data across plugin sessions | YES | `node.setPluginData(key, value)` / `node.getPluginData(key)` |

## Plugin Architecture

### File Structure

```
responsive-component-maker/
  public/
    icon.svg
  src/
    main.tsx              # Entry point, renders React app
    App.tsx               # Main plugin UI with step-by-step workflow
    App.css               # Styles
    capture.ts            # Logic: traverse breakpoints, read properties, build snapshot
    restore.ts            # Logic: clone variants, apply captured properties
    types.ts              # TypeScript interfaces for captured data
    utils.ts              # Helpers: property diffing, node traversal
  framer.json             # Plugin manifest (mode: "canvas")
  index.html
  package.json
  tsconfig.json
  vite.config.ts
```

### Dependencies

```json
{
  "dependencies": {
    "framer-plugin": "^3.10.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react-swc": "^4.0.1",
    "typescript": "^5.9.2",
    "vite": "^7.1.11",
    "vite-plugin-framer": "^1.0.7",
    "vite-plugin-mkcert": "^1.17.8"
  }
}
```

### Plugin Manifest (`framer.json`)

```json
{
  "id": "responsive-component-maker",
  "name": "Responsive Component Maker",
  "modes": ["canvas"],
  "icon": "/icon.svg"
}
```

## Data Model

### `types.ts`

```typescript
// Snapshot of a single node's properties at a specific breakpoint
interface NodeSnapshot {
  originalId: string;           // ID in primary breakpoint
  name: string;                 // Node name for reference
  nodeType: "frame" | "text" | "svg" | "componentInstance";
  properties: Record<string, any>;  // All readable properties
  textContent?: string;         // For text nodes
  children: NodeSnapshot[];     // Recursive child snapshots
}

// Snapshot of one breakpoint's version of the entire element tree
interface BreakpointSnapshot {
  breakpointName: string;       // e.g. "Desktop", "Tablet", "Mobile"
  breakpointWidth: number;      // e.g. 992, 768, 390
  isPrimary: boolean;
  rootSnapshot: NodeSnapshot;
}

// Complete capture of all breakpoints for a selected element
interface ResponsiveCapture {
  elementName: string;
  primaryBreakpointId: string;
  snapshots: BreakpointSnapshot[];
  capturedAt: string;           // ISO timestamp
}
```

## Workflow: Step by Step

### Step 1: Capture (automatic)

**User action**: Select the target element on the page, click "Capture Responsive Layouts"

**Plugin logic** (`capture.ts`):

```
1. Get selection via framer.getSelection()
2. Get the selected node (must be exactly 1 node)
3. Navigate up to find the page root: node.getParent() recursively
4. Get page's direct children: page.getChildren()
5. Identify breakpoints:
   for each child of page:
     if isFrameNode(child) && child.isBreakpoint:
       record { id, name, isPrimary: child.isPrimaryBreakpoint, width: child.width }
6. For the PRIMARY breakpoint:
   - Find the selected element within it (by matching the selection)
   - Recursively traverse its tree with deepCapture():
     async function deepCapture(node): NodeSnapshot
       - Read ALL properties (width, height, padding, gap, layout, stackDirection, etc.)
       - If TextNode: also getText()
       - Get children, recurse
       - Return NodeSnapshot with children
7. For each NON-PRIMARY breakpoint:
   - Get breakpoint's children via breakpoint.getChildren()
   - Use node.walk() or recursive getChildren() to find replica nodes
   - Match replicas to originals via replica.originalId === original.id
   - For each matched replica, read its effective properties
   - Build a NodeSnapshot tree (only storing properties that DIFFER from primary)
8. Store the ResponsiveCapture as JSON via framer.setPluginData() on the page node
   (so it persists even if plugin is closed and reopened)
```

**Properties to capture on FrameNode**:
```typescript
const FRAME_PROPERTIES = [
  'name', 'visible', 'locked', 'opacity', 'rotation',
  'backgroundColor', 'backgroundImage', 'borderRadius',
  'position', 'top', 'right', 'bottom', 'left', 'centerX', 'centerY',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'aspectRatio', 'zIndex', 'overflow', 'overflowX', 'overflowY',
  'layout', 'gap', 'padding',
  'stackDirection', 'stackDistribution', 'stackAlignment', 'stackWrapEnabled',
  'gridColumnCount', 'gridRowCount', 'gridAlignment',
  'gridColumnWidthType', 'gridColumnWidth', 'gridColumnMinWidth',
  'gridRowHeightType', 'gridRowHeight',
  'gridItemFillCellWidth', 'gridItemFillCellHeight',
  'gridItemHorizontalAlignment', 'gridItemVerticalAlignment',
  'gridItemColumnSpan', 'gridItemRowSpan',
] as const;
```

**Properties to capture on TextNode**:
```typescript
const TEXT_PROPERTIES = [
  'name', 'visible', 'locked', 'opacity', 'rotation',
  'position', 'top', 'right', 'bottom', 'left', 'centerX', 'centerY',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'zIndex', 'overflow', 'font', 'inlineTextStyle',
  'gridItemFillCellWidth', 'gridItemFillCellHeight',
  'gridItemHorizontalAlignment', 'gridItemVerticalAlignment',
  'gridItemColumnSpan', 'gridItemRowSpan',
] as const;
```

### Step 2: Create Component (manual)

**User action**: Right-click the element -> "Create Component" in Framer

**Plugin UI**: Shows a "I've created the component" button. The plugin waits.

**Detection strategy**: After user clicks the button, the plugin:
1. Calls `framer.getSelection()` to get the newly created component instance
2. Verifies it's a `ComponentInstanceNode` via `isComponentInstanceNode()`
3. Gets the component definition via the instance (navigate to the component)
4. Or: subscribes to selection changes and detects when a ComponentNode appears

### Step 3: Restore Variants (automatic)

**User action**: Click "Restore Responsive Variants"

**Plugin logic** (`restore.ts`):

```
1. User should be inside the new component (double-clicked into it)
   OR plugin navigates into the component automatically
2. Get the component root via framer.getCanvasRoot() — should be a ComponentNode
3. Get children — the primary variant is the only child (a FrameNode with isPrimaryVariant: true)
4. For each non-primary breakpoint in the capture:
   a. Clone the primary variant: primaryVariant.clone()
      -> This creates a NEW VARIANT (confirmed by MCP testing)
   b. The clone inherits all primary properties
   c. Walk the cloned variant's tree using clone.walk()
   d. For each node in the clone, find the matching captured snapshot
      (match by tree position/index, since originalId relationships are preserved in clones)
   e. Apply the breakpoint-specific property overrides:
      node.setAttributes({ ...capturedDiffProperties })
   f. Rename the variant: clone.setAttributes({ name: breakpointSnapshot.breakpointName })
5. Notify success via framer.closePlugin("Variants restored!", { variant: "success" })
```

### Matching Strategy: Primary Node -> Clone Node

When we clone a variant, the clone has the same tree structure. We need to map:
- `capturedSnapshot.children[0]` -> `clonedVariant.children[0]`
- `capturedSnapshot.children[0].children[2]` -> `clonedVariant.children[0].children[2]`

This is a positional match (index-based), which works because:
- The clone has identical structure to the primary
- The capture was taken from the same structure
- We only need to apply DIFFERENT properties

### Property Diffing

To avoid applying unnecessary overrides (which would break inheritance), only set properties that actually differ from primary:

```typescript
function computeDiff(
  primarySnapshot: NodeSnapshot,
  breakpointSnapshot: NodeSnapshot
): Record<string, any> {
  const diff: Record<string, any> = {};
  for (const [key, value] of Object.entries(breakpointSnapshot.properties)) {
    if (JSON.stringify(value) !== JSON.stringify(primarySnapshot.properties[key])) {
      diff[key] = value;
    }
  }
  return diff;
}
```

## UI Design (`App.tsx`)

Simple 3-step wizard:

```
+-------------------------------------------+
|  Responsive Component Maker               |
+-------------------------------------------+
|                                            |
|  Step 1: Capture                           |
|  Select an element on the primary          |
|  breakpoint and click capture.             |
|                                            |
|  [Capture Responsive Layouts]              |
|                                            |
|  Status: Captured 3 breakpoints            |
|  - LargeDesktop (1440px) - primary         |
|  - Desktop (992px) - 4 overrides           |
|  - Tablet (768px) - 12 overrides           |
|                                            |
+-------------------------------------------+
|                                            |
|  Step 2: Create Component                  |
|  Right-click your element and select       |
|  "Create Component" in Framer.             |
|                                            |
|  [I've Created the Component]              |
|                                            |
+-------------------------------------------+
|                                            |
|  Step 3: Restore                           |
|  Enter the component (double-click) and    |
|  click restore.                            |
|                                            |
|  [Restore Responsive Variants]             |
|                                            |
|  Status: Created 2 variants                |
|  - Desktop variant: 4 properties applied   |
|  - Tablet variant: 12 properties applied   |
|                                            |
+-------------------------------------------+
```

### showUI Configuration

```typescript
framer.showUI({
  position: "top right",
  width: 300,
  minWidth: 280,
  maxWidth: 400,
  minHeight: 500,
  resizable: "height",
})
```

## Edge Cases & Considerations

### 1. ComponentInstance children
The selected element may contain `ComponentInstanceNode` children (like the AboutWidgets in our test). These instances have custom props. The plugin should:
- Capture the instance's custom prop values at each breakpoint
- NOT try to deep-capture inside instances (they're linked to their own components)

### 2. Hidden nodes
Some nodes may be `visible: false` on certain breakpoints. Capture this as a property override.

### 3. Nodes added/removed at breakpoints
Framer doesn't allow adding/removing nodes per breakpoint — replicas always mirror the primary structure. So this is not an edge case.

### 4. Text content differences
Text content can differ across breakpoints (truncated, reworded). Use `getText()` on TextNode replicas.

### 5. SVG nodes
SVGNodes may have different `svg` content per breakpoint. Capture the `svg` property.

### 6. Deep nesting
Use recursive traversal with async/await. The `node.walk()` async generator is available for flat traversal; use recursive `getChildren()` for tree-structured capture.

### 7. Plugin data persistence
Store capture data via `setPluginData()` on the page node, so if the user accidentally closes the plugin between Step 1 and Step 3, data is not lost. Check for existing capture on plugin open.

### 8. Finding replicas across breakpoints
The critical traversal:
```
Page
  ├── LargeDesktop (primary breakpoint)
  │     └── Section (originalId: null) ← this is the target
  │           ├── Container (originalId: null)
  │           └── Heading (originalId: null)
  ├── Desktop (non-primary breakpoint)
  │     └── Section (replica, originalId: points to Section above)
  │           ├── Container (replica, originalId: points to Container above)
  │           └── Heading (replica, originalId: points to Heading above)
  └── Tablet (non-primary breakpoint)
        └── Section (replica, originalId: points to Section above)
              ├── Container (replica, originalId: points to Container above)
              └── Heading (replica, originalId: points to Heading above)
```

To find replicas: for each non-primary breakpoint, walk its tree and match `replica.originalId === primaryNode.id`.

## Build & Test

```bash
# Setup
cd responsive-component-maker
npm install

# Dev (launches with hot reload, serves on https://localhost:5173)
npm run dev

# In Framer: Cmd+K -> search plugin name -> open
# Or: Plugins menu -> Development -> paste https://localhost:5173

# Build for production
npm run build
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `clone()` on a variant doesn't create a variant (Plugin API differs from MCP) | Blocker | Test immediately in first iteration. Fallback: use MCP for this step only |
| Replica node properties return `null` for inherited values (not effective values) | Major | Test on real project. If null = inherited, compare with primary to fill gaps |
| Large element trees slow down capture | Minor | Add progress indicator, batch reads |
| Plugin API rate limits or async batching issues | Minor | Sequential reads with small delays if needed |

## Implementation Order

1. **Scaffold the plugin** (package.json, vite config, framer.json, basic React app)
2. **Implement breakpoint detection** — list all breakpoints on current page
3. **Implement capture** — deep read of selected element across all breakpoints
4. **Test capture output** — verify data is correct by displaying in plugin UI
5. **Implement clone + setAttributes** — create variant and apply one breakpoint's diff
6. **Verify clone creates a real variant** (CRITICAL validation point)
7. **Implement full restore loop** — all breakpoints
8. **Add persistence** (pluginData) and error handling
9. **Polish UI** and add status feedback
