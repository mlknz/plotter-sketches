import { Delaunay } from "d3-delaunay";
import { pointInBMPMask } from "./utils.js"

export function voronoiPolysFromPointsAndMask(points, width, height, margin, bmp_mask)
{
    const maskedPoints = points.filter((entry) => {
        return pointInBMPMask(entry, width, height, margin, bmp_mask);
    });

    const delaunay = Delaunay.from(maskedPoints);
    //const delaPolyGen = delaunay.trianglePolygons();
    const voronoi = delaunay.voronoi([margin, margin, width - margin, height - margin]);
    const voroPolyGen = voronoi.cellPolygons();
    const polys = [];
    const partiallyInsidePolys = [];
    const fullyOutsidePolys = [];

    while (true)
    {
        const poly = voroPolyGen.next();
        if (poly.done) break;
        let fullyInside = true;
        let partiallyInside = false;

        for (let i = 0; i < poly.value.length; ++i)
        {
            if (pointInBMPMask(poly.value[i], width, height, margin, bmp_mask)) partiallyInside = true;
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
