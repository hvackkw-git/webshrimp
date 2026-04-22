const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");

const partsGrid = document.getElementById("partsGrid");
const configText = document.getElementById("configText");
const applyConfigBtn = document.getElementById("applyConfig");
const configStatus = document.getElementById("configStatus");

const BODY_ORDER = ["tail", "body1", "body2", "body3", "body4", "body5", "chest", "head"];
const PART_ORDER = [...BODY_ORDER, "leg1", "leg2", "mouth1", "mouth2", "hand1", "hand2"];

const PART_CONFIG_DEFAULTS = {
  tail: { base: -20, range: 5, forwardSpeed: 4, backwardSpeed: 5 },
  body1: { base: -16, range: 4, forwardSpeed: 4, backwardSpeed: 5 },
  body2: { base: -11, range: 4, forwardSpeed: 4, backwardSpeed: 5 },
  body3: { base: -7, range: 3, forwardSpeed: 4, backwardSpeed: 5 },
  body4: { base: -2, range: 3, forwardSpeed: 4, backwardSpeed: 5 },
  body5: { base: 0, range: 0, forwardSpeed: 4, backwardSpeed: 5 },
  chest: { base: 0, range: 0, forwardSpeed: 4, backwardSpeed: 5 },
  head: { base: 0, range: 0, forwardSpeed: 4, backwardSpeed: 5 },
  leg1: { base: 5, range: 5, forwardSpeed: 4, backwardSpeed: 5 },
  leg2: { base: 5, range: 5, forwardSpeed: 4, backwardSpeed: 5 },
  mouth1: { base: 0, range: 0, forwardSpeed: 4, backwardSpeed: 5 },
  mouth2: { base: 0, range: 0, forwardSpeed: 4, backwardSpeed: 5 },
  hand1: { base: 0, range: 0, forwardSpeed: 4, backwardSpeed: 5 },
  hand2: { base: 0, range: 0, forwardSpeed: 4, backwardSpeed: 5 },
};

const partConfig = Object.fromEntries(
  PART_ORDER.map(name => [name, { ...PART_CONFIG_DEFAULTS[name] }]),
);

const LEG_TIME_OFFSET = (Math.PI / 4) / 2.5;
const MIN_SPEED = 0.001;

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

function normalizeNumber(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

function formatNumber(value) {
  const n = normalizeNumber(value);
  return String(n);
}

function buildConfigText() {
  return PART_ORDER.map(name => {
    const conf = partConfig[name];
    return `${name} = (${formatNumber(conf.base)}, ${formatNumber(conf.range)}),(${formatNumber(conf.forwardSpeed)}, ${formatNumber(conf.backwardSpeed)});`;
  }).join("\n");
}

function setStatus(message, isError = false) {
  configStatus.textContent = message;
  configStatus.style.color = isError ? "#ff8383" : "#a7ffad";
}

function parseConfigText(rawText) {
  const lines = rawText
    .split(";")
    .map(v => v.trim())
    .filter(Boolean);

  const nextConfig = Object.fromEntries(
    PART_ORDER.map(name => [name, { ...partConfig[name] }]),
  );

  const seen = new Set();
  for (const line of lines) {
    const match = line.match(/^([a-zA-Z0-9_]+)\s*=\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)\s*(?:,\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\))?$/);
    if (!match) {
      throw new Error(`형식 오류: ${line};`);
    }

    const [, name, baseRaw, rangeRaw, forwardSpeedRaw, backwardSpeedRaw] = match;
    if (!(name in nextConfig)) {
      throw new Error(`알 수 없는 파츠: ${name}`);
    }
    if (seen.has(name)) {
      throw new Error(`중복 파츠: ${name}`);
    }

    seen.add(name);
    nextConfig[name] = {
      base: normalizeNumber(Number(baseRaw)),
      range: normalizeNumber(Number(rangeRaw)),
      forwardSpeed: normalizeNumber(Number(forwardSpeedRaw ?? nextConfig[name].forwardSpeed)),
      backwardSpeed: normalizeNumber(Number(backwardSpeedRaw ?? nextConfig[name].backwardSpeed)),
    };
  }

  return nextConfig;
}

