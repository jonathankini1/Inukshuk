/* Inukshuk placer. Plain Pointer Events. No network calls.
   Preview and download both use paint(). Placement is stored in photo pixels. */
(function (global) {
  'use strict';

  var HANDLE = 44;
  var MAX_EXPORT_EDGE = 2400;
  var MAX_BITMAP_PIXELS = 12000000;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function contain(srcW, srcH, destW, destH) {
    var scale = Math.min(destW / srcW, destH / srcH);
    var w = srcW * scale;
    var h = srcH * scale;
    return { x: (destW - w) / 2, y: (destH - h) / 2, w: w, h: h, s: scale };
  }

  function trimAlpha(source) {
    var canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0);
    var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    var minX = canvas.width;
    var minY = canvas.height;
    var maxX = -1;
    var maxY = -1;
    var y;
    var x;
    for (y = 0; y < canvas.height; y += 1) {
      for (x = 0; x < canvas.width; x += 1) {
        if (data[(y * canvas.width + x) * 4 + 3] > 16) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX) {
      return { left: 0, top: 0, width: source.width, height: source.height };
    }
    return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  function defaultPlacement(photo) {
    return {
      footX: photo.width * 0.62,
      footY: photo.height * 0.78,
      height: photo.height * 0.28,
      flip: false
    };
  }

  function clonePlacement(p) {
    return { footX: p.footX, footY: p.footY, height: p.height, flip: p.flip };
  }

  async function decodeFile(file) {
    var name = file.name || 'photo';
    var heic = file.type === 'image/heic' || file.type === 'image/heif' || /\.heic$/i.test(name) || /\.heif$/i.test(name);
    if (typeof createImageBitmap === 'function') {
      try {
        var bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return { source: bitmap, width: bitmap.width, height: bitmap.height, oriented: true };
      } catch (error) {
        if (heic) {
          var blocked = new Error('This browser cannot open HEIC photos. Choose a JPEG or PNG. The file stays on this device.');
          blocked.code = 'heic';
          throw blocked;
        }
      }
    } else if (heic) {
      var missing = new Error('This browser cannot open HEIC photos. Choose a JPEG or PNG. The file stays on this device.');
      missing.code = 'heic';
      throw missing;
    }
    var url = URL.createObjectURL(file);
    try {
      var image = new Image();
      image.src = url;
      await image.decode();
      return { source: image, width: image.naturalWidth, height: image.naturalHeight, oriented: false, url: url };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw new Error('That file could not be opened. Choose a JPEG or PNG.');
    }
  }

  function loadUrl(url) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = function () {
        resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, oriented: false });
      };
      image.onerror = function () { reject(new Error('The sample image did not load.')); };
      image.src = url;
    });
  }

  function mount(stage, options) {
    options = options || {};
    var canvas = stage.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      stage.insertBefore(canvas, stage.firstChild);
    }
    canvas.style.touchAction = 'pan-y';
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    var ctx = canvas.getContext('2d');
    var overlay = document.createElement('div');
    overlay.className = 'placer-overlay';
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    var box = document.createElement('div');
    box.className = 'placer-move';
    box.style.position = 'absolute';
    box.style.touchAction = 'none';
    box.style.pointerEvents = 'auto';
    box.style.cursor = 'move';
    box.style.boxSizing = 'border-box';
    box.style.border = '1.5px solid #fff';
    box.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.55)';
    var handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'placer-resize';
    handle.setAttribute('aria-label', 'Resize the figure. The feet stay put.');
    handle.style.position = 'absolute';
    handle.style.width = HANDLE + 'px';
    handle.style.height = HANDLE + 'px';
    handle.style.marginLeft = (-HANDLE / 2) + 'px';
    handle.style.marginTop = (-HANDLE / 2) + 'px';
    handle.style.borderRadius = '50%';
    handle.style.border = '2px solid #1d1d1f';
    handle.style.background = '#fff';
    handle.style.touchAction = 'none';
    handle.style.pointerEvents = 'auto';
    handle.style.cursor = 'ns-resize';
    handle.style.padding = '0';
    overlay.appendChild(box);
    overlay.appendChild(handle);
    stage.appendChild(overlay);
    if (getComputedStyle(stage).position === 'static') stage.style.position = 'relative';
    if (!stage.hasAttribute('tabindex')) stage.tabIndex = 0;

    var photos = [];
    var index = 0;
    var figure = null;
    var undoStack = [];
    var redoStack = [];
    var gesture = null;
    var pointers = new Map();
    var cssSize = { w: 1, h: 1 };
    var lastGeom = null;
    var statusNode = options.status || null;
    var suppressHistory = false;

    function say(text) {
      if (statusNode) statusNode.textContent = text;
      if (options.onStatus) options.onStatus(text);
    }

    function current() {
      return photos[index] || null;
    }

    function snapshot() {
      return {
        index: index,
        items: photos.map(function (photo) {
          return { id: photo.id, placement: clonePlacement(photo.placement) };
        })
      };
    }

    function remember() {
      if (!photos.length) return;
      undoStack.push(snapshot());
      if (undoStack.length > 60) undoStack.shift();
      redoStack = [];
    }

    function applySnapshot(snap) {
      index = snap.index;
      snap.items.forEach(function (item) {
        var photo = photos.find(function (entry) { return entry.id === item.id; });
        if (photo) photo.placement = clonePlacement(item.placement);
      });
    }

    function remember() {
      if (suppressHistory) return;
      undoStack.push(snapshot());
      if (undoStack.length > 60) undoStack.shift();
      redoStack = [];
    }

    function placementsEqual(a, b) {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    function undo() {
      if (!undoStack.length) return;
      redoStack.push(snapshot());
      applySnapshot(undoStack.pop());
      paintView();
      say('Undone.');
    }

    function redo() {
      if (!redoStack.length) return;
      undoStack.push(snapshot());
      applySnapshot(redoStack.pop());
      paintView();
      say('Redone.');
    }

    function viewPoint(event) {
      var rect = canvas.getBoundingClientRect();
      var width = rect.width > 1 ? rect.width : cssSize.w;
      var height = rect.height > 1 ? rect.height : cssSize.h;
      return {
        x: (event.clientX - rect.left) * (cssSize.w / width),
        y: (event.clientY - rect.top) * (cssSize.h / height)
      };
    }

    function toPhoto(point) {
      if (!lastGeom) return null;
      var fit = lastGeom.fit;
      return {
        x: (point.x - fit.x) / fit.s,
        y: (point.y - fit.y) / fit.s
      };
    }

    function hitFigure(point) {
      if (!lastGeom) return false;
      var pad = HANDLE / 2;
      var g = lastGeom;
      return point.x >= g.left - pad && point.x <= g.left + g.drawW + pad && point.y >= g.top - pad && point.y <= g.top + g.drawH + pad;
    }

    function paint(ctx, destW, destH, dpr, footerLines) {
      var photo = current();
      var lines = footerLines || [];
      var footer = lines.length ? Math.round(18 * lines.length + 28) : 0;
      var pictureH = destH - footer;
      ctx.setTransform(dpr || 1, 0, 0, dpr || 1, 0, 0);
      ctx.clearRect(0, 0, destW, destH);
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, destW, destH);
      if (!photo || !figure) return null;
      var fit = contain(photo.width, photo.height, destW, pictureH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(photo.source, 0, 0, photo.width, photo.height, fit.x, fit.y, fit.w, fit.h);
      var placement = photo.placement;
      var scale = (placement.height / figure.trim.height) * fit.s;
      var drawW = figure.width * scale;
      var drawH = figure.height * scale;
      var anchorX = (figure.trim.left + figure.trim.width / 2) / figure.width;
      var anchorY = (figure.trim.top + figure.trim.height) / figure.height;
      var footX = fit.x + placement.footX * fit.s;
      var footY = fit.y + placement.footY * fit.s;
      ctx.save();
      ctx.translate(footX, footY);
      if (placement.flip) ctx.scale(-1, 1);
      ctx.drawImage(figure.source, -anchorX * drawW, -anchorY * drawH, drawW, drawH);
      ctx.restore();
      if (footer) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, pictureH, destW, footer);
        ctx.fillStyle = '#f5f5f7';
        ctx.font = '16px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textBaseline = 'top';
        lines.forEach(function (line, lineIndex) {
          ctx.fillText(line, 20, pictureH + 12 + lineIndex * 18);
        });
      }
      return {
        fit: fit,
        left: footX - anchorX * drawW,
        top: footY - anchorY * drawH,
        drawW: drawW,
        drawH: drawH,
        footX: footX,
        footY: footY
      };
    }

    function layoutOverlay(geom) {
      if (!geom) {
        box.style.display = 'none';
        handle.style.display = 'none';
        return;
      }
      box.style.display = 'block';
      handle.style.display = 'block';
      var left = geom.left;
      var top = geom.top;
      var width = Math.max(geom.drawW, HANDLE);
      var height = Math.max(geom.drawH, HANDLE);
      if (geom.drawW < HANDLE) left -= (HANDLE - geom.drawW) / 2;
      if (geom.drawH < HANDLE) top -= (HANDLE - geom.drawH) / 2;
      box.style.left = left + 'px';
      box.style.top = top + 'px';
      box.style.width = width + 'px';
      box.style.height = height + 'px';
      handle.style.left = (geom.left + geom.drawW / 2) + 'px';
      handle.style.top = geom.top + 'px';
    }

    function paintView() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      lastGeom = paint(ctx, cssSize.w, cssSize.h, dpr);
      layoutOverlay(lastGeom);
      var photo = current();
      if (photo) {
        canvas.dataset.footX = String(Math.round(photo.placement.footX));
        canvas.dataset.footY = String(Math.round(photo.placement.footY));
        canvas.dataset.figureHeight = String(Math.round(photo.placement.height));
        canvas.dataset.photoIndex = String(index);
        canvas.dataset.photoCount = String(photos.length);
      }
    }

    function resizeBacking() {
      var rect = stage.getBoundingClientRect();
      var width = Math.max(320, Math.round(rect.width || stage.clientWidth || 640));
      var height = Math.max(240, Math.round(width * 3 / 4));
      cssSize = { w: width, h: height };
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.height = height + 'px';
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      paintView();
    }

    function exportSize(photo) {
      var width = photo.width;
      var height = photo.height;
      var edge = Math.max(width, height);
      var scale = edge > MAX_EXPORT_EDGE ? MAX_EXPORT_EDGE / edge : 1;
      if (width * height * scale * scale > MAX_BITMAP_PIXELS) {
        scale = Math.min(scale, Math.sqrt(MAX_BITMAP_PIXELS / (width * height)));
      }
      return {
        w: Math.max(1, Math.round(width * scale)),
        h: Math.max(1, Math.round(height * scale)),
        reduced: scale < 0.999
      };
    }

    function exportBlob() {
      var photo = current();
      if (!photo) return Promise.reject(new Error('No photo'));
      var size = exportSize(photo);
      var lines = (options.creditLines && current().id === 'sample') ? options.creditLines : [];
      var footer = lines.length ? Math.round(18 * lines.length + 28) : 0;
      var out = document.createElement('canvas');
      out.width = size.w;
      out.height = size.h + footer;
      var outCtx = out.getContext('2d');
      paint(outCtx, size.w, size.h + footer, 1, lines);
      return new Promise(function (resolve, reject) {
        out.toBlob(function (blob) {
          if (!blob) reject(new Error('The picture could not be saved.'));
          else resolve({ blob: blob, width: out.width, height: out.height, reduced: size.reduced });
        }, 'image/png');
      });
    }

    async function download() {
      var result = await exportBlob();
      var file = new File([result.blob], 'inukshuk-on-my-land.png', { type: 'image/png' });
      var shareOk = navigator.canShare && navigator.canShare({ files: [file] }) && location.protocol === 'https:';
      if (shareOk) {
        try {
          await navigator.share({ files: [file], title: 'Inukshuk preview' });
          say(result.reduced ? 'Shared a reduced picture. The source photo is larger than this browser should hold.' : 'Shared.');
          return result;
        } catch (error) {
          if (error && error.name === 'AbortError') return result;
        }
      }
      var link = document.createElement('a');
      var url = URL.createObjectURL(result.blob);
      link.href = url;
      link.download = 'inukshuk-on-my-land.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      say(result.reduced
        ? 'Downloaded a reduced picture, ' + result.width + ' by ' + result.height + '. The source is larger than this browser should hold.'
        : 'Downloaded ' + result.width + ' by ' + result.height + '.');
      return result;
    }

    function addDecoded(decoded, name) {
      remember();
      var photo = {
        id: 'p' + Date.now() + photos.length,
        name: name,
        source: decoded.source,
        width: decoded.width,
        height: decoded.height,
        placement: null
      };
      var pixels = decoded.width * decoded.height;
      if (pixels > MAX_BITMAP_PIXELS) {
        say('This photo is very large. It stays on this device. The preview uses a smaller drawing.');
      }
      photo.placement = defaultPlacement(photo);
      photos.push(photo);
      index = photos.length - 1;
      paintView();
    }

    async function addFile(file) {
      if (!file) return;
      try {
        var decoded = await decodeFile(file);
        addDecoded(decoded, file.name || 'photo');
        say('Photo added. It stays on this device. Drag the figure. The white handle changes its size.');
      } catch (error) {
        say(error.message || 'That file could not be opened.');
      }
    }

    function selectPhoto(next) {
      if (next < 0 || next >= photos.length || next === index) return;
      remember();
      index = next;
      paintView();
      say('Showing photo ' + (index + 1) + ' of ' + photos.length + '. Its placement is kept.');
    }

    function previousPhoto() {
      selectPhoto(index - 1);
    }

    function setFigureHeight(next) {
      var photo = current();
      if (!photo) return;
      remember();
      photo.placement.height = clamp(next, photo.height * 0.05, photo.height * 0.9);
      paintView();
    }

    function setHeightFraction(fraction) {
      var photo = current();
      if (!photo) return;
      setFigureHeight(photo.height * fraction);
    }

    function nudge(dx, dy, dh) {
      var photo = current();
      if (!photo) return;
      remember();
      photo.placement.footX = clamp(photo.placement.footX + dx, 0, photo.width);
      photo.placement.footY = clamp(photo.placement.footY + dy, 0, photo.height);
      if (dh) photo.placement.height = clamp(photo.placement.height + dh, photo.height * 0.05, photo.height * 0.9);
      paintView();
    }

    function resetCurrent() {
      var photo = current();
      if (!photo) return;
      remember();
      photo.placement = defaultPlacement(photo);
      paintView();
      say('Placement reset on this photo. Not a measurement.');
    }

    function flip() {
      var photo = current();
      if (!photo) return;
      remember();
      photo.placement.flip = !photo.placement.flip;
      paintView();
    }

    function beginGesture(kind, event) {
      var photo = current();
      if (!photo) return;
      var point = viewPoint(event);
      var photoPoint = toPhoto(point);
      gesture = {
        kind: kind,
        pointerId: event.pointerId,
        startPhoto: photoPoint,
        start: clonePlacement(photo.placement),
        snapshot: snapshot(),
        pinchDist: 0
      };
      if (kind === 'pinch') {
        var pts = Array.from(pointers.values());
        gesture.pinchDist = Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
      }
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch (error) { /* No capture on this event. */ }
    }

    function commitGesture() {
      if (!gesture) return;
      var before = gesture.snapshot;
      var after = snapshot();
      gesture = null;
      if (!placementsEqual(before, after)) {
        undoStack.push(before);
        if (undoStack.length > 60) undoStack.shift();
        redoStack = [];
      }
    }

    function onPointerDown(event) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, onFigure: event.target === box || event.target === handle || hitFigure(viewPoint(event)) });
      if (pointers.size === 2) {
        var any = false;
        pointers.forEach(function (item) { if (item.onFigure) any = true; });
        if (any) {
          gesture = null;
          beginGesture('pinch', event);
          event.preventDefault();
        }
        return;
      }
      if (event.target === handle) {
        beginGesture('resize', event);
        event.preventDefault();
        return;
      }
      if (event.target === box || hitFigure(viewPoint(event))) {
        beginGesture('move', event);
        event.preventDefault();
      }
    }

    function onPointerMove(event) {
      if (pointers.has(event.pointerId)) {
        var prev = pointers.get(event.pointerId);
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, onFigure: prev.onFigure });
      }
      if (!gesture) return;
      var photo = current();
      if (!photo) return;
      if (gesture.kind === 'pinch' && pointers.size >= 2) {
        var pts = Array.from(pointers.values());
        var dist = Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
        photo.placement.height = clamp(gesture.start.height * (dist / gesture.pinchDist), photo.height * 0.05, photo.height * 0.9);
        paintView();
        event.preventDefault();
        return;
      }
      if (event.pointerId !== gesture.pointerId) return;
      var photoPoint = toPhoto(viewPoint(event));
      if (!photoPoint || !gesture.startPhoto) return;
      if (gesture.kind === 'move') {
        photo.placement.footX = clamp(gesture.start.footX + (photoPoint.x - gesture.startPhoto.x), 0, photo.width);
        photo.placement.footY = clamp(gesture.start.footY + (photoPoint.y - gesture.startPhoto.y), 0, photo.height);
        paintView();
        event.preventDefault();
      } else if (gesture.kind === 'resize') {
        var delta = gesture.startPhoto.y - photoPoint.y;
        photo.placement.height = clamp(gesture.start.height + delta, photo.height * 0.05, photo.height * 0.9);
        paintView();
        event.preventDefault();
      }
    }

    function onPointerUp(event) {
      pointers.delete(event.pointerId);
      if (gesture && (pointers.size === 0 || gesture.kind !== 'pinch')) commitGesture();
      if (pointers.size < 2 && gesture && gesture.kind === 'pinch') commitGesture();
      try {
        if (event.currentTarget.hasPointerCapture && event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch (error) { /* Already released. */ }
    }

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);

    canvas.addEventListener('wheel', function (event) {
      if (!event.ctrlKey) return;
      event.preventDefault();
    }, { passive: false });

    stage.addEventListener('keydown', function (event) {
      var photo = current();
      if (!photo) return;
      var step = Math.max(2, photo.width * 0.01);
      if (event.key === 'ArrowLeft') nudge(-step, 0, 0);
      else if (event.key === 'ArrowRight') nudge(step, 0, 0);
      else if (event.key === 'ArrowUp') nudge(0, -step, 0);
      else if (event.key === 'ArrowDown') nudge(0, step, 0);
      else if (event.key === '+' || event.key === '=') nudge(0, 0, photo.height * 0.02);
      else if (event.key === '-' || event.key === '_') nudge(0, 0, -photo.height * 0.02);
      else return;
      event.preventDefault();
    });

    if (typeof ResizeObserver === 'function') {
      var observer = new ResizeObserver(function () { resizeBacking(); });
      observer.observe(stage);
    } else {
      window.addEventListener('resize', resizeBacking);
    }
    window.addEventListener('orientationchange', function () { setTimeout(resizeBacking, 60); });

    async function useSources(photoSource, figureSource) {
      figure = {
        source: figureSource.source,
        width: figureSource.width,
        height: figureSource.height,
        trim: trimAlpha(figureSource.source)
      };
      photos = [{
        id: 'sample',
        name: 'Sample',
        source: photoSource.source,
        width: photoSource.width,
        height: photoSource.height,
        placement: null
      }];
      photos[0].placement = defaultPlacement(photos[0]);
      index = 0;
      undoStack = [];
      redoStack = [];
      resizeBacking();
      say('Drag the figure. Use the white handle to change its size. The feet stay put.');
    }

    return {
      useSources: useSources,
      loadUrls: function (photoUrl, figureUrl) {
        return Promise.all([loadUrl(photoUrl), loadUrl(figureUrl)]).then(function (pair) {
          return useSources(pair[0], pair[1]);
        });
      },
      addFile: addFile,
      previousPhoto: previousPhoto,
      selectPhoto: selectPhoto,
      undo: undo,
      redo: redo,
      flip: flip,
      resetCurrent: resetCurrent,
      nudge: nudge,
      setFigureHeight: setFigureHeight,
      setHeightFraction: setHeightFraction,
      exportBlob: exportBlob,
      download: download,
      resize: resizeBacking,
      snapshot: snapshot,
      handle: handle
    };
  }

  global.InukshukPlacer = { mount: mount, HANDLE: HANDLE, MAX_BITMAP_PIXELS: MAX_BITMAP_PIXELS };
}(window));
