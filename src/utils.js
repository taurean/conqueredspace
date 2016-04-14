

///
/// Debug
///

/// TOOD: move this section to a separate file, that can easily be switched out in different environments, to turn off stuff.
if (!console.err) { console.err = console.log; }

function assert(a, s) { if (!a) { alert("assert fired! " + s); debugger; } }
function invalidCodePath() { alert("invalid code path reached"); debugger; }


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

  /// TODO: add scroll x, y, viewport size, viewportIsDirty

  


  var mAt = [0, 0];
  var prevMAt = [0, 0];
  window.addEventListener("mousemove", function updateMAt(e) { mAt = [e.clientX, e.clientY]; });

  var mDowns = [];
  var mUps = [];
  window.addEventListener("mousedown", function registerMDown(e) { mDowns.push([e.clientX, e.clientY]); });
  window.addEventListener("mouseup", function registerMUp(e) { mUps.push([e.clientX, e.clientY]); });


  var orientation = [0, 0, 0];
  var prevOrientation = [0, 0, 0];
  var orientationAnchor = [0, 0, 0];
  var orientationMeasured = false;
  function updateOrientation(e) { orientation = [e.alpha, e.beta, e.gamma]; }
  window.addEventListener('deviceorientation', function initOrientation(e) {
    if (e.gamma !== null) {
      orientationMeasured = true;
      if (!e.absolute) {
        orientationAnchor = [e.alpha, e.beta, e.gamma];
      }
      window.removeEventListener('deviceorientation', initOrientation);
      window.addEventListener('deviceorientation', updateOrientation);
    }
  });



  var prevT;
  function initTimeAndLoop(t){
    prevT = t;
    handle = window.requestAnimationFrame(loop);
  }
  function loop(t) {

    var input = {
      orientation: orientation,
      dOrientation: negV3(orientation, prevOrientation),

      mAt: mAt,
      dMAt: negV2(mAt, prevMAt),

      mDowns: mDowns,
      mUpts: mUps,

      t: t,
      dT: t - prevT,
    }

    prevT = t;
    prevMAt = mAt;
    mDowns = [];
    mUps = [];
    prevOrientation = orientation;

    handle = window.requestAnimationFrame(loop);
    simFn(input);
  }

  window.requestAnimationFrame(initTimeAndLoop);
  return function() {
    window.cancelAnimationFrame(handle);
    window.removeEventListener("mousemove", updateMAt);
    window.removeEventListener("deviceorientation", updateOrientation);
  }
}


///
/// Misc
///

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

// Take a string "hello $1, how is $2", and replace #0 and $1 with supplied arguments
function format(f) {
  for(var i = 1; i < arguments.length; ++i)
    f = f.replace(new RegExp('\\$' + i, 'g'), arguments[i]);
  return f;
}

function peek(arr) { return arr[arr.length - 1]; }

function getNow() { return Date.now()/1000; }