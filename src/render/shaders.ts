import type { ShaderName } from '../core/types'

export const SHADER_LABELS: Record<ShaderName, string> = {
  aurora: 'Aurora',
  ondas: 'Ondas',
  particulas: 'Partículas',
  raios: 'Raios de luz',
  bokeh: 'Bokeh',
  nebulosa: 'Nebulosa',
  gradiente: 'Gradiente vivo',
  grade: 'Grade neon',
}

const HEAD = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 cA;
uniform vec3 cB;
uniform vec3 cC;
uniform float uInt;
uniform float uScale;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
  float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return v; }
`

const BODIES: Record<ShaderName, string> = {
  aurora: `
void main(){
  vec2 uv = gl_FragCoord.xy/uRes; vec2 p = uv; p.x *= uRes.x/uRes.y; p /= uScale;
  float t = uTime*0.15;
  vec3 col = cA;
  for(int i=0;i<3;i++){
    float fi = float(i);
    float y = 0.55 + 0.18*sin(p.x*1.3 + t*(1.0+fi*0.4) + fi*2.0) + 0.12*fbm(vec2(p.x*1.5 + t + fi, t*0.5));
    float band = exp(-pow((uv.y - y)*(5.0+fi*2.0), 2.0));
    float rays = 0.6 + 0.4*fbm(vec2(p.x*6.0 + fi*3.0, t*2.0));
    vec3 c = mix(cB, cC, 0.5 + 0.5*sin(t*0.7 + p.x*1.2 + fi*1.7));
    col += c * band * rays * (0.7 - fi*0.15) * uInt;
  }
  col += cB*0.08*fbm(p*3.0 + t);
  gl_FragColor = vec4(col, 1.0);
}`,
  ondas: `
void main(){
  vec2 uv = gl_FragCoord.xy/uRes; vec2 p = uv; p.x *= uRes.x/uRes.y; p /= uScale;
  float t = uTime*0.4;
  vec3 col = cA;
  for(int i=0;i<8;i++){
    float fi = float(i);
    float y = 0.5 + 0.25*sin(p.x*(1.0+fi*0.15) + t*(0.6+fi*0.07) + fi) * (0.4+fi*0.08);
    float d = abs(uv.y - y);
    float line = 0.0025/(d+0.002);
    col += mix(cB, cC, fi/8.0) * line * 0.12 * uInt;
  }
  col += mix(cA, cB, uv.y)*0.25;
  gl_FragColor = vec4(col, 1.0);
}`,
  particulas: `
void main(){
  vec2 uv = gl_FragCoord.xy/uRes; vec2 p = uv; p.x *= uRes.x/uRes.y;
  float t = uTime*0.08;
  vec3 col = cA;
  for(int l=0;l<4;l++){
    float fl = float(l);
    float s = (8.0 + fl*6.0)/uScale;
    vec2 q = p*s + vec2(t*(1.0+fl)*1.5, -t*(2.0+fl)*2.0);
    vec2 id = floor(q); vec2 f = fract(q)-0.5;
    float h = hash(id+fl*7.0);
    vec2 o = vec2(hash(id+3.1)-0.5, hash(id+8.7)-0.5)*0.6;
    float d = length(f-o);
    float size = 0.02 + 0.05*h*h;
    float tw = 0.5+0.5*sin(uTime*(1.0+h*3.0)+h*40.0);
    float g = smoothstep(size, 0.0, d) * step(0.55, h) * tw;
    g += 0.004/(d*d+0.004) * step(0.85,h) * 0.15 * tw;
    col += mix(cB, cC, hash(id+1.3)) * g * (1.0 - fl*0.18) * uInt;
  }
  gl_FragColor = vec4(col, 1.0);
}`,
  raios: `
void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  vec2 src = vec2(0.5, 1.15);
  vec2 d = uv - src;
  float ang = atan(d.x, -d.y);
  float t = uTime*0.12;
  float r = fbm(vec2(ang*6.0/uScale, t)) * 0.7 + fbm(vec2(ang*14.0/uScale, t*1.7))*0.5;
  r = pow(r, 2.0);
  float fall = smoothstep(1.6, 0.0, length(d));
  vec3 col = cA + mix(cC, cB, r) * r * fall * 1.6 * uInt;
  col += cB * 0.25 * smoothstep(0.8, 0.0, length(d)) * uInt;
  gl_FragColor = vec4(col, 1.0);
}`,
  bokeh: `
