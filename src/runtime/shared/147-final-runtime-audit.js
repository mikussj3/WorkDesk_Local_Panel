(() => {
    "use strict";
    UIRuntime.discover(), requestAnimationFrame(() => {
        UIRuntime.discover(), UIRuntime.entries().forEach(entry => {
            const opener = entry.opener || document.querySelector(`[aria-controls="${CSS.escape(entry.id)}"]`);
            opener && (entry.opener = opener, opener.setAttribute("aria-haspopup", entry.modal ? "dialog" : "listbox" === entry.el.getAttribute("role") ? "listbox" : "true"),
            opener.setAttribute("aria-expanded", String(UIRuntime.opened().some(x => x.id === entry.id))));
        });
    });
})();
