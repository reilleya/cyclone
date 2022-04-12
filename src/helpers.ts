
export function isObject(value: unknown): boolean {
    return typeof value === 'object' && !Array.isArray(value) && value !== null
}

export function degToRad(degrees: number) {
    return degrees / 180 * Math.PI;
}

export function radToDeg(radians: number) {
    return radians * 180 / Math.PI;
}
