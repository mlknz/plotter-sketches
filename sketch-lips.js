// canvas-sketch sketch-lips.js --open --output=export/

const canvasSketch = require('canvas-sketch');
const { polylinesToSVG } = require('canvas-sketch-util/penplot');
//const clustering = require('density-clustering');
//const convexHull = require('convex-hull');
const load = require('load-asset');
import {Delaunay} from "d3-delaunay";
import {generatePoints, segmentsEqual, pointsEqual, getBMPColor, pointInBMPMask} from "./utils.js"

const debug = false;
const penThicknessCm = 0.02;
const margin = 2;

const sketch = async ({ width, height, units, render }) => {

  const image_lips_up = await load('img/lips/lips_up.png');
  const image_lips_down = await load('img/lips/lips_down.png');
  //const image_lips_teeth = await load('img_seed/lips/lips_teeth.png');

  const pointsRandom = generatePoints(9000, width, height, margin);

  var canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;

  var tmpContext = canvas.getContext('2d');
  tmpContext.imageSmoothingEnabled = false;
  tmpContext.drawImage(image_lips_up, 0, 0, 256, 256);
  const lips_up_bmp = tmpContext.getImageData(0, 0, 256, 256);

  const points = pointsRandom.filter((entry) => {
      return pointInBMPMask(entry, width, height, margin, lips_up_bmp);
  });

  const delaunay = Delaunay.from(points);
  //const delaPolyGen = delaunay.trianglePolygons();
  const voronoi = delaunay.voronoi([margin, margin, width - margin, height - margin]);
  const voroPolyGen = voronoi.cellPolygons();
  const polys = [];
  const partiallyInsidePolys = [];
  const lines = [];

  while (true)
  {
      const poly = voroPolyGen.next();
      if (poly.done) break;
      let fullyInside = true;
      let partiallyInside = false;

      for (let i = 0; i < poly.value.length; ++i)
      {
          if (pointInBMPMask(poly.value[i], width, height, margin, lips_up_bmp)) partiallyInside = true;
          else fullyInside = false;
      }

      if (fullyInside) polys.push(poly.value);
      else if (partiallyInside) partiallyInsidePolys.push(poly.value);
  }

  let duplicateSegments = 0;
  polys.forEach(p => {
      for (let i = 0; i < p.length; ++i)
      {
          let ind2 = (i + 1) % p.length;
          let isDuplicate = false;
          for (let j = 0; j < lines.length; ++j)
          {
              if (segmentsEqual(p[i], p[ind2], lines[j][0], lines[j][1]) || pointsEqual(p[i], p[ind2]))
                {
                    isDuplicate = true;
                    duplicateSegments++;
                    break;
                }
          }
          if (!isDuplicate) lines.push([p[i], p[ind2]]);
      }
  });
  console.log("Remove duplicates ", duplicateSegments, "of total ", lines.length + duplicateSegments);

// const loop = setInterval(() => {
//   const remaining = integrate();
//   if (!remaining) return clearInterval(loop);
//   render();
// }, 33.3);

return ({ context }) => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);

    //context.drawImage(image_lips_up, margin, margin, width - margin, height - margin);

    lines.forEach(points => {
      context.beginPath();
      points.forEach(p => context.lineTo(p[0], p[1]));
      context.strokeStyle = debug ? 'blue' : 'black';
      context.lineWidth = penThicknessCm;
      context.lineJoin = 'round';
      context.lineCap = 'round';
      context.stroke();
    });

    if (debug) {
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