function angleByConfig(name, tValue) {
  const conf = partConfig[name];
  return lerp(conf.base, conf.base + conf.range, tValue);
}

function travelProgressByConfig(conf, tSec) {
  const amplitude = Math.abs(conf.range);
  if (amplitude === 0) return 0;

  const forwardSpeed = Math.max(Math.abs(conf.forwardSpeed), MIN_SPEED);
  const backwardSpeed = Math.max(Math.abs(conf.backwardSpeed), MIN_SPEED);
  const forwardDuration = amplitude / forwardSpeed;
  const backwardDuration = amplitude / backwardSpeed;
  const cycleDuration = forwardDuration + backwardDuration;
  const cycleT = ((tSec % cycleDuration) + cycleDuration) % cycleDuration;

  if (cycleT <= forwardDuration) {
    return cycleT / forwardDuration;
  }
  return 1 - (cycleT - forwardDuration) / backwardDuration;
}

function syncTextFromConfig() {
  configText.value = buildConfigText();
}

function syncInputsFromConfig() {
  for (const name of PART_ORDER) {
    const baseInput = document.getElementById(`base-${name}`);
    const rangeInput = document.getElementById(`range-${name}`);
    const forwardSpeedInput = document.getElementById(`forwardSpeed-${name}`);
    const backwardSpeedInput = document.getElementById(`backwardSpeed-${name}`);
    if (!baseInput || !rangeInput || !forwardSpeedInput || !backwardSpeedInput) continue;
    baseInput.value = formatNumber(partConfig[name].base);
    rangeInput.value = formatNumber(partConfig[name].range);
    forwardSpeedInput.value = formatNumber(partConfig[name].forwardSpeed);
    backwardSpeedInput.value = formatNumber(partConfig[name].backwardSpeed);
  }
}

function renderConfigInputs() {
  const header = document.createElement("div");
  header.className = "part-row part-row-head";
  header.innerHTML = `
    <span>part</span>
    <span>base</span>
    <span>range</span>
    <span>go</span>
    <span>back</span>
  `;
  partsGrid.appendChild(header);

  for (const name of PART_ORDER) {
    const row = document.createElement("label");
    row.className = "part-row";
    row.innerHTML = `
      <span>${name}</span>
      <input id="base-${name}" type="number" step="0.1" value="${formatNumber(partConfig[name].base)}" aria-label="${name} base" />
      <input id="range-${name}" type="number" step="0.1" value="${formatNumber(partConfig[name].range)}" aria-label="${name} range" />
      <input id="forwardSpeed-${name}" type="number" step="0.1" value="${formatNumber(partConfig[name].forwardSpeed)}" aria-label="${name} forward speed" />
      <input id="backwardSpeed-${name}" type="number" step="0.1" value="${formatNumber(partConfig[name].backwardSpeed)}" aria-label="${name} backward speed" />
    `;
    partsGrid.appendChild(row);
  }

  partsGrid.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const idMatch = target.id.match(/^(base|range|forwardSpeed|backwardSpeed)-(.+)$/);
    if (!idMatch) return;

    const [, field, name] = idMatch;
    if (!(name in partConfig)) return;

    partConfig[name][field] = normalizeNumber(Number(target.value));
    syncTextFromConfig();
    setStatus("입력값이 즉시 반영되었습니다.");
  });
}

