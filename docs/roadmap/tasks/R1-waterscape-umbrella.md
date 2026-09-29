# R1: Integrate River Pulse under Waterscape

The user added the River Pulse checkout and requested a unified Waterscape repository,
aligned with the remote `docs/making-water-visible.md`, including publication of the
accepted G2 grass and P2 performance changes. The user explicitly approved overriding
the default no-merge/no-push rule for this integration and publication.

1. Preserve the uploaded checkout, merge remote main and River Pulse bootstrap history
   into `task/R1`, and retain existing reservoir routes. Include the completed
   `task/river-pulse-ui` branch: the user subsequently requested the latest hosted
   cards, options and grass. Preserve its scientific-selection fixes and verify them.
2. Keep River Pulse in `river-pulse/`, sharing root vendor, geospatial/camera utilities,
   build tooling and tests. Document this boundary and the umbrella principles.
3. Fix the shared build to ship all River Pulse page modules/styles and real sourced
   Hacienda terrain and hydrography. Add package validation and navigation between experiences.
   Keep Jenner labeled as a data package, not a completed scene. Do not invent data
   or change the scientific mappings as part of repository integration.
4. Verify JS and Python tests, both data validators, registry freshness, shader
   compilation, build output, and local browser smoke tests. Use Firefox for local
   WebGPU inspection; Windows Chrome/Edge remain the target browsers. Record any
   remaining browser/performance limitations. Verify the built Pages paths.
5. Commit with this task title, append results, merge the verified integration into
   main, push normally (no force), and monitor GitHub Pages deployment.

Scope includes repository/docs/build/CI/navigation/package validation, generated
terrain/hydrography assets, refreshed reservoir preview media, and scoped fixes needed for the combined site to load. Existing
renderer/vendor implementations remain untouched by this task.
