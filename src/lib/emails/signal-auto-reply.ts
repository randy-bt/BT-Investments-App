// Signal auto-reply email (handoff 017).
//
// The markup below is Geoffrey's approved master at
// SIGNAL/email/auto-reply.html, copied verbatim. Randy signed it off rendered,
// so DO NOT restyle it: no palette changes, no spacing changes, no "tidying"
// the table nesting. It is table-based on purpose because this lands in the
// inboxes of strangers on unknown mail clients.
//
// The only thing added here is the document wrapper. The master is a fragment,
// and a fragment cannot be sent as an email body; its own <style> block also
// has to sit in <head> or the max-width:600px rule is dropped by clients that
// strip stray style tags. Every style value is the master's.
//
// If the master changes, regenerate rather than hand-editing.

export const SIGNAL_AUTO_REPLY_SUBJECT = 'Signal: we got your message'

export const SIGNAL_AUTO_REPLY_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Signal — auto-reply</title>
<style>

  body{margin:0;padding:0;background:#f3f1ec;}
  @media (max-width:600px){
    .card{padding:32px 24px !important;}
    .hero{font-size:30px !important;}
  }
</style>
</head>
<body>
<!-- ============ SIGNAL AUTO-REPLY ============
     Sent the moment a signal_submissions row is created.
     Palette: canvas #f3f1ec · ground #ffffff · ink #161614 · emerald #10b981
     Fonts: system sans for body, Georgia italic for the voice line.
     Table-based on purpose: this goes to strangers on unknown mail clients.
============================================ -->

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f1ec;margin:0;padding:40px 16px;">
 <tr>
  <td align="center">

   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

    <!-- card -->
    <tr>
     <td class="card" style="background:#ffffff;border:1px solid #e6e2da;border-radius:14px;padding:40px 40px 34px;">

      <!-- wordmark -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
       <tr>
        <td style="padding-right:9px;">
         <div style="width:9px;height:9px;background:#10b981;border-radius:50%;font-size:0;line-height:0;">&nbsp;</div>
        </td>
        <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:.26em;text-transform:uppercase;color:#161614;">
         Signal
        </td>
       </tr>
      </table>

      <!-- hero -->
      <div class="hero" style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:34px;line-height:1.15;color:#161614;padding:26px 0 0;">
       We got it.
      </div>

      <!-- emerald rule -->
      <div style="width:38px;height:2px;background:#10b981;font-size:0;line-height:0;margin:20px 0 24px;">&nbsp;</div>

      <!-- body -->
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.65;color:#3d3a34;">
       <p style="margin:0 0 16px;">Your message landed.</p>
       <p style="margin:0 0 16px;">A real person reads every one of these, usually more than once. <strong style="color:#161614;font-weight:600;">We will be in touch</strong> with what we would build, how it would work, and what it costs.</p>
       <p style="margin:0 0 16px;">Nothing else needed from you right now.</p>
       <p style="margin:0;">Thought of something you left out? Reply to this email and it goes to the same place.</p>
      </div>

      <!-- sign-off -->
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#161614;font-weight:600;padding:28px 0 0;">
       &mdash; Signal
      </div>

     </td>
    </tr>

    <!-- footer -->
    <tr>
     <td style="padding:22px 8px 0;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#8a857c;">
      Custom AI tools, built for your business.<br>
      <a href="https://btinvestments.co/signal" style="color:#059669;text-decoration:none;">btinvestments.co/signal</a>
     </td>
    </tr>

   </table>

  </td>
 </tr>
</table>
</body>
</html>`

export const SIGNAL_AUTO_REPLY_TEXT = `We got it.

Your message landed.

A real person reads every one of these, usually more than once. We will be in touch
with what we would build, how it would work, and what it costs.

Nothing else needed from you right now.

Thought of something you left out? Reply to this email and it goes to the same place.

- Signal
Custom AI tools, built for your business.
https://btinvestments.co/signal`
