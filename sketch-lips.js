// canvas-sketch sketch-lips.js --open --output=export/

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
const randomPointsCountHand = 16666;
const randomPointsCountLips = 40000;

const handMargin = 0.666;
const margin = 4.4;
const lipsOffset = [-0.7, 2.3];

const penThicknessCm = 0.01;

let teethSVGSegments;
loadsvg('img/lips/teeth_rough.svg', async(err, svg) => {
  teethSVGSegments = await segments(await linearize(svg, { tolerance: 0 }));
});

const sketch = async ({ width, height, units, render }) => {

  const image_lips_up = await load('img/lips/lips_up_details.png');
  const image_lips_down = await load('img/lips/lips_down_details.png');
  const image_hand = await load('img/lips/hand_inverse.png');
  const image_hand_lips_mask = await load('img/lips/hand_lips_mask.png');

  const pointsRandomHand = generatePoints(randomPointsCountHand, width, height, handMargin);
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
  tmpContext.clearRect(0, 0, bmpSize, bmpSize);
  tmpContext.drawImage(image_hand, 0, 0, bmpSize, bmpSize);
  const hand_bmp = tmpContext.getImageData(0, 0, bmpSize, bmpSize);
  tmpContext.clearRect(0, 0, bmpSize, bmpSize);
  tmpContext.drawImage(image_hand_lips_mask, 0, 0, bmpSize, bmpSize);
  const hand_lips_mask_bmp = tmpContext.getImageData(0, 0, bmpSize, bmpSize);

  const lipsUpMaskFunc = entry => pointInBMPMask(entry, width, height, margin, lips_up_bmp);
  const lipsDownMaskFunc = entry => pointInBMPMask(entry, width, height, margin, lips_down_bmp);
  const lipsUpPolys = voronoiPolysFromPointsAndMask(pointsRandomLips, width, height, margin, lipsUpMaskFunc);
  const lipsDownPolys = voronoiPolysFromPointsAndMask(pointsRandomLips, width, height, margin, lipsDownMaskFunc);

  const handMaskFunc = entry =>
  {
      return pointInBMPMask(entry, width, height, handMargin, hand_bmp)
        || pointInBMPMask(entry, width, height, margin, hand_lips_mask_bmp, lipsOffset);
  }
  const handPolys = voronoiPolysFromPointsAndMask(pointsRandomHand, width, height, handMargin, handMaskFunc);

  const points = [];
  const lines = [];
  addSegmentsFromPolys(lipsUpPolys.fullyInside, lines, lipsOffset, debug);
  addSegmentsFromPolys(lipsDownPolys.fullyInside, lines, lipsOffset, debug);
  addSegmentsFromPolys(handPolys.fullyOutside, lines, [0, 0], debug);
  addSegmentsFromPolys(handPolys.partiallyInside, lines, [0, 0], debug);
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
  dimensions: [ 13, 13 ],
  pixelsPerInch: 300,
  units: 'cm',
});
