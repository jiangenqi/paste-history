; PasteHistory NSIS 自定义脚本
; 安装前检测已有版本 → 提示卸载

!macro preInit
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONQUESTION "检测到 PasteHistory 已安装。$\n$\n是否先卸载旧版本，再安装新版本？" /SD IDYES IDYES doUninstall IDNO doCancel
    doCancel:
      Quit
    doUninstall:
      ExecWait '"$0" /S _?=$INSTDIR'
      Sleep 1000
  ${EndIf}
!macroend
