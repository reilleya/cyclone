import type { IWindParameters, IMandrelParameters, ITowParameters, ILayerParameters, THelicalLayer, THoopLayer } from './types';
import { ECoordinateAxes } from './types';
import { ELayerType } from './types';
import { WinderMachine } from './machine';
import { radToDeg, degToRad } from '../helpers'; 

export function planWind(windingParameters: IWindParameters): string[] {

    const machine = new WinderMachine();

    const headerParameters = {
        mandrel: windingParameters.mandrelParameters,
        tow: windingParameters.towParameters
    }
    machine.insertComment(`Parameters ${JSON.stringify(headerParameters)}`);
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

    console.log(`Rough time estimate: ${machine.getGCodeTimeS()} seconds`);

    return machine.getGCode();
}

// Each layer planning function is responsible for a there-and-back and resetting the coordinates to (0, 0, 0) at the end

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
        [ECoordinateAxes.MANDREL]: lockDegrees,
        [ECoordinateAxes.DELIVERY_HEAD]: 0
    });
    // Tilt delivery head
    machine.move({
        [ECoordinateAxes.DELIVERY_HEAD]: -windAngle
    });
    // Wind to the far end of the mandrel
    machine.move({
        [ECoordinateAxes.CARRIAGE]: layerParameters.mandrelParameters.windLength,
        [ECoordinateAxes.MANDREL]: farMandrelPositionDegrees
    });
    // Do a small far lock
    machine.move({
        [ECoordinateAxes.MANDREL]: farLockPositionDegrees,
        [ECoordinateAxes.DELIVERY_HEAD]: 0
    });
    // Tilt delivery head
    machine.move({
        [ECoordinateAxes.DELIVERY_HEAD]: windAngle,
    });
    // Wind to the near end of the mandrel
    machine.move({
        [ECoordinateAxes.CARRIAGE]: 0,
        [ECoordinateAxes.MANDREL]: nearMandrelPositionDegrees
    });
    // Do a small near lock
    machine.move({
        [ECoordinateAxes.MANDREL]: nearLockPositionDegrees,
        [ECoordinateAxes.DELIVERY_HEAD]: 0
    });
    machine.zeroAxes(nearLockPositionDegrees);
}

