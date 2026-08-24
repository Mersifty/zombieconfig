@echo off
set "PATH=C:\Program Files\Git\cmd;C:\Program Files\Git\bin;%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"

where git
if %errorlevel% neq 0 (
    echo Git executable not found in PATH or standard Program Files.
    exit /b 1
)

echo Initializing Git repo...
git init
git config user.name "Mersifty"
git config user.email "mersifty@users.noreply.github.com"
git add .
git commit -m "feat: initial release of zombieconfig"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/Mersifty/zombieconfig.git
echo Pushing to GitHub...
git push -u origin main
