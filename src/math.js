var PI = Math.PI;
var TAU = PI*2;

function addV2(p1, p2) { return [ p1[0] + p2[0], p1[1] + p2[1] ]; }
function negV2(p1, p2) { return [ p1[0] - p2[0], p1[1] - p2[1] ]; }
function sclV2(p, s) { return [ p[0]*s, p[1]*s ]; }
function lerpV2(a, b, t) { return [b[0]*t + a[0]*(1-t), b[1]*t + a[1]*(1-t)]; }
function normalizeV2(p) {
  var l = Math.sqrt(p[0]*p[0] + p[1]*p[1]);
  return [ p[0]/l, p[1]/l ];
}

function addV3(p1, p2) { return [ p1[0] + p2[0], p1[1] + p2[1], p1[2] + p2[2] ]; }
function negV3(p1, p2) { return [ p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2] ]; }
function sclV3(p, s) { return [ p[0]*s, p[1]*s, p[2]*s ]; }
// function lerpV2(a, b, t) { return [b[0]*t + a[0]*(1-t), b[1]*t + a[1]*(1-t)]; }
// function normalizeV2(p) {
//   var l = Math.sqrt(p[0]*p[0] + p[1]*p[1]);
//   return [ p[0]/l, p[1]/l ];
// }

function sqr(a) { return a*a; }
function lerp(a, b, t) { return a*t + b*(1-t); }
function smoothstep(a, b, t) {
  t = Math.max(a, t);
  t = Math.min(b, t);
  t = (t - a)/(b - a);
  return 3*t*t*t - 2*t*t;
}

function mod(a, b) {
  var r = a % b;
  if (a < 0 && r != 0) {
    return b + r;
  } else {
    return r;
  }
}

function unityNGon(schlafliSymbol) {
  var nGon = Array(schlafliSymbol);
  for (var i = 0; i < schlafliSymbol; ++i) 
    nGon[i] = [Math.cos(i*TAU/schlafliSymbol), Math.sin(i*TAU/schlafliSymbol)];
  return nGon;
}
function unityNGon2(n) {
  var nGon = Array(n);
  for (var i = 0; i < n; ++i) 
    nGon[i] = [Math.cos(i*TAU/n + TAU/(2*n)), Math.sin(i*TAU/n + TAU/(2*n))];
  return nGon;
}

var unityHexagon = unityNGon(6);