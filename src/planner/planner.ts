import type { IWindParameters, IMandrelParameters, ITowParameters, ILayerParameters, THelicalLayer, THoopLayer } from './types';
import { ECoordinateAxes } from './types';
import { ELayerType } from './types';
import { WinderMachine } from './machine';
import { radToDeg, degToRad } from '../helpers'; 

export function planWind(windingParameters: IWindParameters): string[] {

    const machine = new WinderMachine();

    machine.addRawGCode('G0 X0 Y0 Z0');
    machine.setFeedRate(windingParameters.defaultFeedRate);
    // TODO: Run other setup stuff

    for (const layer of windingParameters.layers) {
        switch(layer.windType) {
            case ELayerType.HOOP:
                planHoopLayer(machine, {
                    parameters: layer,
                    mandrelParameters: windingParameters.mandrelParameters,
                    towParameters: windingParameters.towParameters
                });
                break;

            case ELayerType.HELICAL:
                planHelicalLayer(machine, {
                    parameters: layer,
                    mandrelParameters: windingParameters.mandrelParameters,
                    towParameters: windingParameters.towParameters
                });
                break;
        }

        // Increment mandrel diameter, etc
    }

    // TODO: Run cleanup stuff

    return machine.getGCode();
}

// Each layer planning function is responsible for a there-and-back and resetting the cordinates to (0, 0, 0) at the end

export function planHoopLayer(machine: WinderMachine, layerParameters: ILayerParameters<THoopLayer>): void {
    // For now, assume overlap factor of 1.0

    const lockDegrees = 180;

     // Used for the delivery head angle
    const windAngle = 90 - radToDeg(Math.atan(layerParameters.mandrelParameters.diameter / layerParameters.towParameters.width));
    const mandrelRotatations = layerParameters.mandrelParameters.windLength / layerParameters.towParameters.width;
    const farMandrelPositionDegrees = lockDegrees + (mandrelRotatations * 360);
    const farLockPositionDegrees = farMandrelPositionDegrees + lockDegrees;
    const nearMandrelPositionDegrees = farLockPositionDegrees + (mandrelRotatations * 360);
    const nearLockPositionDegrees = nearMandrelPositionDegrees + lockDegrees;

    // Do a small near lock
    machine.move({
        [ECoordinateAxes.CARRIAGE]: 0,
        [ECoordinateAxes.MANDREL]: -lockDegrees,
        [ECoordinateAxes.DELIVERY_HEAD]: 0
    });
    // Tilt delivery head
    machine.move({
        [ECoordinateAxes.DELIVERY_HEAD]: windAngle
    });
    // Wind to the far end of the mandrel
    machine.move({
        [ECoordinateAxes.CARRIAGE]: layerParameters.mandrelParameters.windLength,
        [ECoordinateAxes.MANDREL]: -farMandrelPositionDegrees
    });
    // Do a small far lock
    machine.move({
        [ECoordinateAxes.MANDREL]: -farLockPositionDegrees,
        [ECoordinateAxes.DELIVERY_HEAD]: 0
    });
    // Tilt delivery head
    machine.move({
        [ECoordinateAxes.DELIVERY_HEAD]: -windAngle,
    });
    // Wind to the near end of the mandrel
    machine.move({
        [ECoordinateAxes.CARRIAGE]: 0,
        [ECoordinateAxes.MANDREL]: -nearMandrelPositionDegrees
    });
    // Do a small near lock
    machine.move({
        [ECoordinateAxes.MANDREL]: -nearLockPositionDegrees,
        [ECoordinateAxes.DELIVERY_HEAD]: 0
    });
    machine.setPosition({
        [ECoordinateAxes.CARRIAGE]: 0,
        [ECoordinateAxes.MANDREL]: 0,
        [ECoordinateAxes.DELIVERY_HEAD]: 0
    });
}

