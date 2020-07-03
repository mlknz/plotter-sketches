// let teethSVGSegments;
// loadsvg('img/lips/teeth_rough.svg', async(err, svg) => {
//   teethSVGSegments = await segments(await linearize(svg, { tolerance: 0 }));
// });

// const lipsUpMaskFunc = entry =>
// {
//     return pointInBMPMask(entry, width, height, margin, lips_up_bmp)
//       || !pointInBMPMask(entry, width, height, margin, lips_down_bmp);
// };

//const lipsUpPolys = voronoiPolysFromPointsAndMask(pointsRandomLips, width, height, margin, lipsUpMaskFunc);


//addSegmentsFromPolys(lipsUpPolys.fullyOutside, lines, lipsOffset, debug);
//addSegmentsFromPolys(lipsUpPolys.partiallyInside, lines, lipsOffset, debug);
//addSegmentsFromPolys(lipsDownPolys.fullyOutside, lines, lipsOffset, debug);
//addSegmentsFromPolys(lipsDownPolys.partiallyInside, lines, lipsOffset, debug);
//console.log("Remove duplicates ", debug.duplicateSegments, "of total ", lines.length + debug.duplicateSegments);

// const mapSegCoords = (seg, offset) => {
//     const x = (seg[0] / svgSize) * (width - margin*2) + margin + offset[0];
//     const y = (seg[1] / svgSize) * (height - margin*2) + margin + offset[1];
//     return [x, y];
// }
//
// teethSVGSegments.forEach(seg => {
//     for (let i = 0; i < seg.length - 1; ++i)
//     {
//         lines.push([mapSegCoords(seg[i], lipsOffset), mapSegCoords(seg[i + 1], lipsOffset)]);
//     }
// });

// const loop = setInterval(() => {
//   const remaining = integrate();
//   if (!remaining) return clearInterval(loop);
//   render();
// }, 33.3);

//context.drawImage(svg_teeth, margin, margin, width - margin, height - margin);
