# @dotui/elements

The runtime half of dotUI: the `dot.*` components and the overlay context.

## How a dot renders

1. The build-time Babel plugin (`@dotui/compiler`) stamped `__dotId` on the element.
2. The component looks its id up in the overlay from `<DotOverlayProvider value={…}>`.
3. `hidden: true` → renders nothing (a hidden panel drops its whole subtree).
4. Otherwise it renders its real HTML element with
   `twMerge(authorClassName, overlayClassName)` (overlay wins on conflicts) and
   `{ ...authorStyle, ...overlayStyle }`.

Everything else — `onClick`, `ref`, `disabled`, `aria-*`, `data-*`, `hover:`
classes — flows through untouched. The dotUI-only props (`__dotId`,
`description`, `required`) are stripped and never reach the DOM.

## API

- `dot.panel` (div) · `dot.text` (p; `type` picks the tag: h1…small) ·
  `dot.button` · `dot.badge` (span) · `dot.input` · `dot.image` — all created by
  one internal factory; see `createDot` in `dot.tsx`.
- `DotOverlayProvider` / `useOverlay` — plain React context carrying the
  `Overlay` (`@dotui/core`).

## Example

```tsx
<DotOverlayProvider value={{ 'home/panel#0/text#0': { className: 'text-xl' } }}>
  <dot.panel __dotId="home/panel#0" className="p-4">
    <dot.text __dotId="home/panel#0/text#0" className="text-sm">Hello</dot.text>
  </dot.panel>
</DotOverlayProvider>
// the text renders class "text-xl" (overlay beats the authored text-sm)
```

(In an app you never write `__dotId` yourself — the compiler plugin stamps it.)
