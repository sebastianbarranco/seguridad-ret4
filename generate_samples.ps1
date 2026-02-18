# Generate test pattern videos for RTSP simulator (Windows/cross-platform)
# Requires ffmpeg to be installed

$samplesDir = Join-Path $PSScriptRoot "samples"
New-Item -ItemType Directory -Path $samplesDir -Force | Out-Null

Write-Host "Generating sample test videos for NVR testing..."

# Sample 1 - Test pattern (simulates entrance camera)
$sample1 = Join-Path $samplesDir "sample1.mp4"
if (-not (Test-Path $sample1)) {
    Write-Host "  Generating sample1.mp4 (test pattern - 60s)..."
    ffmpeg -y -f lavfi -i "testsrc=duration=60:size=1280x720:rate=15" `
        -f lavfi -i "sine=frequency=1000:duration=60" `
        -c:v libx264 -preset ultrafast -pix_fmt yuv420p `
        -c:a aac -shortest `
        $sample1 2>$null
    Write-Host "  Done: sample1.mp4"
} else {
    Write-Host "  sample1.mp4 already exists"
}

# Sample 2 - Different test pattern (simulates patio camera)
$sample2 = Join-Path $samplesDir "sample2.mp4"
if (-not (Test-Path $sample2)) {
    Write-Host "  Generating sample2.mp4 (test pattern 2 - 60s)..."
    ffmpeg -y -f lavfi -i "testsrc2=duration=60:size=1280x720:rate=15" `
        -f lavfi -i "sine=frequency=440:duration=60" `
        -c:v libx264 -preset ultrafast -pix_fmt yuv420p `
        -c:a aac -shortest `
        $sample2 2>$null
    Write-Host "  Done: sample2.mp4"
} else {
    Write-Host "  sample2.mp4 already exists"
}

Write-Host ""
Write-Host "Sample files ready in: $samplesDir"
Write-Host ""
Write-Host "You can replace these with any .mp4 surveillance footage for more realistic testing."
Write-Host ""
Write-Host "To start the dev stack with RTSP simulator:"
Write-Host '  docker compose --profile dev -f docker-compose.yml -f docker-compose.dev.yml up -d'
