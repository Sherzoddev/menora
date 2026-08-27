# Menora — окно настройки принт-агента (без чёрного окна консоли).
#
# Запускается через Menora.vbs, который прячет само окно PowerShell —
# видно только это окно и, после сохранения настроек, значок в трее.
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# setup-gui.ps1 живёт в подпапке gui\, а menora-print.exe — на уровень
# выше, рядом с Menora.vbs.
$GuiDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $GuiDir
$AgentExe = Join-Path $RootDir "menora-print.exe"
$LogPath = Join-Path $RootDir "agent.log"

# Конфиг НЕЛЬЗЯ хранить рядом с программой: папку с программой кладут на
# рабочий стол, а он у большинства синхронизируется OneDrive — и логин с
# паролем от кабинета разъезжались на все компьютеры владельца. LocalAppData
# не синхронизируется никогда и у каждой учётной записи Windows свой.
$script:ConfigDir = Join-Path $env:LOCALAPPDATA "Menora"
$script:ConfigPath = Join-Path $script:ConfigDir "config.json"
$ConfigDir = $script:ConfigDir
$ConfigPath = $script:ConfigPath
$LegacyConfigPath = Join-Path $RootDir "config.json"

# Пароль на диске держим зашифрованным через DPAPI: ключ привязан к текущей
# учётной записи Windows и к этому компьютеру, поэтому скопированный файл на
# другой машине не расшифруется. Расшифровываем только в памяти, перед самым
# запуском агента, и передаём ему через переменную окружения (agent.js их
# читает — см. resolveConfig), чтобы пароль вообще не попадал в файл.
function Protect-Secret([string]$plain) {
    if (-not $plain) { return "" }
    $secure = ConvertTo-SecureString $plain -AsPlainText -Force
    return ConvertFrom-SecureString $secure
}

function Unprotect-Secret([string]$encrypted) {
    if (-not $encrypted) { return "" }
    try {
        $secure = ConvertTo-SecureString $encrypted
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try {
            return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        } finally {
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
    } catch {
        # Файл принесли с другой машины/учётки — расшифровать нельзя,
        # владелец введёт пароль заново.
        return ""
    }
}

# ---------- Оформление ----------
$ColorBg = [System.Drawing.Color]::FromArgb(0xFA, 0xF8, 0xF5)
$ColorCard = [System.Drawing.Color]::White
$ColorText = [System.Drawing.Color]::FromArgb(0x2A, 0x24, 0x1D)
$ColorMuted = [System.Drawing.Color]::FromArgb(0x8A, 0x80, 0x74)
$ColorAccent = [System.Drawing.Color]::FromArgb(0xD9, 0x77, 0x06)
$ColorAccentDark = [System.Drawing.Color]::FromArgb(0xB4, 0x5F, 0x04)
$ColorBorder = [System.Drawing.Color]::FromArgb(0xE7, 0xE1, 0xD8)
$ColorOk = [System.Drawing.Color]::FromArgb(0x15, 0x80, 0x3D)
$ColorErr = [System.Drawing.Color]::FromArgb(0xC0, 0x2B, 0x1D)
$FontFamily = "Segoe UI"

function New-Label([string]$text, [int]$x, [int]$y, [int]$w = 380, [System.Drawing.Color]$color = $ColorText, [single]$size = 9.5, [System.Drawing.FontStyle]$style = [System.Drawing.FontStyle]::Regular) {
    $l = New-Object System.Windows.Forms.Label
    $l.Text = $text
    $l.Location = New-Object System.Drawing.Point($x, $y)
    $l.Size = New-Object System.Drawing.Size($w, 20)
    $l.ForeColor = $color
    $l.Font = New-Object System.Drawing.Font($FontFamily, $size, $style)
    $l.BackColor = [System.Drawing.Color]::Transparent
    return $l
}

function New-TextBox([int]$x, [int]$y, [int]$w, [bool]$password = $false) {
    $t = New-Object System.Windows.Forms.TextBox
    $t.Location = New-Object System.Drawing.Point($x, $y)
    $t.Size = New-Object System.Drawing.Size($w, 26)
    $t.Font = New-Object System.Drawing.Font($FontFamily, 9.5)
    $t.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
    if ($password) { $t.UseSystemPasswordChar = $true }
    return $t
}

function New-FlatButton([string]$text, [int]$x, [int]$y, [int]$w, [int]$h, [bool]$primary = $false) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $text
    $b.Location = New-Object System.Drawing.Point($x, $y)
    $b.Size = New-Object System.Drawing.Size($w, $h)
    $b.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $b.FlatAppearance.BorderSize = if ($primary) { 0 } else { 1 }
    $b.FlatAppearance.BorderColor = $ColorBorder
    $b.Font = New-Object System.Drawing.Font($FontFamily, 9.5, [System.Drawing.FontStyle]::Regular)
    $b.Cursor = [System.Windows.Forms.Cursors]::Hand
    if ($primary) {
        $b.BackColor = $ColorAccent
        $b.ForeColor = [System.Drawing.Color]::White
        $b.FlatAppearance.MouseOverBackColor = $ColorAccentDark
    } else {
        $b.BackColor = [System.Drawing.Color]::White
        $b.ForeColor = $ColorText
        $b.FlatAppearance.MouseOverBackColor = $ColorBg
    }
    return $b
}

