var starSystem = (function() {

  // I got this from the internet somehere and modified it slightly to deal with negative and zero seeds. It is janky
  // as hell, but (barely) good enough for now.
  function pseudoRandomGenerator(x, y, z) {
    if (x == 0) x = 2824242;
    if (y == 0) y = 3752057;
    if (z == 0) z = 5710753;

    return function() {
      x += (171 * x) % 30269;
      y += (172 * y) % 30307;
      z += (170 * z) % 30323;
      return Math.abs(x/30269.0 + y/30307.0 + z/30323.0) % 1.0;
    }
  }

  var renderTarget, ctx;
  var cameraP   = [0, 0, 0];
  var cameraDP  = [0, 0, 0];
  var sectorDim = [50, 50, 50];
  var maxStarCountPerSector = 100;

  var avgStarRadius = 1;
  var avgRadiusDeviation = 4;
  var starPalette = [
    "#B79AB2",
    "#9D483D",
    "#BF817B"
  ];
  var prevMDownT = 0;
  function renderAndUpdateStars(input) {

    if (input.viewportDirty) {
      renderTarget.width = input.viewportDim[X];
      renderTarget.height = input.viewportDim[Y];
    }

    var _cameraDP = [
      -10*input.dMAt[X],
      -10*input.dMAt[Y],
      input.dScrollAt[Y]
    ];
    if (input.mDown) {
      var mDownDT = input.t - prevMDownT;
      if (2*input.dT < mDownDT && mDownDT < 300) _cameraDP[Z] = -500;
      prevMDownT = input.t;
    }

    var speedSq = dotV3(cameraDP, cameraDP);
    if (input.mDown && dotV3(_cameraDP, _cameraDP) > 0 || _cameraDP[Z]) {
      cameraDP = _cameraDP;
    } else if (-10 < speedSq && speedSq < 10) {
      cameraDP = [-2, 1, -2];
    } else {
      var cameraDDP = sclV3(cameraDP, -5);
      cameraDP = addV3(cameraDP, sclV3(cameraDDP, input.dT/1000));
    }

    cameraP = addV3(cameraP, sclV3(cameraDP, input.dT/1000));

    var _cameraP = [
      cameraP[X] + (0.5 - input.mAt[X]/input.viewportDim[X])*10,
      cameraP[Y] + (0.5 - input.mAt[Y]/input.viewportDim[Y])*10,
      cameraP[Z] //+ (input.scrollAt[Y]/100)
    ];

    var viewportHalfDim = sclV2(input.viewportDim, 0.5);
    var viewVolumeNear = [ -viewportHalfDim[X],  viewportHalfDim[Y],  -10 ]; // z values pulled out of my ass.
    var viewVolumeFar  = [  viewportHalfDim[X], -viewportHalfDim[Y], -200 ];

    var viewportTransform = [
      viewportHalfDim[X], 0, 0, viewportHalfDim[X],
      0, viewportHalfDim[Y], 0, viewportHalfDim[Y],
      0, 0, 1, 0,
      0, 0, 0, 1
    ];

    var n = -2;
    var f = -200;
    var fov = (120/360)*TAU;
    var t = Math.tan(fov/2)*Math.abs(n);
    var b = -t;
    var r = (input.viewportDim[X]/input.viewportDim[Y])*t;
    var l = -r;

    var perspectiveTransform = [
      n*2/(r - l),           0, (l + r)/(l - r),             0,
                0, n*2/(t - b), (b + t)/(b - t),             0,
                0,           0, (f + n)/(n - f), f*n*2/(f - n),
                0,           0,               1,             0
    ];

    var cameraTransform = [
      1, 0, 0, -_cameraP[X],
      0, 1, 0, -_cameraP[Y],
      0, 0, 1, -_cameraP[Z],
      0, 0, 0,           1,
    ];

    var transform = mulM4x4M(mulM4x4M(viewportTransform, perspectiveTransform), cameraTransform);
    ctx.clearRect(0, 0, input.viewportDim[X], input.viewportDim[Y]);

    var sectorHalfDim = sclV4(sectorDim, 0.5);
    // we only do AABB viewVolumes

    var nearSector = [
      Math.floor((_cameraP[X] + l)/sectorDim[X]) - 1.5,
      Math.floor((_cameraP[Y] + b)/sectorDim[Y]) - 1.5,
      Math.floor((_cameraP[Z] + n)/sectorDim[Z]) + 1.5,
    ];
    var farSector = [
      Math.ceil((_cameraP[X] + r)/sectorDim[X]) + 1.5,
      Math.ceil((_cameraP[Y] + t)/sectorDim[Y]) + 1.5,
      Math.ceil((_cameraP[Z] + f)/sectorDim[Z]) - 1.5,
    ];
    for (var sectorX = nearSector[X]; sectorX <= farSector[X]; ++sectorX) {
      for (var sectorY = nearSector[Y]; sectorY <= farSector[Y]; ++sectorY) {
        for (var sectorZ = nearSector[Z]; sectorZ >= farSector[Z]; --sectorZ) {
          var sectorP = [
            sectorX*sectorDim[X],
            sectorY*sectorDim[Y],
            sectorZ*sectorDim[Z],
            1
          ];

          ctx.globalAlpha = smoothstep(_cameraP[Z] + f, _cameraP[Z] + n, sectorP[Z]);

          var sectorGenerator = pseudoRandomGenerator(sectorX, sectorY, sectorZ);
          for (var i = 0; i < 2; ++i) {
            var starP = addV4(sectorP, [
              sectorGenerator()*sectorDim[X] - sectorHalfDim[X],
              sectorGenerator()*sectorDim[Y] - sectorHalfDim[Y],
              sectorGenerator()*sectorDim[Z] - sectorHalfDim[Z],
              0
            ]);
            var starColor = starPalette[Math.floor(sectorGenerator()*starPalette.length)];

            var starPInSpace = homogenizeV4(mulM4x4V(transform, starP));

            var starSize = 0; // what's a reasonable value for this?
            for (var j = 0; j < avgStarRadius*avgRadiusDeviation; ++j) starSize += sectorGenerator();
            starSize /= avgRadiusDeviation;

            if (starP[Z] > _cameraP[Z] + n) continue;
            starSize = homogenizeV4(mulM4x4V(transform, [starP[X] + starSize, 0, starP[Z], 1]))[X] - starPInSpace[X];

            ctx.beginPath();
            ctx.arc(starPInSpace[X], starPInSpace[Y], starSize, 0, TAU);
            ctx.closePath();
            ctx.fillStyle = starColor;
            ctx.fill();
          }

        }
      }
    }

  }

  function initialize(_renderTarget) {
    renderTarget = _renderTarget;
    ctx = renderTarget.getContext('2d');
  }

  return {
    initialize: initialize,
    update: renderAndUpdateStars
  };
})();


