Add-Type -AssemblyName System.Drawing

$color = [System.Drawing.Color]::FromArgb(138, 43, 226)

# Create 256x256 base
$bmp256 = New-Object System.Drawing.Bitmap(256, 256)
$g = [System.Drawing.Graphics]::FromImage($bmp256)
$g.Clear($color)
$g.Dispose()
$bmp256.Save("$PSScriptRoot\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp256.Save("$PSScriptRoot\128x128@2x.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Create 128x128
$bmp128 = New-Object System.Drawing.Bitmap(128, 128)
$g = [System.Drawing.Graphics]::FromImage($bmp128)
$g.Clear($color)
$g.Dispose()
$bmp128.Save("$PSScriptRoot\128x128.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Create 32x32
$bmp32 = New-Object System.Drawing.Bitmap(32, 32)
$g = [System.Drawing.Graphics]::FromImage($bmp32)
$g.Clear($color)
$g.Dispose()
$bmp32.Save("$PSScriptRoot\32x32.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Create ICO file (simple approach - save as bitmap, rename)
$bmp256.Save("$PSScriptRoot\icon.ico", [System.Drawing.Imaging.ImageFormat]::Icon)

$bmp256.Dispose()
$bmp128.Dispose()
$bmp32.Dispose()

Write-Host "Icons created successfully"
