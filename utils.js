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

export function getBMPColor(bmp, x, y) {
    let itr = y * bmp.width * 4 + x * 4;
    return [bmp.data[itr], bmp.data[itr + 1],  bmp.data[itr + 2],  bmp.data[itr + 3]];
};

export function pointInBMPMask(p, width, height, margin, bmp_mask, offset = [0, 0]) {
    const cellX = Math.floor(((p[0] - offset[0] - margin) / (width - 2*margin)) * bmp_mask.width);
    const cellY = Math.floor(((p[1] - offset[1] - margin) / (height - 2*margin)) * bmp_mask.height);
    if (cellX < 0 || cellY < 0 || cellX > bmp_mask.width || cellY > bmp_mask.height) return false;

    const col = getBMPColor(bmp_mask, cellX, cellY);
    return col[0] > 128;
};
