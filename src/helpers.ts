
export function isObject(value: unknown): boolean {
    return typeof value === 'object' && !Array.isArray(value) && value !== null
}
