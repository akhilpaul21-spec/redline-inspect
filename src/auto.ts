import { configFromScript, configFromUrl, mergeConfig } from './config';
import { init } from './index';

function boot(): void {
  const script =
    (document.currentScript as HTMLScriptElement | null) ||
    document.querySelector<HTMLScriptElement>('script[src*="redline"]');
  const urlCfg = configFromUrl();
  const scriptCfg = configFromScript(script);
  const cfg = mergeConfig({ ...scriptCfg, ...urlCfg });
  if (!cfg.enabled) return;
  const instance = init(cfg);
  window.redline = instance;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export { init, destroy, toggle } from './index';
export type { RedlineConfig, RedlineInstance, ElementSpec } from './types';
