const random = require('canvas-sketch-util/random');

export function generatePoints(pointCount, width, height, margin) {
    return Array.from(new Array(pointCount)).map(() => {
      return [
        random.range(margin, width - margin),
        random.range(margin, height - margin)
      ];
  })
};

const eps = 0.001;
export function pointsEqual(a, b)
{
    return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
}

export function segmentsEqual(a, b, c, d)
{
    return (pointsEqual(a, c) && pointsEqual(b, d)) || (pointsEqual(a, d) && pointsEqual(b, c));
}

export function addSegmentsFromPolys(polys, lines, offset, debug)
{
    polys.forEach(p => {
        for (let i = 0; i < p.length; ++i)
        {
            const ind2 = (i + 1) % p.length;
            const pointA = [ p[i][0] + offset[0], p[i][1] + offset[1] ];
            const pointB = [ p[ind2][0] + offset[0], p[ind2][1] + offset[1] ];
            let isDuplicate = false;
            for (let j = 0; j < lines.length; ++j)
            {
                if (segmentsEqual(pointA, pointB, lines[j][0], lines[j][1]) || pointsEqual(p[i], p[ind2]))
                  {
                      isDuplicate = true;
                      debug.duplicateSegments++;
                      break;
                  }
            }
            if (!isDuplicate) lines.push([pointA, pointB]);
        }
    });
}

// IMG
export function getBMPColor(bmp, x, y) {
    let itr = y * bmp.width * 4 + x * 4;
    return [bmp.data[itr], bmp.data[itr + 1],  bmp.data[itr + 2],  bmp.data[itr + 3]];
};

export function pointInBMPMask(p, width, height, margin, bmp_mask, colorIndicesToCheck, offset = [0, 0]) {
    const cellX =  Math.floor(((p[0] - offset[0] - margin) / (width - 2*margin)) * bmp_mask.width);
    const cellY = Math.floor(((p[1] - offset[1] - margin) / (height - 2*margin)) * bmp_mask.height);
    if (cellX < 0 || cellY < 0 || cellX > bmp_mask.width || cellY > bmp_mask.height) return false;

    const col = getBMPColor(bmp_mask, cellX, cellY);
    let hasColor = false;
    colorIndicesToCheck.forEach(colorIndex => {
        if (col[colorIndex] > 128) hasColor = true;
    });
    return hasColor;
};

// 2d
export function normalize(d) {
    const l = Math.sqrt(d[0]*d[0] + d[1]*d[1]);
    return [d[0] / l, d[1] / l];
};

export function directionFromTo(a, b) {
    return normalize([b[0] - a[0], b[1] - a[1]]);
};

export function findMedianDir(a, b, c) {
    let ba = directionFromTo(b, a);
    let bc = directionFromTo(b, c);

    return normalize([ba[0] + bc[0], ba[1] + bc[1]]);
};

export function cross2d(v, w) {
    return v[0] * w[1] - v[1] * w[0];
};

export function intersectEdges(a, b) {
    const a0x = a[0][0];
    const a0y = a[0][1];
    const a1x = a[1][0];
    const a1y = a[1][1];
    const b0x = b[0][0];
    const b0y = b[0][1];
    const b1x = b[1][0];
    const b1y = b[1][1];

    if (Math.max(a0x, a1x) <= Math.min(b0x, b1x)
         || Math.min(a0x, a1x) >= Math.max(b0x, b1x)
         || Math.max(a0y, a1y) <= Math.min(b0y, b1y)
         || Math.min(a0y, a1y) >= Math.max(b0y, b1y))
    {
        return false;
    }
    const aDir = directionFromTo(a[0], a[1]);
    const bDir = directionFromTo(b[0], b[1]);

    const abDot = aDir[0] * bDir[0] + aDir[1] * bDir[1];
    if (Math.abs(abDot) > 0.999)
    {
        return false;
    }

    const aDirUnnorm = [a1x - a0x, a1y - a0y];
    const bDirUnnorm = [b1x - b0x, b1y - b0y];
    const t = cross2d([b0x - a0x, b0y - a0y], bDirUnnorm) / cross2d(aDirUnnorm, bDirUnnorm);
    const u = cross2d([a0x - b0x, a0y - b0y], aDirUnnorm) / cross2d(bDirUnnorm, aDirUnnorm);
    if (isNaN(t) || isNaN(u) || t < 0 || t > 1 || u < 0 || u > 1)
    {
        return false;
    }
    return [a0x + aDirUnnorm[0] * t, a0y + aDirUnnorm[1] * t];
};

export function fitLinesToCanvas(lines, width, height)
{
    let minX = 666;
    let minY = 666;
    let maxX = -666;
    let maxY = -666;
    lines.forEach(l =>
    {
        const xMinLine = Math.min(l[0][0], l[1][0]);
        const xMaxLine = Math.max(l[0][0], l[1][0]);
        const yMinLine = Math.min(l[0][1], l[1][1]);
        const yMaxLine = Math.max(l[0][1], l[1][1]);
        minX = Math.min(minX, xMinLine);
        maxX = Math.max(maxX, xMaxLine);
        minY = Math.min(minY, yMinLine);
        maxY = Math.max(maxY, yMaxLine);
    });

    minY -= 0.05;
    maxY += 0.05;

    const centerX = (maxX + minX) * 0.5;
    const centerY = (maxY + minY) * 0.5;
    const scaleX = (maxX-minX) / width;
    const scaleY = (maxY-minY) / height;
    const scale = Math.max(scaleX, scaleY);

    const mapPoint = (p) => {
        p[0] += width/2 - centerX;
        p[1] += height/2 - centerY;

        p[0] -= centerX;
        p[1] -= centerY;

        p[0] /= scale;
        p[1] /= scale;

        p[0] += centerX;
        p[1] += centerY;

        return p;
    };

    const result = [];
    lines.forEach(l =>
    {
       result.push([mapPoint(l[0]), mapPoint(l[1])]);
    });

    return result;
}
