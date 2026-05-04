!macro customLeaveDirectory
  Push $R0
  Push $R1
  StrCpy $R0 $INSTDIR "" -1
  StrCmp $R0 "\" 0 +2
  StrCpy $INSTDIR $INSTDIR -1
  StrLen $R0 "LanImage"
  IntOp $R0 $R0 + 1
  StrCpy $R1 $INSTDIR "" -$R0
  StrCmp $R1 "\LanImage" done 0
  StrCpy $INSTDIR "$INSTDIR\LanImage"
done:
  Pop $R1
  Pop $R0
!macroend
