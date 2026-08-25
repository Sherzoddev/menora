# Menora — окно настройки принт-агента (без чёрного окна консоли).
#
# Запускается через Menora.vbs, который прячет само окно PowerShell —
# видно только это окно и, после сохранения настроек, значок в трее.
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# setup-gui.ps1 живёт в подпапке gui\, а menora-print.exe и config.json —
# на уровень выше, рядом с Menora.vbs.
$GuiDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $GuiDir
$ConfigPath = Join-Path $RootDir "config.json"
$AgentExe = Join-Path $RootDir "menora-print.exe"
$LogPath = Join-Path $RootDir "agent.log"

function Get-PrinterList {
    try {
        Get-Printer | Select-Object -ExpandProperty Name
    } catch {
        @()
    }
}

function Stop-Agent {
    Get-Process -Name "menora-print" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

function Start-AgentHidden {
    Stop-Agent
    Start-Sleep -Milliseconds 300
    Start-Process -FilePath $AgentExe -WindowStyle Hidden `
        -RedirectStandardOutput $LogPath -RedirectStandardError "$LogPath.err" | Out-Null
}

function Load-ExistingConfig {
    if (Test-Path $ConfigPath) {
        try { return Get-Content $ConfigPath -Raw | ConvertFrom-Json } catch { return $null }
    }
    return $null
}

# Запускает $ScriptBlock в фоновом задании (отдельный процесс PowerShell),
# чтобы окно никогда не "замерзало" — ни на Get-Printer/Set-Printer (может
# зависнуть, если диспетчер печати сам завис — именно так и случилось с
# зависшим принтером в реальном тесте), ни на ожидании самого принтера.
# $OnDone($result) вызывается на UI-потоке, когда задание завершится или
# истечёт TimeoutSec (тогда $result будет $null).
function Invoke-Background {
    param(
        [ScriptBlock]$ScriptBlock,
        [object[]]$ArgumentList,
        [ScriptBlock]$OnDone,
        [int]$TimeoutSec = 25
    )
    $job = Start-Job -ScriptBlock $ScriptBlock -ArgumentList $ArgumentList
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 300
    $start = Get-Date
    $timer.Add_Tick({
        if ($job.State -ne 'Running') {
            $timer.Stop()
            $timer.Dispose()
            $result = $null
            try { $result = Receive-Job -Job $job -ErrorAction Stop } catch {}
            Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
            & $OnDone $result
        } elseif (((Get-Date) - $start).TotalSeconds -gt $TimeoutSec) {
            $timer.Stop()
            $timer.Dispose()
            Stop-Job -Job $job -ErrorAction SilentlyContinue
            Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
            & $OnDone $null
        }
    })
    $timer.Start()
}

# Тело фонового задания: расшарить принтер (если ещё не расшарен) и,
# опционально, сразу отправить тестовую печать. Всё внутри одного задания,
# чтобы не плодить несколько окон PowerShell подряд.
$SharePrinterJob = {
    param($PrinterName, $ConfigPath, $AgentExe, $LogPath, $ExistingJson, $RunTest)

    $shareOk = $true
    $shareName = $PrinterName
    $shareError = $null
    try {
        $p = Get-Printer -Name $PrinterName -ErrorAction Stop
        if ($p.Shared -and $p.ShareName) {
            $shareName = $p.ShareName
        } else {
            $clean = ($PrinterName -replace '[^A-Za-z0-9]', '')
            $shareName = $clean.Substring(0, [Math]::Min(30, $clean.Length))
            if (-not $shareName) { $shareName = "MenoraPrinter" }
            Set-Printer -Name $PrinterName -Shared $true -ShareName $shareName -ErrorAction Stop
        }
    } catch {
        $shareOk = $false
        $shareError = $_.Exception.Message
    }

    $merged = @{}
    if ($ExistingJson) {
        ($ExistingJson | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $merged[$_.Name] = $_.Value }
    }
    $merged["PRINTER_NAME"] = $shareName
    Set-Content -Path $ConfigPath -Value ($merged | ConvertTo-Json) -Encoding UTF8

    $exitCode = $null
    if ($RunTest) {
        $p2 = Start-Process -FilePath $AgentExe -ArgumentList "--test" -WindowStyle Hidden -PassThru -Wait `
            -RedirectStandardError "$LogPath.testerr"
        $exitCode = $p2.ExitCode
    }

    [pscustomobject]@{
        ShareOk    = $shareOk
        ShareName  = $shareName
        ShareError = $shareError
        ExitCode   = $exitCode
    }
}

