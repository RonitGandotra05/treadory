param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-p]{32}$')][string]$ExtensionId,
  [string]$InterceptionDll,
  [string]$DllSha256,
  [switch]$AcceptApplicableInterceptionLicense
)
$ErrorActionPreference = 'Stop'
if ([IntPtr]::Size -ne 8) { throw 'Use x64 Windows PowerShell for this Windows x64 preview.' }
$dll = $null
if ($InterceptionDll) {
  if (-not $AcceptApplicableInterceptionLicense) { throw 'Obtain and review the applicable Interception license first.' }
  if ($DllSha256 -notmatch '^[0-9a-fA-F]{64}$') { throw 'Provide the independently verified SHA-256 of the licensed DLL.' }
  $dll = (Resolve-Path -LiteralPath $InterceptionDll).Path
  if ((Get-FileHash -LiteralPath $dll -Algorithm SHA256).Hash -ne $DllSha256) { throw 'DLL checksum mismatch. Nothing was installed.' }
} elseif ($DllSha256 -or $AcceptApplicableInterceptionLicense) { throw 'Supply all three DLL/license arguments together, or omit all three for read-only inspection.' }
$source = Join-Path $PSScriptRoot 'host'
$exe = Join-Path $source 'treadory-helper.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Build the Windows helper package first. See README.md.' }
# Framework-dependent preview: .NET 10 Runtime is an explicit prerequisite.
& $exe --self-test
if ($LASTEXITCODE -ne 0) { throw 'Helper self-test failed or the .NET 10 Runtime is missing. Nothing was installed.' }
$destination = Join-Path $env:LOCALAPPDATA 'Treadory\Helper'
if (Test-Path -LiteralPath $destination) { throw 'An installation already exists. Stop capture and run uninstall.ps1 first.' }
$manifest = @{name='app.treadory.helper';description='Treadory Windows pedal helper';path=(Join-Path $destination 'treadory-helper.exe');type='stdio';allowed_origins=@("chrome-extension://$ExtensionId/")}
$roots = @('HKCU:\Software\Google\Chrome\NativeMessagingHosts\app.treadory.helper','HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\app.treadory.helper','HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\app.treadory.helper')
foreach ($root in $roots) { if (Test-Path $root) { throw 'A Treadory native host registration already exists. Uninstall it first.' } }
try {
  New-Item -ItemType Directory -Path $destination -Force | Out-Null
  Copy-Item -Path (Join-Path $source '*') -Destination $destination
  if ($dll) { Copy-Item -LiteralPath $dll -Destination (Join-Path $destination 'interception.dll') }
  Set-Content -LiteralPath (Join-Path $destination 'allowed-origin.txt') -Value "chrome-extension://$ExtensionId/" -Encoding ASCII
  $manifestPath = Join-Path $destination 'app.treadory.helper.json'
  [System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 4), [System.Text.UTF8Encoding]::new($false))
  foreach ($root in $roots) { New-Item -Path $root -Force | Out-Null; Set-Item -Path $root -Value $manifestPath }
} catch {
  foreach ($root in $roots) { if (Test-Path $root) { Remove-Item -Path $root -Recurse -Force } }
  if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Recurse -Force }
  throw
}
Write-Host 'Installed for this Windows user. In the extension, open Computer-wide control. Capture is always manual.'
