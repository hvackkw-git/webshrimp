import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

// Constants mirrored from app.js
const BODY_ORDER = ['tail', 'body1', 'body2', 'body3', 'body4', 'body5', 'chest', 'head'];

const PART_CONFIG = {
  tail: { base: -20, range: 5 },
  body1: { base: -16, range: 4 },
  body2: { base: -11, range: 4 },
  body3: { base: -7, range: 3 },
  body4: { base: -2, range: 3 },
  body5: { base: 0, range: 0 },
  chest: { base: 0, range: 0 },
  head: { base: 0, range: 0 },
  leg1: { base: 5, range: 5 },
  leg2: { base: 5, range: 5 },
};
const LEG_PHASE_STEP = Math.PI / 4;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function bodyT(tSec) {
  const phase = tSec * 2.5;
  return (1 - Math.cos(phase)) / 2;
}

function bodyAngle(name, tSec) {
  const { base, range } = PART_CONFIG[name];
  return lerp(base, base + range, bodyT(tSec));
}

function legAngles(legIndex, tSec) {
  const phase = tSec * 2.5;
  const legPhase = phase - legIndex * LEG_PHASE_STEP;
  const legT = (1 - Math.cos(legPhase)) / 2;
  const { base: leg1Base, range: leg1Range } = PART_CONFIG.leg1;
  const { base: leg2Base, range: leg2Range } = PART_CONFIG.leg2;
  return {
    leg1: lerp(leg1Base, leg1Base + leg1Range, legT),
    leg2: lerp(leg2Base, leg2Base + leg2Range, legT),
  };
}

// ─── lerp ────────────────────────────────────────────────────────────────────

describe('lerp', () => {
  test('t=0 returns a', () => {
    assert.equal(lerp(10, 20, 0), 10);
  });

  test('t=1 returns b', () => {
    assert.equal(lerp(10, 20, 1), 20);
  });

  test('t=0.5 returns midpoint', () => {
    assert.equal(lerp(10, 20, 0.5), 15);
  });

  test('works with negative leg angle values', () => {
    assert.equal(lerp(-35, -25, 0), -35);
    assert.equal(lerp(-35, -25, 1), -25);
  });
});

// ─── bodyT oscillation ───────────────────────────────────────────────────────

describe('bodyT oscillation', () => {
  test('stays within [0, 1] across a 10-second window', () => {
    for (let t = 0; t <= 10; t += 0.05) {
      const v = bodyT(t);
      assert.ok(v >= 0 && v <= 1, `bodyT=${v} out of [0,1] at t=${t}`);
    }
  });

  test('is 0 at phase 0 (t=0)', () => {
    assert.equal(bodyT(0), 0);
  });

  test('reaches 1 at phase π (t=π/2.5)', () => {
    const tAtPi = Math.PI / 2.5;
    assert.ok(Math.abs(bodyT(tAtPi) - 1) < 1e-10);
  });

  test('returns to 0 after one full cycle', () => {
    const period = (2 * Math.PI) / 2.5;
    assert.ok(Math.abs(bodyT(period)) < 1e-10);
  });
});

// ─── body angle bounds ───────────────────────────────────────────────────────

describe('body angle bounds', () => {
  test('every body part stays within its configured [MIN, MAX] range', () => {
    for (const name of BODY_ORDER) {
      const lo = Math.min(PART_CONFIG[name].base, PART_CONFIG[name].base + PART_CONFIG[name].range);
      const hi = Math.max(PART_CONFIG[name].base, PART_CONFIG[name].base + PART_CONFIG[name].range);
      for (let t = 0; t <= 5; t += 0.05) {
        const angle = bodyAngle(name, t);
        assert.ok(
          angle >= lo - 1e-10 && angle <= hi + 1e-10,
          `${name} angle=${angle} outside [${lo}, ${hi}] at t=${t}`,
        );
      }
    }
  });

  test('tail actually moves - angle range spans full configured amplitude', () => {
    const samples = [];
    for (let t = 0; t <= 5; t += 0.05) samples.push(bodyAngle('tail', t));
    const lo = Math.min(...samples);
    const hi = Math.max(...samples);
    assert.ok(
      Math.abs(lo - PART_CONFIG.tail.base) < 0.1 && Math.abs(hi - (PART_CONFIG.tail.base + PART_CONFIG.tail.range)) < 0.1,
      `Tail only swept [${lo}, ${hi}], expected [${PART_CONFIG.tail.base}, ${PART_CONFIG.tail.base + PART_CONFIG.tail.range}]`,
    );
  });

  test('chest and head are always 0 degrees (no body rotation)', () => {
    for (const name of ['chest', 'head']) {
      for (let t = 0; t <= 5; t += 0.5) {
        assert.equal(bodyAngle(name, t), 0, `${name} should always be 0`);
      }
    }
  });

  test('body5 is always 0 degrees (no rotation at body5)', () => {
    for (let t = 0; t <= 5; t += 0.5) {
      assert.equal(bodyAngle('body5', t), 0);
    }
  });

  test('tail amplitude is strictly larger than body4 amplitude', () => {
    const tailRange = PART_CONFIG.tail.range;
    const body4Range = PART_CONFIG.body4.range;
    assert.ok(tailRange > body4Range, `Expected tail range (${tailRange}) > body4 range (${body4Range})`);
  });

  test('animation is periodic - same angle after one full cycle', () => {
    const period = (2 * Math.PI) / 2.5;
    const t0 = 1.0;
    for (const name of BODY_ORDER) {
      const before = bodyAngle(name, t0);
      const after = bodyAngle(name, t0 + period);
      assert.ok(Math.abs(before - after) < 1e-10, `${name} not periodic: ${before} vs ${after}`);
    }
  });

  test('decreasing amplitude from tail toward chest', () => {
    const movingParts = ['tail', 'body1', 'body2', 'body3', 'body4'];
    for (let i = 0; i < movingParts.length - 1; i++) {
      const curr = movingParts[i];
      const next = movingParts[i + 1];
      const currRange = PART_CONFIG[curr].range;
      const nextRange = PART_CONFIG[next].range;
      assert.ok(currRange >= nextRange, `${curr} range (${currRange}) should be >= ${next} range (${nextRange})`);
    }
  });
});

