$ErrorActionPreference = 'Stop'
foreach ($file in @('native/windows/install.ps1','native/windows/uninstall.ps1')) {
  $tokens = $null; $errors = $null
  [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $file), [ref]$tokens, [ref]$errors) | Out-Null
  if ($errors.Count) { throw ($errors | Out-String) }
}
$stage = Join-Path $env:RUNNER_TEMP 'treadory-install-fixture'
New-Item -ItemType Directory -Path $stage -Force | Out-Null
Copy-Item -Recurse -Path 'releases/windows/host' -Destination $stage
Copy-Item -Path 'native/windows/install.ps1','native/windows/uninstall.ps1' -Destination $stage
# No Interception assets: this fixture exercises hash checks and host registration,
# never loads a driver or performs capture. The managed host self-test is real.
$fixtureDll = Join-Path $stage 'fixture.dll'
[System.IO.File]::WriteAllBytes($fixtureDll, [byte[]](1,2,3,4))
$hash = (Get-FileHash $fixtureDll).Hash
$originalLocal = $env:LOCALAPPDATA
$env:LOCALAPPDATA = Join-Path $stage 'profile with spaces 試験'
try {
  $failed = $false
  try { & (Join-Path $stage 'install.ps1') -ExtensionId ('a'*32) -InterceptionDll $fixtureDll -DllSha256 ('0'*64) -AcceptApplicableInterceptionLicense } catch { $failed = $true }
  if (-not $failed -or (Test-Path (Join-Path $env:LOCALAPPDATA 'Treadory/Helper'))) { throw 'Checksum failure was not atomic.' }
  & (Join-Path $stage 'install.ps1') -ExtensionId ('a'*32)
  if (Test-Path (Join-Path $env:LOCALAPPDATA 'Treadory/Helper/interception.dll')) { throw 'Read-only install acquired a driver DLL.' }
  & (Join-Path $stage 'uninstall.ps1')
  & (Join-Path $stage 'install.ps1') -ExtensionId ('a'*32) -InterceptionDll $fixtureDll -DllSha256 $hash -AcceptApplicableInterceptionLicense
  $manifestPath = Join-Path $env:LOCALAPPDATA 'Treadory/Helper/app.treadory.helper.json'
  $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
  if ($manifest.allowed_origins.Count -ne 1 -or $manifest.allowed_origins[0] -ne "chrome-extension://$('a'*32)/") { throw 'Origin restriction missing.' }
  if ($manifest.path -ne (Join-Path $env:LOCALAPPDATA 'Treadory/Helper/treadory-helper.exe')) { throw 'Installation path mismatch.' }
  $failed = $false
  try { & (Join-Path $stage 'install.ps1') -ExtensionId ('a'*32) -InterceptionDll $fixtureDll -DllSha256 $hash -AcceptApplicableInterceptionLicense } catch { $failed = $true }
  if (-not $failed) { throw 'Existing installation overwritten.' }
  # Do not overwrite or remove a registration owned by another installation.
  $edge = 'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\app.treadory.helper'
  Set-Item $edge -Value 'C:\other\manifest.json'
  & (Join-Path $stage 'uninstall.ps1')
  if (Test-Path -LiteralPath (Split-Path $manifestPath)) { throw 'Helper files remain after removal.' }
  if ((Get-Item $edge).GetValue('') -ne 'C:\other\manifest.json') { throw 'Foreign registration removed.' }
  Remove-Item $edge -Recurse -Force
  Write-Host 'PASS PowerShell parsing, checksum rejection, driver-free inspection install, self-test prerequisite, Unicode per-user install, origin restriction, overwrite refusal and ownership-preserving uninstall.'
} finally { $env:LOCALAPPDATA = $originalLocal }
