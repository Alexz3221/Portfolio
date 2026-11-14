/* A compact local replay of the player's fastest completed stunt-course lap. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrivePersonalBest = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const KEY = 'car-go-vroom:personal-best:v1';
  const DT = 1 / 20;
  const MAX_SECONDS = 900;
  const MAX_CHARS = 2_000_000;
  const finite = Number.isFinite;
  const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function validTrace(trace) {
    if (!trace || typeof trace !== 'object' || !/^[a-z0-9]+$/.test(trace.car || '')) return false;
    if (!finite(trace.dt) || trace.dt < 1 / 60 || trace.dt > .2 ||
        !finite(trace.lapTime) || trace.lapTime <= 0 || trace.lapTime > MAX_SECONDS ||
        !finite(trace.duration) || trace.duration < trace.lapTime - trace.dt ||
        !finite(trace.routeLength) || trace.routeLength <= 0 ||
        !Array.isArray(trace.frames) || trace.frames.length < 2 || trace.frames.length > MAX_SECONDS * 60 + 2 ||
        Math.abs(trace.duration - (trace.frames.length - 1) * trace.dt) > .001) return false;
    let progress = -Infinity;
    for (const frame of trace.frames) {
      if (!Array.isArray(frame) || frame.length !== 8 || frame.some(value => !finite(value)) ||
          frame[7] < progress || frame[7] > trace.routeLength + .01) return false;
      progress = frame[7];
    }
    return Math.abs(progress - trace.routeLength) < .01;
  }

  function create(options = {}) {
    const key = options.key || KEY;
    let storage = options.storage;
    if (storage === undefined) {
      try { storage = globalThis.localStorage; } catch (_) { storage = null; }
    }
    let best = null;
    try {
      const raw = storage?.getItem(key);
      if (raw && raw.length <= MAX_CHARS) {
        const parsed = JSON.parse(raw);
        if (validTrace(parsed)) best = parsed;
      }
    } catch (_) { /* Storage may be blocked; the current session still works. */ }

    let capture = null;
    function start(car) {
      capture = /^[a-z0-9]+$/.test(car || '') ? {
        car, frames: [], last: null, nextSample: DT, valid: true
      } : null;
    }
    function cancel() { capture = null; }
    function encodeFrame(observation) {
      const p = observation.position, q = observation.quaternion;
      return [
        round(p.x, 3), round(p.y, 3), round(p.z, 3),
        round(q.x, 4), round(q.y, 4), round(q.z, 4), round(q.w, 4),
        round(observation.progress, 3)
      ];
    }
    function addFrame(observation) { capture.frames.push(encodeFrame(observation)); }
    function record(elapsed, position, quaternion, progress) {
      if (!capture || !capture.valid) return;
      if (!finite(elapsed) || elapsed < 0 || elapsed > MAX_SECONDS ||
          !position || !quaternion ||
          ![position.x, position.y, position.z, quaternion.x, quaternion.y,
            quaternion.z, quaternion.w, progress].every(finite) || progress < 0) {
        capture.valid = false; return;
      }
      const current = {
        time: elapsed,
        position: {x: position.x, y: position.y, z: position.z},
        quaternion: {x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w},
        progress: Math.max(progress, capture.last?.progress || 0)
      };
      const previous = capture.last;
      if (previous && elapsed < previous.time) { capture.valid = false; return; }
      if (!previous) {
        addFrame(current);
      } else if (elapsed > previous.time) {
        while (capture.nextSample <= elapsed + 1e-8) {
          const alpha = clamp((capture.nextSample - previous.time) / (elapsed - previous.time), 0, 1);
          const p = {
            x: previous.position.x + (current.position.x - previous.position.x) * alpha,
            y: previous.position.y + (current.position.y - previous.position.y) * alpha,
            z: previous.position.z + (current.position.z - previous.position.z) * alpha
          };
          const a = previous.quaternion, b = current.quaternion;
          const sign = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w < 0 ? -1 : 1;
          const q = {
            x: a.x + (sign * b.x - a.x) * alpha,
            y: a.y + (sign * b.y - a.y) * alpha,
            z: a.z + (sign * b.z - a.z) * alpha,
            w: a.w + (sign * b.w - a.w) * alpha
          };
          const norm = Math.hypot(q.x, q.y, q.z, q.w) || 1;
          for (const axis of ['x', 'y', 'z', 'w']) q[axis] /= norm;
          addFrame({position: p, quaternion: q,
            progress: previous.progress + (current.progress - previous.progress) * alpha});
          capture.nextSample += DT;
          if (capture.frames.length > MAX_SECONDS / DT + 2) { capture.valid = false; break; }
        }
      }
      capture.last = current;
    }
    function finish(elapsed) {
      const finished = capture;
      capture = null;
      if (!finished?.valid || !finished.last || !finite(elapsed) || elapsed <= 0 ||
          elapsed > MAX_SECONDS || finished.frames.length === 0 ||
          elapsed + 1e-8 < finished.last.time || finished.last.progress <= 0) {
        return {improved: false, best};
      }
      if (best && elapsed >= best.lapTime - 1e-8) return {improved: false, best};
      // Keep a constant sample interval; the final frame reaches the finish even
      // when the actual lap ends between two 20 Hz sample times.
      const frames = finished.frames;
      const finalFrame = encodeFrame(finished.last);
      if (elapsed > (frames.length - 1) * DT + 1e-8 || frames.length === 1) frames.push(finalFrame);
      else frames[frames.length - 1] = finalFrame;
      const routeLength = round(finished.last.progress, 3);
      frames.at(-1)[7] = routeLength;
      const trace = {
        car: finished.car, dt: DT, lapTime: round(elapsed, 6),
        duration: round((frames.length - 1) * DT, 6), routeLength, frames
      };
      if (!validTrace(trace)) return {improved: false, best};
      best = trace;
      let saved = false;
      try { storage?.setItem(key, JSON.stringify(trace)); saved = !!storage; }
      catch (_) { /* Keep the best lap for this session if storage is full. */ }
      return {improved: true, best, saved};
    }
    return {get best() { return best; }, start, record, finish, cancel};
  }

  return {create, validTrace, KEY};
});
