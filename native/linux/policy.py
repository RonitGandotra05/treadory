"""Pure policy; no evdev import or input capture during tests."""
import json
CONTROLS = ('left', 'middle', 'right')
ACTIONS = ('none', 'scrollUp', 'scrollDown', 'media', 'space', 'enter', 'f13', 'f14', 'f15', 'f16', 'f17', 'f18', 'f19', 'f20', 'f21', 'f22', 'f23', 'f24')
BUTTONS = {272, 273, 274}
def settings(value):
    if not isinstance(value, dict) or set(value) != {'version', 'mappings'} or value['version'] != 1:
        raise ValueError('Invalid settings version/fields')
    maps = value['mappings']
    if not isinstance(maps, dict) or set(maps) != set(CONTROLS) or any(a not in ACTIONS for a in maps.values()):
        raise ValueError('Invalid mappings')
    return {'version': 1, 'mappings': dict(maps)}
def eligible(vendor, product, keys, types):
    return vendor == 0x05f3 and product == 0xff and set(keys) == BUTTONS and set(types) <= {0, 1, 4}
class Decoder:
    def __init__(self):
        self.held = set(); self.learned = {}; self.learning = None; self.candidate = None
    def learn(self, control):
        if control not in CONTROLS or self.held:
            raise ValueError('Release all pedals before learning')
        self.learned.pop(control, None); self.learning = control; self.candidate = None
    def event(self, code, value):
        if code not in BUTTONS or value not in (0, 1, 2):
            raise ValueError('Unsupported pedal input')
        if value == 2 or value == 1 and code in self.held:
            return []  # Holds/repeats never create new presses.
        if value == 0:
            self.held.discard(code)
            if self.learning and self.candidate == code and not self.held:
                self.learned[self.learning] = code; self.learning = self.candidate = None
            return []
        self.held.add(code)
        if self.learning:
            if len(self.held) != 1 or code in self.learned.values():
                raise ValueError('Learn distinct pedals one at a time')
            self.candidate = code; return []
        return [c for c in CONTROLS if self.learned.get(c) == code]