function Show-SetupForm {
    $existing = Load-ExistingConfig
    $existingJson = if ($existing) { $existing | ConvertTo-Json } else { $null }

    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Menora — печать чеков"
    $form.Size = New-Object System.Drawing.Size(420, 400)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false

    $y = 20
    $labelEmail = New-Object System.Windows.Forms.Label
    $labelEmail.Text = "Email от кабинета Menora:"
    $labelEmail.Location = New-Object System.Drawing.Point(20, $y)
    $labelEmail.AutoSize = $true
    $form.Controls.Add($labelEmail)
    $y += 22
    $inputEmail = New-Object System.Windows.Forms.TextBox
    $inputEmail.Location = New-Object System.Drawing.Point(20, $y)
    $inputEmail.Size = New-Object System.Drawing.Size(360, 24)
    if ($existing.CABINET_EMAIL) { $inputEmail.Text = $existing.CABINET_EMAIL }
    $form.Controls.Add($inputEmail)

    $y += 36
    $labelPass = New-Object System.Windows.Forms.Label
    $labelPass.Text = "Пароль:"
    $labelPass.Location = New-Object System.Drawing.Point(20, $y)
    $labelPass.AutoSize = $true
    $form.Controls.Add($labelPass)
    $y += 22
    $inputPass = New-Object System.Windows.Forms.TextBox
    $inputPass.Location = New-Object System.Drawing.Point(20, $y)
    $inputPass.Size = New-Object System.Drawing.Size(360, 24)
    $inputPass.UseSystemPasswordChar = $true
    if ($existing.CABINET_PASSWORD) { $inputPass.Text = $existing.CABINET_PASSWORD }
    $form.Controls.Add($inputPass)

    $y += 36
    $labelSlug = New-Object System.Windows.Forms.Label
    $labelSlug.Text = "Ссылка на ваше меню (или slug):"
    $labelSlug.Location = New-Object System.Drawing.Point(20, $y)
    $labelSlug.AutoSize = $true
    $form.Controls.Add($labelSlug)
    $y += 22
    $inputSlug = New-Object System.Windows.Forms.TextBox
    $inputSlug.Location = New-Object System.Drawing.Point(20, $y)
    $inputSlug.Size = New-Object System.Drawing.Size(360, 24)
    if ($existing.VENUE_SLUG) { $inputSlug.Text = $existing.VENUE_SLUG }
    $form.Controls.Add($inputSlug)

    $y += 36
    $labelPrinter = New-Object System.Windows.Forms.Label
    $labelPrinter.Text = "Принтер:"
    $labelPrinter.Location = New-Object System.Drawing.Point(20, $y)
    $labelPrinter.AutoSize = $true
    $form.Controls.Add($labelPrinter)
    $y += 22
    $comboPrinter = New-Object System.Windows.Forms.ComboBox
    $comboPrinter.Location = New-Object System.Drawing.Point(20, $y)
    $comboPrinter.Size = New-Object System.Drawing.Size(280, 24)
    $comboPrinter.DropDownStyle = "DropDownList"
    $printers = Get-PrinterList
    foreach ($p in $printers) { [void]$comboPrinter.Items.Add($p) }
    if ($existing.PRINTER_NAME -and $comboPrinter.Items.Contains($existing.PRINTER_NAME)) {
        $comboPrinter.SelectedItem = $existing.PRINTER_NAME
    } elseif ($comboPrinter.Items.Count -gt 0) {
        $comboPrinter.SelectedIndex = 0
    }
    $form.Controls.Add($comboPrinter)

    $btnRefresh = New-Object System.Windows.Forms.Button
    $btnRefresh.Text = "Обновить"
    $btnRefresh.Location = New-Object System.Drawing.Point(306, ($y - 1))
    $btnRefresh.Size = New-Object System.Drawing.Size(74, 26)
    $btnRefresh.Add_Click({
        $comboPrinter.Items.Clear()
        foreach ($p in (Get-PrinterList)) { [void]$comboPrinter.Items.Add($p) }
        if ($comboPrinter.Items.Count -gt 0) { $comboPrinter.SelectedIndex = 0 }
    })
    $form.Controls.Add($btnRefresh)

    $y += 40
    $statusLabel = New-Object System.Windows.Forms.Label
    $statusLabel.Location = New-Object System.Drawing.Point(20, $y)
    $statusLabel.Size = New-Object System.Drawing.Size(360, 40)
    $statusLabel.ForeColor = [System.Drawing.Color]::DarkRed
    $form.Controls.Add($statusLabel)

    $y += 46
    $btnTest = New-Object System.Windows.Forms.Button
    $btnTest.Text = "Тестовая печать"
    $btnTest.Location = New-Object System.Drawing.Point(20, $y)
    $btnTest.Size = New-Object System.Drawing.Size(170, 32)
    $form.Controls.Add($btnTest)

    $btnSave = New-Object System.Windows.Forms.Button
    $btnSave.Text = "Сохранить и запустить"
    $btnSave.Location = New-Object System.Drawing.Point(200, $y)
    $btnSave.Size = New-Object System.Drawing.Size(180, 32)
    $form.Controls.Add($btnSave)

    function Set-Busy([bool]$busy, [string]$text) {
        $btnTest.Enabled = -not $busy
        $btnSave.Enabled = -not $busy
        $btnRefresh.Enabled = -not $busy
        $statusLabel.ForeColor = [System.Drawing.Color]::DarkRed
        $statusLabel.Text = $text
    }

    $btnTest.Add_Click({
        if (-not $comboPrinter.SelectedItem) {
            $statusLabel.Text = "Выберите принтер."
            return
        }
        Set-Busy $true "Печатаю..."
        Invoke-Background -ScriptBlock $SharePrinterJob `
            -ArgumentList @($comboPrinter.SelectedItem, $ConfigPath, $AgentExe, $LogPath, $existingJson, $true) `
            -OnDone {
                param($result)
                Set-Busy $false ""
                if (-not $result) {
                    $statusLabel.Text = "Принтер не отвечает (таймаут). Проверьте кабель и что принтер включён."
                    return
                }
                if (-not $result.ShareOk) {
                    [System.Windows.Forms.MessageBox]::Show(
                        "Не удалось автоматически расшарить принтер ($($result.ShareError)).`n`nЗапустите Menora.vbs от имени администратора, либо расшарьте принтер вручную: Панель управления -> Устройства и принтеры -> свойства принтера -> вкладка Доступ.",
                        "Menora", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
                }
                if ($result.ExitCode -eq 0) {
                    $statusLabel.ForeColor = [System.Drawing.Color]::DarkGreen
                    $statusLabel.Text = "Тестовый чек отправлен на печать."
                } else {
                    $statusLabel.ForeColor = [System.Drawing.Color]::DarkRed
                    $statusLabel.Text = "Не удалось напечатать. Проверьте принтер."
                }
            }
    })

    $btnSave.Add_Click({
        if (-not $inputEmail.Text -or -not $inputPass.Text -or -not $inputSlug.Text -or -not $comboPrinter.SelectedItem) {
            $statusLabel.Text = "Заполните все поля."
            return
        }
        Set-Busy $true "Сохраняю..."
        # Логин/пароль/slug сохраняем сразу в JSON, который уйдёт в задание —
        # PRINTER_NAME задание допишет само после расшарки.
        $partial = @{
            CABINET_EMAIL = $inputEmail.Text.Trim()
            CABINET_PASSWORD = $inputPass.Text
            VENUE_SLUG = ($inputSlug.Text.Trim() -replace '.*/([a-zA-Z0-9-]+)/?$', '$1')
        } | ConvertTo-Json
        Invoke-Background -ScriptBlock $SharePrinterJob `
            -ArgumentList @($comboPrinter.SelectedItem, $ConfigPath, $AgentExe, $LogPath, $partial, $false) `
            -OnDone {
                param($result)
                if (-not $result) {
                    Set-Busy $false "Принтер не отвечает (таймаут). Проверьте кабель и что принтер включён."
                    return
                }
                if (-not $result.ShareOk) {
                    Set-Busy $false ""
                    [System.Windows.Forms.MessageBox]::Show(
                        "Не удалось автоматически расшарить принтер ($($result.ShareError)).`n`nЗапустите Menora.vbs от имени администратора, либо расшарьте принтер вручную: Панель управления -> Устройства и принтеры -> свойства принтера -> вкладка Доступ.",
                        "Menora", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
                }
                Start-AgentHidden
                $form.Tag = "started"
                $form.Close()
            }
    })

    [void]$form.ShowDialog()
    return $form.Tag
}

function Show-TrayIcon {
    $trayIcon = New-Object System.Windows.Forms.NotifyIcon
    $trayIcon.Icon = [System.Drawing.SystemIcons]::Application
    $trayIcon.Text = "Menora — печать чеков"
    $trayIcon.Visible = $true

    $menu = New-Object System.Windows.Forms.ContextMenuStrip
    $itemSettings = $menu.Items.Add("Настройки")
    $itemExit = $menu.Items.Add("Выход")
    $trayIcon.ContextMenuStrip = $menu

    $itemSettings.Add_Click({
        $result = Show-SetupForm
        if ($result -eq "started") {
            $trayIcon.ShowBalloonTip(3000, "Menora", "Настройки сохранены, печать перезапущена.", [System.Windows.Forms.ToolTipIcon]::Info)
        }
    })
    $itemExit.Add_Click({
        Stop-Agent
        $trayIcon.Visible = $false
        [System.Windows.Forms.Application]::Exit()
    })

    $trayIcon.ShowBalloonTip(3000, "Menora", "Программа работает в фоне — ждёт новые заказы.", [System.Windows.Forms.ToolTipIcon]::Info)
    [System.Windows.Forms.Application]::Run()
}

$hasConfig = Test-Path $ConfigPath
$forceSetup = $args -contains "--setup"

if (-not $hasConfig -or $forceSetup) {
    $result = Show-SetupForm
    if ($result -ne "started") { exit }
} else {
    Start-AgentHidden
}

Show-TrayIcon
