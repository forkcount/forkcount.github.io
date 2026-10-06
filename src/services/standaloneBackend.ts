/**
 * Standalone backend helpers replaced by direct Firestore client operations.
 */
export async function standaloneFetch(_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
