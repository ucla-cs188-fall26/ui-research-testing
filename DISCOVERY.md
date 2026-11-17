# DISCOVERY: how the wireframes work in this repo!

## Summary

1. **Screens = `frame` elements.** Real frame tool exists (`type: "frame"`). Not a parent: membership is geometric only, no `children` or `parentId`.
2. **Buttons = a `rect` plus a `text` on top of it.** Two separate elements. No button type, no grouping.
3. **Arrows bind to element ids.** `start` / `end` each have `x, y` plus optional `elementId` + `side`. Unbound end = free point.
4. **Arrow start often binds to the label text, not the rect.** Snap picks the topmost element, and the text is drawn above its rect. Normalizer has to map text -> containing rect.
5. **Frame names are useless.** `name` is always `"frame"`, no rename UI. Screen name has to come from the biggest text inside.

---

## I. Where do shapes live in Zustand?

`src/store/editorStore.ts:47` `useEditor`. Field `doc: WireframeDoc` (line 21). Also `past`, `future` (undo), `selectedIds`, `tool`, `isDirty`.

Types in `src/api/wireframe.ts:4-42`:

```ts
export type ElementType = "rect" | "ellipse" | "text" | "line" | "frame" | "arrow";
export type Side = "top" | "right" | "bottom" | "left";
export interface ArrowEnd {
  x: number;
  y: number;
  elementId?: string;
  side?: Side;
}
export interface WireframeElement {
  id: string;
  type: ElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text?: string;     // for text elements
  fontSize?: number;
  points?: number[]; // for lines
  start?: ArrowEnd;  // for arrows
  end?: ArrowEnd;    // for arrows
}
export interface WireframeDoc {
  version: 1;
  elements: Record<string, WireframeElement>;
  order: string[]; // z-order, bottom to top
}
```

## II. Shape types and fields

Only 6 types. **No circle, group or image.** (Spec assumed those. Ellipse maps to `shape`.)

All elements share: `id` (nanoid), `type`, `name` (= type, `editorStore.ts:63`), `x, y` (top-left, doc coords), `width, height`, `rotation` (degrees, around top-left), `fill`, `stroke`, `strokeWidth`.

| type | extra fields | notes |
|---|---|---|
| `rect` | none | drawn by drag (`Canvas.tsx:585-593`, 654-659) |
| `frame` | none | rendered as a plain Rect (`Canvas.tsx:209-213`) |
| `ellipse` | none | x/y is top-left of bbox (`Canvas.tsx:215-227`) |
| `text` | `text`, `fontSize` (default 24) | placed by click, width 160 (`Canvas.tsx:567-579`). **Height is not stored reliably.** It is measured with Konva at render time (`geometry.ts:21-43`). Stored `height` stays 24. |
| `line` | `points` = `[0,0,dx,dy]` relative to x/y | decoration, ignore |
| `arrow` | `start`, `end` (ArrowEnd) | `x, y = 0`, `width, height = 1` are junk (`Canvas.tsx:668-678`) |

## III. Frame / page / artboard?

`type: "frame"`.** Toolbar has a Frame tool (`Toolbar.tsx:9`).

- Stored as a normal element in `doc.elements`, same fields as a rect.
- No link from children to frame. "Inside" = geometric containment.
- Name not usable (always `"frame"`).
- Snapping treats frames specially: arrows only snap to a frame near its border, not its interior (`geometry.ts:133-142`).

## IV. How arrows store endpoints

Binding ids, with a coordinate fallback (`wireframe.ts:12-17`, `geometry.ts:80-101`).

