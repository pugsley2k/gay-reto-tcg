// Gay Retro TCG — foil landing page shaders.
// Everything here is drawn in code: the foil is a diffraction grating model,
// the gloss is a set of rectangular studio softboxes reflected analytically.

export const NCARD = 16; // card meshes
export const NOCC = 18; // cards + top loader + mailer (shadow casters)

export const COMMON = /* glsl */ `
#define PI 3.14159265
uniform vec3 uLp[3];
uniform vec3 uLc[3];
uniform vec3 uLs[3];
uniform float uTime;

float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
vec2 hash22(vec2 p){ float n=hash21(p); return vec2(n,hash21(p+n+17.1)); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+7.1; a*=.5; } return s; }
float bump(float x,float c,float w){ float t=clamp(1.-(x-c)*(x-c)/(w*w),0.,1.); return t*t; }
// wavelength in microns -> linear rgb, with soft overlaps so bands blend like foil does
vec3 spectral(float l){
  float w=(l-.39)/.33;
  float e=smoothstep(-.06,.1,w)*(1.-smoothstep(.9,1.06,w));
  vec3 c=.5+.5*cos(6.2831853*(w-vec3(.9,.48,.12))/1.25);
  return mix(c,c*c,.65)*e;
}
float sdRR(vec2 p,vec2 b,float r){ vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
vec2 rot2(vec2 v,float a){ float c=cos(a),s=sin(a); return vec2(c*v.x-s*v.y,s*v.x+c*v.y); }
// a rectangular softbox aimed at the origin, seen along R from P. 0..1
float boxAt(vec3 P,vec3 R,vec3 c,vec2 hsz,float blur){
  vec3 n=normalize(-c);
  float dn=dot(R,n); if(dn>-.001) return 0.;
  float t=dot(c-P,n)/dn; if(t<0.) return 0.;
  vec3 h=P+R*t-c;
  vec3 ux=normalize(cross(vec3(0.,1.,0.),n)); vec3 uy=cross(n,ux);
  float d=sdRR(vec2(dot(h,ux),dot(h,uy)),hsz,.25);
  return 1.-smoothstep(-blur,blur,d);
}
float softbox(vec3 P,vec3 R,int i,float blur){ return boxAt(P,R,uLp[i],uLs[i].xy,blur); }
vec3 tone(vec3 c){ c=max(c,0.); c=1.-exp(-c*1.35); return pow(c,vec3(1./2.2)); }
`;

export const CARD_VERT = /* glsl */ `
varying vec3 vO; varying vec3 vW; varying vec3 vN; varying vec3 vT; varying vec3 vB;
void main(){
  vO=position;
  vec4 w=modelMatrix*vec4(position,1.);
  vW=w.xyz;
  mat3 m=mat3(modelMatrix);
  vN=normalize(m*normal); vT=normalize(m*vec3(1.,0.,0.)); vB=normalize(m*vec3(0.,1.,0.));
  gl_Position=projectionMatrix*viewMatrix*w;
}`;

export const CARD_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D uFace; uniform sampler2D uBack; uniform sampler2D uWord;
uniform float uPattern; uniform float uPhoto; uniform float uSeed; uniform float uWordGloss; uniform float uGain; uniform float uFoil;
varying vec3 vO; varying vec3 vW; varying vec3 vN; varying vec3 vT; varying vec3 vB;
const vec2 SIZE=vec2(.63,.88);
const float TH=.011;

float etchPhi(vec2 p){ return p.x*4.2+p.y*3.4+.34*fbm(p*5.+uSeed)+.1*sin(p.y*23.+p.x*9.); }

