import { Delaunay } from "d3-delaunay";
import { pointInBMPMask } from "./utils.js"

export function voronoiPolysFromPointsAndMask(points, width, height, margin, maskFunc, dela)
{
    const maskedPoints = points.filter((entry) => {
        return maskFunc(entry);
    });

    let polyGen;
    const delaunay = Delaunay.from(maskedPoints);
    if (dela)
    {
        polyGen = delaunay.trianglePolygons();
    }
    else
    {
        const voronoi = delaunay.voronoi([margin, margin, width - margin, height - margin]);
        polyGen = voronoi.cellPolygons();
    }

    const polys = [];
    const partiallyInsidePolys = [];
    const fullyOutsidePolys = [];

    while (true)
    {
        const poly = polyGen.next();
        if (poly.done) break;
        let fullyInside = true;
        let partiallyInside = false;

        for (let i = 0; i < poly.value.length; ++i)
        {
            if (maskFunc(poly.value[i])) partiallyInside = true;
            else fullyInside = false;
        }

        if (fullyInside) polys.push(poly.value);
        else if (partiallyInside) partiallyInsidePolys.push(poly.value);
        else fullyOutsidePolys.push(poly.value);
    }
    return {
        fullyInside: polys,
        partiallyInside: partiallyInsidePolys,
        fullyOutside: fullyOutsidePolys
    };
}
