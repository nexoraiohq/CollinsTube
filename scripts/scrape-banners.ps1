$ErrorActionPreference = 'Continue'
$handles = '@rickastley','@officialpsy','@luisfonsi','@queenofficial','@markronson','@katyperry','@alanwalkermusic','@edsheeran','@wizkhalifa','@adele','@shakira','@taylorswift','@maroon5','@pharrellwilliams','@onerepublic','@lofigirl','@3blue1brown','@jsconf','@youtubedevelopers','@jawed','@4ktravel','@charliebtf','@evolutionofdance','@tayzonday','@pinkfong','@michaeljackson','@ladygaga','@sia','@coldplay','@imaginedragons','@brunomars','@drake'
$out = @{}
foreach ($h in $handles) {
  try {
    $r = Invoke-WebRequest -Uri "https://www.youtube.com/$h" -TimeoutSec 30 -UseBasicParsing -Headers @{ "Accept-Language"="en-US,en;q=0.9"; "User-Agent"="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" }
    $m = [regex]::Match($r.Content, '"banner":\{"imageBannerViewModel":\{"image":\{"sources":\[\{"url":"(https://yt3\.googleusercontent\.com/[^"]+)"')
    if ($m.Success) {
      $url = $m.Groups[1].Value -replace '\\/', '/'
      # request a wide variant for quality
      $url = $url -replace '=w\d+', '=w1760'
      try {
        $img = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 15 -UseBasicParsing
        if ($img.StatusCode -eq 200 -and $img.Headers['Content-Type'] -like 'image*') { $out[$h] = $url; Write-Output "$h OK" }
        else { Write-Output "$h HEAD $($img.StatusCode)" }
      } catch { Write-Output "$h HEADERR" }
    } else { Write-Output "$h NOBANNER" }
  } catch { Write-Output "$h ERR $($_.Exception.Message)" }
  Start-Sleep -Milliseconds 400
}
$out | ConvertTo-Json | Set-Content -Path "$PSScriptRoot\banners.json" -Encoding UTF8
Write-Output "saved $($out.Count)/$($handles.Count)"
