import { expect,it } from "vitest";
import {validateSocialDrafts} from "./social-link-batch";
it("keeps supplied player links and refuses invented links or other players",()=>{
 const notes="Player 1 https://instagram.com/example";
 expect(validateSocialDrafts([{player_id:"1",network:"instagram",url:"https://instagram.com/example"},{player_id:"2",network:"instagram",url:"https://instagram.com/example"},{player_id:"1",network:"x",url:"https://x.com/invented"}],new Set(["1"]),notes)).toEqual([{player_id:"1",network:"instagram",url:"https://instagram.com/example"}]);
});