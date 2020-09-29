// canvas-sketch sketch-voronoi-manhattan.js --open --output=export/

//const clustering = require('density-clustering');
//const convexHull = require('convex-hull');
const canvasSketch = require('canvas-sketch');
const load = require('load-asset');

const loadsvg = require('load-svg');
const segments = require('svg-line-segments');
const linearize = require('svg-linearize');

const { polylinesToSVG } = require('canvas-sketch-util/penplot');
import { generatePoints, segmentsEqual, pointsEqual, addSegmentsFromPolys,
   getBMPColor, pointInBMPMask, findMedianDir, directionFromTo, intersectEdges, fitLinesToCanvas } from "./utils.js";
import { voronoiPolysFromPointsAndMask } from "./utils-voronoi.js";
import { fillManhNodesPoints, fillManhCellsLines } from "./utils-manh-voronoi.js";
import { generateL1Voronoi } from "./libs/voronoi.js";
import { config } from "./config.js";

const debug = {
    duplicateSegments: 0
};

const lines = [];
let points;

const generateManhattanVoronoi = (width, height) => {
    const randomPoints = generatePoints(config.randomPointsCount, width, height, config.margin);
    const manhattan = generateL1Voronoi(randomPoints, width, height, true);

    manhattan.forEach(mi =>
    {
        const manhFilteredPolygonPoints = mi.polygonPoints.filter((item, index) => mi.polygonPoints.indexOf(item) == index);
        mi.polygonPoints = manhFilteredPolygonPoints;
    });
    return manhattan;
};

const generateIrisVoronoi = (width, height, bmpMask, eyeOffset) => {
    const randomPoints = generatePoints(config.irisVoroGenPointsCount, width, height, config.margin);
    const irisMaskFunc = entry => pointInBMPMask(entry, width, height, config.margin, bmpMask, [0], eyeOffset);

    const irisPolys = voronoiPolysFromPointsAndMask(randomPoints, width, height, config.margin, irisMaskFunc);
    const maskedPoints = randomPoints.filter(entry => pointInBMPMask(entry, width, height, config.margin, bmpMask, [0], eyeOffset));

    return { allPoints: randomPoints, maskedPoints: maskedPoints, polys: irisPolys };
};

const addLinesCutWithContourAndMask = (linesToCut, contourLines, maskFunc, linesOut) => {
    for (let i = 0; i < linesToCut.length; ++i)
    {
        let intersection = false;
        for (let j = 0; j < contourLines.length; ++j)
        {
            intersection = intersectEdges(linesToCut[i], contourLines[j]);
            if (intersection) break;
        }

        const p0InMask = maskFunc(linesToCut[i][0]);
        const p1InMask = maskFunc(linesToCut[i][1]);

        if (!p0InMask && !p1InMask && !intersection)
        {
            linesOut.push(linesToCut[i]);
        }
        else if (intersection)
        {
            if (!p0InMask && p1InMask) linesOut.push([linesToCut[i][0], intersection]);
            else if (!p1InMask && p0InMask) linesOut.push([linesToCut[i][1], intersection]);
        }
    }
};

const distSq = (a, b) =>
{
    const d = [a[0] - b[0], a[1] - b[1]];
    return d[0]*d[0] + d[1]*d[1];
}

const dist = (a, b) =>
{
    return Math.sqrt(distSq(a, b));
}

