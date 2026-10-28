"""Check the archived iOS device app before creating a personal-signing IPA."""
import plistlib,sys,os
from pathlib import Path
root=Path(sys.argv[1])
info=plistlib.loads((root/'Info.plist').read_bytes())
assert info['CFBundleIdentifier']=='kr.acrobatic.club'
assert info['CFBundleSupportedPlatforms']==['iPhoneOS'], 'IPA must contain a device build, not a simulator build'
executable=root/info['CFBundleExecutable']
assert executable.is_file() and os.access(executable,os.X_OK)
assert (root/'manuals.html').is_file()
assert b'farther from the net' in (root/'manuals.html').read_bytes()
assert not list(root.rglob('*.p12')) and not list(root.rglob('*.p8'))
print('PASS: iPhone device build, executable, corrected guide and no signing private keys')
