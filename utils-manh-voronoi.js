import { findMedianDir, directionFromTo, intersectEdges } from "./utils.js";

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

const addPolygonLines = (polygonPoints, viewWidth, viewHeight, outLines) => {
    let cellCenterX = 0;
    let cellCenterY = 0;
    polygonPoints.forEach(p => {
        cellCenterX += p[0];
        cellCenterY += p[1];
    });
    cellCenterX /= polygonPoints.length;
    cellCenterY /= polygonPoints.length;
    const xEdgeTerm = Math.abs(cellCenterX / viewWidth - 0.5) * 2.0;
    const yTerm = cellCenterY / viewHeight;

    const cellDistortionTerm = yTerm * yTerm * 3.0;

    if (xEdgeTerm > yTerm) // shiet man do a config for such shiet already please shiet
    {
        return; // triangle shape
    }
    const randomDir = Math.random() * Math.PI;
    const distortionOffset = [ Math.cos(randomDir) * cellDistortionTerm, Math.sin(randomDir) * cellDistortionTerm ];
    for (let j = 0; j < polygonPoints.length; ++j)
    {

          const jNext = (j + 1) % polygonPoints.length;
          const p1 = [polygonPoints[j][0] + distortionOffset[0], polygonPoints[j][1] + distortionOffset[1]];
          const p2 = [polygonPoints[jNext][0] + distortionOffset[0], polygonPoints[jNext][1] + distortionOffset[1]];

          outLines.push([p1, p2]);
    }
};

const normalizeManh = (d) => {
    const l = Math.abs(d[0]) + Math.abs(d[1]);
    return [d[0] / l, d[1] / l];
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
          const bc = directionFromTo(b, c);

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

export function fillManhCellsLines(manh, innerCellRadiusMargin, outLines, width, height) {
    manh.forEach(mi => {
        const innerPoly = generateInnerCellContour(mi.polygonPoints, mi.site, innerCellRadiusMargin, [ mi.polygonPoints ]);
        const innerPoly2 = generateInnerCellContour(mi.polygonPoints, mi.site, innerCellRadiusMargin * 2, [ mi.polygonPoints, innerPoly ]);
        const innerPoly3 = generateInnerCellContour(mi.polygonPoints, mi.site, innerCellRadiusMargin * 3, [ mi.polygonPoints, innerPoly, innerPoly2 ]);

        addPolygonLines(mi.polygonPoints, width, height, outLines);
        addPolygonLines(innerPoly, width, height, outLines);
        addPolygonLines(innerPoly2, width, height, outLines);
        addPolygonLines(innerPoly3, width, height, outLines);
    });
};

export function fillManhNodesPoints(manh, outPoints) {
    manh.forEach(mi =>
        mi.polygonPoints.forEach(pp => {
            let isCloseToOther = false;
            for (let k = 0; k < outPoints.length; ++k)
            {
                const dx = pp[0] - outPoints[k][0];
                const dy = pp[1] - outPoints[k][1];
                if (Math.abs(dx*dx + dy*dy) < 0.05)
                {
                    isCloseToOther = true;
                }
            }
            if (!isCloseToOther) outPoints.push(pp);
        })
    );
};
