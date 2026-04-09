$buildType = "build"
if ($args.Count -gt 0) {
    $buildType = $args[0]
}

$packages = @(
    "core",
    "basic-modules",
    "code-highlight",
    "list-module",
    "table-module",
    "upload-image-module",
    "video-module",
    "editor"
)

$packagesPath = Join-Path $PSScriptRoot "packages"

foreach ($pkg in $packages) {
    $pkgPath = Join-Path $packagesPath $pkg
    $distPath = Join-Path $pkgPath "dist"
    
    Write-Host "Building $pkg..." -ForegroundColor Green
    
    if (Test-Path $distPath) {
        Remove-Item -Recurse -Force $distPath
    }
    
    Push-Location $pkgPath
    yarn $buildType
    Pop-Location
}

Write-Host "All packages built successfully!" -ForegroundColor Green
