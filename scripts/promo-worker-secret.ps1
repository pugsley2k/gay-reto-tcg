param([switch]$Initialize)
$ErrorActionPreference='Stop'
$promoDirectory=Join-Path (Split-Path $PSScriptRoot -Parent) '.promo-worker'
$promoSecret=Join-Path $promoDirectory 'worker.dpapi'
if($Initialize){
 if(Test-Path -LiteralPath $promoSecret){throw 'Worker already initialized. Reuse the existing credential.'}
 New-Item -ItemType Directory -Path $promoDirectory -Force | Out-Null
 $bytes=New-Object byte[] 32
 [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
 $key=([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()
 $workerId=[guid]::NewGuid().ToString()
 $json=@{site='https://www.gayretrotcg.com';workerId=$workerId;key=$key}|ConvertTo-Json -Compress
 $json|ConvertTo-SecureString -AsPlainText -Force|ConvertFrom-SecureString|Set-Content -LiteralPath $promoSecret
 $hash=[System.Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($key))
 @{workerId=$workerId;tokenHash=([BitConverter]::ToString($hash)).Replace('-','').ToLowerInvariant()}|ConvertTo-Json -Compress
}else{
 $secure=Get-Content -LiteralPath $promoSecret -Raw|ConvertTo-SecureString
 [System.Net.NetworkCredential]::new('',$secure).Password
}
