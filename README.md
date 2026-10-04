# Motion-Graphics

Code-driven motion graphics. Each film is an HTML page whose `window.seek(t)` paints one frame, with a score
synthesized in code. Frames are rendered headlessly, then encoded with ffmpeg.

Rules, film layout and commands: [CLAUDE.md](CLAUDE.md). Start a film from `films/_template`.

Requires Node 18+ and ffmpeg (with libx264).
