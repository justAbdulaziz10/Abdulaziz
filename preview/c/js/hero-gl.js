// Hero light: a projector beam, drifting light leaks and film grain.
// One fragment shader on a full-screen triangle. Renders a single still frame
// when motion is reduced or the device looks low-powered.
(function () {
  const canvas = document.getElementById('hero-gl');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!gl) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  const lowPower = (navigator.hardwareConcurrency || 4) <= 2 || saveData;
  const still = reduced || lowPower;

  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `
precision mediump float;
uniform vec2 r; uniform float t; uniform vec2 m;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r; float asp=r.x/r.y;
  vec2 q=vec2(uv.x*asp,uv.y);
  vec3 base=vec3(.051,.039,.031);
  // projector beam from the upper left, slowly breathing
  vec2 o=vec2(-.15*asp,1.25)+m*.04;
  vec2 d=q-o; float ang=atan(d.y,d.x);
  float beamDir=-.62+.05*sin(t*.11);
  float beam=exp(-pow((ang-beamDir)*5.2,2.));
  float dust=fbm(vec2(ang*9.,length(d)*2.-t*.05));
  beam*=(.55+.6*dust)*smoothstep(2.4,.2,length(d));
  vec3 col=base+vec3(1.,.66,.28)*beam*.32;
  // light leaks drifting along the edges
  float lk1=fbm(q*1.4+vec2(t*.035,-t*.02));
  float e1=smoothstep(.55,1.05,uv.x+.25*lk1)*smoothstep(.0,.9,uv.y);
  col+=vec3(.85,.28,.1)*pow(e1,2.2)*.42*(.6+.4*sin(t*.23));
  float lk2=fbm(q*2.2-vec2(t*.03,t*.015));
  float e2=smoothstep(.4,.0,uv.y+.18*lk2);
  col+=vec3(.95,.62,.25)*pow(e2,2.)*.12;
  // gate flicker, vignette, grain
  col*=.97+.03*h(vec2(floor(t*24.),3.));
  vec2 v=uv-.5; col*=1.-dot(v,v)*1.25;
  float g=h(gl_FragCoord.xy+fract(t*7.)*97.)-.5;
  col+=g*.045;
  gl_FragColor=vec4(col,1.);
}`;

  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't'), uM = gl.getUniformLocation(prog, 'm');

  // Low internal resolution: the image is soft by design and grain hides the upscale.
  let scale = innerWidth < 900 ? 0.5 : 0.6;
  function size() {
    const w = Math.max(1, Math.round(canvas.clientWidth * scale));
    const h = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    gl.uniform2f(uR, w, h);
  }
  const mouse = [0, 0], target = [0, 0];
  addEventListener('pointermove', (e) => { target[0] = e.clientX / innerWidth - 0.5; target[1] = 0.5 - e.clientY / innerHeight; }, { passive: true });

  function draw(time) {
    mouse[0] += (target[0] - mouse[0]) * 0.04; mouse[1] += (target[1] - mouse[1]) * 0.04;
    gl.uniform1f(uT, 20 + time / 1000);
    gl.uniform2f(uM, mouse[0], mouse[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  size();
  if (still) { draw(0); canvas.classList.add('is-on'); addEventListener('resize', () => { size(); draw(0); }); return; }

  let visible = true, raf = 0, last = 0;
  const minDt = innerWidth < 900 ? 1000 / 30 : 0;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }).observe(canvas);
  function loop(time) {
    raf = 0;
    if (!visible || document.hidden) return;
    if (time - last >= minDt) { last = time; draw(time); }
    raf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && !raf) raf = requestAnimationFrame(loop); });
  addEventListener('resize', size);
  raf = requestAnimationFrame((t) => { canvas.classList.add('is-on'); loop(t); });
})();
