// canvas-sketch sketch-voronoi-manhattan.js --open --output=export/

//const clustering = require('density-clustering');
//const convexHull = require('convex-hull');
const canvasSketch = require('canvas-sketch');
const load = require('load-asset');

const loadsvg = require('load-svg');
const segments = require('svg-line-segments');
const linearize = require('svg-linearize');

const { polylinesToSVG } = require('canvas-sketch-util/penplot');
import { generatePoints, segmentsEqual, pointsEqual, addSegmentsFromPolys, getBMPColor, pointInBMPMask } from "./utils.js";
import { voronoiPolysFromPointsAndMask } from "./utils-voronoi.js";

// working L1 voronoi gen is currently in https://github.com/mlknz/manhattan-voronoi (fix_points_nudge branch)
// use manhattan-voronoi npm module after fix merge
import { generateL1Voronoi } from "C:\\libs\\manhattan-voronoi\\src\\voronoi.js";

const debug = {
    drawPoints: false,
    duplicateSegments: 0
};
const img_size = 512;
const svgSize = 256;
const penThicknessCm = 0.01;

const randomPointsCount = 130;
const margin = 0.5;
const eye_outer_margin = 1.0;
const innerCellRadiusMargin = 0.125;
const lines = [];
const points = [];

const manhDist = (a, b) => {
    return Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
};

const manhPerimeter = (poly) => {
    let result = 0;
    for (let i = 1; i < poly.length; ++i)
    {
        const a = poly[i];
        const b = poly[i - 1];
        result += manhDist(a, b);
    }
    result += manhDist(poly[0], poly[poly.length - 1]);
    return result;
};

const generateManhattanVoronoi = (width, height) => {
    const randomPoints = generatePoints(randomPointsCount, width, height, margin);
    const manhattan = generateL1Voronoi(randomPoints, width, height, true);

    manhattan.forEach(mi =>
    {
        const manhFilteredPolygonPoints = mi.polygonPoints.filter((item, index) => mi.polygonPoints.indexOf(item) == index);
        mi.polygonPoints = manhFilteredPolygonPoints;
    })

    return manhattan;
};

const fillManhNodesPoints = (manh) => {
    manh.forEach(mi =>
        mi.polygonPoints.forEach(pp => {
            let isCloseToOther = false;
            for (let k = 0; k < points.length; ++k)
            {
                const dx = pp[0] - points[k][0];
                const dy = pp[1] - points[k][1];
                if (Math.abs(dx*dx + dy*dy) < 0.05)
                {
                    isCloseToOther = true;
                }
            }
            if (!isCloseToOther) points.push(pp);
        })
    );
};

const addPolygonLines = (polygonPoints) => {
    for (let j = 0; j < polygonPoints.length; ++j)
    {
          const jNext = (j + 1) % polygonPoints.length;
          const p1 = polygonPoints[j];
          const p2 = polygonPoints[jNext];
          lines.push([p1, p2]);
    }
};

const normalizeManh = (d) => {
    const l = Math.abs(d[0]) + Math.abs(d[1]);
    return [d[0] / l, d[1] / l];
};

const normalize = (d) => {
    const l = Math.sqrt(d[0]*d[0] + d[1]*d[1]);
    return [d[0] / l, d[1] / l];
};

const findDiffDir = (a, b) => {
    return normalize([b[0] - a[0], b[1] - a[1]]);
};

const findMedianDir = (a, b, c) => {
    let ba = findDiffDir(b, a);
    let bc = findDiffDir(b, c);

    return normalize([ba[0] + bc[0], ba[1] + bc[1]]);
};

const cross2d = (v, w) => {
    return v[0] * w[1] - v[1] * w[0];
};

const intersectEdges = (a, b) => {
    const a0x = a[0][0];
    const a0y = a[0][1];
    const a1x = a[1][0];
    const a1y = a[1][1];
    const b0x = b[0][0];
    const b0y = b[0][1];
    const b1x = b[1][0];
    const b1y = b[1][1];

    if (Math.max(a0x, a1x) <= Math.min(b0x, b1x)
         || Math.min(a0x, a1x) >= Math.max(b0x, b1x)
         || Math.max(a0y, a1y) <= Math.min(b0y, b1y)
         || Math.min(a0y, a1y) >= Math.max(b0y, b1y))
    {
        return false;
    }
    const aDir = findDiffDir(a[0], a[1]);
    const bDir = findDiffDir(b[0], b[1]);

    const abDot = aDir[0] * bDir[0] + aDir[1] * bDir[1];
    if (Math.abs(abDot) > 0.999)
    {
        return false;
    }

    const aDirUnnorm = [a1x - a0x, a1y - a0y];
    const bDirUnnorm = [b1x - b0x, b1y - b0y];
    const t = cross2d([b0x - a0x, b0y - a0y], bDirUnnorm) / cross2d(aDirUnnorm, bDirUnnorm);
    const u = cross2d([a0x - b0x, a0y - b0y], aDirUnnorm) / cross2d(bDirUnnorm, aDirUnnorm);
    if (isNaN(t) || isNaN(u) || t < 0 || t > 1 || u < 0 || u > 1)
    {
        return false;
    }
    return [a0x + aDirUnnorm[0] * t, a0y + aDirUnnorm[1] * t];
};

