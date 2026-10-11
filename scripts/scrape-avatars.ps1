$ErrorActionPreference = 'Continue'
$handles = '@rickastley','@officialpsy','@luisfonsi','@queenofficial','@markronson','@katyperry','@alanwalkermusic','@edsheeran','@wizkhalifa','@adele','@shakira','@taylorswift','@maroon5','@pharrellwilliams','@onerepublic','@lofigirl','@3blue1brown','@jsconf','@youtubedevelopers','@jawed','@4ktravel','@charliebtf','@evolutionofdance','@tayzonday','@pinkfong','@michaeljackson','@ladygaga','@sia','@coldplay','@imaginedragons','@brunomars','@drake'
$out = @{}
foreach ($h in $handles) {
  try {
    $r = Invoke-WebRequest -Uri "https://www.youtube.com/$h" -TimeoutSec 25 -UseBasicParsing -Headers @{ "Accept-Language"="en-US,en;q=0.9" }
    $m = [regex]::Match($r.Content, '(yt3\.googleusercontent\.com/[A-Za-z0-9_\-=/]+)')
    if ($m.Success) {
      $url = 'https://' + ($m.Value -replace '=s\d+-c-k-c0x00ffffff-no-rj$', '=s120-c-k-c0x00ffffff-no-rj')
      # verify s120 variant returns an image
      try {
        $img = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 15 -UseBasicParsing
        if ($img.StatusCode -eq 200) { $out[$h] = $url; Write-Output "$h OK $($img.Headers['Content-Type'])" }
        else { Write-Output "$h HEAD $($img.StatusCode)" }
      } catch { Write-Output "$h HEADERR" }
    } else { Write-Output "$h NOYT3" }
  } catch { Write-Output "$h ERR $($_.Exception.Message)" }
}
$out | ConvertTo-Json | Set-Content -Path "$PSScriptRoot\avatars.json" -Encoding UTF8
Write-Output "saved $($out.Count)/$($handles.Count)"
