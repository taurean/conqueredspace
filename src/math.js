var PI = Math.PI;
var TAU = PI*2;
var X = 0, Y = 1, Z = 2, W =3; // To use as indices
var R = 0, G = 1, B = 2, A =3; // To use as indices

function addV2(p1, p2) { return [ p1[X] + p2[X], p1[Y] + p2[Y] ]; }
function negV2(p1, p2) { return [ p1[X] - p2[X], p1[Y] - p2[Y] ]; }
function sclV2(p, s)   { return [ p[X]*s, p[Y]*s ]; }
function lerpV2(a, b, t) { return [b[X]*t + a[X]*(1-t), b[Y]*t + a[Y]*(1-t)]; }
function normalizeV2(p) {
  var l = Math.sqrt(p[X]*p[X] + p[Y]*p[Y]);
  return [ p[X]/l, p[Y]/l ];
}

function addV3(p1, p2) { return [ p1[X] + p2[X], p1[Y] + p2[Y], p1[Z] + p2[Z] ]; }
function negV3(p1, p2) { return [ p1[X] - p2[X], p1[Y] - p2[Y], p1[Z] - p2[Z] ]; }
function sclV3(p, s)   { return [ p[X]*s, p[Y]*s, p[Z]*s ]; }
function floorV3(v) { return [ Math.floor(v[X]), Math.floor(v[Y]), Math.floor(v[Z]) ]; }
function dotV3(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

function addV4(p1, p2) { return [ p1[X] + p2[X], p1[Y] + p2[Y], p1[Z] + p2[Z], p1[W] + p2[W] ]; }
function negV4(p1, p2) { return [ p1[X] - p2[X], p1[Y] - p2[Y], p1[Z] - p2[Z], p1[W] - p2[W] ]; }
function sclV4(p, s)   { return [ p[X]*s, p[Y]*s, p[Z]*s ]; }
function crossV4(v1, v2) { return [ v1[X]*v2[X], v1[Y]*v2[Y], v1[Z]*v2[Z], v1[W]*v2[W] ]; }

function floorV4(v) { return [ Math.floor(v[X]), Math.floor(v[Y]), Math.floor(v[Z]), Math.floor(v[W]) ]; }

// Slow as fuck linear algebra! :D
// an M4x4 is just 1d array laid out as follows:
/*
[  0,  1,  2,  3,
   4,  5,  6,  7,
   8,  9, 10, 11,
  12, 13, 14, 15,
]
*/

function mulM4x4V(m, v) {
  return [
    m[ 0]*v[X] + m[ 1]*v[Y] + m[ 2]*v[Z] + m[ 3]*v[W],
    m[ 4]*v[X] + m[ 5]*v[Y] + m[ 6]*v[Z] + m[ 7]*v[W],
    m[ 8]*v[X] + m[ 9]*v[Y] + m[10]*v[Z] + m[11]*v[W],
    m[12]*v[X] + m[13]*v[Y] + m[14]*v[Z] + m[15]*v[W],
  ];
}
function homogenizeV4(v) { return [ v[X]/v[W], v[Y]/v[W], v[Z]/v[W] ]; }

function mulM4x4M(a, b) {
  return [
    a[ 0]*b[ 0]+a[ 1]*b[ 4]+a[ 2]*b[ 8]+a[ 3]*b[12], a[ 0]*b[ 1]+a[ 1]*b[ 5]+a[ 2]*b[ 9]+a[ 3]*b[13], a[ 0]*b[ 2]+a[ 1]*b[ 6]+a[ 2]*b[10]+a[ 3]*b[14], a[ 0]*b[ 3]+a[ 1]*b[ 7]+a[ 2]*b[11]+a[ 3]*b[15],
    a[ 4]*b[ 0]+a[ 5]*b[ 4]+a[ 6]*b[ 8]+a[ 7]*b[12], a[ 4]*b[ 1]+a[ 5]*b[ 5]+a[ 6]*b[ 9]+a[ 7]*b[13], a[ 4]*b[ 2]+a[ 5]*b[ 6]+a[ 6]*b[10]+a[ 7]*b[14], a[ 4]*b[ 3]+a[ 5]*b[ 7]+a[ 6]*b[11]+a[ 7]*b[15],
    a[ 8]*b[ 0]+a[ 9]*b[ 4]+a[10]*b[ 8]+a[11]*b[12], a[ 8]*b[ 1]+a[ 9]*b[ 5]+a[10]*b[ 9]+a[11]*b[13], a[ 8]*b[ 2]+a[ 9]*b[ 6]+a[10]*b[10]+a[11]*b[14], a[ 8]*b[ 3]+a[ 9]*b[ 7]+a[10]*b[11]+a[11]*b[15],
    a[12]*b[ 0]+a[13]*b[ 4]+a[14]*b[ 8]+a[15]*b[12], a[12]*b[ 1]+a[13]*b[ 5]+a[14]*b[ 9]+a[15]*b[13], a[12]*b[ 2]+a[13]*b[ 6]+a[14]*b[10]+a[15]*b[14], a[12]*b[ 3]+a[13]*b[ 7]+a[14]*b[11]+a[15]*b[15],
  ];
}




// function lerpV2(a, b, t) { return [b[0]*t+a[0]*(1-t), b[1]*t + a[1]*(1-t)]; }
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
  return 3*t*t - 2*t*t*t;
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