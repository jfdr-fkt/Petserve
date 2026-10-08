import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { motion, MotionConfig, useReducedMotion } from 'motion/react';

// Existing workflow modules provide escaped markup; React owns the persistent
// shell and animated view boundaries. The synchronous bridge preserves their
// imperative focus, slot-picker, and form-draft behavior.
function Workspace({ parts, pageKey }) {
  const reduced = useReducedMotion();
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
        <motion.main
          key={pageKey}
          id="main-content"
          tabIndex={-1}
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          dangerouslySetInnerHTML={{ __html: parts.content }}
        />
      </div>
    </div>
  );
}

function Dialog({ html, dialogKey }) {
  const reduced = useReducedMotion();
  const template = document.createElement('template');
  template.innerHTML = html;
  const card = template.content.querySelector('.modal-card');
  if (!card) return null;
  return (
    <div className="modal-backdrop">
      <motion.section
        key={dialogKey}
        className={card.className}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        initial={reduced ? false : { opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
        dangerouslySetInnerHTML={{ __html: card.innerHTML }}
      />
    </div>
  );
}

export function createInterface(root, modalRoot) {
  const workspaceRoot = createRoot(root),
    dialogRoot = createRoot(modalRoot);
  const commit = (target, component) =>
    flushSync(() => target.render(<MotionConfig reducedMotion="user">{component}</MotionConfig>));
  return {
    workspace(html, pageKey) {
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
      commit(workspaceRoot, <Workspace parts={parts} pageKey={pageKey} />);
    },
    auth(html) {
      commit(workspaceRoot, <div dangerouslySetInnerHTML={{ __html: html }} />);
    },
    dialog(html, key) {
      commit(dialogRoot, html ? <Dialog html={html} dialogKey={key} /> : null);
    },
  };
}