# Кнопка-переключатель транспорта (Windows/USB/Bluetooth) — три штуки в
# ряд, вид как у сегмент-контрола: активная закрашена акцентом.
function New-ToggleButton([string]$text, [int]$x, [int]$y, [int]$w) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $text
    $b.Tag = $false
    $b.Location = New-Object System.Drawing.Point($x, $y)
    $b.Size = New-Object System.Drawing.Size($w, 32)
    $b.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $b.FlatAppearance.BorderSize = 1
    $b.FlatAppearance.BorderColor = $ColorBorder
    $b.Font = New-Object System.Drawing.Font($FontFamily, 9.5)
    $b.Cursor = [System.Windows.Forms.Cursors]::Hand
    $b.BackColor = [System.Drawing.Color]::White
    $b.ForeColor = $ColorMuted
    return $b
}

function Set-ToggleActive($btn, [bool]$active) {
    $btn.Tag = $active
    if ($active) {
        $btn.BackColor = $ColorAccent
        $btn.ForeColor = [System.Drawing.Color]::White
        $btn.Font = New-Object System.Drawing.Font($FontFamily, 9.5, [System.Drawing.FontStyle]::Bold)
    } else {
        $btn.BackColor = [System.Drawing.Color]::White
        $btn.ForeColor = $ColorMuted
        $btn.Font = New-Object System.Drawing.Font($FontFamily, 9.5)
    }
}

# ---------- Кодировки — все, что понимает node-thermal-printer. Кириллица
# (в т.ч. украинская/казахская) — в начале списка, остальное ниже. ----------
$CHARSETS = @(
    @{ Key = "PC866_CYRILLIC2"; Label = "Кириллица — PC866 (самая частая)" }
    @{ Key = "WPC1251_CYRILLIC"; Label = "Кириллица — Windows-1251" }
    @{ Key = "PC855_CYRILLIC"; Label = "Кириллица — PC855" }
    @{ Key = "PC1125_UKRANIAN"; Label = "Кириллица — украинская (PC1125)" }
    @{ Key = "KZ1048_KAZAKHSTAN"; Label = "Кириллица — казахская (KZ1048)" }
    @{ Key = "PC437_USA"; Label = "Латиница — PC437 (US)" }
    @{ Key = "WPC1252"; Label = "Латиница — Windows-1252" }
    @{ Key = "PC850_MULTILINGUAL"; Label = "Латиница — PC850" }
    @{ Key = "PC852_LATIN2"; Label = "Латиница — PC852" }
    @{ Key = "ISO8859_2_LATIN2"; Label = "Латиница — ISO-8859-2" }
    @{ Key = "WPC1250_LATIN2"; Label = "Латиница — Windows-1250" }
    @{ Key = "WPC1254_TURKISH"; Label = "Турецкая — Windows-1254" }
    @{ Key = "PC857_TURKISH"; Label = "Турецкая — PC857" }
    @{ Key = "WPC1258_VIETNAMESE"; Label = "Вьетнамская — Windows-1258" }
    @{ Key = "WPC1256_ARABIC"; Label = "Арабская — Windows-1256" }
    @{ Key = "WPC1255_HEBREW"; Label = "Иврит — Windows-1255" }
)

function Get-PrinterList {
    try {
        Get-Printer | Select-Object -ExpandProperty Name
    } catch {
        @()
    }
}

# Список USB/Bluetooth-устройств спрашиваем у самого агента (--list-devices)
# — он и так умеет их перечислять для печати, дублировать эту логику в
# PowerShell незачем.
function Get-AgentDeviceList([string]$transport) {
    try {
        $json = & $AgentExe --list-devices $transport 2>$null
        if (-not $json) { return @() }
        $parsed = $json | ConvertFrom-Json
        if ($null -eq $parsed) { return @() }
        return @($parsed)
    } catch {
        return @()
    }
}

