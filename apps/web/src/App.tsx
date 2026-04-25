import type { ReactElement } from "react";

import "./App.css";

/**
 * Renders the first Gridgen authoring shell.
 *
 * @returns The authoring application shell.
 */
export function App(): ReactElement {
  return (
    <main className="app-shell">
      <aside className="collection-sidebar" aria-label="Collections">
        <div className="brand-block">
          <p className="eyebrow">Gridgen</p>
          <h1>Collections</h1>
        </div>
        <button type="button" className="primary-action">
          Create collection
        </button>
        <nav className="collection-list" aria-label="Collection list">
          <button type="button" className="collection-list__item collection-list__item--active">
            Music
          </button>
        </nav>
      </aside>

      <section className="editor-surface" aria-labelledby="collection-title">
        <header className="editor-toolbar">
          <div>
            <p className="eyebrow">Draft</p>
            <h2 id="collection-title">Music</h2>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="secondary-action">
              Preview
            </button>
            <button type="button" className="primary-action">
              Save
            </button>
          </div>
        </header>

        <div className="recommendation-grid">
          <section className="grid-section" aria-labelledby="s-tier-title">
            <button type="button" id="s-tier-title" className="section-title">
              S Tier
            </button>
            <div className="grid-items">
              <button type="button" className="grid-item">
                <span className="grid-item__image" aria-hidden="true" />
                <span className="grid-item__body">
                  <span className="grid-item__title">Album A</span>
                  <span className="grid-item__description">Essential listen</span>
                </span>
              </button>
              <button type="button" className="grid-item grid-item--empty">
                <span className="grid-item__image" aria-hidden="true" />
                <span className="grid-item__title">Add item</span>
              </button>
            </div>
          </section>

          <section className="grid-section" aria-labelledby="a-tier-title">
            <button type="button" id="a-tier-title" className="section-title">
              A Tier
            </button>
            <div className="grid-items">
              <button type="button" className="grid-item grid-item--empty">
                <span className="grid-item__image" aria-hidden="true" />
                <span className="grid-item__title">Add item</span>
              </button>
            </div>
          </section>
        </div>

        <button type="button" className="add-section-action">
          Add section
        </button>
      </section>
    </main>
  );
}
