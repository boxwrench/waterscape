#!/usr/bin/env bash
# Render a Waterscape Minecraft world as a BlueMap web map (static files you can host anywhere
# that can send gzip headers; see README.md).
#
#   render_map.sh --world DIR --server DIR --chunky JAR --bluemap JAR [--pack ZIP] [--work DIR] [--serve]
#
#   --world    the world to map (it is copied; the original is never touched)
#   --server   a spare Fabric server folder for the same Minecraft version, NOT the live server:
#              the copy is loaded there once with Chunky so the game lights every chunk
#              (our builders leave lighting to the game, and BlueMap skips unlit chunks)
#   --chunky   Chunky (Fabric) jar for that version
#   --bluemap  BlueMap CLI jar (bluemap-<version>-cli.jar)
#   --pack     resource pack zip to draw with (default: ../pack/build/waterscape-hetch-pack.zip)
#   --work     work folder (default: build/); the finished site is <work>/run/web
#   --serve    afterwards, serve the map on http://127.0.0.1:8100 until Ctrl+C
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
world= server= chunky= bluemap= pack="$here/../pack/build/waterscape-hetch-pack.zip" work="$here/build" serve=0
while [ $# -gt 0 ]; do
  case "$1" in
    --world) world=$2; shift 2 ;; --server) server=$2; shift 2 ;; --chunky) chunky=$2; shift 2 ;;
    --bluemap) bluemap=$2; shift 2 ;; --pack) pack=$2; shift 2 ;; --work) work=$2; shift 2 ;;
    --serve) serve=1; shift ;; *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
for v in world server chunky bluemap; do [ -n "${!v}" ] || { echo "--$v is required" >&2; exit 2; }; done
world=$(realpath "$world"); server=$(realpath "$server"); chunky=$(realpath "$chunky")
bluemap=$(realpath "$bluemap"); mkdir -p "$work"; work=$(realpath "$work")
[ -f "$world/level.dat" ] || { echo "$world has no level.dat" >&2; exit 1; }
[ -f "$server/fabric-server-launch.jar" ] && [ -f "$server/server.properties" ] || { echo "$server is not a Fabric server folder" >&2; exit 1; }
session=waterscape-relight
tmux has-session -t "$session" 2>/dev/null && { echo "tmux session $session already exists" >&2; exit 1; }
port=$(sed -n 's/^server-port=//p' "$server/server.properties")
ss -ltn | grep -q ":${port:-25565} " && { echo "port ${port:-25565} is in use: is $server running?" >&2; exit 1; }

# 1. Light every chunk: load the copy once on the spare server with Chunky (existing chunks only).
level=waterscape-relight
rm -rf "${server:?}/$level"; cp -r "$world" "$server/$level"
cp "$server/server.properties" "$work/server.properties.saved"
added_chunky=0; [ -e "$server/mods/$(basename "$chunky")" ] || { cp "$chunky" "$server/mods/"; added_chunky=1; }
restore() {
  cp "$work/server.properties.saved" "$server/server.properties"
  [ "$added_chunky" = 1 ] && rm -f "$server/mods/$(basename "$chunky")"
  return 0
}
trap restore EXIT
sed -i "s/^level-name=.*/level-name=$level/; s/^view-distance=.*/view-distance=4/; s/^simulation-distance=.*/simulation-distance=4/" "$server/server.properties"
mkdir -p "$server/config/chunky"
printf '{\n  "version": 2,\n  "language": "en",\n  "continueOnRestart": false,\n  "forceLoadExistingChunks": true,\n  "silent": false,\n  "updateInterval": 15\n}\n' > "$server/config/chunky/config.json"
log="$work/relight-console.log"; : > "$log"
tmux new-session -d -s "$session" -c "$server" "java -Xmx8G -jar fabric-server-launch.jar nogui 2>&1 | tee '$log'"
wait_for() { for _ in $(seq "$2"); do grep -qE "$1" "$log" && return 0; sleep 3; done; echo "timed out waiting for: $1" >&2; return 1; }
send() { tmux send-keys -t "$session" "$1" Enter; sleep 1; }
wait_for 'Done \(' 100
send "gamerule doMobSpawning false"; send "chunky world minecraft:overworld"; send "chunky pattern world"
send "chunky radius 100000"; send "chunky start"
wait_for 'Task finished' 600
grep 'Task finished' "$log"
send "save-all flush"; wait_for 'Saved the game' 60; send "stop"
for _ in $(seq 60); do tmux has-session -t "$session" 2>/dev/null || break; sleep 3; done
rm -rf "$work/relight"; mv "$server/$level" "$work/relight"

# 2. Render with BlueMap.
rm -rf "$work/run/config"; mkdir -p "$work/run/config/packs" "$work/run/web"
cp -r "$here/bluemap/." "$work/run/config/"
sed -i "s#@WORLD@#$work/relight#" "$work/run/config/maps/hetch_hetchy.conf"
[ -f "$pack" ] && cp "$pack" "$work/run/config/packs/" || echo "no resource pack at $pack: vanilla textures" >&2
cp "$here/waterscape.js" "$work/run/web/"
rm -rf "$work/run/web/maps/hetch_hetchy"
(cd "$work/run" && java -Xmx8G -jar "$bluemap" -r)
echo "Map site: $work/run/web ($(du -sh "$work/run/web" | cut -f1))"
[ "$serve" = 1 ] && { cd "$work/run" && exec java -jar "$bluemap" -w; }
exit 0