// ─── leg movement ─────────────────────────────────────────────────────────────

describe('leg movement', () => {
  test('leg1 angles stay within [LEG1_MIN, LEG1_MAX] for all legs', () => {
    const leg1Min = Math.min(PART_CONFIG.leg1.base, PART_CONFIG.leg1.base + PART_CONFIG.leg1.range);
    const leg1Max = Math.max(PART_CONFIG.leg1.base, PART_CONFIG.leg1.base + PART_CONFIG.leg1.range);
    for (let i = 0; i < 4; i++) {
      for (let t = 0; t <= 5; t += 0.05) {
        const { leg1 } = legAngles(i, t);
        assert.ok(
          leg1 >= leg1Min - 1e-10 && leg1 <= leg1Max + 1e-10,
          `Leg ${i} leg1=${leg1} outside [${leg1Min}, ${leg1Max}] at t=${t}`,
        );
      }
    }
  });

  test('leg2 angles stay within [LEG2_MIN, LEG2_MAX] for all legs', () => {
    const leg2Min = Math.min(PART_CONFIG.leg2.base, PART_CONFIG.leg2.base + PART_CONFIG.leg2.range);
    const leg2Max = Math.max(PART_CONFIG.leg2.base, PART_CONFIG.leg2.base + PART_CONFIG.leg2.range);
    for (let i = 0; i < 4; i++) {
      for (let t = 0; t <= 5; t += 0.05) {
        const { leg2 } = legAngles(i, t);
        assert.ok(
          leg2 >= leg2Min - 1e-10 && leg2 <= leg2Max + 1e-10,
          `Leg ${i} leg2=${leg2} outside [${leg2Min}, ${leg2Max}] at t=${t}`,
        );
      }
    }
  });

  test('consecutive legs have phase offset of exactly LEG_PHASE_STEP', () => {
    const tSec = 0.3;
    const phase = tSec * 2.5;
    for (let i = 0; i < 3; i++) {
      const phaseI = phase - i * LEG_PHASE_STEP;
      const phaseJ = phase - (i + 1) * LEG_PHASE_STEP;
      const diff = Math.abs(phaseI - phaseJ);
      assert.ok(Math.abs(diff - LEG_PHASE_STEP) < 1e-10);
    }
  });

  test('at the same time, different legs are at different positions (ripple effect)', () => {
    const tSec = 0.5;
    const angles = Array.from({ length: 4 }, (_, i) => legAngles(i, tSec).leg1);
    const allSame = angles.every(a => Math.abs(a - angles[0]) < 1e-10);
    assert.ok(!allSame, `All 4 legs have the same angle at t=${tSec} - no ripple effect`);
  });

  test('each leg sweeps the full leg1 range over time', () => {
    for (let i = 0; i < 4; i++) {
      const samples = [];
      for (let t = 0; t <= 5; t += 0.05) samples.push(legAngles(i, t).leg1);
      const lo = Math.min(...samples);
      const hi = Math.max(...samples);
      assert.ok(
        Math.abs(lo - PART_CONFIG.leg1.base) < 0.1 && Math.abs(hi - (PART_CONFIG.leg1.base + PART_CONFIG.leg1.range)) < 0.1,
        `Leg ${i} only swept leg1=[${lo}, ${hi}], expected [${PART_CONFIG.leg1.base}, ${PART_CONFIG.leg1.base + PART_CONFIG.leg1.range}]`,
      );
    }
  });
});
