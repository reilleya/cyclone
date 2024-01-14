import { ECoordinateAxes, TCoordinateAxes } from './types';

// Turn a coordinate into a nicely formatted string
export function serializeCoordinate(coordinate: TCoordinateAxes) {
    return `{${coordinate[ECoordinateAxes.CARRIAGE]} ${coordinate[ECoordinateAxes.MANDREL]} ${coordinate[ECoordinateAxes.DELIVERY_HEAD]}}`
}

// Create an array of evenly-spaced coordinates between two coordinates
export function interpolateCoordinates(start: TCoordinateAxes, end: TCoordinateAxes, steps: number): TCoordinateAxes[] {
    if (steps <= 0) {
        throw new Error('Steps cannot be less than 1')
    }
    if (steps === 1) {
        return [end];
    }
    const coordinates: TCoordinateAxes[] = [];

    const carriageStep = (end[ECoordinateAxes.CARRIAGE] - start[ECoordinateAxes.CARRIAGE]) / (steps - 1);
    const mandrelStep = (end[ECoordinateAxes.MANDREL] - start[ECoordinateAxes.MANDREL]) / (steps - 1);
    const deliveryHeadStep = (end[ECoordinateAxes.DELIVERY_HEAD] - start[ECoordinateAxes.DELIVERY_HEAD]) / (steps - 1);

    for (let step = 0; step < steps; step++) {
        coordinates.push({
            [ECoordinateAxes.CARRIAGE]: start[ECoordinateAxes.CARRIAGE] + step * carriageStep,
            [ECoordinateAxes.MANDREL]: start[ECoordinateAxes.MANDREL] + step * mandrelStep,
            [ECoordinateAxes.DELIVERY_HEAD]: start[ECoordinateAxes.DELIVERY_HEAD] + step * deliveryHeadStep
        })
    }

    return coordinates;
}