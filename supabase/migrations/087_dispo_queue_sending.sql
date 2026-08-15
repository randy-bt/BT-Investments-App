-- 'sending' joins the dispo_queue status vocabulary (full-system review
-- pass, 8/15). sendQueueRow now CLAIMS the row atomically (ready ->
-- sending) before the first message leaves, so two simultaneous SEND
-- clicks - Randy in the wizard and the analyst over the bridge - can no
-- longer both pass the ready check and double-send every investor. On
-- completion the row moves to 'sent'; on zero-sent or exception it
-- reverts to 'ready'. A hard crash mid-send parks the row in 'sending',
-- which is the SAFE failure mode: parked rows never auto-resend.
ALTER TABLE dispo_queue DROP CONSTRAINT IF EXISTS dispo_queue_status_check;
ALTER TABLE dispo_queue ADD CONSTRAINT dispo_queue_status_check
  CHECK (status IN ('ready', 'sending', 'sent', 'dismissed'));
