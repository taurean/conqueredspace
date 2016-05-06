

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
  var scrollAt;
  var prevScrollAt = [0, 0];
  var scrollDirty = true;
  function markScrollDirty() { scrollDirty = true; }
  window.addEventListener("scroll", markScrollDirty);

  var mAt = [0, 0];
  var prevMAt = [0, 0];
  function updateMAt(e) { mAt = [e.clientX, e.clientY]; }
  window.addEventListener("mousemove", updateMAt);

  var mDowns = [];
  var mUps = [];
  function registerMDown(e) { mDowns.push([e.clientX, e.clientY]); }
  function registerMUp(e) { mUps.push([e.clientX, e.clientY]); }
  window.addEventListener("mousedown", registerMDown);
  window.addEventListener("mouseup", registerMUp);


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

    if (scrollDirty) {
      scrollAt = [(window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0),
        (window.pageYOffset || doc.scrollTop)  - (doc.clientTop || 0)];
    }

    if (viewportDirty) {
      viewportDim = [document.body.clientWidth, document.body.clientHeight];
    }

    var input = {
      orientation: orientation,
      dOrientation: negV3(orientation, prevOrientation),

      mAt: mAt,
      dMAt: negV2(mAt, prevMAt),
      scrollDirty: scrollDirty,
      scrollAt: scrollAt,
      dScrollAt: negV2(scrollAt, prevScrollAt),
      mDowns: mDowns,
      mUpts: mUps,

      viewportDim: viewportDim,
      viewportDirty: viewportDirty,

      t: t,
      dT: t - prevT,
    }

    prevT = t;
    prevMAt = mAt;
    scrollDirty = false;
    prevScrollAt = scrollAt;
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


///
/// Misc
///

function eatEvent(e) { e.stopPropagation(); return false; }

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