void main(){
  vec2 uv = gl_FragCoord.xy/uRes; vec2 p = uv; p.x *= uRes.x/uRes.y;
  float t = uTime*0.05;
  vec3 col = cA;
  for(int i=0;i<28;i++){
    float fi = float(i);
    vec2 c = vec2(hash(vec2(fi,1.3)), hash(vec2(fi,7.1)));
    c.x = fract(c.x*uRes.x/uRes.y + t*(0.2+hash(vec2(fi,3.3))*0.5)) * uRes.x/uRes.y;
    c.y = fract(c.y + sin(t*3.0+fi)*0.05);
    float rad = (0.04 + 0.12*hash(vec2(fi,9.9)))*uScale;
    float d = length(p - c);
    float a = smoothstep(rad, rad*0.85, d) * 0.35 + smoothstep(rad, rad*0.97, d)*smoothstep(rad*0.8, rad, d)*0.25;
    col += mix(cB, cC, hash(vec2(fi,4.4))) * a * uInt * (0.5+0.5*sin(uTime*0.5+fi));
  }
  gl_FragColor = vec4(col, 1.0);
}`,
  nebulosa: `
void main(){
  vec2 uv = gl_FragCoord.xy/uRes; vec2 p = uv*2.0-1.0; p.x *= uRes.x/uRes.y; p /= uScale;
  float t = uTime*0.05;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2,1.3) - t));
  vec2 r = vec2(fbm(p + 4.0*q + vec2(1.7,9.2) + t*1.5), fbm(p + 4.0*q + vec2(8.3,2.8) - t));
  float f = fbm(p + 4.0*r);
  vec3 col = mix(cA, cB, clamp(f*f*2.0, 0.0, 1.0));
  col = mix(col, cC, clamp(length(q)*0.6*uInt, 0.0, 1.0)*0.6);
  col *= 0.6 + 0.8*f*uInt;
  float stars = step(0.996, hash(floor(gl_FragCoord.xy/2.0))) * (0.5+0.5*sin(uTime*2.0+hash(floor(gl_FragCoord.xy))*50.0));
  col += stars*0.6;
  gl_FragColor = vec4(col, 1.0);
}`,
  gradiente: `
void main(){
  vec2 uv = gl_FragCoord.xy/uRes; vec2 p = uv; p.x *= uRes.x/uRes.y;
  float t = uTime*0.2;
  float ar = uRes.x/uRes.y;
  vec2 b1 = vec2(ar*(0.5+0.35*sin(t*0.9)), 0.5+0.35*cos(t*0.7));
  vec2 b2 = vec2(ar*(0.5+0.4*cos(t*0.6+2.0)), 0.5+0.3*sin(t*0.8+1.0));
  float d1 = smoothstep(0.9*uScale, 0.0, length(p-b1));
  float d2 = smoothstep(0.8*uScale, 0.0, length(p-b2));
  vec3 col = cA;
  col = mix(col, cB, d1*uInt);
  col = mix(col, cC, d2*0.85*uInt);
  col += (hash(gl_FragCoord.xy+t)-0.5)*0.02;
  gl_FragColor = vec4(col, 1.0);
}`,
  grade: `
void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  vec3 col = cA;
  float hor = 0.42;
  if(uv.y < hor){
    float z = 0.25/(hor - uv.y + 0.001);
    vec2 g = vec2((uv.x-0.5)*z*2.0/uScale, z*0.6/uScale + uTime*0.6);
    vec2 f = abs(fract(g)-0.5);
    float line = smoothstep(0.06*z*0.15, 0.0, min(f.x, f.y)*0.2);
    float fade = smoothstep(0.0, hor, uv.y);
    col += cB * line * fade * uInt;
  } else {
    col = mix(cA, cC*0.35, (uv.y-hor)*1.2);
    float sun = smoothstep(0.22, 0.2, length((uv - vec2(0.5, hor+0.12))*vec2(uRes.x/uRes.y,1.0)));
    float stripes = step(0.5, fract((uv.y-hor)*40.0)) + step(hor+0.12, uv.y);
    col = mix(col, cC, sun*min(stripes,1.0)*uInt);
  }
  col += cB*0.25*exp(-abs(uv.y-hor)*30.0)*uInt;
  gl_FragColor = vec4(col, 1.0);
}`,
}

export const fragmentSource = (name: ShaderName) => HEAD + (BODIES[name] ?? BODIES.gradiente)

export const VERTEX = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }`
