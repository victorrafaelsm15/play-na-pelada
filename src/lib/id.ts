export function uid(prefix = 'id'): string {
  const rand = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}_${Date.now().toString(36)}${rand[0].toString(36)}${rand[1].toString(36).slice(0, 4)}`;
}
