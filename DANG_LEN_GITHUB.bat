@echo off
chcp 65001 > nul
title DANG DU AN LEN GITHUB DE KICH HOAT CLOUD 24/7

echo ====================================================================
echo   DỰ ÁN: Chấm công đội_HIREE (BẢN CLOUD 24/7)
echo ====================================================================
echo.
echo Dán đường link kho GitHub của bạn vào đây:
echo (Ví dụ: https://github.com/ten-ban/chamcongkhoan-hiree.git)
echo.
set /p REPO_URL="URL kho GitHub: "

if "%REPO_URL%"=="" (
    echo Bạn chưa nhập URL.
    pause
    exit /b
)

git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
git push -u origin main

echo.
echo ====================================================================
echo ĐÃ ĐẨY DỰ ÁN LÊN GITHUB THÀNH CÔNG!
echo Bây giờ bạn mở trang Render.com và chọn kho này để nhận đường link:
echo https://chamcongkhoan-hiree.onrender.com chạy 24/7 vĩnh viễn!
echo ====================================================================
pause
