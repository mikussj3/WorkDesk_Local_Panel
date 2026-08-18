function showInfoDialog(title, message) {
    let modal = document.getElementById("infoDialogModal");
    modal || (modal = document.createElement("div"), modal.className = "modal", modal.id = "infoDialogModal", 
    modal.innerHTML = '<div class="modal-h"><h3 id="infoDialogTitle"></h3><button type="button" class="icon-btn x" data-close aria-label="Zamknij">✕</button></div><div class="modal-b"><div id="infoDialogContent" class="info-dialog-content"></div></div><div class="modal-f"><button type="button" class="btn primary" data-close>OK</button></div>', 
    document.getElementById("overlay").appendChild(modal)), document.getElementById("infoDialogTitle").textContent = String(title || "Informacja"), 
    document.getElementById("infoDialogContent").textContent = String(message || ""), 
    showModal("infoDialogModal");
}

function focusSearchResult(selector, fallback) {
    const el = document.querySelector(selector) || document.querySelector(fallback);
    el && (el.scrollIntoView({
        block: "center",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    }), el.classList.add("search-highlight"), SchedulerService.scheduleTimeout(() => el.classList.remove("search-highlight"), 1400));
}

!function() {
    const details = document.querySelector(".business-more"), menu = details?.querySelector(".business-more-menu");
    if (!details || !menu) return;
    let backdrop = details.nextElementSibling;
    backdrop && backdrop.classList.contains("business-more-backdrop") || (backdrop = document.createElement("div"), 
    backdrop.className = "business-more-backdrop", details.after(backdrop));
    const id = menu.id || (menu.id = "businessMoreMenu"), opener = details.querySelector("summary");
    opener?.setAttribute("aria-controls", id), UIRuntime.register({
        id: id,
        el: menu,
        opener: opener,
        priority: 50,
        modal: !1,
        onClose: () => {
            details.open = !1;
        }
    }), details.addEventListener("toggle", () => {
        details.open ? UIRuntime.open("business-menu", menu, {
            opener: opener,
            priority: 50,
            onClose: () => {
                details.open = !1;
            }
        }) : UIRuntime.close(id, {
            reason: "toggle",
            restoreFocus: !1
        });
    }), menu.addEventListener("click", e => {
        e.target.closest("button,a") && UIRuntime.close(id, {
            reason: "selection",
            restoreFocus: !1
        });
    }), backdrop.addEventListener("click", () => UIRuntime.close(id, {
        reason: "outside-click",
        restoreFocus: !1
    }));
}();
