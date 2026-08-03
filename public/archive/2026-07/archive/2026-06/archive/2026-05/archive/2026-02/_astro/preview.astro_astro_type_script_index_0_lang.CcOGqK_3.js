(function(){const a=document.getElementById("mountain-canvas");if(!a)return;const e=a.getContext("webgl");if(!e){a.parentElement.style.background="linear-gradient(180deg, #0f172a, #1e293b)";return}function w(){const p=a.parentElement.getBoundingClientRect();a.width=p.width*window.devicePixelRatio,a.height=p.height*window.devicePixelRatio,e.viewport(0,0,a.width,a.height)}w(),window.addEventListener("resize",w);const i="attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}",o=`
        precision mediump float;
        uniform vec2 u_res;
        uniform float u_time;
        uniform float u_hour;
        uniform float u_seed;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1, 0)), f.x),
            mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x),
            f.y
          );
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }

        vec3 skyColor(float hour, float y) {
          // Dawn (5-7)
          vec3 dawn_top = vec3(0.15, 0.1, 0.25);
          vec3 dawn_bot = vec3(0.9, 0.5, 0.3);
          // Day (8-16)
          vec3 day_top = vec3(0.3, 0.5, 0.8);
          vec3 day_bot = vec3(0.7, 0.85, 1.0);
          // Dusk (17-19)
          vec3 dusk_top = vec3(0.15, 0.1, 0.3);
          vec3 dusk_bot = vec3(0.85, 0.35, 0.2);
          // Night (20-4)
          vec3 night_top = vec3(0.02, 0.02, 0.06);
          vec3 night_bot = vec3(0.06, 0.08, 0.15);

          vec3 top, bot;
          if (hour < 5.0) { top = night_top; bot = night_bot; }
          else if (hour < 7.0) {
            float t = (hour - 5.0) / 2.0;
            top = mix(night_top, dawn_top, t);
            bot = mix(night_bot, dawn_bot, t);
          }
          else if (hour < 8.0) {
            float t = hour - 7.0;
            top = mix(dawn_top, day_top, t);
            bot = mix(dawn_bot, day_bot, t);
          }
          else if (hour < 17.0) { top = day_top; bot = day_bot; }
          else if (hour < 19.0) {
            float t = (hour - 17.0) / 2.0;
            top = mix(day_top, dusk_top, t);
            bot = mix(day_bot, dusk_bot, t);
          }
          else if (hour < 20.0) {
            float t = hour - 19.0;
            top = mix(dusk_top, night_top, t);
            bot = mix(dusk_bot, night_bot, t);
          }
          else { top = night_top; bot = night_bot; }

          return mix(bot, top, y);
        }

        void main() {
          vec2 uv = gl_FragCoord.xy / u_res;

          // Sky
          vec3 col = skyColor(u_hour, uv.y);

          // Mountain layers
          for (int i = 0; i < 3; i++) {
            float fi = float(i);
            float freq = 2.0 + fi * 1.5;
            float height = 0.25 + fi * 0.12;
            float mountain = fbm(vec2(uv.x * freq + u_seed + fi * 3.7, fi * 5.0 + u_time * 0.01)) * height + 0.1 + fi * 0.08;
            float darkness = 0.08 + fi * 0.06;
            if (uv.y < mountain) {
              col = mix(col, vec3(darkness), 0.7 - fi * 0.15);
            }
          }

          // Stars (only at night)
          if (u_hour > 19.0 || u_hour < 6.0) {
            float star = step(0.998, hash(floor(uv * 200.0)));
            float twinkle = 0.5 + 0.5 * sin(u_time * 2.0 + hash(floor(uv * 200.0)) * 6.28);
            col += star * twinkle * vec3(0.8, 0.9, 1.0);
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `;function d(p,k){const x=e.createShader(k);return e.shaderSource(x,p),e.compileShader(x),x}const s=e.createProgram();e.attachShader(s,d(i,e.VERTEX_SHADER)),e.attachShader(s,d(o,e.FRAGMENT_SHADER)),e.linkProgram(s),e.useProgram(s);const m=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,m),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),e.STATIC_DRAW);const t=e.getAttribLocation(s,"p");e.enableVertexAttribArray(t),e.vertexAttribPointer(t,2,e.FLOAT,!1,0,0);const u=e.getUniformLocation(s,"u_res"),h=e.getUniformLocation(s,"u_time"),r=e.getUniformLocation(s,"u_hour"),c=e.getUniformLocation(s,"u_seed");let l=0;for(let p=0;p<window.location.pathname.length;p++)l+=window.location.pathname.charCodeAt(p);l=l%100/10;const g=new Date,n=g.getHours()+g.getMinutes()/60,f=document.getElementById("shader-time-label"),v=["night","night","night","night","night","dawn","dawn","morning","morning","day","day","day","day","day","day","day","day","dusk","dusk","dusk","night","night","night","night"];f&&(f.textContent=`seed: ${l.toFixed(1)} / time: ${v[g.getHours()]} (${g.getHours()}:${String(g.getMinutes()).padStart(2,"0")})`);const b=performance.now();function y(){const p=(performance.now()-b)/1e3;e.uniform2f(u,a.width,a.height),e.uniform1f(h,p),e.uniform1f(r,n),e.uniform1f(c,l),e.drawArrays(e.TRIANGLE_STRIP,0,4),requestAnimationFrame(y)}y()})();(function(){const a=document.getElementById("cairn-grid");if(!a)return;const e=[{title:"Sidecar Containers",tag:"devops",variant:"tech"},{title:"Kedarkantha Trek",tag:"treks",variant:"trek"},{title:"UUID v4 vs ULID",tag:"postgres",variant:"tech"},{title:"Django Kafka",tag:"django",variant:"tech"},{title:"Kuari Pass Trek",tag:"treks",variant:"trek"},{title:"Chopta Chandrashila",tag:"treks",variant:"trek"},{title:"Deploy Times -87%",tag:"devops",variant:"tech"},{title:"ESP8266 Flashing",tag:"arduino",variant:"tech"}];function w(o){let d=0;for(let s=0;s<o.length;s++)d=(d<<5)-d+o.charCodeAt(s)|0;return d}function i(o){let d=o;return function(){return d=(d*16807+0)%2147483647,(d-1)/2147483646}}e.forEach(o=>{const d=Math.abs(w(o.title)),s=i(d),m=o.variant==="trek",t=4+Math.floor(s()*4);let u='<svg width="80" height="100" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">';u+=`<line x1="15" y1="95" x2="65" y2="95" stroke="${m?"#d97706":"#22d3ee"}" stroke-width="1" opacity="0.3"/>`;let r=90;for(let l=0;l<t;l++){const g=10+s()*20-l*1.5,n=5+s()*8,f=40-g/2+(s()-.5)*6,v=.4+s()*.4;if(m){const b=g/2,y=n/2,p=`rgba(217, 119, 6, ${v})`,k=`rgba(217, 119, 6, ${v+.2})`;u+=`<ellipse cx="${f+g/2}" cy="${r-n/2}" rx="${b}" ry="${y}" fill="${p}" stroke="${k}" stroke-width="0.5"/>`}else{const b=(s()-.5)*4,y=`rgba(34, 211, 238, ${v*.7})`,p=`rgba(34, 211, 238, ${v})`;u+=`<rect x="${f}" y="${r-n}" width="${g}" height="${n}" fill="${y}" stroke="${p}" stroke-width="0.5" transform="skewX(${b})"/>`}r-=n+1+s()*2}u+="</svg>";const c=document.createElement("div");c.className="cairn-card",c.innerHTML=`
          ${u}
          <div class="cairn-card-title">${o.title}</div>
          <div class="cairn-card-tag">${o.tag}</div>
        `,a.appendChild(c)})})();(function(){const a=document.getElementById("topo-svg");if(!a)return;function e(m,t){const u=Math.sin(m*12.9898+t*78.233)*43758.5453;return u-Math.floor(u)}function w(m,t){const u=Math.floor(m),h=Math.floor(t),r=m-u,c=t-h,l=r*r*(3-2*r),g=c*c*(3-2*c);return(e(u,h)*(1-l)+e(u+1,h)*l)*(1-g)+(e(u,h+1)*(1-l)+e(u+1,h+1)*l)*g}function i(m,t){let u=0,h=.5;for(let r=0;r<4;r++)u+=h*w(m,t),m*=2,t*=2,h*=.5;return u}const o=Math.random()*100,d=[.3,.4,.5,.6,.7],s=["3200m","3600m","4000m","4400m","4800m"];d.forEach((m,t)=>{let u="";for(let r=0;r<=800;r+=4){const l=10+i(r/200+o,m*5+o*.3)*100;u+=(r===0?"M":"L")+r+","+l}const h=document.createElementNS("http://www.w3.org/2000/svg","path");if(h.setAttribute("d",u),h.setAttribute("class",`topo-line topo-line-${t+1}`),a.appendChild(h),t%2===0){const r=document.createElementNS("http://www.w3.org/2000/svg","text"),c=50+t*180,l=i(c/200+o,m*5+o*.3);r.setAttribute("x",String(c)),r.setAttribute("y",String(8+l*100)),r.setAttribute("class","topo-label"),r.textContent=s[t],a.appendChild(r)}})})();(function(){const a=document.getElementById("elevation-svg"),e=document.getElementById("elevation-slider"),w=document.getElementById("elevation-alt");if(!a||!e)return;const i=[{x:0,alt:2800,label:"Sankri"},{x:.15,alt:3100,label:"Juda Ka Talab"},{x:.35,alt:3400,label:"Base Camp"},{x:.55,alt:3200,label:"Valley"},{x:.75,alt:3600,label:"Ridge"},{x:.9,alt:3800,label:"Summit"},{x:1,alt:3100,label:"Descent"}],o=2600,d=4e3,s=10,m=600,t=80;let u="",h="";i.forEach((n,f)=>{const v=s+n.x*(m-2*s),b=t-s-(n.alt-o)/(d-o)*(t-2*s);u+=(f===0?"M":"L")+v+","+b,h+=(f===0?"M":"L")+v+","+b}),h+=`L${m-s},${t-s} L${s},${t-s} Z`;const r=document.createElementNS("http://www.w3.org/2000/svg","path");r.setAttribute("d",h),r.setAttribute("class","elevation-fill"),a.appendChild(r);const c=document.createElementNS("http://www.w3.org/2000/svg","path");c.setAttribute("d",u),c.setAttribute("class","elevation-line"),a.appendChild(c),i.forEach(n=>{const f=s+n.x*(m-2*s),v=t-s-(n.alt-o)/(d-o)*(t-2*s),b=document.createElementNS("http://www.w3.org/2000/svg","circle");b.setAttribute("cx",String(f)),b.setAttribute("cy",String(v)),b.setAttribute("r","2"),b.setAttribute("fill","#d97706"),b.setAttribute("opacity","0.5"),a.appendChild(b);const y=document.createElementNS("http://www.w3.org/2000/svg","text");y.setAttribute("x",String(f)),y.setAttribute("y",String(v-6)),y.setAttribute("text-anchor","middle"),y.setAttribute("class","elevation-waypoint"),y.textContent=n.label,a.appendChild(y)});const l=document.createElementNS("http://www.w3.org/2000/svg","circle");l.setAttribute("r","5"),l.setAttribute("class","elevation-marker"),a.appendChild(l);function g(n){const f=n/100;let v=i[0].alt;for(let p=0;p<i.length-1;p++)if(f>=i[p].x&&f<=i[p+1].x){const k=(f-i[p].x)/(i[p+1].x-i[p].x);v=i[p].alt+k*(i[p+1].alt-i[p].alt);break}f>=i[i.length-1].x&&(v=i[i.length-1].alt);const b=s+f*(m-2*s),y=t-s-(v-o)/(d-o)*(t-2*s);l.setAttribute("cx",String(b)),l.setAttribute("cy",String(y)),w&&(w.textContent=Math.round(v).toLocaleString()+"m")}g(0),e.addEventListener("input",()=>g(parseInt(e.value)))})();(function(){const a=document.getElementById("flow-canvas"),e=document.getElementById("flow-toggle"),w=document.getElementById("flow-label");if(!a)return;const i=a.getContext("2d");let o="tech";const d=300;let s=[];function m(){const r=a.parentElement.getBoundingClientRect();a.width=r.width*window.devicePixelRatio,a.height=r.height*window.devicePixelRatio,i.scale(window.devicePixelRatio,window.devicePixelRatio),t(r.width,r.height)}function t(r,c){s=[];for(let l=0;l<d;l++)s.push({x:Math.random()*r,y:Math.random()*c,vx:0,vy:0,life:Math.random()*100})}function u(r,c){return Math.sin(r*.01+c*.005)*Math.cos(c*.008-r*.003)}function h(){const r=a.parentElement.getBoundingClientRect(),c=r.width,l=r.height;i.fillStyle=o==="tech"?"rgba(15, 23, 42, 0.08)":"rgba(250, 248, 245, 0.08)",i.fillRect(0,0,c,l);const g=performance.now()/1e3;s.forEach(n=>{let f;o==="tech"?f=Math.round(u(n.x+g*20,n.y)*4)*(Math.PI/4):f=u(n.x*.5+g*10,n.y*.5)*Math.PI*2,n.vx=Math.cos(f)*(o==="tech"?1.2:.8),n.vy=Math.sin(f)*(o==="tech"?1.2:.8),n.x+=n.vx,n.y+=n.vy,n.life++,(n.x<0||n.x>c||n.y<0||n.y>l||n.life>200)&&(n.x=Math.random()*c,n.y=Math.random()*l,n.life=0);const v=Math.min(n.life/20,1)*Math.min((200-n.life)/20,1)*.6;i.fillStyle=o==="tech"?`rgba(34, 211, 238, ${v})`:`rgba(217, 119, 6, ${v})`,i.fillRect(n.x,n.y,o==="tech"?2:1.5,o==="tech"?2:1.5)}),requestAnimationFrame(h)}m(),window.addEventListener("resize",m),h(),e?.addEventListener("click",()=>{o=o==="tech"?"trek":"tech",e.textContent=o==="tech"?"switch to trek":"switch to tech",w&&(w.textContent=`mode: ${o} / particles: ${d}`);const r=a.parentElement.getBoundingClientRect();i.clearRect(0,0,r.width,r.height)})})();(function(){const a=document.getElementById("terminal-body"),e=document.getElementById("terminal-input"),w=document.getElementById("term-time");if(!a||!e)return;w&&(w.textContent=new Date().toLocaleTimeString());let i="~/blog",o="3800m";const d={"~/blog":["devops/","treks/","programming/","postgres/","about.md","contact.md"],"~/blog/devops":["reducing-deploy-times.md","sidecar-containers.md","nginx-ingress-k8s.md","aws-amplify-terraform.md","routing-traefik-nginx.md","adding-auth-kibana.md"],"~/blog/treks":["kedarkantha-trek.md","chopta-chandrashila-trek.md","kuari-pass-trek.md"],"~/blog/programming":["django-kafka-integration.md","django-bulk-save.md","flashing-esp8266.md","pdf-to-tiff.md","java-streaming.md"],"~/blog/postgres":["uuid-vs-ulid.md","uuid-vs-serials.md","django-rds-pgbouncer.md"]},s={"kedarkantha-trek":"A winter trek through snow-covered trails to 3,800m in Govind Wildlife Sanctuary. Summit day: -15°C, knee-deep snow, and a panoramic view of Swargarohini.","reducing-deploy-times":"How we cut deployment time from 23 minutes to 3 minutes by parallelizing Docker builds, caching pip layers, and pre-pulling base images on k8s nodes.","sidecar-containers":"Running log collectors, config reloaders, and TLS proxies as sidecar containers sharing the same pod network and volume mounts.","uuid-vs-ulid":"ULID wins. Monotonic ordering means B-tree index inserts are sequential instead of random. 3.2x faster INSERT throughput on our Postgres benchmark.","chopta-chandrashila-trek":"The Tungnath temple at 3,680m, followed by the Chandrashila summit at 4,000m. Clear views of Nanda Devi, Trisul, and Chaukhamba.","kuari-pass-trek":"Lord Curzon's trail through oak and rhododendron forests. The pass at 3,876m offers a 180° panorama of the Nanda Devi sanctuary."},m={"~/blog":"3800m","~/blog/devops":"4200m","~/blog/treks":"4800m","~/blog/programming":"3600m","~/blog/postgres":"3900m"};function t(c){const l=document.createElement("div");l.innerHTML=c;const g=a.querySelector(".term-input-line");a.insertBefore(l,g),a.scrollTop=a.scrollHeight}function u(){return`<span class="term-prompt">sreeraj</span><span class="term-path">@${o}</span><span style="color:#e2e8f0">:</span><span class="term-highlight">${i}</span><span style="color:#e2e8f0">$ </span>`}function h(){const c=a.querySelector(".term-input-line");c.querySelectorAll("span:not(.term-input)");const l=document.createElement("div");l.className="term-input-line",l.innerHTML=u(),l.appendChild(e),c.replaceWith(l),e.focus()}function r(c){if(c=c.trim(),!c)return;t(u()+`<span style="color:#e2e8f0">${c}</span>`);const l=c.split(/\s+/),g=l[0],n=l.slice(1).join(" ");switch(g){case"help":t('<span class="term-output">Available commands:</span>'),t('<span class="term-highlight">  ls</span><span class="term-output">          — list posts in current directory</span>'),t('<span class="term-highlight">  cd &lt;dir&gt;</span><span class="term-output">    — navigate (devops, treks, programming, postgres, ..)</span>'),t('<span class="term-highlight">  cat &lt;post&gt;</span><span class="term-output">  — read a post summary</span>'),t('<span class="term-highlight">  altitude</span><span class="term-output">    — show current elevation</span>'),t('<span class="term-highlight">  kubectl</span><span class="term-output">     — try: kubectl get pods</span>'),t('<span class="term-highlight">  whoami</span><span class="term-output">      — who is sreeraj</span>'),t('<span class="term-highlight">  clear</span><span class="term-output">       — clear terminal</span>');break;case"ls":(d[i]||[]).forEach(b=>{const y=b.endsWith("/");t(`<span style="color:${y?"#51cf66":"#94a3b8"}">${b}</span>`)});break;case"cd":if(!n||n==="~"||n==="..")i="~/blog";else if(n==="..")i="~/blog";else{const b=i+"/"+n.replace(/\/$/,"");if(d[b])i=b;else{t(`<span class="term-error">cd: no such directory: ${n}</span>`);break}}o=m[i]||"3800m",h();break;case"cat":const v=n.replace(/\.md$/,"");s[v]?t(`<span class="term-output">${s[v]}</span>`):t(`<span class="term-error">cat: ${n}: No such file</span>`);break;case"altitude":t(`<span class="term-trek">Current altitude: ${o}</span>`),t(`<span class="term-output">Oxygen saturation: ~${i.includes("trek")?"82":"95"}%</span>`);break;case"kubectl":n.startsWith("get pod")?(t('<span class="term-output">NAME                        READY   STATUS    RESTARTS   AGE</span>'),t('<span class="term-output">api-server-7d4f8b6c9-x2k   1/1     Running   0          47h</span>'),t('<span class="term-output">worker-batch-2c91f-np8     1/1     Running   0          47h</span>'),t('<span class="term-output">redis-cache-0              1/1     Running   0          12d</span>'),t('<span class="term-highlight">pgbouncer-5f7a2-jk3        1/1     Running   0          12d</span>')):n.startsWith("get svc")||n.startsWith("get service")?(t('<span class="term-output">NAME            TYPE           CLUSTER-IP      EXTERNAL-IP     PORT(S)</span>'),t('<span class="term-output">api-gateway     LoadBalancer   10.100.24.87    52.66.x.x       443:31234/TCP</span>'),t('<span class="term-output">redis-cache     ClusterIP      10.100.31.12    &lt;none&gt;          6379/TCP</span>')):t('<span class="term-output">Try: kubectl get pods, kubectl get svc</span>');break;case"whoami":t('<span class="term-output">Sreeraj Rajan — DevOps engineer at Medley Learning</span>'),t('<span class="term-output">Himalayan trekker. Occasional open-source contributor.</span>'),t('<span class="term-trek">Summits: Kedarkantha (3,800m), Chandrashila (4,000m), Kuari Pass (3,876m)</span>');break;case"clear":for(;a.children.length>1;)a.removeChild(a.firstChild);break;case"sudo":t('<span class="term-error">Permission denied. You are above the treeline — there is no root here.</span>');break;case"pwd":t(`<span class="term-output">${i}</span>`);break;case"uptime":t('<span class="term-output">Blog uptime: since July 2021</span>'),t(`<span class="term-output">Your session: ${Math.round(performance.now()/1e3)}s</span>`);break;default:t(`<span class="term-error">command not found: ${g}. Try 'help'</span>`)}h()}e.addEventListener("keydown",c=>{c.key==="Enter"&&(r(e.value),e.value="")}),a.addEventListener("click",()=>e.focus())})();(function(){const a=document.getElementById("weather-content"),e=document.getElementById("weather-fog"),w=document.getElementById("weather-snow"),i=document.getElementById("weather-alt");if(!(!a||!e||!w)){for(let o=0;o<40;o++){const d=document.createElement("span");d.className="snowflake",d.textContent="•",d.style.left=Math.random()*100+"%",d.style.animationDuration=3+Math.random()*4+"s",d.style.animationDelay=Math.random()*5+"s",d.style.fontSize=.3+Math.random()*.4+"rem",w.appendChild(d)}a.addEventListener("scroll",()=>{const o=a.scrollTop/(a.scrollHeight-a.clientHeight),d=Math.max(0,Math.min(1,(o-.3)*2.5));e.style.opacity=String(d);const s=Math.max(0,Math.min(1,(o-.6)*2.5));w.style.opacity=String(s);const m=Math.round(2800+o*1e3);let t="Clear";o>.6?t="Snow":o>.3?t="Fog":o>.15&&(t="Clouds"),i&&(i.textContent=m.toLocaleString()+"m — "+t)})}})();
