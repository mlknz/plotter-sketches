// canvas-sketch sketch-lips.js --open --output=export/

//const clustering = require('density-clustering');
//const convexHull = require('convex-hull');
const canvasSketch = require('canvas-sketch');
const load = require('load-asset');
const { polylinesToSVG } = require('canvas-sketch-util/penplot');
import { generatePoints, segmentsEqual, pointsEqual, addSegmentsFromPolys, getBMPColor, pointInBMPMask } from "./utils.js";
import { voronoiPolysFromPointsAndMask } from "./utils-voronoi.js";

const debug = {
    drawPoints: false,
    duplicateSegments: 0
};
const bmpSise = 256;
const randomPointsCount = 15000;
const margin = 2;

const penThicknessCm = 0.03;

const sketch = async ({ width, height, units, render }) => {

  const image_lips_up = await load('img/lips/lips_up_details.png');
  const image_lips_down = await load('img/lips/lips_down_details.png');
  //const image_lips_teeth = await load('img_seed/lips/lips_teeth.png');

  const pointsRandom = generatePoints(randomPointsCount, width, height, margin);

  var canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;

  var tmpContext = canvas.getContext('2d');
  tmpContext.imageSmoothingEnabled = false;
  tmpContext.clearRect(0, 0, bmpSise, bmpSise);
  tmpContext.drawImage(image_lips_up, 0, 0, bmpSise, bmpSise);
  const lips_up_bmp = tmpContext.getImageData(0, 0, bmpSise, bmpSise);
  tmpContext.clearRect(0, 0, bmpSise, bmpSise);
  tmpContext.drawImage(image_lips_down, 0, 0, bmpSise, bmpSise);
  const lips_down_bmp = tmpContext.getImageData(0, 0, bmpSise, bmpSise);

  const lipsUpPolys = voronoiPolysFromPointsAndMask(pointsRandom, width, height, margin, lips_up_bmp);
  const lipsDownPolys = voronoiPolysFromPointsAndMask(pointsRandom, width, height, margin, lips_down_bmp);

  const lines = [];
  addSegmentsFromPolys(lipsUpPolys.fullyInside, lines, debug);
  addSegmentsFromPolys(lipsDownPolys.fullyInside, lines, debug);
  console.log("Remove duplicates ", debug.duplicateSegments, "of total ", lines.length + debug.duplicateSegments);

// const loop = setInterval(() => {
//   const remaining = integrate();
//   if (!remaining) return clearInterval(loop);
//   render();
// }, 33.3);

return ({ context }) => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);

    //context.drawImage(image_lips_down, margin, margin, width - margin, height - margin);

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
  dimensions: [ 15, 15 ],
  pixelsPerInch: 300,
  units: 'cm',
});
