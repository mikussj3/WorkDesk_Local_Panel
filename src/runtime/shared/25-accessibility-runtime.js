(() => {
"use strict";
const CONTROL_SELECTOR='button,a[href],input:not([type="hidden"]),select,textarea,[role="button"],[role="option"],[role="checkbox"],[role="switch"],[role="tab"],[tabindex]';
const INTERACTIVE_ROLE=new Set(['button','option','checkbox','switch','tab','menuitem']);
const STATE_VALUES=Object.freeze({
  'aria-expanded':new Set(['true','false']),
  'aria-pressed':new Set(['true','false','mixed']),
  'aria-selected':new Set(['true','false']),
  'aria-checked':new Set(['true','false','mixed'])
});
const SCROLL_SELECTORS=Object.freeze([
  ['.nav-links','Nawigacja główna'],['.modal-b','Treść okna dialogowego'],['.cmd-list','Lista poleceń'],
  ['.journal-list','Lista dziennika'],['.backup-list','Lista kopii zapasowych'],['.csv-preview','Podgląd danych CSV'],
  ['.global-results','Wyniki wyszukiwania'],['.sugg','Sugestie adresów'],['.snip-pop','Lista fragmentów'],
  ['.business-more-menu','Dodatkowe narzędzia'],['.bulk-mail-list','Lista wiadomości zbiorczych']
]);
let generatedId=0;
const scopeOf=root=>root instanceof Element||root instanceof Document?root:document;
const isHidden=el=>!(el instanceof Element)||!!el.closest('[hidden],[aria-hidden="true"]')||getComputedStyle(el).display==='none'||getComputedStyle(el).visibility==='hidden';
const isDisabled=el=>el.matches?.(':disabled')||el.getAttribute?.('aria-disabled')==='true'||el.inert||!!el.closest?.('[inert]');
const ensureId=(el,prefix='a11y')=>el.id||(el.id=`${prefix}-${++generatedId}`);
const labelText=el=>{
  if(!(el instanceof Element))return'';
  const aria=el.getAttribute('aria-label');if(aria?.trim())return aria.trim();
  const ids=(el.getAttribute('aria-labelledby')||'').trim().split(/\s+/).filter(Boolean);
  if(ids.length){const text=ids.map(id=>document.getElementById(id)?.textContent||'').join(' ').trim();if(text)return text;}
  if(el.id){const label=document.querySelector(`label[for="${CSS.escape(el.id)}"]`);if(label?.textContent.trim())return label.textContent.trim();}
  const parent=el.closest('label');if(parent?.textContent.trim())return parent.textContent.trim();
  if(el instanceof HTMLInputElement&&el.type==='image'&&el.alt?.trim())return el.alt.trim();
  if(el.matches('button,a[href],[role="button"],[role="option"],[role="tab"],[role="menuitem"]')){const text=el.textContent.trim();if(text)return text;}
  return(el.getAttribute('title')||'').trim();
};
const fallbackName=el=>{
  const raw=el.getAttribute('placeholder')||el.getAttribute('title')||el.getAttribute('name')||el.id||el.getAttribute('type')||'Pole formularza';
  return String(raw).replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).trim();
};
const ensureFormLabel=control=>{
  if(labelText(control))return;
  const id=ensureId(control,'field');
  const label=document.createElement('label');
  label.className='sr-only a11y-generated-label';label.htmlFor=id;label.textContent=fallbackName(control);
  control.before(label);
};
const normalizeLabels=scope=>{
  scope.querySelectorAll('.field,.business-tools,.business-grid,.storage-limit-field').forEach(container=>{
    container.querySelectorAll(':scope > label').forEach(label=>{
      if(label.htmlFor)return;
      const control=label.nextElementSibling;
      if(control?.matches?.('input,select,textarea'))label.htmlFor=ensureId(control,'field');
    });
  });
  scope.querySelectorAll('input:not([type="hidden"]),select,textarea').forEach(ensureFormLabel);
  scope.querySelectorAll('button,[role="button"],[role="tab"],[role="menuitem"]').forEach(el=>{
    if(!labelText(el)&&el.getAttribute('title'))el.setAttribute('aria-label',el.getAttribute('title'));
  });
};
const normalizeRoles=scope=>{
  scope.querySelectorAll('[role="button"],[role="checkbox"],[role="switch"],[role="tab"],[role="menuitem"]').forEach(el=>{
    if(!el.hasAttribute('tabindex'))el.tabIndex=0;
  });
  scope.querySelectorAll('[role="option"]').forEach(el=>{
    if(!el.hasAttribute('tabindex'))el.tabIndex=el.getAttribute('aria-selected')==='true'?0:-1;
    if(!el.hasAttribute('aria-selected'))el.setAttribute('aria-selected','false');
  });
  scope.querySelectorAll('.filter-badge').forEach(el=>{
    if(!el.hasAttribute('aria-pressed'))el.setAttribute('aria-pressed',String(el.classList.contains('active')));
  });
  scope.querySelectorAll('.note-color').forEach(el=>{
    if(!el.hasAttribute('aria-pressed'))el.setAttribute('aria-pressed',String(el.classList.contains('active')));
  });
};
const normalizeScrollRegions=scope=>{
  SCROLL_SELECTORS.forEach(([selector,name])=>scope.querySelectorAll(selector).forEach(el=>{
    el.dataset.a11yScroll='true';
    el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')||el.setAttribute('aria-label',name);
    if(el.matches('.nav-links')){el.setAttribute('aria-orientation','horizontal');el.tabIndex=0;return;}
    const scrollable=el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2;
    scrollable?el.tabIndex=0:el.getAttribute('tabindex')==='0'&&el.removeAttribute('tabindex');
    if(scrollable&&!el.hasAttribute('role'))el.setAttribute('role','region');
  }));
};
const normalize=(root=document)=>{
  const scope=scopeOf(root);normalizeLabels(scope);normalizeRoles(scope);normalizeScrollRegions(scope);return scope;
};
const focusRingAudit=()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const probe=document.createElement('button');probe.type='button';probe.className='a11y-focus-probe a11y-force-focus';probe.textContent='test';
  document.body.appendChild(probe);probe.focus({preventScroll:true});const css=getComputedStyle(probe);
  const visible=css.outlineStyle!=='none'&&parseFloat(css.outlineWidth)>0||css.boxShadow!=='none';probe.remove();previous?.focus?.({preventScroll:true});
  return visible?[]:['global-focus-ring'];
};
const audit=(root=document)=>{
  const scope=normalize(root);const controls=[...scope.querySelectorAll(CONTROL_SELECTOR)].filter(el=>!isHidden(el)&&!isDisabled(el)&&!(el.getAttribute('tabindex')==='-1'&&!INTERACTIVE_ROLE.has(el.getAttribute('role'))));
  const names=controls.filter(el=>!labelText(el)).map(el=>el.id||el.className||el.tagName);
  const labelAssociations=[...scope.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(el=>!isHidden(el)&&!el.closest('label')&&!(el.id&&scope.querySelector(`label[for="${CSS.escape(el.id)}"]`))&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')).map(el=>el.id||el.name||el.tagName);
  const keyboard=controls.filter(el=>{if(el.matches('button,a[href],input,select,textarea'))return false;const role=el.getAttribute('role'),ti=Number(el.getAttribute('tabindex'));if(role==='option'&&ti===-1)return false;return !Number.isFinite(ti)||ti<0;}).map(el=>el.id||el.className||el.tagName);
  const positiveTabindex=controls.filter(el=>Number(el.getAttribute('tabindex'))>0).map(el=>el.id||el.className||el.tagName);
  const hiddenFocusable=[...scope.querySelectorAll(CONTROL_SELECTOR)].filter(el=>isHidden(el)&&!el.closest('[inert]')&&el.getAttribute('tabindex')==='0').map(el=>el.id||el.className||el.tagName);
  const modalFocus=[...scope.querySelectorAll('[role="dialog"]')].filter(el=>!isHidden(el)&&!el.querySelector('[data-modal-focus-entry],button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).map(el=>el.id||'dialog');
  const roles=[];
  scope.querySelectorAll('[role="dialog"]').forEach(el=>{if(!labelText(el))roles.push(`${el.id||el.className}:dialog-name`);});
  scope.querySelectorAll('[role]').forEach(el=>{const role=el.getAttribute('role');if(INTERACTIVE_ROLE.has(role)&&!labelText(el))roles.push(`${el.id||el.className}:${role}-name`);});
  scope.querySelectorAll('[aria-controls]').forEach(el=>{const id=el.getAttribute('aria-controls');if(id&&!document.getElementById(id))roles.push(`${el.id||el.className}:missing-controls-${id}`);});
  const aria=[];Object.entries(STATE_VALUES).forEach(([attr,values])=>scope.querySelectorAll(`[${attr}]`).forEach(el=>{if(!values.has(el.getAttribute(attr)))aria.push(`${el.id||el.className||el.tagName}:${attr}`);}));
  scope.querySelectorAll('.note-color').forEach(el=>{if(!el.hasAttribute('aria-pressed'))aria.push(`${el.id||el.className}:aria-pressed`);});
  const coarse=matchMedia('(pointer: coarse)').matches;const min=coarse?40:24;
  const targetSizes=controls.filter(el=>{if(el.matches('input[type="checkbox"],input[type="radio"]')){const label=el.closest('label');if(label){const lr=label.getBoundingClientRect();if(lr.width>=min&&lr.height>=min)return false;}}const r=el.getBoundingClientRect();return !!r.width&&!!r.height&&(r.width<min||r.height<min);}).map(el=>{const r=el.getBoundingClientRect();return{id:el.id||labelText(el)||el.className||el.tagName,width:Math.round(r.width),height:Math.round(r.height)};});
  const scrollRegions=[...scope.querySelectorAll('[data-a11y-scroll="true"]')].filter(el=>!isHidden(el)&&(el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2)&&(Number(el.getAttribute('tabindex'))<0||!labelText(el))).map(el=>el.id||el.className||el.tagName);
  const checks={accessibleNames:names,labelAssociations,keyboardNavigation:keyboard,focusOrder:[...positiveTabindex,...hiddenFocusable,...modalFocus],roles,ariaState:aria,targetSize:targetSizes,focusRing:focusRingAudit(),scrollRegions};
  const ok=Object.values(checks).every(v=>v.length===0);return Object.freeze({ok,status:ok?'PASS':'FAIL',checks});
};
AccessibilityRuntime=Object.freeze({normalize,audit,labelText});
EventLifecycle.on(document,'keydown',event=>{
  const target=event.target instanceof Element?event.target:null;if(!target)return;
  const role=target.getAttribute('role');
  if((event.key==='Enter'||event.key===' ')&&['button','checkbox','switch'].includes(role)&&!target.matches('#emailBar,.panel-h,[data-toggle]')){event.preventDefault();target.click();return;}
  const nav=target.closest('.nav-links');if(nav&&(event.key==='ArrowRight'||event.key==='ArrowLeft')){const links=[...nav.querySelectorAll('a[href],button:not([disabled])')];const current=links.indexOf(document.activeElement);if(links.length){event.preventDefault();links[(current+(event.key==='ArrowRight'?1:-1)+links.length)%links.length].focus();}}
},{owner:'accessibility',key:'keyboard-contract'});
"loading"===document.readyState?EventLifecycle.once(document,'DOMContentLoaded',()=>normalize(document),{owner:'accessibility',key:'dom-ready'}):queueMicrotask(()=>normalize(document));
})();
