const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");

const BODY_ORDER = ["tail", "body1", "body2", "body3", "body4", "body5", "chest", "head"];

const BODY_ANGLE_MAX = {
  tail: 25,
  body1: 20,
  body2: 15,
  body3: 10,
  body4: 5,
  body5: 0,
  chest: 0,
  head: 0,
};

const BODY_ANGLE_MIN = {
  tail: 20,
  body1: 16,
  body2: 11,
  body3: 7,
  body4: 2,
  body5: 0,
  chest: 0,
  head: 0,
};

const LEG1_MIN = -35;
const LEG1_MAX = -25;
const LEG2_MIN = -50;
const LEG2_MAX = -35;

const LEG_PHASE_STEP = Math.PI / 4;

// Anchor pixel coordinates (x, y in image space) extracted from each PNG.
// Stored here so that recolouring the sprite sheets won't break joint positions.
// pivot  = the pixel placed at the canvas centre during rotation.
// other  = far end of the segment (where the next body part attaches).
const BODY_ANCHORS = {
  tail:  { pivot: {x:41, y:31}, other: null },
  body1: { pivot: {x:4,  y:31}, other: {x:41, y:31} },
  body2: { pivot: {x:4,  y:31}, other: {x:38, y:31} },
  body3: { pivot: {x:4,  y:31}, other: {x:38, y:31} },
  body4: { pivot: {x:4,  y:31}, other: {x:38, y:31} },
  body5: { pivot: {x:4,  y:31}, other: {x:38, y:31} },
  chest: {
    pivot: {x:4, y:20},
    other: {x:58, y:20},
    // sorted by x asc – matches findPointsByColor order used by the original code
    legAttachments: [
      {x:7,y:29}, {x:12,y:30}, {x:19,y:32}, {x:26,y:33},
      {x:33,y:32}, {x:39,y:31}, {x:45,y:30}, {x:51,y:29},
    ],
  },
  head: {
    pivot:  {x:7,  y:31},
    mouth1: {x:30, y:22},
    mouth2: {x:25, y:26},
    // sorted by rotated-canvas x asc: idx 0 = left (drawn behind head), idx 1 = right (drawn in front)
    hands:  [{x:7, y:34}, {x:11, y:35}],
  },
};

const LEG1_ANCHORS  = { top: {x:31, y:31}, bottom: {x:31, y:39} };
const LEG2_ANCHORS  = { top: {x:31, y:31} };
const MOUTH1_ANCHOR = {x:6,  y:26};
const MOUTH2_ANCHOR = {x:25, y:26};
const HAND1_ANCHORS = { top: {x:31, y:31}, bottom: {x:31, y:39} };
const HAND2_ANCHORS = { top: {x:31, y:31} };

