param([string]$SdkPath = '')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot

# Requires Android Studio with Android SDK Platform 35 and Build Tools 35.0.0.
# Runs as your normal Windows user. It never changes machine execution policy.
$taskJavaCandidates = @()
if ($env:JAVA_HOME) { $taskJavaCandidates += $env:JAVA_HOME }
$taskJavaCandidates += (Join-Path $env:ProgramFiles 'Android\Android Studio\jbr')
if ($env:LOCALAPPDATA) { $taskJavaCandidates += (Join-Path $env:LOCALAPPDATA 'Programs\Android Studio\jbr') }
$taskJava = $taskJavaCandidates | Where-Object { Test-Path (Join-Path $_ 'bin\java.exe') } | Select-Object -First 1
if (-not $taskJava) { throw 'Install Android Studio first: https://developer.android.com/studio . Then run this file again.' }
$env:JAVA_HOME = $taskJava
if (-not $SdkPath) {
    if ($env:ANDROID_HOME) { $SdkPath = $env:ANDROID_HOME }
    elseif ($env:ANDROID_SDK_ROOT) { $SdkPath = $env:ANDROID_SDK_ROOT }
    else { $SdkPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
}
if (-not (Test-Path (Join-Path $SdkPath 'platforms\android-35\android.jar'))) {
    throw 'Open Android Studio > SDK Manager and install Android SDK Platform 35. Re-run this script; use -SdkPath if your SDK is in a custom location.'
}
if (-not (Test-Path (Join-Path $SdkPath 'build-tools\35.0.0'))) {
    throw 'Open Android Studio > SDK Manager > SDK Tools > Show Package Details and install Android SDK Build-Tools 35.0.0.'
}
$env:ANDROID_HOME = $SdkPath
$taskSdkEscaped = $SdkPath.Replace('\','/').Replace(':','\:')
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'local.properties'), "sdk.dir=$taskSdkEscaped`n", (New-Object System.Text.UTF8Encoding($false)))
$taskTools = Join-Path $PSScriptRoot '.build-tools'
New-Item -ItemType Directory -Force -Path $taskTools | Out-Null
$taskGradle = Join-Path $taskTools 'gradle-8.11.1\bin\gradle.bat'
if (-not (Test-Path $taskGradle)) {
    $taskZip = Join-Path $taskTools 'gradle-8.11.1-bin.zip'
    $taskSource = 'https://services.gradle.org/distributions/gradle-8.11.1-bin.zip'
    Write-Host 'Downloading Gradle from its official distribution server...'
    Invoke-WebRequest -Uri $taskSource -OutFile $taskZip -UseBasicParsing
    $taskChecksumFile = Join-Path $taskTools 'gradle-8.11.1-bin.zip.sha256'
    Invoke-WebRequest -Uri ($taskSource + '.sha256') -OutFile $taskChecksumFile -UseBasicParsing
    $taskExpected = ([System.IO.File]::ReadAllText($taskChecksumFile)).Trim().ToLowerInvariant()
    if ($taskExpected -notmatch '^[0-9a-f]{64}$') { throw 'The official Gradle checksum could not be read. Nothing was executed.' }
    $taskActual = (Get-FileHash $taskZip -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($taskActual -ne $taskExpected) { throw 'Gradle checksum mismatch. Delete .build-tools/gradle-8.11.1-bin.zip and retry.' }
    Expand-Archive -LiteralPath $taskZip -DestinationPath $taskTools -Force
}
Write-Host 'Building Vestige Stock. The first build downloads Android dependencies...'
& $taskGradle --no-daemon :app:assembleDebug :app:lintDebug wrapper --gradle-version 8.11.1 --distribution-type bin
if ($LASTEXITCODE -ne 0) { throw 'Gradle failed. Review the build output above.' }
$taskApk = Join-Path $PSScriptRoot 'app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $taskApk)) { throw 'Build completed without the expected APK. Inspect the Gradle output.' }
$taskOutput = Join-Path $PSScriptRoot 'Vestige-Stock-1.1.0-debug.apk'
Copy-Item -LiteralPath $taskApk -Destination $taskOutput -Force
Write-Host "APK created: $taskOutput"
Write-Host 'Copy this APK to your Android phone and open it to install.'
Write-Host 'Keep the same signing key for future updates. This is a debug build for your own testing.'
