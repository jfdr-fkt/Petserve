import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

// Existing workflow modules provide escaped markup; React owns the persistent
// shell. The synchronous bridge preserves their
// imperative focus, slot-picker, and form-draft behavior.
function Workspace({ parts }) {
  return (
    <div className={parts.className}>
      <button
        type="button"
        className="sidebar-overlay"
        data-action="sidebar-close"
        aria-label="Close navigation"
      />
      <aside
        className="sidebar"
        id="sidebar"
        inert={parts.sidebarInert}
        dangerouslySetInnerHTML={{ __html: parts.sidebar }}
      />
      <div className="main-shell" inert={parts.mainInert}>
        <header className="topbar" dangerouslySetInnerHTML={{ __html: parts.header }} />
        <main id="main-content" tabIndex={-1} dangerouslySetInnerHTML={{ __html: parts.content }} />
      </div>
    </div>
  );
}

function Dialog({ html, dialogKey }) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const card = template.content.querySelector('.modal-card');
  if (!card) return null;
  return (
    <div className="modal-backdrop">
      <section
        key={dialogKey}
        className={card.className}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        dangerouslySetInnerHTML={{ __html: card.innerHTML }}
      />
    </div>
  );
}

export function createInterface(root, modalRoot) {
  const workspaceRoot = createRoot(root),
    dialogRoot = createRoot(modalRoot);
  const commit = (target, component) => flushSync(() => target.render(component));
  return {
    workspace(html) {
      const template = document.createElement('template');
      template.innerHTML = html;
      const shell = template.content.querySelector('.app-shell'),
        sidebar = template.content.querySelector('.sidebar'),
        main = template.content.querySelector('.main-shell');
      const parts = {
        className: shell.className,
        sidebar: sidebar.innerHTML,
        sidebarInert: sidebar.hasAttribute('inert'),
        mainInert: main.hasAttribute('inert'),
        header: template.content.querySelector('.topbar').innerHTML,
        content: template.content.querySelector('#main-content').innerHTML,
      };
      commit(workspaceRoot, <Workspace parts={parts} />);
    },
    auth(html) {
      commit(workspaceRoot, <div dangerouslySetInnerHTML={{ __html: html }} />);
    },
    dialog(html, key) {
      commit(dialogRoot, html ? <Dialog html={html} dialogKey={key} /> : null);
    },
  };
}
