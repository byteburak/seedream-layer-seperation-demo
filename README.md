# Seedream Layer Separation Demo

A small web app that shows off Seedream 5.0's **layer decomposition** feature.
Upload a photo, press one button, and Seedream splits it into a base image plus
up to 16 transparent layers (people, objects, text, decorations). The app then
shows those layers on an interactive canvas where each detected object can be
selected, dragged, resized, re-ordered, hidden, and exported.

## Prerequisites

- Node.js 20 or newer
- A BytePlus ModelArk API key with access to Seedream 5.0 pro / flash

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file and add the API key:

   ```bash
   cp .env.example .env.local
   ```

   Open `.env.local` and paste your key after `ARK_API_KEY=`. The other values
   (base URL, model IDs, output size) already have sensible defaults.

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Using the demo

1. Pick a PNG or JPEG (512x512 to 6000x6000 pixels, under 30 MB).
2. Choose **Pro** (best quality) or **Flash** (faster, cheaper).
3. Optionally expand **Advanced** and type a hint such as
   "Decompose the person, the title text and the logo".
4. Click **Separate layers**. The call is synchronous and usually takes
   1 to 2 minutes; an elapsed-time counter is shown while waiting.
5. When the result arrives:
   - Hover a layer to see its name; click to select it.
   - Drag to move. Use the corner handles to resize (aspect ratio is locked;
     hold Shift to resize freely).
   - Press Delete / Backspace to hide the selected layer.
   - Use the side panel to toggle visibility, change stacking order, reset
     the layout, or download the current composition as a PNG.
   - Toggle **Show original** to compare with the uploaded photo.

## How it works

```
Browser  --(image as base64 + pro/flash)-->  /api/decompose (Next.js route)
                                                   |  Bearer ARK_API_KEY
                                                   |  layer_decomposition: true
                                                   v
                                       Seedream 5.0 image API
                                                   |
                                        base + layers as b64_json
                                                   v
Browser  <--  { base, layers[{ name, bbox, zIndex, dataUrl }] }  --
```

- The API key lives only on the server (`.env.local` is git-ignored).
- The browser never sends a raw model ID, only `"pro"` or `"flash"`; the
  server maps that to the IDs configured in `.env.local`.
- Images come back as base64 so the browser can render them without hitting
  CORS or 24-hour URL expiry.
- Layer positions use `bounding_box.absolute` from the API, in base-image
  pixel coordinates; the whole canvas is scaled uniformly to fit the window.

## Project structure

- `app/page.tsx` - the single page (upload panel + editor)
- `app/api/decompose/route.ts` - server route that calls Seedream
- `lib/seedream.ts` - request/response types and the API call
- `lib/validateImage.ts` - client-side image checks
- `components/UploadPanel.tsx` - file picker, model toggle, prompt, run button
- `components/LayerEditor.tsx` - the react-konva canvas
- `components/LayerList.tsx` - side panel with layer controls

## Notes for later

- **Login**: not included yet. A `proxy.ts` / middleware credential gate with
  a session cookie can be added without changing the current structure.
- **Deployment**: the Seedream call takes 1 to 2 minutes, which is longer than
  the default timeout on most serverless hosts. Deploy to a long-running Node
  host, or move to an async job pattern, before opening this up to customers.
