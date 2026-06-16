import './App.css'

/**
 * Placeholder page for Milestone 1.
 *
 * The real manual-entry UI (item list + live box estimate) lands in
 * Milestone 3, and the vehicle recommendation in Milestone 4. This page
 * exists only to confirm the Vite + React scaffold runs via `npm run dev`.
 */
function App() {
  return (
    <main className="app">
      <header className="app__header">
        <h1>📦 Moving Volume Estimator</h1>
        <p className="app__tagline">
          Plan your move: estimate how many boxes you&rsquo;ll need and which
          vehicle will fit it all.
        </p>
      </header>

      <ol className="app__flow">
        <li>List the items you&rsquo;re moving</li>
        <li>Get an estimated box count per size</li>
        <li>See the recommended vehicle or truck</li>
      </ol>

      <p className="app__status">
        v1 (manual entry) is under construction. Photo scanning is planned for a
        later milestone.
      </p>
    </main>
  )
}

export default App
