$ErrorActionPreference = 'Stop'
$destination = Join-Path $env:LOCALAPPDATA 'Treadory\Helper'
$expected = Join-Path $destination 'app.treadory.helper.json'
$running = Get-Process -Name 'treadory-helper' -ErrorAction SilentlyContinue
if ($running) { throw 'Stop capture and disconnect the helper in Treadory first. Close the browser if needed, then retry.' }
foreach ($root in @('HKCU:\Software\Google\Chrome\NativeMessagingHosts\app.treadory.helper','HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\app.treadory.helper','HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\app.treadory.helper')) {
  if ((Test-Path $root) -and (Get-Item $root).GetValue('') -eq $expected) { Remove-Item -Path $root -Recurse -Force }
}
if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Recurse -Force }
Write-Host 'Treadory helper removed. The separately installed Interception driver is unchanged. Use its official uninstaller to remove it, then reboot as instructed.'
