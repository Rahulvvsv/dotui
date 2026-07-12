# @dotui/llm

The generation pipeline: prompt + schema slice in → guardrailed overlay out.

## Flow

```
prompt, panelId
      │
panelSlice(schema, panelId)        the panel + nested panels + their dots
      │
Generator (seam)                   mockGenerator | openaiGenerator
      │
generatePanelOverlay               scope to the panel's ids → validateOverlay
      │
{ overlay, dropped }
```

- `slice.ts` — `panelSlice`: the editable subtree for one panel.
- `types.ts` — `GenerateRequest` (prompt, target slice, optional whole-UI
  read-only `context`, `current` overlay so the model edits the LIVE look) and
  the `Generator` seam.
- `mock.ts` — deterministic keyword generator (bigger/dark/contrast/colour/
  rounded/spacious, hide/show by matching dot text, declutter → hide
  non-`required`). The no-API-key fallback; same signature as the real one.
- `openai.ts` — OpenAI Responses API with a forced `emit_overlay` tool call,
  current-overlay folding (the model sees authored+overlay classes), and one
  retry on invalid or guardrail-dropped output.
- `generate.ts` — `generatePanelOverlay(req, generator)`: the single entry
  point apps call. Scopes output to the target panel (a generator can never
  patch ids outside its slice) and runs the guardrail.

## Example (server route)

```ts
const generator = process.env.OPENAI_API_KEY
  ? openaiGenerator({ apiKey: process.env.OPENAI_API_KEY })
  : mockGenerator;

const slice = panelSlice(schema, panelId);
const result = await generatePanelOverlay(
  { prompt, panelId, ...slice, palette: schema.palette, current },
  generator,
);
// result.overlay → apply; result.dropped → what the guardrail stripped
```
