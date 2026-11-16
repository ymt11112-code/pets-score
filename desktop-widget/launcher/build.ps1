# 從原始碼重建小型 Windows 啟動器，不需額外下載 .NET 套件。
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$source=Join-Path $PSScriptRoot 'ClassPetLauncher.cs'
$output=Join-Path (Split-Path -Parent $PSScriptRoot) 'bin\ClassPetLauncher.exe'
& $compiler /nologo /codepage:65001 /target:winexe /optimize+ /reference:System.Windows.Forms.dll "/out:$output" $source
if ($LASTEXITCODE -ne 0) { throw 'Launcher build failed' }
