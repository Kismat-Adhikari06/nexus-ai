const GROQ_STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export async function transcribeAudio(audioBlob: Blob, apiKey: string): Promise<string> {
  const formData = new FormData();
  const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('wav') ? 'wav' : 'webm';
  formData.append('file', audioBlob, `recording.${ext}`);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'text');

  try {
    const res = await fetch(GROQ_STT_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq STT error (${res.status}): ${err}`);
    }

    const text = await res.text();
    return text.trim();
  } catch (e) {
    throw new Error(`STT failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}
