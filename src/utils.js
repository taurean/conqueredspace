

///
/// Debug
///

/// TOOD: move this section to a separate file, that can easily be switched out in different environments, to turn off stuff.
if (!console.err) { console.err = console.log; }

function assert(a, s) { if (!a) { alert("assert fired! \n" + s); debugger; } }
function invalidCodePath() { alert("invalid code path reached"); debugger; }
function notImplemented() { alert("called a function that is not implemented yet"); debugger; }


///
/// Networking
///

function encodeMap(data) {
  var encodedData = "";
  for (var dataKey in data) {
    var encodedKey = encodeURIComponent(dataKey);
    var d = data[dataKey];
    /// TODO: more robust array detection?
    if (d && d.length && typeof d != 'string') {
      for (var i = 0; i < d.length; ++i) {
        encodedData += encodedKey + "=" + encodeURIComponent(d[i]) + "&";
      }
    } else {
      encodedData += encodedKey + "=" + encodeURIComponent(d) + "&";
    }
  }
  return encodedData;
}

function openXhr(method, url, cb, headers) {
  var x = new XMLHttpRequest();
  x.open(method, url);
  for (var header in headers) x.setRequestHeader(header, headers[header]);
  x.onreadystatechange = function() { if (x.readyState === x.DONE) cb(x.status, x.response); };
  return x;
}
function GET(url, data, cb, headers) {
  headers = headers || {};
  headers["Content-type"] = "application/x-www-form-urlencoded";
  openXhr('GET', url + '?' + encodeMap(data), cb, headers).send();
}
function PUT(url, data, cb, headers) {
  headers = headers || {};
  headers["Content-type"] = "application/x-www-form-urlencoded";
  openXhr('PUT', url + '?' + encodeMap(data), cb, headers).send();
}
function POST(url, data, cb, headers) {
  headers = headers || {};
  headers["Content-type"] = "application/x-www-form-urlencoded";
  openXhr('POST', url, cb, headers).send(encodeMap(data));
}

function statusOK(status) { return status && 200 <= status && status < 300; }


///
/// Update Loop
///

function startLoop(simFn) {
  var handle;

  var viewportDim = [0, 0];
  var viewportDirty = true;
  function markViewportDirty() { viewportDirty = true; }
  window.addEventListener("resize", markViewportDirty);
  
  var doc = document.documentElement;
  var scrollAt = [0, 0, 0];
  var scrollDelta = [0, 0, 0];
  function markScrollDirty(e) {
    scrollDelta[X] += e.deltaX;
    scrollDelta[Y] += e.deltaY;
    scrollDelta[Z] += e.deltaZ;
    console.log("scrolled", scrollDelta);
  }
  window.addEventListener("wheel", markScrollDirty);

  var mAt = [0, 0];
  var prevMAt = [0, 0];
  function updateMAt(e) { mAt = [e.clientX, e.clientY]; }
  window.addEventListener("mousemove", updateMAt);
  window.addEventListener("touchmove", function(e) {
    mAt = [
      e.touches[0].clientX,
      e.touches[0].clientY
    ];
  });

  var isMDown = false;
  var mDowns = [];
  var mUps = [];
  function registerMDown(e) { mDowns.push([e.clientX, e.clientY]); isMDown = true; }
  function registerMUp(e) { mUps.push([e.clientX, e.clientY]); isMDown = false; }
  window.addEventListener("mousedown", registerMDown);
  window.addEventListener("mouseup", registerMUp);

  window.addEventListener("touchstart", function(e) { isMDown = true; });
  window.addEventListener("touchend", function(e) { isMDown = false; });


  var orientation = [0, 0, 0];
  var prevOrientation = [0, 0, 0];
  var orientationAnchor = [0, 0, 0];
  var orientationMeasured = false;
  function updateOrientation(e) { orientation = [e.alpha, e.beta, e.gamma]; }
  function initOrientation(e) {
    if (e.gamma !== null) {
      orientationMeasured = true;
      if (!e.absolute) { orientationAnchor = [e.alpha, e.beta, e.gamma]; }
      window.removeEventListener('deviceorientation', initOrientation);
      window.addEventListener('deviceorientation', updateOrientation);
    }
  }
  window.addEventListener('deviceorientation', initOrientation);

  var prevT;
  function initTimeAndLoop(t){
    prevT = t;
    handle = window.requestAnimationFrame(loop);
  }
  function loop(t) {

    if (viewportDirty) {
      viewportDim = [document.body.clientWidth, document.body.clientHeight];
    }
    scrollAt = addV2(scrollAt, scrollDelta);

    var input = {
      orientation: orientation,
      dOrientation: negV3(orientation, prevOrientation),

      mDown: isMDown,
      mAt: mAt,
      dMAt: negV2(mAt, prevMAt),
      scrollAt: scrollAt,
      dScrollAt: scrollDelta,
      mDowns: mDowns,
      mUpts: mUps,

      viewportDim: viewportDim,
      viewportDirty: viewportDirty,

      t: t,
      dT: t - prevT,
    }

    prevT = t;
    prevMAt = mAt;
    scrollDelta = [0, 0, 0];
    mDowns = [];
    mUps = [];
    prevOrientation = orientation;
    viewportDirty = false;

    handle = window.requestAnimationFrame(loop);
    simFn(input);
  }

  window.requestAnimationFrame(initTimeAndLoop);
  return function() {
    window.cancelAnimationFrame(handle);
    window.removeEventListener("mousemove", updateMAt);
    window.removeEventListener("mouseup", registerMUp);
    window.removeEventListener("mousedown", registerMDown);
    window.removeEventListener("scroll", markScrollDirty);
    window.removeEventListener("deviceorientation", updateOrientation);
    window.removeEventListener("resize", markViewportDirty);
  }
}

// window.refreshHz = 0.5;
// window.requestAnimationFrame = function(loop) {
//   return setTimeout(loop.bind(window, Date.now()), 1000/refreshHz);
// }
// window.cancelAnimationFrame = function(h) { window.clearTimeout(); }

///
/// Misc
///

function noop(){}
function eatEvent(e) { e.stopPropagation(); return false; }
function defer(fn) { setTimeout(fn, 0); }

function mapOver(src, mapping) {
  var target = [];
  for (var key in src) {
    target.push(mapping(src[key], key));
  }
  return target;
}

function assign(/*...objects*/){
  var r = arguments[0];
  for (var i = 1; i < arguments.length; ++i) {
    for (var key in arguments[i]) r[key] = arguments[i][key];
  }
  return r;
}
function pluck(from/*, ...fieldNames*/) {
  var r = {};
  for (var i = 1; i < arguments.length; ++i) r[arguments[i]] = from[arguments[i]];
  return r;
}
function withoutFields(obj/*, ...fieldNames*/) {
  var r = assign({}, obj);
  for (var i = 1; i < arguments.length; ++i) {
    var f = arguments[i];
    if (arguments[i] in r) {
      var v = obj[f];
      delete r[f];
    }
  }
  return r;
}

// Take a string "hello $1, how is $2", and replace #0 and $1 with supplied arguments
function format(f) {
  for(var i = 1; i < arguments.length; ++i)
    f = f.replace(new RegExp('\\$' + i, 'g'), arguments[i]);
  return f;
}

function peek(arr) { return arr[arr.length - 1]; }

function getNow() { return Date.now()/1000; }

function sessionFromToken(token) {
  var tokenParts = /([^.]+).([^.]+).([^.]+)/.exec(token);
  return {
    tokenString: token,
    header: JSON.parse(atob(tokenParts[1])),
    data: JSON.parse(atob(tokenParts[2]))
  };
}