import type { PedalModel } from './deviceProfiles.js';

export interface RepairSupport {
  status: 'check' | 'manufacturer' | 'unverified';
  label: string;
  description: string;
  tool?: string;
  url?: string;
  steps: string[];
  browserCandidate?: boolean;
}

// Manufacturer capabilities are separate from Treadory's input decoder catalogue.
// A selected model is a hint, never authorization to send a programming packet.
export function repairSupport(model: PedalModel): RepairSupport {
  if (model.brand === 'PCsensor') return {
    status: model.count === 3 ? 'check' : 'manufacturer',
    label: model.count === 3 ? 'Browser programming · compatibility check required' : 'Desktop programming · use ElfKey',
    description: 'These pedals can store keyboard or mouse outputs. Direct programming here supports a limited USB protocol; other versions need ElfKey.',
    tool: 'ElfKey', url: 'https://pcsensor.com/download/', browserCandidate: model.count === 3,
    steps: ['Open ElfKey and select your exact pedal. Close other pedal software first.', 'Select the affected pedal and replace the unwanted mouse click with your intended key or button.', 'Save the device settings, close ElfKey, then test the pedal in the app you use.'],
  };
  if (model.brand === 'OM SYSTEM / Olympus') return {
    status: 'manufacturer', label: 'Desktop programming · manufacturer tool required',
    description: 'RS28H and RS31H support stored keyboard commands through the Foot Switch Configuration Tool. Treadory cannot program their settings directly.',
    tool: 'Foot Switch Configuration Tool', url: 'https://audiosupport.omsystem.com/en/product/footswitch-configuration-tool/',
    steps: ['Open the configuration tool and select your connected model.', 'Choose Keyboard Mode and assign the intended keyboard command to the affected pedal.', 'Apply the settings to the pedal, then test the shortcut in your other app.'],
  };
  if (model.brand === 'X-keys') return {
    status: 'manufacturer', label: 'Browser programming · official X-keys web app',
    description: 'The XK-3 can store keyboard and mouse actions on the device. Use X-keys’ own programmer in Hardware Mode.',
    tool: 'X-keys web programmer', url: 'https://piengineering.com/pages/x-keys-web-app',
    steps: ['Select your exact model in the X-keys programmer. Its web app requires a WebHID browser; desktop options are also available.', 'Replace the unwanted action. Configure both press and release where needed.', 'Use Hardware Mode / Write Macros to save to the pedal. Software Mode needs the desktop app running.'],
  };
  if (model.brand === 'Philips') return {
    status: 'manufacturer', label: 'Desktop programming · manufacturer tool required',
    description: 'Philips documents pedal configuration with SpeechControl on Windows. Available outputs depend on the device mode and software.',
    tool: 'Philips SpeechControl & support', url: 'https://www.dictation.philips.com/us/products/transcription-accessories/foot-control-acc2300/',
    steps: ['Open SpeechControl on Windows and select the connected foot control.', 'Change the affected pedal’s function, then use Upload to save its settings.', 'Test in the target app. App-specific transcription commands do not automatically become global keyboard shortcuts.'],
  };
  if (model.brand === 'AirTurn') return {
    status: 'manufacturer', label: 'App-based programming · use AirTurn Manager',
    description: 'DUO 500 key commands and modes can be changed with AirTurn Manager. This USB programmer does not configure Bluetooth pedals.',
    tool: 'AirTurn Manager instructions', url: 'https://www.airturn.com/blogs/support/airturn-manager-app-tutorial-videos',
    steps: ['Connect your DUO 500 to AirTurn Manager on a supported phone, tablet, or Mac.', 'Choose the mode you use and set the intended key commands.', 'Save and test in the target app. For PC use, AirTurn says to change settings from a phone or tablet first.'],
  };
  return {
    status: 'unverified', label: 'Direct programming unavailable in Treadory',
    description: model.brand === 'VEC'
      ? 'This does not mean your pedal cannot be fixed. Treadory can read supported VEC presses, but has no verified method to change its stored output. An unwanted click may come from software on your computer; correct that mapping in a device-aware desktop remapper.'
      : 'Select the exact model to see its programming options. Desktop remapping may still fix unwanted clicks. Treadory needs a verified device protocol before it can change stored outputs.',
    steps: ['Check the model label and any pedal software already running on your computer.', 'Use a device-aware desktop remapper to replace the unwanted click. This changes behavior on that computer and needs the remapper running.'],
  };
}