const assetNames = [
  "tail","body1","body2","body3","body4","body5","chest","head",
  "leg1","leg2","mouth1","mouth2","hand1","hand2"
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Rotate `img` so that `pivot` lands exactly at the canvas centre.
function buildRotatedCanvas(img, pivot, angleDeg, canvasSize) {
  const off = document.createElement("canvas");
  off.width = canvasSize;
  off.height = canvasSize;
  const oc = off.getContext("2d");
  oc.imageSmoothingEnabled = false;
  oc.translate(canvasSize / 2, canvasSize / 2);
  oc.rotate(angleDeg * Math.PI / 180);
  oc.drawImage(img, -pivot.x, -pivot.y);
  return off;
}

// Return the canvas-space position of `anchor` after rotating around `pivot`.
// `half` is canvasSize / 2 (the centre coordinate of the square canvas).
function rotateAnchor(pivot, anchor, angleDeg, half) {
  const rad = angleDeg * Math.PI / 180;
  const dx = anchor.x - pivot.x;
  const dy = anchor.y - pivot.y;
  return {
    x: half + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: half + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

async function main() {
  const images = {};
  for (const name of assetNames) {
    images[name] = await loadImage(`./assets/${name}.png`);
  }

  function buildFrame(tSec) {
    const phase = tSec * 2.5;
    const bodyT = (1 - Math.cos(phase)) / 2;

    // ── body chain ──────────────────────────────────────────────────────────
    const bodyCanvas = {};
    const bodyAngle  = {};
    const bodyOther  = {}; // canvas-space position of the far-end anchor
    const bodyWorldPivot = { tail: { x: 0, y: 0 } };

    for (const name of BODY_ORDER) {
      const angle = lerp(BODY_ANGLE_MAX[name], BODY_ANGLE_MIN[name], bodyT);
      const anc = BODY_ANCHORS[name];
      bodyAngle[name]  = angle;
      bodyCanvas[name] = buildRotatedCanvas(images[name], anc.pivot, angle, 220);
      bodyOther[name]  = anc.other
        ? rotateAnchor(anc.pivot, anc.other, angle, 110)
        : { x: 110, y: 110 };
    }

    for (let i = 0; i < BODY_ORDER.length - 1; i++) {
      const prev = BODY_ORDER[i];
      const curr = BODY_ORDER[i + 1];
      bodyWorldPivot[curr] = {
        x: bodyWorldPivot[prev].x + (bodyOther[prev].x - 110),
        y: bodyWorldPivot[prev].y + (bodyOther[prev].y - 110),
      };
    }

    // ── legs ────────────────────────────────────────────────────────────────
    const chestAnc = BODY_ANCHORS.chest;
    const chestAnchorWorld = chestAnc.legAttachments.map(att => {
      const r = rotateAnchor(chestAnc.pivot, att, bodyAngle.chest, 110);
      return {
        x: bodyWorldPivot.chest.x + (r.x - 110),
        y: bodyWorldPivot.chest.y + (r.y - 110),
      };
    });

    const rearLegs = [];
    const frontLegs = [];

    chestAnchorWorld.forEach((anchorWorld, i) => {
      const legPhase = phase - i * LEG_PHASE_STEP;
      const legT = (1 - Math.cos(legPhase)) / 2;
      const leg1Angle = lerp(LEG1_MAX, LEG1_MIN, legT);
      const leg2Angle = lerp(LEG2_MAX, LEG2_MIN, legT);

      const leg1Canvas = buildRotatedCanvas(images.leg1, LEG1_ANCHORS.top, leg1Angle, 140);
      const leg2Canvas = buildRotatedCanvas(images.leg2, LEG2_ANCHORS.top, leg2Angle, 140);

      const leg1PivotWorld = { ...anchorWorld };
      const leg1OtherInCanvas = rotateAnchor(LEG1_ANCHORS.top, LEG1_ANCHORS.bottom, leg1Angle, 70);
      const leg2PivotWorld = {
        x: leg1PivotWorld.x + (leg1OtherInCanvas.x - 70),
        y: leg1PivotWorld.y + (leg1OtherInCanvas.y - 70),
      };

      const target = (i % 2 === 0) ? rearLegs : frontLegs;
      target.push(
        { canvas: leg1Canvas, pivotWorld: leg1PivotWorld, center: 70 },
        { canvas: leg2Canvas, pivotWorld: leg2PivotWorld, center: 70 },
      );
    });

    // ── head attachments (mouths, hands) ────────────────────────────────────
    const headAnc   = BODY_ANCHORS.head;
    const headAngle = bodyAngle.head;

    const mouth1InCanvas = rotateAnchor(headAnc.pivot, headAnc.mouth1, headAngle, 110);
    const mouth2InCanvas = rotateAnchor(headAnc.pivot, headAnc.mouth2, headAngle, 110);
    const mouth1World = {
      x: bodyWorldPivot.head.x + (mouth1InCanvas.x - 110),
      y: bodyWorldPivot.head.y + (mouth1InCanvas.y - 110),
    };
    const mouth2World = {
      x: bodyWorldPivot.head.x + (mouth2InCanvas.x - 110),
      y: bodyWorldPivot.head.y + (mouth2InCanvas.y - 110),
    };
    const mouth1Pos = { x: mouth1World.x - MOUTH1_ANCHOR.x, y: mouth1World.y - MOUTH1_ANCHOR.y };
    const mouth2Pos = { x: mouth2World.x - MOUTH2_ANCHOR.x, y: mouth2World.y - MOUTH2_ANCHOR.y };

    const handRear  = [];
    const handFront = [];

    headAnc.hands.forEach((handAnchorInImage, idx) => {
      const handInCanvas = rotateAnchor(headAnc.pivot, handAnchorInImage, headAngle, 110);
      const anchorWorld = {
        x: bodyWorldPivot.head.x + (handInCanvas.x - 110),
        y: bodyWorldPivot.head.y + (handInCanvas.y - 110),
      };
      const h1Pos = { x: anchorWorld.x - HAND1_ANCHORS.top.x, y: anchorWorld.y - HAND1_ANCHORS.top.y };
      const h1BottomWorld = { x: h1Pos.x + HAND1_ANCHORS.bottom.x, y: h1Pos.y + HAND1_ANCHORS.bottom.y };
      const h2Pos = { x: h1BottomWorld.x - HAND2_ANCHORS.top.x, y: h1BottomWorld.y - HAND2_ANCHORS.top.y };

      const target = idx === 0 ? handRear : handFront;
      target.push(
        { img: images.hand1, pos: h1Pos },
        { img: images.hand2, pos: h2Pos },
      );
    });

    // ── draw operations (z-order) ────────────────────────────────────────────
    const drawOps = [];

    for (const name of ["tail", "body1", "body2", "body3", "body4", "body5"]) {
      drawOps.push({ canvas: bodyCanvas[name], x: bodyWorldPivot[name].x - 110, y: bodyWorldPivot[name].y - 110 });
    }
    for (const item of rearLegs) {
      drawOps.push({ canvas: item.canvas, x: item.pivotWorld.x - item.center, y: item.pivotWorld.y - item.center });
    }
    drawOps.push({ canvas: bodyCanvas.chest, x: bodyWorldPivot.chest.x - 110, y: bodyWorldPivot.chest.y - 110 });
    drawOps.push({ img: images.mouth1, x: mouth1Pos.x, y: mouth1Pos.y });
    drawOps.push({ img: images.mouth2, x: mouth2Pos.x, y: mouth2Pos.y });
    for (const item of handRear) {
      drawOps.push({ img: item.img, x: item.pos.x, y: item.pos.y });
    }
    drawOps.push({ canvas: bodyCanvas.head, x: bodyWorldPivot.head.x - 110, y: bodyWorldPivot.head.y - 110 });
    for (const item of frontLegs) {
      drawOps.push({ canvas: item.canvas, x: item.pivotWorld.x - item.center, y: item.pivotWorld.y - item.center });
    }
    for (const item of handFront) {
      drawOps.push({ img: item.img, x: item.pos.x, y: item.pos.y });
    }

    // ── bounding box ─────────────────────────────────────────────────────────
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const op of drawOps) {
      const w = op.canvas ? op.canvas.width : op.img.width;
      const h = op.canvas ? op.canvas.height : op.img.height;
      minX = Math.min(minX, op.x);
      minY = Math.min(minY, op.y);
      maxX = Math.max(maxX, op.x + w);
      maxY = Math.max(maxY, op.y + h);
    }

    return { drawOps, bounds: { minX, minY, maxX, maxY } };
  }

  function render(tMs) {
    const tSec = tMs / 1000;
    const frame = buildFrame(tSec);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pad = 30;
    const fw = frame.bounds.maxX - frame.bounds.minX + pad * 2;
    const fh = frame.bounds.maxY - frame.bounds.minY + pad * 2;

    const scale = Math.min(canvas.width / fw, canvas.height / fh) * 0.95;
    const ox = (canvas.width - fw * scale) / 2;
    const oy = (canvas.height - fh * scale) / 2;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);

    for (const op of frame.drawOps) {
      const dx = op.x - frame.bounds.minX + pad;
      const dy = op.y - frame.bounds.minY + pad;
      if (op.canvas) ctx.drawImage(op.canvas, dx, dy);
      else ctx.drawImage(op.img, dx, dy);
    }

    ctx.restore();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main().catch(err => {
  console.error(err);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "16px sans-serif";
  ctx.fillText("Error: " + err.message, 20, 30);
});