- `start.elementId` + `start.side` set if the end snapped to an element. Live position = midpoint of that side (`resolveEnd`).
- No `elementId` = free point at `start.x, start.y` in doc coords.
- Stored `x, y` on a bound end is the position at snap time, so it can be stale after the target moves. Always resolve through `elementId` first.
- Snap target = topmost non-arrow, non-line element within ~14 px (`findSnap`, `geometry.ts:109-158`). For a button that is usually the **text**, not the rect.
- An end can bind to a **frame** if dropped near the frame border. End bound to a frame = clear `toScreen`. Start bound to a frame = no trigger element.
- If you delete a shape, arrows bound to it keep a dangling `elementId`. `resolveEnd` falls back to the stored x/y.

## V. Supabase save / load

Table `wireframes`. Columns used in code:

- `id`, `owner_id`, `title`, `is_public`, `thumbnail_url`, `updated_at`
- **`document`: the whole `WireframeDoc` as one JSON blob**

Where:
- Create: `App.tsx:38-46` inserts `document: { version: 1, elements: {}, order: [] }`
- Load: `pages/Editor.tsx:176-180` selects `title, is_public, owner_id, document`, then `loadDoc(d)` at line 202
- Autosave: `hooks/useAutosave.ts:16-19`, 1.5 s debounce, `.update({ document: doc, updated_at })`
- Save on unmount: `pages/Editor.tsx:46-58`
- Viewer: `pages/Viewer.tsx:34` `loadDoc(row.document)`

Other tables seen: `profiles`, `comments`. No migrations or SQL in the repo, so types are inferred from code.

## VI. Get the open wireframe in a component

```ts
import { useEditor } from "../store/editorStore";
const doc = useEditor((s) => s.doc);        // reactive
const doc = useEditor.getState().doc;       // one-off read, e.g. on button click
```

Wireframe id: `useParams().id` on the `/editor/:id` route (`Editor.tsx:158`). Not needed for eval.

## VII. Where the Evaluate button goes

`src/components/Toolbar.tsx`. Rendered once, only in the editor (`Editor.tsx:144`).

Plan: one import (`EvalPanel`), one `useState` (open), one `<button>` after Redo. Panel renders from Toolbar as a fixed overlay so no layout change.

Risk: Toolbar uses Tailwind classes, and Harvey is restyling. Keep our edit to 3 lines.

## VIII. .gitignore, env vars, scripts

- `.env` **is** ignored (`.gitignore:25`).
- `.env.*` **not** ignored (only `*.local`). `server/.cache/` not ignored. Will add both later on.
- Client env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (`lib/supabase.ts:4-5`). No other `import.meta.env` use.
- Scripts: `dev` (vite), `build` (`tsc -b && vite build`), `lint` (oxlint), `preview`.

## Other things that affect the build

- **`tsc -b` only type-checks `src/` and `vite.config.ts`.** Nothing covers `server/` or `scripts/`. tsx runs them fine, but type errors there won't be caught. Plan: add new `server/tsconfig.json` (new file, not wired into `tsc -b` so Vercel build is unchanged).
- `src/eval/*` gets type-checked by `npm run build` with `noUnusedLocals` / `noUnusedParameters`. Shared files must not use `import.meta.env` or DOM-only APIs, since the server imports them.
- TypeScript is `~7.0.2`, Vite 8, React 19, Tailwind 4.
- `nanoid` is used (`editorStore.ts:3`) but not in `package.json`. Works only as a transitive dep. Not ours to fix, just noting.
- Arrows from the Konva `Arrow` node are drawn at `x=0, y=0` with absolute points (`Canvas.tsx:284-288`). Matches the doc coords above.

## Normalizer plan from these findings

- If `doc` has any `frame`: screens = frames. Element belongs to the **smallest** frame containing its center. Elements outside every frame: dropped, one warning with the count.
- If no frames: fall back to the spec's container-rect rule.
- Text: height estimated as `lines * fontSize * 1.2` (no Konva on the server). Rotation assumed 0, warn if not.
- Arrow end -> element: `elementId` first. If it points to a text sitting on a rect, use the rect. If it points to a frame, that frame is the screen. Else spec's 12 px point rule.

## raw-sample.json

TBD...