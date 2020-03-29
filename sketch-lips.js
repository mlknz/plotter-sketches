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
const randomPointsCount = 15000;
const margin = 2;

const penThicknessCm = 0.03;
const boldPenThicknessCm = 0.03;

let teethSVGSegments;
loadsvg('img/lips/teeth_rough.svg', async(err, svg) => {
  teethSVGSegments = await segments(await linearize(svg, { tolerance: 0 }));
});

const sketch = async ({ width, height, units, render }) => {

  const image_lips_up = await load('img/lips/lips_up_details.png');
  const image_lips_down = await load('img/lips/lips_down_details.png');

  const pointsRandom = generatePoints(randomPointsCount, width, height, margin);

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

  const lipsUpPolys = voronoiPolysFromPointsAndMask(pointsRandom, width, height, margin, lips_up_bmp);
  const lipsDownPolys = voronoiPolysFromPointsAndMask(pointsRandom, width, height, margin, lips_down_bmp);

  const points = [];
  const lines = [];
  addSegmentsFromPolys(lipsUpPolys.fullyInside, lines, debug);
  addSegmentsFromPolys(lipsDownPolys.fullyInside, lines, debug);
  console.log("Remove duplicates ", debug.duplicateSegments, "of total ", lines.length + debug.duplicateSegments);

  const mapSegCoords = (seg) => {
      let x = (seg[0] / svgSize) * (width - margin*2) + margin;
      let y = (seg[1] / svgSize) * (height - margin*2) + margin;

      return [x, y];
  }

  const boldLines = [];
  teethSVGSegments.forEach(seg => {
      for (let i = 0; i < seg.length - 1; ++i)
      {
          boldLines.push([mapSegCoords(seg[i]), mapSegCoords(seg[i + 1])]);
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
    boldLines.forEach(points => {
      context.beginPath();
      points.forEach(p => context.lineTo(p[0], p[1]));
      context.strokeStyle = 'black';
      context.lineWidth = boldPenThicknessCm;
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
