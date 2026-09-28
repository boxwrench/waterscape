# Q1 — Build and smoke-test the native Windows host

**Who:** small · **Needs:** — · **Branch:** `task/Q1`

## Goal

Confirm the optional native Windows app (`Native/`) still builds and passes its smoke test after
the renderer changes (it includes `renderer/water.cu` directly), and fix its README's stale paths.
Needs Windows 10/11, an NVIDIA GPU, CUDA Toolkit 13.x and Visual Studio C++ build tools. If
any of those is missing, stop and report `blocked: <what is missing>`.

## Steps

1. `git switch -c task/Q1`

2. The native host reads the uncompressed terrain (needs internet):
   `python pipeline/build.py calaveras --native`
   **Pass:** `data/calaveras/terrain.bin` exists. (It is gitignored — do not commit it.)
   Then `git status --short` — if it lists changes under `data/calaveras/`, run
   `git checkout data/calaveras` to keep the committed bundle unchanged.

3. Build: `pwsh -File Native/build.ps1`
   **Pass:** `Native/build/ClearwaterNative.exe` exists. If the compiler reports errors, stop
   and report the first 30 lines of the error output.

4. Smoke test: `./Native/build/ClearwaterNative.exe --smoke`
   **Pass:** exit code 0 and `Native/build/output/native-smoke.json` exists. On failure, report
   the contents of `Native/build/output/error.log`.

5. Fix `Native/README.md`: replace `../src/water.cu` with `../renderer/water.cu`, and replace
   ``Keep `assets/seabed.jpg` next to the executable inside `assets/`.`` with
   ``The executable reads `renderer/assets/seabed.jpg` and `data/calaveras/terrain.bin` from the
   repository.``

6. Commit: `git add Native/README.md` then `git commit -m "Q1: native host builds; README paths"`.

7. Add the **Result** section (see AGENTS.md) to this file — include the smoke JSON's key numbers
   — and commit it.
