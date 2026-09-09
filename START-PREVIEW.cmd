@echo off
cd /d "%~dp0"
set "PORT=4181"
echo Open http://127.0.0.1:4181/ in your browser.
echo Keep this window open while previewing.
node preview_server.js
pause
