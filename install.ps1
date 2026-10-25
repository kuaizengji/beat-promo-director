<#
.SYNOPSIS
    安装 beat-promo-director 技能（默认：DSH 用户级全局目录）。
.DESCRIPTION
    把 SKILL.md / kit / references / examples 复制到 <Dest>/beat-promo-director。
    -WithRules 时，还会把 AGENTS.example.md 的规则追加到全局 AGENTS.md（先备份原文件）。
.EXAMPLE
    .\install.ps1
.EXAMPLE
    .\install.ps1 -WithRules -Force
.EXAMPLE
    .\install.ps1 -Dest "C:\path\to\project\.dsh\skills"
#>
[CmdletBinding()]
param(
    [string]$Dest = (Join-Path $HOME '.dsh\skills'),
    [switch]$WithRules,
    [string]$RulesFile = (Join-Path $HOME '.dsh\AGENTS.md'),
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$target = Join-Path $Dest 'beat-promo-director'

if (Test-Path -LiteralPath $target) {
    if (-not $Force) {
        throw "目标已存在：$target（加 -Force 覆盖）"
    }
    Remove-Item -LiteralPath $target -Recurse -Force
}

New-Item -ItemType Directory -Path $target -Force | Out-Null
foreach ($item in @('SKILL.md', 'kit', 'references', 'examples')) {
    Copy-Item -LiteralPath (Join-Path $src $item) -Destination $target -Recurse -Force
}
Write-Host "✓ 已安装技能 -> $target"

if ($WithRules) {
    $rulesSrc = Join-Path $src 'AGENTS.example.md'
    $rulesDir = Split-Path -Parent $RulesFile
    if ($rulesDir) { New-Item -ItemType Directory -Path $rulesDir -Force | Out-Null }
    if (Test-Path -LiteralPath $RulesFile) {
        $backup = "$RulesFile.bak-$(Get-Date -Format yyyyMMddHHmmss)"
        Copy-Item -LiteralPath $RulesFile -Destination $backup -Force
        Write-Host "已备份原规则 -> $backup"
        Add-Content -LiteralPath $RulesFile -Value "`r`n"
        Get-Content -LiteralPath $rulesSrc -Raw -Encoding UTF8 |
            Add-Content -LiteralPath $RulesFile -Encoding UTF8
    }
    else {
        Copy-Item -LiteralPath $rulesSrc -Destination $RulesFile -Force
    }
    Write-Host "✓ 已写入规则 -> $RulesFile"
}

Write-Host ""
Write-Host "下一步：node -v && ffmpeg -version && npx --yes hyperframes@latest browser ensure"