const fancyIrisMaths = (linesIn, linesOut, tearCenterPolyline, tearMaskFunc) =>
{
    const sexyEyeLines = [];
    const allPoints = [];
    let center = [0, 0];
    linesIn.forEach(l => {
        allPoints.push(l[0]);
        allPoints.push(l[1]);
        center[0] += l[0][0];
        center[0] += l[1][0];
        center[1] += l[0][1];
        center[1] += l[1][1];
    })
    center[0] /= allPoints.length;
    center[1] /= allPoints.length;

    let maxRSq = 0;
    let minRSq = 66666666.1;
    allPoints.forEach(p => {
        const d = distSq(p, center);
        maxRSq = Math.max(maxRSq, d);
        minRSq = Math.min(minRSq, d);
    });

    const rMax = Math.sqrt(maxRSq);
    const rMin = Math.sqrt(minRSq);
    const r = rMax - rMin;

    let edgeCircleDist = 0;
    let innerCirclePointsCount = 0;
    linesIn.forEach(l => {
        const d1 = dist(l[0], center) - rMin;
        const d2 = dist(l[1], center) - rMin;
        const minD = Math.min(d1, d2);
        const maxD = Math.max(d1, d2);
        const toCenter = directionFromTo(l[0], center);
        const dir = directionFromTo(l[0], l[1]);
        const isDirTangent = Math.abs(toCenter[0] * dir[0] + toCenter[1] * dir[1]) < 0.4;

        if (isDirTangent && minD > r * 0.4 && maxD < r * 0.66)
        {
            edgeCircleDist += (d1 + d2);
            innerCirclePointsCount += 2;
        }
    });
    edgeCircleDist /= innerCirclePointsCount;
    const distToEdge = edgeCircleDist + 0.0 * r;

    if (config.debugShowIrisOrigVoro)
    {
        linesIn.forEach(l => linesOut.push(l));
        return;
    }
    if (config.debugShowIrisOrigVoroCutWithContour)
    {
        linesIn.forEach(l => sexyEyeLines.push(l));
        addLinesCutWithContourAndMask(sexyEyeLines, tearCenterPolyline, tearMaskFunc, linesOut);
        return;
    }

    linesIn.forEach(l => {
        const d1 = dist(l[0], center) - rMin;
        const d2 = dist(l[1], center) - rMin;
        const minD = Math.min(d1, d2);
        const maxD = Math.max(d1, d2);
        const toCenter1 = directionFromTo(l[0], center);
        const toCenter2 = directionFromTo(l[1], center);
        const dir = directionFromTo(l[0], l[1]);
        const isDirTangent = Math.abs(toCenter1[0] * dir[0] + toCenter1[1] * dir[1]) < 0.4;
        const d1ToEdge = Math.abs(d1 - edgeCircleDist);
        const d2ToEdge = Math.abs(d2 - edgeCircleDist);

        const offsettedP1 = [l[0][0] + toCenter1[0] * distToEdge, l[0][1] + toCenter1[1] * distToEdge - 0.08];
        const offsettedP2 = [l[1][0] + toCenter2[0] * distToEdge, l[1][1] + toCenter2[1] * distToEdge - 0.08];

        if (isDirTangent && d1ToEdge < r*0.1 && d2ToEdge < r*0.1) // center edge - not needed
        {
            return;
        }

        if (d1ToEdge > r * 0.1 && d2ToEdge > r * 0.1 && minD > distToEdge) // outer decor
        {
            sexyEyeLines.push(l);
            return;
        }

        const rngDist = Math.random() * distToEdge * 0.8;
        const outerOffsettedP1 = [
            l[0][0] + toCenter1[0] * rngDist,
            l[0][1] + toCenter1[1] * rngDist - 0.08
        ];
        const outerOffsettedP2 = [
            l[1][0] + toCenter2[0] * rngDist,
            l[1][1] + toCenter2[1] * rngDist - 0.08
        ];
        if (minD > distToEdge - 0.1 && maxD > distToEdge + 0.1) // onEdge-outer
        {
            if (d1 < d2) sexyEyeLines.push([outerOffsettedP1, l[1]]);
            else sexyEyeLines.push([outerOffsettedP2, l[0]]);

            return;
        }

        if (maxD < r * 0.4)
        {
            sexyEyeLines.push(l);
        }
    });

    addLinesCutWithContourAndMask(sexyEyeLines, tearCenterPolyline, tearMaskFunc, linesOut);
};

let eye_contour_svg;
let tear_center_svg;
let tear_edge_svg;
let decor_svg;
loadsvg('assets/eye_contour.svg', async(err, svg) => {
  eye_contour_svg = await segments(await linearize(svg, { tolerance: 0 }));
});
loadsvg('assets/tear_center.svg', async(err, svg) => {
  tear_center_svg = await segments(await linearize(svg, { tolerance: 0 }));
});
loadsvg('assets/tear_edge.svg', async(err, svg) => {
  tear_edge_svg = await segments(await linearize(svg, { tolerance: 0 }));
});
loadsvg('assets/decor.svg', async(err, svg) => {
  decor_svg = await segments(await linearize(svg, { tolerance: 0 }));
});


