// shared/utils/time.ts
export function utcToIST(date: Date): string {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(date.getTime() + istOffsetMs).toISOString();
}

export function nowIST(): string {
  return utcToIST(new Date());
}
