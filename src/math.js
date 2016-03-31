var PI = Math.PI;
var TAU = PI*2;

function addV2(p1, p2) { return [ p1[0] + p2[0], p1[1] + p2[1] ]; }
function negV2(p1, p2) { return [ p1[0] - p2[0], p1[1] - p2[1] ]; }
function sclV2(p, s) { return [ p[0]*s, p[1]*s ]; }

function sqr(a) { return a*a; }
function lerp(a, b, t) { return a*t + b*(1-t); }

function mod(a, b) {
  var r = a % b;
  if (a < 0 && r != 0) {
    return b + r;
  } else {
    return r;
  }
}
