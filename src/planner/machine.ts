import { TCoordinate, ECoordinateAxes, AxisLookup } from './types';

// Abstracts generating GCode while performing boundary checking, etc
export class WinderMachine {

    private mandrelAngle = 0;
    private gcode: string[] = [];

    constructor() {

    }

    public getGCode(): string[] {
        return this.gcode;
    }

    public addRawGCode(command: string): void {
        this.gcode.push(command);
    }

    public setFeedRate(feedRate: number): void {
        this.gcode.push(`G0 F${feedRate}`);
    }

    public move(position: TCoordinate): void {
        let command = 'G0';
        for (const axis in position) {
            const rawAxis = AxisLookup[axis as ECoordinateAxes];
            command += ` ${rawAxis}${position[axis as ECoordinateAxes]}`;
        }
        this.gcode.push(command);
    }

    public setPosition(position: TCoordinate): void {
        let command = 'G92';
        for (const axis of Object.keys(position)) {
            const rawAxis = AxisLookup[axis as ECoordinateAxes];
            command += ` ${rawAxis}${position[axis as ECoordinateAxes]}`;
        }
        this.gcode.push(command);
    }

    public insertComment(text: string): void {
        this.gcode.push(`; ${text}`)

    }

}