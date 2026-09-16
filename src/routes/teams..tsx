
/**
 * Club fixtures grouped by competition (and group) in date order. Opening the tab
 * jumps straight to the next upcoming match, so past games are just a scroll away.
 */
function TeamMatches({ data, teamId, nextId }: { data: MatchWithTeams[]; teamId: string; nextId: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!nextId || !box.current) return;
    const row = box.current.querySelector(`a[href*="/matches/${nextId}"]`);
    row?.scrollIntoView({ block: "center" });
  }, [nextId]);
  return <div ref={box}><MatchGroups data={data} highlightTeamId={teamId} /></div>;
}
