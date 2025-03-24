// npx canvas-sketch-cli sketch-2d-vibe-gen-alphabet.js --open --output=export/

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

const lines = [];
let manhAllPointsSeed;

const generateManhattanVoronoi = (width, height) => {
    manhAllPointsSeed = generatePoints(config.showManh ? config.randomPointsCount : 0, width, height, config.margin);
    const manhattan = generateL1Voronoi(manhAllPointsSeed, width, height, true);

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
    if (config.debugShowIrisOrigVoroCutWithContour || config.debugShowIrisOrigVoroUnmasked)
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

// Определяем буквы как наборы линий (координаты относительные, в пределах 0-1)
const letterPaths = {
    'А': [
        [[0.2, 0], [0.5, 1]], // левая диагональ
        [[0.8, 0], [0.5, 1]], // правая диагональ
        [[0.35, 0.5], [0.65, 0.5]] // перекладина
    ],
    'Б': [
        [[0.2, 0], [0.2, 1]], // вертикаль сверху вниз
        [[0.2, 0], [0.7, 0]], // верх слева направо
        [[0.7, 0], [0.7, 0.5]], // правая часть сверху до середины
        [[0.7, 0.5], [0.2, 0.5]], // середина справа налево
        [[0.2, 1], [0.7, 1]] // низ слева направо
    ],
    'В': [
        [[0.2, 1], [0.2, 0]], // вертикаль
        [[0.2, 1], [0.7, 1]], // низ
        [[0.7, 1], [0.7, 0.5]], // правая нижняя часть
        [[0.7, 0.5], [0.7, 0]], // правая верхняя часть
        [[0.7, 0], [0.2, 0]], // верх
        [[0.2, 0.5], [0.7, 0.5]] // середина
    ],
    'Г': [
        [[0.2, 1], [0.2, 0]], // вертикаль
        [[0.2, 1], [0.7, 1]] // низ
    ],
    'Д': [
        [[0.1, 0], [0.2, 0.2]], // левая ножка
        [[0.8, 0], [0.7, 0.2]], // правая ножка
        [[0.2, 0.2], [0.7, 0.2]], // основание
        [[0.3, 0.2], [0.3, 1]], // левая вертикаль
        [[0.6, 0.2], [0.6, 1]], // правая вертикаль
        [[0.3, 1], [0.6, 1]] // верх
    ],
    'Е': [
        [[0.2, 1], [0.2, 0]], // вертикаль
        [[0.2, 1], [0.7, 1]], // низ
        [[0.2, 0.5], [0.6, 0.5]], // середина
        [[0.2, 0], [0.7, 0]] // верх
    ],
    'Ё': [
        [[0.2, 1], [0.2, 0]], // вертикаль
        [[0.2, 1], [0.7, 1]], // низ
        [[0.2, 0.5], [0.6, 0.5]], // середина
        [[0.2, 0], [0.7, 0]], // верх
        [[0.35, 1.2], [0.35, 1.15]], // левая точка
        [[0.55, 1.2], [0.55, 1.15]] // правая точка
    ],
    'Ж': [
        [[0.5, 1], [0.5, 0]], // центральная вертикаль
        [[0.1, 1], [0.9, 0]], // диагональ
        [[0.9, 1], [0.1, 0]], // диагональ
        [[0.3, 0.5], [0.7, 0.5]] // перекладина
    ],
    'З': [
        [[0.2, 1], [0.7, 1]], // низ
        [[0.7, 1], [0.7, 0.5]], // правая нижняя часть
        [[0.7, 0.5], [0.2, 0.5]], // середина
        [[0.7, 0.5], [0.7, 0]], // правая верхняя часть
        [[0.7, 0], [0.2, 0]] // верх
    ],
    'И': [
        [[0.2, 1], [0.2, 0]], // левая вертикаль
        [[0.7, 1], [0.7, 0]], // правая вертикаль
        [[0.2, 0], [0.7, 1]] // диагональ
    ],
    'Й': [
        [[0.2, 1], [0.2, 0]], // левая вертикаль
        [[0.7, 1], [0.7, 0]], // правая вертикаль
        [[0.2, 0], [0.7, 1]], // диагональ
        [[0.3, 1.2], [0.6, 1.2]] // крышка
    ],
    'К': [
        [[0.2, 1], [0.2, 0]], // вертикаль
        [[0.2, 0.5], [0.7, 1]], // верхняя диагональ
        [[0.2, 0.5], [0.7, 0]] // нижняя диагональ
    ],
    'Л': [
        [[0.2, 0], [0.45, 1]], // левая диагональ
        [[0.45, 1], [0.7, 0]] // правая диагональ
    ],
    'М': [
        [[0.2, 0], [0.2, 1]], // левая вертикаль
        [[0.2, 1], [0.45, 0.3]], // левая диагональ
        [[0.45, 0.3], [0.7, 1]], // правая диагональ
        [[0.7, 1], [0.7, 0]] // правая вертикаль
    ],
    'Н': [
        [[0.2, 1], [0.2, 0]], // левая вертикаль
        [[0.7, 1], [0.7, 0]], // правая вертикаль
        [[0.2, 0.5], [0.7, 0.5]] // перекладина
    ],
    'О': [
        [[0.2, 1], [0.7, 1]], // низ
        [[0.7, 1], [0.7, 0]], // правая сторона
        [[0.7, 0], [0.2, 0]], // верх
        [[0.2, 0], [0.2, 1]] // левая сторона
    ],
    'П': [
        [[0.2, 1], [0.2, 0]], // левая вертикаль
        [[0.7, 1], [0.7, 0]], // правая вертикаль
        [[0.2, 1], [0.7, 1]] // низ
    ],
    'Р': [
        [[0.2, 1], [0.2, 0]], // вертикаль
        [[0.2, 1], [0.7, 1]], // низ
        [[0.7, 1], [0.7, 0.5]], // правая часть
        [[0.7, 0.5], [0.2, 0.5]] // верх полукруга
    ],
    'С': [
        [[0.7, 1], [0.2, 1]], // низ
        [[0.2, 1], [0.2, 0]], // левая сторона
        [[0.2, 0], [0.7, 0]] // верх
    ],
    'Т': [
        [[0.45, 1], [0.45, 0]], // вертикаль
        [[0.2, 1], [0.7, 1]] // низ
    ],
    'У': [
        [[0.2, 1], [0.45, 0.5]], // верхняя левая часть
        [[0.7, 1], [0.45, 0.5]], // верхняя правая часть
        [[0.45, 0.5], [0.45, 0]] // нижняя часть
    ],
    'Ф': [
        [[0.45, 1], [0.45, 0]], // вертикаль
        [[0.2, 0.7], [0.7, 0.7]], // нижний овал
        [[0.7, 0.7], [0.7, 0.3]], // правая часть овала
        [[0.7, 0.3], [0.2, 0.3]], // верхний овал
        [[0.2, 0.3], [0.2, 0.7]] // левая часть овала
    ],
    'Х': [
        [[0.2, 1], [0.7, 0]], // диагональ
        [[0.7, 1], [0.2, 0]] // диагональ
    ],
    'Ц': [
        [[0.2, 1], [0.2, 0]], // левая вертикаль
        [[0.7, 1], [0.7, 0]], // правая вертикаль
        [[0.2, 0], [0.7, 0]], // верх
        [[0.7, 0], [0.8, -0.2]] // хвостик
    ],
    'Ч': [
        [[0.2, 1], [0.2, 0.5]], // левая верхняя часть
        [[0.2, 0.5], [0.7, 0.5]], // перекладина
        [[0.7, 1], [0.7, 0]] // правая вертикаль
    ],
    'Ш': [
        [[0.2, 1], [0.2, 0]], // левая вертикаль
        [[0.45, 1], [0.45, 0]], // средняя вертикаль
        [[0.7, 1], [0.7, 0]], // правая вертикаль
        [[0.2, 0], [0.7, 0]] // верх
    ],
    'Щ': [
        [[0.2, 1], [0.2, 0]], // левая вертикаль
        [[0.45, 1], [0.45, 0]], // средняя вертикаль
        [[0.7, 1], [0.7, 0]], // правая вертикаль
        [[0.2, 0], [0.7, 0]], // верх
        [[0.7, 0], [0.8, -0.2]] // хвостик
    ],
    'Ъ': [
        [[0.3, 0], [0.3, 1]], // вертикаль
        [[0.2, 0], [0.4, 0]], // верхняя палочка
        [[0.3, 0.5], [0.7, 0.5]], // середина
        [[0.7, 0.5], [0.7, 0]], // правая верхняя часть
        [[0.7, 0], [0.3, 0]] // верх
    ],
    'Ы': [
        [[0.2, 0], [0.2, 1]], // левая вертикаль
        [[0.7, 0], [0.7, 1]], // правая вертикаль
        [[0.2, 0.5], [0.4, 0.5]], // левая середина
        [[0.4, 0.5], [0.4, 0]], // правая верхняя часть
        [[0.4, 0], [0.2, 0]] // верх
    ],
    'Ь': [
        [[0.2, 0], [0.2, 1]], // вертикаль
        [[0.2, 0.5], [0.7, 0.5]], // середина
        [[0.7, 0.5], [0.7, 0]], // правая верхняя часть
        [[0.7, 0], [0.2, 0]] // верх
    ],
    'Э': [
        [[0.2, 1], [0.7, 1]], // низ
        [[0.7, 1], [0.7, 0]], // правая сторона
        [[0.7, 0], [0.2, 0]], // верх
        [[0.2, 0.5], [0.7, 0.5]] // середина
    ],
    'Ю': [
        [[0.2, 1], [0.2, 0]], // левая вертикаль
        [[0.2, 0.5], [0.4, 0.5]], // перемычка
        [[0.4, 1], [0.7, 1]], // низ круга
        [[0.7, 1], [0.7, 0]], // правая сторона круга
        [[0.7, 0], [0.4, 0]], // верх круга
        [[0.4, 0], [0.4, 1]] // левая сторона круга
    ],
    'Я': [
        [[0.7, 1], [0.7, 0]], // правая вертикаль
        [[0.7, 1], [0.2, 1]], // низ
        [[0.2, 1], [0.2, 0.5]], // левая нижняя часть
        [[0.2, 0.5], [0.7, 0.5]], // середина
        [[0.2, 0], [0.4, 0.5]] // диагональ
    ],
    '34': [ // Комбинация элементов 'И' и 'О'
        [[0.2, 0], [0.2, 1]], // левая вертикаль
        [[0.7, 0], [0.7, 1]], // правая вертикаль
        [[0.2, 0], [0.7, 1]], // диагональ
        [[0.2, 0.5], [0.7, 0.5]] // горизонтальная перекладина
    ],
    '35': [ // Производная от 'Ж' с дополнительными элементами
        [[0.5, 0], [0.5, 1]], // центральная вертикаль
        [[0.2, 0], [0.8, 1]], // диагональ
        [[0.8, 0], [0.2, 1]], // диагональ
        [[0.2, 0.3], [0.8, 0.3]], // верхняя горизонталь
        [[0.2, 0.7], [0.8, 0.7]] // нижняя горизонталь
    ],
    '36': [ // Зеркальная версия 'Р' с дополнительными элементами
        [[0.7, 0], [0.7, 1]], // правая вертикаль
        [[0.2, 0.5], [0.7, 0.5]], // середина
        [[0.2, 0.5], [0.2, 0]], // левая верхняя часть
        [[0.2, 0], [0.7, 0]], // верх
        [[0.2, 0.5], [0.2, 1]], // левая нижняя часть
        [[0.2, 1], [0.7, 1]] // низ
    ],
    '37': [ // Новый дизайн с элементами спирали и пересечениями
        [[0.2, 0], [0.7, 0]], // верхняя горизонталь
        [[0.7, 0], [0.7, 0.4]], // правая верхняя вертикаль
        [[0.7, 0.4], [0.4, 0.4]], // верхняя внутренняя горизонталь
        [[0.4, 0.4], [0.4, 0.7]], // средняя вертикаль
        [[0.4, 0.7], [0.7, 0.7]], // нижняя внутренняя горизонталь
        [[0.7, 0.7], [0.7, 1]], // правая нижняя вертикаль
        [[0.7, 1], [0.2, 1]], // нижняя горизонталь
        [[0.2, 1], [0.2, 0]], // левая вертикаль
        [[0.2, 0.5], [0.5, 0.5]] // центральная перекладина
    ],
    '38': [ // Производная от 'Ю' с дополнительными элементами
        [[0.2, 0], [0.2, 1]], // левая вертикаль
        [[0.2, 0.3], [0.4, 0.3]], // верхняя перемычка
        [[0.2, 0.7], [0.4, 0.7]], // нижняя перемычка
        [[0.4, 0], [0.7, 0]], // верх круга
        [[0.7, 0], [0.7, 1]], // правая сторона
        [[0.7, 1], [0.4, 1]], // низ круга
        [[0.4, 1], [0.4, 0]] // левая сторона круга
    ],
    '39': [ // Комбинация элементов 'Д' и 'Л'
        [[0.2, 1], [0.45, 0]], // левая диагональ
        [[0.45, 0], [0.7, 1]], // правая диагональ
        [[0.2, 0.3], [0.7, 0.3]], // горизонталь
        [[0.45, 0], [0.45, 1]] // центральная вертикаль
    ],
    '40': [ // Эволюция 'З' с дополнительными элементами
        [[0.2, 0], [0.7, 0]], // верх
        [[0.7, 0], [0.7, 0.5]], // правая верхняя часть
        [[0.2, 0.5], [0.7, 0.5]], // середина
        [[0.2, 0.5], [0.2, 1]], // левая нижняя часть
        [[0.2, 1], [0.7, 1]], // низ
        [[0.45, 0], [0.45, 1]] // центральная вертикаль
    ],
    '41': [ // Гибрид 'Ц' и 'У'
        [[0.2, 0], [0.45, 0.5]], // левая верхняя диагональ
        [[0.7, 0], [0.45, 0.5]], // правая верхняя диагональ
        [[0.45, 0.5], [0.45, 1]], // центральная вертикаль
        [[0.35, 1], [0.55, 1]], // нижняя горизонталь
        [[0.55, 1], [0.65, 1.2]] // хвостик
    ],
    '42': [ // Комбинация 'Б' и 'В'
        [[0.2, 0], [0.2, 1]], // левая вертикаль
        [[0.2, 0], [0.7, 0]], // верх
        [[0.7, 0], [0.7, 0.3]], // правая верхняя часть
        [[0.7, 0.3], [0.2, 0.3]], // верхняя перекладина
        [[0.7, 0.6], [0.2, 0.6]], // нижняя перекладина
        [[0.7, 0.6], [0.7, 1]], // правая нижняя часть
        [[0.2, 1], [0.7, 1]] // низ
    ],
    '43': [ // Эволюция 'Э' и 'Я'
        [[0.7, 0], [0.7, 1]], // правая вертикаль
        [[0.2, 0], [0.7, 0]], // верх
        [[0.2, 1], [0.7, 1]], // низ
        [[0.2, 0.3], [0.7, 0.3]], // верхняя перекладина
        [[0.2, 0.7], [0.7, 0.7]], // нижняя перекладина
        [[0.2, 0.3], [0.2, 0.7]] // левая средняя часть
    ]
};

const generateGridAndLetters = (width, height, cellSize) => {
    const gridLines = [];
    const letterLines = [];
    
    // Создаём массив всех букв в нужном порядке
    const cyrillicAlphabet = [
        'А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ё', 'Ж', 'З', 'И', 'Й', 'К', 'Л', 'М', 'Н',
        'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ы', 'Ь',
        'Э', 'Ю', 'Я',
        '34', '35', '36', '37', '38', '39', '40', '41', '42', '43'
    ];
    let letterIndex = 0;
    
    // Вертикальные линии сетки
    for (let x = cellSize; x < width; x += cellSize) {
        gridLines.push([[x, 0], [x, height]]);
    }
    
    // Горизонтальные линии сетки
    for (let y = cellSize; y < height; y += cellSize) {
        gridLines.push([[0, y], [width, y]]);
    }
    
    // Добавляем буквы
    for (let y = 0; y < height; y += cellSize) {
        for (let x = 0; x < width; x += cellSize) {
            if (letterIndex < cyrillicAlphabet.length) {
                const letter = cyrillicAlphabet[letterIndex];
                const letterSize = cellSize * 0.8;
                
                letterPaths[letter].forEach(segment => {
                    const startX = x + cellSize * 0.1 + segment[0][0] * letterSize;
                    const startY = y + cellSize * 0.1 + (1 - segment[0][1]) * letterSize;
                    const endX = x + cellSize * 0.1 + segment[1][0] * letterSize;
                    const endY = y + cellSize * 0.1 + (1 - segment[1][1]) * letterSize;
                    
                    letterLines.push([[startX, startY], [endX, endY]]);
                });
                
                letterIndex++;
            }
        }
    }
    
    return { gridLines, letterLines };
};

const sketch = async ({ width, height, units }) => {
    const { gridLines, letterLines } = generateGridAndLetters(width, height, 1);
    const allLines = [...gridLines, ...letterLines]; // Объединяем все линии
    
    return ({ context }) => {
        context.clearRect(0, 0, width, height);
        context.fillStyle = 'white';
        context.fillRect(0, 0, width, height);

        allLines.forEach(line => {
            context.beginPath();
            line.forEach(p => context.lineTo(p[0], p[1]));
            context.strokeStyle = 'black';
            context.lineWidth = 0.05; // толщина линии в см
            context.lineJoin = 'round';
            context.lineCap = 'round';
            context.stroke();
        });

        return [
            context.canvas,
            {
                data: polylinesToSVG(allLines, { width, height, units }),
                extension: '.svg'
            }
        ];
    };
};

canvasSketch(sketch, {
    dimensions: [13, 13],
    pixelsPerInch: 300,
    units: 'cm',
});
