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
   getBMPColor, pointInBMPMask, findMedianDir, directionFromTo, intersectEdges } from "./utils.js";
// import { voronoiPolysFromPointsAndMask } from "./utils-voronoi.js";
import { fillManhNodesPoints, fillManhCellsLines } from "./utils-manh-voronoi.js";

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
    fillManhNodesPoints(manh, points);
    fillManhCellsLines(manh, innerCellRadiusMargin, lines);
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
