# Inukshuk placer prototype

A standalone preview for placing a figure on a photo. It uses the same fonts and the dark page colours as the site. It is not a new design.

Run it from `legacy-static`:

```
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/placer/index.html`.

Files:

- `placer.js` is the interaction and the one `paint` function used for the preview and the download.
- `index.html` is the prototype page.
- `assets/sample-garden.jpg` is a procedural test picture, 2000 by 1500. It is not a photograph.
- `assets/inukshuk.png` is a procedural test figure, 520 by 860, with a transparent background. It is not a photograph of a sculpture.

Your own photo is decoded in the browser. It is not uploaded. This script does not call analytics and does not send the file anywhere.

## Library choice

Checked on 7 November 2026.

| Library | Licence file fetched | npm latest | Published | Working notes |
| --- | --- | --- | --- | --- |
| Pointer Events | Web standard. No package. |  |  | https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events |
| Konva | MIT. https://raw.githubusercontent.com/konvajs/konva/master/LICENSE returned 200. | 10.9.1 | 31 October 2026 | https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html scales the stage. https://konvajs.org/docs/posts/Tainted_Canvas.html |
| Fabric.js | MIT. https://raw.githubusercontent.com/fabricjs/fabric.js/master/LICENSE returned 200. | 7.4.0 | 18 May 2026 | https://fabricjs.com/ |
| interact.js | MIT. https://raw.githubusercontent.com/taye/interact.js/main/LICENSE returned 200. | 1.10.28 | 1 August 2026 | GitHub releases list returned no tag in this check. The npm time is the date used. |
| Moveable | MIT. https://raw.githubusercontent.com/daybrush/moveable/master/LICENSE returned 200. | 0.53.0 | 3 December 2023 | https://daybrush.com/moveable/release/latest/doc/ The release is stale against November 2026. |

The placer uses Pointer Events and the canvas. It does not ship Konva, Fabric, interact.js, or Moveable. Those four are MIT, so they are allowed. They are not required. A dependency would be another file to load, and Moveable has not had a release since 2023. Konva's own multi-touch example scales the whole stage, which is not the figure.

ArtPlacer and Canvy were read as product examples only. Their code is not copied. A wall mockup is not the same problem as a figure standing on open ground.

## Interaction

- One finger, or the mouse, on the figure moves it. The feet point stays with the gesture.
- The white handle is 44 CSS pixels. Dragging it changes the size. The feet stay put.
- The size slider does the same thing and is the fallback.
- Two fingers on the figure pinch its size. One finger on the grass does not capture the pointer, so the page can scroll.
- A trackpad pinch that sends a wheel event with the control key is ignored for page scroll. A normal wheel scroll is left to the page.
- Arrow keys move the figure. Plus and minus change the size. Each key is one action.
- Undo and Redo step one action. Previous photo switches to the earlier photo and the placement stored on that photo.
- Choosing the same file again adds another photo with its own placement. It does not erase the earlier one.
- The figure starts at about 28 percent of the photo height so it can be grabbed. Nothing here forces a tree distance or shrinks it to a speck.

There is no calibrated survey. The main site can still show an optional sentence. Those numbers do not move the figure. A metre estimate would need a horizon, a known reference height, and the assumption of flat ground. This prototype does not pretend to have that measurement.

## Coordinates and export

`paint` draws the source photo and the source figure. The preview and the download call that same function. The preview canvas is sized in CSS pixels and its backing store is multiplied by the device pixel ratio, capped at 2. Placement is stored in photo pixels, so a resize or a rotation of the phone does not invent a new position.

The pointer position uses `getBoundingClientRect` and the CSS size of the canvas, then converts through the letterbox into photo pixels.

`createImageBitmap` is asked to honour EXIF orientation once. The code does not rotate the bitmap again. If that call fails for a HEIC file, the page asks for a JPEG or PNG. Nothing is uploaded to convert it.

A photo whose bitmap would exceed about 12 million pixels, or 2400 pixels on the long side of the download, is drawn smaller. The status line says so. The limit is there because a phone can run out of memory. It is not a claim that every phone was measured.

The figure's opaque pixels are measured once. The feet anchor is the bottom of that box, so a transparent margin is not treated as the foot.

The download uses `canvas.toBlob` and a temporary link. On an HTTPS page, if `navigator.canShare` accepts files, the share sheet is offered first. This local server is HTTP, so the share sheet is not used here.

## Rights

The two files in `assets` were drawn for this prototype. They are not photographs and they are not the site's sculpture pictures. The site's existing photographs are not described here as unrestricted. The hero file `landmark-wide.jpg` is still the original. The house, the vehicles, the hose, and the post have not been removed. A cleared file has not been made.

## Tests

Automated checks use a real browser through the Chrome DevTools protocol: mouse, touch, file input, and a download. They are not `element.dispatchEvent`. A physical iPhone or Android phone was not used. WebKit is recorded as unavailable if the browser binary is not installed. See the test log that accompanies the commit. Do not read this file as a certificate that the whole site is finished.
