# Abdulaziz Alkhlaiwe portfolio

A static, one-page portfolio served from the repository root on GitHub Pages at `/Abdulaziz/`.

A single line runs through the page. Scroll draws it, and in each project it becomes that project's world: a heartbeat for Mara, a voice for Echo, a Gulf route for Daleelk, a packed carton for Rassah, Suzuka for Pit Lane Hub, then Abbey Road and a Rear Window courtyard off the clock.

## Structure

- `index.html`: all copy and markup.
- `css/tokens.css`, `css/site.css`: type, colour worlds and layout.
- `js/site.js`: world colours, the connecting line, scene loading and small interactions.
- `scenes/<id>.js|css`: one self-contained scene per section. Each exports `mount(root, { reduced })`, which returns `{ update(p), destroy(), anchors?() }`.
- `assets/data/weeks.json`: weekly GitHub contributions for the year chart.

There is no build step. Serve the folder under `/Abdulaziz/` to preview it locally.

## Credits

Suzuka geometry from bacinger/f1-circuits (MIT). Coastline from Natural Earth (public domain). Mona Sans and Martian Mono under the SIL Open Font License.
