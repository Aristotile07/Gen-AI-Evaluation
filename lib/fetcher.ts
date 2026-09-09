export class FetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
  }
}

export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) detail = body.error;
    } catch {
      /* non-JSON error body — keep the generic message */
    }
    throw new FetchError(detail, res.status);
  }
  return res.json() as Promise<T>;
}
