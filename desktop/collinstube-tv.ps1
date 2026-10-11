# CollinsTube TV — desktop launcher (zero budget, no Electron, no installs).
# Opens the real YouTube leanback ("TV") interface top-level in a TV-shaped
# Chrome/Edge window using a Smart-TV user agent.
#
# NOTE: This does NOT remove YouTube's own ads. Ad-free playback is not
# claimed anywhere in this project — see docs/youtube-api.md.

$ua = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/76.0.3809.138 TV Safari/537.36'

$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)

$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) {
  Write-Error 'No Chrome or Edge installation found. Install Chrome/Edge (free) and retry.'
  exit 1
}

$profile = Join-Path $PSScriptRoot 'tv-profile'
$target  = if ($env:COLLINSTUBE_URL) { $env:COLLINSTUBE_URL } else { 'https://www.youtube.com/tv' }

$argLine = @(
  "--user-data-dir=`"$profile`""
  "--app=$target"
  '--window-size=1280,720'
  "--user-agent=`"$ua`""
  '--no-first-run'
  '--no-default-browser-check'
) -join ' '

Write-Host "Launching CollinsTube TV via $browser -> $target"
Start-Process -FilePath $browser -ArgumentList $argLine
