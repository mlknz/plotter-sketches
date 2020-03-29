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

export function getBMPColor(bmp, x, y) {
    let itr = y * bmp.width * 4 + x * 4;
    return [bmp.data[itr], bmp.data[itr + 1],  bmp.data[itr + 2],  bmp.data[itr + 3]];
};

export function pointInBMPMask(p, width, height, margin, bmp_mask) {
    const cellX = Math.floor(((p[0] - margin) / (width - 2*margin)) * bmp_mask.width);
    const cellY = Math.floor(((p[1] - margin) / (height - 2*margin)) * bmp_mask.height);

    const col = getBMPColor(bmp_mask, cellX, cellY);
    return col[3] > 128;
};
