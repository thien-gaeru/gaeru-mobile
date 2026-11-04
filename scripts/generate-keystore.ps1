# Script tao Keystore cho ung dung GAERU Android de upload len Google Play Console
$keystorePath = Join-Path $PSScriptRoot "..\gaeru-release.keystore"
$alias = "gaerukey"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " TAO KEYSTORE RELEASE CHO GAERU ANDROID   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if (Test-Path $keystorePath) {
    Write-Warning "File keystore da ton tai tai: $keystorePath"
    $overwrite = Read-Host "Ban co muon ghi de khong? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Huy bo qua trinh tao keystore." -ForegroundColor Yellow
        exit
    }
    Remove-Item $keystorePath -Force
}

$keytoolCmd = Get-Command "keytool" -ErrorAction SilentlyContinue

if (-not $keytoolCmd) {
    Write-Host "[!] Khong tim thay lenh keytool trong PATH." -ForegroundColor Yellow
    Write-Host "    Keytool thuong nam trong thu muc JDK (vi du: C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe)"
    Write-Host "    Ban co the tao truc tiep trong Android Studio: Build -> Generate Signed Bundle -> Create new keystore." -ForegroundColor Green
    exit
}

Write-Host "Dang tao keystore moi tai: $keystorePath ..." -ForegroundColor Green
& keytool -genkey -v -keystore $keystorePath -alias $alias -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=GAERU, OU=Store, O=GAERU, L=Rang Dong, ST=Ninh Binh, C=VN"

if (Test-Path $keystorePath) {
    Write-Host "`n[THANH CONG] Da tao xong keystore tai: $keystorePath" -ForegroundColor Green
    Write-Host "Hay luu giu file nay va mat khau that can than vi Google Play can no cho moi ban cap nhat!" -ForegroundColor Red
} else {
    Write-Host "`n[THAT BAI] Khong the tao keystore." -ForegroundColor Red
}
