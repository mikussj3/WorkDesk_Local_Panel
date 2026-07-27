(() => {
    "use strict";
    const q = (s, r = document) => r.querySelector(s);
    UIRuntime.discover(), EventLifecycle.on(document, "keydown", e => {
        const target = e.target instanceof Element ? e.target.closest('.filter-badge,.tile,[data-note-id] .note-color,[role="option"]') : null;
        target && ("Enter" !== e.key && " " !== e.key || target.matches("button,a,input,summary") || (e.preventDefault(), 
        target.click()));
    }), ((s, r = document) => [ ...r.querySelectorAll(s) ])(".modal").forEach((modal, index) => {
        modal.setAttribute("role", "dialog"), modal.setAttribute("aria-modal", "true");
        let title = q(".modal-h h1,.modal-h h2,.modal-h h3,[data-modal-title]", modal);
        title && !title.id && (title.id = `modal-title-${index}`), title && modal.setAttribute("aria-labelledby", title.id);
        let body = q(".modal-b,[data-modal-description]", modal);
        body && !body.id && (body.id = `modal-description-${index}`), body && modal.setAttribute("aria-describedby", body.id);
    }), requestAnimationFrame(() => {
        UIRuntime.discover(), UIRuntime.entries().forEach(entry => {
            const opener = entry.opener || document.querySelector(`[aria-controls="${CSS.escape(entry.id)}"]`);
            opener && (entry.opener = opener, opener.setAttribute("aria-haspopup", entry.modal ? "dialog" : entry.el.getAttribute("role") || "listbox"), 
            opener.setAttribute("aria-expanded", String(UIRuntime.opened().some(x => x.id === entry.id))));
        });
    });
})();