export function planHelicalLayer(machine: WinderMachine, layerParameters: ILayerParameters<THelicalLayer>): void {

    const lockDegrees = 720;
    const deliveryHeadAngleDegrees = layerParameters.parameters.windAngle + 10;

    const mandrelCircumference = Math.PI * layerParameters.mandrelParameters.diameter;
    const towArcLength = layerParameters.towParameters.width / Math.cos(degToRad(layerParameters.parameters.windAngle));
    const numCircuits = Math.ceil(mandrelCircumference / towArcLength);
    const circuitStepDegrees = 360 * (1 / numCircuits);

    const passRotationMM = layerParameters.mandrelParameters.windLength * Math.tan(degToRad(layerParameters.parameters.windAngle));
    const passRotationDegrees = 360 * (passRotationMM / mandrelCircumference);

    console.log(`Doing helical wind, ${numCircuits} circuits`);
    // TODO: move validation/adjustment to a function
    if (numCircuits % layerParameters.parameters.patternNumber !== 0) {
        console.warn(`Circuit number of ${numCircuits} not divisible by pattern number of ${layerParameters.parameters.patternNumber}`);
        return void 0;
    }

    machine.move({
        [ECoordinateAxes.CARRIAGE]: 0,
        [ECoordinateAxes.MANDREL]: -lockDegrees,
        [ECoordinateAxes.DELIVERY_HEAD]: 0
    });
    machine.setPosition({
        [ECoordinateAxes.MANDREL]: 0,
    });

    let mandrelPositionDegrees = 0;
    for (let patternIndex = 0; patternIndex < numCircuits / layerParameters.parameters.patternNumber; patternIndex ++) {
        for(let inPatternIndex = 0; inPatternIndex < layerParameters.parameters.patternNumber; inPatternIndex ++) {
            //TODO: comment this number in the gcode
            const startIndex = patternIndex + (inPatternIndex * numCircuits / layerParameters.parameters.patternNumber);
            // Wind to the start point for this pass, while tilting the delivery head to clean up from last pass
            mandrelPositionDegrees += lockDegrees;
            machine.move({
                [ECoordinateAxes.MANDREL]: -mandrelPositionDegrees,
                [ECoordinateAxes.DELIVERY_HEAD]: 0
            });

            // Tilt delivery head for 'there' pass
            machine.move({
                [ECoordinateAxes.DELIVERY_HEAD]: deliveryHeadAngleDegrees,
            });

            // Wind to the far end of the mandrel
            mandrelPositionDegrees += passRotationDegrees;
            machine.move({
                [ECoordinateAxes.CARRIAGE]: layerParameters.mandrelParameters.windLength,
                [ECoordinateAxes.MANDREL]: -mandrelPositionDegrees
            });

            // Tilt delivery head half way to keep filament controlled
            machine.move({
                [ECoordinateAxes.DELIVERY_HEAD]: 0.5 * deliveryHeadAngleDegrees,
            });
            
            // Tilt delivery head back, rotate mandrel to next start position
            mandrelPositionDegrees += lockDegrees - (passRotationDegrees % 360);
            machine.move({
                [ECoordinateAxes.DELIVERY_HEAD]: 0,
                [ECoordinateAxes.MANDREL]: -mandrelPositionDegrees
            });

            // Tilt delivery head for 'back' pass
            machine.move({
                [ECoordinateAxes.DELIVERY_HEAD]: -deliveryHeadAngleDegrees,
            });

            // Wind back to the near end of the mandrel
            mandrelPositionDegrees += passRotationDegrees;
            machine.move({
                [ECoordinateAxes.CARRIAGE]: 0,
                [ECoordinateAxes.MANDREL]: -mandrelPositionDegrees
            });

            // Tilt delivery head half way to keep filament controlled
            machine.move({
                [ECoordinateAxes.DELIVERY_HEAD]: -0.5 * deliveryHeadAngleDegrees,
            });

            // Make sure that we return to 0
            mandrelPositionDegrees += 360 - (passRotationDegrees % 360);
            // Move to the next pattern number start position
            mandrelPositionDegrees += circuitStepDegrees * numCircuits / layerParameters.parameters.patternNumber;
        }
        mandrelPositionDegrees += circuitStepDegrees;
    }


    mandrelPositionDegrees += lockDegrees;
    machine.move({
        [ECoordinateAxes.MANDREL]: -mandrelPositionDegrees,
        [ECoordinateAxes.DELIVERY_HEAD]: 0,
    });

    machine.setPosition({
        [ECoordinateAxes.CARRIAGE]: 0,
        [ECoordinateAxes.MANDREL]: -(mandrelPositionDegrees % 360),
        [ECoordinateAxes.DELIVERY_HEAD]: 0
    });

    machine.move({
        [ECoordinateAxes.MANDREL]: -360
    });

    machine.setPosition({
        [ECoordinateAxes.MANDREL]: 0
    });
}