function applyTextConfig() {
  try {
    const parsed = parseConfigText(configText.value);
    for (const name of PART_ORDER) {
      partConfig[name] = parsed[name];
    }
    syncInputsFromConfig();
    syncTextFromConfig();
    setStatus("텍스트 설정을 반영했습니다.");
  } catch (error) {
    setStatus(error.message, true);
  }
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
  renderConfigInputs();
  syncTextFromConfig();
  setStatus("기본 설정 로드 완료");
  applyConfigBtn.addEventListener("click", applyTextConfig);

  const images = {};
  for (const name of assetNames) {
    images[name] = await loadImage(`./assets/${name}.png`);
  }

  function buildFrame(tSec) {
    // ── body chain ──────────────────────────────────────────────────────────
    const bodyCanvas = {};
    const bodyAngle  = {};
    const bodyOther  = {}; // canvas-space position of the far-end anchor
    const bodyWorldPivot = { tail: { x: 0, y: 0 } };

    for (const name of BODY_ORDER) {
      const angle = angleByConfig(name, travelProgressByConfig(partConfig[name], tSec));
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
    const chestOffset = { ...bodyWorldPivot.chest };
    for (const name of BODY_ORDER) {
      bodyWorldPivot[name] = {
        x: bodyWorldPivot[name].x - chestOffset.x,
        y: bodyWorldPivot[name].y - chestOffset.y,
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
      const legTime = tSec - i * LEG_TIME_OFFSET;
      const legT = travelProgressByConfig(partConfig.leg1, legTime);
      const leg1Angle = angleByConfig("leg1", legT);
      const leg2Angle = angleByConfig("leg2", travelProgressByConfig(partConfig.leg2, legTime));

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
    const mouth1Angle = angleByConfig("mouth1", travelProgressByConfig(partConfig.mouth1, tSec));
    const mouth2Angle = angleByConfig("mouth2", travelProgressByConfig(partConfig.mouth2, tSec));
    const hand1Angle = angleByConfig("hand1", travelProgressByConfig(partConfig.hand1, tSec));
    const hand2Angle = angleByConfig("hand2", travelProgressByConfig(partConfig.hand2, tSec));

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
    const mouth1Canvas = buildRotatedCanvas(images.mouth1, MOUTH1_ANCHOR, mouth1Angle, 140);
    const mouth2Canvas = buildRotatedCanvas(images.mouth2, MOUTH2_ANCHOR, mouth2Angle, 140);

    const handRear  = [];
    const handFront = [];

    headAnc.hands.forEach((handAnchorInImage, idx) => {
      const handInCanvas = rotateAnchor(headAnc.pivot, handAnchorInImage, headAngle, 110);
      const anchorWorld = {
        x: bodyWorldPivot.head.x + (handInCanvas.x - 110),
        y: bodyWorldPivot.head.y + (handInCanvas.y - 110),
      };
      const hand1Canvas = buildRotatedCanvas(images.hand1, HAND1_ANCHORS.top, hand1Angle, 140);
      const hand1OtherInCanvas = rotateAnchor(HAND1_ANCHORS.top, HAND1_ANCHORS.bottom, hand1Angle, 70);
      const hand1PivotWorld = { ...anchorWorld };
      const hand2PivotWorld = {
        x: hand1PivotWorld.x + (hand1OtherInCanvas.x - 70),
        y: hand1PivotWorld.y + (hand1OtherInCanvas.y - 70),
      };
      const hand2Canvas = buildRotatedCanvas(images.hand2, HAND2_ANCHORS.top, hand2Angle, 140);

      const target = idx === 0 ? handRear : handFront;
      target.push(
        { canvas: hand1Canvas, pivotWorld: hand1PivotWorld, center: 70 },
        { canvas: hand2Canvas, pivotWorld: hand2PivotWorld, center: 70 },
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
    drawOps.push({ canvas: mouth1Canvas, x: mouth1World.x - 70, y: mouth1World.y - 70 });
    drawOps.push({ canvas: mouth2Canvas, x: mouth2World.x - 70, y: mouth2World.y - 70 });
    for (const item of handRear) {
      drawOps.push({ canvas: item.canvas, x: item.pivotWorld.x - item.center, y: item.pivotWorld.y - item.center });
    }
    drawOps.push({ canvas: bodyCanvas.head, x: bodyWorldPivot.head.x - 110, y: bodyWorldPivot.head.y - 110 });
    for (const item of frontLegs) {
      drawOps.push({ canvas: item.canvas, x: item.pivotWorld.x - item.center, y: item.pivotWorld.y - item.center });
    }
    for (const item of handFront) {
      drawOps.push({ canvas: item.canvas, x: item.pivotWorld.x - item.center, y: item.pivotWorld.y - item.center });
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
