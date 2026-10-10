import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('policy',Path(__file__).resolve().parents[1]/'native/linux/policy.py');policy=importlib.util.module_from_spec(spec);spec.loader.exec_module(policy)
class Tests(unittest.TestCase):
    def test_identity_and_capabilities(self):
        self.assertTrue(policy.eligible(0x5f3,0xff,[272,273,274],[0,1,4]))
        for vendor,product,keys,types in [(1,0xff,[272,273,274],[0,1]),(0x5f3,1,[272,273,274],[0,1]),(0x5f3,0xff,[272,273],[0,1]),(0x5f3,0xff,[272,273,274],[0,1,2]),(0x5f3,0xff,[272,273,274,30],[0,1])]: self.assertFalse(policy.eligible(vendor,product,keys,types))
    def test_learning_press_release_hold_and_chords(self):
        d=policy.Decoder()
        for c,k in zip(policy.CONTROLS,[272,274,273]):
            d.learn(c);self.assertEqual(d.event(k,1),[]);self.assertNotIn(c,d.learned);d.event(k,2);d.event(k,0);self.assertEqual(d.learned[c],k)
        self.assertEqual(d.event(272,1),['left']);self.assertEqual(d.event(272,1),[]);self.assertEqual(d.event(272,2),[]);self.assertEqual(d.event(274,1),['middle']);d.event(272,0);d.event(274,0)
        d=policy.Decoder();d.learn('right');d.event(272,1)
        with self.assertRaises(ValueError): d.event(274,1)
    def test_unknown_input(self):
        for code,value in [(1,1),(272,3),(-1,0)]:
            with self.assertRaises(ValueError): policy.Decoder().event(code,value)
    def test_settings(self):
        value={'version':1,'mappings':dict.fromkeys(policy.CONTROLS,'none')};self.assertEqual(policy.settings(value),value)
        for wrong in [{},dict(value,active=True),dict(value,version=2),dict(value,mappings={'left':'shell','middle':'none','right':'none'})]:
            with self.assertRaises(ValueError): policy.settings(wrong)
if __name__=='__main__': unittest.main()
