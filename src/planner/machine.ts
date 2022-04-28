import { TCoordinate, ECoordinateAxes, AxisLookup, TCoordinateAxes } from './types';

// Abstracts generating GCode while performing boundary checking, etc
export class WinderMachine {

    private gcode: string[] = [];

    // Profiler state
    private feedRateMMpM = 0;
    private totalTimeS = 0;
    private lastPosition: TCoordinateAxes;

    constructor() {
        this.lastPosition = {[ECoordinateAxes.CARRIAGE]: 0, [ECoordinateAxes.MANDREL]: 0, [ECoordinateAxes.DELIVERY_HEAD]: 0}
    }

    public getGCode(): string[] {
        return this.gcode;
    }

    public addRawGCode(command: string): void {
        this.gcode.push(command);
    }

    public setFeedRate(feedRateMMpM: number): void {
        this.feedRateMMpM = feedRateMMpM;
        this.gcode.push(`G0 F${feedRateMMpM}`);
    }

    public move(position: TCoordinate): void {
        let totalDistanceMM = 0;
        let command = 'G0';
        for (const axis in position) {
            const rawAxis = AxisLookup[axis as ECoordinateAxes];
            command += ` ${rawAxis}${position[axis as ECoordinateAxes]}`;

            totalDistanceMM += (position[axis as ECoordinateAxes] - this.lastPosition[axis as ECoordinateAxes]) ** 2

            this.lastPosition[axis as ECoordinateAxes] = position[axis as ECoordinateAxes];
        }

        // Assumes instantaneous acceleration
        this.totalTimeS += totalDistanceMM ** 0.5 / this.feedRateMMpM * 60;

        this.gcode.push(command);
    }

    public setPosition(position: TCoordinate): void {
        let command = 'G92';
        for (const axis of Object.keys(position)) {
            const rawAxis = AxisLookup[axis as ECoordinateAxes];
            command += ` ${rawAxis}${position[axis as ECoordinateAxes]}`;

            this.lastPosition[axis as ECoordinateAxes] = position[axis as ECoordinateAxes];
        }
        this.gcode.push(command);
    }

    // Moves carriage and delivery head to 0, advances the mandrel to the next 0 position and zeros all axes
    public zeroAxes(currentAngleDegrees: number): void {
        this.setPosition({
            [ECoordinateAxes.CARRIAGE]: 0,
            [ECoordinateAxes.MANDREL]: currentAngleDegrees % 360,
            [ECoordinateAxes.DELIVERY_HEAD]: 0
        });

        this.move({
            [ECoordinateAxes.MANDREL]: 360
        });

        this.setPosition({
            [ECoordinateAxes.MANDREL]: 0,
        });
    }

    public insertComment(text: string): void {
        this.gcode.push(`; ${text}`)

    }

    public getGCodeTimeS(): number {
        return this.totalTimeS;
    }

}