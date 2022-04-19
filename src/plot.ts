import { createCanvas, loadImage } from 'canvas';
import { Readable } from 'stream';

// TODO: move this
interface ICoordinate2D {
    x: number;
    y: number;
}

// Turn two machine coordinate endpoints into a set of screen-space line segments
function generateCoordinates(start: ICoordinate2D, end: ICoordinate2D): ICoordinate2D[][] {
    // Are both endpoints in the same modulo? If so, mod360 and return
    if (Math.floor(start.y / 360) === Math.floor(end.y / 360)) {
        return [[{x: start.x, y: start.y % 360}, {x: end.x, y: end.y % 360}]];
    }

    // If not, calc the intersection point between the ray and the relevant edge
    const slope = (end.y - start.y) / (end.x - start.x);

    let currentSegmentEndY = 0;
    let nextSegmentStartY = 360 * Math.floor(start.y / 360);
    let nextSegmentStartYAdj = -0.001; // TODO: refactor this to not care if the segment ends on 360N

    if (end.y > start.y) {
        currentSegmentEndY = 360;
        nextSegmentStartY = 360 * Math.ceil(start.y / 360);
        nextSegmentStartYAdj = 0.001;
    }

    const currentSegmentEndX = start.x + ((nextSegmentStartY - start.y) * (1/slope));

    return [[{x: start.x, y: start.y % 360}, {x: currentSegmentEndX, y: currentSegmentEndY}]].concat(
        generateCoordinates({x: currentSegmentEndX, y: nextSegmentStartY + nextSegmentStartYAdj}, end)
    )    
}

export function plotGCode(gcode: string[]): Readable {
    const canvas = createCanvas(600, 360);
    const ctx = canvas.getContext('2d');

    let xCoord = 0;
    let yCoord = 0;

    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (const line of gcode) {
        const lineParts = line.split(' ');
        if (lineParts[0] != 'G0') {
            console.log(`Unknown gcode line: '${line}', skipping`)
            continue;
        }

        let nextXCoord = xCoord;
        let nextYCoord = yCoord;
        for (const coordinate of lineParts.slice(1)) {
            if (coordinate[0] === 'X') {
                nextXCoord = Number.parseFloat(coordinate.slice(1));
            }
            if (coordinate[0] === 'Y') {
                nextYCoord = Number.parseFloat(coordinate.slice(1));
            }
        }

        for (const segment of generateCoordinates({x: xCoord, y: yCoord}, {x: nextXCoord, y: nextYCoord})) {

            ctx.strokeStyle = 'rgb(73, 0, 168)';
            ctx.lineWidth = 12;
            ctx.beginPath();
            for (const point of segment) {
                ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();

            ctx.strokeStyle = 'rgb(252, 211, 3)';
            ctx.lineWidth = 9;
            ctx.beginPath();
            for (const point of segment) {
                ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();
        }
        
        xCoord = nextXCoord;
        yCoord = nextYCoord;
    }

    return canvas.createPNGStream();
};
