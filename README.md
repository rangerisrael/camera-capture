# @rangerisrael/camera-capture

A React component for photo capture and video recording using the browser MediaStream API.

## Requirements

The consuming app must have the following installed and configured:

- React >= 17
- lucide-react
- **shadcn/ui** — `button`, `card` components + `useToast` hook
- Vite with `@/` path alias pointing to `./src`

## Installation

**Via git (recommended):**
```bash
npm install git+https://github.com/yourteam/camera-capture.git
```

**Via local path (monorepo):**
```bash
npm install file:../camera-capture
```

## Vite Config (consuming app)

```ts
// vite.config.ts
import path from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  optimizeDeps: {
    include: ['@yourteam/camera-capture']
  }
})
```

## Usage

```tsx
import { CameraCapture } from '@yourteam/camera-capture'

// Photo mode
<CameraCapture
  mode="photo"
  title="Take a Photo"
  description="Position your camera and tap Capture"
  onCapture={(file: File) => console.log(file)}
  onClose={() => setOpen(false)}
/>

// Video mode
<CameraCapture
  mode="video"
  title="Record Video"
  onCapture={(file: File) => uploadVideo(file)}
  onClose={() => setOpen(false)}
/>
```

## Props

| Prop          | Type                        | Required | Default                                      |
|---------------|-----------------------------|----------|----------------------------------------------|
| `onCapture`   | `(file: File) => void`      | ✅       | —                                            |
| `onClose`     | `() => void`                | ✅       | —                                            |
| `mode`        | `"photo" \| "video"`        | ❌       | `"photo"`                                    |
| `title`       | `string`                    | ❌       | `"Take Photo"`                               |
| `description` | `string`                    | ❌       | `"Position your camera and take a clear photo"` |

## Notes

- Requires HTTPS or `localhost` for camera access (browser security requirement)
- Video recording outputs `.webm` (vp9) or `.mp4` depending on browser support
- Front/rear camera switching is supported on mobile devices
