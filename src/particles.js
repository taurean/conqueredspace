function initParticles() {
  function startLoop(eventSource, simFn) {
    var handle;

    var lastUpdate;
    function initTimeAndLoop(t){
      lastUpdate = t;
      handle = window.requestAnimationFrame(loop);
    }
    function loop(t) {

      /// TODO: poll input
      var dt = t - lastUpdate;
      lastUpdate = t;
      handle = window.requestAnimationFrame(loop);
      simFn(t, dt);
    }

    window.requestAnimationFrame(initTimeAndLoop);
    return function() {
      window.cancelAnimationFrame(handle);
    }
  }

  var sectorWidth = 250;
  var sectorHeight= 250;
  var sectorDepth = 100;

  var starDensity = 0.00025;
  var starCount = Math.floor(sectorWidth*sectorHeight*starDensity);
  var sectors = Array();

  var horSectorCenters;
  var vertSectorCenters;
  var horSectorCount;
  var vertSectorCount;
  var topLeftSector = [0, 0];
  function generateSectors(){
    horSectorCount = Math.ceil(w / sectorWidth) + 1;
    vertSectorCount = Math.ceil(h / sectorHeight) + 1;
    sectors = Array(horSectorCount);
    horSectorCenters = Array(horSectorCount);
    vertSectorCenters = Array(vertSectorCount);
    for (var i = 0; i < horSectorCount; ++i) {
      horSectorCenters[i] = sectorWidth*i;
      sectors[i] = Array(vertSectorCount);
      for(var j = 0; j < vertSectorCount; ++j) {
        vertSectorCenters[j] = sectorHeight*j;
        var s = sectors[i][j] = Array(starCount);
        fillSector(s, starCount,
          addV2(topLeftSector, [sectorWidth*i, sectorHeight*j]));
      }
    }
  }

  var shiftCount = 0;
  function shiftLeft() {
    var colIndex = mod(horSectorCount - 1 + topLeftSector[0]/sectorWidth, horSectorCount);
    var resetCol = sectors[colIndex];
    topLeftSector[0] -= sectorWidth;
    horSectorCenters[colIndex] = topLeftSector[0];
    for(var i = 0; i < vertSectorCount; ++i) {
      fillSector(resetCol[i], starCount, [ horSectorCenters[colIndex], vertSectorCenters[i] ]);
    }
  }
  function shiftRight() {
    var colIndex = mod(topLeftSector[0]/sectorWidth, horSectorCount);
    var resetCol = sectors[colIndex];
    topLeftSector[0] += sectorWidth;
    horSectorCenters[colIndex] = topLeftSector[0] + sectorWidth*(horSectorCount - 1);
    for(var i = 0; i < vertSectorCount; ++i) {
      fillSector(resetCol[i], starCount, [ horSectorCenters[colIndex], vertSectorCenters[i] ]);
    }
  }
  function shiftUp() {
    var rowIndex = mod(vertSectorCount - 1 + topLeftSector[1]/sectorHeight, vertSectorCount);
    topLeftSector[1] -= sectorHeight;
    vertSectorCenters[rowIndex] = topLeftSector[1];
    for(var i = 0; i < horSectorCount; ++i) {
      fillSector(sectors[i][rowIndex], starCount, [ horSectorCenters[i], vertSectorCenters[rowIndex] ]);
    }
  }
  function shiftDown() {
    var rowIndex = mod(topLeftSector[1]/sectorHeight, vertSectorCount);
    topLeftSector[1] += sectorHeight;
    vertSectorCenters[rowIndex] = sectorHeight*(vertSectorCount - 1) + topLeftSector[1];
    for(var i = 0; i < horSectorCount; ++i) {
      fillSector(sectors[i][rowIndex], starCount, [ horSectorCenters[i], vertSectorCenters[rowIndex]]);
    }
  }

  function fillSector(sector, count, p) {
    var rnd = pseudoRandomGenerator(p[0], p[1], 0);
    for (var i = 0; i < count; ++i)
      sector[i] = [
        p[0] + (0.5 - rnd())*sectorWidth,
        p[1] + (0.5 - rnd())*sectorHeight,
        rnd()*rnd() ];
  }

  var cameraP = [0, 0];
  var cameraSpeed = [-20, 10];

  var m = [0,0];
  document.addEventListener('mousemove', function(e) {
    m = [e.clientX, e.clientY];
  });
  var orientation = [0, 0, 0];
  var orientationAnchor = [0, 0, 0];
  var orientationMeasured = false;
  window.addEventListener('deviceorientation', function initOrientation(e) {
    if (e.gamma !== null) {
      orientationMeasured = true;
      if (!e.absolute) {
        orientationAnchor = [e.alpha, e.beta, e.gamma];
      }
      window.removeEventListener('deviceorientation', initOrientation);
      window.addEventListener('deviceorientation', function(e) {
        orientation = [e.alpha, e.beta, e.gamma];
      });
    }
  });

  /// Initiation
  var renderTarget = document.getElementById("particle-surface");
  renderTarget.width = window.innerWidth;
  renderTarget.height = window.innerHeight;
  var w = renderTarget.width;
  var h = renderTarget.height;
  generateSectors();


  var ctx = renderTarget.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,200,0.4)';

  startLoop(document, function(t, dt) {
    var cameraDP = sclV2(cameraSpeed, dt / 1000);
    cameraP = addV2(cameraP, cameraDP);
    ctx.translate(-cameraDP[0], -cameraDP[1]);
    var sectorOffset = negV2(cameraP, topLeftSector);
    if (sectorOffset[0] <= -(sectorWidth/2)) 
      shiftLeft();
    else if (sectorOffset[0] >= (sectorWidth/2)) 
      shiftRight();

    var screenCenter = [w/2, h/2];
    var cameraCenter = addV2(cameraP, screenCenter);

    if (sectorOffset[1] <= -sectorHeight/2) 
      shiftUp();
    else if (sectorOffset[1] >= sectorHeight/2) 
      shiftDown();

    ctx.clearRect(cameraP[0], cameraP[1], w, h);
    for (var i = 0; i < horSectorCount; ++i) {
      // ctx.fillStyle = [
      //   'rgba(255, 40, 40, 0.5)',
      //   'rgba(40, 255, 40, 0.5)',
      //   'rgba(40, 40, 255, 0.5)',
      //   ][i%3]
      for (var j = 0; j < vertSectorCount; ++j) {
        var s = sectors[i][j];
        for (var k = 0; k < starCount; ++k) {
          ctx.beginPath();
          var z = s[k][2];
          var pZ = 2*(z - 0.5);
          var pX = (cameraCenter[0] - s[k][0])/w*pZ*400;
          var pY = (cameraCenter[1] - s[k][1])/h*pZ*400;
          pX += (0.5 - m[0]/w)*pZ*100;
          pY += (0.5 - m[1]/h)*pZ*100;
          if (orientationMeasured) {
            pX += (orientation[2] - orientationAnchor[2] + 90)/180*pZ*300;
            pY += (orientation[1] - orientationAnchor[1] + 90)/180*pZ*300;
          }
          var x = s[k][0] - pX;
          var y = s[k][1] - pY;
          var r = z*starRadius;
          ctx.arc(x, y, r, 0, TAU);

          ctx.fillStyle = starColors[Math.floor(100*z) % 3];
          ctx.fill();
        }
      }
    }

    hexagons(t, dt);
  });


  var hexagons = (function() {
    
    var loadingT = false;
    var loadingPercent = 0;

    var renderTarget, ctx;
    var r, w, h;
    var n = 6;
    var outerPoints;
    window.updateLogoRenderTarget = function(target) {
      renderTarget = target;
      if (target) {
        ctx = renderTarget.getContext("2d");
        w = renderTarget.width;
        h = renderTarget.height;
        ctx.lineWidth = 1;
        ctx.strokeStyle = "red";
        ctx.translate(w/2, h/2);
        r = Math.min(w, h)/2*0.8;
        outerPoints = Array(n);
        for (var i = 0; i < n; ++i) outerPoints[i] = [r*Math.cos(i*TAU/n), r*Math.sin(i*TAU/n)];
      }
    }

    function index(i) { return (i + n) % n; }
    function hexagons(t, dt) {
      if (!renderTarget) return;

      var i, j;
      if (loadingPercent < 1) {
        loadingPercent += dt/500;

        ctx.clearRect(-w/2, -h/2, w, h);
        ctx.moveTo(outerPoints[0][0], outerPoints[0][1]);
        for (j = 0; j < n; j++) {
          ctx.beginPath();
          var a = outerPoints[index(j - 1)];
          var b = outerPoints[index(j)];
          var ab = negV2(b, a);

          ab = addV2(a, sclV2(ab, sqr(loadingPercent)));

          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(ab[0], ab[1]);
          ctx.stroke();
        }
        // ctx.closePath();
      } else {
        if (!loadingT) {
          loadingT = t;
          document.body.className = "";
          return;
        }

        var stageCount = 6;
        var bezierStages = Array(stageCount);
        var d = (t - loadingT) / 1500; 
        d = Math.min(d*d, 0.1)
        bezierStages[0] = outerPoints;
        for (i = 1; i < stageCount; ++i) {
            var stage = Array(n);
            for (var j = 0; j < n; ++j) {
                var a = bezierStages[i - 1][index(j - 1)];
                var b = bezierStages[i - 1][index(j)];
                var ab = negV2(b, a);

                stage[j] = addV2(a, sclV2(ab, d));
            }
            bezierStages[i] = stage;
        }

        ctx.clearRect(-w/2, -h/2, w, h);
        for (i = 0; i < stageCount; ++i) {
            ctx.beginPath();
            ctx.moveTo(bezierStages[i][0][0], bezierStages[i][0][1]);
            for (j = 1; j < n; j++) {
                ctx.lineTo(bezierStages[i][index(j)][0], bezierStages[i][index(j)][1]);
            }
            ctx.closePath();
            ctx.stroke();
        }
      }
    }

    return hexagons;
  })();
}

var starRadius = 3;
var starColors = [
  "#B79AB2",
  "#9D483D",
  "#BF817B"
];

function pseudoRandomGenerator(x, y, z) {
  if (x == 0) x = 2824242;
  if (y == 0) y = 3752057;
  if (z == 0) z = 5710753;

  return function() {
    x += (171 * x) % 30269;
    y += (172 * y) % 30307;
    z += (170 * z) % 30323;
    return (x/30269.0 + y/30307.0 + z/30323.0) % 1.0;
  }
}

