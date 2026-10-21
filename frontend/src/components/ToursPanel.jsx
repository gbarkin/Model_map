import { useState } from "react";

export function ToursPanel({ tours, activeTourId, onSelectTour, onCreateTour, onRenameTour, onDeleteTour, onAddStep, onUpdateStep, onMoveStep, onDeleteStep, onPreviewStep, onPlay, selected }) {
  const tour = tours.find((t) => t.id === activeTourId) || tours[0];
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!tour) {
    return (
      <div className="mm-tours mm-pad">
        <p className="mm-empty-title">Walk people through the model one step at a time.</p>
        <p className="mm-muted">
          A tour is a list of views. Each step remembers which model is in focus, which cards are open, where the camera is, and a note
          to show on screen.
        </p>
        <button type="button" className="mm-button is-primary" onClick={() => onCreateTour("New tour")}>
          Create a tour
        </button>
      </div>
    );
  }

  return (
    <div className="mm-tours">
      <div className="mm-tour-head mm-pad">
        <select value={tour.id} onChange={(e) => onSelectTour(e.target.value)} aria-label="Tour">
          {tours.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button type="button" className="mm-button" onClick={() => onCreateTour("New tour")}>
          New
        </button>
      </div>
      <div className="mm-pad mm-stack">
        <label className="mm-field">
          <span>Tour name</span>
          <input value={tour.name} onChange={(e) => onRenameTour(tour.id, e.target.value)} />
        </label>
        <div className="mm-tour-actions">
          <button type="button" className="mm-button is-primary" disabled={!tour.steps.length} onClick={() => onPlay(tour.id)}>
            Present tour
          </button>
          <button type="button" className="mm-button" onClick={() => onAddStep(tour.id)} title="Captures the focused model, open cards, and camera position">
            Add current view
          </button>
        </div>
        {!selected ? <p className="mm-hint">Tip: select a model first so the step focuses on it.</p> : null}
      </div>

      <ol className="mm-steps">
        {tour.steps.map((step, i) => (
          <li key={step.id} className="mm-step">
            <div className="mm-step-head">
              <span className="mm-step-num">{i + 1}</span>
              <input
                className="mm-step-title"
                value={step.title}
                aria-label={`Step ${i + 1} title`}
                onChange={(e) => onUpdateStep(tour.id, step.id, { title: e.target.value })}
              />
            </div>
            <textarea
              rows={2}
              value={step.note || ""}
              placeholder="What to say at this step"
              aria-label={`Step ${i + 1} note`}
              onChange={(e) => onUpdateStep(tour.id, step.id, { note: e.target.value })}
            />
            <div className="mm-step-actions">
              <span className="mm-muted">{step.focus ? `Focus: ${step.focus}` : "Whole map"}</span>
              <span className="mm-step-buttons">
                <button type="button" className="mm-link" onClick={() => onPreviewStep(step)}>
                  Show
                </button>
                <button type="button" className="mm-link" onClick={() => onUpdateStep(tour.id, step.id, { capture: true })} title="Replace this step's view with the current view">
                  Update view
                </button>
                <button type="button" className="mm-icon-button" disabled={i === 0} onClick={() => onMoveStep(tour.id, step.id, -1)} aria-label="Move step up">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                </button>
                <button type="button" className="mm-icon-button" disabled={i === tour.steps.length - 1} onClick={() => onMoveStep(tour.id, step.id, 1)} aria-label="Move step down">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                </button>
                <button type="button" className="mm-icon-button" onClick={() => onDeleteStep(tour.id, step.id)} aria-label="Delete step">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                </button>
              </span>
            </div>
          </li>
        ))}
      </ol>
      {tour.steps.length === 0 ? <p className="mm-muted mm-pad">No steps yet. Arrange the map, then add the current view.</p> : null}

      <div className="mm-pad">
        {confirmDelete ? (
          <p className="mm-confirm">
            Delete “{tour.name}”?{" "}
            <button type="button" className="mm-link is-danger" onClick={() => { onDeleteTour(tour.id); setConfirmDelete(false); }}>
              Delete tour
            </button>{" "}
            <button type="button" className="mm-link" onClick={() => setConfirmDelete(false)}>
              Keep
            </button>
          </p>
        ) : (
          <button type="button" className="mm-link is-danger" onClick={() => setConfirmDelete(true)}>
            Delete this tour
          </button>
        )}
      </div>
    </div>
  );
}