function Stop-Agent {
    Get-Process -Name "menora-print" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

function Start-AgentHidden {
    Stop-Agent
    Start-Sleep -Milliseconds 300
    # Пароль передаём процессу агента через окружение, а не через файл —
    # см. Protect-Secret выше. Дочерний процесс наследует переменные этого.
    $cfg = Load-ExistingConfig
    if ($cfg -and $cfg.CABINET_PASSWORD_ENC) {
        $env:CABINET_PASSWORD = Unprotect-Secret $cfg.CABINET_PASSWORD_ENC
    }
    $env:MENORA_CONFIG_PATH = $script:ConfigPath
    Start-Process -FilePath $AgentExe -WindowStyle Hidden `
        -RedirectStandardOutput $LogPath -RedirectStandardError "$LogPath.err" | Out-Null
    # В самом окне пароль дальше не нужен — не оставляем его в окружении.
    $env:CABINET_PASSWORD = $null
}

function Load-ExistingConfig {
    if (Test-Path $script:ConfigPath) {
        try {
            $raw = [System.IO.File]::ReadAllText($script:ConfigPath, [System.Text.Encoding]::UTF8)
            return $raw | ConvertFrom-Json
        } catch { return $null }
    }
    return $null
}

# Переезд со старого места (config.json рядом с программой, в синхронизируемой
# папке) на LocalAppData. Пароль при этом шифруется, а старый файл с открытым
# паролем удаляется — иначе он так и остался бы лежать в OneDrive.
function Migrate-LegacyConfig {
    if (-not (Test-Path $LegacyConfigPath)) { return }
    if (-not (Test-Path $script:ConfigDir)) {
        New-Item -ItemType Directory -Path $script:ConfigDir -Force | Out-Null
    }
    if (-not (Test-Path $script:ConfigPath)) {
        try {
            $raw = [System.IO.File]::ReadAllText($LegacyConfigPath, [System.Text.Encoding]::UTF8)
            $old = $raw | ConvertFrom-Json
            $cfg = @{}
            $old.PSObject.Properties | ForEach-Object { $cfg[$_.Name] = $_.Value }
            if ($cfg.CABINET_PASSWORD) {
                $cfg["CABINET_PASSWORD_ENC"] = Protect-Secret ([string]$cfg.CABINET_PASSWORD)
                $cfg.Remove("CABINET_PASSWORD")
            }
            Save-Config $cfg
        } catch {
            # Старый файл битый — просто начнём с чистой настройки.
        }
    }
    Remove-Item $LegacyConfigPath -Force -ErrorAction SilentlyContinue
}

function Save-Config([hashtable]$cfg) {
    if (-not (Test-Path $script:ConfigDir)) {
        New-Item -ItemType Directory -Path $script:ConfigDir -Force | Out-Null
    }
    # Без BOM — JSON.parse в Node на нём спотыкается (agent.js это уже
    # переживёт, но пусть файл будет корректным с самого начала).
    [System.IO.File]::WriteAllText($script:ConfigPath, ($cfg | ConvertTo-Json), (New-Object System.Text.UTF8Encoding $false))
}

# «Запускать при включении» — ярлык в папке автозагрузки Windows. То же
# самое, что раньше делал install-autostart.bat отдельным шагом — теперь
# это просто галочка в самом окне, включённая по умолчанию.
function Set-Autostart([bool]$on) {
    $startupDir = [Environment]::GetFolderPath("Startup")
    $linkPath = Join-Path $startupDir "MenoraPrintAgent.lnk"
    if ($on) {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($linkPath)
        $shortcut.TargetPath = Join-Path $RootDir "Menora.vbs"
        $shortcut.WorkingDirectory = $RootDir
        $shortcut.WindowStyle = 1
        $shortcut.Save()
    } elseif (Test-Path $linkPath) {
        Remove-Item $linkPath -Force -ErrorAction SilentlyContinue
    }
}

# Ярлык на Рабочем столе — самый заметный способ найти программу снова: не
# нужно помнить, где лежит папка, или искать значок в скрытых иконках трея.
# Двойной клик всегда открывает окно настроек (см. дефолтное поведение
# внизу файла) — раньше было ровно наоборот, и владельцы не могли понять,
# куда делась программа после первого запуска.
function Ensure-DesktopShortcut {
    $desktopDir = [Environment]::GetFolderPath("Desktop")
    $linkPath = Join-Path $desktopDir "Menora — Настройки печати.lnk"
    try {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($linkPath)
        $shortcut.TargetPath = Join-Path $RootDir "Menora.vbs"
        $shortcut.WorkingDirectory = $RootDir
        $shortcut.WindowStyle = 1
        $shortcut.Description = "Открыть настройки печати Menora"
        $shortcut.Save()
    } catch {
        # Не критично — просто не будет ярлыка на столе, значок в трее и Пуск всё равно работают.
    }
}

# То же самое в меню «Пуск», на случай если ярлык на столе случайно удалят.
function Ensure-StartMenuShortcut {
    $startMenuDir = [Environment]::GetFolderPath("Programs")
    $linkPath = Join-Path $startMenuDir "Menora — печать чеков.lnk"
    if (Test-Path $linkPath) { return }
    try {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($linkPath)
        $shortcut.TargetPath = Join-Path $RootDir "Menora.vbs"
        $shortcut.WorkingDirectory = $RootDir
        $shortcut.WindowStyle = 1
        $shortcut.Description = "Открыть настройки печати Menora"
        $shortcut.Save()
    } catch {
        # Не критично — просто не будет ярлыка в Пуске, трей всё равно работает.
    }
}

# Запускает $ScriptBlock в фоновом задании (отдельный процесс PowerShell),
# чтобы окно никогда не "замерзало" — печать/расшарка иногда зависают, если
# сам принтер или диспетчер печати завис. $OnDone($result) вызывается на
# UI-потоке по завершении задания или по истечении TimeoutSec ($result = $null).
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
    # Всё состояние вешаем на сам таймер и достаём через $this: локальные
    # переменные этой функции внутри обработчика события не видны, из-за чего
    # $job там оказывался $null — и Remove-Job валился с "Аргумент пустой или
    # имеет значение NULL", показывая владельцу окно ошибки .NET вместо
    # результата печати. $this в обработчике WinForms — это сам таймер.
    $timer.Tag = @{
        Job        = $job
        Start      = Get-Date
        OnDone     = $OnDone
        TimeoutSec = $TimeoutSec
    }
    $timer.Add_Tick({
        $state = $this.Tag
        if (-not $state -or -not $state.Job) { $this.Stop(); return }

        $done = $false
        $result = $null
        if ($state.Job.State -ne 'Running') {
            $done = $true
            try { $result = Receive-Job -Job $state.Job -ErrorAction Stop } catch { $result = $null }
        } elseif (((Get-Date) - $state.Start).TotalSeconds -gt $state.TimeoutSec) {
            $done = $true
            Stop-Job -Job $state.Job -ErrorAction SilentlyContinue
        }

        if ($done) {
            $this.Stop()
            Remove-Job -Job $state.Job -Force -ErrorAction SilentlyContinue
            $this.Tag = $null
            & $state.OnDone $result
            $this.Dispose()
        }
    })
    $timer.Start()
}

# Тело фонового задания для Windows-транспорта: расшарка сейчас не нужна
# (RAW-печать работает и с нерасшаренным принтером — см. printer-transport.js),
# но список принтеров и тестовая печать всё равно через задание, чтобы не
# подвесить окно, если сам принтер/спулер завис.
$TestPrintJob = {
    param($AgentExe, $ConfigPath, $LogPath, $ConfigJson)
    # Set-Content -Encoding UTF8 в Windows PowerShell 5.1 пишет BOM, а
    # JSON.parse в Node не умеет читать JSON с BOM (тихо падает — agent.js
    # тогда считает конфиг пустым и просит настройку заново). Пишем сами,
    # без BOM.
    [System.IO.File]::WriteAllText($ConfigPath, $ConfigJson, (New-Object System.Text.UTF8Encoding $false))
    $p = Start-Process -FilePath $AgentExe -ArgumentList "--test" -WindowStyle Hidden -PassThru -Wait `
        -RedirectStandardError "$LogPath.testerr"
    [pscustomobject]@{ ExitCode = $p.ExitCode }
}

function Show-SetupForm {
    $existing = Load-ExistingConfig

    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Menora — печать на кухню"
    $form.Size = New-Object System.Drawing.Size(460, 620)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.BackColor = $ColorBg
    $form.Font = New-Object System.Drawing.Font($FontFamily, 9.5)

    # ---- Шапка ----
    $header = New-Object System.Windows.Forms.Panel
    $header.Location = New-Object System.Drawing.Point(0, 0)
    $header.Size = New-Object System.Drawing.Size(460, 64)
    $header.BackColor = $ColorAccent
    $form.Controls.Add($header)

    $title = New-Label "Menora" 20 12 300 ([System.Drawing.Color]::White) 15 ([System.Drawing.FontStyle]::Bold)
    $header.Controls.Add($title)
    $subtitle = New-Label "Печать заказов на кухонном принтере" 20 36 400 ([System.Drawing.Color]::FromArgb(255,255,255)) 9
    $header.Controls.Add($subtitle)

    $y = 80

    # ---- Подключение ----
    $form.Controls.Add((New-Label "ПОДКЛЮЧЕНИЕ" 20 $y 300 $ColorMuted 8.5 ([System.Drawing.FontStyle]::Bold)))
    $y += 22
    $form.Controls.Add((New-Label "Email от кабинета Menora" 20 $y))
    $y += 20
    $inputEmail = New-TextBox 20 $y 400
    if ($existing.CABINET_EMAIL) { $inputEmail.Text = $existing.CABINET_EMAIL }
    $form.Controls.Add($inputEmail)
    $y += 34

    $form.Controls.Add((New-Label "Пароль" 20 $y))
    $y += 20
    $inputPass = New-TextBox 20 $y 400 $true
    if ($existing.CABINET_PASSWORD_ENC) { $inputPass.Text = Unprotect-Secret $existing.CABINET_PASSWORD_ENC }
    $form.Controls.Add($inputPass)
    $y += 34

    $form.Controls.Add((New-Label "Ссылка на ваше меню (или slug)" 20 $y))
    $y += 20
    $inputSlug = New-TextBox 20 $y 400
    if ($existing.VENUE_SLUG) { $inputSlug.Text = $existing.VENUE_SLUG }
    $form.Controls.Add($inputSlug)
    $y += 40

    $sep1 = New-Object System.Windows.Forms.Panel
    $sep1.Location = New-Object System.Drawing.Point(20, $y)
    $sep1.Size = New-Object System.Drawing.Size(400, 1)
    $sep1.BackColor = $ColorBorder
    $form.Controls.Add($sep1)
    $y += 14

    # ---- Принтер: транспорт ----
    $form.Controls.Add((New-Label "ПРИНТЕР" 20 $y 300 $ColorMuted 8.5 ([System.Drawing.FontStyle]::Bold)))
    $y += 22

    $btnW = New-ToggleButton "Windows" 20 $y 126
    $btnUsb = New-ToggleButton "USB" 150 $y 126
    $btnBt = New-ToggleButton "Bluetooth" 280 $y 140
    $form.Controls.Add($btnW); $form.Controls.Add($btnUsb); $form.Controls.Add($btnBt)
    $y += 42

    $hintLabel = New-Label "" 20 $y 400 $ColorMuted 8.5
    $form.Controls.Add($hintLabel)
    $y += 18

    $comboDevice = New-Object System.Windows.Forms.ComboBox
    $comboDevice.Location = New-Object System.Drawing.Point(20, $y)
    $comboDevice.Size = New-Object System.Drawing.Size(300, 26)
    $comboDevice.DropDownStyle = "DropDownList"
    $comboDevice.Font = New-Object System.Drawing.Font($FontFamily, 9.5)
    $form.Controls.Add($comboDevice)

    $btnRefresh = New-FlatButton "Обновить" 326 $y 94 26
    $form.Controls.Add($btnRefresh)
    $y += 36

    $comboCharset = New-Object System.Windows.Forms.ComboBox
    $comboCharset.Location = New-Object System.Drawing.Point(20, $y)
    $comboCharset.Size = New-Object System.Drawing.Size(400, 26)
    $comboCharset.DropDownStyle = "DropDownList"
    $comboCharset.Font = New-Object System.Drawing.Font($FontFamily, 9.5)
    foreach ($c in $CHARSETS) { [void]$comboCharset.Items.Add($c.Label) }
    $comboCharset.SelectedIndex = 0
    $form.Controls.Add($comboCharset)
    $y += 40

    # Данные по устройствам на каждый транспорт держим отдельно — переключая
    # вкладку, не теряем то, что уже выбрано на другой.
    $deviceState = @{
        windows = @{ items = @(); selectedLabel = $null }
        usb = @{ items = @(); selectedLabel = $null }
        bluetooth = @{ items = @(); selectedLabel = $null }
    }
    $currentTransport = "windows"

    function Refresh-DeviceList([string]$transport, [string]$preselect = $null) {
        $comboDevice.Items.Clear()
        if ($transport -eq "windows") {
            $names = Get-PrinterList
            $deviceState.windows.items = @($names | ForEach-Object { @{ label = $_; value = $_ } })
        } elseif ($transport -eq "usb") {
            $devs = Get-AgentDeviceList "usb"
            $deviceState.usb.items = @($devs | ForEach-Object { @{ label = $_.label; value = "$($_.vendorId):$($_.productId)" } })
        } else {
            $ports = Get-AgentDeviceList "bluetooth"
            $deviceState.bluetooth.items = @($ports | ForEach-Object { @{ label = $_.label; value = $_.path } })
        }
        $items = $deviceState[$transport].items
        foreach ($it in $items) { [void]$comboDevice.Items.Add($it.label) }
        if ($items.Count -eq 0) {
            $comboDevice.Items.Add("(устройства не найдены)")
            $comboDevice.SelectedIndex = 0
        } else {
            $idx = 0
            if ($preselect) {
                for ($i = 0; $i -lt $items.Count; $i++) { if ($items[$i].value -eq $preselect) { $idx = $i; break } }
            }
            $comboDevice.SelectedIndex = $idx
        }
    }

    function Select-Transport([string]$transport) {
        $currentTransport = $transport
        Set-ToggleActive $btnW ($transport -eq "windows")
        Set-ToggleActive $btnUsb ($transport -eq "usb")
        Set-ToggleActive $btnBt ($transport -eq "bluetooth")
        $hintLabel.Text = switch ($transport) {
            "windows" { "Принтер уже установлен в Windows (Устройства и принтеры)." }
            "usb" { "Печать напрямую в USB, в обход Windows — надёжнее для дешёвых принтеров." }
            "bluetooth" { "Принтер уже сопряжён с Windows по Bluetooth (создан COM-порт)." }
        }
        $pre = $null
        if ($existing -and $existing.PRINTER_TRANSPORT -eq $transport) {
            $pre = switch ($transport) {
                "windows" { $existing.PRINTER_NAME }
                "usb" { "$($existing.PRINTER_USB_VENDOR):$($existing.PRINTER_USB_PRODUCT)" }
                "bluetooth" { $existing.PRINTER_SERIAL_PATH }
            }
        }
        Refresh-DeviceList $transport $pre
    }

    $btnW.Add_Click({ Select-Transport "windows" })
    $btnUsb.Add_Click({ Select-Transport "usb" })
    $btnBt.Add_Click({ Select-Transport "bluetooth" })
    $btnRefresh.Add_Click({ Refresh-DeviceList $currentTransport })

    $initialTransport = if ($existing.PRINTER_TRANSPORT) { $existing.PRINTER_TRANSPORT } else { "windows" }
    Select-Transport $initialTransport
    if ($existing.PRINTER_CHARACTER_SET) {
        for ($i = 0; $i -lt $CHARSETS.Count; $i++) { if ($CHARSETS[$i].Key -eq $existing.PRINTER_CHARACTER_SET) { $comboCharset.SelectedIndex = $i; break } }
    }

    $sep2 = New-Object System.Windows.Forms.Panel
    $sep2.Location = New-Object System.Drawing.Point(20, $y)
    $sep2.Size = New-Object System.Drawing.Size(400, 1)
    $sep2.BackColor = $ColorBorder
    $form.Controls.Add($sep2)
    $y += 14

    $chkAutostart = New-Object System.Windows.Forms.CheckBox
    $chkAutostart.Text = "Запускать при включении компьютера"
    $chkAutostart.Location = New-Object System.Drawing.Point(20, $y)
    $chkAutostart.Size = New-Object System.Drawing.Size(400, 24)
    $chkAutostart.Font = New-Object System.Drawing.Font($FontFamily, 9.5)
    $chkAutostart.ForeColor = $ColorText
    $chkAutostart.Checked = $true
    $form.Controls.Add($chkAutostart)
    $y += 32

    $statusLabel = New-Label "" 20 $y 400 $ColorErr 8.5
    $statusLabel.Size = New-Object System.Drawing.Size(400, 36)
    $form.Controls.Add($statusLabel)
    $y += 42

    $btnTest = New-FlatButton "Тестовая печать" 20 $y 190 34 $false
    $btnSave = New-FlatButton "Сохранить и запустить" 230 $y 190 34 $true
    $form.Controls.Add($btnTest)
    $form.Controls.Add($btnSave)

    function Get-SelectedDeviceValue {
        $idx = $comboDevice.SelectedIndex
        if ($idx -lt 0) { return $null }
        $items = $deviceState[$currentTransport].items
        if ($idx -ge $items.Count) { return $null }
        return $items[$idx].value
    }

    function Build-Config {
        $cfg = @{}
        if ($existing) { $existing.PSObject.Properties | ForEach-Object { $cfg[$_.Name] = $_.Value } }
        $cfg["CABINET_EMAIL"] = $inputEmail.Text.Trim()
        # В файл кладём только зашифрованный пароль (DPAPI, привязан к этой
        # учётке Windows) — открытого в конфиге не остаётся вообще.
        $cfg["CABINET_PASSWORD_ENC"] = Protect-Secret $inputPass.Text
        $cfg.Remove("CABINET_PASSWORD")
        $cfg["VENUE_SLUG"] = ($inputSlug.Text.Trim() -replace '.*/([a-zA-Z0-9-]+)/?$', '$1')
        $cfg["PRINTER_TRANSPORT"] = $currentTransport
        $cfg["PRINTER_CHARACTER_SET"] = $CHARSETS[$comboCharset.SelectedIndex].Key
        $cfg.Remove("PRINTER_NAME"); $cfg.Remove("PRINTER_USB_VENDOR"); $cfg.Remove("PRINTER_USB_PRODUCT"); $cfg.Remove("PRINTER_SERIAL_PATH")
        $value = Get-SelectedDeviceValue
        if ($currentTransport -eq "windows") {
            $cfg["PRINTER_NAME"] = $value
        } elseif ($currentTransport -eq "usb") {
            if ($value) { $parts = $value -split ":"; $cfg["PRINTER_USB_VENDOR"] = $parts[0]; $cfg["PRINTER_USB_PRODUCT"] = $parts[1] }
        } else {
            $cfg["PRINTER_SERIAL_PATH"] = $value
        }
        return $cfg
    }

    function Set-Busy([bool]$busy, [string]$text, [bool]$isError = $true) {
        $btnTest.Enabled = -not $busy
        $btnSave.Enabled = -not $busy
        $btnRefresh.Enabled = -not $busy
        $statusLabel.ForeColor = if ($isError) { $ColorErr } else { $ColorOk }
        $statusLabel.Text = $text
    }

    $btnTest.Add_Click({
        $value = Get-SelectedDeviceValue
        if (-not $value) {
            Set-Busy $false "Устройство не выбрано или не найдено." $true
            return
        }
        Set-Busy $true "Печатаю..." $false
        $cfg = Build-Config
        $json = ($cfg | ConvertTo-Json)
        Invoke-Background -ScriptBlock $TestPrintJob -ArgumentList @($AgentExe, $script:ConfigPath, $LogPath, $json) -OnDone {
            param($result)
            if (-not $result) {
                Set-Busy $false "Принтер не отвечает (таймаут). Проверьте подключение." $true
                return
            }
            if ($result.ExitCode -eq 0) {
                Set-Busy $false "Тестовый талон отправлен на печать." $false
            } else {
                Set-Busy $false "Не удалось напечатать. Проверьте принтер и agent.log.testerr." $true
            }
        }
    })

    $btnSave.Add_Click({
        if (-not $inputEmail.Text -or -not $inputPass.Text -or -not $inputSlug.Text) {
            Set-Busy $false "Заполните email, пароль и ссылку на меню." $true
            return
        }
        if (-not (Get-SelectedDeviceValue)) {
            Set-Busy $false "Выберите принтер/устройство." $true
            return
        }
        Set-Busy $true "Сохраняю..." $false
        $cfg = Build-Config
        Save-Config $cfg
        Set-Autostart $chkAutostart.Checked
        Ensure-DesktopShortcut
        Ensure-StartMenuShortcut
        Start-AgentHidden
        $form.Tag = "started"
        $form.Close()
    })

    [void]$form.ShowDialog()
    return $form.Tag
}

# Обычное окно программы — НЕ трей. Раньше программа после настройки
# пряталась в значок у часов, и владельцы теряли её насовсем ("куда делась
# программа?"). Теперь это как любая нормальная Windows-программа: видна в
# панели задач, показывает вживую что происходит (вход, печать, ошибки),
# закрытие крестиком — это настоящий выход, а не уход в фон.
function Show-StatusWindow {
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Menora — печать чеков"
    $form.Size = New-Object System.Drawing.Size(460, 560)
    $form.StartPosition = "CenterScreen"
    $form.MinimumSize = New-Object System.Drawing.Size(460, 420)
    $form.BackColor = $ColorBg
    $form.Font = New-Object System.Drawing.Font($FontFamily, 9.5)

    $header = New-Object System.Windows.Forms.Panel
    $header.Dock = "Top"
    $header.Height = 78
    $header.BackColor = $ColorAccent
    $form.Controls.Add($header)

    $title = New-Label "Menora" 20 12 300 ([System.Drawing.Color]::White) 15 ([System.Drawing.FontStyle]::Bold)
    $header.Controls.Add($title)
    $statusDot = New-Label "●" 20 38 20 ([System.Drawing.Color]::White) 11
    $header.Controls.Add($statusDot)
    $statusText = New-Label "Запускаюсь..." 40 39 380 ([System.Drawing.Color]::White) 9.5
    $header.Controls.Add($statusText)

    $logBox = New-Object System.Windows.Forms.TextBox
    $logBox.Multiline = $true
    $logBox.ReadOnly = $true
    $logBox.ScrollBars = "Vertical"
    $logBox.BorderStyle = "None"
    $logBox.BackColor = $ColorCard
    $logBox.ForeColor = $ColorText
    $logBox.Font = New-Object System.Drawing.Font("Consolas", 9)
    $logBox.Location = New-Object System.Drawing.Point(20, 96)
    $logBox.Anchor = "Top,Bottom,Left,Right"
    $form.Controls.Add($logBox)

    $btnSettings = New-FlatButton "Настройки" 20 0 130 38 $false
    $btnExit = New-FlatButton "Выход" 160 0 110 38 $false
    $btnSettings.Anchor = "Bottom,Left"
    $btnExit.Anchor = "Bottom,Left"
    $form.Controls.Add($btnSettings)
    $form.Controls.Add($btnExit)

    function Resize-Controls {
        $logBox.Size = New-Object System.Drawing.Size(($form.ClientSize.Width - 40), ($form.ClientSize.Height - 96 - 56))
        $btnY = $form.ClientSize.Height - 48
        $btnSettings.Location = New-Object System.Drawing.Point(20, $btnY)
        $btnExit.Location = New-Object System.Drawing.Point(160, $btnY)
    }
    $form.Add_Shown({ Resize-Controls })
    $form.Add_Resize({ Resize-Controls })

    # Читаем лог целиком на каждом тике и подменяем текст, если он изменился.
    # Прошлая версия дочитывала файл с сохранённой позиции — но переменные,
    # присвоенные внутри обработчика события WinForms, не переживают сам
    # обработчик (у него своя область видимости), поэтому позиция всегда
    # сбрасывалась и строки дублировались. Файл маленький (несколько КБ),
    # так что просто перечитать его целиком и проще, и надёжнее.
    #
    # Кодировку указываем явно: agent.js пишет UTF-8, а .NET/PowerShell по
    # умолчанию в этой локали прочитает его как ANSI и вместо русского
    # текста получится "Р’С…РѕРґ".
    $script:lastLogText = $null
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 800
    $timer.Add_Tick({
        try {
            if (-not (Test-Path $script:LogPath)) { return }
            $stream = [System.IO.File]::Open($script:LogPath, "Open", "Read", "ReadWrite")
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
            $text = $reader.ReadToEnd()
            $reader.Close(); $stream.Close()

            if ($text -eq $script:lastLogText) { return }
            $script:lastLogText = $text

            $logBox.Text = $text
            $logBox.SelectionStart = $logBox.TextLength
            $logBox.ScrollToCaret()

            $lastLine = ($text -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 1)
            if ($lastLine -match "Не удалось|Ошибка|ошибка") {
                $statusDot.ForeColor = [System.Drawing.Color]::FromArgb(0xFC, 0xA5, 0xA5)
                $statusText.Text = "Ошибка — смотрите лог ниже"
            } elseif ($lastLine -match "Чек напечатан") {
                $statusDot.ForeColor = [System.Drawing.Color]::FromArgb(0x86, 0xEF, 0xAC)
                $statusText.Text = "Чек напечатан"
            } elseif ($lastLine -match "Готово|Вход в кабинет") {
                $statusDot.ForeColor = [System.Drawing.Color]::FromArgb(0x86, 0xEF, 0xAC)
                $statusText.Text = "Работает — ждёт заказы"
            }
        } catch {
            # Файл могла на миг заблокировать печать — попробуем на следующем тике.
        }
    })

    $btnSettings.Add_Click({
        Stop-Agent
        $timer.Stop()
        $result = Show-SetupForm
        $script:lastLogText = $null
        $logBox.Clear()
        if ($result -ne "started") { Start-AgentHidden }
        $timer.Start()
    })
    $btnExit.Add_Click({ $form.Close() })
    $form.Add_FormClosing({
        $timer.Stop()
        Stop-Agent
        [System.Windows.Forms.Application]::Exit()
    })

    $timer.Start()
    [System.Windows.Forms.Application]::Run($form)
}

Migrate-LegacyConfig
$hasConfig = Test-Path $script:ConfigPath

# Один экземпляр на систему: повторный запуск (ярлык на столе, в Пуске,
# автозагрузка) не плодит вторую копию программы рядом с первой.
$guiMutex = New-Object System.Threading.Mutex($false, "Global\MenoraPrintAgentGui")

# Если прошлый экземпляр убили жёстко (диспетчер задач, аварийное
# завершение, переустановка поверх работающей программы), мьютекс остаётся
# "брошенным" и WaitOne бросает AbandonedMutexException. Раньше это
# исключение никто не ловил — скрипт молча падал ещё до создания окна, и
# программа просто «переставала открываться» до перезагрузки компьютера.
# Брошенный мьютекс означает, что владельца больше нет, а значит мы и есть
# новый единственный экземпляр — продолжаем работу.
try {
    $isPrimaryInstance = $guiMutex.WaitOne(0)
} catch [System.Threading.AbandonedMutexException] {
    $isPrimaryInstance = $true
}

if (-not $isPrimaryInstance) {
    exit
}

try {
    if (-not $hasConfig) {
        $result = Show-SetupForm
        if ($result -ne "started") { exit }
    } else {
        Start-AgentHidden
    }

    Show-StatusWindow
} finally {
    # Освобождаем всегда — иначе следующий запуск снова упрётся в мьютекс.
    try { $guiMutex.ReleaseMutex() } catch { }
    $guiMutex.Dispose()
}
