# R3: Refresh README with Calaveras North ridge and Shoreline

The user requested new README imagery, with Calaveras North ridge followed by
Shoreline, while publishing the repository cleanup.

1. Work on `task/R3`.
2. Capture fresh images from the actual Calaveras renderer using its authored
   North ridge and Shoreline viewpoints. Use the existing golden-hour, summer-gold
   presentation and high quality; hide controls for the README images.
3. Replace the README's old single preview with the two refreshed images in that order.
   Do not change camera definitions, renderer code, data or other preview media.
4. Visually inspect both images, confirm their dimensions and README paths, and
   run `git diff --check`.
5. Record results and commit with this task title. Publish the verified documentation
   update as part of the user's requested repository resolution; verify GitHub content.

## Result
- Status: done
- Commit: 032d3b0
- Checks: `node /tmp/waterscape-r3-capture.mjs` — Both authored views captured; no page console errors.
- Checks: Python 3/Pillow PNG and README verification — README image order and paths valid; both PNGs are 1440x900.
- Checks: `git diff --check` — exit 0, no output.
- Notes: Both screenshots visually reviewed. Captured from the actual local Firefox WebGPU renderer at high quality, golden-hour light, summer-gold season and fixed wave time 5; controls hidden. Windows Chrome/Edge performance was not measured. No renderer, camera, data or flyover changes.