void foil(vec2 uv,out float amt,out vec2 g,out float spark){
  vec2 p=uv*SIZE;
  float art=1.-smoothstep(-.004,.004,sdRR(uv-vec2(.5,.63),vec2(.405,.205),.012));
  float inner=1.-smoothstep(-.004,.004,sdRR(uv-.5,vec2(.452,.464),.02));
  amt=0.; g=vec2(1.,0.); spark=(hash21(floor(p*520.)+uSeed)-.5)*.3;
  if(uPattern<.5){
    // cosmos: scattered discs and rings, each with its own grating angle
    vec2 q=p*24.; vec2 id=floor(q); float best=0.; vec2 gg=vec2(1.,0.);
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
      vec2 c=id+vec2(float(x),float(y)); vec2 r=hash22(c+uSeed);
      vec2 ctr=c+.5+(r-.5)*.9; float rad=.1+.44*r.x*r.x; float d=length(q-ctr);
      float disc=1.-smoothstep(rad-.05,rad,d);
      float ring=(1.-smoothstep(.0,.06,abs(d-rad*1.8-.1)))*step(.66,r.y)*.85;
      if(disc>best){ best=disc*(.55+.45*r.y); gg=rot2(vec2(1.,0.),.5+(hash21(c*1.7+3.)-.5)*1.5); }
      if(ring>best){ best=ring; gg=rot2(normalize(q-ctr+1e-4),.4); }
    }
    float base=.34;
    if(best>base){ amt=best; g=gg; } else { amt=base; g=rot2(vec2(1.,0.),.5); }
    amt*=mix(art,inner,uPhoto);
  } else if(uPattern<1.5){
    // linear: vertical bars
    float bar=floor(p.x*46.);
    amt=(.66+.34*smoothstep(-.3,.3,sin(p.x*46.*2.*PI)))*inner;
    g=vec2(1.,0.); spark+=(hash21(vec2(bar,3.))-.5)*.5;
  } else if(uPattern<2.5){
    // reverse: everything but the picture
    vec2 q=rot2(p,.785)*86.; vec2 id=floor(q);
    float star=1.-smoothstep(.26,.38,length(fract(q)-.5));
    star=mix(star,.5,smoothstep(.25,.7,fwidth(q.x)));
    g=mod(id.x+id.y,2.)<1.?vec2(.7071,.7071):vec2(.7071,-.7071);
    amt=inner*(1.-art)*(.5+.5*star);
  } else if(uPattern<3.5){
    // textured: fine etched lines that follow a flow field
    float phi=etchPhi(p); float e=.0015;
    vec2 gr=vec2(etchPhi(p+vec2(e,0.))-phi,etchPhi(p+vec2(0.,e))-phi);
    g=normalize(gr+1e-6);
    float l=sin(phi*64.);
    l=mix(l,0.,smoothstep(.5,1.6,fwidth(phi*64.)));
    amt=inner*(.78+.22*l);
  } else {
    amt=0.;
  }
}

