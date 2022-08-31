/**
 * General parameters
 */

export interface IMandrelParameters {
    diameter: number;
    windLength: number;
}

export interface ITowParameters {
    width: number;
    thickness: number;
}

/**
 * Layer-specific parameters
 */

export const enum ELayerType {
    HOOP = 'hoop',
    HELICAL = 'helical',
    SKIP = 'skip'
}

export type THoopLayer = {
    windType: ELayerType.HOOP;
    terminal: boolean; // Is this a one-way hoop layer, or are there other layers afterwards?
}

export type THelicalLayer = {
    windType: ELayerType.HELICAL;
    windAngle: number; // The complement of the angle between the mandrel axis and the wound tow
    patternNumber: number; // The number of "start positions", evenly spaced around the mandrel
    skipIndex: number; // The increment applied when deciding the next start position
    lockDegrees: number; // The number of degrees that the mandrel rotates through at the ends of each circuit
    leadInMM: number; // The portion of the pass on each end during which the delivery head rotates into place
    leadOutDegrees: number; // The portion of each lock that the delivery head rotates back to level during
    skipInitialNearLock: boolean | undefined; // For sequences of multiple helical layers, skip the extra near lock
}

export type TSkipLayer = {
    windType: ELayerType.SKIP;
    mandrelRotation: number;
}

export type TLayerParameters = THoopLayer | THelicalLayer | TSkipLayer;

export interface ILayerParameters<TLayerSpecificParameters extends TLayerParameters> {
    parameters: TLayerSpecificParameters;
    mandrelParameters: IMandrelParameters;
    towParameters: ITowParameters;
}

/**
 * Whole wind definition
 */

export interface IWindParameters {
    layers: TLayerParameters[];
    mandrelParameters: IMandrelParameters;
    towParameters: ITowParameters;
    defaultFeedRate: number;
}


/**
 *  Helpers types
 */

export const enum ECoordinateAxes {
    CARRIAGE = 'carriage',
    MANDREL = 'mandrel',
    DELIVERY_HEAD = 'deliveryHead'
}

export type TCoordinateAxes = Record<ECoordinateAxes, number>;

export type AtLeastOne<T, U = {[K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

export type TCoordinate = AtLeastOne<TCoordinateAxes>;

export const AxisLookup: Record<keyof TCoordinateAxes, string> = {
    [ECoordinateAxes.CARRIAGE]: 'X',
    [ECoordinateAxes.MANDREL]: 'Y',
    [ECoordinateAxes.DELIVERY_HEAD]: 'Z'
}