const doPolygonsIntersect = (polyOne, polyTwo) => {
    for (let i = 0; i < polyOne.length; ++i)
    {
        for (let j = 0; j < polyTwo.length; ++j)
        {
            const edgeOne = [ polyOne[i], polyOne[(i+1)%polyOne.length] ];
            const edgeTwo = [ polyTwo[j], polyTwo[(j+1)%polyTwo.length] ];
            if (intersectEdges(edgeOne, edgeTwo))
            {
                return true;
            }
        }
    }
    return false;
};

const splitPolySelfIntersections = (polyPoints, outPolygons) => {
    let i, j;
    let intersection = false;
    for (i = 2; i < polyPoints.length; ++i)
    {
        for (j = 1; j < i - 1; ++j)
        {
            const edgeA = [polyPoints[i - 1], polyPoints[i]];
            const edgeB = [polyPoints[j - 1], polyPoints[j]];
            intersection = intersectEdges(edgeA, edgeB);

            if (intersection) break;
        }
        if (intersection) break;
    }

    if (!intersection)
    {
        i = 0;
        const edgeA = [polyPoints[0], polyPoints[polyPoints.length - 1]];
        for (j = 2; j < polyPoints.length - 1; ++j)
        {
            const edgeB = [polyPoints[j - 1], polyPoints[j]];
            intersection = intersectEdges(edgeA, edgeB);
            if (intersection) break;
        }

        if (!intersection)
        {
            outPolygons.push(polyPoints);
            return;
        }
    }

    const polyA = [];
    for (let k = 0; k < j; ++k)
    {
        polyA.push(polyPoints[k]);
    }
    polyA.push(intersection);
    if (i > 0)
    {
        for (let k = i; k < polyPoints.length; ++k)
        {
            polyA.push(polyPoints[k]);
        }
    }

    const polyB = [ intersection ];
    if (i < j) i = polyPoints.length;
    for (let k = j; k < i; ++k)
    {
        polyB.push(polyPoints[k]);
    }

    splitPolySelfIntersections(polyA, outPolygons);
    splitPolySelfIntersections(polyB, outPolygons);
};

const generateInnerCellContour = (polyPoints, polyCenter, desiredInnerMargin, polysToTestIntersection) => {
    const innerPolyPoints = [];
    for (let i = 0; i < polyPoints.length; ++i)
    {
          const j = (i + 1) % polyPoints.length;
          const k = (i + 2) % polyPoints.length;
          const a = polyPoints[i];
          const b = polyPoints[j];
          const c = polyPoints[k];
          const abManhDist = manhDist(a, b);
          const bcManhDist = manhDist(b, c);

          const medianDir = findMedianDir(a, b, c);
          const bc = findDiffDir(b, c);

          const cos = medianDir[0] * bc[0] + medianDir[1] * bc[1];
          const sin = Math.sqrt(1.0 - cos*cos);
          const _innerMargin = desiredInnerMargin / Math.max(sin, 0.00000001);

          const candidateNumberOne = [b[0] + medianDir[0] * _innerMargin, b[1] + medianDir[1] * _innerMargin];
          const candidateNumberTwo = [b[0] - medianDir[0] * _innerMargin, b[1] - medianDir[1] * _innerMargin];

          const manhDist1 = manhDist(polyCenter, candidateNumberOne);
          const manhDist2 = manhDist(polyCenter, candidateNumberTwo);

          const innerPoint = manhDist1 < manhDist2 ? candidateNumberOne : candidateNumberTwo;

          innerPolyPoints.push(innerPoint);
    }

    const innerPolygons = [];
    splitPolySelfIntersections(innerPolyPoints, innerPolygons);

    if (innerPolygons.length == 0)
    {
        return [];
    }
    innerPolygons.sort((polyA, polyB) => { return -(manhPerimeter(polyA) - manhPerimeter(polyB)); })
    for (let i = 0; i < innerPolygons.length; ++i)
    {
        let intersectsSomeShit = false;
        polysToTestIntersection.forEach(poly => intersectsSomeShit |= doPolygonsIntersect(innerPolygons[i], poly));
        if (!intersectsSomeShit)
        {
            return innerPolygons[i];
        }
    }

    return [];
};

