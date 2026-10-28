$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host ('Project: '+$PSScriptRoot)
$tools='C:/Users/86136/AppData/Local/OOTRIP-tools/node-v24.16.0-win-x64'
if(Test-Path -LiteralPath ($tools+'/node.exe')){$env:PATH=$tools+';'+$env:PATH}
$npm=(Get-Command npm.cmd -ErrorAction Stop).Source
$module=Join-Path $PSScriptRoot 'integrations/fitting-journal'
if(!(Test-Path -LiteralPath ($module+'/node_modules/fastify/package.json'))){& $npm ci --prefix $module --ignore-scripts --no-audit --no-fund --cache ($module+'/.npm-cache');if($LASTEXITCODE){throw 'Module dependencies could not be installed'}}
if(!(Test-Path -LiteralPath ($module+'/tools/lucy-realtime/node_modules/@decartai/sdk/package.json'))){& $npm ci --prefix ($module+'/tools/lucy-realtime') --ignore-scripts --no-audit --no-fund --cache ($module+'/.npm-cache');if($LASTEXITCODE){throw 'Realtime dependencies could not be installed'}}
& node build.mjs
if($LASTEXITCODE){throw 'Build failed'}
Write-Host 'OOTRIP: http://127.0.0.1:3100/app/index.html'
Write-Host 'Keep this window open. AI starts only after confirmation in the page.'
& node --env-file-if-exists=.env integrations/fitting-journal/tools/lucy-demo/start.mjs
exit $LASTEXITCODE
