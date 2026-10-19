import type { AlertEventKey } from './alert-sounds';

export type AlertMatchPhase = { status: string; timer_elapsed_seconds?: number | null; home_pen?: number | null };
export function matchAlertPhase(row: AlertMatchPhase): { key: AlertEventKey; title: string; category: 'kickoff' | 'final' } | null {
  const elapsed=row.timer_elapsed_seconds??0;
  switch(row.status) {
    case 'live':
      if(row.home_pen!=null)return {key:'shootout',title:'Penalty shootout',category:'kickoff'};
      if(elapsed>=6300)return {key:'etSecond',title:'Extra time second half',category:'kickoff'};
      if(elapsed>=5400)return {key:'etStart',title:'Extra time started',category:'kickoff'};
      if(elapsed>=2700)return {key:'secondHalf',title:'Second half',category:'kickoff'};
      return {key:'kickoff',title:'Kick-off',category:'kickoff'};
    case '1h': return {key:'kickoff',title:'Kick-off',category:'kickoff'};
    case '2h': return {key:'secondHalf',title:'Second half',category:'kickoff'};
    case 'ht': return elapsed>=5400?{key:'etBreak',title:'Extra time break',category:'kickoff'}:{key:'halftime',title:'Half time',category:'kickoff'};
    case 'etwait':return {key:'etWait',title:'Waiting for extra time',category:'kickoff'};
    case 'et':return {key:'etStart',title:'Extra time started',category:'kickoff'};
    case 'ft':return {key:'final',title:'Full time',category:'final'};
    case 'aet':return {key:'finalEt',title:'Full time after extra time',category:'final'};
    case 'pen':return {key:'finalPens',title:'Full time after penalties',category:'final'};
    case 'postponed':case 'cancelled':return {key:'postponed',title:row.status==='postponed'?'Postponed':'Cancelled',category:'kickoff'};
    default:return null;
  }
}