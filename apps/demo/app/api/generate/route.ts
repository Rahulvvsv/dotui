import type { Overlay } from '@dotui/elements';
import { generatePanelOverlay, mockGenerator, openaiGenerator, panelSlice } from '@dotui/llm';
import { NextResponse } from 'next/server';
import { schema } from '../../../lib/schema';

export const dynamic = 'force-dynamic';

type GenerateBody = {
  prompt?: string;
  panelId?: string;
  current?: Overlay;
};

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });

  const prompt = body.prompt?.trim();
  const panelId = body.panelId?.trim();
  if (!prompt || !panelId) {
    return NextResponse.json({ error: 'prompt and panelId are required.' }, { status: 400 });
  }
  if (!schema.panels[panelId]) {
    return NextResponse.json({ error: `Unknown panelId: ${panelId}` }, { status: 404 });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.OPENAI_MODEL?.trim() || undefined;
    const generator = apiKey ? openaiGenerator({ apiKey, model }) : mockGenerator;
    const slice = panelSlice(schema, panelId);
    const result = await generatePanelOverlay(
      {
        prompt,
        panelId,
        ...slice,
        palette: schema.palette,
        context: { panels: schema.panels, dots: schema.dots },
        current: body.current,
      },
      generator,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: messageOf(error) }, { status: 500 });
  }
}

async function readBody(request: Request): Promise<GenerateBody | null> {
  try {
    return (await request.json()) as GenerateBody;
  } catch {
    return null;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
