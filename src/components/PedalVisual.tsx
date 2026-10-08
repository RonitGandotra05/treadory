import type { PedalState, Control } from '../hid/core';

interface Props { state: PedalState; controls: Control[]; simulate: boolean; onPress: (control: Control, pressed: boolean) => void }
const labels = { left: 'LEFT', middle: 'MIDDLE', right: 'RIGHT', auxiliary: 'AUX' };
export function PedalVisual({ state, controls, simulate, onPress }: Props) {
  const three = controls.includes('middle') && controls.length > 1;
  return <div className="pedal-stage">
    <div className="technical stage-label"><span>YOUR PEDAL, LIVE</span><span>{simulate ? 'DEMO' : 'LIVE VIEW'}</span></div>
    <div className="pedal-object">
      <svg className="pedal-cable" viewBox="0 0 500 180" aria-hidden="true"><path d="M263 179 C255 120 340 117 348 68 S299 11 385 5" fill="none" stroke="#161815" strokeWidth="8"/><path d="M262 178 C255 119 339 116 347 68 S298 11 384 5" fill="none" stroke="#5a5c56" strokeWidth="2"/></svg>
      <div className="pedal-shadow" />
      <div className={`pedal-body ${controls.length === 1 ? 'single' : ''}`}>
        <div className="pedal-rear"><span>TD / FOOT CONTROL</span><i /></div>
        <div className={`pedal-plates ${three ? 'triple' : ''}`}>
          {controls.filter(c => c !== 'auxiliary').map(c => <button key={c} type="button" disabled={!simulate} aria-label={`Simulate ${c} pedal`} aria-pressed={state[c]} data-pedal={c} className={`pedal-plate ${c} ${state[c] ? 'pressed' : ''}`}
            onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); onPress(c, true); }} onPointerUp={() => onPress(c, false)} onPointerCancel={() => onPress(c, false)} onLostPointerCapture={() => onPress(c, false)}
            onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); onPress(c, true); } }} onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onPress(c, false); } }} onBlur={() => onPress(c, false)}>
            <span className="plate-ribs" /><span className="plate-symbol">{c === 'left' ? '≪' : c === 'right' ? '≫' : 'Ⅱ'}</span><span className="plate-light" />
          </button>)}
        </div>
        {controls.includes('auxiliary') && <button className={`aux-plate ${state.auxiliary ? 'pressed' : ''}`} disabled={!simulate} aria-label="Simulate auxiliary pedal" aria-pressed={state.auxiliary} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); onPress('auxiliary', true); }} onPointerUp={() => onPress('auxiliary', false)} onPointerCancel={() => onPress('auxiliary', false)} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onPress('auxiliary', true); } }} onKeyUp={() => onPress('auxiliary', false)} onBlur={() => onPress('auxiliary', false)}>AUX</button>}
        <div className="pedal-front"><span>treadory</span><span>USB CONTROL</span></div>
      </div>
    </div>
    <div className="pedal-indicators">{controls.map(c => <span className={state[c] ? 'is-down' : ''} key={c}><i />{labels[c]} <b>{state[c] ? 'DOWN' : 'READY'}</b></span>)}</div>
    <p className="stage-hint">{simulate ? 'Hold a pedal below to simulate a press.' : 'Your presses light up here.'}</p>
  </div>;
}
