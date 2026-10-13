// Builds dist/Inventra.html = legacy prototype + src/core.js inlined + build/patches.txt applied.
// Every patch must match EXACTLY once, otherwise the build fails (no silent drift).
const fs=require('fs'),path=require('path'),R=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
let html=R('legacy/Inventra.legacy.html');
const blocks=R('build/patches.txt').split(/^<<<<<<< ?/m).slice(1);
for(const b of blocks){const [head,rest]=[b.slice(0,b.indexOf('\n')).trim(),b.slice(b.indexOf('\n')+1)];
 const [oldPart,newPart]=rest.split(/^=======\n/m),nw=newPart.replace(/\n?>>>>>>>\s*$/,'');let old=oldPart.replace(/\n$/,'');
 const am=head.match(/^ALL (\d+)$/);if(am){const n=html.split(old).length-1;if(n!==+am[1])throw new Error('ALL patch expected '+am[1]+' matches, got '+n+': '+old.slice(0,80));html=html.split(old).join(nw);continue}
 if(head==='RANGE'){const [a,z]=old.split(/\n\|\|\|\n/),i=html.indexOf(a),j=html.indexOf(z);if(i<0||j<i||html.split(a).length!==2)throw new Error('RANGE patch failed: '+a.slice(0,60));html=html.slice(0,i)+nw+html.slice(j);continue}
 const n=html.split(old).length-1;if(n!==1)throw new Error('Patch matched '+n+' times: '+old.slice(0,80));html=html.replace(old,()=>nw)}
html=html.replace('<script>\n/* ===== Data layer','<script>\n'+R('src/core.js')+'\n</script>\n<script>\n/* ===== Data layer');
if(/S\.sales\b/.test(html))throw new Error('Legacy S.sales reference left behind');
fs.writeFileSync(path.join(__dirname,'..','dist/Inventra.html'),html);console.log('built dist/Inventra.html',html.length,'bytes');
