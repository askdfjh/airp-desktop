$env:CARGO_HOME = "C:\ux-home\.cargo"
$env:RUSTUP_HOME = "C:\rustup"
$env:Path = "C:\ux-home\.cargo\bin;" + $env:Path
Set-Location "F:\DocProject\airp-desktop"
npm run tauri:dev
