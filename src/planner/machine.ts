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

}