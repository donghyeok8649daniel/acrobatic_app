export function nativePlatform(): 'android'|'ios'|null {
    if (typeof navigator === 'undefined') return null;
    if (/\bAcrobaticAndroid\//.test(navigator.userAgent)) return 'android';
    if (/\bAcrobaticIOS\//.test(navigator.userAgent)) return 'ios';
    return null;
}
