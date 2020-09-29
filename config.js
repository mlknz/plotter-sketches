export const config =
{
    // generation
    randomPointsCount: 666,
    irisVoroGenPointsCount: 42069,

    // masks
    svgSize: 256,
    img_size: 512,

    // margins
    margin: 0.5,
    eye_outer_margin: 0.5,
    eye_offset: [0, 2.4],

    // emotion
    penThicknessCm: 0.01,

    // logic
    shrinkToCanvas: true,
    showSvgContours: true,
    showIris: true,
    cutManhWithContourAndMask: true,

    innerCellRadiusMargin: 0.06,
    manhInnerCellSingleContour: false,
    manhInnerCellContours: true,
    manhTriangleShape: true,
    manhCellUniformDistortion: 0.0,
    manhCellHeightDistortion: 1.6,
    manhEdgeUniformDistortion: 0.0,
    manhEdgeHeightDistortion: 0.0,

    // stages
    debugShowIrisOrigVoro: false,
    debugShowIrisOrigVoroCutWithContour: false,

    // show points
    debugShowManhAllPoints: false,
    debugShowManhIntersectionFilteredPoints: false,
    debugShowIrisAllPoints: false,
    debugShowIrisMaskedPoints: false,
};