const sketch = async ({ width, height, units, render }) => {

    const img_eye_base = await load('assets/eye_base.png');
    const canvas = document.createElement('canvas');
    canvas.width = config.img_size;
    canvas.height = config.img_size;
    const tmpContext = canvas.getContext('2d');
    tmpContext.imageSmoothingEnabled = false;
    tmpContext.clearRect(0, 0, config.img_size, config.img_size);
    tmpContext.drawImage(img_eye_base, 0, 0, config.img_size, config.img_size);
    const eye_base_bmp = tmpContext.getImageData(0, 0, config.img_size, config.img_size);

    const img_eye_iris = await load('assets/eye_iris.png');
    tmpContext.clearRect(0, 0, config.img_size, config.img_size);
    tmpContext.drawImage(img_eye_iris, 0, 0, config.img_size, config.img_size);
    const eye_iris_bmp = tmpContext.getImageData(0, 0, config.img_size, config.img_size);

    const eye_base_contour = [];
    const tear_center_polyline = [];
    const mapSegCoords = (seg, offset) => {
        const x = (seg[0] / config.img_size) * (width - config.eye_outer_margin*2) + config.eye_outer_margin + offset[0];
        const y = (seg[1] / config.img_size) * (height - config.eye_outer_margin*2) + config.eye_outer_margin + offset[1];
        return [x, y];
    }

    eye_contour_svg.forEach(seg => {
        for (let i = 0; i < seg.length; ++i)
        {
            const contourLine = [mapSegCoords(seg[i], config.eye_offset), mapSegCoords(seg[(i + 1) % seg.length], config.eye_offset)];
            if (config.showSvgContours) lines.push(contourLine);
            eye_base_contour.push(contourLine);
        }
    });
    tear_center_svg.forEach(seg => {
        for (let i = 0; i < seg.length - 1; ++i)
        {
            const contourLine = [mapSegCoords(seg[i], config.eye_offset), mapSegCoords(seg[(i + 1) % seg.length], config.eye_offset)];
            if (config.showSvgContours) lines.push(contourLine);
            tear_center_polyline.push(contourLine);
        }
    });
    tear_edge_svg.forEach(seg => {
        for (let i = 0; i < seg.length - 1; ++i)
        {
            if (config.showSvgContours) lines.push([mapSegCoords(seg[i], config.eye_offset), mapSegCoords(seg[(i + 1) % seg.length], config.eye_offset)]);
        }
    });
    decor_svg.forEach(seg => {
        for (let i = 0; i < seg.length - 1; ++i)
        {
             if (config.showSvgContours) lines.push([mapSegCoords(seg[i], config.eye_offset), mapSegCoords(seg[(i + 1) % seg.length], config.eye_offset)]);
        }
    });

    const linesManh = [];
    const manh = generateManhattanVoronoi(width, height);
    //fillManhNodesPoints(manh, points);
    fillManhCellsLines(manh, config.innerCellRadiusMargin, linesManh, width, height);
    const manhMaskFunc = point => pointInBMPMask(point, width, height, config.eye_outer_margin, eye_base_bmp, [0, 1], config.eye_offset);
    addLinesCutWithContourAndMask(linesManh, eye_base_contour, manhMaskFunc, lines);

    // DEBUG: no eye mask
    // const manhMaskFunc = point => false;
    // addLinesCutWithContourAndMask(linesManh, [], manhMaskFunc, lines);

    let irisVoroGenResult;
    const genIrisLines = config.showIris || config.debugShowIrisOrigVoro || config.debugShowIrisOrigVoroCutWithContour;
    if (genIrisLines || config.debugShowIrisAllPoints || config.debugShowIrisMaskedPoints)
    {
        const linesIrisBase = [];
        const linesIris = [];
        irisVoroGenResult = generateIrisVoronoi(width, height, eye_iris_bmp, config.eye_offset);
        const irisPolys = irisVoroGenResult.polys;

        if (genIrisLines)
        {
            addSegmentsFromPolys(irisVoroGenResult.polys.partiallyInside, linesIrisBase, [0, 0], debug);
            addSegmentsFromPolys(irisVoroGenResult.polys.fullyOutside, linesIrisBase, [0, 0], debug);
            const irisMaskFunc = point => !pointInBMPMask(point, width, height, config.eye_outer_margin, eye_base_bmp, [2], config.eye_offset);
            const tearMaskFunc = point => pointInBMPMask(point, width, height, config.eye_outer_margin, eye_base_bmp, [1], config.eye_offset);
            addLinesCutWithContourAndMask(linesIrisBase, eye_base_contour, irisMaskFunc, linesIris);
            fancyIrisMaths(linesIris, lines, tear_center_polyline, tearMaskFunc);
        }
    }

    let linesToDraw = lines;
    if (config.shrinkToCanvas)
    {
        linesToDraw = fitLinesToCanvas(lines, width, height);
    }
    
return ({ context }) => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);

    linesToDraw.forEach(line => {
      context.beginPath();
      line.forEach(p => context.lineTo(p[0], p[1]));
      context.strokeStyle = 'black';
      context.lineWidth = config.penThicknessCm;
      context.lineJoin = 'round';
      context.lineCap = 'round';
      context.stroke();
    });

    if (config.debugShowIrisAllPoints) {
       irisVoroGenResult.allPoints.forEach(p => {
        context.beginPath();
        context.arc(p[0], p[1], 0.02, 0, Math.PI * 2);
        context.strokeStyle = context.fillStyle = 'red';
        context.lineWidth = config.penThicknessCm;
        context.fill();
      });
    }
    if (config.debugShowIrisMaskedPoints) {
       irisVoroGenResult.maskedPoints.forEach(p => {
        context.beginPath();
        context.arc(p[0], p[1], 0.02, 0, Math.PI * 2);
        context.strokeStyle = context.fillStyle = 'green';
        context.lineWidth = config.penThicknessCm;
        context.fill();
      });
    }

    return [
      context.canvas,
      {
        data: polylinesToSVG(linesToDraw, { width, height, units } ),
        extension: '.svg'
      }
    ];
  };
};
canvasSketch(sketch, {
  dimensions: [ 13, 13 ],
  pixelsPerInch: 300,
  units: 'cm',
});
