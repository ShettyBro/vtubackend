// shared/utils/time.ts
export function utcToIST(date) {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    return new Date(date.getTime() + istOffsetMs).toISOString();
}
export function nowIST() {
    return utcToIST(new Date());
}
//# sourceMappingURL=time.js.map