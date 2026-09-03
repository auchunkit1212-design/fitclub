/** Safely read JSON from a fetch Response; avoids raw HTML parse errors surfacing to users. */
export async function readApiJson<T>(
  res: Response
): Promise<{ data: T | null; parseError: boolean }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const snippet = (await res.text()).slice(0, 200);
    console.error("[api] non-JSON response", res.status, res.url, snippet);
    return { data: null, parseError: true };
  }

  try {
    const data = (await res.json()) as T;
    return { data, parseError: false };
  } catch (err) {
    console.error("[api] JSON parse failed", res.status, res.url, err);
    return { data: null, parseError: true };
  }
}
