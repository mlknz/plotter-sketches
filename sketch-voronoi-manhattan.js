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
const bmpSize = 256;
const svgSize = 256;
const penThicknessCm = 0.01;

const randomPointsCount = 100;
const margin = 0.5;
const lines = [];
const points = [];

const generateManhattanVoronoi = (width, height) => {
    const randomPoints = generatePoints(randomPointsCount, width, height, margin);
    const manhattan = generateL1Voronoi(randomPoints, width, height, true);

    const manhattanStripped = [];
    for (let i = 0; i < manhattan.length; ++i)
    {
        manhattanStripped[i] = manhattan[i].polygonPoints;
    }

    // const str = JSON.stringify(manhattanStripped); console.log(str);
    // const manhattan = JSON.parse(manhattanVoronoi1000);
    return manhattanStripped;
};

const fillManhRegularCellEdges = (manh) => {
    for (let i = 0; i < manh.length; ++i)
    {
        const polygonPoints = manh[i];
        for (let j = 0; j < polygonPoints.length; ++j)
        {
              const jNext = (j + 1) % polygonPoints.length;
              const p1 = polygonPoints[j];
              const p2 = polygonPoints[jNext];
              lines.push([p1, p2]);
        }
    }
};

const hasPoint = (points, p) => {
    for (let j = 0; j < points.length; ++j)
    {
        const dx = p[0] - points[j][0];
        const dy = p[1] - points[j][1];
        //console.log(dx, dy);
        if (Math.abs(dx*dx + dy*dy) < 0.00000001)
        {
            return true;
        }
    }

    return false;
};

const fillManhNodesPoints = (manh) => {
    for (let i = 0; i < manh.length; ++i)
    {
        const polygonPoints = manh[i];
        for (let j = 0; j < polygonPoints.length; ++j)
        {
            let isCloseToOther = false;
            for (let k = 0; k < points.length; ++k)
            {
                const dx = polygonPoints[j][0] - points[k][0];
                const dy = polygonPoints[j][1] - points[k][1];
                if (Math.abs(dx*dx + dy*dy) < 0.05)
                {
                    isCloseToOther = true;
                }
            }
            if (!isCloseToOther) points.push(polygonPoints[j]);
        }
    }
};

const sketch = async ({ width, height, units, render }) => {

  const manh = generateManhattanVoronoi(width, height);
  fillManhRegularCellEdges(manh);
  fillManhNodesPoints(manh);

  // 2. inner radius
  // 3. remove overlapping
  // 4. sort draw order for plotter

return ({ context }) => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);

    //context.drawImage(svg_teeth, margin, margin, width - margin, height - margin);

    points.forEach(p => {
      context.beginPath();
      context.arc(p[0], p[1], 0.03, 0, Math.PI * 2);
      context.strokeStyle = 'black';
      context.lineWidth = penThicknessCm ;
      context.stroke();
    });

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
