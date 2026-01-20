Add-Type -AssemblyName System.Drawing

$color = [System.Drawing.Color]::FromArgb(138, 43, 226)

# Create bitmaps for the ico
$sizes = @(16, 32, 48, 256)
$bitmaps = @()

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear($color)
    $g.Dispose()
    $bitmaps += $bmp
}

# Create ICO file manually
$iconPath = "$PSScriptRoot\icon.ico"

# ICO header
$header = [byte[]](0, 0, 1, 0, [byte]$sizes.Count, 0)

$offset = 6 + (16 * $sizes.Count)  # Header + directory entries
$imageData = @()

$directory = @()

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $bmp = $bitmaps[$i]
    $size = $sizes[$i]

    # Convert bitmap to PNG bytes
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytes = $ms.ToArray()
    $ms.Dispose()

    # Directory entry: width, height, colors, reserved, planes, bpp, size, offset
    $w = if ($size -eq 256) { 0 } else { [byte]$size }
    $h = if ($size -eq 256) { 0 } else { [byte]$size }

    $dirEntry = [byte[]]@(
        $w, $h, 0, 0,  # width, height, colors, reserved
        1, 0,          # planes (little endian)
        32, 0          # bpp (little endian)
    )
    $sizeBytes = [BitConverter]::GetBytes([uint32]$pngBytes.Length)
    $offsetBytes = [BitConverter]::GetBytes([uint32]$offset)

    $directory += ,($dirEntry + $sizeBytes + $offsetBytes)
    $imageData += ,$pngBytes
    $offset += $pngBytes.Length
}

# Write ICO file
$fs = [System.IO.File]::Create($iconPath)
$fs.Write($header, 0, $header.Length)

foreach ($entry in $directory) {
    $fs.Write($entry, 0, $entry.Length)
}

foreach ($data in $imageData) {
    $fs.Write($data, 0, $data.Length)
}

$fs.Close()

# Cleanup
foreach ($bmp in $bitmaps) {
    $bmp.Dispose()
}

Write-Host "Valid ICO file created at $iconPath"
