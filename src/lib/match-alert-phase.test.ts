import { describe, expect, it } from 'vitest';
import { matchAlertPhase } from './match-alert-phase';
describe('match period notifications',()=>{
  it('announces kickoff',()=>expect(matchAlertPhase({status:'live',timer_elapsed_seconds:0})?.key).toBe('kickoff'));
  it('announces halftime under the kickoff preference',()=>expect(matchAlertPhase({status:'ht',timer_elapsed_seconds:2700})).toEqual({key:'halftime',title:'Half time',category:'kickoff'}));
  it('announces second half rather than repeating kickoff',()=>expect(matchAlertPhase({status:'live',timer_elapsed_seconds:2700})?.key).toBe('secondHalf'));
  it('distinguishes extra time break from halftime',()=>expect(matchAlertPhase({status:'ht',timer_elapsed_seconds:6300})?.key).toBe('etBreak'));
  it('announces a shootout',()=>expect(matchAlertPhase({status:'live',home_pen:0})?.key).toBe('shootout'));
});