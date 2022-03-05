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
    HELICAL = 'helical'
}

export type THoopLayer = {
    windType: ELayerType.HOOP;
}

export type THelicalLayer = {
    windType: ELayerType.HELICAL;
    windAngle: number;
} 

export type TLayerParameters = THoopLayer | THelicalLayer;

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
