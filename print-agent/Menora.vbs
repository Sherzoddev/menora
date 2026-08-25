' Menora — запускает окно настройки/трей без единого чёрного окна консоли
' или PowerShell на экране. Это единственное, что нужно запускать вручную.
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
psScript = scriptDir & "\gui\setup-gui.ps1"

extraArgs = ""
For i = 0 To WScript.Arguments.Count - 1
  extraArgs = extraArgs & " " & WScript.Arguments(i)
Next

cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -Sta -WindowStyle Hidden -File """ & psScript & """" & extraArgs

Set objShell = CreateObject("WScript.Shell")
objShell.Run cmd, 0, False