export function planHelicalLayer(machine: WinderMachine, layerParameters: ILayerParameters<THelicalLayer>): void {
    // TODO: move to config values or remove?
    const deliveryHeadPassStartAngle = -10;

    // The portion of each lock that the delivery head rotates back to level during
    const leadOutDegrees = layerParameters.parameters.leadOutDegrees;
    // The portion of the pass on each end during which the delivery head rotates into place
    const windLeadInMM = layerParameters.parameters.leadInMM;
    // The number of degrees that the mandrel rotates through at the ends of each circuit
    const lockDegrees = layerParameters.parameters.lockDegrees;
    // The angle that the delivery head is commanded to during a "there" pass
    const deliveryHeadAngleDegrees = -1 * (90 - layerParameters.parameters.windAngle);
    // Self explanatory
    const mandrelCircumference = Math.PI * layerParameters.mandrelParameters.diameter;
    // Given the tow width and wind angle, what width will one pass of tow occupy when wrapped onto the mandrel
    const towArcLength = layerParameters.towParameters.width / Math.cos(degToRad(layerParameters.parameters.windAngle));
    // Divide the circumference by the tow arc length to get the number of circuits to cover the surface
    // Note that each circuit includes a "there" and a "back" portion, and including both this number of circuits will
    // cover the mandrel twice
    const numCircuits = Math.ceil(mandrelCircumference / towArcLength);
    // After each pattern (<pattern number> cycles evenly spaced around the mandrel) how much to rotate the mandrel
    const patternStepDegrees = 360 * (1 / numCircuits);
    // How many MM the surface of the mandrel should move per pass based on the length and wind angle
    const passRotationMM = layerParameters.mandrelParameters.windLength * Math.tan(degToRad(layerParameters.parameters.windAngle));
    // How many degrees the mandrel should rotate in a pass
    const passRotationDegrees = 360 * (passRotationMM / mandrelCircumference);
    // The number of degrees of mandrel rotation per MM of carriage movement during winding
    const passDegreesPerMM = passRotationDegrees / layerParameters.mandrelParameters.windLength;
    // The number of "start positions", evenly spaced around the mandrel
    const patternNumber = layerParameters.parameters.patternNumber;
    // The number of patterns that will be completed to cover the mandrel
    const numberOfPatterns = numCircuits / layerParameters.parameters.patternNumber;
    // The number of degrees to rotate the mandrel during the lead in
    const leadInDegrees = passDegreesPerMM * windLeadInMM;
    // The number of degrees to rotate the mandrel during the middle (non-leadin) part of a pass
    const mainPassDegrees = passDegreesPerMM * (layerParameters.mandrelParameters.windLength - windLeadInMM);
    // Compute parameters specific to each pass direction
    const passParameters = [
        { // There pass
            deliveryHeadSign: 1,
            leadInEndMM: windLeadInMM,
            fullPassEndMM: layerParameters.mandrelParameters.windLength,
        },
        { // Back pass
            deliveryHeadSign: -1,
            leadInEndMM: layerParameters.mandrelParameters.windLength - windLeadInMM,
            fullPassEndMM: 0,
        }
    ]

    console.log(`Doing helical wind, ${numCircuits} circuits`);
    // TODO: move validation/adjustment to a function
    if (numCircuits % layerParameters.parameters.patternNumber !== 0) {
        console.warn(`Circuit number of ${numCircuits} not divisible by pattern number of ${layerParameters.parameters.patternNumber}`);
        return void 0;
    }

    machine.move({
        [ECoordinateAxes.CARRIAGE]: 0,
        [ECoordinateAxes.MANDREL]: lockDegrees,
        [ECoordinateAxes.DELIVERY_HEAD]: 0
    });
    machine.setPosition({
        [ECoordinateAxes.MANDREL]: 0,
    });

    let mandrelPositionDegrees = 0;
    // The outer loop tracks the number of times we complete the pattern on the mandrel
    for (let patternIndex = 0; patternIndex < numberOfPatterns; patternIndex ++) {
        // The inner loop tracks the <pattern number> evenly-spaced start positions around the mandrel in each pattern
        for(let inPatternIndex = 0; inPatternIndex < patternNumber; inPatternIndex ++) {
            machine.insertComment(`Pattern: ${patternIndex + 1}/${numberOfPatterns} Circuit: ${inPatternIndex + 1}/${patternNumber}`);

            for (let passParams of passParameters) {
                // Wind to the start point for this pass, while tilting the delivery head to clean up from last pass
                machine.move({
                    [ECoordinateAxes.MANDREL]: mandrelPositionDegrees,
                    [ECoordinateAxes.DELIVERY_HEAD]: 0
                });

                // Tilt delivery head to the start position for the pass
                machine.move({
                    [ECoordinateAxes.DELIVERY_HEAD]: passParams.deliveryHeadSign * deliveryHeadPassStartAngle,
                });

                // Wind through the pass lead in, tilting the delivery head into final position
                mandrelPositionDegrees += leadInDegrees;
                machine.move({
                    [ECoordinateAxes.CARRIAGE]: passParams.leadInEndMM,
                    [ECoordinateAxes.MANDREL]: mandrelPositionDegrees,
                    [ECoordinateAxes.DELIVERY_HEAD]: passParams.deliveryHeadSign * deliveryHeadAngleDegrees,
                });

                // Wind to the end of the pass
                mandrelPositionDegrees += mainPassDegrees;
                machine.move({
                    [ECoordinateAxes.CARRIAGE]: passParams.fullPassEndMM,
                    [ECoordinateAxes.MANDREL]: mandrelPositionDegrees
                });

                // Wind through the pass lead in, tilting the delivery head into final position
                mandrelPositionDegrees += leadOutDegrees;
                machine.move({
                    [ECoordinateAxes.MANDREL]: mandrelPositionDegrees,
                    [ECoordinateAxes.DELIVERY_HEAD]: passParams.deliveryHeadSign * deliveryHeadPassStartAngle,
                });

                mandrelPositionDegrees += lockDegrees - leadOutDegrees - (passRotationDegrees % 360);
            }

            // Move to the next start position in this pattern
            mandrelPositionDegrees += patternStepDegrees * numCircuits / layerParameters.parameters.patternNumber;
        }

        // Move to the next pattern start position
        mandrelPositionDegrees += patternStepDegrees;
    }

    mandrelPositionDegrees += lockDegrees;
    machine.move({
        [ECoordinateAxes.MANDREL]: mandrelPositionDegrees,
        [ECoordinateAxes.DELIVERY_HEAD]: 0,
    });

    machine.zeroAxes(mandrelPositionDegrees);
}
