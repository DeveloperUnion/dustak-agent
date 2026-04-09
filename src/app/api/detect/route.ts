import { NextResponse } from 'next/server';
import { IMAGE_MODEL_BASE_URL } from '@/lib/imageModel';

export const runtime = 'nodejs';

/**
 * ImageModel /api/detect への薄いプロキシ。
 * クライアント → Next.js → ImageModel と中継することで CORS を回避し、
 * 将来的に認証ヘッダ等を差し込める余地も作る。
 */
export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field is required' }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append('file', file, file.name);

  try {
    const res = await fetch(`${IMAGE_MODEL_BASE_URL}/api/detect`, {
      method: 'POST',
      body: upstream,
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'upstream fetch failed', message }, { status: 502 });
  }
}