void main(){
  vec3 N=normalize(vN); vec3 T=normalize(vT); vec3 B=normalize(vB);
  vec3 FN=normalize(cross(T,B));
  float fz=dot(N,FN);
  vec3 V=normalize(cameraPosition-vW);
  vec2 uv=vO.xy/SIZE+.5;
  vec2 p=vO.xy;
  vec3 lit=vec3(.07,.065,.085);
  for(int i=0;i<3;i++){ vec3 L=normalize(uLp[i]-vW); lit+=uLc[i]*max(dot(N,L),0.)*.3; }
  vec3 col;
  if(abs(fz)<.5){
    // the layered edge: paper, dark core, paper
    float z=vO.z/TH+.5;
    float core=(1.-smoothstep(.07,.15,abs(z-.5)))*(1.-smoothstep(.25,.7,fwidth(z)));
    vec3 e=mix(vec3(.74,.72,.68),vec3(.03,.04,.1),core);
    col=e*(lit*1.5+.05);
  } else {
    float front=step(0.,fz);
    vec2 tuv=front>.5?uv:vec2(1.-uv.x,uv.y);
    vec3 alb=front>.5?texture2D(uFace,tuv).rgb:texture2D(uBack,tuv).rgb;
    alb=pow(alb,vec3(2.2));
    float lum=dot(alb,vec3(.3,.59,.11));
    float amt; vec2 g; float spark;
    foil(uv,amt,g,spark);
    amt*=front*uFoil; amt*=mix(1.,.3-.16*lum,uPhoto);
    // diffraction: sin(in)+sin(out) along the grating direction picks the wavelength
    vec3 G=normalize(T*g.x+B*g.y);
    vec3 dif=vec3(0.);
    for(int i=0;i<3;i++){
      vec3 L=normalize(uLp[i]-vW);
      float u=(abs(dot(L+V,G))+spark*.035)*2.5;
      float nl=max(dot(N,L),0.);
      vec3 s=spectral(u)+.55*spectral(u*.5)+.32*spectral(u*.3333)+.2*spectral(u*.25);
      dif+=s*uLc[i]*nl*(i==1?.55:1.);
    }
    col=alb*lit*(1.-amt*.35);
    col+=amt*dif*.66;
    // metal under the ink
    vec3 R0=reflect(-V,N);
    float wide=0.; for(int i=0;i<3;i++) wide+=softbox(vW,R0,i,2.2)*dot(uLc[i],vec3(.333));
    col+=amt*wide*.035*vec3(.9,.92,1.);
    // the room, caught in the gloss
    float up=smoothstep(-.3,.95,R0.y);
    col+=mix(vec3(.02,.012,.03),vec3(.5,.44,.62),up*up)*(.04+.96*pow(1.-max(dot(N,V),0.),5.))*1.3;
    // gloss layer with hairline scratches
    float s1=pow(vnoise(rot2(p,.35)*vec2(1400.,16.)+uSeed),9.);
    float s2=pow(vnoise(rot2(p,-1.05)*vec2(1100.,12.)+uSeed*3.),11.);
    float scr=s1+s2;
    vec3 Nc=normalize(N+(T*(vnoise(p*40.)-.5)+B*(vnoise(p*40.+7.)-.5))*.004);
    float nv=max(dot(Nc,V),0.);
    vec3 R=reflect(-V,Nc);
    float F=.04+.96*pow(1.-nv,5.);
    vec3 spec=vec3(0.);
    for(int i=0;i<3;i++) spec+=uLc[i]*softbox(vW,R,i,.35);
    spec+=vec3(1.9,1.82,1.75)*boxAt(vW,R,vec3(-7.,2.5,9.),vec2(3.,5.),1.7);
    col+=min(spec*F*uGain*(1.+scr*3.*pow(1.-nv,1.5)),vec3(.42));
    col+=scr*pow(1.-nv,2.5)*lit*1.4;
    // the wordmark, as a lit sign behind the camera, caught in the gloss
    if(R.z>.05){
      float t=(13.-vW.z)/R.z; vec2 h=(vW+R*t).xy;
      vec2 wuv=vec2(h.x/26.+.5,(h.y-1.)/13.+.5);
      if(wuv.x>0.&&wuv.x<1.&&wuv.y>0.&&wuv.y<1.) col+=texture2D(uWord,wuv).r*uWordGloss*(.05+F)*vec3(1.,.93,.8)*.9;
    }
    // border shade and a little wear at one corner
    float bd=-sdRR(p,SIZE*.5,.03);
    col*=.82+.18*smoothstep(0.,.006,bd);
    float wear=(1.-smoothstep(0.,.011,bd))*(1.-smoothstep(.12,.42,length(uv-vec2(1.,0.))))*step(.5,vnoise(p*340.+uSeed));
    col=mix(col,vec3(.72,.71,.68)*lit*1.3,wear*.75*front);
  }
  gl_FragColor=vec4(tone(col),1.);
}`;

export const BG_VERT = /* glsl */ `
uniform mat4 uInvVP; varying vec3 vRay;
void main(){
  vec4 w=uInvVP*vec4(position.xy,1.,1.);
  vRay=w.xyz/w.w-cameraPosition;
  gl_Position=vec4(position.xy,1.,1.);
}`;

export const BG_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uCc[${NOCC}]; uniform vec3 uCx[${NOCC}]; uniform vec3 uCy[${NOCC}]; uniform vec4 uCi[${NOCC}];
uniform sampler2D uWordA; uniform sampler2D uWordB; uniform vec4 uRectA; uniform vec4 uRectB; uniform vec2 uWordW;
uniform float uWZ; uniform float uFY; uniform vec2 uRes;
varying vec3 vRay;

float word(sampler2D tx,vec4 r,vec2 xy){
  vec2 uv=(xy-r.xy)/r.zw+.5;
  if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.) return 0.;
  return texture2D(tx,uv).r;
}

void main(){
  vec3 ro=cameraPosition; vec3 rd=normalize(vRay);
  float tw=(uWZ-ro.z)/rd.z;
  float tf=rd.y<-.0001?(uFY-ro.y)/rd.y:1e9;
  bool onFloor=tf<tw;
  vec3 P=ro+rd*min(tw,tf);
  vec3 n=onFloor?vec3(0.,1.,0.):vec3(0.,0.,1.);
  vec2 sp=onFloor?P.xz:P.xy;
  // velvet
  float fib=fbm(sp*vec2(46.,52.))*.6+vnoise(sp*240.)*.4;
  vec3 alb=vec3(.022,.011,.031)*(.88+.24*fib);
  float wd=0.;
  if(!onFloor){
    wd=word(uWordA,uRectA,P.xy)*uWordW.x+word(uWordB,uRectB,P.xy)*uWordW.y;
    alb=mix(alb,vec3(.046,.023,.06)*(.9+.2*fib),wd);
  }
  float seam=onFloor?(P.z-uWZ):(P.y-uFY);
  float cove=.16+.84*smoothstep(0.,onFloor?3.2:2.4,seam);
  vec3 V=-rd;
  vec3 irr=vec3(0.); vec3 caus=vec3(0.);
  for(int i=0;i<3;i++){
    vec3 L=uLp[i]-P; float d2=dot(L,L); vec3 Ld=L*inversesqrt(d2);
    float nl=max(dot(n,Ld),0.);
    float pool=smoothstep(.72,.985,dot(-Ld,normalize(-uLp[i])));
    float sh=1.;
    if(i<2){
      for(int j=0;j<${NOCC};j++){
        if(uCi[j].z<.01) continue;
        vec3 nj=cross(uCx[j],uCy[j]);
        float dn=dot(L,nj); if(abs(dn)<1e-4) continue;
        float tt=dot(uCc[j]-P,nj)/dn;
        if(tt>0.&&tt<1.){
          vec3 Q=P+L*tt-uCc[j];
          float d=sdRR(vec2(dot(Q,uCx[j]),dot(Q,uCy[j])),uCi[j].xy,.04);
          float w=.02+.11*sqrt(d2)*tt;
          sh*=1.-min(abs(uCi[j].z),1.)*(1.-smoothstep(-w,w,d))*(i==0?.92:.6);
        }
      }
      // light thrown back off the cards
      for(int j=0;j<${NCARD};j++){
        if(uCi[j].z<.01) continue;
        vec3 nj=cross(uCx[j],uCy[j]);
        float s=dot(uLp[i]-uCc[j],nj); float sq=dot(P-uCc[j],nj);
        if(s*sq<=0.) continue;
        vec3 Lm=uLp[i]-2.*s*nj; vec3 D=P-Lm;
        float tt=dot(uCc[j]-Lm,nj)/dot(D,nj);
        if(tt>0.&&tt<1.){
          vec3 Q=Lm+D*tt-uCc[j];
          vec2 q=vec2(dot(Q,uCx[j]),dot(Q,uCy[j]));
          float dist=length(D)*(1.-tt);
          float w=.09+.2*dist;
          float m=1.-smoothstep(-w,w,sdRR(q,uCi[j].xy,.04));
          float ph=q.x/uCi[j].x*.34+q.y/uCi[j].y*.16+float(j)*.37+s*.11;
          float fr=smoothstep(-w*1.4,w*.2,sdRR(q,uCi[j].xy,.04));
          vec3 c=mix(vec3(.62,.58,.5),spectral(.4+.31*fract(ph))*2.2,s>0.?(.35+.6*fr)*uCi[j].w:0.);
          caus+=c*uLc[i]*m*uCi[j].z*max(dot(n,normalize(-D)),0.)/(1.+dist*dist*.1);
        }
      }
    }
    irr+=uLc[i]*nl*(.06+.94*pool*pool)*sh*19./(d2+14.);
  }
  float sheen=pow(1.-max(dot(n,V),0.),3.);
  vec3 col=alb*(irr*(1.+sheen*1.6)+vec3(.03,.026,.042));
  col+=caus*(alb*3.4+.004)*(1.+wd*.8);
  col*=cove;
  vec2 suv=gl_FragCoord.xy/uRes;
  float vig=smoothstep(1.2,.2,length((suv-.5)*vec2(1.1,1.)));
  col*=.22+.78*vig;
  // the site's own charcoal (#191b20), lifted a little where the light pools and darkened where cards cast shadow
  float lumi=dot(irr,vec3(.333));
  col=vec3(.098,.106,.125)*(.9+.2*smoothstep(0.,1.4,lumi))*(1.+.13*wd)*(.93+.07*vig);
  col+=(hash21(gl_FragCoord.xy+fract(uTime)*91.)-.5)*.008;
  gl_FragColor=vec4(col,1.);
}`;

