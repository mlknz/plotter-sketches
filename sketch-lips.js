// canvas-sketch sketch-lips.js --open --output=export/

// todo:
// 1. cut segments with lips mask
// 2. remove bottom edge
// 3. liquid stekanie

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

const debug = {
    drawPoints: false,
    duplicateSegments: 0
};
const bmpSize = 256;
const svgSize = 256;
const randomPointsCountLips = 66666;

const handMargin = 0.366;
const margin = 1.0;
const lipsOffset = [-0.0, 0.0];

const penThicknessCm = 0.03;

let teethSVGSegments;
loadsvg('img/lips/teeth_rough.svg', async(err, svg) => {
  teethSVGSegments = await segments(await linearize(svg, { tolerance: 0 }));
});

const sketch = async ({ width, height, units, render }) => {

  const image_lips_up = await load('img/lips/lips_up.png');
  const image_lips_down = await load('img/lips/lips_down.png');
  const pointsRandomLips = generatePoints(randomPointsCountLips, width, height, handMargin);

  var canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;

  var tmpContext = canvas.getContext('2d');
  tmpContext.imageSmoothingEnabled = false;
  tmpContext.clearRect(0, 0, bmpSize, bmpSize);
  tmpContext.drawImage(image_lips_up, 0, 0, bmpSize, bmpSize);
  const lips_up_bmp = tmpContext.getImageData(0, 0, bmpSize, bmpSize);
  tmpContext.clearRect(0, 0, bmpSize, bmpSize);
  tmpContext.drawImage(image_lips_down, 0, 0, bmpSize, bmpSize);
  const lips_down_bmp = tmpContext.getImageData(0, 0, bmpSize, bmpSize);

  const lipsUpMaskFunc = entry =>
  {
      return pointInBMPMask(entry, width, height, margin, lips_up_bmp)
        || !pointInBMPMask(entry, width, height, margin, lips_down_bmp);
  };
  const lipsDownMaskFunc = entry =>
  {
      return !pointInBMPMask(entry, width, height, margin, lips_up_bmp);
  };

  const lipsUpPolys = voronoiPolysFromPointsAndMask(pointsRandomLips, width, height, margin, lipsUpMaskFunc);
  const lipsDownPolys = voronoiPolysFromPointsAndMask(pointsRandomLips, width, height, margin, lipsDownMaskFunc);

  const points = [];
  const lines = [];
  addSegmentsFromPolys(lipsUpPolys.fullyOutside, lines, lipsOffset, debug);
  addSegmentsFromPolys(lipsUpPolys.partiallyInside, lines, lipsOffset, debug);
  addSegmentsFromPolys(lipsDownPolys.fullyOutside, lines, lipsOffset, debug);
  addSegmentsFromPolys(lipsDownPolys.partiallyInside, lines, lipsOffset, debug);
  console.log("Remove duplicates ", debug.duplicateSegments, "of total ", lines.length + debug.duplicateSegments);

  const mapSegCoords = (seg, offset) => {
      const x = (seg[0] / svgSize) * (width - margin*2) + margin + offset[0];
      const y = (seg[1] / svgSize) * (height - margin*2) + margin + offset[1];
      return [x, y];
  }

  teethSVGSegments.forEach(seg => {
      for (let i = 0; i < seg.length - 1; ++i)
      {
          lines.push([mapSegCoords(seg[i], lipsOffset), mapSegCoords(seg[i + 1], lipsOffset)]);
      }
  });

// const loop = setInterval(() => {
//   const remaining = integrate();
//   if (!remaining) return clearInterval(loop);
//   render();
// }, 33.3);

return ({ context }) => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);

    //context.drawImage(svg_teeth, margin, margin, width - margin, height - margin);

    lines.forEach(points => {
      context.beginPath();
      points.forEach(p => context.lineTo(p[0], p[1]));
      context.strokeStyle = 'black';
      context.lineWidth = penThicknessCm;
      context.lineJoin = 'round';
      context.lineCap = 'round';
      context.stroke();
    });

    if (debug.drawPoints) {
      points.forEach(p => {
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
        data: polylinesToSVG(lines, { width, height, units } ),
        extension: '.svg'
      }
    ];
  };
};
canvasSketch(sketch, {
  dimensions: [ 12, 12 ],
  pixelsPerInch: 300,
  units: 'cm',
});
