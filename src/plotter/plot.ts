import { createCanvas, loadImage } from 'canvas';
import { Readable } from 'stream';
import { ICoordinate2D } from './types'
import { generateCoordinates } from './helpers';
import { IMandrelParameters, ITowParameters } from '../planner/types';

interface IWindParameters {
    mandrel: IMandrelParameters;
    tow: ITowParameters;
}

export function plotGCode(gcode: string[]): Readable | void {
    // Look for a header and abort early if we don't find one in the first line
    const headerLineParts = gcode[0].split(' ');
    if (!(headerLineParts[0] === ';' && headerLineParts[1] === 'Parameters')) {
        console.log('Did not find header comment in first line');
        return void 0;
    }

    // TODO: validate these
    const windingParameters = JSON.parse(headerLineParts.slice(2).join(' ')) as IWindParameters;

    const canvas = createCanvas(windingParameters.mandrel.windLength, 360);
    const ctx = canvas.getContext('2d');

    let xCoord = 0;
    let yCoord = 0;

    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (const line of gcode) {
        const lineParts = line.split(' ');
        if (lineParts[0] === ';') {
            // Comment, nothing to do
            continue;
        }

        if (lineParts[0] !== 'G0') {
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
            ctx.lineWidth = windingParameters.tow.width;
            ctx.beginPath();
            for (const point of segment) {
                ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();

            ctx.strokeStyle = 'rgb(252, 211, 3)';
            ctx.lineWidth = windingParameters.tow.width * 0.75;
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
