export function buildDeviceQaChecklist(screen: string) {
  return { screen, checks: ['small-phone readable', 'large touch targets', 'emergency phrases visible without scrolling too far', 'Japanese text legible', 'Vietnamese and Filipino translations fit card width', 'no horizontal scrolling required'] };
}
