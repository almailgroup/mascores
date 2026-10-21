import { createFileRoute } from '@tanstack/react-router';
import { AppShell, BackButton } from '@/components/app-shell';
import { SocialActivity } from '@/components/social-activity';
export const Route = createFileRoute('/notifications')({
  head:()=>({meta:[{title:'Notifications — MaScores'},{name:'description',content:'Your MaScores follows, follow requests and recording activity.'},{property:'og:title',content:'Notifications — MaScores'},{property:'og:description',content:'Your follows, follow requests and recording activity.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex'}]}),
  component:()=> <AppShell><BackButton iconOnly className="mb-4"/><SocialActivity/></AppShell>,
});