#!/usr/bin/env bash
# download_samples.sh — Downloads sample surveillance videos for testing
# These are public domain / CC0 videos from pexels/pixabay

set -euo pipefail

SAMPLES_DIR="$(cd "$(dirname "$0")" && pwd)/samples"
mkdir -p "$SAMPLES_DIR"

echo "Downloading sample surveillance videos..."

# Sample 1: Street/entrance camera (Pexels CC0)
if [ ! -f "$SAMPLES_DIR/sample1.mp4" ]; then
    echo "  Downloading sample1.mp4 (street scene)..."
    curl -L -o "$SAMPLES_DIR/sample1.mp4" \
        "https://www.pexels.com/download/video/3129671/" 2>/dev/null || \
    # Fallback: generate a test pattern with ffmpeg
    ffmpeg -y -f lavfi -i "testsrc=duration=60:size=1280x720:rate=15" \
        -f lavfi -i "sine=frequency=1000:duration=60" \
        -c:v libx264 -preset ultrafast -pix_fmt yuv420p \
        -c:a aac -shortest \
        "$SAMPLES_DIR/sample1.mp4" 2>/dev/null
    echo "  ✅ sample1.mp4 ready"
else
    echo "  ✅ sample1.mp4 already exists"
fi

# Sample 2: Parking/patio camera
if [ ! -f "$SAMPLES_DIR/sample2.mp4" ]; then
    echo "  Downloading sample2.mp4 (parking scene)..."
    curl -L -o "$SAMPLES_DIR/sample2.mp4" \
        "https://www.pexels.com/download/video/2053100/" 2>/dev/null || \
    # Fallback: generate with different color
    ffmpeg -y -f lavfi -i "testsrc2=duration=60:size=1280x720:rate=15" \
        -f lavfi -i "sine=frequency=440:duration=60" \
        -c:v libx264 -preset ultrafast -pix_fmt yuv420p \
        -c:a aac -shortest \
        "$SAMPLES_DIR/sample2.mp4" 2>/dev/null
    echo "  ✅ sample2.mp4 ready"
else
    echo "  ✅ sample2.mp4 already exists"
fi

echo ""
echo "Done! Sample files are in: $SAMPLES_DIR"
echo ""
echo "If the Pexels downloads failed, the script generated test pattern videos instead."
echo "You can replace them with any .mp4 files renamed to sample1.mp4 and sample2.mp4"
echo ""
echo "To use with the RTSP simulator:"
echo "  docker compose --profile dev -f docker-compose.yml -f docker-compose.dev.yml up -d"
