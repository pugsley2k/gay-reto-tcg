export function validClientId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function sameListing(existing: Record<string, unknown>, listing: Record<string, unknown>) {
  return Object.keys(listing).every(key => (existing[key] ?? '') === (listing[key] ?? ''));
}
