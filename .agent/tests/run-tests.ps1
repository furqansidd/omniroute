# Antigravity Profile Test Runner for PowerShell
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentDir = Split-Path -Parent $scriptDir
$rootDir = Split-Path -Parent $agentDir

$passCount = 0
$failCount = 0

function Pass-Check($msg) {
    Write-Host "  [PASS] $msg" -ForegroundColor Green
    $script:passCount++
}

function Fail-Check($msg) {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    $script:failCount++
}

Write-Host "========================================"
Write-Host " Antigravity Profile Checks (PowerShell)"
Write-Host "========================================"
Write-Host ""
Write-Host "Checking required files..."

$requiredFiles = @(
    "$agentDir\AGENTS.md",
    "$agentDir\INSTALL.md",
    "$agentDir\task.md",
    "$agentDir\workflows\brainstorm.md",
    "$agentDir\workflows\write-plan.md",
    "$agentDir\workflows\execute-plan.md",
    "$agentDir\agents\code-reviewer.md",
    "$scriptDir\check-antigravity-profile.sh",
    "$scriptDir\run-tests.sh"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file -PathType Leaf) {
        Pass-Check "File exists: $file"
    } else {
        Fail-Check "Missing file: $file"
    }
}

if (-not (Test-Path "$rootDir\docs\plans\task.md")) {
    Pass-Check "Runtime tracking file absent (clean state): docs/plans/task.md"
} else {
    Pass-Check "Runtime tracking file present (active task state): docs/plans/task.md"
}

$requiredSkills = @(
    "brainstorming",
    "executing-plans",
    "finishing-a-development-branch",
    "receiving-code-review",
    "requesting-code-review",
    "systematic-debugging",
    "test-driven-development",
    "using-git-worktrees",
    "using-superpowers",
    "verification-before-completion",
    "writing-plans",
    "writing-skills",
    "single-flow-task-execution"
)

foreach ($skill in $requiredSkills) {
    $skillFile = "$agentDir\skills\$skill\SKILL.md"
    if (Test-Path $skillFile -PathType Leaf) {
        Pass-Check "File exists: $skillFile"
    } else {
        Fail-Check "Missing file: $skillFile"
    }
}

$promptFiles = @(
    "$agentDir\skills\single-flow-task-execution\implementer-prompt.md",
    "$agentDir\skills\single-flow-task-execution\spec-reviewer-prompt.md",
    "$agentDir\skills\single-flow-task-execution\code-quality-reviewer-prompt.md"
)
foreach ($pf in $promptFiles) {
    if (Test-Path $pf -PathType Leaf) {
        Pass-Check "File exists: $pf"
    } else {
        Fail-Check "Missing file: $pf"
    }
}

Write-Host ""
Write-Host "Checking frontmatter..."
foreach ($skill in $requiredSkills) {
    $skillFile = "$agentDir\skills\$skill\SKILL.md"
    $content = Get-Content $skillFile -Raw
    if ($content -match '^---[\r\n]') {
        Pass-Check "$skill has frontmatter delimiters"
    } else {
        Fail-Check "$skill missing frontmatter delimiters"
    }
    if ($content -match '(?m)^name:\s*\S+') {
        Pass-Check "$skill has name field"
    } else {
        Fail-Check "$skill missing name field"
    }
    if ($content -match '(?m)^description:\s*\S+') {
        Pass-Check "$skill has description field"
    } else {
        Fail-Check "$skill missing description field"
    }
}

Write-Host ""
Write-Host "Checking for unsupported legacy instructions..."
$legacyPatterns = @(
    'Skill tool',
    'Task tool with',
    'Task\("',
    'Dispatch implementer subagent',
    'Dispatch code-reviewer subagent',
    'Create TodoWrite',
    'Mark task complete in TodoWrite',
    'Use TodoWrite',
    'superpowers:'
)

foreach ($pattern in $legacyPatterns) {
    $found = Get-ChildItem -Path "$agentDir\skills" -Recurse -Filter "*.md" | Select-String -Pattern $pattern
    if ($found) {
        Fail-Check "Legacy pattern found in skills: $pattern"
    } else {
        Pass-Check "Legacy pattern absent: $pattern"
    }
}

Write-Host ""
Write-Host "Checking AGENTS mapping contract..."
$agentsContent = Get-Content "$agentDir\AGENTS.md" -Raw
$mappingChecks = @(
    'Task.*task_boundary',
    'browser_subagent',
    'Skill.*view_file',
    'TodoWrite.*docs/plans/task\.md',
    'run_command',
    'grep_search',
    'find_by_name',
    'mcp_\*'
)

foreach ($pattern in $mappingChecks) {
    if ($agentsContent -match $pattern) {
        Pass-Check "AGENTS includes mapping: $pattern"
    } else {
        Fail-Check "AGENTS missing mapping: $pattern"
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host " Summary"
Write-Host "========================================"
Write-Host "  Passed: $passCount"
Write-Host "  Failed: $failCount"
Write-Host ""

if ($failCount -gt 0) {
    Write-Host "STATUS: FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "STATUS: PASSED" -ForegroundColor Green