const fillManhCellsLines = (manh) => {
    manh.forEach(mi => {
        const innerPoly = generateInnerCellContour(mi.polygonPoints, mi.site, innerCellRadiusMargin, [ mi.polygonPoints ]);
        const innerPoly2 = generateInnerCellContour(mi.polygonPoints, mi.site, innerCellRadiusMargin * 2, [ mi.polygonPoints, innerPoly ]);
        const innerPoly3 = generateInnerCellContour(mi.polygonPoints, mi.site, innerCellRadiusMargin * 3, [ mi.polygonPoints, innerPoly, innerPoly2 ]);

        addPolygonLines(mi.polygonPoints);
        addPolygonLines(innerPoly);
        addPolygonLines(innerPoly2);
        addPolygonLines(innerPoly3);
    });
};

let eye_contour_svg;
loadsvg('assets/eye_contour.svg', async(err, svg) => {
  eye_contour_svg = await segments(await linearize(svg, { tolerance: 0 }));
});


const sketch = async ({ width, height, units, render }) => {

    const img_eye_base = await load('assets/eye_base.png');
    const canvas = document.createElement('canvas');
    canvas.width = img_size;
    canvas.height = img_size;
    const tmpContext = canvas.getContext('2d');
    tmpContext.imageSmoothingEnabled = false;
    tmpContext.clearRect(0, 0, img_size, img_size);
    tmpContext.drawImage(img_eye_base, 0, 0, img_size, img_size);
    const eye_base_bmp = tmpContext.getImageData(0, 0, img_size, img_size);
    console.log(eye_base_bmp);

    const manh = generateManhattanVoronoi(width, height);
    fillManhNodesPoints(manh);
    fillManhCellsLines(manh);
    const linesEyeCut = [];
    const eye_base_contour = [];
    const mapSegCoords = (seg, offset) => {
        const x = (seg[0] / img_size) * (width - eye_outer_margin*2) + eye_outer_margin + offset[0];
        const y = (seg[1] / img_size) * (height - eye_outer_margin*2) + eye_outer_margin + offset[1];
        return [x, y];
    }
    eye_contour_svg.forEach(seg => {
        for (let i = 0; i < seg.length; ++i)
        {
            const contourLine = [mapSegCoords(seg[i], [0, 0]), mapSegCoords(seg[(i + 1) % seg.length], [0, 0])];
            linesEyeCut.push(contourLine);
            eye_base_contour.push(contourLine);
        }
    });

    for (let i = 0; i < lines.length; ++i)
    {
        let intersection = false;
        for (let j = 0; j < eye_base_contour.length; ++j)
        {
            intersection = intersectEdges(lines[i], eye_base_contour[j]);
            if (intersection) break;
        }

        const p0InMask = pointInBMPMask(lines[i][0], width, height, eye_outer_margin, eye_base_bmp);
        const p1InMask = pointInBMPMask(lines[i][1], width, height, eye_outer_margin, eye_base_bmp);

        if (!p0InMask && !p1InMask && !intersection)
        {
            linesEyeCut.push(lines[i]);
        }
        else if (intersection)
        {
            if (!p0InMask && p1InMask) linesEyeCut.push([lines[i][0], intersection]);
            else if (!p1InMask && p0InMask) linesEyeCut.push([lines[i][1], intersection]);
        }
    }
    const pointsEyeCut = points.filter(p => !pointInBMPMask(p, width, height, eye_outer_margin, eye_base_bmp));


  // 2. point circles to lines

return ({ context }) => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);

    pointsEyeCut.forEach(p => {
      context.beginPath();
      context.arc(p[0], p[1], 0.03, 0, Math.PI * 2);
      context.strokeStyle = 'black';
      context.lineWidth = penThicknessCm ;
      context.stroke();
    });

    linesEyeCut.forEach(line => {
      context.beginPath();
      line.forEach(p => context.lineTo(p[0], p[1]));
      context.strokeStyle = 'black';
      context.lineWidth = penThicknessCm;
      context.lineJoin = 'round';
      context.lineCap = 'round';
      context.stroke();
    });

    if (debug.drawPoints) {
      debugPoints.forEach(p => {
        context.beginPath();
        context.arc(p[0], p[1], 0.02, 0, Math.PI * 2);
        context.strokeStyle = context.fillStyle = 'red';
        context.lineWidth = penThicknessCm;
        context.fill();
      });
    }

    return [
      context.canvas,
      {
        data: polylinesToSVG(linesEyeCut, { width, height, units } ),
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
