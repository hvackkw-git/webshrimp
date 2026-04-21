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

const FPS = 24;
const LEG_PHASE_STEP = Math.PI / 4;

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

function imageToImageData(img) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const cx = c.getContext("2d", { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  return cx.getImageData(0, 0, img.width, img.height);
}

function findPointsByColor(imageData, kind) {
  const { data, width, height } = imageData;
  const pts = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i + 0];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a === 0) continue;

      let ok = false;
      if (kind === "red") ok = r > 200 && g < 120 && b < 150;
      if (kind === "green") ok = g > 150 && r < 180 && b < 180;
      if (kind === "blue") ok = b > 180 && r < 120 && g < 180;
      if (ok) pts.push({ x, y });
    }
  }
  pts.sort((p, q) => (p.x - q.x) || (p.y - q.y));
  return pts;
}

function buildRotatedCanvas(img, pivot, angleDeg, canvasSize) {
  const off = document.createElement("canvas");
  off.width = canvasSize;
  off.height = canvasSize;
  const oc = off.getContext("2d", { willReadFrequently: true });

  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  oc.clearRect(0, 0, off.width, off.height);
  oc.translate(cx, cy);
  oc.rotate(angleDeg * Math.PI / 180);
  oc.drawImage(img, -pivot.x, -pivot.y);
  oc.setTransform(1, 0, 0, 1, 0, 0);

  const imageData = oc.getImageData(0, 0, off.width, off.height);
  return {
    canvas: off,
    reds: findPointsByColor(imageData, "red"),
    greens: findPointsByColor(imageData, "green"),
    blues: findPointsByColor(imageData, "blue"),
    center: { x: cx, y: cy },
  };
}

function assertPointEq(a, b, label) {
  if (a.x !== b.x || a.y !== b.y) {
    throw new Error(`${label}: (${a.x},${a.y}) != (${b.x},${b.y})`);
  }
}

