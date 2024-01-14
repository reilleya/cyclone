import { TCoordinate, ECoordinateAxes, AxisLookup, TCoordinateAxes } from './types';
import { stripPrecision } from '../helpers';
import { interpolateCoordinates, serializeCoordinate } from './helpers';

// Abstracts generating GCode while performing boundary checking, etc
export class WinderMachine {

    private verboseOutput: boolean;
    private gcode: string[] = [];

    // Profiler state
    private feedRateMMpM = 0;
    private totalTimeS = 0;
    private totalTowLengthMM = 0;
    private lastPosition: TCoordinateAxes;
    private mandrelDiameter: number;

    constructor(mandrelDiameter: number, verboseOutput = false) {
        this.lastPosition = {[ECoordinateAxes.CARRIAGE]: 0, [ECoordinateAxes.MANDREL]: 0, [ECoordinateAxes.DELIVERY_HEAD]: 0}
        this.mandrelDiameter = mandrelDiameter;
        this.verboseOutput = verboseOutput;
    }

    public getGCode(): string[] {
        return this.gcode;
    }

    public addRawGCode(command: string): void {
        this.gcode.push(command);
    }

    public setFeedRate(feedRateMMpM: number): void {
        this.feedRateMMpM = feedRateMMpM;
        this.gcode.push(`G0 F${stripPrecision(feedRateMMpM)}`);
    }

    public move(position: TCoordinate): void {
        // Construct a fully-specified destination coordinate
        // Start with the old position, and replace any values specified in the new one
        const completeEndPosition = {...this.lastPosition, ...position};
        const doSegmentMove = this.lastPosition[ECoordinateAxes.CARRIAGE] !== completeEndPosition[ECoordinateAxes.CARRIAGE];
        // If we don't need to divide the move into multiple segments, run it as just one.
        if (!doSegmentMove) {
            if (this.verboseOutput) {
                this.insertComment(`Move from ${serializeCoordinate(this.lastPosition)} to ${serializeCoordinate(completeEndPosition)} as a simple move`);
            }
            return this.moveSegment(position);
        }
        // For segmented moves, divide the total move so each piece has ~1mm of carriage movement
        const numSegments = Math.round(Math.abs(this.lastPosition[ECoordinateAxes.CARRIAGE] - completeEndPosition[ECoordinateAxes.CARRIAGE])) + 1;
        if (this.verboseOutput) {
            this.insertComment(`Move from ${serializeCoordinate(this.lastPosition)} to ${serializeCoordinate(completeEndPosition)} in ${numSegments} segments`);
        }
        for (let intermediatePosition of interpolateCoordinates(this.lastPosition, completeEndPosition, numSegments)) {
            this.moveSegment(intermediatePosition);
        }
    }

    public setPosition(position: TCoordinate): void {
        let command = 'G92';
        for (const axis of Object.keys(position)) {
            const rawAxis = AxisLookup[axis as ECoordinateAxes];
            command += ` ${rawAxis}${stripPrecision(position[axis as ECoordinateAxes])}`;

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

    public getTowLengthM(): number {
        return this.totalTowLengthMM / 1000;
    }

    // Update the mandrel diameter to a new value, useful for incrementing it to account for previous layers
    public setMandrelDiameter(mandrelDiameter: number): void {
        this.mandrelDiameter = mandrelDiameter;
    }

    // We have to split up moves into many tiny chunks, because marlin only allows pausing after a command completes
    private moveSegment(position: TCoordinate): void {
        // Distance of the move in "Marlin Units", used for time profiling
        //  Treats mandrel degrees as MM and accounts for delivery head movements, because that's what marlin does
        let totalDistanceMarlinUnitsSq = 0;
        // Total distance of the move in actual MM, taking into account mandrel diameter and ignoring delivery head
        let towLengthMMSq = 0;
        let command = 'G0';
        for (const axis in position) {
            const rawAxis = AxisLookup[axis as ECoordinateAxes];
            command += ` ${rawAxis}${stripPrecision(position[axis as ECoordinateAxes])}`;

            // Everything in this loop below here is just for the profiler

            // Get the amount this axis moved
            const moveComponent = position[axis as ECoordinateAxes] - this.lastPosition[axis as ECoordinateAxes];

            // Add this onto the tally of "marlin units" that we will use to estimate time
            totalDistanceMarlinUnitsSq += moveComponent ** 2;

            // Handles incrementing tow length
            switch (axis) {
                case ECoordinateAxes.MANDREL: {
                    // Mandrel units are actually degrees, so convert them to arc length
                    const arcLengthMM = moveComponent / 360 * this.mandrelDiameter * Math.PI;
                    towLengthMMSq += arcLengthMM ** 2;
                    break;
                }
                case ECoordinateAxes.CARRIAGE: {
                    // Carriage units are just MM
                    towLengthMMSq += moveComponent ** 2;
                    break;
                }
                case ECoordinateAxes.DELIVERY_HEAD:
                default: {
                    // Do not add delivery head movement onto the tow length because moving it doesn't unspool more
                    break;
                }
            }

            this.lastPosition[axis as ECoordinateAxes] = position[axis as ECoordinateAxes];
        }

        // Assumes instantaneous acceleration
        this.totalTimeS += totalDistanceMarlinUnitsSq ** 0.5 / this.feedRateMMpM * 60;
        this.totalTowLengthMM += towLengthMMSq ** 0.5;

        this.gcode.push(command);
    }

}