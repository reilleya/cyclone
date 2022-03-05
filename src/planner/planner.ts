import type { IWindParameters, IMandrelParameters, ITowParameters, ILayerParameters, THelicalLayer, THoopLayer } from './types';
import { ELayerType } from './types';
import { WinderMachine } from './machine';

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
    const windAngle = 90 - (Math.atan(layerParameters.mandrelParameters.diameter / layerParameters.towParameters.width) * 180 / Math.PI);
    const mandrelRotatations = layerParameters.mandrelParameters.windLength / layerParameters.towParameters.width;
    const farMandrelPositionDegrees = lockDegrees + (mandrelRotatations * 360);
    const farLockPositionDegrees = farMandrelPositionDegrees + lockDegrees;
    const nearMandrelPositionDegrees = farLockPositionDegrees + (mandrelRotatations * 360);
    const nearLockPositionDegrees = nearMandrelPositionDegrees + lockDegrees;

    // Do a small near lock
    machine.addRawGCode(`G0 X0 Y${-lockDegrees} Z0`);
    // Tilt delivery head
    machine.addRawGCode(`G0 Z${windAngle}`);
    // Wind to the far end of the mandrel
    machine.addRawGCode(`G0 X${layerParameters.mandrelParameters.windLength} Y${-farMandrelPositionDegrees}`);
    // Do a small far lock
    machine.addRawGCode(`G0 X${layerParameters.mandrelParameters.windLength} Y${-farLockPositionDegrees} Z0`);
    // Tilt delivery head
    machine.addRawGCode(`G0 Z${-1 * windAngle}`);
    // Wind to the near end of the mandrel
    machine.addRawGCode(`G0 X0 Y${-nearMandrelPositionDegrees}`);
    // Do a small near lock
    machine.addRawGCode(`G0 X0 Y${-nearMandrelPositionDegrees} Z0`);
    machine.addRawGCode('G92 X0 Y0 Z0');
}

export function planHelicalLayer(machine: WinderMachine, layerParameters: ILayerParameters<THelicalLayer>): void {
    machine.addRawGCode(`G0 X0 Y${layerParameters.parameters.windAngle} Z0`);
}