async function main() {
  const images = {};
  for (const name of assetNames) {
    images[name] = await loadImage(`./assets/${name}.png`);
  }

  const rawMeta = {};
  for (const name of BODY_ORDER) {
    const data = imageToImageData(images[name]);
    const reds = findPointsByColor(data, "red");
    rawMeta[name] = {
      reds,
      greens: findPointsByColor(data, "green"),
      blues: findPointsByColor(data, "blue"),
      leftRed: reds.reduce((a, b) => a.x < b.x ? a : b),
      rightRed: reds.reduce((a, b) => a.x > b.x ? a : b),
    };
  }

  const leg1Data = imageToImageData(images.leg1);
  const leg2Data = imageToImageData(images.leg2);
  const mouth1Data = imageToImageData(images.mouth1);
  const mouth2Data = imageToImageData(images.mouth2);
  const hand1Data = imageToImageData(images.hand1);
  const hand2Data = imageToImageData(images.hand2);

  const leg1Greens = findPointsByColor(leg1Data, "green");
  const leg2Greens = findPointsByColor(leg2Data, "green");
  const mouth1Reds = findPointsByColor(mouth1Data, "red");
  const mouth2Greens = findPointsByColor(mouth2Data, "green");
  const hand1Blues = findPointsByColor(hand1Data, "blue");
  const hand2Blues = findPointsByColor(hand2Data, "blue");

  const leg1Top = leg1Greens.reduce((a, b) => a.y < b.y ? a : b);
  const leg1Bottom = leg1Greens.reduce((a, b) => a.y > b.y ? a : b);
  const leg2Top = leg2Greens[0];
  const mouth1Anchor = mouth1Reds[0];
  const mouth2Anchor = mouth2Greens[0];
  const hand1Top = hand1Blues.reduce((a, b) => a.y < b.y ? a : b);
  const hand1Bottom = hand1Blues.reduce((a, b) => a.y > b.y ? a : b);
  const hand2Top = hand2Blues[0];

  function buildFrame(tSec) {
    const phase = tSec * 2.5;
    const bodyT = (1 - Math.cos(phase)) / 2;

    const bodyParts = {};
    const bodyWorldPivot = { tail: { x: 0, y: 0 } };

    for (const name of BODY_ORDER) {
      const angle = lerp(BODY_ANGLE_MAX[name], BODY_ANGLE_MIN[name], bodyT);
      const pivot = name === "tail" ? rawMeta[name].rightRed : rawMeta[name].leftRed;
      const rot = buildRotatedCanvas(images[name], pivot, angle, 220);
      const pivotAfter = { x: 110, y: 110 };
      const nonPivotReds = rot.reds.filter(p => !(p.x === pivotAfter.x && p.y === pivotAfter.y));
      const otherAfter = nonPivotReds.length
        ? nonPivotReds.reduce((a, b) => {
            const da = (a.x - 110) ** 2 + (a.y - 110) ** 2;
            const db = (b.x - 110) ** 2 + (b.y - 110) ** 2;
            return db > da ? b : a;
          })
        : pivotAfter;

      bodyParts[name] = { ...rot, angle, pivotAfter, otherAfter };
    }

    for (let i = 0; i < BODY_ORDER.length - 1; i++) {
      const prev = BODY_ORDER[i];
      const curr = BODY_ORDER[i + 1];
      const prevOtherWorld = {
        x: bodyWorldPivot[prev].x + (bodyParts[prev].otherAfter.x - 110),
        y: bodyWorldPivot[prev].y + (bodyParts[prev].otherAfter.y - 110),
      };
      bodyWorldPivot[curr] = prevOtherWorld;
    }

    for (let i = 0; i < BODY_ORDER.length - 1; i++) {
      const prev = BODY_ORDER[i];
      const curr = BODY_ORDER[i + 1];
      const prevOtherWorld = {
        x: bodyWorldPivot[prev].x + (bodyParts[prev].otherAfter.x - 110),
        y: bodyWorldPivot[prev].y + (bodyParts[prev].otherAfter.y - 110),
      };
      assertPointEq(prevOtherWorld, bodyWorldPivot[curr], `body ${prev}->${curr}`);
    }

    const chestGreensLocal = bodyParts.chest.greens;
    const chestAnchorWorld = chestGreensLocal.map(p => ({
      x: bodyWorldPivot.chest.x + (p.x - 110),
      y: bodyWorldPivot.chest.y + (p.y - 110),
    }));

    const rearLegs = [];
    const frontLegs = [];

    chestAnchorWorld.forEach((anchorWorld, i) => {
      const legPhase = phase - i * LEG_PHASE_STEP;
      const legT = (1 - Math.cos(legPhase)) / 2;
      const leg1Angle = lerp(LEG1_MAX, LEG1_MIN, legT);
      const leg2Angle = lerp(LEG2_MAX, LEG2_MIN, legT);

      const leg1 = buildRotatedCanvas(images.leg1, leg1Top, leg1Angle, 140);
      const leg2 = buildRotatedCanvas(images.leg2, leg2Top, leg2Angle, 140);

      const leg1PivotWorld = { ...anchorWorld };
      const leg1PivotAfter = { x: 70, y: 70 };
      const leg1NonPivot = leg1.greens.filter(p => !(p.x === 70 && p.y === 70));
      const leg1Other = leg1NonPivot.length
        ? leg1NonPivot.reduce((a, b) => b.y > a.y ? b : a)
        : leg1PivotAfter;

      const leg1OtherWorld = {
        x: leg1PivotWorld.x + (leg1Other.x - 70),
        y: leg1PivotWorld.y + (leg1Other.y - 70),
      };
      const leg2PivotWorld = { ...leg1OtherWorld };

      assertPointEq(anchorWorld, leg1PivotWorld, `chest->leg1 ${i}`);
      assertPointEq(leg1OtherWorld, leg2PivotWorld, `leg1->leg2 ${i}`);

      const target = (i % 2 === 0) ? rearLegs : frontLegs;
      target.push(
        { canvas: leg1.canvas, pivotWorld: leg1PivotWorld, center: 70 },
        { canvas: leg2.canvas, pivotWorld: leg2PivotWorld, center: 70 },
      );
    });

    const headReds = bodyParts.head.reds;
    const headGreens = bodyParts.head.greens;
    const headBlues = [...bodyParts.head.blues].sort((a, b) => (a.x - b.x) || (a.y - b.y));

    const headBodyPivot = { x: 110, y: 110 };
    const headMouth1Local = headReds.filter(p => !(p.x === headBodyPivot.x && p.y === headBodyPivot.y))
      .reduce((a, b) => b.x > a.x ? b : a);
    const headMouth2Local = headGreens[0];

    const mouth1World = {
      x: bodyWorldPivot.head.x + (headMouth1Local.x - 110),
      y: bodyWorldPivot.head.y + (headMouth1Local.y - 110),
    };
    const mouth2World = {
      x: bodyWorldPivot.head.x + (headMouth2Local.x - 110),
      y: bodyWorldPivot.head.y + (headMouth2Local.y - 110),
    };

    const mouth1Pos = { x: mouth1World.x - mouth1Anchor.x, y: mouth1World.y - mouth1Anchor.y };
    const mouth2Pos = { x: mouth2World.x - mouth2Anchor.x, y: mouth2World.y - mouth2Anchor.y };

    assertPointEq({ x: mouth1Pos.x + mouth1Anchor.x, y: mouth1Pos.y + mouth1Anchor.y }, mouth1World, "head->mouth1");
    assertPointEq({ x: mouth2Pos.x + mouth2Anchor.x, y: mouth2Pos.y + mouth2Anchor.y }, mouth2World, "head->mouth2");

    const handRear = [];
    const handFront = [];

    const headBlueWorld = headBlues.map(p => ({
      x: bodyWorldPivot.head.x + (p.x - 110),
      y: bodyWorldPivot.head.y + (p.y - 110),
    }));

    // Left blue anchor -> behind head, right blue anchor -> in front of head
    headBlueWorld.forEach((anchorWorld, idx) => {
      const h1Pos = { x: anchorWorld.x - hand1Top.x, y: anchorWorld.y - hand1Top.y };
      const h1BottomWorld = { x: h1Pos.x + hand1Bottom.x, y: h1Pos.y + hand1Bottom.y };
      const h2Pos = { x: h1BottomWorld.x - hand2Top.x, y: h1BottomWorld.y - hand2Top.y };

      assertPointEq({ x: h1Pos.x + hand1Top.x, y: h1Pos.y + hand1Top.y }, anchorWorld, `head->hand1 ${idx}`);
      assertPointEq({ x: h2Pos.x + hand2Top.x, y: h2Pos.y + hand2Top.y }, h1BottomWorld, `hand1->hand2 ${idx}`);

      const target = idx === 0 ? handRear : handFront;
      target.push(
        { img: images.hand1, pos: h1Pos },
        { img: images.hand2, pos: h2Pos },
      );
    });

    const drawOps = [];

    // back body
    for (const name of ["tail", "body1", "body2", "body3", "body4", "body5"]) {
      drawOps.push({
        type: "body",
        canvas: bodyParts[name].canvas,
        x: bodyWorldPivot[name].x - 110,
        y: bodyWorldPivot[name].y - 110,
      });
    }

    // rear legs behind chest
    for (const item of rearLegs) {
      drawOps.push({
        type: "rot",
        canvas: item.canvas,
        x: item.pivotWorld.x - item.center,
        y: item.pivotWorld.y - item.center,
      });
    }

    // chest
    drawOps.push({
      type: "body",
      canvas: bodyParts.chest.canvas,
      x: bodyWorldPivot.chest.x - 110,
      y: bodyWorldPivot.chest.y - 110,
    });

    // mouths behind head
    drawOps.push({ type: "img", img: images.mouth1, x: mouth1Pos.x, y: mouth1Pos.y });
    drawOps.push({ type: "img", img: images.mouth2, x: mouth2Pos.x, y: mouth2Pos.y });

    // left hand chain behind head
    for (const item of handRear) {
      drawOps.push({ type: "img", img: item.img, x: item.pos.x, y: item.pos.y });
    }

    // head
    drawOps.push({
      type: "body",
      canvas: bodyParts.head.canvas,
      x: bodyWorldPivot.head.x - 110,
      y: bodyWorldPivot.head.y - 110,
    });

    // front legs in front of chest
    for (const item of frontLegs) {
      drawOps.push({
        type: "rot",
        canvas: item.canvas,
        x: item.pivotWorld.x - item.center,
        y: item.pivotWorld.y - item.center,
      });
    }

    // right hand chain in front of head
    for (const item of handFront) {
      drawOps.push({ type: "img", img: item.img, x: item.pos.x, y: item.pos.y });
    }

    // bounds
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
