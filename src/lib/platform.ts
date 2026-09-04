import { Capacitor } from '@capacitor/core';

export type AppPlatform = 'ios' | 'android' | 'web';

export function getPlatform(): AppPlatform {
  return Capacitor.getPlatform() as AppPlatform;
}

export function isNativeIOS(): boolean {
  return getPlatform() === 'ios';
}

export function isWeb(): boolean {
  return getPlatform() === 'web';
}

export function shouldUseApplePay(): boolean {
  return isNativeIOS();
}

export function shouldUseStripe(): boolean {
  return !isNativeIOS();
}
