import { expect, it } from "vitest";
import { eventPlayers } from "./event-players";
const player={id:"scorer",name:"Scorer"};
it("single-player events have one direct destination",()=>expect(eventPlayers({type:"goal",player})).toHaveLength(1));
it("goal and assist have two choices",()=>expect(eventPlayers({type:"goal",player,assister:{id:"assist",name:"Assister"}}).map(p=>p.role)).toEqual(["Scorer","Assist"]));
it("substitutions have incoming and outgoing choices",()=>expect(eventPlayers({type:"substitution",player,sub_out:{id:"out",name:"Out"}}).map(p=>p.role)).toEqual(["In","Out"]));