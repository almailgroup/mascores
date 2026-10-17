ALTER TABLE public.push_broadcasts ADD COLUMN social_kind text CHECK(social_kind IN ('follow','request','like','comment','repost'));
CREATE OR REPLACE FUNCTION public.emit_social_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$ DECLARE recipient uuid; actor uuid; event text; recording uuid; actor_name text; prefs jsonb; push_id uuid; phrase text; phrase_ar text; BEGIN
IF TG_TABLE_NAME='profile_follows' THEN recipient:=NEW.following_id; actor:=NEW.follower_id; event:='follow';
ELSIF TG_TABLE_NAME='follow_requests' THEN recipient:=NEW.target_id; actor:=NEW.requester_id; event:='request';
ELSE SELECT host_id INTO recipient FROM voice_recordings WHERE id=NEW.recording_id; actor:=NEW.user_id; event:=NEW.kind; recording:=NEW.recording_id; END IF;
IF recipient=actor THEN RETURN NEW; END IF;
INSERT INTO social_notifications(recipient_id,actor_id,kind,recording_id) VALUES(recipient,actor,event,recording);
SELECT notification_preferences INTO prefs FROM profiles WHERE id=recipient;
IF coalesce((prefs->>'social')::boolean,true)=false OR coalesce((prefs->>('social_'||event))::boolean,true)=false THEN RETURN NEW; END IF;
SELECT coalesce(nullif(display_name,''),username,'Someone') INTO actor_name FROM profiles WHERE id=actor;
phrase:=CASE event WHEN 'follow' THEN ' followed you' WHEN 'request' THEN ' requested to follow you' WHEN 'like' THEN ' liked your recording' WHEN 'comment' THEN ' commented on your recording' ELSE ' reposted your recording' END;
phrase_ar:=CASE event WHEN 'follow' THEN ' بدأ متابعتك' WHEN 'request' THEN ' طلب متابعتك' WHEN 'like' THEN ' أعجب بتسجيلك' WHEN 'comment' THEN ' علّق على تسجيلك' ELSE ' أعاد نشر تسجيلك' END;
INSERT INTO push_broadcasts(kind,social_kind,title_en,body_en,title_ar,body_ar,path,audience_type,audience_user_id,created_by) VALUES('custom',event,left(actor_name||phrase,120),'Open MA Scores to view your activity.',left(actor_name||phrase_ar,120),'افتح MaScores لعرض الإشعارات.','/notifications','user',recipient,actor) RETURNING id INTO push_id;
PERFORM net.http_post(url:='https://ontmfbptthwipfzlywwh.supabase.co/functions/v1/send-match-alert',body:=jsonb_build_object('broadcastId',push_id),headers:='{"Content-Type":"application/json"}'::jsonb);
RETURN NEW; END $$;