
export function isObject(value: unknown): boolean {
    return typeof value === 'object' && !Array.isArray(value) && value !== null
}

export function degToRad(degrees: number) {
    return degrees / 180 * Math.PI;
}

export function radToDeg(radians: number) {
    return radians * 180 / Math.PI;
}

// Takes in a floating point number from a calculation and strips extra precision so it can be passed to marlin
export function stripPrecision(rawNumber: number, digits=6): number {
    return Number.parseFloat(rawNumber.toFixed(digits));
}
