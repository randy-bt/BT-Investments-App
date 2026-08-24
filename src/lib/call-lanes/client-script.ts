import 'server-only'

// The persistence layer injected into a call-lane page (Randy 8/24).
//
// It is a STRING of vanilla JS appended before </body>, never a React
// component, because the requirement is that the page's own content,
// styling and scripts are untouched - Randy iterated on every word, and
// the safest way to honour that is to add rather than rewrite.
//
// Two rules make a public, editable page safe to store input from:
//
//   1. CAPTURE AS TEXT. innerText, never innerHTML. Nothing that reaches
//      the database is markup.
//   2. RESTORE AS TEXT. textContent, never innerHTML. Even if a value
//      arrived poisoned, it renders as literal characters.
//
// Together those make stored input structurally unable to execute, which
// matters because the page is public and its write endpoint therefore is
// too. A cell that has never been edited keeps its ORIGINAL markup from
// the source document - the phone cells' line breaks and 'cell' labels
// survive untouched until Aldo actually corrects one.

export const PERSIST_SCRIPT = String.raw`
<script>
(function () {
  var SLUG = window.__LANE_SLUG__;
  var STATE = window.__LANE_STATE__ || {};
  var SAVE_URL = "/api/call-lanes/save";
  var MAX = 2000;

  function slugify(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  // Row identity = tab index + the row's first .nm cell (its NAME), so a
  // key survives rows being appended, reordered, or other columns being
  // rewritten. It changes only if the name itself changes, which is the
  // one case where treating it as a different row is correct anyway.
  function rowKeyFor(tr, tabIdx) {
    var nm = tr.querySelector("td.nm");
    var name = "";
    if (nm) {
      // The PRIMARY name only. The .muted span carries a sub-label
      // ("ask for Thi Nguyen", a brokerage) that the analyst may well
      // reword in a later batch - including it would change the key and
      // orphan whatever the caller had already typed on that row.
      var clone = nm.cloneNode(true);
      var muted = clone.querySelectorAll(".muted");
      for (var i = 0; i < muted.length; i++) muted[i].parentNode.removeChild(muted[i]);
      name = (clone.textContent || "").split("\n")[0].trim();
    }
    var key = slugify(name);
    if (!key) {
      var rows = tr.parentNode ? Array.prototype.indexOf.call(tr.parentNode.children, tr) : 0;
      key = "row-" + rows;
    }
    return tabIdx + ":" + key;
  }

  var pending = {};
  var timer = null;

  function queue(rowKey, field, value) {
    pending[rowKey + "|" + field] = { row_key: rowKey, field: field, value: value };
    if (timer) clearTimeout(timer);
    // Debounced: typing a note should not be one request per keystroke.
    timer = setTimeout(flush, 600);
  }

  function flush() {
    var entries = Object.keys(pending).map(function (k) { return pending[k]; });
    if (!entries.length) return;
    pending = {};
    try {
      fetch(SAVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: SLUG, entries: entries }),
        keepalive: true
      }).then(function (r) { mark(r.ok); }).catch(function () { mark(false); });
    } catch (e) { mark(false); }
  }

  // A quiet, honest indicator. Aldo is on a phone in the middle of a call
  // list; if a save fails he needs to know before he closes the tab, and
  // silence would be the worst possible answer.
  var badge = null;
  function mark(ok) {
    if (!badge) {
      badge = document.createElement("div");
      badge.setAttribute("style",
        "position:fixed;right:10px;bottom:10px;z-index:9999;padding:6px 10px;" +
        "border-radius:6px;font:600 12px -apple-system,Arial,sans-serif;" +
        "pointer-events:none;transition:opacity .4s;opacity:0");
      document.body.appendChild(badge);
    }
    badge.textContent = ok ? "Saved" : "NOT SAVED - check connection";
    badge.style.background = ok ? "rgba(66,80,31,.92)" : "rgba(166,55,31,.96)";
    badge.style.color = "#fff";
    badge.style.opacity = "1";
    if (ok) setTimeout(function () { badge.style.opacity = "0"; }, 1200);
  }

  document.querySelectorAll("table").forEach(function (table, tabIdx) {
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      var key = rowKeyFor(tr, tabIdx);
      tr.setAttribute("data-row-key", key);

      var box = tr.querySelector("td.st input[type=checkbox]");
      var notes = tr.querySelector("td.ph.em");
      // The phone cell is the .ph that is NOT the notes cell.
      var phone = null;
      tr.querySelectorAll("td.ph").forEach(function (td) {
        if (!td.classList.contains("em")) phone = phone || td;
      });

      // ---- hydrate ----
      var saved = STATE[key] || {};

      if (box && saved.done === "1") {
        box.checked = true;
        tr.classList.add("done");
      }
      // Only ever restore a cell that was actually EDITED. Untouched
      // cells keep the source document's own markup.
      [[phone, "phone"], [notes, "notes"]].forEach(function (pair) {
        var el = pair[0], field = pair[1];
        if (!el) return;
        var v = saved[field];
        if (typeof v === "string") {
          el.textContent = v;
          if (v.indexOf("\n") !== -1) el.style.whiteSpace = "pre-wrap";
        }
      });

      // ---- persist ----
      if (box) {
        box.addEventListener("change", function () {
          // The page's own script adds/removes .done; mirror whatever it
          // decided rather than assuming, so the two never disagree.
          queue(key, "done", box.checked ? "1" : "0");
        });
      }
      [[phone, "phone"], [notes, "notes"]].forEach(function (pair) {
        var el = pair[0], field = pair[1];
        if (!el) return;
        el.addEventListener("input", function () {
          queue(key, field, (el.innerText || "").slice(0, MAX));
        });
        el.addEventListener("blur", flush);
      });
    });
  });

  // Never lose a note to a closed tab or a backgrounded phone browser.
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });
})();
</script>
`