export const MAIL_VERT = CARD_VERT;
export const MAIL_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D uLabel; uniform vec2 uSize;
varying vec3 vO; varying vec3 vW; varying vec3 vN; varying vec3 vT; varying vec3 vB;
float bub(vec2 p){ vec2 q=p*21.; q.x+=mod(floor(q.y),2.)*.5; vec2 f=fract(q)-.5; return smoothstep(.46,.1,length(f)); }
void main(){
  vec3 N=normalize(vN); vec3 T=normalize(vT); vec3 B=normalize(vB);
  float fz=dot(N,normalize(cross(T,B)));
  vec3 V=normalize(cameraPosition-vW);
  vec2 p=vO.xy; vec2 hsz=uSize*.5;
  vec3 alb=vec3(.74,.67,.53)*(.9+.14*fbm(p*70.));
  vec3 Np=N;
  if(fz>.5){
    vec2 lc=p-vec2(-.12,-.06); vec2 lh=vec2(.4,.23);
    float lab=1.-smoothstep(-.003,.003,sdRR(lc,lh,.012));
    float e=.004;
    float h0=bub(p); vec2 gr=vec2(bub(p+vec2(e,0.))-h0,bub(p+vec2(0.,e))-h0)/e;
    float pad=smoothstep(0.,.07,-sdRR(p,hsz,.05));
    Np=normalize(N-(T*gr.x+B*gr.y)*.0035*pad*(1.-lab));
    float flap=hsz.y-.2;
    alb*=1.-.3*(1.-smoothstep(0.,.006,abs(p.y-flap)));
    alb*=.92+.08*step(p.y,flap);
    alb*=.8+.2*pad;
    vec2 luv=lc/(lh*2.)+.5;
    vec3 lt=pow(texture2D(uLabel,clamp(luv,0.,1.)).rgb,vec3(2.2));
    alb=mix(alb,lt,lab);
    alb*=1.-.25*(1.-lab)*(1.-smoothstep(0.,.012,sdRR(lc,lh,.012)));
  }
  vec3 lit=vec3(.06,.055,.075);
  vec3 spec=vec3(0.);
  vec3 R=reflect(-V,Np);
  for(int i=0;i<3;i++){ vec3 L=normalize(uLp[i]-vW); lit+=uLc[i]*max(dot(Np,L),0.)*.34; spec+=uLc[i]*softbox(vW,R,i,1.6); }
  vec3 col=alb*lit+spec*.012;
  gl_FragColor=vec4(tone(col),1.);
}`;

// ---- second pass: clear plastic over the resolved scene ----
export const COPY_VERT = /* glsl */ `
varying vec2 vUv; void main(){ vUv=position.xy*.5+.5; gl_Position=vec4(position.xy,0.,1.); }`;
export const COPY_FRAG = /* glsl */ `
uniform sampler2D uScene; varying vec2 vUv;
void main(){ gl_FragColor=vec4(texture2D(uScene,vUv).rgb,1.); }`;

export const PLASTIC_VERT = /* glsl */ `
varying vec3 vO; varying vec3 vW; varying vec3 vN; varying vec3 vT; varying vec3 vB; varying vec2 vUv;
void main(){
  vO=position; vUv=uv;
  vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz;
  mat3 m=mat3(modelMatrix);
  vN=normalize(m*normal); vT=normalize(m*vec3(1.,0.,0.)); vB=normalize(m*vec3(0.,1.,0.));
  gl_Position=projectionMatrix*viewMatrix*w;
}`;

export const LOADER_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D uScene; uniform vec2 uRes; uniform float uAlpha; uniform vec2 uSize;
uniform vec3 uMc; uniform vec3 uMx; uniform vec3 uMy; uniform vec2 uMh; uniform float uClip;
varying vec3 vO; varying vec3 vW; varying vec3 vN; varying vec3 vT; varying vec3 vB;
void main(){
  if(uAlpha<.004) discard;
  vec3 r=vW-uMc; vec2 m=vec2(dot(r,uMx),dot(r,uMy));
  if(uClip>.5&&abs(m.x)<uMh.x&&m.y<uMh.y-.06&&m.y>-uMh.y) discard;
  vec2 suv=gl_FragCoord.xy/uRes;
  vec3 N=normalize(vN); vec3 T=normalize(vT); vec3 B=normalize(vB);
  vec3 FN=normalize(cross(T,B));
  float side=1.-abs(dot(N,FN));
  vec3 V=normalize(cameraPosition-vW);
  float bd=-sdRR(vO.xy,uSize*.5,.02);
  float edge=1.-smoothstep(0.,.03,bd);
  float seam=1.-smoothstep(0.,.0035,abs(bd-.032));
  float lip=1.-smoothstep(0.,.004,abs(vO.y-(uSize.y*.5-.05)));
  vec3 vn=mat3(viewMatrix)*N;
  vec2 dir=normalize(vO.xy+1e-4);
  // the flat face is clear: the card behind it stays pin sharp. Only the thick edges bend and split the light.
  float bend=max(edge,side);
  vec2 off=((mat3(viewMatrix)*(T*dir.x+B*dir.y)).xy*.03+vn.xy*.04)*bend;
  vec3 sc=bend<.002?texture2D(uScene,suv).rgb:vec3(texture2D(uScene,suv+off).r,texture2D(uScene,suv+off*1.25).g,texture2D(uScene,suv+off*1.5).b);
  sc*=mix(vec3(1.),vec3(.955,.975,1.)*.8,edge);
  vec3 Nb=normalize(N+(T*dir.x+B*dir.y)*edge*.5);
  float nv=max(dot(Nb,V),0.);
  float F=.045+.955*pow(1.-nv,5.);
  vec3 R=reflect(-V,Nb);
  vec3 spec=vec3(0.);
  for(int i=0;i<3;i++) spec+=uLc[i]*softbox(vW,R,i,.6);
  spec+=vec3(1.8)*boxAt(vW,R,vec3(-7.,2.5,9.),vec2(3.,5.),1.2);
  float up=smoothstep(-.3,.95,R.y);
  // glare stays a thin sheen so it never hides the card
  sc+=min(tone(spec*F*1.15)*.7,vec3(.1))*(.35+.65*bend)+vec3(.4,.38,.5)*up*up*F*.25*(.3+.7*bend)+.004;
  sc+=(seam*.06+lip*.05+side*.13+edge*.045)*vec3(.92,.95,1.);
  vec3 base=texture2D(uScene,suv).rgb;
  gl_FragColor=vec4(mix(base,sc,uAlpha),1.);
}`;

