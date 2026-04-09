@echo off
setlocal enabledelayedexpansion

set "BUILD_TYPE=build"
if not "%1"=="" set "BUILD_TYPE=%1"

cd /d "%~dp0.."
cd packages

echo Building core...
cd core
if exist dist rmdir /s /q dist
call yarn %BUILD_TYPE%
cd ..

echo Building basic-modules...
cd basic-modules
if exist dist rmdir /s /q dist
call yarn %BUILD_TYPE%
cd ..

echo Building code-highlight...
cd code-highlight
if exist dist rmdir /s /q dist
call yarn %BUILD_TYPE%
cd ..

echo Building list-module...
cd list-module
if exist dist rmdir /s /q dist
call yarn %BUILD_TYPE%
cd ..

echo Building table-module...
cd table-module
if exist dist rmdir /s /q dist
call yarn %BUILD_TYPE%
cd ..

echo Building upload-image-module...
cd upload-image-module
if exist dist rmdir /s /q dist
call yarn %BUILD_TYPE%
cd ..

echo Building video-module...
cd video-module
if exist dist rmdir /s /q dist
call yarn %BUILD_TYPE%
cd ..

echo Building editor...
cd editor
if exist dist rmdir /s /q dist
call yarn %BUILD_TYPE%
cd ..

echo All packages built successfully!
