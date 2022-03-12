import type { IWindParameters, IMandrelParameters, ITowParameters, ILayerParameters, THelicalLayer, THoopLayer } from './types';
import { ECoordinateAxes } from './types';
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
    machine.addRawGCode(`G0 X0 Y${layerParameters.parameters.windAngle} Z0`);
}