var logoSystem = (function() {
  var ctx, renderTarget;
  var dim, halfDim, r;

  var vertCount = 6;
  var unitPolygon = Array(vertCount);
  var stageCount = vertCount;
  var bezierStages = Array(stageCount);
  function index(i) { return (i + vertCount) % vertCount; }


  for (var i = 0; i < vertCount; ++i) {
    unitPolygon[i] = [Math.cos(TAU*i/vertCount), Math.sin(TAU*i/vertCount)];
    bezierStages[i] = Array(vertCount);
  }
  bezierStages[0] = unitPolygon;

  var loadingT = false;
  var loadingPercent = 0;


  function initialize(_renderTarget) {
    renderTarget = _renderTarget;
    if (!renderTarget) return;

    ctx = renderTarget.getContext('2d');
    dim = [renderTarget.width, renderTarget.height];
    halfDim = sclV2(dim, 0.5);
    r = 0.5*Math.min(dim[X], dim[Y]) ;

    ctx.translate(halfDim[X], halfDim[Y]);
    ctx.scale(r, r);
    ctx.lineWidth = 1/r;

    ctx.strokeStyle = 'red';
  }

  function update(input) {
    if (!renderTarget) return;

    var i, j;
    if (loadingPercent < 1) {
      loadingPercent += input.dT/500;

      ctx.clearRect(-halfDim[X], -halfDim[Y], dim[X], dim[Y]);
      ctx.moveTo(unitPolygon[0][0], unitPolygon[0][1]);
      for (j = 0; j < vertCount; j++) {
        ctx.beginPath();
        var a = unitPolygon[index(j - 1)];
        var b = unitPolygon[index(j)];
        var ab = lerpV2(a, b, sqr(loadingPercent));

        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(ab[0], ab[1]);
        ctx.stroke();
      }
    } else {
      if (!loadingT) {
        loadingT = input.t;
        document.body.className = "";
        return;
      }

      var d = (input.t - loadingT)/1500;
      d = Math.min(d*d, 0.1)
      if (d <= 1) {
        for (i = 1; i < stageCount; ++i) {
          for (j = 0; j < vertCount; ++j) {
            var a = bezierStages[i - 1][index(j - 1)];
            var b = bezierStages[i - 1][index(j)];
            bezierStages[i][j] = lerpV2(a, b, d);
          }
        }
      }

      ctx.clearRect(-halfDim[X], -halfDim[Y], dim[X], dim[Y]);
      for (i = 0; i < stageCount; ++i) {
        ctx.beginPath();
        ctx.moveTo(bezierStages[i][0][0], bezierStages[i][0][1]);
        for (j = 1; j < vertCount; j++)
          ctx.lineTo(bezierStages[i][index(j)][0], bezierStages[i][index(j)][1]);

        ctx.closePath();
        ctx.stroke();
      }
    }
  }
  return {
    initialize: initialize,
    update: update,
  };
})();