export const FILM_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D uScene; uniform vec2 uRes; uniform float uAlpha;
varying vec3 vO; varying vec3 vW; varying vec3 vN; varying vec3 vT; varying vec3 vB; varying vec2 vUv;
void main(){
  if(uAlpha<.004) discard;
  vec2 suv=gl_FragCoord.xy/uRes;
  vec3 N=normalize(vN); vec3 T=normalize(vT); vec3 B=normalize(vB);
  vec3 V=normalize(cameraPosition-vW);
  vec2 p=vUv;
  float strip=1.-smoothstep(.088,.094,p.x);
  vec2 g=(p-vec2(.105,.012))/vec2(.885,.976)*3.;
  vec2 f=fract(g);
  float inGrid=step(0.,g.x)*step(g.x,3.)*step(0.,g.y)*step(g.y,3.);
  float weld=(1.-smoothstep(.0,.018,min(min(f.x,1.-f.x),min(f.y*.75,(1.-f.y)*.75))))*inGrid;
  float mouth=(1.-smoothstep(.0,.012,abs(f.y-.93)))*inGrid;
  float w0=fbm(p*vec2(2.,3.)+3.); float e=.02;
  vec2 gr=vec2(fbm((p+vec2(e,0.))*vec2(2.,3.)+3.)-w0,fbm((p+vec2(0.,e))*vec2(2.,3.)+3.)-w0)/e;
  vec3 Np=normalize(N+(T*gr.x+B*gr.y)*.02+(T*(f.x-.5)+B*(f.y-.5))*.07*inGrid);
  vec2 off=gr*.00025;
  vec3 sc=texture2D(uScene,suv+off).rgb;
  sc=sc*.93+vec3(.012,.012,.016);
  float nv=max(dot(Np,V),0.);
  float F=.04+.96*pow(1.-nv,5.);
  vec3 R=reflect(-V,Np);
  vec3 spec=vec3(0.);
  for(int i=0;i<3;i++) spec+=uLc[i]*softbox(vW,R,i,1.8);
  spec+=vec3(1.8)*boxAt(vW,R,vec3(-7.,2.5,9.),vec2(3.,5.),2.);
  sc+=tone(spec*F*1.5)*.7;
  sc+=weld*.045+mouth*.03;
  // binding strip with three holes
  vec2 hp=vec2(p.x-.045,(fract(p.y*3.)-.5)/3.*1.38);
  float hole=1.-smoothstep(.016,.02,length(hp));
  sc=mix(sc,sc*.72+vec3(.035,.033,.04),strip);
  sc=mix(sc,texture2D(uScene,suv).rgb*.9,hole*strip);
  float border=1.-smoothstep(0.,.006,min(min(p.x,1.-p.x),min(p.y,1.-p.y)));
  sc+=border*.06;
  vec3 base=texture2D(uScene,suv).rgb;
  gl_FragColor=vec4(mix(base,sc,uAlpha),1.);
}`;
